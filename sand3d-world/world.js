// A walkable world whose every object is a Sand3D program, built from its source while you walk.
// Python runs in a worker (worker.js); ../sand3d-live/build.js turns each result into meshes;
// this file bakes them into light templates, lays them out, and lets you walk and open things.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { build, loadCsg } from '../sand3d-live/build.js';
import { PLACE, SCATTER } from './layout.js';
import { makeGrass } from './grass.js';
import { detailed, lookKey, lookMaterial, plain, setIndoorLight, indoorLight } from './look.js';

const $ = (id) => document.getElementById(id);
const CACHE_VERSION = 'v8';      // (bump when sand3d.py changes what a program builds)
const QUALITY = new URLSearchParams(location.search).get('quality') || 'high';      // ?quality=low drops ambient occlusion and bloom

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
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, QUALITY === 'low' ? 1 : 1.25));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.42;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1400);
camera.rotation.order = 'YXZ';

// A physical sky: it is the backdrop, and its light (blurred) is what every surface reflects.
const SUN_DIR = new THREE.Vector3(0.62, 0.5, 0.45).normalize();
const sky = new Sky();
sky.scale.setScalar(1200);
Object.assign(sky.material.uniforms.turbidity, { value: 2.6 });
Object.assign(sky.material.uniforms.rayleigh, { value: 0.9 });
Object.assign(sky.material.uniforms.mieCoefficient, { value: 0.004 });
Object.assign(sky.material.uniforms.mieDirectionalG, { value: 0.82 });
sky.material.uniforms.sunPosition.value.copy(SUN_DIR);
scene.add(sky);
sky.userData.backdrop = true;
{
  const pmrem = new THREE.PMREMGenerator(renderer), only = new THREE.Scene(), copy = new Sky();
  copy.scale.setScalar(5000);
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) copy.material.uniforms[k].value = sky.material.uniforms[k].value;
  copy.material.uniforms.sunPosition.value.copy(SUN_DIR);
  only.add(copy);
  scene.environment = pmrem.fromScene(only, 0.02).texture;
  scene.environmentIntensity = 0.75;
  setIndoorLight(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);     // rooms reflect a room, not the sky
}
scene.fog = new THREE.FogExp2('#9fb6c6', 0.0022);
const sun = new THREE.DirectionalLight('#fff0d8', 3.3);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2.5;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#cfe0ff', '#5d5a44', 0.12));

// Ambient occlusion grounds things where they meet; bloom lets the sky, lamps and bright metal glow.
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY === 'low' ? 0 : 4 }));
composer.addPass(new RenderPass(scene, camera));
let ao = null;
if (QUALITY !== 'low') {
  ao = new GTAOPass(scene, camera, 1, 1);
  ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.3, thickness: 1.2, scale: 1.15, samples: 12 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  ao.blendIntensity = 1;
  composer.addPass(ao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.07, 0.35, 3.0));
}
composer.addPass(new OutputPass());

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- terrain, pond
const outdoors = new THREE.Group(), indoors = new THREE.Group();     // what the lamps' shadows may skip, and what they need
scene.add(outdoors, indoors);
const lamps = [];
let lampsStale = 0;
const colliders = [];            // {x0, x1, z0, z1} boxes and {x, z, r} posts the walker cannot enter

