import './style.css';
import { buildTrack, getTrack, TRACKS } from './track.js';
import { TOTAL_LAPS, FLAVOR } from './roster.js';
import { SKINS, SKIN_STORAGE, assignSkins, getSkin } from './skins.js';
import { CARS, CAR_STORAGE, applyCar, getCar } from './cars.js';
import { GRID_MIN, GRID_MAX, clampGrid, cleanName, localSeats, roomSeats, spawnField } from './field.js';
import { createOnline, makeCode, normalizeCode, lerpAngle } from './online.js';
import { createSkinStage } from './docao.js';
import {
  TUNING,
  resetRacer,
  aiInput,
  stepRacer,
  separate,
  rankRacers,
  formatTime,
} from './drive.js';
import { createWorld, createKartView, setLights } from './scene.js';
import { createAudio } from './audio.js';
import { ITEMS, createItemField, resetItems, stepItems } from './items.js';
import { createItemView } from './itemView.js';
import { createCapybaras, stepCapybaras, hitCapybaras } from './capybaras.js';
import { createCapybaraView } from './capybaraView.js';

const STEP = 1 / 60;
const EMPTY = { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false, glide: false };

const canvas = document.querySelector('#view');
const hud = document.querySelector('#hud');
const minimap = document.querySelector('#minimap');
const menu = document.querySelector('#menu');
const results = document.querySelector('#results');
const pauseEl = document.querySelector('#pause');
const countdownEl = document.querySelector('#countdown');
const callout = document.querySelector('#callout');
const wrong = document.querySelector('#wrong');
const positionEl = document.querySelector('#position');
const lapEl = document.querySelector('#lap');
const timerEl = document.querySelector('#timer');
const bestEl = document.querySelector('#best');
const speedEl = document.querySelector('#speed');
const orderEl = document.querySelector('#order');
const driftBar = document.querySelector('#drift');
const driftFill = document.querySelector('#drift-fill');
const itemSlot = document.querySelector('#item');
const itemName = document.querySelector('#item-name');
const useBtn = document.querySelector('#use-item');
const flavorEl = document.querySelector('#flavor');
const standingsEl = document.querySelector('#standings');
const soundBtn = document.querySelector('#sound');

const mapCtx = minimap.getContext('2d');
const keys = new Set();
const touch = { gas: false, brake: false, left: false, right: false, drift: false, glide: false };

const TRACK_KEY = 'docao-kart-track';
const GRID_KEY = 'docao-kart-grid';
const NAME_KEY = 'docao-kart-name';

const trackList = document.querySelector('#tracks');
const lobbyEl = document.querySelector('#lobby');
const roomCodeEl = document.querySelector('#room-code');
const roomStatus = document.querySelector('#room-status');
const roomPlayers = document.querySelector('#room-players');
const roomName = document.querySelector('#room-name');
const nameInput = document.querySelector('#racer-name');
const gridValue = document.querySelector('#grid-value');
const roomGridValue = document.querySelector('#room-grid-value');
const againBtn = document.querySelector('#again');

function readStored(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

let trackId = getTrack(readStored(TRACK_KEY)).id;
let gridCount = clampGrid(readStored(GRID_KEY) || GRID_MIN);
let racerName = cleanName(readStored(NAME_KEY) || 'Docão');
let track = buildTrack(trackId);
let racers = [];
let player = null;
let items = null;
let itemView = null;
let herd = [];
let capybaraView = null;
const views = new Map();
const world = createWorld(canvas, track);
let map = mapSpace();
let playerSkin = 'classico';
let playerCar = 'arranque';
let lobbyPlayers = [];
let roomTries = 0;
let wantHost = false;
let closingMenu = false;
let painting = false;
let guestFinished = false;
let roomOverAt = 0;
let inputSend = 0;
let stateSend = 0;
const samples = [];
nameInput.value = racerName;
roomName.value = racerName;
const skinStage = createSkinStage(document.querySelector('#skin-stage'));

function readSkin() {
  try {
    return localStorage.getItem(SKIN_STORAGE);
  } catch {
    return null;
  }
}

function dressField(id) {
  playerSkin = getSkin(id).id;
  try {
    localStorage.setItem(SKIN_STORAGE, playerSkin);
  } catch {
    /* ignore private mode */
  }
  const mapSkins = assignSkins(playerSkin);
  racers.forEach((racer, index) => {
    const skin = racer.local
      ? playerSkin
      : racer.human
        ? racer.skin || playerSkin
        : mapSkins[racer.id] || SKINS[index % SKINS.length].id;
    if (racer.local) racer.skin = playerSkin;
    views.get(racer).setSkin(skin);
  });
  skinStage.show(playerSkin);
  document.querySelectorAll('#skins button').forEach((button) => {
    button.setAttribute('aria-selected', button.dataset.skin === playerSkin ? 'true' : 'false');
  });
}

const audio = createAudio();
let soundOn = true;
try {
  soundOn = localStorage.getItem('docao-kart-som') !== '0';
} catch {
  soundOn = true;
}

const camPos = world.camera.position.clone();
camPos.set(Math.sin(0.4) * 118, 72, Math.cos(0.4) * 104);
const lookPos = { x: 0, y: 0, z: -4 };
const desired = { x: 0, y: 0, z: 0 };
const look = { x: 0, y: 1, z: 0 };

let mode = 'menu';
let raceTime = 0;
let countdownT = 0;
let countdownPhase = 0;
let arrivedT = 0;
let acc = 0;
let menuAng = 0.4;
let snapCamera = true;
let last = performance.now();
let orderKey = '';
let boostLatch = false;
let useEdge = false;
let heldLabel = 'sem item';
const clock = { raceTime: 0, totalLaps: TOTAL_LAPS };

document.body.dataset.mode = 'menu';
syncSoundButton();
layoutRacers();
world.resize();

window.addEventListener('resize', () => world.resize());
window.visualViewport?.addEventListener('resize', () => world.resize());
window.addEventListener('pointerdown', () => {
  if (soundOn) audio.resume();
});
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

const skinList = document.querySelector('#skins');
for (const skin of SKINS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.skin = skin.id;
  button.textContent = skin.name;
  button.setAttribute('role', 'option');
  button.addEventListener('click', () => dressField(skin.id));
  skinList.append(button);
}

const carList = document.querySelector('#cars');

function readCar() {
  try {
    return localStorage.getItem(CAR_STORAGE);
  } catch {
    return null;
  }
}

function chooseCar(id) {
  playerCar = getCar(id).id;
  try {
    localStorage.setItem(CAR_STORAGE, playerCar);
  } catch {
    /* ignore private mode */
  }
  if (player) {
    const car = applyCar(player, playerCar);
    views.get(player)?.setPaint(car.body, car.accent);
  }
  for (const button of document.querySelectorAll('#cars button, #room-cars button')) {
    button.setAttribute('aria-selected', button.dataset.car === playerCar ? 'true' : 'false');
  }
  if (mode === 'lobby' && !painting) sendProfile();
}

function fillChoices(list, kind) {
  list.replaceChildren();
  const source = kind === 'track' ? TRACKS : CARS;
  for (const item of source) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset[kind] = item.id;
    button.setAttribute('role', 'option');
    const name = document.createElement('strong');
    name.textContent = item.name;
    button.append(name);
    if (item.line) {
      const line = document.createElement('small');
      line.textContent = item.line;
      button.append(line);
    }
    button.addEventListener('click', () => {
      if (kind === 'track') chooseTrack(item.id);
      else chooseCar(item.id);
    });
    list.append(button);
  }
}

