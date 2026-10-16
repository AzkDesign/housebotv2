// Clash de la Maison en 3D : la scène (île, décor, bâtiments, soldats) et la préparation des rendus.
const { Mesh, material, render, shadowMap, n2, h2, fbm2 } = require("./moteur");
const M3 = require("./math");

// ============================================================
// Matériaux
// ============================================================
const MDEF = {
  grass: { pat: "grass" },
  lip: { c: "#3f5a22", c2: "#52401f", pat: "rock" },
  rock: { c: "#6d5a45", c2: "#9a8468", pat: "rock", rough: 0.95 },
  rockGrey: { c: "#6e6a64", c2: "#9b958b", pat: "rock", rough: 0.9 },
  dirt: { c: "#5e4530", pat: "dirt" },
  // murs
  wood: { c: "#86552e", pat: "wood" },
  woodDark: { c: "#4e321c", pat: "wood" },
  woodLight: { c: "#b08454", pat: "wood" },
  timber: { c: "#3a2414", pat: "wood", sc: 0.6 },
  plaster: { c: "#e6d6b8", pat: "cloth" },
  brick: { c: "#9a4a2c", c2: "#7a3420", c3: "#c8b8a0", pat: "brick" },
  stone: { c: "#a89c8a", c2: "#8c8070", c3: "#4e4840", pat: "ashlar" },
  stoneWarm: { c: "#b8a184", c2: "#9c8264", c3: "#4e4436", pat: "ashlar" },
  stoneDark: { c: "#6e675e", c2: "#57514a", c3: "#2e2a26", pat: "ashlar" },
  cobble: { c: "#8f877b", c2: "#6f685e", c3: "#3a3530", pat: "brick", sc: 1.6 },
  marble: { c: "#f2ece0", c2: "#c9a24a", pat: "marble", rough: 0.35 },
  marbleDark: { c: "#d9cfbc", c2: "#b08a3a", pat: "marble", rough: 0.4 },
  // toits
  roofClay: { c: "#a8432a", pat: "tiles" },
  roofSlate: { c: "#3a4a63", pat: "tiles" },
  roofRoyal: { c: "#4a2878", pat: "tiles" },
  roofThatch: { c: "#a88a4a", pat: "straw" },
  // métaux
  gold: { c: "#f0b84a", metal: 1, rough: 0.25 },
  goldDark: { c: "#b8862a", metal: 1, rough: 0.35 },
  bronze: { c: "#b07a3a", metal: 1, rough: 0.38 },
  copper: { c: "#d07a3e", metal: 1, rough: 0.3 },
  iron: { c: "#3a3d42", metal: 0.85, rough: 0.42 },
  ironDark: { c: "#202226", metal: 0.8, rough: 0.5 },
  steel: { c: "#b0b8c2", metal: 1, rough: 0.28 },
  // ouvertures
  window: { c: "#222222", c2: "#2a1a0e", emit: "#ffb35a", ei: 2.4, pat: "window" },
  windowBlue: { c: "#222222", c2: "#e8e0d0", emit: "#ffc070", ei: 2.2, pat: "window" },
  door: { c: "#4a2c16", pat: "wood", sc: 0.7 },
  dark: { c: "#0b0907", rough: 1 },
  black: { c: "#050505", rough: 1 },
  // tissus
  canvas: { c: "#d8c7a2", pat: "cloth", ds: true },
  canvasGreen: { c: "#4f6b2a", pat: "cloth", ds: true },
  canvasRed: { c: "#8c1c1c", pat: "cloth", ds: true },
  flagRed: { c: "#b3122e", pat: "cloth", ds: true },
  flagBlue: { c: "#1d4ed8", pat: "cloth", ds: true },
  flagGold: { c: "#e0a52a", pat: "cloth", ds: true },
  flagPurple: { c: "#6d28d9", pat: "cloth", ds: true },
  // végétation
  leaf: { c: "#2e5a1a", c2: "#6e9e30", pat: "leaf" },
  leafAutumn: { c: "#7a4a14", c2: "#c88a2a", pat: "leaf" },
  leafPine: { c: "#16351a", c2: "#2f5e2a", pat: "leaf" },
  leafBush: { c: "#2c4f1a", c2: "#5a8a2a", pat: "leaf" },
  blossom: { c: "#c86a8a", c2: "#f2b8cc", pat: "leaf" },
  bark: { c: "#4e3622", pat: "bark" },
  berry: { c: "#b0202a", rough: 0.4 },
  flowerY: { c: "#f2c230", rough: 0.6 },
  flowerP: { c: "#d870a8", rough: 0.6 },
  flowerW: { c: "#f4f0e8", rough: 0.6 },
  flowerV: { c: "#8a64d8", rough: 0.6 },
  // divers
  sand: { c: "#7a6244", pat: "sand", rough: 0.95 },
  essence: { c: "#000000", emit: "#b04cff", ei: 3.2, pat: "glow" },
  glass: { c: "#9cc0e0", rough: 0.06, metal: 0.25 },
  ore: { c: "#6e665c", c2: "#8c765c", pat: "ore", rough: 0.9 },
  char: { c: "#2c2622", pat: "char" },
  ash: { c: "#4a4440", pat: "dirt" },
  flame: { c: "#000000", emit: "#ff8a2a", ei: 4, pat: "flame" },
  lantern: { c: "#000000", emit: "#ffc070", ei: 5, pat: "flame" },
  crystal: { c: "#f2c040", metal: 1, rough: 0.12, emit: "#ff9a10", ei: 0.5 },
  purpleCrystal: { c: "#9a40ff", metal: 0.6, rough: 0.1, emit: "#7a20ff", ei: 0.8 },
  rope: { c: "#8a7050", pat: "wood", sc: 0.3 },
  hay: { c: "#c8a858", pat: "straw" },
  // soldats
  skin: { c: "#e2a47c", pat: "skin", rough: 0.6 },
  skinDark: { c: "#9a6444", pat: "skin", rough: 0.6 },
  hair: { c: "#2a1a10", rough: 0.7 },
  leather: { c: "#6a4426", rough: 0.6 },
  armorSteel: { c: "#9aa4b0", metal: 1, rough: 0.32 },
  clothBlue: { c: "#1e40af", pat: "cloth" },
  clothNavy: { c: "#172554", pat: "cloth", ds: true },
  clothPurple: { c: "#5b21b6", pat: "cloth" },
  clothRedCape: { c: "#8a1622", pat: "cloth", ds: true },
  clothGreen: { c: "#3f6212", pat: "cloth" },
  clothOchre: { c: "#a16207", pat: "cloth" },
  clothRed: { c: "#c0262d", pat: "cloth", ds: true },
  sack: { c: "#c8b48a", pat: "cloth" },
  heroGlow: { c: "#e9d5ff", emit: "#c084fc", ei: 1.6 },
};
const MATS = [], MI = {};
for (const [k, v] of Object.entries(MDEF)) {
  MI[k] = MATS.length;
  MATS.push(material({ ...v, name: k }));
}
// matières de couleur unie ajoutées à la volée (anneaux de rareté…)
function colorMat(hex, opts = {}) {
  const key = `c:${hex}:${JSON.stringify(opts)}`;
  if (MI[key] === undefined) {
    MI[key] = MATS.length;
    MATS.push(material({ c: hex, ...opts, name: key }));
  }
  return MI[key];
}

// paliers de matériaux selon le niveau : bois (1-2), pierre (3-4), marbre et or (5-6)
const tierOf = (L) => (L <= 2 ? 0 : L <= 4 ? 1 : 2);
const TIER = [
  { wall: "wood", base: "stoneWarm", stone: "stoneWarm", roof: "roofClay", trim: "timber", metal: "iron", accent: "flagRed", win: "window", wall2: "plaster" },
  { wall: "stone", base: "stoneDark", stone: "stone", roof: "roofSlate", trim: "stoneDark", metal: "iron", accent: "flagBlue", win: "windowBlue", wall2: "stone" },
  { wall: "marble", base: "marbleDark", stone: "marble", roof: "roofRoyal", trim: "gold", metal: "gold", accent: "flagPurple", win: "windowBlue", wall2: "marble" },
];

