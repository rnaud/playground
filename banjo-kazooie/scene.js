// Banjo-Kazooie: Spiral Mountain — Interactive 3D Papercraft Pop-Up Story
import * as THREE from 'three';
import * as P2 from 'papercraft/lib/paperkit-2d.js';
import { makeCard, boxFold, clusterLayout } from 'papercraft/lib/paperkit-3d.js';
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
  furDark: '#8b4e22',
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
};

// Leading lines: the cerulean moat curves diagonally across the valley while the sandy spiral path winds
// from Banjo's Cottage (lower-right) -> Bottles' Garden (mid-right) -> Arched Wooden Bridge (mid-center)
// -> Mumbo's Skull Glade (upper-left) -> Gruntilda's Lair Gate (north-west crag).
const moatX = (z) => -10.5 - z * 0.65 + Math.sin(z * 0.14) * 2.2 + Math.sin(z * 0.22 + 1.8) * 1.6;
const pathX = (z) => 7.0 + z * 0.68 + Math.sin(z * 0.14 + 0.9) * 2.2 + Math.sin(z * 0.22 + 0.3) * 1.8;

const HERO_AT = [pathX(4.5), 4.5];

const H = createHarness({
  ground: C.ground,
  stock: '#f7f1e1',
  view: { pitch: 47, dist: 64, target: [1.5, 1.5, -6.5] },
  bounds: { x0: -64, x1: 64, z0: -68, z1: 38 },
  play: true,
  walkArea: { x0: -25, x1: 25, z0: -29, z1: 10 },
  camBox: { x0: -12, x1: 8, z0: -20, z1: -2 },
  subject: HERO_AT,
  light: { leak: '#7a6648' },
});
const { walk, flags } = H;
let RES = 1;
const popup = (pts, paint, o = {}) => H.popup(pts, paint, { res: RES, ...o });

