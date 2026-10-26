import * as THREE from 'three';
import { poseAt, project } from './track.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture(track) {
  const visual = track.halfWidth + track.shoulder;
  const shoulderFrac = track.shoulder / (2 * visual);
  const tex = canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#d8b07a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c49a62';
    g.fillRect(0, 0, w, 18);
    g.fillRect(0, h - 18, w, 18);
    const band = Math.max(8, Math.round(h * shoulderFrac));
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 === 0 ? '#ff4f8b' : '#ffe27a';
      g.fillRect(x, 0, 16, band);
      g.fillRect(x, h - band, 16, band);
    }
    g.fillStyle = '#fff6e4';
    g.fillRect(0, band + 3, w, 4);
    g.fillRect(0, h - band - 7, w, 4);
    g.fillStyle = 'rgba(120, 78, 40, 0.16)';
    g.fillRect(0, h * 0.42, w, 3);
    g.fillRect(0, h * 0.56, w, 3);
    g.fillStyle = '#f7ead2';
    g.fillRect(18, h * 0.47, 46, 14);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function grassTexture() {
  const tex = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#67bf49';
    g.fillRect(0, 0, 128, 128);
    const rand = rng(11);
    for (let i = 0; i < 220; i += 1) {
      g.fillStyle = rand() > 0.55 ? '#86d465' : '#4ea338';
      const s = 2 + rand() * 4;
      g.fillRect(rand() * 128, rand() * 128, s, s);
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(32, 32);
  return tex;
}

function stripeTexture() {
  return canvasTexture(128, 32, (g, w, h) => {
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 === 0 ? '#ff4f8b' : '#fff6e4';
      g.fillRect(x, 0, 16, h);
    }
  });
}

function buildRoad(track) {
  const pts = track.points;
  const n = pts.length;
  const half = track.halfWidth + track.shoulder;
  const positions = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const normals = new Float32Array(n * 2 * 3);
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const o = i * 6;
    positions[o] = p.x + p.nx * half;
    positions[o + 1] = 0.04;
    positions[o + 2] = p.z + p.nz * half;
    positions[o + 3] = p.x - p.nx * half;
    positions[o + 4] = 0.04;
    positions[o + 5] = p.z - p.nz * half;
    const u = p.dist / 4;
    uvs[i * 4] = u;
    uvs[i * 4 + 1] = 1;
    uvs[i * 4 + 2] = u;
    uvs[i * 4 + 3] = 0;
    normals[o + 1] = 1;
    normals[o + 4] = 1;
  }
  for (let i = 0; i < n; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = ((i + 1) % n) * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: roadTexture(track), side: THREE.DoubleSide }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

function buildWall(track, side) {
  const pts = track.points;
  const n = pts.length;
  const lat = side * (track.halfWidth + 0.05);
  const positions = [];
  const colors = [];
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    positions.push(p.x + p.nx * lat, 0, p.z + p.nz * lat, p.x + p.nx * lat, 1.05, p.z + p.nz * lat);
    const plank = Math.floor(p.dist / 2.2) % 2 === 0;
    const low = plank ? [0.93, 0.71, 0.45] : [0.8, 0.55, 0.32];
    const high = plank ? [1, 0.45, 0.68] : [1, 0.86, 0.42];
    colors.push(...low, ...high);
  }
  for (let i = 0; i < n; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = ((i + 1) % n) * 2;
    const d = c + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addPosts(scene, track) {
  const geo = new THREE.BoxGeometry(0.28, 1.45, 0.28);
  const mat = lambert(0x8a4b2a);
  const pts = track.points;
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    if (p.s < 0.015 || p.s > 0.985) continue;
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(geo, mat);
      const lat = side * (track.halfWidth + 0.02);
      post.position.set(p.x + p.nx * lat, 0.72, p.z + p.nz * lat);
      post.castShadow = true;
      scene.add(post);
    }
  }
}

function labelTexture(text, fill) {
  return canvasTexture(256, 64, (g) => {
    g.clearRect(0, 0, 256, 64);
    g.font = '700 36px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = '#5c3317';
    g.strokeText(text, 128, 34);
    g.fillStyle = fill;
    g.fillText(text, 128, 34);
  });
}

