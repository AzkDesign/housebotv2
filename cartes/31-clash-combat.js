
// --- Clash de la Maison : troupes, simulation du combat, images et animation ---
const TROOP_ROLES = {
  colosse: { name: "Colosse", emoji: "🛡️", desc: "vise les défenses, très résistant" },
  pillard: { name: "Pillard", emoji: "💰", desc: "vise les mines et les coffres (dégâts ×2)" },
  tireur: { name: "Tireur", emoji: "🏹", desc: "attaque à distance, plus fragile" },
  heros: { name: "Héros", emoji: "👑", desc: "carte de membre : très puissant" },
  eclaireur: { name: "Éclaireur", emoji: "💨", desc: "rapide, vise le bâtiment le plus proche" },
};
function troopRole(card) {
  const s = seriesOf(card);
  if (s === "membres") return "heros";
  if (s === "maison") return "colosse";
  if (s === "entreprises") return "pillard";
  if (s === "paris") return "tireur";
  return "eclaireur";
}
function makeTroop(key) {
  const f = fighter(key), role = troopRole(f.card);
  const t = { key, card: f.card, role, name: f.name, hp: f.maxHp * 2.2, dps: (10 + f.atk * 0.55) * 1.9, speed: 1.35, range: 0.9 };
  if (role === "colosse") Object.assign(t, { hp: t.hp * 1.6, dps: t.dps * 0.8, speed: 0.8 });
  if (role === "pillard") Object.assign(t, { speed: 1.35 });
  if (role === "tireur") Object.assign(t, { hp: t.hp * 0.75, range: 3.2 });
  if (role === "heros") Object.assign(t, { hp: t.hp * 2, dps: t.dps * 1.5, speed: 1 });
  if (role === "eclaireur") Object.assign(t, { speed: 1.6 });
  t.maxHp = t.hp;
  return t;
}

