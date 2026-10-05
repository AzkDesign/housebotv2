// Les Cartes de la Maison : cartes illustrées, boosters, booster quotidien, cartes sauvages,
// album avec récompenses et poussière d'étoile (recyclage des doublons, fabrication).
const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { changeBalance, readBalance, formatEuro, refreshRichestLeaderboard } = require("./economie");
const { lawActive, lawParam } = require("./politique");
const { findOrCreateChannel, findOrCreateRole } = require("./salons");
const { deleteLater, MINUTE } = require("./nettoyage");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon des cartes est rangé à côté des annonces
const SITUATION_DELICATE_ROLE_ID = "1554940813522505778";
const STATE_FILE = require("./data").dataFile("cartes-state.json");
const PANEL_TITLE = "🃏 Les Cartes de la Maison";

// --- Polices des cartes ---
const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["playfair-display-700.ttf", "CardSerif"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
]) {
  try {
    GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch (err) {
    console.error("Police des cartes:", err.message);
  }
}

// --- Raretés ---
const RARITIES = {
  commune: { name: "Commune", emoji: "⚪", color: "#9ca3af", weight: 60, dust: 5, points: 1 },
  peucommune: { name: "Peu commune", emoji: "🟢", color: "#22c55e", weight: 25, dust: 10, points: 2 },
  rare: { name: "Rare", emoji: "🔵", color: "#3b82f6", weight: 10, dust: 25, points: 5 },
  epique: { name: "Épique", emoji: "🟣", color: "#a855f7", weight: 4, dust: 100, points: 15 },
  legendaire: { name: "Légendaire", emoji: "🟡", color: "#f59e0b", weight: 0.9, dust: 400, points: 50 },
  mythique: { name: "Mythique", emoji: "🔴", color: "#ef4444", weight: 0.1, dust: 1500, points: 200 },
};
const ORDER = Object.keys(RARITIES);
const CRAFT_FACTOR = 4; // fabriquer une carte coûte 4 fois sa valeur de recyclage
const HOLO_CHANCE = 0.05;

// --- Séries fixes ---
const C = (id, name, emoji, rarity, text) => ({ id, name, emoji, rarity, text });
const SERIES = {
  paris: {
    name: "Paris",
    emoji: "🗼",
    reward: 5000,
    cards: [
      C("p_belleville", "Belleville", "🏘️", "commune", "Populaire, vivant, et les murs sont fins."),
      C("p_seine", "La Seine", "🌊", "commune", "Elle traverse Paris sans jamais se presser."),
      C("p_metro", "Le Métro", "🚇", "commune", "Ligne 4, heure de pointe : bonne chance."),
      C("p_croissant", "Croissant", "🥐", "commune", "Beurre ou rien."),
      C("p_baguette", "Baguette", "🥖", "commune", "Croustillante, évidemment."),
      C("p_cafe", "Café parisien", "☕", "commune", "Un petit noir en terrasse."),
      C("p_pigeon", "Pigeon", "🐦", "commune", "Le vrai propriétaire des places parisiennes."),
      C("p_marais", "Le Marais", "🌳", "peucommune", "Pavés, cours cachées et ambiance chic."),
      C("p_montmartre", "Montmartre", "🎨", "peucommune", "L'esprit village des artistes."),
      C("p_champs", "Champs-Élysées", "🛍️", "peucommune", "La plus belle avenue du monde."),
      C("p_bateau", "Bateau-mouche", "⛴️", "peucommune", "Paris vu depuis l'eau."),
      C("p_luxembourg", "Jardin du Luxembourg", "🌷", "peucommune", "Chaises vertes et sieste au soleil."),
      C("p_haussmann", "Haussmann", "💎", "rare", "Moulures, parquets et prestige."),
      C("p_notredame", "Notre-Dame", "⛪", "rare", "Elle veille sur l'île de la Cité."),
      C("p_opera", "Opéra Garnier", "🎼", "rare", "Or, velours et grands soirs."),
      C("p_moulin", "Moulin Rouge", "💃", "rare", "French cancan jusqu'au bout de la nuit."),
      { ...C("p_eiffel", "Tour Eiffel", "🗼", "epique", "La Dame de fer, 330 mètres de fierté."), svg: "eiffel" },
      C("p_louvre", "Le Louvre", "🖼️", "epique", "La Joconde vous regarde."),
      C("p_catacombes", "Catacombes", "💀", "epique", "Six millions de Parisiens sous vos pieds."),
      C("p_versailles", "Versailles", "👑", "legendaire", "Le Roi-Soleil vous salue."),
      C("p_ame", "L'Âme de Paris", "🗝️", "mythique", "On dit qu'elle n'apparaît qu'une fois par saison."),
    ],
  },
  maison: {
    name: "La Maison",
    emoji: "🏡",
    reward: 5000,
    cards: [
      C("m_double", "Chambre double", "🛏️", "commune", "Deux lits, un seul placard."),
      C("m_repas", "Repas du jour", "🍽️", "commune", "Servi chaque matin à 6h."),
      C("m_valise", "Valise du voyageur", "🧳", "commune", "Elle a vu le monde entier."),
      C("m_contrat", "Contrat de travail", "🖋️", "commune", "Signé en message privé."),
      C("m_croupier", "Le Croupier", "🃏", "peucommune", "Faites vos jeux."),
      C("m_urne", "L'Urne", "🗳️", "peucommune", "Chaque voix compte."),
      C("m_airbnb", "Airbnb de la Maison", "🏡", "peucommune", "Des voyageurs du monde entier."),
      C("m_facture", "Facture officielle", "🧾", "peucommune", "Payable en un clic."),
      C("m_suite", "La Suite", "🛋️", "rare", "Spacieuse, élégante, convoitée."),
      C("m_casino", "Le Casino", "🎰", "rare", "Ouvert le week-end, fermé aux tricheurs."),
      C("m_mairie", "La Mairie", "🏛️", "rare", "Là où se décident les lois."),
      C("m_irf", "L'IRF", "🔎", "rare", "Rien n'échappe à l'Institut."),
      C("m_cle", "Clé de la Maison", "🔑", "rare", "Elle ouvre toutes les portes."),
      C("m_penthouse", "Le Penthouse", "🏙️", "epique", "Tout Paris à vos pieds."),
      C("m_code", "Code de la Maison", "📜", "epique", "Toutes les lois, gravées pour toujours."),
      C("m_star", "Membre Star", "⭐", "epique", "Élu par la Fondation."),
      C("m_jackpot", "Jackpot", "💰", "legendaire", "Trois 7, et la vie change."),
      C("m_maire", "Le Maire", "🎖️", "legendaire", "Démocrate, roi ou dictateur ?"),
      C("m_papillon", "Papillon de la Maison", "🦋", "legendaire", "Le symbole de la Maison."),
      C("m_dictateur", "Le Dictateur", "⚔️", "legendaire", "Il a fermé le casino un samedi."),
      C("m_fondation", "La Fondation", "🏰", "mythique", "Ceux qui ont tout construit."),
    ],
  },
};

// Cartes d'événements : jamais dans les boosters, offertes lors des grands moments
const EVENTS = {
  ev_star: C("ev_star", "Star de la semaine", "🌟", "epique", "Élu(e) Membre Star par la Fondation."),
  ev_maire: C("ev_maire", "Élu(e) Maire", "🗳️", "legendaire", "Le peuple a parlé."),
  ev_jackpot: C("ev_jackpot", "Jackpot !", "💸", "legendaire", "Trois 7 alignés à la machine à sous."),
};

const SECTOR_EMOJI = { transport: "🚕", restauration: "🍽️", garage: "🔧", beaute: "💆", evenementiel: "🎉", securite: "🛡️", media: "📸", immobilier: "🏢", commerce: "🛍️" };

// --- Données ---
let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.inv ??= {}; // userId -> { cléCarte: nombre }  (clé « id* » = version holo)
  state.dust ??= {};
  state.daily ??= {};
  state.optIn ??= {};
  state.rewards ??= {};
  state.wild ??= null;
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Cartes dynamiques : entreprises et membres volontaires
function companyCards() {
  let companies = [];
  try {
    companies = require("./entreprises").listActiveCompanies();
  } catch {
    // module pas encore prêt
  }
  return companies.map((co) => {
    const ca = co.totalRevenue ?? 0;
    const rarity = ca >= 150000 ? "legendaire" : ca >= 50000 ? "epique" : ca >= 20000 ? "rare" : ca >= 5000 ? "peucommune" : "commune";
    return C(`co_${co.id}`, co.name, SECTOR_EMOJI[co.sector] ?? "🏢", rarity, `Entreprise de la Maison — ${Math.round(ca).toLocaleString("fr-FR")} € de CA.`);
  });
}

let memberCache = new Map(); // userId -> { name, avatar, stars }
function memberCards() {
  const s = load();
  return Object.keys(s.optIn)
    .filter((id) => memberCache.has(id))
    .map((id) => {
      const m = memberCache.get(id);
      const rarity = m.stars >= 50 ? "mythique" : m.stars >= 10 ? "legendaire" : m.stars >= 1 ? "epique" : "rare";
      return { ...C(`mb_${id}`, m.name, "👤", rarity, m.stars ? `Membre Star ${m.stars} fois.` : "Membre de la Maison."), avatar: m.avatar, memberId: id };
    });
}

function allCards() {
  return [...SERIES.paris.cards, ...SERIES.maison.cards, ...companyCards(), ...memberCards(), ...Object.values(EVENTS)];
}
function boosterPool() {
  return [...SERIES.paris.cards, ...SERIES.maison.cards, ...companyCards(), ...memberCards()];
}
function findCard(id) {
  return allCards().find((c) => c.id === id) ?? null;
}
function seriesOf(card) {
  if (card.id.startsWith("p_")) return "paris";
  if (card.id.startsWith("m_")) return "maison";
  if (card.id.startsWith("co_")) return "entreprises";
  if (card.id.startsWith("mb_")) return "membres";
  return "evenements";
}
const SERIES_LABELS = { paris: "🗼 Paris", maison: "🏡 La Maison", entreprises: "🏢 Les Entreprises", membres: "👤 Les Membres", evenements: "⚡ Événements" };

// Statistiques stables (pour les futures batailles), selon la rareté
function statsOf(card) {
  let h = 0;
  for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = { commune: 20, peucommune: 32, rare: 45, epique: 60, legendaire: 75, mythique: 88 }[card.rarity];
  const roll = (k) => Math.min(99, base + ((h >> (k * 5)) % 12));
  return { prestige: roll(0), influence: roll(1), chance: roll(2) };
}

function numberOf(card) {
  const key = seriesOf(card);
  const list = key === "paris" || key === "maison" ? SERIES[key].cards : allCards().filter((c) => seriesOf(c) === key);
  const i = list.findIndex((c) => c.id === card.id);
  return `#${String(i + 1).padStart(3, "0")}/${String(list.length).padStart(3, "0")}`;
}

// --- Dessin des cartes ---
const imageCache = new Map();

// Illustrations dessinées spécialement (quand aucun émoji ne convient)
const CUSTOM_SVG = {
  eiffel: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4dfa2"/><stop offset="1" stop-color="#b8862e"/></linearGradient></defs>
    <g fill="url(#g)">
      <rect x="49" y="2" width="2" height="8"/>
      <polygon points="47,10 53,10 55,34 45,34"/>
      <rect x="42" y="33" width="16" height="3" rx="1"/>
      <polygon points="44,36 56,36 61,58 39,58"/>
      <rect x="35" y="57" width="30" height="4" rx="1"/>
      <path d="M37,61 L63,61 L80,96 L66,96 Q50,72 34,96 L20,96 Z"/>
      <rect x="16" y="95" width="16" height="3" rx="1"/>
      <rect x="68" y="95" width="16" height="3" rx="1"/>
    </g>
    <g stroke="#7a5a1e" stroke-width="0.6" fill="none" opacity="0.7">
      <path d="M46,14 L54,22 M54,14 L46,22 M46,22 L54,30 M54,22 L46,30"/>
      <path d="M45,39 L55,47 M55,39 L45,47 M44,47 L56,55 M56,47 L44,55"/>
      <path d="M40,64 L60,74 M60,64 L40,74"/>
    </g>
  </svg>`,
};
async function customImage(key) {
  const k = `custom:${key}`;
  if (imageCache.has(k)) return imageCache.get(k);
  const img = await loadImage(Buffer.from(CUSTOM_SVG[key])).catch(() => null);
  imageCache.set(k, img);
  return img;
}
async function emojiImage(emoji) {
  const code = Array.from(emoji)
    .map((c) => c.codePointAt(0).toString(16))
    .filter((cp) => cp !== "fe0f")
    .join("-");
  if (imageCache.has(code)) return imageCache.get(code);
  try {
    const res = await fetch(`https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`);
    if (!res.ok) throw new Error(String(res.status));
    // l'image est chargée en grand pour rester nette
    const svg = (await res.text()).replace("<svg ", '<svg width="512" height="512" ');
    const img = await loadImage(Buffer.from(svg));
    imageCache.set(code, img);
    return img;
  } catch {
    imageCache.set(code, null);
    return null;
  }
}
async function avatarImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try {
    const res = await fetch(url);
    const img = await loadImage(Buffer.from(await res.arrayBuffer()));
    imageCache.set(url, img);
    return img;
  } catch {
    return null;
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, size, family) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 18) {
    s -= 2;
    ctx.font = `${s}px ${family}`;
  }
  return s;
}

async function drawCard(card, holo = false) {
  const W = 600, H = 840;
  const r = RARITIES[card.rarity];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Cadre aux couleurs de la rareté
  const frame = ctx.createLinearGradient(0, 0, W, H);
  frame.addColorStop(0, r.color);
  frame.addColorStop(0.5, "#1a0a0d");
  frame.addColorStop(1, r.color);
  roundRect(ctx, 0, 0, W, H, 36);
  ctx.fillStyle = frame;
  ctx.fill();
  roundRect(ctx, 16, 16, W - 32, H - 32, 26);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2a0e14");
  bg.addColorStop(1, "#0d0507");
  ctx.fillStyle = bg;
  ctx.fill();

  // Titre
  ctx.fillStyle = "#fbf3e4";
  ctx.textBaseline = "alphabetic";
  const size = fitText(ctx, card.name, W - 90, 46, "CardTitle");
  ctx.font = `${size}px CardTitle`;
  ctx.fillText(card.name, 44, 84);
  ctx.font = "20px CardText";
  ctx.fillStyle = "#c9b8a8";
  ctx.fillText(`${SERIES_LABELS[seriesOf(card)].replace(/^\S+ /, "")}  ·  ${numberOf(card)}`, 46, 116);

  // Illustration
  const ax = 40, ay = 136, aw = W - 80, ah = 400;
  roundRect(ctx, ax, ay, aw, ah, 20);
  const art = ctx.createRadialGradient(W / 2, ay + ah / 2, 20, W / 2, ay + ah / 2, 320);
  art.addColorStop(0, r.color + "aa");
  art.addColorStop(1, "#140609");
  ctx.fillStyle = art;
  ctx.fill();
  ctx.save();
  roundRect(ctx, ax, ay, aw, ah, 20);
  ctx.clip();
  if (card.avatar) {
    const img = await avatarImage(card.avatar);
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, ay + ah / 2, 160, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, W / 2 - 160, ay + ah / 2 - 160, 320, 320);
      ctx.restore();
      ctx.lineWidth = 8;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.arc(W / 2, ay + ah / 2, 162, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else {
    const img = card.svg ? await customImage(card.svg) : await emojiImage(card.emoji);
    if (img) ctx.drawImage(img, W / 2 - 150, ay + ah / 2 - 150, 300, 300);
  }
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = r.color;
  roundRect(ctx, ax, ay, aw, ah, 20);
  ctx.stroke();

  // Bandeau de rareté
  roundRect(ctx, W / 2 - 150, ay + ah - 24, 300, 48, 24);
  ctx.fillStyle = r.color;
  ctx.fill();
  ctx.fillStyle = "#0d0507";
  ctx.font = "24px CardBold";
  ctx.textAlign = "center";
  ctx.fillText(r.name.toUpperCase(), W / 2, ay + ah + 9);
  ctx.textAlign = "left";

  // Statistiques
  const stats = statsOf(card);
  const labels = [["Prestige", stats.prestige], ["Influence", stats.influence], ["Chance", stats.chance]];
  labels.forEach(([label, value], i) => {
    const y = 600 + i * 46;
    ctx.fillStyle = "#c9b8a8";
    ctx.font = "22px CardText";
    ctx.fillText(label, 50, y + 8);
    roundRect(ctx, 190, y - 12, 300, 22, 11);
    ctx.fillStyle = "#3a1a20";
    ctx.fill();
    roundRect(ctx, 190, y - 12, Math.max(22, 300 * (value / 100)), 22, 11);
    ctx.fillStyle = r.color;
    ctx.fill();
    ctx.fillStyle = "#fbf3e4";
    ctx.font = "22px CardBold";
    ctx.fillText(String(value), 505, y + 8);
  });

  // Texte d'ambiance
  ctx.fillStyle = "#e9c46a";
  ctx.font = "20px CardSerif";
  const words = card.text.split(" ");
  let line = "";
  let y = 760;
  for (const w of words) {
    if (ctx.measureText(`${line}${w} `).width > W - 100 && line) {
      ctx.fillText(line.trim(), 50, y);
      line = "";
      y += 26;
    }
    line += `${w} `;
  }
  ctx.fillText(line.trim(), 50, y);

  // Effet holographique
  if (holo) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 36);
    ctx.clip();
    ctx.globalAlpha = 0.13;
    const rainbow = ctx.createLinearGradient(0, 0, W, H);
    ["#ff0080", "#ff8c00", "#ffe600", "#00e676", "#00b0ff", "#d500f9"].forEach((c, i) => rainbow.addColorStop(i / 5, c));
    ctx.fillStyle = rainbow;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = "#ffffff";
    for (let i = -H; i < W; i += 140) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 40, 0);
      ctx.lineTo(i + 40 + H, H);
      ctx.lineTo(i + H, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // badge « HOLO » avec une étoile à 4 branches
    const bx = W - 170, by = 52;
    roundRect(ctx, bx, by, 124, 40, 20);
    const badge = ctx.createLinearGradient(bx, by, bx + 124, by);
    ["#ff0080", "#ffe600", "#00e676", "#00b0ff"].forEach((c, i) => badge.addColorStop(i / 3, c));
    ctx.fillStyle = badge;
    ctx.fill();
    ctx.fillStyle = "#0d0507";
    ctx.beginPath();
    const sx = bx + 24, sy = by + 20;
    ctx.moveTo(sx, sy - 11);
    ctx.quadraticCurveTo(sx, sy, sx + 11, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + 11);
    ctx.quadraticCurveTo(sx, sy, sx - 11, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - 11);
    ctx.fill();
    ctx.font = "22px CardBold";
    ctx.fillText("HOLO", bx + 44, by + 28);
  }
  return canvas;
}

async function cardFile(card, holo, name = "carte.png") {
  const canvas = await drawCard(card, holo);
  return new AttachmentBuilder(await canvas.encode("png"), { name });
}

// Plusieurs cartes côte à côte (récapitulatif d'un booster)
async function collageFile(pulls) {
  const scale = 0.4, w = 600 * scale, h = 840 * scale, gap = 16;
  const canvas = createCanvas(pulls.length * (w + gap) + gap, h + gap * 2);
  const ctx = canvas.getContext("2d");
  for (const [i, p] of pulls.entries()) {
    const card = await drawCard(p.card, p.holo);
    ctx.drawImage(card, gap + i * (w + gap), gap, w, h);
  }
  return new AttachmentBuilder(await canvas.encode("png"), { name: "booster.png" });
}

// --- Tirage ---
function pickRarity(weights, minRarity = null) {
  const allowed = ORDER.filter((k) => !minRarity || ORDER.indexOf(k) >= ORDER.indexOf(minRarity));
  const total = allowed.reduce((s, k) => s + weights[k], 0);
  let roll = Math.random() * total;
  for (const k of allowed) if ((roll -= weights[k]) < 0) return k;
  return allowed[allowed.length - 1];
}

function drawOne(minRarity = null, weights = null) {
  const w = weights ?? Object.fromEntries(ORDER.map((k) => [k, RARITIES[k].weight]));
  const pool = boosterPool();
  let rarity = pickRarity(w, minRarity);
  let candidates = pool.filter((c) => c.rarity === rarity);
  // aucune carte de cette rareté : on prend la plus proche
  for (let step = 1; !candidates.length && step < ORDER.length; step++) {
    for (const k of [ORDER[ORDER.indexOf(rarity) - step], ORDER[ORDER.indexOf(rarity) + step]]) {
      if (k && !candidates.length) candidates = pool.filter((c) => c.rarity === k);
    }
  }
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
async function grantEventCard(client, userId, eventKey) {
  const card = EVENTS[eventKey];
  if (!card) return;
  give(userId, card, Math.random() < 0.15);
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
  const base = BOOSTERS[key].price;
  return lawActive("soldesBoosters") ? Math.round(base * (1 - lawParam("soldesBoosters") / 100)) : base;
}

function dayKey() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBooster(interaction, client, pulls, title) {
  await interaction.deferReply({ ephemeral: true });
  const results = pulls.map((p) => ({ ...p, isNew: give(interaction.user.id, p.card, p.holo) }));
  // Révélation carte par carte
  for (const [i, p] of results.entries()) {
    const r = RARITIES[p.card.rarity];
    await interaction
      .editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(parseInt(r.color.slice(1), 16))
            .setTitle(`${title} — carte ${i + 1}/${results.length}`)
            .setDescription(`${r.emoji} **${p.card.name}** — ${r.name}${p.holo ? " ✦ **HOLO**" : ""}${p.isNew ? "  🆕 **Nouvelle !**" : ""}`)
            .setImage("attachment://carte.png"),
        ],
        files: [await cardFile(p.card, p.holo)],
      })
      .catch(() => null);
    if (i < results.length - 1) await sleep(1600);
  }
  // Récapitulatif
  await sleep(1400);
  const lines = results.map((p) => `${RARITIES[p.card.rarity].emoji} **${p.card.name}** — ${RARITIES[p.card.rarity].name}${p.holo ? " ✦ HOLO" : ""}${p.isNew ? " 🆕" : ""}`);
  await interaction
    .editReply({
      embeds: [new EmbedBuilder().setColor(0xe9c46a).setTitle(`${title} — récapitulatif`).setDescription(lines.join("\n")).setImage("attachment://booster.png")],
      files: [await collageFile(results)],
    })
    .catch(() => null);
  // Grosses cartes : annonce publique
  for (const p of results) {
    if (ORDER.indexOf(p.card.rarity) >= ORDER.indexOf("epique")) await announcePull(client, interaction.user, p);
  }
  await checkSeriesRewards(client, interaction.user.id);
}

async function announcePull(client, user, p) {
  if (!channelRef) return;
  const r = RARITIES[p.card.rarity];
  const msg = await channelRef
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setDescription(`${r.emoji} ${user} vient d'obtenir **${p.card.name}** (${r.name}${p.holo ? " ✦ HOLO" : ""}) !`)
          .setThumbnail("attachment://carte.png"),
      ],
      files: [await cardFile(p.card, p.holo)],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
  if (ORDER.indexOf(p.card.rarity) < ORDER.indexOf("legendaire")) deleteLater(msg, 60 * MINUTE);
}

