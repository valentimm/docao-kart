import './style.css';
import { buildTrack } from './track.js';
import { ROSTER, TOTAL_LAPS, FLAVOR } from './roster.js';
import {
  spawnRacer,
  resetRacer,
  aiInput,
  stepRacer,
  separate,
  rankRacers,
  formatTime,
} from './drive.js';
import { createWorld, createKartView, setLights } from './scene.js';
import { createAudio } from './audio.js';

const STEP = 1 / 60;
const EMPTY = { throttle: 0, brake: 0, reverse: false, steer: 0, drift: false };

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
const flavorEl = document.querySelector('#flavor');
const standingsEl = document.querySelector('#standings');
const soundBtn = document.querySelector('#sound');

const mapCtx = minimap.getContext('2d');
const keys = new Set();
const touch = { gas: false, brake: false, left: false, right: false, drift: false };

const track = buildTrack();
const racers = [
  spawnRacer(ROSTER[1], track, { row: 0, side: -1 }),
  spawnRacer(ROSTER[0], track, { row: 0, side: 1 }),
  spawnRacer(ROSTER[2], track, { row: 1, side: -1 }),
  spawnRacer(ROSTER[3], track, { row: 1, side: 1 }),
];
const player = racers.find((racer) => racer.player);

const world = createWorld(canvas, track);
const views = new Map();
for (const racer of racers) {
  const view = createKartView(racer);
  world.scene.add(view.group);
  views.set(racer, view);
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
const clock = { raceTime: 0, totalLaps: TOTAL_LAPS };

const map = mapSpace();

document.body.dataset.mode = 'menu';
syncSoundButton();
layoutRacers();
world.resize();

window.addEventListener('resize', () => world.resize());
window.visualViewport?.addEventListener('resize', () => world.resize());
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => keys.clear());

document.querySelector('#play').addEventListener('click', () => beginRace());
document.querySelector('#again').addEventListener('click', () => beginRace());
document.querySelector('#back').addEventListener('click', () => showMenu());
document.querySelector('#resume').addEventListener('click', () => resume());
document.querySelector('#pause-menu').addEventListener('click', () => showMenu());
soundBtn.addEventListener('click', toggleSound);

