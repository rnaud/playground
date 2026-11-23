'use strict';
// Les Automates: an original first-person voxel shooter set in Paris, 1934. Everything (walls, enemies, weapons,
// pickups) is a voxel model drawn by the shared renderer; the level is a grid of 16-unit cells. The models are
// built at four voxels to the unit from the reference sheets in refs/, packed into art.js by tools/build_art.py.
function main(atlasImg) {
const WALL_FLIP = false, SPRITE_FLIP = false;                               // mirror the reference pixels if a model shows them back to front
const CS = 16, WH = 24, GW = 35, GH = 31, SIZE = GW * CS;
const rnd = mulberry32(1934), hash = (a, b) => noise3(a, b, 7);

// ---------- level: carved rooms on a grid ----------
const tiles = Array.from({ length: GH }, () => Array(GW).fill(' '));
const carve = (x0, y0, x1, y1, floor, wall) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = floor;
  if (wall) for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (tiles[y] && tiles[y][x] === ' ') tiles[y][x] = wall;
};
const doors = [];
const door = (x, y, key) => { doors.push({ cx: x, cy: y, key, open: 0, hold: 0, unlocked: !key }); tiles[y][x] = 'D'; };
// Metro station (start), service corridor and junction
carve(1, 26, 14, 27, 'm', 'M'); carve(1, 28, 14, 29, 'r', 'M'); carve(8, 21, 8, 24, 'm', 'M'); carve(5, 17, 11, 20, 'm', 'M');
carve(1, 16, 3, 20, 'b', 'B');                                          // maintenance room
// catacombs
carve(8, 12, 8, 16, 'c', 'C'); carve(2, 12, 11, 12, 'c', 'C'); carve(2, 5, 2, 12, 'c', 'C'); carve(11, 6, 11, 12, 'c', 'C');
carve(2, 1, 7, 4, 'c', 'K'); carve(5, 7, 8, 10, 'c', 'K'); carve(9, 9, 10, 9, 'c', 'C'); carve(10, 4, 11, 5, 'c', 'K');
// wine cellar, chateau hall, library, salon
carve(13, 18, 15, 18, 'b', 'B'); carve(16, 14, 24, 22, 'b', 'B'); for (const [x, y] of [[18, 16], [22, 16], [18, 20], [22, 20]]) tiles[y][x] = 'B';
carve(16, 6, 24, 12, 'w', 'W'); carve(19, 6, 21, 12, 'k'); carve(16, 1, 19, 4, 'w', 'W'); carve(21, 1, 24, 4, 'k', 'W');
// courtyard (open sky) and the Baron's workshop
carve(26, 4, 33, 14, 'g', 'S'); carve(26, 9, 33, 9, 'o'); carve(30, 9, 30, 14, 'o');
for (const [x, y] of [[28, 6], [28, 7], [32, 6], [31, 6], [27, 12], [28, 12], [32, 11], [32, 12]]) tiles[y][x] = 'H';
carve(26, 16, 33, 24, 'i', 'I'); for (const [x, y] of [[28, 18], [31, 18], [28, 22], [31, 22]]) tiles[y][x] = 'G';
carve(30, 25, 30, 25, 'i', 'I');
door(8, 25); door(4, 18); door(12, 18, 'blue'); door(20, 13); door(17, 5); door(23, 5); door(25, 9); door(30, 15, 'red');
// wall variety: posters, station signs and lamps, wine racks, paintings, windows, pipework and machinery
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
  const t = tiles[y][x], h = hash(x * 3, y * 5);
  if (t === 'M' && h < .24) tiles[y][x] = h < .08 ? 'P' : h < .16 ? 'N' : 'L';
  if (t === 'B' && x > 14 && h < .3) tiles[y][x] = 'V';
  if (t === 'W' && h < .22) tiles[y][x] = 'F';
  if (t === 'S' && h < .3) tiles[y][x] = 'X';
  if (t === 'I' && h < .55) tiles[y][x] = h < .3 ? 'G' : h < .42 ? 'T' : 'Y';
}
const FLOORS = 'mrcbwkgoiD', isFloor = t => FLOORS.includes(t);
const tile = (cx, cy) => cx < 0 || cy < 0 || cx >= GW || cy >= GH ? ' ' : tiles[cy][cx];
const doorAt = (cx, cy) => doors.find(d => d.cx === cx && d.cy === cy);
for (const d of doors) { d.vertical = !isFloor(tile(d.cx - 1, d.cy)); d.floor = d.vertical ? tile(d.cx, d.cy - 1) : tile(d.cx - 1, d.cy); d.x = d.cx * CS + 8; d.y = d.cy * CS + 8; }
// solid for movement and bullets: walls, and doors that are not open enough
const solidCell = (cx, cy) => { const t = tile(cx, cy); if (t === 'D') return doorAt(cx, cy).open < 0.7; return !isFloor(t); };
const solidAtPt = (x, y) => solidCell(Math.floor(x / CS), Math.floor(y / CS));
const boxHits = (x, y, r) => solidAtPt(x - r, y - r) || solidAtPt(x + r, y - r) || solidAtPt(x - r, y + r) || solidAtPt(x + r, y + r);

// ---------- art: every surface and model is built from the atlas of reference pixels (see tools/build_art.py) ----------
// One atlas pixel is one voxel: an eighth of a world unit on walls, a quarter on objects. Walls become relief
// panels, objects are inflated, lathed or extruded from their front views.
const VPU = 4, VOX = 1 / VPU, WPU = 8, WV = CS * WPU, HV = WH * WPU, THICK = WPU;
const atlasCv = mkCanvas(atlasImg.width, atlasImg.height), AW = atlasImg.width;
atlasCv.getContext('2d').drawImage(atlasImg, 0, 0);
const AD = atlasCv.getContext('2d').getImageData(0, 0, AW, atlasImg.height).data;
const shade = (c, k) => Math.min(255, (c >> 16 & 255) * k | 0) << 16 | Math.min(255, (c >> 8 & 255) * k | 0) << 8 | Math.min(255, (c & 255) * k | 0);
// A sprite: colours with the bottom row first, -1 where empty. Asking for a size resamples it; `flip` mirrors it.
function sprite(name, w, h, flip) {
  const r = ART.rects[name], W = w || (r ? r[2] : 24), H = h || (r ? r[3] : 24), c = new Int32Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const xx = flip ? W - 1 - x : x;
    if (!r) { c[z * W + x] = ((x >> 2) + (z >> 2)) & 1 ? 0xc040c0 : 0x402040; continue; }                 // a sheet that has not been generated yet
    const i = ((r[1] + r[3] - 1 - (z * r[3] / H | 0)) * AW + r[0] + (xx * r[2] / W | 0)) * 4;
    c[z * W + x] = AD[i + 3] < 128 ? -1 : AD[i] << 16 | AD[i + 1] << 8 | AD[i + 2];
  }
  return { name, w: W, h: H, c };
}
const voxOpt = vox => ({ scale: 1, explode: 1, zscale: 1, light: false, shade: false, vox });             // shading is baked into the colours
const VO = voxOpt(VOX), WO = voxOpt(1 / WPU), FAR_O = voxOpt(1 / 2);
const model = (name, W, L, H, fn, vox = VOX) => { def(name, W, L, H, fn); MODEL_DEFS[name].o = voxOpt(vox); };

