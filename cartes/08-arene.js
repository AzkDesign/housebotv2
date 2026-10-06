// --- Arène : combats de cartes en direct ---
// Chaque manche, les deux joueurs choisissent en secret et en même temps : Attaque, Garde, Spécial ou Changer.
// Les choix sont révélés ensemble, la manche est animée, puis l'arène se met à jour.
const ROUND_SECONDS = 45, TEAM_SECONDS = 180, CHALLENGE_MINUTES = 10, SPECIAL_COST = 3, MAX_ENERGY = 5, BET_ROUNDS = 2, ARENA_FEE = 0.05;
const TYPE_BEATS = { paris: "entreprises", entreprises: "maison", maison: "paris" };
const ACTIONS = {
  attack: { label: "Attaque", emoji: "⚔️", color: "#ef4444" },
  guard: { label: "Garde", emoji: "🛡️", color: "#3b82f6" },
  special: { label: "Spécial", emoji: "💥", color: "#f59e0b" },
  switch: { label: "Changement", emoji: "🔄", color: "#22c55e" },
};
const SPECIAL_NAMES = { saisons: "Magie de saison", voyage: "Tour du monde", paris: "Lumière de Paris", maison: "Pouvoir de la Maison", entreprises: "OPA hostile", evenements: "Moment historique", membres: "Coup de maître" };
const ARENA_TIERS = [
  [1550, "Légende", "#f472b6"],
  [1400, "Diamant", "#67e8f9"],
  [1250, "Or", "#fbbf24"],
  [1100, "Argent", "#cbd5e1"],
  [0, "Bronze", "#d97706"],
];
const battles = new Map(); // id -> combat en cours
const userBattle = new Map(); // userId -> id du combat
const challenges = new Map(); // id -> défi en attente

