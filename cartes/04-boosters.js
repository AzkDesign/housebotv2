// --- Tirage ---
function pickRarity(weights, minRarity = null) {
  const allowed = ORDER.filter((k) => !minRarity || ORDER.indexOf(k) >= ORDER.indexOf(minRarity));
  const total = allowed.reduce((s, k) => s + weights[k], 0);
  let roll = Math.random() * total;
  for (const k of allowed) if ((roll -= weights[k]) < 0) return k;
  return allowed[allowed.length - 1];
}

// Cartes d'une génération (les cartes d'entreprises et de membres sont dans toutes les générations)
function genPool(gen) {
  return boosterPool().filter((c) => c.id.startsWith("co_") || c.id.startsWith("mb_") || c.id.startsWith("duo_") || (c.gen ?? 1) === gen);
}

function drawOne(minRarity = null, weights = null, gen = CURRENT_GEN) {
  if (!minRarity && !weights && Math.random() < SHINY_CHANCE) return { card: SHINIES.sh_trefle, holo: false };
  const w = weights ?? Object.fromEntries(ORDER.map((k) => [k, RARITIES[k].weight]));
  const pool = genPool(gen);
  let rarity = pickRarity(w, minRarity);
  let candidates = pool.filter((c) => c.rarity === rarity);
  // aucune carte de cette rareté : on prend la plus proche
  for (let step = 1; !candidates.length && step < ORDER.length; step++) {
    for (const k of [ORDER[ORDER.indexOf(rarity) - step], ORDER[ORDER.indexOf(rarity) + step]]) {
      if (k && !candidates.length) candidates = pool.filter((c) => c.rarity === k);
    }
  }
  const wk = weeklyCard();
  if (wk && candidates.some((c) => c.id === wk.id)) candidates = [...candidates, wk, wk];
  const card = candidates[Math.floor(Math.random() * candidates.length)];
  return { card, holo: Math.random() < HOLO_CHANCE };
}

function give(userId, card, holo) {
  const s = load();
  const inv = (s.inv[userId] ??= {});
  const key = holo ? `${card.id}*` : card.id;
  const isNew = !inv[card.id] && !inv[`${card.id}*`];
  inv[key] = (inv[key] ?? 0) + 1;
  save();
  return isNew;
}

// Offre une carte d'événement (Membre Star, maire élu, jackpot…)
async function grantEventCard(client, userId, eventKey, holo = Math.random() < 0.15) {
  const card = EVENTS[eventKey];
  if (!card) return;
  give(userId, card, holo);
  const user = await client.users.fetch(userId).catch(() => null);
  await user?.send({ content: `🃏 Vous recevez la carte d'événement **${card.name}** !`, files: [await cardFile(card, false)] }).catch(() => null);
}

// --- Boosters ---
const BOOSTERS = {
  standard: { name: "Standard", emoji: "📦", price: 500, size: 5, guarantee: null },
  premium: { name: "Premium", emoji: "💎", price: 1500, size: 5, guarantee: "rare" },
  prestige: { name: "Prestige", emoji: "👑", price: 5000, size: 3, guarantee: "epique" },
};
function boosterPrice(key) {
  const base = (BOOSTERS[key] ?? PACKS[key]).price;
  return lawActive("soldesBoosters") ? Math.round(base * (1 - lawParam("soldesBoosters") / 100)) : base;
}

