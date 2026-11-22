'use strict';
// Shared by every renderer page: model definitions, world layout, input and simulation.
// ---------- helpers ----------
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const noise3 = (x, y, z) => { let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 | 0, 1274126177); h ^= h >>> 13; return ((Math.imul(h, 1274126177) >>> 0) % 1000) / 1000; };

// ---------- models: each is a function (x,y,z) -> colour (or null for empty) on a W x L x H grid ----------
const MODEL_DEFS = {};
const def = (name, W, L, H, fn) => MODEL_DEFS[name] = { name, W, L, H, fn };
const PICKABLE = ['car', 'tree', 'pine', 'house', 'tower', 'crate', 'rock'];
const carFn = (body, light) => (x, y, z) => {
  const wheel = (x < 2 || x > 11) && ((y >= 3 && y <= 7) || (y >= 16 && y <= 20));
  if (z <= 2 && wheel) return 0x1b1b22;
  if (z >= 1 && z <= 4 && x >= 1 && x <= 12) {
    if (z === 1) return 0x2a2a33;
    if (y === 23 && z === 3 && (x <= 3 || x >= 10)) return 0xffe27a;   // headlights
    if (y === 0 && z === 3 && (x <= 3 || x >= 10)) return 0xff3040;    // tail lights
    if (z === 4 && (x === 6 || x === 7)) return 0xf4f1e6;              // racing stripe
    return body;
  }
  if (z >= 5 && z <= 7 && x >= 2 && x <= 11 && y >= 6 && y <= 16) {
    if (z === 7) return (x === 6 || x === 7) ? 0xf4f1e6 : light;
    const edge = x === 2 || x === 11 || y === 6 || y === 16;
    if (!edge) return null;
    const pillar = ((x === 2 || x === 11) && (y === 6 || y === 16 || y === 11));
    return pillar ? body : 0x9fd8ff;
  }
  return null;
};

def('car', 14, 24, 8, carFn(0xd8363e, 0xf0555c));
def('taxi', 14, 24, 8, carFn(0xf0b429, 0xffd257));
def('van', 14, 24, 8, carFn(0x3d7dd8, 0x69a2f0));
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

// ---------- world ----------
const WORLD = 760, RX = 250, RY = 180, MID = WORLD / 2;
const roadDist = (x, y) => Math.hypot((x - MID) / RX, (y - MID) / RY);
function makeGround() {
  const ground = mkCanvas(WORLD, WORLD);
  const g = ground.getContext('2d'), r = mulberry32(3);
  g.fillStyle = '#4c9a4a'; g.fillRect(0, 0, WORLD, WORLD);
  for (let i = 0; i < 9000; i++) { g.fillStyle = ['#458f45', '#57a852', '#3f8642', '#62b35a'][i & 3]; g.fillRect(r() * WORLD | 0, r() * WORLD | 0, 2, 1); }
  g.lineWidth = 44; g.strokeStyle = '#c9b48a'; g.beginPath(); g.ellipse(MID, MID, RX, RY, 0, 0, 7); g.stroke();
  g.lineWidth = 36; g.strokeStyle = '#555864'; g.stroke();
  g.lineWidth = 2; g.setLineDash([10, 10]); g.strokeStyle = '#e9e2c8'; g.stroke();
  g.setLineDash([]); g.fillStyle = '#3d7dd8'; g.beginPath(); g.ellipse(MID, MID, 70, 44, 0, 0, 7); g.fill();
  g.lineWidth = 3; g.strokeStyle = '#d9c88f'; g.stroke();
  return ground;
}

function makeWorld(MODELS) {
  const objects = [];
  const r = mulberry32(11), kinds = ['tree', 'tree', 'pine', 'pine', 'rock', 'crate', 'house'];
  let tries = 0;
  while (objects.length < 90 && tries++ < 4000) {
    const x = 30 + r() * (WORLD - 60), y = 30 + r() * (WORLD - 60), d = roadDist(x, y);
    if (Math.abs(d - 1) < 0.2 || Math.hypot((x - MID) / 86, (y - MID) / 60) < 1) continue;
    const kind = kinds[r() * kinds.length | 0], m = MODELS[kind], rad = Math.max(m.W, m.L) * 0.55;
    if (objects.some(o => Math.hypot(o.x - x, o.y - y) < o.rad + rad)) continue;
    objects.push({ m, x, y, rad, rot: kind === 'house' ? (r() * 4 | 0) * Math.PI / 2 + (r() - .5) * .3 : r() * 6.28 });
  }
  objects.push({ m: MODELS.tower, x: MID, y: MID - 4, rad: 8, rot: 0 });
  [[0.6, 'taxi'], [2.4, 'van'], [4.1, 'taxi']].forEach(([t, k]) =>
    objects.push({ m: MODELS[k], auto: t, speed: 0.0035 + t * 0.0006, lane: 1.035, x: 0, y: 0, rad: 12, rot: 0 }));
  const player = { m: MODELS.car, x: MID + RX, y: MID, heading: Math.PI / 2, speed: 0, auto: 0, manual: false, rad: 12, rot: 0 };
  objects.push(player);
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
    const sp = o === player ? 0.0045 : o.speed, lane = o.lane || 0.965;
    o.auto += sp * 60 * dt;
    o.x = MID + Math.cos(o.auto) * RX * lane; o.y = MID + Math.sin(o.auto) * RY * lane;
    o.heading = Math.atan2(Math.cos(o.auto) * RY, -Math.sin(o.auto) * RX);
  }
  if (player.manual) {
    const up = keys.w || keys.arrowup, dn = keys.s || keys.arrowdown, lf = keys.a || keys.arrowleft, rt = keys.d || keys.arrowright;
    const onRoad = Math.abs(roadDist(player.x, player.y) - 1) < 0.1;
    player.speed += ((up ? 260 : 0) - (dn ? 200 : 0)) * dt;
    player.speed *= Math.pow(onRoad ? 0.35 : 0.08, dt);
    player.heading += ((rt ? 1 : 0) - (lf ? 1 : 0)) * 2.6 * dt * Math.max(-1, Math.min(1, player.speed / 60));
    const nx = player.x + Math.cos(player.heading) * player.speed * dt, ny = player.y + Math.sin(player.heading) * player.speed * dt;
    const hit = objects.some(o => o !== player && Math.hypot(o.x - nx, o.y - ny) < o.rad * 0.8 + 6);
    if (hit || nx < 10 || ny < 10 || nx > WORLD - 10 || ny > WORLD - 10) player.speed *= -0.3;
    else { player.x = nx; player.y = ny; }
  }
  for (const o of objects) if (o.heading != null) o.rot = o.heading - Math.PI / 2; // car sprites face +y
  cam.x += (player.x - cam.x) * Math.min(1, 5 * dt); cam.y += (player.y - cam.y) * Math.min(1, 5 * dt);
}