for (const car of CARS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.car = car.id;
  button.setAttribute('role', 'option');
  const name = document.createElement('strong');
  name.textContent = car.name;
  const line = document.createElement('small');
  line.textContent = car.line;
  button.append(name, line);
  button.addEventListener('click', () => chooseCar(car.id));
  carList.append(button);
}
fillChoices(trackList, 'track');
fillChoices(document.querySelector('#room-tracks'), 'track');
fillChoices(document.querySelector('#room-cars'), 'car');

playerSkin = getSkin(readSkin()).id;
playerCar = getCar(readCar()).id;
mountField(localSeats(gridCount, currentHuman()), track);
paintTracks();
paintGrid();

document.querySelector('#play').addEventListener('click', () => beginRace());
document.querySelector('#host-room').addEventListener('click', () => openHost());
againBtn.addEventListener('click', () => {
  if (net.role === 'guest') return;
  if (net.role === 'host') startRoom();
  else beginRace();
});
document.querySelector('#back').addEventListener('click', () => showMenu());
document.querySelector('#resume').addEventListener('click', () => resume());
document.querySelector('#pause-menu').addEventListener('click', () => showMenu());
document.querySelector('#grid-dec').addEventListener('click', () => setGrid(gridCount - 1));
document.querySelector('#grid-inc').addEventListener('click', () => setGrid(gridCount + 1));
document.querySelector('#room-grid-dec').addEventListener('click', () => {
  if (net.role === 'host') setGrid(gridCount - 1);
});
document.querySelector('#room-grid-inc').addEventListener('click', () => {
  if (net.role === 'host') setGrid(gridCount + 1);
});
document.querySelector('#room-copy').addEventListener('click', () => copyLink());
document.querySelector('#room-start').addEventListener('click', () => startRoom());
document.querySelector('#room-leave').addEventListener('click', () => showMenu());
nameInput.addEventListener('change', () => rememberName(nameInput.value));
roomName.addEventListener('change', () => rememberName(roomName.value));
soundBtn.addEventListener('click', toggleSound);

for (const button of document.querySelectorAll('#touch button')) {
  const name = button.dataset.hold;
  const down = (event) => {
    event.preventDefault();
    if (button.dataset.press === 'item') {
      if (mode === 'race') useEdge = true;
      return;
    }
    touch[name] = true;
  };
  const up = (event) => {
    event.preventDefault();
    button.blur();
    if (name) touch[name] = false;
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
}

requestAnimationFrame(frame);

function onKeyDown(event) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
    event.preventDefault();
  }
  keys.add(event.code);
  if (event.repeat) return;
  if (event.code === 'KeyE' && mode === 'race') useEdge = true;
  if (event.code === 'Escape') onEscape();
  if (event.code === 'Enter' && mode === 'menu') beginRace();
  if (event.code === 'Enter' && mode === 'lobby' && net.role === 'host') startRoom();
}

function onEscape() {
  if (mode === 'lobby') {
    showMenu();
    return;
  }
  if (mode === 'race') {
    if (net.role) return;
    mode = 'pause';
    document.body.dataset.mode = mode;
    pauseEl.hidden = false;
    audio.quiet();
    audio.bed(0.32);
  } else if (mode === 'pause') {
    resume();
  } else if (mode === 'results' || mode === 'arrived') {
    showMenu();
  }
}

function toggleSound() {
  soundOn = !soundOn;
  try {
    localStorage.setItem('docao-kart-som', soundOn ? '1' : '0');
  } catch {
    /* ignore private mode */
  }
  syncSoundButton();
  if (soundOn) audio.resume();
  else audio.quiet();
}

function syncSoundButton() {
  soundBtn.textContent = soundOn ? 'Som ligado' : 'Som mudo';
  soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  audio.setMuted(!soundOn);
}

function currentHuman() {
  return { name: racerName, skin: playerSkin, car: playerCar };
}

function rememberName(value) {
  racerName = cleanName(value);
  nameInput.value = racerName;
  roomName.value = racerName;
  try {
    localStorage.setItem(NAME_KEY, racerName);
  } catch {
    /* ignore private mode */
  }
  if (mode === 'menu') mountField(localSeats(gridCount, currentHuman()), track);
  if (mode === 'lobby') sendProfile();
}

function paintGrid() {
  const label = `${gridCount} pilotos`;
  gridValue.textContent = label;
  roomGridValue.textContent = label;
}

function paintTracks() {
  for (const button of document.querySelectorAll('#tracks button, #room-tracks button')) {
    button.setAttribute('aria-selected', button.dataset.track === trackId ? 'true' : 'false');
  }
}

function setGrid(next) {
  const floor = net.role === 'host' ? Math.max(GRID_MIN, lobbyPlayers.length) : GRID_MIN;
  gridCount = Math.max(floor, Math.min(GRID_MAX, next));
  try {
    localStorage.setItem(GRID_KEY, String(gridCount));
  } catch {
    /* ignore private mode */
  }
  paintGrid();
  if (mode === 'menu') mountField(localSeats(gridCount, currentHuman()), track);
  if (mode === 'lobby' && net.role === 'host') broadcastLobby();
}

function chooseTrack(id) {
  if (mode === 'lobby' && net.role !== 'host') return;
  trackId = getTrack(id).id;
  try {
    localStorage.setItem(TRACK_KEY, trackId);
  } catch {
    /* ignore private mode */
  }
  paintTracks();
  const next = buildTrack(trackId);
  if (mode === 'menu') mountField(localSeats(gridCount, currentHuman()), next);
  if (mode === 'lobby' && net.role === 'host') {
    track = next;
    broadcastLobby();
  }
}

