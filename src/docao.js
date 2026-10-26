/** Docão sentado no kart. Forma oficial (cabeça, focinho, orelhas, bochechas, olhos, contorno). Roupa vem da skin. */

import * as THREE from 'three';
import { getSkin } from './skins.js';

const TAU = Math.PI * 2;
const V2 = THREE.Vector2;
const V3 = THREE.Vector3;

export const PALETTE = {
  skin: '#ee9c22',
  snout: '#ec5c0c',
  nostril: '#3a0806',
  blush: '#e2482a',
  earInner: '#e8682a',
  eyeWhite: '#fffaf0',
  iris: '#5a2c12',
  pupil: '#120604',
  brow: '#2a1408',
  outline: '#2b1206',
  mouth: '#2e0503',
  tongue: '#e8606a',
  teeth: '#fffaf0',
  hoof: '#5a3020',
};

const HEAD = { y0: 1.0, y1: 2.04, zs: 0.92, n: 28 };

const grad = new THREE.DataTexture(new Uint8Array([80, 150, 215]), 3, 1, THREE.RedFormat);
grad.minFilter = THREE.NearestFilter;
grad.magFilter = THREE.NearestFilter;
grad.needsUpdate = true;

const outlineMat = new THREE.MeshBasicMaterial({ color: PALETTE.outline, side: THREE.BackSide });
outlineMat.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\ntransformed += normalize(normal) * 0.02;',
  );
};
outlineMat.customProgramCacheKey = () => 'docao-outline';

export function safeTone(hex) {
  const color = new THREE.Color(hex || PALETTE.skin);
  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);
  color.setHSL(
    THREE.MathUtils.clamp(hsl.h, 30 / 360, 46 / 360),
    Math.max(hsl.s, 0.78),
    THREE.MathUtils.clamp(hsl.l, 0.5, 0.66),
  );
  return `#${color.getHexString()}`;
}

function toon(color, extra) {
  return new THREE.MeshToonMaterial({ color, gradientMap: grad, ...(extra || {}) });
}

export function toonKart(color) {
  return toon(color);
}

function toonWarm(color, k = 0.2, extra, warm) {
  const mat = toon(color, extra);
  mat.emissive = new THREE.Color(warm || color).multiplyScalar(k);
  return mat;
}

function basic(color) {
  return new THREE.MeshBasicMaterial({ color });
}

function outline(mesh) {
  const shell = new THREE.Mesh(mesh.geometry, outlineMat);
  shell.raycast = () => {};
  mesh.add(shell);
  return mesh;
}

function addMesh(geo, mat, parent, edged = true) {
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
  if (edged) outline(mesh);
  return mesh;
}

function headR(y) {
  const t = THREE.MathUtils.clamp((y - HEAD.y0) / (HEAD.y1 - HEAD.y0), 0, 1);
  const u = 2 * t - 1;
  const p = t < 0.45 ? 0.26 : 0.55;
  return Math.max(0.001, (0.6 - 0.16 * t) * Math.pow(Math.max(0, 1 - u * u), p));
}

function headPoint(theta, y, out = 0) {
  const r = headR(y) + out;
  return new V3(r * Math.sin(theta), y, r * HEAD.zs * Math.cos(theta));
}

function headNormal(theta, y) {
  const dy = 0.01;
  const dr = (headR(y + dy) - headR(y - dy)) / (2 * dy);
  return new V3(Math.sin(theta), -dr * 0.9, HEAD.zs * Math.cos(theta)).normalize();
}

const TORSO_PTS = new THREE.SplineCurve([
  new V2(0.01, 0.4),
  new V2(0.36, 0.42),
  new V2(0.47, 0.56),
  new V2(0.5, 0.72),
  new V2(0.48, 0.9),
  new V2(0.42, 1.03),
  new V2(0.28, 1.12),
  new V2(0.01, 1.15),
]).getSpacedPoints(28);

function torsoR(y) {
  let best = TORSO_PTS[0];
  let dist = 9;
  for (const point of TORSO_PTS) {
    const gap = Math.abs(point.y - y);
    if (gap < dist && point.x > 0.05) {
      dist = gap;
      best = point;
    }
  }
  return best.x;
}

