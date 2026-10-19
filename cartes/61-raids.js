// --- Raids : un boss gigantesque sort des abysses, tout le monde l'attaque ensemble, puis chacun tente de le capturer ---
// 1. Le raid apparaît (salon 🐉・raids) : 5 minutes pour rejoindre et choisir ses 3 cartes (les cartes Étoile
//    sont redoutables : le boss est d'astre Ombre).
// 2. Le combat se joue en équipe, tour par tour (12 tours au plus) : le dragon annonce son coup, chacun choisit son
//    action en secret dans son poste de combat (attaque, super, protéger l'équipe, soigner, changer de carte),
//    puis tout se résout ensemble (voir « Le combat d'équipe » plus bas).
// 3. S'il tombe : chaque participant reçoit des cartes de capture selon ses dégâts, et tente sa chance.
//    S'il n'est pas vaincu à temps, il s'enfuit.
const RAID_BOSS = {
  id: "ev_nyxaros",
  name: "Nyxaros",
  title: "Dragon des Abysses",
  astre: "ombre",
  quick: "Griffe d'ombre",
  charged: "Souffle des abysses",
  text: "Né des ténèbres sous la Maison, il ne se montre qu'aux plus braves.",
  stats: { prestige: 96, influence: 92, chance: 78 },
};
const RAID = {
  lobbyMs: 5 * MINUTE,
  turnMs: 18000, // temps pour choisir son action à chaque tour
  maxTurns: 12, // sinon le dragon s'enfuit
  pauseMs: 4000, // le résultat d'un tour reste affiché avant le suivant
  catchMs: 3 * MINUTE,
  hpPerPlayer: 600,
  maxPlayers: 20,
  hours: [13, 17, 21], // heures de Paris (plus 0 à 25 minutes au hasard)
  ballChance: 0.14, // chance de capture par carte lancée
  holoChance: 1 / 12, // version brillante
};
EVENTS[RAID_BOSS.id] = { ...C(RAID_BOSS.id, `${RAID_BOSS.name}, ${RAID_BOSS.title}`, "🐉", "mythique", RAID_BOSS.text), raidBoss: true, fixedStats: RAID_BOSS.stats };
ASTRE_BY_ID[RAID_BOSS.id] = RAID_BOSS.astre;
CARD_CHANNELS.splice(CARD_CHANNELS.findIndex(([k]) => k === "arene") + 1, 0, ["raids", "🐉・raids", "🐉 Les raids : un boss gigantesque sort des abysses plusieurs fois par jour. Battez-le tous ensemble, puis tentez de le capturer !"]);
{
  // ses attaques portent un nom (sur la carte et dans l'Arène)
  const cp = combatProfile;
  combatProfile = (card, holo = false) => {
    const r = cp(card, holo);
    return card?.raidBoss ? { ...r, attackName: RAID_BOSS.quick, specialName: RAID_BOSS.charged } : r;
  };
}

