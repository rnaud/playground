'use strict';
// Voxel Getaway: an original top-down city sandbox on the shared voxel renderer.
// Reuses the car, building, tree and pedestrian models from shared/sim.js and adds its own city, AI and jobs.

// ---------- extra models ----------
const towerFn = (W, L, H, c) => (x, y, z) => {
  const Hm = H - 6, step = Math.floor(Hm * 0.66), ins = c.setback && z > step ? 4 : 0;
  if (z >= Hm) {                                                    // rooftop plant and mast
    if (x >= 6 && x <= 12 && y >= 6 && y <= 11 && z < Hm + 3) return 0x8a8f99;
    return x === W - 8 && y === L - 8 ? (z === H - 1 ? 0xff3040 : 0x33363f) : null;
  }
  if (c.setback && z === step) return 0x70757f;
  if (x < ins || y < ins || x > W - 1 - ins || y > L - 1 - ins) return null;
  if (z === Hm - 1) return 0x70757f;
  const ex = x === ins || x === W - 1 - ins, ey = y === ins || y === L - 1 - ins;
  if (!ex && !ey) return z === 0 ? 0x55585f : null;
  const u = ex ? y : x;
  if (z < 4) return y === L - 1 && Math.abs(x - W / 2) < 3 ? 0x1b1b22 : u % 6 === 0 ? c.frame : 0x2c3a44;   // lobby
  if (z % 4 === 0 || u % 4 === 0) return c.frame;
  return noise3(u >> 2, c.seed + (ex ? 40 : 0) + (x === ins || y === ins ? 0 : 9), z >> 2) > 0.86 ? 0xffe9a0 : (z >> 2) & 1 ? c.glass : c.glass2;
};
def('tower_a', 44, 44, 70, towerFn(44, 44, 70, { frame: 0x9aa7b5, glass: 0x3f6f9e, glass2: 0x4a7dae, seed: 1 }));
def('tower_b', 36, 50, 54, towerFn(36, 50, 54, { frame: 0x33363f, glass: 0x23303d, glass2: 0x2c3b4a, seed: 2 }));
def('tower_c', 50, 36, 40, towerFn(50, 36, 40, { frame: 0xd4c8a8, glass: 0x4d6072, glass2: 0x566a7d, seed: 3 }));
def('tower_d', 34, 34, 86, towerFn(34, 34, 86, { frame: 0xc8ccd6, glass: 0x2f7d7a, glass2: 0x38908c, seed: 4, setback: true }));
const shopFn = (W, sign, wall) => (x, y, z) => {
  const L = 24, e = x === 0 || x === W - 1 || y === 0 || y === L - 1;
  if (z === 7) return 0x8a8f99;
  if (z > 7) return y >= L - 2 && z < 10 ? ((x >> 1) & 1 ? sign : 0xf4f1e6) : null;     // sign board
  if (!e) return z === 0 ? 0x55585f : null;
  if (y === L - 1 && z < 6) return Math.abs(x - W / 2) < 2 ? 0x3a2f28 : x % 7 === 0 ? wall : 0x9fd8ff;
  return z === 6 ? sign : wall;
};
def('shop_r', 30, 24, 10, shopFn(30, 0xd8363e, 0xe9dfc3));
def('shop_g', 30, 24, 10, shopFn(30, 0x3f9a5b, 0xe9dfc3));
def('shop_b', 30, 24, 10, shopFn(30, 0x3d7dd8, 0xd9c9b0));
def('warehouse', 60, 40, 16, (x, y, z) => {
  if (z >= 12) { const ins = (z - 12) * 5; return y >= ins && y <= 39 - ins ? (x % 10 < 2 ? 0xbfe8ff : 0x7d8590) : null; }
  if (!(x === 0 || x === 59 || y === 0 || y === 39)) return z === 0 ? 0x55585f : null;
  if (y === 39 && z < 9 && ((x > 8 && x < 24) || (x > 35 && x < 51))) return z % 2 ? 0xc8703a : 0xb5612f;   // roller doors
  return ((x === 0 || x === 59) ? y : x) % 3 === 0 ? 0x8f98a3 : 0xa7b0bb;
});
const boxFn = (W, L, H, a, b) => (x, y, z) => (x === 0 || x === W - 1 || y === 0 || y === L - 1 || z === H - 1) ? (y === L - 1 ? b : (x + y) % 2 ? a : b) : null;
def('cont_r', 10, 24, 9, boxFn(10, 24, 9, 0xc8443c, 0xa8342e));
def('cont_b', 10, 24, 9, boxFn(10, 24, 9, 0x3d6fb8, 0x2f5a98));
def('cont_g', 10, 24, 9, boxFn(10, 24, 9, 0x3f9a5b, 0x2f7a46));
def('cont_y', 10, 24, 9, boxFn(10, 24, 9, 0xe0b23a, 0xc0962a));
def('bank', 44, 34, 22, (x, y, z) => {
  const S = 0xe2d9c2, S2 = 0xcfc5a8, ax = Math.abs(x - 21.5);
  if (z >= 17) return y >= 22 && ax < 20 - (z - 17) * 5 ? S : null;                      // pediment
  if (y >= 30) return z >= 14 ? (z === 15 && y === 33 ? 0xe0bb45 : S2) : x % 5 === 2 && x > 1 && x < 43 ? S : z === 0 ? S2 : null; // columns
  if (x < 2 || x > 41) return null;
  if (z === 16) return S2;
  if (!(x === 2 || x === 41 || y === 0 || y === 29)) return z === 0 ? 0x55585f : null;
  return y === 29 && z < 9 && ax < 4 ? 0x3a2f28 : z % 5 > 1 && (x + y) % 4 < 2 ? 0x4d6072 : S;
});
def('copshop', 44, 34, 15, (x, y, z) => {
  if (z === 12) { const d = Math.hypot(x - 21.5, y - 14.5), ax = Math.abs(x - 21.5), ay = Math.abs(y - 14.5); return (d < 9 && d > 7.4) || (ax > 2 && ax < 4 && ay < 5) || (ay < 1 && ax < 3) ? 0xf4f1e6 : 0x3a3f4a; }
  if (z > 12) return y >= 30 && y <= 31 && Math.abs(x - 21.5) < 6 ? (x < 21.5 ? 0xff3040 : 0x3d7dff) : null;
  if (!(x === 0 || x === 43 || y === 0 || y === 33)) return z === 0 ? 0x55585f : null;
  if (y === 33 && z < 7 && Math.abs(x - 21.5) < 3) return 0x1e2230;
  return z === 8 || z === 9 ? 0x2a5aa6 : z > 2 && z < 7 && (x + y) % 5 < 2 ? 0x4d6072 : 0xeef0f4;
});
def('garage', 40, 30, 12, (x, y, z) => {
  if (z === 11) return [0xff7ac8, 0x5ee0e0, 0xffd257, 0xf4f1e6][(noise3(x >> 2, y >> 2, 3) * 4) | 0];
  if (!(x === 0 || x === 39 || y === 0 || y === 29)) return z === 0 ? 0x33363f : null;
  if (y === 29 && x > 7 && x < 32 && z < 8) return null;                                // open bay
  return z >= 9 ? ((x >> 2) & 1 ? 0x5ee0e0 : 0xff7ac8) : (x + y + z) % 6 < 3 ? 0xd8dbe2 : 0xc3c7d0;
});
def('safehouse', 30, 26, 14, (x, y, z) => {
  if (z === 13) return x > 18 && x < 25 && y > 4 && y < 11 ? 0x7a5a36 : null;              // water tank
  if (z === 12) return 0x55585f;
  if (!(x === 0 || x === 29 || y === 0 || y === 25)) return z === 0 ? 0x55585f : null;
  if (y === 25 && z < 7) { if (x > 5 && x < 18) return z % 2 ? 0x3f7a52 : 0x356a46; if (x > 21 && x < 25) return 0x3a2f28; }
  return z > 7 && z < 11 && (x + y) % 6 < 2 ? 0x4d6072 : z % 2 ? 0x9a4a3a : 0x8a4032;
});
def('hydrant', 3, 3, 5, (x, y, z) => (x === 1 && y === 1) || z === 3 ? 0xd8363e : null);
def('bin', 4, 4, 6, (x, y, z) => z === 5 ? 0x33363f : (x === 0 || x === 3 || y === 0 || y === 3) ? 0x2f7d56 : null);
def('bench', 8, 3, 4, (x, y, z) => z === 2 || (z === 3 && y === 0) ? 0xb08a5a : z < 2 && (x === 1 || x === 6) && y === 1 ? 0x33363f : null);
def('light', 3, 3, 14, (x, y, z) => z < 10 ? (x === 1 && y === 1 ? 0x33363f : null) : y === 2 && x === 1 ? [0x3fd45a, 0xffd257, 0xff3040, 0x1b1b22][Math.min(3, z - 10)] : 0x1b1b22);
const ringFn = col => (x, y, z) => { const d = Math.hypot(x - 7, y - 7); return d > 5 && d < 7.4 ? col : null; };
def('ring_g', 15, 15, 1, ringFn(0x7fd45a)); def('ring_y', 15, 15, 1, ringFn(0xffcf5c)); def('ring_p', 15, 15, 1, ringFn(0xd06adf));
def('ring_b', 15, 15, 1, ringFn(0x5aa7ff)); def('ring_c', 15, 15, 1, ringFn(0x5ee0e0)); def('ring_w', 15, 15, 1, ringFn(0xffffff));
def('arrow', 9, 9, 10, (x, y, z) => Math.max(Math.abs(x - 4), Math.abs(y - 4)) <= z * 0.45 ? (z > 7 ? 0xfff3b0 : 0xffcf5c) : null);
def('puff', 4, 4, 4, (x, y, z) => Math.hypot(x - 1.5, y - 1.5, z - 1.5) < 2.2 ? (noise3(x, y, z) > .5 ? 0x55585f : 0x3a3f4a) : null);
def('wreck', 16, 30, 9, carFn({ kind: 'sedan', body: 0x2a2a2a, dark: 0x1b1b1b, light: 0x333333 }));
def('sedan_g', 16, 30, 9, carFn({ kind: 'sedan', body: 0x8a8f99, dark: 0x60656e, light: 0xa7adb8 }));
def('sedan_w', 16, 30, 9, carFn({ kind: 'sedan', body: 0xe8e4d8, dark: 0xb9b5aa, light: 0xffffff }));
def('coupe_b', 16, 30, 8, carFn({ kind: 'sport', body: 0x2f5fae, dark: 0x1f4484, light: 0x4a7dd0, stripe: true }));
def('coupe_k', 16, 30, 8, carFn({ kind: 'sport', body: 0x23232b, dark: 0x16161c, light: 0x3a3a44 }));
def('van_w', 16, 30, 10, carFn({ kind: 'van', body: 0xe8e4d8, dark: 0xb9b5aa, light: 0xffffff }));
def('truck_r', 16, 30, 8, carFn({ kind: 'pickup', body: 0xb5482f, dark: 0x8a3421, light: 0xd06a4a }));
def('shop_k', 30, 24, 10, shopFn(30, 0xff9a3a, 0x55585f));
def('hospital', 50, 40, 18, (x, y, z) => {
  if (z === 15) return Math.abs(x - 24.5) < 2 && Math.abs(y - 19.5) < 8 || Math.abs(y - 19.5) < 2 && Math.abs(x - 24.5) < 8 ? 0xd8363e : 0xdfe4e2;   // red cross on the roof
  if (z > 15) return null;
  if (!(x === 0 || x === 49 || y === 0 || y === 39)) return z === 0 ? 0x55585f : null;
  if (y === 39 && z < 7 && Math.abs(x - 24.5) < 4) return 0x9fd8ff;
  return z === 11 || z === 12 ? 0xd8363e : z % 4 > 1 && (x + y) % 5 < 3 ? 0x7fb4d8 : 0xf2f4f0;
});
def('gang', 5, 3, 11, pedFn({ top: 0x7a3fae, legs: 0x23232b, hair: 0x1b1b22, skin: 0xc68e68, beret: 0x1b1b22 }, false)); def('gangb', 5, 3, 11, pedFn({ top: 0x7a3fae, legs: 0x23232b, hair: 0x1b1b22, skin: 0xc68e68, beret: 0x1b1b22 }, true));
def('copf', 5, 3, 11, pedFn({ top: 0x24406e, legs: 0x1e2230, hair: 0x3a2a1e, skin: 0xe9b48a, beret: 0x2f5fae }, false)); def('copfb', 5, 3, 11, pedFn({ top: 0x24406e, legs: 0x1e2230, hair: 0x3a2a1e, skin: 0xe9b48a, beret: 0x2f5fae }, true));
def('ring_r', 15, 15, 1, ringFn(0xff5a5a)); def('ring_o', 15, 15, 1, ringFn(0xff9a3a)); def('ring_k', 15, 15, 1, ringFn(0xff9ad0));
def('tracer', 2, 2, 2, () => 0xfff3b0);
def('pk_1', 3, 8, 5, (x, y, z) => x === 1 && (z > 2 ? y > 1 : y < 4) ? 0x33363f : null);
def('pk_2', 3, 14, 4, (x, y, z) => x === 1 && z > 1 ? (y < 5 ? 0x7a5226 : 0x33363f) : null);
def('pk_3', 5, 12, 5, (x, y, z) => x === 2 && z > 2 ? 0x3a3f4a : x < 2 && z === 3 && y > 5 && y < 8 ? 0x23262c : x === 2 && z < 3 && y > 2 && y < 5 ? 0x6e4a22 : null);
def('pk_med', 7, 7, 5, (x, y, z) => z === 4 && (Math.abs(x - 3) < 1 || Math.abs(y - 3) < 1) && Math.abs(x - 3) < 3 && Math.abs(y - 3) < 3 ? 0xd8363e : 0xf2f4f0);
def('pk_vest', 7, 4, 8, (x, y, z) => z > 5 ? (x < 2 || x > 4 ? 0x2f5fae : null) : (x + z) % 3 === 0 ? 0x24406e : 0x2f5fae);
def('pk_cash', 6, 4, 3, (x, y, z) => x === 2 || x === 3 ? 0xf4f1e6 : 0x3f9a5b);
def('pk_ammo', 6, 5, 4, (x, y, z) => z === 3 ? 0xc9a23a : 0x5a6a3a);
const CIVS = ['taxi', 'van', 'truck', 'sedan_g', 'sedan_w', 'coupe_b', 'coupe_k', 'van_w', 'truck_r', 'car', 'sedan_g', 'taxi'];
const KIND_OF = n => n === 'taxi' ? 'taxi' : n.startsWith('van') ? 'van' : n.startsWith('truck') ? 'pickup' : n === 'police' ? 'police car' : n.startsWith('coupe') || n === 'car' ? 'sports car' : 'sedan';

