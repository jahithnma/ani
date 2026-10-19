// All sounds are synthesized with WebAudio so the APK needs no audio files.

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.musicTimer = null;
    this.musicNodes = [];
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.on ? 0.8 : 0;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.22;
    this.music.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  setEnabled(on) {
    this.on = on;
    if (this.master) this.master.gain.value = on ? 0.8 : 0;
  }

  suspend() { this.ctx && this.ctx.state === 'running' && this.ctx.suspend(); }
  resume() { this.ctx && this.ctx.state === 'suspended' && this.ctx.resume(); }

  _noise(dur, type, freq, vol, { q = 1, when = 0, sweep = null, out = this.sfx } = {}) {
    if (!this.ctx || vol <= 0.001) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  _tone(type, f0, f1, dur, vol, { when = 0, attack = 0.005, out = this.sfx } = {}) {
    if (!this.ctx || vol <= 0.001) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  shot() {
    this._noise(0.16, 'lowpass', 4200, 0.55, { sweep: 600 });
    this._tone('square', 160, 45, 0.09, 0.22);
  }
  enemyShot(dist) {
    const v = Math.max(0, 1 - dist / 70) * 0.35;
    this._noise(0.14, 'lowpass', 2200, v, { sweep: 400 });
  }
  empty() { this._tone('square', 1400, 1300, 0.03, 0.08); }
  hit(head) { this._tone('triangle', head ? 1500 : 950, head ? 1200 : 700, 0.07, 0.18); }
  kill() { this._tone('sine', 700, 1400, 0.18, 0.2); }
  hurt() {
    this._noise(0.22, 'bandpass', 420, 0.5, { q: 2 });
    this._tone('sawtooth', 180, 80, 0.2, 0.12);
  }
  reload() {
    this._noise(0.05, 'highpass', 2500, 0.3);
    this._noise(0.05, 'highpass', 2000, 0.35, { when: 0.35 });
    this._noise(0.06, 'highpass', 3000, 0.4, { when: 0.9 });
  }
  pickup() {
    [660, 880, 1320].forEach((f, i) => this._tone('triangle', f, f, 0.14, 0.18, { when: i * 0.06 }));
  }
  key() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this._tone('triangle', f, f, 0.3, 0.2, { when: i * 0.08 }));
  }
  fake() {
    this._tone('sawtooth', 300, 60, 0.4, 0.2);
    this.explode(0.5);
  }
  ghost(vol = 0.12) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const base = 260 + Math.random() * 160;
    o.frequency.setValueAtTime(base, t);
    o.frequency.linearRampToValueAtTime(base * 1.6, t + 0.5);
    o.frequency.linearRampToValueAtTime(base * 0.8, t + 1.3);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 6;
    const lg = this.ctx.createGain();
    lg.gain.value = 18;
    lfo.connect(lg).connect(o.frequency);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(this.sfx);
    o.start(t); lfo.start(t);
    o.stop(t + 1.5); lfo.stop(t + 1.5);
  }
  ghostDie() {
    this._noise(0.5, 'highpass', 600, 0.25, { sweep: 6000 });
    this._tone('sine', 800, 200, 0.5, 0.12);
  }
  explode(vol = 1) {
    this._noise(1.0, 'lowpass', 1200, 0.9 * vol, { sweep: 80 });
    this._tone('sine', 90, 30, 0.7, 0.5 * vol);
  }
  thunder() {
    this._noise(2.2, 'lowpass', 500, 0.7, { sweep: 60, when: 0.3 + Math.random() * 0.6 });
  }
  portal() {
    [392, 523, 659, 784].forEach((f, i) => this._tone('sine', f, f * 2, 0.6, 0.15, { when: i * 0.1 }));
  }
  bossRoar() {
    this._tone('sawtooth', 120, 40, 1.4, 0.3, { attack: 0.1 });
    this._noise(1.4, 'lowpass', 700, 0.4, { sweep: 100 });
  }
  orb() { this._tone('sine', 500, 1100, 0.25, 0.08); }
  click() { this._tone('triangle', 1200, 900, 0.05, 0.12); }

  startMusic(mood) {
    if (!this.ctx) return;
    this.stopMusic();
    const ctx = this.ctx;
    const bpm = mood === 'boss' ? 148 : mood === 'ghost' ? 76 : mood === 'menu' ? 92 : 118;
    const step = 60 / bpm / 2;
    const scale = mood === 'ghost' ? [0, 1, 5, 7, 8, 12] : [0, 3, 5, 7, 10, 12];
    const root = mood === 'ghost' ? 110 : mood === 'boss' ? 82.4 : 98;
    const arp = [0, 2, 4, 2, 1, 3, 5, 3, 0, 4, 2, 4, 1, 3, 2, 1];

    const drone = ctx.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = root / 2;
    const drone2 = ctx.createOscillator();
    drone2.type = 'sawtooth';
    drone2.frequency.value = root / 2 * 1.005;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = mood === 'ghost' ? 260 : 380;
    const dg = ctx.createGain();
    dg.gain.value = 0.12;
    drone.connect(lp); drone2.connect(lp);
    lp.connect(dg).connect(this.music);
    drone.start(); drone2.start();
    this.musicNodes = [drone, drone2];

    let n = 0;
    this.musicTimer = setInterval(() => {
      if (ctx.state !== 'running') return;
      const bar = Math.floor(n / 16) % 4;
      const shift = [0, 0, 5, 3][bar];
      if (mood !== 'ghost' && mood !== 'menu' && n % 4 === 0) {
        this._tone('sine', 140, 40, 0.25, 0.7, { out: this.music });
      }
      if (mood !== 'ghost' && mood !== 'menu' && n % 8 === 4) {
        this._noise(0.16, 'highpass', 1500, 0.35, { out: this.music });
      }
      if (mood === 'boss' && n % 2 === 1) this._noise(0.04, 'highpass', 7000, 0.15, { out: this.music });
      const every = mood === 'ghost' ? 4 : mood === 'menu' ? 2 : 1;
      if (n % every === 0) {
        const deg = scale[arp[(n / every) % arp.length]];
        const f = root * 2 * Math.pow(2, (deg + shift) / 12);
        this._tone(mood === 'ghost' ? 'sine' : 'triangle', f, f, mood === 'ghost' ? 1.2 : step * 1.8, 0.18, { out: this.music, attack: mood === 'ghost' ? 0.2 : 0.005 });
      }
      n++;
    }, step * 1000);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const node of this.musicNodes) { try { node.stop(); } catch (e) { /* already stopped */ } }
    this.musicNodes = [];
  }
}