// ---- 2. Printed Ground: Spiral Mountain meadow, moat stream, sandy spiral trail, garden patch ----
const GARDEN = { x: pathX(-2.5) + 7.2, z: -2.5, w: 7.6, d: 5.6, angle: -0.16 };

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

  // Cerulean moat stream with torn cream shore, deep channel & ripples
  torn(band(moatX, (z) => 3.1 + Math.sin(z * 0.35) * 0.16), '#f0e6c8');
  torn(band(moatX, (z) => 2.55 + Math.sin(z * 0.28 + 1) * 0.18), C.moat, 'rgba(250,245,230,0.35)');
  ribbon(moatX, 2.1, P2.rgba(C.moatDeep, 0.52), undefined, undefined, 0.4);
  for (let k = 0, n = Math.round(2.5 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0);
    const x = moatX(z) + (rnd() - 0.5) * 3.5;
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
  torn(band(pathX, (z) => 1.45 + Math.sin(z * 0.45) * 0.14), C.path);
  ribbon(pathX, 0.78, P2.rgba('#faf0d8', 0.48), undefined, undefined, 0.22);
  for (const sd of [-1, 1]) {
    ribbon((z) => pathX(z) + sd * (1.65 + Math.sin(z * 0.45) * 0.14), 0.34, P2.rgba(P2.shade(C.wash, -0.2), 0.28), undefined, undefined, 0.15);
  }
  for (let k = 0, n = Math.round(18 * (H.bounds.z1 - H.bounds.z0)); k < n; k++) {
    const z = H.bounds.z0 + rnd() * (H.bounds.z1 - H.bounds.z0);
    const x = pathX(z) + (rnd() - 0.5) * 2.5;
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

// ---- 3. Layered Paper Pieces (every P.layer draws onto its callback mg and fills!) ----
let rnd = P2.rng(404);
const D = P2.draw2;
const between = (a, b) => a + rnd() * (b - a);
const mound = (w, h, lobes = 7, depth = 0.16) => P2.shape.mound(rnd, { w, h, lobes, depth });

function paintSpiralTree(leafCol, trunkCol = C.trunk) {
  const light = P2.shade(leafCol, 0.22);
  const mid = P2.shade(leafCol, -0.06);
  const dark = P2.shade(leafCol, -0.24);
  const accent = P2.mix(leafCol, '#f2c438', 0.48);
  return (P) => {
    const { box, pts } = P;
    const cx = (box.x0 + box.x1) * 0.5;
    P.gradient(light, dark, 0.5);
    P.felt(0.7);
    // Fat trunk & Y-limbs cut layer
    P.layer((mg) => {
      P2.fillLimb(mg, cx, box.y0, cx - box.w * 0.04, box.y0 + box.h * 0.24, cx, box.y0 + box.h * 0.5, box.w * 0.13, box.w * 0.045);
      P2.fillLimb(mg, cx, box.y0 + box.h * 0.32, cx - box.w * 0.14, box.y0 + box.h * 0.46, cx - box.w * 0.24, box.y0 + box.h * 0.56, box.w * 0.055, box.w * 0.02);
      P2.fillLimb(mg, cx, box.y0 + box.h * 0.35, cx + box.w * 0.15, box.y0 + box.h * 0.48, cx + box.w * 0.24, box.y0 + box.h * 0.58, box.w * 0.055, box.w * 0.02);
    }, trunkCol, { shadow: 1.2, lip: 0.9, depth: 0.9 });
    // Countable layered leaves batched into 3 colour passes (fast + true layered applique)
    const r = P2.rng(Math.round(box.w * 100 + box.h * 37));
    const buckets = [[], [], []];
    for (let i = 0; i < 20; i++) {
      const y = box.y0 + box.h * (0.34 + r() * 0.58);
      const sp = P2.spanAt(pts, y);
      if (!sp) continue;
      const x = sp[0] + (sp[1] - sp[0]) * (0.14 + r() * 0.72);
      const b = i % 5 === 0 ? 2 : i % 2 === 0 ? 1 : 0;
      buckets[b].push([x, y, box.w * (0.13 + r() * 0.06), -0.8 + r() * 1.6]);
    }
    const cols = [mid, light, accent];
    buckets.forEach((list, idx) => {
      if (!list.length) return;
      P.layer((mg) => {
        for (const [lx, ly, L, a] of list) P2.fillLeaf(mg, lx, ly, L, a, 0.4);
      }, cols[idx], { shadow: 1.1, lip: 1.0, depth: 0.85 });
    });
    P.innerShade(C.ink, { alpha: 0.24, blurPx: 8 });
  };
}

function paintPineTree() {
  return (P) => {
    const { box } = P;
    const cx = (box.x0 + box.x1) * 0.5;
    P.gradient(P2.shade(C.pine, 0.16), P2.shade(C.pine, -0.22), 0.5);
    P.felt(0.7);
    P.layer((mg) => {
      mg.fillRect(cx - box.w * 0.09, box.y0, box.w * 0.18, box.h * 0.24);
    }, C.trunk, { shadow: 1.0, lip: 0.8, depth: 0.8 });
    for (let t = 0; t < 4; t++) {
      const y0 = box.y0 + box.h * (0.17 + t * 0.19);
      const w = box.w * (0.48 - t * 0.085);
      const h = box.h * 0.27;
      const col = t % 2 === 0 ? P2.shade(C.pine, 0.16) : P2.shade(C.pine, -0.08);
      P.layer((mg) => {
        mg.beginPath();
        mg.moveTo(cx - w, y0);
        mg.lineTo(cx, y0 + h);
        mg.lineTo(cx + w, y0);
        mg.closePath();
        mg.fill();
      }, col, { shadow: 1.15, lip: 0.9, rim: 0.6, depth: 0.85 });
    }
    P.innerShade(C.ink, { alpha: 0.24, blurPx: 7 });
  };
}

function paintBushCard(baseCol, flowers = true) {
  return (P) => {
    const { box } = P;
    P.gradient(P2.shade(baseCol, 0.18), P2.shade(baseCol, -0.22), 0.5);
    P.felt(0.7);
    const r = P2.rng(Math.round(box.w * 53 + box.h * 19 + 17));
    P.layer((mg) => {
      for (let i = 0; i < 8; i++) {
        const lx = box.x0 + box.w * (0.16 + r() * 0.68);
        const ly = box.y0 + box.h * (0.24 + r() * 0.56);
        P2.fillLeaf(mg, lx, ly, box.w * 0.15, -0.9 + r() * 1.8, 0.42);
      }
    }, P2.shade(baseCol, 0.26), { shadow: 1.0, lip: 0.9, depth: 0.75 });
    if (flowers) {
      const fCol = r() < 0.5 ? '#f4c430' : '#f7efe0';
      const ptsF = [];
      for (let i = 0; i < 5; i++) {
        ptsF.push([box.x0 + box.w * (0.18 + r() * 0.64), box.y0 + box.h * (0.28 + r() * 0.5)]);
      }
      const rr = box.w * 0.052;
      P.layer((mg) => {
        for (const [fx, fy] of ptsF) { mg.beginPath(); mg.arc(fx, fy, rr, 0, 7); mg.fill(); }
      }, fCol, { shadow: 0.9, lip: 0.8, depth: 0.6 });
      P.draw((dg) => {
        dg.fillStyle = '#d95432';
        for (const [fx, fy] of ptsF) { dg.beginPath(); dg.arc(fx, fy, rr * 0.42, 0, 7); dg.fill(); }
      });
    }
    P.innerShade(C.ink, { alpha: 0.24, blurPx: 7 });
  };
}

function paintRockCard(col = C.stone) {
  return (P) => {
    const { box } = P;
    P.gradient(P2.shade(col, 0.16), P2.shade(col, -0.22), 0.45);
    P.felt(0.75);
    P.layer((mg) => {
      mg.beginPath();
      mg.moveTo(box.x0 + box.w * 0.1, box.y0 + box.h * 0.12);
      mg.lineTo(box.x0 + box.w * 0.46, box.y0 + box.h * 0.78);
      mg.lineTo(box.x0 + box.w * 0.82, box.y0 + box.h * 0.34);
      mg.lineTo(box.x0 + box.w * 0.66, box.y0 + box.h * 0.06);
      mg.closePath();
      mg.fill();
    }, P2.shade(col, 0.14), { shadow: 1.1, lip: 0.9, depth: 0.85 });
    // Moss cap
    P.layer((mg) => {
      mg.beginPath();
      mg.ellipse(box.x0 + box.w * 0.46, box.y0 + box.h * 0.82, box.w * 0.28, box.h * 0.14, -0.1, 0, 7);
      mg.fill();
    }, C.leafB, { shadow: 1.0, lip: 0.8, depth: 0.7 });
    P.innerShade(C.ink, { alpha: 0.28, blurPx: 8 });
  };
}

function paintWoodCard(woodCol = C.wood, planks = 3, vertical = false) {
  return (P) => {
    const { box } = P;
    P.gradient(P2.shade(woodCol, 0.14), P2.shade(woodCol, -0.18), 0.5);
    P.felt(0.7);
    P.layer((mg) => {
      for (let i = 0; i < planks; i++) {
        mg.fillStyle = i % 2 ? P2.shade(woodCol, -0.08) : P2.shade(woodCol, 0.07);
        const f0 = i / planks, f1 = (i + 1) / planks;
        if (vertical) mg.fillRect(box.x0 + box.w * f0 + box.w * 0.01, box.y0, box.w * (f1 - f0) - box.w * 0.02, box.h);
        else mg.fillRect(box.x0, box.y0 + box.h * f0 + box.h * 0.012, box.w, box.h * (f1 - f0) - box.h * 0.024);
      }
    }, woodCol, { lip: 0.75, depth: 0.7 });
    P.innerShade(C.ink, { alpha: 0.26, blurPx: 6 });
  };
}

// Spiral Mountain signature pieces
const K = {
  tree: () => {
    const h = between(7.2, 9.0), w = h * between(0.75, 0.86);
    const pts = P2.roughen(P2.shape.mound(rnd, { w, h, lobes: 7, depth: 0.16 }), rnd);
    const col = [C.leafA, C.leafB, C.leafC][Math.floor(rnd() * 3)];
    return [pts, paintSpiralTree(col)];
  },
  pine: () => {
    const h = between(7.6, 9.6), w = h * 0.56;
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
    const w = between(3.2, 4.6);
    return [P2.roughen(mound(w, w * 0.54, 4, 0.1), rnd), paintRockCard()];
  },
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

  note: () => P2.drawnPiece((g) => {
    g.fillStyle = '#f6cc38';
    D.ell(g, -0.25, 0.28, 0.28, 0.22);
    D.rect(g, -0.05, 0.28, 0.16, 1.05, 0.04);
    D.poly(g, [[0.05, 1.32], [0.58, 1.06], [0.52, 0.84], [0.05, 1.06]]);
    g.fillStyle = '#fff3b0';
    D.ell(g, -0.3, 0.34, 0.12, 0.09);
  }, { w: 1.3, h: 1.5, name: 'note' }),

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
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.14, 1.24, 0.14, 0.14);
    D.ell(g, 0.14, 1.24, 0.14, 0.14);
    g.fillStyle = '#332216';
    D.ell(g, -0.14, 1.24, 0.05, 0.05);
    D.ell(g, 0.14, 1.24, 0.05, 0.05);
    g.fillStyle = '#c83c2e';
    D.rect(g, -0.28, 0.72, 0.56, 0.24, 0.06);
    g.fillStyle = '#e88a96';
    D.ell(g, 0, 1.1, 0.09, 0.07);
  }, { w: 2.5, h: 1.8, name: 'molehill' }),

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

  sign: () => [
    P2.fromDrawing((g) => { D.rect(g, -0.12, 0, 0.24, 2.5); D.poly(g, [[-0.95, 1.75], [0.75, 1.75], [1.05, 2.05], [0.75, 2.35], [-0.95, 2.35]]); }, { w: 2.2, h: 2.6, name: 'sign' }),
    paintWoodCard('#b67d48', 3),
  ],
  fence: () => [
    P2.fromDrawing((g) => {
      D.rect(g, -2.3, 0.55, 4.6, 0.22);
      D.rect(g, -2.3, 1.25, 4.6, 0.22);
      for (let i = -2; i <= 2; i++) D.rect(g, i * 1.0 - 0.18, 0, 0.36, 1.8, 0.06);
    }, { w: 4.8, h: 1.9, name: 'fence' }),
    paintWoodCard('#a87240', 3),
  ],
  hill: (idx = 0) => {
    const w = 18 + idx * 3, h = 9 + idx * 1.6;
    const pts = P2.roughen(mound(w, h, 3, 0.06), rnd);
    const col = idx % 2 === 0 ? C.hillA : C.hillB;
    return [pts, (P) => { P.gradient(P2.shade(col, 0.16), P2.shade(col, -0.14), 0.5); P.felt(0.7); P.innerShade(C.ink, { alpha: 0.2, blurPx: 10 }); }];
  },
};

