
// --- Tournoi : habillage façon e-sport ---
// Tableau symétrique (les deux moitiés convergent vers la finale, sous le trophée), avatars des joueurs,
// têtes de série, rangs, matchs en direct ; écran des inscriptions avec les récompenses ; podium final ;
// affiche de chaque tour, carte de victoire, animation « VS » au début de chaque match et sacre du champion.
const TD_GOLD = ["#fff7d6", "#fde68a", "#fbbf24", "#b45309"];
const tdFluent = (name) => fetchImage(`fluent:${name}`, fluentUrl(name));
async function tdAvatar(id) {
  if (!id) return null;
  const url = memberCache.get(id)?.avatar ?? load().memberArchive?.[id]?.avatar ?? cardClient?.users?.cache.get(id)?.displayAvatarURL?.({ extension: "png", size: 256 });
  return url ? fetchImage(`avatar:${url}`, url) : null;
}
async function tdAvatars(ids) {
  const out = new Map();
  await Promise.all([...new Set(ids.filter(Boolean))].map(async (id) => out.set(id, await tdAvatar(id).catch(() => null))));
  return out;
}
const tdTier = (id) => tierOf(arenaStats(id).elo);
const tdSeed = (t, id) => (t?.seeds ? t.seeds.indexOf(id) + 1 : 0);