for (const button of document.querySelectorAll('#touch button')) {
  const name = button.dataset.hold;
  const down = (event) => {
    event.preventDefault();
    touch[name] = true;
  };
  const up = (event) => {
    event.preventDefault();
    touch[name] = false;
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
  if (event.code === 'Escape') onEscape();
  if (event.code === 'Enter' && mode === 'menu') beginRace();
}

function onEscape() {
  if (mode === 'race') {
    mode = 'pause';
    document.body.dataset.mode = mode;
    pauseEl.hidden = false;
    audio.quiet();
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
  if (soundOn && (mode === 'race' || mode === 'countdown' || mode === 'arrived')) {
    audio.resume();
  } else {
    audio.quiet();
  }
}

function syncSoundButton() {
  soundBtn.textContent = soundOn ? 'Som ligado' : 'Som mudo';
  soundBtn.setAttribute('aria-pressed', soundOn ? 'true' : 'false');
  audio.setMuted(!soundOn);
}

function beginRace() {
  audio.resume();
  for (const racer of racers) resetRacer(racer);
  raceTime = 0;
  clock.raceTime = 0;
  countdownT = 0;
  countdownPhase = 0;
  arrivedT = 0;
  acc = 0;
  orderKey = '';
  boostLatch = false;
  snapCamera = true;
  setLights(world.bulbs, 0);
  results.hidden = true;
  pauseEl.hidden = true;
  menu.hidden = true;
  hud.hidden = false;
  minimap.hidden = false;
  countdownEl.hidden = false;
  countdownEl.textContent = '3';
  wrong.hidden = true;
  mode = 'countdown';
  document.body.dataset.mode = mode;
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
  for (const racer of racers) resetRacer(racer);
  mode = 'menu';
  document.body.dataset.mode = mode;
  menu.hidden = false;
  hud.hidden = true;
  minimap.hidden = true;
  results.hidden = true;
  pauseEl.hidden = true;
  countdownEl.hidden = true;
  wrong.hidden = true;
  setLights(world.bulbs, 0);
  audio.quiet();
  Object.keys(touch).forEach((key) => {
    touch[key] = false;
  });
  layoutRacers();
}

function resume() {
  mode = 'race';
  document.body.dataset.mode = mode;
  pauseEl.hidden = true;
  if (soundOn) audio.resume();
}

function showResults() {
  const order = rankRacers(racers);
  const place = order.findIndex((racer) => racer.player) + 1;
  flavorEl.textContent = FLAVOR[place] || 'Corrida encerrada.';
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
  mode = 'results';
  document.body.dataset.mode = mode;
  audio.quiet();
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
    (keys.has('KeyD') || keys.has('ArrowRight') || touch.right ? 1 : 0) -
    (keys.has('KeyA') || keys.has('ArrowLeft') || touch.left ? 1 : 0);
  return {
    throttle,
    brake,
    reverse: brake > 0,
    steer,
    drift: keys.has('Space') || touch.drift,
  };
}

function simulate(dt) {
  raceTime += dt;
  clock.raceTime = raceTime;
  for (const racer of racers) {
    if (!racer.player && !racer.finished) {
      const gap = player.travel - racer.travel;
      racer.paceMul = Math.max(0.9, Math.min(1.07, 1 + gap * 0.05));
    }
    let input = EMPTY;
    if (!racer.finished && (mode === 'race' || mode === 'arrived')) {
      input = racer.player && mode === 'race' ? readInput() : racer.player ? EMPTY : aiInput(racer, track, raceTime);
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
        mode = 'arrived';
        document.body.dataset.mode = mode;
        arrivedT = 0;
        showCallout('Chegou!');
        audio.fanfare();
      },
      onWall(who) {
        if (who.player) audio.thud();
      },
    });
  }
  separate(racers, track);
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

  if (mode === 'countdown') updateCountdown(dt);
  if (mode === 'race' || mode === 'arrived') {
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      simulate(STEP);
      acc -= STEP;
      guard += 1;
    }
  } else {
    acc = 0;
  }

  if (mode === 'arrived') {
    arrivedT += dt;
    if (arrivedT > 1.15) showResults();
  }

  const time = now / 1000;
  layoutRacers(time, dt);
  updateCamera(dt, time);
  updateHud();
  drawMinimap();
  world.effects.update(dt);
  world.updateClouds(dt);
  if (mode === 'race' || mode === 'arrived') {
    audio.engine(player.speed, player.drifting, player.boost > 0);
    if (player.boost > 0.7 && !boostLatch) {
      boostLatch = true;
      showCallout('Impulso!');
      audio.boost();
    }
    if (player.boost <= 0) boostLatch = false;
  }
  world.renderer.render(world.scene, world.camera);
  requestAnimationFrame(frame);
}

function layoutRacers(time = 0, dt = 0) {
  for (const racer of racers) {
    const view = views.get(racer);
    const bob = mode === 'menu' ? Math.sin(time * 2 + view.phase) * 0.04 : 0;
    if (racer.boost > 0.65 && !view.boosting) view.hop = 1;
    view.boosting = racer.boost > 0;
    view.hop = Math.max(0, view.hop - dt * 1.5);
    view.group.position.set(
      racer.x,
      Math.sin(view.hop * Math.PI) * 0.32 + bob,
      racer.z,
    );
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

    if (racer.drifting && racer.speed > 8) {
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
  }
}

function updateCamera(dt, time) {
  const camera = world.camera;
  if (mode === 'menu' || mode === 'results') {
    menuAng += dt * 0.16;
    desired.x = Math.sin(menuAng) * 118;
    desired.y = 72;
    desired.z = Math.cos(menuAng) * 104;
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
    const targetFov = 63 + Math.min(9, Math.abs(player.speed) * 0.22) + (player.boost > 0 ? 4.5 : 0);
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
  const kmh = Math.round(Math.abs(player.speed) * 6.5);
  speedEl.textContent = `${kmh} km/h`;
  wrong.hidden = !(mode === 'race' && player.reverseTime > 0.4);

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

  const showDrift = mode === 'race' && (player.drifting || player.driftTime > 0);
  driftBar.hidden = !showDrift;
  if (showDrift) {
    const amount = Math.min(1, player.driftTime / 0.9);
    driftFill.style.width = `${amount * 100}%`;
    driftFill.classList.toggle('ready', player.driftTime >= 0.45);
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
  mapCtx.beginPath();
  track.points.forEach((point, index) => {
    const x = map.X(point.x);
    const y = map.Y(point.z);
    if (index === 0) mapCtx.moveTo(x, y);
    else mapCtx.lineTo(x, y);
  });
  mapCtx.closePath();
  mapCtx.strokeStyle = '#e7c89a';
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
