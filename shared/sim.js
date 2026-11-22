'use strict';
// Shared by every renderer page: model definitions, the two worlds, input and simulation.
// ---------- helpers ----------
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const noise3 = (x, y, z) => { let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 | 0, 1274126177); h ^= h >>> 13; return ((Math.imul(h, 1274126177) >>> 0) % 1000) / 1000; };
const $ = id => document.getElementById(id);
const WORLD_ID = new URLSearchParams(location.search).get('world') === 'paris' ? 'paris' : 'country';

// ---------- models: each is a function (x,y,z) -> colour (or null for empty) on a W x L x H grid ----------
const MODEL_DEFS = {};
const def = (name, W, L, H, fn, only) => { if (!only || only === WORLD_ID) MODEL_DEFS[name] = { name, W, L, H, fn }; };

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


// ----- Paris -----
def('eiffel', 96, 96, 120, (x, y, z) => {                                          // four legs, two platforms, lattice shaft; the road runs underneath
  const ax = Math.abs(x - 47.5), ay = Math.abs(y - 47.5), mx = Math.max(ax, ay), mn = Math.min(ax, ay);
  const hw = 3 + 45 * Math.exp(-z / 26), IRON = ((x + y + z) & 1) ? 0x7a6652 : 0x6b5947, PLATE = 0x5a4c3f;
  if (z >= 112) return mx < 1 ? 0x4a3f35 : null;
  if ((z >= 104 && z < 108) || z === 28 || z === 29 || z === 58 || z === 59) return mx < hw + 1.5 ? PLATE : null;
  if (mx > hw) return null;
  if (z < 28) { const open = 27 * Math.sqrt(Math.max(0, 1 - (z / 27) * (z / 27))); return mn >= open && mx > hw - 9 ? IRON : null; }
  if (mx <= hw - 2.2) return null;
  if (mn > hw - 2.2) return IRON;
  const u = Math.round(mn);
  return (u + z) % 4 === 0 || (u - z + 400) % 4 === 0 ? IRON : null;
}, 'paris');
def('arc', 40, 20, 30, (x, y, z) => {
  const dx = Math.abs(x - 19.5), dy = Math.abs(y - 9.5);
  if (z >= 24) return z === 24 || z === 29 ? 0xcfc4a4 : (x + y) % 5 === 0 ? 0xd9cfb2 : 0xe9dfc3;
  if (dx < 8 && z < 13 + Math.sqrt(64 - dx * dx)) return null;                       // the great arch
  if (dy < 4 && dx >= 8 && z < 8 + Math.sqrt(16 - dy * dy)) return null;             // side arches
  return z === 23 || z === 0 ? 0xcfc4a4 : noise3(x, y, z) > .85 ? 0xd4c9aa : 0xe9dfc3;
}, 'paris');
def('pyramid', 34, 34, 17, (x, y, z) => {
  const m = Math.max(Math.abs(x - 16.5), Math.abs(y - 16.5)), half = 17 - z;
  return m < half && m > half - 1.3 ? (x % 4 === 0 || y % 4 === 0 ? 0x7f9aa8 : 0xb4e2f2) : null;
}, 'paris');
def('notredame', 20, 46, 34, (x, y, z) => {                                         // towers at +y
  const ax = Math.abs(x - 9.5), S = 0xd8cfb8, S2 = 0xc4baa0;
  if (y >= 36) {
    if (z < 20) {
      if (y === 45 && ax < 2.5 && Math.hypot(ax, z - 13) < 2.6) return 0x5b7fd0;     // rose window
      if (y === 45 && z < 6 && (ax < 1.5 || Math.abs(ax - 6) < 1.2)) return 0x4a3a2a; // portals
      return z === 19 || z === 9 ? S2 : S;
    }
    if (ax > 2.5 && z < 31) return z >= 22 && z <= 28 && Math.abs(ax - 6) < 1 ? 0x3a3f4a : z === 30 ? S2 : S;
    return null;
  }
  if (z < 15) {
    if (ax < 6.5 || (y >= 14 && y <= 19)) return ax > 5.5 && y % 4 === 1 && z > 5 && z < 12 ? 0x5b7fd0 : S; // nave + transept
    return y % 6 === 2 && z < 12 - (ax - 6.5) * 2 ? S2 : null;                       // flying buttresses
  }
  if (z < 22) return ax < 6.5 - (z - 15) ? ((y & 1) ? 0x6f8d86 : 0x5f7d78) : null;
  return y >= 16 && y <= 17 && ax < 1 ? 0x4f6b66 : null;                              // spire
}, 'paris');
// Haussmann block: shopfronts and awning at street level, iron balconies, mansard roof. Front is +y.
const hausFn = (W, awn) => (x, y, z) => {
  const L = 22, ex = x === 0 || x === W - 1, ey = y === 0 || y === L - 1, u = ex ? y : x, STONE = 0xe9dfc3, BASE = 0xcbbf9f;
  if (z <= 14) {
    if (!ex && !ey) return z === 0 ? 0x8a8478 : null;
    if (z <= 2) return y === L - 1 ? (u % 8 === 3 || u % 8 === 4 ? 0x3a2f28 : u % 8 === 0 ? BASE : 0x2c3a44) : BASE;
    if (z === 3) return y === L - 1 ? ((u >> 1) & 1 ? awn : 0xf4f1e6) : BASE;
    if (z === 4 || z === 10) return 0x33363f;
    if (z === 14) return 0xd4c8a8;
    return (u % 4 === 1 || u % 4 === 2) && z % 3 !== 1 ? 0x4d6072 : STONE;
  }
  if (z <= 19) {
    const k = z - 14, ins = Math.round(k * 0.8);
    if (x < ins || y < ins || x > W - 1 - ins || y > L - 1 - ins) return null;
    if (z === 19) return 0x8a97a3;
    if (!(x === ins || y === ins || x === W - 1 - ins || y === L - 1 - ins)) return null;
    return k === 2 && ((x === ins || x === W - 1 - ins) ? y : x) % 4 === 2 ? 0xf0e6c8 : (x + y + z) & 1 ? 0x5a6b7a : 0x4f5f6d;
  }
  return (x === 4 || x === W - 5) && (y === 6 || y === 15) ? 0xb5593c : null;         // chimney pots
};
def('haus', 26, 22, 22, hausFn(26, 0xc8343c), 'paris');
def('hausb', 34, 22, 22, hausFn(34, 0x2f7d56), 'paris');
def('hausc', 22, 22, 22, hausFn(22, 0x2f5fae), 'paris');
def('plane', 14, 14, 18, (x, y, z) => {
  const d = Math.hypot(x - 6.5, y - 6.5), n = noise3(x, y, z);
  if (z < 9 && d < 1.4) return z % 3 === 0 ? 0xa89878 : 0xc2b494;
  return z >= 7 && Math.hypot(x - 6.5, y - 6.5, (z - 12) * 1.25) < 6.2 + n * .8 ? (n > .6 ? 0x8fd06a : n > .25 ? 0x6bb654 : 0x4f9a48) : null;
}, 'paris');
def('column', 6, 6, 14, (x, y, z) => {                                              // Morris column
  const d = Math.hypot(x - 2.5, y - 2.5), G = 0x2f5d48;
  if (z <= 1 || z === 10) return d < 3.1 ? G : null;
  if (z < 10) return d < 2.6 ? [0xd8363e, 0xffd257, 0xf4f1e6, 0x3d7dd8][(((Math.atan2(y - 2.5, x - 2.5) + 3.2) * 1.3 | 0) + (z > 5 ? 1 : 0)) % 4] : null;
  return d < 3 - (z - 10) * 0.9 ? G : null;
}, 'paris');
def('fountain', 18, 18, 7, (x, y, z) => {
  const d = Math.hypot(x - 8.5, y - 8.5), S = 0xd8cfb8;
  if (d < 1.5) return S;
  if (z <= 2 && d < 8.5 && d >= 7) return S;
  if (d < 7 && z <= 1) return z ? 0x6fb7e0 : 0xb9b2a4;
  if (z === 4 && d < 4) return S;
  return z === 5 && d < 3.4 ? 0x6fb7e0 : null;
}, 'paris');
def('boat', 10, 40, 6, (x, y, z) => {                                               // river cruiser, bow at +y
  const ax = Math.abs(x - 4.5), hw = y < 2 ? 3.6 : y < 28 ? 4.6 : 4.6 - (y - 28) * 0.36;
  if (z <= 2) return ax < hw ? (z === 0 ? 0x2a4a7a : z === 1 ? 0xf4f1e6 : 0xb08a5a) : null;
  if (y < 6 || y > 30 || ax > 3.6) return null;
  if (z === 5) return ax < 1 ? 0xd8363e : 0xf4f1e6;
  return ax > 2.6 || y === 6 || y === 30 ? (y % 4 === 2 ? 0xf4f1e6 : 0x9fd8ff) : null;
}, 'paris');
def('bollard', 3, 3, 5, (x, y, z) => z === 4 ? 0xd8cfb8 : 0xb9b2a4, 'paris');