// Pre-printed shared foliage/prop variants (cuts build time ~3x while preserving organic variety)
function makeVariants(fn, n, { cross = false, res = 0.85 } = {}) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const [pts, paint] = fn();
    list.push({ pts, materials: H.printed(pts, paint, { cross, res }) });
  }
  return list;
}

// ---- 4. Hero: Banjo & Kazooie 3D Paper Model (layered cleanly — 0 card clips standing or striding) ----
function banjoHero() {
  const root = new THREE.Group();
  root.name = 'banjo-kazooie';
  const paper = H.paper;
  const T = 0.06;
  const card = (name, draw, w, h, seed) => {
    const [pts, paint] = P2.drawnPiece(draw, { w, h, name });
    const m = makeCard(pts, { paint, paper, seed, pxPerUnit: 84, thickness: T, edgeWidth: 0.04, back: 'same' });
    m.name = name;
    return m;
  };

  // Torso front card at z = 0 (z: [-0.03, +0.03], y: [0.60, 1.92], x: [-0.56, +0.56])
  const torso = card('torso', (g) => {
    g.fillStyle = C.fur;
    D.ell(g, 0, 0.72, 0.54, 0.58);
    g.fillStyle = '#d9985a';
    D.ell(g, 0, 0.74, 0.32, 0.34);
    // Yellow shorts with black belt & buckle
    g.fillStyle = C.shorts;
    D.rect(g, -0.52, 0.06, 1.04, 0.46, 0.12);
    g.fillStyle = C.ink;
    D.rect(g, -0.52, 0.45, 1.04, 0.1);
    g.fillStyle = '#f2d468';
    D.rect(g, -0.13, 0.43, 0.26, 0.14, 0.03);
    // Shark-tooth necklace
    g.fillStyle = '#faf3e0';
    D.poly(g, [[-0.08, 1.15], [0.08, 1.15], [0, 0.94]]);
  }, 1.25, 1.4, 11);
  torso.position.set(0, 0.56, 0);
  root.add(torso);

  // Torso profile card (T depth) wholly behind torso front (-0.03) and in front of backpack (-0.31)
  const torsoSide = card('torso-side', (g) => {
    g.fillStyle = C.furDark;
    D.rect(g, -0.09, 0.42, 0.18, 0.78, 0.05);
    g.fillStyle = P2.shade(C.shorts, -0.14);
    D.rect(g, -0.09, 0.06, 0.18, 0.42, 0.04);
  }, 0.3, 1.3, 19);
  torsoSide.rotation.y = Math.PI / 2;
  torsoSide.position.set(0, 0.58, -0.17);
  root.add(torsoSide);

  // Banjo Head at z = +0.11 (z: [+0.08, +0.14], cleanly in front of torso)
  const head = card('head', (g) => {
    g.fillStyle = C.fur;
    D.ell(g, -0.4, 0.9, 0.19, 0.19);
    D.ell(g, 0.4, 0.9, 0.19, 0.19);
    D.ell(g, 0, 0.56, 0.52, 0.46);
    g.fillStyle = C.snout;
    D.ell(g, -0.4, 0.9, 0.09, 0.09);
    D.ell(g, 0.4, 0.9, 0.09, 0.09);
    D.ell(g, 0, 0.42, 0.36, 0.26);
    g.fillStyle = '#faf3e0';
    D.ell(g, -0.16, 0.7, 0.11, 0.14);
    D.ell(g, 0.16, 0.7, 0.11, 0.14);
    g.fillStyle = C.ink;
    D.ell(g, -0.14, 0.7, 0.05, 0.065);
    D.ell(g, 0.14, 0.7, 0.05, 0.065);
    g.fillStyle = '#2b1b10';
    D.ell(g, 0, 0.52, 0.15, 0.1);
  }, 1.25, 1.2, 12);
  head.position.set(0, 1.72, 0.11);
  root.add(head);

  // Blue Backpack at z = -0.34 (z: [-0.37, -0.31], behind torsoSide)
  const pack = card('backpack', (g) => {
    g.fillStyle = C.pack;
    D.rect(g, -0.48, 0.06, 0.96, 1.0, 0.2);
    g.fillStyle = P2.shade(C.pack, 0.2);
    D.rect(g, -0.4, 0.65, 0.8, 0.3, 0.1);
    g.fillStyle = C.shorts;
    D.rect(g, -0.11, 0.55, 0.22, 0.16, 0.04);
  }, 1.15, 1.15, 13);
  pack.position.set(0, 0.78, -0.34);
  root.add(pack);

  // Kazooie peeking out behind backpack at z = -0.46 (z: [-0.49, -0.43])
  const kazPivot = new THREE.Group();
  kazPivot.position.set(0, 1.74, -0.46);
  const kaz = card('kazooie', (g) => {
    g.fillStyle = C.kazRed;
    D.rect(g, -0.15, 0, 0.3, 0.52, 0.09);
    D.ell(g, 0.02, 0.62, 0.28, 0.25);
    D.poly(g, [[-0.1, 0.82], [-0.34, 1.14], [0.04, 0.9]]);
    D.poly(g, [[0.02, 0.84], [-0.1, 1.2], [0.16, 0.88]]);
    g.fillStyle = C.kazBeak;
    D.poly(g, [[0.18, 0.7], [0.64, 0.58], [0.18, 0.48]]);
    g.fillStyle = '#faf3e0';
    D.ell(g, 0.1, 0.68, 0.095, 0.105);
    g.fillStyle = C.ink;
    D.ell(g, 0.12, 0.68, 0.045, 0.05);
  }, 1.2, 1.28, 14);
  kaz.position.set(0.06, 0, 0);
  kazPivot.add(kaz);
  root.add(kazPivot);

  // Arms positioned outside torso/backpack/head width (|x| >= 0.62) so swinging never clips
  const makeLimb = (name, col, w, h, seed) => card(name, (g) => {
    g.fillStyle = col;
    D.rect(g, -w * 0.34, 0.06, w * 0.68, h * 0.84, w * 0.24);
  }, w, h, seed);

  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-0.67, 1.46, 0);
  armR.position.set(0.67, 1.46, 0);
  const armLM = makeLimb('arm-l', C.fur, 0.34, 0.68, 15); armLM.position.y = -0.60; armL.add(armLM);
  const armRM = makeLimb('arm-r', C.fur, 0.34, 0.68, 16); armRM.position.y = -0.60; armR.add(armRM);
  root.add(armL, armR);

  // Legs below torso shorts (top at y = 0.54, torso bottom at y = 0.62) and at z = -0.02 so stride stays clear
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.26, 0.54, -0.02);
  legR.position.set(0.26, 0.54, -0.02);
  const legLM = makeLimb('leg-l', C.fur, 0.38, 0.58, 17); legLM.position.y = -0.54; legL.add(legLM);
  const legRM = makeLimb('leg-r', C.fur, 0.38, 0.58, 18); legRM.position.y = -0.54; legR.add(legRM);
  root.add(legL, legR);

  root.userData.stride = (walked, gait) => {
    const s = Math.sin(walked * 2.1) * gait;
    legL.rotation.x = s * 0.48;
    legR.rotation.x = -s * 0.48;
    armL.rotation.x = -s * 0.42;
    armR.rotation.x = s * 0.42;
    kazPivot.position.y = 1.74 + Math.abs(Math.sin(walked * 4.2)) * 0.08 * gait;
    kazPivot.rotation.z = Math.sin(walked * 2.1) * 0.1 * gait;
  };
  return root;
}

