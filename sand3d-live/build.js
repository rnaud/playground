// Turns the scene a sand3d program describes (see sand3d.py: `scene`) into three.js objects.
// Two kinds of solid arrive: an extruded outline, and a stack of rings (revolve, sweep, loft).
// Cuts are resolved here, piece by piece, with three-bvh-csg.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

const CREASE = THREE.MathUtils.degToRad(32);
let csg = null;            // the boolean library, loaded on first need
let csgFailed = false;

export async function loadCsg() {
  if (csg || csgFailed) return csg;
  try { csg = await import('three-bvh-csg'); } catch (error) { csgFailed = true; console.warn('booleans unavailable', error); }
  return csg;
}

const mat4 = (m) => new THREE.Matrix4().set(...m);

function area(loop) {
  let a = 0;
  for (let i = 0; i < loop.length; i++) { const p = loop[i], q = loop[(i + 1) % loop.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}

function inside(pt, loop) {
  let hit = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const a = loop[i], b = loop[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) hit = !hit;
  }
  return hit;
}

// Outward miter direction at each point of a loop, for a tapered prism's inset.
function miters(loop, sign) {
  const n = loop.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = loop[(i + n - 1) % n], b = loop[i], c = loop[(i + 1) % n];
    const d0 = norm2(b[0] - a[0], b[1] - a[1]), d1 = norm2(c[0] - b[0], c[1] - b[1]);
    const n0 = [d0[1] * sign, -d0[0] * sign], n1 = [d1[1] * sign, -d1[0] * sign];
    let bis = norm2(n0[0] + n1[0], n0[1] + n1[1]);
    if (!bis[0] && !bis[1]) bis = n0;
    out.push([bis[0], bis[1], 1 / Math.max(bis[0] * n0[0] + bis[1] * n0[1], 0.1)]);
  }
  return out;
}
const norm2 = (x, y) => { const l = Math.hypot(x, y); return l < 1e-12 ? [0, 0] : [x / l, y / l]; };

// The corners of a plain outline eased by a small radius, as real furniture edges are.
function eased(loop, r) {
  if (loop.length > 12) return loop;
  const n = loop.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = loop[(i + n - 1) % n], p = loop[i], c = loop[(i + 1) % n];
    const u0 = [a[0] - p[0], a[1] - p[1]], u1 = [c[0] - p[0], c[1] - p[1]], l0 = Math.hypot(...u0), l1 = Math.hypot(...u1);
    const cos = (u0[0] * u1[0] + u0[1] * u1[1]) / Math.max(l0 * l1, 1e-12);
    const back = Math.min(r, l0 * 0.3, l1 * 0.3);
    if (cos < -0.9 || cos > 0.95 || back < 1e-9) { out.push(p); continue; }
    const s = [p[0] + u0[0] / l0 * back, p[1] + u0[1] / l0 * back], e = [p[0] + u1[0] / l1 * back, p[1] + u1[1] / l1 * back];
    for (let k = 0; k <= 3; k++) { const t = k / 3, w = 1 - t; out.push([w * w * s[0] + 2 * w * t * p[0] + t * t * e[0], w * w * s[1] + 2 * w * t * p[1] + t * t * e[1]]); }
  }
  return out;
}

