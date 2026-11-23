'use strict';
// Les Automates' sound: everything is synthesised, but each effect is built in layers the way a recorded one is
// (a transient, a body, a tail), played through a room reverb that changes with where you are, and placed in stereo
// by where it happened. `ctx` can be an OfflineAudioContext, which is how the effects are checked without a speaker.
function Sound(ctx) {
  const R = ctx.sampleRate, now = () => ctx.currentTime, rnd = (a, b) => a + Math.random() * (b - a);
  const master = ctx.createGain(), comp = ctx.createDynamicsCompressor(), dry = ctx.createGain(), verb = ctx.createConvolver(), wet = ctx.createGain(), bed = ctx.createGain();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .18;
  dry.connect(comp); verb.connect(wet); wet.connect(comp); bed.connect(comp); comp.connect(master); master.connect(ctx.destination); master.gain.value = .9;
  const white = ctx.createBuffer(1, R * 2, R); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  // a reverb tail made from decaying noise: seconds long, how fast it darkens, how loud
  const ROOMS = { metro: [2.4, 2.2, .3], catacombs: [1.5, 3, .28], cellar: [1.1, 3.2, .22], chateau: [.8, 4, .14], courtyard: [.45, 6, .06], workshop: [1.7, 2.6, .26] };
  const tails = {}, tail = name => {
    if (tails[name]) return tails[name];
    const [secs, damp] = ROOMS[name], b = ctx.createBuffer(2, R * secs | 0, R);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0; for (let i = 0; i < d.length; i++) { const t = i / d.length; lp += ((Math.random() * 2 - 1) - lp) * (1 - t * .85); d[i] = lp * Math.pow(1 - t, damp) * (i < 60 ? i / 60 : 1); } }
    return tails[name] = b;
  };
  // ---- building blocks ----
  const env = (p, t, peak, attack, decay) => { p.setValueAtTime(.0001, t); p.exponentialRampToValueAtTime(Math.max(.0002, peak), t + attack); p.exponentialRampToValueAtTime(.0001, t + attack + decay); };
  const noise = (dst, t, dur, peak, type, f0, f1 = f0, q = .8, attack = .002) => {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(); s.buffer = white; s.loop = true;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g.gain, t, peak, attack, dur); s.connect(f); f.connect(g); g.connect(dst); s.start(t, Math.random() * 1.5); s.stop(t + attack + dur + .02);
  };
  const tone = (dst, t, dur, peak, type, f0, f1 = f0, attack = .003) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    env(g.gain, t, peak, attack, dur); o.connect(g); g.connect(dst); o.start(t); o.stop(t + attack + dur + .02);
  };
  const metal = (dst, t, base, dur, peak) => [1, 1.58, 2.37, 3.21, 4.63].forEach((r, i) => tone(dst, t, dur / (1 + i * .45), peak / (1 + i * .7), 'sine', base * r * rnd(.985, 1.015)));   // struck metal: partials that are not in tune
  const tick = (dst, t, peak, f = 3200) => noise(dst, t, .014, peak, 'highpass', f, f, .7, .001);
  const drive = amount => { const w = ctx.createWaveShaper(), c = new Float32Array(257); for (let i = 0; i < 257; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); } w.curve = c; return w; };
  // one voice: its level, where it sits left to right, and how muffled it is by distance or a wall
  const bus = (vol = 1, pan = 0, muffle = 0, send = 1) => {
    const g = ctx.createGain(), f = ctx.createBiquadFilter(), p = ctx.createStereoPanner(), s = ctx.createGain();
    g.gain.value = vol; f.type = 'lowpass'; f.frequency.value = 400 + 17000 * Math.pow(1 - Math.min(.95, muffle), 2.5); p.pan.value = Math.max(-1, Math.min(1, pan)); s.gain.value = send;
    g.connect(f); f.connect(p); p.connect(dry); p.connect(s); s.connect(verb); return g;
  };
  const shot = (d, t, crack, body, boomHz, len) => {                         // a gunshot: the crack, the body of the report, the thump you feel
    tick(d, t, crack * .8, 5000); noise(d, t, len * .35, crack, 'bandpass', 2600, 900, .7); noise(d, t, len, body, 'lowpass', 1800, 240, .6); tone(d, t, len * .8, body * 1.1, 'sine', boomHz * 2.2, boomHz * .45);
  };
  const FX = {
    pistol: (d, t) => shot(d, t, .7, .55, 95, .16),
    smg: (d, t) => shot(d, t, .55, .4, 120 * rnd(.92, 1.08), .09),
    shotgun: (d, t) => { const w = drive(3); w.connect(d); shot(w, t, .9, .95, 62, .34); noise(d, t + .02, .5, .3, 'lowpass', 600, 120); tick(d, t + .34, .25, 2200); metal(d, t + .34, 900, .05, .1); tick(d, t + .46, .3, 1800); metal(d, t + .46, 700, .06, .12); },   // then the pump
    tesla: (d, t) => { for (let i = 0; i < 4; i++) { const s = t + i * .028; tone(d, s, .05, .16, 'sawtooth', rnd(900, 2600), rnd(200, 900)); noise(d, s, .04, .22, 'highpass', rnd(3000, 7000)); } tone(d, t, .22, .18, 'square', 110, 55); },
    click: (d, t) => { tick(d, t, .3, 2500); tick(d, t + .05, .18, 4000); },
    hit: (d, t) => { tick(d, t, .4, 2500); metal(d, t, rnd(700, 1500), .16, .22); noise(d, t, .05, .2, 'bandpass', 1800, 900, 1.5); },               // a round ringing off plate
    die: (d, t) => {                                                         // a machine coming apart: the crash, the plates ringing, the motor winding down, bits landing
      noise(d, t, .5, .8, 'lowpass', 2600, 160); metal(d, t, rnd(300, 420), .7, .3); metal(d, t + .06, rnd(520, 800), .5, .22);
      tone(d, t, .7, .22, 'sawtooth', rnd(340, 460), 38); for (let i = 0; i < 7; i++) { const s = t + rnd(.15, .95); tick(d, s, rnd(.08, .25), rnd(1500, 4000)); metal(d, s, rnd(900, 2200), .06, .06); }
    },
    boom: (d, t) => { const w = drive(4); w.connect(d); tone(w, t, 1, 1, 'sine', 82, 24, .004); noise(w, t, .9, .9, 'lowpass', 900, 70); noise(d, t, .12, .6, 'bandpass', 2400, 600); noise(d, t + .25, 1.3, .22, 'lowpass', 400, 90, .5, .2); for (let i = 0; i < 6; i++) tick(d, t + rnd(.3, 1.3), rnd(.05, .15), rnd(1200, 3500)); },
    enemy: (d, t) => shot(d, t, .5, .45, 78, .2),
    smash: (d, t) => { noise(d, t, .28, .5, 'bandpass', 900, 260, 1); tick(d, t, .4, 1800); tone(d, t, .14, .3, 'sine', 130, 60); for (let i = 0; i < 4; i++) tick(d, t + .05 + i * .04, .2, rnd(900, 2400)); },   // wood and hoops giving way
    glass: (d, t) => { noise(d, t, .32, .3, 'highpass', 5200, 7400, .6); for (let i = 0; i < 7; i++) { tick(d, t + i * .028, .26, rnd(4200, 8200)); tone(d, t + i * .03, .08, .05, 'sine', rnd(2600, 5200)); } },                       // a pane, or a chandelier
    roar: (d, t) => { const w = drive(3); w.connect(d); for (const f of [55, 82.5, 110, 164]) tone(w, t, 1.3, .16, 'sawtooth', f * .9, f, .25); noise(d, t, 1.2, .22, 'lowpass', 500, 160, 1, .2); tone(d, t + .1, .9, .1, 'square', 220, 147, .1); },   // Le Colosse: a furnace and a foghorn
    charge: (d, t) => { tone(d, t, .38, .1, 'sawtooth', 170, 760, .2); tone(d, t, .38, .05, 'square', 340, 1520, .25); },   // a machine's gun winding up before it fires
    casing: (d, t) => { tick(d, t, .1, 5200); tone(d, t, .05, .05, 'sine', rnd(3600, 4600)); tick(d, t + .09, .05, 6000); },                     // a spent case on the floor
    wake: (d, t) => { tone(d, t, .16, .12, 'square', 260, 620); tone(d, t + .02, .16, .06, 'sawtooth', 520, 1240); for (let i = 0; i < 4; i++) tick(d, t + .2 + i * .045, .12, 2600); },   // a servo spinning up and a ratchet
    door: (d, t) => { noise(d, t, .55, .3, 'bandpass', 260, 190, 1.2, .08); tone(d, t, .5, .1, 'sawtooth', 58, 74, .05); tone(d, t + .52, .14, .4, 'sine', 90, 46); tick(d, t + .52, .2, 900); },
    pickup: (d, t) => { tone(d, t, .12, .2, 'triangle', 660); tone(d, t, .12, .08, 'sine', 1320); tone(d, t + .08, .22, .22, 'triangle', 990); tone(d, t + .08, .22, .08, 'sine', 1980); },
    key: (d, t) => [523, 659, 784, 1047].forEach((f, i) => { tone(d, t + i * .09, .35, .2, 'triangle', f); tone(d, t + i * .09, .3, .07, 'sine', f * 2); }),
    hurt: (d, t) => { tone(d, t, .16, .5, 'sine', 140, 60); noise(d, t, .14, .4, 'bandpass', 620, 380, 3); noise(d, t, .14, .25, 'bandpass', 1250, 900, 4); },
    swap: (d, t) => { tick(d, t, .2, 1800); metal(d, t + .01, 1100, .05, .08); tick(d, t + .09, .25, 2600); },
    steam: (d, t) => noise(d, t, 1.4, .22, 'highpass', 2600, 5200, .5, .15),
    drip: (d, t) => { const f = rnd(900, 1700); tone(d, t, .07, .12, 'sine', f, f * 1.7); tone(d, t + .06, .09, .05, 'sine', f * 1.5, f * 2.2); },
    cricket: (d, t) => { for (let i = 0; i < 5; i++) tone(d, t + i * .045, .03, .03, 'sine', 4300, 4300, .004); },
    thump: (d, t) => { tone(d, t, .2, .22, 'sine', 70, 40); tick(d, t + .01, .06, 700); },
    clock: (d, t) => tick(d, t, .05, 1500),
    train: (d, t) => {                                                       // six seconds: the rumble building and fading, wheels over the rail joints, a brake squeal
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.6); g.gain.setValueAtTime(1, t + 3.4); g.gain.exponentialRampToValueAtTime(.0001, t + 6); g.connect(d);
      noise(g, t, 6, .7, 'lowpass', 140, 110, .7, .5); noise(g, t, 6, .25, 'bandpass', 700, 500, .6, .5); tone(g, t, 6, .25, 'sawtooth', 46, 40, .5);
      for (let s = .5; s < 5.6; s += .31) { tone(g, t + s, .06, .3, 'sine', 120, 60); tick(g, t + s, .14, 1400); tone(g, t + s + .09, .06, .22, 'sine', 110, 55); tick(g, t + s + .09, .1, 1400); }
      tone(g, t + 3.2, 2.2, .035, 'sine', 2900, 2500, .4); tone(g, t + 3.2, 2.2, .02, 'sine', 3870, 3300, .4);
    },
  };
  // footsteps: each surface has its own character
  const STEP = {
    tile: (d, t) => { tick(d, t, .16, 2200); tone(d, t, .05, .2, 'sine', 170, 90); }, wood: (d, t) => { tone(d, t, .07, .28, 'sine', 210, 120); noise(d, t, .04, .1, 'bandpass', 900, 600, 2); },
    stone: (d, t) => { noise(d, t, .05, .22, 'bandpass', 1100, 500, 1.2); tone(d, t, .05, .16, 'sine', 130, 70); }, earth: (d, t) => noise(d, t, .09, .26, 'lowpass', 500, 180),
    carpet: (d, t) => noise(d, t, .08, .1, 'lowpass', 320, 140), grass: (d, t) => noise(d, t, .11, .1, 'highpass', 2200, 3800, .5, .02),
    metal: (d, t) => { metal(d, t, rnd(420, 520), .12, .12); tone(d, t, .05, .2, 'sine', 150, 80); },
  };
  // ---- the room you are in: its reverb, and a quiet bed of sound with occasional details ----
  const BEDS = {
    metro: g => { hum(g, 50, .012); wash(g, 'lowpass', 160, .05, .07); }, catacombs: g => wash(g, 'bandpass', 320, .035, .11), cellar: g => wash(g, 'lowpass', 120, .035, .05),
    chateau: g => wash(g, 'lowpass', 90, .015, .04), courtyard: g => { wash(g, 'highpass', 1800, .018, .13); wash(g, 'bandpass', 420, .02, .09); }, workshop: g => { hum(g, 60, .02); hum(g, 120, .01); wash(g, 'highpass', 4200, .012, .2); },
  };
  const DETAIL = { metro: ['drip', 9], catacombs: ['drip', 4], cellar: ['drip', 7], chateau: ['clock', 1], courtyard: ['cricket', 1.6], workshop: ['thump', 1.4] };
  function hum(g, f, v) { const o = ctx.createOscillator(), a = ctx.createGain(); o.frequency.value = f; a.gain.value = v; o.connect(a); a.connect(g); o.start(); }
  function wash(g, type, f, v, rate) {                                       // filtered noise that slowly swells and falls
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), a = ctx.createGain(), l = ctx.createOscillator(), d = ctx.createGain();
    s.buffer = white; s.loop = true; fl.type = type; fl.frequency.value = f; a.gain.value = v; l.frequency.value = rate; d.gain.value = v * .6; l.connect(d); d.connect(a.gain); s.connect(fl); fl.connect(a); a.connect(g); s.start(0, Math.random()); l.start();
  }
  // ---- music: two looping tracks, one for exploring and one for a fight, crossfaded by what is happening ----
  const tracks = {}, musicBus = ctx.createGain(), XF = 3; musicBus.connect(master); let fight = false;
  const LEVELS = { explore: [.34, .05], combat: [0, .46] };                   // each track's level while exploring, and in a fight
  const keepPlaying = () => { for (const k in tracks) { const t = tracks[k];
    t.gain.gain.setTargetAtTime(LEVELS[k][fight ? 1 : 0], now(), fight ? .5 : 1.8);                       // the fight music comes in fast and lingers
    if (now() < t.next - .5) continue;
    const at = Math.max(now(), t.next), s = ctx.createBufferSource(), g = ctx.createGain(), d = t.buf.duration; s.buffer = t.buf;   // each pass fades in over the tail of the last, so the loop has no gap or click
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(1, at + XF); g.gain.setValueAtTime(1, at + d - XF); g.gain.linearRampToValueAtTime(0, at + d);
    s.connect(g); g.connect(t.gain); s.start(at); t.next = at + d - XF;
  } };
  const beds = {}; let room = null, next = 1;
  // how loud each effect sits in the mix: guns and pain up front, the rest behind them
  const LEVEL = { pistol: 2.2, smg: 2.3, shotgun: 1.8, tesla: 2, click: 2, hit: 2.4, die: 1.5, boom: 1.25, enemy: 2.4, wake: 2, door: 1.3, pickup: 1.6, key: 1.5, hurt: 3, swap: 1.6, train: 1.6 };
  const play = (kind, o = {}) => { const f = FX[kind] || STEP[kind]; if (f) f(bus((o.vol == null ? 1 : o.vol) * (LEVEL[kind] || 1), o.pan || 0, o.muffle || 0, o.send == null ? 1 : o.send), now() + .001); };
  return {
    play, kinds: Object.keys(FX), steps: Object.keys(STEP), rooms: Object.keys(ROOMS),
    step(surface, pan) { play(surface, { vol: 2.6, pan, send: .6 }); },
    room(name) {
      if (name === room || !ROOMS[name]) return;
      const t = now(); verb.buffer = tail(name); wet.gain.setTargetAtTime(ROOMS[name][2], t, .3);
      if (room && beds[room]) beds[room].gain.setTargetAtTime(0, t, .5);
      if (!beds[name]) { beds[name] = ctx.createGain(); beds[name].gain.value = 0; beds[name].connect(bed); BEDS[name](beds[name]); }
      beds[name].gain.setTargetAtTime(1, t, .8); room = name; next = 1;
    },
    music(urls) { for (const k in urls) fetch(urls[k]).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => { const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(musicBus); tracks[k] = { buf, gain, next: 0 }; }).catch(() => {}); return this; },
    mood(fighting) { fight = !!fighting; },
    get loaded() { return Object.keys(tracks); },
    tick(dt) { keepPlaying(); if (!room || (next -= dt) > 0) return; const [k, every] = DETAIL[room]; next = every * rnd(.6, 1.5); play(k, { vol: rnd(.5, 1), pan: rnd(-.8, .8), muffle: .2 }); },   // drips, crickets, a clock, the workshop's press
    mute(on) { master.gain.setTargetAtTime(on ? 0 : .9, now(), .03); },
  };
}
