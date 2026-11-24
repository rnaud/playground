// Banjo-Kazooie: Spiral Mountain — Interactive 3D Papercraft Pop-Up Story
import * as THREE from 'three';
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { makeCard, layeredCard, boxFold, platform, clusterLayout, FlapSpring } from 'papercraft/lib/paperkit-3d.js';
import { createLife } from 'papercraft/lib/paper-life.js';
import { createHarness } from './harness.js';

// ---- 1. Palette: Spiral Mountain bright spring/summer storybook highland ----
const C = {
  ground: '#b8ce78',
  wash: '#94b260',
  washWarm: '#cad98b',
  path: '#ebd3a4',
  earth: '#b58250',
  moat: '#4da8b8',
  moatDeep: '#2c788f',
  foam: '#f5eedc',
  // Foliage
  leafA: '#559246',
  leafB: '#73ab4a',
  leafC: '#3f7842',
  pine: '#396c45',
  bush: '#498b52',
  bushLight: '#7db458',
  hillA: '#7ea26a',
  hillB: '#9cb97c',
  // Banjo & Kazooie
  fur: '#b46b34',
  snout: '#e5ba82',
  shorts: '#f2c438',
  pack: '#3368b0',
  kazRed: '#d93c2e',
  kazBeak: '#f2b22e',
  // Architecture & Props
  trunk: '#754829',
  wood: '#a56838',
  wall: '#f2e4c4',
  roof: '#c95232',
  stone: '#9e9788',
  stoneDark: '#6e6a62',
  jiggy: '#f4c430',
  honey: '#f0a828',
  // Mumbo & Gruntilda
  bone: '#efe4cb',
  mumboTeal: '#389888',
  witchPurple: '#6f4888',
  witchLime: '#84b83c',
  witchSkin: '#7da64e',
  // Accents
  ink: '#332216',
  cream: '#faf3e0',
  window: '#ffd068',
  carrot: '#e06e28',
  onion: '#d9b578',
  cauli: '#ede5cc',
};

// Leading lines: the moat stream curves diagonally through the valley; the sandy spiral path winds from
// Banjo's Cottage (lower-right) -> Bottles' Garden (mid-right) -> Bridge -> Mumbo's Glade -> Gruntilda's Lair (upper-left)
const moatX = (z) => -18.0 - z * 0.68 + Math.sin(z * 0.14) * 2.8 + Math.sin(z * 0.22 + 1.8) * 2.2;
const pathX = (z) => 7.5 + z * 0.65 + Math.sin(z * 0.14 + 0.9) * 2.6 + Math.sin(z * 0.22 + 0.3) * 2.4;

const HERO_AT = [pathX(4.5) + 0.4, 4.5];

const H = createHarness({
  ground: C.ground,
  stock: '#f7f1e1',
  view: { pitch: 47, dist: 64, target: [1.5, 1.5, -6.5] },
  bounds: { x0: -64, x1: 64, z0: -62, z1: 38 },
  play: true,
  walkArea: { x0: -22, x1: 22, z0: -26, z1: 9 },
  camBox: { x0: -6, x1: 6, z0: -12, z1: -2 },
  subject: HERO_AT,
  light: { leak: '#7a6648' },
});
const { walk, flags } = H;
let RES = 1;
const popup = (pts, paint, o = {}) => H.popup(pts, paint, { res: RES, ...o });

// ---- 2. Printed Ground: Spiral Mountain meadow, moat stream, sandy spiral trail, garden patch ----
const GARDEN = { x: pathX(-2.5) + 6.5, z: -2.5, w: 8.5, d: 6.2, angle: -0.18 };

H.printGround(({ g, ppu, X, Z, rnd, washes, torn, band, ribbon, drifts }) => {
  washes([C.wash, C.wash, C.washWarm, C.washWarm, '#a4be6c']);

  // Bottles' vegetable garden patch (tilled earth with furrows)
  {
    const { x: fx, z: fz, w: fw, d: fd, angle: fa } = GARDEN;
    const ca = Math.cos(fa), sa = Math.sin(fa);
    const corner = ([u, v]) => [fx + u * ca - v * sa, fz + u * sa + v * ca];
    torn([[-fw / 2, -fd / 2], [fw / 2, -fd / 2], [fw / 2, fd / 2], [-fw / 2, fd / 2]].map(corner), P2.rgba(C.earth, 0.88));
    g.save();
    g.translate(X(fx), Z(fz));
    g.rotate(fa);
    g.strokeStyle = P2.rgba(P2.shade(C.earth, -0.35), 0.52);
    g.lineWidth = 0.24 * ppu;
    for (let k = -fd / 2 + 0.7; k < fd / 2 - 0.5; k += 0.95) {
      g.beginPath();
      g.moveTo((-fw / 2 + 0.6) * ppu, k * ppu);
      g.lineTo((fw / 2 - 0.6) * ppu, (k + 0.15) * ppu);
      g.stroke();
    }
    g.restore();
  }

  // Cerulean moat stream with torn cream shore, deep channel, ripples & lily pads
  torn(band(moatX, (z) => 3.2 + Math.sin(z * 0.35) * 0.18), '#f0e6c8');
  torn(band(moatX, (z) => 2.6 + Math.sin(z * 0.28 + 1) * 0.2), C.moat, 'rgba(250,245,230,0.35)');
  ribbon(moatX, 2.2, P2.rgba(C.moatDeep, 0.52), undefined, undefined, 0.4);
  for (let k = 0, n = Math.round(2.5 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0);
    const x = moatX(z) + (rnd() - 0.5) * 3.6;
    const l = (0.6 + rnd() * 1.1) * ppu;
    const pale = k % 3 !== 0;
    g.strokeStyle = pale ? P2.rgba(C.foam, 0.85) : P2.rgba(C.moatDeep, 0.7);
    g.lineWidth = (pale ? 0.12 : 0.09) * ppu;
    g.beginPath();
    g.moveTo(X(x) - l / 2, Z(z));
    g.quadraticCurveTo(X(x), Z(z) - 0.12 * ppu, X(x) + l / 2, Z(z));
    g.stroke();
  }

  // Sandy spiral dirt trail
  torn(band(pathX, (z) => 1.38 + Math.sin(z * 0.45) * 0.14), C.path);
  ribbon(pathX, 0.75, P2.rgba('#faf0d8', 0.48), undefined, undefined, 0.22);
  for (const sd of [-1, 1]) {
    ribbon((z) => pathX(z) + sd * (1.58 + Math.sin(z * 0.45) * 0.14), 0.34, P2.rgba(P2.shade(C.wash, -0.2), 0.28), undefined, undefined, 0.15);
  }
  for (let k = 0, n = Math.round(18 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0);
    const x = pathX(z) + (rnd() - 0.5) * 2.4;
    const r = (0.05 + rnd() * 0.06) * ppu;
    g.fillStyle = rnd() < 0.6 ? P2.rgba(P2.shade(C.path, -0.32), 0.55) : P2.rgba('#fff7e4', 0.7);
    g.beginPath();
    g.ellipse(X(x), Z(z), r * 1.3, r, rnd() * 3, 0, 7);
    g.fill();
  }

  // Meadow grass ticks and bright spring wildflowers
  drifts((x, y) => {
    if (rnd() < 0.72) {
      g.strokeStyle = P2.rgba(rnd() < 0.5 ? '#5b823f' : '#789e4b', 0.72);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rnd() - 0.5) * 3, y - 5 - rnd() * 5);
      g.stroke();
    } else {
      const col = ['#faf2d4', '#f2c438', '#e86a52', '#70a8d8'][Math.floor(rnd() * 4)];
      g.fillStyle = col;
      for (let q = 0; q < 5; q++) {
        const t = (q / 5) * 6.283;
        g.beginPath();
        g.arc(x + Math.cos(t) * 2.2, y + Math.sin(t) * 2.2, 1.5, 0, 7);
        g.fill();
      }
    }
  });
});