// ============================================================
// Petits éléments réutilisables
// ============================================================
// fenêtre posée sur une face : side "x" (face +x) ou "z" (face +z), position le long (a), hauteur (y)
function windowOn(m, face, cx, cz, a, y, w, h, frameMat, glassMat, depth = 0.03) {
  m.push();
  if (face === "x") m.translate(cx, 0, cz).rotY(Math.PI / 2);
  else if (face === "-x") m.translate(cx, 0, cz).rotY(-Math.PI / 2);
  else if (face === "-z") m.translate(cx, 0, cz).rotY(Math.PI);
  else m.translate(cx, 0, cz);
  // repère local : la face regarde +z, « a » le long de x
  m.setMat(MI[frameMat]).box(a - w / 2 - 0.035, y - 0.035, -0.01, a + w / 2 + 0.035, y + h + 0.05, depth + 0.02);
  m.setMat(MI[glassMat]).box(a - w / 2, y, depth, a + w / 2, y + h, depth + 0.025, { top: false });
  // appui de fenêtre
  m.setMat(MI[frameMat]).box(a - w / 2 - 0.06, y - 0.07, -0.01, a + w / 2 + 0.06, y - 0.025, depth + 0.07);
  m.pop();
}
// drapeau ondulant sur un mât
function flagPole(m, x, y, z, h, cloth, wave = 0.3, metal = "iron") {
  m.push().translate(x, y, z);
  m.setMat(MI[metal]).cyl(0.025, h, { seg: 6 });
  m.setMat(MI.gold).push().translate(0, h + 0.03, 0).sphere(0.045, { seg: 8, rings: 6 }).pop();
  m.setMat(MI[cloth]);
  const L = 0.55, Hf = 0.32, n = 6;
  for (let i = 0; i < n; i++) {
    const u0 = i / n, u1 = (i + 1) / n;
    const z0 = Math.sin(u0 * 5 + wave) * 0.06 * u0, z1 = Math.sin(u1 * 5 + wave) * 0.06 * u1;
    const d0 = -u0 * 0.05, d1 = -u1 * 0.05;
    m.quad([u0 * L, h - Hf + d0, z0], [u1 * L, h - Hf + d1, z1], [u1 * L, h + d1, z1], [u0 * L, h + d0, z0]);
  }
  m.pop();
}
// tonneau de bois cerclé
function barrel(m, x, z, s = 1, y = 0) {
  m.push().translate(x, y, z).scale(s);
  m.setMat(MI.wood).cyl(0.17, 0.42, { r2: 0.17, seg: 12 });
  m.setMat(MI.iron);
  for (const yy of [0.06, 0.34]) m.push().translate(0, yy, 0).cyl(0.178, 0.035, { seg: 12 }).pop();
  m.pop();
}
// caisse en bois
function crate(m, x, z, s = 0.3, rot = 0, y = 0) {
  m.push().translate(x, y, z).rotY(rot);
  m.setMat(MI.woodLight).box(-s / 2, 0, -s / 2, s / 2, s, s / 2);
  m.setMat(MI.timber).box(-s / 2 - 0.005, 0, -s / 2 - 0.005, -s / 2 + 0.04, s, s / 2 + 0.005).box(s / 2 - 0.04, 0, -s / 2 - 0.005, s / 2 + 0.005, s, s / 2 + 0.005);
  m.pop();
}
// tas de pièces d'or
function coinPile(m, x, z, n = 5, R = Math.random) {
  for (let k = 0; k < n; k++) {
    const a = R() * Math.PI * 2, r = R() * 0.12;
    m.push().translate(x + Math.cos(a) * r, 0.012 * k * 0.6, z + Math.sin(a) * r).rotZ((R() - 0.5) * 0.3);
    m.setMat(MI.gold).cyl(0.07, 0.022, { seg: 10 });
    m.pop();
  }
  m.setMat(MI.gold).push().translate(x, 0, z).sphere(0.13, { seg: 10, rings: 5, hemi: true, sy: 0.55 }).pop();
}
// créneaux autour d'un sommet carré
function crenels(m, hx, hz, y, mat, size = 0.13, gap = 0.26) {
  m.setMat(MI[mat]);
  for (let x = -hx + size / 2; x <= hx - size / 2 + 1e-6; x += gap) {
    m.box(x - size / 2, y, hz - size, x + size / 2, y + size * 1.3, hz);
    m.box(x - size / 2, y, -hz, x + size / 2, y + size * 1.3, -hz + size);
  }
  for (let z = -hz + size / 2; z <= hz - size / 2 + 1e-6; z += gap) {
    m.box(hx - size, y, z - size / 2, hx, y + size * 1.3, z + size / 2);
    m.box(-hx, y, z - size / 2, -hx + size, y + size * 1.3, z + size / 2);
  }
}
// sac de sable (ellipsoïde aplati)
function sandbag(m, x, z, a, y = 0) {
  m.push().translate(x, y, z).rotY(a);
  m.setMat(MI.sand).sphere(0.17, { seg: 9, rings: 6, sx: 1.45, sy: 0.6, sz: 0.95, y0: 0.085, disp: (a, b, c) => 1 + 0.06 * Math.sin(a * 8 + c * 5) });
  m.pop();
}

