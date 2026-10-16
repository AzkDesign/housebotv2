// Clash de la Maison en 3D : les rendus complets (fond peint + scène 3D + atmosphère).
// - renderBase : l'image d'une base (accueil ou cible), en une passe.
// - renderBattle : les images d'une bataille ; le décor est rendu une fois, les bâtiments et les soldats
//   sont des calques superposés image par image (avec test de profondeur), puis la caméra recadre.
const { createCanvas } = require("@napi-rs/canvas");
const { render, composite, overImage, n2, shadowCasters } = require("./moteur");
const S = require("./scene");
const M3 = require("./math");
const { respirer, nettoyer } = require("./memoire");

// ---------- le ciel : une mer de nuages dorée sous l'île ----------
function rngf(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// une « bouffée » douce : disque à bord fondu (dégradé radial, sans filtre de flou, donc très rapide)
function puff(ctx, x, y, r, rgb, a, sy = 0.62) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.55, `rgba(${rgb},${a * 0.78})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
// un nuage : ombre bleutée en bas à droite, lumière dorée en haut à gauche, cœur blanc
function cloudBlob(ctx, x, y, w, h, R, alpha = 1, warm = 0.5) {
  const n = 7 + Math.floor(R() * 6), puffs = [];
  for (let k = 0; k < n; k++) {
    const u = (R() - 0.5) * 2;
    puffs.push([x + u * w * 0.5, y + (R() - 0.5) * h * 0.35 - (1 - Math.abs(u)) * h * 0.25, (0.45 + R() * 0.5) * h * (1.15 - Math.abs(u) * 0.4)]);
  }
  const lit = warm > 0.5 ? "255,236,206" : "250,244,236";
  for (const [px, py, r] of puffs) puff(ctx, px + r * 0.12, py + r * 0.3, r * 1.15, "128,146,178", 0.5 * alpha);
  for (const [px, py, r] of puffs) puff(ctx, px, py, r, "214,222,236", 0.75 * alpha);
  for (const [px, py, r] of puffs) puff(ctx, px - r * 0.22, py - r * 0.28, r * 0.78, lit, 0.85 * alpha);
}
function paintSky(ctx, W, H, seed) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#6b8fbd");
  g.addColorStop(0.3, "#93b2d3");
  g.addColorStop(0.65, "#c9cfd8");
  g.addColorStop(1, "#e8d4bc");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // halo du soleil (hors champ, en haut à gauche)
  const sun = ctx.createRadialGradient(W * 0.02, -H * 0.15, 0, W * 0.02, -H * 0.15, W * 0.95);
  sun.addColorStop(0, "rgba(255,224,168,0.9)");
  sun.addColorStop(0.3, "rgba(255,206,150,0.35)");
  sun.addColorStop(1, "rgba(255,190,140,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  const R = rngf(seed * 7 + 3), k = W / 1200;
  // mer de nuages : lointaine et pâle en haut, proche et volumineuse en bas
  for (let row = 0; row < 7; row++) {
    const yy = H * (0.1 + row * 0.15), size = (0.55 + row * 0.22) * k, n = 7 - Math.floor(row / 2);
    for (let i = 0; i < n; i++) {
      const x = ((i + R() * 0.8) / n) * W * 1.15 - W * 0.07;
      cloudBlob(ctx, x, yy + (R() - 0.5) * 40 * k, (150 + R() * 140) * size, (55 + R() * 30) * size, R, 0.45 + row * 0.08, 1 - x / W);
    }
  }
  // voile de brume chaude
  const haze = ctx.createLinearGradient(0, 0, 0, H);
  haze.addColorStop(0, "rgba(160,186,220,0.25)");
  haze.addColorStop(1, "rgba(255,226,196,0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, H);
}
// rayons du soleil, brume chaude et vignettage
function paintLight(ctx, W, H) {
  ctx.save();
  // rayons du soleil très discrets, en haut à gauche
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 5; k++) {
    const a0 = 0.42 + k * 0.12;
    const g = ctx.createLinearGradient(0, 0, W * 0.7, H * 0.7);
    g.addColorStop(0, `rgba(255,232,190,${0.07 - k * 0.01})`);
    g.addColorStop(1, "rgba(255,232,190,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-W * 0.02, -H * 0.1);
    ctx.lineTo(-W * 0.02 + Math.cos(a0) * W * 1.4, -H * 0.1 + Math.sin(a0) * W * 1.4);
    ctx.lineTo(-W * 0.02 + Math.cos(a0 + 0.04) * W * 1.4, -H * 0.1 + Math.sin(a0 + 0.04) * W * 1.4);
    ctx.closePath();
    ctx.fill();
  }
  // étalonnage : chaleur en haut à gauche, fraîcheur en bas à droite
  ctx.globalCompositeOperation = "soft-light";
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "rgba(255,206,140,0.35)");
  g.addColorStop(1, "rgba(70,80,150,0.25)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // vignettage
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.5, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(14,10,28,0.38)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// la cascade qui tombe du bord de l'île (côté droit) ; t anime l'eau
function waterfallPoint(world) {
  // point du contour le plus à droite de l'écran parmi ceux du côté +x, vers l'avant
  let best = null;
  for (const p of world.island.edge) if (p[0] > 9 && p[2] > 1.5 && p[2] < 6.5 && (!best || p[0] > best[0])) best = p;
  return best ?? [12.5, 0, 4];
}
function paintWaterfall(ctx, cam, world, t) {
  const p = waterfallPoint(world);
  // l'eau jaillit juste sous le rebord d'herbe et tombe dans la mer de nuages
  const [x, y] = cam.project(p[0] + 0.15, p[1] - 0.55, p[2]);
  const [, yb] = cam.project(p[0], p[1] - 12, p[2]);
  const k = Math.hypot(...[0, 1].map((i) => cam.project(p[0], 0, p[2] + 1)[i] - cam.project(p[0], 0, p[2])[i])) / 28 || 1;
  const w = 20 * k, fall = Math.max(60, yb - y);
  ctx.save();
  // nappe d'eau : plus large en bas, se dissout dans l'air
  const g = ctx.createLinearGradient(0, y, 0, y + fall);
  g.addColorStop(0, "rgba(232,248,255,0.95)");
  g.addColorStop(0.18, "rgba(176,220,246,0.88)");
  g.addColorStop(0.65, "rgba(200,228,248,0.45)");
  g.addColorStop(1, "rgba(235,242,250,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y);
  ctx.bezierCurveTo(x - w * 0.62, y + fall * 0.12, x - w * 0.9, y + fall * 0.5, x - w * 1.6, y + fall);
  ctx.lineTo(x + w * 1.6, y + fall);
  ctx.bezierCurveTo(x + w * 0.9, y + fall * 0.5, x + w * 0.62, y + fall * 0.12, x + w * 0.5, y);
  ctx.closePath();
  ctx.fill();
  // filets d'eau qui descendent
  ctx.lineCap = "round";
  for (let j = 0; j < 16; j++) {
    const u = j / 15 - 0.5, q = (t * 1.2 + j * 0.41) % 1, yy = y + q * fall * 0.8;
    const spread = 1 + q * 1.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - q)})`;
    ctx.lineWidth = (1.2 + (j % 3) * 0.5) * k;
    ctx.beginPath();
    ctx.moveTo(x + u * w * spread, yy);
    ctx.lineTo(x + u * w * (spread + 0.1), yy + 18 * k);
    ctx.stroke();
  }
  // écume à la sortie et embruns
  for (let j = 0; j < 5; j++) puff(ctx, x + (j - 2) * w * 0.32, y + 2 * k, 7 * k, "255,255,255", 0.8, 0.7);
  for (let j = 0; j < 7; j++) {
    const q = (t * 0.28 + j / 7) % 1;
    puff(ctx, x + (j - 3) * 9 * k, y + fall * 0.7 - q * 34 * k, (22 + q * 30) * k, "255,255,255", 0.22 * (1 - q), 0.8);
  }
  ctx.restore();
}
function paintBirds(ctx, W, H, seed, t) {
  const R = rngf(seed + 9);
  ctx.save();
  ctx.lineCap = "round";
  for (let k = 0; k < 7; k++) {
    const x = ((R() * W + t * (26 + R() * 20)) % (W + 40)) - 20, y = H * (0.08 + R() * 0.16), s = (4 + R() * 3) * (W / 1200), f = Math.sin(t * 9 + k * 1.3) * s * 0.7;
    ctx.strokeStyle = "rgba(28,26,40,0.65)";
    ctx.lineWidth = 1.7 * (W / 1200);
    ctx.beginPath();
    ctx.moveTo(x - s, y - f);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - f);
    ctx.stroke();
  }
  ctx.restore();
}
// quelques nuages devant l'île, en bas (profondeur)
function paintFrontClouds(ctx, W, H, seed) {
  const R = rngf(seed + 41), k = W / 1200;
  for (let i = 0; i < 5; i++) {
    const x = i % 2 ? W * (0.85 + R() * 0.2) : W * (R() * 0.15 - 0.05);
    cloudBlob(ctx, x, H * (0.88 + R() * 0.16), (220 + R() * 200) * k, (70 + R() * 40) * k, R, 0.8, 0.6);
  }
}