// ---------- walls: one relief panel per wall material, drawn on every side that faces a floor ----------
// Relief comes from the picture itself: pixels darker than their surroundings (joints, sockets, grooves) sit further back.
function relief(s) {
  const { w, h, c } = s, lum = new Float32Array(w * h), dep = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = (c[i] >> 16 & 255) * .3 + (c[i] >> 8 & 255) * .59 + (c[i] & 255) * .11;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    let sum = 0, n = 0;
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const zz = z + dz; if (zz < 0 || zz >= h) continue; sum += lum[zz * w + (x + dx + w) % w]; n++; }
    const l = lum[z * w + x], diff = sum / n - l;
    dep[z * w + x] = l < 42 ? 6 : diff > 34 ? 4 : diff > 12 ? 2 : 0;
  }
  const out = new Uint8Array(w * h);                                                                      // drop single-pixel specks, keep lines
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {
    const m = [dep[z * w + x], dep[z * w + (x + 1) % w], dep[z * w + (x + w - 1) % w], dep[Math.min(h - 1, z + 1) * w + x], dep[Math.max(0, z - 1) * w + x]].sort((a, b) => a - b);
    out[z * w + x] = m[2];
  }
  return out;
}
function panelMesh(name, s, flat, thick) {
  const { w, h, c } = s, dep = flat ? new Uint8Array(w * h) : relief(s), v = [], col = new Int32Array(w * h), done = new Uint8Array(w * h);
  const D = (x, z) => dep[z * w + x];
  const quad = (p, k, n) => { for (const i of [0, 1, 2, 0, 2, 3]) v.push(p[i][0] - w / 2, p[i][1], 0, p[i][2], (k >> 16 & 255) / 255, (k >> 8 & 255) / 255, (k & 255) / 255, n[0], n[1], n[2]); };
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {                                               // soft contact shadow where a neighbour stands proud
    const d = D(x, z); let occ = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < w && zz >= 0 && zz < h) occ += Math.min(4, Math.max(0, d - D(xx, zz))); }
    col[z * w + x] = shade(c[z * w + x], Math.max(.6, 1 - occ * .045));
  }
  for (let z = 0; z < h; z++) {
    for (let x = 0; x < w; x++) {                                                                         // front faces, merged into the largest rectangles of one colour and depth
      if (done[z * w + x]) continue;
      const d = D(x, z), k = col[z * w + x], same = (xx, zz) => !done[zz * w + xx] && D(xx, zz) === d && col[zz * w + xx] === k;
      let e = x + 1, t = z + 1;
      while (e < w && same(e, z)) e++;
      grow: for (; t < h; t++) for (let xx = x; xx < e; xx++) if (!same(xx, t)) break grow;
      for (let zz = z; zz < t; zz++) done.fill(1, zz * w + x, zz * w + e);
      quad([[x, -d, z], [e, -d, z], [e, -d, t], [x, -d, t]], k, [0, 1, 0]);
    }
    for (let x = 0; x <= w; x++) {                                                                        // steps between columns, and the two ends
      const a = x === 0 ? thick : D(x - 1, z), b = x === w ? thick : D(x, z);
      if (a < b) quad([[x, -b, z], [x, -a, z], [x, -a, z + 1], [x, -b, z + 1]], shade(c[z * w + x - 1], .82), [1, 0, 0]);
      else if (a > b) quad([[x, -a, z], [x, -b, z], [x, -b, z + 1], [x, -a, z + 1]], shade(c[z * w + x], .82), [-1, 0, 0]);
    }
    if (z < h - 1) for (let x = 0; x < w; x++) {                                                          // ledges and their undersides
      const a = D(x, z), b = D(x, z + 1);
      if (a < b) quad([[x, -b, z + 1], [x + 1, -b, z + 1], [x + 1, -a, z + 1], [x, -a, z + 1]], shade(c[z * w + x], 1.08), [0, 0, 1]);
      else if (a > b) quad([[x, -a, z + 1], [x + 1, -a, z + 1], [x + 1, -b, z + 1], [x, -b, z + 1]], shade(c[(z + 1) * w + x], .6), [0, 0, -1]);
    }
  }
  return { name, W: w, L: thick, H: h, data: new Float32Array(v), count: v.length / 10, top: new Float32Array(0), topCount: 0 };
}
const WALL_BASE = { P: 'M', N: 'M', L: 'M', V: 'B', F: 'W', X: 'S', G: 'I', T: 'I', Y: 'I' };              // a variant falls back to its plain wall until its sheet exists
const wallSprite = t => sprite(ART.rects['wall_' + t] ? 'wall_' + t : 'wall_' + (WALL_BASE[t] || t), WV, HV, WALL_FLIP);
const PANEL = {}, panelFor = (t, flat) => PANEL[t + flat] || (PANEL[t + flat] = panelMesh(`panel_${t}_${flat}`, wallSprite(t), flat, THICK));
const FAR = {}, farFor = t => FAR[t] || (FAR[t] = panelMesh('far_' + t, sprite(wallSprite(t).name, CS * 2, WH * 2, WALL_FLIP), 1, 2));   // a coarse flat panel for distant walls
const POST = {}, postFor = t => POST[t] || (POST[t] = (s => buildMesh({ name: 'post_' + t, W: THICK, L: THICK, H: HV, fn: (x, y, z) => shade(s.c[z * WV + x], .9) }))(wallSprite(WALL_BASE[t] || t)));
const opens = (cx, cy) => { const t = tile(cx, cy); return isFloor(t) || t === 'H'; };
const panels = [], posts = [], hedges = [];
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
  const t = tile(cx, cy), x = cx * CS + 8, y = cy * CS + 8;
  if (t === 'H') { hedges.push({ x, y }); continue; }
  if (t === ' ' || isFloor(t)) continue;
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (opens(cx + sx, cy + sy))               // beside a door the panel stays flat so the door closes without gaps
    panels.push({ m: panelFor(t, tile(cx + sx, cy + sy) === 'D' ? 1 : 0), far: farFor(t), x: x + sx * 8, y: y + sy * 8, rot: Math.atan2(-sx, sy), nx: sx, ny: sy });
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (opens(cx + sx, cy + sy) && !opens(cx + sx, cy) && !opens(cx, cy + sy))   // inside corners get a post
    posts.push({ m: postFor(t), x: x + sx * 7.5, y: y + sy * 7.5 });
}
model('hedge', CS * VPU, CS * VPU, 52, (x, y, z) => { const n = noise3(x >> 1, y >> 1, z >> 1), m = noise3(x, y, z); return shade(n > .7 ? 0x3f9a3e : n > .3 ? 0x2f8a3c : 0x236e30, (z > 49 ? 1.15 : .8 + z / 260) * (m > .8 ? 1.12 : m < .15 ? .85 : 1)); });

