'use strict';
// Les Automates: an original first-person voxel shooter set in Paris, 1934. Everything (walls, enemies, weapons,
// pickups) is a voxel model; the level is a grid of 16-unit cells. The models are
// built at four voxels to the unit from the reference sheets in refs/, packed into art.js by tools/build_art.py.
function main(atlasImg) {
const WALL_FLIP = false, SPRITE_FLIP = false;                               // mirror the reference pixels if a model shows them back to front
const LEVEL = new URLSearchParams(location.search).get('level') === '2' ? 2 : 1;   // 1: under Paris and the Baron's chateau; 2: the rooftops
const CS = 16, WH = 32, LOWC = 24, K = 2, DS = CS * K, DW = 35, DH = 31, GW = DW * K, GH = DH * K, SIZE = GW * CS;   // the level is drawn on a 35 x 31 plan, and every square of the plan is 2 x 2 cells
const rnd = mulberry32(1934), hash = (a, b) => noise3(a, b, 7);

// ---------- level: carved rooms on a grid ----------
const tiles = Array.from({ length: DH }, () => Array(DW).fill(' '));
const carve = (x0, y0, x1, y1, floor, wall) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles[y][x] = floor;
  if (wall) for (let y = y0 - 1; y <= y1 + 1; y++) for (let x = x0 - 1; x <= x1 + 1; x++) if (tiles[y] && tiles[y][x] === ' ') tiles[y][x] = wall;
};
const doors = [];
const place = (t, base, list) => { for (const [x, y] of list) if (tiles[y][x] === base) tiles[y][x] = t; };
const door = (x, y, key) => { doors.push({ cx: x, cy: y, key, open: 0, hold: 0, unlocked: !key }); tiles[y][x] = 'D'; };
if (LEVEL === 1) {
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
// three hidden rooms, each behind a stretch of wall that gives way to a kick: off the platform, off the catacombs, and off the cellar
carve(16, 26, 18, 27, 'm', 'M'); carve(13, 7, 13, 9, 'c', 'C'); carve(14, 21, 14, 22, 'b', 'B'); door(15, 27, 'secret'); door(12, 8, 'secret'); door(15, 21, 'secret');
// wall decoration, placed by hand: posters, station signs and sconces, wine racks, paintings, windows, pipework and machinery
place('P', 'M', [[2, 25], [6, 25], [10, 25], [14, 25], [3, 30], [11, 30]]); place('N', 'M', [[4, 25], [12, 25], [7, 30]]);
place('L', 'M', [[6, 16], [10, 16], [6, 21], [10, 21], [4, 17], [12, 20], [7, 23], [9, 22]]);
place('V', 'B', [[17, 23], [19, 23], [21, 23], [23, 23], [17, 13], [18, 13], [22, 13], [23, 13], [25, 15], [25, 17], [25, 19], [25, 21]]);
place('F', 'W', [[20, 5], [15, 7], [15, 11], [18, 13], [22, 13], [15, 2], [25, 2], [18, 0], [22, 0]]);
place('X', 'S', [[27, 3], [29, 3], [31, 3], [33, 3], [34, 5], [34, 7], [34, 11], [34, 13], [27, 15], [33, 15]]);
place('G', 'I', [[27, 15], [33, 15], [34, 18], [34, 22], [28, 25], [32, 25]]); place('T', 'I', [[34, 20], [26, 25], [34, 24]]); place('Y', 'I', [[28, 15], [32, 15], [34, 16], [33, 25]]);
} else {
// The rooftops: four roofs at three heights over the streets, joined by gangways and iron stairs, and the mooring house at the top.
// '.' is open air: seen and shot across, never walked on. 'z' is a zinc roof under the sky.
carve(1, 1, 33, 29, '.');
carve(2, 22, 9, 28, 'z'); carve(10, 25, 12, 25, 'z');                   // the first roof, and the gangway off it
carve(13, 20, 20, 28, 'z'); carve(21, 23, 21, 23, 'z');                 // the second roof, six units up
carve(22, 18, 31, 27, 'z'); carve(24, 14, 24, 17, 'z');                 // the third, and the way up to the last
carve(14, 4, 27, 13, 'z');                                              // the top roof
for (let y = 0; y <= 3; y++) for (let x = 18; x <= 22; x++) tiles[y][x] = y === 0 || y === 3 || x === 18 || x === 22 ? 'I' : 'i';   // the mooring house
for (const [x, y, t] of [[16, 23, 'S'], [18, 26, 'X'], [26, 21, 'S'], [28, 24, 'X'], [24, 25, 'S'], [17, 7, 'X'], [24, 7, 'S'], [20, 10, 'S'], [5, 25, 'X'], [16, 10, 'S'], [25, 11, 'X']]) tiles[y][x] = t;   // chimney stacks and skylight houses
door(20, 3);
place('T', 'I', [[18, 1], [22, 2]]); place('Y', 'I', [[19, 0], [21, 0]]); place('G', 'I', [[20, 0]]);
}
const FLOORS = 'mrcbwkgoiDz.', isFloor = t => FLOORS.includes(t);
const WALL_BASE = { P: 'M', N: 'M', L: 'M', V: 'B', F: 'W', X: 'S', G: 'I', T: 'I', Y: 'I',
  0: 'M', 1: 'M', 2: 'M', 3: 'M', 4: 'M', 5: 'M', 6: 'M', 7: 'M', 8: 'C', 9: 'C', A: 'C', E: 'C', J: 'B', O: 'B', Q: 'B', R: 'B',   // posters, a map, a clock, a hose reel, a ticket window, a sign, a telephone; a plaque, a candle niche, a gate, bones; a tun, a slate, hooks, bottles
  Z: 'W', a: 'W', d: 'W', e: 'W', f: 'S', h: 'S', j: 'S', n: 'S', p: 'I', q: 'I', s: 'I', t: 'I' };                              // books, a mirror, a fireplace, the Baron; a fountain, ivy, a door, a bust; gears, a blueprint, a switchboard, tools
// Dressing the walls: the hand-placed pieces above stay where they are, and most of the plain wall that faces a floor is then
// given something from its room's stock, chosen by position so that a level is the same every time and neighbours differ.
const STOCK2 = { M: '025673', C: '8E', B: 'OQR', W: 'aeF', S: 'hn', I: 'pqst' }, wallHash = (x, y) => (Math.imul(x + 11, 73856093) ^ Math.imul(y + 7, 19349663)) >>> 0;   // the smaller pieces, for the second half of a stretch of wall
{ const STOCK = { M: '000111223345556667777PPN', C: '88899AEEE', B: 'JJOOQQQRRRV', W: 'ZZZaadeFF', S: 'fhhhhjnn', I: 'pppqqssttG' }, last = {}, HOME = { M: 'mr', C: 'c', B: 'b', W: 'wk', S: 'go', I: 'i' };
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { const t = tiles[y][x], pool = STOCK[t]; if (!pool) continue;
    const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => (tiles[y + b] || [])[x + a]).filter(f => f && isFloor(f) && f !== 'D');
    if (!faces.length || faces.some(f => !HOME[t].includes(f))) continue;      // only walls that face their own room: a wine tun does not belong on the workshop's side of the cellar wall
    const h = wallHash(x, y); if (h % 100 < 12) continue;
    let k = pool[(h >>> 8) % pool.length]; if (k === last[t] || (tiles[y - 1] && tiles[y - 1][x] === k)) k = pool[((h >>> 8) + 5) % pool.length]; tiles[y][x] = last[t] = k; } }              // each decorated wall and the plain wall it is a variant of
// The plan is now scaled up: corridors come out two cells wide and rooms twice as long and broad, with the art at the same
// size as before. A decorated wall keeps its decoration on every other cell, and a door becomes a pair of leaves.
{ const plan = tiles.map(row => row.slice()), at = (x, y) => (plan[y] || [])[x] || ' ';
  tiles.length = 0;
  for (let y = 0; y < GH; y++) tiles.push(Array.from({ length: GW }, (_, x) => { const t = plan[y >> 1][x >> 1]; if (!WALL_BASE[t] || !((x + y) & 1)) return t; const b = WALL_BASE[t], h = wallHash(x * 3 + 1, y * 5 + 2), s = STOCK2[b], k = s[(h >>> 8) % s.length];   // the other half of each decorated stretch: plain, or one of the smaller pieces
    return LEVEL === 1 && h % 100 < 55 && k !== t ? k : b; }));
  for (const d of doors) {
    d.vertical = !isFloor(at(d.cx - 1, d.cy)); d.floor = d.vertical ? at(d.cx, d.cy - 1) : at(d.cx - 1, d.cy);
    const X = d.cx * K, Y = d.cy * K;
    d.cells = d.vertical ? [[X, Y + 1], [X + 1, Y + 1]] : [[X + 1, Y], [X + 1, Y + 1]];                    // the leaves stand in one row of the doorway; the other row is a threshold
    for (const [x, y] of d.vertical ? [[X, Y], [X + 1, Y]] : [[X, Y], [X, Y + 1]]) tiles[y][x] = d.floor;
    d.x = d.vertical ? (X + 1) * CS : (X + 1.5) * CS; d.y = d.vertical ? (Y + 1.5) * CS : (Y + 1) * CS;
  } }
const tile = (cx, cy) => cx < 0 || cy < 0 || cx >= GW || cy >= GH ? ' ' : tiles[cy][cx];
const doorAt = (cx, cy) => doors.find(d => d.cells.some(c => c[0] === cx && c[1] === cy));
// ---------- height: every cell is on one of a few floor levels, and flights of stairs join them ----------
const LEVELS = LEVEL === 1 ? [0, 6, -6] : [0, 6, 12, -24], LV = new Uint8Array(GW * GH), STAIR = new Array(GW * GH), FLIGHTS = [];
const raise = (x0, y0, x1, y1, lv) => { for (let y = y0 * K; y < (y1 + 1) * K; y++) for (let x = x0 * K; x < (x1 + 1) * K; x++) LV[y * GW + x] = lv; };
const flight = (cx, cy, dx, dy, lv0, lv1) => {                               // a flight fills one square of the plan and climbs in the direction (dx, dy), four steps from one level to the other
  const s = { x0: cx * DS, y0: cy * DS, dx, dy, lo: LEVELS[lv0], hi: LEVELS[lv1] }; FLIGHTS.push(s);
  for (let y = cy * K; y < (cy + 1) * K; y++) for (let x = cx * K; x < (cx + 1) * K; x++) { STAIR[y * GW + x] = s; LV[y * GW + x] = lv0; }
};
if (LEVEL === 1) {
  raise(16, 0, 24, 6, 1); for (const x of [19, 20, 21]) flight(x, 7, 0, -1, 0, 1);                        // the chateau: a grand staircase up to a dais, with the library and the salon beyond it
  raise(17, 15, 24, 22, 2); flight(20, 15, 0, -1, 2, 0); flight(17, 18, -1, 0, 2, 0);                     // the cellar floor is sunk below a gallery along two of its sides
} else {
  raise(13, 20, 21, 28, 1); flight(13, 25, 1, 0, 0, 1); raise(22, 18, 31, 27, 1);
  raise(14, 0, 27, 16, 2); flight(24, 17, 0, -1, 1, 2);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (tiles[y][x] === '.') LV[y * GW + x] = 3;
}
const heightAt = (x, y) => {                                                 // the height of the floor at a point
  const cx = Math.floor(x / CS), cy = Math.floor(y / CS); if (cx < 0 || cy < 0 || cx >= GW || cy >= GH) return 0;
  const i = cy * GW + cx, s = STAIR[i]; if (!s) return tiles[cy][cx] === 'r' ? -5 : LEVELS[LV[i]];
  const t = s.dx ? (s.dx > 0 ? x - s.x0 : s.x0 + DS - x) : (s.dy > 0 ? y - s.y0 : s.y0 + DS - y);
  return s.lo + (Math.max(0, Math.min(3, Math.floor(t / 8))) + 1) * (s.hi - s.lo) / 4;
};
const CELLH = Float32Array.from({ length: GW * GH }, (_, i) => heightAt((i % GW) * CS + 8.01, (i / GW | 0) * CS + 8.01)), baseAt = (cx, cy) => { const i = cy * GW + cx; return STAIR[i] ? STAIR[i].lo : LEVELS[LV[i]]; };
for (const d of doors) d.z = LEVELS[LV[d.cells[0][1] * GW + d.cells[0][0]]];
// solid for movement and bullets: walls, and doors that are not open enough
const solidCell = (cx, cy) => { const t = tile(cx, cy); if (t === 'D') return doorAt(cx, cy).open < 0.7; return !isFloor(t); };
const PIT = 5, inPit = (x, y) => 'r.'.includes(tile(Math.floor(x / CS), Math.floor(y / CS)));              // the track bed lies below the platform: seen and shot across, never walked on
const vaulted = (cx, cy) => { const t = tile(cx, cy); return LEVEL === 1 && (t === 'r' || t === 'm') && cy >= 26 * K && cy < 30 * K; };
const CELLAR = LEVEL === 1 ? [16 * K, 25 * K - 1, 14 * K, 23 * K - 1] : [-1, -2, -1, -2], inCellar = (cx, cy) => cx >= CELLAR[0] && cx <= CELLAR[1] && cy >= CELLAR[2] && cy <= CELLAR[3];   // the wine cellar is roofed with brick vaults between beams
const roofed = (cx, cy) => vaulted(cx, cy) || inCellar(cx, cy);   // the platform hall has a barrel vault instead of a flat ceiling
const solidAtPt = (x, y) => solidCell(Math.floor(x / CS), Math.floor(y / CS));
const boxHits = (x, y, r) => solidAtPt(x - r, y - r) || solidAtPt(x + r, y - r) || solidAtPt(x - r, y + r) || solidAtPt(x + r, y + r);

// ---------- art: every surface and model is built from the atlas of reference pixels (see tools/build_art.py) ----------
// One atlas pixel is one voxel: an eighth of a world unit on walls, a quarter on objects. Walls become relief
// panels, objects are inflated, lathed or extruded from their front views.
const VPU = 4, VOX = 1 / VPU, WPU = 8, WV = CS * WPU, HV = WH * WPU, THICK = WPU;
const atlasCv = mkCanvas(atlasImg.width, atlasImg.height), AW = atlasImg.width;
atlasCv.getContext('2d').drawImage(atlasImg, 0, 0);
const AD = atlasCv.getContext('2d').getImageData(0, 0, AW, atlasImg.height).data;
const GLOW = 0x1000000, SHINY = 0x2000000;                                   // flags on a colour: it glows (ignores the light, feeds the bloom); it is polished (metal, enamel, glass)
const isBrass = (r, g, b) => r > 150 && g > 105 && b < 125 && r - b > 70;
const POLISHED = /^(wall_[MPNLIGTY]|tunnel|vault|automate|scaphandre|colosse|lanterne|w_|lamp|hanglamp|lantern|bin|signal|exit|key_|helmet|train|chandelier)/;
const shade = (c, k) => c & GLOW ? c : (c & SHINY) | Math.min(255, (c >> 16 & 255) * k | 0) << 16 | Math.min(255, (c >> 8 & 255) * k | 0) << 8 | Math.min(255, (c & 255) * k | 0);
// A sprite: colours with the bottom row first, -1 where empty. Asking for a size resamples it; `flip` mirrors it.
function sprite(name, w, h, flip) {
  const r = ART.rects[name], W = w || (r ? r[2] : 24), H = h || (r ? r[3] : 24), c = new Int32Array(W * H), polished = POLISHED.test(name);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const xx = flip ? W - 1 - x : x;
    if (!r) { c[z * W + x] = ((x >> 2) + (z >> 2)) & 1 ? 0xc040c0 : 0x402040; continue; }                 // a sheet that has not been generated yet
    const i = ((r[1] + r[3] - 1 - (z * r[3] / H | 0)) * AW + r[0] + (xx * r[2] / W | 0)) * 4;
    c[z * W + x] = AD[i + 3] < 128 ? -1 : (AD[i + 3] < 230 ? GLOW : polished || isBrass(AD[i], AD[i + 1], AD[i + 2]) ? SHINY : 0) | AD[i] << 16 | AD[i + 1] << 8 | AD[i + 2];
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
function panelMesh(name, s, flat, thick, given, box) {                        // `given`: a depth map to use as it is (a wall that has been shot at); `box`: build only this block of it [x0, x1, z0, z1]
  const { w, h, c } = s, [x0, x1, z0, z1] = box || [0, s.w, 0, s.h], dep = given || (flat ? new Uint8Array(w * h) : relief(s)), v = [], col = new Int32Array(w * h), done = new Uint8Array(w * h);
  const D = (x, z) => dep[z * w + x];
  const quad = (p, k, n) => { for (const i of [0, 1, 2, 0, 2, 3]) v.push(p[i][0] - w / 2, p[i][1], 0, p[i][2], (k >> 16 & 255) / 255 + (k & GLOW ? 2 : 0), (k >> 8 & 255) / 255 + (k & SHINY ? 2 : 0), (k & 255) / 255, n[0], n[1], n[2]); };
  for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) {                                           // soft contact shadow where a neighbour stands proud
    const d = D(x, z); let occ = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, zz = z + dz; if (xx >= 0 && xx < w && zz >= 0 && zz < h) occ += Math.min(4, Math.max(0, d - D(xx, zz))); }
    col[z * w + x] = shade(c[z * w + x], Math.max(.5, 1 - occ * .045 - .2 * Math.max(0, 1 - z / (h * .1)) - (noise3(x >> 3, z >> 3, 11) > .82 ? .08 : 0)));   // and grime: darker towards the floor and in patches
  }
  for (let z = z0; z < z1; z++) {
    for (let x = x0; x < x1; x++) {                                                                       // front faces, merged into the largest rectangles of one colour and depth
      if (done[z * w + x]) continue;
      const d = D(x, z), k = col[z * w + x], same = (xx, zz) => !done[zz * w + xx] && D(xx, zz) === d && col[zz * w + xx] === k;
      let e = x + 1, t = z + 1;
      while (e < x1 && same(e, z)) e++;
      grow: for (; t < z1; t++) for (let xx = x; xx < e; xx++) if (!same(xx, t)) break grow;
      for (let zz = z; zz < t; zz++) done.fill(1, zz * w + x, zz * w + e);
      quad([[x, -d, z], [e, -d, z], [e, -d, t], [x, -d, t]], k, [0, 1, 0]);
    }
    for (let x = x0; x < x1 || (x === w && x1 === w); x++) {                                             // steps between columns, and the two ends
      const a = x === 0 ? thick : D(x - 1, z), b = x === w ? thick : D(x, z), X = x === 0 ? .25 : x === w ? w - .25 : x;   // the end caps sit just inside the cell, so they never share a plane with the wall round the corner
      if (a < b) quad([[X, -b, z], [X, -a, z], [X, -a, z + 1], [X, -b, z + 1]], shade(c[z * w + x - 1], .82), [1, 0, 0]);
      else if (a > b) quad([[X, -a, z], [X, -b, z], [X, -b, z + 1], [X, -a, z + 1]], shade(c[z * w + x], .82), [-1, 0, 0]);
    }
    if (z < h - 1) for (let x = x0; x < x1; x++) {                                                        // ledges and their undersides
      const a = D(x, z), b = D(x, z + 1);
      if (a < b) quad([[x, -b, z + 1], [x + 1, -b, z + 1], [x + 1, -a, z + 1], [x, -a, z + 1]], shade(c[z * w + x], 1.08), [0, 0, 1]);
      else if (a > b) quad([[x, -a, z + 1], [x + 1, -a, z + 1], [x + 1, -b, z + 1], [x, -b, z + 1]], shade(c[(z + 1) * w + x], .6), [0, 0, -1]);
    }
  }
  return { name, W: w, L: thick, H: h, data: new Float32Array(v), count: v.length / 10, top: new Float32Array(0), topCount: 0, dep, src: s };
}
const resize = (s, w, h) => { const c = new Int32Array(w * h); for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) c[z * w + x] = s.c[(z * s.h / h | 0) * s.w + (x * s.w / w | 0)]; return { name: s.name, w, h, c }; };
// The wall pictures were painted 24 units tall. The halls are 32, so a band of the plain wall is let in above whatever
// decoration the picture carries (a poster, a painting, a window), and the top of the picture carries on above it.
const SPR = {};
function wallSprite(t, mir) {
  const key = t + (mir ? '~' : ''); if (SPR[key]) return SPR[key];
  const h0 = 192, add = HV - h0, s = sprite(ART.rects['wall_' + t] ? 'wall_' + t : 'wall_' + (WALL_BASE[t] || t), WV, h0, WALL_FLIP !== !!mir), plain = WALL_BASE[t] && ART.rects['wall_' + t] ? sprite('wall_' + WALL_BASE[t], WV, h0, WALL_FLIP !== !!mir) : s;
  const cut = 150, c = new Int32Array(WV * HV);                                                           // every wall of a material is lengthened at the same height, so courses and stripes run on from one to the next
  for (let z = 0; z < HV; z++) { const row = z < cut ? z : z < cut + add ? cut - add + z - cut : z - add; for (let x = 0; x < WV; x++) c[z * WV + x] = plain.c[row * WV + x]; }
  if (plain !== s) for (let z = 0; z < h0; z++) for (let x = 0; x < WV; x++) { const k = s.c[z * WV + x]; if (k !== plain.c[z * WV + x]) c[z * WV + x] = k; }   // what is fixed to the wall keeps its height above the floor
  return SPR[key] = { name: 'wall_' + key, w: WV, h: HV, c };
}
const TUNNEL = LEVEL === 1 ? { '1,56': 1, '1,57': 0, '1,58': 1, '1,59': 0, '30,56': 0, '30,57': 1, '30,58': 0, '30,59': 1 } : {};   // which half of the tunnel-mouth picture each end cell of the track shows: two tracks, so two mouths at each end
const tunnelSprite = half => { const s = sprite('tunnel', 2 * WV, HV + PIT * WPU, WALL_FLIP), c = new Int32Array(WV * s.h); for (let z = 0; z < s.h; z++) for (let x = 0; x < WV; x++) c[z * WV + x] = s.c[z * s.w + x + half * WV]; return { name: 'tunnel' + half, w: WV, h: s.h, c }; };
const PANEL = {}, panelFor = (t, flat) => PANEL[t + flat] || (PANEL[t + flat] = t[0] === 'U' ? panelMesh('panel_' + t, tunnelSprite(+t[1]), 0, THICK) : panelMesh(`panel_${t}_${flat}`, wallSprite(t.replace('~', ''), t[1] === '~'), flat, THICK));
const FAR = {}, farFor = t => FAR[t] || (FAR[t] = panelMesh('far_' + t, resize(wallSprite(t), CS * 2, WH * 2), 1, 2));   // a coarse flat panel for distant walls
const MID = {}, midFor = k => MID[k] || (MID[k] = (s => panelMesh('mid_' + k, s, 0, THICK / 2, relief(s).map(v => v >> 1)))(resize(wallSprite(k.replace('~', ''), k[1] === '~'), WV / 2, HV / 2)));   // half the detail, for the middle distance
const POST = {}, postFor = t => POST[t] || (POST[t] = (s => buildMesh({ name: 'post_' + t, W: THICK, L: THICK, H: HV, fn: (x, y, z) => shade(s.c[z * WV + x], .9) }))(wallSprite(WALL_BASE[t] || t)));
const opens = (cx, cy) => { const t = tile(cx, cy); return isFloor(t) || t === 'H'; };
const panels = [], posts = [], hedges = [], extras = [];
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
  const t = tile(cx, cy), x = cx * CS + 8, y = cy * CS + 8, tun = TUNNEL[cx + ',' + cy];
  if (t === 'H') { hedges.push({ x, y }); continue; }
  if (t === ' ' || isFloor(t)) continue;
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (opens(cx + sx, cy + sy))               // beside a door the panel stays flat so the door closes without gaps
    panels.push(tun != null ? { m: panelFor('U' + tun, 0), x: x + sx * 8, y: y + sy * 8, rot: Math.atan2(-sx, sy), nx: sx, ny: sy, lift: -PIT }
      : { m: panelFor(((cx + cy) & 1) && t !== 'N' && t !== 'P' ? t + '~' : t, tile(cx + sx, cy + sy) === 'D' ? 1 : 0), mid: midFor(((cx + cy) & 1) && t !== 'N' && t !== 'P' ? t + '~' : t), far: farFor(t), x: x + sx * 8, y: y + sy * 8, rot: Math.atan2(-sx, sy), nx: sx, ny: sy, lift: Math.max(0, baseAt(cx + sx, cy + sy)) });   // a wall stands on the floor it faces
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (opens(cx + sx, cy + sy) && !opens(cx + sx, cy) && !opens(cx, cy + sy))   // inside corners get a post
    posts.push({ m: postFor(t), x: x + sx * 7.45, y: y + sy * 7.45, lift: Math.max(0, baseAt(cx + sx, cy + sy)) });      // a hair inside the cell, for the same reason
}
// the sides of the track pit: the platform edge on one side, sooty brick under the far wall on the other
{ const strip = (name, edge) => { const h = PIT * WPU, c = new Int32Array(WV * h);
    for (let z = 0; z < h; z++) for (let x = 0; x < WV; x++) { const row = z >> 2; c[z * WV + x] = edge && z >= h - 8 ? 0xf2f1ea : edge && z >= h - 12 ? 0x24406e : z % 4 === 0 || (x + (row & 1) * 6) % 12 === 0 ? 0x221d1c : noise3(x / 12 | 0, row, 3) > .5 ? 0x3a3230 : 0x332c2a; }
    return panelMesh(name, { name, w: WV, h, c }, 0, THICK); };
  const edge = strip('pit_edge', true), soot = strip('pit_soot', false);
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (tile(cx, cy) === 'r') for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nt = tile(cx + sx, cy + sy);
    if (nt !== 'r' && TUNNEL[(cx + sx) + ',' + (cy + sy)] == null) panels.push({ m: isFloor(nt) ? edge : soot, x: cx * CS + 8 + sx * 8, y: cy * CS + 8 + sy * 8, rot: Math.atan2(sx, -sy), nx: -sx, ny: -sy, lift: -PIT });
  } }
