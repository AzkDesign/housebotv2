// Le Grand Casino de la Maison : toutes les images et animations du casino, dans un style unique.
// Art déco façon Monaco : laque noire, or champagne, velours rubis, feutre émeraude, lampes de music-hall.
// Mêmes fonctions (et mêmes paramètres) que l'ancienne version de casino-visuels.js, qui les remplace par celles-ci.
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["playfair-display-700.ttf", "CardSerif"],
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
const GOLD = ["#fff6d5", "#f3d98b", "#d4a53c", "#9a6b1c", "#5a3a0a"];
const RUBY = "#9f1239", EMERALD = "#0d4d3a", IVORY = "#f6eedb", INK = "#0b0a0d";
const yieldLoop = () => new Promise((r) => setImmediate(r));
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = {
  out: (q) => 1 - (1 - q) ** 3,
  outQuint: (q) => 1 - (1 - q) ** 5,
  inOut: (q) => (q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2),
  back: (q) => 1 + 2.4 * (q - 1) ** 3 + 1.4 * (q - 1) ** 2,
};
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.round(clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
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
function gold(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD[3]);
  g.addColorStop(0.28, GOLD[1]);
  g.addColorStop(0.45, GOLD[0]);
  g.addColorStop(0.62, GOLD[2]);
  g.addColorStop(1, GOLD[4]);
  return g;
}
function spaced(ctx, text, x, y, gap) {
  const chars = [...text];
  const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (chars.length - 1);
  const align = ctx.textAlign;
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.textAlign = align;
  return total;
}
function fit(ctx, text, maxW, size, family) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (s > 10 && ctx.measureText(text).width > maxW) ctx.font = `${--s}px ${family}`;
  return s;
}
// texte doré en relief (ombre, dégradé, liseré clair)
function goldText(ctx, text, x, y, size, family = "CardTitle", gap = 0) {
  ctx.font = `${size}px ${family}`;
  const w = gap ? [...text].reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * ([...text].length - 1) : ctx.measureText(text).width;
  const x0 = ctx.textAlign === "center" ? x - w / 2 : x;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.25;
  gap ? spaced(ctx, text, x, y + size * 0.05, gap) : ctx.fillText(text, x, y + size * 0.05);
  ctx.restore();
  const tg = ctx.createLinearGradient(0, y - size * 0.8, 0, y + size * 0.12);
  tg.addColorStop(0, GOLD[0]);
  tg.addColorStop(0.42, GOLD[1]);
  tg.addColorStop(0.58, GOLD[2]);
  tg.addColorStop(1, "#b07a24");
  ctx.fillStyle = tg;
  gap ? spaced(ctx, text, x, y, gap) : ctx.fillText(text, x, y);
}
// texte lumineux (néon de music-hall)
function neon(ctx, text, x, y, size, color, family = "CardEngrave", gap = 0) {
  ctx.font = `${size}px ${family}`;
  ctx.save();
  for (const [blur, a] of [[size * 0.9, 0.55], [size * 0.35, 0.9]]) {
    ctx.shadowColor = rgba(color, a);
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    gap ? spaced(ctx, text, x, y, gap) : ctx.fillText(text, x, y);
  }
  ctx.restore();
  ctx.fillStyle = "#fffaf0";
  gap ? spaced(ctx, text, x, y, gap) : ctx.fillText(text, x, y);
}