function plateTexture(number, accent) {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#fffaf2';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = accent;
    g.lineWidth = 10;
    g.strokeRect(8, 8, 112, 112);
    g.fillStyle = '#5c3317';
    g.font = '800 78px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(number, 64, 70);
  });
}

const shared = {};

function geos() {
  if (shared.ready) return shared;
  shared.ready = true;
  shared.wheel = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12);
  shared.wheel.rotateZ(Math.PI / 2);
  shared.hub = new THREE.CylinderGeometry(0.14, 0.14, 0.26, 10);
  shared.hub.rotateZ(Math.PI / 2);
  shared.body = new THREE.SphereGeometry(0.58, 16, 12);
  shared.head = new THREE.SphereGeometry(0.4, 16, 12);
  shared.snout = new THREE.SphereGeometry(0.2, 12, 10);
  shared.nostril = new THREE.SphereGeometry(0.035, 6, 6);
  shared.ear = new THREE.SphereGeometry(0.18, 8, 8);
  shared.eye = new THREE.SphereGeometry(0.07, 8, 8);
  shared.pupil = new THREE.SphereGeometry(0.034, 6, 6);
  shared.cheek = new THREE.SphereGeometry(0.07, 8, 8);
  return shared;
}

function makePig(def) {
  const g = geos();
  const group = new THREE.Group();
  const skin = lambert(def.pig);
  const snoutMat = lambert(def.snout);
  const earMat = lambert(def.ear);
  const dark = lambert(0x5c3317);
  const white = lambert(0xfffaf3);
  const blush = lambert(0xff8fab);

  const body = new THREE.Mesh(g.body, skin);
  body.scale.set(1.05, 0.88, 1.22);
  body.position.y = 0.42;
  group.add(body);

  const head = new THREE.Mesh(g.head, skin);
  head.position.set(0, 0.92, 0.42);
  group.add(head);

  const snout = new THREE.Mesh(g.snout, snoutMat);
  snout.scale.set(1.15, 0.82, 0.7);
  snout.position.set(0, 0.84, 0.74);
  group.add(snout);

  for (const x of [-0.07, 0.07]) {
    const nostril = new THREE.Mesh(g.nostril, dark);
    nostril.position.set(x, 0.84, 0.86);
    group.add(nostril);
  }

  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(g.ear, earMat);
    ear.scale.set(0.55, 1.15, 0.28);
    ear.position.set(0.26 * side, 1.24, 0.32);
    ear.rotation.z = side * -0.5;
    group.add(ear);
    const inner = new THREE.Mesh(g.ear, blush);
    inner.scale.set(0.28, 0.7, 0.16);
    inner.position.set(0.26 * side, 1.22, 0.38);
    inner.rotation.z = side * -0.5;
    group.add(inner);

    const eye = new THREE.Mesh(g.eye, white);
    eye.position.set(0.15 * side, 0.98, 0.72);
    group.add(eye);
    const pupil = new THREE.Mesh(g.pupil, dark);
    pupil.position.set(0.16 * side, 0.97, 0.78);
    group.add(pupil);
    const cheek = new THREE.Mesh(g.cheek, blush);
    cheek.position.set(0.24 * side, 0.84, 0.62);
    group.add(cheek);
  }

  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.045, 6, 12),
    lambert(def.bandana),
  );
  band.position.set(0, 0.72, 0.38);
  band.rotation.x = Math.PI / 2.3;
  group.add(band);

  if (def.hat === 'straw') {
    const straw = lambert(0xf0d48a);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), straw);
    brim.position.set(0, 1.32, 0.36);
    group.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.2, 10), lambert(0xffe7a8));
    top.position.set(0, 1.44, 0.36);
    group.add(top);
  } else if (def.hat === 'bow') {
    const bowMat = lambert(def.bandana);
    for (const side of [-1, 1]) {
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bowMat);
      lobe.scale.set(1.3, 0.8, 0.5);
      lobe.position.set(0.12 * side, 1.28, 0.36);
      group.add(lobe);
    }
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), lambert(0xfff6e4));
    knot.position.set(0, 1.28, 0.4);
    group.add(knot);
  }

  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 6, 10, Math.PI * 1.4), blush);
  tail.position.set(0, 0.48, -0.48);
  tail.rotation.y = Math.PI;
  group.add(tail);
  return group;
}

