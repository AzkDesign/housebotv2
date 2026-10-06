
// --- Clash de la Maison : rendu isométrique ---
// La base est une île flottante vue en 3D isométrique. Chaque bâtiment est dessiné à la main en code
// (bois aux premiers niveaux, puis pierre, puis marbre et or), les soldats sont de petits personnages animés.

// ---------- Outils de couleur et de géométrie ----------
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
function mix(a, b, t) {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return `#${((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1)}`;
}
const poly = (ctx, pts, fill, stroke = null, lw = 1) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
};
// boîte isométrique : (cx, cy) centre du sol, hw/hh demi-largeur/hauteur du losange, h hauteur
function isoBox(ctx, cx, cy, hw, hh, h, color, opts = {}) {
  const top = opts.top ?? shade(color, 1.12), left = opts.left ?? shade(color, 0.72), right = opts.right ?? shade(color, 0.9);
  poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx, cy + hh - h], [cx - hw, cy - h]], left);
  poly(ctx, [[cx, cy + hh], [cx + hw, cy], [cx + hw, cy - h], [cx, cy + hh - h]], right);
  if (opts.tex) {
    faceTexture(ctx, "l", cx, cy, hw, hh, h, opts.tex);
    faceTexture(ctx, "r", cx, cy, hw, hh, h, opts.tex);
  }
  poly(ctx, [[cx, cy - hh - h], [cx + hw, cy - h], [cx, cy + hh - h], [cx - hw, cy - h]], top);
  if (opts.edge) {
    ctx.strokeStyle = opts.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - h);
    ctx.lineTo(cx, cy + hh - h);
    ctx.lineTo(cx + hw, cy - h);
    ctx.moveTo(cx, cy + hh - h);
    ctx.lineTo(cx, cy + hh);
    ctx.stroke();
  }
}
// toit en pyramide (ou tronqué) au-dessus d'une boîte de hauteur h
function isoRoof(ctx, cx, cy, hw, hh, h, rh, color, trunc = 0) {
  const ax = cx, ay = cy - h - rh, t = trunc;
  const tl = [cx - hw * t, ay + 0], tr = [cx + hw * t, ay], tb = [cx, ay + hh * t];
  const A = [cx - hw, cy - h], B = [cx, cy + hh - h], C = [cx + hw, cy - h];
  if (t > 0) {
    poly(ctx, [A, B, tb, tl], shade(color, 0.78));
    roofTiles(ctx, A, B, tb, tl);
    poly(ctx, [B, C, tr, tb], shade(color, 0.95));
    roofTiles(ctx, B, C, tr, tb);
    poly(ctx, [[cx, ay - hh * t], tr, tb, tl], shade(color, 1.15));
  } else {
    poly(ctx, [A, B, [ax, ay]], shade(color, 0.78));
    roofTiles(ctx, A, B, [ax, ay], [ax, ay]);
    poly(ctx, [B, C, [ax, ay]], shade(color, 0.98));
    roofTiles(ctx, B, C, [ax, ay], [ax, ay]);
    // faîtage
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(B[0], B[1]);
    ctx.lineTo(ax, ay);
    ctx.stroke();
  }
}
function isoCyl(ctx, cx, cy, rx, h, color, topColor = null) {
  const ry = rx / 2;
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, shade(color, 0.62));
  g.addColorStop(0.55, shade(color, 1.02));
  g.addColorStop(1, shade(color, 0.78));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - h);
  ctx.lineTo(cx - rx, cy);
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, cy - h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy - h, rx, ry, 0, 0, TAU);
  ctx.fillStyle = topColor ?? shade(color, 1.18);
  ctx.fill();
}
function isoCone(ctx, cx, cy, rx, h, color) {
  const ry = rx / 2;
  poly(ctx, [[cx - rx, cy], [cx, cy - h], [cx, cy + ry]], shade(color, 0.75));
  poly(ctx, [[cx, cy + ry], [cx, cy - h], [cx + rx, cy]], shade(color, 1));
}
// point sur une face d'une boîte : face "l" (gauche) ou "r" (droite), u le long, v en hauteur (0 à 1)
function facePt(side, cx, cy, hw, hh, h, u, v) {
  if (side === "l") return [cx - hw + hw * u, cy + hh * u - h * v];
  return [cx + hw * u, cy + hh - hh * u - h * v];
}
function faceRect(ctx, side, cx, cy, hw, hh, h, u0, u1, v0, v1, fill) {
  poly(ctx, [facePt(side, cx, cy, hw, hh, h, u0, v0), facePt(side, cx, cy, hw, hh, h, u1, v0), facePt(side, cx, cy, hw, hh, h, u1, v1), facePt(side, cx, cy, hw, hh, h, u0, v1)], fill);
}
function windowsOn(ctx, side, cx, cy, hw, hh, h, rows, cols, lit, frameCol) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const u0 = (c + 0.3) / cols, u1 = (c + 0.7) / cols, v0 = (r + 0.28) / rows, v1 = (r + 0.72) / rows;
      faceRect(ctx, side, cx, cy, hw, hh, h, u0 - 0.03, u1 + 0.03, v0 - 0.05, v1 + 0.05, frameCol);
      faceRect(ctx, side, cx, cy, hw, hh, h, u0, u1, v0, v1, lit ? "#fde68a" : "#1f2937");
      if (lit) {
        const [gx, gy] = facePt(side, cx, cy, hw, hh, h, (u0 + u1) / 2, (v0 + v1) / 2);
        glow(ctx, gx, gy, 14, "#fbbf24", 0.25);
      }
    }
}
// ---------- Textures : planches, briques, pierre de taille, marbre, tuiles ----------
const CL_TEX = ["wood", "stone", "marble"];
function faceClip(ctx, side, cx, cy, hw, hh, h) {
  ctx.beginPath();
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => {
    const [x, y] = facePt(side, cx, cy, hw, hh, h, u, v);
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.clip();
}
function faceLine(ctx, side, cx, cy, hw, hh, h, u0, v0, u1, v1) {
  const [a, b] = facePt(side, cx, cy, hw, hh, h, u0, v0), [c, d] = facePt(side, cx, cy, hw, hh, h, u1, v1);
  ctx.moveTo(a, b);
  ctx.lineTo(c, d);
}
// appareil de blocs décalés (briques, pierres) : rangées de hauteur rowPx, blocs de largeur colPx
function blockCourse(ctx, side, cx, cy, hw, hh, h, rowPx, colPx, dark, light) {
  const len = Math.hypot(hw, hh), rows = Math.max(2, Math.round(h / rowPx)), cols = Math.max(2, Math.round(len / colPx));
  ctx.lineWidth = 1;
  ctx.strokeStyle = dark;
  ctx.beginPath();
  for (let r = 1; r < rows; r++) faceLine(ctx, side, cx, cy, hw, hh, h, 0, r / rows, 1, r / rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c <= cols; c++) {
      const u = (c + (r % 2) * 0.5) / cols;
      if (u > 0.01 && u < 0.99) faceLine(ctx, side, cx, cy, hw, hh, h, u, r / rows, u, (r + 1) / rows);
    }
  ctx.stroke();
  ctx.strokeStyle = light;
  ctx.beginPath();
  for (let r = 1; r < rows; r++) faceLine(ctx, side, cx, cy, hw, hh, h, 0, r / rows - 1.2 / h, 1, r / rows - 1.2 / h);
  ctx.stroke();
  return { rows, cols };
}
function faceTexture(ctx, side, cx, cy, hw, hh, h, kind) {
  if (h < 5 || !kind) return;
  const len = Math.hypot(hw, hh), R = seeded(Math.round(cx * 13 + cy * 7 + h) + (side === "l" ? 1 : 2));
  ctx.save();
  faceClip(ctx, side, cx, cy, hw, hh, h);
  if (kind === "wood") {
    const n = Math.max(2, Math.round(len / 6));
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(45,22,6,0.32)";
    ctx.beginPath();
    for (let k = 1; k < n; k++) faceLine(ctx, side, cx, cy, hw, hh, h, k / n, 0, k / n, 1);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,226,180,0.13)";
    ctx.beginPath();
    for (let k = 1; k < n; k++) faceLine(ctx, side, cx, cy, hw, hh, h, k / n + 1.3 / len, 0, k / n + 1.3 / len, 1);
    ctx.stroke();
    // nœuds du bois et poutres
    for (let k = 0; k < Math.round(len / 9); k++) {
      const [x, y] = facePt(side, cx, cy, hw, hh, h, R(), 0.15 + R() * 0.7);
      ctx.fillStyle = "rgba(60,30,8,0.35)";
      ctx.beginPath();
      ctx.ellipse(x, y, 1.3, 2.2, 0, 0, TAU);
      ctx.fill();
    }
    faceRect(ctx, side, cx, cy, hw, hh, h, 0, 1, 0, Math.min(0.12, 4 / h), "rgba(55,28,8,0.45)");
    faceRect(ctx, side, cx, cy, hw, hh, h, 0, 1, 1 - Math.min(0.1, 3 / h), 1, "rgba(55,28,8,0.4)");
  } else if (kind === "brick") {
    blockCourse(ctx, side, cx, cy, hw, hh, h, 5, 10, "rgba(70,25,10,0.32)", "rgba(255,210,180,0.12)");
  } else if (kind === "stone") {
    const { rows, cols } = blockCourse(ctx, side, cx, cy, hw, hh, h, 9, 15, "rgba(30,28,26,0.3)", "rgba(255,255,255,0.14)");
    // blocs légèrement différents les uns des autres
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        if (R() < 0.35) {
          const u0 = (c + (r % 2) * 0.5) / cols;
          faceRect(ctx, side, cx, cy, hw, hh, h, u0, u0 + 1 / cols, r / rows, (r + 1) / rows, R() < 0.5 ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.07)");
        }
    for (let k = 0; k < Math.round(len * h / 90); k++) {
      const [x, y] = facePt(side, cx, cy, hw, hh, h, R(), R());
      ctx.fillStyle = R() < 0.5 ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)";
      ctx.fillRect(x, y, 1.2, 1.2);
    }
  } else if (kind === "marble") {
    blockCourse(ctx, side, cx, cy, hw, hh, h, 16, 26, "rgba(150,130,100,0.22)", "rgba(255,255,255,0.25)");
    // veines du marbre
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = k % 2 ? "rgba(140,128,115,0.3)" : "rgba(212,175,95,0.32)";
      ctx.beginPath();
      const [x0, y0] = facePt(side, cx, cy, hw, hh, h, R() * 0.3, R());
      const [x1, y1] = facePt(side, cx, cy, hw, hh, h, 0.3 + R() * 0.4, R());
      const [x2, y2] = facePt(side, cx, cy, hw, hh, h, 0.7 + R() * 0.3, R());
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x1, y1, x2, y2);
      ctx.stroke();
    }
  }
  // ombre au pied du mur (occlusion ambiante)
  const [ax, ay] = facePt(side, cx, cy, hw, hh, h, 0.5, 0), [bx2, by2] = facePt(side, cx, cy, hw, hh, h, 0.5, Math.min(1, 14 / h));
  const g = ctx.createLinearGradient(ax, ay, bx2, by2);
  g.addColorStop(0, "rgba(0,0,0,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - hw - 2, cy - h - hh - 2, hw * 2 + 4, h + hh * 2 + 4);
  ctx.restore();
}
// tuiles d'un pan de toit : A-B le bas (gouttière), D-C le haut
function roofTiles(ctx, A, B, C, D) {
  const L = (p, q, s) => [p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s];
  const n = Math.max(3, Math.round(Math.hypot(D[0] - A[0], D[1] - A[1]) / 5)), m = Math.max(3, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / 7));
  ctx.save();
  ctx.beginPath();
  for (const [i, p] of [A, B, C, D].entries()) i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
  ctx.closePath();
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.24)";
  ctx.beginPath();
  for (let k = 1; k < n; k++) {
    const P = L(A, D, k / n), Q = L(B, C, k / n);
    ctx.moveTo(P[0], P[1]);
    ctx.lineTo(Q[0], Q[1]);
  }
  for (let k = 0; k < n; k++)
    for (let j = 1; j < m + 1; j++) {
      const w = (j - (k % 2) * 0.5) / m;
      if (w <= 0 || w >= 1) continue;
      const P = L(L(A, D, k / n), L(B, C, k / n), w), Q = L(L(A, D, (k + 1) / n), L(B, C, (k + 1) / n), w);
      ctx.moveTo(P[0], P[1]);
      ctx.lineTo(Q[0], Q[1]);
    }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  for (let k = 1; k < n; k++) {
    const P = L(A, D, k / n), Q = L(B, C, k / n);
    ctx.moveTo(P[0], P[1] + 1);
    ctx.lineTo(Q[0], Q[1] + 1);
  }
  ctx.stroke();
  ctx.restore();
  // ombre portée sous la gouttière
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(A[0], A[1] + 1);
  ctx.lineTo(B[0], B[1] + 1);
  ctx.stroke();
}
// matériaux selon le niveau
const CL_MAT = [
  { wall: "#b98b55", stone: "#8b6b45", roof: "#9a3412", trim: "#5b3a1e", accent: "#d97706" },
  { wall: "#b8b2aa", stone: "#7c7570", roof: "#1e40af", trim: "#e7e5e4", accent: "#60a5fa" },
  { wall: "#f4efe4", stone: "#cfc4ad", roof: "#5b21b6", trim: "#f59e0b", accent: "#fbbf24" },
];
const tierOfLevel = (L) => (L <= 2 ? 0 : L <= 4 ? 1 : 2);
function flag(ctx, x, y, h, color, t = 0) {
  ctx.strokeStyle = "#3f3f46";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - h);
  ctx.stroke();
  const w = 7 + Math.sin(t * 6) * 1.5;
  poly(ctx, [[x, y - h], [x + 16, y - h + 4 + Math.sin(t * 5) * 1.5], [x + w + 9, y - h + 8], [x, y - h + 12]], color);
}

