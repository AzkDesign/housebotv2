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

async function drawCard(card, holo = false, t = 0.37, mode = animMode(card, holo)) {
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
function composeFrame(src, back, mode, t, edgeColor = "#1a1a1a") {
  const FW = 420, FH = 588, PAD = 32;
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
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  const img = cosA < 0 ? back : src;
  const scale = Math.max(0.02, Math.abs(cosA));
  const cx = CW / 2, cy = CH / 2 - 8 + lift;

  // la carte projetée, sur fond transparent
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

  const c = createCanvas(CW, CH);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#313338";
  ctx.fillRect(0, 0, CW, CH);
  // ombre au sol, floue
  ctx.save();
  ctx.filter = "blur(7px)";
  ctx.fillStyle = `rgba(0,0,0,${0.45 - lift / 40})`;
  ctx.beginPath();
  ctx.ellipse(CW / 2 + (axis === "h" ? sinA * 30 : 0), CH - 18, FW * 0.42 * (axis === "h" ? scale : 1) * (1 - lift / 60), 9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // épaisseur de la carte (tranche visible quand elle pivote)
  const edge = Math.round((axis === "h" ? sinA : -sinA) * 7);
  if (Math.abs(edge) >= 1) {
    const sil = createCanvas(CW, CH);
    const s = sil.getContext("2d");
    s.drawImage(face, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = edgeColor;
    s.fillRect(0, 0, CW, CH);
    for (let d = 1; d <= Math.abs(edge); d++) ctx.drawImage(sil, axis === "h" ? Math.sign(edge) * d : 0, axis === "v" ? Math.sign(edge) * d : 0);
  }
  ctx.drawImage(face, 0, 0);
  const data = ctx.getImageData(0, 0, CW, CH);
  // tramage ordonné léger : évite les bandes de couleur dans les dégradés du GIF
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

const gifCache = new Map();
async function animatedCard(card, holo) {
  const key = `${card.id}${holo ? "*" : ""}`;
  if (gifCache.has(key)) return gifCache.get(key);
  const mode = animMode(card, holo);
  const frames = mode === "flip" ? 40 : 32;
  const back = mode === "flip" ? drawBack(card.rarity) : null;
  const enc = GIFEncoder();
  for (let f = 0; f < frames; f++) {
    const t = f / frames;
    const src = await drawCard(card, holo, t, mode);
    const { data, width, height } = composeFrame(src, back, mode, t, METAL[card.rarity][3]);
    const palette = quantize(data, 256);
    enc.writeFrame(applyPalette(data, palette), width, height, { palette, delay: mode === "flip" ? 50 : 55 });
  }
  enc.finish();
  const buffer = Buffer.from(enc.bytes());
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
