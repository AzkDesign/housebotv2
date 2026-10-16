// Pile ou face en 3D : une pièce bimétallique lancée sur le tapis de l'Arène.
// Côté FACE : or, couronne sertie de rubis. Côté PILE : argent, étoile.
// La pièce s'envole en tournoyant (flou de mouvement), rebondit, puis tourne sur sa tranche
// en ralentissant comme un vrai disque d'Euler avant de se poser sur le bon côté.
const { createCanvas } = require("@napi-rs/canvas");
const { render, overImage } = require("./moteur");
const S = require("./scene");
const M3 = require("./math");

const R = 1, T = 0.15; // rayon et épaisseur de la pièce
const MI = S.MI;
const ruby = () => S.colorMat("#b3122e", { metal: 0.4, rough: 0.12, emit: "#ff2040", ei: 0.25 });
const felt = () => S.colorMat("#0a3a25", { pat: "cloth", rough: 0.97 });

// couronne (vue de dessus, la pointe des fleurons vers −z : le haut de l'écran)
function crownPts() {
  return [
    [-0.46, 0.26],
    [0.46, 0.26],
    [0.48, -0.06],
    [0.56, -0.4],
    [0.27, -0.13],
    [0, -0.46],
    [-0.27, -0.13],
    [-0.56, -0.4],
    [-0.48, -0.06],
  ];
}
function starPts(r1 = 0.52, r2 = 0.22) {
  const pts = [];
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? r2 : r1;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}
// une face de la pièce, dessinée sur le dessus (y = T/2) ; side : "face" (or) ou "pile" (argent)
function coinFace(m, side) {
  const metal = side === "face" ? MI.gold : MI.steel, deep = side === "face" ? MI.goldDark : S.colorMat("#7d8792", { metal: 1, rough: 0.34 });
  // le champ est une fine plaque posée sur la pièce ; tout le décor repose dessus (y)
  m.setMat(deep).cyl(0.86, 0.008, { seg: 56, y0: T / 2 + 0.001 });
  const y = T / 2 + 0.009;
  m.setMat(MI.gold).push().translate(0, T / 2, 0).torus(0.925, 0.045, { seg: 64, tube: 7 }).pop();
  for (let k = 0; k < 44; k++) {
    const a = (k / 44) * Math.PI * 2;
    m.setMat(metal).push().translate(Math.cos(a) * 0.78, y + 0.004, Math.sin(a) * 0.78).sphere(0.024, { seg: 6, rings: 4, hemi: true }).pop();
  }
  // anneau intérieur fin
  m.setMat(metal).push().translate(0, y + 0.002, 0).torus(0.69, 0.012, { seg: 56, tube: 4 }).pop();
  if (side === "face") {
    m.setMat(metal).extrude(crownPts(), y, y + 0.095, { center: true });
    m.setMat(deep).box(-0.47, y, 0.2, 0.47, y + 0.085, 0.3);
    // perles et rubis
    for (const [x, z] of [
      [-0.56, -0.4],
      [0, -0.46],
      [0.56, -0.4],
    ])
      m.setMat(MI.gold).push().translate(x, y + 0.095, z).sphere(0.06, { seg: 10, rings: 6 }).pop();
    for (const x of [-0.28, 0, 0.28]) m.setMat(ruby()).push().translate(x, y + 0.085, 0.25).sphere(0.045, { seg: 10, rings: 6, sy: 0.6 }).pop();
    m.setMat(ruby()).push().translate(0, y + 0.07, 0.02).sphere(0.075, { seg: 12, rings: 6, sy: 0.55 }).pop();
  } else {
    m.setMat(metal).extrude(starPts(), y, y + 0.075, { center: true });
    m.setMat(deep).extrude(starPts(0.3, 0.13), y + 0.075, y + 0.1, { center: true });
    // quatre petites étoiles autour
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      m.setMat(metal).push().translate(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5).extrude(starPts(0.09, 0.04), y, y + 0.04, { center: true }).pop();
    }
  }
}
function coinMesh() {
  const m = new S.Mesh();
  m.setObj(2);
  // tranche dorée et cannelée
  m.setMat(MI.gold).cyl(R, T, { seg: 72, y0: -T / 2, top: true, bottom: true });
  for (let k = 0; k < 96; k++) m.setMat(MI.goldDark).push().rotY((k / 96) * Math.PI * 2).translate(R, 0, 0).box(-0.012, -T * 0.36, -0.011, 0.012, T * 0.36, 0.011).pop();
  coinFace(m, "face");
  m.push().rotX(Math.PI);
  coinFace(m, "pile");
  m.pop();
  return m;
}
// la pièce compilée une fois, puis replacée à chaque image par une matrice
let coinCache = null;
function placedCoin(pos, rot) {
  coinCache ??= coinMesh().compile();
  const src = coinCache, P = new Float32Array(src.P.length), N = new Float32Array(src.N.length);
  const [a, b, c, d, e, f, g, h, i] = rot;
  for (let k = 0; k < src.P.length; k += 3) {
    const x = src.P[k], y = src.P[k + 1], z = src.P[k + 2];
    P[k] = a * x + b * y + c * z + pos[0];
    P[k + 1] = d * x + e * y + f * z + pos[1];
    P[k + 2] = g * x + h * y + i * z + pos[2];
    const nx = src.N[k], ny = src.N[k + 1], nz = src.N[k + 2];
    N[k] = a * nx + b * ny + c * nz;
    N[k + 1] = d * nx + e * ny + f * nz;
    N[k + 2] = g * nx + h * ny + i * nz;
  }
  return { ...src, P, N };
}
// matrices 3×3 (rangées)
const mul3 = (A, B) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]));
const rx = (t) => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
const ry = (t) => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];

