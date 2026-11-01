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
  tex.anisotropy = 8;
  return tex;
}

const flowMaps = [];

function paintSpecks(g, rand, x, y, w, h, colors, count, tile = false) {
  for (let i = 0; i < count; i += 1) {
    g.fillStyle = colors[i % colors.length];
    const s = 1 + rand() * 2.4;
    const sh = s * (0.55 + rand() * 0.7);
    const px = x + rand() * w;
    const py = y + rand() * h;
    g.fillRect(px, py, s, sh);
    if (!tile) continue;
    const overX = px + s > x + w;
    const overY = py + sh > y + h;
    if (overX) g.fillRect(px - w, py, s, sh);
    if (overY) g.fillRect(px, py - h, s, sh);
    if (overX && overY) g.fillRect(px - w, py - h, s, sh);
  }
}

function grassTexture(repeatX, repeatY) {
  const rand = rng(18);
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#4ea83c';
    g.fillRect(0, 0, w, h);
    paintSpecks(g, rand, 0, 0, w, h, ['#3d8c30', '#62c04e', '#2f6b28', '#8ed36a', '#6a9a3a'], 700, true);
    g.lineWidth = 1;
    for (let i = 0; i < 520; i += 1) {
      const x = rand() * w;
      const y = rand() * h;
      g.strokeStyle = rand() > 0.5 ? 'rgba(20, 70, 24, 0.45)' : 'rgba(210, 235, 140, 0.35)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rand() - 0.5) * 4, y - 3 - rand() * 7);
      g.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  return tex;
}

function barkTexture() {
  const rand = rng(31);
  const tex = canvasTexture(64, 128, (g, w, h) => {
    g.fillStyle = '#6d4630';
    g.fillRect(0, 0, w, h);
    for (let x = 2; x < w; x += 4) {
      g.strokeStyle = rand() > 0.5 ? '#4a2c1c' : '#8a5a38';
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 2, h * 0.3, x - 2, h * 0.7, x + 1, h);
      g.stroke();
    }
    paintSpecks(g, rand, 0, 0, w, h, ['#3d2416', '#a56b42'], 40);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function sandTexture() {
  const rand = rng(12);
  const tex = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#c4a36a';
    g.fillRect(0, 0, w, h);
    paintSpecks(g, rand, 0, 0, w, h, ['#ad8b52', '#ddc48a', '#8a6840', '#efe0b8'], 280);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function waterTexture() {
  const rand = rng(23);
  const tex = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#2f9a9a';
    g.fillRect(0, 0, w, h);
    const pool = g.createRadialGradient(w * 0.5, h * 0.45, 10, w * 0.5, h * 0.5, w * 0.55);
    pool.addColorStop(0, 'rgba(180, 235, 230, 0.28)');
    pool.addColorStop(1, 'rgba(16, 80, 84, 0.18)');
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    g.lineWidth = 2;
    for (let y = 10; y < h; y += 16) {
      g.beginPath();
      for (let x = 0; x <= w; x += 6) {
        const wave = y + Math.sin(x * 0.07 + y * 0.15) * 3.2;
        if (x === 0) g.moveTo(x, wave);
        else g.lineTo(x, wave);
      }
      g.stroke();
    }
    g.fillStyle = 'rgba(255, 255, 255, 0.16)';
    for (let i = 0; i < 24; i += 1) {
      g.beginPath();
      g.ellipse(rand() * w, rand() * h, 8 + rand() * 14, 2 + rand() * 2, rand() * 0.6, 0, Math.PI * 2);
      g.fill();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  flowMaps.push(tex);
  return tex;
}

function strawTexture() {
  const rand = rng(8);
  const tex = canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#e2b15a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c48a32';
    for (let i = 0; i < 28; i += 1) {
      g.beginPath();
      g.moveTo(rand() * w, 0);
      g.lineTo(rand() * w, h);
      g.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function parkRoadTexture(track) {
  const visual = track.halfWidth + track.shoulder;
  const shoulderFrac = track.shoulder / (2 * visual);
  const rand = rng(44);
  const tex = canvasTexture(256, 512, (g, w, h) => {
    const curb = Math.max(22, Math.round(h * shoulderFrac));
    const px = h / 256;
    const band = Math.max(8, Math.round(w * (28 / 128)));
    g.fillStyle = '#6b6358';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a635f';
    g.fillRect(0, curb + 14 * px, w, h - (curb + 14 * px) * 2);
    paintSpecks(g, rand, 0, curb + 14 * px, w, h - (curb + 14 * px) * 2, ['#4c5552', '#6d7772', '#3e4644', '#7a8480'], 900);
    g.fillStyle = '#dfe7df';
    g.fillRect(0, curb, w, 8 * px);
    g.fillRect(0, h - curb - 8 * px, w, 8 * px);
    for (let x = 0; x < w; x += band) {
      g.fillStyle = Math.round(x / band) % 2 === 0 ? '#2f8f4e' : '#f4f7f2';
      g.fillRect(x, 0, band, curb);
      g.fillRect(x, h - curb, band, curb);
    }
    g.fillStyle = '#f2f4ef';
    g.fillRect(w * 0.14, h * 0.5 - 6, w * 0.38, 10);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function roadTexture(track) {
  if (track.theme === 'parque') return parkRoadTexture(track);
  const visual = track.halfWidth + track.shoulder;
  const shoulderFrac = track.shoulder / (2 * visual);
  const rand = rng(45);
  const tex = canvasTexture(256, 512, (g, w, h) => {
    const curb = Math.max(22, Math.round(h * shoulderFrac));
    const px = h / 256;
    const band = Math.max(8, Math.round(w * (32 / 128)));
    g.fillStyle = '#e2b56b';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#efd0a0';
    g.fillRect(0, curb + 18 * px, w, h - (curb + 18 * px) * 2);
    paintSpecks(g, rand, 0, curb + 18 * px, w, h - (curb + 18 * px) * 2, ['#d7b178', '#f6e2bc', '#c49558', '#a87840'], 900);
    g.fillStyle = '#c9954e';
    g.fillRect(0, curb, w, 16 * px);
    g.fillRect(0, h - curb - 16 * px, w, 16 * px);
    for (let x = 0; x < w; x += band) {
      g.fillStyle = Math.round(x / band) % 2 === 0 ? '#ff4f8b' : '#ffe27a';
      g.fillRect(x, 0, band, curb);
      g.fillRect(x, h - curb, band, curb);
    }
    g.fillStyle = '#fffaf2';
    g.fillRect(0, curb, w, 7);
    g.fillRect(0, h - curb - 7, w, 7);
    g.fillRect(w * 0.06, h * 0.5 - 8, w * 0.56, 16);
  });
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function addMeadow(scene) {
  const geo = new THREE.PlaneGeometry(780, 780, 28, 28);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = Math.sin(x * 0.008 + 0.6) * 0.7 + Math.sin(z * 0.007 + 1.3) * 0.55;
    const tint = 0.9 + n * 0.08;
    color.setRGB(tint, tint + 0.02, tint * 0.92);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ map: grassTexture(34, 34), vertexColors: true }),
  );
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function checkerTexture() {
  const cols = 12;
  const rows = 3;
  const tex = canvasTexture(cols * 16, rows * 16, (g, w, h) => {
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        g.fillStyle = (x + y) % 2 === 0 ? '#1a1a1a' : '#f7f4ee';
        g.fillRect(x * cw, y * ch, cw + 1, ch + 1);
      }
    }
  });
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
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

function addRail(scene, track, side, y, height, thick, color) {
  const pts = track.points;
  const n = pts.length;
  const lat = side * (track.halfWidth + 0.02);
  const positions = [];
  const indices = [];
  for (let i = 0; i < n; i += 1) {
    const p = pts[i];
    const ox = p.x + p.nx * (lat + side * thick);
    const oz = p.z + p.nz * (lat + side * thick);
    const ix = p.x + p.nx * lat;
    const iz = p.z + p.nz * lat;
    positions.push(ox, y, oz, ox, y + height, oz, ix, y + height, iz, ix, y, iz);
  }
  for (let i = 0; i < n; i += 1) {
    const a = i * 4;
    const b = ((i + 1) % n) * 4;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
    indices.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    indices.push(a + 3, a + 2, b + 3, b + 3, a + 2, b + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  mesh.castShadow = true;
  scene.add(mesh);
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

function addFence(scene, track) {
  const park = track.theme === 'parque';
  for (const side of [1, -1]) {
    addRail(scene, track, side, 0, 0.28, 0.1, park ? 0x6d5434 : 0xc9844a);
    addRail(scene, track, side, 0.52, 0.1, 0.08, park ? 0xd7e7cf : 0xf3d7a4);
    addRail(scene, track, side, 0.98, 0.12, 0.1, park ? 0x2f6b3a : 0xff4f8b);
  }
  const posts = [];
  const caps = [];
  const pts = track.points;
  for (let i = 0; i < pts.length; i += 3) {
    const p = pts[i];
    if (p.s < 0.015 || p.s > 0.985) continue;
    for (const side of [1, -1]) {
      const lat = side * (track.halfWidth + 0.06);
      const x = p.x + p.nx * lat;
      const z = p.z + p.nz * lat;
      posts.push({ x, y: 0.78, z, ry: p.yaw });
      caps.push({ x, y: 1.62, z, ry: p.yaw });
    }
  }
  paintInstances(scene, new THREE.BoxGeometry(0.34, 1.56, 0.2), lambert(track.theme === 'parque' ? 0x4e3a28 : 0x6b3a22), posts);
  paintInstances(scene, new THREE.BoxGeometry(0.46, 0.1, 0.3), lambert(track.theme === 'parque' ? 0xd7f2c2 : 0xfff6e4), caps);
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
    setPaint(body, accent) {
      bodyMat.color.set(body);
      accentMat.color.set(accent);
      if (flag) flag.material.color.set(accent);
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
  const park = track.theme === 'parque';
  const span = track.halfWidth * 2 + 1.6;
  const half = span / 2;
  const postH = 3.5;
  const rise = 1.25;
  const radius = (half * half + rise * rise) / (2 * rise);
  const arc = 2 * Math.asin(Math.min(0.999, half / radius));
  const wood = lambert(park ? 0x4e3a28 : 0x8a4b2a);
  const accent = lambert(park ? 0x2f6b3a : 0xff4f8b);
  for (const x of [-half, half]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, postH, 0.42), wood);
    post.position.set(x, postH / 2, 0);
    post.castShadow = true;
    group.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), accent);
    cap.position.set(x, postH + 0.06, 0);
    group.add(cap);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.16, 0.18, 0.26), wood);
  beam.position.y = postH;
  beam.castShadow = true;
  group.add(beam);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.11, 6, 28, arc), accent);
  arch.rotation.z = Math.PI / 2 - arc / 2;
  arch.position.y = postH + rise - radius;
  arch.castShadow = true;
  group.add(arch);

  const bulbs = [];
  for (let i = 0; i < 3; i += 1) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x4a3030 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), mat);
    bulb.position.set(-0.72 + i * 0.72, postH + 0.46, 0);
    group.add(bulb);
    bulbs.push(mat);
  }

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(track.halfWidth * 2 + 0.6, 3.8),
    new THREE.MeshBasicMaterial({ map: checkerTexture(), depthWrite: false }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.08;
  group.add(stripe);

  scene.add(group);
  return bulbs;
}

function addBleachers(scene, track) {
  const wood = lambert(0xf2d2a2);
  const cushion = lambert(track.theme === 'parque' ? 0x3d9a62 : 0xff8fb8);
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
  paintInstances(
    scene,
    new THREE.CylinderGeometry(0.16, 0.28, 1.6, 6),
    new THREE.MeshLambertMaterial({ map: barkTexture() }),
    trunks,
  );
  paintInstances(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ map: leaves }), crowns);
  paintInstances(scene, new THREE.SphereGeometry(0.12, 6, 5), lambert(0xffb703), fruit);
  paintInstances(
    scene,
    new THREE.BoxGeometry(1.35, 0.8, 0.82),
    new THREE.MeshLambertMaterial({ map: strawTexture() }),
    hay,
  );
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

function clearGroup(group) {
  for (const child of [...group.children]) {
    group.remove(child);
    child.traverse((obj) => {
      obj.geometry?.dispose();
      const mats = obj.material ? [].concat(obj.material) : [];
      for (const mat of mats) {
        mat.map?.dispose();
        mat.dispose();
      }
    });
  }
}

function dressPark(scene, track) {
  const lake = track.lake;
  if (lake) {
    const shoreGeo = new THREE.CircleGeometry(1, 48);
    shoreGeo.rotateX(-Math.PI / 2);
    shoreGeo.scale(lake.rx * 1.08, 1, lake.rz * 1.08);
    const shore = new THREE.Mesh(shoreGeo, new THREE.MeshLambertMaterial({ map: sandTexture() }));
    shore.position.set(lake.x, 0.012, lake.z);
    scene.add(shore);

    const waterGeo = new THREE.CircleGeometry(1, 48);
    waterGeo.rotateX(-Math.PI / 2);
    waterGeo.scale(lake.rx, 1, lake.rz);
    const water = new THREE.Mesh(
      waterGeo,
      new THREE.MeshLambertMaterial({ map: waterTexture(), transparent: true, opacity: 0.96 }),
    );
    water.position.set(lake.x, 0.03, lake.z);
    scene.add(water);

    const island = new THREE.Mesh(
      new THREE.SphereGeometry(6.5, 10, 8),
      new THREE.MeshLambertMaterial({ map: grassTexture(2, 2) }),
    );
    island.scale.y = 0.26;
    island.position.set(lake.x + 9, 0.2, lake.z - 1);
    scene.add(island);
  }

  const rand = rng(77);
  const pts = track.points;
  const trunks = [];
  const crowns = [];
  for (let i = 0; i < pts.length; i += 4) {
    const p = pts[i];
    if (p.s < 0.04 || p.s > 0.97) continue;
    const outside = -track.inwardSign;
    const dist = track.halfWidth + 5 + rand() * 7;
    const x = p.x + p.nx * outside * dist;
    const z = p.z + p.nz * outside * dist;
    if (Math.abs(project(track, x, z).lateral) <= track.halfWidth + 3.2) continue;
    const north = lake ? z > lake.z + 8 : z > 0;
    const h = (north ? 2.4 : 1.5) + rand() * (north ? 2.2 : 1.1);
    trunks.push({ x, y: h / 2, z, sy: h / 1.6 });
    const crown = (north ? 1.15 : 0.8) + rand() * 0.45;
    crowns.push({ x, y: h + 0.2, z, sx: crown, sy: crown * 0.85, sz: crown });
    if (north && rand() > 0.4) {
      const ox = x + (rand() - 0.5) * 3.2;
      const oz = z + (rand() - 0.5) * 3.2;
      if (Math.abs(project(track, ox, oz).lateral) > track.halfWidth + 3.2) {
        const h2 = 1.8 + rand() * 1.6;
        trunks.push({ x: ox, y: h2 / 2, z: oz, sy: h2 / 1.6 });
        const c2 = 0.7 + rand() * 0.4;
        crowns.push({ x: ox, y: h2 + 0.15, z: oz, sx: c2, sy: c2, sz: c2 });
      }
    }
  }
  const leaves = canvasTexture(64, 64, (g) => {
    const shade = g.createRadialGradient(24, 18, 4, 32, 32, 32);
    shade.addColorStop(0, '#8ed36a');
    shade.addColorStop(0.55, '#2f7a32');
    shade.addColorStop(1, '#1c4d28');
    g.fillStyle = shade;
    g.fillRect(0, 0, 64, 64);
  });
  paintInstances(
    scene,
    new THREE.CylinderGeometry(0.18, 0.32, 1.6, 6),
    new THREE.MeshLambertMaterial({ map: barkTexture() }),
    trunks,
  );
  paintInstances(scene, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshLambertMaterial({ map: leaves }), crowns);

  const spots = [
    [86, 10],
    [92, -6],
    [68, 28],
    [-78, 18],
  ];
  for (const [x, z] of spots) {
    if (Math.abs(project(track, x, z).lateral) <= track.halfWidth + 7) continue;
    const group = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 3.2, 7), lambert(0xd8c4a4));
    base.position.y = 1.6;
    group.add(base);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.7, 8.2), lambert(0x8d3d32));
    roof.position.y = 3.4;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 0.2), lambert(0x5c3317));
    door.position.set(0, 1.05, 3.55);
    group.add(door);
    group.position.set(x, 0, z);
    scene.add(group);
    break;
  }
}