const MESH = {};
const mesh = name => MESH[name] || (MESH[name] = buildMesh(MODEL_DEFS[name]));

// ---------- city layout: a 10 x 10 road grid, a river through the middle, districts per block ----------
const SIZE = 1800, NR = 10, GAP = 180, C0 = 90, RW = 22, SW = 32, LANE = 10, IH = 58, PITCH = 0.9;
const rc = i => C0 + GAP * i, RIVER = 4, BRIDGES = [1, 4, 8], WATER = [842, 958];
const hasV = (i, j) => i >= 0 && i < NR && j >= 0 && j < NR - 1 && !(j === RIVER && !BRIDGES.includes(i)) && !(i === 1 && j === 2);   // road i, between rows j and j+1
const hasH = (i, j) => i >= 0 && i < NR - 1 && j >= 0 && j < NR;                                                                         // row j, between roads i and i+1
const neighbours = (i, j) => [hasH(i, j) && [i + 1, j], hasH(i - 1, j) && [i - 1, j], hasV(i, j) && [i, j + 1], hasV(i, j - 1) && [i, j - 1]].filter(Boolean);
const inWater = (x, y) => y > WATER[0] && y < WATER[1] && !BRIDGES.some(i => Math.abs(x - rc(i)) < SW);
function onRoad(x, y) {
  const i = Math.round((x - C0) / GAP), j = Math.round((y - C0) / GAP), dx = Math.abs(x - rc(i)), dy = Math.abs(y - rc(j));
  const inI = i >= 0 && i < NR, inJ = j >= 0 && j < NR;
  if (dx < RW && dy < RW && inI && inJ) return true;
  return (dx < RW && inI && hasV(i, Math.floor((y - C0) / GAP))) || (dy < RW && inJ && hasH(Math.floor((x - C0) / GAP), j));
}
const nearestNode = (x, y) => [Math.max(0, Math.min(NR - 1, Math.round((x - C0) / GAP))), Math.max(0, Math.min(NR - 1, Math.round((y - C0) / GAP)))];
//                 S shops  H townhouses  T towers  P park  R residential  I industrial   B bank  C police  G respray  D chop shop  X safehouse
const DISTRICTS = ['SHHTTTHSH', 'HHTTBTTHA', 'PPHTTTHHG', 'HSHHCHSMH', '.........', 'RRSRRIIII', 'RRRRSIDII', 'RPRRRIIII', 'RRRXRSIII'];
const blockAt = c => [rc(DISTRICTS[0].indexOf('') || 0), 0] && (() => { for (let j = 0; j < 9; j++) { const i = DISTRICTS[j].indexOf(c); if (i >= 0) return { x: rc(i) + 90, y: rc(j) + 90 }; } })();

// ---------- world state ----------
const rnd = mulberry32(21), statics = [], grid = new Map(), cars = [], peds = [], fx = [], downs = [], markers = [];
const cellKey = (x, y) => (x / GAP | 0) + (y / GAP | 0) * 64;
function addStatic(name, x, y, rot, o = {}) {
  const m = MODEL_DEFS[name], quarter = Math.abs(Math.sin(rot)) > 0.5;
  const e = { name, x, y, rot, solid: true, ...o };
  if (o.rad == null) e.box = { hw: (quarter ? m.L : m.W) / 2, hl: (quarter ? m.W : m.L) / 2 };
  statics.push(e);
  const k = cellKey(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e);
  return e;
}
const prop = (name, x, y, rot, rad) => addStatic(name, x, y, rot, { rad, breakable: true });
const nearCells = (x, y, r, fn) => { for (let cy = Math.max(0, (y / GAP | 0) - r); cy <= (y / GAP | 0) + r; cy++) for (let cx = Math.max(0, (x / GAP | 0) - r); cx <= (x / GAP | 0) + r; cx++) { const l = grid.get(cx + cy * 64); if (l) for (const e of l) fn(e); } };

