// Temas originais, um por pista. O clima é de corrida de kart (rápido, melodia clara, baixo marcando), sem usar músicas existentes.

function freq(name) {
  const names = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let i = 1;
  let acc = 0;
  if (name[i] === '#') {
    acc = 1;
    i += 1;
  } else if (name[i] === 'b') {
    acc = -1;
    i += 1;
  }
  const oct = Number(name.slice(i));
  const midi = (oct + 1) * 12 + names[name[0]] + acc;
  return 440 * 2 ** ((midi - 69) / 12);
}

function voice(spec, wave, vol) {
  return spec.map(([t, name, l]) => ({ t, f: freq(name), l, wave, vol }));
}

function oompah(bars, vol) {
  const notes = [];
  for (const bar of bars) {
    const root = freq(bar.root);
    const fifth = root * 1.5;
    notes.push(
      { t: bar.t, f: root, l: 0.34, wave: 'triangle', vol },
      { t: bar.t + 0.5, f: fifth, l: 0.16, wave: 'triangle', vol: vol * 0.62 },
      { t: bar.t + 1.5, f: root * 2, l: 0.14, wave: 'triangle', vol: vol * 0.42 },
      { t: bar.t + 2, f: root, l: 0.34, wave: 'triangle', vol },
      { t: bar.t + 2.5, f: fifth, l: 0.16, wave: 'triangle', vol: vol * 0.58 },
      { t: bar.t + 3.5, f: fifth * 0.5, l: 0.14, wave: 'triangle', vol: vol * 0.36 },
    );
  }
  return notes;
}

function roll(bars, vol) {
  const notes = [];
  for (const bar of bars) {
    const root = freq(bar.root);
    const fifth = root * 1.5;
    const seq = [root, root, fifth, root, root * 2, fifth, root, fifth];
    seq.forEach((f, i) => {
      notes.push({ t: bar.t + i * 0.5, f, l: 0.22, wave: 'square', vol: vol * (i % 2 ? 0.5 : 0.9) });
    });
  }
  return notes;
}

function chords(bars, vol, wave, length) {
  const notes = [];
  for (const bar of bars) {
    const root = freq(bar.root);
    const steps = bar.minor ? [0, 3, 7] : [0, 4, 7];
    for (const semi of steps) {
      notes.push({
        t: bar.t,
        f: root * 2 ** (semi / 12),
        l: length,
        wave,
        vol,
      });
    }
  }
  return notes;
}

function barsOf(roots) {
  return roots.map((root, index) => ({
    t: index * 4,
    root,
    minor: root.endsWith('m'),
  })).map((bar) => ({ ...bar, root: bar.minor ? bar.root.slice(0, -1) : bar.root }));
}

const FEIRA_BARS = barsOf(['C3', 'C3', 'F3', 'G3', 'A3m', 'F3', 'C3', 'G3', 'C3', 'A3m', 'F3', 'G3', 'F3', 'C3', 'G3', 'C3']);
const PARK_BARS = barsOf(['G2', 'D2', 'E2m', 'C2', 'G2', 'D2', 'C2', 'D2', 'E2m', 'C2', 'G2', 'D2', 'C2', 'G2', 'D2', 'G2']);