// ---------- points d'ancrage des bâtiments (pour le texte et les bulles dessinés par le bot) ----------
const HEIGHT = { manoir: 3.6, mine: 1.3, distillerie: 1.9, coffre: 1.8, caserne: 1.2, canon: 1.0, tour: 3.9, mortier: 1.1 };
function anchorsOf(world, cam) {
  const out = {};
  for (const b of world.buildings) {
    const h = ((HEIGHT[b.type] ?? 1.5) + (b.type === "tour" || b.type === "manoir" ? 0.15 * (b.level || 1) : 0)) * S.BSCALE;
    const [gx, gy] = cam.project(b.wx, 0, b.wz), [tx, ty] = cam.project(b.wx, h, b.wz);
    const size = (b.type === "manoir" ? 3 : 2) * S.BSCALE;
    const [ex] = cam.project(b.wx + size / 2, 0, b.wz - size / 2);
    out[b.id] = { x: gx, y: gy, topX: tx, topY: ty, halfW: Math.abs(ex - gx) };
  }
  return out;
}
// rectangle d'écran couvert par un bâtiment (pour ne rendre que cette zone)
function screenBox(cam, b, extra = 0.4) {
  const size = ((b.type === "manoir" ? 3 : 2) / 2) * S.BSCALE + extra, h = ((HEIGHT[b.type] ?? 1.5) + 0.25 * (b.level || 1) + 1.2) * S.BSCALE;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const dx of [-size, size]) for (const dz of [-size, size]) for (const dy of [-0.2, h]) {
    const [sx, sy] = cam.project(b.wx + dx, dy, b.wz + dz);
    x0 = Math.min(x0, sx);
    x1 = Math.max(x1, sx);
    y0 = Math.min(y0, sy);
    y1 = Math.max(y1, sy);
  }
  return [x0 - 4, y0 - 4, x1 + 4, y1 + 4];
}

