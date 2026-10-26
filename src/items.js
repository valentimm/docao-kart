/** Feira item boxes: one held power-up per kart. No rendering in here. */

import { poseAt } from './track.js';
import { TUNING, stumble } from './drive.js';

export const ITEMS = {
  pamonha: { name: 'Pamonha', swatch: '#ffd84a', tint: 0xffd84a },
  casca: { name: 'Casca', swatch: '#ffe56a', tint: 0xffe14a },
  tomate: { name: 'Tomate', swatch: '#ef3d3d', tint: 0xef3d3d },
};

export const ITEM_RULES = {
  respawn: 4.5,
  pickupRadius: 2.05,
  peelLife: 11,
  peelRadius: 1.55,
  peelArm: 0.32,
  shotLife: 1.65,
  shotSpeed: 44,
  shotRadius: 1.6,
  pamonhaTime: 1.2,
};

const SPOTS = [
  { s: 0.12, lateral: 0 },
  { s: 0.26, lateral: 1.5 },
  { s: 0.4, lateral: -1.2 },
  { s: 0.54, lateral: 0.4 },
  { s: 0.68, lateral: -1.6 },
  { s: 0.82, lateral: 1.1 },
];

function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function rollItem(rng) {
  const roll = rng();
  if (roll < 1 / 3) return 'pamonha';
  if (roll < 2 / 3) return 'casca';
  return 'tomate';
}

function takeSlot(pool) {
  let slot = null;
  for (const item of pool) {
    if (!item.active) return item;
    if (!slot || item.life < slot.life) slot = item;
  }
  return slot;
}

function bendAhead(racer, track) {
  const here = poseAt(track, racer.s, 0);
  const soon = poseAt(track, (racer.s + 16 / track.length) % 1, 0);
  return Math.abs(wrapAngle(soon.yaw - here.yaw));
}

function rivalOffset(racer, other, reach, minDist) {
  const dx = other.x - racer.x;
  const dz = other.z - racer.z;
  const dist = Math.hypot(dx, dz);
  if (dist < minDist || dist > reach) return null;
  const fx = Math.sin(racer.yaw);
  const fz = Math.cos(racer.yaw);
  return (dx / dist) * fx + (dz / dist) * fz;
}

function rivalAhead(racer, racers, reach, angle) {
  const need = Math.cos(angle);
  for (const other of racers) {
    if (other === racer || other.finished || other.ghost) continue;
    const dot = rivalOffset(racer, other, reach, 1.2);
    if (dot != null && dot > need) return true;
  }
  return false;
}

function rivalBehind(racer, racers, reach) {
  for (const other of racers) {
    if (other === racer || other.finished || other.ghost) continue;
    const dot = rivalOffset(racer, other, reach, 1.2);
    if (dot != null && dot < -0.45) return true;
  }
  return false;
}

export function createItemField(track) {
  const boxes = SPOTS.map((spot) => {
    const pose = poseAt(track, spot.s, spot.lateral);
    return {
      s: spot.s,
      lateral: spot.lateral,
      x: pose.x,
      z: pose.z,
      yaw: pose.yaw,
      alive: true,
      cooldown: 0,
      pop: 0,
    };
  });
  const peels = Array.from({ length: 6 }, () => ({
    active: false,
    x: 0,
    z: 0,
    yaw: 0,
    life: 0,
    arm: 0,
    owner: null,
  }));
  const shots = Array.from({ length: 4 }, () => ({
    active: false,
    x: 0,
    z: 0,
    yaw: 0,
    life: 0,
    speed: ITEM_RULES.shotSpeed,
    owner: null,
    trail: 0,
  }));
  return { boxes, peels, shots };
}

export function resetItems(field) {
  for (const box of field.boxes) {
    box.alive = true;
    box.cooldown = 0;
    box.pop = 0;
  }
  for (const peel of field.peels) peel.active = false;
  for (const shot of field.shots) shot.active = false;
}

export function botWantsUse(racer, racers, track, time) {
  if (!racer.item || racer.player || racer.finished || racer.ghost) return false;
  if (racer.stun > 0.05) return false;
  const wait = 0.5 + ((racer.ai?.phase || 0) % 1) * 0.45;
  if (racer.itemTime < wait) return false;

  if (racer.item === 'pamonha') {
    if (racer.itemTime > 2.6) return true;
    return bendAhead(racer, track) < 0.92;
  }
  if (racer.item === 'casca') {
    if (rivalBehind(racer, racers, 8.5)) return true;
    return racer.itemTime > 3.6;
  }
  if (racer.itemTime > 4.4) return true;
  if (!rivalAhead(racer, racers, 18, 0.48)) return false;
  const pulse = Math.floor(time * 2.2 + (racer.ai?.phase || 0) * 5);
  return pulse % 4 === 0;
}

