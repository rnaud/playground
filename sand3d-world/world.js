// A walkable world whose every object is a Sand3D program, built from its source while you walk.
// Python runs in a worker (worker.js); ../sand3d-live/build.js turns each result into meshes;
// this file bakes them into light templates, lays them out, and lets you walk and open things.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { build, loadCsg } from '../sand3d-live/build.js';
import { PLACE, SCATTER } from './layout.js';

const $ = (id) => document.getElementById(id);
const CACHE_VERSION = 'v4';

// ---------------------------------------------------------------- the place
const HOUSE = { x0: -7, x1: 7, z0: -5, z1: 5, wall: 2.8, thick: 0.16, floor: 0.12 };
const POND = { x: -24, z: 16, r: 7.5 };

function hills(x, z) {
  return 1.7 * Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.04) + 0.8 * Math.sin(x * 0.11 + z * 0.07) + 0.3 * Math.sin(x * 0.23 - z * 0.19);
}
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
function ground(x, z) {
  const dx = Math.max(Math.abs(x) - 10, 0), dz = Math.max(Math.abs(z) - 8, 0);
  const lift = smooth(0, 16, Math.hypot(dx, dz));
  const dp = Math.hypot(x - POND.x, z - POND.z);
  return lift * hills(x, z) * (1 - 0.85 * (1 - smooth(POND.r, POND.r + 9, dp))) - 1.5 * (1 - smooth(0, POND.r, dp));
}
const inHouse = (x, z, pad = 0) => x > HOUSE.x0 - pad && x < HOUSE.x1 + pad && z > HOUSE.z0 - pad && z < HOUSE.z1 + pad;
const onPath = (x, z) => Math.abs(x - 4.75 - 2.2 * Math.sin(z * 0.12)) < 1.1 && z > 5 && z < 46;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- renderer, sky, light
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#d3ecff');
scene.fog = new THREE.Fog('#d9ecf7', 70, 210);
const camera = new THREE.PerspectiveCamera(68, 1, 0.08, 400);
camera.rotation.order = 'YXZ';
scene.add(new THREE.HemisphereLight('#dcecff', '#6b6a4e', 1.05));
const sun = new THREE.DirectionalLight('#fff1d6', 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 160 });
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);
const SUN_DIR = new THREE.Vector3(0.55, 0.78, 0.35).normalize();

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- terrain, pond
const colliders = [];            // {x0, x1, z0, z1} boxes and {x, z, r} posts the walker cannot enter

function makeTerrain() {
  const size = 260, seg = 200;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, color = new Float32Array(p.count * 3), c = new THREE.Color();
  const grassA = new THREE.Color('#5d8a3c'), grassB = new THREE.Color('#7fa24a'), dirt = new THREE.Color('#9b8562'), mud = new THREE.Color('#6f6a4d');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, ground(x, z));
    const patch = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.27);
    c.copy(grassA).lerp(grassB, patch);
    if (onPath(x, z)) c.lerp(dirt, 0.85);
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < POND.r + 2) c.lerp(mud, 1 - smooth(POND.r - 1, POND.r + 2, dp));
    color.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  scene.add(mesh);
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 1.5, 48),
    new THREE.MeshStandardMaterial({ color: '#3f7f95', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.82 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, -0.42, POND.z);
  scene.add(water);
}

