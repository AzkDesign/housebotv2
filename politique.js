// Taux et réglages fixés par le maire. Lu par les entreprises, les impôts,
// l'Airbnb et le casino ; modifié uniquement par la mairie.
const fs = require("fs");
const path = require("path");

// Valeurs par défaut et limites autorisées pour le maire.
const LEVERS = {
  corporateTax: { label: "Impôt sur les sociétés", default: 0.2, min: 0, max: 0.5, percent: true },
  dividendTax: { label: "Taxe sur les dividendes", default: 0.1, min: 0, max: 0.3, percent: true },
  housingMultiplier: { label: "Taxe d'habitation (multiplicateur)", default: 1, min: 0, max: 3, factor: true },
  wealthMultiplier: { label: "Impôt sur la fortune (multiplicateur)", default: 1, min: 0, max: 3, factor: true },
  airbnbMaisonShare: { label: "Part de la Maison sur l'Airbnb", default: 0.8, min: 0.5, max: 0.95, percent: true },
  duelTax: { label: "Taxe sur les défis du casino", default: 0.05, min: 0, max: 0.2, percent: true },
  registrationFee: { label: "Frais d'immatriculation", default: 500, min: 0, max: 5000, euro: true },
  minSalary: { label: "Salaire minimum (par semaine)", default: 200, min: 0, max: 1000, euro: true },
};

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("politique-state.json");
let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.values ??= {};
  state.sectorBoosts ??= {}; // secteur -> fin du plan de relance (timestamp)
  return state;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Régimes ---
const REGIMES = {
  democratie: {
    name: "Démocratie",
    emoji: "🗳️",
    title: "Maire",
    petition: 0.3,
    description: "Le maire gouverne, et peut consulter les citoyens par des votes. Pétition de destitution à 30 %.",
  },
  monarchie: {
    name: "Monarchie",
    emoji: "👑",
    title: "Monarque",
    petition: 0.5,
    description: "Le maire règne en monarque et distribue des titres de noblesse. Pétition de destitution à 50 %.",
  },
  dictature: {
    name: "Dictature",
    emoji: "⚔️",
    title: "Dictateur",
    petition: 0.6,
    description: "Couvre-feu, confiscations, suspension d'entreprises, censure du Journal officiel. Pétition de destitution à 60 %.",
  },
  anarchie: {
    name: "Anarchie",
    emoji: "🏴",
    title: "Maire (sans pouvoir)",
    petition: 0.3,
    description: "Plus aucun impôt, aucune aide : chacun pour soi. Le maire ne garde que les événements et les associations.",
  },
};

function regime() {
  return load().regime ?? "democratie";
}

function setRegime(id) {
  const s = load();
  s.regime = id;
  s.regimeChangedAt = Date.now();
  if (id !== "dictature") s.curfew = false;
  save();
}

function regimeChangedAt() {
  return load().regimeChangedAt ?? 0;
}

// Couvre-feu (dictature) : casino fermé, plus de demandes Airbnb.
function curfew() {
  return regime() === "dictature" && Boolean(load().curfew);
}

function setCurfew(on) {
  load().curfew = on;
  save();
}

// En anarchie, aucun impôt ni taxe ne s'applique.
const ANARCHY_OVERRIDES = {
  corporateTax: 0,
  dividendTax: 0,
  housingMultiplier: 0,
  wealthMultiplier: 0,
  airbnbMaisonShare: 0,
  duelTax: 0,
  minSalary: 0,
};

// Renvoie tous les réglages en cours : P().corporateTax, P().minSalary…
function P() {
  const s = load();
  const out = {};
  for (const [key, lever] of Object.entries(LEVERS)) out[key] = s.values[key] ?? lever.default;
  if (regime() === "anarchie") Object.assign(out, ANARCHY_OVERRIDES);
  return out;
}

function setLever(key, value) {
  const lever = LEVERS[key];
  if (!lever) throw new Error(`Réglage inconnu : ${key}`);
  const v = Math.min(lever.max, Math.max(lever.min, value));
  load().values[key] = v;
  save();
  return v;
}

function formatLever(key, value) {
  const lever = LEVERS[key];
  if (lever.percent) return `${Math.round(value * 1000) / 10} %`;
  if (lever.factor) return `×${String(value).replace(".", ",")}`;
  return `${value.toLocaleString("fr-FR")} €`;
}

