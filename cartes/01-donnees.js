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
  UserSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { createCanvas, loadImage, GlobalFonts, Path2D } = require("@napi-rs/canvas");
const { changeBalance, readBalance, formatEuro, refreshRichestLeaderboard, isGerant } = require("./economie");
const { lawActive, lawParam } = require("./politique");
const { findOrCreateChannel, findOrCreateRole } = require("./salons");
const { deleteLater, MINUTE } = require("./nettoyage");
const { pseudo } = require("./noms");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966";
const MEMBER_CARD_ROLE_ID = "1509983439968010401"; // tous les membres avec ce rôle ont automatiquement leur carte // le salon des cartes est rangé à côté des annonces
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
  ["yuji-syuku-kanji.ttf", "CardBrush"], // kanji au pinceau des blasons d'équipe
  ["zen-antique-kanji.ttf", "CardKanji"],
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
const G2 = (...args) => ({ ...C(...args), gen: 2 });
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
  // Génération 2 : préparée à l'avance, elle n'apparaît qu'une fois lancée avec /generation
  voyage: {
    name: "Le Grand Voyage",
    emoji: "🌍",
    reward: 8000,
    gen: 2,
    cards: [
      G2("v_avion", "Avion de ligne", "✈️", "commune", "Ceinture attachée, direction l'inconnu."),
      G2("v_carte", "Carte du monde", "🗺️", "commune", "Il reste tant de pays à cocher."),
      G2("v_sac", "Sac à dos", "🎒", "commune", "Tout ce qu'il faut, et rien de plus."),
      G2("v_photo", "Appareil photo", "📷", "commune", "Un souvenir à chaque déclic."),
      G2("v_boussole", "Boussole", "🧭", "commune", "Le nord n'a jamais semblé si loin."),
      G2("v_billet", "Billet de train", "🎫", "commune", "Voiture 12, place 46, côté fenêtre."),
      G2("v_plage", "Plage", "🏖️", "commune", "Sable chaud et parasol."),
      G2("v_tgv", "TGV", "🚄", "peucommune", "Paris–Marseille en trois heures."),
      G2("v_croisiere", "Croisière", "🛳️", "peucommune", "Le monde depuis le pont supérieur."),
      G2("v_newyork", "New York", "🗽", "peucommune", "La ville qui ne dort jamais."),
      G2("v_londres", "Londres", "🎡", "peucommune", "Thé à cinq heures et grande roue."),
      G2("v_ile", "Île déserte", "🏝️", "peucommune", "Personne à des kilomètres."),
      G2("v_fuji", "Mont Fuji", "🗻", "rare", "Le sommet sacré du Japon."),
      G2("v_kyoto", "Kyoto", "🏯", "rare", "Mille temples et autant de cerisiers."),
      G2("v_istanbul", "Istanbul", "🕌", "rare", "Entre deux continents."),
      G2("v_volcan", "Volcan", "🌋", "rare", "Ça gronde sous vos pieds."),
      G2("v_fusee", "Fusée", "🚀", "epique", "Prochain arrêt : la Lune."),
      G2("v_sahara", "Sahara", "🏜️", "epique", "Des dunes à perte de vue."),
      G2("v_aurore", "Voie lactée", "🌌", "epique", "Un ciel sans fin au-dessus du désert."),
      G2("v_paques", "Île de Pâques", "🗿", "legendaire", "Ils veillent depuis des siècles."),
      G2("v_tourdumonde", "Le Tour du Monde", "🌍", "mythique", "Quatre-vingts jours, et pas un de plus."),
    ],
  },
};

// Cartes d'événements : jamais dans les boosters, offertes lors des grands moments
const EVENTS = {
  ev_star: C("ev_star", "Star de la semaine", "🌟", "epique", "Élu(e) Membre Star par la Fondation."),
  ev_maire: C("ev_maire", "Élu(e) Maire", "🗳️", "legendaire", "Le peuple a parlé."),
  ev_jackpot: C("ev_jackpot", "Jackpot !", "💸", "legendaire", "Trois 7 alignés à la machine à sous."),
  ev_champion: C("ev_champion", "Champion de l'Arène", "🏆", "mythique", "Numéro un de la saison."),
  ev_podium: C("ev_podium", "Podium de l'Arène", "🏅", "legendaire", "Sur le podium de la saison."),
};