function tableMesh() {
  const m = new S.Mesh();
  m.setObj(1);
  m.setMat(felt()).box(-9, -0.2, -9, 9, 0, 9);
  // cercle doré de l'Arène et son double filet
  m.setMat(MI.gold).torus(2.45, 0.03, { seg: 96, tube: 5 });
  m.setMat(MI.goldDark).torus(2.62, 0.015, { seg: 96, tube: 4 });
  // huit petits losanges dorés sur le cercle
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    m.setMat(MI.gold).push().translate(Math.cos(a) * 2.535, 0, Math.sin(a) * 2.535).rotY(-a + Math.PI / 4).box(-0.06, 0, -0.06, 0.06, 0.02, 0.06).pop();
  }
  return m.compile();
}

// trajectoire : renvoie pour chaque image { pos, rot, blur (nombre de poses), delay, phase }
// result : 0 → FACE dessus, 1 → PILE dessus
function tossPlan(result, seed = 1) {
  let s = (seed >>> 0) || 1;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const end = result ? Math.PI : 0;
  const frames = [];
  const DT = 0.04;
  const flight = 1.0, turns = 5 + Math.floor(rnd() * 2), hop = 0.3, wobble = 1.16, alpha0 = 0.42;
  const yaw = (rnd() - 0.5) * 0.5, drift = [(rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.3];
  // fin de vol : la pièce arrive inclinée (α0), c'est son rebord qui touche le tapis
  const lift = (T / 2) * (Math.cos(alpha0) - 1) + R * Math.sin(alpha0) * 0.9;
  // 0. la pièce posée, côté opposé au résultat ou au hasard
  const startUp = rnd() < 0.5 ? 0 : Math.PI;
  for (let k = 0; k < 5; k++) frames.push({ t: k * DT, pos: [0, T / 2, 0], rot: mul3(ry(yaw), rx(startUp)), blur: 1, delay: k === 4 ? 260 : 70, phase: "intro" });
  // 1. le lancer : parabole, rotation rapide autour de l'axe horizontal de l'écran
  const nF = Math.round(flight / DT), H = 1.9;
  for (let k = 1; k <= nF; k++) {
    const q = k / nF;
    const poses = [];
    const sub = q < 0.9 ? 3 : 2;
    for (let j = 0; j < sub; j++) {
      const qq = (k - 1 + (j + 0.5) / sub) / nF;
      const y = T / 2 + lift * qq + 4 * H * qq * (1 - qq);
      // angle : part de startUp, finit à end + α0 (légèrement penchée à l'impact)
      const total = startUp + turns * Math.PI * 2 + ((end - startUp) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      const th = startUp + (total - startUp) * (1 - (1 - qq) ** 1.35) + alpha0 * qq;
      poses.push({ pos: [drift[0] * qq, y, drift[1] * qq], rot: mul3(ry(yaw + qq * 0.6), rx(th)) });
    }
    frames.push({ t: 0.3 + q * flight, poses, blur: sub, delay: 40, phase: "vol" });
  }
  // 2. petit rebond
  const nH = 6;
  const yawL = yaw + 0.6;
  for (let k = 1; k <= nH; k++) {
    const q = k / nH, a = alpha0 * (1 - 0.35 * q);
    const y = T / 2 * Math.cos(a) + R * Math.sin(a) * 0.9 + 4 * hop * q * (1 - q);
    frames.push({ t: 1.4 + q * 0.24, pos: [drift[0], y, drift[1]], rot: mul3(ry(yawL), rx(end + a)), blur: 1, delay: 40, phase: "rebond" });
  }
  // 3. la toupie : l'inclinaison diminue, la précession accélère (disque d'Euler)
  const nW = Math.round(wobble / DT);
  let phi = 0;
  for (let k = 1; k <= nW; k++) {
    const q = k / nW, a = alpha0 * 0.65 * Math.exp(-3.2 * q) * (1 - q) ** 0.6;
    // inclinaison a autour d'un axe horizontal qui tourne (phi) ; la pièce reste du bon côté
    const rot = mul3(ry(yawL), mul3(ry(phi), mul3(rx(a), mul3(ry(-phi), rx(end)))));
    phi += (0.55 + 1.9 * q) * 1.2;
    const y = (T / 2) * Math.cos(a) + R * Math.sin(a);
    frames.push({ t: 1.7 + q * wobble, pos: [drift[0], y, drift[1]], rot, blur: 1, delay: 40, phase: "toupie" });
  }
  // 4. posée : on laisse le temps de lire le résultat
  const rest = mul3(ry(yawL), rx(end));
  for (let k = 0; k < 8; k++) frames.push({ t: 3.3 + k * 0.08, pos: [drift[0], T / 2, drift[1]], rot: rest, blur: 1, delay: k === 7 ? 3200 : 70, phase: "resultat" });
  return frames;
}

// fond (une seule fois) : tapis de l'Arène sous une lumière de salle de jeu
function backdrop(W, H, cam, env) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.75);
  g.addColorStop(0, "#1c2a22");
  g.addColorStop(1, "#05080a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const img = ctx.getImageData(0, 0, W, H);
  overImage(img.data, W, H, render([tableMesh()], cam, env, { ss: 2 }));
  // halo de lumière au centre et vignettage
  const out = new Uint8ClampedArray(img.data);
  const cx = W / 2, cy = H * 0.56;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - cx) / (W * 0.55), (y - cy) / (H * 0.62));
      const k = Math.max(0.16, Math.min(1.1, 1.16 - d * d * 0.95));
      const i = (y * W + x) * 4;
      out[i] *= k;
      out[i + 1] *= k;
      out[i + 2] *= k;
    }
  return out;
}
// ombre douce de la pièce : son contour projeté au sol selon le soleil
function paintShadow(buf, W, H, cam, pose, sun) {
  const pts = [];
  const [a, , c, d, , f, g, , i] = pose.rot;
  for (let k = 0; k < 36; k++) {
    const u = (k / 36) * Math.PI * 2, lx = Math.cos(u) * R, lz = Math.sin(u) * R;
    const wx = a * lx + c * lz + pose.pos[0], wy = d * lx + f * lz + pose.pos[1], wz = g * lx + i * lz + pose.pos[2];
    const s2 = wy / sun[1];
    const p = cam.project(wx - sun[0] * s2, 0.002, wz - sun[2] * s2);
    pts.push([p[0], p[1]]);
  }
  const height = Math.max(0, pose.pos[1] - T / 2);
  const soft = 3 + height * 16, dark = 0.55 / (1 + height * 0.9);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  x0 = Math.max(0, Math.floor(x0 - soft));
  y0 = Math.max(0, Math.floor(y0 - soft));
  x1 = Math.min(W - 1, Math.ceil(x1 + soft));
  y1 = Math.min(H - 1, Math.ceil(y1 + soft));
  // l'ombre d'un disque est convexe : distance signée ≈ la plus grande distance aux droites des côtés
  let area = 0;
  for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) area += pts[j][0] * pts[k][1] - pts[k][0] * pts[j][1];
  const sg = area > 0 ? 1 : -1, E = [];
  for (let k = 0, j = pts.length - 1; k < pts.length; j = k++) {
    const vx = pts[k][0] - pts[j][0], vy = pts[k][1] - pts[j][1], l = Math.hypot(vx, vy);
    if (l < 1e-6) continue;
    const nx = (sg * vy) / l, ny = (-sg * vx) / l;
    E.push(nx, ny, nx * pts[j][0] + ny * pts[j][1]);
  }
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      let sd = -Infinity;
      for (let k = 0; k < E.length; k += 3) {
        const d = E[k] * x + E[k + 1] * y - E[k + 2];
        if (d > sd) sd = d;
      }
      const cov = Math.max(0, Math.min(1, 0.5 - sd / (2 * soft)));
      if (!cov) continue;
      const k = 1 - dark * cov * cov * (3 - 2 * cov), o = (y * W + x) * 4;
      buf[o] *= k;
      buf[o + 1] *= k;
      buf[o + 2] *= k;
    }
}

