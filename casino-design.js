// Les jeux du Grand Casino de la Maison (dessins et animations), construits avec les ornements de casino-luxe.js.
const { createCanvas } = require("@napi-rs/canvas");
const L = require("./casino-luxe");
const { TAU, GOLD, RUBY, EMERALD, IVORY, INK, ease, seeded, rgba, shade, rr, glow, disc, gold, spaced, fit, goldText, neon, sunburst, lacquer, feltBg, decoFrame, rule, crest, bulbs, plaque, coinShower, sparkle, snap, encodeGif, fluent, yieldLoop, clamp, diamond } = L;

// ============================================================
// Bannière du salon : la façade du Grand Casino
// ============================================================
async function casinoBanner(jackpot, open) {
  const W = 1200, H = 440, c = createCanvas(W, H), ctx = c.getContext("2d");
  // ciel de nuit sur la Riviera
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#07060c");
  sky.addColorStop(0.6, "#1a0d18");
  sky.addColorStop(1, "#2a0f14");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(7);
  for (let i = 0; i < 140; i++) disc(ctx, R() * W, R() * H * 0.55, R() * 1.2 + 0.2, `rgba(255,248,230,${0.25 + R() * 0.6})`);
  // soleil art déco derrière la façade
  sunburst(ctx, W / 2, H * 0.98, 760, 36, GOLD[2], 0.07);
  glow(ctx, W / 2, H * 0.62, 420, "#f59e0b", 0.16);
  // façade : arche à redans
  const fx = 190, fw = W - 380, fy = 46;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(fx, H);
  ctx.lineTo(fx, fy + 70);
  ctx.lineTo(fx + 40, fy + 70);
  ctx.lineTo(fx + 40, fy + 34);
  ctx.lineTo(fx + 90, fy + 34);
  ctx.lineTo(fx + 90, fy);
  ctx.lineTo(fx + fw - 90, fy);
  ctx.lineTo(fx + fw - 90, fy + 34);
  ctx.lineTo(fx + fw - 40, fy + 34);
  ctx.lineTo(fx + fw - 40, fy + 70);
  ctx.lineTo(fx + fw, fy + 70);
  ctx.lineTo(fx + fw, H);
  ctx.closePath();
  const fac = ctx.createLinearGradient(0, fy, 0, H);
  fac.addColorStop(0, "#1b1218");
  fac.addColorStop(1, "#0c080b");
  ctx.fillStyle = fac;
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold(ctx, fx, fy, fx + fw, H);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // colonnes cannelées dorées
  for (const x of [fx - 46, fx + fw + 16]) {
    const g = ctx.createLinearGradient(x, 0, x + 30, 0);
    g.addColorStop(0, GOLD[4]);
    g.addColorStop(0.5, GOLD[1]);
    g.addColorStop(1, GOLD[4]);
    ctx.fillStyle = g;
    ctx.fillRect(x, fy + 70, 30, H - fy - 70);
    for (let k = 5; k < 30; k += 6) {
      ctx.fillStyle = "rgba(60,35,5,0.45)";
      ctx.fillRect(x + k, fy + 78, 2, H - fy - 86);
    }
  }
  // marquise lumineuse
  bulbs(ctx, fx + 90, fy + 8, fw - 180, 0.01, 18, 0);
  // titre
  ctx.textAlign = "center";
  ctx.font = "17px CardEngrave";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "— LA MAISON PRÉSENTE —", W / 2, fy + 66, 6);
  neon(ctx, "GRAND CASINO", W / 2, fy + 148, 80, "#f59e0b", "CardEngrave", 6);
  ctx.font = "22px CardEngrave";
  ctx.fillStyle = IVORY;
  spaced(ctx, "DE LA MAISON", W / 2, fy + 190, 12);
  rule(ctx, W / 2, fy + 212, 230);
  // jackpot en compteur mécanique
  const digits = String(jackpot).replace(/\s/g, " ");
  ctx.font = "15px CardBold";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "JACKPOT PROGRESSIF", W / 2, fy + 244, 5);
  odometer(ctx, digits, W / 2, fy + 288, 58);
  // enseigne ouvert / fermé
  const sx = W / 2, sy = H - 30;
  plaque(ctx, sx, sy, 190, 38);
  ctx.font = "18px CardEngrave";
  neon(ctx, open ? "OUVERT" : "FERMÉ", sx, sy + 7, 18, open ? "#22c55e" : "#ef4444", "CardEngrave", 5);
  // blasons de part et d'autre
  crest(ctx, 80, H / 2 + 20, 40);
  crest(ctx, W - 80, H / 2 + 20, 40);
  decoFrame(ctx, W, H, 8);
  return c.encode("jpeg", 92);
}
// compteur à rouleaux : chaque chiffre dans sa case
function odometer(ctx, text, cx, cy, h) {
  const chars = [...text];
  const cw = h * 0.62, sw = h * 0.3;
  const widths = chars.map((ch) => (/\d/.test(ch) ? cw : ch === " " ? sw * 0.5 : sw));
  const total = widths.reduce((a, w) => a + w + 4, -4);
  let x = cx - total / 2;
  plaque(ctx, cx, cy, total + 40, h + 22);
  for (const [i, ch] of chars.entries()) {
    const w = widths[i];
    if (/\d/.test(ch)) {
      const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
      g.addColorStop(0, "#0a0a0a");
      g.addColorStop(0.5, "#2a2420");
      g.addColorStop(1, "#0a0a0a");
      rr(ctx, x, cy - h / 2, w, h, 6);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(GOLD[2], 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.textAlign = "center";
      goldText(ctx, ch, x + w / 2, cy + h * 0.3, Math.round(h * 0.78), "CardTitle");
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(x + 2, cy - h / 2 + 2, w - 4, h * 0.42);
    } else if (ch !== " ") {
      ctx.textAlign = "center";
      goldText(ctx, ch, x + w / 2, cy + h * 0.3, Math.round(h * 0.6), "CardTitle");
    }
    x += w + 4;
  }
}

// ============================================================
// Machine à sous : « La Riviera »
// ============================================================
const SLOT_ART = { "🍒": "Cherries", "🍋": "Lemon", "🍇": "Grapes", "🔔": "Bell", "💎": "Gem stone" };
const SLOT_POOL = ["🍒", "🍋", "🍇", "🔔", "💎", "7️⃣"];
const symbolCache = new Map();
// un symbole prêt à poser (cache), net ou flou de mouvement
async function slotSymbol(emoji, s, blur = false) {
  const key = `${emoji}:${s}:${blur}`;
  if (symbolCache.has(key)) return symbolCache.get(key);
  const c = createCanvas(s, s + (blur ? s * 0.6 : 0)), ctx = c.getContext("2d");
  const base = createCanvas(s, s), b = base.getContext("2d");
  if (emoji === "7️⃣") {
    b.textAlign = "center";
    b.font = `${Math.round(s * 0.95)}px CardTitle`;
    b.lineJoin = "round";
    b.lineWidth = s * 0.09;
    b.strokeStyle = GOLD[4];
    b.strokeText("7", s / 2, s * 0.84);
    b.lineWidth = s * 0.05;
    b.strokeStyle = gold(b, 0, 0, s, s);
    b.strokeText("7", s / 2, s * 0.84);
    const g = b.createLinearGradient(0, s * 0.1, 0, s * 0.9);
    g.addColorStop(0, "#ff5a6e");
    g.addColorStop(0.5, "#d10f2f");
    g.addColorStop(1, "#7a0618");
    b.fillStyle = g;
    b.fillText("7", s / 2, s * 0.84);
    b.fillStyle = "rgba(255,255,255,0.35)";
    b.fillRect(s * 0.3, s * 0.18, s * 0.42, s * 0.06);
  } else {
    const img = await fluent(SLOT_ART[emoji]);
    if (img) b.drawImage(img, s * 0.08, s * 0.08, s * 0.84, s * 0.84);
    else {
      b.textAlign = "center";
      b.font = `${Math.round(s * 0.7)}px CardBold`;
      b.fillText(emoji, s / 2, s * 0.75);
    }
  }
  if (blur) {
    for (let k = 0; k < 7; k++) {
      ctx.globalAlpha = 0.22;
      ctx.drawImage(base, 0, k * s * 0.085);
    }
    ctx.globalAlpha = 1;
  } else ctx.drawImage(base, 0, 0);
  symbolCache.set(key, c);
  return c;
}
function slotCabinet(W, H, label) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  lacquer(ctx, W, H, "#1c0b12");
  // corps de la machine : laque rubis et chromes dorés
  const mx = 70, my = 26, mw = W - 140, mh = H - 52;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 30;
  rr(ctx, mx, my, mw, mh, 26);
  const body = ctx.createLinearGradient(mx, 0, mx + mw, 0);
  body.addColorStop(0, "#3a0611");
  body.addColorStop(0.5, "#7a0f24");
  body.addColorStop(1, "#3a0611");
  ctx.fillStyle = body;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold(ctx, mx, my, mx + mw, my + mh);
  ctx.lineWidth = 5;
  rr(ctx, mx, my, mw, mh, 26);
  ctx.stroke();
  // fronton : soleil et nom de la machine
  ctx.save();
  rr(ctx, mx + 24, my + 16, mw - 48, 78, 16);
  ctx.clip();
  ctx.fillStyle = "#12070b";
  ctx.fillRect(mx, my, mw, 120);
  sunburst(ctx, W / 2, my + 120, 420, 28, GOLD[2], 0.18);
  ctx.restore();
  ctx.strokeStyle = gold(ctx, mx, my, mx + mw, my + 100);
  ctx.lineWidth = 2;
  rr(ctx, mx + 24, my + 16, mw - 48, 78, 16);
  ctx.stroke();
  ctx.textAlign = "center";
  goldText(ctx, "LA RIVIERA", W / 2, my + 70, 40, "CardEngrave", 8);
  crest(ctx, mx + 70, my + 55, 22);
  crest(ctx, mx + mw - 70, my + 55, 22);
  // plateau du bas : cartouche du gain
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  rr(ctx, mx + 24, my + mh - 92, mw - 48, 70, 14);
  ctx.fill();
  ctx.strokeStyle = rgba(GOLD[2], 0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  return c;
}
async function slotsGif(result, info = {}) {
  const W = 900, H = 540;
  const RX = 168, RY = 140, RW = 176, RH = 270, GAP = 22, S = 112;
  const cab = slotCabinet(W, H);
  for (const e of SLOT_POOL) {
    await slotSymbol(e, S);
    await slotSymbol(e, S, true);
  }
  const R = seeded(Date.now());
  // chaque rouleau défile de DIST[i] cases : le symbole tiré arrive pile sur la ligne de paiement
  const DIST = [24, 30, 36];
  const strips = [0, 1, 2].map((i) => {
    const s = Array.from({ length: 48 }, () => SLOT_POOL[Math.floor(R() * SLOT_POOL.length)]);
    s[DIST[i] + 1] = result[i];
    return s;
  });
  const stopAt = [20, 28, 36], total = 64, shots = [];
  const win = info.gain > 0, jackpot = Boolean(info.jackpot);
  const cellH = RH / 3;
  for (let f = 0; f < total; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(cab, 0, 0);
    bulbs(ctx, 82, 37, W - 164, H - 74, 26, f);
    for (let i = 0; i < 3; i++) {
      const x = RX + i * (RW + GAP);
      // tambour : fenêtre bombée
      ctx.save();
      rr(ctx, x, RY, RW, RH, 16);
      const drum = ctx.createLinearGradient(0, RY, 0, RY + RH);
      drum.addColorStop(0, "#9c9488");
      drum.addColorStop(0.2, "#efe7d6");
      drum.addColorStop(0.5, "#fffaf0");
      drum.addColorStop(0.8, "#efe7d6");
      drum.addColorStop(1, "#9c9488");
      ctx.fillStyle = drum;
      ctx.fill();
      ctx.clip();
      const stopped = f >= stopAt[i];
      const spinT = clamp(f / stopAt[i]);
      // position du rouleau : accélère puis décélère, petit rebond à l'arrêt
      let off;
      if (!stopped) off = ease.inOut(spinT) * DIST[i];
      const bounce = stopped ? Math.max(0, 1 - (f - stopAt[i]) / 4) * Math.sin(((f - stopAt[i]) / 4) * Math.PI) * 14 : 0;
      for (let row = -1; row <= 3; row++) {
        let sym, blurred = false, y;
        if (stopped) {
          sym = strips[i][DIST[i] + row];
          y = RY + row * cellH + bounce;
        } else {
          const pos = off * 1 + row, k = Math.floor(pos);
          sym = strips[i][((k % strips[i].length) + strips[i].length) % strips[i].length];
          y = RY + (row - (pos - k)) * cellH;
          blurred = spinT > 0.08 && spinT < 0.92;
        }
        const img = await slotSymbol(sym, S, blurred);
        const pulse = stopped && win && row === 1 && f > stopAt[2] ? 1 + 0.08 * Math.sin((f - stopAt[2]) * 0.9) : 1;
        const s = S * pulse;
        ctx.drawImage(img, x + RW / 2 - s / 2, y + cellH / 2 - s / 2, s, blurred ? s * 1.6 : s);
      }
      // ombrage du tambour (effet cylindre) et reflet de vitre
      const shadeG = ctx.createLinearGradient(0, RY, 0, RY + RH);
      shadeG.addColorStop(0, "rgba(0,0,0,0.45)");
      shadeG.addColorStop(0.22, "rgba(0,0,0,0)");
      shadeG.addColorStop(0.78, "rgba(0,0,0,0)");
      shadeG.addColorStop(1, "rgba(0,0,0,0.5)");
      ctx.fillStyle = shadeG;
      ctx.fillRect(x, RY, RW, RH);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.moveTo(x, RY);
      ctx.lineTo(x + RW * 0.55, RY);
      ctx.lineTo(x + RW * 0.25, RY + RH);
      ctx.lineTo(x, RY + RH);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = gold(ctx, x, RY, x + RW, RY + RH);
      ctx.lineWidth = 4;
      rr(ctx, x, RY, RW, RH, 16);
      ctx.stroke();
    }
    // ligne de paiement
    const lineY = RY + cellH * 1.5, allStopped = f > stopAt[2];
    const lit = allStopped && win;
    ctx.save();
    if (lit) {
      ctx.shadowColor = jackpot ? "#fde047" : "#f472b6";
      ctx.shadowBlur = 18;
    }
    ctx.strokeStyle = lit ? (jackpot ? "#fde047" : "#f472b6") : "rgba(244,114,182,0.55)";
    ctx.lineWidth = lit ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(RX - 26, lineY);
    ctx.lineTo(RX + 3 * RW + 2 * GAP + 26, lineY);
    ctx.stroke();
    ctx.restore();
    for (const side of [-1, 1]) {
      const ax = side < 0 ? RX - 30 : RX + 3 * RW + 2 * GAP + 30;
      ctx.beginPath();
      ctx.moveTo(ax, lineY);
      ctx.lineTo(ax - side * 16, lineY - 11);
      ctx.lineTo(ax - side * 16, lineY + 11);
      ctx.closePath();
      ctx.fillStyle = gold(ctx, ax - 16, lineY - 11, ax + 16, lineY + 11);
      ctx.fill();
    }
    // cartouche du bas
    const by = H - 26 - 57;
    ctx.textAlign = "center";
    if (allStopped) {
      const t = (f - stopAt[2]) / (total - stopAt[2]);
      if (jackpot) {
        ctx.save();
        ctx.globalAlpha = clamp(t * 3);
        sunburst(ctx, W / 2, RY + RH / 2, 600, 30, "#fde047", 0.12, 0, TAU);
        ctx.restore();
        coinShower(ctx, W, H, t, 99);
      } else if (win) coinShower(ctx, W, H, t, 42, 18);
      const label = info.label || (win ? "GAGNÉ !" : "PAS DE CHANCE");
      if (win) neon(ctx, label, W / 2, by + 14, label.length > 14 ? 30 : 36, jackpot ? "#fbbf24" : "#f472b6", "CardEngrave", 4);
      else {
        ctx.font = "26px CardEngrave";
        ctx.fillStyle = "rgba(246,238,219,0.75)";
        spaced(ctx, label, W / 2, by + 10, 4);
      }
      if (win && Number.isFinite(info.gain)) {
        ctx.font = "21px CardBold";
        ctx.fillStyle = GOLD[0];
        ctx.fillText(`+ ${Math.round(info.gain).toLocaleString("fr-FR")} €`, W / 2, by + 42);
      }
    } else {
      ctx.font = "22px CardEngrave";
      ctx.fillStyle = "rgba(246,238,219,0.6)";
      spaced(ctx, "BONNE CHANCE", W / 2, by + 16, 8);
    }
    shots.push(snap(c, f === total - 1 ? 2600 : f >= stopAt[2] ? 70 : 45, 0.8));
  }
  return encodeGif(shots);
}
// plusieurs tours d'un coup : le ticket de la machine
async function slotsGrid(rows) {
  const W = 900, rowH = 96, H = 170 + rows.length * (rowH + 10) + 70;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  lacquer(ctx, W, H, "#1c0b12");
  ctx.textAlign = "center";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "GRAND CASINO DE LA MAISON", W / 2, 62, 6);
  goldText(ctx, "LA RIVIERA", W / 2, 112, 44, "CardEngrave", 8);
  rule(ctx, W / 2, 134, 220);
  let total = 0;
  for (const [i, row] of rows.entries()) {
    const y = 160 + i * (rowH + 10), win = row.gain > 0;
    total += row.gain || 0;
    rr(ctx, 70, y, W - 140, rowH, 14);
    ctx.fillStyle = win ? "rgba(253,224,71,0.10)" : "rgba(0,0,0,0.38)";
    ctx.fill();
    ctx.strokeStyle = win ? rgba(GOLD[1], 0.8) : rgba(GOLD[2], 0.3);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "rgba(246,238,219,0.55)";
    ctx.fillText(`TOUR ${i + 1}`, 96, y + rowH / 2 + 5);
    for (const [k, sym] of row.reels.entries()) {
      const bx = 220 + k * 112;
      rr(ctx, bx, y + 10, 96, rowH - 20, 10);
      ctx.fillStyle = IVORY;
      ctx.fill();
      ctx.drawImage(await slotSymbol(sym, 70), bx + 13, y + 13, 70, 70);
    }
    ctx.textAlign = "right";
    if (win) {
      ctx.font = "30px CardTitle";
      ctx.fillStyle = row.jackpot ? "#fde047" : GOLD[1];
      ctx.fillText(`+ ${Math.round(row.gain).toLocaleString("fr-FR")} €`, W - 96, y + rowH / 2 + 11);
    } else {
      ctx.font = "18px CardText";
      ctx.fillStyle = "rgba(246,238,219,0.4)";
      ctx.fillText("—", W - 96, y + rowH / 2 + 7);
    }
  }
  ctx.textAlign = "center";
  const ty = H - 52;
  ctx.font = "15px CardBold";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "TOTAL DES GAINS", W / 2 - 120, ty, 3);
  goldText(ctx, `${Math.round(total).toLocaleString("fr-FR")} €`, W / 2 + 120, ty + 6, 34, "CardTitle");
  decoFrame(ctx, W, H, 8);
  return c.encode("png");
}


