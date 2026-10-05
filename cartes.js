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
const { createCanvas, loadImage, GlobalFonts, Path2D } = require("@napi-rs/canvas");
const { changeBalance, readBalance, formatEuro, refreshRichestLeaderboard } = require("./economie");
const { lawActive, lawParam } = require("./politique");
const { findOrCreateChannel, findOrCreateRole } = require("./salons");
const { deleteLater, MINUTE } = require("./nettoyage");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon des cartes est rangé à côté des annonces
const STATE_FILE = require("./data").dataFile("cartes-state.json");
const PANEL_TITLE = "🃏 Les Cartes de la Maison";

// --- Polices des cartes ---
const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["playfair-display-700.ttf", "CardSerif"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
  ["playfair-display-700-italic.ttf", "CardItalic"],
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
  state.packs ??= {}; // userId -> { « g1_standard »: nombre de boosters fermés }
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
    return { ...C(`co_${co.id}`, co.name, SECTOR_EMOJI[co.sector] ?? "🏢", rarity, `Entreprise de la Maison — ${Math.round(ca).toLocaleString("fr-FR")} € de CA.`), sector: co.sector };
  });
}

let memberCache = new Map(); // userId -> { name, avatar, stars, role, joinedAt, messages, balance }
function memberCards() {
  const s = load();
  return Object.keys(s.optIn)
    .filter((id) => memberCache.has(id))
    .map((id) => {
      const m = memberCache.get(id);
      const { rating, rarity, stats } = memberProfile(id, m);
      const text = m.role ? `${m.role.name} de la Maison${m.stars ? ` · Membre Star ${m.stars} fois` : ""}.` : "Membre de la Maison.";
      return { ...C(`mb_${id}`, m.name, "👤", rarity, text), avatar: m.avatar, memberId: id, role: m.role, rating, stars: m.stars, memberStats: stats, joinedAt: m.joinedAt };
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
  if (card.memberStats) return { prestige: card.memberStats.PRE, influence: Math.max(card.memberStats.STA, card.memberStats.ACT), chance: card.memberStats.CHA };
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

// --- Thèmes : chaque carte a son décor, ses particules et son animation ---
const TAU = Math.PI * 2;
const THEMES = {
  p_belleville: { scene: "aube", fx: "poussiere" },
  p_seine: { scene: "jour", fx: "bulles", water: true },
  p_metro: { scene: "metro", fx: "traits" },
  p_croissant: { scene: "aube", fx: "vapeur" },
  p_baguette: { scene: "jour", fx: "miettes" },
  p_cafe: { scene: "crepuscule", fx: "vapeur" },
  p_pigeon: { scene: "pluie", fx: "pluie" },
  p_marais: { scene: "nuit", fx: "lucioles" },
  p_montmartre: { scene: "aube", fx: "peinture" },
  p_champs: { scene: "nuit", fx: "lumieres" },
  p_bateau: { scene: "crepuscule", fx: "bulles", water: true },
  p_luxembourg: { scene: "jour", fx: "petales" },
  p_haussmann: { scene: "crepuscule", fx: "eclats" },
  p_notredame: { scene: "nuit", fx: "neige" },
  p_opera: { scene: "theatre", fx: "notes" },
  p_moulin: { scene: "theatre", fx: "confettis" },
  p_eiffel: { scene: "nuit", fx: "scintillement", anim: "tilt-v" },
  p_louvre: { scene: "crepuscule", fx: "eclats", water: true },
  p_catacombes: { scene: "souterrain", fx: "braises" },
  p_versailles: { scene: "palais", fx: "or", anim: "flip" },
  p_ame: { scene: "cosmos", fx: "orbes" },
  m_double: { scene: "nuitbleue", fx: "poussiere" },
  m_repas: { scene: "salon", fx: "vapeur" },
  m_valise: { scene: "bureau", fx: "poussiere" },
  m_contrat: { scene: "parchemin", fx: "or" },
  m_croupier: { scene: "casino", fx: "jetons" },
  m_urne: { scene: "bureau", fx: "bulletins" },
  m_airbnb: { scene: "jardin", fx: "petales" },
  m_facture: { scene: "parchemin", fx: "pieces" },
  m_suite: { scene: "salon", fx: "lumieres" },
  m_casino: { scene: "casino", fx: "jetons" },
  m_mairie: { scene: "jour", fx: "bulletins" },
  m_irf: { scene: "nuitbleue", fx: "scan" },
  m_cle: { scene: "or", fx: "eclats" },
  m_penthouse: { scene: "ville", fx: "lumieres" },
  m_code: { scene: "parchemin", fx: "or", anim: "tilt-v" },
  m_star: { scene: "theatre", fx: "etoiles" },
  m_jackpot: { scene: "casino", fx: "pieces", anim: "popout" },
  m_maire: { scene: "palais", fx: "confettis", anim: "flip" },
  m_papillon: { scene: "jardin", fx: "papillons", anim: "popout" },
  m_dictateur: { scene: "trone", fx: "eclairs", anim: "popout" },
  m_fondation: { scene: "cosmos", fx: "orbes" },
  ev_star: { scene: "feux", fx: "etoiles" },
  ev_maire: { scene: "feux", fx: "bulletins", anim: "flip" },
  ev_jackpot: { scene: "casino", fx: "billets", anim: "popout" },
};
const SECTOR_THEMES = {
  transport: { scene: "pluie", fx: "pluie" },
  restauration: { scene: "salon", fx: "vapeur" },
  garage: { scene: "atelier", fx: "etincelles" },
  beaute: { scene: "rose", fx: "petales" },
  evenementiel: { scene: "feux", fx: "confettis" },
  securite: { scene: "nuitbleue", fx: "gyrophare" },
  media: { scene: "theatre", fx: "flashs" },
  immobilier: { scene: "ville", fx: "lumieres" },
  commerce: { scene: "ville", fx: "pieces" },
};
function themeOf(card) {
  if (THEMES[card.id]) return THEMES[card.id];
  const series = seriesOf(card);
  if (series === "entreprises") return SECTOR_THEMES[card.sector] ?? { scene: "ville", fx: "lumieres" };
  if (series === "membres") return { scene: "theatre", fx: ORDER.indexOf(card.rarity) >= ORDER.indexOf("legendaire") ? "etoiles" : "confettis" };
  if (series === "paris") return { scene: "crepuscule", fx: "poussiere" };
  if (series === "maison") return { scene: "salon", fx: "poussiere" };
  return { scene: "feux", fx: "etoiles" };
}
// Style d'animation : flottement (rare), pivot (épique), sortie du cadre ou retournement (légendaire), ascension (mythique)
function animMode(card, holo) {
  const theme = themeOf(card);
  if (theme.anim) return theme.anim;
  const rank = ORDER.indexOf(card.rarity);
  if (rank >= ORDER.indexOf("mythique")) return "ascension";
  if (rank >= ORDER.indexOf("legendaire")) return hashOf(card.id) % 2 ? "flip" : "popout";
  if (rank >= ORDER.indexOf("epique")) return hashOf(card.id) % 2 ? "tilt-v" : "tilt-h";
  return holo ? "tilt-h" : "float";
}
const HOLO_KINDS = { arcenciel: "HOLO ARC-EN-CIEL", givre: "HOLO GIVRÉ", cosmos: "HOLO COSMOS" };
function holoKind(card) {
  return Object.keys(HOLO_KINDS)[hashOf(card.id) % 3];
}

// --- Petits outils de dessin ---
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function glow(ctx, x, y, r, hex, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a));
  g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}
function sky(ctx, b, colors) {
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}
function sparkle(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2);
  ctx.lineTo(x + s * 0.4, y - s * 0.4);
  ctx.lineTo(x + s * 2, y);
  ctx.lineTo(x + s * 0.4, y + s * 0.4);
  ctx.lineTo(x, y + s * 2);
  ctx.lineTo(x - s * 0.4, y + s * 0.4);
  ctx.lineTo(x - s * 2, y);
  ctx.lineTo(x - s * 0.4, y - s * 0.4);
  ctx.closePath();
  ctx.fill();
}
function star5(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}
function stars(ctx, b, R, n, maxY, t) {
  for (let i = 0; i < n; i++) {
    const x = b.x + R() * b.w, y = b.y + R() * b.h * maxY, s = R() * 1.6 + 0.4, ph = R();
    ctx.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * (t * 2 + ph)));
    disc(ctx, x, y, s, "#ffffff");
  }
  ctx.globalAlpha = 1;
}
function cloud(ctx, x, y, s, color = "rgba(255,255,255,0.85)") {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const [dx, dy, r] of [[0, 0, 26], [28, -12, 30], [58, 0, 24], [30, 8, 26]]) {
    ctx.moveTo(x + dx * s + r * s, y + dy * s);
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
  }
  ctx.fill();
}
function moon(ctx, x, y, r) {
  glow(ctx, x, y, r * 4, "#e0e7ff", 0.45);
  disc(ctx, x, y, r, "#f8fafc");
  ctx.fillStyle = "rgba(148,163,184,0.35)";
  for (const [dx, dy, rr] of [[-8, -6, 6], [9, 7, 5], [4, -12, 3]]) disc(ctx, x + dx, y + dy, rr, "rgba(148,163,184,0.35)");
}
// Toits de Paris : mansardes, cheminées, lucarnes allumées
function rooftops(ctx, b, R, bottom, color, windowColor, density, roofColor) {
  let cx = b.x - 10;
  const blocks = [];
  while (cx < b.x + b.w) {
    const bw = 34 + R() * 46, bh = 55 + R() * 85, top = bottom - bh;
    blocks.push({ x: cx, w: bw, top, chimney: R() < 0.65 ? cx + 10 + R() * (bw - 30) : null });
    cx += bw;
  }
  for (const k of blocks) {
    ctx.fillStyle = color;
    ctx.fillRect(k.x, k.top + 16, k.w + 1, bottom - k.top - 16);
    ctx.fillStyle = roofColor ?? color;
    ctx.beginPath();
    ctx.moveTo(k.x, k.top + 17);
    ctx.lineTo(k.x + 9, k.top);
    ctx.lineTo(k.x + k.w - 9, k.top);
    ctx.lineTo(k.x + k.w + 1, k.top + 17);
    ctx.closePath();
    ctx.fill();
    if (k.chimney) ctx.fillRect(k.chimney, k.top - 14, 8, 15);
    if (!windowColor) continue;
    ctx.fillStyle = windowColor;
    for (let wx = k.x + 14; wx < k.x + k.w - 14; wx += 16) if (R() < density * 1.4) ctx.fillRect(wx, k.top + 5, 5, 7);
    for (let wy = k.top + 28; wy < bottom - 10; wy += 20) {
      for (let wx = k.x + 8; wx < k.x + k.w - 10; wx += 13) if (R() < density) ctx.fillRect(wx, wy, 5, 9);
    }
  }
}
function water(ctx, b, top, t, colors) {
  const g = ctx.createLinearGradient(0, top, 0, b.y + b.h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fillRect(b.x, top, b.w, b.y + b.h - top);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 1.5;
  const rows = 8;
  for (let k = 0; k < rows; k++) {
    const yy = top + 6 + (k * (b.y + b.h - top - 6)) / rows;
    ctx.beginPath();
    for (let x = b.x; x <= b.x + b.w; x += 8) {
      const y = yy + Math.sin(x / (16 + k * 3) + TAU * t + k) * (1.2 + k * 0.35);
      if (x === b.x) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
function towers(ctx, b, R, t, bottom) {
  let cx = b.x;
  while (cx < b.x + b.w) {
    const bw = 34 + R() * 46, bh = 140 + R() * 230;
    ctx.fillStyle = "#0a0f24";
    ctx.fillRect(cx, bottom - bh, bw - 4, bh);
    if (R() < 0.3) ctx.fillRect(cx + bw / 2 - 3, bottom - bh - 26, 3, 26);
    for (let wy = bottom - bh + 10; wy < bottom - 10; wy += 16) {
      for (let wx = cx + 6; wx < cx + bw - 12; wx += 12) {
        if (R() < 0.45) {
          ctx.fillStyle = R() < 0.8 ? "rgba(253,224,71,0.85)" : "rgba(147,197,253,0.9)";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    cx += bw;
  }
}

// --- Décors ---
const SCENES = {
  aube(ctx, b, t, R, ground) {
    sky(ctx, b, ["#312e81", "#be185d", "#fb923c", "#fde68a"]);
    stars(ctx, b, R, 14, 0.3, t);
    glow(ctx, b.x + b.w * 0.7, ground - 70, 170, "#fde68a", 0.85);
    disc(ctx, b.x + b.w * 0.7, ground - 70, 38, "#fff7d6");
    rooftops(ctx, b, R, ground, "#3b1d4a", "rgba(253,224,71,0.8)", 0.1, "#4c2a5e");
  },
  jour(ctx, b, t, R, ground) {
    sky(ctx, b, ["#0284c7", "#7dd3fc", "#e0f2fe"]);
    glow(ctx, b.x + b.w * 0.82, b.y + 95, 150, "#fef9c3", 0.9);
    disc(ctx, b.x + b.w * 0.82, b.y + 95, 32, "#fffbeb");
    for (let i = 0; i < 4; i++) cloud(ctx, b.x + R() * b.w * 0.9 + Math.sin(TAU * (t + i / 4)) * 10, b.y + 70 + R() * 150, 0.6 + R() * 0.6);
    rooftops(ctx, b, R, ground, "#e7dcc8", "rgba(71,85,105,0.55)", 0.5, "#64748b");
  },
  crepuscule(ctx, b, t, R, ground) {
    sky(ctx, b, ["#1e1b4b", "#9d174d", "#fb923c"]);
    stars(ctx, b, R, 40, 0.45, t);
    rooftops(ctx, b, R, ground, "#1a1033", "rgba(251,191,36,0.85)", 0.22);
  },
  nuit(ctx, b, t, R, ground) {
    sky(ctx, b, ["#020617", "#1e1b4b", "#3730a3"]);
    stars(ctx, b, R, 70, 0.6, t);
    moon(ctx, b.x + b.w * 0.2, b.y + 95, 28);
    rooftops(ctx, b, R, ground, "#0b0716", "rgba(253,224,71,0.9)", 0.35);
  },
  pluie(ctx, b, t, R, ground) {
    sky(ctx, b, ["#1e293b", "#475569", "#94a3b8"]);
    for (let i = 0; i < 5; i++) cloud(ctx, b.x + R() * b.w + Math.sin(TAU * (t + i / 5)) * 8, b.y + 30 + R() * 90, 1 + R() * 0.6, "rgba(30,41,59,0.8)");
    rooftops(ctx, b, R, ground, "#1e293b", "rgba(253,224,71,0.7)", 0.18);
    const g = ctx.createLinearGradient(0, ground - 70, 0, ground);
    g.addColorStop(0, "rgba(148,163,184,0)");
    g.addColorStop(1, "rgba(148,163,184,0.3)");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, ground - 70, b.w, 70);
  },
  metro(ctx, b, t, R) {
    const cx = b.x + b.w / 2;
    ctx.fillStyle = "#0b1120";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, b.y + b.h, b.w * 0.62, b.h * 0.95, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.clip();
    for (let yy = b.y, row = 0; yy < b.y + b.h; yy += 16, row++) {
      for (let xx = b.x - 14 + (row % 2) * 14; xx < b.x + b.w; xx += 28) {
        const d = Math.min(1, Math.abs(xx + 12 - cx) / (b.w / 2));
        ctx.fillStyle = `rgba(226,232,240,${0.8 - d * 0.5})`;
        roundRect(ctx, xx, yy, 25, 13, 4);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#be418d";
    ctx.fillRect(b.x, b.y + b.h * 0.58, b.w, 12);
    ctx.restore();
    ctx.fillStyle = "#020617";
    ctx.beginPath();
    ctx.ellipse(cx, b.y + b.h, b.w * 0.27, b.h * 0.44, 0, Math.PI, TAU);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + ((i + 0.5) / 7) * Math.PI;
      glow(ctx, cx + Math.cos(a) * b.w * 0.5, b.y + b.h + Math.sin(a) * b.h * 0.82, 28, "#fef3c7", 0.9);
    }
    ctx.fillStyle = "#facc15";
    ctx.fillRect(b.x, b.y + b.h - 18, b.w, 5);
  },
  theatre(ctx, b, t, R) {
    ctx.fillStyle = "#14060a";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    glow(ctx, b.x + b.w / 2, b.y + b.h * 0.5, b.w * 0.6, "#fff4d6", 0.62 + 0.08 * Math.sin(TAU * t));
    const floor = ctx.createLinearGradient(0, b.y + b.h * 0.82, 0, b.y + b.h);
    floor.addColorStop(0, "#5b2a0e");
    floor.addColorStop(1, "#1c0a03");
    ctx.fillStyle = floor;
    ctx.fillRect(b.x, b.y + b.h * 0.82, b.w, b.h * 0.18);
    for (const side of [0, 1]) {
      for (let i = 0; i < 6; i++) {
        const x = side ? b.x + b.w - 100 + i * 17 : b.x + i * 17;
        const fold = ctx.createLinearGradient(x, 0, x + 17, 0);
        fold.addColorStop(0, "#7f1d1d");
        fold.addColorStop(0.5, "#dc2626");
        fold.addColorStop(1, "#450a0a");
        ctx.fillStyle = fold;
        ctx.fillRect(x, b.y, 17, b.h);
      }
    }
    ctx.fillStyle = "#991b1b";
    ctx.fillRect(b.x, b.y, b.w, 30);
    for (let x = b.x; x < b.x + b.w; x += 46) {
      ctx.beginPath();
      ctx.arc(x + 23, b.y + 30, 23, 0, Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = b.x; x < b.x + b.w; x += 46) ctx.arc(x + 23, b.y + 30, 23, 0, Math.PI);
    ctx.stroke();
  },
  souterrain(ctx, b, t, R) {
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    for (let y = b.y, row = 0; y < b.y + b.h; y += 26, row++) {
      for (let x = b.x - 26 * (row % 2); x < b.x + b.w; x += 52) {
        ctx.fillStyle = R() < 0.5 ? "#44403c" : "#3a3530";
        roundRect(ctx, x + 2, y + 2, 48, 22, 4);
        ctx.fill();
      }
    }
    for (let row = 0; row < 2; row++) {
      for (let x = b.x + 14 + row * 12; x < b.x + b.w; x += 26) {
        const y = b.y + b.h - 30 - row * 24;
        disc(ctx, x, y, 10, "rgba(214,211,209,0.55)");
        disc(ctx, x - 4, y - 1, 2.6, "#1c1917");
        disc(ctx, x + 4, y - 1, 2.6, "#1c1917");
      }
    }
    for (let i = 0; i < 3; i++) {
      const x = b.x + 70 + i * ((b.w - 140) / 2), y = b.y + 150 + (i % 2) * 40;
      glow(ctx, x, y, 80 + 8 * Math.sin(TAU * (t * 3 + i / 3)), "#f97316", 0.5);
      ctx.fillStyle = "#e7e5e4";
      ctx.fillRect(x - 5, y + 6, 10, 34);
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 10 + 2 * Math.sin(TAU * (t * 4 + i / 3)), 0, 0, TAU);
      ctx.fill();
    }
  },
  palais(ctx, b, t, R) {
    sky(ctx, b, ["#3b2105", "#78350f", "#b45309"]);
    const n = 3, mw = 130, gap = (b.w - n * mw) / (n + 1);
    for (let i = 0; i < n; i++) {
      const x = b.x + gap + i * (mw + gap), y = b.y + 80, h = 300;
      const mg = ctx.createLinearGradient(x, y, x + mw, y + h);
      mg.addColorStop(0, "#fff7d6");
      mg.addColorStop(0.5, "#e0b44a");
      mg.addColorStop(1, "#7c4a03");
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x, y + mw / 2);
      ctx.arc(x + mw / 2, y + mw / 2, mw / 2, Math.PI, TAU);
      ctx.lineTo(x + mw, y + h);
      ctx.closePath();
      ctx.globalAlpha = 0.75;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    const fy = b.y + b.h * 0.76;
    for (let r = 0; r < 6; r++) {
      const y0 = fy + ((b.y + b.h - fy) * (r * r)) / 36, y1 = fy + ((b.y + b.h - fy) * ((r + 1) * (r + 1))) / 36;
      for (let c = -8; c < 8; c++) {
        ctx.fillStyle = (r + c) % 2 ? "#f5e6c8" : "#292524";
        const spread0 = 1 + r * 0.5, spread1 = 1 + (r + 1) * 0.5, cx = b.x + b.w / 2, cw = 34;
        ctx.beginPath();
        ctx.moveTo(cx + c * cw * spread0, y0);
        ctx.lineTo(cx + (c + 1) * cw * spread0, y0);
        ctx.lineTo(cx + (c + 1) * cw * spread1, y1);
        ctx.lineTo(cx + c * cw * spread1, y1);
        ctx.fill();
      }
    }
    for (let i = 0; i < 3; i++) glow(ctx, b.x + gap + mw / 2 + i * (mw + gap), b.y + 40, 70, "#fde68a", 0.6 + 0.15 * Math.sin(TAU * (t + i / 3)));
  },
  cosmos(ctx, b, t, R) {
    ctx.fillStyle = "#05010f";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.45;
    glow(ctx, cx - 120 + Math.sin(TAU * t) * 15, cy - 60, 260, "#c026d3", 0.45);
    glow(ctx, cx + 140, cy + 40 + Math.cos(TAU * t) * 15, 240, "#0ea5e9", 0.38);
    glow(ctx, cx, cy, 120, "#fde68a", 0.3);
    stars(ctx, b, R, 90, 1, t);
    for (let i = 0; i < 260; i++) {
      const arm = i % 2 ? Math.PI : 0, a = arm + i * 0.045 + Math.sin(TAU * t) * 0.12, r = 6 + i * 1.05;
      const x = cx + Math.cos(a) * r * 1.25 + (R() - 0.5) * 18, y = cy + Math.sin(a) * r * 0.45 + (R() - 0.5) * 10;
      ctx.globalAlpha = 0.25 + 0.6 * R();
      disc(ctx, x, y, R() * 1.6 + 0.4, R() < 0.3 ? "#f0abfc" : "#e0f2fe");
    }
    ctx.globalAlpha = 1;
  },
  salon(ctx, b, t, R) {
    const wall = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.4, 20, b.x + b.w / 2, b.y + b.h / 2, b.w);
    wall.addColorStop(0, "#7f1d1d");
    wall.addColorStop(1, "#1a0508");
    ctx.fillStyle = wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(251,191,36,0.12)";
    ctx.lineWidth = 2;
    for (let x = b.x + 30; x < b.x + b.w; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x, b.y + b.h * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(b.x, b.y + b.h * 0.7, b.w, b.h * 0.3);
    ctx.fillStyle = "rgba(251,191,36,0.35)";
    ctx.fillRect(b.x, b.y + b.h * 0.7, b.w, 3);
    for (let i = 0; i < 18; i++) {
      const bx = b.x + R() * b.w, by = b.y + R() * b.h, br = (10 + R() * 30) * (0.9 + 0.1 * Math.sin(TAU * (t * 2 + i / 18)));
      glow(ctx, bx, by, br, "#fde047", 0.5);
    }
  },
  nuitbleue(ctx, b, t, R) {
    sky(ctx, b, ["#0f172a", "#1e3a8a", "#0b1020"]);
    const wx = b.x + 50, wy = b.y + 70, ww = 150, wh = 220;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx, wy + ww / 2);
    ctx.arc(wx + ww / 2, wy + ww / 2, ww / 2, Math.PI, TAU);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.closePath();
    ctx.clip();
    sky(ctx, { x: wx, y: wy, w: ww, h: wh }, ["#020617", "#1e1b4b"]);
    stars(ctx, { x: wx, y: wy, w: ww, h: wh }, R, 25, 1, t);
    moon(ctx, wx + ww * 0.62, wy + 70, 18);
    ctx.restore();
    ctx.strokeStyle = "#0b1020";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh * 0.5);
    ctx.lineTo(wx + ww, wy + wh * 0.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(191,219,254,0.1)";
    ctx.beginPath();
    ctx.moveTo(wx, wy + wh);
    ctx.lineTo(wx + ww, wy + wh);
    ctx.lineTo(wx + ww + 260, b.y + b.h);
    ctx.lineTo(wx + 120, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  },
  bureau(ctx, b, t, R) {
    for (let x = b.x; x < b.x + b.w; x += 46) {
      const g = ctx.createLinearGradient(x, 0, x + 46, 0);
      const base = R() < 0.5 ? ["#78350f", "#92400e"] : ["#6b2f0b", "#854010"];
      g.addColorStop(0, base[0]);
      g.addColorStop(0.5, base[1]);
      g.addColorStop(1, base[0]);
      ctx.fillStyle = g;
      ctx.fillRect(x, b.y, 46, b.h);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(x, b.y, 2, b.h);
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(b.x, b.y + b.h * 0.62, b.w, b.h * 0.38);
    ctx.fillStyle = "#3f1d0b";
    ctx.fillRect(b.x, b.y + b.h * 0.62, b.w, 10);
    glow(ctx, b.x + b.w - 90, b.y + 110, 230, "#fcd34d", 0.42 + 0.05 * Math.sin(TAU * t));
  },
  parchemin(ctx, b, t, R) {
    sky(ctx, b, ["#fdf6e3", "#ecd9ae", "#d8b77c"]);
    ctx.strokeStyle = "rgba(120,53,15,0.18)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 16; k++) {
      const y = b.y + 50 + k * 28;
      ctx.beginPath();
      for (let x = b.x + 40; x < b.x + b.w - 40; x += 10) {
        const yy = y + Math.sin(x / 9 + k * 3) * 2;
        if (x === b.x + 40) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    const burn = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, b.h * 0.3, b.x + b.w / 2, b.y + b.h / 2, b.h * 0.75);
    burn.addColorStop(0, "rgba(120,53,15,0)");
    burn.addColorStop(1, "rgba(92,40,10,0.6)");
    ctx.fillStyle = burn;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    disc(ctx, b.x + 70, b.y + b.h - 70, 30, "#b91c1c");
    ctx.strokeStyle = "#7f1d1d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(b.x + 70, b.y + b.h - 70, 20, 0, TAU);
    ctx.stroke();
  },
  casino(ctx, b, t, R) {
    const felt = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.45, 30, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8);
    felt.addColorStop(0, "#16a34a");
    felt.addColorStop(1, "#052e16");
    ctx.fillStyle = felt;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let k = -b.h; k < b.w; k += 34) {
      ctx.beginPath();
      ctx.moveTo(b.x + k, b.y);
      ctx.lineTo(b.x + k + b.h, b.y + b.h);
      ctx.moveTo(b.x + k + b.h, b.y);
      ctx.lineTo(b.x + k, b.y + b.h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(254,243,199,0.1)";
    ctx.beginPath();
    ctx.moveTo(b.x + b.w / 2 - 50, b.y);
    ctx.lineTo(b.x + b.w / 2 + 50, b.y);
    ctx.lineTo(b.x + b.w / 2 + 230, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2 - 230, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    glow(ctx, b.x + b.w / 2, b.y, 120, "#fef3c7", 0.7);
    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h + 40, b.w * 0.75, 90, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 3;
    ctx.stroke();
  },
  or(ctx, b, t, R) {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.5, 10, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8);
    g.addColorStop(0, "#fde68a");
    g.addColorStop(0.45, "#d97706");
    g.addColorStop(1, "#451a03");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  },
  jardin(ctx, b, t, R) {
    sky(ctx, b, ["#ecfccb", "#86efac", "#166534"]);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.1 + 0.05 * Math.sin(TAU * (t + i / 5))})`;
      const x = b.x + 40 + i * 70;
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x + 34, b.y);
      ctx.lineTo(x + 200, b.y + b.h);
      ctx.lineTo(x + 120, b.y + b.h);
      ctx.closePath();
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const edge = i % 3, x = edge === 2 ? b.x + R() * b.w : edge ? b.x + b.w - R() * 90 : b.x + R() * 90;
      const y = edge === 2 ? b.y + b.h - R() * 70 : b.y + R() * b.h;
      disc(ctx, x, y, 18 + R() * 26, R() < 0.5 ? "rgba(21,128,61,0.85)" : "rgba(22,101,52,0.9)");
    }
    for (let i = 0; i < 16; i++) disc(ctx, b.x + R() * b.w, b.y + b.h - R() * 60, 4, R() < 0.5 ? "#f9a8d4" : "#fde047");
  },
  trone(ctx, b, t, R) {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.45, 20, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8);
    g.addColorStop(0, "#7f1d1d");
    g.addColorStop(1, "#0c0a09");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    for (const x of [b.x + 30, b.x + b.w - 100]) {
      const sway = Math.sin(TAU * t + x) * 3;
      ctx.fillStyle = "#991b1b";
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x + 70, b.y);
      ctx.lineTo(x + 70 + sway, b.y + 280);
      ctx.lineTo(x + 35 + sway, b.y + 250);
      ctx.lineTo(x + sway, b.y + 280);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 3;
      ctx.stroke();
      disc(ctx, x + 35 + sway / 2, b.y + 120, 18, "#fbbf24");
      disc(ctx, x + 35 + sway / 2, b.y + 120, 11, "#7f1d1d");
    }
    for (let i = 0; i < 6; i++) glow(ctx, b.x + R() * b.w + Math.sin(TAU * (t + i / 6)) * 20, b.y + b.h - 30, 90, "#450a0a", 0.6);
  },
  feux(ctx, b, t, R) {
    sky(ctx, b, ["#020617", "#1e1b4b", "#3b0764"]);
    stars(ctx, b, R, 40, 0.8, t);
    for (let f = 0; f < 5; f++) {
      const fx = b.x + 60 + R() * (b.w - 120), fy = b.y + 50 + R() * (b.h * 0.45), ph = R();
      const col = ["#fbbf24", "#f472b6", "#60a5fa", "#a3e635", "#f87171"][f];
      const q = (t + ph) % 1, ease = 1 - (1 - q) * (1 - q), rad = 20 + ease * 80;
      ctx.strokeStyle = col;
      ctx.globalAlpha = Math.max(0, 1 - q * 1.1);
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        ctx.beginPath();
        ctx.moveTo(fx + Math.cos(a) * rad * 0.55, fy + Math.sin(a) * rad * 0.55 + q * 14);
        ctx.lineTo(fx + Math.cos(a) * rad, fy + Math.sin(a) * rad + q * 18);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
  atelier(ctx, b, t, R) {
    sky(ctx, b, ["#3f3f46", "#27272a", "#18181b"]);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    for (let x = b.x; x < b.x + b.w; x += 110) {
      for (let y = b.y; y < b.y + b.h; y += 130) {
        ctx.strokeRect(x + 2, y + 2, 106, 126);
        for (const [dx, dy] of [[10, 10], [98, 10], [10, 118], [98, 118]]) disc(ctx, x + dx, y + dy, 3, "#71717a");
      }
    }
    glow(ctx, b.x + b.w / 2, b.y + b.h, 300, "#f97316", 0.35 + 0.1 * Math.sin(TAU * t * 2));
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y + b.h - 24, b.w, 24);
    ctx.clip();
    ctx.fillStyle = "#facc15";
    ctx.fillRect(b.x, b.y + b.h - 24, b.w, 24);
    ctx.fillStyle = "#18181b";
    for (let x = b.x - 30; x < b.x + b.w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, b.y + b.h);
      ctx.lineTo(x + 18, b.y + b.h);
      ctx.lineTo(x + 42, b.y + b.h - 24);
      ctx.lineTo(x + 24, b.y + b.h - 24);
      ctx.fill();
    }
    ctx.restore();
  },
  rose(ctx, b, t, R) {
    const g = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h * 0.4, 20, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.8);
    g.addColorStop(0, "#fbcfe8");
    g.addColorStop(0.5, "#be185d");
    g.addColorStop(1, "#4a044e");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    for (let i = 0; i < 16; i++) glow(ctx, b.x + R() * b.w, b.y + R() * b.h, 14 + R() * 30, R() < 0.5 ? "#fdf2f8" : "#f9a8d4", 0.4 + 0.15 * Math.sin(TAU * (t + i / 16)));
  },
  ville(ctx, b, t, R, ground) {
    sky(ctx, b, ["#0b1026", "#1e1b4b", "#1d4ed8"]);
    stars(ctx, b, R, 30, 0.4, t);
    for (const [x0, ph] of [[b.x + b.w * 0.25, 0], [b.x + b.w * 0.75, 0.5]]) {
      const a = -Math.PI / 2 + Math.sin(TAU * (t + ph)) * 0.45;
      ctx.fillStyle = "rgba(191,219,254,0.12)";
      ctx.beginPath();
      ctx.moveTo(x0, ground);
      ctx.lineTo(x0 + Math.cos(a - 0.08) * 700, ground + Math.sin(a - 0.08) * 700);
      ctx.lineTo(x0 + Math.cos(a + 0.08) * 700, ground + Math.sin(a + 0.08) * 700);
      ctx.closePath();
      ctx.fill();
    }
    towers(ctx, b, R, t, ground);
  },
};
const NO_RAYS = new Set(["parchemin", "jour", "metro", "pluie"]);

function drawScene(ctx, b, theme, card, t) {
  const R = seeded(hashOf(card.id));
  const ground = theme.water ? b.y + b.h * 0.8 : b.y + b.h;
  (SCENES[theme.scene] ?? SCENES.salon)(ctx, b, t, R, ground);
  if (theme.water) water(ctx, b, ground, t, ["#1e3a8a", "#0b1026"]);
  // rayons lumineux derrière le sujet (rare et plus) ; un tour de rayon par boucle pour une animation sans saut
  if (ORDER.indexOf(card.rarity) >= ORDER.indexOf("rare") && !NO_RAYS.has(theme.scene)) {
    ctx.save();
    ctx.globalAlpha = theme.scene === "or" ? 0.28 : 0.15;
    ctx.translate(b.x + b.w / 2, b.y + b.h * 0.55);
    ctx.rotate((t * TAU) / 16);
    ctx.fillStyle = theme.scene === "or" ? "#fff7d6" : METAL[card.rarity][4];
    for (let i = 0; i < 16; i++) {
      ctx.rotate(TAU / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-18, -b.w);
      ctx.lineTo(18, -b.w);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  // vignette
  const v = ctx.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, b.h * 0.35, b.x + b.w / 2, b.y + b.h / 2, b.h * 0.8);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(b.x, b.y, b.w, b.h);
}

// --- Particules (deux couches : derrière et devant le sujet) ---
// Chaque mouvement boucle exactement sur t ∈ [0, 1) pour que le GIF tourne sans saut.
const loop = (base, t, speed) => (((base + t * speed) % 1) + 1) % 1;
const FX = {
  poussiere: { n: 40, draw(ctx, b, t, p) {
    ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5 * Math.sin(TAU * (t + p[2])));
    disc(ctx, b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 10, b.y + p[1] * b.h + Math.cos(TAU * (t + p[3])) * 12, 1 + p[3] * 2, "#fde68a");
  } },
  bulles: { n: 26, draw(ctx, b, t, p) {
    const x = b.x + p[0] * b.w + Math.sin(TAU * (2 * t + p[2])) * 6, y = b.y + b.h * (1 - loop(p[1], t, 1)), r = 3 + p[3] * 7;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    disc(ctx, x - r * 0.35, y - r * 0.35, r * 0.25, "rgba(255,255,255,0.8)");
  } },
  traits: { n: 18, draw(ctx, b, t, p) {
    const x = b.x - 120 + loop(p[0], t, 2) * (b.w + 240), y = b.y + 40 + p[1] * b.h * 0.8, len = 60 + p[2] * 90;
    const g = ctx.createLinearGradient(x - len, 0, x, 0);
    g.addColorStop(0, "rgba(254,243,199,0)");
    g.addColorStop(1, p[3] < 0.5 ? "rgba(254,243,199,0.8)" : "rgba(244,114,182,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(x - len, y, len, 3);
  } },
  vapeur: { n: 14, draw(ctx, b, t, p, a) {
    const q = loop(p[0], t, 1);
    const x = a.cx + (p[1] - 0.5) * 90 + Math.sin(TAU * (q * 1.5 + p[2])) * 18, y = a.top + 60 - q * 170;
    glow(ctx, x, y, 14 + q * 34, "#ffffff", (1 - q) * 0.35 * Math.min(1, q * 6));
  } },
  miettes: { n: 30, draw(ctx, b, t, p) {
    ctx.fillStyle = p[3] < 0.5 ? "#d4a056" : "#f5d08a";
    ctx.save();
    ctx.translate(b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 5, b.y + loop(p[1], t, 1) * b.h);
    ctx.rotate(TAU * (t + p[2]));
    ctx.fillRect(-2.5, -1.5, 5, 3);
    ctx.restore();
  } },
  pluie: { n: 70, draw(ctx, b, t, p) {
    const y = b.y - 20 + loop(p[1], t, 3) * (b.h + 40), x = b.x + p[0] * (b.w + 80) - (y - b.y) * 0.15;
    ctx.strokeStyle = "rgba(203,213,225,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + 18);
    ctx.stroke();
  } },
  lucioles: { n: 24, draw(ctx, b, t, p) {
    const x = b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 18, y = b.y + b.h * (0.3 + p[1] * 0.7) + Math.cos(TAU * (t + p[3])) * 12;
    const blink = Math.max(0, Math.sin(TAU * (t * 2 + p[2]))) ** 2;
    glow(ctx, x, y, 14, "#d9f99d", 0.8 * blink);
    disc(ctx, x, y, 1.8, `rgba(236,252,203,${blink})`);
  } },
  peinture: { n: 22, draw(ctx, b, t, p) {
    const col = ["#ef4444", "#3b82f6", "#facc15", "#22c55e", "#ec4899"][Math.floor(p[3] * 5)];
    const x = b.x + p[0] * b.w, y = b.y + p[1] * b.h + Math.sin(TAU * (t + p[2])) * 14, r = 4 + p[2] * 6;
    disc(ctx, x, y, r * (0.9 + 0.1 * Math.sin(TAU * (t * 2 + p[0]))), col);
    disc(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, "rgba(255,255,255,0.6)");
  } },
  lumieres: { n: 22, draw(ctx, b, t, p) {
    glow(ctx, b.x + p[0] * b.w + Math.sin(TAU * (t + p[3])) * 25, b.y + p[1] * b.h, 10 + p[2] * 24, p[3] < 0.6 ? "#fde68a" : "#ffffff", 0.35 + 0.2 * Math.sin(TAU * (t * 2 + p[2])));
  } },
  petales: { n: 24, draw(ctx, b, t, p) {
    ctx.save();
    ctx.translate(b.x + p[0] * b.w + Math.sin(TAU * (t * 2 + p[2])) * 20, b.y - 15 + loop(p[1], t, 1) * (b.h + 30));
    ctx.rotate(TAU * (t * (p[3] < 0.5 ? 1 : -1) + p[2]));
    ctx.fillStyle = p[3] < 0.5 ? "#f9a8d4" : "#fbcfe8";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 4, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } },
  eclats: { n: 16, draw(ctx, b, t, p) {
    const s = Math.max(0, Math.sin(TAU * (t * 2 + p[2]))) ** 3 * (5 + p[3] * 7);
    if (s > 0.3) sparkle(ctx, b.x + p[0] * b.w, b.y + p[1] * b.h, s, "rgba(255,255,255,0.95)");
  } },
  neige: { n: 50, draw(ctx, b, t, p) {
    ctx.globalAlpha = 0.85;
    disc(ctx, b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 12, b.y - 6 + loop(p[1], t, 1) * (b.h + 12), 1.5 + p[3] * 2.5, "#ffffff");
  } },
  notes: { n: 12, draw(ctx, b, t, p) {
    const q = loop(p[1], t, 1), x = b.x + p[0] * b.w + Math.sin(TAU * (q * 2 + p[2])) * 15, y = b.y + b.h * (1 - q);
    ctx.globalAlpha = Math.sin(Math.PI * q);
    ctx.fillStyle = "#fde68a";
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5, -0.4, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 6, y - 2);
    ctx.lineTo(x + 6, y - 28);
    ctx.quadraticCurveTo(x + 14, y - 22, x + 16, y - 14);
    ctx.stroke();
  } },
  confettis: { n: 40, draw(ctx, b, t, p) {
    ctx.save();
    ctx.translate(b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 12, b.y - 10 + loop(p[1], t, 1) * (b.h + 20));
    const rot = TAU * (t * 2 * (p[3] < 0.5 ? 1 : -1) + p[2]);
    ctx.rotate(rot);
    ctx.scale(1, Math.cos(rot * 1.5));
    ctx.fillStyle = ["#f472b6", "#fbbf24", "#60a5fa", "#a3e635", "#f87171", "#c084fc"][Math.floor(p[3] * 6)];
    ctx.fillRect(-5, -2.5, 10, 5);
    ctx.restore();
  } },
  scintillement: { n: 40, draw(ctx, b, t, p, a) {
    const y = a.top + 20 + p[1] * a.size * 0.85, x = a.cx + (p[0] - 0.5) * a.size * 0.7 * (0.12 + 0.88 * p[1]);
    const s = Math.max(0, Math.sin(TAU * (t * 3 + p[2]))) ** 4 * (3 + p[3] * 5);
    if (s > 0.3) sparkle(ctx, x, y, s, p[3] < 0.5 ? "#ffffff" : "#dbeafe");
  } },
  braises: { n: 30, draw(ctx, b, t, p) {
    const q = loop(p[1], t, 1), x = b.x + p[0] * b.w + Math.sin(TAU * (q + p[2])) * 14, y = b.y + b.h * (1 - q);
    glow(ctx, x, y, 8, "#f97316", (1 - q) * 0.8);
    disc(ctx, x, y, 1.5 + p[2] * 1.5, `rgba(254,215,170,${1 - q})`);
  } },
  or: { n: 45, draw(ctx, b, t, p) {
    const s = 0.8 + Math.max(0, Math.sin(TAU * (t * 2 + p[2]))) * 2.2;
    sparkle(ctx, b.x + p[0] * b.w + Math.sin(TAU * (t + p[3])) * 8, b.y + loop(p[1], t, 1) * b.h, s, "rgba(253,230,138,0.9)");
  } },
  orbes: { n: 12, layered: true, draw(ctx, b, t, p, a, layer, i) {
    const ang = TAU * (t * (i % 3 ? 1 : -1) + p[0]), rx = a.size * 0.42 + p[1] * 80, ry = rx * 0.32;
    if ((Math.sin(ang) > 0 ? 1 : 0) !== layer) return;
    const x = a.cx + Math.cos(ang) * rx, y = a.cy + Math.sin(ang) * ry, col = ["#e879f9", "#67e8f9", "#fde68a"][i % 3];
    glow(ctx, x, y, 18 + p[2] * 12, col, 0.8);
    disc(ctx, x, y, 3 + p[2] * 2, "#ffffff");
  } },
  bulletins: { n: 14, draw(ctx, b, t, p) {
    ctx.save();
    ctx.translate(b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 16, b.y - 15 + loop(p[1], t, 1) * (b.h + 30));
    ctx.rotate(Math.sin(TAU * (t * 2 + p[3])) * 0.6);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-8, -3, 16, 2);
    ctx.fillRect(-8, 2, 10, 2);
    ctx.restore();
  } },
  pieces: { n: 18, draw(ctx, b, t, p) {
    const x = b.x + p[0] * b.w, y = b.y - 20 + loop(p[1], t, 1) * (b.h + 40), spin = Math.cos(TAU * (t * 2 + p[2]));
    const g = ctx.createLinearGradient(x - 12, y - 12, x + 12, y + 12);
    g.addColorStop(0, "#fef3c7");
    g.addColorStop(0.5, "#f59e0b");
    g.addColorStop(1, "#92400e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, Math.abs(spin) * 12 + 1.5, 12, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,53,15,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } },
  jetons: { n: 14, draw(ctx, b, t, p) {
    const x = b.x + p[0] * b.w, y = b.y - 20 + loop(p[1], t, 1) * (b.h + 40), spin = Math.abs(Math.cos(TAU * (t + p[2]))) * 14 + 2;
    const col = ["#dc2626", "#2563eb", "#111827", "#16a34a"][Math.floor(p[3] * 4)];
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y, spin, 14, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, spin - 3), 11, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  } },
  scan: { n: 1, draw(ctx, b, t, p, a, layer) {
    if (layer !== 1) return;
    ctx.strokeStyle = "rgba(103,232,249,0.08)";
    ctx.lineWidth = 1;
    for (let x = b.x; x < b.x + b.w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, b.y);
      ctx.lineTo(x, b.y + b.h);
      ctx.stroke();
    }
    for (let y = b.y; y < b.y + b.h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.lineTo(b.x + b.w, y);
      ctx.stroke();
    }
    const y = b.y + loop(0, t, 1) * b.h, g = ctx.createLinearGradient(0, y - 60, 0, y);
    g.addColorStop(0, "rgba(103,232,249,0)");
    g.addColorStop(1, "rgba(103,232,249,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(b.x, y - 60, b.w, 60);
    ctx.fillStyle = "rgba(165,243,252,0.9)";
    ctx.fillRect(b.x, y, b.w, 2);
  } },
  etoiles: { n: 18, draw(ctx, b, t, p) {
    const q = loop(p[1], t, 1);
    ctx.globalAlpha = Math.sin(Math.PI * q);
    star5(ctx, b.x + p[0] * b.w + Math.sin(TAU * (q + p[2])) * 10, b.y + b.h * (1 - q), 5 + p[3] * 7, p[3] < 0.5 ? "#fde047" : "#fef9c3");
  } },
  papillons: { n: 8, draw(ctx, b, t, p) {
    const x = b.x + 40 + p[0] * (b.w - 80) + Math.sin(TAU * (t + p[2])) * 40, y = b.y + 40 + p[1] * b.h * 0.75 + Math.sin(TAU * (2 * t + p[3])) * 20;
    const flap = 0.25 + 0.75 * Math.abs(Math.sin(TAU * (t * 4 + p[2])));
    const col = p[3] < 0.5 ? "#fb923c" : "#c084fc";
    ctx.fillStyle = col;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * 7 * flap, y - 3, 8 * flap, 7, side * 0.5, 0, TAU);
      ctx.ellipse(x + side * 5 * flap, y + 6, 5 * flap, 5, -side * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(x - 1, y - 7, 2, 16);
  } },
  eclairs: { n: 3, draw(ctx, b, t, p, a, layer, i) {
    if (layer !== 0 || (Math.floor(t * 24) + i * 5) % 12 > 1) return;
    ctx.fillStyle = "rgba(224,231,255,0.12)";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    let x = b.x + 40 + p[0] * (b.w - 80), y = b.y;
    ctx.strokeStyle = "#e0e7ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#a5b4fc";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const R = seeded(Math.floor(p[1] * 1e6) + 1);
    while (y < b.y + b.h * 0.6) {
      x += (R() - 0.5) * 50;
      y += 20 + R() * 25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  } },
  billets: { n: 14, draw(ctx, b, t, p) {
    ctx.save();
    ctx.translate(b.x + p[0] * b.w + Math.sin(TAU * (t + p[2])) * 18, b.y - 20 + loop(p[1], t, 1) * (b.h + 40));
    const rot = Math.sin(TAU * (t * 2 + p[3])) * 0.8;
    ctx.rotate(rot);
    ctx.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(TAU * (t + p[2]))));
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(-18, -9, 36, 18);
    ctx.strokeStyle = "#bbf7d0";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-15, -6, 30, 12);
    disc(ctx, 0, 0, 4, "#bbf7d0");
    ctx.restore();
  } },
  etincelles: { n: 34, draw(ctx, b, t, p, a) {
    const q = loop(p[0], t, 2), ang = -Math.PI / 2 + (p[1] - 0.5) * 2.4, d = q * 170;
    const x = a.cx + 70 + Math.cos(ang) * d, y = a.cy + Math.sin(ang) * d + q * q * 140;
    ctx.strokeStyle = `rgba(253,224,71,${1 - q})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - Math.cos(ang) * 10, y - Math.sin(ang) * 10 - q * 8);
    ctx.stroke();
  } },
  gyrophare: { n: 1, draw(ctx, b, t, p, a, layer) {
    if (layer !== 0) return;
    const s = Math.sin(TAU * t * 2);
    glow(ctx, b.x + 60, b.y + 60, 220, "#ef4444", Math.max(0, s) * 0.55);
    glow(ctx, b.x + b.w - 60, b.y + 60, 220, "#3b82f6", Math.max(0, -s) * 0.55);
  } },
  flashs: { n: 6, draw(ctx, b, t, p) {
    const f = (t * 2 + p[2]) % 1;
    if (f > 0.14) return;
    const k = 1 - f / 0.14, x = b.x + 30 + p[0] * (b.w - 60), y = b.y + 60 + p[1] * b.h * 0.7;
    glow(ctx, x, y, 70, "#ffffff", 0.9 * k);
    sparkle(ctx, x, y, 10 * k, "#ffffff");
  } },
};
function drawParticles(ctx, b, t, card, theme, layer, anchor) {
  const fx = FX[theme.fx];
  if (!fx) return;
  const R = seeded(hashOf(card.id) + 11);
  for (let i = 0; i < fx.n; i++) {
    const p = [R(), R(), R(), R()];
    if (!fx.layered && fx.n > 1 && i % 2 !== layer) continue;
    ctx.save();
    fx.draw(ctx, b, t, p, anchor, layer, i);
    ctx.restore();
  }
}

// --- Cadre, ornements et feuilles ---
// Nature de chaque carte, affichée sous son nom
const KINDS = {
  p_belleville: "Quartier", p_seine: "Fleuve", p_metro: "Transport", p_croissant: "Gourmandise", p_baguette: "Gourmandise",
  p_cafe: "Tradition", p_pigeon: "Habitant", p_marais: "Quartier", p_montmartre: "Quartier", p_champs: "Avenue",
  p_bateau: "Transport", p_luxembourg: "Jardin", p_haussmann: "Architecture", p_notredame: "Monument", p_opera: "Monument",
  p_moulin: "Cabaret", p_eiffel: "Monument", p_louvre: "Musée", p_catacombes: "Souterrain", p_versailles: "Château", p_ame: "Légende",
  m_double: "Chambre", m_repas: "Service", m_valise: "Objet", m_contrat: "Document", m_croupier: "Personnage", m_urne: "Institution",
  m_airbnb: "Logement", m_facture: "Document", m_suite: "Chambre", m_casino: "Lieu", m_mairie: "Institution", m_irf: "Institution",
  m_cle: "Objet rare", m_penthouse: "Chambre", m_code: "Document", m_star: "Titre", m_jackpot: "Fortune", m_maire: "Titre",
  m_papillon: "Emblème", m_dictateur: "Personnage", m_fondation: "Légende",
};
const SECTOR_NAMES = { transport: "Transport", restauration: "Restauration", garage: "Garage", beaute: "Beauté", evenementiel: "Événementiel", securite: "Sécurité", media: "Média", immobilier: "Immobilier", commerce: "Commerce" };
function kindOf(card) {
  const series = seriesOf(card);
  if (series === "entreprises") return `Entreprise · ${SECTOR_NAMES[card.sector] ?? "La Maison"}`;
  if (series === "membres") return "Membre de la Maison";
  if (series === "evenements") return "Événement exceptionnel";
  return `${KINDS[card.id] ?? "Carte"} · ${series === "paris" ? "Paris" : "La Maison"}`;
}

function rrPath(p, x, y, w, h, r) {
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}
function metalGradient(ctx, W, H, m, shift = 0) {
  const g = ctx.createLinearGradient(W * shift, 0, W * (1 + shift), H);
  g.addColorStop(0, m[0]);
  g.addColorStop(0.22, m[1]);
  g.addColorStop(0.42, m[2]);
  g.addColorStop(0.5, m[0]);
  g.addColorStop(0.72, m[1]);
  g.addColorStop(1, m[3]);
  return g;
}
// gravure fine du cadre métallique
function engrave(ctx, W, H) {
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1;
  for (let k = -H; k < W; k += 6) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + H, H);
    ctx.stroke();
  }
  ctx.restore();
}
// relief du cadre : arête extérieure sombre, reflet, puis ombre portée vers l'intérieur
function bevel(ctx, W, H) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 1, 1, W - 2, H - 2, 33);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  roundRect(ctx, 4, 4, W - 8, H - 8, 30);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, 12, 12, W - 24, H - 24, 26);
  ctx.stroke();
}
// motif guilloché (comme un billet de banque) sur le corps de la carte
function guilloche(ctx, x, y, w, h, color) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = rgba(color, 0.07);
  ctx.lineWidth = 1;
  for (let k = 0; k < 26; k++) {
    ctx.beginPath();
    for (let px = x; px <= x + w; px += 6) {
      const py = y + (k * h) / 22 + Math.sin(px / 34 + k * 0.55) * 9 + Math.sin(px / 13 + k) * 2;
      if (px === x) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function gem(ctx, x, y, r, color, metal) {
  ctx.fillStyle = metal;
  ctx.beginPath();
  ctx.arc(x, y, r + 5, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, color);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) ctx.lineTo(x + Math.cos((i * TAU) / 8 + 0.39) * r, y + Math.sin((i * TAU) / 8 + 0.39) * r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) ctx.lineTo(x + Math.cos((i * TAU) / 8 + 0.39) * r * 0.55, y + Math.sin((i * TAU) / 8 + 0.39) * r * 0.55);
  ctx.closePath();
  ctx.stroke();
}
// ornements dans les coins de l'illustration (épique et plus)
function corners(ctx, b, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  for (const [x, y, dx, dy] of [[b.x, b.y, 1, 1], [b.x + b.w, b.y, -1, 1], [b.x, b.y + b.h, 1, -1], [b.x + b.w, b.y + b.h, -1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x + dx * 10, y + dy * 58);
    ctx.lineTo(x + dx * 10, y + dy * 10);
    ctx.lineTo(x + dx * 58, y + dy * 10);
    ctx.stroke();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + dx * 16, y + dy * 46);
    ctx.quadraticCurveTo(x + dx * 16, y + dy * 16, x + dx * 46, y + dy * 16);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x + dx * 26, y + dy * 26, 8, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx * 26, y + dy * 20);
    ctx.lineTo(x + dx * 32, y + dy * 26);
    ctx.lineTo(x + dx * 26, y + dy * 32);
    ctx.lineTo(x + dx * 20, y + dy * 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
function statIcon(ctx, kind, x, y, color) {
  if (kind === 0) return star5(ctx, x, y, 8, color);
  ctx.fillStyle = color;
  if (kind === 1) {
    ctx.beginPath();
    ctx.moveTo(x + 2, y - 9);
    ctx.lineTo(x - 5, y + 1);
    ctx.lineTo(x, y + 1);
    ctx.lineTo(x - 2, y + 9);
    ctx.lineTo(x + 5, y - 1);
    ctx.lineTo(x, y - 1);
    ctx.closePath();
    ctx.fill();
    return;
  }
  for (const [dx, dy] of [[0, -4], [-4, 2], [4, 2]]) disc(ctx, x + dx, y + dy, 4, color);
  ctx.fillRect(x - 1, y + 3, 2, 7);
}
// symbole de série (comme le symbole d'extension des vraies cartes)
function seriesIcon(ctx, series, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.beginPath();
  if (series === "paris") {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.55, y + s);
    ctx.lineTo(x + s * 0.25, y + s);
    ctx.quadraticCurveTo(x, y + s * 0.45, x - s * 0.25, y + s);
    ctx.lineTo(x - s * 0.55, y + s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - s * 0.35, y + s * 0.05, s * 0.7, s * 0.14);
  } else if (series === "maison") {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y - s * 0.1);
    ctx.lineTo(x + s * 0.72, y - s * 0.1);
    ctx.lineTo(x + s * 0.72, y + s * 0.85);
    ctx.lineTo(x - s * 0.72, y + s * 0.85);
    ctx.lineTo(x - s * 0.72, y - s * 0.1);
    ctx.lineTo(x - s, y - s * 0.1);
    ctx.closePath();
    ctx.fill();
  } else if (series === "entreprises") {
    ctx.fillRect(x - s * 0.6, y - s, s * 0.75, s * 1.85);
    ctx.fillRect(x + s * 0.2, y - s * 0.3, s * 0.5, s * 1.15);
  } else if (series === "membres") {
    ctx.arc(x, y - s * 0.4, s * 0.42, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.75, s * 0.75, s * 0.55, 0, Math.PI, TAU);
    ctx.fill();
  } else {
    ctx.moveTo(x + s * 0.2, y - s);
    ctx.lineTo(x - s * 0.55, y + s * 0.15);
    ctx.lineTo(x - s * 0.02, y + s * 0.15);
    ctx.lineTo(x - s * 0.2, y + s);
    ctx.lineTo(x + s * 0.55, y - s * 0.15);
    ctx.lineTo(x + s * 0.02, y - s * 0.15);
    ctx.closePath();
    ctx.fill();
  }
}
// texte espacé lettre par lettre (gravure des plaques)
function spaced(ctx, text, x, y, spacing) {
  const chars = Array.from(text);
  const total = chars.reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (chars.length - 1);
  let cx = x - total / 2;
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = align;
  return total;
}
function diamond(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
}
function rainbow(ctx, W, H, t, alpha) {
  // dégradé arc-en-ciel répété : il avance d'exactement un cycle par boucle
  const sx = -3 * W + t * W, sy = -H + (t * H) / 3;
  const g = ctx.createLinearGradient(sx, sy, sx + 6 * W, sy + 2 * H);
  const colors = ["#ff0080", "#ff8c00", "#ffe600", "#00e676", "#00b0ff", "#d500f9"];
  for (let c = 0; c < 6; c++) colors.forEach((col, i) => g.addColorStop((c * 6 + i) / 36, col));
  g.addColorStop(1, colors[0]);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
// zone holographique : l'illustration et le cadre, pas le texte (comme une vraie carte holo)
function foilMask(W, H, box) {
  const p = new Path2D();
  rrPath(p, 0, 0, W, H, 34);
  rrPath(p, 14, 14, W - 28, H - 28, 24);
  rrPath(p, box.x, box.y, box.w, box.h, 18);
  return p;
}
function drawFoil(ctx, W, H, card, holo, t, box) {
  const rank = ORDER.indexOf(card.rarity);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.clip();
  if (holo) {
    ctx.save();
    ctx.clip(foilMask(W, H, box), "evenodd");
    const kind = holoKind(card);
    ctx.globalCompositeOperation = "overlay";
    if (kind === "arcenciel") {
      rainbow(ctx, W, H, t, 0.42);
      // fines lignes de diffraction
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let k = -H; k < W; k += 5) {
        ctx.beginPath();
        ctx.moveTo(k, 0);
        ctx.lineTo(k + H * 0.6, H);
        ctx.stroke();
      }
    } else if (kind === "givre") {
      // glace craquelée : éclats aux reflets changeants
      const R = seeded(hashOf(card.id) + 5), cols = 7, rows = 10, pts = [];
      for (let r = 0; r <= rows; r++) {
        pts.push([]);
        for (let c = 0; c <= cols; c++) {
          const edge = r === 0 || c === 0 || r === rows || c === cols;
          pts[r].push([(c / cols) * W + (edge ? 0 : (R() - 0.5) * 60), (r / rows) * H + (edge ? 0 : (R() - 0.5) * 60)]);
        }
      }
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          for (const tri of [[pts[r][c], pts[r][c + 1], pts[r + 1][c]], [pts[r][c + 1], pts[r + 1][c + 1], pts[r + 1][c]]]) {
            ctx.fillStyle = `hsla(${(R() * 360 + t * 360) % 360},95%,62%,0.4)`;
            ctx.beginPath();
            tri.forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }
        }
      }
    } else {
      rainbow(ctx, W, H, t, 0.26);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = 0.95;
      const R = seeded(hashOf(card.id) + 9);
      for (let i = 0; i < 170; i++) {
        const x = R() * W, y = R() * H, hue = (R() * 360 + t * 360) % 360, s = 0.8 + 2.6 * Math.max(0, Math.sin(TAU * (t * 2 + R())));
        sparkle(ctx, x, y, s, `hsl(${hue},95%,72%)`);
      }
    }
    ctx.restore();
  }
  if (holo || rank >= ORDER.indexOf("rare")) {
    // reflet lumineux qui balaie la carte
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = holo ? 0.5 : 0.16 + rank * 0.04;
    const sx = -W + t * 3 * W;
    const shine = ctx.createLinearGradient(sx, 0, sx + W * 0.6, H * 0.4);
    shine.addColorStop(0, "rgba(255,255,255,0)");
    shine.addColorStop(0.45, "rgba(255,255,255,0.6)");
    shine.addColorStop(0.5, "rgba(255,255,255,0.95)");
    shine.addColorStop(0.55, "rgba(255,255,255,0.6)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (rank >= ORDER.indexOf("legendaire")) {
    const R = seeded(hashOf(card.id) + 3);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < (card.rarity === "mythique" ? 70 : 40); i++) {
      const px = R() * W, py = R() * H, phase = R() * TAU, pink = R() < 0.5;
      const tw = Math.max(0, Math.sin(t * TAU * 2 + phase));
      ctx.globalAlpha = 0.25 + 0.7 * tw;
      sparkle(ctx, px, py, 0.8 + tw * 2.2, card.rarity === "mythique" && pink ? "#f9a8d4" : "#fde68a");
    }
  }
  if (card.rarity === "mythique") {
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.45;
    const gx = ctx.createRadialGradient(W * (0.5 + 0.2 * Math.sin(TAU * t)), H * 0.35, 20, W / 2, H / 2, W);
    gx.addColorStop(0, "#c026d3");
    gx.addColorStop(0.5, "#1e3a8a");
    gx.addColorStop(1, "#000000");
    ctx.fillStyle = gx;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}

