
// --- Pass de combat d'octobre : « Pass de l'Effroi » ---
// Même pass (30 paliers, gratuit + Premium), mais habillé pour Halloween : lune de sang, manoir hanté,
// cimetière, brume, chauves-souris ; récompenses en boosters Frisson et cartes d'Halloween existantes.
const PASS_THEMES = {
  10: { key: "effroi", name: "Pass de l'Effroi", sub: "La Nuit des Frissons", color: 0xb91c1c },
};
const passTheme = (season = passSeason()) => PASS_THEMES[Number(String(season).split("-")[1])] ?? null;
{
  const reward = passReward, rewardText = passRewardText, giveR = passGive, icon = passIcon, draw = drawPass, payload = passPayload;
  // récompenses d'octobre : boosters Frisson et cartes d'Halloween (cartes déjà existantes)
  passReward = (tier, track, season = passSeason()) => {
    const r = reward(tier, track);
    if (passTheme(season)?.key !== "effroi") return r;
    if (track === "free") {
      if (r.pack === "standard") r.pack = "frisson";
      return r;
    }
    if (tier === 30) return { card: "hw_lune", pack: "prestige", dust: 1000 };
    if (tier === 20) return { card: "hw_fantome", pack: "frisson", dust: 300 };
    if (tier === 10) return { card: "hw_chat", pack: "frisson" };
    if (tier === 15 || tier === 25) return { pack: "frisson", dust: 200 };
    return r;
  };
  passRewardText = (r) => [r.card && `carte ${findCard(r.card)?.name ?? r.card}`, rewardText({ ...r, card: undefined })].filter(Boolean).join(" + ");
  passGive = (userId, r) => {
    giveR(userId, r);
    const card = r.card && findCard(r.card);
    if (card) give(userId, card, false);
  };
  passIcon = (ctx, r, x, y, s, lit) => {
    if (r.pack === "frisson" && !r.card) return effroiPack(ctx, x, y, s, lit);
    if (!r.card) return icon(ctx, r, x, y, s, lit);
    const card = findCard(r.card), m = METAL[card?.rarity ?? "rare"];
    ctx.save();
    if (!lit) ctx.globalAlpha = 0.45;
    ctx.translate(x, y);
    ctx.rotate(0.08);
    roundRect(ctx, -s * 0.62, -s * 0.85, s * 1.24, s * 1.7, s * 0.14);
    ctx.fillStyle = metalGradient(ctx, 200, 200, m);
    ctx.fill();
    roundRect(ctx, -s * 0.5, -s * 0.72, s * 1, s * 1.1, s * 0.08);
    const g = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.4);
    g.addColorStop(0, "#3b0764");
    g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g;
    ctx.fill();
    if (r.card === "hw_lune") {
      glow(ctx, 0, -s * 0.18, s * 0.6, "#ef4444", 0.6);
      disc(ctx, 0, -s * 0.18, s * 0.3, "#dc2626");
    } else if (r.card === "hw_fantome") {
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath();
      ctx.arc(0, -s * 0.25, s * 0.26, Math.PI, 0);
      ctx.lineTo(s * 0.26, s * 0.12);
      for (let k = 0; k < 4; k++) ctx.lineTo(s * 0.26 - (k + 0.5) * s * 0.13, k % 2 ? s * 0.12 : s * 0.02);
      ctx.lineTo(-s * 0.26, s * 0.12);
      ctx.closePath();
      ctx.fill();
      disc(ctx, -s * 0.09, -s * 0.28, s * 0.05, "#111827");
      disc(ctx, s * 0.09, -s * 0.28, s * 0.05, "#111827");
    } else {
      // chat noir : silhouette et yeux jaunes
      disc(ctx, 0, -s * 0.12, s * 0.24, "#050505");
      ctx.fillStyle = "#050505";
      ctx.beginPath();
      ctx.moveTo(-s * 0.22, -s * 0.22);
      ctx.lineTo(-s * 0.16, -s * 0.46);
      ctx.lineTo(-s * 0.04, -s * 0.3);
      ctx.moveTo(s * 0.22, -s * 0.22);
      ctx.lineTo(s * 0.16, -s * 0.46);
      ctx.lineTo(s * 0.04, -s * 0.3);
      ctx.fill();
      disc(ctx, -s * 0.09, -s * 0.15, s * 0.045, "#facc15");
      disc(ctx, s * 0.09, -s * 0.15, s * 0.045, "#facc15");
    }
    star5(ctx, 0, s * 0.6, s * 0.14, "#fde68a");
    ctx.restore();
  };
  drawPass = (userId, page) => (passTheme(passOf(userId).season)?.key === "effroi" ? drawPassEffroi(userId, page) : draw(userId, page));
  passPayload = async (userId, page = null, note = "") => {
    const p = await payload(userId, page, note), th = passTheme(passOf(userId).season);
    if (th) {
      p.embeds[0].setColor(th.color).setTitle(`🎃 ${th.name} — ${th.sub}`);
      p.embeds[0].setDescription(`${p.embeds[0].data.description}\n🦇 **Spécial octobre** : boosters Frisson et cartes d'Halloween (Chat noir, Fantôme de la Maison, **Lune de sang**) dans le pass Premium.`);
    }
    return p;
  };
}

