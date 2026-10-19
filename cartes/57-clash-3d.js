
// --- Clash de la Maison : la refonte en 3D ---
// Les images (base, cible, bataille) sont rendues par le moteur 3D du dossier clash3d/, dans un fil séparé :
// vraie géométrie, soleil de fin de journée et ombres portées, matières (pierre, bois, tuiles, marbre, or),
// mer de nuages. Le bot ajoute par-dessus l'interface (panneaux en verre, icônes 3D, bulles, barres de vie),
// les projectiles, explosions et titres de la cinématique. En cas de problème, l'ancien rendu 2D prend le relais.
const CLASH3D = require(path.join(__dirname, "clash3d"));

// ---------- données envoyées au moteur 3D ----------
function clash3dData(base, layout) {
  const decor = islandDecor(base, layout);
  return {
    seed: hashOf(base.owner),
    tier: tierOfLevel(manoirOf(base)),
    layout: layout.map((b) => ({ id: b.id, type: b.type, level: b.level, x: b.x, y: b.y, upgrading: !!b.upgrading })),
    decor: { items: decor.items.map((d) => ({ x: d.x, y: d.y, kind: d.kind, v: d.v })), wall: decor.wall.map((w) => ({ x: w.x, y: w.y })) },
  };
}
const c3Canvas = (data, w, h) => {
  const c = createCanvas(w, h), x = c.getContext("2d"), im = x.createImageData(w, h);
  im.data.set(data);
  x.putImageData(im, 0, 0);
  return c;
};
// icônes 3D (pièce, cristal, trophée, étoiles, bouclier, marteau), rendues une seule fois
let c3IconsP = null;
function clash3dIcons() {
  c3IconsP ??= CLASH3D.renderIcons({ size: 112 })
    .then((raw) => Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, c3Canvas(v.data, v.width, v.height)])))
    .catch((err) => {
      c3IconsP = null;
      throw err;
    });
  return c3IconsP;
}
const c3Icon = (ctx, icons, name, x, y, s) => {
  ctx.save();
  if (name === "starOff") ctx.globalAlpha *= 0.6;
  ctx.drawImage(icons[name], x - s / 2, y - s / 2, s, s);
  ctx.restore();
};

// ---------- interface « verre et or » ----------
function c3Panel(ctx, x, y, w, h, r = 18, alpha = 0.82) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, `rgba(30,26,48,${alpha})`);
  g.addColorStop(1, `rgba(10,8,18,${alpha + 0.06})`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  // reflet vitré sur la moitié haute
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.55);
  gl.addColorStop(0, "rgba(255,255,255,0.14)");
  gl.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gl;
  ctx.fillRect(x, y, w, h * 0.55);
  ctx.restore();
  // liseré doré biseauté
  const gb = ctx.createLinearGradient(x, y, x + w, y + h);
  gb.addColorStop(0, "#fff1c4");
  gb.addColorStop(0.35, "#d4a53c");
  gb.addColorStop(0.7, "#8a5a16");
  gb.addColorStop(1, "#f3d98b");
  ctx.strokeStyle = gb;
  ctx.lineWidth = 2.5;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, Math.max(4, r - 4));
  ctx.stroke();
}
// barre « tube de verre » remplie de liquide
function c3Tube(ctx, x, y, w, h, frac, color) {
  roundRect(ctx, x, y, w, h, h / 2);
  const tg = ctx.createLinearGradient(0, y, 0, y + h);
  tg.addColorStop(0, "rgba(0,0,0,0.75)");
  tg.addColorStop(1, "rgba(40,36,60,0.75)");
  ctx.fillStyle = tg;
  ctx.fill();
  const fw = Math.max(h, (w - 4) * Math.min(1, Math.max(0, frac)));
  roundRect(ctx, x + 2, y + 2, fw, h - 4, (h - 4) / 2);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, shade(color, 1.55));
  g.addColorStop(0.35, shade(color, 1.1));
  g.addColorStop(0.75, shade(color, 0.75));
  g.addColorStop(1, shade(color, 0.55));
  ctx.fillStyle = g;
  ctx.fill();
  // reflet du verre
  roundRect(ctx, x + 6, y + 3, Math.max(0, w - 12), Math.max(2, h * 0.28), h * 0.14);
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.fill();
}
// médaillon de niveau (hexagone doré, chiffre en relief)
function c3Level(ctx, x, y, L, s = 1) {
  const tier = tierOfLevel(L), col = ["#b45309", "#475569", "#7c3aed"][tier];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const hex = (r) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) ctx.lineTo(Math.cos((k / 6) * TAU - Math.PI / 2) * r, Math.sin((k / 6) * TAU - Math.PI / 2) * r);
    ctx.closePath();
  };
  hex(13);
  const g = ctx.createLinearGradient(-13, -13, 13, 13);
  g.addColorStop(0, "#fff1c4");
  g.addColorStop(0.5, "#d4a53c");
  g.addColorStop(1, "#7a4a10");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = "transparent";
  hex(10);
  const g2 = ctx.createLinearGradient(0, -10, 0, 10);
  g2.addColorStop(0, shade(col, 1.4));
  g2.addColorStop(1, shade(col, 0.7));
  ctx.fillStyle = g2;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "13px CardBold";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(String(L), 0.5, 5.5);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(L), 0, 4.5);
  ctx.restore();
}
// bulle de récolte (verre dépoli, icône 3D)
function c3Bubble(ctx, icons, x, y, res, frac, amount) {
  const full = frac >= 0.999;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  roundRect(ctx, x - 38, y - 30, 76, 52, 18);
  const g = ctx.createLinearGradient(0, y - 30, 0, y + 22);
  g.addColorStop(0, full ? "#fffbeb" : "#ffffff");
  g.addColorStop(1, full ? "#fde68a" : "#e2e8f0");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x - 9, y + 21);
  ctx.lineTo(x + 9, y + 21);
  ctx.lineTo(x, y + 33);
  ctx.closePath();
  ctx.fillStyle = full ? "#fde68a" : "#e2e8f0";
  ctx.fill();
  if (full) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;
    roundRect(ctx, x - 38, y - 30, 76, 52, 18);
    ctx.stroke();
    glow(ctx, x, y - 4, 70, "#fbbf24", 0.28);
  }
  c3Icon(ctx, icons, res === "or" ? "coin" : "crystal", x, y - 9, 30);
  ctx.textAlign = "center";
  ctx.font = "13px CardBold";
  ctx.fillStyle = full ? "#92400e" : "#1f2937";
  ctx.fillText(full ? "PLEIN" : amount.toLocaleString("fr-FR"), x, y + 15);
}