function dropViews() {
  for (const view of views.values()) {
    world.scene.remove(view.group);
    world.scene.remove(view.blob);
  }
  views.clear();
}

function mountField(seats, nextTrack) {
  painting = true;
  if (nextTrack && nextTrack !== track) {
    track = nextTrack;
    world.setCourse(track);
  }
  trackId = track.id;
  audio.setTrack(trackId);
  dropViews();
  itemView?.dispose();
  capybaraView?.dispose();
  racers = spawnField(seats, track);
  player = racers.find((racer) => racer.local) || null;
  items = createItemField(track, racers.length);
  itemView = createItemView(world.scene, items, racers);
  herd = createCapybaras(track);
  capybaraView = createCapybaraView(world.scene, herd);
  for (const racer of racers) {
    const view = createKartView(racer);
    world.scene.add(view.group);
    world.scene.add(view.blob);
    views.set(racer, view);
  }
  map = mapSpace();
  dressField(playerSkin);
  if (player) chooseCar(playerCar);
  painting = false;
}

function setSalaParam(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set('sala', code);
  else url.searchParams.delete('sala');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function showLobby(status) {
  mode = 'lobby';
  document.body.dataset.mode = mode;
  menu.hidden = true;
  lobbyEl.hidden = false;
  results.hidden = true;
  pauseEl.hidden = true;
  hud.hidden = true;
  minimap.hidden = true;
  countdownEl.hidden = true;
  wrong.hidden = true;
  roomStatus.textContent = status;
  paintLobby();
}

function paintLobby() {
  const host = net.role === 'host';
  roomCodeEl.textContent = (net.code || '----').toUpperCase();
  document.querySelector('#room-setup').hidden = !host;
  document.querySelector('#room-start').hidden = !host;
  roomPlayers.replaceChildren();
  for (const person of lobbyPlayers) {
    const li = document.createElement('li');
    const who = document.createElement('strong');
    who.textContent = person.name;
    const tag = document.createElement('span');
    tag.textContent = person.id === net.selfId ? 'você' : person.host ? 'anfitrião' : 'piloto';
    li.append(who, tag);
    roomPlayers.append(li);
  }
  const empty = gridCount - lobbyPlayers.length;
  if (empty > 0) {
    const li = document.createElement('li');
    const who = document.createElement('strong');
    who.textContent = empty === 1 ? '1 bot' : `${empty} bots`;
    const tag = document.createElement('span');
    tag.textContent = 'entram na largada';
    li.append(who, tag);
    roomPlayers.append(li);
  }
}

function previewRoom() {
  const seats = roomSeats(lobbyPlayers, gridCount).map((seat) => ({
    ...seat,
    local: seat.id === net.selfId,
  }));
  mountField(seats, buildTrack(trackId));
  paintTracks();
  paintGrid();
}

function broadcastLobby() {
  const msg = { t: 'lobby', code: net.code, track: trackId, grid: gridCount, players: lobbyPlayers };
  net.broadcast(msg);
  paintLobby();
  if (mode === 'lobby') previewRoom();
}

function sendProfile() {
  if (net.role === 'host') {
    const me = lobbyPlayers.find((person) => person.id === net.selfId);
    if (me) {
      me.name = racerName;
      me.skin = playerSkin;
      me.car = playerCar;
    }
    broadcastLobby();
  } else if (net.role === 'guest') {
    net.send({ t: 'profile', name: racerName, skin: playerSkin, car: playerCar });
  }
}

function selfPlayer() {
  return { id: net.selfId, name: racerName, skin: playerSkin, car: playerCar, host: net.role === 'host' };
}

function openHost() {
  wantHost = true;
  roomTries = 0;
  lobbyPlayers = [];
  showLobby('Conectando…');
  net.host(makeCode());
}

function openGuest(code) {
  wantHost = false;
  lobbyPlayers = [];
  showLobby('Entrando na sala…');
  roomCodeEl.textContent = code.toUpperCase();
  net.join(code);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(location.href);
    roomStatus.textContent = 'Link copiado. Quem abrir entra na sala.';
  } catch {
    roomStatus.textContent = location.href;
  }
}

function startRoom() {
  if (net.role !== 'host') return;
  const seats = roomSeats(lobbyPlayers, gridCount);
  net.broadcast({
    t: 'start',
    track: trackId,
    seats: seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      skin: seat.skin,
      car: seat.car,
      human: seat.human,
      bot: seat.bot,
      host: seat.host,
    })),
  });
  beginOnline(seats);
}

function beginOnline(seats) {
  const marked = seats.map((seat) => ({ ...seat, local: seat.id === net.selfId }));
  samples.length = 0;
  guestFinished = false;
  roomOverAt = 0;
  inputSend = 0;
  stateSend = 0;
  mountField(marked, buildTrack(trackId));
  beginRace();
}

function onNet(from, msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.t === 'join' && net.role === 'host') {
    const racing = mode === 'countdown' || mode === 'race' || mode === 'arrived' || mode === 'results';
    if (racing || lobbyPlayers.length >= gridCount || lobbyPlayers.some((person) => person.id === from)) {
      net.sendTo(from, { t: 'full' });
      return;
    }
    lobbyPlayers.push({
      id: from,
      name: cleanName(msg.name),
      skin: msg.skin,
      car: msg.car,
      host: false,
    });
    broadcastLobby();
    return;
  }
  if (msg.t === 'profile' && net.role === 'host') {
    const person = lobbyPlayers.find((item) => item.id === from);
    if (!person) return;
    person.name = cleanName(msg.name);
    person.skin = msg.skin;
    person.car = msg.car;
    broadcastLobby();
    return;
  }
  if (msg.t === 'leave') {
    dropPeer(from);
    return;
  }
  if (msg.t === 'lobby' && net.role === 'guest') {
    trackId = getTrack(msg.track).id;
    gridCount = clampGrid(msg.grid);
    lobbyPlayers = Array.isArray(msg.players) ? msg.players : [];
    roomStatus.textContent = 'Esperando o anfitrião largar. Os lugares vazios entram com bots.';
    paintLobby();
    if (mode === 'lobby') previewRoom();
    return;
  }
  if (msg.t === 'start') {
    trackId = getTrack(msg.track).id;
    beginOnline(msg.seats || []);
    return;
  }
  if (msg.t === 'input' && net.role === 'host') {
    const racer = racers.find((item) => item.id === from);
    if (!racer) return;
    racer.netInput = {
      throttle: msg.throttle ? 1 : 0,
      brake: msg.brake ? 1 : 0,
      reverse: !!msg.brake,
      steer: Math.max(-1, Math.min(1, Number(msg.steer) || 0)),
      drift: !!msg.drift,
      glide: !!msg.glide,
    };
    if (msg.use) racer.netUse = true;
    return;
  }
  if (msg.t === 'state' && net.role === 'guest') {
    samples.push({ at: performance.now(), msg });
    if (samples.length > 40) samples.shift();
    return;
  }
  if (msg.t === 'full' || msg.t === 'closed') {
    const full = msg.t === 'full';
    showMenu();
    if (full) showCallout('Sala cheia');
    else showCallout('A sala fechou');
  }
}