// --- Album et récompenses ---
function ownedIds(userId) {
  return new Set(Object.keys(load().inv[userId] ?? {}).filter((k) => load().inv[userId][k] > 0).map((k) => k.replace("*", "")));
}

function collectionScore(userId) {
  const inv = load().inv[userId] ?? {};
  let score = 0;
  for (const id of ownedIds(userId)) {
    const card = findCard(id);
    if (!card) continue;
    score += RARITIES[card.rarity].points * (inv[`${id}*`] ? 2 : 1);
  }
  return score;
}

async function checkSeriesRewards(client, userId) {
  const s = load();
  const owned = ownedIds(userId);
  for (const [key, series] of Object.entries(SERIES)) {
    if (s.rewards[userId]?.[key]) continue;
    if (!series.cards.every((c) => owned.has(c.id))) continue;
    s.rewards[userId] = { ...(s.rewards[userId] ?? {}), [key]: Date.now() };
    s.dust[userId] = (s.dust[userId] ?? 0) + 500;
    save();
    changeBalance(userId, series.reward, `Série de cartes complète : ${series.name}`);
    const guild = channelRef?.guild;
    if (guild) {
      const role = await findOrCreateRole(guild, { name: `🃏 Collectionneur ${series.name}`, color: 0xe9c46a, hoist: false }).catch(() => null);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (role && member) await member.roles.add(role).catch(() => null);
    }
    await channelRef
      ?.send({ content: `🏆 <@${userId}> a complété la série **${series.emoji} ${series.name}** ! Récompense : **${formatEuro(series.reward)}**, **500 ✨** et le rôle Collectionneur ${series.name}.`, allowedMentions: { users: [userId] } })
      .catch(() => null);
  }
}

