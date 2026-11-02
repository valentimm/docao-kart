/** Capybaras on the Barigui road. A few patrols, not a herd. */

import { poseAt } from './track.js';

const WALK = 2.5;
const HIT = 1.55;

/** Short stretches away from the grid and the item rows. */
const PATROLS = [
  { from: 0.16, to: 0.24, at: 0.18, dir: 1 },
  { from: 0.5, to: 0.6, at: 0.54, dir: -1 },
  { from: 0.66, to: 0.74, at: 0.7, dir: 1 },
];

function place(animal, track, time) {
  animal.lateral = Math.sin(time * 0.65 + animal.phase) * 0.8;
  const pose = poseAt(track, animal.s, animal.lateral);
  animal.x = pose.x;
  animal.z = pose.z;
  animal.yaw = pose.yaw + (animal.dir < 0 ? Math.PI : 0);
}

export function createCapybaras(track) {
  if (track.id !== 'barigui') return [];
  return PATROLS.map((row, index) => {
    const animal = {
      from: row.from,
      to: row.to,
      s: row.at,
      dir: row.dir,
      lateral: 0,
      phase: index * 1.7,
      x: 0,
      z: 0,
      yaw: 0,
    };
    place(animal, track, 0);
    return animal;
  });
}

export function stepCapybaras(herd, dt, track, time) {
  if (!herd.length) return;
  const rate = WALK / track.length;
  for (const animal of herd) {
    animal.s += animal.dir * rate * dt;
    if (animal.s >= animal.to) {
      animal.s = animal.to;
      animal.dir = -1;
    } else if (animal.s <= animal.from) {
      animal.s = animal.from;
      animal.dir = 1;
    }
    place(animal, track, time);
  }
}

/** A bump: the kart keeps most of its line, but loses a chunk of speed. */
export function hitCapybaras(herd, racers, dt, onHit) {
  if (!herd.length) return;
  for (const racer of racers) {
    if (racer.capyGrace > 0) racer.capyGrace = Math.max(0, racer.capyGrace - dt);
  }
  for (const animal of herd) {
    for (const racer of racers) {
      if (racer.finished || racer.ghost || racer.capyGrace > 0) continue;
      if (Math.abs(racer.speed) < 3) continue;
      const dx = racer.x - animal.x;
      const dz = racer.z - animal.z;
      const dist = Math.hypot(dx, dz);
      if (dist > HIT) continue;
      racer.capyGrace = 0.9;
      const nx = dx / (dist || 1);
      const nz = dz / (dist || 1);
      racer.x += nx * 0.5;
      racer.z += nz * 0.5;
      racer.speed *= 0.55;
      const side = nx * Math.cos(racer.yaw) - nz * Math.sin(racer.yaw);
      racer.slide = (side >= 0 ? 1 : -1) * 2.4;
      onHit?.(racer);
    }
  }
}