// --- Simulation (pas de 0,5 s, 45 s au maximum) ---
function clashSimulate(base, keys, seed = Date.now()) {
  const R = seeded(seed);
  const DT = 0.5, MAX_T = 120;
  const blds = clashLayout(base).map((b) => {
    const def = CLASH_BUILDINGS[b.type];
    return { ...b, def, hp: def.hp(b.level), maxHp: def.hp(b.level), dead: false, active: def.kind === "defense" && !b.upgrading };
  });
  const totalHp = blds.reduce((a, b) => a + b.maxHp, 0);
  // déploiement : toutes les troupes arrivent par un même côté
  const side = Math.floor(R() * 4), troops = keys.map(makeTroop);
  troops.forEach((t, k) => {
    const p = (k + 0.5) / troops.length;
    if (side === 0) Object.assign(t, { x: p * CLASH_GRID, y: 0.6 });
    else if (side === 1) Object.assign(t, { x: CLASH_GRID - 0.6, y: p * CLASH_GRID });
    else if (side === 2) Object.assign(t, { x: p * CLASH_GRID, y: CLASH_GRID - 0.6 });
    else Object.assign(t, { x: 0.6, y: p * CLASH_GRID });
    t.dead = false;
    t.target = null;
  });
  const frames = [];
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (let tick = 0; tick < MAX_T; tick++) {
    const shots = [], booms = [];
    // troupes
    for (const t of troops) {
      if (t.dead) continue;
      if (!t.target || t.target.dead) {
        let pool = blds.filter((b) => !b.dead);
        if (t.role === "colosse" && pool.some((b) => b.def.kind === "defense")) pool = pool.filter((b) => b.def.kind === "defense");
        if (t.role === "pillard" && pool.some((b) => ["resource", "storage"].includes(b.def.kind))) pool = pool.filter((b) => ["resource", "storage"].includes(b.def.kind));
        t.target = pool.sort((a, b) => dist(t, a) - dist(t, b))[0] ?? null;
      }
      const tg = t.target;
      if (!tg) continue;
      const reach = dist(t, tg) - tg.def.size / 2;
      if (reach > t.range) {
        const d = dist(t, tg), step = Math.min(t.speed * DT, reach - t.range + 0.05);
        t.x += ((tg.x - t.x) / d) * step;
        t.y += ((tg.y - t.y) / d) * step;
      } else {
        const mult = t.role === "pillard" && ["resource", "storage"].includes(tg.def.kind) ? 2 : 1;
        tg.hp -= t.dps * DT * mult;
        if (t.range > 2) shots.push({ x1: t.x, y1: t.y, x2: tg.x, y2: tg.y, color: "#fde68a", troop: true });
        if (tg.hp <= 0 && !tg.dead) {
          tg.dead = true;
          booms.push({ x: tg.x, y: tg.y, size: tg.def.size });
        }
      }
    }
    // défenses
    for (const b of blds) {
      if (b.dead || !b.active) continue;
      const inRange = troops.filter((t) => !t.dead && dist(t, b) <= b.def.range && dist(t, b) >= (b.def.minRange ?? 0)).sort((a, c) => dist(a, b) - dist(c, b));
      const tg = inRange[0];
      if (!tg) continue;
      const dmg = b.def.dps(b.level) * DT;
      if (b.def.splash) {
        for (const t of troops) if (!t.dead && dist(t, tg) <= b.def.splash) t.hp -= dmg;
      } else tg.hp -= dmg;
      shots.push({ x1: b.x, y1: b.y, x2: tg.x, y2: tg.y, color: b.def.color, splash: Boolean(b.def.splash) });
      for (const t of troops) if (!t.dead && t.hp <= 0) t.dead = true;
    }
    const destroyedHp = blds.reduce((a, b) => a + (b.dead ? b.maxHp : Math.max(0, b.maxHp - Math.max(0, b.hp))), 0);
    const pct = Math.min(100, Math.round((blds.filter((b) => b.dead).length / blds.length) * 100));
    frames.push({
      t: tick * DT,
      troops: troops.map((t) => ({ x: t.x, y: t.y, hp: Math.max(0, t.hp) / t.maxHp, dead: t.dead, key: t.key })),
      blds: blds.map((b) => ({ id: b.id, hp: Math.max(0, b.hp) / b.maxHp, dead: b.dead })),
      shots,
      booms,
      pct,
      dmgPct: Math.round((destroyedHp / totalHp) * 100),
    });
    if (troops.every((t) => t.dead) || blds.every((b) => b.dead)) break;
  }
  const last = frames.at(-1);
  const pct = last.pct, manoirDead = blds.find((b) => b.type === "manoir")?.dead;
  const stars = (pct >= 50 ? 1 : 0) + (manoirDead ? 1 : 0) + (pct >= 100 ? 1 : 0);
  return { frames, blds, troops, pct, stars, duration: last.t };
}