function albumEmbed(userId) {
  const owned = ownedIds(userId);
  const groups = ["paris", "maison", "entreprises", "membres", "evenements"];
  const lines = groups.map((g) => {
    const list = allCards().filter((c) => seriesOf(c) === g);
    const have = list.filter((c) => owned.has(c.id)).length;
    const pct = list.length ? Math.round((have / list.length) * 100) : 0;
    const bar = "▰".repeat(Math.round(pct / 10)) + "▱".repeat(10 - Math.round(pct / 10));
    return `${SERIES_LABELS[g]} — **${have}/${list.length}** ${bar} ${pct} %${load().rewards[userId]?.[g] ? " 🏆" : ""}`;
  });
  return new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle("📒 Mon album")
    .setDescription(lines.join("\n") + `\n\n⭐ Score de collection : **${collectionScore(userId)}** · ✨ Poussière : **${load().dust[userId] ?? 0}**`)
    .setFooter({ text: "Compléter Paris ou La Maison rapporte 5 000 €, 500 ✨ et un rôle" });
}

function seriesDetail(userId, group) {
  const inv = load().inv[userId] ?? {};
  const list = allCards().filter((c) => seriesOf(c) === group);
  const lines = list.map((c) => {
    const n = (inv[c.id] ?? 0) + (inv[`${c.id}*`] ?? 0);
    return n ? `${RARITIES[c.rarity].emoji} ${numberOf(c)} **${c.name}**${inv[`${c.id}*`] ? " ✦" : ""}${n > 1 ? ` ×${n}` : ""}` : `▫️ ${numberOf(c)} *??? (${RARITIES[c.rarity].name})*`;
  });
  return new EmbedBuilder().setColor(0xe9c46a).setTitle(SERIES_LABELS[group]).setDescription(lines.join("\n").slice(0, 4000) || "*Aucune carte dans cette série pour le moment.*");
}

