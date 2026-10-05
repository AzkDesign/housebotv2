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
  v_avion: "Transport", v_carte: "Objet", v_sac: "Objet", v_photo: "Objet", v_boussole: "Objet", v_billet: "Transport", v_plage: "Destination",
  v_tgv: "Transport", v_croisiere: "Transport", v_newyork: "Destination", v_londres: "Destination", v_ile: "Destination", v_fuji: "Merveille",
  v_kyoto: "Destination", v_istanbul: "Destination", v_volcan: "Merveille", v_fusee: "Transport", v_sahara: "Merveille", v_aurore: "Merveille",
  v_paques: "Merveille", v_tourdumonde: "Légende",
};
const SECTOR_NAMES = { transport: "Transport", restauration: "Restauration", garage: "Garage", beaute: "Beauté", evenementiel: "Événementiel", securite: "Sécurité", media: "Média", immobilier: "Immobilier", commerce: "Commerce" };
function kindOf(card) {
  const series = seriesOf(card);
  if (series === "entreprises") return `Entreprise · ${SECTOR_NAMES[card.sector] ?? "La Maison"}`;
  if (series === "membres") return "Membre de la Maison";
  if (series === "evenements") return "Événement exceptionnel";
  return `${KINDS[card.id] ?? "Carte"} · ${SERIES[series]?.name ?? "La Maison"}`;
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
function combatIcon(ctx, kind, x, y, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if (kind === 0) {
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.bezierCurveTo(x - 11, y - 1, x - 7, y - 10, x, y - 4);
    ctx.bezierCurveTo(x + 7, y - 10, x + 11, y - 1, x, y + 7);
    ctx.fill();
    return;
  }
  if (kind === 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.fillRect(-1.6, -10, 3.2, 14);
    ctx.fillRect(-5, 3, 10, 2.4);
    ctx.fillRect(-1.2, 5, 2.4, 5);
    ctx.restore();
    return;
  }
  sparkle(ctx, x, y, 4.5, color);
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
  } else if (series === "voyage") {
    ctx.lineWidth = Math.max(1.2, s * 0.16);
    ctx.arc(x, y, s * 0.9, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.38, s * 0.9, 0, 0, TAU);
    ctx.moveTo(x - s * 0.9, y);
    ctx.lineTo(x + s * 0.9, y);
    ctx.stroke();
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
  ACT: ["Bavardage", "Lance la discussion dans le salon. Attaque de base : aucune énergie requise."],
  ANC: ["Vétéran de la Maison", "Connaît toutes les règles par cœur. Attaque de base : aucune énergie requise."],
  FOR: ["Pluie d'euros", "Fait pleuvoir les billets. Attaque de base : aucune énergie requise."],
  STA: ["Étoile filante", "L'éclat d'un Membre Star. Attaque de base : aucune énergie requise."],
  CHA: ["Coup de chance", "Tout repose sur la chance. Attaque de base : aucune énergie requise."],
};
const RANK_MOVES = {
  rare: ["Coup de main", "Toute la Maison donne un coup de main. Coup spécial : coûte 3 énergies, impossible à esquiver.", 3],
  epique: ["Ambition", "Rien n'arrête un résident ambitieux. Coup spécial : coûte 3 énergies, impossible à esquiver.", 3],
  legendaire: ["Charisme doré", "Toute la Maison écoute. Coup spécial : coûte 3 énergies, impossible à esquiver.", 3],
  mythique: ["Volonté de la Fondation", "Rien ne résiste à la Fondation. Coup spécial : coûte 3 énergies, impossible à esquiver.", 3],
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
  const cpm = combatProfile(card, holo);
  const hp = cpm.hp;
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
  moves[0].damage = cpm.attack;
  moves[0].cost = 0;
  moves[1].damage = cpm.special;
  moves[1].cost = SPECIAL_COST;
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

  // Chiffres de combat : PV, dégâts d'attaque et dégâts du spécial
  const cp = combatProfile(card, holo);
  [["PV", cp.hp, 250], ["ATTAQUE", cp.attack, 75], ["SPÉCIAL", cp.special, 130]].forEach(([label, value, max], i) => {
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
    combatIcon(ctx, i, bx + 22, by + 21, i === 0 ? "#f87171" : m[0]);
    ctx.fillStyle = "#cbb9a9";
    ctx.font = "13px CardEngrave";
    ctx.textAlign = "left";
    ctx.fillText(label, bx + 36, by + 26);
    ctx.fillStyle = i === 0 ? "#fecaca" : "#ffffff";
    ctx.font = "36px CardTitle";
    ctx.textAlign = "center";
    ctx.fillText(String(value), bx + 80, by + 62);
    if (i === 2) {
      // nom du coup spécial sous les dégâts
      ctx.font = `${fitText(ctx, cp.specialName, 138, 12, "CardItalic")}px CardItalic`;
      ctx.fillStyle = "#ecc979";
      ctx.fillText(cp.specialName, bx + 80, by + 81);
      ctx.textAlign = "left";
      return;
    }
    ctx.textAlign = "left";
    roundRect(ctx, bx + 18, by + 74, 124, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    roundRect(ctx, bx + 18, by + 74, Math.max(6, Math.min(124, (124 * value) / max)), 6, 3);
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
  // de part et d'autre : chance (critiques et esquives) et type (avantage en combat)
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#a08a7a";
  ctx.textAlign = "right";
  ctx.fillText(`CHANCE ${cp.luck}`, W / 2 - 74, 700);
  ctx.textAlign = "left";
  ctx.fillText(`TYPE ${SERIES_LABELS[series].replace(/^\S+ /, "").toUpperCase()}`, W / 2 + 74, 700);

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

