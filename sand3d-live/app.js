import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { build, dispose, loadCsg } from './build.js';

const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const $ = (id) => document.getElementById(id);
const stage = $('stage');

// ---------------------------------------------------------------- the view
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#191b24');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.6;
const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const sun = new THREE.DirectionalLight('#fff4e2', 1.7);
sun.position.set(1.5, 4.5, -3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.1, far: 12 });
sun.shadow.bias = -0.0004;
scene.add(sun, new THREE.HemisphereLight('#cfd8ff', '#2a2622', 0.5));
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.32 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const holder = new THREE.Group();
scene.add(holder);

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

// ---------------------------------------------------------------- state
const state = { items: [], current: -1, built: null, playing: !matchMedia('(prefers-reduced-motion: reduce)').matches, results: [] };
let py = null, runProgram = null;

function show(result) {
  if (state.built) { holder.remove(state.built.root); dispose(state.built.root); }
  state.built = result;
  if (!result) return;
  const { root } = result;
  // Fit: the object 2 units across, standing on the floor, centred.
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
  const k = 2 / Math.max(size.x, size.y, size.z, 1e-9);
  const wrap = new THREE.Group();
  wrap.scale.setScalar(k);
  const c = box.getCenter(new THREE.Vector3());
  wrap.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  wrap.add(root);
  result.root = wrap;
  holder.add(wrap);
  const tall = size.y * k;
  controls.target.set(0, tall / 2, 0);
  camera.position.set(3.4, tall / 2 + 2.3, -4.2);        // the dataset's renders look from +X +Y
  controls.update();
}

function jointControls(result) {
  const box = $('joints');
  box.replaceChildren();
  const free = result ? result.joints.filter((j) => !j.leader && j.axis) : [];
  $('jointbox').hidden = !free.length;
  free.forEach((j, i) => {
    const unit = j.kind === 'prismatic' ? ' mm' : '°';
    const row = document.createElement('div');
    row.className = 'joint';
    const id = `joint-${i}`;
    row.innerHTML = `<label for="${id}"></label><output></output><input id="${id}" type="range" step="any">`;
    row.querySelector('label').textContent = `${j.name} · ${j.kind}`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.min = j.lo; input.max = j.hi; input.value = 0;
    const say = () => { out.textContent = `${Number(j.value).toFixed(j.kind === 'prismatic' ? 1 : 0)}${unit}`; };
    input.addEventListener('input', () => { setPlaying(false); j.value = Number(input.value); say(); result.pose(); });
    j.input = input; j.say = say;
    say();
    box.append(row);
  });
}

function setPlaying(on) {
  state.playing = on;
  $('play').textContent = on ? 'Pause motion' : 'Play motion';
  $('play').setAttribute('aria-pressed', String(on));
}
$('play').addEventListener('click', () => setPlaying(!state.playing));
$('rest').addEventListener('click', () => {
  setPlaying(false);
  if (!state.built) return;
  for (const j of state.built.joints) { j.value = 0; if (j.input) { j.input.value = 0; j.say(); } }
  state.built.pose();
});

// One program, start to finish: Python runs it, three.js meshes it.
function make(source, entry) {
  const t0 = performance.now();
  const described = JSON.parse(runProgram(source, entry));
  const t1 = performance.now();
  const result = build(described);
  const t2 = performance.now();
  return { ...result, notes: described.notes, python: t1 - t0, mesh: t2 - t1 };
}

function select(i, source) {
  const item = state.items[i];
  state.current = i;
  for (const b of document.querySelectorAll('#list button')) b.setAttribute('aria-current', String(Number(b.dataset.i) === i));
  $('title').textContent = item.title;
  $('credit').textContent = item.attribution;
  $('ref').src = `data/renders/${item.key}.jpg`;
  if (source === undefined) $('source').value = item.program;
  $('error').textContent = '';
  let result = null;
  try {
    result = make(source ?? item.program, item.entry);
  } catch (error) {
    $('error').textContent = String(error.message || error).split('\n').filter(Boolean).pop();
  }
  show(result);
  jointControls(result);
  const notes = result ? [...result.notes] : [];
  if (result && result.stats.uncut) notes.push(`${result.stats.uncut} cut${result.stats.uncut > 1 ? 's' : ''} could not be made: pieces left whole`);
  $('notes').replaceChildren(...notes.map((n) => Object.assign(document.createElement('li'), { textContent: n })));
  $('exact').hidden = !result || notes.length > 0;
  $('status').innerHTML = result
    ? `<strong>${result.stats.parts}</strong> pieces · <strong>${Math.round(result.stats.triangles).toLocaleString()}</strong> triangles · <strong>${result.joints.length}</strong> joints · ${result.stats.cuts} cuts · Python ${result.python.toFixed(0)} ms + mesh ${result.mesh.toFixed(0)} ms`
    : '';
}