// ---------- Les bâtiments ----------
function foundation(ctx, cx, cy, hw, hh, tier) {
  const col = ["#7c5a36", "#8a8580", "#d9cfbb"][tier];
  isoBox(ctx, cx, cy + 3, hw, hh, 7, col, { edge: "rgba(0,0,0,0.15)", tex: tier ? "stone" : "wood" });
}
const BUILD_ART = {
  manoir(ctx, cx, cy, hw, hh, L, t) {
    const m = CL_MAT[tierOfLevel(L)];
    foundation(ctx, cx, cy, hw, hh, tierOfLevel(L));
    const bw = hw * 0.66, bh = hh * 0.66, H = 46 + 5 * L, y0 = cy - 4;
    // tours d'angle (derrière)
    if (L >= 3) {
      isoCyl(ctx, cx, y0 - hh * 0.72, 13, H + 22, m.wall);
      isoCone(ctx, cx, y0 - hh * 0.72 - H - 22, 16, 30, m.roof);
    }
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.2)", tex: CL_TEX[tierOfLevel(L)] });
    // corniche
    isoBox(ctx, cx, y0 - H + 4, bw + 3, bh + 1.5, 5, m.trim);
    windowsOn(ctx, "l", cx, y0, bw, bh, H, 2, 3, true, m.trim);
    windowsOn(ctx, "r", cx, y0, bw, bh, H, 2, 3, true, m.trim);
    // porte
    faceRect(ctx, "r", cx, y0, bw, bh, H, 0.38, 0.62, 0, 0.32, m.trim);
    faceRect(ctx, "r", cx, y0, bw, bh, H, 0.42, 0.58, 0, 0.27, "#3b1d0b");
    isoRoof(ctx, cx, y0, bw + 4, bh + 2, H + 3, 30 + 2 * L, m.roof, 0.3);
    // lucarnes et cheminées
    for (const u of [0.3, 0.7]) {
      const [x, y] = facePt("l", cx, y0 - H - 8, bw * 0.8, bh * 0.8, 0, u, 0);
      isoBox(ctx, x, y, 6, 3, 12, m.wall);
      isoRoof(ctx, x, y, 7, 3.5, 12, 7, m.roof);
    }
    isoBox(ctx, cx + bw * 0.45, y0 - H - 10, 4, 2, 22, m.stone);
    if (L >= 3)
      for (const s of [-1, 1]) {
        const tx = cx + s * hw * 0.78, ty = y0 + hh * 0.1;
        isoCyl(ctx, tx, ty, 12, H + 12, m.wall);
        isoCone(ctx, tx, ty - H - 12, 15, 26, m.roof);
        flag(ctx, tx, ty - H - 38, 18, m.accent, t + s);
      }
    if (L >= 5) {
      // dôme doré
      ctx.save();
      const dy = y0 - H - 30 - 2 * L;
      const g = ctx.createRadialGradient(cx - 6, dy - 8, 2, cx, dy, 20);
      g.addColorStop(0, "#fff7d6");
      g.addColorStop(0.5, "#fbbf24");
      g.addColorStop(1, "#92400e");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx, dy, 18, 16, 0, Math.PI, 0);
      ctx.fill();
      ctx.restore();
      flag(ctx, cx, dy - 14, 22, "#e11d48", t);
    } else flag(ctx, cx, y0 - H - 30 - 2 * L, 20, m.accent, t);
  },
  mine(ctx, cx, cy, hw, hh, L, t) {
    const tier = tierOfLevel(L);
    poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx + hw, cy], [cx, cy - hh]], "#6b4f2e");
    // rochers
    const R = seeded(31);
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU, x = cx + Math.cos(a) * hw * 0.42, y = cy - 10 + Math.sin(a) * hh * 0.38;
      ctx.fillStyle = shade(["#78716c", "#8b7d6b", "#a8a29e"][k % 3], 0.85 + R() * 0.3);
      ctx.beginPath();
      ctx.ellipse(x, y, 16 + R() * 8, 12 + R() * 6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#8b7d6b";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 22, hw * 0.5, 26, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.ellipse(cx - 10, cy - 34, hw * 0.25, 10, -0.3, 0, TAU);
    ctx.fill();
    // entrée de la galerie, poutres
    ctx.fillStyle = "#1c1410";
    ctx.beginPath();
    ctx.ellipse(cx + 12, cy - 10, 13, 15, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(cx - 1, cy - 10, 26, 6);
    ctx.fillStyle = "#7c4a1e";
    ctx.fillRect(cx - 2, cy - 27, 4, 22);
    ctx.fillRect(cx + 22, cy - 27, 4, 22);
    ctx.fillRect(cx - 4, cy - 29, 32, 5);
    // rails et wagonnet d'or
    ctx.strokeStyle = "#57534e";
    ctx.lineWidth = 2;
    for (const o of [-3, 3]) {
      ctx.beginPath();
      ctx.moveTo(cx + 12 + o, cy - 4);
      ctx.lineTo(cx + 34 + o, cy + 8);
      ctx.stroke();
    }
    isoBox(ctx, cx + 28, cy + 8, 9, 5, 9, "#4b5563");
    for (let k = 0; k < 4 + L; k++) disc(ctx, cx + 22 + (k % 4) * 4, cy - 2 - Math.floor(k / 4) * 3, 3, k % 2 ? "#fbbf24" : "#fde68a");
    if (tier >= 1) glow(ctx, cx + 12, cy - 18, 26, "#fbbf24", 0.4 + 0.15 * Math.sin(t * 4));
    if (tier >= 2) for (let k = 0; k < 3; k++) poly(ctx, [[cx - 20 + k * 9, cy - 30], [cx - 16 + k * 9, cy - 42], [cx - 12 + k * 9, cy - 30]], k % 2 ? "#fde68a" : "#f59e0b");
  },
  distillerie(ctx, cx, cy, hw, hh, L, t) {
    const m = CL_MAT[tierOfLevel(L)];
    foundation(ctx, cx, cy, hw, hh, tierOfLevel(L));
    // atelier de briques
    const bx = cx - hw * 0.3, by = cy - 4;
    isoBox(ctx, bx, by, hw * 0.42, hh * 0.42, 30, "#9a3412", { edge: "rgba(0,0,0,0.2)", tex: "brick" });
    isoRoof(ctx, bx, by, hw * 0.46, hh * 0.46, 30, 16, m.roof);
    isoBox(ctx, bx + 8, by - 30, 3, 1.5, 22, "#57534e");
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.6 + k / 3) % 1;
      ctx.fillStyle = `rgba(216,180,254,${0.5 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(bx + 8 + p * 10, by - 58 - p * 24, 4 + p * 7, 0, TAU);
      ctx.fill();
    }
    // alambic de cuivre
    const sx = cx + hw * 0.18, sy = cy - 14;
    const g = ctx.createRadialGradient(sx - 6, sy - 8, 2, sx, sy, 18);
    g.addColorStop(0, "#fed7aa");
    g.addColorStop(0.5, "#c2410c");
    g.addColorStop(1, "#7c2d12");
    disc(ctx, sx, sy, 16, g);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy - 16);
    ctx.quadraticCurveTo(sx + 6, sy - 34, sx + 26, sy - 22);
    ctx.stroke();
    // cuve de verre pleine d'essence
    const tx = cx + hw * 0.55, ty = cy + 2, rx = 11 + L, H = 30 + 3 * L;
    isoCyl(ctx, tx, ty, rx, H, "#a5b4fc", "rgba(224,231,255,0.8)");
    const fill = 0.55 + 0.25 * Math.sin(t * 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(tx - rx, ty - H * fill, rx * 2, H * fill + rx);
    ctx.clip();
    isoCyl(ctx, tx, ty, rx - 2, H, "#9333ea", "#c084fc");
    ctx.restore();
    glow(ctx, tx, ty - H / 2, 30, "#a855f7", 0.45);
    for (let k = 0; k < 4; k++) disc(ctx, tx - 4 + k * 3, ty - ((t * 30 + k * 9) % (H * fill)), 1.6, "rgba(255,255,255,0.8)");
  },
  coffre(ctx, cx, cy, hw, hh, L, t) {
    const m = CL_MAT[tierOfLevel(L)];
    foundation(ctx, cx, cy, hw, hh, tierOfLevel(L));
    const y0 = cy - 4, bw = hw * 0.58, bh = hh * 0.58, H = 32 + 3 * L;
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.25)", tex: CL_TEX[tierOfLevel(L)] });
    // bandes de métal
    for (const v of [0.18, 0.82]) {
      faceRect(ctx, "l", cx, y0, bw, bh, H, 0, 1, v - 0.05, v + 0.05, m.trim);
      faceRect(ctx, "r", cx, y0, bw, bh, H, 0, 1, v - 0.05, v + 0.05, m.trim);
    }
    // porte blindée ronde
    const [dx, dy] = facePt("r", cx, y0, bw, bh, H, 0.5, 0.48);
    ctx.save();
    ctx.translate(dx, dy);
    ctx.transform(1, -0.5, 0, 1, 0, 0);
    disc(ctx, 0, 0, 13, "#4b5563");
    disc(ctx, 0, 0, 10, "#9ca3af");
    ctx.strokeStyle = m.accent;
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(k + t) * 9, Math.sin(k + t) * 9);
      ctx.stroke();
    }
    disc(ctx, 0, 0, 3, m.accent);
    ctx.restore();
    // piles de pièces
    for (let p = 0; p < 2 + Math.min(3, L); p++) {
      const px = cx - hw * 0.62 + p * 9, py = cy + hh * 0.2 + (p % 2) * 4;
      for (let k = 0; k < 3 + p; k++) {
        ctx.fillStyle = k % 2 ? "#f59e0b" : "#fbbf24";
        ctx.beginPath();
        ctx.ellipse(px, py - k * 3, 6, 3, 0, 0, TAU);
        ctx.fill();
      }
    }
  },
  caserne(ctx, cx, cy, hw, hh, L, t) {
    const tier = tierOfLevel(L);
    poly(ctx, [[cx - hw, cy], [cx, cy + hh], [cx + hw, cy], [cx, cy - hh]], "#8b6b45");
    // palissade (arrière)
    const stakes = (from, to, n) => {
      for (let k = 0; k <= n; k++) {
        const x = from[0] + (to[0] - from[0]) * (k / n), y = from[1] + (to[1] - from[1]) * (k / n);
        isoBox(ctx, x, y, 2.2, 1.1, 14, tier === 2 ? "#d6d3d1" : "#7c4a1e");
      }
    };
    stakes([cx - hw * 0.92, cy], [cx, cy - hh * 0.92], 8);
    stakes([cx, cy - hh * 0.92], [cx + hw * 0.92, cy], 8);
    // tentes
    const canvas = ["#e7d8b8", "#4d7c0f", "#b91c1c"][tier];
    for (const [ox, oy] of [[-14, -6], [12, 4]]) {
      const x = cx + ox, y = cy + oy;
      poly(ctx, [[x - 18, y], [x, y - 24], [x + 4, y + 9]], shade(canvas, 0.75));
      poly(ctx, [[x + 4, y + 9], [x, y - 24], [x + 22, y - 2]], shade(canvas, 1));
      poly(ctx, [[x - 2, y + 2], [x + 1, y - 10], [x + 4, y + 4]], "#1f2937");
    }
    // feu de camp
    glow(ctx, cx - 26, cy + 10, 22, "#f97316", 0.6 + 0.2 * Math.sin(t * 9));
    for (let k = 0; k < 3; k++) poly(ctx, [[cx - 30 + k * 4, cy + 12], [cx - 28 + k * 4, cy + 2 - Math.sin(t * 10 + k) * 3], [cx - 26 + k * 4, cy + 12]], k % 2 ? "#fde68a" : "#f97316");
    flag(ctx, cx + 30, cy - 4, 30, ["#d97706", "#2563eb", "#7c3aed"][tier], t);
    // palissade (avant)
    stakes([cx - hw * 0.92, cy], [cx, cy + hh * 0.92], 8);
    stakes([cx, cy + hh * 0.92], [cx + hw * 0.92, cy], 8);
  },
  canon(ctx, cx, cy, hw, hh, L, t, aim = -0.6) {
    const m = CL_MAT[tierOfLevel(L)];
    isoCyl(ctx, cx, cy, hw * 0.7, 14, m.stone);
    // sacs de sable
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * TAU;
      ctx.fillStyle = shade("#c2a878", 0.85 + (k % 3) * 0.08);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * hw * 0.62, cy - 14 + Math.sin(a) * hh * 0.62, 7, 4, a, 0, TAU);
      ctx.fill();
    }
    // affût et roues
    isoBox(ctx, cx, cy - 14, 10, 5, 8, "#7c4a1e");
    disc(ctx, cx - 9, cy - 16, 6, "#3f2a12");
    disc(ctx, cx + 9, cy - 16, 6, "#3f2a12");
    // fût orienté vers la cible
    ctx.save();
    ctx.translate(cx, cy - 24);
    ctx.rotate(aim);
    const g = ctx.createLinearGradient(0, -7, 0, 7);
    const barrel = tierOfLevel(L) === 2 ? ["#fde68a", "#b45309"] : tierOfLevel(L) === 1 ? ["#9ca3af", "#1f2937"] : ["#57534e", "#111827"];
    g.addColorStop(0, barrel[0]);
    g.addColorStop(1, barrel[1]);
    roundRect(ctx, -8, -7, 36 + L * 2, 14, 6);
    ctx.fillStyle = g;
    ctx.fill();
    disc(ctx, 32 + L * 2, 0, 8, barrel[1]);
    disc(ctx, 32 + L * 2, 0, 4, "#000000");
    ctx.restore();
  },
  tour(ctx, cx, cy, hw, hh, L, t) {
    const m = CL_MAT[tierOfLevel(L)];
    foundation(ctx, cx, cy, hw, hh, tierOfLevel(L));
    const bw = hw * 0.48, bh = hh * 0.48, H = 72 + 5 * L, y0 = cy - 4;
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.25)", tex: tierOfLevel(L) === 2 ? "marble" : "stone" });
    // meurtrières
    for (const v of [0.35, 0.65]) {
      faceRect(ctx, "l", cx, y0, bw, bh, H, 0.45, 0.55, v, v + 0.12, "#111827");
      faceRect(ctx, "r", cx, y0, bw, bh, H, 0.45, 0.55, v, v + 0.12, "#111827");
    }
    // plateforme et créneaux
    isoBox(ctx, cx, y0 - H, bw + 6, bh + 3, 6, m.stone);
    for (let k = 0; k < 4; k++) {
      const [x, y] = facePt("l", cx, y0 - H - 6, bw + 6, bh + 3, 0, (k + 0.5) / 4, 0);
      isoBox(ctx, x, y, 3, 1.5, 7, m.stone);
      const [x2, y2] = facePt("r", cx, y0 - H - 6, bw + 6, bh + 3, 0, (k + 0.5) / 4, 0);
      isoBox(ctx, x2, y2, 3, 1.5, 7, m.stone);
    }
    // archer de l'IRF
    disc(ctx, cx, y0 - H - 18, 4, "#f1c27d");
    poly(ctx, [[cx - 5, y0 - H - 6], [cx, y0 - H - 16], [cx + 5, y0 - H - 6]], "#1e3a8a");
    ctx.strokeStyle = "#7c4a1e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx + 5, y0 - H - 12, 6, -1.2, 1.2);
    ctx.stroke();
    flag(ctx, cx - bw, y0 - H - 4, 22, "#2563eb", t);
  },
  mortier(ctx, cx, cy, hw, hh, L, t) {
    const m = CL_MAT[tierOfLevel(L)];
    isoCyl(ctx, cx, cy, hw * 0.74, 12, m.stone);
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU + r * 0.25;
        ctx.fillStyle = shade("#b59b6b", 0.8 + ((k + r) % 3) * 0.1);
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * hw * 0.6, cy - 12 - r * 6 + Math.sin(a) * hh * 0.6, 8, 4.5, a, 0, TAU);
        ctx.fill();
      }
    // fût large incliné vers le ciel
    ctx.save();
    ctx.translate(cx, cy - 24);
    const g = ctx.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, "#111827");
    g.addColorStop(0.5, tierOfLevel(L) === 2 ? "#d97706" : "#4b5563");
    g.addColorStop(1, "#111827");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-13, 6);
    ctx.lineTo(-11, -20);
    ctx.lineTo(11, -20);
    ctx.lineTo(13, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(0, -20, 11, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = m.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -20, 11, 5, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  },
};
// feu, fumée, décombres
function flames(ctx, x, y, s, t) {
  glow(ctx, x, y - s * 0.4, s * 1.6, "#f97316", 0.45);
  for (let k = 0; k < 5; k++) {
    const ox = (k - 2) * s * 0.22, hh = s * (0.7 + 0.35 * Math.sin(t * 11 + k * 1.7));
    poly(ctx, [[x + ox - s * 0.18, y], [x + ox, y - hh], [x + ox + s * 0.18, y]], k % 2 ? "#fde68a" : "#f97316");
  }
}
function smoke(ctx, x, y, t, n = 4, dark = false) {
  for (let k = 0; k < n; k++) {
    const p = (t * 0.5 + k / n) % 1;
    ctx.fillStyle = dark ? `rgba(30,30,30,${0.45 * (1 - p)})` : `rgba(180,180,180,${0.35 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(x + Math.sin(k * 2 + t) * 6 + p * 10, y - p * 46, 5 + p * 12, 0, TAU);
    ctx.fill();
  }
}
function rubble(ctx, cx, cy, hw, hh, t) {
  poly(ctx, [[cx - hw * 0.8, cy], [cx, cy + hh * 0.8], [cx + hw * 0.8, cy], [cx, cy - hh * 0.8]], "rgba(41,37,36,0.55)");
  const R = seeded(Math.round(cx * 7 + cy));
  for (let k = 0; k < 16; k++) {
    const x = cx + (R() - 0.5) * hw * 1.2, y = cy + (R() - 0.5) * hh * 1.1 - 4;
    poly(ctx, [[x - 6, y], [x - 2, y - 6 - R() * 5], [x + 5, y - 3], [x + 6, y + 2]], ["#78716c", "#57534e", "#a8a29e"][k % 3]);
  }
  for (let k = 0; k < 4; k++) disc(ctx, cx + (R() - 0.5) * hw, cy + (R() - 0.5) * hh, 1.6, `rgba(249,115,22,${0.5 + 0.5 * Math.sin(t * 8 + k)})`);
  smoke(ctx, cx, cy - 8, t, 3, true);
}
// ruban de niveau (bouclier)
function levelBadge(ctx, x, y, L) {
  const tier = tierOfLevel(L), col = ["#b45309", "#64748b", "#a16207"][tier], light = ["#fbbf24", "#e2e8f0", "#fde68a"][tier];
  poly(ctx, [[x - 9, y - 10], [x + 9, y - 10], [x + 9, y + 2], [x, y + 10], [x - 9, y + 2]], col, light, 1.5);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "12px CardBold";
  ctx.fillText(String(L), x, y + 3);
}
function scaffolding(ctx, cx, cy, hw, hh, h) {
  ctx.strokeStyle = "rgba(161,98,7,0.9)";
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * hw * 0.85, cy);
    ctx.lineTo(cx + s * hw * 0.85, cy - h);
    ctx.stroke();
  }
  for (let k = 1; k <= 3; k++) {
    ctx.beginPath();
    ctx.moveTo(cx - hw * 0.85, cy - (h * k) / 3);
    ctx.lineTo(cx, cy + hh * 0.85 - (h * k) / 3);
    ctx.lineTo(cx + hw * 0.85, cy - (h * k) / 3);
    ctx.stroke();
  }
  // panneau de chantier rayé
  for (let k = 0; k < 6; k++) poly(ctx, [[cx - 18 + k * 6, cy + hh * 0.9], [cx - 15 + k * 6, cy + hh * 0.9], [cx - 18 + k * 6 + 6, cy + hh * 0.9 - 8], [cx - 21 + k * 6 + 6, cy + hh * 0.9 - 8]], k % 2 ? "#111827" : "#facc15");
}
function hpBarIso(ctx, x, y, w, frac) {
  roundRect(ctx, x - w / 2, y, w, 5, 2.5);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fill();
  roundRect(ctx, x - w / 2 + 1, y + 1, Math.max(2, (w - 2) * frac), 3, 1.5);
  ctx.fillStyle = frac > 0.5 ? "#4ade80" : frac > 0.25 ? "#facc15" : "#f87171";
  ctx.fill();
}

