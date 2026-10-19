import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { FX, Weather, getGlowTexture } from './fx.js';
import { buildHumanoid, animateHumanoid, buildGhost, animateGhost, LOOKS, SKIN } from './characters.js';
import { World, buildEnvironment, buildGate, buildKeyCard, buildPickup } from './world.js';
import { LEVELS, NAMES } from './levels.js';
import { resolveCircle, supportHeight, rayBoxes, raySphere, segDist2D, clamp } from './physics.js';

const V3 = THREE.Vector3;
const TEAM_COLOR = { parents: 0xff8a2a, sons: 0x2ab8ff };
const TEAM_CSS = { parents: '#ff8a2a', sons: '#2ab8ff' };
const GHOST_COLORS = [0x7fe7ff, 0x8affc8, 0xb48cff, 0x7fb8ff];
const $ = (id) => document.getElementById(id);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

function makeLabel(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = '800 34px Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 6;
  g.strokeStyle = 'rgba(0,0,0,0.75)';
  g.strokeText(text, 128, 32);
  g.fillStyle = color;
  g.fillText(text, 128, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  s.scale.set(1.5, 0.375, 1);
  return s;
}

class Fighter {
  constructor(game, o) {
    this.game = game;
    this.team = o.team;
    this.kind = o.kind;
    this.name = o.name;
    this.isPlayer = !!o.isPlayer;
    this.ally = !!o.ally;
    this.pos = o.pos.clone();
    this.vel = new V3();
    this.vy = 0;
    this.grounded = true;
    this.yaw = o.yaw || 0;
    this.pitch = 0;
    this.maxHp = this.hp = o.hp;
    this.alive = true;
    const looks = LOOKS[o.kind];
    this.model = buildHumanoid({
      kind: o.kind, look: looks[(o.lookIdx || 0) % looks.length], skin: SKIN[(o.skinIdx || 0) % SKIN.length],
      teamColor: TEAM_COLOR[o.colorTeam || o.team],
    });
    this.scale = this.model.userData.scale;
    this.height = 1.75 * this.scale;
    this.radius = 0.38;
    this.speed = o.kind === 'son' ? 5.0 : 4.6;
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    game.scene.add(this.model);
    this.animT = Math.random() * 10;
    this.deadT = 0;
    this.hasCard = false;
    this.keyTeam = null;
    this.thief = false;
    this.fireCd = rand(0.8, 2);
    this.burst = 0;
    this.thinkT = rand(0, 0.4);
    this.repathT = 0;
    this.target = null;
    this.dest = null;
    this.los = false;
    this.stuckT = 0;
    this.lastCheck = this.pos.clone();
    this.frozenT = 0;
    this.lavaT = 0;
    this.removed = false;
    if (!this.isPlayer) {
      this.label = makeLabel(o.name, this.ally ? '#8affc0' : '#ff7070');
      game.scene.add(this.label);
    }
  }
  chest(out = new V3()) { return out.set(this.pos.x, this.pos.y + 1.22 * this.scale, this.pos.z); }
  hips(out = new V3()) { return out.set(this.pos.x, this.pos.y + 0.62 * this.scale, this.pos.z); }
  head(out = new V3()) { return out.set(this.pos.x, this.pos.y + 1.7 * this.scale, this.pos.z); }
  muzzle(out = new V3()) { this.model.userData.parts.muzzle.getWorldPosition(out); return out; }
}

class Game {
  constructor() {
    this.canvas = $('c');
    this.input = new Input(this.canvas);
    if (this.input.isTouch) document.body.classList.add('touch');
    this.audio = new GameAudio();
    this.settings = Object.assign({ quality: this.input.isTouch ? 'medium' : 'high', sens: 1, sound: true }, store.get('fw3d_settings', {}));
    this.progress = Object.assign({ unlocked: 1, team: 'sons', best: {} }, store.get('fw3d_progress', {}));
    this.audio.setEnabled(this.settings.sound);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.1, 900);
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.time = 0;
    this.state = 'loading';
    this.yaw = 0;
    this.pitch = 0;
    this.deadCarry = 6;
    this.tmp = { a: new V3(), b: new V3(), c: new V3(), d: new V3() };

    this.applyQuality();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onPauseKey = () => {
      if (this.state === 'playing') this.pause();
      // Esc that just released pointer lock already paused us; don't immediately resume
      else if (this.state === 'paused' && performance.now() - this.pausedAt > 400) this.resume();
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (this.state === 'playing') this.pause(); this.audio.suspend(); } else this.audio.resume();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.state === 'playing' && !this.input.isTouch) this.pause();
    });
    window.addEventListener('pointerdown', () => {
      const first = !this.audio.ctx;
      this.audio.init();
      if (first && (this.state === 'menu')) this.audio.startMusic('menu');
    }, { capture: true });
    this.setupUI();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    this.boot();
  }

  async boot() {
    const fill = $('load-fill');
    fill.style.width = '30%';
    await new Promise((r) => setTimeout(r, 60));
    this.buildMenuScene();
    fill.style.width = '100%';
    await new Promise((r) => setTimeout(r, 350));
    this.showScreen('screen-menu');
    this.state = 'menu';
  }

  // ---------- rendering setup ----------
  applyQuality() {
    const q = this.settings.quality;
    const pr = Math.min(window.devicePixelRatio || 1, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    this.setupComposer();
  }

  setupComposer() {
    const q = this.settings.quality;
    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (q === 'low') return;
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: q === 'high' ? 4 : 0 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.7, 0.45, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 80 : 68;
    this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }

  render() {
    if (this.composer) { this.renderPass.scene = this.scene; this.composer.render(); } else this.renderer.render(this.scene, this.camera);
  }

  // ---------- scene lifecycle ----------
  disposeScene() {
    const disposed = new Set();
    this.scene.traverse((o) => {
      if (o.geometry && !disposed.has(o.geometry)) { disposed.add(o.geometry); o.geometry.dispose(); }
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (disposed.has(m)) continue;
        disposed.add(m);
        for (const k of ['map', 'emissiveMap']) if (m[k] && !disposed.has(m[k]) && m[k] !== getGlowTexture()) { disposed.add(m[k]); m[k].dispose(); }
        m.dispose();
      }
    });
    this.scene = new THREE.Scene();
  }

  buildMenuScene() {
    this.disposeScene();
    const world = new World(this.scene, this.settings.quality, 11);
    world.setupAtmosphere('courtyard', this.renderer);
    buildEnvironment(world, 'courtyard');
    this.world = world;
    this.menuChars = [];
    const lineup = [['parents', 'father', 0], ['parents', 'mother', 0], ['parents', 'father', 1], ['parents', 'mother', 1], ['sons', 'son', 0], ['sons', 'son', 1], ['sons', 'son', 2], ['sons', 'son', 3]];
    lineup.forEach(([team, kind, look], i) => {
      const side = team === 'parents' ? -1 : 1;
      const k = i % 4;
      const m = buildHumanoid({ kind, look: LOOKS[kind][look % LOOKS[kind].length], skin: SKIN[(i * 3) % SKIN.length], teamColor: TEAM_COLOR[team] });
      m.position.set((k - 1.5) * 1.6, 0, side * (3.2 + (k % 2) * 0.8) + 12);
      m.rotation.y = side > 0 ? Math.PI : 0;
      this.scene.add(m);
      this.menuChars.push(m);
    });
    this.fx = new FX(this.scene);
  }

  updateMenu(dt) {
    const t = this.time * 0.12;
    this.camera.position.set(Math.sin(t) * 9 + 1, 2.4 + Math.sin(t * 0.7) * 0.4, 12 + Math.cos(t) * 9);
    this.camera.lookAt(0, 1.3, 12);
    this.menuChars.forEach((m, i) => animateHumanoid(m, this.time + i, 0, Math.sin(this.time * 0.8 + i) * 0.1));
    this.world.followCamera(this.camera.position);
    this.world.update(dt, this.time);
  }

  // ---------- levels ----------
  startLevel(idx) {
    this.levelIndex = idx;
    const L = LEVELS[idx];
    this.level = L;
    this.disposeScene();
    if (this.composer) this.renderPass.scene = this.scene;
    const world = new World(this.scene, this.settings.quality, 100 + idx * 7);
    world.setupAtmosphere(L.theme, this.renderer);
    const layout = buildEnvironment(world, L.theme);
    this.world = world;
    this.layout = layout;
    this.colliders = world.colliders;
    this.fx = new FX(this.scene);
    this.weather = L.weather ? new Weather(this.scene, L.weather) : null;

    this.playerTeam = this.progress.team || 'sons';
    this.enemyTeam = this.playerTeam === 'parents' ? 'sons' : 'parents';
    this.fighters = [];
    this.ghosts = [];
    this.orbs = [];
    this.keys = [];
    this.meteors = [];
    this.boss = null;
    this.deadCount = 0;
    this.stats = { kills: 0, shots: 0, hits: 0, time: 0, souls: 0 };
    this.weapon = { mag: 30, magSize: 30, reserve: 150, cd: 0, reloadT: 0, bloom: 0 };
    this.hurtFlash = 0;
    this.godT = 0;
    this.announceT = 0;
    this.feed = [];
    this.endT = 0;
    this.reinforceT = 16;
    this.reinforced = 0;
    this.meteorT = 7;
    this.lightT = 5;
    this.lightFlash = 0;
    this.timer = L.timer || 0;
    this.maxProgress = 0;
    this.checkpoint = 0;
    this.keyDropped = false;
    this.mapT = 0;

    // gate
    const g = layout.gate;
    this.gate = buildGate(this.scene, g.x, g.z, g.yaw);
    this.colliders.push(...this.gate.colliders);
    this.gate.setOpen(L.type === 'ghost');

    // pickups
    this.pickups = layout.pickups.map((p) => buildPickup(this.scene, p.type, p.x, p.z));

    // lights that must exist for the whole level (adding lights later forces shader recompiles)
    this.muzzleLight = new THREE.PointLight(0xffc070, 0, 9, 2);
    this.scene.add(this.muzzleLight);
    this.keyLight = new THREE.PointLight(0xffb020, 0, 14, 1.6);
    this.scene.add(this.keyLight);
    if (L.flashlight) {
      this.flashlight = new THREE.SpotLight(0xfff4dc, 140, 45, 0.42, 0.55, 1.4);
      this.scene.add(this.flashlight);
      this.scene.add(this.flashlight.target);
    } else this.flashlight = null;

    // teams
    const myNames = NAMES[this.playerTeam], enemyNames = NAMES[this.enemyTeam];
    const playerKind = this.playerTeam === 'parents' ? 'father' : 'son';
    const spawnA = layout.spawnA;
    this.player = new Fighter(this, {
      team: this.playerTeam, kind: playerKind, name: 'You', isPlayer: true, pos: spawnA[0], hp: this.playerTeam === 'parents' ? 110 : 100, yaw: Math.PI, skinIdx: 2,
    });
    this.player.speed = this.playerTeam === 'parents' ? 5.8 : 6.3;
    this.fighters.push(this.player);
    this.yaw = Math.PI;
    this.pitch = 0;
    if (L.type === 'boss') {
      // final level: both families fight side by side
      const crew = [['parents', 'father', 'Appa'], ['parents', 'mother', 'Amma'], ['sons', 'son', 'Arun'], ['sons', 'son', 'Karthik']];
      crew.slice(0, L.allies).forEach(([team, kind, name], i) => {
        this.fighters.push(new Fighter(this, { team: this.playerTeam, colorTeam: team, kind, name, ally: true, pos: spawnA[i + 1], hp: 160, yaw: Math.PI, lookIdx: i, skinIdx: i }));
      });
    } else {
      for (let i = 0; i < L.allies; i++) {
        const [kind, name] = myNames[(i + 1) % myNames.length];
        this.fighters.push(new Fighter(this, { team: this.playerTeam, kind, name, ally: true, pos: spawnA[i + 1] || spawnA[0], hp: L.type === 'ghost' ? 150 : 100, yaw: Math.PI, lookIdx: i, skinIdx: i + 1 }));
      }
    }
    if (L.type === 'battle') {
      for (let i = 0; i < L.enemies; i++) this.spawnEnemy(layout.spawnB[i % layout.spawnB.length], enemyNames[i % enemyNames.length], i);
      const enemies = this.fighters.filter((f) => f.team === this.enemyTeam);
      const carrier = enemies[(Math.random() * enemies.length) | 0];
      carrier.hasCard = true;
      carrier.keyTeam = this.enemyTeam;
      const allies = this.fighters.filter((f) => f.ally);
      if (allies.length) {
        const ac = allies[(Math.random() * allies.length) | 0];
        ac.hasCard = true;
        ac.keyTeam = this.playerTeam;
      }
    }
    if (L.type === 'ghost') {
      const total = clamp(6 + this.deadCarry * 2 + idx, 10, 28);
      this.ghostPlan = { total, spawned: 0, waves: [0.0, 0.2, 0.4, 0.6, 0.8], waveIdx: 0 };
      this.pathInfo = this.precomputePath(layout.path);
    }
    if (L.type === 'boss') this.spawnBoss();

    this.input.reset();
    this.showHUD(false);
    this.updateHUDStatic();
    $('intro-num').textContent = `LEVEL ${L.id} / 10`;
    $('intro-name').textContent = L.name;
    $('intro-sub').textContent = L.sub;
    $('intro-story').textContent = L.story;
    $('intro-tip').textContent = L.tip;
    this.showScreen('overlay-intro');
    this.state = 'intro';
    this.introT = 0;
  }

  spawnEnemy(pos, nameKind, i) {
    const [kind, name] = nameKind;
    const L = this.level;
    const f = new Fighter(this, {
      team: this.enemyTeam, kind, name, pos: new V3(pos.x + rand(-1, 1), 0, pos.z + rand(-1, 1)), hp: L.enemyHp || 100, yaw: 0, lookIdx: i, skinIdx: i + 2,
    });
    if (this.flashlight) {
      // brighter armbands in the dark; clone so the shared cached material is untouched
      f.model.traverse((o) => {
        if (o.material && o.material.emissive && o.material.emissiveIntensity > 0.5) { o.material = o.material.clone(); o.material.emissiveIntensity = 2.5; }
      });
    }
    this.fighters.push(f);
    return f;
  }

  beginPlay() {
    this.hideScreens();
    this.showHUD(true);
    this.state = 'playing';
    this.input.enabled = true;
    this.input.reset();
    this.audio.init();
    this.audio.startMusic(this.level.music);
    if (!this.input.isTouch && this.canvas.requestPointerLock) this.canvas.requestPointerLock();
    $('touch').classList.remove('played');
    clearTimeout(this._hintT);
    this._hintT = setTimeout(() => $('touch').classList.add('played'), 7000);
    const L = this.level;
    if (L.type === 'battle') this.announce(`LEVEL ${L.id}: ${L.name.toUpperCase()}`, 'One of them hides the KEY CARD...');
    else if (L.type === 'ghost') this.announce('THE SOULS ARE COMING', `${this.ghostPlan.total} aathmas return from the fallen`);
    else this.announce('THE ANCESTOR AWAKENS', 'Parents and sons - fight together!');
  }

  // ---------- path helpers ----------
  precomputePath(path) {
    const segs = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
      segs.push({ a: path[i], b: path[i + 1], len, start: total });
      total += len;
    }
    return { segs, total };
  }

  nearestOnPath(x, z) {
    let best = { d: Infinity, along: 0, qx: x, qz: z, i: 0 };
    for (let i = 0; i < this.pathInfo.segs.length; i++) {
      const s = this.pathInfo.segs[i];
      const r = segDist2D(x, z, s.a.x, s.a.z, s.b.x, s.b.z);
      if (r.d < best.d) best = { d: r.d, along: s.start + r.t * s.len, qx: r.qx, qz: r.qz, i };
    }
    return best;
  }

  pointAlongPath(dist) {
    const segs = this.pathInfo.segs;
    dist = clamp(dist, 0, this.pathInfo.total);
    for (const s of segs) {
      if (dist <= s.start + s.len) {
        const t = (dist - s.start) / (s.len || 1);
        return new V3(s.a.x + (s.b.x - s.a.x) * t, 0, s.a.z + (s.b.z - s.a.z) * t);
      }
    }
    const last = segs[segs.length - 1].b;
    return new V3(last.x, 0, last.z);
  }

  onWalk(x, z) {
    const w = this.layout.walk;
    for (const c of w.circles) if (Math.hypot(x - c.x, z - c.z) < c.r) return true;
    for (const s of w.segs) if (segDist2D(x, z, s.ax, s.az, s.bx, s.bz).d < s.hw) return true;
    return false;
  }

  inHazard(x, z) {
    for (const h of this.layout.hazards) {
      if (h.shape === 'circle') { if (Math.hypot(x - h.x, z - h.z) < h.r) return true; }
      else if (x > h.minX && x < h.maxX && z > h.minZ && z < h.maxZ) return true;
    }
    return false;
  }

  hasLOS(a, b) {
    const d = this.tmp.d.subVectors(b, a);
    const dist = d.length();
    if (dist < 0.01) return true;
    d.divideScalar(dist);
    return rayBoxes(a, d, dist, this.colliders) >= dist - 0.15;
  }

  // ---------- movement ----------
  moveBody(f, dt) {
    const p = f.pos;
    p.x += f.vel.x * dt;
    p.z += f.vel.z * dt;
    resolveCircle(p, f.radius, f.height, this.colliders);
    const b = this.layout.bounds;
    p.x = clamp(p.x, b.minX, b.maxX);
    p.z = clamp(p.z, b.minZ, b.maxZ);
    if (this.layout.circleLimit) {
      const r = Math.hypot(p.x, p.z), lim = this.layout.circleLimit;
      if (r > lim) { p.x *= lim / r; p.z *= lim / r; }
    }
    if (this.layout.pathLimit && this.pathInfo) {
      const n = this.nearestOnPath(p.x, p.z);
      const lim = this.layout.pathLimit;
      if (n.d > lim) { p.x = n.qx + (p.x - n.qx) * (lim / n.d); p.z = n.qz + (p.z - n.qz) * (lim / n.d); }
    }
    f.vy -= 22 * dt;
    p.y += f.vy * dt;
    let ground = this.layout.walk ? (this.onWalk(p.x, p.z) ? 0 : -Infinity) : 0;
    const sup = supportHeight(p.x, p.z, f.radius, p.y, this.colliders);
    if (sup > ground) ground = sup;
    if (p.y <= ground && f.vy <= 0) { p.y = ground; f.vy = 0; f.grounded = true; }
    else f.grounded = p.y - ground < 0.06;
  }

  // ---------- player ----------
  updatePlayer(dt) {
    const P = this.player;
    const inp = this.input;
    const [dx, dy] = inp.consumeLook();
    const sens = 0.0024 * this.settings.sens;
    this.yaw -= dx * sens;
    this.pitch = clamp(this.pitch - dy * sens, -0.75, 0.95);
    if (!P.alive) return;

    const m = inp.move();
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = sy * m.y - cy * m.x, wz = cy * m.y + sy * m.x;
    const sprint = inp.sprint && m.y > 0.3;
    let speed = P.speed * (sprint ? 1.4 : 1);
    if (P.frozenT > 0) { P.frozenT -= dt; speed *= 0.35; }
    wx *= speed; wz *= speed;
    const accel = this.level.ice ? 1.6 : 14;
    const k = 1 - Math.exp(-accel * dt);
    P.vel.x += (wx - P.vel.x) * k;
    P.vel.z += (wz - P.vel.z) * k;
    if (inp.consumeJump() && P.grounded) { P.vy = 7.2; P.grounded = false; }
    this.moveBody(P, dt);
    P.yaw = this.yaw;
    P.pitch = this.pitch;

    // fell off the bridge
    if (P.pos.y < -14) {
      const cp = this.layout.walk.circles[this.checkpoint];
      P.pos.set(cp.x, 0.5, cp.z);
      P.vel.set(0, 0, 0);
      P.vy = 0;
      this.godT = 1.5;
      this.damageFighter(P, 20, null);
      if (P.alive) this.announce('YOU FELL!', 'Back to the last island');
    }
    if (this.layout.walk && P.grounded) {
      this.layout.walk.circles.forEach((c, i) => { if (i > this.checkpoint && Math.hypot(P.pos.x - c.x, P.pos.z - c.z) < c.r) this.checkpoint = i; });
    }

    // weapon
    const W = this.weapon;
    W.cd -= dt;
    W.bloom = Math.max(0, W.bloom - dt * 2.2);
    if (W.reloadT > 0) {
      W.reloadT -= dt;
      if (W.reloadT <= 0) {
        const need = W.magSize - W.mag, take = Math.min(need, W.reserve);
        W.mag += take;
        W.reserve -= take;
      }
    } else if ((inp.consumeReload() && W.mag < W.magSize && W.reserve > 0) || (W.mag === 0 && W.reserve > 0)) {
      W.reloadT = 1.4;
      this.audio.reload();
    }
    if (inp.fire && !sprint && W.reloadT <= 0 && W.cd <= 0) {
      if (W.mag > 0) this.playerShoot();
      else { W.cd = 0.3; this.audio.empty(); }
    }
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 400);

    // pickups
    for (const pk of this.pickups) {
      if (pk.taken) continue;
      if (Math.hypot(pk.pos.x - P.pos.x, pk.pos.z - P.pos.z) < 1.3) {
        if (pk.type === 'med' && P.hp >= P.maxHp) continue;
        pk.taken = true;
        pk.group.visible = false;
        if (pk.type === 'med') { P.hp = Math.min(P.maxHp, P.hp + 45); this.toast('+45 HEALTH'); }
        else { W.reserve = Math.min(300, W.reserve + 60); this.toast('+60 AMMO'); }
        this.audio.pickup();
      }
    }

    // key cards
    for (let i = this.keys.length - 1; i >= 0; i--) {
      const kc = this.keys[i];
      if (Math.hypot(kc.pos.x - P.pos.x, kc.pos.z - P.pos.z) > 1.5) continue;
      this.removeKey(i);
      if (kc.fake) {
        this.explosion(kc.pos.clone().setY(0.6), 2.5, 14, false);
        this.audio.fake();
        this.announce('FAKE KEY CARD!', 'It exploded - find the real one');
      } else if (kc.keyTeam === this.playerTeam) {
        this.audio.pickup();
        this.announce('TEAM KEY SECURED', 'The enemy cannot steal it now');
      } else {
        P.hasCard = true;
        this.gate.setOpen(true);
        this.audio.key();
        this.announce('KEY CARD ACQUIRED!', 'Run to the glowing gate!');
        if (this.level.decoys) for (let j = this.keys.length - 1; j >= 0; j--) if (this.keys[j].fake) this.removeKey(j);
      }
    }

    // lava
    if (P.grounded && this.inHazard(P.pos.x, P.pos.z)) {
      P.lavaT -= dt;
      if (P.lavaT <= 0) { P.lavaT = 0.25; this.damageFighter(P, 8, null); this.fx.burst(P.pos.clone().setY(0.2), 0xff7a1a, 6, 3, 0.1, 4, 0.5); }
    }

    // gate
    if (this.gate.open && Math.hypot(this.gate.pos.x - P.pos.x, this.gate.pos.z - P.pos.z) < 2.3) this.levelComplete();
  }

  playerShoot() {
    const W = this.weapon;
    const P = this.player;
    W.cd = 0.105;
    W.mag--;
    this.stats.shots++;
    const moving = Math.hypot(P.vel.x, P.vel.z) > 1;
    const spread = 0.005 + W.bloom * 0.022 + (moving ? 0.012 : 0) + (P.grounded ? 0 : 0.03);
    W.bloom = Math.min(1, W.bloom + 0.22);
    const cam = this.camera;
    const dir = new V3();
    cam.getWorldDirection(dir);
    const right = new V3().crossVectors(dir, cam.up).normalize();
    const up = new V3().crossVectors(right, dir).normalize();
    dir.addScaledVector(right, (Math.random() - 0.5) * 2 * spread).addScaledVector(up, (Math.random() - 0.5) * 2 * spread).normalize();
    const o = cam.position.clone();
    const minT = o.distanceTo(P.chest(this.tmp.a)) * 0.6;
    let best = rayBoxes(o, dir, 140, this.colliders);
    let hit = null, head = false;
    if (!this.layout.noGround && dir.y < 0) { const tg = -o.y / dir.y; if (tg < best) best = tg; }
    const consider = (t, target, isHead) => { if (t > minT && t < best) { best = t; hit = target; head = isHead; } };
    for (const f of this.fighters) {
      if (!f.alive || f.team === this.playerTeam) continue;
      consider(raySphere(o, dir, f.head(this.tmp.a), 0.19 * f.scale), f, true);
      consider(raySphere(o, dir, f.chest(this.tmp.a), 0.34 * f.scale), f, false);
      consider(raySphere(o, dir, f.hips(this.tmp.a), 0.3 * f.scale), f, false);
    }
    for (const g of this.ghosts) {
      if (!g.alive) continue;
      const s = g.scale;
      consider(raySphere(o, dir, this.tmp.a.set(g.pos.x, g.pos.y + 0.72 * s, g.pos.z), 0.24 * s), g, true);
      consider(raySphere(o, dir, this.tmp.a.set(g.pos.x, g.pos.y + 0.4 * s, g.pos.z), 0.5 * s), g, false);
    }
    if (this.boss && this.boss.alive) {
      const b = this.boss, s = b.scale;
      consider(raySphere(o, dir, this.tmp.a.set(b.pos.x, b.pos.y + 0.75 * s, b.pos.z), 0.28 * s), b, true);
      consider(raySphere(o, dir, this.tmp.a.set(b.pos.x, b.pos.y + 0.35 * s, b.pos.z), 0.55 * s), b, false);
    }
    const end = o.clone().addScaledVector(dir, Math.min(best, 140));
    const muzzle = P.muzzle(this.tmp.b).clone();
    this.fx.tracer(muzzle, end);
    this.fx.flash(muzzle, 0.7, 0xffc870, 0.05);
    this.muzzleLight.position.copy(muzzle);
    this.muzzleLight.intensity = 18;
    this.audio.shot();
    this.pitch = Math.min(0.95, this.pitch + 0.009);
    this.yaw += (Math.random() - 0.5) * 0.006;
    if (hit) {
      this.stats.hits++;
      this.hitMarker(head);
      this.audio.hit(head);
      if (hit instanceof Fighter) {
        this.fx.burst(end, 0xffb060, 8, 3, 0.06, 6, 0.35);
        this.damageFighter(hit, head ? 70 : 27, P, head);
      } else if (hit === this.boss) {
        this.fx.burst(end, 0xd0a0ff, 10, 4, 0.1, -1, 0.5);
        this.damageBoss(head ? 55 : 22);
      } else {
        this.fx.burst(end, hit.color, 10, 3, 0.1, -1, 0.5);
        this.damageGhost(hit, head ? 48 : 24, true);
      }
    } else if (best < 140) {
      this.fx.burst(end, 0xffe0a0, 6, 3, 0.05, 8, 0.3);
      this.fx.burst(end, this.world.theme.fog[0], 4, 1.5, 0.12, 2, 0.6);
    }
  }

  // ---------- damage ----------
  damageFighter(f, amount, attacker, head = false) {
    if (!f.alive) return;
    if (f.isPlayer && this.godT > 0) return;
    f.hp -= amount;
    if (f.isPlayer) { this.audio.hurt(); this.hurtFlash = Math.min(1, this.hurtFlash + 0.5); }
    if (f.hp <= 0) this.killFighter(f, attacker, head);
  }

  killFighter(f, attacker, head) {
    f.alive = false;
    f.hp = 0;
    f.deadT = 0;
    if (!f.isPlayer) this.deadCount++;
    if (f.label) f.label.visible = false;
    const killer = attacker ? attacker.name : (this.level.meteors ? 'Meteor' : 'Lava');
    this.killFeed(killer, f.name, attacker ? attacker.team : null, f.team, head);
    if (attacker && attacker.isPlayer) { this.stats.kills++; this.audio.kill(); }
    this.fx.burst(f.chest(new V3()), TEAM_COLOR[f.team], 18, 4, 0.09, 7, 0.8);
    if (f.isPlayer) { this.playerDied(); return; }
    if (this.level.decoys && f.team === this.enemyTeam && !(f.hasCard && f.keyTeam === this.enemyTeam)) this.dropKey(f.pos, this.enemyTeam, true);
    if (f.hasCard) {
      this.dropKey(f.pos, f.keyTeam, false);
      f.hasCard = false;
    }
  }

  dropKey(pos, keyTeam, fake) {
    const p = pos.clone().setY(0);
    if (this.layout.walk && !this.onWalk(p.x, p.z)) {
      const c = this.layout.walk.circles[this.checkpoint];
      p.set(c.x, 0, c.z);
    }
    const kc = buildKeyCard(this.scene, p);
    this.keys.push({ ...kc, pos: p, keyTeam, fake });
    if (!fake || !this.keyDropped) {
      if (keyTeam === this.playerTeam) {
        this.announce('YOUR TEAM\'S KEY CARD DROPPED!', 'Protect it - do not let the enemy take it');
      } else if (this.level.decoys) {
        this.announce('A KEY CARD DROPPED!', 'Only one of them is real...');
      } else {
        this.announce('KEY CARD DROPPED!', 'Grab it and escape through the gate');
      }
    }
    if (keyTeam !== this.playerTeam) this.keyDropped = true;
    this.audio.key();
  }

  removeKey(i) {
    const kc = this.keys[i];
    this.scene.remove(kc.group);
    this.keys.splice(i, 1);
  }

  damageGhost(g, amount, byPlayer) {
    if (!g.alive) return;
    g.hp -= amount;
    g.hitT = 0.12;
    if (g.hp <= 0) {
      g.alive = false;
      g.dieT = 0;
      this.stats.souls++;
      if (byPlayer) this.stats.kills++;
      this.fx.burst(this.tmp.a.set(g.pos.x, g.pos.y + 0.5, g.pos.z), g.color, 26, 5, 0.12, -2, 0.9);
      this.audio.ghostDie();
    }
  }

  damageBoss(amount) {
    const b = this.boss;
    if (!b.alive) return;
    b.hp -= amount;
    b.hitT = 0.1;
    if (!b.phase2 && b.hp < b.maxHp * 0.5) {
      b.phase2 = true;
      b.model.userData.bodyMat.color.set(0xff4a8a);
      b.model.userData.bodyMat.emissive.set(0xff2a6a);
      this.audio.bossRoar();
      this.fx.shake = 1;
      this.announce('THE ANCESTOR IS ENRAGED!', 'More souls are coming');
    }
    if (b.hp <= 0) {
      b.alive = false;
      b.dieT = 0;
      this.stats.kills++;
      this.explosion(b.pos.clone(), 0, 0, true);
      this.audio.bossRoar();
      for (const g of this.ghosts) if (g.alive) this.damageGhost(g, 999, false);
      this.dropKey(new V3(b.pos.x, 0, b.pos.z), 'boss', false);
      this.announce('THE ANCESTOR IS AT PEACE', 'Take the final key card!');
      $('boss-bar').classList.add('hidden');
    }
  }

  explosion(pos, radius, dmg, big) {
    this.fx.burst(pos, 0xff8a2a, big ? 60 : 30, big ? 10 : 7, big ? 0.3 : 0.18, 6, 1.1);
    this.fx.burst(pos, 0x3a3030, big ? 30 : 16, 4, 0.35, -1, 1.4);
    this.fx.flash(pos, big ? 14 : 7, 0xffa040, 0.25);
    this.audio.explode(big ? 1 : 0.8);
    const d = this.player.pos.distanceTo(pos);
    this.fx.shake = Math.max(this.fx.shake, clamp(1 - d / 30, 0, 1) * (big ? 1 : 0.7));
    if (radius > 0) {
      for (const f of this.fighters) {
        if (!f.alive) continue;
        const dd = Math.hypot(f.pos.x - pos.x, f.pos.z - pos.z);
        if (dd < radius) this.damageFighter(f, dmg * (1 - dd / radius) + 4, null);
      }
    }
  }

  playerDied() {
    this.state = 'dying';
    this.endT = 0;
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.announce('YOU WERE DEFEATED', '');
  }

  // ---------- AI ----------
  hostilesOf(f) {
    if (f.team === this.playerTeam) {
      const list = this.fighters.filter((x) => x.alive && x.team !== this.playerTeam);
      for (const g of this.ghosts) if (g.alive) list.push(g);
      if (this.boss && this.boss.alive) list.push(this.boss);
      return list;
    }
    return this.fighters.filter((x) => x.alive && x.team === this.playerTeam);
  }

  targetPoint(t, out) {
    if (t instanceof Fighter) return t.chest(out);
    return out.set(t.pos.x, t.pos.y + 0.45 * t.scale, t.pos.z);
  }

  aiThink(f) {
    const L = this.level;
    const P = this.player;
    let best = null, bd = 70;
    for (const h of this.hostilesOf(f)) {
      const d = f.pos.distanceTo(h.pos) * (h.isPlayer ? 0.85 : 1);
      if (d < bd) { bd = d; best = h; }
    }
    f.target = best;
    const eye = f.chest(this.tmp.a).clone();
    f.los = best ? this.hasLOS(eye, this.targetPoint(best, this.tmp.b)) : false;

    if (f.team === this.enemyTeam) {
      if (f.thief) { f.dest = this.gate.pos.clone(); return; }
      const kc = this.keys.find((k) => !k.fake && k.keyTeam === this.playerTeam);
      if (kc) {
        let nearest = null, nd = 45;
        for (const e of this.fighters) {
          if (!e.alive || e.team !== this.enemyTeam || e.hasCard) continue;
          const d = e.pos.distanceTo(kc.pos);
          if (d < nd) { nd = d; nearest = e; }
        }
        if (nearest === f) { f.dest = kc.pos.clone(); return; }
      }
    }

    if (f.ally) {
      const dp = f.pos.distanceTo(P.pos);
      if (L.type !== 'battle') {
        // escort the player through ghost/boss levels
        const idx = this.fighters.indexOf(f);
        // walk beside the player, not behind (that's where the camera is)
        const a = this.yaw + (idx % 2 ? 1.9 : -1.9);
        const r = L.type === 'boss' ? 6 : 3.2;
        const fp = new V3(P.pos.x + Math.sin(a) * r, 0, P.pos.z + Math.cos(a) * r);
        if (L.type === 'boss' && best && f.los && dp < 18) {
          if (f.repathT <= 0) { f.dest = this.randomAround(P.pos, 4, 10); f.repathT = rand(2, 4); }
        } else f.dest = fp;
        return;
      }
      if (dp > 24 || !best) {
        const idx = this.fighters.indexOf(f);
        const a = this.yaw + (idx % 2 ? 1 : -1) * (1.6 + idx * 0.25);
        f.dest = new V3(P.pos.x + Math.sin(a) * 4, 0, P.pos.z + Math.cos(a) * 4);
        return;
      }
    }
    if (!best) { if (!f.dest || f.repathT <= 0) { f.dest = this.randomAround(f.pos, 3, 10); f.repathT = rand(2, 4); } return; }
    const d = f.pos.distanceTo(best.pos);
    if (!f.los || d > 30) f.dest = best.pos.clone().add(new V3(rand(-3, 3), 0, rand(-3, 3)));
    else if (f.repathT <= 0 || !f.dest || f.pos.distanceTo(f.dest) < 1) {
      f.dest = this.randomAround(best.pos, 9, 17, f.pos);
      f.repathT = rand(2, 4.5);
    }
  }

  randomAround(c, rmin, rmax, bias = null) {
    const b = this.layout.bounds;
    for (let tries = 0; tries < 12; tries++) {
      let a = Math.random() * Math.PI * 2;
      if (bias && tries < 8) a = Math.atan2(bias.x - c.x, bias.z - c.z) + rand(-1.2, 1.2);
      const r = rand(rmin, rmax);
      const x = clamp(c.x + Math.sin(a) * r, b.minX + 1, b.maxX - 1), z = clamp(c.z + Math.cos(a) * r, b.minZ + 1, b.maxZ - 1);
      if (this.inHazard(x, z)) continue;
      if (this.layout.circleLimit && Math.hypot(x, z) > this.layout.circleLimit - 1) continue;
      return new V3(x, 0, z);
    }
    return c.clone();
  }

  routeDest(f, dest) {
    // lava river in the volcano: cross only on the bridges at x = -18, 0, 18
    if (this.level.theme !== 'volcano' || !dest) return dest;
    const side = Math.sign(f.pos.z) || 1, dside = Math.sign(dest.z) || 1;
    if (side === dside && Math.abs(f.pos.z) > 2.8) return dest;
    const bx = [-18, 0, 18].reduce((p, x) => (Math.abs(x - f.pos.x) < Math.abs(p - f.pos.x) ? x : p), 0);
    const onBridge = Math.abs(f.pos.x - bx) < 1.6 && Math.abs(f.pos.z) < 4.6;
    if (onBridge) return new V3(bx, 0, dside * 4.4);
    return new V3(bx, 0, side * 3.6);
  }

  updateAI(f, dt) {
    f.thinkT -= dt;
    f.repathT -= dt;
    if (f.thinkT <= 0) { f.thinkT = rand(0.3, 0.55); this.aiThink(f); }
    const L = this.level;
    const dest = this.routeDest(f, f.dest);
    let wx = 0, wz = 0;
    if (dest) {
      const dx = dest.x - f.pos.x, dz = dest.z - f.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.9) { wx = dx / d; wz = dz / d; }
    }
    // strafe while fighting
    if (f.target && f.los && !f.thief) {
      const s = Math.sin(this.time * 1.3 + f.animT) * 0.5;
      const tx = f.target.pos.x - f.pos.x, tz = f.target.pos.z - f.pos.z, tl = Math.hypot(tx, tz) || 1;
      wx += (-tz / tl) * s;
      wz += (tx / tl) * s;
    }
    // keep apart from friends
    for (const o of this.fighters) {
      if (o === f || !o.alive) continue;
      const dx = f.pos.x - o.pos.x, dz = f.pos.z - o.pos.z, d2 = dx * dx + dz * dz;
      if (d2 < 1.6 && d2 > 1e-4) { const d = Math.sqrt(d2); wx += (dx / d) * 0.8; wz += (dz / d) * 0.8; }
    }
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    if (wl > 0.01 && this.layout.hazards.length && this.inHazard(f.pos.x + wx * 1.6, f.pos.z + wz * 1.6)) {
      const s = f.stuckSide || 1, t = wx;
      wx = -wz * s;
      wz = t * s;
    }
    let speed = f.speed * (f.thief ? 1.2 : 1);
    if (f.frozenT > 0) { f.frozenT -= dt; speed *= 0.4; }
    const accel = L.ice ? 2.5 : 9;
    const k = 1 - Math.exp(-accel * dt);
    f.vel.x += (wx * speed - f.vel.x) * k;
    f.vel.z += (wz * speed - f.vel.z) * k;
    this.moveBody(f, dt);

    f.stuckT += dt;
    if (f.stuckT > 1.2) {
      if (wl > 0.3 && f.pos.distanceTo(f.lastCheck) < 0.5) {
        f.dest = this.randomAround(f.pos, 3, 8);
        f.repathT = 1.5;
        f.stuckSide = -(f.stuckSide || 1);
      }
      f.lastCheck.copy(f.pos);
      f.stuckT = 0;
    }

    // facing
    let wantYaw = f.yaw;
    if (f.target && f.los) wantYaw = Math.atan2(f.target.pos.x - f.pos.x, f.target.pos.z - f.pos.z);
    else if (Math.hypot(f.vel.x, f.vel.z) > 0.5) wantYaw = Math.atan2(f.vel.x, f.vel.z);
    let dyaw = wantYaw - f.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    f.yaw += dyaw * Math.min(1, dt * 8);
    if (f.target && f.los) {
      const tp = this.targetPoint(f.target, this.tmp.a);
      const h = Math.hypot(tp.x - f.pos.x, tp.z - f.pos.z);
      f.pitch = Math.atan2(tp.y - (f.pos.y + 1.4 * f.scale), h);
    } else f.pitch *= 0.9;

    // lava
    if (f.grounded && this.inHazard(f.pos.x, f.pos.z)) {
      f.lavaT -= dt;
      if (f.lavaT <= 0) { f.lavaT = 0.25; this.damageFighter(f, 8, null); }
    }

    // thief escape
    if (f.thief && f.alive && Math.hypot(this.gate.pos.x - f.pos.x, this.gate.pos.z - f.pos.z) < 2.3) {
      this.levelFailed(`${f.name} escaped with your team's key card!`);
      return;
    }
    // enemy grabs the player's team key
    if (f.team === this.enemyTeam && !f.thief && !f.hasCard) {
      for (let i = this.keys.length - 1; i >= 0; i--) {
        const kc = this.keys[i];
        if (kc.fake || kc.keyTeam !== this.playerTeam) continue;
        if (Math.hypot(kc.pos.x - f.pos.x, kc.pos.z - f.pos.z) < 1.4) {
          this.removeKey(i);
          f.thief = true;
          f.hasCard = true;
          f.keyTeam = this.playerTeam;
          f.thiefMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: getGlowTexture(), color: 0xffc020, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
          f.thiefMark.scale.setScalar(1.4);
          this.scene.add(f.thiefMark);
          this.announce(`${f.name.toUpperCase()} STOLE YOUR KEY!`, 'Stop them before they reach the gate!');
          this.audio.fake();
        }
      }
    }

    // shooting
    f.fireCd -= dt;
    if (f.target && f.los && f.fireCd <= 0) {
      const dist = f.pos.distanceTo(f.target.pos);
      if (dist < 42) {
        this.aiShoot(f, f.target, dist);
        f.burst--;
        if (f.burst <= 0) { f.burst = 3 + ((Math.random() * 3) | 0); f.fireCd = rand(0.9, 1.9) * (f.ally ? 0.8 : 1); }
        else f.fireCd = 0.13;
      }
    }
  }

  aiShoot(f, target, dist) {
    const L = this.level;
    const muzzle = f.muzzle(this.tmp.c).clone();
    const aim = this.targetPoint(target, new V3());
    let acc = f.ally ? 0.36 : (L.acc || 0.3);
    if (L.weather === 'sand') acc *= 0.85;
    let p = acc * clamp(1.2 - dist / 40, 0.15, 1);
    if (target.isPlayer) {
      const sp = Math.hypot(target.vel.x, target.vel.z);
      if (sp > 3) p *= 0.7;
      if (!target.grounded) p *= 0.6;
    }
    const hit = Math.random() < p;
    let end;
    if (hit) end = aim.clone().add(new V3(rand(-0.15, 0.15), rand(-0.15, 0.15), rand(-0.15, 0.15)));
    else {
      end = aim.clone().add(new V3(rand(-1.4, 1.4), rand(-0.8, 1.2), rand(-1.4, 1.4)));
      end.sub(muzzle).multiplyScalar(1.6).add(muzzle);
    }
    this.fx.tracer(muzzle, end, f.ally ? 0xffe08a : 0xff6a50);
    this.fx.flash(muzzle, 0.6, 0xffb060, 0.05);
    this.audio.enemyShot(this.player.pos.distanceTo(f.pos));
    if (hit) {
      if (target instanceof Fighter) this.damageFighter(target, f.ally ? 11 : 6 + L.id * 0.6, f);
      else if (target === this.boss) this.damageBoss(9);
      else this.damageGhost(target, 15, false);
    }
  }

  // ---------- ghosts ----------
  spawnGhost(pos, opts = {}) {
    const L = this.level;
    const color = GHOST_COLORS[(Math.random() * GHOST_COLORS.length) | 0];
    const scale = opts.scale || rand(0.95, 1.2);
    const model = buildGhost(color, scale);
    model.position.copy(pos);
    this.scene.add(model);
    const g = {
      model, color, scale, pos: pos.clone(), hp: (L.ghostHp || 60) * (opts.hpMul || 1), alive: true, t: 0, phase: Math.random() * 10,
      speed: (L.ghostSpeed || 3.6) * rand(0.85, 1.15), dmgCd: 0, spawnT: 0, hitT: 0, dieT: 0, baseY: pos.y,
    };
    this.ghosts.push(g);
    if (Math.random() < 0.4) this.audio.ghost(0.08);
    return g;
  }

  updateGhostSpawns() {
    const plan = this.ghostPlan;
    const P = this.player;
    const n = this.nearestOnPath(P.pos.x, P.pos.z);
    const prog = n.along / this.pathInfo.total;
    this.maxProgress = Math.max(this.maxProgress, prog);
    while (plan.waveIdx < plan.waves.length && this.maxProgress >= plan.waves[plan.waveIdx]) {
      const left = plan.total - plan.spawned;
      const wavesLeft = plan.waves.length - plan.waveIdx;
      const count = Math.ceil(left / wavesLeft);
      for (let i = 0; i < count; i++) {
        const ahead = i % 4 === 3 ? -rand(8, 14) : rand(14, 30);
        const base = this.pointAlongPath(n.along + ahead);
        const side = rand(-7, 7);
        const pos = new V3(base.x + side, this.layout.noGround ? rand(0.5, 3) : 0.2, base.z + rand(-3, 3));
        this.spawnGhost(pos);
        plan.spawned++;
      }
      if (plan.waveIdx > 0) this.announce('MORE SOULS RISE!', '');
      plan.waveIdx++;
    }
  }

  updateGhost(g, dt) {
    g.t += dt;
    const m = g.model;
    if (!g.alive) {
      g.dieT += dt;
      m.scale.setScalar(g.scale * (1 + g.dieT * 1.5));
      m.userData.bodyMat.opacity = Math.max(0, 0.55 - g.dieT);
      m.position.y += dt * 2;
      if (g.dieT > 0.6 && m.parent) this.scene.remove(m);
      return;
    }
    g.spawnT = Math.min(1, g.spawnT + dt * 1.4);
    // pick a target: mostly the player
    let tgt = this.player, td = this.player.alive ? g.pos.distanceTo(this.player.pos) * 0.7 : Infinity;
    for (const f of this.fighters) {
      if (!f.alive || f.isPlayer || f.team !== this.playerTeam) continue;
      const d = g.pos.distanceTo(f.pos);
      if (d < td) { td = d; tgt = f; }
    }
    if (!tgt.alive) return;
    const aim = tgt.chest(this.tmp.a);
    aim.y -= 0.3 * g.scale;
    const dx = aim.x - g.pos.x, dy = aim.y - g.pos.y, dz = aim.z - g.pos.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    const sp = g.speed * (g.hitT > 0 ? 0.3 : 1) * (0.3 + 0.7 * g.spawnT);
    const wob = Math.sin(g.t * 2.2 + g.phase) * 1.4;
    g.pos.x += (dx / d) * sp * dt + (-dz / d) * wob * dt;
    g.pos.z += (dz / d) * sp * dt + (dx / d) * wob * dt;
    g.pos.y += (dy / d) * sp * dt * 0.8 + Math.sin(g.t * 3 + g.phase) * 0.4 * dt;
    if (!this.layout.noGround) g.pos.y = Math.max(0.1, g.pos.y);
    g.hitT -= dt;
    m.position.set(g.pos.x, g.pos.y - (1 - g.spawnT) * 2, g.pos.z);
    m.rotation.y = Math.atan2(dx, dz);
    animateGhost(m, g.t, g.phase);
    m.userData.bodyMat.emissiveIntensity = g.hitT > 0 ? 2.5 : 0.75;
    g.dmgCd -= dt;
    if (d < 1.0 * g.scale && g.dmgCd <= 0) {
      g.dmgCd = 0.7;
      this.damageFighter(tgt, 9 + this.level.id * 0.4, null);
      if (this.level.ice) { tgt.frozenT = 1.6; if (tgt.isPlayer) this.announce('FROZEN!', ''); }
      g.pos.x -= (dx / d) * 1.2;
      g.pos.z -= (dz / d) * 1.2;
      this.fx.burst(this.tmp.b.copy(aim), g.color, 8, 2, 0.08, -1, 0.4);
    }
    if (Math.random() < dt * 0.08) this.audio.ghost(0.05);
  }

  // ---------- boss ----------
  spawnBoss() {
    const L = this.level;
    const model = buildGhost(0xc58cff, 3.4, true);
    this.scene.add(model);
    this.boss = { model, scale: 3.4, pos: new V3(0, 4.5, -6), hp: L.bossHp, maxHp: L.bossHp, alive: true, t: 0, atkT: 4, sumT: 8, phase2: false, hitT: 0, dieT: 0, color: 0xc58cff };
    model.position.copy(this.boss.pos);
    $('boss-bar').classList.remove('hidden');
    this.orbGeo = new THREE.SphereGeometry(0.32, 12, 10);
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0xe0a0ff, toneMapped: false });
    this.orbMat.color.multiplyScalar(2.5);
  }

  updateBoss(dt) {
    const b = this.boss;
    b.t += dt;
    const m = b.model;
    if (!b.alive) {
      b.dieT += dt;
      m.scale.setScalar(b.scale * (1 + b.dieT));
      m.userData.bodyMat.opacity = Math.max(0, 0.55 - b.dieT * 0.4);
      m.position.y += dt * 3;
      if (Math.random() < dt * 10) this.fx.burst(m.position.clone().add(new V3(rand(-3, 3), rand(0, 4), rand(-3, 3))), 0xd0a0ff, 10, 5, 0.15, -2, 0.8);
      // keep it in the scene (removing its light would force a shader recompile), just shrink it away
      if (b.dieT > 2) { m.scale.setScalar(0.0001); m.traverse((o) => { if (o.isLight) o.intensity = 0; }); }
      return;
    }
    const ang = b.t * (b.phase2 ? 0.4 : 0.25);
    const goal = this.tmp.a.set(Math.cos(ang) * 8, 4.4 + Math.sin(b.t * 1.3) * 0.8, Math.sin(ang) * 8 - 3);
    b.pos.lerp(goal, Math.min(1, dt * 1.2));
    m.position.copy(b.pos);
    animateGhost(m, b.t, 0);
    const P = this.player;
    m.rotation.y = Math.atan2(P.pos.x - b.pos.x, P.pos.z - b.pos.z);
    m.userData.bodyMat.emissiveIntensity = b.hitT > 0 ? 2.5 : 0.9;
    b.hitT -= dt;
    b.atkT -= dt;
    if (b.atkT <= 0) {
      b.atkT = b.phase2 ? 1.7 : 2.6;
      const targets = this.fighters.filter((f) => f.alive && f.team === this.playerTeam);
      const tgt = Math.random() < 0.6 ? P : targets[(Math.random() * targets.length) | 0];
      const from = new V3(b.pos.x, b.pos.y + 0.6 * b.scale, b.pos.z);
      const n = b.phase2 ? 7 : 5;
      for (let i = 0; i < n; i++) {
        const aim = tgt.chest(new V3()).add(new V3(tgt.vel.x * 0.5, 0, tgt.vel.z * 0.5));
        const dir = aim.sub(from).normalize();
        const spreadA = (i - (n - 1) / 2) * 0.09;
        dir.applyAxisAngle(new V3(0, 1, 0), spreadA);
        const mesh = new THREE.Mesh(this.orbGeo, this.orbMat);
        mesh.position.copy(from);
        this.scene.add(mesh);
        this.orbs.push({ mesh, pos: from.clone(), vel: dir.multiplyScalar(b.phase2 ? 15 : 12), life: 5 });
      }
      this.audio.orb();
    }
    b.sumT -= dt;
    if (b.sumT <= 0) {
      b.sumT = b.phase2 ? 10 : 14;
      const alive = this.ghosts.filter((g) => g.alive).length;
      const n = Math.min(b.phase2 ? 5 : 3, 10 - alive);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        this.spawnGhost(new V3(b.pos.x + Math.cos(a) * 4, 1.5, b.pos.z + Math.sin(a) * 4));
      }
      if (n > 0) this.audio.ghost(0.15);
    }
  }

  updateOrbs(dt) {
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.life -= dt;
      o.pos.addScaledVector(o.vel, dt);
      o.mesh.position.copy(o.pos);
      if (Math.random() < 0.5) this.fx.trail(o.pos, 0xc080ff, 0.12, 0.3);
      let dead = o.life <= 0 || o.pos.y < 0.05;
      for (const f of this.fighters) {
        if (!f.alive || f.team !== this.playerTeam) continue;
        if (o.pos.distanceTo(f.chest(this.tmp.a)) < 0.8) { this.damageFighter(f, 13, null); dead = true; break; }
      }
      if (!dead) for (const c of this.colliders) {
        if (o.pos.x > c.min.x && o.pos.x < c.max.x && o.pos.y > c.min.y && o.pos.y < c.max.y && o.pos.z > c.min.z && o.pos.z < c.max.z) { dead = true; break; }
      }
      if (dead) {
        this.fx.burst(o.pos, 0xd0a0ff, 10, 3, 0.1, 2, 0.4);
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
      }
    }
  }

  // ---------- level hazards ----------
  updateMeteors(dt) {
    this.meteorT -= dt;
    if (this.meteorT <= 0 && this.player.alive) {
      this.meteorT = rand(3.0, 4.5);
      const P = this.player;
      const lead = Math.random() < 0.6 ? 1.3 : 0;
      const b = this.layout.bounds;
      const target = new V3(clamp(P.pos.x + P.vel.x * lead + rand(-6, 6), b.minX, b.maxX), 0, clamp(P.pos.z + P.vel.z * lead + rand(-6, 6), b.minZ, b.maxZ));
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 40), new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(target.x, 0.06, target.z);
      this.scene.add(ring);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff5a10, emissiveIntensity: 2, flatShading: true }));
      const start = target.clone().add(new V3(14, 46, -10));
      rock.position.copy(start);
      this.scene.add(rock);
      this.meteors.push({ ring, rock, start, target, t: 0, T: 1.9 });
    }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.t += dt;
      const k = Math.min(1, m.t / m.T);
      m.rock.position.lerpVectors(m.start, m.target, k * k);
      m.rock.rotation.x += dt * 4;
      m.rock.rotation.y += dt * 3;
      m.ring.material.opacity = 0.4 + Math.sin(m.t * 18) * 0.4;
      m.ring.scale.setScalar(1.1 - k * 0.15);
      this.fx.trail(m.rock.position, 0xff7a2a, 0.35, 0.5);
      if (k >= 1) {
        this.explosion(m.target.clone().setY(0.5), 4.2, 32, false);
        this.scene.remove(m.ring);
        this.scene.remove(m.rock);
        m.ring.geometry.dispose();
        m.rock.geometry.dispose();
        this.meteors.splice(i, 1);
      }
    }
  }

  updateLightning(dt) {
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = rand(6, 13);
      this.lightFlash = 0.35;
      this.audio.thunder();
    }
    const base = this.world.theme.hemi[2];
    if (this.lightFlash > 0) {
      this.lightFlash -= dt;
      const on = this.lightFlash > 0.22 || (this.lightFlash > 0.06 && this.lightFlash < 0.12);
      this.world.hemi.intensity = on ? base * 7 : base;
      $('flash').style.opacity = on ? 0.18 : 0;
    } else { this.world.hemi.intensity = base; $('flash').style.opacity = 0; }
  }

  updateReinforcements(dt) {
    if (this.player.hasCard) return;
    this.reinforceT -= dt;
    if (this.reinforceT > 0) return;
    this.reinforceT = 17;
    const alive = this.fighters.filter((f) => f.alive && f.team === this.enemyTeam).length;
    if (alive >= 7) return;
    const names = NAMES[this.enemyTeam];
    for (let i = 0; i < 2; i++) {
      this.reinforced++;
      const sp = this.layout.spawnB[(Math.random() * this.layout.spawnB.length) | 0];
      this.spawnEnemy(sp, names[(this.reinforced + 4) % names.length], this.reinforced);
    }
    this.announce('ENEMY REINFORCEMENTS!', 'Grab the key card to stop them');
  }

  // ---------- main update ----------
  updatePlaying(dt) {
    const L = this.level;
    this.stats.time += dt;
    this.godT -= dt;
    this.updatePlayer(dt);
    if (this.state !== 'playing' && this.state !== 'dying') return;
    this.updateWorldEntities(dt);
    if (L.type === 'ghost') this.updateGhostSpawns();
    if (L.meteors) this.updateMeteors(dt);
    if (L.lightning) this.updateLightning(dt);
    if (L.reinforce) this.updateReinforcements(dt);
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 0; this.levelFailed('The gate closed! The souls trapped you.'); }
    }
    this.updateCamera(dt);
    this.updateHUD(dt);
  }

  updateWorldEntities(dt) {
    for (const f of this.fighters) {
      if (f.isPlayer) { this.animateFighter(f, dt); continue; }
      if (f.alive) this.updateAI(f, dt);
      if (this.state !== 'playing' && this.state !== 'dying') return;
      this.animateFighter(f, dt);
    }
    for (const g of this.ghosts) this.updateGhost(g, dt);
    for (let i = this.ghosts.length - 1; i >= 0; i--) if (!this.ghosts[i].alive && !this.ghosts[i].model.parent) this.ghosts.splice(i, 1);
    if (this.boss) this.updateBoss(dt);
    this.updateOrbs(dt);
    for (const kc of this.keys) kc.update(this.time);
    const real = this.keys.find((k) => !k.fake) || this.keys[0];
    if (real) { this.keyLight.position.set(real.pos.x, 1.5, real.pos.z); this.keyLight.intensity = 25; } else this.keyLight.intensity = 0;
    for (const p of this.pickups) if (!p.taken) p.update(this.time);
    this.gate.update(this.time);
    this.world.update(dt, this.time);
    this.fx.update(dt);
    if (this.weather) this.weather.update(dt, this.camera.position, this.time);
  }

  animateFighter(f, dt) {
    const m = f.model;
    if (f.alive) {
      const sp = Math.hypot(f.vel.x, f.vel.z);
      f.animT += dt * (0.4 + sp * 0.22);
      m.position.copy(f.pos);
      m.rotation.y = f.yaw;
      animateHumanoid(m, f.animT, sp, f.pitch);
      if (f.label) {
        const d = f.pos.distanceTo(this.player.pos);
        f.label.visible = d < (f.ally ? 40 : 22);
        f.label.position.set(f.pos.x, f.pos.y + f.height + 0.35, f.pos.z);
      }
      if (f.thiefMark) { f.thiefMark.position.set(f.pos.x, f.pos.y + f.height + 0.9, f.pos.z); f.thiefMark.material.opacity = 0.6 + Math.sin(this.time * 8) * 0.4; }
    } else if (!f.removed) {
      f.deadT += dt;
      const k = Math.min(1, f.deadT / 0.55);
      m.rotation.x = -k * k * Math.PI / 2;
      m.position.y = f.pos.y + Math.sin(k * Math.PI) * 0.3 - (f.deadT > 3 ? (f.deadT - 3) * 0.6 : 0);
      if (f.thiefMark) { this.scene.remove(f.thiefMark); f.thiefMark = null; }
      if (f.deadT > 5 && !f.isPlayer) { this.scene.remove(m); if (f.label) this.scene.remove(f.label); f.removed = true; }
    }
  }

  updateCamera(dt) {
    const P = this.player;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch), sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwd = this.tmp.a.set(sy * cp, sp, cy * cp);
    const right = this.tmp.b.set(-cy, 0, sy);
    const pivot = this.tmp.c.set(P.pos.x, P.pos.y + 1.55 * P.scale, P.pos.z).addScaledVector(right, 0.85);
    const dist = 3.3;
    const desired = new V3().copy(pivot).addScaledVector(fwd, -dist).add(new V3(0, 0.3, 0));
    const dir = new V3().subVectors(desired, pivot);
    const len = dir.length();
    dir.divideScalar(len);
    const hit = rayBoxes(pivot, dir, len, this.colliders);
    const cam = this.camera;
    cam.position.copy(pivot).addScaledVector(dir, Math.max(0.3, Math.min(len, hit - 0.25)));
    if (!this.layout.noGround) cam.position.y = Math.max(0.35, cam.position.y);
    if (this.fx.shake > 0) {
      const s = this.fx.shake * 0.25;
      cam.position.add(new V3(rand(-s, s), rand(-s, s), rand(-s, s)));
    }
    cam.lookAt(cam.position.x + fwd.x, cam.position.y + fwd.y, cam.position.z + fwd.z);
    this.world.followCamera(cam.position);
    if (this.flashlight) {
      this.flashlight.position.copy(P.pos).add(new V3(0, 1.5, 0)).addScaledVector(right, 0.3);
      this.flashlight.target.position.copy(cam.position).addScaledVector(fwd, 20);
    }
  }

  updateIntro(dt) {
    this.introT += dt;
    const P = this.player;
    const a = Math.PI + this.introT * 0.35;
    this.camera.position.set(P.pos.x + Math.sin(a) * 6, P.pos.y + 2.6, P.pos.z + Math.cos(a) * 6);
    this.camera.lookAt(P.pos.x, P.pos.y + 1.2, P.pos.z);
    this.world.followCamera(this.camera.position);
    for (const f of this.fighters) this.animateFighter(f, dt * 0.3);
    this.gate.update(this.time);
    this.world.update(dt, this.time);
    this.fx.update(dt);
    if (this.weather) this.weather.update(dt, this.camera.position, this.time);
  }

  updateEnding(dt) {
    this.endT += dt;
    if (this.state === 'dying') {
      this.updateWorldEntities(dt * 0.5);
      const P = this.player;
      const a = this.yaw + Math.PI + this.endT * 0.4;
      this.camera.position.set(P.pos.x + Math.sin(a) * 5, P.pos.y + 3 + this.endT * 0.8, P.pos.z + Math.cos(a) * 5);
      this.camera.lookAt(P.pos.x, P.pos.y + 0.5, P.pos.z);
      this.world.followCamera(this.camera.position);
      if (this.endT > 2) this.levelFailed('You were defeated.');
    } else {
      this.world.update(dt, this.time);
      this.fx.update(dt);
      this.gate.update(this.time);
      if (this.weather) this.weather.update(dt, this.camera.position, this.time);
    }
  }

  levelComplete() {
    if (this.state !== 'playing') return;
    this.state = 'complete';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.portal();
    this.fx.flash(this.player.chest(new V3()), 8, 0x80ffd0, 0.6);
    this.player.model.visible = false;
    if (this.level.type === 'battle') this.deadCarry = this.deadCount;
    const idx = this.levelIndex;
    this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(10, idx + 2));
    store.set('fw3d_progress', this.progress);
    this.showHUD(false);
    const acc = this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    const statsHTML = `<div><b>${this.stats.kills}</b><span>${this.level.type === 'battle' ? 'KILLS' : 'SOULS FREED'}</span></div><div><b>${acc}%</b><span>ACCURACY</span></div><div><b>${Math.floor(this.stats.time / 60)}:${String(Math.floor(this.stats.time % 60)).padStart(2, '0')}</b><span>TIME</span></div>`;
    this.audio.stopMusic();
    setTimeout(() => {
      if (idx === LEVELS.length - 1) {
        $('vic-stats').innerHTML = statsHTML;
        this.showScreen('overlay-victory');
      } else {
        $('res-title').textContent = 'LEVEL COMPLETE';
        $('res-title').style.color = 'var(--good)';
        $('res-sub').textContent = this.level.type === 'battle' ? `${this.deadCount} fell... their souls will chase you next` : 'You escaped through the gate';
        $('res-stats').innerHTML = statsHTML;
        $('res-next').classList.remove('hidden');
        this.showScreen('overlay-result');
      }
    }, 900);
  }

  levelFailed(reason) {
    if (this.state !== 'playing' && this.state !== 'dying') return;
    this.state = 'failed';
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.stopMusic();
    this.showHUD(false);
    $('res-title').textContent = 'MISSION FAILED';
    $('res-title').style.color = 'var(--bad)';
    $('res-sub').textContent = reason;
    const acc = this.stats.shots ? Math.round((this.stats.hits / this.stats.shots) * 100) : 0;
    $('res-stats').innerHTML = `<div><b>${this.stats.kills}</b><span>KILLS</span></div><div><b>${acc}%</b><span>ACCURACY</span></div><div><b>${LEVELS[this.levelIndex].id}</b><span>LEVEL</span></div>`;
    $('res-next').classList.add('hidden');
    this.showScreen('overlay-result');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.pausedAt = performance.now();
    this.input.enabled = false;
    this.input.reset();
    if (document.pointerLockElement) document.exitPointerLock();
    this.showScreen('overlay-pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.hideScreens();
    this.state = 'playing';
    this.input.enabled = true;
    this.input.reset();
    this.clock.getDelta();
    if (!this.input.isTouch && this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }

  goMenu() {
    this.audio.stopMusic();
    this.input.enabled = false;
    this.showHUD(false);
    this.buildMenuScene();
    this.state = 'menu';
    this.showScreen('screen-menu');
    this.audio.startMusic('menu');
  }

  // ---------- HUD ----------
  showHUD(on) {
    $('hud').classList.toggle('hidden', !on);
    $('touch').classList.toggle('hidden', !(on && this.input.isTouch));
  }

  updateHUDStatic() {
    const L = this.level;
    $('level-tag').textContent = `LEVEL ${L.id} · ${L.name.toUpperCase()}`;
    const tt = $('team-tag');
    tt.textContent = L.type === 'boss' ? 'FAMILY UNITED' : `TEAM ${this.playerTeam.toUpperCase()}`;
    tt.style.color = L.type === 'boss' ? '#ffc440' : TEAM_CSS[this.playerTeam];
    $('timer').classList.toggle('hidden', !L.timer);
    $('boss-bar').classList.toggle('hidden', L.type !== 'boss');
    $('killfeed').innerHTML = '';
    $('announce').classList.remove('show');
    this._hud = {};
  }

  setText(id, v) {
    if (this._hud[id] === v) return;
    this._hud[id] = v;
    $(id).textContent = v;
  }

  updateHUD(dt) {
    const P = this.player, W = this.weapon, L = this.level;
    const hp = Math.max(0, Math.ceil(P.hp));
    this.setText('hp-text', String(hp));
    if (this._hud.hpw !== hp) {
      this._hud.hpw = hp;
      $('hp-fill').style.width = `${(hp / P.maxHp) * 100}%`;
      $('hp-fill').classList.toggle('low', hp < 35);
    }
    this.setText('ammo-mag', String(W.mag));
    this.setText('ammo-res', `/ ${W.reserve}`);
    $('reload-msg').classList.toggle('hidden', W.reloadT <= 0);
    $('key-icon').classList.toggle('hidden', !P.hasCard);

    let obj;
    const realKeys = this.keys.filter((k) => k.keyTeam !== this.playerTeam);
    if (L.type === 'ghost') {
      const left = Math.max(0, Math.round(this.pathInfo.total * (1 - this.maxProgress)));
      obj = `Escape the souls! Reach the gate - ${left} m`;
    } else if (L.type === 'boss') {
      obj = this.boss.alive ? 'Defeat the Ancestor Spirit together!' : P.hasCard ? 'Enter the gate - bring the family home!' : 'Take the final key card!';
    } else if (P.hasCard) obj = 'You have the KEY CARD - reach the GATE!';
    else if (this.fighters.some((f) => f.thief && f.alive)) obj = 'STOP THE THIEF before they reach the gate!';
    else if (realKeys.length) obj = L.decoys ? 'Key cards dropped - only one is real!' : 'KEY CARD dropped - grab it!';
    else obj = `Find the hidden key card - defeat the ${this.enemyTeam.toUpperCase()}!`;
    this.setText('objective', obj);

    if (L.type === 'battle') {
      const e = this.fighters.filter((f) => f.alive && f.team === this.enemyTeam).length;
      const a = this.fighters.filter((f) => f.alive && f.ally).length;
      this.setText('counts', `ENEMIES ${e} · ALLIES ${a}`);
    } else {
      const g = this.ghosts.filter((x) => x.alive).length;
      const remaining = L.type === 'ghost' ? this.ghostPlan.total - this.ghostPlan.spawned + g : g;
      this.setText('counts', `SOULS ${remaining}`);
    }
    if (L.timer) {
      const t = Math.ceil(this.timer);
      this.setText('timer', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
      $('timer').classList.toggle('low', t <= 20);
    }
    if (this.boss) $('boss-fill').style.width = `${Math.max(0, this.boss.hp / this.boss.maxHp) * 100}%`;

    // crosshair spread & enemy highlight
    const gap = 5 + (W.bloom * 0.022 + (Math.hypot(P.vel.x, P.vel.z) > 1 ? 0.012 : 0)) * 420;
    $('crosshair').style.setProperty('--g', `${gap.toFixed(1)}px`);

    // damage feedback
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.6);
    $('vignette').style.opacity = String(Math.max(this.hurtFlash, hp < 30 ? 0.35 + Math.sin(this.time * 5) * 0.15 : 0));
    $('freeze').style.opacity = P.frozenT > 0 ? '1' : '0';

    // announcements
    if (this.announceT > 0) { this.announceT -= dt; if (this.announceT <= 0) $('announce').classList.remove('show'); }
    const now = this.time;
    while (this.feed.length && now - this.feed[0].t > 5) { const it = this.feed.shift(); it.el.remove(); }

    this.updateWaypoint();
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.08; this.drawMinimap(); }
  }

  updateWaypoint() {
    const el = $('waypoint');
    const P = this.player;
    let target = null;
    if (this.keys.length) {
      let bd = Infinity;
      for (const k of this.keys) { const d = k.pos.distanceTo(P.pos); if (d < bd) { bd = d; target = k.pos; } }
    } else if (this.gate.open) target = this.gate.pos;
    const thief = this.fighters.find((f) => f.thief && f.alive);
    if (thief) target = thief.pos;
    if (!target) { el.style.display = 'none'; return; }
    const v = new V3(target.x, (target.y || 0) + 2.2, target.z).project(this.camera);
    const behind = v.z > 1;
    let x = (v.x * 0.5 + 0.5) * window.innerWidth, y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    if (behind) { x = window.innerWidth - x; y = window.innerHeight - 40; }
    const m = 40;
    const cx = clamp(x, m, window.innerWidth - m), cy = clamp(y, m + 40, window.innerHeight - m);
    const off = cx !== x || cy !== y || behind;
    el.style.display = 'flex';
    el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
    const arrow = el.firstElementChild;
    if (off) {
      const ang = Math.atan2(y - window.innerHeight / 2, x - window.innerWidth / 2) + Math.PI / 2;
      arrow.style.transform = `rotate(${ang}rad)`;
    } else arrow.style.transform = 'rotate(180deg)';
    $('wp-dist').textContent = `${Math.round(P.pos.distanceTo(target))}m`;
    el.style.color = thief ? '#ff4a4a' : this.gate.open && !this.keys.length ? '#35ffb0' : '#ffc440';
  }

  drawMinimap() {
    const c = $('minimap');
    const g = c.getContext('2d');
    const W = c.width, R = W / 2, scale = R / 45;
    const P = this.player;
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(R, R, R - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = 'rgba(5,8,16,0.4)';
    g.fillRect(0, 0, W, W);
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const toMap = (x, z) => {
      const dx = x - P.pos.x, dz = z - P.pos.z;
      const rx = dx * -cy + dz * sy, fz = dx * sy + dz * cy;
      return [R + rx * scale, R - fz * scale];
    };
    if (this.layout.path) {
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 6;
      g.beginPath();
      this.layout.path.forEach((p, i) => { const [x, y] = toMap(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
    }
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (const col of this.colliders) {
      const cxm = (col.min.x + col.max.x) / 2, czm = (col.min.z + col.max.z) / 2;
      if (Math.abs(cxm - P.pos.x) > 50 || Math.abs(czm - P.pos.z) > 50) continue;
      const [x, y] = toMap(cxm, czm);
      const s = Math.max(2, Math.min(10, (col.max.x - col.min.x) * scale));
      g.fillRect(x - s / 2, y - s / 2, s, s);
    }
    const dot = (x, z, color, r = 3.5) => { const [mx, my] = toMap(x, z); g.fillStyle = color; g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill(); };
    const [gx, gy] = toMap(this.gate.pos.x, this.gate.pos.z);
    g.fillStyle = this.gate.open ? '#35ffb0' : '#ff3a4a';
    g.fillRect(gx - 5, gy - 5, 10, 10);
    for (const f of this.fighters) {
      if (!f.alive || f.isPlayer) continue;
      if (f.ally) dot(f.pos.x, f.pos.z, '#8affc0');
      else if (f.thief || f.pos.distanceTo(P.pos) < 30) dot(f.pos.x, f.pos.z, f.thief ? '#ffc440' : '#ff4a4a');
    }
    for (const gh of this.ghosts) if (gh.alive) dot(gh.pos.x, gh.pos.z, '#7fe7ff', 3);
    if (this.boss && this.boss.alive) dot(this.boss.pos.x, this.boss.pos.z, '#c58cff', 7);
    for (const k of this.keys) {
      const [kx, ky] = toMap(k.pos.x, k.pos.z);
      g.fillStyle = '#ffc440';
      g.beginPath(); g.moveTo(kx, ky - 6); g.lineTo(kx + 5, ky); g.lineTo(kx, ky + 6); g.lineTo(kx - 5, ky); g.fill();
    }
    g.restore();
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(R, R - 8); g.lineTo(R + 6, R + 6); g.lineTo(R, R + 3); g.lineTo(R - 6, R + 6); g.fill();
  }

  announce(title, sub = '') {
    const el = $('announce');
    el.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    el.classList.add('show');
    this.announceT = 2.6;
  }

  toast(text) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.color = '#8affc0';
    $('killfeed').prepend(el);
    this.feed.push({ el, t: this.time - 2.5 });
  }

  killFeed(killer, victim, kTeam, vTeam, head) {
    const el = document.createElement('div');
    const kc = kTeam ? TEAM_CSS[kTeam] : '#ffc440';
    el.innerHTML = `<span style="color:${kc}">${killer}</span> ${head ? '&#9673;' : '&#8250;'} <span style="color:${TEAM_CSS[vTeam]}">${victim}</span>`;
    $('killfeed').appendChild(el);
    this.feed.push({ el, t: this.time });
    if (this.feed.length > 5) { const it = this.feed.shift(); it.el.remove(); }
  }

  hitMarker(head) {
    const el = $('hitmarker');
    el.classList.remove('fade');
    el.classList.toggle('head', head);
    el.classList.add('show');
    clearTimeout(this._hmT);
    this._hmT = setTimeout(() => { el.classList.remove('show'); el.classList.add('fade'); }, 70);
  }

  // ---------- menus ----------
  showScreen(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
  }
  hideScreens() { document.querySelectorAll('.screen').forEach((s) => s.classList.remove('show')); }

  setupUI() {
    document.body.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this.audio.init();
      this.audio.click();
      const act = b.dataset.act;
      if (act === 'play') { this.afterTeam = () => this.startLevel(Math.min(this.progress.unlocked, 10) - 1); this.showScreen('screen-team'); }
      else if (act === 'levels') { this.renderLevelGrid(); this.showScreen('screen-levels'); }
      else if (act === 'settings') { this.settingsBack = this.state === 'paused' ? 'overlay-pause' : 'screen-menu'; this.renderSettings(); this.showScreen('screen-settings'); }
      else if (act === 'help') this.showScreen('screen-help');
      else if (act === 'back') {
        if (b.closest('#screen-settings')) this.showScreen(this.settingsBack || 'screen-menu');
        else this.showScreen('screen-menu');
      }
      else if (act === 'start') this.beginPlay();
      else if (act === 'resume') this.resume();
      else if (act === 'restart') this.startLevel(this.levelIndex);
      else if (act === 'next') this.startLevel(Math.min(this.levelIndex + 1, LEVELS.length - 1));
      else if (act === 'menu') this.goMenu();
    });
    document.querySelectorAll('.team-card').forEach((c) => c.addEventListener('click', () => {
      this.audio.init();
      this.audio.click();
      this.progress.team = c.dataset.team;
      store.set('fw3d_progress', this.progress);
      const go = this.afterTeam;
      this.afterTeam = null;
      if (go) go();
    }));
    $('btn-pause').addEventListener('click', () => this.pause());
    $('btn-pause').addEventListener('pointerdown', (e) => e.stopPropagation());
    $('set-quality').addEventListener('click', (e) => {
      const v = e.target.dataset.v;
      if (!v) return;
      this.settings.quality = v;
      store.set('fw3d_settings', this.settings);
      this.applyQuality();
      this.resize();
      this.renderSettings();
    });
    $('set-sound').addEventListener('click', (e) => {
      const v = e.target.dataset.v;
      if (!v) return;
      this.settings.sound = v === 'on';
      this.audio.setEnabled(this.settings.sound);
      store.set('fw3d_settings', this.settings);
      this.renderSettings();
    });
    $('set-sens').addEventListener('input', (e) => {
      this.settings.sens = parseFloat(e.target.value);
      store.set('fw3d_settings', this.settings);
    });
  }

  renderSettings() {
    document.querySelectorAll('#set-quality button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.settings.quality));
    document.querySelectorAll('#set-sound button').forEach((b) => b.classList.toggle('on', (b.dataset.v === 'on') === this.settings.sound));
    $('set-sens').value = this.settings.sens;
  }

  renderLevelGrid() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const b = document.createElement('button');
      const locked = i + 1 > this.progress.unlocked;
      b.className = `lvl-btn ${L.type}${locked ? ' locked' : ''}`;
      b.innerHTML = `<b>${L.id}</b><span>${L.name}</span><span>${locked ? 'LOCKED' : L.type === 'battle' ? 'BATTLE' : L.type === 'ghost' ? 'SOUL ESCAPE' : 'FINAL BOSS'}</span>`;
      b.addEventListener('click', () => {
        if (locked) return;
        this.audio.init();
        this.audio.click();
        this.afterTeam = () => this.startLevel(i);
        this.showScreen('screen-team');
      });
      grid.appendChild(b);
    });
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.state === 'menu' || this.state === 'loading') { if (this.menuChars) this.updateMenu(dt); }
    else if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'intro') this.updateIntro(dt);
    else if (this.state === 'dying' || this.state === 'complete' || this.state === 'failed') this.updateEnding(dt);
    if (this.state !== 'paused' || !this._pausedFrame) this.render();
    this._pausedFrame = this.state === 'paused';
  }
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