function dropPeer(id) {
  lobbyPlayers = lobbyPlayers.filter((person) => person.id !== id);
  const racing = mode === 'countdown' || mode === 'race' || mode === 'arrived';
  const racer = racers.find((item) => item.id === id);
  if (racing && racer) {
    racer.human = false;
    racer.local = false;
    racer.player = false;
    return;
  }
  if (mode === 'lobby' && net.role === 'host') broadcastLobby();
}

const net = createOnline({
  onOpen() {
    if (net.role !== 'host') return;
    lobbyPlayers = [selfPlayer()];
    setSalaParam(net.code);
    roomStatus.textContent = 'Esperando pilotos. Os lugares vazios entram com bots.';
    broadcastLobby();
  },
  onReady() {
    if (net.role !== 'guest') return;
    setSalaParam(net.code);
    net.send({ t: 'join', name: racerName, skin: playerSkin, car: playerCar });
    roomStatus.textContent = 'Conectado. Esperando a sala…';
  },
  onData(from, msg) {
    onNet(from, msg);
  },
  onLeave(id) {
    dropPeer(id);
  },
  onClosed() {
    if (closingMenu || mode === 'menu') return;
    showMenu();
    showCallout('A sala fechou');
  },
  onError(error) {
    if (wantHost && error?.type === 'unavailable-id' && roomTries < 4) {
      roomTries += 1;
      net.host(makeCode());
      return;
    }
    roomStatus.textContent = wantHost
      ? 'Não consegui abrir a sala. Tenta de novo.'
      : 'Não achei essa sala. Confere o link.';
  },
});

const pendingSala = normalizeCode(new URLSearchParams(location.search).get('sala'));
if (pendingSala) openGuest(pendingSala);

function roundNet(value) {
  return Math.round(value * 100) / 100;
}

function packState() {
  return {
    t: 'state',
    time: raceTime,
    mode,
    phase: countdownPhase,
    over: mode === 'results',
    racers: racers.map((racer) => [
      racer.id,
      roundNet(racer.x),
      roundNet(racer.z),
      roundNet(racer.yaw),
      roundNet(racer.speed),
      roundNet(racer.steer),
      roundNet(racer.slide),
      roundNet(racer.s),
      racer.lap,
      roundNet(racer.travel),
      racer.finished ? 1 : 0,
      racer.finished ? roundNet(racer.finishTime || 0) : 0,
      roundNet(racer.driftTime),
      racer.drifting ? 1 : 0,
      roundNet(racer.boost),
      racer.boostFrom || '',
      racer.item || '',
      racer.rolling ? 1 : 0,
      roundNet(racer.stun),
      racer.stunKind || '',
      roundNet(racer.reverseTime),
      racer.bestLap == null ? -1 : roundNet(racer.bestLap),
      racer.driftKind === 'soft' ? 2 : racer.driftKind === 'sharp' ? 1 : 0,
    ]),
    boxes: items.boxes.map((box) => [box.alive ? 1 : 0, roundNet(box.cooldown), roundNet(box.pop)]),
    peels: items.peels.map((peel) => (peel.active ? [roundNet(peel.x), roundNet(peel.z), roundNet(peel.yaw)] : 0)),
    shots: items.shots.map((shot) => (shot.active ? [roundNet(shot.x), roundNet(shot.z), roundNet(shot.yaw)] : 0)),
    capybaras: herd.map((animal) => [roundNet(animal.x), roundNet(animal.z), roundNet(animal.yaw)]),
  };
}

function rowById(list, id) {
  for (const row of list) if (row[0] === id) return row;
  return null;
}

function syncGuest() {
  if (!samples.length || !player) return;
  const when = performance.now() - 90;
  let older = samples[0];
  let newer = samples[samples.length - 1];
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (samples[i].at <= when) {
      older = samples[i];
      newer = samples[Math.min(samples.length - 1, i + 1)];
      break;
    }
  }
  const span = Math.max(1, newer.at - older.at);
  const t = older === newer ? 1 : Math.min(1, Math.max(0, (when - older.at) / span));
  const latest = newer.msg;
  raceTime = (older.msg.time || 0) + ((latest.time || 0) - (older.msg.time || 0)) * t;
  clock.raceTime = raceTime;
  for (const row of latest.racers || []) {
    const racer = racers.find((item) => item.id === row[0]);
    if (!racer) continue;
    const prev = rowById(older.msg.racers || [], row[0]) || row;
    racer.x = prev[1] + (row[1] - prev[1]) * t;
    racer.z = prev[2] + (row[2] - prev[2]) * t;
    racer.yaw = lerpAngle(prev[3], row[3], t);
    racer.speed = prev[4] + (row[4] - prev[4]) * t;
    racer.steer = row[5];
    racer.slide = row[6];
    racer.s = row[7];
    racer.lap = row[8];
    racer.travel = row[9];
    racer.finished = !!row[10];
    racer.finishTime = row[10] ? row[11] : null;
    racer.driftTime = row[12];
    racer.drifting = !!row[13];
    racer.driftKind = row[22] === 2 ? 'soft' : row[22] === 1 ? 'sharp' : null;
    racer.boost = row[14];
    racer.boostFrom = row[15] || null;
    racer.item = row[16] || null;
    racer.rolling = !!row[17];
    racer.stun = row[18];
    racer.stunKind = row[19] || null;
    racer.reverseTime = row[20];
    racer.bestLap = row[21] < 0 ? null : row[21];
  }
  (latest.boxes || []).forEach((box, index) => {
    const target = items.boxes[index];
    if (!target) return;
    target.alive = !!box[0];
    target.cooldown = box[1];
    target.pop = box[2];
  });
  (latest.peels || []).forEach((peel, index) => {
    const target = items.peels[index];
    if (!target) return;
    if (!peel) {
      target.active = false;
      return;
    }
    target.active = true;
    target.x = peel[0];
    target.z = peel[1];
    target.yaw = peel[2];
  });
  (latest.shots || []).forEach((shot, index) => {
    const target = items.shots[index];
    if (!target) return;
    if (!shot) {
      target.active = false;
      return;
    }
    target.active = true;
    target.x = shot[0];
    target.z = shot[1];
    target.yaw = shot[2];
  });
  (latest.capybaras || []).forEach((row, index) => {
    const animal = herd[index];
    if (!animal || !row) return;
    const prev = (older.msg.capybaras || [])[index] || row;
    animal.x = prev[0] + (row[0] - prev[0]) * t;
    animal.z = prev[1] + (row[1] - prev[1]) * t;
    animal.yaw = lerpAngle(prev[2], row[2], t);
  });
  if (mode === 'countdown') {
    const phase = latest.phase || 0;
    const label = phase >= 4 ? 'VAI!' : phase === 3 ? '1' : phase === 2 ? '2' : '3';
    if (phase && phase !== countdownPhase) {
      countdownPhase = phase;
      countdownEl.textContent = label;
      setLights(world.bulbs, phase);
      if (phase === 4) audio.go();
      else audio.beep(phase);
    }
    if (phase >= 4) startDriving();
  }
  if (latest.over && mode !== 'results' && mode !== 'menu') endRace();
  if (player.finished && !guestFinished && (mode === 'race' || mode === 'countdown')) {
    guestFinished = true;
    showCallout('Chegou!');
    audio.fanfare();
    arrivedT = 0;
    mode = 'arrived';
    document.body.dataset.mode = mode;
  }
  if (!results.hidden && mode !== 'menu') paintResults();
}