// ---------- floors and ceilings: each reference picture covers 2 x 2 cells ----------
const floorTex = mkCanvas(SIZE * WPU, SIZE * WPU), ceilTex = mkCanvas(SIZE * WPU, SIZE * WPU);
{
  const fg = floorTex.getContext('2d'), cg = ceilTex.getContext('2d');
  const FLOOR_ART = { m: 'metro', r: 'rails', c: 'earth', b: 'flag', w: 'parquet', k: 'carpet', g: 'lawn', o: 'cobble', i: 'plate' };
  const CEIL_ART = { m: 'metro', r: 'metro', c: 'stone', b: 'brick', w: 'salon', k: 'salon', i: 'iron' };
  const blit = (g, name, cx, cy) => {
    const r = ART.rects[name];
    if (r) g.drawImage(atlasCv, r[0] + (cx & 1) * WV, r[1] + (cy & 1) * WV, WV, WV, cx * WV, cy * WV, WV, WV);
    else { g.fillStyle = (cx + cy) & 1 ? '#c040c0' : '#402040'; g.fillRect(cx * WV, cy * WV, WV, WV); }
  };
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    let t = tile(cx, cy); if (t === 'D') t = doorAt(cx, cy).floor;
    if (!isFloor(t)) continue;
    blit(fg, 'floor_' + FLOOR_ART[t], cx, cy);
    const X = cx * WV, Y = cy * WV;
    if (t === 'm' && tile(cx, cy + 1) === 'r') { fg.fillStyle = '#f2f1ea'; fg.fillRect(X, Y + WV - 28, WV, 28); fg.fillStyle = '#24406e'; fg.fillRect(X, Y + WV - 36, WV, 8); }   // platform edge
    if (t === 'k') for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tile(cx + sx, cy + sy) !== 'k') {                                                        // carpet border
      const band = (o, wd, colr) => { fg.fillStyle = colr; if (sx) fg.fillRect(sx > 0 ? X + WV - o - wd : X + o, Y, wd, WV); else fg.fillRect(X, sy > 0 ? Y + WV - o - wd : Y + o, WV, wd); };
      band(0, 6, '#5e1218'); band(6, 12, '#c9a23a');
    }
    if (CEIL_ART[t]) blit(cg, 'ceil_' + CEIL_ART[t], cx, cy);                                             // grass and paths are under open sky
  }
}

// ---------- models from front views ----------
function edgeDist(s) {                                                        // how far each pixel is from the outline
  const { w, h, c } = s, d = new Float32Array(w * h), at = (x, z) => x < 0 || z < 0 || x >= w || z >= h ? 0 : d[z * w + x];
  for (let i = 0; i < w * h; i++) d[i] = c[i] < 0 ? 0 : 1e6;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) if (d[z * w + x]) d[z * w + x] = Math.min(d[z * w + x], at(x - 1, z) + 1, at(x, z - 1) + 1, at(x - 1, z - 1) + 1.4, at(x + 1, z - 1) + 1.4);
  for (let z = h - 1; z >= 0; z--) for (let x = w - 1; x >= 0; x--) if (d[z * w + x]) d[z * w + x] = Math.min(d[z * w + x], at(x + 1, z) + 1, at(x, z + 1) + 1, at(x + 1, z + 1) + 1.4, at(x - 1, z + 1) + 1.4);
  return d;
}
// Inflate a silhouette: thick in the middle, thin at the outline. `legs` lets the two halves of the bottom stride.
function inflate(s, T, o = {}) {
  const { w, h, c } = s, d = edgeDist(s), L = T + (o.legs ? 8 : 0) + 2, legs = (o.legs || 0) * h;
  return { W: w, L, H: h, fn: st => (x, y, z) => {
    const k = c[z * w + x]; if (k < 0) return null;
    const half = Math.min(T / 2, .6 + d[z * w + x] * (o.round || .9)), yy = y + .5 - L / 2 - (z < legs ? (x < w / 2 ? st : -st) * 3 : 0);
    return Math.abs(yy) > half ? null : o.even || yy > half - 1.6 ? k : shade(k, .72);
  } };
}
function lathe(name, s) {                                                     // spin a symmetric front view around its axis
  const { w, h, c } = s, rad = new Float32Array(h), mid = new Float32Array(h);
  for (let z = 0; z < h; z++) { let a = -1, b = -1; for (let x = 0; x < w; x++) if (c[z * w + x] >= 0) { if (a < 0) a = x; b = x; } if (a >= 0) { rad[z] = (b - a + 1) / 2; mid[z] = (a + b) / 2; } }
  model(name, w, w, h, (x, y, z) => {
    const r = rad[z], dx = x + .5 - w / 2, dy = y + .5 - w / 2;
    if (!r || Math.hypot(dx, dy) > r) return null;
    let a = Math.atan2(dx, dy); if (Math.abs(a) > Math.PI / 2) a = Math.sign(a) * (Math.PI - Math.abs(a));
    const k = c[z * w + Math.round(mid[z] + a / (Math.PI / 2) * (r - .5))];
    return k < 0 ? c[z * w + Math.round(mid[z])] : k;
  });
}
const box = (name, s, D) => model(name, s.w, D, s.h, (x, y, z) => { const k = s.c[z * s.w + x]; return k < 0 ? null : y === 0 || y === D - 1 ? k : shade(k, .85); });
// the Baron's machines: frames w and b walk, a attacks
for (const [n, T, legs] of [['automate', 12, .36], ['scaphandre', 24, .34], ['colosse', 30, .34]]) {
  const m = inflate(sprite(n, 0, 0, SPRITE_FLIP), T, { legs });
  for (const [f, st] of [['w', -1], ['b', 1], ['a', 0]]) model(`${n}_${f}`, m.W, m.L, m.H, m.fn(st));
}
{ const s = sprite('lanterne', 0, 0, SPRITE_FLIP), m = inflate(s, Math.round(s.w * .7), { round: 1.1 }); for (const f of ['w', 'b']) model('lanterne_' + f, m.W, m.L, m.H, m.fn(0)); }
box('a_door', sprite('door', CS * VPU, WH * VPU), 16); box('a_door_red', sprite('door_red', CS * VPU, WH * VPU), 16); box('a_door_blue', sprite('door_blue', CS * VPU, WH * VPU), 16);
box('a_key_red', sprite('key_red'), 3); box('a_key_blue', sprite('key_blue'), 3); box('a_baguette', sprite('baguette'), 10);
for (const n of ['bullets', 'shells', 'cells']) { const s = sprite(n); box('a_' + n, s, Math.round(s.w * .7)); }
{ const s = sprite('helmet'), m = inflate(s, Math.round(s.w * .8), { round: 1.2 }); model('a_helmet', m.W, m.L, m.H, m.fn(0)); }
lathe('a_wine', sprite('wine')); lathe('a_lamp', sprite('lamp')); lathe('a_drum', sprite('drum')); lathe('a_column', sprite('column'));
box('a_cask', sprite('cask'), 44); lathe('a_table', sprite('table')); box('a_exit', sprite('exit'), 28);
{ const s = sprite('crate'); box('a_crate', s, s.w); }
// shots, sparks and debris stay simple shapes, at half scale so they sit with the finer models
model('a_shot', 2, 4, 2, () => 0xffcf5c, .5); model('a_spark', 3, 3, 3, (x, y, z) => (x + y + z) % 2 ? 0x9fe8ff : 0xffffff, .5); model('a_shell', 4, 4, 4, (x, y, z) => Math.hypot(x - 1.5, y - 1.5, z - 1.5) < 2.2 ? 0xff5a3a : null, .5);
model('a_bit', 2, 2, 2, () => 0xe0bb45, .4); model('a_smoke', 5, 5, 5, (x, y, z) => Math.hypot(x - 2, y - 2, z - 2) < 2.6 ? (noise3(x, y, z) > .5 ? 0xffcf5c : 0xff8a2a) : null, .5);
model('a_bolt', 2, 6, 2, (x, y, z) => (y & 1) ? 0x9fe8ff : 0xffffff, .5);
// weapons are relief cards cut from the first-person sheet: always seen from behind, exactly as drawn
const WEAPON_VOX = 0.085;
for (const n of ['w_pistol', 'w_shotgun', 'w_smg', 'w_tesla']) { const m = inflate(sprite(n, 0, 0, SPRITE_FLIP), 8, { even: true }); model(n, m.W, m.L, m.H, m.fn(0), WEAPON_VOX); }
model('w_flash', 7, 4, 7, (x, y, z) => Math.abs(x - 3) + Math.abs(z - 3) < 4 - y * 0.6 ? (Math.abs(x - 3) + Math.abs(z - 3) < 2 ? 0xffffff : 0xffcf5c) : null, 0.3);
const MESH = {}, mesh = n => MESH[n] || (MESH[n] = buildMesh(MODEL_DEFS[n]));

