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
// wall decoration, placed by hand: posters, station signs and sconces, wine racks, paintings, windows, pipework and machinery
const place = (t, base, list) => { for (const [x, y] of list) if (tiles[y][x] === base) tiles[y][x] = t; };
place('P', 'M', [[2, 25], [6, 25], [10, 25], [14, 25], [3, 30], [11, 30]]); place('N', 'M', [[4, 25], [12, 25], [7, 30]]);
place('L', 'M', [[6, 16], [10, 16], [6, 21], [10, 21], [4, 17], [12, 20], [7, 23], [9, 22]]);
place('V', 'B', [[17, 23], [19, 23], [21, 23], [23, 23], [17, 13], [18, 13], [22, 13], [23, 13], [25, 15], [25, 17], [25, 19], [25, 21]]);
place('F', 'W', [[20, 5], [15, 7], [15, 11], [18, 13], [22, 13], [15, 2], [25, 2], [18, 0], [22, 0]]);
place('X', 'S', [[27, 3], [29, 3], [31, 3], [33, 3], [34, 5], [34, 7], [34, 11], [34, 13], [27, 15], [33, 15]]);
place('G', 'I', [[27, 15], [33, 15], [34, 18], [34, 22], [28, 25], [32, 25]]); place('T', 'I', [[34, 20], [26, 25], [34, 24]]); place('Y', 'I', [[28, 15], [32, 15], [34, 16], [33, 25]]);
const FLOORS = 'mrcbwkgoiD', isFloor = t => FLOORS.includes(t);
const tile = (cx, cy) => cx < 0 || cy < 0 || cx >= GW || cy >= GH ? ' ' : tiles[cy][cx];
const doorAt = (cx, cy) => doors.find(d => d.cx === cx && d.cy === cy);
for (const d of doors) { d.vertical = !isFloor(tile(d.cx - 1, d.cy)); d.floor = d.vertical ? tile(d.cx, d.cy - 1) : tile(d.cx - 1, d.cy); d.x = d.cx * CS + 8; d.y = d.cy * CS + 8; }
// solid for movement and bullets: walls, and doors that are not open enough
const solidCell = (cx, cy) => { const t = tile(cx, cy); if (t === 'D') return doorAt(cx, cy).open < 0.7; return !isFloor(t); };
const PIT = 5, inPit = (x, y) => tile(Math.floor(x / CS), Math.floor(y / CS)) === 'r';              // the track bed lies below the platform: seen and shot across, never walked on
const vaulted = (cx, cy) => { const t = tile(cx, cy); return (t === 'r' || t === 'm') && cy >= 26 && cy <= 29; };   // the platform hall has a barrel vault instead of a flat ceiling
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
    col[z * w + x] = shade(c[z * w + x], Math.max(.6, 1 - occ * .045));
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
const WALL_BASE = { P: 'M', N: 'M', L: 'M', V: 'B', F: 'W', X: 'S', G: 'I', T: 'I', Y: 'I' };              // a variant falls back to its plain wall until its sheet exists
const wallSprite = (t, mir) => sprite(ART.rects['wall_' + t] ? 'wall_' + t : 'wall_' + (WALL_BASE[t] || t), WV, HV, WALL_FLIP !== !!mir);
const TUNNEL = { '0,28': 1, '0,29': 0, '15,28': 0, '15,29': 1 };                      // which half of the tunnel-mouth picture each end cell of the track shows
const tunnelSprite = half => { const s = sprite('tunnel', 2 * WV, HV + PIT * WPU, WALL_FLIP), c = new Int32Array(WV * s.h); for (let z = 0; z < s.h; z++) for (let x = 0; x < WV; x++) c[z * WV + x] = s.c[z * s.w + x + half * WV]; return { name: 'tunnel' + half, w: WV, h: s.h, c }; };
const PANEL = {}, panelFor = (t, flat) => PANEL[t + flat] || (PANEL[t + flat] = t[0] === 'U' ? panelMesh('panel_' + t, tunnelSprite(+t[1]), 0, THICK) : panelMesh(`panel_${t}_${flat}`, wallSprite(t.replace('~', ''), t[1] === '~'), flat, THICK));
const FAR = {}, farFor = t => FAR[t] || (FAR[t] = panelMesh('far_' + t, sprite(wallSprite(t).name, CS * 2, WH * 2, WALL_FLIP), 1, 2));   // a coarse flat panel for distant walls
const POST = {}, postFor = t => POST[t] || (POST[t] = (s => buildMesh({ name: 'post_' + t, W: THICK, L: THICK, H: HV, fn: (x, y, z) => shade(s.c[z * WV + x], .9) }))(wallSprite(WALL_BASE[t] || t)));
const opens = (cx, cy) => { const t = tile(cx, cy); return isFloor(t) || t === 'H'; };
const panels = [], posts = [], hedges = [], extras = [];
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
  const t = tile(cx, cy), x = cx * CS + 8, y = cy * CS + 8, tun = TUNNEL[cx + ',' + cy];
  if (t === 'H') { hedges.push({ x, y }); continue; }
  if (t === ' ' || isFloor(t)) continue;
  for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (opens(cx + sx, cy + sy))               // beside a door the panel stays flat so the door closes without gaps
    panels.push(tun != null ? { m: panelFor('U' + tun, 0), x: x + sx * 8, y: y + sy * 8, rot: Math.atan2(-sx, sy), nx: sx, ny: sy, lift: -PIT }
      : { m: panelFor(((cx + cy) & 1) && t !== 'N' && t !== 'P' ? t + '~' : t, tile(cx + sx, cy + sy) === 'D' ? 1 : 0), far: farFor(t), x: x + sx * 8, y: y + sy * 8, rot: Math.atan2(-sx, sy), nx: sx, ny: sy, lift: 0 });
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) if (opens(cx + sx, cy + sy) && !opens(cx + sx, cy) && !opens(cx, cy + sy))   // inside corners get a post
    posts.push({ m: postFor(t), x: x + sx * 7.45, y: y + sy * 7.45 });      // a hair inside the cell, for the same reason
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
model('hedge', CS * VPU, CS * VPU, 52, (x, y, z) => { const n = noise3(x >> 1, y >> 1, z >> 1), m = noise3(x, y, z); return shade(n > .7 ? 0x3f9a3e : n > .3 ? 0x2f8a3c : 0x236e30, (z > 49 ? 1.15 : .8 + z / 260) * (m > .8 ? 1.12 : m < .15 ? .85 : 1)); });

// Walls can be shot to pieces: a panel that is hit gets its own copy of the picture and depth map, with a crater cut into it.
const damaged = [], BLK = 32;                                                 // a damaged panel is drawn as a grid of 32-voxel blocks, so a hit only rebuilds the block it lands in
const restore = p => { if (p.blocks) for (const b of p.blocks) if (b) R.free(b); p.own = p.blocks = p.todo = null; p.ready = false; };
function chip(p, u, z, r) {                                                   // u along the wall and z up, in voxels
  if (!p.far) return 0;
  const w = p.m.W, h = p.m.H, nx = w / BLK, nb = nx * h / BLK;
  if (!p.own) { p.own = { c: Int32Array.from(p.m.src.c), dep: Uint8Array.from(p.m.dep) }; p.blocks = new Array(nb).fill(null); p.todo = new Set(p.blocks.keys()); damaged.push(p); if (damaged.length > 60) restore(damaged.shift()); }
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

// ---------- floors and ceilings: each reference picture covers 2 x 2 cells ----------
const floorTex = mkCanvas(SIZE * WPU, SIZE * WPU), ceilTex = mkCanvas(SIZE * WPU, SIZE * WPU), lowTex = mkCanvas(SIZE * WPU, SIZE * WPU), LOW = 19;   // lowTex: the catacombs' ceiling, lower than the rest
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
    if (t === 'H') { blit(fg, 'floor_lawn', cx, cy); continue; }                                        // hedges stand on the lawn, under the sky
    if (!isFloor(t)) {
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([sx, sy]) => 'goH'.includes(tile(cx + sx, cy + sy)) || vaulted(cx + sx, cy + sy));
      fg.fillStyle = cg.fillStyle = '#14110f'; fg.fillRect(cx * WV, cy * WV, WV, WV); if (!open) cg.fillRect(cx * WV, cy * WV, WV, WV); continue;
    }   // dark under and over the walls, so a recessed wall never shows a gap
    if (t !== 'r') blit(fg, 'floor_' + FLOOR_ART[t], cx, cy);                                           // the track bed is real geometry, further down
    const X = cx * WV, Y = cy * WV;
    if (t === 'm' && tile(cx, cy + 1) === 'r') { fg.fillStyle = '#f2f1ea'; fg.fillRect(X, Y + WV - 28, WV, 28); fg.fillStyle = '#24406e'; fg.fillRect(X, Y + WV - 36, WV, 8); }   // platform edge
    if (t === 'k') for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (tile(cx + sx, cy + sy) !== 'k') {                                                        // carpet border
      const band = (o, wd, colr) => { fg.fillStyle = colr; if (sx) fg.fillRect(sx > 0 ? X + WV - o - wd : X + o, Y, wd, WV); else fg.fillRect(X, sy > 0 ? Y + WV - o - wd : Y + o, WV, wd); };
      band(0, 6, '#5e1218'); band(6, 12, '#c9a23a');
    }
    if (CEIL_ART[t] && !vaulted(cx, cy)) blit(t === 'c' ? lowTex.getContext('2d') : cg, 'ceil_' + CEIL_ART[t], cx, cy);                                             // grass and paths are under open sky
  }
}