export function useHeldItem(racer, field) {
  const id = racer.item;
  if (!id || racer.finished) return null;
  racer.item = null;
  racer.itemTime = 0;

  if (id === 'pamonha') {
    const cap = TUNING.maxSpeed * TUNING.itemBoostMul;
    racer.speed = Math.min(cap, Math.max(racer.speed + 6, 15));
    racer.boost = ITEM_RULES.pamonhaTime;
    racer.boostFrom = 'pamonha';
    racer.stun = 0;
    racer.stunKind = null;
    return id;
  }

  if (id === 'casca') {
    const slot = takeSlot(field.peels);
    const back = 2.45;
    slot.active = true;
    slot.x = racer.x - Math.sin(racer.yaw) * back;
    slot.z = racer.z - Math.cos(racer.yaw) * back;
    slot.yaw = racer.yaw;
    slot.life = ITEM_RULES.peelLife;
    slot.arm = ITEM_RULES.peelArm;
    slot.owner = racer.id;
    return id;
  }

  const slot = takeSlot(field.shots);
  const front = 2.2;
  slot.active = true;
  slot.x = racer.x + Math.sin(racer.yaw) * front;
  slot.z = racer.z + Math.cos(racer.yaw) * front;
  slot.yaw = racer.yaw;
  slot.life = ITEM_RULES.shotLife;
  slot.speed = ITEM_RULES.shotSpeed;
  slot.owner = racer.id;
  slot.trail = 0;
  return id;
}

function hitPeels(field, racers, dt, onSlip) {
  for (const peel of field.peels) {
    if (!peel.active) continue;
    peel.life -= dt;
    peel.arm = Math.max(0, peel.arm - dt);
    if (peel.life <= 0) {
      peel.active = false;
      continue;
    }
    if (peel.arm > 0) continue;
    for (const racer of racers) {
      if (racer.finished || racer.ghost) continue;
      const dist = Math.hypot(racer.x - peel.x, racer.z - peel.z);
      if (dist > ITEM_RULES.peelRadius) continue;
      peel.active = false;
      const dir = racer.lateral >= 0 ? -1 : 1;
      if (stumble(racer, 'casca', dir)) onSlip?.(racer);
      break;
    }
  }
}

function hitShots(field, racers, dt, onKnock) {
  for (const shot of field.shots) {
    if (!shot.active) continue;
    shot.life -= dt;
    if (shot.life <= 0) {
      shot.active = false;
      continue;
    }
    shot.x += Math.sin(shot.yaw) * shot.speed * dt;
    shot.z += Math.cos(shot.yaw) * shot.speed * dt;
    for (const racer of racers) {
      if (racer.id === shot.owner || racer.finished || racer.ghost) continue;
      const dist = Math.hypot(racer.x - shot.x, racer.z - shot.z);
      if (dist > ITEM_RULES.shotRadius) continue;
      shot.active = false;
      const dx = racer.x - shot.x;
      const dz = racer.z - shot.z;
      const side = dx * Math.cos(racer.yaw) - dz * Math.sin(racer.yaw);
      if (stumble(racer, 'tomate', side >= 0 ? 1 : -1)) onKnock?.(racer);
      break;
    }
  }
}

export function stepItems(field, racers, dt, track, opts = {}) {
  const rng = opts.rng || Math.random;
  const time = opts.time || 0;

  for (const racer of racers) {
    if (racer.finished || racer.ghost || !racer.item) continue;
    racer.itemTime += dt;
    const wants = racer.player ? !!opts.playerUse : botWantsUse(racer, racers, track, time);
    if (!wants) continue;
    const used = useHeldItem(racer, field);
    if (used) opts.onUse?.(racer, used);
  }

  hitPeels(field, racers, dt, opts.onSlip);
  hitShots(field, racers, dt, opts.onKnock);

  for (const box of field.boxes) {
    if (box.pop > 0) box.pop = Math.max(0, box.pop - dt);
    if (box.alive) continue;
    box.cooldown -= dt;
    if (box.cooldown > 0) continue;
    box.alive = true;
    box.cooldown = 0;
    box.pop = 0.26;
  }

  for (const box of field.boxes) {
    if (!box.alive) continue;
    for (const racer of racers) {
      if (racer.finished || racer.ghost || racer.item) continue;
      const dist = Math.hypot(racer.x - box.x, racer.z - box.z);
      if (dist > ITEM_RULES.pickupRadius) continue;
      racer.item = rollItem(rng);
      racer.itemTime = 0;
      box.alive = false;
      box.cooldown = ITEM_RULES.respawn;
      box.pop = 0;
      opts.onPickup?.(racer, racer.item);
      break;
    }
  }
}