// Where the floor changes level there is a face to draw: the front of a dais, the wall under a gallery, the side of a building
// below its roof. And where a low ceiling meets a high one, the wall above the opening.
{ const AREA = { w: 'W', k: 'W', b: 'B', c: 'C', m: 'M', i: 'I', g: 'S', o: 'S', z: 'S' }, STRIP = {};
  const stripFor = (t, z0, hpx) => {
    const key = t + '_' + z0 + '_' + hpx; if (STRIP[key]) return STRIP[key];
    const s = wallSprite(t), c = new Int32Array(WV * hpx); for (let z = 0; z < hpx; z++) for (let x = 0; x < WV; x++) c[z * WV + x] = s.c[((z0 + z) % HV) * WV + x];
    const sp = { name: 'strip_' + key, w: WV, h: hpx, c };
    return STRIP[key] = hpx > 96 ? { m: panelMesh(sp.name, resize(sp, WV / 4, hpx / 4), 1, 2), vox: .5 } : { m: panelMesh(sp.name, sp, 0, THICK), vox: 1 / WPU };   // a tall face is far below you: coarse will do
  };
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    const t = tile(cx, cy); if (!isFloor(t) || t === 'r') continue;
    const hA = baseAt(cx, cy);
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nt = tile(cx + sx, cy + sy), floor = isFloor(nt) && nt !== 'r', hB = floor ? baseAt(cx + sx, cy + sy) : nt === ' ' || nt === 'r' ? hA : Math.max(hA, 0), at = { x: cx * CS + 8 + sx * 8, y: cy * CS + 8 + sy * 8, rot: Math.atan2(sx, -sy), nx: -sx, ny: -sy };
      if (hB > hA + .1) { const st = stripFor(t === '.' ? ((cx * 7 + cy * 3) % 5 === 0 ? 'X' : 'S') : AREA[floor ? nt : t] || 'S', 0, Math.round((hB - hA) * WPU)); panels.push({ m: st.m, vox: st.vox, ...at, lift: hA }); }
      if (floor && nt === 'c' && t !== 'c' && t !== 'D') panels.push({ m: stripFor('C', LOWC * WPU, (WH - LOWC) * WPU).m, ...at, lift: LOWC });
      if (floor && t === 'c' && nt === 'D') panels.push({ m: stripFor('C', LOWC * WPU, (WH - LOWC) * WPU).m, x: at.x, y: at.y, rot: Math.atan2(-sx, sy), nx: sx, ny: sy, lift: LOWC });
    }
  } }
model('hedge', CS * VPU, CS * VPU, 52, (x, y, z) => { const n = noise3(x >> 1, y >> 1, z >> 1), m = noise3(x, y, z); return shade(n > .7 ? 0x3f9a3e : n > .3 ? 0x2f8a3c : 0x236e30, (z > 49 ? 1.15 : .8 + z / 260) * (m > .8 ? 1.12 : m < .15 ? .85 : 1)); });

// Walls can be shot to pieces: a panel that is hit gets its own copy of the picture and depth map, with a crater cut into it.
const damaged = [], BLK = 32;                                                 // a damaged panel is drawn as a grid of 32-voxel blocks, so a hit only rebuilds the block it lands in
const restore = p => { if (p.blocks) for (const b of p.blocks) if (b) R.free(b); p.own = p.blocks = p.todo = null; p.ready = false; };
function chip(p, u, z, r) {                                                   // u along the wall and z up, in voxels
  if (!p.far) return 0;
  const w = p.m.W, h = p.m.H, nx = w / BLK, nb = nx * h / BLK;
  if (!p.own) { p.own = { c: Int32Array.from(p.m.src.c), dep: Uint8Array.from(p.m.dep) }; p.blocks = new Array(nb).fill(null); p.todo = new Set(p.blocks.keys()); damaged.push(p); if (damaged.length > 24) restore(damaged.shift()); }
  const { c, dep } = p.own; let was = 0;
  for (let dz = -r - 1; dz <= r + 1; dz++) for (let dx = -r - 1; dx <= r + 1; dx++) {
    const X = Math.round(u + dx), Z = Math.round(z + dz), d = Math.hypot(dx, dz) + noise3(X, Z, 3) * 1.6;
    if (d > r || X < 0 || X >= w || Z < 0 || Z >= h) continue;
    const i = Z * w + X, nd = Math.min(p.m.L - 1, 2 + Math.round((r - d) * 1.1));
    if (nd > dep[i]) { if (!was) was = c[i]; dep[i] = nd; c[i] = shade(c[i] & 0xffffff, .62 - nd * .05);   // the broken face is duller and darker the deeper it goes
      for (const [ex, ez] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const bx = (X + ex) / BLK | 0, bz = (Z + ez) / BLK | 0; if (X + ex >= 0 && bx < nx && Z + ez >= 0 && bz < h / BLK) p.todo.add(bz * nx + bx); } }
  }
  return was;
}
function panelAt(x, y, dx, dy) {                                              // the wall panel a shot travelling (dx, dy) struck at x, y
  for (const p of panels) { if (!p.far) continue; const rx = x - p.x, ry = y - p.y; if (Math.abs(rx * p.nx + ry * p.ny) > 2.6 || dx * p.nx + dy * p.ny > 0) continue; const u = rx * Math.cos(p.rot) + ry * Math.sin(p.rot); if (Math.abs(u) <= 8) return [p, (u + 8) * WPU]; }
}

// ---------- floors and ceilings: each reference picture covers 2 x 2 cells and repeats; a cell only says which picture it shows ----------
const GROUND = [], FLOOR_L = new Uint8Array(GW * GH).fill(255), CEIL_L = new Uint8Array(GW * GH).fill(255);   // the pictures, and the one each cell shows (255: none: the pit, open sky, under a vault)
{
  const TS = 2 * WV, seen = {};
  const layer = (name, paint) => { if (seen[name] == null) { const cv = mkCanvas(TS, TS), c = cv.getContext('2d'); paint(c); seen[name] = GROUND.push(c.getImageData(0, 0, TS, TS).data) - 1; } return seen[name]; };
  const art = (name, over) => layer(name + (over ? over.name : ''), c => { const r = ART.rects[name]; if (r) c.drawImage(atlasCv, r[0], r[1], TS, TS, 0, 0, TS, TS); else { c.fillStyle = '#c040c0'; c.fillRect(0, 0, TS, TS); } if (over) over(c); });
  const dark = layer('dark', c => { c.fillStyle = '#14110f'; c.fillRect(0, 0, TS, TS); });                // under and over the walls, so a recessed wall never shows a gap
  const FLOOR_ART = { m: 'metro', r: 'rails', c: 'earth', b: 'flag', w: 'parquet', k: 'carpet', g: 'lawn', o: 'cobble', i: 'plate', z: 'plate' };
  const CEIL_ART = { m: 'metro', r: 'metro', c: 'stone', b: 'brick', w: 'salon', k: 'salon', i: 'iron' };
  // A cell on an even column shows the left half of its picture and one on an odd column the right half, so a border drawn on
  // both sides of a picture serves the cells along either edge of a room.
  function edge(c) { c.fillStyle = '#f2f1ea'; c.fillRect(0, TS - 28, TS, 28); c.fillStyle = '#24406e'; c.fillRect(0, TS - 36, TS, 8); }   // the platform edge
  const bands = (c, lr, tb) => { for (const [o, wd, colr] of [[0, 6, '#5e1218'], [6, 12, '#c9a23a']]) { c.fillStyle = colr; if (lr) { c.fillRect(o, 0, wd, TS); c.fillRect(TS - o - wd, 0, wd, TS); } if (tb) { c.fillRect(0, o, TS, wd); c.fillRect(0, TS - o - wd, TS, wd); } } };
  function sides(c) { bands(c, 1, 0); } function ends(c) { bands(c, 0, 1); } function corner(c) { bands(c, 0, 1); bands(c, 1, 0); }   // the carpet's border
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    let t = tile(cx, cy); if (t === 'D') t = doorAt(cx, cy).floor;
    const i = cy * GW + cx;
    if (t === '.') continue;                                                                              // open air
    if (t === 'H') { FLOOR_L[i] = art('floor_lawn'); continue; }                                          // hedges stand on the lawn, under the sky
    if (!isFloor(t)) {
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([sx, sy]) => 'goHz.'.includes(tile(cx + sx, cy + sy)) || vaulted(cx + sx, cy + sy)) && !inCellar(cx, cy);
      { let lv = 0; for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (cy + sy) * GW + cx + sx; if (isFloor(tile(cx + sx, cy + sy)) && LEVELS[LV[j]] > LEVELS[lv]) lv = LV[j]; } FLOOR_L[i] = dark + lv * 32; }
      if (!open) CEIL_L[i] = dark + ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([sx, sy]) => tile(cx + sx, cy + sy) === 'c') ? 32 : 0); continue;
    }
    if (t === 'k') { const lr = tile(cx - 1, cy) !== 'k' || tile(cx + 1, cy) !== 'k', tb = tile(cx, cy - 1) !== 'k' || tile(cx, cy + 1) !== 'k'; FLOOR_L[i] = art('floor_carpet', lr && tb ? corner : lr ? sides : tb ? ends : null); }
    else if (t !== 'r') FLOOR_L[i] = art('floor_' + FLOOR_ART[t], t === 'm' && tile(cx, cy + 1) === 'r' ? edge : null);   // the track bed is real geometry, further down
    if (CEIL_ART[t] && !roofed(cx, cy)) CEIL_L[i] = art('ceil_' + CEIL_ART[t]) + (t === 'c' ? 32 : 0);   // +32: the low ceiling of the catacombs
    if (FLOOR_L[i] !== 255) FLOOR_L[i] += LV[i] * 32;                                                     // and the floor's level rides in the same byte                           // grass and paths are under open sky
  }
}

// ---------- the Metro hall: a sunken track with real rails, and a tiled barrel vault ----------
// a mesh straight from quads: [[four corners as x, y, z in voxels], colour, normal]
const meshOf = (name, quads, W, L, H) => {
  const v = [];
  for (const [p, k, nm = [0, 0, 1]] of quads) for (const i of [0, 1, 2, 0, 2, 3]) v.push(p[i][0] - W / 2, p[i][1] - L / 2, 0, p[i][2], (k >> 16 & 255) / 255 + (k & GLOW ? 2 : 0), (k >> 8 & 255) / 255 + (k & SHINY ? 2 : 0), (k & 255) / 255, nm[0], nm[1], nm[2]);
  return { name, W, L, H, data: new Float32Array(v), count: v.length / 10, top: new Float32Array(0), topCount: 0 };
};
function trackMesh(half, st = 1) {                                            // the rail picture raised into relief: rails stand proud of the sleepers, sleepers of the ballast; `st` 2 keeps every other pixel, for far away
  const s = sprite('floor_rails', 128, 128), W = 64, L = 128, q = [];
  const col = (x, y) => s.c[(127 - y) * 128 + x + half * 64];
  const hgt = (x, y) => { const k = col(x, y), r = k >> 16 & 255, g = k >> 8 & 255, b = k & 255; return Math.abs(r - g) < 26 && Math.abs(g - b) < 30 && r + g + b > 420 ? 3 : r > b * 1.5 && r > 90 && g < r * .75 ? 1 : 0; };
  for (let y = 0; y < L; y += st) {
    for (let x = 0; x < W;) { let e = x + st; const k = col(x, y), h = hgt(x, y); while (e < W && col(e, y) === k && hgt(e, y) === h) e += st; q.push([[[x, y, h], [e, y, h], [e, y + st, h], [x, y + st, h]], k]); x = e; }
    for (let x = 0; x < W; x += st) {
      const h = hgt(x, y), hx = x < W - st ? hgt(x + st, y) : h, hy = y < L - st ? hgt(x, y + st) : h;
      if (hx !== h) q.push([[[x + st, y, Math.min(h, hx)], [x + st, y + st, Math.min(h, hx)], [x + st, y + st, Math.max(h, hx)], [x + st, y, Math.max(h, hx)]], shade(h > hx ? col(x, y) : col(x + st, y), .7), [h > hx ? 1 : -1, 0, 0]]);
      if (hy !== h) q.push([[[x, y + st, Math.min(h, hy)], [x + st, y + st, Math.min(h, hy)], [x + st, y + st, Math.max(h, hy)], [x, y + st, Math.max(h, hy)]], shade(h > hy ? col(x, y) : col(x, y + st), .7), [0, h > hy ? 1 : -1, 0]]);
    }
  }
  return meshOf('track' + half + '_' + st, q, W, L, 4);
}
const ACROSS = 8 * CS * VPU, SPRING = 19 * VPU, RISE = 16 * VPU;                 // the hall is eight cells from wall to wall
const vaultAt = j => Math.round(SPRING + RISE * Math.sqrt(Math.max(0, 1 - ((j + .5 - ACROSS / 2) / (ACROSS / 2)) ** 2)));   // the vault's height across the hall, in voxels
function vaultMesh(bay, art = 'vault', across = ACROSS, spring = SPRING, rise = RISE, coarse) {   // one 16-unit length of barrel vault, `across` voxels wide; `bay` lifts it clear of the door in the north wall; `coarse`: one colour per row, for far away
  const s = art === 'vault' ? sprite('vault', 64, 32) : sprite(art, 64, 96), W = 64, L = across, q = [];
  const mean = Array.from({ length: s.h }, (_, z) => { let r = 0, gr = 0, b = 0; for (let x = 0; x < 64; x++) { const k = s.c[z * 64 + x]; r += k >> 16 & 255; gr += k >> 8 & 255; b += k & 255; } return (s.c[z * 64] & SHINY) | (r >> 6) << 16 | (gr >> 6) << 8 | b >> 6; });
  const at = j => Math.round(spring + rise * Math.sqrt(Math.max(0, 1 - ((j + .5 - L / 2) / (L / 2)) ** 2))), hv = j => bay && j < 36 ? Math.max(at(j), WH * VPU) : at(j);
  const rowOf = (row, plane, nm) => { if (coarse) { q.push([plane(0, W), mean[row % s.h], nm]); return; } for (let x = 0; x < W;) { let e = x + 1; const k = s.c[(row % s.h) * 64 + x]; while (e < W && s.c[(row % s.h) * 64 + e] === k) e++; q.push([plane(x, e), k, nm]); x = e; } };
  let row = 0;
  for (let j = 0; j < L; j++) {
    const h = hv(j), n = j < L - 1 ? hv(j + 1) : h;
    rowOf(row++, (x, e) => [[x, j, h], [e, j, h], [e, j + 1, h], [x, j + 1, h]], [0, 0, -1]);                                   // the underside faces down, the risers face the middle of the hall
    for (let z = Math.min(h, n); z < Math.max(h, n); z++) rowOf(row++, (x, e) => [[x, j + 1, z], [e, j + 1, z], [e, j + 1, z + 1], [x, j + 1, z + 1]], [0, n > h ? 1 : -1, 0]);
    if (bay && j < 36 && at(j) < h) for (const X of [0, W]) q.push([[[X, j, at(j)], [X, j + 1, at(j)], [X, j + 1, h], [X, j, h]], SHINY | 0xdedcd2, [X ? -1 : 1, 0, 0]]);   // the cheeks of the door bay
  }
  return meshOf(`vault_${art}_${across}_${bay ? 1 : 0}${coarse ? 'f' : ''}`, q, W, L, spring + rise);
}
function lunetteMesh(dir) {                                                      // the tiled wall above the tunnel mouths, up to the vault
  const s = sprite('vault', 64, 32), q = [], col = (j, z) => s.c[(z % 32) * 64 + j % 64];
  for (let z = WH * VPU; z < SPRING + RISE; z++) for (let j = 0; j < ACROSS;) {
    if (vaultAt(j) <= z) { j++; continue; }
    const k = col(j, z); let e = j + 1; while (e < ACROSS && vaultAt(e) > z && col(e, z) === k) e++;
    q.push([[[32, j, z], [32, e, z], [32, e, z + 1], [32, j, z + 1]], k, [dir, 0, 0]]); j = e;
  }
  return meshOf('lunette' + dir, q, 64, ACROSS, SPRING + RISE);
}
{ const track = [trackMesh(0), trackMesh(1)], trackFar = [trackMesh(0, 2), trackMesh(1, 2)], vault = [vaultMesh(false), vaultMesh(true)], vaultFar = vaultMesh(false, 'vault', ACROSS, SPRING, RISE, true);
  let x0 = 999, x1 = 0, y0 = 999, y1 = 0;
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (vaulted(cx, cy)) { x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
  const mid = (y0 + y1 + 1) / 2 * CS;                                         // the vault spans the hall from wall to wall; the two tracks are its southern half
  for (let cx = x0; cx <= x1; cx++) {
    for (const ty of [y1, y1 - 2]) extras.push({ m: track[cx & 1], far: trackFar[cx & 1], near: 90, x: cx * CS + 8, y: ty * CS, lift: -PIT, r: 20 });
    const bay = tile(cx, y0 - 1) === 'D';
    extras.push({ m: vault[bay ? 1 : 0], far: bay ? null : vaultFar, x: cx * CS + 8, y: mid, lift: 0, r: 74 });
  }
  if (x1 >= x0) extras.push({ m: lunetteMesh(1), x: x0 * CS - .4, y: mid, lift: 0, r: 74 }, { m: lunetteMesh(-1), x: (x1 + 1) * CS + .4, y: mid, lift: 0, r: 74 });   // flush with the end walls, so no gap shows under the vault
  // the cellar: three brick barrel vaults, springing from brick beams that run between the pillars
  const brick = sprite('wall_B', 64, 96), beam = buildMesh({ name: 'cellar_beam', W: 32, L: 32, H: 16, fn: (x, y, z) => brick.c[((z * 2 + 20) % 96) * 64 + ((x + y) * 2 & 63)] });   // at half the detail: it is overhead and in shadow
  if (LEVEL === 1) for (const [r0, rows] of [[28, 4], [34, 6], [42, 4]]) { const v = vaultMesh(false, 'wall_B', rows * 64, 16 * VPU, 8 * VPU), vf = vaultMesh(false, 'wall_B', rows * 64, 16 * VPU, 8 * VPU, true); for (let cx = CELLAR[0]; cx <= CELLAR[1]; cx++) extras.push({ m: v, far: vf, x: cx * CS + 8, y: (r0 + rows / 2) * CS, lift: 0, r: rows * 8 + 12 }); }
  if (LEVEL === 1) for (const cy of [32, 33, 40, 41]) for (let cx = CELLAR[0]; cx <= CELLAR[1]; cx++) extras.push({ m: beam, vox: .5, x: cx * CS + 8, y: cy * CS + 8, lift: 16, r: 14 });
  // the workshop: riveted iron girders overhead
  const girder = buildMesh({ name: 'girder', W: 64, L: 10, H: 12, fn: (x, y, z) => (z < 2 || z > 9 || (y > 3 && y < 6)) ? ((x % 8 === 4 && (z === 0 || z === 11) && (y === 1 || y === 8)) ? SHINY | 0x9aa0a8 : SHINY | (noise3(x >> 2, z, 4) > .6 ? 0x3a3f47 : 0x2c3036)) : null });
  if (LEVEL === 1) for (const cy of [18, 22]) for (let cx = 26 * K; cx < 34 * K; cx++) extras.push({ m: girder, x: cx * CS + 8, y: (cy + .5) * DS, lift: 24, r: 14 });
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
    if (Math.abs(yy) > half) return null;
    if (o.even || yy >= 0) return k;                                                                      // the front half shows the front view
    const b = o.back ? o.back.c[z * w + w - 1 - x] : -1;                                                  // the back half shows the back view, mirrored as you walk round
    return b < 0 ? shade(k, .72) : b;
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
// The three walking machines are true 3D voxel models, carved from turnaround sheets by tools/build_art.py. Each is split into
// a torso, two arms and two legs, which move on their own: legs swing from the hip, arms rise from the shoulder to aim, and an
// arm can be shot off. _d1 and _d2 are the torso with plates shot away. The drone has no limbs and is inflated from its picture.
const GIBS = {}, RIG = {};
const battered = (fn, lvl) => (x, y, z) => { const c = fn(x, y, z); if (c == null) return null; const n = noise3(x >> 2, z >> 2, 5) * .7 + noise3(x >> 1, z >> 1, 9) * .3; return n < lvl * .07 ? null : n < lvl * .14 ? shade(c & 0xffffff, .3) : c; };
function voxels(name) {                                                       // a carved model: colours at [x + W * (y + L * z)], -1 where empty; front is +y
  const [W, L, H, cols] = ART.vox[name], r = ART.rects['vox_' + name], c = new Int32Array(W * L * H).fill(-1);
  for (let y = 0; y < L; y++) for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = ((r[1] + (y / cols | 0) * H + H - 1 - z) * AW + r[0] + (y % cols) * W + (SPRITE_FLIP ? W - 1 - x : x)) * 4;
    if (AD[i + 3] >= 128) c[x + W * (y + L * z)] = (AD[i + 3] < 230 ? GLOW : SHINY) | AD[i] << 16 | AD[i + 1] << 8 | AD[i + 2];
  }
  return { W, L, H, c };
}
for (const [n, legs] of [['automate', .4], ['scaphandre', .36], ['colosse', .36], ['sauteur', .5], ['garde', .4]]) {
  const { W, L, H, c } = voxels(n), hip = Math.round(H * legs), knee = Math.round(hip * .52), mid = W >> 1;
  const filled = (x, z) => { for (let y = 0; y < L; y++) if (c[x + W * (y + L * z)] >= 0) return true; return false; };
  const span = z => { if (!filled(mid, z)) return null; let a = mid, b = mid; while (a > 0 && filled(a - 1, z)) a--; while (b < W - 1 && filled(b + 1, z)) b++; return [a, b]; };
  let xl = W * .3 | 0, xr = W * .7 | 0, best = 0;                              // the torso's width: the widest the middle of the outline gets while the arms still hang clear of it
  for (let z = hip + 1; z < H * .8; z++) {
    const m = span(z); if (!m) continue; let runs = 0, on = false;
    for (let x = 0; x < W; x++) { const f = filled(x, z); if (f && !on) runs++; on = f; }
    if (runs >= 3 && m[1] - m[0] > best) { best = m[1] - m[0]; xl = m[0]; xr = m[1]; }
  }
  const outside = z => [xl - 1, xr + 1].some(x => x >= 0 && x < W && filled(x, z));
  let sh = hip, lo = H; for (let z = hip * .6 | 0; z < H; z++) if (outside(z)) { sh = z; lo = Math.min(lo, z); }   // the arms: from the hands up to the shoulders
  const elbow = Math.round((lo + sh) / 2);
  let neck = H, thin = (xr - xl) * .78;                                        // the neck: the narrowest row above the shoulders, if there is one
  for (let z = sh + 1; z < Math.min(H - 3, sh + H * .22); z++) { const m = span(z); if (m && m[1] - m[0] < thin) { thin = m[1] - m[0]; neck = z; } }
  const partOf = (x, z) => z < hip * .6 ? (x < mid ? 'l' : 'r') + (z < knee ? 's' : 't') : x < xl ? (z < elbow ? 'lf' : 'lu') : x > xr ? (z < elbow ? 'rf' : 'ru') : z < hip ? (x < mid ? 'l' : 'r') + (z < knee ? 's' : 't') : z >= neck ? 'head' : 'torso';
  const only = k => (x, y, z) => { const v = c[x + W * (y + L * z)]; return v >= 0 && partOf(x, z) === k ? v : null; };
  for (const k of ['torso', 'head', 'lu', 'lf', 'ru', 'rf', 'lt', 'ls', 'rt', 'rs']) model(`${n}_${k}`, W, L, H, only(k));   // upper arm, forearm, thigh, shin on each side
  for (const d of [1, 2]) model(`${n}_torso_d${d}`, W, L, H, battered(only('torso'), d));
  const armX = side => { let sum = 0, cnt = 0; for (let x = side ? xr + 1 : 0; x < (side ? W : xl); x++) if (filled(x, elbow)) { sum += x; cnt++; } return ((cnt ? sum / cnt : side ? xr + 3 : xl - 3) + .5 - W / 2) * VOX; };
  RIG[n] = { H, hip: hip * VOX, knee: knee * VOX, sh: (sh - 2) * VOX, elbow: elbow * VOX, lo: lo * VOX, neck: neck * VOX, ax: [(xl - W / 2) * VOX, (xr + 1 - W / 2) * VOX], ex: [armX(0), armX(1)], gun: n === 'automate' || n === 'garde' ? [0] : n === 'sauteur' ? [] : [0, 1] };   // gun: which arms it fires with
}
{ const n = 'lanterne', thick = s => Math.round(s.w * .7), pose = k => sprite(ART.rects[n + k] ? n + k : n, 0, 0, SPRITE_FLIP), ease = pose(''), back = ART.rects[n + '_back'];
  const add = (name, s) => { const m = inflate(s, thick(s), { round: 1.1, back: back && sprite(n + '_back', s.w, s.h, SPRITE_FLIP) }), fn = m.fn(0); model(name, m.W, m.L, m.H, fn); return [m, fn]; };
  add(n + '_i', ease);
  for (const [k, s] of [['aim', pose('_aim')], ['fire', pose('_fire')]]) { const [m, fn] = add(`${n}_${k}`, s); for (const d of [1, 2]) model(`${n}_${k}_d${d}`, m.W, m.L, m.H, battered(fn, d)); }
  GIBS[n] = [];                                                              // the chunks it flies apart into
  const cw = Math.ceil(ease.w / 2), ch = Math.ceil(ease.h / 2);
  for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) {
    const c = new Int32Array(cw * ch).fill(-1);
    for (let z = 0; z < ch; z++) for (let x = 0; x < cw; x++) { const X = q * cw + x, Z = r * ch + z; if (X < ease.w && Z < ease.h) c[z * cw + x] = ease.c[Z * ease.w + X]; }
    const m = inflate({ w: cw, h: ch, c }, Math.max(4, Math.round(thick(ease) * .6)), { even: true }), name = `${n}_g${GIBS[n].length}`;
    model(name, m.W, m.L, m.H, m.fn(0)); GIBS[n].push({ name, dx: ((q + .5) * cw - ease.w / 2) * VOX, dz: r * ch * VOX });
  } }
box('a_door', sprite('door', CS * VPU, WH * VPU), 16);
for (const t of 'MCBWI') { const s = resize(wallSprite(t), CS * VPU, WH * VPU); box('a_door_secret_' + t, { w: s.w, h: s.h, c: s.c.map((k, i) => k < 0 ? k : shade(k, i % s.w < 2 ? .5 : .86)) }, 16); }   // a hidden door is the wall itself, a shade darker and with a seam down it
   // the doors are as tall as the halls
 box('a_door_red', sprite('door_red', CS * VPU, WH * VPU), 16); box('a_door_blue', sprite('door_blue', CS * VPU, WH * VPU), 16);