function extrude(g, soften = 0) {
  const tris = [];
  const drawn = soften > 0 && !g.twist ? g.loops.map((l) => eased(l, soften)) : g.loops;
  const outers = drawn.filter((l) => l.length > 2 && area(l) > 0);
  const holes = drawn.filter((l) => l.length > 2 && area(l) < 0);
  const span = g.hi - g.lo, tan = Math.tan(THREE.MathUtils.degToRad(g.taper || 0));
  const twisted = Math.max(1, Math.ceil(Math.abs(g.twist || 0) / 3));
  for (const outer of outers) {
    const mine = holes.filter((h) => inside(h[0], outer));
    const loops = [outer, ...mine];
    const offsets = loops.map((l) => miters(l, 1));
    // Heights to cut the prism at, and how far the outline is drawn in at each: the rounded or
    // chamfered rims a fillet asked for, then the straight (or twisted) wall between them.
    const xs = outer.map((p) => p[0]), ys = outer.map((p) => p[1]);
    const limit = Math.min(span * 0.45, 0.3 * Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    const round = g.round || (soften > 0 && !g.twist ? { top: soften, bottom: soften } : {}), steps = round.flat ? 1 : (g.round ? 4 : 2);
    const rb = Math.max(0, Math.min(round.bottom || 0, limit)), rt = Math.max(0, Math.min(round.top || 0, limit));
    const cuts = [];
    if (rb > 0) for (let k = 0; k < steps; k++) { const a = k / steps * Math.PI / 2; cuts.push([g.lo + rb * (1 - Math.cos(a)), round.flat ? rb : rb * (1 - Math.sin(a))]); }
    for (let k = 0; k <= twisted; k++) cuts.push([g.lo + rb + (span - rb - rt) * k / twisted, 0]);
    if (rt > 0) for (let k = 1; k <= steps; k++) { const a = k / steps * Math.PI / 2; cuts.push([g.hi - rt + rt * Math.sin(a), round.flat ? rt : rt * (1 - Math.cos(a))]); }
    const rings = cuts.map(([z, drawn]) => {
      const inset = drawn + (z - g.lo) * tan;
      const turn = THREE.MathUtils.degToRad((g.twist || 0) * (span ? (z - g.lo) / span : 0)), c = Math.cos(turn), s = Math.sin(turn);
      return loops.map((loop, li) => loop.map((p, i) => {
        let x = p[0], y = p[1];
        if (inset) { const m = offsets[li][i]; x -= m[0] * inset * m[2]; y -= m[1] * inset * m[2]; }
        return [x * c - y * s, x * s + y * c, z];
      }));
    });
    const v2 = (l) => l.map((p) => new THREE.Vector2(p[0], p[1]));
    const faces = THREE.ShapeUtils.triangulateShape(v2(outer), mine.map(v2));
    const bottom = rings[0].flat(), top = rings[rings.length - 1].flat();
    for (const [a, b, c] of faces) { tris.push(bottom[c], bottom[b], bottom[a]); tris.push(top[a], top[b], top[c]); }
    for (let k = 0; k < rings.length - 1; k++) {
      loops.forEach((loop, li) => {
        const lower = rings[k][li], upper = rings[k + 1][li], n = loop.length;
        for (let j = 0; j < n; j++) {
          const j1 = (j + 1) % n;
          tris.push(lower[j], lower[j1], upper[j1], lower[j], upper[j1], upper[j]);
        }
      });
    }
  }
  return fromTriangles(tris);
}

// A ring's outline flattened onto its own plane, to cap it.
function cap(ring, flip, tris) {
  if (ring.length < 3) return;
  const n = new THREE.Vector3();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  if (n.lengthSq() < 1e-18) return;
  n.normalize();
  const u = new THREE.Vector3(1, 0, 0);
  if (Math.abs(n.x) > 0.9) u.set(0, 1, 0);
  u.sub(n.clone().multiplyScalar(u.dot(n))).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const flat = ring.map((p) => new THREE.Vector2(p[0] * u.x + p[1] * u.y + p[2] * u.z, p[0] * v.x + p[1] * v.y + p[2] * v.z));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(flat, [])) {
    if (flip) tris.push(ring[c], ring[b], ring[a]); else tris.push(ring[a], ring[b], ring[c]);
  }
}

function rings(g) {
  const tris = [], R = g.rings, count = R.length;
  for (let k = 0; k < (g.loop ? count : count - 1); k++) {
    const a = R[k], b = R[(k + 1) % count], n = a.length;
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      tris.push(a[j], a[j1], b[j1], a[j], b[j1], b[j]);
    }
  }
  if (g.caps && !g.loop) { cap(R[0], true, tris); cap(R[count - 1], false, tris); }
  return fromTriangles(tris);
}