export function createWorld(canvas, track) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xb7e3ff);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb7e3ff);
  scene.fog = new THREE.Fog(0xb7e3ff, 90, 250);

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 900);

  const hemi = new THREE.HemisphereLight(0xfff4d8, 0x69b85a, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1cc, 1.55);
  sun.position.set(48, 86, 24);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffc4de, 0.35);
  fill.position.set(-40, 24, -30);
  scene.add(fill);

  addMeadow(scene);
  const course = new THREE.Group();
  scene.add(course);

  const rand = rng(9);
  const hillMat = new THREE.MeshLambertMaterial({ map: grassTexture(3, 2) });
  for (let i = 0; i < 9; i += 1) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(18 + rand() * 12, 10, 8), hillMat);
    hill.position.set(Math.cos(a) * 280, -12, Math.sin(a) * 250);
    hill.scale.y = 0.42;
    scene.add(hill);
  }
  const clouds = addClouds(scene);
  const effects = createEffects(scene);

  const api = {
    renderer,
    scene,
    camera,
    bulbs: [],
    effects,
    resize,
    updateClouds,
    setCourse(next) {
      flowMaps.length = 0;
      clearGroup(course);
      course.add(buildRoad(next));
      if (!next.open) addFence(course, next);
      addBleachers(course, next);
      if (next.theme === 'parque') dressPark(course, next);
      else dressTrack(course, next);
      api.bulbs = addBanner(course, next);
      const span = Math.max(next.bounds.maxX - next.bounds.minX, next.bounds.maxZ - next.bounds.minZ, 80);
      scene.fog.near = Math.max(90, span * 0.55);
      scene.fog.far = Math.max(260, span * 1.8);
    },
  };
  api.setCourse(track);

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
    for (const tex of flowMaps) tex.offset.x += dt * 0.035;
  }

  return api;
}