// ---- 3. Layered Paper Pieces (Spiral Mountain specific) ----
let rnd = P2.rng(404);
const D = P2.draw2;
const between = (a, b) => a + rnd() * (b - a);
const mound = (w, h, lobes = 7, depth = 0.16) => P2.shape.mound(rnd, { w, h, lobes, depth });

// Helper: layered tree painter (fat trunk + limbs + countable bold leaves)
function paintSpiralTree(leafCol, trunkCol = C.trunk) {
  const light = P2.shade(leafCol, 0.22);
  const dark = P2.shade(leafCol, -0.22);
  const accent = P2.mix(leafCol, '#f2c438', 0.45);
  return (P) => {
    const { box, g, pts } = P;
    P.gradient(light, dark, 0.5);
    P.felt(0.75);
    // Trunk & branches
    P.layer(() => {
      const cx = (box.x0 + box.x1) * 0.5;
      P2.fillLimb(g, cx, box.y0, cx - box.w * 0.04, box.y0 + box.h * 0.25, cx, box.y0 + box.h * 0.52, box.w * 0.14, box.w * 0.05);
      P2.fillLimb(g, cx, box.y0 + box.h * 0.34, cx - box.w * 0.14, box.y0 + box.h * 0.48, cx - box.w * 0.24, box.y0 + box.h * 0.58, box.w * 0.06, box.w * 0.02);
      P2.fillLimb(g, cx, box.y0 + box.h * 0.36, cx + box.w * 0.15, box.y0 + box.h * 0.5, cx + box.w * 0.25, box.y0 + box.h * 0.6, box.w * 0.06, box.w * 0.02);
    }, trunkCol, { shadow: 3, lip: 1.5 });
    // Bold countable leaves
    const r = P2.rng(Math.round(box.w * 100 + box.h * 37));
    const leaves = [];
    for (let i = 0; i < 18; i++) {
      const y = box.y0 + box.h * (0.34 + r() * 0.58);
      const sp = P2.spanAt(pts, y);
      if (!sp) continue;
      const x = sp[0] + (sp[1] - sp[0]) * (0.14 + r() * 0.72);
      leaves.push([x, y, box.w * (0.12 + r() * 0.06), -0.8 + r() * 1.6, i % 4 === 0 ? accent : i % 2 === 0 ? light : P2.shade(leafCol, -0.1)]);
    }
    for (const [lx, ly, L, a, col] of leaves) {
      P.layer(() => P2.fillLeaf(g, lx, ly, L, a, 0.38), col, { shadow: 2.2, lip: 1.2 });
    }
    P.innerShade(C.ink, { alpha: 0.26, blurPx: 8 });
  };
}

function paintPineTree() {
  return (P) => {
    const { box, g } = P;
    const cx = (box.x0 + box.x1) * 0.5;
    P.gradient(P2.shade(C.pine, 0.18), P2.shade(C.pine, -0.2), 0.5);
    P.felt(0.75);
    P.layer(() => {
      g.fillRect(cx - box.w * 0.08, box.y0, box.w * 0.16, box.h * 0.22);
    }, C.trunk, { shadow: 2, lip: 1 });
    for (let t = 0; t < 4; t++) {
      const y0 = box.y0 + box.h * (0.18 + t * 0.18);
      const w = box.w * (0.48 - t * 0.08);
      const h = box.h * 0.26;
      const col = t % 2 === 0 ? P2.shade(C.pine, 0.12) : P2.shade(C.pine, -0.08);
      P.layer(() => {
        g.beginPath();
        g.moveTo(cx - w, y0);
        g.lineTo(cx, y0 + h);
        g.lineTo(cx + w, y0);
        g.closePath();
      }, col, { shadow: 2.5, lip: 1.4 });
    }
    P.innerShade(C.ink, { alpha: 0.24, blurPx: 7 });
  };
}

function paintBushCard(baseCol, flowers = true) {
  return (P) => {
    const { box, g } = P;
    P.gradient(P2.shade(baseCol, 0.18), P2.shade(baseCol, -0.2), 0.5);
    P.felt(0.75);
    const r = P2.rng(Math.round(box.w * 53 + 17));
    for (let i = 0; i < 8; i++) {
      const lx = box.x0 + box.w * (0.16 + r() * 0.68);
      const ly = box.y0 + box.h * (0.25 + r() * 0.56);
      P.layer(() => P2.fillLeaf(g, lx, ly, box.w * 0.14, -0.9 + r() * 1.8, 0.4), P2.shade(baseCol, 0.28), { shadow: 2, lip: 1 });
    }
    if (flowers) {
      const fCol = r() < 0.5 ? '#f4c430' : '#f7efe0';
      for (let i = 0; i < 5; i++) {
        const fx = box.x0 + box.w * (0.18 + r() * 0.64);
        const fy = box.y0 + box.h * (0.3 + r() * 0.52);
        const rr = box.w * 0.048;
        P.layer(() => { g.beginPath(); g.arc(fx, fy, rr, 0, 7); }, fCol, { shadow: 1.5, lip: 1 });
        P.draw(() => { g.fillStyle = '#d95432'; g.beginPath(); g.arc(fx, fy, rr * 0.42, 0, 7); g.fill(); });
      }
    }
    P.innerShade(C.ink, { alpha: 0.25, blurPx: 7 });
  };
}

function paintRockCard(col = C.stone) {
  return (P) => {
    const { box, g } = P;
    P.gradient(P2.shade(col, 0.18), P2.shade(col, -0.22), 0.45);
    P.felt(0.8);
    P.layer(() => {
      g.beginPath();
      g.moveTo(box.x0 + box.w * 0.1, box.y0 + box.h * 0.15);
      g.lineTo(box.x0 + box.w * 0.46, box.y0 + box.h * 0.78);
      g.lineTo(box.x0 + box.w * 0.82, box.y0 + box.h * 0.35);
      g.lineTo(box.x0 + box.w * 0.65, box.y0 + box.h * 0.08);
      g.closePath();
    }, P2.shade(col, 0.12), { shadow: 2.5, lip: 1.4 });
    // Moss cap
    P.layer(() => {
      g.beginPath();
      g.ellipse(box.x0 + box.w * 0.45, box.y0 + box.h * 0.82, box.w * 0.26, box.h * 0.14, -0.1, 0, 7);
    }, C.leafB, { shadow: 2, lip: 1.2 });
    P.innerShade(C.ink, { alpha: 0.3, blurPx: 8 });
  };
}

