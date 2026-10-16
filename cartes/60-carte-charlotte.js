// --- La carte de Charlotte : « Édition Étoile de David » ---
// Une carte unique, dessinée entièrement à la main (elle ne reprend pas le gabarit des autres membres) :
// cadre en pierre de Jérusalem, rayures bleues du talit, fenêtre en arc surmontée d'une étoile de David,
// rosace en vitrail, remparts de la vieille ville, menorah aux sept flammes, branches d'olivier, grenades,
// symbole Haï (חי, « la vie ») et attaques écrites sur un rouleau de parchemin.
// Elle a sa carte même sans le rôle des cartes de membres, et porte le sceau de championne du tournoi.
const CHARLOTTE_ID = "1557089423408238602";
const CH_TEXT = "Championne du tournoi. Sa lumière brille comme les sept branches de la menorah.";
const CH_BLUE = "#0b2a6b", CH_ROYAL = "#1d4ed8", CH_SKY = "#93c5fd", CH_GOLD = "#e8b84a", CH_GARNET = "#9f1239";

// 1. la carte existe, et Charlotte est championne du tournoi
{
  const sync = syncMemberCards;
  syncMemberCards = async (guild) => {
    await sync(guild);
    const member = await guild.members.fetch(CHARLOTTE_ID).catch(() => null);
    if (member) {
      await cacheMember(member).catch(() => null);
      await grantWelcome(member, true).catch(() => null);
    } else {
      // pas (ou plus) sur le serveur : son compte Discord donne quand même son nom et sa vraie photo de profil
      const user = await guild.client?.users.fetch(CHARLOTTE_ID).catch(() => null);
      if (user) {
        const old = load().memberArchive[CHARLOTTE_ID] ?? {};
        const info = { stars: 0, role: null, joinedAt: null, messages: 0, ...old, name: user.globalName ?? user.username, avatar: user.displayAvatarURL({ extension: "png", size: 512 }), balance: realReadBalance(CHARLOTTE_ID) ?? 0 };
        memberCache.set(CHARLOTTE_ID, info);
        load().memberArchive[CHARLOTTE_ID] = info;
      }
    }
    const st = load(), s = (st.userStats[CHARLOTTE_ID] ??= {});
    if (!(s.tourneyWins >= 1)) s.tourneyWins = 1;
    const style = styleOf(CHARLOTTE_ID);
    if (!style.owned.includes("back_champion")) style.owned.push("back_champion");
    save();
    for (const cache of [gifCache, thumbCache]) for (const key of [...cache.keys()]) if (String(key).startsWith(`mb_${CHARLOTTE_ID}`)) cache.delete(key);
  };
  const members = memberCards;
  memberCards = (activeOnly = false) => members(activeOnly).map((c) => (c.memberId === CHARLOTTE_ID && !c.duo ? { ...c, text: CH_TEXT } : c));
}

