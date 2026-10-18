// Nyxaros, le Dragon des Abysses : boss des raids, modélisé et rendu en 3D (une seule fois, puis gardé en cache).
// Corps de serpent le long d'une courbe, écailles sombres, plaques de ventre bronze, crête de cristaux d'améthyste
// lumineux, tête aux mâchoires ouvertes (gueule incandescente), yeux brûlants, cornes, moustaches et griffes.
const { render } = require("./moteur");
const S = require("./scene");
const M3 = require("./math");

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
// courbe de Catmull-Rom passant par les points
function spline(pts, t) {
  const n = pts.length - 1, f = Math.min(n - 1e-9, Math.max(0, t * n)), i = Math.floor(f), u = f - i;
  const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
  return [0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u));
}

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const cm = S.colorMat;
  MAT = {
    scales: cm("#160a2c", { c2: "#4c1d95", pat: "scales", sc: 1.7, rough: 0.38, metal: 0.35 }),
    belly: cm("#5a3a12", { c2: "#c08a2e", pat: "scales", sc: 0.8, rough: 0.32, metal: 0.6 }),
    crystal: cm("#4c1d95", { emit: "#8b2cf5", ei: 1.05, metal: 0.4, rough: 0.1 }),
    crystalTip: cm("#a855f7", { emit: "#e9b8ff", ei: 1.8, rough: 0.08 }),
    eye: cm("#000000", { emit: "#ff1f4f", ei: 3.2 }),
    mouth: cm("#000000", { emit: "#d02cf0", ei: 2.4 }),
    bone: cm("#efe6d8", { rough: 0.35 }),
    horn: cm("#1b1030", { metal: 0.4, rough: 0.22 }),
    whisker: cm("#7c3aed", { emit: "#a855f7", ei: 0.7, rough: 0.3 }),
  };
  return MAT;
}

