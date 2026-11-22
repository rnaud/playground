'use strict';
// Shared by every renderer page: model definitions, world layout, input and simulation.
// ---------- helpers ----------
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const noise3 = (x, y, z) => { let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 | 0, 1274126177); h ^= h >>> 13; return ((Math.imul(h, 1274126177) >>> 0) % 1000) / 1000; };

// ---------- models: each is a function (x,y,z) -> colour (or null for empty) on a W x L x H grid ----------
const MODEL_DEFS = {};
const def = (name, W, L, H, fn) => MODEL_DEFS[name] = { name, W, L, H, fn };
const PICKABLE = ['car', 'taxi', 'van', 'truck', 'police', 'house', 'barn', 'tree', 'tower', 'stand', 'arch'];

// Cars are 16 wide x 30 long, nose at +y. One builder covers every body style:
// kind sets where the cabin sits [rear y, front y, layers] and how steeply its glass leans.
function carFn(c) {
  const kind = c.kind, cab = { sport: [8, 19, 3], sedan: [6, 21, 3], van: [1, 25, 5], pickup: [14, 22, 3] }[kind];
  const slopeF = kind === 'van' ? 0.6 : 1.3, slopeR = kind === 'sport' ? 1.7 : kind === 'sedan' ? 1 : 0.25;
  const WHITE = 0xf4f1e6, CHASSIS = 0x23232b;
  return (x, y, z) => {
    const ax = Math.abs(x - 7.5);
    const wy = (y >= 4 && y <= 8) ? 6 : (y >= 21 && y <= 25) ? 23 : 0;           // wheel centre, if y is inside a wheel
    if (ax > 5.6 && z <= 3 && ((y >= 3 && y <= 9) || (y >= 20 && y <= 26))) {     // wheel wells cut into the body
      if (!wy || ((z === 0 || z === 3) && Math.abs(y - wy) === 2)) return null;   // rounded tyre
      return ax > 7 && (z === 1 || z === 2) && Math.abs(y - wy) <= 1 ? 0xc8ccd6 : 0x16161c; // hubcap / rubber
    }
    let hw = 7; if (y >= 28) hw -= (y - 27) * 1.2; if (y === 0) hw -= 1;          // rounded nose and tail
    const deck = kind !== 'van' && y >= (kind === 'sport' ? 26 : 27) ? 3 : 4;      // bonnet dips at the nose
    if (z >= 1 && z <= deck && ax < hw) {
      if (z === 1) return CHASSIS;
      if (kind === 'pickup' && y >= 2 && y <= 12 && ax < 5.6) { if (z === 4) return null; if (z === 3) return 0x3a3a44; } // load bed
      if (z === 3 && y >= 28 && ax > 3) return 0xfff3b0;                           // headlights
      if (y === 29 && ax < 3) return 0x2a2a33;                                     // grille
      if (y === 0 && z === 3) return ax > 3 ? 0xff3040 : ax < 1.6 ? WHITE : c.body; // tail lights + plate
      if (z === 2 && (y >= 28 || y <= 0)) return 0x9aa0ad;                         // bumpers
      if (ax > hw - 1 && z >= 3 && (y === cab[0] + 2 || y === cab[1] - 3)) return c.dark; // door seams
      if (c.stripe && ax < 1.6 && z === deck) return WHITE;
      if (c.checker && z === 3 && ax > hw - 1 && y > 9 && y < 20) return (y & 1) ? 0x1b1b22 : c.checker;
      return z === 2 ? c.dark : c.body;
    }
    const k = z - 5;
    if (k >= 0 && k < cab[2]) {                                                    // cabin: each layer is a little smaller
      const y0 = cab[0] + Math.round(k * slopeR), y1 = cab[1] - Math.round(k * slopeF), w = kind === 'van' ? 7 - k * 0.15 : 6 - k * 0.5;
      if (y >= y0 && y <= y1 && ax < w) {
        if (k === cab[2] - 1) return c.stripe && ax < 1.6 ? WHITE : c.light;       // roof
        const ex = ax > w - 1, ey = y === y0 || y === y1;
        if (!ex && !ey) return 0x30384a;                                           // interior
        if ((ex && ey) || (ex && y === Math.round((y0 + y1) / 2))) return c.body;  // pillars
        if (kind === 'van' && y < 15) return ex && k === 2 ? WHITE : c.body;       // panel van sides
        return y === y1 ? 0xbfe8ff : 0x8fc8f0;                                     // windscreen / side glass
      }
    }
    if (kind === 'sport' && y <= 2) { if (z === 6 && ax < 7) return c.dark; if (z === 5 && y === 1 && ax > 4 && ax < 6) return CHASSIS; } // spoiler
    if (c.sign && z === 8 && (y === 13 || y === 14) && ax < 2.6) return ((x + y) & 1) ? 0x1b1b22 : 0xffe27a;
    if (c.siren && z === 8 && (y === 13 || y === 14) && ax < 4.6) return ax < 1 ? WHITE : x < 7.5 ? 0xff3040 : 0x3d7dff;
    if (z === 5 && y === cab[1] - 1 && ax > 6) return c.body;                       // wing mirrors
    return null;
  };
}
def('car', 16, 30, 8, carFn({ kind: 'sport', body: 0xd8363e, dark: 0xa3242c, light: 0xf0555c, stripe: true }));
def('taxi', 16, 30, 9, carFn({ kind: 'sedan', body: 0xf0b429, dark: 0xc08a12, light: 0xffd257, sign: true, checker: 0xf4f1e6 }));
def('van', 16, 30, 10, carFn({ kind: 'van', body: 0x3d7dd8, dark: 0x2a5aa6, light: 0x69a2f0 }));
def('truck', 16, 30, 8, carFn({ kind: 'pickup', body: 0x3f9a5b, dark: 0x2c7242, light: 0x5cbd7a }));
def('police', 16, 30, 9, carFn({ kind: 'sedan', body: 0xeef0f4, dark: 0x1e2230, light: 0xffffff, siren: true }));
def('tree', 18, 18, 22, (x, y, z) => {
  const dx = x - 8.5, dy = y - 8.5;
  if (z < 9 && Math.hypot(dx, dy) < 1.7) return noise3(x, y, z) > .5 ? 0x7a4a2a : 0x8d5a34;
  const d = Math.hypot(dx, dy, (z - 14) * 1.05), n = noise3(x, y, z);
  if (z >= 6 && d < 6.6 + n * 1.8) return n > .7 ? 0x7fd45a : n > .3 ? 0x4fae45 : 0x2f8a3c;
  return null;
});
def('pine', 16, 16, 26, (x, y, z) => {
  const d = Math.hypot(x - 7.5, y - 7.5);
  if (z < 5) return d < 1.6 ? 0x6b4226 : null;
  const k = z - 5, tier = k % 7, r = (7.8 - k * 0.3) * (1 - tier / 10);
  if (d < r) return noise3(x, y, z) > .55 ? 0x2e7d5b : 0x1f5f4a;
  return null;
});
def('house', 26, 22, 18, (x, y, z) => {
  if (z <= 9) {
    if (x < 1 || x > 24 || y < 1 || y > 20) return null;
    if (!(x === 1 || x === 24 || y === 1 || y === 20)) return z === 0 ? 0x6b5a48 : null;
    if (y === 20 && x >= 11 && x <= 14 && z < 6) return 0x7a4a2a;                            // door
    if (z >= 4 && z <= 6 && (y === 20 || y === 1) && ((x >= 4 && x <= 7) || (x >= 18 && x <= 21))) return 0x8fd0ff;
    if (z >= 4 && z <= 6 && (x === 1 || x === 24) && y >= 8 && y <= 13) return 0x8fd0ff;
    return z < 2 ? 0xb9a88c : 0xf0e3c4;
  }
  if (x >= 18 && x <= 20 && y >= 5 && y <= 7 && z <= 17) return 0x8a8a94;                    // chimney
  const inset = Math.floor((z - 10) * 1.7);
  if (x >= inset && x <= 25 - inset) return (y % 3 === 0) ? 0xa8402f : 0xc9543c;             // gable roof
  return null;
});
def('crate', 10, 10, 9, (x, y, z) => {
  const e = (x === 0 || x === 9) + (y === 0 || y === 9) + (z === 0 || z === 8);
  if (e >= 2) return 0x6e4a22;
  if (e === 1) return (z === 8 && (x === y || x === 9 - y)) ? 0x6e4a22 : 0xc1904b;
  return null;
});
def('rock', 16, 14, 8, (x, y, z) => {
  const n = noise3(x, y, z), d = Math.hypot((x - 7.5) / 7.5, (y - 6.5) / 6.5, z / 7.5);
  return d < 0.82 + n * 0.2 ? (n > .6 ? 0xa3a6b3 : 0x80838f) : null;
});
def('tower', 14, 14, 30, (x, y, z) => {
  const d = Math.hypot(x - 6.5, y - 6.5);
  if (z >= 26) return d < (30 - z) * 1.5 ? 0xd8363e : null;                                   // cap
  if (z >= 22) return d < 6.8 && d > 4.6 ? ((x + y) % 4 < 2 ? 0xffe27a : 0x33363f) : (d <= 4.6 && z === 22 ? 0x55585f : null); // lantern
  const r = 6.2 - z * 0.09;
  if (d < r && d > r - 1.6) return Math.floor(z / 5) % 2 ? 0xd8363e : 0xf4f1e6;               // striped shell
  return null;
});

