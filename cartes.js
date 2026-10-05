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
// Illustrations en 3D : collection « Fluent Emoji 3D » de Microsoft (licence MIT).
const { GIFEncoder, quantize, applyPalette } = require("gifenc");
const FLUENT = {
  "🏘️": "Houses", "🌊": "Water wave", "🚇": "Metro", "🥐": "Croissant", "🥖": "Baguette bread", "☕": "Hot beverage", "🐦": "Bird",
  "🌳": "Deciduous tree", "🎨": "Artist palette", "🛍️": "Shopping bags", "⛴️": "Ferry", "🌷": "Tulip", "💎": "Gem stone", "⛪": "Church",
  "🎼": "Musical score", "💃": "Woman dancing", "🖼️": "Framed picture", "💀": "Skull", "👑": "Crown", "🗝️": "Old key",
  "🛏️": "Bed", "🍽️": "Fork and knife with plate", "🧳": "Luggage", "🖋️": "Fountain pen", "🃏": "Joker", "🗳️": "Ballot box with ballot",
  "🏡": "House with garden", "🧾": "Receipt", "🛋️": "Couch and lamp", "🎰": "Slot machine", "🏛️": "Classical building", "🔎": "Magnifying glass tilted right",
  "🔑": "Key", "🏙️": "Cityscape", "📜": "Scroll", "⭐": "Star", "💰": "Money bag", "🎖️": "Military medal", "🦋": "Butterfly", "⚔️": "Crossed swords",
  "🏰": "Castle", "🌟": "Glowing star", "💸": "Money with wings", "🚕": "Taxi", "🔧": "Wrench", "💆": "Person getting massage", "🎉": "Party popper",
  "🛡️": "Shield", "📸": "Camera with flash", "🏢": "Office building", "👤": "Bust in silhouette",
};
const FLUENT_SKIN = new Set(["Woman dancing", "Person getting massage"]);
function fluentUrl(name) {
  const file = name.toLowerCase().replace(/ /g, "_");
  const base = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodeURIComponent(name)}`;
  return FLUENT_SKIN.has(name) ? `${base}/Default/3D/${file}_3d_default.png` : `${base}/3D/${file}_3d.png`;
}

// Cadres métalliques selon la rareté : [clair, moyen, reflet, sombre, lueur]
const METAL = {
  commune: ["#f3f4f6", "#9ca3af", "#ffffff", "#4b5563", "#cbd5e1"],
  peucommune: ["#bbf7d0", "#16a34a", "#dcfce7", "#14532d", "#4ade80"],
  rare: ["#bfdbfe", "#2563eb", "#dbeafe", "#1e3a8a", "#60a5fa"],
  epique: ["#e9d5ff", "#9333ea", "#f3e8ff", "#581c87", "#c084fc"],
  legendaire: ["#fde68a", "#d97706", "#fff7d6", "#78350f", "#fbbf24"],
  mythique: ["#fecaca", "#dc2626", "#fde68a", "#450a0a", "#f87171"],
};

const imageCache = new Map();

// Tour Eiffel dessinée à la main (absente de la collection 3D), dorée et en relief
const EIFFEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5a12"/><stop offset="0.35" stop-color="#ffe9a8"/><stop offset="0.6" stop-color="#e0a93a"/><stop offset="1" stop-color="#6b430c"/></linearGradient>
  </defs>
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
  <g stroke="#5a3a0a" stroke-width="0.6" fill="none" opacity="0.65">
    <path d="M46,14 L54,22 M54,14 L46,22 M46,22 L54,30 M54,22 L46,30"/>
    <path d="M45,39 L55,47 M55,39 L45,47 M44,47 L56,55 M56,47 L44,55"/>
    <path d="M40,64 L60,74 M60,64 L40,74"/>
  </g>
</svg>`;

async function fetchImage(key, url, transform) {
  if (imageCache.has(key)) return imageCache.get(key);
  try {
    let buffer;
    if (url) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      buffer = Buffer.from(await res.arrayBuffer());
    }
    const img = await loadImage(transform ? transform(buffer) : buffer);
    imageCache.set(key, img);
    return img;
  } catch {
    imageCache.set(key, null);
    return null;
  }
}