function makeTerrain() {
  const size = 320, seg = 256;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, color = new Float32Array(p.count * 3), c = new THREE.Color();
  const grassA = new THREE.Color('#2c4a1f'), grassB = new THREE.Color('#4a6229'), dry = new THREE.Color('#5f6a32');
  const dirt = new THREE.Color('#8a7353'), mud = new THREE.Color('#5a5238');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, ground(x, z));
    const patch = 0.5 + 0.5 * Math.sin(x * 0.31 + Math.sin(z * 0.17) * 2) * Math.cos(z * 0.27);
    const broad = 0.5 + 0.5 * Math.sin(x * 0.043 + 2.1) * Math.sin(z * 0.051 + 0.7);
    c.copy(grassA).lerp(grassB, patch).lerp(dry, broad * 0.35);
    const edge = Math.abs(x - 4.75 - 2.2 * Math.sin(z * 0.12));
    if (z > 4 && z < 47) c.lerp(dirt, (1 - smooth(0.7, 1.7, edge)) * 0.92);
    const dp = Math.hypot(x - POND.x, z - POND.z);
    if (dp < POND.r + 3) c.lerp(mud, 1 - smooth(POND.r - 1, POND.r + 3, dp));
    color.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(color, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, detailed(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), 'ground'));
  mesh.receiveShadow = true;
  outdoors.add(mesh);

  // Water that mirrors the sky, with a slow ripple.
  const N = 128, data = new Uint8Array(N * N * 4);
  const h = (x, y) => Math.sin(x * 0.31 + Math.sin(y * 0.23) * 1.7) * 0.5 + Math.sin(y * 0.44 + x * 0.12) * 0.35 + Math.sin((x + y) * 0.74) * 0.15;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = 2 * Math.PI / N * 4, dx = h((x + 1) * k, y * k) - h((x - 1) * k, y * k), dy = h(x * k, (y + 1) * k) - h(x * k, (y - 1) * k);
    data.set([128 - dx * 300, 128 - dy * 300, 255, 255], (y * N + x) * 4);
  }
  ripple = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping;
  ripple.repeat.set(16, 16);
  ripple.generateMipmaps = true;
  ripple.minFilter = THREE.LinearMipmapLinearFilter;
  ripple.magFilter = THREE.LinearFilter;
  ripple.needsUpdate = true;
  const water = new THREE.Mesh(new THREE.CircleGeometry(POND.r + 2.5, 64), new THREE.MeshPhysicalMaterial({
    color: '#16343a', roughness: 0.04, metalness: 0, ior: 1.33, reflectivity: 0.8, envMapIntensity: 2.2,
    transparent: true, opacity: 0.86, normalMap: ripple, normalScale: new THREE.Vector2(0.06, 0.06) }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(POND.x, -0.42, POND.z);
  water.receiveShadow = true;
  outdoors.add(water);
}
let ripple = null;

// ---------------------------------------------------------------- the house shell (the only part not from the dataset)
function makeHouse() {
  const { x0, x1, z0, z1, wall: H, thick: T, floor } = HOUSE;
  const house = new THREE.Group();
  const indoor = { envMap: indoorLight(), envMapIntensity: 0.3 };
  const plaster = plain('#d9d0be', 'plaster', { roughness: 0.92 });
  const inner = plain('#efe9df', 'plaster', { roughness: 0.94, ...indoor });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dfeef2', roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 1.8, depthWrite: false });
  const trim = plain('#f4f1ea', 'smooth', { roughness: 0.55 });
  const timber = plain('#6a4a32', 'wood', { roughness: 0.6 });
  const doorPaint = plain('#f2efe8', 'smooth', { roughness: 0.45, envMap: indoorLight(), envMapIntensity: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: '#b8935a', metalness: 1, roughness: 0.3, envMap: indoorLight(), envMapIntensity: 0.6 });
  const box = (w, h, d, x, y, z, m, solid = true) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = m !== glass;
    mesh.receiveShadow = true;
    house.add(mesh);
    if (solid && y < 1.7) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return mesh;
  };
  // A wall along x (at z = at) or along z (at x = at), from a to b, with door and window openings,
  // each opening dressed with a frame, and windows with a sill and glazing bars.
  const wallRun = (axis, at, a, b, openings, m) => {
    const piece = (from, to, y0, y1, mat = m, solid = true, deep = T, lift = 0) => {
      if (to - from < 1e-3 || y1 - y0 < 1e-3) return;
      const len = to - from, mid = (from + to) / 2;
      if (axis === 'x') box(len, y1 - y0, deep, mid, y0, at + lift, mat, solid); else box(deep, y1 - y0, len, at + lift, y0, mid, mat, solid);
    };
    let cursor = a;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      piece(cursor, o.a, 0, H);
      const F = 0.07, D = T + 0.06;
      if (o.kind === 'door') {
        piece(o.a, o.b, 2.1, H);
        piece(o.a, o.a + F, 0, 2.1, timber, false, D); piece(o.b - F, o.b, 0, 2.1, timber, false, D); piece(o.a, o.b, 2.1 - F, 2.1, timber, false, D);
        if (o.swing) {                                   // a panelled leaf, standing open
          const w = o.b - o.a - 2 * F, leaf = new THREE.Group();
          const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 2.02, 0.04), doorPaint);
          slab.position.set(w / 2, 1.01, 0);
          leaf.add(slab);
          for (const [py, ph] of [[0.55, 0.7], [1.5, 0.8]]) for (const side of [-1, 1]) {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, ph, 0.012), doorPaint);
            panel.position.set(w / 2, py, side * 0.022);
            leaf.add(panel);
          }
          for (const side of [-1, 1]) {
            const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), brass);
            knob.position.set(w - 0.08, 1.0, side * 0.05);
            leaf.add(knob);
          }
          leaf.traverse((q) => { if (q.isMesh) { q.castShadow = q.receiveShadow = true; } });
          if (axis === 'x') { leaf.position.set(o.a + F, floor, at); leaf.rotation.y = THREE.MathUtils.degToRad(o.swing); }
          else { leaf.position.set(at, floor, o.a + F); leaf.rotation.y = THREE.MathUtils.degToRad(o.swing - 90); }
          house.add(leaf);
        }
      } else {
        piece(o.a, o.b, 0, 0.9); piece(o.a, o.b, 2.1, H); piece(o.a + F, o.b - F, 0.9 + F, 2.1 - F, glass, true, 0.012);
        piece(o.a, o.a + F, 0.9, 2.1, trim, false, D); piece(o.b - F, o.b, 0.9, 2.1, trim, false, D);
        piece(o.a, o.b, 2.1 - F, 2.1, trim, false, D); piece(o.a - 0.05, o.b + 0.05, 0.9, 0.9 + F, trim, false, D + 0.1);
        const mid = (o.a + o.b) / 2;
        piece(mid - 0.02, mid + 0.02, 0.9 + F, 2.1 - F, trim, false, 0.04); piece(o.a + F, o.b - F, 1.48, 1.52, trim, false, 0.04);
      }
      cursor = o.b;
    }
    piece(cursor, b, 0, H);
  };
  const D = (a, b, swing = 0) => ({ a, b, kind: 'door', swing }), W = (a, b) => ({ a, b, kind: 'window' });
  wallRun('x', z0, x0, x1, [W(-5.4, -3.6), D(-1.7, -0.7), W(2.4, 4.6)], plaster);
  wallRun('x', z1, x0, x1, [W(-5, -3), W(0.2, 1.3), D(4.2, 5.3)], plaster);
  wallRun('z', x0, z0, z1, [W(-3.2, -1.2), W(2.2, 3.8)], plaster);
  wallRun('z', x1, z0, z1, [W(-3.4, -1.4), W(2.4, 3.8)], plaster);
  wallRun('z', 0, z0, 1, [D(-2.9, -1.1)], inner);
  wallRun('x', 1, x0, x1, [D(-4.7, -3.7, -100), D(4.3, 5.4, 100)], inner);
  wallRun('z', -1, 1, z1, [], inner);
  wallRun('z', 2.5, 1, z1, [D(2.6, 3.5, -100)], inner);
  // Floors: boards in the living rooms, tiles in the kitchen and bathroom, a skirting board round each.
  const boards = plain('#b98d5f', 'planks', { roughness: 0.42, ...indoor }), tiles = plain('#d8d3c8', 'tiles', { roughness: 0.3, ...indoor }), bath = plain('#b9cdd2', 'tiles', { roughness: 0.25, ...indoor });
  const skirting = plain('#f1ede4', 'smooth', { roughness: 0.5, ...indoor });
  const rooms = [[x0, 0, z0, 1, boards], [0, x1, z0, 1, tiles], [x0, -1, 1, z1, boards], [-1, 2.5, 1, z1, bath], [2.5, x1, 1, z1, boards]];
  for (const [a, b, c, d, m] of rooms) {
    box(b - a, floor, d - c, (a + b) / 2, 0, (c + d) / 2, m, false).castShadow = false;
    const i = T / 2 + 0.008;
    box(b - a - T, 0.09, 0.016, (a + b) / 2, floor, c + i, skirting, false); box(b - a - T, 0.09, 0.016, (a + b) / 2, floor, d - i, skirting, false);
    box(0.016, 0.09, d - c - T, a + i, floor, (c + d) / 2, skirting, false); box(0.016, 0.09, d - c - T, b - i, floor, (c + d) / 2, skirting, false);
  }
  box(x1 - x0 + 0.7, 0.34, z1 - z0 + 0.7, 0, -0.34, 0, plain('#8f8a80', 'stone', { roughness: 0.9 }), false);
  box(1.5, 0.12, 0.9, 4.75, -0.12, z1 + 0.8, plain('#8f8a80', 'stone', { roughness: 0.9 }), false);
  // The front door, standing open.
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.04, 2.02, 0.045), plain('#3f5e52', 'wood', { roughness: 0.5 }));
  leaf.geometry.translate(0.52, 1.01, 0);
  leaf.position.set(4.2, floor, z1);
  leaf.rotation.y = THREE.MathUtils.degToRad(112);
  leaf.castShadow = leaf.receiveShadow = true;
  house.add(leaf);
  // Ceiling and a tiled gable roof with eaves.
  box(x1 - x0, 0.1, z1 - z0, 0, H, 0, inner, false);
  const rise = 2.2, half = (z1 - z0) / 2 + 0.75, slope = Math.hypot(half, rise), roofMat = plain('#8a4a39', 'roof', { roughness: 0.8 });
  for (const side of [-1, 1]) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1.3, 0.12, slope + 0.1), roofMat);
    slab.position.set(0, H + 0.1 + rise / 2, side * half / 2);
    slab.rotation.x = side * Math.atan2(rise, half);
    slab.castShadow = slab.receiveShadow = true;
    house.add(slab);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 1.3, 0.16, 0.03), trim);
    fascia.position.set(0, H + 0.06, side * (half + 0.02));
    house.add(fascia);
  }
  const gable = new THREE.Shape([new THREE.Vector2(-half + 0.75, 0), new THREE.Vector2(half - 0.75, 0), new THREE.Vector2(0, rise * (half - 0.75) / half)]);
  for (const x of [x0, x1 - T]) {
    const end = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: T, bevelEnabled: false }), plaster);
    end.rotation.y = Math.PI / 2;
    end.position.set(x, H + 0.1, 0);
    end.castShadow = true;
    house.add(end);
  }
  // A ceiling light in each room: the fitting glows, the light it gives is warm and falls off.
  const shade = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffd9a0', emissiveIntensity: 3 });
  for (const [x, z, power] of [[-3.5, 0.2, 11], [3.5, -2, 12], [-4, 3, 8], [0.75, 3, 6], [5.2, 4.2, 6]]) {
    const lamp = new THREE.PointLight('#ffdcb0', power, 12, 1.9);
    lamp.position.set(x, H - 0.3, z);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.camera.near = 0.08;
    lamp.shadow.camera.far = 11;
    lamp.shadow.bias = -0.003;
    lamp.shadow.normalBias = 0.02;
    lamp.shadow.radius = 3;
    lamp.shadow.autoUpdate = false;        // redrawn only when something indoors changes
    lamps.push(lamp);
    house.add(lamp);
    const fitting = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.07, 24), shade);
    fitting.position.set(x, H - 0.045, z);
    fitting.castShadow = false;
    house.add(fitting);
  }
  scene.add(house);
}