function paintWoodCard(woodCol = C.wood, planks = 3) {
  return (P) => {
    const { box, g } = P;
    P.gradient(P2.shade(woodCol, 0.15), P2.shade(woodCol, -0.18), 0.5);
    P.felt(0.75);
    P.draw(() => {
      g.strokeStyle = P2.rgba(C.ink, 0.42);
      g.lineWidth = Math.max(1.5, box.w * 0.025);
      for (let i = 1; i < planks; i++) {
        const y = box.y0 + (box.h * i) / planks;
        g.beginPath(); g.moveTo(box.x0, y); g.lineTo(box.x1, y); g.stroke();
      }
    });
    P.innerShade(C.ink, { alpha: 0.28, blurPx: 6 });
  };
}

// Spiral Mountain signature pieces!
const K = {
  tree: () => {
    const h = between(7.2, 9.2), w = h * between(0.75, 0.86);
    const pts = P2.roughen(P2.shape.mound(rnd, { w, h, lobes: 7, depth: 0.16 }), rnd);
    const col = [C.leafA, C.leafB, C.leafC][Math.floor(rnd() * 3)];
    return [pts, paintSpiralTree(col)];
  },
  pine: () => {
    const h = between(7.6, 9.8), w = h * 0.56;
    const pts = [[w * 0.12, 0], [w * 0.48, h * 0.2], [w * 0.28, h * 0.42], [w * 0.4, h * 0.44], [w * 0.18, h * 0.72], [0, h], [-w * 0.18, h * 0.72], [-w * 0.4, h * 0.44], [-w * 0.28, h * 0.42], [-w * 0.48, h * 0.2], [-w * 0.12, 0]];
    return [P2.roughen(pts, rnd), paintPineTree()];
  },
  bush: () => {
    const w = between(3.4, 4.6);
    return [P2.roughen(mound(w, w * 0.58, 7, 0.14), rnd), paintBushCard(rnd() < 0.5 ? C.bush : C.bushLight, true)];
  },
  tuft: () => [P2.shape.mound(rnd, { w: 3.0, h: 2.0, lobes: 7, depth: 0.38 }), paintBushCard('#7ea84c', false)],
  reeds: () => [P2.shape.mound(rnd, { w: 2.8, h: 3.4, lobes: 9, depth: 0.4 }), paintBushCard('#588a48', false)],
  rock: () => {
    const w = between(3.2, 4.8);
    return [P2.roughen(mound(w, w * 0.54, 4, 0.1), rnd), paintRockCard()];
  },
  // Golden Jiggy piece
  jiggy: () => P2.drawnPiece((g) => {
    g.fillStyle = C.jiggy;
    D.rect(g, -0.55, 0.1, 1.1, 1.1, 0.12);
    D.ell(g, 0, 1.25, 0.24, 0.22);
    D.ell(g, 0.62, 0.65, 0.22, 0.24);
    D.ell(g, -0.62, 0.65, 0.22, 0.24);
    g.fillStyle = '#fae078';
    D.rect(g, -0.35, 0.3, 0.7, 0.7, 0.08);
    g.fillStyle = '#c48612';
    D.ell(g, 0, 0.65, 0.16, 0.16);
  }, { w: 1.8, h: 1.7, name: 'jiggy' }),

  // Golden Musical Note
  note: () => P2.drawnPiece((g) => {
    g.fillStyle = '#f6cc38';
    D.ell(g, -0.25, 0.28, 0.28, 0.22);
    D.rect(g, -0.05, 0.28, 0.16, 1.05, 0.04);
    D.poly(g, [[0.05, 1.32], [0.58, 1.06], [0.52, 0.84], [0.05, 1.06]]);
    g.fillStyle = '#fff3b0';
    D.ell(g, -0.3, 0.34, 0.12, 0.09);
  }, { w: 1.3, h: 1.5, name: 'note' }),

  // Honeycomb piece
  honeycomb: () => P2.drawnPiece((g) => {
    g.fillStyle = C.honey;
    const hex = (cx, cy, r) => {
      const p = [];
      for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
      D.poly(g, p);
    };
    hex(0, 0.55, 0.45);
    g.fillStyle = '#ffd966';
    hex(0, 0.55, 0.28);
  }, { w: 1.2, h: 1.2, name: 'honeycomb' }),

  // Jinjo (colorful little creature waving!)
  jinjo: (col = '#3e84d6') => P2.drawnPiece((g) => {
    g.fillStyle = col;
    D.ell(g, 0, 0.52, 0.42, 0.5);
    D.ell(g, 0, 1.05, 0.34, 0.32);
    D.poly(g, [[-0.28, 1.28], [-0.42, 1.56], [-0.08, 1.36]]);
    D.poly(g, [[0.28, 1.28], [0.42, 1.56], [0.08, 1.36]]);
    g.fillStyle = P2.shade(col, 0.32);
    D.ell(g, 0, 0.48, 0.24, 0.3);
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.12, 1.08, 0.09, 0.11);
    D.ell(g, 0.12, 1.08, 0.09, 0.11);
    g.fillStyle = C.ink;
    D.ell(g, -0.11, 1.08, 0.04, 0.05);
    D.ell(g, 0.11, 1.08, 0.04, 0.05);
    g.fillStyle = '#f2b22e';
    D.ell(g, 0, 0.96, 0.12, 0.07);
  }, { w: 1.2, h: 1.7, name: 'jinjo' }),

  // Bottles' Molehill with Bottles peeking out
  molehill: () => P2.drawnPiece((g) => {
    g.fillStyle = '#8b5c34';
    D.poly(g, [[-1.1, 0], [1.1, 0], [0.85, 0.55], [0.45, 0.82], [-0.45, 0.82], [-0.85, 0.55]]);
    g.fillStyle = '#6c4424';
    D.ell(g, 0, 0.75, 0.55, 0.16);
    // Bottles the Mole
    g.fillStyle = '#75533c';
    D.ell(g, 0, 1.15, 0.38, 0.44);
    g.fillStyle = '#d9b58c';
    D.ell(g, 0, 1.06, 0.24, 0.2);
    // Thick round glasses
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.14, 1.24, 0.14, 0.14);
    D.ell(g, 0.14, 1.24, 0.14, 0.14);
    g.fillStyle = '#332216';
    D.ell(g, -0.14, 1.24, 0.05, 0.05);
    D.ell(g, 0.14, 1.24, 0.05, 0.05);
    // Red vest & pink nose
    g.fillStyle = '#c83c2e';
    D.rect(g, -0.28, 0.72, 0.56, 0.24, 0.06);
    g.fillStyle = '#e88a96';
    D.ell(g, 0, 1.1, 0.09, 0.07);
  }, { w: 2.5, h: 1.8, name: 'molehill' }),

  // Grumpy Garden Veggies (Topper the Carrot & Bawl the Onion)
  carrot: () => P2.drawnPiece((g) => {
    g.fillStyle = '#4f913d';
    D.poly(g, [[0, 1.25], [-0.36, 1.75], [-0.08, 1.48], [0, 1.85], [0.08, 1.48], [0.36, 1.75]]);
    g.fillStyle = C.carrot;
    D.poly(g, [[-0.45, 1.3], [0.45, 1.3], [0.18, 0], [-0.18, 0]]);
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.14, 0.96, 0.1, 0.12);
    D.ell(g, 0.14, 0.96, 0.1, 0.12);
    g.fillStyle = C.ink;
    D.ell(g, -0.13, 0.96, 0.04, 0.05);
    D.ell(g, 0.13, 0.96, 0.04, 0.05);
  }, { w: 1.3, h: 2.0, name: 'carrot' }),

  onion: () => P2.drawnPiece((g) => {
    g.fillStyle = '#5c9c44';
    D.poly(g, [[-0.08, 1.1], [-0.28, 1.65], [0.02, 1.32], [0.24, 1.68], [0.1, 1.1]]);
    g.fillStyle = C.onion;
    D.ell(g, 0, 0.62, 0.58, 0.56);
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.16, 0.72, 0.11, 0.13);
    D.ell(g, 0.16, 0.72, 0.11, 0.13);
    g.fillStyle = C.ink;
    D.ell(g, -0.15, 0.72, 0.05, 0.05);
    D.ell(g, 0.15, 0.72, 0.05, 0.05);
  }, { w: 1.4, h: 1.8, name: 'onion' }),

  // Wooden signpost & fence
  sign: () => [
    P2.fromDrawing((g) => { D.rect(g, -0.12, 0, 0.24, 2.5); D.poly(g, [[-0.95, 1.75], [0.75, 1.75], [1.05, 2.05], [0.75, 2.35], [-0.95, 2.35]]); }, { w: 2.2, h: 2.6, name: 'sign' }),
    paintWoodCard('#b67d48', 2),
  ],
  fence: () => [
    P2.fromDrawing((g) => {
      D.rect(g, -2.3, 0.55, 4.6, 0.22);
      D.rect(g, -2.3, 1.25, 4.6, 0.22);
      for (let i = -2; i <= 2; i++) D.rect(g, i * 1.0 - 0.18, 0, 0.36, 1.8, 0.06);
    }, { w: 4.8, h: 1.9, name: 'fence' }),
    paintWoodCard('#a87240', 2),
  ],
  hill: (idx = 0) => {
    const w = 18 + idx * 3, h = 9 + idx * 1.6;
    const pts = P2.roughen(mound(w, h, 3, 0.06), rnd);
    const col = idx % 2 === 0 ? C.hillA : C.hillB;
    return [pts, (P) => { P.gradient(P2.shade(col, 0.16), P2.shade(col, -0.14), 0.5); P.felt(0.7); P.innerShade(C.ink, { alpha: 0.2, blurPx: 10 }); }];
  },
};