// ---------- motifs ----------
// pierre de Jérusalem : appareillage de blocs calcaires dorés
function chStone(ctx, W, H, seed, gold) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, gold ? "#f6e3a8" : "#f1e6cc");
  g.addColorStop(0.5, gold ? "#e2b85a" : "#e2d1aa");
  g.addColorStop(1, gold ? "#b98a2e" : "#c9b285");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const R = seeded(seed);
  for (let row = 0, y = 0; y < H; row++, y += 30) {
    for (let x = row % 2 ? -26 : 0; x < W; x += 52) {
      const v = (R() - 0.5) * 0.16;
      ctx.fillStyle = v > 0 ? `rgba(255,250,235,${v})` : `rgba(120,90,40,${-v})`;
      ctx.fillRect(x + 1, y + 1, 50, 28);
      ctx.strokeStyle = "rgba(110,84,44,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 52, 30);
      // petites alvéoles du calcaire
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = "rgba(110,84,44,0.18)";
        ctx.beginPath();
        ctx.arc(x + 4 + R() * 44, y + 4 + R() * 22, 0.6 + R() * 1.2, 0, TAU);
        ctx.fill();
      }
    }
  }
}
// rayures du talit (châle de prière) : bleu, filet, bleu
function chTallit(ctx, x, y, w) {
  ctx.fillStyle = CH_BLUE;
  ctx.fillRect(x, y, w, 5);
  ctx.fillRect(x, y + 12, w, 5);
  ctx.fillStyle = CH_ROYAL;
  ctx.fillRect(x, y + 7.5, w, 2);
}
// étoile de David : deux triangles entrelacés, en or, sur médaillon bleu
function chMagenDavid(ctx, x, y, r, t) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  disc(ctx, x, y, r + 7, metalGradient(ctx, 600, 840, METAL.legendaire, Math.sin(TAU * t) * 0.25));
  ctx.restore();
  const bg = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r + 2);
  bg.addColorStop(0, "#3b6fd8");
  bg.addColorStop(1, "#0a1f52");
  disc(ctx, x, y, r + 2, bg);
  const tri = (rot) => {
    const p = [];
    for (let k = 0; k < 3; k++) {
      const a = rot + (k * TAU) / 3 - Math.PI / 2;
      p.push([x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86]);
    }
    return p;
  };
  const band = (p, under) => {
    ctx.beginPath();
    p.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.lineJoin = "miter";
    ctx.strokeStyle = "#3d2605";
    ctx.lineWidth = r * 0.2;
    ctx.stroke();
    ctx.strokeStyle = metalGradient(ctx, 600, 840, METAL.legendaire, under ? 0.2 : -0.1);
    ctx.lineWidth = r * 0.13;
    ctx.stroke();
  };
  const up = tri(0), down = tri(Math.PI);
  band(up, true);
  band(down, false);
  // entrelacs : le triangle du dessous repasse par-dessus à trois croisements
  ctx.save();
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const a = (k * TAU) / 3 - Math.PI / 2 + Math.PI / 6;
    ctx.moveTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
    ctx.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.17, 0, TAU);
  }
  ctx.clip();
  band(up, true);
  ctx.restore();
  sparkle(ctx, x + r * 0.45, y - r * 0.5, 2 + 3 * Math.max(0, Math.sin(TAU * t * 2)), "rgba(255,248,220,0.95)");
}
// symbole Haï (חי) dessiné trait par trait : le ח à droite, le י à gauche
function chChai(ctx, x, y, s, color, width = s * 0.13) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const cx = x + s * 0.2, w = s * 0.56, top = y - s / 2, bot = y + s / 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, bot);
  ctx.lineTo(cx - w / 2, top + s * 0.1);
  ctx.quadraticCurveTo(cx - w / 2, top, cx - w / 4, top);
  ctx.lineTo(cx - s * 0.06, top);
  ctx.lineTo(cx, top - s * 0.09);
  ctx.lineTo(cx + s * 0.06, top);
  ctx.lineTo(cx + w / 2, top);
  ctx.lineTo(cx + w / 2, bot);
  ctx.stroke();
  const xl = x - s * 0.34;
  ctx.beginPath();
  ctx.moveTo(xl - s * 0.08, top);
  ctx.lineTo(xl + s * 0.06, top);
  ctx.quadraticCurveTo(xl + s * 0.08, top + s * 0.22, xl - s * 0.03, top + s * 0.36);
  ctx.stroke();
  ctx.restore();
}
// grenade : fruit rond, couronne de sépales, reflets
function chPomegranate(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // feuilles
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.rotate(s * 0.9);
    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.ellipse(0, -r * 1.25, r * 0.28, r * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#fb7185");
  g.addColorStop(0.55, "#be123c");
  g.addColorStop(1, "#4c0519");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  // couronne
  ctx.fillStyle = "#881337";
  ctx.beginPath();
  ctx.moveTo(-r * 0.32, -r * 0.82);
  for (let k = 0; k <= 4; k++) ctx.lineTo(-r * 0.32 + (k * r * 0.64) / 4, -r * (k % 2 ? 1.02 : 1.22));
  ctx.lineTo(r * 0.32, -r * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(-r * 0.38, -r * 0.3, r * 0.16, r * 0.28, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}
// rameau d'olivier : une tige courbe et ses feuilles argentées, quelques olives
function chOlive(ctx, x0, y0, x1, y1, bend, side, seed) {
  const R = seeded(seed);
  const cx = (x0 + x1) / 2 + bend, cy = (y0 + y1) / 2;
  const at = (q) => [(1 - q) ** 2 * x0 + 2 * (1 - q) * q * cx + q * q * x1, (1 - q) ** 2 * y0 + 2 * (1 - q) * q * cy + q * q * y1];
  ctx.save();
  ctx.strokeStyle = "#5b3a1a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.stroke();
  for (let k = 1; k <= 9; k++) {
    const q = k / 10, [px, py] = at(q), [nx, ny] = at(q + 0.01), a = Math.atan2(ny - py, nx - px);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(a + s * (0.75 + R() * 0.2));
      const lg = ctx.createLinearGradient(0, 0, 22, 0);
      lg.addColorStop(0, "#4d6b1f");
      lg.addColorStop(1, "#9db36a");
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.ellipse(12, 0, 13 - q * 3, 4.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    if (k % 3 === 1) disc(ctx, px + side * 7, py + 6, 4, "#3b1d4a");
  }
  ctx.restore();
}
// la menorah à sept branches, flammes qui vacillent
function chMenorah(ctx, cx, baseY, h, t) {
  const cupY = baseY - h, armY = baseY - h * 0.55;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  const gold = metalGradient(ctx, 600, 840, METAL.legendaire, Math.sin(TAU * t) * 0.2);
  ctx.strokeStyle = gold;
  ctx.fillStyle = gold;
  ctx.lineCap = "round";
  // pied à trois degrés
  ctx.beginPath();
  ctx.moveTo(cx - 26, baseY);
  ctx.lineTo(cx + 26, baseY);
  ctx.lineTo(cx + 18, baseY - 7);
  ctx.lineTo(cx + 10, baseY - 7);
  ctx.lineTo(cx + 6, baseY - 14);
  ctx.lineTo(cx - 6, baseY - 14);
  ctx.lineTo(cx - 10, baseY - 7);
  ctx.lineTo(cx - 18, baseY - 7);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, baseY - 12);
  ctx.lineTo(cx, cupY);
  ctx.stroke();
  // trois paires de bras en demi-cercle
  ctx.lineWidth = 4;
  for (let i = 1; i <= 3; i++) {
    const r = (h * 0.38 * i) / 3 + 4;
    ctx.beginPath();
    ctx.moveTo(cx - r, cupY);
    ctx.lineTo(cx - r, armY);
    ctx.arc(cx, armY, r, Math.PI, 0, true);
    ctx.lineTo(cx + r, cupY);
    ctx.stroke();
  }
  // nœuds décoratifs sur la tige
  for (const q of [0.3, 0.55, 0.8]) disc(ctx, cx, baseY - h * q, 3.6, gold);
  ctx.restore();
  // coupes et flammes
  for (let i = -3; i <= 3; i++) {
    const r = i === 0 ? 0 : (h * 0.38 * Math.abs(i)) / 3 + 4, x = cx + Math.sign(i) * r;
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.moveTo(x - 6, cupY - 4);
    ctx.lineTo(x + 6, cupY - 4);
    ctx.lineTo(x + 3, cupY + 2);
    ctx.lineTo(x - 3, cupY + 2);
    ctx.closePath();
    ctx.fill();
    const fl = 1 + 0.18 * Math.sin(TAU * (t * 3 + i * 0.37)), sway = 1.4 * Math.sin(TAU * (t * 2 + i * 0.21));
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    glow(ctx, x, cupY - 13, 20, "#fbbf24", 0.55);
    ctx.restore();
    const fg = ctx.createRadialGradient(x, cupY - 9, 1, x, cupY - 11, 11 * fl);
    fg.addColorStop(0, "#fffbeb");
    fg.addColorStop(0.45, "#fde047");
    fg.addColorStop(1, "#f97316");
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(x, cupY - 5);
    ctx.quadraticCurveTo(x + 6, cupY - 10, x + sway, cupY - 5 - 17 * fl);
    ctx.quadraticCurveTo(x - 6, cupY - 10, x, cupY - 5);
    ctx.fill();
  }
}
// remparts de la vieille ville, au clair de lune
function chWalls(ctx, x0, x1, baseY, R) {
  ctx.save();
  const wallTop = baseY - 44, wall = new Path2D();
  wall.moveTo(x0, baseY);
  wall.lineTo(x0, wallTop);
  for (let x = x0; x < x1; x += 18) {
    wall.lineTo(x, wallTop);
    wall.lineTo(x, wallTop - 8);
    wall.lineTo(x + 9, wallTop - 8);
    wall.lineTo(x + 9, wallTop);
  }
  wall.lineTo(x1, wallTop);
  wall.lineTo(x1, baseY);
  wall.closePath();
  const g = ctx.createLinearGradient(0, wallTop - 10, 0, baseY);
  g.addColorStop(0, "#22386e");
  g.addColorStop(1, "#0a142e");
  ctx.fillStyle = g;
  ctx.fill(wall);
  // tours
  for (const [tx, tw, th] of [
    [x0 + 46, 52, 92],
    [x1 - 112, 60, 104],
  ]) {
    ctx.fillStyle = "#14254f";
    ctx.fillRect(tx, baseY - th, tw, th);
    for (let k = 0; k < 4; k++) ctx.fillRect(tx + k * (tw / 4) + 2, baseY - th - 9, tw / 8, 9);
    ctx.fillStyle = "rgba(147,197,253,0.18)";
    ctx.fillRect(tx, baseY - th, 4, th);
    // fenêtres éclairées
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = R() < 0.65 ? "#fbbf24" : "#0a142e";
      ctx.beginPath();
      const wx = tx + tw / 2 - 4, wy = baseY - th + 18 + k * 24;
      ctx.moveTo(wx, wy + 12);
      ctx.lineTo(wx, wy + 4);
      ctx.arc(wx + 4, wy + 4, 4, Math.PI, 0);
      ctx.lineTo(wx + 8, wy + 12);
      ctx.fill();
    }
  }
  // porte en arc
  const gx = x0 + 150;
  ctx.fillStyle = "#050a18";
  ctx.beginPath();
  ctx.moveTo(gx - 15, baseY);
  ctx.lineTo(gx - 15, baseY - 22);
  ctx.arc(gx, baseY - 22, 15, Math.PI, 0);
  ctx.lineTo(gx + 15, baseY);
  ctx.fill();
  // clair de lune sur le haut des murs
  ctx.fillStyle = "rgba(191,219,254,0.22)";
  ctx.fillRect(x0, wallTop, x1 - x0, 2);
  ctx.restore();
}

// ---------- la carte ----------
async function drawCharlotteCard(card, holo = false, t = 0.37) {
  const W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const cp = combatProfile(card, holo), elKey = elementOf(card), el = ELEMENTS[elKey] ?? ELEMENTS.lumiere;
  const goldEd = card.variant === "or", fullEd = card.variant === "full";
  const R = seeded(hashOf(card.id) + 11);
  const gold = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.25);

  // 1. cadre en pierre de Jérusalem (dorée pour l'Édition dorée), filets or et bleu
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  chStone(ctx, W, H, hashOf(card.id), goldEd);
  if (fullEd) {
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.45);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(60,40,10,0.6)";
  roundRect(ctx, 1, 1, W - 2, H - 2, 27);
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = gold;
  roundRect(ctx, 8, 8, W - 16, H - 16, 23);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CH_BLUE;
  roundRect(ctx, 13, 13, W - 26, H - 26, 20);
  ctx.stroke();

  // 2. panneau intérieur : lin blanc, rayures du talit en haut et en bas
  const inner = { x: 18, y: 18, w: W - 36, h: H - 36 };
  ctx.save();
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 17);
  ctx.clip();
  const lin = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
  lin.addColorStop(0, "#fdfbf5");
  lin.addColorStop(1, "#efe6d0");
  ctx.fillStyle = lin;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  // fines rayures de tissu
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = CH_BLUE;
  for (let x = inner.x; x < inner.x + inner.w; x += 6) ctx.fillRect(x, inner.y, 1, inner.h);
  ctx.globalAlpha = 1;
  chTallit(ctx, inner.x, 22, inner.w);
  chTallit(ctx, inner.x, H - 46, inner.w);
  ctx.restore();

  // 3. en-tête : nom, PV, astre
  ctx.save();
  ctx.font = `${fitText(ctx, card.name, 320, 36, "CardTitle")}px CardTitle`;
  ctx.fillStyle = CH_BLUE;
  ctx.fillText(card.name, 36, 76);
  ctx.textAlign = "right";
  ctx.font = "34px CardTitle";
  ctx.fillStyle = CH_GARNET;
  ctx.fillText(String(cp.hp), 520, 78);
  const hpW = ctx.measureText(String(cp.hp)).width;
  ctx.font = "14px CardBold";
  ctx.fillText("PV", 520 - hpW - 6, 76);
  ctx.restore();
  if (astreOf(card)) astreOrb(ctx, astreOf(card), 551, 66, 20);
  else energyOrb(ctx, elKey, 551, 66, 20);

  // 4. la fenêtre en arc : ciel de nuit sur Jérusalem
  const ax0 = 40, ax1 = W - 40, aTop = 104, aBot = 508, ar = (ax1 - ax0) / 2, acx = W / 2, acy = aTop + ar;
  const arch = new Path2D();
  arch.moveTo(ax0, aBot);
  arch.lineTo(ax0, acy);
  arch.arc(acx, acy, ar, Math.PI, 0);
  arch.lineTo(ax1, aBot);
  arch.closePath();
  ctx.save();
  ctx.clip(arch);
  const sky = ctx.createLinearGradient(0, aTop, 0, aBot);
  sky.addColorStop(0, "#060f2e");
  sky.addColorStop(0.55, "#163a8a");
  sky.addColorStop(0.86, "#5a6fb0");
  sky.addColorStop(1, "#d9b26a");
  ctx.fillStyle = sky;
  ctx.fillRect(ax0, aTop, ax1 - ax0, aBot - aTop);
  // étoiles
  for (let k = 0; k < 70; k++) {
    const sx = ax0 + R() * (ax1 - ax0), sy = aTop + R() * 300, tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
    if (k < 8) sparkle(ctx, sx, sy, 1.5 + tw * 3, `rgba(255,250,230,${0.4 + tw * 0.6})`);
    else disc(ctx, sx, sy, 0.6 + R() * 0.9, `rgba(255,255,255,${0.35 + R() * 0.5})`);
  }
  // rayons de lumière derrière le portrait
  const pcx = W / 2, pcy = 282;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU + t * 0.4;
    ctx.fillStyle = `rgba(253,224,140,${k % 2 ? 0.05 : 0.09})`;
    ctx.beginPath();
    ctx.moveTo(pcx, pcy);
    ctx.lineTo(pcx + Math.cos(a - 0.06) * 420, pcy + Math.sin(a - 0.06) * 420);
    ctx.lineTo(pcx + Math.cos(a + 0.06) * 420, pcy + Math.sin(a + 0.06) * 420);
    ctx.closePath();
    ctx.fill();
  }
  glow(ctx, pcx, pcy, 230, "#fde68a", 0.28);
  ctx.restore();
  // rosace en vitrail autour du portrait
  const r1 = 132, r2 = 160, glass = ["#1e40af", "#dbeafe", "#f59e0b", "#2563eb", "#bfdbfe", "#fbbf24"];
  for (let k = 0; k < 24; k++) {
    const a0 = (k / 24) * TAU, a1 = ((k + 1) / 24) * TAU;
    ctx.beginPath();
    ctx.arc(pcx, pcy, r2, a0, a1);
    ctx.arc(pcx, pcy, r1, a1, a0, true);
    ctx.closePath();
    const gl = ctx.createRadialGradient(pcx, pcy, r1, pcx, pcy, r2);
    gl.addColorStop(0, glass[k % glass.length]);
    gl.addColorStop(1, shade(glass[k % glass.length], 0.7));
    ctx.fillStyle = gl;
    ctx.fill();
    ctx.strokeStyle = "#0b1533";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.arc(pcx, pcy, r2 + 1, 0, TAU);
  ctx.stroke();
  // petites étoiles de David sur le vitrail
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 12, sx = pcx + Math.cos(a) * (r1 + r2) / 2, sy = pcy + Math.sin(a) * (r1 + r2) / 2;
    ctx.save();
    ctx.strokeStyle = "#fffbeb";
    ctx.lineWidth = 1.6;
    for (const rot of [0, Math.PI]) {
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const b = rot + (j * TAU) / 3 - Math.PI / 2;
        j ? ctx.lineTo(sx + Math.cos(b) * 7, sy + Math.sin(b) * 7) : ctx.moveTo(sx + Math.cos(b) * 7, sy + Math.sin(b) * 7);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }
  // remparts, puis le portrait, les oliviers et la menorah
  chWalls(ctx, ax0, ax1, aBot, R);
  ctx.restore();
  // portrait
  const av = card.avatar ? await fetchImage(`avatar:${card.avatar}`, card.avatar).catch(() => null) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(pcx, pcy, r1 - 6, 0, TAU);
  ctx.clip();
  if (av) ctx.drawImage(av, pcx - (r1 - 6), pcy - (r1 - 6), (r1 - 6) * 2, (r1 - 6) * 2);
  else {
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(pcx - r1, pcy - r1, r1 * 2, r1 * 2);
    disc(ctx, pcx, pcy - 22, 42, "#93c5fd");
    disc(ctx, pcx, pcy + 92, 80, "#93c5fd");
  }
  // reflet doux sur le portrait
  const sh = ctx.createLinearGradient(pcx - r1, pcy - r1, pcx + r1, pcy + r1);
  sh.addColorStop(0, "rgba(255,255,255,0.16)");
  sh.addColorStop(0.5, "rgba(255,255,255,0)");
  sh.addColorStop(1, "rgba(11,42,107,0.22)");
  ctx.fillStyle = sh;
  ctx.fillRect(pcx - r1, pcy - r1, r1 * 2, r1 * 2);
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = gold;
  ctx.beginPath();
  ctx.arc(pcx, pcy, r1 - 4, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.beginPath();
  ctx.arc(pcx, pcy, r1 - 8, 0, TAU);
  ctx.stroke();
  // rameaux d'olivier qui embrassent le portrait
  chOlive(ctx, pcx - 70, pcy + 170, pcx - 178, pcy - 40, -46, -1, 3);
  chOlive(ctx, pcx + 70, pcy + 170, pcx + 178, pcy - 40, 46, 1, 4);
  // la menorah au pied du portrait
  ctx.save();
  ctx.clip(arch);
  chMenorah(ctx, pcx, aBot - 4, 64, t);
  ctx.restore();
  // contour de l'arc, et l'étoile de David en clé de voûte
  ctx.lineWidth = 7;
  ctx.strokeStyle = gold;
  ctx.stroke(arch);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.save();
  ctx.translate(W / 2, (aTop + aBot) / 2);
  ctx.scale(0.985, 0.988);
  ctx.translate(-W / 2, -(aTop + aBot) / 2);
  ctx.stroke(arch);
  ctx.restore();
  chMagenDavid(ctx, acx, aTop, 30, t);
  // grenades dans les écoinçons
  chPomegranate(ctx, W - 72, 132, 17, 0.3);
  chPomegranate(ctx, W - 104, 152, 12, -0.4);

  // 5. championne du tournoi : sceau et mention, paillettes d'or
  const wins = tdTourneyWins(card.memberId);
  if (wins) {
    ctx.save();
    tourneySeal(ctx, 78, 156, wins);
    ctx.restore();
    // mention sous le nom
    ctx.save();
    ctx.font = "12px CardEngrave";
    ctx.textAlign = "left";
    ctx.fillStyle = "#a16207";
    spacedLeft(ctx, wins > 1 ? `CHAMPIONNE DU TOURNOI ×${wins}` : "CHAMPIONNE DU TOURNOI", 38, 100, 1.5);
    ctx.restore();
  } else chPomegranate(ctx, 72, 132, 17, -0.3);
  ctx.textAlign = "left";

  // 6. ruban bleu d'informations
  const ry = aBot + 10;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(64, ry);
  ctx.lineTo(W - 64, ry);
  ctx.lineTo(W - 78, ry + 28);
  ctx.lineTo(78, ry + 28);
  ctx.closePath();
  const rib = ctx.createLinearGradient(0, ry, 0, ry + 28);
  rib.addColorStop(0, "#1e40af");
  rib.addColorStop(1, CH_BLUE);
  ctx.fillStyle = rib;
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const info = `${numberOf(card).replace("#", "N° ")}   ·   ${card.variant ? card.variantLabel : "Édition Étoile de David"}   ·   astre ${ASTRES[astreOf(card)]?.label ?? el.label}`;
  ctx.textAlign = "center";
  ctx.font = `${fitText(ctx, info, 400, 13, "CardItalic")}px CardItalic`;
  ctx.fillStyle = "#fef3c7";
  ctx.fillText(info, W / 2, ry + 19);
  ctx.restore();

  // 7. le rouleau : parchemin entre deux montants de bois (les attaques)
  const sy0 = ry + 40, sy1 = sy0 + 132;
  ctx.save();
  const parch = ctx.createLinearGradient(0, sy0, 0, sy1);
  parch.addColorStop(0, "#f7ead0");
  parch.addColorStop(0.5, "#f3e1bb");
  parch.addColorStop(1, "#e6cf9f");
  ctx.fillStyle = parch;
  ctx.shadowColor = "rgba(60,40,10,0.35)";
  ctx.shadowBlur = 8;
  ctx.fillRect(62, sy0, W - 124, sy1 - sy0);
  ctx.shadowBlur = 0;
  // bords assombris du parchemin
  for (const [x, dir] of [
    [62, 1],
    [W - 62, -1],
  ]) {
    const eg = ctx.createLinearGradient(x, 0, x + dir * 26, 0);
    eg.addColorStop(0, "rgba(120,80,30,0.35)");
    eg.addColorStop(1, "rgba(120,80,30,0)");
    ctx.fillStyle = eg;
    ctx.fillRect(Math.min(x, x + dir * 26), sy0, 26, sy1 - sy0);
  }
  // Haï en filigrane au centre
  ctx.globalAlpha = 0.1;
  chChai(ctx, W / 2, (sy0 + sy1) / 2 + 4, 92, "#7c4a12", 12);
  ctx.globalAlpha = 1;
  // montants du rouleau (bois, poignées dorées)
  for (const x of [50, W - 50]) {
    const wg = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    wg.addColorStop(0, "#3b2210");
    wg.addColorStop(0.45, "#8a5a2b");
    wg.addColorStop(1, "#2a170a");
    ctx.fillStyle = wg;
    roundRect(ctx, x - 10, sy0 - 10, 20, sy1 - sy0 + 20, 8);
    ctx.fill();
    for (const y of [sy0 - 14, sy1 + 14]) {
      disc(ctx, x, y, 8, gold);
      disc(ctx, x - 2, y - 2, 2.5, "rgba(255,255,255,0.7)");
    }
  }
  ctx.restore();
  const moves = [
    { cost: 0, name: cp.attackName, dmg: cp.attack, text: "Attaque de base · aucune énergie · peut être esquivée" },
    { cost: SPECIAL_COST, name: cp.specialName, dmg: cp.special, text: `Coûte ${SPECIAL_COST} énergies · impossible à esquiver · brise la garde` },
  ];
  ctx.textAlign = "left";
  moves.forEach((mv, i) => {
    const y = sy0 + 40 + i * 60;
    for (let k = 0; k < mv.cost; k++) energyOrb(ctx, elKey, 86 + k * 26, y - 8, 10.5);
    const nx = mv.cost ? 86 + mv.cost * 26 + 2 : 80;
    ctx.font = `${fitText(ctx, mv.name, W - nx - 140, 24, "CardTitle")}px CardTitle`;
    ctx.fillStyle = CH_BLUE;
    ctx.fillText(mv.name, nx, y);
    ctx.textAlign = "right";
    ctx.font = "30px CardTitle";
    ctx.fillStyle = CH_GARNET;
    ctx.fillText(String(mv.dmg), W - 80, y + 2);
    ctx.textAlign = "left";
    ctx.font = "12px CardText";
    ctx.fillStyle = "#6b4a23";
    ctx.fillText(mv.text, 80, y + 20);
    if (i === 0) {
      ctx.strokeStyle = "rgba(124,74,18,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(78, y + 33);
      ctx.lineTo(W - 78, y + 33);
      ctx.stroke();
    }
  });

  // 8. faiblesse, résistance, chance
  const by = sy1 + 34;
  const astre = astreOf(card), weak = astreWeakTo(astre), strong = ASTRE_BEATS[astre];
  [
    ["faiblesse", weak, weak ? `${ASTRES[weak].label} ×2` : "—"],
    ["résistance", strong, strong ? `${ASTRES[strong].label} ×0,5` : "—"],
    ["chance", null, String(cp.luck)],
  ].forEach(([label, s, value], i) => {
    const x = 60 + i * 176;
    ctx.font = "11px CardText";
    ctx.fillStyle = "#5b4b40";
    ctx.fillText(label, x, by);
    if (s) astreIcon(ctx, s, x + 7, by + 15, 8);
    else if (i === 2) combatIcon(ctx, 2, x + 7, by + 15, CH_BLUE);
    ctx.font = "14px CardBold";
    ctx.fillStyle = CH_BLUE;
    ctx.fillText(value, x + (s || i === 2 ? 20 : 0), by + 20);
  });
  // texte d'ambiance
  ctx.font = `${fitText(ctx, card.text, W - 120, 14, "CardItalic")}px CardItalic`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#3b2f28";
  ctx.fillText(card.text, W / 2, by + 48);
  ctx.textAlign = "left";

  // 9. pied de carte (sous les rayures du talit)
  const footY = H - 54;
  const footInk = "#3b2f28";
  seriesIcon(ctx, seriesOf(card), 44, footY - 4, 6, footInk);
  ctx.font = "12px CardBold";
  ctx.fillStyle = footInk;
  ctx.fillText(numberOf(card).replace("#", ""), 56, footY);
  rarityIcon(ctx, card.rarity, W / 2 - 46, footY - 4, 7, footInk);
  ctx.font = "11px CardEngrave";
  ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), W / 2 - 34, footY);
  chChai(ctx, W / 2 + 70, footY - 5, 13, CH_ROYAL, 2.2);
  ctx.textAlign = "right";
  ctx.font = "11px CardText";
  ctx.fillText(`Illus. La Maison · ${GENERATIONS[card.gen ?? 1]?.code ?? "G1"}`, W - 44, footY);
  ctx.textAlign = "left";

  // 10. finitions : paillettes d'or (championne), reflet holographique bleu et argent, grain
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  if (wins || holo || fullEd) {
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 26 + wins * 6; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      sparkle(ctx, 30 + R() * (W - 60), 30 + R() * (H - 60), 0.8 + tw * 3.2, `rgba(253,230,138,${0.25 + tw * 0.7})`);
    }
  }
  if (holo || fullEd) {
    ctx.globalCompositeOperation = "overlay";
    const g = ctx.createLinearGradient(W * (t - 0.4), 0, W * (t + 0.4), H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.35, "rgba(147,197,253,0.45)");
    g.addColorStop(0.5, "rgba(255,255,255,0.55)");
    g.addColorStop(0.65, "rgba(253,224,140,0.45)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.08;
  ctx.drawImage(printTexture(), 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "screen";
  glow(ctx, W * (0.22 + 0.06 * Math.sin(TAU * t)), H * 0.1, 400, "#ffffff", 0.08);
  ctx.restore();
  return c;
}
{
  const draw = drawCreatureCard;
  drawCreatureCard = async (card, holo = false, t = 0.37) => (card?.memberId === CHARLOTTE_ID && !card.duo ? drawCharlotteCard(card, holo, t) : draw(card, holo, t));
}