$('rebuild').addEventListener('click', () => select(state.current, $('source').value));
$('revert').addEventListener('click', () => select(state.current));

function animate(now) {
  requestAnimationFrame(animate);
  const b = state.built;
  if (b && state.playing && b.joints.length) {
    const t = now / 1000;
    b.joints.forEach((j, i) => {
      if (j.leader || !j.axis) return;
      const wave = 0.5 - 0.5 * Math.cos(t * 0.9 + i * 0.7);
      const lo = j.range ? j.lo : (j.kind === 'prismatic' ? -30 : -180), hi = j.range ? j.hi : (j.kind === 'prismatic' ? 30 : 180);
      j.value = j.kind === 'continuous' || !j.range ? ((t * 40 + i * 30) % 360) - 180 : lo + (hi - lo) * wave;
      if (j.kind === 'prismatic' && !j.range) j.value = lo + (hi - lo) * wave;
      if (j.input) { j.input.value = j.value; j.say(); }
    });
    b.pose();
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);

// ---------------------------------------------------------------- start: Python, the programs, then every build
async function start() {
  const data = await (await fetch('data/programs.json')).json();
  state.items = data.items;
  const list = $('list');
  state.items.forEach((item, i) => {
    const li = document.createElement('li');
    li.innerHTML = '<button><span class="dot"></span><span class="name"></span><span class="ms"></span></button>';
    const b = li.querySelector('button');
    b.dataset.i = i;
    b.querySelector('.name').textContent = item.title;
    b.addEventListener('click', () => select(i));
    list.append(li);
  });
  const t0 = performance.now();
  const [{ loadPyodide }, shim] = await Promise.all([
    import(`${PYODIDE}pyodide.mjs`), fetch('sand3d.py').then((r) => r.text()), loadCsg(),
  ]);
  py = await loadPyodide({ indexURL: PYODIDE });
  py.FS.writeFile('/home/pyodide/sand3d.py', shim);
  py.runPython('import sand3d');
  runProgram = py.globals.get('sand3d').run;
  const boot = performance.now() - t0;
  $('boot').remove();
  select(0);

  // Build all of them once, a few per frame, to measure what runs.
  let ok = 0, exact = 0, total = 0;
  for (let i = 0; i < state.items.length; i++) {
    const item = state.items[i], button = list.children[i].firstChild, dot = button.querySelector('.dot');
    const entry = { key: item.key, title: item.title };
    try {
      const r = make(item.program, item.entry);
      const approx = r.notes.length > 0 || r.stats.uncut > 0;
      Object.assign(entry, { ok: true, approx, python: r.python, mesh: r.mesh, ...r.stats, joints: r.joints.length, notes: r.notes });
      dispose(r.root);
      ok += 1; exact += approx ? 0 : 1; total += r.python + r.mesh;
      dot.className = `dot ${approx ? 'approx' : 'ok'}`;
      dot.title = approx ? 'Built, with an approximation' : 'Built';
      button.querySelector('.ms').textContent = `${(r.python + r.mesh).toFixed(0)} ms`;
    } catch (error) {
      Object.assign(entry, { ok: false, error: String(error.message || error).trim().split('\n').pop() });
      dot.className = 'dot bad';
      dot.title = entry.error;
    }
    state.results.push(entry);
    $('tally').innerHTML = `<b>${ok}</b> of ${i + 1} built · ${exact} with no approximation`;
    if (i % 4 === 3) await new Promise((r) => setTimeout(r));
  }
  $('tally').innerHTML = `<b>${ok}</b> of ${state.items.length} built · ${exact} with no approximation · ${(total / Math.max(ok, 1)).toFixed(0)} ms each · Python ready in ${(boot / 1000).toFixed(1)} s`;
  window.spike = { boot, ok, exact, average: total / Math.max(ok, 1), results: state.results };
}

start().catch((error) => {
  $('tally').textContent = 'Could not start';
  ($('boot') || $('error')).textContent = `Could not start: ${error.message || error}`;
  console.error(error);
});