function torsoV(y) {
  let best = 0;
  let dist = 9;
  TORSO_PTS.forEach((point, index) => {
    if (index > 2 && index < TORSO_PTS.length - 3 && Math.abs(point.y - y) < dist) {
      dist = Math.abs(point.y - y);
      best = index;
    }
  });
  return best / (TORSO_PTS.length - 1);
}

let headGeo;
let torsoGeo;
let earGeo;
let innerEarGeo;
function sharedGeo() {
  if (headGeo) return;
  const pts = [];
  for (let i = 0; i <= HEAD.n; i += 1) {
    const y = HEAD.y0 + ((HEAD.y1 - HEAD.y0) * i) / HEAD.n;
    pts.push(new V2(headR(y), y));
  }
  headGeo = new THREE.LatheGeometry(pts, 32, Math.PI, TAU);
  torsoGeo = new THREE.LatheGeometry(TORSO_PTS, 28, Math.PI, TAU);
  const ear = new THREE.Shape();
  ear.moveTo(-0.17, 0);
  ear.quadraticCurveTo(-0.2, 0.3, 0.03, 0.46);
  ear.quadraticCurveTo(0.2, 0.26, 0.17, 0);
  ear.quadraticCurveTo(0, -0.05, -0.17, 0);
  earGeo = new THREE.ExtrudeGeometry(ear, {
    depth: 0.04,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 10,
  });
  const inner = ear.getPoints(16).map((point) => new V2(point.x * 0.62, point.y * 0.66 + 0.06));
  innerEarGeo = new THREE.ShapeGeometry(new THREE.Shape(inner));
}

function roundedCyl(radius, height, cap = 0.05, seg = 18) {
  const pts = [new V2(0.001, -height / 2)];
  for (let i = 0; i <= 5; i += 1) {
    const a = -Math.PI / 2 + (i / 5) * (Math.PI / 2);
    pts.push(new V2(radius - cap + Math.cos(a) * cap, -height / 2 + cap + Math.sin(a) * cap));
  }
  for (let i = 0; i <= 5; i += 1) {
    const a = (i / 5) * (Math.PI / 2);
    pts.push(new V2(radius - cap + Math.cos(a) * cap, height / 2 - cap + Math.sin(a) * cap));
  }
  pts.push(new V2(0.001, height / 2));
  return new THREE.LatheGeometry(pts, seg);
}

