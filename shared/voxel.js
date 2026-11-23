'use strict';
// Voxel meshing and the WebGL renderer, shared by the voxel playground and the Getaway game.
// ---------- meshing: one quad per voxel face that touches empty space (bottom faces are never seen) ----------
const FACES = [ // normal, then the 4 corners of the face on the unit cube
  [[1, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
  [[-1, 0, 0], [0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]],
  [[0, 1, 0], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]],
  [[0, -1, 0], [0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
];
function buildMesh(d) {
  const { W, L, H, fn } = d, grid = new Array(W * L * H), at = (x, y, z) => x < 0 || y < 0 || z < 0 || x >= W || y >= L || z >= H ? (d.outside ? d.outside(x, y, z) : null) : grid[(z * L + y) * W + x];   // d.outside lets a model say what lies beyond its own grid, so faces against it are skipped
  let voxels = 0;
  for (let z = 0; z < H; z++) for (let y = 0; y < L; y++) for (let x = 0; x < W; x++) { const c = fn(x, y, z); grid[(z * L + y) * W + x] = c; if (c != null) voxels++; }
  const v = [], top = [];
  for (let z = 0; z < H; z++) for (let y = 0; y < L; y++) for (let x = 0; x < W; x++) {
    const c = at(x, y, z);
    if (c == null) continue;
    for (const [n, ...q] of FACES) {
      if (at(x + n[0], y + n[1], z + n[2]) != null) continue;
      for (const i of [0, 1, 2, 0, 2, 3]) // x,y centred on the model; z is the corner (0/1) and the layer travels separately so it can be exploded
        (n[2] ? [v, top] : [v]).forEach(out => out.push(x + q[i][0] - W / 2, y + q[i][1] - L / 2, q[i][2], z, (c >> 16 & 255) / 255 + (c > 0xffffff ? 2 : 0), (c >> 8 & 255) / 255, (c & 255) / 255, n[0], n[1], n[2]));
    }
  }
  return { ...d, data: new Float32Array(v), count: v.length / 10, top: new Float32Array(top), topCount: top.length / 10, voxels }; // `top` alone is enough to cast the shadow
}

// ---------- renderer ----------
// Top-down uses the same camera as the sprite page: orthographic, ground squashed by sin(pitch), height shown
// by cos(pitch). On foot (u_proj.w = 1) the very same meshes go through an ordinary perspective projection.
const PROJ = `
uniform vec4 u_eye; uniform vec4 u_proj; // eye x,y,yaw,height / focal,near,far,enabled
vec4 persp(vec2 world, float height, vec4 view) {
  vec2 d = world - u_eye.xy; float c = cos(u_eye.z), s = sin(u_eye.z), f = d.x * c + d.y * s;
  return vec4((d.y * c - d.x * s) * u_proj.x / (view.x * 0.5), (height - u_eye.w) * u_proj.x / (view.y * 0.5),
              (f * (u_proj.z + u_proj.y) - 2.0 * u_proj.z * u_proj.y) / (u_proj.z - u_proj.y), f);
}`;
const FOG = `uniform vec4 u_fog; float fogk(float dist) { return clamp((dist - u_fog.a) / (${FP.far.toFixed(1)} - u_fog.a), 0.0, 1.0); } vec3 fog(vec3 c, float dist) { return mix(c, u_fog.rgb, fogk(dist)); }`;
const VS = `
attribute vec3 a_pos; attribute float a_layer; attribute vec3 a_color; attribute vec3 a_normal;
uniform vec2 u_obj; uniform float u_rot; uniform vec3 u_cam; uniform vec2 u_pitch; uniform vec4 u_view;
uniform float u_scale, u_explode, u_zscale, u_H, u_flat, u_light, u_shade, u_vox; uniform vec3 u_litA, u_litB; uniform vec2 u_shift; uniform vec3 u_fall; uniform float u_lift, u_flash; // fall: direction x,y + angle; lift: height above the ground
varying vec3 v_color; varying float v_dist, v_em;` + PROJ + `
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(p.x * c - p.y * s, p.x * s + p.y * c); }
void main() {
  float raw = (a_layer * u_explode + a_pos.z) * u_zscale;             // height before a knocked-over object tips
  vec2 world = u_obj + rot(a_pos.xy * u_vox, u_rot) + u_fall.xy * sin(u_fall.z) * raw;   // u_vox: world units per voxel, for models finer than the grid
  float up = (raw * cos(u_fall.z) + u_lift) * (1.0 - u_flat);
  if (u_proj.w > 0.5) {
    gl_Position = persp(world + u_shift * u_flat, up, u_view); v_dist = gl_Position.w;
  } else {
    vec2 r = rot(world - u_cam.xy, -u_cam.z) * u_scale; float h = up * u_scale;
    float sx = u_view.z + r.x + u_shift.x * u_flat, sy = u_view.w + r.y * u_pitch.x - h * u_pitch.y + u_shift.y * u_flat * u_pitch.x;
    vec2 org = rot(-u_cam.xy, -u_cam.z), os = u_view.zw + vec2(org.x, org.y * u_pitch.x), snap = floor(os + 0.5) - os;
    sx += snap.x; sy += snap.y;   // snap the camera (not each object) to whole pixels: the world pans as one rigid image, with no crawling edges
    gl_Position = vec4(sx / u_view.x * 2.0 - 1.0, 1.0 - sy / u_view.y * 2.0, -(r.y * u_pitch.y + h * u_pitch.x) / 4000.0, 1.0); v_dist = 0.0;
  }
  vec2 n = rot(a_normal.xy, u_rot);                                   // world-space sun, so faces relight as things turn
  float side = 0.55 + 0.35 * max(0.0, dot(n, normalize(vec2(-0.5, 0.85))));
  float k = mix(1.0, a_normal.z > 0.5 ? 1.0 : side, u_light);
  k *= mix(1.0, 0.62 + 0.38 * a_layer / max(1.0, u_H - 1.0), u_shade);
  v_em = step(1.5, a_color.r);                                         // a red channel above 1 marks a voxel that glows: it ignores the light and feeds the glow pass
  vec3 lit = mix(u_litA, u_litB, clamp(a_pos.x * u_vox / 16.0 + 0.5, 0.0, 1.0));
  v_color = mix((a_color - vec3(2.0 * v_em, 0.0, 0.0)) * k * mix(lit, vec3(1.0), v_em), vec3(1.0), u_flash);
}`;
const FS = `precision mediump float; varying vec3 v_color; varying float v_dist, v_em; uniform vec4 u_tint;` + FOG + `
void main() { bool sh = u_tint.a > 0.0; gl_FragColor = vec4(fog(sh ? u_tint.rgb : v_color, v_dist), sh ? u_tint.a : v_em * (1.0 - fogk(v_dist))); }`;   // alpha carries the glow mask
const GVS = `
attribute vec2 a_p; uniform vec3 u_cam; uniform vec2 u_pitch; uniform vec4 u_view; uniform float u_world, u_height; varying vec2 v_uv; varying float v_dist;` + PROJ + `
void main() {
  if (u_proj.w > 0.5) { gl_Position = persp(a_p, u_height, u_view); v_dist = gl_Position.w; }
  else {
    vec2 d = a_p - u_cam.xy; float c = cos(-u_cam.z), s = sin(-u_cam.z);
    vec2 r = vec2(d.x * c - d.y * s, d.x * s + d.y * c);
    vec2 org = vec2(-u_cam.x * c + u_cam.y * s, -u_cam.x * s - u_cam.y * c), os = u_view.zw + vec2(org.x, org.y * u_pitch.x), snap = floor(os + 0.5) - os;
    gl_Position = vec4((u_view.z + r.x + snap.x) / u_view.x * 2.0 - 1.0, 1.0 - (u_view.w + r.y * u_pitch.x + snap.y) / u_view.y * 2.0, 0.0, 1.0); v_dist = 0.0;
  }
  v_uv = a_p / u_world;
}`;
const GFS = `precision mediump float; varying vec2 v_uv; varying float v_dist; uniform sampler2D u_tex;` + FOG + `
void main() { vec4 t = texture2D(u_tex, v_uv); if (t.a < 0.5) discard; gl_FragColor = vec4(fog(t.rgb, v_dist), 0.0); }`;

const WHITE = [1, 1, 1];
function Renderer(canvas, worldSize = WORLD) {
  const gl = canvas.getContext('webgl', { antialias: false, stencil: true, alpha: false });
  if (!gl) return null;
  const program = (vs, fs) => {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    const u = {}, a = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n] = gl.getUniformLocation(p, n); }
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); i++) { const n = gl.getActiveAttrib(p, i).name; a[n] = gl.getAttribLocation(p, n); }
    return { p, u, a };
  };
  const vox = program(VS, FS), gnd = program(GVS, GFS), buffers = new Map(), texFor = new Map();
  let groundBuf = null, groundTex = null, view = null, pitch = null, eye = null, ss = false;
  // Supersampling: draw at SSx into a texture, then shrink it onto the canvas so each pixel averages SS*SS samples.
  const SS = Math.max(2, Math.min(4, +new URLSearchParams(location.search).get('ss') || 3));
  const blit = program('attribute vec2 a_p; varying vec2 v; void main() { v = a_p * 0.5 + 0.5; gl_Position = vec4(a_p, 0.0, 1.0); }',
    `precision mediump float; varying vec2 v; uniform sampler2D u_tex; uniform vec2 u_texel; uniform float u_bloom;
     void main() { vec4 c = vec4(0.0); for (int i = 0; i < ${SS}; i++) for (int j = 0; j < ${SS}; j++) c += texture2D(u_tex, v + (vec2(float(i), float(j)) + 0.5 - ${(SS / 2).toFixed(1)}) * u_texel); c /= ${(SS * SS).toFixed(1)}; vec3 g = vec3(0.0);
       if (u_bloom > 0.0) for (int i = 0; i < 12; i++) { float a = float(i) * 0.5236; vec2 d = vec2(cos(a), sin(a)) * u_texel * ${(SS * 5).toFixed(1)}; for (int r = 1; r <= 3; r++) { vec4 t = texture2D(u_tex, v + d * float(r)); g += t.rgb * t.a; } }   // glowing voxels spill light onto their neighbours
       gl_FragColor = vec4(c.rgb + g * u_bloom / 36.0, 1.0); }`);
  const fbo = gl.createFramebuffer(), fboTex = gl.createTexture(), fboDepth = gl.createRenderbuffer(), quad = gl.createBuffer();
  gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width * SS, canvas.height * SS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.bindRenderbuffer(gl.RENDERBUFFER, fboDepth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_STENCIL, canvas.width * SS, canvas.height * SS);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, fboDepth);
  const canSS = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const bufferFor = (m, key) => {
    const id = m.name + key;
    if (!buffers.has(id)) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, m[key], gl.STATIC_DRAW); buffers.set(id, b); }
    return buffers.get(id);
  };
  const camera = u => {                                              // uniforms both programs share
    gl.uniform2fv(u.u_pitch, pitch); gl.uniform4fv(u.u_view, view);
    gl.uniform4f(u.u_eye, eye ? eye.x : 0, eye ? eye.y : 0, eye ? eye.yaw : 0, FP.eye);
    gl.uniform4f(u.u_proj, FP.focal, FP.near, FP.far, eye ? 1 : 0);
    gl.uniform4f(u.u_fog, FP.fog[0] / 255, FP.fog[1] / 255, FP.fog[2] / 255, FP.fog0);   // top-down passes distance 0, so it never fogs
  };
  return {
    stats: { draws: 0, tris: 0 },
    // `foot` switches to the first-person perspective camera
    begin(p, cx, cy, clear, foot, smooth) {
      view = [canvas.width, canvas.height, cx, cy]; pitch = [Math.sin(p), Math.cos(p)]; eye = foot || null; ss = !!smooth && canSS;
      this.stats.draws = this.stats.tris = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, ss ? fbo : null);
      gl.viewport(0, 0, canvas.width * (ss ? SS : 1), canvas.height * (ss ? SS : 1));
      gl.clearColor(...clear, 0); gl.clearStencil(0);                    // alpha is the glow mask: the background does not glow
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    },
    clearDepth() { gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); },
    end(bloom) {                                                      // resolve the supersampled frame onto the canvas, optionally with a glow around emissive voxels
      if (!ss) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(blit.p); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      gl.uniform2f(blit.u.u_texel, 1 / (canvas.width * SS), 1 / (canvas.height * SS)); gl.uniform1f(blit.u.u_bloom, bloom || 0);
      gl.bindTexture(gl.TEXTURE_2D, fboTex); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(blit.a.a_p); gl.vertexAttribPointer(blit.a.a_p, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    // a textured horizontal plane: the ground at height 0, or (first person only) a ceiling higher up
    ground(image, cam, height = 0) {
      let groundTex = texFor.get(image);
      if (!groundTex) {
        // copy onto a power-of-two canvas so WebGL1 can build mipmaps: distant ground then averages instead of sparkling
        const S = image.width > 2048 ? 4096 : 2048, pot = mkCanvas(S, S), pg = pot.getContext('2d'); pg.imageSmoothingEnabled = false; pg.drawImage(image, 0, 0, S, S);   // a finer source image gets a finer texture
        groundTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, groundTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, pot); gl.generateMipmap(gl.TEXTURE_2D);
        for (const [k, v] of [[gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
        texFor.set(image, groundTex);
        groundBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, groundBuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, worldSize, 0, worldSize, worldSize, 0, 0, worldSize, worldSize, 0, worldSize]), gl.STATIC_DRAW);
      }
      gl.useProgram(gnd.p); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST);
      camera(gnd.u); gl.uniform3f(gnd.u.u_cam, cam.x, cam.y, cam.a); gl.uniform1f(gnd.u.u_world, worldSize); gl.uniform1f(gnd.u.u_height, height);
      gl.bindTexture(gl.TEXTURE_2D, groundTex); gl.bindBuffer(gl.ARRAY_BUFFER, groundBuf);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, eye ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
      gl.enableVertexAttribArray(gnd.a.a_p); gl.vertexAttribPointer(gnd.a.a_p, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6); this.stats.draws++; this.stats.tris += 2;
    },
    // mode 'shadow': the top faces flattened onto the ground; the stencil stops overlapping faces darkening twice
    draw(m, x, y, rot, cam, o, mode, fall) {
      const u = vox.u, a = vox.a, shadow = mode === 'shadow', count = shadow ? m.topCount : m.count;
      gl.useProgram(vox.p);
      if (shadow) {
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 255); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      } else { gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.STENCIL_TEST); }
      camera(u);
      gl.uniform2f(u.u_obj, x, y); gl.uniform1f(u.u_rot, rot); gl.uniform3f(u.u_cam, cam.x, cam.y, cam.a);
      gl.uniform1f(u.u_scale, o.scale); gl.uniform1f(u.u_explode, o.explode); gl.uniform1f(u.u_zscale, o.zscale * (o.vox || 1)); gl.uniform1f(u.u_vox, o.vox || 1); gl.uniform1f(u.u_H, m.H);
      gl.uniform1f(u.u_flat, shadow ? 1 : 0); gl.uniform2f(u.u_shift, 3, 2);
      gl.uniform3f(u.u_fall, fall && fall.dx || 0, fall && fall.dy || 0, fall && fall.a || 0); gl.uniform1f(u.u_lift, fall && fall.lift || 0); gl.uniform1f(u.u_flash, fall && fall.flash || 0);
      gl.uniform1f(u.u_light, o.light ? 1 : 0); gl.uniform1f(u.u_shade, o.shade ? 1 : 0);
      const la = fall && fall.litA || WHITE, lb = fall && fall.litB || la; gl.uniform3f(u.u_litA, la[0], la[1], la[2]); gl.uniform3f(u.u_litB, lb[0], lb[1], lb[2]);
      gl.uniform4f(u.u_tint, 0, 0, 0, shadow ? 0.28 : 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, bufferFor(m, shadow ? 'top' : 'data'));
      for (const [name, size, off] of [['a_pos', 3, 0], ['a_layer', 1, 12], ['a_color', 3, 16], ['a_normal', 3, 28]]) {
        gl.enableVertexAttribArray(a[name]); gl.vertexAttribPointer(a[name], size, gl.FLOAT, false, 40, off);
      }
      gl.drawArrays(gl.TRIANGLES, 0, count); this.stats.draws++; this.stats.tris += count / 3;
    },
  };
}