// Cartes shiny : illustration pleine page toute verte, et une chance sur 250 de remplacer une carte tirée d'un booster
const SHINIES = {
  sh_trefle: { ...C("sh_trefle", "Trèfle d'Émeraude", "🍀", "rare", "Une chance sur mille de croiser son éclat vert."), shiny: true },
};
const SHINY_CHANCE = 1 / 250;

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
  state.memberArchive ??= {}; // dernières infos connues des cartes de membres (pour les exemplaires déjà obtenus)
  state.rewards ??= {};
  state.wild ??= null;
  state.market ??= []; // annonces du marché (cartes retirées de l'inventaire pendant la vente)
  state.sales ??= []; // historique des ventes (cote)
  state.trades ??= {}; // propositions d'échange
  state.coteHistory ??= {}; // relevés quotidiens des cotes (tendance)
  state.arena ??= {}; // userId -> { elo, w, l, d, streak }
  state.arenaEscrow ??= {}; // argent bloqué pendant les combats (remboursé si le bot redémarre)
  state.packs ??= {};
  state.welcomed ??= {}; // membres ayant reçu le pack de bienvenue
  state.metrics ??= {}; // statistiques de la semaine (rapport du staff)
  state.pairs ??= {}; // échanges et ventes entre deux mêmes membres (anti double compte)
  state.pairAlerted ??= {};
  state.quests ??= {}; // quêtes du jour
  state.userStats ??= {}; // statistiques de jeu (succès)
  state.achievements ??= {}; // succès débloqués et titre choisi
  state.showcase ??= {}; // vitrine : trois cartes exposées
  state.arenaWeekly ??= {}; // défi d'Arène de la semaine
  CURRENT_GEN = state.currentGen ?? 1; // userId -> { « g1_standard »: nombre de boosters fermés }
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
function memberCards(activeOnly = false) {
  const entries = activeOnly ? [...memberCache.entries()] : Object.entries({ ...load().memberArchive, ...Object.fromEntries(memberCache) });
  return entries
    .map(([id, m]) => {
      const { rating, rarity, stats } = memberProfile(id, m);
      const text = m.role ? `${m.role.name} de la Maison${m.stars ? ` · Membre Star ${m.stars} fois` : ""}.` : "Membre de la Maison.";
      return { ...C(`mb_${id}`, m.name, "👤", rarity, text), avatar: m.avatar, memberId: id, role: m.role, rating, stars: m.stars, memberStats: stats, joinedAt: m.joinedAt };
    });
}

// séries fixes déjà lancées (une série d'une génération future reste cachée)
const launchedSeries = () => Object.values(SERIES).filter((sr) => (sr.gen ?? 1) <= CURRENT_GEN);
function allCards() {
  return [...launchedSeries().flatMap((sr) => sr.cards), ...companyCards(), ...memberCards(), ...Object.values(EVENTS), ...Object.values(SHINIES), ...Object.values(SEASON_CARDS)];
}
function boosterPool() {
  return [...launchedSeries().flatMap((sr) => sr.cards), ...companyCards(), ...memberCards(true)];
}
function findCard(id) {
  return allCards().find((c) => c.id === id) ?? null;
}
function seriesOf(card) {
  if (card.id.startsWith("p_")) return "paris";
  if (card.id.startsWith("m_")) return "maison";
  if (card.id.startsWith("co_")) return "entreprises";
  if (card.id.startsWith("mb_")) return "membres";
  if (card.id.startsWith("v_")) return "voyage";
  if (card.id.startsWith("hw_") || card.id.startsWith("xm_")) return "saisons";
  return "evenements";
}
const SERIES_LABELS = { paris: "🗼 Paris", maison: "🏡 La Maison", voyage: "🌍 Le Grand Voyage", saisons: "🎃 Saisons", entreprises: "🏢 Les Entreprises", membres: "👤 Les Membres", evenements: "⚡ Événements" };

// Statistiques stables (pour les futures batailles), selon la rareté
function statsOf(card) {
  if (card.memberStats) return { prestige: card.memberStats.PRE, influence: Math.max(card.memberStats.STA, card.memberStats.ACT), chance: card.memberStats.CHA };
  let h = 0;
  for (const ch of card.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = { commune: 20, peucommune: 32, rare: 45, epique: 60, legendaire: 75, mythique: 88 }[card.rarity];
  const roll = (k) => Math.min(99, base + ((h >> (k * 5)) % 12));
  return { prestige: roll(0), influence: roll(1), chance: roll(2) };
}

// Chiffres de combat d'une carte (affichés sur la carte et utilisés dans l'Arène) — la version holo est un peu plus forte
function combatProfile(card, holo = false) {
  const st = statsOf(card);
  const hp = Math.round((70 + st.prestige * 1.3) * (holo ? 1.1 : 1));
  const atk = Math.round(st.influence * (holo ? 1.05 : 1));
  return {
    hp,
    atk,
    luck: st.chance,
    attack: Math.round(10 + atk * 0.55),
    special: Math.round(18 + atk * 1.1),
    attackName: card.memberStats ? memberMoves(card)[0].name : "Attaque",
    specialName: specialName(card),
  };
}

function numberOf(card) {
  const key = seriesOf(card);
  const list = SERIES[key] ? SERIES[key].cards : allCards().filter((c) => seriesOf(c) === key);
  const i = list.findIndex((c) => c.id === card.id);
  return `#${String(i + 1).padStart(3, "0")}/${String(list.length).padStart(3, "0")}`;
}