// Sujet de la carte : illustration 3D éclairée (préparée une fois puis mise en cache), ou médaillon du membre
const subjectCache = new Map();
async function subjectCanvas(card, size) {
  const key = `${card.id}:${size}`;
  if (subjectCache.has(key)) return subjectCache.get(key);
  const img = await artImage(card);
  if (!img) return null;
  const off = createCanvas(size, size);
  const o = off.getContext("2d");
  o.imageSmoothingQuality = "high";
  o.drawImage(img, 0, 0, size, size);
  o.globalCompositeOperation = "source-atop";
  // lumière venant d'en haut à gauche, ombre en bas à droite
  const light = o.createLinearGradient(0, 0, size * 0.55, size);
  light.addColorStop(0, "rgba(255,255,255,0.24)");
  light.addColorStop(0.5, "rgba(255,255,255,0)");
  light.addColorStop(1, "rgba(0,0,0,0.22)");
  o.fillStyle = light;
  o.fillRect(0, 0, size, size);
  // teinte de l'ambiance de la rareté pour fondre le sujet dans le décor
  o.fillStyle = rgba(METAL[card.rarity][4], 0.08);
  o.fillRect(0, 0, size, size);
  subjectCache.set(key, off);
  if (subjectCache.size > 120) subjectCache.delete(subjectCache.keys().next().value);
  return off;
}
async function drawSubject(ctx, card, a, metal, m) {
  if (card.avatar) {
    const img = await fetchImage(`avatar:${card.avatar}`, card.avatar);
    const r = a.size / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 20;
    disc(ctx, a.cx, a.cy, r + 18, metal);
    ctx.restore();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, r + 18, 0, TAU);
    ctx.stroke();
    // perles autour du médaillon
    for (let i = 0; i < 36; i++) {
      const ang = (i / 36) * TAU;
      disc(ctx, a.cx + Math.cos(ang) * (r + 10), a.cy + Math.sin(ang) * (r + 10), 2.6, i % 2 ? m[2] : m[3]);
    }
    disc(ctx, a.cx, a.cy, r + 3, m[3]);
    ctx.save();
    ctx.beginPath();
    ctx.arc(a.cx, a.cy, r, 0, TAU);
    ctx.clip();
    if (img) ctx.drawImage(img, a.cx - r, a.cy - r, r * 2, r * 2);
    const gl = ctx.createLinearGradient(a.cx - r, a.cy - r, a.cx + r, a.cy + r);
    gl.addColorStop(0, "rgba(255,255,255,0.25)");
    gl.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = gl;
    ctx.fillRect(a.cx - r, a.cy - r, r * 2, r * 2);
    ctx.restore();
    return;
  }
  const off = await subjectCanvas(card, a.size);
  if (!off) return;
  // ombre de contact au sol
  ctx.save();
  ctx.filter = "blur(9px)";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(a.cx, a.top + a.size * 0.93, a.size * 0.3, a.size * 0.045, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 22;
  ctx.drawImage(off, a.cx - a.size / 2, a.top, a.size, a.size);
  ctx.restore();
}
// anneau d'énergie des mythiques (moitié arrière, puis moitié avant)
function energyRing(ctx, a, t, color, front) {
  const rx = a.size * 0.62, ry = a.size * 0.16, cy = a.cy + a.size * 0.12;
  ctx.save();
  ctx.translate(a.cx, cy);
  ctx.rotate(-0.18);
  ctx.strokeStyle = rgba(color, 0.7);
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
  ctx.stroke();
  for (let k = 0; k < 4; k++) {
    const ang = TAU * (t + k / 4);
    if ((Math.sin(ang) > 0) !== front) continue;
    glow(ctx, Math.cos(ang) * rx, Math.sin(ang) * ry, 22, "#ffffff", 0.95);
  }
  ctx.restore();
}
// reflet d'objectif (légendaire et mythique)
function lensFlare(ctx, b, t, color) {
  const lx = b.x + b.w * (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(TAU * t))), ly = b.y + 70;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, lx, ly, 90, "#ffffff", 0.35);
  ctx.globalAlpha = 0.8;
  sparkle(ctx, lx, ly, 9, "#ffffff");
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(lx - 120, ly - 1, 240, 2);
  for (const [k, r, a] of [[0.45, 16, 0.16], [0.75, 7, 0.25], [1.25, 32, 0.1], [1.6, 12, 0.18]]) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) ctx.lineTo(lx + (cx - lx) * k + Math.cos((i * TAU) / 6) * r, ly + (cy - ly) * k + Math.sin((i * TAU) / 6) * r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// --- Carte de membre : format « créature » avec attaques (design propre aux membres) ---
// La note et le rang dépendent du rôle le plus haut : plus le rôle est haut, plus la carte est forte.
const MEMBER_TIERS = {
  rare: { name: "RÉSIDENT ARGENT", stage: "NIVEAU 1", panel: ["#f8fafc", "#e2e8f0", "#c3ccd8"], ink: "#111827", sub: "#475569", metal: "commune", accent: "#64748b", retreat: 1 },
  epique: { name: "RÉSIDENT AMÉTHYSTE", stage: "NIVEAU 2", panel: ["#f5f3ff", "#ddd6fe", "#b9a6f5"], ink: "#2e1065", sub: "#6d28d9", metal: "epique", accent: "#8b5cf6", retreat: 2 },
  legendaire: { name: "RÉSIDENT OR", stage: "NIVEAU 3", panel: ["#fffbeb", "#fde68a", "#f2b53a"], ink: "#3b2005", sub: "#92400e", metal: "legendaire", accent: "#d97706", retreat: 2 },
  mythique: { name: "ICÔNE DE LA MAISON", stage: "ICÔNE", panel: ["#ffffff", "#fdf2f8", "#dbeafe"], ink: "#1e1b4b", sub: "#7c3aed", metal: "legendaire", accent: "#a855f7", retreat: 3 },
};
const MEMBER_STATS = [["PRE", "Prestige"], ["ACT", "Activité"], ["ANC", "Ancienneté"], ["FOR", "Fortune"], ["STA", "Star"], ["CHA", "Chance"]];
const clampStat = (v) => Math.max(30, Math.min(99, Math.round(v)));
function memberProfile(id, m) {
  const norm = m.role?.norm ?? 0;
  const rating = Math.min(99, 60 + Math.round(39 * norm) + Math.min(3, m.stars ?? 0));
  const rarity = norm >= 0.85 ? "mythique" : norm >= 0.6 ? "legendaire" : norm >= 0.3 ? "epique" : "rare";
  const days = m.joinedAt ? (Date.now() - m.joinedAt) / 86400000 : 0;
  const stats = {
    PRE: rating,
    ACT: clampStat(35 + Math.log2((m.messages ?? 0) + 1) * 5.5),
    ANC: clampStat(35 + days * 0.35),
    FOR: clampStat(30 + Math.log10(Math.max(0, m.balance ?? 0) + 1) * 11),
    STA: clampStat(45 + (m.stars ?? 0) * 9),
    CHA: 50 + (hashOf(id) % 40),
  };
  return { rating, rarity, stats };
}
const round10 = (v) => Math.max(10, Math.round(v / 10) * 10);
// Attaques : la première vient du point fort du membre, la seconde de son rang
const SIGNATURE_MOVES = {
  ACT: ["Bavardage", "Lance la discussion dans le salon : l'adversaire ne peut pas répliquer ce tour-ci."],
  ANC: ["Vétéran de la Maison", "Connaît toutes les règles par cœur. Ignore le prochain impôt."],
  FOR: ["Pluie d'euros", "Lancez 2 pièces. Ajoutez 30 dégâts pour chaque face."],
  STA: ["Étoile filante", "Élu(e) Membre Star : soignez 20 PV à ce membre."],
  CHA: ["Coup de chance", "Lancez une pièce. Si c'est face, les dégâts sont doublés."],
};
const RANK_MOVES = {
  rare: ["Coup de main", "Aide un autre résident : il récupère 10 PV.", 2],
  epique: ["Ambition", "Si ce membre possède plus de 50 000 €, ajoutez 30 dégâts.", 2],
  legendaire: ["Charisme doré", "Toute la Maison écoute : l'adversaire passe son prochain tour.", 3],
  mythique: ["Volonté de la Fondation", "Rien ne résiste à la Fondation : cette attaque ne peut pas être bloquée.", 3],
};
function memberMoves(card) {
  const st = card.memberStats ?? {};
  const best = ["ACT", "ANC", "FOR", "STA", "CHA"].sort((a, b) => (st[b] ?? 0) - (st[a] ?? 0))[0];
  const [n1, d1] = SIGNATURE_MOVES[best];
  const [n2, d2, cost2] = RANK_MOVES[card.rarity] ?? RANK_MOVES.rare;
  return [
    { name: n1, text: d1, cost: 1, damage: round10((st[best] ?? 50) * 0.6) },
    { name: n2, text: d2, cost: cost2, damage: round10((st.PRE ?? 60) * 1.3) },
  ];
}
function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 3) {
  const words = String(text).split(/\s+/);
  let line = "", n = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + n * lineH);
      line = w;
      if (++n >= maxLines) return;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y + n * lineH);
}
// symbole d'énergie : orbe aux couleurs du rôle avec l'emblème de la Maison (ou étoile neutre)
function energy(ctx, x, y, r, color, neutral = false) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, neutral ? "#d4d4d8" : color);
  g.addColorStop(1, neutral ? "#52525b" : "#111111");
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  disc(ctx, x, y, r, g);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, r - 0.6, 0, TAU);
  ctx.stroke();
  if (neutral) star5(ctx, x, y + 0.5, r * 0.55, "#ffffff");
  else seriesIcon(ctx, "maison", x, y, r * 0.48, "#ffffff");
}

