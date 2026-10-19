// Keyboard + mouse (pointer lock) and on-screen touch controls.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseFire = false;
    this.touchFire = false;
    this.touchSprint = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.joy = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.lookTouch = { id: null, x: 0, y: 0 };
    this.fireTouch = { id: null, x: 0, y: 0 };
    this.enabled = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.onPauseKey = null;

    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'Space') this.jumpQueued = true;
      if (e.code === 'KeyR') this.reloadQueued = true;
      if (e.code === 'Escape' || e.code === 'KeyP') this.onPauseKey && this.onPauseKey();
    });
    window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.mouseFire = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch || !this.enabled) return;
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock && canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.mouseFire = true;
    });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseFire = false; });
    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      }
    });

    this._setupTouch();
  }

  _setupTouch() {
    const layer = document.getElementById('touch');
    const base = document.getElementById('joy-base');
    const knob = document.getElementById('joy-knob');
    const R = 56;

    const btn = (id, down, up) => {
      const el = document.getElementById(id);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('down');
        down(e);
      });
      const release = (e) => { el.classList.remove('down'); up && up(e); };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', (e) => { if (id !== 't-fire') release(e); });
    };

    // FIRE also acts as a look pad while held, like most mobile shooters.
    btn('t-fire', (e) => {
      this.touchFire = true;
      this.fireTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
    }, () => { this.touchFire = false; this.fireTouch.id = null; });
    document.getElementById('t-fire').addEventListener('pointermove', (e) => {
      if (this.fireTouch.id !== e.pointerId) return;
      this.lookDX += (e.clientX - this.fireTouch.x) * 1.6;
      this.lookDY += (e.clientY - this.fireTouch.y) * 1.6;
      this.fireTouch.x = e.clientX;
      this.fireTouch.y = e.clientY;
    });
    btn('t-jump', () => { this.jumpQueued = true; });
    btn('t-reload', () => { this.reloadQueued = true; });
    btn('t-sprint', () => { this.touchSprint = !this.touchSprint; document.getElementById('t-sprint').classList.toggle('on', this.touchSprint); });

    layer.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      const left = e.clientX < window.innerWidth * 0.42;
      if (left && this.joy.id === null) {
        this.joy.id = e.pointerId;
        this.joy.ox = e.clientX;
        this.joy.oy = e.clientY;
        base.style.left = e.clientX - 70 + 'px';
        base.style.top = e.clientY - 70 + 'px';
        base.classList.add('active');
        knob.style.transform = 'translate(0px,0px)';
      } else if (!left && this.lookTouch.id === null) {
        this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      }
    });
    layer.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.ox;
        let dy = e.clientY - this.joy.oy;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
        this.joy.x = dx / R;
        this.joy.y = -dy / R;
      } else if (e.pointerId === this.lookTouch.id) {
        this.lookDX += (e.clientX - this.lookTouch.x) * 1.6;
        this.lookDY += (e.clientY - this.lookTouch.y) * 1.6;
        this.lookTouch.x = e.clientX;
        this.lookTouch.y = e.clientY;
      }
    });
    const end = (e) => {
      if (e.pointerId === this.joy.id) {
        this.joy.id = null;
        this.joy.x = this.joy.y = 0;
        base.classList.remove('active');
        knob.style.transform = 'translate(0px,0px)';
      }
      if (e.pointerId === this.lookTouch.id) this.lookTouch.id = null;
    };
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
  }

  reset() {
    this.lookDX = this.lookDY = 0;
    this.mouseFire = this.touchFire = false;
    this.jumpQueued = this.reloadQueued = false;
    this.joy.x = this.joy.y = 0;
  }

  move() {
    let x = 0, y = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) y += 1;
    if (this.keys.KeyS || this.keys.ArrowDown) y -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    x += this.joy.x;
    y += this.joy.y;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  get fire() { return this.mouseFire || this.touchFire; }
  get sprint() { return !!(this.keys.ShiftLeft || this.keys.ShiftRight) || this.touchSprint; }

  consumeLook() {
    const d = [this.lookDX, this.lookDY];
    this.lookDX = this.lookDY = 0;
    return d;
  }
  consumeJump() { const j = this.jumpQueued; this.jumpQueued = false; return j; }
  consumeReload() { const r = this.reloadQueued; this.reloadQueued = false; return r; }
}