// tube effilé le long d'une courbe (corps, cornes, moustaches, pattes) ; belly : fonction (angle) -> matériau du ventre
function tube(m, pts, radius, { seg = 80, sides = 14, mat, belly = null, up = [0, 1, 0], dorsal = null, frames = null } = {}) {
  const P = [], T = [];
  for (let i = 0; i <= seg; i++) P.push(spline(pts, i / seg));
  for (let i = 0; i <= seg; i++) T.push(norm(sub(P[Math.min(seg, i + 1)], P[Math.max(0, i - 1)])));
  // repère transporté le long de la courbe (pas de torsion brusque)
  let N = norm(cross(T[0], up));
  if (Math.hypot(...N) < 0.5) N = norm(cross(T[0], [1, 0, 0]));
  const Ns = [], Bs = [];
  for (let i = 0; i <= seg; i++) {
    N = norm(sub(N, mul(T[i], dot(N, T[i]))));
    if (dorsal) {
      // le dos est ramené doucement vers la direction voulue (sinon la crête tourne autour du corps)
      const U = sub(dorsal, mul(T[i], dot(dorsal, T[i])));
      if (Math.hypot(...U) > 0.3) N = norm(add(mul(N, 0.75), mul(norm(U), 0.25)));
    }
    Ns.push(N);
    Bs.push(cross(T[i], N));
  }
  const ring = (i) => {
    const r = radius(i / seg), out = [];
    for (let k = 0; k <= sides; k++) {
      const a = (k / sides) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const n = add(mul(Ns[i], c), mul(Bs[i], s));
      out.push({ p: add(P[i], mul(n, r)), n, a });
    }
    return out;
  };
  let prev = ring(0);
  for (let i = 1; i <= seg; i++) {
    const cur = ring(i);
    for (let k = 0; k < sides; k++) {
      const a = prev[k], b = prev[k + 1], c = cur[k + 1], d = cur[k];
      m.setMat(belly && belly(a.a) ? belly(a.a) : mat);
      m.tri(a.p, c.p, b.p, a.n, c.n, b.n);
      m.tri(a.p, d.p, c.p, a.n, d.n, c.n);
    }
    prev = cur;
  }
  if (frames) frames.push(...P.map((p, i) => ({ p, t: T[i], n: Ns[i], b: Bs[i], s: i / seg })));
  return { P, T, N: Ns, B: Bs };
}
// cône (pic, dent, griffe) de la base vers une direction
function cone(m, base, dir, r, h, mat, tipMat = null, sides = 8) {
  dir = norm(dir);
  let u = norm(cross(dir, [0, 1, 0]));
  if (Math.hypot(...u) < 0.5) u = norm(cross(dir, [1, 0, 0]));
  const v = cross(dir, u), tip = add(base, mul(dir, h));
  for (let k = 0; k < sides; k++) {
    const a0 = (k / sides) * Math.PI * 2, a1 = ((k + 1) / sides) * Math.PI * 2;
    const p0 = add(base, add(mul(u, Math.cos(a0) * r), mul(v, Math.sin(a0) * r))), p1 = add(base, add(mul(u, Math.cos(a1) * r), mul(v, Math.sin(a1) * r)));
    const n0 = norm(add(mul(u, Math.cos(a0)), mul(dir, r / h))), n1 = norm(add(mul(u, Math.cos(a1)), mul(dir, r / h)));
    m.setMat(mat);
    m.tri(p0, tip, p1, n0, dir, n1);
    if (tipMat) {
      // pointe lumineuse : un petit cône par-dessus
      const q0 = add(add(base, mul(dir, h * 0.62)), mul(sub(p0, base), 0.38)), q1 = add(add(base, mul(dir, h * 0.62)), mul(sub(p1, base), 0.38));
      m.setMat(tipMat);
      m.tri(q0, add(tip, mul(dir, 0.002)), q1, n0, dir, n1);
    }
  }
}
// ellipsoïde orienté (repère local fx, fy, fz)
function ellipsoid(m, c, F, r, mat, seg = 18, rings = 12) {
  const [fx, fy, fz] = F;
  m.setMat(mat);
  const pt = (i, j) => {
    const th = (i / rings) * Math.PI, ph = (j / seg) * Math.PI * 2;
    const l = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const p = add(c, add(add(mul(fx, l[0] * r[0]), mul(fy, l[1] * r[1])), mul(fz, l[2] * r[2])));
    const n = norm(add(add(mul(fx, l[0] / r[0]), mul(fy, l[1] / r[1])), mul(fz, l[2] / r[2])));
    return { p, n };
  };
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < seg; j++) {
      const a = pt(i, j), b = pt(i + 1, j), cc = pt(i + 1, j + 1), d = pt(i, j + 1);
      m.tri(a.p, cc.p, b.p, a.n, cc.n, b.n);
      m.tri(a.p, d.p, cc.p, a.n, d.n, cc.n);
    }
}