// ============================================================
// Les bâtiments (repère local : centre de l'emprise au sol, y = 0)
// ============================================================
const BUILD = {
  manoir(m, L, ctx) {
    const T = TIER[tierOf(L)], tier = tierOf(L);
    // socle et perron
    m.setMat(MI[T.base]).box(-1.55, -0.05, -1.45, 1.55, 0.22, 1.45);
    m.setMat(MI[T.base]).box(-0.5, -0.05, 1.45, 0.5, 0.14, 1.75).box(-0.38, 0.14, 1.45, 0.38, 0.2, 1.62);
    const bx = 1.18, bz = 0.95, H = 1.45 + 0.1 * L, y0 = 0.22;
    // ailes basses (niveau 4+)
    if (L >= 4) {
      for (const s of [-1, 1]) {
        m.setMat(MI[T.wall2]).box(s > 0 ? bx - 0.05 : -bx - 0.62, y0, -0.6, s > 0 ? bx + 0.62 : -bx + 0.05, y0 + H * 0.62, 0.62);
        m.setMat(MI[T.roof]).push().translate(s * (bx + 0.29), y0 + H * 0.62, 0).roofHip(0.42, 0.72, 0.45, { ridge: 0.2 }).pop();
        windowOn(m, "z", s * (bx + 0.29), 0.62, 0, y0 + 0.25, 0.22, 0.34, T.trim, T.win);
      }
    }
    // corps principal
    m.setMat(MI[T.wall]).box(-bx, y0, -bz, bx, y0 + H, bz);
    // colombages (bois) ou chaînages d'angle (pierre / marbre)
    if (tier === 0) {
      m.setMat(MI.timber);
      for (const x of [-bx, -bx / 3, bx / 3, bx]) m.box(x - 0.045, y0, bz - 0.01, x + 0.045, y0 + H, bz + 0.035);
      for (const z of [-bz, 0, bz]) m.box(bx - 0.01, y0, z - 0.045, bx + 0.035, y0 + H, z + 0.045);
      m.box(-bx, y0 + H * 0.48, bz - 0.01, bx, y0 + H * 0.48 + 0.07, bz + 0.035).box(bx - 0.01, y0 + H * 0.48, -bz, bx + 0.035, y0 + H * 0.48 + 0.07, bz);
    } else {
      m.setMat(MI[T.trim]);
      for (const [x, z] of [[bx, bz], [-bx, bz], [bx, -bz]]) for (let yy = y0; yy < y0 + H - 0.1; yy += 0.3) m.box(x - 0.09, yy, z - 0.09, x + 0.09, yy + 0.15, z + 0.09);
    }
    // corniche
    m.setMat(MI[T.trim]).box(-bx - 0.08, y0 + H - 0.08, -bz - 0.08, bx + 0.08, y0 + H + 0.04, bz + 0.08);
    // fenêtres (deux étages) sur les deux façades visibles
    for (const fl of [0, 1]) {
      const wy = y0 + 0.28 + fl * (H * 0.5), wh = H * 0.27;
      for (const a of [-0.72, 0.72]) windowOn(m, "z", 0, bz, a, wy, 0.3, wh, T.trim, T.win);
      if (fl === 1) windowOn(m, "z", 0, bz, 0, wy, 0.3, wh, T.trim, T.win);
      for (const a of [-0.55, 0, 0.55]) windowOn(m, "x", bx, 0, -a, wy, 0.28, wh, T.trim, T.win);
    }
    // porte en arc
    m.setMat(MI[T.trim]).box(-0.3, y0, bz - 0.01, 0.3, y0 + H * 0.42 + 0.06, bz + 0.06);
    m.setMat(MI.door).box(-0.22, y0, bz + 0.02, 0.22, y0 + H * 0.42, bz + 0.07);
    m.setMat(MI.gold).push().translate(0.12, y0 + H * 0.2, bz + 0.09).sphere(0.025, { seg: 6, rings: 4 }).pop();
    // colonnes et fronton (marbre)
    if (tier === 2) {
      for (const x of [-0.45, 0.45]) m.setMat(MI.marble).push().translate(x, y0, bz + 0.3).cyl(0.07, H * 0.55, { seg: 12 }).pop();
      m.setMat(MI.marble).box(-0.58, y0 + H * 0.55, bz - 0.02, 0.58, y0 + H * 0.55 + 0.1, bz + 0.42);
      m.setMat(MI.roofRoyal).push().translate(0, y0 + H * 0.55 + 0.1, bz + 0.2).roofGable(0.6, 0.24, 0.22, { gableMat: MI.marble }).pop();
    } else {
      // auvent sur consoles
      m.setMat(MI[T.roof]).push().translate(0, y0 + H * 0.46, bz + 0.18).roofGable(0.42, 0.2, 0.16, { gableMat: MI[T.trim] }).pop();
    }
    // grand toit en croupe, lucarnes, cheminées
    const rh = 0.95 + 0.06 * L;
    m.setMat(MI[T.roof]).push().translate(0, y0 + H + 0.04, 0).roofHip(bx + 0.16, bz + 0.16, rh, { ridge: 0.38 }).pop();
    for (const a of [-0.55, 0.55]) {
      m.push().translate(a, y0 + H + 0.18, bz - 0.12);
      m.setMat(MI[T.wall2]).box(-0.16, 0, -0.12, 0.16, 0.3, 0.12);
      windowOn(m, "z", 0, 0.12, 0, 0.06, 0.16, 0.18, T.trim, T.win);
      m.setMat(MI[T.roof]).push().translate(0, 0.3, 0).rotY(Math.PI / 2).roofGable(0.16, 0.2, 0.16, { gableMat: MI[T.trim] }).pop();
      m.pop();
    }
    m.setMat(MI[tier === 0 ? "brick" : T.stone]).box(0.55, y0 + H + 0.2, -0.45, 0.78, y0 + H + rh * 0.95, -0.25);
    m.setMat(MI.stoneDark).box(0.52, y0 + H + rh * 0.95, -0.48, 0.81, y0 + H + rh * 0.95 + 0.06, -0.22);
    // tours d'angle (niveau 3+) : à l'arrière, puis aux quatre coins
    if (L >= 3) {
      const spots = L >= 5 ? [[-1.32, -1.12], [1.32, -1.12], [-1.32, 1.12], [1.32, 1.12]] : [[-1.32, -1.12], [1.32, -1.12]];
      for (const [x, z] of spots) {
        const th = H + 0.55 + 0.05 * L;
        m.setMat(MI[T.stone]).push().translate(x, y0, z).cyl(0.34, th, { seg: 16 }).pop();
        m.setMat(MI[T.trim]).push().translate(x, y0 + th - 0.06, z).cyl(0.39, 0.1, { seg: 16 }).pop();
        // meurtrières lumineuses
        for (const yy of [0.5, 1.1]) m.setMat(MI[T.win]).push().translate(x, y0 + yy, z).rotY(Math.atan2(1, 1)).box(-0.04, 0, 0.32, 0.04, 0.22, 0.35).pop();
        m.setMat(MI[T.roof]).push().translate(x, y0 + th + 0.04, z).cyl(0.42, 0.85 + 0.04 * L, { r2: 0, seg: 16 }).pop();
        m.setMat(MI.gold).push().translate(x, y0 + th + 0.9 + 0.04 * L, z).sphere(0.05, { seg: 8, rings: 5 }).pop();
        if (z > 0 || L < 5) flagPole(m, x, y0 + th + 0.92 + 0.04 * L, z, 0.55, T.accent, x + z);
      }
    }
    // dôme doré (niveau 5+)
    if (L >= 5) {
      m.setMat(MI.marble).push().translate(0, y0 + H + rh * 0.62, 0).cyl(0.36, 0.28, { seg: 18 }).pop();
      m.setMat(MI.gold).push().translate(0, y0 + H + rh * 0.62 + 0.28, 0).sphere(0.38, { seg: 18, rings: 9, hemi: true }).pop();
      m.setMat(MI.gold).push().translate(0, y0 + H + rh * 0.62 + 0.66, 0).cyl(0.03, 0.22, { seg: 6 }).pop();
      flagPole(m, 0, y0 + H + rh * 0.62 + 0.86, 0, 0.6, "flagRed", 1.7, "gold");
    } else flagPole(m, 0, y0 + H + rh, 0, 0.7, T.accent, 0.4);
    // jardinières et lanternes au pied
    for (const s of [-1, 1]) {
      m.setMat(MI[T.base]).box(s * 0.62 - 0.18, 0.22, 1.25, s * 0.62 + 0.18, 0.34, 1.42);
      m.setMat(MI.leafBush).push().translate(s * 0.62, 0.34, 1.33).sphere(0.14, { seg: 8, rings: 5, sx: 1.3, sy: 0.7, disp: (x, y, z) => 1 + 0.12 * Math.sin(x * 9 + z * 7) }).pop();
      m.setMat(MI.flowerP).push().translate(s * 0.62 + 0.06, 0.42, 1.36).sphere(0.03, { seg: 5, rings: 3 }).pop();
      m.setMat(MI.iron).push().translate(s * 0.48, 0.22, 1.52).cyl(0.02, 0.46, { seg: 6 }).pop();
      m.setMat(MI.lantern).push().translate(s * 0.48, 0.72, 1.52).sphere(0.05, { seg: 8, rings: 5 }).pop();
    }
    ctx.lights.push([0, y0 + H * 0.4, bz + 0.2, "#ffb35a", 1.2]);
  },
  mine(m, L, ctx) {
    const tier = tierOf(L), R = ctx.R;
    m.setMat(MI.dirt).push().translate(0, -0.02, 0).cyl(1.0, 0.04, { seg: 20 }).pop();
    // massif rocheux : plusieurs blocs irréguliers, veinés d'or dès le niveau 3
    const rockMat = tier >= 1 ? MI.ore : MI.rockGrey;
    const lumps = [[-0.2, -0.32, 0.78, 0.9], [0.42, -0.48, 0.5, 0.62], [-0.62, 0.18, 0.42, 0.5], [0.2, -0.02, 0.46, 0.58], [-0.45, -0.62, 0.38, 0.45]];
    lumps.forEach(([x, z, r, hy], k) =>
      m.setMat(rockMat).push().translate(x, 0, z).rotY(k * 1.3).sphere(r, { seg: 11, rings: 6, hemi: true, facet: true, sy: (hy * (0.92 + 0.04 * L)) / r, disp: (a, b, c) => 1 + 0.2 * (n2(a * 2.6 + k * 7, c * 2.6 + b * 1.7) - 0.5) + 0.07 * (h2(Math.floor(a * 5 + 9), Math.floor(c * 5 + b * 3)) - 0.5) }).pop()
    );
    m.setMat(MI.rockGrey);
    for (let k = 0; k < 5; k++) {
      const a = R() * Math.PI * 2, d = 0.65 + R() * 0.3;
      m.push().translate(Math.cos(a) * d, 0, Math.sin(a) * d).sphere(0.12 + R() * 0.1, { seg: 7, rings: 4, hemi: true, facet: true, sy: 0.7, disp: (x, y, z) => 1 + 0.2 * h2(Math.floor(x * 4 + 9), Math.floor(z * 4)) }).pop();
    }
    // entrée de la galerie, étayée de poutres
    m.push().translate(0.22, 0, 0.42).rotY(0.25);
    m.setMat(MI.black).box(-0.24, 0, -0.1, 0.24, 0.5, 0.06);
    m.setMat(MI.woodDark).box(-0.32, 0, 0.03, -0.24, 0.58, 0.12).box(0.24, 0, 0.03, 0.32, 0.58, 0.12).box(-0.36, 0.56, 0.0, 0.36, 0.66, 0.14);
    m.setMat(MI.lantern).push().translate(0.36, 0.5, 0.16).sphere(0.04, { seg: 6, rings: 4 }).pop();
    // rails et traverses
    m.setMat(MI.wood);
    for (let k = 0; k < 6; k++) m.box(-0.2, 0, 0.12 + k * 0.15, 0.2, 0.025, 0.18 + k * 0.15);
    m.setMat(MI.steel).box(-0.13, 0.025, 0.1, -0.1, 0.05, 1.0).box(0.1, 0.025, 0.1, 0.13, 0.05, 1.0);
    // wagonnet plein d'or
    m.push().translate(0, 0.05, 0.72);
    m.setMat(MI.iron).box(-0.18, 0.06, -0.14, 0.18, 0.26, 0.14);
    m.setMat(MI.ironDark);
    for (const [x, z] of [[-0.15, -0.09], [0.15, -0.09], [-0.15, 0.09], [0.15, 0.09]]) m.push().translate(x, 0.05, z).rotZ(Math.PI / 2).cyl(0.05, 0.03, { seg: 8, y0: -0.015, bottom: true }).pop();
    m.setMat(MI.gold);
    for (let k = 0; k < 7 + L; k++) m.push().translate((R() - 0.5) * 0.26, 0.26 + R() * 0.06, (R() - 0.5) * 0.2).sphere(0.045 + R() * 0.02, { seg: 6, rings: 4 }).pop();
    m.pop();
    m.pop();
    // treuil en bois (niveau 3+)
    if (L >= 3) {
      m.setMat(MI.woodDark).push().translate(-0.6, 0, 0.35);
      m.box(-0.04, 0, -0.04, 0.04, 0.9, 0.04).box(0.36, 0, -0.04, 0.44, 0.9, 0.04).box(-0.06, 0.86, -0.06, 0.46, 0.94, 0.06);
      m.setMat(MI.rope).push().translate(0.2, 0.9, 0).cyl(0.012, -0.5, { seg: 4, y0: 0 }).pop();
      m.setMat(MI.iron).push().translate(0.2, 0.3, 0).cyl(0.07, 0.1, { seg: 8 }).pop();
      m.pop();
    }
    // cristaux d'or (niveau 5+)
    if (tier === 2)
      for (let k = 0; k < 6; k++) {
        const a = -2.2 + k * 0.5, d = 0.55;
        m.setMat(MI.crystal).push().translate(-0.2 + Math.cos(a) * d * 0.6, 0.35 + R() * 0.25, -0.3 + Math.sin(a) * d * 0.5).rotZ((R() - 0.5) * 0.8).rotX((R() - 0.5) * 0.6).cyl(0.07, 0.34, { r2: 0, seg: 5, smooth: false }).pop();
      }
    // petits tas d'or
    coinPile(m, 0.62, -0.1, 4 + L, R);
    ctx.lights.push([0.22, 0.4, 0.55, "#ffc070", 0.8]);
  },
  distillerie(m, L, ctx) {
    const T = TIER[tierOf(L)], tier = tierOf(L);
    m.setMat(MI[T.base]).box(-1.0, -0.04, -1.0, 1.0, 0.12, 1.0);
    // atelier de briques
    m.push().translate(-0.3, 0.12, -0.32);
    m.setMat(MI.brick).box(-0.55, 0, -0.5, 0.55, 0.85, 0.5);
    windowOn(m, "z", 0, 0.5, 0.2, 0.3, 0.26, 0.3, T.trim, T.win);
    windowOn(m, "x", 0.55, 0, 0, 0.3, 0.26, 0.3, T.trim, T.win);
    m.setMat(MI.door).box(-0.42, 0, 0.5, -0.14, 0.52, 0.55);
    m.setMat(MI[T.roof]).push().translate(0, 0.85, 0).roofGable(0.65, 0.6, 0.45, { gableMat: MI.brick }).pop();
    m.setMat(MI.brick).box(-0.42, 0.85, -0.3, -0.22, 1.75, -0.1);
    m.setMat(MI.stoneDark).box(-0.45, 1.75, -0.33, -0.19, 1.82, -0.07);
    m.pop();
    // alambic de cuivre
    m.push().translate(0.35, 0.12, 0.45);
    m.setMat(MI.stoneDark).cyl(0.3, 0.14, { seg: 14 });
    m.setMat(MI.flame).push().translate(0, 0.05, 0.25).sphere(0.06, { seg: 6, rings: 4, sy: 1.6 }).pop();
    m.setMat(MI.copper).push().translate(0, 0.14, 0).sphere(0.32, { seg: 16, rings: 10, sy: 0.85, y0: 0.27 }).pop();
    m.setMat(MI.copper).push().translate(0, 0.5, 0).cyl(0.12, 0.3, { r2: 0.05, seg: 12 }).pop();
    m.setMat(MI.copper).push().translate(0.02, 0.78, 0).rotZ(-1.15).cyl(0.035, 0.55, { seg: 8 }).pop();
    m.pop();
    // cuve de verre pleine d'essence lumineuse
    const tx = 0.55, tz = -0.25, rh = 0.75 + 0.08 * L, rr = 0.24 + 0.01 * L;
    m.push().translate(tx, 0.12, tz);
    m.setMat(MI[T.metal]).cyl(rr + 0.04, 0.08, { seg: 18 });
    m.setMat(MI.essence).push().translate(0, 0.08, 0).cyl(rr - 0.01, rh * 0.82, { seg: 18 }).pop();
    m.setMat(MI.glass).push().translate(0, rh * 0.82 + 0.08, 0).cyl(rr, rh * 0.18, { seg: 18 }).pop();
    m.setMat(MI[T.metal]);
    for (const yy of [0.3, rh * 0.62, rh + 0.06]) m.push().translate(0, yy, 0).cyl(rr + 0.02, 0.04, { seg: 18 }).pop();
    m.setMat(MI[T.metal]).push().translate(0, rh + 0.1, 0).sphere(rr * 0.9, { seg: 14, rings: 6, hemi: true, sy: 0.5 }).pop();
    if (tier === 2) for (let k = 0; k < 3; k++) m.setMat(MI.purpleCrystal).push().translate(Math.cos(k * 2.1) * 0.12, rh + 0.2, Math.sin(k * 2.1) * 0.12).rotZ(0.3 * (k - 1)).cyl(0.04, 0.22, { r2: 0, seg: 5, smooth: false }).pop();
    m.pop();
    ctx.lights.push([tx, 0.5, tz, "#b04cff", 1.4]);
    // tonneaux
    barrel(m, -0.75, 0.62, 0.9, 0.12);
    barrel(m, -0.48, 0.75, 0.9, 0.12);
    crate(m, 0.85, 0.75, 0.24, 0.3, 0.12);
  },
  coffre(m, L, ctx) {
    const T = TIER[tierOf(L)], tier = tierOf(L), R = ctx.R;
    m.setMat(MI[T.base]).box(-1.0, -0.04, -1.0, 1.0, 0.14, 1.0);
    const hx = 0.66, hz = 0.58, H = 0.95 + 0.07 * L;
    m.setMat(MI[tier === 0 ? "stoneWarm" : T.wall]).box(-hx, 0.14, -hz, hx, 0.14 + H, hz);
    // cerclages de métal
    m.setMat(MI[T.metal]);
    for (const yy of [0.3, 0.14 + H - 0.2]) m.box(-hx - 0.03, yy, -hz - 0.03, hx + 0.03, yy + 0.08, hz + 0.03);
    for (const [x, z] of [[hx, hz], [-hx, hz], [hx, -hz]]) m.box(x - 0.06, 0.14, z - 0.06, x + 0.06, 0.14 + H, z + 0.06);
    // rivets
    m.setMat(MI.steel);
    for (let k = 0; k < 6; k++) m.push().translate(-hx + 0.15 + k * 0.22, 0.34, hz + 0.035).sphere(0.018, { seg: 5, rings: 3 }).pop();
    // grande porte ronde blindée (face +z)
    m.push().translate(0.05, 0.14 + H * 0.48, hz + 0.02).rotX(Math.PI / 2);
    m.setMat(MI.ironDark).cyl(0.36, 0.04, { seg: 24 });
    m.setMat(MI.steel).push().translate(0, 0.04, 0).cyl(0.3, 0.05, { seg: 24 }).pop();
    m.setMat(MI[tier === 2 ? "gold" : "bronze"]);
    for (let k = 0; k < 6; k++) m.push().translate(0, 0.09, 0).rotY((k / 6) * Math.PI).box(-0.22, 0, -0.015, 0.22, 0.03, 0.015).pop();
    m.push().translate(0, 0.09, 0).cyl(0.07, 0.06, { seg: 12 }).pop();
    m.pop();
    // toit : pyramide avec épi doré
    m.setMat(MI[T.roof]).push().translate(0, 0.14 + H + 0.04, 0).roofHip(hx + 0.12, hz + 0.12, 0.42, { ridge: 0.05 }).pop();
    m.setMat(MI[T.trim]).box(-hx - 0.1, 0.14 + H - 0.02, -hz - 0.1, hx + 0.1, 0.14 + H + 0.06, hz + 0.1);
    m.setMat(MI.gold).push().translate(0, 0.14 + H + 0.5, 0).sphere(0.07, { seg: 8, rings: 5 }).pop();
    // trésor qui déborde
    coinPile(m, -0.72, 0.68, 6 + L, R);
    coinPile(m, 0.75, 0.72, 4 + L, R);
    if (L >= 3) {
      m.push().translate(-0.78, 0.14, -0.2).rotY(0.4);
      m.setMat(MI.wood).box(-0.18, 0, -0.12, 0.18, 0.2, 0.12);
      m.setMat(MI.gold).box(-0.18, 0.2, -0.12, 0.18, 0.24, 0.12).push().translate(0, 0.24, 0).sphere(0.15, { seg: 8, rings: 4, hemi: true, sy: 0.5, sx: 1.1 }).pop();
      m.pop();
    }
  },
  caserne(m, L, ctx) {
    const tier = tierOf(L), R = ctx.R;
    m.setMat(MI.dirt).box(-1.0, -0.03, -1.0, 1.0, 0.02, 1.0);
    // palissade de pieux taillés (ouverte devant)
    const stake = tier === 2 ? MI.stoneWarm : MI.woodDark;
    const ring = (x0, z0, x1, z1, n) => {
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n, z = z0 + ((z1 - z0) * k) / n, h = 0.5 + 0.08 * R();
        m.setMat(stake).push().translate(x, 0, z).cyl(0.055, h, { seg: 6 }).pop();
        m.setMat(stake).push().translate(x, h, z).cyl(0.055, 0.1, { r2: 0, seg: 6 }).pop();
      }
    };
    ring(-0.95, -0.95, 0.95, -0.95, 12);
    ring(-0.95, -0.95, -0.95, 0.95, 12);
    ring(0.95, -0.95, 0.95, 0.15, 7);
    ring(-0.95, 0.95, -0.2, 0.95, 5);
    // tentes
    const cloth = [MI.canvas, MI.canvasGreen, MI.canvasRed][tier];
    for (const [x, z, s] of [[-0.42, -0.3, 1], [0.38, -0.42, 0.85]]) {
      m.push().translate(x, 0.02, z).scale(s);
      m.setMat(cloth).roofGable(0.38, 0.32, 0.55, { gableMat: cloth });
      m.setMat(MI.black).push().translate(0.381, 0, 0).rotY(Math.PI / 2).box(-0.08, 0, -0.005, 0.08, 0.3, 0.005).pop();
      m.setMat(MI.woodDark).push().translate(0.42, 0, 0).cyl(0.02, 0.62, { seg: 5 }).pop();
      m.pop();
    }
    // feu de camp
    m.push().translate(-0.25, 0.02, 0.45);
    m.setMat(MI.stoneDark);
    for (let k = 0; k < 8; k++) m.push().translate(Math.cos(k * 0.785) * 0.17, 0, Math.sin(k * 0.785) * 0.17).sphere(0.05, { seg: 6, rings: 3, hemi: true }).pop();
    m.setMat(MI.woodDark);
    for (let k = 0; k < 3; k++) m.push().rotY(k * 1.05).rotZ(Math.PI / 2 - 0.25).translate(-0.06, -0.15, 0).cyl(0.025, 0.3, { seg: 6 }).pop();
    m.setMat(MI.flame).push().translate(0, 0.04, 0).cyl(0.1, 0.28, { r2: 0, seg: 7 }).pop();
    m.pop();
    ctx.lights.push([-0.25, 0.2, 0.45, "#ff8a2a", 1.6]);
    // râtelier d'armes
    m.push().translate(0.5, 0.02, 0.45).rotY(-0.5);
    m.setMat(MI.wood).box(-0.3, 0, -0.03, 0.3, 0.06, 0.03).box(-0.3, 0.32, -0.03, 0.3, 0.36, 0.03);
    m.setMat(MI.woodDark);
    for (let k = 0; k < 4; k++) m.push().translate(-0.22 + k * 0.15, 0, 0.02).rotX(-0.12).cyl(0.012, 0.62, { seg: 4 }).pop();
    m.setMat(MI.steel);
    for (let k = 0; k < 4; k++) m.push().translate(-0.22 + k * 0.15, 0.6, 0.09).rotX(-0.12).cyl(0.025, 0.1, { r2: 0, seg: 4 }).pop();
    m.pop();
    // bannière
    flagPole(m, 0.8, 0.02, 0.8, 1.15, ["flagGold", "flagBlue", "flagPurple"][tier], 0.8);
    // bottes de foin
    m.setMat(MI.hay).push().translate(0.75, 0.02, -0.1).rotZ(Math.PI / 2).cyl(0.12, 0.25, { seg: 10, y0: -0.12, bottom: true }).pop();
  },
  canon(m, L, ctx, aim = -2.4) {
    const T = TIER[tierOf(L)], tier = tierOf(L);
    // plateforme ronde
    m.setMat(MI[T.stone]).cyl(0.95, 0.28, { seg: 22 });
    m.setMat(MI[T.trim]).push().translate(0, 0.28, 0).cyl(0.98, 0.05, { seg: 22 }).pop();
    m.setMat(MI.dark).push().translate(0, 0.33, 0).cyl(0.62, 0.01, { seg: 18 }).pop();
    // sacs de sable
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2;
      const d = Math.abs(Math.atan2(Math.sin(a - aim), Math.cos(a - aim)));
      if (d < 0.5) continue; // ouverture du côté du tir
      sandbag(m, Math.cos(a) * 0.78, Math.sin(a) * 0.78, -a, 0.33);
    }
    // affût, roues, fût orienté vers la cible
    m.push().translate(0, 0.33, 0).rotY(-aim);
    m.setMat(MI.wood).box(-0.28, 0.08, -0.17, 0.24, 0.24, 0.17);
    m.setMat(MI.woodDark);
    for (const s of [-1, 1]) m.push().translate(-0.05, 0.16, s * 0.2).rotX(Math.PI / 2).cyl(0.16, 0.05, { seg: 14, y0: -0.025, bottom: true }).pop();
    m.setMat(MI.iron);
    for (const s of [-1, 1]) m.push().translate(-0.05, 0.16, s * 0.2).rotX(Math.PI / 2).torus(0.155, 0.018, { seg: 14, tube: 5 }).pop();
    const barrelMat = tier === 2 ? MI.gold : tier === 1 ? MI.bronze : MI.iron;
    m.push().translate(0, 0.34, 0).rotZ(-Math.PI / 2 + 0.22);
    m.setMat(barrelMat).cyl(0.13, 0.85 + 0.04 * L, { r2: 0.1, seg: 16, y0: -0.25 });
    m.setMat(barrelMat).push().translate(0, 0.62 + 0.04 * L, 0).torus(0.11, 0.035, { seg: 14, tube: 6 }).pop();
    m.setMat(barrelMat).push().translate(0, -0.25, 0).sphere(0.13, { seg: 10, rings: 6 }).pop();
    m.setMat(MI.black).push().translate(0, 0.6 + 0.04 * L, 0).cyl(0.07, 0.01, { seg: 10 }).pop();
    m.pop();
    m.pop();
    // pyramide de boulets
    m.setMat(MI.ironDark);
    for (const [x, z, y] of [[0.5, 0.42, 0.33], [0.6, 0.32, 0.33], [0.6, 0.52, 0.33], [0.57, 0.42, 0.44]]) m.push().translate(x, y + 0.05, z).sphere(0.06, { seg: 8, rings: 5 }).pop();
  },
  tour(m, L, ctx) {
    const T = TIER[tierOf(L)], tier = tierOf(L);
    m.setMat(MI[T.base]).box(-0.85, -0.04, -0.85, 0.85, 0.16, 0.85);
    const H = 2.35 + 0.15 * L;
    // fût carré légèrement effilé
    m.setMat(MI[tier === 0 ? "stoneWarm" : T.wall === "wood" ? "stoneWarm" : T.wall]).push().translate(0, 0.16, 0).rotY(Math.PI / 4).cyl(0.78, H, { r2: 0.66, seg: 4, smooth: false }).pop();
    // chaînages
    m.setMat(MI[T.trim]);
    for (const yy of [0.16, 0.16 + H * 0.5]) m.push().translate(0, yy, 0).rotY(Math.PI / 4).cyl(0.8 - (yy - 0.16) * 0.06, 0.08, { r2: 0.79 - (yy - 0.16) * 0.06, seg: 4, smooth: false }).pop();
    // meurtrières
    m.setMat(MI.black);
    for (const yy of [0.7, 1.4, 2.0]) {
      const hw = 0.55 - (yy / H) * 0.08;
      m.box(-0.03, yy, hw - 0.01, 0.03, yy + 0.24, hw + 0.03).box(hw - 0.01, yy, -0.03, hw + 0.03, yy + 0.24, 0.03);
    }
    // porte
    m.setMat(MI.door).box(-0.16, 0.16, 0.54, 0.16, 0.6, 0.6);
    // plateforme à mâchicoulis et créneaux
    const pw = 0.62;
    m.setMat(MI[T.stone]).push().translate(0, 0.16 + H - 0.05, 0).rotY(Math.PI / 4).cyl(0.82, 0.18, { r2: 0.9, seg: 4, smooth: false }).pop();
    m.setMat(MI[T.stone]).box(-pw, 0.16 + H + 0.13, -pw, pw, 0.16 + H + 0.22, pw);
    crenels(m, pw, pw, 0.16 + H + 0.22, T.stone, 0.14, 0.27);
    // toit pointu sur poteaux (niveau 3+)
    if (L >= 3) {
      m.setMat(MI[T.trim]);
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) m.push().translate(x, 0.16 + H + 0.22, z).cyl(0.035, 0.6, { seg: 6 }).pop();
      m.setMat(MI[T.roof]).push().translate(0, 0.16 + H + 0.8, 0).rotY(Math.PI / 4).cyl(0.82, 0.62, { r2: 0, seg: 4, smooth: false }).pop();
      m.setMat(MI.gold).push().translate(0, 0.16 + H + 1.45, 0).sphere(0.05, { seg: 8, rings: 5 }).pop();
    }
    // archer de l'IRF sur la plateforme
    m.push().translate(0.15, 0.16 + H + 0.22, 0.2).rotY(0.8);
    troopBody(m, "tireur", 0.2, 0.55, MI.clothNavy);
    m.pop();
    flagPole(m, -0.5, 0.16 + H + 0.22, -0.5, 0.75, "flagBlue", 1.1);
  },
  mortier(m, L, ctx, aim = -2.4) {
    const T = TIER[tierOf(L)], tier = tierOf(L);
    // fosse ronde
    m.setMat(MI[T.stone]).cyl(0.95, 0.34, { seg: 22 });
    m.setMat(MI.dark).push().translate(0, 0.34, 0).cyl(0.7, 0.005, { seg: 18 }).pop();
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 13; k++) {
        const a = (k / 13) * Math.PI * 2 + r * 0.24;
        sandbag(m, Math.cos(a) * 0.82, Math.sin(a) * 0.82, -a, 0.34 + r * 0.1);
      }
    // mortier trapu incliné vers la cible
    m.push().translate(0, 0.34, 0).rotY(-aim);
    m.setMat(MI.wood).cyl(0.36, 0.1, { seg: 14 });
    m.push().translate(0, 0.16, 0).rotZ(-0.62);
    const bm = tier === 2 ? MI.gold : tier === 1 ? MI.bronze : MI.iron;
    m.setMat(bm).cyl(0.26, 0.62, { r2: 0.3, seg: 16, y0: -0.1, bottom: true });
    m.setMat(bm).push().translate(0, 0.5, 0).torus(0.3, 0.05, { seg: 16, tube: 6 }).pop();
    m.setMat(MI.black).push().translate(0, 0.52, 0).cyl(0.24, 0.01, { seg: 14 }).pop();
    m.pop();
    m.setMat(MI.iron).push().translate(0, 0.12, 0).rotX(Math.PI / 2).cyl(0.12, 0.5, { seg: 10, y0: -0.25, bottom: true }).pop();
    m.pop();
    // obus
    m.setMat(MI.ironDark);
    for (const [x, z] of [[-0.5, 0.45], [-0.38, 0.55], [-0.55, 0.32]]) m.push().translate(x, 0.4, z).sphere(0.08, { seg: 8, rings: 5 }).pop();
  },
};