function beginRace() {
  audio.resume();
  for (const racer of racers) {
    resetRacer(racer);
    racer.capyGrace = 0;
  }
  raceTime = 0;
  clock.raceTime = 0;
  countdownT = 0;
  countdownPhase = 0;
  arrivedT = 0;
  acc = 0;
  orderKey = '';
  boostLatch = false;
  useEdge = false;
  heldLabel = 'sem item';
  itemName.textContent = 'sem item';
  itemSlot.dataset.kind = 'none';
  itemSlot.dataset.rolling = 'false';
  itemSlot.classList.remove('got', 'tick');
  useBtn.classList.remove('ready', 'rolling', 'tick');
  useBtn.textContent = 'Item';
  snapCamera = true;
  resetItems(items);
  setLights(world.bulbs, 0);
  results.hidden = true;
  pauseEl.hidden = true;
  menu.hidden = true;
  lobbyEl.hidden = true;
  hud.hidden = false;
  minimap.hidden = false;
  countdownEl.hidden = false;
  countdownEl.textContent = '3';
  wrong.hidden = true;
  mode = 'countdown';
  document.body.dataset.mode = mode;
  audio.bed(1);
  layoutRacers();
}

function startDriving() {
  raceTime = 0;
  clock.raceTime = 0;
  for (const racer of racers) racer.lapStart = 0;
  countdownEl.hidden = true;
  mode = 'race';
  document.body.dataset.mode = mode;
}

function showMenu() {
  if (closingMenu) return;
  closingMenu = true;
  if (net.role) net.leave();
  wantHost = false;
  lobbyPlayers = [];
  samples.length = 0;
  setSalaParam(null);
  mountField(localSeats(gridCount, currentHuman()), buildTrack(trackId));
  mode = 'menu';
  document.body.dataset.mode = mode;
  menu.hidden = false;
  lobbyEl.hidden = true;
  hud.hidden = true;
  minimap.hidden = true;
  results.hidden = true;
  pauseEl.hidden = true;
  countdownEl.hidden = true;
  wrong.hidden = true;
  againBtn.disabled = false;
  againBtn.textContent = 'Jogar de novo';
  setLights(world.bulbs, 0);
  resetItems(items);
  audio.quiet();
  audio.bed(1);
  Object.keys(touch).forEach((key) => {
    touch[key] = false;
  });
  layoutRacers();
  closingMenu = false;
}

function paintResults() {
  const order = rankRacers(racers);
  const place = order.findIndex((racer) => racer.player) + 1;
  flavorEl.textContent = FLAVOR[place] || `${place}º de ${order.length}. A pista ainda está quente.`;
  standingsEl.replaceChildren();
  order.forEach((racer, index) => {
    const li = document.createElement('li');
    if (racer.player) li.classList.add('you');
    const who = document.createElement('span');
    who.textContent = `${index + 1}º  ${racer.name}`;
    const time = document.createElement('span');
    time.textContent = racer.finished ? formatTime(racer.finishTime) : 'em prova';
    li.append(who, time);
    standingsEl.append(li);
  });
  results.hidden = false;
  againBtn.disabled = net.role === 'guest';
  againBtn.textContent = net.role === 'guest' ? 'O anfitrião recomeça' : 'Jogar de novo';
}

function resume() {
  mode = 'race';
  document.body.dataset.mode = mode;
  pauseEl.hidden = true;
  audio.bed(1);
  if (soundOn) audio.resume();
}

function endRace() {
  paintResults();
  mode = 'results';
  document.body.dataset.mode = mode;
  audio.quiet();
  audio.bed(0.4);
  if (net.role === 'host') net.broadcast(packState());
}

function showResults() {
  endRace();
}

function showCallout(text) {
  callout.textContent = text;
  callout.classList.remove('show');
  void callout.offsetWidth;
  callout.classList.add('show');
}

function readInput() {
  const throttle = keys.has('KeyW') || keys.has('ArrowUp') || touch.gas ? 1 : 0;
  const brake = keys.has('KeyS') || keys.has('ArrowDown') || touch.brake ? 1 : 0;
  const steer =
    (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left ? 1 : 0) -
    (keys.has('KeyD') || keys.has('ArrowRight') || touch.right ? 1 : 0);
  return {
    throttle,
    brake,
    reverse: brake > 0,
    steer,
    drift: keys.has('Space') || touch.drift,
    glide: keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.glide,
  };
}

function burst(racer, color, power) {
  world.effects.spark(racer.x, 0.7, racer.z, color, power);
  world.effects.spark(racer.x, 1.05, racer.z, color, power * 0.75);
}