function arenaStats(userId) {
  return (load().arena[userId] ??= { elo: 1000, w: 0, l: 0, d: 0, streak: 0 });
}
const tierOf = (elo) => ARENA_TIERS.find(([min]) => elo >= min);
function typeMult(a, d) {
  if (TYPE_BEATS[a] === d) return 1.25;
  if (TYPE_BEATS[d] === a) return 0.85;
  return 1;
}
function specialName(card) {
  if (card.memberStats) return memberMoves(card)[1].name;
  return SPECIAL_NAMES[seriesOf(card)] ?? "Coup spécial";
}
function fighter(key) {
  const card = cardOfKey(key), cp = combatProfile(card, isHoloKey(key));
  return { key, card, name: card.name, series: seriesOf(card), maxHp: cp.hp, hp: cp.hp, atk: cp.atk, luck: cp.luck, special: cp.specialName, attackName: cp.attackName, attackDmg: cp.attack, specialDmg: cp.special };
}
const fighterPower = (key) => {
  const f = fighter(key);
  return f.maxHp + f.atk * 1.6;
};
function bestTeam(userId) {
  const seen = new Set();
  return ownedKeys(userId)
    .map(([k]) => k)
    .sort((a, b) => fighterPower(b) - fighterPower(a))
    .filter((k) => {
      const id = k.replace("*", "");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3);
}
const activeOf = (p) => p.team[p.active];
const aliveBench = (p) => p.team.map((f, i) => ({ f, i })).filter(({ f, i }) => i !== p.active && f.hp > 0);

// --- Moteur de résolution d'une manche ---
// Triangle : la Garde bat l'Attaque, l'Attaque interrompt le Spécial, le Spécial brise la Garde.
// Ordre des coups : les attaques frappent avant les spéciaux, puis la carte la plus chanceuse frappe en premier.
// Une carte mise K.O. avant son tour ne frappe pas. La garde s'use si on la répète.
const GUARD_DECAY = [0.5, 0.7, 0.9]; // part des dégâts encaissés en garde : 1re, 2e, 3e garde consécutive
function resolveRoundState(b) {
  const lines = [], events = [];
  const acts = b.players.map((p) => ({ ...(p.choice ?? { type: "guard", auto: true }) }));
  acts.forEach((a, i) => {
    if (a.type === "special" && b.players[i].energy < SPECIAL_COST) a.type = "attack";
  });
  // 1. changements de carte
  acts.forEach((a, i) => {
    const p = b.players[i];
    if (a.type !== "switch") return;
    if (p.team[a.to]?.hp > 0 && a.to !== p.active) {
      events.push({ kind: "switch", side: i, from: p.active, to: a.to });
      lines.push({ side: i, text: `${p.name} rappelle ${activeOf(p).name} et envoie ${p.team[a.to].name} !` });
      p.active = a.to;
    } else a.type = "guard";
  });
  b.players.forEach((p, i) => {
    p.guardStreak = acts[i].type === "guard" ? (p.guardStreak ?? 0) + 1 : 0;
  });
  const startIdx = b.players.map((p) => p.active);
  // 2. les coups, dans l'ordre d'initiative
  const order = [0, 1]
    .filter((i) => acts[i].type === "attack" || acts[i].type === "special")
    .sort((x, y) => {
      if (acts[x].type !== acts[y].type) return acts[x].type === "attack" ? -1 : 1;
      return activeOf(b.players[y]).luck - activeOf(b.players[x]).luck || Math.random() - 0.5;
    });
  const struck = [false, false], interrupted = [false, false], broken = [false, false];
  for (const i of order) {
    const me = b.players[i], foe = b.players[1 - i], att = activeOf(me), def = activeOf(foe);
    if (att.hp <= 0) {
      events.push({ kind: "skip", side: i, idx: me.active });
      lines.push({ side: i, text: `${att.name} est K.O. avant d'avoir pu frapper.` });
      continue;
    }
    if (def.hp <= 0) continue;
    const type = acts[i].type, defAct = acts[1 - i].type;
    if (type === "special") me.energy -= SPECIAL_COST;
    let dmg = type === "special" ? 18 + att.atk * 1.1 : 10 + att.atk * 0.55;
    dmg *= 0.85 + Math.random() * 0.3;
    const mult = typeMult(att.series, def.series);
    dmg *= mult;
    const crit = Math.random() < (att.luck / 350) * (ruleIs("critiques") ? 2 : 1);
    if (crit) dmg *= 1.5;
    const dodge = type === "attack" && Math.random() < (def.luck / 700) * (ruleIs("esquive") ? 2 : 1);
    let guarded = false, broke = false, interrupt = false, weakened = false;
    if (defAct === "guard") {
      if (type === "special") {
        dmg *= 0.85;
        broke = true;
        broken[1 - i] = true;
      } else {
        dmg *= ruleIs("fer") ? GUARD_DECAY[0] : GUARD_DECAY[Math.min(2, foe.guardStreak - 1)];
        guarded = true;
      }
    }
    if (type === "attack" && defAct === "special" && !struck[1 - i]) {
      dmg *= 1.2;
      interrupt = true;
      interrupted[1 - i] = true;
    }
    if (type === "special" && interrupted[i]) {
      dmg *= 0.65;
      weakened = true;
    }
    if (dodge) dmg = 0;
    if (ruleIs("rage")) dmg *= 1.25;
    dmg = Math.round(dmg);
    const from = def.hp;
    def.hp = Math.max(0, def.hp - dmg);
    struck[i] = true;
    events.push({ kind: "strike", side: i, type, attIdx: me.active, defIdx: foe.active, dmg, crit, dodge, guarded, broke, interrupt, weakened, mult, from, to: def.hp });
    const tags = [crit && "coup critique", mult > 1 && "super efficace", mult < 1 && "peu efficace", guarded && "réduit par la garde", broke && "garde brisée", interrupt && "spécial interrompu", weakened && "spécial affaibli"].filter(Boolean);
    lines.push({
      side: i,
      text: dodge
        ? `${att.name} attaque… mais ${def.name} esquive !`
        : `${att.name} ${type === "special" ? `lance ${att.special}` : att.attackName && att.attackName !== "Attaque" ? `utilise ${att.attackName}` : "attaque"} : −${dmg} PV à ${def.name}${tags.length ? ` (${tags.join(", ")})` : ""}`,
    });
    // contre-attaque de la garde (seulement si la garde tient encore)
    if (type === "attack" && defAct === "guard" && !dodge && def.hp > 0 && (foe.guardStreak <= 2 || ruleIs("fer"))) {
      const c = Math.round((10 + def.atk * 0.55) * 0.3 * (ruleIs("rage") ? 1.25 : 1));
      const cf = att.hp;
      att.hp = Math.max(0, att.hp - c);
      events.push({ kind: "counter", side: 1 - i, attIdx: foe.active, defIdx: me.active, dmg: c, from: cf, to: att.hp });
      lines.push({ side: 1 - i, text: `${def.name} pare et contre-attaque : −${c} PV à ${att.name}` });
    }
  }
  acts.forEach((a, i) => {
    if (a.type === "guard" && !order.includes(1 - i)) lines.push({ side: i, text: `${activeOf(b.players[i]).name} se met en garde et recharge son énergie.` });
  });
  // 3. énergie : +1, ou +2 pour une garde qui n'a pas été brisée
  acts.forEach((a, i) => {
    const p = b.players[i];
    p.energy = Math.min(MAX_ENERGY, p.energy + (a.type === "guard" && !broken[i] ? 2 : 1));
  });
  // 4. K.O. et remplaçants
  b.players.forEach((p, i) => {
    if (activeOf(p).hp > 0) return;
    events.push({ kind: "ko", side: i, idx: p.active });
    lines.push({ side: 1 - i, text: `${activeOf(p).name} est K.O. !` });
    const next = p.team.findIndex((f) => f.hp > 0);
    if (next >= 0) {
      events.push({ kind: "enter", side: i, idx: next });
      p.active = next;
      lines.push({ side: i, text: `${p.name} envoie ${p.team[next].name} dans l'arène.` });
    }
  });
  return { acts, events, lines, startIdx };
}

// --- Rendu de l'arène ---
function arenaBackground(W, H) {
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const bg = ctx.createRadialGradient(W / 2, H * 0.45, 40, W / 2, H * 0.5, W * 0.75);
  bg.addColorStop(0, "#3d1219");
  bg.addColorStop(1, "#060203");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H * 0.42);
  for (let i = 0; i < 40; i++) {
    ctx.rotate(TAU / 40);
    ctx.fillStyle = rgba("#fbbf24", i % 2 ? 0.015 : 0.04);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -W);
    ctx.lineTo(40, -W);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // sol de l'arène
  const fy = H * 0.66;
  const floor = ctx.createRadialGradient(W / 2, fy, 20, W / 2, fy, W * 0.5);
  floor.addColorStop(0, "rgba(251,191,36,0.16)");
  floor.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(W / 2, fy, W * 0.46, H * 0.12, 0, 0, TAU);
  ctx.fill();
  for (const [rx, a] of [[0.46, 0.5], [0.4, 0.25], [0.3, 0.15]]) {
    ctx.strokeStyle = rgba("#fbbf24", a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(W / 2, fy, W * rx, H * 0.12 * (rx / 0.46), 0, 0, TAU);
    ctx.stroke();
  }
  // projecteurs
  for (const x of [W * 0.12, W * 0.88]) glow(ctx, x, 0, 320, "#fde68a", 0.18);
  guilloche(ctx, 0, 0, W, H, METAL.legendaire[0]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire);
  roundRect(ctx, 8, 8, W - 16, H - 16, 20);
  ctx.stroke();
  return c;
}
function hpBar(ctx, x, y, w, h, hp, max, showText = true) {
  const pct = Math.max(0, hp / max);
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1;
  ctx.stroke();
  if (pct > 0) {
    roundRect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * pct), h - 4, (h - 4) / 2);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const col = pct > 0.5 ? ["#16a34a", "#4ade80"] : pct > 0.25 ? ["#ca8a04", "#facc15"] : ["#b91c1c", "#f87171"];
    g.addColorStop(0, col[0]);
    g.addColorStop(1, col[1]);
    ctx.fillStyle = g;
    ctx.fill();
  }
  if (showText) {
    ctx.font = `${Math.round(h * 0.75)}px CardBold`;
    ctx.fillStyle = "#ffffff";
    const align = ctx.textAlign;
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(0,0,0,0.8)";
    ctx.shadowBlur = 3;
    ctx.fillText(`${Math.max(0, Math.round(hp))} / ${max} PV`, x + w / 2, y + h * 0.78);
    ctx.shadowBlur = 0;
    ctx.textAlign = align;
  }
}
function bolt(ctx, x, y, s, on) {
  ctx.fillStyle = on ? "#facc15" : "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y - s);
  ctx.lineTo(x - s * 0.55, y + s * 0.15);
  ctx.lineTo(x - s * 0.02, y + s * 0.15);
  ctx.lineTo(x - s * 0.2, y + s);
  ctx.lineTo(x + s * 0.55, y - s * 0.15);
  ctx.lineTo(x + s * 0.02, y - s * 0.15);
  ctx.closePath();
  ctx.fill();
  if (on) {
    ctx.strokeStyle = "rgba(120,53,15,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
async function drawFighterSide(ctx, b, i, W, opts = {}) {
  const p = b.players[i], left = i === 0, cx = left ? W * 0.25 : W * 0.75;
  // en-tête du joueur
  const hx = left ? 40 : W - 40;
  const av = p.avatar ? await fetchImage(`avatar:${p.avatar}`, p.avatar) : null;
  const ax = left ? hx + 30 : hx - 30;
  disc(ctx, ax, 58, 32, metalGradient(ctx, W, 700, METAL.legendaire));
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, 58, 27, 0, TAU);
  ctx.clip();
  if (av) ctx.drawImage(av, ax - 27, 31, 54, 54);
  else disc(ctx, ax, 58, 27, "#3f3f46");
  ctx.restore();
  ctx.textAlign = left ? "left" : "right";
  const nx = left ? hx + 74 : hx - 74;
  ctx.font = `${fitText(ctx, p.name, 300, 28, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(p.name, nx, 56);
  const [, tierName, tierColor] = p.isAI ? [0, b.aiLabel ?? `Niveau ${b.ai?.name ?? "Confirmé"}`, "#f472b6"] : tierOf(arenaStats(p.id).elo);
  ctx.font = "13px CardBold";
  ctx.fillStyle = tierColor;
  ctx.fillText(p.isAI ? tierName : `${tierName} · ${arenaStats(p.id).elo} pts`, nx, 78);
  // énergie
  for (let k = 0; k < MAX_ENERGY; k++) bolt(ctx, left ? nx + 8 + k * 22 : nx - 8 - k * 22, 98, 9, k < p.energy);
  // statut du choix
  if (opts.status) {
    ctx.font = "12px CardBold";
    ctx.textAlign = "center";
    const [txt, col] = opts.status;
    pill(ctx, cx, 136, txt, col, "#ffffff");
  }
  // carte active
  const f = activeOf(p);
  if (!f) return;
  const cw = 232, ch = 325, x = cx - cw / 2, y = 160;
  glow(ctx, cx, y + ch / 2, 200, METAL[f.card.rarity][4], 0.3);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  if (f.hp <= 0) ctx.filter = "grayscale(1) brightness(0.5)";
  ctx.drawImage(await cardThumb(f.card, isHoloKey(f.key), cw, ch), x, y, cw, ch);
  ctx.restore();
  hpBar(ctx, x - 8, y + ch + 14, cw + 16, 22, f.hp, f.maxHp);
  ctx.textAlign = "center";
  ctx.font = "12px CardBold";
  ctx.fillStyle = "#cbb9a9";
  ctx.fillText(`Attaque ${f.attackDmg} · Spécial ${f.specialDmg} · Chance ${f.luck} · ${SERIES_LABELS[f.series].replace(/^\S+ /, "")}`, cx, y + ch + 50);
  // banc : les autres cartes de l'équipe
  const bench = p.team.map((t, k) => ({ t, k })).filter(({ k }) => k !== p.active);
  bench.forEach(({ t }, n) => {
    const bw = 78, bh = 109, bx = left ? 26 + n * 0 : W - 26 - bw, by = 200 + n * 132;
    const gx = left ? bx : bx;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    if (t.hp <= 0) ctx.filter = "grayscale(1) brightness(0.45)";
    ctx.drawImage(thumbSync(t), gx, by, bw, bh);
    ctx.restore();
    if (t.hp <= 0) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(gx + 12, by + 18);
      ctx.lineTo(gx + bw - 12, by + bh - 18);
      ctx.moveTo(gx + bw - 12, by + 18);
      ctx.lineTo(gx + 12, by + bh - 18);
      ctx.stroke();
    }
    hpBar(ctx, gx, by + bh + 4, bw, 9, t.hp, t.maxHp, false);
  });
  ctx.textAlign = "left";
}
// vignettes du banc préparées à l'avance (dessin synchrone)
const benchThumbs = new Map();
function thumbSync(f) {
  return benchThumbs.get(`${f.key}`) ?? createCanvas(78, 109);
}
async function prepareThumbs(b) {
  for (const p of b.players) for (const f of p.team) if (!benchThumbs.has(f.key)) benchThumbs.set(f.key, await cardThumb(f.card, isHoloKey(f.key), 78, 109));
}
async function drawArena(b, opts = {}) {
  const W = 1200, H = 700;
  b.bg ??= arenaBackground(W, H);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(b.bg, 0, 0);
  await prepareThumbs(b);
  // titre et manche
  ctx.textAlign = "center";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#ecc979";
  spaced(ctx, "ARÈNE DE LA MAISON", W / 2, 40, 4);
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(b.phase === "team" ? "Préparation" : `Manche ${b.round}`, W / 2, 80);
  // médaillon VS
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 16;
  disc(ctx, W / 2, 300, 50, metalGradient(ctx, W, H, METAL.legendaire));
  ctx.restore();
  disc(ctx, W / 2, 300, 42, "#1a0a0d");
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#fde68a";
  ctx.fillText("VS", W / 2, 312);
  ctx.textAlign = "left";
  if (b.phase === "team") {
    for (const [i, p] of b.players.entries()) {
      const cx = i === 0 ? W * 0.25 : W * 0.75;
      ctx.textAlign = "center";
      ctx.font = "26px CardTitle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(p.name, cx, 200);
      ctx.font = "15px CardBold";
      pill(ctx, cx, 236, p.ready ? "ÉQUIPE PRÊTE" : "COMPOSE SON ÉQUIPE…", p.ready ? "#16a34a" : "#d97706", "#ffffff");
      for (let k = 0; k < 3; k++) {
        const x = cx - 150 + k * 104, y = 280;
        roundRect(ctx, x, y, 92, 129, 10);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fill();
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        if (p.ready) ctx.drawImage(drawBack("legendaire"), x, y, 92, 129);
      }
      ctx.textAlign = "left";
    }
  } else {
    for (const i of [0, 1]) await drawFighterSide(ctx, b, i, W, { status: opts.statuses?.[i] });
  }
  // journal de la dernière manche
  const lines = opts.lines ?? b.lastLines ?? [];
  if (lines.length && b.phase !== "team") {
    const lh = 24, boxH = Math.min(4, lines.length) * lh + 24, by = H - boxH - 18;
    roundRect(ctx, W / 2 - 330, by, 660, boxH, 14);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();
    ctx.strokeStyle = rgba(METAL.legendaire[0], 0.35);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.textAlign = "center";
    lines.slice(-4).forEach((l, k) => {
      ctx.font = `${fitText(ctx, l.text, 630, 15, "CardBold")}px CardBold`;
      ctx.fillStyle = l.side === 0 ? "#fde68a" : "#bfdbfe";
      ctx.fillText(l.text, W / 2, by + 28 + k * lh);
    });
    ctx.textAlign = "left";
  }
  // paris des spectateurs
  const pot = b.bets.reduce((a, x) => a + x.amount, 0);
  if (pot > 0) {
    const share = b.bets.filter((x) => x.side === 0).reduce((a, x) => a + x.amount, 0) / pot;
    ctx.textAlign = "center";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#cbb9a9";
    ctx.fillText(`Paris des spectateurs : ${euro(pot)} · ${Math.round(share * 100)} % ${b.players[0].name} / ${Math.round((1 - share) * 100)} % ${b.players[1].name}`, W / 2, 128);
    ctx.textAlign = "left";
  }
  // bannière de fin
  if (opts.banner) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H * 0.44);
    ctx.rotate(-0.05);
    const g = ctx.createLinearGradient(-500, 0, 500, 0);
    g.addColorStop(0, "#78350f");
    g.addColorStop(0.5, "#fde68a");
    g.addColorStop(1, "#78350f");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 30;
    ctx.fillRect(-620, -60, 1240, 120);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#2a1305";
    ctx.textAlign = "center";
    ctx.font = "54px CardEngrave";
    spaced(ctx, opts.banner, 0, 20, 4);
    ctx.restore();
    if (opts.subtitle) {
      ctx.textAlign = "center";
      ctx.font = "22px CardItalic";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(opts.subtitle, W / 2, H * 0.44 + 100);
    }
    ctx.textAlign = "left";
  }
  return c;
}

// --- Animation d'une manche : mise en scène façon cinéma ---
// Révélation des choix, puis chaque coup joué dans l'ordre : élan, ruée, impact (arrêt sur image, tremblement),
// effets propres au type de la carte, bouclier de garde, esquive, critique, K.O. en éclats et entrée du remplaçant.
const FX_COLORS = { voyage: "#38bdf8", paris: "#fde68a", maison: "#f59e0b", entreprises: "#4ade80", evenements: "#f472b6", membres: "#a78bfa" };
const fxColor = (f) => (f.card.role?.color && f.card.role.color !== "#000000" ? f.card.role.color : FX_COLORS[f.series] ?? "#fde68a");
const ease = {
  out: (q) => 1 - (1 - q) ** 3,
  in: (q) => q * q * q,
  inOut: (q) => (q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2),
  back: (q) => 1 + 2.7 * (q - 1) ** 3 + 1.7 * (q - 1) ** 2,
  bounce: (q) => {
    const n = 7.5625, d = 2.75;
    if (q < 1 / d) return n * q * q;
    if (q < 2 / d) return n * (q -= 1.5 / d) * q + 0.75;
    if (q < 2.5 / d) return n * (q -= 2.25 / d) * q + 0.9375;
    return n * (q -= 2.625 / d) * q + 0.984375;
  },
};
function fxImpact(ctx, x, y, q, color, big) {
  const r = (big ? 150 : 95) * ease.out(q);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, x, y, r * 1.5 + 30, color, (1 - q) * 0.95);
  ctx.strokeStyle = rgba(color, 1 - q);
  ctx.lineWidth = 10 * (1 - q) + 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255,255,255,${(1 - q) * 0.95})`;
  ctx.lineWidth = 3;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + q * 0.6, r1 = r * 0.55, r2 = r * (k % 2 ? 1.1 : 1.45);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
    ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
    ctx.stroke();
  }
  ctx.restore();
}
function fxSlash(ctx, x, y, q, color) {
  const len = 360 * ease.out(Math.min(1, q * 1.6)), a = -0.75;
  const x1 = x - (Math.cos(a) * len) / 2, y1 = y - (Math.sin(a) * len) / 2, x2 = x + (Math.cos(a) * len) / 2, y2 = y + (Math.sin(a) * len) / 2;
  ctx.save();
  ctx.globalAlpha = 1 - Math.max(0, q - 0.5) * 2;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 30;
  ctx.strokeStyle = color;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}