// ---- 5. Spiral Mountain Landmarks (Banjo's Cottage, Arched Wooden Bridge, Mumbo's Skull, Gruntilda's Lair) ----
function banjoCottage(x, z) {
  const paints = {
    front: (P) => {
      const { box } = P;
      P.gradient(P2.shade(C.wall, 0.08), P2.shade(C.wall, -0.14), 0.5);
      P.felt(0.75);
      // Stone foundation plinth + dark timber beams
      P.layer((mg) => {
        mg.fillRect(box.x0, box.y0, box.w, box.h * 0.13);
      }, C.stone, { shadow: 0.9, lip: 0.8, depth: 0.7 });
      P.layer((mg) => {
        mg.fillRect(box.x0, box.y0 + box.h * 0.88, box.w, box.h * 0.12);
        mg.fillRect(box.x0 + box.w * 0.03, box.y0, box.w * 0.08, box.h);
        mg.fillRect(box.x1 - box.w * 0.11, box.y0, box.w * 0.08, box.h);
        mg.fillRect(box.x0, box.y0 + box.h * 0.48, box.w, box.h * 0.07);
      }, C.trunk, { shadow: 1.0, lip: 0.8, depth: 0.7 });
      // Arched wooden cottage door
      P.layer((mg) => {
        const dx = box.x0 + box.w * 0.21, dw = box.w * 0.24, dh = box.h * 0.62;
        mg.beginPath();
        mg.moveTo(dx, box.y0);
        mg.lineTo(dx, box.y0 + dh * 0.7);
        mg.arc(dx + dw / 2, box.y0 + dh * 0.7, dw / 2, Math.PI, 0, true);
        mg.lineTo(dx + dw, box.y0);
        mg.closePath();
        mg.fill();
      }, '#7a4522', { shadow: 1.1, lip: 0.9, depth: 0.8 });
      // Warm framed cottage window
      const wx = box.x0 + box.w * 0.58, wy = box.y0 + box.h * 0.34, ww = box.w * 0.24, wh = box.h * 0.32;
      P.layer((mg) => {
        mg.fillRect(wx - ww * 0.1, wy - wh * 0.1, ww * 1.2, wh * 1.2);
      }, C.trunk, { shadow: 1.0, lip: 0.8, depth: 0.7 });
      P.layer((mg) => {
        mg.fillRect(wx, wy, ww, wh);
      }, C.window, { shadow: 0.6, lip: 0.9, depth: 0.6 });
      P.draw((dg) => {
        dg.strokeStyle = C.trunk;
        dg.lineWidth = Math.max(0.06, box.w * 0.02);
        dg.beginPath();
        dg.moveTo(wx + ww / 2, wy); dg.lineTo(wx + ww / 2, wy + wh);
        dg.moveTo(wx, wy + wh / 2); dg.lineTo(wx + ww, wy + wh / 2);
        dg.stroke();
      });
      P.glow((gg) => { gg.fillStyle = '#fff'; gg.fillRect(wx, wy, ww, wh); });
      P.innerShade(C.ink, { alpha: 0.24, blurPx: 7 });
    },
    gable: (P) => {
      const { box } = P;
      P.gradient(P2.shade(C.wall, 0.06), P2.shade(C.wall, -0.14), 0.5);
      P.felt(0.75);
      P.layer((mg) => {
        mg.fillRect(box.x0, box.y0, box.w, box.h * 0.09);
        mg.fillRect(box.x0, box.y0 + box.h * 0.53, box.w, box.h * 0.05);
      }, C.trunk, { shadow: 0.9, lip: 0.7, depth: 0.65 });
      const cx = (box.x0 + box.x1) * 0.5, cy = box.y0 + box.h * 0.34, rr = box.w * 0.14;
      P.layer((mg) => { mg.beginPath(); mg.arc(cx, cy, rr * 1.22, 0, 7); mg.fill(); }, C.trunk, { shadow: 0.9, lip: 0.7, depth: 0.65 });
      P.layer((mg) => { mg.beginPath(); mg.arc(cx, cy, rr, 0, 7); mg.fill(); }, C.window, { shadow: 0.5, lip: 0.8, depth: 0.5 });
      P.glow((gg) => { gg.fillStyle = '#fff'; gg.beginPath(); gg.arc(cx, cy, rr, 0, 7); gg.fill(); });
      P.innerShade(C.ink, { alpha: 0.24, blurPx: 7 });
    },
    roof: (P) => {
      const { box } = P;
      P.gradient(P2.shade(C.roof, 0.14), P2.shade(C.roof, -0.18), 0.5);
      P.felt(0.75);
      P2.scallopTiles(P, box, { color: P2.shade(C.roof, -0.26), rows: 6 });
      P.innerShade(C.ink, { alpha: 0.25, blurPx: 8 });
    },
  };
  const g = boxFold({ w: 5.4, d: 4.2, wallH: 3.4, roofH: 2.7, paper: H.paper, seed: 71, paints, print: H.cardOpts(x, z) });
  // Brick chimney card riding the ridge
  const ch = makeCard(P2.shape.rect(0.75, 1.75), {
    paper: H.paper, thickness: 0.08, edgeWidth: 0.06, back: 'kraft', seed: 79, folds: ['bottom'],
    ...H.cardOpts(x, z),
    paint: (P) => {
      P.gradient('#b45c3c', '#883f26', 0.5);
      P.marks('brick', { color: '#4a2214', alpha: 0.45, size: 0.14 });
      P.draw((gg) => { gg.fillStyle = '#5c3020'; gg.fillRect(P.box.x0 - 0.1, P.box.y1 - P.box.h * 0.14, P.box.w + 0.2, P.box.h * 0.15); });
    },
  });
  ch.position.set(1.3, -0.45, 0);
  g.userData.ridge.add(ch);
  g.userData.chimneyTop = { object: ch, offset: [0, 1.8, 0] };
  g.name = 'banjo-cottage';
  return g;
}

