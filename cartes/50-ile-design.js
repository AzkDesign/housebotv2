
// --- L'île : vraie scène illustrée et skins d'île (boutique) ---
// L'île est dessinée en plein cadre (ciel, mer, lagon, plage, décor en 3D) avec les cartes de la défense
// plantées sur la plage et un panneau pour le gardien. Le skin équipé par le gardien (boutique → Îles)
// change toute la scène : tout le serveur le voit tant qu'il tient l'île.
const ISLE_SKINS = {
  ile_tropique: {
    name: "Lagon tropical", free: true, accent: "#22d3ee",
    sky: ["#0ea5e9", "#7dd3fc", "#fef3c7"], sea: ["#22d3ee", "#0e7490", "#082f49"], lagoon: "#5eead4", sand: ["#fef3c7", "#fbbf24", "#b45309"], grass: ["#86efac", "#16a34a"],
    body: { kind: "sun", x: 0.8, y: 0.15, r: 46, color: "#fff7d6" }, clouds: "#ffffff",
    props: [["Palm tree", -0.42, 0.9], ["Palm tree", 0.36, 0.78], ["Hibiscus", -0.05, 0.28], ["Coconut", 0.12, 0.22], ["Crab", 0.58, 0.2], ["Spiral shell", -0.66, 0.18]],
    far: [["Sailboat", 0.9, 0.08], ["Dolphin", 0.1, 0.07]], fx: "birds",
  },
  ile_nuit: {
    name: "Lagon de nuit", price: 2000, cur: "dust", accent: "#67e8f9",
    sky: ["#020617", "#0f1e4a", "#1e3a8a"], sea: ["#0e7490", "#082f49", "#020617"], lagoon: "#22d3ee", sand: ["#cbd5e1", "#64748b", "#1e293b"], grass: ["#166534", "#052e16"],
    body: { kind: "moon", x: 0.78, y: 0.16, r: 50, color: "#f8fafc" }, stars: true, clouds: "#334155",
    props: [["Palm tree", -0.4, 0.88], ["Hut", 0.3, 0.55], ["Red paper lantern", -0.05, 0.26], ["Red paper lantern", 0.56, 0.24]],
    far: [["Sailboat", 0.12, 0.07]], fx: "fireflies", glowSea: "#22d3ee",
  },
  ile_volcan: {
    name: "Île volcanique", price: 2500, cur: "dust", accent: "#f97316",
    sky: ["#1c0500", "#7c2d12", "#fb923c"], sea: ["#7c2d12", "#3b0d02", "#0c0300"], lagoon: "#f97316", sand: ["#57534e", "#292524", "#0c0a09"], grass: ["#3f6212", "#1a2e05"],
    body: { kind: "sun", x: 0.15, y: 0.18, r: 40, color: "#fdba74" }, clouds: "#44403c",
    props: [["Volcano", 0.05, 1.05], ["Rock", -0.55, 0.3], ["Fire", 0.42, 0.26], ["Rock", 0.6, 0.22], ["Palm tree", -0.35, 0.62]],
    far: [["Ship", 0.88, 0.08]], fx: "embers", glowSea: "#f97316",
  },
  ile_banquise: {
    name: "Banquise", price: 2500, cur: "dust", accent: "#7dd3fc",
    sky: ["#0c4a6e", "#7dd3fc", "#e0f2fe"], sea: ["#7dd3fc", "#0369a1", "#0c1e3a"], lagoon: "#e0f2fe", sand: ["#ffffff", "#e0f2fe", "#7dd3fc"], grass: ["#f8fafc", "#bae6fd"],
    body: { kind: "sun", x: 0.82, y: 0.14, r: 36, color: "#f0f9ff" }, aurora: true, clouds: "#e0f2fe",
    props: [["Evergreen tree", -0.45, 0.62], ["Snowman", 0.38, 0.42], ["Penguin", -0.08, 0.3], ["Penguin", 0.1, 0.26], ["Polar bear", -0.62, 0.3]],
    far: [["Spouting whale", 0.86, 0.09], ["Seal", 0.12, 0.06]], fx: "snow",
  },
  ile_sakura: {
    name: "Île des cerisiers", price: 2200, cur: "dust", accent: "#f9a8d4",
    sky: ["#831843", "#f472b6", "#fde4f0"], sea: ["#f9a8d4", "#9d174d", "#2a0716"], lagoon: "#fbcfe8", sand: ["#fdf2f8", "#f9a8d4", "#9d174d"], grass: ["#86efac", "#15803d"],
    body: { kind: "sun", x: 0.2, y: 0.18, r: 44, color: "#fff1f2" }, clouds: "#fdf2f8",
    props: [["Cherry blossom", -0.45, 0.72], ["Shinto shrine", 0.05, 0.72], ["Cherry blossom", 0.5, 0.62], ["Red paper lantern", -0.2, 0.26], ["Red paper lantern", 0.3, 0.24]],
    far: [["Mount fuji", 0.82, 0.2]], fx: "petals",
  },
  ile_moai: {
    name: "Île de Pâques", price: 2400, cur: "dust", accent: "#a3e635",
    sky: ["#334155", "#94a3b8", "#fde68a"], sea: ["#0891b2", "#164e63", "#082f49"], lagoon: "#67e8f9", sand: ["#fde68a", "#a16207", "#422006"], grass: ["#65a30d", "#365314"],
    body: { kind: "sun", x: 0.84, y: 0.2, r: 34, color: "#fef3c7" }, clouds: "#e2e8f0",
    props: [["Moai", -0.35, 0.7], ["Moai", 0.02, 0.78], ["Moai", 0.38, 0.7], ["Rock", 0.62, 0.22], ["Rock", -0.62, 0.2]],
    far: [["Sailboat", 0.12, 0.07]], fx: "birds",
  },
  ile_tresor: {
    name: "Île au trésor", price: 3000, cur: "dust", accent: "#fbbf24",
    sky: ["#7c2d12", "#f97316", "#fde68a"], sea: ["#0e7490", "#164e63", "#082f49"], lagoon: "#5eead4", sand: ["#fde68a", "#d97706", "#78350f"], grass: ["#4ade80", "#166534"],
    body: { kind: "sun", x: 0.5, y: 0.34, r: 58, color: "#fff7ed" }, clouds: "#fed7aa",
    props: [["Palm tree", -0.45, 0.85], ["Pirate flag", 0.3, 0.62], ["Money bag", -0.06, 0.32], ["Coin", 0.14, 0.18], ["Parrot", 0.55, 0.3], ["Skull and crossbones", -0.6, 0.2]],
    far: [["Ship", 0.85, 0.12]], fx: "sparkles",
  },
  ile_paradis: {
    name: "Paradis doré", price: 8000, cur: "euro", accent: "#fde68a",
    sky: ["#78350f", "#f59e0b", "#fff7d6"], sea: ["#fbbf24", "#0e7490", "#082f49"], lagoon: "#fde68a", sand: ["#fff7d6", "#fbbf24", "#92400e"], grass: ["#a3e635", "#3f6212"],
    body: { kind: "sun", x: 0.78, y: 0.16, r: 54, color: "#fffbeb" }, clouds: "#fef3c7",
    props: [["Castle", 0.02, 0.95], ["Palm tree", -0.5, 0.8], ["Palm tree", 0.5, 0.72], ["Crown", -0.18, 0.26], ["Gem stone", 0.24, 0.22]],
    far: [["Speedboat", 0.12, 0.08], ["Motor boat", 0.88, 0.07]], fx: "sparkles", glowSea: "#fbbf24",
  },
  ile_hantee: {
    name: "Île hantée", price: 1666, cur: "dust", month: 10, accent: "#a78bfa",
    sky: ["#05010d", "#2e1065", "#4c1d95"], sea: ["#312e81", "#1e1b4b", "#05010d"], lagoon: "#a78bfa", sand: ["#a8a29e", "#57534e", "#1c1917"], grass: ["#3f3f46", "#18181b"],
    body: { kind: "moon", x: 0.8, y: 0.17, r: 54, color: "#fef3c7" }, stars: true, clouds: "#1e1b4b",
    props: [["Wilted flower", -0.55, 0.3], ["Ghost", 0.42, 0.62], ["Jack-o-lantern", -0.12, 0.3], ["Jack-o-lantern", 0.18, 0.24], ["Spider web", -0.38, 0.5]],
    far: [["Bat", 0.3, 0.06], ["Bat", 0.62, 0.05]], fx: "fog", glowSea: "#a78bfa",
  },
};
const ISLE_DEFAULT = "ile_tropique";
const isleSkinOf = (isl) => {
  for (const id of islandMates(isl?.holder)) {
    const skin = equipped(id, "ile");
    if (skin && ISLE_SKINS[skin]) return skin;
  }
  return ISLE_DEFAULT;
};
const isleImg = (name) => fetchImage(`fluent:${name}`, fluentUrl(name)).catch(() => null);