box('a_key_red', sprite('key_red'), 3); box('a_key_blue', sprite('key_blue'), 3); box('a_baguette', sprite('baguette'), 10);
for (const n of ['bullets', 'shells', 'cells']) { const s = sprite(n); box('a_' + n, s, Math.round(s.w * .7)); }
{ const s = sprite('helmet'), m = inflate(s, Math.round(s.w * .8), { round: 1.2 }); model('a_helmet', m.W, m.L, m.H, m.fn(0)); }
lathe('a_wine', sprite('wine')); lathe('a_lamp', sprite('lamp')); lathe('a_drum', sprite('drum')); lathe('a_column', sprite('column', 0, WH * VPU));
box('a_cask', sprite('cask'), 44); lathe('a_table', sprite('table')); box('a_exit', sprite('exit'), 28);
lathe('a_chandelier', sprite('chandelier')); box('a_arch', sprite('arch', WV + 6, LOWC * VPU), 12); box('a_rack', sprite('rack'), 40); box('a_workbench', sprite('workbench'), 16); box('a_train', sprite('train'), 36);
for (const [n, depth] of [['kiosk', 26], ['suitcases', 26], ['trolley', 30], ['barrow', 24], ['bottles', 30], ['armchair', 38], ['armour', 14], ['clock', 20], ['anvil', 16], ['repair', 16]]) box('a_' + n, sprite(n), depth);   // the second set of furniture: flat-sided things are extruded,
for (const n of ['scale', 'morris', 'bones', 'candles', 'sacks', 'globe', 'palm', 'coil', 'urn', 'statue']) lathe('a_' + n, sprite(n));                                                                                    // round ones are turned
for (const n of ['paper', 'manhole', 'drain', 'boneheap', 'spill', 'straw', 'rug', 'rug2', 'leaves', 'oil', 'plans', 'cable']) { const s = sprite('flat_' + n); model('f_' + n, s.w, s.h, 1, (x, y) => { const k = s.c[y * s.w + x]; return k < 0 ? null : k; }); }   // things lying on the floor: one voxel thick, drawn from above
for (const [n, depth] of [['hsign', 4], ['hclock', 10], ['hams', 8], ['hoist', 10], ['pipes', 12], ['parts', 8], ['banner', 2]]) box('a_' + n, sprite(n), depth);   // and things that hang from the ceiling
for (const n of ['ring', 'fan', 'roots']) lathe('a_' + n, sprite(n));
lathe('a_hang', sprite('hanglamp')); lathe('a_lantern', sprite('lantern')); lathe('a_bin', sprite('bin')); lathe('a_signal', sprite('signal')); box('a_bench', sprite('bench'), 14);
{ const s = sprite('crate'); box('a_crate', s, s.w); }
// shots, sparks and debris stay simple shapes, at half scale so they sit with the finer models
model('a_shot', 2, 4, 2, () => 0xffcf5c, .5); model('a_spark', 3, 3, 3, (x, y, z) => (x + y + z) % 2 ? 0x9fe8ff : 0xffffff, .5); model('a_shell', 4, 4, 4, (x, y, z) => Math.hypot(x - 1.5, y - 1.5, z - 1.5) < 2.2 ? 0xff5a3a : null, .5);
model('a_bit', 2, 2, 2, () => 0xe0bb45, .4); model('a_smoke', 5, 5, 5, (x, y, z) => Math.hypot(x - 2, y - 2, z - 2) < 2.6 ? (noise3(x, y, z) > .5 ? 0xffcf5c : 0xff8a2a) : null, .5);
model('a_bolt', 2, 6, 2, (x, y, z) => (y & 1) ? 0x9fe8ff : 0xffffff, .5);
model('a_sparkle', 1, 1, 1, () => GLOW | 0xfff3b0, .35); model('a_ember', 1, 1, 1, () => GLOW | 0xff8a2a, .3);                 // sparks: they glow and bloom
model('a_oil', 2, 2, 2, () => 0x17120e, .3);                                                                               // a drop of machine oil
for (const [i, k] of [[1, .5], [2, .85]]) model('a_puff' + i, 5, 5, 5, (x, y, z) => Math.hypot(x - 2, y - 2, z - 2) < 2.6 ? (noise3(x, y, z + i) > .5 ? 0x8a8780 : 0x6a6762) : null, k);
const blot = (r, dark, sheen) => (x, y) => { const d = Math.hypot(x - r, y - r) + noise3(x >> 1, y >> 1, r) * r * .5; return d > r ? null : noise3(x, y, 7) > .86 ? sheen : dark; };
model('a_pool', 28, 28, 1, blot(14, 0x120e0b, 0x3a3128)); model('a_winepool', 30, 30, 1, blot(15, 0x4a0a14, 0x7a1422));
{ const nade = (x, y, z) => z > 4 ? (x > 0 && x < 3 && y > 0 && y < 3 ? SHINY | 0xb08a3a : null) : Math.hypot(x - 1.5, y - 1.5, z - 2) < 2.6 ? (z === 2 ? 0x2c3620 : 0x3d4a2a) : null;
  model('a_grenade', 4, 4, 6, nade, .3); model('a_grenade_p', 4, 4, 6, nade, .7); }
// the guard's shield: an enamelled plate with a brass rim and a lit slit to see through
model('a_shield', 26, 3, 46, (x, y, z) => z > 31 && z < 35 && x > 6 && x < 19 ? (y === 1 ? GLOW | 0x7fe8ff : null) : x < 2 || x > 23 || z < 2 || z > 43 ? SHINY | 0xb08a3a : x % 8 === 4 && z % 8 === 4 ? SHINY | 0xc9a23a : SHINY | (noise3(x >> 2, z >> 2, 8) > .6 ? 0x26345e : 0x1f2b50)); model('a_scorch', 44, 44, 1, blot(22, 0x0c0a09, 0x1e1a17)); model('a_hole', 2, 2, 2, () => 0x0e0c0b, .3);
for (const n of ['a_shot', 'a_spark', 'a_shell', 'a_bolt']) { const d = MODEL_DEFS[n], f = d.fn; d.fn = (x, y, z) => { const c = f(x, y, z); return c == null ? null : c | GLOW; }; }   // shots make their own light
// weapons are relief cards cut from the first-person sheet: always seen from behind, exactly as drawn
const WEAPON_VOX = 0.085, GUN_VOX = 0.125, GUN_UP = 0, HAND = [0, -.6, 0, -.5, -.25];   // HAND: where the hand sits on the gun (along it, back, across, down) and how it is tilted
// in the hand the weapons are true 3D models carved from their side views; the cards above are what lies on the floor to be picked up
for (const n of ['pistol', 'shotgun', 'smg', 'tesla', 'hand']) { const v = voxels(n === 'hand' ? n : 'gun_' + n); model('v_' + n, v.W, v.L, v.H, (x, y, z) => { const k = v.c[x + v.W * (y + v.L * z)]; return k < 0 ? null : k; }, GUN_VOX); }
for (const n of ['w_pistol', 'w_shotgun', 'w_smg', 'w_tesla']) { const m = inflate(sprite(n, 0, 0, SPRITE_FLIP), 8, { even: true }); model(n, m.W, m.L, m.H, m.fn(0), WEAPON_VOX); }
model('w_flash', 7, 4, 7, (x, y, z) => Math.abs(x - 3) + Math.abs(z - 3) < 4 - y * 0.6 ? (Math.abs(x - 3) + Math.abs(z - 3) < 2 ? GLOW | 0xffffff : GLOW | 0xffcf5c) : null, 0.3);
const MESH = {}, mesh = n => MESH[n] || (MESH[n] = buildMesh(MODEL_DEFS[n]));

// ---------- things in the level ----------
const spread = o => Math.abs(o) >= 3 ? o + Math.sign(o) * (DS - CS) / 2 : o * K;                         // an offset that put a thing by the wall still does
const C = (cx, cy, ox = 0, oy = 0) => ({ x: (cx + .5) * DS + spread(ox), y: (cy + .5) * DS + spread(oy) });   // a place on the plan
// ---------- light: every lamp is placed by hand, and its light is baked into the floors, ceilings and walls ----------
const WARM = [1, .88, .62], AMBER = [1, .68, .38], COLD = [.45, .9, 1];
const FIX = [];                                                              // lamps: a model, where it stands or what height it hangs from, and the light it gives
if (LEVEL === 1) {
for (let cx = 2; cx <= 14; cx += 2) FIX.push({ model: 'a_hang', x: cx * DS, y: 28 * DS, hang: (SPRING + RISE) * VOX, z: (SPRING + RISE) * VOX - 6, R: 110, I: .5, col: WARM });
for (const [cx, cy] of [[7, 4], [8, 7], [2, 8], [8, 14], [5, 12], [11, 9], [4, 2], [10, 4], [13, 8]]) FIX.push({ model: 'a_lantern', ...C(cx, cy), hang: LOWC, z: LOWC - 5, R: 76, I: .85, col: AMBER, flick: 1 });
for (const [cx, cy] of [[18, 18], [22, 18], [20, 15], [20, 21], [14, 18], [2, 18], [14, 22], [17, 27]]) { const hang = inCellar(cx * K, cy * K) ? 22 : WH - 6; FIX.push({ model: 'a_lantern', ...C(cx, cy), hang, z: hang - 5, R: 84, I: .9, col: AMBER, flick: 1 }); }
for (const [cx, cy, ox, oy] of [[2, 12, -4, 4], [11, 12, 4, 4], [5, 4, -4, 4], [8, 7, 4, -4], [8, 13, -4, 0], [2, 5, 4, -4], [16, 20, -4, 0], [6, 9, 4, 4]]) FIX.push({ model: 'a_candles', ...C(cx, cy, ox, oy), z: 8, R: 44, I: .55, col: AMBER, flick: 1 });   // candles on blocks of stone
for (const [cx, cy, ox, oy] of [[26, 18, -4, 0], [33, 18, 4, 0], [26, 22, -4, 0], [33, 22, 4, 0]]) FIX.push({ model: 'a_coil', ...C(cx, cy, ox, oy), z: 20, R: 60, I: .6, col: COLD });   // the Baron's coils
for (const [cx, cy, hang] of [[4, 2, LOWC], [6, 8, LOWC], [17, 20, 21], [23, 16, 21], [2, 18, WH - 4]]) FIX.push({ model: 'a_ring', ...C(cx, cy, 2, 2), hang, z: hang - 9, R: 70, I: .6, col: AMBER, flick: 1 });   // rings of candles
for (const [cx, cy] of [[20, 9], [18, 3], [22, 3]]) FIX.push({ model: 'a_chandelier', ...C(cx, cy), hang: WH, z: WH - 8, R: 120, I: .55, col: WARM });
for (const [cx, cy, ox] of [[26, 9, -4], [33, 9, 4], [28, 5, 0], [32, 13, 0]]) FIX.push({ model: 'a_lamp', ...C(cx, cy, ox, -5), z: 16, R: 88, I: .85, col: WARM });
} else for (const [cx, cy] of [[4, 24], [8, 27], [15, 24], [19, 21], [24, 20], [30, 25], [27, 19], [16, 6], [22, 12], [26, 5], [20, 6], [24, 15], [11, 25]]) { const p = C(cx, cy, 4, 4); FIX.push({ model: 'a_lamp', ...p, z: heightAt(p.x, p.y) + 16, R: 95, I: .9, col: WARM }); }   // street lamps along the roofs
const lights = FIX.map(f => ({ x: f.x, y: f.y, z: f.z, R: f.R, I: f.I, col: f.col, flick: f.flick, air: 1 }));
const FARK = 1.55 * .48;                                                      // how much of a lamp's direct light the far map carries
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {            // sconces, lit windows and Tesla tubes on the walls
  const t = tile(cx, cy), k = { L: [60, .65, WARM], X: [56, .5, WARM], T: [62, .6, COLD], Y: [62, .5, COLD], 9: [40, .5, AMBER], d: [64, .7, AMBER] }[t];
  if (k) for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isFloor(tile(cx + sx, cy + sy))) lights.push({ x: cx * CS + 8 + sx * 11, y: cy * CS + 8 + sy * 11, z: 13 + Math.max(0, baseAt(cx + sx, cy + sy)), R: k[0], I: k[1], col: k[2], air: .5 });
}
for (let j = 1; j < GH; j += 2) for (let i = 1; i < GW; i += 2) {            // the lamps painted on the flat ceilings sit where four cells meet
  const c = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].find(([a, b]) => 'wki'.includes(tile(a, b)) || (tile(a, b) === 'm' && !vaulted(a, b)));
  if (c) lights.push({ x: i * CS + (c[0] < i ? -1 : 1), y: j * CS + (c[1] < j ? -1 : 1), z: WH - 3, R: 60, I: .28, col: WARM, air: .5 });
}
const FLOOR_TINT = { z: [.7, .74, .9], '.': [.6, .6, .8], m: [.85, .87, .9], r: [.55, .5, .5], c: [1, .55, .32], b: [.95, .75, .55], w: [1, .7, .42], k: [1, .32, .28], g: [.5, 1, .42], o: [.75, .74, .92], i: [.75, .8, .88] };
const AMBIENT = { z: [.68, .62, .8], '.': [.5, .46, .62], m: [.36, .38, .44], r: [.26, .27, .32], c: [.27, .23, .2], b: [.25, .21, .19], w: [.42, .38, .34], k: [.42, .38, .34], g: [.5, .46, .62], o: [.5, .46, .62], i: [.3, .32, .37] };
const LS = 2, LW = SIZE / LS, LM = new Float32Array(LW * LW * 3), FARM = new Float32Array(LW * LW * 3);            // the light map: one sample every two units
{ const ok = new Uint8Array(LW * LW);
  const kind = (gx, gy) => { const cx = (gx * LS + 1) >> 4, cy = (gy * LS + 1) >> 4; let t = tile(cx, cy); if (t === 'D') t = doorAt(cx, cy).floor; return isFloor(t) ? t : null; };
  for (let gy = 0; gy < LW; gy++) for (let gx = 0; gx < LW; gx++) { const t = kind(gx, gy); if (!t) continue; const a = AMBIENT[t], i = (gy * LW + gx) * 3; LM[i] = a[0] * .62; LM[i + 1] = a[1] * .62; LM[i + 2] = a[2] * .62; ok[gy * LW + gx] = 1; }   // little ambient light: the lamps do the work
  for (const l of lights) { const Q = l.R * 1.5; for (let gy = Math.max(0, (l.y - Q) / LS | 0); gy < Math.min(LW, (l.y + Q) / LS + 1); gy++) for (let gx = Math.max(0, (l.x - Q) / LS | 0); gx < Math.min(LW, (l.x + Q) / LS + 1); gx++) {
    const j = gy * LW + gx, x = gx * LS + 1, y = gy * LS + 1, d = Math.hypot(l.x - x, l.y - y), fl = Math.sqrt(d * d + 64); if (!ok[j] || fl >= Q || !canSee(l.x, l.y, x, y)) continue;
    { const f = l.I * FARK * (1 - fl / Q) ** 2; FARM[j * 3] += l.col[0] * f; FARM[j * 3 + 1] += l.col[1] * f; FARM[j * 3 + 2] += l.col[2] * f; }   // the lamp's direct light, as the renderer would cast it: used wherever the lamp is too far to be lit in full
    if (d >= l.R) continue;
    const k = l.I * (1 - d / l.R) ** 1.5 * .34, ft = FLOOR_TINT[kind(gx, gy)]; LM[j * 3] += l.col[0] * k * (.4 + .6 * ft[0]); LM[j * 3 + 1] += l.col[1] * k * (.4 + .6 * ft[1]); LM[j * 3 + 2] += l.col[2] * k * (.4 + .6 * ft[2]);
  } }
  for (let i = 0; i < LM.length; i++) LM[i] = Math.min(1.08, LM[i]);
  for (let pass = 0; pass < 4; pass++) { const add = [];                       // spread the light a little way into the walls so smoothing does not pull darkness out of them
    for (let gy = 1; gy < LW - 1; gy++) for (let gx = 1; gx < LW - 1; gx++) if (!ok[gy * LW + gx]) { let n = 0, r = 0, g = 0, b = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (gy + dy) * LW + gx + dx; if (ok[j]) { n++; r += LM[j * 3]; g += LM[j * 3 + 1]; b += LM[j * 3 + 2]; } } if (n) { const fr = [0, 0, 0]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (gy + dy) * LW + gx + dx; if (ok[j]) for (let k = 0; k < 3; k++) fr[k] += FARM[j * 3 + k] / n; } add.push([gy * LW + gx, r / n, g / n, b / n, fr]); } }
    for (const [j, r, g, b, fr] of add) { FARM.set(fr, j * 3); LM[j * 3] = r; LM[j * 3 + 1] = g; LM[j * 3 + 2] = b; ok[j] = 1; } }
}
const LMU8 = Uint8Array.from(LM, v => Math.min(255, v * 255));             // the renderer samples this as its ambient light
const lightAt = (x, y) => {                                                  // the baked light at a point, smoothed between samples
  const fx = Math.max(0, Math.min(LW - 1.001, (x - 1) / LS)), fy = Math.max(0, Math.min(LW - 1.001, (y - 1) / LS)), gx = fx | 0, gy = fy | 0, u = fx - gx, v = fy - gy, i = (gy * LW + gx) * 3, out = [0, 0, 0];
  for (let k = 0; k < 3; k++) out[k] = (LM[i + k] * (1 - u) + LM[i + 3 + k] * u) * (1 - v) + (LM[i + LW * 3 + k] * (1 - u) + LM[i + LW * 3 + 3 + k] * u) * v;
  return out;
};
// a model matrix: at x, y, height z, turned by `rot` about the vertical; `tilt` then leans it about its local x axis at height `pz`
const M4 = (x, y, z, rot, tilt = 0, pz = 0, py = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt), ty = py - py * ct + pz * st, tz = pz - py * st - pz * ct;
  return new Float32Array([c, s, 0, 0, -s * ct, c * ct, st, 0, s * st, -c * st, ct, 0, x - s * ty, y + c * ty, z + tz, 1]);
};
const mmul = (a, b) => { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
const mT = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const mRX = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; };   // positive swings a hanging limb forwards
const mRZ = a => { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; };
const about = (x, y, z, R) => mmul(mT(x, y, z), mmul(R, mT(-x, -y, -z)));           // turn about a joint
// a flight of stairs: four treads cut from the floor's own picture, with risers and closed sides
function stairMesh(art, rise) {
  const s = sprite(art, 128, 128), q = [];
  for (let k = 0; k < 4; k++) {
    const z = (k + 1) * rise, y0 = k * 32, runs = (y, f) => { for (let x = 0; x < 128;) { let e = x + 1; const c = s.c[y * 128 + x]; while (e < 128 && s.c[y * 128 + e] === c) e++; f(x, e, c); x = e; } };
    for (let y = y0; y < y0 + 32; y++) runs(y, (x, e, c) => q.push([[[x, y, z], [e, y, z], [e, y + 1, z], [x, y + 1, z]], y === y0 ? shade(c, 1.25) : c]));   // the nosing catches the light
    runs(y0, (x, e, c) => q.push([[[x, y0, z - rise], [e, y0, z - rise], [e, y0, z], [x, y0, z]], shade(c, .55), [0, -1, 0]]));
    for (const X of [0, 128]) q.push([[[X, y0, 0], [X, y0 + 32, 0], [X, y0 + 32, z], [X, y0, z]], 0x3a2c22, [X ? 1 : -1, 0, 0]]);
  }
  return meshOf('stair_' + art + rise, q, 128, 128, rise * 4);
}
model('a_rail', 64, 3, 15, (x, y, z) => z >= 13 ? SHINY | 0xb08a3a : x % 16 < 2 || z < 1 ? 0x2e2a27 : x % 16 === 8 && y === 1 ? SHINY | 0x8a6a2c : null);   // a brass handrail on iron posts
{ const SM = {}, FL = { w: 'parquet', k: 'carpet', b: 'flag', z: 'plate', m: 'metro', c: 'earth', i: 'plate', g: 'lawn', o: 'cobble' };
  for (const s of FLIGHTS) { const key = 'floor_' + FL[tile(s.x0 / CS, s.y0 / CS)], rise = (s.hi - s.lo) * VPU / 4; extras.push({ m: SM[key + rise] || (SM[key + rise] = stairMesh(key, rise)), x: s.x0 + DS / 2, y: s.y0 + DS / 2, lift: s.lo, r: 26, rot: s.dy ? (s.dy < 0 ? Math.PI : 0) : s.dx < 0 ? Math.PI / 2 : -Math.PI / 2 }); }
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {                                       // a rail along every edge with a drop beyond it
    const t = tile(cx, cy); if (!isFloor(t) || 'r.'.includes(t) || STAIR[cy * GW + cx]) continue;
    for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nt = tile(cx + sx, cy + sy); if (isFloor(nt) && nt !== 'r' && !STAIR[(cy + sy) * GW + cx + sx] && baseAt(cx + sx, cy + sy) < baseAt(cx, cy) - 2.5) extras.push({ m: mesh('a_rail'), x: cx * CS + 8 + sx * 7.3, y: cy * CS + 8 + sy * 7.3, lift: baseAt(cx, cy), r: 10, rot: sx ? Math.PI / 2 : 0 }); }
  } }
for (const p of panels) p.M = M4(p.x, p.y, p.lift, p.rot);
for (const p of posts) p.M = M4(p.x, p.y, p.lift || 0, 0);
for (const e of extras) e.M = M4(e.x, e.y, e.lift, e.rot || 0);
for (const h of hedges) h.M = M4(h.x, h.y, 0, 0);
// What stands on each unit of floor (furniture, arches, hedges): its top and its underside. The renderer walks this map
// from a lit point towards each lamp, so a table shadows the floor under it and an arch shadows the tunnel beyond it.
const THINGS = new Uint8Array(SIZE * SIZE * 2), FOOT = {}; let thingsDirty = true;
function footprint(name) {                                                    // for each column of a model, its lowest and highest voxel
  if (FOOT[name]) return FOOT[name];
  const d = MODEL_DEFS[name], lo = new Int16Array(d.W * d.L).fill(-1), hi = new Int16Array(d.W * d.L);
  for (let y = 0; y < d.L; y++) for (let x = 0; x < d.W; x++) for (let z = 0; z < d.H; z++) if (d.fn(x, y, z) != null) { const i = y * d.W + x; if (lo[i] < 0) lo[i] = z; hi[i] = z + 1; }
  return FOOT[name] = { lo, hi };
}
function bakeThings() {
  THINGS.fill(0); thingsDirty = false;
  const put = (x, y, bot, top) => { if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return; const i = ((y | 0) * SIZE + (x | 0)) * 2, t = Math.min(255, Math.ceil(top * 255 / 32)), b = Math.floor(bot * 255 / 32); if (!THINGS[i]) { THINGS[i] = t; THINGS[i + 1] = b; } else { THINGS[i] = Math.max(THINGS[i], t); THINGS[i + 1] = Math.min(THINGS[i + 1], b); } };
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) { const h = CELLH[cy * GW + cx]; if (h > .5 && isFloor(tile(cx, cy))) for (let dy = 0; dy < CS; dy++) for (let dx = 0; dx < CS; dx++) put(cx * CS + dx, cy * CS + dy, 0, heightAt(cx * CS + dx + .5, cy * CS + dy + .5)); }   // a raised floor shadows the one below it
  for (const h of hedges) for (let dy = 0; dy < CS; dy++) for (let dx = 0; dx < CS; dx++) put(h.x - CS / 2 + dx, h.y - CS / 2 + dy, 0, 13);
  for (const d of decor) {
    const def = MODEL_DEFS[d.model]; if (d.gone || d.lift || !def) continue;                               // (hanging lamps are left out: they would shadow their own light)
    const vox = def.o ? def.o.vox : 1, f = footprint(d.model), c = Math.cos(d.rot), s = Math.sin(d.rot);
    for (let y = 0; y < def.L; y++) for (let x = 0; x < def.W; x++) { const i = y * def.W + x; if (f.lo[i] < 0) continue; const lx = (x + .5 - def.W / 2) * vox, ly = (y + .5 - def.L / 2) * vox; put(d.x + c * lx - s * ly, d.y + s * lx + c * ly, Math.max(0, f.lo[i] * vox + (d.z || 0)), f.hi[i] * vox + (d.z || 0)); }
  }
  R.setThings(THINGS, SIZE);
}
const train = { x: LEVEL === 1 ? -800 : 1e9, next: LEVEL === 1 ? 14 : 1e9, sounded: false }, TRAIN_Y = 59 * CS, TRAIN_END = 1240, CARS = 5;                           // a train comes through the station every so often
const steamers = [];                                                         // pipework that vents steam
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (tile(cx, cy) === 'G') for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isFloor(tile(cx + sx, cy + sy))) steamers.push({ x: cx * CS + 8 + sx * 9, y: cy * CS + 8 + sy * 9, t: Math.random() * 6 });
const flashes = [];                                                          // short-lived lights: muzzle flashes, explosions
const flashAt = (x, y, z, R, I, col, life) => { flashes.push({ x, y, z, R, I, col, t: 0, life }); if (flashes.length > 8) flashes.shift(); };

// A machine as it stands at the start, or as it arrives part-way through.
const mk = (type, x, y) => ({ type, x, y, ...ENEMY[type], hp0: ENEMY[type].hp, arm: [1, 1], armHp: [ENEMY[type].hp * .45, ENEMY[type].hp * .45], stun: 0, dazed: 0, kx: 0, ky: 0, twist: 0, nod: 0, wind: 0, limp: 0, aim: 0, yaw: 0, hop: 0, z: heightAt(x, y),
  awake: false, cool: 1 + rnd(), t: rnd() * 5, seeT: rnd() * .2, see: false, flash: 0, atk: 0, strafe: rnd() < .5 ? 1 : -1, flank: rnd() < .35, fleeT: 0, coverT: rnd(), cover: null, phase: 1, rushCd: 5 });