// ---------- Les soldats ----------
const TROOP_LOOK = {
  colosse: { body: "#64748b", accent: "#cbd5e1", cape: null },
  pillard: { body: "#78350f", accent: "#4d7c0f", cape: null },
  tireur: { body: "#1d4ed8", accent: "#93c5fd", cape: "#1e3a8a" },
  heros: { body: "#6d28d9", accent: "#fbbf24", cape: "#7f1d1d" },
  eclaireur: { body: "#a16207", accent: "#ef4444", cape: null },
};
function drawSoldier(ctx, x, y, role, f, hp, ring, scale = 1, dir = 1) {
  const L = TROOP_LOOK[role] ?? TROOP_LOOK.eclaireur, s = scale, step = Math.sin(f * 1.7) * 2.2 * s;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 8 * s, 3.5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8 * s, 3.5 * s, 0, 0, TAU);
  ctx.stroke();
  if (L.cape) poly(ctx, [[-5 * s, -15 * s], [5 * s, -15 * s], [7 * s, -3 * s], [-8 * s, -2 * s]], L.cape);
  // jambes
  ctx.fillStyle = "#3f2a12";
  ctx.fillRect(-3.5 * s, -6 * s + step * 0.3, 2.6 * s, 6 * s - step * 0.3);
  ctx.fillRect(1 * s, -6 * s - step * 0.3, 2.6 * s, 6 * s + step * 0.3);
  // corps
  roundRect(ctx, -5 * s, -16 * s, 10 * s, 11 * s, 3 * s);
  ctx.fillStyle = L.body;
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-4 * s, -15 * s, 3 * s, 9 * s);
  // tête
  disc(ctx, 0, -20 * s, 4.6 * s, "#f1c27d");
  disc(ctx, 1.4 * s, -20.5 * s, 0.9 * s, "#111827");
  if (role === "colosse") {
    ctx.fillStyle = "#94a3b8";
    ctx.beginPath();
    ctx.arc(0, -21 * s, 5 * s, Math.PI, 0);
    ctx.fill();
    roundRect(ctx, 3 * s, -17 * s, 7 * s, 12 * s, 3 * s);
    ctx.fillStyle = "#334155";
    ctx.fill();
    ctx.strokeStyle = L.accent;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (role === "pillard") {
    ctx.fillStyle = L.accent;
    ctx.beginPath();
    ctx.arc(0, -21 * s, 5.2 * s, Math.PI * 0.9, Math.PI * 2.1);
    ctx.fill();
    disc(ctx, -6 * s, -12 * s, 5 * s, "#d6c7a1");
    disc(ctx, -6 * s, -13 * s, 1.6 * s, "#f59e0b");
  } else if (role === "tireur") {
    ctx.strokeStyle = "#7c4a1e";
    ctx.lineWidth = 1.6 * s;
    ctx.beginPath();
    ctx.arc(6 * s, -13 * s, 7 * s, -1.3, 1.3);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(6 * s + Math.cos(-1.3) * 7 * s, -13 * s + Math.sin(-1.3) * 7 * s);
    ctx.lineTo(6 * s + Math.cos(1.3) * 7 * s, -13 * s + Math.sin(1.3) * 7 * s);
    ctx.stroke();
    ctx.fillStyle = L.cape;
    ctx.beginPath();
    ctx.arc(0, -21 * s, 5.2 * s, Math.PI, 0);
    ctx.fill();
  } else if (role === "heros") {
    poly(ctx, [[-4 * s, -24 * s], [-4 * s, -28 * s], [-2 * s, -26 * s], [0, -29 * s], [2 * s, -26 * s], [4 * s, -28 * s], [4 * s, -24 * s]], L.accent);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(5 * s, -10 * s);
    ctx.lineTo(13 * s, -22 * s);
    ctx.stroke();
    glow(ctx, 0, -14 * s, 18 * s, "#a855f7", 0.35);
  } else {
    ctx.strokeStyle = L.accent;
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.moveTo(-2 * s, -16 * s);
    ctx.quadraticCurveTo(-10 * s, -18 * s - step, -14 * s, -14 * s);
    ctx.stroke();
  }
  ctx.restore();
  if (hp < 1) hpBarIso(ctx, x, y - 34 * s, 18 * s, hp);
}

