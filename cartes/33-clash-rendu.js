
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
  if (t > 0) {
    poly(ctx, [[cx - hw, cy - h], [cx, cy + hh - h], tb, tl], shade(color, 0.78));
    poly(ctx, [[cx, cy + hh - h], [cx + hw, cy - h], tr, tb], shade(color, 0.95));
    poly(ctx, [[cx, ay - hh * t], tr, tb, tl], shade(color, 1.15));
  } else {
    poly(ctx, [[cx - hw, cy - h], [cx, cy + hh - h], [ax, ay]], shade(color, 0.78));
    poly(ctx, [[cx, cy + hh - h], [cx + hw, cy - h], [ax, ay]], shade(color, 0.98));
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
  isoBox(ctx, cx, cy + 3, hw, hh, 7, col, { edge: "rgba(0,0,0,0.15)" });
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
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.2)" });
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
    isoBox(ctx, bx, by, hw * 0.42, hh * 0.42, 30, "#9a3412", { edge: "rgba(0,0,0,0.2)" });
    for (let r = 0; r < 5; r++) {
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      const [x1, y1] = facePt("l", bx, by, hw * 0.42, hh * 0.42, 30, 0, r / 5);
      const [x2, y2] = facePt("l", bx, by, hw * 0.42, hh * 0.42, 30, 1, r / 5);
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
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
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.25)" });
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
    isoBox(ctx, cx, y0, bw, bh, H, m.wall, { edge: "rgba(0,0,0,0.25)" });
    // pierres et meurtrières
    for (let r = 1; r < 6; r++) {
      faceRect(ctx, "l", cx, y0, bw, bh, H, 0, 1, r / 6 - 0.004, r / 6 + 0.004, "rgba(0,0,0,0.18)");
      faceRect(ctx, "r", cx, y0, bw, bh, H, 0, 1, r / 6 - 0.004, r / 6 + 0.004, "rgba(0,0,0,0.12)");
    }
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
  g.addColorStop(0, "#0c4a6e");
  g.addColorStop(0.55, "#38bdf8");
  g.addColorStop(1, "#bae6fd");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(seed);
  for (let k = 0; k < 9; k++) {
    const x = R() * W, y = H * (0.25 + R() * 0.7), s = 30 + R() * 60;
    ctx.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.35})`;
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
  isoBox(ctx, sx, sy, 9, 4.5, 12, ["#8b7d6b", "#9ca3af", "#e7e1d3"][tier], { edge: "rgba(0,0,0,0.2)" });
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
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(sx + 6, sy + 4, hw * 0.95, hh * 0.95, 0, 0, TAU);
      ctx.fill();
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
function resBar(ctx, x, y, w, value, cap, color, icon, rate) {
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
  if (rate) {
    ctx.textAlign = "left";
    ctx.font = "12px CardText";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`+${rate} par heure`, x + 40, y + 40);
  }
}

// ---------- Image de la base ----------
async function drawClashBase(base, opts = {}) {
  const W = 1200, H = 980, top = 210;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  skyBackground(ctx, W, H, hashOf(base.owner));
  const view = clashView(W, top);
  drawIsland(ctx, view, hashOf(base.owner));
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
  const cap = clashCap(base), rates = clashRates(base);
  resBar(ctx, 620, 34, 260, base.res.or, cap, "#f59e0b", iconCoin, base.ghost ? 0 : rates.or);
  resBar(ctx, 900, 34, 260, base.res.essence, cap, "#a855f7", iconCrystal, base.ghost ? 0 : rates.essence);
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

// ---------- Animation du combat ----------
async function clashBattleGif(base, sim, attackerName) {
  const W = 1000, H = 780, top = 150;
  const view = clashView(W, top, 38, 19);
  const layout = clashLayout(base), decor = islandDecor(base, layout);
  const bg = createCanvas(W, H);
  {
    const g = bg.getContext("2d");
    skyBackground(g, W, H, hashOf(base.owner));
    drawIsland(g, view, hashOf(base.owner));
  }
  const roleOf = new Map(sim.troops.map((t) => [t.key, t.role]));
  const ringOf = new Map(sim.troops.map((t) => [t.key, METAL[t.card.rarity]?.[2] ?? "#fde68a"]));
  const step = Math.max(1, Math.ceil(sim.frames.length / 52));
  const picks = sim.frames.map((f, i) => ({ f, i })).filter(({ i }) => i % step === 0 || i === sim.frames.length - 1);
  const shots = [], booms = [];
  let prev = null;
  for (const [fi, { f: fr, i: idx }] of picks.entries()) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(bg, 0, 0);
    const t = fr.t;
    const bmap = new Map(fr.blds.map((b) => [b.id, b]));
    // orientation des canons vers leur cible
    const aims = new Map();
    for (const s of fr.shots) {
      if (s.troop) continue;
      const b = layout.find((l) => Math.abs(l.x - s.x1) < 0.01 && Math.abs(l.y - s.y1) < 0.01);
      if (!b) continue;
      const [x1, y1] = view.iso(s.x1, s.y1), [x2, y2] = view.iso(s.x2, s.y2);
      aims.set(b.id, Math.atan2(y2 - y1, x2 - x1));
    }
    const troops = fr.troops
      .filter((x) => !x.dead)
      .map((x) => {
        const p = prev?.troops.find((y) => y.key === x.key);
        return { x: x.x, y: x.y, hp: x.hp, role: roleOf.get(x.key), ring: ringOf.get(x.key), dir: p && view.iso(x.x, x.y)[0] < view.iso(p.x, p.y)[0] ? -1 : 1 };
      });
    drawClashScene(ctx, base, layout, view, { t, blds: bmap, troops, decor, aims, battle: true });
    // projectiles
    for (const s of fr.shots) {
      const [x1, y1] = view.iso(s.x1, s.y1), [x2, y2] = view.iso(s.x2, s.y2);
      const p = 0.35 + ((idx * 0.37) % 0.5);
      const px = x1 + (x2 - x1) * p, arc = s.splash ? 70 : s.troop ? 10 : 18, py = y1 - 30 + (y2 - y1 + 30) * p - Math.sin(p * Math.PI) * arc;
      if (s.troop) {
        ctx.strokeStyle = "#fef3c7";
        ctx.lineWidth = 2;
        const a = Math.atan2(y2 - y1, x2 - x1);
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * 9, py - Math.sin(a) * 9);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else if (s.splash) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1 - 30);
        ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 90, px, py);
        ctx.stroke();
        ctx.setLineDash([]);
        disc(ctx, px, py, 5, "#111827");
        glow(ctx, x2, y2, 30, "#f97316", 0.35);
        ctx.strokeStyle = "rgba(251,146,60,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(x2, y2, 28, 14, 0, 0, TAU);
        ctx.stroke();
      } else if (s.color === CLASH_BUILDINGS.tour.color) {
        const a = Math.atan2(y2 - (y1 - 60), x2 - x1);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * 12, py - 30 - Math.sin(a) * 12);
        ctx.lineTo(px, py - 30);
        ctx.stroke();
      } else {
        glow(ctx, x1 + Math.cos(aims.get(layout.find((l) => Math.abs(l.x - s.x1) < 0.01 && Math.abs(l.y - s.y1) < 0.01)?.id) ?? 0) * 26, y1 - 24, 18, "#fde68a", 0.6);
        disc(ctx, px, py, 4.5, "#111827");
        disc(ctx, px - 1.5, py - 1.5, 1.5, "#9ca3af");
      }
    }
    // explosions des bâtiments détruits
    for (let k = prev ? sim.frames.indexOf(prev) + 1 : 0; k <= idx; k++) for (const b of sim.frames[k].booms) booms.push({ ...b, at: fi });
    for (const bm of booms.filter((x) => fi - x.at < 4)) {
      const q = (fi - bm.at) / 4, [x, y] = view.iso(bm.x, bm.y);
      glow(ctx, x, y - 20, 90 * (0.5 + q), "#f97316", 0.85 * (1 - q));
      ctx.strokeStyle = `rgba(255,237,213,${1 - q})`;
      ctx.lineWidth = 4 * (1 - q) + 1;
      ctx.beginPath();
      ctx.ellipse(x, y, 30 + q * 80, 15 + q * 40, 0, 0, TAU);
      ctx.stroke();
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * TAU, r = 20 + q * 70;
        disc(ctx, x + Math.cos(a) * r, y - 20 + Math.sin(a) * r * 0.6 + q * q * 30, 4 * (1 - q) + 1, j % 2 ? "#78716c" : "#fbbf24");
      }
    }
    // tableau de bord
    panel(ctx, 16, 14, W - 32, 96, 0.82);
    ctx.textAlign = "left";
    ctx.font = "14px CardEngrave";
    ctx.fillStyle = "#86efac";
    ctx.fillText(`${attackerName} attaque`.toUpperCase().slice(0, 40), 36, 44);
    ctx.font = `${fitText(ctx, base.name, 380, 30, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(base.name, 36, 82);
    const manoir = layout.find((l) => l.type === "manoir"), curStars = (fr.pct >= 50 ? 1 : 0) + (manoir && bmap.get(manoir.id)?.dead ? 1 : 0) + (fr.pct >= 100 ? 1 : 0);
    for (let k = 0; k < 3; k++) iconStar(ctx, W - 330 + k * 46, 62, 18, k < curStars);
    ctx.textAlign = "right";
    ctx.font = "40px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${fr.pct} %`, W - 40, 72);
    ctx.font = "13px CardBold";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`${Math.max(0, Math.round(60 - t))} s`, W - 40, 96);
    // troupes en vie
    const alive = fr.troops.filter((x) => !x.dead).length;
    panel(ctx, 16, H - 70, 300, 54, 0.82);
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Troupes : ${alive} / ${fr.troops.length}`, 34, H - 37);
    for (let k = 0; k < Math.min(8, fr.troops.length); k++) {
      const tr = fr.troops[k];
      ctx.globalAlpha = tr.dead ? 0.25 : 1;
      drawSoldier(ctx, 180 + k * 16, H - 26, roleOf.get(tr.key), 0, 1, ringOf.get(tr.key), 0.7);
      ctx.globalAlpha = 1;
    }
    // résultat
    if (fi === picks.length - 1) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, H / 2 - 90, W, 180);
      ctx.textAlign = "center";
      ctx.font = "64px CardTitle";
      const g = ctx.createLinearGradient(0, H / 2 - 60, 0, H / 2);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(1, sim.stars ? "#fbbf24" : "#f87171");
      ctx.fillStyle = g;
      ctx.fillText(sim.stars ? "VICTOIRE" : "DÉFAITE", W / 2, H / 2 - 10);
      for (let k = 0; k < 3; k++) iconStar(ctx, W / 2 - 70 + k * 70, H / 2 + 48, 28, k < sim.stars);
    }
    shots.push({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H, delay: fi === picks.length - 1 ? 5000 : 110, once: true });
    prev = fr;
  }
  return encodeFrames(shots);
}
