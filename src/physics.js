// Lightweight collision helpers: circle-vs-AABB for movement and ray casts for shooting.

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// Push a vertical cylinder (pos, radius) out of all boxes it overlaps vertically.
export function resolveCircle(pos, r, height, colliders) {
  const feet = pos.y;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (feet >= c.max.y - 0.05 || feet + height <= c.min.y) continue;
    const cx = clamp(pos.x, c.min.x, c.max.x);
    const cz = clamp(pos.z, c.min.z, c.max.z);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      const push = (r - d) / d;
      pos.x += dx * push;
      pos.z += dz * push;
    } else {
      const l = pos.x - c.min.x, ri = c.max.x - pos.x, b = pos.z - c.min.z, f = c.max.z - pos.z;
      const m = Math.min(l, ri, b, f);
      if (m === l) pos.x = c.min.x - r;
      else if (m === ri) pos.x = c.max.x + r;
      else if (m === b) pos.z = c.min.z - r;
      else pos.z = c.max.z + r;
    }
  }
}

// Highest box top under (x, z) that the feet can stand on (step-up of 0.35m).
export function supportHeight(x, z, r, feetY, colliders) {
  let h = -Infinity;
  const rr = r * 0.6;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (c.max.y > feetY + 0.35) continue;
    if (x < c.min.x - rr || x > c.max.x + rr || z < c.min.z - rr || z > c.max.z + rr) continue;
    if (c.max.y > h) h = c.max.y;
  }
  return h;
}

// Slab test. Returns distance along the (normalized) ray or Infinity.
export function rayAABB(o, d, c, tmax) {
  let tmin = 0;
  let tm = tmax;
  for (const a of ['x', 'y', 'z']) {
    const inv = 1 / (d[a] || 1e-12);
    let t1 = (c.min[a] - o[a]) * inv;
    let t2 = (c.max[a] - o[a]) * inv;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tm) tm = t2;
    if (tmin > tm) return Infinity;
  }
  return tmin;
}

export function rayBoxes(o, d, tmax, colliders) {
  let best = tmax;
  for (let i = 0; i < colliders.length; i++) {
    const t = rayAABB(o, d, colliders[i], best);
    if (t < best) best = t;
  }
  return best;
}

export function raySphere(o, d, center, radius) {
  const ox = o.x - center.x, oy = o.y - center.y, oz = o.z - center.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const h = b * b - c;
  if (h < 0) return Infinity;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : Infinity;
}

// Distance from point to segment in XZ, plus the projection parameter.
export function segDist2D(px, pz, ax, az, bx, bz) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz || 1e-9;
  const t = clamp(((px - ax) * abx + (pz - az) * abz) / len2, 0, 1);
  const qx = ax + abx * t, qz = az + abz * t;
  const dx = px - qx, dz = pz - qz;
  return { d: Math.sqrt(dx * dx + dz * dz), t, qx, qz };
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
