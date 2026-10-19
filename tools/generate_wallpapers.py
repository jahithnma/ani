#!/usr/bin/env python3
"""Procedurally generate original wallpapers for the app.

Every image is rendered from math (fractals, domain-warped noise, light
fields), so the output is 100% original and safe to sell as premium content.

  premium  -> 4320x7680 (8K portrait) JPEG + 540x960 thumbnail
  free     -> 2160x3840 (4K portrait) JPEG + 540x960 thumbnail

Usage:  python3 tools/generate_wallpapers.py [--only ID] [--workers N]
Writes images to wallpapers/ and the catalog to
wallpaper-app/src/data/generated.json.
"""
import argparse
import json
import math
import os
from multiprocessing import Pool

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("WALLPAPER_OUT", os.path.join(ROOT, "wallpapers"))
CATALOG = os.path.join(ROOT, "wallpaper-app", "src", "data", "generated.json")

SIZES = {"premium": (4320, 7680), "free": (2160, 3840)}
if os.environ.get("WALLPAPER_PREVIEW"):  # fast low-res check of the look
    SIZES = {"premium": (270, 480), "free": (270, 480)}
THUMB = (540, 960)
STRIP = 640  # rows rendered at a time, keeps memory bounded at 8K

# ---------------------------------------------------------------- palettes
# Inigo Quilez cosine palettes: col(t) = a + b * cos(2pi (c t + d))
PALETTES = {
    "sunset": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.0, 0.10, 0.20]),
    "ocean": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.30, 0.20, 0.20]),
    "neon": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 0.5], [0.80, 0.90, 0.30]),
    "aurora": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 0.7, 0.4], [0.0, 0.15, 0.20]),
    "gold": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.0, 0.33, 0.67]),
    "violet": ([0.8, 0.5, 0.4], [0.2, 0.4, 0.2], [2.0, 1.0, 1.0], [0.0, 0.25, 0.25]),
    "ice": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [2.0, 1.0, 0.0], [0.5, 0.2, 0.25]),
    "fire": ([0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [1.0, 1.0, 1.0], [0.0, 0.05, 0.15]),
}


def palette(name, t):
    a, b, c, d = (np.array(v, np.float32) for v in PALETTES[name])
    t = t[..., None]
    return a + b * np.cos(2 * np.pi * (c * t + d))


def grid(W, H, y0, y1):
    """Normalised coords for rows y0..y1: x in [-0.5, 0.5], y scaled equally."""
    s = 1.0 / W
    xs = (np.arange(W, dtype=np.float32) - W / 2) * s
    ys = (np.arange(y0, y1, dtype=np.float32) - H / 2) * s
    return np.meshgrid(xs, ys)


class SineField:
    """Cheap smooth noise: sum of random plane waves (resolution independent)."""

    def __init__(self, rng, octaves=6, base=3.0):
        self.waves = []
        amp, freq = 1.0, base
        for _ in range(octaves):
            for _ in range(3):
                ang = rng.uniform(0, 2 * np.pi)
                self.waves.append((amp, freq * math.cos(ang), freq * math.sin(ang), rng.uniform(0, 2 * np.pi)))
            amp *= 0.5
            freq *= 2.03
        self.norm = sum(w[0] for w in self.waves)

    def __call__(self, x, y):
        out = np.zeros_like(x)
        for a, kx, ky, ph in self.waves:
            out += a * np.sin(kx * x + ky * y + ph)
        return out / self.norm  # roughly [-1, 1]


def stars(rng, x, y, density=0.0016, seed_offset=0):
    """Hash based star field evaluated per pixel, identical at any strip split."""
    W = x.shape[1]
    cell = 1.0 / W * 3
    gx = np.floor(x / cell).astype(np.int64)
    gy = np.floor(y / cell).astype(np.int64)
    h = (gx * 73856093) ^ (gy * 19349663) ^ (seed_offset * 83492791)
    h = (h & 0xFFFFFFF).astype(np.float32) / 0xFFFFFFF
    bright = np.where(h < density, (h / density) ** 0.5, 0.0).astype(np.float32)
    return bright