// --- Dessin ---
const clashImgs = new Map();
async function clashIcon(name) {
  if (clashImgs.has(name)) return clashImgs.get(name);
  const img = await fetchImage(`fluent:${name}`, fluentUrl(name));
  clashImgs.set(name, img);
  return img;
}
const groundCache = new Map();
function clashGround(W, H, seed) {
  const key = `${W}x${H}:${seed % 7}`;
  if (groundCache.has(key)) return groundCache.get(key);
  const c = createCanvas(W, H), ctx = c.getContext("2d"), R = seeded(seed % 7 + 3);
  const g = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.75);
  g.addColorStop(0, "#4d7c0f");
  g.addColorStop(1, "#1a2e05");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${R() < 0.5 ? "190,242,100" : "20,40,10"},${0.05 + R() * 0.08})`;
    ctx.fillRect(R() * W, R() * H, 2 + R() * 3, 2 + R() * 3);
  }
  // fleurs et cailloux
  for (let i = 0; i < 40; i++) disc(ctx, R() * W, R() * H, 1.5 + R() * 2, ["#fde68a", "#fbcfe8", "#e2e8f0"][i % 3]);
  // grille discrète
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  for (let k = 0; k <= CLASH_GRID; k++) {
    const x = (k / CLASH_GRID) * W, y = (k / CLASH_GRID) * H;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  groundCache.set(key, c);
  return c;
}
async function drawBuilding(ctx, b, px, py, cell, state = {}) {
  const def = CLASH_BUILDINGS[b.type], s = def.size * cell;
  ctx.save();
  if (state.dead) {
    // décombres
    ctx.globalAlpha = 0.85;
    for (let k = 0; k < 9; k++) {
      const a = k * 0.7, r = s * 0.15 + (k % 3) * s * 0.08;
      disc(ctx, px + Math.cos(a) * r, py + Math.sin(a) * r * 0.7, s * 0.1, k % 2 ? "#57534e" : "#78716c");
    }
    ctx.restore();
    return;
  }
  // ombre et socle
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(px + 3, py + s * 0.42, s * 0.5, s * 0.16, 0, 0, TAU);
  ctx.fill();
  roundRect(ctx, px - s / 2, py - s / 2, s, s, s * 0.22);
  const g = ctx.createLinearGradient(px - s / 2, py - s / 2, px + s / 2, py + s / 2);
  g.addColorStop(0, rgba(def.color, 0.95));
  g.addColorStop(1, rgba(def.color, 0.55));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.stroke();
  const img = await clashIcon(def.fluent);
  if (img) ctx.drawImage(img, px - s * 0.42, py - s * 0.48, s * 0.84, s * 0.84);
  // niveau
  disc(ctx, px + s * 0.4, py - s * 0.4, cell * 0.42, "#111827");
  ctx.fillStyle = "#fde68a";
  ctx.textAlign = "center";
  ctx.font = `${Math.round(cell * 0.5)}px CardBold`;
  ctx.fillText(String(b.level), px + s * 0.4, py - s * 0.4 + cell * 0.18);
  if (b.upgrading && !state.battle) {
    disc(ctx, px - s * 0.4, py - s * 0.4, cell * 0.42, "#f59e0b");
    const ham = await clashIcon("Hammer");
    if (ham) ctx.drawImage(ham, px - s * 0.4 - cell * 0.32, py - s * 0.4 - cell * 0.32, cell * 0.64, cell * 0.64);
  }
  if (state.hp !== undefined && state.hp < 1) {
    const w = s * 0.9;
    roundRect(ctx, px - w / 2, py + s * 0.52, w, cell * 0.28, cell * 0.14);
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();
    roundRect(ctx, px - w / 2, py + s * 0.52, Math.max(2, w * state.hp), cell * 0.28, cell * 0.14);
    ctx.fillStyle = state.hp > 0.5 ? "#22c55e" : state.hp > 0.25 ? "#eab308" : "#ef4444";
    ctx.fill();
  }
  if (def.kind === "defense" && state.showRange) {
    ctx.strokeStyle = rgba(def.color, 0.18);
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(px, py, def.range * cell, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}
async function clashDecor(ctx, base, M, top, cell) {
  const R = seeded(hashOf(base.owner) + 11), c = CLASH_GRID / 2, layout = clashLayout(base);
  const px = (x) => M + x * cell, py = (y) => top + y * cell;
  // chemins de terre du Manoir vers chaque bâtiment
  ctx.strokeStyle = "rgba(161,98,7,0.55)";
  ctx.lineCap = "round";
  ctx.lineWidth = cell * 0.9;
  for (const b of layout) {
    if (b.type === "manoir") continue;
    ctx.beginPath();
    ctx.moveTo(px(c), py(c));
    ctx.quadraticCurveTo(px((c + b.x) / 2 + (R() - 0.5) * 2), py((c + b.y) / 2 + (R() - 0.5) * 2), px(b.x), py(b.y));
    ctx.stroke();
  }
  // muret de pierre autour des défenses
  const wallR = 6.1;
  for (let k = 0; k < 64; k++) {
    if (k % 16 === 0 || k % 16 === 1) continue; // ouvertures
    const a = (k / 64) * TAU, x = px(c + Math.cos(a) * wallR), y = py(c + Math.sin(a) * wallR * 0.92);
    roundRect(ctx, x - cell * 0.36, y - cell * 0.28, cell * 0.72, cell * 0.56, cell * 0.12);
    ctx.fillStyle = k % 2 ? "#a8a29e" : "#78716c";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // arbres, rochers et fleurs loin des bâtiments
  const free = (x, y) => layout.every((b) => Math.hypot(b.x - x, b.y - y) > CLASH_BUILDINGS[b.type].size + 0.8) && Math.abs(Math.hypot(x - c, y - c) - wallR) > 1;
  const deco = [];
  for (let k = 0; k < 140 && deco.length < 22; k++) {
    const x = 1 + R() * (CLASH_GRID - 2), y = 1 + R() * (CLASH_GRID - 2);
    if (free(x, y) && deco.every((d) => Math.hypot(d.x - x, d.y - y) > 1.6)) deco.push({ x, y, kind: ["Deciduous tree", "Evergreen tree", "Rock", "Sunflower", "Herb"][Math.floor(R() * 5)] });
  }
  for (const d of deco.sort((a, b) => a.y - b.y)) {
    const img = await clashIcon(d.kind), s = cell * (d.kind.includes("tree") ? 1.8 : 1);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(px(d.x) + 2, py(d.y) + s * 0.4, s * 0.38, s * 0.12, 0, 0, TAU);
    ctx.fill();
    if (img) ctx.drawImage(img, px(d.x) - s / 2, py(d.y) - s / 2, s, s);
  }
}
// image de la base (vue de dessus)
async function drawClashBase(base, opts = {}) {
  const W = 760, H = 860, M = 30, cell = (W - 2 * M) / CLASH_GRID, top = 130;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#0b1406";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(clashGround(W - 2 * M, W - 2 * M, hashOf(base.owner)), M, top);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire);
  roundRect(ctx, M - 4, top - 4, W - 2 * M + 8, W - 2 * M + 8, 14);
  ctx.stroke();
  await clashDecor(ctx, base, M, top, cell);
  for (const b of clashLayout(base)) await drawBuilding(ctx, b, M + b.x * cell, top + b.y * cell, cell, { showRange: opts.ranges });
  // bandeau
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#86efac";
  ctx.fillText(base.ghost ? "MAISON FANTÔME" : "CLASH DE LA MAISON", M, 36);
  ctx.font = `${fitText(ctx, base.name, 460, 36, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(base.name, M, 76);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Manoir niveau ${manoirOf(base)} · ${base.buildings.filter((x) => x.level > 0).length} bâtiments`, M, 104);
  const chip = (x, label, value, color) => {
    roundRect(ctx, x, 22, 130, 46, 12);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.fill();
    ctx.font = "12px CardEngrave";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(label, x + 65, 40);
    ctx.font = "18px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + 65, 61);
    ctx.textAlign = "left";
  };
  chip(W - M - 270, "OR", Math.floor(base.res.or).toLocaleString("fr-FR"), "#fbbf24");
  chip(W - M - 130, "ESSENCE", Math.floor(base.res.essence).toLocaleString("fr-FR"), "#c084fc");
  if (!base.ghost) {
    ctx.font = "16px CardBold";
    ctx.fillStyle = "#fde68a";
    ctx.textAlign = "right";
    ctx.fillText(`${base.trophies} trophées${base.shield > Date.now() ? " · bouclier actif" : ""}`, W - M, 104);
    ctx.textAlign = "left";
  }
  return c;
}
// jeton d'une troupe : l'illustration de la carte dans un médaillon
const tokenCache = new Map();
async function troopToken(key, size) {
  const k = `${key}:${size}`;
  if (tokenCache.has(k)) return tokenCache.get(k);
  const card = cardOfKey(key), c = createCanvas(size, size), ctx = c.getContext("2d");
  disc(ctx, size / 2, size / 2, size / 2, METAL[card.rarity][2] ?? "#fde68a");
  disc(ctx, size / 2, size / 2, size / 2 - 3, "#111827");
  const art = await artImage(card);
  if (art) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, TAU);
    ctx.clip();
    ctx.drawImage(art, 3, 3, size - 6, size - 6);
    ctx.restore();
  }
  tokenCache.set(k, c);
  return c;
}
// animation du combat
async function clashBattleGif(base, sim, attackerName) {
  const W = 640, M = 20, top = 70, cell = (W - 2 * M) / CLASH_GRID, H = top + (W - 2 * M) + 20;
  const ground = createCanvas(W, H);
  {
    const g = ground.getContext("2d");
    g.fillStyle = "#0b1406";
    g.fillRect(0, 0, W, H);
    g.drawImage(clashGround(W - 2 * M, W - 2 * M, hashOf(base.owner)), M, top);
    await clashDecor(g, base, M, top, cell);
  }
  const layout = clashLayout(base);
  const tokens = new Map();
  for (const t of sim.troops) tokens.set(t.key, await troopToken(t.key, Math.round(cell * 1.3)));
  const shots = [];
  const step = Math.max(1, Math.ceil(sim.frames.length / 48));
  const picks = sim.frames.filter((_, i) => i % step === 0 || i === sim.frames.length - 1);
  const boomsSeen = [];
  for (const [fi, fr] of picks.entries()) {
    await yieldLoop();
    const c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.drawImage(ground, 0, 0);
    const bmap = new Map(fr.blds.map((b) => [b.id, b]));
    for (const b of layout) {
      const st = bmap.get(b.id);
      await drawBuilding(ctx, b, M + b.x * cell, top + b.y * cell, cell, { battle: true, dead: st?.dead, hp: st?.hp });
    }
    // explosions récentes
    for (const k of sim.frames.slice(Math.max(0, sim.frames.indexOf(fr) - step), sim.frames.indexOf(fr) + 1)) for (const bm of k.booms) boomsSeen.push({ ...bm, at: fi });
    for (const bm of boomsSeen.filter((x) => fi - x.at < 3)) {
      const age = (fi - bm.at) / 3, x = M + bm.x * cell, y = top + bm.y * cell;
      glow(ctx, x, y, cell * 3 * (0.6 + age), "#f97316", 0.8 * (1 - age));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU, r = cell * (0.8 + age * 2.2);
        disc(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r, cell * 0.18 * (1 - age), k % 2 ? "#fde68a" : "#ef4444");
      }
    }
    // tirs
    for (const s of fr.shots) {
      const x1 = M + s.x1 * cell, y1 = top + s.y1 * cell, x2 = M + s.x2 * cell, y2 = top + s.y2 * cell;
      ctx.strokeStyle = rgba(s.color, 0.85);
      ctx.lineWidth = s.troop ? 1.5 : 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      disc(ctx, x2, y2, s.splash ? cell * 0.7 : cell * 0.22, rgba(s.color, s.splash ? 0.4 : 0.9));
    }
    // troupes
    for (const t of fr.troops) {
      if (t.dead) continue;
      const tk = tokens.get(t.key), x = M + t.x * cell, y = top + t.y * cell, s = cell * 1.3;
      ctx.drawImage(tk, x - s / 2, y - s / 2, s, s);
      ctx.strokeStyle = t.hp > 0.5 ? "#22c55e" : t.hp > 0.25 ? "#eab308" : "#ef4444";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, s / 2 + 1, -Math.PI / 2, -Math.PI / 2 + TAU * t.hp);
      ctx.stroke();
    }
    // tableau de bord
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, 0, W, top - 6);
    ctx.textAlign = "left";
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = "#86efac";
    ctx.fillText(`${attackerName} attaque`.slice(0, 40).toUpperCase(), 18, 26);
    ctx.font = `${fitText(ctx, base.name, 330, 24, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(base.name, 18, 54);
    ctx.textAlign = "right";
    ctx.font = "30px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${fr.pct} %`, W - 18, 46);
    ctx.font = "13px CardBold";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`${Math.max(0, Math.round(60 - fr.t))} s`, W - 18, 62);
    const curStars = (fr.pct >= 50 ? 1 : 0) + (fr.blds.find((b) => layout.find((l) => l.id === b.id)?.type === "manoir")?.dead ? 1 : 0) + (fr.pct >= 100 ? 1 : 0);
    for (let k = 0; k < 3; k++) star5(ctx, W - 190 + k * 34, 36, 13, k < curStars ? "#fbbf24" : "rgba(255,255,255,0.18)");
    // résultat
    if (fi === picks.length - 1) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, H / 2 - 70, W, 140);
      ctx.textAlign = "center";
      ctx.font = "54px CardTitle";
      ctx.fillStyle = sim.stars ? "#fbbf24" : "#f87171";
      ctx.fillText(sim.stars ? "VICTOIRE" : "DÉFAITE", W / 2, H / 2 - 4);
      for (let k = 0; k < 3; k++) star5(ctx, W / 2 - 60 + k * 60, H / 2 + 40, 24, k < sim.stars ? "#fbbf24" : "rgba(255,255,255,0.2)");
    }
    shots.push({ data: ctx.getImageData(0, 0, W, H).data, width: W, height: H, delay: fi === picks.length - 1 ? 5000 : 110 });
  }
  shots.forEach((s) => (s.once = true));
  return encodeFrames(shots);
}