function simulate(dt, tryUse) {
  raceTime += dt;
  clock.raceTime = raceTime;
  for (const racer of racers) {
    if (!racer.player && !racer.finished) {
      const gap = player.travel - racer.travel;
      racer.paceMul = Math.max(0.9, Math.min(1.07, 1 + gap * 0.05));
    }
    let input = EMPTY;
    if (!racer.finished && (mode === 'race' || mode === 'arrived')) {
      if (racer.local && mode === 'race') input = readInput();
      else if (racer.human) input = racer.netInput || EMPTY;
      else input = aiInput(racer, track, raceTime);
    }
    stepRacer(racer, input, dt, track, {
      get raceTime() {
        return clock.raceTime;
      },
      totalLaps: TOTAL_LAPS,
      onLap(who) {
        if (!who.player) return;
        showCallout(`Volta ${who.lap}!`);
        audio.blip();
      },
      onFinish(who) {
        if (!who.player) return;
        showCallout('Chegou!');
        audio.fanfare();
        const others = net.role === 'host' && racers.some((racer) => racer.human && racer !== who && !racer.finished);
        if (others) {
          if (!roomOverAt) roomOverAt = raceTime + 40;
          return;
        }
        mode = 'arrived';
        document.body.dataset.mode = mode;
        arrivedT = 0;
      },
      onWall(who) {
        if (who.player) audio.thud();
      },
    });
  }
  separate(racers, track);
  stepItems(items, racers, dt, track, {
    time: raceTime,
    playerUse: !!tryUse,
    onPickup(racer) {
      burst(racer, 0xff4f8b, 0.7);
      if (racer.player) audio.pickup();
    },
    onSpin(racer) {
      if (racer.player) audio.tick();
    },
    onLand(racer, id) {
      burst(racer, ITEMS[id].tint, 1);
      if (!racer.player) return;
      audio.blip();
      itemSlot.classList.remove('got');
      void itemSlot.offsetWidth;
      itemSlot.classList.add('got');
    },
    onUse(racer, id) {
      burst(racer, ITEMS[id].tint, 1);
      if (!racer.player) return;
      if (id === 'pamonha') {
        boostLatch = true;
        showCallout('Pamonha!');
        audio.boost();
      } else if (id === 'casca') {
        showCallout('Casca!');
        audio.toss();
      } else {
        showCallout('Tomate!');
        audio.toss();
      }
    },
    onSlip(racer) {
      burst(racer, ITEMS.casca.tint, 1.1);
      if (!racer.player) return;
      showCallout('Escorregou!');
      audio.slip();
    },
    onKnock(racer) {
      burst(racer, ITEMS.tomate.tint, 1.15);
      if (!racer.player) return;
      showCallout('Toma!');
      audio.thud();
    },
  });
  stepCapybaras(herd, dt, track, raceTime);
  hitCapybaras(herd, racers, dt, (who) => {
    burst(who, 0x8a5a32, 0.85);
    if (!who.player) return;
    showCallout('Capivara!');
    audio.thud();
  });
}

function updateCountdown(dt) {
  countdownT += dt;
  let phase = 1;
  let text = '3';
  if (countdownT >= 2.25) {
    phase = 4;
    text = 'VAI!';
  } else if (countdownT >= 1.5) {
    phase = 3;
    text = '1';
  } else if (countdownT >= 0.75) {
    phase = 2;
    text = '2';
  }
  if (phase !== countdownPhase) {
    countdownPhase = phase;
    countdownEl.textContent = text;
    setLights(world.bulbs, phase);
    if (phase === 4) audio.go();
    else audio.beep(phase);
  }
  if (countdownT >= 3.05) startDriving();
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (net.role === 'guest') {
    if (mode === 'race') {
      inputSend += dt;
      if (inputSend >= 1 / 30) {
        inputSend = 0;
        const input = readInput();
        net.send({
          t: 'input',
          throttle: input.throttle,
          brake: input.brake,
          steer: input.steer,
          drift: input.drift,
          glide: input.glide,
          use: useEdge,
        });
        useEdge = false;
      }
    }
    syncGuest();
  } else if (mode === 'countdown') updateCountdown(dt);

  if (net.role !== 'guest' && (mode === 'race' || mode === 'arrived')) {
    acc += dt;
    let tryUse = false;
    if (mode === 'race' && useEdge) {
      tryUse = true;
      useEdge = false;
    }
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      simulate(STEP, tryUse);
      tryUse = false;
      acc -= STEP;
      guard += 1;
    }
  } else if (net.role !== 'guest') {
    acc = 0;
    useEdge = false;
    stepCapybaras(herd, dt, track, now / 1000);
  }

  if (net.role === 'host' && (mode === 'countdown' || mode === 'race' || mode === 'arrived')) {
    stateSend += dt;
    if (stateSend >= 0.05) {
      stateSend = 0;
      net.broadcast(packState());
    }
    if (mode === 'race' && player?.finished) {
      arrivedT += dt;
      if (arrivedT > 1.15 && results.hidden) paintResults();
      const pending = racers.some((racer) => racer.human && !racer.finished);
      if (!pending || (roomOverAt && raceTime > roomOverAt)) endRace();
    }
  }

  if (mode === 'arrived') {
    arrivedT += dt;
    if (arrivedT > 1.15) showResults();
  }

  const time = now / 1000;
  layoutRacers(time, dt);
  itemView.update(items, racers, time);
  capybaraView?.update(herd, time);
  updateCamera(dt, time);
  updateHud();
  drawMinimap();
  world.effects.update(dt);
  world.updateClouds(dt);
  if (mode === 'race' || mode === 'arrived') {
    audio.engine(player.speed, player.drifting, player.boost > 0);
    if (player.boost > 0.7 && !boostLatch && player.boostFrom !== 'pamonha') {
      boostLatch = true;
      showCallout('Impulso!');
      audio.boost();
    }
    for (const shot of items.shots) {
      if (!shot.active) continue;
      shot.trail += dt;
      if (shot.trail < 0.05) continue;
      shot.trail = 0;
      world.effects.spark(shot.x, 0.55, shot.z, ITEMS.tomate.tint, 0.4);
    }
    if (player.boost <= 0) boostLatch = false;
  }
  world.renderer.render(world.scene, world.camera);
  if (mode === 'menu') skinStage.render();
  requestAnimationFrame(frame);
}