def vignette(x, y, strength=0.55):
    r = np.sqrt(x * x + (y * 0.5625) ** 2)
    return np.clip(1.0 - strength * r * r * 3.0, 0, 1)


# ---------------------------------------------------------------- styles
def style_fluid(p, x, y, rng_state):
    f1, f2, f3 = rng_state
    sc = p.get("scale", 1.1)
    px, py = x * sc, y * sc
    qx = f1(px, py)
    qy = f2(px + 5.2, py + 1.3)
    rx = f2(px + 4 * qx + 1.7, py + 4 * qy + 9.2)
    ry = f3(px + 4 * qx + 8.3, py + 4 * qy + 2.8)
    v = f1(px + 4 * rx, py + 4 * ry)
    t = 0.5 + 0.5 * v
    col = palette(p["palette"], t * p.get("spread", 0.8) + p.get("shift", 0.0))
    shade = (0.7 + 0.5 * np.clip(np.sqrt(qx * qx + qy * qy), 0, 1))[..., None]
    col = col * shade + 0.3 * np.clip(rx, 0, 1)[..., None] * col
    return col * vignette(x, y, 0.35)[..., None]


def style_aurora(p, x, y, rng_state):
    f1, f2, f3 = rng_state
    sky_t = np.clip(0.5 - y * 0.6, 0, 1)
    base = np.stack([0.01 + 0.03 * sky_t, 0.02 + 0.05 * sky_t, 0.06 + 0.12 * sky_t], -1)
    col = base
    for i, (yc, w) in enumerate(p["bands"]):
        curve = yc + 0.08 * f1(x * 1.5 + i * 3.1, np.float32(i)) + 0.03 * f2(x * 5 + i, y * 0.5)
        d = (y - curve)
        # sharp bottom edge, long soft curtain above it
        inten = np.where(d > 0, np.exp(-(d / (w * 0.25)) ** 2), np.exp(-(d / w) ** 2 * 0.6))
        streak = 0.7 + 0.18 * f3(x * 18 + i * 7, y * 0.7) + 0.12 * f2(x * 47 + i, y * 0.3)
        c = palette(p["palette"], np.clip(0.5 + 0.8 * d / w, 0, 1) * 0.5 + i * 0.12 + p.get("shift", 0))
        col = col + (inten * streak * p.get("gain", 1.9))[..., None] * c
    s = stars(None, x, y, 0.0012, p["seed"]) * np.clip(-y * 1.5, 0, 1)
    col = col + s[..., None] * 0.9
    # mountain silhouette at the bottom
    ridge = 0.62 + 0.05 * f1(x * 4, np.float32(0)) + 0.015 * f2(x * 20, np.float32(1))
    land = y > ridge
    col = np.where(land[..., None], col * 0.04, col)
    return col


def style_julia(p, x, y, rng_state):
    zoom = p.get("zoom", 1.6)
    cx, cy = p.get("center", (0.0, 0.0))
    z = (x * 2 * zoom + cx) + 1j * (y * 2 * zoom + cy)
    z = z.astype(np.complex64)
    c = np.complex64(complex(*p["c"]))
    it = p.get("iter", 300)
    n = np.zeros(z.shape, np.float32)
    alive = np.ones(z.shape, bool)
    for _ in range(it):
        z = np.where(alive, z * z + c, z)
        a = np.abs(z)
        esc = alive & (a > 16)
        # smooth iteration count
        n[esc] += 1 - np.log2(np.log2(a[esc]))
        alive &= ~esc
        n[alive] += 1
        if not alive.any():
            break
    t = np.sqrt(n / it)
    col = palette(p["palette"], t * p.get("spread", 2.2) + p.get("shift", 0.0))
    glow = np.clip(t * 1.6, 0, 1)[..., None]
    col = col * glow
    col[alive] = np.array(p.get("inside", (0.0, 0.0, 0.0)), np.float32)
    return col