// avatar rond avec anneau ; sans image, l'initiale sur un disque coloré
function tdAvatarDisc(ctx, img, x, y, r, ring = "#fbbf24", id = "", gray = false) {
  ctx.save();
  if (ring) {
    glow(ctx, x, y, r * 1.5, ring.startsWith("#") ? ring : "#fbbf24", gray ? 0 : 0.35);
    disc(ctx, x, y, r + Math.max(2, r * 0.09), ring);
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  if (gray) ctx.filter = "grayscale(1) brightness(0.6)";
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    const hue = hashOf(String(id)) % 360;
    ctx.fillStyle = `hsl(${hue},45%,32%)`;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "#ffffff";
    ctx.font = `${Math.round(r)}px CardTitle`;
    ctx.textAlign = "center";
    ctx.fillText((pseudo(id) || "?").slice(0, 1).toUpperCase(), x, y + r * 0.36);
  }
  ctx.restore();
}
// branche de laurier (gauche : side = -1, droite : side = 1)
function tdLaurel(ctx, cx, cy, r, side, color = "#fbbf24") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.025);
  const a0 = side < 0 ? Math.PI * 0.62 : Math.PI * 0.38, a1 = side < 0 ? Math.PI * 1.45 : -Math.PI * 0.45;
  ctx.beginPath();
  for (let k = 0; k <= 20; k++) {
    const a = a0 + (a1 - a0) * (k / 20);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.stroke();
  for (let k = 1; k <= 9; k++) {
    const a = a0 + (a1 - a0) * (k / 10), px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r, tan = a + (side < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (const off of [-0.55, 0.55]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(tan + off + (side < 0 ? Math.PI : 0));
      ctx.beginPath();
      ctx.ellipse(r * 0.09, 0, r * 0.1, r * 0.035, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}
// fond « stade » : projecteurs, gradins, foule et ses lumières
const tdStageCache = new Map();
function tdStage(W, H) {
  const key = `${W}x${H}`;
  if (tdStageCache.has(key)) return tdStageCache.get(key);
  const c = createCanvas(W, H), ctx = c.getContext("2d"), R = seeded(W * 7 + H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#060818");
  bg.addColorStop(0.45, "#120b30");
  bg.addColorStop(1, "#04050d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // projecteurs
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 7; k++) {
    const x = (W * (k + 0.5)) / 7, ang = (k - 3) * 0.13, col = k % 2 ? "#7c3aed" : "#f59e0b";
    ctx.save();
    ctx.translate(x, -20);
    ctx.rotate(ang);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
    g.addColorStop(0, rgba(col, 0.32));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(14, 0);
    ctx.lineTo(W * 0.11, H * 0.9);
    ctx.lineTo(-W * 0.11, H * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    glow(ctx, x, -10, 90, "#fff7d6", 0.5);
  }
  glow(ctx, W / 2, H * 0.42, W * 0.45, "#f59e0b", 0.12);
  ctx.restore();
  // anneaux du sol de l'arène
  for (const [k, a] of [[0.46, 0.22], [0.36, 0.14], [0.26, 0.1]]) {
    ctx.strokeStyle = rgba("#fbbf24", a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.88, W * k, H * 0.07 * (k / 0.46), 0, 0, TAU);
    ctx.stroke();
  }
  // la foule, avec les lumières des téléphones
  for (let row = 0; row < 3; row++) {
    const y0 = H - 18 - row * 26, sz = 15 - row * 3;
    for (let x = -10; x < W + 20; x += sz * 1.7 + R() * 6) {
      const h = sz * (0.9 + R() * 0.4);
      ctx.fillStyle = ["#020309", "#05060f", "#090a18"][row];
      ctx.beginPath();
      ctx.arc(x, y0 - h, sz * 0.55, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x, y0 + sz * 0.4, sz * 0.95, sz, 0, Math.PI, TAU);
      ctx.fill();
      if (R() < 0.08) {
        glow(ctx, x + sz * 0.4, y0 - h - sz * 0.6, 10, R() < 0.5 ? "#fde68a" : "#ffffff", 0.8);
        disc(ctx, x + sz * 0.4, y0 - h - sz * 0.6, 1.6, "#ffffff");
      }
    }
  }
  // poussière d'or
  for (let k = 0; k < 160; k++) disc(ctx, R() * W, R() * H * 0.85, R() * 1.7 + 0.3, `rgba(253,230,138,${0.12 + R() * 0.45})`);
  // vignette
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  tdStageCache.set(key, c);
  if (tdStageCache.size > 12) tdStageCache.delete(tdStageCache.keys().next().value);
  return c;
}
// titre en or entre deux lauriers
function tdTitle(ctx, W, y, text, size = 72, sub = null) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, y - size - 6, 7);
  ctx.font = `${size}px CardTitle`;
  const tw = ctx.measureText(text).width;
  const g = ctx.createLinearGradient(0, y - size, 0, y + 6);
  g.addColorStop(0, TD_GOLD[0]);
  g.addColorStop(0.5, TD_GOLD[2]);
  g.addColorStop(1, TD_GOLD[3]);
  glow(ctx, W / 2, y - size * 0.35, tw * 0.6, "#f59e0b", 0.25);
  ctx.lineWidth = size / 8;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(text, W / 2, y);
  ctx.fillStyle = g;
  ctx.fillText(text, W / 2, y);
  tdLaurel(ctx, W / 2 - tw / 2 - 36, y - size * 0.34, size * 0.9, -1);
  tdLaurel(ctx, W / 2 + tw / 2 + 36, y - size * 0.34, size * 0.9, 1);
  if (sub) {
    ctx.font = "22px CardItalic";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(sub, W / 2, y + 42);
  }
  ctx.restore();
}
function tdPill(ctx, x, y, text, bg, fg = "#ffffff", size = 13) {
  ctx.save();
  ctx.font = `${size}px CardBold`;
  const w = ctx.measureText(text).width + size * 1.6, h = size * 1.8;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = fg;
  ctx.fillText(text, x, y + size * 0.36);
  ctx.restore();
  return w;
}
// plaque d'un joueur dans le tableau
function tdPlate(ctx, t, x, y, w, h, id, state, img, extra = null) {
  ctx.save();
  const empty = !id, won = !empty && state === "won", lost = !empty && state === "lost";
  roundRect(ctx, x, y, w, h, h / 2);
  if (won) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(120,80,10,0.95)");
    g.addColorStop(1, "rgba(40,26,4,0.95)");
    ctx.fillStyle = g;
  } else ctx.fillStyle = empty ? "rgba(15,23,42,0.45)" : lost ? "rgba(10,12,24,0.75)" : "rgba(17,20,48,0.92)";
  ctx.fill();
  ctx.lineWidth = won ? 2.2 : 1.4;
  ctx.strokeStyle = won ? "#fbbf24" : state === "live" ? "#4ade80" : empty ? "rgba(148,163,184,0.25)" : "rgba(148,163,184,0.45)";
  if (empty) ctx.setLineDash([6, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  const r = h / 2 - 4, ax = x + h / 2;
  if (!empty) tdAvatarDisc(ctx, img, ax, y + h / 2, r, won ? "#fbbf24" : lost ? "#334155" : tdTier(id)[2], id, lost);
  const seed = tdSeed(t, id);
  ctx.textAlign = "left";
  const name = empty ? extra ?? "…" : pseudo(id);
  const showElo = !empty && !won && w >= 210, nx = x + h + 6, maxW = w - h - (won ? 40 : showElo ? 66 : 20);
  ctx.font = `${fitText(ctx, name, maxW, Math.round(h * 0.4), won ? "CardBold" : "CardText")}px ${won ? "CardBold" : "CardText"}`;
  ctx.fillStyle = won ? "#fff7d6" : lost ? "rgba(148,163,184,0.55)" : empty ? "rgba(148,163,184,0.5)" : "#f1f5f9";
  ctx.fillText(name, nx, y + h / 2 + h * 0.14);
  if (lost) {
    const tw = Math.min(maxW, ctx.measureText(name).width);
    ctx.strokeStyle = "rgba(148,163,184,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nx - 2, y + h / 2 + 1);
    ctx.lineTo(nx + tw + 2, y + h / 2 + 1);
    ctx.stroke();
  }
  ctx.textAlign = "right";
  if (won) star5(ctx, x + w - h / 2 - 2, y + h / 2, h * 0.24, "#fbbf24");
  else if (showElo) {
    ctx.font = `${Math.round(h * 0.28)}px CardBold`;
    ctx.fillStyle = lost ? "rgba(148,163,184,0.45)" : tdTier(id)[2];
    ctx.fillText(`${arenaStats(id).elo}`, x + w - 14, y + h / 2 + h * 0.1);
  }
  if (seed && !empty) {
    ctx.textAlign = "center";
    ctx.font = `${Math.round(h * 0.24)}px CardBold`;
    disc(ctx, ax + r * 0.78, y + h / 2 + r * 0.78, h * 0.2, "#0b1026");
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(String(seed), ax + r * 0.78, y + h / 2 + r * 0.78 + h * 0.085);
  }
  ctx.restore();
}

// --- Le tableau symétrique ---
async function tdBracket(t, W0 = 1800) {
  const W = Math.max(W0, 470 + 2 * (t.rounds.length - 1) * 262 + 60), R = t.rounds.length, n0 = t.rounds[0].length, perSide = Math.max(1, n0 / 2);
  const plateH = 40, matchH = plateH * 2 + 6, gap = 26, top = 70;
  const areaH = Math.max(perSide * (matchH + gap), 2 * (matchH + gap) + 120);
  const H = top + areaH + 60, centerW = 470, margin = 30, sideCols = R - 1;
  const colW = sideCols ? (W - 2 * margin - centerW) / (2 * sideCols) : 0, plateW = Math.min(310, colW - 46);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const avatars = await tdAvatars(t.rounds.flatMap((round) => round.flatMap((m) => [m.a, m.b])));
  const centerY = top + areaH / 2;
  const posOf = (r, k) => {
    const n = t.rounds[r].length;
    if (r === R - 1) return { x: W / 2 - 175, y: centerY - matchH / 2, w: 350, side: 0 };
    const half = n / 2, left = k < half, kk = left ? k : k - half;
    const x = left ? margin + r * colW + (colW - plateW) / 2 : W - margin - (r + 1) * colW + (colW - plateW) / 2;
    return { x, y: top + ((kk + 0.5) * areaH) / half - matchH / 2, w: plateW, side: left ? -1 : 1 };
  };
  const live = (r, m) => t.started?.[r] && !t.closed?.[r] && !m.winner && m.a && m.b;
  // en-têtes des tours
  ctx.textAlign = "center";
  for (let r = 0; r < R - 1; r++)
    for (const side of [-1, 1]) {
      const x = side < 0 ? margin + r * colW + colW / 2 : W - margin - (r + 1) * colW + colW / 2;
      const on = t.started?.[r] && !t.closed?.[r];
      ctx.font = "16px CardEngrave";
      ctx.fillStyle = on ? "#4ade80" : "#fbbf24";
      spaced(ctx, roundShort(t, r), x, 26, 3);
      ctx.font = "12px CardText";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(tourDayLabel(t.slots[r]), x, 44);
    }
  // liaisons : dorées quand le vainqueur avance
  for (let r = 0; r < R - 1; r++)
    t.rounds[r].forEach((m, k) => {
      const p = posOf(r, k), q = posOf(r + 1, k >> 1), fromX = p.side < 0 ? p.x + p.w : p.x, y1 = p.y + matchH / 2;
      const toX = r + 1 === R - 1 ? (p.side < 0 ? q.x : q.x + q.w) : q.side < 0 ? q.x : q.x + q.w;
      const y2 = r + 1 === R - 1 ? q.y + (p.side < 0 ? plateH / 2 : plateH + 6 + plateH / 2) : q.y + matchH / 2;
      const midX = (fromX + toX) / 2;
      ctx.save();
      if (m.winner) {
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 10;
      }
      ctx.strokeStyle = m.winner ? "rgba(251,191,36,0.9)" : "rgba(148,163,184,0.3)";
      ctx.lineWidth = m.winner ? 2.6 : 1.6;
      ctx.beginPath();
      ctx.moveTo(fromX, y1);
      ctx.lineTo(midX, y1);
      ctx.lineTo(midX, y2);
      ctx.lineTo(toX, y2);
      ctx.stroke();
      ctx.restore();
    });
  // les matchs
  for (let r = 0; r < R; r++)
    t.rounds[r].forEach((m, k) => {
      const p = posOf(r, k), isLive = live(r, m), fighting = m.battle && battles.has(m.battle);
      if (isLive) {
        ctx.save();
        glow(ctx, p.x + p.w / 2, p.y + matchH / 2, p.w * 0.7, fighting ? "#ef4444" : "#22c55e", 0.28);
        ctx.restore();
      }
      for (const [j, id] of [m.a, m.b].entries()) {
        const state = m.winner ? (m.winner === id ? "won" : "lost") : isLive ? "live" : "idle";
        const ready = id && !m.winner && (m.ready?.[id] ?? 0) > Date.now() - TOUR_READY_MIN * MINUTE;
        tdPlate(ctx, t, p.x, p.y + j * (plateH + 6), p.w, plateH, id, state, avatars.get(id), r === 0 && !id ? "exempt" : null);
        if (ready) tdPill(ctx, p.x + p.w - 30, p.y + j * (plateH + 6) - 2, "PRÊT", "#16a34a", "#ffffff", 9);
      }
      if (fighting) tdPill(ctx, p.x + p.w / 2, p.y - 12, "COMBAT EN COURS", "#dc2626", "#ffffff", 11);
      else if (isLive) tdPill(ctx, p.x + p.w / 2, p.y - 12, "EN DIRECT", "#16a34a", "#ffffff", 11);
      if (m.winner && m.how && m.how !== "combat" && m.how !== "exempt") tdPill(ctx, p.x + p.w / 2, p.y + matchH + 9, m.how.toUpperCase(), "rgba(127,29,29,0.9)", "#fecaca", 9);
    });
  // la finale, sous le trophée
  const f = posOf(R - 1, 0), final = t.rounds[R - 1][0], champ = final.winner;
  const trophy = await tdFluent("Trophy");
  const ty = f.y - 92;
  glow(ctx, W / 2, ty, 190, "#fbbf24", champ ? 0.6 : 0.35);
  if (trophy) ctx.drawImage(trophy, W / 2 - 70, ty - 80, 140, 140);
  else iconTrophy(ctx, W / 2, ty, 54);
  ctx.textAlign = "center";
  ctx.font = "22px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, "FINALE", W / 2, f.y - 14, 6);
  ctx.font = "12px CardText";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(tourDayLabel(t.slots[R - 1]), W / 2, f.y + matchH + 24);
  return c;
}

// --- Inscriptions : récompenses et places ---
async function tdRegistration(t, W = 1800) {
  const list = t?.phase === "inscriptions" ? t.players : [], max = tourMax(), cols = 4, cardW = 250, cardH = 74, gapX = 18, gapY = 16;
  const rows = Math.ceil(max / cols), gridW = cols * cardW + (cols - 1) * gapX, gridH = rows * (cardH + gapY);
  const H = Math.max(840, 260 + Math.max(gridH + 130, 470) + 60);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(W, H), 0, 0);
  const open = t?.phase === "inscriptions";
  tdTitle(ctx, W, 150, "Tournoi du week-end", 76, open ? `Inscriptions ouvertes jusqu'à ${tourDayLabel(t.close)} · élimination directe · finale dimanche à 20 h` : "Inscriptions chaque vendredi à midi · finale le dimanche à 20 h");
  // les récompenses, sur un podium
  const px = 90, py = 280, pw = 520;
  roundRect(ctx, px, py, pw, 470, 24);
  ctx.fillStyle = "rgba(10,10,30,0.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(251,191,36,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "20px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spaced(ctx, "RÉCOMPENSES", px + pw / 2, py + 44, 5);
  const [trophy, silver, bronze] = await Promise.all([tdFluent("Trophy"), tdFluent("2nd place medal"), tdFluent("3rd place medal")]);
  const steps = [
    { x: px + pw / 2, h: 150, img: trophy, label: "CHAMPION", lines: [`${TOUR_PRIZES.champion.dust} ✨`, formatEuro(TOUR_PRIZES.champion.money), "Booster Prestige", "Rôle Champion"], col: "#fbbf24" },
    { x: px + pw / 2 - 168, h: 105, img: silver, label: "FINALISTE", lines: [`${TOUR_PRIZES.finale.dust} ✨`, formatEuro(TOUR_PRIZES.finale.money), "Booster Premium"], col: "#cbd5e1" },
    { x: px + pw / 2 + 168, h: 75, img: bronze, label: "DEMI-FINALES", lines: [`${TOUR_PRIZES.demi.dust} ✨`, "Booster Standard"], col: "#d97706" },
  ];
  const baseY = py + 440;
  for (const s of steps) {
    const sw = 150, sy = baseY - s.h;
    const g = ctx.createLinearGradient(0, sy, 0, baseY);
    g.addColorStop(0, rgba(s.col, 0.55));
    g.addColorStop(1, "rgba(15,15,40,0.9)");
    roundRect(ctx, s.x - sw / 2, sy, sw, s.h, 10);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = rgba(s.col, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    glow(ctx, s.x, sy - 50, 80, s.col, 0.35);
    if (s.img) ctx.drawImage(s.img, s.x - 42, sy - 104, 84, 84);
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = s.col;
    ctx.fillText(s.label, s.x, sy + 24);
    ctx.font = "12px CardBold";
    ctx.fillStyle = "#f1f5f9";
    s.lines.forEach((l, k) => sy + 46 + k * 18 < baseY - 4 && ctx.fillText(l.replace("✨", "poussière"), s.x, sy + 46 + k * 18));
  }
  ctx.font = "13px CardText";
  ctx.fillStyle = "#a5b4fc";
  ctx.fillText(`+${TOUR_WIN_DUST} poussière par match gagné · +${TOUR_PLAY_DUST} pour chaque joueur`, px + pw / 2, py + 462 + 0);
  // les places
  const gx = px + pw + 70, gy = 300;
  ctx.textAlign = "left";
  ctx.font = "20px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spacedLeft(ctx, open ? "LES INSCRITS" : "PROCHAIN TOURNOI", gx, gy - 6, 4);
  ctx.textAlign = "right";
  ctx.font = "40px CardTitle";
  ctx.fillStyle = "#fff7d6";
  ctx.fillText(open ? `${list.length} / ${max}` : "Vendredi 12 h", gx + gridW, gy);
  // jauge de remplissage
  roundRect(ctx, gx, gy + 18, gridW, 12, 6);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  if (open && list.length) {
    const g = ctx.createLinearGradient(gx, 0, gx + gridW, 0);
    g.addColorStop(0, "#f59e0b");
    g.addColorStop(1, "#fde68a");
    roundRect(ctx, gx, gy + 18, Math.max(12, (gridW * Math.min(1, list.length / max)) | 0), 12, 6);
    ctx.fillStyle = g;
    ctx.fill();
  }
  const avatars = await tdAvatars(list);
  for (let i = 0; i < max; i++) {
    const x = gx + (i % cols) * (cardW + gapX), y = gy + 50 + Math.floor(i / cols) * (cardH + gapY), id = list[i];
    roundRect(ctx, x, y, cardW, cardH, 14);
    if (id) {
      const tier = tdTier(id);
      const g = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
      g.addColorStop(0, "rgba(30,27,75,0.95)");
      g.addColorStop(1, "rgba(12,10,32,0.95)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = rgba(tier[2], 0.8);
      ctx.lineWidth = 1.6;
      ctx.stroke();
      tdAvatarDisc(ctx, avatars.get(id), x + 38, y + cardH / 2, 25, tier[2], id);
      ctx.textAlign = "left";
      ctx.font = `${fitText(ctx, pseudo(id), cardW - 92, 18, "CardBold")}px CardBold`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(pseudo(id), x + 74, y + 33);
      ctx.font = "12px CardText";
      ctx.fillStyle = tier[2];
      ctx.fillText(`${tier[1]} · ${arenaStats(id).elo} pts`, x + 74, y + 54);
      ctx.textAlign = "right";
      ctx.font = "11px CardBold";
      ctx.fillStyle = "rgba(251,191,36,0.7)";
      ctx.fillText(`#${i + 1}`, x + cardW - 12, y + 20);
    } else {
      ctx.fillStyle = "rgba(15,23,42,0.35)";
      ctx.fill();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = "rgba(251,191,36,0.28)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.font = "14px CardEngrave";
      ctx.fillStyle = "rgba(253,230,138,0.45)";
      ctx.fillText(open ? "PLACE LIBRE" : "—", x + cardW / 2, y + cardH / 2 + 5);
    }
  }
  // le dernier champion
  const last = t?.champion ?? t?.last?.champion;
  if (!open && last) {
    const crown = await tdFluent("Crown"), img = await tdAvatar(last);
    const cx = gx + gridW / 2, cy = gy + 50 + gridH + 70;
    tdAvatarDisc(ctx, img, cx - 120, cy, 34, "#fbbf24", last);
    if (crown) ctx.drawImage(crown, cx - 146, cy - 82, 52, 52);
    ctx.textAlign = "left";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spacedLeft(ctx, "DERNIER CHAMPION", cx - 70, cy - 8, 3);
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#fff7d6";
    ctx.fillText(pseudo(last), cx - 70, cy + 24);
  }
  return c;
}

// --- Podium final ---
async function tdPodium(ctx, t, W, y0) {
  const { champion, finalist, semis } = t.podium ?? { champion: t.champion, finalist: null, semis: [] };
  const av = await tdAvatars([champion, finalist, ...(semis ?? [])]);
  const [crown, silver, bronze] = await Promise.all([tdFluent("Crown"), tdFluent("2nd place medal"), tdFluent("3rd place medal")]);
  const base = y0 + 560;
  // rayons dorés derrière le champion
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(W / 2, base - 170 - 82 - 70);
  for (let k = 0; k < 28; k++) {
    ctx.rotate(TAU / 28);
    ctx.fillStyle = k % 2 ? "rgba(251,191,36,0.10)" : "rgba(255,247,214,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -560);
    ctx.lineTo(30, -560);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const step = (x, w, h, col, label) => {
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, rgba(col, 0.6));
    g.addColorStop(1, "rgba(15,15,40,0.95)");
    roundRect(ctx, x - w / 2, base - h, w, h, 12);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "48px CardTitle";
    ctx.fillStyle = rgba(col, 0.9);
    ctx.fillText(label, x, base - h + 62);
  };
  step(W / 2, 260, 170, "#fbbf24", "1");
  if (finalist) step(W / 2 - 300, 230, 120, "#cbd5e1", "2");
  if (semis?.length) step(W / 2 + 300, 230, 90, "#d97706", "3");
  const person = (id, x, y, r, ring, label, medal) => {
    glow(ctx, x, y, r * 2, ring, 0.4);
    tdAvatarDisc(ctx, av.get(id), x, y, r, ring, id);
    if (medal) ctx.drawImage(medal, x + r * 0.45, y + r * 0.35, r * 0.8, r * 0.8);
    ctx.textAlign = "center";
    ctx.font = `${fitText(ctx, pseudo(id), 260, Math.round(r * 0.42), "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#fff7d6";
    ctx.fillText(pseudo(id), x, y + r + 34);
    ctx.font = "12px CardEngrave";
    ctx.fillStyle = ring;
    spaced(ctx, label, x, y + r + 54, r < 50 ? 1 : 3);
  };
  const cy = base - 170 - 82 - 70;
  person(champion, W / 2, cy, 82, "#fbbf24", "CHAMPION", null);
  if (crown) ctx.drawImage(crown, W / 2 - 52, cy - 82 - 86, 104, 104);
  if (finalist) person(finalist, W / 2 - 300, base - 120 - 60 - 70, 60, "#cbd5e1", "FINALISTE", silver);
  (semis ?? []).slice(0, 2).forEach((id, k, arr) => person(id, W / 2 + 300 + (arr.length > 1 ? (k ? 62 : -62) : 0), base - 90 - (arr.length > 1 ? 44 : 56) - 70, arr.length > 1 ? 44 : 56, "#d97706", "DEMI-FINALE", bronze));
}

// --- L'image du salon du tournoi ---
async function drawTournamentHD(t) {
  const W = 1800, R = t?.rounds?.length ?? 0;
  if (!R || t.phase === "inscriptions" || t.phase === "cancelled") return tdRegistration(t, W);
  const bracket = await tdBracket(t, W), done = t.phase === "done", podiumH = done ? 640 : 0;
  const BW = bracket.width, H = 230 + podiumH + bracket.height + 70;
  const c = createCanvas(BW, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(BW, H), 0, 0);
  const r = t.started?.lastIndexOf(true) ?? -1, live = r >= 0 && !t.closed?.[r];
  const sub = done
    ? `${t.players.length} joueurs · ${R} tours · champion : ${pseudo(t.champion)}`
    : live
      ? `${roundName(t, r)} en cours · ${t.players.length} joueurs · finale dimanche à 20 h`
      : `${t.players.length} joueurs · élimination directe · finale dimanche à 20 h`;
  tdTitle(ctx, BW, 140, done ? "Champion du week-end" : "Tournoi du week-end", 72, sub);
  if (done) await tdPodium(ctx, t, BW, 230);
  ctx.drawImage(bracket, 0, 220 + podiumH);
  return c;
}
{
  drawTournament = drawTournamentHD;
}

// --- Moments forts : affiche du tour, carte de victoire, « VS » animé, sacre du champion ---
const tdShot = (ctx, W, H, delay) => ({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H, delay, once: true });
const tdRoundLabel = (t, r) => (r === t.rounds.length - 1 ? "GRANDE FINALE" : roundName(t, r).toUpperCase());

// Affiche de l'ouverture d'un tour : tous les duels du tour
async function tdRoundPoster(t, r) {
  const matches = t.rounds[r].filter((m) => m.a && m.b && m.how !== "exempt");
  const W = 1300, rowH = 96, H = 300 + Math.max(1, matches.length) * rowH + 40;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(W, H), 0, 0);
  const final = r === t.rounds.length - 1, end = t.slots[r] + TOUR_ROUND_HOURS * 3600000;
  tdTitle(ctx, W, 150, final ? "Grande finale" : roundName(t, r), 74, `C'est parti ! Matchs jusqu'à ${tourDayLabel(end).replace(/^\S+ à /, "")} · cliquez sur « Jouer mon match »`);
  const av = await tdAvatars(matches.flatMap((m) => [m.a, m.b]));
  matches.forEach((m, k) => {
    const y = 250 + k * rowH, cx = W / 2;
    roundRect(ctx, 80, y, W - 160, rowH - 18, 39);
    const g = ctx.createLinearGradient(80, 0, W - 80, 0);
    g.addColorStop(0, rgba(tdTier(m.a)[2], 0.35));
    g.addColorStop(0.5, "rgba(10,10,28,0.92)");
    g.addColorStop(1, rgba(tdTier(m.b)[2], 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(251,191,36,0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const mid = y + (rowH - 18) / 2;
    tdAvatarDisc(ctx, av.get(m.a), 130, mid, 30, tdTier(m.a)[2], m.a);
    tdAvatarDisc(ctx, av.get(m.b), W - 130, mid, 30, tdTier(m.b)[2], m.b);
    ctx.textAlign = "left";
    ctx.font = `${fitText(ctx, pseudo(m.a), 330, 28, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pseudo(m.a), 176, mid + 2);
    ctx.font = "13px CardText";
    ctx.fillStyle = tdTier(m.a)[2];
    ctx.fillText(`#${tdSeed(t, m.a)} · ${tdTier(m.a)[1]} · ${arenaStats(m.a).elo} pts`, 176, mid + 24);
    ctx.textAlign = "right";
    ctx.font = `${fitText(ctx, pseudo(m.b), 330, 28, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pseudo(m.b), W - 176, mid + 2);
    ctx.font = "13px CardText";
    ctx.fillStyle = tdTier(m.b)[2];
    ctx.fillText(`#${tdSeed(t, m.b)} · ${tdTier(m.b)[1]} · ${arenaStats(m.b).elo} pts`, W - 176, mid + 24);
    glow(ctx, cx, mid, 70, "#ef4444", 0.35);
    ctx.textAlign = "center";
    ctx.font = "40px CardTitle";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#000000";
    ctx.strokeText("VS", cx, mid + 14);
    const vg = ctx.createLinearGradient(0, mid - 26, 0, mid + 14);
    vg.addColorStop(0, "#fff7d6");
    vg.addColorStop(1, "#ef4444");
    ctx.fillStyle = vg;
    ctx.fillText("VS", cx, mid + 14);
  });
  return c;
}
// carte de victoire après un match
async function tdResultCard(t, r, winner, loser) {
  const W = 1100, H = 420, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(W, H), 0, 0);
  const [wa, la] = await Promise.all([tdAvatar(winner), tdAvatar(loser)]);
  const next = r + 1 < t.rounds.length ? (r + 1 === t.rounds.length - 1 ? "QUALIFIÉ POUR LA FINALE" : `QUALIFIÉ POUR LES ${roundName(t, r + 1).toUpperCase()}`) : "CHAMPION DU TOURNOI";
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.translate(250, 210);
  for (let k = 0; k < 24; k++) {
    ctx.rotate(TAU / 24);
    ctx.fillStyle = k % 2 ? "rgba(251,191,36,0.12)" : "rgba(255,247,214,0.06)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-24, -420);
    ctx.lineTo(24, -420);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  tdLaurel(ctx, 250, 210, 150, -1);
  tdLaurel(ctx, 250, 210, 150, 1);
  tdAvatarDisc(ctx, wa, 250, 210, 104, "#fbbf24", winner);
  ctx.textAlign = "left";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spacedLeft(ctx, `TOURNOI · ${roundName(t, r).toUpperCase()}`, 450, 104, 4);
  ctx.font = "84px CardTitle";
  const g = ctx.createLinearGradient(0, 120, 0, 200);
  g.addColorStop(0, TD_GOLD[0]);
  g.addColorStop(1, TD_GOLD[3]);
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText("VICTOIRE", 450, 194);
  ctx.fillStyle = g;
  ctx.fillText("VICTOIRE", 450, 194);
  ctx.font = `${fitText(ctx, pseudo(winner), 600, 40, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(pseudo(winner), 450, 250);
  tdPill(ctx, 450 + 150, 290, next, "rgba(22,101,52,0.9)", "#dcfce7", 13);
  tdAvatarDisc(ctx, la, 474, 352, 26, "#334155", loser, true);
  ctx.font = "16px CardText";
  ctx.fillStyle = "rgba(203,213,225,0.75)";
  ctx.fillText(`bat ${pseudo(loser)}`, 512, 358);
  return c;
}
// « VS » animé au début d'un match du tournoi
async function tdVsGif(t, r, a, b) {
  const W = 800, H = 420, final = r === t.rounds.length - 1;
  const [aa, ab, trophy] = await Promise.all([tdAvatar(a), tdAvatar(b), final ? tdFluent("Trophy") : null]);
  const ca = tdTier(a)[2], cb = tdTier(b)[2], stage = tdStage(W, H), shots = [];
  const frames = 30;
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d"), inQ = anOutExpo(Math.min(1, f / 7)), slam = Math.max(0, Math.min(1, (f - 7) / 3)), after = Math.max(0, f - 9);
    const sh = f >= 8 && f < 13 ? (13 - f) * 3 : 0, sx = sh ? (Math.random() - 0.5) * sh : 0, sy = sh ? (Math.random() - 0.5) * sh : 0;
    ctx.translate(sx, sy);
    ctx.drawImage(stage, 0, 0);
    // deux moitiés en diagonale, aux couleurs du rang de chaque joueur
    for (const [side, col] of [[-1, ca], [1, cb]]) {
      ctx.save();
      ctx.translate(side * (1 - inQ) * W * 0.6, 0);
      ctx.beginPath();
      if (side < 0) {
        ctx.moveTo(-20, -20);
        ctx.lineTo(W / 2 + 60, -20);
        ctx.lineTo(W / 2 - 60, H + 20);
        ctx.lineTo(-20, H + 20);
      } else {
        ctx.moveTo(W / 2 + 60, -20);
        ctx.lineTo(W + 20, -20);
        ctx.lineTo(W + 20, H + 20);
        ctx.lineTo(W / 2 - 60, H + 20);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(side < 0 ? 0 : W, 0, W / 2, 0);
      g.addColorStop(0, rgba(col, 0.55));
      g.addColorStop(1, "rgba(5,5,18,0.75)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      anSpeedLines(ctx, -side, 0.18, f * 3 + (side < 0 ? 1 : 2));
      ctx.restore();
      ctx.restore();
    }
    // les deux joueurs
    for (const [side, id, img, col] of [[-1, a, aa, ca], [1, b, ab, cb]]) {
      const x = W / 2 + side * (210 + (1 - inQ) * 420), y = 205 + Math.sin(f * 0.3 + side) * 3;
      glow(ctx, x, y, 150, col, 0.45);
      tdAvatarDisc(ctx, img, x, y, 86, col, id);
      if (after > 0) {
        const tq = Math.min(1, after / 4);
        ctx.save();
        ctx.globalAlpha = tq;
        ctx.textAlign = "center";
        ctx.font = `${fitText(ctx, pseudo(id), 300, 32, "CardTitle")}px CardTitle`;
        ctx.lineWidth = 6;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        ctx.strokeText(pseudo(id), x, y + 132);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(pseudo(id), x, y + 132);
        ctx.font = "14px CardBold";
        ctx.fillStyle = col;
        ctx.fillText(`#${tdSeed(t, id)} · ${tdTier(id)[1].toUpperCase()} · ${arenaStats(id).elo} PTS`, x, y + 156);
        ctx.restore();
      }
    }
    // le VS qui s'écrase au centre
    if (f >= 7) {
      if (f >= 8) for (let k = 0; k < 2; k++) anBolt(ctx, W / 2 + (k ? 40 : -40), 0, W / 2 + (k ? -30 : 30), H, f * 7 + k, 5, "#fde68a", 0.12, 2);
      if (f >= 8 && f < 16) anSparks(ctx, W / 2, 210, (f - 8) / 8, 77, 40, 260, ["#fde68a", "#ffffff", "#f97316"], 3, 120);
      const sc = 2.6 - 1.6 * ease.out(slam);
      ctx.save();
      ctx.translate(W / 2, 236);
      ctx.scale(sc, sc);
      ctx.globalAlpha = Math.min(1, slam * 2);
      ctx.textAlign = "center";
      ctx.font = "110px CardTitle";
      ctx.lineWidth = 12;
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#000000";
      ctx.strokeText("VS", 0, 0);
      const g = ctx.createLinearGradient(0, -80, 0, 10);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.5, "#fde68a");
      g.addColorStop(1, "#ef4444");
      ctx.fillStyle = g;
      ctx.fillText("VS", 0, 0);
      ctx.restore();
    }
    // bandeau du tour
    const bq = Math.min(1, Math.max(0, (f - 3) / 5));
    anBrushBar(ctx, W / 2, 44, final ? 470 : 430, 52, 31, "rgba(0,0,0,0.88)", anOutExpo(bq));
    if (bq > 0.3) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (bq - 0.3) / 0.5);
      ctx.textAlign = "center";
      ctx.font = "11px CardEngrave";
      ctx.fillStyle = "#fbbf24";
      spaced(ctx, "TOURNOI DU WEEK-END", W / 2, 32, 4);
      ctx.font = `${final ? 26 : 22}px CardTitle`;
      ctx.fillStyle = final ? "#fde68a" : "#ffffff";
      ctx.fillText(tdRoundLabel(t, r), W / 2, 62);
      ctx.restore();
      if (trophy) {
        ctx.drawImage(trophy, W / 2 - 250, 18, 48, 48);
        ctx.drawImage(trophy, W / 2 + 202, 18, 48, 48);
      }
    }
    if (f === 8 || f === 9) {
      ctx.fillStyle = `rgba(255,247,214,${f === 8 ? 0.8 : 0.35})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    shots.push(tdShot(ctx, W, H, f === frames - 1 ? 2500 : f >= 7 && f <= 9 ? 90 : 55));
  }
  return encodeFrames(shots);
}
// le sacre du champion
async function tdChampionGif(t) {
  const W = 800, H = 520, champ = t.champion;
  const [img, crown, trophy] = await Promise.all([tdAvatar(champ), tdFluent("Crown"), tdFluent("Trophy")]);
  const stage = tdStage(W, H), shots = [], frames = 44, R = seeded(hashOf(String(champ)));
  const confetti = Array.from({ length: 70 }, () => ({ x: R() * W, y: -R() * H, v: 3 + R() * 6, s: 4 + R() * 6, r: R() * TAU, c: ["#fbbf24", "#fde68a", "#f472b6", "#60a5fa", "#a78bfa", "#ffffff"][Math.floor(R() * 6)] }));
  for (let f = 0; f < frames; f++) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(stage, 0, 0);
    const pop = ease.back(Math.min(1, f / 10)), drop = Math.min(1, Math.max(0, (f - 10) / 7)), land = f >= 17;
    // rayons dorés qui tournent
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.translate(W / 2, 250);
    ctx.rotate(f * 0.02);
    for (let k = 0; k < 30; k++) {
      ctx.rotate(TAU / 30);
      ctx.fillStyle = k % 2 ? `rgba(251,191,36,${0.13 * pop})` : `rgba(255,247,214,${0.07 * pop})`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-28, -620);
      ctx.lineTo(28, -620);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    tdLaurel(ctx, W / 2, 250, 150 * pop + 1, -1);
    tdLaurel(ctx, W / 2, 250, 150 * pop + 1, 1);
    glow(ctx, W / 2, 250, 230, "#fbbf24", 0.55 * pop);
    if (pop > 0.05) tdAvatarDisc(ctx, img, W / 2, 250, 110 * pop, "#fbbf24", champ);
    // la couronne descend et se pose
    if (crown && f >= 10) {
      const cy = 250 - 110 - 70 - (1 - ease.bounce(drop)) * 260;
      ctx.drawImage(crown, W / 2 - 62, cy - 62, 124, 124);
    }
    if (f === 17 || f === 18) {
      ctx.fillStyle = `rgba(255,247,214,${f === 17 ? 0.75 : 0.3})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (land) anSparks(ctx, W / 2, 110, Math.min(1, (f - 17) / 10), 91, 50, 300, ["#fde68a", "#ffffff", "#fbbf24"], 3, 160);
    // titre et nom
    const tq = Math.min(1, Math.max(0, (f - 17) / 6));
    anBrushBar(ctx, W / 2, 420, 600, 64, 41, "rgba(0,0,0,0.9)", anOutExpo(tq));
    if (tq > 0.2) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (tq - 0.2) / 0.5);
      ctx.textAlign = "center";
      ctx.font = "13px CardEngrave";
      ctx.fillStyle = "#fbbf24";
      spaced(ctx, "CHAMPION DU TOURNOI", W / 2, 404, 5);
      ctx.font = `${fitText(ctx, pseudo(champ), 540, 36, "CardTitle")}px CardTitle`;
      ctx.fillStyle = "#fff7d6";
      ctx.fillText(pseudo(champ), W / 2, 442);
      ctx.restore();
      if (trophy) {
        ctx.drawImage(trophy, W / 2 - 330, 384, 60, 60);
        ctx.drawImage(trophy, W / 2 + 270, 384, 60, 60);
      }
    }
    // confettis
    if (land)
      for (const p of confetti) {
        const y = p.y + (f - 17) * p.v * 4, x = p.x + Math.sin((f + p.r) * 0.3) * 12;
        if (y < -10 || y > H) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(p.r + f * 0.2);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
    shots.push(tdShot(ctx, W, H, f === frames - 1 ? 4000 : f === 17 ? 110 : 60));
  }
  return encodeFrames(shots);
}