function dayKey() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// --- Générations et boosters en inventaire ---
// Les boosters achetés vont dans l'inventaire : on les ouvre quand on veut, ou on les garde.
// Chaque génération a ses boosters ; seuls ceux de la génération en cours sont vendus.
let CURRENT_GEN = 1; // mis à jour au chargement depuis les données (state.currentGen)
const GENERATIONS = {
  1: {
    name: "Génération 1",
    title: "Les Fondations",
    code: "G1",
    featured: {
      standard: ["p_croissant", "p_eiffel", "m_casino"],
      premium: ["p_haussmann", "p_louvre", "m_penthouse"],
      prestige: ["m_dictateur", "p_versailles", "m_fondation"],
      jour: ["p_cafe", "m_cle", "p_seine"],
    },
  },
  2: {
    name: "Génération 2",
    title: "Le Grand Voyage",
    code: "G2",
    featured: {
      standard: ["v_photo", "v_newyork", "v_tgv"],
      premium: ["v_istanbul", "v_fuji", "v_kyoto"],
      prestige: ["v_fusee", "v_paques", "v_tourdumonde"],
      jour: ["v_plage", "v_boussole", "v_ile"],
    },
  },
};
const PACKS = {
  standard: { ...BOOSTERS.standard, tagline: "5 CARTES", colors: ["#b91c1c", "#f87171", "#450a0a"], accent: "#fcd34d", metal: "legendaire", pattern: "guilloche", foil: 0.14 },
  premium: { ...BOOSTERS.premium, tagline: "5 CARTES · 1 RARE GARANTIE", colors: ["#1d4ed8", "#60a5fa", "#0b1340"], accent: "#bfdbfe", metal: "rare", pattern: "losanges", foil: 0.24 },
  prestige: { ...BOOSTERS.prestige, tagline: "3 CARTES · 1 ÉPIQUE GARANTIE", colors: ["#292524", "#57534e", "#050404"], accent: "#fbbf24", metal: "legendaire", pattern: "artdeco", foil: 0.16 },
  jour: { name: "Cadeau du jour", emoji: "🎁", price: 0, size: 1, guarantee: null, tagline: "BOOSTER GRATUIT", colors: ["#047857", "#34d399", "#022c22"], accent: "#a7f3d0", metal: "peucommune", pattern: "confettis", foil: 0.16 },
  // boosters saisonniers, vendus seulement pendant leur événement
  frisson: { name: "Frisson", emoji: "🎃", price: 1200, size: 4, guarantee: null, season: "halloween", tagline: "4 CARTES · 1 CARTE D'HALLOWEEN GARANTIE", colors: ["#c2410c", "#fb923c", "#1c0a00"], accent: "#fdba74", metal: "legendaire", pattern: "artdeco", foil: 0.2, featured: ["hw_citrouille", "hw_fantome", "hw_chat"] },
  givre: { name: "Givré", emoji: "❄️", price: 1200, size: 4, guarantee: null, season: "noel", tagline: "4 CARTES · 1 CARTE DE NOËL GARANTIE", colors: ["#0e7490", "#67e8f9", "#082f49"], accent: "#e0f2fe", metal: "rare", pattern: "losanges", foil: 0.22, featured: ["xm_flocon", "xm_sapin", "xm_renne"] },
};
const PACK_ORDER = ["standard", "premium", "prestige", "jour"];
const packKey = (gen, type) => `g${gen}_${type}`;
function parsePack(key) {
  const m = /^g(\d+)_(\w+)$/.exec(key ?? "");
  return m && GENERATIONS[m[1]] && PACKS[m[2]] ? { gen: Number(m[1]), type: m[2] } : null;
}
function packLabel(key) {
  const p = parsePack(key);
  return p ? `${PACKS[p.type].emoji} ${PACKS[p.type].name} · ${GENERATIONS[p.gen].code}` : key;
}
function packsOf(userId) {
  return Object.entries(load().packs[userId] ?? {})
    .filter(([k, n]) => n > 0 && parsePack(k))
    .sort(([a], [b]) => parsePack(a).gen - parsePack(b).gen || PACK_ORDER.indexOf(parsePack(a).type) - PACK_ORDER.indexOf(parsePack(b).type));
}
function addPacks(userId, key, n) {
  const s = load();
  const inv = (s.packs[userId] ??= {});
  inv[key] = (inv[key] ?? 0) + n;
  save();
}
function takePack(userId, key) {
  const inv = load().packs[userId];
  if (!inv?.[key]) return false;
  inv[key]--;
  if (!inv[key]) delete inv[key];
  save();
  return true;
}
function packPulls(gen, type) {
  if (PACKS[type].season) return seasonPackPulls(gen, type);
  const P = PACKS[type];
  const size = type === "jour" ? (lawActive("boosterDouble") ? 2 : 1) : P.size;
  const pulls = Array.from({ length: size }, () => drawOne(null, null, gen));
  if (P.guarantee && !pulls.some((p) => ORDER.indexOf(p.card.rarity) >= ORDER.indexOf(P.guarantee))) pulls[pulls.length - 1] = drawOne(P.guarantee, null, gen);
  return pulls.sort((a, c) => ORDER.indexOf(a.card.rarity) - ORDER.indexOf(c.card.rarity)); // la meilleure en dernier
}
const canvasText = (text) => String(text).replace(/[\s  ]/g, " ");

// --- Jaquette des boosters ---
// Silhouette d'un sachet : bords soudés et crantés en haut et en bas
function packPath(W, H) {
  const p = new Path2D(), tooth = 10, depth = 7;
  p.moveTo(0, depth);
  for (let x = 0; x < W; x += tooth) {
    p.lineTo(x + tooth / 2, 0);
    p.lineTo(x + tooth, depth);
  }
  p.lineTo(W, H - depth);
  for (let x = W; x > 0; x -= tooth) {
    p.lineTo(x - tooth / 2, H);
    p.lineTo(x - tooth, H - depth);
  }
  p.closePath();
  return p;
}
function packPattern(ctx, kind, b, accent, R) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
  ctx.strokeStyle = rgba(accent, 0.13);
  ctx.fillStyle = rgba(accent, 0.13);
  ctx.lineWidth = 1;
  if (kind === "guilloche") {
    for (let k = 0; k < 44; k++) {
      ctx.beginPath();
      for (let x = b.x; x <= b.x + b.w; x += 6) {
        const y = b.y + (k * b.h) / 40 + Math.sin(x / 42 + k * 0.5) * 13 + Math.sin(x / 15 + k) * 2.5;
        if (x === b.x) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (kind === "losanges") {
    for (let k = -b.h; k < b.w + b.h; k += 46) {
      ctx.beginPath();
      ctx.moveTo(b.x + k, b.y);
      ctx.lineTo(b.x + k + b.h * 0.7, b.y + b.h);
      ctx.moveTo(b.x + k, b.y);
      ctx.lineTo(b.x + k - b.h * 0.7, b.y + b.h);
      ctx.stroke();
    }
    for (let y = b.y; y < b.y + b.h; y += 66) for (let x = b.x + ((y / 66) % 2) * 23; x < b.x + b.w; x += 46) {
      diamond(ctx, x, y, 3);
      ctx.fill();
    }
  } else if (kind === "artdeco") {
    const cx = b.x + b.w / 2, cy = b.y + b.h;
    for (let r = 40; r < b.h * 1.3; r += 26) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, Math.PI, TAU);
      ctx.stroke();
    }
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI + (i / 24) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * b.h * 1.4, cy + Math.sin(a) * b.h * 1.4);
      ctx.stroke();
    }
  } else {
    const cols = ["#fde047", "#f472b6", "#60a5fa", "#ffffff"];
    for (let i = 0; i < 130; i++) {
      ctx.save();
      ctx.translate(b.x + R() * b.w, b.y + R() * b.h);
      ctx.rotate(R() * TAU);
      ctx.fillStyle = rgba(cols[Math.floor(R() * 4)], 0.22);
      ctx.fillRect(-5, -2, 10, 4);
      ctx.restore();
    }
  }
  ctx.restore();
}
// soudure crantée : stries verticales du plastique pressé
function packSeal(ctx, y, h, colors) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, colors[2]);
  g.addColorStop(0.5, colors[1]);
  g.addColorStop(1, colors[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, y, 600, h);
  for (let x = 0; x < 600; x += 6) {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(x, y, 2, h);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + 3, y, 2, h);
  }
}