// ============================================================
// Image d'une base
// ============================================================
// job : { W, H, rect, data, ss }
function renderBase(job) {
  const W = job.W, H = job.H, ss = job.ss ?? 2, T0 = Date.now(), tm = {};
  const lap = (k) => (tm[k] = Date.now() - T0);
  const cam = M3.fitCamera(W, H, job.rect ?? [0, 0, W, H]);
  const world = S.buildWorld(job.data);
  const bms = world.buildings.map((b) => S.buildingMesh(b, "intact", b.aim ?? null, 0.4));
  world.env.eye = cam.eye;
  world.env.fog.start = cam.distance + 3; // la brume commence derrière le centre de l'île
  lap("maillages");
  world.env.shadow = S.sunShadow(world, bms);
  lap("ombres");
  const layer = render([world.static_, ...bms], cam, world.env, { ss });
  lap("rendu");
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  paintSky(ctx, W, H, world.seed);
  lap("ciel");
  const img = ctx.getImageData(0, 0, W, H);
  overImage(img.data, W, H, layer);
  ctx.putImageData(img, 0, 0);
  lap("pose");
  paintWaterfall(ctx, cam, world, 0.35);
  lap("cascade");
  paintBirds(ctx, W, H, world.seed, 0.4);
  paintFrontClouds(ctx, W, H, world.seed);
  lap("nuages");
  paintLight(ctx, W, H);
  lap("lumière");
  const out = ctx.getImageData(0, 0, W, H).data;
  if (process.env.CLASH3D_PROF) console.log("renderBase", JSON.stringify(tm));
  return { data: out, width: W, height: H, anchors: anchorsOf(world, cam) };
}