// ============================================================
// Roulette : la roue en acajou, vue en perspective
// ============================================================
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const numColor = (n) => (n === 0 ? "#0f7a4a" : RED.has(n) ? "#b3122e" : "#121014");
// la roue vue de dessus (dessinée sur une toile carrée, puis écrasée pour la perspective)
function rouletteTop(size, angle, ball) {
  const c = createCanvas(size, size), ctx = c.getContext("2d"), cx = size / 2, cy = size / 2, R = size / 2 - 4;
  // cuvette en acajou
  const wood = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.2, cx, cy, R);
  wood.addColorStop(0, "#7a3b17");
  wood.addColorStop(0.7, "#4a1d09");
  wood.addColorStop(1, "#200b03");
  disc(ctx, cx, cy, R, wood);
  ctx.strokeStyle = gold(ctx, 0, 0, size, size);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 3, 0, TAU);
  ctx.stroke();
  // piste de la bille
  disc(ctx, cx, cy, R * 0.88, "#2b1206");
  ctx.strokeStyle = "rgba(255,230,180,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.86, 0, TAU);
  ctx.stroke();
  // déflecteurs dorés
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * R * 0.8, cy + Math.sin(a) * R * 0.8);
    ctx.rotate(a);
    diamond(ctx, 0, 0, 7, gold(ctx, -7, -7, 7, 7));
    ctx.restore();
  }
  // couronne de numéros (tourne avec la roue)
  const seg = TAU / 37, rOut = R * 0.74, rIn = R * 0.54;
  for (let i = 0; i < 37; i++) {
    const n = WHEEL_ORDER[i], a0 = angle + i * seg - Math.PI / 2, a1 = a0 + seg;
    ctx.beginPath();
    ctx.arc(cx, cy, rOut, a0, a1);
    ctx.arc(cx, cy, rIn, a1, a0, true);
    ctx.closePath();
    ctx.fillStyle = numColor(n);
    ctx.fill();
    ctx.strokeStyle = rgba(GOLD[1], 0.9);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx + Math.cos(a0 + seg / 2) * (rOut - R * 0.07), cy + Math.sin(a0 + seg / 2) * (rOut - R * 0.07));
    ctx.rotate(a0 + seg / 2 + Math.PI / 2);
    ctx.fillStyle = "#fffaf0";
    ctx.font = `${Math.round(R * 0.075)}px CardBold`;
    ctx.textAlign = "center";
    ctx.fillText(String(n), 0, R * 0.026);
    ctx.restore();
  }
  ctx.strokeStyle = gold(ctx, 0, 0, size, size);
  ctx.lineWidth = 3;
  for (const r of [rOut, rIn]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }
  // cône central et tourelle dorée
  const cone = ctx.createRadialGradient(cx - R * 0.15, cy - R * 0.15, 4, cx, cy, rIn);
  cone.addColorStop(0, "#8a4a22");
  cone.addColorStop(1, "#2e1206");
  disc(ctx, cx, cy, rIn - 2, cone);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.strokeStyle = gold(ctx, -R * 0.4, -R * 0.4, R * 0.4, R * 0.4);
  ctx.lineCap = "round";
  ctx.lineWidth = R * 0.035;
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(R * 0.36, 0);
    ctx.stroke();
    disc(ctx, R * 0.36, 0, R * 0.03, GOLD[1]);
  }
  ctx.restore();
  disc(ctx, cx, cy, R * 0.07, gold(ctx, cx - 10, cy - 10, cx + 10, cy + 10));
  // la bille
  if (ball) {
    const bx = cx + Math.cos(ball.a) * R * ball.r, by = cy + Math.sin(ball.a) * R * ball.r;
    disc(ctx, bx + 2, by + 3, R * 0.03, "rgba(0,0,0,0.45)");
    const bg = ctx.createRadialGradient(bx - 2, by - 2, 1, bx, by, R * 0.032);
    bg.addColorStop(0, "#ffffff");
    bg.addColorStop(1, "#b9b2a6");
    disc(ctx, bx, by, R * 0.032, bg);
  }
  return c;
}
async function rouletteGif(result, label = "", win = null) {
  const W = 960, H = 540, frames = 62, shots = [];
  const base = createCanvas(W, H), b = base.getContext("2d");
  feltBg(b, W, H, "#0b3d2c");
  // tapis : rappel du tableau des mises
  b.save();
  b.globalAlpha = 0.16;
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 3; j++) {
      b.strokeStyle = "#f6eedb";
      b.strokeRect(36 + i * 38, H - 150 + j * 38, 38, 38);
    }
  }
  b.restore();
  // la roue est posée sur une table : ombre portée
  b.save();
  b.translate(310, 300);
  b.scale(1, 0.62);
  glow(b, 0, 20, 300, "#000000", 0.6);
  b.restore();
  // panneau de droite
  const px = 600, pw = 320;
  b.save();
  b.shadowColor = "rgba(0,0,0,0.6)";
  b.shadowBlur = 24;
  rr(b, px, 40, pw, H - 80, 18);
  b.fillStyle = "rgba(8,6,10,0.86)";
  b.fill();
  b.restore();
  b.strokeStyle = gold(b, px, 40, px + pw, H - 40);
  b.lineWidth = 2;
  rr(b, px, 40, pw, H - 80, 18);
  b.stroke();
  b.textAlign = "center";
  b.font = "13px CardEngrave";
  b.fillStyle = GOLD[1];
  spaced(b, "GRAND CASINO DE LA MAISON", px + pw / 2, 82, 3);
  goldText(b, "ROULETTE", px + pw / 2, 128, 40, "CardEngrave", 5);
  rule(b, px + pw / 2, 148, 110);
  decoFrame(b, W, H, 8);

  const idx = WHEEL_ORDER.indexOf(result), seg = TAU / 37;
  const spinFrames = 46, wheelTurns = 1.6 * TAU, ballTurns = 3.2 * TAU;
  const wheelEnd = 0.7 + wheelTurns;
  // à la fin, la bille est dans la case du numéro tiré
  const pocketWorld = wheelEnd + idx * seg + seg / 2 - Math.PI / 2;
  const ballStart = pocketWorld + ballTurns;
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0);
    const t = clamp(f / spinFrames), e = ease.outQuint(t);
    const wa = 0.7 + wheelTurns * e;
    const ba = ballStart - ballTurns * ease.out(t);
    // la bille tourne sur la piste, puis tombe vers les cases en rebondissant
    const drop = clamp((t - 0.62) / 0.38);
    const r = 0.86 - 0.22 * ease.out(drop) + (drop > 0 && drop < 1 ? Math.abs(Math.sin(drop * Math.PI * 3)) * 0.04 * (1 - drop) : 0);
    const top = rouletteTop(520, wa, { a: ba, r });
    ctx.save();
    ctx.translate(310, 290);
    ctx.scale(1, 0.62);
    ctx.drawImage(top, -260, -260);
    ctx.restore();
    // bord avant de la cuvette (épaisseur)
    ctx.save();
    ctx.translate(310, 290);
    ctx.scale(1, 0.62);
    ctx.strokeStyle = "rgba(20,8,2,0.9)";
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(0, 10, 258, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = gold(ctx, -260, 0, 260, 0);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 258, 0.02 * Math.PI, 0.98 * Math.PI);
    ctx.stroke();
    ctx.restore();
    // panneau : suspense puis numéro
    ctx.textAlign = "center";
    const pcx = px + pw / 2;
    if (f < spinFrames) {
      ctx.font = "26px CardItalic";
      ctx.fillStyle = rgba(IVORY, 0.55 + 0.3 * Math.sin(f * 0.5));
      ctx.fillText("Rien ne va plus…", pcx, 290);
    } else {
      const k = clamp((f - spinFrames) / 6);
      const s = 0.6 + 0.4 * ease.back(k);
      ctx.save();
      ctx.translate(pcx, 262);
      ctx.scale(s, s);
      glow(ctx, 0, 0, 120, numColor(result) === "#121014" ? "#f59e0b" : numColor(result), 0.35);
      disc(ctx, 0, 0, 72, gold(ctx, -72, -72, 72, 72));
      disc(ctx, 0, 0, 62, numColor(result));
      ctx.textAlign = "center";
      ctx.font = "64px CardTitle";
      ctx.fillStyle = "#fffaf0";
      ctx.fillText(String(result), 0, 22);
      ctx.restore();
      const desc = result === 0 ? "ZÉRO" : `${RED.has(result) ? "ROUGE" : "NOIR"} · ${result % 2 ? "IMPAIR" : "PAIR"} · ${result <= 18 ? "MANQUE" : "PASSE"}`;
      ctx.font = "15px CardEngrave";
      ctx.fillStyle = IVORY;
      spaced(ctx, desc, pcx, 372, 3);
      if (label) {
        if (win) neon(ctx, label, pcx, 430, label.length > 12 ? 26 : 32, "#22c55e", "CardEngrave", 3);
        else {
          ctx.font = "24px CardEngrave";
          ctx.fillStyle = win === false ? "#fca5a5" : GOLD[1];
          spaced(ctx, label, pcx, 428, 3);
        }
      }
      if (win) for (let k2 = 0; k2 < 6; k2++) sparkle(ctx, pcx + Math.cos(f * 0.4 + k2) * 120, 262 + Math.sin(f * 0.5 + k2 * 2) * 90, 9, "#fde68a", 0.8);
    }
    shots.push(snap(c, f === frames - 1 ? 3000 : f >= spinFrames ? 80 : 45, 0.78));
  }
  return encodeGif(shots);
}