async function artImage(card) {
  if (card.svg === "eiffel") return fetchImage("svg:eiffel", null, () => Buffer.from(EIFFEL_SVG));
  if (FLUENT[card.emoji]) {
    const img = await fetchImage(`fluent:${card.emoji}`, fluentUrl(FLUENT[card.emoji]));
    if (img) return img;
  }
  // secours : émoji plat
  const code = Array.from(card.emoji).map((c) => c.codePointAt(0).toString(16)).filter((cp) => cp !== "fe0f").join("-");
  return fetchImage(`twemoji:${code}`, `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${code}.svg`, (b) =>
    Buffer.from(b.toString("utf8").replace("<svg ", '<svg width="512" height="512" '))
  );
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

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function hashOf(text) {
  let h = 7;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// Décor de fond selon la série
function drawScene(ctx, x, y, w, h, series, rarity, seed, t = 0) {
  const R = seeded(seed);
  if (series === "paris") {
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, "#1e1b4b");
    sky.addColorStop(0.55, "#9d174d");
    sky.addColorStop(1, "#fb923c");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 45; i++) {
      ctx.globalAlpha = (0.3 + R() * 0.7) * (0.7 + 0.3 * Math.sin(t * 6 + i));
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + R() * w, y + R() * h * 0.45, R() * 1.8 + 0.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a1033";
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    let cx = x;
    while (cx < x + w) {
      const bw = 20 + R() * 40, bh = 40 + R() * 70;
      ctx.lineTo(cx, y + h - bh);
      ctx.lineTo(cx + bw * 0.5, y + h - bh - 12);
      ctx.lineTo(cx + bw, y + h - bh);
      cx += bw;
    }
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(251,191,36,0.85)";
    for (let i = 0; i < 30; i++) ctx.fillRect(x + R() * w, y + h - 10 - R() * 60, 3, 4);
  } else if (series === "entreprises") {
    const sky = ctx.createLinearGradient(0, y, 0, y + h);
    sky.addColorStop(0, "#0b1026");
    sky.addColorStop(1, "#1d4ed8");
    ctx.fillStyle = sky;
    ctx.fillRect(x, y, w, h);
    let cx = x;
    while (cx < x + w) {
      const bw = 34 + R() * 46, bh = 120 + R() * 220;
      ctx.fillStyle = "#0a0f24";
      ctx.fillRect(cx, y + h - bh, bw - 4, bh);
      for (let wy = y + h - bh + 10; wy < y + h - 10; wy += 16) {
        for (let wx = cx + 6; wx < cx + bw - 12; wx += 12) {
          if (R() < 0.45) {
            ctx.fillStyle = R() < 0.8 ? "rgba(253,224,71,0.85)" : "rgba(147,197,253,0.9)";
            ctx.fillRect(wx, wy, 5, 7);
          }
        }
      }
      cx += bw;
    }
  } else if (series === "membres") {
    ctx.fillStyle = "#14060a";
    ctx.fillRect(x, y, w, h);
    // rideaux de scène
    for (let i = 0; i < 2; i++) {
      const cxs = i === 0 ? x : x + w - 90;
      const curtain = ctx.createLinearGradient(cxs, 0, cxs + 90, 0);
      curtain.addColorStop(0, "#7f1d1d");
      curtain.addColorStop(0.5, "#b91c1c");
      curtain.addColorStop(1, "#450a0a");
      ctx.fillStyle = curtain;
      ctx.fillRect(cxs, y, 90, h);
    }
    // projecteur
    const spot = ctx.createRadialGradient(x + w / 2, y + h * 0.45, 10, x + w / 2, y + h * 0.5, w * 0.55);
    spot.addColorStop(0, "rgba(255,244,214,0.75)");
    spot.addColorStop(1, "rgba(255,244,214,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(x, y, w, h);
  } else if (series === "evenements") {
    const bg = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w);
    bg.addColorStop(0, "#422006");
    bg.addColorStop(1, "#0c0502");
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    // feux d'artifice dorés
    for (let f = 0; f < 4; f++) {
      const fx = x + 60 + R() * (w - 120), fy = y + 60 + R() * (h * 0.5);
      const col = ["#fbbf24", "#f472b6", "#60a5fa", "#a3e635"][f];
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2, len = 30 + R() * 40 + 8 * Math.sin(t * 6);
        ctx.strokeStyle = col;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8);
        ctx.lineTo(fx + Math.cos(a) * len, fy + Math.sin(a) * len);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  } else {
    // La Maison : intérieur chaleureux, lumières dorées
    const wall = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 20, x + w / 2, y + h / 2, w);
    wall.addColorStop(0, "#7f1d1d");
    wall.addColorStop(1, "#1a0508");
    ctx.fillStyle = wall;
    ctx.fillRect(x, y, w, h);
    for (let i = 0; i < 18; i++) {
      const bx = x + R() * w, by = y + R() * h, br = (10 + R() * 30) * (0.9 + 0.1 * Math.sin(t * 4 + i));
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      g.addColorStop(0, "rgba(253,224,71,0.55)");
      g.addColorStop(1, "rgba(253,224,71,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, 7);
      ctx.fill();
    }
  }
  // rayons lumineux derrière le sujet (rare et plus), qui tournent dans l'animation
  if (ORDER.indexOf(rarity) >= ORDER.indexOf("rare")) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.translate(x + w / 2, y + h * 0.55);
    ctx.rotate(t * 0.6);
    ctx.fillStyle = METAL[rarity][4];
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -w);
      ctx.lineTo(18, -w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

function metalGradient(ctx, W, H, m, shift = 0) {
  const g = ctx.createLinearGradient(W * shift, 0, W * (1 + shift), H);
  g.addColorStop(0, m[0]);
  g.addColorStop(0.3, m[1]);
  g.addColorStop(0.5, m[2]);
  g.addColorStop(0.75, m[1]);
  g.addColorStop(1, m[3]);
  return g;
}

// Effets de feuille : arc-en-ciel (holo), paillettes d'or (légendaire), galaxie (mythique)
function drawFoil(ctx, W, H, card, holo, t) {
  const rarity = card.rarity;
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();
  if (holo) {
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.32;
    const rb = ctx.createLinearGradient(W * (t - 1), 0, W * (t + 1), H);
    ["#ff0080", "#ff8c00", "#ffe600", "#00e676", "#00b0ff", "#d500f9", "#ff0080"].forEach((c, i) => rb.addColorStop(i / 6, c));
    ctx.fillStyle = rb;
    ctx.fillRect(0, 0, W, H);
  }
  if (holo || ORDER.indexOf(rarity) >= ORDER.indexOf("epique")) {
    // reflet lumineux qui balaie la carte
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = holo ? 0.5 : 0.28;
    const sx = -W + t * 3 * W;
    const shine = ctx.createLinearGradient(sx, 0, sx + W * 0.6, H * 0.4);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.9)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, W, H);
  }
  const R = seeded(hashOf(card.id) + 3);
  if (rarity === "legendaire" || rarity === "mythique") {
    // paillettes qui scintillent
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < (rarity === "mythique" ? 70 : 40); i++) {
      const px = R() * W, py = R() * H, phase = R() * Math.PI * 2;
      const tw = Math.max(0, Math.sin(t * Math.PI * 2 * 2 + phase));
      ctx.globalAlpha = 0.25 + 0.7 * tw;
      ctx.fillStyle = rarity === "mythique" ? (R() < 0.5 ? "#fde68a" : "#f9a8d4") : "#fde68a";
      const s = 1.2 + tw * 2.6;
      ctx.beginPath();
      ctx.moveTo(px, py - s * 2);
      ctx.lineTo(px + s * 0.5, py);
      ctx.lineTo(px, py + s * 2);
      ctx.lineTo(px - s * 0.5, py);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px - s * 2, py);
      ctx.lineTo(px, py + s * 0.5);
      ctx.lineTo(px + s * 2, py);
      ctx.lineTo(px, py - s * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  if (rarity === "mythique") {
    // voile de galaxie
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.5;
    const gx = ctx.createRadialGradient(W * (0.3 + 0.4 * t), H * 0.35, 20, W / 2, H / 2, W);
    gx.addColorStop(0, "#c026d3");
    gx.addColorStop(0.5, "#1e3a8a");
    gx.addColorStop(1, "#000000");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

async function drawCard(card, holo = false, t = 0.5) {
  const W = 600, H = 840;
  const m = METAL[card.rarity];
  const series = seriesOf(card);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // Cadre en métal
  const metal = metalGradient(ctx, W, H, m, (t - 0.5) * 0.4);
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = metal;
  ctx.fill();
  roundRect(ctx, 14, 14, W - 28, H - 28, 24);
  const inner = ctx.createLinearGradient(0, 0, 0, H);
  inner.addColorStop(0, "#1c0a0d");
  inner.addColorStop(1, "#0a0405");
  ctx.fillStyle = inner;
  ctx.fill();

  // Illustration pleine largeur
  const ax = 26, ay = 26, aw = W - 52, ah = 520;
  ctx.save();
  roundRect(ctx, ax, ay, aw, ah, 18);
  ctx.clip();
  drawScene(ctx, ax, ay, aw, ah, series, card.rarity, hashOf(card.id), t);

  if (card.avatar) {
    // médaillon du membre
    const img = await fetchImage(`avatar:${card.avatar}`, card.avatar);
    const cx = W / 2, cy = ay + ah * 0.52, r = 150;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 12, 0, 7);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.clip();
    if (img) ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  } else {
    const img = await artImage(card);
    if (img) {
      const size = 380;
      const bob = Math.sin(t * Math.PI * 2) * 6; // le sujet flotte légèrement
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 25;
      ctx.drawImage(img, W / 2 - size / 2, ay + ah - size - 22 + bob, size, size);
      ctx.restore();
    }
  }
  // dégradé sombre sous le nom
  const band = ctx.createLinearGradient(0, ay, 0, ay + 110);
  band.addColorStop(0, "rgba(0,0,0,0.75)");
  band.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = band;
  ctx.fillRect(ax, ay, aw, 110);
  ctx.restore();

  // Nom et numéro
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  const size = fitText(ctx, card.name, W - 200, 48, "CardTitle");
  ctx.font = `${size}px CardTitle`;
  ctx.fillText(card.name, 50, 86);
  ctx.shadowBlur = 0;
  ctx.font = "20px CardBold";
  ctx.fillStyle = m[0];
  ctx.textAlign = "right";
  ctx.fillText(numberOf(card), W - 50, 82);
  ctx.textAlign = "left";
  ctx.lineWidth = 5;
  ctx.strokeStyle = metal;
  roundRect(ctx, ax, ay, aw, ah, 18);
  ctx.stroke();

  // Plaque de rareté
  roundRect(ctx, W / 2 - 140, ay + ah - 22, 280, 44, 22);
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.fillStyle = "#1a0a0d";
  ctx.font = "22px CardBold";
  ctx.textAlign = "center";
  ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), W / 2, ay + ah + 8);
  ctx.textAlign = "left";

  // Statistiques en blocs
  const st = statsOf(card);
  [["PRESTIGE", st.prestige], ["INFLUENCE", st.influence], ["CHANCE", st.chance]].forEach(([label, value], i) => {
    const bx = 44 + i * 176, by = 590;
    roundRect(ctx, bx, by, 160, 86, 14);
    ctx.fillStyle = "#24100f";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = m[1];
    ctx.stroke();
    ctx.fillStyle = "#c9b8a8";
    ctx.font = "15px CardBold";
    ctx.textAlign = "center";
    ctx.fillText(label, bx + 80, by + 28);
    ctx.fillStyle = "#ffffff";
    ctx.font = "38px CardTitle";
    ctx.fillText(String(value), bx + 80, by + 72);
    ctx.textAlign = "left";
  });

  // Texte d'ambiance et mention de série
  ctx.fillStyle = "#e9c46a";
  ctx.textAlign = "center";
  const textSize = fitText(ctx, card.text, W - 90, 22, "CardSerif");
  ctx.font = `${textSize}px CardSerif`;
  ctx.fillText(card.text, W / 2, holo ? 728 : 738);
  ctx.fillStyle = "#6b5a52";
  ctx.font = "15px CardText";
  ctx.fillText(`LES CARTES DE LA MAISON  ·  ${SERIES_LABELS[series].replace(/^\S+ /, "").toUpperCase()}`, W / 2, 790);
  ctx.textAlign = "left";

  // Badge holo
  if (holo) {
    const bx = W / 2 - 80, by = 744;
    roundRect(ctx, bx, by, 160, 24, 12);
    const badge = ctx.createLinearGradient(bx, by, bx + 160, by);
    ["#ff0080", "#ffe600", "#00e676", "#00b0ff"].forEach((c, i) => badge.addColorStop(i / 3, c));
    ctx.fillStyle = badge;
    ctx.fill();
    ctx.fillStyle = "#0d0507";
    ctx.font = "14px CardBold";
    ctx.textAlign = "center";
    ctx.fillText("HOLOGRAPHIQUE", W / 2, by + 17);
    ctx.textAlign = "left";
  }

  drawFoil(ctx, W, H, card, holo, t);
  return canvas;
}