// générateur : une image RGBA (W×H) par étape, avec ses infos { delay, phase, coin: [x, y, rayon] }
function* coinFrames(job) {
  const W = job.w, H = job.h, ss = job.ss ?? 2;
  const cam = M3.makeCamera({ target: [0, 0.85, 0.15], azimuth: 0, elevation: 0.82, distance: 8.6, fov: 0.52, width: W, height: H });
  const sun = M3.norm([-0.45, 0.82, 0.38]);
  const env = { mats: S.MATS, eye: cam.eye, sun: { dir: sun, color: [3.3, 2.9, 2.35] }, shadow: null, sky: [0.5, 0.4, 0.3], ground: [0.04, 0.09, 0.06], horizon: [1.55, 1.12, 0.7], fog: null, exposure: 0.98, terrain: null };
  const bg = backdrop(W, H, cam, env);
  const frame = new Uint8ClampedArray(W * H * 4), acc = new Float32Array(W * H * 3);
  for (const fr of tossPlan(job.result, job.seed)) {
    const poses = fr.poses ?? [{ pos: fr.pos, rot: fr.rot }];
    frame.set(bg);
    // ombre (pose du milieu)
    paintShadow(frame, W, H, cam, poses[Math.floor(poses.length / 2)], sun);
    // zone de la pièce sur l'écran (toutes les poses)
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of poses)
      for (const dx of [-1.1, 1.1])
        for (const dy of [-1.1, 1.1])
          for (const dz of [-1.1, 1.1]) {
            const [sx, sy] = cam.project(p.pos[0] + dx, p.pos[1] + dy, p.pos[2] + dz);
            x0 = Math.min(x0, sx);
            x1 = Math.max(x1, sx);
            y0 = Math.min(y0, sy);
            y1 = Math.max(y1, sy);
          }
    const reg = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(W, Math.ceil(x1)), Math.min(H, Math.ceil(y1))];
    const rw = reg[2] - reg[0], rh = reg[3] - reg[1];
    if (rw > 0 && rh > 0) {
      // flou de mouvement : moyenne de plusieurs poses posées sur le décor
      acc.fill(0, 0, rw * rh * 3);
      for (const p of poses) {
        const l = render([placedCoin(p.pos, p.rot)], cam, env, { ss, region: reg });
        for (let y = 0; y < rh; y++)
          for (let x = 0; x < rw; x++) {
            const gx = reg[0] + x, gy = reg[1] + y, o = (gy * W + gx) * 4, q = (y * rw + x) * 3;
            const lx = gx - l.x0, ly = gy - l.y0;
            let r = frame[o], g = frame[o + 1], b2 = frame[o + 2];
            if (lx >= 0 && ly >= 0 && lx < l.w && ly < l.h) {
              const li = (ly * l.w + lx) * 4, al = l.rgba[li + 3] / 255;
              r = l.rgba[li] * al + r * (1 - al);
              g = l.rgba[li + 1] * al + g * (1 - al);
              b2 = l.rgba[li + 2] * al + b2 * (1 - al);
            }
            acc[q] += r;
            acc[q + 1] += g;
            acc[q + 2] += b2;
          }
      }
      const n = poses.length;
      for (let y = 0; y < rh; y++)
        for (let x = 0; x < rw; x++) {
          const o = ((reg[1] + y) * W + reg[0] + x) * 4, q = (y * rw + x) * 3;
          frame[o] = acc[q] / n;
          frame[o + 1] = acc[q + 1] / n;
          frame[o + 2] = acc[q + 2] / n;
          frame[o + 3] = 255;
        }
    }
    const mid = poses[Math.floor(poses.length / 2)].pos, c = cam.project(...mid), e = cam.project(mid[0] + R, mid[1], mid[2]);
    yield { data: frame, delay: fr.delay, phase: fr.phase, coin: [c[0], c[1], Math.abs(e[0] - c[0])] };
  }
}

module.exports = { coinFrames, tossPlan };