// ---------- things in the level ----------
const C = (cx, cy, ox = 0, oy = 0) => ({ x: cx * CS + 8 + ox, y: cy * CS + 8 + oy });
const ENEMY = {
  automate: { hp: 30, speed: 40, r: 5, range: 220, rate: 1.9, dmg: 6, shots: 1, shot: 'a_shot', score: 1 },
  lanterne: { hp: 18, speed: 62, r: 4, range: 180, rate: 1.0, dmg: 5, shots: 1, shot: 'a_spark', fly: 7, score: 1 },
  scaphandre: { hp: 150, speed: 27, r: 7, range: 240, rate: 2.1, dmg: 11, shots: 3, shot: 'a_shell', score: 1 },
  colosse: { hp: 1100, speed: 30, r: 9, range: 300, rate: 1.3, dmg: 12, shots: 5, shot: 'a_shell', boss: true, score: 1 },
};
const WEAPONS = [
  { name: 'PISTOLET', model: 'w_pistol', ammo: 'bullets', rate: .30, dmg: 13, pellets: 1, spread: .012, off: [13, 4.3, -7.4] },
  { name: 'FUSIL DE CHASSE', model: 'w_shotgun', ammo: 'shells', rate: .85, dmg: 9, pellets: 8, spread: .1, off: [13, 4.0, -7.6] },
  { name: 'MITRAILLETTE', model: 'w_smg', ammo: 'bullets', rate: .085, dmg: 10, pellets: 1, spread: .04, off: [13, 4.2, -7.6] },
  { name: 'ARC TESLA', model: 'w_tesla', ammo: 'cells', rate: .14, dmg: 34, pellets: 1, spread: 0, pierce: true, off: [13, 4.2, -7.6] },
];
let enemies, items, decor, shots, fx, P, state, flow, flowT, logLines, stats;
const say = t => { logLines.push({ t, life: 3.2 }); if (logLines.length > 3) logLines.shift(); };
function reset() {
  enemies = []; items = []; decor = []; shots = []; fx = []; logLines = [];
  for (const d of doors) { d.open = 0; d.hold = 0; d.unlocked = !d.key; }
  const E = (type, cx, cy, ox, oy) => enemies.push({ type, ...C(cx, cy, ox, oy), ...ENEMY[type], yaw: 0, awake: false, cool: 1 + rnd(), t: rnd() * 5, seeT: rnd() * .2, see: false, flash: 0, atk: 0, strafe: rnd() < .5 ? 1 : -1 });
  const I = (kind, cx, cy, ox, oy) => items.push({ kind, ...C(cx, cy, ox, oy) });
  const D = (model, cx, cy, ox = 0, oy = 0, o = {}) => decor.push({ model, ...C(cx, cy, ox, oy), r: 4, solid: true, rot: 0, ...o });
  // Metro
  E('automate', 10, 26); E('automate', 13, 27); I('bullets', 6, 27); I('baguette', 12, 29); D('a_lamp', 4, 26, 0, -5, { r: 2 }); D('a_lamp', 11, 26, 0, -5, { r: 2 }); D('a_crate', 14, 29);
  E('automate', 6, 18); E('automate', 10, 19); I('baguette', 11, 17); D('a_lamp', 5, 17, -3, -3, { r: 2 });
  I('shotgun', 2, 17); I('shells', 1, 20); I('shells', 3, 20); E('automate', 2, 19); D('a_crate', 1, 16); D('a_crate', 3, 16, 0, 0, { rot: .4 });
  // catacombs
  E('automate', 8, 13); E('lanterne', 5, 12); E('automate', 2, 9); E('lanterne', 2, 6); E('automate', 4, 2); E('automate', 6, 3); E('lanterne', 6, 8); E('automate', 11, 8);
  I('key_blue', 3, 1); I('baguette', 7, 1); I('shells', 5, 9); I('bullets', 8, 10); I('helmet', 10, 4); I('wine', 11, 5); D('a_lamp', 7, 4, 3, 3, { r: 2 }); D('a_lamp', 8, 7, 3, -3, { r: 2 });
  // wine cellar
  E('scaphandre', 20, 18); E('automate', 17, 15); E('automate', 23, 21); E('automate', 23, 15); E('lanterne', 20, 21);
  for (const [x, y] of [[16, 14], [24, 14], [16, 22], [24, 22], [19, 14]]) D('a_cask', x, y, 0, 0, { r: 6 });
  for (const [x, y] of [[20, 16], [17, 19], [23, 18], [21, 20]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  I('bullets', 16, 18); I('baguette', 24, 18); I('shells', 20, 22); D('a_lamp', 20, 14, 0, -4, { r: 2 });
  // chateau
  E('automate', 17, 8); E('automate', 23, 8); E('automate', 20, 7); E('lanterne', 18, 11); E('lanterne', 22, 11); E('scaphandre', 20, 10);
  for (const [x, y] of [[18, 7], [22, 7], [18, 11], [22, 11]]) D('a_column', x, y);
  D('a_table', 17, 2, 0, 0, { r: 6 }); I('smg', 18, 1); I('bullets', 16, 4); I('bullets', 19, 3); E('automate', 18, 3);
  D('a_table', 22, 2, 0, 0, { r: 6 }); I('key_red', 24, 1); E('scaphandre', 23, 3); I('wine', 21, 4); I('helmet', 24, 4);
  // courtyard
  E('lanterne', 27, 5); E('lanterne', 32, 8); E('lanterne', 29, 13); E('lanterne', 33, 13); E('automate', 30, 6); E('automate', 27, 10); E('automate', 33, 10);
  D('fountain', 30, 9, 0, 0, { r: 9 }); I('tesla', 33, 4); I('cells', 32, 4); I('cells', 26, 14); I('wine', 26, 4); I('shells', 33, 14); D('a_lamp', 26, 9, -4, -5, { r: 2 }); D('a_lamp', 33, 9, 4, -5, { r: 2 });
  // workshop and exit
  E('colosse', 30, 20); E('scaphandre', 27, 23); E('scaphandre', 33, 23); E('automate', 26, 17); E('automate', 33, 17);
  for (const [x, y] of [[26, 20], [33, 20], [29, 24], [31, 24]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  I('cells', 26, 16); I('cells', 33, 16); I('wine', 30, 17); I('baguette', 26, 24); I('baguette', 33, 24); I('bullets', 29, 16);
  decor.push({ model: 'a_exit', ...C(30, 25, 0, 3), r: 5, solid: true, rot: Math.PI, exit: true });
  P = { ...C(2, 26), yaw: 0, vx: 0, vy: 0, hp: 100, armour: 0, ammo: { bullets: 50, shells: 0, cells: 0 }, has: [true, false, false, false], weapon: 0, cool: 0, kick: 0, flash: 0, bob: 0, keys: {}, pain: 0, dead: false, grin: 0 };
  stats = { kills: 0, total: enemies.length, time: 0 };
  flow = null; flowT = 0;
}

// ---------- sound: tiny synthesised effects ----------
let audio = null, muted = false;
function sfx(kind) {
  if (!audio || muted) return;
  const t = audio.currentTime, g = audio.createGain(); g.connect(audio.destination);
  const tone = (type, f0, f1, dur, vol) => { const o = audio.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); o.connect(g); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.start(t); o.stop(t + dur); };
  const noise = (dur, vol, lp) => { const n = audio.createBufferSource(), b = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); n.buffer = b; const f = audio.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; n.connect(f); f.connect(g); g.gain.setValueAtTime(vol, t); n.start(t); };
  ({ pistol: () => { noise(.12, .5, 2400); tone('square', 320, 60, .1, .2); }, shotgun: () => { noise(.3, .8, 1400); tone('square', 160, 40, .2, .3); }, smg: () => { noise(.07, .4, 3000); tone('square', 380, 90, .06, .15); },
    tesla: () => tone('sawtooth', 900, 200, .12, .2), hit: () => tone('square', 700, 200, .05, .12), die: () => { noise(.35, .5, 900); tone('sawtooth', 300, 40, .35, .2); }, boom: () => { noise(.6, 1, 500); tone('sine', 120, 30, .5, .5); },
    pickup: () => tone('triangle', 520, 1040, .12, .2), key: () => { tone('triangle', 660, 1320, .25, .25); }, door: () => tone('sawtooth', 70, 110, .35, .12), hurt: () => tone('sawtooth', 220, 90, .2, .3), enemy: () => tone('square', 180, 120, .12, .1), wake: () => tone('square', 240, 480, .15, .08), click: () => tone('square', 900, 800, .03, .08),
  }[kind] || (() => {}))();
}

// ---------- helpers ----------
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function rayWall(x, y, a, max) {                                    // distance to the first wall or closed door
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let t = 0; t < max; t += 2) if (solidAtPt(x + dx * t, y + dy * t)) return t;
  return max;
}
function canSee(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay); return rayWall(ax, ay, Math.atan2(by - ay, bx - ax), d) >= d - 2; }
function moveBody(b, dx, dy, r, others) {
  const blocked = (x, y) => boxHits(x, y, r) || decor.some(d => d.solid && !d.gone && Math.hypot(d.x - x, d.y - y) < d.r + r) || (others && others.some(o => o !== b && !o.dead && Math.hypot(o.x - x, o.y - y) < o.r + r));
  let moved = false;
  if (dx && !blocked(b.x + dx, b.y)) { b.x += dx; moved = true; }
  if (dy && !blocked(b.x, b.y + dy)) { b.y += dy; moved = true; }
  return moved;
}
function computeFlow() {                                            // steps to the player from every cell, through doors enemies can use
  const f = new Int16Array(GW * GH).fill(999), px = Math.floor(P.x / CS), py = Math.floor(P.y / CS), q = [[px, py]]; f[px + py * GW] = 0;
  while (q.length) { const [x, y] = q.shift(), d = f[x + y * GW]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b, t = tile(nx, ny); if (!isFloor(t) || (t === 'D' && !doorAt(nx, ny).unlocked) || f[nx + ny * GW] <= d + 1) continue; f[nx + ny * GW] = d + 1; q.push([nx, ny]); } }
  return f;
}
function burst(x, y, lift, n, model) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = 20 + Math.random() * 50; fx.push({ model, x, y, lift, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: 20 + Math.random() * 40, t: 0, life: .35 + Math.random() * .3 }); } }
function hurtPlayer(d) {
  if (P.dead) return;
  const soak = Math.min(P.armour, d * 0.5); P.armour -= soak; P.hp -= d - soak; P.pain = Math.min(.6, P.pain + d * 0.03); sfx('hurt');
  if (P.hp <= 0) { P.hp = 0; P.dead = true; state = 'dead'; showScreen(); }
}
function explode(x, y) {
  sfx('boom'); burst(x, y, 6, 14, 'a_smoke');
  for (const e of enemies) if (!e.dead) { const d = Math.hypot(e.x - x, e.y - y); if (d < 46) hurtEnemy(e, 90 * (1 - d / 50), x, y); }
  for (const d of decor) if (d.drum && !d.gone && Math.hypot(d.x - x, d.y - y) < 40) { d.hp = 0; d.fuse = .15; }
  const pd = Math.hypot(P.x - x, P.y - y); if (pd < 46) hurtPlayer(55 * (1 - pd / 50));
}
function hurtEnemy(e, dmg, fx0, fy0) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = .1; e.awake = true; burst(e.x, e.y, 8 + (e.fly || 0), 2, 'a_bit');
  if (e.hp > 0) { sfx('hit'); return; }
  e.dead = true; stats.kills++; sfx('die'); burst(e.x, e.y, 8, 8, 'a_bit');
  const a = Math.atan2(e.y - fy0, e.x - fx0); e.fall = { dx: Math.cos(a), dy: Math.sin(a), a: 0, t: 0 };
  if (e.type === 'automate' && Math.random() < .45) items.push({ kind: 'bullets', x: e.x, y: e.y, small: true });
  if (e.boss) { say('Le Colosse is scrap. Find the lever!'); for (let i = 0; i < 4; i++) setTimeout(() => explode(e.x + (Math.random() - .5) * 20, e.y + (Math.random() - .5) * 20), i * 220); }
}
function fire() {
  const w = WEAPONS[P.weapon];
  if (P.cool > 0 || P.dead) return;
  if (P.ammo[w.ammo] <= 0) { P.cool = .25; sfx('click'); const alt = [3, 2, 1, 0].find(i => P.has[i] && P.ammo[WEAPONS[i].ammo] > 0); if (alt != null) P.weapon = alt; return; }
  P.ammo[w.ammo]--; P.cool = w.rate; P.kick = 1; P.flash = .06; sfx(['pistol', 'shotgun', 'smg', 'tesla'][P.weapon]);
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 260) e.awake = true;       // gunfire wakes the neighbourhood
  for (let p = 0; p < w.pellets; p++) {
    const a = P.yaw + (Math.random() - .5) * 2 * w.spread, dx = Math.cos(a), dy = Math.sin(a), wall = rayWall(P.x, P.y, a, 400);
    const targets = [];
    for (const t of [...enemies, ...decor]) {
      if (t.dead || t.gone || (!t.hp && !t.drum)) continue;
      const rx = t.x - P.x, ry = t.y - P.y, along = rx * dx + ry * dy, off = Math.abs(rx * dy - ry * dx);
      if (along > 0 && along < wall && off < (t.r || 4) + 1.5) targets.push([along, t]);
    }
    targets.sort((m, n) => m[0] - n[0]);
    let end = wall;
    for (const [along, t] of targets) {
      if (t.drum) { t.hp -= w.dmg; if (t.hp <= 0 && !t.fuse) t.fuse = .05; } else hurtEnemy(t, w.dmg * (.8 + Math.random() * .4), P.x, P.y);
      if (!w.pierce) { end = along; break; }
    }
    if (w.pierce) for (let d = 10; d < end; d += 9) fx.push({ model: 'a_bolt', x: P.x + dx * d, y: P.y + dy * d, lift: 7 + Math.random() * 2, vx: 0, vy: 0, vz: 0, t: 0, life: .09, rot: a - Math.PI / 2 });
    else burst(P.x + dx * (end - 2), P.y + dy * (end - 2), 6 + Math.random() * 5, 1, end < wall ? 'a_bit' : 'a_smoke');
  }
}
const PICK = {
  baguette: { model: 'a_baguette', get: () => P.hp < 100 && (P.hp = Math.min(100, P.hp + 15), 'A baguette. +15 santé') },
  wine: { model: 'a_wine', get: () => P.hp < 200 && (P.hp = Math.min(200, P.hp + 40), 'A bottle of Bordeaux. +40 santé') },
  helmet: { model: 'a_helmet', get: () => P.armour < 100 && (P.armour = Math.min(100, P.armour + 50), 'An Adrian helmet. +50 armure') },
  bullets: { model: 'a_bullets', get: it => (P.ammo.bullets += it.small ? 8 : 24, 'Cartridges') },
  shells: { model: 'a_shells', get: () => (P.ammo.shells += 8, 'Shotgun shells') },
  cells: { model: 'a_cells', get: () => (P.ammo.cells += 30, 'Tesla cells') },
  shotgun: { model: 'w_shotgun', get: () => (P.has[1] = true, P.weapon = 1, P.ammo.shells += 8, 'Fusil de chasse: the gamekeeper’s shotgun!') },
  smg: { model: 'w_smg', get: () => (P.has[2] = true, P.weapon = 2, P.ammo.bullets += 40, 'Mitraillette: a submachine gun!') },
  tesla: { model: 'w_tesla', get: () => (P.has[3] = true, P.weapon = 3, P.ammo.cells += 40, 'Arc Tesla: the Baron’s own invention!') },
  key_blue: { model: 'a_key_blue', get: () => (P.keys.blue = true, sfx('key'), 'The blue key') },
  key_red: { model: 'a_key_red', get: () => (P.keys.red = true, sfx('key'), 'The red key') },
};

