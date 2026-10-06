
// --- Blasons des équipes : de vrais badges d'arène, façon Japon ---
// Chaque emblème a sa forme de badge, ses couleurs, son motif japonais (vagues seigaiha, rayons, asanoha, étoiles),
// sa créature dessinée en autocollant anime (double contour, ombrage) et son sceau rouge (hanko) avec un kanji.
const CREST = {
  "🐉": { kanji: "龍", shape: "hex", pal: ["#fecaca", "#ef4444", "#3b0707"], motif: "seigaiha" },
  "🦁": { kanji: "獅", shape: "sun16", pal: ["#fde68a", "#f59e0b", "#3d1702"], motif: "rays" },
  "🐺": { kanji: "狼", shape: "sun8", pal: ["#e2e8f0", "#64748b", "#0b1120"], motif: "asanoha" },
  "🦅": { kanji: "鷲", shape: "diamond", pal: ["#fde68a", "#b45309", "#1c0d02"], motif: "rays" },
  "🦊": { kanji: "狐", shape: "star8", pal: ["#fed7aa", "#f97316", "#3b1105"], motif: "seigaiha" },
  "🐙": { kanji: "蛸", shape: "scallop", pal: ["#fbcfe8", "#ec4899", "#45061f"], motif: "seigaiha" },
  "🔥": { kanji: "炎", shape: "drop", pal: ["#fecdd3", "#f43f5e", "#42040f"], motif: "rays" },
  "⚡": { kanji: "雷", shape: "star5", pal: ["#fef9c3", "#eab308", "#3a1d03"], motif: "rays" },
  "🌙": { kanji: "月", shape: "circle", pal: ["#e0e7ff", "#818cf8", "#16123f"], motif: "stars" },
  "💎": { kanji: "宝", shape: "oct", pal: ["#cffafe", "#22d3ee", "#062a33"], motif: "asanoha" },
  "👑": { kanji: "王", shape: "star6", pal: ["#fef3c7", "#fbbf24", "#3d1702"], motif: "rays" },
  "🛡️": { kanji: "盾", shape: "shield", pal: ["#dbeafe", "#60a5fa", "#121e45"], motif: "asanoha" },
};
const crestCache = new Map();

