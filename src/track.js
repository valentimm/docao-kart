/** Closed farm-circuit centerline. Pure math — no rendering. */

export const HALF_WIDTH = 7.4;
export const VISUAL_SHOULDER = 1.35;
export const KART_RADIUS = 1.15;

/**
 * Hand-placed loop around a farm fairground.
 * Order is the driving direction. Finish line sits on the first span.
 */
const CONTROL = [
  [-26, -50],
  [14, -46],
  [48, -30],
  [64, -4],
  [50, 22],
  [20, 34],
  [-4, 24],
  [-10, 46],
  [-42, 42],
  [-64, 18],
  [-66, -12],
  [-44, -38],
];

function wrapIndex(i, n) {
  return ((i % n) + n) % n;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const x =
    0.5 *
    (2 * p1[0] +
      (-p0[0] + p2[0]) * t +
      (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
      (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
  const z =
    0.5 *
    (2 * p1[1] +
      (-p0[1] + p2[1]) * t +
      (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
      (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
  return [x, z];
}

function sampleRaw() {
  const pts = [];
  const n = CONTROL.length;
  const steps = 24;
  for (let i = 0; i < n; i += 1) {
    const p0 = CONTROL[wrapIndex(i - 1, n)];
    const p1 = CONTROL[i];
    const p2 = CONTROL[wrapIndex(i + 1, n)];
    const p3 = CONTROL[wrapIndex(i + 2, n)];
    for (let s = 0; s < steps; s += 1) {
      pts.push(catmull(p0, p1, p2, p3, s / steps));
    }
  }
  return pts;
}

function resample(raw, spacing) {
  const out = [raw[0]];
  let prev = raw[0];
  let carry = 0;
  for (let i = 1; i <= raw.length; i += 1) {
    const cur = raw[i % raw.length];
    let dx = cur[0] - prev[0];
    let dz = cur[1] - prev[1];
    let dist = Math.hypot(dx, dz);
    if (dist < 1e-6) {
      prev = cur;
      continue;
    }
    while (carry + dist >= spacing) {
      const need = spacing - carry;
      const t = need / dist;
      const nx = prev[0] + dx * t;
      const nz = prev[1] + dz * t;
      out.push([nx, nz]);
      prev = [nx, nz];
      dx = cur[0] - prev[0];
      dz = cur[1] - prev[1];
      dist = Math.hypot(dx, dz);
      carry = 0;
      if (out.length > 5000) break;
    }
    carry += dist;
    prev = cur;
  }
  if (out.length > 2) out.pop();
  return out;
}

function shortest(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function buildTrack() {
  const raw = sampleRaw();
  const samples = resample(raw, 2.4);
  const n = samples.length;
  let length = 0;
  const points = samples.map((p, i) => {
    const q = samples[(i + 1) % n];
    const dx = q[0] - p[0];
    const dz = q[1] - p[1];
    const seg = Math.hypot(dx, dz) || 1;
    length += seg;
    return {
      x: p[0],
      z: p[1],
      tx: dx / seg,
      tz: dz / seg,
      nx: -dz / seg,
      nz: dx / seg,
      yaw: Math.atan2(dx, dz),
      seg,
    };
  });

  let acc = 0;
  for (const p of points) {
    p.dist = acc;
    acc += p.seg;
  }
  for (const p of points) p.s = p.dist / length;

  const origin = project({ points, length }, 0, 0);
  return {
    points,
    length,
    halfWidth: HALF_WIDTH,
    shoulder: VISUAL_SHOULDER,
    inwardSign: Math.sign(origin.lateral) || 1,
    bounds: boundsOf(points),
  };
}

function boundsOf(points) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ };
}

/** Closest point on the centerline. `lateral` is signed along the left normal. */
export function project(track, x, z) {
  const pts = track.points;
  const n = pts.length;
  let best = Infinity;
  let bestI = 0;
  let bestT = 0;
  let px = 0;
  let pz = 0;
  let nx = 0;
  let nz = 0;
  let lateral = 0;

  for (let i = 0; i < n; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz || 1;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = a.x + abx * t;
    const qz = a.z + abz * t;
    const dx = x - qx;
    const dz = z - qz;
    const d2 = dx * dx + dz * dz;
    if (d2 < best) {
      best = d2;
      bestI = i;
      bestT = t;
      px = qx;
      pz = qz;
      const len = Math.sqrt(len2);
      nx = -abz / len;
      nz = abx / len;
      lateral = dx * nx + dz * nz;
    }
  }

  const a = pts[bestI];
  const segLen = a.seg || 1;
  const dist = a.dist + segLen * bestT;
  const s = dist / track.length;
  return { s, lateral, px, pz, nx, nz, dist: Math.sqrt(best), index: bestI };
}

export function poseAt(track, s, lateral = 0) {
  const pts = track.points;
  const n = pts.length;
  let u = ((s % 1) + 1) % 1;
  const target = u * track.length;
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pts[mid].dist <= target) lo = mid;
    else hi = mid - 1;
  }
  const a = pts[lo];
  const b = pts[(lo + 1) % n];
  const span = a.seg || 1;
  const t = span > 0 ? (target - a.dist) / span : 0;
  const clamped = Math.max(0, Math.min(1, t));
  const x = a.x + (b.x - a.x) * clamped + a.nx * lateral;
  const z = a.z + (b.z - a.z) * clamped + a.nz * lateral;
  const yaw = a.yaw + shortest(a.yaw, b.yaw) * clamped;
  return { x, z, yaw, s: u, lateral };
}

export function clearance(track) {
  const pts = track.points;
  const n = pts.length;
  let min = Infinity;
  let at = [0, 0];
  const skip = Math.max(8, Math.round(36 / 2.4));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + skip; j < n - skip; j += 1) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d < min) {
        min = d;
        at = [i, j];
      }
    }
  }
  return { min, at, samples: n };
}