const WIND = .4;                                                              // how long a machine takes to charge a shot
const ENEMY = {
  automate: { hp: 30, speed: 40, r: 5, range: 220, rate: 2.47, dmg: 4, shots: 1, shot: 'a_shot', score: 1 },
  lanterne: { hp: 18, speed: 62, r: 4, range: 180, rate: 1.3, dmg: 3, shots: 1, shot: 'a_spark', fly: 7, score: 1 },
  scaphandre: { hp: 150, speed: 27, r: 7, range: 240, rate: 2.73, dmg: 7, shots: 3, shot: 'a_shell', score: 1 },
  sauteur: { hp: 26, speed: 80, r: 4, range: 0, rate: 1.5, dmg: 10, shots: 0, shot: 'a_shot', leap: true, score: 1 },             // a fencer on springs: no gun, it leaps at you
  garde: { hp: 95, speed: 30, r: 6.5, range: 200, rate: 2.3, dmg: 5, shots: 2, shot: 'a_shot', shield: true, score: 1 },          // carries a shield: shots from the front glance off it
  colosse: { hp: 1100, speed: 30, r: 9, range: 300, rate: 1.69, dmg: 7, shots: 5, shot: 'a_shell', boss: true, score: 1 },
};
// Telling the machines apart at a glance: each kind wears its own colour (the automate is plain brass and navy), and the same
// colour marks its name under the crosshair.
const KIND = { automate: { name: 'AUTOMATE', col: '#d9b24a' }, lanterne: { name: 'LANTERNE', col: '#ff8a3a' }, scaphandre: { name: 'SCAPHANDRIER', col: '#58c08a', tint: [.72, 1.2, .8] },
  sauteur: { name: 'SAUTEUR', col: '#ff4a4a', tint: [1.3, .6, .55] }, garde: { name: 'GARDE', col: '#5fa8ff', tint: [.62, .84, 1.35] }, colosse: { name: 'LE COLOSSE', col: '#c8c8d8', tint: [.8, .8, .95] } };