const ground = mkCanvas(SIZE, SIZE);
const SPOT = {};                                                    // named places the jobs use
(function buildCity() {
  const g = ground.getContext('2d'), r = rnd;
  g.fillStyle = '#4c9a4a'; g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 30000; i++) { g.fillStyle = ['#458f45', '#57a852', '#3f8642'][i % 3]; g.fillRect(r() * SIZE | 0, r() * SIZE | 0, 2, 1); }
  const FLOOR = { S: '#8d8f96', H: '#b9b2a4', T: '#a9adb6', P: '#5fa653', R: '#63ab57', I: '#7d7a72', B: '#c9c2b2', C: '#9aa0ad', G: '#6a6d76', D: '#6f6c66', X: '#8a8478', M: '#b9c2c6', A: '#8d8f96' };
  for (let bj = 0; bj < 9; bj++) for (let bi = 0; bi < 9; bi++) {
    const d = DISTRICTS[bj][bi]; if (d === '.') continue;
    g.fillStyle = FLOOR[d]; g.fillRect(rc(bi) + RW, rc(bj) + RW, GAP - 2 * RW, GAP - 2 * RW);
    for (let k = 0; k < 500; k++) { g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(rc(bi) + RW + r() * (GAP - 2 * RW) | 0, rc(bj) + RW + r() * (GAP - 2 * RW) | 0, 2, 2); }
  }
  g.fillStyle = '#8f897d'; g.fillRect(0, WATER[0] - 6, SIZE, WATER[1] - WATER[0] + 12);            // embankment
  g.fillStyle = '#3f7f9a'; g.fillRect(0, WATER[0], SIZE, WATER[1] - WATER[0]);
  for (let i = 0; i < 1500; i++) { g.fillStyle = i & 1 ? '#5a9ab4' : '#356f88'; g.fillRect(r() * SIZE | 0, WATER[0] + r() * (WATER[1] - WATER[0]) | 0, 4, 1); }
  // roads: pavement first, then asphalt on top, then markings
  const segs = [];
  for (let j = 0; j < NR; j++) for (let i = 0; i < NR; i++) { if (hasH(i, j)) segs.push([rc(i), rc(j), rc(i + 1), rc(j)]); if (hasV(i, j)) segs.push([rc(i), rc(j), rc(i), rc(j + 1)]); }
  const band = (w, col) => { g.fillStyle = col; for (const [x1, y1, x2, y2] of segs) g.fillRect(x1 - w, y1 - w, x2 - x1 + 2 * w, y2 - y1 + 2 * w); };
  band(SW, '#c9c5bb'); band(SW - 1, '#d5d1c7'); band(RW + 1, '#8f8c85'); band(RW, '#484b55');
  for (let i = 0; i < 40000; i++) { const x = r() * SIZE, y = r() * SIZE; if (onRoad(x, y)) { g.fillStyle = r() > .5 ? '#41444d' : '#52555f'; g.fillRect(x | 0, y | 0, 2, 1); } }
  for (const [x1, y1, x2, y2] of segs) {
    const horiz = y1 === y2, len = GAP - 2 * RW - 24;
    g.fillStyle = '#d8b84a';                                                                     // centre line
    for (let s = RW + 12; s < RW + 12 + len; s += 14) horiz ? g.fillRect(x1 + s, y1 - 1, 8, 2) : g.fillRect(x1 - 1, y1 + s, 2, 8);
    g.fillStyle = '#e4e1d8';                                                                     // crossings at both ends
    for (const s of [RW + 2, GAP - RW - 8]) for (let k = -18; k <= 16; k += 6) horiz ? g.fillRect(x1 + s, y1 + k, 6, 3) : g.fillRect(x1 + k, y1 + s, 3, 6);
  }
  for (const i of BRIDGES) for (let y = WATER[0] + 4; y < WATER[1]; y += 16) for (const s of [-SW + 2, SW - 2]) prop('bollard', rc(i) + s, y, 0, 2);
  for (let j = 0; j < NR; j++) for (let i = 0; i < NR; i++) if (neighbours(i, j).length > 2) { prop('light', rc(i) + 27, rc(j) + 27, Math.PI, 1.5); prop('light', rc(i) - 27, rc(j) - 27, 0, 1.5); }

  const lot = (x, y, w, h) => { g.fillStyle = '#5b5e68'; g.fillRect(x, y, w, h); g.fillStyle = '#d5d1c7'; for (let k = 0; k <= w; k += 22) g.fillRect(x + k, y, 1, h); };
  const parked = (x, y, heading, name) => cars.push(makeCar(name || CIVS[r() * CIVS.length | 0], x, y, heading));
  const trees = (cx, cy, n, kinds, half = IH - 8) => { for (let k = 0, tries = 0; k < n && tries < n * 8; tries++) { const x = cx + (r() * 2 - 1) * half, y = cy + (r() * 2 - 1) * half; if (!blocked(x, y, 9)) { prop(kinds[r() * kinds.length | 0], x, y, r() * 6.28, 3); k++; } } };
  for (let bj = 0; bj < 9; bj++) for (let bi = 0; bi < 9; bi++) {
    const d = DISTRICTS[bj][bi], cx = rc(bi) + 90, cy = rc(bj) + 90;
    if (d === '.') continue;
    if (d === 'T') { const t = ['tower_a', 'tower_b', 'tower_c', 'tower_d'][(bi * 3 + bj) % 4]; addStatic(t, cx, cy, 0); for (const [a, b] of [[-50, -50], [50, 50], [50, -50], [-50, 50]]) if (r() < .7) prop('plane', cx + a, cy + b, 0, 3); }
    if (d === 'H') {
      for (const s of [-30, 30]) { addStatic(r() < .5 ? 'haus' : 'hausc', cx + s, cy - 46, Math.PI); addStatic(r() < .5 ? 'haus' : 'hausc', cx + s, cy + 46, 0); }
      addStatic('hausc', cx - 46, cy, Math.PI / 2); addStatic('hausc', cx + 46, cy, -Math.PI / 2); prop('plane', cx, cy, 0, 3);
    }
    if (d === 'R') {
      g.fillStyle = '#c9c5bb'; g.fillRect(cx - 3, cy - IH, 6, 2 * IH);
      for (const [a, b] of [[-30, -34], [30, -34], [-30, 34], [30, 34]]) addStatic('house', cx + a, cy + b, b < 0 ? Math.PI : 0);
      trees(cx, cy, 5, ['tree', 'bush', 'bush']);
    }
    if (d === 'I' || d === 'D') {
      addStatic('warehouse', cx, cy - 36, 0); lot(cx - 55, cy + 4, 110, 50);
      for (let k = 0; k < 5; k++) if (r() < .75 && !(d === 'D' && k > 1 && k < 4)) addStatic(['cont_r', 'cont_b', 'cont_g', 'cont_y'][r() * 4 | 0], cx - 44 + k * 22, cy + 40, 0);
      if (d === 'I' && r() < .6) parked(cx + (r() < .5 ? -22 : 22), cy + 18, 0, r() < .5 ? 'van_w' : 'truck');
    }
    if (d === 'P') { trees(cx, cy, 16, ['tree', 'tree', 'pine', 'bush'], IH + 12); for (const s of [-1, 1]) prop('bench', cx + s * 20, cy + 26, 0, 3); if (bi === 0) addStatic('fountain', cx + 90, cy, 0, { rad: 9 }); }
    if (d === 'S') {
      ['shop_r', 'shop_g', 'shop_b'].forEach((s, k) => addStatic(s, cx - 32 + k * 32, cy - 44, Math.PI));
      lot(cx - 55, cy + 8, 110, 48); for (let k = 0; k < 5; k++) if (r() < .55) parked(cx - 44 + k * 22, cy + 34, -Math.PI / 2);
    }
    if (d === 'B') { addStatic('bank', cx, cy - 8, 0); for (const s of [-44, 44]) prop('plane', cx + s, cy + 46, 0, 3); }
    if (d === 'C') { addStatic('copshop', cx, cy - 18, 0); lot(cx - 55, cy + 20, 110, 36); for (const s of [-33, 11]) parked(cx + s, cy + 38, -Math.PI / 2, 'police'); }
    if (d === 'G') { addStatic('garage', cx, cy - 26, 0); g.fillStyle = '#3a3d46'; g.fillRect(cx - 40, cy - 10, 80, 66); SPOT.respray = { x: cx, y: cy + 22 }; }
    if (d === 'D') SPOT.chop = { x: cx + 11, y: cy + 34 };
    if (d === 'M') { addStatic('hospital', cx, cy - 14, 0); for (const s2 of [-46, 46]) prop('plane', cx + s2, cy + 44, 0, 3); SPOT.hospital = { x: cx, y: cy + 40 }; }
    if (d === 'A') { ['shop_k', 'shop_g', 'shop_b'].forEach((s2, k) => addStatic(s2, cx - 32 + k * 32, cy - 44, Math.PI)); lot(cx - 55, cy + 8, 110, 48); SPOT.guns = { x: cx - 32, y: cy - 72 }; }
    if (d === 'X') { addStatic('safehouse', cx - 22, cy - 26, 0); lot(cx - 55, cy + 6, 110, 50); SPOT.safe = { x: cx + 24, y: cy + 30 }; SPOT.start = { x: cx - 30, y: cy + 30 }; parked(cx - 11, cy + 30, -Math.PI / 2, 'coupe_k'); trees(cx + 30, cy - 30, 3, ['tree'], 20); }
    // street furniture on the pavement around every block
    for (const s of [-1, 1]) { prop('lamp', cx + s * 30, cy + s * 66, s > 0 ? Math.PI : 0, 2); if (r() < .6) prop(['hydrant', 'bin', 'bench'][r() * 3 | 0], cx - s * 34, cy + s * 66, 0, 2); }
    const n = d === 'T' || d === 'S' || d === 'H' || d === 'B' ? 3 : d === 'P' ? 4 : 1;         // pedestrians lap the block on the pavement
    for (let k = 0; k < n; k++) peds.push({ cx, cy, s: r() * 496, dir: r() < .5 ? -1 : 1, speed: 11 + r() * 8, look: 1 + (r() * PEDS.length | 0), t: r() * 9, in: 0, x: 0, y: 0, rot: 0 });
  }
  for (let k = 0; k < 220; k++) { const x = 8 + r() * (SIZE - 16), y = 8 + r() * (SIZE - 16); if ((x < 50 || y < 50 || x > SIZE - 50 || y > SIZE - 50) && !inWater(x, y)) prop(r() < .6 ? 'pine' : 'tree', x, y, r() * 6.28, 3); }
  const side = (c, dy = 72) => { const b = blockAt(c); return { x: b.x, y: b.y + dy }; };
  SPOT.bank = side('B', 76);
  const spots = [['S', 'ring_g', 'Dispatch', '#7fd45a'], ['C', 'ring_y', 'Cab Co', '#ffcf5c'], ['X', 'ring_p', 'The Crew', '#d06adf'], ['D', 'ring_b', 'Chop Shop', '#5aa7ff']];
  spots.forEach(([c, ring, name, col], k) => { const p = k === 1 ? { x: rc(6) + 90, y: rc(3) + 90 + 76 } : side(c, 76); markers.push({ ...p, ring, name, col, contact: k }); });
  markers.push({ ...SPOT.respray, ring: 'ring_c', name: 'Respray', col: '#5ee0e0', respray: true });
  markers.push({ x: rc(5) + 90, y: rc(5) + 166, ring: 'ring_r', name: 'The Fixer', col: '#ff5a5a', contact: 4 });
  markers.push({ ...SPOT.guns, ring: 'ring_o', name: 'Gun shop', col: '#ff9a3a', shop: true }, { ...SPOT.hospital, ring: 'ring_k', name: 'Hospital', col: '#ff9ad0', heal: true });
})();
function blocked(x, y, r) { let hit = false; nearCells(x, y, 1, e => { if (!hit && e.solid && !e.down) hit = e.box ? Math.abs(x - e.x) < e.box.hw + r && Math.abs(y - e.y) < e.box.hl + r : Math.hypot(x - e.x, y - e.y) < e.rad + r; }); return hit; }