// Walkable arched wooden papercraft bridge: centered at (0, 0), span along local z [-hs, +hs], width along x [-hw, +hw].
// Folds flat over the water (ramps flat, arched side parapets flat outward) and rises cleanly with self: true.
function spiralBridge(x, z, { span = 10.6, width = 3.8, rampAngle = 22, crownAngle = 6, rampShare = 0.55, railH = 1.0, lean = 16, arch = 0.58 } = {}) {
  const g = new THREE.Group();
  g.name = 'spiral-bridge';
  const hs = span / 2, hw = width / 2, D2R = Math.PI / 180, T = 0.08;
  const A1 = rampAngle * D2R, A2 = crownAngle * D2R;
  const L1 = (rampShare * hs) / Math.cos(A1);
  const z1 = hs - L1 * Math.cos(A1);
  const h1 = L1 * Math.sin(A1);
  const L2 = z1 / Math.cos(A2) + T;
  const deckH = (u) => {
    u = Math.abs(u);
    return u >= hs ? 0 : u >= z1 ? (hs - u) * Math.tan(A1) : h1 + (z1 - u) * Math.tan(A2);
  };
  const base = { ...H.cardOpts(x, z), paper: H.paper, thickness: T, edgeWidth: 0.06 };
  const smooth01 = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  // Two symmetric deck ramps meeting at a gentle crown over the moat
  const ramps = [];
  for (const s of [1, -1]) {
    const F = new THREE.Group();
    F.position.set(0, 0.015, s * hs);
    F.rotation.y = s > 0 ? 0 : Math.PI;
    const rp = new THREE.Group();
    F.add(rp);
    rp.add(makeCard(P2.shape.rect(width, L1), { ...base, seed: 91 + (s > 0 ? 1 : 2), paint: paintWoodCard('#b97e48', 5), folds: ['bottom', 'top'], back: 'kraft' }));
    const cp = new THREE.Group();
    cp.position.set(0, L1, T * 0.6);
    rp.add(cp);
    cp.add(makeCard(P2.shape.rect(width, L2), { ...base, seed: 91 + (s > 0 ? 3 : 4), paint: paintWoodCard('#b97e48', 4), folds: ['bottom'], back: 'kraft' }));
    g.add(F);
    ramps.push({ rp, cp });
  }

  // Arched timber side rails leaning outward so both faces read from above
  const ext = hs * 1.04;
  const aw = hs * arch, ah = Math.max(0.15, deckH(0) * 0.72);
  const sidePts = [[-ext, 0], [-aw, 0]];
  for (let i = 1; i < 16; i++) {
    const a = Math.PI - (Math.PI * i) / 16;
    sidePts.push([Math.cos(a) * aw, Math.sin(a) * ah]);
  }
  sidePts.push([aw, 0], [ext, 0]);
  for (let i = 0; i <= 24; i++) {
    const ux = ext - (2 * ext * i) / 24;
    sidePts.push([ux, deckH(ux) + railH * (Math.abs(ux) > hs ? 0.85 : 1)]);
  }
  const sidePaint = (P) => {
    const { box } = P;
    P.gradient(P2.shade(C.wood, 0.12), P2.shade(C.trunk, -0.12), 0.5);
    P.felt(0.7);
    P.layer((mg) => {
      mg.beginPath();
      for (let i = 0; i <= 24; i++) {
        const ux = box.x0 + (box.w * i) / 24;
        (i ? mg.lineTo : mg.moveTo).call(mg, ux, deckH(ux) + 0.08);
      }
      mg.lineTo(box.x1 + 0.5, box.y1 + 0.5);
      mg.lineTo(box.x0 - 0.5, box.y1 + 0.5);
      mg.closePath();
      mg.fill();
    }, '#c28850', { rim: 0.8, lip: 0.8, depth: 0.7 });
    P.innerShade(C.ink, { alpha: 0.25, blurPx: 6 });
  };
  const sideCards = [];
  for (const sg of [1, -1]) {
    const F = new THREE.Group();
    F.position.set(sg * (hw + 0.1), 0, 0);
    F.rotation.y = sg > 0 ? -Math.PI / 2 : Math.PI / 2;
    const pv = new THREE.Group();
    F.add(pv);
    pv.add(makeCard(sidePts, { ...base, seed: sg > 0 ? 102 : 107, paint: sidePaint, back: 'mirror', folds: ['bottom'] }));
    for (const ex of [-ext, ext]) {
      const post = makeCard(P2.shape.rect(0.48, railH * 1.25), { ...base, seed: 112, paint: paintWoodCard(C.trunk, 2, true), folds: ['bottom'] });
      const pg = new THREE.Group();
      pg.position.set(ex, 0, -0.24);
      pg.rotation.y = ex > 0 ? Math.PI / 2 : -Math.PI / 2;
      pg.add(post);
      pv.add(pg);
    }
    g.add(F);
    sideCards.push(pv);
  }

  g.userData.follow = (p) => {
    const kr = smooth01(0, 0.6, p), ks = smooth01(0.35, 1, p);
    for (const { rp, cp } of ramps) { rp.rotation.x = -Math.PI / 2 + A1 * kr; cp.rotation.x = -(A1 - A2) * kr; }
    for (const pv of sideCards) pv.rotation.x = -Math.PI / 2 + 0.01 + (Math.PI / 2 - 0.01 - lean * D2R) * ks;
  };
  g.userData.follow(1);
  // Walk surface spans cleanly past both banks (+0.25 margin) and inside the side rails
  g.userData.walk = {
    heightAt: (lx, lz) => (Math.abs(lx) <= hw - 0.12 && Math.abs(lz) <= hs + 0.25 ? deckH(lz) + T : null),
    halfSpan: hs,
    halfWidth: hw,
    deckH,
  };
  return g;
}

function mumboSkullHut(x, z) {
  const g = new THREE.Group();
  g.name = 'mumbo-skull';
  const [pts, paintBase] = P2.drawnPiece((ctx) => {
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
    D.ell(ctx, 0.82, 2.85, 0.28, 0.26);
    // Skull nose & doorway mouth
    ctx.fillStyle = '#332216';
    D.poly(ctx, [[0, 2.35], [-0.28, 1.85], [0.28, 1.85]]);
    D.rect(ctx, -0.95, 0, 1.9, 1.25, 0.2);
    ctx.fillStyle = C.bone;
    for (let i = -2; i <= 2; i++) D.rect(ctx, i * 0.36 - 0.12, 1.02, 0.24, 0.3, 0.04);
  }, { w: 5.2, h: 6.0, name: 'mumbo-skull' });

  const paint = (P) => {
    paintBase(P);
    P.glow((gg) => {
      gg.fillStyle = '#fff';
      D.ell(gg, -0.82, 2.85, 0.28, 0.26);
      D.ell(gg, 0.82, 2.85, 0.28, 0.26);
    });
  };

  const front = makeCard(pts, { paint, paper: H.paper, seed: 82, ...H.cardOpts(x, z) });
  const back = makeCard(pts, { paint: paintBase, paper: H.paper, seed: 83, ...H.cardOpts(x, z) });
  front.position.z = 0.7;
  back.position.z = -0.7;
  back.scale.set(0.92, 0.94, 1);
  g.add(front, back);
  return g;
}