const tintOf = name => { const k = KIND[name.slice(0, name.indexOf('_'))]; return k && k.tint; };
const WEAPONS = [
  { name: 'PISTOLET', model: 'w_pistol', gun: 'v_pistol', ammo: 'bullets', rate: .30, dmg: 13, pellets: 1, spread: .012, off: [13, 4.3, -1.55] },
  { name: 'FUSIL DE CHASSE', model: 'w_shotgun', gun: 'v_shotgun', ammo: 'shells', rate: .85, dmg: 9, pellets: 8, spread: .1, off: [13, 4.0, -1.75] },
  { name: 'MITRAILLETTE', model: 'w_smg', gun: 'v_smg', ammo: 'bullets', rate: .085, dmg: 10, pellets: 1, spread: .04, off: [13, 4.2, -1.75] },
  { name: 'ARC TESLA', model: 'w_tesla', gun: 'v_tesla', ammo: 'cells', rate: .14, dmg: 34, pellets: 1, spread: 0, pierce: true, off: [13, 4.2, -1.75] },
];
const MAG = [8, 2, 30, 40], RELOAD = [.9, 1.15, 1.3, 1.4];                       // rounds in each gun, and how long it takes to reload
const ALT = [                                                                  // each gun's other trigger
  { cost: 3, pellets: 1, dmg: 44, spread: 0, rate: .7, kick: 1.9 },             // pistol: three rounds as one aimed shot
  { cost: 2, pellets: 16, dmg: 9, spread: .15, rate: 1.25, kick: 1.8 },         // shotgun: both barrels
  { cost: 6, pellets: 6, dmg: 10, spread: .018, rate: .5, kick: 1.5 },          // submachine gun: a tight burst of six
  { cost: 8, pellets: 1, dmg: 60, spread: 0, rate: .6, kick: 1.2, chain: 3 },   // Tesla: an arc that jumps on to three more machines
];
const BREAK = { a_cask: 30, a_crate: 18, a_rack: 45, a_bottles: 12, a_suitcases: 16, a_sacks: 22, a_kiosk: 30, a_bones: 8, a_palm: 14, a_urn: 22, a_globe: 14, a_armchair: 28 };                         // furniture that can be shot to pieces, and what it takes
let enemies, items, decor, shots, fx, debris, brass, P, state, flow, flowT, logLines, stats, freeze = 0, enc = [], darkT = 0, lampT = 0, MAXLAMP = 18, tagT = 0, fires = [];   // enc: the encounters; darkT: how long the lanterns stay out   // brass: spent cases on the floor; freeze: the instant the game holds still on a kill
const say = t => { logLines.push({ t, life: 3.2 }); if (logLines.length > 3) logLines.shift(); };
function reset() {
  enemies = []; items = []; decor = []; shots = []; fx = []; debris = []; brass = []; logLines = []; thingsDirty = true; freeze = 0;
  for (const d of doors) { d.open = 0; d.hold = 0; d.unlocked = !d.key; d.sealed = false; }
  for (const l of lights) { l.off = false; l.w = l.bw = 0; } fires = [];
  for (const p of panels) p.smashed = false;
  for (const s of steamers) s.cd = 0;
  darkT = 0; enc = ENC.map(n => ({ ...n, state: 0 })); for (const n of enc) if (n.pre) for (const i of n.seal) doors[i].sealed = true;
  for (const p of damaged.splice(0)) restore(p);                                                         // the walls are whole again
  const E = (type, cx, cy, ox, oy) => { const p = C(cx, cy, ox, oy); enemies.push(mk(type, p.x, p.y)); };
  const I = (kind, cx, cy, ox, oy) => items.push({ kind, ...C(cx, cy, ox, oy) });
  const D = (model, cx, cy, ox = 0, oy = 0, o = {}) => decor.push({ model, ...C(cx, cy, ox, oy), r: 4, solid: true, rot: 0, hp: BREAK[model] || 0, ...o });
  FIX.forEach((f, i) => { const tall = MODEL_DEFS[f.model].H * VOX, shoot = !!f.hang && f.model !== 'a_hang'; decor.push({ model: f.model, x: f.x, y: f.y, r: f.hang ? 3 : 2, solid: !f.hang, rot: 0, lift: f.hang ? Math.max(f.hang - tall, Math.min(f.hang - 4, heightAt(f.x, f.y) + 19)) : 0, swing: f.flick ? tall : 0, top: f.hang, light: lights[i], chand: shoot, hp: shoot ? 14 : 0 }); });   // hanging lamps are out of reach but not out of range: a chandelier or a lantern can be shot down
  { const F = (a, b) => isFloor(tile(a, b));                                                              // an arch across the catacomb tunnels, every two cells
    for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (tile(cx, cy) === 'c') {
      if ((cy & 1) && !F(cx - 1, cy) && F(cx + 1, cy) && !F(cx + 2, cy) && F(cx, cy - 1) && F(cx, cy + 1) && F(cx + 1, cy - 1) && F(cx + 1, cy + 1)) decor.push({ model: 'a_arch', x: (cx + 1) * CS, y: cy * CS + 8, r: 0, solid: false, rot: 0 });
      if ((cx & 1) && !F(cx, cy - 1) && F(cx, cy + 1) && !F(cx, cy + 2) && F(cx - 1, cy) && F(cx + 1, cy) && F(cx - 1, cy + 1) && F(cx + 1, cy + 1)) decor.push({ model: 'a_arch', x: cx * CS + 8, y: (cy + 1) * CS, r: 0, solid: false, rot: Math.PI / 2 });
    } }
  if (LEVEL === 1) {
  // Metro
  E('automate', 10, 26); E('automate', 13, 27); I('bullets', 6, 27); I('baguette', 12, 27); D('a_crate', 14, 26, 2, -2);
  for (const cx of [3, 5, 11, 13]) for (const ox of [-5, 5]) D('a_bench', cx, 26, ox, -5, { r: 5 }); D('a_bin', 7, 26, 4, -5, { r: 2 }); D('a_bin', 9, 26, -4, -5, { r: 2 }); D('a_signal', 1, 27, -4, 6, { r: 1.5 }); D('a_signal', 14, 27, 4, 6, { r: 1.5 });
  E('automate', 6, 18); E('automate', 10, 19); I('baguette', 11, 17); D('a_bench', 8, 20, 12, 5, { r: 5 });
  I('shotgun', 2, 17); I('shells', 1, 20); I('shells', 3, 20); E('automate', 2, 19); D('a_crate', 1, 16); D('a_crate', 3, 16, 0, 0, { rot: .4 });
  // what people left behind: the station's furniture, the quarrymen's and the cellarman's clutter, the Baron's house and his workshop
  const Q = Math.PI / 2;
  D('a_kiosk', 2, 26, 0, -4, { r: 6 }); D('a_scale', 6, 26, 4, -4, { r: 2.5 }); D('a_suitcases', 10, 26, 0, -4, { r: 4 }); D('a_morris', 7, 27, -4, -2, { r: 4.5 }); D('a_trolley', 13, 26, -4, -4, { r: 5 }); D('a_suitcases', 1, 26, -4, 4, { r: 4, rot: .5 });
  D('a_trolley', 6, 20, 0, 4, { r: 5 }); D('a_suitcases', 10, 17, 4, -4, { r: 4 }); D('a_scale', 11, 19, 4, 0, { r: 2.5, rot: Q }); D('a_sacks', 5, 17, -4, -4, { r: 4 }); D('a_kiosk', 8, 17, 4, -4, { r: 6 });
  D('a_anvil', 1, 18, -4, 0, { r: 3, rot: Q }); D('a_sacks', 3, 19, 4, 4, { r: 4 }); D('a_barrow', 2, 20, 0, 4, { r: 4 });
  for (const [x, y, ox, oy] of [[2, 6, -4, 0], [2, 10, 4, 0], [4, 12, 0, 4], [9, 12, 0, -4], [11, 7, 4, 0], [11, 11, -4, 0], [8, 15, 4, 0], [3, 3, -4, 4], [6, 2, 4, -4], [6, 9, -4, 4], [7, 8, 4, -4], [10, 5, 4, 4], [5, 1, 0, -4], [2, 2, -4, -4]]) D('a_bones', x, y, ox, oy, { r: 3, rot: x * 1.7 + y, solid: false });
  D('a_barrow', 5, 10, -4, 4, { r: 4 }); D('a_barrow', 4, 3, 4, 4, { r: 4, rot: .6 }); D('a_sacks', 7, 10, 4, 4, { r: 4 });
  D('a_bottles', 17, 17, -4, 0, { r: 4 }); D('a_bottles', 23, 19, 4, 0, { r: 4, rot: Q }); D('a_bottles', 21, 15, 0, -4, { r: 4 }); D('a_sacks', 16, 18, -4, 4, { r: 4 }); D('a_sacks', 24, 16, 4, -4, { r: 4 }); D('a_barrow', 22, 22, 0, 4, { r: 4 }); D('a_sacks', 14, 18, 0, -4, { r: 4 }); D('a_bottles', 19, 20, 4, 4, { r: 4, rot: .4 });
  for (const [x, y, ox] of [[16, 7, -4], [24, 7, 4], [16, 11, -4], [24, 11, 4]]) D('a_armour', x, y, ox, 0, { r: 3.5, rot: Q });
  for (const [x, y, ox, oy] of [[16, 6, -4, -4], [24, 6, 4, -4], [16, 12, -4, 4], [24, 12, 4, 4], [19, 4, 4, 4], [21, 1, -4, -4]]) D('a_palm', x, y, ox, oy, { r: 2.5 });
  D('a_armchair', 17, 10, -4, 4, { r: 5, rot: .5 }); D('a_armchair', 23, 10, 4, 4, { r: 5, rot: -.5 }); D('a_globe', 16, 9, -4, 0, { r: 3 }); D('a_clock', 24, 9, 4, 0, { r: 3, rot: Q });
  D('a_armchair', 16, 3, -4, 0, { r: 5, rot: Q }); D('a_armchair', 19, 1, 4, -4, { r: 5 }); D('a_globe', 17, 4, 0, 4, { r: 3 }); D('a_clock', 16, 1, -4, -4, { r: 3, rot: Q });
  D('a_armchair', 22, 2, -4, -2, { r: 5, rot: .3 }); D('a_armchair', 23, 3, 4, 5, { r: 5, rot: -2.4 }); D('a_armour', 24, 2, 4, 0, { r: 3.5, rot: Q }); D('a_clock', 21, 4, -4, 4, { r: 3 }); D('a_globe', 24, 4, 4, 4, { r: 3 });
  for (const [x, y, ox, oy] of [[27, 10, 0, -4], [29, 8, 0, 4], [32, 10, 0, -4], [31, 13, -4, 0], [29, 13, 4, 0], [27, 8, 0, 4]]) D('a_urn', x, y, ox, oy, { r: 3 });
  for (const [x, y, ox, oy] of [[26, 6, -4, 0], [33, 8, 4, 0], [29, 12, -4, 0], [33, 13, 4, 4], [30, 5, 0, -4]]) D('a_statue', x, y, ox, oy, { r: 3.5 });
  D('a_repair', 28, 16, 0, -4, { r: 4 }); D('a_repair', 32, 16, 0, -4, { r: 4 }); D('a_repair', 29, 24, 4, 4, { r: 4 }); D('a_anvil', 27, 20, -4, 0, { r: 3, rot: Q }); D('a_anvil', 32, 21, 4, 0, { r: 3 }); D('a_sacks', 26, 16, -4, -4, { r: 4 }); D('a_barrow', 33, 24, 4, 4, { r: 4 });
  for (const [x, y, ox, oy] of [[6, 17, 2, 2], [10, 20, -2, 2], [4, 2, 2, 2], [6, 9, 2, -2], [11, 9, 0, 2], [13, 27, 2, 2], [17, 8, 2, 2], [23, 8, -2, 2], [27, 6, 2, 2], [32, 12, -2, -2], [28, 9, 2, 2]]) D('a_drum', x, y, ox, oy, { drum: true, hp: 12 });   // more of the Baron's fuel, left where it will do the most good
  // underfoot and overhead
  { let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const F = (n, cx, cy, ox = 0, oy = 0, rot) => decor.push({ model: 'f_' + n, ...C(cx, cy, ox, oy), r: 0, solid: false, rot: rot == null ? rnd() * 6.28 : rot, lift: 0, flat: true });
    const H = (n, cx, cy, ox = 0, oy = 0, rot = 0) => { const p = C(cx, cy, ox, oy), top = Math.min(WH, ceilingAt(p.x, p.y)); decor.push({ model: 'a_' + n, ...p, r: 0, solid: false, rot, lift: top - MODEL_DEFS['a_' + n].H * VOX, top }); };
    for (const [x, y, ox, oy] of [[3, 26, 2, 1], [6, 27, -2, 1], [9, 26, 1, -1], [12, 27, 2, 0], [13, 26, -1, 2], [1, 27, 1, 0], [7, 18, 2, -2], [10, 19, -1, 1], [8, 23, 1, 0], [5, 20, 2, 2]]) F('paper', x, y, ox, oy);
    for (const [x, y] of [[4, 27], [8, 27], [12, 26], [8, 19], [2, 19]]) F('drain', x, y, 0, 2, 0); F('manhole', 8, 18, -2, 0, 0); F('manhole', 10, 27, 0, 0, 0);
    F('oil', 2, 17, 1, 2); F('cable', 1, 19, 1, 0); F('straw', 3, 18, 1, -1); F('oil', 3, 20, -1, 0);
    for (const [x, y, ox, oy] of [[2, 7, 1, 0], [2, 11, -1, 2], [5, 12, 0, 1], [9, 12, 1, -1], [11, 8, -1, 0], [11, 10, 1, 2], [8, 14, 0, 0], [4, 3, 2, -1], [6, 1, -2, 1], [3, 2, 0, 2], [6, 8, 1, 1], [7, 9, -2, -1], [10, 4, 0, 1], [13, 8, 0, 2]]) F('boneheap', x, y, ox, oy);
    for (const [x, y] of [[5, 3], [7, 7], [5, 9], [2, 4]]) F('straw', x, y, 1, 1); F('spill', 6, 4, 0, 0); F('spill', 8, 12, 1, 0);
    for (const [x, y, ox, oy] of [[18, 15, 0, 2], [22, 21, 1, 0], [20, 19, -2, 1], [14, 18, 0, 1], [17, 22, 1, -1]]) F('spill', x, y, ox, oy); for (const [x, y] of [[16, 16], [24, 20], [19, 22], [21, 14], [23, 17], [17, 19]]) F('straw', x, y, 1, 0); F('drain', 20, 17, 0, 0, 0); F('drain', 20, 20, 0, 0, 0); F('paper', 16, 21, 1, 1);
    F('rug2', 17, 9, 0, 0, 0); F('rug2', 23, 9, 0, 0, 0); F('rug', 17, 2, 2, 2, 0); F('rug', 23, 2, -2, 2, 0); F('rug2', 22, 3, 2, 2, 0); F('rug2', 18, 3, 2, 2, 0);
    for (const [x, y, ox, oy] of [[17, 3, 1, -1], [19, 2, -1, 1], [22, 1, 1, 1], [20, 11, 2, 2], [18, 8, -1, 1]]) F('plans', x, y, ox, oy); F('paper', 21, 3, 0, 1); F('paper', 22, 10, 1, 0);
    for (const [x, y, ox, oy] of [[26, 5, 1, 1], [27, 7, -1, 2], [29, 6, 2, 0], [31, 8, 0, 1], [33, 7, -2, 1], [27, 11, 1, -1], [29, 10, -2, 2], [32, 13, 1, 0], [33, 10, 0, 2], [28, 13, 2, 1], [30, 12, -2, 0], [31, 5, 1, 2], [26, 13, 1, 1], [30, 9, 2, -1]]) F('leaves', x, y, ox, oy);
    F('manhole', 28, 9, 0, 0, 0); F('drain', 32, 9, 0, 0, 0);
    for (const [x, y, ox, oy] of [[27, 17, 1, 1], [32, 20, -1, 0], [29, 23, 0, 1], [30, 18, 2, -1], [26, 21, 1, 2], [33, 23, -1, -1]]) F('oil', x, y, ox, oy);
    for (const [x, y, ox, oy] of [[28, 17, 2, 2], [32, 17, -2, 2], [27, 23, 1, -1], [31, 20, 0, 2], [29, 19, -1, -1]]) F('plans', x, y, ox, oy);
    for (const [x, y, ox, oy] of [[26, 19, 1, 0], [33, 21, -1, 1], [30, 22, 2, 0], [28, 20, 0, -2], [32, 24, 0, -1]]) F('cable', x, y, ox, oy); F('drain', 29, 20, 0, 0, 0); F('drain', 30, 23, 0, 0, 0);
    H('hsign', 4, 26, 0, 2, Q); H('hsign', 11, 26, 0, 2, Q); H('hclock', 8, 27, 0, -2, Q); H('hclock', 8, 18, 2, 2, 0); H('hsign', 8, 22, 0, 0, 0);
    const run = (n, a, b) => { const L = Math.hypot(b.x - a.x, b.y - a.y), k = Math.max(1, Math.round(L / (MODEL_DEFS['a_' + n].W * VOX))), rot = Math.atan2(b.y - a.y, b.x - a.x); for (let i = 0; i < k; i++) { const x = a.x + (b.x - a.x) * (i + .5) / k, y = a.y + (b.y - a.y) * (i + .5) / k, top = Math.min(WH, ceilingAt(x, y)); decor.push({ model: 'a_' + n, x, y, r: 0, solid: false, rot, lift: top - MODEL_DEFS['a_' + n].H * VOX, top }); } };   // pipework: lengths laid end to end
    run('pipes', C(8, 21, -3, 0), C(8, 24, -3, 0)); run('pipes', C(2, 16, 3, 0), C(2, 20, 3, 0)); run('pipes', C(5, 17, 0, -3), C(11, 17, 0, -3));
    for (const [x, y, ox, oy] of [[2, 7, -3, 0], [2, 10, 3, 0], [4, 12, 0, 3], [7, 12, 0, -3], [10, 12, 0, 3], [11, 7, 3, 0], [11, 10, -3, 0], [8, 15, -3, 0], [8, 13, 3, 0], [3, 1, 0, -3], [6, 4, 0, 3], [6, 7, 0, -3], [9, 9, 0, 3], [13, 9, 3, 0]]) H('roots', x, y, ox, oy, x * 2.1 + y);
    for (const cx of [17, 19, 21, 23]) { H('hams', cx, 14, 0, -3, 0); H('hams', cx, 22, 0, 3, 0); }
    for (const [x, y] of [[17, 9], [23, 9], [17, 11], [23, 11], [19, 12], [21, 12]]) H('banner', x, y, 3, 0, 0); H('fan', 17, 2, 2, 2); H('fan', 18, 3, 2, 2); H('fan', 22, 2, 2, 2); H('fan', 23, 3, 2, 2);
    H('hoist', 27, 19, 2, 2); H('hoist', 32, 19, -2, 2); H('hoist', 29, 23, 2, 0); for (const [x, y, rot] of [[28, 17, 0], [32, 17, 0], [27, 22, Q], [32, 23, Q]]) H('parts', x, y, 2, 2, rot);
    run('pipes', C(26, 16, 0, -3), C(29, 16, 0, -3)); run('pipes', C(31, 16, 0, -3), C(33, 16, 0, -3)); run('pipes', C(26, 24, 0, 3), C(33, 24, 0, 3)); run('pipes', C(26, 17, -3, 0), C(26, 23, -3, 0)); run('pipes', C(33, 17, 3, 0), C(33, 23, 3, 0));
  }
  // catacombs
  E('automate', 8, 13); E('lanterne', 5, 12); E('automate', 2, 9); E('lanterne', 2, 6); E('automate', 4, 2); E('automate', 6, 3); E('lanterne', 6, 8); E('automate', 11, 8);
  I('helmet', 18, 26); I('grenades', 17, 27); I('shells', 18, 27); I('wine', 13, 7); I('shells', 13, 9); I('bullets', 13, 8); I('cells', 14, 21, -4, -3); I('wine', 14, 22, -4, 3); I('grenades', 14, 22, 2, 2); I('helmet', 14, 21, 4, -3);   // what the hidden rooms hold
  I('key_blue', 3, 1); I('baguette', 7, 1); I('shells', 5, 9); I('bullets', 8, 10); I('helmet', 10, 4); I('wine', 11, 5);
  // wine cellar
  E('scaphandre', 20, 18); E('automate', 17, 15); E('automate', 23, 21); E('automate', 23, 15); E('lanterne', 20, 21);
  for (const [x, y] of [[16, 14], [24, 14], [16, 22], [24, 22]]) D('a_rack', x, y, 0, y < 18 ? -3 : 3, { r: 7 }); for (const [x, y, oy] of [[19, 14, -4], [21, 14, -4], [19, 22, 4], [21, 22, 4]]) for (const ox of [-4, 4]) D('a_cask', x, y, ox, oy, { r: 6 });
  D('a_crate', 24, 18, 5, -5); D('a_crate', 24, 18, 5, 5, { rot: .3 }); D('a_crate', 2, 4, -5, 5); D('a_crate', 7, 1, 5, -5, { rot: .5 }); D('a_crate', 5, 7, -5, -5); D('a_cask', 8, 10, 4, 4, { r: 6 });
  D('a_workbench', 27, 24, 0, 3, { r: 5 }); D('a_workbench', 32, 24, 0, 3, { r: 5 }); D('a_crate', 26, 22, -5, 0); D('a_crate', 33, 22, 5, 0, { rot: .4 }); D('a_workbench', 2, 16, 0, -4, { r: 5 });
  for (const [x, y] of [[20, 16], [17, 19], [23, 18], [21, 20]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  I('bullets', 16, 18); I('baguette', 24, 18); I('shells', 20, 22);
  // chateau
  E('automate', 17, 8); E('automate', 23, 8); E('automate', 20, 7); E('lanterne', 18, 11); E('lanterne', 22, 11); E('scaphandre', 20, 10);
  for (const [x, y] of [[18, 7], [22, 7], [18, 9], [22, 9], [18, 11], [22, 11]]) for (const oy of [-4, 4]) D('a_column', x, y, 0, oy);
  D('a_table', 17, 2, 0, 0, { r: 6 }); I('smg', 18, 1); I('bullets', 16, 4); I('bullets', 19, 3); E('automate', 18, 3);
  D('a_table', 22, 2, 0, 0, { r: 6 }); I('key_red', 24, 1); E('scaphandre', 23, 3); I('wine', 21, 4); I('helmet', 24, 4);
  // courtyard
  E('lanterne', 27, 5); E('lanterne', 32, 8); E('lanterne', 29, 13); E('lanterne', 33, 13); E('automate', 30, 6); E('automate', 27, 10); E('automate', 33, 10);
  D('fountain', 30, 9, 0, 0, { r: 9 }); I('tesla', 33, 4); I('cells', 32, 4); I('cells', 26, 14); I('wine', 26, 4); I('shells', 33, 14);
  // workshop and exit
  E('colosse', 30, 20); E('scaphandre', 27, 23); E('scaphandre', 33, 23); E('automate', 26, 17); E('automate', 33, 17);
  for (const [x, y] of [[26, 20], [33, 20], [29, 24], [31, 24]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  I('cells', 26, 16); I('cells', 33, 16); I('wine', 30, 17); I('baguette', 26, 24); I('baguette', 33, 24); I('bullets', 29, 16);
  decor.push({ model: 'a_exit', ...C(30, 25, 0, 3), r: 5, solid: true, rot: Math.PI, exit: true });
  I('grenades', 9, 18); I('grenades', 22, 7); I('grenades', 29, 10); I('shells', 18, 6); I('bullets', 22, 6); I('baguette', 16, 15);
  } else {
  // the first roof
  E('automate', 7, 24); E('automate', 6, 27); E('lanterne', 8, 23); I('bullets', 4, 23); I('grenades', 8, 28); D('a_crate', 3, 28); D('a_crate', 9, 22, 0, 0, { rot: .4 }); D('a_drum', 7, 26, 0, 0, { drum: true, hp: 12 });
  // the second
  E('sauteur', 17, 22); E('automate', 19, 27); E('automate', 15, 27); E('lanterne', 18, 24); I('shells', 14, 21); I('baguette', 20, 28); I('bullets', 19, 21); D('a_crate', 14, 28); D('a_cask', 20, 20, 0, 0, { r: 6 }); D('a_drum', 17, 25, 0, 0, { drum: true, hp: 12 }); D('a_bench', 15, 20, 0, -5, { r: 5 });
  // the third
  E('garde', 27, 22); E('automate', 30, 19); E('automate', 23, 27); E('lanterne', 29, 26); E('sauteur', 30, 23); I('cells', 31, 18); I('wine', 22, 19); I('bullets', 31, 27); I('grenades', 26, 27); I('helmet', 29, 20);
  D('a_crate', 23, 20); D('a_crate', 31, 22, 0, 0, { rot: .3 }); D('a_drum', 25, 23, 0, 0, { drum: true, hp: 12 }); D('a_drum', 29, 23, 0, 0, { drum: true, hp: 12 });
  // the top roof and the mooring house
  E('scaphandre', 20, 8); E('automate', 15, 5); E('automate', 26, 5); E('lanterne', 18, 12); E('lanterne', 23, 12); I('shells', 14, 13); I('bullets', 27, 13); I('baguette', 14, 4); I('wine', 27, 4); I('cells', 22, 5); I('grenades', 18, 5);
  D('a_crate', 15, 12); D('a_crate', 26, 12, 0, 0, { rot: .5 }); for (const [x, y] of [[18, 9], [22, 9]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  decor.push({ model: 'a_exit', ...C(20, 1, 0, -3), r: 5, solid: true, rot: 0, exit: true });
  }
  P = { ...(LEVEL === 1 ? C(2, 26) : C(3, 26)), yaw: 0, pitch: 0, punch: 0, speed: 0, sprint: 0, dipT: 0, hits: [], hitT: 0, hitKill: false, vx: 0, vy: 0, hp: 100, armour: 0, ammo: { bullets: 50, shells: 0, cells: 0 }, has: [true, false, false, false], weapon: 0, cool: 0, kick: 0, shake: 0, flash: 0, bob: 0, keys: {}, pain: 0, dead: false, grin: 0,
    mag: MAG.slice(), reload: 0, grenades: 2, bootT: 0, nadeT: 0, lunge: 0, picked: null, escape: 0 };
  if (LEVEL === 2) { let c = null; try { c = JSON.parse(sessionStorage.getItem('automates_carry')); } catch (e) { /* none */ } Object.assign(P, c || { has: [true, true, true, true], ammo: { bullets: 120, shells: 24, cells: 60 }, grenades: 3 }); }   // what you carried out of the chateau, or a full kit if you came straight here
  for (const o of [...enemies, ...items, ...decor]) o.z = o.lift ? 0 : heightAt(o.x, o.y);
  P.z = heightAt(P.x, P.y);
  stats = { kills: 0, total: enemies.length, time: 0, secrets: 0, secretsTotal: doors.filter(d => d.key === 'secret').length };
  flow = null; flowT = 0;
}

// ---------- sound: tiny synthesised effects ----------
let audio = null, snd = null, muted = false;
// Play an effect. With a place (anything with x and y), it is panned to that side, fades with distance and is muffled behind a wall.
function sfx(kind, at) {
  if (!snd || muted) return;
  if (!at) return snd.play(kind);
  const dx = at.x - P.x, dy = at.y - P.y, d = Math.hypot(dx, dy);
  if (d > 420) return;
  snd.play(kind, { vol: 1 / (1 + (d / 70) ** 2), pan: Math.sin(Math.atan2(dy, dx) - P.yaw) * Math.min(1, d / 30) * .85, muffle: Math.min(.85, d / 500 + (canSee(P.x, P.y, at.x, at.y) ? 0 : .5)) });
}
const GRADE = { metro: [1, 1.01, 1.04, 1.08], catacombs: [1.06, .98, .88, 1.14], cellar: [1.08, .97, .88, 1.1], chateau: [1.05, 1, .92, 1.04], courtyard: [.96, .98, 1.1, 1.08], workshop: [.94, 1, 1.08, 1.12] }, grade = [1, 1, 1, 1];
const ROOM_OF = { z: 'courtyard', m: 'metro', r: 'metro', c: 'catacombs', b: 'cellar', w: 'chateau', k: 'chateau', g: 'courtyard', o: 'courtyard', i: 'workshop' };
const STEP_ON = { z: 'metal', m: 'tile', r: 'stone', c: 'earth', b: 'stone', w: 'wood', k: 'carpet', g: 'grass', o: 'stone', i: 'metal' };

// ---------- helpers ----------
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function rayWall(x, y, a, max) {                                    // distance to the first wall or closed door
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let t = 0; t < max; t += 2) if (solidAtPt(x + dx * t, y + dy * t)) return t;
  return max;
}
function canSee(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay); return rayWall(ax, ay, Math.atan2(by - ay, bx - ax), d) >= d - 2; }
function moveBody(b, dx, dy, r, others) {
  const h0 = heightAt(b.x, b.y), blocked = (x, y) => boxHits(x, y, r) || (!b.fly && (inPit(x - r, y - r) || inPit(x + r, y - r) || inPit(x - r, y + r) || inPit(x + r, y + r) || Math.abs(heightAt(x, y) - h0) > 2.2)) ||   // a step is climbed; anything taller is a wall, and a drop is an edge
    decor.some(d => d.solid && !d.gone && Math.hypot(d.x - x, d.y - y) < d.r + r) || (others && others.some(o => o !== b && !o.dead && Math.hypot(o.x - x, o.y - y) < o.r + r && Math.hypot(o.x - x, o.y - y) < Math.hypot(o.x - b.x, o.y - b.y)));   // another body only blocks a step towards it: you can always back out of one that is on top of you
  let moved = false;
  if (dx && !blocked(b.x + dx, b.y)) { b.x += dx; moved = true; }
  if (dy && !blocked(b.x, b.y + dy)) { b.y += dy; moved = true; }
  return moved;
}
function computeFlow() {                                            // steps to the player from every cell, through doors enemies can use
  const f = new Int16Array(GW * GH).fill(999), px = Math.floor(P.x / CS), py = Math.floor(P.y / CS), q = [[px, py]]; f[px + py * GW] = 0;
  while (q.length) { const [x, y] = q.shift(), d = f[x + y * GW]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b, t = tile(nx, ny); if (!isFloor(t) || t === 'r' || t === '.' || (t === 'D' && (!doorAt(nx, ny).unlocked || doorAt(nx, ny).sealed)) || Math.abs(CELLH[nx + ny * GW] - CELLH[x + y * GW]) > 3.3 || f[nx + ny * GW] <= d + 1) continue; f[nx + ny * GW] = d + 1; q.push([nx, ny]); } }
  return f;
}
// Particles: `g` is gravity, `bounce` lets one skip off the floor, `stay` leaves it lying where it lands.
const rand = (a, b) => a + Math.random() * (b - a);
const spawn = (model, x, y, lift, o) => fx.push({ model, x, y, lift, vx: 0, vy: 0, vz: 0, t: 0, life: .5, a: Math.random() * 6.28, spin: 0, g: 0, ...o });
const litter = (model, x, y, lift = .06) => { debris.push({ model, x, y, lift: lift + heightAt(x, y), rot: Math.random() * 6.28 }); if (debris.length > 130) debris.shift(); };
function burst(x, y, lift, n, model) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(20, 70); spawn(model, x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(20, 60), g: 160, life: rand(.35, .65) }); } }
function sparks(x, y, lift, n, dir, spread = 2.6) {                             // a shower of sparks, thrown mostly along `dir`
  for (let i = 0; i < n; i++) { const a = dir == null ? Math.random() * 6.28 : dir + rand(-spread, spread) / 2, s = rand(25, 120); spawn(Math.random() < .65 ? 'a_sparkle' : 'a_ember', x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(-10, 80), g: 240, bounce: true, life: rand(.25, .7) }); }
}
function oil(x, y, lift, n, dir) { for (let i = 0; i < n; i++) { const a = dir + rand(-.7, .7), s = rand(20, 75); spawn('a_oil', x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(10, 60), g: 220, life: rand(.4, .8) }); } }
function smoke(x, y, lift, n) { for (let i = 0; i < n; i++) spawn(Math.random() < .5 ? 'a_puff1' : 'a_puff2', x + rand(-3, 3), y + rand(-3, 3), lift + rand(0, 4), { vx: rand(-5, 5), vy: rand(-5, 5), vz: rand(8, 22), life: rand(.6, 1.4), spin: rand(-2, 2) }); }
function wreck(e, fx0, fy0) {                                                   // the machine comes apart: its parts fall, tip over and stay where they land
  const away = Math.atan2(e.y - fy0, e.x - fx0), rx = Math.sin(e.yaw), ry = -Math.cos(e.yaw), rig = RIG[e.type];
  const fling = (name, x, y, lift, o) => { const a = away + rand(-1.3, 1.3), s = rand(20, 95); spawn(name, x, y, lift + e.z, { a: e.yaw - Math.PI / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(25, 95), g: 210, bounce: true, spin: rand(-9, 9), life: rand(1.4, 2.6), stay: true, ...o }); };
  if (rig) { fling(e.type + '_torso_d2', e.x, e.y, 0, { base: rig.hip, tip: 1 }); if (rig.neck < rig.H * VOX) fling(e.type + '_head', e.x, e.y, 0, { base: rig.neck, tip: -1 });
    for (const [i, sd] of [[0, 'l'], [1, 'r']]) { fling(`${e.type}_${sd}t`, e.x, e.y, 0, { base: rig.knee, tip: 1 }); fling(`${e.type}_${sd}s`, e.x, e.y, 0, { base: 0, tip: -1 }); if (e.arm[i]) { fling(`${e.type}_${sd}u`, e.x, e.y, 0, { base: rig.elbow, tip: 1 }); fling(`${e.type}_${sd}f`, e.x, e.y, 0, { base: rig.lo, tip: -1 }); } }
    burst(e.x, e.y, e.z + rig.hip, 8, 'a_bit'); }
  else for (const g of GIBS[e.type]) fling(g.name, e.x + rx * g.dx, e.y + ry * g.dx, (e.fly || 0) + g.dz);
  sparks(e.x, e.y, e.z + 8 + (e.fly || 0), e.boss ? 60 : 26); oil(e.x, e.y, e.z + 9 + (e.fly || 0), e.boss ? 30 : 12, away); smoke(e.x, e.y, e.z + 4, e.boss ? 12 : 5);
  if (!inPit(e.x, e.y)) litter('a_pool', e.x, e.y);
}
function hurtPlayer(d, from) {                                                  // `from`: where it came from, for the marker round the crosshair
  if (P.dead) return;
  if (from) { P.hits.push({ a: Math.atan2(from.y - P.y, from.x - P.x), t: 1 }); if (P.hits.length > 4) P.hits.shift(); }
  const soak = Math.min(P.armour, d * 0.5); P.armour -= soak; P.hp -= d - soak; P.pain = Math.min(.6, P.pain + d * 0.03); P.shake = Math.max(P.shake, .5); sfx('hurt');
  if (P.hp <= 0) { P.hp = 0; P.dead = true; state = 'dead'; showScreen(); }
}
function explode(x, y, fuel) {                                                    // `fuel`: a drum, which also leaves its oil burning where it stood
  const gz = heightAt(x, y), pd = Math.hypot(P.x - x, P.y - y); sfx('boom', { x, y }); if (fuel) setTimeout(() => sfx('smash', { x, y }), 90); burst(x, y, gz + 6, 14, 'a_smoke');
  for (const p of panels) if (p.far && Math.hypot(p.x - x, p.y - y) < 36) for (let i = 0; i < 3; i++) chip(p, rand(10, 118), rand(4, 90), rand(5, 10));   // the blast tears at the walls around it
  flashAt(x, y, gz + 10, 200, 3.2, [1, .8, .5], .16); flashAt(x, y, gz + 8, 150, 1.6, AMBER, .8); sparks(x, y, gz + 5, 44); smoke(x, y, gz + 3, 14); litter('a_scorch', x, y, .05);
  const big = fuel ? 1.5 : 1;
  for (let i = 0; i < 26 * big; i++) { const a = Math.random() * 6.28, v = rand(15, 95) * big, hot = Math.random();   // the fireball: a white-hot heart, orange round it, rolling up and out
    spawn('chip', x, y, gz + rand(2, 9), { k: [rand(1.2, 2.6) * big, 1, .45 + hot * .5, .1 + hot * .5, 1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(25, 120), g: 90, life: rand(.25, .6) }); }
  for (let i = 0; i < 36; i++) { const a = i / 36 * 6.28 + rand(-.05, .05), v = 190 * big; spawn('chip', x, y, gz + 1, { k: [1.4, 1, .85, .6, 1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: 4, g: 0, life: .2 }); }   // the shock running out across the floor
  for (let i = 0; i < 18 * big; i++) { const a = Math.random() * 6.28, v = rand(40, 150); spawn('chip', x, y, gz + rand(4, 10), { k: [rand(.5, 1), 1, rand(.4, .7), .1, 1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(60, 170), g: 230, bounce: true, life: rand(1, 2.2) }); }   // embers thrown high, which bounce and die
  if (fuel) { for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, v = rand(50, 140); spawn('chip', x, y, gz + rand(4, 10), { k: [rand(.9, 1.8), rand(.45, .7), .08, .08, 0], vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(50, 150), g: 230, bounce: true, life: rand(1.2, 2.4) }); }   // what is left of the drum
    fires.push({ x, y, z: gz, t: 4.5, tick: 0 }); if (fires.length > 6) fires.shift(); }
  setTimeout(() => { if (state === 'play') smoke(x, y, gz + 10, 10); }, 180);                              // and the smoke that follows the fire up
  P.shake = Math.max(P.shake, 3 * big * Math.max(0, 1 - pd / 200)); if (pd < 150) freeze = Math.max(freeze, .06);
  if (pd < 90 && pd > 1) { const k = 240 * (1 - pd / 90); P.vx += (P.x - x) / pd * k; P.vy += (P.y - y) / pd * k; P.punch += .05 * (1 - pd / 90); }   // the blast shoves you
  const R0 = 46 * (fuel ? 1.25 : 1);
  for (const e of enemies) if (!e.dead) { const d = Math.hypot(e.x - x, e.y - y); if (d < R0) { hurtEnemy(e, 100 * (1 - d / (R0 + 6)), x, y); if (!e.dead) { const m = e.boss ? .1 : 1; e.kx += (e.x - x) / (d || 1) * 160 * m; e.ky += (e.y - y) / (d || 1) * 160 * m; } else if (!e.boss && Math.random() < .6) items.push({ kind: Math.random() < .5 && P.has[1] ? 'shells' : 'bullets', x: e.x, y: e.y, z: e.z, small: true }); } }   // a machine blown apart scatters its ammunition
  for (const d of decor) if (!d.gone && d.hp > 0 && Math.hypot(d.x - x, d.y - y) < R0) { if (d.drum) { d.hp = 0; if (d.fuse == null) d.fuse = .18; } else if (!d.chand || Math.hypot(d.x - x, d.y - y) < 22) hitDecor(d, 60); }
  if (pd < R0) hurtPlayer(55 * (1 - pd / (R0 + 4)), { x, y });
}
function burn(dt) {                                                               // burning oil: flames, a flickering light, and harm to whatever stands in it
  for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; if ((f.t -= dt) <= 0) { fires.splice(i, 1); continue; } const k = Math.min(1, f.t / 1.2);
    for (let n = 0; n < 2; n++) if (Math.random() < k) { const a = Math.random() * 6.28, d = Math.random() * 11; spawn('chip', f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, f.z + .5, { k: [rand(.9, 2) * k, 1, rand(.45, .8), .12, 1], vx: rand(-4, 4), vy: rand(-4, 4), vz: rand(14, 34), g: -26, life: rand(.3, .6) }); }
    if ((f.tick -= dt) <= 0) { f.tick = .25; flashAt(f.x, f.y, f.z + 6, 90, 1.1 * k, AMBER, .3); if (Math.random() < .5) smoke(f.x, f.y, f.z + 8, 1);
      for (const e of enemies) if (!e.dead && !e.fly && Math.hypot(e.x - f.x, e.y - f.y) < 13 + e.r) hurtEnemy(e, 5, f.x, f.y);
      if (!P.dead && Math.hypot(P.x - f.x, P.y - f.y) < 13 && Math.abs(P.z - f.z) < 8) hurtPlayer(3, { x: f.x, y: f.y }); } }
}
function hurtEnemy(e, dmg, fx0, fy0, hit) {                                    // `hit`: how high the shot struck and how far to the machine's left or right of its middle
  if (e.dead) return;
  const rig = RIG[e.type], back = Math.atan2(fy0 - e.y, fx0 - e.x);
  if (hit && e.shield && e.stun <= 0 && !hit.pierce && Math.abs(wrap(back - e.yaw)) < 1.05) {                // the guard's shield turns it: get behind it, stagger it, or burn through
    sparks(e.x + Math.cos(back) * (e.r + 1), e.y + Math.sin(back) * (e.r + 1), Math.max(e.z + 2, hit.z), 5, back, 2.4); sfx('hit', e); e.awake = true; e.kx -= Math.cos(back) * 6; e.ky -= Math.sin(back) * 6; return;
  }
  if (e.dazed > 0) dmg *= 1.6;
  let side = Math.random() < .5 ? 0 : 1, zone = 'torso';
  if (hit && rig) { side = hit.lx < 0 ? 0 : 1; zone = hit.z - e.z > rig.neck && rig.neck < rig.H * VOX ? 'head' : hit.z - e.z < rig.hip ? 'leg' : Math.abs(hit.lx) > Math.abs(rig.ax[side]) - .4 ? 'arm' : 'torso'; }
  if (zone === 'head') dmg *= 1.6;                                                                        // a shot to the head tells
  const hx = e.x + Math.cos(back) * e.r * .7, hy = e.y + Math.sin(back) * e.r * .7, hz = hit ? Math.max(e.z + 1, hit.z) : e.z + rand(5, 13) + (e.fly ? e.fly - 4 : 0);   // where the shot struck, on the side facing the gun
  e.hp -= dmg; e.flash = .1; e.awake = true; sparks(hx, hy, hz, 5 + (dmg > 20 ? 5 : 0), back, 1.8); oil(hx, hy, hz, 2, back); burst(hx, hy, hz, 1, 'a_bit');
  if (hit) { P.hitT = .16; P.hitKill = e.hp <= 0; }
  // it staggers: knocked back, rocked on its hips, twisted away from the side that was struck
  const mass = e.boss ? .12 : e.type === 'scaphandre' ? .45 : 1, push = Math.min(70, dmg * 3.4) * mass;
  e.kx -= Math.cos(back) * push; e.ky -= Math.sin(back) * push; e.stun = Math.max(e.stun, Math.min(.42, .07 + dmg * .012) * mass);
  e.twist = (side ? 1 : -1) * Math.min(.7, dmg * .035) * (zone === 'arm' ? 1.5 : zone === 'torso' ? 1 : .4) * (e.boss ? .3 : 1); if (zone === 'head') e.nod = 1; if (zone === 'leg') e.limp = .7;
  if (e.wind > 0 && dmg > 11 && !e.boss) { e.wind = 0; e.cool = Math.max(e.cool, .45); }                  // a solid hit spoils its shot
  if (e.hp > 0) {
    const left = e.arm[0] + e.arm[1]; let lose = -1;
    if (rig) {                                                                                             // an arm is shot away: the one that was hit, or the one on the side that was hit once the machine is battered enough
      if (zone === 'arm' && e.arm[side] && (e.armHp[side] -= dmg) <= 0 && !(e.boss && left === 1)) lose = side;
      else if ((left === 2 && e.hp < e.hp0 * .5) || (left === 1 && e.hp < e.hp0 * .22 && !e.boss)) lose = e.arm[side] ? side : 1 - side;
    }
    if (lose >= 0) {
      const i = lose, a = back + Math.PI + rand(-.9, .9), v = rand(30, 70); e.arm[i] = 0;
      for (const [k, base] of [['u', rig.elbow], ['f', rig.lo]]) spawn(`${e.type}_${i ? 'r' : 'l'}${k}`, e.x, e.y, e.z, { a: e.yaw - Math.PI / 2, vx: Math.cos(a) * v * rand(.7, 1.2), vy: Math.sin(a) * v * rand(.7, 1.2), vz: rand(30, 70), g: 210, bounce: true, spin: rand(-6, 6), life: rand(1.2, 2), stay: true, base, tip: 1 });
      sparks(hx, hy, e.z + rig.sh, 16); oil(hx, hy, e.z + rig.sh, 8, back); sfx('die', e);
      if (e.shield && i === 1) { e.shield = false; spawn('a_shield', e.x, e.y, e.z + rig.knee, { a: e.yaw - Math.PI / 2, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, vz: 30, g: 210, bounce: true, spin: 3, life: 1.6, stay: true, base: 0, tip: 1 }); }   // and the shield with the arm that held it
      if (!rig.gun.length) { /* it never had a gun */ } else if (!rig.gun.some(k => e.arm[k])) { e.range = 0; e.speed *= 1.25; e.wind = 0; } else e.fleeT = 2.4;   // disarmed, it charges; with a gun left, it falls back first
    }
    sfx('hit', e); return;
  }
  const over = -e.hp > e.hp0 * .5 && !e.boss;                                                               // hit far harder than it needed: it does not fall over, it flies apart
  e.dead = true; stats.kills++; sfx('die', e); if (RIG[e.type] && !e.boss && !over && Math.random() < .45) { e.dying = .001; e.killer = [fx0, fy0]; } else wreck(e, fx0, fy0);
  if (over) { burst(e.x, e.y, e.z + 9, 12, 'a_bit'); sparks(e.x, e.y, e.z + 9, 30); oil(e.x, e.y, e.z + 9, 12, back + Math.PI); smoke(e.x, e.y, e.z + 5, 4); P.shake = Math.max(P.shake, .7); freeze = Math.max(freeze, .07); }
  P.shake = Math.max(P.shake, e.boss ? 2 : .35);
  freeze = Math.max(freeze, e.boss ? .16 : .05);                                                          // the game holds still for an instant on a kill
  const a = Math.atan2(e.y - fy0, e.x - fx0); e.fall = { dx: Math.cos(a), dy: Math.sin(a), a: 0, t: 0 };
  if (e.type === 'automate' && Math.random() < .45) items.push({ kind: 'bullets', x: e.x, y: e.y, z: e.z, small: true });
  if (e.boss) { say('Le Colosse is scrap. Find the lever!'); for (let i = 0; i < 4; i++) setTimeout(() => explode(e.x + (Math.random() - .5) * 20, e.y + (Math.random() - .5) * 20), i * 220); }
}
const chips = (x, y, z, n, col, dir) => { for (let i = 0; i < n; i++) { const a = dir == null ? Math.random() * 6.28 : dir + rand(-1.2, 1.2), v = rand(15, 70); spawn('chip', x, y, z, { k: [rand(.35, .8), col[0], col[1], col[2], col[3] || 0], vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(0, 55), g: 220, bounce: true, life: rand(.7, 1.5) }); } };
function hitDecor(d, dmg, dir) {                                               // a shot, a boot or a blast lands on something that can break
  d.hp -= dmg; const mid = d.chand ? d.lift + 2 : d.z + MODEL_DEFS[d.model].H * VOX * .5;
  if (d.drum) { if (d.hp <= 0 && d.fuse == null) d.fuse = .05; return; }
  if (d.chand) { sparks(d.x, d.y, mid, 6); if (d.hp <= 0) { d.gone = true; d.light.off = true; sfx('glass', d); spawn(d.model, d.x, d.y, d.lift, { a: 0, g: 280, life: 4, crash: true }); } return; }   // it comes down, and its light goes with it
  if (d.model === 'a_cask') chips(d.x, d.y, mid, 5, [.42, .05, .1], dir); else if (d.model === 'a_rack') chips(d.x, d.y, mid, 5, [.3, .75, .4, .6], dir); else chips(d.x, d.y, mid, 4, [.55, .38, .2], dir);
  if (d.hp > 0) return;
  d.gone = true; thingsDirty = true; sfx('smash', d); smoke(d.x, d.y, d.z + 3, 3);
  if (d.model === 'a_cask') { chips(d.x, d.y, mid, 30, [.45, .05, .1]); chips(d.x, d.y, mid, 10, [.4, .26, .14]); litter('a_winepool', d.x, d.y, .07); if (Math.random() < .4) items.push({ kind: 'wine', x: d.x, y: d.y, z: d.z }); }
  else if (d.model === 'a_rack') { chips(d.x, d.y, mid, 34, [.3, .8, .45, .7]); chips(d.x, d.y, mid, 12, [.4, .26, .14]); sfx('glass', d); litter('a_winepool', d.x, d.y, .07); }
  else { chips(d.x, d.y, mid, 24, [.55, .38, .2]); if (Math.random() < .45) items.push({ kind: ['bullets', 'shells', 'baguette'][Math.random() * 3 | 0], x: d.x, y: d.y, z: d.z, small: true }); }
}
function vent(s, forced) {                                                     // a pipe lets off steam; one you have shot open scalds whatever stands by it
  s.t = rand(3, 8); const near = Math.hypot(s.x - P.x, s.y - P.y), z = heightAt(s.x, s.y);
  if (near < 170) { sfx('steam', s); for (let i = 0; i < (forced ? 16 : 6); i++) spawn(Math.random() < .5 ? 'a_puff1' : 'a_puff2', s.x + rand(-2, 2), s.y + rand(-2, 2), z + rand(forced ? 3 : 11, 14), { vx: rand(-4, 4) * (forced ? 4 : 1), vy: rand(-4, 4) * (forced ? 4 : 1), vz: rand(6, 16), life: rand(.8, 1.6), steam: 1 }); }
  if (!forced) return;
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - s.x, e.y - s.y) < 32) { hurtEnemy(e, e.boss ? 75 : 40, s.x, s.y); e.stun = Math.max(e.stun, e.boss ? 1.3 : .9); }
  if (near < 17) hurtPlayer(7, s);
}
function chain(from, n, dmg) {                                                 // the Tesla arc leaps from machine to machine
  let cur = from; const done = new Set([from]);
  for (let i = 0; i < n; i++) {
    let best = null, bd = 90; for (const e of enemies) { if (e.dead || done.has(e)) continue; const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < bd && canSee(cur.x, cur.y, e.x, e.y)) { bd = d; best = e; } }
    if (!best) break;
    const a = Math.atan2(best.y - cur.y, best.x - cur.x); for (let d = 4; d < bd; d += 7) fx.push({ model: 'a_bolt', x: cur.x + Math.cos(a) * d, y: cur.y + Math.sin(a) * d, lift: cur.z + 9 + Math.random() * 3, vx: 0, vy: 0, vz: 0, t: 0, life: .16, rot: a - Math.PI / 2 });
    hurtEnemy(best, dmg, cur.x, cur.y); done.add(best); cur = best;
  }
}
function boot() {                                                              // a kick: it shoves a machine back and staggers it, and one already staggered takes it hard
  if (P.bootT > 0 || P.dead) return;
  P.bootT = .55; P.lunge = 1; P.punch -= .05; sfx('thump'); let landed = false; const fx0 = Math.cos(P.yaw), fy0 = Math.sin(P.yaw);
  for (const e of enemies) {
    if (e.dead) continue; const rx = e.x - P.x, ry = e.y - P.y, d = Math.hypot(rx, ry) || 1; if (d > e.r + 15 || (rx * fx0 + ry * fy0) / d < .45 || Math.abs(e.z + (e.fly || 0) - P.z) > 9) continue;
    const mass = e.boss ? .1 : e.type === 'scaphandre' || e.type === 'garde' ? .5 : 1; hurtEnemy(e, e.stun > 0 ? 42 : 11, P.x, P.y); if (e.dead && !e.boss) items.push({ kind: 'crust', x: e.x, y: e.y, z: e.z });   // finish a machine with your boot and it pays out health: get in close when you are hurt
    e.kx += fx0 * 190 * mass; e.ky += fy0 * 190 * mass; e.stun = Math.max(e.stun, .6 * mass + .1); landed = true;
  }
  for (const d of decor) if (d.hp > 0 && !d.gone && !d.lift && Math.hypot(d.x - P.x, d.y - P.y) < d.r + 13 && (d.x - P.x) * fx0 + (d.y - P.y) * fy0 > 0) { hitDecor(d, 25, P.yaw); landed = true; }
  for (const d of doors) if (d.key === 'secret' && !d.unlocked && Math.hypot(d.x - P.x, d.y - P.y) < 38 && (d.x - P.x) * fx0 + (d.y - P.y) * fy0 > 0) { d.unlocked = true; stats.secrets++; landed = true; sfx('key'); say(`A hidden room! Secret ${stats.secrets} of ${stats.secretsTotal}.`); }
  if (landed) { P.shake = Math.max(P.shake, .6); sfx('hit'); P.hitT = .16; P.hitKill = false; }
}
function lob() {                                                               // a grenade: it bounces, and goes off a second and a half after it leaves your hand
  if (P.nadeT > 0 || P.dead || P.grenades <= 0) return;
  P.grenades--; P.nadeT = .7; P.swap = .15; sfx('swap'); const fx0 = Math.cos(P.yaw), fy0 = Math.sin(P.yaw);
  spawn('a_grenade', P.x + fx0 * 5 - fy0 * 2, P.y + fy0 * 5 + fx0 * 2, FP.eye + P.z - 1, { vx: fx0 * 135 + P.vx * .5, vy: fy0 * 135 + P.vy * .5, vz: 42 + (P.pitch + P.punch) * 135, g: 210, bounce: true, spin: 9, life: 1.5, boom: true });
}
function reload() { const w = WEAPONS[P.weapon]; if (P.reload > 0 || P.dead || P.mag[P.weapon] >= Math.min(MAG[P.weapon], P.ammo[w.ammo])) return; P.reload = RELOAD[P.weapon]; sfx('swap'); }
const KICK = [1, 1.9, .7, .5], PUNCH = [.022, .075, .012, .006];             // how hard each weapon kicks in the hand, and how far it throws the view up
const ceilingAt = (x, y) => { const cx = Math.floor(x / CS), cy = Math.floor(y / CS), t = tile(cx, cy); return 'goHz.'.includes(t) ? 1e9 : vaulted(cx, cy) ? 30 : inCellar(cx, cy) ? 21 : t === 'c' ? LOWC : WH; };
function fire(alt) {
  const w = WEAPONS[P.weapon];
  if (P.cool > 0 || P.dead || P.reload > 0) return;
  if (P.ammo[w.ammo] <= 0) { P.cool = .25; sfx('click'); const alt = [3, 2, 1, 0].find(i => P.has[i] && P.ammo[WEAPONS[i].ammo] > 0); if (alt != null) P.weapon = alt; return; }
  if (P.mag[P.weapon] <= 0) { reload(); return; }
  const mode = alt && P.mag[P.weapon] >= ALT[P.weapon].cost ? ALT[P.weapon] : null, cost = mode ? mode.cost : 1, pellets = mode ? mode.pellets : w.pellets, dmg = mode ? mode.dmg : w.dmg, spread = mode ? mode.spread : w.spread, hard = mode ? mode.kick : 1; let struck = null;
  const fx0 = Math.cos(P.yaw), fy0 = Math.sin(P.yaw), slope = P.pitch + P.punch, mz = FP.eye + P.z - 1.6 + slope * 11, mxp = P.x + fx0 * 11 - fy0 * 2.3, myp = P.y + fy0 * 11 + fx0 * 2.3;   // the muzzle
  P.ammo[w.ammo] -= cost; P.mag[P.weapon] -= cost; P.cool = mode ? mode.rate : w.rate; P.kick = hard; P.flash = .06; flashAt(mxp, myp, Math.max(2, mz), 110, P.weapon === 1 ? 3 : 2.2, P.weapon === 3 ? COLD : WARM, .1); P.shake = Math.max(P.shake, P.weapon === 1 ? .7 : .15); sfx(['pistol', 'shotgun', 'smg', 'tesla'][P.weapon]);
  P.punch += PUNCH[P.weapon] * hard; if (P.weapon === 2) P.yaw += rand(-.006, .006);
  if (P.weapon !== 3) {                                                                                   // a spent case spins out to the right, and smoke curls off the muzzle
    const v = rand(28, 46); spawn(P.weapon === 1 ? 'a_hull' : 'a_casing', P.x + fx0 * 6 - fy0 * 2.8, P.y + fy0 * 6 + fx0 * 2.8, FP.eye + P.z - 1.4 + slope * 6, { vx: -fy0 * v + fx0 * rand(-10, 6) + P.vx, vy: fx0 * v + fy0 * rand(-10, 6) + P.vy, vz: rand(22, 44), g: 230, bounce: true, life: rand(1.2, 1.9), stay: true });
    for (let i = 0; i < (P.weapon === 1 ? 3 : 1); i++) spawn('a_puff1', mxp + rand(-.4, .4), myp + rand(-.4, .4), mz - 2 + rand(-.3, .3), { vx: fx0 * rand(4, 12) + P.vx * .5, vy: fy0 * rand(4, 12) + P.vy * .5, vz: rand(4, 10), life: rand(.35, .7), sz: 1.1, al: .5 });
  }
  for (const e of enemies) if (!e.dead && Math.hypot(e.x - P.x, e.y - P.y) < 260) e.awake = true;       // gunfire wakes the neighbourhood
  for (let p = 0; p < pellets; p++) {
    const a = P.yaw + (Math.random() - .5) * 2 * spread, tp = slope + (Math.random() - .5) * 2 * spread, dx = Math.cos(a), dy = Math.sin(a), wall = rayWall(P.x, P.y, a, 640), zAt = d => FP.eye + P.z + tp * d;
    // the shot may meet the floor or the ceiling before it meets a wall
    let ground = 1e9, gz = 0;
    for (let d = 6; d < wall; d += 6) { const x = P.x + dx * d, y = P.y + dy * d, z = zAt(d); if (z < heightAt(x, y)) { ground = d; break; } const c = ceilingAt(x, y); if (z > c) { ground = d; gz = c; break; } }
    const reach = Math.min(wall, ground), targets = [];
    for (const t of [...enemies, ...decor]) {
      if (t.dead || t.gone || !(t.hp > 0)) continue;
      const rx = t.x - P.x, ry = t.y - P.y, along = rx * dx + ry * dy, off = Math.abs(rx * dy - ry * dx);
      if (!(along > 0 && along < reach && off < (t.r || 4) + 1.5)) continue;
      const base = t.chand ? t.lift - 1 : (t.z || 0) + (t.fly ? t.fly - 3 : -1), top = t.chand ? t.top : (t.z || 0) + (!t.type ? MODEL_DEFS[t.model].H * VOX : (t.fly || 0) + (RIG[t.type] ? RIG[t.type].H : MODEL_DEFS[t.type + '_i'].H) * VOX);
      if (zAt(along) > base && zAt(along) < top + 1.5) targets.push([along, t]);                            // over its head or under a drone is a miss
    }
    targets.sort((m, n) => m[0] - n[0]);
    let end = reach;
    for (const [along, t] of targets) {
      if (!t.type) { hitDecor(t, dmg, a); P.hitT = .16; P.hitKill = false; }
      else { struck = struck || t; const qx = P.x + dx * along - t.x, qy = P.y + dy * along - t.y; hurtEnemy(t, dmg * (.8 + Math.random() * .4), P.x, P.y, { z: zAt(along), lx: qx * Math.sin(t.yaw) - qy * Math.cos(t.yaw), pierce: w.pierce }); }
      if (!w.pierce) { end = along; break; }
    }
    if (w.pierce) for (let d = 10; d < end; d += 9) fx.push({ model: 'a_bolt', x: P.x + dx * d, y: P.y + dy * d, lift: zAt(d) - 2 + Math.random() * 2, vx: 0, vy: 0, vz: 0, t: 0, life: .09, rot: a - Math.PI / 2 });
    else if (end >= reach && ground < wall) {                       // into the floor or the ceiling
      const ix = P.x + dx * (ground - 3), iy = P.y + dy * (ground - 3), iz = gz ? gz - .6 : zAt(ground - 3);
      if (gz < 1e8) { sparks(ix, iy, iz, 3, a + Math.PI, 3); smoke(ix, iy, iz, 1); }
    }
    else if (end >= wall) {                                         // the wall is chipped away where the shot lands, and throws out its own rubble
      const ix = P.x + dx * (end - 1.2), iy = P.y + dy * (end - 1.2), iz = Math.min(WH + 12, zAt(end) - 1 + rand(-.6, .6)), hit = panelAt(P.x + dx * end, P.y + dy * end, dx, dy);
      sparks(ix, iy, iz, 4, a + Math.PI, 2); smoke(ix, iy, iz, 1);
      if (hit && /^panel_[FXa]_/.test(hit[0].m.name) && !hit[0].smashed) { hit[0].smashed = true; sfx('glass', { x: ix, y: iy }); chips(ix, iy, iz, 22, [.75, .9, 1, .5], a + Math.PI); chip(hit[0], 64, 130, 16); }   // a window goes
      if (hit && /^panel_G/.test(hit[0].m.name)) { const s = steamers.find(q => Math.hypot(q.x - ix, q.y - iy) < 18 && !(q.cd > stats.time)); if (s) { s.cd = stats.time + 2.5; vent(s, true); } }   // a shot into the pipework lets the steam out
      const k = hit && chip(hit[0], hit[1], (iz - hit[0].lift) * WPU, P.weapon === 3 ? 5 : P.weapon === 1 ? 3 : 3.6);
      if (k) for (let i = 0; i < 5; i++) { const b = a + Math.PI + rand(-1, 1), v = rand(15, 60); spawn('chip', ix, iy, iz, { k: [rand(.3, .7), (k >> 16 & 255) / 255, (k >> 8 & 255) / 255, (k & 255) / 255, 0], vx: Math.cos(b) * v, vy: Math.sin(b) * v, vz: rand(-5, 40), g: 220, bounce: true, life: rand(.8, 1.6) }); }
    }
  }
  if (mode && mode.chain && struck) chain(struck, mode.chain, 36);
}
const PICK = {
  crust: { model: 'a_baguette', want: () => P.hp < 100, get: () => P.hp < 100 && (P.hp = Math.min(100, P.hp + 12), 'A heel of bread. +12 santé') },
  baguette: { model: 'a_baguette', want: () => P.hp < 100, get: () => P.hp < 100 && (P.hp = Math.min(100, P.hp + 25), 'A baguette. +25 santé') },
  wine: { model: 'a_wine', want: () => P.hp < 200, get: () => P.hp < 200 && (P.hp = Math.min(200, P.hp + 40), 'A bottle of Bordeaux. +40 santé') },
  helmet: { model: 'a_helmet', want: () => P.armour < 100, get: () => P.armour < 100 && (P.armour = Math.min(100, P.armour + 50), 'An Adrian helmet. +50 armure') },
  bullets: { model: 'a_bullets', get: it => (P.ammo.bullets += it.small ? 8 : 24, 'Cartridges') },
  shells: { model: 'a_shells', get: it => (P.ammo.shells += it.small ? 4 : 8, 'Shotgun shells') },
  cells: { model: 'a_cells', get: () => (P.ammo.cells += 30, 'Tesla cells') },
  grenades: { model: 'a_grenade_p', get: () => (P.grenades += 2, 'Two grenades') },
  shotgun: { model: 'w_shotgun', get: () => (P.has[1] = true, P.weapon = 1, P.reload = 0, P.ammo.shells += 8, P.mag[1] = MAG[1], 'Fusil de chasse: the gamekeeper’s shotgun!') },
  smg: { model: 'w_smg', get: () => (P.has[2] = true, P.weapon = 2, P.reload = 0, P.ammo.bullets += 40, P.mag[2] = MAG[2], 'Mitraillette: a submachine gun!') },
  tesla: { model: 'w_tesla', get: () => (P.has[3] = true, P.weapon = 3, P.reload = 0, P.ammo.cells += 40, P.mag[3] = MAG[3], 'Arc Tesla: the Baron’s own invention!') },
  key_blue: { model: 'a_key_blue', get: () => (P.keys.blue = true, sfx('key'), 'The blue key') },
  key_red: { model: 'a_key_red', get: () => (P.keys.red = true, sfx('key'), 'The red key') },
};