// --- Décor ---
function effroiPack(ctx, x, y, s, lit) {
  ctx.save();
  if (!lit) ctx.globalAlpha = 0.45;
  ctx.translate(x, y);
  ctx.rotate(-0.12);
  roundRect(ctx, -s * 0.55, -s * 0.75, s * 1.1, s * 1.5, s * 0.15);
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0, "#fb923c");
  g.addColorStop(1, "#7c2d12");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "#fdba74";
  ctx.lineWidth = 2;
  ctx.stroke();
  effroiPumpkinShape(ctx, 0, s * 0.05, s * 0.36, false);
  ctx.restore();
}
function effroiPumpkinShape(ctx, cx, cy, r, carve = true, glowA = 1) {
  ctx.save();
  ctx.fillStyle = "#3f6212";
  roundRect(ctx, cx - r * 0.1, cy - r * 1.12, r * 0.2, r * 0.32, r * 0.06);
  ctx.fill();
  for (const [dx, w, shadeK] of [[-0.55, 0.6, 0.75], [0.55, 0.6, 0.75], [-0.25, 0.62, 0.9], [0.25, 0.62, 0.9], [0, 0.55, 1.05]]) {
    const g = ctx.createRadialGradient(cx + dx * r - r * 0.15, cy - r * 0.3, 1, cx + dx * r, cy, r * 1.1);
    g.addColorStop(0, shade("#fb923c", 1.2 * shadeK));
    g.addColorStop(0.6, shade("#ea580c", shadeK));
    g.addColorStop(1, shade("#7c2d12", shadeK));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx + dx * r, cy, r * w, r * 0.9, 0, 0, TAU);
    ctx.fill();
  }
  if (carve) {
    ctx.fillStyle = "#1a0500";
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(cx + s * r * 0.48, cy - r * 0.08);
      ctx.lineTo(cx + s * r * 0.18, cy - r * 0.08);
      ctx.lineTo(cx + s * r * 0.33, cy - r * 0.42);
      ctx.closePath();
    }
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy + r * 0.2);
    const teeth = 7;
    for (let k = 0; k <= teeth; k++) ctx.lineTo(cx - r * 0.6 + (k * r * 1.2) / teeth, cy + r * (k % 2 ? 0.3 : 0.2));
    ctx.quadraticCurveTo(cx, cy + r * 0.85, cx - r * 0.6, cy + r * 0.2);
    ctx.fill();
    // lueur de la bougie à l'intérieur
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, cx, cy + r * 0.1, r * 0.9, "#fbbf24", 0.55 * glowA);
  }
  ctx.restore();
}
function effroiBat(ctx, x, y, s, flap) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = "#050208";
  ctx.beginPath();
  ctx.moveTo(0, -3);
  const f = flap * 6;
  ctx.quadraticCurveTo(-6, -8 - f, -12, -6 - f);
  ctx.quadraticCurveTo(-16, -4 - f, -22, -2 - f * 0.5);
  ctx.quadraticCurveTo(-17, 0, -15, 4);
  ctx.quadraticCurveTo(-12, 1, -9, 4);
  ctx.quadraticCurveTo(-6, 1, -3, 4);
  ctx.lineTo(0, 2);
  ctx.lineTo(3, 4);
  ctx.quadraticCurveTo(6, 1, 9, 4);
  ctx.quadraticCurveTo(12, 1, 15, 4);
  ctx.quadraticCurveTo(17, 0, 22, -2 - f * 0.5);
  ctx.quadraticCurveTo(16, -4 - f, 12, -6 - f);
  ctx.quadraticCurveTo(6, -8 - f, 0, -3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-2, -4);
  ctx.lineTo(-3, -8);
  ctx.lineTo(-0.5, -5);
  ctx.lineTo(0.5, -5);
  ctx.lineTo(3, -8);
  ctx.lineTo(2, -4);
  ctx.fill();
  ctx.restore();
}
function effroiTree(ctx, x, y, len, angle, depth, R) {
  if (depth <= 0 || len < 4) return;
  const x2 = x + Math.cos(angle) * len, y2 = y + Math.sin(angle) * len;
  ctx.lineWidth = Math.max(1, depth * 1.6);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * len * 0.3, (y + y2) / 2, x2, y2);
  ctx.stroke();
  const n = 2 + (R() < 0.3 ? 1 : 0);
  for (let k = 0; k < n; k++) effroiTree(ctx, x2, y2, len * (0.62 + R() * 0.15), angle + (R() - 0.5) * 1.3, depth - 1, R);
}
function effroiManor(ctx, x, base, s, R) {
  ctx.save();
  ctx.fillStyle = "#07030a";
  // colline
  ctx.beginPath();
  ctx.moveTo(x - 260 * s, base);
  ctx.quadraticCurveTo(x - 60 * s, base - 70 * s, x + 260 * s, base - 30 * s);
  ctx.lineTo(x + 400 * s, base);
  ctx.closePath();
  ctx.fill();
  const g = base - 50 * s;
  const rect = (rx, ry, w, h) => ctx.fillRect(x + rx * s, g - ry * s - h * s, w * s, h * s);
  const roof = (rx, ry, w, h) => {
    ctx.beginPath();
    ctx.moveTo(x + rx * s, g - ry * s);
    ctx.lineTo(x + (rx + w / 2) * s, g - (ry + h) * s);
    ctx.lineTo(x + (rx + w) * s, g - ry * s);
    ctx.closePath();
    ctx.fill();
  };
  rect(-120, 0, 240, 110);
  roof(-135, 110, 270, 70);
  rect(-175, 0, 60, 170);
  roof(-185, 170, 80, 90);
  rect(115, 0, 55, 140);
  roof(105, 140, 75, 80);
  rect(-40, 150, 14, 50);
  rect(50, 140, 12, 45);
  // fenêtres éclairées
  ctx.globalCompositeOperation = "lighter";
  const wins = [[-95, 20], [-55, 20], [-15, 20], [25, 20], [65, 20], [-95, 65], [-15, 65], [65, 65], [-155, 60], [-155, 115], [130, 50], [130, 95], [-5, 125]];
  for (const [wx, wy] of wins) {
    if (R() < 0.3) continue;
    const lx = x + wx * s, ly = g - wy * s - 22 * s;
    glow(ctx, lx + 7 * s, ly + 11 * s, 26 * s, "#f97316", 0.4);
    ctx.fillStyle = R() < 0.2 ? "#fde047" : "#fb923c";
    ctx.fillRect(lx, ly, 14 * s, 22 * s);
  }
  ctx.restore();
}
function effroiWeb(ctx, x, y, r, a0) {
  ctx.save();
  ctx.strokeStyle = "rgba(226,232,240,0.35)";
  ctx.lineWidth = 1.2;
  const spokes = 7;
  for (let k = 0; k <= spokes; k++) {
    const a = a0 + (k / spokes) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  for (let ring = 1; ring <= 5; ring++) {
    const rr = (ring / 5) * r;
    ctx.beginPath();
    for (let k = 0; k <= spokes; k++) {
      const a = a0 + (k / spokes) * (Math.PI / 2), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (!k) ctx.moveTo(px, py);
      else {
        const am = a0 + ((k - 0.5) / spokes) * (Math.PI / 2);
        ctx.quadraticCurveTo(x + Math.cos(am) * rr * 0.86, y + Math.sin(am) * rr * 0.86, px, py);
      }
    }
    ctx.stroke();
  }
  // l'araignée
  const sx = x + Math.cos(a0 + 0.6) * r * 0.62, sy = y + Math.sin(a0 + 0.6) * r * 0.62 + 40;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 40);
  ctx.lineTo(sx, sy);
  ctx.stroke();
  disc(ctx, sx, sy, 6, "#0a0a0a");
  disc(ctx, sx, sy + 7, 8, "#0a0a0a");
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 1.5;
  for (const s of [-1, 1])
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + 4);
      ctx.quadraticCurveTo(sx + s * 10, sy - 4 + k * 5, sx + s * 15, sy + 4 + k * 5);
      ctx.stroke();
    }
  ctx.restore();
}
function effroiTitle(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `${size}px CardTitle`;
  ctx.textAlign = "left";
  const w = ctx.measureText(text).width, R = seeded(hashOf(text));
  const g = ctx.createLinearGradient(0, y - size, 0, y + size * 0.4);
  g.addColorStop(0, "#fecaca");
  g.addColorStop(0.35, "#dc2626");
  g.addColorStop(1, "#450a0a");
  // gouttes qui coulent des lettres
  ctx.fillStyle = "#991b1b";
  for (let k = 0; k < 11; k++) {
    const dx = x + R() * w, len = 10 + R() * 34, dw = 3 + R() * 4;
    roundRect(ctx, dx - dw / 2, y - 6, dw, len, dw / 2);
    ctx.fill();
    disc(ctx, dx, y - 6 + len, dw * 0.85, "#991b1b");
  }
  ctx.shadowColor = "rgba(220,38,38,0.65)";
  ctx.shadowBlur = 22;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#0a0202";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let k = 0; k < 40; k++) ctx.fillRect(x + R() * w, y - size + R() * size, 1 + R() * 3, 1);
  ctx.restore();
}
function effroiSkull(ctx, x, y, r) {
  disc(ctx, x, y, r, "#e7e5e4");
  roundRect(ctx, x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.6, r * 0.15);
  ctx.fillStyle = "#e7e5e4";
  ctx.fill();
  disc(ctx, x - r * 0.38, y + r * 0.05, r * 0.27, "#1c1917");
  disc(ctx, x + r * 0.38, y + r * 0.05, r * 0.27, "#1c1917");
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.3);
  ctx.lineTo(x - r * 0.12, y + r * 0.52);
  ctx.lineTo(x + r * 0.12, y + r * 0.52);
  ctx.closePath();
  ctx.fill();
  for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * r * 0.25 - 0.8, y + r * 0.72, 1.6, r * 0.32);
}
function tombPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
function archPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w * 0.55);
  ctx.quadraticCurveTo(x, y + w * 0.08, x + w / 2, y);
  ctx.quadraticCurveTo(x + w, y + w * 0.08, x + w, y + w * 0.55);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