// ---------- cars ----------
function makeCar(name, x, y, heading) { return { name, x, y, heading, vel: 0, hp: 100, ai: null, cop: name === 'police', chase: false, hitCd: 0 }; }
const dirOf = (a, b) => [Math.sign(b[0] - a[0]), Math.sign(b[1] - a[1])];
function laneRoute(from, to) {                                    // waypoints along the right-hand lane of the edge from -> to
  const [dx, dy] = dirOf(from, to), rx = -dy, ry = dx, ax = rc(from[0]), ay = rc(from[1]), bx = rc(to[0]), by = rc(to[1]), k = RW + 12;
  return [{ x: ax + dx * k + rx * LANE, y: ay + dy * k + ry * LANE }, { x: bx - dx * k + rx * LANE, y: by - dy * k + ry * LANE }];
}
function nextEdge(c) {
  const a = c.ai, opts = neighbours(...a.to).filter(n => n[0] !== a.from[0] || n[1] !== a.from[1]);
  const next = opts.length ? opts[rnd() * opts.length | 0] : a.from;
  a.from = a.to; a.to = next; a.wps = laneRoute(a.from, a.to);
}
function spawnTraffic(name, node, speed) {
  const ns = neighbours(...node), to = ns[rnd() * ns.length | 0], wps = laneRoute(node, to), t = rnd();
  const c = makeCar(name, wps[0].x + (wps[1].x - wps[0].x) * t, wps[0].y + (wps[1].y - wps[0].y) * t, Math.atan2(to[1] - node[1], to[0] - node[0]));
  c.ai = { from: node, to, wps: [wps[1]], speed, stuck: 0, pause: 0 }; c.vel = speed;
  cars.push(c); return c;
}
for (let k = 0; k < 46; k++) spawnTraffic(CIVS[rnd() * CIVS.length | 0], [rnd() * NR | 0, rnd() * NR | 0], 62 + rnd() * 24);
for (let k = 0; k < 5; k++) spawnTraffic('police', [rnd() * NR | 0, rnd() * NR | 0], 72);

// ---------- player, wanted level, jobs ----------
const P = { car: null, x: SPOT.start.x, y: SPOT.start.y, yaw: -Math.PI / 2, t: 0, money: 0, heat: 0, calm: 0, bust: 0, view: 'top',
  hp: 100, armor: 0, has: [true, false, false, false], ammo: [0, 0, 0, 0], weapon: 0, cool: 0, swing: 0, hurt: 0, noise: 0, shotCd: 0, rep: 0, won: false };
try { const sv = JSON.parse(localStorage.getItem('getaway1') || 'null'); if (sv) { P.money = sv.money || 0; P.rep = sv.rep || 0; P.won = !!sv.won; if (sv.has) { P.has = sv.has; P.ammo = sv.ammo || P.ammo; P.weapon = [3, 2, 1].find(i => P.has[i]) || 0; } } } catch (e) { /* storage unavailable */ }
const cam = { x: P.x, y: P.y, a: 0 };
const pos = () => P.car || P, speedOf = () => P.car ? Math.abs(P.car.vel) : 0, level = () => Math.min(4, P.heat / 100 | 0);
let job = null, big = { t: 0 }, field = null, fieldT = 0;
function flash(text, color, secs = 2.2) { const el = $('big'); el.textContent = text; el.style.color = color; el.style.opacity = 1; big.t = secs; }
function addHeat(n) { P.heat = Math.min(499, P.heat + n); P.calm = 0; }
function randomKerb(minDist) {                                     // a spot at the edge of a random street, at least minDist away
  for (let tries = 0; tries < 200; tries++) {
    const i = rnd() * (NR - 1) | 0, j = rnd() * NR | 0, p = { x: rc(i) + 50 + rnd() * 80, y: rc(j) + 15 };
    if (Math.hypot(p.x - pos().x, p.y - pos().y) > minDist) return p;
  }
  return { x: rc(5) + 90, y: rc(0) + 15 };
}
const JOBS = [
  () => { const to = randomKerb(520), secs = Math.round(Math.hypot(to.x - pos().x, to.y - pos().y) / 75 + 14); return { name: 'Dispatch', pay: 180, bonus: 6, steps: [{ go: to, text: 'Deliver the package', time: secs }] }; },
  () => { const a = randomKerb(260), b = randomKerb(600); return { name: 'Cab Co', pay: 260, bonus: 4, steps: [{ go: a, car: true, stop: true, text: 'Pick up the fare (stop next to them)' }, { go: b, car: true, stop: true, text: 'Drop the fare off', time: 75 }] }; },
  () => P.rep >= 5 && !P.won ? { name: 'The Big One', pay: 5000, bonus: 0, final: true, steps: [{ go: SPOT.bank, car: true, stop: true, text: 'THE BIG ONE: park outside the bank' },
    { wait: 10, text: 'Dockers want the score too: hold the street\u2026', start: () => { flash('DOCKERS!', '#d06adf'); for (let k = 0; k < 4; k++) spawnGunman('gang', SPOT.bank.x - 60 + k * 40, SPOT.bank.y + 34, { hostile: true }); }, done: () => { P.heat = 420; P.calm = 0; flash('ALARM!', '#ff5a5a'); } },
    { lose: true, text: 'Lose the police' }, { go: SPOT.safe, car: true, stop: true, text: 'Bring it home' }] }
  : ({ name: 'The Crew', pay: 1200, bonus: 0, steps: [{ go: SPOT.bank, car: true, stop: true, text: 'Park outside the bank' }, { wait: 5, text: 'Keep the engine running…', done: () => { P.heat = 320; P.calm = 0; flash('ALARM!', '#ff5a5a'); } },
    { lose: true, text: 'Lose the police' }, { go: SPOT.safe, car: true, stop: true, text: 'Get the crew to the safehouse' }] }),
  null,
  () => { const at = randomKerb(380), crew = []; return { name: 'The Fixer', pay: 750, bonus: 0, steps: [{ kill: crew, go: at, text: 'Clear out the Dockers\u2019 lookouts', start: () => { for (let k = 0; k < 5; k++) crew.push(spawnGunman('gang', at.x - 40 + k * 20, at.y - 28, { hostile: false })); } }] }; },
];
JOBS[3] = (() => { const kind = ['taxi', 'van', 'pickup', 'sports car', 'police car'][rnd() * 5 | 0]; return { name: 'Chop Shop', pay: kind === 'police car' ? 900 : 420, bonus: 0, steps: [{ go: SPOT.chop, car: kind, stop: true, text: `Bring a ${kind} to the chop shop`, take: true }] }; });
function endJob(ok, why) {
  if (ok) { const pay = job.pay + Math.max(0, Math.round((job.clock || 0) * job.bonus)); P.money += pay; P.rep++; if (job.final) { P.won = true; flash(`YOU RUN THIS TOWN  +$${pay}`, '#ffcf5c', 6); } else flash(`JOB DONE  +$${pay}`, '#9dffa0'); save(); } else flash(why || 'JOB FAILED', '#ff8a5a');
  job = null;
}
function busted() { const fine = Math.min(P.money, 100 + Math.round(P.money * 0.2)); P.money -= fine; if (job) job = null; flash(`BUSTED  -$${fine}`, '#5aa7ff', 3); const b = blockAt('C'); P.car = null; P.x = b.x; P.y = b.y + 64; P.yaw = Math.PI / 2; P.heat = 0; P.bust = 0; for (const c of cars) if (c.chase) patrol(c); for (let i = gunmen.length - 1; i >= 0; i--) if (gunmen[i].kind === 'cop') gunmen.splice(i, 1); save(); }
function patrol(c) { c.chase = false; const n = nearestNode(c.x, c.y), ns = neighbours(...n), to = ns[rnd() * ns.length | 0]; c.ai = { from: n, to, wps: laneRoute(n, to), speed: 72, stuck: 0, pause: 0 }; }

function action() {
  if (P.car) {
    const c = P.car, h = c.heading, spot = [14, -14, 22, -22].map(d => ({ x: c.x + Math.sin(h) * d, y: c.y - Math.cos(h) * d })).find(p => !blocked(p.x, p.y, 3) && !inWater(p.x, p.y)) || { x: c.x, y: c.y };
    P.car = null; P.x = spot.x; P.y = spot.y; P.yaw = h;
  } else {
    const c = cars.filter(c => !c.wreck).map(c => [Math.hypot(c.x - P.x, c.y - P.y), c]).filter(e => e[0] < 30).sort((a, b) => a[0] - b[0]).map(e => e[1])[0];
    if (!c) return;
    if (c.ai || c.chase) {                                           // someone was driving it: they bail out and the police hear about it
      addHeat(c.cop ? 150 : 45);
      const b = { cx: Math.round((c.x - 180) / GAP) * GAP + 180, cy: Math.round((c.y - 180) / GAP) * GAP + 180 };
      peds.push({ ...b, s: 0, dir: 1, speed: 15, look: 1 + (rnd() * PEDS.length | 0), t: 0, in: 0, flee: { x: c.x + Math.sin(c.heading) * 14, y: c.y - Math.cos(c.heading) * 14, t: 2.5 }, x: c.x, y: c.y, rot: 0 });
    }
    c.ai = null; c.chase = false; P.car = c;
  }
}