function gruntildaLairGate(x, z) {
  const g = new THREE.Group();
  g.name = 'gruntilda-lair';
  const [pts, paintBase] = P2.drawnPiece((ctx) => {
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
    ctx.fillStyle = '#24182a';
    D.poly(ctx, [[-1.4, 3.9], [-0.4, 3.65], [-1.2, 3.3]]);
    D.poly(ctx, [[1.4, 3.9], [0.4, 3.65], [1.2, 3.3]]);
    ctx.fillStyle = '#d4f24a';
    D.ell(ctx, -0.95, 3.6, 0.22, 0.16);
    D.ell(ctx, 0.95, 3.6, 0.22, 0.16);
    ctx.fillStyle = P2.shade(C.witchSkin, 0.18);
    D.poly(ctx, [[0, 3.5], [-0.45, 2.6], [0.35, 2.75]]);
    // Glowing lime lair archway mouth
    ctx.fillStyle = '#2b1a36';
    D.rect(ctx, -1.35, 0, 2.7, 2.1, 0.35);
    ctx.fillStyle = C.witchLime;
    D.rect(ctx, -1.0, 0, 2.0, 1.75, 0.28);
  }, { w: 9.0, h: 8.8, name: 'gruntilda-lair' });

  const paint = (P) => {
    paintBase(P);
    P.glow((gg) => {
      gg.fillStyle = '#fff';
      D.ell(gg, -0.95, 3.6, 0.22, 0.16);
      D.ell(gg, 0.95, 3.6, 0.22, 0.16);
      D.rect(gg, -1.0, 0, 2.0, 1.75, 0.28);
    });
  };

  const arch = makeCard(pts, { paint, paper: H.paper, seed: 95, ...H.cardOpts(x, z) });
  const backRock = makeCard(pts, { paint: paintRockCard('#58545c'), paper: H.paper, seed: 96, ...H.cardOpts(x, z) });
  backRock.position.set(0.3, -0.2, -1.1);
  backRock.scale.set(1.06, 0.92, 1);
  g.add(arch, backRock);
  return g;
}

