// --- Révélation animée des cartes (de la plus faible à la meilleure) ---
// Plus la carte est rare, plus l'attente est longue et l'explosion spectaculaire.
const REVEAL = {
  frames: [16, 18, 22, 26, 30, 34],
  pre: [3, 4, 6, 8, 10, 12],
  flash: [0, 0.18, 0.32, 0.5, 0.75, 0.95],
  burst: [0, 12, 24, 40, 64, 96],
  hold: [700, 900, 1200, 1600, 2200, 2700],
};
function revealDuration(card) {
  const r = ORDER.indexOf(card.rarity);
  return REVEAL.frames[r] * 55 + REVEAL.hold[r];
}
function glowHsl(ctx, x, y, rad, hue, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
  g.addColorStop(0, `hsla(${hue},90%,62%,${a})`);
  g.addColorStop(1, `hsla(${hue},90%,62%,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
}
function pill(ctx, x, y, text, bg, fg) {
  const w = ctx.measureText(text).width + 30;
  roundRect(ctx, x - w / 2, y - 13, w, 26, 13);
  if (bg === "rainbow") {
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    ["#ff0080", "#ffe600", "#00e676", "#00b0ff", "#d500f9"].forEach((c, i) => g.addColorStop(i / 4, c));
    ctx.fillStyle = g;
  } else ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.fillText(text, x, y + 5);
  return w;
}
async function revealGif(p, index, total) {
  const { card, holo, isNew } = p;
  const r = card.shiny ? ORDER.indexOf("legendaire") : ORDER.indexOf(card.rarity), m = METAL[card.rarity], rc = card.shiny ? "#34d399" : m[4];
  const RW = 480, RH = 720, FW = 330, FH = 462, cx = RW / 2, cy = 318;
  const N = REVEAL.frames[r], pre = REVEAL.pre[r], flipLen = 6, fr0 = pre + 3;
  const back = p.back ? await drawCardBack(p.back) : drawBack("legendaire");
  const mode = animMode(card, holo);
  const R0 = seeded(hashOf(card.id) + index * 31 + 7);
  const sparks = Array.from({ length: REVEAL.burst[r] }, () => ({ a: R0() * TAU, v: 9 + R0() * 16, s: 1.5 + R0() * 3.5, c: R0() }));
  const rain = Array.from({ length: 34 }, () => ({ x: R0() * RW, o: R0() * RH, s: 1 + R0() * 2.4 }));
  const shots = [];
  for (let f = 0; f < N; f++) {
    await yieldLoop();
    const c = createCanvas(RW, RH);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#313338";
    ctx.fillRect(0, 0, RW, RH);
    const after = f >= fr0, since = f - fr0, charge = Math.min(1, f / Math.max(1, pre));

    // Ambiance lumineuse : elle monte pendant l'attente puis explose à la révélation
    const level = after ? 0.2 + 0.08 * r + Math.max(0, 0.45 - since * 0.05) : charge * 0.07 * r;
    if (r >= 5 && after) glowHsl(ctx, cx, cy, 360, (since * 18) % 360, Math.min(0.8, level));
    else if (level > 0.01) glow(ctx, cx, cy, 320, rc, Math.min(0.85, level));
    if (after && r >= 3) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(since * 0.045);
      for (let i = 0; i < 18; i++) {
        ctx.rotate(TAU / 18);
        ctx.fillStyle = r >= 5 ? `hsla(${(i * 20 + since * 18) % 360},90%,65%,0.16)` : rgba(rc, 0.09 + 0.02 * r);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-26, -560);
        ctx.lineTo(26, -560);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    // énergie qui converge vers la carte avant la révélation (épique et plus)
    if (!after && r >= 3) {
      for (let k = 0; k < 26; k++) {
        const a = (k / 26) * TAU + f * 0.12, d = 270 * (1 - f / fr0) + 40;
        ctx.globalAlpha = Math.min(1, f / fr0 + 0.2);
        sparkle(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, 2 + (k % 3), k % 2 ? "#ffffff" : rc);
      }
      ctx.globalAlpha = 1;
    }
    // ondes de choc
    if (after && r >= 2) {
      for (const off of r >= 5 ? [0, 3, 6] : r >= 4 ? [0, 3] : [0]) {
        const q = since - off;
        if (q < 0 || q >= 10) continue;
        ctx.strokeStyle = r >= 5 ? `hsla(${(q * 40 + off * 30) % 360},90%,70%,${(1 - q / 10) * 0.9})` : rgba(rc, (1 - q / 10) * 0.9);
        ctx.lineWidth = 9 * (1 - q / 10) + 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 70 + q * 50, (70 + q * 50) * 0.92, 0, 0, TAU);
        ctx.stroke();
      }
    }

    // La carte : attente (dos), retournement, puis la face qui se stabilise
    let angle, lift = 0, k = 1, t = 0.3, dx = 0;
    if (f < pre) {
      angle = Math.PI + Math.sin(f * 1.7) * 0.025 * r * charge;
      dx = r >= 2 ? Math.sin(f * 2.4) * r * 1.3 * charge : 0;
      lift = Math.sin(charge * Math.PI * 0.5) * (2 + r * 2);
    } else if (f < pre + flipLen) {
      const q = (f - pre + 1) / flipLen, e = 1 - (1 - q) ** 2;
      angle = Math.PI + e * Math.PI;
      lift = Math.sin(q * Math.PI) * 26 + (1 - q) * (2 + r * 2);
      k = 1 + Math.sin(q * Math.PI) * 0.07;
    } else {
      const s = f - pre - flipLen;
      angle = Math.sin(s * 0.9) * 0.15 * Math.exp(-s * 0.32);
      t = (s / 14) % 1;
    }
    const showFace = Math.cos(angle) >= 0;
    const img = showFace ? await drawCard(card, holo, t, mode) : back;
    projectCard(c, img, angle, "h", cx + dx, cy - lift, FW * k, FH * k, showFace ? m[3] : METAL.legendaire[3], cy + FH / 2 + 34, lift);

    // éclair blanc, gerbe d'étincelles, pluie dorée, éclairs, anneau holo
    if (after && REVEAL.flash[r]) {
      const a = REVEAL.flash[r] * Math.max(0, 1 - since / 4);
      if (a > 0) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, RW, RH);
      }
    }
    if (after) {
      for (const pt of sparks) {
        const d = since * pt.v, al = Math.max(0, 1 - since / 16);
        if (al <= 0) continue;
        ctx.globalAlpha = al;
        sparkle(ctx, cx + Math.cos(pt.a) * d, cy + Math.sin(pt.a) * d * 0.85 + since * since * 0.6, pt.s, r >= 5 ? `hsl(${(pt.c * 360 + since * 20) % 360},95%,72%)` : pt.c < 0.5 ? "#ffffff" : rc);
      }
      ctx.globalAlpha = 1;
    }
    if (after && r >= 4) {
      for (const d of rain) {
        const y = ((d.o + since * 14) % (RH + 40)) - 20;
        ctx.globalAlpha = 0.85;
        sparkle(ctx, d.x + Math.sin(since * 0.3 + d.o) * 6, y, d.s, r >= 5 ? "#f5d0fe" : "#fde68a");
      }
      ctx.globalAlpha = 1;
    }
    if (after && r >= 5 && since % 6 < 2) {
      ctx.save();
      ctx.strokeStyle = "#f5d0fe";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 18;
      const RB = seeded(f * 13 + 5);
      for (let b = 0; b < 3; b++) {
        const a = RB() * TAU;
        let x = cx + Math.cos(a) * 150, y = cy + Math.sin(a) * 210;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 6; s++) {
          x += Math.cos(a) * 24 + (RB() - 0.5) * 30;
          y += Math.sin(a) * 24 + (RB() - 0.5) * 30;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    if (after && holo) {
      ctx.lineWidth = 4;
      for (let i = 0; i < 36; i++) {
        ctx.strokeStyle = `hsla(${(i * 10 + since * 24) % 360},95%,65%,0.7)`;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 262, 300, 0, (i / 36) * TAU, ((i + 0.8) / 36) * TAU);
        ctx.stroke();
      }
    }

    // Textes : compteur, rareté qui surgit, pastilles
    ctx.textAlign = "center";
    ctx.font = "16px CardEngrave";
    ctx.fillStyle = "#cbb9a9";
    spaced(ctx, `CARTE ${index + 1} / ${total}`, cx, 36, 3);
    for (let i = 0; i < total; i++) {
      diamond(ctx, cx + (i - (total - 1) / 2) * 18, 56, 5);
      if (i < index || (i === index && after)) {
        ctx.fillStyle = "#fbbf24";
        ctx.fill();
      } else {
        ctx.strokeStyle = "#71717a";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    if (after && since >= 1) {
      const pop = Math.max(1, 1.6 - (since - 1) * 0.14);
      ctx.save();
      ctx.translate(cx, 640);
      ctx.scale(pop, pop);
      ctx.font = "38px CardEngrave";
      ctx.shadowColor = r >= 5 ? "#c084fc" : rc;
      ctx.shadowBlur = 14 + r * 4;
      ctx.fillStyle = r >= 5 ? `hsl(${(since * 25) % 360},90%,72%)` : m[0];
      spaced(ctx, RARITIES[card.rarity].name.toUpperCase() + (r >= 3 ? " !" : ""), 0, 0, 4);
      ctx.restore();
      const tags = [isNew ? ["NOUVELLE CARTE", "#fbbf24", "#2a1305"] : ["DOUBLON", "#52525b", "#e4e4e7"]];
      if (holo) tags.push(["HOLOGRAPHIQUE", "rainbow", "#0d0507"]);
      ctx.font = "13px CardBold";
      const widths = tags.map(([txt]) => ctx.measureText(txt).width + 30), totalW = widths.reduce((a, w) => a + w, 0) + (tags.length - 1) * 10;
      let x = cx - totalW / 2;
      for (const [i, [txt, bg, fg]] of tags.entries()) {
        pill(ctx, x + widths[i] / 2, 688, txt, bg, fg);
        x += widths[i] + 10;
      }
    }
    ctx.textAlign = "left";
    if (p.fx) openingFx(ctx, p.fx, f, fr0, RW, RH, cx, cy);
    shots.push({ data: ditherData(c).data, width: RW, height: RH, delay: f === N - 1 ? 60000 : 55, once: true });
  }
  return encodeFrames(shots);
}

// Récapitulatif : les cartes en éventail, la meilleure au centre
function ribbon(ctx, x, y, w, h, text) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 4);
  const g = ctx.createLinearGradient(-60, 0, 60, 0);
  g.addColorStop(0, "#b45309");
  g.addColorStop(0.5, "#fde68a");
  g.addColorStop(1, "#b45309");
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 6;
  ctx.fillRect(-90, 26, 180, 24);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#2a1305";
  ctx.font = "13px CardEngrave";
  ctx.textAlign = "center";
  ctx.fillText(text, 0, 43);
  ctx.restore();
}
async function drawSpread(results, title, gained) {
  const W = 1200, H = 760, n = results.length, best = results[n - 1], bm = METAL[best.card.rarity], gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createRadialGradient(W / 2, 400, 40, W / 2, 400, W * 0.75);
  bg.addColorStop(0, "#35141a");
  bg.addColorStop(1, "#080304");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, 400);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(TAU / 36);
    ctx.fillStyle = rgba(bm[4], i % 2 ? 0.03 : 0.07);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -900);
    ctx.lineTo(40, -900);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, W / 2, 400, 430, bm[4], 0.32);
  guilloche(ctx, 0, 0, W, H, gold[0]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, gold);
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  corners(ctx, { x: 18, y: 18, w: W - 36, h: H - 36 }, gold[1]);

  ctx.textAlign = "center";
  ctx.font = "26px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  spaced(ctx, canvasText(title.replace(/^\S+\s/, "")).toUpperCase(), W / 2, 62, 4);
  ctx.shadowBlur = 0;
  const news = results.filter((p) => p.isNew).length;
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${n} carte${n > 1 ? "s" : ""} · ${news} nouvelle${news > 1 ? "s" : ""} · +${gained} point${gained > 1 ? "s" : ""} de collection`, W / 2, 96);

  // positions : la meilleure au centre, les autres de part et d'autre
  const offsets = n === 2 ? [-0.6, 0.6] : Array.from({ length: n }, (_, i) => (i === 0 ? 0 : (i % 2 ? -1 : 1) * Math.ceil(i / 2)));
  const placed = results
    .slice()
    .reverse()
    .map((p, i) => ({ p, off: offsets[i] }))
    .sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
  for (const { p, off } of placed) {
    const isBest = p === best, rank = ORDER.indexOf(p.card.rarity), m = METAL[p.card.rarity];
    const w = isBest ? 270 : 232 - Math.abs(off) * 12, h = w * 1.4;
    const x = W / 2 + off * (n <= 3 ? 290 : 215), y = 392 + off * off * 14 + (isBest ? -12 : 18);
    glow(ctx, x, y, w * 0.95, m[4], 0.18 + rank * 0.07);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(off * 0.07);
    if (p.holo) {
      ctx.lineWidth = 5;
      for (let i = 0; i < 24; i++) {
        ctx.strokeStyle = `hsla(${i * 15},95%,65%,0.8)`;
        roundRect(ctx, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 18);
        ctx.setLineDash([12, 300]);
        ctx.lineDashOffset = -i * 13;
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(await cardThumb(p.card, p.holo, Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (p.isNew) ribbon(ctx, -w / 2, -h / 2, w, h, "NOUVEAU");
    ctx.font = "13px CardBold";
    ctx.textAlign = "center";
    pill(ctx, 0, h / 2 + 24, RARITIES[p.card.rarity].name.toUpperCase(), m[1], "#ffffff");
    ctx.restore();
  }
  ctx.textAlign = "center";
  ctx.font = "19px CardBold";
  ctx.fillStyle = "#ffffff";
  star5(ctx, W / 2 - ctx.measureText(`Meilleure carte : ${best.card.name} — ${RARITIES[best.card.rarity].name}`).width / 2 - 20, H - 54, 9, "#fbbf24");
  ctx.fillText(`Meilleure carte : ${best.card.name} — ${RARITIES[best.card.rarity].name}${best.holo ? " (holo)" : ""}`, W / 2, H - 48);
  ctx.textAlign = "left";
  return c;
}

// --- Album en images ---
const albumGroups = () => ["paris", "maison", ...(CURRENT_GEN >= 2 ? ["voyage"] : []), "entreprises", "membres", "duos", "utilitaire", "saisons", "histoire", "evenements"];
const ALBUM_PER_PAGE = 21;
const seriesCards = (group) => allCards().filter((c) => seriesOf(c) === group);
const thumbCache = new Map();
async function cardThumb(card, holo, w, h) {
  const key = `${card.id}:${holo ? 1 : 0}:${w}:${card.avatar ?? ""}:${card.rating ?? ""}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const big = await drawCard(card, holo, 0.3, "float");
  const c = createCanvas(w, h);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.drawImage(big, 0, 0, w, h);
  thumbCache.set(key, c);
  if (thumbCache.size > 400) thumbCache.delete(thumbCache.keys().next().value);
  return c;
}
async function silhouette(card, size) {
  const key = `sil:${card.id}:${size}`;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  if (card.avatar) disc(x, size / 2, size / 2, size * 0.36, "#000000");
  else {
    const sub = await subjectCanvas(card, size);
    if (sub) x.drawImage(sub, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = "#000000";
    x.fillRect(0, 0, size, size);
  }
  thumbCache.set(key, c);
  return c;
}
// cuir du classeur : grain, vignettage et surpiqûre dorée
function leather(ctx, W, H, seed) {
  const g = ctx.createRadialGradient(W * 0.4, H * 0.35, 40, W / 2, H / 2, W * 0.8);
  g.addColorStop(0, "#5a1a20");
  g.addColorStop(0.6, "#3a0f14");
  g.addColorStop(1, "#16050a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(seed);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = R() < 0.5 ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.09)";
    ctx.fillRect(R() * W, R() * H, 1 + R() * 2, 1 + R() * 2);
  }
  ctx.strokeStyle = "rgba(253,230,138,0.45)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 7]);
  roundRect(ctx, 16, 16, W - 32, H - 32, 20);
  ctx.stroke();
  ctx.setLineDash([]);
  // coins de protection en métal
  const gold = METAL.legendaire;
  for (const [x, y, dx, dy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
    ctx.fillStyle = metalGradient(ctx, W, H, gold);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * 64, y);
    ctx.lineTo(x, y + dy * 64);
    ctx.closePath();
    ctx.fill();
    disc(ctx, x + dx * 16, y + dy * 16, 3, gold[3]);
  }
}
function progressBar(ctx, x, y, w, h, pct, colors) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  if (pct <= 0) return;
  roundRect(ctx, x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.fill();
}
function medallion(ctx, x, y, r, series, gold) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;
  disc(ctx, x, y, r, metalGradient(ctx, 1200, 800, gold));
  ctx.restore();
  disc(ctx, x, y, r * 0.8, "#1a0a0d");
  seriesIcon(ctx, series, x, y, r * 0.42, gold[0]);
}

async function drawAlbumCover(user) {
  const rowsCount = Math.ceil(albumGroups().length / 3);
  const userId = user.id, W = 1200, H = 248 + rowsCount * 282 + 50, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  leather(ctx, W, H, 42);
  const avatar = await fetchImage(`avatar:${user.id}:${user.avatar}`, user.displayAvatarURL({ extension: "png", size: 128 }));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  disc(ctx, 116, 118, 56, metalGradient(ctx, W, H, gold));
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(116, 118, 48, 0, TAU);
  ctx.clip();
  if (avatar) ctx.drawImage(avatar, 68, 70, 96, 96);
  ctx.restore();
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#ecc979";
  ctx.fillText("ALBUM DE COLLECTION", 196, 88);
  ctx.font = "52px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  ctx.fillText((user.displayName ?? user.username).slice(0, 24), 194, 142);
  ctx.shadowBlur = 0;
  const G = GENERATIONS[CURRENT_GEN];
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`Les Cartes de la Maison · ${G.name} — ${G.title}`, 196, 174);
  const owned = ownedIds(userId), all = allCards().length, pct = all ? owned.size / all : 0;
  progressRing(ctx, W - 130, 124, 62, pct, [gold[3], gold[0]]);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "32px CardTitle";
  ctx.fillText(`${Math.round(pct * 100)} %`, W - 130, 132);
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = "#cbb9a9";
  ctx.fillText(`${owned.size} / ${all}`, W - 130, 154);
  ctx.textAlign = "left";
  ctx.strokeStyle = rgba(gold[0], 0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 222);
  ctx.lineTo(W - 48, 222);
  ctx.stroke();

  const inv = load().inv[userId] ?? {};
  // tuiles par rangées de trois, la dernière rangée centrée
  const groupsList = albumGroups();
  const tiles = groupsList.map((_, i) => {
    const row = Math.floor(i / 3), inRow = Math.min(3, groupsList.length - row * 3), col = i % 3;
    return [600 - (inRow * 360 + (inRow - 1) * 16) / 2 + col * 376, 248 + row * 282];
  });
  for (const [i, g] of albumGroups().entries()) {
    const [tx, ty] = tiles[i], tw = 360, th = 262, list = seriesCards(g), have = list.filter((card) => owned.has(card.id));
    const done = Boolean(load().rewards[userId]?.[g]) || (list.length > 0 && have.length === list.length);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, tx, ty, tw, th, 16);
    const tg = ctx.createLinearGradient(0, ty, 0, ty + th);
    tg.addColorStop(0, "rgba(40,16,18,0.95)");
    tg.addColorStop(1, "rgba(14,5,6,0.95)");
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = done ? 3 : 1.5;
    ctx.strokeStyle = done ? metalGradient(ctx, W, H, gold) : rgba(gold[0], 0.4);
    roundRect(ctx, tx, ty, tw, th, 16);
    ctx.stroke();
    medallion(ctx, tx + 44, ty + 44, 26, g, gold);
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(SERIES_LABELS[g].replace(/^\S+ /, ""), tx + 82, ty + 46);
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#cbb9a9";
    const sp = list.length ? have.length / list.length : 0;
    ctx.fillText(`${have.length} / ${list.length} cartes · ${Math.round(sp * 100)} %`, tx + 82, ty + 70);
    progressBar(ctx, tx + 22, ty + 90, tw - 44, 9, sp, [gold[3], gold[0]]);
    // éventail des trois plus belles cartes de la série
    const top3 = have.sort((a, b) => ORDER.indexOf(b.rarity) - ORDER.indexOf(a.rarity)).slice(0, 3);
    const fan = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
    const offs = fan.length === 3 ? [-1, 0, 1] : fan.length === 2 ? [-0.5, 0.5] : [0];
    for (const [k, card] of fan.entries()) {
      const off = offs[k], w = off === 0 ? 96 : 86, h = w * 1.4;
      ctx.save();
      ctx.translate(tx + tw / 2 + off * 74, ty + 186 + Math.abs(off) * 6);
      ctx.rotate(off * 0.14);
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 12;
      ctx.drawImage(await cardThumb(card, Boolean(inv[`${card.id}*`]), Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    if (!fan.length) {
      for (const off of [-1, 0, 1]) {
        ctx.save();
        ctx.translate(tx + tw / 2 + off * 74, ty + 186);
        ctx.rotate(off * 0.14);
        ctx.globalAlpha = 0.3;
        ctx.filter = "grayscale(1)";
        ctx.drawImage(drawBack("commune"), -43, -60, 86, 120);
        ctx.restore();
      }
      ctx.textAlign = "center";
      ctx.font = "15px CardItalic";
      ctx.fillStyle = "#cbb9a9";
      ctx.fillText(list.length ? "Aucune carte pour l'instant" : "Bientôt disponible", tx + tw / 2, ty + 192);
      ctx.textAlign = "left";
    }
    if (done) {
      ctx.save();
      ctx.translate(tx + tw - 40, ty + 40);
      ctx.fillStyle = "#fbbf24";
      ctx.shadowColor = "#fbbf24";
      ctx.shadowBlur = 14;
      star5(ctx, 0, 0, 20, "#fbbf24");
      ctx.restore();
      ctx.font = "11px CardEngrave";
      ctx.fillStyle = "#fde68a";
      ctx.textAlign = "center";
      ctx.fillText("COMPLÉTÉE", tx + tw - 40, ty + 76);
      ctx.textAlign = "left";
    }
  }
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#a08a7a";
  ctx.textAlign = "center";
  spaced(ctx, "CHOISISSEZ UNE SÉRIE POUR OUVRIR SES PAGES", W / 2, H - 30, 2);
  ctx.textAlign = "left";
  return c;
}

async function drawAlbumPage(user, group, page) {
  const userId = user.id, W = 1280, H = 900, gold = METAL.legendaire;
  const list = seriesCards(group), pages = Math.max(1, Math.ceil(list.length / ALBUM_PER_PAGE));
  page = Math.min(Math.max(0, page), pages - 1);
  const slice = list.slice(page * ALBUM_PER_PAGE, (page + 1) * ALBUM_PER_PAGE);
  const inv = load().inv[userId] ?? {}, owned = ownedIds(userId);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  leather(ctx, W, H, 7 + page);
  // page intérieure
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 24;
  roundRect(ctx, 118, 30, W - 148, H - 60, 16);
  const pg = ctx.createLinearGradient(0, 30, 0, H - 30);
  pg.addColorStop(0, "#22100f");
  pg.addColorStop(1, "#110707");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  guilloche(ctx, 118, 30, W - 148, H - 60, gold[0]);
  ctx.strokeStyle = rgba(gold[0], 0.4);
  ctx.lineWidth = 1.5;
  roundRect(ctx, 126, 38, W - 164, H - 76, 12);
  ctx.stroke();
  // anneaux du classeur
  for (const y of [H * 0.2, H * 0.5, H * 0.8]) {
    disc(ctx, 140, y, 8, "#050202");
    ctx.lineWidth = 9;
    ctx.strokeStyle = metalGradient(ctx, W, H, METAL.commune);
    ctx.beginPath();
    ctx.ellipse(112, y, 40, 15, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.ellipse(112, y - 3, 38, 12, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  // en-tête de la série
  medallion(ctx, 186, 96, 32, group, gold);
  ctx.font = "44px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillText(SERIES_LABELS[group].replace(/^\S+ /, ""), 234, 106);
  ctx.shadowBlur = 0;
  const have = list.filter((card) => owned.has(card.id)).length, pct = list.length ? have / list.length : 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${have} / ${list.length} cartes${pages > 1 ? ` · page ${page + 1} sur ${pages}` : ""}`, 236, 136);
  progressBar(ctx, W - 470, 84, 360, 12, pct, [gold[3], gold[0]]);
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText(`${Math.round(pct * 100)} %`, W - 50, 100);
  ctx.font = "14px CardBold";
  const done = load().rewards[userId]?.[group];
  ctx.fillStyle = done ? "#fde68a" : "#a08a7a";
  const reward = SERIES[group] ? `Récompense : ${canvasText(formatEuro(SERIES[group].reward))} · 500 poussière · rôle Collectionneur` : "Série sans récompense";
  ctx.fillText(done ? "Série complétée — récompense obtenue" : reward, W - 50, 126);
  ctx.textAlign = "left";

  // pochettes : 7 colonnes × 3 rangées
  const sw = 142, sh = 199, gap = 14, x0 = 160 + (W - 190 - (7 * sw + 6 * gap)) / 2, y0 = 168;
  for (let i = 0; i < ALBUM_PER_PAGE; i++) {
    const card = slice[i], x = x0 + (i % 7) * (sw + gap), y = y0 + Math.floor(i / 7) * (sh + 20);
    // pochette plastique
    roundRect(ctx, x - 4, y - 4, sw + 8, sh + 8, 12);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    if (!card) continue;
    const n = (inv[card.id] ?? 0) + (inv[`${card.id}*`] ?? 0), holo = Boolean(inv[`${card.id}*`]), m = METAL[card.rarity];
    if (n > 0) {
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 10;
      ctx.drawImage(await cardThumb(card, holo, sw, sh), x, y, sw, sh);
      ctx.restore();
      if (n > 1) {
        disc(ctx, x + sw - 14, y + sh - 14, 15, metalGradient(ctx, W, H, gold));
        ctx.font = "12px CardBold";
        ctx.fillStyle = "#2a1305";
        ctx.textAlign = "center";
        ctx.fillText(`×${n}`, x + sw - 14, y + sh - 10);
        ctx.textAlign = "left";
      }
      if (holo) {
        disc(ctx, x + 16, y + sh - 16, 13, "rgba(0,0,0,0.6)");
        sparkle(ctx, x + 16, y + sh - 16, 4.5, `hsl(${(i * 40) % 360},95%,70%)`);
      }
    } else {
      // emplacement vide : silhouette mystère, numéro et rareté
      roundRect(ctx, x, y, sw, sh, 10);
      const eg = ctx.createLinearGradient(0, y, 0, y + sh);
      eg.addColorStop(0, "#1c1010");
      eg.addColorStop(1, "#0d0707");
      ctx.fillStyle = eg;
      ctx.fill();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = rgba(m[1], 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, x + sw / 2, y + sh / 2, 70, m[4], 0.12);
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(await silhouette(card, 104), x + sw / 2 - 52, y + 40, 104, 104);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = "13px CardEngrave";
      ctx.fillStyle = "#8a7a70";
      ctx.fillText(numberOf(card), x + sw / 2, y + 26);
      ctx.font = "20px CardTitle";
      ctx.fillStyle = "#5a4a44";
      ctx.fillText("? ? ?", x + sw / 2, y + 168);
      ctx.font = "10px CardEngrave";
      ctx.fillStyle = m[1];
      ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), x + sw / 2, y + 186);
      ctx.textAlign = "left";
    }
    // reflet de la pochette
    ctx.save();
    roundRect(ctx, x - 4, y - 4, sw + 8, sh + 8, 12);
    ctx.clip();
    const glare = ctx.createLinearGradient(x, y, x + sw, y + sh);
    glare.addColorStop(0, "rgba(255,255,255,0.1)");
    glare.addColorStop(0.35, "rgba(255,255,255,0)");
    glare.addColorStop(0.62, "rgba(255,255,255,0)");
    glare.addColorStop(0.68, "rgba(255,255,255,0.07)");
    glare.addColorStop(0.75, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(x - 4, y - 4, sw + 8, sh + 8);
    ctx.restore();
  }
  if (!list.length) {
    ctx.textAlign = "center";
    ctx.font = "24px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText("Aucune carte dans cette série pour le moment.", W / 2 + 60, H / 2);
    ctx.textAlign = "left";
  }
  // pied : points de pagination
  ctx.textAlign = "center";
  for (let p = 0; p < pages; p++) {
    diamond(ctx, W / 2 + 60 + (p - (pages - 1) / 2) * 20, H - 52, 5);
    if (p === page) {
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.textAlign = "left";
  return { canvas: c, page, pages, slice };
}

async function albumPayload(target, own, view = "cover", page = 0) {
  const name = target.displayName ?? target.username;
  let canvas, info = null;
  if (view === "cover" || !albumGroups().includes(view)) {
    view = "cover";
    canvas = await drawAlbumCover(target);
  } else {
    info = await drawAlbumPage(target, view, page);
    canvas = info.canvas;
    page = info.page;
  }
  const file = new AttachmentBuilder(await canvas.encode("jpeg", 92), { name: "album.jpg" });
  const owned = ownedIds(target.id);
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle(view === "cover" ? `📒 Album de ${name}` : `${SERIES_LABELS[view]} — album de ${name}`)
    .setImage("attachment://album.jpg")
    .setFooter({ text: view === "cover" ? "Choisissez une série dans le menu pour feuilleter ses pages" : "Les cartes manquantes apparaissent en silhouette" });
  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`carte_alb_nav_${target.id}`)
        .setPlaceholder("Feuilleter l'album…")
        .addOptions([
          { label: "Couverture", value: "cover", emoji: "📒", description: `${owned.size} / ${allCards().length} cartes`, default: view === "cover" },
          ...albumGroups().map((g) => {
            const list = seriesCards(g);
            return { label: SERIES_LABELS[g].replace(/^\S+ /, ""), value: g, emoji: SERIES_LABELS[g].split(" ")[0], description: `${list.filter((c) => owned.has(c.id)).length} / ${list.length} cartes`, default: view === g };
          }),
        ])
    ),
  ];
  if (info && info.pages > 1) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_alb_${target.id}_${view}_${page - 1}`).setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId("carte_alb_page").setLabel(`Page ${page + 1} / ${info.pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId(`carte_alb_${target.id}_${view}_${page + 1}`).setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(page >= info.pages - 1)
      )
    );
  }
  if (own && info) {
    const mine = info.slice.filter((c) => owned.has(c.id));
    if (mine.length) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_view")
            .setPlaceholder("🔍 Voir une de mes cartes en grand")
            .addOptions(mine.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), value: c.id, emoji: RARITIES[c.rarity].emoji, description: `${numberOf(c)} · ${RARITIES[c.rarity].name}` })))
        )
      );
    }
  }
  return { embeds: [embed], files: [file], components: rows };
}