const packBaseCache = new Map();
async function drawPackBase(gen, type) {
  const key = `${gen}:${type}`;
  if (packBaseCache.has(key)) return packBaseCache.get(key);
  const W = 600, H = 920, P = PACKS[type], G = GENERATIONS[gen], m = METAL[P.metal];
  const R = seeded(hashOf(key));
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.clip(packPath(W, H));

  // Fond métallisé et motif
  const body = { x: 0, y: 46, w: W, h: H - 92 };
  const bg = ctx.createLinearGradient(0, 0, W * 0.6, H);
  bg.addColorStop(0, P.colors[1]);
  bg.addColorStop(0.35, P.colors[0]);
  bg.addColorStop(0.75, P.colors[2]);
  bg.addColorStop(1, P.colors[0]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  packPattern(ctx, P.pattern, body, P.accent, R);

  // Rayons et halo derrière l'éventail de cartes
  const hx = W / 2, hy = 500;
  ctx.save();
  ctx.translate(hx, hy);
  for (let i = 0; i < 32; i++) {
    ctx.rotate(TAU / 32);
    ctx.fillStyle = rgba(P.accent, i % 2 ? 0.05 : 0.11);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -700);
    ctx.lineTo(30, -700);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, hx, hy, 330, P.accent, 0.5);
  glow(ctx, hx, hy, 160, "#ffffff", 0.35);
  ctx.strokeStyle = rgba(P.accent, 0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hx, hy, 214, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(hx, hy, 226, 0, TAU);
  ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    disc(ctx, hx + Math.cos(a) * 220, hy + Math.sin(a) * 220, i % 5 ? 1.6 : 3.2, rgba(P.accent, 0.8));
  }

  // Éventail des cartes vedettes de la génération
  const feat = (P.featured ?? G.featured[type] ?? []).map(findCard).filter(Boolean);
  for (const i of [0, 2, 1]) {
    const card = feat[i];
    if (!card) continue;
    const w = i === 1 ? 232 : 198, h = w * 1.4;
    const img = await drawCard(card, false, 0.3, "float");
    ctx.save();
    ctx.translate(hx + (i - 1) * 128, hy + (i === 1 ? -6 : 28));
    ctx.rotate((i - 1) * 0.24);
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 16;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU, d = 150 + R() * 140;
    sparkle(ctx, hx + Math.cos(a) * d, hy + Math.sin(a) * d * 0.9, 1.5 + R() * 4, R() < 0.5 ? "#ffffff" : P.accent);
  }

  // Cadre intérieur et ornements
  ctx.strokeStyle = rgba(P.accent, 0.55);
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 60, W - 36, H - 120);
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 66, W - 48, H - 132);
  corners(ctx, { x: 24, y: 66, w: W - 48, h: H - 132 }, P.accent);

  // En-tête de la marque
  const head = ctx.createLinearGradient(0, 70, 0, 118);
  head.addColorStop(0, "rgba(0,0,0,0.55)");
  head.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = head;
  ctx.fillRect(24, 70, W - 48, 46);
  ctx.font = "22px CardEngrave";
  ctx.fillStyle = P.accent;
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  const hw = spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 101, 4);
  ctx.shadowBlur = 0;
  sparkle(ctx, W / 2 - hw / 2 - 22, 93, 5, P.accent);
  sparkle(ctx, W / 2 + hw / 2 + 22, 93, 5, P.accent);

  // Plaque de génération et titre
  const gold = METAL.legendaire;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, W / 2 - 150, 132, 300, 46, 23);
  ctx.fillStyle = metalGradient(ctx, W, H, gold);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold[3];
  ctx.lineWidth = 2;
  roundRect(ctx, W / 2 - 150, 132, 300, 46, 23);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1;
  roundRect(ctx, W / 2 - 144, 137, 288, 36, 18);
  ctx.stroke();
  ctx.font = "21px CardEngrave";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  const plaque = P.season ? "ÉDITION LIMITÉE" : G.name.toUpperCase(), coverTitle = P.season ? SEASONAL[P.season].title : G.title;
  spaced(ctx, plaque, W / 2, 164, 3);
  ctx.fillStyle = "#1a0802";
  spaced(ctx, plaque, W / 2, 163, 3);
  ctx.font = "52px CardItalic";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(coverTitle, W / 2, 246);
  ctx.shadowColor = P.accent;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(coverTitle, W / 2, 246);
  ctx.shadowBlur = 0;

  // Nom du booster en lettres de métal
  ctx.font = "66px CardEngrave";
  const tg = ctx.createLinearGradient(0, 715, 0, 775);
  tg.addColorStop(0, m[2]);
  tg.addColorStop(0.45, m[0]);
  tg.addColorStop(0.55, m[1]);
  tg.addColorStop(1, m[3]);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  const name = P.name.toUpperCase().replace("CADEAU DU JOUR", "CADEAU");
  ctx.strokeText(name, W / 2, 772);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = tg;
  ctx.fillText(name, W / 2, 772);
  ctx.shadowBlur = 0;
  ctx.font = "17px CardBold";
  ctx.fillStyle = P.accent;
  spaced(ctx, P.tagline, W / 2, 812, 2);
  ctx.textAlign = "left";

  // Médaillon de génération (à gauche) et pastille du nombre de cartes (à droite)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  disc(ctx, 84, 688, 44, metalGradient(ctx, W, H, gold));
  ctx.restore();
  disc(ctx, 84, 688, 36, "#1a0a0d");
  ctx.strokeStyle = rgba(gold[0], 0.6);
  ctx.beginPath();
  ctx.arc(84, 688, 32, 0, TAU);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = gold[0];
  ctx.font = "11px CardEngrave";
  ctx.fillText("GÉN.", 84, 676);
  ctx.font = "32px CardTitle";
  ctx.fillText(String(gen), 84, 708);
  ctx.save();
  ctx.translate(516, 688);
  ctx.rotate(0.2);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = P.accent;
  ctx.beginPath();
  for (let i = 0; i < 32; i++) {
    const r = i % 2 ? 40 : 50, a = (i / 32) * TAU;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#1a0a0d";
  ctx.font = "34px CardTitle";
  ctx.fillText(String(P.size), 0, 8);
  ctx.font = "10px CardEngrave";
  ctx.fillText(P.size > 1 ? "CARTES" : "CARTE", 0, 23);
  ctx.restore();
  ctx.textAlign = "left";

  // Soudures crantées, encoche d'ouverture
  packSeal(ctx, 0, 46, P.colors);
  packSeal(ctx, H - 46, 46, P.colors);
  for (const y of [46, H - 46]) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, y - 1, W, 2);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(0, y + 1, W, 1);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(W - 120, 56);
  ctx.lineTo(W - 4, 56);
  ctx.stroke();
  ctx.setLineDash([]);

  // Volume du sachet : bords plus sombres, bombé au centre, froissures du plastique
  const vol = ctx.createLinearGradient(0, 0, W, 0);
  vol.addColorStop(0, "rgba(0,0,0,0.45)");
  vol.addColorStop(0.1, "rgba(0,0,0,0)");
  vol.addColorStop(0.3, "rgba(255,255,255,0.08)");
  vol.addColorStop(0.6, "rgba(0,0,0,0)");
  vol.addColorStop(0.92, "rgba(0,0,0,0.1)");
  vol.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vol;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 46; i++) {
    const x = R() * W, y = R() * H, a = (R() - 0.5) * 1.2 + (R() < 0.5 ? 0 : Math.PI / 2), len = 40 + R() * 160;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.09)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.beginPath();
    ctx.moveTo(x + 1.5, y + 1.5);
    ctx.lineTo(x + 1.5 + Math.cos(a) * len, y + 1.5 + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
  // encoche découpée pour l'ouverture
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.moveTo(W, 48);
  ctx.lineTo(W - 9, 56);
  ctx.lineTo(W, 64);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
  packBaseCache.set(key, c);
  return c;
}
// Une image de la jaquette avec son reflet holographique à l'instant t
function packFrame(base, type, t) {
  const P = PACKS[type], W = base.width, H = base.height;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.drawImage(base, 0, 0);
  ctx.save();
  ctx.clip(packPath(W, H));
  ctx.globalCompositeOperation = "overlay";
  rainbow(ctx, W, H, t, P.foil);
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.4;
  const sx = -W + t * 3 * W;
  const shine = ctx.createLinearGradient(sx, 0, sx + W * 0.5, H * 0.35);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.95)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, H);
  if (type === "prestige" || type === "premium") {
    const R = seeded(hashOf(type) + 1);
    for (let i = 0; i < 34; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      ctx.globalAlpha = 0.2 + 0.8 * tw;
      sparkle(ctx, R() * W, R() * H, 0.8 + tw * 2.6, type === "prestige" ? "#fde68a" : "#e0f2fe");
    }
  }
  ctx.restore();
  return c;
}
async function packImageFile(gen, type, name = "booster.png") {
  return new AttachmentBuilder(await packFrame(await drawPackBase(gen, type), type, 0.36).encode("png"), { name });
}
// Jaquette animée qui pivote sous la lumière
const packGifCache = new Map();
async function packShineGif(gen, type) {
  const key = `shine:${gen}:${type}`;
  if (packGifCache.has(key)) return packGifCache.get(key);
  const base = await drawPackBase(gen, type);
  const shots = [];
  const frames = 22;
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const t = f / frames;
    const { data, width, height } = composeFrame(packFrame(base, type, t), null, "tilt-h", t, PACKS[type].colors[2], 340);
    shots.push({ data, width: width, height: height, delay: 75 });
  }
  const buffer = encodeFrames(shots);
  packGifCache.set(key, buffer);
  return buffer;
}
// Ouverture : le sachet tremble, se déchire, la lumière jaillit et les cartes sortent
async function packOpenGif(gen, type) {
  const key = `open:${gen}:${type}`;
  if (packGifCache.has(key)) return packGifCache.get(key);
  const P = PACKS[type], base = await drawPackBase(gen, type), backImg = drawBack(P.metal);
  const CW = 440, CH = 700, s = 0.5, pw = 600 * s, ph = 920 * s, px = (CW - pw) / 2, py = CH - ph - 30;
  const cut = 60, openY = py + cut * s, frames = 28, A = 8, B = 15;
  const shots = [];
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(CW, CH);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#313338";
    ctx.fillRect(0, 0, CW, CH);
    const shine = packFrame(base, type, (f / frames) % 1);
    const power = f < A ? (f / A) * 0.3 : f < B ? 0.3 + ((f - A) / (B - A)) * 0.7 : 1;
    // ombre au sol
    ctx.save();
    ctx.filter = "blur(7px)";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(CW / 2, CH - 22, pw * 0.42, 9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    glow(ctx, CW / 2, f < A ? py + ph * 0.45 : openY, 230 + power * 120, P.accent, 0.2 + power * 0.35);
    if (f < A) {
      const q = f / A, ang = Math.sin(q * TAU * 2) * 0.04 * q, jump = Math.abs(Math.sin(q * TAU * 2)) * 6 * q;
      ctx.save();
      ctx.translate(CW / 2, py + ph / 2 - jump);
      ctx.rotate(ang);
      ctx.drawImage(shine, -pw / 2, -ph / 2, pw, ph);
      ctx.restore();
    } else {
      // rayons de lumière qui sortent du sachet
      ctx.save();
      ctx.translate(CW / 2, openY);
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 14; i++) {
        const a = -Math.PI / 2 + (i / 13 - 0.5) * 2.4 + Math.sin(f * 0.3 + i) * 0.03;
        ctx.fillStyle = rgba(i % 2 ? "#ffffff" : P.accent, 0.1 * power);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a - 0.06) * 600, Math.sin(a - 0.06) * 600);
        ctx.lineTo(Math.cos(a + 0.06) * 600, Math.sin(a + 0.06) * 600);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      // les cartes sortent, derrière la face avant du sachet
      if (f >= B) {
        const q = (f - B) / (frames - 1 - B), e = 1 - (1 - q) ** 3;
        for (const i of [0, 2, 1]) {
          const cw = 164, chh = 230;
          ctx.save();
          ctx.translate(CW / 2 + (i - 1) * 62 * e, openY + chh / 2 + 6 - e * (175 + (i === 1 ? 30 : 0)));
          ctx.rotate((i - 1) * 0.17 * e);
          ctx.shadowColor = "rgba(0,0,0,0.55)";
          ctx.shadowBlur = 18;
          ctx.drawImage(backImg, -cw / 2, -chh / 2, cw, chh);
          ctx.restore();
        }
      }
      // corps du sachet, bord déchiré
      ctx.save();
      const tear = new Path2D();
      tear.moveTo(px - 4, openY + 5);
      for (let x = px, k = 0; x <= px + pw + 12; x += 11, k++) tear.lineTo(x, openY + (k % 2 ? 0 : 7) + Math.sin(k * 1.7) * 2);
      tear.lineTo(px + pw + 12, CH);
      tear.lineTo(px - 4, CH);
      tear.closePath();
      ctx.clip(tear);
      ctx.drawImage(shine, px, py, pw, ph);
      ctx.restore();
      // la bande arrachée s'envole
      if (f < B + 7) {
        const q = Math.min(1, (f - A) / (B - A)), fade = Math.max(0, (f - B) / 7);
        ctx.save();
        ctx.globalAlpha = 1 - fade;
        ctx.translate(px + pw * 0.15 - q * 70 - fade * 40, openY - q * 150 - fade * 60);
        ctx.rotate(-q * 0.75 - fade * 0.4);
        ctx.drawImage(shine, 0, 0, 600, cut + 6, -pw * 0.15, -cut * s, pw, (cut + 6) * s);
        ctx.restore();
      }
      glow(ctx, CW / 2, openY, 90 + power * 90, "#ffffff", 0.45 * power);
      // étincelles projetées
      const R = seeded(hashOf(type) + 77);
      for (let i = 0; i < 36; i++) {
        const a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = 6 + R() * 14, life = f - A - R() * 6;
        if (life <= 0) continue;
        const d = life * v, x = CW / 2 + Math.cos(a) * d * 0.9, y = openY + Math.sin(a) * d + life * life * 0.45;
        const alpha = Math.max(0, 1 - life / 18);
        if (alpha <= 0) continue;
        ctx.globalAlpha = alpha;
        sparkle(ctx, x, y, 1.5 + R() * 3, R() < 0.5 ? "#ffffff" : P.accent);
      }
      ctx.globalAlpha = 1;
    }
    const { data } = ctx.getImageData(0, 0, CW, CH);
    shots.push({ data, width: CW, height: CH, delay: f === frames - 1 ? 4000 : 55, once: true });
  }
  const buffer = encodeFrames(shots);
  packGifCache.set(key, buffer);
  return buffer;
}

