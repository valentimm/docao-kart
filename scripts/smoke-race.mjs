import { buildTrack, clearance, poseAt, project } from '../src/track.js';
import { ROSTER, TOTAL_LAPS } from '../src/roster.js';
import { SKINS, assignSkins, getSkin } from '../src/skins.js';
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
import {
  ITEM_RULES,
  ITEM_ORDER,
  createItemField,
  stepItems,
  useHeldItem,
  botWantsUse,
} from '../src/items.js';
import { createCapybaras, stepCapybaras, hitCapybaras } from '../src/capybaras.js';

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

const boxes = createItemField(track);
check(boxes.boxes.length >= 6, 'faltam caixas na pista');
for (const box of boxes.boxes) {
  const spot = project(track, box.x, box.z);
  check(Math.abs(spot.lateral) < track.halfWidth - 1.5, `caixa fora da pista (${spot.lateral.toFixed(2)})`);
  check(box.s > 0.08 && box.s < 0.9, 'caixa em cima do grid');
}
for (const racer of makeField()) {
  for (const box of boxes.boxes) {
    const dist = Math.hypot(racer.x - box.x, racer.z - box.z);
    check(dist > 8, `${racer.name} largou em cima de uma caixa`);
  }
}

const holder = spawnRacer(ROSTER[0], track, { row: 0, side: 1 });
const rival = spawnRacer(ROSTER[1], track, { row: 0, side: -1 });
const box = boxes.boxes[0];
holder.x = box.x;
holder.z = box.z;
holder.item = null;
rival.x = box.x + 0.2;
rival.z = box.z;
rival.item = null;
stepItems(boxes, [holder, rival], 1 / 60, track, { rng: () => 0, playerUse: true, time: 0 });
check(holder.award === 'pamonha', `caixa não deu pamonha (${holder.award})`);
check(holder.rolling, 'roleta não começou');
check(useHeldItem(holder, boxes) == null, 'deu para usar no quadro da coleta');
check(!holder.boostFrom, 'a coleta já soltou a pamonha');
check(!rival.item && !rival.rolling, 'dois pilotos pegaram a mesma caixa');
check(!box.alive, 'caixa não sumiu');
const sibling = boxes.boxes.find((other) => other.line === box.line && other !== box);
check(sibling?.alive, 'a linha inteira sumiu com um copo');
stepItems(boxes, [holder, rival], 1 / 60, track, { rng: () => 0.9, playerUse: true, time: 0 });
check(holder.award === 'pamonha' && holder.rolling, 'item trocou sozinho');
check(!rival.item, 'caixa respawnou cedo demais');
rival.x = 0;
rival.z = 0;
stepItems(boxes, [holder, rival], ITEM_RULES.respawn, track, { rng: () => 0.9, playerUse: false, time: 1 });
check(box.alive, 'caixa não voltou');
check(holder.item === 'pamonha', 'quem já tinha item pegou outro');
rival.x = box.x;
rival.z = box.z;
stepItems(boxes, [holder, rival], 1 / 60, track, { rng: () => 0.9, playerUse: false, time: 2 });
check(rival.award === 'tomate', `segunda caixa não deu tomate (${rival.award})`);
check(rival.rolling, 'segunda caixa entregou na hora');
check(holder.item === 'pamonha' && !holder.rolling, 'o item guardado sumiu');

const wheel = createItemField(track);
const spinner = spawnRacer(ROSTER[0], track, { row: 1, side: 1 });
spinner.x = wheel.boxes[2].x;
spinner.z = wheel.boxes[2].z;
stepItems(wheel, [spinner], 1 / 60, track, { rng: () => 0.5, playerUse: true });
check(spinner.award === 'casca' && spinner.rolling, 'roleta da casca não armou');
const shown = new Set([spinner.item]);
const gaps = [];
let lastChange = 0;
let elapsed = 0;
while (spinner.rolling && elapsed < 3) {
  const before = spinner.item;
  stepItems(wheel, [spinner], 1 / 60, track, { playerUse: true, time: elapsed });
  elapsed += 1 / 60;
  if (spinner.boostFrom || !spinner.item) check(false, 'usou a casca com a roleta girando');
  if (spinner.item !== before) {
    shown.add(spinner.item);
    gaps.push(elapsed - lastChange);
    lastChange = elapsed;
  }
}
check(!spinner.rolling && spinner.item === 'casca', 'roleta não parou na casca');
check(shown.size === ITEM_ORDER.length, `roleta mostrou ${[...shown].join(', ')}`);
check(gaps.length >= 4 && gaps[0] < gaps[gaps.length - 1], 'roleta não desacelerou');
check(elapsed > 1 && elapsed < ITEM_RULES.roulette + 0.05, `roleta durou ${elapsed.toFixed(3)}s`);
check(useHeldItem(spinner, wheel) === 'casca', 'casca não saiu depois da roleta');

