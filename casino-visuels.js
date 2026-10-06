// Images et animations du casino : machine à sous, roulette, blackjack, roue de la fortune, Crash, courses, bannière.
// Style « Art déco néon » : velours sombre, or, néons roses. Tout est dessiné en code.
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
  ["playfair-display-700-italic.ttf", "CardItalic"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}

const TAU = Math.PI * 2;
const GOLD = ["#fff7d6", "#fde68a", "#f59e0b", "#b45309", "#78350f"];
const NEON = "#f472b6";
const yieldLoop = () => new Promise((r) => setImmediate(r));
const ease = {
  out: (q) => 1 - (1 - q) ** 3,
  outQuint: (q) => 1 - (1 - q) ** 5,
  inOut: (q) => (q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2),
  back: (q) => 1 + 2.7 * (q - 1) ** 3 + 1.7 * (q - 1) ** 2,
};
function seeded(seed) {
  let s = Math.abs(Math.floor(seed)) % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function glow(ctx, x, y, r, hex, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(hex, a));
  g.addColorStop(1, rgba(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function disc(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}
function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  [GOLD[4], GOLD[2], GOLD[0], GOLD[1], GOLD[3], GOLD[2]].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  return g;
}
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
}
function neonText(ctx, text, x, y, size, color, font = "CardTitle") {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = `${size}px ${font}`;
  ctx.shadowColor = color;
  for (const blur of [30, 16, 6]) {
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.85;
  ctx.fillText(text, x, y);
  ctx.restore();
}
function bigText(ctx, text, x, y, size, color, scale = 1, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.textAlign = "center";
  ctx.font = `${size}px CardTitle`;
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.lineWidth = size / 7;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 0, 0);
  const g = ctx.createLinearGradient(0, -size, 0, size * 0.2);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#fde68a");
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
// velours sombre, motif art déco et ampoules
function velvet(ctx, W, H, tint = "#2a0a1e") {
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, tint);
  g.addColorStop(1, "#06020a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(253,230,138,0.05)";
  ctx.lineWidth = 1;
  for (let x = -H; x < W + H; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
    ctx.moveTo(x + H, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}
function bulbs(ctx, W, H, phase, inset = 10) {
  const n = Math.round((W + H) / 26);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = k / n, per = 2 * (W + H) - 8 * inset;
    let d = t * per, x, y;
    const w = W - 2 * inset, h = H - 2 * inset;
    if (d < w) (x = inset + d), (y = inset);
    else if ((d -= w) < h) (x = W - inset), (y = inset + d);
    else if ((d -= h) < w) (x = W - inset - d), (y = H - inset);
    else (d -= w), (x = inset), (y = H - inset - d);
    pts.push([x, y, (k + phase) % 3 === 0]);
  }
  for (const [x, y, on] of pts) {
    if (on) glow(ctx, x, y, 12, "#fde68a", 0.7);
    disc(ctx, x, y, 3.2, on ? "#fffbeb" : "#78350f");
  }
}
function goldFrame(ctx, W, H, r = 22) {
  ctx.lineWidth = 4;
  ctx.strokeStyle = goldGradient(ctx, 0, 0, W, H);
  rr(ctx, 4, 4, W - 8, H - 8, r);
  ctx.stroke();
}
function encodeGif(shots) {
  if (process.env.CASINO_FRAMES_DIR) debugFrames(shots);
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
  shots.forEach((sh, i) => enc.writeFrame(applyPalette(sh.data, palette), sh.width, sh.height, { palette: i ? undefined : palette, delay: sh.delay, repeat: -1 }));
  enc.finish();
  return Buffer.from(enc.bytes());
}
let debugN = 0;
function debugFrames(shots) {
  const W = shots[0].width, H = shots[0].height, picks = [0.35, 0.6, 1].map((p) => shots[Math.min(shots.length - 1, Math.floor((shots.length - 1) * p))]);
  const c = createCanvas(W * 3, H), ctx = c.getContext("2d");
  picks.forEach((sh, i) => {
    const img = ctx.createImageData(W, H);
    img.data.set(sh.data);
    ctx.putImageData(img, i * W, 0);
  });
  require("fs").writeFileSync(require("path").join(process.env.CASINO_FRAMES_DIR, `frames_${debugN++}.png`), c.toBuffer("image/png"));
}
const snap = (c, delay) => ({ data: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, width: c.width, height: c.height, delay });

// images Fluent (fruits, cloche, diamant, cheval…)
const imgCache = new Map();
async function fluent(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  const file = name.toLowerCase().replace(/ /g, "_");
  const url = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodeURIComponent(name)}/3D/${file}_3d.png`;
  const img = await fetch(url)
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? loadImage(Buffer.from(b)) : null))
    .catch(() => null);
  imgCache.set(name, img);
  return img;
}

// --- Machine à sous ---
const SLOT_ART = { "🍒": "Cherries", "🍋": "Lemon", "🍇": "Grapes", "🔔": "Bell", "💎": "Gem stone" };
async function slotSymbol(ctx, emoji, x, y, s, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (emoji === "7️⃣") {
    ctx.textAlign = "center";
    ctx.font = `${Math.round(s * 1.05)}px CardTitle`;
    ctx.lineWidth = s * 0.1;
    ctx.strokeStyle = "#450a0a";
    ctx.strokeText("7", x, y + s * 0.36);
    const g = ctx.createLinearGradient(0, y - s / 2, 0, y + s / 2);
    g.addColorStop(0, "#fecaca");
    g.addColorStop(0.5, "#ef4444");
    g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g;
    ctx.fillText("7", x, y + s * 0.36);
  } else {
    const img = await fluent(SLOT_ART[emoji] ?? "Star");
    if (img) ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
  }
  ctx.restore();
}
function slotCabinet(W, H) {
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  velvet(ctx, W, H, "#3b0a24");
  goldFrame(ctx, W, H);
  ctx.textAlign = "center";
  neonText(ctx, "LA MACHINE DE LA MAISON", W / 2, 56, 30, NEON, "CardEngrave");
  return c;
}
// result : 3 symboles (emoji) ; info : { gain, label, jackpot }
async function slotsGif(result, info = {}) {
  const W = 720, H = 400, RX = 120, RY = 96, RW = 160, RH = 220, GAP = 20, S = 104;
  const cab = slotCabinet(W, H);
  const pool = ["🍒", "🍋", "🍇", "🔔", "💎", "7️⃣"];
  for (const e of pool) if (SLOT_ART[e]) await fluent(SLOT_ART[e]);
  const R = seeded(Date.now());
  const strips = [0, 1, 2].map(() => Array.from({ length: 30 }, () => pool[Math.floor(R() * pool.length)]));
  const stops = [16, 22, 28], total = 40, shots = [];
  const win = info.gain > 0;
  for (let f = 0; f < total; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(cab, 0, 0);
    bulbs(ctx, W, H, f, 10);
    for (let i = 0; i < 3; i++) {
      const x = RX + i * (RW + GAP);
      // fenêtre du rouleau
      ctx.save();
      rr(ctx, x, RY, RW, RH, 14);
      const bg = ctx.createLinearGradient(0, RY, 0, RY + RH);
      bg.addColorStop(0, "#d6d3d1");
      bg.addColorStop(0.5, "#ffffff");
      bg.addColorStop(1, "#d6d3d1");
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.clip();
      if (f < stops[i]) {
        const off = (f * 47 + i * 30) % (S * strips[i].length);
        for (let k = -1; k < 4; k++) {
          const idx = Math.floor(off / S) + k, sy = RY + RH / 2 + (k - 1) * S - (off % S) + S / 2;
          const e = strips[i][((idx % 30) + 30) % 30];
          for (let tr = 0; tr < 3; tr++) await slotSymbol(ctx, e, x + RW / 2, sy - tr * 14, S * 0.8, tr ? 0.22 : 0.7);
        }
      } else {
        const bounce = f - stops[i] < 3 ? Math.sin(((f - stops[i]) / 3) * Math.PI) * 12 : 0;
        const above = strips[i][(i * 7 + 3) % 30], below = strips[i][(i * 5 + 11) % 30];
        await slotSymbol(ctx, above, x + RW / 2, RY + RH / 2 - S + bounce, S * 0.8, 0.45);
        await slotSymbol(ctx, result[i], x + RW / 2, RY + RH / 2 + bounce, S * 0.92);
        await slotSymbol(ctx, below, x + RW / 2, RY + RH / 2 + S + bounce, S * 0.8, 0.45);
      }
      // reflet et ombres du tambour
      const sh = ctx.createLinearGradient(0, RY, 0, RY + RH);
      sh.addColorStop(0, "rgba(0,0,0,0.45)");
      sh.addColorStop(0.25, "rgba(0,0,0,0)");
      sh.addColorStop(0.75, "rgba(0,0,0,0)");
      sh.addColorStop(1, "rgba(0,0,0,0.45)");
      ctx.fillStyle = sh;
      ctx.fillRect(x, RY, RW, RH);
      ctx.restore();
      ctx.lineWidth = 5;
      ctx.strokeStyle = goldGradient(ctx, x, RY, x + RW, RY + RH);
      rr(ctx, x, RY, RW, RH, 14);
      ctx.stroke();
    }
    // ligne de gain
    const done = f >= stops[2];
    ctx.strokeStyle = done && win ? `rgba(244,114,182,${0.6 + 0.4 * Math.sin(f)})` : "rgba(239,68,68,0.55)";
    ctx.lineWidth = done && win ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(RX - 18, RY + RH / 2);
    ctx.lineTo(RX + 3 * RW + 2 * GAP + 18, RY + RH / 2);
    ctx.stroke();
    if (done) {
      const q = Math.min(1, (f - stops[2]) / 6);
      if (info.jackpot) {
        const Rj = seeded(f * 13);
        for (let k = 0; k < 40; k++) {
          const px = Rj() * W, py = ((Rj() * H + f * 22) % H);
          disc(ctx, px, py, 5 + Rj() * 4, Rj() < 0.5 ? "#fbbf24" : "#fde68a");
        }
        bigText(ctx, "JACKPOT !", W / 2, H - 34, 54, "#f59e0b", 1.3 - 0.3 * ease.back(q), q * 2);
      } else if (win) bigText(ctx, info.label ?? "GAGNÉ !", W / 2, H - 32, 40, "#22c55e", 1.25 - 0.25 * ease.back(q), q * 2);
      else {
        ctx.textAlign = "center";
        ctx.font = "22px CardEngrave";
        ctx.fillStyle = `rgba(203,213,225,${q})`;
        spaced(ctx, "PAS DE CHANCE…", W / 2, H - 36, 3);
      }
    }
    shots.push(snap(c, f === total - 1 ? 4000 : f < stops[0] ? 45 : 55));
  }
  return encodeGif(shots);
}
// plusieurs tours d'un coup : une grille des résultats
async function slotsGrid(rows) {
  const W = 720, RH = 74, H = 110 + rows.length * RH + 20;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  velvet(ctx, W, H, "#3b0a24");
  goldFrame(ctx, W, H);
  neonText(ctx, `${rows.length} TOURS`, W / 2, 62, 30, NEON, "CardEngrave");
  for (const [k, r] of rows.entries()) {
    const y = 96 + k * RH;
    rr(ctx, 40, y, W - 80, RH - 10, 12);
    ctx.fillStyle = r.gain > 0 ? "rgba(34,197,94,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fill();
    for (let i = 0; i < 3; i++) await slotSymbol(ctx, r.reels[i], 110 + i * 80, y + (RH - 10) / 2, 52);
    ctx.textAlign = "right";
    ctx.font = "26px CardBold";
    ctx.fillStyle = r.jackpot ? "#fbbf24" : r.gain > 0 ? "#4ade80" : "#64748b";
    ctx.fillText(r.jackpot ? "JACKPOT !" : r.gain > 0 ? `+${r.gainText}` : "—", W - 64, y + RH / 2 + 4);
    if (r.note) {
      ctx.font = "15px CardText";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText(r.note, W - 64, y + RH / 2 + 24);
    }
  }
  return c.encode("png");
}

// --- Roulette ---
const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const pocketColor = (n) => (n === 0 ? "#15803d" : RED.has(n) ? "#b91c1c" : "#111827");
function drawWheel(ctx, cx, cy, R, angle) {
  // bois et or
  glow(ctx, cx, cy, R * 1.4, "#fbbf24", 0.18);
  disc(ctx, cx, cy, R + 26, "#3f1d0b");
  ctx.lineWidth = 8;
  ctx.strokeStyle = goldGradient(ctx, cx - R, cy - R, cx + R, cy + R);
  ctx.beginPath();
  ctx.arc(cx, cy, R + 22, 0, TAU);
  ctx.stroke();
  const n = WHEEL_ORDER.length, seg = TAU / n;
  for (let k = 0; k < n; k++) {
    const a0 = angle + k * seg - Math.PI / 2 - seg / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, a0, a0 + seg);
    ctx.closePath();
    ctx.fillStyle = pocketColor(WHEEL_ORDER[k]);
    ctx.fill();
    ctx.strokeStyle = "rgba(253,230,138,0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a0 + seg / 2 + Math.PI / 2);
    ctx.textAlign = "center";
    ctx.font = `${Math.round(R * 0.085)}px CardBold`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(WHEEL_ORDER[k]), 0, -R * 0.84);
    ctx.restore();
  }
  disc(ctx, cx, cy, R * 0.62, "#2b1408");
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(253,230,138,0.7)";
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.62, 0, TAU);
  ctx.stroke();
  // croisillon central
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = goldGradient(ctx, -R * 0.4, -R * 0.4, R * 0.4, R * 0.4);
  for (let k = 0; k < 4; k++) {
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(-4, 0, 8, R * 0.42);
    disc(ctx, 0, R * 0.42, 7, "#fde68a");
  }
  ctx.restore();
  disc(ctx, cx, cy, 16, goldGradient(ctx, cx - 16, cy - 16, cx + 16, cy + 16));
}
// result : numéro gagnant ; label : texte du résultat ; win : vrai si le joueur gagne
async function rouletteGif(result, label = "", win = null) {
  const W = 720, H = 420, cx = 250, cy = 214, R = 168, frames = 46, shots = [];
  const n = WHEEL_ORDER.length, seg = TAU / n, idx = WHEEL_ORDER.indexOf(result);
  const wheelEnd = 6.5 + Math.random() * 2;
  const ballEndRel = idx * seg; // la bille finit sur la case gagnante
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const t = Math.min(1, f / (frames - 12)), e = ease.outQuint(t);
    const wheelAngle = wheelEnd * e;
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    velvet(ctx, W, H, "#06281a");
    goldFrame(ctx, W, H);
    drawWheel(ctx, cx, cy, R, wheelAngle);
    // la bille tourne à contresens, puis tombe dans sa case
    const ballAbs = wheelAngle + ballEndRel - Math.PI / 2 + (1 - e) * -14;
    const br = R * (0.93 - 0.17 * Math.min(1, Math.max(0, (t - 0.55) / 0.45)));
    const bx = cx + Math.cos(ballAbs) * br, by = cy + Math.sin(ballAbs) * br;
    glow(ctx, bx, by, 16, "#ffffff", 0.6);
    disc(ctx, bx, by, 8, "#f8fafc");
    disc(ctx, bx - 2.5, by - 2.5, 3, "#ffffff");
    // panneau du résultat
    ctx.textAlign = "center";
    neonText(ctx, "ROULETTE", 560, 80, 34, NEON, "CardEngrave");
    if (t >= 1) {
      const q = Math.min(1, (f - (frames - 12)) / 5);
      const col = pocketColor(result);
      ctx.save();
      ctx.translate(560, 200);
      ctx.scale(0.6 + 0.4 * ease.back(q), 0.6 + 0.4 * ease.back(q));
      disc(ctx, 0, 0, 62, goldGradient(ctx, -62, -62, 62, 62));
      disc(ctx, 0, 0, 54, col);
      ctx.font = "56px CardTitle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(result), 0, 20);
      ctx.restore();
      ctx.font = "22px CardEngrave";
      ctx.fillStyle = "#fde68a";
      spaced(ctx, result === 0 ? "ZÉRO" : `${RED.has(result) ? "ROUGE" : "NOIR"} · ${result % 2 ? "IMPAIR" : "PAIR"}`, 560, 300, 3);
      if (label) bigText(ctx, label, 560, 360, 30, win === false ? "#ef4444" : "#22c55e", 1, q * 2);
    } else {
      ctx.font = "20px CardItalic";
      ctx.fillStyle = "#e7d6b0";
      ctx.fillText("Rien ne va plus…", 560, 210);
    }
    shots.push(snap(c, f === frames - 1 ? 5000 : t < 0.6 ? 45 : 65));
  }
  return encodeGif(shots);
}

// --- Blackjack ---
function suitPath(ctx, suit, x, y, s) {
  ctx.beginPath();
  if (suit === "♥") {
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 0.6, y - s * 0.1, x - s * 0.35, y - s * 0.55, x, y - s * 0.2);
    ctx.bezierCurveTo(x + s * 0.35, y - s * 0.55, x + s * 0.6, y - s * 0.1, x, y + s * 0.35);
  } else if (suit === "♦") {
    ctx.moveTo(x, y - s * 0.45);
    ctx.lineTo(x + s * 0.32, y);
    ctx.lineTo(x, y + s * 0.45);
    ctx.lineTo(x - s * 0.32, y);
  } else if (suit === "♠") {
    ctx.moveTo(x, y - s * 0.42);
    ctx.bezierCurveTo(x + s * 0.6, y + s * 0.05, x + s * 0.3, y + s * 0.4, x, y + s * 0.12);
    ctx.bezierCurveTo(x - s * 0.3, y + s * 0.4, x - s * 0.6, y + s * 0.05, x, y - s * 0.42);
    ctx.moveTo(x, y + s * 0.05);
    ctx.lineTo(x + s * 0.14, y + s * 0.42);
    ctx.lineTo(x - s * 0.14, y + s * 0.42);
  } else {
    for (const [dx, dy] of [[0, -0.2], [-0.2, 0.08], [0.2, 0.08]]) {
      ctx.moveTo(x + dx * s + s * 0.17, y + dy * s);
      ctx.arc(x + dx * s, y + dy * s, s * 0.17, 0, TAU);
    }
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * 0.13, y + s * 0.42);
    ctx.lineTo(x - s * 0.13, y + s * 0.42);
  }
  ctx.closePath();
  ctx.fill();
}
function playingCard(ctx, card, x, y, w, h, hidden = false, rot = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rot);
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  rr(ctx, -w / 2, -h / 2, w, h, 9);
  if (hidden) {
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, "#7f1d1d");
    g.addColorStop(1, "#3b0a0a");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(253,230,138,0.7)";
    ctx.lineWidth = 2;
    rr(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 6);
    ctx.stroke();
    ctx.fillStyle = "rgba(253,230,138,0.85)";
    ctx.textAlign = "center";
    ctx.font = `${Math.round(w * 0.32)}px CardTitle`;
    ctx.fillText("M", 0, w * 0.11);
  } else {
    ctx.fillStyle = "#fffdf7";
    ctx.fill();
    ctx.shadowBlur = 0;
    const red = card.suit === "♥" || card.suit === "♦";
    ctx.fillStyle = red ? "#b91c1c" : "#111827";
    ctx.textAlign = "center";
    ctx.font = `${Math.round(w * 0.26)}px CardTitle`;
    ctx.fillText(card.rank, -w / 2 + w * 0.2, -h / 2 + w * 0.3);
    suitPath(ctx, card.suit, -w / 2 + w * 0.2, -h / 2 + w * 0.5, w * 0.2);
    suitPath(ctx, card.suit, 0, h * 0.06, w * 0.55);
    ctx.save();
    ctx.rotate(Math.PI);
    ctx.fillText(card.rank, -w / 2 + w * 0.2, -h / 2 + w * 0.3);
    ctx.restore();
  }
  ctx.restore();
}
function pillLabel(ctx, x, y, text, color) {
  ctx.font = "18px CardBold";
  const w = ctx.measureText(text).width + 28;
  rr(ctx, x - w / 2, y - 15, w, 30, 15);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 6);
}
// state : { dealer:[cards], player:[cards], hideDealer, dealerValue, playerValue, bet, result:{text, win} }
function blackjackImage(state) {
  const W = 720, H = 440, c = createCanvas(W, H), ctx = c.getContext("2d");
  const felt = ctx.createRadialGradient(W / 2, H * 0.3, 40, W / 2, H / 2, W * 0.7);
  felt.addColorStop(0, "#15803d");
  felt.addColorStop(1, "#052e16");
  ctx.fillStyle = felt;
  ctx.fillRect(0, 0, W, H);
  // bord en cuir et arc doré
  ctx.lineWidth = 26;
  ctx.strokeStyle = "#3f1d0b";
  ctx.beginPath();
  ctx.arc(W / 2, -260, 620, 0.3 * Math.PI, 0.7 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(253,230,138,0.6)";
  ctx.beginPath();
  ctx.arc(W / 2, -260, 560, 0.33 * Math.PI, 0.67 * Math.PI);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "rgba(253,230,138,0.75)";
  spaced(ctx, "BLACKJACK PAIE 6 POUR 5 · LE CROUPIER TIRE JUSQU'À 17", W / 2, 236, 2);
  goldFrame(ctx, W, H, 18);
  const CW = 82, CH = 118;
  const row = (cards, y, hideSecond) => {
    const n = cards.length, total = n * (CW - 20) + 20, x0 = W / 2 - total / 2;
    cards.forEach((card, i) => playingCard(ctx, card, x0 + i * (CW - 20), y, CW, CH, hideSecond && i === 1, (i - (n - 1) / 2) * 0.05));
  };
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, "CROUPIER", W / 2, 34, 4);
  row(state.dealer, 46, state.hideDealer);
  if (!state.hideDealer) pillLabel(ctx, W / 2 + 170, 106, String(state.dealerValue), state.dealerValue > 21 ? "#b91c1c" : "#1f2937");
  row(state.player, 262, false);
  pillLabel(ctx, W / 2 + 170, 322, String(state.playerValue), state.playerValue > 21 ? "#b91c1c" : state.playerValue === 21 ? "#a16207" : "#1f2937");
  // jetons de la mise
  for (let k = 0; k < Math.min(8, 2 + Math.floor(Math.log10(Math.max(10, state.bet)))); k++) {
    disc(ctx, 120, 340 - k * 6, 26, ["#b91c1c", "#1d4ed8", "#15803d", "#111827"][k % 4]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(120, 340 - k * 6, 20, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = "18px CardBold";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(state.betText ?? "", 120, 392);
  ctx.font = "16px CardEngrave";
  spaced(ctx, "VOUS", W / 2, 420, 4);
  if (state.result) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 188, W, 64);
    bigText(ctx, state.result.title, W / 2, 236, 40, state.result.win ? "#22c55e" : state.result.push ? "#94a3b8" : "#ef4444");
  }
  return c.encode("png");
}

// --- Roue de la fortune ---
// segments : [{ label, color }] ; index : segment gagnant
async function fortuneWheelGif(segments, index, title = "ROUE DE LA FORTUNE") {
  const W = 640, H = 460, cx = 320, cy = 250, R = 180, frames = 44, shots = [];
  const n = segments.length, seg = TAU / n;
  const end = 5 * TAU + (TAU - (index * seg + seg / 2)) + (Math.random() - 0.5) * seg * 0.6;
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const t = Math.min(1, f / (frames - 10)), a = end * ease.outQuint(t);
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    velvet(ctx, W, H, "#2e1065");
    goldFrame(ctx, W, H);
    bulbs(ctx, W, H, f, 10);
    neonText(ctx, title, W / 2, 46, 26, "#c4b5fd", "CardEngrave");
    glow(ctx, cx, cy, R * 1.5, "#fbbf24", 0.2);
    disc(ctx, cx, cy, R + 16, goldGradient(ctx, cx - R, cy - R, cx + R, cy + R));
    for (let k = 0; k < n; k++) {
      const a0 = a + k * seg - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, a0, a0 + seg);
      ctx.closePath();
      ctx.fillStyle = segments[k].color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy);
      const mid = (((a0 + seg / 2) % TAU) + TAU) % TAU, flip = mid > Math.PI / 2 && mid < (3 * Math.PI) / 2;
      ctx.rotate(a0 + seg / 2 + (flip ? Math.PI : 0));
      ctx.textAlign = flip ? "left" : "right";
      ctx.font = "17px CardBold";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 4;
      ctx.fillText(segments[k].label, flip ? -(R - 14) : R - 14, 6);
      ctx.restore();
    }
    for (let k = 0; k < n; k++) {
      const ang = a + k * seg - Math.PI / 2;
      disc(ctx, cx + Math.cos(ang) * (R + 8), cy + Math.sin(ang) * (R + 8), 4, "#fffbeb");
    }
    disc(ctx, cx, cy, 30, goldGradient(ctx, cx - 30, cy - 30, cx + 30, cy + 30));
    disc(ctx, cx, cy, 22, "#3b0764");
    // flèche
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(cx, cy - R + 18);
    ctx.lineTo(cx - 18, cy - R - 24);
    ctx.lineTo(cx + 18, cy - R - 24);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#fde68a";
    ctx.stroke();
    if (t >= 1) {
      const q = Math.min(1, (f - (frames - 10)) / 4);
      bigText(ctx, segments[index].label, cx, H - 22, 36, "#fbbf24", 1.2 - 0.2 * ease.back(q), q * 2);
    }
    shots.push(snap(c, f === frames - 1 ? 5000 : t < 0.6 ? 45 : 70));
  }
  return encodeGif(shots);
}

// --- Crash : la fusée de la Maison ---
async function crashImage(mult, crashed, history = [], cashouts = []) {
  const W = 720, H = 360, c = createCanvas(W, H), ctx = c.getContext("2d");
  velvet(ctx, W, H, crashed ? "#3b0a0a" : "#0c1a3a");
  goldFrame(ctx, W, H);
  const X0 = 60, Y0 = H - 50, GW = W - 120, GH = H - 120;
  const maxM = Math.max(2, mult * 1.15);
  // grille
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  ctx.font = "13px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  for (let k = 1; k <= 4; k++) {
    const m = 1 + ((maxM - 1) * k) / 4, y = Y0 - ((m - 1) / (maxM - 1)) * GH;
    ctx.beginPath();
    ctx.moveTo(X0, y);
    ctx.lineTo(X0 + GW, y);
    ctx.stroke();
    ctx.fillText(`x${m.toFixed(1)}`, X0 - 46, y + 4);
  }
  // courbe exponentielle
  const pts = [];
  for (let k = 0; k <= 60; k++) {
    const m = 1 + (mult - 1) * (k / 60) ** 2;
    pts.push([X0 + (k / 60) * GW * Math.min(1, 0.35 + mult / 8), Y0 - ((m - 1) / (maxM - 1)) * GH]);
  }
  const g = ctx.createLinearGradient(X0, 0, X0 + GW, 0);
  g.addColorStop(0, "#22d3ee");
  g.addColorStop(1, crashed ? "#ef4444" : "#f472b6");
  ctx.lineWidth = 6;
  ctx.strokeStyle = g;
  ctx.lineJoin = "round";
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.lineTo(pts.at(-1)[0], Y0);
  ctx.lineTo(X0, Y0);
  ctx.closePath();
  ctx.fillStyle = crashed ? "rgba(239,68,68,0.12)" : "rgba(34,211,238,0.1)";
  ctx.fill();
  // la fusée (ou l'explosion)
  const [tx, ty] = pts.at(-1);
  if (crashed) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU;
      ctx.strokeStyle = k % 2 ? "#fbbf24" : "#ef4444";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tx + Math.cos(a) * 12, ty + Math.sin(a) * 12);
      ctx.lineTo(tx + Math.cos(a) * 46, ty + Math.sin(a) * 46);
      ctx.stroke();
    }
    glow(ctx, tx, ty, 80, "#f97316", 0.8);
  } else {
    const rocket = await fluent("Rocket");
    glow(ctx, tx, ty, 50, "#f472b6", 0.6);
    if (rocket) ctx.drawImage(rocket, tx - 30, ty - 34, 60, 60);
  }
  // multiplicateur
  ctx.textAlign = "center";
  bigText(ctx, `x${mult.toFixed(2)}`, W / 2, 86, 64, crashed ? "#ef4444" : "#22d3ee");
  if (crashed) {
    ctx.font = "22px CardEngrave";
    ctx.fillStyle = "#fecaca";
    spaced(ctx, "LA FUSÉE A EXPLOSÉ", W / 2, 124, 4);
  }
  // encaissements
  ctx.textAlign = "left";
  ctx.font = "14px CardBold";
  cashouts.slice(-5).forEach((co, k) => {
    ctx.fillStyle = "#4ade80";
    ctx.fillText(`${co.name} encaisse à x${co.at.toFixed(2)}`.slice(0, 34), 76, 150 + k * 20);
  });
  // historique
  history.slice(-8).forEach((h, k) => {
    const x = 70 + k * 74;
    rr(ctx, x, 22, 64, 24, 12);
    ctx.fillStyle = h >= 2 ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillText(`x${h.toFixed(2)}`, x + 32, 39);
  });
  return c.encode("jpeg", 88);
}

// --- Courses de chevaux ---
// horses : [{ name, color, odds }] ; order : index des chevaux, du premier au dernier
async function raceGif(horses, order) {
  const W = 800, LH = 56, H = 120 + horses.length * LH + 30, frames = 52, shots = [];
  const horse = await fluent("Horse");
  const startX = 70, finishX = W - 150;
  // trajectoire de chaque cheval : vitesse variable, arrivée selon l'ordre décidé
  const R = seeded(Date.now() % 100000);
  const plan = horses.map((_, i) => {
    const rank = order.indexOf(i);
    const finishFrame = 36 + rank * 2 + R() * 1.5;
    const wobble = [R() * TAU, R() * TAU, 0.08 + R() * 0.1];
    return { finishFrame, wobble };
  });
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#14532d");
    sky.addColorStop(1, "#052e16");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    goldFrame(ctx, W, H, 16);
    neonText(ctx, "GRAND PRIX DE LA MAISON", W / 2, 50, 28, "#fde68a", "CardEngrave");
    // pistes
    horses.forEach((h, i) => {
      const y = 90 + i * LH;
      ctx.fillStyle = i % 2 ? "#a16207" : "#b45309";
      ctx.fillRect(30, y, W - 60, LH - 6);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(30, y + LH - 6);
      ctx.lineTo(W - 30, y + LH - 6);
      ctx.stroke();
      ctx.setLineDash([]);
    });
    // ligne d'arrivée en damier
    for (let k = 0; k < (horses.length * LH) / 10; k++) {
      ctx.fillStyle = k % 2 ? "#ffffff" : "#111827";
      ctx.fillRect(finishX + 40, 90 + k * 10, 10, 10);
      ctx.fillStyle = k % 2 ? "#111827" : "#ffffff";
      ctx.fillRect(finishX + 50, 90 + k * 10, 10, 10);
    }
    const lastFinish = Math.max(...plan.map((p) => p.finishFrame));
    horses.forEach((h, i) => {
      const p = plan[i], q = Math.min(1, f / p.finishFrame);
      if (f >= p.finishFrame) {
        const rank = order.indexOf(i) + 1, y = 90 + i * LH + (LH - 6) / 2;
        disc(ctx, finishX + 80, y, 15, rank === 1 ? "#fbbf24" : rank === 2 ? "#e5e7eb" : rank === 3 ? "#d97706" : "#334155");
        ctx.fillStyle = rank <= 3 ? "#111827" : "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "15px CardBold";
        ctx.fillText(String(rank), finishX + 80, y + 5);
      }
      const prog = ease.inOut(q) + Math.sin(f * p.wobble[2] + p.wobble[0]) * 0.025 * (1 - q) * q * 4;
      const x = startX + (finishX - startX) * Math.min(1, prog), y = 90 + i * LH + (LH - 6) / 2;
      // dossard
      disc(ctx, x - 18, y, 13, h.color);
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.font = "14px CardBold";
      ctx.fillText(String(i + 1), x - 18, y + 5);
      if (horse) {
        ctx.save();
        ctx.translate(x + 18, y + Math.sin(f * 1.3 + i) * 3);
        ctx.scale(-1, 1);
        ctx.drawImage(horse, -24, -24, 48, 48);
        ctx.restore();
      }
      ctx.textAlign = "left";
      ctx.font = "13px CardBold";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(h.name, 36, 90 + i * LH + 16);
    });
    // podium final
    if (f > lastFinish + 1) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(10, 10, W - 20, 64);
      bigText(ctx, `VAINQUEUR : n°${order[0] + 1} ${horses[order[0]].name}`, W / 2, 56, 34, horses[order[0]].color);
    }
    shots.push(snap(c, f === frames - 1 ? 5000 : 70));
  }
  return encodeGif(shots);
}

// --- Bannière du casino ---
async function casinoBanner(jackpot, open) {
  const W = 1000, H = 300, c = createCanvas(W, H), ctx = c.getContext("2d");
  velvet(ctx, W, H, "#3b0a24");
  // rideaux
  for (const side of [0, 1]) {
    for (let k = 0; k < 6; k++) {
      const x = side ? W - 40 - k * 22 : k * 22;
      const g = ctx.createLinearGradient(x, 0, x + 22, 0);
      g.addColorStop(0, "#450a0a");
      g.addColorStop(0.5, "#991b1b");
      g.addColorStop(1, "#450a0a");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 22, H);
    }
  }
  bulbs(ctx, W, H, 1, 12);
  goldFrame(ctx, W, H);
  neonText(ctx, "CASINO", W / 2, 112, 92, NEON, "CardTitle");
  ctx.textAlign = "center";
  ctx.font = "24px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, "DE LA MAISON", W / 2, 152, 10);
  // compteur du jackpot
  rr(ctx, W / 2 - 220, 180, 440, 78, 18);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = goldGradient(ctx, W / 2 - 220, 180, W / 2 + 220, 258);
  ctx.stroke();
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spaced(ctx, "JACKPOT PROGRESSIF", W / 2, 204, 4);
  bigText(ctx, jackpot, W / 2, 246, 38, "#f59e0b");
  ctx.font = "16px CardBold";
  ctx.fillStyle = open ? "#4ade80" : "#f87171";
  disc(ctx, W / 2 - 46, 279, 6, open ? "#4ade80" : "#f87171");
  ctx.fillText(open ? "OUVERT" : "FERMÉ", W / 2 + 8, 285);
  return c.encode("jpeg", 88);
}

module.exports = { slotsGif, slotsGrid, rouletteGif, blackjackImage, fortuneWheelGif, crashImage, raceGif, casinoBanner, WHEEL_ORDER };