// ---------- encounters: rooms that shut behind you, and machines that arrive while you are in them ----------
// zone: the squares of the plan that set it off (or pick: the thing you pick up); seal: the doors that shut until it is over;
// waves: who arrives, and where; dark: how long the lanterns go out for.
const ENC = LEVEL === 1 ? [
  { zone: [5, 17, 11, 19], seal: [0, 1], say: 'The shutters drop behind you. They were waiting.', waves: [[['automate', 6, 17], ['automate', 10, 17], ['sauteur', 8, 17]], [['automate', 5, 20], ['automate', 11, 20], ['lanterne', 8, 18]]] },
  { pick: 'key_blue', dark: 10, say: 'The lanterns gutter out. Something is moving in the dark.', waves: [[['sauteur', 6, 1], ['sauteur', 6, 4], ['automate', 7, 3], ['lanterne', 4, 3]]] },
  { zone: [17, 16, 24, 22], seal: [2, 3], say: 'The cellar doors slam. Glass rattles in the racks.', waves: [[['automate', 23, 17], ['automate', 23, 21], ['sauteur', 19, 21]], [['garde', 20, 19], ['lanterne', 21, 17], ['lanterne', 19, 19]]] },
  { pick: 'key_red', say: 'Something heavy is coming up the hall.', waves: [[['garde', 20, 9], ['automate', 17, 10], ['automate', 23, 10], ['sauteur', 20, 11]]] },
  { zone: [27, 5, 32, 13], seal: [6], say: 'The gate locks. Lanterns rise over the hedges.', waves: [[['lanterne', 27, 5], ['lanterne', 33, 5], ['lanterne', 27, 13], ['lanterne', 33, 13], ['sauteur', 30, 6]]] },
  { zone: [26, 17, 33, 24], seal: [7], boss: true, say: 'The red door seals. Le Colosse turns to face you.', done: 'The workshop is silent. Find the lever.' },
] : [
  { zone: [14, 20, 20, 28], say: 'Lanterns, rising off the roofs!', waves: [[['lanterne', 14, 20], ['lanterne', 20, 20], ['lanterne', 14, 28], ['lanterne', 20, 28]], [['sauteur', 19, 23], ['sauteur', 15, 26], ['automate', 20, 25]]] },
  { zone: [23, 18, 31, 27], say: 'They are coming over the parapet.', waves: [[['garde', 30, 22], ['automate', 31, 26], ['lanterne', 23, 18], ['lanterne', 31, 18]], [['sauteur', 23, 23], ['sauteur', 27, 26], ['sauteur', 30, 20]]] },
  { zone: [14, 4, 27, 12], seal: [0], pre: true, say: 'The mooring house is locked down. Hold the roof!', done: 'The mooring house unlocks. Throw the switch!', waves: [[['scaphandre', 16, 5], ['scaphandre', 25, 5], ['lanterne', 20, 5], ['lanterne', 15, 12], ['lanterne', 26, 12]], [['garde', 18, 6], ['garde', 23, 6], ['sauteur', 15, 9], ['sauteur', 26, 9]], [['scaphandre', 20, 6], ['automate', 16, 12], ['automate', 25, 12], ['automate', 20, 12]]] },
];
function spawnEnemy(type, cx, cy) {                                            // a machine arrives in a flash and a shower of sparks, already hunting
  let p = C(cx, cy); for (let i = 0; i < 10 && (Math.hypot(p.x - P.x, p.y - P.y) < 46 || boxHits(p.x, p.y, 7) || inPit(p.x, p.y) || decor.some(d => d.solid && !d.gone && Math.hypot(d.x - p.x, d.y - p.y) < d.r + 7)); i++) p = { x: (cx + .5) * DS + rand(-13, 13), y: (cy + .5) * DS + rand(-13, 13) };
  const e = mk(type, p.x, p.y); e.awake = true; e.cool = 1.3 + Math.random(); enemies.push(e); stats.total++;
  flashAt(e.x, e.y, e.z + 8, 90, 2.6, COLD, .4); sparks(e.x, e.y, e.z + 8, 18); smoke(e.x, e.y, e.z + 2, 5); sfx('wake', e); return e;
}
function runEncounters(dt) {
  const px = Math.floor(P.x / DS), py = Math.floor(P.y / DS);
  for (const n of enc) {
    if (n.state === 0) {
      if (!(n.zone ? px >= n.zone[0] && py >= n.zone[1] && px <= n.zone[2] && py <= n.zone[3] : P.picked === n.pick)) continue;
      n.state = 1; n.wave = -1; n.wait = n.pick ? .9 : .2; n.mob = n.boss ? enemies.filter(e => e.boss) : [];
      for (const i of n.seal || []) { if (!doors[i].sealed) sfx('door', doors[i]); doors[i].sealed = true; }
      if (n.say) say(n.say); if (n.dark) darkT = n.dark; if (n.boss) { sfx('roar'); for (const e of n.mob) e.awake = true; }
    }
    if (n.state !== 1 || n.mob.some(e => !e.dead) || (n.wait -= dt) > 0) continue;
    if (n.waves && ++n.wave < n.waves.length) { n.mob = n.waves[n.wave].map(([t, x, y]) => spawnEnemy(t, x, y)); n.wait = 1.4; if (n.wave) say('More of them!'); }
    else { n.state = 2; for (const i of n.seal || []) doors[i].sealed = false; say(n.done || 'The way is clear.'); }
  }
  P.picked = null;
}
const segDist = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
const hidden = (x, y) => !canSee(x, y, P.x, P.y) || decor.some(d => d.solid && !d.gone && !d.lift && d.r >= 4 && segDist(d.x, d.y, x, y, P.x, P.y) < d.r * .8);   // out of your sight: behind a wall, a pillar or something big
// Le Colosse fights in three phases: its guns; then, with its armour coming away, a charge you can bait into the ironwork;
// then faster, with a guard called in.
function bossThink(e, dt, dist) {
  const ph = e.hp > e.hp0 * .66 ? 1 : e.hp > e.hp0 * .33 ? 2 : 3;
  if (ph !== e.phase) {
    e.phase = ph; e.stun = 1.1; e.rush = null; e.wind = 0; sfx('roar', e); P.shake = Math.max(P.shake, 1.6); sparks(e.x, e.y, e.z + 12, 50); smoke(e.x, e.y, e.z + 6, 10); burst(e.x, e.y, e.z + 12, 10, 'a_bit');
    if (ph === 2) say('Its armour is coming away. It lowers its head to charge!');
    else { say('Le Colosse is failing, and calls its guard!'); e.rate *= .7; if (LEVEL === 1) for (const [t, x, y] of [['automate', 27, 17], ['automate', 33, 17], ['sauteur', 30, 23]]) spawnEnemy(t, x, y); }
  }
  if (ph >= 2 && !e.rush && e.wind <= 0 && (e.rushCd -= dt) <= 0 && e.see && dist < 320) { e.rush = { wind: .95, go: 0 }; e.rushCd = ph === 3 ? 5 : 7.5; sfx('roar', e); }
}
function bossRush(e, dt, dist) {
  const r = e.rush; e.moving = false;
  if (r.wind > 0) { if ((r.wind -= dt) <= 0) { r.go = 1.5; r.dx = Math.cos(e.yaw); r.dy = Math.sin(e.yaw); } return; }   // head down, still turning to follow you; then it goes, in a straight line
  r.go -= dt; e.moving = true; const nx = e.x + r.dx * 215 * dt, ny = e.y + r.dy * 215 * dt;
  if (boxHits(nx, ny, e.r) || inPit(nx, ny) || Math.abs(heightAt(nx, ny) - e.z) > 2.2) {                  // into a wall or a pillar: it staggers, wide open
    e.rush = null; e.stun = e.dazed = 2.4; P.shake = Math.max(P.shake, 1.8); sfx('boom', e); sparks(nx, ny, e.z + 10, 40); smoke(nx, ny, e.z + 4, 8);
    for (const p of panels) if (p.far && Math.hypot(p.x - nx, p.y - ny) < 30) for (let i = 0; i < 3; i++) chip(p, rand(10, 118), rand(4, 150), rand(6, 12));
    say('It has run itself into the ironwork. Now!'); return;
  }
  e.x = nx; e.y = ny;
  if (dist < e.r + 8 && !r.hit) { r.hit = true; hurtPlayer(26, e); P.vx += r.dx * 260; P.vy += r.dy * 260; }
  if (r.go <= 0) e.rush = null;
}

function win() {
  state = 'won'; sfx('key'); P.escape = 0;
  try { if (LEVEL === 1) sessionStorage.setItem('automates_carry', JSON.stringify({ hp: Math.max(60, Math.ceil(P.hp)), armour: P.armour, ammo: P.ammo, has: P.has, grenades: P.grenades, weapon: P.weapon, mag: P.mag })); else sessionStorage.removeItem('automates_carry'); } catch (e) { /* private browsing */ }
  showScreen();
}
// ---------- the opening: the last train draws in, the lights fail, and you are on your own ----------
let introT = 0;
const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function runIntro(dt) {
  const t = introT += dt;
  train.x = -440 + 590 * (1 - (1 - Math.min(1, t / 3.2)) ** 3); train.next = 40; train.sounded = true;
  P.yaw = 1.25 * (1 - ease((t - 2.4) / 2.6)); P.pitch = -.04 * (1 - ease((t - 2.4) / 2.6));
  darkT = t > 2.7 && t < 4.5 && Math.sin(t * 37) + Math.sin(t * 11) > .3 ? 1.5 : 0;
  if (t < 3) P.shake = Math.max(P.shake, .25 * (1 - t / 3));
  $('cap').textContent = t < 2.6 ? 'PARIS · 1934' : t < 5.2 ? 'Station Abbesses. The last train of the night.' : '';
  if (t > 5.8) endIntro();
}
function endIntro() { if (state !== 'intro') return; state = 'play'; darkT = 0; P.yaw = 0; P.pitch = 0; P.swap = .3; $('cap').textContent = ''; showScreen(); }
// the title: a slow circle through the level, with nobody in it
const titleCam = t => LEVEL === 1 ? (a => { const x = 256 + Math.cos(a) * 170, y = 852 + Math.sin(a) * 20; return { x, y, z: 4, yaw: Math.atan2(900 - y, 256 - x), pitch: .03 }; })(t * .05)
  : (a => { const x = 22 * DS + Math.cos(a) * 250, y = 15 * DS + Math.sin(a) * 250; return { x, y, z: 34, yaw: Math.atan2(15 * DS - y, 22 * DS - x), pitch: -.16 }; })(t * .04);