// --- Ornements art déco ---
// éventail de rayons (soleil levant)
function sunburst(ctx, cx, cy, R, rays, color, alpha, a0 = Math.PI, a1 = TAU) {
  ctx.save();
  for (let i = 0; i < rays; i++) {
    const t0 = a0 + ((a1 - a0) * i) / rays, t1 = a0 + ((a1 - a0) * (i + 0.5)) / rays;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, t0, t1);
    ctx.closePath();
    ctx.fillStyle = rgba(color, alpha);
    ctx.fill();
  }
  ctx.restore();
}
// motif d'écailles en éventail, très discret, pour les fonds laqués
function scales(ctx, W, H, color, alpha, size = 34) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 1;
  for (let row = 0, y = 0; y < H + size; row++, y += size / 2) {
    for (let x = (row % 2) * (size / 2) - size; x < W + size; x += size) {
      for (const k of [1, 0.66, 0.33]) {
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, (size / 2) * k, Math.PI, TAU);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
function lacquer(ctx, W, H, tint = "#1a0f14", pattern = GOLD[2]) {
  const bg = ctx.createRadialGradient(W / 2, H * 0.32, 20, W / 2, H * 0.5, Math.max(W, H) * 0.85);
  bg.addColorStop(0, shade(tint, 0.12));
  bg.addColorStop(0.55, tint);
  bg.addColorStop(1, INK);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  scales(ctx, W, H, pattern, 0.045);
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.6)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}
function feltBg(ctx, W, H, color = EMERALD) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 30, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(0.6, color);
  g.addColorStop(1, shade(color, -0.65));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grain du feutre
  const R = seeded(W * 31 + H);
  for (let i = 0; i < (W * H) / 260; i++) {
    ctx.fillStyle = R() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.05)";
    ctx.fillRect(R() * W, R() * H, 1.5, 1.5);
  }
}
// quart de soleil dans un coin
function cornerFan(ctx, x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = gold(ctx, 0, 0, r, r);
  ctx.lineWidth = 1.6;
  for (const k of [1, 0.72, 0.44]) {
    ctx.beginPath();
    ctx.arc(0, 0, r * k, 0, Math.PI / 2);
    ctx.stroke();
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    ctx.lineTo(Math.cos(a) * r * 0.44, Math.sin(a) * r * 0.44);
    ctx.stroke();
  }
  ctx.restore();
}
function diamond(ctx, x, y, s, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.7, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.7, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
// cadre doré à redans, avec éventails dans les coins
function decoFrame(ctx, W, H, inset = 14) {
  const g = gold(ctx, 0, 0, W, H);
  ctx.strokeStyle = g;
  ctx.lineWidth = 3;
  rr(ctx, inset, inset, W - inset * 2, H - inset * 2, 6);
  ctx.stroke();
  ctx.lineWidth = 1;
  rr(ctx, inset + 8, inset + 8, W - (inset + 8) * 2, H - (inset + 8) * 2, 4);
  ctx.stroke();
  const f = 34;
  cornerFan(ctx, inset + 8, inset + 8, f, 0);
  cornerFan(ctx, W - inset - 8, inset + 8, f, Math.PI / 2);
  cornerFan(ctx, W - inset - 8, H - inset - 8, f, Math.PI);
  cornerFan(ctx, inset + 8, H - inset - 8, f, -Math.PI / 2);
  for (const [x, y] of [[W / 2, inset], [W / 2, H - inset], [inset, H / 2], [W - inset, H / 2]]) diamond(ctx, x, y, 7, g);
}
// filet doré horizontal avec losange central
function rule(ctx, cx, y, half, color = null) {
  ctx.strokeStyle = color ?? gold(ctx, cx - half, y, cx + half, y);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - half, y);
  ctx.lineTo(cx - 12, y);
  ctx.moveTo(cx + 12, y);
  ctx.lineTo(cx + half, y);
  ctx.stroke();
  diamond(ctx, cx, y, 6, color ?? gold(ctx, cx - 6, y - 6, cx + 6, y + 6));
}
// le blason du casino : un losange doré avec un « M »
function crest(ctx, x, y, s) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = s * 0.4;
  diamond(ctx, x, y, s, gold(ctx, x - s, y - s, x + s, y + s));
  ctx.restore();
  diamond(ctx, x, y, s * 0.82, INK);
  ctx.strokeStyle = gold(ctx, x - s, y - s, x + s, y + s);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.68);
  ctx.lineTo(x + s * 0.48, y);
  ctx.lineTo(x, y + s * 0.68);
  ctx.lineTo(x - s * 0.48, y);
  ctx.closePath();
  ctx.stroke();
  ctx.textAlign = "center";
  goldText(ctx, "M", x, y + s * 0.3, Math.round(s * 0.82), "CardEngrave");
}
// ampoules de music-hall le long d'un rectangle ; phase = numéro d'image (chenillard)
function bulbs(ctx, x, y, w, h, gapPx, phase, color = "#ffe9a8") {
  const pts = [];
  const per = 2 * (w + h), n = Math.floor(per / gapPx);
  for (let i = 0; i < n; i++) {
    let d = (i / n) * per;
    if (d < w) pts.push([x + d, y]);
    else if ((d -= w) < h) pts.push([x + w, y + d]);
    else if ((d -= h) < w) pts.push([x + w - d, y + h]);
    else pts.push([x, y + h - (d - w)]);
  }
  pts.forEach(([px, py], i) => {
    const on = (i + phase) % 3 !== 0;
    if (on) glow(ctx, px, py, 11, color, 0.55);
    disc(ctx, px, py, 3.4, on ? "#fffaf0" : "#6b5a3a");
    if (on) disc(ctx, px - 1, py - 1, 1.2, "#ffffff");
  });
}
// cartouche (plaque dorée) avec un texte
function plaque(ctx, cx, cy, w, h, fill = "rgba(10,8,12,0.88)") {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.22);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = gold(ctx, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  ctx.lineWidth = 2.5;
  rr(ctx, cx - w / 2, cy - h / 2, w, h, h * 0.22);
  ctx.stroke();
  ctx.lineWidth = 1;
  rr(ctx, cx - w / 2 + 6, cy - h / 2 + 6, w - 12, h - 12, h * 0.16);
  ctx.stroke();
}
// pluie de pièces d'or
function coinShower(ctx, W, H, t, seed, count = 46) {
  const R = seeded(seed);
  for (let i = 0; i < count; i++) {
    const x = R() * W, speed = 0.6 + R() * 0.8, y0 = -40 - R() * H, r = 6 + R() * 7;
    const y = y0 + t * H * 1.6 * speed;
    if (y < -20 || y > H + 20) continue;
    const squash = Math.abs(Math.cos(t * 9 * speed + i));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.max(0.15, squash), 1);
    disc(ctx, 0, 0, r, gold(ctx, -r, -r, r, r));
    ctx.strokeStyle = "rgba(90,58,10,0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}
function sparkle(ctx, x, y, s, color = "#fffaf0", a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? s * 0.18 : s;
    const ang = (i / 8) * TAU - Math.PI / 2;
    ctx[i ? "lineTo" : "moveTo"](x + Math.cos(ang) * r, y + Math.sin(ang) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- GIF ---
// une image du GIF ; scale < 1 réduit l image (GIF plus léger)
function snap(c, delay, scale = 1) {
  if (scale !== 1) {
    const w = Math.round(c.width * scale), h = Math.round(c.height * scale), s = createCanvas(w, h), x = s.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(c, 0, 0, w, h);
    c = s;
  }
  return { data: c.getContext("2d").getImageData(0, 0, c.width, c.height).data, width: c.width, height: c.height, delay };
}
function encodeGif(shots) {
  if (process.env.CASINO_FRAMES_DIR) debugFrames(shots);
  // palette commune tirée d'un échantillon de toutes les images (les dorés et les feutres restent fidèles)
  const step = 9, parts = [];
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
  const W = shots[0].width, H = shots[0].height, picks = [0.3, 0.62, 1].map((p) => shots[Math.min(shots.length - 1, Math.floor((shots.length - 1) * p))]);
  const c = createCanvas(W * 3, H), ctx = c.getContext("2d");
  picks.forEach((sh, i) => {
    const img = ctx.createImageData(W, H);
    img.data.set(sh.data);
    ctx.putImageData(img, i * W, 0);
  });
  require("fs").writeFileSync(path.join(process.env.CASINO_FRAMES_DIR, `luxe_${debugN++}.png`), c.toBuffer("image/png"));
}

// images Fluent en 3D (fruits, cloche, diamant, cheval, fusée…)
const imgCache = new Map();
async function fluent(name) {
  if (imgCache.has(name)) return imgCache.get(name);
  const file = name.toLowerCase().replace(/ /g, "_");
  const url = `https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/${encodeURIComponent(name)}/3D/${file}_3d.png`;
  const img = await fetch(url, { signal: AbortSignal.timeout(10000) })
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .then((b) => (b ? loadImage(Buffer.from(b)) : null))
    .catch(() => null);
  imgCache.set(name, img);
  return img;
}

module.exports = { TAU, GOLD, RUBY, EMERALD, IVORY, INK, ease, seeded, rgba, shade, rr, glow, disc, gold, spaced, fit, goldText, neon, sunburst, scales, lacquer, feltBg, cornerFan, diamond, decoFrame, rule, crest, bulbs, plaque, coinShower, sparkle, snap, encodeGif, fluent, yieldLoop, clamp };