// ============================================================
// Soldats (petites figurines 3D animées)
// ============================================================
const TROOP_KIT = {
  colosse: { body: "armorSteel", legs: "ironDark", head: "armorSteel", scale: 1.12 },
  pillard: { body: "leather", legs: "woodDark", head: "clothGreen", scale: 1 },
  tireur: { body: "clothBlue", legs: "leather", head: "clothNavy", scale: 0.98 },
  heros: { body: "clothPurple", legs: "ironDark", head: "gold", scale: 1.22 },
  eclaireur: { body: "clothOchre", legs: "leather", head: "clothRed", scale: 0.92 },
};
// corps d'une figurine (repère local : pieds en y = 0, regarde vers +x)
function troopBody(m, role, phase = 0, s = 1, capeMat = null) {
  const K = TROOP_KIT[role] ?? TROOP_KIT.eclaireur, sw = Math.sin(phase) * 0.55;
  m.push().scale(s * K.scale);
  // jambes (balancier de marche)
  for (const side of [-1, 1]) {
    m.push().translate(0, 0.34, side * 0.07).rotZ(sw * side);
    m.setMat(MI[K.legs]).cyl(0.045, -0.32, { r2: 0.04, seg: 6, y0: 0 });
    m.setMat(MI.leather).push().translate(0.02, -0.33, 0).box(-0.05, 0, -0.04, 0.07, 0.06, 0.04).pop();
    m.pop();
  }
  // buste
  m.setMat(MI[K.body]).push().translate(0, 0.32, 0).cyl(0.11, 0.3, { r2: 0.13, seg: 10 }).pop();
  m.setMat(MI.leather).push().translate(0, 0.34, 0).cyl(0.115, 0.04, { seg: 10 }).pop();
  // bras
  for (const side of [-1, 1]) {
    m.push().translate(0, 0.6, side * 0.15).rotZ(-sw * side * 0.8).rotX(side * 0.15);
    m.setMat(MI[K.body]).cyl(0.035, -0.26, { seg: 6, y0: 0 });
    m.setMat(MI.skin).push().translate(0, -0.27, 0).sphere(0.035, { seg: 6, rings: 4 }).pop();
    m.pop();
  }
  // tête
  m.setMat(MI.skin).push().translate(0, 0.72, 0).sphere(0.09, { seg: 10, rings: 7 }).pop();
  m.setMat(MI.black).push().translate(0.08, 0.735, 0.03).sphere(0.012, { seg: 4, rings: 3 }).pop().push().translate(0.08, 0.735, -0.03).sphere(0.012, { seg: 4, rings: 3 }).pop();
  if (role === "colosse") {
    m.setMat(MI.armorSteel).push().translate(0, 0.72, 0).sphere(0.105, { seg: 10, rings: 5, hemi: true }).pop();
    m.setMat(MI.flagRed).push().translate(0, 0.82, 0).box(-0.06, 0, -0.012, 0.04, 0.08, 0.012).pop();
    // grand bouclier et épée
    m.push().translate(0.1, 0.45, -0.17).rotX(Math.PI / 2).rotZ(0.1);
    m.setMat(MI.wood).cyl(0.17, 0.04, { seg: 14, y0: -0.02, bottom: true });
    m.setMat(MI.steel).push().translate(0, 0.02, 0).cyl(0.06, 0.03, { seg: 10 }).pop();
    m.setMat(MI.iron).push().translate(0, -0.02, 0).torus(0.165, 0.02, { seg: 14, tube: 4 }).pop();
    m.pop();
    m.setMat(MI.steel).push().translate(0.08, 0.4, 0.2).rotZ(-0.6).box(-0.015, 0, -0.008, 0.015, 0.36, 0.008).pop();
  } else if (role === "pillard") {
    m.setMat(MI.clothGreen).push().translate(0, 0.74, 0).sphere(0.1, { seg: 10, rings: 5, hemi: true, sy: 0.8 }).pop();
    m.setMat(MI.sack).push().translate(-0.14, 0.52, 0).sphere(0.13, { seg: 8, rings: 6, sy: 1.1 }).pop();
    m.setMat(MI.gold).push().translate(-0.14, 0.66, 0).sphere(0.04, { seg: 6, rings: 4 }).pop();
    m.setMat(MI.woodDark).push().translate(0.12, 0.35, 0.18).rotZ(-0.9).cyl(0.03, 0.34, { r2: 0.05, seg: 6 }).pop();
  } else if (role === "tireur") {
    m.setMat(capeMat ?? MI.clothNavy).push().translate(-0.02, 0.73, 0).sphere(0.105, { seg: 10, rings: 6, hemi: true, sy: 1.2 }).pop();
    m.setMat(capeMat ?? MI.clothNavy).quad([-0.1, 0.66, -0.12], [-0.1, 0.66, 0.12], [-0.15, 0.25, 0.14], [-0.15, 0.25, -0.14]);
    // arc
    m.push().translate(0.14, 0.5, 0.1).rotX(Math.PI / 2);
    m.setMat(MI.woodDark);
    for (let k = 0; k < 6; k++) {
      const a0 = -1.1 + (k / 6) * 2.2, a1 = -1.1 + ((k + 1) / 6) * 2.2;
      m.push().translate(Math.cos(a0) * 0.2 - 0.18, Math.sin(a0) * 0.2, 0).rotZ(a0 + Math.PI / 2 + (a1 - a0) / 2).cyl(0.012, 0.075, { seg: 4, y0: -0.035 }).pop();
    }
    m.pop();
    m.setMat(MI.leather).push().translate(-0.12, 0.45, -0.06).rotZ(0.25).cyl(0.04, 0.26, { seg: 6 }).pop();
  } else if (role === "heros") {
    m.setMat(MI.gold).push().translate(0, 0.79, 0).cyl(0.075, 0.06, { seg: 10 }).pop();
    for (let k = 0; k < 5; k++) m.setMat(MI.gold).push().translate(Math.cos(k * 1.256) * 0.07, 0.85, Math.sin(k * 1.256) * 0.07).cyl(0.015, 0.05, { r2: 0, seg: 4 }).pop();
    m.setMat(MI.clothRedCape).quad([-0.11, 0.66, -0.14], [-0.11, 0.66, 0.14], [-0.22, 0.12, 0.2], [-0.22, 0.12, -0.2]);
    m.setMat(MI.gold).push().translate(0, 0.62, 0).cyl(0.14, 0.03, { seg: 10 }).pop();
    // épée lumineuse
    m.setMat(MI.heroGlow).push().translate(0.12, 0.34, 0.2).rotZ(-0.35).box(-0.018, 0, -0.008, 0.018, 0.5, 0.008).pop();
    m.setMat(MI.gold).push().translate(0.12, 0.34, 0.2).rotZ(-0.35).box(-0.06, -0.01, -0.012, 0.06, 0.02, 0.012).pop();
  } else {
    m.setMat(MI.clothRed).push().translate(0, 0.76, 0).cyl(0.093, 0.03, { seg: 10 }).pop();
    m.setMat(MI.clothRed).quad([-0.08, 0.77, -0.02], [-0.08, 0.77, 0.02], [-0.3, 0.7 + Math.sin(phase * 2) * 0.03, 0.04], [-0.3, 0.72 + Math.sin(phase * 2) * 0.03, -0.04]);
    m.setMat(MI.steel).push().translate(0.12, 0.38, 0.17).rotZ(-1.0).box(-0.012, 0, -0.006, 0.012, 0.2, 0.006).pop();
  }
  m.pop();
}
// une figurine complète posée sur la grille, avec son anneau de rareté
function troopModel(m, t, phase) {
  m.push().translate(t.wx, 0.02, t.wz);
  m.setMat(colorMat(t.ring ?? "#fde68a", { emit: t.ring ?? "#fde68a", ei: 1.4 })).torus(0.36, 0.035, { seg: 20, tube: 4 });
  m.rotY(-(t.yaw ?? 0));
  troopBody(m, t.role, phase, 1.5);
  m.pop();
}

