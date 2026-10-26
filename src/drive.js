import { poseAt, project } from './track.js';

export const TUNING = {
  maxSpeed: 26,
  accel: 18,
  brake: 42,
  coast: 12,
  reverseMax: 7,
  steerAngle: 0.4,
  driftSteer: 0.58,
  yawCap: 2.15,
  wheelbase: 2.65,
  minTurnSpeed: 8.5,
  kartRadius: 1.15,
  boostMul: 1.2,
  boostDuration: 0.8,
  driftMin: 0.45,
};

const GATES = [0, 0.25, 0.5, 0.75];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function wrapAngle(d) {
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function wrapDelta(next, prev) {
  let d = next - prev;
  if (d > 0.5) d -= 1;
  else if (d < -0.5) d += 1;
  return d;
}

function crossedForward(prev, next, gate) {
  let a = prev;
  let b = next;
  if (b < a) b += 1;
  let g = gate;
  if (g < a - 1e-6) g += 1;
  return g > a + 1e-5 && g <= b + 1e-4;
}

export function createRacer(def, pose) {
  return {
    id: def.id,
    name: def.name,
    player: !!def.player,
    number: def.number,
    body: def.body,
    accent: def.accent,
    pig: def.pig,
    snout: def.snout,
    ear: def.ear,
    bandana: def.bandana,
    hat: def.hat || null,
    minimap: def.minimap,
    ai: def.ai || null,
    line: 0,
    x: pose.x,
    z: pose.z,
    yaw: pose.yaw,
    s: pose.s,
    lateral: pose.lateral || 0,
    speed: 0,
    slide: 0,
    steer: 0,
    lap: 1,
    travel: pose.s,
    nextGate: 1,
    finished: false,
    finishTime: null,
    ghost: false,
    lapStart: 0,
    bestLap: null,
    lastLapTime: null,
    driftTime: 0,
    drifting: false,
    boost: 0,
    stuckTime: 0,
    wallBump: 0,
    reverseTime: 0,
    paceMul: 1,
    spawn: null,
  };
}

export function spawnRacer(def, track, slot) {
  const dist = 11 + slot.row * 6.2;
  const s = 1 - dist / track.length;
  const lateral = slot.side * 2.15 * track.inwardSign;
  const pose = poseAt(track, s, lateral);
  const racer = createRacer(def, pose);
  racer.lateral = lateral;
  racer.line = (def.ai?.line ?? 0.5) * track.inwardSign;
  racer.spawn = { x: pose.x, z: pose.z, yaw: pose.yaw, s: pose.s, lateral };
  return racer;
}

export function resetRacer(racer) {
  const spawn = racer.spawn;
  racer.x = spawn.x;
  racer.z = spawn.z;
  racer.yaw = spawn.yaw;
  racer.s = spawn.s;
  racer.lateral = spawn.lateral;
  racer.speed = 0;
  racer.slide = 0;
  racer.steer = 0;
  racer.lap = 1;
  racer.travel = spawn.s;
  racer.nextGate = 1;
  racer.finished = false;
  racer.finishTime = null;
  racer.ghost = false;
  racer.lapStart = 0;
  racer.bestLap = null;
  racer.lastLapTime = null;
  racer.driftTime = 0;
  racer.drifting = false;
  racer.boost = 0;
  racer.stuckTime = 0;
  racer.wallBump = 0;
  racer.reverseTime = 0;
  racer.paceMul = 1;
}

export function aiInput(racer, track, time) {
  const ai = racer.ai;
  const target = poseAt(track, (racer.s + ai.look / track.length) % 1, racer.line);
  const desired = Math.atan2(target.x - racer.x, target.z - racer.z);
  let steer = clamp(wrapAngle(desired - racer.yaw) / 0.55, -1, 1);

  const here = poseAt(track, racer.s, 0);
  const soon = poseAt(track, (racer.s + 16 / track.length) % 1, 0);
  const bend = Math.abs(wrapAngle(soon.yaw - here.yaw));

  let throttle = 1;
  let brake = 0;
  if (bend > 0.5) throttle = ai.corner;
  if (bend > 0.9) throttle = Math.min(throttle, 0.58);
  if (bend > 1.15 && racer.speed > 18) {
    throttle = 0;
    brake = 1;
  }

  steer = clamp(steer + Math.sin(time * ai.wander + ai.phase) * 0.06, -1, 1);

  const edge = track.halfWidth - 2.35;
  if (Math.abs(racer.lateral) > edge) {
    const back = Math.sign(racer.line - racer.lateral) || -Math.sign(racer.lateral);
    steer = clamp(steer + back * 0.7, -1, 1);
    throttle = Math.min(throttle, 0.62);
    brake = 0;
  }

  if (racer.stuckTime > 1.05) {
    return {
      throttle: 1,
      brake: 0,
      reverse: false,
      steer: clamp((racer.line - racer.lateral) / 3, -1, 1),
      drift: false,
    };
  }

  const drift = !!ai.drift && bend > 0.7 && racer.speed > 14 && Math.abs(steer) > 0.3;
  return { throttle, brake, reverse: false, steer, drift };
}

export function stepRacer(racer, input, dt, track, ctx) {
  racer.wallBump = Math.max(0, racer.wallBump - dt);
  if (racer.finished) {
    parkFinished(racer, dt, track);
    return;
  }

  const throttle = input.throttle || 0;
  const brake = input.brake || 0;
  const steerIn = clamp(input.steer || 0, -1, 1);
  racer.steer = steerIn;

  const wantDrift = !!input.drift && racer.speed > 9 && Math.abs(steerIn) > 0.1;
  if (wantDrift) {
    racer.drifting = true;
    racer.driftTime += dt;
  } else if (racer.drifting) {
    if (racer.driftTime >= TUNING.driftMin) racer.boost = TUNING.boostDuration;
    racer.drifting = false;
    racer.driftTime = 0;
  }
  if (racer.boost > 0) racer.boost = Math.max(0, racer.boost - dt);

  const pace = racer.player ? 1 : (racer.ai?.pace || 1) * (racer.paceMul || 1);
  const speedCap =
    TUNING.maxSpeed * pace * (racer.boost > 0 ? TUNING.boostMul : 1) * (racer.drifting ? 0.94 : 1);

  let target = 0;
  let rate = TUNING.coast;
  if (brake > 0 && throttle <= 0) {
    if (racer.speed > 0.45) {
      target = 0;
      rate = TUNING.brake;
    } else if (input.reverse) {
      target = -TUNING.reverseMax;
      rate = TUNING.accel;
    } else {
      target = 0;
      rate = TUNING.brake;
    }
  } else if (throttle > 0) {
    target = speedCap * clamp(throttle, 0, 1);
    rate = TUNING.accel * (racer.drifting ? 0.62 : 1);
  }

  racer.speed += clamp(target - racer.speed, -rate * dt, rate * dt);
  if (racer.speed > speedCap) {
    racer.speed += (speedCap - racer.speed) * Math.min(1, 3.2 * dt);
  }

  const steerAngle = steerIn * (racer.drifting ? TUNING.driftSteer : TUNING.steerAngle);
  const signed = Math.sign(racer.speed || 1);
  const turnSpeed = Math.max(Math.abs(racer.speed), TUNING.minTurnSpeed);
  let yawRate = (turnSpeed / TUNING.wheelbase) * Math.tan(steerAngle) * signed;
  yawRate = clamp(yawRate, -TUNING.yawCap, TUNING.yawCap);
  if (Math.abs(racer.speed) < 0.45) yawRate *= Math.abs(racer.speed) / 0.45;
  racer.yaw += yawRate * dt;

  const targetSlide = racer.drifting ? steerIn * Math.abs(racer.speed) * 0.5 : 0;
  const grip = racer.drifting ? 3.1 : 9;
  racer.slide += (targetSlide - racer.slide) * Math.min(1, grip * dt);

  const fx = Math.sin(racer.yaw);
  const fz = Math.cos(racer.yaw);
  const rx = Math.cos(racer.yaw);
  const rz = -Math.sin(racer.yaw);
  racer.x += (fx * racer.speed + rx * racer.slide) * dt;
  racer.z += (fz * racer.speed + rz * racer.slide) * dt;

  constrain(racer, track, dt, ctx);
  const proj = project(track, racer.x, racer.z);
  racer.lateral = proj.lateral;
  applyProgress(racer, proj.s, dt, ctx);

  if (racer.speed < 1.5 && Math.abs(racer.lateral) > track.halfWidth - 2.4) racer.stuckTime += dt;
  else racer.stuckTime = Math.max(0, racer.stuckTime - dt * 2);
}

function constrain(racer, track, dt, ctx) {
  const proj = project(track, racer.x, racer.z);
  const limit = track.halfWidth - TUNING.kartRadius;
  if (Math.abs(proj.lateral) <= limit) return;
  const sign = Math.sign(proj.lateral);
  const push = Math.abs(proj.lateral) - limit;
  racer.x -= proj.nx * sign * push;
  racer.z -= proj.nz * sign * push;
  racer.lateral = sign * limit;

  const fx = Math.sin(racer.yaw);
  const fz = Math.cos(racer.yaw);
  const outward = (fx * proj.nx + fz * proj.nz) * sign;
  if (outward > 0.22) {
    racer.speed *= 1 - Math.min(0.42, outward * 0.48);
    racer.slide *= 0.35;
    racer.yaw -= sign * outward * 2.4 * dt;
    if (racer.wallBump <= 0) ctx.onWall?.(racer);
    racer.wallBump = 0.28;
  }
}

export function applyProgress(racer, s, dt, ctx) {
  if (racer.finished) return;
  const prev = racer.s;
  const delta = wrapDelta(s, prev);
  racer.s = s;
  racer.travel += delta;
  if (delta < -0.002) racer.reverseTime += dt;
  else racer.reverseTime = Math.max(0, racer.reverseTime - dt * 3);
  if (delta <= 0.0004) return;

  for (let n = 0; n < GATES.length; n += 1) {
    const gateIndex = racer.nextGate;
    const gate = GATES[gateIndex];
    if (!crossedForward(prev, s, gate)) break;
    racer.nextGate = (gateIndex + 1) % GATES.length;
    if (gateIndex !== 0) continue;

    const lapTime = ctx.raceTime - racer.lapStart;
    racer.lastLapTime = lapTime;
    if (racer.bestLap == null || lapTime < racer.bestLap) racer.bestLap = lapTime;
    racer.lapStart = ctx.raceTime;
    if (racer.lap >= ctx.totalLaps) {
      racer.finished = true;
      racer.finishTime = ctx.raceTime;
      racer.ghost = true;
      racer.lap = ctx.totalLaps;
      ctx.onFinish?.(racer);
      return;
    }
    racer.lap += 1;
    ctx.onLap?.(racer);
  }
}

function parkFinished(racer, dt, track) {
  racer.drifting = false;
  racer.boost = 0;
  racer.speed = Math.max(0, racer.speed - 30 * dt);
  racer.slide = 0;
  if (racer.speed <= 0.4) {
    racer.speed = 0;
    return;
  }
  const parkLat = -track.inwardSign * (track.halfWidth - 1.55);
  const aim = poseAt(track, (racer.s + 8 / track.length) % 1, parkLat);
  racer.yaw += clamp(wrapAngle(Math.atan2(aim.x - racer.x, aim.z - racer.z) - racer.yaw), -1.6 * dt, 1.6 * dt);
  racer.x += Math.sin(racer.yaw) * racer.speed * dt;
  racer.z += Math.cos(racer.yaw) * racer.speed * dt;
  const proj = project(track, racer.x, racer.z);
  const limit = track.halfWidth - 0.45;
  if (Math.abs(proj.lateral) > limit) {
    const sign = Math.sign(proj.lateral);
    const push = Math.abs(proj.lateral) - limit;
    racer.x -= proj.nx * sign * push;
    racer.z -= proj.nz * sign * push;
  }
  const parked = project(track, racer.x, racer.z);
  racer.s = parked.s;
  racer.lateral = parked.lateral;
}

export function separate(racers, track) {
  const minDist = 1.7;
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < racers.length; i += 1) {
      for (let j = i + 1; j < racers.length; j += 1) {
        const a = racers[i];
        const b = racers[j];
        if (a.ghost || b.ghost) continue;
        let dx = b.x - a.x;
        let dz = b.z - a.z;
        const dist = Math.hypot(dx, dz) || 0.0001;
        if (dist >= minDist) continue;
        const push = (minDist - dist) * 0.55;
        dx /= dist;
        dz /= dist;
        a.x -= dx * push;
        a.z -= dz * push;
        b.x += dx * push;
        b.z += dz * push;
        if (a.speed > b.speed + 1.5) a.speed -= (a.speed - b.speed) * 0.05;
        if (b.speed > a.speed + 1.5) b.speed -= (b.speed - a.speed) * 0.05;
      }
    }
  }
  const limit = track.halfWidth - TUNING.kartRadius;
  for (const racer of racers) {
    if (racer.ghost) continue;
    const proj = project(track, racer.x, racer.z);
    if (Math.abs(proj.lateral) > limit) {
      const sign = Math.sign(proj.lateral);
      const push = Math.abs(proj.lateral) - limit;
      racer.x -= proj.nx * sign * push;
      racer.z -= proj.nz * sign * push;
      racer.lateral = sign * limit;
    } else {
      racer.lateral = proj.lateral;
    }
  }
}

export function rankRacers(racers) {
  return [...racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.travel - a.travel;
  });
}

export function formatTime(t) {
  if (t == null || Number.isNaN(t)) return '—';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const cs = Math.floor((t * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