// ============================================================
// Images d'une bataille
// ============================================================
// le ciel peint est fondu une fois pour toutes sous les calques du décor (ils deviennent opaques)
function skyUnder(W, H, seed, layers) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  paintSky(ctx, W, H, seed);
  const sky = ctx.getImageData(0, 0, W, H).data;
  for (const [l, all] of layers) {
    if (!l) continue;
    for (let y = 0; y < l.h; y++)
      for (let x = 0; x < l.w; x++) {
        const i = (y * l.w + x) * 4, a = l.rgba[i + 3];
        if (a === 255 || (!a && !all)) continue;
        const j = ((y + l.y0) * W + x + l.x0) * 4, k = a / 255;
        l.rgba[i] = l.rgba[i] * k + sky[j] * (1 - k);
        l.rgba[i + 1] = l.rgba[i + 1] * k + sky[j + 1] * (1 - k);
        l.rgba[i + 2] = l.rgba[i + 2] * k + sky[j + 2] * (1 - k);
        l.rgba[i + 3] = 255;
      }
  }
}
// carte d'ombre deux fois moins fine (pour les soldats) : la profondeur la plus proche de chaque bloc 2×2
function halfShadow(sm) {
  const S = sm.S >> 1, map = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = 2 * y * sm.S + 2 * x;
      map[y * S + x] = Math.min(sm.map[i], sm.map[i + 1], sm.map[i + sm.S], sm.map[i + sm.S + 1]);
    }
  return { ...sm, map, ids: null, S };
}
// filtre de Catmull-Rom, élargi quand on réduit l'image (pas de crénelage), net quand on l'agrandit
function catrom(x) {
  x = Math.abs(x);
  return x < 1 ? (1.5 * x - 2.5) * x * x + 1 : x < 2 ? ((-0.5 * x + 2.5) * x - 4) * x + 2 : 0;
}
// pour chaque pixel de sortie : premier pixel source, nombre de poids, poids normalisés
function resampleTaps(n, start, scale, size) {
  const s = Math.max(1, scale), r = 2 * s, max = Math.ceil(2 * r) + 2;
  const first = new Int32Array(n), count = new Int32Array(n), w = new Float32Array(n * max);
  for (let o = 0; o < n; o++) {
    const c = start + (o + 0.5) * scale - 0.5, i0 = Math.max(0, Math.ceil(c - r)), i1 = Math.min(size - 1, Math.floor(c + r));
    let sum = 0;
    for (let i = i0; i <= i1; i++) sum += w[o * max + i - i0] = catrom((i - c) / s);
    for (let i = i0; i <= i1; i++) w[o * max + i - i0] /= sum || 1;
    first[o] = i0;
    count[o] = Math.max(0, i1 - i0 + 1);
  }
  return { first, count, w, max };
}
// recadrage [cx, cy, cw, ch] de src (RGBA opaque, W×H) vers dst (w×h) ; row : Float32Array(W * 3) de travail
function resampleCrop(src, W, H, crop, dst, w, h, row) {
  const [cx, cy, cw, ch] = crop;
  const X = resampleTaps(w, cx, cw / w, W), Y = resampleTaps(h, cy, ch / h, H);
  const xa = X.first[0], xb = X.first[w - 1] + X.count[w - 1];
  for (let oy = 0; oy < h; oy++) {
    // 1. colonne : mélange des lignes sources
    row.fill(0, xa * 3, xb * 3);
    for (let k = 0, ny = Y.count[oy]; k < ny; k++) {
      const wy = Y.w[oy * Y.max + k];
      for (let x = xa, j = ((Y.first[oy] + k) * W + xa) * 4, q = xa * 3; x < xb; x++, j += 4, q += 3) {
        row[q] += src[j] * wy;
        row[q + 1] += src[j + 1] * wy;
        row[q + 2] += src[j + 2] * wy;
      }
    }
    // 2. ligne : mélange des colonnes
    for (let ox = 0, d = oy * w * 4; ox < w; ox++, d += 4) {
      let r = 0, g = 0, b = 0;
      for (let k = 0, nx = X.count[ox], q = X.first[ox] * 3, wo = ox * X.max; k < nx; k++, q += 3) {
        const wx = X.w[wo + k];
        r += row[q] * wx;
        g += row[q + 1] * wx;
        b += row[q + 2] * wx;
      }
      dst[d] = r;
      dst[d + 1] = g;
      dst[d + 2] = b;
      dst[d + 3] = 255;
    }
  }
}
// job : { W, H, rect, data, ss, out: { w, h }, frames: [{ states: { id: "ruine" }, troops: [...], aims: { id: angle }, crop: [x, y, w, h], t }] }
// soldat : { x, y (grille), role, ring, yaw, phase }
const AIM_STEPS = 24;
// générateur : rend les images une par une (yield RGBA de job.out.w × job.out.h), renvoie les statistiques à la fin
function* battleFrames(job) {
  const W = job.W, H = job.H, ss = job.ss ?? 2;
  const cam = M3.fitCamera(W, H, job.rect ?? [0, 0, W, H]);
  const world = S.buildWorld(job.data);
  world.env.eye = cam.eye;
  world.env.fog.start = cam.distance + 3; // la brume commence derrière le centre de l'île
  const intact = world.buildings.map((b) => S.buildingMesh(b, "intact", null));
  world.env.shadow = S.sunShadow(world, intact, 2048, true);
  const t0 = Date.now();
  // 1. décor (île, arbres, muret) une seule fois
  const bg = render([world.static_], cam, world.env, { ss });
  const tBg = Date.now() - t0;
  // 1 bis. l'ombre de chaque bâtiment au sol : la version « sans ombre » de cette zone, et quels pixels elle touche,
  // pour l'effacer quand le bâtiment est détruit
  const inv = M3.mat4Invert(cam.vp), L = S.SUN;
  // zone couverte par toutes les ombres de bâtiments
  let ux0 = Infinity, uy0 = Infinity, ux1 = -Infinity, uy1 = -Infinity;
  for (const b of world.buildings) {
    const size = ((b.type === "manoir" ? 3 : 2) / 2) * S.BSCALE + 0.3, h = ((HEIGHT[b.type] ?? 1.5) + 0.25 * (b.level || 1) + 0.6) * S.BSCALE;
    for (const dx of [-size, size])
      for (const dz of [-size, size])
        for (const hh of [0, h]) {
          const [sx, sy] = cam.project(b.wx + dx - (L[0] / L[1]) * hh, 0, b.wz + dz - (L[2] / L[1]) * hh);
          ux0 = Math.min(ux0, sx);
          ux1 = Math.max(ux1, sx);
          uy0 = Math.min(uy0, sy);
          uy1 = Math.max(uy1, sy);
        }
  }
  const ureg = [Math.max(0, Math.floor(ux0 - 4)), Math.max(0, Math.floor(uy0 - 4)), Math.min(W, Math.ceil(ux1 + 4)), Math.min(H, Math.ceil(uy1 + 4))];
  const uw = Math.max(0, ureg[2] - ureg[0]), uh = Math.max(0, ureg[3] - ureg[1]);
  // pour chaque pixel du sol : quel bâtiment lui fait de l'ombre (−1 : aucun)
  const caster = new Int32Array(uw * uh).fill(-1), umask = new Uint8Array(uw * uh);
  const objToId = new Map(world.buildings.map((b) => [b.obj, b.id]));
  for (let py = ureg[1]; py < ureg[3]; py++)
    for (let px = ureg[0]; px < ureg[2]; px++) {
      const d = bg.depth[py * W + px];
      if (!(d < 2)) continue;
      const nx = ((px + 0.5) / W) * 2 - 1, ny = 1 - ((py + 0.5) / H) * 2;
      const ww = inv[3] * nx + inv[7] * ny + inv[11] * d + inv[15];
      const wx = (inv[0] * nx + inv[4] * ny + inv[8] * d + inv[12]) / ww, wy = (inv[1] * nx + inv[5] * ny + inv[9] * d + inv[13]) / ww, wz = (inv[2] * nx + inv[6] * ny + inv[10] * d + inv[14]) / ww;
      for (const o of shadowCasters(world.env.shadow, wx, wy + 0.05, wz))
        if (objToId.has(o)) {
          const i = (py - ureg[1]) * uw + (px - ureg[0]);
          caster[i] = o;
          umask[i] = 1;
          break;
        }
    }
  // les numéros de la carte d'ombre ne servent plus (16 Mo)
  world.env.shadow.ids = null;
  // le même sol sans les ombres des bâtiments, calculé seulement pour ces pixels
  const litLayer = uw && uh ? render([world.static_], cam, { ...world.env, shadow: S.sunShadow(world, [], 2048) }, { ss, region: ureg, mask: umask }) : null;
  // le ciel passe sous le décor : plus besoin de le garder à part
  skyUnder(W, H, world.seed, [
    [bg, true],
    [litLayer, false],
  ]);
  const tShadow = Date.now() - t0 - tBg;
  // 2. calques des bâtiments, un par état et orientation, tous rendus d'avance
  const cache = new Map(), boxes = new Map();
  for (const b of world.buildings) boxes.set(b.id, screenBox(cam, b));
  const layerOf = (b, state, aim) => {
    const key = `${b.id}:${state}:${aim ?? ""}`;
    if (!cache.has(key)) {
      const mesh = state === "intact" && aim === null ? intact[b.idx] : S.buildingMesh(b, state, aim === null ? null : (aim / AIM_STEPS) * Math.PI * 2);
      cache.set(key, render([mesh], cam, world.env, { ss, region: boxes.get(b.id) }));
    }
    return cache.get(key);
  };
  const isDefense = (b) => b.type === "canon" || b.type === "mortier";
  const stateOf = (fr, b) => fr.states?.[b.id] ?? "intact";
  const aimOf = (fr, b) => (isDefense(b) && stateOf(fr, b) === "intact" && fr.aims && fr.aims[b.id] !== undefined ? ((Math.round((fr.aims[b.id] / (Math.PI * 2)) * AIM_STEPS) % AIM_STEPS) + AIM_STEPS) % AIM_STEPS : null);
  for (const fr of job.frames) for (const b of world.buildings) layerOf(b, stateOf(fr, b), aimOf(fr, b));
  // les soldats se contentent d'une carte d'ombre deux fois moins fine (16 Mo → 4 Mo) ; le reste de la préparation part au nettoyage
  world.env.shadow = halfShadow(world.env.shadow);
  nettoyer(true);
  const OW = job.out.w, OH = job.out.h;
  const oc = createCanvas(OW, OH), octx = oc.getContext("2d"), outImg = octx.createImageData(OW, OH);
  const work = { x0: 0, y0: 0, w: W, h: H, rgba: new Uint8ClampedArray(W * H * 4), depth: new Float32Array(W * H) };
  const row = new Float32Array(W * 3);
  let troopMs = 0;
  for (const fr of job.frames) {
    // décor (sans l'ombre des bâtiments détruits), puis les bâtiments dans leur état du moment
    work.rgba.set(bg.rgba);
    work.depth.set(bg.depth);
    const gone = new Set(world.buildings.filter((b) => stateOf(fr, b) !== "intact").map((b) => b.obj));
    if (gone.size && litLayer)
      for (let i = 0; i < caster.length; i++) {
        if (caster[i] < 0 || !gone.has(caster[i])) continue;
        const px = ureg[0] + (i % uw), py = ureg[1] + Math.floor(i / uw), li = ((py - litLayer.y0) * litLayer.w + (px - litLayer.x0)) * 4, di = (py * W + px) * 4;
        if (litLayer.rgba[li + 3]) for (let k = 0; k < 3; k++) work.rgba[di + k] = litLayer.rgba[li + k];
      }
    for (const b of world.buildings) composite(work, layerOf(b, stateOf(fr, b), aimOf(fr, b)));
    // soldats : ombre au sol, puis figurines
    const troops = fr.troops ?? [];
    if (troops.length) {
      const tt = Date.now();
      const m = new S.Mesh();
      m.setObj(50);
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const t of troops) {
        const [wx, , wz] = M3.gridToWorld(t.x, t.y);
        const [sx, sy] = cam.project(wx, 0, wz);
        const [, ty] = cam.project(wx, 2.0, wz);
        x0 = Math.min(x0, sx - 46);
        x1 = Math.max(x1, sx + 46);
        y0 = Math.min(y0, ty - 12);
        y1 = Math.max(y1, sy + 18);
        // ombre portée douce
        const rx = Math.abs(cam.project(wx + 0.42, 0, wz - 0.42)[0] - sx) + 2, ry = rx * 0.45;
        for (let yy = Math.floor(sy - ry); yy <= sy + ry; yy++)
          for (let xx = Math.floor(sx - rx); xx <= sx + rx; xx++) {
            if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
            const d = ((xx - sx) / rx) ** 2 + ((yy - sy) / ry) ** 2;
            if (d >= 1) continue;
            const i4 = (yy * W + xx) * 4, k = 1 - 0.45 * (1 - d);
            work.rgba[i4] *= k;
            work.rgba[i4 + 1] *= k;
            work.rgba[i4 + 2] *= k;
          }
        S.troopModel(m, { wx, wz, role: t.role, ring: t.ring, yaw: t.yaw ?? 0 }, t.phase ?? 0);
      }
      const tl = render([m.compile()], cam, world.env, { ss, region: [x0, y0, x1, y1] });
      composite(work, tl);
      troopMs += Date.now() - tt;
    }
    // recadrage de la caméra, puis atmosphère animée dessinée directement à la taille finale
    const crop = fr.crop ?? [0, 0, W, H], k = OW / crop[2];
    resampleCrop(work.rgba, W, H, crop, outImg.data, OW, OH, row);
    octx.putImageData(outImg, 0, 0);
    octx.setTransform(k, 0, 0, OH / crop[3], -crop[0] * k, (-crop[1] * OH) / crop[3]);
    paintWaterfall(octx, cam, world, fr.t ?? 0);
    paintBirds(octx, W, H, world.seed, fr.t ?? 0);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    paintLight(octx, OW, OH);
    yield octx.getImageData(0, 0, OW, OH).data;
  }
  return { bg: tBg, ombres: tShadow, total: Date.now() - t0, troops: troopMs, layers: cache.size };
}
// onFrame(RGBA) reçoit chaque image ; entre deux images, une courte pause rend la mémoire du canvas
async function renderBattle(job, onFrame = null) {
  const it = battleFrames(job), frames = [];
  for (let r = it.next(); ; r = it.next()) {
    if (r.done) return { frames, stats: r.value };
    if (onFrame) onFrame(r.value);
    else frames.push(r.value);
    await respirer();
  }
}

