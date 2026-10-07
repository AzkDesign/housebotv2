
// --- Décors d'Arène, version détaillée : plusieurs plans, lumière et atmosphère ---
// Chaque décor est dessiné pour 1200×700 (et réduit pour les animations de manche) ; le centre reste
// assez sombre pour que les cartes ressortent, et le sol de l'arène prend la matière du décor.
const decorHD = new Map();
function decorSky(ctx, W, H, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  stops.forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
function softCloud(ctx, x, y, w, h, col) {
  ctx.save();
  ctx.filter = `blur(${Math.round(h * 0.35)}px)`;
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    ctx.beginPath();
    ctx.ellipse(x + (k - 2) * w * 0.2, y + Math.abs(k - 2) * h * 0.12, w * 0.28, h * 0.5, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}
function lightShafts(ctx, x, y, W, H, col, n, spread, R) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < n; k++) {
    const a = Math.PI / 2 + (R() - 0.5) * spread, len = H * 1.4, w = 30 + R() * 70;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.addColorStop(0, rgba(col, 0.16));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 10, y);
    ctx.lineTo(x + Math.cos(a) * len - w, y + Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a) * len + w, y + Math.sin(a) * len);
    ctx.lineTo(x + 10, y);
    ctx.fill();
  }
  ctx.restore();
}
// sol de l'arène, dans la matière du décor
function decorFloor(ctx, W, H, ring, mat) {
  const fy = H * 0.66;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(W / 2, fy, W * 0.47, H * 0.13, 0, 0, TAU);
  const g = ctx.createRadialGradient(W / 2, fy, 10, W / 2, fy, W * 0.47);
  g.addColorStop(0, rgba(mat, 0.75));
  g.addColorStop(0.75, rgba(shade(mat, 0.6), 0.6));
  g.addColorStop(1, rgba(shade(mat, 0.4), 0));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // dalles concentriques
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 1.5;
  for (let k = 1; k < 6; k++) {
    ctx.beginPath();
    ctx.ellipse(W / 2, fy, W * 0.47 * (k / 6), H * 0.13 * (k / 6), 0, 0, TAU);
    ctx.stroke();
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * W * 0.08, fy + Math.sin(a) * H * 0.022);
    ctx.lineTo(W / 2 + Math.cos(a) * W * 0.47, fy + Math.sin(a) * H * 0.13);
    ctx.stroke();
  }
  ctx.restore();
  for (const [rx, a, lw] of [[0.47, 0.75, 3], [0.4, 0.35, 2], [0.3, 0.2, 1.5]]) {
    ctx.save();
    ctx.shadowColor = ring;
    ctx.shadowBlur = rx === 0.47 ? 18 : 0;
    ctx.strokeStyle = rgba(ring, a);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(W / 2, fy, W * rx, H * 0.13 * (rx / 0.47), 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}
function decorVignette(ctx, W, H, strength = 0.55) {
  const v = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.3, W / 2, H * 0.5, W * 0.7);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// --- Colisée au coucher du soleil ---
function decorColisee(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#3b0a0a"], [0.35, "#b45309"], [0.6, "#f59e0b"], [1, "#78350f"]]);
  glow(ctx, W * 0.5, H * 0.42, W * 0.45, "#fde68a", 0.55);
  disc(ctx, W * 0.5, H * 0.42, H * 0.09, "#fff7d6");
  for (let k = 0; k < 6; k++) softCloud(ctx, R() * W, H * (0.08 + R() * 0.2), 260 + R() * 200, 40, `rgba(124,45,18,${0.35 + R() * 0.3})`);
  lightShafts(ctx, W * 0.5, H * 0.42, W, H, "#fde68a", 9, 2.6, R);
  // l'amphithéâtre : une courbe de trois étages d'arches, en perspective
  const cx = W / 2, top = H * 0.2, base = H * 0.58;
  const tiers = [
    [top, H * 0.12, 26, "#b45309"],
    [top + H * 0.12, H * 0.12, 22, "#92400e"],
    [top + H * 0.24, H * 0.14, 18, "#78350f"],
  ];
  // masse de pierre
  const stone = ctx.createLinearGradient(0, top, 0, base);
  stone.addColorStop(0, "#c2410c");
  stone.addColorStop(1, "#451a03");
  ctx.fillStyle = stone;
  ctx.beginPath();
  ctx.moveTo(0, base);
  ctx.lineTo(0, top + 30);
  ctx.quadraticCurveTo(cx, top - 50, W, top + 30);
  ctx.lineTo(W, base);
  ctx.closePath();
  ctx.fill();
  // bord supérieur abîmé
  ctx.fillStyle = "#3b0a0a";
  for (let x = 0; x < W; x += 18) {
    const y = top + 30 - Math.sin((x / W) * Math.PI) * 80;
    ctx.fillRect(x, y - (R() < 0.3 ? 14 : 4), 10, 18);
  }
  for (const [y0, h, n, col] of tiers) {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = u * W, curve = Math.sin(u * Math.PI);
      const y = y0 + 30 - curve * 80 + h * 0.18, aw = (W / n) * 0.6, ah = h * 0.7;
      // arche sombre et sa lumière
      ctx.fillStyle = "rgba(20,6,2,0.85)";
      ctx.beginPath();
      ctx.moveTo(x - aw / 2, y + ah);
      ctx.lineTo(x - aw / 2, y + aw / 2);
      ctx.arc(x, y + aw / 2, aw / 2, Math.PI, 0);
      ctx.lineTo(x + aw / 2, y + ah);
      ctx.fill();
      ctx.strokeStyle = rgba("#fde68a", 0.25);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // colonne entre deux arches
      ctx.fillStyle = shade(col, 1.25);
      ctx.fillRect(x + W / n / 2 - 3, y, 6, ah);
    }
    // corniche
    ctx.strokeStyle = "rgba(253,230,138,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y0 + 30 - Math.sin((x / W) * Math.PI) * 80 + h);
    ctx.stroke();
  }
  // étendards
  for (const u of [0.18, 0.82]) {
    const x = W * u, y = H * 0.12;
    ctx.fillStyle = "#3f1d0b";
    ctx.fillRect(x - 2, y, 4, H * 0.3);
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    ctx.lineTo(x + 52, y + 14);
    ctx.lineTo(x + 40, y + 34);
    ctx.lineTo(x + 52, y + 54);
    ctx.lineTo(x + 2, y + 50);
    ctx.fill();
    star5(ctx, x + 22, y + 30, 8, "#fbbf24");
  }
  // sable de l'arène et poussière dorée
  const sand = ctx.createLinearGradient(0, base, 0, H);
  sand.addColorStop(0, "#d97706");
  sand.addColorStop(1, "#451a03");
  ctx.fillStyle = sand;
  ctx.fillRect(0, base, W, H - base);
  for (let k = 0; k < 400; k++) disc(ctx, R() * W, base + R() * (H - base), R() * 1.4, `rgba(${R() < 0.5 ? "0,0,0" : "255,237,213"},${0.08 + R() * 0.15})`);
  for (let k = 0; k < 60; k++) disc(ctx, R() * W, R() * H * 0.7, R() * 1.8 + 0.4, `rgba(253,230,138,${0.2 + R() * 0.5})`);
  return { ring: "#fde68a", mat: "#b45309" };
}