// ---- 4. Hero: Banjo & Kazooie 3D Paper Model (~13 cards, striding limbs, Kazooie in backpack) ----
function banjoHero() {
  const root = new THREE.Group();
  root.name = 'banjo-kazooie';
  const paper = H.paper;
  const card = (draw, w, h, seed) => {
    const [pts, paint] = P2.drawnPiece(draw, { w, h, name: 'banjo' });
    return makeCard(pts, { paint, paper, seed, pxPerUnit: 84, thickness: 0.06, edgeWidth: 0.04, back: 'same' });
  };

  // Torso (honey bear fur, shark-tooth necklace, yellow shorts with black belt)
  const torso = card((g) => {
    g.fillStyle = C.fur;
    D.ell(g, 0, 0.85, 0.58, 0.62);
    g.fillStyle = '#d9985a';
    D.ell(g, 0, 0.86, 0.34, 0.38);
    // Yellow shorts
    g.fillStyle = C.shorts;
    D.rect(g, -0.56, 0.15, 1.12, 0.52, 0.14);
    g.fillStyle = C.ink;
    D.rect(g, -0.56, 0.58, 1.12, 0.11);
    g.fillStyle = '#f2d468';
    D.rect(g, -0.14, 0.56, 0.28, 0.15, 0.03);
    // Shark-tooth necklace
    g.fillStyle = '#faf3e0';
    D.poly(g, [[-0.08, 1.28], [0.08, 1.28], [0, 1.06]]);
  }, 1.35, 1.55, 11);
  torso.position.set(0, 0.45, 0);
  root.add(torso);

  // Banjo Head (round ears, friendly cream snout, big dark nose, cheerful eyes)
  const head = card((g) => {
    g.fillStyle = C.fur;
    D.ell(g, -0.42, 0.92, 0.2, 0.2);
    D.ell(g, 0.42, 0.92, 0.2, 0.2);
    D.ell(g, 0, 0.58, 0.54, 0.48);
    g.fillStyle = C.snout;
    D.ell(g, -0.42, 0.92, 0.1, 0.1);
    D.ell(g, 0.42, 0.92, 0.1, 0.1);
    D.ell(g, 0, 0.44, 0.38, 0.28);
    // Eyes
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.17, 0.72, 0.12, 0.15);
    D.ell(g, 0.17, 0.72, 0.12, 0.15);
    g.fillStyle = C.ink;
    D.ell(g, -0.15, 0.72, 0.055, 0.07);
    D.ell(g, 0.15, 0.72, 0.055, 0.07);
    // Big bear nose
    g.fillStyle = '#2b1b10';
    D.ell(g, 0, 0.54, 0.16, 0.11);
  }, 1.3, 1.25, 12);
  head.position.set(0, 1.72, 0.1);
  root.add(head);

  // Blue Backpack behind torso
  const pack = card((g) => {
    g.fillStyle = C.pack;
    D.rect(g, -0.52, 0.06, 1.04, 1.05, 0.22);
    g.fillStyle = P2.shade(C.pack, 0.2);
    D.rect(g, -0.44, 0.68, 0.88, 0.32, 0.12);
    g.fillStyle = C.shorts;
    D.rect(g, -0.12, 0.58, 0.24, 0.18, 0.04);
  }, 1.2, 1.2, 13);
  pack.position.set(0, 0.78, -0.28);
  root.add(pack);

  // Kazooie peeking out of the blue backpack!
  const kazPivot = new THREE.Group();
  kazPivot.position.set(0, 1.72, -0.34);
  const kaz = card((g) => {
    g.fillStyle = C.kazRed;
    // Neck & head
    D.rect(g, -0.16, 0, 0.32, 0.55, 0.1);
    D.ell(g, 0.02, 0.65, 0.3, 0.26);
    // Spiky red crest
    D.poly(g, [[-0.1, 0.86], [-0.36, 1.18], [0.04, 0.94]]);
    D.poly(g, [[0.02, 0.88], [-0.12, 1.24], [0.16, 0.9]]);
    // Bright orange-yellow beak pointing forward/side
    g.fillStyle = C.kazBeak;
    D.poly(g, [[0.2, 0.74], [0.68, 0.6], [0.2, 0.5]]);
    // Cheeky eye
    g.fillStyle = '#faf3e0';
    D.ell(g, 0.1, 0.72, 0.1, 0.11);
    g.fillStyle = C.ink;
    D.ell(g, 0.12, 0.72, 0.045, 0.05);
  }, 1.2, 1.3, 14);
  kaz.position.set(0.08, 0, 0);
  kazPivot.add(kaz);
  root.add(kazPivot);

  // Striding arms & legs
  const makeLimb = (col, w, h, seed) => card((g) => {
    g.fillStyle = col;
    D.rect(g, -w * 0.38, 0.08, w * 0.76, h * 0.82, w * 0.28);
  }, w, h, seed);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.62, 1.52, 0.04);
  armR.position.set(0.62, 1.52, 0.04);
  const armLM = makeLimb(C.fur, 0.38, 0.72, 15); armLM.position.y = -0.62; armL.add(armLM);
  const armRM = makeLimb(C.fur, 0.38, 0.72, 16); armRM.position.y = -0.62; armR.add(armRM);
  root.add(armL, armR);

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.28, 0.62, 0.02);
  legR.position.set(0.28, 0.62, 0.02);
  const legLM = makeLimb(C.fur, 0.42, 0.66, 17); legLM.position.y = -0.62; legL.add(legLM);
  const legRM = makeLimb(C.fur, 0.42, 0.66, 18); legRM.position.y = -0.62; legR.add(legRM);
  root.add(legL, legR);

  root.userData.stride = (walked, gait) => {
    const s = Math.sin(walked * 2.1) * gait;
    legL.rotation.x = s * 0.55;
    legR.rotation.x = -s * 0.55;
    armL.rotation.x = -s * 0.45;
    armR.rotation.x = s * 0.45;
    kazPivot.position.y = 1.72 + Math.abs(Math.sin(walked * 4.2)) * 0.09 * gait;
    kazPivot.rotation.z = Math.sin(walked * 2.1) * 0.12 * gait;
  };
  return root;
}