def('barn', 28, 20, 18, (x, y, z) => {
  if (z <= 9) {
    if (!(x === 0 || x === 27 || y === 0 || y === 19)) return z === 0 ? 0x6b5a48 : null;
    if ((x === 0 || x === 27) && (y === 0 || y === 19)) return 0xf4f1e6;
    if (y === 19 && x >= 9 && x <= 18 && z < 8) return (x === 9 || x === 18 || z === 7 || x - 9 === z || 18 - x === z) ? 0xf4f1e6 : 0x6e2018;
    return z === 9 ? 0xf4f1e6 : (x + y) % 4 === 0 ? 0x962a22 : 0xa8322a;
  }
  const inset = Math.floor((z - 10) * 1.75);
  return x >= inset && x <= 27 - inset ? (y % 4 === 0 ? 0x5d616b : 0x767b87) : null;
});
def('stand', 36, 14, 12, (x, y, z) => {                                             // grandstand, seats facing +y
  const top = Math.floor(2 + (13 - y) * 0.72);
  if (z > top) return null;
  if (z === top && y > 0) { const n = noise3(x, y, 7); return x % 9 === 0 ? 0x70737d : [0xd8363e, 0x3d7dd8, 0xffd257, 0xf4f1e6, 0xe9b48a, 0x3f9a5b][n * 6 | 0]; }
  return y === 0 || x === 0 || x === 35 ? 0x80838f : 0x9a9ca6;
});
def('arch', 56, 5, 16, (x, y, z) => {                                               // start gantry: cars drive under the beam
  if (x <= 2 || x >= 53) return z % 4 < 2 ? 0x33363f : 0xd8363e;
  if (z >= 12) return ((x >> 1) + (z >> 1)) & 1 ? 0x1b1b22 : 0xf4f1e6;
  return null;
});
def('lamp', 5, 5, 18, (x, y, z) => {
  if (z <= 15) return x === 2 && y === 2 ? (z < 2 ? 0x33363f : 0x70737d) : (z === 15 && x === 4 && y === 2 ? 0xffe9a0 : null);
  return z === 16 && y === 2 && x >= 2 ? 0x70737d : null;
});
def('tires', 7, 7, 7, (x, y, z) => { const d = Math.hypot(x - 3, y - 3); return d > 1.4 && d < 3.5 ? (z >= 5 ? ((x + y) & 1 ? 0xd8363e : 0xf4f1e6) : z % 2 ? 0x16161c : 0x2a2a33) : null; });
def('bale', 9, 8, 7, (x, y, z) => Math.hypot(y - 3.5, z - 3.2) < 3.8 ? (x === 2 || x === 6 ? 0xa8842f : noise3(x, y, z) > .5 ? 0xe3c35a : 0xd0ad45) : null);
def('bush', 10, 10, 6, (x, y, z) => {
  const n = noise3(x, y, z);
  return Math.hypot((x - 4.5) / 5, (y - 4.5) / 5, z / 6) < 0.8 + n * 0.25 ? (n > .93 ? 0xff8fb0 : n > .5 ? 0x4fae45 : 0x2f8a3c) : null;
});
def('post', 3, 3, 7, (x, y, z) => z === 6 ? 0xb08a5a : 0x7a5a36);