// ---------- Le terrain : une île flottante ----------
const CL_TW = 44, CL_TH = 22, CL_ART = 1.5; // les bâtiments sont dessinés plus grands que leur emprise
function clashView(W, top, tw = CL_TW, th = CL_TH) {
  const ox = W / 2, oy = top;
  return { tw, th, iso: (x, y) => [ox + (x - y) * (tw / 2), oy + (x + y) * (th / 2)] };
}
function drawIsland(ctx, view, seed) {
  const { iso, tw, th } = view, G = CLASH_GRID, R = seeded(seed);
  const [tx, ty] = iso(0, 0), [rx, ry] = iso(G, 0), [bx, by] = iso(G, G), [lx, ly] = iso(0, G);
  // falaises (terre et roche)
  const depth = 70;
  const cliff = (a, b, colTop, colBot) => {
    const g = ctx.createLinearGradient(0, Math.min(a[1], b[1]), 0, Math.max(a[1], b[1]) + depth);
    g.addColorStop(0, colTop);
    g.addColorStop(1, colBot);
    poly(ctx, [a, b, [b[0], b[1] + depth], [a[0], a[1] + depth]], g);
  };
  cliff([lx, ly], [bx, by], "#7c5a36", "#2a1a0c");
  cliff([bx, by], [rx, ry], "#9a7046", "#3b2512");
  // strates de roche
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(lx, ly + k * 16);
    ctx.lineTo(bx, by + k * 16);
    ctx.lineTo(rx, ry + k * 16);
    ctx.stroke();
  }
  // racines et rochers suspendus
  for (let k = 0; k < 14; k++) {
    const u = R(), side = R() < 0.5;
    const a = side ? [lx, ly] : [bx, by], b2 = side ? [bx, by] : [rx, ry];
    const x = a[0] + (b2[0] - a[0]) * u, y = a[1] + (b2[1] - a[1]) * u + depth;
    poly(ctx, [[x - 10, y - 6], [x + 10, y - 6], [x + 2, y + 10 + R() * 18]], "#3b2512");
  }
  // herbe : dalles avec variations
  for (let x = 0; x < G; x++)
    for (let y = 0; y < G; y++) {
      const [cx, cy] = iso(x + 0.5, y + 0.5), v = R();
      poly(ctx, [[cx, cy - th / 2], [cx + tw / 2, cy], [cx, cy + th / 2], [cx - tw / 2, cy]], mix("#65a30d", "#4d7c0f", v * 0.7 + ((x + y) % 2) * 0.12));
      if (v < 0.35) {
        ctx.strokeStyle = "rgba(190,242,100,0.35)";
        ctx.lineWidth = 1;
        for (let k = 0; k < 3; k++) {
          const gx = cx + (R() - 0.5) * tw * 0.6, gy = cy + (R() - 0.5) * th * 0.5;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + 1, gy - 4);
          ctx.stroke();
        }
      }
    }
  // bord d'herbe
  ctx.strokeStyle = "#a3e635";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(bx, by);
  ctx.lineTo(rx, ry);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(tx, ty);
  ctx.lineTo(rx, ry);
  ctx.stroke();
}
function skyBackground(ctx, W, H, seed) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#1e3a8a");
  g.addColorStop(0.45, "#3b82f6");
  g.addColorStop(0.78, "#93c5fd");
  g.addColorStop(1, "#fed7aa");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(seed);
  for (let k = 0; k < 9; k++) {
    const x = R() * W, y = H * (0.25 + R() * 0.7), s = 30 + R() * 60;
    ctx.fillStyle = `rgba(255,247,237,${0.35 + R() * 0.35})`;
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.ellipse(x + (j - 2) * s * 0.45, y + Math.abs(j - 2) * s * 0.1, s * 0.5, s * 0.28, 0, 0, TAU);
      ctx.fill();
    }
  }
}
// chemins pavés, muret, arbres et rochers
function islandDecor(base, layout) {
  const R = seeded(hashOf(base.owner) + 11), c = CLASH_GRID / 2, items = [];
  const free = (x, y) => layout.every((b) => Math.hypot(b.x - x, b.y - y) > CLASH_BUILDINGS[b.type].size * 0.85 + 0.9) && Math.abs(Math.hypot(x - c, y - c) - 7.2) > 0.9 && x > 1 && y > 1 && x < CLASH_GRID - 1 && y < CLASH_GRID - 1;
  for (let k = 0; k < 220 && items.length < 30; k++) {
    const x = 0.8 + R() * (CLASH_GRID - 1.6), y = 0.8 + R() * (CLASH_GRID - 1.6);
    if (free(x, y) && items.every((d) => Math.hypot(d.x - x, d.y - y) > 1.3)) items.push({ x, y, kind: ["tree", "tree", "pine", "rock", "bush", "flowers"][Math.floor(R() * 6)], v: R() });
  }
  const wall = [];
  for (let k = 0; k < 84; k++) {
    if (k % 21 === 0 || k % 21 === 1) continue; // ouvertures
    const a = (k / 84) * TAU;
    wall.push({ x: c + Math.cos(a) * 7.2, y: c + Math.sin(a) * 7.2 * 0.92 });
  }
  return { items, wall };
}
function drawPaths(ctx, view, layout) {
  const { iso } = view, c = CLASH_GRID / 2;
  for (const b of layout) {
    if (b.type === "manoir") continue;
    const [x1, y1] = iso(c, c), [x2, y2] = iso(b.x, b.y);
    ctx.strokeStyle = "#a8875a";
    ctx.lineCap = "round";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.strokeStyle = "#cbb38a";
    ctx.lineWidth = 9;
    ctx.stroke();
    ctx.setLineDash([3, 7]);
    ctx.strokeStyle = "rgba(120,90,50,0.6)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.setLineDash([]);
  }
}
function drawDecorItem(ctx, d, sx, sy, t) {
  if (d.kind === "tree") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(sx + 4, sy + 2, 16, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6b4423";
    ctx.fillRect(sx - 2.5, sy - 18, 5, 18);
    const sway = Math.sin(t * 2 + d.v * 9) * 1.2;
    for (const [ox, oy, r, col] of [[-8, -26, 11, "#3f6212"], [8, -26, 11, "#4d7c0f"], [0, -36, 13, "#65a30d"], [-3, -40, 7, "#84cc16"]]) disc(ctx, sx + ox + sway, sy + oy, r, col);
    disc(ctx, sx - 5 + sway, sy - 42, 4, "rgba(255,255,255,0.18)");
  } else if (d.kind === "pine") {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(sx + 3, sy + 2, 12, 5, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#57381c";
    ctx.fillRect(sx - 2, sy - 8, 4, 8);
    for (let k = 0; k < 3; k++) poly(ctx, [[sx - 13 + k * 3, sy - 8 - k * 11], [sx, sy - 30 - k * 11], [sx + 13 - k * 3, sy - 8 - k * 11]], ["#14532d", "#166534", "#15803d"][k]);
  } else if (d.kind === "rock") {
    poly(ctx, [[sx - 11, sy], [sx - 7, sy - 9], [sx + 3, sy - 12], [sx + 11, sy - 4], [sx + 8, sy + 3]], "#8b8580", "rgba(0,0,0,0.25)");
    poly(ctx, [[sx - 6, sy - 8], [sx + 2, sy - 11], [sx + 1, sy - 5]], "#b8b2aa");
  } else if (d.kind === "bush") {
    for (const [ox, oy, r] of [[-6, -5, 7], [5, -5, 7], [0, -9, 8]]) disc(ctx, sx + ox, sy + oy, r, "#3f6212");
    for (let k = 0; k < 3; k++) disc(ctx, sx - 5 + k * 5, sy - 9, 1.6, "#f87171");
  } else {
    for (let k = 0; k < 7; k++) disc(ctx, sx + Math.cos(k * 2.3) * 7, sy + Math.sin(k * 2.3) * 3.5, 2.1, ["#fde68a", "#f9a8d4", "#ffffff", "#c4b5fd"][k % 4]);
  }
}
function drawWallStone(ctx, sx, sy, tier) {
  isoBox(ctx, sx, sy, 9, 4.5, 12, ["#8b7d6b", "#9ca3af", "#e7e1d3"][tier], { edge: "rgba(0,0,0,0.2)", tex: tier === 2 ? "marble" : "stone" });
}

// ---------- Décor vivant : cascade, îlots flottants, oiseaux, lumière du soir ----------
function waterfall(ctx, view, t) {
  const G = CLASH_GRID, [bx, by] = view.iso(G, G), [rx, ry] = view.iso(G, 0);
  const k = view.tw / 44, u = 0.62, x = bx + (rx - bx) * u, y = by + (ry - by) * u + 18 * k, w = 22 * k, fall = 280 * k;
  ctx.fillStyle = "#1c1208";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.85, 10 * k, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y, 0, y + fall);
  g.addColorStop(0, "rgba(207,250,254,0.95)");
  g.addColorStop(0.35, "rgba(125,211,252,0.8)");
  g.addColorStop(1, "rgba(224,242,254,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.6, y);
  ctx.quadraticCurveTo(x - w * 0.75, y + 20 * k, x - w, y + fall);
  ctx.lineTo(x + w, y + fall);
  ctx.quadraticCurveTo(x + w * 0.75, y + 20 * k, x + w * 0.6, y);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6 * k;
  for (let j = 0; j < 12; j++) {
    const ox = (j / 11 - 0.5) * w * 1.15, p = (t * 1.4 + j * 0.37) % 1, yy = y + p * fall * 0.85;
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - p)})`;
    ctx.beginPath();
    ctx.moveTo(x + ox * (1 + p * 0.5), yy);
    ctx.lineTo(x + ox * (1 + p * 0.5), yy + 20 * k);
    ctx.stroke();
  }
  for (let j = 0; j < 5; j++) disc(ctx, x + (j - 2) * w * 0.28, y + 3 * k, 3.2 * k, "rgba(255,255,255,0.85)");
  for (let j = 0; j < 7; j++) {
    const p = (t * 0.35 + j / 7) % 1;
    ctx.fillStyle = `rgba(255,255,255,${0.22 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(x + (j - 3) * 9 * k, y + fall * 0.62 - p * 26 * k, (14 + p * 22) * k, 0, TAU);
    ctx.fill();
  }
}
function floatingIslets(ctx, W, H, view, seed, t) {
  const R = seeded(seed + 5);
  [[0.075, 0.8], [0.925, 0.76], [0.1, 0.32]].forEach(([fx, fy], i) => {
    const s = (0.75 + R() * 0.45) * (view.tw / 44), x = fx * W, y = fy * H + Math.sin(t * 1.5 + i * 2) * 4, hw = 40 * s, hh = 20 * s;
    ctx.fillStyle = "rgba(15,23,42,0.12)";
    ctx.beginPath();
    ctx.ellipse(x + 10, y + 120 * s, hw * 0.8, hh * 0.5, 0, 0, TAU);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + 80 * s);
    g.addColorStop(0, "#8b6440");
    g.addColorStop(1, "#2a1a0c");
    poly(ctx, [[x - hw, y], [x, y + hh], [x + hw, y], [x + hw * 0.55, y + 38 * s], [x + 8 * s, y + 82 * s], [x - hw * 0.45, y + 46 * s]], g);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - hw * 0.8, y + 12 * s);
    ctx.lineTo(x, y + hh + 10 * s);
    ctx.lineTo(x + hw * 0.75, y + 14 * s);
    ctx.stroke();
    poly(ctx, [[x - hw, y], [x, y + hh], [x + hw, y], [x, y - hh]], "#65a30d");
    poly(ctx, [[x - hw, y], [x, y - hh], [x + hw, y], [x, y - hh + 4 * s]], "rgba(190,242,100,0.35)");
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.lineTo(x, y + hh);
    ctx.lineTo(x + hw, y);
    ctx.stroke();
    if (i !== 1) drawDecorItem(ctx, { kind: i ? "pine" : "tree", v: R() }, x - 6 * s, y + 2, t);
    drawDecorItem(ctx, { kind: i === 1 ? "rock" : "flowers", v: R() }, x + 14 * s, y + 4, t);
  });
}
function birds(ctx, W, H, seed, t) {
  const R = seeded(seed + 9);
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  for (let k = 0; k < 6; k++) {
    const x = ((R() * W + t * (28 + R() * 22)) % (W + 40)) - 20, y = H * (0.16 + R() * 0.2), s = 4 + R() * 3, f = Math.sin(t * 9 + k * 1.3) * s * 0.7;
    ctx.strokeStyle = "rgba(30,27,46,0.7)";
    ctx.beginPath();
    ctx.moveTo(x - s, y - f);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.2, x, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.2, x + s, y - f);
    ctx.stroke();
  }
}
// lumière dorée de fin de journée, rayons et vignettage
function goldenLight(ctx, W, H) {
  ctx.save();
  ctx.globalCompositeOperation = "soft-light";
  const g = ctx.createRadialGradient(W * 0.12, -H * 0.15, 0, W * 0.12, -H * 0.15, W * 1.25);
  g.addColorStop(0, "rgba(255,214,140,0.9)");
  g.addColorStop(0.5, "rgba(255,170,90,0.35)");
  g.addColorStop(1, "rgba(70,50,140,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 4; k++) {
    const a0 = 0.35 + k * 0.17;
    ctx.fillStyle = `rgba(255,236,179,${0.05 - k * 0.008})`;
    ctx.beginPath();
    ctx.moveTo(W * 0.05, -H * 0.1);
    ctx.lineTo(W * 0.05 + Math.cos(a0) * W * 1.6, -H * 0.1 + Math.sin(a0) * W * 1.6);
    ctx.lineTo(W * 0.05 + Math.cos(a0 + 0.06) * W * 1.6, -H * 0.1 + Math.sin(a0 + 0.06) * W * 1.6);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(12,6,28,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
// bulle de récolte au-dessus d'une mine ou d'une distillerie
function collectBubble(ctx, x, y, res, frac, amount) {
  const full = frac >= 0.999;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x - 34, y - 26, 68, 46, 16);
  ctx.fillStyle = full ? "#fff7d6" : "#ffffff";
  ctx.fill();
  ctx.restore();
  poly(ctx, [[x - 8, y + 19], [x + 8, y + 19], [x, y + 30]], full ? "#fff7d6" : "#ffffff");
  if (full) {
    roundRect(ctx, x - 34, y - 26, 68, 46, 16);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    ctx.stroke();
    glow(ctx, x, y - 4, 60, "#fbbf24", 0.3);
  }
  (res === "or" ? iconCoin : iconCrystal)(ctx, x, y - 8, 11);
  ctx.textAlign = "center";
  ctx.font = "12px CardBold";
  ctx.fillStyle = full ? "#b45309" : "#1f2937";
  ctx.fillText(full ? "PLEIN" : amount.toLocaleString("fr-FR"), x, y + 13);
}

// ---------- Une scène complète (base ou combat) ----------
// state : { blds: Map(id -> {hp, dead}), troops: [{x, y, role, hp, ring, dir}], shots: [...], t, aims: Map }
function drawClashScene(ctx, base, layout, view, state = {}) {
  const t = state.t ?? 0, tier = tierOfLevel(manoirOf(base));
  drawPaths(ctx, view, layout);
  const decor = state.decor ?? islandDecor(base, layout);
  const objs = [];
  for (const b of layout) objs.push({ kind: "b", b, depth: b.x + b.y + CLASH_BUILDINGS[b.type].size * 0.5 });
  for (const d of decor.items) objs.push({ kind: "d", d, depth: d.x + d.y });
  for (const w of decor.wall) objs.push({ kind: "w", w, depth: w.x + w.y });
  for (const tr of state.troops ?? []) objs.push({ kind: "t", tr, depth: tr.x + tr.y + 0.3 });
  objs.sort((a, b) => a.depth - b.depth);
  for (const o of objs) {
    if (o.kind === "d") {
      const [sx, sy] = view.iso(o.d.x, o.d.y);
      drawDecorItem(ctx, o.d, sx, sy, t);
    } else if (o.kind === "w") {
      const [sx, sy] = view.iso(o.w.x, o.w.y);
      drawWallStone(ctx, sx, sy, tier);
    } else if (o.kind === "t") {
      const [sx, sy] = view.iso(o.tr.x, o.tr.y);
      drawSoldier(ctx, sx, sy, o.tr.role, t * 10 + o.tr.x * 3, o.tr.hp, o.tr.ring, (view.tw / 44) * (state.battle ? 1.75 : 1.25), o.tr.dir);
    } else {
      const b = o.b, def = CLASH_BUILDINGS[b.type], n = def.size, st = state.blds?.get(b.id);
      const [sx, sy] = view.iso(b.x, b.y), hw = (n * view.tw) / 2 * 0.92 * CL_ART, hh = (n * view.th) / 2 * 0.92 * CL_ART;
      ctx.save();
      ctx.translate(sx + hw * 0.22, sy + hh * 0.26);
      ctx.scale(hw * 1.08, hh * 1.08);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      sg.addColorStop(0, "rgba(10,20,5,0.38)");
      sg.addColorStop(0.65, "rgba(10,20,5,0.22)");
      sg.addColorStop(1, "rgba(10,20,5,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (st?.dead) {
        rubble(ctx, sx, sy, hw, hh, t);
        continue;
      }
      ctx.save();
      const k = (view.tw / 44) * CL_ART;
      ctx.translate(sx, sy);
      ctx.scale(k, k);
      BUILD_ART[b.type](ctx, 0, 0, hw / k, hh / k, b.level, t, state.aims?.get(b.id));
      ctx.restore();
      if (b.upgrading && !state.battle) scaffolding(ctx, sx, sy, hw, hh, 46 * k);
      if (st && st.hp < 0.6) smoke(ctx, sx, sy - 40 * k, t, 3, st.hp < 0.35);
      if (st && st.hp < 0.35) flames(ctx, sx - hw * 0.2, sy - 18 * k, 14 * k, t);
      if (!state.battle) levelBadge(ctx, sx + hw * 0.7, sy - hh - 6, b.level);
      if (st && st.hp < 1) hpBarIso(ctx, sx, sy - hh - 70 * k, 44 * k, st.hp);
    }
  }
}

// ---------- Icônes dessinées (sans emoji) ----------
function iconCoin(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, "#fff7d6");
  g.addColorStop(0.5, "#fbbf24");
  g.addColorStop(1, "#92400e");
  disc(ctx, x, y, r, g);
  ctx.strokeStyle = "rgba(120,53,15,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#92400e";
  ctx.font = `${Math.round(r)}px CardTitle`;
  ctx.textAlign = "center";
  ctx.fillText("M", x, y + r * 0.36);
}
function iconCrystal(ctx, x, y, r) {
  poly(ctx, [[x, y - r], [x + r * 0.7, y - r * 0.3], [x + r * 0.45, y + r], [x - r * 0.45, y + r], [x - r * 0.7, y - r * 0.3]], "#9333ea", "#e9d5ff", 1.5);
  poly(ctx, [[x, y - r], [x + r * 0.7, y - r * 0.3], [x, y - r * 0.05], [x - r * 0.7, y - r * 0.3]], "#c084fc");
  poly(ctx, [[x, y - r * 0.05], [x + r * 0.45, y + r], [x - r * 0.45, y + r]], "#7e22ce");
  glow(ctx, x, y, r * 1.8, "#a855f7", 0.35);
}
function iconTrophy(ctx, x, y, r) {
  const g = ctx.createLinearGradient(x - r, 0, x + r, 0);
  g.addColorStop(0, "#b45309");
  g.addColorStop(0.5, "#fde68a");
  g.addColorStop(1, "#b45309");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.8, y - r);
  ctx.lineTo(x + r * 0.8, y - r);
  ctx.quadraticCurveTo(x + r * 0.8, y + r * 0.2, x, y + r * 0.3);
  ctx.quadraticCurveTo(x - r * 0.8, y + r * 0.2, x - r * 0.8, y - r);
  ctx.fill();
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = r * 0.18;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + s * r * 0.85, y - r * 0.55, r * 0.32, s > 0 ? -1.4 : 1.7, s > 0 ? 1.4 : 4.6);
    ctx.stroke();
  }
  ctx.fillRect(x - r * 0.12, y + r * 0.3, r * 0.24, r * 0.4);
  ctx.fillRect(x - r * 0.5, y + r * 0.7, r, r * 0.25);
}
function iconHammer(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.7);
  ctx.fillStyle = "#92400e";
  ctx.fillRect(-r * 0.12, -r * 0.3, r * 0.24, r * 1.2);
  ctx.fillStyle = "#9ca3af";
  roundRect(ctx, -r * 0.55, -r * 0.65, r * 1.1, r * 0.45, r * 0.1);
  ctx.fill();
  ctx.restore();
}
function iconStar(ctx, x, y, r, on) {
  star5(ctx, x, y, r, on ? "#fbbf24" : "rgba(255,255,255,0.18)");
  if (on) glow(ctx, x, y, r * 2, "#fbbf24", 0.35);
}
function panel(ctx, x, y, w, h, alpha = 0.78) {
  roundRect(ctx, x, y, w, h, 14);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(30,27,46,${alpha})`);
  g.addColorStop(1, `rgba(12,10,20,${alpha})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(253,230,138,0.55)";
  ctx.lineWidth = 2;
  ctx.stroke();
}
function resBar(ctx, x, y, w, value, cap, color, icon, sub) {
  icon(ctx, x + 16, y + 14, 14);
  roundRect(ctx, x + 36, y + 4, w - 36, 20, 10);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  roundRect(ctx, x + 38, y + 6, Math.max(8, (w - 40) * Math.min(1, value / cap)), 16, 8);
  const g = ctx.createLinearGradient(0, y, 0, y + 24);
  g.addColorStop(0, shade(color, 1.25));
  g.addColorStop(1, shade(color, 0.8));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "13px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${Math.floor(value).toLocaleString("fr-FR")} / ${cap.toLocaleString("fr-FR")}`, x + 36 + (w - 36) / 2, y + 19);
  if (sub) {
    ctx.textAlign = "left";
    ctx.font = "13px CardBold";
    ctx.fillStyle = sub.color ?? "#cbd5e1";
    ctx.fillText(sub.text, x + 40, y + 42);
  }
}