function buildDragon() {
  const M = mats(), m = new S.Mesh();
  m.setObj(3);
  // le corps : il part de la tête (en haut à gauche), s'enroule en S et finit en queue effilée en bas à droite
  const path = [
    [-1.1, 2.25, 1.45],
    [0.05, 2.45, 0.95],
    [0.55, 2.55, 0.1],
    [1.45, 1.9, -0.45],
    [1.35, 0.75, -0.95],
    [0.0, 0.35, -0.55],
    [-1.35, 0.75, 0.15],
    [-1.75, -0.45, 0.75],
    [-0.55, -1.25, 0.65],
    [0.95, -1.05, 0.05],
    [1.75, -1.75, -0.35],
    [2.25, -2.35, -0.55],
  ];
  const radius = (s) => (s < 0.04 ? 0.34 + s * 2 : 0.44 * Math.pow(1 - s, 0.75) + 0.035);
  const frames = [];
  const body = tube(m, path, radius, { seg: 150, sides: 18, mat: M.scales, belly: (a) => (Math.cos(a) < -0.5 ? M.belly : null), dorsal: norm([0, 1, 0.45]), frames });
  // crête de cristaux le long du dos (direction N = dos)
  for (let i = 6; i < frames.length - 6; i += 5) {
    const f = frames[i], r = radius(f.s), h = 0.12 + 0.42 * Math.pow(1 - f.s, 1.2);
    cone(m, add(f.p, mul(f.n, r * 0.82)), add(f.n, mul(f.t, 0.55)), 0.05 + 0.08 * (1 - f.s), h, M.crystal, M.crystalTip, 6);
  }
  // lame de cristal au bout de la queue
  const tail = frames.at(-1);
  cone(m, tail.p, tail.t, 0.1, 0.55, M.crystal, M.crystalTip, 6);
  cone(m, add(tail.p, mul(tail.n, 0.04)), add(tail.t, mul(tail.n, 0.9)), 0.07, 0.38, M.crystal, M.crystalTip, 6);
  // pattes avant, griffes ouvertes
  for (const side of [-1, 1]) {
    const f = frames[16], r = radius(f.s);
    const hip = add(f.p, mul(f.b, side * r * 0.85));
    const knee = add(hip, add(mul(f.b, side * 0.35), add(mul(f.n, -0.25), mul(f.t, 0.15))));
    const paw = add(knee, add(mul(f.n, -0.35), add(mul(f.t, -0.25), mul(f.b, side * 0.1))));
    tube(m, [hip, knee, paw], (s) => 0.13 - s * 0.05, { seg: 14, sides: 10, mat: M.scales });
    for (const k of [-1, 0, 1]) cone(m, paw, add(mul(f.t, -0.8), add(mul(f.b, k * 0.45), mul(f.n, -0.5))), 0.035, 0.2, M.bone, null, 6);
  }
  // la tête : repère local (fx = vers l'avant du museau)
  // la tête se tient droite (le haut du crâne vers le ciel), quel que soit le vrillage du cou
  const head = frames[0].p, fx = norm(mul(frames[0].t, -1)), fy0 = [0, 1, 0];
  const fz = norm(cross(fx, fy0)), fy = norm(cross(fz, fx));
  const HS = 1.5; // tête un peu plus grosse : c'est elle qu'on regarde
  const L = (x, y, z) => add(head, add(add(mul(fx, x * HS), mul(fy, y * HS)), mul(fz, z * HS)));
  const E = (r) => r.map((v) => v * HS);
  const F = [fx, fy, fz];
  // crâne allongé et museau en coin
  ellipsoid(m, L(0.0, 0.06, 0), F, E([0.5, 0.27, 0.33]), M.scales);
  ellipsoid(m, L(0.62, 0.02, 0), F, E([0.62, 0.15, 0.22]), M.scales);
  ellipsoid(m, L(0.55, 0.12, 0), F, E([0.5, 0.06, 0.12]), M.horn); // arête du museau
  // mâchoire inférieure grande ouverte
  const jawDir = norm(add(fx, mul(fy, -0.55)));
  const jawUp = norm(cross(fz, jawDir));
  ellipsoid(m, add(L(0.1, -0.12, 0), mul(jawDir, 0.5 * HS)), [jawDir, jawUp, fz], E([0.55, 0.1, 0.2]), M.belly);
  // gueule incandescente : le souffle des abysses se prépare
  ellipsoid(m, L(0.42, -0.13, 0), [norm(add(fx, mul(fy, -0.28))), fy, fz], E([0.4, 0.07, 0.15]), M.mouth, 14, 10);
  // crocs du haut et du bas
  for (let k = 0; k < 7; k++) {
    const x = 0.28 + k * 0.13;
    for (const side of [-1, 1]) {
      cone(m, L(x, -0.1, side * (0.19 - k * 0.018)), add(mul(fy, -1), mul(fx, 0.15)), (k === 1 ? 0.035 : 0.022) * HS, (k === 1 ? 0.2 : 0.11) * HS, M.bone, null, 5);
      cone(m, add(add(L(0.1, -0.12, side * (0.17 - k * 0.017)), mul(jawDir, (0.2 + k * 0.12) * HS)), mul(jawUp, 0.07 * HS)), add(jawUp, mul(fx, 0.1)), (k === 0 ? 0.03 : 0.02) * HS, (k === 0 ? 0.17 : 0.09) * HS, M.bone, null, 5);
    }
  }
  for (const side of [-1, 1]) {
    // yeux en fente, brûlants
    ellipsoid(m, L(0.32, 0.13, side * 0.29), [norm(add(fx, mul(fy, 0.25))), fy, fz], E([0.1, 0.028, 0.045]), M.eye, 12, 8);
    // arcades en pics vers l'arrière
    cone(m, L(0.32, 0.24, side * 0.27), add(mul(fx, -1), add(mul(fy, 0.55), mul(fz, side * 0.35))), 0.05 * HS, 0.32 * HS, M.horn, null, 6);
    // pics des joues
    for (let k = 0; k < 3; k++) cone(m, L(-0.05 - k * 0.12, -0.08 - k * 0.04, side * (0.3 - k * 0.02)), add(mul(fx, -1), add(mul(fy, -0.25), mul(fz, side * 0.8))), 0.04 * HS, (0.26 - k * 0.05) * HS, M.crystal, M.crystalTip, 6);
    // cornes : longues, recourbées vers l'arrière
    const h0 = L(-0.05, 0.25, side * 0.2), h1 = L(-0.5, 0.6, side * 0.36), h2 = L(-1.05, 0.72, side * 0.42), h3 = L(-1.4, 0.5, side * 0.36);
    tube(m, [h0, h1, h2, h3], (s) => (0.1 * (1 - s) + 0.012) * HS, { seg: 24, sides: 10, mat: M.horn });
    cone(m, h3, sub(h3, h2), 0.02 * HS, 0.15 * HS, M.crystal, M.crystalTip, 5);
    // moustaches ondulantes
    const w0 = L(0.95, -0.02, side * 0.16), w1 = L(0.9, -0.28, side * 0.5), w2 = L(0.55, -0.6, side * 0.72), w3 = L(0.1, -0.55, side * 0.92), w4 = L(-0.25, -0.8, side * 1.02);
    tube(m, [w0, w1, w2, w3, w4], (s) => (0.03 * (1 - s) + 0.006) * HS, { seg: 30, sides: 6, mat: M.whisker });
  }
  // narines
  for (const side of [-1, 1]) ellipsoid(m, L(1.18, 0.07, side * 0.1), F, E([0.03, 0.02, 0.025]), M.horn, 8, 6);
  // crinière de cristaux derrière la tête
  for (let k = 0; k < 9; k++) {
    const a = -0.9 + (k / 8) * 1.8;
    cone(m, L(-0.25, 0.2, a * 0.28), add(mul(fx, -1), add(mul(fy, 0.7 + 0.3 * Math.cos(a * 2)), mul(fz, a * 0.6))), 0.05, 0.45 + 0.15 * Math.cos(a * 3), M.crystal, M.crystalTip, 6);
  }
  void body;
  return m.compile();
}