// ============================================================
// La carte : « Boss de raid », hors du commun
// ============================================================
let raidArtP = null;
function raidArt() {
  raidArtP ??= CLASH3D.renderDragon({ w: 600, h: 700 })
    .then((r) => c3Canvas(r.data, r.width, r.height))
    .catch((err) => {
      raidArtP = null;
      throw err;
    });
  return raidArtP;
}
// losange (étoile de raid)
function raidGem(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.62, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.62, y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
// fissures de magma dans le cadre d'obsidienne
function magmaCracks(ctx, W, H, R, t) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const pulse = 0.65 + 0.35 * Math.sin(TAU * t);
  for (let k = 0; k < 26; k++) {
    // départ sur un bord, vers l'intérieur du cadre
    const side = k % 4, p = R();
    let x = side === 0 ? p * W : side === 1 ? W - 4 : side === 2 ? p * W : 4;
    let y = side === 0 ? 4 : side === 1 ? p * H : side === 2 ? H - 4 : p * H;
    const dx = side === 1 ? -1 : side === 3 ? 1 : 0, dy = side === 0 ? 1 : side === 2 ? -1 : 0;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += dx * (3 + R() * 5) + (dy ? (R() - 0.5) * 14 : 0);
      y += dy * (3 + R() * 5) + (dx ? (R() - 0.5) * 14 : 0);
      ctx.lineTo(x, y);
    }
    ctx.shadowColor = "#ff5a00";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = `rgba(255,${120 + Math.round(R() * 80)},40,${0.55 * pulse})`;
    ctx.lineWidth = 1.2 + R() * 1.6;
    ctx.stroke();
  }
  ctx.restore();
}
async function drawRaidBossCard(card, holo = false, t = 0.37) {
  const W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const R = seeded(hashOf(card.id) + 3), cp = combatProfile(card, holo), elKey = elementOf(card);
  const gold = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.3);
  // 1. cadre d'obsidienne fissuré de magma
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  const ob = ctx.createLinearGradient(0, 0, W, H);
  ob.addColorStop(0, "#1c1030");
  ob.addColorStop(0.5, "#07030d");
  ob.addColorStop(1, "#1a0c26");
  ctx.fillStyle = ob;
  ctx.fillRect(0, 0, W, H);
  // reflets vitreux de l'obsidienne
  for (let k = 0; k < 6; k++) {
    const g = ctx.createLinearGradient(R() * W, 0, R() * W, H);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(196,181,253,0.06)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  magmaCracks(ctx, W, H, R, t);
  ctx.restore();
  // 2. le fond : un vortex des abysses
  const inner = { x: 20, y: 20, w: W - 40, h: H - 40 };
  ctx.save();
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
  ctx.clip();
  const vx = W / 2, vy = 300;
  const vg = ctx.createRadialGradient(vx, vy, 10, vx, vy, 520);
  vg.addColorStop(0, "#7e22ce");
  vg.addColorStop(0.25, "#3b0764");
  vg.addColorStop(0.6, "#12051f");
  vg.addColorStop(1, "#040108");
  ctx.fillStyle = vg;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  // bras de la spirale
  ctx.globalCompositeOperation = "screen";
  for (let arm = 0; arm < 5; arm++) {
    ctx.beginPath();
    for (let k = 0; k <= 60; k++) {
      const a = (arm / 5) * TAU + k * 0.11 + t * 0.8, r = 12 + k * 7.5;
      const x = vx + Math.cos(a) * r, y = vy + Math.sin(a) * r * 0.82;
      k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = `rgba(192,132,252,${0.07 + 0.03 * (arm % 2)})`;
    ctx.lineWidth = 22;
    ctx.stroke();
  }
  // braises et poussière d'étoiles qui montent
  for (let k = 0; k < 70; k++) {
    const x = inner.x + R() * inner.w, y = inner.y + ((R() * inner.h - t * 120 * (0.5 + R())) % inner.h + inner.h) % inner.h;
    const ember = k % 3 === 0, tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
    if (ember) disc(ctx, x, y, 1 + R() * 1.6, `rgba(255,${120 + Math.round(R() * 90)},40,${0.35 + 0.5 * tw})`);
    else sparkle(ctx, x, y, 0.8 + tw * 2.6, `rgba(233,213,255,${0.25 + 0.6 * tw})`);
  }
  ctx.restore();
  // 3. la fenêtre du boss : le dragon en 3D, la tête et les cornes débordent du cadre
  const win = { x: 34, y: 100, w: W - 68, h: 420 };
  ctx.save();
  roundRect(ctx, win.x, win.y, win.w, win.h, 16);
  ctx.fillStyle = "rgba(5,1,10,0.35)";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.restore();
  const art = await raidArt().catch(() => null);
  if (art) {
    // zone de dessin : la fenêtre, plus une bande au-dessus pour l'effet « sort de la carte »
    ctx.save();
    ctx.beginPath();
    ctx.rect(win.x, 52, win.w, win.y - 52);
    roundRect(ctx, win.x, win.y, win.w, win.h, 16);
    ctx.clip();
    ctx.shadowColor = `rgba(168,85,247,${0.75 + 0.25 * Math.sin(TAU * t)})`;
    ctx.shadowBlur = 28;
    const s = 0.9, dw = art.width * s, dh = art.height * s;
    ctx.drawImage(art, W / 2 - dw / 2 + 14, 28, dw, dh);
    ctx.restore();
    // souffle : lueur devant la gueule
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    glow(ctx, 84, 222, 70 + 12 * Math.sin(TAU * t * 2), "#e879f9", 0.45);
    ctx.restore();
  }
  // 4. bannière « BOSS DE RAID » et étoiles de raid
  ctx.save();
  const bw = 300, bx = W / 2 - bw / 2, by = 26;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw - 14, by + 19);
  ctx.lineTo(bx + bw, by + 38);
  ctx.lineTo(bx, by + 38);
  ctx.lineTo(bx + 14, by + 19);
  ctx.closePath();
  const bg = ctx.createLinearGradient(0, by, 0, by + 38);
  bg.addColorStop(0, "#ffd166");
  bg.addColorStop(0.5, "#f97316");
  bg.addColorStop(1, "#9a3412");
  ctx.fillStyle = bg;
  ctx.shadowColor = "rgba(249,115,22,0.8)";
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#2a0f05";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "17px CardEngrave";
  ctx.fillStyle = "#1c0703";
  ctx.textAlign = "center";
  spaced(ctx, "BOSS DE RAID", W / 2, by + 26, 4);
  ctx.restore();
  for (let k = 0; k < 5; k++) {
    const x = W / 2 + (k - 2) * 26, y = 80;
    ctx.save();
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 10;
    raidGem(ctx, x, y, 10, gold);
    ctx.restore();
  }
  // 5. plaque du nom
  const ny = win.y + win.h + 8;
  ctx.save();
  roundRect(ctx, 34, ny, W - 68, 66, 12);
  const pg = ctx.createLinearGradient(0, ny, 0, ny + 66);
  pg.addColorStop(0, "#1f1233");
  pg.addColorStop(1, "#0a0512");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = gold;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.font = "46px CardTitle";
  const ng = ctx.createLinearGradient(0, ny + 8, 0, ny + 52);
  ng.addColorStop(0, "#fff7d6");
  ng.addColorStop(0.55, "#f0abfc");
  ng.addColorStop(1, "#a855f7");
  ctx.shadowColor = "rgba(168,85,247,0.9)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = ng;
  ctx.fillText(RAID_BOSS.name.toUpperCase(), 54, ny + 46);
  ctx.shadowBlur = 0;
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(RAID_BOSS.title.toUpperCase(), 56, ny + 61);
  ctx.textAlign = "right";
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#fda4af";
  ctx.fillText(String(cp.hp), W - 92, ny + 44);
  const hw = ctx.measureText(String(cp.hp)).width;
  ctx.font = "14px CardBold";
  ctx.fillText("PV", W - 92 - hw - 6, ny + 42);
  ctx.restore();
  astreOrb(ctx, RAID_BOSS.astre, W - 62, ny + 33, 20);
  // 6. attaques, sur une dalle aux runes lumineuses
  const my = ny + 78;
  ctx.save();
  roundRect(ctx, 34, my, W - 68, 128, 12);
  ctx.fillStyle = "rgba(10,5,18,0.82)";
  ctx.fill();
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = "rgba(192,132,252,0.55)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  const moves = [
    { cost: 0, name: cp.attackName, dmg: cp.attack, text: "Attaque de base · aucune énergie · peut être esquivée" },
    { cost: SPECIAL_COST, name: cp.specialName, dmg: cp.special, text: `Coûte ${SPECIAL_COST} énergies · impossible à esquiver · brise la garde` },
  ];
  moves.forEach((mv, i) => {
    const y = my + 40 + i * 60;
    for (let k = 0; k < mv.cost; k++) energyOrb(ctx, elKey, 62 + k * 26, y - 8, 10);
    const nx = mv.cost ? 62 + mv.cost * 26 + 2 : 56;
    ctx.textAlign = "left";
    ctx.font = `${fitText(ctx, mv.name, W - nx - 130, 24, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#f5f3ff";
    ctx.fillText(mv.name, nx, y);
    ctx.textAlign = "right";
    ctx.font = "30px CardTitle";
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(String(mv.dmg), W - 56, y + 2);
    ctx.textAlign = "left";
    ctx.font = "12px CardText";
    ctx.fillStyle = "#c4b5fd";
    ctx.fillText(mv.text, 56, y + 20);
  });
  // 7. faiblesse, résistance, chance
  const sy = my + 150;
  const weak = astreWeakTo(RAID_BOSS.astre), strong = ASTRE_BEATS[RAID_BOSS.astre];
  [
    ["faiblesse", weak, `${ASTRES[weak].label} ×2`],
    ["résistance", strong, `${ASTRES[strong].label} ×0,5`],
    ["chance", null, String(cp.luck)],
  ].forEach(([label, s, value], i) => {
    const x = 60 + i * 176;
    ctx.textAlign = "left";
    ctx.font = "11px CardText";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText(label, x, sy);
    if (s) astreIcon(ctx, s, x + 7, sy + 15, 8);
    else combatIcon(ctx, 2, x + 7, sy + 15, "#f5f3ff");
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#f5f3ff";
    ctx.fillText(value, x + 20, sy + 20);
  });
  // 8. pied de carte
  const fy = H - 34;
  ctx.textAlign = "left";
  ctx.font = "12px CardBold";
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(numberOf(card).replace("#", ""), 44, fy);
  rarityIcon(ctx, card.rarity, W / 2 - 52, fy - 4, 7, "#f0abfc");
  ctx.font = "11px CardEngrave";
  ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), W / 2 - 40, fy);
  ctx.textAlign = "right";
  ctx.font = "11px CardText";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText("Capturé lors d'un raid", W - 44, fy);
  // 9. finitions : contour doré, reflet prismatique (holo), grain
  ctx.lineWidth = 3;
  ctx.strokeStyle = gold;
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  if (holo) {
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.55);
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 40; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      sparkle(ctx, 30 + R() * (W - 60), 30 + R() * (H - 60), 0.8 + tw * 3.4, `rgba(255,240,255,${0.3 + tw * 0.7})`);
    }
  }
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.08;
  ctx.drawImage(printTexture(), 0, 0);
  ctx.restore();
  return c;
}
{
  const draw = drawCreatureCard;
  drawCreatureCard = async (card, holo = false, t = 0.37) => (card?.raidBoss ? drawRaidBossCard(card, holo, t) : draw(card, holo, t));
}
// silhouette (avant l'éclosion) : la carte toute noire, cerclée de violet, et un point d'interrogation
async function raidSilhouette() {
  const card = EVENTS[RAID_BOSS.id], src = await drawRaidBossCard(card, false, 0.3);
  const W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.save();
  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 30;
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = "rgba(6,2,12,0.94)";
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  ctx.textAlign = "center";
  ctx.font = "220px CardTitle";
  ctx.fillStyle = "rgba(192,132,252,0.85)";
  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 40;
  ctx.fillText("?", W / 2, H / 2 + 70);
  return c;
}

// ============================================================
// Le raid en direct
// ============================================================
let raid = null;
const raidBossCard = () => EVENTS[RAID_BOSS.id];
const bar = (frac, n = 18) => "▰".repeat(Math.round(Math.max(0, Math.min(1, frac)) * n)) + "▱".repeat(n - Math.round(Math.max(0, Math.min(1, frac)) * n));
const raidMult = (f) => astreMult(f.astre, RAID_BOSS.astre);
const activeF = (p) => p.team[p.active];
const alive = (p) => p.team.some((f) => f.hp > 0);
// équipe conseillée : les plus fortes contre l'Ombre (une seule DUO, pas d'objet)
function raidBestTeam(userId) {
  const seen = new Set();
  let duo = false;
  return ownedKeys(userId)
    .map(([k]) => k)
    .filter((k) => !k.startsWith("ut_"))
    .map((k) => ({ k, f: fighter(k) }))
    .sort((a, b) => fighterPower(b.k) * raidMult(b.f) - fighterPower(a.k) * raidMult(a.f))
    .filter(({ k }) => {
      const id = k.replace("*", "");
      if (seen.has(id)) return false;
      if (id.startsWith("duo_")) {
        if (duo) return false;
        duo = true;
      }
      seen.add(id);
      return true;
    })
    .slice(0, 3)
    .map(({ k }) => k);
}
function raidLog(text) {
  raid.log.push(text);
  raid.log = raid.log.slice(-6);
  raid.dirty = true;
}
function nextRaidTime(from = Date.now()) {
  const p = parisParts();
  for (let day = 0; day < 3; day++)
    for (const h of RAID.hours) {
      const at = parisAt(p.wd, h) + day * 24 * 3600000 + Math.floor(Math.random() * 25) * MINUTE;
      if (at > from + MINUTE) return at;
    }
  return from + 4 * 3600000;
}

// --- Messages ---
function raidLobbyPayload(img) {
  const ps = [...raid.players.values()];
  const embed = new EmbedBuilder()
    .setColor(0x7e22ce)
    .setTitle("🥚 Un raid apparaît : un boss sort des abysses !")
    .setDescription(
      `Une silhouette gigantesque remue sous la Maison… **Elle éclot ${`<t:${Math.floor(raid.hatchAt / 1000)}:R>`}.**\n\n` +
        `⚔️ Rejoignez le raid et choisissez **3 cartes** : le boss est d'astre **🌑 Ombre**, les cartes **⭐ Étoile** lui infligent **double dégâts**.\n` +
        `🧑‍🤝‍🧑 Le combat se joue **en équipe, tour par tour** : attaquez, protégez, soignez… et lancez vos supers ensemble.\n` +
        `🎯 S'il tombe, chaque dresseur tente de le **capturer** : plus vous infligez de dégâts, plus vous avez de cartes de capture.`
    )
    .addFields({ name: `🧑‍🤝‍🧑 Dresseurs (${ps.length}/${RAID.maxPlayers})`, value: ps.map((p) => `• **${p.name}** — ${p.team.map((f) => f.name).join(", ")}`).join("\n").slice(0, 1000) || "*Personne pour l'instant : soyez le premier !*" });
  if (img) embed.setImage("attachment://raid.png");
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("raid_join").setLabel("Rejoindre le raid").setEmoji("⚔️").setStyle(ButtonStyle.Success).setDisabled(ps.length >= RAID.maxPlayers),
        new ButtonBuilder().setCustomId("raid_help").setLabel("Comment ça marche ?").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
function raidBoardPayload() {
  const ps = [...raid.players.values()].sort((a, b) => b.dmg + (b.support ?? 0) - (a.dmg + (a.support ?? 0))), frac = raid.boss.hp / raid.boss.max;
  const top = ps.slice(0, 10).map((p, i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} ${p.name} — **${p.dmg.toLocaleString("fr-FR")}**${p.support ? ` · 🛡️💚 ${p.support.toLocaleString("fr-FR")}` : ""}${p.out ? " 💀" : ""}${p.caught ? (p.holo ? " ✨🌈" : " ✨") : ""}`);
  let title, desc, color = 0x7e22ce;
  if (raid.phase === "fight") {
    title = `🐉 RAID — ${RAID_BOSS.name}, ${RAID_BOSS.title}${raid.raged ? " · 🔥 EN RAGE" : ""}`;
    desc =
      `\`${bar(frac)}\` **${Math.max(0, Math.ceil(raid.boss.hp)).toLocaleString("fr-FR")} / ${raid.boss.max.toLocaleString("fr-FR")} PV** (${Math.ceil(frac * 100)} %)\n` +
      `⚔️ **Tour ${raid.turn} / ${RAID.maxTurns}**${raid.stage === "choose" ? ` · choix jusqu'à <t:${Math.ceil(raid.turnEnd / 1000)}:R>` : " · résolution…"}\n\n` +
      (raid.stage === "choose" ? raidIntentText() : "📜 Le tour vient de se jouer : le suivant commence dans un instant.") +
      `\n\n*Votre poste de combat est dans votre message du raid (bouton ci-dessous si vous l'avez perdu).*`;
    if (raid.intent?.kind === "souffle" && raid.stage === "choose") color = 0xdc2626;
  } else if (raid.phase === "catch") {
    title = `🎉 ${RAID_BOSS.name} est à terre !`;
    color = 0x22c55e;
    desc = `Le dragon est vaincu ! Chaque dresseur a reçu des **cartes de capture** selon ses dégâts, ses soins et ses protections : lancez-les avant <t:${Math.floor(raid.catchEnd / 1000)}:t> pour tenter de le capturer.`;
  } else if (raid.phase === "fled") {
    title = `💨 ${RAID_BOSS.name} s'enfuit dans les abysses…`;
    color = 0x475569;
    desc = `Il lui restait **${Math.ceil(raid.boss.hp).toLocaleString("fr-FR")} PV**. Il reviendra : prochain raid <t:${Math.floor(load().raidNext / 1000)}:R>.`;
  } else {
    title = `🌑 ${RAID_BOSS.name} est retourné dans les abysses`;
    color = 0x581c87;
    const caught = ps.filter((p) => p.caught);
    desc = `${caught.length ? `✨ **Capturé par** : ${caught.map((p) => `${p.name}${p.holo ? " (brillant !)" : ""}`).join(", ")}` : "Personne n'a réussi à le capturer cette fois."}\n\nProchain raid <t:${Math.floor(load().raidNext / 1000)}:R>.`;
  }
  const embed = new EmbedBuilder().setColor(color).setTitle(title).setDescription(desc).setImage(`attachment://${raid.imgName ?? "raid.png"}`);
  if (raid.phase === "fight") {
    const team = [...raid.players.values()].map((p) => (p.out ? `💀 ~~${p.name}~~` : `${raid.stage === "choose" ? (p.choice ? "✅" : "⌛") : p.guarding ? "🛡️" : "▫️"} **${p.name}** — ${activeF(p).name} ${activeF(p).hp}/${activeF(p).maxHp} · ${"⚡".repeat(p.energy) || "·"}`));
    embed.addFields({ name: `🧑‍🤝‍🧑 L'équipe (${raidUp().length} debout sur ${raid.players.size})`, value: team.join("\n").slice(0, 1000) });
    if (raid.turnLog?.length) embed.addFields({ name: `📜 Tour ${raid.stage === "choose" ? raid.turn - 1 : raid.turn}`, value: raid.turnLog.join("\n").slice(0, 1000) });
  } else if (top.length) embed.addFields({ name: "⚔️ Dégâts (🛡️💚 soins et protections)", value: top.join("\n").slice(0, 1000) });
  const row = new ActionRowBuilder();
  if (raid.phase === "fight") row.addComponents(new ButtonBuilder().setCustomId("raid_open").setLabel("Ouvrir mon poste de combat").setEmoji("⚔️").setStyle(ButtonStyle.Danger));
  if (raid.phase === "catch") row.addComponents(new ButtonBuilder().setCustomId("raid_open").setLabel("Tenter la capture").setEmoji("🎯").setStyle(ButtonStyle.Success));
  return { embeds: [embed], components: row.components.length ? [row] : [] };
}
// le poste de combat d'un joueur (message privé)
function cockpitPayload(p, note = "") {
  const id = raid.id;
  if (raid.phase === "lobby") return { content: `✅ Vous êtes dans le raid avec **${p.team.map((f) => f.name).join(", ")}**.\nLe combat commence <t:${Math.floor(raid.hatchAt / 1000)}:R> : **gardez ce message ouvert**, il deviendra votre poste de combat.`, embeds: [], components: [] };
  if (raid.phase === "catch" || raid.phase === "done") {
    const chance = Math.round((1 - (1 - RAID.ballChance) ** p.balls) * 100);
    const embed = new EmbedBuilder()
      .setColor(p.caught ? 0xfbbf24 : 0x22c55e)
      .setTitle(p.caught ? `✨ ${RAID_BOSS.name} est à vous !` : `🎯 Capturez ${RAID_BOSS.name} !`)
      .setDescription(
        (note ? `${note}\n\n` : "") +
          (p.caught
            ? `Il a rejoint votre collection${p.holo ? " en version **brillante** 🌈" : ""}. Bravo !`
            : p.balls > 0
              ? `Vous avez **${p.balls} carte${p.balls > 1 ? "s" : ""} de capture** (${p.dmg.toLocaleString("fr-FR")} dégâts${p.support ? `, ${p.support.toLocaleString("fr-FR")} en soins et protections` : ""}).\nChaque lancer : ${Math.round(RAID.ballChance * 100)} % de chance · avec tout ce qui vous reste : **${chance} %**.`
              : raid.phase === "done"
                ? "Le raid est terminé."
                : "Vous n'avez plus de carte de capture… le dragon vous a échappé.")
      );
    const can = raid.phase === "catch" && !p.caught && p.balls > 0 && !p.throwing;
    return { content: null, embeds: [embed], components: can ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`raid_a_${id}_t`).setLabel(`Lancer une carte de capture (${p.balls})`).setEmoji("🎯").setStyle(ButtonStyle.Success))] : [] };
  }
  if (raid.phase === "fled") return { content: `💨 **${RAID_BOSS.name} s'est enfui.** Vous avez infligé ${p.dmg.toLocaleString("fr-FR")} dégâts. Prochain raid <t:${Math.floor(load().raidNext / 1000)}:R>.`, embeds: [], components: [] };
  const f = activeF(p), frac = raid.boss.hp / raid.boss.max, mult = raidMult(f), choosing = raid.stage === "choose";
  const allies = [...raid.players.values()].filter((x) => x !== p).map((x) => `${x.out ? "💀" : raidFrac(x) < 0.35 ? "🩸" : "•"} ${x.name} ${x.out ? "K.O." : `${Math.round(raidFrac(x) * 100)} %`}`);
  const embed = new EmbedBuilder()
    .setColor(raid.intent?.kind === "souffle" && choosing ? 0xdc2626 : p.out ? 0x475569 : 0x7e22ce)
    .setTitle(`🐉 Tour ${raid.turn} / ${RAID.maxTurns} — ${RAID_BOSS.name} ${Math.ceil(frac * 100)} % PV${raid.raged ? " · 🔥 rage" : ""}`)
    .setDescription(
      `\`${bar(frac, 16)}\`${choosing ? ` · fin du tour <t:${Math.ceil(raid.turnEnd / 1000)}:R>` : ""}\n\n` +
        (choosing ? `${raidIntentText(p)}\n` : "⏳ **Le tour se résout…**\n") +
        (note ? `\n${note}\n` : "") +
        (p.out
          ? "\n💀 **Toutes vos cartes sont K.O.** Un allié peut vous relever avec 💚 Soigner."
          : `\n🃏 **${f.name}** — ${f.hp} / ${f.maxHp} PV \`${bar(f.hp / f.maxHp, 10)}\`${mult > 1 ? " · ⭐ super efficace" : mult < 1 ? " · peu efficace" : ""}\n⚡ Énergie : ${"●".repeat(p.energy)}${"○".repeat(SPECIAL_COST - p.energy)}` +
            (choosing ? `\n${p.choice ? `🔒 Votre action : **${RAID_LABEL[p.choice.kind]}**` : "⌛ **Choisissez votre action**"}` : "")) +
        (allies.length ? `\n\n🧑‍🤝‍🧑 ${allies.slice(0, 12).join(" · ")}` : "")
    );
  const rows = [];
  if (!p.out && choosing) {
    const style = (k, base) => (p.choice?.kind === k ? ButtonStyle.Success : base);
    const needHeal = [...raid.players.values()].some((x) => x.out || (activeF(x).hp < activeF(x).maxHp && !x.out));
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`raid_a_${id}_q`).setLabel(`${f.attackName ?? "Attaque"} (${Math.round(f.attackDmg * mult)})`.slice(0, 80)).setEmoji("⚔️").setStyle(style("attaque", ButtonStyle.Primary)),
        new ButtonBuilder().setCustomId(`raid_a_${id}_s`).setLabel(`${f.special ?? "Super"} (${Math.round(f.specialDmg * mult)})`.slice(0, 80)).setEmoji("💥").setStyle(style("super", ButtonStyle.Danger)).setDisabled(p.energy < SPECIAL_COST),
        new ButtonBuilder().setCustomId(`raid_a_${id}_d`).setLabel("Protéger l'équipe").setEmoji("🛡️").setStyle(style("protect", ButtonStyle.Secondary)),
        new ButtonBuilder().setCustomId(`raid_a_${id}_r`).setLabel("Soigner").setEmoji("💚").setStyle(style("heal", ButtonStyle.Secondary)).setDisabled(!needHeal),
        new ButtonBuilder().setCustomId(`raid_a_${id}_w`).setLabel("Changer").setEmoji("🔄").setStyle(style("switch", ButtonStyle.Secondary)).setDisabled(p.team.filter((x) => x.hp > 0).length < 2)
      )
    );
  }
  return { content: null, embeds: [embed], components: rows };
}
// met à jour le poste d'un joueur sans attendre qu'il clique (au plus toutes les 1,2 s)
function pushCockpit(p, note = "", force = false) {
  if (!p.it) return;
  const now = Date.now();
  if (!force && now - (p.pushedAt ?? 0) < 1200) return void (p.pendingNote = note || p.pendingNote);
  p.pushedAt = now;
  p.it.editReply(cockpitPayload(p, note || p.pendingNote || "")).catch(() => null);
  p.pendingNote = "";
}
let raidImg = null;
async function raidBoard(force = false) {
  if (!raid?.msg) return;
  const now = Date.now();
  if (!force && (!raid.dirty || now - (raid.boardAt ?? 0) < 1500)) return;
  raid.dirty = false;
  raid.boardAt = now;
  const payload = raid.phase === "lobby" ? raidLobbyPayload(true) : raidBoardPayload();
  if (raid.newImg) {
    payload.files = [new AttachmentBuilder(raid.newImg, { name: raid.imgName })];
    payload.attachments = [];
    raid.newImg = null;
  }
  await raid.msg.edit(payload).catch(() => null);
}

