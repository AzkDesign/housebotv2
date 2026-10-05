
// --- Design commun : cartes de créatures à collectionner ---
// Toutes les cartes partagent le même gabarit : bordure graphite et métal, panneau « carton imprimé »
// teinté par l'élément, en-tête (nom, PV, orbe d'élément), grande illustration, attaques, faiblesse,
// résistance, texte d'ambiance et pied de carte (numéro, symbole de rareté, génération).
// L'illustration vient de illustrations/images/<clé>.jpg (créature générée) ; en attendant, le bot
// utilise l'ancienne illustration (décor et objet 3D). Les cartes de membres gardent la photo du membre.
const ART = require("./illustrations/fiches");
const ART_DIR = path.join(__dirname, "illustrations", "images");

// Éléments visuels : ambiance, couleurs et particules (le type de combat reste celui de la série)
const ELEMENTS = {
  feu: { label: "Feu", colors: ["#f97316", "#7c2d12", "#fed7aa"], fx: "braises" },
  eau: { label: "Eau", colors: ["#3b82f6", "#1e3a8a", "#dbeafe"], fx: "bulles" },
  foudre: { label: "Foudre", colors: ["#8b5cf6", "#2e1065", "#ede9fe"], fx: "eclats" },
  nature: { label: "Nature", colors: ["#22c55e", "#14532d", "#dcfce7"], fx: "petales" },
  ombre: { label: "Ombre", colors: ["#a855f7", "#3b0764", "#f3e8ff"], fx: "lucioles" },
  chance: { label: "Chance", colors: ["#f59e0b", "#78350f", "#fef3c7"], fx: "or" },
  lumiere: { label: "Lumière", colors: ["#ec4899", "#831843", "#fdf2f8"], fx: "eclats" },
  air: { label: "Air", colors: ["#14b8a6", "#134e4a", "#ccfbf1"], fx: "traits" },
  pierre: { label: "Pierre", colors: ["#b45309", "#451a03", "#fde68a"], fx: "poussiere" },
  glace: { label: "Glace", colors: ["#06b6d4", "#164e63", "#cffafe"], fx: "neige" },
};
const SERIES_ELEMENT = { paris: "lumiere", maison: "chance", voyage: "air", entreprises: "pierre", evenements: "lumiere" };
function elementOf(card) {
  if (card.memberStats) {
    // membres : l'élément suit leur point fort
    const best = ["ACT", "ANC", "FOR", "STA", "CHA"].sort((a, b) => (card.memberStats[b] ?? 0) - (card.memberStats[a] ?? 0))[0];
    return { ACT: "foudre", ANC: "pierre", FOR: "chance", STA: "lumiere", CHA: "air" }[best];
  }
  return ART.FICHES[ART.illustrationKey(card)]?.[2] ?? SERIES_ELEMENT[seriesOf(card)] ?? "lumiere";
}
const artCache = new Map();
async function creatureArt(card) {
  const key = ART.illustrationKey(card);
  if (artCache.has(key)) return artCache.get(key);
  const file = path.join(ART_DIR, `${key}.jpg`);
  const img = fs.existsSync(file) ? await loadImage(file).catch(() => null) : null;
  artCache.set(key, img);
  return img;
}
function mixHex(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

// --- Icônes communes : éléments et raretés ---
function elementIcon(ctx, key, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (key === "feu") {
    ctx.moveTo(x, y - s);
    ctx.quadraticCurveTo(x + s, y - s * 0.05, x + s * 0.5, y + s * 0.8);
    ctx.quadraticCurveTo(x, y + s * 1.05, x - s * 0.5, y + s * 0.8);
    ctx.quadraticCurveTo(x - s * 0.95, y - s * 0.1, x - s * 0.15, y - s * 0.35);
    ctx.quadraticCurveTo(x - s * 0.05, y - s * 0.7, x, y - s);
    ctx.fill();
  } else if (key === "eau") {
    ctx.moveTo(x, y - s);
    ctx.bezierCurveTo(x + s * 0.95, y + s * 0.05, x + s * 0.75, y + s, x, y + s);
    ctx.bezierCurveTo(x - s * 0.75, y + s, x - s * 0.95, y + s * 0.05, x, y - s);
    ctx.fill();
  } else if (key === "foudre") {
    ctx.moveTo(x + s * 0.25, y - s);
    ctx.lineTo(x - s * 0.6, y + s * 0.15);
    ctx.lineTo(x - s * 0.02, y + s * 0.15);
    ctx.lineTo(x - s * 0.25, y + s);
    ctx.lineTo(x + s * 0.6, y - s * 0.18);
    ctx.lineTo(x + s * 0.03, y - s * 0.18);
    ctx.closePath();
    ctx.fill();
  } else if (key === "nature") {
    ctx.ellipse(x, y, s * 0.55, s, 0.6, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = Math.max(1, s * 0.12);
    ctx.beginPath();
    ctx.moveTo(x - s * 0.55, y + s * 0.75);
    ctx.lineTo(x + s * 0.5, y - s * 0.7);
    ctx.stroke();
  } else if (key === "ombre") {
    ctx.arc(x, y, s, Math.PI * 0.3, Math.PI * 1.7);
    ctx.arc(x + s * 0.55, y, s * 0.78, Math.PI * 1.42, Math.PI * 0.58, true);
    ctx.closePath();
    ctx.fill();
  } else if (key === "chance") {
    for (const [dx, dy] of [[0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]]) {
      ctx.moveTo(x + dx * s + s * 0.42, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, s * 0.42, 0, TAU);
    }
    ctx.fill();
  } else if (key === "lumiere") {
    sparkle(ctx, x, y, s * 0.5, color);
  } else if (key === "air") {
    ctx.arc(x - s * 0.1, y - s * 0.15, s * 0.55, Math.PI * 0.9, Math.PI * 2.1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - s, y + s * 0.35);
    ctx.lineTo(x + s * 0.55, y + s * 0.35);
    ctx.moveTo(x - s * 0.7, y + s * 0.8);
    ctx.lineTo(x + s * 0.2, y + s * 0.8);
    ctx.stroke();
  } else if (key === "pierre") {
    ctx.moveTo(x - s, y + s * 0.8);
    ctx.lineTo(x - s * 0.25, y - s * 0.6);
    ctx.lineTo(x + s * 0.1, y - s * 0.05);
    ctx.lineTo(x + s * 0.45, y - s * 0.85);
    ctx.lineTo(x + s, y + s * 0.8);
    ctx.closePath();
    ctx.fill();
  } else {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      ctx.lineTo(x - Math.cos(a) * s, y - Math.sin(a) * s);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function energyOrb(ctx, key, x, y, r) {
  const el = ELEMENTS[key] ?? ELEMENTS.lumiere;
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, el.colors[2]);
  g.addColorStop(0.45, el.colors[0]);
  g.addColorStop(1, el.colors[1]);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  disc(ctx, x, y, r, g);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, TAU);
  ctx.stroke();
  elementIcon(ctx, key, x, y, r * 0.55, "#ffffff");
}
// symbole de rareté : ● commune, ◆ peu commune, ★ rare, ★ violette épique, ★ dorée légendaire, ★★ mythique
function rarityIcon(ctx, rarity, x, y, s, ink) {
  if (rarity === "commune") return disc(ctx, x, y, s * 0.55, ink);
  if (rarity === "peucommune") {
    diamond(ctx, x, y, s * 0.75);
    ctx.fillStyle = ink;
    return ctx.fill();
  }
  const color = { rare: ink, epique: "#7c3aed", legendaire: "#d97706", mythique: "#d97706" }[rarity];
  if (rarity === "mythique") {
    star5(ctx, x - s * 0.6, y, s * 0.75, color);
    star5(ctx, x + s * 0.6, y, s * 0.75, color);
    return;
  }
  star5(ctx, x, y, s * 0.85, color);
}

// --- Texture de carte imprimée (grain du carton, calculé une seule fois) ---
let printGrain = null;
function printTexture() {
  if (printGrain) return printGrain;
  const c = createCanvas(600, 840);
  const x = c.getContext("2d");
  const img = x.createImageData(600, 840);
  const R = seeded(77);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (R() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  printGrain = c;
  return c;
}

// --- Illustration : créature générée, photo du membre, ou illustration provisoire ---
async function drawCreatureArt(ctx, card, box, t, el, elKey) {
  const img = await creatureArt(card);
  // pour les pleines pages, le sujet se place au-dessus du panneau des attaques
  const focus = card.rarity === "mythique" ? { x: box.x, y: box.y + 40, w: box.w, h: 440 } : box;
  if (img) {
    const s = Math.max(box.w / img.width, box.h / img.height) * (1.03 + 0.015 * Math.sin(TAU * t));
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
  } else if (card.avatar) {
    const av = await fetchImage(`avatar:${card.avatar}`, card.avatar);
    const bg = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
    bg.addColorStop(0, el.colors[0]);
    bg.addColorStop(1, el.colors[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    if (av) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.filter = "blur(18px) saturate(1.3)";
      const side = Math.max(box.w, box.h) * 1.2;
      ctx.drawImage(av, box.x + box.w / 2 - side / 2, box.y + box.h / 2 - side / 2, side, side);
      ctx.restore();
    }
    const cx = focus.x + focus.w / 2, cy = focus.y + focus.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((t * TAU) / 16);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(TAU / 16);
      ctx.fillStyle = `rgba(255,255,255,${i % 2 ? 0.04 : 0.1})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-30, -600);
      ctx.lineTo(30, -600);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    glow(ctx, cx, cy, box.h * 0.6, el.colors[2], 0.45);
    const ps = Math.min(focus.h * 0.66, focus.w * 0.6), px = cx - ps / 2, py = cy - ps / 2 + Math.sin(TAU * t) * 4;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    roundRect(ctx, px - 6, py - 6, ps + 12, ps + 12, 26);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, px, py, ps, ps, 22);
    ctx.clip();
    if (av) ctx.drawImage(av, px, py, ps, ps);
    ctx.restore();
  } else {
    // illustration provisoire en attendant la créature générée
    drawScene(ctx, box, themeOf(card), card, t);
    const size = Math.min(focus.h * 0.8, focus.w * 0.68);
    const anchor = { cx: focus.x + focus.w / 2, top: focus.y + focus.h - size - 16 + Math.sin(TAU * t) * 5, size };
    anchor.cy = anchor.top + size / 2;
    glow(ctx, anchor.cx, anchor.cy, size * 0.62, el.colors[0], 0.35);
    await drawSubject(ctx, card, anchor, metalGradient(ctx, 600, 840, METAL[card.rarity]), METAL[card.rarity]);
  }
  // particules de l'élément (elles s'animent sur les cartes animées)
  const anchor = { cx: box.x + box.w / 2, top: box.y + box.h * 0.2, size: box.h * 0.6, cy: box.y + box.h * 0.55 };
  drawParticles(ctx, box, t, card, { fx: el.fx }, 1, anchor);
  void elKey;
}
// reflets selon la rareté, appliqués sur l'illustration
function artFoil(ctx, card, holo, box, t) {
  const rank = ORDER.indexOf(card.rarity);
  ctx.save();
  if (rank >= ORDER.indexOf("rare")) {
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.22 + rank * 0.03;
    const sx = box.x - box.w + t * 3 * box.w;
    const g = ctx.createLinearGradient(sx, box.y, sx + box.w * 0.5, box.y + box.h * 0.5);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.85)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.globalAlpha = 1;
  }
  if (rank >= ORDER.indexOf("epique")) {
    ctx.globalCompositeOperation = "screen";
    const R = seeded(hashOf(card.id) + 31);
    for (let i = 0; i < (rank >= ORDER.indexOf("legendaire") ? 60 : 32); i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      ctx.globalAlpha = 0.15 + 0.85 * tw;
      sparkle(ctx, box.x + R() * box.w, box.y + R() * box.h, 0.8 + tw * 2.6, rank >= ORDER.indexOf("legendaire") ? "#fde68a" : "#ffffff");
    }
    ctx.globalAlpha = 1;
  }
  if (holo || rank >= ORDER.indexOf("legendaire")) {
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, 600, 840, t, holo ? 0.34 : 0.18);
    ctx.globalAlpha = 1;
    if (holo || card.rarity === "mythique") {
      // fines lignes de diffraction de la feuille holographique
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let k = box.x - box.h; k < box.x + box.w; k += 5) {
        ctx.beginPath();
        ctx.moveTo(k, box.y);
        ctx.lineTo(k + box.h * 0.6, box.y + box.h);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

async function drawCreatureCard(card, holo = false, t = 0.37) {
  const W = 600, H = 840, rank = ORDER.indexOf(card.rarity), m = METAL[card.rarity];
  const elKey = elementOf(card), el = ELEMENTS[elKey] ?? ELEMENTS.lumiere;
  const cp = combatProfile(card, holo), series = seriesOf(card);
  const full = card.rarity === "mythique", gold = card.rarity === "legendaire";
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const trim = metalGradient(ctx, W, H, gold ? METAL.legendaire : m, Math.sin(TAU * t) * 0.25);

  // 1. Bordure : graphite pour toutes, dorée pour les légendaires, prismatique pour les mythiques
  roundRect(ctx, 0, 0, W, H, 28);
  if (gold) ctx.fillStyle = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.25);
  else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, full ? "#2a1846" : "#45454f");
    g.addColorStop(0.5, full ? "#140a24" : "#24242b");
    g.addColorStop(1, full ? "#0b0614" : "#121216");
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (full) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.55);
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, 1, 1, W - 2, H - 2, 27);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = trim;
  roundRect(ctx, 9, 9, W - 18, H - 18, 22);
  ctx.stroke();

  // 2. Panneau intérieur « carton imprimé », teinté par l'élément
  const inner = { x: 16, y: 16, w: W - 32, h: H - 32 };
  ctx.save();
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
  ctx.clip();
  const base = gold ? "#f7ecd0" : "#f4eee2";
  const pg = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  pg.addColorStop(0, mixHex(base.startsWith("#") ? base : "#f4eee2", el.colors[2], 0.4));
  pg.addColorStop(1, mixHex("#f4eee2", el.colors[0], 0.2));
  ctx.fillStyle = pg;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  elementIcon(ctx, elKey, W - 130, H - 200, 95, rgba(el.colors[1], 0.07));
  ctx.restore();

  // 3. Illustration (presque pleine page pour les mythiques, bord à bord pour les légendaires)
  const artH = rank >= ORDER.indexOf("epique") ? 452 : 432;
  const art = full ? { ...inner } : gold ? { x: 16, y: 84, w: W - 32, h: artH } : { x: 30, y: 84, w: W - 60, h: artH };
  const artR = full ? 18 : gold ? 2 : 12;
  ctx.save();
  roundRect(ctx, art.x, art.y, art.w, art.h, artR);
  ctx.clip();
  await drawCreatureArt(ctx, card, art, t, el, elKey);
  artFoil(ctx, card, holo, art, t);
  ctx.restore();
  if (!full) {
    if (rank >= ORDER.indexOf("rare")) {
      ctx.save();
      ctx.shadowColor = m[4];
      ctx.shadowBlur = 10 + rank * 3;
      ctx.lineWidth = 4;
      ctx.strokeStyle = trim;
      roundRect(ctx, art.x, art.y, art.w, art.h, artR);
      ctx.stroke();
      ctx.restore();
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = trim;
    roundRect(ctx, art.x, art.y, art.w, art.h, artR);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    roundRect(ctx, art.x + 3.5, art.y + 3.5, art.w - 7, art.h - 7, Math.max(0, artR - 3));
    ctx.stroke();
  }

  // 4. En-tête : nom, PV, orbe d'élément
  const ink = full ? "#ffffff" : "#1c1714", sub = full ? "rgba(255,255,255,0.78)" : "#5b4b40";
  if (full) {
    const g = ctx.createLinearGradient(0, 16, 0, 140);
    g.addColorStop(0, "rgba(6,3,12,0.75)");
    g.addColorStop(1, "rgba(6,3,12,0)");
    ctx.save();
    roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
    ctx.clip();
    ctx.fillStyle = g;
    ctx.fillRect(16, 16, W - 32, 124);
    ctx.restore();
  }
  ctx.save();
  if (full) {
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 8;
  }
  const nameSize = fitText(ctx, card.name, 330, 36, "CardTitle");
  ctx.font = `${nameSize}px CardTitle`;
  ctx.fillStyle = ink;
  ctx.fillText(card.name, 36, 64);
  ctx.textAlign = "right";
  ctx.font = "34px CardTitle";
  ctx.fillStyle = full ? "#fecaca" : "#b91c1c";
  ctx.fillText(String(cp.hp), 520, 66);
  const hpW = ctx.measureText(String(cp.hp)).width;
  ctx.font = "14px CardBold";
  ctx.fillText("PV", 520 - hpW - 6, 64);
  ctx.restore();
  ctx.textAlign = "left";
  energyOrb(ctx, elKey, 551, 54, 21);

  // 5. Ruban d'informations
  const ry = full ? 520 : art.y + art.h + 10;
  if (full) {
    ctx.save();
    roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
    ctx.clip();
    const gp = ctx.createLinearGradient(0, ry - 40, 0, H);
    gp.addColorStop(0, "rgba(8,5,18,0)");
    gp.addColorStop(0.12, "rgba(8,5,18,0.72)");
    gp.addColorStop(1, "rgba(8,5,18,0.88)");
    ctx.fillStyle = gp;
    ctx.fillRect(16, ry - 40, W - 32, H - ry + 40);
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(70, ry);
  ctx.lineTo(W - 70, ry);
  ctx.lineTo(W - 84, ry + 26);
  ctx.lineTo(84, ry + 26);
  ctx.closePath();
  ctx.fillStyle = full ? "rgba(255,255,255,0.14)" : trim;
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 5;
  ctx.fill();
  ctx.restore();
  const info = `${numberOf(card).replace("#", "N° ")}   ·   ${kindOf(card)}   ·   ${el.label}`;
  ctx.textAlign = "center";
  ctx.font = `${fitText(ctx, info, 410, 14, "CardItalic")}px CardItalic`;
  ctx.fillStyle = full ? "#ffffff" : "#1a1a1a";
  ctx.fillText(info, W / 2, ry + 18);
  ctx.textAlign = "left";

  // 6. Attaques (mêmes valeurs que dans l'Arène)
  const moves = [
    { cost: 0, name: cp.attackName, dmg: cp.attack, text: "Attaque de base · aucune énergie · peut être esquivée" },
    { cost: SPECIAL_COST, name: cp.specialName, dmg: cp.special, text: `Coûte ${SPECIAL_COST} énergies · impossible à esquiver · brise la garde` },
  ];
  const y0 = ry + 48;
  moves.forEach((mv, i) => {
    const y = y0 + i * 62;
    for (let k = 0; k < mv.cost; k++) energyOrb(ctx, elKey, 52 + k * 27, y - 8, 11);
    const nx = mv.cost ? 52 + mv.cost * 27 + 4 : 46;
    ctx.font = `${fitText(ctx, mv.name, W - nx - 120, 25, "CardTitle")}px CardTitle`;
    ctx.fillStyle = ink;
    ctx.fillText(mv.name, nx, y);
    ctx.textAlign = "right";
    ctx.font = "32px CardTitle";
    ctx.fillText(String(mv.dmg), W - 46, y + 2);
    ctx.textAlign = "left";
    ctx.font = "12.5px CardText";
    ctx.fillStyle = sub;
    ctx.fillText(mv.text, 46, y + 21);
    if (i === 0) {
      ctx.strokeStyle = full ? "rgba(255,255,255,0.18)" : rgba(el.colors[1], 0.25);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(44, y + 36);
      ctx.lineTo(W - 44, y + 36);
      ctx.stroke();
    }
  });

  // 7. Faiblesse, résistance, chance
  const by = y0 + 116;
  ctx.strokeStyle = full ? "rgba(255,255,255,0.25)" : rgba(el.colors[1], 0.35);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(40, by - 18);
  ctx.lineTo(W - 40, by - 18);
  ctx.stroke();
  const weak = Object.keys(TYPE_BEATS).find((s) => TYPE_BEATS[s] === series), strong = TYPE_BEATS[series];
  const cols = [
    ["faiblesse", weak, weak ? "×1,25" : "—"],
    ["résistance", strong, strong ? "−15 %" : "—"],
    ["chance", null, String(cp.luck)],
  ];
  cols.forEach(([label, s, value], i) => {
    const x = 60 + i * 176;
    ctx.font = "11px CardText";
    ctx.fillStyle = sub;
    ctx.fillText(label, x, by);
    if (s) seriesIcon(ctx, s, x + 7, by + 15, 7, ink);
    else if (i === 2) combatIcon(ctx, 2, x + 7, by + 15, ink);
    ctx.font = "14px CardBold";
    ctx.fillStyle = ink;
    ctx.fillText(value, x + (s || i === 2 ? 20 : 0), by + 20);
  });

  // 8. Texte d'ambiance
  const fy = by + 32;
  roundRect(ctx, 40, fy, W - 80, H - 62 - fy, 8);
  ctx.fillStyle = full ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.4)";
  ctx.fill();
  ctx.strokeStyle = full ? "rgba(255,255,255,0.2)" : rgba(el.colors[1], 0.3);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = "15px CardItalic";
  ctx.fillStyle = full ? "rgba(255,255,255,0.9)" : "#2b2320";
  wrapText(ctx, card.text, 54, fy + 21, W - 108, 18, 2);

  // 9. Pied de carte : série et numéro, rareté, génération
  const footY = H - 30;
  const footInk = full ? "rgba(255,255,255,0.85)" : gold ? "#3b2005" : "#3b2f28";
  seriesIcon(ctx, series, 44, footY - 4, 6, footInk);
  ctx.font = "12px CardBold";
  ctx.fillStyle = footInk;
  ctx.fillText(numberOf(card).replace("#", ""), 56, footY);
  rarityIcon(ctx, card.rarity, W / 2 - 46, footY - 4, 7, footInk);
  ctx.font = "11px CardEngrave";
  ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), W / 2 - 34, footY);
  if (holo) sparkle(ctx, W / 2 + 64, footY - 4, 4, `hsl(${Math.round(t * 360)},95%,65%)`);
  ctx.textAlign = "right";
  ctx.font = "11px CardText";
  ctx.fillText(`Illus. La Maison · ${GENERATIONS[card.gen ?? 1]?.code ?? "G1"}`, W - 44, footY);
  ctx.textAlign = "left";

  // 10. Finitions : grain du carton imprimé, brillance, usure légère des bords
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.1;
  ctx.drawImage(printTexture(), 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "screen";
  glow(ctx, W * (0.22 + 0.06 * Math.sin(TAU * t)), H * 0.12, 420, "#ffffff", 0.1);
  ctx.globalCompositeOperation = "source-over";
  const R = seeded(hashOf(card.id) + 5);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(R() * 4), p = R();
    const x = side === 0 ? p * W : side === 1 ? W - 2 - R() * 6 : side === 2 ? p * W : 2 + R() * 6;
    const y = side === 0 ? 2 + R() * 6 : side === 1 ? p * H : side === 2 ? H - 2 - R() * 6 : p * H;
    ctx.fillRect(x, y, 1 + R() * 2, 1 + R() * 2);
  }
  ctx.restore();
  return c;
}
