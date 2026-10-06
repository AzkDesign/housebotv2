
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