// ---------- world definitions ----------
const WORLD = 1100, MID = WORLD / 2, STEP = 4, ROAD_HALF = 20;
// countryside
const LAKE = { x: 530, y: 520, rx: 115, ry: 85 };
const riverY = x => 520 + Math.sin(x / 60) * 16;
const FIELDS = [[385, 265, 215, 130, 0], [690, 650, 170, 150, 1]];
const inField = (x, y) => FIELDS.find(f => x > f[0] + 6 && y > f[1] + 6 && x < f[0] + f[2] - 6 && y < f[1] + f[3] - 6);
const forest = (x, y) => Math.sin(x * 0.011 + 1.3) + Math.sin(y * 0.013 + 0.5) + Math.sin((x + y) * 0.007);
// Paris
const seineY = x => 560 + Math.sin(x / 260 + 0.5) * 50;
const ISLE = { x: 590, y: seineY(590), rx: 72, ry: 18 };
const onIsle = (x, y, grow = 0) => Math.hypot((x - ISLE.x) / Math.max(1, ISLE.rx + grow), (y - ISLE.y) / Math.max(1, ISLE.ry + grow)) < 1;
const PARKS = [[205, 668, 90, 110], [540, 690, 200, 140], [420, 290, 180, 110]];
const PLAZA = [640, 278, 120, 115], ETOILE = { x: 230, y: 220 }, EIFFEL = { x: 250, y: 830 }, EXTRA_BRIDGES = [420, 760];
const inRect = (r, x, y, m) => x > r[0] - m && y > r[1] - m && x < r[0] + r[2] + m && y < r[1] + r[3] + m;
const cityBlocked = (x, y, m) => PARKS.some(p => inRect(p, x, y, m)) || inRect(PLAZA, x, y, m) || Math.hypot(x - ETOILE.x, y - ETOILE.y) < 64 + m ||
  (Math.abs(x - EIFFEL.x) < 62 + m && Math.abs(y - EIFFEL.y) < 62 + m) || onIsle(x, y, m);

