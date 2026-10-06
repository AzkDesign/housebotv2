
// --- Mode Histoire : décors, portraits et images de scène (façon visual novel) ---
// Chaque décor est peint en code (ciel, immeubles, lumières, pluie, brume…) puis mis en cache.
// Par-dessus : le personnage qui parle, son nom, l'ambiance de la scène et les bandes de cinéma.
const VN_W = 1200, VN_H = 630;
const STORY_CAST = {
  augustin: { name: "Augustin", role: "Concierge de la Maison", fluent: "Old man", color: "#e9c46a" },
  rosier: { name: "Madame Rosier", role: "Résidente du troisième", fluent: "Old woman", color: "#f9a8d4" },
  valence: { name: "Inspectrice Valence", role: "Institut de Régulation Financière", fluent: "Woman detective", color: "#60a5fa" },
  velours: { name: "Velours", role: "Croupière du Casino", fluent: "Woman dancing", color: "#f43f5e" },
  molosse: { name: "Le Molosse", role: "Videur du Casino", fluent: "Man guard", color: "#f97316" },
  noe: { name: "Noé", role: "Résident du cinquième, bidouilleur", fluent: "Man technologist", color: "#22d3ee" },
  delorme: { name: "Monsieur le Maire", role: "Hôtel de Ville", fluent: "Man in tuxedo", color: "#a78bfa" },
  arnaud: { name: "Bastien Arnaud", role: "PDG d'Arnaud & Fils", fluent: "Man office worker", color: "#4ade80" },
  gardien: { name: "Le Gardien", role: "Gardien des archives", fluent: "Man guard", color: "#94a3b8" },
  ombre: { name: "???", role: "Une voix dans le miroir", fluent: "Bust in silhouette", color: "#c4b5fd" },
};
const STORY_PROPS = {
  cle: ["🗝️", "Old key"],
  jeu: ["🃏", "Joker"],
  lettre: ["✉️", "Envelope"],
  bougie: ["🕯️", "Candle"],
  contrat: ["📜", "Scroll"],
  miroir: ["🪞", "Mirror"],
  coffre: ["🔐", "Locked with key"],
  jeton: ["♠️", "Spade suit"],
  chapeau: ["🎩", "Top hat"],
  mairie: ["🏛️", "Classical building"],
};
for (const c of Object.values(STORY_CAST)) if (c.fluent !== "Bust in silhouette") FLUENT_SKIN.add(c.fluent);
const decorCache = new Map();