// ---- 5. Custom Spiral Mountain Landmarks (Banjo's Cottage, Mumbo's Skull, Gruntilda's Lair, Moat Bridge) ----
function banjoCottage(x, z) {
  const paints = {
    wall: (P) => {
      const { box, g } = P;
      P.gradient(P2.shade(C.wall, 0.08), P2.shade(C.wall, -0.12), 0.5);
      P.felt(0.75);
      // Timber beams
      P.layer(() => {
        g.fillRect(box.x0, box.y0, box.w, box.h * 0.14);
        g.fillRect(box.x0, box.y0 + box.h * 0.88, box.w, box.h * 0.12);
        g.fillRect(box.x0 + box.w * 0.04, box.y0, box.w * 0.09, box.h);
        g.fillRect(box.x1 - box.w * 0.13, box.y0, box.w * 0.09, box.h);
      }, C.trunk, { shadow: 2, lip: 1 });
      // Arched cottage door + warm window
      P.layer(() => {
        const dx = box.x0 + box.w * 0.24, dw = box.w * 0.24, dh = box.h * 0.56;
        g.beginPath();
        g.moveTo(dx, box.y0);
        g.lineTo(dx, box.y0 + dh * 0.72);
        g.arc(dx + dw / 2, box.y0 + dh * 0.72, dw / 2, Math.PI, 0, false);
        g.lineTo(dx + dw, box.y0);
        g.closePath();
      }, '#7a4522', { shadow: 2.5, lip: 1.2 });
      P.layer(() => {
        g.fillRect(box.x0 + box.w * 0.6, box.y0 + box.h * 0.34, box.w * 0.22, box.h * 0.3);
      }, C.window, { shadow: 2, lip: 1 });
      P.innerShade(C.ink, { alpha: 0.25, blurPx: 7 });
    },
    roof: (P) => {
      const { box } = P;
      P.gradient(P2.shade(C.roof, 0.14), P2.shade(C.roof, -0.18), 0.5);
      P.felt(0.75);
      P2.scallopTiles(P, box, { color: P2.shade(C.roof, -0.28), rows: 6 });
      P.innerShade(C.ink, { alpha: 0.25, blurPx: 8 });
    },
  };
  return boxFold({ w: 5.4, d: 4.2, wallH: 3.4, roofH: 2.7, paper: H.paper, seed: 71, paints, print: H.cardOpts(x, z) });
}

function mumboSkullHut(x, z) {
  const g = new THREE.Group();
  g.name = 'mumbo-skull';
  const [pts, paint] = P2.drawnPiece((ctx) => {
    // Feather headdress
    ctx.fillStyle = C.mumboTeal;
    D.poly(ctx, [[-0.6, 4.1], [-1.8, 5.4], [-0.2, 4.6]]);
    D.poly(ctx, [[0.6, 4.1], [1.8, 5.4], [0.2, 4.6]]);
    ctx.fillStyle = '#d93c2e';
    D.poly(ctx, [[-0.2, 4.3], [0, 5.8], [0.2, 4.3]]);
    // Giant carved skull
    ctx.fillStyle = C.bone;
    D.ell(ctx, 0, 2.7, 2.35, 1.85);
    D.rect(ctx, -1.65, 0, 3.3, 1.6, 0.25);
    // Glowing turquoise eyes
    ctx.fillStyle = '#23302e';
    D.ell(ctx, -0.82, 2.85, 0.52, 0.48);
    D.ell(ctx, 0.82, 2.85, 0.52, 0.48);
    ctx.fillStyle = '#4ad8c4';
    D.ell(ctx, -0.82, 2.85, 0.28, 0.26);
    ctx.fillStyle = '#4ad8c4';
    D.ell(ctx, 0.82, 2.85, 0.28, 0.26);
    // Skull nose & dark doorway mouth
    ctx.fillStyle = '#332216';
    D.poly(ctx, [[0, 2.35], [-0.28, 1.85], [0.28, 1.85]]);
    D.rect(ctx, -0.95, 0, 1.9, 1.25, 0.2);
    // Teeth above doorway
    ctx.fillStyle = C.bone;
    for (let i = -2; i <= 2; i++) D.rect(ctx, i * 0.36 - 0.12, 1.02, 0.24, 0.3, 0.04);
  }, { w: 5.2, h: 6.0, name: 'mumbo-skull' });

  const front = makeCard(pts, { paint, paper: H.paper, seed: 82, ...H.cardOpts(x, z) });
  const back = makeCard(pts, { paint, paper: H.paper, seed: 83, ...H.cardOpts(x, z) });
  front.position.z = 0.7;
  back.position.z = -0.7;
  back.scale.set(0.92, 0.94, 1);
  g.add(front, back);
  return g;
}