async function drawMemberCard(card, holo = false, t = 0.3) {
  const W = 600, H = 840;
  const T = MEMBER_TIERS[card.rarity] ?? MEMBER_TIERS.rare, metalCols = METAL[T.metal];
  const roleColor = card.role?.color && card.role.color !== "#000000" ? card.role.color : T.accent;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const metal = metalGradient(ctx, W, H, metalCols, Math.sin(TAU * t) * 0.2);

  // Bordure métallique épaisse, puis panneau clair
  roundRect(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = metal;
  ctx.fill();
  engrave(ctx, W, H);
  bevel(ctx, W, H);
  if (card.rarity === "mythique") {
    // bordure irisée qui change de couleur
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 30);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.55);
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, 22, 22, W - 44, H - 44, 16);
  ctx.clip();
  const panel = ctx.createLinearGradient(0, 22, W * 0.4, H);
  panel.addColorStop(0, T.panel[0]);
  panel.addColorStop(0.55, T.panel[1]);
  panel.addColorStop(1, T.panel[2]);
  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, W, H);
  // fine trame en losanges du panneau
  ctx.strokeStyle = rgba(T.sub, 0.07);
  ctx.lineWidth = 1;
  for (let k = -H; k < W + H; k += 18) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + H, H);
    ctx.moveTo(k, 0);
    ctx.lineTo(k - H, H);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 2;
  roundRect(ctx, 22, 22, W - 44, H - 44, 16);
  ctx.stroke();

  // En-tête : niveau, nom, PV, énergie
  ctx.font = "12px CardEngrave";
  const stageW = ctx.measureText(T.stage).width + 26;
  roundRect(ctx, 36, 32, stageW, 22, 11);
  const sg = ctx.createLinearGradient(36, 0, 36 + stageW, 0);
  sg.addColorStop(0, metalCols[2]);
  sg.addColorStop(1, metalCols[1]);
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(T.stage, 49, 48);
  const hp = round10((card.rating ?? 70) * 1.6);
  ctx.textAlign = "right";
  ctx.font = "40px CardTitle";
  ctx.fillStyle = "#b91c1c";
  ctx.fillText(String(hp), 522, 86);
  const hpW = ctx.measureText(String(hp)).width;
  ctx.font = "15px CardBold";
  ctx.fillText("PV", 522 - hpW - 6, 84);
  ctx.textAlign = "left";
  energy(ctx, 551, 72, 19, roleColor);
  const special = card.rarity === "legendaire" || card.rarity === "mythique";
  const nameSize = fitText(ctx, card.name, 330, 40, "CardTitle");
  ctx.font = `${nameSize}px CardTitle`;
  ctx.fillStyle = T.ink;
  ctx.fillText(card.name, 38, 88);
  if (special) {
    const nw = ctx.measureText(card.name).width;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 3;
    star5(ctx, 38 + nw + 20, 74, 13, card.rarity === "mythique" ? `hsl(${Math.round(t * 360)},85%,60%)` : "#f59e0b");
    ctx.restore();
  }

  // Illustration : portrait du membre sur fond flou, lumière aux couleurs du rôle
  const art = { x: 44, y: 100, w: 512, h: 356 };
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = metal;
  ctx.fillRect(art.x - 7, art.y - 7, art.w + 14, art.h + 14);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(art.x, art.y, art.w, art.h);
  ctx.clip();
  const avatar = await fetchImage(`avatar:${card.avatar}`, card.avatar);
  if (avatar) {
    ctx.filter = "blur(18px) saturate(1.3)";
    ctx.drawImage(avatar, art.x - 60, art.y - 140, art.w + 120, art.w + 120);
    ctx.filter = "none";
  } else {
    ctx.fillStyle = "#27272a";
    ctx.fillRect(art.x, art.y, art.w, art.h);
  }
  const shade = ctx.createLinearGradient(0, art.y, 0, art.y + art.h);
  shade.addColorStop(0, rgba(roleColor, 0.25));
  shade.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = shade;
  ctx.fillRect(art.x, art.y, art.w, art.h);
  const acx = art.x + art.w / 2, acy = art.y + art.h / 2;
  ctx.save();
  ctx.translate(acx, acy);
  ctx.rotate((t * TAU) / 16);
  for (let i = 0; i < 16; i++) {
    ctx.rotate(TAU / 16);
    ctx.fillStyle = rgba("#ffffff", i % 2 ? 0.04 : 0.1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -500);
    ctx.lineTo(30, -500);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, acx, acy, 220, roleColor, 0.55);
  const RS = seeded(hashOf(card.id) + 8);
  for (let i = 0; i < 26; i++) {
    const tw = Math.max(0, Math.sin(TAU * (t * 2 + RS())));
    ctx.globalAlpha = 0.25 + 0.75 * tw;
    sparkle(ctx, art.x + RS() * art.w, art.y + RS() * art.h, 1 + tw * 3, "#ffffff");
  }
  ctx.globalAlpha = 1;
  // portrait net, encadré de blanc, qui flotte légèrement
  const ps = 262, ppx = acx - ps / 2, ppy = acy - ps / 2 + Math.sin(TAU * t) * 4;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  roundRect(ctx, ppx - 6, ppy - 6, ps + 12, ps + 12, 26);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, ppx, ppy, ps, ps, 22);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, ppx, ppy, ps, ps);
  const gl = ctx.createLinearGradient(ppx, ppy, ppx + ps, ppy + ps);
  gl.addColorStop(0, "rgba(255,255,255,0.28)");
  gl.addColorStop(0.4, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(ppx, ppy, ps, ps);
  ctx.restore();
  // ruban du rang dans le coin
  ctx.save();
  ctx.translate(art.x + art.w, art.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = metal;
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 6;
  ctx.fillRect(-90, 34, 180, 26);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "12px CardEngrave";
  ctx.textAlign = "center";
  ctx.fillText(T.name.replace("RÉSIDENT ", "").replace(" DE LA MAISON", ""), 0, 52);
  ctx.restore();
  if (holo) {
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.45);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // Bandeau d'informations
  const days = card.joinedAt ? Math.max(0, Math.floor((Date.now() - card.joinedAt) / 86400000)) : null;
  const info = `${numberOf(card).replace("#", "N° ")}   Membre · ${card.role?.name ?? "Résident"}${days !== null ? `   ·   ${days} jour${days > 1 ? "s" : ""} dans la Maison` : ""}`;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(70, 466);
  ctx.lineTo(W - 70, 466);
  ctx.lineTo(W - 84, 492);
  ctx.lineTo(84, 492);
  ctx.closePath();
  ctx.fillStyle = metal;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 5;
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = `${fitText(ctx, info, 420, 14, "CardItalic")}px CardItalic`;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(info, W / 2, 484);
  ctx.textAlign = "left";

  // Attaques
  const moves = memberMoves(card);
  moves.forEach((mv, i) => {
    const y = 528 + i * 90;
    for (let k = 0; k < mv.cost; k++) energy(ctx, 54 + k * 30, y, 12, roleColor, k > 0 && i === 1 && k === mv.cost - 1);
    ctx.font = "27px CardTitle";
    ctx.fillStyle = T.ink;
    ctx.fillText(mv.name, 54 + mv.cost * 30 + 6, y + 9);
    ctx.textAlign = "right";
    ctx.font = "34px CardTitle";
    ctx.fillText(String(mv.damage), W - 48, y + 11);
    ctx.textAlign = "left";
    ctx.font = "14px CardText";
    ctx.fillStyle = rgba(T.ink, 0.85);
    wrapText(ctx, mv.text, 54, y + 34, W - 108, 18, 2);
    if (i === 0) {
      ctx.strokeStyle = rgba(T.sub, 0.35);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(50, y + 66);
      ctx.lineTo(W - 50, y + 66);
      ctx.stroke();
    }
  });

  // Faiblesse, résistance, retraite
  const by = 708;
  ctx.strokeStyle = rgba(T.sub, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(44, by - 16);
  ctx.lineTo(W - 44, by - 16);
  ctx.stroke();
  const cols = [
    ["faiblesse", "Impôts ×2"],
    ["résistance", "IRF −20"],
    ["retraite", null],
  ];
  cols.forEach(([label, value], i) => {
    const x = 64 + i * 176;
    ctx.font = "12px CardText";
    ctx.fillStyle = rgba(T.ink, 0.7);
    ctx.fillText(label, x, by);
    ctx.font = "15px CardBold";
    ctx.fillStyle = T.ink;
    if (value) ctx.fillText(value, x, by + 22);
    else for (let k = 0; k < T.retreat; k++) energy(ctx, x + 9 + k * 22, by + 16, 9, roleColor, true);
  });

  // Texte d'ambiance et mentions
  roundRect(ctx, 44, 746, W - 88, 52, 8);
  ctx.fillStyle = rgba("#ffffff", 0.35);
  ctx.fill();
  ctx.strokeStyle = rgba(T.sub, 0.45);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.font = "15px CardItalic";
  ctx.fillStyle = T.ink;
  wrapText(ctx, card.text, 58, 767, W - 116, 18, 2);
  ctx.font = "11px CardBold";
  ctx.fillStyle = rgba(T.ink, 0.65);
  seriesIcon(ctx, "membres", 48, 808, 5, T.ink);
  ctx.fillText(`${numberOf(card).replace("#", "")}`, 58, 812);
  for (let k = 0; k <= ORDER.indexOf(card.rarity) - 2; k++) {
    diamond(ctx, 130 + k * 13, 808, 4);
    ctx.fillStyle = T.sub;
    ctx.fill();
  }
  ctx.textAlign = "right";
  ctx.fillStyle = rgba(T.ink, 0.65);
  ctx.fillText("Illus. La Maison  ·  © 2026", W - 46, 812);
  ctx.textAlign = "left";

  // reflet qui balaie la carte, pierres pour les plus hauts rangs
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 30);
  ctx.clip();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = special ? 0.35 : 0.22;
  const sx = -W + t * 3 * W;
  const shine = ctx.createLinearGradient(sx, 0, sx + W * 0.6, H * 0.4);
  shine.addColorStop(0, "rgba(255,255,255,0)");
  shine.addColorStop(0.5, "rgba(255,255,255,0.9)");
  shine.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  if (special) {
    const gemColor = card.rarity === "mythique" ? `hsl(${Math.round(t * 360)},90%,62%)` : roleColor;
    gem(ctx, W / 2, 11, 8, gemColor, metal);
    gem(ctx, 11 + 8, H / 2, 6, gemColor, metal);
    gem(ctx, W - 19, H / 2, 6, gemColor, metal);
  }
  return c;
}

async function drawCard(card, holo = false, t = 0.37, mode = animMode(card, holo)) {
  if (card.avatar) return drawMemberCard(card, holo, t);
  const W = 600, H = 840;
  const m = METAL[card.rarity];
  const rank = ORDER.indexOf(card.rarity);
  const theme = themeOf(card);
  const series = seriesOf(card);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";

  // Cadre en métal gravé, avec relief
  const metal = metalGradient(ctx, W, H, m, Math.sin(TAU * t) * 0.2);
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = metal;
  ctx.fill();
  engrave(ctx, W, H);
  bevel(ctx, W, H);
  roundRect(ctx, 14, 14, W - 28, H - 28, 24);
  const inner = ctx.createLinearGradient(0, 0, 0, H);
  inner.addColorStop(0, "#1f0b0e");
  inner.addColorStop(1, "#0a0405");
  ctx.fillStyle = inner;
  ctx.fill();
  guilloche(ctx, 14, 560, W - 28, H - 574, m[0]);

  // Illustration
  const box = { x: 26, y: 26, w: W - 52, h: 520 };
  const pop = mode === "popout" || mode === "ascension";
  const size = card.avatar ? 290 : mode === "ascension" ? 450 : pop ? 440 : 370;
  const bob = Math.sin(TAU * t) * (mode === "float" ? 9 : 6);
  const top = card.avatar ? box.y + box.h * 0.55 - size / 2 + bob : pop ? box.y + box.h + 28 - size + bob : box.y + box.h - size - 26 + bob;
  const anchor = { cx: W / 2, top, size, cy: top + size / 2 };

  ctx.save();
  roundRect(ctx, box.x, box.y, box.w, box.h, 18);
  ctx.clip();
  drawScene(ctx, box, theme, card, t);
  if (rank >= ORDER.indexOf("rare")) glow(ctx, anchor.cx, anchor.cy, size * 0.62, m[4], mode === "ascension" ? 0.4 + 0.25 * Math.sin(TAU * t * 2) : 0.32);
  // particules d'arrière-plan légèrement floues (profondeur de champ)
  const far = createCanvas(W, H);
  drawParticles(far.getContext("2d"), box, t, card, theme, 0, anchor);
  ctx.filter = "blur(1.5px)";
  ctx.drawImage(far, 0, 0);
  ctx.filter = "none";
  if (!pop) {
    await drawSubject(ctx, card, anchor, metal, m);
    drawParticles(ctx, box, t, card, theme, 1, anchor);
  }
  if (rank >= ORDER.indexOf("legendaire")) lensFlare(ctx, box, t, m[4]);
  const band = ctx.createLinearGradient(0, box.y, 0, box.y + 140);
  band.addColorStop(0, "rgba(0,0,0,0.8)");
  band.addColorStop(0.6, "rgba(0,0,0,0.35)");
  band.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = band;
  ctx.fillRect(box.x, box.y, box.w, 140);
  ctx.restore();

  // Bordure de l'illustration : filet sombre, métal, filet clair
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, box.x, box.y, box.w, box.h, 18);
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = metal;
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  roundRect(ctx, box.x + 3.5, box.y + 3.5, box.w - 7, box.h - 7, 15);
  ctx.stroke();
  if (rank >= ORDER.indexOf("epique")) corners(ctx, box, m[2]);

  // Sortie du cadre : le sujet déborde de l'illustration
  if (pop) {
    if (mode === "ascension") energyRing(ctx, anchor, t, m[4], false);
    await drawSubject(ctx, card, anchor, metal, m);
    if (mode === "ascension") energyRing(ctx, anchor, t, m[4], true);
    ctx.save();
    roundRect(ctx, box.x, box.y, box.w, box.h, 18);
    ctx.clip();
    drawParticles(ctx, box, t, card, theme, 1, anchor);
    ctx.restore();
  }

  // Nom (doré à partir de légendaire) et nature de la carte
  const nx = rank >= ORDER.indexOf("epique") ? 62 : 48;
  const nameSize = fitText(ctx, card.name, W - 150 - nx, 48, "CardTitle");
  ctx.font = `${nameSize}px CardTitle`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText(card.name, nx, 84);
  if (rank >= ORDER.indexOf("legendaire")) {
    const gold = ctx.createLinearGradient(0, 84 - nameSize, 0, 88);
    gold.addColorStop(0, "#fffbeb");
    gold.addColorStop(0.5, "#fcd34d");
    gold.addColorStop(1, "#b45309");
    ctx.fillStyle = gold;
  } else ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;
  ctx.fillText(card.name, nx, 84);
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText(kindOf(card), nx + 2, 114);
  ctx.shadowBlur = 0;

  // Médaillon de série en haut à droite
  const ex = W - 66, ey = 66;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  disc(ctx, ex, ey, 25, metal);
  ctx.restore();
  disc(ctx, ex, ey, 20, "#1a0a0d");
  ctx.strokeStyle = rgba(m[0], 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(ex, ey, 17, 0, TAU);
  ctx.stroke();
  seriesIcon(ctx, series, ex, ey, 10, m[0]);

  // Plaque de rareté gravée
  const py = box.y + box.h;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, W / 2 - 150, py - 23, 300, 46, 23);
  ctx.fillStyle = metal;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = m[3];
  roundRect(ctx, W / 2 - 150, py - 23, 300, 46, 23);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  roundRect(ctx, W / 2 - 145, py - 18, 290, 36, 18);
  ctx.stroke();
  ctx.font = "21px CardEngrave";
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  spaced(ctx, RARITIES[card.rarity].name.toUpperCase(), W / 2, py + 9, 3);
  ctx.fillStyle = "#1a0a0d";
  const pw = spaced(ctx, RARITIES[card.rarity].name.toUpperCase(), W / 2, py + 8, 3);
  for (const side of [-1, 1]) {
    diamond(ctx, W / 2 + side * (pw / 2 + 18), py, 5);
    ctx.fill();
  }

  // Statistiques : icône, valeur et jauge
  const st = statsOf(card);
  [["PRESTIGE", st.prestige], ["INFLUENCE", st.influence], ["CHANCE", st.chance]].forEach(([label, value], i) => {
    const bx = 44 + i * 176, by = 584;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    roundRect(ctx, bx, by, 160, 92, 14);
    const sg = ctx.createLinearGradient(0, by, 0, by + 92);
    sg.addColorStop(0, "#2d1513");
    sg.addColorStop(1, "#140808");
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = 2;
    ctx.strokeStyle = m[1];
    roundRect(ctx, bx, by, 160, 92, 14);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, bx + 4, by + 4, 152, 84, 11);
    ctx.stroke();
    statIcon(ctx, i, bx + 22, by + 21, m[0]);
    ctx.fillStyle = "#cbb9a9";
    ctx.font = "13px CardEngrave";
    ctx.textAlign = "left";
    ctx.fillText(label, bx + 36, by + 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "36px CardTitle";
    ctx.textAlign = "center";
    ctx.fillText(String(value), bx + 80, by + 64);
    ctx.textAlign = "left";
    roundRect(ctx, bx + 18, by + 74, 124, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    roundRect(ctx, bx + 18, by + 74, Math.max(6, (124 * value) / 99), 6, 3);
    const gauge = ctx.createLinearGradient(bx + 18, 0, bx + 142, 0);
    gauge.addColorStop(0, m[3]);
    gauge.addColorStop(1, m[0]);
    ctx.fillStyle = gauge;
    ctx.fill();
  });

  // Échelle de rareté : un losange plein par niveau
  for (let i = 0; i < ORDER.length; i++) {
    const x = W / 2 + (i - (ORDER.length - 1) / 2) * 20;
    diamond(ctx, x, 696, 6);
    if (i <= rank) {
      ctx.fillStyle = m[1];
      ctx.fill();
      ctx.strokeStyle = m[0];
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#4b3b36";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
  // filets décoratifs de part et d'autre
  ctx.strokeStyle = rgba(m[1], 0.5);
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + side * 70, 696);
    ctx.lineTo(W / 2 + side * 220, 696);
    ctx.stroke();
  }

  // Texte d'ambiance en italique
  ctx.fillStyle = "#ecc979";
  ctx.textAlign = "center";
  const textSize = fitText(ctx, card.text, W - 100, 23, "CardItalic");
  ctx.font = `${textSize}px CardItalic`;
  ctx.fillText(card.text, W / 2, holo ? 734 : 742);

  // Badge holo
  if (holo) {
    const label = HOLO_KINDS[holoKind(card)], bw = 210, bx = W / 2 - bw / 2, by = 748;
    roundRect(ctx, bx, by, bw, 24, 12);
    const badge = ctx.createLinearGradient(bx, by, bx + bw, by);
    ["#ff0080", "#ffe600", "#00e676", "#00b0ff", "#d500f9"].forEach((c, i) => badge.addColorStop(i / 4, c));
    ctx.fillStyle = badge;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.stroke();
    ctx.fillStyle = "#0d0507";
    ctx.font = "13px CardBold";
    ctx.fillText(label, W / 2, by + 17);
  }

  // Pied de carte : symbole et numéro, mention, série
  ctx.font = "13px CardBold";
  ctx.textAlign = "left";
  seriesIcon(ctx, series, 86, 797, 7, m[0]);
  ctx.fillStyle = m[0];
  ctx.fillText(numberOf(card).replace("#", ""), 100, 802);
  ctx.fillStyle = "#7a6a60";
  ctx.font = "12px CardText";
  ctx.textAlign = "center";
  ctx.fillText("© LA MAISON  ·  2026", W / 2, 802);
  ctx.font = "12px CardEngrave";
  ctx.textAlign = "right";
  ctx.fillText(SERIES_LABELS[series].replace(/^\S+ /, "").toUpperCase(), W - 78, 802);
  ctx.textAlign = "left";

  // Pierres serties (légendaire et mythique)
  if (rank >= ORDER.indexOf("legendaire")) {
    const color = card.rarity === "mythique" ? `hsl(${Math.round(t * 360)},90%,62%)` : "#ef4444";
    gem(ctx, W / 2, 14, 10, color, metal);
    gem(ctx, 46, H - 46, 9, color, metal);
    gem(ctx, W - 46, H - 46, 9, color, metal);
  }

  drawFoil(ctx, W, H, card, holo, t, box);
  return canvas;
}

// Dos de carte, montré pendant le retournement
const backCache = new Map();
function drawBack(rarity) {
  if (backCache.has(rarity)) return backCache.get(rarity);
  const W = 600, H = 840, m = METAL[rarity];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const metal = metalGradient(ctx, W, H, m);
  roundRect(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = metal;
  ctx.fill();
  engrave(ctx, W, H);
  bevel(ctx, W, H);
  roundRect(ctx, 18, 18, W - 36, H - 36, 24);
  const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.6);
  bg.addColorStop(0, "#8b1e24");
  bg.addColorStop(1, "#2a0508");
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(251,191,36,0.2)";
  ctx.lineWidth = 2;
  for (let k = -H; k < W + H; k += 40) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k - H, H);
    ctx.moveTo(k, 0);
    ctx.lineTo(k + H, H);
    ctx.stroke();
  }
  for (let ring = 0; ring < 14; ring++) {
    ctx.strokeStyle = `rgba(251,191,36,${0.05 + (ring % 2) * 0.04})`;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * TAU, r = 190 + ring * 9 + Math.sin(a * 12 + ring) * 6;
      ctx.lineTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 20;
  disc(ctx, W / 2, H / 2, 170, metal);
  ctx.restore();
  disc(ctx, W / 2, H / 2, 156, "#3b0a0f");
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU;
    disc(ctx, W / 2 + Math.cos(a) * 163, H / 2 + Math.sin(a) * 163, 2.4, i % 2 ? m[2] : m[3]);
  }
  sparkle(ctx, W / 2, H / 2 - 44, 26, "#fbbf24");
  ctx.fillStyle = "#fde68a";
  ctx.font = "46px CardTitle";
  ctx.textAlign = "center";
  ctx.fillText("La Maison", W / 2, H / 2 + 48);
  ctx.font = "14px CardEngrave";
  ctx.fillStyle = "#e9c46a";
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, H / 2 + 82, 2);
  ctx.textAlign = "left";
  corners(ctx, { x: 40, y: 40, w: W - 80, h: H - 80 }, m[2]);
  backCache.set(rarity, canvas);
  return canvas;
}