function layoutRacers(time = 0, dt = 0) {
  for (const racer of racers) {
    const view = views.get(racer);
    const bob = mode === 'menu' ? Math.sin(time * 2 + view.phase) * 0.04 : 0;
    if (racer.boost > 0.65 && !view.boosting) view.hop = 1;
    view.boosting = racer.boost > 0;
    view.hop = Math.max(0, view.hop - dt * 1.5);
    let hop = Math.sin(view.hop * Math.PI) * 0.32 + bob;
    if (racer.driftHop > 0) {
      const span = racer.hopSpan || TUNING.driftHop;
      const t = 1 - racer.driftHop / span;
      const lift = span < TUNING.driftHop * 0.75 ? 0.1 : 0.2;
      hop += Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * lift;
    }
    view.group.position.set(racer.x, hop, racer.z);
    view.blob.position.set(racer.x, 0.045, racer.z);
    view.group.rotation.y = racer.yaw;
    view.group.rotation.z = -racer.steer * 0.12 - racer.slide * 0.01;
    view.spin += racer.speed * dt * 0.85;
    const steerY = racer.steer * 0.45;
    for (const wheel of view.wheels) {
      wheel.spin.rotation.x = view.spin;
      wheel.hub.rotation.x = view.spin;
      wheel.pivot.rotation.y = wheel.front ? steerY : 0;
    }
    view.pig.position.y = view.pigBase + Math.sin(time * 8 + view.phase) * (0.012 + Math.min(0.04, Math.abs(racer.speed) * 0.0012));
    if (view.flag) view.flag.rotation.y = Math.sin(time * 7) * 0.35;

    if (racer.drifting && racer.speed > 5.5) {
      view.skidAcc += Math.abs(racer.speed) * dt;
      if (view.skidAcc > 0.7) {
        view.skidAcc = 0;
        const fx = Math.sin(racer.yaw);
        const fz = Math.cos(racer.yaw);
        const rx = Math.cos(racer.yaw);
        const rz = -Math.sin(racer.yaw);
        const bx = racer.x - fx * 0.9;
        const bz = racer.z - fz * 0.9;
        world.effects.skid(bx + rx * 0.55, bz + rz * 0.55, racer.yaw);
        world.effects.skid(bx - rx * 0.55, bz - rz * 0.55, racer.yaw);
        world.effects.spark(bx, 0.4, bz, 0xff8fb8, 0.6);
      }
    }
    if (racer.player && racer.wallBump > 0.22) {
      world.effects.spark(racer.x, 0.6, racer.z, 0xffe27a, 1);
    }
    if (racer.boostFrom === 'pamonha') {
      view.sparkAcc += dt;
      if (view.sparkAcc > 0.07) {
        view.sparkAcc = 0;
        const fx = Math.sin(racer.yaw);
        const fz = Math.cos(racer.yaw);
        world.effects.spark(racer.x - fx * 1.05, 0.35, racer.z - fz * 1.05, ITEMS.pamonha.tint, 0.55);
      }
    } else if (racer.stunKind === 'casca') {
      view.sparkAcc += dt;
      if (view.sparkAcc > 0.06) {
        view.sparkAcc = 0;
        world.effects.spark(racer.x, 0.5, racer.z, ITEMS.casca.tint, 0.75);
      }
    }
  }
}

function updateCamera(dt, time) {
  const camera = world.camera;
  if (mode === 'menu' || mode === 'results' || mode === 'lobby') {
    const span = Math.max(track.bounds.maxX - track.bounds.minX, track.bounds.maxZ - track.bounds.minZ, 120);
    const orbit = Math.max(108, span * 0.72);
    const lift = Math.max(72, span * 0.42);
    menuAng += dt * 0.16;
    desired.x = Math.sin(menuAng) * orbit;
    desired.y = lift;
    desired.z = Math.cos(menuAng) * orbit;
    look.x = 0;
    look.y = 0;
    look.z = -4;
    const glide = 1 - Math.exp(-1.6 * dt);
    camPos.x += (desired.x - camPos.x) * glide;
    camPos.y += (desired.y - camPos.y) * glide;
    camPos.z += (desired.z - camPos.z) * glide;
    lookPos.x += (look.x - lookPos.x) * glide;
    lookPos.y += (look.y - lookPos.y) * glide;
    lookPos.z += (look.z - lookPos.z) * glide;
  } else {
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    const rx = Math.cos(player.yaw);
    const rz = -Math.sin(player.yaw);
    const back = 9.2;
    desired.x = player.x - fx * back + rx * player.steer * 0.8;
    desired.y = 4.15 + (player.boost > 0 ? 0.25 : 0);
    desired.z = player.z - fz * back + rz * player.steer * 0.8;
    look.x = player.x + fx * 5.2;
    look.y = 1.2;
    look.z = player.z + fz * 5.2;
    if (snapCamera) {
      camPos.x = desired.x;
      camPos.y = desired.y;
      camPos.z = desired.z;
      lookPos.x = look.x;
      lookPos.y = look.y;
      lookPos.z = look.z;
      snapCamera = false;
    } else {
      const k = 1 - Math.exp(-5.2 * dt);
      const lk = 1 - Math.exp(-8 * dt);
      camPos.x += (desired.x - camPos.x) * k;
      camPos.y += (desired.y - camPos.y) * k;
      camPos.z += (desired.z - camPos.z) * k;
      lookPos.x += (look.x - lookPos.x) * lk;
      lookPos.y += (look.y - lookPos.y) * lk;
      lookPos.z += (look.z - lookPos.z) * lk;
    }
    if (player.wallBump > 0) {
      camPos.x += Math.sin(time * 46) * 0.14 * Math.min(1, player.wallBump * 3);
      camPos.y += Math.cos(time * 38) * 0.08 * Math.min(1, player.wallBump * 3);
    }
    if (player.stun > 0) {
      const mag = player.stunKind === 'casca' ? 0.22 : 0.1;
      camPos.x += Math.sin(time * 42) * mag;
      camPos.y += Math.cos(time * 36) * mag * 0.4;
    }
    const targetFov = 62 + Math.min(7, Math.abs(player.speed) * 0.28) + (player.boost > 0 ? 3.5 : 0);
    camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
  }
  camera.position.set(camPos.x, camPos.y, camPos.z);
  camera.lookAt(lookPos.x, lookPos.y, lookPos.z);
}