const WORLD_DEFS = {
  country: {
    name: 'Countryside', bg: '#2b6a4a', base: '#4c9a4a',
    points: [[190, 300], [330, 150], [560, 190], [700, 330], [880, 220], [980, 400], [900, 600], [960, 820], [760, 950], [600, 800], [430, 930], [220, 880], [150, 680], [330, 540], [170, 440]],
    pickable: ['car', 'taxi', 'van', 'truck', 'police', 'house', 'barn', 'tree', 'tower', 'stand', 'arch'],
    road: { verge: '#c9b48a', vergeW: 52, kerbs: true, asphalt: '#50535e', bridge: ['#8d6b45', '#7d5d3a'], bridgeW: 46, bridgeOver: true, startLine: true },
    water: (x, y, m = 0) => Math.hypot((x - LAKE.x) / (LAKE.rx + m), (y - LAKE.y) / (LAKE.ry + m)) < 1 || (x > 600 && Math.abs(y - riverY(x)) < 13 + m),
    ground(g, r) {
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
    },
    traffic: ['taxi', 'van', 'truck', 'police', 'taxi'],
    populate({ put, clear, beside, head, r, n }) {
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
      for (let tries = 0, count = 0; tries < 9000 && count < 420; tries++) {              // woods, meadows and farmland
        const x = 20 + r() * (WORLD - 40), y = 20 + r() * (WORLD - 40), f = forest(x, y), u = r();
        let kind = null;
        if (inField(x, y)) kind = inField(x, y)[4] === 0 && u < 0.12 ? 'bale' : null;
        else if (f > 0.7) kind = u < 0.82 ? 'pine' : u < 0.9 ? 'rock' : 'bush';
        else if (f > -1.2) kind = u < 0.1 ? 'tree' : u < 0.16 ? 'bush' : u < 0.19 ? 'rock' : u < 0.2 ? 'crate' : null;
        else kind = u < 0.05 ? 'bush' : u < 0.07 ? 'rock' : null;
        if (!kind) continue;
        const m = MODEL_DEFS[kind], rad = Math.max(m.W, m.L) * 0.42;
        if (trackDist(x, y) < ROAD_HALF + 12 + rad || isWater(x, y, rad + 4) || !clear(x, y, rad)) continue;
        put(kind, x, y, r() * 6.28, { rad }); count++;
      }
    },
  },
  paris: {
    name: 'Paris', bg: '#8f8a80', base: '#c9c2b2',
    points: [[120, 440], [146, 300], [175, 150], [270, 130], [322, 210], [460, 250], [620, 222], [800, 232], [950, 290], [985, 430], [960, 640], [905, 820], [760, 930], [560, 900], [400, 830], [250, 830], [130, 830], [72, 730], [92, 600]],
    pickable: ['car', 'taxi', 'eiffel', 'arc', 'notredame', 'pyramid', 'haus', 'hausb', 'plane', 'fountain', 'boat'],
    road: { verge: '#ddd6c6', vergeW: 70, kerbs: false, asphalt: '#474a54', bridge: ['#b5ae9f', '#aaa394'], bridgeW: 58, bridgeOver: false, zebra: true },
    water: (x, y, m = 0) => Math.abs(y - seineY(x)) < 40 + m && !onIsle(x, y, -m),
    ground(g, r) {
      for (let i = 0; i < 16000; i++) { g.fillStyle = ['#c2bbab', '#d2cbbb', '#bdb6a6', '#cfc8b8'][i & 3]; g.fillRect(r() * WORLD | 0, r() * WORLD | 0, 2, 2); }
      g.fillStyle = '#a7a39b'; for (let k = 0; k <= WORLD; k += 60) { g.fillRect(k - 4, 0, 8, WORLD); g.fillRect(0, k - 4, WORLD, 8); }   // side streets
      g.strokeStyle = '#a7a39b'; g.lineWidth = 10;                                          // avenues radiating from the Etoile
      for (let a = 0; a < 12; a++) { g.beginPath(); g.moveTo(ETOILE.x, ETOILE.y); g.lineTo(ETOILE.x + Math.cos(a * Math.PI / 6) * 210, ETOILE.y + Math.sin(a * Math.PI / 6) * 210); g.stroke(); }
      g.fillStyle = '#b3ac9e'; g.beginPath(); g.arc(ETOILE.x, ETOILE.y, 66, 0, 7); g.fill();
      g.strokeStyle = '#9d978c'; g.lineWidth = 2; for (const rr of [22, 44, 64]) { g.beginPath(); g.arc(ETOILE.x, ETOILE.y, rr, 0, 7); g.stroke(); }
      for (const [x, y, w, h] of PARKS) {                                                  // gardens with gravel walks
        g.fillStyle = '#d8cfae'; g.fillRect(x - 4, y - 4, w + 8, h + 8);
        g.fillStyle = '#5fa653'; g.fillRect(x, y, w, h);
        for (let i = 0; i < w * h / 12; i++) { g.fillStyle = i & 1 ? '#57a04c' : '#6cb35e'; g.fillRect(x + r() * w | 0, y + r() * h | 0, 2, 1); }
        g.fillStyle = '#d8cfae'; g.fillRect(x + w / 2 - 4, y, 8, h); g.fillRect(x, y + h / 2 - 4, w, 8);
        g.beginPath(); g.arc(x + w / 2, y + h / 2, 16, 0, 7); g.fill();
      }
      g.fillStyle = '#e3dccb'; g.fillRect(...PLAZA); g.strokeStyle = '#cfc7b3'; g.lineWidth = 1;
      for (let k = 0; k <= PLAZA[2]; k += 12) { g.beginPath(); g.moveTo(PLAZA[0] + k, PLAZA[1]); g.lineTo(PLAZA[0] + k, PLAZA[1] + PLAZA[3]); g.stroke(); }
      g.fillStyle = '#b9b2a4'; g.fillRect(EIFFEL.x - 60, EIFFEL.y - 60, 120, 120);
      const seine = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); for (let x = -10; x <= WORLD + 10; x += 6) g.lineTo(x, seineY(x)); g.stroke(); };
      seine(100, '#9d978c'); seine(80, '#3f8793'); seine(52, '#468f9b');
      for (let i = 0; i < 700; i++) { const x = r() * WORLD, y = seineY(x) + (r() - .5) * 70; g.fillStyle = '#7fbcc4'; g.fillRect(x | 0, y | 0, 3, 1); }
      g.fillStyle = '#9d978c'; g.beginPath(); g.ellipse(ISLE.x, ISLE.y, ISLE.rx + 3, ISLE.ry + 3, 0, 0, 7); g.fill();
      g.fillStyle = '#cfc8b8'; g.beginPath(); g.ellipse(ISLE.x, ISLE.y, ISLE.rx, ISLE.ry, 0, 0, 7); g.fill();
      g.fillStyle = '#5fa653'; g.beginPath(); g.ellipse(ISLE.x - 48, ISLE.y, 16, 9, 0, 0, 7); g.fill();
      for (const x of EXTRA_BRIDGES) { g.fillStyle = '#b5ae9f'; g.fillRect(x - 10, seineY(x) - 52, 20, 104); g.fillStyle = '#8f897d'; g.fillRect(x - 10, seineY(x) - 52, 2, 104); g.fillRect(x + 8, seineY(x) - 52, 2, 104); }
    },
    traffic: ['taxi', 'van', 'police', 'taxi', 'truck'],
    populate({ put, clear, beside, head, r, n, blocks }) {
      const near = (x, y) => TRACK.reduce((b, p, i) => { const d = Math.hypot(p.x - x, p.y - y); return d < b[0] ? [d, i] : b; }, [1e9, 0])[1];
      const ei = near(EIFFEL.x, EIFFEL.y), E = TRACK[ei], eh = head(ei);
      put('eiffel', E.x, E.y, eh, { ghost: true, rad: 0 });
      for (const [a, b] of [[-38, -38], [38, -38], [-38, 38], [38, 38]]) blocks.push({ x: E.x + a * Math.cos(eh) - b * Math.sin(eh), y: E.y + a * Math.sin(eh) + b * Math.cos(eh), rad: 13 });
      put('arc', ETOILE.x, ETOILE.y, Math.PI / 2 + 0.15, { rad: 17 });
      put('pyramid', PLAZA[0] + 60, PLAZA[1] + 58, 0, { rad: 17 });
      put('notredame', ISLE.x + 14, ISLE.y, Math.PI / 2, { rad: 14 });
      put('fountain', PARKS[1][0] + 100, PARKS[1][1] + 70, 0, { rad: 9 }); put('fountain', PARKS[2][0] + 90, PARKS[2][1] + 55, 0, { rad: 9 });
      for (const [x, y, w, h] of PARKS) for (let k = 10; k < w; k += 22) for (const yy of [y + 10, y + h - 10]) if (Math.abs(k - w / 2) > 12) put('plane', x + k, yy, r() * 6.28, { rad: 3 });
      const free = (x, y, rad) => !isWater(x, y, rad + 14) && !cityBlocked(x, y, rad) && x > 16 && y > 16 && x < WORLD - 16 && y < WORLD - 16;
      for (let i = 0; i < n; i++) {                                                         // boulevard furniture
        const p = TRACK[i], water = isWater(p.x, p.y, 10);
        if (water) { if (i % 4 === 0) for (const s of [-27, 27]) { const q = beside(i, s); put('bollard', q.x, q.y, head(i), { rad: 2 }); } continue; }
        if (Math.abs(p.x - E.x) < 56 && Math.abs(p.y - E.y) < 56) continue;
        if (i % 12 === 0) for (const s of [-27, 27]) { const q = beside(i, s); if (trackDist(q.x, q.y) > 24 && clear(q.x, q.y, 4)) put('plane', q.x, q.y, r() * 6.28, { rad: 3 }); }
        if (i % 24 === 6) { const q = beside(i, (i / 24 | 0) % 2 ? 25 : -25); if (trackDist(q.x, q.y) > 22 && clear(q.x, q.y, 3)) put('lamp', q.x, q.y, q.facing + Math.PI / 2, { rad: 2 }); }
        if (i % 72 === 42) { const q = beside(i, (i / 72 | 0) % 2 ? -30 : 30); if (trackDist(q.x, q.y) > 26 && clear(q.x, q.y, 4)) put('column', q.x, q.y, 0, { rad: 3 }); }
      }
      const kinds = ['haus', 'hausb', 'hausc', 'haus'];
      for (const side of [-1, 1]) for (let i = 0; i < n;) {                                 // Haussmann blocks lining both sides
        const kind = kinds[r() * 4 | 0], W = MODEL_DEFS[kind].W, q = beside(i, side * 56);
        if (free(q.x, q.y, W / 2) && trackDist(q.x, q.y) > 44 && clear(q.x, q.y, W / 2 - 1)) { put(kind, q.x, q.y, q.facing, { rad: W / 2 }); i += Math.ceil((W + 3) / STEP); } else i += 2;
      }
      for (let cy = 30; cy < WORLD; cy += 60) for (let cx = 30; cx < WORLD; cx += 60) {     // the rest of the city fills the street grid
        const kind = kinds[r() * 4 | 0], W = MODEL_DEFS[kind].W;
        if (r() < 0.86 && free(cx, cy, W / 2 + 4) && trackDist(cx, cy) > 58 && clear(cx, cy, W / 2 + 2)) put(kind, cx, cy, (r() * 4 | 0) * Math.PI / 2, { rad: W / 2 });
      }
      // river boats shuttle between bridges (they are drawn above the ground, so they must not cross one)
      const xs = TRACK.filter(p => isWater(p.x, p.y, 0)).map(p => p.x).concat(EXTRA_BRIDGES).sort((a, b) => a - b), gaps = [];
      for (let i = 0, last = -1e9; i < xs.length; i++) { if (xs[i] - last > 110) gaps.push([last + 50, xs[i] - 50]); last = xs[i]; }
      gaps.filter(gp => gp[0] > 0).forEach((gp, i) => put('boat', (gp[0] + gp[1]) / 2, 0, 0, { boat: { from: gp[0], to: gp[1], dir: i & 1 ? 1 : -1, off: i & 1 ? 29 : -29 }, ghost: true, rad: 0 }));
    },
  },
};
const DEF = WORLD_DEFS[WORLD_ID], PICKABLE = DEF.pickable, isWater = DEF.water;

