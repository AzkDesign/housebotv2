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

// Renvoie tous les réglages en cours : P().corporateTax, P().minSalary…
function P() {
  const s = load();
  const out = {};
  for (const [key, lever] of Object.entries(LEVERS)) out[key] = s.values[key] ?? lever.default;
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

module.exports = { LEVERS, P, setLever, formatLever, boostSector, sectorBoost };