// ---------- update ----------
function update(dt) {
  stats.time += dt;
  const k = keys, turn = (k.arrowright || k.e ? 1 : 0) - (k.arrowleft || k.q ? 1 : 0);
  P.yaw += turn * 2.6 * dt;
  const f = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), s = (k.d ? 1 : 0) - (k.a ? 1 : 0), l = Math.hypot(f, s) || 1;
  const going = f || s, run = going && k.shift && f >= 0, top = run ? 225 : 170, grip = going ? 12 : 8;   // Shift sprints; you get going quickly and slide a short way to a stop
  const wx = (Math.cos(P.yaw) * f - Math.sin(P.yaw) * s) / l * top, wy = (Math.sin(P.yaw) * f + Math.cos(P.yaw) * s) / l * top;
  P.vx += (wx - P.vx) * Math.min(1, grip * dt); P.vy += (wy - P.vy) * Math.min(1, grip * dt);
  const ox = P.x, oy = P.y, before = P.speed; moveBody(P, P.vx * dt, P.vy * dt, 4.5, enemies);
  P.z += (heightAt(P.x, P.y) - P.z) * Math.min(1, 16 * dt);                                               // up and down the steps
  P.speed = Math.hypot(P.x - ox, P.y - oy) / Math.max(dt, 1e-4);                                          // the speed actually made good: walking into a wall is standing still
  P.sprint += ((run && P.speed > 190 ? 1 : 0) - P.sprint) * Math.min(1, 6 * dt);
  if (!going && before >= 50 && P.speed < 50) P.dipT = .3;                                                // coming to a stop, the view settles
  if ((tagT -= dt) <= 0) { tagT = .08; let best = null, bd = 1e9; const fxv = Math.cos(P.yaw), fyv = Math.sin(P.yaw);     // what the crosshair is on
    for (const e of enemies) { if (e.dead || e.boss) continue; const ex = e.x - P.x, ey = e.y - P.y, f = ex * fxv + ey * fyv; if (f < 4 || f > 300 || f > bd) continue; if (Math.abs(ey * fxv - ex * fyv) < e.r + 2 + f * .02 && canSee(P.x, P.y, e.x, e.y)) { best = e; bd = f; } }
    const el = $('tag'); if (el) { if (best) { const k = KIND[best.type]; el.innerHTML = `<b style="color:${k.col}">${k.name}</b><i><u style="width:${Math.max(0, Math.round(100 * best.hp / best.hp0))}%;background:${k.col}"></u></i>`; } el.style.opacity = best ? 1 : 0; } }
  P.dipT = Math.max(0, P.dipT - dt); P.punch -= P.punch * Math.min(1, 8 * dt); P.hitT = Math.max(0, P.hitT - dt);
  for (let i = P.hits.length - 1; i >= 0; i--) if ((P.hits[i].t -= dt * .9) <= 0) P.hits.splice(i, 1);
  const here = tile(Math.floor(P.x / CS), Math.floor(P.y / CS)), was = P.bob;
  P.bob += P.speed * dt * 0.06;                                                                          // the stride: the view, the gun and the footsteps all keep time with it
  P.heat = enemies.some(e => !e.dead && e.awake && e.see) ? 4 : Math.max(0, (P.heat || 0) - dt);            // the fight music holds for a few seconds after the last machine loses sight of you
  if (snd) { snd.mood(P.heat > 0); snd.room(ROOM_OF[here === 'D' ? doorAt(Math.floor(P.x / CS), Math.floor(P.y / CS)).floor : here]); if (!muted) { snd.tick(dt); if (Math.floor(P.bob / Math.PI) !== Math.floor(was / Math.PI) && STEP_ON[here]) snd.step(STEP_ON[here], Math.floor(P.bob / Math.PI) & 1 ? .18 : -.18); } }   // a footfall each time the stride lands
  P.bootT = Math.max(0, P.bootT - dt); P.nadeT = Math.max(0, P.nadeT - dt); P.lunge = Math.max(0, P.lunge - dt * 4); darkT = Math.max(0, darkT - dt);
  if (P.reload > 0 && (P.reload -= dt) <= 0) { P.reload = 0; P.mag[P.weapon] = Math.min(MAG[P.weapon], P.ammo[WEAPONS[P.weapon].ammo]); sfx('click'); }
  P.away = P.away || [0, 0, 0, 0]; for (let i = 0; i < 4; i++) { const full = Math.min(MAG[i], P.ammo[WEAPONS[i].ammo]); if (i === P.weapon || P.mag[i] >= full) P.away[i] = 0; else if ((P.away[i] += dt) > 1.4) P.mag[i] = full; }   // a gun put away is reloaded by the time you want it again: switching beats waiting
  if (P.cool <= 0 && !P.reload && P.mag[P.weapon] <= 0 && P.ammo[WEAPONS[P.weapon].ammo] > 0) reload();    // an empty gun reloads itself
  if (k.f) boot(); if (k.g) lob(); if (k.r) reload();
 P.cool -= dt; P.kick = Math.max(0, P.kick - dt * (P.weapon === 1 ? 3.2 : 5)); P.swap = Math.max(0, (P.swap || 0) - dt); P.shake = Math.max(0, P.shake - dt * 4);
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].t += dt) > flashes[i].life) flashes.splice(i, 1);
  train.next -= dt;                                                                                       // the train: out of one tunnel, through the station, into the other
  if (train.next <= 0) { train.x = -440; train.next = rand(38, 60); train.sounded = false; }
  if (train.x < TRAIN_END) { train.x += 300 * dt; const near = Math.hypot(P.x - train.x - 80, P.y - TRAIN_Y); if (near < 190) P.shake = Math.max(P.shake, .5 * (1 - near / 190)); if (!train.sounded && train.x > -150) { train.sounded = true; sfx('train', { x: Math.max(80, Math.min(440, P.x)), y: TRAIN_Y }); } }
  for (const s of steamers) if ((s.t -= dt) < 0) vent(s);
  P.flash -= dt; P.pain = Math.max(0, P.pain - dt * 0.9); P.grin -= dt;
  if (train.x < TRAIN_END) for (const e of enemies) if (!e.dead && inPit(e.x, e.y) && Math.abs(e.y - TRAIN_Y) < 15 && e.x > train.x - 16 && e.x < train.x + CARS * 31) hurtEnemy(e, 999, train.x - 40, e.y);   // anything over the track when the train comes through
  if (k.alt2 || k.x) fire(true); else if (k[' '] || k.control || k.fire) fire();
  // doors slide open for the player (with the right key) and for enemies that are hunting
  for (const d of doors) {
    const near = Math.hypot(P.x - d.x, P.y - d.y) < 34;
    if (near && !d.unlocked && d.key !== 'secret') { if (P.keys[d.key]) { d.unlocked = true; say(`The ${d.key} door unlocks.`); } else if (!d.told || stats.time - d.told > 3) { d.told = stats.time; say(`You need the ${d.key} key.`); } }
    if (d.sealed) d.hold = Math.min(d.hold, 0);
    const want = d.unlocked && !d.sealed && (near || enemies.some(e => e.awake && !e.dead && Math.hypot(e.x - d.x, e.y - d.y) < 30));
    if (want) { if (d.open === 0) sfx('door', d); d.hold = 2.5; }
    d.hold -= dt; const target = d.hold > 0 ? 1 : 0;
    if (target === 0 && d.open > 0 && [P, ...enemies].some(b => !b.dead && Math.hypot(b.x - d.x, b.y - d.y) < 21)) d.hold = .5;   // never close on someone
    else d.open = Math.max(0, Math.min(1, d.open + (target ? 1 : -1) * dt * 2.2));
  }
  flowT -= dt; if (flowT <= 0 || !flow) { flow = computeFlow(); flowT = .3; }
  for (const e of enemies) {
    if (e.dead) { if (e.dying && (e.dying += dt) > .55) { e.dying = 0; wreck(e, e.killer[0], e.killer[1]); } continue; }
    e.flash -= dt; e.atk -= dt; e.t += dt;
    const tg = e.grudge && !e.grudge.dead && (e.grudgeT -= dt) > 0 ? e.grudge : P;                       // shot by another machine, it turns on that one for a while
    const dx = tg.x - e.x, dy = tg.y - e.y, dist = Math.hypot(dx, dy);
    { const fh = heightAt(e.x, e.y); if (!e.fly || fh > -10) e.z += (fh - e.z) * Math.min(1, 12 * dt); }
    if (e.kx || e.ky) { moveBody(e, e.kx * dt, e.ky * dt, e.r, null); const k = Math.exp(-9 * dt); e.kx *= k; e.ky *= k; if (Math.abs(e.kx) + Math.abs(e.ky) < 1) e.kx = e.ky = 0; }   // knocked back by a hit
    e.twist *= Math.exp(-7 * dt); e.nod = Math.max(0, e.nod - dt * 4); e.limp = Math.max(0, e.limp - dt); e.dazed = Math.max(0, e.dazed - dt);
    if (e.stun > 0) { e.stun -= dt; e.moving = false; continue; }                                         // staggered: it does nothing until it has its balance back
    e.seeT -= dt; if (e.seeT <= 0) { e.seeT = .18; e.see = dist < 320 && canSee(e.x, e.y, tg.x, tg.y); }
    if (!e.awake) { if ((e.see && dist < 260) || dist < 40) { e.awake = true; sfx('wake', e); } else continue; }
    { const want = Math.atan2(dy, dx); e.yaw = e.rush && e.rush.go ? e.yaw : e.shield ? e.yaw + Math.max(-1.5 * dt, Math.min(1.5 * dt, wrap(want - e.yaw))) : want; }   // the guard turns slowly behind its shield: you can get round it
    e.aim += (1 - e.aim) * Math.min(1, dt * 7);                                                           // the guns come up
    e.cool -= dt;
    if (e.jump) {                                                    // the fencer is in the air
      const j = e.jump, nx = e.x + j.vx * dt, ny = e.y + j.vy * dt; j.t += dt;
      if (!boxHits(nx, ny, e.r) && !inPit(nx, ny)) { e.x = nx; e.y = ny; } else j.t = j.dur;
      e.hop = Math.sin(Math.PI * Math.min(1, j.t / j.dur)) * 9; e.moving = false;
      if (j.t >= j.dur) { e.jump = null; e.hop = 0; e.cool = e.rate; sparks(e.x, e.y, e.z + 1, 6); if (Math.hypot(P.x - e.x, P.y - e.y) < e.r + 10 && Math.abs(e.z - P.z) < 8) { hurtPlayer(e.dmg, e); P.vx += j.vx * .5; P.vy += j.vy * .5; } }
      continue;
    }
    if (e.boss) bossThink(e, dt, dist);
    if (e.rush) { bossRush(e, dt, dist); continue; }
    if (e.wind > 0) {                                                // it has braced and its gun is charging: the shot comes when the charge is full
      if ((e.wind -= dt) <= 0 && e.leap) { const dur = .45, v = Math.min(300, (dist + 6) / dur); e.wind = 0; e.jump = { t: 0, dur, vx: dx / dist * v, vy: dy / dist * v }; sfx('swap', e); }   // it springs
      else if (e.wind <= 0 && !P.dead) {
        e.wind = 0; e.atk = .22; sfx('enemy', e); flashAt(e.x + Math.cos(e.yaw) * (e.r + 3), e.y + Math.sin(e.yaw) * (e.r + 3), e.z + 8 + (e.fly || 0), 80, 1.8, WARM, .12);
        const sz = e.z + 7 + (e.fly || 0), rise = (tg.z + (tg === P ? 11 : 8) - sz) / Math.max(.3, dist / 92), wild = tg === P ? .05 + .11 * Math.min(1, P.speed / 200) : .08;   // the faster you move, the worse they shoot                 // the shots climb or fall towards where you stand
        const guns = RIG[e.type] ? RIG[e.type].gun.filter(g => e.arm[g]).length / RIG[e.type].gun.length : 1, vol = Math.max(1, Math.round(e.shots * guns));
        for (let i = 0; i < vol; i++) { const a = e.yaw + (i - (vol - 1) / 2) * .16 + (Math.random() - .5) * wild; shots.push({ from: e, model: e.shot, x: e.x + Math.cos(a) * (e.r + 3), y: e.y + Math.sin(a) * (e.r + 3), vx: Math.cos(a) * 92, vy: Math.sin(a) * 92, vz: rise, dmg: e.dmg, lift: sz, t: 0 }); }
        if (e.boss && Math.random() < .22) for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; shots.push({ model: 'a_spark', x: e.x + Math.cos(a) * 12, y: e.y + Math.sin(a) * 12, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, vz: 0, dmg: 8, lift: e.z + 7, t: 0 }); }
      }
    } else if (e.leap && e.see && dist < 125 && dist > 26 && e.cool <= 0 && !P.dead) { e.wind = .32; sfx('charge', e); }
    else if (e.see && dist < e.range && e.cool <= 0 && !P.dead && !e.boss && enemies.filter(o => o.wind > 0 && !o.leap && !o.dead).length >= 3) e.cool = .25;   // only three guns are ever charging at once: a crowd takes turns
    else if (e.see && dist < e.range && e.cool <= 0 && !P.dead) { e.wind = WIND; e.cool = e.rate * (.8 + Math.random() * .5); sfx('charge', e); }   // you see and hear a shot coming before it comes
    let mx = 0, my = 0;
    if (e.range > 0 && !e.boss && !e.fly && !e.shield && (e.coverT -= dt) <= 0) {                           // having fired, look for somewhere out of your sight to wait for the next shot
      e.coverT = .6; e.cover = null;
      if (e.see && e.cool > e.rate * .4) { let bd = 1e9; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = e.x + Math.cos(a) * 30, y = e.y + Math.sin(a) * 30; if (boxHits(x, y, e.r) || inPit(x, y) || Math.abs(heightAt(x, y) - e.z) > 2 || !canSee(e.x, e.y, x, y) || !hidden(x, y)) continue; const d = Math.hypot(x - P.x, y - P.y); if (d < bd) { bd = d; e.cover = [x, y]; } } }
    }
    if (e.wind > 0) { /* braced to fire */ }
    else if (e.fleeT > 0) {                                           // it has lost an arm: back the way it came, for a moment
      e.fleeT -= dt; const cx = Math.floor(e.x / CS), cy = Math.floor(e.y / CS); let best = flow[cx + cy * GW], bx = cx, by = cy;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = flow[cx + a + (cy + b) * GW]; if (v < 999 && v > best) { best = v; bx = cx + a; by = cy + b; } }
      const tx = bx * CS + 8 - e.x, ty = by * CS + 8 - e.y, tl = Math.hypot(tx, ty) || 1; mx = tx / tl * 1.2; my = ty / tl * 1.2;
    }
    else if (e.cover && e.cool > e.rate * .4) { const tx = e.cover[0] - e.x, ty = e.cover[1] - e.y, tl = Math.hypot(tx, ty); if (tl > 3) { mx = tx / tl; my = ty / tl; } }
    else if (e.flank && e.see && dist > 90 && !e.boss) { const a = Math.atan2(dy, dx) + e.strafe * .95; mx = Math.cos(a); my = Math.sin(a); }   // some come round the side instead of straight at you
    else if (e.see && dist < e.range * 0.45 && !e.boss) { if (Math.random() < dt * .6) e.strafe *= -1; mx = -dy / dist * e.strafe * 0.7; my = dx / dist * e.strafe * 0.7; }   // close enough: circle
    else if (e.see && dist < 60) { mx = dx / dist; my = dy / dist; }
    else {                                                            // otherwise follow the flow field towards the player
      const cx = Math.floor(e.x / CS), cy = Math.floor(e.y / CS); let best = flow[cx + cy * GW], bx = cx, by = cy;
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = flow[cx + a + (cy + b) * GW]; if (v < best) { best = v; bx = cx + a; by = cy + b; } }
      const tx = bx * CS + 8 - e.x, ty = by * CS + 8 - e.y, tl = Math.hypot(tx, ty) || 1; mx = tx / tl; my = ty / tl;
    }
    const pace = e.speed * (e.limp > 0 ? .45 : 1); e.moving = (mx || my) && moveBody(e, mx * pace * dt, my * pace * dt, e.r, [P, ...enemies]);   // a shot in the leg slows it
    const gap = e.r + 5 - dist; if (tg === P && gap > 0 && dist > .01 && !e.fly) { const px = e.x - dx / dist * gap * .5, py = e.y - dy / dist * gap * .5; if (!boxHits(px, py, e.r) && !inPit(px, py)) { e.x = px; e.y = py; } }   // a machine that has ended up on top of you is eased back off
    if (tg === P && dist < e.r + 9 && e.cool < e.rate * .5 && !e.fly && Math.abs(e.z - P.z) < 8) { hurtPlayer(e.boss ? 14 : e.leap ? e.dmg : 6, e); e.cool = e.rate; }                                   // contact damage
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s2 = shots[i]; s2.t += dt; s2.x += s2.vx * dt; s2.y += s2.vy * dt; s2.lift += (s2.vz || 0) * dt;
    if (solidAtPt(s2.x, s2.y) || s2.t > 5 || s2.lift < heightAt(s2.x, s2.y)) { sparks(s2.x - s2.vx * dt, s2.y - s2.vy * dt, s2.lift, 4, Math.atan2(-s2.vy, -s2.vx), 2); shots.splice(i, 1); }
    else if (Math.hypot(s2.x - P.x, s2.y - P.y) < 5 && Math.abs(s2.lift - P.z - 8.5) < 9.5) { hurtPlayer(s2.dmg, { x: s2.x - s2.vx, y: s2.y - s2.vy }); shots.splice(i, 1); }
    else if (s2.from) for (const o of enemies) if (o !== s2.from && !o.dead && Math.hypot(s2.x - o.x, s2.y - o.y) < o.r && s2.lift > o.z + (o.fly || 0) - 2 && s2.lift < o.z + (o.fly || 0) + 20) {   // a machine in the line of fire takes the shot, and takes it personally
      hurtEnemy(o, s2.dmg * 2, s2.x - s2.vx, s2.y - s2.vy); if (!o.boss && !s2.from.dead && o.type !== s2.from.type) { o.grudge = s2.from; o.grudgeT = 3.5; } shots.splice(i, 1); break; }
  }
  for (const d of decor) if (d.fuse != null && !d.gone) { d.fuse -= dt; if (d.fuse <= 0) { d.gone = true; thingsDirty = true; explode(d.x, d.y, true); } }
  burn(dt);
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i], nx = p.x + p.vx * dt, ny = p.y + p.vy * dt; p.t += dt;
    if (solidAtPt(nx, ny)) { p.vx *= -.4; p.vy *= -.4; } else { p.x = nx; p.y = ny; }                    // off the walls
    if (p.g && !p.rest) {
      const floor = heightAt(p.x, p.y) + .1 - (p.base || 0); p.vz -= p.g * dt; p.lift += p.vz * dt;   // `base`: how far above its own origin the part's underside is
      if (p.lift <= floor) { p.lift = floor; if (p.bounce && p.vz < -30) { p.vz *= -.38; p.vx *= .55; p.vy *= .55; p.spin *= .6; if ((p.model === 'a_casing' || p.model === 'a_hull') && !p.rang) { p.rang = true; sfx('casing', p); } } else { p.rest = true; p.vx = p.vy = p.vz = 0; } }
    } else if (!p.g) p.lift += p.vz * dt;
    if (!p.rest) p.a += p.spin * dt;
    if (p.crash && p.rest) { p.t = p.life + 1; sfx('glass', p); sfx('smash', p); sparks(p.x, p.y, p.lift + 2, 36); chips(p.x, p.y, p.lift + 2, 24, [1, .85, .5, .6]); litter('a_scorch', p.x, p.y, .05); P.shake = Math.max(P.shake, 1.2 * Math.max(0, 1 - Math.hypot(P.x - p.x, P.y - p.y) / 120));   // the chandelier lands
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 22) { hurtEnemy(e, 75, p.x, p.y); e.stun = Math.max(e.stun, .8); } if (Math.hypot(P.x - p.x, P.y - p.y) < 13) hurtPlayer(18, p); }
    if (p.t > p.life && p.boom) explode(p.x, p.y);
    if (p.t > p.life) { if (p.model === 'a_casing' || p.model === 'a_hull') { brass.push({ model: p.model, x: p.x, y: p.y, lift: p.lift }); if (brass.length > 90) brass.shift(); } else if (p.stay) { debris.push({ model: p.model, x: p.x, y: p.y, lift: p.lift, rot: p.a, tip: p.tip, base: p.base }); if (debris.length > 130) debris.shift(); } fx.splice(i, 1); }
  }
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i], pk = PICK[it.kind], d = Math.hypot(it.x - P.x, it.y - P.y);
    if (d > 9 && d < 34 && (!pk.want || pk.want()) && canSee(P.x, P.y, it.x, it.y)) { const v = Math.min(d - 8, (40 + (1 - d / 34) * 190) * dt); it.x += (P.x - it.x) / d * v; it.y += (P.y - it.y) / d * v; }   // something you can use slides towards you once you are near it
    if (d > 9 || Math.abs((it.z || 0) - P.z) > 9) continue;
    const msg = pk.get(it); if (!msg) continue;
    say(msg); if (!it.kind.startsWith('key')) sfx('pickup'); P.grin = .8; P.picked = it.kind; items.splice(i, 1);
  }
  runEncounters(dt);
  const ex = decor.find(d => d.exit);
  if (!P.escape && Math.hypot(P.x - ex.x, P.y - ex.y) < 20 && Math.abs(ex.z - P.z) < 8) {
    if (enemies.some(e => e.boss && !e.dead)) { if (!(P.told > stats.time)) { P.told = stats.time + 3; say('The lever will not move while Le Colosse stands.'); } }
    else if (LEVEL === 2) win();
    else { P.escape = 32; sfx('key'); sfx('roar'); say('The lever drops. The workshop is tearing itself apart: get out to the courtyard!'); for (const d of doors) d.sealed = false; }
  }
  if (P.escape && !P.dead) {                                         // the way out: the workshop blows up around you against the clock
    P.escape -= dt; P.shake = Math.max(P.shake, .35 + .25 * Math.sin(stats.time * 9));
    if ((P.blastT = (P.blastT || 0) - dt) <= 0) { P.blastT = rand(.35, .8); for (let i = 0; i < 8; i++) { const x = (26 + Math.random() * 8) * DS, y = (16 + Math.random() * 9) * DS; if (Math.hypot(x - P.x, y - P.y) > 64 && !solidAtPt(x, y)) { explode(x, y); break; } } }
    if ('go'.includes(here)) win(); else if (P.escape <= 0) { explode(P.x, P.y); hurtPlayer(999); }
  }
  for (const m of logLines) m.life -= dt; while (logLines.length && logLines[0].life <= 0) logLines.shift();
}