function chains(ctx, x, y, w, h) {
  ctx.save();
  ctx.strokeStyle = "rgba(161,161,170,0.75)";
  ctx.lineWidth = 2.2;
  for (const [x1, y1, x2, y2] of [[x + 6, y + h * 0.35, x + w - 6, y + h * 0.75], [x + w - 6, y + h * 0.35, x + 6, y + h * 0.75]]) {
    const n = 9;
    for (let k = 0; k < n; k++) {
      const px = x1 + ((x2 - x1) * (k + 0.5)) / n, py = y1 + ((y2 - y1) * (k + 0.5)) / n;
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 3.5, Math.atan2(y2 - y1, x2 - x1) + (k % 2 ? 0 : Math.PI / 2) * 0.2, 0, TAU);
      ctx.stroke();
    }
  }
  // cadenas
  const cx = x + w / 2, cy = y + h * 0.55;
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy - 6, 7, Math.PI, 0);
  ctx.stroke();
  roundRect(ctx, cx - 10, cy - 6, 20, 16, 3);
  ctx.fillStyle = "#71717a";
  ctx.fill();
  disc(ctx, cx, cy + 1, 2.5, "#18181b");
  ctx.restore();
}
function waxSeal(ctx, x, y, r) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, "#f87171");
  g.addColorStop(1, "#7f1d1d");
  ctx.beginPath();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU, rr = r * (k % 2 ? 0.92 : 1);
    k ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#fee2e2";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.4, y);
  ctx.lineTo(x - r * 0.1, y + r * 0.3);
  ctx.lineTo(x + r * 0.45, y - r * 0.3);
  ctx.stroke();
}