// ---------- collisions ----------
// Returns the push-out normal if a circle of radius r at (x,y) hits something solid. Breakable props are handed to onBreak instead.
function hitStatic(x, y, r, onBreak) {
  if (x < r + 4) return [1, 0]; if (y < r + 4) return [0, 1]; if (x > SIZE - r - 4) return [-1, 0]; if (y > SIZE - r - 4) return [0, -1];
  if (inWater(x, y)) return [0, y < (WATER[0] + WATER[1]) / 2 ? -1 : 1];
  let n = null;
  nearCells(x, y, 1, e => {
    if (n || e.down || !e.solid) return;
    if (e.box) {
      const dx = x - e.x, dy = y - e.y, px = Math.max(-e.box.hw, Math.min(e.box.hw, dx)), py = Math.max(-e.box.hl, Math.min(e.box.hl, dy)), ex = dx - px, ey = dy - py, d = Math.hypot(ex, ey);
      if (d >= r) return;
      n = d > 0.001 ? [ex / d, ey / d] : (e.box.hw - Math.abs(dx) < e.box.hl - Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1]);
    } else if (Math.hypot(x - e.x, y - e.y) < e.rad + r) {
      if (e.breakable && onBreak) onBreak(e); else if (!e.breakable) { const d = Math.hypot(x - e.x, y - e.y) || 1; n = [(x - e.x) / d, (y - e.y) / d]; }
    }
  });
  return n;
}
function moveCar(c, dt) {
  const mine = c === P.car, nx = c.x + Math.cos(c.heading) * c.vel * dt, ny = c.y + Math.sin(c.heading) * c.vel * dt;
  let n = hitStatic(nx, ny, 8, e => {                                // flatten small things and carry on
    const dir = Math.sign(c.vel) || 1; e.pose = { dx: Math.cos(c.heading) * dir, dy: Math.sin(c.heading) * dir, a: 0, t: 0 }; e.down = true; downs.push(e);
    c.vel *= MODEL_DEFS[e.name].W >= 10 ? 0.8 : 0.93; if (mine) addHeat(3);
  });
  if (!n) for (const o of cars) {                                    // other vehicles
    if (o === c || Math.hypot(o.x - nx, o.y - ny) > 18) continue;
    const d = Math.hypot(c.x - o.x, c.y - o.y) || 1; n = [(c.x - o.x) / d, (c.y - o.y) / d];
    if (o.ai) o.ai.pause = 1.2;
    if (!o.wreck && !inWater(o.x - n[0] * 2, o.y - n[1] * 2)) { o.x -= n[0] * 2; o.y -= n[1] * 2; }
    if (mine && o.hitCd <= 0 && Math.abs(c.vel) > 40) { addHeat(o.cop ? 110 : 25); o.hitCd = 1.5; }
    if (o === P.car && c.chase && c.hitCd <= 0 && Math.abs(c.vel) > 50) { o.vel *= 0.75; damage(o, 6); c.hitCd = 0.7; }       // a ram, not a grinder: once per contact
    break;
  }
  if (!n) { c.x = nx; c.y = ny; return; }
  // glance off: drop the part of the velocity that points into the obstacle and steer along what is left
  const dir = Math.sign(c.vel) || 1, speed = Math.abs(c.vel), vx = Math.cos(c.heading) * dir, vy = Math.sin(c.heading) * dir, into = Math.min(0, vx * n[0] + vy * n[1]);
  let tx = vx - into * n[0], ty = vy - into * n[1], along = Math.hypot(tx, ty);
  if (along < 0.35) { const s = -n[1] * vx + n[0] * vy >= 0 ? 1 : -1; tx = -n[1] * s; ty = n[0] * s; along = 0.35; }
  if (mine) damage(c, Math.max(0, speed * -into - 80) * 0.06);
  c.heading = Math.atan2(ty * dir, tx * dir); c.vel = dir * speed * Math.max(0.35, along * 0.9);
  if (!hitStatic(c.x + n[0] * 1.5, c.y + n[1] * 1.5, 8)) { c.x += n[0] * 1.5; c.y += n[1] * 1.5; }
}
function damage(c, amount) {
  if (c.wreck || amount <= 0) return;
  c.hp -= amount;
  if (c.hp <= 0) { c.hp = 0; c.wreck = true; c.name = 'wreck'; c.vel *= 0.3; if (c === P.car) { flash('WRECKED', '#ff8a5a'); action(); if (job && job.steps[job.i].car) endJob(false, 'JOB FAILED: car wrecked'); } }
}

// ---------- AI ----------
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function steer(c, tx, ty, want, dt, rate) {
  const diff = wrap(Math.atan2(ty - c.y, tx - c.x) - c.heading);
  c.heading += Math.max(-rate * dt, Math.min(rate * dt, diff));
  const target = want * (Math.abs(diff) > 0.6 ? 0.5 : 1);
  c.vel += Math.max(-240 * dt, Math.min(110 * dt, target - c.vel));
}
function carAhead(c) {
  const hx = Math.cos(c.heading), hy = Math.sin(c.heading), reach = 30 + c.vel * 0.3;
  const test = (x, y, w) => { const dx = x - c.x, dy = y - c.y, f = dx * hx + dy * hy; return f > 4 && f < reach && Math.abs(dx * hy - dy * hx) < w; };
  if (!P.car && test(P.x, P.y, 9)) return true;
  return cars.some(o => o !== c && test(o.x, o.y, 11));
}
function driveTraffic(c, dt) {
  const a = c.ai;
  if (a.pause > 0) { a.pause -= dt; c.vel *= Math.pow(0.02, dt); c.x += Math.cos(c.heading) * c.vel * dt; c.y += Math.sin(c.heading) * c.vel * dt; return; }
  if (Math.hypot(a.wps[0].x - c.x, a.wps[0].y - c.y) < 12) { a.wps.shift(); if (!a.wps.length) nextEdge(c); }
  const stop = carAhead(c) && a.stuck < 5;                           // wait behind others, but nudge through if a jam lasts too long
  a.stuck = carAhead(c) ? a.stuck + dt : 0; if (a.stuck > 6.5) a.stuck = 0;
  steer(c, a.wps[0].x, a.wps[0].y, stop ? 0 : a.speed, dt, 3.2);
  c.x += Math.cos(c.heading) * c.vel * dt; c.y += Math.sin(c.heading) * c.vel * dt;
}
function bfs() {                                                    // road distance from every junction to the player's nearest junction
  const start = nearestNode(pos().x, pos().y), f = new Int16Array(NR * NR).fill(999), q = [start]; f[start[0] + start[1] * NR] = 0;
  while (q.length) { const n = q.shift(), d = f[n[0] + n[1] * NR]; for (const m of neighbours(...n)) if (f[m[0] + m[1] * NR] > d + 1) { f[m[0] + m[1] * NR] = d + 1; q.push(m); } }
  return f;
}
function driveCop(c, dt) {
  const t = pos(), d = Math.hypot(t.x - c.x, t.y - c.y);
  let tx = t.x, ty = t.y;
  if (d > 150) {                                                    // too far to see: follow the road grid towards the player
    const n = nearestNode(c.x, c.y), here = field[n[0] + n[1] * NR];
    const best = neighbours(...n).reduce((b, m) => field[m[0] + m[1] * NR] < field[b[0] + b[1] * NR] ? m : b, n);
    const atNode = Math.hypot(c.x - rc(n[0]), c.y - rc(n[1])) < 40, between = (c.x - rc(n[0])) * (rc(best[0]) - rc(n[0])) + (c.y - rc(n[1])) * (rc(best[1]) - rc(n[1])) > 0;
    const go = here > 0 && (atNode || between) ? best : n; tx = rc(go[0]); ty = rc(go[1]);
  }
  steer(c, tx, ty, d < 30 ? 30 : 165 + level() * 14, dt, 3.6);
  moveCar(c, dt);
}