// ---------- track: a closed spline, resampled every STEP px so distance along it is just an index ----------
const WORLD = 1100, MID = WORLD / 2, STEP = 4, ROAD_HALF = 20;
const TRACK = (() => {
  const P = [[190, 300], [330, 150], [560, 190], [700, 330], [880, 220], [980, 400], [900, 600], [960, 820], [760, 950], [600, 800], [430, 930], [220, 880], [150, 680], [330, 540], [170, 440]];
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const dense = [], n = P.length;
  for (let i = 0; i < n; i++) for (let s = 0; s < 40; s++) {
    const [a, b, c, d] = [-1, 0, 1, 2].map(k => P[(i + k + n) % n]);
    dense.push([cr(a[0], b[0], c[0], d[0], s / 40), cr(a[1], b[1], c[1], d[1], s / 40)]);
  }
  const out = []; let carry = 0;
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (; carry <= len; carry += STEP) out.push({ x: a[0] + (b[0] - a[0]) * carry / len, y: a[1] + (b[1] - a[1]) * carry / len });
    carry -= len;
  }
  out.forEach((p, i) => {
    const a = out[(i - 1 + out.length) % out.length], b = out[(i + 1) % out.length], l = Math.hypot(b.x - a.x, b.y - a.y);
    p.tx = (b.x - a.x) / l; p.ty = (b.y - a.y) / l;
  });
  out.forEach((p, i) => { const q = out[(i + 10) % out.length]; p.bend = p.tx * q.ty - p.ty * q.tx; }); // >0 turns towards +normal
  return out;
})();
// Position `lane` px to the side of the centre line, `d` px along the track. The normal is (-ty, tx).
function trackAt(d, lane) {
  const n = TRACK.length, f = ((d / STEP) % n + n) % n, i = f | 0, u = f - i, a = TRACK[i], b = TRACK[(i + 1) % n];
  const tx = a.tx + (b.tx - a.tx) * u, ty = a.ty + (b.ty - a.ty) * u;
  return { x: a.x + (b.x - a.x) * u - ty * lane, y: a.y + (b.y - a.y) * u + tx * lane, heading: Math.atan2(ty, tx) };
}
function trackDist(x, y) {
  let best = 1e9;
  for (const p of TRACK) { const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y); if (d < best) best = d; }
  return Math.sqrt(best);
}
const LAKE = { x: 530, y: 520, rx: 115, ry: 85 };
const riverY = x => 520 + Math.sin(x / 60) * 16;
const isWater = (x, y, m = 0) => Math.hypot((x - LAKE.x) / (LAKE.rx + m), (y - LAKE.y) / (LAKE.ry + m)) < 1 || (x > 600 && Math.abs(y - riverY(x)) < 13 + m);
const FIELDS = [[385, 265, 215, 130, 0], [690, 650, 170, 150, 1]];
const inField = (x, y) => FIELDS.find(f => x > f[0] + 6 && y > f[1] + 6 && x < f[0] + f[2] - 6 && y < f[1] + f[3] - 6);
const forest = (x, y) => Math.sin(x * 0.011 + 1.3) + Math.sin(y * 0.013 + 0.5) + Math.sin((x + y) * 0.007);