// --- Poussière d'étoile ---
function recycleDuplicates(userId) {
  const s = load();
  const inv = s.inv[userId] ?? {};
  let dust = 0;
  let count = 0;
  for (const [key, n] of Object.entries(inv)) {
    const card = findCard(key.replace("*", ""));
    if (!card || n <= 1) continue;
    const extra = n - 1;
    dust += extra * RARITIES[card.rarity].dust * (key.endsWith("*") ? 3 : 1);
    count += extra;
    inv[key] = 1;
  }
  s.dust[userId] = (s.dust[userId] ?? 0) + dust;
  save();
  return { dust, count };
}

function craftCost(card) {
  return RARITIES[card.rarity].dust * CRAFT_FACTOR;
}

// --- Cartes sauvages ---
const WILD_WEIGHTS = { commune: 40, peucommune: 30, rare: 18, epique: 9, legendaire: 2.7, mythique: 0.3 };
let nextWildAt = Date.now() + (30 + Math.random() * 60) * MINUTE;

async function spawnWild(client) {
  if (!channelRef) return;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 9 || hour >= 23) return;
  const { card, holo } = drawOne(null, WILD_WEIGHTS);
  const r = RARITIES[card.rarity];
  const id = String(Date.now());
  const msg = await channelRef
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setTitle("✨ Une carte sauvage est apparue !")
          .setDescription(`${r.emoji} **${card.name}** — ${r.name}${holo ? " ✦ HOLO" : ""}\nLe premier qui clique l'attrape !`)
          .setImage("attachment://carte.png"),
      ],
      files: [await cardFile(card, holo)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_wild_${id}`).setLabel("Attraper !").setEmoji("✋").setStyle(ButtonStyle.Success))],
    })
    .catch(() => null);
  if (!msg) return;
  load().wild = { id, cardId: card.id, holo, messageId: msg.id, at: Date.now() };
  save();
  // Personne ne l'a attrapée : elle s'envole
  setTimeout(async () => {
    const w = load().wild;
    if (w?.id !== id) return;
    load().wild = null;
    save();
    await msg.edit({ embeds: [EmbedBuilder.from(msg.embeds[0]).setTitle("💨 La carte s'est envolée…").setDescription("Personne ne l'a attrapée à temps.")], components: [] }).catch(() => null);
    deleteLater(msg, 5 * MINUTE);
  }, 15 * MINUTE);
}

// --- Panneau ---
let channelRef = null;

function leaderboard() {
  return Object.keys(load().inv)
    .map((id) => [id, collectionScore(id)])
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, sc], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} <@${id}> — ${sc} pts`)
    .join("\n");
}