// --- L'image du Pass de l'Effroi ---
async function drawPassEffroi(userId, page) {
  const p = passOf(userId), tier = passTier(p), th = passTheme(p.season), W = 1400, H = 820;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const R = seeded(hashOf(p.season) + 66);
  ctx.imageSmoothingQuality = "high";
  // ciel
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#040108");
  sky.addColorStop(0.45, "#14040f");
  sky.addColorStop(0.8, "#2a0808");
  sky.addColorStop(1, "#0b0204");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 120; k++) disc(ctx, R() * W, R() * H * 0.6, R() * 1.3 + 0.2, `rgba(254,226,226,${0.1 + R() * 0.45})`);
  // lune de sang, traversée de nuages
  const mx = 1010, my = 96, mr = 74;
  glow(ctx, mx, my, 280, "#dc2626", 0.45);
  const mg = ctx.createRadialGradient(mx - mr * 0.35, my - mr * 0.35, 4, mx, my, mr);
  mg.addColorStop(0, "#fecaca");
  mg.addColorStop(0.45, "#ef4444");
  mg.addColorStop(1, "#7f1d1d");
  disc(ctx, mx, my, mr, mg);
  for (const [dx, dy, rr] of [[-22, -18, 13], [18, 10, 17], [-8, 30, 9], [30, -26, 8], [-34, 16, 7]]) disc(ctx, mx + dx, my + dy, rr, "rgba(127,29,29,0.35)");
  ctx.save();
  ctx.filter = "blur(6px)";
  ctx.fillStyle = "rgba(10,3,8,0.75)";
  for (const [dx, dy, w] of [[-120, 30, 220], [40, 64, 260], [-60, -40, 140]]) {
    ctx.beginPath();
    ctx.ellipse(mx + dx, my + dy, w / 2, 11, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // chauves-souris
  for (let k = 0; k < 9; k++) effroiBat(ctx, 620 + R() * 700, 20 + R() * 170, 0.7 + R() * 0.9, R() - 0.3);
  // toile d'araignée dans le coin
  effroiWeb(ctx, 0, 0, 170, 0);
  // bas de l'image : cimetière, arbres morts, manoir hanté, brume
  const ground = H - 70;
  effroiManor(ctx, 1160, H - 8, 0.95, R);
  ctx.strokeStyle = "#07030a";
  ctx.lineCap = "round";
  effroiTree(ctx, 70, H, 110, -Math.PI / 2 - 0.12, 7, seeded(5));
  effroiTree(ctx, 330, H, 70, -Math.PI / 2 + 0.2, 6, seeded(9));
  ctx.fillStyle = "#07030a";
  ctx.fillRect(0, ground + 20, W, H);
  ctx.beginPath();
  ctx.moveTo(0, ground + 24);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, ground + 18 + Math.sin(x / 90) * 8);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 14; k++) {
    const gx = 120 + k * 64 + R() * 20, gy = ground + 22, gw = 18 + R() * 10, gh = 26 + R() * 18;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate((R() - 0.5) * 0.25);
    if (R() < 0.35) {
      ctx.fillRect(-2.5, -gh, 5, gh);
      ctx.fillRect(-9, -gh * 0.75, 18, 5);
    } else {
      tombPath(ctx, -gw / 2, -gh, gw, gh);
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.filter = "blur(18px)";
  for (let k = 0; k < 9; k++) {
    ctx.fillStyle = `rgba(203,213,225,${0.05 + R() * 0.06})`;
    ctx.beginPath();
    ctx.ellipse(R() * W, ground + 10 + R() * 50, 180 + R() * 140, 26 + R() * 16, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // titre qui dégouline
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fca5a5";
  spaced(ctx, "LES CARTES DE LA MAISON", 300, 46, 5);
  effroiTitle(ctx, th.name, 196, 112, 64);
  ctx.font = "22px CardItalic";
  ctx.fillStyle = "#fdba74";
  ctx.fillText(`${th.sub} · ${passSeasonName(p.season)}`, 200, 156);
  // le palier dans une citrouille
  const px = 1258, py = 104;
  glow(ctx, px, py, 120, "#f97316", 0.45);
  effroiPumpkinShape(ctx, px, py, 62, true);
  roundRect(ctx, px - 62, py + 52, 124, 40, 10);
  ctx.fillStyle = "#1c0703";
  ctx.fill();
  ctx.strokeStyle = p.premium ? "#fbbf24" : "#fb923c";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "#fdba74";
  ctx.fillText("PALIER", px - 22, py + 77);
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(tier), px + 30, py + 81);
  if (p.premium) {
    ctx.font = "12px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spaced(ctx, "PREMIUM", px, py + 110, 3);
  }
  // barre d'XP sanglante, avec un crâne au bout
  const into = tier >= PASS_TIERS ? PASS_TIER_XP : p.xp - tier * PASS_TIER_XP, bw = 860, bx = 196, byy = 186;
  roundRect(ctx, bx, byy, bw, 20, 10);
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fill();
  ctx.strokeStyle = "rgba(127,29,29,0.8)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const fw = Math.max(20, (bw - 4) * (into / PASS_TIER_XP));
  roundRect(ctx, bx + 2, byy + 2, fw, 16, 8);
  const xg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  xg.addColorStop(0, "#450a0a");
  xg.addColorStop(1, "#ef4444");
  ctx.save();
  ctx.shadowColor = "#dc2626";
  ctx.shadowBlur = 14;
  ctx.fillStyle = xg;
  ctx.fill();
  ctx.restore();
  for (const [dx, len] of [[0.2, 12], [0.5, 20], [0.8, 9]]) {
    const dx2 = bx + 2 + fw * dx;
    roundRect(ctx, dx2 - 2, byy + 14, 4, len, 2);
    ctx.fillStyle = "#991b1b";
    ctx.fill();
    disc(ctx, dx2, byy + 14 + len, 3, "#991b1b");
  }
  effroiSkull(ctx, bx + 2 + fw, byy + 6, 12);
  ctx.textAlign = "left";
  ctx.font = "14px CardBold";
  ctx.fillStyle = "#fecaca";
  ctx.fillText(tier >= PASS_TIERS ? "Vous avez survécu à la nuit entière !" : `${into} / ${PASS_TIER_XP} XP avant le palier ${tier + 1}`, bx, byy + 46);
  ctx.textAlign = "right";
  ctx.fillStyle = "#a8a29e";
  ctx.fillText(`Aujourd'hui : ${p.day === dayKey() ? p.dayXp : 0} / ${PASS_DAY_CAP} XP`, bx + bw, byy + 46);

  // les deux voies : pierres tombales (gratuit) et arches de la crypte (Premium)
  const first = page * PASS_PAGE + 1, colW = 112, x0 = 196;
  const rows = [["free", "GRATUIT", "Le cimetière", 262, 150], ["prem", "PREMIUM", "La crypte", 462, 168]];
  for (const [track, label, place, y, hgt] of rows) {
    ctx.textAlign = "center";
    ctx.font = "16px CardEngrave";
    ctx.fillStyle = track === "prem" ? "#fbbf24" : "#d6d3d1";
    spaced(ctx, label, 98, y + hgt / 2 - 4, 2);
    ctx.font = "14px CardItalic";
    ctx.fillStyle = track === "prem" ? "#fcd34d" : "#a8a29e";
    ctx.fillText(place, 98, y + hgt / 2 + 18);
    if (track === "prem" && !p.premium) {
      ctx.font = "12px CardText";
      ctx.fillStyle = "#a8a29e";
      ctx.fillText("verrouillée", 98, y + hgt / 2 + 38);
    }
    for (let i = 0; i < PASS_PAGE; i++) {
      const k = first + i, x = x0 + i * colW, w = colW - 14, r = passReward(k, track, p.season);
      const open = k <= tier && (track === "free" || p.premium), claimed = p.claimed[track].includes(k);
      ctx.save();
      if (track === "free") tombPath(ctx, x, y, w, hgt);
      else archPath(ctx, x, y, w, hgt);
      const sg = ctx.createLinearGradient(0, y, 0, y + hgt);
      if (track === "free") {
        sg.addColorStop(0, "#57534e");
        sg.addColorStop(1, "#1c1917");
      } else {
        sg.addColorStop(0, "#3b0764");
        sg.addColorStop(1, "#0f0514");
      }
      ctx.fillStyle = sg;
      ctx.shadowColor = open && !claimed ? "#4ade80" : "rgba(0,0,0,0.8)";
      ctx.shadowBlur = open && !claimed ? 24 : 12;
      ctx.fill();
      ctx.restore();
      // texture : fissures de la pierre, ou dorures de la crypte
      ctx.save();
      if (track === "free") tombPath(ctx, x, y, w, hgt);
      else archPath(ctx, x, y, w, hgt);
      ctx.clip();
      if (track === "free") {
        const C2 = seeded(k * 7);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1;
        for (let q = 0; q < 2; q++) {
          let cx2 = x + C2() * w, cy2 = y + 20 + C2() * 30;
          ctx.beginPath();
          ctx.moveTo(cx2, cy2);
          for (let s = 0; s < 4; s++) ctx.lineTo((cx2 += (C2() - 0.5) * 14), (cy2 += 6 + C2() * 8));
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(77,124,15,0.18)";
        ctx.beginPath();
        ctx.ellipse(x + w * 0.2, y + hgt, w * 0.5, 16, 0, 0, TAU);
        ctx.fill();
      } else glow(ctx, x + w / 2, y + 40, 70, "#a855f7", 0.25);
      if (open && !claimed) glow(ctx, x + w / 2, y + hgt * 0.45, 80, "#4ade80", 0.28);
      ctx.restore();
      ctx.lineWidth = track === "prem" ? 2.5 : 1.5;
      ctx.strokeStyle = track === "prem" ? "#d4a017" : open && !claimed ? "#86efac" : "rgba(214,211,209,0.35)";
      if (track === "free") tombPath(ctx, x, y, w, hgt);
      else archPath(ctx, x, y, w, hgt);
      ctx.stroke();
      if (track === "prem") {
        ctx.strokeStyle = "rgba(212,160,23,0.45)";
        ctx.lineWidth = 1;
        archPath(ctx, x + 5, y + 6, w - 10, hgt - 6);
        ctx.stroke();
      }
      passIcon(ctx, r, x + w / 2, y + hgt * 0.42, 26, open);
      ctx.textAlign = "center";
      ctx.font = "11px CardBold";
      ctx.fillStyle = open ? "#fafaf9" : "rgba(214,211,209,0.5)";
      const txt = passRewardText(r).replace(/ ✨/g, " poussières").replace(/ \+ /g, "\n");
      txt.split("\n").forEach((line, j, all) => ctx.fillText(line, x + w / 2, y + hgt - (all.length > 2 ? 44 : all.length > 1 ? 30 : 18) + j * 13, w - 8));
      if (claimed) waxSeal(ctx, x + w - 14, y + (track === "free" ? 18 : 30), 12);
      else if (!open) chains(ctx, x, y, w, hgt);
    }
  }
  // numéros des paliers, éclairés à la bougie une fois atteints
  for (let i = 0; i < PASS_PAGE; i++) {
    const k = first + i, x = x0 + i * colW + (colW - 14) / 2, reached = k <= tier;
    if (reached) {
      glow(ctx, x, 438, 26, "#f59e0b", 0.5);
      fxFlameTongue(ctx, x, 426, 16, 8, 0.3, i / 10, ["rgba(253,186,116,0.95)", "rgba(250,204,21,0.6)"]);
    }
    disc(ctx, x, 440, 14, reached ? "#f5f5f4" : "#292524");
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = reached ? "#1c1917" : "#78716c";
    ctx.fillText(String(k), x, 445);
  }
  ctx.textAlign = "center";
  ctx.font = "13px CardText";
  ctx.fillStyle = "#a8a29e";
  ctx.fillText(`Paliers ${first} à ${first + PASS_PAGE - 1} sur ${PASS_TIERS} · la nuit s'achève le 31 octobre à minuit`, W / 2 - 120, H - 16);
  // vignette rouge
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(40,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return c;
}