function makeGround() {
  const ground = mkCanvas(WORLD, WORLD), g = ground.getContext('2d'), r = mulberry32(3), n = TRACK.length;
  g.fillStyle = '#4c9a4a'; g.fillRect(0, 0, WORLD, WORLD);
  for (let y = 0; y < WORLD; y += 4) for (let x = 0; x < WORLD; x += 4) {             // darker floor under the woods, pale dry meadows
    const f = forest(x, y);
    if (f > 0.7) { g.fillStyle = 'rgba(18,70,40,.35)'; g.fillRect(x, y, 4, 4); } else if (f < -1.2) { g.fillStyle = 'rgba(190,200,90,.22)'; g.fillRect(x, y, 4, 4); }
  }
  for (let i = 0; i < 16000; i++) { g.fillStyle = ['#458f45', '#57a852', '#3f8642', '#62b35a'][i & 3]; g.fillRect(r() * WORLD | 0, r() * WORLD | 0, 2, 1); }
  for (let i = 0; i < 1400; i++) { g.fillStyle = ['#f4f1e6', '#ffe27a', '#ff8fb0', '#b9a3ff'][i & 3]; g.fillRect(r() * WORLD | 0, r() * WORLD | 0, 1, 1); }
  for (const [x, y, w, h, kind] of FIELDS) {                                          // a ploughed field and a wheat field
    g.fillStyle = kind ? '#d9b84a' : '#8a6a3c'; g.fillRect(x, y, w, h);
    g.fillStyle = kind ? '#c4a23a' : '#75582f';
    for (let i = 3; i < (kind ? w : h); i += 6) kind ? g.fillRect(x + i, y, 2, h) : g.fillRect(x, y + i, w, 2);
    g.strokeStyle = '#6e5a3a'; g.lineWidth = 2; g.strokeRect(x, y, w, h);
  }
  const river = w => { g.lineWidth = w; g.beginPath(); for (let x = 600; x <= WORLD + 10; x += 6) g.lineTo(x, riverY(x)); g.stroke(); };
  const lake = (grow, fill) => { g.fillStyle = fill; g.beginPath(); g.ellipse(LAKE.x, LAKE.y, LAKE.rx + grow, LAKE.ry + grow, 0, 0, 7); g.fill(); };
  g.lineCap = 'round'; g.strokeStyle = '#d9c88f'; river(34); lake(5, '#d9c88f');
  g.strokeStyle = '#3d7dd8'; river(26); lake(0, '#3d7dd8'); lake(-22, '#4a8be6');
  for (let i = 0; i < 260; i++) { const x = r() * WORLD, y = r() * WORLD; if (isWater(x, y, -4)) { g.fillStyle = '#8fc0ff'; g.fillRect(x | 0, y | 0, 3, 1); } }
  g.fillStyle = '#d9c88f'; g.beginPath(); g.ellipse(LAKE.x, LAKE.y - 2, 16, 11, 0, 0, 7); g.fill();
  // road: sandy verge, red/white kerbs on the bends, asphalt, centre line
  const path = () => { g.beginPath(); TRACK.forEach(p => g.lineTo(p.x, p.y)); g.closePath(); };
  g.lineCap = 'butt'; g.lineJoin = 'round';
  path(); g.lineWidth = 52; g.strokeStyle = '#c9b48a'; g.stroke();
  g.lineWidth = 50;
  TRACK.forEach((p, i) => { if (Math.abs(p.bend) < 0.22) return; const q = TRACK[(i + 1) % n]; g.strokeStyle = (i >> 2) & 1 ? '#d8363e' : '#f4f1e6'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); });
  path(); g.lineWidth = ROAD_HALF * 2; g.strokeStyle = '#50535e'; g.stroke();
  for (let i = 0; i < 5000; i++) { const p = TRACK[r() * n | 0], o = (r() - .5) * 34; g.fillStyle = r() > .5 ? '#474a54' : '#595c68'; g.fillRect(p.x - p.ty * o | 0, p.y + p.tx * o | 0, 2, 1); }
  TRACK.forEach((p, i) => {                                                          // timber bridge where the road crosses the river
    if (!isWater(p.x, p.y, 5)) return;
    const q = TRACK[(i + 1) % n]; g.lineWidth = 46; g.strokeStyle = i & 1 ? '#8d6b45' : '#7d5d3a'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke();
  });
  path(); g.lineWidth = 2; g.setLineDash([10, 10]); g.strokeStyle = '#e9e2c8'; g.stroke(); g.setLineDash([]);
  const s = TRACK[0];                                                                // chequered start line
  for (let a = -5; a < 5; a++) for (let b = 0; b < 2; b++) {
    g.fillStyle = (a + b) & 1 ? '#f4f1e6' : '#1b1b22';
    g.beginPath(); g.arc(s.x - s.ty * (a * 4 + 2) + s.tx * (b * 4 - 2), s.y + s.tx * (a * 4 + 2) + s.ty * (b * 4 - 2), 2.6, 0, 7); g.fill();
  }
  return ground;
}

