import * as THREE from 'three';
import { mulberry32, segDist2D } from './physics.js';
import { getGlowTexture } from './fx.js';

const V3 = THREE.Vector3;
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);

// ---------- procedural textures ----------
function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function hex(c) { return '#' + new THREE.Color(c).getHexString(); }

function speckleTex(base, cols, { size = 512, blots = 260, specks = 5000, repeat = 1, blotAlpha = 0.22 } = {}) {
  return canvasTex(size, (g, s) => {
    g.fillStyle = hex(base);
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < blots; i++) {
      const x = Math.random() * s, y = Math.random() * s, r = 10 + Math.random() * 50;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      const col = new THREE.Color(cols[i % cols.length]);
      grad.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${blotAlpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      // draw wrapped so the texture tiles seamlessly
      for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) g.fillRect(x - r + ox, y - r + oy, r * 2, r * 2);
    }
    for (let i = 0; i < specks; i++) {
      g.fillStyle = hex(cols[(Math.random() * cols.length) | 0]);
      g.globalAlpha = 0.25 + Math.random() * 0.4;
      g.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    g.globalAlpha = 1;
  }, repeat);
}

function planksTex() {
  return canvasTex(256, (g, s) => {
    g.fillStyle = '#8a5a2e';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#7a4e27' : '#94643a';
      g.fillRect(0, i * (s / 6), s, s / 6 - 3);
      for (let k = 0; k < 40; k++) {
        g.fillStyle = 'rgba(60,35,15,0.25)';
        g.fillRect(Math.random() * s, i * (s / 6) + Math.random() * (s / 6), 20 + Math.random() * 60, 1);
      }
    }
    g.strokeStyle = '#4a2c12';
    g.lineWidth = 18;
    g.strokeRect(9, 9, s - 18, s - 18);
    g.beginPath(); g.moveTo(18, 18); g.lineTo(s - 18, s - 18); g.stroke();
  });
}

function bricksTex(color = '#a5583a', mortar = '#d8c8b0') {
  return canvasTex(256, (g, s) => {
    g.fillStyle = mortar;
    g.fillRect(0, 0, s, s);
    const rows = 8, h = s / rows, w = s / 4;
    for (let r = 0; r < rows; r++) {
      for (let c = -1; c < 5; c++) {
        const x = c * w + (r % 2) * (w / 2);
        const shade = 0.85 + Math.random() * 0.3;
        const col = new THREE.Color(color).multiplyScalar(shade);
        g.fillStyle = hex(col);
        g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      }
    }
  });
}

function tilesTex(base = '#8a8578', line = '#5a564c', n = 4) {
  return canvasTex(256, (g, s) => {
    const t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const c = new THREE.Color(base).multiplyScalar(0.85 + Math.random() * 0.3);
      g.fillStyle = hex(c);
      g.fillRect(i * t, j * t, t, t);
      for (let k = 0; k < 60; k++) {
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(i * t + Math.random() * t, j * t + Math.random() * t, 2, 2);
      }
    }
    g.strokeStyle = line;
    g.lineWidth = 3;
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, s); g.stroke();
      g.beginPath(); g.moveTo(0, i * t); g.lineTo(s, i * t); g.stroke();
    }
  });
}

const winCache = {};
function windowsTex(lit = 0.4) {
  // one canvas pair per lit ratio; callers clone (shares the GPU upload) to set their own repeat
  if (!winCache[lit]) winCache[lit] = makeWindowsTex(lit);
  return { map: winCache[lit].map.clone(), emissiveMap: winCache[lit].emissiveMap.clone() };
}

function makeWindowsTex(lit, palette = ['#ffd890', '#fff2c8', '#9fd8ff']) {
  const make = (emissive) => canvasTex(256, (g, s) => {
    g.fillStyle = emissive ? '#000' : '#3a3f4a';
    g.fillRect(0, 0, s, s);
    const cols = 6, rows = 10;
    const w = s / cols, h = s / rows;
    const rng = mulberry32(7);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const on = rng() < lit;
      const col = palette[(rng() * palette.length) | 0];
      g.fillStyle = on ? col : emissive ? '#000' : '#141a26';
      g.fillRect(c * w + 6, r * h + 5, w - 12, h - 10);
    }
  });
  const map = make(false), emissiveMap = make(true);
  return { map, emissiveMap };
}

function roadTex() {
  return canvasTex(512, (g, s) => {
    g.fillStyle = '#2b2d31';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 8000; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#3a3c41' : '#222428';
      g.fillRect(Math.random() * s, Math.random() * s, 2, 2);
    }
    g.fillStyle = '#e8e2c8';
    g.fillRect(s * 0.06, 0, 8, s);
    g.fillRect(s * 0.94 - 8, 0, 8, s);
    g.fillStyle = '#f0c030';
    for (let y = 0; y < s; y += 128) g.fillRect(s / 2 - 5, y + 20, 10, 70);
  });
}

function kolamTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,0.95)';
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.lineWidth = 6;
  const n = 5, step = 80, o = 96;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.beginPath(); g.arc(o + i * step, o + j * step, 6, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < n - 1; j++) {
    const x = o + i * step + step / 2, y = o + j * step + step / 2;
    g.beginPath();
    g.ellipse(x, y, step * 0.62, step * 0.28, Math.PI / 4 * ((i + j) % 2 ? 1 : -1), 0, Math.PI * 2);
    g.stroke();
  }
  g.lineWidth = 10;
  g.strokeStyle = 'rgba(230,60,90,0.9)';
  g.beginPath(); g.arc(256, 256, 236, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function neonTex(lines, color = '#ff3ad0') {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = '#05030a';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.fillStyle = '#fff';
  g.font = '900 120px Arial Black, Impact, sans-serif';
  g.fillText(lines[0], 512, 130);
  g.shadowColor = '#36e0ff';
  g.font = '800 84px Arial, sans-serif';
  g.fillStyle = '#bff6ff';
  g.fillText(lines[1], 512, 280);
  g.strokeStyle = color;
  g.lineWidth = 10;
  g.strokeRect(20, 20, c.width - 40, c.height - 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function std(color, rough = 0.8, metal = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
}

// ---------- shaders ----------
const SKY_VS = `varying vec3 vDir;
void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`;
const SKY_FS = `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunColor; uniform float sunSize;
varying vec3 vDir;
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(mid, bottom, pow(clamp(-h,0.0,1.0), 0.35));
  float s = max(dot(d, normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, sunSize) * 4.0 + pow(s, 6.0) * 0.35);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const LAVA_FS = `uniform float time; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vUv * 6.0;
  float n = noise(p + vec2(time*0.3, time*0.2)) * 0.6 + noise(p*2.3 - vec2(time*0.4, 0.0)) * 0.4;
  float cracks = smoothstep(0.45, 0.55, n);
  vec3 col = mix(vec3(0.35,0.02,0.0), vec3(3.0,0.9,0.1), cracks);
  col += vec3(2.2,1.6,0.4) * pow(n, 6.0) * 2.0;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const UV_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const PORTAL_FS = `uniform float time; uniform vec3 color; varying vec2 vUv;
void main(){
  vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
  float swirl = sin(a * 5.0 + r * 14.0 - time * 4.0) * 0.5 + 0.5;
  float edge = smoothstep(1.0, 0.9, r);
  vec3 col = color * ((1.0 - r) * 1.6 + swirl * 0.9 * (1.0 - r * 0.6)) + vec3(1.0) * pow(max(1.0 - r, 0.0), 5.0) * 2.0;
  gl_FragColor = vec4(col, edge * (0.45 + 0.55 * swirl));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const THEMES = {
  courtyard: { sky: [0x2f7fe0, 0xcfe8ff, 0x9fb08a], sun: [0xfff0d0, 3.4], sunDir: [0.45, 0.75, 0.35], sunSize: 900, hemi: [0xcfe6ff, 0x6a5232, 1.1], fog: [0xc6e0f4, 0.0065], exposure: 1.0 },
  forest: { sky: [0x241a4a, 0xf2905c, 0x1e1828], sun: [0xff9a60, 1.8], sunDir: [-0.6, 0.12, -0.6], sunSize: 400, hemi: [0x9a78b8, 0x1e2c16, 0.65], fog: [0x4e3a5c, 0.028], exposure: 1.15 },
  night: { sky: [0x01030a, 0x0a1430, 0x040508], sun: [0x8fb0ff, 0.45], sunDir: [0.3, 0.6, -0.5], sunSize: 2500, hemi: [0x2a3a6a, 0x08080c, 0.28], fog: [0x060a18, 0.032], exposure: 1.2, stars: true, moon: 0xdfe8ff },
  bridge: { sky: [0x14082a, 0x9a2a3a, 0x1a0006], sun: [0xff7050, 1.5], sunDir: [0.2, 0.08, -1], sunSize: 300, hemi: [0xa05a90, 0x3a0010, 0.55], fog: [0x381228, 0.018], exposure: 1.15, stars: true },
  rooftop: { sky: [0x151c28, 0x47536a, 0x10141c], sun: [0xbfd0e8, 1.0], sunDir: [-0.3, 0.7, 0.4], sunSize: 3000, hemi: [0x8090aa, 0x202428, 0.75], fog: [0x37404f, 0.02], exposure: 1.1 },
  graveyard: { sky: [0x0e0208, 0x6a0e14, 0x080104], sun: [0xff5040, 0.7], sunDir: [-0.4, 0.35, -0.8], sunSize: 2500, hemi: [0x6a2a3a, 0x100408, 0.45], fog: [0x2a0810, 0.032], exposure: 1.2, stars: true, moon: 0xff4a3a },
  desert: { sky: [0xc2915a, 0xeacb92, 0xb08a5a], sun: [0xffd8a0, 2.4], sunDir: [0.6, 0.5, 0.2], sunSize: 500, hemi: [0xffe2b4, 0x8a6a40, 0.95], fog: [0xd2ab74, 0.042], exposure: 1.0 },
  ice: { sky: [0x4f86d8, 0xdcf1ff, 0xcfe6f5], sun: [0xffffff, 2.8], sunDir: [-0.5, 0.45, -0.3], sunSize: 900, hemi: [0xe4f2ff, 0x8aa8c8, 1.05], fog: [0xd6ebf8, 0.017], exposure: 1.0 },
  volcano: { sky: [0x080104, 0x5e1c08, 0x180602], sun: [0xff6a2a, 1.6], sunDir: [0.2, 0.4, -0.9], sunSize: 200, hemi: [0x8a3a1a, 0x1a0602, 0.55], fog: [0x2a0a04, 0.02], exposure: 1.15 },
  temple: { sky: [0x080520, 0x3a2068, 0x06030c], sun: [0xae90ff, 0.9], sunDir: [-0.2, 0.6, -0.7], sunSize: 3000, hemi: [0x6a5aa8, 0x14101a, 0.5], fog: [0x1a1030, 0.018], exposure: 1.2, stars: true, moon: 0xe8e0ff },
};

export class World {
  constructor(scene, quality, seed = 1) {
    this.scene = scene;
    this.quality = quality;
    this.colliders = [];
    this.updaters = [];
    this.inst = {};
    this.rng = mulberry32(seed);
    this.layout = {
      spawnA: [], spawnB: [], gate: { x: 0, z: -40, yaw: 0 },
      bounds: { minX: -30, maxX: 30, minZ: -40, maxZ: 40 },
      path: null, pathLimit: 0, walk: null, circleLimit: 0, hazards: [], pickups: [], noGround: false,
    };
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  r(a = 0, b = 1) { return a + this.rng() * (b - a); }

  // ---------- lighting & sky ----------
  setupAtmosphere(name, renderer) {
    const th = THEMES[name];
    this.theme = th;
    const scene = this.scene;
    scene.background = new THREE.Color(th.fog[0]);
    scene.fog = new THREE.FogExp2(th.fog[0], th.fog[1]);
    renderer.toneMappingExposure = th.exposure;

    const sky = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 16), new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: new THREE.Color(th.sky[0]) }, mid: { value: new THREE.Color(th.sky[1]) }, bottom: { value: new THREE.Color(th.sky[2]) },
        sunDir: { value: new V3(...th.sunDir).normalize() }, sunColor: { value: new THREE.Color(th.sun[0]) }, sunSize: { value: th.sunSize },
      },
    }));
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);
    this.sky = sky;

    const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
    scene.add(hemi);
    this.hemi = hemi;

    const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
    const sd = new V3(...th.sunDir).normalize();
    sun.position.copy(sd).multiplyScalar(60);
    sun.castShadow = this.quality !== 'low';
    const ss = this.quality === 'high' ? 2048 : 1024;
    sun.shadow.mapSize.set(ss, ss);
    const sc = sun.shadow.camera;
    sc.left = sc.bottom = -45;
    sc.right = sc.top = 45;
    sc.near = 1;
    sc.far = 160;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;
    this.sunOffset = sd.clone().multiplyScalar(60);

    if (th.stars) {
      const n = 1400, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const v = new V3(Math.random() - 0.5, Math.random() * 0.9 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(420);
        pos.set([v.x, v.y, v.z], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85, toneMapped: false }));
      stars.frustumCulled = false;
      scene.add(stars);
      this.stars = stars;
    }
    if (th.moon) {
      const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), new THREE.MeshBasicMaterial({ color: th.moon, fog: false, toneMapped: false }));
      moon.position.copy(sd).multiplyScalar(400);
      scene.add(moon);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: th.moon, transparent: true, opacity: 0.5, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(110);
      halo.position.copy(moon.position);
      scene.add(halo);
      this.moon = moon;
      this.moonHalo = halo;
      this.moonOffset = sd.clone().multiplyScalar(400);
    }
  }

  followCamera(camPos) {
    this.sky.position.copy(camPos);
    if (this.stars) this.stars.position.copy(camPos);
    if (this.moon) {
      this.moon.position.copy(camPos).add(this.moonOffset);
      this.moonHalo.position.copy(this.moon.position);
    }
    this.sun.position.set(camPos.x, 0, camPos.z).add(this.sunOffset);
    this.sun.target.position.set(camPos.x, 0, camPos.z);
  }

  // ---------- primitives ----------
  ground(size, tex, repeat, mat = {}) {
    tex.repeat.set(repeat, repeat);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), std(0xffffff, 0.95, 0, { map: tex, ...mat }));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  collider(minX, minY, minZ, maxX, maxY, maxZ) {
    this.colliders.push({ min: new V3(minX, minY, minZ), max: new V3(maxX, maxY, maxZ) });
  }

  box(x, y, z, w, h, d, material, { collide = true, cast = true, rotY = 0 } = {}) {
    const m = new THREE.Mesh(UNIT_BOX, material);
    m.scale.set(w, h, d);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = rotY;
    m.castShadow = cast;
    m.receiveShadow = true;
    this.scene.add(m);
    if (collide) {
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const hw = (c * w + s * d) / 2, hd = (s * w + c * d) / 2;
      this.collider(x - hw, y, z - hd, x + hw, y + h, z + hd);
    }
    return m;
  }

  mesh(geometry, material, x, y, z, { cast = true, rx = 0, ry = 0, rz = 0, s = 1 } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
    m.castShadow = cast;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  instance(key, geometry, material, x, y, z, { rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1, cast = true } = {}) {
    if (!this.inst[key]) this.inst[key] = { geometry, material, mats: [], cast };
    this._e.set(rx, ry, rz);
    this._q.setFromEuler(this._e);
    this._m.compose(new V3(x, y, z), this._q, new V3(sx, sy, sz));
    this.inst[key].mats.push(this._m.clone());
  }

  finalize() {
    for (const key of Object.keys(this.inst)) {
      const it = this.inst[key];
      const im = new THREE.InstancedMesh(it.geometry, it.material, it.mats.length);
      it.mats.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = it.cast;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
    this.inst = {};
  }

  // ---------- props ----------
  get mats() {
    if (this._mats) return this._mats;
    const flat = { flatShading: true };
    this._mats = {
      bark: std(0x5a3a22, 0.95),
      palmBark: std(0x8a6a48, 0.95),
      leaf: std(0x2f7a2a, 0.8, 0, flat),
      palmLeaf: std(0x3a8a2a, 0.75, 0, { side: THREE.DoubleSide }),
      pine: std(0x1f4a2c, 0.85, 0, flat),
      snow: std(0xf4f8ff, 0.6),
      rock: std(0x7a7670, 0.95, 0, flat),
      darkRock: std(0x2a2422, 0.9, 0, flat),
      sandstone: std(0xc89a62, 0.95, 0, flat),
      stone: std(0x8d8a82, 0.9),
      crate: std(0xffffff, 0.85, 0, { map: planksTex() }),
      metal: std(0x8a9098, 0.4, 0.7),
      darkMetal: std(0x2c3036, 0.5, 0.6),
      hay: std(0xd8b04a, 1),
      grave: std(0x6c6a66, 0.9),
      cactus: std(0x3f7a3a, 0.8, 0, flat),
    };
    return this._mats;
  }

  tree(x, z, s = 1, kind = 'broad', collide = true) {
    const M = this.mats;
    if (kind === 'palm') {
      const lean = this.r(-0.15, 0.15);
      const h = 6.5 * s;
      this.instance('palmTrunk', geoCache('palmTrunk', () => new THREE.CylinderGeometry(0.16, 0.26, 1, 7)), M.palmBark, x + lean * h / 2, h / 2, z, { sy: h, rz: -lean });
      const topX = x + lean * h, topY = h;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + this.r(0, 0.4);
        this.instance('palmLeaf', geoCache('palmLeaf', () => { const g = new THREE.ConeGeometry(0.35, 3.2, 4, 1); g.translate(0, 1.6, 0); g.scale(1, 1, 0.15); return g; }), M.palmLeaf, topX, topY, z,
          { rx: 0, ry: -a, rz: 1.9 + this.r(-0.2, 0.2), sx: s, sy: s, sz: s });
      }
      this.instance('coconut', geoCache('coconut', () => new THREE.SphereGeometry(0.16, 8, 6)), std(0x5a4a1a, 0.7), topX + 0.2, topY - 0.25, z + 0.1);
    } else if (kind === 'pine' || kind === 'snowpine') {
      this.instance('trunk', geoCache('trunk', () => new THREE.CylinderGeometry(0.15, 0.25, 1, 7)), M.bark, x, 1.2 * s, z, { sy: 2.4 * s });
      for (let i = 0; i < 3; i++) {
        const sc = s * (1.6 - i * 0.4);
        this.instance(kind === 'snowpine' && i === 2 ? 'snowcone' : 'pinecone', geoCache('cone', () => new THREE.ConeGeometry(1.4, 2.6, 8)),
          kind === 'snowpine' && i === 2 ? M.snow : M.pine, x, (2.2 + i * 1.5) * s, z, { sx: sc, sy: s, sz: sc, ry: this.r(0, 3) });
      }
      if (kind === 'snowpine') this.instance('snowcap', geoCache('cone', () => new THREE.ConeGeometry(1.4, 2.6, 8)), M.snow, x, 2.5 * s, z, { sx: s * 1.62, sy: s * 0.3, sz: s * 1.62 });
    } else if (kind === 'dead') {
      this.instance('trunk', geoCache('trunk', () => new THREE.CylinderGeometry(0.15, 0.25, 1, 7)), std(0x2a2220, 0.95), x, 2 * s, z, { sy: 4 * s });
      for (let i = 0; i < 4; i++) {
        this.instance('branch', geoCache('branch', () => { const g = new THREE.CylinderGeometry(0.04, 0.09, 1.8, 5); g.translate(0, 0.9, 0); return g; }), std(0x2a2220, 0.95),
          x, (2.2 + i * 0.6) * s, z, { ry: i * 1.7 + this.r(0, 1), rz: 0.9 + this.r(-0.2, 0.3), sx: s, sy: s, sz: s });
      }
    } else {
      this.instance('trunk', geoCache('trunk', () => new THREE.CylinderGeometry(0.15, 0.25, 1, 7)), M.bark, x, 1.4 * s, z, { sy: 2.8 * s });
      this.instance('leafball', geoCache('leafball', () => new THREE.IcosahedronGeometry(1.6, 1)), M.leaf, x, 3.6 * s, z, { sx: s * 1.1, sy: s * 0.95, sz: s * 1.1, ry: this.r(0, 3) });
      this.instance('leafball', geoCache('leafball', () => new THREE.IcosahedronGeometry(1.6, 1)), M.leaf, x + 0.6 * s, 4.5 * s, z - 0.3 * s, { sx: s * 0.7, sy: s * 0.7, sz: s * 0.7 });
    }
    if (collide) this.collider(x - 0.35 * s, 0, z - 0.35 * s, x + 0.35 * s, 6 * s, z + 0.35 * s);
  }

  rock(x, z, s = 1, mat = null, collide = true) {
    const sy = s * this.r(0.5, 0.9);
    this.instance('rock' + (mat ? mat.uuid : ''), geoCache('rock', () => new THREE.DodecahedronGeometry(1, 0)), mat || this.mats.rock, x, sy * 0.4, z,
      { sx: s * this.r(0.8, 1.3), sy, sz: s * this.r(0.8, 1.2), ry: this.r(0, 6), rx: this.r(-0.2, 0.2) });
    if (collide) this.collider(x - s * 0.85, 0, z - s * 0.85, x + s * 0.85, sy * 1.2, z + s * 0.85);
  }

  crate(x, z, s = 1.2, stack = 1, rotY = 0) {
    for (let i = 0; i < stack; i++) this.box(x, i * s, z, s, s, s, this.mats.crate, { rotY: rotY + i * 0.3 });
  }

  barrel(x, z, color = 0x2a6ad0) {
    this.mesh(geoCache('barrel', () => new THREE.CylinderGeometry(0.42, 0.42, 1.2, 14)), std(color, 0.5, 0.5), x, 0.6, z);
    this.collider(x - 0.42, 0, z - 0.42, x + 0.42, 1.2, z + 0.42);
  }

  car(x, z, rotY = 0, color = 0xc0392b) {
    const g = new THREE.Group();
    const body = std(color, 0.25, 0.6);
    const glass = std(0x1a2a3a, 0.1, 0.9);
    const add = (geo, m, px, py, pz) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
    add(new THREE.BoxGeometry(1.9, 0.7, 4.2), body, 0, 0.65, 0);
    add(new THREE.BoxGeometry(1.7, 0.6, 2.2), glass, 0, 1.28, -0.2);
    add(new THREE.BoxGeometry(1.72, 0.08, 2.0), body, 0, 1.6, -0.2);
    const wheel = geoCache('wheel', () => new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14));
    const wm = std(0x111111, 0.9);
    for (const sx of [-0.9, 0.9]) for (const sz of [-1.3, 1.3]) add(wheel, wm, sx, 0.36, sz).rotation.z = Math.PI / 2;
    const lightM = new THREE.MeshBasicMaterial({ color: 0xfff2c0, toneMapped: false });
    for (const sx of [-0.65, 0.65]) add(new THREE.BoxGeometry(0.35, 0.15, 0.05), lightM, sx, 0.75, 2.11);
    const tailM = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
    for (const sx of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.3, 0.12, 0.05), tailM, sx, 0.8, -2.11);
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    this.scene.add(g);
    const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
    const hw = (c * 1.9 + s * 4.2) / 2, hd = (s * 1.9 + c * 4.2) / 2;
    this.collider(x - hw, 0, z - hd, x + hw, 1.65, z + hd);
  }

  house(x, z, w, d, h, wallColor, roofColor, rotY = 0) {
    const wallM = std(wallColor, 0.9);
    this.box(x, 0, z, w, h, d, wallM, { rotY });
    const roof = this.mesh(geoCache('roof4', () => new THREE.ConeGeometry(1, 1, 4, 1)), std(roofColor, 0.8, 0, { flatShading: true }), x, h + 1.2, z, { ry: Math.PI / 4 + rotY });
    roof.scale.set(Math.max(w, d) * 0.78, 2.4, Math.max(w, d) * 0.78);
    // door & windows facing +x/-x side
    const doorM = std(0x5a3418, 0.8);
    const winM = std(0x2a3b52, 0.2, 0.5, { emissive: 0x1a2a40, emissiveIntensity: 0.4 });
    const face = Math.sign(-x) || 1;
    this.box(x + face * (w / 2 + 0.03), 0, z, 0.08, 2.2, 1.3, doorM, { collide: false, cast: false });
    for (const dz of [-d / 3, d / 3]) this.box(x + face * (w / 2 + 0.03), 1.4, z + dz, 0.08, 1, 1.2, winM, { collide: false, cast: false });
    // thinnai (veranda step)
    this.box(x + face * (w / 2 + 0.6), 0, z, 1.2, 0.45, d * 0.8, std(0xb8a48a, 0.9));
  }

  wall(x1, z1, x2, z2, h, t, mat) {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
    const w = Math.abs(x2 - x1) || t, d = Math.abs(z2 - z1) || t;
    const m = this.box(cx, 0, cz, w, h, d, mat);
    if (mat.map) {
      const mm = mat.clone();
      mm.map = mat.map.clone();
      mm.map.repeat.set(Math.max(w, d) / 3, h / 3);
      m.material = mm;
    }
    return m;
  }

  lamp(x, z, color = 0xffd890, light = true, h = 5.5) {
    this.mesh(geoCache('pole', () => new THREE.CylinderGeometry(0.07, 0.1, 1, 8)), this.mats.darkMetal, x, h / 2, z, { s: [1, h, 1] });
    this.collider(x - 0.15, 0, z - 0.15, x + 0.15, h, z + 0.15);
    const bulb = this.mesh(geoCache('bulb', () => new THREE.SphereGeometry(0.22, 12, 8)), new THREE.MeshBasicMaterial({ color, toneMapped: false }), x, h, z, { cast: false });
    bulb.material.color.multiplyScalar(2.5);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(x, h, z);
    halo.scale.setScalar(3);
    this.scene.add(halo);
    if (light) {
      const pl = new THREE.PointLight(color, 60, 22, 1.6);
      pl.position.set(x, h - 0.3, z);
      this.scene.add(pl);
    }
  }

  torch(x, z, h = 2.4, light = true) {
    this.mesh(geoCache('torchpole', () => new THREE.CylinderGeometry(0.08, 0.12, 1, 6)), std(0x3a2a1a, 0.9), x, h / 2, z, { s: [1, h, 1] });
    this.mesh(geoCache('bowl', () => new THREE.CylinderGeometry(0.35, 0.18, 0.3, 10)), this.mats.darkMetal, x, h, z);
    this.collider(x - 0.3, 0, z - 0.3, x + 0.3, h, z + 0.3);
    const flame = this.mesh(geoCache('flame', () => new THREE.ConeGeometry(0.25, 0.8, 8)), new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), x, h + 0.5, z, { cast: false });
    flame.material.color.multiplyScalar(3);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff8a30, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.position.set(x, h + 0.5, z);
    halo.scale.setScalar(2.6);
    this.scene.add(halo);
    let pl = null;
    if (light) {
      pl = new THREE.PointLight(0xff8a30, 40, 18, 1.6);
      pl.position.set(x, h + 0.8, z);
      this.scene.add(pl);
    }
    const ph = this.r(0, 10);
    this.updaters.push((dt, t) => {
      const f = 0.85 + Math.sin(t * 13 + ph) * 0.08 + Math.sin(t * 29 + ph) * 0.07;
      flame.scale.set(f, 0.9 + (1 - f) * 2, f);
      if (pl) pl.intensity = 40 * f;
    });
  }

  lavaPool(x, z, r) {
    const mat = new THREE.ShaderMaterial({ vertexShader: UV_VS, fragmentShader: LAVA_FS, uniforms: { time: { value: 0 } } });
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.03, z);
    this.scene.add(m);
    this.updaters.push((dt, t) => { mat.uniforms.time.value = t; });
    this.layout.hazards.push({ type: 'lava', shape: 'circle', x, z, r: r * 0.92 });
    // rim stones
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.rock(x + Math.cos(a) * r, z + Math.sin(a) * r, this.r(0.4, 0.8), this.mats.darkRock, false);
    }
  }

  lavaRect(minX, maxX, minZ, maxZ) {
    const mat = new THREE.ShaderMaterial({ vertexShader: UV_VS, fragmentShader: LAVA_FS, uniforms: { time: { value: 0 } } });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((minX + maxX) / 2, 0.03, (minZ + maxZ) / 2);
    this.scene.add(m);
    this.updaters.push((dt, t) => { mat.uniforms.time.value = t * 0.7; });
    this.layout.hazards.push({ type: 'lava', shape: 'rect', minX, maxX, minZ, maxZ });
  }

  building(x, z, w, d, h, y0 = 0, lit = 0.4) {
    const { map, emissiveMap } = windowsTex(lit);
    map.repeat.set(Math.max(1, w / 6), Math.max(1, h / 10));
    emissiveMap.repeat.copy(map.repeat);
    const m = new THREE.Mesh(UNIT_BOX, std(0xffffff, 0.8, 0.1, { map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.85 }));
    m.scale.set(w, h, d);
    m.position.set(x, y0 + h / 2, z);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  // ---------- path helpers for ghost levels ----------
  pathRibbon(points, width, tex, y = 0.02) {
    const pos = [], uv = [], idx = [];
    let acc = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      if (i > 0) acc += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
      pos.push(p.x + nx * width / 2, y, p.z + nz * width / 2, p.x - nx * width / 2, y, p.z - nz * width / 2);
      uv.push(0, acc / width, 1, acc / width);
      if (i > 0) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    tex.repeat.set(1, 1);
    const m = new THREE.Mesh(g, std(0xffffff, 0.95, 0, { map: tex, side: THREE.DoubleSide }));
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  distToPath(x, z, path) {
    let best = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
      const r = segDist2D(x, z, path[i].x, path[i].z, path[i + 1].x, path[i + 1].z);
      if (r.d < best) best = r.d;
    }
    return best;
  }

  smoothPath(fn, z0, z1, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const z = z0 + (z1 - z0) * (i / steps);
      pts.push(new V3(fn(z), 0, z));
    }
    return pts;
  }

  update(dt, t) {
    for (const u of this.updaters) u(dt, t);
  }
}

const _geo = new Map();
function geoCache(key, make) {
  if (!_geo.has(key)) _geo.set(key, make());
  return _geo.get(key);
}

// ---------- gate, key card, pickups ----------
export function buildGate(scene, x, z, yaw) {
  const g = new THREE.Group();
  const stone = std(0x6a6258, 0.85);
  const gold = std(0xd8a838, 0.3, 0.8, { emissive: 0x6a4a10, emissiveIntensity: 0.4 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(UNIT_BOX, stone);
    p.scale.set(0.9, 5.4, 0.9);
    p.position.set(s * 2.7, 2.7, 0);
    p.castShadow = true;
    g.add(p);
    const cap = new THREE.Mesh(geoCache('gcap', () => new THREE.ConeGeometry(0.7, 1.2, 4)), gold);
    cap.position.set(s * 2.7, 6, 0);
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
  }
  const lintel = new THREE.Mesh(UNIT_BOX, stone);
  lintel.scale.set(6.4, 0.7, 1);
  lintel.position.y = 5.5;
  lintel.castShadow = true;
  g.add(lintel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.14, 12, 48), new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff3344, emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.3 }));
  ring.position.y = 2.6;
  g.add(ring);
  const portalMat = new THREE.ShaderMaterial({
    vertexShader: UV_VS, fragmentShader: PORTAL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0xff3344) } },
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.05, 48), portalMat);
  disc.position.y = 2.6;
  g.add(disc);
  const light = new THREE.PointLight(0xff3344, 30, 16, 1.8);
  light.position.set(0, 2.6, 1.2);
  g.add(light);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  scene.add(g);
  let open = false;
  return {
    group: g,
    pos: new V3(x, 0, z),
    colliders: [-1, 1].map((s) => {
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const px = x + s * 2.7 * c, pz = z - s * 2.7 * sn;
      return { min: new V3(px - 0.55, 0, pz - 0.55), max: new V3(px + 0.55, 5.4, pz + 0.55) };
    }),
    get open() { return open; },
    setOpen(v) {
      open = v;
      const col = new THREE.Color(v ? 0x35ffb0 : 0xff3344);
      ring.material.color.copy(col);
      ring.material.emissive.copy(col);
      portalMat.uniforms.color.value.copy(col);
      light.color.copy(col);
    },
    update(t) {
      portalMat.uniforms.time.value = t * (open ? 1.4 : 0.5);
      ring.rotation.z = t * (open ? 0.8 : 0.2);
    },
  };
}

let keyTex = null;
function keyCardTex() {
  if (keyTex) return keyTex;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 160);
  grad.addColorStop(0, '#ffe27a'); grad.addColorStop(1, '#d08a10');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#c9c9c9';
  g.fillRect(24, 50, 50, 40);
  g.strokeStyle = '#8a8a8a'; g.strokeRect(24, 50, 50, 40);
  g.fillStyle = '#3a2000';
  g.font = '900 54px Arial Black, sans-serif';
  g.fillText('KEY', 96, 92);
  g.font = '700 18px Arial';
  g.fillText('LEVEL PASS', 96, 128);
  keyTex = new THREE.CanvasTexture(c);
  keyTex.colorSpace = THREE.SRGBColorSpace;
  return keyTex;
}

export function buildKeyCard(scene, pos) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.03), new THREE.MeshStandardMaterial({
    map: keyCardTex(), emissive: 0xffb020, emissiveMap: keyCardTex(), emissiveIntensity: 0.9, metalness: 0.5, roughness: 0.3,
  }));
  card.position.y = 1.1;
  g.add(card);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 40, 16, 1, true), new THREE.MeshBasicMaterial({
    color: 0xffc040, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));
  beam.position.y = 20;
  g.add(beam);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffb020, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(2.2);
  glow.position.y = 1.1;
  g.add(glow);
  g.position.set(pos.x, 0, pos.z);
  scene.add(g);
  return {
    group: g,
    update(t) {
      card.rotation.y = t * 2.5;
      card.position.y = 1.1 + Math.sin(t * 3) * 0.12;
      ring.scale.setScalar(1 + Math.sin(t * 4) * 0.12);
    },
  };
}

let medTex = null, ammoTex = null;
export function buildPickup(scene, type, x, z) {
  if (!medTex) {
    medTex = canvasTex(128, (g) => { g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e02424'; g.fillRect(48, 18, 32, 92); g.fillRect(18, 48, 92, 32); });
    ammoTex = canvasTex(128, (g) => {
      g.fillStyle = '#3c5a2a'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#f0c040';
      for (let i = 0; i < 5; i++) { g.fillRect(14 + i * 22, 34, 12, 60); g.beginPath(); g.arc(20 + i * 22, 34, 6, Math.PI, 0); g.fill(); }
    });
  }
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.55), new THREE.MeshStandardMaterial({ map: type === 'med' ? medTex : ammoTex, roughness: 0.6 }));
  box.castShadow = true;
  box.position.y = 0.6;
  g.add(box);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: type === 'med' ? 0xff5050 : 0x80ff60, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.setScalar(1.6);
  glow.position.y = 0.6;
  g.add(glow);
  g.position.set(x, 0, z);
  scene.add(g);
  const ph = Math.random() * 6;
  return {
    type, group: g, pos: new V3(x, 0, z), taken: false,
    update(t) { box.rotation.y = t * 1.5 + ph; box.position.y = 0.6 + Math.sin(t * 2.5 + ph) * 0.1; },
  };
}

// ---------- level environments ----------
function battleSpawns(L, zA, zB, spread = 10) {
  for (let i = 0; i < 8; i++) {
    const x = ((i % 4) - 1.5) * (spread / 2), dz = Math.floor(i / 4) * 3;
    L.spawnA.push(new V3(x, 0, zA + dz));
    L.spawnB.push(new V3(x, 0, zB - dz));
  }
}

function farFromSpawns(L, x, z, d = 7) {
  for (const s of [...L.spawnA, ...L.spawnB]) if (Math.hypot(s.x - x, s.z - z) < d) return false;
  if (Math.hypot(L.gate.x - x, L.gate.z - z) < d) return false;
  return true;
}

const BUILDERS = {
  courtyard(w) {
    const L = w.layout;
    L.bounds = { minX: -29, maxX: 29, minZ: -41, maxZ: 41 };
    battleSpawns(L, 32, -32);
    L.gate = { x: 0, z: -38.5, yaw: 0 };
    w.ground(500, speckleTex(0x6f8f3a, [0x5a7a2a, 0x8aa04a, 0x7a6a3a, 0x4a6a24], { repeat: 1 }), 64);
    // scenery outside the compound
    for (let i = 0; i < 90; i++) {
      const a = w.r(0, Math.PI * 2), r = w.r(48, 110);
      w.tree(Math.cos(a) * r, Math.sin(a) * r, w.r(0.9, 1.5), w.rng() < 0.6 ? 'palm' : 'broad', false);
    }
    // dirt yard in the middle
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(40, 70), std(0xffffff, 1, 0, { map: speckleTex(0xb08a5a, [0x9a7448, 0xc4a070, 0x8a6a40], { repeat: 1 }), transparent: false }));
    dirt.material.map.repeat.set(4, 7);
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.01;
    dirt.receiveShadow = true;
    w.scene.add(dirt);
    // kolam at both spawns
    for (const z of [26, -26]) {
      const k = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: kolamTex(), transparent: true, roughness: 1 }));
      k.rotation.x = -Math.PI / 2;
      k.position.set(0, 0.02, z);
      k.receiveShadow = true;
      w.scene.add(k);
    }
    const brick = std(0xffffff, 0.9, 0, { map: bricksTex('#c86a42', '#e8dcc4') });
    w.wall(-30, -42, 30, -42, 2.4, 0.6, brick);
    w.wall(-30, 42, 30, 42, 2.4, 0.6, brick);
    w.wall(-30, -42, -30, 42, 2.4, 0.6, brick);
    w.wall(30, -42, 30, 42, 2.4, 0.6, brick);
    w.house(-23, 4, 10, 16, 4.2, 0xf0e2c0, 0xb5442a);
    w.house(23, -6, 10, 16, 4.2, 0xe8d4f0, 0x9a3a28);
    w.house(-23, -26, 9, 10, 3.6, 0xc8e8d8, 0xa8402a);
    w.house(23, 22, 9, 10, 3.6, 0xf4d8b0, 0xb04a30);
    // well
    w.mesh(new THREE.CylinderGeometry(1.4, 1.5, 1, 20, 1, true), std(0xb8b0a0, 0.9, 0, { side: THREE.DoubleSide }), 0, 0.5, 0);
    w.mesh(new THREE.TorusGeometry(1.45, 0.15, 8, 24), std(0xd0c8b8, 0.9), 0, 1, 0, { rx: Math.PI / 2 });
    w.mesh(new THREE.CircleGeometry(1.35, 20), std(0x1a3a5a, 0.1, 0.3), 0, 0.6, 0, { rx: -Math.PI / 2, cast: false });
    for (const s of [-1, 1]) w.mesh(geoCache('wpost', () => new THREE.BoxGeometry(0.15, 2.2, 0.15)), w.mats.bark, s * 1.4, 1.1, 0);
    w.mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), w.mats.bark, 0, 2.2, 0, { rz: Math.PI / 2 });
    w.collider(-1.5, 0, -1.5, 1.5, 1.1, 1.5);
    // tulsi maadam
    w.box(-6, 0, 22, 1.1, 1.1, 1.1, std(0xd85a3a, 0.8));
    w.mesh(geoCache('tulsi', () => new THREE.IcosahedronGeometry(0.5, 1)), w.mats.leaf, -6, 1.5, 22);
    // palms along walls
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      const z = -36 + (i / 16) * 72 + w.r(-2, 2);
      const x = side * w.r(13, 15.5);
      if (farFromSpawns(L, x, z, 5)) w.tree(x, z, w.r(0.9, 1.15), 'palm');
    }
    // haystacks
    for (const [x, z] of [[-12, -14], [12, 12], [-14, 30], [14, -30]]) {
      w.mesh(geoCache('hay', () => new THREE.CylinderGeometry(1.3, 1.5, 1.8, 14)), w.mats.hay, x, 0.9, z);
      w.mesh(geoCache('haytop', () => new THREE.ConeGeometry(1.4, 1.4, 14)), w.mats.hay, x, 2.5, z);
      w.collider(x - 1.4, 0, z - 1.4, x + 1.4, 3, z + 1.4);
    }
    // bullock cart
    w.box(8, 0.7, -2, 2.2, 0.25, 3.4, std(0x7a4a22, 0.9));
    for (const s of [-1, 1]) w.mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 16), std(0x4a2a12, 0.9), 8 + s * 1.2, 0.75, -2, { ry: Math.PI / 2 });
    w.collider(6.7, 0, -3.7, 9.3, 1.5, -0.3);
    // crates & cover
    const cover = [[-8, 10], [7, 14], [-4, -10], [9, -14], [0, 12], [-10, -1], [3, -20], [-6, 18], [10, 4], [-2, -26], [5, 24]];
    for (const [x, z] of cover) w.crate(x + w.r(-1, 1), z + w.r(-1, 1), 1.2, w.rng() < 0.4 ? 2 : 1, w.r(0, 1));
    w.car(-11, -22, 0.4, 0xd8d8d0);
    w.car(12, 28, -0.3, 0x2a5ad0);
    for (let i = 0; i < 6; i++) w.barrel(w.r(-15, 15), w.r(-30, 30), [0x2a6ad0, 0x2aa06a, 0xd05a2a][i % 3]);
    L.pickups.push({ type: 'med', x: -15, z: 0 }, { type: 'med', x: 15, z: -18 }, { type: 'ammo', x: 0, z: 6 }, { type: 'ammo', x: -8, z: -18 }, { type: 'ammo', x: 10, z: 20 });
  },

  forest(w) {
    const L = w.layout;
    const fn = (z) => 12 * Math.sin(z * 0.045) + 4 * Math.sin(z * 0.13);
    L.path = w.smoothPath(fn, 70, -70, 70);
    L.pathLimit = 7.5;
    L.bounds = { minX: -60, maxX: 60, minZ: -76, maxZ: 76 };
    const end = L.path[L.path.length - 1];
    L.gate = { x: end.x, z: end.z - 2, yaw: 0 };
    L.spawnA.push(new V3(L.path[1].x, 0, L.path[1].z), new V3(L.path[1].x - 2, 0, L.path[1].z + 2), new V3(L.path[1].x + 2, 0, L.path[1].z + 2));
    w.ground(220, speckleTex(0x2f4a22, [0x23391a, 0x3d5a2a, 0x4a3a2a], { repeat: 1 }), 30);
    w.pathRibbon(L.path, 5, speckleTex(0x6a5038, [0x5a4030, 0x7a6048, 0x4a3828]));
    for (let i = 0; i < 360; i++) {
      const x = w.r(-55, 55), z = w.r(-75, 75);
      const d = w.distToPath(x, z, L.path);
      if (d < 4.5) continue;
      w.tree(x, z, w.r(0.9, 1.6), w.rng() < 0.6 ? 'pine' : 'broad', d < 12);
    }
    // glowing mushrooms and lanterns along the path
    const shroom = new THREE.MeshBasicMaterial({ color: 0x7affd8, toneMapped: false });
    shroom.color.multiplyScalar(1.6);
    for (let i = 0; i < 70; i++) {
      const p = L.path[(w.rng() * L.path.length) | 0];
      const a = w.r(0, 6.28), r = w.r(3, 7);
      w.instance('shroom', geoCache('shroom', () => new THREE.SphereGeometry(0.15, 8, 6, 0, 6.3, 0, 1.6)), shroom, p.x + Math.cos(a) * r, 0.1, p.z + Math.sin(a) * r, { cast: false, sx: w.r(0.7, 1.6), sy: w.r(0.7, 1.6), sz: w.r(0.7, 1.6) });
    }
    for (let i = 4; i < L.path.length - 4; i += 9) {
      const p = L.path[i];
      w.lamp(p.x + 3.2, p.z, 0xffb060, i % 18 === 4, 2.6);
    }
    for (let i = 0; i < 40; i++) w.rock(w.r(-50, 50), w.r(-70, 70), w.r(0.6, 1.6), null, false);
    for (const f of [0.22, 0.42, 0.62, 0.82]) {
      const p = L.path[Math.floor(f * L.path.length)];
      L.pickups.push({ type: f === 0.42 || f === 0.82 ? 'med' : 'ammo', x: p.x + 1.5, z: p.z });
    }
  },

  night(w) {
    const L = w.layout;
    L.bounds = { minX: -17, maxX: 17, minZ: -47, maxZ: 47 };
    battleSpawns(L, 38, -38, 8);
    L.gate = { x: 0, z: -45, yaw: 0 };
    w.ground(160, speckleTex(0x3a3a3c, [0x2a2a2c, 0x4a4a4c, 0x333336]), 30);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(13, 100), std(0xffffff, 0.6, 0.1, { map: roadTex() }));
    road.material.map.repeat.set(1, 8);
    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.015;
    road.receiveShadow = true;
    w.scene.add(road);
    for (const s of [-1, 1]) w.box(s * 6.6, 0, 0, 0.3, 0.15, 100, std(0xb8b8b0, 0.8), { collide: false, cast: false });
    // buildings walling the street
    for (const s of [-1, 1]) {
      let z = -52;
      while (z < 52) {
        const d = w.r(8, 14), h = w.r(10, 26);
        w.building(s * (18 + 5), z + d / 2, 10, d - 0.5, h, 0, 0.35);
        w.collider(s > 0 ? 18 : -28, 0, z, s > 0 ? 28 : -18, h, z + d);
        z += d;
      }
    }
    // tea stall with neon sign
    w.box(-14, 0, 6, 3, 2.6, 4, std(0x8a3a2a, 0.8));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.5), new THREE.MeshBasicMaterial({ map: neonTex(['TEA KADAI', 'Chai • Vadai'], '#ffb020'), toneMapped: false }));
    sign.position.set(-12.45, 3.3, 6);
    sign.rotation.y = Math.PI / 2;
    w.scene.add(sign);
    for (let i = 0; i < 10; i++) {
      const s = i % 2 ? 1 : -1;
      const z = -34 + i * 7.5 + w.r(-1.5, 1.5);
      if (farFromSpawns(L, s * 9, z, 5)) w.car(s * w.r(8.5, 10.5), z, w.r(-0.2, 0.2) + (s > 0 ? Math.PI : 0), [0xc0392b, 0x2a5ad0, 0xe0e0e0, 0x1a1a1a, 0xf0b020][i % 5]);
    }
    w.car(-2, 4, 1.2, 0x7a2ad0);
    w.car(3, -14, -1.0, 0xd0d0d0);
    for (const [x, z] of [[-3, 18], [4, 22], [-5, -6], [5, -24], [0, -30], [-6, 28]]) w.crate(x, z, 1.1, w.rng() < 0.5 ? 2 : 1);
    for (let i = 0; i < 8; i++) w.barrel(w.r(-12, 12), w.r(-32, 32), 0x3a6a3a);
    const lampZ = [-40, -24, -8, 8, 24, 40];
    lampZ.forEach((z, i) => w.lamp(i % 2 ? 12.5 : -12.5, z, 0xffc070, i % 2 === 0 || i === 3));
    L.pickups.push({ type: 'med', x: -12, z: 12 }, { type: 'med', x: 12, z: -10 }, { type: 'ammo', x: 0, z: 10 }, { type: 'ammo', x: 0, z: -18 }, { type: 'ammo', x: -10, z: -28 });
  },

  bridge(w) {
    const L = w.layout;
    L.noGround = true;
    const islands = [[0, 62], [12, 40], [-6, 18], [9, -4], [-9, -26], [4, -48], [0, -68]].map(([x, z]) => new V3(x, 0, z));
    L.path = islands;
    L.bounds = { minX: -60, maxX: 60, minZ: -80, maxZ: 80 };
    L.walk = { circles: [], segs: [] };
    L.gate = { x: 0, z: -70.5, yaw: 0 };
    L.spawnA.push(new V3(0, 0, 63));
    const grass = std(0xffffff, 0.95, 0, { map: speckleTex(0x4a5a3a, [0x3a4a2a, 0x5a6a42, 0x6a5a4a]) });
    const plank = std(0xffffff, 0.85, 0, { map: planksTex() });
    islands.forEach((p, i) => {
      const r = i === islands.length - 1 ? 6.5 : 5;
      w.mesh(new THREE.CylinderGeometry(r, r * 0.4, 9, 10, 2), w.mats.darkRock, p.x, -4.55, p.z, { ry: i });
      const top = w.mesh(new THREE.CylinderGeometry(r, r, 0.12, 24), grass, p.x, -0.06, p.z, { cast: false });
      top.receiveShadow = true;
      L.walk.circles.push({ x: p.x, z: p.z, r: r - 0.3 });
      if (i > 0 && i < islands.length - 1) w.torch(p.x + 2.5, p.z + 1.5, 2.2, i % 2 === 1);
      for (let k = 0; k < 3; k++) w.rock(p.x + w.r(-3, 3), p.z + w.r(-3, 3), w.r(0.4, 0.7), w.mats.darkRock, false);
    });
    const gapBridges = new Set([2, 4, 5]);
    for (let i = 0; i < islands.length - 1; i++) {
      const a = islands[i], b = islands[i + 1];
      const dir = new V3().subVectors(b, a);
      const len = dir.length();
      dir.normalize();
      const start = a.clone().addScaledVector(dir, 4.6), endp = b.clone().addScaledVector(dir, -4.6);
      const blen = start.distanceTo(endp);
      const yaw = Math.atan2(dir.x, dir.z);
      const gap = gapBridges.has(i) ? 2.2 : 0;
      const parts = gap ? [[0, blen / 2 - gap / 2], [blen / 2 + gap / 2, blen]] : [[0, blen]];
      for (const [t0, t1] of parts) {
        const pa = start.clone().addScaledVector(dir, t0), pb = start.clone().addScaledVector(dir, t1);
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const seg = w.box(mid.x, -0.25, mid.z, 3, 0.25, t1 - t0, plank, { collide: false, rotY: yaw });
        seg.material = plank.clone();
        seg.material.map = plank.map.clone();
        seg.material.map.repeat.set(1, (t1 - t0) / 2);
        L.walk.segs.push({ ax: pa.x, az: pa.z, bx: pb.x, bz: pb.z, hw: 1.5 });
        // rope posts
        for (let t = t0; t <= t1; t += 3) {
          for (const s of [-1, 1]) {
            const px = pa.x + dir.x * (t - t0) + dir.z * s * 1.45, pz = pa.z + dir.z * (t - t0) - dir.x * s * 1.45;
            w.instance('post', geoCache('post', () => new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6)), w.mats.bark, px, 0.4, pz);
          }
        }
      }
      void len;
    }
    // abyss glow and floating rocks
    const abyss = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ color: 0xff3a20, toneMapped: false }));
    abyss.material.color.multiplyScalar(0.8);
    abyss.rotation.x = -Math.PI / 2;
    abyss.position.y = -70;
    w.scene.add(abyss);
    for (let i = 0; i < 60; i++) {
      const x = w.r(-80, 80), z = w.r(-90, 90);
      if (w.distToPath(x, z, islands) < 12) continue;
      w.instance('frock', geoCache('rock', () => new THREE.DodecahedronGeometry(1, 0)), w.mats.darkRock, x, w.r(-30, 10), z, { sx: w.r(1, 5), sy: w.r(1, 4), sz: w.r(1, 5), ry: w.r(0, 6), cast: false });
    }
    L.pickups.push({ type: 'ammo', x: islands[2].x + 1, z: islands[2].z }, { type: 'med', x: islands[3].x - 1, z: islands[3].z }, { type: 'ammo', x: islands[4].x, z: islands[4].z + 1 }, { type: 'med', x: islands[5].x + 1, z: islands[5].z });
  },

  rooftop(w) {
    const L = w.layout;
    L.bounds = { minX: -21, maxX: 21, minZ: -31, maxZ: 31 };
    battleSpawns(L, 24, -24, 9);
    L.gate = { x: 0, z: -29.5, yaw: 0 };
    w.ground(600, speckleTex(0x1a1c22, [0x22252c, 0x14161a]), 60).position.y = -60;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(44, 64), std(0xffffff, 0.35, 0.1, { map: tilesTex('#6a6c70', '#3a3c40', 4) }));
    roof.material.map.repeat.set(11, 16);
    roof.rotation.x = -Math.PI / 2;
    roof.position.y = 0.01;
    roof.receiveShadow = true;
    w.scene.add(roof);
    w.box(0, -60, 0, 44, 60, 64, std(0x3a3e46, 0.8), { collide: false, cast: false });
    const parapet = std(0x8a8c90, 0.85);
    w.box(0, 0, -32, 44, 1.1, 0.5, parapet);
    w.box(0, 0, 32, 44, 1.1, 0.5, parapet);
    w.box(-22, 0, 0, 0.5, 1.1, 64, parapet);
    w.box(22, 0, 0, 0.5, 1.1, 64, parapet);
    // stairwell huts
    for (const [x, z] of [[-13, 10], [13, -8], [-4, -14]]) {
      w.box(x, 0, z, 4, 3, 4, std(0xa8aaa8, 0.85));
      w.box(x, 3, z, 4.4, 0.2, 4.4, std(0x6a6c6a, 0.8));
    }
    // black water tanks on stands
    for (const [x, z] of [[14, 14], [-15, -20], [8, 2]]) {
      for (const sx of [-0.8, 0.8]) for (const sz of [-0.8, 0.8]) w.mesh(geoCache('leg', () => new THREE.BoxGeometry(0.12, 1.4, 0.12)), w.mats.darkMetal, x + sx, 0.7, z + sz);
      w.mesh(geoCache('tank', () => new THREE.CylinderGeometry(1.2, 1.2, 1.9, 18)), std(0x15161a, 0.5, 0.2), x, 2.35, z);
      w.collider(x - 1.2, 0, z - 1.2, x + 1.2, 3.3, z + 1.2);
    }
    // solar panels & AC units as cover
    for (let i = 0; i < 4; i++) {
      const z = -8 + i * 5;
      const p = w.box(-4 + (i % 2) * 6, 0.3, z, 4, 0.12, 1.8, std(0x1a3a8a, 0.2, 0.7, { emissive: 0x0a1a4a, emissiveIntensity: 0.4 }), { collide: false });
      p.rotation.x = -0.35;
      w.collider(-6 + (i % 2) * 6, 0, z - 0.9, -2 + (i % 2) * 6, 1.0, z + 0.9);
    }
    for (const [x, z] of [[-17, 4], [17, 2], [-8, 22], [9, -20], [0, 16], [-16, -10], [16, 20], [4, -26]]) w.box(x, 0, z, 1.4, 1.1, 1, std(0xd8d8d0, 0.6, 0.3));
    w.crate(-8, -4, 1.1, 2);
    w.crate(9, 10, 1.1, 1);
    // glowing billboard
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(14, 5.25), new THREE.MeshBasicMaterial({ map: neonTex(['FAMILY WAR 3D', 'CREATED BY JAHITH'], '#ff3ad0'), toneMapped: false }));
    bb.position.set(0, 7, 31.6);
    bb.rotation.y = Math.PI;
    w.scene.add(bb);
    for (const s of [-1, 1]) w.mesh(geoCache('bbpole', () => new THREE.BoxGeometry(0.3, 5, 0.3)), w.mats.darkMetal, s * 5, 2.5, 31.7);
    // city below
    const rng = w.rng;
    for (let i = 0; i < 70; i++) {
      const a = rng() * Math.PI * 2, r = 40 + rng() * 120;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 30 + rng() * 75;
      w.building(x, z, 10 + rng() * 14, 10 + rng() * 14, h, -60, 0.45);
    }
    w.lamp(-20, -30, 0xfff0d0, true, 2.2);
    w.lamp(20, 30, 0xfff0d0, true, 2.2);
    L.pickups.push({ type: 'med', x: -18, z: 18 }, { type: 'med', x: 18, z: -14 }, { type: 'ammo', x: 0, z: 4 }, { type: 'ammo', x: -10, z: -24 }, { type: 'ammo', x: 12, z: 24 });
  },

  graveyard(w) {
    const L = w.layout;
    const fn = (z) => 8 * Math.sin(z * 0.06) - 3 * Math.cos(z * 0.11);
    L.path = w.smoothPath(fn, 64, -64, 64);
    L.pathLimit = 9;
    L.bounds = { minX: -50, maxX: 50, minZ: -72, maxZ: 72 };
    const end = L.path[L.path.length - 1];
    L.gate = { x: end.x, z: end.z - 2, yaw: 0 };
    L.spawnA.push(new V3(L.path[1].x, 0, L.path[1].z), new V3(L.path[1].x - 2, 0, L.path[1].z + 2), new V3(L.path[1].x + 2, 0, L.path[1].z + 2));
    w.ground(220, speckleTex(0x2a2a20, [0x1e1e16, 0x3a3428, 0x2a1e1a]), 30);
    w.pathRibbon(L.path, 4, speckleTex(0x5a5048, [0x4a4038, 0x6a6058]));
    const graveM = w.mats.grave;
    const candle = new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false });
    candle.color.multiplyScalar(2.5);
    for (let i = 0; i < 420; i++) {
      const x = w.r(-45, 45), z = w.r(-66, 66);
      const d = w.distToPath(x, z, L.path);
      if (d < 3.2) continue;
      const ry = w.r(-0.25, 0.25), tilt = w.r(-0.15, 0.15);
      if (w.rng() < 0.65) {
        w.instance('stone', geoCache('stone', () => new THREE.BoxGeometry(0.8, 1.1, 0.2)), graveM, x, 0.5, z, { ry, rz: tilt });
        w.instance('stonetop', geoCache('stonetop', () => new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12, 1, false, 0, Math.PI)), graveM, x, 1.05, z, { rx: Math.PI / 2, ry, rz: tilt + Math.PI / 2 });
      } else {
        w.instance('crossV', geoCache('crossV', () => new THREE.BoxGeometry(0.18, 1.5, 0.18)), graveM, x, 0.75, z, { ry, rz: tilt });
        w.instance('crossH', geoCache('crossH', () => new THREE.BoxGeometry(0.8, 0.18, 0.18)), graveM, x, 1.1, z, { ry, rz: tilt });
      }
      if (d < 10) w.collider(x - 0.45, 0, z - 0.25, x + 0.45, 1.3, z + 0.25);
      if (w.rng() < 0.12) w.instance('candle', geoCache('candle', () => new THREE.CylinderGeometry(0.05, 0.05, 0.25, 6)), candle, x + 0.3, 0.12, z + 0.35, { cast: false });
    }
    for (let i = 0; i < 40; i++) {
      const x = w.r(-45, 45), z = w.r(-66, 66);
      const d = w.distToPath(x, z, L.path);
      if (d < 5) continue;
      w.tree(x, z, w.r(1, 1.6), 'dead', d < 10);
    }
    for (const [zf, side] of [[0.25, 1], [0.55, -1], [0.8, 1]]) {
      const p = L.path[Math.floor(zf * L.path.length)];
      const x = p.x + side * 9;
      w.box(x, 0, p.z, 5, 4, 6, std(0x5a5650, 0.9));
      w.mesh(geoCache('roof4', () => new THREE.ConeGeometry(1, 1, 4, 1)), std(0x3a3632, 0.9, 0, { flatShading: true }), x, 5, p.z, { ry: Math.PI / 4, s: [4.6, 2, 4.6] });
    }
    for (let i = 6; i < L.path.length - 4; i += 12) {
      const p = L.path[i];
      w.torch(p.x - 2.8, p.z, 1.8, i % 24 === 6);
    }
    for (const f of [0.18, 0.38, 0.58, 0.78]) {
      const p = L.path[Math.floor(f * L.path.length)];
      L.pickups.push({ type: f === 0.38 || f === 0.78 ? 'med' : 'ammo', x: p.x + 1.2, z: p.z });
    }
  },

  desert(w) {
    const L = w.layout;
    L.bounds = { minX: -33, maxX: 33, minZ: -43, maxZ: 43 };
    battleSpawns(L, 35, -35, 10);
    L.gate = { x: 0, z: -41, yaw: 0 };
    w.ground(260, speckleTex(0xd2a868, [0xc09058, 0xe0b878, 0xb8884a]), 30);
    const sand = std(0xd0a468, 1, 0, { flatShading: true });
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2, r = w.r(55, 80);
      w.mesh(geoCache('dune', () => new THREE.SphereGeometry(1, 12, 8)), sand, Math.cos(a) * r, -2, Math.sin(a) * r, { s: [w.r(14, 26), w.r(5, 10), w.r(14, 26)], cast: false });
    }
    const ss = w.mats.sandstone;
    // ruins
    const ruins = [[-14, 10, 8, 0], [12, -6, 9, 1], [-6, -18, 7, 1], [10, 20, 6, 0], [-16, -30, 6, 0], [16, -26, 6, 1], [0, 2, 5, 1]];
    for (const [x, z, len, vertical] of ruins) {
      const h = w.r(1.6, 3.4);
      if (vertical) w.box(x, 0, z, 0.9, h, len, ss); else w.box(x, 0, z, len, h, 0.9, ss);
      w.box(x + w.r(-2, 2), 0, z + w.r(-2, 2), 1.2, 0.7, 1.2, ss, { rotY: w.r(0, 1) });
    }
    for (const [x, z] of [[-6, 14], [6, 14], [-6, -8], [6, -8]]) {
      const h = w.r(3, 6);
      w.mesh(geoCache('pillar', () => new THREE.CylinderGeometry(0.55, 0.65, 1, 12)), ss, x, h / 2, z, { s: [1, h, 1] });
      w.collider(x - 0.6, 0, z - 0.6, x + 0.6, h, z + 0.6);
    }
    w.mesh(geoCache('pillar', () => new THREE.CylinderGeometry(0.55, 0.65, 1, 12)), ss, -20, 0.55, 2, { s: [1, 6, 1], rz: Math.PI / 2 });
    w.collider(-23, 0, 1.4, -17, 1.1, 2.6);
    for (let i = 0; i < 18; i++) {
      const x = w.r(-30, 30), z = w.r(-38, 38);
      if (!farFromSpawns(L, x, z)) continue;
      if (w.rng() < 0.5) w.rock(x, z, w.r(0.8, 1.8), ss);
      else {
        w.instance('cactus', geoCache('cactus', () => new THREE.CapsuleGeometry(0.28, 2.2, 4, 8)), w.mats.cactus, x, 1.4, z);
        w.instance('cactusArm', geoCache('cactusArm', () => new THREE.CapsuleGeometry(0.18, 0.8, 4, 8)), w.mats.cactus, x + 0.45, 1.9, z, { rz: -0.4 });
        w.collider(x - 0.35, 0, z - 0.35, x + 0.35, 2.6, z + 0.35);
      }
    }
    for (const [x, z, c] of [[-24, 24, 0xb03a2a], [24, 30, 0x2a5ab0], [-25, -14, 0xe0c040]]) {
      w.mesh(geoCache('tent', () => new THREE.ConeGeometry(2.6, 3, 6)), std(c, 0.9, 0, { flatShading: true }), x, 1.5, z);
      w.collider(x - 2, 0, z - 2, x + 2, 2.5, z + 2);
    }
    for (const [x, z] of [[-3, 24], [5, -30], [20, 6], [-22, -2]]) w.crate(x, z, 1.2, 1, w.r(0, 1));
    L.pickups.push({ type: 'med', x: -20, z: 14 }, { type: 'med', x: 20, z: -16 }, { type: 'ammo', x: 0, z: -4 }, { type: 'ammo', x: -10, z: -26 }, { type: 'ammo', x: 12, z: 26 }, { type: 'ammo', x: 22, z: -36 });
  },

  ice(w) {
    const L = w.layout;
    const fn = (z) => 14 * Math.sin(z * 0.04) + 5 * Math.sin(z * 0.1);
    L.path = w.smoothPath(fn, 66, -66, 66);
    L.pathLimit = 13;
    L.bounds = { minX: -60, maxX: 60, minZ: -74, maxZ: 74 };
    const end = L.path[L.path.length - 1];
    L.gate = { x: end.x, z: end.z - 2, yaw: 0 };
    L.spawnA.push(new V3(L.path[1].x, 0, L.path[1].z), new V3(L.path[1].x - 2, 0, L.path[1].z + 2), new V3(L.path[1].x + 2, 0, L.path[1].z + 2));
    w.ground(260, speckleTex(0xf2f6fa, [0xe2eaf2, 0xffffff, 0xd8e4ee]), 30);
    const iceTex = canvasTex(512, (g, s) => {
      g.fillStyle = '#9fd0ea'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 120; i++) {
        g.strokeStyle = `rgba(255,255,255,${0.2 + Math.random() * 0.5})`;
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 80; y += (Math.random() - 0.5) * 80; g.lineTo(x, y); }
        g.stroke();
      }
    });
    iceTex.repeat.set(10, 12);
    const lake = new THREE.Mesh(new THREE.PlaneGeometry(90, 140), std(0xffffff, 0.08, 0.35, { map: iceTex }));
    lake.rotation.x = -Math.PI / 2;
    lake.position.y = 0.02;
    lake.receiveShadow = true;
    w.scene.add(lake);
    for (let i = 0; i < 200; i++) {
      const x = w.r(-58, 58), z = w.r(-72, 72);
      if (Math.abs(x) < 44 && Math.abs(z) < 69) continue;
      w.tree(x, z, w.r(1, 1.7), 'snowpine', false);
    }
    const crystal = new THREE.MeshStandardMaterial({ color: 0x9feaff, emissive: 0x3ac8ff, emissiveIntensity: 1.2, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85, flatShading: true });
    for (let i = 0; i < 50; i++) {
      const p = L.path[(w.rng() * L.path.length) | 0];
      const a = w.r(0, 6.28), r = w.r(5, 12);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
      const h = w.r(1.2, 3.5);
      w.instance('crystal', geoCache('crystal', () => new THREE.OctahedronGeometry(0.6, 0)), crystal, x, h * 0.4, z, { sy: h, ry: w.r(0, 3), rz: w.r(-0.3, 0.3) });
      if (h > 2) w.collider(x - 0.45, 0, z - 0.45, x + 0.45, h, z + 0.45);
    }
    for (let i = 4; i < L.path.length - 3; i += 8) {
      const p = L.path[i];
      w.mesh(geoCache('flagpole', () => new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6)), w.mats.darkMetal, p.x + 3, 1.2, p.z);
      w.mesh(geoCache('flag', () => new THREE.PlaneGeometry(0.8, 0.5)), std(0xff3a3a, 0.8, 0, { side: THREE.DoubleSide }), p.x + 3.4, 2.1, p.z, { cast: false });
    }
    // snowmen for fun
    for (const f of [0.3, 0.7]) {
      const p = L.path[Math.floor(f * L.path.length)];
      const x = p.x - 5, z = p.z;
      w.mesh(geoCache('sm1', () => new THREE.SphereGeometry(0.7, 16, 12)), w.mats.snow, x, 0.6, z);
      w.mesh(geoCache('sm2', () => new THREE.SphereGeometry(0.5, 16, 12)), w.mats.snow, x, 1.5, z);
      w.mesh(geoCache('sm3', () => new THREE.SphereGeometry(0.34, 16, 12)), w.mats.snow, x, 2.2, z);
      w.mesh(geoCache('nose', () => new THREE.ConeGeometry(0.07, 0.35, 8)), std(0xff7a1a, 0.6), x, 2.2, z + 0.4, { rx: Math.PI / 2 });
      w.collider(x - 0.7, 0, z - 0.7, x + 0.7, 2.5, z + 0.7);
    }
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const p = L.path[Math.floor(f * L.path.length)];
      L.pickups.push({ type: f === 0.4 || f === 0.8 ? 'med' : 'ammo', x: p.x + 1.4, z: p.z });
    }
  },

  volcano(w) {
    const L = w.layout;
    L.bounds = { minX: -31, maxX: 31, minZ: -41, maxZ: 41 };
    battleSpawns(L, 33, -33, 10);
    L.gate = { x: 0, z: -39.5, yaw: 0 };
    w.ground(260, speckleTex(0x2a2220, [0x1a1412, 0x3a2e28, 0x4a1a0a]), 30);
    // lava river with three stone bridges
    const bridgesX = [-18, 0, 18];
    let x0 = -40;
    for (const bx of bridgesX) { w.lavaRect(x0, bx - 2.2, -2.5, 2.5); x0 = bx + 2.2; }
    w.lavaRect(x0, 40, -2.5, 2.5);
    for (const bx of bridgesX) {
      w.box(bx, 0, 0, 4.4, 0.12, 6.2, std(0x3a3430, 0.9), { collide: false });
      for (const s of [-1, 1]) w.box(bx + s * 2.1, 0, 0, 0.3, 0.6, 6.2, std(0x2a2422, 0.9));
    }
    for (const [x, z, r] of [[-20, 18, 3], [20, -18, 3.4], [-8, -22, 2.4], [12, 14, 2.6], [-24, -12, 2.2], [24, 26, 2.2]]) w.lavaPool(x, z, r);
    for (let i = 0; i < 26; i++) {
      const x = w.r(-29, 29), z = w.r(-38, 38);
      if (!farFromSpawns(L, x, z) || Math.abs(z) < 4) continue;
      let bad = false;
      for (const h of L.hazards) if (h.shape === 'circle' && Math.hypot(h.x - x, h.z - z) < h.r + 2) bad = true;
      if (bad) continue;
      w.rock(x, z, w.r(0.9, 2), w.mats.darkRock);
    }
    const obs = std(0x120c18, 0.15, 0.6, { flatShading: true });
    for (const [x, z] of [[-10, 10], [10, -10], [-14, -30], [14, 30], [0, 18], [0, -16]]) {
      const h = w.r(2.5, 4.5);
      w.mesh(geoCache('spike', () => new THREE.ConeGeometry(0.9, 1, 5)), obs, x, h / 2, z, { s: [1, h, 1], ry: w.r(0, 3) });
      w.collider(x - 0.7, 0, z - 0.7, x + 0.7, h, z + 0.7);
    }
    // the volcano in the distance
    const volc = w.mesh(new THREE.CylinderGeometry(14, 70, 60, 24, 1, true), std(0x1e1614, 0.95, 0, { flatShading: true }), 0, 30, -150, { cast: false });
    void volc;
    const crater = w.mesh(new THREE.CircleGeometry(14, 24), new THREE.ShaderMaterial({ vertexShader: UV_VS, fragmentShader: LAVA_FS, uniforms: { time: { value: 0 } } }), 0, 59.5, -150, { rx: -Math.PI / 2, cast: false });
    w.updaters.push((dt, t) => { crater.material.uniforms.time.value = t; });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xff5a1a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.position.set(0, 66, -150);
    glow.scale.setScalar(80);
    w.scene.add(glow);
    const lavaLight = new THREE.PointLight(0xff5a1a, 120, 40, 1.5);
    lavaLight.position.set(0, 3, 0);
    w.scene.add(lavaLight);
    for (const [x, z] of [[-6, 26], [6, -26], [-22, 4]]) w.crate(x, z, 1.2, 1);
    L.pickups.push({ type: 'med', x: -14, z: 22 }, { type: 'med', x: 16, z: -24 }, { type: 'ammo', x: 4, z: 8 }, { type: 'ammo', x: -4, z: -8 }, { type: 'ammo', x: 24, z: 10 }, { type: 'med', x: -26, z: -26 });
  },

  temple(w) {
    const L = w.layout;
    L.bounds = { minX: -33, maxX: 33, minZ: -33, maxZ: 33 };
    L.circleLimit = 31;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 2 + (i - 3.5) * 0.16;
      L.spawnA.push(new V3(Math.cos(a) * 25, 0, Math.sin(a) * 25));
    }
    L.gate = { x: 0, z: -28.5, yaw: 0 };
    w.ground(260, speckleTex(0x2a2430, [0x1e1a24, 0x3a3240]), 30);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(33, 64), std(0xffffff, 0.45, 0.15, { map: tilesTex('#7a7068', '#4a4038', 4) }));
    floor.material.map.repeat.set(12, 12);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    w.scene.add(floor);
    const pillarM = std(0x9a8a78, 0.75);
    const goldM = std(0xd8a838, 0.3, 0.85);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const x = Math.cos(a) * 32, z = Math.sin(a) * 32;
      if (Math.abs(x) < 4 && z < 0) continue;
      w.mesh(geoCache('tpillar', () => new THREE.CylinderGeometry(0.9, 1.1, 9, 12)), pillarM, x, 4.5, z);
      w.mesh(geoCache('tcap', () => new THREE.BoxGeometry(2.6, 0.6, 2.6)), goldM, x, 9.2, z, { ry: -a });
      w.collider(x - 1, 0, z - 1, x + 1, 9, z + 1);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const x = Math.cos(a) * 15, z = Math.sin(a) * 15;
      const h = i % 3 === 0 ? 2.5 : 6;
      w.mesh(geoCache('ipillar', () => new THREE.CylinderGeometry(0.7, 0.8, 1, 10)), pillarM, x, h / 2, z, { s: [1, h, 1] });
      w.collider(x - 0.8, 0, z - 0.8, x + 0.8, h, z + 0.8);
    }
    // central altar with ancestor's lamp
    w.box(0, 0, 0, 5, 0.8, 5, std(0x5a4a3a, 0.8));
    w.box(0, 0.8, 0, 3, 0.5, 3, goldM);
    w.mesh(new THREE.TorusKnotGeometry(0.6, 0.18, 80, 10), new THREE.MeshStandardMaterial({ color: 0xc58cff, emissive: 0xa060ff, emissiveIntensity: 2, roughness: 0.2, metalness: 0.5 }), 0, 2.5, 0);
    // elephant-ish guardian statues (stylized)
    for (const [x, z] of [[-10, -20], [10, -20], [-20, 6], [20, 6]]) {
      w.box(x, 0, z, 2.2, 1, 2.2, std(0x5a5048, 0.8));
      w.mesh(geoCache('statueBody', () => new THREE.SphereGeometry(1.1, 12, 10)), std(0x6a6058, 0.7, 0, { flatShading: true }), x, 2.1, z, { s: [1, 1.2, 1] });
      w.mesh(geoCache('statueHead', () => new THREE.SphereGeometry(0.7, 12, 10)), std(0x6a6058, 0.7, 0, { flatShading: true }), x, 3.6, z);
      w.mesh(geoCache('statueCrown', () => new THREE.ConeGeometry(0.5, 1, 6)), goldM, x, 4.6, z);
      w.collider(x - 1.1, 0, z - 1.1, x + 1.1, 4.5, z + 1.1);
    }
    const torches = [[-6, -26], [6, -26], [-24, -14], [24, -14], [-24, 14], [24, 14], [-8, 26], [8, 26]];
    torches.forEach(([x, z], i) => w.torch(x, z, 2.4, i % 2 === 0));
    for (const [x, z] of [[-8, 8], [8, 8], [-4, 18], [4, 18], [-14, -6], [14, -6]]) w.crate(x, z, 1.1, 1);
    L.pickups.push({ type: 'med', x: -18, z: 18 }, { type: 'med', x: 18, z: 18 }, { type: 'med', x: 0, z: 24 }, { type: 'ammo', x: -22, z: -2 }, { type: 'ammo', x: 22, z: -2 }, { type: 'ammo', x: -10, z: 22 }, { type: 'ammo', x: 10, z: 22 });
  },
};

export function buildEnvironment(world, theme) {
  BUILDERS[theme](world);
  world.finalize();
  return world.layout;
}