// ---------------------------------------------------------------- from a built program to a light template
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
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (names.length && dropped(o, names)) { o.visible = false; return; }
      if (!o.geometry.attributes.color) {
        const c = o.material.color, color = new Float32Array(o.geometry.attributes.position.count * 3);
        for (let i = 0; i < color.length; i += 3) { color[i] = c.r; color[i + 1] = c.g; color[i + 2] = c.b; }
        o.geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
      }
      o.material = lookMaterial(lookKey(o.material, item.indoors, 0.001));       // these parts are still in millimetres
    });
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
    const key = lookKey(o.material, item.indoors);
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
    parts.push({ geometry: merged, material: lookMaterial(key) });
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
  (item.indoors ? indoors : outdoors).add(holder);
  if (item.indoors) lampsStale = performance.now();
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
    outdoors.add(mesh);
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
  for (const item of items) item.indoors = PLACE.some((p) => p.id === item.id && (p.on || inHouse(p.x, p.z)));
  stats.total = items.length;
  window.world = { stats, items, things, failures: stats.failed };
  credits(items);
  const [db] = await Promise.all([openCache(), loadCsg()]);
  const land = (item, json, ms, cached) => {
    try {
      const built = build(JSON.parse(json), { soften: item.source === 'Sand3D Nature' ? 0 : 0.0035 });
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
  const keyOf = (item) => `${CACHE_VERSION}:${item.lod || 1}:${item.key}`;
  const missing = [];
  for (const item of items) {
    const hit = await cacheGet(db, keyOf(item));
    if (hit) { land(item, hit, 0, true); await new Promise((r) => setTimeout(r)); } else missing.push(item);
  }
  if (!missing.length) return;
  // A few workers share the queue, light objects first so the house fills quickly.
  const queue = [...missing].sort((p, q) => (p.lod ? 1 : 0) - (q.lod ? 1 : 0));
  const byId = new Map(missing.map((item) => [item.id, item]));
  const workers = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2, queue.length));
  for (let w = 0; w < workers; w++) {
    const worker = new Worker('worker.js');
    const next = () => { const item = queue.shift(); if (item) worker.postMessage({ id: item.id, program: item.program, entry: item.entry, lod: item.lod || 1 }); else worker.terminate(); };
    worker.onmessage = ({ data }) => {
      if (data.ready) return;
      const item = byId.get(data.id);
      if (data.error) { stats.failed.push({ id: item.id, error: data.error }); stats.done += 1; progress(item); } else {
        cachePut(db, keyOf(item), data.json);
        land(item, data.json, data.ms, false);
      }
      next();
    };
    next();
  }
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
    if (l.item.indoors) redrawLampShadows([lamps.reduce((a, b) => (a.position.distanceToSquared(l.holder.position) < b.position.distanceToSquared(l.holder.position) ? a : b))]);
  }
}