// ---------------------------------------------------------------- the house shell (the only part not from the dataset)
function makeHouse() {
  const { x0, x1, z0, z1, wall: H, thick: T, floor } = HOUSE;
  const house = new THREE.Group();
  const plaster = new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.95 });
  const inner = new THREE.MeshStandardMaterial({ color: '#f4efe6', roughness: 0.95 });
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe6f0', roughness: 0.05, transparent: true, opacity: 0.22 });
  const trim = new THREE.MeshStandardMaterial({ color: '#6f4a31', roughness: 0.7 });
  const box = (w, h, d, x, y, z, m, solid = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    house.add(mesh);
    if (solid && y < 1.7) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return mesh;
  };
  // A wall along x (at z = at) or along z (at x = at), from a to b, with door and window openings.
  const wallRun = (axis, at, a, b, openings, m) => {
    const piece = (from, to, y0, y1, mat = m, solid = true) => {
      if (to - from < 1e-3 || y1 - y0 < 1e-3) return;
      const len = to - from, mid = (from + to) / 2;
      if (axis === 'x') box(len, y1 - y0, T, mid, y0, at, mat, solid); else box(T, y1 - y0, len, at, y0, mid, mat, solid);
    };
    let cursor = a;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      piece(cursor, o.a, 0, H);
      if (o.kind === 'door') piece(o.a, o.b, 2.1, H);
      else { piece(o.a, o.b, 0, 0.9); piece(o.a, o.b, 2.1, H); piece(o.a, o.b, 0.9, 2.1, glass, true); }
      cursor = o.b;
    }
    piece(cursor, b, 0, H);
  };
  const D = (a, b) => ({ a, b, kind: 'door' }), W = (a, b) => ({ a, b, kind: 'window' });
  wallRun('x', z0, x0, x1, [W(-5.4, -3.6), D(-1.7, -0.7), W(2.4, 4.6)], plaster);
  wallRun('x', z1, x0, x1, [W(-5, -3), W(0.2, 1.3), D(4.2, 5.3)], plaster);
  wallRun('z', x0, z0, z1, [W(-3.2, -1.2), W(2.2, 3.8)], plaster);
  wallRun('z', x1, z0, z1, [W(-3.4, -1.4), W(2.4, 3.8)], plaster);
  wallRun('z', 0, z0, 1, [D(-2.9, -1.1)], inner);
  wallRun('x', 1, x0, x1, [D(-4.7, -3.7), D(4.3, 5.4)], inner);
  wallRun('z', -1, 1, z1, [], inner);
  wallRun('z', 2.5, 1, z1, [D(2.6, 3.5)], inner);
  // Floors, one tone a room.
  const rooms = [[x0, 0, z0, 1, '#a9815a'], [0, x1, z0, 1, '#c9c2b4'], [x0, -1, 1, z1, '#b08c66'], [-1, 2.5, 1, z1, '#aebfc4'], [2.5, x1, 1, z1, '#a9815a']];
  for (const [a, b, c, d, tone] of rooms) {
    const f = box(b - a, floor, d - c, (a + b) / 2, 0, (c + d) / 2, new THREE.MeshStandardMaterial({ color: tone, roughness: 0.75 }), false);
    f.castShadow = false;
  }
  box(x1 - x0 + 0.6, 0.3, z1 - z0 + 0.6, 0, -0.3, 0, trim, false);
  // Ceiling and a gable roof.
  box(x1 - x0, 0.1, z1 - z0, 0, H, 0, inner, false).castShadow = true;
  const rise = 2.0, half = (z1 - z0) / 2 + 0.7, slope = Math.hypot(half, rise), roofMat = new THREE.MeshStandardMaterial({ color: '#8d4a3a', roughness: 0.85 });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1.2, 0.14, slope), roofMat);
    slab.position.set(0, H + 0.1 + rise / 2, side * half / 2);
    slab.rotation.x = side * Math.atan2(rise, half);
    slab.castShadow = slab.receiveShadow = true;
    house.add(slab);
  }
  const gable = new THREE.Shape([new THREE.Vector2(-half + 0.7, 0), new THREE.Vector2(half - 0.7, 0), new THREE.Vector2(0, rise * (half - 0.7) / half)]);
  for (const x of [x0, x1 - T]) {
    const end = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: T, bevelEnabled: false }), plaster);
    end.rotation.y = Math.PI / 2;
    end.position.set(x, H + 0.1, 0);
    end.castShadow = true;
    house.add(end);
  }
  // A lamp's worth of light in each room.
  for (const [x, z, power] of [[-3.5, -2, 26], [3.5, -2, 26], [-4, 3, 16], [0.75, 3, 12], [4.75, 3, 14]]) {
    const lamp = new THREE.PointLight('#ffe2b8', power, 11, 1.8);
    lamp.position.set(x, H - 0.35, z);
    house.add(lamp);
  }
  scene.add(house);
}

// ---------------------------------------------------------------- from a built program to a light template
const classOf = (m) => `${m.metalness > 0.5 ? 'm' : 'd'}${m.transparent ? 't' : ''}${m.side === THREE.DoubleSide && !m.transparent ? '2' : ''}`;
const classMaterials = new Map();
function classMaterial(key) {
  if (!classMaterials.has(key)) {
    classMaterials.set(key, new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: key[0] === 'm' ? 0.38 : 0.82, metalness: key[0] === 'm' ? 0.9 : 0,
      transparent: key.includes('t'), opacity: key.includes('t') ? 0.34 : 1, depthWrite: !key.includes('t'),
      side: key.includes('2') || key.includes('t') ? THREE.DoubleSide : THREE.FrontSide,
    }));
  }
  return classMaterials.get(key);
}

