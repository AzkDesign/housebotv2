
// --- L'île, dessin poussé : lumière, matières, végétation dessinée à la main ---
// Remplace la scène de 50-ile-design.js. Vue en 3/4 : mer en profondeur avec le reflet du soleil,
// haut-fond transparent (sable et reflets lumineux visibles), écume, sable mouillé puis sec, plateau d'herbe
// en relief avec sa falaise, rochers ombrés, palmiers / sapins / cerisiers / arbres morts selon le skin,
// buissons fleuris, ponton et barque, nuages volumineux, îles lointaines dans la brume.
const ISLE_ART = {
  ile_tropique: { tree: "palm", leaf: ["#166534", "#4ade80"], trunk: ["#78350f", "#c2814b"], bush: ["#15803d", "#86efac"], flower: ["#f472b6", "#facc15", "#fb7185"], rock: ["#6b7280", "#d1d5db"], cliff: ["#92400e", "#d6a067"], dock: true },
  ile_nuit: { tree: "palm", leaf: ["#052e16", "#15803d"], trunk: ["#3b1d0a", "#7c4a24"], bush: ["#052e16", "#166534"], flower: ["#67e8f9", "#a5f3fc"], rock: ["#1e293b", "#64748b"], cliff: ["#1c1917", "#57534e"], dock: true, night: true },
  ile_volcan: { tree: "palm", leaf: ["#1a2e05", "#4d7c0f"], trunk: ["#1c1917", "#57534e"], bush: ["#1a2e05", "#3f6212"], flower: ["#f97316", "#facc15"], rock: ["#0c0a09", "#57534e"], cliff: ["#0c0a09", "#44403c"], lava: true },
  ile_banquise: { tree: "pine", leaf: ["#14532d", "#22c55e"], trunk: ["#3b1d0a", "#78350f"], bush: ["#bae6fd", "#ffffff"], flower: [], rock: ["#7dd3fc", "#f0f9ff"], cliff: ["#7dd3fc", "#e0f2fe"], snow: true },
  ile_sakura: { tree: "sakura", leaf: ["#be185d", "#fbcfe8"], trunk: ["#3b1d0a", "#7c4a24"], bush: ["#15803d", "#86efac"], flower: ["#f9a8d4", "#ffffff"], rock: ["#57534e", "#d6d3d1"], cliff: ["#78350f", "#c2814b"], dock: true },
  ile_moai: { tree: "none", leaf: ["#365314", "#84cc16"], trunk: ["#3b1d0a", "#78350f"], bush: ["#365314", "#a3e635"], flower: ["#fde68a"], rock: ["#44403c", "#a8a29e"], cliff: ["#44403c", "#a8a29e"] },
  ile_tresor: { tree: "palm", leaf: ["#166534", "#4ade80"], trunk: ["#78350f", "#c2814b"], bush: ["#15803d", "#86efac"], flower: ["#fbbf24", "#f87171"], rock: ["#57534e", "#d6d3d1"], cliff: ["#92400e", "#d6a067"], dock: true },
  ile_paradis: { tree: "palm", leaf: ["#3f6212", "#bef264"], trunk: ["#92400e", "#fbbf24"], bush: ["#3f6212", "#bef264"], flower: ["#fde68a", "#ffffff", "#f472b6"], rock: ["#a16207", "#fef3c7"], cliff: ["#a16207", "#fde68a"], dock: true },
  ile_hantee: { tree: "dead", leaf: ["#18181b", "#3f3f46"], trunk: ["#09090b", "#3f3f46"], bush: ["#18181b", "#3f3f46"], flower: ["#a78bfa"], rock: ["#18181b", "#52525b"], cliff: ["#09090b", "#3f3f46"], fogGround: true },
};
// sommets d'une forme organique (rx, ry : rayons ; rough : irrégularité)
function isleShape(cx, cy, rx, ry, seed, rough = 0.12, n = 72) {
  const R = seeded(seed), w = Array.from({ length: 4 }, (_, k) => [2 + k * 1.3 + R() * 1.5, R() * TAU, (R() * 0.6 + 0.4) / (k + 1)]);
  return Array.from({ length: n }, (_, k) => {
    const a = (k / n) * TAU, m = 1 + rough * w.reduce((s, [f, p, amp]) => s + Math.sin(a * f + p) * amp, 0);
    return [cx + Math.cos(a) * rx * m, cy + Math.sin(a) * ry * m];
  });
}
function islePath(ctx, pts) {
  const n = pts.length, mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  ctx.beginPath();
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let k = 0; k < n; k++) {
    const m = mid(pts[k], pts[(k + 1) % n]);
    ctx.quadraticCurveTo(pts[k][0], pts[k][1], m[0], m[1]);
  }
  ctx.closePath();
}
// nuage volumineux : boules éclairées par le haut, ombrées par le bas
function isleCloud(ctx, x, y, w, seed, light, shade, alpha) {
  const R = seeded(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  const puffs = Array.from({ length: 16 }, (_, k) => [x + (k / 15 - 0.5) * w + (R() - 0.5) * w * 0.12, y - Math.sin((k / 15) * Math.PI) * w * 0.12 * (0.5 + R() * 0.7), w * (0.07 + R() * 0.07)]);
  // volutes douces : un voile sombre dessous, la lumière dessus
  for (const [px, py, r] of puffs) glow(ctx, px, py + r * 0.35, r * 1.7, shade, 0.45);
  for (const [px, py, r] of puffs) glow(ctx, px, py - r * 0.15, r * 1.45, light, 0.75);
  ctx.restore();
}
// rocher : facettes éclairées en haut à gauche, ombre portée
function isleRock(ctx, x, y, s, seed, [dark, light]) {
  const R = seeded(seed), n = 7 + Math.floor(R() * 3), pts = [];
  for (let k = 0; k < n; k++) {
    const a = Math.PI + (k / (n - 1)) * Math.PI, r = s * (0.7 + R() * 0.4);
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r * (0.8 + R() * 0.4)]);
  }
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(x + s * 0.25, y + s * 0.05, s * 1.15, s * 0.22, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const g = ctx.createLinearGradient(x - s, y - s, x + s, y);
  g.addColorStop(0, light);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = rgba(light, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  pts.slice(0, Math.ceil(n / 2)).forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
}
// buisson : touffes de feuilles ombrées, fleurs
function isleBush(ctx, x, y, s, seed, [dark, light], flowers = []) {
  const R = seeded(seed);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x + s * 0.2, y + s * 0.1, s * 1.1, s * 0.25, 0, 0, TAU);
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const px = x + (R() - 0.5) * s * 1.4, py = y - R() * s * 0.8, r = s * (0.35 + R() * 0.3);
    const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.45, r * 0.1, px, py, r);
    g.addColorStop(0, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
  }
  for (let k = 0; k < flowers.length * 3; k++) disc(ctx, x + (R() - 0.5) * s * 1.3, y - R() * s * 0.9, s * 0.07 + R() * s * 0.05, flowers[k % flowers.length]);
}
// palmier : tronc annelé et courbé, palmes effilées avec folioles, noix de coco
function islePalm(ctx, x, y, h, lean, seed, A, night = false) {
  const R = seeded(seed), tx = x + lean * h * 0.45, ty = y - h, cxp = x + lean * h * 0.05, cyp = y - h * 0.55;
  // ombre au sol
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x - h * 0.25, y + 4, h * 0.38, h * 0.07, -0.1, 0, TAU);
  ctx.fill();
  // tronc
  const seg = 16;
  for (let k = 0; k < seg; k++) {
    const t0 = k / seg, t1 = (k + 1) / seg, P = (t) => [(1 - t) ** 2 * x + 2 * (1 - t) * t * cxp + t * t * tx, (1 - t) ** 2 * y + 2 * (1 - t) * t * cyp + t * t * ty];
    const [x0, y0] = P(t0), [x1, y1] = P(t1), w0 = h * (0.075 - 0.035 * t0), w1 = h * (0.075 - 0.035 * t1);
    const g = ctx.createLinearGradient(x0 - w0, 0, x0 + w0, 0);
    g.addColorStop(0, A.trunk[1]);
    g.addColorStop(0.6, A.trunk[0]);
    g.addColorStop(1, shade(A.trunk[0], 0.6));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - w0, y0);
    ctx.lineTo(x1 - w1, y1 + 1);
    ctx.lineTo(x1 + w1, y1 + 1);
    ctx.lineTo(x0 + w0, y0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x1 - w1, y1);
    ctx.quadraticCurveTo(x1, y1 + 3, x1 + w1, y1);
    ctx.stroke();
  }
  // palmes
  const n = 9;
  for (let k = 0; k < n; k++) {
    const a = -Math.PI / 2 + ((k / (n - 1)) - 0.5) * 3.6 + (R() - 0.5) * 0.2, L = h * (0.55 + R() * 0.2), droop = 0.55 + R() * 0.35;
    const pts = [];
    for (let j = 0; j <= 14; j++) {
      const t = j / 14, ang = a + Math.sign(Math.cos(a)) * droop * t * t * 1.6;
      pts.push([tx + Math.cos(a) * L * t * 0.9 + (Math.cos(ang) - Math.cos(a)) * L * t * 0.4, ty + Math.sin(a) * L * t * 0.55 + droop * L * t * t * 0.55]);
    }
    // folioles
    ctx.lineCap = "round";
    for (let j = 1; j < pts.length - 1; j++) {
      const [px, py] = pts[j], [qx, qy] = pts[j + 1], dx = qx - px, dy = qy - py, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, w = h * 0.1 * Math.sin((j / 14) * Math.PI) + 2;
      for (const sgn of [-1, 1]) {
        ctx.strokeStyle = sgn < 0 ? A.leaf[1] : A.leaf[0];
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + nx * w * sgn + dx * 0.8, py + ny * w * sgn + dy * 0.8 + w * 0.45);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = shade(A.leaf[0], 0.8);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    pts.forEach(([px, py], j) => (j ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  // noix de coco
  for (let k = 0; k < 3; k++) {
    const cx2 = tx + (k - 1) * h * 0.045, cy2 = ty + h * 0.035 + (k % 2) * 4, r = h * 0.03;
    const g = ctx.createRadialGradient(cx2 - r * 0.3, cy2 - r * 0.3, 1, cx2, cy2, r);
    g.addColorStop(0, night ? "#57534e" : "#a16207");
    g.addColorStop(1, "#3b1d0a");
    disc(ctx, cx2, cy2, r, g);
  }
}
// sapin enneigé : étages de branches, neige sur le dessus
function islePine(ctx, x, y, h, seed, A) {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(x - h * 0.15, y + 3, h * 0.3, h * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = A.trunk[0];
  ctx.fillRect(x - h * 0.03, y - h * 0.15, h * 0.06, h * 0.16);
  for (let k = 0; k < 5; k++) {
    const t = k / 5, w = h * (0.34 - t * 0.055), yy = y - h * 0.12 - t * h * 0.17, top = yy - h * 0.26;
    const g = ctx.createLinearGradient(x - w, 0, x + w, 0);
    g.addColorStop(0, A.leaf[1]);
    g.addColorStop(1, A.leaf[0]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w, yy);
    ctx.quadraticCurveTo(x, yy + h * 0.04, x - w, yy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + w * 0.55, yy - h * 0.1);
    ctx.quadraticCurveTo(x, yy - h * 0.06, x - w * 0.6, yy - h * 0.09);
    ctx.closePath();
    ctx.fill();
  }
}
// arbre en fleurs (cerisier) ou arbre mort (île hantée) : branches récursives
function isleBranch(ctx, x, y, len, ang, depth, w, R, A, blossom) {
  const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
  ctx.strokeStyle = A.trunk[depth > 2 ? 0 : 1];
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + Math.cos(ang + 0.3) * len * 0.5, y + Math.sin(ang + 0.3) * len * 0.5, ex, ey);
  ctx.stroke();
  if (depth <= 0) {
    if (blossom) isleBush(ctx, ex, ey + len * 0.3, len * 0.7, Math.floor(R() * 1e6), A.leaf, ["#ffffff", "#fbcfe8"]);
    return;
  }
  for (const d of [-0.45 - R() * 0.25, 0.4 + R() * 0.3]) isleBranch(ctx, ex, ey, len * (0.66 + R() * 0.12), ang + d, depth - 1, w * 0.62, R, A, blossom);
}
function isleTree(ctx, x, y, h, seed, A, blossom) {
  const R = seeded(seed);
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(x - h * 0.2, y + 4, h * 0.42, h * 0.07, 0, 0, TAU);
  ctx.fill();
  isleBranch(ctx, x, y, h * 0.36, -Math.PI / 2 + (R() - 0.5) * 0.2, 4, h * 0.07, R, A, blossom);
}
// ponton de bois qui avance dans l'eau, avec sa barque
function isleDock(ctx, x, y, len, ang) {
  const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, w = 34;
  for (let k = 0; k < 10; k++) {
    const t = k / 10, px = x + dx * len * t, py = y + dy * len * t * 0.55;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#3b1d0a";
      ctx.fillRect(px + nx * w * 0.5 * s - 3, py + ny * w * 0.25 * s, 6, 26);
    }
  }
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.moveTo(x + nx * w * 0.5, y + 24);
  ctx.lineTo(x + dx * len + nx * w * 0.5, y + dy * len * 0.55 + 24);
  ctx.lineTo(x + dx * len - nx * w * 0.5, y + dy * len * 0.55 + 24);
  ctx.lineTo(x - nx * w * 0.5, y + 24);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 14; k++) {
    const t0 = k / 14, t1 = (k + 0.9) / 14;
    const p = (t, s) => [x + dx * len * t + nx * w * 0.5 * s, y + dy * len * t * 0.55 + ny * w * 0.25 * s];
    const [ax, ay] = p(t0, -1), [bx, by] = p(t1, -1), [cx2, cy2] = p(t1, 1), [ddx, ddy] = p(t0, 1);
    ctx.fillStyle = k % 2 ? "#a16207" : "#92400e";
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(ddx, ddy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // barque
  const bx = x + dx * len * 0.75 + nx * 58, by = y + dy * len * 0.75 * 0.55 + ny * 30 + 20;
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(bx, by + 10, 52, 9, 0.15, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(0.15);
  ctx.fillStyle = "#7c2d12";
  ctx.beginPath();
  ctx.moveTo(-50, -6);
  ctx.quadraticCurveTo(0, 18, 50, -6);
  ctx.lineTo(42, -12);
  ctx.quadraticCurveTo(0, 2, -42, -12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#c2410c";
  ctx.beginPath();
  ctx.moveTo(-42, -12);
  ctx.quadraticCurveTo(0, 2, 42, -12);
  ctx.quadraticCurveTo(0, -4, -42, -12);
  ctx.fill();
  ctx.restore();
}

async function drawIslandScenePro(skinId, W, H, cx, cy, R) {
  const key = `pro:${skinId}:${W}x${H}:${cx}:${cy}:${R}`;
  if (isleSceneCache.has(key)) return isleSceneCache.get(key);
  const S = ISLE_SKINS[skinId] ?? ISLE_SKINS[ISLE_DEFAULT], A = ISLE_ART[skinId] ?? ISLE_ART[ISLE_DEFAULT];
  const c = createCanvas(W, H), ctx = c.getContext("2d"), Rn = seeded(hashOf(skinId) + 3);
  ctx.imageSmoothingQuality = "high";
  const hz = Math.round(H * 0.42), b = S.body, bx = W * b.x, by = hz * b.y * 2;
  // --- ciel ---
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  S.sky.forEach((col, i) => sky.addColorStop(i / (S.sky.length - 1), col));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hz + 2);
  if (S.stars) for (let k = 0; k < 260; k++) disc(ctx, Rn() * W, Rn() * hz * 0.95, Rn() * 1.3 + 0.3, `rgba(255,255,255,${0.25 + Rn() * 0.75})`);
  if (S.aurora)
    for (const [band, col] of [[0, "#34d399"], [1, "#22d3ee"], [2, "#a78bfa"]])
      for (let x = 0; x < W; x += 3) {
        const y = hz * 0.1 + band * 24 + Math.sin(x * 0.005 + band) * 30, hh = 70 + Math.sin(x * 0.02 + band * 2) * 26 + 24;
        const g = ctx.createLinearGradient(0, y, 0, y + hh);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.4, rgba(col, 0.28));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 3, hh);
      }
  // astre, halo et rayons
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, bx, by, b.r * 8, b.color, 0.45);
  if (b.kind === "sun") {
    ctx.translate(bx, by);
    for (let k = 0; k < 14; k++) {
      ctx.rotate(TAU / 14);
      ctx.fillStyle = rgba(b.color, 0.07);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, -W);
      ctx.lineTo(30, -W);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
  if (b.kind === "moon") {
    disc(ctx, bx, by, b.r, b.color);
    const R2 = seeded(5);
    for (let k = 0; k < 7; k++) disc(ctx, bx + (R2() - 0.5) * b.r * 1.2, by + (R2() - 0.5) * b.r * 1.2, b.r * (0.08 + R2() * 0.14), "rgba(100,116,139,0.25)");
  } else {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.75, b.color);
    g.addColorStop(1, rgba(b.color, 0.5));
    disc(ctx, bx, by, b.r, g);
  }
  // nuages volumineux
  const cl = S.clouds, dark = A.night || S.stars;
  for (let k = 0; k < 5; k++) isleCloud(ctx, Rn() * W, hz * (0.3 + Rn() * 0.5), 160 + Rn() * 200, k * 31 + 7, dark ? "#64748b" : "#ffffff", cl, dark ? 0.5 : 0.85);
  // îles lointaines dans la brume
  for (let k = 0; k < 4; k++) {
    const x = Rn() * W, w = 140 + Rn() * 240, h = 18 + Rn() * 34;
    ctx.fillStyle = rgba(S.sea[1], 0.55);
    ctx.beginPath();
    ctx.moveTo(x - w, hz + 1);
    ctx.quadraticCurveTo(x - w * 0.3, hz - h * 1.3, x, hz - h);
    ctx.quadraticCurveTo(x + w * 0.4, hz - h * 1.2, x + w, hz + 1);
    ctx.closePath();
    ctx.fill();
  }
  const haze = ctx.createLinearGradient(0, hz - 40, 0, hz + 30);
  haze.addColorStop(0, rgba(S.sky[S.sky.length - 1], 0));
  haze.addColorStop(0.6, rgba(S.sky[S.sky.length - 1], 0.55));
  haze.addColorStop(1, rgba(S.sky[S.sky.length - 1], 0));
  ctx.fillStyle = haze;
  ctx.fillRect(0, hz - 40, W, 70);
  // --- la mer ---
  const sea = ctx.createLinearGradient(0, hz, 0, H);
  sea.addColorStop(0, S.sea[0]);
  sea.addColorStop(0.35, S.sea[1]);
  sea.addColorStop(1, S.sea[2]);
  ctx.fillStyle = sea;
  ctx.fillRect(0, hz, W, H - hz);
  // houle : grandes bandes claires et sombres, serrées vers l'horizon
  for (let k = 0; k < 60; k++) {
    const t = k / 60, y = hz + (H - hz) * t * t;
    ctx.fillStyle = k % 2 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(0, y, W, 2 + t * 8);
  }
  // chemin de lumière de l'astre sur l'eau
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 260; k++) {
    const t = Rn(), y = hz + 3 + (H - hz) * t * t, spread = 20 + t * 220, x = bx + (Rn() - 0.5) * spread * (0.5 + Rn()), len = 4 + t * 26;
    ctx.fillStyle = rgba(b.color, (0.2 + Rn() * 0.5) * (1 - Math.abs(x - bx) / (spread * 1.2)));
    ctx.fillRect(x, y, len, 1.2 + t * 2);
  }
  ctx.restore();
  // vaguelettes
  for (let k = 0; k < 160; k++) {
    const t = Rn(), y = hz + 6 + (H - hz) * t * t, x = Rn() * W, len = 6 + t * 44;
    ctx.strokeStyle = `rgba(255,255,255,${0.06 + t * 0.16})`;
    ctx.lineWidth = 1 + t * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y - 2 - t * 4, x + len, y);
    ctx.stroke();
  }
  if (S.glowSea) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 120; k++) glow(ctx, Rn() * W, hz + 10 + (H - hz) * Rn(), 5 + Rn() * 12, S.glowSea, 0.5);
    ctx.restore();
  }
  // décor lointain (bateaux, mont Fuji…)
  for (const [name, fx, size] of S.far ?? []) {
    const img = await isleImg(name), s = W * size;
    if (img) ctx.drawImage(img, W * fx - s / 2, (name === "Bat" ? hz * 0.6 : hz) - s * (name === "Mount fuji" ? 0.92 : 0.78), s, s);
  }
  // --- l'île ---
  const ry = R * 0.3, shelf = isleShape(cx, cy + ry * 0.12, R * 1.42, ry * 1.62, 21, 0.1), beach = isleShape(cx, cy, R, ry, 22, 0.13), wet = isleShape(cx, cy + 2, R * 1.03, ry * 1.06, 22, 0.13);
  // haut-fond : eau claire au-dessus du sable
  islePath(ctx, shelf);
  const sh = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy + ry * 0.3, R * 1.45);
  sh.addColorStop(0, rgba(S.lagoon, 0.95));
  sh.addColorStop(0.7, rgba(S.lagoon, 0.55));
  sh.addColorStop(1, rgba(S.lagoon, 0));
  ctx.fillStyle = sh;
  ctx.fill();
  // reflets lumineux au fond de l'eau (caustiques)
  ctx.save();
  islePath(ctx, shelf);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.4;
  const Rc = seeded(9);
  for (let k = 0; k < 140; k++) {
    const x = cx + (Rc() - 0.5) * R * 3, y = cy + (Rc() - 0.4) * ry * 3.2, s = 10 + Rc() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.25, x + s, y + (Rc() - 0.5) * 6);
    ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.3, x + s * 0.3, y + s * 0.35);
    ctx.stroke();
  }
  ctx.restore();
  // écume : deux lignes irrégulières
  for (const [k, a, lw] of [[1.13, 0.12, 10], [1.13, 0.4, 1.6], [1.05, 0.22, 12], [1.05, 0.9, 2.6]]) {
    islePath(ctx, isleShape(cx, cy + 4, R * k, ry * k * 1.06, 22 + Math.round(k * 10), 0.14));
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
  // sable mouillé, puis sable sec éclairé par le haut
  islePath(ctx, wet);
  ctx.fillStyle = S.sand[2];
  ctx.fill();
  islePath(ctx, beach);
  const sg = ctx.createLinearGradient(cx - R * 0.6, cy - ry, cx + R * 0.4, cy + ry);
  sg.addColorStop(0, S.sand[0]);
  sg.addColorStop(1, S.sand[1]);
  ctx.fillStyle = sg;
  ctx.fill();
  // grains et coquillages
  const Rs = seeded(17);
  for (let k = 0; k < 220; k++) {
    const a = Rs() * TAU, d = Math.sqrt(Rs()), x = cx + Math.cos(a) * R * 0.95 * d, y = cy + Math.sin(a) * ry * 0.95 * d;
    disc(ctx, x, y, 0.8 + Rs() * 1.4, Rs() < 0.5 ? rgba(S.sand[2], 0.35) : "rgba(255,255,255,0.35)");
  }
  // plateau d'herbe en relief : falaise puis dessus
  const lift = R * 0.07, plate = isleShape(cx - R * 0.06, cy - ry * 0.18, R * 0.66, ry * 0.58, 23, 0.16);
  ctx.save();
  ctx.translate(0, 0);
  islePath(ctx, plate);
  const cg = ctx.createLinearGradient(0, cy - ry * 0.6, 0, cy + ry * 0.5);
  cg.addColorStop(0, A.cliff[1]);
  cg.addColorStop(1, A.cliff[0]);
  ctx.fillStyle = cg;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(0, -lift);
  islePath(ctx, plate);
  const gg = ctx.createRadialGradient(cx - R * 0.25, cy - ry * 0.6, 10, cx, cy - ry * 0.1, R * 0.75);
  gg.addColorStop(0, S.grass[0]);
  gg.addColorStop(1, S.grass[1]);
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.strokeStyle = rgba(S.grass[0], 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  // brins d'herbe
  const Rg = seeded(27);
  for (let k = 0; k < 260; k++) {
    const a = Rg() * TAU, d = Math.sqrt(Rg()) * 0.9, x = cx - R * 0.06 + Math.cos(a) * R * 0.62 * d, y = cy - ry * 0.18 + Math.sin(a) * ry * 0.5 * d;
    ctx.strokeStyle = Rg() < 0.5 ? rgba(S.grass[0], 0.8) : rgba(S.grass[1], 0.6);
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Rg() - 0.5) * 4, y - 3 - Rg() * 6);
    ctx.stroke();
  }
  ctx.restore();
  if (A.lava) {
    const Rl = seeded(41);
    for (let k = 0; k < 9; k++) {
      let x = cx + (Rl() - 0.5) * R * 1.2, y = cy + (Rl() - 0.3) * ry * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 6; j++) ctx.lineTo((x += (Rl() - 0.5) * 30), (y += 4 + Rl() * 8));
      ctx.strokeStyle = "rgba(249,115,22,0.35)";
      ctx.lineWidth = 7;
      ctx.stroke();
      ctx.strokeStyle = "#fdba74";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  if (A.fogGround) glow(ctx, cx, cy, R * 1.3, "#c4b5fd", 0.08);
  // ponton
  if (A.dock) isleDock(ctx, cx + R * 0.62, cy + ry * 0.55, R * 0.75, 0.35);
  // --- végétation, rochers et décor du skin, de l'arrière vers l'avant ---
  const items = [];
  const treeSpots = [[-0.55, -0.45, 1], [-0.3, -0.7, 0.9], [0.3, -0.62, 0.95], [0.55, -0.3, 0.85], [-0.75, -0.05, 0.75]];
  if (A.tree !== "none") for (const [ox, oy, s] of treeSpots) items.push({ y: cy + oy * ry, draw: () => {
    const x = cx + ox * R, y = cy + oy * ry - lift * 0.6, h = R * 0.62 * s;
    if (A.tree === "palm") islePalm(ctx, x, y, h, ox < 0 ? -0.5 : 0.5, Math.round(ox * 100 + 7), A, A.night);
    else if (A.tree === "pine") islePine(ctx, x, y, h * 0.9, Math.round(ox * 100), A);
    else isleTree(ctx, x, y, h * 0.9, Math.round(ox * 100 + 3), A, A.tree === "sakura");
  } });
  for (const [ox, oy, s] of [[-0.2, -0.35, 0.16], [0.12, -0.45, 0.13], [0.62, 0.05, 0.12], [-0.62, 0.3, 0.11], [0.05, -0.15, 0.1]]) items.push({ y: cy + oy * ry, draw: () => isleBush(ctx, cx + ox * R, cy + oy * ry - lift * 0.5, R * s, Math.round(ox * 1000 + 5), A.bush, A.flower) });
  for (const [ox, oy, s] of [[-0.88, 0.25, 0.09], [0.86, 0.32, 0.07], [-0.4, 0.82, 0.06], [0.95, -0.1, 0.06]]) items.push({ y: cy + oy * ry, draw: () => isleRock(ctx, cx + ox * R, cy + oy * ry, R * s, Math.round(ox * 1000 + 11), A.rock) });
  // décor du skin (émojis 3D), hors arbres déjà dessinés
  const sig = (S.props ?? []).filter(([name]) => !["Palm tree", "Evergreen tree", "Cherry blossom", "Rock", "Hibiscus", "Coconut"].includes(name));
  sig.forEach(([name, ox, size], k) => {
    const oy = size >= 0.5 ? -0.45 : 0.25 + (k % 2) * 0.2;
    items.push({ y: cy + oy * ry, draw: async () => {
      const img = await isleImg(name);
      if (!img) return;
      const s = R * size * 0.6, x = cx + ox * R * 0.9, y = cy + oy * ry - (size >= 0.5 ? lift : 0);
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x + s * 0.12, y + 2, s * 0.36, s * 0.08, 0, 0, TAU);
      ctx.fill();
      ctx.drawImage(img, x - s / 2, y - s * 0.95, s, s);
    } });
  });
  items.sort((p, q) => p.y - q.y);
  for (const it of items) await it.draw();
  // --- particules et lumière finale ---
  const Rp = seeded(hashOf(skinId) + 7);
  if (S.fx === "embers") for (let k = 0; k < 80; k++) glow(ctx, Rp() * W, Rp() * H * 0.95, 3 + Rp() * 4, "#fdba74", 0.9);
  if (S.fx === "snow") for (let k = 0; k < 160; k++) disc(ctx, Rp() * W, Rp() * H, Rp() * 2.2 + 0.6, `rgba(255,255,255,${0.5 + Rp() * 0.5})`);
  if (S.fx === "fireflies") for (let k = 0; k < 45; k++) {
    const x = cx + (Rp() - 0.5) * R * 2.6, y = cy - Rp() * R * 0.95;
    glow(ctx, x, y, 11, "#fde68a", 0.85);
    disc(ctx, x, y, 1.6, "#ffffff");
  }
  if (S.fx === "petals")
    for (let k = 0; k < 90; k++) {
      ctx.save();
      ctx.translate(Rp() * W, Rp() * H);
      ctx.rotate(Rp() * TAU);
      ctx.fillStyle = `rgba(251,207,232,${0.6 + Rp() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 + Rp() * 3, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  if (S.fx === "sparkles") for (let k = 0; k < 60; k++) sparkle(ctx, Rp() * W, Rp() * H * 0.95, 1.5 + Rp() * 3, `rgba(255,247,214,${0.5 + Rp() * 0.5})`);
  if (S.fx === "birds") {
    ctx.strokeStyle = "rgba(15,23,42,0.55)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const x = W * (0.25 + Rp() * 0.5), y = hz * (0.25 + Rp() * 0.4), s = 6 + Rp() * 7;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y);
      ctx.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y);
      ctx.stroke();
    }
  }
  if (S.fx === "fog") for (let k = 0; k < 12; k++) glow(ctx, Rp() * W, hz + Rp() * (H - hz), 120 + Rp() * 160, "#c4b5fd", 0.06);
  // étalonnage : lumière chaude côté astre, vignette
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const grade = ctx.createLinearGradient(bx, by, W - bx, H);
  grade.addColorStop(0, rgba(b.color, 0.55));
  grade.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = grade;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  isleSceneCache.set(key, c);
  if (isleSceneCache.size > 12) isleSceneCache.delete(isleSceneCache.keys().next().value);
  return c;
}
// socle de pierre sous une carte de la défense
function islePlinth(ctx, x, y, w, color) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + 8, y + 22, w * 0.62, 14, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - 6, 0, y + 22);
  g.addColorStop(0, "#e7e5e4");
  g.addColorStop(1, "#57534e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y + 12, w * 0.55, 12, 0, 0, Math.PI);
  ctx.lineTo(x - w * 0.55, y);
  ctx.ellipse(x, y, w * 0.55, 12, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d6d3d1";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.55, 12, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, x, y, w * 0.6, color, 0.7);
  ctx.restore();
  ctx.strokeStyle = rgba(color, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.42, 8, 0, 0, TAU);
  ctx.stroke();
}
{
  drawIslandScene = drawIslandScenePro;
}