def style_nebula(p, x, y, rng_state):
    f1, f2, f3 = rng_state
    sc = p.get("scale", 1.6)
    px, py = x * sc, y * sc
    wx = f2(px, py) * 1.2
    wy = f3(px + 3.3, py - 1.1) * 1.2
    d = f1(px + wx, py + wy)
    dens = np.clip(0.55 + 0.8 * d, 0, 1) ** 1.5
    hue = 0.5 + 0.5 * f3(px * 0.6 + 2, py * 0.6)
    col = palette(p["palette"], hue * 0.7 + p.get("shift", 0)) ** 1.6 * dens[..., None] * 1.8
    dust = np.clip(f2(px * 3 + 1, py * 3) * 1.4, 0, 1) ** 3
    col = col * (1 - 0.6 * dust[..., None])
    s = stars(None, x, y, 0.002, p["seed"]) + 0.5 * stars(None, x * 1.7, y * 1.7, 0.001, p["seed"] + 9)
    col = col + s[..., None] * (0.6 + 0.4 * dens[..., None])
    return col * vignette(x, y, 0.5)[..., None]


def style_waves(p, x, y, rng_state):
    f1, _, _ = rng_state
    layers = p.get("layers", 7)
    top = np.array(p["top"], np.float32)
    bottom = np.array(p["bottom"], np.float32)
    g = np.clip((y + 0.9) / 1.8, 0, 1)[..., None]
    col = top * (1 - g) + bottom * g
    for i in range(layers):
        k = i / (layers - 1)
        yc = -0.35 + k * 1.1
        curve = yc + 0.09 * np.sin(x * (5 + i) + i * 1.7) + 0.04 * f1(x * 2 + i, np.float32(i))
        mask = np.clip((y - curve) * x.shape[1] * 0.5, 0, 1)[..., None]
        lc = palette(p["palette"], np.full(x.shape, k * 0.6 + p.get("shift", 0), np.float32))
        lc = lc * (0.95 - 0.55 * k)
        # soft shadow above each layer
        shadow = np.exp(-np.clip(curve - y, 0, None) * 40)[..., None] * 0.25
        col = col * (1 - shadow * (1 - mask))
        col = col * (1 - mask) + lc * mask
    return col


def style_synthwave(p, x, y, rng_state):
    f1, f2, _ = rng_state
    horizon = 0.18
    sky_t = np.clip((y + 0.9) / (0.9 + horizon), 0, 1)[..., None]
    top = np.array(p["sky_top"], np.float32)
    bot = np.array(p["sky_bottom"], np.float32)
    col = top * (1 - sky_t) + bot * sky_t
    col = col + stars(None, x, y, 0.0015, p["seed"])[..., None] * np.clip(0.5 - sky_t, 0, 1) * 1.4
    # sun with stripes
    sx, sy, sr = 0.0, horizon - 0.2, 0.3
    r = np.sqrt((x - sx) ** 2 + (y - sy) ** 2)
    sun_t = np.clip((y - (sy - sr)) / (2 * sr), 0, 1)[..., None]
    sun_col = np.array(p["sun_top"], np.float32) * (1 - sun_t) + np.array(p["sun_bottom"], np.float32) * sun_t
    stripes = (np.sin((y - sy) * 120) > np.clip((sy - y) * 9 + 0.6, -1, 1)) | (y < sy)
    sun = (r < sr) & stripes & (y < horizon)
    col = col + np.exp(-np.clip(r - sr, 0, None) * 12)[..., None] * sun_col * 0.35
    col = np.where(sun[..., None], sun_col, col)
    # mountains
    ridge = horizon - 0.08 - 0.07 * np.abs(f1(x * 3, np.float32(0))) - 0.02 * f2(x * 14, np.float32(0))
    mount = (y > ridge) & (y < horizon)
    mcol = np.array(p["mountain"], np.float32) * (0.6 + 0.6 * np.clip((y - ridge) * 8, 0, 1))[..., None]
    col = np.where(mount[..., None], mcol, col)
    # perspective grid floor
    floor = y >= horizon
    depth = np.maximum(y - horizon, 1e-4)
    W = x.shape[1]
    kx, kz = 2.2, 0.35
    fx = x / depth * kx
    fz = 1.0 / depth * kz
    dx_px = (0.5 - np.abs((fx % 1) - 0.5)) / (kx / depth / W)
    dz_px = (0.5 - np.abs((fz % 1) - 0.5)) / (kz / depth ** 2 / W)
    lw = W / 1080 * 1.6
    lines = np.maximum(np.exp(-(dx_px / lw) ** 2), np.exp(-(dz_px / lw) ** 2))
    lines = lines + 0.35 * np.maximum(np.exp(-dx_px / (lw * 6)), np.exp(-dz_px / (lw * 6)))
    fade = np.clip(depth * 5, 0, 1) ** 1.5
    gcol = np.array(p["grid"], np.float32)
    floor_col = np.array(p["floor"], np.float32) + gcol * (lines * fade)[..., None]
    floor_col = floor_col + gcol * np.exp(-depth * 30)[..., None] * 0.6
    col = np.where(floor[..., None], floor_col, col)
    return col