// --- Outils de peinture ---
function vnSky(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, VN_H);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VN_W, VN_H);
}
function vnStars(ctx, seed, n, maxY) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) disc(ctx, r() * VN_W, r() * maxY, 0.4 + r() * 1.3, `rgba(255,255,255,${0.25 + r() * 0.6})`);
}
function vnMoon(ctx, x, y, rad) {
  glow(ctx, x, y, rad * 5, "#dbeafe", 0.25);
  const g = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 2, x, y, rad);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(1, "#cbd5e1");
  disc(ctx, x, y, rad, g);
  for (const [dx, dy, s] of [[-0.3, 0.1, 0.18], [0.25, -0.2, 0.12], [0.1, 0.35, 0.1]]) disc(ctx, x + dx * rad, y + dy * rad, s * rad, "rgba(148,163,184,0.35)");
}
// immeubles haussmanniens : toits en mansarde, cheminées, fenêtres éclairées
function vnSkyline(ctx, seed, baseY, color, minH, maxH, lit, litColor = "#fde68a") {
  const r = seeded(seed);
  let x = -20;
  while (x < VN_W + 20) {
    const w = 90 + r() * 120, h = minH + r() * (maxH - minH), top = baseY - h;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, w, h + 2);
    // mansarde
    ctx.beginPath();
    ctx.moveTo(x - 4, top);
    ctx.lineTo(x + 10, top - 26);
    ctx.lineTo(x + w - 10, top - 26);
    ctx.lineTo(x + w + 4, top);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 2; k++) ctx.fillRect(x + 14 + r() * (w - 40), top - 26 - 12 - r() * 10, 10, 22);
    // fenêtres
    const cols = Math.max(2, Math.floor(w / 28)), rows = Math.max(2, Math.floor(h / 40));
    for (let cx = 0; cx < cols; cx++)
      for (let cy = 0; cy < rows; cy++) {
        const wx = x + 10 + cx * ((w - 20) / cols), wy = top + 14 + cy * ((h - 20) / rows);
        if (r() < lit) {
          glow(ctx, wx + 5, wy + 8, 16, litColor, 0.18);
          ctx.fillStyle = rgba(litColor, 0.75 + r() * 0.25);
        } else ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(wx, wy, 10, 15);
      }
    x += w + 2 + r() * 6;
  }
}
function vnEiffel(ctx, x, baseY, h, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.22, baseY);
  ctx.quadraticCurveTo(x - h * 0.06, baseY - h * 0.45, x - h * 0.012, baseY - h * 0.93);
  ctx.lineTo(x, baseY - h);
  ctx.lineTo(x + h * 0.012, baseY - h * 0.93);
  ctx.quadraticCurveTo(x + h * 0.06, baseY - h * 0.45, x + h * 0.22, baseY);
  ctx.lineTo(x + h * 0.12, baseY);
  ctx.quadraticCurveTo(x, baseY - h * 0.2, x - h * 0.12, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x - h * 0.1, baseY - h * 0.36, h * 0.2, h * 0.025);
  ctx.fillRect(x - h * 0.05, baseY - h * 0.62, h * 0.1, h * 0.02);
  glow(ctx, x, baseY - h, 30, "#fef3c7", 0.5);
}
function vnRain(ctx, seed, n, alpha = 0.35) {
  const r = seeded(seed);
  ctx.strokeStyle = `rgba(200,220,255,${alpha})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = r() * VN_W, y = r() * VN_H, l = 10 + r() * 22;
    ctx.moveTo(x, y);
    ctx.lineTo(x - l * 0.25, y + l);
  }
  ctx.stroke();
}
function vnFog(ctx, y, h, color, alpha) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, rgba(color, 0));
  g.addColorStop(0.5, rgba(color, alpha));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, y, VN_W, h);
}
function vnLamp(ctx, x, baseY, h, color = "#fcd34d") {
  ctx.fillStyle = "#0b0b10";
  ctx.fillRect(x - 3, baseY - h, 6, h);
  ctx.fillRect(x - 10, baseY - 6, 20, 6);
  ctx.beginPath();
  ctx.moveTo(x - 14, baseY - h);
  ctx.lineTo(x + 14, baseY - h);
  ctx.lineTo(x + 8, baseY - h - 22);
  ctx.lineTo(x - 8, baseY - h - 22);
  ctx.closePath();
  ctx.fill();
  glow(ctx, x, baseY - h - 10, 140, color, 0.35);
  disc(ctx, x, baseY - h - 10, 7, rgba(color, 0.95));
  // halo au sol et reflet mouillé
  const g = ctx.createRadialGradient(x, baseY + 20, 4, x, baseY + 20, 160);
  g.addColorStop(0, rgba(color, 0.22));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - 160, baseY - 20, 320, 200);
  ctx.fillStyle = rgba(color, 0.18);
  ctx.fillRect(x - 3, baseY + 6, 6, 120);
}
function vnWetGround(ctx, y, color) {
  const g = ctx.createLinearGradient(0, y, 0, VN_H);
  g.addColorStop(0, color);
  g.addColorStop(1, "#020205");
  ctx.fillStyle = g;
  ctx.fillRect(0, y, VN_W, VN_H - y);
}
function vnFloor(ctx, vx, y0, a, b, n = 14) {
  // dallage en damier vu en perspective (point de fuite au centre, ligne d'horizon y0)
  const rows = 9, tile = 110;
  const yAt = (t) => y0 + (VN_H - y0) * Math.pow(t, 1.6);
  const sAt = (t) => 0.25 + t * 1.6;
  for (let row = 0; row < rows; row++) {
    const t0 = row / rows, t1 = (row + 1) / rows, ya = yAt(t0), yb = yAt(t1), sa = sAt(t0), sb = sAt(t1);
    for (let col = -n; col < n; col++) {
      ctx.fillStyle = (row + col) % 2 ? a : b;
      ctx.beginPath();
      ctx.moveTo(vx + col * tile * sa, ya);
      ctx.lineTo(vx + (col + 1) * tile * sa, ya);
      ctx.lineTo(vx + (col + 1) * tile * sb, yb);
      ctx.lineTo(vx + col * tile * sb, yb);
      ctx.closePath();
      ctx.fill();
    }
  }
  const sheen = ctx.createLinearGradient(0, y0, 0, VN_H);
  sheen.addColorStop(0, "rgba(0,0,0,0.55)");
  sheen.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, y0, VN_W, VN_H - y0);
}
function vnChandelier(ctx, x, y, s) {
  glow(ctx, x, y + s * 0.5, s * 3, "#fde68a", 0.35);
  ctx.strokeStyle = "rgba(20,14,6,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.ellipse(x, y + s * 0.5, s, s * 0.25, 0, 0, TAU);
  ctx.fill();
  for (let k = -3; k <= 3; k++) {
    disc(ctx, x + k * s * 0.3, y + s * 0.38, s * 0.07, "#fff7d6");
    glow(ctx, x + k * s * 0.3, y + s * 0.38, s * 0.35, "#fde68a", 0.4);
    for (let d = 0; d < 3; d++) disc(ctx, x + k * s * 0.3, y + s * 0.6 + d * s * 0.12, s * 0.03, "rgba(255,255,255,0.8)");
  }
}
function vnShelves(ctx, x, y, w, h, seed, tint = "#3b2412") {
  const r = seeded(seed);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);
  const rows = Math.floor(h / 70);
  for (let i = 0; i < rows; i++) {
    const sy = y + i * 70;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, sy + 62, w, 8);
    let bx = x + 6;
    while (bx < x + w - 10) {
      const bw = 6 + r() * 12, bh = 34 + r() * 24;
      ctx.fillStyle = `hsl(${Math.floor(r() * 360)},${30 + r() * 30}%,${18 + r() * 18}%)`;
      ctx.fillRect(bx, sy + 62 - bh, bw, bh);
      bx += bw + 1;
    }
  }
}
function vnWindow(ctx, x, y, w, h, night = true) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, night ? "#0b1a3a" : "#fdba74");
  g.addColorStop(1, night ? "#1e3a8a" : "#fde68a");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (night) vnMoon(ctx, x + w * 0.7, y + h * 0.3, Math.min(w, h) * 0.1);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  vnRain(ctx, x + y, 60, 0.25);
  ctx.restore();
  ctx.strokeStyle = "#1a1208";
  ctx.lineWidth = 10;
  ctx.strokeRect(x, y, w, h);
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}
function vnBokeh(ctx, seed, n, colors, y0 = 0, y1 = VN_H) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) {
    const x = r() * VN_W, y = y0 + r() * (y1 - y0), s = 6 + r() * 26, c = colors[Math.floor(r() * colors.length)];
    glow(ctx, x, y, s * 1.6, c, 0.12 + r() * 0.2);
    disc(ctx, x, y, s * 0.5, rgba(c, 0.15 + r() * 0.2));
  }
}
function vnVignette(ctx, strength = 0.75) {
  const g = ctx.createRadialGradient(VN_W / 2, VN_H / 2, VN_H * 0.35, VN_W / 2, VN_H / 2, VN_W * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VN_W, VN_H);
}
function vnColumns(ctx, x0, n, gap, top, bottom, color) {
  for (let i = 0; i < n; i++) {
    const x = x0 + i * gap;
    const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
    g.addColorStop(0, rgba(color, 0.55));
    g.addColorStop(0.5, rgba(color, 1));
    g.addColorStop(1, rgba(color, 0.4));
    ctx.fillStyle = g;
    ctx.fillRect(x - 22, top, 44, bottom - top);
    ctx.fillRect(x - 30, top - 14, 60, 14);
    ctx.fillRect(x - 30, bottom, 60, 12);
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 8, top);
      ctx.lineTo(x + k * 8, bottom);
      ctx.stroke();
    }
  }
}

// --- Les décors ---
const DECORS = {
  rue_pluie(ctx) {
    vnSky(ctx, ["#05070f", "#0f1733", "#1c2447"]);
    vnStars(ctx, 3, 40, 160);
    vnMoon(ctx, 980, 110, 38);
    vnSkyline(ctx, 11, 470, "#0d1226", 140, 260, 0.12);
    vnEiffel(ctx, 300, 420, 300, "#0a0e1e");
    vnSkyline(ctx, 21, 520, "#070a16", 180, 330, 0.28);
    vnWetGround(ctx, 520, "#0b1022");
    for (const x of [140, 520, 900]) vnLamp(ctx, x, 528, 170);
    vnFog(ctx, 430, 160, "#94a3b8", 0.18);
    vnRain(ctx, 7, 520, 0.32);
  },
  facade(ctx) {
    vnSky(ctx, ["#020617", "#111a3a", "#2a1f3d"]);
    vnStars(ctx, 5, 60, 200);
    vnMoon(ctx, 170, 100, 34);
    // la Maison : grand hôtel particulier
    const x = 300, w = 600, top = 170, base = 520;
    ctx.fillStyle = "#151021";
    ctx.fillRect(x, top, w, base - top);
    ctx.beginPath();
    ctx.moveTo(x - 20, top);
    ctx.lineTo(x + w / 2, top - 90);
    ctx.lineTo(x + w + 20, top);
    ctx.closePath();
    ctx.fill();
    glow(ctx, x + w / 2, top - 40, 40, "#fde68a", 0.4);
    disc(ctx, x + w / 2, top - 40, 16, "rgba(253,230,138,0.7)");
    for (let c = 0; c < 6; c++)
      for (let r = 0; r < 3; r++) {
        const wx = x + 40 + c * 92, wy = top + 30 + r * 100, lit = (c * 7 + r * 3) % 4 !== 0;
        if (lit) glow(ctx, wx + 18, wy + 30, 60, "#fbbf24", 0.25);
        ctx.fillStyle = lit ? "#fcd34d" : "#0b0816";
        ctx.fillRect(wx, wy, 36, 62);
        ctx.strokeStyle = "#0b0816";
        ctx.lineWidth = 4;
        ctx.strokeRect(wx, wy, 36, 62);
        ctx.beginPath();
        ctx.moveTo(wx + 18, wy);
        ctx.lineTo(wx + 18, wy + 62);
        ctx.stroke();
      }
    vnColumns(ctx, x + w / 2 - 90, 4, 60, 400, base, "#2a2338");
    ctx.fillStyle = "#3b2a12";
    ctx.fillRect(x + w / 2 - 34, 430, 68, 90);
    glow(ctx, x + w / 2, 470, 90, "#fbbf24", 0.3);
    // grille en fer forgé
    vnWetGround(ctx, 520, "#0d0b18");
    ctx.strokeStyle = "#05040a";
    ctx.lineWidth = 3;
    for (let gx = 0; gx < VN_W; gx += 18) {
      ctx.beginPath();
      ctx.moveTo(gx, 470);
      ctx.lineTo(gx, 560);
      ctx.stroke();
      disc(ctx, gx, 466, 4, "#05040a");
    }
    ctx.fillStyle = "#05040a";
    ctx.fillRect(0, 488, VN_W, 6);
    ctx.fillRect(0, 548, VN_W, 6);
    vnLamp(ctx, 220, 560, 200);
    vnLamp(ctx, 980, 560, 200);
    vnFog(ctx, 470, 160, "#a5b4fc", 0.2);
    vnRain(ctx, 9, 380, 0.25);
  },
  hall(ctx) {
    vnSky(ctx, ["#1c1208", "#2a1a0a", "#120a04"]);
    // boiseries
    for (let x = 0; x < VN_W; x += 150) {
      ctx.strokeStyle = "rgba(251,191,36,0.12)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 20, 80, 110, 280);
    }
    // escalier
    ctx.fillStyle = "#3b1d0e";
    for (let s = 0; s < 12; s++) ctx.fillRect(760 + s * 18, 400 - s * 22, 400, 22);
    ctx.fillStyle = "#7f1d1d";
    for (let s = 0; s < 12; s++) ctx.fillRect(800 + s * 18, 400 - s * 22, 120, 22);
    ctx.strokeStyle = "#1a0f06";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(760, 330);
    ctx.lineTo(980, 90);
    ctx.stroke();
    vnFloor(ctx, 600, 420, "#e7dcc7", "#1c1917");
    vnChandelier(ctx, 520, 120, 90);
    // tableau du Fondateur
    ctx.fillStyle = "#a16207";
    ctx.fillRect(330, 130, 150, 190);
    ctx.fillStyle = "#1c1410";
    ctx.fillRect(342, 142, 126, 166);
    disc(ctx, 405, 205, 28, "#3f2a1d");
    ctx.fillRect(375, 235, 60, 70);
    glow(ctx, 405, 220, 120, "#fbbf24", 0.12);
  },
  salon(ctx) {
    vnSky(ctx, ["#1a0d05", "#2b1408", "#0c0603"]);
    vnShelves(ctx, 40, 90, 300, 360, 4);
    vnShelves(ctx, 860, 90, 300, 360, 8);
    // cheminée
    ctx.fillStyle = "#3f3a36";
    ctx.fillRect(470, 230, 260, 230);
    ctx.fillStyle = "#57534e";
    ctx.fillRect(450, 215, 300, 26);
    ctx.fillStyle = "#0c0705";
    ctx.fillRect(510, 290, 180, 170);
    glow(ctx, 600, 420, 260, "#f97316", 0.5);
    const r = seeded(31);
    for (let i = 0; i < 40; i++) {
      const fx = 540 + r() * 120, fy = 450 - r() * 110;
      ctx.fillStyle = `rgba(${240 + r() * 15},${120 + r() * 100},40,${0.3 + r() * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(fx, fy, 6 + r() * 10, 14 + r() * 24, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#1a0f0a";
    ctx.fillRect(0, 460, VN_W, VN_H - 460);
    // fauteuils
    for (const [x, flip] of [[290, 1], [910, -1]]) {
      ctx.fillStyle = "#5b1414";
      ctx.beginPath();
      ctx.ellipse(x, 470, 90, 40, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(x - 70 * flip - (flip < 0 ? 40 : 0), 330, 40, 140);
      ctx.fillRect(x - 80, 420, 160, 50);
    }
    vnBokeh(ctx, 2, 25, ["#fbbf24", "#f97316"], 200, 460);
  },
  bureau(ctx) {
    vnSky(ctx, ["#060912", "#0d1424", "#05070d"]);
    vnShelves(ctx, 30, 70, 260, 420, 13, "#1d140c");
    vnWindow(ctx, 470, 80, 280, 300, true);
    // rayon de lune
    ctx.fillStyle = "rgba(191,219,254,0.07)";
    ctx.beginPath();
    ctx.moveTo(470, 380);
    ctx.lineTo(750, 380);
    ctx.lineTo(980, VN_H);
    ctx.lineTo(380, VN_H);
    ctx.closePath();
    ctx.fill();
    // bureau et lampe verte
    ctx.fillStyle = "#2a1709";
    ctx.fillRect(330, 430, 560, 40);
    ctx.fillRect(350, 470, 40, 160);
    ctx.fillRect(830, 470, 40, 160);
    glow(ctx, 430, 400, 180, "#86efac", 0.25);
    ctx.fillStyle = "#14532d";
    ctx.beginPath();
    ctx.ellipse(430, 395, 50, 18, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#a16207";
    ctx.fillRect(426, 395, 8, 36);
    // papiers et cartes éparpillés
    const r = seeded(77);
    for (let i = 0; i < 14; i++) {
      ctx.save();
      ctx.translate(520 + r() * 300, 432 + r() * 6);
      ctx.rotate((r() - 0.5) * 0.6);
      ctx.fillStyle = r() < 0.5 ? "#f5f5f4" : "#fde68a";
      ctx.fillRect(-14, -3, 28, 6);
      ctx.restore();
    }
    vnShelves(ctx, 910, 70, 260, 420, 17, "#1d140c");
    vnFog(ctx, 300, 300, "#1e293b", 0.25);
  },
  couloir(ctx) {
    vnSky(ctx, ["#0a0705", "#120c08", "#050302"]);
    const vx = 600, vy = 300;
    // murs et plafond en perspective
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(vx - 80, vy - 60);
    ctx.lineTo(vx - 80, vy + 60);
    ctx.lineTo(0, VN_H);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(VN_W, 0);
    ctx.lineTo(vx + 80, vy - 60);
    ctx.lineTo(vx + 80, vy + 60);
    ctx.lineTo(VN_W, VN_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4a1d1d";
    ctx.beginPath();
    ctx.moveTo(0, VN_H);
    ctx.lineTo(vx - 80, vy + 60);
    ctx.lineTo(vx + 80, vy + 60);
    ctx.lineTo(VN_W, VN_H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#020101";
    ctx.fillRect(vx - 80, vy - 60, 160, 120);
    // portes et appliques
    for (const t of [0.15, 0.4, 0.62, 0.8]) {
      for (const side of [-1, 1]) {
        const x = vx + side * (80 + (600 - 80) * (1 - t)), s = 1 - t * 0.85;
        const h = 300 * s, w = 70 * s, y = vy + 60 * s - h * 0.7;
        ctx.fillStyle = "#1a0d06";
        ctx.fillRect(x - (side > 0 ? w : 0), y, w, h);
        glow(ctx, x + side * -w * 1.2, y + h * 0.15, 90 * s, "#fbbf24", 0.3);
        disc(ctx, x + side * -w * 1.2, y + h * 0.15, 5 * s, "#fde68a");
      }
    }
    vnFog(ctx, 220, 200, "#78350f", 0.12);
  },
  toits(ctx) {
    vnSky(ctx, ["#030712", "#0c1a3a", "#1e1b4b"]);
    vnStars(ctx, 41, 120, 300);
    vnMoon(ctx, 900, 130, 52);
    vnEiffel(ctx, 640, 470, 360, "#0b1022");
    vnSkyline(ctx, 51, 520, "#0a0f20", 100, 200, 0.18);
    // toits au premier plan : zinc et cheminées
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.moveTo(0, 560);
    ctx.lineTo(380, 470);
    ctx.lineTo(760, 560);
    ctx.lineTo(VN_W, 500);
    ctx.lineTo(VN_W, VN_H);
    ctx.lineTo(0, VN_H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    for (let x = 0; x < VN_W; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 600);
      ctx.lineTo(x + 40, 520);
      ctx.stroke();
    }
    for (const [x, y] of [[180, 470], [560, 480], [980, 450]]) {
      ctx.fillStyle = "#3f2a1d";
      ctx.fillRect(x, y, 34, 60);
      for (let k = 0; k < 3; k++) ctx.fillRect(x + 4 + k * 10, y - 12, 7, 14);
    }
    vnRain(ctx, 13, 420, 0.3);
    vnFog(ctx, 380, 200, "#6366f1", 0.12);
  },
  casino(ctx) {
    vnSky(ctx, ["#2a0508", "#4a0a12", "#140204"]);
    // rideaux de velours
    for (let x = 0; x < VN_W; x += 40) {
      const g = ctx.createLinearGradient(x, 0, x + 40, 0);
      g.addColorStop(0, "#3f0a10");
      g.addColorStop(0.5, "#7f1d1d");
      g.addColorStop(1, "#3f0a10");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 40, 380);
    }
    vnChandelier(ctx, 300, 70, 80);
    vnChandelier(ctx, 900, 70, 80);
    vnBokeh(ctx, 19, 60, ["#fbbf24", "#fde68a", "#f87171"], 60, 400);
    // tables de jeu
    ctx.fillStyle = "#1a0c06";
    ctx.fillRect(0, 400, VN_W, VN_H - 400);
    for (const x of [250, 650, 1030]) {
      ctx.fillStyle = "#064e3b";
      ctx.beginPath();
      ctx.ellipse(x, 470, 170, 55, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#a16207";
      ctx.lineWidth = 8;
      ctx.stroke();
      const r = seeded(x);
      for (let k = 0; k < 6; k++) {
        disc(ctx, x - 90 + r() * 180, 460 + r() * 20, 9, ["#ef4444", "#f5f5f4", "#1d4ed8"][k % 3]);
      }
      glow(ctx, x, 470, 200, "#fbbf24", 0.1);
    }
  },
  mairie(ctx) {
    vnSky(ctx, ["#1e1b4b", "#4c1d95", "#f59e0b"]);
    vnSkyline(ctx, 61, 500, "#1f1630", 120, 200, 0.2);
    // façade de l'Hôtel de Ville
    ctx.fillStyle = "#cbbfa8";
    ctx.fillRect(200, 180, 800, 330);
    ctx.fillStyle = "#b7a98f";
    ctx.beginPath();
    ctx.moveTo(180, 180);
    ctx.lineTo(600, 80);
    ctx.lineTo(1020, 180);
    ctx.closePath();
    ctx.fill();
    vnColumns(ctx, 270, 8, 94, 220, 470, "#e7dcc7");
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(560, 380, 80, 130);
    for (const x of [380, 820]) {
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(x, 30, 4, 130);
      for (const [i, c] of ["#1d4ed8", "#f5f5f4", "#dc2626"].entries()) {
        ctx.fillStyle = c;
        ctx.fillRect(x + 4 + i * 22, 34, 22, 44);
      }
    }
    ctx.fillStyle = "#57534e";
    ctx.fillRect(0, 510, VN_W, VN_H - 510);
    for (let s = 0; s < 4; s++) {
      ctx.fillStyle = `rgba(255,255,255,${0.05 + s * 0.03})`;
      ctx.fillRect(160 - s * 20, 510 + s * 22, 880 + s * 40, 22);
    }
    glow(ctx, 600, 600, 600, "#f59e0b", 0.15);
  },
  archives(ctx) {
    vnSky(ctx, ["#0a0a08", "#16140f", "#050504"]);
    // rangées d'étagères en perspective
    for (let i = 6; i >= 0; i--) {
      const s = 1 - i * 0.11, w = 1100 * s, h = 470 * s, x = 600 - w / 2, y = 330 - h / 2;
      for (const side of [-1, 1]) {
        ctx.fillStyle = `rgba(${40 - i * 4},${32 - i * 3},${22 - i * 2},1)`;
        const bx = side < 0 ? x : x + w - 120 * s;
        ctx.fillRect(bx, y, 120 * s, h);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = `rgba(214,201,170,${0.5 - i * 0.05})`;
          ctx.fillRect(bx + 6 * s, y + 14 * s + k * (h / 6), 108 * s, (h / 6) * 0.55);
        }
      }
    }
    // ampoule nue
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(600, 0);
    ctx.lineTo(600, 150);
    ctx.stroke();
    glow(ctx, 600, 160, 320, "#fde68a", 0.35);
    disc(ctx, 600, 160, 12, "#fffbeb");
    // poussière en suspension
    const r = seeded(99);
    for (let i = 0; i < 160; i++) disc(ctx, 380 + r() * 440, 160 + r() * 400, r() * 1.6, `rgba(253,230,138,${r() * 0.5})`);
  },
  irf(ctx) {
    vnSky(ctx, ["#020617", "#0b1324", "#020617"]);
    vnWindow(ctx, 660, 60, 420, 330, true);
    // stores : rayures de lumière
    ctx.fillStyle = "rgba(15,23,42,0.85)";
    for (let y = 60; y < 390; y += 22) ctx.fillRect(660, y, 420, 11);
    ctx.fillStyle = "rgba(147,197,253,0.08)";
    for (let k = 0; k < 9; k++) {
      ctx.beginPath();
      ctx.moveTo(660, 70 + k * 36);
      ctx.lineTo(1080, 70 + k * 36);
      ctx.lineTo(560, 520 + k * 24);
      ctx.lineTo(120, 520 + k * 24);
      ctx.closePath();
      ctx.fill();
    }
    // classeurs et bureau
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = "#334155";
      ctx.fillRect(60 + i * 110, 220, 100, 280);
      for (let d = 0; d < 4; d++) {
        ctx.fillStyle = "#475569";
        ctx.fillRect(68 + i * 110, 232 + d * 68, 84, 56);
        ctx.fillStyle = "#cbd5e1";
        ctx.fillRect(100 + i * 110, 254 + d * 68, 20, 6);
      }
    }
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(200, 470, 800, 40);
    glow(ctx, 330, 440, 150, "#e0f2fe", 0.25);
    vnFog(ctx, 300, 300, "#0ea5e9", 0.06);
  },
  aube(ctx) {
    vnSky(ctx, ["#1e1b4b", "#be185d", "#f97316", "#fde68a"]);
    glow(ctx, 600, 520, 420, "#fde68a", 0.6);
    disc(ctx, 600, 520, 70, "rgba(255,247,214,0.9)");
    vnEiffel(ctx, 880, 520, 330, "#2a1330");
    vnSkyline(ctx, 71, 560, "#2a1330", 90, 210, 0.08, "#fdba74");
    vnFog(ctx, 420, 220, "#fecaca", 0.18);
  },
  cave(ctx) {
    vnSky(ctx, ["#0c0a09", "#1c1917", "#0c0a09"]);
    for (const x of [100, 500, 900]) {
      ctx.fillStyle = "#292524";
      ctx.beginPath();
      ctx.moveTo(x - 160, VN_H);
      ctx.lineTo(x - 160, 220);
      ctx.quadraticCurveTo(x + 40, 40, x + 240, 220);
      ctx.lineTo(x + 240, VN_H);
      ctx.lineTo(x + 180, VN_H);
      ctx.lineTo(x + 180, 240);
      ctx.quadraticCurveTo(x + 40, 110, x - 100, 240);
      ctx.lineTo(x - 100, VN_H);
      ctx.closePath();
      ctx.fill();
    }
    const r = seeded(5);
    for (let i = 0; i < 220; i++) {
      ctx.strokeStyle = `rgba(68,64,60,${0.3 + r() * 0.4})`;
      ctx.strokeRect(r() * VN_W, r() * VN_H, 30 + r() * 30, 14 + r() * 8);
    }
    glow(ctx, 600, 420, 260, "#f59e0b", 0.35);
  },
};
function decor(key) {
  if (decorCache.has(key)) return decorCache.get(key);
  const c = createCanvas(VN_W, VN_H);
  const ctx = c.getContext("2d");
  (DECORS[key] ?? DECORS.rue_pluie)(ctx);
  decorCache.set(key, c);
  return c;
}
async function castImage(who) {
  const c = STORY_CAST[who];
  return c ? fetchImage(`fluent:${c.fluent}`, fluentUrl(c.fluent)) : null;
}
async function propImage(key) {
  const p = STORY_PROPS[key];
  return p ? fetchImage(`fluent:${p[1]}`, fluentUrl(p[1])) : null;
}
// ambiances posées par-dessus le décor
function vnMood(ctx, mood, seed) {
  if (mood === "pluie") vnRain(ctx, seed, 300, 0.22);
  if (mood === "brume") vnFog(ctx, 250, 380, "#cbd5e1", 0.22);
  if (mood === "danger") {
    const g = ctx.createRadialGradient(VN_W / 2, VN_H / 2, 200, VN_W / 2, VN_H / 2, VN_W * 0.7);
    g.addColorStop(0, "rgba(127,29,29,0)");
    g.addColorStop(1, "rgba(127,29,29,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VN_W, VN_H);
  }
  if (mood === "mystere") {
    ctx.fillStyle = "rgba(76,29,149,0.22)";
    ctx.fillRect(0, 0, VN_W, VN_H);
    vnBokeh(ctx, seed, 18, ["#c4b5fd", "#a5f3fc"]);
  }
  if (mood === "souvenir") {
    ctx.fillStyle = "rgba(120,80,30,0.35)";
    ctx.fillRect(0, 0, VN_W, VN_H);
  }
}
function vnLetterbox(ctx) {
  for (const [y, dir] of [[0, 1], [VN_H - 34, -1]]) {
    const g = ctx.createLinearGradient(0, dir > 0 ? 0 : VN_H, 0, dir > 0 ? 34 : VN_H - 34);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0.6)");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, VN_W, 34);
  }
}
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
// image d'une scène : décor, ambiance, personnage ou objet, titre de chapitre, bandeau de résultat
async function drawStoryScene(scene, opts = {}) {
  const c = createCanvas(VN_W, VN_H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decor(scene.bg), 0, 0);
  vnMood(ctx, scene.mood, hashOf(scene.id ?? "x"));
  vnVignette(ctx, scene.title ? 0.85 : 0.6);
  const cast = scene.who && STORY_CAST[scene.who];
  if (scene.title) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, VN_W, VN_H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde68a";
    ctx.font = "26px CardEngrave";
    spaced(ctx, `CHAPITRE ${ROMAN[scene.ch] ?? scene.ch}`, VN_W / 2, 240, 10);
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffffff";
    ctx.font = `${fitText(ctx, scene.title, 1000, 72, "CardTitle")}px CardTitle`;
    ctx.fillText(scene.title, VN_W / 2, 330);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(253,230,138,0.7)";
    ctx.lineWidth = 2;
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(VN_W / 2 + dir * 90, 370);
      ctx.lineTo(VN_W / 2 + dir * 330, 370);
      ctx.stroke();
      disc(ctx, VN_W / 2 + dir * 80, 370, 4, "#fde68a");
    }
    ctx.font = "22px CardItalic";
    ctx.fillStyle = "#e7d6b0";
    ctx.fillText("Les Secrets de la Maison", VN_W / 2, 410);
    ctx.textAlign = "left";
  } else if (cast) {
    const left = scene.side === "left", size = 560, px = left ? 20 : VN_W - size - 10, py = VN_H - size + 40;
    glow(ctx, px + size / 2, py + size * 0.42, size * 0.6, cast.color, 0.3);
    ctx.save();
    if (scene.mood === "souvenir") ctx.filter = "sepia(0.6)";
    drawSilhouette(ctx, scene.who, px, py, size);
    ctx.restore();
    // plaque du nom
    const nx = left ? 40 : VN_W - 520, ny = VN_H - 120;
    roundRect(ctx, nx, ny, 480, 70, 14);
    const g = ctx.createLinearGradient(nx, 0, nx + 480, 0);
    g.addColorStop(0, "rgba(10,8,14,0.92)");
    g.addColorStop(1, "rgba(10,8,14,0.55)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = cast.color;
    ctx.fillRect(nx, ny + 10, 5, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "30px CardTitle";
    ctx.fillText(cast.name, nx + 22, ny + 36);
    ctx.font = "16px CardItalic";
    ctx.fillStyle = rgba(cast.color, 0.95);
    ctx.fillText(cast.role, nx + 22, ny + 58);
  }
  if (scene.prop && !scene.title) {
    const img = await propImage(scene.prop), x = cast ? 330 : VN_W / 2, y = cast ? 330 : 300, s = cast ? 180 : 240;
    glow(ctx, x, y, s * 1.3, "#fde68a", 0.45);
    if (img) {
      ctx.save();
      ctx.shadowColor = "rgba(253,230,138,0.8)";
      ctx.shadowBlur = 30;
      ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
      ctx.restore();
    }
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      crestSparkle(ctx, x + Math.cos(a) * s * 0.75, y + Math.sin(a) * s * 0.7, 5 + (k % 3) * 3, "rgba(255,250,230,0.9)");
    }
  }
  vnLetterbox(ctx);
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "rgba(253,230,138,0.75)";
  ctx.fillText(`LES SECRETS DE LA MAISON  ·  CHAPITRE ${ROMAN[scene.ch] ?? scene.ch}`, 22, 22);
  if (opts.banner) {
    const [text, color] = opts.banner;
    ctx.save();
    ctx.translate(VN_W / 2, 150);
    ctx.rotate(-0.04);
    roundRect(ctx, -260, -46, 520, 92, 18);
    ctx.fillStyle = rgba(color, 0.92);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "50px CardTitle";
    ctx.fillText(text, 0, 18);
    ctx.restore();
  }
  return c;
}
// image d'un duel : le boss à droite, votre carte à gauche, les points de vie
async function drawStoryDuel(scene, duel) {
  const c = createCanvas(VN_W, VN_H);
  const ctx = c.getContext("2d");
  ctx.drawImage(decor(scene.bg), 0, 0);
  vnMood(ctx, "danger", 3);
  vnVignette(ctx, 0.7);
  const boss = STORY_CAST[duel.boss.who];
  glow(ctx, 880, 330, 330, boss.color, 0.35);
  drawSilhouette(ctx, duel.boss.who, 640, 110, 500);
  const thumb = await cardThumb(duel.card.card, isHoloKey(duel.card.key), 230, 322);
  ctx.save();
  ctx.translate(250, 330);
  ctx.rotate(-0.05);
  glow(ctx, 0, 0, 260, METAL[duel.card.card.rarity][4], 0.35);
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 24;
  ctx.drawImage(thumb, -115, -161, 230, 322);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "70px CardTitle";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 16;
  ctx.fillText("VS", 520, 350);
  ctx.shadowBlur = 0;
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#fecaca";
  spaced(ctx, `DUEL · MANCHE ${duel.round}`, VN_W / 2, 70, 4);
  ctx.textAlign = "left";
  hpBar(ctx, 110, 520, 290, 22, duel.hp, duel.maxHp);
  hpBar(ctx, 700, 560, 380, 22, duel.bossHp, duel.boss.hp);
  ctx.font = "22px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(duel.card.card.name, 110, 510);
  ctx.fillText(boss.name, 700, 550);
  vnLetterbox(ctx);
  return c;
}
// couverture du livre
async function drawStoryCover() {
  const c = createCanvas(VN_W, VN_H);
  const ctx = c.getContext("2d");
  ctx.drawImage(decor("facade"), 0, 0);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, VN_W, VN_H);
  vnVignette(ctx, 0.85);
  const key = await propImage("cle");
  glow(ctx, VN_W / 2, 200, 200, "#fde68a", 0.4);
  if (key) ctx.drawImage(key, VN_W / 2 - 90, 110, 180, 180);
  ctx.textAlign = "center";
  ctx.font = "22px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, "MODE HISTOIRE", VN_W / 2, 340, 10);
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 24;
  ctx.font = "78px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Les Secrets de la Maison", VN_W / 2, 430);
  ctx.shadowBlur = 0;
  ctx.font = "24px CardItalic";
  ctx.fillStyle = "#e7d6b0";
  ctx.fillText("Le Fondateur a disparu. Il ne reste qu'un jeu de cartes… et vous.", VN_W / 2, 480);
  ctx.textAlign = "left";
  vnLetterbox(ctx);
  return c;
}

// --- Portraits en silhouette « film noir » ---
// Chaque personnage a sa carrure, sa coiffure ou son chapeau et ses détails (nœud papillon, écharpe tricolore,
// boucles d'oreilles, lunettes…). Silhouette sombre, liseré de lumière à sa couleur, reflets dans les yeux.
function silhouetteShapes(who) {
  const P = () => new Path2D();
  const shapes = [];
  const body = (sw = 1, neck = 6, drop = 0) => {
    const p = P();
    const L = (x) => 50 + (x - 50) * sw;
    p.moveTo(L(-4), 101);
    p.bezierCurveTo(L(-2), 84 + drop, L(8), 74 + drop, L(28), 68 + drop);
    p.lineTo(50 - neck, 60);
    p.lineTo(50 + neck, 60);
    p.lineTo(L(72), 68 + drop);
    p.bezierCurveTo(L(92), 74 + drop, L(102), 84 + drop, L(104), 101);
    p.closePath();
    shapes.push(p);
    const n = P();
    n.rect(50 - neck, 48, neck * 2, 16);
    shapes.push(n);
  };
  const head = (rx = 12.5, ry = 15.5, cy = 38) => {
    const h = P();
    h.ellipse(50, cy, rx, ry, 0, 0, TAU);
    shapes.push(h);
  };
  if (who === "augustin") {
    body(0.9, 5, 3);
    head(12, 15, 39);
    const tufts = P();
    tufts.ellipse(37.5, 38, 3.5, 6, 0.2, 0, TAU);
    tufts.ellipse(62.5, 38, 3.5, 6, -0.2, 0, TAU);
    shapes.push(tufts);
  } else if (who === "rosier") {
    body(0.85, 5, 4);
    head(11.5, 14.5, 40);
    const hair = P();
    hair.ellipse(50, 33, 14, 12, 0, Math.PI, 0);
    hair.ellipse(50, 20, 7, 6.5, 0, 0, TAU);
    shapes.push(hair);
  } else if (who === "valence") {
    body(1, 5, 0);
    head(11.5, 14.5, 40);
    const hair = P();
    hair.moveTo(36, 36);
    hair.quadraticCurveTo(34, 52, 40, 54);
    hair.lineTo(60, 54);
    hair.quadraticCurveTo(66, 52, 64, 36);
    hair.closePath();
    shapes.push(hair);
    const hat = P();
    hat.ellipse(50, 28, 25, 4.5, -0.05, 0, TAU);
    hat.moveTo(37, 28);
    hat.bezierCurveTo(37, 14, 41, 11, 50, 13);
    hat.bezierCurveTo(59, 11, 63, 14, 63, 28);
    hat.closePath();
    shapes.push(hat);
    const collar = P();
    collar.moveTo(30, 70);
    collar.lineTo(40, 52);
    collar.lineTo(47, 66);
    collar.closePath();
    collar.moveTo(70, 70);
    collar.lineTo(60, 52);
    collar.lineTo(53, 66);
    collar.closePath();
    shapes.push(collar);
  } else if (who === "velours") {
    body(0.92, 4.5, 2);
    head(11, 14.5, 39);
    const hair = P();
    hair.moveTo(38, 30);
    hair.bezierCurveTo(30, 40, 36, 52, 30, 62);
    hair.bezierCurveTo(26, 70, 34, 76, 30, 82);
    hair.lineTo(40, 80);
    hair.bezierCurveTo(42, 64, 40, 52, 44, 40);
    hair.lineTo(56, 40);
    hair.bezierCurveTo(60, 52, 58, 64, 60, 80);
    hair.lineTo(70, 82);
    hair.bezierCurveTo(66, 76, 74, 70, 70, 62);
    hair.bezierCurveTo(64, 52, 70, 40, 62, 30);
    hair.bezierCurveTo(58, 20, 42, 20, 38, 30);
    hair.closePath();
    shapes.push(hair);
  } else if (who === "molosse" || who === "gardien") {
    body(who === "molosse" ? 1.28 : 1.05, who === "molosse" ? 9 : 6, -2);
    head(who === "molosse" ? 13.5 : 12, 15.5, 39);
    if (who === "gardien") {
      const cap = P();
      cap.ellipse(50, 28, 14, 8, 0, Math.PI, 0);
      cap.moveTo(70, 29);
      cap.ellipse(56, 29, 14, 3, 0.1, 0, TAU);
      shapes.push(cap);
    }
  } else if (who === "noe") {
    body(1, 5.5, 0);
    const hood = P();
    hood.ellipse(50, 40, 19, 21, 0, 0, TAU);
    shapes.push(hood);
    head(11.5, 14.5, 41);
  } else if (who === "delorme") {
    body(1.05, 5.5, 0);
    head(12, 15, 40);
    const hat = P();
    hat.ellipse(50, 27, 21, 3.6, 0, 0, TAU);
    hat.rect(38.5, 3, 23, 24);
    shapes.push(hat);
  } else if (who === "arnaud") {
    body(1.02, 5.5, 0);
    head(12, 15, 39);
    const hair = P();
    hair.moveTo(37.5, 36);
    hair.bezierCurveTo(36, 22, 46, 20, 56, 22);
    hair.bezierCurveTo(64, 24, 64, 30, 62.5, 36);
    hair.lineTo(60, 30);
    hair.lineTo(42, 28);
    hair.closePath();
    shapes.push(hair);
  } else {
    // l'ombre : silhouette aux bords déchirés
    body(1, 6, 0);
    head(12.5, 15.5, 38);
    const rag = P();
    const r = seeded(13);
    for (let k = 0; k < 14; k++) {
      const x = 4 + k * 7, y = 92 + r() * 6;
      rag.moveTo(x, 101);
      rag.lineTo(x + 3, y);
      rag.lineTo(x + 6, 101);
    }
    shapes.push(rag);
  }
  return shapes;
}
function silhouetteDetails(ctx, who) {
  const eyes = (y = 40, c = "rgba(255,255,255,0.75)", dx = 5) => {
    disc(ctx, 50 - dx, y, 0.9, c);
    disc(ctx, 50 + dx, y, 0.9, c);
  };
  ctx.lineCap = "round";
  if (who === "augustin") {
    ctx.fillStyle = "#e9c46a";
    ctx.beginPath();
    ctx.moveTo(50, 63);
    ctx.lineTo(44, 60);
    ctx.lineTo(44, 66);
    ctx.closePath();
    ctx.moveTo(50, 63);
    ctx.lineTo(56, 60);
    ctx.lineTo(56, 66);
    ctx.closePath();
    ctx.fill();
    disc(ctx, 50, 63, 1.2, "#b45309");
    ctx.strokeStyle = "rgba(240,240,240,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(45, 46);
    ctx.quadraticCurveTo(50, 44, 55, 46);
    ctx.stroke();
    eyes(39);
  } else if (who === "rosier") {
    ctx.strokeStyle = "rgba(249,168,212,0.8)";
    ctx.lineWidth = 0.8;
    for (const x of [45, 55]) {
      ctx.beginPath();
      ctx.arc(x, 40, 3.2, 0, TAU);
      ctx.stroke();
    }
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * (0.15 + (k / 10) * 0.7);
      disc(ctx, 50 + Math.cos(a) * 11, 58 + Math.sin(a) * 9, 1, "rgba(255,250,240,0.9)");
    }
  } else if (who === "valence") {
    ctx.fillStyle = "rgba(147,197,253,0.9)";
    ctx.fillRect(36, 76, 5, 3);
    eyes(41, "rgba(191,219,254,0.9)");
  } else if (who === "velours") {
    ctx.strokeStyle = "rgba(244,63,94,0.85)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(30, 76);
    ctx.quadraticCurveTo(50, 88, 70, 76);
    ctx.stroke();
    for (const x of [38.5, 61.5]) disc(ctx, x, 46, 1.4, "#fde68a");
    disc(ctx, 50, 70, 1.6, "#fde68a");
    eyes(39, "rgba(255,228,230,0.9)", 4.5);
  } else if (who === "molosse") {
    ctx.fillStyle = "rgba(10,10,10,0.95)";
    ctx.fillRect(40, 37, 20, 4.5);
    disc(ctx, 43, 38.5, 0.8, "rgba(255,255,255,0.8)");
    ctx.strokeStyle = "rgba(249,115,22,0.6)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(63, 41);
    ctx.bezierCurveTo(68, 48, 62, 52, 66, 60);
    ctx.stroke();
  } else if (who === "gardien") {
    disc(ctx, 50, 22, 1.6, "#fde68a");
    ctx.strokeStyle = "rgba(203,213,225,0.7)";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.arc(64, 82, 3.5, 0, TAU);
    ctx.stroke();
    eyes(40);
  } else if (who === "noe") {
    ctx.strokeStyle = "rgba(34,211,238,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(41.5, 38.5, 6.5, 4);
    ctx.strokeRect(52, 38.5, 6.5, 4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(50, 40, 17, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    for (const x of [33.5, 66.5]) disc(ctx, x, 42, 3, "rgba(34,211,238,0.55)");
  } else if (who === "delorme") {
    ctx.lineWidth = 3;
    for (const [i, c] of ["#1d4ed8", "#f5f5f4", "#dc2626"].entries()) {
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(30 + i * 3, 68);
      ctx.lineTo(70 + i * 3, 101);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(220,220,220,0.5)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(45, 46.5);
    ctx.quadraticCurveTo(50, 44.5, 55, 46.5);
    ctx.stroke();
    eyes(40);
  } else if (who === "arnaud") {
    ctx.fillStyle = "#16a34a";
    ctx.beginPath();
    ctx.moveTo(48.5, 62);
    ctx.lineTo(51.5, 62);
    ctx.lineTo(53, 84);
    ctx.lineTo(50, 88);
    ctx.lineTo(47, 84);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(40, 64);
    ctx.lineTo(47, 84);
    ctx.moveTo(60, 64);
    ctx.lineTo(53, 84);
    ctx.stroke();
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(55, 48);
    ctx.lineTo(64, 49.5);
    ctx.stroke();
    glow(ctx, 64.5, 49.5, 5, "#f97316", 0.9);
    ctx.strokeStyle = "rgba(226,232,240,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(65, 48);
    ctx.bezierCurveTo(70, 40, 62, 34, 70, 26);
    ctx.stroke();
    eyes(39);
  } else if (who === "ombre") {
    for (const x of [45, 55]) {
      glow(ctx, x, 38, 5, "#a78bfa", 0.9);
      disc(ctx, x, 38, 1.1, "#ede9fe");
    }
  }
}
// dessine le portrait dans un carré de « size » pixels
function drawSilhouette(ctx, who, x, y, size) {
  const cast = STORY_CAST[who] ?? STORY_CAST.ombre, k = size / 100, shapes = silhouetteShapes(who), color = cast.color;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  // halo et liseré de lumière (contre-jour venant de la gauche)
  ctx.save();
  ctx.filter = "blur(3px)";
  ctx.fillStyle = rgba(color, 0.55);
  for (const p of shapes) ctx.fill(p);
  ctx.restore();
  ctx.save();
  ctx.translate(-1.4, -0.6);
  ctx.fillStyle = rgba(color, 0.95);
  for (const p of shapes) ctx.fill(p);
  ctx.restore();
  const g = ctx.createLinearGradient(0, 0, 100, 100);
  g.addColorStop(0, "#1b1726");
  g.addColorStop(0.55, "#0a0910");
  g.addColorStop(1, "#030305");
  ctx.fillStyle = g;
  if (who === "ombre") ctx.globalAlpha = 0.82;
  for (const p of shapes) ctx.fill(p);
  ctx.globalAlpha = 1;
  silhouetteDetails(ctx, who);
  ctx.restore();
}