// Animation 3D : la carte pivote, le reflet balaie la feuille, les paillettes scintillent
const gifCache = new Map();
async function animatedCard(card, holo) {
  const key = `${card.id}${holo ? "*" : ""}`;
  if (gifCache.has(key)) return gifCache.get(key);
  const FW = 420, FH = 588, PAD = 26, frames = 20;
  const enc = GIFEncoder();
  for (let f = 0; f < frames; f++) {
    const t = f / frames;
    const angle = Math.sin(t * Math.PI * 2) * 0.32;
    const src = await drawCard(card, holo, t);
    const c = createCanvas(FW + PAD * 2, FH + PAD * 2);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#313338";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(c.width / 2 + angle * 40, c.height - 14, FW * 0.42 * Math.cos(angle), 9, 0, 0, 7);
    ctx.fill();
    // perspective : bandes verticales plus hautes du côté qui s'avance
    const strips = 60, sw = src.width / strips, scaleX = Math.cos(angle);
    for (let i = 0; i < strips; i++) {
      const u = i / strips - 0.5;
      const depth = 1 + u * Math.sin(angle) * 0.35;
      const dh = FH * depth, dw = (FW / strips) * scaleX;
      ctx.drawImage(src, i * sw, 0, sw + 1, src.height, c.width / 2 + u * FW * scaleX, c.height / 2 - dh / 2, dw + 1, dh);
    }
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const palette = quantize(data, 256);
    enc.writeFrame(applyPalette(data, palette), c.width, c.height, { palette, delay: 70 });
  }
  enc.finish();
  const buffer = Buffer.from(enc.bytes());
  gifCache.set(key, buffer);
  if (gifCache.size > 30) gifCache.delete(gifCache.keys().next().value);
  return buffer;
}