// --- Toits de Paris, la nuit ---
function parisRoofs(ctx, W, base, s, col, lit, R) {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, base + 200);
  let x = 0;
  const wins = [];
  while (x < W) {
    const bw = (60 + R() * 90) * s, bh = (40 + R() * 70) * s, roof = bh * 0.45;
    ctx.lineTo(x, base - bh);
    // toit mansardé
    ctx.lineTo(x + bw * 0.12, base - bh - roof);
    ctx.lineTo(x + bw * 0.88, base - bh - roof);
    ctx.lineTo(x + bw, base - bh);
    // cheminées
    for (let c = 0; c < 2; c++) if (R() < 0.6) wins.push(["chem", x + bw * (0.25 + c * 0.4), base - bh - roof, s]);
    // lucarnes et fenêtres
    for (let k = 0; k < 3; k++) wins.push(["luc", x + bw * (0.22 + k * 0.28), base - bh - roof * 0.45, s]);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) wins.push(["win", x + bw * (0.2 + k * 0.3), base - bh + 10 * s + r * 18 * s, s]);
    x += bw;
  }
  ctx.lineTo(W, base + 200);
  ctx.closePath();
  ctx.fill();
  for (const [kind, wx, wy, sc] of wins) {
    if (kind === "chem") {
      ctx.fillStyle = col;
      ctx.fillRect(wx - 6 * sc, wy - 18 * sc, 12 * sc, 18 * sc);
      ctx.fillStyle = "#9a3412";
      for (let p = 0; p < 3; p++) ctx.fillRect(wx - 5 * sc + p * 4 * sc, wy - 22 * sc, 2.5 * sc, 5 * sc);
    } else if (R() < lit) {
      const w = (kind === "luc" ? 7 : 8) * sc, h = (kind === "luc" ? 9 : 11) * sc;
      glow(ctx, wx, wy + h / 2, 16 * sc, "#fbbf24", 0.25);
      ctx.fillStyle = R() < 0.25 ? "#fef3c7" : "#fbbf24";
      ctx.fillRect(wx - w / 2, wy, w, h);
    }
  }
}
function eiffelTower(ctx, x, base, h) {
  const w = h * 0.36;
  ctx.save();
  ctx.fillStyle = "#1c1917";
  ctx.strokeStyle = "rgba(251,191,36,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, base);
  ctx.quadraticCurveTo(x - w * 0.16, base - h * 0.35, x - w * 0.05, base - h * 0.85);
  ctx.lineTo(x - 2, base - h);
  ctx.lineTo(x + 2, base - h);
  ctx.lineTo(x + w * 0.05, base - h * 0.85);
  ctx.quadraticCurveTo(x + w * 0.16, base - h * 0.35, x + w / 2, base);
  ctx.lineTo(x + w * 0.32, base);
  ctx.quadraticCurveTo(x, base - h * 0.2, x - w * 0.32, base);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // plates-formes et treillis lumineux
  for (const [p, pw] of [[0.28, 0.42], [0.58, 0.2]]) {
    ctx.fillStyle = "#292524";
    ctx.fillRect(x - w * pw / 2, base - h * p, w * pw, 4);
    ctx.strokeRect(x - w * pw / 2, base - h * p, w * pw, 4);
  }
  ctx.strokeStyle = "rgba(251,191,36,0.3)";
  for (let k = 0; k < 14; k++) {
    const y = base - (h * 0.85 * k) / 14, half = (w / 2) * (1 - k / 14) ** 1.6 + 2;
    ctx.beginPath();
    ctx.moveTo(x - half, y);
    ctx.lineTo(x + half * 0.6, y - h / 28);
    ctx.moveTo(x + half, y);
    ctx.lineTo(x - half * 0.6, y - h / 28);
    ctx.stroke();
  }
  glow(ctx, x, base - h, 40, "#fde68a", 0.9);
  ctx.restore();
}
function decorParis(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#020617"], [0.45, "#1e1b4b"], [0.75, "#4c1d95"], [1, "#7c2d12"]]);
  for (let k = 0; k < 220; k++) disc(ctx, R() * W, R() * H * 0.55, R() * 1.3 + 0.2, `rgba(255,255,255,${0.15 + R() * 0.7})`);
  for (let k = 0; k < 8; k++) sparkle(ctx, R() * W, R() * H * 0.4, 3 + R() * 3, "rgba(255,255,255,0.8)");
  // lune et halo
  glow(ctx, W * 0.84, H * 0.14, 220, "#e0e7ff", 0.35);
  disc(ctx, W * 0.84, H * 0.14, 34, "#f8fafc");
  disc(ctx, W * 0.84 + 9, H * 0.14 - 6, 7, "rgba(148,163,184,0.35)");
  for (let k = 0; k < 4; k++) softCloud(ctx, R() * W, H * (0.15 + R() * 0.2), 300, 26, "rgba(76,29,149,0.45)");
  // trois plans de toits, du plus loin au plus proche
  parisRoofs(ctx, W, H * 0.5, 0.55, "#1e1b4b", 0.25, R);
  eiffelTower(ctx, W * 0.24, H * 0.5, H * 0.46);
  parisRoofs(ctx, W, H * 0.56, 0.8, "#0f0d2a", 0.35, R);
  // brume lumineuse au-dessus de la ville
  const haze = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.6);
  haze.addColorStop(0, "rgba(251,146,60,0)");
  haze.addColorStop(1, "rgba(251,146,60,0.18)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, H * 0.4, W, H * 0.2);
  // toit de zinc au premier plan
  const zinc = ctx.createLinearGradient(0, H * 0.58, 0, H);
  zinc.addColorStop(0, "#334155");
  zinc.addColorStop(1, "#0f172a");
  ctx.fillStyle = zinc;
  ctx.fillRect(0, H * 0.58, W, H * 0.42);
  ctx.strokeStyle = "rgba(148,163,184,0.25)";
  ctx.lineWidth = 2;
  for (let x = -H; x < W + H; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, H * 0.58);
    ctx.lineTo(x - H * 0.25, H);
    ctx.stroke();
  }
  return { ring: "#c4b5fd", mat: "#475569" };
}