// Plan de relance : les clients arrivent plus vite dans un secteur.
function boostSector(sector, until) {
  load().sectorBoosts[sector] = until;
  save();
}

function sectorBoost(sector) {
  return (load().sectorBoosts[sector] ?? 0) > Date.now();
}

// --- Lois de la Maison ---
// Chaque loi est appliquée réellement par le bot tant qu'elle est en vigueur
// (et suspendue pendant l'anarchie).
const LAWS = {
  casinoMercredi: {
    name: "Loi du mercredi festif",
    emoji: "🎰",
    effect: "Le casino ouvre aussi le mercredi, de 20h à 2h.",
  },
  miseMax: {
    name: "Loi sur le jeu responsable",
    emoji: "🛑",
    effect: (v) => `Mise maximale de ${v.toLocaleString("fr-FR")} € par partie au casino.`,
    param: { label: "Mise maximale (€)", min: 50, max: 100000, default: 500, unit: "€" },
  },
  interdictionDefis: {
    name: "Loi anti-duels",
    emoji: "🚫",
    effect: "Les défis d'argent entre membres sont interdits au casino.",
  },
  taxeJackpot: {
    name: "Loi sur la taxe des jackpots",
    emoji: "💰",
    effect: (v) => `${v} % de chaque jackpot revient au budget de la ville.`,
    param: { label: "Part pour la ville (%)", min: 1, max: 50, default: 10, unit: "%" },
  },
  primeBienvenue: {
    name: "Loi d'accueil",
    emoji: "🎁",
    effect: (v) => `Chaque nouveau membre accepté reçoit ${v.toLocaleString("fr-FR")} € de la ville.`,
    param: { label: "Prime de bienvenue (€)", min: 50, max: 10000, default: 500, unit: "€" },
  },
  libreCirculation: {
    name: "Loi de libre circulation",
    emoji: "📦",
    effect: "Les déménagements sont gratuits.",
  },
  commercesTard: {
    name: "Loi des nocturnes",
    emoji: "🌃",
    effect: "Les entreprises reçoivent des clients 2 h de plus le soir.",
  },
  planTourisme: {
    name: "Plan tourisme",
    emoji: "🏖️",
    effect: "Les voyageurs Airbnb envoient leurs demandes 50 % plus souvent.",
  },
  soldesBoosters: {
    name: "Loi des soldes de cartes",
    emoji: "🃏",
    effect: (v) => `Tous les boosters de cartes sont à −${v} %.`,
    param: { label: "Réduction sur les boosters (%)", min: 5, max: 70, default: 30, unit: "%" },
  },
  boosterDouble: {
    name: "Loi du double booster",
    emoji: "🎴",
    effect: "Le booster gratuit du jour contient 2 cartes au lieu d'une.",
  },
};

function lawEffect(key, param) {
  const law = LAWS[key];
  return typeof law.effect === "function" ? law.effect(param ?? law.param?.default) : law.effect;
}

// Une loi s'applique-t-elle en ce moment ? (jamais pendant l'anarchie)
function lawActive(key) {
  return regime() !== "anarchie" && Boolean(load().laws?.[key]);
}

function lawParam(key) {
  return load().laws?.[key]?.param ?? LAWS[key]?.param?.default ?? null;
}

function listLaws() {
  return Object.entries(load().laws ?? {}).map(([key, l]) => ({ key, ...l, ...LAWS[key] }));
}

function enactLaw(key, param, how) {
  const s = load();
  s.laws ??= {};
  s.lawCounter = (s.lawCounter ?? 0) + 1;
  s.laws[key] = { param: param ?? null, number: s.lawCounter, since: Date.now(), how };
  save();
  return s.laws[key];
}

function repealLaw(key) {
  const s = load();
  const law = s.laws?.[key];
  if (law) delete s.laws[key];
  save();
  return law;
}

module.exports = {
  LAWS,
  lawEffect,
  lawActive,
  lawParam,
  listLaws,
  enactLaw,
  repealLaw,
  LEVERS,
  P,
  setLever,
  formatLever,
  boostSector,
  sectorBoost,
  REGIMES,
  regime,
  setRegime,
  regimeChangedAt,
  curfew,
  setCurfew,
};