function makeWorld(MODELS) {
  const objects = [], r = mulberry32(11), n = TRACK.length;
  const clear = (x, y, rad) => !objects.some(o => !o.ghost && Math.hypot(o.x - x, o.y - y) < o.rad + rad);
  const put = (kind, x, y, rot, extra) => { const m = MODELS[kind], o = { m, x, y, rot, rad: Math.max(m.W, m.L) * 0.5, ...extra }; objects.push(o); return o; };
  const beside = (i, off) => { const p = TRACK[(i + n) % n]; return { x: p.x - p.ty * off, y: p.y + p.tx * off, facing: Math.atan2(-p.tx * Math.sign(off), p.ty * Math.sign(off)) - Math.PI / 2 }; };
  const head = i => Math.atan2(TRACK[i].ty, TRACK[i].tx);

  put('arch', TRACK[0].x, TRACK[0].y, head(0) + Math.PI / 2, { ghost: true, rad: 0 });
  { const p = beside(24, -52); put('stand', p.x, p.y, p.facing, { rad: 16 }); }
  put('tower', LAKE.x, LAKE.y - 4, 0, { rad: 8 });
  for (let i = 0; i < n; i++) {
    const p = TRACK[i], water = isWater(p.x, p.y, 5);
    if (water && i % 3 === 0) for (const side of [-24, 24]) { const q = beside(i, side); put('post', q.x, q.y, head(i), { rad: 2 }); }
    if (!water && Math.abs(p.bend) > 0.3 && i % 2 === 0) { const q = beside(i, p.bend > 0 ? -30 : 30); put('tires', q.x, q.y, 0, { rad: 4 }); }  // outside of the bend
    if (!water && i % 28 === 14) { const q = beside(i, (i / 28 | 0) % 2 ? 29 : -29); if (clear(q.x, q.y, 6)) put('lamp', q.x, q.y, q.facing + Math.PI / 2, { rad: 2 }); }
    if (i % 46 === 30 && r() < 0.75) {                                                 // houses line the road, doors facing it
      const q = beside(i, (r() < 0.5 ? -1 : 1) * (58 + r() * 14));
      if (!isWater(q.x, q.y, 22) && !inField(q.x, q.y) && trackDist(q.x, q.y) > 46 && clear(q.x, q.y, 18)) put('house', q.x, q.y, q.facing + (r() - .5) * .2, { rad: 15 });
    }
  }
  for (const [x, y] of [[352, 330], [660, 640], [470, 240]]) if (trackDist(x, y) > 50 && clear(x, y, 18)) { put('barn', x, y, (r() * 4 | 0) * Math.PI / 2, { rad: 16 }); }
  for (let tries = 0; tries < 9000 && objects.length < 520; tries++) {                // woods, meadows and farmland
    const x = 20 + r() * (WORLD - 40), y = 20 + r() * (WORLD - 40), f = forest(x, y), u = r();
    let kind = null;
    if (inField(x, y)) kind = inField(x, y)[4] === 0 && u < 0.12 ? 'bale' : null;
    else if (f > 0.7) kind = u < 0.82 ? 'pine' : u < 0.9 ? 'rock' : 'bush';
    else if (f > -1.2) kind = u < 0.1 ? 'tree' : u < 0.16 ? 'bush' : u < 0.19 ? 'rock' : u < 0.2 ? 'crate' : null;
    else kind = u < 0.05 ? 'bush' : u < 0.07 ? 'rock' : null;
    if (!kind) continue;
    const m = MODELS[kind], rad = Math.max(m.W, m.L) * 0.42;
    if (trackDist(x, y) < ROAD_HALF + 12 + rad || isWater(x, y, rad + 4) || !clear(x, y, rad)) continue;
    put(kind, x, y, r() * 6.28, { rad });
  }
  const lap = n * STEP;
  ['taxi', 'van', 'truck', 'police', 'taxi'].forEach((k, i) => put(k, 0, 0, 0, { auto: lap * (0.12 + i * 0.19), speed: 78, lane: 9, rad: 14 }));
  const player = put('car', 0, 0, 0, { auto: 30, speed: 150, lane: -9, heading: 0, vel: 0, manual: false, rad: 14 });
  for (const o of objects) if (o.auto != null) Object.assign(o, trackAt(o.auto, o.lane));
  return { objects, player };
}