module.exports = { renderBase, renderBattle, battleFrames, paintSky, anchorsOf };

// ============================================================
// Icônes 3D de l'interface (pièce d'or, cristal, trophée, étoile, bouclier, marteau)
// ============================================================
function iconMesh(name) {
  const m = new S.Mesh(), MI = S.MI;
  m.setObj(1);
  if (name === "coin") {
    m.push().rotZ(-0.42).rotX(1.0);
    m.setMat(MI.gold).cyl(1, 0.24, { seg: 36, y0: -0.12, bottom: true });
    m.setMat(MI.goldDark).push().translate(0, 0.12, 0).torus(0.84, 0.05, { seg: 36, tube: 6 }).pop();
    // un « M » en relief
    m.setMat(MI.goldDark);
    m.box(-0.45, 0.12, -0.42, -0.3, 0.2, 0.42).box(0.3, 0.12, -0.42, 0.45, 0.2, 0.42);
    m.push().translate(-0.2, 0.12, -0.08).rotY(0.62).box(-0.075, 0, -0.38, 0.075, 0.08, 0.38).pop();
    m.push().translate(0.2, 0.12, -0.08).rotY(-0.62).box(-0.075, 0, -0.38, 0.075, 0.08, 0.38).pop();
    m.pop();
  } else if (name === "crystal") {
    m.push().rotZ(0.18);
    m.setMat(MI.purpleCrystal).cyl(0.62, 1.15, { r2: 0, seg: 6, smooth: false, y0: 0.15 });
    m.setMat(MI.purpleCrystal).cyl(0.62, 0.15, { seg: 6, smooth: false, top: false });
    m.setMat(MI.purpleCrystal).push().rotX(Math.PI).cyl(0.62, 0.85, { r2: 0, seg: 6, smooth: false, top: false }).pop();
    m.pop();
  } else if (name === "trophy") {
    m.push().translate(0, -0.95, 0);
    m.setMat(MI.woodDark).box(-0.55, 0, -0.42, 0.55, 0.28, 0.42);
    m.setMat(MI.gold).box(-0.42, 0.28, -0.32, 0.42, 0.36, 0.32);
    m.setMat(MI.gold).push().translate(0, 0.36, 0).cyl(0.1, 0.42, { seg: 12 }).pop();
    m.setMat(MI.gold).push().translate(0, 0.78, 0).sphere(0.62, { seg: 22, rings: 10, hemi: true, sy: -0.9 }).pop();
    m.setMat(MI.gold).push().translate(0, 0.78, 0).cyl(0.62, 0.6, { r2: 0.78, seg: 22, top: false }).pop();
    m.setMat(MI.goldDark).push().translate(0, 1.36, 0).torus(0.76, 0.05, { seg: 22, tube: 6 }).pop();
    m.setMat(MI.ironDark).push().translate(0, 1.35, 0).cyl(0.72, 0.01, { seg: 22 }).pop();
    for (const s of [-1, 1]) m.setMat(MI.gold).push().translate(s * 0.82, 1.05, 0).rotX(Math.PI / 2).torus(0.24, 0.06, { seg: 14, tube: 6 }).pop();
    m.pop();
  } else if (name === "star" || name === "starOff") {
    const pts = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 0.45 : 1.08;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    m.push().rotY(0.3).rotX(Math.PI / 2 - 0.2);
    m.setMat(name === "star" ? MI.gold : MI.ironDark).extrude(pts, -0.16, 0.16, { center: true });
    m.pop();
  } else if (name === "shield") {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI;
      pts.push([Math.cos(a) * 0.85, 0.2 + Math.sin(a) * 0.95]);
    }
    pts.push([-0.85, -0.85], [0.85, -0.85]);
    m.push().rotY(0.3).rotX(Math.PI / 2 - 0.15);
    m.setMat(MI.flagBlue).extrude(pts, -0.1, 0.1, { center: true });
    m.setMat(MI.gold).box(-0.1, 0.1, -1.05, 0.1, 0.16, 0.8).box(-0.6, 0.1, -0.1, 0.6, 0.16, 0.1);
    m.pop();
  } else if (name === "hammer") {
    m.push().rotZ(0.75).rotY(0.4);
    m.setMat(MI.wood).cyl(0.09, 1.9, { seg: 10, y0: -1.0 });
    m.setMat(MI.iron).box(-0.55, 0.62, -0.22, 0.55, 1.02, 0.22);
    m.setMat(MI.steel).box(-0.6, 0.6, -0.24, -0.5, 1.04, 0.24).box(0.5, 0.6, -0.24, 0.6, 1.04, 0.24);
    m.setMat(MI.leather).push().translate(0, -0.95, 0).cyl(0.11, 0.6, { seg: 10 }).pop();
    m.pop();
  }
  return m.compile();
}
function renderIcons(job = {}) {
  const size = job.size ?? 128, names = job.names ?? ["coin", "crystal", "trophy", "star", "starOff", "shield", "hammer"];
  const out = {};
  const env = {
    mats: S.MATS,
    eye: [0, 0, 0],
    sun: { dir: M3.norm([-0.55, 0.75, 0.55]), color: [2.6, 2.3, 1.9] },
    shadow: null,
    sky: [0.75, 0.8, 0.95],
    ground: [0.35, 0.28, 0.2],
    horizon: [1.2, 1.0, 0.8],
    fog: null,
    exposure: 1.15,
    terrain: null,
  };
  for (const name of names) {
    const cam = M3.makeCamera({ target: [0, 0, 0], azimuth: 0.35, elevation: 0.3, distance: 9, fov: 0.27, width: size, height: size });
    env.eye = cam.eye;
    const layer = render([iconMesh(name)], cam, env, { ss: 4 });
    const data = new Uint8ClampedArray(size * size * 4);
    data.set(layer.rgba);
    out[name] = { data, width: size, height: size };
  }
  return out;
}
module.exports.renderIcons = renderIcons;
