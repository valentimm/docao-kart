/** Grid size, bot roster and the seats that start a race. */

import { ROSTER } from './roster.js';
import { applyCar } from './cars.js';
import { spawnRacer } from './drive.js';

export const GRID_MIN = 4;
export const GRID_MAX = 16;

const DOCAO = ROSTER.find((racer) => racer.id === 'docao');

const EXTRA = [
  ['pitanga', 'Pitanga', 0xe23b55, 0xffd0d6, '#e23b55'],
  ['guavira', 'Guavira', 0xf0a202, 0xffe08a, '#f0a202'],
  ['araca', 'Araçá', 0xef6f4a, 0xffd0b5, '#ef6f4a'],
  ['butia', 'Butiá', 0xe2b15a, 0xfff1c9, '#c4923a'],
  ['pinhao', 'Pinhão', 0x8c4a32, 0xf0d2b4, '#8c4a32'],
  ['mate', 'Mate', 0x3e8f4a, 0xd7f2c2, '#2f7a3a'],
  ['cambuci', 'Cambuci', 0x5b8c3a, 0xe4f2b8, '#5b8c3a'],
  ['graviola', 'Graviola', 0xb7d45a, 0xf4ffd0, '#8aaa32'],
  ['acerola', 'Acerola', 0xd63b4a, 0xffc2c8, '#d63b4a'],
  ['amora', 'Amora', 0x6a3d8f, 0xead6ff, '#6a3d8f'],
  ['goiaba', 'Goiaba', 0xf08a7a, 0xffe0d4, '#e07060'],
  ['caju', 'Caju', 0xe07a2f, 0xffe0b0, '#e07a2f'],
  ['mangaba', 'Mangaba', 0xf2d15a, 0xfff6d0, '#d4b03a'],
];

function aiFor(index) {
  return {
    pace: 0.9 + (index % 6) * 0.018,
    look: 11 + (index % 5),
    corner: 0.68 + (index % 4) * 0.06,
    drift: index % 2 === 0,
    line: ((index % 5) - 2) * 0.85,
    wander: 0.5 + (index % 3) * 0.35,
    phase: index * 0.55,
  };
}

const NAMED = ROSTER.filter((racer) => !racer.player);

export const BOTS = [
  ...NAMED,
  ...EXTRA.map((row, index) => ({
    id: row[0],
    name: row[1],
    player: false,
    number: String(index + 5),
    body: row[2],
    accent: row[3],
    pig: 0xffc1d4,
    snout: 0xff95b4,
    ear: 0xf27aa0,
    bandana: row[2],
    hat: index % 4 === 0 ? 'straw' : index % 4 === 1 ? 'bow' : null,
    minimap: row[4],
    ai: aiFor(index + NAMED.length),
  })),
];

export function clampGrid(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return GRID_MIN;
  return Math.max(GRID_MIN, Math.min(GRID_MAX, n));
}

export function cleanName(value) {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return text || 'Docão';
}

export function gridSlots(count) {
  const slots = [];
  for (let row = 0; slots.length < count; row += 1) {
    slots.push({ row, side: -1 });
    if (slots.length < count) slots.push({ row, side: 1 });
  }
  return slots;
}

function humanDef(seat, number) {
  return {
    ...DOCAO,
    id: seat.id,
    name: cleanName(seat.name),
    player: !!seat.local,
    number,
    ai: aiFor(3),
  };
}

/** Offline grid. The player stays on the front row, right side, like the original four. */
export function localSeats(count, human) {
  const n = clampGrid(count);
  const seats = [];
  let bot = 0;
  for (let i = 0; i < n; i += 1) {
    if (i === 1) {
      seats.push({
        id: 'docao',
        name: cleanName(human.name),
        skin: human.skin,
        car: human.car,
        human: true,
        local: true,
      });
    } else {
      seats.push({ id: BOTS[bot].id, human: false, bot });
      bot += 1;
    }
  }
  return seats;
}

/** Online grid. Humans take the front in join order. Bots fill whatever is left. */
export function roomSeats(humans, count) {
  const n = Math.min(GRID_MAX, Math.max(clampGrid(count), humans.length));
  const seats = humans.slice(0, n).map((human) => ({
    id: human.id,
    name: cleanName(human.name),
    skin: human.skin,
    car: human.car,
    human: true,
    local: false,
    host: !!human.host,
  }));
  let bot = 0;
  while (seats.length < n) {
    seats.push({ id: BOTS[bot].id, human: false, bot });
    bot += 1;
  }
  return seats;
}

export function spawnField(seats, track) {
  const slots = gridSlots(seats.length);
  return seats.map((seat, index) => {
    const number = seat.human && seat.id === 'docao' ? '1' : String(index + 1);
    const def = seat.human ? humanDef(seat, number) : { ...BOTS[seat.bot] };
    if (!seat.human && !def.number) def.number = number;
    const racer = spawnRacer(def, track, slots[index]);
    racer.local = !!seat.local;
    racer.human = !!seat.human;
    racer.player = !!seat.local;
    racer.skin = seat.skin || null;
    racer.netInput = { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false, glide: false };
    racer.netUse = false;
    if (seat.human && seat.car) applyCar(racer, seat.car);
    return racer;
  });
}