def style_rings(p, x, y, rng_state):
    f1, _, _ = rng_state
    col = np.zeros(x.shape + (3,), np.float32)
    r = np.sqrt(x * x + (y + p.get("offset", 0.0)) ** 2)
    ang = np.arctan2(y, x)
    for i in range(p.get("count", 5)):
        rad = p.get("radius", 0.16) + i * p.get("gap", 0.045)
        wob = 0.006 * np.sin(ang * (3 + i) + i) + 0.004 * f1(np.cos(ang) * 3, np.sin(ang) * 3 + i)
        d = np.abs(r - rad - wob)
        w = 1.0 / x.shape[1] * (2 + i * 0.4)
        glow = np.exp(-d / (w * 6)) * 0.55 + np.exp(-(d / w) ** 2)
        c = palette(p["palette"], (0.5 + 0.5 * np.sin(ang + i)) * 0.45 + i * 0.09 + p.get("shift", 0))
        col = col + glow[..., None] * c * (1.0 - i * 0.12)
    return col


def style_crystal(p, x, y, rng_state):
    """Faceted low-poly look: Voronoi cells shaded by a light direction."""
    rng = np.random.default_rng(p["seed"])
    n = p.get("cells", 70)
    pts = np.stack([rng.uniform(-0.6, 0.6, n), rng.uniform(-1.0, 1.0, n)], 1).astype(np.float32)
    best = np.full(x.shape, 1e9, np.float32)
    second = np.full(x.shape, 1e9, np.float32)
    idx = np.zeros(x.shape, np.int32)
    for i, (ax, ay) in enumerate(pts):
        d = (x - ax) ** 2 + (y - ay) ** 2
        upd = d < best
        second = np.where(upd, best, np.minimum(second, d))
        idx = np.where(upd, i, idx)
        best = np.minimum(best, d)
    edge = np.sqrt(second) - np.sqrt(best)
    shade = rng.uniform(0.55, 1.0, n).astype(np.float32)[idx]
    t = (pts[idx, 1] + 1) / 2 * 0.6 + pts[idx, 0] * 0.3
    col = palette(p["palette"], t + p.get("shift", 0)) * shade[..., None]
    rim = np.exp(-edge * x.shape[1] / 3)[..., None]
    col = col * (1 - 0.5 * rim) + rim * 0.15
    return col * vignette(x, y, 0.4)[..., None]


STYLES = {
    "fluid": style_fluid,
    "aurora": style_aurora,
    "julia": style_julia,
    "nebula": style_nebula,
    "waves": style_waves,
    "synthwave": style_synthwave,
    "rings": style_rings,
    "crystal": style_crystal,
}