function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function drawLogo(ctx, cx, cy, h, color, outlineColor) {
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
  if (outlineColor) {
    ctx.strokeStyle = outlineColor;
    ctx.fillStyle = outlineColor;
    ctx.lineWidth = h * 0.36;
    arc();
    ctx.stroke();
    bang(h * 0.1);
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = h * 0.26;
  arc();
  ctx.stroke();
  bang(0);
}

const texCache = new Map();

function headTexture(tone, beard) {
  const key = `head:${tone}:${beard || ''}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 512;
  const H = 256;
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = tone;
    ctx.fillRect(0, 0, W, H);
    const P = (theta, y) => [
      (0.5 + theta / TAU) * W,
      (1 - (y - HEAD.y0) / (HEAD.y1 - HEAD.y0)) * H,
    ];
    for (const side of [-1, 1]) {
      const [cx, cy] = P(side * 0.86, 1.47);
      const rad = 0.13 * (W / (TAU * headR(1.47)));
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
      g.addColorStop(0, PALETTE.blush);
      g.addColorStop(1, `${PALETTE.blush}00`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * 0.72, 0, 0, TAU);
      ctx.fill();
    }
    if (beard) {
      ctx.fillStyle = `${beard}88`;
      for (let i = 0; i < 80; i += 1) {
        const th = (i % 16) / 16 * 1.4 - 0.7;
        const y = 1.08 + (i % 5) * 0.04;
        const [px, py] = P(th, y);
        ctx.fillRect(px, py, 2, 2);
      }
    }
    const L = P(-0.5, 1.37);
    const R = P(0.5, 1.37);
    const top = P(0, 1.2);
    const bot = P(0, 0.86);
    const mouth = () => {
      ctx.beginPath();
      ctx.moveTo(...L);
      ctx.quadraticCurveTo(...top, ...R);
      ctx.quadraticCurveTo(...bot, ...L);
      ctx.closePath();
    };
    mouth();
    ctx.fillStyle = PALETTE.mouth;
    ctx.fill();
    ctx.save();
    mouth();
    ctx.clip();
    ctx.fillStyle = PALETTE.tongue;
    ctx.beginPath();
    ctx.ellipse(P(0.05, 1.1)[0], P(0.05, 1.1)[1] + 6, 36, 14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PALETTE.teeth;
    ctx.beginPath();
    ctx.moveTo(L[0], L[1] - 3);
    ctx.quadraticCurveTo(top[0], top[1] - 3, R[0], R[1] - 3);
    ctx.lineTo(R[0], R[1] + 8);
    ctx.quadraticCurveTo(top[0], top[1] + 8, L[0], L[1] + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    mouth();
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.outline;
    ctx.stroke();
  });
  texCache.set(key, tex);
  return tex;
}

function shirtTexture(shirt) {
  const key = `shirt:${JSON.stringify(shirt)}`;
  if (texCache.has(key)) return texCache.get(key);
  const W = 512;
  const H = 256;
  const tex = canvasTex(W, H, (ctx) => {
    ctx.fillStyle = shirt.color || '#d8261c';
    ctx.fillRect(0, 0, W, H);
    const pattern = shirt.pattern;
    if (pattern?.colors?.length) {
      const n = pattern.count || 8;
      for (let i = 0; i < n; i += 1) {
        ctx.fillStyle = pattern.colors[i % pattern.colors.length];
        if (pattern.type === 'hoops') ctx.fillRect(0, (i * H) / n, W, H / n + 1);
        else ctx.fillRect((i * W) / n, 0, W / n + 1, H);
      }
    }
    const PT = (th, y) => [(0.5 + th / TAU) * W, (1 - torsoV(y)) * H];
    for (const detail of shirt.details || []) {
      if (detail.type === 'backStripes') {
        const color = detail.color || '#7a4a1c';
        ctx.fillStyle = color;
        for (const y of detail.ys || [0.95, 0.78]) {
          const yy = PT(0, y)[1];
          ctx.fillRect(0, yy - 8, W * 0.16, 16);
          ctx.fillRect(W * 0.84, yy - 8, W * 0.16, 16);
        }
      } else if (detail.type === 'hoodie') {
        const zip = detail.zip || '#a8acb2';
        const cloth = detail.color || '#0e0e10';
        ctx.strokeStyle = cloth;
        ctx.lineWidth = 4;
        for (const side of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(...PT(side * 0.06, 0.48));
          ctx.lineTo(...PT(side * 0.5, 0.48));
          ctx.lineTo(...PT(side * 0.4, 0.68));
          ctx.lineTo(...PT(side * 0.06, 0.68));
          ctx.stroke();
        }
        ctx.strokeStyle = zip;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(...PT(0, 1.12));
        ctx.lineTo(...PT(0, 0.42));
        ctx.stroke();
        const hem = PT(0, 0.44);
        ctx.fillStyle = cloth;
        ctx.fillRect(0, hem[1] - 6, W, 12);
      }
    }
    const logo = shirt.logo;
    if (logo) {
      const cy = (1 - torsoV(logo.y || 0.76)) * H;
      const cx = (0.5 + (logo.x || 0) / TAU) * W;
      const hp = (logo.size || 0.3) * (H / 1.43);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale((W / (TAU * 0.5)) / (H / 1.43), 1);
      ctx.translate(-cx, -cy);
      if (!logo.text || logo.text === 'C!') drawLogo(ctx, cx, cy, hp, logo.color || '#f5e6d0', logo.outline || null);
      else {
        ctx.font = `900 ${hp}px Impact, "Arial Black", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = logo.color || '#fff';
        ctx.fillText(logo.text, cx, cy);
      }
      if (logo.sub) {
        ctx.font = `bold ${hp * 0.32}px "Trebuchet MS", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = logo.color || '#fff';
        ctx.fillText(logo.sub, cx, cy + hp * 0.78);
      }
      ctx.restore();
    }
  });
  texCache.set(key, tex);
  return tex;
}

function sleeveColor(shirt) {
  return shirt.sleeveColor || shirt.color || '#d8261c';
}

const PARTS = {
  cap(options) {
    const group = new THREE.Group();
    const domeMat = toon(options.color || '#7DF9FF');
    const brimMat = toon(options.brim || '#12233a');
    const dome = addMesh(new THREE.SphereGeometry(0.44, 18, 10, 0, TAU, 0, Math.PI / 2), domeMat, group);
    dome.scale.set(1.04, 0.62, 0.98);
    const brim = addMesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 18, 1, false, -Math.PI / 2, Math.PI), brimMat, group);
    brim.scale.set(1, 1, 1.2);
    brim.position.set(0, 0.005, 0.36);
    brim.rotation.x = 0.12;
    if (options.logo) {
      const tex = canvasTex(128, 128, (ctx) => drawLogo(ctx, 64, 64, 84, '#12233a'));
      const badge = new THREE.Mesh(
        new THREE.PlaneGeometry(0.2, 0.2),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      badge.position.set(0, 0.15, 0.39);
      badge.rotation.x = -0.45;
      group.add(badge);
    }
    group.position.set(0, 1.74, -0.01);
    group.rotation.x = -0.12;
    group.userData.anchor = 'head';
    return group;
  },
  glasses(options, rig) {
    const group = new THREE.Group();
    const mat = basic(options.color || '#2a1408');
    for (const eye of rig.eyes) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.016, 6, 16), mat);
      ring.position.copy(eye.position).addScaledVector(eye.userData.n, 0.06);
      ring.lookAt(ring.position.clone().add(eye.userData.n));
      ring.scale.set(1, 1.1, 1);
      group.add(ring);
    }
    const a = rig.eyes[0].position.clone().addScaledVector(rig.eyes[0].userData.n, 0.07);
    const b = rig.eyes[1].position.clone().addScaledVector(rig.eyes[1].userData.n, 0.07);
    const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, a.distanceTo(b) - 0.22, 6), mat);
    bridge.position.copy(a).add(b).multiplyScalar(0.5);
    bridge.position.y += 0.03;
    bridge.rotation.z = Math.PI / 2;
    group.add(bridge);
    group.userData.anchor = 'head';
    return group;
  },
  socks(options, rig) {
    const mat = toon(options.color || '#ffffff');
    for (const leg of rig.legs) {
      const sock = addMesh(new THREE.CylinderGeometry(0.142, 0.142, 0.12, 12), mat, leg);
      sock.position.y = -0.26;
    }
    return null;
  },
  shoes(options, rig) {
    const mat = toon(options.color || '#111114');
    const soleMat = toon(options.sole || '#2a2a2a');
    const strapMat = toon(options.strap || '#2a2a30');
    for (const leg of rig.legs) {
      const shoe = addMesh(new THREE.SphereGeometry(0.17, 12, 8), mat, leg);
      shoe.position.set(0, -0.35, 0.07);
      shoe.scale.set(1, 0.58, 1.45);
      const sole = addMesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 12), soleMat, leg, false);
      sole.position.set(0, -0.43, 0.07);
      sole.scale.z = 1.45;
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.025, 0.05), strapMat);
      strap.position.set(0, -0.29, 0.2);
      leg.add(strap);
    }
    return null;
  },
  longPants(options, rig) {
    const mat = toon(options.color || '#141416');
    for (const leg of rig.legs) {
      const pants = addMesh(new THREE.CapsuleGeometry(0.15, 0.16, 3, 8), mat, leg);
      pants.position.y = -0.15;
    }
    return null;
  },
  hood(options, rig) {
    rig.tuft.forEach((tuft) => {
      tuft.visible = false;
    });
    const group = new THREE.Group();
    const mat = toonWarm(options.color || '#ffd23a', 0.15, { side: THREE.DoubleSide });
    const shell = addMesh(new THREE.SphereGeometry(0.64, 20, 14, 0, TAU, 1.05, Math.PI - 1.2), mat, group);
    shell.rotation.x = Math.PI / 2 - 0.4;
    shell.scale.set(1.02, 1, 0.96);
    for (const side of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(side * 0.22, 0.56, -0.1);
      ear.rotation.z = -side * 0.42;
      group.add(ear);
      const base = addMesh(new THREE.CylinderGeometry(0.04, 0.12, 0.44, 10), mat, ear);
      base.position.y = 0.22;
      base.scale.z = 0.5;
      const tip = addMesh(new THREE.ConeGeometry(0.04, 0.2, 10), toon(options.tip || '#1a1a1a'), ear);
      tip.position.y = 0.54;
      tip.scale.z = 0.5;
    }
    group.position.set(0, 1.52, -0.02);
    group.userData.anchor = 'head';
    return group;
  },
  boltTail(options, rig) {
    if (rig.tail) rig.tail.visible = false;
    const shape = new THREE.Shape([
      [0, 0], [0.1, 0], [0.07, 0.17], [0.23, 0.17], [0.15, 0.34], [0.33, 0.34],
      [0.12, 0.64], [0.16, 0.44], [-0.01, 0.44], [0.07, 0.27], [-0.08, 0.27],
    ].map(([x, y]) => new V2(x, y)));
    const group = new THREE.Group();
    addMesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 }),
      toonWarm(options.color || '#ffd23a', 0.15),
      group,
    );
    const base = addMesh(new THREE.BoxGeometry(0.13, 0.08, 0.08), toon(options.base || '#7a4a1c'), group);
    base.position.set(0.05, 0.03, 0.025);
    group.position.set(0, 0.58, -0.4);
    group.rotation.set(0, Math.PI / 2, 0.25);
    group.scale.setScalar(1.25);
    return group;
  },
  quiffHair(options, rig) {
    rig.tuft.forEach((tuft) => {
      tuft.visible = false;
    });
    const group = new THREE.Group();
    const mat = toonWarm(options.color || '#2e1c12', 0.12);
    const sideMat = toonWarm(options.side || '#2a1b12', 0.1);
    const cap = addMesh(new THREE.SphereGeometry(0.58, 16, 10, 0, TAU, 0, Math.PI * 0.42), sideMat, group, false);
    cap.position.set(0, 1.72, -0.04);
    cap.scale.set(1.02, 0.55, 0.9);
    for (const [th, len] of [[0, 0.26], [0.3, 0.22], [-0.3, 0.22], [0.55, 0.16], [-0.55, 0.16]]) {
      const spot = headPoint(th, 1.98, 0.05);
      const lock = addMesh(new THREE.ConeGeometry(0.1, len, 8), mat, group);
      lock.position.copy(spot).add(new V3(0, 0.06, -0.02));
      lock.rotation.set(-0.5, 0, -th * 0.4);
    }
    group.userData.anchor = 'head';
    return group;
  },
  beard(options) {
    const group = new THREE.Group();
    const mat = toonWarm(options.color || '#43291a', 0.08);
    for (const side of [-1, 1]) {
      const spot = headPoint(side * 0.2, 1.32, 0.04);
      const hair = addMesh(new THREE.CapsuleGeometry(0.024, 0.1, 2, 6), mat, group);
      hair.position.copy(spot).add(new V3(0, 0, 0.06));
      hair.rotation.z = side * 1.2;
    }
    group.userData.anchor = 'head';
    return group;
  },
  hoodDown(options) {
    const group = new THREE.Group();
    const mat = toon(options.color || '#1a1a1d');
    const hood = addMesh(new THREE.TorusGeometry(0.28, 0.1, 8, 16, Math.PI), mat, group);
    hood.position.set(0, 1.05, -0.28);
    hood.rotation.set(Math.PI / 2 + 0.4, 0, Math.PI);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toon(options.inner || '#0b0b0d'));
    inner.position.set(0, 1.02, -0.22);
    group.add(inner);
    return group;
  },
  hoodStrings(options) {
    const group = new THREE.Group();
    const mat = toon(options.color || '#f4f4f4');
    for (const side of [-1, 1]) {
      const cord = addMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), mat, group, false);
      cord.position.set(side * 0.08, 0.9, 0.42);
      cord.rotation.x = 0.15;
    }
    return group;
  },
  lanyard(options) {
    const group = new THREE.Group();
    const strap = addMesh(new THREE.TorusGeometry(0.3, 0.018, 6, 18), toon(options.color || '#d81e2a'), group);
    strap.rotation.x = Math.PI / 2.4;
    strap.position.set(0, 1.02, 0.12);
    const badge = addMesh(new THREE.BoxGeometry(0.16, 0.2, 0.02), toon('#fbfbfb'), group);
    badge.position.set(0, 0.72, 0.5);
    const tex = canvasTex(64, 80, (ctx, w, h) => {
      ctx.fillStyle = '#fbfbfb';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = options.logo || '#d81e2a';
      ctx.fillRect(0, h - 14, w, 14);
      drawLogo(ctx, w / 2, h * 0.42, 36, options.logo || '#d81e2a');
    });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.17), new THREE.MeshBasicMaterial({ map: tex }));
    face.position.set(0, 0.72, 0.512);
    group.add(face);
    return group;
  },
  faixa(options) {
    const group = new THREE.Group();
    const colors = options.colors || ['#009c3b', '#ffdf00', '#002776'];
    const tex = canvasTex(64, 128, (ctx, w, h) => {
      ctx.fillStyle = '#1a120c';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = colors[0];
      ctx.fillRect(4, 0, 16, h);
      ctx.fillStyle = colors[1];
      ctx.fillRect(22, 0, 20, h);
      ctx.fillStyle = colors[2];
      ctx.fillRect(44, 0, 16, h);
    });
    const band = addMesh(new THREE.BoxGeometry(0.2, 0.98, 0.045), toon('#ffffff', { map: tex }), group);
    band.position.set(0.02, 0.7, 0.48);
    band.rotation.set(0.25, 0.15, 0.65);
    const star = addMesh(new THREE.OctahedronGeometry(0.06, 0), toon('#e2b33a'), group);
    star.position.set(0.02, 0.72, 0.54);
    return group;
  },
  bellyOut(options, rig) {
    const group = new THREE.Group();
    const belly = addMesh(new THREE.SphereGeometry(0.32, 16, 12), rig.skinM, group);
    belly.scale.set(1.15, 0.82, 0.95);
    belly.position.set(0, 0.58, 0.4);
    const navel = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.01, 6, 12), toon('#c45a18'));
    navel.position.set(0, 0.55, 0.7);
    navel.rotation.x = Math.PI / 2 - 0.25;
    group.add(navel);
    const y = 0.84;
    const radius = torsoR(y) + 0.04;
    const roll = addMesh(new THREE.TorusGeometry(radius, 0.07, 8, 18), toon(options.roll || '#c44b36'), group);
    roll.rotation.x = Math.PI / 2;
    roll.position.set(0, y, 0.06);
    roll.scale.y = 0.9;
    const band = addMesh(new THREE.TorusGeometry(radius * 0.98, 0.02, 6, 16), toon(options.rollDark || '#8e2c1e'), group, false);
    band.rotation.x = Math.PI / 2;
    band.position.set(0, y + 0.05, 0.04);
    band.scale.y = 0.9;
    return group;
  },
};

function sit(rig) {
  rig.legs.forEach((leg, index) => {
    leg.rotation.x = -1.15;
    leg.position.z = 0.08;
    leg.rotation.z = (index === 0 ? -1 : 1) * 0.08;
  });
  rig.arms.forEach((arm, index) => {
    arm.rotation.x = 0.95;
    arm.rotation.z = (index === 0 ? 1 : -1) * 0.28;
  });
}

export function makeDocao(skinOrId, opts = {}) {
  sharedGeo();
  const skin = typeof skinOrId === 'string' || skinOrId == null ? getSkin(skinOrId) : skinOrId;
  const tone = safeTone(skin.body && skin.body.tone);
  const shirt = skin.shirt || {};
  const beardPart = (skin.parts || []).find((part) => part.type === 'beard');
  const beard = beardPart ? beardPart.color || '#43291a' : null;
  const faceMap = headTexture(tone, beard);
  const skinM = toonWarm(tone, 0.32, null, '#e0500a');
  const faceM = toonWarm('#ffffff', 0.22, { map: faceMap, emissiveMap: faceMap }, '#ff9a80');
  const snoutM = toonWarm(PALETTE.snout, 0.22);
  const earInM = toonWarm(PALETTE.earInner, 0.16);
  const hoofM = toon(PALETTE.hoof);
  const shirtMap = shirtTexture(shirt);
  const shirtM = toonWarm('#ffffff', 0.12, { map: shirtMap, emissiveMap: shirtMap });
  const sleeveM = toonWarm(sleeveColor(shirt), 0.1);
  const trimM = toon(shirt.trim || '#1d1410');
  const pantsM = toon(skin.pants || '#1d1410');
  const dark = basic(PALETTE.nostril);
  const white = basic(PALETTE.eyeWhite);
  const sleeves = shirt.sleeves || 'short';

  const group = new THREE.Group();
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.2, 0.4, 0);
    group.add(leg);
    const limb = addMesh(new THREE.CapsuleGeometry(0.13, 0.2, 3, 8), skinM, leg);
    limb.position.y = -0.2;
    const hoof = addMesh(new THREE.SphereGeometry(0.155, 10, 8), hoofM, leg);
    hoof.position.set(0, -0.36, 0.04);
    hoof.scale.set(1, 0.6, 1.25);
    const cleft = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.1), dark);
    cleft.position.set(0, -0.36, 0.22);
    leg.add(cleft);
    legs.push(leg);
  }

  const shorts = addMesh(roundedCyl(0.41, 0.24, 0.07, 16), pantsM, group);
  shorts.position.y = 0.47;
  shorts.scale.z = 0.85;
  const torso = addMesh(torsoGeo, shirtM, group);
  torso.scale.z = 0.85;
  const collar = addMesh(new THREE.TorusGeometry(0.27, 0.045, 6, 18), trimM, group);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.1;
  collar.scale.y = 0.85;
  const tail = addMesh(new THREE.TorusGeometry(0.08, 0.032, 6, 12, Math.PI * 1.7), skinM, group);
  tail.position.set(0, 0.6, -0.44);
  tail.rotation.y = Math.PI / 2;

  const head = new THREE.Group();
  group.add(head);
  const skull = addMesh(headGeo, faceM, head);
  skull.scale.set(1, 1, HEAD.zs);
  const tuft = [];
  [[-0.06, 0.4], [0.02, 0.5], [0.09, 0.36]].forEach(([x, lean], index) => {
    const cone = addMesh(new THREE.ConeGeometry(0.045, 0.16, 8), skinM, head);
    cone.position.set(x, HEAD.y1 - 0.02, 0.08);
    cone.rotation.z = lean * (index === 1 ? 0.1 : index === 0 ? 0.45 : -0.4);
    tuft.push(cone);
  });

  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.33, 1.84, -0.03);
    ear.rotation.set(-0.12, side * 0.3, -side * 0.62);
    ear.scale.setScalar(1.08);
    head.add(ear);
    addMesh(earGeo, skinM, ear);
    const inner = new THREE.Mesh(innerEarGeo, earInM);
    inner.position.z = 0.07;
    ear.add(inner);
  }

  const snoutY = 1.47;
  const snoutDepth = 0.22;
  const snoutAt = headPoint(0, snoutY);
  const snout = addMesh(roundedCyl(0.2, snoutDepth, 0.065, 16), snoutM, head);
  snout.rotation.x = Math.PI / 2 - 0.12;
  snout.scale.set(1.22, 1, 0.82);
  snout.position.set(0, snoutY, snoutAt.z + snoutDepth / 2 - 0.08);
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.CircleGeometry(0.042, 10), dark);
    nostril.scale.set(0.85, 1.35, 1);
    nostril.position.set(side * 0.085, snoutY + 0.01, snoutAt.z + snoutDepth - 0.08);
    nostril.rotation.set(-0.12, 0, -side * 0.2);
    head.add(nostril);
  }

  const eyes = [];
  for (const side of [-1, 1]) {
    const theta = side * 0.33;
    const normal = headNormal(theta, 1.7);
    const point = headPoint(theta, 1.7, -0.02);
    const eye = new THREE.Group();
    eye.position.copy(point);
    eye.lookAt(point.clone().add(normal));
    eye.userData.n = normal;
    head.add(eye);
    const ball = addMesh(new THREE.SphereGeometry(0.135, 14, 10), white, eye);
    ball.scale.set(0.95, 1.2, 0.55);
    const iris = new THREE.Mesh(
      new THREE.SphereGeometry(0.095, 12, 8),
      basic((skin.eyes && skin.eyes.iris) || PALETTE.iris),
    );
    iris.scale.set(1, 1.1, 0.4);
    iris.position.set(-side * 0.012, -0.01, 0.052);
    eye.add(iris);
    if (skin.eyes && skin.eyes.ring) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.012, 6, 14), basic(skin.eyes.ring));
      ring.scale.set(1, 1.1, 0.4);
      ring.position.set(-side * 0.012, -0.01, 0.066);
      eye.add(ring);
    }
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), basic(PALETTE.pupil));
    pupil.scale.set(1, 1.08, 0.4);
    pupil.position.set(-side * 0.012, -0.01, 0.068);
    eye.add(pupil);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), white);
    shine.position.set(-side * 0.012 + 0.03, 0.025, 0.08);
    eye.add(shine);
    eyes.push(eye);

    const browAt = headPoint(side * 0.36, 1.95, 0.02);
    const browN = headNormal(side * 0.36, 1.95);
    const brow = new THREE.Group();
    brow.position.copy(browAt);
    brow.lookAt(browAt.clone().add(browN));
    head.add(brow);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.032, 6, 12, 1.5), basic(PALETTE.brow));
    arc.rotation.z = (Math.PI - 1.5) / 2 - side * 0.18;
    arc.position.y = -0.1;
    arc.scale.set(1, 0.8, 0.6);
    brow.add(arc);
  }

  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.46, 1.0, 0);
    group.add(pivot);
    if (sleeves === 'short') {
      const sleeve = addMesh(new THREE.CylinderGeometry(0.16, 0.15, 0.22, 12), sleeveM, pivot);
      sleeve.position.y = -0.06;
      const cuff = addMesh(new THREE.TorusGeometry(0.15, 0.03, 6, 12), trimM, pivot);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.17;
    } else {
      const sleeve = addMesh(new THREE.CylinderGeometry(0.155, 0.14, 0.46, 12), sleeveM, pivot);
      sleeve.position.y = -0.2;
      const cuff = addMesh(new THREE.TorusGeometry(0.13, 0.035, 6, 12), trimM, pivot);
      cuff.rotation.x = Math.PI / 2;
      cuff.position.y = -0.44;
    }
    const arm = addMesh(new THREE.CapsuleGeometry(0.125, 0.28, 3, 8), skinM, pivot);
    arm.position.y = -0.33;
    const fist = addMesh(new THREE.SphereGeometry(0.155, 10, 8), skinM, pivot);
    fist.position.y = -0.57;
    arms.push(pivot);
  }

  const rig = { group, head, eyes, legs, arms, tail, tuft, skinM };
  for (const part of skin.parts || []) {
    const build = PARTS[part.type];
    if (!build) continue;
    const piece = build(part, rig);
    if (!piece) continue;
    (piece.userData.anchor === 'head' ? head : group).add(piece);
  }
  if (opts.seated) sit(rig);
  return group;
}

export function createSkinStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(1.15, 1.25, 2.55);
  camera.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xfff6e4, 0xc4844a, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1cc, 1.45);
  sun.position.set(3, 5, 2);
  scene.add(sun);
  let current = null;
  return {
    show(id) {
      if (current) scene.remove(current);
      current = makeDocao(id);
      current.rotation.y = -0.6;
      scene.add(current);
    },
    render() {
      if (!current || canvas.clientWidth < 2) return;
      current.rotation.y += 0.008;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight || 168;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    },
  };
}