// ---------- update ----------
function update(dt) {
  stats.time += dt;
  const k = keys, turn = (k.arrowright || k.e ? 1 : 0) - (k.arrowleft || k.q ? 1 : 0);
  P.yaw += turn * 2.6 * dt;
  const f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), s = (k.d ? 1 : 0) - (k.a ? 1 : 0), l = Math.hypot(f, s) || 1;
  const wx = (Math.cos(P.yaw) * f - Math.sin(P.yaw) * s) / l * 125, wy = (Math.sin(P.yaw) * f + Math.cos(P.yaw) * s) / l * 125;
  P.vx += (wx - P.vx) * Math.min(1, 10 * dt); P.vy += (wy - P.vy) * Math.min(1, 10 * dt);
  moveBody(P, P.vx * dt, P.vy * dt, 4.5, enemies);
  P.bob += Math.hypot(P.vx, P.vy) * dt * 0.09; P.cool -= dt; P.kick = Math.max(0, P.kick - dt * 5); P.flash -= dt; P.pain = Math.max(0, P.pain - dt * 0.9); P.grin -= dt;
  if (k[' '] || k.control || k.fire) fire();
  // doors slide open for the player (with the right key) and for enemies that are hunting
  for (const d of doors) {
    const near = Math.hypot(P.x - d.x, P.y - d.y) < 22;
    if (near && !d.unlocked) { if (P.keys[d.key]) { d.unlocked = true; say(`The ${d.key} door unlocks.`); } else if (!d.told || stats.time - d.told > 3) { d.told = stats.time; say(`You need the ${d.key} key.`); } }
    const want = d.unlocked && (near || enemies.some(e => e.awake && !e.dead && Math.hypot(e.x - d.x, e.y - d.y) < 20));
    if (want) { if (d.open === 0) sfx('door'); d.hold = 2.5; }
    d.hold -= dt; const target = d.hold > 0 ? 1 : 0;
    if (target === 0 && d.open > 0 && [P, ...enemies].some(b => !b.dead && Math.hypot(b.x - d.x, b.y - d.y) < 13)) d.hold = .5;   // never close on someone
    else d.open = Math.max(0, Math.min(1, d.open + (target ? 1 : -1) * dt * 2.2));
  }
  flowT -= dt; if (flowT <= 0 || !flow) { flow = computeFlow(); flowT = .3; }
  for (const e of enemies) {
    if (e.dead) { e.fall.t += dt; e.fall.a = 1.5 * Math.min(1, Math.pow(e.fall.t / .4, 2)); continue; }
    e.flash -= dt; e.atk -= dt; e.t += dt;
    const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
    e.seeT -= dt; if (e.seeT <= 0) { e.seeT = .18; e.see = dist < 320 && canSee(e.x, e.y, P.x, P.y); }
    if (!e.awake) { if ((e.see && dist < 260) || dist < 40) { e.awake = true; sfx('wake'); } else continue; }
    e.yaw = Math.atan2(dy, dx);
    e.cool -= dt;
    if (e.see && dist < e.range && e.cool <= 0 && !P.dead) {         // fire a volley of slow, dodgeable shots
      e.cool = e.rate * (.8 + Math.random() * .5); e.atk = .22; sfx('enemy');
      for (let i = 0; i < e.shots; i++) { const a = e.yaw + (i - (e.shots - 1) / 2) * .16 + (Math.random() - .5) * .08; shots.push({ model: e.shot, x: e.x + Math.cos(a) * (e.r + 3), y: e.y + Math.sin(a) * (e.r + 3), vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, dmg: e.dmg, lift: 7 + (e.fly || 0), t: 0 }); }
      if (e.boss && Math.random() < .35) for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; shots.push({ model: 'a_spark', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, dmg: 8, lift: 7, t: 0 }); }
    }
    let mx = 0, my = 0;
    if (e.see && dist < e.range * 0.45 && !e.boss) { if (Math.random() < dt * .6) e.strafe *= -1; mx = -dy / dist * e.strafe * 0.7; my = dx / dist * e.strafe * 0.7; }   // close enough: circle
    else if (e.see && dist < 60) { mx = dx / dist; my = dy / dist; }
    else {                                                            // otherwise follow the flow field towards the player
      const cx = Math.floor(e.x / CS), cy = Math.floor(e.y / CS); let best = flow[cx + cy * GW], bx = cx, by = cy;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = flow[cx + a + (cy + b) * GW]; if (v < best) { best = v; bx = cx + a; by = cy + b; } }
      const tx = bx * CS + 8 - e.x, ty = by * CS + 8 - e.y, tl = Math.hypot(tx, ty) || 1; mx = tx / tl; my = ty / tl;
    }
    moveBody(e, mx * e.speed * dt, my * e.speed * dt, e.r, [P, ...enemies]);
    if (dist < e.r + 9 && e.cool < e.rate * .5 && !e.fly) { hurtPlayer(e.boss ? 22 : 10); e.cool = e.rate; }                                   // contact damage
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s2 = shots[i]; s2.t += dt; s2.x += s2.vx * dt; s2.y += s2.vy * dt;
    if (solidAtPt(s2.x, s2.y) || s2.t > 5) { burst(s2.x - s2.vx * dt, s2.y - s2.vy * dt, s2.lift, 1, 'a_bit'); shots.splice(i, 1); }
    else if (Math.hypot(s2.x - P.x, s2.y - P.y) < 5) { hurtPlayer(s2.dmg); shots.splice(i, 1); }
  }
  for (const d of decor) if (d.fuse != null && !d.gone) { d.fuse -= dt; if (d.fuse <= 0) { d.gone = true; explode(d.x, d.y); } }
  for (let i = fx.length - 1; i >= 0; i--) { const p = fx[i]; p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vz -= 160 * dt * (p.vz !== 0); p.lift = Math.max(0.5, p.lift + p.vz * dt); if (p.t > p.life) fx.splice(i, 1); }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; if (Math.hypot(it.x - P.x, it.y - P.y) > 9) continue;
    const msg = PICK[it.kind].get(it); if (!msg) continue;
    say(msg); if (!it.kind.startsWith('key')) sfx('pickup'); P.grin = .8; items.splice(i, 1);
  }
  const ex = decor.find(d => d.exit);
  if (Math.hypot(P.x - ex.x, P.y - ex.y) < 15) { state = 'won'; sfx('key'); showScreen(); }
  for (const m of logLines) m.life -= dt; while (logLines.length && logLines[0].life <= 0) logLines.shift();
}