function fxSpeedLines(ctx, W, H, alpha, seed) {
  const R = seeded(seed);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#ffffff";
  for (let i = 0; i < 26; i++) {
    const y = 60 + R() * (H - 120), x = R() * W, len = 80 + R() * 220;
    ctx.lineWidth = 1 + R() * 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}
function fxBeam(ctx, x1, y1, x2, y2, q, color) {
  const w = 54 * Math.sin(Math.min(1, q) * Math.PI) + 6, reach = ease.out(Math.min(1, q * 1.8));
  const tx = x1 + (x2 - x1) * reach, ty = y1 + (y2 - y1) * reach;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineCap = "round";
  for (const [lw, col, a] of [[w * 2.2, color, 0.25], [w, color, 0.7], [w * 0.35, "#ffffff", 1]]) {
    ctx.strokeStyle = rgba(col, a);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
  for (let k = 0; k < 10; k++) sparkle(ctx, x1 + (tx - x1) * (k / 10) + Math.sin(q * 20 + k) * 8, y1 + (ty - y1) * (k / 10) + Math.cos(q * 17 + k) * 14, 3, "#ffffff");
  ctx.restore();
}
function fxRings(ctx, x1, y1, x2, y2, q, color) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 5; k++) {
    const p = q * 1.5 - k * 0.12;
    if (p < 0 || p > 1) continue;
    const x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p, r = 26 + 46 * p;
    ctx.strokeStyle = rgba(color, 0.9 - p * 0.4);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r, 0, 0, TAU);
    ctx.stroke();
    glow(ctx, x, y, r, color, 0.35);
    star5(ctx, x, y - r - 8, 7, "#fde68a");
  }
  ctx.restore();
}
function fxCoins(ctx, x1, y1, x2, y2, q, seed) {
  const R = seeded(seed);
  for (let k = 0; k < 18; k++) {
    const delay = R() * 0.45, p = (q - delay) / 0.55, arc = 60 + R() * 120, wob = (R() - 0.5) * 60;
    if (p < 0 || p > 1) continue;
    const x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p - Math.sin(p * Math.PI) * arc + wob * p;
    const spin = Math.abs(Math.cos(p * 18 + k));
    const g = ctx.createLinearGradient(x - 12, y - 12, x + 12, y + 12);
    g.addColorStop(0, "#fef3c7");
    g.addColorStop(0.5, "#f59e0b");
    g.addColorStop(1, "#92400e");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, spin * 13 + 2, 13, 0, 0, TAU);
    ctx.fill();
    if (k % 3 === 0) {
      ctx.fillStyle = "#16a34a";
      ctx.save();
      ctx.translate(x + 20, y + 10);
      ctx.rotate(p * 8 + k);
      ctx.fillRect(-14, -7, 28, 14);
      ctx.restore();
    }
  }
}
function fxFireworks(ctx, x, y, q, seed) {
  const R = seeded(seed), cols = ["#f472b6", "#fbbf24", "#60a5fa", "#a3e635", "#f87171"];
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let f = 0; f < 5; f++) {
    const fx = x + (R() - 0.5) * 220, fy = y + (R() - 0.5) * 220, delay = f * 0.12, p = (q - delay) / 0.6;
    if (p < 0 || p > 1) continue;
    const col = cols[f % cols.length], rad = 20 + ease.out(p) * 90;
    ctx.globalAlpha = 1 - p;
    for (let k = 0; k < 22; k++) {
      const a = (k / 22) * TAU;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * rad * 0.5, fy + Math.sin(a) * rad * 0.5 + p * 10);
      ctx.lineTo(fx + Math.cos(a) * rad, fy + Math.sin(a) * rad + p * 16);
      ctx.stroke();
    }
    glow(ctx, fx, fy, rad, col, 0.5);
  }
  ctx.restore();
}
function fxLightning(ctx, x1, y1, x2, y2, color, seed, width = 4) {
  const R = seeded(seed);
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.lineJoin = "round";
  for (const [lw, col] of [[width * 4, rgba(color, 0.3)], [width, color], [width * 0.4, "#ffffff"]]) {
    const R2 = seeded(seed);
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let k = 1; k < 12; k++) {
      const p = k / 12;
      ctx.lineTo(x1 + (x2 - x1) * p + (R2() - 0.5) * 50, y1 + (y2 - y1) * p + (R2() - 0.5) * 70);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  R();
  ctx.restore();
}
function fxHexShield(ctx, x, y, h, color, alpha, crack) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, h * 0.42, h * 0.62, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = rgba(color, alpha * 0.18);
  ctx.fillRect(x - h, y - h, h * 2, h * 2);
  ctx.strokeStyle = rgba(color, alpha * 0.85);
  ctx.lineWidth = 2;
  const s = 18;
  for (let row = -10; row <= 10; row++) {
    for (let col = -6; col <= 6; col++) {
      const hx = x + col * s * 1.5, hy = y + row * s * 1.73 + (col % 2 ? s * 0.87 : 0);
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(hx + Math.cos((k * TAU) / 6) * s, hy + Math.sin((k * TAU) / 6) * s);
      ctx.closePath();
      ctx.stroke();
    }
  }
  if (crack) {
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 3;
    const R = seeded(Math.round(x));
    for (let k = 0; k < 6; k++) {
      let cx = x, cy = y;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const a = (k / 6) * TAU;
      for (let s2 = 0; s2 < 5; s2++) {
        cx += Math.cos(a) * 22 + (R() - 0.5) * 18;
        cy += Math.sin(a) * 30 + (R() - 0.5) * 18;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(x, y, h * 0.42, h * 0.62, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
function fxCutIn(ctx, W, H, q, thumb, title, sub, color, fromLeft) {
  const inQ = Math.min(1, q / 0.22), outQ = Math.max(0, (q - 0.78) / 0.22);
  const off = (1 - ease.out(inQ)) * W * (fromLeft ? -1 : 1) + ease.in(outQ) * W * (fromLeft ? 1 : -1);
  const y = H / 2 - 70, h = 140;
  ctx.save();
  ctx.translate(off, 0);
  ctx.beginPath();
  ctx.moveTo(0, y + 20);
  ctx.lineTo(W, y);
  ctx.lineTo(W, y + h - 20);
  ctx.lineTo(0, y + h);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "rgba(0,0,0,0.92)");
  g.addColorStop(0.5, rgba(color, 0.55));
  g.addColorStop(1, "rgba(0,0,0,0.92)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  fxSpeedLines(ctx, W, H, 0.35, Math.round(q * 40));
  // portrait de la carte
  const px = fromLeft ? 70 : W - 70 - 150;
  const srcW = thumb.width * 0.84, srcH = srcW * ((h - 12) / 150);
  ctx.drawImage(thumb, thumb.width * 0.08, thumb.height * 0.1, srcW, srcH, px, y + 6, 150, h - 12);
  ctx.restore();
  ctx.save();
  ctx.translate(off, 0);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, y + 20);
  ctx.lineTo(W, y);
  ctx.moveTo(0, y + h);
  ctx.lineTo(W, y + h - 20);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(sub.toUpperCase(), W / 2 + (fromLeft ? 80 : -80), y + 46);
  ctx.font = `${fitText(ctx, title.toUpperCase(), W - 360, 50, "CardEngrave")}px CardEngrave`;
  ctx.shadowColor = color;
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title.toUpperCase(), W / 2 + (fromLeft ? 80 : -80), y + 100);
  ctx.restore();
}
function fxShatter(ctx, thumb, cx, cy, w, h, q, seed) {
  const R = seeded(seed), cols = 4, rows = 5, pw = w / cols, ph = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const vx = (c - 1.5) * (40 + R() * 60), vy = (r - 2) * (30 + R() * 50) - 60, rot = (R() - 0.5) * 6;
      const x = cx - w / 2 + c * pw + pw / 2 + vx * q, y = cy - h / 2 + r * ph + ph / 2 + vy * q + 260 * q * q;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - q * 1.1);
      ctx.translate(x, y);
      ctx.rotate(rot * q);
      ctx.filter = "grayscale(0.6)";
      ctx.drawImage(thumb, (c * thumb.width) / cols, (r * thumb.height) / rows, thumb.width / cols, thumb.height / rows, -pw / 2, -ph / 2, pw, ph);
      ctx.restore();
    }
  }
}