export function createKartView(def) {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const bodyMat = lambert(def.body);
  const accentMat = lambert(def.accent);
  const dark = lambert(0x3a2a24);
  const tireMat = lambert(0x2c2422);

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.32, 2.05), bodyMat);
  chassis.position.set(0, 0.46, 0);
  group.add(chassis);

  const belly = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 1.5), dark);
  belly.position.set(0, 0.28, 0);
  group.add(belly);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.18, 0.46), accentMat);
  nose.position.set(0, 0.42, 1.05);
  group.add(nose);

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 1.7), accentMat);
  stripe.position.set(0, 0.62, 0.05);
  group.add(stripe);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.28, 0.52), dark);
  seat.position.set(0, 0.7, -0.18);
  group.add(seat);

  const wingPostL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.38, 0.08), dark);
  wingPostL.position.set(-0.42, 0.78, -0.92);
  group.add(wingPostL);
  const wingPostR = wingPostL.clone();
  wingPostR.position.x = 0.42;
  group.add(wingPostR);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.08, 0.32), accentMat);
  wing.position.set(0, 0.98, -0.92);
  group.add(wing);

  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.36, 0.36),
    new THREE.MeshBasicMaterial({ map: plateTexture(def.number, '#ff4f8b') }),
  );
  plate.position.set(0, 0.64, 0.72);
  plate.rotation.x = -0.4;
  group.add(plate);

  const g = geos();
  const wheels = [];
  const spots = [
    { x: -0.72, z: 0.72, front: true },
    { x: 0.72, z: 0.72, front: true },
    { x: -0.72, z: -0.72, front: false },
    { x: 0.72, z: -0.72, front: false },
  ];
  for (const spot of spots) {
    const pivot = new THREE.Group();
    pivot.position.set(spot.x, 0.3, spot.z);
    const tire = new THREE.Mesh(g.wheel, tireMat);
    const hub = new THREE.Mesh(g.hub, accentMat);
    pivot.add(tire);
    pivot.add(hub);
    group.add(pivot);
    wheels.push({ pivot, spin: tire, front: spot.front, hub });
  }

  const pig = makePig(def);
  pig.position.set(0, 0.62, -0.12);
  group.add(pig);

  let flag = null;
  if (def.player) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), lambert(0x6b3a22));
    pole.position.set(-0.15, 1.25, -0.72);
    group.add(pole);
    flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.24),
      new THREE.MeshBasicMaterial({ color: def.accent, side: THREE.DoubleSide }),
    );
    flag.position.set(0.12, 1.5, -0.72);
    group.add(flag);
  }

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  plate.castShadow = false;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture(def.name, def.player ? '#fff6e4' : '#ffffff'),
      transparent: true,
      depthTest: false,
    }),
  );
  sprite.scale.set(def.player ? 2.6 : 2.2, 0.65, 1);
  sprite.position.y = 2.25;
  sprite.renderOrder = 5;
  group.add(sprite);

  group.scale.setScalar(1.12);
  return { group, wheels, pig, pigBase: pig.position.y, flag, spin: 0, hop: 0, boosting: false, phase: Math.random() * 6, skidAcc: 0 };
}

function addBarn(scene, x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(8.2, 4.2, 6), lambert(0xd4573c));
  wall.position.y = 2.1;
  group.add(wall);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.28, 6.15), lambert(0xfff6e4));
  trim.position.y = 3.5;
  group.add(trim);
  const roofMat = lambert(0x8f342c);
  for (const side of [-1, 1]) {
    const slope = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.28, 6.8), roofMat);
    slope.position.set(1.55 * side, 4.55, 0);
    slope.rotation.z = -0.5 * side;
    group.add(slope);
  }
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.7, 2.5, 0.16), lambert(0xfff1d6));
  door.position.set(0, 1.25, 3.05);
  group.add(door);
  const cup = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.15, 1.3), lambert(0xffe27a));
  cup.position.y = 5.45;
  group.add(cup);
  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(group);
}