// Triangles as a geometry: empty ones dropped, the whole turned outward by its signed volume.
function fromTriangles(points) {
  const out = [];
  let volume = 0;
  for (let i = 0; i < points.length; i += 3) {
    const [a, b, c] = [points[i], points[i + 1], points[i + 2]];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nx + ny * ny + nz * nz < 1e-20) continue;
    volume += a[0] * nx + a[1] * ny + a[2] * nz;
    out.push(a, b, c);
  }
  const position = new Float32Array(out.length * 3);
  for (let i = 0; i < out.length; i += 3) {
    const tri = volume < 0 ? [out[i], out[i + 2], out[i + 1]] : [out[i], out[i + 1], out[i + 2]];
    tri.forEach((p, k) => position.set(p, (i + k) * 3));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  return geometry;
}

// A mesh made in Python: triangles as they are, one colour a face when a colour function gave them.
function mesh(g) {
  const position = new Float32Array(g.f.length * 3), color = g.c ? new Float32Array(g.f.length * 3) : null;
  const tint = new THREE.Color();
  for (let i = 0; i < g.f.length; i++) {
    const v = g.f[i] * 3;
    position[i * 3] = g.v[v]; position[i * 3 + 1] = g.v[v + 1]; position[i * 3 + 2] = g.v[v + 2];
    if (color) {
      const f = Math.floor(i / 3) * 3;
      tint.setRGB(g.c[f], g.c[f + 1], g.c[f + 2], THREE.SRGBColorSpace);
      color[i * 3] = tint.r; color[i * 3 + 1] = tint.g; color[i * 3 + 2] = tint.b;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  if (color) geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
  return geometry;
}

function solid(g, m, soften = 0) {
  const geometry = g.t === 'mesh' ? mesh(g) : g.t === 'extrude' ? extrude(g, soften) : rings(g);
  const matrix = mat4(m);
  geometry.applyMatrix4(matrix);
  if (matrix.determinant() < 0) {             // a mirror turns the faces inside out: turn them back
    const p = geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
  }
  return geometry;
}

function shaded(geometry, flat) {
  geometry.deleteAttribute('normal');
  geometry.deleteAttribute('uv');
  const plain = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat) { plain.computeVertexNormals(); return plain; }     // unindexed: one normal a face
  return toCreasedNormals(plain, CREASE);
}

function piece(p, stats) {
  let geometry = solid(p.g, p.m, stats.soften);
  const tools = [...p.cuts.map((t) => [t, 'SUBTRACTION']), ...p.keeps.map((t) => [t, 'INTERSECTION'])];
  if (tools.length && geometry.attributes.position.count) {
    if (!csg) { stats.uncut += tools.length; return shaded(geometry, p.g.flat); }
    const painted = Boolean(geometry.attributes.color);
    try {
      const evaluator = new csg.Evaluator();
      evaluator.attributes = painted ? ['position', 'normal', 'color'] : ['position', 'normal'];
      evaluator.useGroups = false;
      geometry.computeVertexNormals();
      let brush = new csg.Brush(geometry);
      for (const [tool, op] of tools) {
        const g = solid(tool.g, tool.m);
        if (!g.attributes.position.count) continue;
        g.computeVertexNormals();
        if (painted) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(0.2), 3));
        brush = evaluator.evaluate(brush, new csg.Brush(g), csg[op]);
        stats.cuts += 1;
      }
      geometry = brush.geometry;
    } catch (error) {
      stats.uncut += tools.length;
      console.warn('a cut failed, piece left whole', error);
    }
  }
  return shaded(geometry, p.g.flat);
}