// ---------- Image de la base ----------
async function drawClashBase(base, opts = {}) {
  const W = 1200, H = 980, top = 210;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  skyBackground(ctx, W, H, hashOf(base.owner));
  const view = clashView(W, top);
  floatingIslets(ctx, W, H, view, hashOf(base.owner), 0.3);
  drawIsland(ctx, view, hashOf(base.owner));
  waterfall(ctx, view, 0.3);
  const layout = clashLayout(base);
  if (opts.ranges)
    for (const b of layout) {
      const def = CLASH_BUILDINGS[b.type];
      if (def.kind !== "defense") continue;
      const [sx, sy] = view.iso(b.x, b.y);
      ctx.fillStyle = rgba(def.color, 0.1);
      ctx.strokeStyle = rgba(def.color, 0.5);
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.ellipse(sx, sy, def.range * view.tw * 0.71, def.range * view.th * 0.71, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.setLineDash([]);
    }
  drawClashScene(ctx, base, layout, view, { t: 0.3 });
  birds(ctx, W, H, hashOf(base.owner), 0.3);
  // bulles de récolte au-dessus des mines qui se remplissent
  if (!base.ghost && !opts.ranges)
    for (const b of layout) {
      const def = CLASH_BUILDINGS[b.type];
      if (!def.res || b.upgrading) continue;
      const stock = base.buildings.find((x) => x.id === b.id)?.stock ?? 0, max = def.rate(b.level) * CLASH_BUFFER_HOURS;
      if (stock < def.rate(b.level) * 0.5) continue;
      const [sx, sy] = view.iso(b.x, b.y);
      collectBubble(ctx, sx, sy - 112, def.res, stock / max, Math.floor(stock));
    }
  goldenLight(ctx, W, H);
  // bandeau du haut
  panel(ctx, 20, 18, 560, 120);
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(base.ghost ? "MAISON FANTÔME" : "CLASH DE LA MAISON", 42, 50);
  ctx.font = `${fitText(ctx, base.name, 380, 38, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(base.name, 42, 92);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(`Manoir niveau ${manoirOf(base)}`, 42, 122);
  if (!base.ghost) {
    iconTrophy(ctx, 470, 72, 22);
    ctx.textAlign = "center";
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(String(base.trophies), 470, 122);
  }
  panel(ctx, 600, 18, 580, 120);
  const cap = clashCap(base), rates = clashRates(base), buf = clashBuffers(base), prize = lootOf(base, 100);
  const sub = (res) =>
    opts.ranges || base.ghost
      ? { text: `jusqu'à ${prize[res].toLocaleString("fr-FR")} à piller`, color: "#fca5a5" }
      : buf[res] > 0
        ? { text: `${buf[res].toLocaleString("fr-FR")} à récolter`, color: "#86efac" }
        : { text: `+${rates[res]} par heure`, color: "#cbd5e1" };
  resBar(ctx, 620, 34, 260, base.res.or, cap, "#f59e0b", iconCoin, sub("or"));
  resBar(ctx, 900, 34, 260, base.res.essence, cap, "#a855f7", iconCrystal, sub("essence"));
  if (!base.ghost && base.shield > Date.now()) {
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText("Bouclier actif", 620, 118);
  }
  // chantiers en cours
  if (!base.ghost) {
    const works = base.buildings.filter((x) => x.upgrading);
    panel(ctx, 20, H - 118, W - 40, 98);
    ctx.textAlign = "left";
    ctx.font = "14px CardEngrave";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("OUVRIERS", 42, H - 88);
    for (let k = 0; k < CLASH_BUILDERS; k++) {
      const x = 42 + k * 560, y = H - 76, w = works[k];
      iconHammer(ctx, x + 14, y + 22, 14);
      ctx.font = "16px CardBold";
      ctx.fillStyle = w ? "#ffffff" : "#94a3b8";
      ctx.fillText(w ? `${CLASH_BUILDINGS[w.type].name} : passage au niveau ${w.upgrading.to}` : "Libre — prêt à construire", x + 40, y + 18);
      if (w) {
        const total = CLASH_BUILDINGS[w.type].time(w.upgrading.to) * MINUTE, left = Math.max(0, w.upgrading.done - Date.now());
        roundRect(ctx, x + 40, y + 28, 440, 12, 6);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fill();
        roundRect(ctx, x + 40, y + 28, Math.max(8, 440 * (1 - left / Math.max(1, total))), 12, 6);
        ctx.fillStyle = "#facc15";
        ctx.fill();
        ctx.font = "12px CardText";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`encore ${minutesText(Math.ceil(left / MINUTE))}`, x + 40, y + 56);
      }
    }
  }
  return c;
}