function addTent(scene, x, z, color, yaw) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  const cloth = lambert(color);
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.1, 2.5), cloth);
    panel.position.y = 1.55;
    panel.rotation.z = 0.5 * side;
    group.add(panel);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.15, 6), lambert(0xfff6e4));
  pole.position.y = 1.05;
  group.add(pole);
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
}

function addTree(scene, x, z, rand) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const h = 1.5 + rand() * 1.3;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h, 6), lambert(0x8a5430));
  trunk.position.y = h / 2;
  group.add(trunk);
  const leaf = lambert(rand() > 0.5 ? 0x3f9d3c : 0x6bc24c);
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.85 + rand() * 0.45, 8, 7), leaf);
  crown.position.y = h + 0.25;
  group.add(crown);
  if (rand() > 0.45) {
    const fruit = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 6, 6),
      lambert(rand() > 0.5 ? 0xff8a3d : 0xffd23f),
    );
    fruit.position.set(0.35, h + 0.15, 0.35);
    group.add(fruit);
  }
  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  scene.add(group);
}

function addFlower(scene, x, z, yaw) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.25, 5), lambert(0x3d8f32));
  stem.position.y = 0.62;
  group.add(stem);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 8), lambert(0xffd23f));
  head.position.y = 1.28;
  group.add(head);
  const center = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), lambert(0x6b3a22));
  center.position.y = 1.34;
  group.add(center);
  scene.add(group);
}

function addHay(scene, x, z, yaw) {
  const bale = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.8, 0.82), lambert(0xe6b15a));
  bale.position.set(x, 0.4, z);
  bale.rotation.y = yaw;
  bale.castShadow = true;
  bale.receiveShadow = true;
  scene.add(bale);
}

function addCorn(scene, track, ox, oz) {
  const stalkGeo = new THREE.CylinderGeometry(0.045, 0.07, 1.45, 5);
  const topGeo = new THREE.SphereGeometry(0.16, 6, 5);
  const stalkMat = lambert(0xd7de55);
  const topMat = lambert(0x7fbf45);
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const x = ox + i * 0.75;
      const z = oz + j * 0.75;
      if (Math.abs(project(track, x, z).lateral) < track.halfWidth + 5) continue;
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.set(x, 0.72, z);
      scene.add(stalk);
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.set(x, 1.5, z);
      scene.add(top);
    }
  }
}

function addBanner(scene, track) {
  const pose = poseAt(track, 0, 0);
  const group = new THREE.Group();
  group.position.set(pose.x, 0, pose.z);
  group.rotation.y = pose.yaw;
  const span = track.halfWidth * 2 + 1.4;
  const wood = lambert(0x8a4b2a);
  for (const x of [-span / 2, span / 2]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.4, 8), wood);
    pole.position.set(x, 1.7, 0);
    pole.castShadow = true;
    group.add(pole);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(span, 0.16, 0.16), wood);
  bar.position.set(0, 3.3, 0);
  group.add(bar);

  const signMap = canvasTexture(512, 168, (g) => {
    g.fillStyle = '#ff4f8b';
    g.fillRect(0, 0, 512, 168);
    g.fillStyle = '#ffe27a';
    g.fillRect(0, 118, 512, 50);
    g.fillStyle = '#fffaf2';
    g.font = '800 74px Inter, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('DOCÃO KART', 256, 62);
    g.fillStyle = '#6b3a22';
    g.font = '700 28px Inter, sans-serif';
    g.fillText('FEIRA DA FAZENDA', 256, 140);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(span - 0.6, (span - 0.6) * (168 / 512)),
    new THREE.MeshBasicMaterial({ map: signMap, side: THREE.DoubleSide }),
  );
  sign.position.set(0, 2.55, 0);
  group.add(sign);

  const bulbs = [];
  for (let i = 0; i < 3; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a3030 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), mat);
    bulb.position.set(-0.7 + i * 0.7, 3.55, 0);
    group.add(bulb);
    bulbs.push(mat);
  }

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(track.halfWidth * 2 - 0.4, 1.5),
    new THREE.MeshBasicMaterial({ map: stripeTexture(), transparent: true, depthWrite: false }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.07;
  group.add(stripe);

  scene.add(group);
  return bulbs;
}

