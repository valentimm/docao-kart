import * as THREE from 'three';
import { poseAt, project } from './track.js';
import { makeDocao, toonKart } from './docao.js';

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
    g.fillStyle = '#e7c48a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d7a86a';
    g.fillRect(0, h * 0.46, w, h * 0.08);
    const band = Math.max(10, Math.round(h * shoulderFrac));
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = (x / 32) % 2 === 0 ? '#ff4f8b' : '#ffe27a';
      g.fillRect(x, 0, 32, band);
      g.fillRect(x, h - band, 32, band);
    }
    g.fillStyle = '#fffaf2';
    g.fillRect(0, band, w, 5);
    g.fillRect(0, h - band - 5, w, 5);
    g.fillStyle = '#fff6e4';
    g.fillRect(8, h * 0.46, 52, h * 0.08);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function grassTexture() {
  const tex = canvasTexture(128, 128, (g) => {
    g.fillStyle = '#7ed15c';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#69c24c';
    for (let y = 0; y < 128; y += 16) g.fillRect(0, y, 128, 6);
    g.fillStyle = '#9ae06e';
    g.beginPath();
    g.arc(36, 40, 18, 0, Math.PI * 2);
    g.arc(92, 88, 22, 0, Math.PI * 2);
    g.fill();
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
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

function fenceTexture() {
  const tex = canvasTexture(128, 64, (g, w, h) => {
    g.fillStyle = '#d7a15c';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = (x / 16) % 2 === 0 ? '#e2b56d' : '#c48445';
      g.fillRect(x, 10, 15, h - 10);
      g.fillStyle = '#8d552c';
      g.fillRect(x + 14, 10, 2, h - 10);
    }
    g.fillStyle = '#ff4f8b';
    g.fillRect(0, 0, w, 8);
    g.fillStyle = '#ffe27a';
    g.fillRect(0, 8, w, 4);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function buildWall(track, side) {
  const pts = track.points;
  const n = pts.length;
  const lat = side * (track.halfWidth + 0.05);
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    positions.push(p.x + p.nx * lat, 0, p.z + p.nz * lat, p.x + p.nx * lat, 1.05, p.z + p.nz * lat);
    const u = p.dist / 1.15;
    uvs.push(u, 0, u, 1);
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
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: fenceTexture(), side: THREE.DoubleSide }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const _dummy = new THREE.Object3D();

function paintInstances(scene, geometry, material, items) {
  if (!items.length) return;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  items.forEach((item, index) => {
    _dummy.position.set(item.x, item.y, item.z);
    _dummy.rotation.set(item.rx || 0, item.ry || 0, item.rz || 0);
    _dummy.scale.set(item.sx || 1, item.sy || 1, item.sz || 1);
    _dummy.updateMatrix();
    mesh.setMatrixAt(index, _dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

function addPosts(scene, track) {
  const posts = [];
  const pts = track.points;
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    if (p.s < 0.015 || p.s > 0.985) continue;
    for (const side of [1, -1]) {
      const lat = side * (track.halfWidth + 0.02);
      posts.push({ x: p.x + p.nx * lat, y: 0.72, z: p.z + p.nz * lat });
    }
  }
  paintInstances(scene, new THREE.BoxGeometry(0.28, 1.45, 0.28), lambert(0x8a4b2a), posts);
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
  return shared;
}

export function createKartView(def, skinId = 'classico') {
  const group = new THREE.Group();
  group.rotation.order = 'YXZ';
  const bodyMat = toonKart(def.body);
  const accentMat = toonKart(def.accent);
  const dark = toonKart(0x3a2a24);
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

  let pig = null;
  let pigBase = 0.48;
  const mountPig = (id) => {
    if (pig) group.remove(pig);
    pig = makeDocao(id, { seated: true });
    pig.scale.setScalar(0.5);
    pig.position.set(0, pigBase, 0.05);
    group.add(pig);
  };
  mountPig(skinId);

  let flag = null;
  if (def.player) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), lambert(0x6b3a22));
    pole.position.set(-0.62, 0.95, -0.95);
    group.add(pole);
    flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.36, 0.22),
      new THREE.MeshBasicMaterial({ color: def.accent, side: THREE.DoubleSide }),
    );
    flag.position.set(-0.4, 1.12, -0.95);
    group.add(flag);
  }

  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 18),
    new THREE.MeshBasicMaterial({ color: 0x3d5a32, transparent: true, opacity: 0.28, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.045;

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture(def.name, def.player ? '#fff6e4' : '#ffffff'),
      transparent: true,
    }),
  );
  sprite.scale.set(def.player ? 2.6 : 2.2, 0.65, 1);
  sprite.position.y = 2.05;
  sprite.renderOrder = 5;
  group.add(sprite);

  group.scale.setScalar(1.12);
  return {
    group,
    blob,
    wheels,
    get pig() {
      return pig;
    },
    get pigBase() {
      return pigBase;
    },
    setSkin(id) {
      mountPig(id);
    },
    flag,
    spin: 0,
    hop: 0,
    boosting: false,
    phase: Math.random() * 6,
    skidAcc: 0,
    sparkAcc: 0,
  };
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
  const trunks = [];
  const crowns = [];
  const fruit = [];
  const hay = [];
  const stems = [];
  const petals = [];
  const seeds = [];
  for (let i = 0; i < pts.length; i += 5) {
    const p = pts[i];
    if (p.s < 0.07 || p.s > 0.95) continue;
    const outside = -track.inwardSign;
    const dist = track.halfWidth + 4.5 + rand() * 4;
    const x = p.x + p.nx * outside * dist;
    const z = p.z + p.nz * outside * dist;
    if (Math.abs(project(track, x, z).lateral) <= track.halfWidth + 3) continue;
    const h = 1.5 + rand() * 1.3;
    trunks.push({ x, y: h / 2, z, sy: h / 1.6 });
    const crown = 0.85 + rand() * 0.45;
    crowns.push({ x, y: h + 0.25, z, sx: crown, sy: crown, sz: crown });
    if (rand() > 0.45) fruit.push({ x: x + 0.35, y: h + 0.15, z: z + 0.35 });
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
    if (Math.abs(project(track, x, z).lateral) > track.halfWidth + 1.4) {
      hay.push({ x, y: 0.4, z, ry: p.yaw });
    }
  }
  for (let i = 0; i < pts.length; i += 8) {
    const p = pts[i];
    const x = p.x + p.nx * track.inwardSign * (track.halfWidth + 2.8);
    const z = p.z + p.nz * track.inwardSign * (track.halfWidth + 2.8);
    if (Math.abs(project(track, x, z).lateral) <= track.halfWidth + 1.6) continue;
    stems.push({ x, y: 0.62, z });
    petals.push({ x, y: 1.28, z });
    seeds.push({ x, y: 1.34, z });
  }
  const leaves = canvasTexture(64, 64, (g) => {
    const shade = g.createRadialGradient(24, 18, 4, 32, 32, 32);
    shade.addColorStop(0, '#b6ee78');
    shade.addColorStop(0.55, '#5cbf45');
    shade.addColorStop(1, '#2f8a32');
    g.fillStyle = shade;
    g.fillRect(0, 0, 64, 64);
  });
  paintInstances(scene, new THREE.CylinderGeometry(0.16, 0.28, 1.6, 6), lambert(0xa86a3a), trunks);
  paintInstances(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ map: leaves }), crowns);
  paintInstances(scene, new THREE.SphereGeometry(0.12, 6, 5), lambert(0xffb703), fruit);
  paintInstances(scene, new THREE.BoxGeometry(1.35, 0.8, 0.82), lambert(0xe6b15a), hay);
  paintInstances(scene, new THREE.CylinderGeometry(0.035, 0.05, 1.25, 5), lambert(0x3d8f32), stems);
  paintInstances(scene, new THREE.CylinderGeometry(0.26, 0.26, 0.08, 8), lambert(0xffd23f), petals);
  paintInstances(scene, new THREE.CylinderGeometry(0.09, 0.09, 0.1, 8), lambert(0x6b3a22), seeds);

  const stalks = [];
  const tops = [];
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      const x = 8 + i * 0.75;
      const z = -18 + j * 0.75;
      if (Math.abs(project(track, x, z).lateral) < track.halfWidth + 5) continue;
      stalks.push({ x, y: 0.72, z });
      tops.push({ x, y: 1.5, z });
    }
  }
  paintInstances(scene, new THREE.CylinderGeometry(0.045, 0.07, 1.45, 5), lambert(0xd7de55), stalks);
  paintInstances(scene, new THREE.SphereGeometry(0.16, 5, 4), lambert(0x7fbf45), tops);

  addBarn(scene, 2, -12);
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
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xb7e3ff);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7e3ff);
  scene.fog = new THREE.Fog(0xb7e3ff, 90, 250);

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 420);

  const hemi = new THREE.HemisphereLight(0xfff4d8, 0x69b85a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cc, 1.55);
  sun.position.set(48, 86, 24);
  scene.add(sun);
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
  const hillMat = lambert(0x6fbf4e);
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