// Une image du GIF : la carte en perspective, ombrée selon l'angle, avec son épaisseur et son ombre au sol
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// Dessine une image de carte en perspective sur un canevas : ombrage selon l'angle, tranche visible, ombre au sol
function projectCard(canvas, img, angle, axis, cx, cy, FW, FH, edgeColor, floorY, lift = 0) {
  const ctx = canvas.getContext("2d"), CW = canvas.width, CH = canvas.height;
  const cosA = Math.cos(angle), sinA = Math.sin(angle), scale = Math.max(0.02, Math.abs(cosA));
  const face = createCanvas(CW, CH);
  const f = face.getContext("2d");
  f.imageSmoothingQuality = "high";
  const strips = 70;
  if (axis === "h") {
    const sw = img.width / strips;
    for (let i = 0; i < strips; i++) {
      const u = i / strips - 0.5, depth = 1 + u * sinA * 0.35, dh = FH * depth;
      f.drawImage(img, i * sw, 0, sw + 1, img.height, cx + u * FW * scale, cy - dh / 2, (FW / strips) * scale + 1, dh);
    }
  } else {
    const sh = img.height / strips;
    for (let j = 0; j < strips; j++) {
      const v = j / strips - 0.5, depth = 1 + v * sinA * 0.3, dw = FW * depth;
      f.drawImage(img, 0, j * sh, img.width, sh + 1, cx - dw / 2, cy + v * FH * scale, dw, (FH / strips) * scale + 1);
    }
  }
  // ombrage : le côté qui s'éloigne s'assombrit, celui qui avance s'éclaire
  const k = Math.min(1, Math.abs(sinA) * 2.2);
  if (k > 0.01) {
    f.globalCompositeOperation = "source-atop";
    const near = sinA > 0 ? 1 : 0;
    const g = axis === "h" ? f.createLinearGradient(cx - FW / 2, 0, cx + FW / 2, 0) : f.createLinearGradient(0, cy - FH / 2, 0, cy + FH / 2);
    g.addColorStop(near ? 0 : 1, `rgba(0,0,0,${0.32 * k})`);
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(near ? 1 : 0, `rgba(255,255,255,${0.12 * k})`);
    f.fillStyle = g;
    f.fillRect(0, 0, CW, CH);
    f.globalCompositeOperation = "source-over";
  }
  // ombre au sol, floue
  ctx.save();
  ctx.filter = "blur(7px)";
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0.12, 0.45 - lift / 40)})`;
  ctx.beginPath();
  ctx.ellipse(cx + (axis === "h" ? sinA * 30 : 0), floorY, FW * 0.42 * (axis === "h" ? scale : 1) * Math.max(0.5, 1 - lift / 60), 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // épaisseur de la carte (tranche visible quand elle pivote)
  const edge = Math.round((axis === "h" ? sinA : -sinA) * 7);
  if (Math.abs(edge) >= 1) {
    const sil = createCanvas(CW, CH);
    const s2 = sil.getContext("2d");
    s2.drawImage(face, 0, 0);
    s2.globalCompositeOperation = "source-in";
    s2.fillStyle = edgeColor;
    s2.fillRect(0, 0, CW, CH);
    for (let d = 1; d <= Math.abs(edge); d++) ctx.drawImage(sil, axis === "h" ? Math.sign(edge) * d : 0, axis === "v" ? Math.sign(edge) * d : 0);
  }
  ctx.drawImage(face, 0, 0);
}
// tramage ordonné léger : évite les bandes de couleur dans les dégradés du GIF
function ditherData(canvas) {
  const CW = canvas.width, CH = canvas.height;
  const data = canvas.getContext("2d").getImageData(0, 0, CW, CH);
  const px = data.data;
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const i = (y * CW + x) * 4, d = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * 7;
      px[i] = Math.max(0, Math.min(255, px[i] + d));
      px[i + 1] = Math.max(0, Math.min(255, px[i + 1] + d * 0.5));
      px[i + 2] = Math.max(0, Math.min(255, px[i + 2] + d));
    }
  }
  return data;
}
function composeFrame(src, back, mode, t, edgeColor = "#1a1a1a", FW = 420) {
  const FH = Math.round((FW * src.height) / src.width), PAD = 32;
  const CW = FW + PAD * 2, CH = FH + PAD * 2;
  let angle = 0, axis = "h", lift = 0;
  if (mode === "float") lift = Math.sin(TAU * t) * 5;
  else if (mode === "tilt-h") angle = Math.sin(TAU * t) * 0.32;
  else if (mode === "tilt-v") {
    angle = Math.sin(TAU * t) * 0.26;
    axis = "v";
  } else if (mode === "popout" || mode === "ascension") {
    angle = Math.sin(TAU * t) * 0.16;
    lift = Math.sin(TAU * t * 2) * 4;
  } else if (mode === "flip") {
    if (t < 0.6) angle = Math.sin(TAU * (t / 0.6)) * 0.18;
    else {
      const q = (t - 0.6) / 0.4, e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2;
      angle = e * TAU;
    }
  }
  const img = Math.cos(angle) < 0 ? back : src;
  const c = createCanvas(CW, CH);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#313338";
  ctx.fillRect(0, 0, CW, CH);
  projectCard(c, img, angle, axis, CW / 2, CH / 2 - 8 + lift, FW, FH, edgeColor, CH - 18, lift);
  return ditherData(c);
}

const gifCache = new Map();
// Encode un GIF avec une palette unique calculée sur un échantillon des images : bien plus rapide qu'une palette par image
function encodeFrames(shots) {
  const step = 7, parts = [];
  for (let f = 0; f < shots.length; f += 2) {
    const d = shots[f].data, n = Math.floor(d.length / 4 / step), out = new Uint8Array(n * 4);
    for (let i = 0, j = 0; i < n; i++, j += step * 4) {
      out[i * 4] = d[j];
      out[i * 4 + 1] = d[j + 1];
      out[i * 4 + 2] = d[j + 2];
      out[i * 4 + 3] = 255;
    }
    parts.push(out);
  }
  const sample = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  parts.reduce((o, p) => (sample.set(p, o), o + p.length), 0);
  const palette = quantize(sample, 256);
  const enc = GIFEncoder();
  shots.forEach((sh, i) => enc.writeFrame(applyPalette(sh.data, palette), sh.width, sh.height, { palette: i ? undefined : palette, delay: sh.delay, repeat: sh.once ? -1 : 0 }));
  enc.finish();
  return Buffer.from(enc.bytes());
}
// rend la main au bot entre deux images, pour ne jamais bloquer les autres interactions
const yieldLoop = () => new Promise((r) => setImmediate(r));
async function animatedCard(card, holo) {
  const key = `${card.id}${holo ? "*" : ""}${card.rating ?? ""}`;
  if (gifCache.has(key)) return gifCache.get(key);
  const mode = animMode(card, holo);
  const frames = mode === "flip" ? 40 : 32;
  const back = mode === "flip" ? drawBack(card.rarity) : null;
  const shots = [];
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const t = f / frames;
    const src = await drawCard(card, holo, t, mode);
    const { data, width, height } = composeFrame(src, back, mode, t, METAL[card.rarity][3]);
    shots.push({ data, width: width, height: height, delay: mode === "flip" ? 50 : 55 });
  }
  const buffer = encodeFrames(shots);
  gifCache.set(key, buffer);
  if (gifCache.size > 20) gifCache.delete(gifCache.keys().next().value);
  return buffer;
}

// Fichier d'une carte : animé (GIF) à partir de rare ou en holo, sinon image fixe
function isAnimated(card, holo) {
  return holo || ORDER.indexOf(card.rarity) >= ORDER.indexOf("rare");
}
async function cardFile(card, holo) {
  if (isAnimated(card, holo)) return new AttachmentBuilder(await animatedCard(card, holo), { name: "carte.gif" });
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

// Cartes d'une génération (les cartes d'entreprises et de membres sont dans toutes les générations)
function genPool(gen) {
  return boosterPool().filter((c) => c.id.startsWith("co_") || c.id.startsWith("mb_") || (c.gen ?? 1) === gen);
}

function drawOne(minRarity = null, weights = null, gen = CURRENT_GEN) {
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

// --- Générations et boosters en inventaire ---
// Les boosters achetés vont dans l'inventaire : on les ouvre quand on veut, ou on les garde.
// Chaque génération a ses boosters ; seuls ceux de la génération en cours sont vendus.
const CURRENT_GEN = 1;
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
};
const PACKS = {
  standard: { ...BOOSTERS.standard, tagline: "5 CARTES", colors: ["#b91c1c", "#f87171", "#450a0a"], accent: "#fcd34d", metal: "legendaire", pattern: "guilloche", foil: 0.14 },
  premium: { ...BOOSTERS.premium, tagline: "5 CARTES · 1 RARE GARANTIE", colors: ["#1d4ed8", "#60a5fa", "#0b1340"], accent: "#bfdbfe", metal: "rare", pattern: "losanges", foil: 0.24 },
  prestige: { ...BOOSTERS.prestige, tagline: "3 CARTES · 1 ÉPIQUE GARANTIE", colors: ["#292524", "#57534e", "#050404"], accent: "#fbbf24", metal: "legendaire", pattern: "artdeco", foil: 0.16 },
  jour: { name: "Cadeau du jour", emoji: "🎁", price: 0, size: 1, guarantee: null, tagline: "BOOSTER GRATUIT", colors: ["#047857", "#34d399", "#022c22"], accent: "#a7f3d0", metal: "peucommune", pattern: "confettis", foil: 0.16 },
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
  const feat = G.featured[type].map(findCard).filter(Boolean);
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
  spaced(ctx, G.name.toUpperCase(), W / 2, 164, 3);
  ctx.fillStyle = "#1a0802";
  spaced(ctx, G.name.toUpperCase(), W / 2, 163, 3);
  ctx.font = "52px CardItalic";
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.strokeText(G.title, W / 2, 246);
  ctx.shadowColor = P.accent;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(G.title, W / 2, 246);
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
  const owned = ownedIds(userId);
  const groups = ["paris", "maison", "entreprises", "membres", "evenements"];
  for (const [i, g] of groups.entries()) {
    const y = 596 + i * 32, list = allCards().filter((card) => seriesOf(card) === g), have = list.filter((card) => owned.has(card.id)).length;
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
  const unique = owned.size, all = allCards().length, pct = all ? unique / all : 0;
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
  ctx.fillText(`${allCards().length} cartes à collectionner · les boosters se gardent dans votre inventaire`, W / 2, 102);
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
function shopPayload() {
  const G = GENERATIONS[CURRENT_GEN];
  const soldes = lawActive("soldesBoosters") ? ` *(soldes −${lawParam("soldesBoosters")} %)*` : "";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(`🛒 Boutique — ${G.name} : ${G.title}`)
        .setDescription(
          ["standard", "premium", "prestige"].map((t) => `${PACKS[t].emoji} **${PACKS[t].name}** — ${PACKS[t].tagline.toLowerCase()} · **${formatEuro(boosterPrice(t))}**${soldes}`).join("\n") +
            "\n\nLes boosters achetés vont dans votre inventaire : ouvrez-les quand vous voulez. Quand une nouvelle génération sortira, ceux-ci ne seront plus vendus."
        ),
    ],
    components: ["standard", "premium", "prestige"].map((t) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_buy_${t}_1`).setLabel(`${PACKS[t].name} ×1`).setEmoji(PACKS[t].emoji).setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`carte_buy_${t}_5`).setLabel(`×5 (${canvasText(formatEuro(boosterPrice(t) * 5))})`).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`carte_buy_${t}_10`).setLabel(`×10 (${canvasText(formatEuro(boosterPrice(t) * 10))})`).setStyle(ButtonStyle.Secondary)
      )
    ),
    ephemeral: true,
  };
}