// Fichier d'une carte : animé (GIF) pour les holo et les épiques ou mieux, sinon image fixe
async function cardFile(card, holo) {
  if (holo || ORDER.indexOf(card.rarity) >= ORDER.indexOf("epique")) {
    return new AttachmentBuilder(await animatedCard(card, holo), { name: "carte.gif" });
  }
  const canvas = await drawCard(card, holo);
  return new AttachmentBuilder(await canvas.encode("png"), { name: "carte.png" });
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
    const file = await cardFile(p.card, p.holo);
    await interaction
      .editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(parseInt(r.color.slice(1), 16))
            .setTitle(`${title} — carte ${i + 1}/${results.length}`)
            .setDescription(`${r.emoji} **${p.card.name}** — ${r.name}${p.holo ? " ✦ **HOLO**" : ""}${p.isNew ? "  🆕 **Nouvelle !**" : ""}`)
            .setImage(`attachment://${file.name}`),
        ],
        files: [file],
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
  const file = await cardFile(p.card, p.holo);
  const msg = await channelRef
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setDescription(`${r.emoji} ${user} vient d'obtenir **${p.card.name}** (${r.name}${p.holo ? " ✦ HOLO" : ""}) !`)
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
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
  const file = await cardFile(card, holo);
  const msg = await channelRef
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setTitle("✨ Une carte sauvage est apparue !")
          .setDescription(`${r.emoji} **${card.name}** — ${r.name}${holo ? " ✦ HOLO" : ""}\nLe premier qui clique l'attrape !`)
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
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
    const file = await cardFile(card, holo);
    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setTitle(card.name).setImage(`attachment://${file.name}`)],
      files: [file],
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
    const file = await cardFile(card, false);
    await interaction.update({
      content: `🔨 Vous avez fabriqué **${card.name}** pour ${cost} ✨ !`,
      components: [],
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setImage(`attachment://${file.name}`)],
      files: [file],
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