// ---------- update ----------
function update(dt) {
  const up = keys.w || keys.arrowup, dn = keys.s || keys.arrowdown, lf = keys.a || keys.arrowleft, rt = keys.d || keys.arrowright, turn = (rt ? 1 : 0) - (lf ? 1 : 0);
  if (P.view === 'top') { if (keys.q) cam.a -= 1.8 * dt; if (keys.e) cam.a += 1.8 * dt; }
  if (P.car) {
    const c = P.car;
    c.vel += ((up ? 300 : 0) - (dn ? 220 : 0)) * dt * (c.hp < 30 ? 0.6 : 1);
    c.heading += turn * 2.7 * dt * Math.max(-1, Math.min(1, c.vel / 60));
    c.vel *= Math.pow(onRoad(c.x, c.y) ? 0.36 : 0.13, dt);
  } else {
    P.yaw += turn * 2.4 * dt;
    const fwd = ((up ? 1 : 0) - (dn ? 1 : 0)) * 54 * dt, sidestep = P.view === 'fp' ? ((keys.e ? 1 : 0) - (keys.q ? 1 : 0)) * 40 * dt : 0;
    const mx = Math.cos(P.yaw) * fwd - Math.sin(P.yaw) * sidestep, my = Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * sidestep;
    const ok = (x, y) => !hitStatic(x, y, 3) && !cars.some(c => Math.hypot(c.x - x, c.y - y) < 9);
    if (ok(P.x + mx, P.y)) P.x += mx; if (ok(P.x, P.y + my)) P.y += my;
    if (fwd || sidestep) P.t += dt;
  }
  fieldT -= dt; if (fieldT <= 0 || !field) { field = bfs(); fieldT = 0.4; }
  for (const c of cars) {
    c.hitCd -= dt;
    if (c.wreck) { c.vel *= Math.pow(0.05, dt); if (Math.abs(c.vel) > 2) moveCar(c, dt); if (rnd() < dt * 5) fx.push({ x: c.x + (rnd() - .5) * 8, y: c.y + (rnd() - .5) * 8, lift: 8, t: 0 }); continue; }
    if (c === P.car) { moveCar(c, dt); if (c.hp < 35 && rnd() < dt * 6) fx.push({ x: c.x, y: c.y, lift: 8, t: 0 }); continue; }
    if (c.chase) driveCop(c, dt);
    else if (c.ai) driveTraffic(c, dt);
    else { c.vel *= Math.pow(0.05, dt); if (Math.abs(c.vel) > 2) moveCar(c, dt); }      // parked or abandoned: roll to a stop
  }
  // wanted level: police near you give chase, more arrive as it rises, and it cools off once you are out of their reach
  const lv = level(), here = pos();
  let chasing = 0, nearCop = false;
  for (const c of cars) if (c.cop && !c.wreck && c !== P.car) {
    const d = Math.hypot(c.x - here.x, c.y - here.y);
    if (lv > 0 && !c.chase && d < 520) { c.chase = true; c.ai = null; }
    if (lv === 0 && c.chase) patrol(c);
    if (c.chase) { chasing++; if (d < 280) nearCop = true; if (d < 34 && speedOf() < 22) P.bust += dt * 1.6; }
  }
  if (lv > 0 && chasing < lv + 1 && rnd() < dt * 0.8) {             // call in another unit from a few blocks away
    const far = []; for (let j = 0; j < NR; j++) for (let i = 0; i < NR; i++) { const f = field[i + j * NR]; if (f >= 3 && f <= 4) far.push([i, j]); }
    if (far.length) { const n = far[rnd() * far.length | 0], c = makeCar('police', rc(n[0]), rc(n[1]), 0); c.chase = true; cars.push(c); }
  }
  for (let k = cars.length - 1; k >= 0; k--) { const c = cars[k]; if (c.cop && !c.chase && c !== P.car && cars.filter(o => o.cop).length > 7 && Math.hypot(c.x - here.x, c.y - here.y) > 700) cars.splice(k, 1); }
  P.bust = Math.max(0, P.bust - dt * 0.6); if (P.bust > 1.6) busted();
  if (lv > 0) { P.calm = nearCop ? 0 : P.calm + dt; if (P.calm > 9) { P.heat = Math.max(0, (lv - 1) * 100 + 40 * (lv > 1)); P.calm = 0; if (level() === 0) flash('YOU LOST THEM', '#9dffa0', 1.6); } }
  else P.heat = Math.max(0, P.heat - 5 * dt);
  // pedestrians lap their block; they step in from the kerb when a car comes close
  for (const p of peds) {
    if (p.flee) { p.flee.t -= dt; const tx = p.cx + Math.sign(p.flee.x - p.cx) * 62, ty = p.flee.y; p.x = p.flee.x += Math.sign(tx - p.flee.x) * Math.min(40 * dt, Math.abs(tx - p.flee.x)); p.y = ty; p.rot = Math.atan2(0, tx - p.x) - Math.PI / 2; p.t += dt * 2;
      if (p.flee.t <= 0) { p.s = p.x > p.cx ? 124 + (p.y - (p.cy - 62)) : 496 - (p.y - (p.cy - 62)); p.s = Math.max(0, Math.min(495, p.s)); p.flee = null; } continue; }
    if (p.down) continue;
    const scared = p.panic > 0 || cars.some(c => Math.abs(c.vel) > 30 && Math.hypot(c.x - p.x, c.y - p.y) < 30);
    p.in += ((scared ? 7 : 0) - p.in) * Math.min(1, 8 * dt);
    p.s = (p.s + p.dir * p.speed * (p.panic > 0 ? 4 : scared ? 2 : 1) * dt + 496) % 496; p.t += dt;
    const h = 62 - p.in, e = p.s / 124 | 0, u = (p.s % 124) / 124 * 2 - 1;      // four edges of 124
    const [ox, oy, hd] = e === 0 ? [u * 62, -h, 0] : e === 1 ? [h, u * 62, Math.PI / 2] : e === 2 ? [-u * 62, h, Math.PI] : [-h, -u * 62, -Math.PI / 2];
    p.x = p.cx + ox; p.y = p.cy + oy; p.rot = hd + (p.dir < 0 ? Math.PI : 0) - Math.PI / 2;
  }
  for (let k = downs.length - 1; k >= 0; k--) { const e = downs[k]; e.pose.t += dt; e.pose.a = 1.45 * Math.min(1, Math.pow(e.pose.t / 0.45, 2)); if (e.pose.t > 30 && Math.hypot(e.x - here.x, e.y - here.y) > 320) { e.down = false; e.pose = null; downs.splice(k, 1); } }
  for (let k = fx.length - 1; k >= 0; k--) { const f = fx[k]; f.t += dt; f.lift += 16 * dt; if (f.t > 1.6) fx.splice(k, 1); }
  updateCombat(dt);
  // jobs
  if (!job) for (const m of markers) {
    if (Math.hypot(m.x - here.x, m.y - here.y) > 13) { m.armed = true; continue; }
    if (!m.armed) continue; m.armed = false;
    if (m.heal) { if (P.hp >= 100) flash('YOU LOOK FINE', '#ff9ad0', 1.2); else if (P.money < 50) flash('TREATMENT COSTS $50', '#ff9ad0', 1.6); else { P.money -= 50; P.hp = 100; flash('PATCHED UP', '#ff9ad0'); } }
    else if (m.shop) { const w = [1, 2, 3].find(i => !P.has[i]), cost = w ? GUNS[w].price : 120;
      if (P.money < cost) flash(`${w ? GUNS[w].name.toUpperCase() : 'AMMO'} COSTS $${cost}`, '#ff9a3a', 1.6); else { P.money -= cost; if (w) { P.has[w] = true; P.ammo[w] += GUNS[w].pack; P.weapon = w; flash(GUNS[w].name.toUpperCase(), '#ff9a3a'); } else { for (const i of [1, 2, 3]) P.ammo[i] += GUNS[i].pack; flash('AMMO', '#ff9a3a'); } save(); } }
    else if (m.respray) { if (!P.car) flash('BRING A CAR', '#5ee0e0', 1.4); else if (P.money < 150) flash('RESPRAY COSTS $150', '#5ee0e0', 1.6); else { P.money -= 150; P.heat = 0; P.car.hp = 100; P.car.cop = false; P.car.name = CIVS.filter(n => n !== P.car.name)[rnd() * (CIVS.length - 1) | 0]; flash('RESPRAYED', '#5ee0e0'); } }
    else { job = JOBS[m.contact](); job.i = 0; job.clock = job.steps[0].time || 0; job.hold = 0; flash(job.name.toUpperCase(), m.col, 1.6); if (job.steps[0].start) job.steps[0].start(); }
  }
  if (job) {
    const s = job.steps[job.i], kind = P.car && KIND_OF(P.car.name);
    let done = false;
    if (s.time) { job.clock -= dt; if (job.clock <= 0) return endJob(false, 'OUT OF TIME'); }
    if (s.kill) done = s.kill.length > 0 && s.kill.every(g => g.dead);
    else if (s.go) done = Math.hypot(s.go.x - here.x, s.go.y - here.y) < 16 && (!s.car || (P.car && (s.car === true || s.car === kind))) && (!s.stop || speedOf() < 22);
    if (s.wait) { job.hold = Math.hypot(SPOT.bank.x - here.x, SPOT.bank.y - here.y) < 24 ? job.hold + dt : 0; done = job.hold >= s.wait; }
    if (s.lose) done = level() === 0;
    if (done) {
      if (s.done) s.done();
      if (s.take && P.car) { const c = P.car; action(); cars.splice(cars.indexOf(c), 1); }
      if (++job.i >= job.steps.length) endJob(true); else { job.hold = 0; if (job.steps[job.i].time) job.clock = job.steps[job.i].time; if (job.steps[job.i].start) job.steps[job.i].start(); }
    }
  }
  // camera leads the car a little in the direction of travel
  const lead = P.car ? P.car.vel * 0.22 : 0, hx = P.car ? Math.cos(P.car.heading) : 0, hy = P.car ? Math.sin(P.car.heading) : 0;
  cam.x += (here.x + hx * lead - cam.x) * Math.min(1, 5 * dt); cam.y += (here.y + hy * lead - cam.y) * Math.min(1, 5 * dt);
}

