
// --- Clash de la Maison : chaque joueur bâtit sa Maison, la défend, et attaque celles des autres ---
// Ressources propres au jeu (🪙 Or et 🔮 Essence) : elles ne touchent pas aux euros du serveur.
// Les troupes sont les cartes de la collection du joueur ; les combats sont simulés puis animés.
const CLASH_GRID = 24;
const CLASH_BUILDINGS = {
  manoir: { name: "Le Manoir", emoji: "🏰", fluent: "Castle", kind: "core", size: 3, color: "#a78bfa", hp: (L) => 1200 + 700 * L, cost: (L) => ({ or: [0, 0, 1500, 5000, 14000, 32000, 70000][L] }), time: (L) => [0, 0, 15, 60, 180, 480, 900][L] },
  mine: { name: "Mine d'or", emoji: "⛏️", fluent: "Pick", kind: "resource", res: "or", size: 2, color: "#fbbf24", hp: (L) => 350 + 160 * L, rate: (L) => 80 * L, cost: (L) => ({ essence: 120 * L * L }), time: (L) => Math.round(3 * L * L) },
  distillerie: { name: "Distillerie d'essence", emoji: "⚗️", fluent: "Alembic", kind: "resource", res: "essence", size: 2, color: "#c084fc", hp: (L) => 350 + 160 * L, rate: (L) => 70 * L, cost: (L) => ({ or: 120 * L * L }), time: (L) => Math.round(3 * L * L) },
  coffre: { name: "Coffre-fort", emoji: "🧰", fluent: "Toolbox", kind: "storage", size: 2, color: "#f59e0b", hp: (L) => 600 + 260 * L, store: (L) => 1500 * L * L, cost: (L) => ({ or: 220 * L * L, essence: 80 * L * L }), time: (L) => Math.round(5 * L * L) },
  caserne: { name: "Caserne", emoji: "⛺", fluent: "Tent", kind: "army", size: 2, color: "#22c55e", hp: (L) => 500 + 220 * L, slots: (L) => 3 + L, cost: (L) => ({ essence: 280 * L * L }), time: (L) => Math.round(6 * L * L) },
  canon: { name: "Canon", emoji: "💣", fluent: "Bomb", kind: "defense", size: 2, color: "#ef4444", hp: (L) => 520 + 230 * L, dps: (L) => 14 + 9 * L, range: 4.5, cost: (L) => ({ or: 300 * L * L }), time: (L) => Math.round(5 * L * L) },
  tour: { name: "Tour de l'IRF", emoji: "🏹", fluent: "Bow and arrow", kind: "defense", size: 2, color: "#38bdf8", hp: (L) => 460 + 190 * L, dps: (L) => 9 + 7 * L, range: 7, cost: (L) => ({ or: 360 * L * L }), time: (L) => Math.round(6 * L * L) },
  mortier: { name: "Mortier", emoji: "🎯", fluent: "Bullseye", kind: "defense", size: 2, color: "#fb7185", hp: (L) => 600 + 240 * L, dps: (L) => 8 + 6 * L, range: 8, minRange: 2.5, splash: 1.8, cost: (L) => ({ or: 600 * L * L }), time: (L) => Math.round(8 * L * L) },
};
// nombre de bâtiments autorisés selon le niveau du Manoir
const CLASH_COUNTS = {
  mine: [0, 1, 2, 2, 3, 3, 4],
  distillerie: [0, 1, 1, 2, 2, 3, 3],
  coffre: [0, 1, 1, 2, 2, 2, 3],
  caserne: [0, 1, 1, 1, 1, 2, 2],
  canon: [0, 1, 1, 2, 2, 3, 3],
  tour: [0, 0, 1, 1, 2, 2, 3],
  mortier: [0, 0, 0, 1, 1, 2, 2],
};
const CLASH_MAX_MANOIR = 6;
const CLASH_BUILDERS = 2;
const CLASH_RES = { or: ["🪙", "Or"], essence: ["🔮", "Essence"] };
const CLASH_ATTACKS_PER_DAY = 10;
const CLASH_TROOP_COST = 25; // essence par troupe engagée
const CLASH_SPEEDUP_DUST = 2; // ✨ par minute de chantier restante

