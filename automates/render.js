'use strict';
// Les Automates' own renderer: WebGL2, deferred shading.
//   1. Every mesh, the floor and ceiling planes and the particle cubes are drawn into a G-buffer (colour, normal, depth).
//   2. One full-screen pass lights each pixel from the nearest lamps, with shadows: walls are traced through the level
//      grid, and enemies and furniture are treated as upright cylinders. Ambient light comes from the baked light map.
//   3. Smoke is blended in, then the picture is bloomed, tone-mapped and resolved onto the canvas.
// Meshes use the same vertex layout as shared/voxel.js: x, y, corner z, layer, r, g, b, normal. A red above 1 marks a
// glowing voxel and a green above 1 a shiny one.
const MAXL = 16, MAXO = 10;
function AutomatesRenderer(canvas, world, GW, GH) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  const hdr = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
  const SS = Math.max(1, Math.min(2, +new URLSearchParams(location.search).get('ss') || 1.25)), W = Math.round(canvas.width * SS), H = Math.round(canvas.height * SS);
  const prog = (vs, fs) => {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t); gl.shaderSource(s, '#version 300 es\nprecision highp float;\n' + src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + src);
      gl.attachShader(p, s);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0; i < gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i++) { const n = gl.getActiveUniform(p, i).name; u[n.replace('[0]', '')] = gl.getUniformLocation(p, n); }
    return { p, u };
  };
  const tex = (w, h, internal, format, type, filter, data = null) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const fbo = (...colours) => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); colours.forEach((t, i) => gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0)); return f; };
  const colour = (w, h) => hdr ? tex(w, h, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR) : tex(w, h, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR);

  // ---- the camera, shared by every geometry shader: eye x, y, yaw, height / focal over half width, over half height, near, far ----
  const CAM = `uniform vec4 u_eye, u_proj;
vec4 project(vec3 w) { vec2 d = w.xy - u_eye.xy; float c = cos(u_eye.z), s = sin(u_eye.z), f = d.x * c + d.y * s;
  return vec4((d.y * c - d.x * s) * u_proj.x, (w.z - u_eye.w) * u_proj.y, (f * (u_proj.w + u_proj.z) - 2.0 * u_proj.w * u_proj.z) / (u_proj.w - u_proj.z), f); }\n`;
  const GOUT = `layout(location = 0) out vec4 o_a; layout(location = 1) out vec4 o_n;\n`;
  const meshP = prog(CAM + `layout(location = 0) in vec3 a_pos; layout(location = 1) in float a_layer; layout(location = 2) in vec3 a_color; layout(location = 3) in vec3 a_normal;
uniform mat4 u_model; uniform float u_vox, u_flash; out vec3 v_color, v_normal; out vec2 v_mat;
void main() {
  vec4 w = u_model * vec4(vec3(a_pos.xy, a_layer + a_pos.z) * u_vox, 1.0); gl_Position = project(w.xyz);
  v_mat = vec2(step(1.5, a_color.r), step(1.5, a_color.g));
  v_color = mix(a_color - vec3(2.0 * v_mat.x, 2.0 * v_mat.y, 0.0), vec3(1.0), u_flash); v_normal = mat3(u_model) * a_normal;
}`, GOUT + `in vec3 v_color, v_normal; in vec2 v_mat;
void main() { o_a = vec4(v_color, v_mat.x); o_n = vec4(normalize(v_normal) * 0.5 + 0.5, v_mat.y); }`);
  const cubeP = prog(CAM + `layout(location = 0) in vec3 a_c; layout(location = 1) in vec3 a_n; layout(location = 2) in vec4 i_p; layout(location = 3) in vec4 i_c;
out vec3 v_color, v_normal; out vec2 v_mat;
void main() { gl_Position = project(i_p.xyz + a_c * i_p.w); v_color = i_c.rgb; v_normal = a_n; v_mat = vec2(i_c.a, 0.0); }`, GOUT + `in vec3 v_color, v_normal; in vec2 v_mat;
void main() { o_a = vec4(v_color, v_mat.x); o_n = vec4(normalize(v_normal) * 0.5 + 0.5, v_mat.y); }`);
  // floors and ceilings: one textured plane each, with relief faked from the picture's own light and dark
  // floors and ceilings: one textured plane each. The picture's own light and dark is read as height, and the view ray is
  // marched down into it, so joints and gaps between stones really sit below the surface and hide behind their edges.
  const groundP = prog(CAM + `layout(location = 0) in vec2 a_p; uniform float u_height; out vec2 v_w;
void main() { v_w = a_p; gl_Position = project(vec3(a_p, u_height)); }`, GOUT + `in vec2 v_w; uniform sampler2D u_tex, u_cells; uniform float u_world, u_up, u_height; uniform vec2 u_grid, u_texel; uniform vec4 u_eye;
float lum(vec2 uv) { return dot(texture(u_tex, uv).rgb, vec3(0.3, 0.59, 0.11)); }
void main() {
  vec2 uv = v_w / u_world; if (texture(u_tex, uv).a < 0.5) discard;
  vec3 D = normalize(vec3(v_w, u_height) - vec3(u_eye.xy, u_eye.w)); float deep = 0.55, steps = 10.0, dz = max(abs(D.z), 0.22);
  vec2 stp = D.xy / dz * (deep / steps) / u_world; float d = 0.0;
  for (int i = 0; i < 10; i++) { vec2 q = uv + stp; if (texture(u_tex, q).a < 0.5 || d + deep / steps > (1.0 - lum(q)) * deep) break; uv = q; d += deep / steps; }
  vec4 t = texture(u_tex, uv);
  float l = lum(uv), k = 2.6; vec3 n = normalize(vec3((l - lum(uv + vec2(u_texel.x, 0.0))) * k, (l - lum(uv + vec2(0.0, u_texel.y))) * k, 1.0)); n.z *= u_up;
  o_a = vec4(t.rgb * (1.0 - d * 0.5), 0.0); o_n = vec4(n * 0.5 + 0.5, u_up > 0.0 ? texelFetch(u_cells, ivec2(v_w / 16.0), 0).g : 0.0);
}`);
  const FULL = `out vec2 v; void main() { v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }`;
  const lightP = prog(FULL, `in vec2 v; out vec4 o;
uniform sampler2D u_a, u_n, u_d, u_lm, u_cells, u_prev; uniform vec4 u_eye, u_proj, u_fog; uniform float u_world, u_far, u_sky, u_time, u_fast; uniform vec2 u_grid;
uniform vec4 u_lp[${MAXL}], u_lc[${MAXL}], u_occ[${MAXO}]; uniform int u_nl, u_no;
float fwdOf(float z) { if (z < 0.1) z *= 10.0;                       // the weapon in hand is drawn into the front tenth of the depth range
  float A = (u_proj.w + u_proj.z) / (u_proj.w - u_proj.z), B = 2.0 * u_proj.w * u_proj.z / (u_proj.w - u_proj.z); return B / (A - (z * 2.0 - 1.0)); }
vec3 worldAt(vec2 uv, float f) { vec2 ndc = uv * 2.0 - 1.0; float c = cos(u_eye.z), s = sin(u_eye.z); return vec3(u_eye.xy + f * vec2(c, s) + ndc.x * f / u_proj.x * vec2(-s, c), u_eye.w + ndc.y * f / u_proj.y); }
vec3 screenOf(vec3 p) { vec2 d = p.xy - u_eye.xy; float c = cos(u_eye.z), s = sin(u_eye.z), f = d.x * c + d.y * s; return vec3(vec2((d.y * c - d.x * s) * u_proj.x, (p.z - u_eye.w) * u_proj.y) / max(f, 0.01) * 0.5 + 0.5, f); }
float solid(vec2 cell) { return cell.x < 0.0 || cell.y < 0.0 || cell.x >= u_grid.x || cell.y >= u_grid.y ? 1.0 : texelFetch(u_cells, ivec2(cell), 0).r; }
float wall(vec2 p, vec2 l) {                                          // walk the level grid from the pixel to the lamp: any wall cell on the way is shadow
  vec2 d = l - p; float len = length(d); if (len < 0.01) return 1.0;
  vec2 dir = d / len, cell = floor(p / 16.0), stp = sign(dir), tD = 16.0 / max(abs(dir), vec2(1e-5)), tM = ((cell + step(vec2(0.0), dir)) * 16.0 - p) / (dir + vec2(1e-6) * (1.0 - abs(stp)));
  tM = mix(vec2(1e9), tM, abs(stp));
  for (int i = 0; i < 16; i++) { if (min(tM.x, tM.y) >= len) return 1.0; if (tM.x < tM.y) { cell.x += stp.x; tM.x += tD.x; } else { cell.y += stp.y; tM.y += tD.y; } if (solid(cell) > 0.5) return 0.0; }
  return 1.0;
}
float bodies(vec3 p, vec3 l) {                                        // enemies and furniture cast soft shadows as upright cylinders: x, y, radius, height
  float s = 1.0; vec2 d = l.xy - p.xy; float dd = max(dot(d, d), 0.01);
  for (int i = 0; i < ${MAXO}; i++) { if (i >= u_no) break; vec4 c = u_occ[i]; vec2 pc = c.xy - p.xy; if (dot(pc, pc) < c.z * c.z * 1.7) continue;   // not onto itself
    float t = clamp(dot(pc, d) / dd, 0.0, 1.0); if (mix(p.z, l.z, t) < c.w) s = min(s, smoothstep(c.z * 0.55, c.z * 1.3, length(p.xy + d * t - c.xy))); }
  return s;
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 skyAt(vec2 uv) {                                                 // dusk over Paris: a gradient, stars, a skyline of roofs with lit windows, and the tower
  float e = (uv.y * 2.0 - 1.0) / u_proj.y, az = u_eye.z + atan((uv.x * 2.0 - 1.0) / u_proj.x);
  vec3 sky = mix(vec3(1.0, 0.52, 0.34), vec3(0.17, 0.13, 0.36), smoothstep(-0.02, 0.6, e)) + step(0.9985, hash(floor(uv * vec2(420.0, 260.0)))) * smoothstep(0.15, 0.6, e) * 0.9;
  float b = floor(az * 46.0), roof = 0.045 + 0.085 * hash(vec2(b, 3.0)) + 0.03 * step(0.7, hash(vec2(b, 9.0)));
  float t = abs(mod(az + 1.5708 + 3.1416, 6.2832) - 3.1416), tower = 0.5 * (1.0 - smoothstep(0.0, 0.085, t + 0.002) ) ;   // due north
  tower = e < 0.5 && t < 0.006 + 0.075 * pow(max(0.0, 1.0 - e / 0.5), 3.2) ? 1.0 : 0.0;
  if (e < roof) { vec2 w = floor(vec2(az * 230.0, e * 150.0)); return mix(vec3(0.07, 0.06, 0.14), vec3(1.0, 0.8, 0.45), step(0.9, hash(w)) * step(0.02, e)); }
  if (tower > 0.5) return mix(vec3(0.09, 0.07, 0.15), vec3(1.0, 0.75, 0.4), step(0.94, hash(floor(vec2(az * 400.0, e * 90.0)))) * 0.8);
  return sky;
}
void main() {
  float z = texture(u_d, v).r; vec3 O = vec3(u_eye.xy, u_eye.w);
  if (z >= 1.0) { o = vec4(mix(vec3(0.03, 0.028, 0.04), skyAt(v), u_sky), 1.0); return; }
  float f = fwdOf(z); vec3 P = worldAt(v, f); vec4 A = texture(u_a, v), N = texture(u_n, v); vec3 n = normalize(N.xyz * 2.0 - 1.0), V = normalize(O - P);
  float occ = 0.0, rot = hash(v * 931.0) * 6.283;                     // ambient occlusion from the neighbouring pixels' positions
  for (int i = 0; i < 8; i++) { float a = rot + float(i) * 0.785, r = (0.35 + 0.65 * fract(float(i) * 0.618)) * 2.2; vec2 uv = v + vec2(cos(a) * u_proj.x, sin(a) * u_proj.y) * r / f * 0.5;
    vec3 q = worldAt(uv, fwdOf(texture(u_d, uv).r)) - P; float d2 = dot(q, q); occ += max(dot(n, q) / sqrt(d2 + 1e-4) - 0.12, 0.0) / (1.0 + d2 * 0.12); }
  float ao = 1.0 - min(occ / 8.0 * 2.4, 0.8);
  vec3 diff = vec3(0.0), spec = vec3(0.0), glow = vec3(0.0), D = -V; float T = length(P - O), jit = hash(v * 517.0 + u_time);
  for (int i = 0; i < ${MAXL}; i++) { if (i >= u_nl) break; vec4 L = u_lp[i]; vec3 lc = u_lc[i].rgb;
    if (u_lc[i].a > 0.0 && u_fast < 0.5) {                             // light in the air: march the view ray and gather what each point receives, so beams are cut off by walls
      float reach = min(T, 170.0), sum = 0.0;
      for (int k = 0; k < 5; k++) { vec3 S = O + D * reach * (float(k) + jit) / 5.0; float dl = length(L.xyz - S); if (dl < L.w) sum += pow(1.0 - dl / L.w, 2.0) * wall(S.xy, L.xy); }
      glow += lc * sum * reach / 5.0 * 0.0034 * u_lc[i].a;
    }
    vec3 d = L.xyz - P; float dist = length(d); if (dist > L.w) continue;
    vec3 ld = d / dist; float ndl = dot(n, ld) * 0.8 + 0.2; if (ndl <= 0.0) continue;
    vec2 from = P.xy + n.xy * 1.4, side = vec2(-ld.y, ld.x) * 2.5; float sh = 0.5 * (wall(from, L.xy + side) + wall(from, L.xy - side)); if (sh <= 0.0) continue;
    float k = pow(1.0 - dist / L.w, 2.0) * sh * bodies(P, L.xyz);
    diff += lc * ndl * k; spec += lc * pow(max(dot(n, normalize(ld + V)), 0.0), 48.0) * k;
  }
  vec3 amb = texture(u_lm, P.xy / u_world).rgb;
  vec3 c = A.rgb * (amb * ao + diff * mix(1.0, ao, 0.5)) + spec * N.a * 0.9;
  if (u_fast < 0.5 && N.a > 0.3 && n.z > 0.6) {                                        // polished floors mirror the room: follow the reflected ray across the last frame until it meets something
    vec3 Rr = reflect(D, normalize(mix(vec3(0.0, 0.0, 1.0), n, 0.35))); float hit = 0.0; vec2 huv = v;
    for (int i = 1; i <= 10; i++) { vec3 sp = screenOf(P + Rr * (float(i) + jit) * 3.4); if (sp.z < u_proj.z || sp.x < 0.0 || sp.x > 1.0 || sp.y < 0.0 || sp.y > 1.0) break;
      float sf = fwdOf(texture(u_d, sp.xy).r); if (sf < sp.z - 0.6 && sf > sp.z - 9.0) { hit = 1.0; huv = sp.xy; break; } }
    float edge = min(min(huv.x, 1.0 - huv.x), min(huv.y, 1.0 - huv.y));
    c += texture(u_prev, huv).rgb * hit * N.a * (0.12 + 0.6 * pow(1.0 - max(dot(V, n), 0.0), 3.0)) * smoothstep(0.0, 0.08, edge);
  }
  c = mix(c, A.rgb * 2.4, A.a);                                        // glowing voxels ignore the light and feed the bloom
  c = mix(c, u_fog.rgb, clamp((T - u_fog.a) / (u_far - u_fog.a), 0.0, 1.0) * 0.85) + glow;
  o = vec4(c, 1.0);
}`);
  const smokeP = prog(CAM + `layout(location = 0) in vec2 a_q; layout(location = 1) in vec4 i_p; layout(location = 2) in vec4 i_c; out vec2 v_q; out vec4 v_c; out float v_f;
void main() { float c = cos(u_eye.z), s = sin(u_eye.z); vec4 p = project(i_p.xyz + vec3(-s, c, 0.0) * a_q.x * i_p.w + vec3(0.0, 0.0, a_q.y * i_p.w)); gl_Position = p; v_f = p.w; v_q = a_q; v_c = i_c; }`,
    `in vec2 v_q; in vec4 v_c; in float v_f; out vec4 o; uniform sampler2D u_d; uniform vec4 u_proj; uniform vec2 u_size;
void main() { float A = (u_proj.w + u_proj.z) / (u_proj.w - u_proj.z), B = 2.0 * u_proj.w * u_proj.z / (u_proj.w - u_proj.z), scene = B / (A - (texture(u_d, gl_FragCoord.xy / u_size).r * 2.0 - 1.0));
  vec2 g = floor(v_q * 7.0) / 7.0; float a = smoothstep(0.5, 0.18, length(g)) * v_c.a * clamp((scene - v_f) / 3.0, 0.0, 1.0); if (a < 0.01) discard; o = vec4(v_c.rgb, a); }`);   // blocky puffs that fade where they meet a surface
  const downP = prog(FULL, `in vec2 v; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_texel; uniform float u_cut;
void main() { vec3 c = vec3(0.0); for (int i = 0; i < 4; i++) c += texture(u_tex, v + (vec2(float(i & 1), float(i >> 1)) * 2.0 - 1.0) * u_texel).rgb; c *= 0.25; o = vec4(max(c - u_cut, 0.0), 1.0); }`);
  // exposure: one pixel that drifts towards whatever makes the average of the frame a comfortable brightness
  const exposeP = prog(FULL, `in vec2 v; out vec4 o; uniform sampler2D u_tex, u_old;
void main() { float l = dot(textureLod(u_tex, vec2(0.5), 20.0).rgb, vec3(0.3, 0.59, 0.11)), want = clamp(0.36 / (l + 0.04), 0.6, 2.2), old = texture(u_old, vec2(0.5)).r; o = vec4(old < 0.01 ? want : mix(old, want, 0.04)); }`);
  const finalP = prog(FULL, `in vec2 v; out vec4 o; uniform sampler2D u_tex, u_b0, u_b1, u_b2, u_b3, u_exp; uniform float u_time, u_pain; uniform vec4 u_grade;   // grade: tint r, g, b and contrast
void main() {
  vec3 c = texture(u_tex, v).rgb + texture(u_b0, v).rgb * 0.5 + texture(u_b1, v).rgb * 0.5 + texture(u_b2, v).rgb * 0.45 + texture(u_b3, v).rgb * 0.4;
  c *= texture(u_exp, vec2(0.5)).r;
  c = mix(c, 0.8 + (1.0 - exp(-(c - 0.8) * 2.2)) * 0.22, step(0.8, c));   // roll the highlights off instead of clipping them
  c = (c - 0.5) * u_grade.a + 0.5; c *= u_grade.rgb;                     // each part of the level has its own grade
  vec2 q = v - 0.5; c *= 1.0 - dot(q, q) * 0.6;                         // vignette
  c += (fract(sin(dot(v * 913.0 + u_time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018;
  o = vec4(mix(max(c, 0.0), vec3(0.7, 0.0, 0.0), u_pain * dot(q, q) * 2.4), 1.0);
}`);
  // anti-aliasing on the finished picture (FXAA): soften only along edges
  const fxaaP = prog(FULL, `in vec2 v; out vec4 o; uniform sampler2D u_tex; uniform vec2 u_texel;
float lu(vec2 uv) { return dot(texture(u_tex, uv).rgb, vec3(0.3, 0.59, 0.11)); }
void main() {
  float m = lu(v), nw = lu(v + vec2(-1.0, 1.0) * u_texel), ne = lu(v + vec2(1.0, 1.0) * u_texel), sw = lu(v + vec2(-1.0, -1.0) * u_texel), se = lu(v + vec2(1.0, -1.0) * u_texel);
  float lo = min(m, min(min(nw, ne), min(sw, se))), hi = max(m, max(max(nw, ne), max(sw, se)));
  vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se)); float rd = 1.0 / (min(abs(dir.x), abs(dir.y)) + max((nw + ne + sw + se) * 0.03125, 0.0078));
  dir = clamp(dir * rd, -8.0, 8.0) * u_texel;
  vec3 a = 0.5 * (texture(u_tex, v + dir * (1.0 / 3.0 - 0.5)).rgb + texture(u_tex, v + dir * (2.0 / 3.0 - 0.5)).rgb), b = a * 0.5 + 0.25 * (texture(u_tex, v - dir * 0.5).rgb + texture(u_tex, v + dir * 0.5).rgb);
  float lb = dot(b, vec3(0.3, 0.59, 0.11)); o = vec4(lb < lo || lb > hi ? a : b, 1.0);
}`);

  // ---- targets ----
  const gA = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST), gN = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST), gD = tex(W, H, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
  const gF = fbo(gA, gN); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, gD, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
  const mipped = t => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.generateMipmap(gl.TEXTURE_2D); return t; };
  const lits = [0, 1].map(() => { const t = mipped(colour(W, H)); return { t, f: fbo(t) }; }), bloom = [];   // this frame and the last one: reflections read the previous frame
  const exps = [0, 1].map(() => { const t = colour(1, 1); return { t, f: fbo(t) }; }), ldr = tex(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR), ldrF = fbo(ldr);
  for (const e of exps) { gl.bindFramebuffer(gl.FRAMEBUFFER, e.f); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
  let flip = 0;
  for (let i = 1, w = W, h = H; i <= 5; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); const t = colour(w, h); bloom.push({ t, f: fbo(t), w, h }); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const cellsT = tex(GW, GH, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST); let lmT = null;
  const groundB = gl.createBuffer(), groundV = gl.createVertexArray();
  gl.bindVertexArray(groundV); gl.bindBuffer(gl.ARRAY_BUFFER, groundB); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, world, 0, world, world, 0, 0, world, world, 0, world]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  // instanced particle geometry: a unit cube with normals, and a unit quad
  const instanced = (verts, size, stride) => {
    const vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    let loc = 0; for (let off = 0; off < stride; off += size[loc++]) { gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size[loc], gl.FLOAT, false, stride * 4, off * 4); }
    gl.bindBuffer(gl.ARRAY_BUFFER, ib);
    for (let i = 0; i < 2; i++) { gl.enableVertexAttribArray(loc + i); gl.vertexAttribPointer(loc + i, 4, gl.FLOAT, false, 32, i * 16); gl.vertexAttribDivisor(loc + i, 1); }
    return { vao, ib, n: verts.length / stride };
  };
  const cubeV = [];
  for (const [n, a, b] of [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]]])
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) cubeV.push(...[0, 1, 2].map(k => (n[k] + a[k] * s + b[k] * t) / 2), ...n);
  const cube = instanced(cubeV, [3, 3], 6), quad = instanced([-.5, -.5, .5, -.5, .5, .5, -.5, -.5, .5, .5, -.5, .5], [2], 2);

  const meshes = new Map(), grounds = new Map();
  const vaoFor = m => {
    let e = meshes.get(m);
    if (!e) { const vao = gl.createVertexArray(), buf = gl.createBuffer(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
      [[3, 0], [1, 12], [3, 16], [3, 28]].forEach(([n, off], i) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, 40, off); });
      meshes.set(m, e = { vao, buf }); }
    return e.vao;
  };
  let eye = null, cam = null;
  const camera = u => { gl.uniform4f(u.u_eye, eye.x, eye.y, eye.yaw, eye.z); gl.uniform4fv(u.u_proj, cam); };
  const bind = (unit, t, loc) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(loc, unit); };
  const full = () => { gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  return {
    stats: { draws: 0, tris: 0 }, hdr, fast: false,                 // fast: skip the light beams and floor reflections
    free(m) { const e = meshes.get(m); if (e) { gl.deleteBuffer(e.buf); gl.deleteVertexArray(e.vao); meshes.delete(m); } },   // for a mesh that has been rebuilt
    setCells(rgba) { gl.bindTexture(gl.TEXTURE_2D, cellsT); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, GW, GH, gl.RGBA, gl.UNSIGNED_BYTE, rgba); },   // r: blocks light, g: how shiny the floor is
    setLightMap(rgb, n) { lmT = lmT || tex(n, n, gl.RGB8, gl.RGB, gl.UNSIGNED_BYTE, gl.LINEAR); gl.bindTexture(gl.TEXTURE_2D, lmT); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, n, n, gl.RGB, gl.UNSIGNED_BYTE, rgb); },
    begin(e, focal, near, far) {
      eye = e; cam = [focal / (canvas.width / 2), focal / (canvas.height / 2), near, far]; this.far = far; this.stats.draws = this.stats.tris = 0;
      gl.bindFramebuffer(gl.FRAMEBUFFER, gF); gl.viewport(0, 0, W, H); gl.depthRange(0, 1); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    ground(image, height, up) {                                      // a textured plane over the whole level: the floor, or a ceiling further up
      let t = grounds.get(image);
      if (!t) { t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        grounds.set(image, t); }
      const u = groundP.u; gl.useProgram(groundP.p); camera(u); gl.uniform1f(u.u_height, height); gl.uniform1f(u.u_world, world); gl.uniform1f(u.u_up, up); gl.uniform2f(u.u_grid, GW, GH); gl.uniform2f(u.u_texel, 1 / image.width, 1 / image.height);
      bind(0, t, u.u_tex); bind(1, cellsT, u.u_cells); gl.bindVertexArray(groundV); gl.drawArrays(gl.TRIANGLES, 0, 6); this.stats.draws++;
    },
    front(on) { gl.depthRange(0, on ? 0.1 : 1); },                   // what follows is drawn in front of everything else: the weapon in hand never pokes into a wall
    draw(m, M, vox, flash) {
      const u = meshP.u; gl.useProgram(meshP.p); camera(u); gl.uniformMatrix4fv(u.u_model, false, M); gl.uniform1f(u.u_vox, vox); gl.uniform1f(u.u_flash, flash || 0);
      gl.bindVertexArray(vaoFor(m)); gl.drawArrays(gl.TRIANGLES, 0, m.count); this.stats.draws++; this.stats.tris += m.count / 3;
    },
    cubes(data, n) {                                                 // n particles: x, y, z, size, r, g, b, glow
      if (!n) return; gl.useProgram(cubeP.p); camera(cubeP.u); gl.bindVertexArray(cube.vao); gl.bindBuffer(gl.ARRAY_BUFFER, cube.ib); gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 8), gl.DYNAMIC_DRAW);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, cube.n, n); this.stats.draws++; this.stats.tris += n * 12;
    },
    // light the frame and put it on screen. lights: [x, y, z, radius, r, g, b, air glow]; bodies: [x, y, radius, height]; smoke: x, y, z, size, r, g, b, alpha
    end(o) {
      const lit = lits[flip].t, prev = lits[1 - flip].t, ex = exps[flip], exOld = exps[1 - flip];
      gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.bindFramebuffer(gl.FRAMEBUFFER, lits[flip].f); gl.viewport(0, 0, W, H);
      const u = lightP.u, nl = Math.min(MAXL, o.lights.length), no = Math.min(MAXO, o.bodies.length), lp = new Float32Array(MAXL * 4), lc = new Float32Array(MAXL * 4), oc = new Float32Array(MAXO * 4);
      for (let i = 0; i < nl; i++) { lp.set(o.lights[i].slice(0, 4), i * 4); lc.set(o.lights[i].slice(4, 8), i * 4); }
      for (let i = 0; i < no; i++) oc.set(o.bodies[i], i * 4);
      gl.useProgram(lightP.p); camera(u); bind(0, gA, u.u_a); bind(1, gN, u.u_n); bind(2, gD, u.u_d); bind(3, lmT, u.u_lm); bind(4, cellsT, u.u_cells); bind(5, prev, u.u_prev);
      gl.uniform4fv(u.u_lp, lp); gl.uniform4fv(u.u_lc, lc); gl.uniform4fv(u.u_occ, oc); gl.uniform1i(u.u_nl, nl); gl.uniform1i(u.u_no, no);
      gl.uniform4f(u.u_fog, o.fog[0], o.fog[1], o.fog[2], o.fog[3]); gl.uniform1f(u.u_far, this.far); gl.uniform1f(u.u_world, world); gl.uniform2f(u.u_grid, GW, GH); gl.uniform1f(u.u_sky, o.sky ? 1 : 0); gl.uniform1f(u.u_time, o.time % 10); gl.uniform1f(u.u_fast, this.fast ? 1 : 0);
      full();
      if (o.smokeCount) {                                            // smoke sits in front of the lit scene and fades against it
        const s = smokeP.u; gl.useProgram(smokeP.p); camera(s); bind(2, gD, s.u_d); gl.uniform2f(s.u_size, W, H); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.bindVertexArray(quad.vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad.ib); gl.bufferData(gl.ARRAY_BUFFER, o.smoke.subarray(0, o.smokeCount * 8), gl.DYNAMIC_DRAW); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, o.smokeCount); gl.disable(gl.BLEND);
      }
      gl.bindTexture(gl.TEXTURE_2D, lit); gl.generateMipmap(gl.TEXTURE_2D);                               // its smallest level is the average brightness of the frame
      gl.useProgram(exposeP.p); gl.bindFramebuffer(gl.FRAMEBUFFER, ex.f); gl.viewport(0, 0, 1, 1); bind(0, lit, exposeP.u.u_tex); bind(1, exOld.t, exposeP.u.u_old); full();
      gl.useProgram(downP.p);                                        // bloom: keep what is brighter than white, and blur it at five scales
      bloom.forEach((b, i) => { gl.bindFramebuffer(gl.FRAMEBUFFER, b.f); gl.viewport(0, 0, b.w, b.h); bind(0, i ? bloom[i - 1].t : lit, downP.u.u_tex); gl.uniform2f(downP.u.u_texel, 1 / (i ? bloom[i - 1].w : W), 1 / (i ? bloom[i - 1].h : H)); gl.uniform1f(downP.u.u_cut, i ? 0 : 1); full(); });
      gl.bindFramebuffer(gl.FRAMEBUFFER, ldrF); gl.viewport(0, 0, W, H);
      const f = finalP.u, g = o.grade || [1, 1, 1, 1]; gl.useProgram(finalP.p); bind(0, lit, f.u_tex); bind(1, bloom[1].t, f.u_b0); bind(2, bloom[2].t, f.u_b1); bind(3, bloom[3].t, f.u_b2); bind(4, bloom[4].t, f.u_b3); bind(5, ex.t, f.u_exp);
      gl.uniform1f(f.u_time, o.time % 10); gl.uniform1f(f.u_pain, o.pain || 0); gl.uniform4f(f.u_grade, g[0], g[1], g[2], g[3]);
      full();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(fxaaP.p); bind(0, ldr, fxaaP.u.u_tex); gl.uniform2f(fxaaP.u.u_texel, 1 / W, 1 / H); full();
      flip = 1 - flip;
    },
  };
}