// ---------- render ----------
const scene = document.getElementById('scene'), R = Renderer(scene, SIZE), OPT = { scale: 1, explode: 1, zscale: 1, light: true, shade: true }, NOSHADE = { ...OPT, shade: false, light: false };
const cam0 = { x: 0, y: 0, a: 0 };
function render(now) {
  if (!R) { $('stats').textContent = 'WebGL is not available in this browser.'; return; }
  const W = scene.width, H = scene.height, eye = { x: P.x, y: P.y, yaw: P.yaw }, fxv = Math.cos(P.yaw), fyv = Math.sin(P.yaw);
  R.begin(1, W / 2, H / 2, [.29, .22, .47], eye, true);                 // the clear colour is the dusk sky over the courtyard; indoors it is never seen
  R.ground(floorTex, cam0, 0); R.ground(ceilTex, cam0, WH);
  let n = 0;
  const vis = (x, y, r) => { const ex = x - P.x, ey = y - P.y, f = ex * fxv + ey * fyv; return f > -r && f < FP.far + r && Math.abs(ey * fxv - ex * fyv) < f * 0.9 + r + 8; };
  const draw = (name, x, y, rot, pose, o) => { if (vis(x, y, 12)) { R.draw(mesh(name), x, y, rot, cam0, MODEL_DEFS[name].o || o || OPT, null, pose); n++; } };
  for (const p of panels) if ((P.x - p.x) * p.nx + (P.y - p.y) * p.ny > 0 && vis(p.x, p.y, 12)) { const far = (P.x - p.x) ** 2 + (P.y - p.y) ** 2 > 130 * 130; R.draw(far ? p.far : p.m, p.x, p.y, p.rot, cam0, far ? FAR_O : WO); n++; }   // only the sides that face the player; coarse ones in the distance
  for (const p of posts) if (vis(p.x, p.y, 2)) { R.draw(p.m, p.x, p.y, 0, cam0, WO); n++; }
  for (const h of hedges) draw('hedge', h.x, h.y, 0);
  for (const d of doors) { const s = d.open * 14, name = d.key ? 'a_door_' + d.key : 'a_door'; draw(name, d.x + (d.vertical ? s : 0), d.y + (d.vertical ? 0 : s), d.vertical ? 0 : Math.PI / 2); }
  for (const d of decor) if (!d.gone) draw(d.model, d.x, d.y, d.rot);
  for (const it of items) draw(PICK[it.kind].model, it.x, it.y, now * 0.002, { lift: 3 + Math.sin(now * 0.004 + it.x) * 1.2 }, NOSHADE);
  for (const e of enemies) {
    const frame = e.dead ? 'w' : e.type === 'lanterne' ? ((now / 60 | 0) & 1 ? 'w' : 'b') : e.atk > 0 ? 'a' : (e.t * 4 | 0) & 1 && e.awake ? 'b' : 'w';
    draw(`${e.type}_${frame}`, e.x, e.y, e.yaw - Math.PI / 2, e.dead ? { ...e.fall, lift: 0 } : { lift: e.fly ? e.fly + Math.sin(e.t * 3) * 1.5 : 0, flash: e.flash > 0 ? 0.8 : 0 });
  }
  for (const s of shots) draw(s.model, s.x, s.y, Math.atan2(s.vy, s.vx) - Math.PI / 2, { lift: s.lift }, NOSHADE);
  for (const p of fx) draw(p.model, p.x, p.y, p.rot != null ? p.rot : p.t * 9, { lift: p.lift }, NOSHADE);
  // the weapon is drawn last over a cleared depth buffer so it never pokes into walls
  if (!P.dead) {
    R.clearDepth();
    const w = WEAPONS[P.weapon], sway = Math.sin(P.bob) * 0.7, back = P.kick * 1.2, o = w.off;
    const wx = P.x + fxv * (o[0] - back) - fyv * (o[1] + sway), wy = P.y + fyv * (o[0] - back) + fxv * (o[1] + sway), lift = FP.eye + o[2] + Math.abs(Math.cos(P.bob)) * 0.5 + P.kick * 0.8;
    R.draw(mesh(w.model), wx, wy, P.yaw - Math.PI / 2, cam0, MODEL_DEFS[w.model].o, null, { lift });
    if (P.flash > 0 && P.weapon !== 3) R.draw(mesh('w_flash'), wx + fxv * .6, wy + fyv * .6, P.yaw - Math.PI / 2, cam0, MODEL_DEFS.w_flash.o, null, { lift: lift + MODEL_DEFS[w.model].H * WEAPON_VOX - 1.2 });
  }
  R.end();
  $('stats').textContent = `${n} draws, ${Math.round(R.stats.tris / 1000)}k triangles.`;
  // status bar
  const w = WEAPONS[P.weapon];
  $('ammo').textContent = P.ammo[w.ammo]; $('health').textContent = Math.ceil(P.hp); $('armour').textContent = Math.ceil(P.armour); $('wname').textContent = w.name;
  $('kb').style.background = P.keys.blue ? '#4a8aff' : '#2a221b'; $('kr').style.background = P.keys.red ? '#ff4a4a' : '#2a221b';
  $('pain').style.opacity = P.dead ? .5 : P.pain; $('log').textContent = logLines.map(m => m.t).join('\n');
  drawFace(now);
}
const faceCtx = document.getElementById('face').getContext('2d');
function drawFace(now) {                                              // the hero, after the portrait sheet: beret, moustache, and a worse day as health drops
  const g = faceCtx, hp = P.hp, px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const SKIN = '#e9b48a', SHADE = '#d9a078', HAIR = '#5a3d22', DARK = '#3a2a1e', NAVY = '#2c4a8c', CREAM = '#f4f1e6', RED = '#c81e1e';
  px(0, 0, 24, 24, '#1c1713');
  px(3, 21, 18, 3, NAVY); px(6, 20, 12, 1, NAVY); px(9, 20, 6, 1, CREAM); px(8, 21, 8, 1, CREAM); px(9, 22, 6, 1, CREAM); px(10, 23, 4, 1, CREAM); px(11, 21, 2, 3, '#1b2f52');   // coat and scarf
  px(7, 8, 10, 11, SKIN); px(9, 19, 6, 1, SKIN); px(6, 11, 1, 3, SKIN); px(17, 11, 1, 3, SKIN); px(6, 8, 1, 3, HAIR); px(17, 8, 1, 3, HAIR);
  px(11, 1, 2, 1, NAVY); px(7, 2, 10, 1, NAVY); px(5, 3, 14, 1, NAVY); px(4, 4, 16, 1, NAVY); px(3, 5, 18, 2, NAVY); px(4, 7, 16, 1, '#1f3668');                                  // beret
  const hurt = P.pain > .1, look = P.dead || hurt ? 0 : Math.round(Math.sin(now * 0.0015));
  if (P.dead || hurt) { px(8, 12, 3, 1, DARK); px(13, 12, 3, 1, DARK); px(8, 10, 2, 1, DARK); px(10, 11, 1, 1, DARK); px(14, 10, 2, 1, DARK); px(13, 11, 1, 1, DARK); }             // eyes screwed shut
  else { px(8, 10, 3, 1, DARK); px(13, 10, 3, 1, DARK); px(9 + look, 11, 1, 2, '#1b1b22'); px(14 + look, 11, 1, 2, '#1b1b22'); }
  px(11, 13, 2, 2, SHADE); px(8, 15, 8, 1, HAIR); px(7, 16, 3, 1, HAIR); px(14, 16, 3, 1, HAIR);                                                                                   // nose and moustache
  if (P.grin > 0 && !P.dead) px(9, 17, 6, 1, CREAM); else if (hurt && !P.dead) { px(9, 17, 6, 1, CREAM); px(9, 18, 6, 1, DARK); } else px(10, 17, 4, 1, P.dead ? DARK : '#8a3a32');
  if (hp < 70) { px(16, 13, 1, 1, RED); px(15, 14, 1, 1, RED); }
  if (hp < 45) { px(15, 8, 2, 3, RED); px(16, 11, 1, 3, RED); }
  if (hp < 20) { px(14, 8, 1, 2, RED); px(16, 14, 1, 4, RED); px(7, 13, 1, 3, RED); px(15, 19, 1, 2, '#8a1010'); }
}
function showScreen() {
  const el = $('screen'), t = Math.round(stats.time), mm = `${t / 60 | 0}:${String(t % 60).padStart(2, '0')}`;
  el.style.display = state === 'play' ? 'none' : 'flex';
  el.innerHTML = state === 'title' ? `<h2>LES AUTOMATES</h2><p><b>Paris, 1934.</b> Baron Mécanique's clockwork gendarmes have marched out of his château and into the Métro. You are the only inspector still on duty.</p><p>Find the <b>blue</b> and <b>red</b> keys, cross the catacombs, the wine cellar and the château, and pull the lever in his workshop.</p><p><b>Click or tap to start</b></p>`
    : state === 'dead' ? `<h2>VOUS ÊTES MORT</h2><p>The automates march on. ${stats.kills} of ${stats.total} destroyed.</p><p><b>Click, tap or press R to try again</b></p>`
    : state === 'won' ? `<h2>VIVE LA RÉPUBLIQUE&nbsp;!</h2><p>The lever drops and every automate in Paris winds down.</p><p>Automates destroyed: <b>${stats.kills} / ${stats.total}</b> &middot; Time: <b>${mm}</b></p><p><b>Click, tap or press R to play again</b></p>`
    : `<h2>PAUSE</h2><p><b>Click or tap to continue</b></p>`;
}