function updateHud() {
  if (hud.hidden) return;
  const order = rankRacers(racers);
  const place = order.findIndex((racer) => racer.player) + 1;
  positionEl.textContent = `${place}º`;
  positionEl.dataset.place = String(place);
  lapEl.textContent = `Volta ${Math.min(player.lap, TOTAL_LAPS)}/${TOTAL_LAPS}`;
  timerEl.textContent = formatTime(mode === 'countdown' ? 0 : raceTime);
  bestEl.textContent = player.bestLap == null ? 'melhor —' : `melhor ${formatTime(player.bestLap)}`;
  const kmh = Math.round(Math.abs(player.speed) * 8);
  speedEl.textContent = `${kmh} km/h`;
  wrong.hidden = !(mode === 'race' && player.reverseTime > 0.28);

  const key = order.map((racer) => racer.id).join('-');
  if (key !== orderKey) {
    orderKey = key;
    orderEl.replaceChildren();
    order.forEach((racer, index) => {
      const li = document.createElement('li');
      if (racer.player) li.classList.add('you');
      const dot = document.createElement('i');
      dot.style.background = racer.minimap;
      li.append(dot, document.createTextNode(`${index + 1}  ${racer.name}`));
      orderEl.append(li);
    });
  }

  const face = player.item;
  const label = face ? ITEMS[face].name : 'sem item';
  if (label !== heldLabel) {
    heldLabel = label;
    itemName.textContent = label;
    useBtn.textContent = face ? label : 'Item';
    if (player.rolling) {
      itemSlot.classList.remove('tick');
      useBtn.classList.remove('tick');
      void itemSlot.offsetWidth;
      itemSlot.classList.add('tick');
      useBtn.classList.add('tick');
    }
  }
  itemSlot.dataset.kind = face || 'none';
  itemSlot.dataset.rolling = player.rolling ? 'true' : 'false';
  useBtn.classList.toggle('rolling', !!player.rolling);
  useBtn.classList.toggle('ready', !!face && !player.rolling);
  useBtn.setAttribute('aria-busy', player.rolling ? 'true' : 'false');

  const showDrift = mode === 'race' && (player.drifting || player.driftTime > 0);
  driftBar.hidden = !showDrift;
  if (showDrift) {
    const soft = player.driftKind === 'soft';
    const need = soft ? TUNING.softMin : TUNING.driftMin;
    const amount = Math.min(1, player.driftTime / need);
    driftFill.style.width = `${amount * 100}%`;
    driftBar.classList.toggle('soft', soft);
    driftFill.classList.toggle('ready', player.driftTime >= need);
  }
}

function mapSpace() {
  const b = track.bounds;
  const w = minimap.width;
  const h = minimap.height;
  const pad = 22;
  const scale = Math.min((w - pad * 2) / (b.maxX - b.minX), (h - pad * 2) / (b.maxZ - b.minZ));
  const ox = w / 2 - ((b.minX + b.maxX) / 2) * scale;
  const oy = h / 2 + ((b.minZ + b.maxZ) / 2) * scale;
  return {
    X: (x) => ox + x * scale,
    Y: (z) => oy - z * scale,
  };
}

function drawMinimap() {
  if (minimap.hidden) return;
  const w = minimap.width;
  const h = minimap.height;
  mapCtx.clearRect(0, 0, w, h);
  mapCtx.fillStyle = 'rgba(255, 246, 228, 0.92)';
  mapCtx.beginPath();
  mapCtx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
  mapCtx.fill();
  mapCtx.save();
  mapCtx.beginPath();
  mapCtx.arc(w / 2, h / 2, w / 2 - 8, 0, Math.PI * 2);
  mapCtx.clip();
  if (track.lake) {
    const rx = Math.abs(map.X(track.lake.x + track.lake.rx) - map.X(track.lake.x));
    const ry = Math.abs(map.Y(track.lake.z + track.lake.rz) - map.Y(track.lake.z));
    mapCtx.fillStyle = 'rgba(60, 157, 140, 0.9)';
    mapCtx.beginPath();
    mapCtx.ellipse(map.X(track.lake.x), map.Y(track.lake.z), rx, ry, 0, 0, Math.PI * 2);
    mapCtx.fill();
  }
  mapCtx.beginPath();
  track.points.forEach((point, index) => {
    const x = map.X(point.x);
    const y = map.Y(point.z);
    if (index === 0) mapCtx.moveTo(x, y);
    else mapCtx.lineTo(x, y);
  });
  mapCtx.closePath();
  mapCtx.strokeStyle = track.theme === 'parque' ? '#7d927c' : '#e7c89a';
  mapCtx.lineWidth = 12;
  mapCtx.lineJoin = 'round';
  mapCtx.stroke();
  mapCtx.strokeStyle = '#a97845';
  mapCtx.lineWidth = 2;
  mapCtx.stroke();
  const finish = track.points[0];
  mapCtx.strokeStyle = '#ff4f8b';
  mapCtx.lineWidth = 3;
  mapCtx.beginPath();
  mapCtx.moveTo(map.X(finish.x - finish.nx * 5), map.Y(finish.z - finish.nz * 5));
  mapCtx.lineTo(map.X(finish.x + finish.nx * 5), map.Y(finish.z + finish.nz * 5));
  mapCtx.stroke();
  for (const box of items.boxes) {
    if (!box.alive) continue;
    const x = map.X(box.x);
    const y = map.Y(box.z);
    mapCtx.beginPath();
    mapCtx.fillStyle = '#e0232b';
    mapCtx.arc(x, y, 3.3, 0, Math.PI * 2);
    mapCtx.fill();
    mapCtx.lineWidth = 1;
    mapCtx.strokeStyle = '#f5e6d0';
    mapCtx.stroke();
  }
  for (const animal of herd) {
    mapCtx.beginPath();
    mapCtx.fillStyle = '#6b4428';
    mapCtx.arc(map.X(animal.x), map.Y(animal.z), 3.6, 0, Math.PI * 2);
    mapCtx.fill();
  }
  for (const racer of racers) {
    mapCtx.beginPath();
    mapCtx.fillStyle = racer.minimap;
    mapCtx.arc(map.X(racer.x), map.Y(racer.z), racer.player ? 5 : 3.4, 0, Math.PI * 2);
    mapCtx.fill();
    if (racer.player) {
      mapCtx.lineWidth = 2;
      mapCtx.strokeStyle = '#fffaf2';
      mapCtx.stroke();
    }
  }
  mapCtx.restore();
  mapCtx.beginPath();
  mapCtx.arc(w / 2, h / 2, w / 2 - 3, 0, Math.PI * 2);
  mapCtx.strokeStyle = '#ff4f8b';
  mapCtx.lineWidth = 4;
  mapCtx.stroke();
}