// ---------- Animation du combat : une petite cinématique ----------
// intro (titre, zoom), combat suivi par la caméra, ralenti quand le Manoir tombe, puis bilan (étoiles, butin)
const easeOut = (p) => 1 - (1 - Math.max(0, Math.min(1, p))) ** 3;
const lerp = (a, b, p) => a + (b - a) * p;
function letterbox(ctx, W, H, k) {
  if (k <= 0) return;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, W, 62 * k);
  ctx.fillRect(0, H - 62 * k, W, 62 * k);
}
function bigTitle(ctx, text, x, y, size, colors, alpha = 1, scale = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.font = `${fitText(ctx, text, 760, size, "CardTitle")}px CardTitle`;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.lineWidth = size * 0.13;
  ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -size * 0.8, 0, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
function outlinedText(ctx, text, x, y, font, color, align = "center") {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
function lootPopup(ctx, x, y, p, amounts) {
  const parts = [["or", iconCoin, "#fde68a"], ["essence", iconCrystal, "#f3e8ff"]].filter(([r]) => amounts[r] > 0);
  if (!parts.length) return;
  const a = p < 0.65 ? 1 : Math.max(0, 1 - (p - 0.65) / 0.35), yy = y - 40 - easeOut(p * 1.5) * 46;
  ctx.save();
  ctx.globalAlpha = a;
  parts.forEach(([r, icon, col], i) => {
    const px = x + (i - (parts.length - 1) / 2) * 92;
    icon(ctx, px - 24, yy - 7, 11);
    outlinedText(ctx, `+${amounts[r].toLocaleString("fr-FR")}`, px - 9, yy, "20px CardTitle", col, "left");
  });
  ctx.restore();
}
// explosion : boule de feu, onde de choc, débris
function explosion(ctx, x, y, q, big = 1, seed = 1) {
  const R = seeded(seed);
  glow(ctx, x, y - 24 * big, 110 * big * (0.45 + q), "#f97316", 0.9 * (1 - q));
  glow(ctx, x, y - 24 * big, 55 * big * (0.4 + q * 0.6), "#fef3c7", 0.9 * (1 - q) ** 2);
  ctx.strokeStyle = `rgba(255,237,213,${0.9 * (1 - q)})`;
  ctx.lineWidth = 5 * (1 - q) + 1;
  ctx.beginPath();
  ctx.ellipse(x, y, (34 + q * 110) * big, (17 + q * 55) * big, 0, 0, TAU);
  ctx.stroke();
  for (let j = 0; j < 18; j++) {
    const a = R() * TAU, v = (40 + R() * 90) * big, up = (30 + R() * 70) * big;
    const px = x + Math.cos(a) * v * q, py = y - 20 - up * q + Math.sin(a) * v * 0.45 * q + 160 * q * q * big;
    const s = (2 + R() * 4) * (1 - q * 0.6) * big;
    ctx.fillStyle = j % 3 === 0 ? "#fbbf24" : j % 3 === 1 ? "#57534e" : "#a8a29e";
    ctx.fillRect(px - s / 2, py - s / 2, s, s);
  }
  for (let j = 0; j < 5; j++) {
    ctx.fillStyle = `rgba(41,37,36,${0.45 * q * (1 - q) * 2})`;
    ctx.beginPath();
    ctx.arc(x + (j - 2) * 16 * big, y - 30 * big - q * 60 * big, (16 + q * 26) * big, 0, TAU);
    ctx.fill();
  }
}
async function clashBattleGif(base, sim, attackerName, info = {}) {
  const W = 840, H = 630, WW = 1200, WH = 900, FULL = W / WW;
  const view = clashView(WW, 168);
  const seed = hashOf(base.owner), RS = seeded(seed + 3);
  const layout = clashLayout(base), decor = islandDecor(base, layout);
  const bg = createCanvas(WW, WH);
  {
    const g = bg.getContext("2d");
    skyBackground(g, WW, WH, seed);
    floatingIslets(g, WW, WH, view, seed, 0);
    drawIsland(g, view, seed);
  }
  const world = createCanvas(WW, WH), wctx = world.getContext("2d");
  const roleOf = new Map(sim.troops.map((t) => [t.key, t.role]));
  const ringOf = new Map(sim.troops.map((t) => [t.key, METAL[t.card.rarity]?.[2] ?? "#fde68a"]));
  const loot = info.loot ?? { or: 0, essence: 0 }, trophies = info.trophies ?? 0, last = sim.frames.at(-1);
  // le butin s'échappe des bâtiments qui en contiennent
  const deadIds = new Set(last.blds.filter((b) => b.dead).map((b) => b.id));
  const holders = {
    or: layout.filter((b) => deadIds.has(b.id) && ["mine", "coffre", "manoir"].includes(b.type)).map((b) => b.id),
    essence: layout.filter((b) => deadIds.has(b.id) && ["distillerie", "coffre", "manoir"].includes(b.type)).map((b) => b.id),
  };
  const lootAt = (id) => ({ or: holders.or.includes(id) ? Math.floor(loot.or / holders.or.length) : 0, essence: holders.essence.includes(id) ? Math.floor(loot.essence / holders.essence.length) : 0 });
  const manoir = layout.find((l) => l.type === "manoir");
  const iso = (x, y) => view.iso(x, y);
  const center = { x: WW / 2, y: iso(CLASH_GRID / 2, CLASH_GRID / 2)[1] + 20 };
  const cam = { x: center.x, y: center.y, s: FULL };
  const troopCenter = (fr) => {
    const alive = fr.troops.filter((t) => !t.dead);
    if (!alive.length) return center;
    const pts = alive.map((t) => iso(t.x, t.y));
    return { x: pts.reduce((a, p) => a + p[0], 0) / pts.length, y: pts.reduce((a, p) => a + p[1], 0) / pts.length - 30 };
  };
  const spawn = sim.frames[0].troops.map((t) => ({ ...t }));
  const shots = [];
  const booms = [], popups = [];
  let shake = 0, banked = { or: 0, essence: 0 };

  // le monde à un instant donné
  const drawWorld = (fr, idx, t, opts = {}) => {
    wctx.drawImage(bg, 0, 0);
    waterfall(wctx, view, t);
    birds(wctx, WW, WH, seed, t);
    if (opts.portals > 0)
      for (const p of spawn) {
        const [x, y] = iso(p.x, p.y), a = opts.portals;
        glow(wctx, x, y - 10, 46, "#a855f7", 0.7 * a);
        wctx.strokeStyle = `rgba(233,213,255,${0.9 * a})`;
        wctx.lineWidth = 3;
        wctx.beginPath();
        wctx.ellipse(x, y, 20, 9, 0, 0, TAU);
        wctx.stroke();
        const g = wctx.createLinearGradient(0, y - 120, 0, y);
        g.addColorStop(0, "rgba(216,180,254,0)");
        g.addColorStop(1, `rgba(216,180,254,${0.55 * a})`);
        wctx.fillStyle = g;
        wctx.fillRect(x - 12, y - 120, 24, 120);
      }
    const bmap = new Map(fr.blds.map((b) => [b.id, b]));
    const aims = new Map();
    for (const s of fr.shots) {
      if (s.troop) continue;
      const b = layout.find((l) => Math.abs(l.x - s.x1) < 0.01 && Math.abs(l.y - s.y1) < 0.01);
      if (!b) continue;
      const [x1, y1] = iso(s.x1, s.y1), [x2, y2] = iso(s.x2, s.y2);
      aims.set(b.id, Math.atan2(y2 - y1, x2 - x1));
    }
    const troops = opts.hideTroops
      ? []
      : fr.troops
          .filter((x) => !x.dead)
          .map((x) => {
            const p = opts.prev?.troops.find((y) => y.key === x.key);
            return { x: x.x, y: x.y, hp: x.hp, role: roleOf.get(x.key), ring: ringOf.get(x.key), dir: p && iso(x.x, x.y)[0] < iso(p.x, p.y)[0] ? -1 : 1 };
          });
    drawClashScene(wctx, base, layout, view, { t, blds: bmap, troops, decor, aims, battle: true });
    // projectiles
    if (!opts.noShots)
      for (const s of fr.shots) {
        const [x1, y1] = iso(s.x1, s.y1), [x2, y2] = iso(s.x2, s.y2);
        const p = 0.35 + ((idx * 0.37) % 0.5);
        const px = x1 + (x2 - x1) * p, arc = s.splash ? 80 : s.troop ? 10 : 20, py = y1 - 34 + (y2 - y1 + 34) * p - Math.sin(p * Math.PI) * arc;
        if (s.troop) {
          const a = Math.atan2(y2 - y1, x2 - x1);
          wctx.strokeStyle = "#fef3c7";
          wctx.lineWidth = 2.5;
          wctx.beginPath();
          wctx.moveTo(px - Math.cos(a) * 11, py - Math.sin(a) * 11);
          wctx.lineTo(px, py);
          wctx.stroke();
          glow(wctx, x2, y2 - 14, 14, "#fde68a", 0.5);
        } else if (s.splash) {
          wctx.strokeStyle = "rgba(255,255,255,0.35)";
          wctx.setLineDash([2, 6]);
          wctx.beginPath();
          wctx.moveTo(x1, y1 - 34);
          wctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 110, px, py);
          wctx.stroke();
          wctx.setLineDash([]);
          glow(wctx, px, py, 16, "#fb923c", 0.5);
          disc(wctx, px, py, 6, "#111827");
          glow(wctx, x2, y2, 36, "#f97316", 0.35);
          wctx.strokeStyle = "rgba(251,146,60,0.75)";
          wctx.lineWidth = 2;
          wctx.beginPath();
          wctx.ellipse(x2, y2, 32, 16, 0, 0, TAU);
          wctx.stroke();
        } else if (s.color === CLASH_BUILDINGS.tour.color) {
          const a = Math.atan2(y2 - (y1 - 70), x2 - x1);
          wctx.strokeStyle = "#e2e8f0";
          wctx.lineWidth = 2.5;
          wctx.beginPath();
          wctx.moveTo(px - Math.cos(a) * 14, py - 36 - Math.sin(a) * 14);
          wctx.lineTo(px, py - 36);
          wctx.stroke();
        } else {
          const b = layout.find((l) => Math.abs(l.x - s.x1) < 0.01 && Math.abs(l.y - s.y1) < 0.01), a = aims.get(b?.id) ?? 0;
          glow(wctx, x1 + Math.cos(a) * 40, y1 - 36 + Math.sin(a) * 40, 22, "#fde68a", 0.65);
          for (let k = 1; k < 4; k++) disc(wctx, px - Math.cos(a) * k * 7, py - Math.sin(a) * k * 7, 4 - k, `rgba(203,213,225,${0.5 - k * 0.12})`);
          disc(wctx, px, py, 5, "#111827");
          disc(wctx, px - 1.5, py - 1.5, 1.6, "#9ca3af");
        }
      }
  };
  // cadrage de la caméra, tremblement, lumière
  const present = () => {
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    const sw = W / cam.s, sh = H / cam.s;
    const jx = shake ? (RS() - 0.5) * shake * 2 : 0, jy = shake ? (RS() - 0.5) * shake * 2 : 0;
    const x0 = Math.max(0, Math.min(WW - sw, cam.x - sw / 2 + jx)), y0 = Math.max(0, Math.min(WH - sh, cam.y - sh / 2 + jy));
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(world, x0, y0, sw, sh, 0, 0, W, H);
    goldenLight(ctx, W, H);
    return ctx;
  };
  const push = (ctx, delay) => shots.push({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H, delay, once: true });
  // tableau de bord pendant l'assaut
  const hud = (ctx, fr, alpha) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    panel(ctx, 14, 12, W - 28, 80, 0.8);
    ctx.textAlign = "left";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#86efac";
    ctx.fillText(`${info.war ? "Guerre — " : ""}${attackerName} attaque`.toUpperCase().slice(0, 44), 34, 40);
    ctx.font = `${fitText(ctx, base.name, 420, 28, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(base.name, 34, 74);
    const bm = new Map(fr.blds.map((b) => [b.id, b]));
    const stars = (fr.pct >= 50 ? 1 : 0) + (manoir && bm.get(manoir.id)?.dead ? 1 : 0) + (fr.pct >= 100 ? 1 : 0);
    for (let k = 0; k < 3; k++) iconStar(ctx, W - 318 + k * 42, 52, 16, k < stars);
    ctx.textAlign = "right";
    ctx.font = "38px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${fr.pct} %`, W - 34, 62);
    ctx.font = "12px CardBold";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`${Math.max(0, Math.round(60 - fr.t))} s`, W - 34, 82);
    // soldats
    const alive = fr.troops.filter((x) => !x.dead).length;
    panel(ctx, 14, H - 66, 330, 52, 0.8);
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Soldats : ${alive} / ${fr.troops.length}`, 32, H - 34);
    for (let k = 0; k < Math.min(9, fr.troops.length); k++) {
      const tr = fr.troops[k];
      ctx.globalAlpha = alpha * (tr.dead ? 0.25 : 1);
      drawSoldier(ctx, 180 + k * 17, H - 24, roleOf.get(tr.key), 0, 1, ringOf.get(tr.key), 0.72);
    }
    ctx.globalAlpha = alpha;
    // butin qui s'accumule
    if (!info.war) {
      panel(ctx, W - 314, H - 66, 300, 52, 0.8);
      iconCoin(ctx, W - 288, H - 40, 12);
      iconCrystal(ctx, W - 150, H - 40, 12);
      ctx.textAlign = "left";
      ctx.font = "18px CardTitle";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(banked.or.toLocaleString("fr-FR"), W - 268, H - 33);
      ctx.fillStyle = "#e9d5ff";
      ctx.fillText(banked.essence.toLocaleString("fr-FR"), W - 130, H - 33);
    }
    ctx.restore();
  };

  // 1. Intro : l'île apparaît, la caméra plonge, titre
  const spawnC = troopCenter(sim.frames[0]);
  const INTRO = 10;
  for (let f = 0; f < INTRO; f++) {
    await yieldLoop();
    const p = f / (INTRO - 1);
    cam.s = lerp(FULL, 0.98, easeOut(p));
    cam.x = lerp(center.x, lerp(center.x, spawnC.x, 0.45), easeOut(p));
    cam.y = lerp(center.y, lerp(center.y, spawnC.y, 0.45), easeOut(p));
    drawWorld(sim.frames[0], 0, p * 0.9, { hideTroops: true, noShots: true, portals: f >= 7 ? (f - 6) / 5 : 0 });
    const ctx = present();
    if (f < 3) {
      ctx.fillStyle = `rgba(0,0,0,${1 - f / 3})`;
      ctx.fillRect(0, 0, W, H);
    }
    letterbox(ctx, W, H, 1);
    const ta = f < 2 ? 0 : f <= 8 ? Math.min(1, (f - 1) / 3) : 1 - (f - 8) / 3.5;
    const sc = f < 2 ? 1.6 : 1 + 0.6 * (1 - easeOut((f - 2) / 4));
    outlinedText(ctx, (info.war ? "GUERRE DES ÉQUIPES" : "CLASH DE LA MAISON"), W / 2, H / 2 - 92, "18px CardEngrave", `rgba(253,230,138,${Math.max(0, ta)})`);
    bigTitle(ctx, "À L'ASSAUT !", W / 2, H / 2 - 10, 92, ["#ffffff", "#fbbf24"], ta, sc);
    ctx.save();
    ctx.globalAlpha = Math.max(0, ta);
    outlinedText(ctx, `${attackerName}  contre  ${base.name}`, W / 2, H / 2 + 42, "26px CardBold", "#ffffff");
    ctx.restore();
    push(ctx, f === INTRO - 1 ? 160 : 90);
  }

  // 2. Le combat, suivi par la caméra
  const step = Math.max(1, Math.ceil(sim.frames.length / 36));
  const picks = sim.frames.map((f, i) => ({ f, i })).filter(({ i }) => i % step === 0 || i === sim.frames.length - 1);
  let prev = null, manoirDone = false;
  for (const [fi, { f: fr, i: idx }] of picks.entries()) {
    await yieldLoop();
    const startK = prev ? sim.frames.indexOf(prev) + 1 : 0;
    let manoirNow = false;
    for (let k = startK; k <= idx; k++)
      for (const b of sim.frames[k].booms) {
        const l = layout.find((x) => Math.abs(x.x - b.x) < 0.01 && Math.abs(x.y - b.y) < 0.01);
        booms.push({ ...b, id: l?.id, at: fi });
        shake = Math.max(shake, 10 + (b.size ?? 2) * 2);
        if (l && l.id === manoir?.id) manoirNow = true;
        const amt = l ? lootAt(l.id) : null;
        if (amt && amt.or + amt.essence > 0 && !info.war) popups.push({ x: b.x, y: b.y, amt, at: fi });
      }
    for (const pp of popups) if (pp.at === fi) (banked.or += pp.amt.or), (banked.essence += pp.amt.essence);
    if (fi === picks.length - 1) banked = { ...loot };
    // caméra : elle suit le centre des troupes, avec un peu de recul
    const tc = troopCenter(fr), tgt = { x: lerp(center.x, tc.x, 0.7), y: lerp(center.y, tc.y, 0.7) };
    const ease = fi < 3 ? 0.12 : 0.24;
    cam.x = lerp(cam.x, tgt.x, ease);
    cam.y = lerp(cam.y, tgt.y, ease);
    cam.s = lerp(cam.s, 1.06, 0.2);
    drawWorld(fr, idx, fr.t, { prev, portals: fi < 6 ? 1 - fi / 6 : 0 });
    for (const bm of booms.filter((x) => fi - x.at < 5)) {
      const [x, y] = iso(bm.x, bm.y);
      explosion(wctx, x, y, (fi - bm.at) / 5, 0.8 + (bm.size ?? 2) * 0.12, Math.round(bm.x * 31 + bm.y * 17));
    }
    for (const pp of popups.filter((x) => fi - x.at < 9)) {
      const [x, y] = iso(pp.x, pp.y);
      lootPopup(wctx, x, y - 50, (fi - pp.at) / 9, pp.amt);
    }
    const ctx = present();
    shake *= 0.55;
    if (shake < 1) shake = 0;
    letterbox(ctx, W, H, Math.max(0, 1 - fi / 4));
    hud(ctx, fr, Math.min(1, fi / 3));
    if (fi < 4) bigTitle(ctx, "DÉPLOIEMENT", W / 2, H / 2 - 120, 40, ["#f3e8ff", "#a855f7"], 1 - fi / 4);
    push(ctx, 100);

    // 3. Le Manoir tombe : ralenti, zoom et bannière
    if (manoirNow && !manoirDone) {
      manoirDone = true;
      const [mx, my] = iso(manoir.x, manoir.y);
      const s0 = cam.s, x0 = cam.x, y0 = cam.y;
      for (let k = 0; k < 9; k++) {
        await yieldLoop();
        const q = k / 8;
        cam.s = lerp(s0, 1.38, easeOut(q * 1.6));
        cam.x = lerp(x0, mx, easeOut(q * 1.6));
        cam.y = lerp(y0, my - 40, easeOut(q * 1.6));
        shake = k < 4 ? 16 - k * 3 : 0;
        drawWorld(fr, idx, fr.t + k * 0.04, { prev, noShots: true });
        explosion(wctx, mx, my, Math.min(1, q * 1.15), 1.9, 77);
        const ctx2 = present();
        if (k < 2) {
          ctx2.fillStyle = `rgba(255,251,235,${k ? 0.35 : 0.75})`;
          ctx2.fillRect(0, 0, W, H);
        }
        letterbox(ctx2, W, H, Math.min(1, k / 2));
        if (k >= 2) {
          const a = Math.min(1, (k - 1) / 2);
          bigTitle(ctx2, "MANOIR DÉTRUIT", W / 2, H / 2 + 150, 64, ["#ffffff", "#f87171"], a, 1 + 0.4 * (1 - easeOut((k - 2) / 3)));
          ctx2.save();
          ctx2.globalAlpha = a;
          iconStar(ctx2, W / 2, H / 2 + 196, 18, true);
          outlinedText(ctx2, "+1 étoile", W / 2 + 30, H / 2 + 203, "18px CardBold", "#fde68a", "left");
          ctx2.restore();
        }
        push(ctx2, k === 8 ? 420 : 130);
      }
      shake = 0;
    }
    prev = fr;
  }

  // 4. Bilan : la caméra recule, les étoiles tombent une à une, le butin défile
  const OUT = 16, endT = last.t;
  const cs = cam.s, cx0 = cam.x, cy0 = cam.y;
  for (let o = 0; o < OUT; o++) {
    await yieldLoop();
    const p = easeOut(o / 6);
    cam.s = lerp(cs, FULL, p);
    cam.x = lerp(cx0, center.x, p);
    cam.y = lerp(cy0, center.y, p);
    drawWorld(last, picks.at(-1).i, endT + o * 0.08, { noShots: true });
    const ctx = present();
    ctx.fillStyle = `rgba(8,6,20,${0.6 * Math.min(1, o / 5)})`;
    ctx.fillRect(0, 0, W, H);
    letterbox(ctx, W, H, Math.min(1, o / 4));
    if (o >= 2) {
      const win = sim.stars > 0, q = Math.min(1, (o - 2) / 3);
      bigTitle(ctx, win ? "VICTOIRE" : "DÉFAITE", W / 2, H / 2 - 92, 96, win ? ["#ffffff", "#fbbf24"] : ["#ffffff", "#f87171"], q, 1 + 0.5 * (1 - easeOut(q)));
      ctx.save();
      ctx.globalAlpha = q;
      outlinedText(ctx, `${sim.pct} % de destruction`, W / 2, H / 2 - 52, "20px CardBold", "#e2e8f0");
      ctx.restore();
    }
    for (let k = 0; k < 3; k++) {
      const x = W / 2 + (k - 1) * 110, y = H / 2 + 22, at = 5 + k * 2;
      if (k < sim.stars && o >= at) {
        const q = Math.min(1, (o - at) / 2);
        if (o - at === 2) glow(ctx, x, y, 110, "#fde68a", 0.8);
        iconStar(ctx, x, y - 90 * (1 - easeOut(q)), 40 * (1.5 - 0.5 * q), true);
      } else if (o >= 3) iconStar(ctx, x, y, 40, false);
    }
    if (o >= 11) {
      const q = easeOut((o - 11) / 4), parts = [];
      if (!info.war) parts.push([iconCoin, Math.floor(loot.or * q).toLocaleString("fr-FR"), "#fde68a"], [iconCrystal, Math.floor(loot.essence * q).toLocaleString("fr-FR"), "#e9d5ff"]);
      if (trophies) parts.push([iconTrophy, `${trophies > 0 ? "+" : "-"}${Math.round(Math.abs(trophies) * q)}`, trophies > 0 ? "#fde68a" : "#fca5a5"]);
      parts.forEach(([icon, txt, col], i) => {
        const x = W / 2 + (i - (parts.length - 1) / 2) * 180, y = H / 2 + 112;
        panel(ctx, x - 82, y - 28, 164, 52, 0.85);
        icon(ctx, x - 52, y - 2, 15);
        outlinedText(ctx, txt, x - 28, y + 8, "24px CardTitle", col, "left");
      });
    }
    push(ctx, o === OUT - 1 ? 6000 : o < 6 ? 90 : 120);
  }
  const gif = encodeFrames(shots), end = createCanvas(W, H), ectx = end.getContext("2d"), im = ectx.createImageData(W, H);
  im.data.set(shots.at(-1).data);
  ectx.putImageData(im, 0, 0);
  // durée jusqu'à l'apparition du bilan complet
  gif.duration = shots.slice(0, -1).reduce((a, x) => a + x.delay, 0) + 1500;
  gif.poster = await end.encode("jpeg", 88);
  return gif;
}