function panelMessage() {
  const soldes = lawActive("soldesBoosters") ? ` *(soldes −${lawParam("soldesBoosters")} %)*` : "";
  const daily = lawActive("boosterDouble") ? "2 cartes" : "1 carte";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(PANEL_TITLE)
        .setDescription(
          "Collectionnez les cartes de Paris, de la Maison, des entreprises et des membres !\n\n" +
            `📦 **Standard** — 5 cartes · **${formatEuro(boosterPrice("standard"))}**${soldes}\n` +
            `💎 **Premium** — 5 cartes dont une **rare** garantie · **${formatEuro(boosterPrice("premium"))}**${soldes}\n` +
            `👑 **Prestige** — 3 cartes dont une **épique** garantie · **${formatEuro(boosterPrice("prestige"))}**${soldes}\n` +
            `🎁 **Booster gratuit** — ${daily} chaque jour\n\n` +
            "**Raretés** : ⚪ Commune · 🟢 Peu commune · 🔵 Rare · 🟣 Épique · 🟡 Légendaire · 🔴 Mythique · ✦ Holo (5 %)\n" +
            "✨ Des **cartes sauvages** apparaissent ici de temps en temps : soyez le premier à les attraper !\n" +
            "♻️ Recyclez vos doublons en **poussière d'étoile** pour fabriquer la carte de votre choix."
        )
        .addFields({ name: "🏆 Meilleurs collectionneurs", value: leaderboard() || "*Personne pour le moment.*" })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_booster_standard").setLabel("Standard").setEmoji("📦").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_premium").setLabel("Premium").setEmoji("💎").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_prestige").setLabel("Prestige").setEmoji("👑").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("carte_daily").setLabel("Booster gratuit").setEmoji("🎁").setStyle(ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_album").setLabel("Mon album").setEmoji("📒").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_dust").setLabel("Poussière d'étoile").setEmoji("✨").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_member").setLabel("Ma carte de membre").setEmoji("👤").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