// ---- 6. Story Chapters (all 5 landmarks sit cleanly in order along the walkable spiral trail!) ----
const STORY_CHAPTERS = [
  {
    id: 0,
    num: 'Chapter I',
    title: "Morning at Banjo's Cottage",
    speaker: 'Kazooie (from the Backpack)',
    body: '"Wake up, fuzzball! While you were snoring away, that old witch Gruntilda swooped down on her broomstick and snatched your little sister Tooty! Put on your yellow shorts and let\'s move!"',
    hint: "Walk north along the sandy spiral trail to Bottles' Garden.",
    pos: [pathX(4.5), 4.5],
    radius: 4.8,
  },
  {
    id: 1,
    num: 'Chapter II',
    title: "Bottles' Molehill & The Garden",
    speaker: 'Bottles the Mole',
    body: '"Guh-huh, Banjo! I saw Gruntilda flying across the moat toward her mountain lair! She\'s jealous of Tooty\'s beauty. Watch out for Topper the Carrot and Bawl the Onion — follow the path to the wooden bridge!"',
    hint: 'Cross the arched wooden bridge over the cerulean moat.',
    pos: [pathX(-2.5), -2.5],
    radius: 5.0,
  },
  {
    id: 2,
    num: 'Chapter III',
    title: 'The Spiral Moat Crossing',
    speaker: 'Banjo & Kazooie',
    body: '"Guh-huh! Look at those shiny golden Jiggies and a little blue Jinjo waving by the bridge!" Kazooie squawks: "Grab \'em all! We\'ll need every Jiggy and Note to unlock Gruntilda\'s lair!"',
    hint: "Continue across the bridge toward Mumbo's Skull Glade.",
    pos: [0, 0], // filled dynamically at the bridge crossing
    radius: 5.2,
  },
  {
    id: 3,
    num: 'Chapter IV',
    title: "Mumbo's Skull Glade",
    speaker: 'Mumbo Jumbo',
    body: '"Eekum Bokum! Mumbo best shaman in whole Spiral Mountain! Bring Mumbo shiny tokens and Mumbo turn bear into termite, crocodile, or pumpkin — much better than smelly bear!"',
    hint: "Head up the northern trail to Gruntilda's Lair Gate.",
    pos: [pathX(-19.5), -19.5],
    radius: 5.2,
  },
  {
    id: 4,
    num: 'Chapter V',
    title: "Gruntilda's Lair Gate",
    speaker: 'Gruntilda Winkybunion',
    body: '"Welcome, bear, and feathered pest! To save your sister, pass my test! My worlds await behind this door — you\'ll wish you\'d stayed on Banjo\'s floor!" — All 5 Spiral Mountain chapters discovered!',
    hint: 'You have unfolded the full Spiral Mountain story! Keep exploring.',
    pos: [pathX(-25.0), -25.0],
    radius: 5.8,
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
  pathDist(x, z) > 1.85 + r &&
  taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + r);

function addSpinner(kind, x, z, yBase = 0.4, scale = 1.05, chapterId = -1) {
  const h = popup(...K[kind](), { x, z, scale });
  SPINNERS.push({ group: h.group, yBase, phase: rnd() * 6.28, x, z, kind, chapterId, collected: false });
  return h;
}

function buildWorld() {
  // Pre-build shared foliage/prop prints for fast loading & crisp layered art
  const V = {
    tree: makeVariants(K.tree, 5, { cross: true, res: 0.8 }),
    pine: makeVariants(K.pine, 4, { cross: true, res: 0.8 }),
    bush: makeVariants(K.bush, 5, { res: 0.85 }),
    tuft: makeVariants(K.tuft, 4, { res: 0.8 }),
    rock: makeVariants(K.rock, 4, { res: 0.85 }),
    honeycomb: makeVariants(K.honeycomb, 1, { res: 0.9 }),
  };
  const pickV = (name) => { const list = V[name]; return list[Math.floor(rnd() * list.length)]; };
  const stamp = (name, o) => { const v = pickV(name); return popup(v.pts, null, { materials: v.materials, ...o }); };

  const group = (x, z, kinds, spread = 1.0) => {
    const pts = clusterLayout(x, z, { n: kinds.length, size: 1.5, seed: Math.round(x * 31 + z * 17) + 99, spread });
    kinds.forEach((k, i) => {
      const p = pts[i];
      if (moatDist(p.x, p.z) < 3.0 || pathDist(p.x, p.z) < 1.8) return;
      stamp(k, { x: p.x, z: p.z, yaw: (rnd() - 0.5) * 0.65, scale: 0.78 + rnd() * 0.34, sway: k === 'bush' || k === 'tuft' ? 0.55 : 0 });
    });
  };

  // Find where the spiral path crosses the moat stream
  let bz = -13.9;
  for (let z = -30; z < 8; z += 0.05) {
    if (Math.sign(pathX(z) - moatX(z)) !== Math.sign(pathX(z + 0.05) - moatX(z + 0.05))) {
      bz = z + 0.025;
      break;
    }
  }
  const bx = moatX(bz);
  STORY_CHAPTERS[2].pos = [bx, bz];
  H.spots.cottage = STORY_CHAPTERS[0].pos;
  H.spots.garden = STORY_CHAPTERS[1].pos;
  H.spots.bridge = STORY_CHAPTERS[2].pos;
  H.spots.mumbo = STORY_CHAPTERS[3].pos;
  H.spots.lair = STORY_CHAPTERS[4].pos;

  // Chapter I Landmark: Banjo's Cottage (lower-right, angled toward start & camera)
  {
    const cx = pathX(4.5) + 5.8, cz = 3.8;
    const cottage = banjoCottage(cx, cz);
    const h = popup(null, null, { node: cottage, height: 6.2, x: cx, z: cz, yaw: -0.45, solid: 3.1 });
    H.glowing(h.group);
    H.lamp(cx - 2.2, 2.2, cz + 2.2, 0.9, 10);
    mark(cx, cz, 4.6);
    LIFE.chimneys.push(cottage.userData.chimneyTop);
    popup(...K.fence(), { x: cx - 3.6, z: cz + 2.7, yaw: -0.35 });
    addSpinner('jiggy', pathX(4.5) + 1.9, 3.9, 0.35, 1.0, 0);
    addSpinner('note', pathX(1.5) + 0.8, 1.5, 0.45, 0.9);
  }

  // Chapter II Landmark: Bottles' Molehill & Vegetable Garden
  {
    const mx = pathX(-2.5) + 3.0, mz = -2.5;
    popup(...K.molehill(), { x: mx, z: mz, yaw: -0.25, scale: 1.15, solid: 0.85 });
    mark(mx, mz, 2.2);
    addSpinner('jiggy', mx - 1.1, mz - 1.5, 0.4, 1.0, 1);
    // Grumpy Veggies in the tilled garden
    popup(...K.carrot(), { x: GARDEN.x - 1.5, z: GARDEN.z - 0.8, yaw: 0.2, scale: 1.1 });
    popup(...K.onion(), { x: GARDEN.x + 1.1, z: GARDEN.z + 0.6, yaw: -0.25, scale: 1.15 });
    popup(...K.carrot(), { x: GARDEN.x + 2.1, z: GARDEN.z - 1.1, yaw: -0.15, scale: 0.95 });
    popup(...K.honeycomb(), { x: GARDEN.x - 0.2, z: GARDEN.z + 1.3, scale: 1.1 });
    mark(GARDEN.x, GARDEN.z, 4.6);
  }

  // Chapter III Landmark: Centered Walkable Arched Wooden Bridge over the Moat
  {
    const dxp = pathX(bz + 0.5) - pathX(bz - 0.5);
    const yawB = Math.atan2(dxp, 1);
    const bridgeNode = spiralBridge(bx, bz, { span: 10.6, width: 3.8 });
    popup(null, null, { node: bridgeNode, height: 2.6, x: bx, z: bz, yaw: yawB, self: true });
    walk.add(bridgeNode);
    mark(bx, bz, 6.2);
    // Signpost, Blue Jinjo & Golden Jiggy crowning the bridge
    popup(...K.sign(), { x: bx + 5.1, z: bz + 3.6, yaw: -0.45, scale: 1.05 });
    popup(...K.jinjo('#3e84d6'), { x: bx - 4.6, z: bz - 3.6, yaw: 0.3, scale: 1.15, sway: 0.5 });
    addSpinner('jiggy', bx, bz, bridgeNode.userData.walk.deckH(0) + 0.48, 1.05, 2);
    addSpinner('note', pathX(bz + 5.8), bz + 5.8, 0.45, 0.9);
  }

  // Moat blocks walking everywhere EXCEPT where the bridge deck rides over it
  walk.block((x, z) => moatDist(x, z) < 2.65);
  for (const [z, dx, col] of [[-5, -0.4, '#46b864'], [-20, 0.4, '#e86ca0']]) {
    LIFE.floaters.push([popup(...K.jinjo(col), { x: moatX(z) + dx, z, yaw: 0.3, scale: 0.9 }), 0.35]);
  }
  for (const [z, sd] of [[-26, 1], [-19, 1], [-9, -1], [-3, 1], [3, -1]]) {
    const x = moatX(z) + sd * 4.0;
    if (pathDist(x, z) > 2.2) {
      popup(...K.reeds(), { x, z, yaw: (rnd() - 0.5) * 0.6, sway: 0.7 });
      mark(x, z, 1.5);
    }
  }

  // Chapter IV Landmark: Mumbo's Skull Glade (far/west bank of the moat, along the spiral trail)
  {
    const [mx, mz] = STORY_CHAPTERS[3].pos;
    const sx = mx - 4.6, sz = mz - 0.8;
    const skull = mumboSkullHut(sx, sz);
    const h = popup(null, null, { node: skull, height: 6.2, x: sx, z: sz, yaw: 0.48, solid: 2.5 });
    H.glowing(h.group);
    H.lamp(sx + 1.5, 2.4, sz + 1.5, 0.85, 11);
    mark(sx, sz, 4.4);
    addSpinner('jiggy', mx - 1.2, mz + 0.2, 0.4, 1.05, 3);
    popup(...K.jinjo('#f2c438'), { x: sx + 2.8, z: sz - 2.2, yaw: -0.25, scale: 1.1, sway: 0.4 });
  }

  // Chapter V Landmark: Gruntilda's Lair Gate (northern crag at the end of the spiral trail)
  {
    const [gx, gz] = STORY_CHAPTERS[4].pos;
    const lx = gx - 0.6, lz = gz - 4.2;
    const lair = gruntildaLairGate(lx, lz);
    const h = popup(null, null, { node: lair, height: 8.8, x: lx, z: lz, yaw: 0.14, solid: 3.4 });
    H.glowing(h.group);
    H.lamp(lx, 2.6, lz + 2.0, 1.0, 12);
    mark(lx, lz, 5.4);
    addSpinner('jiggy', gx, gz + 0.4, 0.45, 1.2, 4);
    addSpinner('note', gx - 2.2, gz + 0.9, 0.45, 0.95);
    addSpinner('note', gx + 2.2, gz + 0.9, 0.45, 0.95);
  }

  // Layered Spiral Mountain backdrop hills along the far northern ridge
  for (const [hx, hz] of [[-28, -38], [20, -37], [-2, -41]]) {
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

  // ---- 8. Dense Spiral Mountain Fill (trees, pines, bushes, rocks, tufts, honeycombs) ----
  rnd = P2.rng(505);
  const cellSeed = (gx, gz, salt) => (Math.imul(Math.round(gx * 10), 73856093) ^ Math.imul(Math.round(gz * 10), 19349663) ^ Math.imul(salt, 83492791)) >>> 0;
  const lush = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.12 + 0.5) * Math.sin(z * 0.14 + 1.2) + 0.15 * Math.sin(x * 0.2 + z * 0.16);
  const trees = [], placed = [];
  const DRESS = ['bush', 'bush', 'rock', 'tuft', 'tuft', 'honeycomb'];
  const corridor = (x, z) => z > HERO_AT[1] - 1 && z < HERO_AT[1] + 15 && Math.abs(x - HERO_AT[0]) < 6.5 + (z - HERO_AT[1]) * 0.3;

  const fillGroups = (see) => {
    for (let gz = -44; gz <= 16; gz += 3.3) {
      for (let gx = -44; gx <= 44; gx += 3.3) {
        rnd = P2.rng(cellSeed(gx, gz, 19));
        const x = gx + (rnd() - 0.5) * 2.5, z = gz + (rnd() - 0.5) * 2.5, l = lush(x, z);
        if (!see(x, z, 0.12, 4) || l < 0.28 || placed.some(([px, pz]) => Math.hypot(x - px, z - pz) < 3.1)) continue;
        placed.push([x, z]);
        if (l > 0.54 && free(x, z, 1.6) && !corridor(x, z) && trees.every(([tx, tz]) => Math.hypot(x - tx, z - tz) > 5.0)) {
          trees.push([x, z]);
          if (rnd() < 0.34) stamp('pine', { x, z, cross: true, sway: 0.45 });
          else stamp('tree', { x, z, cross: true, sway: 0.7 });
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
    if (kind === 'bush') stamp('bush', { x: p.x, z: p.z + dz, scale: s, sway: 0.4 });
    else stamp('tree', { x: p.x, z: p.z + dz, cross: true, scale: s, sway: 0.55 });
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

// ---- 9. Living World (cottage chimney smoke, highland leaves, butterflies, bobbing Jinjos) ----
const life = createLife({ scene: H.scene, camera: H.camera, heroHeight: 3.6, seed: 88 });
life.puffs({ at: LIFE.chimneys, colors: ['#faf3e4'] });
life.fallers({ cut: 'leaf', count: 16, colors: ['#f4c430', '#7db458', '#faf3e0'] });
life.flyers({ count: 8, colors: ['#f4c430', '#4da8b8', '#e86a52'] });

// ---- 10. Interactive Story HUD, Proximity Discovery & Auto-Walk on Chapter Click ----
const foundChapters = new Set();
let activeChapterId = -1;
let dismissedId = -1;
let autoRoute = null; // array of [x, z] trail waypoints when clicking a chapter button

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

function cancelAutoWalk() {
  if (autoRoute) {
    autoRoute = null;
    window.__papercraft?.steer(null);
  }
}

// Any manual movement key immediately cancels auto-walk
addEventListener('keydown', (e) => {
  if (/^(Key[WASD]|Arrow(Up|Down|Left|Right))$/.test(e.code)) cancelAutoWalk();
});

// Build a smooth waypoint list along the spiral trail from Banjo's current z to target chapter z
function startWalkToChapter(targetId) {
  const ch = STORY_CHAPTERS[targetId];
  if (!ch || !H.hero) return;
  const hz = H.hero.group.position.z;
  const tz = ch.pos[1];
  const pts = [];
  const step = tz < hz ? -2.0 : 2.0;
  for (let z = hz + step; tz < hz ? z > tz + 1.0 : z < tz - 1.0; z += step) {
    pts.push([pathX(z), z]);
  }
  pts.push([ch.pos[0], ch.pos[1]]);
  autoRoute = { pts, targetId };
}

function renderChapterDots() {
  if (!elChapters) return;
  elChapters.innerHTML = '';
  STORY_CHAPTERS.forEach((ch, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chap-dot' + (foundChapters.has(ch.id) ? ' found' : '') + (activeChapterId === ch.id ? ' active' : '');
    btn.textContent = String(idx + 1);
    btn.title = `${ch.num}: ${ch.title} (click to walk here)`;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      startWalkToChapter(ch.id);
      if (foundChapters.has(ch.id)) openChapter(ch.id, true);
    });
    elChapters.appendChild(btn);
  });
  if (elJiggyCount) elJiggyCount.textContent = `Jiggies: ${foundChapters.size} / ${STORY_CHAPTERS.length}`;
  if (elStatus) {
    elStatus.textContent = foundChapters.size === STORY_CHAPTERS.length
      ? 'All 5 chapters unfolded!'
      : 'Walk the path or click 1–5';
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

// Animate spinners, floaters, life, auto-walk steering, and proximity story discovery
H.onStep((t, dt) => {
  life.update(dt, H.target);
  const hx = H.hero ? H.hero.group.position.x : 0;
  const hz = H.hero ? H.hero.group.position.z : 0;

  for (const s of SPINNERS) {
    if (s.collected) {
      if (s.group.scale.x > 0.02) {
        s.group.scale.multiplyScalar(Math.max(0.01, 1 - dt * 7));
        s.group.position.y += dt * 4.5;
        s.group.rotation.y += dt * 10;
      } else {
        s.group.visible = false;
      }
      continue;
    }
    s.group.rotation.y = t * 1.4 + s.phase;
    s.group.position.y = s.yBase + Math.sin(t * 2.4 + s.phase) * 0.14;
    if (H.hero && !flags.TEST && s.kind === 'jiggy' && Math.hypot(hx - s.x, hz - s.z) < 2.2) {
      s.collected = true;
      if (s.chapterId >= 0) openChapter(s.chapterId, false);
    }
  }
  for (const [f, amp] of LIFE.floaters) {
    f.group.position.y = Math.sin(t * 2.1 + f.group.position.z) * 0.08 * amp;
  }

  // Smooth auto-walk along the spiral trail when a chapter button is clicked
  if (autoRoute && H.hero && window.__papercraft) {
    const next = autoRoute.pts[0];
    const dx = next[0] - hx, dz = next[1] - hz;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.1) {
      autoRoute.pts.shift();
      if (!autoRoute.pts.length) {
        const arrivedId = autoRoute.targetId;
        cancelAutoWalk();
        openChapter(arrivedId, true);
      }
    } else {
      window.__papercraft.steer(dx, dz);
    }
  }

  // Check proximity to story landmarks (after the initial pop-up finishes rising)
  if (H.hero && !flags.TEST && t > 1.2) {
    let nearest = null;
    for (const ch of STORY_CHAPTERS) {
      if (Math.hypot(hx - ch.pos[0], hz - ch.pos[1]) < ch.radius) {
        nearest = ch;
        break;
      }
    }
    if (nearest && nearest.id !== activeChapterId && nearest.id !== dismissedId) {
      openChapter(nearest.id);
    } else if (!nearest && activeChapterId !== -1) {
      activeChapterId = -1;
      dismissedId = -1;
      renderChapterDots();
    }
  }
});

H.onRestart(() => {
  cancelAutoWalk();
  life.reset(H.target);
});

H.start();