const looks = new Map();
function material(look, painted, thin) {
  const key = JSON.stringify(look || null) + (painted ? 'P' : '') + (thin ? 'T' : '');
  if (looks.has(key)) return looks.get(key);
  const l = look || { color: '#8d8d8d', roughness: 0.6 };
  const glassy = (l.transmission || 0) > 0.5;
  const opacity = glassy ? Math.min(l.opacity ?? 1, 0.32) : (l.opacity ?? 1);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(painted ? '#ffffff' : (l.color || '#8d8d8d')), vertexColors: Boolean(painted), roughness: l.roughness ?? 0.5, metalness: l.metallic ?? 0,
    clearcoat: l.coat ?? 0, sheen: l.sheen ?? 0, transparent: opacity < 1, opacity, depthWrite: opacity >= 1,
    side: opacity < 1 || thin ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.userData.kind = l.kind || '';
  if (l.emission) { m.emissive = new THREE.Color(l.color || '#fff1dc'); m.emissiveIntensity = Math.min(l.emission / 6, 2); }
  looks.set(key, m);
  return m;
}

// The whole object: a group in metres, Y up, and the joints that move it.
// `soften` (metres) eases the edges of extruded parts: not in the programs, a finish the page may ask for.
export function build(scene, { soften = 0 } = {}) {
  const stats = { parts: 0, triangles: 0, cuts: 0, uncut: 0, soften: soften / scene.scale };
  const objects = scene.nodes.map((node) => {
    const o = new THREE.Group();
    o.name = node.name;
    o.matrixAutoUpdate = false;
    o.matrix.copy(mat4(node.m));
    for (const p of node.pieces || []) {
      const geometry = piece(p, stats);
      if (!geometry.attributes.position.count) continue;
      const mesh = new THREE.Mesh(geometry, material(node.look, Boolean(geometry.attributes.color), p.g.thin));
      mesh.castShadow = mesh.receiveShadow = true;
      o.add(mesh);
      stats.parts += 1;
      stats.triangles += geometry.attributes.position.count / 3;
    }
    return o;
  });
  const root = new THREE.Group();
  root.matrixAutoUpdate = false;
  root.matrix.makeRotationX(-Math.PI / 2).scale(new THREE.Vector3(scene.scale, scene.scale, scene.scale));
  scene.nodes.forEach((node, i) => (node.parent < 0 ? root : objects[node.parent]).add(objects[i]));
  root.updateMatrixWorld(true);

  // A jointed part hangs on the part its joint was read on, wherever it was grouped.
  const rest = objects.map((o) => o.matrixWorld.clone());
  const joints = [];
  scene.nodes.forEach((node, i) => {
    if (node.jparent < 0 || !node.joints.length) return;
    objects[node.jparent].add(objects[i]);
    const home = rest[node.jparent].clone().invert().multiply(rest[i]);
    objects[i].matrix.copy(home);
    node.joints.forEach((j, k) => joints.push({
      ...j, node: i, index: k, object: objects[i], home,
      pivot: mat4(j.pivot), unpivot: mat4(j.pivot).invert(), value: 0,
      lo: j.range ? j.range[0] : (j.kind === 'prismatic' ? -50 : -180),
      hi: j.range ? j.range[1] : (j.kind === 'prismatic' ? 50 : 180),
    }));
  });
  for (const j of joints) j.leader = j.follows ? joints.find((q) => q.node === j.follows[0] && q.index === j.follows[1]) : null;
  root.updateMatrixWorld(true);

  const motion = new THREE.Matrix4(), axis = new THREE.Vector3();
  function pose() {
    const valueOf = (j, depth = 0) => (j.leader && depth < 8 ? j.ratio * valueOf(j.leader, depth + 1) : j.value);
    const done = new Set();
    for (const j of joints) {
      if (done.has(j.node)) continue;
      done.add(j.node);
      const m = j.home.clone();
      for (const q of joints.filter((x) => x.node === j.node)) {
        if (!q.axis) continue;
        const v = valueOf(q);
        axis.set(...q.axis).normalize();
        if (q.kind === 'prismatic') motion.makeTranslation(axis.x * v, axis.y * v, axis.z * v);
        else motion.makeRotationAxis(axis, THREE.MathUtils.degToRad(v));
        m.multiply(q.pivot).multiply(motion).multiply(q.unpivot);
      }
      j.object.matrix.copy(m);
    }
    root.updateMatrixWorld(true);
  }
  return { root, joints, pose, stats };
}

export function dispose(root) {
  root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}