// --- Inventaire en image ---
function woodShelf(ctx, x, y, w) {
  ctx.save();
  ctx.filter = "blur(10px)";
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x + 10, y + 26, w - 20, 22);
  ctx.restore();
  const top = ctx.createLinearGradient(0, y - 14, 0, y);
  top.addColorStop(0, "#7c4a22");
  top.addColorStop(1, "#5b3416");
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(x + 14, y - 14);
  ctx.lineTo(x + w - 14, y - 14);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fill();
  const front = ctx.createLinearGradient(0, y, 0, y + 26);
  front.addColorStop(0, "#6b3d1b");
  front.addColorStop(1, "#2e1a0b");
  ctx.fillStyle = front;
  ctx.fillRect(x, y, w, 26);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y + 4 + k * 4);
    for (let px = x; px <= x + w; px += 20) ctx.lineTo(px, y + 4 + k * 4 + Math.sin(px / 60 + k) * 1.5);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(253,230,138,0.35)";
  ctx.fillRect(x, y, w, 1.5);
}
function progressRing(ctx, x, y, r, pct, colors) {
  ctx.lineCap = "round";
  ctx.lineWidth = 14;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  if (pct > 0) {
    const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.strokeStyle = g;
    ctx.shadowColor = colors[1];
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, pct));
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.lineCap = "butt";
}
function bestCardOf(userId) {
  const inv = load().inv[userId] ?? {};
  let best = null;
  for (const [k, n] of Object.entries(inv)) {
    if (n <= 0) continue;
    const card = findCard(k.replace("*", ""));
    if (!card) continue;
    const score = ORDER.indexOf(card.rarity) * 2 + (k.endsWith("*") ? 1 : 0);
    if (!best || score > best.score) best = { card, holo: k.endsWith("*"), score };
  }
  return best;
}
function collectionRank(userId) {
  const ranked = Object.keys(load().inv)
    .map((id) => [id, collectionScore(id)])
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1]);
  const i = ranked.findIndex(([id]) => id === userId);
  return i >= 0 ? `${i + 1}${i ? "e" : "er"} sur ${ranked.length}` : "—";
}