// ============================================================
// Image d'une base (accueil, cible)
// ============================================================
const C3_BASE = { W: 1200, H: 980, rect: [24, 172, 1176, 846] };
async function drawClashBase3D(base, opts = {}) {
  const { W, H, rect } = C3_BASE;
  const layout = clashLayout(base);
  const [scene, icons] = await Promise.all([CLASH3D.renderBase({ W, H, rect, data: clash3dData(base, layout), ss: 2 }), clash3dIcons()]);
  const c = c3Canvas(scene.data, W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const cam = CLASH3D.fitCamera(W, H, rect);
  const P = (gx, gy, h = 0) => {
    const [wx, , wz] = CLASH3D.gridToWorld(gx, gy);
    return cam.project(wx, h, wz);
  };
  // portée des défenses (vue de cible) : cercles posés au sol
  if (opts.ranges)
    for (const b of layout) {
      const def = CLASH_BUILDINGS[b.type];
      if (def.kind !== "defense") continue;
      ctx.save();
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * TAU, [x, y] = P(b.x + Math.cos(a) * def.range, b.y + Math.sin(a) * def.range, 0.05);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(def.color, 0.12);
      ctx.fill();
      ctx.strokeStyle = rgba(def.color, 0.75);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 7]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  // bandeau du haut : nom, manoir, trophées
  c3Panel(ctx, 20, 18, 560, 122);
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(base.ghost ? "MAISON FANTÔME" : opts.ranges ? "CIBLE REPÉRÉE" : "CLASH DE LA MAISON", 44, 52);
  ctx.font = `${fitText(ctx, base.name, 360, 38, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(base.name, 44, 94);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(`Manoir niveau ${manoirOf(base)}`, 44, 124);
  if (!base.ghost) {
    c3Icon(ctx, icons, "trophy", 486, 70, 64);
    ctx.textAlign = "center";
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(String(base.trophies), 486, 128);
  }
  // ressources
  c3Panel(ctx, 600, 18, 580, 122);
  const cap = clashCap(base), rates = clashRates(base), buf = clashBuffers(base), prize = lootOf(base, 100);
  const sub = (res) =>
    opts.ranges || base.ghost
      ? { text: `jusqu'à ${prize[res].toLocaleString("fr-FR")} à piller`, color: "#fca5a5" }
      : buf[res] > 0
        ? { text: `${buf[res].toLocaleString("fr-FR")} à récolter`, color: "#86efac" }
        : { text: `+${rates[res]} par heure`, color: "#cbd5e1" };
  for (const [i, res] of ["or", "essence"].entries()) {
    const x = 620 + i * 282, y = 40;
    c3Icon(ctx, icons, res === "or" ? "coin" : "crystal", x + 20, y + 14, 44);
    c3Tube(ctx, x + 46, y + 2, 212, 26, base.res[res] / cap, res === "or" ? "#f59e0b" : "#a855f7");
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${Math.floor(base.res[res]).toLocaleString("fr-FR")} / ${cap.toLocaleString("fr-FR")}`, x + 152, y + 20);
    const s2 = sub(res);
    ctx.textAlign = "left";
    ctx.fillStyle = s2.color;
    ctx.fillText(s2.text, x + 48, y + 50);
  }
  if (!base.ghost && base.shield > Date.now()) {
    c3Icon(ctx, icons, "shield", 632, 124, 26);
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#93c5fd";
    ctx.fillText("Bouclier actif", 650, 129);
  }
  // ouvriers
  if (!base.ghost && !opts.ranges) {
    const works = base.buildings.filter((x) => x.upgrading);
    c3Panel(ctx, 20, H - 116, W - 40, 96);
    ctx.textAlign = "left";
    ctx.font = "14px CardEngrave";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("OUVRIERS", 44, H - 86);
    for (let k = 0; k < CLASH_BUILDERS; k++) {
      const x = 44 + k * 560, y = H - 74, w = works[k];
      c3Icon(ctx, icons, "hammer", x + 16, y + 20, 34);
      ctx.font = "16px CardBold";
      ctx.fillStyle = w ? "#ffffff" : "#94a3b8";
      ctx.fillText(w ? `${CLASH_BUILDINGS[w.type].name} : passage au niveau ${w.upgrading.to}` : "Libre — prêt à construire", x + 42, y + 16);
      if (w) {
        const total = CLASH_BUILDINGS[w.type].time(w.upgrading.to) * MINUTE, left = Math.max(0, w.upgrading.done - Date.now());
        c3Tube(ctx, x + 42, y + 26, 360, 16, 1 - left / Math.max(1, total), "#facc15");
        ctx.font = "13px CardBold";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`encore ${minutesText(Math.ceil(left / MINUTE))}`, x + 414, y + 39);
      }
    }
  }
  // par-dessus l'interface : médaillons, chantiers et bulles restent toujours visibles
  // médaillons de niveau et chantiers
  for (const b of layout) {
    const a = scene.anchors[b.id];
    if (!a) continue;
    c3Level(ctx, a.topX + a.halfW * 0.55, a.topY - 6, Math.max(1, b.level), 0.82);
    if (b.upgrading && !opts.ranges) {
      const left = Math.max(0, b.upgrading.done - Date.now());
      const txt = minutesText(Math.max(1, Math.ceil(left / MINUTE)));
      ctx.font = "13px CardBold";
      const w = ctx.measureText(txt).width + 40;
      roundRect(ctx, a.topX - w / 2, a.topY - 44, w, 26, 13);
      ctx.fillStyle = "rgba(17,12,6,0.82)";
      ctx.fill();
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      c3Icon(ctx, icons, "hammer", a.topX - w / 2 + 14, a.topY - 31, 20);
      ctx.textAlign = "left";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(txt, a.topX - w / 2 + 27, a.topY - 26);
    }
  }
  // bulles de récolte au-dessus des mines et distilleries
  if (!base.ghost && !opts.ranges)
    for (const b of layout) {
      const def = CLASH_BUILDINGS[b.type];
      if (!def.res || b.upgrading) continue;
      const stock = base.buildings.find((x) => x.id === b.id)?.stock ?? 0, max = def.rate(b.level) * CLASH_BUFFER_HOURS;
      if (stock < def.rate(b.level) * 0.5) continue;
      const a = scene.anchors[b.id];
      // jamais sur le bandeau du haut : la bulle descend sur le toit si besoin
      if (a) c3Bubble(ctx, icons, a.topX, Math.max(a.topY - 52, 180), def.res, stock / max, Math.floor(stock));
    }
  return c;
}
{
  const flat = drawClashBase;
  drawClashBase = async (base, opts = {}) => {
    try {
      return await drawClashBase3D(base, opts);
    } catch (err) {
      console.error("[clash 3D] base : rendu 2D de secours —", err.message);
      return flat(base, opts);
    }
  };
}

// ============================================================
// La bataille : cinématique en 3D
// ============================================================
async function clashBattleGif3D(base, sim, attackerName, info = {}) {
  const OW = 640, OH = 480, WW = 1440, WH = 1080, FULL = OW / WW, rect = [80, 150, WW - 80, WH - 120];
  const cam3 = CLASH3D.fitCamera(WW, WH, rect);
  const layout = clashLayout(base), data = clash3dData(base, layout);
  const P = (gx, gy, h = 0) => {
    const [wx, , wz] = CLASH3D.gridToWorld(gx, gy);
    const p = cam3.project(wx, h, wz);
    return [p[0], p[1]];
  };
  const unit = Math.hypot(P(13, 12)[0] - P(12, 12)[0], P(13, 12)[1] - P(12, 12)[1]), K = unit / 44, BS = CLASH3D.BSCALE;
  const H3 = { manoir: 3.6, mine: 1.3, distillerie: 1.9, coffre: 1.8, caserne: 1.2, canon: 1.0, tour: 3.9, mortier: 1.1 };
  const topH = (b) => (H3[b.type] ?? 1.5) * BS * (b.type === "tour" || b.type === "manoir" ? 1 + 0.04 * b.level : 1);
  const muzzleH = (b) => (b.type === "tour" ? 2.35 + 0.15 * b.level + 0.6 : b.type === "mortier" ? 0.9 : 0.75) * BS;
  const byPos = (x, y) => layout.find((l) => Math.abs(l.x - x) < 0.01 && Math.abs(l.y - y) < 0.01);
  const seed = hashOf(base.owner), RS = seeded(seed + 3);
  const roleOf = new Map(sim.troops.map((t) => [t.key, t.role]));
  const ringOf = new Map(sim.troops.map((t) => [t.key, METAL[t.card.rarity]?.[2] ?? "#fde68a"]));
  const loot = info.loot ?? { or: 0, essence: 0 }, trophies = info.trophies ?? 0, last = sim.frames.at(-1);
  const deadIds = new Set(last.blds.filter((b) => b.dead).map((b) => b.id));
  const holders = {
    or: layout.filter((b) => deadIds.has(b.id) && ["mine", "coffre", "manoir"].includes(b.type)).map((b) => b.id),
    essence: layout.filter((b) => deadIds.has(b.id) && ["distillerie", "coffre", "manoir"].includes(b.type)).map((b) => b.id),
  };
  const lootAt = (id) => ({ or: holders.or.includes(id) ? Math.floor(loot.or / holders.or.length) : 0, essence: holders.essence.includes(id) ? Math.floor(loot.essence / holders.essence.length) : 0 });
  const manoir = layout.find((l) => l.type === "manoir");
  const [icx, icy] = P(CLASH_GRID / 2, CLASH_GRID / 2);
  const center = { x: icx, y: icy + 10 * K };
  const cam = { x: center.x, y: center.y, s: FULL };
  const troopCenter = (fr) => {
    const alive = fr.troops.filter((t) => !t.dead);
    if (!alive.length) return center;
    const pts = alive.map((t) => P(t.x, t.y, 0.5));
    return { x: pts.reduce((a, p) => a + p[0], 0) / pts.length, y: pts.reduce((a, p) => a + p[1], 0) / pts.length };
  };
  const spawn = sim.frames[0].troops.map((t) => ({ ...t }));
  const yaws = new Map();
  for (const t of spawn) yaws.set(t.key, Math.atan2(CLASH_GRID / 2 - t.y, CLASH_GRID / 2 - t.x));
  const plan = [];
  let shake = 0;
  // ---------- 1. on prépare chaque image (caméra, état du monde, dessins par-dessus) ----------
  const crop = () => {
    const sw = OW / cam.s, sh = OH / cam.s;
    const jx = shake ? (RS() - 0.5) * shake * 2 * K : 0, jy = shake ? (RS() - 0.5) * shake * 2 * K : 0;
    const x0 = Math.max(0, Math.min(WW - sw, cam.x - sw / 2 + jx)), y0 = Math.max(0, Math.min(WH - sh, cam.y - sh / 2 + jy));
    return [x0, y0, sw, sh];
  };
  const statesOf = (fr) => Object.fromEntries(fr.blds.filter((b) => b.dead).map((b) => [b.id, "ruine"]));
  const aimsOf = (fr) => {
    const out = {};
    for (const s of fr.shots) {
      if (s.troop) continue;
      const b = byPos(s.x1, s.y1);
      if (b) out[b.id] = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    }
    return out;
  };
  const troopsOf = (fr, prev, t) =>
    fr.troops
      .filter((x) => !x.dead)
      .map((x) => {
        const p = prev?.troops.find((y) => y.key === x.key);
        const moved = p && Math.hypot(x.x - p.x, x.y - p.y) > 0.02;
        if (moved) yaws.set(x.key, Math.atan2(x.y - p.y, x.x - p.x));
        const h = hashOf(x.key) % 100;
        return { x: x.x, y: x.y, role: roleOf.get(x.key), ring: ringOf.get(x.key), yaw: yaws.get(x.key) ?? 0, phase: moved ? t * 11 + h : Math.sin(t * 6 + h) * 0.5 };
      });
  const add = (fr, opts) => plan.push({ fr, crop: crop(), t: opts.t, states: statesOf(fr), aims: opts.noShots ? {} : aimsOf(fr), troops: opts.hideTroops ? [] : troopsOf(fr, opts.prev, opts.t), world: opts.world ?? [], screen: opts.screen ?? null, delay: opts.delay, scene: opts.scene });
  // dessins dans le monde (coordonnées de l'image 3D)
  const portalsFx = (a) => (ctx) => {
    for (const p of spawn) {
      const [x, y] = P(p.x, p.y);
      glow(ctx, x, y - 10 * K, 46 * K, "#a855f7", 0.7 * a);
      ctx.strokeStyle = `rgba(233,213,255,${0.9 * a})`;
      ctx.lineWidth = 3 * K;
      ctx.beginPath();
      ctx.ellipse(x, y, 20 * K, 9 * K, 0, 0, TAU);
      ctx.stroke();
      const g = ctx.createLinearGradient(0, y - 120 * K, 0, y);
      g.addColorStop(0, "rgba(216,180,254,0)");
      g.addColorStop(1, `rgba(216,180,254,${0.55 * a})`);
      ctx.fillStyle = g;
      ctx.fillRect(x - 12 * K, y - 120 * K, 24 * K, 120 * K);
    }
  };
  const shotsFx = (fr, idx) => (ctx) => {
    for (const s of fr.shots) {
      const b = s.troop ? byPos(s.x2, s.y2) : byPos(s.x1, s.y1);
      const [x1, y1] = s.troop ? P(s.x1, s.y1, 0.5) : P(s.x1, s.y1, b ? muzzleH(b) : 0.8);
      const [x2, y2] = s.troop ? P(s.x2, s.y2, b ? topH(b) * 0.45 : 0.8) : P(s.x2, s.y2, 0.45);
      const p = 0.35 + ((idx * 0.37) % 0.5);
      const arc = (s.splash ? 90 : s.troop ? 10 : 18) * K, px = x1 + (x2 - x1) * p, py = y1 + (y2 - y1) * p - Math.sin(p * Math.PI) * arc;
      if (s.troop) {
        const a = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = "#fef3c7";
        ctx.lineWidth = 2.5 * K;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * 12 * K, py - Math.sin(a) * 12 * K);
        ctx.lineTo(px, py);
        ctx.stroke();
        glow(ctx, x2, y2, 14 * K, "#fde68a", 0.5);
      } else if (s.splash) {
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5 * K;
        ctx.setLineDash([2 * K, 6 * K]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1 + x2) / 2, Math.min(y1, y2) - 120 * K, px, py);
        ctx.stroke();
        ctx.setLineDash([]);
        glow(ctx, px, py, 18 * K, "#fb923c", 0.5);
        disc(ctx, px, py, 6 * K, "#111827");
        glow(ctx, x2, y2, 38 * K, "#f97316", 0.35);
        ctx.strokeStyle = "rgba(251,146,60,0.75)";
        ctx.lineWidth = 2 * K;
        ctx.beginPath();
        ctx.ellipse(x2, y2, 34 * K, 15 * K, 0, 0, TAU);
        ctx.stroke();
      } else if (b?.type === "tour") {
        const a = Math.atan2(y2 - y1, x2 - x1);
        ctx.strokeStyle = "#e2e8f0";
        ctx.lineWidth = 2.5 * K;
        ctx.beginPath();
        ctx.moveTo(px - Math.cos(a) * 15 * K, py - Math.sin(a) * 15 * K);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else {
        // boulet de canon : éclair à la bouche, traînée de fumée
        glow(ctx, x1 + (x2 - x1) * 0.06, y1 + (y2 - y1) * 0.06, 24 * K, "#fde68a", 0.7);
        const a = Math.atan2(y2 - y1, x2 - x1);
        for (let k = 1; k < 4; k++) disc(ctx, px - Math.cos(a) * k * 7 * K, py - Math.sin(a) * k * 7 * K, (4 - k) * K, `rgba(203,213,225,${0.5 - k * 0.12})`);
        disc(ctx, px, py, 5 * K, "#111827");
        disc(ctx, px - 1.5 * K, py - 1.5 * K, 1.6 * K, "#9ca3af");
      }
    }
  };
  const damageFx = (fr, t) => (ctx) => {
    const bm = new Map(fr.blds.map((b) => [b.id, b]));
    for (const b of layout) {
      const st = bm.get(b.id);
      if (!st) continue;
      const h = topH(b);
      if (st.dead) {
        const [x, y] = P(b.x, b.y, 0.3);
        smoke(ctx, x, y, t, 3, true);
        continue;
      }
      if (st.hp < 0.6) {
        const [x, y] = P(b.x, b.y, h * 0.75);
        smoke(ctx, x, y, t, 3, st.hp < 0.35);
      }
      if (st.hp < 0.35) {
        const [x, y] = P(b.x, b.y, h * 0.45);
        flames(ctx, x - 6 * K, y, 15 * K, t);
      }
      if (st.hp < 1) {
        const [x, y] = P(b.x, b.y, h + 0.4);
        hpBarIso(ctx, x, y, 48 * K, st.hp);
      }
    }
    for (const tr of fr.troops)
      if (!tr.dead && tr.hp < 1) {
        const [x, y] = P(tr.x, tr.y, 1.35);
        hpBarIso(ctx, x, y, 20 * K, tr.hp);
      }
  };
  const booms = [], popups = [];
  const boomFx = (list) => (ctx) => {
    for (const bm of list) {
      const [x, y] = P(bm.x, bm.y, 0.4);
      explosion(ctx, x, y, bm.q, (0.8 + (bm.size ?? 2) * 0.12) * K * 1.15, Math.round(bm.x * 31 + bm.y * 17));
    }
  };
  const popupFx = (list) => (ctx) => {
    for (const pp of list) {
      const [x, y] = P(pp.x, pp.y, 2.4);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(K, K);
      lootPopup(ctx, 0, 0, pp.q, pp.amt);
      ctx.restore();
    }
  };
  // tableau de bord pendant l'assaut (coordonnées de l'image finale)
  let banked = { or: 0, essence: 0 };
  const hudFx = (fr, alpha, bank, icons) => (ctx) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    c3Panel(ctx, 14, 12, OW - 28, 80, 16, 0.78);
    ctx.textAlign = "left";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#86efac";
    ctx.fillText(`${info.war ? "Guerre — " : ""}${attackerName} attaque`.toUpperCase().slice(0, 44), 34, 40);
    ctx.font = `${fitText(ctx, base.name, OW - 420, 28, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(base.name, 34, 74);
    const bmap = new Map(fr.blds.map((b) => [b.id, b]));
    const stars = (fr.pct >= 50 ? 1 : 0) + (manoir && bmap.get(manoir.id)?.dead ? 1 : 0) + (fr.pct >= 100 ? 1 : 0);
    for (let k = 0; k < 3; k++) c3Icon(ctx, icons, k < stars ? "star" : "starOff", OW - 318 + k * 42, 52, 38);
    ctx.textAlign = "right";
    ctx.font = "38px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${fr.pct} %`, OW - 34, 62);
    ctx.font = "12px CardBold";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(`${Math.max(0, Math.round(60 - fr.t))} s`, OW - 34, 82);
    const alive = fr.troops.filter((x) => !x.dead).length;
    c3Panel(ctx, 14, OH - 66, 280, 52, 14, 0.78);
    ctx.textAlign = "left";
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`Soldats : ${alive} / ${fr.troops.length}`, 32, OH - 34);
    for (let k = 0; k < Math.min(8, fr.troops.length); k++) {
      const tr = fr.troops[k];
      ctx.globalAlpha = alpha * (tr.dead ? 0.25 : 1);
      drawSoldier(ctx, 160 + k * 15, OH - 24, roleOf.get(tr.key), 0, 1, ringOf.get(tr.key), 0.72);
    }
    ctx.globalAlpha = alpha;
    if (!info.war) {
      c3Panel(ctx, OW - 284, OH - 66, 270, 52, 14, 0.78);
      c3Icon(ctx, icons, "coin", OW - 258, OH - 40, 30);
      c3Icon(ctx, icons, "crystal", OW - 136, OH - 40, 30);
      ctx.textAlign = "left";
      ctx.font = "18px CardTitle";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(bank.or.toLocaleString("fr-FR"), OW - 238, OH - 33);
      ctx.fillStyle = "#e9d5ff";
      ctx.fillText(bank.essence.toLocaleString("fr-FR"), OW - 116, OH - 33);
    }
    ctx.restore();
  };
  const icons = await clash3dIcons();
  // ----- intro : l'île apparaît, la caméra plonge, titre -----
  const spawnC = troopCenter(sim.frames[0]);
  const INTRO = 8;
  for (let f = 0; f < INTRO; f++) {
    const p = f / (INTRO - 1);
    cam.s = lerp(FULL, 0.98, easeOut(p));
    cam.x = lerp(center.x, lerp(center.x, spawnC.x, 0.45), easeOut(p));
    cam.y = lerp(center.y, lerp(center.y, spawnC.y, 0.45), easeOut(p));
    const portals = f >= 4 ? (f - 3) / 4 : 0;
    add(sim.frames[0], {
      t: p * 0.9,
      hideTroops: true,
      noShots: true,
      scene: "intro",
      delay: f === INTRO - 1 ? 160 : 90,
      world: portals ? [portalsFx(portals)] : [],
      screen: (ctx) => {
        if (f < 3) {
          ctx.fillStyle = `rgba(0,0,0,${1 - f / 3})`;
          ctx.fillRect(0, 0, OW, OH);
        }
        letterbox(ctx, OW, OH, 1);
        const ta = f < 2 ? 0 : f <= 5 ? Math.min(1, (f - 1) / 3) : 1 - (f - 5) / 3.2;
        const sc = f < 2 ? 1.6 : 1 + 0.6 * (1 - easeOut((f - 2) / 4));
        outlinedText(ctx, info.war ? "GUERRE DES ÉQUIPES" : "CLASH DE LA MAISON", OW / 2, OH / 2 - 92, "18px CardEngrave", `rgba(253,230,138,${Math.max(0, ta)})`);
        bigTitle(ctx, "À L'ASSAUT !", OW / 2, OH / 2 - 10, 92, ["#ffffff", "#fbbf24"], ta, sc);
        ctx.save();
        ctx.globalAlpha = Math.max(0, ta);
        outlinedText(ctx, `${attackerName}  contre  ${base.name}`, OW / 2, OH / 2 + 42, "26px CardBold", "#ffffff");
        ctx.restore();
      },
    });
  }
  // ----- le combat, suivi par la caméra -----
  const step = Math.max(1, Math.ceil(sim.frames.length / 24));
  const picks = sim.frames.map((f, i) => ({ f, i })).filter(({ i }) => i % step === 0 || i === sim.frames.length - 1);
  let prev = null, manoirDone = false;
  for (const [fi, { f: fr, i: idx }] of picks.entries()) {
    const startK = prev ? sim.frames.indexOf(prev) + 1 : 0;
    let manoirNow = false;
    for (let k = startK; k <= idx; k++)
      for (const b of sim.frames[k].booms) {
        const l = byPos(b.x, b.y);
        booms.push({ ...b, id: l?.id, at: fi });
        shake = Math.max(shake, 10 + (b.size ?? 2) * 2);
        if (l && l.id === manoir?.id) manoirNow = true;
        const amt = l ? lootAt(l.id) : null;
        if (amt && amt.or + amt.essence > 0 && !info.war) popups.push({ x: b.x, y: b.y, amt, at: fi });
      }
    for (const pp of popups) if (pp.at === fi) (banked.or += pp.amt.or), (banked.essence += pp.amt.essence);
    if (fi === picks.length - 1) banked = { ...loot };
    const tc = troopCenter(fr), tgt = { x: lerp(center.x, tc.x, 0.7), y: lerp(center.y, tc.y, 0.7) };
    const e = fi < 3 ? 0.12 : 0.24;
    cam.x = lerp(cam.x, tgt.x, e);
    cam.y = lerp(cam.y, tgt.y, e);
    cam.s = lerp(cam.s, 1.06, 0.2);
    const bl = booms.filter((x) => fi - x.at < 5).map((x) => ({ ...x, q: (fi - x.at) / 5 }));
    const pl = popups.filter((x) => fi - x.at < 9).map((x) => ({ ...x, q: (fi - x.at) / 9 }));
    const bank = { ...banked }, lb = Math.max(0, 1 - fi / 4), hudA = Math.min(1, fi / 3);
    add(fr, {
      t: fr.t,
      prev,
      scene: `combat${Math.floor(fi / 12)}`,
      delay: 125,
      world: [...(fi < 6 ? [portalsFx(1 - fi / 6)] : []), damageFx(fr, fr.t), shotsFx(fr, idx), boomFx(bl), popupFx(pl)],
      screen: (ctx) => {
        letterbox(ctx, OW, OH, lb);
        hudFx(fr, hudA, bank, icons)(ctx);
        if (fi < 4) bigTitle(ctx, "DÉPLOIEMENT", OW / 2, OH / 2 - 120, 40, ["#f3e8ff", "#a855f7"], 1 - fi / 4);
      },
    });
    shake *= 0.55;
    if (shake < 1) shake = 0;
    // le Manoir tombe : ralenti, zoom et bannière
    if (manoirNow && !manoirDone) {
      manoirDone = true;
      const [mx, my] = P(manoir.x, manoir.y, 1);
      const s0 = cam.s, x0 = cam.x, y0 = cam.y;
      for (let k = 0; k < 7; k++) {
        const q = k / 6;
        cam.s = lerp(s0, 1.38, easeOut(q * 1.6));
        cam.x = lerp(x0, mx, easeOut(q * 1.6));
        cam.y = lerp(y0, my - 20 * K, easeOut(q * 1.6));
        shake = k < 4 ? 16 - k * 3 : 0;
        add(fr, {
          t: fr.t + k * 0.04,
          prev,
          noShots: true,
          scene: "manoir",
          delay: k === 6 ? 450 : 150,
          world: [damageFx(fr, fr.t + k * 0.04), boomFx([{ x: manoir.x, y: manoir.y, size: 6, q: Math.min(1, q * 1.15) }])],
          screen: (ctx) => {
            if (k < 2) {
              ctx.fillStyle = `rgba(255,251,235,${k ? 0.35 : 0.75})`;
              ctx.fillRect(0, 0, OW, OH);
            }
            letterbox(ctx, OW, OH, Math.min(1, k / 2));
            if (k >= 2) {
              const a = Math.min(1, (k - 1) / 2);
              bigTitle(ctx, "MANOIR DÉTRUIT", OW / 2, OH / 2 + 112, 60, ["#ffffff", "#f87171"], a, 1 + 0.4 * (1 - easeOut((k - 2) / 3)));
              ctx.save();
              ctx.globalAlpha = a;
              c3Icon(ctx, icons, "star", OW / 2 - 40, OH / 2 + 146, 32);
              outlinedText(ctx, "+1 étoile", OW / 2 - 18, OH / 2 + 153, "18px CardBold", "#fde68a", "left");
              ctx.restore();
            }
          },
        });
      }
      shake = 0;
    }
    prev = fr;
  }
  // ----- bilan : la caméra recule, les étoiles tombent, le butin défile -----
  const OUT = 13, endT = last.t;
  const cs = cam.s, cx0 = cam.x, cy0 = cam.y;
  for (let o = 0; o < OUT; o++) {
    const p = easeOut(o / 6);
    cam.s = lerp(cs, FULL, p);
    cam.x = lerp(cx0, center.x, p);
    cam.y = lerp(cy0, center.y, p);
    add(last, {
      t: endT + o * 0.08,
      noShots: true,
      scene: "bilan",
      delay: o === OUT - 1 ? 6000 : o < 6 ? 90 : 120,
      world: [damageFx(last, endT + o * 0.08)],
      screen: (ctx) => {
        ctx.fillStyle = `rgba(8,6,20,${0.6 * Math.min(1, o / 5)})`;
        ctx.fillRect(0, 0, OW, OH);
        letterbox(ctx, OW, OH, Math.min(1, o / 4));
        if (o >= 2) {
          const win = sim.stars > 0, q = Math.min(1, (o - 2) / 3);
          bigTitle(ctx, win ? "VICTOIRE" : "DÉFAITE", OW / 2, OH / 2 - 92, 96, win ? ["#ffffff", "#fbbf24"] : ["#ffffff", "#f87171"], q, 1 + 0.5 * (1 - easeOut(q)));
          ctx.save();
          ctx.globalAlpha = q;
          outlinedText(ctx, `${sim.pct} % de destruction`, OW / 2, OH / 2 - 52, "20px CardBold", "#e2e8f0");
          ctx.restore();
        }
        for (let k = 0; k < 3; k++) {
          const x = OW / 2 + (k - 1) * 100, y = OH / 2 + 18, at = 4 + k * 2;
          if (k < sim.stars && o >= at) {
            const q = Math.min(1, (o - at) / 2);
            if (o - at === 2) glow(ctx, x, y, 110, "#fde68a", 0.8);
            c3Icon(ctx, icons, "star", x, y - 90 * (1 - easeOut(q)), 84 * (1.5 - 0.5 * q));
          } else if (o >= 3) c3Icon(ctx, icons, "starOff", x, y, 84);
        }
        if (o >= 9) {
          const q = easeOut((o - 9) / 3), parts = [];
          if (!info.war) parts.push(["coin", Math.floor(loot.or * q).toLocaleString("fr-FR"), "#fde68a"], ["crystal", Math.floor(loot.essence * q).toLocaleString("fr-FR"), "#e9d5ff"]);
          if (trophies) parts.push(["trophy", `${trophies > 0 ? "+" : "-"}${Math.round(Math.abs(trophies) * q)}`, trophies > 0 ? "#fde68a" : "#fca5a5"]);
          parts.forEach(([icon, txt, col], i) => {
            const x = OW / 2 + (i - (parts.length - 1) / 2) * 172, y = OH / 2 + 100;
            c3Panel(ctx, x - 82, y - 28, 164, 52, 14, 0.85);
            c3Icon(ctx, icons, icon, x - 52, y - 2, 40);
            outlinedText(ctx, txt, x - 28, y + 8, "24px CardTitle", col, "left");
          });
        }
      },
    });
  }
  // ---------- le Manoir tombe : la chute et le bilan partent aussi en vidéo avec le son ----------
  // (les images sont confiées à ffmpeg au fil du rendu : rien n'est gardé en mémoire)
  let clip = null;
  const inClip = plan.map((p) => p.scene === "manoir" || p.scene === "bilan"), clipDelay = (p, i) => (i === plan.length - 1 ? 3400 : p.delay);
  if (plan.some((p) => p.scene === "manoir"))
    try {
      const M = require("./moments");
      if (M.videoOk()) {
        let at = 0, victoryAt = 0;
        const starTimes = [], bilan0 = plan.length - OUT;
        plan.forEach((p, i) => {
          if (!inClip[i]) return;
          const o = i - bilan0;
          if (o === 2) victoryAt = at / 1000;
          // une étoile se pose (o = 6, 8, 10)
          if (o >= 6 && o <= 10 && o % 2 === 0 && (o - 6) / 2 < sim.stars) starTimes.push(at / 1000);
          at += clipDelay(p, i);
        });
        clip = M.manoirStream(OW, OH, { dur: at / 1000, victoryAt, starTimes });
      }
    } catch (err) {
      console.error("[clash 3D] vidéo du Manoir :", err.message);
      clip = null;
    }
  // ---------- 2. et 3. le fil de rendu calcule les images 3D ; chaque image reçue reçoit ses effets puis part à l'encodeur ----------
  const encoder = anEncoder(OW, OH);
  const oc = createCanvas(OW, OH), octx = oc.getContext("2d"), im = octx.createImageData(OW, OH);
  let sceneName = null, batch = [], lastData = null;
  const dumpFrames = [];
  // les images partent à l'encodeur sans copie (transfert) ; on garde seulement la dernière pour l'affiche
  const flush = () => {
    if (batch.length) encoder.scene(batch, true);
    batch = [];
  };
  const onFrame = (i, frame) => {
    const p = plan[i];
    im.data.set(frame);
    octx.putImageData(im, 0, 0);
    const [x0, y0, sw] = p.crop, k = OW / sw;
    octx.save();
    octx.setTransform(k, 0, 0, k, -x0 * k, -y0 * k);
    for (const fx of p.world) fx(octx);
    octx.restore();
    if (p.screen) p.screen(octx);
    // copie dans un tampon suivi par V8, puis petit nettoyage : le tampon natif du canvas est rendu aussitôt
    const dataOut = new Uint8ClampedArray(octx.getImageData(0, 0, OW, OH).data);
    CLASH3D.nettoyer();
    if (p.scene !== sceneName) {
      flush();
      sceneName = p.scene;
    }
    batch.push({ data: dataOut, delay: p.delay });
    if (clip && inClip[i]) clip.push(dataOut, clipDelay(p, i)); // copie : le tampon part ensuite à l'encodeur
    if (process.env.CLASH3D_DUMP) dumpFrames.push(dataOut.slice());
    (lastData ??= new Uint8ClampedArray(OW * OH * 4)).set(dataOut);
  };
  const t0 = Date.now();
  let res;
  try {
    res = await CLASH3D.renderBattle({ W: WW, H: WH, rect, data, ss: 2, out: { w: OW, h: OH }, frames: plan.map((p) => ({ states: p.states, troops: p.troops, aims: p.aims, crop: p.crop, t: p.t })) }, onFrame);
  } catch (err) {
    encoder.stop();
    clip?.abort();
    throw err;
  }
  const tRender = Date.now() - t0;
  if (!lastData) {
    encoder.stop();
    clip?.abort();
    throw new Error("aucune image reçue du rendu 3D");
  }
  flush();
  // diagnostic (tests) : planche de 6 images de la cinématique
  if (process.env.CLASH3D_DUMP) {
    const sh = createCanvas(OW * 3, OH * 2), sc = sh.getContext("2d"), keep = [0.04, 0.18, 0.4, 0.6, 0.8, 1];
    keep.forEach((q, n) => {
      const j = Math.min(plan.length - 1, Math.floor((plan.length - 1) * q)), pi = sc.createImageData(OW, OH);
      pi.data.set(dumpFrames[j]);
      sc.putImageData(pi, (n % 3) * OW, Math.floor(n / 3) * OH);
    });
    require("fs").writeFileSync(require("path").join(process.env.CLASH3D_DUMP, "combat3d-planche.jpg"), await sh.encode("jpeg", 88));
    for (const q of (process.env.CLASH3D_FRAMES ?? "").split(",").filter(Boolean)) {
      const j = Math.min(plan.length - 1, Math.floor((plan.length - 1) * Number(q))), one = c3Canvas(dumpFrames[j], OW, OH);
      require("fs").writeFileSync(require("path").join(process.env.CLASH3D_DUMP, `combat3d-${q}.png`), await one.encode("png"));
    }
  }
  const gif = await encoder.finish();
  if (process.env.CLASH3D_PROF) console.log(`[clash 3D] bataille : ${plan.length} images, rendu 3D ${tRender} ms (${JSON.stringify(res.stats)}), total ${Date.now() - t0} ms, ${Math.round(gif.length / 1024)} Ko`);
  const end = c3Canvas(lastData, OW, OH);
  gif.duration = plan.slice(0, -1).reduce((a, x) => a + x.delay, 0) + 1500;
  gif.poster = await end.encode("jpeg", 90);
  gif.clip = clip ? await clip.end().catch((err) => console.error("[clash 3D] vidéo du Manoir :", err.message)) : null;
  return gif;
}
{
  // une cinématique à la fois : chacune prend ~200 Mo pendant son rendu (3D, images, GIF, vidéo du Manoir) ;
  // deux attaques en même temps faisaient dépasser la mémoire du serveur. La seconde attend simplement la première.
  const flat = clashBattleGif, oneAtATime = limiter(1);
  clashBattleGif = (base, sim, attackerName, info = {}) =>
    oneAtATime(async () => {
      try {
        return await clashBattleGif3D(base, sim, attackerName, info);
      } catch (err) {
        console.error("[clash 3D] bataille : animation 2D de secours —", err.stack ?? err.message);
        return flat(base, sim, attackerName, info);
      } finally {
        CLASH3D.nettoyer(true); // tout ce que la cinématique a laissé est rendu avant la suivante
      }
    });
}
