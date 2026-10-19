import * as THREE from 'three';

const matCache = new Map();
function mat(color, rough = 0.75, metal = 0, extra = {}) {
  const key = `${color}|${rough}|${metal}|${JSON.stringify(extra)}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra }));
  }
  return matCache.get(key);
}

const geoCache = new Map();
function geo(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}

export const SKIN = [0x8d5524, 0xa0663a, 0xc68642, 0x7a4a26, 0xb57846];

// Looks per role: parents wear traditional clothes, sons wear casual streetwear.
export const LOOKS = {
  father: [
    { shirt: 0xf2efe6, pants: 0xffffff, hair: 0x1b1714, extra: 0x8a1f1f },
    { shirt: 0x6d2b2b, pants: 0xf4f1e8, hair: 0x2a2420, extra: 0xd7a52b },
    { shirt: 0x3d4b2a, pants: 0xeeeadf, hair: 0x9a9a9a, extra: 0x8a1f1f },
  ],
  mother: [
    { shirt: 0xb0123c, pants: 0xb0123c, hair: 0x120d0b, extra: 0xe8b33a },
    { shirt: 0x1c6b4f, pants: 0x1c6b4f, hair: 0x120d0b, extra: 0xf0c050 },
    { shirt: 0x6a2c8f, pants: 0x6a2c8f, hair: 0x2a1d17, extra: 0xffa040 },
  ],
  son: [
    { shirt: 0x1e66d0, pants: 0x1f2633, hair: 0x15110e, extra: 0xffffff },
    { shirt: 0x14a38b, pants: 0x30343c, hair: 0x15110e, extra: 0xff5a36 },
    { shirt: 0xf0b21a, pants: 0x2b3a55, hair: 0x2b1e14, extra: 0x111111 },
    { shirt: 0xe23d3d, pants: 0x20242c, hair: 0x15110e, extra: 0xffffff },
  ],
};

function add(parent, mesh, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export function buildHumanoid({ kind, look, skin, teamColor }) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ'; // so the death fall tips over the character's own back
  const skinM = mat(skin, 0.6);
  const shirtM = mat(look.shirt, 0.85);
  const pantsM = mat(look.pants, 0.9);
  const hairM = mat(look.hair, 0.55);
  const extraM = mat(look.extra, 0.6, 0.1);
  const gunM = mat(0x23262b, 0.35, 0.7);
  const gunWood = mat(0x5b3b22, 0.7);
  const bandM = mat(teamColor, 0.4, 0.1, { emissive: teamColor, emissiveIntensity: 0.6 });

  const legGeo = geo('leg', () => new THREE.CapsuleGeometry(0.085, 0.62, 4, 8));
  const armGeo = geo('arm', () => new THREE.CapsuleGeometry(0.065, 0.46, 4, 8));
  const torsoGeo = geo('torso', () => new THREE.CapsuleGeometry(0.2, 0.36, 4, 12));
  const headGeo = geo('head', () => new THREE.SphereGeometry(0.14, 20, 16));
  const hairGeo = geo('hair', () => new THREE.SphereGeometry(0.148, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55));
  const eyeGeo = geo('eye', () => new THREE.SphereGeometry(0.018, 8, 6));
  const handGeo = geo('hand', () => new THREE.SphereGeometry(0.055, 10, 8));
  const shoeGeo = geo('shoe', () => new THREE.BoxGeometry(0.13, 0.08, 0.26));

  // legs
  const legs = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * 0.11, 0.92, 0);
    root.add(g);
    add(g, new THREE.Mesh(legGeo, pantsM), 0, -0.42, 0);
    add(g, new THREE.Mesh(shoeGeo, mat(kind === 'son' ? 0xf2f2f2 : 0x3a2618, 0.6)), 0, -0.86, 0.05);
    legs.push(g);
  }

  if (kind === 'mother') {
    const skirt = add(root, new THREE.Mesh(geo('skirt', () => new THREE.CylinderGeometry(0.2, 0.34, 0.88, 16, 1, true)), mat(look.shirt, 0.8, 0, { side: THREE.DoubleSide })), 0, 0.5, 0);
    skirt.receiveShadow = true;
    add(root, new THREE.Mesh(geo('border', () => new THREE.TorusGeometry(0.335, 0.025, 6, 20)), extraM), 0, 0.08, 0).rotation.x = Math.PI / 2;
  } else if (kind === 'father') {
    add(root, new THREE.Mesh(geo('veshti', () => new THREE.CylinderGeometry(0.22, 0.27, 0.82, 14, 1, true)), mat(look.pants, 0.9, 0, { side: THREE.DoubleSide })), 0, 0.53, 0);
    add(root, new THREE.Mesh(geo('vborder', () => new THREE.TorusGeometry(0.268, 0.018, 6, 20)), extraM), 0, 0.13, 0).rotation.x = Math.PI / 2;
  }

  // upper body
  const spine = new THREE.Group();
  spine.position.y = 0.95;
  root.add(spine);
  const torso = add(spine, new THREE.Mesh(torsoGeo, shirtM), 0, 0.3, 0);
  torso.scale.set(1.15, 1, 0.75);
  if (kind === 'mother') {
    const pallu = add(spine, new THREE.Mesh(geo('pallu', () => new THREE.BoxGeometry(0.12, 0.62, 0.34)), mat(look.extra, 0.7)), 0.05, 0.33, 0);
    pallu.rotation.z = 0.55;
  }
  if (kind === 'father') {
    add(spine, new THREE.Mesh(geo('towel', () => new THREE.TorusGeometry(0.2, 0.035, 6, 16, Math.PI)), mat(0xf6f1e4, 0.9)), 0, 0.55, 0).rotation.x = -Math.PI / 2;
  }
  // team armband - lets players tell teams apart at a glance
  add(spine, new THREE.Mesh(geo('band', () => new THREE.TorusGeometry(0.075, 0.022, 6, 14)), bandM), -0.27, 0.42, 0).rotation.x = Math.PI / 2;

  const head = new THREE.Group();
  head.position.y = 0.76;
  spine.add(head);
  add(head, new THREE.Mesh(geo('neck', () => new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8)), skinM), 0, -0.13, 0);
  add(head, new THREE.Mesh(headGeo, skinM), 0, 0, 0).scale.set(1, 1.08, 1);
  const hair = add(head, new THREE.Mesh(hairGeo, hairM), 0, 0.012, -0.012);
  hair.rotation.x = -0.25;
  add(head, new THREE.Mesh(eyeGeo, mat(0x0b0b0b, 0.3)), -0.05, 0.03, 0.128);
  add(head, new THREE.Mesh(eyeGeo, mat(0x0b0b0b, 0.3)), 0.05, 0.03, 0.128);
  if (kind === 'father') {
    add(head, new THREE.Mesh(geo('stache', () => new THREE.BoxGeometry(0.11, 0.022, 0.03)), hairM), 0, -0.035, 0.13);
    add(head, new THREE.Mesh(geo('tilak', () => new THREE.BoxGeometry(0.02, 0.04, 0.01)), mat(0xd23b2a, 0.5)), 0, 0.085, 0.137);
  } else if (kind === 'mother') {
    add(head, new THREE.Mesh(geo('bun', () => new THREE.SphereGeometry(0.075, 12, 10)), hairM), 0, 0.02, -0.16);
    add(head, new THREE.Mesh(geo('flower', () => new THREE.TorusGeometry(0.07, 0.018, 6, 14)), mat(0xfff6dc, 0.6)), 0, 0.03, -0.17);
    add(head, new THREE.Mesh(geo('bindi', () => new THREE.SphereGeometry(0.012, 8, 6)), mat(0xc0102c, 0.4)), 0, 0.07, 0.138);
  } else {
    // sons: cap or spiky hair
    if (look.extra !== 0x111111) {
      const cap = add(head, new THREE.Mesh(geo('cap', () => new THREE.SphereGeometry(0.152, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5)), mat(look.extra, 0.6)), 0, 0.02, 0);
      cap.rotation.x = -0.1;
      add(head, new THREE.Mesh(geo('visor', () => new THREE.BoxGeometry(0.2, 0.015, 0.12)), mat(look.extra, 0.6)), 0, 0.03, 0.17);
    } else {
      for (let i = 0; i < 5; i++) {
        const s = add(head, new THREE.Mesh(geo('spike', () => new THREE.ConeGeometry(0.04, 0.12, 6)), hairM), (i - 2) * 0.045, 0.14, -0.02);
        s.rotation.x = -0.4;
      }
    }
  }

  // arms in aiming pose, both reaching toward the rifle
  const arms = [];
  for (const side of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(side * 0.28, 0.56, 0);
    spine.add(g);
    add(g, new THREE.Mesh(armGeo, kind === 'son' && side === 1 ? skinM : shirtM), 0, -0.27, 0);
    add(g, new THREE.Mesh(handGeo, skinM), 0, -0.55, 0);
    arms.push(g);
  }
  // side -1 is the character's right (it faces +z): right hand on the grip, left hand on the barrel
  arms[0].rotation.set(-1.21, 0, 0.15);
  arms[1].rotation.set(-1.4, 0, -0.5);

  const gun = new THREE.Group();
  gun.position.set(-0.1, 0.44, 0.34);
  spine.add(gun);
  add(gun, new THREE.Mesh(geo('gbody', () => new THREE.BoxGeometry(0.07, 0.11, 0.5)), gunM), 0, 0, 0.05);
  add(gun, new THREE.Mesh(geo('gstock', () => new THREE.BoxGeometry(0.06, 0.12, 0.24)), gunWood), 0, -0.02, -0.28);
  add(gun, new THREE.Mesh(geo('gbarrel', () => new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8)), gunM), 0, 0.02, 0.45).rotation.x = Math.PI / 2;
  add(gun, new THREE.Mesh(geo('gmag', () => new THREE.BoxGeometry(0.05, 0.18, 0.08)), gunM), 0, -0.12, 0.1).rotation.x = 0.3;
  add(gun, new THREE.Mesh(geo('gsight', () => new THREE.BoxGeometry(0.03, 0.04, 0.1)), mat(0x111214, 0.3, 0.8)), 0, 0.075, 0.02);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, 0.64);
  gun.add(muzzle);

  const scale = kind === 'son' ? 0.86 : kind === 'mother' ? 0.97 : 1.03;
  root.scale.setScalar(scale);
  root.userData.parts = { legs, arms, spine, head, gun, muzzle };
  root.userData.scale = scale;
  return root;
}

export function animateHumanoid(model, t, speed, pitch) {
  const p = model.userData.parts;
  const k = Math.min(speed / 5, 1.4);
  const sw = Math.sin(t * 9.5) * 0.65 * k;
  p.legs[0].rotation.x = sw;
  p.legs[1].rotation.x = -sw;
  p.spine.rotation.x = -pitch * 0.55;
  p.spine.position.y = 0.95 + Math.abs(Math.sin(t * 9.5)) * 0.04 * k;
  p.spine.rotation.y = Math.sin(t * 9.5) * 0.06 * k;
}

// Ghost (aathma) - glowing wispy spirit with no legs.
export function buildGhost(color = 0x7fe7ff, scale = 1, boss = false) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 18; i++) {
    const t = i / 18;
    const y = t * 1.7;
    let r;
    if (t < 0.55) r = 0.08 + Math.pow(t / 0.55, 0.8) * 0.4;
    else r = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.55) / 0.45, 2))) * 0.48;
    pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  const bodyMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: boss ? 0.9 : 0.75, transparent: true, opacity: 0.55,
    roughness: 0.2, depthWrite: false, side: THREE.DoubleSide,
  });
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), bodyMat);
  body.position.y = -0.6;
  g.add(body);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  core.position.y = 0.55;
  g.add(core);
  const eyeMat = new THREE.MeshBasicMaterial({ color: boss ? 0xffe04a : 0xff2a3a, toneMapped: false });
  const eyeGeo = new THREE.SphereGeometry(0.06, 10, 8);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    e.position.set(s * 0.14, 0.72, 0.4);
    e.scale.set(1, 1.4, 0.5);
    g.add(e);
  }
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color: 0x05060a }));
  mouth.position.set(0, 0.5, 0.42);
  mouth.scale.set(1, 1.5, 0.4);
  g.add(mouth);
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
  const arms = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Mesh(armGeo, bodyMat);
    a.position.set(s * 0.42, 0.35, 0.25);
    a.rotation.set(-1.2, 0, s * -0.25);
    g.add(a);
    arms.push(a);
  }
  if (boss) {
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xffd36a, emissive: 0xff9a2a, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), hornMat);
      h.position.set(s * 0.26, 1.05, 0);
      h.rotation.z = -s * 0.5;
      g.add(h);
    }
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 8, 20), hornMat);
    crown.position.y = 1.02;
    crown.rotation.x = Math.PI / 2;
    g.add(crown);
  }
  // Only the boss gets a real light: adding lights mid-level forces shader recompiles.
  if (boss) {
    const light = new THREE.PointLight(color, 40, 30, 2);
    light.position.y = 0.5;
    g.add(light);
  }
  g.scale.setScalar(scale);
  g.userData = { body, core, arms, bodyMat };
  return g;
}

export function animateGhost(g, t, phase) {
  const u = g.userData;
  u.body.rotation.y = Math.sin(t * 2 + phase) * 0.4;
  u.body.scale.set(1 + Math.sin(t * 5 + phase) * 0.05, 1 + Math.sin(t * 3 + phase) * 0.06, 1 + Math.cos(t * 5 + phase) * 0.05);
  u.core.material.opacity = 0.35 + Math.sin(t * 6 + phase) * 0.15;
  u.arms[0].rotation.x = -1.2 + Math.sin(t * 4 + phase) * 0.25;
  u.arms[1].rotation.x = -1.2 + Math.cos(t * 4 + phase) * 0.25;
}
