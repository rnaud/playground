// How surfaces look. Sand3D objects carry a material kind and a flat colour per part or per face,
// but no textures and no UVs. This file keeps each part's own roughness, metal, coat and glass,
// and adds fine surface detail by kind (grain, weave, pores, ridges) with a projection that needs
// no UVs. The detail is made here from noise: it is this page's addition, not part of the dataset.
import * as THREE from 'three';

// ---------------------------------------------------------------- tileable noise
function lattice(period, seed) {
  const g = new Float32Array(period * period);
  let a = seed >>> 0;
  for (let i = 0; i < g.length; i++) { a = (a * 1664525 + 1013904223) >>> 0; g[i] = a / 4294967296; }
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const at = (i, j) => g[((j % period + period) % period) * period + ((i % period + period) % period)];
    return (at(xi, yi) * (1 - sx) + at(xi + 1, yi) * sx) * (1 - sy) + (at(xi, yi + 1) * (1 - sx) + at(xi + 1, yi + 1) * sx) * sy;
  };
}
// Noise that repeats every `size` pixels: octaves at whole numbers of cells across the tile.
function fbm(size, seed, cellsX, cellsY, octaves = 4) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push([lattice(Math.max(cellsX, cellsY) << o, seed + o * 7919), cellsX << o, cellsY << o, 0.5 ** o]);
  const total = layers.reduce((s, l) => s + l[3], 0);
  return (x, y) => layers.reduce((s, [n, cx, cy, w]) => s + w * n(x / size * cx, y / size * cy), 0) / total;
}

// A detail texture: rgb multiplies the colour (mid grey leaves it alone), alpha is height.
function detail(size, paint) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [tone, height, warm = 0] = paint(x, y);
      const i = (y * size + x) * 4, t = Math.max(0, Math.min(1, tone));
      data[i] = 255 * Math.min(1, t + warm); data[i + 1] = 255 * t; data[i + 2] = 255 * Math.max(0, t - warm);
      data[i + 3] = 255 * Math.max(0, Math.min(1, height));
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