// ============================================================
// Blackjack : table de feutre émeraude, cartes « Maison »
// ============================================================
function suitPath(ctx, suit, x, y, s) {
  ctx.beginPath();
  if (suit === "♥") {
    ctx.moveTo(x, y + s * 0.45);
    ctx.bezierCurveTo(x - s * 0.9, y - s * 0.1, x - s * 0.45, y - s * 0.75, x, y - s * 0.3);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 0.75, x + s * 0.9, y - s * 0.1, x, y + s * 0.45);
  } else if (suit === "♦") {
    ctx.moveTo(x, y - s * 0.55);
    ctx.lineTo(x + s * 0.4, y);
    ctx.lineTo(x, y + s * 0.55);
    ctx.lineTo(x - s * 0.4, y);
  } else if (suit === "♠") {
    ctx.moveTo(x, y - s * 0.55);
    ctx.bezierCurveTo(x + s * 0.9, y + s * 0.05, x + s * 0.45, y + s * 0.6, x, y + s * 0.18);
    ctx.bezierCurveTo(x - s * 0.45, y + s * 0.6, x - s * 0.9, y + s * 0.05, x, y - s * 0.55);
    ctx.moveTo(x, y + s * 0.1);
    ctx.lineTo(x + s * 0.2, y + s * 0.55);
    ctx.lineTo(x - s * 0.2, y + s * 0.55);
  } else {
    for (const [dx, dy] of [[0, -0.28], [-0.27, 0.06], [0.27, 0.06]]) {
      ctx.moveTo(x + dx * s + s * 0.24, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, s * 0.24, 0, TAU);
    }
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.18, y + s * 0.55);
    ctx.lineTo(x - s * 0.18, y + s * 0.55);
  }
  ctx.closePath();
}
const suitInk = (suit) => (suit === "♥" || suit === "♦" ? "#b3122e" : "#14110f");
function playingCard(ctx, card, x, y, w, h, hidden = false, rot = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 6;
  rr(ctx, 0, 0, w, h, 10);
  ctx.fillStyle = hidden ? "#5c0a1c" : "#fbf7ee";
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.translate(-w / 2, -h / 2);
  if (hidden) {
    // dos : velours rubis, treillis doré, blason
    ctx.save();
    rr(ctx, 6, 6, w - 12, h - 12, 7);
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#7a0f24");
    g.addColorStop(1, "#3a0611");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = rgba(GOLD[1], 0.35);
    ctx.lineWidth = 1;
    for (let k = -h; k < w + h; k += 12) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k + h, h);
      ctx.moveTo(k + h, 0);
      ctx.lineTo(k, h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = gold(ctx, 0, 0, w, h);
    ctx.lineWidth = 2;
    rr(ctx, 6, 6, w - 12, h - 12, 7);
    ctx.stroke();
    crest(ctx, w / 2, h / 2, w * 0.24);
  } else {
    const ink = suitInk(card.suit);
    ctx.strokeStyle = rgba(GOLD[2], 0.7);
    ctx.lineWidth = 1.2;
    rr(ctx, 5, 5, w - 10, h - 10, 7);
    ctx.stroke();
    // coins
    for (const flip of [false, true]) {
      ctx.save();
      if (flip) {
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
      }
      ctx.fillStyle = ink;
      ctx.textAlign = "center";
      ctx.font = `${Math.round(w * 0.2)}px CardTitle`;
      ctx.fillText(card.rank, w * 0.15, h * 0.16);
      suitPath(ctx, card.suit, w * 0.15, h * 0.25, w * 0.11);
      ctx.fill();
      ctx.restore();
    }
    // centre
    if (["J", "Q", "K"].includes(card.rank)) {
      // figure : arche art déco dorée et grande lettre
      const fx = w * 0.24, fy = h * 0.2, fw = w * 0.52, fh = h * 0.6;
      ctx.save();
      rr(ctx, fx, fy, fw, fh, fw * 0.5);
      const g = ctx.createLinearGradient(0, fy, 0, fy + fh);
      g.addColorStop(0, ink === "#b3122e" ? "#fde2e4" : "#ece7dc");
      g.addColorStop(1, "#fbf7ee");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.clip();
      sunburst(ctx, w / 2, fy + fh, fh, 14, GOLD[2], 0.22);
      ctx.restore();
      ctx.strokeStyle = gold(ctx, fx, fy, fx + fw, fy + fh);
      ctx.lineWidth = 2;
      rr(ctx, fx, fy, fw, fh, fw * 0.5);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.font = `${Math.round(w * 0.42)}px CardTitle`;
      ctx.fillStyle = ink;
      ctx.fillText(card.rank, w / 2, h * 0.62);
      suitPath(ctx, card.suit, w / 2, h * 0.7, w * 0.1);
      ctx.fill();
    } else if (card.rank === "A") {
      ctx.strokeStyle = gold(ctx, 0, 0, w, h);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w * 0.3, 0, TAU);
      ctx.stroke();
      suitPath(ctx, card.suit, w / 2, h / 2, w * 0.36);
      ctx.fillStyle = ink;
      ctx.fill();
    } else {
      suitPath(ctx, card.suit, w / 2, h / 2, w * 0.34);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.font = `${Math.round(w * 0.16)}px CardEngrave`;
      ctx.textAlign = "center";
      ctx.fillStyle = rgba(ink === "#b3122e" ? "#b3122e" : "#14110f", 0.35);
      ctx.fillText(card.rank, w / 2, h * 0.84);
    }
  }
  ctx.restore();
}
function chipStack(ctx, x, y, amount) {
  const colors = [["#b3122e", "#fff"], ["#14110f", "#f3d98b"], ["#0f5f3f", "#fff"], ["#1d3a8a", "#fff"], ["#6b21a8", "#fde68a"]];
  const n = clamp(Math.ceil(Math.log10(Math.max(10, amount)) * 2), 2, 9);
  for (let k = 0; k < n; k++) {
    const [fill, edge] = colors[k % colors.length], cy = y - k * 6;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(1, 0.45);
    disc(ctx, 0, 6, 30, "rgba(0,0,0,0.45)");
    disc(ctx, 0, 0, 30, fill);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 5;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    disc(ctx, 0, 0, 16, shade(fill, 0.15));
    ctx.restore();
  }
}
function curvedText(ctx, text, cx, cy, r, mid, spacing = 0.034) {
  const chars = [...text], a0 = mid + ((chars.length - 1) * spacing) / 2;
  chars.forEach((ch, i) => {
    const a = a0 - i * spacing;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}
function valueBadge(ctx, x, y, text, color) {
  ctx.font = "22px CardBold";
  const w = Math.max(54, ctx.measureText(text).width + 30);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 10;
  rr(ctx, x - w / 2, y - 19, w, 38, 19);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold(ctx, x - w / 2, y - 19, x + w / 2, y + 19);
  ctx.lineWidth = 2;
  rr(ctx, x - w / 2, y - 19, w, 38, 19);
  ctx.stroke();
  ctx.fillStyle = "#fffaf0";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 8);
}
function blackjackImage(state) {
  const W = 960, H = 580, c = createCanvas(W, H), ctx = c.getContext("2d");
  feltBg(ctx, W, H, "#0d4a35");
  // boudin en cuir et liseré doré (côté joueur)
  const cx = W / 2, cy = -340, R = 900;
  ctx.lineWidth = 46;
  ctx.strokeStyle = "#2a1006";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gold(ctx, 0, 0, W, H);
  ctx.beginPath();
  ctx.arc(cx, cy, R - 25, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  // inscriptions imprimées sur le feutre
  ctx.fillStyle = rgba(GOLD[1], 0.75);
  ctx.textAlign = "center";
  // entre la main du croupier et la vôtre (caché par le bandeau du résultat)
  ctx.font = "17px CardEngrave";
  curvedText(ctx, "LE BLACKJACK PAIE 3 POUR 2", cx, cy, 636, Math.PI / 2, 0.0215);
  ctx.font = "12px CardBold";
  ctx.fillStyle = rgba(IVORY, 0.45);
  curvedText(ctx, "LA BANQUE TIRE À 16 ET RESTE À 17", cx, cy, 658, Math.PI / 2, 0.0118);
  // sabot et rack de jetons du croupier
  ctx.save();
  ctx.translate(W - 120, 70);
  ctx.rotate(0.12);
  rr(ctx, -50, -28, 100, 72, 10);
  ctx.fillStyle = "#14110f";
  ctx.fill();
  ctx.strokeStyle = gold(ctx, -50, -28, 50, 44);
  ctx.lineWidth = 2;
  ctx.stroke();
  playingCard(ctx, null, -36, -60, 64, 90, true, 0);
  ctx.restore();
  for (let k = 0; k < 5; k++) {
    const colors = ["#b3122e", "#14110f", "#0f5f3f", "#1d3a8a", "#6b21a8"];
    rr(ctx, 50 + k * 28, 36, 24, 64, 6);
    ctx.fillStyle = colors[k];
    ctx.fill();
    ctx.strokeStyle = rgba(GOLD[1], 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  crest(ctx, W / 2, 36, 18);
  // mains
  const cw = 112, ch = 158;
  const lay = (hand, y, hideSecond) => {
    const total = cw + (hand.length - 1) * 64, x0 = W / 2 - total / 2;
    hand.forEach((card, i) => playingCard(ctx, card, x0 + i * 64, y, cw, ch, hideSecond && i === 1, (i - (hand.length - 1) / 2) * 0.04));
    return x0 + total;
  };
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = rgba(GOLD[1], 0.85);
  ctx.textAlign = "center";
  spaced(ctx, "CROUPIER", W / 2, 84, 5);
  const dEnd = lay(state.dealer, 100, state.hideDealer);
  valueBadge(ctx, dEnd + 56, 100 + ch / 2, state.hideDealer ? "?" : String(state.dealerValue), "#14110f");
  const pEnd = lay(state.player, 340, false);
  valueBadge(ctx, pEnd + 56, 340 + ch / 2, String(state.playerValue), state.playerValue > 21 ? "#991b1b" : state.playerValue === 21 ? "#a16207" : "#0f3d2c");
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = rgba(GOLD[1], 0.85);
  spaced(ctx, "VOUS", W / 2, 528, 5);
  // mise
  ctx.strokeStyle = rgba(GOLD[1], 0.55);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(130, 450, 54, 0, TAU);
  ctx.stroke();
  chipStack(ctx, 130, 462, state.bet ?? 10);
  ctx.font = "18px CardBold";
  ctx.fillStyle = "#fffaf0";
  ctx.fillText(state.betText ?? "", 130, 532);
  // résultat : bandeau qui traverse la table, entre les deux mains
  if (state.result) {
    const col = state.result.win ? "#16a34a" : state.result.push ? "#a16207" : "#991b1b";
    ctx.save();
    ctx.fillStyle = "rgba(5,4,6,0.78)";
    ctx.fillRect(0, 268, W, 66);
    ctx.restore();
    ctx.strokeStyle = gold(ctx, 0, 268, W, 334);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 268);
    ctx.lineTo(W, 268);
    ctx.moveTo(0, 334);
    ctx.lineTo(W, 334);
    ctx.stroke();
    const title = state.result.title;
    neon(ctx, title, W / 2, 314, title.length > 18 ? 34 : 42, col === "#a16207" ? "#f59e0b" : state.result.win ? "#22c55e" : "#ef4444", "CardEngrave", 3);
  }
  decoFrame(ctx, W, H, 8);
  return c.encode("png");
}

// ============================================================
// Roue de la fortune : la grande roue du music-hall
// ============================================================
async function fortuneWheelGif(segments, index, title = "ROUE DE LA FORTUNE") {
  const W = 960, H = 560, frames = 60, spin = 44, shots = [];
  const n = segments.length, seg = TAU / n, cx = 330, cy = 290, R = 228;
  const base = createCanvas(W, H), b = base.getContext("2d");
  lacquer(b, W, H, "#170b1f", "#c084fc");
  sunburst(b, cx, cy, 520, 40, GOLD[2], 0.06, 0, TAU);
  const px = 620, pw = 300;
  b.save();
  b.shadowColor = "rgba(0,0,0,0.6)";
  b.shadowBlur = 24;
  rr(b, px, 50, pw, H - 100, 18);
  b.fillStyle = "rgba(8,6,10,0.85)";
  b.fill();
  b.restore();
  b.strokeStyle = gold(b, px, 50, px + pw, H - 50);
  b.lineWidth = 2;
  rr(b, px, 50, pw, H - 100, 18);
  b.stroke();
  b.textAlign = "center";
  b.font = "13px CardEngrave";
  b.fillStyle = GOLD[1];
  spaced(b, "GRAND CASINO DE LA MAISON", px + pw / 2, 92, 3);
  const words = title.split(" ");
  const l1 = words.slice(0, 2).join(" "), l2 = words.slice(2).join(" ");
  goldText(b, l1, px + pw / 2, 140, 34, "CardEngrave", 3);
  if (l2) goldText(b, l2, px + pw / 2, 180, 34, "CardEngrave", 3);
  rule(b, px + pw / 2, 202, 100);
  b.font = "15px CardItalic";
  b.fillStyle = rgba(IVORY, 0.6);
  b.fillText("Un tour offert chaque jour", px + pw / 2, 232);
  decoFrame(b, W, H, 8);
  const target = -Math.PI / 2 - (index * seg + seg / 2);
  const turns = 4 * TAU;
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0);
    const t = clamp(f / spin), ang = target - turns * (1 - ease.outQuint(t));
    const done = f >= spin;
    // couronne lumineuse
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 30;
    disc(ctx, cx, cy, R + 34, gold(ctx, cx - R, cy - R, cx + R, cy + R));
    ctx.restore();
    disc(ctx, cx, cy, R + 24, "#1a0f0a");
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * TAU, on = (k + f) % 2 === 0 || done;
      const bx = cx + Math.cos(a) * (R + 13), by = cy + Math.sin(a) * (R + 13);
      if (on) glow(ctx, bx, by, 12, "#fde68a", 0.6);
      disc(ctx, bx, by, 4, on ? "#fffaf0" : "#6b5a3a");
    }
    // segments
    for (let i = 0; i < n; i++) {
      const a0 = ang + i * seg, a1 = a0 + seg, col = segments[i].color;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a1);
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R);
      g.addColorStop(0, shade(col, -0.35));
      g.addColorStop(0.7, col);
      g.addColorStop(1, shade(col, 0.25));
      ctx.fillStyle = g;
      ctx.fill();
      if (done && i === index && Math.floor((f - spin) / 2) % 2 === 0) {
        ctx.fillStyle = "rgba(255,250,230,0.35)";
        ctx.fill();
      }
      ctx.strokeStyle = gold(ctx, cx - R, cy - R, cx + R, cy + R);
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      // le texte reste lisible : à gauche de la roue, il est retourné
      const mid = (((a0 + seg / 2) % TAU) + TAU) % TAU, flip = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
      ctx.rotate(a0 + seg / 2 + (flip ? Math.PI : 0));
      ctx.textAlign = flip ? "left" : "right";
      const label = segments[i].label;
      fit(ctx, label, R * 0.62, label === "JACKPOT" ? 22 : 26, "CardTitle");
      ctx.fillStyle = "#fffaf0";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 4;
      ctx.fillText(label, flip ? -(R - 22) : R - 22, 9);
      ctx.restore();
    }
    // moyeu
    disc(ctx, cx, cy, 52, gold(ctx, cx - 52, cy - 52, cx + 52, cy + 52));
    crest(ctx, cx, cy, 34);
    // aiguille dorée avec un rubis
    ctx.save();
    ctx.translate(cx, cy - R - 26);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-22, -22);
    ctx.lineTo(22, -22);
    ctx.lineTo(0, 30);
    ctx.closePath();
    ctx.fillStyle = gold(ctx, -22, -22, 22, 30);
    ctx.fill();
    ctx.restore();
    disc(ctx, cx, cy - R - 32, 8, RUBY);
    disc(ctx, cx - 2, cy - R - 34, 2.5, "rgba(255,255,255,0.7)");
    // panneau : résultat
    ctx.textAlign = "center";
    if (done) {
      const k = clamp((f - spin) / 6), s = 0.6 + 0.4 * ease.back(k);
      ctx.save();
      ctx.translate(px + pw / 2, 340);
      ctx.scale(s, s);
      plaque(ctx, 0, 0, 230, 100);
      ctx.font = "13px CardBold";
      ctx.fillStyle = GOLD[1];
      spaced(ctx, "VOUS GAGNEZ", 0, -18, 4);
      const label = segments[index].label;
      if (label === "JACKPOT") neon(ctx, label, 0, 28, 36, "#fbbf24", "CardEngrave", 3);
      else goldText(ctx, label, 0, 30, 44, "CardTitle");
      ctx.restore();
      if (segments[index].label === "JACKPOT") coinShower(ctx, W, H, (f - spin) / (frames - spin), 5);
      for (let s2 = 0; s2 < 5; s2++) sparkle(ctx, px + 40 + ((s2 * 53 + f * 7) % 220), 290 + ((s2 * 37) % 110), 7, "#fde68a", 0.5 + 0.5 * Math.sin(f + s2));
    } else {
      ctx.font = "24px CardItalic";
      ctx.fillStyle = rgba(IVORY, 0.55 + 0.3 * Math.sin(f * 0.5));
      ctx.fillText("La roue tourne…", px + pw / 2, 344);
    }
    shots.push(snap(c, f === frames - 1 ? 3000 : done ? 90 : 45, 0.78));
  }
  return encodeGif(shots);
}