// ---------- render ----------
const scene = $('scene'), R = Renderer(scene, SIZE), mini = $('mini').getContext('2d');
const OPT = { scale: 1, explode: 1, zscale: 1, light: true, shade: true };
const objective = () => job ? (job.steps[job.i].go || (job.steps[job.i].wait && SPOT.bank) || null) : null;
// ---------- combat ----------
const GUNS = [
  { name: 'Fists', melee: true, rate: .35, dmg: 14, range: 14 },
  { name: 'Pistol', rate: .3, dmg: 16, range: 230, pellets: 1, spread: .03, price: 200, pack: 40 },
  { name: 'Shotgun', rate: .85, dmg: 11, range: 130, pellets: 6, spread: .16, price: 500, pack: 16 },
  { name: 'SMG', rate: .085, dmg: 9, range: 210, pellets: 1, spread: .07, price: 800, pack: 90 },
];
const gunmen = [], pickups = [], tracers = [];
const wallAt = (x, y) => { let hit = false; nearCells(x, y, 1, e => { if (!hit && e.box) hit = Math.abs(x - e.x) < e.box.hw && Math.abs(y - e.y) < e.box.hl; }); return hit; };
const losClear = (ax, ay, bx, by) => { const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 6); for (let i = 1; i < n; i++) if (wallAt(ax + (bx - ax) * i / n, ay + (by - ay) * i / n)) return false; return true; };
function spawnGunman(kind, x, y, o = {}) { const g = { kind, x, y, rot: rnd() * 6.28, hp: kind === 'cop' ? 40 : 35, cool: .6 + rnd(), t: rnd() * 5, seeT: 0, see: false, hostile: kind === 'cop', flash: 0, ...o }; gunmen.push(g); return g; }
function save() { try { localStorage.setItem('getaway1', JSON.stringify({ money: P.money, rep: P.rep, has: P.has, ammo: P.ammo, won: P.won })); } catch (e) { /* storage unavailable */ } }
function hurtPlayer(d) {
  if (P.car) { damage(P.car, d * 0.35); return; }                     // inside a car the bodywork takes it
  const soak = Math.min(P.armor, d * 0.6); P.armor -= soak; P.hp -= d - soak; P.hurt = .35;
  if (P.hp > 0) return;
  const bill = Math.min(P.money, 150); P.money -= bill; if (job) job = null;                   // patched up at the hospital; they keep your guns
  flash(`HOSPITALISED  -$${bill}`, '#ff9ad0', 3); P.hp = 100; P.armor = 0; P.has = [true, false, false, false]; P.ammo = [0, 0, 0, 0]; P.weapon = 0;
  P.x = SPOT.hospital.x; P.y = SPOT.hospital.y + 26; P.heat = 0; P.bust = 0; gunmen.length = 0; for (const c of cars) if (c.chase) patrol(c); save();
}
function hurtNPC(g, dmg, fromX, fromY) {
  if (g.dead) return;
  g.hp -= dmg; g.hostile = true; g.flash = .1;
  if (g.hp > 0) return;
  g.dead = true; const a = Math.atan2(g.y - fromY, g.x - fromX); g.pose = { dx: Math.cos(a), dy: Math.sin(a), a: 0, t: 0 };
  addHeat(g.kind === 'cop' ? 120 : 6);
  if (rnd() < .7) pickups.push({ kind: rnd() < .5 ? 'cash' : 'ammo', x: g.x, y: g.y, temp: 30 });
}
function boom(x, y, owner) {                                         // a car going up: hurts everything close by
  for (let i = 0; i < 14; i++) fx.push({ x: x + (rnd() - .5) * 22, y: y + (rnd() - .5) * 22, lift: 4 + rnd() * 10, t: rnd() * .5 });
  for (const g of gunmen) if (Math.hypot(g.x - x, g.y - y) < 42) hurtNPC(g, 90, x, y);
  for (const p of peds) if (!p.down && Math.hypot(p.x - x, p.y - y) < 36) knockDown(p, x, y);
  for (const c of cars) if (c !== owner && !c.wreck && Math.hypot(c.x - x, c.y - y) < 44) shootCar(c, 45);
  if (!P.car && Math.hypot(P.x - x, P.y - y) < 42) hurtPlayer(45);
}
function shootCar(c, dmg) {
  if (c.wreck) return;
  c.hp -= dmg; if (c.ai) c.ai.pause = .6;
  if (c.hp > 0) return;
  c.hp = 0; c.wreck = true; c.name = 'wreck'; if (c.ai || c.chase) addHeat(c.cop ? 120 : 60); c.ai = null; c.chase = false;
  if (c === P.car) { action(); hurtPlayer(25); if (job && job.steps[job.i].car) endJob(false, 'JOB FAILED: car destroyed'); }
  boom(c.x, c.y, c);
}
function knockDown(p, fromX, fromY) { const a = Math.atan2(p.y - fromY, p.x - fromX); p.down = { dx: Math.cos(a), dy: Math.sin(a), a: 0, t: 0 }; addHeat(40); }
function attack() {
  const g = GUNS[P.weapon];
  if (P.cool > 0 || P.car) return;
  if (!g.melee && P.ammo[P.weapon] <= 0) { P.weapon = [3, 2, 1].find(i => P.has[i] && P.ammo[i] > 0) || 0; P.cool = .2; return; }
  P.cool = g.rate; P.swing = .15;
  const targets = [...gunmen.filter(t => !t.dead).map(t => [t, 4, .45]), ...peds.filter(t => !t.down && !t.flee).map(t => [t, 4, 1]), ...cars.filter(t => !t.wreck).map(t => [t, 9, 2.5])];
  let aim = P.yaw, best = 1e9;                                       // aim assist: snap to the best target in a cone ahead
  for (const [t, , w] of targets) { const dx = t.x - P.x, dy = t.y - P.y, d = Math.hypot(dx, dy), off = Math.abs(wrap(Math.atan2(dy, dx) - P.yaw)); if (d > 3 && d < g.range && off < (g.melee ? 1 : .32) && d * (1 + off * 2) * w < best) { best = d * (1 + off * 2) * w; aim = Math.atan2(dy, dx); } }
  if (g.melee) { const hit = targets.find(([t]) => Math.hypot(t.x - P.x, t.y - P.y) < g.range && Math.abs(wrap(Math.atan2(t.y - P.y, t.x - P.x) - aim)) < .5 && !t.name); if (hit) { const t = hit[0]; if (t.kind) hurtNPC(t, g.dmg, P.x, P.y); else { t.panic = 6; addHeat(10); if ((t.hits = (t.hits || 0) + 1) > 2) knockDown(t, P.x, P.y); } } return; }
  P.ammo[P.weapon]--; P.noise = 1;
  for (let k = 0; k < g.pellets; k++) {
    const a = aim + (rnd() - .5) * 2 * g.spread, dx = Math.cos(a), dy = Math.sin(a);
    let end = g.range; for (let d = 6; d < g.range; d += 5) if (wallAt(P.x + dx * d, P.y + dy * d)) { end = d; break; }
    let hit = null;
    for (const [t, r] of targets) { const rx = t.x - P.x, ry = t.y - P.y, along = rx * dx + ry * dy; if (along > 2 && along < end && Math.abs(rx * dy - ry * dx) < r) { end = along; hit = t; } }
    if (hit) { if (hit.kind) hurtNPC(hit, g.dmg, P.x, P.y); else if (hit.name) shootCar(hit, g.dmg * 0.55); else knockDown(hit, P.x, P.y); }
    tracers.push({ x1: P.x + dx * 6, y1: P.y + dy * 6, x2: P.x + dx * end, y2: P.y + dy * end, t: 0 });
  }
}
function updateCombat(dt) {
  const here = pos(), lv = level();
  P.cool -= dt; P.swing -= dt; P.hurt -= dt;
  if (!P.car && (keys[' '] || keys.fire)) attack();
  if (P.noise > 0) {                                                  // gunfire: bystanders run, gangs turn hostile, nearby police take notice
    P.noise = 0;
    for (const p of peds) if (Math.hypot(p.x - P.x, p.y - P.y) < 170) p.panic = 6;
    for (const g of gunmen) if (g.kind === 'gang' && Math.hypot(g.x - P.x, g.y - P.y) < 230) g.hostile = true;
    if (P.shotCd <= 0 && cars.some(c => c.cop && !c.wreck && Math.hypot(c.x - P.x, c.y - P.y) < 230)) { addHeat(35); P.shotCd = 1.5; }
  }
  P.shotCd -= dt;
  for (let i = gunmen.length - 1; i >= 0; i--) {
    const g = gunmen[i]; if (!g) continue;                            // the list is emptied if you are knocked out mid-loop
    const d = Math.hypot(here.x - g.x, here.y - g.y);
    if (g.dead) { g.pose.t += dt; g.pose.a = 1.45 * Math.min(1, Math.pow(g.pose.t / .4, 2)); if (g.pose.t > 20 && d > 300) gunmen.splice(i, 1); continue; }
    g.flash -= dt;
    if (g.kind === 'cop' && lv === 0 && (g.idle = (g.idle || 0) + dt) > 6) { gunmen.splice(i, 1); continue; }
    g.seeT -= dt; if (g.seeT <= 0) { g.seeT = .25; g.see = d < 240 && losClear(g.x, g.y, here.x, here.y); }
    if (!g.hostile) { if (!P.car && d < 80 && g.see) g.hostile = true; else { g.rot += dt * .4; continue; } }
    g.rot = Math.atan2(here.y - g.y, here.x - g.x) - Math.PI / 2;
    if (d > (g.kind === 'cop' ? 22 : 70) || !g.see) {                 // close the distance
      const sp = (g.kind === 'cop' ? 44 : 36) * dt, mx = (here.x - g.x) / d * sp, my = (here.y - g.y) / d * sp;
      if (!hitStatic(g.x + mx, g.y, 3)) g.x += mx; if (!hitStatic(g.x, g.y + my, 3)) g.y += my; g.t += dt;
    }
    g.cool -= dt;
    if (g.see && d < 210 && g.cool <= 0 && (g.kind === 'gang' || lv >= 2)) {
      g.cool = .8 + rnd() * .8;
      const hit = rnd() < Math.max(.12, Math.min(.7, .75 - d / 300)), a = Math.atan2(here.y - g.y, here.x - g.x) + (hit ? 0 : (rnd() < .5 ? -1 : 1) * (.08 + rnd() * .1));
      tracers.push({ x1: g.x, y1: g.y, x2: g.x + Math.cos(a) * (hit ? d : d + 40), y2: g.y + Math.sin(a) * (hit ? d : d + 40), t: 0 });
      if (hit) hurtPlayer(g.kind === 'cop' ? 8 : 7);
    }
    if (g.kind === 'cop' && d < 18 && speedOf() < 22) P.bust += dt * 1.6;
    if (P.car && d < 10 && Math.abs(P.car.vel) > 55) hurtNPC(g, 100, P.car.x, P.car.y);                  // run down
  }
  // officers get out of a patrol car that has caught up with you
  if (lv >= 2 && gunmen.filter(g => g.kind === 'cop' && !g.dead).length < 5) for (const c of cars) if (c.chase && !c.wreck && Math.abs(c.vel) < 30 && speedOf() < 45 && Math.hypot(c.x - here.x, c.y - here.y) < 75) {
    c.chase = false; c.ai = null; spawnGunman('cop', c.x + Math.sin(c.heading) * 14, c.y - Math.cos(c.heading) * 14); break;
  }
  for (const p of peds) { if (p.panic > 0) p.panic -= dt; if (p.down) { p.down.t += dt; p.down.a = 1.45 * Math.min(1, Math.pow(p.down.t / .4, 2)); if (p.down.t > 30 && Math.hypot(p.x - here.x, p.y - here.y) > 320) { p.down = null; p.hits = 0; } } }
  for (let i = tracers.length - 1; i >= 0; i--) if ((tracers[i].t += dt) > .07) tracers.splice(i, 1);
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i];
    if (k.temp != null && (k.temp -= dt) <= 0) { pickups.splice(i, 1); continue; }
    if (k.wait > 0) { k.wait -= dt; continue; }
    if (P.car || Math.hypot(k.x - P.x, k.y - P.y) > 10) continue;
    let msg = null;
    if (k.kind === 'cash') { const n = 20 + (rnd() * 60 | 0); P.money += n; msg = `+$${n}`; }
    else if (k.kind === 'ammo') { const w = [3, 2, 1].find(i2 => P.has[i2]); if (w) { P.ammo[w] += GUNS[w].pack / 2 | 0; msg = `${GUNS[w].name} ammo`; } }
    else if (k.kind === 'med') { if (P.hp < 100) { P.hp = Math.min(100, P.hp + 50); msg = 'First aid'; } }
    else if (k.kind === 'vest') { if (P.armor < 100) { P.armor = 100; msg = 'Body armour'; } }
    else { const w = k.kind; P.has[w] = true; P.ammo[w] += GUNS[w].pack; P.weapon = w; msg = GUNS[w].name.toUpperCase(); }
    if (!msg) continue;
    flash(msg, '#fff3b0', 1.1);
    if (k.respawn) k.wait = k.respawn; else pickups.splice(i, 1);
  }
}
// the Dockers hang around the container yards; weapons and first aid are scattered around town
for (const [bi, bj] of [[7, 7], [8, 7], [7, 8], [8, 8], [6, 8]]) for (const s of [-28, 28]) spawnGunman('gang', rc(bi) + 90 + s, rc(bj) + 90 + 22, { turf: true });
pickups.push({ kind: 1, x: SPOT.start.x - 14, y: SPOT.start.y - 12 }, { kind: 2, x: rc(0) + 150, y: rc(2) + 90 }, { kind: 3, x: rc(8) + 90, y: rc(5) + 112 }, { kind: 'vest', x: rc(4) + 90, y: rc(1) + 148, respawn: 90 }, { kind: 'vest', x: rc(1) + 90, y: rc(7) + 90, respawn: 90 });
for (const [bi, bj] of [[0, 0], [5, 0], [8, 3], [2, 5], [6, 5], [0, 8], [8, 8], [4, 6]]) pickups.push({ kind: 'med', x: rc(bi) + 32, y: rc(bj) + 32, respawn: 45 });