// --- Révélation animée des cartes (de la plus faible à la meilleure) ---
// Plus la carte est rare, plus l'attente est longue et l'explosion spectaculaire.
const REVEAL = {
  frames: [16, 18, 22, 26, 30, 34],
  pre: [3, 4, 6, 8, 10, 12],
  flash: [0, 0.18, 0.32, 0.5, 0.75, 0.95],
  burst: [0, 12, 24, 40, 64, 96],
  hold: [700, 900, 1200, 1600, 2200, 2700],
};
function revealDuration(card) {
  const r = ORDER.indexOf(card.rarity);
  return REVEAL.frames[r] * 55 + REVEAL.hold[r];
}
function glowHsl(ctx, x, y, rad, hue, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `hsla(${hue},90%,62%,${a})`);
  g.addColorStop(1, `hsla(${hue},90%,62%,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function pill(ctx, x, y, text, bg, fg) {
  const w = ctx.measureText(text).width + 30;
  roundRect(ctx, x - w / 2, y - 13, w, 26, 13);
  if (bg === "rainbow") {
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    ["#ff0080", "#ffe600", "#00e676", "#00b0ff", "#d500f9"].forEach((c, i) => g.addColorStop(i / 4, c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.fillText(text, x, y + 5);
  return w;
}
async function revealGif(p, index, total) {
  const { card, holo, isNew } = p;
  const r = ORDER.indexOf(card.rarity), m = METAL[card.rarity], rc = m[4];
  const RW = 480, RH = 720, FW = 330, FH = 462, cx = RW / 2, cy = 318;
  const N = REVEAL.frames[r], pre = REVEAL.pre[r], flipLen = 6, fr0 = pre + 3;
  const back = drawBack("legendaire");
  const mode = animMode(card, holo);
  const R0 = seeded(hashOf(card.id) + index * 31 + 7);
  const sparks = Array.from({ length: REVEAL.burst[r] }, () => ({ a: R0() * TAU, v: 9 + R0() * 16, s: 1.5 + R0() * 3.5, c: R0() }));
  const rain = Array.from({ length: 34 }, () => ({ x: R0() * RW, o: R0() * RH, s: 1 + R0() * 2.4 }));
  const shots = [];
  for (let f = 0; f < N; f++) {
    await yieldLoop();
    const c = createCanvas(RW, RH);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#313338";
    ctx.fillRect(0, 0, RW, RH);
    const after = f >= fr0, since = f - fr0, charge = Math.min(1, f / Math.max(1, pre));

    // Ambiance lumineuse : elle monte pendant l'attente puis explose à la révélation
    const level = after ? 0.2 + 0.08 * r + Math.max(0, 0.45 - since * 0.05) : charge * 0.07 * r;
    if (r >= 5 && after) glowHsl(ctx, cx, cy, 360, (since * 18) % 360, Math.min(0.8, level));
    else if (level > 0.01) glow(ctx, cx, cy, 320, rc, Math.min(0.85, level));
    if (after && r >= 3) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(since * 0.045);
      for (let i = 0; i < 18; i++) {
        ctx.rotate(TAU / 18);
        ctx.fillStyle = r >= 5 ? `hsla(${(i * 20 + since * 18) % 360},90%,65%,0.16)` : rgba(rc, 0.09 + 0.02 * r);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-26, -560);
        ctx.lineTo(26, -560);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // énergie qui converge vers la carte avant la révélation (épique et plus)
    if (!after && r >= 3) {
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * TAU + f * 0.12, d = 270 * (1 - f / fr0) + 40;
        ctx.globalAlpha = Math.min(1, f / fr0 + 0.2);
        sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 2 + (k % 3), k % 2 ? "#ffffff" : rc);
      }
      ctx.globalAlpha = 1;
    }
    // ondes de choc
    if (after && r >= 2) {
      for (const off of r >= 5 ? [0, 3, 6] : r >= 4 ? [0, 3] : [0]) {
        const q = since - off;
        if (q < 0 || q >= 10) continue;
        ctx.strokeStyle = r >= 5 ? `hsla(${(q * 40 + off * 30) % 360},90%,70%,${(1 - q / 10) * 0.9})` : rgba(rc, (1 - q / 10) * 0.9);
        ctx.lineWidth = 9 * (1 - q / 10) + 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 70 + q * 50, (70 + q * 50) * 0.92, 0, 0, TAU);
        ctx.stroke();
      }
    }

    // La carte : attente (dos), retournement, puis la face qui se stabilise
    let angle, lift = 0, k = 1, t = 0.3, dx = 0;
    if (f < pre) {
      angle = Math.PI + Math.sin(f * 1.7) * 0.025 * r * charge;
      dx = r >= 2 ? Math.sin(f * 2.4) * r * 1.3 * charge : 0;
      lift = Math.sin(charge * Math.PI * 0.5) * (2 + r * 2);
    } else if (f < pre + flipLen) {
      const q = (f - pre + 1) / flipLen, e = 1 - (1 - q) ** 2;
      angle = Math.PI + e * Math.PI;
      lift = Math.sin(q * Math.PI) * 26 + (1 - q) * (2 + r * 2);
      k = 1 + Math.sin(q * Math.PI) * 0.07;
    } else {
      const s = f - pre - flipLen;
      angle = Math.sin(s * 0.9) * 0.15 * Math.exp(-s * 0.32);
      t = (s / 14) % 1;
    }
    const showFace = Math.cos(angle) >= 0;
    const img = showFace ? await drawCard(card, holo, t, mode) : back;
    projectCard(c, img, angle, "h", cx + dx, cy - lift, FW * k, FH * k, showFace ? m[3] : METAL.legendaire[3], cy + FH / 2 + 34, lift);

    // éclair blanc, gerbe d'étincelles, pluie dorée, éclairs, anneau holo
    if (after && REVEAL.flash[r]) {
      const a = REVEAL.flash[r] * Math.max(0, 1 - since / 4);
      if (a > 0) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, RW, RH);
      }
    }
    if (after) {
      for (const pt of sparks) {
        const d = since * pt.v, al = Math.max(0, 1 - since / 16);
        if (al <= 0) continue;
        ctx.globalAlpha = al;
        sparkle(ctx, cx + Math.cos(pt.a) * d, cy + Math.sin(pt.a) * d * 0.85 + since * since * 0.6, pt.s, r >= 5 ? `hsl(${(pt.c * 360 + since * 20) % 360},95%,72%)` : pt.c < 0.5 ? "#ffffff" : rc);
      }
      ctx.globalAlpha = 1;
    }
    if (after && r >= 4) {
      for (const d of rain) {
        const y = ((d.o + since * 14) % (RH + 40)) - 20;
        ctx.globalAlpha = 0.85;
        sparkle(ctx, d.x + Math.sin(since * 0.3 + d.o) * 6, y, d.s, r >= 5 ? "#f5d0fe" : "#fde68a");
      }
      ctx.globalAlpha = 1;
    }
    if (after && r >= 5 && since % 6 < 2) {
      ctx.save();
      ctx.strokeStyle = "#f5d0fe";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 18;
      const RB = seeded(f * 13 + 5);
      for (let b = 0; b < 3; b++) {
        const a = RB() * TAU;
        let x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 210;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += Math.cos(a) * 24 + (RB() - 0.5) * 30;
          y += Math.sin(a) * 24 + (RB() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (after && holo) {
      ctx.lineWidth = 4;
      for (let i = 0; i < 36; i++) {
        ctx.strokeStyle = `hsla(${(i * 10 + since * 24) % 360},95%,65%,0.7)`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 262, 300, 0, (i / 36) * TAU, ((i + 0.8) / 36) * TAU);
        ctx.stroke();
      }
    }

    // Textes : compteur, rareté qui surgit, pastilles
    ctx.textAlign = "center";
    ctx.font = "16px CardEngrave";
    ctx.fillStyle = "#cbb9a9";
    spaced(ctx, `CARTE ${index + 1} / ${total}`, cx, 36, 3);
    for (let i = 0; i < total; i++) {
      diamond(ctx, cx + (i - (total - 1) / 2) * 18, 56, 5);
      if (i < index || (i === index && after)) {
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
      } else {
        ctx.strokeStyle = "#71717a";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    if (after && since >= 1) {
      const pop = Math.max(1, 1.6 - (since - 1) * 0.14);
      ctx.save();
      ctx.translate(cx, 640);
      ctx.scale(pop, pop);
      ctx.font = "38px CardEngrave";
      ctx.shadowColor = r >= 5 ? "#c084fc" : rc;
      ctx.shadowBlur = 14 + r * 4;
      ctx.fillStyle = r >= 5 ? `hsl(${(since * 25) % 360},90%,72%)` : m[0];
      spaced(ctx, RARITIES[card.rarity].name.toUpperCase() + (r >= 3 ? " !" : ""), 0, 0, 4);
      ctx.restore();
      const tags = [isNew ? ["NOUVELLE CARTE", "#fbbf24", "#2a1305"] : ["DOUBLON", "#52525b", "#e4e4e7"]];
      if (holo) tags.push(["HOLOGRAPHIQUE", "rainbow", "#0d0507"]);
      ctx.font = "13px CardBold";
      const widths = tags.map(([txt]) => ctx.measureText(txt).width + 30), totalW = widths.reduce((a, w) => a + w, 0) + (tags.length - 1) * 10;
      let x = cx - totalW / 2;
      for (const [i, [txt, bg, fg]] of tags.entries()) {
        pill(ctx, x + widths[i] / 2, 688, txt, bg, fg);
        x += widths[i] + 10;
      }
    }
    ctx.textAlign = "left";
    shots.push({ data: ditherData(c).data, width: RW, height: RH, delay: f === N - 1 ? 60000 : 55, once: true });
  }
  return encodeFrames(shots);
}

// Récapitulatif : les cartes en éventail, la meilleure au centre
function ribbon(ctx, x, y, w, h, text) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  const g = ctx.createLinearGradient(-60, 0, 60, 0);
  g.addColorStop(0, "#b45309");
  g.addColorStop(0.5, "#fde68a");
  g.addColorStop(1, "#b45309");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.fillRect(-90, 26, 180, 24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2a1305";
  ctx.font = "13px CardEngrave";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 43);
  ctx.restore();
}
async function drawSpread(results, title, gained) {
  const W = 1200, H = 760, n = results.length, best = results[n - 1], bm = METAL[best.card.rarity], gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createRadialGradient(W / 2, 400, 40, W / 2, 400, W * 0.75);
  bg.addColorStop(0, "#35141a");
  bg.addColorStop(1, "#080304");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, 400);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(TAU / 36);
    ctx.fillStyle = rgba(bm[4], i % 2 ? 0.03 : 0.07);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -900);
    ctx.lineTo(40, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, W / 2, 400, 430, bm[4], 0.32);
  guilloche(ctx, 0, 0, W, H, gold[0]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, gold);
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  corners(ctx, { x: 18, y: 18, w: W - 36, h: H - 36 }, gold[1]);

  ctx.textAlign = "center";
  ctx.font = "26px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  spaced(ctx, canvasText(title.replace(/^\S+\s/, "")).toUpperCase(), W / 2, 62, 4);
  ctx.shadowBlur = 0;
  const news = results.filter((p) => p.isNew).length;
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${n} carte${n > 1 ? "s" : ""} · ${news} nouvelle${news > 1 ? "s" : ""} · +${gained} point${gained > 1 ? "s" : ""} de collection`, W / 2, 96);

  // positions : la meilleure au centre, les autres de part et d'autre
  const offsets = n === 2 ? [-0.6, 0.6] : Array.from({ length: n }, (_, i) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2)));
  const placed = results
    .slice()
    .reverse()
    .map((p, i) => ({ p, off: offsets[i] }))
    .sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  for (const { p, off } of placed) {
    const isBest = p === best, rank = ORDER.indexOf(p.card.rarity), m = METAL[p.card.rarity];
    const w = isBest ? 270 : 232 - Math.abs(off) * 12, h = w * 1.4;
    const x = W / 2 + off * (n <= 3 ? 290 : 215), y = 392 + off * off * 14 + (isBest ? -12 : 18);
    glow(ctx, x, y, w * 0.95, m[4], 0.18 + rank * 0.07);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(off * 0.07);
    if (p.holo) {
      ctx.lineWidth = 5;
      for (let i = 0; i < 24; i++) {
        ctx.strokeStyle = `hsla(${i * 15},95%,65%,0.8)`;
        roundRect(ctx, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 18);
        ctx.setLineDash([12, 300]);
        ctx.lineDashOffset = -i * 13;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(await cardThumb(p.card, p.holo, Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (p.isNew) ribbon(ctx, -w / 2, -h / 2, w, h, "NOUVEAU");
    ctx.font = "13px CardBold";
    ctx.textAlign = "center";
    pill(ctx, 0, h / 2 + 24, RARITIES[p.card.rarity].name.toUpperCase(), m[1], "#ffffff");
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.font = "19px CardBold";
  ctx.fillStyle = "#ffffff";
  star5(ctx, W / 2 - ctx.measureText(`Meilleure carte : ${best.card.name} — ${RARITIES[best.card.rarity].name}`).width / 2 - 20, H - 54, 9, "#fbbf24");
  ctx.fillText(`Meilleure carte : ${best.card.name} — ${RARITIES[best.card.rarity].name}${best.holo ? " (holo)" : ""}`, W / 2, H - 48);
  ctx.textAlign = "left";
  return c;
}

// --- Album en images ---
const ALBUM_GROUPS = ["paris", "maison", "entreprises", "membres", "evenements"];
const ALBUM_PER_PAGE = 21;
const seriesCards = (group) => allCards().filter((c) => seriesOf(c) === group);
const thumbCache = new Map();
async function cardThumb(card, holo, w, h) {
  const key = `${card.id}:${holo ? 1 : 0}:${w}:${card.avatar ?? ""}:${card.rating ?? ""}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const big = await drawCard(card, holo, 0.3, "float");
  const c = createCanvas(w, h);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(big, 0, 0, w, h);
  thumbCache.set(key, c);
  if (thumbCache.size > 400) thumbCache.delete(thumbCache.keys().next().value);
  return c;
}
async function silhouette(card, size) {
  const key = `sil:${card.id}:${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  if (card.avatar) disc(x, size / 2, size / 2, size * 0.36, "#000000");
  else {
    const sub = await subjectCanvas(card, size);
    if (sub) x.drawImage(sub, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#000000";
    x.fillRect(0, 0, size, size);
  }
  thumbCache.set(key, c);
  return c;
}
// cuir du classeur : grain, vignettage et surpiqûre dorée
function leather(ctx, W, H, seed) {
  const g = ctx.createRadialGradient(W * 0.4, H * 0.35, 40, W / 2, H / 2, W * 0.8);
  g.addColorStop(0, "#5a1a20");
  g.addColorStop(0.6, "#3a0f14");
  g.addColorStop(1, "#16050a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(seed);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = R() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.09)";
    ctx.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2);
  }
  ctx.strokeStyle = "rgba(253,230,138,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 7]);
  roundRect(ctx, 16, 16, W - 32, H - 32, 20);
  ctx.stroke();
  ctx.setLineDash([]);
  // coins de protection en métal
  const gold = METAL.legendaire;
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
    ctx.fillStyle = metalGradient(ctx, W, H, gold);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * 64, y);
    ctx.lineTo(x, y + dy * 64);
    ctx.closePath();
    ctx.fill();
    disc(ctx, x + dx * 16, y + dy * 16, 3, gold[3]);
  }
}
function progressBar(ctx, x, y, w, h, pct, colors) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  if (pct <= 0) return;
  roundRect(ctx, x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fill();
}
function medallion(ctx, x, y, r, series, gold) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  disc(ctx, x, y, r, metalGradient(ctx, 1200, 800, gold));
  ctx.restore();
  disc(ctx, x, y, r * 0.8, "#1a0a0d");
  seriesIcon(ctx, series, x, y, r * 0.42, gold[0]);
}

async function drawAlbumCover(user) {
  const userId = user.id, W = 1200, H = 856, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  leather(ctx, W, H, 42);
  const avatar = await fetchImage(`avatar:${user.id}:${user.avatar}`, user.displayAvatarURL({ extension: "png", size: 128 }));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  disc(ctx, 116, 118, 56, metalGradient(ctx, W, H, gold));
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(116, 118, 48, 0, TAU);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, 68, 70, 96, 96);
  ctx.restore();
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.fillText("ALBUM DE COLLECTION", 196, 88);
  ctx.font = "52px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  ctx.fillText((user.displayName ?? user.username).slice(0, 24), 194, 142);
  ctx.shadowBlur = 0;
  const G = GENERATIONS[CURRENT_GEN];
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`Les Cartes de la Maison · ${G.name} — ${G.title}`, 196, 174);
  const owned = ownedIds(userId), all = allCards().length, pct = all ? owned.size / all : 0;
  progressRing(ctx, W - 130, 124, 62, pct, [gold[3], gold[0]]);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "32px CardTitle";
  ctx.fillText(`${Math.round(pct * 100)} %`, W - 130, 132);
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = "#cbb9a9";
  ctx.fillText(`${owned.size} / ${all}`, W - 130, 154);
  ctx.textAlign = "left";
  ctx.strokeStyle = rgba(gold[0], 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 222);
  ctx.lineTo(W - 48, 222);
  ctx.stroke();

  const inv = load().inv[userId] ?? {};
  const tiles = [[44, 248], [420, 248], [796, 248], [232, 530], [608, 530]];
  for (const [i, g] of ALBUM_GROUPS.entries()) {
    const [tx, ty] = tiles[i], tw = 360, th = 262, list = seriesCards(g), have = list.filter((card) => owned.has(card.id));
    const done = Boolean(load().rewards[userId]?.[g]) || (list.length > 0 && have.length === list.length);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, tx, ty, tw, th, 16);
    const tg = ctx.createLinearGradient(0, ty, 0, ty + th);
    tg.addColorStop(0, "rgba(40,16,18,0.95)");
    tg.addColorStop(1, "rgba(14,5,6,0.95)");
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = done ? 3 : 1.5;
    ctx.strokeStyle = done ? metalGradient(ctx, W, H, gold) : rgba(gold[0], 0.4);
    roundRect(ctx, tx, ty, tw, th, 16);
    ctx.stroke();
    medallion(ctx, tx + 44, ty + 44, 26, g, gold);
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(SERIES_LABELS[g].replace(/^\S+ /, ""), tx + 82, ty + 46);
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#cbb9a9";
    const sp = list.length ? have.length / list.length : 0;
    ctx.fillText(`${have.length} / ${list.length} cartes · ${Math.round(sp * 100)} %`, tx + 82, ty + 70);
    progressBar(ctx, tx + 22, ty + 90, tw - 44, 9, sp, [gold[3], gold[0]]);
    // éventail des trois plus belles cartes de la série
    const top3 = have.sort((a, b) => ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity)).slice(0, 3);
    const fan = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    const offs = fan.length === 3 ? [-1, 0, 1] : fan.length === 2 ? [-0.5, 0.5] : [0];
    for (const [k, card] of fan.entries()) {
      const off = offs[k], w = off === 0 ? 96 : 86, h = w * 1.4;
      ctx.save();
      ctx.translate(tx + tw / 2 + off * 74, ty + 186 + Math.abs(off) * 6);
      ctx.rotate(off * 0.14);
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 12;
      ctx.drawImage(await cardThumb(card, Boolean(inv[`${card.id}*`]), Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    if (!fan.length) {
      for (const off of [-1, 0, 1]) {
        ctx.save();
        ctx.translate(tx + tw / 2 + off * 74, ty + 186);
        ctx.rotate(off * 0.14);
        ctx.globalAlpha = 0.3;
        ctx.filter = "grayscale(1)";
        ctx.drawImage(drawBack("commune"), -43, -60, 86, 120);
        ctx.restore();
      }
      ctx.textAlign = "center";
      ctx.font = "15px CardItalic";
      ctx.fillStyle = "#cbb9a9";
      ctx.fillText(list.length ? "Aucune carte pour l'instant" : "Bientôt disponible", tx + tw / 2, ty + 192);
      ctx.textAlign = "left";
    }
    if (done) {
      ctx.save();
      ctx.translate(tx + tw - 40, ty + 40);
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 14;
      star5(ctx, 0, 0, 20, "#fbbf24");
      ctx.restore();
      ctx.font = "11px CardEngrave";
      ctx.fillStyle = "#fde68a";
      ctx.textAlign = "center";
      ctx.fillText("COMPLÉTÉE", tx + tw - 40, ty + 76);
      ctx.textAlign = "left";
    }
  }
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#a08a7a";
  ctx.textAlign = "center";
  spaced(ctx, "CHOISISSEZ UNE SÉRIE POUR OUVRIR SES PAGES", W / 2, H - 30, 2);
  ctx.textAlign = "left";
  return c;
}

async function drawAlbumPage(user, group, page) {
  const userId = user.id, W = 1280, H = 900, gold = METAL.legendaire;
  const list = seriesCards(group), pages = Math.max(1, Math.ceil(list.length / ALBUM_PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = list.slice(page * ALBUM_PER_PAGE, (page + 1) * ALBUM_PER_PAGE);
  const inv = load().inv[userId] ?? {}, owned = ownedIds(userId);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  leather(ctx, W, H, 7 + page);
  // page intérieure
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 24;
  roundRect(ctx, 118, 30, W - 148, H - 60, 16);
  const pg = ctx.createLinearGradient(0, 30, 0, H - 30);
  pg.addColorStop(0, "#22100f");
  pg.addColorStop(1, "#110707");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  guilloche(ctx, 118, 30, W - 148, H - 60, gold[0]);
  ctx.strokeStyle = rgba(gold[0], 0.4);
  ctx.lineWidth = 1.5;
  roundRect(ctx, 126, 38, W - 164, H - 76, 12);
  ctx.stroke();
  // anneaux du classeur
  for (const y of [H * 0.2, H * 0.5, H * 0.8]) {
    disc(ctx, 140, y, 8, "#050202");
    ctx.lineWidth = 9;
    ctx.strokeStyle = metalGradient(ctx, W, H, METAL.commune);
    ctx.beginPath();
    ctx.ellipse(112, y, 40, 15, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(112, y - 3, 38, 12, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // en-tête de la série
  medallion(ctx, 186, 96, 32, group, gold);
  ctx.font = "44px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillText(SERIES_LABELS[group].replace(/^\S+ /, ""), 234, 106);
  ctx.shadowBlur = 0;
  const have = list.filter((card) => owned.has(card.id)).length, pct = list.length ? have / list.length : 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${have} / ${list.length} cartes${pages > 1 ? ` · page ${page + 1} sur ${pages}` : ""}`, 236, 136);
  progressBar(ctx, W - 470, 84, 360, 12, pct, [gold[3], gold[0]]);
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(pct * 100)} %`, W - 50, 100);
  ctx.font = "14px CardBold";
  const done = load().rewards[userId]?.[group];
  ctx.fillStyle = done ? "#fde68a" : "#a08a7a";
  const reward = SERIES[group] ? `Récompense : ${canvasText(formatEuro(SERIES[group].reward))} · 500 poussière · rôle Collectionneur` : "Série sans récompense";
  ctx.fillText(done ? "Série complétée — récompense obtenue" : reward, W - 50, 126);
  ctx.textAlign = "left";

  // pochettes : 7 colonnes × 3 rangées
  const sw = 142, sh = 199, gap = 14, x0 = 160 + (W - 190 - (7 * sw + 6 * gap)) / 2, y0 = 168;
  for (let i = 0; i < ALBUM_PER_PAGE; i++) {
    const card = slice[i], x = x0 + (i % 7) * (sw + gap), y = y0 + Math.floor(i / 7) * (sh + 20);
    // pochette plastique
    roundRect(ctx, x - 4, y - 4, sw + 8, sh + 8, 12);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!card) continue;
    const n = (inv[card.id] ?? 0) + (inv[`${card.id}*`] ?? 0), holo = Boolean(inv[`${card.id}*`]), m = METAL[card.rarity];
    if (n > 0) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 10;
      ctx.drawImage(await cardThumb(card, holo, sw, sh), x, y, sw, sh);
      ctx.restore();
      if (n > 1) {
        disc(ctx, x + sw - 14, y + sh - 14, 15, metalGradient(ctx, W, H, gold));
        ctx.font = "12px CardBold";
        ctx.fillStyle = "#2a1305";
        ctx.textAlign = "center";
        ctx.fillText(`×${n}`, x + sw - 14, y + sh - 10);
        ctx.textAlign = "left";
      }
      if (holo) {
        disc(ctx, x + 16, y + sh - 16, 13, "rgba(0,0,0,0.6)");
        sparkle(ctx, x + 16, y + sh - 16, 4.5, `hsl(${(i * 40) % 360},95%,70%)`);
      }
    } else {
      // emplacement vide : silhouette mystère, numéro et rareté
      roundRect(ctx, x, y, sw, sh, 10);
      const eg = ctx.createLinearGradient(0, y, 0, y + sh);
      eg.addColorStop(0, "#1c1010");
      eg.addColorStop(1, "#0d0707");
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = rgba(m[1], 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, x + sw / 2, y + sh / 2, 70, m[4], 0.12);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(await silhouette(card, 104), x + sw / 2 - 52, y + 40, 104, 104);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = "13px CardEngrave";
      ctx.fillStyle = "#8a7a70";
      ctx.fillText(numberOf(card), x + sw / 2, y + 26);
      ctx.font = "20px CardTitle";
      ctx.fillStyle = "#5a4a44";
      ctx.fillText("? ? ?", x + sw / 2, y + 168);
      ctx.font = "10px CardEngrave";
      ctx.fillStyle = m[1];
      ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), x + sw / 2, y + 186);
      ctx.textAlign = "left";
    }
    // reflet de la pochette
    ctx.save();
    roundRect(ctx, x - 4, y - 4, sw + 8, sh + 8, 12);
    ctx.clip();
    const glare = ctx.createLinearGradient(x, y, x + sw, y + sh);
    glare.addColorStop(0, "rgba(255,255,255,0.1)");
    glare.addColorStop(0.35, "rgba(255,255,255,0)");
    glare.addColorStop(0.62, "rgba(255,255,255,0)");
    glare.addColorStop(0.68, "rgba(255,255,255,0.07)");
    glare.addColorStop(0.75, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(x - 4, y - 4, sw + 8, sh + 8);
    ctx.restore();
  }
  if (!list.length) {
    ctx.textAlign = "center";
    ctx.font = "24px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText("Aucune carte dans cette série pour le moment.", W / 2 + 60, H / 2);
    ctx.textAlign = "left";
  }
  // pied : points de pagination
  ctx.textAlign = "center";
  for (let p = 0; p < pages; p++) {
    diamond(ctx, W / 2 + 60 + (p - (pages - 1) / 2) * 20, H - 52, 5);
    if (p === page) {
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.textAlign = "left";
  return { canvas: c, page, pages, slice };
}

async function albumPayload(target, own, view = "cover", page = 0) {
  const name = target.displayName ?? target.username;
  let canvas, info = null;
  if (view === "cover" || !ALBUM_GROUPS.includes(view)) {
    view = "cover";
    canvas = await drawAlbumCover(target);
  } else {
    info = await drawAlbumPage(target, view, page);
    canvas = info.canvas;
    page = info.page;
  }
  const file = new AttachmentBuilder(await canvas.encode("jpeg", 92), { name: "album.jpg" });
  const owned = ownedIds(target.id);
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle(view === "cover" ? `📒 Album de ${name}` : `${SERIES_LABELS[view]} — album de ${name}`)
    .setImage("attachment://album.jpg")
    .setFooter({ text: view === "cover" ? "Choisissez une série dans le menu pour feuilleter ses pages" : "Les cartes manquantes apparaissent en silhouette" });
  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`carte_alb_nav_${target.id}`)
        .setPlaceholder("Feuilleter l'album…")
        .addOptions([
          { label: "Couverture", value: "cover", emoji: "📒", description: `${owned.size} / ${allCards().length} cartes`, default: view === "cover" },
          ...ALBUM_GROUPS.map((g) => {
            const list = seriesCards(g);
            return { label: SERIES_LABELS[g].replace(/^\S+ /, ""), value: g, emoji: SERIES_LABELS[g].split(" ")[0], description: `${list.filter((c) => owned.has(c.id)).length} / ${list.length} cartes`, default: view === g };
          }),
        ])
    ),
  ];
  if (info && info.pages > 1) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_alb_${target.id}_${view}_${page - 1}`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId("carte_alb_page").setLabel(`Page ${page + 1} / ${info.pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`carte_alb_${target.id}_${view}_${page + 1}`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(page >= info.pages - 1)
      )
    );
  }
  if (own && info) {
    const mine = info.slice.filter((c) => owned.has(c.id));
    if (mine.length) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_view")
            .setPlaceholder("🔍 Voir une de mes cartes en grand")
            .addOptions(mine.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), value: c.id, emoji: RARITIES[c.rarity].emoji, description: `${numberOf(c)} · ${RARITIES[c.rarity].name}` })))
        )
      );
    }
  }
  return { embeds: [embed], files: [file], components: rows };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openBooster(interaction, client, pulls, title, pack = null) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const scoreBefore = collectionScore(userId);
  const results = pulls.map((p) => ({ ...p, isNew: give(userId, p.card, p.holo) }));
  const gained = collectionScore(userId) - scoreBefore;
  const n = results.length, best = results[n - 1];
  // Les animations se préparent à la suite, pendant qu'on regarde les précédentes
  const jobs = [];
  let chain = Promise.resolve();
  for (const [i, p] of results.entries()) {
    chain = chain.then(() => revealGif(p, i, n)).catch(() => null);
    jobs.push(chain);
  }
  const bestJob = chain.then(() => (isAnimated(best.card, best.holo) ? cardFile(best.card, best.holo) : null)).catch(() => null);
  const spreadJob = bestJob.then(() => drawSpread(results, title, gained)).catch(() => null);

  if (pack) {
    const intro = new AttachmentBuilder(await packOpenGif(pack.gen, pack.type), { name: "ouverture.gif" });
    await interaction
      .editReply({ embeds: [new EmbedBuilder().setColor(parseInt(PACKS[pack.type].accent.slice(1), 16)).setTitle(`${title} — ouverture…`).setImage("attachment://ouverture.gif")], files: [intro] })
      .catch(() => null);
    await sleep(2900);
  }
  // Révélation carte par carte, de la plus faible à la meilleure
  for (const [i, p] of results.entries()) {
    const r = RARITIES[p.card.rarity];
    const buffer = await jobs[i];
    const file = buffer ? new AttachmentBuilder(buffer, { name: `revelation-${i + 1}.gif` }) : await cardFile(p.card, p.holo);
    await interaction
      .editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(parseInt(r.color.slice(1), 16))
            .setTitle(`${title} — carte ${i + 1}/${n}${i === n - 1 && n > 1 ? " · la meilleure !" : ""}`)
            .setDescription(`${r.emoji} **${p.card.name}** — ${r.name}${p.holo ? " ✦ **HOLO**" : ""}${p.isNew ? "  🆕 **Nouvelle !**" : ""}`)
            .setImage(`attachment://${file.name}`),
        ],
        files: [file],
      })
      .catch(() => null);
    await sleep(revealDuration(p.card));
  }
  // Récapitulatif en éventail, puis la meilleure carte animée
  const spread = await spreadJob;
  const bestFile = await bestJob;
  const lines = results
    .slice()
    .reverse()
    .map((p) => `${RARITIES[p.card.rarity].emoji} **${p.card.name}** — ${RARITIES[p.card.rarity].name}${p.holo ? " ✦ HOLO" : ""}${p.isNew ? " 🆕" : ""}`);
  const embeds = [
    new EmbedBuilder()
      .setColor(parseInt(RARITIES[best.card.rarity].color.slice(1), 16))
      .setTitle(`${title} — récapitulatif`)
      .setDescription(`${lines.join("\n")}\n\n⭐ **+${gained}** point${gained > 1 ? "s" : ""} de collection`)
      .setImage(spread ? "attachment://recapitulatif.jpg" : "attachment://booster.png"),
  ];
  const files = [spread ? new AttachmentBuilder(await spread.encode("jpeg", 92), { name: "recapitulatif.jpg" }) : await collageFile(results)];
  if (bestFile) {
    embeds.push(
      new EmbedBuilder()
        .setColor(parseInt(RARITIES[best.card.rarity].color.slice(1), 16))
        .setTitle(`⭐ Meilleure carte : ${best.card.name}`)
        .setDescription(`${RARITIES[best.card.rarity].emoji} ${RARITIES[best.card.rarity].name}${best.holo ? " ✦ holographique" : ""}`)
        .setImage(`attachment://${bestFile.name}`)
    );
    files.push(bestFile);
  }
  const key = pack ? packKey(pack.gen, pack.type) : null;
  const left = key ? load().packs[userId]?.[key] ?? 0 : 0;
  const row = new ActionRowBuilder();
  if (left) row.addComponents(new ButtonBuilder().setCustomId(`carte_open_${key}`).setLabel(`Ouvrir un autre (${left} en réserve)`).setEmoji("✂️").setStyle(ButtonStyle.Success));
  row.addComponents(
    new ButtonBuilder().setCustomId("carte_inv").setLabel("Inventaire").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("carte_album").setLabel("Album").setEmoji("📒").setStyle(ButtonStyle.Secondary)
  );
  await interaction.editReply({ embeds, files, components: [row] }).catch(() => null);
  // Grosses cartes : annonce publique
  for (const p of results) {
    if (ORDER.indexOf(p.card.rarity) >= ORDER.indexOf("epique")) await announcePull(client, interaction.user, p);
  }
  await checkSeriesRewards(client, userId);
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