function clashState() {
  const st = load();
  st.clash ??= {};
  st.clashMeta ??= { war: null, wars: [] };
  return st.clash;
}
function newBase(user) {
  let id = 0;
  const b = (type, level = 1) => ({ id: `b${id++}`, type, level });
  return {
    owner: user.id,
    name: user.name,
    avatar: user.avatar ?? null,
    created: Date.now(),
    res: { or: 1600, essence: 1600 },
    resAt: Date.now(),
    buildings: [b("manoir"), b("mine"), b("distillerie"), b("coffre"), b("caserne"), b("canon")],
    army: [],
    trophies: 0,
    shield: 0,
    log: [],
    attacks: { day: null, n: 0 },
    stats: { attacks: 0, wins: 0, stars: 0, defenses: 0, defWins: 0, loot: 0 },
  };
}
const manoirOf = (base) => base.buildings.find((x) => x.type === "manoir")?.level ?? 1;
// capacité de stockage : le Manoir et les coffres
function clashCap(base) {
  const L = manoirOf(base);
  return 1000 * L + base.buildings.filter((x) => x.type === "coffre").reduce((a, x) => a + CLASH_BUILDINGS.coffre.store(x.level), 0);
}
// production : accumulée au fil du temps jusqu'au plafond
function clashTick(base) {
  const now = Date.now(), hours = (now - (base.resAt ?? now)) / 3600000;
  if (hours > 0) {
    const cap = clashCap(base);
    for (const res of ["or", "essence"]) {
      const rate = base.buildings.filter((x) => CLASH_BUILDINGS[x.type].res === res && !x.upgrading).reduce((a, x) => a + CLASH_BUILDINGS[x.type].rate(x.level), 0);
      base.res[res] = Math.min(cap, Math.floor((base.res[res] ?? 0) + rate * hours));
    }
  }
  base.resAt = now;
  // chantiers terminés
  const done = [];
  for (const x of base.buildings) {
    if (x.upgrading && x.upgrading.done <= now) {
      x.level = x.upgrading.to;
      done.push(x);
      delete x.upgrading;
    }
  }
  return done;
}
function clashRates(base) {
  const out = {};
  for (const res of ["or", "essence"]) out[res] = base.buildings.filter((x) => CLASH_BUILDINGS[x.type].res === res && !x.upgrading).reduce((a, x) => a + CLASH_BUILDINGS[x.type].rate(x.level), 0);
  return out;
}
const busyBuilders = (base) => base.buildings.filter((x) => x.upgrading).length;
const maxLevelOf = (type, manoir) => (type === "manoir" ? CLASH_MAX_MANOIR : Math.min(CLASH_MAX_MANOIR, manoir + (type === "mine" || type === "distillerie" ? 1 : 0)));
const armySlots = (base) => base.buildings.filter((x) => x.type === "caserne").reduce((a, x) => a + CLASH_BUILDINGS.caserne.slots(x.level), 0);
const costText = (cost) => Object.entries(cost).filter(([, v]) => v > 0).map(([k, v]) => `${v.toLocaleString("fr-FR")} ${k === "or" ? "or" : "essence"}`).join(" + ") || "gratuit";
const minutesText = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}` : `${Math.floor(m / 1440)} j ${Math.floor((m % 1440) / 60)} h`);
// ce que le joueur peut construire ou améliorer maintenant
function clashOptions(base) {
  const L = manoirOf(base), opts = [];
  for (const x of base.buildings) {
    const def = CLASH_BUILDINGS[x.type];
    if (x.upgrading || x.level >= maxLevelOf(x.type, L)) continue;
    opts.push({ kind: "up", id: x.id, type: x.type, to: x.level + 1, cost: def.cost(x.level + 1), time: def.time(x.level + 1) });
  }
  for (const [type, counts] of Object.entries(CLASH_COUNTS)) {
    const have = base.buildings.filter((x) => x.type === type).length;
    if (have < counts[L]) opts.push({ kind: "new", type, to: 1, cost: CLASH_BUILDINGS[type].cost(1), time: CLASH_BUILDINGS[type].time(1) });
  }
  return opts;
}
function clashCanPay(base, cost) {
  return Object.entries(cost).every(([k, v]) => (base.res[k] ?? 0) >= v);
}
function clashStart(base, opt) {
  if (busyBuilders(base) >= CLASH_BUILDERS) return "Vos deux ouvriers sont déjà occupés.";
  if (!clashCanPay(base, opt.cost)) return `Il vous manque des ressources (${costText(opt.cost)}).`;
  for (const [k, v] of Object.entries(opt.cost)) base.res[k] -= v;
  if (opt.kind === "new") {
    const id = `b${Date.now().toString(36)}${Math.floor(Math.random() * 99)}`;
    base.buildings.push({ id, type: opt.type, level: 0, upgrading: { to: 1, done: Date.now() + opt.time * MINUTE } });
  } else {
    const x = base.buildings.find((y) => y.id === opt.id);
    x.upgrading = { to: opt.to, done: Date.now() + opt.time * MINUTE };
  }
  return null;
}

// --- Plan de la base : placement automatique sur la grille ---
// Le Manoir au centre, les défenses autour, puis la caserne et les coffres, et la production à l'extérieur.
function clashLayout(base) {
  const placed = [], c = CLASH_GRID / 2;
  const ring = (list, radius, phase) => {
    list.forEach((x, k) => {
      const a = phase + (k / Math.max(1, list.length)) * Math.PI * 2;
      placed.push({ ...x, x: c + Math.cos(a) * radius, y: c + Math.sin(a) * radius * 0.92 });
    });
  };
  const of = (...kinds) => base.buildings.filter((x) => x.level > 0 && kinds.includes(CLASH_BUILDINGS[x.type].kind));
  ring(of("core"), 0, 0);
  ring(of("defense"), 5.3, 0.4);
  ring(of("storage", "army"), 8.9, 1.1);
  ring(of("resource"), 10.6, 0.65);
  return placed;
}

// --- Bases fantômes : des Maisons gardées par l'IA quand il n'y a pas assez d'adversaires ---
const GHOST_NAMES = ["Maison des Brumes", "Manoir Délaissé", "Villa du Notaire", "Hôtel des Ombres", "Pension Vasseur", "Domaine du Corbeau", "Maison Close-aux-Roses", "Château du Faussaire"];
function ghostBase(manoir, seed) {
  const R = seeded(seed);
  const L = Math.max(1, Math.min(CLASH_MAX_MANOIR, manoir + (R() < 0.3 ? -1 : 0)));
  const base = newBase({ id: `ghost${seed}`, name: GHOST_NAMES[seed % GHOST_NAMES.length] });
  base.ghost = true;
  base.buildings = [];
  let id = 0;
  base.buildings.push({ id: `b${id++}`, type: "manoir", level: L });
  for (const [type, counts] of Object.entries(CLASH_COUNTS)) for (let k = 0; k < counts[L]; k++) base.buildings.push({ id: `b${id++}`, type, level: Math.max(1, Math.min(maxLevelOf(type, L), L - (R() < 0.5 ? 1 : 0))) });
  base.res = { or: Math.round(400 * L ** 1.6 + R() * 300 * L), essence: Math.round(400 * L ** 1.6 + R() * 300 * L) };
  base.trophies = 0;
  return base;
}