function render(now) {
  if (!R) { $('stats').textContent = 'WebGL is not available in this browser.'; return; }
  const W = scene.width, H = scene.height, cx = W / 2, cy = H / 2 + 14, fp = P.view === 'fp';
  const eye = fp ? (P.car ? { x: P.car.x + Math.cos(P.car.heading) * 6, y: P.car.y + Math.sin(P.car.heading) * 6, yaw: P.car.heading } : { x: P.x, y: P.y, yaw: P.yaw }) : null;
  const squash = Math.sin(PITCH), lift = Math.cos(PITCH), c = Math.cos(-cam.a), s = Math.sin(-cam.a);
  R.begin(PITCH, cx, cy, fp ? FP.fog.map(v => v / 255) : [0.17, 0.42, 0.29], eye, fp);
  R.ground(ground, cam);
  const list = [];
  const see = (x, y, m) => {                                          // is this object in view?
    const mr = Math.hypot(m.W, m.L) / 2;
    if (fp) { const fx2 = Math.cos(eye.yaw), fy2 = Math.sin(eye.yaw), ex = x - eye.x, ey = y - eye.y, f = ex * fx2 + ey * fy2; return f > -mr && f < FP.far + mr && Math.abs(ey * fx2 - ex * fy2) < f * 0.95 + mr + 10; }
    const dx = x - cam.x, dy = y - cam.y, sx = cx + dx * c - dy * s, sy = cy + (dx * s + dy * c) * squash;
    return sx > -mr && sx < W + mr && sy > -mr && sy < H + mr + m.H * lift;
  };
  const add = (name, x, y, rot, pose) => { const m = mesh(name); if (see(x, y, m)) list.push([m, x, y, rot, pose]); };
  const centre = fp ? eye : cam;
  nearCells(centre.x, centre.y, fp ? 4 : 2, e => add(e.name, e.x, e.y, e.rot, e.pose));
  for (const car of cars) if (!(fp && car === P.car)) add(car.name, car.x, car.y, car.heading - Math.PI / 2);
  for (const p of peds) add('walker' + p.look + ((p.t * (p.panic > 0 ? 8 : 3.4) | 0) & 1 && !p.down ? 'b' : ''), p.x, p.y, p.rot, p.down);
  for (const g of gunmen) add((g.kind === 'cop' ? 'copf' : 'gang') + ((g.t * 4 | 0) & 1 && !g.dead ? 'b' : ''), g.x, g.y, g.rot, g.dead ? g.pose : g.flash > 0 ? { flash: .8 } : null);
  for (const k of pickups) if (!(k.wait > 0)) add('pk_' + k.kind, k.x, k.y, now * 0.002, { lift: 2 + Math.sin(now * 0.004 + k.x) });
  for (const t of tracers) for (const u of [.25, .5, .75, 1]) add('tracer', t.x1 + (t.x2 - t.x1) * u, t.y1 + (t.y2 - t.y1) * u, 0, { lift: 7 });
  if (!P.car && !fp) add('walker2' + ((P.t * 3.4 | 0) & 1 ? 'b' : ''), P.x, P.y, P.yaw - Math.PI / 2);
  for (const f of fx) add('puff', f.x, f.y, f.t * 3, { lift: f.lift });
  if (!job) for (const m of markers) add(m.ring, m.x, m.y, now * 0.002);
  const goal = objective();
  if (goal) { add('ring_w', goal.x, goal.y, now * 0.002); add('arrow', goal.x, goal.y, now * 0.003, { lift: 16 + Math.sin(now * 0.005) * 3 }); }
  for (const o of list) R.draw(o[0], o[1], o[2], o[3], cam, OPT, 'shadow', o[4]);
  for (const o of list) R.draw(o[0], o[1], o[2], o[3], cam, OPT, null, o[4]);
  R.end();
  $('stats').textContent = `${list.length} objects, ${Math.round(R.stats.tris / 1000)}k triangles.`;

  // HUD
  $('money').textContent = '$' + P.money.toLocaleString('en-US') + (P.rep ? ` \u00b7 ${P.rep} job${P.rep > 1 ? 's' : ''}` : '') + (P.won ? ' \u00b7 \u2605' : '');
  $('life').firstChild.style.width = Math.max(0, P.hp) + '%'; $('life').lastChild.style.width = P.armor + '%';
  $('wpn').textContent = P.car ? '' : GUNS[P.weapon].name + (P.weapon ? ' ' + P.ammo[P.weapon] : ''); $('scene').style.filter = P.hurt > 0 ? 'sepia(1) saturate(4) hue-rotate(-40deg)' : '';
  const lv = level(); $('stars').textContent = '★'.repeat(lv) + '☆'.repeat(4 - lv); $('stars').classList.toggle('hot', lv > 0);
  $('job').textContent = job ? `${job.steps[job.i].text}${job.steps[job.i].time ? ' · ' + Math.ceil(job.clock) + 's' : ''}${job.steps[job.i].wait ? ' ' + Math.ceil(job.steps[job.i].wait - job.hold) : ''}` : '';
  $('hp').style.display = P.car ? '' : 'none'; if (P.car) { $('hp').firstChild.style.width = P.car.hp + '%'; $('hp').firstChild.style.background = P.car.hp > 50 ? '#7fd45a' : P.car.hp > 25 ? '#ffcf5c' : '#ff5a5a'; }
  const near = !P.car && cars.some(car => !car.wreck && Math.hypot(car.x - P.x, car.y - P.y) < 30), label = P.car ? 'Get out (F)' : near ? 'Get in (F)' : 'On foot';
  if ($('act').textContent !== label) { $('act').textContent = label; $('act').classList.toggle('on', near); }
  const ptr = $('ptr'), here = pos(), tgt = goal || (!job && markers.slice().sort((a, b) => Math.hypot(a.x - here.x, a.y - here.y) - Math.hypot(b.x - here.x, b.y - here.y))[0]);
  if (tgt && Math.hypot(tgt.x - here.x, tgt.y - here.y) > 110) {      // arrow at the edge of the screen towards the objective (or the nearest contact)
    const dx = tgt.x - here.x, dy = tgt.y - here.y, ang = fp ? Math.atan2(dy, dx) - eye.yaw - Math.PI / 2 : Math.atan2((dx * s + dy * c) * squash, dx * c - dy * s);
    ptr.style.display = ''; ptr.style.left = 50 + Math.cos(ang) * 40 + '%'; ptr.style.top = 50 + Math.sin(ang) * 36 + '%'; ptr.style.transform = `rotate(${ang + Math.PI / 2}rad)`; ptr.style.color = goal ? '#ffcf5c' : tgt.col;
  } else ptr.style.display = 'none';
  // minimap: north up, 760 units across
  const span = 760, k = 96 / span;
  mini.fillStyle = '#1b3a2a'; mini.fillRect(0, 0, 96, 96); mini.imageSmoothingEnabled = false;
  mini.drawImage(ground, here.x - span / 2, here.y - span / 2, span, span, 0, 0, 96, 96);
  const dot = (x, y, col, r = 2) => { const mx = Math.max(2, Math.min(94, (x - here.x) * k + 48)), my = Math.max(2, Math.min(94, (y - here.y) * k + 48)); mini.fillStyle = '#000'; mini.fillRect(mx - r - 1, my - r - 1, 2 * r + 2, 2 * r + 2); mini.fillStyle = col; mini.fillRect(mx - r, my - r, 2 * r, 2 * r); };
  if (!job) for (const m of markers) dot(m.x, m.y, m.col);
  for (const car of cars) if (car.chase) dot(car.x, car.y, (now / 250 | 0) & 1 ? '#ff5a5a' : '#5aa7ff', 1.5);
  if (goal) dot(goal.x, goal.y, '#ffffff', 3);
  dot(here.x, here.y, '#ffffff', 1.5);
}

// ---------- input + loop ----------
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.repeat && (k === 'f' || k === 'v')) return;
  if (k === 'f' || k === 'enter') { action(); e.preventDefault(); return; }
  if (k === 'v') { P.view = P.view === 'top' ? 'fp' : 'top'; return; }
  if (k >= '1' && k <= '4' && P.has[+k - 1]) { P.weapon = +k - 1; return; }
  keys[k] = true; if (/^(arrow|[wasd ]$)/.test(k)) e.preventDefault();
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
{ let drag = null;
  scene.addEventListener('pointerdown', e => { drag = e.clientX; scene.setPointerCapture(e.pointerId); });
  scene.addEventListener('pointermove', e => { if (drag == null) return; const d = e.clientX - drag; drag = e.clientX; if (P.view === 'fp' && !P.car) P.yaw += d * 0.007; else cam.a += d * 0.01; });
  ['pointerup', 'pointercancel'].forEach(t => scene.addEventListener(t, () => drag = null)); }
document.querySelectorAll('#pad button').forEach(b => {
  const set = on => e => { e.preventDefault(); b.classList.toggle('down', on); if (b.dataset.k === 'next') { if (on) { let i = P.weapon; do i = (i + 1) % 4; while (!P.has[i]); P.weapon = i; } } else keys[b.dataset.k] = on; };
  b.addEventListener('pointerdown', set(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, set(false))); b.addEventListener('contextmenu', e => e.preventDefault());
});
$('act').addEventListener('click', e => { action(); e.target.blur(); });
$('view').addEventListener('click', e => { P.view = P.view === 'top' ? 'fp' : 'top'; e.target.blur(); });

let last = performance.now(), frames = 0, since = last, spent = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t0 = performance.now(); last = now;
  update(dt); render(now);
  if (big.t > 0 && (big.t -= dt) <= 0) $('big').style.opacity = 0;
  frames++; spent += performance.now() - t0;
  if (now - since >= 500) { $('fps').textContent = `${Math.round(frames * 1000 / (now - since))} fps · ${(spent / frames).toFixed(1)} ms`; frames = 0; spent = 0; since = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