function dropped(object, names) {
  for (let o = object; o; o = o.parent) if (o.name && names.some((n) => o.name === n || o.name.startsWith(n))) return true;
  return false;
}

// World-space geometry of one mesh, with a colour on every vertex.
function flattened(mesh) {
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  if (mesh.matrixWorld.determinant() < 0) {
    for (const name of Object.keys(g.attributes)) {
      const a = g.attributes[name].array, n = g.attributes[name].itemSize;
      for (let i = 0; i < a.length; i += 3 * n) for (let k = 0; k < n; k++) { const t = a[i + n + k]; a[i + n + k] = a[i + 2 * n + k]; a[i + 2 * n + k] = t; }
    }
  }
  if (!g.attributes.color) {
    const c = mesh.material.color, color = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < color.length; i += 3) { color[i] = c.r; color[i + 1] = c.g; color[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  }
  for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(name)) g.deleteAttribute(name);
  return g;
}

// How to bring an object to its size in the world, standing on the origin, facing the way the layout expects.
function fitting(box, item) {
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  let k = 1;
  if (item.h) k = item.h / Math.max(size.y, 1e-9);
  else if (item.w) k = item.w / Math.max(size.x, size.z, 1e-9);
  const m = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(item.yaw || 0))
    .multiply(new THREE.Matrix4().makeScale(k, k, k))
    .multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y - (item.sink || 0) / k, -centre.z));
  return m;
}

function template(built, item) {
  const { root } = built;
  root.updateMatrixWorld(true);
  const names = item.drop || [];
  if (item.live) {                                   // keeps its parts and joints, to be opened
    root.traverse((o) => { if (o.isMesh && names.length && dropped(o, names)) o.visible = false; });
    const fit = fitting(new THREE.Box3().setFromObject(root), item);
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(fit);
    holder.add(root);
    const group = new THREE.Group();
    group.add(holder);
    group.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    return { live: group, joints: built.joints, pose: built.pose, size, triangles: built.stats.triangles };
  }
  const byClass = new Map();
  root.traverse((o) => {
    if (!o.isMesh || (names.length && dropped(o, names))) return;
    const key = classOf(o.material);
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key).push(flattened(o));
  });
  const box = new THREE.Box3();
  for (const list of byClass.values()) for (const g of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const fit = fitting(box, item);
  const parts = [];
  let triangles = 0;
  for (const [key, list] of byClass) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.applyMatrix4(fit);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    triangles += merged.attributes.position.count / 3;
    parts.push({ geometry: merged, material: classMaterial(key) });
  }
  const out = new THREE.Box3();
  for (const p of parts) out.union(p.geometry.boundingBox);
  built.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return { parts, size: out.getSize(new THREE.Vector3()), triangles };
}

// ---------------------------------------------------------------- putting templates into the world
const things = new Map();          // id → { item, tpl }
const picks = [];                  // objects the crosshair can name
const lives = [];                  // objects that open
const waiting = [];                // placements whose support is not built yet
const placed = new Map();          // layout name → { x, y, z, rot, top }
let triangleCount = 0, instanceCount = 0;

function footprint(tpl, rot) {
  const quarter = Math.round(rot / 90) % 2 !== 0;
  return { w: quarter ? tpl.size.z : tpl.size.x, d: quarter ? tpl.size.x : tpl.size.z };
}