async function drawInventory(user) {
  const userId = user.id;
  const W = 1200, H = 780, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createRadialGradient(W * 0.4, H * 0.3, 60, W / 2, H / 2, W * 0.8);
  bg.addColorStop(0, "#3d1418");
  bg.addColorStop(1, "#0a0304");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  guilloche(ctx, 0, 0, W, H, gold[0]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, gold);
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(gold[0], 0.35);
  roundRect(ctx, 18, 18, W - 36, H - 36, 18);
  ctx.stroke();
  corners(ctx, { x: 18, y: 18, w: W - 36, h: H - 36 }, gold[1]);

  // En-tête : avatar, nom, génération
  const avatar = await fetchImage(`avatar:${user.id}:${user.avatar}`, user.displayAvatarURL({ extension: "png", size: 128 }));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  disc(ctx, 92, 92, 52, metalGradient(ctx, W, H, gold));
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(92, 92, 45, 0, TAU);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, 47, 47, 90, 90);
  else disc(ctx, 92, 92, 45, "#3b0a0f");
  ctx.restore();
  const display = user.displayName ?? user.username;
  ctx.font = "46px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(display.slice(0, 26), 166, 92);
  ctx.shadowBlur = 0;
  ctx.font = "21px CardItalic";
  ctx.fillStyle = "#ecc979";
  const G = GENERATIONS[CURRENT_GEN];
  ctx.fillText(`Inventaire du collectionneur · ${G.name} — ${G.title}`, 168, 126);

  // Pastilles : poussière d'étoile et cartes
  const inv = load().inv[userId] ?? {};
  const totalCards = Object.values(inv).reduce((a, n) => a + Math.max(0, n), 0);
  const dust = load().dust[userId] ?? 0;
  const chips = [[`${dust.toLocaleString("fr-FR")} poussière`, "dust"], [`${totalCards} carte${totalCards > 1 ? "s" : ""}`, "card"]];
  let cx = W - 40;
  ctx.font = "17px CardBold";
  for (const [label, icon] of chips) {
    const tw = ctx.measureText(canvasText(label)).width, w = tw + 62;
    cx -= w;
    roundRect(ctx, cx, 62, w, 40, 20);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.strokeStyle = rgba(gold[0], 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (icon === "dust") sparkle(ctx, cx + 24, 82, 5, "#fde68a");
    else {
      roundRect(ctx, cx + 16, 70, 16, 23, 3);
      ctx.fillStyle = "#fde68a";
      ctx.fill();
      ctx.fillStyle = "#3b0a0f";
      diamond(ctx, cx + 24, 81.5, 4);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(canvasText(label), cx + 44, 88);
    cx -= 14;
  }

  // Séparateur
  ctx.strokeStyle = rgba(gold[0], 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 162);
  ctx.lineTo(W / 2 - 16, 162);
  ctx.moveTo(W / 2 + 16, 162);
  ctx.lineTo(W - 40, 162);
  ctx.stroke();
  ctx.fillStyle = gold[1];
  diamond(ctx, W / 2, 162, 6);
  ctx.fill();

  // Étagère des boosters
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.textAlign = "left";
  ctx.fillText("MES BOOSTERS", 48, 204);
  const counts = Object.fromEntries(packsOf(userId).filter(([k]) => parsePack(k).gen === CURRENT_GEN).map(([k, n]) => [parsePack(k).type, n]));
  const older = packsOf(userId).filter(([k]) => parsePack(k).gen !== CURRENT_GEN).reduce((a, [, n]) => a + n, 0);
  const slotW = 182, pw = 146, ph = 224, sy = 222;
  for (const [i, type] of PACK_ORDER.entries()) {
    const x = 48 + i * slotW, n = counts[type] ?? 0;
    const cover = await drawPackBase(CURRENT_GEN, type);
    ctx.save();
    if (!n) {
      ctx.filter = "grayscale(1) brightness(0.45)";
      ctx.globalAlpha = 0.6;
    } else {
      glow(ctx, x + pw / 2, sy + ph / 2, 120, PACKS[type].accent, 0.25);
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 8;
    }
    ctx.drawImage(packFrame(cover, type, 0.36), x, sy, pw, ph);
    ctx.restore();
    // pile : d'autres sachets dépassent derrière quand on en a plusieurs
    if (n > 1) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      for (let k = Math.min(n - 1, 3); k >= 1; k--) {
        ctx.globalAlpha = 0.85;
        ctx.drawImage(cover, x + k * 7, sy - k * 5, pw, ph);
      }
      ctx.restore();
    }
    // pastille du nombre
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    disc(ctx, x + pw - 4, sy + 10, 23, n ? metalGradient(ctx, W, H, gold) : "#3f3f46");
    ctx.restore();
    ctx.fillStyle = n ? "#2a1305" : "#a1a1aa";
    ctx.font = "18px CardBold";
    ctx.textAlign = "center";
    ctx.fillText(`×${n}`, x + pw - 4, sy + 16);
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = n ? "#f5e6c8" : "#71717a";
    ctx.fillText(PACKS[type].name.toUpperCase(), x + pw / 2, sy + ph + 62);
    ctx.textAlign = "left";
  }
  woodShelf(ctx, 36, sy + ph + 4, 4 * slotW - 6);
  if (older) {
    ctx.font = "15px CardItalic";
    ctx.fillStyle = "#cbb9a9";
    ctx.fillText(`+ ${older} booster${older > 1 ? "s" : ""} d'anciennes générations`, 48, sy + ph + 90);
  }

  // Progression par série
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.fillText("PROGRESSION DE LA COLLECTION", 48, 568);
  const owned = collectedIds(userId);
  const groups = albumGroups();
  for (const [i, g] of groups.entries()) {
    const y = 596 + i * (groups.length > 6 ? 23 : groups.length > 5 ? 27 : 32), list = collectionCards().filter((card) => seriesOf(card) === g), have = list.filter((card) => owned.has(card.id)).length;
    const pct = list.length ? have / list.length : 0;
    seriesIcon(ctx, g, 60, y, 8, gold[0]);
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#f5e6c8";
    ctx.fillText(SERIES_LABELS[g].replace(/^\S+ /, ""), 80, y + 5);
    roundRect(ctx, 260, y - 6, 380, 12, 6);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    if (pct > 0) {
      roundRect(ctx, 260, y - 6, Math.max(12, 380 * pct), 12, 6);
      const bar = ctx.createLinearGradient(260, 0, 640, 0);
      bar.addColorStop(0, gold[3]);
      bar.addColorStop(1, gold[0]);
      ctx.fillStyle = bar;
      ctx.fill();
    }
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${have}/${list.length}`, 710, y + 5);
    ctx.textAlign = "left";
    if (load().rewards[userId]?.[g]) star5(ctx, 726, y, 8, "#fbbf24");
  }

  // Panneau des statistiques
  const px = 790, py = 186, pw2 = 370, ph2 = 556;
  roundRect(ctx, px, py, pw2, ph2, 18);
  const pg = ctx.createLinearGradient(0, py, 0, py + ph2);
  pg.addColorStop(0, "rgba(45,21,19,0.92)");
  pg.addColorStop(1, "rgba(15,6,6,0.92)");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.strokeStyle = rgba(gold[1], 0.8);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.textAlign = "center";
  spaced(ctx, "STATISTIQUES", px + pw2 / 2, py + 34, 3);
  const unique = owned.size, all = collectionCards().length, pct = all ? unique / all : 0;
  progressRing(ctx, px + 96, py + 140, 66, pct, [gold[3], gold[0]]);
  ctx.fillStyle = "#ffffff";
  ctx.font = "34px CardTitle";
  ctx.fillText(`${Math.round(pct * 100)} %`, px + 96, py + 148);
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = "#cbb9a9";
  ctx.fillText("COLLECTION", px + 96, py + 170);
  const best = bestCardOf(userId);
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.fillText("MEILLEURE CARTE", px + 276, py + 62);
  if (best) {
    const img = await drawCard(best.card, best.holo, 0.3, "float");
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 16;
    ctx.drawImage(img, px + 216, py + 72, 120, 168);
    ctx.restore();
  } else {
    roundRect(ctx, px + 216, py + 72, 120, 168, 10);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.textAlign = "left";
  const holos = Object.entries(inv).filter(([k, n]) => k.endsWith("*") && n > 0).reduce((a, [, n]) => a + n, 0);
  const doubles = Object.values(inv).reduce((a, n) => a + Math.max(0, n - 1), 0);
  const rows = [
    ["Cartes uniques", `${unique} / ${all}`],
    ["Cartes au total", String(totalCards)],
    ["Holographiques", String(holos)],
    ["Doublons", String(doubles)],
    ["Score de collection", `${collectionScore(userId)} pts`],
    ["Classement", collectionRank(userId)],
    ["Boosters en réserve", String(packsOf(userId).reduce((a, [, n]) => a + n, 0))],
  ];
  for (const [i, [label, value]] of rows.entries()) {
    const y = py + 288 + i * 37;
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(px + 16, y - 24, pw2 - 32, 34);
    ctx.font = "15px CardText";
    ctx.fillStyle = "#cbb9a9";
    ctx.fillText(label, px + 30, y);
    ctx.font = "16px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(value, px + pw2 - 30, y);
    ctx.textAlign = "left";
  }

  // Pied
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#7a6a60";
  ctx.textAlign = "center";
  spaced(ctx, "LES CARTES DE LA MAISON  ·  © 2026", 420, H - 30, 2);
  ctx.textAlign = "left";
  return c;
}

// Vitrine du salon : les trois boosters de la génération en cours
let vitrineCache = null;
async function vitrineFile() {
  const prices = ["standard", "premium", "prestige"].map(boosterPrice).join(",");
  if (vitrineCache?.prices === prices) return new AttachmentBuilder(vitrineCache.buffer, { name: "vitrine.jpg" });
  const W = 1200, H = 660, gold = METAL.legendaire, G = GENERATIONS[CURRENT_GEN];
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createRadialGradient(W / 2, H * 0.55, 60, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, "#4a151b");
  bg.addColorStop(1, "#0a0304");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  guilloche(ctx, 0, 0, W, H, gold[0]);
  ctx.save();
  ctx.translate(W / 2, H * 0.55);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(TAU / 36);
    ctx.fillStyle = rgba(gold[0], i % 2 ? 0.02 : 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -900);
    ctx.lineTo(40, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, gold);
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "30px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  spaced(ctx, `${G.name.toUpperCase()}  —  ${G.title.toUpperCase()}`, W / 2, 66, 4);
  ctx.font = "21px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${collectionCards().length} cartes à collectionner · les boosters se gardent dans votre inventaire`, W / 2, 102);
  ctx.shadowBlur = 0;
  for (const [i, type] of ["standard", "premium", "prestige"].entries()) {
    const cx = 230 + i * 370, w = 252, h = w * (920 / 600), y = 128;
    glow(ctx, cx, y + h / 2, 220, PACKS[type].accent, 0.35);
    ctx.save();
    ctx.translate(cx, y + h / 2);
    ctx.rotate((i - 1) * 0.06);
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 14;
    ctx.drawImage(packFrame(await drawPackBase(CURRENT_GEN, type), type, 0.3 + i * 0.12), -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.font = "19px CardBold";
    const label = canvasText(`${PACKS[type].name}  ·  ${formatEuro(boosterPrice(type))}`), lw = ctx.measureText(label).width + 44;
    roundRect(ctx, cx - lw / 2, H - 70, lw, 40, 20);
    ctx.fillStyle = metalGradient(ctx, W, H, gold);
    ctx.fill();
    ctx.fillStyle = "#2a1305";
    ctx.fillText(label, cx, H - 43);
  }
  ctx.textAlign = "left";
  vitrineCache = { prices, buffer: await c.encode("jpeg", 90) };
  return new AttachmentBuilder(vitrineCache.buffer, { name: "vitrine.jpg" });
}

// Message d'inventaire (image + actions pour son propriétaire)
async function inventoryPayload(user, own) {
  const userId = user.id;
  const file = new AttachmentBuilder(await (await drawInventory(user)).encode("jpeg", 92), { name: "inventaire.jpg" });
  const packs = packsOf(userId);
  const G = GENERATIONS[CURRENT_GEN];
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle(`🎒 Inventaire de ${user.displayName ?? user.username}`)
    .setDescription(
      packs.length
        ? `**Boosters en réserve**\n${packs.map(([k, n]) => `${packLabel(k)} — **×${n}**`).join("\n")}`
        : "*Aucun booster en réserve.* Achetez-en dans le salon des cartes ou dans la boutique."
    )
    .setImage("attachment://inventaire.jpg")
    .setFooter({ text: `${G.name} — ${G.title} · les boosters ne périment jamais` });
  if (!own) return { embeds: [embed], files: [file], components: [] };
  const rows = [];
  if (packs.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_inv_open")
          .setPlaceholder("📦 Ouvrir un booster…")
          .addOptions(
            packs.slice(0, 25).map(([k, n]) => {
              const p = parsePack(k);
              return { label: `${PACKS[p.type].name} — ${GENERATIONS[p.gen].name}`, description: `${n} en réserve · ${PACKS[p.type].tagline.toLowerCase()}`, value: k, emoji: PACKS[p.type].emoji };
            })
          )
      )
    );
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_inv_all").setLabel("Tout ouvrir (rapide)").setEmoji("⚡").setStyle(ButtonStyle.Success).setDisabled(!packs.length),
      new ButtonBuilder().setCustomId("carte_shop").setLabel("Boutique").setEmoji("🛒").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("carte_album").setLabel("Album").setEmoji("📒").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("carte_inv_show").setLabel("Montrer").setEmoji("📣").setStyle(ButtonStyle.Secondary)
    )
  );
  return { embeds: [embed], files: [file], components: rows };
}
function packButtons(type) {
  const key = packKey(CURRENT_GEN, type);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`carte_open_${key}`).setLabel("Ouvrir maintenant").setEmoji("✂️").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("carte_inv").setLabel("Mon inventaire").setEmoji("🎒").setStyle(ButtonStyle.Secondary)
  );
  if (BOOSTERS[type]) row.addComponents(new ButtonBuilder().setCustomId(`carte_buy_${type}_5`).setLabel("En acheter 5").setEmoji("🛒").setStyle(ButtonStyle.Primary));
  return row;
}
function shopPayload(userId = null) {
  const G = GENERATIONS[CURRENT_GEN];
  const soldes = lawActive("soldesBoosters") ? ` *(soldes −${lawParam("soldesBoosters")} %)*` : "";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(`🛒 Boutique — ${G.name} : ${G.title}`)
        .setDescription(
          ["standard", "premium", "prestige"].map((t) => `${PACKS[t].emoji} **${PACKS[t].name}** — ${PACKS[t].tagline.toLowerCase()} · **${formatEuro(boosterPrice(t))}**${soldes}\n${stockLine(t, userId)}`).join("\n") +
            (activeSeason() ? `\n${PACKS[SEASONAL[activeSeason()].pack].emoji} **${PACKS[SEASONAL[activeSeason()].pack].name}** — ${PACKS[SEASONAL[activeSeason()].pack].tagline.toLowerCase()} · **${formatEuro(boosterPrice(SEASONAL[activeSeason()].pack))}** *(édition limitée : ${SEASONAL[activeSeason()].dates})*\n${stockLine(SEASONAL[activeSeason()].pack, userId)}` : "") +
            "\n\n🛒 **Le stock est commun à tout le serveur** et se remplit petit à petit (plein en 24 h). Quand il ne reste presque plus rien, le prix monte.\nLes boosters achetés vont dans votre inventaire : ouvrez-les quand vous voulez. Quand une nouvelle génération sortira, ceux-ci ne seront plus vendus."
        ),
    ],
    components: ["standard", "premium", "prestige", ...(activeSeason() ? [SEASONAL[activeSeason()].pack] : [])].map((t) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_buy_${t}_1`).setLabel(`${PACKS[t].name} ×1`).setEmoji(PACKS[t].emoji).setStyle(ButtonStyle.Primary).setDisabled(stockOf(t) < 1),
        new ButtonBuilder().setCustomId(`carte_buy_${t}_5`).setLabel(`×5 (${canvasText(formatEuro(boosterPrice(t) * 5))})`).setStyle(ButtonStyle.Secondary).setDisabled(stockOf(t) < 1),
        new ButtonBuilder().setCustomId(`carte_buy_${t}_10`).setLabel(`×10 (${canvasText(formatEuro(boosterPrice(t) * 10))})`).setStyle(ButtonStyle.Secondary).setDisabled(stockOf(t) < 1)
      )
    ),
    ephemeral: true,
  };
}