# ---------------------------------------------------------------- catalog
# (id, tier, style, title, category, params)
SPECS = [
    # ---- premium (8K) ----
    ("p-liquid-gold", "premium", "fluid", "Liquid Gold", "abstract", dict(palette="fire", spread=0.6, shift=0.02)),
    ("p-silk-ocean", "premium", "fluid", "Silk Ocean", "abstract", dict(palette="ocean", spread=0.7, shift=0.1, scale=0.9)),
    ("p-violet-dream", "premium", "fluid", "Violet Dream", "abstract", dict(palette="violet", spread=0.9, scale=1.3)),
    ("p-candy-flow", "premium", "fluid", "Candy Flow", "abstract", dict(palette="sunset", spread=0.5, shift=0.55)),
    ("p-golden-lights", "premium", "aurora", "Golden Lights", "nature", dict(palette="aurora", bands=[(-0.25, 0.25), (-0.05, 0.18)], shift=0.75)),
    ("p-solar-storm", "premium", "aurora", "Solar Storm", "nature", dict(palette="neon", bands=[(-0.3, 0.3), (0.0, 0.2), (0.2, 0.12)], shift=0.1)),
    ("p-arctic-night", "premium", "aurora", "Arctic Night", "nature", dict(palette="ice", bands=[(-0.15, 0.28)], gain=2.4, shift=0.05)),
    ("p-dragon-fractal", "premium", "julia", "Dragon Fractal", "fractal", dict(c=(-0.8, 0.156), palette="fire", zoom=0.9, spread=1.4)),
    ("p-electric-coral", "premium", "julia", "Electric Coral", "fractal", dict(c=(0.285, 0.01), palette="neon", zoom=0.75, spread=2.0)),
    ("p-galaxy-spiral", "premium", "julia", "Galaxy Spiral", "fractal", dict(c=(-0.7269, 0.1889), palette="ocean", zoom=0.85, spread=1.8)),
    ("p-golden-lace", "premium", "julia", "Golden Lace", "fractal", dict(c=(-0.4, 0.6), palette="gold", zoom=0.8, spread=1.5)),
    ("p-orion-nebula", "premium", "nebula", "Orion Nebula", "space", dict(palette="sunset", shift=0.6)),
    ("p-emerald-nebula", "premium", "nebula", "Emerald Nebula", "space", dict(palette="ice", shift=0.3, scale=1.3)),
    ("p-crimson-void", "premium", "nebula", "Crimson Void", "space", dict(palette="sunset", shift=0.95, scale=1.9)),
    ("p-retro-drive", "premium", "synthwave", "Retro Drive", "cyberpunk", dict(sky_top=(0.03, 0.0, 0.10), sky_bottom=(0.55, 0.05, 0.45), sun_top=(1.0, 0.85, 0.2), sun_bottom=(1.0, 0.1, 0.55), mountain=(0.12, 0.02, 0.25), grid=(1.0, 0.2, 0.9), floor=(0.03, 0.0, 0.07))),
    ("p-cyan-horizon", "premium", "synthwave", "Cyan Horizon", "cyberpunk", dict(sky_top=(0.0, 0.01, 0.06), sky_bottom=(0.0, 0.3, 0.5), sun_top=(1.0, 0.95, 0.6), sun_bottom=(1.0, 0.3, 0.2), mountain=(0.0, 0.05, 0.12), grid=(0.0, 0.95, 1.0), floor=(0.0, 0.02, 0.05))),
    ("p-dune-layers", "premium", "waves", "Dune Layers", "minimal", dict(palette="fire", top=(0.98, 0.85, 0.6), bottom=(0.3, 0.05, 0.05), shift=0.05)),
    ("p-deep-sea", "premium", "waves", "Deep Sea", "minimal", dict(palette="ocean", top=(0.7, 0.9, 1.0), bottom=(0.0, 0.02, 0.1), shift=0.45)),
    ("p-halo-amoled", "premium", "rings", "Halo", "amoled", dict(palette="neon", count=4)),
    ("p-portal-amoled", "premium", "rings", "Portal", "amoled", dict(palette="fire", count=6, radius=0.12, gap=0.035, shift=0.3)),
    ("p-amethyst-crystal", "premium", "crystal", "Amethyst Crystal", "geometric", dict(palette="violet", cells=90)),
    ("p-glacier-crystal", "premium", "crystal", "Glacier Crystal", "geometric", dict(palette="ice", cells=60, shift=0.3)),
    # ---- free (4K) ----
    ("f-sunset-flow", "free", "fluid", "Sunset Flow", "abstract", dict(palette="sunset", spread=0.6, shift=0.0)),
    ("f-mint-flow", "free", "fluid", "Mint Flow", "abstract", dict(palette="aurora", spread=0.6, shift=0.3, scale=0.8)),
    ("f-green-aurora", "free", "aurora", "Green Aurora", "nature", dict(palette="ice", bands=[(-0.1, 0.22)], gain=2.4, shift=0.85)),
    ("f-blue-fractal", "free", "julia", "Blue Fractal", "fractal", dict(c=(0.355, 0.355), palette="ice", zoom=0.85, spread=1.6, iter=200)),
    ("f-cosmic-dust", "free", "nebula", "Cosmic Dust", "space", dict(palette="ocean", shift=0.4)),
    ("f-neon-sunset", "free", "synthwave", "Neon Sunset", "cyberpunk", dict(sky_top=(0.05, 0.0, 0.12), sky_bottom=(0.9, 0.3, 0.3), sun_top=(1.0, 0.9, 0.3), sun_bottom=(1.0, 0.2, 0.4), mountain=(0.15, 0.03, 0.2), grid=(1.0, 0.4, 0.7), floor=(0.04, 0.0, 0.06))),
    ("f-pastel-waves", "free", "waves", "Pastel Waves", "minimal", dict(palette="violet", top=(1.0, 0.95, 0.95), bottom=(0.25, 0.1, 0.35), shift=0.2)),
    ("f-blue-halo", "free", "rings", "Blue Halo", "amoled", dict(palette="ocean", count=3, shift=0.5)),
    ("f-rose-crystal", "free", "crystal", "Rose Crystal", "geometric", dict(palette="sunset", cells=50, shift=0.6)),
]