function putOne(entry, spot) {
  const { item, tpl } = entry;
  let { x, z } = spot, y = spot.y ?? (inHouse(x, z) ? HOUSE.floor : ground(x, z));
  if (item.hang) y = HOUSE.wall - tpl.size.y * (spot.s || 1);
  const rot = spot.rot || 0;
  if (spot.on) {
    const base = placed.get(spot.on);
    if (!base) { waiting.push([entry, spot]); return; }
    const a = THREE.MathUtils.degToRad(base.rot);
    x = base.x + (spot.dx || 0) * Math.cos(a) + (spot.dz || 0) * Math.sin(a);
    z = base.z - (spot.dx || 0) * Math.sin(a) + (spot.dz || 0) * Math.cos(a);
    y = base.top;
  }
  const holder = new THREE.Group();
  holder.position.set(x, y, z);
  holder.rotation.y = THREE.MathUtils.degToRad(rot + (spot.on ? (placed.get(spot.on)?.rot || 0) : 0));
  if (spot.s) holder.scale.setScalar(spot.s);
  holder.userData.item = item;
  if (tpl.live) {
    holder.add(tpl.live);
    holder.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    lives.push({ holder, item, joints: tpl.joints, pose: tpl.pose, open: false, t: 0 });
  } else {
    for (const p of tpl.parts) {
      const mesh = new THREE.Mesh(p.geometry, p.material);
      mesh.castShadow = !p.material.transparent;
      mesh.receiveShadow = true;
      holder.add(mesh);
    }
  }
  scene.add(holder);
  picks.push(holder);
  triangleCount += tpl.triangles;
  instanceCount += 1;
  const s = spot.s || 1, f = footprint(tpl, rot);
  placed.set(spot.name || item.id, { x, y, z, rot, top: y + tpl.size.y * s });
  if (item.solid !== false && !spot.on && tpl.size.y * s > 0.35) {
    const pad = item.pad ?? 0;
    colliders.push({ x0: x - f.w * s / 2 + pad, x1: x + f.w * s / 2 - pad, z0: z - f.d * s / 2 + pad, z1: z + f.d * s / 2 - pad });
  }
  const ready = waiting.filter(([, sp]) => placed.has(sp.on));
  for (const pair of ready) waiting.splice(waiting.indexOf(pair), 1);
  for (const [e, sp] of ready) putOne(e, sp);
}

const ZONES = {
  forest: (x, z) => !inHouse(x, z, 17) && Math.hypot(x - POND.x, z - POND.z) > POND.r + 4 && !onPath(x, z),
  garden: (x, z) => !inHouse(x, z, 2.2) && inHouse(x, z, 13) && !onPath(x, z) && !(Math.abs(x - 4.75) < 2.4 && z > 5),
  meadow: (x, z) => !inHouse(x, z, 9) && Math.hypot(x - POND.x, z - POND.z) > POND.r + 2 && !onPath(x, z),
  shore: (x, z) => { const d = Math.hypot(x - POND.x, z - POND.z); return d > POND.r - 0.5 && d < POND.r + 5; },
  pond: (x, z) => Math.hypot(x - POND.x, z - POND.z) < POND.r - 2.5,
  path: (x, z) => !onPath(x, z) && Math.abs(x - 4.75 - 2.2 * Math.sin(z * 0.12)) < 2.6 && z > 7 && z < 44,
};
const taken = [];                  // {x, z, r} already used by scattered things