// --- La carte de membre d'un champion du tournoi : cadre doré et sceau au trophée ---
const tdTourneyWins = (id) => (id ? load().userStats?.[id]?.tourneyWins ?? 0 : 0);
function tourneySeal(ctx, x, y, n) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * TAU - Math.PI / 2, r = k % 2 ? 35 : 41;
    k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = metalGradient(ctx, 600, 840, METAL.legendaire);
  ctx.fill();
  ctx.restore();
  disc(ctx, x, y, 29, "#7c2d12");
  disc(ctx, x, y, 27, "#1c1206");
  iconTrophy(ctx, x, y - 2, 13);
  ctx.textAlign = "center";
  ctx.font = "12px CardTitle";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(`×${n}`, x, y + 22);
}
function tourneyStyle(c, card, t) {
  const wins = tdTourneyWins(card.memberId);
  if (!wins) return;
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const framePath = new Path2D();
  rrPath(framePath, 0, 0, W, H, 28);
  rrPath(framePath, 16, 16, W - 32, H - 32, 18);
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  // le cadre devient tout en or (les éditions spéciales gardent le leur)
  if (!card.variant) {
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = "#f59e0b";
    ctx.fill(framePath, "evenodd");
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#fbbf24";
    ctx.fill(framePath, "evenodd");
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.lineWidth = 9;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.25);
  roundRect(ctx, 7, 7, W - 14, H - 14, 24);
  ctx.stroke();
  // paillettes d'or
  ctx.globalCompositeOperation = "screen";
  const R = seeded(hashOf(card.id) + 77);
  for (let i = 0; i < 22 + wins * 6; i++) {
    const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
    sparkle(ctx, 30 + R() * (W - 60), 30 + R() * (H - 60), 0.8 + tw * 3.4, `rgba(253,230,138,${0.3 + tw * 0.7})`);
  }
  ctx.restore();
  // le sceau du champion, en haut à gauche (le sceau Membre Star est à droite)
  tourneySeal(ctx, 74, 132, wins);
  ctx.save();
  ctx.font = "11px CardEngrave";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  ctx.fillText("CHAMPION", 74, 190);
  ctx.fillText(wins > 1 ? `DU TOURNOI ×${wins}` : "DU TOURNOI", 74, 204);
  ctx.restore();
}
{
  const style = memberStyle, finish = tourFinish;
  memberStyle = (c, card, t) => {
    style(c, card, t);
    tourneyStyle(c, card, t);
  };
  // dès le sacre, la carte du champion est redessinée (on oublie ses images en cache)
  tourFinish = async (client, t) => {
    await finish(client, t);
    const prefix = t.champion ? `mb_${t.champion}` : null;
    if (!prefix) return;
    for (const cache of [gifCache, thumbCache]) for (const key of [...cache.keys()]) if (String(key).startsWith(prefix)) cache.delete(key);
  };
}
