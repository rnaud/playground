'use strict';
// Les Automates: an original first-person voxel shooter set in Paris, 1934. Everything (walls, enemies, weapons,
// pickups) is a voxel model drawn by the shared renderer; the level is a grid of 16-unit cells.
(() => {
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
// wall variety: posters and station signs, wine racks, paintings, windows, pipework
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
  const t = tiles[y][x], h = hash(x * 3, y * 5);
  if (t === 'M' && h < .16) tiles[y][x] = h < .08 ? 'P' : 'N';
  if (t === 'B' && x > 14 && h < .3) tiles[y][x] = 'V';
  if (t === 'W' && h < .22) tiles[y][x] = 'F';
  if (t === 'S' && h < .3) tiles[y][x] = 'X';
  if (t === 'I' && h < .3) tiles[y][x] = 'G';
}
const FLOORS = 'mrcbwkgoiD', isFloor = t => FLOORS.includes(t);
const tile = (cx, cy) => cx < 0 || cy < 0 || cx >= GW || cy >= GH ? ' ' : tiles[cy][cx];
const doorAt = (cx, cy) => doors.find(d => d.cx === cx && d.cy === cy);
for (const d of doors) { d.vertical = !isFloor(tile(d.cx - 1, d.cy)); d.floor = d.vertical ? tile(d.cx, d.cy - 1) : tile(d.cx - 1, d.cy); d.x = d.cx * CS + 8; d.y = d.cy * CS + 8; }
// solid for movement and bullets: walls, and doors that are not open enough
const solidCell = (cx, cy) => { const t = tile(cx, cy); if (t === 'D') return doorAt(cx, cy).open < 0.7; return !isFloor(t); };
const solidAtPt = (x, y) => solidCell(Math.floor(x / CS), Math.floor(y / CS));
const boxHits = (x, y, r) => solidAtPt(x - r, y - r) || solidAtPt(x + r, y - r) || solidAtPt(x - r, y + r) || solidAtPt(x + r, y + r);

// ---------- wall textures: colour as a function of position along the wall (u) and height (z) ----------
const SKULL = [' ###  ', '##### ', '#o#o# ', '##o## ', ' #.#  ', '      '];
function wallColour(t, u, z) {
  const lu = ((u % 16) + 16) % 16, n = noise3(u, z, 3);
  const metro = () => z < 2 ? 0x24406e : z === 14 || z === 15 ? 0x2f5fae : z % 3 === 0 || (u + ((z / 3 | 0) & 1) * 2) % 4 === 0 ? 0xc3cbcd : n > .8 ? 0xe4e8e3 : 0xf2f4f0;
  const stone = () => z % 6 === 0 || (u + (z / 6 | 0) * 4) % 8 === 0 ? 0x857c66 : n > .66 ? 0xc4baa0 : n > .33 ? 0xb7ad92 : 0xa99f85;
  const brick = () => z % 3 === 0 || (u + (z / 3 | 0) * 3) % 6 === 0 ? 0x5e5044 : [0x8a4032, 0x9a4a3a, 0x7c3a2e][noise3((u + (z / 3 | 0) * 3) / 6 | 0, z / 3 | 0, 5) * 3 | 0];
  const panel = () => z < 9 ? (lu % 8 === 0 || z === 0 || z === 8 || ((lu % 8 === 2 || lu % 8 === 6) && z > 1 && z < 7) ? 0x4a2f1a : n > .5 ? 0x6e4a22 : 0x66431e)
    : z === 9 || z === 22 ? 0xd9b23a : z > 22 ? 0xf4ecd8 : (Math.abs((u % 8) - 3.5) + z) % 8 < 1 ? 0xc9a23a : 0xe8dcc0;
  const ashlar = () => z % 4 === 0 || (u + (z / 4 | 0) * 3) % 7 === 0 ? 0x6a6b72 : n > .5 ? 0x9a9ba3 : 0x8d8e96;
  const iron = () => z % 8 === 0 || lu % 8 === 0 ? 0x24272c : (lu % 8 === 1 || lu % 8 === 7) && (z % 8 === 1 || z % 8 === 7) ? 0x8a8f99 : n > .5 ? 0x4a4f58 : 0x41464e;
  switch (t) {
    case 'M': return metro();
    case 'P': if (lu > 2 && lu < 13 && z > 5 && z < 20) { if (lu === 3 || lu === 12 || z === 6 || z === 19) return 0xd9b23a; const band = (Math.abs(lu - 7.5) + (19 - z) * 0.9) | 0; return z < 9 ? 0x1b1b22 : [0xd8363e, 0xffcf5c, 0x2f5fae, 0xf4f1e6][band % 4]; } return metro();
    case 'N': if (lu > 1 && lu < 14 && z > 8 && z < 14) return lu === 2 || lu === 13 || z === 9 || z === 13 || (z === 11 && lu % 2 === 0 && lu > 3 && lu < 12) ? 0xf4f1e6 : 0x1f3f8a; return metro();
    case 'C': return stone();
    case 'K': if (z > 3 && z < 22) { const c = SKULL[5 - ((z - 4) % 6)][((u % 6) + 6) % 6]; return c === '#' ? (n > .5 ? 0xe6dfc8 : 0xd8d0b6) : c === 'o' ? 0x1e1b16 : 0x4a4436; } return stone();   // stacked skulls
    case 'B': return brick();
    case 'V': if (lu > 1 && lu < 14 && z > 1 && z < 18) return lu % 4 === 2 || z % 4 === 2 ? 0x5a3d22 : (lu % 4 === 0 && z % 4 === 0) ? 0x2f6a3a : 0x17120e; return brick();
    case 'W': return panel();
    case 'F': if (lu > 2 && lu < 13 && z > 10 && z < 20) { if (lu === 3 || lu === 12 || z === 11 || z === 19) return 0xd9b23a; return z > 15 ? (lu === 9 && z === 17 ? 0xffe27a : 0x7fb4d8) : z > 13 ? 0x4f8a4a : 0x3d6f3c; } return panel();
    case 'S': return ashlar();
    case 'X': if (lu > 3 && lu < 12 && z > 7 && z < 20) return lu < 6 || lu > 9 ? 0x3f6f9e : z === 13 || z === 8 ? 0x4a3a2a : 0xffe9a0; return ashlar();
    case 'H': return n > .7 ? 0x4fae45 : n > .3 ? 0x2f8a3c : 0x236e30;
    case 'I': return iron();
    case 'G': if (lu === 4 || lu === 5 || lu === 10 || lu === 11) return (z % 6 === 0) ? 0x7a5f18 : lu % 2 ? 0x9a7a22 : 0xc9a23a; if (lu > 5 && lu < 10 && z > 11 && z < 16) return lu + z === 21 || (lu === 8 && z === 13) ? 0xd8363e : 0xf4f1e6; return iron();
  }
  return 0x30303a;
}
// One mesh per 4x4-cell chunk. Only wall cells produce voxels; faces buried inside a wall are never emitted.
const chunks = [];
for (let qy = 0; qy < GH; qy += 4) for (let qx = 0; qx < GW; qx += 4) {
  let any = false;
  for (let y = qy; y < qy + 4; y++) for (let x = qx; x < qx + 4; x++) { const t = tile(x, y); if (t !== ' ' && !isFloor(t)) any = true; }
  if (!any) continue;
  const x0 = qx * CS, y0 = qy * CS;
  const wallAt = (wx, wy, z) => { const t = tile(wx >> 4, wy >> 4); return !isFloor(t) && !(t === 'H' && z >= 13); };
  const m = buildMesh({ name: `chunk${qx}_${qy}`, W: 64, L: 64, H: WH,
    outside: (x, y, z) => z >= WH || (z >= 0 && wallAt(x0 + x, y0 + y, z)) ? 1 : null,                    // no faces under the ceiling or against the next chunk's walls
    fn: (x, y, z) => {
    const wx = x0 + x, wy = y0 + y, cx = wx >> 4, cy = wy >> 4, t = tile(cx, cy);
    if (isFloor(t) || (t === 'H' && z >= 13)) return null;
    if (t === ' ') return 0x30303a;
    const lx = wx & 15, ly = wy & 15;
    if (lx > 0 && lx < 15 && ly > 0 && ly < 15 && z < WH - 1 && t !== 'H') return 0x30303a;            // inside the wall: never seen
    return wallColour(t, lx === 0 || lx === 15 ? wy : wx, z);
  } });
  chunks.push({ m, x: x0 + 32, y: y0 + 32 });
}
// floor and ceiling textures, one pixel per unit
const floorTex = mkCanvas(SIZE, SIZE), ceilTex = mkCanvas(SIZE, SIZE);
{
  const fg = floorTex.getContext('2d'), cg = ceilTex.getContext('2d'), fi = fg.createImageData(SIZE, SIZE), ci = cg.createImageData(SIZE, SIZE);
  const put = (img, x, y, c) => { const i = (y * SIZE + x) * 4; img.data[i] = c >> 16 & 255; img.data[i + 1] = c >> 8 & 255; img.data[i + 2] = c & 255; img.data[i + 3] = 255; };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let t = tile(x >> 4, y >> 4); if (t === 'D') t = doorAt(x >> 4, y >> 4).floor;
    if (!isFloor(t)) continue;
    const lx = x & 15, ly = y & 15, n = noise3(x, y, 9);
    const f = t === 'm' ? ((x % 8 === 0 || y % 8 === 0) ? 0x9aa3a6 : ((x >> 3) + (y >> 3)) & 1 ? 0xd9dedc : 0xc9cfce)
      : t === 'r' ? (ly === 4 || ly === 11 ? 0x8a8f99 : x % 8 < 2 ? 0x4a3a2a : n > .5 ? 0x2c2a2e : 0x242226)
      : t === 'c' ? (n > .97 ? 0xd8d0b6 : n > .5 ? 0x5a4c3a : 0x4f4232)
      : t === 'b' ? (x % 8 === 0 || (y + ((x >> 3) & 1) * 4) % 8 === 0 ? 0x3a3632 : n > .5 ? 0x6a655c : 0x615c54)
      : t === 'w' ? ((((x >> 2) + (y >> 2)) & 1 ? x % 4 === 0 : y % 4 === 0) ? 0x4a2f1a : n > .5 ? 0x8a5f2e : 0x7d5528)
      : t === 'k' ? ((lx + ly) % 8 === 0 || (lx - ly + 16) % 8 === 0 ? 0xc9a23a : n > .5 ? 0x8a1f26 : 0x7c1a22)
      : t === 'g' ? (n > .7 ? 0x3f8642 : n > .3 ? 0x346f38 : 0x2c6032)
      : t === 'o' ? ((x % 4 === 0 || y % 4 === 0) ? 0x3a3a40 : n > .5 ? 0x77777f : 0x6a6a72)
      : ((lx + ly) % 4 === 0 || (lx - ly + 16) % 4 === 0 ? 0x5a5f68 : 0x444950);
    put(fi, x, y, f);
    if (t === 'g' || t === 'o') continue;                                                                // open sky
    put(ci, x, y, t === 'm' || t === 'r' ? (y % 4 === 0 ? 0xb9c0c2 : 0xdfe4e2) : t === 'c' ? (n > .5 ? 0x4a4436 : 0x3f3a2e) : t === 'b' ? (y % 3 === 0 ? 0x5e5044 : 0x7c3a2e)
      : t === 'i' ? (lx === 0 || ly === 0 ? 0x1b1d21 : 0x33373d) : (lx === 0 || ly === 0 || lx === 8 || ly === 8 ? 0xc9a23a : 0xe8dcc0));
  }
  fg.putImageData(fi, 0, 0); cg.putImageData(ci, 0, 0);
}

