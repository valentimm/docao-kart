import * as THREE from 'three';

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

const TAU = Math.PI * 2;
const CUP_H = 0.31;
const CUP_SCALE = 1.26 / CUP_H;

const grad = new THREE.DataTexture(new Uint8Array([80, 150, 215]), 3, 1, THREE.RedFormat);
grad.minFilter = THREE.NearestFilter;
grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;

function toon(color, extra) {
  return new THREE.MeshToonMaterial({ color, gradientMap: grad, ...(extra || {}) });
}

function toonWarm(color, k, extra) {
  const mat = toon(color, extra);
  mat.emissive = new THREE.Color(color).multiplyScalar(k);
  return mat;
}

function outlineMaterial(thickness) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x2b1206, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normalize(normal) * ${thickness.toFixed(4)};`,
    );
  };
  mat.customProgramCacheKey = () => `cheers-cup-outline-${thickness}`;
  return mat;
}

function addOutline(mesh, material) {
  const shell = new THREE.Mesh(mesh.geometry, material);
  shell.raycast = () => {};
  mesh.add(shell);
}

// Marca C! desenhada à mão, igual ao Docão / Copo Bomba.
function drawLogo(ctx, cx, cy, h, color) {
  const arc = () => {
    ctx.beginPath();
    ctx.arc(cx - h * 0.2, cy, h * 0.33, Math.PI * 0.27, Math.PI * 1.73);
  };
  const bang = (grow) => {
    const bx = cx + h * 0.36;
    const w = h * 0.2 + grow;
    ctx.beginPath();
    ctx.moveTo(bx - w / 2 + h * 0.03, cy - h * 0.48 - grow / 2);
    ctx.lineTo(bx + w / 2 + h * 0.03, cy - h * 0.48 - grow / 2);
    ctx.lineTo(bx + w * 0.3, cy + h * 0.18 + grow / 2);
    ctx.lineTo(bx - w * 0.3, cy + h * 0.18 + grow / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx, cy + h * 0.38, h * 0.11 + grow / 2, 0, TAU);
    ctx.fill();
  };
  ctx.lineCap = 'butt';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = h * 0.26;
  arc();
  ctx.stroke();
  bang(0);
}

function cupRadius(y) {
  const t = y / CUP_H;
  const ridge = (center) => 0.006 * Math.exp(-Math.pow((y - center) / 0.007, 2));
  return 0.096 + 0.044 * t + ridge(0.085) + ridge(0.205) + (y > CUP_H - 0.012 ? 0.004 : 0);
}

function cheersCupTexture() {
  const rainbow = ['#f28c28', '#f2c94c', '#6fbf3b', '#17b394', '#2b8fd8', '#7a3fb5'];
  return canvasTexture(512, 256, (g, W, H) => {
    const body = g.createLinearGradient(0, 0, W, 0);
    body.addColorStop(0, '#e0232b');
    body.addColorStop(0.5, '#e63946');
    body.addColorStop(1, '#e0232b');
    g.fillStyle = body;
    g.fillRect(0, 0, W, H);

    for (const y of [0.085, 0.205]) {
      const py = (1 - y / CUP_H) * H;
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect(0, py + 2, W, 3);
      g.fillStyle = 'rgba(255,255,255,.35)';
      g.fillRect(0, py - 3, W, 3);
    }

    const rim = 10;
    const bandTop = rim;
    const stripe = 12;
    rainbow.forEach((color, index) => {
      g.fillStyle = color;
      g.fillRect(0, bandTop + index * stripe, W, stripe + 0.5);
    });
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, rim);

    const gloss = g.createLinearGradient(W * 0.14, 0, W * 0.3, 0);
    gloss.addColorStop(0, 'rgba(255,255,255,0)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0.4)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    g.fillRect(W * 0.14, bandTop + rainbow.length * stripe, W * 0.16, H);

    const cy = (1 - 0.148 / CUP_H) * H;
    g.save();
    g.translate(W / 2, cy);
    g.scale(0.82, 1);
    g.translate(-W / 2, -cy);
    drawLogo(g, W / 2, cy, 78, '#f5e6d0');
    g.restore();
  });
}

function lathePoints(steps, y0, y1, radiusAt) {
  const pts = [];
  for (let i = 0; i <= steps; i += 1) {
    const y = y0 + ((y1 - y0) * i) / steps;
    pts.push(new THREE.Vector2(Math.max(0.001, radiusAt(y)), y));
  }
  return pts;
}

function makeCheersCup() {
  const tex = cheersCupTexture();
  const shell = outlineMaterial(0.0075);
  const root = new THREE.Group();
  root.name = 'cheers-cup';
  const model = new THREE.Group();
  model.position.y = -CUP_H / 2;
  root.add(model);

  const body = new THREE.Mesh(
    new THREE.LatheGeometry(lathePoints(40, 0, CUP_H, cupRadius), 40, Math.PI, TAU),
    toonWarm('#ffffff', 0.12, { map: tex, emissiveMap: tex }),
  );
  addOutline(body, shell);
  model.add(body);

  const inner = new THREE.Mesh(
    new THREE.LatheGeometry(
      lathePoints(20, 0.02, CUP_H, (y) => cupRadius(y) - 0.006),
      40,
    ),
    toonWarm('#f7f4ee', 0.22, { side: THREE.BackSide }),
  );
  model.add(inner);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(cupRadius(0.02) - 0.006, 32),
    toonWarm('#f7f4ee', 0.22),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.021;
  model.add(floor);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(cupRadius(CUP_H), 0.008, 8, 40),
    toonWarm('#ffffff', 0.45),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = CUP_H;
  model.add(rim);

  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.096, 32), toon('#e0232b'));
  bottom.rotation.x = Math.PI / 2;
  model.add(bottom);

  root.scale.setScalar(CUP_SCALE);
  return root;
}

function makePamonha() {
  const group = new THREE.Group();
  const corn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.58, 8),
    new THREE.MeshLambertMaterial({ color: 0xffd84a }),
  );
  corn.rotation.z = Math.PI / 2;
  group.add(corn);
  const huskMat = new THREE.MeshLambertMaterial({ color: 0x6fbf45 });
  for (const side of [-1, 1]) {
    const husk = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.2), huskMat);
    husk.position.set(0, 0.1, 0.1 * side);
    husk.rotation.x = side * 0.5;
    group.add(husk);
  }
  return group;
}

function makeCasca() {
  const geo = new THREE.TorusGeometry(0.34, 0.1, 5, 8, Math.PI * 1.25);
  geo.rotateX(Math.PI / 2.5);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xffe14a }));
}

function makeTomate() {
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshLambertMaterial({ color: 0xef3d3d })));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshLambertMaterial({ color: 0x3d8f32 }));
  cap.position.y = 0.22;
  group.add(cap);
  return group;
}

export function createItemView(scene, field, racers) {
  const template = makeCheersCup();
  const cups = field.boxes.map(() => {
    const cup = template.clone();
    cup.traverse((child) => {
      child.frustumCulled = false;
    });
    scene.add(cup);
    return cup;
  });

  const peels = field.peels.map(() => {
    const mesh = makeCasca();
    mesh.scale.setScalar(1.45);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const shots = field.shots.map(() => {
    const mesh = makeTomate();
    mesh.scale.setScalar(1.15);
    mesh.visible = false;
    scene.add(mesh);
    return mesh;
  });
  const markers = racers.map(() => {
    const group = new THREE.Group();
    group.add(makePamonha());
    group.add(makeCasca());
    group.add(makeTomate());
    group.visible = false;
    scene.add(group);
    return group;
  });

  return {
    update(items, fieldRacers, time) {
      items.boxes.forEach((box, index) => {
        const bob = 0.78 + Math.sin(time * 3 + index) * 0.1;
        const shown = box.alive ? 0.55 + 0.45 * (box.pop > 0 ? 1 - box.pop / 0.26 : 1) : 0.001;
        const cup = cups[index];
        cup.position.set(box.x, box.alive ? bob : -6, box.z);
        cup.rotation.set(0, time * 0.9 + index, 0);
        cup.scale.setScalar(CUP_SCALE * shown);
      });

      items.peels.forEach((peel, index) => {
        const mesh = peels[index];
        mesh.visible = peel.active;
        if (!peel.active) return;
        mesh.position.set(peel.x, 0.22, peel.z);
        mesh.rotation.y = peel.yaw + time;
      });
      items.shots.forEach((shot, index) => {
        const mesh = shots[index];
        mesh.visible = shot.active;
        if (!shot.active) return;
        mesh.position.set(shot.x, 0.7, shot.z);
        mesh.rotation.y = shot.yaw;
      });
      fieldRacers.forEach((racer, index) => {
        const marker = markers[index];
        const id = racer.item;
        marker.visible = !!id && !racer.finished;
        if (!marker.visible) return;
        const hop = racer.rolling ? Math.sin(time * 26) * 0.16 : Math.sin(time * 6 + index) * 0.05;
        marker.position.set(racer.x, 2.95 + hop, racer.z);
        marker.rotation.y = racer.yaw + (racer.rolling ? time * 8 : 0);
        marker.scale.setScalar(racer.rolling ? 1.2 : 1);
        marker.children[0].visible = id === 'pamonha';
        marker.children[1].visible = id === 'casca';
        marker.children[2].visible = id === 'tomate';
      });
    },
  };
}