// la scène : ciel, mer, île et décor (sans interface)
const isleSceneCache = new Map();
async function drawIslandScene(skinId, W, H, cx, cy, R) {
  const key = `${skinId}:${W}x${H}:${cx}:${cy}:${R}`;
  if (isleSceneCache.has(key)) return isleSceneCache.get(key);
  const S = ISLE_SKINS[skinId] ?? ISLE_SKINS[ISLE_DEFAULT], c = createCanvas(W, H), ctx = c.getContext("2d"), Rn = seeded(hashOf(skinId) + W);
  const hz = Math.round(H * 0.46);
  // ciel
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  S.sky.forEach((col, i) => sky.addColorStop(i / (S.sky.length - 1), col));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hz + 2);
  if (S.stars) for (let k = 0; k < 220; k++) disc(ctx, Rn() * W, Rn() * hz * 0.9, Rn() * 1.3 + 0.3, `rgba(255,255,255,${0.3 + Rn() * 0.7})`);
  if (S.aurora)
    for (const [band, col] of [[0, "#34d399"], [1, "#22d3ee"], [2, "#a78bfa"]])
      for (let x = 0; x < W; x += 3) {
        const y = hz * 0.12 + band * 26 + Math.sin(x * 0.006 + band) * 26, h = 60 + Math.sin(x * 0.02 + band * 2) * 24 + 20;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.4, rgba(col, 0.25));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 3, h);
      }
  // soleil ou lune
  const b = S.body, bx = W * b.x, by = hz * b.y * 2;
  glow(ctx, bx, by, b.r * 5, b.color, 0.5);
  if (b.kind === "moon") {
    disc(ctx, bx, by, b.r, b.color);
    for (let k = 0; k < 6; k++) disc(ctx, bx + (Rn() - 0.5) * b.r * 1.2, by + (Rn() - 0.5) * b.r * 1.2, b.r * (0.08 + Rn() * 0.14), "rgba(100,116,139,0.25)");
  } else {
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.7, b.color);
    g.addColorStop(1, rgba(b.color, 0.6));
    disc(ctx, bx, by, b.r, g);
  }
  // nuages
  for (let k = 0; k < 7; k++) {
    const x = Rn() * W, y = hz * (0.15 + Rn() * 0.6), w = 90 + Rn() * 160;
    ctx.globalAlpha = 0.18 + Rn() * 0.25;
    for (let j = 0; j < 5; j++) {
      ctx.fillStyle = S.clouds;
      ctx.beginPath();
      ctx.ellipse(x + (j - 2) * w * 0.22, y + Math.sin(j * 1.7) * 6, w * 0.24, w * 0.12, 0, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // îles lointaines
  for (let k = 0; k < 3; k++) {
    const x = Rn() * W, w = 120 + Rn() * 200;
    ctx.fillStyle = rgba(S.sea[2], 0.55);
    ctx.beginPath();
    ctx.ellipse(x, hz + 2, w, 10 + Rn() * 16, 0, Math.PI, TAU);
    ctx.fill();
  }
  // la mer
  const sea = ctx.createLinearGradient(0, hz, 0, H);
  sea.addColorStop(0, S.sea[0]);
  sea.addColorStop(0.45, S.sea[1]);
  sea.addColorStop(1, S.sea[2]);
  ctx.fillStyle = sea;
  ctx.fillRect(0, hz, W, H - hz);
  // reflet de l'astre
  for (let k = 0; k < 40; k++) {
    const y = hz + 4 + k * ((H - hz) / 40), w = 14 + k * 3;
    ctx.fillStyle = rgba(b.color, 0.35 * (1 - k / 44));
    ctx.fillRect(bx - w / 2 + (Rn() - 0.5) * w * 0.6, y, w * (0.3 + Rn() * 0.5), 2);
  }
  // vaguelettes en perspective
  for (let k = 0; k < 120; k++) {
    const t = Rn(), y = hz + 6 + (H - hz) * t * t, x = Rn() * W, len = 8 + t * 40;
    ctx.strokeStyle = `rgba(255,255,255,${0.08 + t * 0.18})`;
    ctx.lineWidth = 1 + t * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y - 2 - t * 3, x + len, y);
    ctx.stroke();
  }
  if (S.glowSea) for (let k = 0; k < 90; k++) {
    const t = Rn(), y = hz + 10 + (H - hz) * t, x = Rn() * W;
    glow(ctx, x, y, 6 + t * 10, S.glowSea, 0.5);
  }
  // décor lointain sur l'eau
  for (const [name, fx, size] of S.far ?? []) {
    const img = await isleImg(name), s = W * size;
    if (img) ctx.drawImage(img, W * fx - s / 2, (name === "Bat" ? hz * 0.6 : hz) - s * (name === "Mount fuji" ? 0.92 : 0.75), s, s);
  }
  // l'île : lagon, écume, plage, herbe
  const ry = R * 0.24;
  const lag = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.45);
  lag.addColorStop(0, rgba(S.lagoon, 0.75));
  lag.addColorStop(1, rgba(S.lagoon, 0));
  ctx.fillStyle = lag;
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.2, R * 1.45, ry * 1.6, 0, 0, TAU);
  ctx.fill();
  const blob = (rx, rr, jitter, seed) => {
    const Rb = seeded(seed), n = 40;
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * TAU, j = 1 + (Rb() - 0.5) * jitter;
      ctx.lineTo(cx + Math.cos(a) * rx * j, cy + Math.sin(a) * rr * j);
    }
    ctx.closePath();
  };
  // écume
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  blob(R * 1.06, ry * 1.12, 0.08, 11);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  blob(R * 1.16, ry * 1.3, 0.1, 12);
  ctx.stroke();
  // flanc de l'île (épaisseur)
  ctx.save();
  ctx.translate(0, ry * 0.32);
  blob(R, ry, 0.06, 13);
  ctx.fillStyle = S.sand[2];
  ctx.fill();
  ctx.restore();
  // plage
  blob(R, ry, 0.06, 13);
  const sg = ctx.createRadialGradient(cx - R * 0.2, cy - ry * 0.4, 10, cx, cy, R);
  sg.addColorStop(0, S.sand[0]);
  sg.addColorStop(1, S.sand[1]);
  ctx.fillStyle = sg;
  ctx.fill();
  // herbe au centre
  blob(R * 0.7, ry * 0.62, 0.18, 14);
  ctx.save();
  ctx.translate(0, -ry * 0.1);
  const gg = ctx.createRadialGradient(cx, cy - ry * 0.3, 10, cx, cy, R * 0.7);
  gg.addColorStop(0, S.grass[0]);
  gg.addColorStop(1, S.grass[1]);
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.restore();
  // le décor, de l'arrière vers l'avant
  const props = [...S.props].sort((a, b2) => b2[2] - a[2]);
  for (const [name, ox, size] of props) {
    const img = await isleImg(name);
    if (!img) continue;
    const s = R * size * 0.62, px = cx + ox * R * 0.92, py = cy - ry * 0.15 + (size < 0.4 ? ry * 0.35 : 0);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(px, py, s * 0.32, s * 0.08, 0, 0, TAU);
    ctx.fill();
    ctx.drawImage(img, px - s / 2, py - s * 0.94, s, s);
  }
  // particules
  const Rp = seeded(hashOf(skinId) + 7);
  if (S.fx === "embers") for (let k = 0; k < 70; k++) disc(ctx, Rp() * W, Rp() * H * 0.9, Rp() * 2.2 + 0.6, `rgba(253,186,116,${0.4 + Rp() * 0.6})`);
  if (S.fx === "snow") for (let k = 0; k < 140; k++) disc(ctx, Rp() * W, Rp() * H, Rp() * 2.2 + 0.6, `rgba(255,255,255,${0.5 + Rp() * 0.5})`);
  if (S.fx === "fireflies") for (let k = 0; k < 40; k++) {
    const x = cx + (Rp() - 0.5) * R * 2.4, y = cy - Rp() * R * 0.9;
    glow(ctx, x, y, 10, "#fde68a", 0.8);
    disc(ctx, x, y, 1.6, "#ffffff");
  }
  if (S.fx === "petals")
    for (let k = 0; k < 70; k++) {
      ctx.save();
      ctx.translate(Rp() * W, Rp() * H);
      ctx.rotate(Rp() * TAU);
      ctx.fillStyle = `rgba(251,207,232,${0.6 + Rp() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 4 + Rp() * 3, 2.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  if (S.fx === "sparkles") for (let k = 0; k < 50; k++) sparkle(ctx, Rp() * W, Rp() * H * 0.9, 1.5 + Rp() * 3, `rgba(255,247,214,${0.5 + Rp() * 0.5})`);
  if (S.fx === "birds") {
    ctx.strokeStyle = "rgba(15,23,42,0.6)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      const x = W * (0.3 + Rp() * 0.5), y = hz * (0.25 + Rp() * 0.4), s = 6 + Rp() * 6;
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y);
      ctx.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y);
      ctx.stroke();
    }
  }
  if (S.fx === "fog")
    for (let k = 0; k < 16; k++) {
      const x = Rp() * W, y = hz + Rp() * (H - hz), r = 120 + Rp() * 160;
      glow(ctx, x, y, r, "#c4b5fd", 0.12);
    }
  isleSceneCache.set(key, c);
  if (isleSceneCache.size > 12) isleSceneCache.delete(isleSceneCache.keys().next().value);
  return c;
}

// --- Le tableau de l'île ---
async function drawArchipelagoHD() {
  const W = 1400, H = 820, id = Object.keys(ISLANDS)[0], def = ISLANDS[id], isl = islandsState()[id];
  const skinId = isleSkinOf(isl), S = ISLE_SKINS[skinId], acc = S.accent, fight = islandFights.has(id);
  const shield = isl.holder && (isl.protectUntil ?? 0) > Date.now();
  const cx = 500, cy = 590, R = 330;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(await drawIslandScene(skinId, W, H, cx, cy, R), 0, 0);
  // bandeau du titre
  const tg = ctx.createLinearGradient(0, 0, 0, 170);
  tg.addColorStop(0, "rgba(2,6,23,0.75)");
  tg.addColorStop(1, "rgba(2,6,23,0)");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, 170);
  ctx.textAlign = "left";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spacedLeft(ctx, "L'ÎLE DE LA MAISON", 48, 50, 5);
  ctx.font = "62px CardTitle";
  ctx.lineWidth = 8;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText(def.name, 46, 116);
  const ng = ctx.createLinearGradient(0, 64, 0, 120);
  ng.addColorStop(0, "#ffffff");
  ng.addColorStop(1, acc);
  ctx.fillStyle = ng;
  ctx.fillText(def.name, 46, 116);
  ctx.font = "17px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${ISLAND_DUST} poussières d'étoile par heure pour qui la garde… tant que personne ne la prend.`, 48, 148);
  // bouclier : un dôme au-dessus de l'île
  if (shield) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R * 1.05, R * 0.95, 0, Math.PI, TAU);
    const dg = ctx.createLinearGradient(0, cy - R, 0, cy);
    dg.addColorStop(0, "rgba(125,211,252,0.28)");
    dg.addColorStop(1, "rgba(125,211,252,0.06)");
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.strokeStyle = "rgba(186,230,253,0.85)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  // les cartes de la défense, plantées sur la plage
  const slots = [-0.5, 0, 0.5].map((k, i) => ({ x: cx + k * R * 0.95, y: cy + 20 - (i === 1 ? 26 : 0) }));
  const cw = 128, ch = 179;
  if (!isl.holder) {
    for (const s of slots) {
      roundRect(ctx, s.x - cw / 2, s.y - ch, cw, ch, 14);
      ctx.fillStyle = "rgba(2,6,23,0.35)";
      ctx.fill();
      ctx.setLineDash([9, 7]);
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.font = "54px CardBold";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("+", s.x, s.y - ch / 2 + 18);
    }
    ctx.textAlign = "center";
    ctx.font = "64px CardTitle";
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(0,0,0,0.65)";
    ctx.strokeText("ÎLE LIBRE", cx, cy - 250);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ÎLE LIBRE", cx, cy - 250);
    ctx.font = "20px CardBold";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("Placez 3 cartes pour la prendre !", cx, cy - 214);
  } else {
    const defs = islandDefenders(id);
    for (const [k, f] of defs.entries()) {
      const s = slots[k];
      glow(ctx, s.x, s.y - ch / 2, 120, f.hp > 0 ? acc : "#000000", 0.35);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      if (f.hp <= 0) ctx.filter = "grayscale(1) brightness(0.55)";
      ctx.drawImage(await cardThumb(f.card, isHoloKey(f.key), cw * 2, ch * 2), s.x - cw / 2, s.y - ch, cw, ch);
      ctx.restore();
      if (f.series === def.series) tdPill(ctx, s.x + cw / 2 - 8, s.y - ch + 6, "+10 %", rgba(acc, 0.95), "#020617", 10);
      hpBar(ctx, s.x - cw / 2 - 6, s.y + 10, cw + 12, 16, f.hp, f.maxHp, false);
      ctx.textAlign = "center";
      ctx.font = "14px CardBold";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      const t = f.hp > 0 ? `${f.hp} / ${f.maxHp} PV` : "K.O.";
      ctx.strokeText(t, s.x, s.y + 46);
      ctx.fillStyle = f.hp > 0 ? "#ffffff" : "#fca5a5";
      ctx.fillText(t, s.x, s.y + 46);
    }
  }
  // le panneau du gardien
  const px = 960, py = 180, pw = 400, ph = 590;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 30;
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.fillStyle = "rgba(2,6,23,0.72)";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, px, py, pw, ph, 28);
  ctx.strokeStyle = rgba(acc, 0.7);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "14px CardEngrave";
  ctx.fillStyle = acc;
  spaced(ctx, isl.holder ? "GARDIEN DE L'ÎLE" : "AUCUN GARDIEN", px + pw / 2, py + 44, 4);
  if (isl.holder) {
    const team = teamOf(isl.holder), duo = team?.members.length === 2, ay = py + 120;
    if (duo) ctx.drawImage(await drawTeamCrest(team.emblem), px + pw / 2 - 54, ay - 54, 108, 108);
    else {
      const av = isl.avatar ? await fetchImage(`avatar:${isl.avatar}`, isl.avatar) : null;
      tdAvatarDisc(ctx, av, px + pw / 2, ay, 50, acc, isl.holder);
    }
    const owner = duo ? team.name : isl.holderName ?? "?";
    ctx.font = `${fitText(ctx, owner, pw - 50, 34, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(owner, px + pw / 2, py + 214);
    if (duo) {
      ctx.font = "16px CardText";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(team.members.map((m) => pseudo(m)).join(" & "), px + pw / 2, py + 240);
    }
    const rows = [
      ["Gardée depuis", fmtHeld(Date.now() - isl.since)],
      ["Poussière gagnée", `${isl.earned}`],
      ["Attaques repoussées", `${isl.defenses}`],
      ["Rapporte", `${ISLAND_DUST} par heure`],
    ];
    rows.forEach(([label, value], k) => {
      const y = py + 282 + k * 48;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      roundRect(ctx, px + 24, y - 30, pw - 48, 42, 12);
      ctx.fill();
      ctx.textAlign = "left";
      ctx.font = "15px CardText";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(label, px + 42, y - 3);
      ctx.textAlign = "right";
      ctx.font = "18px CardBold";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(value, px + pw - 42, y - 2);
    });
  } else {
    ctx.font = "30px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("À prendre !", px + pw / 2, py + 120);
    ctx.font = "16px CardText";
    ctx.fillStyle = "#cbd5e1";
    ctx.textAlign = "left";
    wrapText(ctx, `Personne ne garde l'île. Placez jusqu'à 3 cartes : elle vous rapporte ${ISLAND_DUST} poussières d'étoile par heure, et ${ISLAND_CAPTURE_DUST} de prime de conquête. Ensuite, défendez-la !`, px + 40, py + 170, pw - 80, 24, 6);
  }
  // pastilles d'état
  const pills = [];
  if (fight) pills.push(["ATTAQUE EN COURS", "#dc2626", "#ffffff"]);
  if (shield) pills.push([`BOUCLIER · ${Math.ceil(((isl.protectUntil ?? 0) - Date.now()) / MINUTE)} MIN`, "#0284c7", "#ffffff"]);
  const wear = isl.holder ? islandWear(isl) : 0;
  if (wear > 0) pills.push([`USURE −${Math.round(wear * 100)} %`, "#b45309", "#ffffff"]);
  pills.push([`BONUS ${SERIES_LABELS[def.series].replace(/^\S+ /, "").toUpperCase().replace(/^(LE|LA|LES) /, "")} +10 %`, rgba(acc, 0.9), "#020617"]);
  pills.forEach(([text, bg, fg], k) => tdPill(ctx, px + pw / 2, py + 476 + k * 28, text, bg, fg, 12));
  ctx.textAlign = "center";
  ctx.font = "12px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`Skin de l'île : ${S.name}`, px + pw / 2, py + ph - 12);
  if (fight) {
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
    v.addColorStop(0, "rgba(220,38,38,0)");
    v.addColorStop(1, "rgba(220,38,38,0.35)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }
  // pied
  ctx.textAlign = "center";
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  spaced(ctx, "LES CARTES QUI DÉFENDENT L'ÎLE NE PEUVENT ÊTRE NI VENDUES NI ÉCHANGÉES", W / 2, H - 18, 2);
  ctx.textAlign = "left";
  return c;
}

// --- Branchements : le tableau, et la boutique (catégorie « Îles ») ---
{
  drawArchipelago = drawArchipelagoHD;
  SHOP_KINDS.ile = ["🏝️", "Îles"];
  for (const [id, s] of Object.entries(ISLE_SKINS)) SHOP_ITEMS.push({ id, kind: "ile", name: s.name, price: s.price ?? 0, cur: s.cur ?? "dust", ...(s.free ? { free: true } : {}), ...(s.month ? { month: s.month } : {}) });
  const preview = drawItemPreview, shop = handleShopInteraction;
  drawItemPreview = async (it, W = 520, H = 640) => {
    if (it.kind !== "ile") return preview(it, W, H);
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.save();
    ctx.clip();
    ctx.drawImage(await drawIslandScene(it.id, W, H, W / 2, H * 0.7, W * 0.34), 0, 0);
    ctx.restore();
    return c;
  };
  // un skin d'île acheté ou équipé : le tableau de l'île se redessine
  handleShopInteraction = async (interaction) => {
    const done = await shop(interaction);
    if (done && /ile/.test(String(interaction.customId ?? ""))) islandsDirty = true;
    return done;
  };
}