// ---------- models ----------
// A clockwork figure built from boxes; `scaled` reuses it at a larger size for the bigger machines.
const botFn = (c, frame) => (x, y, z) => {
  const s = frame === 'b' ? 1 : frame === 'a' ? 0 : -1;                    // stride
  if (z < 6) { const left = x >= 1 && x <= 3, right = x >= 5 && x <= 7, yy = y - (left ? s : -s); return (left || right) && yy >= 3 && yy <= 5 ? (z === 0 ? 0x23232b : c.leg) : null; }
  if (z < 12) {
    if (x >= 1 && x <= 7 && y >= 2 && y <= 5) return z === 6 ? 0x33363f : y === 5 && x > 2 && x < 6 && z > 6 && z < 10 ? ((x + z) & 1 ? 0xff8a2a : 0xffcf5c) : (x + z) % 4 === 0 && (y === 2 || y === 5) ? c.rivet : c.body;
    if ((x === 0 || x === 8) && y >= 3 && y <= 4) return z > 9 ? c.rivet : c.body;                        // shoulders and arms
    if (x === 8 && z === 8 && y > 4 && y < 10) return frame === 'a' && y === 9 ? 0xfff3b0 : 0x23232b;    // rifle (muzzle flash on the attack frame)
    if (c.twin && x === 0 && z === 8 && y > 4 && y < 10) return frame === 'a' && y === 9 ? 0xfff3b0 : 0x23232b;
    return null;
  }
  if (z < 15) return x >= 3 && x <= 5 && y >= 2 && y <= 4 ? (y === 4 && x === 4 && z === 13 ? 0xff3040 : c.head) : null;
  if (z === 15) return c.hat === 'kepi' ? (x >= 2 && x <= 6 && y >= 1 && y <= 6 ? (y > 4 ? 0x1b1b22 : 0x24406e) : null) : c.hat === 'stack' ? (x >= 3 && x <= 5 && y >= 2 && y <= 4 ? 0x23232b : null) : (Math.hypot(x - 4, y - 3) < 2.2 ? c.head : null);
  return null;
};
const scaled = (fn, k) => (x, y, z) => fn(x / k | 0, y / k | 0, z / k | 0);
const BOTS = {
  automate: { c: { body: 0xb8892e, leg: 0x8a6a22, rivet: 0xe0bb45, head: 0x9a7a22, hat: 'kepi' }, k: 1 },
  scaphandre: { c: { body: 0x4f8a7a, leg: 0x356a5c, rivet: 0xc9a23a, head: 0xb8892e, hat: 'dome', twin: true }, k: 1.3 },
  colosse: { c: { body: 0x3a3f4a, leg: 0x23262c, rivet: 0xd8363e, head: 0x6a2a22, hat: 'stack', twin: true }, k: 1.45 },
};
for (const [name, b] of Object.entries(BOTS)) for (const f of ['w', 'b', 'a']) def(`${name}_${f}`, Math.ceil(9 * b.k), Math.ceil(10 * b.k), Math.ceil(16 * b.k), scaled(botFn(b.c, f), b.k));
for (const f of ['w', 'b']) def('lanterne_' + f, 9, 9, 9, (x, y, z) => {                                 // flying street lantern
  const d = Math.hypot(x - 4, y - 4, z - 4);
  if (z === 8) return (f === 'w' ? y === 4 : x === 4) ? 0x23232b : null;                                  // rotor
  if (d < 3.8) return y === 7 && x === 4 && z === 4 ? 0xff3040 : d > 2.6 && (x + y + z) % 3 === 0 ? 0xb8892e : d > 2.6 ? 0xffe27a : 0xfff3b0;
  return x === 4 && y === 4 && z < 2 ? 0xb8892e : null;
});
def('a_door', 16, 4, WH, (x, y, z) => x === 0 || x === 15 || z === 0 || z === 23 ? 0x3a2716 : z === 12 && (x === 12 || x === 13) ? 0xd9b23a : x % 4 === 0 ? 0x4a2f1a : noise3(x, z, 2) > .5 ? 0x7a5226 : 0x6e4a22);
const keyDoor = col => (x, y, z) => x === 0 || x === 15 || z === 0 || z === 23 ? 0x23262c : z > 9 && z < 15 ? (z === 12 && x > 6 && x < 9 ? 0xf4f1e6 : col) : (x + z) % 5 === 0 ? 0x8a8f99 : 0x4a4f58;
def('a_door_red', 16, 4, WH, keyDoor(0xd8363e)); def('a_door_blue', 16, 4, WH, keyDoor(0x2f5fae));
const keyFn = col => (x, y, z) => y !== 1 ? null : (z > 7 ? (Math.hypot(x - 2, z - 10) < 2.6 && Math.hypot(x - 2, z - 10) > 1 ? col : null) : x === 2 || (z < 3 && x > 2 && z !== 1) ? col : null);
def('a_key_red', 5, 3, 13, keyFn(0xff4a4a)); def('a_key_blue', 5, 3, 13, keyFn(0x4a8aff));
def('a_baguette', 3, 11, 3, (x, y, z) => Math.hypot(x - 1, z - 1) < 1.5 ? (y % 3 === 1 && z === 2 ? 0xf0d8a0 : 0xc9903a) : null);
def('a_wine', 4, 4, 9, (x, y, z) => { const d = Math.hypot(x - 1.5, y - 1.5); return z < 5 ? (d < 2 ? (z > 1 && z < 4 ? 0xf4f1e6 : 0x2f6a3a) : null) : d < 1 ? (z === 8 ? 0x8a1f26 : 0x2f6a3a) : null; });
def('a_helmet', 8, 9, 6, (x, y, z) => { const d = Math.hypot((x - 3.5) / 3.6, (y - 4) / 4.2, z / 5); return z === 0 ? (Math.hypot((x - 3.5) / 4, (y - 4) / 4.6) < 1 ? 0x566a7d : null) : d < 1 ? (x > 2 && x < 5 && z > 3 ? 0x7f95aa : 0x6a8096) : null; });
const boxOf = (a, b) => (x, y, z) => z === 4 ? b : (x === 0 || x === 6 || y === 0 || y === 4) ? ((x + y) % 3 === 0 ? b : a) : null;
def('a_bullets', 7, 5, 5, boxOf(0x5a6a3a, 0xc9a23a)); def('a_shells', 7, 5, 5, boxOf(0xa8342e, 0xe0bb45)); def('a_cells', 7, 5, 5, boxOf(0x24406e, 0x5ee0e0));
def('a_lamp', 5, 5, 18, (x, y, z) => { const d = Math.hypot(x - 2, y - 2); return z < 1 ? (d < 2.4 ? 0x23232b : null) : z < 13 ? (d < 0.8 ? 0x8a6a22 : null) : d < 2.4 - Math.abs(z - 15) * 0.5 ? 0xfff3b0 : null; });
def('a_drum', 8, 8, 11, (x, y, z) => Math.hypot(x - 3.5, y - 3.5) < 4 ? (z === 4 || z === 5 ? 0xffcf5c : z === 10 ? 0x4a2a22 : 0xa8342e) : null);       // fuel drum: explodes
def('a_cask', 10, 12, 10, (x, y, z) => Math.hypot(x - 4.5, z - 4.5) < 5 - Math.abs(y - 5.5) * 0.18 ? (y === 2 || y === 9 ? 0x33363f : (x + z) % 3 === 0 ? 0x5a3d22 : 0x7a5226) : null);
def('a_column', 8, 8, WH, (x, y, z) => { const d = Math.hypot(x - 3.5, y - 3.5); return z < 2 || z > 21 ? 0xcfc5a8 : d < 2.8 ? ((Math.atan2(y - 3.5, x - 3.5) * 3 + 20 | 0) & 1 ? 0xe2d9c2 : 0xcfc5a8) : null; });
def('a_table', 12, 8, 7, (x, y, z) => z === 5 ? 0x6e4a22 : z < 5 ? ((x === 1 || x === 10) && (y === 1 || y === 6) ? 0x4a2f1a : null) : x === 6 && y === 4 ? 0xffe27a : null);
def('a_crate', 10, 10, 9, MODEL_DEFS.crate.fn);
def('a_exit', 10, 6, 12, (x, y, z) => z < 8 ? (x === 0 || x === 9 || y === 0 || y === 5 || z === 7 ? ((x + z) % 4 === 0 ? 0x8a8f99 : 0x4a4f58) : null) : x > 3 && x < 6 && y === 3 ? (z > 9 ? 0xd8363e : 0xc9a23a) : null);
def('a_shot', 2, 4, 2, () => 0xffcf5c); def('a_spark', 3, 3, 3, (x, y, z) => (x + y + z) % 2 ? 0x9fe8ff : 0xffffff); def('a_shell', 4, 4, 4, (x, y, z) => Math.hypot(x - 1.5, y - 1.5, z - 1.5) < 2.2 ? 0xff5a3a : null);
def('a_bit', 2, 2, 2, () => 0xe0bb45); def('a_smoke', 5, 5, 5, (x, y, z) => Math.hypot(x - 2, y - 2, z - 2) < 2.6 ? (noise3(x, y, z) > .5 ? 0xffcf5c : 0xff8a2a) : null);
def('a_bolt', 2, 6, 2, (x, y, z) => (y & 1) ? 0x9fe8ff : 0xffffff);
// weapons as seen in the hand: barrel along +y, a hand and sleeve at the grip
const hand = (x, y, z, gx, gy) => z < 4 && Math.abs(x - gx) < 2 && y >= gy - 1 && y <= gy + 2 ? (y < gy ? 0x24406e : 0xe9b48a) : null;
def('w_pistol', 5, 12, 8, (x, y, z) => hand(x, y, z, 2, 2) || (x === 2 && z > 3 && z < 6 && y > 2 ? (z === 5 && y > 9 ? 0x8a8f99 : 0x33363f) : x === 2 && z > 1 && z < 4 && y > 2 && y < 5 ? 0x6e4a22 : null));
def('w_shotgun', 7, 20, 8, (x, y, z) => hand(x, y, z, 3, 3) || ((x === 2 || x === 4) && z > 4 && z < 7 && y > 5 ? 0x33363f : x > 1 && x < 5 && z === 4 && y > 5 && y < 13 ? 0x6e4a22 : x === 3 && z > 2 && z < 6 && y < 7 ? 0x7a5226 : null));
def('w_smg', 7, 18, 8, (x, y, z) => hand(x, y, z, 3, 3) || (x > 1 && x < 5 && z > 3 && z < 7 && y > 2 && y < 12 ? 0x3a3f4a : x === 3 && z === 5 && y > 11 ? (y % 2 ? 0x23262c : 0x4a4f58) : x < 2 && z === 5 && y > 7 && y < 10 ? 0x23262c : x === 3 && z > 3 && z < 6 && y < 3 ? 0x6e4a22 : null));
def('w_tesla', 9, 18, 9, (x, y, z) => { const d = Math.hypot(x - 4, z - 5); return hand(x, y, z, 4, 3) || (y > 14 ? (Math.hypot(x - 4, z - 5, y - 15.5) < 2.4 ? 0x9fe8ff : null) : y > 3 ? (d < 1.4 ? 0xc9a23a : d < 2.6 && y % 4 === 0 ? 0xb5612f : null) : x === 4 && z > 2 && z < 6 ? 0x6e4a22 : null); });
def('w_flash', 7, 4, 7, (x, y, z) => Math.abs(x - 3) + Math.abs(z - 3) < 4 - y * 0.6 ? (Math.abs(x - 3) + Math.abs(z - 3) < 2 ? 0xffffff : 0xffcf5c) : null);
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
  { name: 'PISTOLET', model: 'w_pistol', ammo: 'bullets', rate: .30, dmg: 13, pellets: 1, spread: .012, off: [24, 6.0, -7.6] },
  { name: 'FUSIL DE CHASSE', model: 'w_shotgun', ammo: 'shells', rate: .85, dmg: 9, pellets: 8, spread: .1, off: [27, 6.4, -8.2] },
  { name: 'MITRAILLETTE', model: 'w_smg', ammo: 'bullets', rate: .085, dmg: 10, pellets: 1, spread: .04, off: [26, 6.4, -8.2] },
  { name: 'ARC TESLA', model: 'w_tesla', ammo: 'cells', rate: .14, dmg: 34, pellets: 1, spread: 0, pierce: true, off: [27, 6.8, -8.8] },
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
  R.begin(1, W / 2, H / 2, FP.fog.map(v => v / 255), eye, false);
  R.ground(floorTex, cam0, 0); R.ground(ceilTex, cam0, WH);
  let n = 0;
  const vis = (x, y, r) => { const ex = x - P.x, ey = y - P.y, f = ex * fxv + ey * fyv; return f > -r && f < FP.far + r && Math.abs(ey * fxv - ex * fyv) < f * 0.9 + r + 8; };
  const draw = (name, x, y, rot, pose, o) => { if (vis(x, y, 12)) { R.draw(mesh(name), x, y, rot, cam0, o || OPT, null, pose); n++; } };
  for (const c of chunks) if (vis(c.x, c.y, 48)) { R.draw(c.m, c.x, c.y, 0, cam0, OPT); n++; }
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
    const w = WEAPONS[P.weapon], sway = Math.sin(P.bob) * 0.7, back = P.kick * 2.2, o = w.off;
    const wx = P.x + fxv * (o[0] - back) - fyv * (o[1] + sway), wy = P.y + fyv * (o[0] - back) + fxv * (o[1] + sway), lift = FP.eye + o[2] + Math.abs(Math.cos(P.bob)) * 0.5 + P.kick * 0.8;
    R.draw(mesh(w.model), wx, wy, P.yaw - Math.PI / 2, cam0, NOSHADE, null, { lift });
    if (P.flash > 0 && P.weapon !== 3) { const len = MODEL_DEFS[w.model].L / 2 + 2; R.draw(mesh('w_flash'), wx + fxv * len, wy + fyv * len, P.yaw - Math.PI / 2, cam0, NOSHADE, null, { lift: lift + 2 }); }
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
function drawFace(now) {                                              // the hero: beret, moustache, and a worse day as health drops
  const g = faceCtx, hp = P.hp, px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  px(0, 0, 24, 24, '#1c1713'); px(6, 7, 12, 13, '#e9b48a'); px(5, 10, 1, 5, '#e9b48a'); px(18, 10, 1, 5, '#e9b48a'); px(7, 20, 10, 2, '#d9a078');
  px(4, 3, 16, 4, '#24406e'); px(6, 2, 12, 1, '#24406e'); px(11, 1, 2, 1, '#24406e'); px(5, 7, 14, 1, '#1b2f52');
  const look = P.dead ? 0 : Math.round(Math.sin(now * 0.0015) * 1.2), ey = 11;
  if (P.dead) { for (const x of [8, 14]) { px(x, ey - 1, 1, 1, '#000'); px(x + 2, ey - 1, 1, 1, '#000'); px(x + 1, ey, 1, 1, '#000'); px(x, ey + 1, 1, 1, '#000'); px(x + 2, ey + 1, 1, 1, '#000'); } }
  else for (const x of [8, 14]) { px(x, ey, 3, 2, '#fff'); px(x + 1 + look, ey, 1, 2, '#1b1b22'); px(x, ey - 2, 3, 1, P.pain > .1 ? '#3a2a1e' : '#5a3d22'); }
  px(11, 13, 2, 3, '#d9a078'); px(8, 16, 8, 1, '#3a2a1e'); px(7, 17, 2, 1, '#3a2a1e'); px(15, 17, 2, 1, '#3a2a1e');
  if (P.grin > 0) px(9, 18, 6, 1, '#fff'); else px(10, 18, 4, 1, P.pain > .1 ? '#1b1b22' : '#8a3a32');
  if (hp < 70) px(6, 9, 2, 1, '#c00'); if (hp < 45) { px(16, 14, 2, 2, '#c00'); px(7, 14, 1, 3, '#c00'); } if (hp < 20) { px(12, 8, 1, 4, '#c00'); px(15, 18, 2, 2, '#c00'); px(6, 17, 1, 3, '#800'); }
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
  doors, tiles, tile, update, render, reset, fire, C, CS, canSee, chunks, start };
})();