// ---------- the Metro hall: a sunken track with real rails, and a tiled barrel vault ----------
// a mesh straight from quads: [[four corners as x, y, z in voxels], colour, normal]
const meshOf = (name, quads, W, L, H) => {
  const v = [];
  for (const [p, k, nm = [0, 0, 1]] of quads) for (const i of [0, 1, 2, 0, 2, 3]) v.push(p[i][0] - W / 2, p[i][1] - L / 2, 0, p[i][2], (k >> 16 & 255) / 255 + (k & GLOW ? 2 : 0), (k >> 8 & 255) / 255 + (k & SHINY ? 2 : 0), (k & 255) / 255, nm[0], nm[1], nm[2]);
  return { name, W, L, H, data: new Float32Array(v), count: v.length / 10, top: new Float32Array(0), topCount: 0 };
};
function trackMesh(half) {                                                    // the rail picture raised into relief: rails stand proud of the sleepers, sleepers of the ballast
  const s = sprite('floor_rails', 128, 128), W = 64, L = 128, q = [];
  const col = (x, y) => s.c[(127 - y) * 128 + x + half * 64];
  const hgt = (x, y) => { const k = col(x, y), r = k >> 16 & 255, g = k >> 8 & 255, b = k & 255; return Math.abs(r - g) < 26 && Math.abs(g - b) < 30 && r + g + b > 420 ? 3 : r > b * 1.5 && r > 90 && g < r * .75 ? 1 : 0; };
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < W;) { let e = x + 1; const k = col(x, y), h = hgt(x, y); while (e < W && col(e, y) === k && hgt(e, y) === h) e++; q.push([[[x, y, h], [e, y, h], [e, y + 1, h], [x, y + 1, h]], k]); x = e; }
    for (let x = 0; x < W; x++) {
      const h = hgt(x, y), hx = x < W - 1 ? hgt(x + 1, y) : h, hy = y < L - 1 ? hgt(x, y + 1) : h;
      if (hx !== h) q.push([[[x + 1, y, Math.min(h, hx)], [x + 1, y + 1, Math.min(h, hx)], [x + 1, y + 1, Math.max(h, hx)], [x + 1, y, Math.max(h, hx)]], shade(h > hx ? col(x, y) : col(x + 1, y), .7), [h > hx ? 1 : -1, 0, 0]]);
      if (hy !== h) q.push([[[x, y + 1, Math.min(h, hy)], [x + 1, y + 1, Math.min(h, hy)], [x + 1, y + 1, Math.max(h, hy)], [x, y + 1, Math.max(h, hy)]], shade(h > hy ? col(x, y) : col(x, y + 1), .7), [0, h > hy ? 1 : -1, 0]]);
    }
  }
  return meshOf('track' + half, q, W, L, 4);
}
const SPRING = 19 * VPU, RISE = 9 * VPU, vaultAt = j => Math.round(SPRING + RISE * Math.sqrt(Math.max(0, 1 - ((j + .5 - 128) / 128) ** 2)));   // the vault's height across the hall, in voxels
function vaultMesh(bay) {                                                     // one 16-unit length of vault; `bay` lifts it clear of the door in the north wall
  const s = sprite('vault', 64, 32), W = 64, L = 256, q = [], hv = j => bay && j < 36 ? Math.max(vaultAt(j), WH * VPU) : vaultAt(j);
  const rowOf = (row, plane, nm) => { for (let x = 0; x < W;) { let e = x + 1; const k = s.c[(row % 32) * 64 + x]; while (e < W && s.c[(row % 32) * 64 + e] === k) e++; q.push([plane(x, e), k, nm]); x = e; } };
  let row = 0;
  for (let j = 0; j < L; j++) {
    const h = hv(j), n = j < L - 1 ? hv(j + 1) : h;
    rowOf(row++, (x, e) => [[x, j, h], [e, j, h], [e, j + 1, h], [x, j + 1, h]], [0, 0, -1]);                                   // the underside faces down, the risers face the middle of the hall
    for (let z = Math.min(h, n); z < Math.max(h, n); z++) rowOf(row++, (x, e) => [[x, j + 1, z], [e, j + 1, z], [e, j + 1, z + 1], [x, j + 1, z + 1]], [0, n > h ? 1 : -1, 0]);
    if (bay && j < 36 && vaultAt(j) < h) for (const X of [0, W]) q.push([[[X, j, vaultAt(j)], [X, j + 1, vaultAt(j)], [X, j + 1, h], [X, j, h]], SHINY | 0xdedcd2, [X ? -1 : 1, 0, 0]]);   // the cheeks of the door bay
  }
  return meshOf('vault' + (bay ? 1 : 0), q, W, L, SPRING + RISE);
}
function lunetteMesh(dir) {                                                      // the tiled wall above the tunnel mouth, up to the vault
  const s = sprite('vault', 64, 32), q = [];
  for (let z = WH * VPU; z < SPRING + RISE; z++) for (let j = 0; j < 256; j++) if (vaultAt(j) > z) q.push([[[32, j, z], [32, j + 1, z], [32, j + 1, z + 1], [32, j, z + 1]], s.c[(z % 32) * 64 + j % 64], [dir, 0, 0]]);
  return meshOf('lunette' + dir, q, 64, 256, SPRING + RISE);
}
{ const track = [trackMesh(0), trackMesh(1)], vault = [vaultMesh(false), vaultMesh(true)];
  let x0 = 99, x1 = 0, y0 = 99, y1 = 0;
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (vaulted(cx, cy)) { x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); }
  const mid = (y0 + y1 + 1) / 2 * CS;                                         // the vault spans the hall from wall to wall; the track is its southern half
  for (let cx = x0; cx <= x1; cx++) {
    extras.push({ m: track[cx & 1], x: cx * CS + 8, y: (y1) * CS, lift: -PIT, r: 20 });
    extras.push({ m: vault[tile(cx, y0 - 1) === 'D' ? 1 : 0], x: cx * CS + 8, y: mid, lift: 0, r: 40 });
  }
  extras.push({ m: lunetteMesh(1), x: x0 * CS - 8, y: mid, lift: 0, r: 40 }, { m: lunetteMesh(-1), x: (x1 + 1) * CS - 8, y: mid, lift: 0, r: 40 });
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
for (const [n, legs] of [['automate', .4], ['scaphandre', .36], ['colosse', .36]]) {
  const { W, L, H, c } = voxels(n), hip = Math.round(H * legs), mid = W >> 1;
  const filled = (x, z) => { for (let y = 0; y < L; y++) if (c[x + W * (y + L * z)] >= 0) return true; return false; };
  let xl = W * .3 | 0, xr = W * .7 | 0, best = 0;                              // the torso's width: the widest the middle of the outline gets while the arms still hang clear of it
  for (let z = hip + 1; z < H * .8; z++) {
    let a = mid, b = mid, runs = 0, on = false; if (!filled(mid, z)) continue;
    while (a > 0 && filled(a - 1, z)) a--; while (b < W - 1 && filled(b + 1, z)) b++;
    for (let x = 0; x < W; x++) { const f = filled(x, z); if (f && !on) runs++; on = f; }
    if (runs >= 3 && b - a > best) { best = b - a; xl = a; xr = b; }
  }
  const partOf = (x, z) => z < hip * .6 ? (x < mid ? 'll' : 'lr') : x < xl ? 'al' : x > xr ? 'ar' : z < hip ? (x < mid ? 'll' : 'lr') : 'torso';
  let sh = hip; for (let z = hip; z < H; z++) for (const x of [xl - 1, xr + 1]) if (x >= 0 && x < W && filled(x, z)) sh = z;   // the shoulders: the highest the arms reach
  const only = k => (x, y, z) => { const v = c[x + W * (y + L * z)]; return v >= 0 && partOf(x, z) === k ? v : null; };
  for (const k of ['torso', 'al', 'ar', 'll', 'lr']) model(`${n}_${k}`, W, L, H, only(k));
  for (const d of [1, 2]) model(`${n}_torso_d${d}`, W, L, H, battered(only('torso'), d));
  RIG[n] = { H, hip: hip * VOX, sh: (sh - 2) * VOX, ax: [(xl - W / 2) * VOX, (xr + 1 - W / 2) * VOX], gun: n === 'automate' ? [0] : [0, 1] };   // gun: which arms it fires with
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
box('a_door', sprite('door', CS * VPU, WH * VPU), 16); box('a_door_red', sprite('door_red', CS * VPU, WH * VPU), 16); box('a_door_blue', sprite('door_blue', CS * VPU, WH * VPU), 16);
box('a_key_red', sprite('key_red'), 3); box('a_key_blue', sprite('key_blue'), 3); box('a_baguette', sprite('baguette'), 10);
for (const n of ['bullets', 'shells', 'cells']) { const s = sprite(n); box('a_' + n, s, Math.round(s.w * .7)); }
{ const s = sprite('helmet'), m = inflate(s, Math.round(s.w * .8), { round: 1.2 }); model('a_helmet', m.W, m.L, m.H, m.fn(0)); }
lathe('a_wine', sprite('wine')); lathe('a_lamp', sprite('lamp')); lathe('a_drum', sprite('drum')); lathe('a_column', sprite('column'));
box('a_cask', sprite('cask'), 44); lathe('a_table', sprite('table')); box('a_exit', sprite('exit'), 28);
lathe('a_chandelier', sprite('chandelier')); box('a_arch', sprite('arch', WV / 2 + 4), 8); box('a_rack', sprite('rack'), 40); box('a_workbench', sprite('workbench'), 16); box('a_train', sprite('train'), 36);
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
model('a_pool', 28, 28, 1, blot(14, 0x120e0b, 0x3a3128)); model('a_scorch', 44, 44, 1, blot(22, 0x0c0a09, 0x1e1a17)); model('a_hole', 2, 2, 2, () => 0x0e0c0b, .3);
for (const n of ['a_shot', 'a_spark', 'a_shell', 'a_bolt']) { const d = MODEL_DEFS[n], f = d.fn; d.fn = (x, y, z) => { const c = f(x, y, z); return c == null ? null : c | GLOW; }; }   // shots make their own light
// weapons are relief cards cut from the first-person sheet: always seen from behind, exactly as drawn
const WEAPON_VOX = 0.085;
for (const n of ['w_pistol', 'w_shotgun', 'w_smg', 'w_tesla']) { const m = inflate(sprite(n, 0, 0, SPRITE_FLIP), 8, { even: true }); model(n, m.W, m.L, m.H, m.fn(0), WEAPON_VOX); }
model('w_flash', 7, 4, 7, (x, y, z) => Math.abs(x - 3) + Math.abs(z - 3) < 4 - y * 0.6 ? (Math.abs(x - 3) + Math.abs(z - 3) < 2 ? GLOW | 0xffffff : GLOW | 0xffcf5c) : null, 0.3);
const MESH = {}, mesh = n => MESH[n] || (MESH[n] = buildMesh(MODEL_DEFS[n]));

// ---------- things in the level ----------
const C = (cx, cy, ox = 0, oy = 0) => ({ x: cx * CS + 8 + ox, y: cy * CS + 8 + oy });
// ---------- light: every lamp is placed by hand, and its light is baked into the floors, ceilings and walls ----------
const WARM = [1, .88, .62], AMBER = [1, .68, .38], COLD = [.45, .9, 1];
const FIX = [];                                                              // lamps: a model, where it stands or what height it hangs from, and the light it gives
for (let cx = 2; cx <= 14; cx += 2) FIX.push({ model: 'a_hang', x: cx * CS, y: 28 * CS, hang: (SPRING + RISE) * VOX, z: (SPRING + RISE) * VOX - 6, R: 66, I: .45, col: WARM });
for (const [cx, cy] of [[7, 4], [8, 7], [2, 8], [8, 14], [5, 12], [11, 9], [4, 2], [10, 4]]) FIX.push({ model: 'a_lantern', ...C(cx, cy), hang: LOW, z: LOW - 5, R: 50, I: .8, col: AMBER, flick: 1 });
for (const [cx, cy] of [[18, 18], [22, 18], [20, 15], [20, 21], [14, 18], [2, 18]]) FIX.push({ model: 'a_lantern', ...C(cx, cy), hang: WH, z: WH - 5, R: 56, I: .9, col: AMBER, flick: 1 });
for (const [cx, cy] of [[20, 9], [18, 3], [22, 3]]) FIX.push({ model: 'a_chandelier', x: cx * CS + 8, y: cy * CS + 8, hang: WH, z: WH - 8, R: 80, I: .55, col: WARM });
for (const [cx, cy, ox] of [[26, 9, -4], [33, 9, 4], [28, 5, 0], [32, 13, 0]]) FIX.push({ model: 'a_lamp', ...C(cx, cy, ox, -5), z: 16, R: 58, I: .85, col: WARM });
const lights = FIX.map(f => ({ x: f.x, y: f.y, z: f.z, R: f.R, I: f.I, col: f.col, flick: f.flick, air: 1 }));
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {            // sconces, lit windows and Tesla tubes on the walls
  const t = tile(cx, cy), k = { L: [40, .65, WARM], X: [38, .5, WARM], T: [42, .6, COLD], Y: [42, .5, COLD] }[t];
  if (k) for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isFloor(tile(cx + sx, cy + sy))) lights.push({ x: cx * CS + 8 + sx * 11, y: cy * CS + 8 + sy * 11, z: 13, R: k[0], I: k[1], col: k[2], air: .5 });
}
for (let j = 1; j < GH; j += 2) for (let i = 1; i < GW; i += 2) {            // the lamps painted on the flat ceilings sit where four cells meet
  const c = [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]].find(([a, b]) => 'wki'.includes(tile(a, b)) || (tile(a, b) === 'm' && !vaulted(a, b)));
  if (c) lights.push({ x: i * CS + (c[0] < i ? -1 : 1), y: j * CS + (c[1] < j ? -1 : 1), z: WH - 3, R: 60, I: .28, col: WARM, air: .5 });
}
const AMBIENT = { m: [.36, .38, .44], r: [.26, .27, .32], c: [.27, .23, .2], b: [.25, .21, .19], w: [.42, .38, .34], k: [.42, .38, .34], g: [.5, .46, .62], o: [.5, .46, .62], i: [.3, .32, .37] };
const LS = 2, LW = SIZE / LS, LM = new Float32Array(LW * LW * 3);            // the light map: one sample every two units
{ const ok = new Uint8Array(LW * LW);
  for (let gy = 0; gy < LW; gy++) for (let gx = 0; gx < LW; gx++) {
    const x = gx * LS + 1, y = gy * LS + 1, cx = x >> 4, cy = y >> 4; let t = tile(cx, cy); if (t === 'D') t = doorAt(cx, cy).floor;
    if (!isFloor(t)) continue;
    const a = AMBIENT[t], i = (gy * LW + gx) * 3; let r = a[0], g = a[1], b = a[2];
    for (const l of lights) { const d = Math.hypot(l.x - x, l.y - y); if (d < l.R && canSee(l.x, l.y, x, y)) { const k = l.I * (1 - d / l.R) ** 1.5 * .3; r += l.col[0] * k; g += l.col[1] * k; b += l.col[2] * k; } }
    LM[i] = Math.min(1.08, r); LM[i + 1] = Math.min(1.08, g); LM[i + 2] = Math.min(1.08, b); ok[gy * LW + gx] = 1;
  }
  for (let pass = 0; pass < 4; pass++) { const add = [];                       // spread the light a little way into the walls so smoothing does not pull darkness out of them
    for (let gy = 1; gy < LW - 1; gy++) for (let gx = 1; gx < LW - 1; gx++) if (!ok[gy * LW + gx]) { let n = 0, r = 0, g = 0, b = 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (gy + dy) * LW + gx + dx; if (ok[j]) { n++; r += LM[j * 3]; g += LM[j * 3 + 1]; b += LM[j * 3 + 2]; } } if (n) add.push([gy * LW + gx, r / n, g / n, b / n]); }
    for (const [j, r, g, b] of add) { LM[j * 3] = r; LM[j * 3 + 1] = g; LM[j * 3 + 2] = b; ok[j] = 1; } }
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
for (const p of panels) p.M = M4(p.x, p.y, p.lift, p.rot);
for (const p of posts) p.M = M4(p.x, p.y, 0, 0);
for (const e of extras) e.M = M4(e.x, e.y, e.lift, 0);
for (const h of hedges) h.M = M4(h.x, h.y, 0, 0);
const train = { x: -400, next: 14, sounded: false };                           // a train comes through the station every so often
const steamers = [];                                                         // pipework that vents steam
for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (tile(cx, cy) === 'G') for (const [sx, sy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isFloor(tile(cx + sx, cy + sy))) steamers.push({ x: cx * CS + 8 + sx * 9, y: cy * CS + 8 + sy * 9, t: Math.random() * 6 });
const flashes = [];                                                          // short-lived lights: muzzle flashes, explosions
const flashAt = (x, y, z, R, I, col, life) => { flashes.push({ x, y, z, R, I, col, t: 0, life }); if (flashes.length > 8) flashes.shift(); };

const ENEMY = {
  automate: { hp: 30, speed: 40, r: 5, range: 220, rate: 1.9, dmg: 6, shots: 1, shot: 'a_shot', score: 1 },
  lanterne: { hp: 18, speed: 62, r: 4, range: 180, rate: 1.0, dmg: 5, shots: 1, shot: 'a_spark', fly: 7, score: 1 },
  scaphandre: { hp: 150, speed: 27, r: 7, range: 240, rate: 2.1, dmg: 11, shots: 3, shot: 'a_shell', score: 1 },
  colosse: { hp: 1100, speed: 30, r: 9, range: 300, rate: 1.3, dmg: 12, shots: 5, shot: 'a_shell', boss: true, score: 1 },
};
const WEAPONS = [
  { name: 'PISTOLET', model: 'w_pistol', ammo: 'bullets', rate: .30, dmg: 13, pellets: 1, spread: .012, off: [13, 4.3, -1.55] },
  { name: 'FUSIL DE CHASSE', model: 'w_shotgun', ammo: 'shells', rate: .85, dmg: 9, pellets: 8, spread: .1, off: [13, 4.0, -1.75] },
  { name: 'MITRAILLETTE', model: 'w_smg', ammo: 'bullets', rate: .085, dmg: 10, pellets: 1, spread: .04, off: [13, 4.2, -1.75] },
  { name: 'ARC TESLA', model: 'w_tesla', ammo: 'cells', rate: .14, dmg: 34, pellets: 1, spread: 0, pierce: true, off: [13, 4.2, -1.75] },
];
let enemies, items, decor, shots, fx, debris, P, state, flow, flowT, logLines, stats;
const say = t => { logLines.push({ t, life: 3.2 }); if (logLines.length > 3) logLines.shift(); };
function reset() {
  enemies = []; items = []; decor = []; shots = []; fx = []; debris = []; logLines = [];
  for (const d of doors) { d.open = 0; d.hold = 0; d.unlocked = !d.key; }
  for (const p of damaged.splice(0)) restore(p);                                                         // the walls are whole again
  const E = (type, cx, cy, ox, oy) => enemies.push({ type, ...C(cx, cy, ox, oy), ...ENEMY[type], hp0: ENEMY[type].hp, arm: [1, 1], aim: 0, yaw: 0, awake: false, cool: 1 + rnd(), t: rnd() * 5, seeT: rnd() * .2, see: false, flash: 0, atk: 0, strafe: rnd() < .5 ? 1 : -1 });
  const I = (kind, cx, cy, ox, oy) => items.push({ kind, ...C(cx, cy, ox, oy) });
  const D = (model, cx, cy, ox = 0, oy = 0, o = {}) => decor.push({ model, ...C(cx, cy, ox, oy), r: 4, solid: true, rot: 0, ...o });
  for (const f of FIX) decor.push({ model: f.model, x: f.x, y: f.y, r: 2, solid: !f.hang, rot: 0, lift: f.hang ? f.hang - MODEL_DEFS[f.model].H * VOX : 0, swing: f.flick ? MODEL_DEFS[f.model].H * VOX : 0 });   // hanging lamps are out of reach; lanterns sway on their chains
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) if (tile(cx, cy) === 'c') {             // an arch across each stretch of catacomb tunnel
    const ew = !isFloor(tile(cx - 1, cy)) && !isFloor(tile(cx + 1, cy)), ns = !isFloor(tile(cx, cy - 1)) && !isFloor(tile(cx, cy + 1));
    if (ew !== ns) decor.push({ model: 'a_arch', x: cx * CS + 8, y: cy * CS + 8, r: 0, solid: false, rot: ew ? 0 : Math.PI / 2 });
  }
  // Metro
  E('automate', 10, 26); E('automate', 13, 27); I('bullets', 6, 27); I('baguette', 12, 27); D('a_crate', 14, 26, 2, -2);
  for (const cx of [3, 5, 11, 13]) D('a_bench', cx, 26, 0, -5, { r: 5 }); D('a_bin', 7, 26, 4, -5, { r: 2 }); D('a_bin', 9, 26, -4, -5, { r: 2 }); D('a_signal', 1, 27, -4, 6, { r: 1.5 }); D('a_signal', 14, 27, 4, 6, { r: 1.5 });
  E('automate', 6, 18); E('automate', 10, 19); I('baguette', 11, 17); D('a_bench', 8, 20, 12, 5, { r: 5 });
  I('shotgun', 2, 17); I('shells', 1, 20); I('shells', 3, 20); E('automate', 2, 19); D('a_crate', 1, 16); D('a_crate', 3, 16, 0, 0, { rot: .4 });
  // catacombs
  E('automate', 8, 13); E('lanterne', 5, 12); E('automate', 2, 9); E('lanterne', 2, 6); E('automate', 4, 2); E('automate', 6, 3); E('lanterne', 6, 8); E('automate', 11, 8);
  I('key_blue', 3, 1); I('baguette', 7, 1); I('shells', 5, 9); I('bullets', 8, 10); I('helmet', 10, 4); I('wine', 11, 5);
  // wine cellar
  E('scaphandre', 20, 18); E('automate', 17, 15); E('automate', 23, 21); E('automate', 23, 15); E('lanterne', 20, 21);
  for (const [x, y] of [[16, 14], [24, 14], [16, 22], [24, 22]]) D('a_rack', x, y, 0, y < 18 ? -2 : 2, { r: 7 }); D('a_cask', 19, 14, 0, 0, { r: 6 }); D('a_cask', 21, 22, 0, 0, { r: 6 });
  D('a_workbench', 27, 24, 0, 3, { r: 5 }); D('a_workbench', 2, 16, 0, -4, { r: 5 });
  for (const [x, y] of [[20, 16], [17, 19], [23, 18], [21, 20]]) D('a_drum', x, y, 0, 0, { drum: true, hp: 12 });
  I('bullets', 16, 18); I('baguette', 24, 18); I('shells', 20, 22);
  // chateau
  E('automate', 17, 8); E('automate', 23, 8); E('automate', 20, 7); E('lanterne', 18, 11); E('lanterne', 22, 11); E('scaphandre', 20, 10);
  for (const [x, y] of [[18, 7], [22, 7], [18, 11], [22, 11]]) D('a_column', x, y);
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
  P = { ...C(2, 26), yaw: 0, vx: 0, vy: 0, hp: 100, armour: 0, ammo: { bullets: 50, shells: 0, cells: 0 }, has: [true, false, false, false], weapon: 0, cool: 0, kick: 0, shake: 0, flash: 0, bob: 0, keys: {}, pain: 0, dead: false, grin: 0 };
  stats = { kills: 0, total: enemies.length, time: 0 };
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
const ROOM_OF = { m: 'metro', r: 'metro', c: 'catacombs', b: 'cellar', w: 'chateau', k: 'chateau', g: 'courtyard', o: 'courtyard', i: 'workshop' };
const STEP_ON = { m: 'tile', r: 'stone', c: 'earth', b: 'stone', w: 'wood', k: 'carpet', g: 'grass', o: 'stone', i: 'metal' };

// ---------- helpers ----------
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function rayWall(x, y, a, max) {                                    // distance to the first wall or closed door
  const dx = Math.cos(a), dy = Math.sin(a);
  for (let t = 0; t < max; t += 2) if (solidAtPt(x + dx * t, y + dy * t)) return t;
  return max;
}
function canSee(ax, ay, bx, by) { const d = Math.hypot(bx - ax, by - ay); return rayWall(ax, ay, Math.atan2(by - ay, bx - ax), d) >= d - 2; }
function moveBody(b, dx, dy, r, others) {
  const blocked = (x, y) => boxHits(x, y, r) || inPit(x - r, y - r) || inPit(x + r, y - r) || inPit(x - r, y + r) || inPit(x + r, y + r) || decor.some(d => d.solid && !d.gone && Math.hypot(d.x - x, d.y - y) < d.r + r) || (others && others.some(o => o !== b && !o.dead && Math.hypot(o.x - x, o.y - y) < o.r + r));
  let moved = false;
  if (dx && !blocked(b.x + dx, b.y)) { b.x += dx; moved = true; }
  if (dy && !blocked(b.x, b.y + dy)) { b.y += dy; moved = true; }
  return moved;
}
function computeFlow() {                                            // steps to the player from every cell, through doors enemies can use
  const f = new Int16Array(GW * GH).fill(999), px = Math.floor(P.x / CS), py = Math.floor(P.y / CS), q = [[px, py]]; f[px + py * GW] = 0;
  while (q.length) { const [x, y] = q.shift(), d = f[x + y * GW]; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + a, ny = y + b, t = tile(nx, ny); if (!isFloor(t) || t === 'r' || (t === 'D' && !doorAt(nx, ny).unlocked) || f[nx + ny * GW] <= d + 1) continue; f[nx + ny * GW] = d + 1; q.push([nx, ny]); } }
  return f;
}
// Particles: `g` is gravity, `bounce` lets one skip off the floor, `stay` leaves it lying where it lands.
const rand = (a, b) => a + Math.random() * (b - a);
const spawn = (model, x, y, lift, o) => fx.push({ model, x, y, lift, vx: 0, vy: 0, vz: 0, t: 0, life: .5, a: Math.random() * 6.28, spin: 0, g: 0, ...o });
const litter = (model, x, y, lift = .06) => { debris.push({ model, x, y, lift, rot: Math.random() * 6.28 }); if (debris.length > 220) debris.shift(); };
function burst(x, y, lift, n, model) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, s = rand(20, 70); spawn(model, x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(20, 60), g: 160, life: rand(.35, .65) }); } }
function sparks(x, y, lift, n, dir, spread = 2.6) {                             // a shower of sparks, thrown mostly along `dir`
  for (let i = 0; i < n; i++) { const a = dir == null ? Math.random() * 6.28 : dir + rand(-spread, spread) / 2, s = rand(25, 120); spawn(Math.random() < .65 ? 'a_sparkle' : 'a_ember', x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(-10, 80), g: 240, bounce: true, life: rand(.25, .7) }); }
}
function oil(x, y, lift, n, dir) { for (let i = 0; i < n; i++) { const a = dir + rand(-.7, .7), s = rand(20, 75); spawn('a_oil', x, y, lift, { vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(10, 60), g: 220, life: rand(.4, .8) }); } }
function smoke(x, y, lift, n) { for (let i = 0; i < n; i++) spawn(Math.random() < .5 ? 'a_puff1' : 'a_puff2', x + rand(-3, 3), y + rand(-3, 3), lift + rand(0, 4), { vx: rand(-5, 5), vy: rand(-5, 5), vz: rand(8, 22), life: rand(.6, 1.4), spin: rand(-2, 2) }); }
function wreck(e, fx0, fy0) {                                                   // the machine comes apart: its parts fall, tip over and stay where they land
  const away = Math.atan2(e.y - fy0, e.x - fx0), rx = Math.sin(e.yaw), ry = -Math.cos(e.yaw), rig = RIG[e.type];
  const fling = (name, x, y, lift, o) => { const a = away + rand(-1.3, 1.3), s = rand(20, 95); spawn(name, x, y, lift, { a: e.yaw - Math.PI / 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(25, 95), g: 210, bounce: true, spin: rand(-9, 9), life: rand(1.4, 2.6), stay: true, ...o }); };
  if (rig) { fling(e.type + '_torso_d2', e.x, e.y, 0, { base: rig.hip, tip: 1 }); fling(e.type + '_ll', e.x, e.y, 0, { base: 0, tip: 1 }); fling(e.type + '_lr', e.x, e.y, 0, { base: 0, tip: -1 });
    for (const i of [0, 1]) if (e.arm[i]) fling(`${e.type}_a${i ? 'r' : 'l'}`, e.x, e.y, 0, { base: rig.sh - 5, tip: 1 }); burst(e.x, e.y, rig.hip, 8, 'a_bit'); }
  else for (const g of GIBS[e.type]) fling(g.name, e.x + rx * g.dx, e.y + ry * g.dx, (e.fly || 0) + g.dz);
  sparks(e.x, e.y, 8 + (e.fly || 0), e.boss ? 60 : 26); oil(e.x, e.y, 9 + (e.fly || 0), e.boss ? 30 : 12, away); smoke(e.x, e.y, 4, e.boss ? 12 : 5);
  if (!inPit(e.x, e.y)) litter('a_pool', e.x, e.y);
}
function hurtPlayer(d) {
  if (P.dead) return;
  const soak = Math.min(P.armour, d * 0.5); P.armour -= soak; P.hp -= d - soak; P.pain = Math.min(.6, P.pain + d * 0.03); P.shake = Math.max(P.shake, .5); sfx('hurt');
  if (P.hp <= 0) { P.hp = 0; P.dead = true; state = 'dead'; showScreen(); }
}
function explode(x, y) {
  sfx('boom', { x, y }); burst(x, y, 6, 14, 'a_smoke');
  for (const p of panels) if (p.far && Math.hypot(p.x - x, p.y - y) < 36) for (let i = 0; i < 3; i++) chip(p, rand(10, 118), rand(4, 90), rand(5, 10));   // the blast tears at the walls around it flashAt(x, y, 8, 170, 4.5, AMBER, .5); sparks(x, y, 5, 34); smoke(x, y, 3, 9); litter('a_scorch', x, y, .05);
  P.shake = Math.max(P.shake, 2.2 * Math.max(0, 1 - Math.hypot(P.x - x, P.y - y) / 160));
  for (const e of enemies) if (!e.dead) { const d = Math.hypot(e.x - x, e.y - y); if (d < 46) hurtEnemy(e, 90 * (1 - d / 50), x, y); }
  for (const d of decor) if (d.drum && !d.gone && Math.hypot(d.x - x, d.y - y) < 40) { d.hp = 0; d.fuse = .15; }
  const pd = Math.hypot(P.x - x, P.y - y); if (pd < 46) hurtPlayer(55 * (1 - pd / 50));
}
function hurtEnemy(e, dmg, fx0, fy0) {
  if (e.dead) return;
  const back = Math.atan2(fy0 - e.y, fx0 - e.x), hx = e.x + Math.cos(back) * e.r * .7, hy = e.y + Math.sin(back) * e.r * .7, hz = rand(5, 13) + (e.fly ? e.fly - 4 : 0);   // where the shot struck, on the side facing the gun
  e.hp -= dmg; e.flash = .1; e.awake = true; sparks(hx, hy, hz, 5 + (dmg > 20 ? 5 : 0), back, 1.8); oil(hx, hy, hz, 2, back); burst(hx, hy, hz, 1, 'a_bit');
  if (e.hp > 0) {
    const rig = RIG[e.type], left = e.arm[0] + e.arm[1];
    if (rig && ((left === 2 && e.hp < e.hp0 * .6) || (left === 1 && e.hp < e.hp0 * .28 && !e.boss))) {   // an arm is shot away: it can no longer fire a gun it has lost
      const i = e.arm[0] && e.arm[1] ? (Math.random() < .5 ? 0 : 1) : e.arm[0] ? 0 : 1, a = back + Math.PI + rand(-.9, .9), v = rand(30, 70); e.arm[i] = 0;
      spawn(`${e.type}_a${i ? 'r' : 'l'}`, e.x, e.y, 0, { a: e.yaw - Math.PI / 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(30, 70), g: 210, bounce: true, spin: rand(-6, 6), life: rand(1.2, 2), stay: true, base: rig.sh - 5, tip: 1 });
      sparks(hx, hy, rig.sh, 16); oil(hx, hy, rig.sh, 8, back); sfx('die', e);
      if (!rig.gun.some(g => e.arm[g])) { e.range = 0; e.speed *= 1.6; }                                  // disarmed, it charges
    }
    sfx('hit', e); return;
  }
  e.dead = true; stats.kills++; sfx('die', e); wreck(e, fx0, fy0); P.shake = Math.max(P.shake, e.boss ? 2 : .35);
  const a = Math.atan2(e.y - fy0, e.x - fx0); e.fall = { dx: Math.cos(a), dy: Math.sin(a), a: 0, t: 0 };
  if (e.type === 'automate' && Math.random() < .45) items.push({ kind: 'bullets', x: e.x, y: e.y, small: true });
  if (e.boss) { say('Le Colosse is scrap. Find the lever!'); for (let i = 0; i < 4; i++) setTimeout(() => explode(e.x + (Math.random() - .5) * 20, e.y + (Math.random() - .5) * 20), i * 220); }
}
function fire() {
  const w = WEAPONS[P.weapon];
  if (P.cool > 0 || P.dead) return;
  if (P.ammo[w.ammo] <= 0) { P.cool = .25; sfx('click'); const alt = [3, 2, 1, 0].find(i => P.has[i] && P.ammo[WEAPONS[i].ammo] > 0); if (alt != null) P.weapon = alt; return; }
  P.ammo[w.ammo]--; P.cool = w.rate; P.kick = 1; P.flash = .06; flashAt(P.x + Math.cos(P.yaw) * 7, P.y + Math.sin(P.yaw) * 7, 8, 110, P.weapon === 1 ? 3 : 2.2, P.weapon === 3 ? COLD : WARM, .1); P.shake = Math.max(P.shake, P.weapon === 1 ? .7 : .15); sfx(['pistol', 'shotgun', 'smg', 'tesla'][P.weapon]);
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
    else if (end >= wall) {                                         // the wall is chipped away where the shot lands, and throws out its own rubble
      const ix = P.x + dx * (end - 1.2), iy = P.y + dy * (end - 1.2), iz = FP.eye - 1 + rand(-3.5, 3.5), hit = panelAt(P.x + dx * end, P.y + dy * end, dx, dy);
      sparks(ix, iy, iz, 4, a + Math.PI, 2); smoke(ix, iy, iz, 1);
      const k = hit && chip(hit[0], hit[1], iz * WPU, P.weapon === 3 ? 5 : P.weapon === 1 ? 3 : 3.6);
      if (k) for (let i = 0; i < 5; i++) { const b = a + Math.PI + rand(-1, 1), v = rand(15, 60); spawn('chip', ix, iy, iz, { k: [rand(.3, .7), (k >> 16 & 255) / 255, (k >> 8 & 255) / 255, (k & 255) / 255, 0], vx: Math.cos(b) * v, vy: Math.sin(b) * v, vz: rand(-5, 40), g: 220, bounce: true, life: rand(.8, 1.6) }); }
    }
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
  const here = tile(Math.floor(P.x / CS), Math.floor(P.y / CS)), was = P.bob;
  P.bob += Math.hypot(P.vx, P.vy) * dt * 0.09;
  P.heat = enemies.some(e => !e.dead && e.awake && e.see) ? 4 : Math.max(0, (P.heat || 0) - dt);            // the fight music holds for a few seconds after the last machine loses sight of you
  if (snd) { snd.mood(P.heat > 0); snd.room(ROOM_OF[here === 'D' ? doorAt(Math.floor(P.x / CS), Math.floor(P.y / CS)).floor : here]); if (!muted) { snd.tick(dt); if (Math.floor(P.bob / Math.PI) !== Math.floor(was / Math.PI) && STEP_ON[here]) snd.step(STEP_ON[here], Math.floor(P.bob / Math.PI) & 1 ? .18 : -.18); } }   // a footfall each time the stride lands
 P.cool -= dt; P.kick = Math.max(0, P.kick - dt * 5); P.shake = Math.max(0, P.shake - dt * 4);
  for (let i = flashes.length - 1; i >= 0; i--) if ((flashes[i].t += dt) > flashes[i].life) flashes.splice(i, 1);
  train.next -= dt;                                                                                       // the train: out of one tunnel, through the station, into the other
  if (train.next <= 0) { train.x = -220; train.next = rand(38, 60); train.sounded = false; }
  if (train.x < 620) { train.x += 170 * dt; const near = Math.hypot(P.x - train.x - 50, P.y - 464); if (near < 150) P.shake = Math.max(P.shake, .5 * (1 - near / 150)); if (!train.sounded && train.x > -60) { train.sounded = true; sfx('train', { x: Math.max(40, Math.min(220, P.x)), y: 464 }); } }
  for (const s of steamers) if ((s.t -= dt) < 0) { s.t = rand(3, 8); if (Math.hypot(s.x - P.x, s.y - P.y) < 150) sfx('steam', s); if (Math.hypot(s.x - P.x, s.y - P.y) < 150) for (let i = 0; i < 6; i++) spawn(Math.random() < .5 ? 'a_puff1' : 'a_puff2', s.x, s.y, rand(11, 14), { vx: rand(-4, 4), vy: rand(-4, 4), vz: rand(6, 16), life: rand(.8, 1.6), steam: 1 }); } P.flash -= dt; P.pain = Math.max(0, P.pain - dt * 0.9); P.grin -= dt;
  if (k[' '] || k.control || k.fire) fire();
  // doors slide open for the player (with the right key) and for enemies that are hunting
  for (const d of doors) {
    const near = Math.hypot(P.x - d.x, P.y - d.y) < 22;
    if (near && !d.unlocked) { if (P.keys[d.key]) { d.unlocked = true; say(`The ${d.key} door unlocks.`); } else if (!d.told || stats.time - d.told > 3) { d.told = stats.time; say(`You need the ${d.key} key.`); } }
    const want = d.unlocked && (near || enemies.some(e => e.awake && !e.dead && Math.hypot(e.x - d.x, e.y - d.y) < 20));
    if (want) { if (d.open === 0) sfx('door', d); d.hold = 2.5; }
    d.hold -= dt; const target = d.hold > 0 ? 1 : 0;
    if (target === 0 && d.open > 0 && [P, ...enemies].some(b => !b.dead && Math.hypot(b.x - d.x, b.y - d.y) < 13)) d.hold = .5;   // never close on someone
    else d.open = Math.max(0, Math.min(1, d.open + (target ? 1 : -1) * dt * 2.2));
  }
  flowT -= dt; if (flowT <= 0 || !flow) { flow = computeFlow(); flowT = .3; }
  for (const e of enemies) {
    if (e.dead) continue;
    e.flash -= dt; e.atk -= dt; e.t += dt;
    const dx = P.x - e.x, dy = P.y - e.y, dist = Math.hypot(dx, dy);
    e.seeT -= dt; if (e.seeT <= 0) { e.seeT = .18; e.see = dist < 320 && canSee(e.x, e.y, P.x, P.y); }
    if (!e.awake) { if ((e.see && dist < 260) || dist < 40) { e.awake = true; sfx('wake', e); } else continue; }
    e.yaw = Math.atan2(dy, dx); e.aim += (1 - e.aim) * Math.min(1, dt * 7);                             // the guns come up
    e.cool -= dt;
    if (e.see && dist < e.range && e.cool <= 0 && !P.dead) {         // fire a volley of slow, dodgeable shots
      e.cool = e.rate * (.8 + Math.random() * .5); e.atk = .22; sfx('enemy', e); flashAt(e.x + Math.cos(e.yaw) * (e.r + 3), e.y + Math.sin(e.yaw) * (e.r + 3), 8 + (e.fly || 0), 80, 1.8, WARM, .12);
      const guns = RIG[e.type] ? RIG[e.type].gun.filter(g => e.arm[g]).length / RIG[e.type].gun.length : 1, vol = Math.max(1, Math.round(e.shots * guns));
      for (let i = 0; i < vol; i++) { const a = e.yaw + (i - (vol - 1) / 2) * .16 + (Math.random() - .5) * .08; shots.push({ model: e.shot, x: e.x + Math.cos(a) * (e.r + 3), y: e.y + Math.sin(a) * (e.r + 3), vx: Math.cos(a) * 115, vy: Math.sin(a) * 115, dmg: e.dmg, lift: 7 + (e.fly || 0), t: 0 }); }
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
    e.moving = moveBody(e, mx * e.speed * dt, my * e.speed * dt, e.r, [P, ...enemies]);
    if (dist < e.r + 9 && e.cool < e.rate * .5 && !e.fly) { hurtPlayer(e.boss ? 22 : 10); e.cool = e.rate; }                                   // contact damage
  }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s2 = shots[i]; s2.t += dt; s2.x += s2.vx * dt; s2.y += s2.vy * dt;
    if (solidAtPt(s2.x, s2.y) || s2.t > 5) { sparks(s2.x - s2.vx * dt, s2.y - s2.vy * dt, s2.lift, 4, Math.atan2(-s2.vy, -s2.vx), 2); shots.splice(i, 1); }
    else if (Math.hypot(s2.x - P.x, s2.y - P.y) < 5) { hurtPlayer(s2.dmg); shots.splice(i, 1); }
  }
  for (const d of decor) if (d.fuse != null && !d.gone) { d.fuse -= dt; if (d.fuse <= 0) { d.gone = true; explode(d.x, d.y); } }
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i], nx = p.x + p.vx * dt, ny = p.y + p.vy * dt; p.t += dt;
    if (solidAtPt(nx, ny)) { p.vx *= -.4; p.vy *= -.4; } else { p.x = nx; p.y = ny; }                    // off the walls
    if (p.g && !p.rest) {
      const floor = (inPit(p.x, p.y) ? -PIT : 0) + .1 - (p.base || 0); p.vz -= p.g * dt; p.lift += p.vz * dt;   // `base`: how far above its own origin the part's underside is
      if (p.lift <= floor) { p.lift = floor; if (p.bounce && p.vz < -30) { p.vz *= -.38; p.vx *= .55; p.vy *= .55; p.spin *= .6; } else { p.rest = true; p.vx = p.vy = p.vz = 0; } }
    } else if (!p.g) p.lift += p.vz * dt;
    if (!p.rest) p.a += p.spin * dt;
    if (p.t > p.life) { if (p.stay) { debris.push({ model: p.model, x: p.x, y: p.y, lift: p.lift, rot: p.a, tip: p.tip, base: p.base }); if (debris.length > 220) debris.shift(); } fx.splice(i, 1); }
  }
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
const scene = document.getElementById('scene'), R = AutomatesRenderer(scene, SIZE, GW, GH);
if (R) R.setLightMap(LMU8, LW);
const cubeBuf = new Float32Array(4096 * 8), smokeBuf = new Float32Array(512 * 8), cellBuf = new Uint8Array(GW * GH * 4);
const FLOOR_SHINE = { m: .8, r: .15, b: .12, w: .45, o: .1, i: .6 };           // how polished each floor is
// small particles are drawn as instanced cubes: size, r, g, b, glow
const PARTICLE = { a_sparkle: [.4, 1, .95, .7, 1], a_ember: [.36, 1, .55, .17, 1], a_oil: [.55, .09, .07, .055, 0], a_bit: [.7, .88, .73, .27, 0], a_hole: [.6, .05, .045, .04, 0], a_smoke: [1.5, 1, .68, .25, 1] };
function render(now) {
  if (!R) { $('stats').textContent = 'This needs WebGL 2, which this browser does not offer.'; return; }
  const W = scene.width, H = scene.height, sh = P.shake || 0, time = now / 1000, fxv = Math.cos(P.yaw), fyv = Math.sin(P.yaw);
  const eye = { x: P.x + (Math.random() - .5) * sh, y: P.y + (Math.random() - .5) * sh, yaw: P.yaw + (Math.random() - .5) * sh * .012, z: FP.eye };
  for (let cy = 0, i = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++, i += 4) {                       // what blocks light this frame (doors open and close), and how shiny each floor is
    const t = tile(cx, cy), d = t === 'D' ? doorAt(cx, cy) : null;
    cellBuf[i] = d ? (d.open < .5 ? 255 : 0) : t === 'H' || isFloor(t) ? 0 : 255; cellBuf[i + 1] = (FLOOR_SHINE[d ? d.floor : t] || 0) * 255;
  }
  let budget = 10;                                                     // rebuild the wall blocks that were hit, a few per frame so a burst of fire never stalls the picture
  for (const p of damaged) { if (!p.todo.size) continue; const w = p.m.W, nx = w / BLK;
    for (const i of p.todo) { if (budget-- <= 0) break; if (p.blocks[i]) R.free(p.blocks[i]); const bx = i % nx, bz = i / nx | 0; p.blocks[i] = panelMesh('own', { w, h: p.m.H, c: p.own.c }, 0, p.m.L, p.own.dep, [bx * BLK, bx * BLK + BLK, bz * BLK, bz * BLK + BLK]); p.todo.delete(i); }
    p.ready = p.blocks.every(Boolean); }
  R.setCells(cellBuf); R.begin(eye, FP.focal, FP.near, FP.far);
  R.ground(floorTex, 0, 1); R.ground(ceilTex, WH, -1); R.ground(lowTex, LOW, -1);
  let n = 0, nc = 0, ns = 0;
  const vis = (x, y, r) => { const ex = x - P.x, ey = y - P.y, f = ex * fxv + ey * fyv; return f > -r && f < FP.far + r && Math.abs(ey * fxv - ex * fyv) < f * 0.9 + r + 8; };
  const draw = (name, x, y, rot, lift, flash) => { if (!vis(x, y, 14)) return; const d = MODEL_DEFS[name]; R.draw(mesh(name), M4(x, y, lift || 0, rot), d.o ? d.o.vox : 1, flash); n++; };
  const cube = (k, x, y, z) => { if (nc >= 4096 || !vis(x, y, 2)) return; cubeBuf.set([x, y, z, k[0], k[1], k[2], k[3], k[4]], nc++ * 8); };
  for (const p of panels) if ((P.x - p.x) * p.nx + (P.y - p.y) * p.ny > 0 && vis(p.x, p.y, 12)) { const far = p.far && (P.x - p.x) ** 2 + (P.y - p.y) ** 2 > 130 * 130; if (!far && p.ready) for (const b of p.blocks) R.draw(b, p.M, 1 / WPU); else R.draw(far ? p.far : p.m, p.M, far ? .5 : 1 / WPU); n++; }   // only the sides that face the player; coarse ones in the distance
  for (const p of posts) if (vis(p.x, p.y, 2)) { R.draw(p.m, p.M, 1 / WPU); n++; }
  for (const e of extras) if (vis(e.x, e.y, e.r)) { R.draw(e.m, e.M, VOX); n++; }                        // the track and the vault
  for (const h of hedges) if (vis(h.x, h.y, 14)) { R.draw(mesh('hedge'), h.M, VOX); n++; }
  for (const d of doors) { const s = d.open * 14, name = d.key ? 'a_door_' + d.key : 'a_door'; draw(name, d.x + (d.vertical ? s : 0), d.y + (d.vertical ? 0 : s), d.vertical ? 0 : Math.PI / 2); }
  for (const d of decor) if (!d.gone) { if (d.swing && vis(d.x, d.y, 8)) { R.draw(mesh(d.model), M4(d.x, d.y, d.lift, d.rot, Math.sin(time * 1.4 + d.x * .3) * .09, d.swing), VOX); n++; } else draw(d.model, d.x, d.y, d.rot, d.lift); }
  for (const it of items) draw(PICK[it.kind].model, it.x, it.y, now * 0.002, 3 + Math.sin(now * 0.004 + it.x) * 1.2);
  for (const e of enemies) if (!e.dead && vis(e.x, e.y, 14)) {         // a destroyed machine is only wreckage now
    const rot = e.yaw - Math.PI / 2, fl = e.flash > 0 ? 0.8 : 0, lift = e.fly ? e.fly + Math.sin(e.t * 3) * 1.5 : 0, rig = RIG[e.type];
    const hurt = e.hp < e.hp0 * .34 ? '_d2' : e.hp < e.hp0 * .67 ? '_d1' : '', step = e.awake && e.moving ? Math.sin(e.t * 9) : 0;
    const lean = (e.atk > 0 ? -.14 * e.atk / .22 : 0) + (fl ? -.12 : 0) + (e.fly ? Math.sin(e.t * 2.3) * .1 : step * .03);   // recoil when it fires, a flinch when it is hit
    if (!rig) { if (!e.awake) draw(e.type + '_i', e.x, e.y, rot, lift, fl); else { R.draw(mesh(`${e.type}_${e.atk > 0 ? 'fire' : 'aim'}${hurt}`), M4(e.x, e.y, lift, rot, lean, 4), VOX, fl); n++; } }
    else {
      const base = M4(e.x, e.y, lift + Math.abs(step) * .35, rot), body = mmul(base, about(0, 0, rig.hip, mRX(lean)));
      R.draw(mesh(`${e.type}_torso${hurt}`), body, VOX, fl);
      R.draw(mesh(e.type + '_ll'), mmul(base, about(0, 0, rig.hip, mRX(step * .5))), VOX, fl); R.draw(mesh(e.type + '_lr'), mmul(base, about(0, 0, rig.hip, mRX(-step * .5))), VOX, fl);
      for (const i of [0, 1]) if (e.arm[i]) {                          // an arm: raised from the shoulder and swung inwards until its gun points down the machine's line of sight
        const up = e.aim * 1.5 + (e.atk > 0 ? .25 * e.atk / .22 : 0) - (e.aim < .5 ? step * (i ? .2 : -.2) : 0), R3 = mmul(mRZ((i ? 1 : -1) * e.aim * Math.PI / 4), mRX(up));
        R.draw(mesh(`${e.type}_a${i ? 'r' : 'l'}`), mmul(body, about(rig.ax[i], 0, rig.sh, R3)), VOX, fl);
      }
      n += 5;
    }
    if (hurt && Math.random() < (hurt === '_d2' ? .25 : .08)) sparks(e.x, e.y, lift + rand(8, 14), 1);                // a damaged machine spits sparks
  }
  if (train.x < 620) for (let i = 0; i < 3; i++) { const x = train.x + i * 31; if (x > 4 && x < 252) draw('a_train', x, 464, 0, -PIT + .8); }   // three carriages, hidden while they are inside the tunnels
  for (const d of debris) { const k = PARTICLE[d.model]; if (k) cube(k, d.x, d.y, d.lift); else if (d.tip) { if (vis(d.x, d.y, 14)) { R.draw(mesh(d.model), M4(d.x, d.y, d.lift + 1.5, d.rot, d.tip * 1.5, d.base + 1.5), VOX); n++; } } else draw(d.model, d.x, d.y, d.rot, d.lift); }
  for (const s of shots) draw(s.model, s.x, s.y, Math.atan2(s.vy, s.vx) - Math.PI / 2, s.lift);
  for (const p of fx) {
    const k = p.k || PARTICLE[p.model];
    if (k) cube(k, p.x, p.y, p.lift);
    else if (p.model[2] === 'p' && p.model[3] === 'u') { if (ns < 512 && vis(p.x, p.y, 6)) { const l = lightAt(p.x, p.y), a = 1 - p.t / p.life; smokeBuf.set([p.x, p.y, p.lift + 2, (p.model === 'a_puff2' ? 6 : 4) + p.t * 5, (p.steam ? .9 : .55) * l[0] + .12, (p.steam ? .9 : .53) * l[1] + .12, (p.steam ? .92 : .5) * l[2] + .12, (p.steam ? .35 : .6) * a], ns++ * 8); } }   // puffs of smoke
    else if (p.tip) { if (vis(p.x, p.y, 14)) { R.draw(mesh(p.model), M4(p.x, p.y, p.lift + 1.5, p.a, p.tip * 1.5 * Math.min(1, p.t * 2.5), p.base + 1.5), VOX); n++; } }   // a falling part tips over as it goes
    else draw(p.model, p.x, p.y, p.rot != null ? p.rot : p.a, p.lift);
  }
  R.cubes(cubeBuf, nc);
  // the weapon is drawn last, in front of everything, so it never pokes into walls
  if (!P.dead) {
    R.front(true);
    const w = WEAPONS[P.weapon], sway = Math.sin(P.bob) * 0.7, back = P.kick * 1.2, o = w.off;
    const wx = P.x + fxv * (o[0] - back) - fyv * (o[1] + sway), wy = P.y + fyv * (o[0] - back) + fxv * (o[1] + sway), lift = FP.eye - o[0] * (H / 2 / FP.focal) + o[2] + Math.abs(Math.cos(P.bob)) * 0.5 + P.kick * 0.8;
    R.draw(mesh(w.model), M4(wx, wy, lift, P.yaw - Math.PI / 2), WEAPON_VOX);
    if (P.flash > 0 && P.weapon !== 3) R.draw(mesh('w_flash'), M4(wx + fxv * .6, wy + fyv * .6, lift + MODEL_DEFS[w.model].H * WEAPON_VOX - 1.2, P.yaw - Math.PI / 2), .3);
  }
  // the lights that matter this frame: flashes first, then the nearest lamps
  const ls = flashes.map(f => { const k = f.I * (1 - f.t / f.life); return [f.x, f.y, f.z, f.R, f.col[0] * k, f.col[1] * k, f.col[2] * k, 0]; });
  for (const s of shots.slice(0, 3)) ls.push([s.x, s.y, s.lift, 30, 1, .75, .35, 0]);
  if (train.x < 620 && train.x > -60) ls.push([train.x + 96, 464, 4, 120, 2.2, 2, 1.5, .1]);                 // its headlamp sweeps the station
  const near = [];
  for (const l of lights) { const d = Math.hypot(l.x - P.x, l.y - P.y); if (d < l.R * 1.5 + 200) near.push([d, l]); }
  near.sort((a, b) => a[0] - b[0]);
  for (const [, l] of near) {
    if (ls.length >= 16) break;
    const k = l.I * 1.2 * (l.flick ? .86 + .14 * Math.sin(time * 9 + l.x) * Math.sin(time * 5.3 + l.y) + (Math.sin(time * 1.7 + l.x * 3) > .985 ? -.4 : 0) : 1);   // lanterns gutter
    ls.push([l.x, l.y, l.z, l.R * 1.5, l.col[0] * k, l.col[1] * k, l.col[2] * k, canSee(P.x, P.y, l.x, l.y) ? l.air * .12 : 0]);
  }
  const bodies = [];
  for (const e of enemies) if (!e.dead) bodies.push([Math.hypot(e.x - P.x, e.y - P.y), e.x, e.y, e.r * 1.05, (e.fly || 0) + (RIG[e.type] ? RIG[e.type].H : MODEL_DEFS[e.type + '_i'].H) * VOX]);
  for (const d of decor) if (!d.gone && d.solid && d.r >= 2) bodies.push([Math.hypot(d.x - P.x, d.y - P.y), d.x, d.y, Math.min(d.r, 6), MODEL_DEFS[d.model].H * (MODEL_DEFS[d.model].o ? MODEL_DEFS[d.model].o.vox : 1)]);
  bodies.sort((a, b) => a[0] - b[0]);
  R.end({ lights: ls, bodies: bodies.slice(0, 10).map(b => b.slice(1)), fog: [.04, .035, .05, 80], sky: 'go'.includes(tile(Math.floor(P.x / CS), Math.floor(P.y / CS))), time, smoke: smokeBuf, smokeCount: ns });
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
const HELP = '<p class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move and strafe &middot; mouse or <kbd>&larr;</kbd><kbd>&rarr;</kbd> turn &middot; click or <kbd>Space</kbd> fire &middot; <kbd>1</kbd>&ndash;<kbd>4</kbd> weapons &middot; <kbd>R</kbd> restart &middot; <kbd>M</kbd> mute. Doors open when you walk up to them.</p>';
function showScreen() {
  const el = $('screen'), t = Math.round(stats.time), mm = `${t / 60 | 0}:${String(t % 60).padStart(2, '0')}`;
  el.style.display = state === 'play' ? 'none' : 'flex';
  el.innerHTML = state === 'title' ? `<h2>LES AUTOMATES</h2><p><b>Paris, 1934.</b> Baron Mécanique's clockwork gendarmes have marched out of his château and into the Métro. You are the only inspector still on duty.</p><p>Find the <b>blue</b> and <b>red</b> keys, cross the catacombs, the wine cellar and the château, and pull the lever in his workshop.</p><p><b>Click or tap to start</b></p>${HELP}`
    : state === 'dead' ? `<h2>VOUS ÊTES MORT</h2><p>The automates march on. ${stats.kills} of ${stats.total} destroyed.</p><p><b>Click, tap or press R to try again</b></p>`
    : state === 'won' ? `<h2>VIVE LA RÉPUBLIQUE&nbsp;!</h2><p>The lever drops and every automate in Paris winds down.</p><p>Automates destroyed: <b>${stats.kills} / ${stats.total}</b> &middot; Time: <b>${mm}</b></p><p><b>Click, tap or press R to play again</b></p>`
    : `<h2>PAUSE</h2><p><b>Click or tap to continue</b></p>${HELP}`;
}

// ---------- input + loop ----------
state = 'title'; reset(); showScreen();
const start = () => { if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); snd = Sound(audio).music({ explore: 'music/explore.mp3', combat: 'music/combat.mp3' }); } catch (e) { audio = snd = null; } } if (state !== 'play') { if (state !== 'pause') reset(); state = 'play'; showScreen(); } };
const lock = () => { if (scene.requestPointerLock && matchMedia('(pointer:fine)').matches) { try { const p = scene.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not available */ } } };
$('screen').addEventListener('click', () => { start(); lock(); });
scene.addEventListener('mousedown', e => { if (state !== 'play') return; if (document.pointerLockElement !== scene) lock(); if (e.button === 0) keys.fire = true; });
addEventListener('mouseup', () => keys.fire = false);
addEventListener('mousemove', e => { if (document.pointerLockElement === scene && state === 'play') P.yaw += e.movementX * 0.0026; });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== scene && state === 'play' && matchMedia('(pointer:fine)').matches) { state = 'pause'; showScreen(); keys.fire = false; } });
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'r' && !e.repeat) { reset(); state = 'play'; showScreen(); return; }
  if (k === 'm' && !e.repeat) { muted = !muted; if (snd) snd.mute(muted); return; }
  if (k >= '1' && k <= '4' && P.has[+k - 1] && P.weapon !== +k - 1) { P.weapon = +k - 1; sfx('swap'); }
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
const warm = Object.keys(MODEL_DEFS).filter(n => /^(automate|scaphandre|colosse|lanterne|a_|w_)/.test(n));
let last = performance.now(), frames = 0, since = last, spent = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000), t0 = performance.now(); last = now;
  if (state === 'play') update(dt);
  if (warm.length) mesh(warm.pop());                                 // build the models a frame at a time, so none is first built in the middle of a fight
  render(now);
  frames++; spent += performance.now() - t0;
  if (now - since >= 500) { $('fps').textContent = `${Math.round(frames * 1000 / (now - since))} fps · ${(spent / frames).toFixed(1)} ms`; frames = 0; spent = 0; since = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.AUTOMATES = { get P() { return P; }, get enemies() { return enemies; }, get items() { return items; }, get decor() { return decor; }, get state() { return state; }, set state(v) { state = v; showScreen(); }, get stats() { return stats; },
  doors, tiles, tile, update, render, reset, fire, C, CS, canSee, panels, start, train };
}
{ const img = new Image(); img.onload = () => main(img); img.src = ART.png; }                // the art atlas has to be decoded before anything can be built