const FEIRA_LEAD = [
  [0, 'E5', 0.32], [0.5, 'G5', 0.28], [1, 'C6', 0.42], [1.5, 'E5', 0.22],
  [2, 'G5', 0.32], [2.5, 'A5', 0.28], [3, 'G5', 0.7],
  [4, 'E5', 0.32], [4.5, 'G5', 0.28], [5, 'C6', 0.36], [5.5, 'D6', 0.28],
  [6, 'E6', 0.5], [6.5, 'D6', 0.22], [7, 'C6', 0.85],
  [8, 'A5', 0.32], [8.5, 'C6', 0.28], [9, 'A5', 0.32], [9.5, 'F5', 0.28],
  [10, 'G5', 0.65], [11, 'E5', 0.4], [11.5, 'D5', 0.3],
  [12, 'F5', 0.28], [12.5, 'G5', 0.28], [13, 'A5', 0.32], [13.5, 'B5', 0.28],
  [14, 'G5', 0.4], [14.5, 'F5', 0.28], [15, 'D5', 0.7],
  [16, 'E5', 0.3], [16.5, 'A5', 0.3], [17, 'C6', 0.4], [17.5, 'E5', 0.25],
  [18, 'A5', 0.35], [18.5, 'G5', 0.25], [19, 'E5', 0.7],
  [20, 'F5', 0.3], [20.5, 'A5', 0.3], [21, 'C6', 0.4], [21.5, 'A5', 0.28],
  [22, 'G5', 0.45], [23, 'F5', 0.55],
  [24, 'E5', 0.3], [24.5, 'G5', 0.3], [25, 'C6', 0.45], [25.5, 'G5', 0.25],
  [26, 'E5', 0.35], [26.5, 'D5', 0.3], [27, 'C5', 0.8],
  [28, 'D5', 0.28], [28.5, 'F5', 0.28], [29, 'G5', 0.35], [29.5, 'F5', 0.25],
  [30, 'E5', 0.35], [30.5, 'D5', 0.3], [31, 'B4', 0.75],
  [32, 'E5', 0.28], [32.5, 'G5', 0.28], [33, 'C6', 0.4], [33.5, 'E6', 0.35],
  [34, 'D6', 0.3], [34.5, 'C6', 0.25], [35, 'G5', 0.6],
  [36, 'E5', 0.28], [36.5, 'A5', 0.28], [37, 'C6', 0.4], [37.5, 'B5', 0.28],
  [38, 'A5', 0.4], [39, 'G5', 0.6],
  [40, 'A5', 0.3], [40.5, 'C6', 0.3], [41, 'A5', 0.3], [41.5, 'F5', 0.28],
  [42, 'G5', 0.55], [43, 'E5', 0.5],
  [44, 'G5', 0.28], [44.5, 'A5', 0.28], [45, 'B5', 0.32], [45.5, 'A5', 0.25],
  [46, 'G5', 0.4], [46.5, 'F5', 0.28], [47, 'D5', 0.7],
  [48, 'A5', 0.3], [48.5, 'G5', 0.25], [49, 'A5', 0.3], [49.5, 'C6', 0.4],
  [50, 'A5', 0.35], [51, 'F5', 0.55],
  [52, 'E5', 0.3], [52.5, 'G5', 0.3], [53, 'C6', 0.45], [53.5, 'E5', 0.25],
  [54, 'G5', 0.4], [55, 'E5', 0.55],
  [56, 'F5', 0.28], [56.5, 'G5', 0.28], [57, 'A5', 0.32], [57.5, 'G5', 0.25],
  [58, 'F5', 0.3], [58.5, 'E5', 0.28], [59, 'D5', 0.55],
  [60, 'E5', 0.3], [60.5, 'D5', 0.25], [61, 'C5', 1.3],
];