async function panelMessage() {
  const soldes = lawActive("soldesBoosters") ? ` *(soldes −${lawParam("soldesBoosters")} %)*` : "";
  const daily = lawActive("boosterDouble") ? "2 cartes" : "1 carte";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(PANEL_TITLE)
        .setDescription(
          `**${GENERATIONS[CURRENT_GEN].name} — ${GENERATIONS[CURRENT_GEN].title}**\nCollectionnez les cartes de Paris, de la Maison, des entreprises et des membres !\n\n` +
            `📦 **Standard** — 5 cartes · **${formatEuro(boosterPrice("standard"))}**${soldes}\n` +
            `💎 **Premium** — 5 cartes dont une **rare** garantie · **${formatEuro(boosterPrice("premium"))}**${soldes}\n` +
            `👑 **Prestige** — 3 cartes dont une **épique** garantie · **${formatEuro(boosterPrice("prestige"))}**${soldes}\n` +
            `🎁 **Booster gratuit** — ${daily} chaque jour\n\n` +
            "🎒 Les boosters achetés vont dans votre **inventaire** (`/inventaire`) : ouvrez-les tout de suite ou gardez-les. Seuls les boosters de la génération en cours sont vendus.\n" +
            "**Raretés** : ⚪ Commune · 🟢 Peu commune · 🔵 Rare · 🟣 Épique · 🟡 Légendaire · 🔴 Mythique · ✦ Holo (5 %)\n" +
            "✨ Des **cartes sauvages** apparaissent ici de temps en temps : soyez le premier à les attraper !\n" +
            "♻️ Recyclez vos doublons en **poussière d'étoile** pour fabriquer la carte de votre choix."
        )
        .addFields({ name: "🏆 Meilleurs collectionneurs", value: leaderboard() || "*Personne pour le moment.*" })
        .setImage("attachment://vitrine.jpg")
        .setTimestamp(),
    ],
    files: [await vitrineFile()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_booster_standard").setLabel("Standard").setEmoji("📦").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_premium").setLabel("Premium").setEmoji("💎").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_prestige").setLabel("Prestige").setEmoji("👑").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("carte_daily").setLabel("Booster gratuit").setEmoji("🎁").setStyle(ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_inv").setLabel("Inventaire").setEmoji("🎒").setStyle(ButtonStyle.Success),
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
  const payload = await panelMessage();
  if (msg) await msg.edit(payload).catch(() => null);
  else msg = await channelRef.send(payload).catch(() => null);
  if (msg && s.panelMessageId !== msg.id) {
    s.panelMessageId = msg.id;
    save();
  }
}