let panelDirty = false;
async function refreshPanel(client) {
  if (!channelRef) return;
  const s = load();
  let msg = s.panelMessageId ? await channelRef.messages.fetch(s.panelMessageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channelRef.messages.fetch({ limit: 25 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (msg) await msg.edit(panelMessage()).catch(() => null);
  else msg = await channelRef.send(panelMessage()).catch(() => null);
  if (msg && s.panelMessageId !== msg.id) {
    s.panelMessageId = msg.id;
    save();
  }
}

// --- Interactions ---
async function handleCartesInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_")) return false;
  const userId = interaction.user.id;
  load();

  if (id.startsWith("carte_booster_")) {
    const key = id.slice("carte_booster_".length);
    const b = BOOSTERS[key];
    if (!b) return false;
    const price = boosterPrice(key);
    if (changeBalance(userId, -price, `Achat d'un booster de cartes ${b.name}`) === null) {
      await interaction.reply({ content: `❌ Le booster ${b.name} coûte **${formatEuro(price)}** (vous avez ${formatEuro(readBalance(userId))}), ou votre compte est gelé.`, ephemeral: true });
      return true;
    }
    const pulls = Array.from({ length: b.size }, () => drawOne());
    if (b.guarantee && !pulls.some((p) => ORDER.indexOf(p.card.rarity) >= ORDER.indexOf(b.guarantee))) {
      pulls[pulls.length - 1] = drawOne(b.guarantee);
    }
    pulls.sort((a, c) => ORDER.indexOf(a.card.rarity) - ORDER.indexOf(c.card.rarity)); // la meilleure en dernier
    await openBooster(interaction, client, pulls, `${b.emoji} Booster ${b.name}`);
    panelDirty = true;
    refreshRichestLeaderboard(client).catch(() => null);
    return true;
  }

  if (id === "carte_daily") {
    const s = load();
    if (s.daily[userId] === dayKey()) {
      await interaction.reply({ content: "🎁 Vous avez déjà ouvert votre booster gratuit aujourd'hui. Revenez demain !", ephemeral: true });
      return true;
    }
    s.daily[userId] = dayKey();
    save();
    const count = lawActive("boosterDouble") ? 2 : 1;
    await openBooster(interaction, client, Array.from({ length: count }, () => drawOne()), "🎁 Booster gratuit du jour");
    panelDirty = true;
    return true;
  }

  if (id === "carte_album") {
    await interaction.reply({
      embeds: [albumEmbed(userId)],
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_series")
            .setPlaceholder("Voir le détail d'une série")
            .addOptions(Object.entries(SERIES_LABELS).map(([k, label]) => ({ label: label.replace(/^\S+ /, ""), value: k, emoji: label.split(" ")[0] })))
        ),
      ],
    });
    return true;
  }

  if (id === "carte_series") {
    const group = interaction.values[0];
    const owned = allCards().filter((c) => seriesOf(c) === group && ownedIds(userId).has(c.id));
    const rows = owned.length
      ? [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("carte_view")
              .setPlaceholder("Afficher une de mes cartes")
              .addOptions(owned.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), value: c.id, emoji: RARITIES[c.rarity].emoji })))
          ),
        ]
      : [];
    await interaction.update({ embeds: [albumEmbed(userId), seriesDetail(userId, group)], components: rows });
    return true;
  }

  if (id === "carte_view") {
    const card = findCard(interaction.values[0]);
    const holo = Boolean(load().inv[userId]?.[`${card?.id}*`]);
    if (!card) { await interaction.reply({ content: "❌ Carte introuvable.", ephemeral: true }); return true; }
    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setTitle(card.name).setImage("attachment://carte.png")],
      files: [await cardFile(card, holo)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_show_${card.id}`).setLabel("Montrer à tout le monde").setEmoji("📣").setStyle(ButtonStyle.Secondary))],
    });
    return true;
  }

  if (id.startsWith("carte_show_")) {
    const card = findCard(id.slice("carte_show_".length));
    if (!card || !ownedIds(userId).has(card.id)) { await interaction.reply({ content: "❌ Vous n'avez pas cette carte.", ephemeral: true }); return true; }
    const holo = Boolean(load().inv[userId]?.[`${card.id}*`]);
    const msg = await channelRef
      ?.send({ content: `📣 ${interaction.user} montre sa carte :`, files: [await cardFile(card, holo)], allowedMentions: { parse: [] } })
      .catch(() => null);
    deleteLater(msg, 30 * MINUTE);
    await interaction.update({ components: [] });
    return true;
  }

  if (id === "carte_dust") {
    const inv = load().inv[userId] ?? {};
    const doubles = Object.values(inv).reduce((s, n) => s + Math.max(0, n - 1), 0);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("✨ Poussière d'étoile")
          .setDescription(
            `Vous avez **${load().dust[userId] ?? 0} ✨** et **${doubles}** doublon(s).\n\n` +
              "**Recycler** : chaque doublon rapporte ⚪ 5 · 🟢 10 · 🔵 25 · 🟣 100 · 🟡 400 · 🔴 1 500 ✨ (×3 si holo).\n" +
              `**Fabriquer** : une carte coûte ${CRAFT_FACTOR} fois sa valeur (une rare : 100 ✨, une légendaire : 1 600 ✨).`
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("carte_recycle").setLabel("Recycler mes doublons").setEmoji("♻️").setStyle(ButtonStyle.Primary).setDisabled(!doubles),
          new ButtonBuilder().setCustomId("carte_craft").setLabel("Fabriquer une carte").setEmoji("🔨").setStyle(ButtonStyle.Success)
        ),
      ],
    });
    return true;
  }

  if (id === "carte_recycle") {
    const { dust, count } = recycleDuplicates(userId);
    await interaction.update({ content: `♻️ **${count}** doublon(s) recyclé(s) : +**${dust} ✨** (total ${load().dust[userId]} ✨).`, embeds: [], components: [] });
    return true;
  }

  if (id === "carte_craft") {
    await interaction.update({
      content: "🔨 Dans quelle série fabriquer une carte ?",
      embeds: [],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_craftseries")
            .setPlaceholder("Choisir une série")
            .addOptions(["paris", "maison", "entreprises", "membres"].map((k) => ({ label: SERIES_LABELS[k].replace(/^\S+ /, ""), value: k, emoji: SERIES_LABELS[k].split(" ")[0] })))
        ),
      ],
    });
    return true;
  }

  if (id === "carte_craftseries") {
    const owned = ownedIds(userId);
    const list = allCards()
      .filter((c) => seriesOf(c) === interaction.values[0])
      .sort((a, b) => Number(owned.has(a.id)) - Number(owned.has(b.id)));
    if (!list.length) { await interaction.update({ content: "Aucune carte dans cette série.", components: [] }); return true; }
    await interaction.update({
      content: `🔨 Quelle carte fabriquer ? (vous avez **${load().dust[userId] ?? 0} ✨**)`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_craftcard")
            .setPlaceholder("Choisir une carte")
            .addOptions(list.slice(0, 25).map((c) => ({ label: `${c.name}${owned.has(c.id) ? " (déjà possédée)" : ""}`.slice(0, 100), value: c.id, emoji: RARITIES[c.rarity].emoji, description: `${craftCost(c)} ✨` })))
        ),
      ],
    });
    return true;
  }

  if (id === "carte_craftcard") {
    const card = findCard(interaction.values[0]);
    const cost = card && craftCost(card);
    const s = load();
    if (!card || (s.dust[userId] ?? 0) < cost) {
      { await interaction.update({ content: `❌ Il faut **${cost ?? "?"} ✨** (vous avez ${s.dust[userId] ?? 0} ✨).`, components: [] }); return true; }
    }
    s.dust[userId] -= cost;
    save();
    give(userId, card, false);
    await interaction.update({
      content: `🔨 Vous avez fabriqué **${card.name}** pour ${cost} ✨ !`,
      components: [],
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setImage("attachment://carte.png")],
      files: [await cardFile(card, false)],
    });
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }

  if (id === "carte_member") {
    if (interaction.member?.roles.cache.has(SITUATION_DELICATE_ROLE_ID)) {
      await interaction.reply({ content: "🔒 Les cartes de membres ne sont pas disponibles pour la Maison des Jeunes.", ephemeral: true });
      return true;
    }
    const s = load();
    const on = !s.optIn[userId];
    if (on) s.optIn[userId] = true;
    else delete s.optIn[userId];
    save();
    if (on) {
      await cacheMember(interaction.member);
      const card = memberCards().find((c) => c.memberId === userId);
      await interaction.reply({
        content: "👤 Votre carte de membre est créée ! Elle peut maintenant sortir dans les boosters. (Re-cliquez pour la retirer.)",
        ephemeral: true,
        files: card ? [await cardFile(card, false)] : [],
      });
    } else {
      await interaction.reply({ content: "👤 Votre carte de membre est retirée des boosters (les exemplaires déjà obtenus restent).", ephemeral: true });
    }
    return true;
  }

  if (id.startsWith("carte_wild_")) {
    const w = load().wild;
    if (!w || w.id !== id.slice("carte_wild_".length)) {
      await interaction.reply({ content: "💨 Trop tard, cette carte a déjà été attrapée !", ephemeral: true });
      return true;
    }
    load().wild = null;
    save();
    const card = findCard(w.cardId);
    if (card) give(userId, card, w.holo);
    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setTitle("⚡ Carte attrapée !").setDescription(`${interaction.user} attrape **${card?.name}** !`)],
      components: [],
    });
    deleteLater(interaction.message, 10 * MINUTE);
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }
  return false;
}

// Informations des membres volontaires (nom, avatar, nombre d'élections Membre Star)
async function cacheMember(member) {
  if (!member) return;
  let stars = 0;
  try {
    const title = require("./membrestar").getStarTitle(member.id);
    stars = title ? Number(title.match(/(\d+)/)?.[1] ?? 1) : 0;
  } catch {
    // Membre Star indisponible
  }
  memberCache.set(member.id, { name: member.displayName, avatar: member.user.displayAvatarURL({ extension: "png", size: 512 }), stars });
}

// Pour /profil
function getCollectionSummary(userId) {
  const n = ownedIds(userId).size;
  return n ? `${n} carte(s) · ${collectionScore(userId)} pts` : null;
}

async function setupCartes(client) {
  load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: state.channelId,
    name: "🃏・cartes-de-la-maison",
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  state.channelId = channelRef.id;
  save();
  for (const id of Object.keys(state.optIn)) await cacheMember(await guild.members.fetch(id).catch(() => null));
  await refreshPanel(client);

  setInterval(async () => {
    try {
      if (Date.now() >= nextWildAt) {
        nextWildAt = Date.now() + (60 + Math.random() * 120) * MINUTE; // toutes les 1 à 3 heures
        await spawnWild(client);
      }
      if (panelDirty) {
        panelDirty = false;
        await refreshPanel(client);
      }
    } catch (err) {
      console.error("Cartes:", err.message);
    }
  }, MINUTE);
  console.log("Cartes de la Maison prêtes");
}

module.exports = { setupCartes, handleCartesInteraction, grantEventCard, getCollectionSummary, drawCard, SERIES, RARITIES };
