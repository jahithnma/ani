import * as THREE from 'three';

let glowTex = null;
export function getGlowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

// Particles, tracers and flashes, all pooled so nothing is allocated mid-fight.
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.max = 500;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.inst = new THREE.InstancedMesh(geo, mat, this.max);
    this.inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.inst.frustumCulled = false;
    const white = new THREE.Color(1, 1, 1);
    for (let i = 0; i < this.max; i++) this.inst.setColorAt(i, white);
    this.inst.count = 0;
    scene.add(this.inst);
    this.parts = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();

    const tgeo = new THREE.BoxGeometry(0.035, 0.035, 1);
    tgeo.translate(0, 0, 0.5);
    this.tracers = [];
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(tgeo, new THREE.MeshBasicMaterial({
        color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      m.visible = false;
      m.frustumCulled = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0 });
    }

    this.flashes = [];
    for (let i = 0; i < 24; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: getGlowTexture(), color: 0xffcc66, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      s.visible = false;
      scene.add(s);
      this.flashes.push({ sprite: s, life: 0, max: 0.1, size: 1 });
    }
    this.shake = 0;
  }

  burst(pos, color, count = 12, speed = 4, size = 0.08, grav = 9, life = 0.6) {
    const col = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.parts.length >= this.max) this.parts.shift();
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.parts.push({ p: pos.clone(), v, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color: col, grav });
    }
  }

  trail(pos, color, size = 0.15, life = 0.5) {
    if (this.parts.length >= this.max) this.parts.shift();
    const v = new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.6, (Math.random() - 0.5) * 0.6);
    this.parts.push({ p: pos.clone(), v, life, max: life, size, color: new THREE.Color(color), grav: -0.5 });
  }

  tracer(from, to, color = 0xffd27a) {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    const len = from.distanceTo(to);
    if (len < 0.01) return;
    t.mesh.position.copy(from);
    t.mesh.lookAt(to);
    t.mesh.scale.set(1, 1, len);
    t.mesh.material.color.set(color);
    t.mesh.material.opacity = 1;
    t.mesh.visible = true;
    t.life = 0.07;
  }

  flash(pos, size = 1, color = 0xffcc66, life = 0.06) {
    const f = this.flashes.find((x) => x.life <= 0) || this.flashes[0];
    f.sprite.position.copy(pos);
    f.sprite.material.color.set(color);
    f.sprite.scale.setScalar(size);
    f.sprite.visible = true;
    f.life = life;
    f.max = life;
    f.size = size;
  }

  update(dt) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.v.y -= p.grav * dt;
      p.p.addScaledVector(p.v, dt);
      if (p.p.y < 0.02 && p.grav > 0) { p.p.y = 0.02; p.v.multiplyScalar(0.5); p.v.y = Math.abs(p.v.y) * 0.3; }
    }
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      this._s.setScalar(p.size * (0.3 + 0.7 * k));
      this._m.compose(p.p, this._q, this._s);
      this.inst.setMatrixAt(n, this._m);
      this._c.copy(p.color).multiplyScalar(0.6 + 1.6 * k);
      this.inst.setColorAt(n, this._c);
      n++;
    }
    this.inst.count = n;
    this.inst.instanceMatrix.needsUpdate = true;
    if (this.inst.instanceColor) this.inst.instanceColor.needsUpdate = true;

    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (const f of this.flashes) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const k = Math.max(0, f.life / f.max);
      f.sprite.material.opacity = k;
      f.sprite.scale.setScalar(f.size * (0.6 + 0.4 * k));
      if (f.life <= 0) f.sprite.visible = false;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}

// Rain streaks, snow, sand or embers that follow the camera.
export class Weather {
  constructor(scene, type) {
    this.type = type;
    this.box = { x: 50, y: 28, z: 50 };
    const count = { rain: 2600, snow: 1600, sand: 2200, ash: 900, fireflies: 220 }[type] || 1000;
    this.count = count;
    this.vel = new Float32Array(count * 3);
    if (type === 'rain') {
      const pos = new Float32Array(count * 6);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * this.box.x, y = Math.random() * this.box.y, z = (Math.random() - 0.5) * this.box.z;
        pos.set([x, y, z, x + 0.05, y + 0.7, z], i * 6);
        this.vel.set([1.5, -26 - Math.random() * 8, 0], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      this.obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x9fb8d8, transparent: true, opacity: 0.45, depthWrite: false }));
    } else {
      const pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        pos.set([(Math.random() - 0.5) * this.box.x, Math.random() * this.box.y, (Math.random() - 0.5) * this.box.z], i * 3);
        if (type === 'snow') this.vel.set([Math.random() - 0.5, -1.5 - Math.random(), Math.random() - 0.5], i * 3);
        else if (type === 'sand') this.vel.set([14 + Math.random() * 8, -0.5 + Math.random(), 4 + Math.random() * 3], i * 3);
        else if (type === 'ash') this.vel.set([Math.random() - 0.5, 0.6 + Math.random() * 1.2, Math.random() - 0.5], i * 3);
        else this.vel.set([(Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.6], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const conf = {
        snow: { color: 0xffffff, size: 0.18, opacity: 0.9, add: false },
        sand: { color: 0xd8b07a, size: 0.14, opacity: 0.55, add: false },
        ash: { color: 0xff7a2a, size: 0.16, opacity: 0.9, add: true },
        fireflies: { color: 0xc8ff6a, size: 0.25, opacity: 0.9, add: true },
      }[type];
      this.obj = new THREE.Points(geo, new THREE.PointsMaterial({
        color: conf.color, size: conf.size, map: getGlowTexture(), transparent: true, opacity: conf.opacity,
        depthWrite: false, blending: conf.add ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !conf.add,
      }));
    }
    this.obj.frustumCulled = false;
    scene.add(this.obj);
    this.center = new THREE.Vector3();
  }

  update(dt, camPos, t) {
    const p = this.obj.geometry.attributes.position.array;
    const bx = this.box.x / 2, bz = this.box.z / 2, by = this.box.y;
    const stride = this.type === 'rain' ? 6 : 3;
    for (let i = 0; i < this.count; i++) {
      const o = i * stride;
      const vx = this.vel[i * 3], vy = this.vel[i * 3 + 1], vz = this.vel[i * 3 + 2];
      let x = p[o] + vx * dt, y = p[o + 1] + vy * dt, z = p[o + 2] + vz * dt;
      if (this.type === 'fireflies') { x += Math.sin(t * 2 + i) * 0.01; y = 0.5 + Math.abs(Math.sin(t * 0.5 + i)) * 2.5; }
      let rx = x - camPos.x, rz = z - camPos.z;
      if (rx > bx) x -= this.box.x; else if (rx < -bx) x += this.box.x;
      if (rz > bz) z -= this.box.z; else if (rz < -bz) z += this.box.z;
      if (y < 0) y += by; else if (y > by) y -= by;
      p[o] = x; p[o + 1] = y; p[o + 2] = z;
      if (stride === 6) { p[o + 3] = x + 0.05; p[o + 4] = y + 0.7; p[o + 5] = z; }
    }
    this.obj.geometry.attributes.position.needsUpdate = true;
  }
}