// ============================================================
// Crash : la fusée de la Maison au-dessus de la baie de Monaco
// ============================================================
const fmtX = (m) => `×${m.toFixed(2).replace(".", ",")}`;
let skylineCache = null;
function skyline(W, H) {
  if (skylineCache?.width === W) return skylineCache;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#04040c");
  sky.addColorStop(0.55, "#120a24");
  sky.addColorStop(0.82, "#2a0f2a");
  sky.addColorStop(1, "#05040a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(2026);
  for (let i = 0; i < 220; i++) disc(ctx, R() * W, R() * H * 0.7, R() * 1.3 + 0.2, `rgba(255,248,230,${0.2 + R() * 0.7})`);
  glow(ctx, W * 0.1, H * 0.13, 70, "#fff6d5", 0.25);
  disc(ctx, W * 0.1, H * 0.13, 22, "#f6eedb");
  disc(ctx, W * 0.1 + 8, H * 0.13 - 5, 20, "#09081a");
  // la ville : immeubles, dôme du casino, fenêtres allumées
  const base = H - 70;
  let x = 0;
  while (x < W) {
    const w = 26 + R() * 46, h = 30 + R() * 90;
    ctx.fillStyle = "#0a0712";
    ctx.fillRect(x, base - h, w, h + 70);
    for (let wy = base - h + 8; wy < base - 4; wy += 10) {
      for (let wx = x + 5; wx < x + w - 5; wx += 8) if (R() < 0.33) ctx.fillStyle = R() < 0.8 ? "rgba(253,224,140,0.55)" : "rgba(255,255,255,0.4)", ctx.fillRect(wx, wy, 3, 4);
    }
    x += w + 2;
  }
  // dôme du casino
  const dx = W * 0.5;
  ctx.fillStyle = "#0d0816";
  ctx.beginPath();
  ctx.arc(dx, base - 96, 46, Math.PI, TAU);
  ctx.fill();
  ctx.fillRect(dx - 70, base - 96, 140, 100);
  ctx.strokeStyle = rgba(GOLD[2], 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(dx, base - 96, 46, Math.PI, TAU);
  ctx.stroke();
  for (let k = -3; k <= 3; k++) {
    ctx.fillStyle = "rgba(253,224,140,0.7)";
    ctx.fillRect(dx + k * 18 - 3, base - 70, 6, 22);
  }
  // la mer et les reflets
  const sea = ctx.createLinearGradient(0, base, 0, H);
  sea.addColorStop(0, "#0b0a1a");
  sea.addColorStop(1, "#020208");
  ctx.fillStyle = sea;
  ctx.fillRect(0, base + 8, W, H - base);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(253,224,140,${0.08 + R() * 0.2})`;
    ctx.fillRect(R() * W, base + 12 + R() * 56, 6 + R() * 18, 1.5);
  }
  skylineCache = c;
  return c;
}
async function crashImage(mult, crashed, history = [], cashouts = []) {
  const W = 960, H = 520, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(skyline(W, H), 0, 0);
  // zone du graphique
  const gx = 70, gy = 96, gw = 600, gh = 330;
  const maxM = Math.max(2, mult * 1.18);
  const X = (t) => gx + t * gw, Y = (m) => gy + gh - ((m - 1) / (maxM - 1)) * gh;
  ctx.font = "12px CardBold";
  ctx.textAlign = "right";
  const step = maxM <= 3 ? 0.5 : maxM <= 6 ? 1 : maxM <= 15 ? 2 : 5;
  for (let m = 1; m <= maxM + 0.001; m += step) {
    const y = Y(m);
    ctx.strokeStyle = "rgba(243,217,139,0.12)";
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(243,217,139,0.6)";
    ctx.fillText(fmtX(m).replace(",00", ""), gx - 8, y + 4);
  }
  // courbe : le multiplicateur grimpe de façon exponentielle
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, m = Math.exp(Math.log(Math.max(1.0001, mult)) * t);
    pts.push([X(t), Y(m), m]);
  }
  const area = ctx.createLinearGradient(0, gy, 0, gy + gh);
  area.addColorStop(0, crashed ? "rgba(239,68,68,0.35)" : "rgba(245,158,11,0.32)");
  area.addColorStop(1, "rgba(0,0,0,0)");
  ctx.beginPath();
  ctx.moveTo(pts[0][0], gy + gh);
  for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineTo(pts[pts.length - 1][0], gy + gh);
  ctx.closePath();
  ctx.fillStyle = area;
  ctx.fill();
  const line = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  line.addColorStop(0, GOLD[1]);
  line.addColorStop(1, crashed ? "#ef4444" : "#fb7185");
  ctx.save();
  ctx.shadowColor = crashed ? "#ef4444" : "#f59e0b";
  ctx.shadowBlur = 16;
  ctx.strokeStyle = line;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  // joueurs qui ont encaissé : un drapeau vert sur la courbe
  for (const [i, co] of cashouts.slice(-6).entries()) {
    if (co.at > mult) continue;
    const t = Math.log(co.at) / Math.log(Math.max(1.0001, mult)), x = X(t), y = Y(co.at);
    disc(ctx, x, y, 6, "#22c55e");
    ctx.strokeStyle = "#dcfce7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU);
    ctx.stroke();
    ctx.font = "12px CardBold";
    const label = `${co.name} ${fmtX(co.at)}`, lw = ctx.measureText(label).width + 14, ly = y - 22 - (i % 2) * 22;
    rr(ctx, x - lw / 2, ly - 13, lw, 20, 10);
    ctx.fillStyle = "rgba(6,40,22,0.88)";
    ctx.fill();
    ctx.fillStyle = "#bbf7d0";
    ctx.textAlign = "center";
    ctx.fillText(label, x, ly + 1);
  }
  // la fusée (ou l'explosion)
  const [ex, ey] = pts[pts.length - 1], [px0, py0] = pts[pts.length - 4];
  const ang = Math.atan2(ey - py0, ex - px0);
  if (crashed) {
    sunburst(ctx, ex, ey, 110, 18, "#f97316", 0.35, 0, TAU);
    glow(ctx, ex, ey, 90, "#ef4444", 0.8);
    glow(ctx, ex, ey, 40, "#fde68a", 0.9);
    const R = seeded(Math.round(mult * 100));
    for (let i = 0; i < 26; i++) {
      const a = R() * TAU, d = 20 + R() * 70;
      disc(ctx, ex + Math.cos(a) * d, ey + Math.sin(a) * d, 1.5 + R() * 3, R() < 0.5 ? "#fde68a" : "#f97316");
    }
  } else {
    for (let k = 1; k <= 10; k++) glow(ctx, ex - Math.cos(ang) * k * 9, ey - Math.sin(ang) * k * 9, 16 - k, k < 4 ? "#fde68a" : "#f97316", 0.5 - k * 0.04);
    const rocket = await fluent("Rocket");
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang + Math.PI / 4);
    if (rocket) ctx.drawImage(rocket, -30, -30, 60, 60);
    else disc(ctx, 0, 0, 12, "#f6eedb");
    ctx.restore();
  }
  // grand multiplicateur
  ctx.textAlign = "center";
  if (crashed) {
    neon(ctx, "CRASH", gx + gw / 2, 70, 26, "#ef4444", "CardEngrave", 10);
    neon(ctx, fmtX(mult), gx + gw / 2, 150, 70, "#ef4444", "CardTitle");
  } else neon(ctx, fmtX(mult), gx + gw / 2, 120, 76, mult >= 2 ? "#22c55e" : "#f59e0b", "CardTitle");
  // panneau de droite : historique
  const rx = 704, rw = 230;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 20;
  rr(ctx, rx, 30, rw, H - 60, 16);
  ctx.fillStyle = "rgba(8,6,14,0.84)";
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold(ctx, rx, 30, rx + rw, H - 30);
  ctx.lineWidth = 2;
  rr(ctx, rx, 30, rw, H - 60, 16);
  ctx.stroke();
  ctx.font = "10px CardEngrave";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "GRAND CASINO DE LA MAISON", rx + rw / 2, 60, 1);
  goldText(ctx, "LA FUSÉE", rx + rw / 2, 98, 30, "CardEngrave", 4);
  rule(ctx, rx + rw / 2, 116, 80);
  ctx.font = "12px CardBold";
  ctx.fillStyle = rgba(IVORY, 0.6);
  spaced(ctx, "DERNIERS VOLS", rx + rw / 2, 146, 3);
  const hist = history.slice(-10).reverse();
  hist.forEach((h, i) => {
    const col = i % 2, row = Math.floor(i / 2), bx = rx + 22 + col * 96, by = 160 + row * 36;
    const color = h < 2 ? "#7f1d1d" : h < 10 ? "#14532d" : "#854d0e";
    rr(ctx, bx, by, 88, 28, 14);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = h >= 10 ? GOLD[1] : "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#fffaf0";
    ctx.font = "14px CardBold";
    ctx.fillText(fmtX(h), bx + 44, by + 19);
  });
  if (!hist.length) {
    ctx.font = "14px CardItalic";
    ctx.fillStyle = rgba(IVORY, 0.5);
    ctx.fillText("Premier vol de la soirée", rx + rw / 2, 186);
  }
  ctx.font = "13px CardItalic";
  ctx.fillStyle = rgba(IVORY, 0.55);
  ctx.fillText(crashed ? "La fusée a explosé." : "Encaissez avant l'explosion !", rx + rw / 2, H - 56);
  decoFrame(ctx, W, H, 8);
  return c.encode("jpeg", 90);
}

// ============================================================
// Courses : le Grand Prix de la Maison à l'hippodrome
// ============================================================
async function raceGif(horses, order) {
  const W = 960, H = 560, frames = 74, shots = [];
  const n = horses.length, top = 186, LH = Math.min(56, Math.floor((H - top - 40) / n));
  const startX = 120, finishX = W - 120;
  const horse = await fluent("Horse");
  // décor fixe : tribunes art déco, foule, piste en herbe
  const base = createCanvas(W, H), b = base.getContext("2d");
  const sky = b.createLinearGradient(0, 0, 0, top);
  sky.addColorStop(0, "#0c1c3a");
  sky.addColorStop(1, "#3b2a4a");
  b.fillStyle = sky;
  b.fillRect(0, 0, W, top);
  sunburst(b, W / 2, top + 40, 700, 36, GOLD[1], 0.05);
  // tribune
  b.fillStyle = "#1a1016";
  b.fillRect(40, 70, W - 80, top - 70);
  const R = seeded(31);
  for (let row = 0; row < 6; row++) {
    for (let x = 52; x < W - 52; x += 9) {
      const hue = ["#f6eedb", "#b3122e", "#1d3a8a", "#d4a53c", "#0f5f3f", "#f472b6"][Math.floor(R() * 6)];
      disc(b, x + (row % 2) * 4, 104 + row * 13, 3.6, rgba(hue, 0.75));
    }
  }
  // auvent doré à redans
  b.beginPath();
  b.moveTo(30, 82);
  for (let x = 30; x <= W - 30; x += 60) {
    b.lineTo(x, 70);
    b.lineTo(x + 30, 82);
  }
  b.lineTo(W - 30, 50);
  b.lineTo(30, 50);
  b.closePath();
  b.fillStyle = "#14090d";
  b.fill();
  b.strokeStyle = gold(b, 0, 40, W, 90);
  b.lineWidth = 2;
  b.stroke();
  for (let x = 60; x < W - 40; x += 120) {
    b.strokeStyle = rgba(GOLD[1], 0.7);
    b.beginPath();
    b.moveTo(x, 50);
    b.lineTo(x, 22);
    b.stroke();
    b.fillStyle = ["#b3122e", "#1d3a8a", "#d4a53c"][Math.floor(x / 120) % 3];
    b.beginPath();
    b.moveTo(x, 22);
    b.lineTo(x + 18, 28);
    b.lineTo(x, 34);
    b.closePath();
    b.fill();
  }
  b.textAlign = "center";
  plaque(b, W / 2, 46, 420, 46);
  b.font = "20px CardEngrave";
  goldText(b, "GRAND PRIX DE LA MAISON", W / 2, 54, 20, "CardEngrave", 4);
  // piste
  for (let i = 0; i < n; i++) {
    const y = top + i * LH;
    b.fillStyle = i % 2 ? "#2f6b2b" : "#367a31";
    b.fillRect(0, y, W, LH);
    for (let x = 0; x < W; x += 60) {
      b.fillStyle = "rgba(255,255,255,0.03)";
      b.fillRect(x, y, 30, LH);
    }
  }
  b.fillStyle = "#24561f";
  b.fillRect(0, top + n * LH, W, H - top - n * LH);
  for (const y of [top - 4, top + n * LH]) {
    b.fillStyle = "#f6eedb";
    b.fillRect(0, y, W, 5);
    for (let x = 0; x < W; x += 40) b.fillRect(x, y - 8, 4, 12);
  }
  // ligne d'arrivée et poteau doré
  for (let y = top; y < top + n * LH; y += 10) {
    for (let k = 0; k < 2; k++) {
      b.fillStyle = (Math.floor((y - top) / 10) + k) % 2 ? "#111" : "#f6eedb";
      b.fillRect(finishX + k * 10, y, 10, 10);
    }
  }
  b.fillStyle = gold(b, finishX + 22, 0, finishX + 32, 0);
  b.fillRect(finishX + 24, top - 60, 8, n * LH + 60);
  disc(b, finishX + 28, top - 64, 12, gold(b, finishX + 16, top - 76, finishX + 40, top - 52));
  // stalles de départ
  for (let i = 0; i < n; i++) {
    const y = top + i * LH;
    b.fillStyle = "rgba(10,8,12,0.75)";
    b.fillRect(0, y + 2, startX - 34, LH - 4);
    b.fillStyle = horses[i].color;
    b.fillRect(0, y + 2, 6, LH - 4);
    b.textAlign = "left";
    b.font = "13px CardBold";
    b.fillStyle = "#fffaf0";
    b.fillText(`${i + 1}. ${horses[i].name}`.slice(0, 12), 12, y + LH / 2 - 2);
    b.font = "11px CardBold";
    b.fillStyle = GOLD[1];
    b.fillText(`×${horses[i].odds.toFixed(1).replace(".", ",")}`, 12, y + LH / 2 + 13);
  }
  // déroulé : vitesses irrégulières, mais l'ordre d'arrivée est celui tiré au sort
  const rank = new Array(n);
  order.forEach((h, k) => (rank[h] = k));
  const Rr = seeded(Date.now() % 99991);
  const plans = horses.map((_, i) => {
    const end = 50 + rank[i] * 3.2, wob = [Rr(), Rr(), Rr()].map((v) => v * 0.06);
    return (f) => {
      const t = clamp(f / end);
      const p = t - wob[0] * Math.sin(t * Math.PI) + wob[1] * Math.sin(t * Math.PI * 2) * (1 - t);
      return clamp(p) * (finishX - startX + 20);
    };
  });
  const finished = (f) => order.filter((h) => f >= 50 + rank[h] * 3.2);
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(base, 0, 0);
    // la foule s'agite
    for (let k = 0; k < 14; k++) {
      const x = 60 + ((k * 67 + f * 13) % (W - 120));
      disc(ctx, x, 100 + (k % 5) * 13 - Math.abs(Math.sin(f * 0.6 + k)) * 4, 3.4, "rgba(253,224,140,0.8)");
    }
    for (let i = 0; i < n; i++) {
      const y = top + i * LH, x = startX - 30 + plans[i](f);
      const gallop = Math.sin(f * 1.3 + i) * 3;
      // poussière derrière le cheval
      if (f > 2 && plans[i](f) < finishX - startX) for (let k = 1; k <= 3; k++) disc(ctx, x - 6 - k * 9, y + LH - 10 + Math.sin(f + k) * 2, 5 - k, `rgba(210,190,140,${0.35 - k * 0.09})`);
      if (horse) ctx.drawImage(horse, x - 4, y + 2 + gallop, LH - 4, LH - 4);
      // tapis de selle aux couleurs du cheval
      rr(ctx, x + LH * 0.3, y + LH * 0.36 + gallop, 18, 14, 3);
      ctx.fillStyle = horses[i].color;
      ctx.fill();
      ctx.font = "10px CardBold";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fffaf0";
      ctx.fillText(String(i + 1), x + LH * 0.3 + 9, y + LH * 0.36 + 11 + gallop);
    }
    // arrivée : rang affiché au bout de chaque couloir
    for (const h of finished(f)) {
      const y = top + h * LH, k = rank[h];
      disc(ctx, W - 54, y + LH / 2, 15, k === 0 ? gold(ctx, W - 69, y, W - 39, y + LH) : k === 1 ? "#cbd5e1" : k === 2 ? "#b45309" : "#1f2937");
      ctx.font = "15px CardBold";
      ctx.textAlign = "center";
      ctx.fillStyle = k < 3 ? "#1c1003" : "#fffaf0";
      ctx.fillText(String(k + 1), W - 54, y + LH / 2 + 5);
    }
    // photo-finish : le podium
    const podiumAt = 50 + 3 * 3.2 + 4;
    if (f >= podiumAt) {
      const t = clamp((f - podiumAt) / 6);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.fillStyle = "rgba(4,3,6,0.62)";
      ctx.fillRect(0, top - 4, W, n * LH + 9);
      const pw = 520, ph = 190, pcx = W / 2, pcy = top + (n * LH) / 2;
      plaque(ctx, pcx, pcy, pw, ph);
      ctx.textAlign = "center";
      ctx.font = "13px CardEngrave";
      ctx.fillStyle = GOLD[1];
      spaced(ctx, "PHOTO-FINISH", pcx, pcy - 62, 6);
      const w0 = horses[order[0]];
      neon(ctx, `${order[0] + 1}. ${w0.name}`, pcx, pcy - 18, 36, "#fbbf24", "CardTitle");
      ctx.font = "16px CardBold";
      ctx.fillStyle = IVORY;
      ctx.fillText(`gagne à ×${w0.odds.toFixed(1).replace(".", ",")}`, pcx, pcy + 10);
      ctx.font = "15px CardBold";
      ctx.fillStyle = rgba(IVORY, 0.75);
      ctx.fillText(`2e : ${horses[order[1]]?.name ?? ""}   ·   3e : ${horses[order[2]]?.name ?? ""}`, pcx, pcy + 52);
      ctx.restore();
      if (f > podiumAt + 4) for (let k = 0; k < 6; k++) sparkle(ctx, W / 2 - 230 + ((k * 91 + f * 9) % 460), top + 30 + ((k * 53) % (n * LH - 60)), 8, "#fde68a", 0.6);
    }
    decoFrame(ctx, W, H, 8);
    shots.push(snap(c, f === frames - 1 ? 3200 : f >= podiumAt ? 90 : 55, 0.76));
  }
  return encodeGif(shots);
}

// ============================================================
// Carte VIP : une carte de membre en métal, selon le niveau
// ============================================================
const VIP_METAL = {
  Bronze: ["#3b2414", "#a06a3a", "#e3a76b", "#5c3418"],
  Argent: ["#2f3438", "#9aa3ab", "#eef2f5", "#4b5258"],
  Or: ["#4a3207", "#c99a2e", "#fff0b8", "#7a5410"],
  Platine: ["#22303a", "#9fb6c4", "#f1f7fb", "#3d5363"],
  Diamant: ["#05050a", "#1b1830", "#6b5bd6", "#0a0a14"],
};
async function vipCard(d) {
  const W = 900, H = 540, c = createCanvas(W, H), ctx = c.getContext("2d");
  lacquer(ctx, W, H, "#0e0a10");
  const m = VIP_METAL[d.level] ?? VIP_METAL.Bronze, dark = d.level === "Diamant";
  const cx = 70, cy = 50, cw = W - 140, ch = H - 100;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.75)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  rr(ctx, cx, cy, cw, ch, 28);
  const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
  g.addColorStop(0, m[0]);
  g.addColorStop(0.35, m[1]);
  g.addColorStop(0.5, m[2]);
  g.addColorStop(0.65, m[1]);
  g.addColorStop(1, m[3]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rr(ctx, cx, cy, cw, ch, 28);
  ctx.clip();
  // métal brossé et éventail gravé
  for (let y = cy; y < cy + ch; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.012 + ((y * 7) % 5) * 0.004})`;
    ctx.fillRect(cx, y, cw, 1);
  }
  sunburst(ctx, cx + cw, cy + ch, 620, 30, dark ? "#a78bfa" : "#ffffff", dark ? 0.08 : 0.07);
  if (dark) for (let k = 0; k < 40; k++) sparkle(ctx, cx + ((k * 131) % cw), cy + ((k * 71) % ch), 3 + (k % 4), ["#a78bfa", "#67e8f9", "#f0abfc"][k % 3], 0.5);
  ctx.restore();
  ctx.strokeStyle = dark ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  rr(ctx, cx + 10, cy + 10, cw - 20, ch - 20, 22);
  ctx.stroke();
  const ink = dark || d.level === "Bronze" ? "#fffaf0" : "#1c160f";
  const sub = dark ? "#c4b5fd" : d.level === "Bronze" ? "#fde7cf" : "rgba(28,22,15,0.7)";
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = sub;
  spaced(ctx, "GRAND CASINO DE LA MAISON", cx + 40, cy + 54, 4);
  ctx.font = "54px CardEngrave";
  ctx.fillStyle = ink;
  spaced(ctx, d.level.toUpperCase(), cx + 40, cy + 120, 6);
  ctx.font = "14px CardBold";
  ctx.fillStyle = sub;
  spaced(ctx, "MEMBRE VIP", cx + 42, cy + 146, 5);
  // puce dorée
  rr(ctx, cx + 42, cy + 172, 66, 50, 9);
  ctx.fillStyle = gold(ctx, cx + 42, cy + 172, cx + 108, cy + 222);
  ctx.fill();
  ctx.strokeStyle = "rgba(90,58,10,0.6)";
  ctx.lineWidth = 1.2;
  for (const yy of [188, 205]) {
    ctx.beginPath();
    ctx.moveTo(cx + 42, cy + yy);
    ctx.lineTo(cx + 108, cy + yy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx + 75, cy + 172);
  ctx.lineTo(cx + 75, cy + 222);
  ctx.stroke();
  crest(ctx, cx + cw - 80, cy + 80, 40);
  ctx.textAlign = "left";
  // nom en relief
  fit(ctx, d.name.toUpperCase(), 520, 34, "CardEngrave");
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  spaced(ctx, d.name.toUpperCase(), cx + 42, cy + 278, 3);
  ctx.fillStyle = ink;
  spaced(ctx, d.name.toUpperCase(), cx + 40, cy + 276, 3);
  // progression
  const bx = cx + 40, bw = cw - 80, by = cy + 312;
  ctx.font = "13px CardBold";
  ctx.fillStyle = sub;
  ctx.fillText(d.next ? `${d.wageredText} misés · prochain niveau : ${d.next} (${d.nextText})` : `${d.wageredText} misés · niveau maximum`, bx, by - 8);
  rr(ctx, bx, by, bw, 12, 6);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fill();
  rr(ctx, bx, by, Math.max(12, bw * clamp(d.pct)), 12, 6);
  ctx.fillStyle = gold(ctx, bx, by, bx + bw, by);
  ctx.fill();
  // avantages et chiffres
  const stats = [["ROUE", `×${String(d.wheel).replace(".", ",")}`], ["CASHBACK", `${d.cashback} %`], ["PARTIES", String(d.games)], ["RECORD", d.bestText]];
  stats.forEach(([k, v], i) => {
    const sx = bx + i * (bw / 4);
    ctx.font = "12px CardBold";
    ctx.fillStyle = sub;
    spaced(ctx, k, sx, by + 52, 3);
    ctx.font = "26px CardTitle";
    ctx.fillStyle = ink;
    ctx.fillText(v, sx, by + 86);
  });
  return c.encode("png");
}

// ============================================================
// En-têtes des salles en direct (roulette, fusée, courses)
// ============================================================
const headerCache = new Map();
async function tableHeader(kind) {
  if (headerCache.has(kind)) return headerCache.get(kind);
  const T = { roulette: ["ROULETTE EN DIRECT", "Faites vos jeux, la roue tourne pour tous", "#0b3d2c", "Slot machine"], crash: ["LA FUSÉE", "Encaissez avant l'explosion", "#120a24", "Rocket"], courses: ["GRAND PRIX", "Misez sur votre cheval", "#1a2a14", "Horse"] }[kind];
  const W = 960, H = 220, c = createCanvas(W, H), ctx = c.getContext("2d");
  if (kind === "crash") ctx.drawImage(skyline(960, 520), 0, -160);
  else if (kind === "roulette") feltBg(ctx, W, H, T[2]);
  else lacquer(ctx, W, H, T[2]);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(0, 0, W, H);
  sunburst(ctx, W / 2, H + 40, 640, 34, GOLD[1], 0.07);
  const icon = kind === "roulette" ? null : await fluent(T[3]);
  if (kind === "roulette") {
    for (const [x, a] of [[112, 0.4], [W - 112, 1.7]]) {
      ctx.save();
      ctx.translate(x, 116);
      ctx.scale(1, 0.62);
      ctx.drawImage(rouletteTop(180, a, null), -90, -90);
      ctx.restore();
    }
  } else if (icon) {
    ctx.drawImage(icon, 70, 50, 120, 120);
    ctx.save();
    ctx.translate(W - 70, 50);
    ctx.scale(-1, 1);
    ctx.drawImage(icon, 0, 0, 120, 120);
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.font = "14px CardEngrave";
  ctx.fillStyle = GOLD[1];
  spaced(ctx, "GRAND CASINO DE LA MAISON", W / 2, 60, 6);
  neon(ctx, T[0], W / 2, 122, T[0].length > 12 ? 38 : 54, "#f59e0b", "CardEngrave", T[0].length > 12 ? 3 : 6);
  rule(ctx, W / 2, 148, 200);
  ctx.font = "18px CardItalic";
  ctx.fillStyle = rgba(IVORY, 0.8);
  ctx.fillText(T[1], W / 2, 180);
  decoFrame(ctx, W, H, 6);
  const buf = await c.encode("jpeg", 90);
  headerCache.set(kind, buf);
  return buf;
}

module.exports = { casinoBanner, slotsGif, slotsGrid, rouletteGif, blackjackImage, fortuneWheelGif, crashImage, raceGif, vipCard, tableHeader, odometer, slotSymbol, playingCard, WHEEL_ORDER };