// ---------- track: a closed spline, resampled every STEP px so distance along it is just an index ----------
const TRACK = (() => {
  const P = DEF.points;
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

function makeGround() {
  const ground = mkCanvas(WORLD, WORLD), g = ground.getContext('2d'), r = mulberry32(3), n = TRACK.length, S = DEF.road;
  g.fillStyle = DEF.base; g.fillRect(0, 0, WORLD, WORLD);
  DEF.ground(g, r);
  const path = () => { g.beginPath(); TRACK.forEach(p => g.lineTo(p.x, p.y)); g.closePath(); };
  const seg = (i, w, c) => { const p = TRACK[i], q = TRACK[(i + 1) % n]; g.lineWidth = w; g.strokeStyle = c; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(q.x, q.y); g.stroke(); };
  const bridge = () => TRACK.forEach((p, i) => { if (isWater(p.x, p.y, 5)) seg(i, S.bridgeW, S.bridge[i & 1]); });
  g.lineCap = 'butt'; g.lineJoin = 'round'; g.setLineDash([]);
  path(); g.lineWidth = S.vergeW; g.strokeStyle = S.verge; g.stroke();
  if (S.kerbs) TRACK.forEach((p, i) => { if (Math.abs(p.bend) >= 0.22) seg(i, 50, (i >> 2) & 1 ? '#d8363e' : '#f4f1e6'); });
  if (!S.bridgeOver) bridge();
  path(); g.lineWidth = ROAD_HALF * 2; g.strokeStyle = S.asphalt; g.stroke();
  for (let i = 0; i < 5000; i++) { const p = TRACK[r() * n | 0], o = (r() - .5) * 34; g.fillStyle = r() > .5 ? '#474a54' : '#595c68'; g.fillRect(p.x - p.ty * o | 0, p.y + p.tx * o | 0, 2, 1); }
  if (S.bridgeOver) bridge();
  path(); g.lineWidth = 2; g.setLineDash([10, 10]); g.strokeStyle = '#e9e2c8'; g.stroke(); g.setLineDash([]);
  if (S.zebra) for (let i = 20; i < n; i += 64) {                                      // pedestrian crossings
    const p = TRACK[i]; g.fillStyle = '#e9e6dc';
    for (let a = -16; a <= 16; a += 6) { g.save(); g.translate(p.x - p.ty * a, p.y + p.tx * a); g.rotate(Math.atan2(p.ty, p.tx)); g.fillRect(-6, -1.5, 12, 3); g.restore(); }
  }
  if (S.startLine) { const s = TRACK[0]; for (let a = -5; a < 5; a++) for (let b = 0; b < 2; b++) {
    g.fillStyle = (a + b) & 1 ? '#f4f1e6' : '#1b1b22';
    g.beginPath(); g.arc(s.x - s.ty * (a * 4 + 2) + s.tx * (b * 4 - 2), s.y + s.tx * (a * 4 + 2) + s.ty * (b * 4 - 2), 2.6, 0, 7); g.fill();
  } }
  return ground;
}

// world state: objects to draw, extra collision circles, the car being driven and (when walking) the person on foot
function makeWorld(MODELS) {
  const objects = [], blocks = [], r = mulberry32(11), n = TRACK.length;
  const clear = (x, y, rad) => !objects.some(o => !o.ghost && Math.hypot(o.x - x, o.y - y) < o.rad + rad);
  const put = (kind, x, y, rot, extra) => { const m = MODELS[kind], o = { m, x, y, rot, rad: Math.max(m.W, m.L) * 0.5, ...extra }; objects.push(o); return o; };
  const beside = (i, off) => { const p = TRACK[(i + n) % n]; return { x: p.x - p.ty * off, y: p.y + p.tx * off, facing: Math.atan2(-p.tx * Math.sign(off), p.ty * Math.sign(off)) - Math.PI / 2 }; };
  const head = i => Math.atan2(TRACK[i].ty, TRACK[i].tx);
  DEF.populate({ put, clear, beside, head, r, n, blocks });
  const lap = n * STEP, car = { car: true, vel: 0, heading: 0, manual: false, rad: 14 };
  DEF.traffic.forEach((k, i) => put(k, 0, 0, 0, { ...car, auto: lap * (0.12 + i * 0.19), speed: 78, lane: 9 }));
  const player = put('car', 0, 0, 0, { ...car, auto: 30, speed: 150, lane: -9 });
  for (const o of objects) if (o.auto != null) Object.assign(o, trackAt(o.auto, o.lane));
  return { objects, blocks, player, foot: null };
}

// ---------- first-person constants (shared so both renderers frame the same view) ----------
const FP = { eye: 9, focal: 274, near: 2, far: 620, fog0: 160, fog: [207, 230, 242], sky: '#cfe6f2' };

// ---------- getting in and out ----------
const solidAt = (world, x, y, pad, skip) => world.objects.some(o => o !== skip && !o.ghost && Math.hypot(o.x - x, o.y - y) < o.rad * 0.8 + pad) || world.blocks.some(b => Math.hypot(b.x - x, b.y - y) < b.rad + pad);
const nearestCar = world => world.foot && world.objects.filter(o => o.car).map(o => [Math.hypot(o.x - world.foot.x, o.y - world.foot.y), o]).filter(e => e[0] < 30).sort((a, b) => a[0] - b[0]).map(e => e[1])[0];
function act(world) {
  if (!world.foot) {                                               // step out of the driver's door (or the other side if that is blocked)
    const c = world.player, h = c.heading;
    c.manual = true; c.vel = 0;
    const spot = [16, -16, 24, -24].map(d => ({ x: c.x + Math.sin(h) * d, y: c.y - Math.cos(h) * d })).find(p => !solidAt(world, p.x, p.y, 3, c)) || { x: c.x + Math.sin(h) * 16, y: c.y - Math.cos(h) * 16 };
    world.foot = { x: spot.x, y: spot.y, yaw: h };
  } else {
    const c = nearestCar(world);
    if (!c) return;
    if (!c.manual) { c.vel = c.speed; c.manual = true; }           // jumping into moving traffic keeps its momentum
    world.player = c; world.foot = null;
  }
}

// ---------- input + UI glue ----------
const keys = {};
function bindInput(scene, cam, world) {
  addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((k === 'f' || k === 'enter') && !e.repeat) { act(world); e.preventDefault(); return; }
    keys[k] = true;
    if (/^(arrow|[wasd]$)/.test(k)) { world.player.manual = true; e.preventDefault(); }
  });
  addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
  let drag = null;
  scene.addEventListener('pointerdown', e => { drag = e.clientX; scene.setPointerCapture(e.pointerId); });
  scene.addEventListener('pointermove', e => { if (drag == null) return; const d = e.clientX - drag; drag = e.clientX; if (world.foot) world.foot.yaw -= d * 0.007; else cam.a += d * 0.01; });
  ['pointerup', 'pointercancel'].forEach(t => scene.addEventListener(t, () => drag = null));
  // on-screen pad (touch): each button just holds down the matching key
  document.querySelectorAll('#pad button').forEach(b => {
    const set = on => e => { e.preventDefault(); keys[b.dataset.k] = on; b.classList.toggle('down', on); if (on) world.player.manual = true; };
    b.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, set(false)));
    b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('act').addEventListener('click', e => { act(world); e.target.blur(); });
  // header: world switcher, and keep the chosen world when jumping to the other renderer
  $('worlds').innerHTML = Object.entries(WORLD_DEFS).map(([id, d]) => `<a href="?world=${id}"${id === WORLD_ID ? ' class="here"' : ''}>${d.name}</a>`).join('');
  document.querySelectorAll('a.keep').forEach(a => a.href += '?world=' + WORLD_ID);
}
const bindRange = (id, fmt, set) => { const el = $(id), f = () => { set(+el.value); $(id + 'V').textContent = fmt(+el.value); }; el.addEventListener('input', f); f(); };
const bindToggles = (opt, names) => names.forEach(k => $(k).addEventListener('click', e => { opt[k] = !opt[k]; e.target.classList.toggle('on', opt[k]); }));
function buildPicker(onSelect) {
  const pick = name => { [...$('picker').children].forEach(b => b.classList.toggle('on', b.textContent === name)); onSelect(name); };
  PICKABLE.forEach(n => { const b = document.createElement('button'); b.textContent = n; b.onclick = () => pick(n); $('picker').append(b); });
  pick(PICKABLE[0]);
}
// FPS badge + the enter/exit button label. `ms` is the time this frame spent in update + render on the CPU.
const hud = { frames: 0, ms: 0, since: 0, label: '' };
function tickHud(world, now, ms) {
  hud.frames++; hud.ms += ms;
  if (now - hud.since >= 500) { $('fps').textContent = `${Math.round(hud.frames * 1000 / (now - hud.since))} fps · ${(hud.ms / hud.frames).toFixed(1)} ms`; hud.frames = 0; hud.ms = 0; hud.since = now; }
  const label = !world.foot ? 'Get out (F)' : nearestCar(world) ? 'Get in (F)' : 'On foot';
  if (label !== hud.label) { $('act').textContent = hud.label = label; $('act').classList.toggle('on', label === 'Get in (F)'); }
}