// --- Temple au soleil levant ---
function sakuraTree(ctx, x, y, s, R) {
  ctx.strokeStyle = "#3f1d0b";
  ctx.lineCap = "round";
  const branch = (bx, by, len, a, d) => {
    if (d <= 0) {
      for (let k = 0; k < 4; k++) disc(ctx, bx + (R() - 0.5) * 30 * s, by + (R() - 0.5) * 20 * s, (10 + R() * 12) * s, R() < 0.5 ? "#f9a8d4" : "#fbcfe8");
      return;
    }
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    ctx.lineWidth = d * 2.2 * s;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    branch(ex, ey, len * 0.72, a - 0.45 - R() * 0.3, d - 1);
    branch(ex, ey, len * 0.72, a + 0.35 + R() * 0.3, d - 1);
  };
  branch(x, y, 70 * s, -Math.PI / 2 - 0.15, 5);
}
function decorTemple(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#fde68a"], [0.35, "#fdba74"], [0.6, "#fb7185"], [1, "#4c0519"]]);
  // soleil rouge
  glow(ctx, W * 0.5, H * 0.34, W * 0.35, "#fecaca", 0.5);
  disc(ctx, W * 0.5, H * 0.34, H * 0.17, "#dc2626");
  // montagnes en couches, avec un sommet enneigé
  const ridge = (y, amp, col, seed) => {
    const Rr = seeded(seed);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y - Math.sin((x / W) * Math.PI * 2 + seed) * amp * 0.4 - Rr() * amp * 0.25);
    ctx.lineTo(W, H);
    ctx.fill();
  };
  ctx.fillStyle = "#9f1239";
  ctx.beginPath();
  ctx.moveTo(W * 0.62, H * 0.6);
  ctx.lineTo(W * 0.78, H * 0.24);
  ctx.lineTo(W * 0.94, H * 0.6);
  ctx.fill();
  ctx.fillStyle = "#fff1f2";
  ctx.beginPath();
  ctx.moveTo(W * 0.74, H * 0.32);
  ctx.lineTo(W * 0.78, H * 0.24);
  ctx.lineTo(W * 0.82, H * 0.32);
  ctx.lineTo(W * 0.8, H * 0.3);
  ctx.lineTo(W * 0.78, H * 0.33);
  ctx.lineTo(W * 0.76, H * 0.3);
  ctx.fill();
  ridge(H * 0.55, 70, "#881337", 3);
  softCloud(ctx, W * 0.3, H * 0.5, 600, 40, "rgba(255,228,230,0.35)");
  // pagode
  const px = W * 0.16, pb = H * 0.56;
  for (let k = 0; k < 4; k++) {
    const w = (110 - k * 20) * (W / 1200), y = pb - k * 34 * (H / 700);
    ctx.fillStyle = "#4c0519";
    ctx.fillRect(px - w * 0.3, y - 26 * (H / 700), w * 0.6, 26 * (H / 700));
    ctx.beginPath();
    ctx.moveTo(px - w * 0.6, y - 22 * (H / 700));
    ctx.quadraticCurveTo(px, y - 46 * (H / 700), px + w * 0.6, y - 22 * (H / 700));
    ctx.lineTo(px + w * 0.4, y - 30 * (H / 700));
    ctx.lineTo(px - w * 0.4, y - 30 * (H / 700));
    ctx.fill();
  }
  ridge(H * 0.62, 40, "#4c0519", 9);
  // torii au premier plan
  const tx = W / 2, ty = H * 0.62, s = W / 1200;
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(tx - 170 * s, ty - 250 * s, 26 * s, 260 * s);
  ctx.fillRect(tx + 144 * s, ty - 250 * s, 26 * s, 260 * s);
  ctx.fillStyle = "#1c1917";
  ctx.fillRect(tx - 174 * s, ty - 4 * s, 34 * s, 14 * s);
  ctx.fillRect(tx + 140 * s, ty - 4 * s, 34 * s, 14 * s);
  ctx.fillStyle = "#b91c1c";
  ctx.fillRect(tx - 200 * s, ty - 210 * s, 400 * s, 18 * s);
  ctx.fillRect(tx - 12 * s, ty - 250 * s, 24 * s, 46 * s);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.moveTo(tx - 240 * s, ty - 262 * s);
  ctx.quadraticCurveTo(tx, ty - 238 * s, tx + 240 * s, ty - 262 * s);
  ctx.lineTo(tx + 230 * s, ty - 244 * s);
  ctx.quadraticCurveTo(tx, ty - 222 * s, tx - 230 * s, ty - 244 * s);
  ctx.fill();
  // cerisiers et pétales
  sakuraTree(ctx, W * 0.06, H * 0.66, W / 1200, R);
  sakuraTree(ctx, W * 0.95, H * 0.68, W / 1300, R);
  // lanternes
  for (const u of [0.32, 0.68]) {
    const lx = W * u, ly = H * 0.6;
    ctx.fillStyle = "#57534e";
    ctx.fillRect(lx - 4, ly - 60 * s, 8, 60 * s);
    glow(ctx, lx, ly - 70 * s, 40, "#fbbf24", 0.6);
    roundRect(ctx, lx - 14 * s, ly - 84 * s, 28 * s, 26 * s, 6);
    ctx.fillStyle = "#fde68a";
    ctx.fill();
  }
  for (let k = 0; k < 70; k++) {
    ctx.save();
    ctx.translate(R() * W, R() * H);
    ctx.rotate(R() * TAU);
    ctx.fillStyle = `rgba(251,207,232,${0.5 + R() * 0.5})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 6 + R() * 3, 3.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // sol de pierre du sanctuaire
  const ground = ctx.createLinearGradient(0, H * 0.62, 0, H);
  ground.addColorStop(0, "#57534e");
  ground.addColorStop(1, "#1c1917");
  ctx.fillStyle = ground;
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  return { ring: "#fecaca", mat: "#78716c" };
}

// --- Abysses ---
function decorAbysses(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#22d3ee"], [0.25, "#0e7490"], [0.6, "#083344"], [1, "#020617"]]);
  lightShafts(ctx, W * 0.5, -40, W, H, "#cffafe", 12, 1.4, R);
  // ruines englouties
  for (const [u, h] of [[0.12, 0.38], [0.2, 0.26], [0.84, 0.34], [0.92, 0.22]]) {
    const x = W * u, top = H * (0.62 - h);
    const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0);
    g.addColorStop(0, "#0f3a46");
    g.addColorStop(0.5, "#1f5f6e");
    g.addColorStop(1, "#0b2a33");
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, top, 44, H * h);
    ctx.fillRect(x - 30, top - 10, 60, 12);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    for (let k = 1; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(x - 22 + k * 9, top);
      ctx.lineTo(x - 22 + k * 9, top + H * h);
      ctx.stroke();
    }
  }
  // bancs de poissons
  for (let s = 0; s < 3; s++) {
    const bx = R() * W, by = H * (0.15 + R() * 0.3);
    for (let k = 0; k < 18; k++) {
      const x = bx + (R() - 0.5) * 160, y = by + (R() - 0.5) * 60;
      ctx.fillStyle = "rgba(8,51,68,0.7)";
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 3, 0, 0, TAU);
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x - 11, y - 3);
      ctx.lineTo(x - 11, y + 3);
      ctx.fill();
    }
  }
  // méduses lumineuses
  for (let k = 0; k < 5; k++) {
    const x = R() * W, y = H * (0.1 + R() * 0.4), r = 14 + R() * 16, col = R() < 0.5 ? "#f0abfc" : "#a5f3fc";
    glow(ctx, x, y, r * 3, col, 0.45);
    ctx.fillStyle = rgba(col, 0.6);
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = rgba(col, 0.45);
    ctx.lineWidth = 1.5;
    for (let t = 0; t < 5; t++) {
      ctx.beginPath();
      ctx.moveTo(x - r + (t * r) / 2, y);
      ctx.quadraticCurveTo(x - r + (t * r) / 2 + 8, y + r * 1.5, x - r + (t * r) / 2, y + r * 3);
      ctx.stroke();
    }
  }
  // coraux et algues au fond
  const bed = H * 0.6;
  const sea = ctx.createLinearGradient(0, bed, 0, H);
  sea.addColorStop(0, "#0c4a6e");
  sea.addColorStop(1, "#020617");
  ctx.fillStyle = sea;
  ctx.fillRect(0, bed, W, H - bed);
  for (let k = 0; k < 16; k++) {
    const x = R() * W, h = 60 + R() * 110;
    ctx.strokeStyle = `rgba(34,197,94,${0.5 + R() * 0.4})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, bed + 40);
    for (let y = 0; y < h; y += 10) ctx.lineTo(x + Math.sin(y / 18 + k) * 10, bed + 40 - y);
    ctx.stroke();
  }
  for (let k = 0; k < 12; k++) {
    const x = R() * W, col = ["#f472b6", "#fb923c", "#f43f5e", "#c084fc"][k % 4];
    for (let b = 0; b < 6; b++) disc(ctx, x + (R() - 0.5) * 40, bed + 30 + (R() - 0.5) * 30, 6 + R() * 10, rgba(col, 0.75));
  }
  for (let k = 0; k < 80; k++) {
    ctx.strokeStyle = `rgba(207,250,254,${0.2 + R() * 0.5})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(R() * W, R() * H, 1.5 + R() * 6, 0, TAU);
    ctx.stroke();
  }
  for (let k = 0; k < 140; k++) disc(ctx, R() * W, R() * H, R() * 1.2, "rgba(236,254,255,0.4)");
  return { ring: "#67e8f9", mat: "#155e75" };
}

// --- Galaxie ---
function decorGalaxie(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#020617"], [1, "#0b0420"]]);
  // nébuleuses : nuages colorés empilés
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const [x, y, r, col] of [[0.2, 0.3, 0.42, "#7c3aed"], [0.78, 0.22, 0.38, "#db2777"], [0.55, 0.55, 0.5, "#2563eb"], [0.35, 0.7, 0.3, "#0891b2"]]) {
    for (let k = 0; k < 18; k++) glow(ctx, W * x + (R() - 0.5) * W * r, H * y + (R() - 0.5) * H * r, W * r * (0.2 + R() * 0.3), col, 0.12 + R() * 0.12);
  }
  // voie lactée
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.35);
  for (let k = 0; k < 900; k++) disc(ctx, (R() - 0.5) * W * 1.4, (R() + R() + R() - 1.5) * H * 0.12, R() * 1.2, `rgba(255,255,255,${0.1 + R() * 0.5})`);
  ctx.restore();
  for (let k = 0; k < 260; k++) disc(ctx, R() * W, R() * H, R() * 1.6 + 0.2, `rgba(255,255,255,${0.2 + R() * 0.8})`);
  for (let k = 0; k < 16; k++) sparkle(ctx, R() * W, R() * H, 4 + R() * 6, "#ffffff");
  // planète à anneaux
  const px = W * 0.82, py = H * 0.2, pr = H * 0.11;
  glow(ctx, px, py, pr * 2.4, "#f0abfc", 0.25);
  const pg = ctx.createRadialGradient(px - pr * 0.4, py - pr * 0.4, 4, px, py, pr);
  pg.addColorStop(0, "#fde68a");
  pg.addColorStop(0.5, "#fb923c");
  pg.addColorStop(1, "#7c2d12");
  disc(ctx, px, py, pr, pg);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(-0.35);
  ctx.strokeStyle = "rgba(253,230,138,0.7)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 1.9, pr * 0.45, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(253,230,138,0.35)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, pr * 2.2, pr * 0.55, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
  // étoile filante
  const sx = W * 0.2, sy = H * 0.12;
  const sg = ctx.createLinearGradient(sx, sy, sx + 220, sy + 70);
  sg.addColorStop(0, "rgba(255,255,255,0.95)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = sg;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(sx + 220, sy + 70);
  ctx.stroke();
  return { ring: "#e9d5ff", mat: "#4c1d95" };
}

// --- Manoir hanté ---
function decorManoir(ctx, W, H, R) {
  decorSky(ctx, W, H, [[0, "#040108"], [0.5, "#14040f"], [0.8, "#2a0808"], [1, "#0b0204"]]);
  for (let k = 0; k < 120; k++) disc(ctx, R() * W, R() * H * 0.6, R() * 1.3 + 0.2, `rgba(254,226,226,${0.1 + R() * 0.45})`);
  const mx = W * 0.8, my = H * 0.17, mr = H * 0.1;
  glow(ctx, mx, my, mr * 4, "#dc2626", 0.45);
  const mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, 4, mx, my, mr);
  mg.addColorStop(0, "#fecaca");
  mg.addColorStop(0.45, "#ef4444");
  mg.addColorStop(1, "#7f1d1d");
  disc(ctx, mx, my, mr, mg);
  for (const [dx, dy, rr] of [[-0.3, -0.25, 0.18], [0.25, 0.15, 0.22], [-0.1, 0.4, 0.12]]) disc(ctx, mx + dx * mr, my + dy * mr, rr * mr, "rgba(127,29,29,0.35)");
  for (let k = 0; k < 4; k++) softCloud(ctx, R() * W, H * (0.1 + R() * 0.25), 320, 22, "rgba(10,3,8,0.7)");
  for (let k = 0; k < 9; k++) effroiBat(ctx, R() * W, R() * H * 0.45, 0.8 + R(), R() - 0.3);
  effroiWeb(ctx, 0, 0, 150 * (W / 1200), 0);
  effroiManor(ctx, W * 0.5, H * 0.66, W / 1100, R);
  ctx.strokeStyle = "#07030a";
  ctx.lineCap = "round";
  effroiTree(ctx, W * 0.06, H * 0.7, 100 * (W / 1200), -Math.PI / 2 - 0.1, 7, seeded(5));
  effroiTree(ctx, W * 0.94, H * 0.7, 90 * (W / 1200), -Math.PI / 2 + 0.12, 7, seeded(8));
  // tombes, puis brume
  ctx.fillStyle = "#07030a";
  ctx.fillRect(0, H * 0.62, W, H * 0.38);
  for (let k = 0; k < 16; k++) {
    const gx = R() * W, gy = H * (0.62 + R() * 0.05), gw = 14 + R() * 10, gh = 22 + R() * 16;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate((R() - 0.5) * 0.3);
    if (R() < 0.35) {
      ctx.fillRect(-2, -gh, 4, gh);
      ctx.fillRect(-8, -gh * 0.75, 16, 4);
    } else {
      tombPath(ctx, -gw / 2, -gh, gw, gh);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.filter = "blur(16px)";
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = `rgba(203,213,225,${0.06 + R() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(R() * W, H * (0.6 + R() * 0.15), 200, 26, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  return { ring: "#fca5a5", mat: "#3f1d1d" };
}

const DECOR_DRAW = { decor_colisee: decorColisee, decor_paris: decorParis, decor_temple: decorTemple, decor_abysses: decorAbysses, decor_galaxie: decorGalaxie, decor_manoir: decorManoir };
{
  const old = decorBackground;
  decorBackground = (id, W, H) => {
    const draw = DECOR_DRAW[id];
    if (!draw) return old(id, W, H);
    const key = `${id}:${W}x${H}`;
    if (decorHD.has(key)) return decorHD.get(key);
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const { ring, mat } = draw(ctx, W, H, seeded(hashOf(id)));
    // le centre un peu plus sombre pour que les cartes ressortent
    const focus = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.45, W * 0.45);
    focus.addColorStop(0, "rgba(0,0,0,0.28)");
    focus.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = focus;
    ctx.fillRect(0, 0, W, H);
    decorFloor(ctx, W, H, ring, mat);
    decorVignette(ctx, W, H);
    decorHD.set(key, c);
    return c;
  };
}