const S = 256;
const made = new Map();
const PAINT = {
  wood: () => { const grain = fbm(S, 11, 2, 48, 4), streak = fbm(S, 12, 1, 9, 3), fine = fbm(S, 13, 8, 128, 2);
    return (x, y) => { const g = grain(x, y), s = streak(x, y), f = fine(x, y); const v = 0.5 + (g - 0.5) * 0.5 + (s - 0.5) * 0.35 + (f - 0.5) * 0.12; return [v, 0.5 + (g - 0.5) * 0.8 + (f - 0.5) * 0.4, (s - 0.5) * 0.06]; }; },
  planks: () => { const grain = fbm(S, 21, 2, 40, 4), streak = fbm(S, 22, 1, 6, 3), board = lattice(8, 23);
    return (x, y) => { const row = Math.floor(y / 32), shift = board(row, 3) * S, col = Math.floor(((x + shift) % S) / 128);
      const seam = Math.min(y % 32, 32 - (y % 32)) < 1.2 || Math.min((x + shift) % 128, 128 - ((x + shift) % 128)) < 1.2;
      const tone = 0.5 + (grain(x, y + row * 37) - 0.5) * 0.4 + (streak(x, y) - 0.5) * 0.2 + (board(row, col) - 0.5) * 0.28;
      return seam ? [0.22, 0.1] : [tone, 0.62 + (grain(x, y) - 0.5) * 0.35, (board(col, row) - 0.5) * 0.05]; }; },
  fabric: () => { const n = fbm(S, 31, 32, 32, 3), slub = fbm(S, 32, 3, 40, 2);
    return (x, y) => { const warp = Math.sin(x * Math.PI / 2), weft = Math.sin(y * Math.PI / 2), over = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? warp * warp : weft * weft;
      return [0.5 + (over - 0.5) * 0.22 + (n(x, y) - 0.5) * 0.25 + (slub(x, y) - 0.5) * 0.12, 0.3 + over * 0.6]; }; },
  leather: () => { const cell = fbm(S, 41, 24, 24, 3), broad = fbm(S, 42, 4, 4, 3);
    return (x, y) => { const c = cell(x, y), crease = Math.abs(c - 0.5) < 0.035 ? 0 : 1; return [0.5 + (broad(x, y) - 0.5) * 0.25 - (1 - crease) * 0.16, 0.25 + crease * 0.55 + (c - 0.5) * 0.3]; }; },
  stone: () => { const broad = fbm(S, 51, 3, 3, 5), speck = fbm(S, 52, 64, 64, 2), crack = fbm(S, 53, 6, 6, 4);
    return (x, y) => { const b = broad(x, y), k = Math.abs(crack(x, y) - 0.5); const line = k < 0.012 ? 0.55 : 1;
      return [(0.5 + (b - 0.5) * 0.55 + (speck(x, y) - 0.5) * 0.3) * (0.75 + 0.25 * line), 0.5 + (b - 0.5) * 0.8 + (speck(x, y) - 0.5) * 0.35 - (1 - line) * 0.5]; }; },
  earth: () => { const broad = fbm(S, 61, 4, 4, 5), grit = fbm(S, 62, 96, 96, 2);
    return (x, y) => [0.5 + (broad(x, y) - 0.5) * 0.45 + (grit(x, y) - 0.5) * 0.4, 0.5 + (broad(x, y) - 0.5) * 0.5 + (grit(x, y) - 0.5) * 0.7]; },
  bark: () => { const ridge = fbm(S, 71, 28, 3, 4), plate = fbm(S, 72, 9, 5, 3), fine = fbm(S, 73, 64, 16, 2);
    return (x, y) => { const r = 1 - Math.abs(ridge(x, y) - 0.5) * 2, p = plate(x, y); const h = Math.pow(r, 2.2) * 0.75 + (p - 0.5) * 0.3;
      return [0.3 + h * 0.5 + (fine(x, y) - 0.5) * 0.2, h + (fine(x, y) - 0.5) * 0.2, (p - 0.5) * 0.05]; }; },
  leaf: () => { const broad = fbm(S, 81, 5, 5, 4), vein = fbm(S, 82, 40, 6, 2);
    return (x, y) => [0.5 + (broad(x, y) - 0.5) * 0.4 + (vein(x, y) - 0.5) * 0.14, 0.5 + (vein(x, y) - 0.5) * 0.5 + (broad(x, y) - 0.5) * 0.3, (broad(y, x) - 0.5) * 0.05]; },
  plaster: () => { const broad = fbm(S, 91, 3, 3, 4), grit = fbm(S, 92, 80, 80, 2);
    return (x, y) => [0.5 + (broad(x, y) - 0.5) * 0.12 + (grit(x, y) - 0.5) * 0.1, 0.5 + (grit(x, y) - 0.5) * 0.8 + (broad(x, y) - 0.5) * 0.3]; },
  brushed: () => { const streak = fbm(S, 101, 2, 128, 3), broad = fbm(S, 102, 3, 3, 3);
    return (x, y) => [0.5 + (streak(x, y) - 0.5) * 0.16 + (broad(x, y) - 0.5) * 0.08, 0.5 + (streak(x, y) - 0.5) * 0.9]; },
  smooth: () => { const broad = fbm(S, 111, 3, 3, 3), fine = fbm(S, 112, 90, 90, 2);
    return (x, y) => [0.5 + (broad(x, y) - 0.5) * 0.07, 0.5 + (fine(x, y) - 0.5) * 0.5]; },
  tiles: () => { const broad = fbm(S, 121, 4, 4, 3), tone = lattice(8, 122);
    return (x, y) => { const gx = x % 64, gy = y % 64, grout = gx < 2 || gy < 2; return grout ? [0.3, 0.15] : [0.5 + (tone(Math.floor(x / 64), Math.floor(y / 64)) - 0.5) * 0.14 + (broad(x, y) - 0.5) * 0.08, 0.7]; }; },
  roof: () => { const tone = lattice(16, 131), broad = fbm(S, 132, 6, 6, 3);
    return (x, y) => { const row = Math.floor(y / 32), u = (x + (row % 2) * 16) % 32, lip = (y % 32) / 32; const edge = u < 1.5 || lip < 0.06;
      return edge ? [0.25, 0.05] : [0.5 + (tone(Math.floor((x + (row % 2) * 16) / 32), row) - 0.5) * 0.3 + (broad(x, y) - 0.5) * 0.15, 0.25 + lip * 0.7]; }; },
  ground: () => { const broad = fbm(S, 141, 3, 3, 5), blades = fbm(S, 142, 110, 40, 2), clump = fbm(S, 143, 14, 14, 3);
    return (x, y) => [0.5 + (broad(x, y) - 0.5) * 0.3 + (clump(x, y) - 0.5) * 0.35 + (blades(x, y) - 0.5) * 0.3, 0.5 + (clump(x, y) - 0.5) * 0.6 + (blades(x, y) - 0.5) * 0.5, (clump(y, x) - 0.5) * 0.06]; },
};
// For each surface: texture repeats per metre, how far it tints, bump depth, roughness swing.
const SURFACE = {
  wood: [1.4, 0.5, 0.35, 0.18], planks: [0.55, 0.6, 0.45, 0.15], fabric: [9, 0.4, 0.5, 0.08], leather: [5, 0.35, 0.4, 0.15],
  stone: [0.9, 0.5, 0.8, 0.2], earth: [0.8, 0.45, 0.7, 0.08], bark: [1.6, 0.6, 1.1, 0.08], leaf: [3, 0.35, 0.3, 0.15],
  plaster: [1.1, 0.3, 0.25, 0.06], brushed: [3, 0.3, 0.12, 0.2], smooth: [2, 0.25, 0.06, 0.05], tiles: [1.6, 0.6, 0.4, 0.12],
  roof: [1.1, 0.7, 0.9, 0.12], ground: [0.45, 0.45, 0.45, 0.04],
};
const SURFACE_OF = {
  oak: 'wood', walnut: 'wood', pine: 'wood', birch: 'wood', fabric: 'fabric', velvet: 'fabric', leather: 'leather',
  rock: 'stone', concrete: 'stone', marble: 'smooth', soil: 'earth', sand: 'earth', bark: 'bark', leaf: 'leaf', moss: 'leaf', grass: 'leaf',
  steel: 'brushed', brushed_steel: 'brushed', aluminium: 'brushed', chrome: 'smooth', brass: 'brushed', copper: 'brushed',
  painted_metal: 'smooth', plastic: 'smooth', glossy_plastic: 'smooth', rubber: 'smooth', ceramic: 'smooth', snow: 'earth', foam: 'smooth',
};