holder.itemTime = 1;
holder.speed = 22;
const kicked = holder.speed;
useHeldItem(holder, boxes);
check(!holder.item, 'pamonha ficou na mão');
check(holder.boostFrom === 'pamonha' && holder.boost > 1, 'pamonha não deu arrancada');
check(holder.speed > kicked, 'pamonha não empurrou o kart');

const cruise = spawnRacer(ROSTER[0], track, { row: 1, side: 1 });
const surge = spawnRacer(ROSTER[0], track, { row: 1, side: -1 });
cruise.speed = 22;
surge.speed = 22;
surge.item = 'pamonha';
surge.itemTime = 1;
useHeldItem(surge, boxes);
const gas = { throttle: 1, brake: 0, reverse: false, steer: 0, drift: false };
for (let i = 0; i < 70; i += 1) {
  stepRacer(cruise, gas, 1 / 60, track, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
  stepRacer(surge, gas, 1 / 60, track, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
}
const crashed = surge.wallBump > 0;
check(crashed || surge.speed > cruise.speed + 4, `pamonha pouco acima do ritmo (${surge.speed.toFixed(1)} vs ${cruise.speed.toFixed(1)})`);
check(crashed || surge.speed > TUNING.maxSpeed, 'pamonha não passou do limite normal');

const bumper = spawnRacer(ROSTER[0], track, { row: 0, side: 1 });
const spot = project(track, bumper.x, bumper.z);
const side = Math.sign(spot.lateral) || 1;
bumper.x += spot.nx * side * track.halfWidth;
bumper.z += spot.nz * side * track.halfWidth;
const offTrack = project(track, bumper.x, bumper.z);
const outSign = Math.sign(offTrack.lateral) || 1;
bumper.yaw = Math.atan2(offTrack.nx * outSign, offTrack.nz * outSign);
bumper.speed = 16;
stepRacer(bumper, { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false }, 1 / 60, track, {
  raceTime: 0,
  totalLaps: TOTAL_LAPS,
});
check(bumper.speed < 8, `batida na parede não tirou a velocidade (${bumper.speed.toFixed(1)})`);

const dropper = spawnRacer(ROSTER[2], track, { row: 0, side: 1 });
dropper.item = 'casca';
dropper.itemTime = 1;
dropper.yaw = 0.3;
const fx = Math.sin(dropper.yaw);
const fz = Math.cos(dropper.yaw);
useHeldItem(dropper, boxes);
const peel = boxes.peels.find((item) => item.active);
check(peel, 'casca não caiu');
const behind = (peel.x - dropper.x) * fx + (peel.z - dropper.z) * fz;
check(behind < -1.8, `casca não ficou atrás (${behind.toFixed(2)})`);
const slip = spawnRacer(ROSTER[3], track, { row: 1, side: 1 });
slip.x = peel.x;
slip.z = peel.z;
slip.speed = 18;
slip.yaw = dropper.yaw;
peel.arm = 0;
const slipSpeed = slip.speed;
const slipYaw = slip.yaw;
stepItems(boxes, [dropper, slip], 1 / 60, track, { playerUse: false, time: 3 });
check(slip.stunKind === 'casca', 'casca não escorregou o kart');
check(slip.speed < slipSpeed * 0.5, 'casca quase não freou');
check(!peel.active, 'casca ficou no chão depois do toque');
for (let i = 0; i < 12; i += 1) stepRacer(slip, gas, 1 / 60, track, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
check(Math.abs(slip.yaw - slipYaw) > 0.4, 'casca não girou o kart');

const shooter = spawnRacer(ROSTER[1], track, { row: 0, side: -1 });
shooter.item = 'tomate';
shooter.itemTime = 1;
shooter.yaw = 0.4;
useHeldItem(shooter, boxes);
const shot = boxes.shots.find((item) => item.active && item.owner === shooter.id);
check(shot && Math.abs(shot.yaw - shooter.yaw) < 1e-6, 'tomate não saiu reto');
const target = spawnRacer(ROSTER[0], track, { row: 1, side: 1 });
target.x = shooter.x + Math.sin(shooter.yaw) * 8;
target.z = shooter.z + Math.cos(shooter.yaw) * 8;
target.speed = 10;
target.yaw = shooter.yaw;
const aside = spawnRacer(ROSTER[2], track, { row: 1, side: -1 });
aside.x = shooter.x + Math.cos(shooter.yaw) * 6;
aside.z = shooter.z - Math.sin(shooter.yaw) * 6;
aside.speed = 10;
const targetSpeed = target.speed;
let hit = false;
for (let i = 0; i < 40 && shot.active; i += 1) {
  stepItems(boxes, [shooter, target, aside], 1 / 60, track, { playerUse: false, time: 4 });
  if (target.stunKind === 'tomate') hit = true;
}
check(hit, 'tomate não acertou quem estava na frente');
check(target.speed < targetSpeed, 'tomate não empurrou o kart');
check(!aside.stunKind, 'tomate desviou para o lado');
check(!shooter.stunKind, 'tomate acertou quem atirou');

const bot = spawnRacer(ROSTER[1], track, { row: 0, side: -1 });
bot.item = 'pamonha';
bot.award = 'pamonha';
bot.rolling = true;
bot.itemTime = 4;
check(!botWantsUse(bot, [bot], track, 0), 'bot usou item com a roleta girando');
bot.rolling = false;
bot.itemTime = 0.2;
check(!botWantsUse(bot, [bot], track, 0), 'bot usou item na hora');
bot.itemTime = 3;
check(botWantsUse(bot, [bot], track, 0), 'bot guardou a pamonha para sempre');
bot.item = 'casca';
bot.itemTime = 0.8;
check(!botWantsUse(bot, [bot], track, 1), 'bot soltou casca sem ninguém atrás');
const tail = spawnRacer(ROSTER[3], track, { row: 1, side: 1 });
tail.x = bot.x - Math.sin(bot.yaw) * 4;
tail.z = bot.z - Math.cos(bot.yaw) * 4;
check(botWantsUse(bot, [bot, tail], track, 1), 'bot não soltou casca com rival colado');
bot.item = 'tomate';
bot.itemTime = 1;
const nose = spawnRacer(ROSTER[0], track, { row: 1, side: -1 });
nose.x = bot.x + Math.sin(bot.yaw) * 8;
nose.z = bot.z + Math.cos(bot.yaw) * 8;
let fired = 0;
let samples = 0;
for (let t = 0; t <= 2; t += 0.05) {
  bot.item = 'tomate';
  bot.itemTime = 1;
  samples += 1;
  if (botWantsUse(bot, [bot, nose], track, t)) fired += 1;
}
check(fired > 0 && fired < samples * 0.5, `bot metralhou o tomate (${fired}/${samples})`);

let seed = 123456789;
const seeded = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const field = makeField();
const itemRace = createItemField(track);
const seenItems = new Map(field.map((racer) => [racer.id, 0]));
let pickups = 0;
let uses = 0;
const itemCtx = {
  raceTime: 0,
  totalLaps: TOTAL_LAPS,
  onFinish(racer) {
    seenItems.set(racer.id, (seenItems.get(racer.id) || 0) + 1);
  },
};
for (let step = 0; step < 200 / dt; step += 1) {
  itemCtx.raceTime = step * dt;
  for (const racer of field) {
    const input = racer.finished ? { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false } : aiInput(racer, track, itemCtx.raceTime);
    stepRacer(racer, input, dt, track, itemCtx);
    if (!Number.isFinite(racer.x) || !Number.isFinite(racer.z) || !Number.isFinite(racer.speed)) {
      check(false, `${racer.name} ficou NaN com item`);
      break;
    }
  }
  separate(field, track);
  stepItems(itemRace, field, dt, track, {
    rng: seeded,
    time: itemCtx.raceTime,
    playerUse: false,
    onPickup() {
      pickups += 1;
    },
    onUse() {
      uses += 1;
    },
  });
  if ([...seenItems.values()].every((count) => count === 1)) break;
}
for (const racer of field) {
  check(racer.finished, `${racer.name} não terminou com itens (volta ${racer.lap}, s ${racer.s.toFixed(2)})`);
  check(seenItems.get(racer.id) === 1, `${racer.name} chegou ${seenItems.get(racer.id)} vezes com itens`);
}
check(pickups > 0, 'ninguém pegou caixa na corrida');
check(uses > 0, 'nenhum bot usou item');

check(SKINS.some((skin) => skin.id === 'classico' && skin.shirt.color === '#d8261c'), 'faltou o visual clássico');
check(getSkin('não-existe').id === 'classico', 'skin desconhecida não voltou ao clássico');
const distinct = assignSkins('classico');
check(distinct.docao === 'classico', 'jogador não ficou no clássico');
check(new Set(Object.values(distinct)).size === 4, 'pilotos repetiram o visual');
const swapped = assignSkins('clube');
check(swapped.docao === 'clube' && swapped.hortela !== 'clube', 'bot ficou com o visual do jogador');

const park = buildTrack('barigui');
const parkGap = clearance(park);
check(park.id === 'barigui', 'Barigui não carregou');
check(park.length > 420 && park.length < 700, `Barigui com tamanho estranho: ${park.length}`);
check(parkGap.min > 18, `Barigui se cruza (${parkGap.min.toFixed(1)} m)`);
check(park.lake && Math.abs(project(park, park.lake.x, park.lake.z).lateral) > park.halfWidth + 8, 'lago do Barigui invadiu a pista');
check(park.open && !track.open, 'só o Barigui ficou sem cerca');

const grassKart = spawnRacer(ROSTER[0], park, { row: 0, side: 1 });
const grassPose = poseAt(park, 0.04, park.halfWidth + 5);
grassKart.x = grassPose.x;
grassKart.z = grassPose.z;
grassKart.yaw = grassPose.yaw;
grassKart.s = grassPose.s;
grassKart.lateral = grassPose.lateral;
grassKart.speed = 14;
const hold = { throttle: 1, brake: 0, reverse: false, steer: 0, drift: false };
for (let i = 0; i < 50; i += 1) {
  stepRacer(grassKart, hold, 1 / 60, park, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
}
const onGrass = project(park, grassKart.x, grassKart.z);
check(Math.abs(onGrass.lateral) > park.halfWidth + 1, 'a grama devolveu o kart para o asfalto');
check(grassKart.speed < 7, `grama não segurou o kart (${grassKart.speed.toFixed(1)})`);

const farPose = poseAt(park, 0.04, park.offLimit + 10);
grassKart.x = farPose.x;
grassKart.z = farPose.z;
grassKart.yaw = farPose.yaw;
grassKart.s = farPose.s;
grassKart.lateral = farPose.lateral;
grassKart.speed = 10;
stepRacer(grassKart, hold, 1 / 60, park, { raceTime: 1, totalLaps: TOTAL_LAPS });
const held = project(park, grassKart.x, grassKart.z);
check(Math.abs(held.lateral) <= park.offLimit + 0.2, `o limite invisível deixou o kart ir embora (${held.lateral.toFixed(1)})`);

grassKart.x = park.lake.x;
grassKart.z = park.lake.z;
grassKart.speed = 8;
stepRacer(grassKart, hold, 1 / 60, park, { raceTime: 1, totalLaps: TOTAL_LAPS });
const dx = grassKart.x - park.lake.x;
const dz = grassKart.z - park.lake.z;
const inLake = (dx * dx) / (park.lake.rx * park.lake.rx) + (dz * dz) / (park.lake.rz * park.lake.rz);
check(inLake >= 1, 'o kart atravessou o lago');

const { spawnField, localSeats, roomSeats, clampGrid } = await import('../src/field.js');
check(clampGrid(2) === 4 && clampGrid(20) === 16 && clampGrid(9) === 9, 'grid fora de 4 a 16');
const big = spawnField(localSeats(16, { name: 'Docão', skin: 'classico', car: 'arranque' }), park);
check(big.length === 16, 'grid de 16 não fechou');
check(big.filter((racer) => racer.local).length === 1, 'faltou o piloto local');
for (const racer of big) {
  const spot = project(park, racer.x, racer.z);
  check(Math.abs(spot.lateral) < park.halfWidth - 0.3, `${racer.name} largou fora da pista do Barigui`);
}
const room = roomSeats(
  [
    { id: 'host', name: 'Ana', skin: 'classico', car: 'veloz', host: true },
    { id: 'guest', name: 'Bia', skin: 'clube', car: 'fechada' },
  ],
  6,
);
check(room.length === 6 && room[0].human && room[1].human && room.filter((seat) => !seat.human).length === 4, 'sala não completou com bots');

check(createCapybaras(track).length === 0, 'a feira ganhou capivara');
const herd = createCapybaras(park);
check(herd.length === 3, 'o Barigui não ficou com três capivaras');
for (let i = 0; i < 500; i += 1) stepCapybaras(herd, 1 / 60, park, i / 60);
for (const animal of herd) {
  check(animal.s >= animal.from - 0.001 && animal.s <= animal.to + 0.001, 'capivara saiu do trecho');
  check(Math.abs(animal.lateral) < 1.2, 'capivara saiu do meio da pista');
  check(Math.abs(project(park, animal.x, animal.z).lateral) < 2, 'capivara fora do asfalto');
}
const victim = spawnRacer(ROSTER[0], park, { row: 0, side: 1 });
victim.x = herd[0].x;
victim.z = herd[0].z;
victim.speed = 12;
victim.capyGrace = 0;
hitCapybaras(herd, [victim], 1 / 60);
check(victim.speed < 8, 'batida na capivara não tirou velocidade');

const sharpKart = spawnRacer(ROSTER[0], track, { row: 2, side: 1 });
const softKart = spawnRacer(ROSTER[1], track, { row: 2, side: -1 });
sharpKart.speed = 12;
softKart.speed = 12;
const sharpIn = { throttle: 1, brake: 0, reverse: false, steer: 0.45, drift: true, glide: false };
const softIn = { throttle: 1, brake: 0, reverse: false, steer: 0.45, drift: false, glide: true };
const quiet = { throttle: 1, brake: 0, reverse: false, steer: 0, drift: false, glide: false };
stepRacer(sharpKart, sharpIn, 0.04, track, { raceTime: 0, totalLaps: TOTAL_LAPS });
stepRacer(softKart, softIn, 0.04, track, { raceTime: 0, totalLaps: TOTAL_LAPS });
check(softKart.driftKind === 'soft' && sharpKart.driftKind === 'sharp', 'os dois tipos de derrapada não separaram');
check(softKart.hopSpan < sharpKart.hopSpan, 'a derrapada suave pulou igual à forte');
for (let i = 0; i < 30; i += 1) {
  stepRacer(sharpKart, sharpIn, 1 / 60, track, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
  stepRacer(softKart, softIn, 1 / 60, track, { raceTime: i / 60, totalLaps: TOTAL_LAPS });
}
check(Math.abs(softKart.slide) < Math.abs(sharpKart.slide), 'a derrapada suave escorregou tanto quanto a forte');
check(softKart.driftTime > 0.4 && softKart.driftTime < TUNING.softMin, 'a barra suave não demorou mais que a forte');
softKart.driftTime = TUNING.driftMin + 0.05;
stepRacer(softKart, quiet, 1 / 60, track, { raceTime: 2, totalLaps: TOTAL_LAPS });
check(!softKart.boostFrom, 'a derrapada suave deu impulso antes da barra');
softKart.speed = 12;
softKart.drifting = true;
softKart.driftKind = 'soft';
softKart.driftSide = 1;
softKart.driftTime = TUNING.softMin;
stepRacer(softKart, quiet, 1 / 60, track, { raceTime: 3, totalLaps: TOTAL_LAPS });
check(softKart.boostFrom === 'drift', 'soltar a derrapada suave não deu impulso');

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(
  `ok pista ${track.length.toFixed(0)}m, folga ${gap.min.toFixed(1)}m, vencedor ${ranking[0].name} em ${ranking[0].finishTime.toFixed(2)}s`,
);