def render(spec):
    wid, tier, style, title, category, params = spec
    W, H = SIZES[tier]
    seed = sum(ord(c) * (i + 1) for i, c in enumerate(wid))
    params = dict(params, seed=seed)
    rng = np.random.default_rng(seed)
    octaves = 4 if style == "fluid" else 6
    fields = tuple(SineField(rng, octaves=octaves, base=2.0 if style == "fluid" else 3.0) for _ in range(3))
    img = np.empty((H, W, 3), np.uint8)
    grain_rng = np.random.default_rng(seed + 1)
    for y0 in range(0, H, STRIP):
        y1 = min(H, y0 + STRIP)
        x, y = grid(W, H, y0, y1)
        col = STYLES[style](params, x, y, fields).astype(np.float32)
        col = np.clip(col, 0, None)
        col = col / (1 + col * 0.15)  # gentle highlight roll-off
        col = np.clip(col, 0, 1) ** (1 / 1.1)
        col += grain_rng.normal(0, 1.2 / 255, col.shape).astype(np.float32)  # dither, kills banding
        img[y0:y1] = np.clip(col * 255 + 0.5, 0, 255).astype(np.uint8)
    os.makedirs(os.path.join(OUT, tier), exist_ok=True)
    os.makedirs(os.path.join(OUT, "thumbs"), exist_ok=True)
    im = Image.fromarray(img)
    full = os.path.join(OUT, tier, f"{wid}.jpg")
    im.save(full, quality=90, optimize=True, progressive=True)
    im.resize(THUMB, Image.LANCZOS).save(os.path.join(OUT, "thumbs", f"{wid}.jpg"), quality=82, optimize=True)
    size = os.path.getsize(full)
    print(f"{wid}: {W}x{H} {size/1e6:.1f} MB", flush=True)
    return dict(id=wid, tier=tier, title=title, category=category, style=style, width=W, height=H, bytes=size)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only")
    ap.add_argument("--workers", type=int, default=3)
    args = ap.parse_args()
    specs = [s for s in SPECS if not args.only or s[0] == args.only]
    with Pool(args.workers) as pool:
        results = pool.map(render, specs, chunksize=1)
    if args.only or os.environ.get("WALLPAPER_PREVIEW"):
        return
    os.makedirs(os.path.dirname(CATALOG), exist_ok=True)
    with open(CATALOG, "w") as f:
        json.dump(results, f, indent=2)
    print(f"wrote {len(results)} entries to {CATALOG}")


if __name__ == "__main__":
    main()