// ============================================================
// Décombres et échafaudage
// ============================================================
function rubbleModel(m, size, seed, type) {
  const R = rng(seed), hs = size * 0.46;
  m.setMat(MI.ash).cyl(hs * 1.05, 0.03, { seg: 16 });
  const mats = [MI.char, MI.stoneDark, MI.rockGrey, MI.char, type === "manoir" ? MI.roofSlate : MI.woodDark];
  for (let k = 0; k < 18 + size * 8; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * hs, s = 0.08 + R() * 0.18;
    m.push().translate(Math.cos(a) * d, R() * 0.18 * (1 - d / hs) + 0.02, Math.sin(a) * d).rotY(R() * 3).rotX((R() - 0.5) * 1.2).rotZ((R() - 0.5) * 1.2);
    m.setMat(mats[k % mats.length]).box(-s, -s * 0.5, -s * 0.7, s, s * 0.5, s * 0.7);
    m.pop();
  }
  // poutres brisées
  for (let k = 0; k < 3 + size; k++) {
    const a = R() * Math.PI * 2;
    m.push().translate(Math.cos(a) * hs * 0.4, 0.15, Math.sin(a) * hs * 0.4).rotY(a).rotZ(0.4 + R() * 0.5);
    m.setMat(MI.char).box(-0.04, 0, -0.04, 0.04, 0.5 + R() * 0.4, 0.04);
    m.pop();
  }
  // braises
  for (let k = 0; k < 6; k++) m.setMat(MI.flame).push().translate((R() - 0.5) * hs, 0.08, (R() - 0.5) * hs).sphere(0.025, { seg: 4, rings: 3 }).pop();
}
function scaffoldModel(m, size) {
  const h = size * 0.5 + 0.9 + (size === 3 ? 1 : 0), hs = size * 0.5 + 0.04;
  m.setMat(MI.woodLight);
  for (const [x, z] of [[-hs, -hs], [hs, -hs], [-hs, hs], [hs, hs]]) m.push().translate(x, 0, z).cyl(0.03, h, { seg: 5 }).pop();
  for (let yy = 0.5; yy < h; yy += 0.55) {
    m.box(-hs, yy, hs - 0.02, hs, yy + 0.04, hs + 0.02).box(hs - 0.02, yy, -hs, hs + 0.02, yy + 0.04, hs);
    m.setMat(MI.wood).box(-hs, yy + 0.04, hs - 0.18, hs, yy + 0.07, hs + 0.02).box(hs - 0.18, yy + 0.04, -hs, hs + 0.02, yy + 0.07, hs);
    m.setMat(MI.woodLight);
  }
  // croisillons
  m.push().translate(0, 0, hs).rotZ(Math.atan2(h, hs * 2)).box(-0.015, -h, -0.015, 0.015, h * 1.2, 0.015).pop();
  // barrière de chantier rayée
  for (let k = 0; k < 5; k++) m.setMat(k % 2 ? MI.black : MI.flagGold).box(-0.4 + k * 0.16, 0.3, hs + 0.15, -0.24 + k * 0.16, 0.42, hs + 0.18);
  m.setMat(MI.woodDark).box(-0.42, 0, hs + 0.15, -0.38, 0.42, hs + 0.18).box(0.38, 0, hs + 0.15, 0.42, 0.42, hs + 0.18);
}

