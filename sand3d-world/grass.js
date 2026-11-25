// Grass underfoot: one patch of blades that follows the walker, each blade wrapping round to the
// far side as it falls behind, so the lawn never ends. Made here, not from the dataset.
import * as THREE from 'three';

const PATCH = 48, TUFTS = 80000, BLADES = 5, BURIED = 100;

export function makeGrass({ pond, house }) {
  // One tuft: a few tapering blades leaning outward.
  const position = [], uv = [], index = [];
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let b = 0; b < BLADES; b++) {
    const a = rand() * Math.PI * 2, lean = 0.05 + rand() * 0.16, w = 0.005 + rand() * 0.005, h = 0.14 + rand() * 0.16, base = position.length / 3;
    const dx = Math.cos(a), dz = Math.sin(a), ox = (rand() - 0.5) * 0.16, oz = (rand() - 0.5) * 0.16;
    for (const [t, half] of [[0, w], [0.55, w * 0.7], [1, 0]]) {
      const out = lean * t * t;
      for (const side of half ? [-1, 1] : [0]) {
        position.push(ox + dx * out - dz * side * half, t * h - BURIED, oz + dz * out + dx * side * half);
        uv.push(side * 0.5 + 0.5, t);
      }
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  const offsets = new Float32Array(TUFTS * 3);
  for (let i = 0; i < TUFTS; i++) offsets.set([rand() * PATCH, rand() * PATCH, rand()], i * 3);
  geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.instanceCount = TUFTS;

  const uniforms = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aOffset; uniform vec3 uCam; uniform float uTime; varying vec2 vBlade;
        float hills(vec2 p) { return 1.7 * sin(p.x * 0.045 + 1.3) * cos(p.y * 0.04) + 0.8 * sin(p.x * 0.11 + p.y * 0.07) + 0.3 * sin(p.x * 0.23 - p.y * 0.19); }
        float groundAt(vec2 p) {
          float lift = smoothstep(0.0, 16.0, length(max(abs(p) - vec2(10.0, 8.0), 0.0)));
          float dp = distance(p, vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)}));
          return lift * hills(p) * (1.0 - 0.85 * (1.0 - smoothstep(${pond.r.toFixed(2)}, ${(pond.r + 9).toFixed(2)}, dp))) - 1.5 * (1.0 - smoothstep(0.0, ${pond.r.toFixed(2)}, dp));
        }
        float grows(vec2 p) {
          float inHouse = step(abs(p.x), ${(house.x1 + 0.45).toFixed(2)}) * step(abs(p.y), ${(house.z1 + 0.45).toFixed(2)});
          float edge = abs(p.x - 4.75 - 2.2 * sin(p.y * 0.12));
          float path = (1.0 - smoothstep(0.6, 1.5, edge)) * step(4.0, p.y) * step(p.y, 47.0);
          float water = 1.0 - smoothstep(${(pond.r + 0.3).toFixed(2)}, ${(pond.r + 2.5).toFixed(2)}, distance(p, vec2(${pond.x.toFixed(2)}, ${pond.z.toFixed(2)})));
          return (1.0 - inHouse) * (1.0 - path) * (1.0 - water) * step(abs(p.x), 150.0) * step(abs(p.y), 150.0);
        }`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normalize(vec3(position.x * 2.0, 1.0, position.z * 2.0));')
      .replace('#include <begin_vertex>', `
        vec2 cell = mod(aOffset.xy - uCam.xz, ${PATCH.toFixed(1)}) - ${(PATCH / 2).toFixed(1)};
        vec2 spot = cell + uCam.xz;
        float r = aOffset.z, turn = r * 6.2831853;
        float lawn = smoothstep(4.0, 22.0, length(max(abs(spot) - vec2(7.0, 5.0), 0.0)));
        float tall = mix(0.5, 1.3, fract(r * 7.13)) * mix(0.4, 1.0, lawn);
        float keep = grows(spot) * smoothstep(${(PATCH * 0.5).toFixed(1)}, ${(PATCH * 0.34).toFixed(1)}, length(cell));
        vec3 transformed = position + vec3(0.0, ${BURIED.toFixed(1)}, 0.0);
        transformed.xz = mat2(cos(turn), -sin(turn), sin(turn), cos(turn)) * transformed.xz;
        transformed *= vec3(1.0, tall, 1.0) * keep;
        float wind = sin(uTime * 1.6 + spot.x * 0.33 + spot.y * 0.26) * 0.07 + sin(uTime * 3.1 + spot.x * 1.3 - spot.y * 0.8) * 0.02;
        transformed.xz += vec2(wind, wind * 0.6) * uv.y * uv.y * tall;
        transformed += vec3(spot.x, groundAt(spot), spot.y);
        vBlade = vec2(uv.y, r);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vBlade;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 low = mix(vec3(0.02, 0.06, 0.012), vec3(0.035, 0.07, 0.015), vBlade.y);
        vec3 high = mix(vec3(0.10, 0.21, 0.04), vec3(0.20, 0.25, 0.07), fract(vBlade.y * 3.7));
        diffuseColor.rgb = mix(low, high, vBlade.x);`);
  };
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return {
    mesh,
    // `share` of the tufts to draw: fewer when the walker is indoors and sees the lawn only through windows.
    update(eye, seconds, share = 1) { uniforms.uCam.value.copy(eye); uniforms.uTime.value = seconds; geometry.instanceCount = Math.round(TUFTS * share); },
    triangles: TUFTS * BLADES * 3,
  };
}