function starPath(p, cx, cy, n, r, inner, rot = -Math.PI / 2) {
  for (let k = 0; k < n * 2; k++) {
    const a = rot + (k * Math.PI) / n, rr = k % 2 ? r * inner : r;
    if (k === 0) p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    else p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath();
}
function crestPath(shape, cx, cy, r) {
  const p = new Path2D();
  const poly = (n, rot) => starPath(p, cx, cy, n / 2, r, 1, rot);
  if (shape === "hex") poly(6, -Math.PI / 2);
  else if (shape === "oct") poly(8, -Math.PI / 2 + Math.PI / 8);
  else if (shape === "diamond") {
    p.moveTo(cx, cy - r);
    p.lineTo(cx + r * 0.92, cy);
    p.lineTo(cx, cy + r);
    p.lineTo(cx - r * 0.92, cy);
    p.closePath();
  } else if (shape === "sun16") starPath(p, cx, cy, 16, r, 0.86);
  else if (shape === "sun8") starPath(p, cx, cy, 8, r, 0.8, -Math.PI / 2 + Math.PI / 8);
  else if (shape === "star8") starPath(p, cx, cy, 8, r, 0.72);
  else if (shape === "star6") starPath(p, cx, cy, 6, r, 0.7);
  else if (shape === "star5") starPath(p, cx, cy, 5, r * 1.06, 0.6);
  else if (shape === "scallop") {
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU, x = cx + Math.cos(a) * r * 0.86, y = cy + Math.sin(a) * r * 0.86;
      p.moveTo(x + r * 0.2, y);
      p.arc(x, y, r * 0.2, 0, TAU);
    }
    p.moveTo(cx + r * 0.88, cy);
    p.arc(cx, cy, r * 0.88, 0, TAU);
  } else if (shape === "drop") {
    p.moveTo(cx, cy - r * 1.05);
    p.bezierCurveTo(cx + r * 0.35, cy - r * 0.55, cx + r * 0.95, cy - r * 0.05, cx + r * 0.88, cy + r * 0.32);
    p.bezierCurveTo(cx + r * 0.78, cy + r * 0.82, cx + r * 0.38, cy + r, cx, cy + r);
    p.bezierCurveTo(cx - r * 0.38, cy + r, cx - r * 0.78, cy + r * 0.82, cx - r * 0.88, cy + r * 0.32);
    p.bezierCurveTo(cx - r * 0.95, cy - r * 0.05, cx - r * 0.35, cy - r * 0.55, cx, cy - r * 1.05);
    p.closePath();
  } else if (shape === "shield") {
    p.moveTo(cx - r * 0.86, cy - r * 0.86);
    p.quadraticCurveTo(cx, cy - r * 1.04, cx + r * 0.86, cy - r * 0.86);
    p.lineTo(cx + r * 0.86, cy - r * 0.1);
    p.bezierCurveTo(cx + r * 0.86, cy + r * 0.5, cx + r * 0.4, cy + r * 0.82, cx, cy + r * 1.02);
    p.bezierCurveTo(cx - r * 0.4, cy + r * 0.82, cx - r * 0.86, cy + r * 0.5, cx - r * 0.86, cy - r * 0.1);
    p.closePath();
  } else p.arc(cx, cy, r, 0, TAU);
  return p;
}
// motifs japonais (dessinés dans le cœur du badge)
function crestMotif(ctx, motif, cx, cy, R, pal) {
  // rayons de fond, toujours un peu présents
  ctx.save();
  ctx.translate(cx, cy - R * 0.05);
  const rays = motif === "rays" ? 28 : 18;
  for (let i = 0; i < rays; i++) {
    ctx.rotate(TAU / rays);
    ctx.fillStyle = rgba(pal[0], motif === "rays" ? (i % 2 ? 0.05 : 0.16) : 0.05);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-R * 0.13, -R * 1.3);
    ctx.lineTo(R * 0.13, -R * 1.3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  if (motif === "seigaiha") {
    const r0 = R * 0.16, top = cy + R * 0.12;
    for (let row = 0, y = top; y < cy + R * 1.3; row++, y += r0 * 0.55) {
      for (let x = cx - R * 1.2 + (row % 2 ? r0 : 0); x < cx + R * 1.2; x += r0 * 2) {
        ctx.beginPath();
        ctx.arc(x, y, r0, Math.PI, 0);
        ctx.lineTo(x + r0, y + r0);
        ctx.lineTo(x - r0, y + r0);
        ctx.closePath();
        ctx.fillStyle = rgba(pal[2], 0.62);
        ctx.fill();
        for (const f of [1, 0.72, 0.44]) {
          ctx.beginPath();
          ctx.arc(x, y, r0 * f, Math.PI, 0);
          ctx.strokeStyle = rgba(pal[0], 0.32);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  } else if (motif === "asanoha") {
    const s = R * 0.22, h = s * Math.sin(Math.PI / 3);
    ctx.strokeStyle = rgba(pal[0], 0.13);
    ctx.lineWidth = 1.6;
    for (let row = -8; row <= 8; row++) {
      for (let col = -8; col <= 8; col++) {
        const x = cx + col * s + (row % 2 ? s / 2 : 0), y = cy + row * h;
        // étoile à six branches de l'asanoha (feuille de chanvre)
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 + Math.PI / 6;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * s * 0.577, y + Math.sin(a) * s * 0.577);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y);
        ctx.lineTo(x + s / 2, y + h);
        ctx.moveTo(x, y);
        ctx.lineTo(x - s / 2, y + h);
        ctx.stroke();
      }
    }
  } else if (motif === "stars") {
    const rnd = seeded(77);
    for (let i = 0; i < 46; i++) sparkle(ctx, cx + (rnd() - 0.5) * R * 2, cy + (rnd() - 0.5) * R * 2, 2 + rnd() * 6, rgba(pal[0], 0.35 + rnd() * 0.5));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.62, 0, TAU);
    ctx.strokeStyle = rgba(pal[0], 0.18);
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}
// cercle zen (ensō) tracé au pinceau, derrière la créature
function drawEnso(ctx, cx, cy, r, color, seed) {
  const rnd = seeded(seed);
  const a0 = -Math.PI * 0.35 + rnd() * 0.4, span = Math.PI * 1.78;
  for (let k = 0; k <= 160; k++) {
    const t = k / 160, a = a0 + t * span;
    const w = r * (0.05 + 0.13 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35));
    const rr = r * (1 + Math.sin(t * 9 + seed) * 0.015);
    disc(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w, color);
  }
  // poils du pinceau
  for (let b = 0; b < 7; b++) {
    const off = (rnd() - 0.5) * r * 0.2, len = 0.55 + rnd() * 0.4;
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const t = (k / 60) * len, a = a0 + (1 - len) * span + t * span;
      const x = cx + Math.cos(a) * (r + off), y = cy + Math.sin(a) * (r + off);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5 + rnd() * 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // éclaboussures d'encre
  for (let i = 0; i < 9; i++) {
    const a = a0 + span + rnd() * 0.5, d = r * (1 + (rnd() - 0.3) * 0.25);
    disc(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1 + rnd() * r * 0.03, color);
  }
}
function sparkle(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.fill();
}
// créature en autocollant anime : contour sombre, contour blanc, couleurs relevées, ombrage en aplat
function drawSticker(ctx, img, cx, cy, size, pal) {
  const s = Math.round(size), pad = 40, W = s + pad * 2;
  const layer = (fill) => {
    const c = createCanvas(W, W), x = c.getContext("2d");
    x.drawImage(img, pad, pad, s, s);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = fill;
    x.fillRect(0, 0, W, W);
    return c;
  };
  const dark = layer("#0a0712"), white = layer("#ffffff");
  // créature ombrée
  const body = createCanvas(W, W), b = body.getContext("2d");
  b.filter = "saturate(1.35) contrast(1.1)";
  b.drawImage(img, pad, pad, s, s);
  b.filter = "none";
  b.globalCompositeOperation = "source-atop";
  const shade = b.createLinearGradient(pad, pad, pad + s, pad + s);
  shade.addColorStop(0, "rgba(255,255,255,0.22)");
  shade.addColorStop(0.5, "rgba(255,255,255,0)");
  shade.addColorStop(0.62, rgba(pal[2], 0.28));
  shade.addColorStop(1, rgba(pal[2], 0.45));
  b.fillStyle = shade;
  b.fillRect(0, 0, W, W);
  const out = createCanvas(W, W), o = out.getContext("2d");
  const ring = (src, r) => {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      o.drawImage(src, Math.cos(a) * r, Math.sin(a) * r);
    }
  };
  ring(dark, size * 0.05);
  ring(white, size * 0.03);
  o.drawImage(body, 0, 0);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.drawImage(out, cx - W / 2, cy - W / 2);
  ctx.restore();
}
// sceau rouge (hanko) avec le kanji de l'équipe
function drawHanko(ctx, x, y, r, kanji) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.14);
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 8;
  roundRect(ctx, -r, -r, r * 2, r * 2, r * 0.28);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, "#e11d48");
  g.addColorStop(1, "#9f1239");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowBlur = 0;
  roundRect(ctx, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.18);
  ctx.strokeStyle = "rgba(255,241,242,0.85)";
  ctx.lineWidth = r * 0.07;
  ctx.stroke();
  ctx.fillStyle = "#fff1f2";
  ctx.textAlign = "center";
  ctx.font = `${Math.round(r * 1.25)}px CardKanji`;
  ctx.fillText(kanji, 0, r * 0.43);
  // grain de l'encre
  const rnd = seeded(hashOf(kanji));
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 70; i++) disc(ctx, (rnd() - 0.5) * r * 2, (rnd() - 0.5) * r * 2, rnd() * r * 0.05, "rgba(0,0,0,0.55)");
  ctx.restore();
}
async function drawTeamCrest(emoji) {
  if (crestCache.has(emoji)) return crestCache.get(emoji);
  const d = CREST[emoji] ?? CREST["🛡️"];
  const S = 512, cx = 256, cy = 250, R = 190;
  const c = createCanvas(S, S);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const outer = crestPath(d.shape, cx, cy, R), band = crestPath(d.shape, cx, cy, R * 0.9), core = crestPath(d.shape, cx, cy, R * 0.81), mid = crestPath(d.shape, cx, cy, R * 0.855);
  // halo et ombre
  ctx.save();
  ctx.shadowColor = rgba(d.pal[1], 0.75);
  ctx.shadowBlur = 44;
  ctx.fillStyle = d.pal[2];
  ctx.fill(outer);
  ctx.restore();
  // monture en métal doré
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = metalGradient(ctx, S, S, METAL.legendaire);
  ctx.fill(outer);
  ctx.restore();
  ctx.strokeStyle = "rgba(70,35,0,0.7)";
  ctx.lineWidth = 3;
  ctx.stroke(outer);
  // bande sombre et clous
  ctx.fillStyle = d.pal[2];
  ctx.fill(band);
  ctx.setLineDash([1, 13]);
  ctx.lineCap = "round";
  ctx.strokeStyle = rgba(d.pal[0], 0.9);
  ctx.lineWidth = 5;
  ctx.stroke(mid);
  ctx.setLineDash([]);
  ctx.lineCap = "butt";
  // cœur coloré, motif et kanji en filigrane
  ctx.save();
  ctx.clip(core);
  const g = ctx.createRadialGradient(cx, cy - R * 0.35, 10, cx, cy, R * 0.95);
  g.addColorStop(0, d.pal[0]);
  g.addColorStop(0.38, d.pal[1]);
  g.addColorStop(1, d.pal[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  crestMotif(ctx, d.motif, cx, cy, R, d.pal);
  ctx.font = `${Math.round(R * 1.3)}px CardBrush`;
  ctx.textAlign = "center";
  ctx.fillStyle = rgba(d.pal[2], 0.22);
  ctx.fillText(d.kanji, cx, cy + R * 0.42);
  drawEnso(ctx, cx, cy - R * 0.04, R * 0.7, rgba(d.pal[2], 0.82), hashOf(d.kanji) % 97);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2.5;
  ctx.stroke(core);
  // la créature
  const art = await emblemImage(emoji);
  if (art) drawSticker(ctx, art, cx, cy - R * 0.08, R * 1.16, d.pal);
  // reflet du badge
  ctx.save();
  ctx.clip(core);
  const gl = ctx.createLinearGradient(0, cy - R, 0, cy - R * 0.1);
  gl.addColorStop(0, "rgba(255,255,255,0.3)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.ellipse(cx - R * 0.18, cy - R * 0.58, R * 0.78, R * 0.36, -0.32, 0, TAU);
  ctx.fill();
  ctx.restore();
  // sceau et étincelles
  drawHanko(ctx, cx + R * 0.66, cy + R * 0.64, R * 0.27, d.kanji);
  for (const [x, y, s] of [[-0.78, -0.7, 16], [0.82, -0.58, 11], [-0.9, 0.2, 9], [0.62, -0.92, 7]]) sparkle(ctx, cx + R * x, cy + R * y, s, "rgba(255,250,235,0.95)");
  crestCache.set(emoji, c);
  return c;
}
async function crestFile(emoji, name = "blason.png", size = 256) {
  const src = await drawTeamCrest(emoji);
  const c = createCanvas(size, size);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, size, size);
  return new AttachmentBuilder(await c.encode("png"), { name });
}