// ============================================================
// L'île flottante
// ============================================================
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}
// rayon du contour de l'île selon l'angle (carré arrondi aux bords irréguliers)
function outline(theta, seed) {
  const p = 5, A = 13.25;
  const c = Math.abs(Math.cos(theta)), s = Math.abs(Math.sin(theta));
  const sq = A / Math.pow(Math.pow(c, p) + Math.pow(s, p), 1 / p);
  return sq + (n2(theta * 2.2 + seed * 0.001, 3.3) - 0.5) * 1.0 + (n2(theta * 9, 7.7) - 0.5) * 0.3;
}
function islandModel(m, seed) {
  const N = 72, R = rng(seed + 77);
  // dessus : grille déformée sur le contour
  const V = [];
  for (let j = 0; j <= N; j++) {
    const row = [];
    for (let i = 0; i <= N; i++) {
      const u = (i / N) * 2 - 1, v = (j / N) * 2 - 1, rs = Math.max(Math.abs(u), Math.abs(v));
      const th = Math.atan2(v, u), rad = rs * outline(th, seed);
      const x = rs > 0 ? Math.cos(th) * rad : 0, z = rs > 0 ? Math.sin(th) * rad : 0;
      let y = (n2(x * 0.35 + 3, z * 0.35) - 0.5) * 0.08;
      y -= 0.32 * Math.pow(Math.max(0, rs - 0.9) / 0.1, 2);
      // bosses douces hors de la zone construite
      const outer = Math.max(0, Math.max(Math.abs(x), Math.abs(z)) - 11.6);
      y += outer * 0.06 * n2(x * 0.5, z * 0.5);
      row.push([x, y, z]);
    }
    V.push(row);
  }
  // normales lissées
  const NRM = V.map((row, j) =>
    row.map((p, i) => {
      const a = V[j][Math.min(N, i + 1)], b = V[j][Math.max(0, i - 1)], c = V[Math.min(N, j + 1)][i], d = V[Math.max(0, j - 1)][i];
      const ux = a[0] - b[0], uy = a[1] - b[1], uz = a[2] - b[2], vx = c[0] - d[0], vy = c[1] - d[1], vz = c[2] - d[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      if (ny < 0) (nx = -nx), (ny = -ny), (nz = -nz);
      const l = Math.hypot(nx, ny, nz) || 1;
      return [nx / l, ny / l, nz / l];
    })
  );
  m.setMat(MI.grass).setObj(1);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const a = V[j][i], b = V[j][i + 1], c = V[j + 1][i + 1], d = V[j + 1][i];
      m.tri(a, c, b, NRM[j][i], NRM[j + 1][i + 1], NRM[j][i + 1]);
      m.tri(a, d, c, NRM[j][i], NRM[j + 1][i], NRM[j + 1][i + 1]);
    }
  // bord : la boucle des points du contour, dans l'ordre
  const loop = [];
  for (let i = 0; i < N; i++) loop.push([i, 0]);
  for (let j = 0; j < N; j++) loop.push([N, j]);
  for (let i = N; i > 0; i--) loop.push([i, N]);
  for (let j = N; j > 0; j--) loop.push([0, j]);
  const edge = loop.map(([i, j]) => V[j][i]);
  // anneaux de falaise qui s'enfoncent et se resserrent : une montagne renversée
  const RINGS = [
    [0, 1, 0],
    [-0.55, 1.015, 0.05],
    [-1.4, 1.005, 0.12],
    [-2.6, 0.965, 0.2],
    [-4.0, 0.9, 0.28],
    [-5.8, 0.8, 0.36],
    [-7.8, 0.66, 0.42],
    [-10.0, 0.48, 0.46],
    [-12.4, 0.29, 0.44],
    [-14.6, 0.12, 0.3],
  ];
  const rings = RINGS.map(([dy, sc, amp], k) =>
    edge.map((p, q) => {
      if (k === 0) return p;
      const th = Math.atan2(p[2], p[0]), r = Math.hypot(p[0], p[2]);
      const wob = (n2(th * 4.1 + k * 1.7, k * 3.1) - 0.5) * 2 * amp * 3 + (h2(q * 3 + k, k) - 0.5) * amp * 0.8;
      const rr = Math.max(0.2, r * sc + wob);
      return [Math.cos(th) * rr, p[1] + dy + (n2(th * 6, k) - 0.5) * amp * 1.5, Math.sin(th) * rr];
    })
  );
  m.setObj(1);
  for (let k = 0; k < rings.length - 1; k++) {
    m.setMat(k === 0 ? MI.lip : MI.rock);
    const A = rings[k], B = rings[k + 1], n = A.length;
    for (let q = 0; q < n; q++) {
      const a = A[q], b = A[(q + 1) % n], c = B[(q + 1) % n], d = B[q];
      m.tri(a, b, c);
      m.tri(a, c, d);
    }
  }
  // pointe
  const last = rings[rings.length - 1], tip = [0.6, -17.5, -0.4];
  m.setMat(MI.rock);
  for (let q = 0; q < last.length; q++) m.tri(last[q], last[(q + 1) % last.length], tip);
  // rochers suspendus (stalactites)
  for (let k = 0; k < 16; k++) {
    const ring = 2 + Math.floor(R() * 5), q = Math.floor(R() * edge.length), p = rings[ring][q];
    const len = 1.2 + R() * 2.6;
    m.push().translate(p[0] * 0.97, p[1] + 0.2, p[2] * 0.97).rotX(Math.PI).rotZ((R() - 0.5) * 0.3);
    m.setMat(MI.rock).cyl(0.35 + R() * 0.45, len, { r2: 0.02, seg: 6, smooth: false, top: false });
    m.pop();
  }
  // racines pendantes sous le rebord
  m.setMat(MI.bark);
  for (let k = 0; k < 22; k++) {
    const q = Math.floor(R() * edge.length), p = rings[1][q], len = 0.6 + R() * 1.4;
    m.push().translate(p[0] * 0.995, p[1] + 0.1, p[2] * 0.995).rotX(Math.PI + (R() - 0.5) * 0.4).rotZ((R() - 0.5) * 0.4);
    m.cyl(0.03, len, { r2: 0.008, seg: 4, top: false });
    m.pop();
  }
  return { edge, rings };
}
// îlots lointains (dans la brume)
function isletModel(m, x, y, z, s, seed) {
  const R = rng(seed);
  m.push().translate(x, y, z).scale(s);
  m.setObj(5);
  m.setMat(MI.grass).cyl(1.9, 0.18, { seg: 14, y0: -0.18 });
  m.setMat(MI.lip).cyl(1.92, 0.3, { r2: 1.9, seg: 14, y0: -0.48, top: false });
  m.setMat(MI.rock).push().translate(0, -0.48, 0).rotX(Math.PI).cyl(1.92, 3.4, { r2: 0.15, seg: 10, smooth: false, top: false }).pop();
  for (let k = 0; k < 3; k++) {
    const a = R() * 6.28, d = R() * 1.1;
    treeModel(m, Math.cos(a) * d, Math.sin(a) * d, R() < 0.5 ? "tree" : "pine", R() * 0.4 + 0.8, seed + k);
  }
  m.pop();
}
// arbres, rochers, buissons, fleurs
function treeModel(m, x, z, kind, s = 1, seed = 1) {
  const R = rng(seed * 31 + 7);
  m.push().translate(x, 0, z).scale(s);
  if (kind === "pine") {
    m.setMat(MI.bark).cyl(0.07, 0.4, { r2: 0.05, seg: 6 });
    for (let k = 0; k < 4; k++) {
      const r = 0.5 - k * 0.1, y = 0.25 + k * 0.32;
      m.setMat(MI.leafPine).push().translate(0, y, 0).rotY(R() * 3).cyl(r, 0.55, { r2: 0, seg: 9, smooth: false, bottom: true }).pop();
    }
  } else if (kind === "rock") {
    m.setMat(MI.rockGrey).sphere(0.32, { seg: 8, rings: 5, hemi: true, facet: true, sx: 1.3, sy: 0.75, disp: (a, b, c) => 1 + 0.2 * h2(Math.floor(a * 3 + 5), Math.floor(c * 3 + b * 2)) });
    m.setMat(MI.leafBush).push().translate(0.1, 0.18, 0.05).sphere(0.08, { seg: 5, rings: 3, hemi: true, sy: 0.4 }).pop();
  } else if (kind === "bush") {
    for (const [dx, dz, r] of [[-0.12, 0, 0.2], [0.12, 0.05, 0.18], [0, -0.1, 0.22]]) m.setMat(MI.leafBush).push().translate(dx, 0.08, dz).sphere(r, { seg: 8, rings: 6, sy: 0.85, disp: (a, b, c) => 1 + 0.15 * Math.sin(a * 11 + c * 7 + b * 5) }).pop();
    for (let k = 0; k < 5; k++) m.setMat(MI.berry).push().translate((R() - 0.5) * 0.4, 0.15 + R() * 0.18, (R() - 0.5) * 0.4).sphere(0.025, { seg: 4, rings: 3 }).pop();
  } else if (kind === "flowers") {
    const cols = [MI.flowerY, MI.flowerP, MI.flowerW, MI.flowerV];
    for (let k = 0; k < 9; k++) {
      const a = R() * 6.28, d = R() * 0.35;
      m.setMat(MI.leafBush).push().translate(Math.cos(a) * d, 0, Math.sin(a) * d).cyl(0.008, 0.12, { seg: 3 }).pop();
      m.setMat(cols[k % 4]).push().translate(Math.cos(a) * d, 0.13, Math.sin(a) * d).sphere(0.035, { seg: 5, rings: 3, sy: 0.6 }).pop();
    }
  } else {
    // feuillu : tronc, branches et couronne de feuillage
    const leaf = seed % 7 === 0 ? MI.leafAutumn : seed % 11 === 0 ? MI.blossom : MI.leaf;
    m.setMat(MI.bark).cyl(0.09, 0.8, { r2: 0.06, seg: 7 });
    for (let k = 0; k < 3; k++) m.setMat(MI.bark).push().translate(0, 0.55 + k * 0.08, 0).rotY(k * 2.1 + R()).rotZ(0.75).cyl(0.03, 0.35, { r2: 0.015, seg: 4 }).pop();
    const blobs = [[0, 1.15, 0, 0.55], [-0.3, 0.95, 0.12, 0.38], [0.28, 0.98, -0.1, 0.4], [0.05, 0.9, 0.32, 0.36], [-0.05, 1.45, -0.05, 0.36]];
    for (const [bx, by, bz, br] of blobs) m.setMat(leaf).push().translate(bx, by, bz).sphere(br * (0.9 + R() * 0.2), { seg: 10, rings: 7, disp: (a, b, c) => 1 + 0.14 * Math.sin(a * 9 + seed) * Math.cos(c * 8 + b * 6) + 0.08 * Math.sin(b * 13) }).pop();
  }
  m.pop();
}
// muret d'enceinte : segments entre les points du cercle (ouvertures comprises)
function wallModel(m, wall, tier) {
  if (!wall.length) return;
  const mat = [MI.woodDark, MI.stone, MI.marble][tier], cap = [MI.wood, MI.stoneDark, MI.gold][tier];
  const pts = wall.map((w) => [w.x - 12, w.y - 12]);
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len > 0.9) continue; // ouverture (porte)
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    m.push().translate(mx, 0, mz).rotY(-ang);
    if (tier === 0) {
      // palissade de rondins
      m.setMat(mat).push().translate(0, 0, 0).cyl(0.07, 0.55, { seg: 6 }).pop();
      m.setMat(mat).push().translate(0, 0.55, 0).cyl(0.07, 0.08, { r2: 0, seg: 6 }).pop();
      m.setMat(MI.wood).box(-len / 2 - 0.02, 0.32, -0.03, len / 2 + 0.02, 0.38, 0.03);
    } else {
      m.setMat(mat).box(-len / 2 - 0.01, 0, -0.17, len / 2 + 0.01, 0.42, 0.17);
      m.setMat(cap).box(-len / 2 - 0.02, 0.42, -0.2, len / 2 + 0.02, 0.48, 0.2);
      if (k % 2 === 0) m.setMat(mat).box(-0.09, 0.48, -0.15, 0.09, 0.62, 0.15);
    }
    m.pop();
  }
}

