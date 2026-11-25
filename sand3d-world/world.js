// A walkable world whose every object is a Sand3D program, built from its source while you walk.
// Python runs in a worker (worker.js); ../sand3d-live/build.js turns each result into meshes;
// this file bakes them into light templates, lays them out, and lets you walk and open things.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { build, loadCsg } from '../sand3d-live/build.js';
import { PLACE, SCATTER } from './layout.js';
import { makeGrass } from './grass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { detailed, grounded, lookKey, lookMaterial, plain, setIndoorLight, inRoom, setRoomLight } from './look.js';

const $ = (id) => document.getElementById(id);
const CACHE_VERSION = 'v8';      // (bump when sand3d.py changes what a program builds)
const QUALITY = new URLSearchParams(location.search).get('quality') || 'high';      // ?quality=low drops ambient occlusion and bloom

// ---------------------------------------------------------------- the place
const HOUSE = { x0: -7, x1: 7, z0: -5, z1: 5, wall: 2.8, thick: 0.16, floor: 0.12 };
const POND = { x: -24, z: 16, r: 7.5 };
// The rooms, and where each is looked at from when its light is captured (clear of the furniture).
const ROOMS = [
  { name: 'living', x0: -7, x1: 0, z0: -5, z1: 1, eye: [-2.2, -2.9] },
  { name: 'kitchen', x0: 0, x1: 7, z0: -5, z1: 1, eye: [2.2, -2.6] },
  { name: 'bedroom', x0: -7, x1: -1, z0: 1, z1: 5, eye: [-4.0, 2.6] },
  { name: 'bathroom', x0: -1, x1: 2.5, z0: 1, z1: 5, eye: [0.75, 2.9] },
  { name: 'study', x0: 2.5, x1: 7, z0: 1, z1: 5, eye: [4.2, 2.2] },
];
const roomAt = (x, z) => ROOMS.find((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)?.name || null;

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
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.AgXToneMapping;          // (rolls off the way film does; ACES burned the colours)
renderer.toneMappingExposure = 0.6;
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
  scene.environmentIntensity = 0.22;      // the sky fills the shade; the sun below does the lighting (the other way round, nothing showed a shadow)
  setIndoorLight(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);     // rooms reflect a room, not the sky
}
scene.fog = new THREE.FogExp2('#9fb6c6', 0.0022);
const sun = new THREE.DirectionalLight('#fff0d8', 15);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 46, bottom: -46, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.035;
sun.shadow.radius = 2.5;
sun.shadow.autoUpdate = false;                 // the land holds still: redrawn when the walker moves on or something outdoors changes
let sunStale = true;
scene.add(sun, sun.target);
scene.add(new THREE.HemisphereLight('#cfe0ff', '#5d5a44', 0.12));