function addBleachers(scene, track) {
  const wood = lambert(0xf2d2a2);
  const cushion = lambert(0xff8fb8);
  for (let i = 0; i < 6; i += 1) {
    const s = (1 + (i - 2.5) * 0.011) % 1;
    const pose = poseAt(track, s, -track.inwardSign * (track.halfWidth + 4.4));
    const group = new THREE.Group();
    group.position.set(pose.x, 0, pose.z);
    group.rotation.y = pose.yaw;
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.35, 1.5), wood);
    base.position.y = 0.18;
    group.add(base);
    const row = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.38, 1.15), cushion);
    row.position.set(0, 0.62, -0.15);
    group.add(row);
    group.traverse((child) => {
      if (child.isMesh) child.castShadow = true;
    });
    scene.add(group);
  }
}

function addClouds(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const rand = rng(21);
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const group = new THREE.Group();
    const count = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < count; k += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(1.8 + rand() * 2, 8, 6), mat);
      puff.position.set((k - count / 2) * 2.3, rand() * 0.5, (rand() - 0.5) * 1.4);
      group.add(puff);
    }
    group.position.set((rand() - 0.5) * 200, 26 + rand() * 12, (rand() - 0.5) * 160);
    scene.add(group);
    clouds.push({ mesh: group, speed: 1.2 + rand() * 1.8 });
  }
  return clouds;
}

function dressTrack(scene, track) {
  const rand = rng(42);
  const pts = track.points;
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    if (p.s < 0.07 || p.s > 0.95) continue;
    const outside = -track.inwardSign;
    const dist = track.halfWidth + 4.5 + rand() * 4;
    const x = p.x + p.nx * outside * dist;
    const z = p.z + p.nz * outside * dist;
    if (Math.abs(project(track, x, z).lateral) > track.halfWidth + 3) addTree(scene, x, z, rand);
  }
  for (let i = 0; i < pts.length; i += 7) {
    const p = pts[i];
    const next = pts[(i + 3) % pts.length];
    let dy = next.yaw - p.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    if (Math.abs(dy) < 0.18) continue;
    const side = -track.inwardSign;
    const x = p.x + p.nx * side * (track.halfWidth + 2.3);
    const z = p.z + p.nz * side * (track.halfWidth + 2.3);
    if (Math.abs(project(track, x, z).lateral) > track.halfWidth + 1.4) addHay(scene, x, z, p.yaw);
  }
  for (let i = 0; i < pts.length; i += 8) {
    const p = pts[i];
    const x = p.x + p.nx * track.inwardSign * (track.halfWidth + 2.8);
    const z = p.z + p.nz * track.inwardSign * (track.halfWidth + 2.8);
    const lat = Math.abs(project(track, x, z).lateral);
    if (lat > track.halfWidth + 1.6) addFlower(scene, x, z, p.yaw);
  }

  addBarn(scene, 2, -12);
  addCorn(scene, track, 8, -18);
  const tents = [
    [-10, -6, 0xff4f8b, 0.4],
    [14, 2, 0x2ec4b6, -0.6],
    [-6, 8, 0xffd84a, 0.2],
    [6, -2, 0x9b5de5, 1],
  ];
  for (const [x, z, color, yaw] of tents) {
    if (Math.abs(project(track, x, z).lateral) > track.halfWidth + 6) addTent(scene, x, z, color, yaw);
  }
}

export function setLights(bulbs, phase) {
  bulbs.forEach((mat, index) => {
    if (phase >= 4) mat.color.set(0x7dff6a);
    else if (index < phase) mat.color.set(0xff4040);
    else mat.color.set(0x4a3030);
  });
}