// ---------- input + loop ----------
state = 'title'; reset(); showScreen();
const start = () => { if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audio = null; } } if (state !== 'play') { if (state !== 'pause') reset(); state = 'play'; showScreen(); } };
const lock = () => { if (scene.requestPointerLock && matchMedia('(pointer:fine)').matches) { try { const p = scene.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ } } };
$('screen').addEventListener('click', () => { start(); lock(); });
scene.addEventListener('mousedown', e => { if (state !== 'play') return; if (document.pointerLockElement !== scene) lock(); if (e.button === 0) keys.fire = true; });
addEventListener('mouseup', () => keys.fire = false);
addEventListener('mousemove', e => { if (document.pointerLockElement === scene && state === 'play') P.yaw += e.movementX * 0.0026; });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== scene && state === 'play' && matchMedia('(pointer:fine)').matches) { state = 'pause'; showScreen(); keys.fire = false; } });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r' && !e.repeat) { reset(); state = 'play'; showScreen(); return; }
  if (k === 'm' && !e.repeat) { muted = !muted; return; }
  if (k >= '1' && k <= '4' && P.has[+k - 1]) P.weapon = +k - 1;
  keys[k] = true; if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
{ let drag = null;                                                    // touch: drag the view to turn
  scene.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { drag = e.clientX; start(); } });
  scene.addEventListener('pointermove', e => { if (drag != null && e.pointerType !== 'mouse') { P.yaw += (e.clientX - drag) * 0.008; drag = e.clientX; } });
  ['pointerup', 'pointercancel'].forEach(t => scene.addEventListener(t, () => drag = null)); }