function gruntildaLairGate(x, z) {
  const g = new THREE.Group();
  g.name = 'gruntilda-lair';
  const [pts, paint] = P2.drawnPiece((ctx) => {
    // Jagged witch mountain crag
    ctx.fillStyle = C.stoneDark;
    D.poly(ctx, [[-4.4, 0], [-3.6, 4.4], [-2.1, 6.2], [0, 7.8], [2.2, 6.0], [3.8, 4.2], [4.4, 0]]);
    // Purple witch hat peak
    ctx.fillStyle = C.witchPurple;
    D.poly(ctx, [[-2.6, 5.2], [2.6, 5.2], [0.4, 8.6]]);
    ctx.fillStyle = '#f2b22e';
    D.rect(ctx, -1.6, 5.2, 3.2, 0.42, 0.08);
    // Carved green witch face
    ctx.fillStyle = C.witchSkin;
    D.ell(ctx, 0, 3.2, 2.4, 2.0);
    // Glowing yellow-lime eyes
    ctx.fillStyle = '#24182a';
    D.poly(ctx, [[-1.4, 3.9], [-0.4, 3.65], [-1.2, 3.3]]);
    D.poly(ctx, [[1.4, 3.9], [0.4, 3.65], [1.2, 3.3]]);
    ctx.fillStyle = '#d4f24a';
    D.ell(ctx, -0.95, 3.6, 0.22, 0.16);
    D.ell(ctx, 0.95, 3.6, 0.22, 0.16);
    // Crooked witch nose
    ctx.fillStyle = P2.shade(C.witchSkin, 0.18);
    D.poly(ctx, [[0, 3.5], [-0.45, 2.6], [0.35, 2.75]]);
    // Glowing lime lair archway mouth
    ctx.fillStyle = '#2b1a36';
    D.rect(ctx, -1.35, 0, 2.7, 2.1, 0.35);
    ctx.fillStyle = C.witchLime;
    D.rect(ctx, -1.0, 0, 2.0, 1.75, 0.28);
  }, { w: 9.0, h: 8.8, name: 'gruntilda-lair' });

  const arch = makeCard(pts, { paint, paper: H.paper, seed: 95, ...H.cardOpts(x, z) });
  const backRock = makeCard(pts, { paint: paintRockCard('#58545c'), paper: H.paper, seed: 96, ...H.cardOpts(x, z) });
  backRock.position.set(0.3, -0.2, -1.1);
  backRock.scale.set(1.06, 0.92, 1);
  g.add(arch, backRock);
  return g;
}

// ---- 6. Story Chapters & Unfolding Pop-Up System ----
const STORY_CHAPTERS = [
  {
    id: 0,
    num: 'Chapter I',
    title: "Morning at Banjo's Cottage",
    speaker: 'Kazooie (from the Backpack)',
    body: '"Wake up, fuzzball! While you were snoring away, that old witch Gruntilda swooped down on her broomstick and snatched your little sister Tooty! Put on your yellow shorts and let\'s move!"',
    hint: 'Walk north along the sandy spiral trail to Bottles\' Garden.',
    pos: [pathX(4.5), 4.5],
    radius: 5.5,
  },
  {
    id: 1,
    num: 'Chapter II',
    title: "Bottles' Molehill & The Garden",
    speaker: 'Bottles the Mole',
    body: '"Guh-huh, Banjo! I saw Gruntilda flying across the moat toward her mountain lair! She\'s jealous of Tooty\'s beauty. Watch out for Topper the Carrot and Bawl the Onion — follow the path to the wooden bridge!"',
    hint: 'Cross the wooden bridge over the cerulean moat.',
    pos: [pathX(-2.5) + 3.2, -2.5],
    radius: 5.8,
  },
  {
    id: 2,
    num: 'Chapter III',
    title: 'The Spiral Moat Crossing',
    speaker: 'Banjo & Kazooie',
    body: '"Guh-huh! Look at those shiny golden Jiggies and a little blue Jinjo waving by the bridge!" Kazooie squawks: "Grab \'em all! We\'ll need every Jiggy and Note to unlock Gruntilda\'s lair!"',
    hint: 'Continue across the bridge toward Mumbo\'s Skull Glade.',
    pos: [0, 0], // filled dynamically at the bridge crossing
    radius: 6.0,
  },
  {
    id: 3,
    num: 'Chapter IV',
    title: "Mumbo's Skull Glade",
    speaker: 'Mumbo Jumbo',
    body: '"Eekum Bokum! Mumbo best shaman in whole Spiral Mountain! Bring Mumbo shiny tokens and Mumbo turn bear into termite, crocodile, or pumpkin — much better than smelly bear!"',
    hint: 'Head up the rocky rise to Gruntilda\'s Lair Gate.',
    pos: [-11.5, -14.5],
    radius: 6.2,
  },
  {
    id: 4,
    num: 'Chapter V',
    title: "Gruntilda's Lair Gate",
    speaker: 'Gruntilda Winkybunion',
    body: '"Welcome, bear, and feathered pest! To save your sister, pass my test! My worlds await behind this door — you\'ll wish you\'d stayed on Banjo\'s floor!" — All 5 Spiral Mountain chapters discovered!',
    hint: 'You have unfolded the full Spiral Mountain story! Keep exploring.',
    pos: [-5.5, -21.5],
    radius: 6.8,
  },
];

// ---- 7. Build the World ----
const SPINNERS = [];
const LIFE = { chimneys: [], floaters: [] };
const taken = [];
const mark = (x, z, r) => taken.push([x, z, r]);
const moatDist = (x, z) => Math.abs(x - moatX(z));
const pathDist = (x, z) => Math.abs(x - pathX(z));
const free = (x, z, r = 0.8) =>
  moatDist(x, z) > 3.1 + r &&
  pathDist(x, z) > 1.7 + r &&
  taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + r);

const group = (x, z, kinds, spread = 1.0) => {
  const pts = clusterLayout(x, z, { n: kinds.length, size: 1.5, seed: Math.round(x * 31 + z * 17) + 99, spread });
  kinds.forEach((k, i) => {
    const p = pts[i];
    if (moatDist(p.x, p.z) < 3.0 || pathDist(p.x, p.z) < 1.65) return;
    popup(...K[k](), { x: p.x, z: p.z, yaw: (rnd() - 0.5) * 0.65, scale: 0.78 + rnd() * 0.34, sway: k === 'bush' || k === 'tuft' ? 0.55 : 0 });
  });
};

function addSpinner(kind, x, z, yBase = 0.4, scale = 1.05) {
  const h = popup(...K[kind](), { x, z, scale });
  SPINNERS.push({ group: h.group, yBase, phase: rnd() * 6.28 });
  return h;
}

