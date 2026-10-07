
// --- Boutique de styles : dos de cartes, effets d'ouverture de booster, décors d'Arène ---
// Des cosmétiques seulement (aucun effet sur la force des cartes). Payés en poussière d'étoile ou en euros ;
// quelques-uns sont limités (Halloween) ou exclusifs (champion du tournoi). Une vitrine change chaque semaine.
const SHOP_ITEMS = [
  // dos de cartes (inspirés des protège-cartes : fond, motif, grande créature)
  { id: "back_maison", kind: "back", name: "Maison classique", price: 0, cur: "dust", free: true },
  { id: "back_eclair", kind: "back", name: "Éclair noir", price: 1500, cur: "dust", bg: ["#18181b", "#09090b"], ink: "#facc15", pattern: "zigzag", emoji: "⚡", art: "line" },
  { id: "back_braise", kind: "back", name: "Dragon de braise", price: 2500, cur: "dust", bg: ["#1c0a03", "#0a0402"], ink: "#f97316", pattern: "scales", emoji: "🐉", art: "line" },
  { id: "back_azur", kind: "back", name: "Vague azur", price: 2000, cur: "dust", bg: ["#38bdf8", "#0369a1"], ink: "#e0f2fe", pattern: "waves", emoji: "🐳", art: "color" },
  { id: "back_lune", kind: "back", name: "Nuit lunaire", price: 1800, cur: "dust", bg: ["#3730a3", "#1e1b4b"], ink: "#c7d2fe", pattern: "stars", emoji: "🦇", art: "line" },
  { id: "back_sakura", kind: "back", name: "Sakura", price: 2200, cur: "dust", bg: ["#fbcfe8", "#ec4899"], ink: "#ffffff", pattern: "petals", emoji: "🌸", art: "color" },
  { id: "back_tempete", kind: "back", name: "Tempête", price: 2400, cur: "dust", bg: ["#1e40af", "#0f172a"], ink: "#93c5fd", pattern: "shards", emoji: "🦅", art: "line" },
  { id: "back_foret", kind: "back", name: "Forêt ancienne", price: 2000, cur: "dust", bg: ["#22c55e", "#14532d"], ink: "#dcfce7", pattern: "hex", emoji: "🦎", art: "color" },
  { id: "back_phenix", kind: "back", name: "Phénix", price: 3000, cur: "dust", bg: ["#dc2626", "#450a0a"], ink: "#fecaca", pattern: "rays", emoji: "🔥", art: "color" },
  { id: "back_royal", kind: "back", name: "Or royal", price: 6000, cur: "euro", bg: ["#fffbeb", "#e7e5e4"], ink: "#b45309", pattern: "rays", emoji: "👑", art: "line" },
  { id: "back_cristal", kind: "back", name: "Cristal", price: 8000, cur: "euro", bg: ["#14b8a6", "#134e4a"], ink: "#ccfbf1", pattern: "diamonds", emoji: "💎", art: "line" },
  { id: "back_spectre", kind: "back", name: "Spectre", price: 1666, cur: "dust", bg: ["#4c1d95", "#120321"], ink: "#e9d5ff", pattern: "stars", emoji: "👻", art: "line", month: 10 },
  { id: "back_champion", kind: "back", name: "Couronne du champion", price: 0, cur: "dust", bg: ["#fef3c7", "#d97706"], ink: "#78350f", pattern: "rays", emoji: "🏆", art: "line", exclusive: "Réservé au champion du tournoi du week-end" },
  // effets d'ouverture de booster
  { id: "fx_confettis", kind: "fx", name: "Confettis", price: 800, cur: "dust" },
  { id: "fx_etoiles", kind: "fx", name: "Pluie d'étoiles", price: 1200, cur: "dust" },
  { id: "fx_flammes", kind: "fx", name: "Flammes", price: 1500, cur: "dust" },
  { id: "fx_sakura", kind: "fx", name: "Pétales de sakura", price: 1500, cur: "dust" },
  { id: "fx_eclairs", kind: "fx", name: "Éclairs", price: 1800, cur: "dust" },
  { id: "fx_or", kind: "fx", name: "Pluie d'or", price: 4000, cur: "euro" },
  { id: "fx_spectre", kind: "fx", name: "Feux follets", price: 1666, cur: "dust", month: 10 },
  // décors d'Arène
  { id: "decor_colisee", kind: "decor", name: "Colisée", price: 2000, cur: "dust" },
  { id: "decor_paris", kind: "decor", name: "Toits de Paris", price: 2500, cur: "dust" },
  { id: "decor_temple", kind: "decor", name: "Temple du soleil levant", price: 2500, cur: "dust" },
  { id: "decor_abysses", kind: "decor", name: "Abysses", price: 3000, cur: "dust" },
  { id: "decor_galaxie", kind: "decor", name: "Galaxie", price: 10000, cur: "euro" },
  { id: "decor_manoir", kind: "decor", name: "Manoir hanté", price: 1666, cur: "dust", month: 10 },
];
const SHOP_KINDS = { back: ["🃏", "Dos de cartes"], fx: ["🎆", "Effets d'ouverture"], decor: ["🏟️", "Décors d'Arène"] };
Object.assign(FLUENT, { "⚡": "High voltage", "🐳": "Spouting whale", "🦇": "Bat", "🌸": "Cherry blossom", "🦅": "Eagle", "🦎": "Lizard", "💎": "Gem stone", "🔥": "Fire", "🏆": "Trophy" });
const shopItem = (id) => SHOP_ITEMS.find((x) => x.id === id) ?? null;
const shopMonth = () => Number(new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", month: "2-digit" }).format(new Date()));
const shopForSale = (it) => !it.free && !it.exclusive && (!it.month || it.month === shopMonth());
function styleOf(userId) {
  const st = load();
  st.cosmetics ??= {};
  return (st.cosmetics[userId] ??= { owned: [], back: null, fx: null, decor: null });
}
const ownsStyle = (userId, id) => shopItem(id)?.free || styleOf(userId).owned.includes(id);
const equipped = (userId, kind) => {
  const s = styleOf(userId), id = s[kind];
  return id && ownsStyle(userId, id) ? id : null;
};
// vitrine de la semaine : 3 objets à -25 %
function shopFeatured() {
  const pool = SHOP_ITEMS.filter(shopForSale), R = seeded(hashOf(`vitrine-${mondayKey()}`)), out = [];
  const limited = pool.filter((x) => x.month);
  if (limited.length) out.push(limited[0]);
  while (out.length < 3 && out.length < pool.length) {
    const it = pool[Math.floor(R() * pool.length)];
    if (!out.includes(it)) out.push(it);
  }
  return out;
}
const SHOP_PROMO = 0.25;
const shopPrice = (it) => (shopFeatured().includes(it) ? Math.round(it.price * (1 - SHOP_PROMO)) : it.price);
const priceText = (it, p = shopPrice(it)) => (it.cur === "euro" ? formatEuro(p) : `${p.toLocaleString("fr-FR")} ✨`);
const priceCanvas = (it, p = shopPrice(it)) => (it.cur === "euro" ? `${p.toLocaleString("fr-FR")} €` : `${p.toLocaleString("fr-FR")} poussières`);

// --- Dos de cartes ---
const backCache2 = new Map();
async function emblemArt(emoji, size) {
  const img = FLUENT[emoji] ? await fetchImage(`fluent:${emoji}`, fluentUrl(FLUENT[emoji])).catch(() => null) : null;
  return img ? { img, size } : null;
}
// la créature en « trait » : silhouette pâle et contour lumineux (comme sur les protège-cartes)
function lineArt(img, size, ink) {
  const pad = 24, S = size + pad * 2;
  const tint = (col) => {
    const c = createCanvas(S, S), x = c.getContext("2d");
    x.drawImage(img, pad, pad, size, size);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = col;
    x.fillRect(0, 0, S, S);
    return c;
  };
  const out = createCanvas(S, S), o = out.getContext("2d"), solid = tint(ink);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    o.drawImage(solid, Math.cos(a) * 5, Math.sin(a) * 5);
  }
  o.globalCompositeOperation = "destination-out";
  o.drawImage(tint("#000000"), 0, 0);
  o.globalCompositeOperation = "source-over";
  o.globalAlpha = 0.18;
  o.drawImage(solid, 0, 0);
  // traits intérieurs : contraste de l'image d'origine
  o.globalAlpha = 0.35;
  o.globalCompositeOperation = "source-atop";
  o.filter = "grayscale(1) contrast(2.2)";
  o.drawImage(img, pad, pad, size, size);
  o.filter = "none";
  o.globalCompositeOperation = "source-over";
  o.globalAlpha = 1;
  return out;
}
function backPattern(ctx, it, W, H) {
  const R = seeded(hashOf(it.id));
  ctx.save();
  ctx.strokeStyle = rgba(it.ink, 0.28);
  ctx.fillStyle = rgba(it.ink, 0.18);
  ctx.lineWidth = 3;
  ctx.lineJoin = "miter";
  if (it.pattern === "zigzag") {
    for (let k = -2; k < 9; k++) {
      ctx.beginPath();
      const x0 = k * 90;
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + 60, 140);
      ctx.lineTo(x0 + 20, 140);
      ctx.lineTo(x0 + 90, 300);
      ctx.stroke();
    }
  } else if (it.pattern === "scales") {
    for (let y = 0, row = 0; y < H + 40; y += 34, row++)
      for (let x = row % 2 ? 30 : 0; x < W + 40; x += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI);
        ctx.stroke();
      }
  } else if (it.pattern === "waves") {
    for (let y = 30; y < H; y += 46) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 10) ctx.lineTo(x, y + Math.sin(x / 40 + y) * 10);
      ctx.stroke();
    }
  } else if (it.pattern === "stars") {
    for (let k = 0; k < 70; k++) sparkle(ctx, R() * W, R() * H, 2 + R() * 6, rgba(it.ink, 0.25 + R() * 0.4));
  } else if (it.pattern === "petals") {
    for (let k = 0; k < 40; k++) {
      ctx.save();
      ctx.translate(R() * W, R() * H);
      ctx.rotate(R() * TAU);
      ctx.fillStyle = rgba(it.ink, 0.35 + R() * 0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 9, 5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  } else if (it.pattern === "shards") {
    for (let k = 0; k < 26; k++) {
      const x = R() * W, y = R() * H, s = 30 + R() * 60, a = R() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      ctx.lineTo(x + Math.cos(a + 0.4) * s * 0.6, y + Math.sin(a + 0.4) * s * 0.6);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (it.pattern === "hex") {
    for (let y = 0, row = 0; y < H + 40; y += 40, row++)
      for (let x = row % 2 ? 35 : 0; x < W + 40; x += 70) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.lineTo(x + Math.cos((k / 6) * TAU) * 22, y + Math.sin((k / 6) * TAU) * 22);
        ctx.closePath();
        ctx.stroke();
      }
  } else if (it.pattern === "diamonds") {
    for (let k = -H; k < W + H; k += 50) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + H * 0.6, H);
      ctx.moveTo(k, 0);
      ctx.lineTo(k - H * 0.6, H);
      ctx.stroke();
    }
  } else {
    ctx.translate(W * 0.62, H * 0.62);
    for (let i = 0; i < 28; i++) {
      ctx.rotate(TAU / 28);
      ctx.fillStyle = rgba(it.ink, i % 2 ? 0.05 : 0.14);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-40, -1100);
      ctx.lineTo(40, -1100);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}
async function drawCardBack(id) {
  const it = shopItem(id);
  if (!it || it.free || it.kind !== "back") return drawBack("legendaire");
  if (backCache2.has(id)) return backCache2.get(id);
  const W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // bordure fine et brillante
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = metalGradient(ctx, W, H, it.cur === "euro" || it.exclusive ? METAL.legendaire : ["#f8fafc", "#94a3b8", "#e2e8f0", "#475569", "#cbd5e1"]);
  ctx.fill();
  ctx.save();
  roundRect(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, it.bg[0]);
  bg.addColorStop(1, it.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  backPattern(ctx, it, W, H);
  // la grande créature, en bas à droite, qui déborde du cadre
  const art = await emblemArt(it.emoji, 560);
  if (art) {
    glow(ctx, W * 0.62, H * 0.62, 340, it.ink, 0.25);
    if (it.art === "line") ctx.drawImage(lineArt(art.img, 560, it.ink), W - 520, H - 560);
    else {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 30;
      ctx.drawImage(lineArt(art.img, 560, shade(it.bg[1], 0.5)), W - 520, H - 560);
      ctx.drawImage(art.img, W - 500 + 4, H - 540 + 4, 560, 560);
      ctx.restore();
    }
  }
  // reflet et vignettage
  const sh = ctx.createLinearGradient(0, 0, W, H);
  sh.addColorStop(0.2, "rgba(255,255,255,0)");
  sh.addColorStop(0.45, "rgba(255,255,255,0.14)");
  sh.addColorStop(0.55, "rgba(255,255,255,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // plaque du haut
  roundRect(ctx, W / 2 - 170, 40, 340, 56, 16);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fill();
  ctx.strokeStyle = rgba(it.ink, 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "28px CardTitle";
  ctx.fillStyle = it.ink;
  ctx.fillText("La Maison", W / 2, 76);
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = rgba(it.ink, 0.85);
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 116, 2);
  backCache2.set(id, c);
  return c;
}

// --- Effets d'ouverture (dessinés par-dessus l'animation de révélation) ---
function openingFx(ctx, id, f, fr0, W, H, cx, cy) {
  if (f < fr0) return;
  const since = f - fr0, R = seeded(hashOf(id) + 3);
  ctx.save();
  if (id === "fx_confettis" || id === "fx_or") {
    const cols = id === "fx_or" ? ["#fde68a", "#fbbf24", "#f59e0b", "#ffffff"] : ["#f43f5e", "#22c55e", "#3b82f6", "#facc15", "#a855f7"];
    for (let k = 0; k < 70; k++) {
      const x = R() * W, v = 6 + R() * 10, y = -40 + since * v - R() * 200;
      if (y < -20 || y > H + 20) continue;
      ctx.save();
      ctx.translate(x + Math.sin(since * 0.3 + k) * 14, y);
      ctx.rotate(since * 0.25 + k);
      ctx.fillStyle = cols[k % cols.length];
      if (id === "fx_or") {
        ctx.beginPath();
        ctx.ellipse(0, 0, 7, 7 * Math.abs(Math.cos(since * 0.3 + k)), 0, 0, TAU);
        ctx.fill();
      } else ctx.fillRect(-5, -3, 10, 6);
      ctx.restore();
    }
  } else if (id === "fx_etoiles") {
    for (let k = 0; k < 40; k++) {
      const x = R() * W, y = (R() * H + since * (8 + R() * 8)) % H, tw = Math.max(0, Math.sin(since * 0.4 + k));
      sparkle(ctx, x, y, 2 + tw * 6, `rgba(255,255,255,${0.4 + tw * 0.6})`);
    }
  } else if (id === "fx_flammes") {
    for (let k = 0; k < 14; k++) {
      const x = (k + 0.5) * (W / 14), h = 90 + R() * 120 + Math.sin(since * 0.5 + k) * 30;
      const g = ctx.createLinearGradient(0, H, 0, H - h);
      g.addColorStop(0, "rgba(249,115,22,0.9)");
      g.addColorStop(0.6, "rgba(253,186,116,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 30, H);
      ctx.quadraticCurveTo(x - 34 + Math.sin(since * 0.6 + k) * 10, H - h * 0.5, x + Math.sin(since * 0.5 + k) * 12, H - h);
      ctx.quadraticCurveTo(x + 34, H - h * 0.5, x + 30, H);
      ctx.fill();
    }
    for (let k = 0; k < 30; k++) disc(ctx, R() * W, H - ((since * (6 + R() * 6) + R() * H) % H), 1.5 + R() * 2, `rgba(253,186,116,${0.4 + R() * 0.5})`);
  } else if (id === "fx_sakura" || id === "fx_spectre") {
    for (let k = 0; k < 36; k++) {
      const x = (R() * W + since * (2 + R() * 3)) % W, y = (R() * H + since * (4 + R() * 4)) % H;
      if (id === "fx_spectre") {
        glow(ctx, x, y, 22, "#a78bfa", 0.5);
        disc(ctx, x, y, 4, "#ede9fe");
      } else {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(since * 0.1 + k);
        ctx.fillStyle = `rgba(251,207,232,${0.6 + R() * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  } else if (id === "fx_eclairs") {
    if (since % 4 < 2) {
      const B = seeded(Math.floor(since / 4) + 11);
      ctx.strokeStyle = "rgba(254,249,195,0.95)";
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 16;
      ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) {
        let x = B() * W, y = 0;
        ctx.beginPath();
        ctx.moveTo(x, y);
        while (y < H) ctx.lineTo((x += (B() - 0.5) * 60), (y += 40 + B() * 50));
        ctx.stroke();
      }
    }
  }
  void cx;
  void cy;
  ctx.restore();
}

// --- Décors d'Arène ---
const arenaDecorCache = new Map();
function decorBackground(id, W, H) {
  const key = `${id}:${W}`;
  if (arenaDecorCache.has(key)) return arenaDecorCache.get(key);
  const c = createCanvas(W, H), ctx = c.getContext("2d"), R = seeded(hashOf(id));
  const sky = (stops) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  let ring = "#fbbf24";
  if (id === "decor_colisee") {
    sky([[0, "#7c2d12"], [0.5, "#c2410c"], [1, "#1c0a03"]]);
    glow(ctx, W / 2, H * 0.32, W * 0.5, "#fdba74", 0.4);
    // gradins et arches
    for (let row = 0; row < 3; row++) {
      const y = H * (0.18 + row * 0.12), aw = W / (12 + row * 2);
      ctx.fillStyle = shade("#78350f", 0.7 - row * 0.12);
      ctx.fillRect(0, y, W, H * 0.12);
      for (let x = 0; x < W; x += aw) {
        ctx.fillStyle = "rgba(10,4,2,0.75)";
        ctx.beginPath();
        ctx.moveTo(x + aw * 0.2, y + H * 0.11);
        ctx.lineTo(x + aw * 0.2, y + H * 0.05);
        ctx.arc(x + aw / 2, y + H * 0.05, aw * 0.3, Math.PI, 0);
        ctx.lineTo(x + aw * 0.8, y + H * 0.11);
        ctx.fill();
      }
    }
    ring = "#fdba74";
  } else if (id === "decor_paris") {
    sky([[0, "#0b1026"], [0.6, "#1e1b4b"], [1, "#312e81"]]);
    for (let k = 0; k < 90; k++) disc(ctx, R() * W, R() * H * 0.5, R() * 1.4 + 0.3, `rgba(255,255,255,${0.2 + R() * 0.6})`);
    disc(ctx, W * 0.82, H * 0.16, 30, "#fef9c3");
    glow(ctx, W * 0.82, H * 0.16, 120, "#fef08a", 0.3);
    // toits et tour Eiffel
    ctx.fillStyle = "#0a0a1a";
    const base = H * 0.55;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, base - (R() * 40 + 20) - (x % 120 === 0 ? 30 : 0));
    ctx.lineTo(W, H);
    ctx.fill();
    const ex = W * 0.25, ey = base - 30;
    ctx.beginPath();
    ctx.moveTo(ex - 60, ey + 30);
    ctx.quadraticCurveTo(ex - 10, ey - 60, ex - 4, ey - 260);
    ctx.lineTo(ex + 4, ey - 260);
    ctx.quadraticCurveTo(ex + 10, ey - 60, ex + 60, ey + 30);
    ctx.fill();
    for (let k = 0; k < 40; k++) disc(ctx, R() * W, base + R() * 40, 1.6, `rgba(253,224,71,${0.4 + R() * 0.5})`);
    ring = "#a5b4fc";
  } else if (id === "decor_temple") {
    sky([[0, "#fde68a"], [0.5, "#fb923c"], [1, "#7c2d12"]]);
    disc(ctx, W / 2, H * 0.3, H * 0.2, "#dc2626");
    ctx.fillStyle = "#450a0a";
    // torii
    const tx = W / 2, ty = H * 0.56;
    ctx.fillRect(tx - 190, ty - 230, 380, 22);
    ctx.fillRect(tx - 170, ty - 190, 340, 16);
    ctx.fillRect(tx - 150, ty - 230, 22, 240);
    ctx.fillRect(tx + 128, ty - 230, 22, 240);
    for (let k = 0; k < 40; k++) {
      ctx.save();
      ctx.translate(R() * W, R() * H);
      ctx.rotate(R() * TAU);
      ctx.fillStyle = `rgba(251,207,232,${0.5 + R() * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 4, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ring = "#fecaca";
  } else if (id === "decor_abysses") {
    sky([[0, "#0e7490"], [0.6, "#083344"], [1, "#020617"]]);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let k = 0; k < 8; k++) {
      const x = R() * W;
      const g = ctx.createLinearGradient(x, 0, x + 80, H);
      g.addColorStop(0, "rgba(165,243,252,0.18)");
      g.addColorStop(1, "rgba(165,243,252,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 20, 0);
      ctx.lineTo(x + 30, 0);
      ctx.lineTo(x + 140, H);
      ctx.lineTo(x + 40, H);
      ctx.fill();
    }
    ctx.restore();
    for (let k = 0; k < 50; k++) {
      ctx.strokeStyle = `rgba(207,250,254,${0.2 + R() * 0.4})`;
      ctx.beginPath();
      ctx.arc(R() * W, R() * H, 2 + R() * 7, 0, TAU);
      ctx.stroke();
    }
    ring = "#67e8f9";
  } else if (id === "decor_galaxie") {
    sky([[0, "#020617"], [1, "#1e1b4b"]]);
    for (const [x, y, r, col] of [[0.25, 0.3, 0.4, "#7c3aed"], [0.75, 0.25, 0.35, "#db2777"], [0.5, 0.6, 0.45, "#2563eb"]]) glow(ctx, W * x, H * y, W * r, col, 0.35);
    for (let k = 0; k < 220; k++) disc(ctx, R() * W, R() * H, R() * 1.6 + 0.2, `rgba(255,255,255,${0.2 + R() * 0.8})`);
    for (let k = 0; k < 12; k++) sparkle(ctx, R() * W, R() * H, 3 + R() * 5, "#ffffff");
    ring = "#c4b5fd";
  } else {
    // manoir hanté
    sky([[0, "#040108"], [0.6, "#1a050e"], [1, "#2a0808"]]);
    glow(ctx, W * 0.8, H * 0.18, 200, "#dc2626", 0.45);
    disc(ctx, W * 0.8, H * 0.18, 50, "#ef4444");
    effroiManor(ctx, W * 0.5, H * 0.66, W / 1400, R);
    for (let k = 0; k < 6; k++) effroiBat(ctx, R() * W, R() * H * 0.4, 0.8 + R(), R() - 0.3);
    ring = "#fca5a5";
  }
  // assombrir légèrement pour la lisibilité, puis le sol de l'arène
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fillRect(0, 0, W, H);
  const fy = H * 0.66;
  const floor = ctx.createRadialGradient(W / 2, fy, 20, W / 2, fy, W * 0.5);
  floor.addColorStop(0, rgba(ring, 0.18));
  floor.addColorStop(1, rgba(ring, 0));
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(W / 2, fy, W * 0.46, H * 0.12, 0, 0, TAU);
  ctx.fill();
  for (const [rx, a] of [[0.46, 0.55], [0.4, 0.28], [0.3, 0.16]]) {
    ctx.strokeStyle = rgba(ring, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, fy, W * rx, H * 0.12 * (rx / 0.46), 0, 0, TAU);
    ctx.stroke();
  }
  arenaDecorCache.set(key, c);
  return c;
}
// le décor d'un combat : celui du joueur qui l'a lancé
function decorOverride(W, H, b) {
  if (!b) return null;
  b.decorKey ??= b.players.map((p) => (p.isAI ? null : equipped(p.id, "decor"))).find(Boolean) ?? false;
  return b.decorKey ? decorBackground(b.decorKey, W, H) : null;
}
{
  const draw = drawArena;
  drawArena = async (b, opts = {}) => {
    if (!b.bg) {
      const d = decorOverride(1200, 700, b);
      if (d) b.bg = d;
    }
    return draw(b, opts);
  };
}

// --- Aperçus ---
async function drawItemPreview(it, W = 520, H = 640) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  if (it.kind === "back") {
    // une pile de protège-cartes en éventail
    const back = await drawCardBack(it.id), cw = W * 0.6, ch = cw * 1.4;
    for (let k = 4; k >= 0; k--) {
      ctx.save();
      ctx.translate(W / 2 - 30 + k * 16, H / 2 + 10 - k * 6);
      ctx.rotate(-0.12 + k * 0.05);
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 18;
      ctx.globalAlpha = k ? 0.9 : 1;
      ctx.drawImage(back, -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }
  } else if (it.kind === "decor") {
    // le décor en plein cadre, avec deux petites cartes posées sur le sol de l'arène
    const d = decorBackground(it.id, 1200, 700), k = Math.max((W - 20) / 1200, (H - 20) / 700);
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.save();
    ctx.clip();
    ctx.drawImage(d, W / 2 - 600 * k, H / 2 - 350 * k, 1200 * k, 700 * k);
    const back = drawBack("legendaire"), cw = W * 0.17, ch = cw * 1.4, fy = H / 2 - 350 * k + 700 * k * 0.66;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 12;
    ctx.drawImage(back, W * 0.3 - cw / 2, fy - ch, cw, ch);
    ctx.drawImage(back, W * 0.7 - cw / 2, fy - ch, cw, ch);
    ctx.restore();
  } else {
    // une carte qui se révèle, avec l'effet
    const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#3b2a55");
    bg.addColorStop(1, "#0b0614");
    ctx.fillStyle = bg;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.fill();
    glow(ctx, W / 2, H / 2, 260, "#fbbf24", 0.35);
    const sample = allCards().find((x) => x.rarity === "legendaire" && !x.id.startsWith("ut_") && !x.id.startsWith("duo_") && !x.memberId);
    if (sample) ctx.drawImage(await cardThumb(sample, true, 240, 336), W / 2 - 120, H / 2 - 168, 240, 336);
    openingFx(ctx, it.id, 18, 0, W, H, W / 2, H / 2);
  }
  return c;
}
function shopTag(ctx, x, y, text, bg, fg = "#ffffff") {
  ctx.font = "13px CardBold";
  const w = ctx.measureText(text).width + 22;
  roundRect(ctx, x - w / 2, y - 13, w, 26, 13);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 5);
}
// la devanture du salon : la vitrine de la semaine
async function drawShopFront() {
  const W = 1500, H = 860, c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a1033");
  bg.addColorStop(0.6, "#2e1065");
  bg.addColorStop(1, "#0b0614");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.2, 0, 600, "#ec4899", 0.25);
  glow(ctx, W * 0.85, H, 600, "#38bdf8", 0.2);
  const R = seeded(hashOf(mondayKey()));
  for (let k = 0; k < 100; k++) disc(ctx, R() * W, R() * H, R() * 1.5 + 0.3, `rgba(255,255,255,${0.1 + R() * 0.4})`);
  // enseigne néon
  ctx.textAlign = "center";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#f5d0fe";
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 54, 6);
  ctx.save();
  ctx.font = "72px CardTitle";
  ctx.shadowColor = "#f472b6";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#fdf4ff";
  ctx.fillText("La Boutique", W / 2, 132);
  ctx.restore();
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#fbcfe8";
  ctx.fillText("Dos de cartes · effets d'ouverture · décors d'Arène · îles — votre style, rien que pour vous", W / 2, 172);
  // vitrine
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, `EN VITRINE CETTE SEMAINE · -${Math.round(SHOP_PROMO * 100)} %`, W / 2, 222, 4);
  const feat = shopFeatured();
  for (const [i, it] of feat.entries()) {
    const x = 60 + i * 470, y = 244, w = 440, h = 560;
    roundRect(ctx, x, y, w, h, 24);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(255,255,255,0.08)");
    g.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = it.month ? "rgba(248,113,113,0.8)" : "rgba(253,230,138,0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    const prev = await drawItemPreview(it, 420, 420);
    ctx.drawImage(prev, x + 10, y + 10, 420, 420);
    ctx.textAlign = "center";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#c4b5fd";
    spaced(ctx, SHOP_KINDS[it.kind][1].toUpperCase(), x + w / 2, y + 448, 3);
    ctx.font = `${fitText(ctx, it.name, w - 40, 30, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(it.name, x + w / 2, y + 486);
    // prix barré et prix promo
    // ancien prix barré, puis prix de la vitrine, côte à côte
    ctx.font = "16px CardBold";
    const old = priceCanvas(it, it.price), ow = ctx.measureText(old).width;
    ctx.font = "24px CardTitle";
    const now = priceCanvas(it), nw = ctx.measureText(now).width, x0 = x + w / 2 - (ow + 18 + nw) / 2;
    ctx.textAlign = "left";
    ctx.font = "16px CardBold";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(old, x0, y + 528);
    ctx.fillRect(x0, y + 522, ow, 2);
    ctx.font = "24px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(now, x0 + ow + 18, y + 530);
    ctx.textAlign = "center";
    if (it.month) shopTag(ctx, x + w - 70, y + 32, "ÉDITION LIMITÉE", "#dc2626");
    else shopTag(ctx, x + w - 50, y + 32, `-${Math.round(SHOP_PROMO * 100)} %`, "#db2777");
  }
  ctx.textAlign = "center";
  ctx.font = "15px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`${SHOP_ITEMS.filter(shopForSale).length} styles en vente · nouvelle vitrine chaque lundi · des styles exclusifs se gagnent au tournoi`, W / 2, H - 26);
  return c;
}
// le catalogue d'une catégorie
async function drawShopCatalog(kind, userId) {
  const items = SHOP_ITEMS.filter((it) => it.kind === kind && (shopForSale(it) || it.free || ownsStyle(userId, it.id) || it.exclusive));
  const cols = 4, cw = 300, chh = 380, W = cols * cw + 80, rows = Math.ceil(items.length / cols), H = 150 + rows * (chh + 20) + 30;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a1033");
  bg.addColorStop(1, "#0b0614");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "48px CardTitle";
  ctx.fillStyle = "#fdf4ff";
  ctx.fillText(SHOP_KINDS[kind][1], W / 2, 80);
  ctx.font = "16px CardText";
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(`Vous avez ${(load().dust[userId] ?? 0).toLocaleString("fr-FR")} poussières d'étoile`, W / 2, 114);
  const feat = shopFeatured(), eq = equipped(userId, kind) ?? (kind === "back" ? "back_maison" : kind === "ile" ? "ile_tropique" : null);
  for (const [i, it] of items.entries()) {
    const x = 40 + (i % cols) * cw, y = 140 + Math.floor(i / cols) * (chh + 20);
    roundRect(ctx, x + 8, y, cw - 16, chh, 18);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.strokeStyle = eq === it.id ? "#4ade80" : "rgba(196,181,253,0.4)";
    ctx.lineWidth = eq === it.id ? 3 : 1.5;
    ctx.stroke();
    ctx.drawImage(await drawItemPreview(it, 260, 280), x + 20, y + 10, 260, 280);
    ctx.textAlign = "center";
    ctx.font = `${fitText(ctx, it.name, cw - 40, 20, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(it.name, x + cw / 2, y + 316);
    const owned = ownsStyle(userId, it.id);
    if (eq === it.id) shopTag(ctx, x + cw / 2, y + 350, "ÉQUIPÉ", "#16a34a");
    else if (owned) shopTag(ctx, x + cw / 2, y + 350, "POSSÉDÉ", "#475569");
    else if (it.exclusive) shopTag(ctx, x + cw / 2, y + 350, "EXCLUSIF", "#b45309");
    else shopTag(ctx, x + cw / 2, y + 350, priceCanvas(it), feat.includes(it) ? "#db2777" : it.cur === "euro" ? "#0f766e" : "#6d28d9");
  }
  return c;
}

// --- Messages ---
function shopNav() {
  return new ActionRowBuilder().addComponents(
    ...Object.entries(SHOP_KINDS).map(([k, [e, label]]) => new ButtonBuilder().setCustomId(`carte_shop_cat_${k}`).setLabel(label).setEmoji(e).setStyle(ButtonStyle.Primary)),
    new ButtonBuilder().setCustomId("carte_shop_me").setLabel("Mes styles").setEmoji("🎨").setStyle(ButtonStyle.Secondary)
  );
}
async function shopFrontPayload() {
  const feat = shopFeatured(), file = new AttachmentBuilder(await (await drawShopFront()).encode("jpeg", 88), { name: "boutique.jpg" });
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xdb2777)
        .setTitle("🛍️ La Boutique de la Maison")
        .setDescription(
          "Personnalisez votre jeu : **dos de cartes** (visibles à chaque ouverture de booster), **effets d'ouverture**, **décors d'Arène** (que vos adversaires voient aussi) et **skins d'île** (tout le serveur voit l'île telle que vous l'avez décorée tant que vous la gardez).\n" +
            `⭐ **En vitrine cette semaine (-${Math.round(SHOP_PROMO * 100)} %)** : ${feat.map((it) => `${it.name} (${priceText(it)})`).join(" · ")}\n` +
            "🏆 Des styles **exclusifs** se gagnent au tournoi du week-end."
        )
        .setImage("attachment://boutique.jpg"),
    ],
    files: [file],
    components: [shopNav()],
  };
}
async function shopCatalogPayload(kind, userId, note = "") {
  const items = SHOP_ITEMS.filter((it) => it.kind === kind && (shopForSale(it) || it.free || ownsStyle(userId, it.id)));
  const file = new AttachmentBuilder(await (await drawShopCatalog(kind, userId)).encode("jpeg", 86), { name: "catalogue.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle(`${SHOP_KINDS[kind][0]} ${SHOP_KINDS[kind][1]}`).setDescription(`${note ? `${note}\n\n` : ""}Choisissez un style pour le voir en grand, l'acheter ou l'équiper.`).setImage("attachment://catalogue.jpg")],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_shop_view")
          .setPlaceholder("Voir un style…")
          .addOptions(items.slice(0, 25).map((it) => ({ label: it.name, value: it.id, emoji: SHOP_KINDS[it.kind][0], description: (ownsStyle(userId, it.id) ? "Possédé" : priceText(it)).slice(0, 100) })))
      ),
      shopNav(),
    ],
  };
}
async function shopItemPayload(it, userId, note = "") {
  const owned = ownsStyle(userId, it.id), eq = equipped(userId, it.kind) === it.id || (it.free && !equipped(userId, it.kind));
  const file = new AttachmentBuilder(await (await drawItemPreview(it, 620, 760)).encode("jpeg", 90), { name: "style.jpg" });
  const where = { back: "Il apparaît au dos de vos cartes quand elles se retournent, à chaque ouverture de booster.", fx: "Il accompagne la révélation de vos cartes à chaque ouverture de booster.", decor: "Il devient le fond de l'Arène dans les combats que vous lancez, visible par votre adversaire." }[it.kind];
  const row = new ActionRowBuilder();
  if (!owned && !it.exclusive) row.addComponents(new ButtonBuilder().setCustomId(`carte_shop_buy_${it.id}`).setLabel(`Acheter (${priceText(it)})`).setEmoji("🛒").setStyle(ButtonStyle.Success));
  if (owned && !eq) row.addComponents(new ButtonBuilder().setCustomId(`carte_shop_eq_${it.id}`).setLabel("Équiper").setEmoji("✅").setStyle(ButtonStyle.Primary));
  if (eq && !it.free) row.addComponents(new ButtonBuilder().setCustomId(`carte_shop_uneq_${it.kind}`).setLabel("Retirer").setStyle(ButtonStyle.Secondary));
  row.addComponents(new ButtonBuilder().setCustomId(`carte_shop_cat_${it.kind}`).setLabel("Retour").setStyle(ButtonStyle.Secondary));
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xdb2777)
        .setTitle(`${SHOP_KINDS[it.kind][0]} ${it.name}`)
        .setDescription(
          (note ? `${note}\n\n` : "") +
            `${where}\n` +
            (it.exclusive ? `🏆 **Exclusif** : ${it.exclusive}.` : owned ? (eq ? "✅ **Équipé**" : "✔️ Vous le possédez.") : `Prix : **${priceText(it)}**${shopPrice(it) < it.price ? ` *(au lieu de ${priceText(it, it.price)})*` : ""}${it.month ? " · **édition limitée**, en vente ce mois-ci seulement" : ""}`)
        )
        .setImage("attachment://style.jpg"),
    ],
    files: [file],
    attachments: [],
    components: [row],
  };
}
function myStylesPayload(userId, note = "") {
  const s = styleOf(userId);
  const line = (kind) => {
    const id = equipped(userId, kind);
    return `${SHOP_KINDS[kind][0]} **${SHOP_KINDS[kind][1]}** : ${id ? shopItem(id).name : kind === "back" ? "Maison classique" : kind === "ile" ? "Lagon tropical" : "aucun"}`;
  };
  return {
    ephemeral: true,
    content: null,
    embeds: [new EmbedBuilder().setColor(0x7c3aed).setTitle("🎨 Mes styles").setDescription(`${note ? `${note}\n\n` : ""}${Object.keys(SHOP_KINDS).map(line).join("\n")}\n\n${s.owned.length} style${s.owned.length > 1 ? "s" : ""} dans votre collection.`)],
    files: [],
    attachments: [],
    components: [
      ...Object.keys(SHOP_KINDS)
        .map((kind) => {
          const owned = SHOP_ITEMS.filter((it) => it.kind === kind && (it.free || s.owned.includes(it.id)));
          if (owned.length < 1) return null;
          return new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`carte_shop_set_${kind}`)
              .setPlaceholder(`${SHOP_KINDS[kind][1]} : choisir…`)
              .addOptions([...(kind === "back" ? [] : [{ label: "Aucun", value: "none" }]), ...owned.map((it) => ({ label: it.name, value: it.id, default: equipped(userId, kind) === it.id || (it.free && !equipped(userId, kind)) }))])
          );
        })
        .filter(Boolean),
      shopNav(),
    ],
  };
}
async function handleShopInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "boutique";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("carte_shop"))) return false;
  const userId = interaction.user.id, fromPublic = isCmd || interaction.message?.flags?.has?.(64) === false;
  const show = async (payload) => {
    if (fromPublic) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    await interaction.editReply(await payload);
  };
  if (isCmd) {
    const p = await shopFrontPayload();
    await interaction.reply({ ...p, ephemeral: true });
    return true;
  }
  const cat = /^carte_shop_cat_(\w+)$/.exec(id);
  if (cat && SHOP_KINDS[cat[1]]) {
      await show(shopCatalogPayload(cat[1], userId));
      return true;
    }
  if (id === "carte_shop_me") {
      await show(myStylesPayload(userId));
      return true;
    }
  if (id === "carte_shop_view") {
    const it = shopItem(interaction.values[0]);
    if (it) await show(shopItemPayload(it, userId));
    return true;
  }
  const set = /^carte_shop_set_(\w+)$/.exec(id);
  if (set) {
    const v = interaction.values[0], it = shopItem(v);
    styleOf(userId)[set[1]] = v === "none" || it?.free ? null : ownsStyle(userId, v) ? v : null;
    save();
    await show(myStylesPayload(userId, "✅ Style mis à jour."));
    return true;
  }
  const buy = /^carte_shop_buy_(\w+)$/.exec(id);
  if (buy) {
    const it = shopItem(buy[1]);
    if (!it || !shopForSale(it)) {
      await interaction.reply({ content: "❌ Ce style n'est pas en vente.", ephemeral: true });
      return true;
    }
    if (ownsStyle(userId, it.id)) {
      await show(shopItemPayload(it, userId));
      return true;
    }
    const price = shopPrice(it);
    if (it.cur === "dust") {
      if ((load().dust[userId] ?? 0) < price) {
      await interaction.reply({ content: `❌ Il vous faut **${price.toLocaleString("fr-FR")} ✨** (vous en avez ${(load().dust[userId] ?? 0).toLocaleString("fr-FR")}).`, ephemeral: true });
      return true;
    }
      load().dust[userId] -= price;
    } else if (changeBalance(userId, -price, `Boutique de styles : ${it.name}`) === null) {
      {
      await interaction.reply({ content: `❌ Fonds insuffisants : il faut **${formatEuro(price)}**.`, ephemeral: true });
      return true;
    }
    }
    const s = styleOf(userId);
    s.owned.push(it.id);
    s[it.kind] = it.id; // équipé tout de suite
    save();
    await show(shopItemPayload(it, userId, `🎉 **${it.name}** est à vous, et déjà équipé !`));
    return true;
  }
  const eq = /^carte_shop_eq_(\w+)$/.exec(id);
  if (eq) {
    const it = shopItem(eq[1]);
    if (it && ownsStyle(userId, it.id)) {
      styleOf(userId)[it.kind] = it.free ? null : it.id;
      save();
      await show(shopItemPayload(it, userId, "✅ Équipé !"));
    }
    return true;
  }
  const un = /^carte_shop_uneq_(\w+)$/.exec(id);
  if (un) {
    styleOf(userId)[un[1]] = null;
    save();
    await show(myStylesPayload(userId, "Style retiré."));
    return true;
  }
  return false;
}
// le champion du tournoi reçoit le dos exclusif
{
  const finish = tourFinish;
  tourFinish = async (client, t) => {
    await finish(client, t);
    if (t.champion && !styleOf(t.champion).owned.includes("back_champion")) {
      styleOf(t.champion).owned.push("back_champion");
      save();
      client?.users.fetch(t.champion).then((u) => u.send("🏆 Récompense exclusive : le dos de cartes **Couronne du champion** est ajouté à vos styles (`/boutique` → Mes styles).")).catch(() => null);
    }
  };
}
// --- Le salon de la boutique ---
async function refreshShopFront() {
  const ch = chan("boutique");
  if (!ch || ch === channelRef) return false;
  const st = load();
  // la devanture illustrée ; si l'image échoue, la boutique s'affiche quand même (sans image)
  let payload;
  try {
    payload = await shopFrontPayload();
  } catch (err) {
    console.error("Boutique (image):", err.message);
    const feat = shopFeatured();
    payload = {
      embeds: [new EmbedBuilder().setColor(0xdb2777).setTitle("🛍️ La Boutique de la Maison").setDescription(`Dos de cartes, effets d'ouverture et décors d'Arène.
⭐ **En vitrine cette semaine (-${Math.round(SHOP_PROMO * 100)} %)** : ${feat.map((it) => `${it.name} (${priceText(it)})`).join(" · ")}`)],
      files: [],
      components: [shopNav()],
    };
  }
  let msg = st.shopMessageId ? await ch.messages.fetch(st.shopMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit({ ...payload, attachments: [] }).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch((err) => (console.error("Boutique (envoi):", err.message), null));
    if (!msg) return false; // on réessaiera à la prochaine minute
    st.shopMessageId = msg.id;
  }
  st.shopWeek = mondayKey();
  save();
  return true;
}
// nouvelle vitrine le lundi ; et tant que la devanture n'est pas dans le salon, on réessaie
let shopRetryAt = 0;
async function shopLoop() {
  const st = load();
  if (st.shopWeek === mondayKey() && st.shopMessageId) {
    // toutes les 10 minutes : la devanture est-elle toujours là ?
    if (new Date().getMinutes() % 10 !== 3) return;
    const ch = chan("boutique");
    const msg = ch && ch !== channelRef ? await ch.messages.fetch(st.shopMessageId).catch(() => null) : true;
    if (msg) return;
    st.shopMessageId = null;
  }
  if (Date.now() < shopRetryAt) return;
  shopRetryAt = Date.now() + 2 * MINUTE;
  await refreshShopFront().catch((err) => console.error("Boutique:", err.message));
}