// --- Interactions ---
async function handleCartesInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "album") {
    const target = interaction.options.getUser("membre") ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: "❌ Les bots ne collectionnent pas de cartes.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await albumPayload(target, target.id === interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "inventaire") {
    const target = interaction.options.getUser("membre") ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: "❌ Les bots ne collectionnent pas de cartes.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await inventoryPayload(target, target.id === interaction.user.id));
    return true;
  }
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_")) return false;
  const userId = interaction.user.id;
  load();

  // Achat d'un ou plusieurs boosters : ils vont dans l'inventaire
  const buy = /^carte_(?:booster|buy)_(standard|premium|prestige)(?:_(\d+))?$/.exec(id);
  if (buy) {
    const type = buy[1], n = Math.min(10, Math.max(1, Number(buy[2] ?? 1))), P = PACKS[type];
    const price = boosterPrice(type) * n;
    if (changeBalance(userId, -price, `Achat de ${n} booster(s) de cartes ${P.name} (${GENERATIONS[CURRENT_GEN].code})`) === null) {
      await interaction.reply({ content: `❌ ${n > 1 ? `${n} boosters` : "Le booster"} ${P.name} coûte${n > 1 ? "nt" : ""} **${formatEuro(price)}** (vous avez ${formatEuro(readBalance(userId))}), ou votre compte est gelé.`, ephemeral: true });
      return true;
    }
    const key = packKey(CURRENT_GEN, type);
    addPacks(userId, key, n);
    await interaction.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(await packShineGif(CURRENT_GEN, type), { name: "booster.gif" });
    const G = GENERATIONS[CURRENT_GEN];
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(P.accent.slice(1), 16))
          .setTitle(`${P.emoji} ${n > 1 ? `${n} boosters ${P.name} ajoutés` : `Booster ${P.name} ajouté`} à votre inventaire`)
          .setDescription(`**${G.name} — ${G.title}** · ${P.tagline.toLowerCase()}\nVous en avez maintenant **${load().packs[userId]?.[key] ?? 0}** en réserve.\n\nOuvrez-le maintenant ou gardez-le pour plus tard : quand la génération suivante sortira, ceux-ci ne seront plus vendus.`)
          .setImage("attachment://booster.gif")
          .setFooter({ text: `Payé ${canvasText(formatEuro(price))} · /inventaire pour voir vos boosters` }),
      ],
      files: [file],
      components: [packButtons(type)],
    });
    panelDirty = true;
    refreshRichestLeaderboard(client).catch(() => null);
    return true;
  }

  if (id === "carte_daily") {
    const s = load();
    if (s.daily[userId] === dayKey()) {
      await interaction.reply({ content: "🎁 Vous avez déjà récupéré votre booster gratuit aujourd'hui. Revenez demain !", ephemeral: true });
      return true;
    }
    s.daily[userId] = dayKey();
    save();
    addPacks(userId, packKey(CURRENT_GEN, "jour"), 1);
    await interaction.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(await packShineGif(CURRENT_GEN, "jour"), { name: "booster.gif" });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x34d399)
          .setTitle("🎁 Votre booster gratuit du jour est dans votre inventaire")
          .setDescription(`${lawActive("boosterDouble") ? "**2 cartes** grâce à la loi en vigueur" : "**1 carte**"} à l'ouverture. Ouvrez-le maintenant ou gardez-le pour plus tard.`)
          .setImage("attachment://booster.gif"),
      ],
      files: [file],
      components: [packButtons("jour")],
    });
    panelDirty = true;
    return true;
  }

  // Ouvrir un booster de l'inventaire
  if (id.startsWith("carte_open_") || id === "carte_inv_open") {
    const key = id === "carte_inv_open" ? interaction.values[0] : id.slice("carte_open_".length);
    const pack = parsePack(key);
    if (!pack || !takePack(userId, key)) {
      await interaction.reply({ content: "❌ Vous n'avez plus ce booster dans votre inventaire.", ephemeral: true });
      return true;
    }
    const P = PACKS[pack.type];
    await openBooster(interaction, client, packPulls(pack.gen, pack.type), `${P.emoji} Booster ${P.name} · ${GENERATIONS[pack.gen].code}`, pack);
    panelDirty = true;
    return true;
  }

  if (id === "carte_inv") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await inventoryPayload(interaction.user, true));
    return true;
  }

  if (id === "carte_shop") {
    await interaction.reply(shopPayload());
    return true;
  }

  if (id === "carte_inv_show") {
    await interaction.deferReply({ ephemeral: true });
    const payload = await inventoryPayload(interaction.user, false);
    const sent = await channelRef?.send({ content: `📣 ${interaction.user} montre son inventaire :`, ...payload, allowedMentions: { parse: [] } }).catch(() => null);
    await interaction.editReply({ content: sent ? `✅ Votre inventaire est affiché dans ${channelRef}.` : "❌ Impossible de publier l'inventaire pour le moment." });
    return true;
  }

  // Ouverture rapide : jusqu'à 10 boosters d'un coup, avec un récapitulatif
  if (id === "carte_inv_all") {
    const owned = packsOf(userId);
    if (!owned.length) {
      await interaction.reply({ content: "🎒 Vous n'avez aucun booster en réserve.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const opened = {};
    const results = [];
    let total = 0;
    for (const [key, n] of owned) {
      const pack = parsePack(key);
      for (let i = 0; i < n && total < 10; i++) {
        if (!takePack(userId, key)) break;
        total++;
        opened[key] = (opened[key] ?? 0) + 1;
        for (const p of packPulls(pack.gen, pack.type)) results.push({ ...p, isNew: give(userId, p.card, p.holo) });
      }
    }
    const counts = ORDER.map((r) => [r, results.filter((p) => p.card.rarity === r).length]).filter(([, n]) => n);
    const best = [...results].sort((a, b) => ORDER.indexOf(b.card.rarity) - ORDER.indexOf(a.card.rarity) || b.holo - a.holo).slice(0, 8);
    const news = results.filter((p) => p.isNew);
    const holos = results.filter((p) => p.holo).length;
    const left = packsOf(userId).reduce((a, [, n]) => a + n, 0);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe9c46a)
          .setTitle(`⚡ ${total} booster${total > 1 ? "s" : ""} ouvert${total > 1 ? "s" : ""} — ${results.length} cartes`)
          .setDescription(
            `${counts.map(([r, n]) => `${RARITIES[r].emoji} ${n}`).join(" · ")}${holos ? ` · ✦ ${holos} holo${holos > 1 ? "s" : ""}` : ""}\n\n` +
              `**Ouverts** : ${Object.entries(opened).map(([k, n]) => `${packLabel(k)} ×${n}`).join(", ")}\n` +
              (news.length ? `**🆕 Nouvelles cartes (${news.length})** : ${news.slice(0, 15).map((p) => `${RARITIES[p.card.rarity].emoji} ${p.card.name}${p.holo ? " ✦" : ""}`).join(", ")}${news.length > 15 ? "…" : ""}` : "*Aucune nouvelle carte cette fois.*") +
              (left ? `\n\n🎒 Il vous reste **${left}** booster${left > 1 ? "s" : ""}.` : "")
          )
          .setImage("attachment://booster.png")
          .setFooter({ text: "Les 8 meilleures cartes de l'ouverture" }),
      ],
      files: [await collageFile(best)],
    });
    for (const p of results) if (ORDER.indexOf(p.card.rarity) >= ORDER.indexOf("legendaire")) await announcePull(client, interaction.user, p);
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }

  if (id === "carte_album") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await albumPayload(interaction.user, true));
    return true;
  }

  // ancien menu des séries : ouvre directement la page de la série
  if (id === "carte_series") {
    await interaction.deferUpdate();
    await interaction.editReply(await albumPayload(interaction.user, true, interaction.values[0], 0));
    return true;
  }

  if (id.startsWith("carte_alb_nav_") || /^carte_alb_[^_]+_\w+_-?\d+$/.test(id)) {
    let targetId, view, page = 0;
    if (id.startsWith("carte_alb_nav_")) {
      targetId = id.slice("carte_alb_nav_".length);
      view = interaction.values[0];
    } else {
      const m = /^carte_alb_([^_]+)_(\w+)_(-?\d+)$/.exec(id);
      if (!m) return false;
      [, targetId, view] = m;
      page = Number(m[3]);
    }
    const target = targetId === userId ? interaction.user : await client.users.fetch(targetId).catch(() => null);
    if (!target) return false;
    await interaction.deferUpdate();
    await interaction.editReply(await albumPayload(target, targetId === userId, view, page));
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
    const s = load();
    const on = !s.optIn[userId];
    if (on) s.optIn[userId] = true;
    else delete s.optIn[userId];
    save();
    if (on) {
      await cacheMember(interaction.member);
      const card = memberCards().find((c) => c.memberId === userId);
      await interaction.reply({
        content: `👤 Votre carte de membre est créée ! Note **${card?.rating ?? "?"}** — ${card ? MEMBER_TIERS[card.rarity]?.name.toLowerCase() : ""}, selon votre rôle le plus haut${card?.role ? ` (**${card.role.name}**)` : ""}. Plus votre rôle est haut, plus votre carte est forte. Elle peut maintenant sortir dans les boosters. (Re-cliquez pour la retirer.)`,
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
  // place du rôle le plus haut dans la hiérarchie du serveur (0 = tout en bas, 1 = tout en haut)
  const roles = [...member.guild.roles.cache.values()].filter((r) => r.id !== member.guild.id && !r.managed).sort((a, b) => a.position - b.position);
  const top = member.roles.highest;
  const index = roles.findIndex((r) => r.id === top?.id);
  const role = top && top.id !== member.guild.id ? { name: top.name, color: top.hexColor, norm: roles.length > 1 && index >= 0 ? index / (roles.length - 1) : 0 } : null;
  let messages = 0;
  try {
    messages = require("./levels").getLevelSummary(member.id).messages;
  } catch {
    // niveaux indisponibles
  }
  memberCache.set(member.id, {
    name: member.displayName,
    avatar: member.user.displayAvatarURL({ extension: "png", size: 512 }),
    stars,
    role,
    joinedAt: member.joinedTimestamp,
    messages,
    balance: readBalance(member.id) ?? 0,
  });
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
  client.on("guildMemberUpdate", (_, member) => {
    if (load().optIn[member.id]) cacheMember(member).catch(() => null);
  });
  await refreshPanel(client);
  // prépare les animations des boosters en arrière-plan : le premier acheteur n'attend pas
  setTimeout(async () => {
    for (const card of allCards()) await artImage(card).catch(() => null); // illustrations 3D pour l'album
    for (const type of PACK_ORDER) {
      await packShineGif(CURRENT_GEN, type).catch(() => null);
      await packOpenGif(CURRENT_GEN, type).catch(() => null);
    }
  }, 30 * 1000);

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