function buildWorld() {
  // Find where the spiral path crosses the moat stream
  let bz = -10;
  for (let z = -34; z < 10; z += 0.1) {
    if (Math.sign(pathX(z) - moatX(z)) !== Math.sign(pathX(z + 0.1) - moatX(z + 0.1))) {
      bz = z;
      break;
    }
  }
  const bx = moatX(bz);
  STORY_CHAPTERS[2].pos = [bx, bz];

  // Chapter I Landmark: Banjo's Cottage (lower-right, beside start)
  {
    const cx = pathX(5.5) + 5.6, cz = 4.2;
    const cottage = banjoCottage(cx, cz);
    const h = popup(null, null, { node: cottage, height: 6.2, x: cx, z: cz, yaw: -0.42, solid: 3.2 });
    H.glowing(h.group);
    H.lamp(cx - 2.2, 2.2, cz + 2.2, 0.9, 10);
    mark(cx, cz, 4.6);
    LIFE.chimneys.push(new THREE.Vector3(cx + 1.2, 5.8, cz - 0.4));
    // Fence & Golden Jiggy by the cottage door
    popup(...K.fence(), { x: cx - 3.6, z: cz + 2.6, yaw: -0.35 });
    addSpinner('jiggy', pathX(4.5) + 2.2, 4.0, 0.35, 1.0);
    addSpinner('note', pathX(2.0) + 1.2, 2.0, 0.45, 0.9);
  }

  // Chapter II Landmark: Bottles' Molehill & Vegetable Garden
  {
    const mx = pathX(-2.5) + 2.4, mz = -2.5;
    popup(...K.molehill(), { x: mx, z: mz, yaw: -0.25, scale: 1.15, solid: 1.0 });
    mark(mx, mz, 2.4);
    addSpinner('jiggy', mx + 1.4, mz - 1.3, 0.4, 1.0);
    // Grumpy Veggies in the tilled garden
    popup(...K.carrot(), { x: GARDEN.x - 1.6, z: GARDEN.z - 0.8, yaw: 0.2, scale: 1.1 });
    popup(...K.onion(), { x: GARDEN.x + 1.2, z: GARDEN.z + 0.6, yaw: -0.25, scale: 1.15 });
    popup(...K.carrot(), { x: GARDEN.x + 2.2, z: GARDEN.z - 1.2, yaw: -0.15, scale: 0.95 });
    popup(...K.honeycomb(), { x: GARDEN.x - 0.2, z: GARDEN.z + 1.4, scale: 1.1 });
    mark(GARDEN.x, GARDEN.z, 4.8);
  }

  // Chapter III Landmark: Built Walkable Wooden Bridge over the Moat
  {
    const dxp = pathX(bz + 0.5) - pathX(bz - 0.5);
    const yawB = Math.atan2(dxp, 1);
    const span = 10.4, bw = 3.4, bh = 0.55;
    const bridgeDeck = platform({
      w: bw, d: span, h: bh,
      paper: H.paper, seed: 91,
      paints: {
        face: paintWoodCard(C.wood, 2),
        deck: paintWoodCard('#b97e48', 10),
        support: paintWoodCard(C.trunk, 2),
      },
      print: H.cardOpts(bx, bz),
    });
    bridgeDeck.name = 'spiral-bridge';
    popup(null, null, { node: bridgeDeck, height: bh + 1.2, x: bx, z: bz, yaw: yawB, level: true });
    walk.add(bridgeDeck);
    mark(bx, bz, span * 0.52);
    // Signpost, Blue Jinjo & Golden Jiggy at the bridgehead
    popup(...K.sign(), { x: bx + 3.2, z: bz + 3.2, yaw: -0.45, scale: 1.05 });
    popup(...K.jinjo('#3e84d6'), { x: bx - 2.6, z: bz + 3.0, yaw: 0.3, scale: 1.15, sway: 0.5 });
    addSpinner('jiggy', bx, bz, bh + 0.55, 1.05);
    addSpinner('note', bx - 1.2, bz - 2.5, 0.45, 0.9);
  }

  // Moat blocks walking except on the bridge deck
  walk.block((x, z) => moatDist(x, z) < 2.7);
  for (const [z, dx, col] of [[-6, -0.6, '#46b864'], [-15, 0.5, '#e86ca0']]) {
    LIFE.floaters.push([popup(...K.jinjo(col), { x: moatX(z) + dx, z, yaw: 0.3, scale: 0.9 }), 0.35]);
  }
  for (const [z, sd] of [[-26, -1], [-18, 1], [-12, -1], [-4, 1], [2, -1]]) {
    const x = moatX(z) + sd * 4.2;
    popup(...K.reeds(), { x, z, yaw: (rnd() - 0.5) * 0.6, sway: 0.7 });
    mark(x, z, 1.5);
  }

  // Chapter IV Landmark: Mumbo's Skull Glade (upper-left)
  {
    const [mx, mz] = STORY_CHAPTERS[3].pos;
    const skull = mumboSkullHut(mx - 2.4, mz - 2.2);
    const h = popup(null, null, { node: skull, height: 6.2, x: mx - 2.4, z: mz - 2.2, yaw: 0.38, solid: 2.8 });
    H.glowing(h.group);
    H.lamp(mx - 1.8, 2.4, mz - 0.6, 0.85, 11);
    mark(mx - 2.4, mz - 2.2, 4.4);
    addSpinner('jiggy', mx + 1.0, mz + 0.4, 0.4, 1.05);
    popup(...K.jinjo('#f2c438'), { x: mx + 2.4, z: mz - 1.2, yaw: -0.3, scale: 1.1, sway: 0.4 });
  }

  // Chapter V Landmark: Gruntilda's Lair Gate (far-center-left rocky rise)
  {
    const [gx, gz] = STORY_CHAPTERS[4].pos;
    const lair = gruntildaLairGate(gx, gz - 3.0);
    const h = popup(null, null, { node: lair, height: 8.8, x: gx, z: gz - 3.0, yaw: 0.12, solid: 3.6 });
    H.glowing(h.group);
    H.lamp(gx, 2.6, gz - 0.8, 1.0, 12);
    mark(gx, gz - 3.0, 5.4);
    addSpinner('jiggy', gx, gz + 0.8, 0.5, 1.2);
    addSpinner('note', gx - 2.2, gz + 1.2, 0.45, 0.95);
    addSpinner('note', gx + 2.2, gz + 1.2, 0.45, 0.95);
  }

  // Layered Spiral Mountain backdrop hills at the far edge
  for (const [hx, hz] of [[-28, -33], [22, -32], [4, -36]]) {
    for (let k = 0; k < 3; k++) {
      popup(...K.hill(k), { x: hx + (k - 1) * 0.9, z: hz + k * 1.4 });
    }
    mark(hx, hz + 1.4, 5.5);
  }

  // Banjo & Kazooie Hero!
  const doll = banjoHero();
  const hero = popup(null, null, { node: doll, height: 3.2, x: HERO_AT[0], z: HERO_AT[1], sway: 0.16, scale: 1.18 });
  H.setHero(hero, { stride: doll.userData.stride });
  mark(HERO_AT[0], HERO_AT[1], 2.2);

  // ---- 8. Dense Spiral Mountain Fill (trees, pines, bushes, rocks, wildflowers, notes) ----
  rnd = P2.rng(505);
  const cellSeed = (gx, gz, salt) => (Math.imul(Math.round(gx * 10), 73856093) ^ Math.imul(Math.round(gz * 10), 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
  const lush = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.12 + 0.5) * Math.sin(z * 0.14 + 1.2) + 0.15 * Math.sin(x * 0.2 + z * 0.16);
  const trees = [], placed = [];
  const DRESS = ['bush', 'bush', 'rock', 'tuft', 'tuft', 'honeycomb'];
  const corridor = (x, z) => z > HERO_AT[1] - 1 && z < HERO_AT[1] + 15 && Math.abs(x - HERO_AT[0]) < 6.5 + (z - HERO_AT[1]) * 0.3;

  const fillGroups = (see) => {
    for (let gz = -42; gz <= 16; gz += 3.3) {
      for (let gx = -44; gx <= 44; gx += 3.3) {
        rnd = P2.rng(cellSeed(gx, gz, 19));
        const x = gx + (rnd() - 0.5) * 2.5, z = gz + (rnd() - 0.5) * 2.5, l = lush(x, z);
        if (!see(x, z, 0.12, 4) || l < 0.28 || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3.1)) continue;
        placed.push([x, z]);
        if (l > 0.54 && free(x, z, 1.6) && !corridor(x, z) && trees.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > 5.0)) {
          trees.push([x, z]);
          if (rnd() < 0.34) popup(...K.pine(), { x, z, cross: true, sway: 0.45 });
          else popup(...K.tree(), { x, z, cross: true, sway: 0.7 });
        } else if (free(x, z, 1.0)) {
          const kinds = [];
          const n = 3 + Math.floor(rnd() * 3);
          for (let i = 0; i < n; i++) kinds.push(DRESS[Math.floor(rnd() * DRESS.length)]);
          group(x, z, kinds, 1.1);
        }
      }
    }
  };
  fillGroups(H.inFrame);

  // Foreground blurred miniature-scale framing trees/bushes along bottom edge
  rnd = P2.rng(606);
  for (const [sx, dz, s, kind] of [[-1.02, 5.4, 1.9, 'tree'], [-0.36, 6.8, 1.7, 'bush'], [1.02, 7.0, 2.0, 'tree'], [0.32, 8.0, 1.5, 'bush']]) {
    const p = H.groundAt(sx, -1);
    if (!p) continue;
    if (kind === 'bush') popup(...K.bush(), { x: p.x, z: p.z + dz, scale: s, sway: 0.4 });
    else popup(...K.tree(), { x: p.x, z: p.z + dz, cross: true, scale: s, sway: 0.55 });
  }

  // Fill outer walk ring
  RES = 0.72;
  fillGroups((x, z, m, y) => H.inReach(x, z, m, y) && !H.inFrame(x, z, m, y));
}