const PARK_LEAD = [
  [0, 'D5', 0.9], [1, 'G5', 0.7], [2, 'B5', 0.45], [2.5, 'A5', 0.4], [3, 'G5', 0.85],
  [4, 'A5', 0.7], [5, 'F#5', 0.5], [5.5, 'E5', 0.4], [6, 'D5', 0.9], [7, 'F#5', 0.7],
  [8, 'G5', 0.8], [9, 'E5', 0.5], [9.5, 'G5', 0.4], [10, 'B5', 0.7], [11, 'A5', 0.8],
  [12, 'G5', 0.6], [13, 'E5', 0.6], [14, 'D5', 0.5], [14.5, 'C5', 0.4], [15, 'D5', 0.8],
  [16, 'B4', 0.7], [17, 'D5', 0.6], [18, 'G5', 0.9], [19, 'D5', 0.7],
  [20, 'A5', 0.6], [21, 'F#5', 0.5], [22, 'E5', 0.6], [23, 'D5', 0.8],
  [24, 'E5', 0.7], [25, 'G5', 0.6], [26, 'C6', 0.8], [27, 'A5', 0.7],
  [28, 'F#5', 0.5], [28.5, 'A5', 0.4], [29, 'D6', 0.7], [30, 'A5', 0.5], [31, 'F#5', 0.8],
  [32, 'G5', 0.8], [33, 'B5', 0.6], [34, 'E6', 0.5], [34.5, 'D6', 0.4], [35, 'B5', 0.8],
  [36, 'C6', 0.7], [37, 'G5', 0.6], [38, 'E5', 0.8], [39, 'G5', 0.7],
  [40, 'D5', 0.6], [41, 'G5', 0.8], [42, 'B5', 0.6], [43, 'A5', 0.7],
  [44, 'F#5', 0.6], [45, 'A5', 0.6], [46, 'D6', 0.5], [47, 'C6', 0.8],
  [48, 'E5', 0.6], [49, 'G5', 0.7], [50, 'C6', 0.8], [51, 'E5', 0.6],
  [52, 'D5', 0.5], [52.5, 'G5', 0.5], [53, 'B5', 0.7], [54, 'G5', 0.6], [55, 'D5', 0.8],
  [56, 'A5', 0.6], [57, 'F#5', 0.5], [58, 'D5', 0.7], [59, 'F#5', 0.6],
  [60, 'G5', 0.5], [61, 'D5', 0.4], [62, 'B4', 1.4],
];