// ---------- input + UI glue ----------
const keys = {};
const $ = id => document.getElementById(id);
function bindInput(scene, cam, player) {
  addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (/^(arrow|[wasd]$)/.test(e.key.toLowerCase())) { player.manual = true; e.preventDefault(); } });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  let drag = null;
  scene.addEventListener('pointerdown', e => { drag = e.clientX; scene.setPointerCapture(e.pointerId); });
  scene.addEventListener('pointermove', e => { if (drag != null) { cam.a += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  ['pointerup', 'pointercancel'].forEach(t => scene.addEventListener(t, () => drag = null));
  // on-screen driving pad (touch): each button just holds down the matching key
  document.querySelectorAll('#pad button').forEach(b => {
    const set = on => e => { e.preventDefault(); keys[b.dataset.k] = on; b.classList.toggle('down', on); if (on) player.manual = true; };
    b.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, set(false)));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
}
const bindRange = (id, fmt, set) => { const el = $(id), f = () => { set(+el.value); $(id + 'V').textContent = fmt(+el.value); }; el.addEventListener('input', f); f(); };
const bindToggles = (opt, names) => names.forEach(k => $(k).addEventListener('click', e => { opt[k] = !opt[k]; e.target.classList.toggle('on', opt[k]); }));
function buildPicker(onSelect) {
  const pick = name => { [...$('picker').children].forEach(b => b.classList.toggle('on', b.textContent === name)); onSelect(name); };
  PICKABLE.forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => pick(n); $('picker').append(b); });
  pick(PICKABLE[0]);
}