// rendu : image RGBA sur fond transparent
function renderDragon(job = {}) {
  const W = job.w ?? 600, H = job.h ?? 700;
  const cam = M3.makeCamera({ target: job.target ?? [-0.1, 0.35, 0], azimuth: job.azimuth ?? 0.12, elevation: job.elevation ?? 0.12, distance: job.distance ?? 14, fov: job.fov ?? 0.5, width: W, height: H });
  const env = {
    mats: S.MATS,
    eye: cam.eye,
    sun: { dir: M3.norm([-0.45, 0.75, 0.6]), color: [2.4, 2.0, 2.6] },
    shadow: null,
    sky: [0.32, 0.18, 0.55],
    ground: [0.05, 0.02, 0.09],
    horizon: [0.9, 0.45, 1.1],
    fog: null,
    exposure: 1.15,
    terrain: null,
  };
  const layer = render([buildDragon()], cam, env, { ss: job.ss ?? 4 }); // 2 ou 4 seulement
  const data = new Uint8ClampedArray(W * H * 4);
  // le calque couvre l'image entière (x0 = y0 = 0)
  for (let y = 0; y < layer.h; y++) data.set(layer.rgba.subarray(y * layer.w * 4, (y + 1) * layer.w * 4), ((y + layer.y0) * W + layer.x0) * 4);
  return { data, width: W, height: H };
}

module.exports = { renderDragon, buildDragon };