// Ambient occlusion grounds things where they meet; bloom lets the sky, lamps and bright metal glow.
// The scene is drawn once into its own target; ambient occlusion reads that target's depth, so
// the land is not drawn a second time for it. Bloom lets the sky, lamps and bright metal glow.
const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: QUALITY === 'low' ? 0 : 4, depthTexture: new THREE.DepthTexture(1, 1) });
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
composer.addPass(new TexturePass(sceneTarget.texture));
let ao = null;
if (QUALITY !== 'low') {
  ao = new GTAOPass(scene, camera, 1, 1, { depthTexture: sceneTarget.depthTexture });
  ao.updateGtaoMaterial({ radius: 0.55, distanceExponent: 1.3, thickness: 1.2, scale: 1.15, samples: 12 });
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  ao.blendIntensity = 1;
  composer.addPass(ao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.07, 0.35, 3.0));
}
composer.addPass(new OutputPass());
// What a lens and a sensor add: the corners fall off a little, and there is a fine grain.
const finish = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - 0.5;
      c.rgb = mix(vec3(dot(c.rgb, vec3(0.2126, 0.7152, 0.0722))), c.rgb, 1.12);      // a print's colour and contrast
      c.rgb = (c.rgb - 0.5) * 1.06 + 0.5;
      c.rgb *= 1.0 - 0.3 * smoothstep(0.2, 1.0, dot(d, d) * 2.4);
      c.rgb += (hash(gl_FragCoord.xy) - 0.5) * 0.016;
      gl_FragColor = c;
    }`,
});
if (QUALITY !== 'low') composer.addPass(finish);
// The eye adapts: it opens up indoors, where the windows then burn out as they do in a photograph.
const EXPOSURE = { outdoors: 0.6, indoors: 1.1 };

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  composer.setPixelRatio(renderer.getPixelRatio());
  sceneTarget.setSize(Math.round(innerWidth * renderer.getPixelRatio()), Math.round(innerHeight * renderer.getPixelRatio()));
  if (ao) ao.setGBuffer(sceneTarget.depthTexture);
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
const colliders = [];            // what the walker cannot enter: {x0, x1, z0, z1} walls, and objects by the cells they fill
const floorPaints = [];          // the floors' materials: their colour counts for less in the light a room gives itself
const floorShade = new THREE.WebGLRenderTarget(896, 640, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter });
const floorShadeInto = new THREE.Matrix4();
const dayLights = [];            // the light each window and outside door lets in
let shell = null;                // the house itself
const walls = [];                // the house shell: the crosshair does not name things through it

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
  RectAreaLightUniformsLib.init();
  const { x0, x1, z0, z1, wall: H, thick: T, floor } = HOUSE;
  const house = new THREE.Group();
  // What a room is made of is its own material, so that each room can be lit by itself.
  const perRoom = (make) => { const made = new Map(); return (room) => { if (!made.has(room)) made.set(room, inRoom(make(), room)); return made.get(room); }; };
  const paint = perRoom(() => plain('#efe9df', 'plaster', { roughness: 0.94 }));
  const ceilingPaint = perRoom(() => plain('#f6f3ec', 'plaster', { roughness: 0.96 }));
  const plaster = plain('#d9d0be', 'plaster', { roughness: 0.92 });
  const inner = paint('living');                                   // (the cores of the partitions, seen only in doorways)
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dfeef2', roughness: 0.02, transparent: true, opacity: 0.16, envMapIntensity: 1.8, depthWrite: false });
  const trim = plain('#f4f1ea', 'smooth', { roughness: 0.55 });
  const timber = plain('#6a4a32', 'wood', { roughness: 0.6 });
  const doorPaint = inRoom(plain('#f2efe8', 'smooth', { roughness: 0.45 }), 'living');
  const brass = inRoom(new THREE.MeshStandardMaterial({ color: '#b8935a', metalness: 1, roughness: 0.3 }), 'living', 0.6);
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
  // each opening dressed with a frame, and windows with a sill and glazing bars. Every face that
  // looks into a room is lined with that room's own plaster, so it is lit by that room and not by
  // the sky or by the room behind it.
  const wallRun = (axis, at, a, b, openings, m) => {
    const piece = (from, to, y0, y1, mat = m, solid = true, deep = T, lift = 0) => {
      if (to - from < 1e-3 || y1 - y0 < 1e-3) return;
      const len = to - from, mid = (from + to) / 2;
      if (axis === 'x') box(len, y1 - y0, deep, mid, y0, at + lift, mat, solid); else box(deep, y1 - y0, len, at + lift, y0, mid, mat, solid);
      if (mat !== m) return;
      const skin = 0.008, cuts = [from, ...(axis === 'x' ? [-1, 0, 2.5] : [1]).filter((c) => c > from + 0.01 && c < to - 0.01), to];
      for (const side of [-1, 1]) for (let i = 0; i + 1 < cuts.length; i++) {
        const p = cuts[i], q = cuts[i + 1], c = (p + q) / 2, off = at + side * (T + skin) / 2;
        const room = axis === 'x' ? roomAt(c, at + side * 0.3) : roomAt(at + side * 0.3, c);
        if (!room) continue;
        const lining = axis === 'x' ? box(q - p, y1 - y0, skin, c, y0, off, paint(room), false) : box(skin, y1 - y0, q - p, off, y0, c, paint(room), false);
        lining.castShadow = false;
      }
    };
    let cursor = a;
    for (const o of [...openings].sort((p, q) => p.a - q.a)) {
      piece(cursor, o.a, 0, H);
      // Daylight comes in at every opening in an outside wall: a soft light the size of the opening,
      // so what is near a window is brighter on the side that faces it.
      if (m === plaster && QUALITY !== 'low') for (const side of [-1, 1]) {
        const c = (o.a + o.b) / 2, room = axis === 'x' ? roomAt(c, at + side * 0.3) : roomAt(at + side * 0.3, c);
        if (!room) continue;
        const tall = o.kind === 'door' ? 2.1 : 1.2, y = o.kind === 'door' ? 1.05 : 1.5, off = at + side * (T / 2 + 0.03);
        const day = new THREE.RectAreaLight('#eaf1ff', 5, o.b - o.a, tall);
        day.position.set(axis === 'x' ? c : off, y, axis === 'x' ? off : c);
        day.lookAt(day.position.x + (axis === 'x' ? 0 : side), y, day.position.z + (axis === 'x' ? side : 0));
        house.add(day);
        dayLights.push(day);
      }
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
  const boards = () => plain('#b09474', 'planks', { roughness: 0.42 }), tiles = () => plain('#c9c4b8', 'tiles', { roughness: 0.3 }), bath = () => plain('#b9cdd2', 'tiles', { roughness: 0.25 });
  const skirt = perRoom(() => plain('#f1ede4', 'smooth', { roughness: 0.5 }));
  const floors = { living: boards, kitchen: tiles, bedroom: boards, bathroom: bath, study: boards };
  for (const { name, x0: a, x1: b, z0: c, z1: d } of ROOMS) {
    const skirting = skirt(name);
    const ground = inRoom(floors[name](), name);
    floorPaints.push(grounded(ground, floorShade.texture, floorShadeInto, new THREE.Vector3((a + b) / 2, floor / 2, (c + d) / 2)));
    box(b - a, floor, d - c, (a + b) / 2, 0, (c + d) / 2, ground, false).castShadow = false;
    box(b - a - T, 0.02, d - c - T, (a + b) / 2, H - 0.02, (c + d) / 2, ceilingPaint(name), false).castShadow = false;
    const i = T / 2 + 0.008;
    box(b - a - T, 0.09, 0.016, (a + b) / 2, floor, c + i, skirting, false); box(b - a - T, 0.09, 0.016, (a + b) / 2, floor, d - i, skirting, false);
    box(0.016, 0.09, d - c - T, a + i, floor, (c + d) / 2, skirting, false); box(0.016, 0.09, d - c - T, b - i, floor, (c + d) / 2, skirting, false);
  }
  // (the plinth and the step stand a little proud of the lawn: level with it, the two flicker)
  box(x1 - x0 + 0.7, 0.37, z1 - z0 + 0.7, 0, -0.34, 0, plain('#8f8a80', 'stone', { roughness: 0.9 }), false);
  box(1.5, 0.18, 0.9, 4.75, -0.12, z1 + 0.8, plain('#8f8a80', 'stone', { roughness: 0.9 }), false);
  // The front door, standing open.
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.04, 2.02, 0.045), plain('#3f5e52', 'wood', { roughness: 0.5 }));
  leaf.geometry.translate(0.52, 1.01, 0);
  leaf.position.set(4.2, floor, z1);
  leaf.rotation.y = THREE.MathUtils.degToRad(112);
  leaf.castShadow = leaf.receiveShadow = true;
  house.add(leaf);
  // Ceiling and a tiled gable roof with eaves.
  box(x1 - x0, 0.1, z1 - z0, 0, H, 0, plaster, false);
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
  // (by day they only fill: the rooms are lit by their windows)
  for (const [x, z, power] of [[-3.5, 0.2, 3.8], [3.5, -2, 4.2], [-4, 3, 2.8], [0.75, 3, 2.4], [5.2, 4.2, 2.1]]) {
    const lamp = new THREE.PointLight('#ffe9cf', power, 12, 1.9);
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
  shell = house;
  house.updateMatrixWorld(true);
  house.traverse((o) => { if (o.isMesh && o.material !== glass) walls.push(o); });
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
  if (!g.attributes.normal) g.computeVertexNormals();
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

// Many programs lay one part flush on another (a worktop on its carcass, tea in a cup), and two
// faces in one plane flicker. Each part is swollen along its normals by a different hair's breadth,
// at most 0.4 mm, so that one of the two always wins.
const HAIR = 0.000035;
function swell(geometry, by) {
  const p = geometry.attributes.position, n = geometry.attributes.normal;
  if (!n || !by) return;
  for (let i = 0; i < p.array.length; i++) p.array[i] += n.array[i] * by;
  p.needsUpdate = true;
}

// A coarse grid of the cells an object's surfaces pass through: 1 where there is any surface,
// 2 where it is not foliage, and how high the surface reaches in each column. The walker and the
// crosshair are tested against it, not against the object's whole box (a tree stops you at its
// trunk, a table lets you look under it), and what is set on an object rests on the surface at
// that spot, not on its highest point.
function gridOf(box) {
  const size = box.getSize(new THREE.Vector3()), cell = Math.max(0.04, Math.max(size.x, size.y, size.z) / 96);
  const nx = Math.floor(size.x / cell) + 1, ny = Math.floor(size.y / cell) + 1, nz = Math.floor(size.z / cell) + 1;
  return { min: box.min.clone(), cell, nx, ny, nz, data: new Uint8Array(nx * ny * nz), top: new Float32Array(nx * nz).fill(-Infinity), plans: new Map() };
}
function mark(grid, geometry, matrix, bits) {
  const p = geometry.attributes.position, index = geometry.index, count = index ? index.count : p.count;
  const { min, cell, nx, ny, nz, data, top } = grid, v = new Float32Array(9), t = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    for (let k = 0; k < 3; k++) {
      t.fromBufferAttribute(p, index ? index.getX(i + k) : i + k);
      if (matrix) t.applyMatrix4(matrix);
      v[k * 3] = (t.x - min.x) / cell; v[k * 3 + 1] = (t.y - min.y) / cell; v[k * 3 + 2] = (t.z - min.z) / cell;
    }
    const span = Math.max(Math.abs(v[3] - v[0]), Math.abs(v[4] - v[1]), Math.abs(v[5] - v[2]), Math.abs(v[6] - v[0]), Math.abs(v[7] - v[1]), Math.abs(v[8] - v[2]), Math.abs(v[6] - v[3]), Math.abs(v[7] - v[4]), Math.abs(v[8] - v[5]));
    const steps = Math.min(400, Math.ceil(span * 1.5) || 1);
    for (let a = 0; a <= steps; a++) for (let b = 0; a + b <= steps; b++) {
      const u = a / steps, w = b / steps, r = 1 - u - w;
      const y = v[1] * r + v[4] * u + v[7] * w, ix = Math.floor(v[0] * r + v[3] * u + v[6] * w), iy = Math.floor(y), iz = Math.floor(v[2] * r + v[5] * u + v[8] * w);
      if (ix < 0 || iy < 0 || iz < 0 || ix >= nx || iy >= ny || iz >= nz) continue;
      data[(iy * nz + iz) * nx + ix] |= bits;
      if (y * cell + min.y > top[iz * nx + ix]) top[iz * nx + ix] = y * cell + min.y;
    }
  }
}
// The cells of a grid that hold something solid between two heights: what a walker of that height meets.
function planOf(grid, lo, hi) {
  const { min, cell, nx, ny, nz, data } = grid;
  const a = Math.max(0, Math.floor((lo - min.y) / cell)), b = Math.min(ny - 1, Math.floor((hi - min.y) / cell)), key = `${a}:${b}`;
  if (grid.plans.has(key)) return grid.plans.get(key);
  let plan = null;
  for (let iy = a; iy <= b; iy++) for (let i = 0, at = iy * nz * nx; i < nz * nx; i++) if (data[at + i] & 2) (plan ||= new Uint8Array(nx * nz))[i] = 1;
  grid.plans.set(key, plan);
  return plan;
}
// How high an object's surface stands near a spot of its own floor plan (a hand's width around it).
function surfaceAt(grid, x, z) {
  const { min, cell, nx, nz, top } = grid, i = Math.floor((x - min.x) / cell), j = Math.floor((z - min.z) / cell);
  let y = -Infinity;
  for (let b = Math.max(0, j - 1); b <= Math.min(nz - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(nx - 1, i + 1); a++) y = Math.max(y, top[b * nx + a]);
  return y;
}
const foliage = (key) => key.startsWith('leaf|');

function template(built, item) {
  const { root } = built;
  root.updateMatrixWorld(true);
  const names = item.drop || [];
  if (item.live) {                                   // keeps its parts and joints, to be opened
    const swollen = new Set();
    let ordinal = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      if (names.length && dropped(o, names)) { o.visible = false; return; }
      ordinal += 1;
      if (!swollen.has(o.geometry)) { swollen.add(o.geometry); o.userData.swell = ordinal % 12; }
      if (!o.geometry.attributes.color) {
        const c = o.material.color, color = new Float32Array(o.geometry.attributes.position.count * 3);
        for (let i = 0; i < color.length; i += 3) { color[i] = c.r; color[i + 1] = c.g; color[i + 2] = c.b; }
        o.geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
      }
      o.material = lookMaterial(lookKey(o.material, item.room || 'o', 0.001));       // these parts are still in millimetres
    });
    const fit = fitting(new THREE.Box3().setFromObject(root), item);
    root.traverse((o) => { if (o.userData.swell) swell(o.geometry, o.userData.swell * HAIR / (fit.getMaxScaleOnAxis() * o.matrixWorld.getMaxScaleOnAxis())); });
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.copy(fit);
    holder.add(root);
    const group = new THREE.Group();
    group.add(holder);
    group.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(group), grid = gridOf(bounds);
    group.traverse((o) => { if (o.isMesh && o.visible) mark(grid, o.geometry, o.matrixWorld, 3); });
    return { live: group, joints: built.joints, pose: built.pose, size: bounds.getSize(new THREE.Vector3()), grid, triangles: built.stats.triangles };
  }
  const byClass = new Map();
  let ordinal = 0;
  root.traverse((o) => {
    if (!o.isMesh || (names.length && dropped(o, names))) return;
    const key = lookKey(o.material, item.room || 'o');
    if (!byClass.has(key)) byClass.set(key, []);
    const g = flattened(o);
    g.userData.swell = (ordinal += 1) % 12;
    byClass.get(key).push(g);
  });
  const box = new THREE.Box3();
  for (const list of byClass.values()) for (const g of list) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const fit = fitting(box, item);
  const parts = [];
  let triangles = 0;
  for (const [key, list] of byClass) {
    for (const g of list) swell(g, g.userData.swell * HAIR / fit.getMaxScaleOnAxis());
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.applyMatrix4(fit);
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    triangles += merged.attributes.position.count / 3;
    parts.push({ geometry: merged, material: lookMaterial(key), foliage: foliage(key) });
  }
  const out = new THREE.Box3();
  for (const p of parts) out.union(p.geometry.boundingBox);
  const grid = gridOf(out);
  for (const p of parts) mark(grid, p.geometry, null, p.foliage ? 1 : 3);
  built.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  return { parts, size: out.getSize(new THREE.Vector3()), grid, leafy: parts.some((p) => p.foliage), triangles };
}

// ---------------------------------------------------------------- putting templates into the world
const things = new Map();          // id → { item, tpl }
const picks = [];                  // each placed object's grid and the way into it: what the crosshair is tested against
// One object standing at a spot: the crosshair can find it, and the walker (whose feet are at
// `floor`) cannot pass where it is solid between shin and shoulder. A plant stops the walker only
// by what it has near the ground (its trunk, its pot), so low boughs can be walked under.
function stands(item, holder, tpl, x, y, z, rotDegrees, s, floor, blocks) {
  const a = THREE.MathUtils.degToRad(rotDegrees), g = tpl.grid;
  const into = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(s, s, s)).invert();
  picks.push({ item, holder, grid: g, into });
  const plan = blocks && planOf(g, (floor + (tpl.leafy ? 0.2 : 0.25) - y) / s, (floor + (tpl.leafy ? 0.8 : 1.5) - y) / s);
  if (!plan) return;
  const far = Math.hypot(Math.max(-g.min.x, g.min.x + g.nx * g.cell), Math.max(-g.min.z, g.min.z + g.nz * g.cell)) * s;
  colliders.push({ plan, grid: g, x, z, cos: Math.cos(a), sin: Math.sin(a), s, far });
}
const lives = [];                  // objects that open
const waiting = [];                // placements whose support is not built yet
const placed = new Map();          // layout name → { x, y, z, rot, top }
let triangleCount = 0, instanceCount = 0;

function putOne(entry, spot) {
  const { item, tpl } = entry;
  let { x, z } = spot, y = spot.y ?? (inHouse(x, z) ? HOUSE.floor : ground(x, z));
  const floor = y;
  if (item.hang) y = HOUSE.wall - tpl.size.y * (spot.s || 1) + (item.up || 0);      // `up`: how much of its rod is above the ceiling
  const rot = spot.rot || 0;
  if (spot.on) {
    const base = placed.get(spot.on);
    if (!base) { waiting.push([entry, spot]); return; }
    const a = THREE.MathUtils.degToRad(base.rot);
    x = base.x + (spot.dx || 0) * Math.cos(a) + (spot.dz || 0) * Math.sin(a);
    z = base.z - (spot.dx || 0) * Math.sin(a) + (spot.dz || 0) * Math.cos(a);
    const rest = surfaceAt(base.grid, spot.dx || 0, spot.dz || 0);
    y = rest > -Infinity ? base.y + rest * base.s : base.top;
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
  sunStale = true;
  const s = spot.s || 1, turned = rot + (spot.on ? (placed.get(spot.on)?.rot || 0) : 0);
  stands(item, holder, tpl, x, y, z, turned, s, floor, item.solid !== false && !spot.on && tpl.size.y * s > 0.35);
  triangleCount += tpl.triangles;
  instanceCount += 1;
  placed.set(spot.name || item.id, { x, y, z, rot: turned, top: y + tpl.size.y * s, grid: tpl.grid, s });
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
    const y = ground(x, z);
    spots.push({ x, z, y, at: rule.zone === 'pond' ? -0.405 : y - 0.04, rot: rand() * 360, s });      // (lily pads float just clear of the water: level with it, they flicker)
    taken.push({ x, z, r: gap });
  }
  if (!spots.length) return;
  const dummy = new THREE.Object3D();
  const place = (sp) => {
    dummy.position.set(sp.x, sp.at, sp.z);
    dummy.rotation.set(0, THREE.MathUtils.degToRad(sp.rot), 0);
    dummy.scale.setScalar(sp.s);
    dummy.updateMatrix();
    return dummy.matrix;
  };
  for (const p of tpl.parts) {
    const shadow = rule.shadow !== false && !p.material.transparent;
    if (spots.length <= 10) {                       // each its own object, so one out of view is not drawn
      for (const sp of spots) {
        const mesh = new THREE.Mesh(p.geometry, p.material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(place(sp));
        mesh.castShadow = shadow;
        mesh.receiveShadow = true;
        outdoors.add(mesh);
      }
    } else {
      const mesh = new THREE.InstancedMesh(p.geometry, p.material, spots.length);
      spots.forEach((sp, i) => mesh.setMatrixAt(i, place(sp)));
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      outdoors.add(mesh);
    }
  }
  for (const sp of spots) stands(item, null, tpl, sp.x, sp.at, sp.z, sp.rot, sp.s, sp.y, !!rule.trunk);
  sunStale = true;
  triangleCount += tpl.triangles * spots.length;
  instanceCount += spots.length;
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

const stats = { total: 0, done: 0, failed: [], python: 0, fromCache: 0, started: performance.now(), times: {} };
const FRESH = new URLSearchParams(location.search).has('fresh');      // ?fresh rebuilds everything, ignoring the cache

async function buildAll() {
  const manifest = await (await fetch('data/world.json')).json();
  const items = manifest.items;
  for (const item of items) {                       // the room an object is in: its own, or that of what it stands on
    let spot = PLACE.find((p) => p.id === item.id);
    while (spot?.on) spot = PLACE.find((p) => (p.name || p.id) === spot.on);
    item.room = spot ? roomAt(spot.x, spot.z) : null;
    item.indoors = !!item.room;
  }
  stats.total = items.length;
  window.world = { stats, items, things, failures: stats.failed };
  credits(items);
  const [db] = await Promise.all([openCache(), loadCsg()]);
  const land = (item, json, ms, cached) => {
    const landed = performance.now();
    try {
      const built = build(JSON.parse(json), { soften: item.source === 'Sand3D Nature' ? 0 : 0.0035 });
      arrive(item, template(built, item));
      stats.python += ms;
      stats.times[item.id] = Math.round(ms);
      if (cached) stats.fromCache += 1;
    } catch (error) {
      stats.failed.push({ id: item.id, error: String(error.message || error) });
      console.warn('could not build', item.id, error);
    }
    stats.meshing = (stats.meshing || 0) + performance.now() - landed;
    stats.done += 1;
    progress(item);
  };
  const keyOf = (item) => `${CACHE_VERSION}:${item.lod || 1}:${item.key}`;
  const missing = [];
  for (const item of items) {
    const hit = FRESH ? null : await cacheGet(db, keyOf(item));
    if (hit) { land(item, hit, 0, true); await new Promise((r) => setTimeout(r)); } else missing.push(item);
  }
  if (!missing.length) return;
  // A few workers share the queue, light objects first so the house fills quickly.
  const queue = [...missing].sort((p, q) => (p.lod ? 1 : 0) - (q.lod ? 1 : 0));
  const byId = new Map(missing.map((item) => [item.id, item]));
  const workers = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 2, queue.length));      // (six was three times slower in all: they starve each other)
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
  if (done) { stats.seconds = (performance.now() - stats.started) / 1000; $('progress').hidden = true; roomsStale = true; }
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

function blocked(x, z, r = 0.28) {
  for (const c of colliders) {
    if (c.plan) {
      const dx = x - c.x, dz = z - c.z;
      if (dx * dx + dz * dz > (c.far + r) ** 2) continue;
      // into the object's own frame, then the cells of its plan within reach
      const { min, cell, nx, nz } = c.grid, reach = r / c.s;
      const lx = (dx * c.cos - dz * c.sin) / c.s - min.x, lz = (dx * c.sin + dz * c.cos) / c.s - min.z;
      const i0 = Math.max(0, Math.floor((lx - reach) / cell)), i1 = Math.min(nx - 1, Math.floor((lx + reach) / cell));
      const j0 = Math.max(0, Math.floor((lz - reach) / cell)), j1 = Math.min(nz - 1, Math.floor((lz + reach) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (!c.plan[j * nx + i]) continue;
        const ex = lx - Math.max(i * cell, Math.min(lx, (i + 1) * cell)), ez = lz - Math.max(j * cell, Math.min(lz, (j + 1) * cell));
        if (ex * ex + ez * ez < reach * reach) return true;
      }
      continue;
    }
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
  let hit = null, reach = ray.intersectObjects(walls, false)[0]?.distance ?? ray.far;
  for (const pick of picks) {
    const d = touched(pick, ray.ray, reach);
    if (d < reach) { reach = d; hit = pick; }
  }
  const item = hit ? hit.item : null, holder = hit ? hit.holder : null;
  seen = item ? { item, holder } : null;
  const live = seen && lives.find((l) => l.holder === holder);
  $('name').textContent = item ? item.title : '';
  $('about').textContent = item ? `${item.program.split('\n').length} lines of Python · ${item.source}${live ? ' · press E to ' + (live.open ? 'close' : 'open') : ''}` : '';
}
// How far along a ray the first filled cell of an object's grid is, or Infinity.
const rayFrom = new THREE.Vector3(), rayStep = new THREE.Vector3();
function touched(pick, line, reach) {
  const { min, cell, nx, ny, nz, data } = pick.grid;
  rayFrom.copy(line.origin).applyMatrix4(pick.into);
  rayStep.copy(line.origin).add(line.direction).applyMatrix4(pick.into).sub(rayFrom);      // one metre of the ray, in the object's frame
  let t0 = 0, t1 = reach;
  for (const [o, d, lo, n] of [[rayFrom.x, rayStep.x, min.x, nx], [rayFrom.y, rayStep.y, min.y, ny], [rayFrom.z, rayStep.z, min.z, nz]]) {
    const hi = lo + n * cell;
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    const a = (lo - o) / d, b = (hi - o) / d;
    t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    if (t0 > t1) return Infinity;
  }
  const dt = cell * 0.5 / rayStep.length();
  for (let t = t0; t <= t1; t += dt) {
    const ix = Math.floor((rayFrom.x + rayStep.x * t - min.x) / cell), iy = Math.floor((rayFrom.y + rayStep.y * t - min.y) / cell), iz = Math.floor((rayFrom.z + rayStep.z * t - min.z) / cell);
    if (ix >= 0 && iy >= 0 && iz >= 0 && ix < nx && iy < ny && iz < nz && data[(iy * nz + iz) * nx + ix]) return t;
  }
  return Infinity;
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
    if (!l.item.indoors) sunStale = true;
    if (l.item.indoors) redrawLampShadows([lamps.reduce((a, b) => (a.position.distanceToSquared(l.holder.position) < b.position.distanceToSquared(l.holder.position) ? a : b))]);
  }
}

// ---------------------------------------------------------------- go
makeTerrain();
makeHouse();
const grass = makeGrass({ pond: POND, house: HOUSE });
outdoors.add(grass.mesh);
buildAll().catch((error) => { $('building').textContent = `Could not start: ${error.message || error}`; console.error(error); });

// Under the furniture: the rooms' contents are looked at from the floor up, and how near the
// lowest thing hangs over each spot is kept as a picture. The floors darken by it (look.js), so a
// sofa sits on the boards and does not float over them. Taken once the house is furnished.
const SHADE_REACH = 1.1;           // metres over the floor that count
const heightOver = new THREE.ShaderMaterial({
  side: THREE.DoubleSide, uniforms: { uFloor: { value: HOUSE.floor }, uReach: { value: SHADE_REACH } },
  vertexShader: 'varying float vUp; uniform float uFloor, uReach; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vUp = (w.y - uFloor) / uReach; gl_Position = projectionMatrix * viewMatrix * w; }',
  fragmentShader: 'varying float vUp; void main() { gl_FragColor = vec4(vec3(clamp(vUp, 0.0, 1.0)), 1.0); }',
});
function shadeFloors() {
  const up = new THREE.OrthographicCamera(HOUSE.x0, HOUSE.x1, -HOUSE.z0, -HOUSE.z1, 0, SHADE_REACH);
  up.position.set(0, HOUSE.floor + 0.004, 0);
  up.up.set(0, 0, 1);
  up.lookAt(0, 10, 0);
  up.updateMatrixWorld(true);
  floorShadeInto.multiplyMatrices(up.projectionMatrix, up.matrixWorldInverse);
  const hidden = [outdoors, shell, sky].filter((o) => o.visible), colour = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  hidden.forEach((o) => { o.visible = false; });
  scene.overrideMaterial = heightOver;
  renderer.setClearColor('#ffffff', 1);
  renderer.setRenderTarget(floorShade);
  renderer.clear();
  renderer.render(scene, up);
  renderer.setRenderTarget(null);
  renderer.setClearColor(colour, alpha);
  scene.overrideMaterial = null;
  hidden.forEach((o) => { o.visible = true; });
}

// Each room is lit by itself: its middle is photographed all round (windows, sunlit floor, the
// colour of its walls) and that picture, blurred, is what lights and is mirrored by everything in
// the room. Taken twice, so the second picture holds the first one's light: one bounce more.
const roomEye = new THREE.CubeCamera(0.05, 400, new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType }));
const roomBlur = new THREE.PMREMGenerator(renderer);
let roomsStale = false, roomGain = QUALITY === 'low' ? 1 : 0.6;      // (the windows' own light, where there is any, is the rest)
function lightRooms(bounces = 2) {
  // One picture from the middle of a room over-counts the floor, which fills half of it: with the
  // floor at full colour the ceilings came out orange. It is photographed half as saturated.
  const hsl = {}, kept = floorPaints.map((m) => m.color.clone());
  for (const m of floorPaints) { m.color.getHSL(hsl); m.color.setHSL(hsl.h, hsl.s * 0.5, hsl.l); }
  for (let b = 0; b < bounces; b++) for (const room of ROOMS) {
    roomEye.position.set(room.eye[0], HOUSE.floor + 1.35, room.eye[1]);
    roomEye.update(renderer, scene);
    const was = room.light;
    room.light = roomBlur.fromCubemap(roomEye.renderTarget.texture);
    setRoomLight(room.name, room.light.texture, roomGain);
    was?.dispose();
  }
  floorPaints.forEach((m, i) => m.color.copy(kept[i]));
}

// The lamps' shadows are drawn rarely, with the outdoors hidden: five lamps look six ways each,
// and the trees have no business in that.
const tiny = new THREE.WebGLRenderTarget(4, 4);
function redrawLampShadows(which = lamps) {
  outdoors.visible = false;
  sky.visible = false;
  for (const lamp of which) lamp.shadow.needsUpdate = true;
  renderer.setRenderTarget(tiny);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  outdoors.visible = true;
  sky.visible = true;
}
function followSun() {
  // (it moves on only once the walker is well past the halfway line, so pacing across one does not redraw the shadows each time)
  if (sun.position.y > 1 && Math.abs(me.x - sun.target.position.x) < 6 && Math.abs(me.z - sun.target.position.z) < 6) return;
  const x = Math.round(me.x / 8) * 8, z = Math.round(me.z / 8) * 8;
  sun.target.position.set(x, 0, z);
  sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 110);
  sun.target.updateMatrixWorld();
  sunStale = true;
}
// The windows' light is only worked out while the walker is in the house: it reaches every
// surface in the world, and outdoors that cost a third of each frame for nothing to see.
function daylight() {
  const on = roomsStale || inHouse(me.x, me.z, 0.6);
  if (dayLights.length && dayLights[0].visible !== on) for (const light of dayLights) light.visible = on;
}
const draw = () => {
  if (lampsStale && performance.now() - lampsStale > 400) { lampsStale = 0; redrawLampShadows(); }
  if (sunStale) { sunStale = false; sun.shadow.needsUpdate = true; }
  if (roomsStale && !lampsStale) { roomsStale = false; shadeFloors(); lightRooms(); }
  renderer.setRenderTarget(sceneTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
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
  const goal = inHouse(me.x, me.z) ? EXPOSURE.indoors : EXPOSURE.outdoors;
  renderer.toneMappingExposure += (goal - renderer.toneMappingExposure) * Math.min(1, dt * 2.2);
  finish.uniforms.uTime.value = (now / 1000) % 10;
  daylight();
  grass.update(camera.position, now / 1000, inHouse(me.x, me.z) ? 0.4 : 1);
  followSun();
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
  grass.update(camera.position, performance.now() / 1000, inHouse(me.x, me.z) ? 0.4 : 1);
  followSun();
  sun.target.updateMatrixWorld();
  renderer.toneMappingExposure = inHouse(me.x, me.z) ? EXPOSURE.indoors : EXPOSURE.outdoors;
  daylight();
  draw();
  return `${$('name').textContent} | ${$('about').textContent}`;
};
Object.assign(window, { me, colliders, scene, camera, renderer, lives, interact, walk, blocked, lamps, EXPOSURE, floorShade, relight: (gain = roomGain) => { roomGain = gain; lightRooms(); } });