document.querySelectorAll('#touch button').forEach(b => {
  const set = on => e => { e.preventDefault(); b.classList.toggle('down', on); if (b.dataset.k === 'next') { if (on) { let i = P.weapon; do i = (i + 1) % 4; while (!P.has[i]); P.weapon = i; } } else keys[b.dataset.k] = on; if (on) start(); };
  b.addEventListener('pointerdown', set(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, set(false))); b.addEventListener('contextmenu', e => e.preventDefault());
});
let last = performance.now(), frames = 0, since = last, spent = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t0 = performance.now(); last = now;
  if (state === 'play') update(dt);
  render(now);
  frames++; spent += performance.now() - t0;
  if (now - since >= 500) { $('fps').textContent = `${Math.round(frames * 1000 / (now - since))} fps · ${(spent / frames).toFixed(1)} ms`; frames = 0; spent = 0; since = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.AUTOMATES = { get P() { return P; }, get enemies() { return enemies; }, get items() { return items; }, get decor() { return decor; }, get state() { return state; }, set state(v) { state = v; showScreen(); }, get stats() { return stats; },
  doors, tiles, tile, update, render, reset, fire, C, CS, canSee, panels, start };
}
{ const img = new Image(); img.onload = () => main(img); img.src = ART.png; }                // the art atlas has to be decoded before anything can be built