async function clashGif(b, res, hp0, pre) {
  const W = 880, H = 500, CW = 178, CH = 249, gap = W * 0.48;
  const bg = arenaBackground(W, H);
  const thumbs = new Map();
  for (const p of b.players) for (const f of p.team) if (!thumbs.has(f.key)) thumbs.set(f.key, await cardThumb(f.card, isHoloKey(f.key), CW, CH));
  const home = [W / 2 - gap / 2, W / 2 + gap / 2], baseY = 268;
  const vs = b.players.map((p, i) => ({ idx: pre[i], dx: 0, dy: 0, rot: 0, scale: 1, sx: 1, alpha: 1, hp: [...hp0[i]], shield: 0, shieldFlash: 0, crack: false, glow: 0, glowColor: "#ffffff", trail: [], hidden: false, label: 0 }));
  const shots = [];
  const floats = [];
  let shake = 0, darken = 0, flash = 0, flashColor = "#ffffff", overlays = [], frameNo = 0;
  const posOf = (i) => ({ x: home[i] + vs[i].dx, y: baseY + vs[i].dy });
  const addFloat = (i, text, color, size, dy = 0) => floats.push({ i, text, color, size, born: frameNo, dy });
  const draw = (delay = 55) => {
    const c = createCanvas(W, H);
    const ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    const sx = shake ? (Math.random() - 0.5) * shake * 2 : 0, sy = shake ? (Math.random() - 0.5) * shake * 2 : 0;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.drawImage(bg, 0, 0);
    if (darken > 0) {
      ctx.fillStyle = `rgba(0,0,0,${darken * 0.65})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
    ctx.textAlign = "center";
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = "#ecc979";
    spaced(ctx, `MANCHE ${b.round}`, W / 2, 34, 4);
    for (const i of [0, 1]) {
      const s = vs[i], p = b.players[i], f = p.team[s.idx], th = thumbs.get(f.key), { x, y } = posOf(i);
      // traînée de mouvement
      for (const [k, t] of s.trail.entries()) {
        ctx.save();
        ctx.globalAlpha = 0.12 + k * 0.06;
        ctx.drawImage(th, t.x - CW / 2, t.y - CH / 2, CW, CH);
        ctx.restore();
      }
      if (!s.hidden) {
        if (s.glow > 0) glow(ctx, x, y, 170, s.glowColor, s.glow * 0.6);
        ctx.save();
        ctx.globalAlpha = s.alpha;
        ctx.translate(x, y);
        ctx.rotate(s.rot);
        ctx.scale(s.scale * s.sx, s.scale);
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 22;
        ctx.shadowOffsetY = 10;
        if (f.hp <= 0 && s.hp[s.idx] <= 0) ctx.filter = "grayscale(1) brightness(0.55)";
        ctx.drawImage(th, -CW / 2, -CH / 2, CW, CH);
        ctx.restore();
        fxHexShield(ctx, x + (i === 0 ? 70 : -70), y, CH, "#60a5fa", s.shield * (0.55 + s.shieldFlash * 0.45), s.crack);
      }
      // étiquette de l'action révélée
      if (s.label > 0) {
        const a = res.acts[i], name = a.type === "special" ? `SPÉCIAL : ${p.team[res.startIdx[i]].special}` : ACTIONS[a.type].label;
        ctx.save();
        ctx.translate(home[i], baseY - CH / 2 - 30);
        ctx.scale(s.label, s.label);
        ctx.font = "14px CardBold";
        pill(ctx, 0, 0, name.toUpperCase().slice(0, 34), ACTIONS[a.type].color, "#ffffff");
        ctx.restore();
      }
      // barre de vie et nom
      const ff = p.team[s.idx];
      hpBar(ctx, home[i] - CW / 2 - 8, baseY + CH / 2 + 16, CW + 16, 20, s.hp[s.idx], ff.maxHp);
      ctx.font = "13px CardBold";
      ctx.fillStyle = "#cbb9a9";
      ctx.fillText(`${p.name} · ${ff.name}`.slice(0, 40), home[i], baseY + CH / 2 + 56);
    }
    for (const o of overlays) o(ctx);
    // textes flottants
    for (const fl of floats) {
      const life = frameNo - fl.born;
      if (life < 0 || life > 16) continue;
      const { x } = posOf(fl.i), y = baseY - 40 + fl.dy - life * 4.5, a = life > 11 ? 1 - (life - 11) / 5 : 1, pop = life < 2 ? 1.35 - life * 0.17 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.font = `${fl.size}px ${fl.size > 40 ? "CardTitle" : "CardEngrave"}`;
      ctx.lineJoin = "round";
      ctx.lineWidth = fl.size > 40 ? 8 : 5;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(fl.text, 0, 0);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
    if (flash > 0) {
      ctx.fillStyle = rgba(flashColor, flash);
      ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = "left";
    shots.push({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H, delay });
    frameNo++;
  };
  const run = async (n, fn, delays = []) => {
    for (let f = 0; f < n; f++) {
      await yieldLoop();
      fn(n > 1 ? f / (n - 1) : 1, f);
      draw(delays[f] ?? 55);
    }
  };

  // Révélation des choix secrets
  vs.forEach((s, i) => {
    s.shield = 0;
  });
  await run(6, (q) => {
    vs.forEach((s) => (s.label = ease.back(q)));
    flash = q < 0.3 ? 0.35 * (1 - q / 0.3) : 0;
    overlays = [
      (ctx) => {
        ctx.save();
        ctx.textAlign = "center";
        ctx.globalAlpha = 1 - q * 0.6;
        ctx.font = `${40 + 30 * (1 - q)}px CardEngrave`;
        ctx.fillStyle = "#fde68a";
        ctx.shadowColor = "#000000";
        ctx.shadowBlur = 12;
        ctx.fillText("RÉVÉLATION !", W / 2, H / 2 + 14);
        ctx.restore();
      },
    ];
  });
  overlays = [];
  vs.forEach((s, i) => {
    if (res.acts[i].type === "guard") s.shield = 1;
  });

  for (const ev of res.events) {
    const i = ev.side, o = 1 - i, s = vs[i], t = vs[o], toward = i === 0 ? 1 : -1;
    if (ev.kind === "switch") {
      const oldIdx = s.idx;
      await run(4, (q) => {
        s.dx = -toward * ease.in(q) * 260;
        s.alpha = 1 - q;
      });
      s.idx = ev.to;
      s.dx = 0;
      await run(5, (q) => {
        s.alpha = 1;
        s.sx = Math.max(0.05, ease.out(q));
        s.glow = 1 - q;
        s.glowColor = "#22c55e";
      });
      s.sx = 1;
      s.glow = 0;
      void oldIdx;
      continue;
    }
    if (ev.kind === "skip") {
      addFloat(i, "TROP TARD…", "#a1a1aa", 26);
      await run(4, () => {});
      continue;
    }
    if (ev.kind === "ko") {
      const f = b.players[i].team[ev.idx], th = thumbs.get(f.key), { x, y } = posOf(i);
      s.hidden = true;
      addFloat(i, "K.O. !", "#ef4444", 60, 30);
      await run(10, (q) => {
        shake = 6 * (1 - q);
        overlays = [(ctx) => fxShatter(ctx, th, x, y, CW, CH, q, ev.idx * 13 + i)];
      });
      overlays = [];
      shake = 0;
      continue;
    }
    if (ev.kind === "enter") {
      s.idx = ev.idx;
      s.hidden = false;
      s.shield = 0;
      s.crack = false;
      await run(7, (q) => {
        s.dy = -340 * (1 - ease.bounce(q));
        shake = q > 0.55 && q < 0.8 ? 5 : 0;
        overlays = q > 0.5 ? [(ctx) => fxImpact(ctx, home[i], baseY + CH / 2, (q - 0.5) * 2, "#e5e7eb", false)] : [];
      });
      s.dy = 0;
      overlays = [];
      shake = 0;
      continue;
    }
    const att = b.players[i].team[ev.attIdx], color = fxColor(att), th = thumbs.get(att.key);
    if (ev.kind === "counter") {
      await run(3, (q) => {
        s.glow = q;
        s.glowColor = "#60a5fa";
        s.dx = toward * ease.out(q) * 70;
      });
      addFloat(o, `CONTRE ! −${ev.dmg}`, "#93c5fd", 34);
      await run(5, (q) => {
        s.dx = toward * 70 * (1 - ease.out(q));
        t.dx = -toward * 18 * Math.sin(q * Math.PI * 3) * (1 - q);
        t.hp[ev.defIdx] = ev.from + (ev.to - ev.from) * ease.out(q);
        overlays = [(ctx) => fxImpact(ctx, posOf(o).x, posOf(o).y, q, "#60a5fa", false)];
        s.glow = 1 - q;
      });
      overlays = [];
      continue;
    }
    // --- coup : attaque ou spécial ---
    const impactX = () => posOf(o).x, impactY = () => posOf(o).y;
    if (ev.type === "special") {
      // bandeau d'annonce
      await run(7, (q) => {
        darken = Math.min(1, q * 2);
        overlays = [(ctx) => fxCutIn(ctx, W, H, q, th, att.special, `${b.players[i].name} · ${att.name}`, color, i === 0)];
      });
      overlays = [];
      // charge d'énergie
      await run(4, (q) => {
        s.glow = q;
        s.glowColor = color;
        s.scale = 1 + 0.08 * q;
        overlays = [
          (ctx) => {
            const { x, y } = posOf(i);
            for (let k = 0; k < 18; k++) {
              const a = (k / 18) * TAU + q * 3, d = 190 * (1 - q) + 30;
              sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, 3, k % 2 ? "#ffffff" : color);
            }
          },
        ];
      });
      // effet propre au type de la carte
      const style = att.series;
      await run(7, (q) => {
        const { x, y } = posOf(i), tx = impactX(), ty = impactY();
        overlays = [
          (ctx) => {
            if (style === "paris") fxBeam(ctx, x, y - 20, tx, ty, q, color);
            else if (style === "maison") fxRings(ctx, x, y, tx, ty, q, color);
            else if (style === "voyage") fxRings(ctx, x, y, tx, ty, q, "#38bdf8");
            else if (style === "entreprises") fxCoins(ctx, x, y, tx, ty, q, b.round * 7 + i);
            else if (style === "evenements") {
              const p = ease.inOut(Math.min(1, q * 1.4));
              star5(ctx, x + (tx - x) * p, y + (ty - y) * p - Math.sin(p * Math.PI) * 120, 22, "#fde68a");
              if (q > 0.6) fxFireworks(ctx, tx, ty, (q - 0.6) / 0.4, b.round * 11 + i);
            } else for (let k = 0; k < 3; k++) if ((q * 10 + k) % 2 < 1.4) fxLightning(ctx, x, y + (k - 1) * 40, tx, ty + (k - 1) * 30, color, b.round * 31 + k + Math.floor(q * 6), 5);
          },
        ];
      });
    } else {
      // élan puis ruée
      await run(2, (q) => {
        s.dx = -toward * 22 * ease.out(q);
        s.glow = 0.4 * q;
        s.glowColor = color;
      });
      await run(3, (q) => {
        s.trail.push({ ...posOf(i) });
        if (s.trail.length > 3) s.trail.shift();
        s.dx = -toward * 22 + toward * (gap * 0.42 + 22) * ease.in(q);
        overlays = [(ctx) => fxSpeedLines(ctx, W, H, 0.3, frameNo)];
      });
      s.trail = [];
    }
    overlays = [];
    // impact (arrêt sur image)
    const big = ev.type === "special";
    if (ev.dodge) {
      addFloat(o, "ESQUIVE !", "#ffffff", 40);
      await run(5, (q) => {
        t.trail = q < 0.6 ? [{ x: home[o], y: baseY }] : [];
        t.dy = -50 * Math.sin(q * Math.PI);
        t.dx = -toward * 60 * Math.sin(q * Math.PI);
      });
      t.trail = [];
      t.dx = t.dy = 0;
    } else {
      flash = big ? 0.55 : ev.crit ? 0.45 : 0.25;
      flashColor = ev.crit ? "#ffffff" : color;
      shake = big ? 20 : ev.crit ? 15 : 10;
      if (t.shield) t.shieldFlash = 1;
      if (ev.broke) t.crack = true;
      addFloat(o, `−${ev.dmg}`, ev.crit ? "#fbbf24" : "#f87171", ev.crit || big ? 76 : 60);
      const tag = [ev.crit && "CRITIQUE !", ev.broke && "GARDE BRISÉE !", ev.guarded && "GARDE", ev.interrupt && "INTERROMPU !", ev.weakened && "AFFAIBLI", ev.mult > 1 && "SUPER EFFICACE"].filter(Boolean)[0];
      if (tag) addFloat(o, tag, ev.broke || ev.interrupt ? "#fb923c" : "#fde68a", 26, -62);
      await run(
        2,
        (q) => {
          overlays = [(ctx) => fxImpact(ctx, impactX(), impactY(), 0.15 + q * 0.2, color, big), ...(ev.crit ? [(ctx) => fxSlash(ctx, impactX(), impactY(), q * 0.5, "#fde68a")] : [])];
        },
        [big ? 170 : 120, 60]
      );
      flash = 0;
      // recul et vie qui baisse
      await run(big ? 7 : 6, (q) => {
        shake = (big ? 20 : 10) * (1 - q);
        s.dx = ev.type === "attack" ? (-toward * 22 + toward * (gap * 0.42 + 22)) * (1 - ease.out(q)) : 0;
        s.scale = 1 + 0.08 * (1 - q) * (big ? 1 : 0);
        s.glow = Math.max(0, s.glow - 0.2);
        t.dx = -toward * (big ? 46 : 26) * Math.sin(q * Math.PI) * (1 - q * 0.5);
        t.rot = -toward * 0.06 * Math.sin(q * Math.PI * 2) * (1 - q);
        t.hp[ev.defIdx] = ev.from + (ev.to - ev.from) * ease.out(Math.min(1, q * 1.3));
        t.shieldFlash = Math.max(0, 1 - q * 1.5);
        if (ev.broke) t.shield = 1 - q;
        overlays = [(ctx) => fxImpact(ctx, impactX(), impactY(), 0.35 + q * 0.65, color, big), ...(ev.crit ? [(ctx) => fxSlash(ctx, impactX(), impactY(), 0.5 + q * 0.5, "#fde68a")] : [])];
        darken = Math.max(0, darken - 0.2);
      });
    }
    shake = 0;
    s.dx = 0;
    s.scale = 1;
    s.glow = 0;
    t.dx = t.rot = 0;
    darken = 0;
    overlays = [];
  }
  // final : on laisse les floats finir puis on fige
  await run(3, () => {}, [55, 55, 2500]);
  shots[shots.length - 1].once = true;
  shots.forEach((sh) => (sh.once = true));
  const duration = shots.slice(0, -1).reduce((a, sh) => a + sh.delay, 0);
  return { buffer: encodeFrames(shots), duration };
}

// --- Messages du combat ---
function battleComponents(b, disabled = false) {
  const [A, B] = b.players;
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`carte_bt_a_${b.id}_attack`).setLabel("Attaque").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`carte_bt_a_${b.id}_guard`).setLabel("Garde").setEmoji("🛡️").setStyle(ButtonStyle.Primary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`carte_bt_a_${b.id}_special`).setLabel(`Spécial (${SPECIAL_COST} ⚡)`).setEmoji("💥").setStyle(ButtonStyle.Success).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`carte_bt_a_${b.id}_switch`).setLabel("Changer").setEmoji("🔄").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    ),
  ];
  const second = new ActionRowBuilder();
  if (b.round <= BET_ROUNDS && !A.isAI && !B.isAI) {
    second.addComponents(
      new ButtonBuilder().setCustomId(`carte_bt_bet_${b.id}_0`).setLabel(`Parier sur ${A.name}`.slice(0, 80)).setEmoji("🎟️").setStyle(ButtonStyle.Secondary).setDisabled(disabled),
      new ButtonBuilder().setCustomId(`carte_bt_bet_${b.id}_1`).setLabel(`Parier sur ${B.name}`.slice(0, 80)).setEmoji("🎟️").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
    );
  }
  second.addComponents(
    new ButtonBuilder().setCustomId(`carte_bt_rules`).setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`carte_bt_ff_${b.id}`).setLabel("Abandonner").setEmoji("🏳️").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
  rows.push(second);
  return rows;
}
function statusesOf(b) {
  return b.players.map((p) => (p.choice ? ["A CHOISI", "#16a34a"] : ["RÉFLÉCHIT...", "#d97706"]));
}
async function livePayload(b) {
  const img = new AttachmentBuilder(await (await drawArena(b, { statuses: statusesOf(b) })).encode("jpeg", 90), { name: "arene.jpg" });
  const [A, B] = b.players;
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle(`⚔️ ${A.name} contre ${B.name} — manche ${b.round}`)
    .setDescription(
      `⏱️ **Choisissez votre action** — fin de la manche <t:${Math.floor(b.deadline / 1000)}:R>\n` +
        `${A.choice ? "✅" : "⌛"} ${A.name} · ${B.choice ? "✅" : "⌛"} ${B.name}\n` +
        `*Les choix restent secrets jusqu'à la révélation. Sans réponse, la carte se met en garde.*` +
        (b.mise ? `\n💰 Mise : **${formatEuro(b.mise)}** chacun` : "")
    )
    .setImage("attachment://arene.jpg")
    .setFooter({ text: `Défi de la semaine : ${weeklyRule()[1]} — ${weeklyRule()[2]}` });
  return { content: null, embeds: [embed], files: [img], components: battleComponents(b) };
}
async function teamPayload(b) {
  const img = new AttachmentBuilder(await (await drawArena(b)).encode("jpeg", 90), { name: "arene.jpg" });
  const [A, B] = b.players;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(`⚔️ ${A.name} contre ${B.name} — préparation`)
        .setDescription(
          `Chaque joueur choisit **jusqu'à 3 cartes** de sa collection (ou l'équipe automatique, la plus forte).\n` +
            `${A.ready ? "✅" : "⌛"} ${A.name} · ${B.ready ? "✅" : "⌛"} ${B.name}\n` +
            `Le combat commence dès que les deux équipes sont prêtes (équipe automatique <t:${Math.floor(b.deadline / 1000)}:R>).` +
            (b.mise ? `\n💰 Mise : **${formatEuro(b.mise)}** chacun · le gagnant remporte ${formatEuro(Math.round(b.mise * 2 * (1 - ARENA_FEE)))}` : "")
        )
        .setImage("attachment://arene.jpg"),
    ],
    files: [img],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_bt_team_${b.id}`).setLabel("Choisir mon équipe").setEmoji("🃏").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`carte_bt_auto_${b.id}`).setLabel("Équipe automatique").setEmoji("⚡").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_bt_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`carte_bt_ff_${b.id}`).setLabel("Abandonner").setEmoji("🏳️").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
const RULES_EMBED = () =>
  new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle("📖 Règles de l'Arène")
    .setDescription(
      "**Chaque manche**, les deux joueurs choisissent **en secret et en même temps** :\n" +
        "⚔️ **Attaque** — frappe **en priorité** et **interrompt** un spécial adverse (spécial affaibli de 35 %, attaque +20 %).\n" +
        "🛡️ **Garde** — encaisse 50 % d'une attaque, **contre-attaque** et recharge **+2 ⚡**. Elle s'use : 70 % à la 2e garde d'affilée, 90 % à la 3e.\n" +
        `💥 **Spécial** — coûte ${SPECIAL_COST} ⚡ : gros dégâts, impossible à esquiver, et **brise la garde** (qui ne protège plus que 15 %).\n` +
        "🔄 **Changer** — envoie une autre carte de l'équipe *avant* les coups.\n\n" +
        "**Triangle** : la Garde bat l'Attaque, l'Attaque bat le Spécial, le Spécial bat la Garde. Entre deux coups identiques, la carte la plus **chanceuse** frappe la première ; une carte mise K.O. avant son tour ne frappe pas.\n" +
        "**La Maison** progresse : Apprenti → Confirmé → Expert → Maître (un niveau toutes les 3 victoires contre elle).\n\n" +
        `**Énergie** : +1 ⚡ par manche (max ${MAX_ENERGY}). **Critique** et **esquive** dépendent de la CHANCE.\n` +
        "**Types** : 🗼 Paris bat 🏢 Entreprises, qui battent 🏡 La Maison, qui bat 🗼 Paris (×1,25). Membres et Événements sont neutres.\n" +
        `**K.O.** : la carte suivante entre automatiquement. Le premier joueur sans carte perd. Sans réponse en ${ROUND_SECONDS} s, la carte se met en garde.\n\n` +
        `**Classement** : points Elo, rangs Bronze → Argent → Or → Diamant → Légende. **Paris** des spectateurs ouverts pendant les ${BET_ROUNDS} premières manches (commission de ${Math.round(ARENA_FEE * 100)} %).`
    );

// --- Déroulement ---
function playerOf(user, name, isAI = false) {
  return { id: user.id, name, avatar: user.displayAvatarURL({ extension: "png", size: 128 }), isAI, team: [], active: 0, energy: ruleIs("surcharge") ? 3 : 1, choice: null, ready: false, afk: 0 };
}
function escrow(b) {
  const st = load();
  const items = [];
  if (b.mise) for (const p of b.players) if (!p.isAI) items.push({ userId: p.id, amount: b.mise });
  for (const x of b.bets) items.push({ userId: x.userId, amount: x.amount });
  if (items.length) st.arenaEscrow[b.id] = items;
  else delete st.arenaEscrow[b.id];
  save();
}
async function startBattle(client, a, bUser, opts) {
  const id = Date.now().toString(36);
  const ai = bUser.isAI && !opts.island ? aiLevelFor(a.user.id) : null;
  const players = [playerOf(a.user, a.name), playerOf(bUser.user, ai ? `La Maison · ${ai.name}` : bUser.name, bUser.isAI)];
  if (opts.island) players[1].id = `ile:${opts.island}`; // l'IA joue pour le gardien, sans toucher à ses propres combats
  const b = { id, ai, island: opts.island ?? null, aiLevel: opts.aiLevel ?? null, aiLabel: opts.aiLabel ?? null, players, round: 0, phase: "team", mise: opts.mise ?? 0, bets: [], lastLines: [], history: [[], []], deadline: Date.now() + TEAM_SECONDS * 1000, startedAt: Date.now() };
  if (players[1].isAI) {
    players[1].ready = true;
  }
  battles.set(id, b);
  for (const p of players) if (!p.isAI) userBattle.set(p.id, id);
  escrow(b);
  const thread = await chan("arene")?.threads.create({ name: `⚔️ ${players[0].name} vs ${players[1].name}`.slice(0, 95), autoArchiveDuration: 60, reason: "Combat de cartes" }).catch(() => null);
  b.channel = thread ?? chan("arene");
  b.thread = thread;
  const mentions = players.filter((p) => !p.isAI).map((p) => `<@${p.id}>`).join(" ");
  b.message = await b.channel.send({ content: `${mentions} — le combat va commencer !`, ...(await teamPayload(b)), allowedMentions: { users: players.filter((p) => !p.isAI).map((p) => p.id) } }).catch(() => null);
  if (!b.message) {
    await cancelBattle(b, "salon introuvable");
    return null;
  }
  b.timer = setTimeout(() => autoTeams(client, b).catch(() => null), TEAM_SECONDS * 1000);
  return b;
}
const AI_LEVELS = [
  { name: "Apprenti", offset: -1, boost: 1, smart: 0.35 },
  { name: "Confirmé", offset: 0, boost: 1, smart: 0.55 },
  { name: "Expert", offset: 0, boost: 1.08, smart: 0.72 },
  { name: "Maître", offset: 1, boost: 1.15, smart: 0.88 },
];
// le niveau monte toutes les 3 victoires contre la Maison
const aiLevelFor = (userId) => AI_LEVELS[Math.min(AI_LEVELS.length - 1, Math.floor((arenaStats(userId).aiW ?? 0) / 3))];
function aiTeam(b) {
  if (b.island) return islandDefenders(b.island);
  const lvl = b.ai ?? AI_LEVELS[1];
  const ranks = b.players[0].team.map((f) => ORDER.indexOf(f.card.rarity));
  const avg = ranks.length ? Math.round(ranks.reduce((x, y) => x + y, 0) / ranks.length) : 1;
  const target = Math.max(0, Math.min(ORDER.length - 1, avg + lvl.offset));
  const pool = boosterPool().filter((c) => !c.id.startsWith("mb_"));
  const picks = [];
  for (let spread = 0; picks.length < Math.max(1, b.players[0].team.length) && spread < ORDER.length; spread++) {
    const candidates = pool.filter((c) => Math.abs(ORDER.indexOf(c.rarity) - target) === spread && !picks.includes(c));
    while (candidates.length && picks.length < Math.max(1, b.players[0].team.length)) picks.push(candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0]);
  }
  return picks.map((c) => {
    const f = fighter(c.id);
    f.maxHp = f.hp = Math.round(f.maxHp * lvl.boost);
    f.atk = Math.round(f.atk * lvl.boost);
    f.attackDmg = Math.round(10 + f.atk * 0.55);
    f.specialDmg = Math.round(18 + f.atk * 1.1);
    return f;
  });
}
async function setTeam(client, b, i, keys) {
  const p = b.players[i];
  p.team = keys.slice(0, 3).map(fighter);
  p.active = 0;
  p.ready = true;
  if (b.players[1].isAI && i === 0) b.players[1].team = aiTeam(b);
  if (b.players.every((x) => x.ready && x.team.length)) await beginRounds(client, b);
  else await b.message.edit(await teamPayload(b)).catch(() => null);
}
async function autoTeams(client, b) {
  if (b.phase !== "team") return;
  for (const [i, p] of b.players.entries()) {
    if (p.ready && p.team.length) continue;
    const keys = p.isAI ? [] : bestTeam(p.id);
    if (!p.isAI && !keys.length) return cancelBattle(b, `${p.name} n'a aucune carte`);
    if (p.isAI) continue;
    p.team = keys.map(fighter);
    p.ready = true;
    if (b.players[1].isAI && i === 0) b.players[1].team = aiTeam(b);
  }
  await beginRounds(client, b);
}
async function beginRounds(client, b) {
  clearTimeout(b.timer);
  b.phase = "choose";
  b.round = 0;
  await nextRound(client, b);
}
function aiChoice(b) {
  const lvl = b.ai ?? b.aiLevel ?? AI_LEVELS[1];
  const me = b.players[1], foe = b.players[0], f = activeOf(me), o = activeOf(foe);
  const canSpecial = me.energy >= SPECIAL_COST;
  if (Math.random() > lvl.smart) {
    // coup instinctif
    if (canSpecial && Math.random() < 0.5) return { type: "special" };
    return { type: Math.random() < 0.6 ? "attack" : "guard" };
  }
  const atkDmg = (10 + f.atk * 0.55) * typeMult(f.series, o.series);
  // achever une carte affaiblie (l'attaque frappe en priorité)
  if (o.hp <= atkDmg * 0.9) return { type: "attack" };
  // mauvais type : changer pour une carte avantagée
  if (typeMult(o.series, f.series) > 1) {
    const good = aliveBench(me).find(({ f: x }) => typeMult(o.series, x.series) <= 1 && x.hp > x.maxHp * 0.35);
    if (good && Math.random() < 0.75) return { type: "switch", to: good.i };
  }
  // carte presque K.O. : la protéger si une autre peut prendre le relais
  if (f.hp < f.maxHp * 0.2 && aliveBench(me).length && Math.random() < 0.4) return { type: "switch", to: aliveBench(me).sort((x, y) => y.f.hp - x.f.hp)[0].i };
  // lire les habitudes du joueur (les coups récents comptent plus)
  const freq = { attack: 0, guard: 0, special: 0, switch: 0 };
  (b.history?.[0] ?? []).slice(-5).forEach((a, k) => (freq[a] += 1 + k * 0.6));
  let predicted = Object.entries(freq).sort((x, y) => y[1] - x[1])[0][1] > 0 ? Object.entries(freq).sort((x, y) => y[1] - x[1])[0][0] : "attack";
  if (foe.energy >= SPECIAL_COST && Math.random() < 0.55) predicted = "special";
  if ((foe.guardStreak ?? 0) >= 2) predicted = "attack";
  if (predicted === "guard") return canSpecial ? { type: "special" } : { type: Math.random() < 0.6 ? "guard" : "attack" };
  if (predicted === "special") return { type: "attack" };
  if (predicted === "attack") return (me.guardStreak ?? 0) >= 2 ? { type: canSpecial ? "special" : "attack" } : { type: "guard" };
  return canSpecial ? { type: "special" } : { type: "attack" };
}
async function nextRound(client, b) {
  b.round++;
  b.phase = "choose";
  for (const p of b.players) p.choice = null;
  b.deadline = Date.now() + ROUND_SECONDS * 1000;
  if (b.players[1].isAI) b.players[1].choice = aiChoice(b);
  await b.message.edit(await livePayload(b)).catch(() => null);
  clearTimeout(b.timer);
  b.timer = setTimeout(() => roundTimeout(client, b).catch(() => null), ROUND_SECONDS * 1000);
}
async function roundTimeout(client, b) {
  if (b.phase !== "choose") return;
  for (const p of b.players) {
    if (p.choice) p.afk = 0;
    else p.afk++;
  }
  if (b.players.every((p) => p.isAI || p.afk >= 2)) return cancelBattle(b, "aucun joueur n'a répondu");
  await resolveRound(client, b);
}
async function resolveRound(client, b) {
  if (b.phase !== "choose") return;
  b.phase = "resolving";
  clearTimeout(b.timer);
  for (const p of b.players) if (p.choice) p.afk = 0;
  const hp0 = b.players.map((p) => p.team.map((f) => f.hp));
  const pre = b.players.map((p) => p.active);
  const res = resolveRoundState(b);
  res.acts.forEach((a, i) => b.history[i].push(a.type));
  for (const p of b.players) if (!p.isAI) questProgress(p.id, "play_round");
  b.lastLines = res.lines;
  const anim = await clashGif(b, res, hp0, pre).catch((err) => {
    console.error("Animation de combat:", err.message);
    return null;
  });
  const [A, B] = b.players;
  const actText = (i) => {
    const p = b.players[i], a = res.acts[i];
    return `${ACTIONS[a.type].emoji} **${p.name}** : ${a.type === "special" ? `Spécial — ${p.team[res.startIdx[i]].special}` : ACTIONS[a.type].label}${a.auto ? " *(automatique)*" : ""}`;
  };
  if (anim) {
    await b.message
      .edit({
        content: null,
        embeds: [
          new EmbedBuilder()
            .setColor(0xef4444)
            .setTitle(`⚔️ Manche ${b.round} — révélation !`)
            .setDescription(`${actText(0)}\n${actText(1)}\n\n${res.lines.map((l) => `• ${l.text}`).join("\n")}`)
            .setImage("attachment://manche.gif"),
        ],
        files: [new AttachmentBuilder(anim.buffer, { name: "manche.gif" })],
        components: battleComponents(b, true),
      })
      .catch(() => null);
    await sleep(Math.min(14000, anim.duration + 900));
  }
  void A;
  void B;
  const alive = b.players.map((p) => p.team.some((f) => f.hp > 0));
  if (!alive[0] || !alive[1] || b.round >= 30) {
    const winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
    return finishBattle(client, b, winner, winner >= 0 ? "K.O." : "égalité");
  }
  await nextRound(client, b);
}
function eloChange(ra, rb, score) {
  const expected = 1 / (1 + 10 ** ((rb - ra) / 400));
  return Math.round(32 * (score - expected));
}
async function finishBattle(client, b, winner, reason) {
  if (b.phase === "over") return;
  b.phase = "over";
  clearTimeout(b.timer);
  battles.delete(b.id);
  for (const p of b.players) userBattle.delete(p.id);
  const [A, B] = b.players;
  const lines = [];
  const pvp = !A.isAI && !B.isAI;
  // classement
  if (pvp) {
    const sa = arenaStats(A.id), sb = arenaStats(B.id);
    const score = winner === 0 ? 1 : winner === 1 ? 0 : 0.5;
    const da = eloChange(sa.elo, sb.elo, score), db = eloChange(sb.elo, sa.elo, 1 - score);
    sa.elo = Math.max(0, sa.elo + da);
    sb.elo = Math.max(0, sb.elo + db);
    for (const [s, r] of [[sa, score], [sb, 1 - score]]) {
      if (r === 1) {
        s.w++;
        s.streak = Math.max(1, s.streak + 1);
      } else if (r === 0) {
        s.l++;
        s.streak = 0;
      } else s.d++;
    }
    lines.push(`📊 Classement : ${A.name} ${da >= 0 ? "+" : ""}${da} (${sa.elo}) · ${B.name} ${db >= 0 ? "+" : ""}${db} (${sb.elo})`);
  }
  bump("battles");
  for (const [i, p] of b.players.entries()) {
    if (p.isAI) continue;
    if (winner === i) {
      ustat(p.id, "wins");
      ustat(p.id, "streak");
      arenaWeeklyWin(p.id).catch(() => null);
    } else if (winner >= 0) resetStreak(p.id);
  }
  if (winner >= 0 && !b.players[winner].isAI) questProgress(b.players[winner].id, "win_fight");
  // contre la Maison : chaque victoire rapproche du niveau suivant
  if (b.ai && winner === 0) {
    const st = arenaStats(A.id);
    st.aiW = (st.aiW ?? 0) + 1;
    const next = aiLevelFor(A.id);
    lines.push(next.name !== b.ai.name ? `🤖 La Maison passe au niveau **${next.name}** pour vos prochains combats !` : `🤖 Victoires contre la Maison : ${st.aiW} (niveau ${next.name})`);
  }
  // récompenses en poussière d'étoile
  const dustWin = pvp ? 60 : 25, dustLose = pvp ? 20 : 5;
  for (const [i, p] of b.players.entries()) {
    if (p.isAI) continue;
    const gain = winner === i ? dustWin : winner === -1 ? Math.round((dustWin + dustLose) / 2) : dustLose;
    load().dust[p.id] = (load().dust[p.id] ?? 0) + gain;
    lines.push(`✨ ${p.name} : +${gain} poussière d'étoile`);
  }
  // mises
  if (b.mise) {
    if (winner >= 0 && !b.players[winner].isAI) {
      const prize = Math.round(b.mise * 2 * (1 - ARENA_FEE));
      bump("arenaFees", b.mise * 2 - prize);
      changeBalance(b.players[winner].id, prize, `Combat de cartes gagné contre ${b.players[1 - winner].name}`, { force: true });
      lines.push(`💰 ${b.players[winner].name} remporte **${formatEuro(prize)}**`);
    } else {
      for (const p of b.players) if (!p.isAI) changeBalance(p.id, b.mise, "Combat de cartes : mise remboursée", { force: true });
      lines.push("💰 Mises remboursées");
    }
  }
  // paris des spectateurs
  if (b.bets.length) {
    const pot = b.bets.reduce((a, x) => a + x.amount, 0);
    const winners = winner >= 0 ? b.bets.filter((x) => x.side === winner) : [];
    const wsum = winners.reduce((a, x) => a + x.amount, 0);
    if (!wsum) {
      for (const x of b.bets) changeBalance(x.userId, x.amount, "Pari de combat remboursé", { force: true });
      lines.push(`🎟️ Paris remboursés (${formatEuro(pot)})`);
    } else {
      for (const x of winners) changeBalance(x.userId, Math.round((x.amount / wsum) * pot * (1 - ARENA_FEE)), `Pari gagné : victoire de ${b.players[winner].name}`, { force: true });
      bump("arenaFees", Math.round(pot * ARENA_FEE));
      lines.push(`🎟️ ${winners.length} parieur(s) se partagent **${formatEuro(Math.round(pot * (1 - ARENA_FEE)))}**`);
    }
  }
  delete load().arenaEscrow[b.id];
  save();
  for (const p of b.players) if (!p.isAI) checkAchievements(p.id).catch(() => null);
  const banner = winner >= 0 ? `VICTOIRE DE ${b.players[winner].name.toUpperCase()}` : "MATCH NUL";
  const subtitle = `${reason === "abandon" ? "par abandon" : reason === "K.O." ? `en ${b.round} manche${b.round > 1 ? "s" : ""}` : reason}`;
  const img = new AttachmentBuilder(await (await drawArena(b, { banner: banner.slice(0, 34), subtitle })).encode("jpeg", 90), { name: "arene.jpg" });
  await b.message
    ?.edit({
      content: null,
      embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle(`🏆 ${winner >= 0 ? `${b.players[winner].name} remporte le combat !` : "Match nul !"}`).setDescription(lines.join("\n") || null).setImage("attachment://arene.jpg")],
      files: [img],
      components: [],
    })
    .catch(() => null);
  if (b.thread) {
    await chan("arene")
      ?.send({ content: `⚔️ ${winner >= 0 ? `**${b.players[winner].name}** bat **${b.players[1 - winner].name}**` : `Match nul entre **${A.name}** et **${B.name}**`} ${subtitle} — ${b.thread}`, allowedMentions: { parse: [] } })
      .then((m) => deleteLater(m, MINUTE))
      .catch(() => null);
    setTimeout(() => b.thread.delete("Combat terminé").catch(() => b.thread.setArchived(true).catch(() => null)), MINUTE);
  }
  panelDirty = true;
}
async function cancelBattle(b, why) {
  if (b.phase === "over") return;
  b.phase = "over";
  clearTimeout(b.timer);
  battles.delete(b.id);
  for (const p of b.players) userBattle.delete(p.id);
  for (const x of load().arenaEscrow[b.id] ?? []) changeBalance(x.userId, x.amount, "Combat de cartes annulé : remboursement", { force: true });
  delete load().arenaEscrow[b.id];
  save();
  await b.message?.edit({ content: `🚫 Combat annulé : ${why}. Les mises et les paris sont remboursés.`, embeds: [], components: [], attachments: [] }).catch(() => null);
  if (b.thread) setTimeout(() => b.thread.delete("Combat annulé").catch(() => b.thread.setArchived(true).catch(() => null)), MINUTE);
}
// remboursement des combats interrompus par un redémarrage
function refundInterruptedBattles() {
  const st = load();
  for (const [id, items] of Object.entries(st.arenaEscrow)) {
    for (const x of items) changeBalance(x.userId, x.amount, "Combat de cartes interrompu : remboursement", { force: true });
    delete st.arenaEscrow[id];
  }
  save();
}
function arenaLeaderboard() {
  return Object.entries(load().arena)
    .filter(([, s]) => s.w + s.l + s.d > 0)
    .sort((a, b) => b[1].elo - a[1].elo)
    .slice(0, 10)
    .map(([id, s], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} <@${id}> — **${s.elo}** · ${tierOf(s.elo)[1]} · ${s.w} V / ${s.l} D${s.streak >= 3 ? ` · 🔥 ${s.streak}` : ""}`)
    .join("\n");
}
function arenaMenuPayload(userId) {
  const s = arenaStats(userId), [, tier] = tierOf(s.elo);
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("⚔️ Arène de la Maison")
        .setDescription(
          `Votre rang : **${tier}** · **${s.elo}** points · ${s.w} victoire(s), ${s.l} défaite(s)${s.streak >= 2 ? ` · 🔥 série de ${s.streak}` : ""}\n\n` +
            "Défiez un membre (avec une mise si vous voulez, par `/combat`) ou entraînez-vous contre **la Maison**."
        )
        .addFields({ name: "🏆 Classement", value: arenaLeaderboard() || "*Aucun combat pour le moment.*" }),
    ],
    components: [
      new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("carte_bt_pick").setPlaceholder("⚔️ Défier un membre…")),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_bt_ai").setLabel("Affronter la Maison").setEmoji("🤖").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_bt_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
async function sendChallenge(client, interaction, target, targetName, mise) {
  const userId = interaction.user.id;
  if (!target || target.bot || target.id === userId) return "Choisissez un autre membre (pas vous-même, ni un bot).";
  if (userBattle.has(userId)) return "Vous êtes déjà en combat.";
  if (userBattle.has(target.id)) return `${targetName} est déjà en combat.`;
  if (!ownedKeys(userId).length) return "Il vous faut au moins une carte pour combattre.";
  if (!ownedKeys(target.id).length) return `${targetName} n'a encore aucune carte.`;
  if (mise && readBalance(userId) < mise) return `Vous n'avez pas ${formatEuro(mise)}.`;
  const cid = Date.now().toString(36);
  const fromName = interaction.member?.displayName ?? interaction.user.username;
  const ch = { id: cid, from: interaction.user, fromName, to: target, toName: targetName, mise };
  const sa = arenaStats(userId), sb = arenaStats(target.id);
  ch.message = await chan("arene")
    ?.send({
      content: `⚔️ <@${target.id}>, **${fromName}** vous défie en combat de cartes !`,
      embeds: [
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle(`⚔️ ${fromName} défie ${targetName}`)
          .setDescription(
            `${fromName} : **${tierOf(sa.elo)[1]}** (${sa.elo} pts) · ${targetName} : **${tierOf(sb.elo)[1]}** (${sb.elo} pts)\n` +
              (mise ? `💰 Mise : **${formatEuro(mise)}** chacun — le gagnant remporte ${formatEuro(Math.round(mise * 2 * (1 - ARENA_FEE)))}\n` : "") +
              `Le défi expire <t:${Math.floor(Date.now() / 1000) + CHALLENGE_MINUTES * 60}:R>.`
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`carte_bt_ok_${cid}`).setLabel("Accepter le défi").setEmoji("⚔️").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`carte_bt_no_${cid}`).setLabel("Refuser").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`carte_bt_x_${cid}`).setLabel("Annuler (auteur)").setStyle(ButtonStyle.Secondary)
        ),
      ],
      allowedMentions: { users: [target.id] },
    })
    .catch(() => null);
  if (!ch.message) return "Impossible de publier le défi.";
  challenges.set(cid, ch);
  setTimeout(() => {
    if (!challenges.has(cid)) return;
    challenges.delete(cid);
    ch.message.edit({ content: `⌛ Le défi de **${fromName}** à **${targetName}** a expiré.`, embeds: [], components: [] }).catch(() => null);
    deleteLater(ch.message, MINUTE);
  }, CHALLENGE_MINUTES * 60000);
  client.users.fetch(target.id).then((u) => u.send(`⚔️ **${fromName}** vous défie en combat de cartes : ${ch.message.url}`)).catch(() => null);
  return null;
}