// ---------- render ----------
const scene = document.getElementById('scene'), R = AutomatesRenderer(scene, SIZE, GW, GH);
if (R) { R.setLightMap(LMU8, LW); R.setFarMap(FARM, LW); R.setGround(GROUND, 2 * WV); }
const cubeBuf = new Float32Array(4096 * 8), smokeBuf = new Float32Array(512 * 8), cellBuf = new Uint8Array(GW * GH * 4);
const FLOOR_SHINE = { z: .5, m: .8, r: .15, b: .12, w: .45, o: .1, i: .6 };           // how polished each floor is
// small particles are drawn as instanced cubes: size, r, g, b, glow
const PARTICLE = { a_casing: [.42, .86, .68, .24, 0], a_hull: [.6, .72, .13, .1, 0], a_sparkle: [.4, 1, .95, .7, 1], a_ember: [.36, 1, .55, .17, 1], a_oil: [.55, .09, .07, .055, 0], a_bit: [.7, .88, .73, .27, 0], a_hole: [.6, .05, .045, .04, 0], a_smoke: [1.5, 1, .68, .25, 1] };
function render(now) {
  if (!R) { $('stats').textContent = 'This needs WebGL 2, which this browser does not offer.'; return; }
  const cine = state === 'title' ? titleCam(now / 1000) : null, own = cine && { x: P.x, y: P.y, z: P.z, yaw: P.yaw, pitch: P.pitch }; if (cine) Object.assign(P, cine);   // on the title screen the view is the camera's, not yours
  const W = scene.width, H = scene.height, sh = P.shake || 0, time = now / 1000, fxv = Math.cos(P.yaw), fyv = Math.sin(P.yaw);
  const pace = Math.min(1.4, P.speed / 170), stride = Math.abs(Math.cos(P.bob)), sideStep = Math.sin(P.bob) * .26 * pace;   // the head dips as each foot lands and swings a little from side to side
  const lunge = Math.sin(Math.PI * P.lunge) * 2.4;                                                        // the boot goes in: the view lurches forward
  const eye = { x: P.x + fxv * lunge + (Math.random() - .5) * sh - fyv * sideStep, y: P.y + fyv * lunge + (Math.random() - .5) * sh + fxv * sideStep, yaw: P.yaw + (Math.random() - .5) * sh * .012,
    z: FP.eye + P.z + (.5 - stride) * .55 * pace - (P.dipT > 0 ? Math.sin(Math.PI * (1 - P.dipT / .3)) * .5 : 0), pitch: P.pitch + P.punch + (Math.random() - .5) * sh * .012 };
  if (thingsDirty) bakeThings();
  for (let cy = 0, i = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++, i += 4) {                       // what blocks light this frame (doors open and close), and how shiny each floor is
    const t = tile(cx, cy), d = t === 'D' ? doorAt(cx, cy) : null;
    cellBuf[i] = d ? (d.open < .5 ? 255 : 0) : t === 'H' || isFloor(t) ? 0 : 255; cellBuf[i + 1] = (FLOOR_SHINE[d ? d.floor : t] || 0) * 255; cellBuf[i + 2] = FLOOR_L[i >> 2]; cellBuf[i + 3] = CEIL_L[i >> 2];
  }
  let budget = 10;                                                     // rebuild the wall blocks that were hit, a few per frame so a burst of fire never stalls the picture
  for (const p of damaged) { if (!p.todo.size) continue; const w = p.m.W, nx = w / BLK;
    for (const i of p.todo) { if (budget-- <= 0) break; if (p.blocks[i]) R.free(p.blocks[i]); const bx = i % nx, bz = i / nx | 0; p.blocks[i] = panelMesh('own', { w, h: p.m.H, c: p.own.c }, 0, p.m.L, p.own.dep, [bx * BLK, bx * BLK + BLK, bz * BLK, bz * BLK + BLK]); p.todo.delete(i); }
    p.ready = p.blocks.every(Boolean); }
  R.setCells(cellBuf); R.begin(eye, FP.focal * (1 - .06 * P.sprint), FP.near, FP.far);   // the view widens a little at a sprint
  for (let l = 0; l < LEVELS.length; l++) if (LEVELS[l] > -20) R.ground(LEVELS[l], 1, l);
  R.ground(WH, -1, 0); if (LEVEL === 1) R.ground(LOWC, -1, 1);
  let n = 0, nc = 0, ns = 0; const lod = R.fast ? .55 : 1;                   // with lighter graphics, the fine detail gives way to the coarse nearer the eye
  const vis = (x, y, r) => { const ex = x - P.x, ey = y - P.y, f = ex * fxv + ey * fyv; return f > -r && f < FP.far + r && Math.abs(ey * fxv - ex * fyv) < f * 0.9 + r + 8; };
  const draw = (name, x, y, rot, lift, flash) => { if (!vis(x, y, 14)) return; const d = MODEL_DEFS[name], t = tintOf(name); if (t) R.tint(t[0], t[1], t[2]); R.draw(mesh(name), M4(x, y, lift || 0, rot), d.o ? d.o.vox : 1, flash); if (t) R.tint(); n++; };
  const cube = (k, x, y, z) => { if (nc >= 4096 || !vis(x, y, 2)) return; cubeBuf.set([x, y, z, k[0], k[1], k[2], k[3], k[4]], nc++ * 8); };
  for (const p of panels) if ((P.x - p.x) * p.nx + (P.y - p.y) * p.ny > 0 && vis(p.x, p.y, 12)) { const d2 = (P.x - p.x) ** 2 + (P.y - p.y) ** 2, far = p.far && d2 > (170 * lod) ** 2; if (!far && p.ready) for (const b of p.blocks) R.draw(b, p.M, 1 / WPU); else if (far) R.draw(p.far, p.M, .5); else if (p.mid && d2 > (64 * lod) ** 2) R.draw(p.mid, p.M, 2 / WPU); else R.draw(p.m, p.M, p.vox || 1 / WPU); n++; }   // only the sides that face the player; coarse ones in the distance
  for (const p of posts) if (vis(p.x, p.y, 2)) { R.draw(p.m, p.M, 1 / WPU); n++; }
  for (const e of extras) if (vis(e.x, e.y, e.r)) { R.draw(e.far && (P.x - e.x) ** 2 + (P.y - e.y) ** 2 > ((e.near || 150) * lod) ** 2 ? e.far : e.m, e.M, e.vox || VOX); n++; }                        // the track and the vault
  for (const h of hedges) if (vis(h.x, h.y, 14)) { R.draw(mesh('hedge'), h.M, VOX); n++; }
  for (const d of doors) { const name = d.key === 'secret' ? 'a_door_secret_' + (d.floor === 'k' ? 'W' : d.floor.toUpperCase()) : d.key ? 'a_door_' + d.key : 'a_door'; for (const sg of [-1, 1]) { const o = sg * (8 + d.open * 15); draw(name, d.x + (d.vertical ? o : 0), d.y + (d.vertical ? 0 : o), d.vertical ? 0 : Math.PI / 2, d.z); } }   // the two leaves slide apart into the walls
  for (const d of decor) if (!d.gone) { if (d.swing && vis(d.x, d.y, 8)) { R.draw(mesh(d.model), M4(d.x, d.y, d.lift, d.rot, Math.sin(time * 1.4 + d.x * .3) * .09, d.swing), VOX); n++; } else draw(d.model, d.x, d.y, d.rot, (d.lift || 0) + (d.z || 0)); }
  for (const it of items) draw(PICK[it.kind].model, it.x, it.y, now * 0.002, (it.z || 0) + 3 + Math.sin(now * 0.004 + it.x) * 1.2);
  for (const e of enemies) if ((!e.dead || e.dying) && vis(e.x, e.y, 14)) {   // a destroyed machine is only wreckage now, unless it is still falling over
    { const t = KIND[e.type].tint || [1, 1, 1]; R.tint(t[0], t[1], t[2], e.dead ? 0 : .06); }
    const rot = e.yaw - Math.PI / 2, fl = e.flash > 0 ? 0.8 : 0, lift = e.z + e.hop + (e.fly ? e.fly + Math.sin(e.t * 3) * 1.5 : 0), rig = RIG[e.type];
    const hurt = e.hp < e.hp0 * .34 ? '_d2' : e.hp < e.hp0 * .67 ? '_d1' : '', walk = e.awake && e.moving && !e.dead, rushing = e.rush ? (e.rush.go ? 1 : 1 - e.rush.wind / .95) : e.jump ? 1 : 0;
    const charge = e.wind > 0 ? 1 - e.wind / WIND : 0, lean = (e.atk > 0 ? .1 * e.atk / .22 : 0) + Math.min(.4, e.stun * 1.3) - charge * .1 - rushing * .32 + (e.fly ? Math.sin(e.t * 2.3) * .1 : walk ? -.05 : 0);   // rocked back by its own recoil or by a hit; leaning into its stride
    if (!rig) { if (!e.awake) draw(e.type + '_i', e.x, e.y, rot, lift, fl); else { R.draw(mesh(`${e.type}_${e.atk > 0 ? 'fire' : 'aim'}${hurt}`), M4(e.x, e.y, lift, rot, lean, 4), VOX, fl); n++; } }
    else {
      const ph = e.t * 8, fall = e.dying ? Math.min(1.5, (e.dying / .5) ** 2 * 1.5) : 0;
      const base = mmul(M4(e.x, e.y, lift + (walk ? Math.abs(Math.sin(ph)) * .3 : 0), rot), mRX(fall)), body = mmul(mmul(base, about(0, 0, rig.hip, mRX(lean))), mRZ(e.twist));   // struck on one side, it twists away from the blow
      R.draw(mesh(`${e.type}_torso${hurt}`), body, VOX, fl);
      R.draw(mesh(e.type + '_head'), mmul(body, about(0, 0, rig.neck, mmul(mRZ(e.awake ? 0 : Math.sin(e.t * .7) * .55), mRX(e.nod * .55)))), VOX, fl);   // an idle machine looks about; an alerted one stares at you; a shot to the head snaps it back   // an idle machine looks about; an alerted one stares at you
      if (e.shield) R.draw(mesh('a_shield'), mmul(body, mT(rig.ax[1] * .35, MODEL_DEFS[e.type + '_torso'].L * VOX / 2 + 1.3, rig.knee * .7)), VOX, fl);   // carried in front, on its left arm
      for (const i of [0, 1]) {
        const sd = i ? 'r' : 'l', p = ph + i * Math.PI;
        const thigh = mmul(base, about(0, 0, rig.hip, mRX(walk ? Math.sin(p) * .55 : 0)));                                    // the leg swings from the hip and folds at the knee as it comes forward
        R.draw(mesh(`${e.type}_${sd}t`), thigh, VOX, fl); R.draw(mesh(`${e.type}_${sd}s`), mmul(thigh, about(0, 0, rig.knee, mRX(walk ? -Math.max(0, .1 + .6 * Math.cos(p)) : 0))), VOX, fl);
        if (!e.arm[i]) continue;
        const kick = e.atk > 0 ? e.atk / .22 : 0, up = e.aim * 1.15 + kick * .12 + charge * .1 - (e.stun > 0 ? .5 * e.aim : 0) + (walk ? Math.sin(p + Math.PI) * .25 * (1 - e.aim) : 0);   // the arm rises from the shoulder and swings inwards until the gun points down its line of sight
        const upper = mmul(body, about(rig.ax[i], 0, rig.sh, mmul(mRZ((i ? 1 : -1) * e.aim * Math.PI / 4), mRX(up))));
        R.draw(mesh(`${e.type}_${sd}u`), upper, VOX, fl); R.draw(mesh(`${e.type}_${sd}f`), mmul(upper, about(rig.ex[i], 0, rig.elbow, mRX(.1 + e.aim * .32 + kick * .3))), VOX, fl);
      }
      n += 10;
    }
    R.tint();
    if (charge) cube([.5 + charge * 1.2, 1, .5 + charge * .3, .15 + charge * .2, 1], e.x + Math.cos(e.yaw) * (e.r + 3), e.y + Math.sin(e.yaw) * (e.r + 3), e.z + 8 + (e.fly || 0));   // the charge building at the muzzle
    if (e.rush && !e.rush.go) cube([1 + rushing * 2.2, 1, .2, .12, 1], e.x + Math.cos(e.yaw) * e.r, e.y + Math.sin(e.yaw) * e.r, e.z + 19);   // the furnace in its chest flares before it charges
    if (hurt && Math.random() < (hurt === '_d2' ? .25 : .08)) sparks(e.x, e.y, lift + rand(8, 14), 1);                // a damaged machine spits sparks
  }
  if (train.x < TRAIN_END) for (let i = 0; i < CARS; i++) { const x = train.x + i * 31; if (x > 20 && x < 492) draw('a_train', x, TRAIN_Y, 0, -PIT + .8); }   // three carriages, hidden while they are inside the tunnels
  for (const d of debris) { const k = PARTICLE[d.model]; if (k) cube(k, d.x, d.y, d.lift); else if (d.tip) { if (vis(d.x, d.y, 14)) { const t = tintOf(d.model); if (t) R.tint(t[0], t[1], t[2]); else R.tint(); R.draw(mesh(d.model), M4(d.x, d.y, d.lift + 1.5, d.rot, d.tip * 1.5, d.base + 1.5), VOX); n++; } } else draw(d.model, d.x, d.y, d.rot, d.lift); }
  R.tint();
  for (const b of brass) cube(PARTICLE[b.model], b.x, b.y, b.lift);
  for (const s of shots) draw(s.model, s.x, s.y, Math.atan2(s.vy, s.vx) - Math.PI / 2, s.lift);
  for (const p of fx) {
    const k = p.k || PARTICLE[p.model];
    if (k) cube(k, p.x, p.y, p.lift);
    else if (p.model[2] === 'p' && p.model[3] === 'u') { if (ns < 512 && vis(p.x, p.y, 6)) { const l = lightAt(p.x, p.y), a = 1 - p.t / p.life; smokeBuf.set([p.x, p.y, p.lift + 2, (p.sz || (p.model === 'a_puff2' ? 6 : 4)) + p.t * 5, (p.steam ? .9 : .55) * l[0] + .12, (p.steam ? .9 : .53) * l[1] + .12, (p.steam ? .92 : .5) * l[2] + .12, (p.steam ? .35 : .6) * a * (p.al || 1)], ns++ * 8); } }   // puffs of smoke
    else if (p.tip) { if (vis(p.x, p.y, 14)) { R.draw(mesh(p.model), M4(p.x, p.y, p.lift + 1.5, p.a, p.tip * 1.5 * Math.min(1, p.t * 2.5), p.base + 1.5), VOX); n++; } }   // a falling part tips over as it goes
    else draw(p.model, p.x, p.y, p.rot != null ? p.rot : p.a, p.lift);
  }
  R.cubes(cubeBuf, nc);
  // the weapon is drawn last, in front of everything, so it never pokes into walls
  if (!P.dead && (state === 'play' || state === 'pause')) {
    R.front(true);
    const w = WEAPONS[P.weapon], g = MODEL_DEFS[w.gun], len = g.L * GUN_VOX, hgt = g.H * GUN_VOX, k = P.kick * KICK[P.weapon], yaw = P.yaw - Math.PI / 2 + .1;
    // it is held in the view, so it tips up and down with it: a shear that follows the eye's pitch
    const tip = [1, 0, eye.pitch * Math.cos(eye.yaw), 0, 0, 1, eye.pitch * Math.sin(eye.yaw), 0, 0, 0, 1, 0, 0, 0, -eye.pitch * (eye.x * Math.cos(eye.yaw) + eye.y * Math.sin(eye.yaw)), 1];
    const put = (f, side, z) => [eye.x + fxv * f - fyv * side, eye.y + fyv * f + fxv * side, z], rl = P.reload > 0 ? Math.sin(Math.PI * (1 - P.reload / RELOAD[P.weapon])) : 0;   // rl: how far through a reload
    const bobz = stride * .2 * pace, sway = Math.sin(P.bob) * .2 * pace - sideStep, rear = 4.3 - k * 1.25, drop = eye.z - 1.15 * (H / W) / .5625 - hgt + k * .22 + bobz + GUN_UP - (P.swap > 0 ? P.swap * 9 : 0) - P.sprint * .8 - rl * 2.6 - P.lunge * 1.4;   // it kicks back and up when fired, bobs with your stride, dips while you change weapon, and drops a little at a sprint
    const gp = put(rear + len / 2, 2.3 + sway, drop), hp = put(rear + len * HAND[0] + HAND[1], 2.3 + sway + HAND[2], drop + HAND[3]);
    R.draw(mesh('v_hand'), mmul(tip, M4(hp[0], hp[1], hp[2], yaw, k * .2 + HAND[4], 0, 3)), GUN_VOX);                                // the hand on the grip
    R.draw(mesh(w.gun), mmul(tip, M4(gp[0], gp[1], gp[2], yaw + rl * .5, k * .2 + rl * .7, 0, -len / 2)), GUN_VOX);   // tipped up and across while it is reloaded
    if (P.flash > 0 && P.weapon !== 3) { const fp = put(rear + len + .4, 2.3 + sway - .35, drop + hgt * .6); R.draw(mesh('w_flash'), mmul(tip, M4(fp[0], fp[1], fp[2], yaw)), .3); }
  }
  // the lights that matter this frame: flashes first, then the nearest lamps
  const ls = flashes.map(f => { const k = f.I * (1 - f.t / f.life); return [f.x, f.y, f.z, f.R, f.col[0] * k, f.col[1] * k, f.col[2] * k, 0]; });
  for (const s of shots.slice(0, 3)) ls.push([s.x, s.y, s.lift, 30, 1, .75, .35, 0]);
  for (const e of enemies) if (e.wind > 0 && !e.dead && ls.length < 8) { const q = 1 - e.wind / WIND; ls.push([e.x + Math.cos(e.yaw) * (e.r + 3), e.y + Math.sin(e.yaw) * (e.r + 3), e.z + 8 + (e.fly || 0), 46, 1.5 * q, .7 * q, .25 * q, 0]); }
  if (train.x < TRAIN_END && train.x > -150) ls.push([train.x + CARS * 31 + 6, TRAIN_Y, 4, 130, 2.2, 2, 1.5, .1]);                 // its headlamp sweeps the station
  const near = [], other = ls.splice(0);
  const dim = 1 - .9 * Math.min(1, darkT / 1.5), ldt = Math.min(.05, Math.max(0, time - lampT)), fwx = Math.cos(P.yaw), fwy = Math.sin(P.yaw); lampT = time;
  // Every lamp's light is in the far map. The ones that matter most to this view are lit in full instead (shadows, shine, beams),
  // each fading between the two as it enters or leaves the set, so nothing pops as you walk.
  for (const l of lights) { const d = Math.hypot(l.x - P.x, l.y - P.y), Q = l.R * 1.5; if (d > Q + 260 && !(l.w > 0)) { l.bw = 0; continue; }
    const seen = canSee(P.x, P.y, l.x, l.y), behind = d > Q * .6 && (l.x - P.x) * fwx + (l.y - P.y) * fwy < -.3 * d;
    near.push([d > Q + 260 ? 1e9 : (d + 20) * (seen ? 1 : 2.4) * (behind ? 1.7 : 1) * (l.w > .5 ? .85 : 1), l, seen]); }
  near.sort((a, b) => a[0] - b[0]);
  let beams = 0;
  near.forEach(([s, l, seen], i) => { const want = i < 16 && s < 1e9 ? 1 : 0; l.w = Math.max(0, Math.min(1, (l.w || 0) + (want ? 3 : -3) * ldt));
    const beam = want && seen && !l.off && beams < 3 ? (beams++, 1) : 0; l.bw = Math.max(0, Math.min(1, (l.bw || 0) + (beam ? 2.5 : -2.5) * ldt)); });
  const lit = near.filter(n => n[1].w > .004).sort((a, b) => b[1].w - a[1].w); for (const n of lit.splice(MAXLAMP)) n[1].w = n[1].bw = 0;
  for (const [, l] of lit) {
    const k = l.off ? 0 : l.I * 1.55 * l.w * (l.flick ? .9 + .1 * Math.sin(time * 9 + l.x) * Math.sin(time * 5.3 + l.y) + (Math.sin(time * 1.7 + l.x * 3) > .985 ? -.15 : 0) : 1) * (l.flick ? dim : 1);   // lanterns gutter
    const b = l.I * FARK * l.w;
    ls.push([l.x, l.y, l.z, l.R * 1.5, l.col[0] * k, l.col[1] * k, l.col[2] * k, l.air * l.bw, l.col[0] * b, l.col[1] * b, l.col[2] * b]);
  }
  for (const o of other) if (ls.length < 24) ls.push(o);                    // flashes, shots and the train's lamp take the slots that are left: there are always six
  const bodies = [];
  for (const e of enemies) if (!e.dead) bodies.push([Math.hypot(e.x - P.x, e.y - P.y), e.x, e.y, e.r * 1.05, e.z + (e.fly || 0) + (RIG[e.type] ? RIG[e.type].H : MODEL_DEFS[e.type + '_i'].H) * VOX]);
  if (R.fast) for (const d of decor) if (!d.gone && d.solid && d.r >= 2) bodies.push([Math.hypot(d.x - P.x, d.y - P.y), d.x, d.y, Math.min(d.r, 6), MODEL_DEFS[d.model].H * (MODEL_DEFS[d.model].o ? MODEL_DEFS[d.model].o.vox : 1)]);   // (with full lighting the furniture casts its true shadow instead)
  bodies.sort((a, b) => a[0] - b[0]);
  R.end({ lights: ls, bodies: bodies.slice(0, 10).map(b => b.slice(1)), fog: [.04, .035, .05, 120], sky: LEVEL === 2 || 'go'.includes(tile(Math.floor(P.x / CS), Math.floor(P.y / CS))), time, dim: (.25 + .75 * dim) * (P.escape ? .7 + .3 * Math.sin(time * 13) : 1), smoke: smokeBuf, smokeCount: ns, grade: (g => { for (let i = 0; i < 4; i++) grade[i] += (g[i] - grade[i]) * .04; return grade; })(P.escape ? [1.25, .92, .85, 1.15] : GRADE[ROOM_OF[tile(Math.floor(P.x / CS), Math.floor(P.y / CS))]] || [1, 1, 1, 1]) });
  if (own) Object.assign(P, own);
  if (P.escape) $('cap').textContent = `ÉVACUEZ · 0:${String(Math.max(0, Math.ceil(P.escape))).padStart(2, '0')}`; else if (state !== 'intro' && $('cap').textContent) $('cap').textContent = '';
  $('stats').textContent = `${n} draws, ${Math.round(R.stats.tris / 1000)}k triangles.`;
  // status bar
  const w = WEAPONS[P.weapon];
  $('ammo').textContent = P.reload > 0 ? '···' : `${P.mag[P.weapon]}/${Math.max(0, P.ammo[w.ammo] - P.mag[P.weapon])}`; $('nades').textContent = P.grenades;
  { const b = enemies.find(e => e.boss && e.awake && !e.dead), el = $('boss'); el.style.display = b && state === 'play' ? 'block' : 'none'; if (b) el.firstElementChild.style.width = Math.max(0, b.hp / b.hp0 * 100) + '%'; } $('health').textContent = Math.ceil(P.hp); $('armour').textContent = Math.ceil(P.armour); $('wname').textContent = w.name;
  $('kb').style.background = P.keys.blue ? '#4a8aff' : '#2a221b'; $('kr').style.background = P.keys.red ? '#ff4a4a' : '#2a221b';
  { const h = $('hit'); h.style.opacity = P.hitT > 0 ? Math.min(1, P.hitT / .1) : 0; h.style.color = P.hitKill ? '#ff5a3a' : '#fff'; h.style.transform = `translate(-50%,-50%) rotate(45deg) scale(${(P.hitKill ? 1.5 : 1) + P.hitT * 2})`;   // the mark that a shot went home
    const arcs = $('dmg').children; for (let i = 0; i < arcs.length; i++) { const hh = P.hits[i]; arcs[i].style.opacity = hh ? Math.min(1, hh.t * 1.6) : 0; if (hh) arcs[i].style.transform = `rotate(${wrap(hh.a - P.yaw)}rad)`; } }   // and where a hit on you came from
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
const HELP = '<p class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move &middot; you run; <kbd>Shift</kbd> sprints &middot; mouse to look and fire &middot; right button or <kbd>X</kbd> the gun&rsquo;s other trigger &middot; <kbd>R</kbd> reload &middot; <kbd>F</kbd> kick &middot; <kbd>G</kbd> grenade &middot; <kbd>1</kbd>&ndash;<kbd>4</kbd> weapons &middot; <kbd>M</kbd> mute &middot; <kbd>L</kbd> lighter graphics. Doors open when you walk up to them; a wall that looks wrong may open to a kick.</p>';
const TALLY = () => { const t = Math.round(stats.time), pc = (a, b) => b ? Math.round(100 * a / b) + '%' : '—'; return `<p class="tally">Machines <b>${pc(stats.kills, stats.total)}</b> &middot; Secrets <b>${stats.secretsTotal ? stats.secrets + ' / ' + stats.secretsTotal : '—'}</b> &middot; Time <b>${t / 60 | 0}:${String(t % 60).padStart(2, '0')}</b></p>`; };
function showScreen() {
  const el = $('screen'), t = Math.round(stats.time), mm = `${t / 60 | 0}:${String(t % 60).padStart(2, '0')}`;
  el.style.display = state === 'play' || state === 'intro' ? 'none' : 'flex'; document.body.classList.toggle('cine', state === 'title' || state === 'intro');
  el.innerHTML = state === 'title' ? (LEVEL === 1 ? `<h2>LES AUTOMATES</h2><p><b>Paris, 1934.</b> Baron Mécanique's clockwork gendarmes have marched out of his château and into the Métro. You are the only inspector still on duty.</p><p>Find the <b>blue</b> and <b>red</b> keys, cross the catacombs, the wine cellar and the château, and pull the lever in his workshop.</p><p><b>Click or tap to start</b></p>${HELP}`
      : `<h2>LES TOITS</h2><p>The workshop is gone, but the Baron's signal mast is still calling his machines in across the rooftops.</p><p>Cross the roofs, hold the last one, and throw the switch in the mooring house.</p><p><b>Click or tap to start</b></p>${HELP}`)
    : state === 'dead' ? `<h2>VOUS ÊTES MORT</h2><p>The automates march on. ${stats.kills} of ${stats.total} destroyed.</p><p><b>Click, tap or press R to try again</b></p>`
    : state === 'won' ? (LEVEL === 1 ? `<h2>DEHORS&nbsp;!</h2><p>The workshop goes up behind you. But over the rooftops a mast is still blinking, and the lanterns are gathering round it.</p>${TALLY()}<p><b>Click or tap to climb to the rooftops</b></p>`
      : `<h2>VIVE LA RÉPUBLIQUE&nbsp;!</h2><p>The mast goes dark and every automate in Paris winds down.</p>${TALLY()}<p><b>Click or tap to play again from the Métro</b></p>`)
    : `<h2>PAUSE</h2><p><b>Click or tap to continue</b></p>${HELP}`;
}

// ---------- input + loop ----------
state = 'title'; reset(); showScreen();
const start = () => {
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); snd = Sound(audio).music({ explore: 'music/explore.mp3', combat: 'music/combat.mp3' }); } catch (e) { audio = snd = null; } }
  if (state === 'won') { location.search = LEVEL === 1 ? '?level=2' : ''; return; }                       // on to the next level, or back to the first
  if (state === 'intro') return endIntro();
  if (state === 'title' && LEVEL === 1) { state = 'intro'; introT = 0; showScreen(); sfx('train', { x: P.x + 60, y: P.y + 90 }); return; }
  if (state !== 'play') { if (state !== 'pause') reset(); state = 'play'; showScreen(); }
};
const lock = () => { if (scene.requestPointerLock && matchMedia('(pointer:fine)').matches) { try { const p = scene.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ } } };
$('screen').addEventListener('click', () => { start(); lock(); });
scene.addEventListener('mousedown', e => { if (state === 'intro') return endIntro(); if (state !== 'play') return; if (document.pointerLockElement !== scene) lock(); if (e.button === 0) keys.fire = true; if (e.button === 2) keys.alt2 = true; });
addEventListener('mouseup', e => { if (e.button === 2) keys.alt2 = false; else keys.fire = false; });
scene.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (document.pointerLockElement === scene && state === 'play') { P.yaw += e.movementX * 0.0026; P.pitch = Math.max(-.85, Math.min(.85, P.pitch - e.movementY * 0.0026)); } });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== scene && state === 'play' && matchMedia('(pointer:fine)').matches) { state = 'pause'; showScreen(); keys.fire = false; } });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (state === 'intro' && (k === ' ' || k === 'enter' || k === 'escape')) return endIntro();
  if (k === 'r' && !e.repeat && (state === 'dead' || state === 'won')) { reset(); state = 'play'; showScreen(); return; }   // R restarts once it is over; in a fight it reloads
  if (k === 'l' && !e.repeat && R) { R.fast = !R.fast; return; }
  if (k === 'm' && !e.repeat) { muted = !muted; if (snd) snd.mute(muted); return; }
  if (k >= '1' && k <= '4' && P.has[+k - 1] && P.weapon !== +k - 1) { P.weapon = +k - 1; P.swap = .14; P.reload = 0; sfx('swap'); }
  keys[k] = true; if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
{ let drag = null;                                                    // touch: drag the view to turn
  scene.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { drag = [e.clientX, e.clientY]; start(); } });
  scene.addEventListener('pointermove', e => { if (drag != null && e.pointerType !== 'mouse') { P.yaw += (e.clientX - drag[0]) * 0.008; P.pitch = Math.max(-.85, Math.min(.85, P.pitch - (e.clientY - drag[1]) * 0.004)); drag = [e.clientX, e.clientY]; } });
  ['pointerup', 'pointercancel'].forEach(t => scene.addEventListener(t, () => drag = null)); }
document.querySelectorAll('#touch button').forEach(b => {
  const set = on => e => { e.preventDefault(); b.classList.toggle('down', on); if (b.dataset.k === 'next') { if (on) { let i = P.weapon; do i = (i + 1) % 4; while (!P.has[i]); P.weapon = i; P.reload = 0; } } else keys[b.dataset.k] = on; if (on) start(); };
  b.addEventListener('pointerdown', set(true)); ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, set(false))); b.addEventListener('contextmenu', e => e.preventDefault());
});
const warm = Object.keys(MODEL_DEFS).filter(n => /^(automate|scaphandre|colosse|lanterne|sauteur|garde|a_|w_)/.test(n));
let last = performance.now(), frames = 0, since = last, spent = 0, slow = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t0 = performance.now(); last = now;
  if (state === 'intro') runIntro(dt); else if (freeze > 0) freeze -= dt; else if (state === 'play') update(dt);
  if (warm.length) mesh(warm.pop());                                 // build the models a frame at a time, so none is first built in the middle of a fight
  render(now);
  frames++; spent += performance.now() - t0;
  if (dt < .045 && document.visibilityState === 'visible') slow = slow * .97 + dt * 1000 * .03;   // a hidden or throttled tab says nothing about the machine
  if (R && !R.fast && slow > 26 && state === 'play') { R.fast = true; say('Lighter lighting switched on to keep the game smooth (G toggles it).'); }   // drop the beams and reflections on a machine that cannot keep up
  if (now - since >= 500) { $('fps').textContent = `${Math.round(frames * 1000 / (now - since))} fps · ${(spent / frames).toFixed(1)} ms`; frames = 0; spent = 0; since = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.AUTOMATES = { set lamps(v) { MAXLAMP = v; }, get P() { return P; }, get enemies() { return enemies; }, get items() { return items; }, get decor() { return decor; }, get state() { return state; }, set state(v) { state = v; showScreen(); }, get stats() { return stats; },
  doors, tiles, tile, update, render, reset, fire, hurtEnemy, hurtPlayer, heightAt, spawnEnemy, boot, lob, reload, win, runIntro, LEVEL, ENC, get enc() { return enc; }, get lights() { return lights; }, C, CS, canSee, panels, extras, start, train, R, HAND, get fx() { return fx; }, get brass() { return brass; } };
}
{ const img = new Image(); img.onload = () => main(img); img.src = ART.png; }                // the art atlas has to be decoded before anything can be built