// ============================================================
// Assemblage du monde
// ============================================================
// data : { seed, tier, layout: [{ id, type, level, x, y, upgrading }], decor: { items, wall } }
const SUN = M3.norm([-0.48, 0.62, 0.62]);
function buildWorld(data, opts = {}) {
  const seed = data.seed ?? 1, tier = data.tier ?? 0;
  const static_ = new Mesh();
  const island = islandModel(static_, seed);
  // décor
  static_.setObj(2);
  for (const d of data.decor?.items ?? []) {
    const [x, , z] = M3.gridToWorld(d.x, d.y);
    treeModel(static_, x, z, d.kind, d.kind === "tree" || d.kind === "pine" ? 1.1 + (d.v ?? 0.5) * 0.5 : 1.25, Math.floor((d.v ?? 0.5) * 1000) + 3);
  }
  static_.setObj(3);
  wallModel(static_, data.decor?.wall ?? [], tier);
  // îlots lointains
  isletModel(static_, -24, -9, 18, 1.6, seed + 1);
  isletModel(static_, 16, -13, -30, 2.1, seed + 2);
  isletModel(static_, 28, -18, 8, 1.4, seed + 4);
  // bâtiments : un maillage chacun (pour pouvoir les détruire séparément)
  const buildings = (data.layout ?? []).map((b, i) => {
    const [x, , z] = M3.gridToWorld(b.x, b.y);
    return { ...b, idx: i, wx: x, wz: z, obj: 100 + i };
  });
  const paths = [], foot = [];
  const manoir = buildings.find((b) => b.type === "manoir");
  for (const b of buildings) {
    const size = b.type === "manoir" ? 3 : 2;
    foot.push(b.wx, b.wz, size * 0.46 * BSCALE, size * 0.46 * BSCALE);
    if (manoir && b !== manoir) paths.push(manoir.wx, manoir.wz, b.wx, b.wz);
  }
  const env = {
    mats: MATS,
    eye: [0, 0, 0],
    sun: { dir: SUN, color: [3.15, 2.62, 1.95] },
    shadow: null,
    sky: [0.3, 0.42, 0.62],
    ground: [0.17, 0.15, 0.1],
    horizon: [0.95, 0.78, 0.6],
    fog: { color: [0.34, 0.4, 0.52], start: 80, density: 0.016, below: 2.5, belowK: 0.032 },
    exposure: 0.95,
    terrain: { paths: Float64Array.from(paths), foot: Float64Array.from(foot) },
  };
  return { static_: static_.compile(), island, buildings, env, seed, tier };
}
// maillage d'un bâtiment dans un état donné : "intact", "ruine" ; aim : orientation des défenses
// les bâtiments sont dessinés un peu plus grands que leur emprise sur la grille (lisibilité)
const BSCALE = 1.35;
function buildingMesh(b, state = "intact", aim = null, t = 0) {
  const m = new Mesh();
  m.setObj(b.obj);
  m.push().translate(b.wx, 0, b.wz).scale(BSCALE);
  const size = b.type === "manoir" ? 3 : 2;
  if (state === "ruine") rubbleModel(m, size, (b.obj * 977) ^ 0x51, b.type);
  else {
    const ctx = { R: rng((b.obj * 131) ^ (b.level * 17)), lights: [], t };
    const lvl = Math.max(1, b.level || 1);
    if (b.type === "canon" || b.type === "mortier") BUILD[b.type](m, lvl, ctx, aim ?? -0.75);
    else BUILD[b.type]?.(m, lvl, ctx);
    if (b.upgrading) scaffoldModel(m, size);
  }
  m.pop();
  return m.compile();
}
// la carte des ombres couvre toute l'île (bâtiments intacts compris)
function sunShadow(world, buildingMeshes, size = 2048, withIds = false) {
  const sc = M3.makeSunCamera(SUN, [0, -1, 0], 17.5, size);
  // unité : 1 unité du monde dans l'échelle de profondeur de la carte (pour le biais)
  const unit = (1 / (17.5 * 4)) * 0.035;
  return shadowMap([world.static_, ...buildingMeshes], { ...sc, unit }, null, withIds);
}

module.exports = { BSCALE, MATS, MI, colorMat, BUILD, TIER, tierOf, buildWorld, buildingMesh, sunShadow, troopModel, troopBody, Mesh, render, rng, SUN };