if (flags.TEST) {
  const doll = banjoHero();
  const hero = popup(null, null, { node: doll, height: 3.2, x: 3, z: -6, scale: 1.18 });
  H.setHero(hero, { stride: doll.userData.stride });
  popup(...K.tree(), { x: -1, z: -8, cross: true });
  popup(...K.molehill(), { x: 7, z: -6 });
} else {
  buildWorld();
}

// ---- 9. Living World (smoke, highland butterflies, floating sparkles, bobbing Jinjos & spinning Jiggies) ----
const life = createLife({ scene: H.scene, camera: H.camera, heroHeight: 3.6, seed: 88 });
life.puffs({ at: LIFE.chimneys.map(c => c.toArray()), colors: ['#faf3e4'] });
life.fallers({ cut: 'leaf', count: 16, colors: ['#f4c430', '#7db458', '#faf3e0'] });
life.flyers({ count: 8, colors: ['#f4c430', '#4da8b8', '#e86a52'] });

// ---- 10. Interactive Story HUD & Proximity Triggering ----
const foundChapters = new Set();
let activeChapterId = -1;
let dismissedId = -1;

const elChapters = document.getElementById('chapters');
const elStatus = document.getElementById('chap-status');
const elJiggyCount = document.getElementById('jiggy-count');
const elCard = document.getElementById('story-card');
const elNum = document.getElementById('story-num');
const elTitle = document.getElementById('story-title');
const elSpeaker = document.getElementById('story-speaker');
const elBody = document.getElementById('story-body');
const elHint = document.getElementById('story-hint');
const elClose = document.getElementById('story-close');

function renderChapterDots() {
  if (!elChapters) return;
  elChapters.innerHTML = '';
  STORY_CHAPTERS.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chap-dot' + (foundChapters.has(ch.id) ? ' found' : '') + (activeChapterId === ch.id ? ' active' : '');
    btn.textContent = String(idx + 1);
    btn.title = ch.title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openChapter(ch.id, true);
    });
    elChapters.appendChild(btn);
  });
  if (elJiggyCount) elJiggyCount.textContent = `Jiggies: ${foundChapters.size} / ${STORY_CHAPTERS.length}`;
  if (elStatus) {
    elStatus.textContent = foundChapters.size === STORY_CHAPTERS.length
      ? 'All 5 chapters unfolded!'
      : 'Walk the path to unfold the story';
  }
}

function openChapter(id, force = false) {
  const ch = STORY_CHAPTERS[id];
  if (!ch || !elCard) return;
  if (!force && dismissedId === id) return;
  foundChapters.add(id);
  activeChapterId = id;
  dismissedId = -1;
  elNum.textContent = ch.num;
  elTitle.textContent = ch.title;
  elSpeaker.textContent = ch.speaker;
  elBody.textContent = ch.body;
  elHint.textContent = ch.hint;
  elCard.classList.add('open');
  renderChapterDots();
}

if (elClose) {
  elClose.addEventListener('click', (e) => {
    e.stopPropagation();
    dismissedId = activeChapterId;
    elCard.classList.remove('open');
  });
}

renderChapterDots();

// Animate spinners, floaters, life, and check Banjo's proximity to story chapters
H.onStep((t, dt) => {
  life.update(dt, H.target);
  for (const s of SPINNERS) {
    s.group.rotation.y = t * 1.4 + s.phase;
    s.group.position.y = s.yBase + Math.sin(t * 2.4 + s.phase) * 0.14;
  }
  for (const [f, amp] of LIFE.floaters) {
    f.group.position.y = Math.sin(t * 2.1 + f.group.position.z) * 0.08 * amp;
  }

  // Check proximity to story landmarks
  if (H.hero && !flags.TEST) {
    const hx = H.hero.group.position.x;
    const hz = H.hero.group.position.z;
    let nearest = null;
    for (const ch of STORY_CHAPTERS) {
      const d = Math.hypot(hx - ch.pos[0], hz - ch.pos[1]);
      if (d < ch.radius) {
        nearest = ch;
        break;
      }
    }
    if (nearest && nearest.id !== activeChapterId && nearest.id !== dismissedId) {
      openChapter(nearest.id);
    } else if (!nearest && activeChapterId !== -1) {
      // Allow re-triggering if player walks away and comes back
      dismissedId = -1;
    }
  }
});

H.onRestart(() => {
  life.reset(H.target);
});

H.start();