const SONGS = {
  feira: {
    bpm: 154,
    bars: 16,
    kit: 'bounce',
    notes: [
      ...voice(FEIRA_LEAD, 'square', 0.055),
      ...oompah(FEIRA_BARS, 0.09),
      ...chords(FEIRA_BARS.map((bar) => ({ ...bar, root: bar.root.replace('2', '4').replace('3', '4') })), 0.016, 'square', 0.55),
    ],
  },
  barigui: {
    bpm: 138,
    bars: 16,
    kit: 'cruise',
    notes: [
      ...voice(PARK_LEAD, 'triangle', 0.07),
      ...roll(PARK_BARS, 0.045),
      ...chords(PARK_BARS.map((bar) => ({ ...bar, root: bar.root.replace('2', '4') })), 0.02, 'triangle', 1.7),
    ],
  },
};

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let filter = null;
  let engineGain = null;
  let musicGain = null;
  let noise = null;
  let muted = false;
  let musicId = 'feira';
  let musicTimer = 0;
  let generation = 0;
  let bedScale = 1;

  function musicLevel() {
    return 0.46 * bedScale;
  }

  function ensure() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.85;
    master.connect(ctx.destination);

    engine = ctx.createOscillator();
    engine.type = 'sawtooth';
    engine.frequency.value = 46;
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engine.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engine.start();

    const len = Math.floor(ctx.sampleRate * 0.25);
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  }

  function tone(freqValue, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqValue, ctx.currentTime);
    if (slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), ctx.currentTime + dur);
    }
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function playAt(time, note) {
    if (!musicGain || !(note.f > 0) || !(note.l > 0)) return;
    const osc = ctx.createOscillator();
    const low = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = note.wave;
    osc.frequency.setValueAtTime(note.f, time);
    low.type = 'lowpass';
    low.frequency.setValueAtTime(note.wave === 'square' ? 1600 : 2800, time);
    const dur = note.l * (60 / SONGS[musicId].bpm);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(note.vol, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.03, dur));
    osc.connect(low);
    low.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + dur + 0.03);
  }

  function burst(time, vol, dur, high, band) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const shape = ctx.createBiquadFilter();
    shape.type = band ? 'bandpass' : 'highpass';
    shape.frequency.value = high;
    if (band) shape.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(shape);
    shape.connect(gain);
    gain.connect(musicGain);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function kick(time, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(148, time);
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.09);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.13);
    osc.connect(gain);
    gain.connect(musicGain);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  function kit(kind, barTime, beat) {
    if (kind === 'cruise') {
      kick(barTime, 0.16);
      kick(barTime + 1.5 * beat, 0.1);
      kick(barTime + 2.5 * beat, 0.12);
      burst(barTime + beat, 0.05, 0.08, 1800, true);
      burst(barTime + 3 * beat, 0.045, 0.08, 1800, true);
      for (let i = 0; i < 8; i += 1) burst(barTime + i * 0.5 * beat, i % 2 ? 0.012 : 0.022, 0.035, 6500, false);
      return;
    }
    kick(barTime, 0.2);
    kick(barTime + 2 * beat, 0.16);
    burst(barTime + beat, 0.07, 0.07, 1900, true);
    burst(barTime + 3 * beat, 0.065, 0.07, 1900, true);
    for (let i = 0; i < 8; i += 1) burst(barTime + i * 0.5 * beat, i % 2 ? 0.016 : 0.03, 0.03, 7200, false);
  }

  function restart() {
    generation += 1;
    const gen = generation;
    if (musicTimer) window.clearTimeout(musicTimer);
    if (musicGain) musicGain.disconnect();
    musicGain = ctx.createGain();
    musicGain.gain.value = musicLevel();
    musicGain.connect(master);
    const song = SONGS[musicId] || SONGS.feira;
    const beat = 60 / song.bpm;
    const loop = song.bars * 4 * beat;
    let cursor = ctx.currentTime + 0.05;
    const pump = () => {
      if (gen !== generation) return;
      const horizon = ctx.currentTime + 0.4;
      while (cursor < horizon) {
        if (cursor < ctx.currentTime - 0.05) {
          cursor += loop;
          continue;
        }
        for (const note of song.notes) playAt(cursor + note.t * beat, note);
        for (let bar = 0; bar < song.bars; bar += 1) kit(song.kit, cursor + bar * 4 * beat, beat);
        cursor += loop;
      }
      musicTimer = window.setTimeout(pump, 100);
    };
    pump();
  }

  return {
    resume() {
      ensure();
      const pending = ctx.resume();
      if (!musicTimer) restart();
      return pending;
    },
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.85, ctx.currentTime, 0.03);
    },
    get muted() {
      return muted;
    },
    setTrack(id) {
      const next = SONGS[id] ? id : 'feira';
      const changed = next !== musicId;
      musicId = next;
      if (!ctx) return;
      if (changed || !musicTimer) restart();
    },
    bed(scale) {
      bedScale = scale;
      if (musicGain && ctx) musicGain.gain.setTargetAtTime(musicLevel(), ctx.currentTime, 0.06);
    },
    engine(speed, drifting, boost) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const s = Math.abs(speed);
      engine.frequency.setTargetAtTime(42 + s * 3.2 + (boost ? 26 : 0), t, 0.06);
      filter.frequency.setTargetAtTime(220 + s * 26 + (drifting ? 200 : 0), t, 0.08);
      engineGain.gain.setTargetAtTime(Math.min(0.085, 0.01 + s * 0.0022), t, 0.08);
    },
    quiet() {
      if (!engineGain || !ctx) return;
      engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    },
    beep(step) {
      tone(420 + step * 130, 0.11, 'square', 0.07);
    },
    go() {
      tone(620, 0.16, 'square', 0.08, 900);
    },
    blip() {
      tone(740, 0.08, 'triangle', 0.06, 980);
    },
    thud() {
      tone(120, 0.12, 'sine', 0.09, 55);
    },
    boost() {
      tone(480, 0.14, 'square', 0.05, 840);
    },
    pickup() {
      tone(660, 0.08, 'square', 0.05, 990);
    },
    tick() {
      tone(540, 0.035, 'square', 0.028, 760);
    },
    toss() {
      tone(300, 0.09, 'square', 0.045, 150);
    },
    slip() {
      tone(190, 0.16, 'sawtooth', 0.055, 55);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((freqValue, i) => {
        window.setTimeout(() => tone(freqValue, 0.16, 'triangle', 0.07), i * 105);
      });
    },
  };
}