// ---------- simulation ----------
function updateWorld(dt, world, cam, opt) {
  const { objects, player, foot } = world;
  const up = keys.w || keys.arrowup, dn = keys.s || keys.arrowdown, lf = keys.a || keys.arrowleft, rt = keys.d || keys.arrowright;
  if (!foot) { if (keys.q) cam.a -= 1.8 * dt; if (keys.e) cam.a += 1.8 * dt; if (opt.orbit) cam.a += 0.35 * dt; }
  for (const o of objects) {
    if (o.boat) {                                                   // ping-pong along the river
      const b = o.boat; o.x += b.dir * 22 * dt;
      if (o.x > b.to) b.dir = -1; else if (o.x < b.from) b.dir = 1;
      o.y = seineY(o.x) + b.off; o.rot = Math.atan2((seineY(o.x + 1) - seineY(o.x)) * b.dir, b.dir) - Math.PI / 2;   // bow is +y
      continue;
    }
    if (o.auto == null || o.manual) continue;
    o.auto += o.speed * dt;
    Object.assign(o, trackAt(o.auto, o.lane));
  }
  if (foot) {                                                       // walking: A/D turn, W/S walk, Q/E sidestep
    foot.yaw += ((rt ? 1 : 0) - (lf ? 1 : 0)) * 2.3 * dt;
    const fwd = ((up ? 1 : 0) - (dn ? 1 : 0)) * 52 * dt, side = ((keys.e ? 1 : 0) - (keys.q ? 1 : 0)) * 40 * dt;
    const mx = Math.cos(foot.yaw) * fwd - Math.sin(foot.yaw) * side, my = Math.sin(foot.yaw) * fwd + Math.cos(foot.yaw) * side;
    const ok = (x, y) => x > 6 && y > 6 && x < WORLD - 6 && y < WORLD - 6 && !solidAt(world, x, y, 3) && !(isWater(x, y, 0) && trackDist(x, y) > ROAD_HALF + 6);
    if (ok(foot.x + mx, foot.y)) foot.x += mx;                      // test each axis on its own so you slide along walls
    if (ok(foot.x, foot.y + my)) foot.y += my;
    player.vel *= Math.pow(0.05, dt);
  }
  for (const c of objects) {                                        // every car you have touched keeps rolling to a stop; the one you sit in takes the keys
    if (!c.car || !c.manual) continue;
    const driving = c === player && !foot;
    if (!driving && Math.abs(c.vel) < 1) { c.vel = 0; continue; }
    const onRoad = trackDist(c.x, c.y) < ROAD_HALF + 3;
    if (driving) {
      c.vel += ((up ? 280 : 0) - (dn ? 200 : 0)) * dt;
      c.heading += ((rt ? 1 : 0) - (lf ? 1 : 0)) * 2.6 * dt * Math.max(-1, Math.min(1, c.vel / 60));
    }
    c.vel *= Math.pow(driving ? (onRoad ? 0.35 : 0.07) : 0.05, dt);
    const nx = c.x + Math.cos(c.heading) * c.vel * dt, ny = c.y + Math.sin(c.heading) * c.vel * dt;
    if (solidAt(world, nx, ny, 7, c) || nx < 10 || ny < 10 || nx > WORLD - 10 || ny > WORLD - 10) c.vel *= -0.3;
    else { c.x = nx; c.y = ny; }
  }
  for (const o of objects) if (o.car) o.rot = o.heading - Math.PI / 2;  // car sprites face +y
  const tx = foot ? foot.x : player.x, ty = foot ? foot.y : player.y;
  cam.x += (tx - cam.x) * Math.min(1, 5 * dt); cam.y += (ty - cam.y) * Math.min(1, 5 * dt);
}