// ---------- simulation ----------
function updateWorld(dt, objects, player, cam, opt) {
  if (keys.q) cam.a -= 1.8 * dt;
  if (keys.e) cam.a += 1.8 * dt;
  if (opt.orbit) cam.a += 0.35 * dt;
  for (const o of objects) {
    if (o.auto == null || o.manual) continue;
    o.auto += o.speed * dt;
    Object.assign(o, trackAt(o.auto, o.lane));
  }
  if (player.manual) {
    const up = keys.w || keys.arrowup, dn = keys.s || keys.arrowdown, lf = keys.a || keys.arrowleft, rt = keys.d || keys.arrowright;
    const onRoad = trackDist(player.x, player.y) < ROAD_HALF + 3;
    player.vel += ((up ? 280 : 0) - (dn ? 200 : 0)) * dt;
    player.vel *= Math.pow(onRoad ? 0.35 : 0.07, dt);
    player.heading += ((rt ? 1 : 0) - (lf ? 1 : 0)) * 2.6 * dt * Math.max(-1, Math.min(1, player.vel / 60));
    const nx = player.x + Math.cos(player.heading) * player.vel * dt, ny = player.y + Math.sin(player.heading) * player.vel * dt;
    const hit = objects.some(o => o !== player && !o.ghost && Math.hypot(o.x - nx, o.y - ny) < o.rad * 0.8 + 7);
    if (hit || nx < 10 || ny < 10 || nx > WORLD - 10 || ny > WORLD - 10) player.vel *= -0.3;
    else { player.x = nx; player.y = ny; }
  }
  for (const o of objects) if (o.heading != null) o.rot = o.heading - Math.PI / 2; // car sprites face +y
  cam.x += (player.x - cam.x) * Math.min(1, 5 * dt); cam.y += (player.y - cam.y) * Math.min(1, 5 * dt);
}