// ---------------------------------------------------------------- go
makeTerrain();
makeHouse();
const grass = makeGrass({ pond: POND, house: HOUSE });
outdoors.add(grass.mesh);
buildAll().catch((error) => { $('building').textContent = `Could not start: ${error.message || error}`; console.error(error); });

// The lamps' shadows are drawn rarely, with the outdoors hidden: five lamps look six ways each,
// and the trees have no business in that.
const tiny = new THREE.WebGLRenderTarget(4, 4);
function redrawLampShadows(which = lamps) {
  const sunAuto = sun.shadow.autoUpdate;
  sun.shadow.autoUpdate = false;
  outdoors.visible = false;
  sky.visible = false;
  for (const lamp of which) lamp.shadow.needsUpdate = true;
  renderer.setRenderTarget(tiny);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  outdoors.visible = true;
  sky.visible = true;
  sun.shadow.autoUpdate = sunAuto;
}
const draw = () => {
  if (lampsStale && performance.now() - lampsStale > 400) { lampsStale = 0; redrawLampShadows(); }
  composer.render();
};
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  walk(dt);
  animate(dt, now);
  lookAt(now);
  if (ripple) ripple.offset.set(now * 0.000012, now * 0.000007);
  grass.update(camera.position, now / 1000);
  sun.target.position.set(Math.round(me.x / 4) * 4, 0, Math.round(me.z / 4) * 4);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 110);
  draw();
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
  grass.update(camera.position, performance.now() / 1000);
  sun.target.position.set(Math.round(me.x / 4) * 4, 0, Math.round(me.z / 4) * 4);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 110);
  sun.target.updateMatrixWorld();
  draw();
  return `${$('name').textContent} | ${$('about').textContent}`;
};
Object.assign(window, { me, colliders, scene, camera, renderer, lives, interact, walk });