function texture(surface) {
  if (!made.has(surface)) made.set(surface, detail(S, PAINT[surface]()));
  return made.get(surface);
}

// Adds the detail to a standard or physical material: projected along the three axes of the
// object's own space (so it stays put on instances), blended by the facing of the surface.
export function detailed(material, surface, strength = 1) {
  const [scale, tint, bump, rough] = SURFACE[surface];
  const uniforms = { uDetail: { value: texture(surface) }, uDetailScale: { value: scale }, uDetailTint: { value: tint * strength },
    uDetailBump: { value: bump * strength }, uDetailRough: { value: rough * strength } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDetailPos;\nvarying vec3 vDetailNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDetailPos = position;\nvDetailNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vDetailPos; varying vec3 vDetailNormal;
        uniform sampler2D uDetail; uniform float uDetailScale, uDetailTint, uDetailBump, uDetailRough;
        float detailHeight = 0.5;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 w = pow(abs(normalize(vDetailNormal)), vec3(4.0)); w /= (w.x + w.y + w.z);
          vec3 p = vDetailPos * uDetailScale;
          vec4 d = texture2D(uDetail, p.zy) * w.x + texture2D(uDetail, p.xz) * w.y + texture2D(uDetail, p.xy) * w.z;
          diffuseColor.rgb *= mix(vec3(1.0), d.rgb * 2.0, uDetailTint);
          detailHeight = d.a;
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (0.5 - detailHeight) * uDetailRough, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 dH = vec2(dFdx(detailHeight), dFdy(detailHeight)) * uDetailBump * 0.004;   // heights are a few millimetres
          vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
          vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
          float det = dot(sx, r1) * faceDirection;
          normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
        }`);
  };
  material.customProgramCacheKey = () => `detail:${surface}`;
  return material;
}

// The surface a part should wear: its named kind, or wood for a brown part that names only plastic
// (most reconstructed furniture does, though the reference renders show timber).
export function surfaceOf(material) {
  const kind = material.userData.kind || '';
  const hsl = material.color.getHSL({});
  const brown = hsl.h > 0.03 && hsl.h < 0.13 && hsl.s > 0.25 && hsl.l > 0.08 && hsl.l < 0.6;
  if ((kind === 'plastic' || kind === '') && brown && !material.transparent) return 'wood';
  return SURFACE_OF[kind] || 'smooth';
}

let room = null;
export const setIndoorLight = (texture) => { room = texture; };
export const indoorLight = () => room;

// One shared material per look: surface, roughness to a tenth, metal, coat, glass, sidedness, indoors.
const shared = new Map();
export function lookKey(material, indoors) {
  const glass = material.transparent;
  return [surfaceOf(material), Math.round(material.roughness * 10), material.metalness > 0.5 ? 'm' : 'd',
    material.clearcoat > 0.2 ? 'c' : '', glass ? 't' : '', material.side === THREE.DoubleSide && !glass ? '2' : '', indoors ? 'i' : 'o'].join('|');
}
export function lookMaterial(key) {
  if (shared.has(key)) return shared.get(key);
  const [surface, rough, metal, coat, glass, two, where] = key.split('|');
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true, roughness: Math.max(0.05, Number(rough) / 10), metalness: metal === 'm' ? 1 : 0,
    clearcoat: coat ? 0.6 : 0, clearcoatRoughness: 0.2, envMapIntensity: where === 'i' ? 0.3 : 1, envMap: where === 'i' ? room : null,
    side: two || glass ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (glass) Object.assign(m, { transparent: true, opacity: 0.28, roughness: 0.03, depthWrite: false, envMapIntensity: where === 'i' ? 0.6 : 1.6 });
  else detailed(m, surface, surface === 'leaf' && two ? 0.6 : 1);
  shared.set(key, m);
  return m;
}

export function plain(color, surface, { strength = 1, ...options } = {}) {
  return detailed(new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...options }), surface, strength);
}