function scatter(entry, rule) {
  const { item, tpl } = entry, rand = rng(rule.seed || 1), zone = ZONES[rule.zone];
  const reach = rule.reach || (rule.zone === 'garden' ? 22 : rule.zone === 'shore' || rule.zone === 'pond' ? 14 : 95);
  const cx = rule.zone === 'shore' || rule.zone === 'pond' ? POND.x : 0, cz = rule.zone === 'shore' || rule.zone === 'pond' ? POND.z : 0;
  const gap = rule.gap ?? Math.max(tpl.size.x, tpl.size.z) * 0.45;
  const spots = [];
  for (let tries = 0; spots.length < rule.n && tries < rule.n * 60; tries++) {
    const near = rule.near ? Math.pow(rand(), rule.near) : rand();
    const a = rand() * Math.PI * 2, r = (rule.min || 0) + near * (reach - (rule.min || 0));
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    if (!zone(x, z) || Math.abs(x) > 122 || Math.abs(z) > 122) continue;
    if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + gap)) continue;
    const s = (rule.s || 1) * (0.82 + rand() * 0.4);
    spots.push({ x, z, y: ground(x, z), rot: rand() * 360, s });
    taken.push({ x, z, r: gap });
  }
  if (!spots.length) return;
  const dummy = new THREE.Object3D();
  for (const p of tpl.parts) {
    const mesh = new THREE.InstancedMesh(p.geometry, p.material, spots.length);
    spots.forEach((s, i) => {
      dummy.position.set(s.x, rule.zone === 'pond' ? -0.42 : s.y - 0.04, s.z);
      dummy.rotation.set(0, THREE.MathUtils.degToRad(s.rot), 0);
      dummy.scale.setScalar(s.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = rule.shadow !== false && !p.material.transparent;
    mesh.receiveShadow = true;
    mesh.userData.item = item;
    mesh.computeBoundingSphere();
    scene.add(mesh);
    picks.push(mesh);
  }
  triangleCount += tpl.triangles * spots.length;
  instanceCount += spots.length;
  if (rule.trunk) for (const s of spots) colliders.push({ x: s.x, z: s.z, r: rule.trunk * s.s });
}

function arrive(item, tpl) {
  const entry = { item, tpl };
  things.set(item.id, entry);
  for (const spot of PLACE.filter((p) => p.id === item.id)) putOne(entry, spot);
  for (const rule of SCATTER.filter((r) => r.id === item.id)) scatter(entry, rule);
}

// ---------------------------------------------------------------- building: cache first, then Python
function openCache() {
  return new Promise((resolve) => {
    const req = indexedDB.open('sand3d-world', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('scenes');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
const cacheGet = (db, key) => new Promise((resolve) => {
  if (!db) return resolve(null);
  const r = db.transaction('scenes').objectStore('scenes').get(key);
  r.onsuccess = () => resolve(r.result || null);
  r.onerror = () => resolve(null);
});
const cachePut = (db, key, value) => { try { db?.transaction('scenes', 'readwrite').objectStore('scenes').put(value, key); } catch { /* a full cache only costs time */ } };

const stats = { total: 0, done: 0, failed: [], python: 0, fromCache: 0, started: performance.now() };

async function buildAll() {
  const manifest = await (await fetch('data/world.json')).json();
  const items = manifest.items;
  stats.total = items.length;
  window.world = { stats, items, things, failures: stats.failed };
  credits(items);
  const [db] = await Promise.all([openCache(), loadCsg()]);
  const land = (item, json, ms, cached) => {
    try {
      const built = build(JSON.parse(json));
      arrive(item, template(built, item));
      stats.python += ms;
      if (cached) stats.fromCache += 1;
    } catch (error) {
      stats.failed.push({ id: item.id, error: String(error.message || error) });
      console.warn('could not build', item.id, error);
    }
    stats.done += 1;
    progress(item);
  };
  const missing = [];
  for (const item of items) {
    const hit = await cacheGet(db, `${CACHE_VERSION}:${item.key}`);
    if (hit) { land(item, hit, 0, true); await new Promise((r) => setTimeout(r)); } else missing.push(item);
  }
  if (!missing.length) return;
  const worker = new Worker('worker.js');
  const byId = new Map(missing.map((item) => [item.id, item]));
  worker.onmessage = ({ data }) => {
    if (data.ready) return;
    const item = byId.get(data.id);
    if (data.error) { stats.failed.push({ id: item.id, error: data.error }); stats.done += 1; progress(item); return; }
    cachePut(db, `${CACHE_VERSION}:${item.key}`, data.json);
    land(item, data.json, data.ms, false);
  };
  for (const item of missing) worker.postMessage({ id: item.id, program: item.program, entry: item.entry });
}

function progress(item) {
  const done = stats.done === stats.total;
  $('progress').value = stats.done / stats.total;
  $('building').textContent = done
    ? `${stats.total - stats.failed.length} of ${stats.total} objects built from code · ${instanceCount.toLocaleString()} placed · ${(triangleCount / 1e6).toFixed(2)} M triangles`
    : `Building from code: ${stats.done} of ${stats.total} · ${item.title}`;
  if (done) { stats.seconds = (performance.now() - stats.started) / 1000; $('progress').hidden = true; }
}

function credits(items) {
  const list = $('creditlist');
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = `${item.title}: ${item.attribution}`;
    list.append(li);
  }
}

// ---------------------------------------------------------------- walking
const keys = new Set();
const me = { x: 4.75, z: 12.5, yaw: 0, pitch: -0.03, eye: 1.66 };
let locked = false;
addEventListener('keydown', (e) => {
  if (e.target.closest?.('dialog')) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyC') { document.exitPointerLock?.(); $('credits').showModal(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// Where the page may not take the pointer (an embedded pane), dragging still looks around.
const takePointer = () => { try { renderer.domElement.requestPointerLock?.()?.catch?.(() => {}); } catch { /* drag to look instead */ } };
renderer.domElement.addEventListener('click', takePointer);
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  $('start').hidden = locked;
});
const look = (dx, dy) => {
  me.yaw -= dx * 0.0023;
  me.pitch = Math.max(-1.45, Math.min(1.45, me.pitch - dy * 0.0023));
};
addEventListener('mousemove', (e) => { if (locked) look(e.movementX, e.movementY); else if (e.buttons === 1 && e.target === renderer.domElement) look(-e.movementX * 1.4, -e.movementY * 1.4); });
$('enter').addEventListener('click', () => { $('start').hidden = true; takePointer(); });
$('showcredits').addEventListener('click', () => $('credits').showModal());

function blocked(x, z) {
  const r = 0.28;
  for (const c of colliders) {
    if (c.r !== undefined) { if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true; continue; }
    if (c.x1 - c.x0 <= 0 || c.z1 - c.z0 <= 0) continue;
    const nx = Math.max(c.x0, Math.min(x, c.x1)), nz = Math.max(c.z0, Math.min(z, c.z1));
    if ((x - nx) ** 2 + (z - nz) ** 2 < r * r) return true;
  }
  return false;
}

function walk(dt) {
  const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const s = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  if (keys.has('ArrowLeft')) me.yaw += dt * 1.9;
  if (keys.has('ArrowRight')) me.yaw -= dt * 1.9;
  if (f || s) {
    const speed = (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 8.5 : 4.2) * dt / Math.hypot(f, s);
    const sin = Math.sin(me.yaw), cos = Math.cos(me.yaw);
    const dx = (-sin * f + cos * s) * speed, dz = (-cos * f - sin * s) * speed;
    if (!blocked(me.x + dx, me.z)) me.x += dx;
    if (!blocked(me.x, me.z + dz)) me.z += dz;
    me.x = Math.max(-120, Math.min(120, me.x));
    me.z = Math.max(-120, Math.min(120, me.z));
  }
  const floor = inHouse(me.x, me.z, 0.3) ? HOUSE.floor : Math.max(ground(me.x, me.z), -0.25);
  me.y = me.y === undefined ? floor : me.y + (floor - me.y) * Math.min(1, dt * 12);
  camera.position.set(me.x, me.y + me.eye, me.z);
  camera.rotation.set(me.pitch, me.yaw, 0);
}

// ---------------------------------------------------------------- naming and opening what you look at
const ray = new THREE.Raycaster();
ray.far = 9;
let seen = null, lastLook = 0;
function lookAt(now) {
  if (now - lastLook < 180) return;
  lastLook = now;
  ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hit = ray.intersectObjects(picks, true)[0];
  let item = null, holder = null;
  for (let o = hit?.object; o && !item; o = o.parent) { item = o.userData.item || null; holder = o; }
  seen = item ? { item, holder } : null;
  const live = seen && lives.find((l) => l.holder === holder);
  $('name').textContent = item ? item.title : '';
  $('about').textContent = item ? `${item.program.split('\n').length} lines of Python · ${item.source}${live ? ' · press E to ' + (live.open ? 'close' : 'open') : ''}` : '';
}
function interact() {
  const live = seen && lives.find((l) => l.holder === seen.holder);
  if (live) live.open = !live.open;
}
function animate(dt, now) {
  for (const l of lives) {
    const goal = l.open ? 1 : 0;
    if (l.t === goal && !l.spins) continue;
    l.t += Math.sign(goal - l.t) * Math.min(Math.abs(goal - l.t), dt * 1.4);
    const ease = l.t * l.t * (3 - 2 * l.t);
    l.spins = false;
    for (const j of l.joints) {
      if (j.leader || !j.axis) continue;
      if (j.kind === 'continuous' || !j.range) { if (l.open) { j.value = (now / 1000 * 140) % 360; l.spins = true; } continue; }
      j.value = (Math.abs(j.hi) >= Math.abs(j.lo) ? j.hi : j.lo) * ease;
    }
    l.pose();
  }
}

// ---------------------------------------------------------------- go
makeTerrain();
makeHouse();
buildAll().catch((error) => { $('building').textContent = `Could not start: ${error.message || error}`; console.error(error); });

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  walk(dt);
  animate(dt, now);
  lookAt(now);
  sun.target.position.set(Math.round(me.x / 4) * 4, 0, Math.round(me.z / 4) * 4);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 80);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
// For checking the world from a script: stand somewhere, look, and draw one frame now.
window.stand = (x, z, yawDegrees = 0, pitch = -0.1) => {
  Object.assign(me, { x, z, yaw: THREE.MathUtils.degToRad(yawDegrees), pitch, y: undefined });
  walk(0);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  lastLook = 0;
  lookAt(performance.now());
  sun.target.position.set(Math.round(me.x / 4) * 4, 0, Math.round(me.z / 4) * 4);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 80);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  return `${$('name').textContent} | ${$('about').textContent}`;
};
Object.assign(window, { me, colliders, scene, camera, renderer, lives, interact, walk });
