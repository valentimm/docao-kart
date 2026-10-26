import { buildTrack, clearance, project } from '../src/track.js';
import { ROSTER, TOTAL_LAPS } from '../src/roster.js';
import {
  TUNING,
  spawnRacer,
  aiInput,
  stepRacer,
  separate,
  rankRacers,
  applyProgress,
  createRacer,
} from '../src/drive.js';

const failures = [];
function check(cond, message) {
  if (!cond) failures.push(message);
}

const track = buildTrack();
const gap = clearance(track);
check(track.length > 280 && track.length < 520, `tamanho estranho da pista: ${track.length}`);
check(gap.min > 18, `pista se cruza (${gap.min.toFixed(1)} m)`);
check(track.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)), 'ponto inválido na pista');

const origin = project(track, 0, -8);
check(Math.abs(origin.lateral) > track.halfWidth + 8, 'centro da feira invadiu a pista');

const slots = [
  { id: 'milho', row: 0, side: -1 },
  { id: 'docao', row: 0, side: 1 },
  { id: 'hortela', row: 1, side: -1 },
  { id: 'jabuticaba', row: 1, side: 1 },
];

function makeField() {
  return slots.map((slot) => {
    const base = ROSTER.find((r) => r.id === slot.id);
    const def = base.player
      ? {
          ...base,
          ai: { pace: 1, look: 14, corner: 0.86, drift: false, line: 0.4, wander: 0.3, phase: 0.2 },
        }
      : base;
    return spawnRacer(def, track, slot);
  });
}

const grid = makeField();
const front = grid.filter((r) => r.spawn.s > 0.96);
const back = grid.filter((r) => r.spawn.s <= 0.96);
check(front.length === 2 && back.length === 2, 'grid não ficou em duas filas');
check(Math.min(...front.map((r) => r.travel)) > Math.max(...back.map((r) => r.travel)), 'fila de trás largou na frente');

const limit = track.halfWidth - TUNING.kartRadius + 0.08;
const outside = createRacer(ROSTER[0], { x: 0, z: -8, yaw: 0, s: 0.5, lateral: 0 });
outside.spawn = { x: 0, z: -8, yaw: 0, s: 0.5, lateral: 0 };
for (let i = 0; i < 20; i += 1) {
  stepRacer(outside, { throttle: 1, brake: 0, reverse: false, steer: 0, drift: false }, 1 / 60, track, {
    raceTime: i / 60,
    totalLaps: TOTAL_LAPS,
  });
}
check(Math.abs(outside.lateral) <= limit, `barreira não segurou o kart (${outside.lateral})`);
check(Number.isFinite(outside.x) && Number.isFinite(outside.speed), 'física gerou NaN');

const jumped = createRacer(ROSTER[0], { x: 0, z: 0, yaw: 0, s: 0.97, lateral: 0 });
jumped.s = 0.97;
jumped.travel = 0.97;
applyProgress(jumped, 0.02, 0.016, { raceTime: 0, totalLaps: TOTAL_LAPS });
check(jumped.lap === 1 && !jumped.finished, 'cruzar a largada não pode completar a volta');

const progress = createRacer(ROSTER[0], { x: 0, z: 0, yaw: 0, s: 0.97, lateral: 0 });
progress.s = 0.97;
progress.travel = 0.97;
let finishes = 0;
const ctx = {
  raceTime: 0,
  totalLaps: TOTAL_LAPS,
  onFinish() {
    finishes += 1;
  },
};
let s = 0.97;
for (let i = 0; i < 2200; i += 1) {
  s = (s + 0.002) % 1;
  ctx.raceTime = i * 0.016;
  applyProgress(progress, s, 0.016, ctx);
}
check(finishes === 1, `esperava 1 chegada, veio ${finishes}`);
check(progress.finished && progress.lap === 3, `volta final incoerente (lap ${progress.lap})`);

const backward = createRacer(ROSTER[0], { x: 0, z: 0, yaw: 0, s: 0.2, lateral: 0 });
backward.s = 0.2;
backward.travel = 0.2;
backward.nextGate = 1;
for (let i = 0; i < 800; i += 1) {
  const prev = backward.s;
  const next = (prev - 0.004 + 1) % 1;
  applyProgress(backward, next, 0.016, { raceTime: i * 0.016, totalLaps: TOTAL_LAPS });
}
check(backward.lap === 1 && !backward.finished, 'ré contou volta');

const racers = makeField();
const seen = new Map(racers.map((r) => [r.id, 0]));
const raceCtx = {
  raceTime: 0,
  totalLaps: TOTAL_LAPS,
  onFinish(racer) {
    seen.set(racer.id, (seen.get(racer.id) || 0) + 1);
  },
};
const dt = 1 / 60;
const horizon = 110;
let worstLateral = 0;
for (let step = 0; step < horizon / dt; step += 1) {
  raceCtx.raceTime = step * dt;
  for (const racer of racers) {
    const input = racer.finished ? { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false } : aiInput(racer, track, raceCtx.raceTime);
    stepRacer(racer, input, dt, track, raceCtx);
    if (!Number.isFinite(racer.x) || !Number.isFinite(racer.z) || !Number.isFinite(racer.speed)) {
      check(false, `${racer.name} ficou NaN`);
      break;
    }
    worstLateral = Math.max(worstLateral, Math.abs(racer.lateral));
  }
  separate(racers, track);
  if ([...seen.values()].every((count) => count === 1)) break;
}

for (const racer of racers) {
  check(racer.finished, `${racer.name} não terminou (volta ${racer.lap}, s ${racer.s.toFixed(2)}, v ${racer.speed.toFixed(1)})`);
  check(seen.get(racer.id) === 1, `${racer.name} chegou ${seen.get(racer.id)} vezes`);
  check(racer.lap <= TOTAL_LAPS, `${racer.name} passou de ${TOTAL_LAPS} voltas`);
}
check(worstLateral <= track.halfWidth - 0.3, `kart atravessou a cerca (${worstLateral.toFixed(2)})`);

const ranking = rankRacers(racers);
for (let i = 1; i < ranking.length; i += 1) {
  if (ranking[i - 1].finished && ranking[i].finished) {
    check(ranking[i - 1].finishTime <= ranking[i].finishTime, 'ordem de chegada invertida');
  }
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(
  `ok pista ${track.length.toFixed(0)}m, folga ${gap.min.toFixed(1)}m, vencedor ${ranking[0].name} em ${ranking[0].finishTime.toFixed(2)}s`,
);
