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
  "✈️": "Airplane", "🗺️": "World map", "🎒": "Backpack", "📷": "Camera", "🧭": "Compass", "🎫": "Ticket", "🏖️": "Beach with umbrella",
  "🚄": "High-speed train", "🛳️": "Passenger ship", "🗽": "Statue of liberty", "🎡": "Ferris wheel", "🏝️": "Desert island", "🗻": "Mount fuji",
  "🏯": "Japanese castle", "🕌": "Mosque", "🌋": "Volcano", "🚀": "Rocket", "🏜️": "Desert", "🌌": "Milky way", "🗿": "Moai",
  "🌍": "Globe showing europe-africa", "🏆": "Trophy", "🏅": "Sports medal", "🍀": "Four leaf clover",
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
  ev_champion: { scene: "feux", fx: "or", anim: "popout" },
  ev_podium: { scene: "feux", fx: "confettis" },
  sh_trefle: { scene: "jardin", fx: "eclats" },
  v_avion: { scene: "jour", fx: "traits" },
  v_carte: { scene: "parchemin", fx: "or" },
  v_sac: { scene: "aube", fx: "poussiere" },
  v_photo: { scene: "nuit", fx: "flashs" },
  v_boussole: { scene: "parchemin", fx: "eclats" },
  v_billet: { scene: "metro", fx: "traits" },
  v_plage: { scene: "jour", fx: "bulles", water: true },
  v_tgv: { scene: "crepuscule", fx: "traits" },
  v_croisiere: { scene: "crepuscule", fx: "bulles", water: true },
  v_newyork: { scene: "ville", fx: "lumieres" },
  v_londres: { scene: "pluie", fx: "pluie" },
  v_ile: { scene: "jour", fx: "bulles", water: true },
  v_fuji: { scene: "aube", fx: "petales" },
  v_kyoto: { scene: "aube", fx: "petales" },
  v_istanbul: { scene: "crepuscule", fx: "lucioles" },
  v_volcan: { scene: "souterrain", fx: "braises" },
  v_fusee: { scene: "cosmos", fx: "etincelles" },
  v_sahara: { scene: "or", fx: "poussiere" },
  v_aurore: { scene: "cosmos", fx: "etoiles", anim: "tilt-v" },
  v_paques: { scene: "nuit", fx: "lucioles", anim: "flip" },
  v_tourdumonde: { scene: "cosmos", fx: "orbes" },
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

