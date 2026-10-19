#!/usr/bin/env python3
"""Render the app icon, adaptive icon layers and splash into wallpaper-app/assets."""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import generate_wallpapers as gw  # noqa: E402

ASSETS = os.path.join(gw.ROOT, "wallpaper-app", "assets")
FONT = "/usr/share/fonts/opentype/inter/InterDisplay-Black.otf"


def background(size):
    params = dict(c=(-0.7269, 0.1889), palette="neon", zoom=0.55, spread=1.6, seed=7, iter=250)
    x, y = gw.grid(size, size, 0, size)
    col = gw.style_julia(params, x, y, None)
    col = np.clip(col / (1 + col * 0.15), 0, 1) * 0.45 + np.array([0.12, 0.02, 0.22], np.float32) * (0.5 - y[..., None])
    return Image.fromarray((col * 255).astype(np.uint8))


def label(size, color=(255, 255, 255, 255), shadow=True):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    font = ImageFont.truetype(FONT, int(size * 0.42))
    d = ImageDraw.Draw(layer)
    box = d.textbbox((0, 0), "8K", font=font)
    pos = ((size - (box[2] - box[0])) / 2 - box[0], (size - (box[3] - box[1])) / 2 - box[1])
    if shadow:
        glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(glow).text(pos, "8K", font=font, fill=(34, 211, 238, 200))
        layer = Image.alpha_composite(layer, glow.filter(ImageFilter.GaussianBlur(size * 0.03)))
        d = ImageDraw.Draw(layer)
    d.text(pos, "8K", font=font, fill=color)
    return layer


def main():
    bg = background(1024).convert("RGBA")
    Image.alpha_composite(bg, label(1024)).convert("RGB").save(os.path.join(ASSETS, "icon.png"))
    # Android adaptive icon: content must sit in the inner 66% safe zone.
    bg.convert("RGB").save(os.path.join(ASSETS, "android-icon-background.png"))
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    small = label(680)
    fg.paste(small, (172, 172), small)
    fg.save(os.path.join(ASSETS, "android-icon-foreground.png"))
    mono = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    m = label(680, shadow=False)
    mono.paste(m, (172, 172), m)
    mono.save(os.path.join(ASSETS, "android-icon-monochrome.png"))
    Image.alpha_composite(bg, label(1024)).convert("RGB").resize((48, 48), Image.LANCZOS).save(os.path.join(ASSETS, "favicon.png"))
    # Splash: logo on transparent background, colour comes from app.json.
    splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    logo = Image.alpha_composite(bg, label(1024)).resize((512, 512), Image.LANCZOS)
    mask = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, 511, 511), radius=110, fill=255)
    splash.paste(logo, (256, 256), mask)
    splash.save(os.path.join(ASSETS, "splash-icon.png"))
    print("icons written to", ASSETS)


if __name__ == "__main__":
    main()