export function createEffects(scene) {
  const skidGeo = new THREE.PlaneGeometry(0.32, 0.72);
  skidGeo.rotateX(-Math.PI / 2);
  const skids = [];
  for (let i = 0; i < 56; i += 1) {
    const mesh = new THREE.Mesh(
      skidGeo,
      new THREE.MeshBasicMaterial({ color: 0x6a503c, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.visible = false;
    mesh.position.y = 0.055;
    scene.add(mesh);
    skids.push({ mesh, life: 0 });
  }
  const sparkGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const sparks = [];
  for (let i = 0; i < 32; i += 1) {
    const mesh = new THREE.Mesh(sparkGeo, new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    mesh.visible = false;
    scene.add(mesh);
    sparks.push({ mesh, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let skidCursor = 0;
  let sparkCursor = 0;
  return {
    skid(x, z, yaw) {
      const s = skids[skidCursor % skids.length];
      skidCursor += 1;
      s.mesh.visible = true;
      s.mesh.position.set(x, 0.06, z);
      s.mesh.rotation.y = yaw;
      s.life = 1;
      s.mesh.material.opacity = 0.4;
    },
    spark(x, y, z, color, power = 1) {
      const s = sparks[sparkCursor % sparks.length];
      sparkCursor += 1;
      s.mesh.visible = true;
      s.mesh.position.set(x, y, z);
      s.mesh.material.color.set(color);
      s.life = 0.28 + Math.random() * 0.22;
      s.vx = (Math.random() - 0.5) * 5 * power;
      s.vy = (1.5 + Math.random() * 3) * power;
      s.vz = (Math.random() - 0.5) * 5 * power;
    },
    update(dt) {
      for (const s of skids) {
        if (!s.mesh.visible) continue;
        s.life -= dt * 0.32;
        s.mesh.material.opacity = Math.max(0, s.life) * 0.4;
        if (s.life <= 0) s.mesh.visible = false;
      }
      for (const s of sparks) {
        if (!s.mesh.visible) continue;
        s.life -= dt;
        s.vy -= 8 * dt;
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.y += s.vy * dt;
        s.mesh.position.z += s.vz * dt;
        const scale = Math.max(0.2, s.life * 2);
        s.mesh.scale.setScalar(scale);
        if (s.life <= 0 || s.mesh.position.y < 0.05) s.mesh.visible = false;
      }
    },
  };
}

export function createWorld(canvas, track) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x8ecfff);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecfff);
  scene.fog = new THREE.Fog(0x8ecfff, 120, 280);

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 420);

  const hemi = new THREE.HemisphereLight(0xfff4d8, 0x69b85a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cc, 1.45);
  sun.position.set(48, 86, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const frustum = 115;
  sun.shadow.camera.left = -frustum;
  sun.shadow.camera.right = frustum;
  sun.shadow.camera.top = frustum;
  sun.shadow.camera.bottom = -frustum;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 240;
  sun.shadow.bias = -0.00035;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xffc4de, 0.35);
  fill.position.set(-40, 24, -30);
  scene.add(fill);

  const grass = new THREE.Mesh(new THREE.PlaneGeometry(460, 460), new THREE.MeshLambertMaterial({ map: grassTexture() }));
  grass.rotation.x = -Math.PI / 2;
  grass.receiveShadow = true;
  scene.add(grass);

  scene.add(buildRoad(track));
  scene.add(buildWall(track, 1));
  scene.add(buildWall(track, -1));
  addPosts(scene, track);
  addBleachers(scene, track);
  dressTrack(scene, track);
  const bulbs = addBanner(scene, track);

  const rand = rng(9);
  const hillMat = lambert(0x58a844);
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(16 + rand() * 10, 10, 8), hillMat);
    hill.position.set(Math.cos(a) * 168, -8, Math.sin(a) * 150);
    hill.scale.y = 0.42;
    scene.add(hill);
  }
  const clouds = addClouds(scene);
  const effects = createEffects(scene);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }

  function updateClouds(dt) {
    for (const cloud of clouds) {
      cloud.mesh.position.x += cloud.speed * dt;
      if (cloud.mesh.position.x > 130) cloud.mesh.position.x = -130;
    }
  }

  return { renderer, scene, camera, bulbs, effects, resize, updateClouds };
}
