export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let filter = null;
  let engineGain = null;
  let muted = false;

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
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
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

  return {
    resume() {
      ensure();
      return ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.setTargetAtTime(value ? 0 : 0.85, ctx.currentTime, 0.03);
    },
    get muted() {
      return muted;
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
    toss() {
      tone(300, 0.09, 'square', 0.045, 150);
    },
    slip() {
      tone(190, 0.16, 'sawtooth', 0.055, 55);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((freq, i) => {
        window.setTimeout(() => tone(freq, 0.16, 'triangle', 0.07), i * 105);
      });
    },
  };
}