// --- Déroulement ---
async function startRaid(lobbyMs = RAID.lobbyMs) {
  const ch = chan("raids");
  if (!ch || raid) return null;
  raid = { id: Date.now().toString(36), phase: "lobby", hatchAt: Date.now() + lobbyMs, players: new Map(), boss: { hp: 0, max: 0 }, log: [], dirty: false };
  const sil = await (await raidSilhouette()).encode("png");
  raid.msg = await ch.send({ ...raidLobbyPayload(true), files: [new AttachmentBuilder(sil, { name: "raid.png" })] }).catch(() => null);
  if (!raid.msg) {
    raid = null;
    return null;
  }
  setTimeout(() => hatchRaid().catch((err) => console.error("Raid (éclosion):", err.message)), lobbyMs);
  raidAutoArrivals(lobbyMs);
  return raid;
}
// --- Le combat d'équipe, tour par tour ---
// Chaque tour, le dragon annonce son prochain coup : une griffe sur un dresseur (souvent celui qui l'a le plus blessé),
// ou le souffle sur toute l'équipe. Chacun choisit son action en secret, puis tout se résout en même temps :
//   ⚔️ Attaque (+1 ⚡) · 💥 Super (3 ⚡) · 🛡️ Protéger l'équipe (+1 ⚡) · 💚 Soigner (l'allié le plus blessé, ou relever un K.O.) · 🔄 Changer.
// Travail d'équipe : un protecteur s'interpose devant la griffe et n'en prend que la moitié ; chaque protecteur réduit
// le souffle de 25 % pour tous (75 % au plus). Plusieurs supers le même tour : ASSAUT COMBINÉ, +50 %.
// À 50 % de ses PV, le dragon entre en rage : coups plus forts, souffle un tour sur deux.
const RAID_ACTIONS = { q: "attaque", s: "super", d: "protect", r: "heal", w: "switch" };
const RAID_LABEL = { attaque: "Attaque", super: "Super", protect: "Protéger l'équipe", heal: "Soigner", switch: "Changer de carte" };
const raidUp = () => [...raid.players.values()].filter((p) => !p.out);
const raidFrac = (p) => (p.out ? 0 : activeF(p).hp / activeF(p).maxHp);
// les polices du canvas n'ont pas d'emoji : on les retire des pseudos
const raidPlain = (s, n = 16) => String(s ?? "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").trim().slice(0, n);
function raidIntent() {
  const breath = raid.turn % (raid.raged ? 2 : 3) === 0;
  if (breath) return { kind: "souffle" };
  const up = raidUp();
  const top = up.slice().sort((a, b) => (b.lastDmg ?? 0) - (a.lastDmg ?? 0))[0];
  const target = top && (top.lastDmg ?? 0) > 0 && Math.random() < 0.6 ? top : up[Math.floor(Math.random() * up.length)];
  return { kind: "griffe", target: target?.id ?? null };
}
function raidIntentText(p = null) {
  const it = raid.intent;
  if (!it) return "";
  if (it.kind === "souffle") return `🌑 **${RAID_BOSS.name} inspire profondément** : le **${RAID_BOSS.charged}** va frapper **toute l'équipe** ! Plus il y a de protecteurs, moins il fait mal.`;
  const t = raid.players.get(it.target);
  if (p && t === p) return `🎯 **${RAID_BOSS.name} vous fixe** : sa **${RAID_BOSS.quick}** va s'abattre sur vous ! Protégez-vous, changez de carte… ou comptez sur un protecteur.`;
  return `🎯 **${RAID_BOSS.name} fixe ${t?.name ?? "un dresseur"}** : sa **${RAID_BOSS.quick}** va s'abattre sur ce dresseur. Un protecteur peut s'interposer.`;
}
// l'image de la scène : le dragon, son prochain coup, et toute l'équipe
async function raidScene(results = false) {
  const W = 1100, H = 580, c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1e0b3a");
  bg.addColorStop(0.6, "#0d0618");
  bg.addColorStop(1, "#05010a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 210, 320, 300, raid.raged ? "#ef4444" : "#a855f7", 0.45);
  const art = await raidArt().catch(() => null);
  if (art) ctx.drawImage(art, 0, 70, 420, 490);
  // PV du dragon
  const frac = Math.max(0, raid.boss.hp / raid.boss.max);
  ctx.textAlign = "left";
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${RAID_BOSS.name.toUpperCase()}${raid.raged ? " · EN RAGE" : ""}`, 30, 50);
  ctx.textAlign = "right";
  ctx.font = "20px CardBold";
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(`TOUR ${raid.turn} / ${RAID.maxTurns}`, W - 30, 46);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.beginPath();
  ctx.roundRect(440, 64, W - 470, 26, 13);
  ctx.fill();
  const hb = ctx.createLinearGradient(440, 0, W - 30, 0);
  hb.addColorStop(0, raid.raged ? "#dc2626" : "#7e22ce");
  hb.addColorStop(1, raid.raged ? "#f97316" : "#c026d3");
  ctx.fillStyle = hb;
  ctx.beginPath();
  ctx.roundRect(442, 66, Math.max(0, (W - 474) * frac), 22, 11);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${Math.max(0, Math.ceil(raid.boss.hp)).toLocaleString("fr-FR")} / ${raid.boss.max.toLocaleString("fr-FR")} PV`, 440 + (W - 470) / 2, 83);
  // le prochain coup (ou le résultat du tour)
  const it = raid.intent, t = it?.kind === "griffe" ? raid.players.get(it.target) : null;
  const banner = results ? "RÉSULTAT DU TOUR" : it?.kind === "souffle" ? `${RAID_BOSS.charged.toUpperCase()} : TOUTE L'ÉQUIPE !` : `${RAID_BOSS.quick.toUpperCase()} SUR ${raidPlain(t?.name ?? "?", 18).toUpperCase()}`;
  ctx.fillStyle = results ? "rgba(34,197,94,0.25)" : it?.kind === "souffle" ? "rgba(220,38,38,0.35)" : "rgba(249,115,22,0.3)";
  ctx.beginPath();
  ctx.roundRect(440, 104, W - 470, 40, 10);
  ctx.fill();
  ctx.font = "20px CardTitle";
  ctx.fillStyle = "#fff7ed";
  ctx.fillText(banner, 440 + (W - 470) / 2, 131);
  // l'équipe (deux colonnes)
  const ps = [...raid.players.values()], col = ps.length > 9 ? 2 : 1, rowH = Math.min(46, Math.floor(410 / Math.ceil(ps.length / col))), cw = (W - 470) / col;
  ps.forEach((p, k) => {
    const x = 440 + Math.floor(k / Math.ceil(ps.length / col)) * cw, y = 160 + (k % Math.ceil(ps.length / col)) * rowH, f = activeF(p);
    ctx.textAlign = "left";
    ctx.fillStyle = p.out ? "rgba(148,163,184,0.15)" : "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y, cw - 10, rowH - 6, 8);
    ctx.fill();
    // a choisi / protège / est visé
    const dot = p.out ? "#475569" : results ? (p.guarding ? "#38bdf8" : "#22c55e") : p.choice ? "#22c55e" : "#f59e0b";
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x + 14, y + (rowH - 6) / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${Math.min(17, rowH * 0.4)}px CardBold`;
    ctx.fillStyle = p.out ? "#94a3b8" : t === p && !results ? "#fdba74" : "#ffffff";
    ctx.fillText(`${raidPlain(p.name)}${p.out ? " · K.O." : ""}`, x + 28, y + rowH * 0.38);
    ctx.font = `${Math.min(13, rowH * 0.3)}px CardText`;
    ctx.fillStyle = "#cbd5e1";
    if (!p.out) ctx.fillText(`${raidPlain(f.name, 22)} · ${f.hp}/${f.maxHp}`, x + 28, y + rowH * 0.72);
    // PV de la carte et énergie
    const bw = Math.min(150, cw * 0.32), bx = x + cw - bw - 22;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx, y + rowH * 0.3, bw, 8);
    const fr = raidFrac(p);
    ctx.fillStyle = fr > 0.5 ? "#22c55e" : fr > 0.25 ? "#f59e0b" : "#ef4444";
    ctx.fillRect(bx, y + rowH * 0.3, bw * fr, 8);
    for (let e = 0; e < SPECIAL_COST; e++) {
      ctx.fillStyle = e < p.energy ? "#facc15" : "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.arc(bx + 6 + e * 14, y + rowH * 0.66, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  raid.newImg = await c.encode("jpeg", 86);
  raid.imgName = `raid-${raid.turn}${results ? "r" : ""}.jpg`;
  CLASH3D.nettoyer(true);
}
async function raidStartTurn() {
  raid.turn++;
  raid.stage = "choose";
  raid.turnEnd = Date.now() + RAID.turnMs;
  if (!raid.raged && raid.boss.hp <= raid.boss.max / 2) {
    raid.raged = true;
    raidLog(`🔥 ${RAID_BOSS.name} entre en rage !`);
  }
  for (const p of raid.players.values()) {
    p.choice = null;
    p.guarding = false;
    p.autoAt = Date.now() + raidRnd(2500, 9000); // le temps de réflexion d'un joueur automatique
  }
  raid.intent = raidIntent();
  await raidScene();
  raid.dirty = true;
  await raidBoard(true);
  for (const p of raid.players.values()) pushCockpit(p, raid.turn === 1 ? "🐉 **Le dragon éclot ! Choisissez votre action pour ce tour.**" : "", true);
}
async function hatchRaid() {
  if (!raid || raid.phase !== "lobby") return;
  const n = raid.players.size;
  if (!n) {
    raid.phase = "fled";
    raid.boss = { hp: 0, max: 0 };
    load().raidNext = nextRaidTime();
    save();
    await raid.msg.edit({ embeds: [new EmbedBuilder().setColor(0x475569).setTitle(`🌑 Personne n'a répondu à l'appel…`).setDescription(`Le boss est retourné dans les abysses. Prochain raid <t:${Math.floor(load().raidNext / 1000)}:R>.`)], components: [] }).catch(() => null);
    raid = null;
    return;
  }
  raid.phase = "fight";
  raid.boss = { hp: RAID.hpPerPlayer * n, max: RAID.hpPerPlayer * n };
  raid.turn = 0;
  raid.turnLog = [];
  raid.startAt = Date.now();
  await raidStartTurn();
  raid.timer = setInterval(() => raidTurnStep().catch((err) => console.error("Raid:", err.message)), 500);
}
async function raidTurnStep() {
  if (!raid || raid.phase !== "fight" || raid.busy || raid.stage !== "choose") return;
  raidAutoChoose(Date.now());
  // tout le monde a choisi (ou le temps est écoulé) : le tour se résout
  if (Date.now() >= raid.turnEnd || raidUp().every((p) => p.choice)) {
    raid.busy = true;
    try {
      await raidResolveTurn();
    } finally {
      if (raid) raid.busy = false;
    }
  } else await raidBoard();
}
// une carte touchée : K.O. → la suivante entre ; plus aucune → le dresseur est à terre (un allié peut le relever)
function raidHurt(p, dmg, label, lines) {
  const f = activeF(p);
  f.hp = Math.max(0, f.hp - dmg);
  p.note += `\n🩸 **${label}** : −${dmg} PV à ${f.name}.`;
  if (f.hp > 0) return;
  const next = p.team.findIndex((x) => x.hp > 0);
  if (next >= 0) {
    p.active = next;
    p.note += ` **K.O. !** ${p.team[next].name} prend la relève.`;
  } else {
    p.out = true;
    p.note += " **Toutes vos cartes sont K.O. !** Un allié peut vous relever avec 💚 Soigner.";
    lines.push(`💀 **${p.name}** est à terre !`);
  }
}
async function raidResolveTurn() {
  raid.stage = "resolve";
  const ps = [...raid.players.values()], up = raidUp(), lines = [];
  for (const p of ps) p.note = "";
  for (const p of up) p.choice ??= { kind: "attaque", auto: true }; // sans choix : une attaque simple
  // 1. changements de carte et protections
  for (const p of up) {
    p.lastDmg = 0;
    if (p.choice.kind === "switch") {
      const order = p.team.map((_, i) => (p.active + 1 + i) % p.team.length).filter((i) => p.team[i].hp > 0 && i !== p.active);
      if (order.length) {
        p.active = order[0];
        p.note += `\n🔄 **${activeF(p).name}** entre dans le combat.`;
      }
    } else if (p.choice.kind === "protect") {
      p.guarding = true;
      p.energy = Math.min(SPECIAL_COST, p.energy + 1);
      p.note += "\n🛡️ Vous protégez l'équipe.";
    }
  }
  const guards = up.filter((p) => p.guarding);
  if (guards.length) lines.push(`🛡️ ${guards.map((p) => `**${p.name}**`).join(", ")} protège${guards.length > 1 ? "nt" : ""} l'équipe`);
  // 2. les attaques (assaut combiné si plusieurs supers)
  const supers = up.filter((p) => p.choice.kind === "super" && p.energy >= SPECIAL_COST).length, combo = supers >= Math.max(2, Math.ceil(up.length / 3));
  if (combo) lines.push(`⚡ **ASSAUT COMBINÉ !** ${supers} supers en même temps : **+50 %** de dégâts.`);
  let total = 0;
  for (const p of up) {
    const kind = p.choice.kind;
    if (kind !== "attaque" && kind !== "super") continue;
    const f = activeF(p), mult = raidMult(f), sup = kind === "super" && p.energy >= SPECIAL_COST;
    const dmg = Math.max(1, Math.round((sup ? f.specialDmg : f.attackDmg) * mult * (0.9 + Math.random() * 0.2) * (sup && combo ? 1.5 : 1)));
    raid.boss.hp -= dmg;
    p.dmg += dmg;
    p.lastDmg = dmg;
    total += dmg;
    p.energy = sup ? 0 : Math.min(SPECIAL_COST, p.energy + 1);
    p.note += `\n${sup ? "💥" : "⚔️"} **${sup ? f.special ?? "Super" : f.attackName ?? "Attaque"}** : −${dmg}${mult > 1 ? " · ⭐ super efficace" : mult < 1 ? " · peu efficace" : ""}`;
    if (sup) lines.push(`💥 **${p.name}** : ${f.special ?? "Super"} −${dmg}${mult > 1 ? " ⭐" : ""}`);
  }
  if (total) lines.unshift(`⚔️ L'équipe inflige **${total.toLocaleString("fr-FR")}** dégâts`);
  // 3. les soins : relever un allié à terre d'abord, sinon soigner le plus blessé
  for (const p of up.filter((x) => x.choice.kind === "heal")) {
    const down = ps.find((x) => x.out && !x.healedThisTurn);
    if (down) {
      for (const f of down.team) f.hp = Math.max(f.hp, Math.ceil(f.maxHp * 0.3));
      down.out = false;
      down.active = down.team.findIndex((f) => f.hp > 0);
      down.healedThisTurn = true;
      p.support = (p.support ?? 0) + 60;
      p.note += `\n💚 Vous relevez **${down.name}** !`;
      down.note += `\n💚 **${p.name}** vous relève : vos cartes reviennent à 30 % de leurs PV.`;
      lines.push(`💚 **${p.name}** relève **${down.name}** !`);
      continue;
    }
    const target = up.filter((x) => activeF(x).hp < activeF(x).maxHp).sort((a, b) => raidFrac(a) - raidFrac(b))[0];
    if (!target) {
      p.note += "\n💚 Personne n'avait besoin de soins.";
      continue;
    }
    const f = activeF(target), heal = Math.min(f.maxHp - f.hp, Math.ceil(f.maxHp * 0.3));
    f.hp += heal;
    p.support = (p.support ?? 0) + heal;
    p.note += `\n💚 Vous soignez **${target.name}** : +${heal} PV.`;
    if (target !== p) target.note += `\n💚 **${p.name}** vous soigne : +${heal} PV.`;
    lines.push(`💚 **${p.name}** soigne **${target.name}** (+${heal})`);
  }
  for (const p of ps) p.healedThisTurn = false;
  // 4. le dragon frappe (s'il est encore debout)
  if (raid.boss.hp > 0) {
    const rage = raid.raged ? 1.3 : 1, alive = raidUp();
    if (raid.intent.kind === "souffle") {
      const red = Math.min(0.75, 0.25 * guards.length);
      lines.push(`🌑 **${RAID_BOSS.charged}** sur toute l'équipe${red ? ` (−${Math.round(red * 100)} % grâce aux protecteurs)` : " : personne ne protège !"}`);
      for (const p of alive) {
        const base = raidRnd(55, 70) * rage;
        if (!p.guarding) for (const g of guards) g.support = (g.support ?? 0) + Math.round(base * 0.25);
        raidHurt(p, Math.round(base * (p.guarding ? 0.5 : 1 - red)), RAID_BOSS.charged, lines);
      }
    } else if (alive.length) {
      let t = raid.players.get(raid.intent.target);
      if (!t || t.out) t = alive[Math.floor(Math.random() * alive.length)];
      // à peu de dresseurs, la griffe frappe moins fort (seul, on la prend à chaque tour)
      const base = raidRnd(42, 56) * rage * Math.min(1, 0.55 + 0.15 * raid.players.size), others = guards.filter((g) => g !== t && !g.out);
      let who = t, k = 1;
      if (t.guarding) k = 0.5;
      else if (others.length) {
        who = others[Math.floor(Math.random() * others.length)];
        k = 0.5;
        who.support = (who.support ?? 0) + Math.round(base);
        t.note += `\n🛡️ **${who.name}** s'interpose devant vous !`;
        lines.push(`🛡️ **${who.name}** s'interpose devant **${t.name}** !`);
      }
      const dmg = Math.round(base * k);
      lines.push(`🐉 **${RAID_BOSS.quick}** sur **${who.name}** : −${dmg}`);
      raidHurt(who, dmg, RAID_BOSS.quick, lines);
    }
  }
  raid.turnLog = lines;
  if (raid.boss.hp <= 0) {
    raid.boss.hp = 0;
    return raidVictory();
  }
  if (!raidUp().length || raid.turn >= RAID.maxTurns) return raidFlee();
  // le résultat reste affiché quelques secondes, puis le tour suivant
  await raidScene(true);
  raid.dirty = true;
  await raidBoard(true);
  for (const p of ps) pushCockpit(p, p.note.trim(), true);
  await sleep(RAID.pauseMs);
  if (raid?.phase === "fight") await raidStartTurn();
}
// les dresseurs automatiques jouent en équipe : protéger contre le souffle, soigner les blessés, super dès que possible
function raidAutoChoose(now) {
  for (const p of raid.players.values()) {
    if (!p.auto || p.out || p.choice || now < (p.autoAt ?? 0)) continue;
    const f = activeF(p), mine = f.hp / f.maxHp;
    const guards = raidUp().filter((x) => x.choice?.kind === "protect").length;
    const hurt = [...raid.players.values()].filter((x) => x !== p && (x.out || raidFrac(x) < 0.35));
    let k;
    if (raid.intent.kind === "souffle" && guards < 2 && mine > 0.5 && Math.random() < 0.45) k = "d";
    else if (raid.intent.kind === "griffe" && raid.intent.target === p.id && mine < 0.4) k = p.team.filter((x) => x.hp > 0).length > 1 && Math.random() < 0.5 ? "w" : "d";
    else if (hurt.length && Math.random() < 0.5) k = "r";
    else k = p.energy >= SPECIAL_COST ? "s" : "q";
    raidAct(p, k);
  }
}
async function raidVictory() {
  clearInterval(raid.timer);
  raid.phase = "catch";
  raid.catchEnd = Date.now() + RAID.catchMs;
  // les soins et les protections comptent aussi (le travail d'équipe est récompensé)
  const score = (p) => p.dmg + 0.8 * (p.support ?? 0);
  const ps = [...raid.players.values()], fair = raid.boss.max / ps.length, best = Math.max(...ps.map(score));
  for (const p of ps) {
    const ratio = score(p) / fair;
    p.balls = score(p) > 0 ? Math.min(7, 2 + Math.floor(ratio * 2.5)) + (score(p) === best ? 1 : 0) : 0;
    ustat(p.id, "raids");
  }
  raidLog(`🎉 ${RAID_BOSS.name} est vaincu !`);
  await raidBoard(true);
  for (const p of ps) pushCockpit(p, `🎉 **${RAID_BOSS.name} est vaincu !** Vous avez infligé ${p.dmg.toLocaleString("fr-FR")} dégâts.`, true);
  setTimeout(() => raidEnd().catch(() => null), RAID.catchMs);
  for (const p of ps) if (p.auto) raidAutoCatch(p).catch((err) => console.error("Raid (capture auto):", err.message));
  raidVictoryClip(ps).catch((err) => console.error("Vidéo du raid:", err.message));
}
// la chute du dragon en vidéo, avec le son
async function raidVictoryClip(ps) {
  const M = require("./moments"), ch = chan("raids");
  if (!ch || !M.videoOk()) return;
  const podium = [...ps].sort((a, b) => b.dmg - a.dmg).filter((p) => p.dmg > 0).slice(0, 3).map((p) => p.name);
  const clip = await M.raidVideo({ art: await raidArt().catch(() => null), boss: RAID_BOSS.name.toUpperCase(), podium });
  const msg = await ch.send({ content: `🎉 **${RAID_BOSS.name} est vaincu !** 🔊 *Montez le son !*`, files: [new AttachmentBuilder(clip, { name: "victoire.mp4" })] }).catch(() => null);
  deleteLater(msg, 60 * MINUTE);
}
async function raidFlee() {
  clearInterval(raid.timer);
  raid.phase = "fled";
  load().raidNext = nextRaidTime();
  save();
  await raidBoard(true);
  for (const p of raid.players.values()) pushCockpit(p, "", true);
  raidAutoReport();
  raid = null;
}
async function raidEnd() {
  if (!raid || raid.phase !== "catch") return;
  // un lancer en cours va jusqu'au bout avant la fermeture
  if ([...raid.players.values()].some((p) => p.throwing)) return void setTimeout(() => raidEnd().catch(() => null), 3000);
  raid.phase = "done";
  load().raidNext = nextRaidTime();
  save();
  await raidBoard(true);
  for (const p of raid.players.values()) if (!p.caught) pushCockpit(p, "", true);
  raidAutoReport();
  raid = null;
}
// lancer d'une carte de capture : suspense, puis le verdict
async function raidThrow(interaction, p) {
  p.throwing = true;
  p.balls--;
  await interaction.update(cockpitPayload(p, "🎯 La carte de capture file vers le dragon…"));
  const steps = ["🌀 Elle l'aspire ! ⚪", "🌀 Le dragon se débat… ⚪⚪", "🌀 Encore un peu… ⚪⚪⚪"];
  for (const s of steps) {
    await sleep(900);
    await interaction.editReply(cockpitPayload(p, s)).catch(() => null);
  }
  await sleep(800);
  const ok = raidCatchRoll(p);
  if (ok) {
    const img = await (await drawCreatureCard(raidBossCard(), p.holo, 0.3)).encode("png");
    await interaction.editReply({ ...cockpitPayload(p, "✨ **CAPTURÉ !**"), files: [new AttachmentBuilder(img, { name: "nyxaros.png" })] }).catch(() => null);
    await raidBoard(true);
  } else await interaction.editReply(cockpitPayload(p, p.balls ? "💨 **Le dragon s'est libéré !** Relancez vite !" : "💨 **Le dragon s'est libéré…** C'était votre dernière carte.")).catch(() => null);
}

// un clic sur le poste de combat : l'action du tour (on peut changer d'avis jusqu'à la résolution)
function raidAct(p, kind) {
  if (raid.stage !== "choose") return "⏳ Le tour se résout…";
  if (p.out) return "💀 Vos cartes sont K.O. : un allié peut vous relever avec 💚 Soigner.";
  const c = RAID_ACTIONS[kind];
  if (!c) return "";
  if (c === "super" && p.energy < SPECIAL_COST) return `⚡ Il faut ${SPECIAL_COST} énergies pour le super (vous en avez ${p.energy}).`;
  if (c === "switch" && p.team.filter((x) => x.hp > 0).length < 2) return "🔄 Aucune autre carte debout.";
  p.choice = { kind: c };
  raid.dirty = true;
  return `🔒 Votre action : **${RAID_LABEL[c]}**. Vous pouvez encore changer d'avis avant la fin du tour.`;
}

// ============================================================
// Raid automatique (« … full » en message privé, voir 29-automatique) : les membres inscrits entrent au prochain raid,
// combattent et tentent la capture tout seuls, avec les mêmes règles et le même rythme qu'un joueur.
// Pour les autres, rien ne change : ce sont des dresseurs comme les autres. Le bilan part en privé à AUTO_TRIGGER_ID.
// ============================================================
const raidRnd = (a, b) => a + Math.random() * (b - a);
function raidAutoJoin(userId) {
  if (!raid || raid.phase !== "lobby" || raid.players.has(userId) || raid.players.size >= RAID.maxPlayers) return null;
  const keys = raidBestTeam(userId);
  if (!keys.length) return null;
  const p = { id: userId, name: pseudo(userId), team: keys.map(fighter), active: 0, energy: 0, dmg: 0, readyAt: 0, dodgeUntil: 0, out: false, revived: false, balls: 0, caught: false, it: null, auto: true, thrown: 0 };
  raid.players.set(userId, p);
  raid.dirty = true;
  raidBoard(true).catch(() => null); // la liste des dresseurs se met à jour tout de suite
  return p;
}
// pendant l'attente, chaque inscrit rejoint à un moment différent (comme quelqu'un qui voit passer le raid)
function raidAutoArrivals(lobbyMs) {
  const rid = raid?.id;
  for (const id of Object.keys(load().raidAuto ?? {}).filter((x) => !AUTO_EXCLUDE.has(x))) {
    const at = Math.min(lobbyMs - 15000, raidRnd(12000, Math.max(20000, lobbyMs * 0.75)));
    setTimeout(() => raid?.id === rid && raidAutoJoin(id), Math.max(3000, at));
  }
}
// inscription par « … full » : le raid en attente tout de suite, sinon le prochain
function raidAutoEnroll(userId) {
  if (AUTO_EXCLUDE.has(userId)) return "🐉 raid : exclu du raid automatique";
  if (!raidBestTeam(userId).length) return "🐉 raid : aucune carte pour combattre";
  const st = load();
  (st.raidAuto ??= {})[userId] = Date.now();
  save();
  const auto = "combat et capture automatiques";
  if (raid?.phase === "lobby") {
    const p = raid.players.get(userId) ?? raidAutoJoin(userId);
    if (p) return `🐉 raid qui éclot <t:${Math.floor(raid.hatchAt / 1000)}:R> : déjà dedans avec ${p.team.map((f) => f.name).join(", ")} · ${p.auto ? auto : "joue à la main"}`;
  }
  st.raidNext ??= nextRaidTime();
  return `🐉 prochain raid (<t:${Math.floor(st.raidNext / 1000)}:R>) : place réservée · ${auto}${raid?.phase === "fight" ? " (un raid est déjà en plein combat)" : ""}`;
}
// le verdict d'un lancer de carte de capture (joueurs et raid automatique)
function raidCatchRoll(p) {
  const ok = Math.random() < RAID.ballChance;
  p.throwing = false;
  p.thrown = (p.thrown ?? 0) + 1;
  if (ok) {
    p.caught = true;
    p.holo = Math.random() < RAID.holoChance;
    give(p.id, raidBossCard(), p.holo);
    ustat(p.id, "raidCatches");
    raidLog(`✨ ${p.name} capture ${RAID_BOSS.name}${p.holo ? " (brillant !)" : ""}`);
    raid.dirty = true;
  }
  return ok;
}
// la capture : toutes les cartes, une à une, avec le même suspense qu'un vrai lancer
async function raidAutoCatch(p) {
  const r = raid;
  await sleep(raidRnd(4000, 12000));
  while (raid === r && raid.phase === "catch" && p.auto && !p.caught && p.balls > 0) {
    p.throwing = true;
    p.balls--;
    await sleep(3500);
    if (raid !== r) return void (p.throwing = false);
    if (raidCatchRoll(p)) await raidBoard(true);
    else await sleep(raidRnd(1500, 4500));
  }
  p.throwing = false;
}
// à la fin du raid : les inscrits qui y étaient sont retirés de la liste, et le bilan part en privé
function raidAutoReport() {
  const st = load(), list = st.raidAuto ?? {};
  const mine = [...raid.players.values()].filter((p) => list[p.id]);
  if (!mine.length) return;
  for (const p of mine) delete list[p.id];
  save();
  const ranked = [...raid.players.values()].sort((a, b) => b.dmg - a.dmg), won = raid.phase !== "fled";
  const lines = mine.map(
    (p) =>
      `• **${p.name}** : ${p.dmg.toLocaleString("fr-FR")} dégâts (${ranked.indexOf(p) ? `${ranked.indexOf(p) + 1}ᵉ` : "1er"} sur ${ranked.length})` +
      (!won ? "" : p.caught ? ` · ✨ **${RAID_BOSS.name} capturé${p.holo ? " en brillant 🌈" : ""} !**` : p.thrown ? ` · pas capturé (${p.thrown} carte${p.thrown > 1 ? "s" : ""} lancée${p.thrown > 1 ? "s" : ""})` : " · pas de carte de capture") +
      (p.auto ? "" : " · a joué à la main")
  );
  const text = `🐉 **Raid automatique** — ${won ? `${RAID_BOSS.name} est vaincu !` : `${RAID_BOSS.name} s'est enfui (il lui restait ${Math.ceil(raid.boss.hp).toLocaleString("fr-FR")} PV).`}\n${lines.join("\n")}`;
  cardClient?.users
    .fetch(AUTO_TRIGGER_ID)
    .then((u) => u.send(text.slice(0, 1990)))
    .catch(() => null);
}

// --- Boutons et commande ---
async function handleRaidInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "raid";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("raid_"))) return false;
  const userId = interaction.user.id;
  if (isCmd) {
    if (raid) return void (await interaction.reply({ content: `🐉 Un raid est en cours dans ${chan("raids")} !`, ephemeral: true })) || true;
    if (!isGerant(interaction.member)) {
      load().raidNext ??= nextRaidTime();
      return void (await interaction.reply({ content: `🐉 Prochain raid <t:${Math.floor(load().raidNext / 1000)}:R> dans ${chan("raids")}.`, ephemeral: true })) || true;
    }
    await interaction.deferReply({ ephemeral: true });
    const r = await startRaid(2 * MINUTE);
    await interaction.editReply(r ? `🐉 Raid lancé dans ${chan("raids")} : éclosion dans 2 minutes.` : "❌ Impossible de lancer le raid (salon introuvable).");
    return true;
  }
  if (id === "raid_help") {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(0x7e22ce)
          .setTitle("📖 Les raids")
          .setDescription(
            `1️⃣ **Rejoindre** : choisissez 3 cartes avant l'éclosion. Le boss **${RAID_BOSS.name}** est d'astre 🌑 Ombre : les cartes ⭐ **Étoile** font **×2**, les cartes 🌙 Lune seulement ×0,5.\n` +
              `2️⃣ **Combattre en équipe, tour par tour** (12 tours) : à chaque tour, le dragon **annonce son coup** — sa **${RAID_BOSS.quick}** sur un dresseur, ou son **${RAID_BOSS.charged}** sur toute l'équipe. Chacun choisit en secret :\n` +
              `⚔️ **Attaque** (+1 ⚡) · 💥 **Super** (3 ⚡) · 🛡️ **Protéger l'équipe** (s'interpose devant la griffe, chaque protecteur réduit le souffle de 25 %) · 💚 **Soigner** (l'allié le plus blessé, ou relever un allié K.O.) · 🔄 **Changer** de carte.\n` +
              `Plusieurs supers le même tour : **assaut combiné, +50 %**. À 50 % de ses PV, le dragon **entre en rage**. Une carte K.O. : la suivante entre.\n` +
              `3️⃣ **Capturer** : s'il tombe à temps, chacun reçoit **2 à 8 cartes de capture** selon ses dégâts, ses soins et ses protections. Chaque lancer : ${Math.round(RAID.ballChance * 100)} % de chance. Parfois… il est **brillant** 🌈.\n\n` +
              `Raids vers ${RAID.hours.map((h) => `${h} h`).join(", ")} chaque jour.`
          ),
      ],
    });
    return true;
  }
  if (id === "raid_join") {
    if (!raid || raid.phase !== "lobby") return void (await interaction.reply({ content: "⏳ Ce raid a déjà commencé.", ephemeral: true })) || true;
    if (raid.players.has(userId)) return void (await interaction.reply({ ...cockpitPayload(raid.players.get(userId)), ephemeral: true })) || true;
    if (raid.players.size >= RAID.maxPlayers) return void (await interaction.reply({ content: "🚪 Le raid est complet.", ephemeral: true })) || true;
    const best = raidBestTeam(userId);
    if (!best.length) return void (await interaction.reply({ content: "❌ Il vous faut au moins une carte pour rejoindre un raid.", ephemeral: true })) || true;
    const seen = new Set();
    const options = ownedKeys(userId)
      .map(([k]) => k)
      .filter((k) => !k.startsWith("ut_") && !seen.has(k.replace("*", "")) && seen.add(k.replace("*", "")))
      .map((k) => ({ k, f: fighter(k) }))
      .sort((a, b) => fighterPower(b.k) * raidMult(b.f) - fighterPower(a.k) * raidMult(a.f))
      .slice(0, 25)
      .map(({ k, f }) => ({ label: keyLabel(k).slice(0, 100), value: k, description: `${ASTRES[f.astre]?.label ?? "—"}${raidMult(f) > 1 ? " · ×2 contre le boss !" : raidMult(f) < 1 ? " · ×0,5 contre le boss" : ""} · ${f.maxHp} PV · ${f.attackDmg}/${f.specialDmg}`.slice(0, 100) }));
    await interaction.reply({
      ephemeral: true,
      content: `⚔️ **Choisissez votre équipe** (jusqu'à 3 cartes, une seule DUO). Les meilleures contre le boss sont en haut.\n✨ Équipe conseillée : **${best.map(keyLabel).join(", ")}**`,
      components: [
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("raid_auto").setLabel("Prendre l'équipe conseillée").setEmoji("✨").setStyle(ButtonStyle.Success)),
        new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("raid_pick").setPlaceholder("Ou choisir mes cartes…").setMinValues(1).setMaxValues(Math.min(3, options.length)).addOptions(options)),
      ],
    });
    return true;
  }
  if (id === "raid_auto" || id === "raid_pick") {
    if (!raid || raid.phase !== "lobby") return void (await interaction.update({ content: "⏳ Ce raid a déjà commencé.", components: [] })) || true;
    if (raid.players.size >= RAID.maxPlayers && !raid.players.has(userId)) return void (await interaction.update({ content: "🚪 Le raid est complet.", components: [] })) || true;
    const keys = id === "raid_auto" ? raidBestTeam(userId) : interaction.values;
    if (keys.filter((k) => k.startsWith("duo_")).length > 1) return void (await interaction.update({ content: "❌ **Une seule carte DUO** par équipe : refaites votre choix.", components: [] })) || true;
    const p = { id: userId, name: pseudo(userId), team: keys.slice(0, 3).map(fighter), active: 0, energy: 0, dmg: 0, readyAt: 0, dodgeUntil: 0, out: false, revived: false, balls: 0, caught: false, it: interaction };
    raid.players.set(userId, p);
    raid.dirty = true;
    await interaction.update(cockpitPayload(p));
    await raidBoard();
    return true;
  }
  if (id === "raid_open") {
    const p = raid?.players.get(userId);
    if (!p) return void (await interaction.reply({ content: raid ? "Vous ne participez pas à ce raid." : "Ce raid est terminé.", ephemeral: true })) || true;
    p.it = interaction;
    p.auto = false; // le joueur reprend la main
    await interaction.reply({ ...cockpitPayload(p), ephemeral: true });
    return true;
  }
  const act = /^raid_a_(\w+)_(q|s|d|w|r|t)$/.exec(id);
  if (act) {
    const p = raid?.players.get(userId);
    if (!raid || raid.id !== act[1] || !p) return void (await interaction.update({ content: "Ce raid est terminé.", embeds: [], components: [] }).catch(() => null)) || true;
    p.it = interaction;
    p.auto = false;
    const now = Date.now(), kind = act[2];
    if (kind === "t") {
      if (raid.phase !== "catch" || p.caught || p.balls <= 0 || p.throwing) return void (await interaction.update(cockpitPayload(p))) || true;
      await raidThrow(interaction, p);
      return true;
    }
    if (raid.phase !== "fight") return void (await interaction.update(cockpitPayload(p))) || true;
    const note = raidAct(p, kind, now);
    p.pushedAt = now;
    await interaction.update(cockpitPayload(p, note));
    if (raid?.boss.hp <= 0 && raid.phase === "fight") await raidVictory();
    return true;
  }
  return false;
}
{
  // les boutons du raid passent avant ceux de la boutique (même chaîne de traitement)
  const shop = handleShopInteraction;
  handleShopInteraction = async (interaction) => (await handleRaidInteraction(interaction)) || shop(interaction);
  // le programme : vérifié chaque minute
  const loop = shopLoop;
  shopLoop = async () => {
    await loop();
    const st = load();
    st.raidNext ??= nextRaidTime();
    if (!raid && Date.now() >= st.raidNext && chan("raids")) {
      st.raidNext = nextRaidTime(Date.now() + 2 * 3600000);
      save();
      await startRaid().catch((err) => console.error("Raid:", err.message));
    }
  };
}
