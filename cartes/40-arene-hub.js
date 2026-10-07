
// --- Nouveau menu de combat : parties classées (file d'attente en ligne), boss de la semaine, entraînement, défis amicaux ---
// • Classée : on rejoint une file ; le bot associe deux joueurs de niveau proche (l'écart toléré grandit avec l'attente).
//   Seules les parties classées font gagner ou perdre des points de classement.
// • Boss de la semaine : un boss commun à tout le serveur, avec une énorme réserve de PV. Chacun l'affronte
//   (3 essais par jour) ; les dégâts s'additionnent. Quand il tombe, tous les participants sont récompensés.
// • Défi amical : contre le membre de son choix, avec ou sans mise, sans points de classement.
const RQ_TIMEOUT = 10 * MINUTE, BOSS_TRIES = 3, BOSS_FIGHT_HP = 900;
const BOSS_AI = { name: "Boss", offset: 0, boost: 1, smart: 0.8 };
const BOSSES = [
  { key: "spectre", name: "Le Spectre du Manoir", title: "Il hante les couloirs depuis la fondation", emoji: "👻", color: "#a78bfa", atk: 72, attack: "Frisson glacial", special: "Hurlement d'outre-tombe", halloween: true },
  { key: "dragon", name: "Le Dragon de Notre-Dame", title: "Endormi sous la cathédrale depuis des siècles", emoji: "🐉", color: "#ef4444", atk: 78, attack: "Griffes de feu", special: "Souffle ardent" },
  { key: "automate", name: "L'Automate de la Bourse", title: "Il ne dort jamais, il calcule", emoji: "🤖", color: "#38bdf8", atk: 70, attack: "Krach éclair", special: "Liquidation totale" },
  { key: "rat", name: "Le Roi des Égouts", title: "Mille yeux le suivent dans le noir", emoji: "🐀", color: "#84cc16", atk: 68, attack: "Morsure de la meute", special: "Marée grouillante" },
  { key: "ogre", name: "L'Ogre du Casino", title: "Il a tout misé… et il veut votre part", emoji: "👹", color: "#f97316", atk: 75, attack: "Coup de massue", special: "Banco !" },
  { key: "seine", name: "La Chose de la Seine", title: "Elle remonte quand la ville dort", emoji: "🦑", color: "#2dd4bf", atk: 74, attack: "Tentacules", special: "Crue des abysses" },
];
Object.assign(FLUENT, { "🐉": "Dragon", "🤖": "Robot", "🐀": "Rat", "👹": "Ogre", "🦑": "Squid" });
const bossDef = (key) => BOSSES.find((b) => b.key === key) ?? BOSSES[0];
function weekBoss() {
  // en octobre, le Spectre du Manoir ; sinon une rotation chaque semaine
  if (Number(new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", month: "2-digit" }).format(new Date())) === 10) return bossDef("spectre");
  const others = BOSSES.filter((b) => !b.halloween);
  return others[hashOf(mondayKey()) % others.length];
}
function bossState(client = null) {
  const st = load();
  if (st.boss?.week !== mondayKey()) {
    // fin de semaine sans victoire : petite récompense pour les participants
    if (st.boss && !st.boss.defeated) {
      for (const id of Object.keys(st.boss.dmg ?? {})) st.dust[id] = (st.dust[id] ?? 0) + 100;
      bossTopBonus(st.boss); // la prime de points du top 3 est versée même sans victoire
    }
    const def = weekBoss(), active = Object.values(st.arena ?? {}).filter((x) => x.w + x.l + x.d > 0).length;
    const maxHp = Math.max(20000, 2500 * active);
    st.boss = { week: mondayKey(), key: def.key, maxHp, hp: maxHp, dmg: {}, tries: {}, defeated: false, lastHit: null };
    save();
    void client;
  }
  return st.boss;
}
const bossTriesLeft = (userId) => {
  const t = bossState().tries[userId];
  return BOSS_TRIES - (t?.day === dayKey() ? t.n : 0);
};
function bossCard(def) {
  return { ...C(`boss_${def.key}`, def.name, def.emoji, "mythique", def.title), boss: def };
}
function bossFighter(b) {
  const def = bossDef(b.boss), s = bossState(), hp = Math.max(1, Math.min(s.hp, BOSS_FIGHT_HP));
  return { key: `boss_${def.key}`, card: bossCard(def), name: def.name, series: "boss", astre: BOSS_ASTRE[def.key] ?? "ombre", maxHp: hp, hp, atk: def.atk, luck: 50, special: def.special, attackName: def.attack, attackDmg: Math.round(10 + def.atk * 0.55), specialDmg: Math.round(18 + def.atk * 1.1) };
}
{
  // le boss remplace l'équipe de l'IA
  const team = aiTeam, finish = finishBattle, creature = drawCreatureCard, kind = kindOf;
  aiTeam = (b) => (b.boss ? [bossFighter(b)] : team(b));
  kindOf = (card) => (card.boss ? "Boss de la semaine" : kind(card));
  SERIES_LABELS.boss = "👹 Boss";
  drawCreatureCard = (card, holo = false, t = 0.37) => (card.boss ? drawBossCard(card, t) : creature(card, holo, t));
  finishBattle = async (client, b, winner, reason) => {
    const already = b.phase === "over";
    await finish(client, b, winner, reason);
    if (!already && b.boss) await bossFightOver(client, b).catch((err) => console.error("Boss:", err.message));
  };
}
// le boss fait aussi monter le rang : ~1 point par tranche de 40 dégâts, 15 par combat et 60 par semaine au plus
const BOSS_RANK_FIGHT = 15, BOSS_RANK_WEEK = 60;
function bossRankGain(userId, dealt) {
  const st = load();
  st.bossRank ??= {};
  const w = st.bossRank[userId]?.week === mondayKey() ? st.bossRank[userId] : (st.bossRank[userId] = { week: mondayKey(), n: 0 });
  const gain = Math.max(0, Math.min(BOSS_RANK_FIGHT, Math.round(dealt / 40), BOSS_RANK_WEEK - w.n));
  const s = arenaStats(userId);
  s.elo += gain;
  s.bp = (s.bp ?? 0) + 1; // combats de boss (pour apparaître au classement)
  w.n += gain;
  return gain;
}
async function bossFightOver(client, b) {
  const s = bossState(), def = bossDef(b.boss), f = b.players[1].team[0], uid = b.players[0].id;
  if (!f || s.week !== b.bossWeek) return;
  const dealt = Math.max(0, Math.min(s.hp, f.maxHp - Math.max(0, f.hp)));
  s.hp -= dealt;
  s.dmg[uid] = (s.dmg[uid] ?? 0) + dealt;
  arenaBoardDirty = true;
  const dust = 10 + Math.floor(dealt / 8);
  load().dust[uid] = (load().dust[uid] ?? 0) + dust;
  ustat(uid, "bossDmg", dealt);
  const rank = bossRankGain(uid, dealt);
  save();
  const pct = Math.round((s.hp / s.maxHp) * 1000) / 10;
  const msg = await b.channel?.send({ content: `👹 **${b.players[0].name}** inflige **${dealt.toLocaleString("fr-FR")} dégâts** à ${def.name} (+${dust} ✨${rank ? `, +${rank} points de classement` : ""}). Il lui reste **${s.hp.toLocaleString("fr-FR")} PV** (${pct} %).`, allowedMentions: { parse: [] } }).catch(() => null);
  deleteLater(msg, MINUTE);
  if (s.hp <= 0 && !s.defeated) {
    s.defeated = true;
    s.lastHit = uid;
    await bossDefeated(client, s, def);
  }
}
// prime de points de classement pour le top 3 des dégâts (hors plafond hebdomadaire), versée une seule fois
const BOSS_TOP_RANK = [50, 30, 20];
function bossTopBonus(s) {
  if (s.topPaid) return [];
  s.topPaid = true;
  const top = Object.entries(s.dmg).sort((a, b) => b[1] - a[1]).slice(0, BOSS_TOP_RANK.length);
  for (const [i, [id]] of top.entries()) arenaStats(id).elo += BOSS_TOP_RANK[i];
  return top;
}
async function bossDefeated(client, s, def) {
  const ranking = Object.entries(s.dmg).sort((a, b) => b[1] - a[1]);
  bossTopBonus(s);
  for (const [i, [id]] of ranking.entries()) {
    addPacks(id, packKey(CURRENT_GEN, i < 3 ? "prestige" : "premium"), 1);
    load().dust[id] = (load().dust[id] ?? 0) + 200 + ([500, 300, 200][i] ?? 0) + (id === s.lastHit ? 300 : 0);
    ustat(id, "bossKills");
    client?.users
      .fetch(id)
      .then((u) => u.send(`👹 **${def.name} est vaincu !** Vous avez infligé **${s.dmg[id].toLocaleString("fr-FR")} dégâts** (${i + 1}ᵉ sur ${ranking.length}). Récompense : **1 booster ${i < 3 ? "Prestige" : "Premium"}** et **${200 + ([500, 300, 200][i] ?? 0) + (id === s.lastHit ? 300 : 0)} ✨**${id === s.lastHit ? " (dont 300 ✨ pour le coup de grâce)" : ""}${BOSS_TOP_RANK[i] ? `, et une prime de **+${BOSS_TOP_RANK[i]} points de classement** pour votre place sur le podium` : ""}.`))
      .catch(() => null);
  }
  save();
  await chan("annonces")
    ?.send({
      content: `👹 **${def.name} est vaincu !** ${ranking.length} combattant${ranking.length > 1 ? "s" : ""} l'ont terrassé ensemble.\n🥇 ${ranking.slice(0, 3).map(([id, d], i) => `${["🥇", "🥈", "🥉"][i]} **${pseudo(id)}** (${d.toLocaleString("fr-FR")} dégâts)`).join(" · ")} — prime de **+50 / +30 / +20 points de classement**\n💥 Coup de grâce : **${pseudo(s.lastHit)}**. Tous les participants reçoivent un booster et de la poussière d'étoile ; un nouveau boss arrive lundi.`,
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
}

// --- File des parties classées ---
const rankedQueue = new Map(); // userId -> { at, elo, name, user, interaction, notice }
let rqTimer = null;
const rqTolerance = (wait) => Math.min(600, 120 + Math.floor(wait / 15000) * 40);
function rqStart(client) {
  if (!rqTimer) rqTimer = setInterval(() => rqTick(client).catch((err) => console.error("File classée:", err.message)), 4000);
}
async function rqLeave(userId, text = null) {
  const e = rankedQueue.get(userId);
  if (!e) return;
  rankedQueue.delete(userId);
  arenaBoardDirty = true;
  e.notice?.delete().catch(() => null);
  if (text) await e.interaction?.editReply({ content: text, embeds: [], components: [], files: [], attachments: [] }).catch(() => null);
}
async function rqTick(client) {
  const now = Date.now();
  for (const [id, e] of rankedQueue) {
    if (userBattle.has(id)) await rqLeave(id, "⚔️ Vous êtes entré dans un autre combat : vous quittez la file classée.");
    else if (now - e.at > RQ_TIMEOUT) await rqLeave(id, "⌛ Personne de votre niveau n'était en ligne. Réessayez un peu plus tard (ou défiez un membre en amical) !");
  }
  const list = [...rankedQueue.entries()].sort((a, b) => a[1].at - b[1].at);
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [ia, a] = list[i], [ib, b] = list[j];
      if (!rankedQueue.has(ia) || !rankedQueue.has(ib)) continue;
      if (Math.abs(a.elo - b.elo) > Math.max(rqTolerance(now - a.at), rqTolerance(now - b.at))) continue;
      rankedQueue.delete(ia);
      rankedQueue.delete(ib);
      a.notice?.delete().catch(() => null);
      b.notice?.delete().catch(() => null);
      const battle = await startBattle(client, { user: a.user, name: a.name }, { user: b.user, name: b.name }, {});
      if (!battle) {
        for (const e of [a, b]) await e.interaction?.editReply({ content: "❌ Le combat n'a pas pu démarrer. Relancez la recherche.", embeds: [], components: [] }).catch(() => null);
        continue;
      }
      battle.ranked = true;
      for (const [me, foe] of [[a, b], [b, a]]) {
        const text = `✅ **Adversaire trouvé : ${foe.name}** (${tierOf(foe.elo)[1]} · ${foe.elo} pts) — partie classée : ${battle.message?.url ?? chan("arene")}`;
        await me.interaction?.editReply({ content: text, embeds: [], components: [], files: [], attachments: [] }).catch(() => null);
        me.user.send?.(text).catch(() => null);
      }
    }
  if (!rankedQueue.size && rqTimer) {
    clearInterval(rqTimer);
    rqTimer = null;
  }
}

// --- Images : le menu, la carte du boss ---
async function bossPortrait(def, size) {
  const img = FLUENT[def.emoji] ? await fetchImage(`fluent:${def.emoji}`, fluentUrl(FLUENT[def.emoji])).catch(() => null) : null;
  const c = createCanvas(size, size), x = c.getContext("2d");
  if (img) x.drawImage(img, 0, 0, size, size);
  else {
    x.font = `${Math.round(size * 0.8)}px CardTitle`;
    x.textAlign = "center";
    x.fillText(def.emoji, size / 2, size * 0.8);
  }
  return c;
}
async function drawBossCard(card, t = 0.37) {
  const def = card.boss, W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
  roundRect(ctx, 0, 0, W, H, 28);
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, "#1c0b0b");
  fg.addColorStop(0.5, shade(def.color, 0.5));
  fg.addColorStop(1, "#050208");
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.save();
  roundRect(ctx, 16, 16, W - 32, H - 32, 18);
  ctx.clip();
  const bg = ctx.createRadialGradient(W / 2, 330, 20, W / 2, 330, 520);
  bg.addColorStop(0, shade(def.color, 0.9));
  bg.addColorStop(0.45, shade(def.color, 0.35));
  bg.addColorStop(1, "#050208");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.translate(W / 2, 330);
  ctx.rotate(TAU * t * 0.1);
  for (let i = 0; i < 20; i++) {
    ctx.rotate(TAU / 20);
    ctx.fillStyle = `rgba(0,0,0,${i % 2 ? 0.18 : 0.08})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -700);
    ctx.lineTo(40, -700);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  glow(ctx, W / 2, 330, 260, def.color, 0.55);
  const p = await bossPortrait(def, 380);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 30;
  ctx.drawImage(p, W / 2 - 190, 140 + Math.sin(TAU * t) * 6, 380, 380);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fecaca";
  spaced(ctx, "BOSS DE LA SEMAINE", W / 2, 60, 4);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 10;
  ctx.font = `${fitText(ctx, def.name, 520, 40, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(def.name, W / 2, 110);
  ctx.restore();
  const gp = ctx.createLinearGradient(0, 560, 0, H);
  gp.addColorStop(0, "rgba(5,2,8,0)");
  gp.addColorStop(0.3, "rgba(5,2,8,0.85)");
  ctx.fillStyle = gp;
  ctx.fillRect(16, 560, W - 32, H - 576);
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(def.attack, W / 2, 650);
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#fca5a5";
  ctx.fillText(def.special, W / 2, 700);
  ctx.font = "16px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(def.title, W / 2, 760);
  return c;
}
async function drawArenaHub(userId) {
  const W = 1400, H = 760, s = userId ? arenaStats(userId) : { elo: 1000, w: 0, l: 0, d: 0, streak: 0 }, [, tier, tcol] = tierOf(s.elo), boss = bossState(), def = bossDef(boss.key);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a0a0d");
  bg.addColorStop(0.55, "#2a0f14");
  bg.addColorStop(1, "#070305");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, 300, 120, 500, "#e9c46a", 0.16);
  glow(ctx, 1050, 380, 520, def.color, 0.32);
  const R = seeded(hashOf(mondayKey()));
  for (let k = 0; k < 70; k++) disc(ctx, R() * W, R() * H, R() * 1.4 + 0.3, `rgba(253,230,138,${0.08 + R() * 0.3})`);
  // titre
  ctx.textAlign = "left";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#ecc979";
  spacedLeft(ctx, "LES CARTES DE LA MAISON", 48, 54, 4);
  ctx.font = "56px CardTitle";
  const tg = ctx.createLinearGradient(0, 70, 0, 120);
  tg.addColorStop(0, "#fff7d6");
  tg.addColorStop(1, "#e9c46a");
  ctx.fillStyle = tg;
  ctx.fillText("Arène de la Maison", 44, 116);
  const card = (x, y, w, h, title, col = "rgba(233,196,106,0.55)") => {
    roundRect(ctx, x, y, w, h, 20);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "rgba(40,16,22,0.92)");
    g.addColorStop(1, "rgba(12,5,8,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = "#ecc979";
    ctx.textAlign = "left";
    spacedLeft(ctx, title, x + 24, y + 36, 3);
  };
  // 1. mon rang (dans le salon : le défi de la semaine)
  if (!userId) {
    card(44, 150, 420, 300, "DÉFI DE LA SEMAINE");
    const [, label, desc] = weeklyRule();
    ctx.textAlign = "left";
    ctx.font = `${fitText(ctx, label.replace(/^\S+ /, ""), 370, 40, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label.replace(/^\S+ /, ""), 68, 248);
    ctx.font = "16px CardText";
    ctx.fillStyle = "#e7e5e4";
    wrapText(ctx, desc, 68, 288, 370, 22, 3);
    ctx.font = "16px CardBold";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${WEEKLY_GOAL} victoires dans la semaine :`, 68, 382);
    ctx.fillText("1 booster Premium + 150 poussières", 68, 408);
  }
  if (userId) {
  card(44, 150, 420, 300, "MON RANG CLASSÉ");
  const sx = 140, sy = 300;
  ctx.save();
  ctx.shadowColor = rgba(tcol, 0.8);
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.moveTo(sx, sy - 80);
  ctx.lineTo(sx + 66, sy - 56);
  ctx.lineTo(sx + 60, sy + 20);
  ctx.quadraticCurveTo(sx + 40, sy + 66, sx, sy + 86);
  ctx.quadraticCurveTo(sx - 40, sy + 66, sx - 60, sy + 20);
  ctx.lineTo(sx - 66, sy - 56);
  ctx.closePath();
  const sg = ctx.createLinearGradient(sx, sy - 80, sx, sy + 86);
  sg.addColorStop(0, shade(tcol, 1.3));
  sg.addColorStop(1, shade(tcol, 0.5));
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.restore();
  star5(ctx, sx, sy - 6, 30, "rgba(255,255,255,0.9)");
  ctx.textAlign = "center";
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "#1c1917";
  ctx.fillText(tier.toUpperCase(), sx, sy + 46);
  ctx.textAlign = "left";
  ctx.font = "52px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(s.elo), 236, 290);
  ctx.font = "15px CardBold";
  ctx.fillStyle = tcol;
  ctx.fillText("points de classement", 238, 316);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#e7e5e4";
  ctx.fillText(`${s.w} victoire${s.w > 1 ? "s" : ""} · ${s.l} défaite${s.l > 1 ? "s" : ""}`, 238, 352);
  if (s.streak >= 2) {
    ctx.fillStyle = "#fb923c";
    ctx.fillText(`Série de ${s.streak} victoires`, 238, 380);
  }
  const next = ARENA_TIERS.slice().reverse().find(([min]) => min > s.elo);
  ctx.font = "13px CardText";
  ctx.fillStyle = "#a8a29e";
  ctx.fillText(next ? `${next[0] - s.elo} points avant ${next[1]}` : "Rang maximum atteint", 238, 412);
  }
  // 2. le boss de la semaine
  card(500, 150, 856, 300, "BOSS DE LA SEMAINE", rgba(def.color, 0.8));
  glow(ctx, 640, 300, 160, def.color, 0.5);
  ctx.drawImage(await bossPortrait(def, 210), 535, 190, 210, 210);
  ctx.textAlign = "left";
  ctx.font = `${fitText(ctx, def.name, 560, 38, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(def.name, 770, 230);
  ctx.font = "17px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText(def.title, 772, 260);
  const frac = boss.hp / boss.maxHp;
  roundRect(ctx, 772, 284, 550, 26, 13);
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fill();
  roundRect(ctx, 774, 286, Math.max(boss.hp > 0 ? 14 : 0, 546 * frac), 22, 11);
  const hg = ctx.createLinearGradient(774, 0, 1320, 0);
  hg.addColorStop(0, "#7f1d1d");
  hg.addColorStop(1, "#ef4444");
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = "14px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(boss.defeated ? "VAINCU" : `${boss.hp.toLocaleString("fr-FR")} / ${boss.maxHp.toLocaleString("fr-FR")} PV`, 1047, 303);
  ctx.textAlign = "left";
  const mine = boss.dmg[userId] ?? 0, fighters = Object.keys(boss.dmg).length;
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(userId ? `Vos dégâts : ${mine.toLocaleString("fr-FR")}` : `${Math.round((boss.hp / boss.maxHp) * 100)} % de PV restants`, 772, 344);
  ctx.fillStyle = "#e7e5e4";
  ctx.fillText(userId ? `Essais aujourd'hui : ${Math.max(0, bossTriesLeft(userId))} / ${BOSS_TRIES}` : `${BOSS_TRIES} essais par jour et par joueur`, 1010, 344);
  ctx.font = "14px CardText";
  ctx.fillStyle = "#a8a29e";
  ctx.fillText(`${fighters} combattant${fighters > 1 ? "s" : ""} cette semaine · tous gagnent un booster quand il tombe`, 772, 376);
  const top = Object.entries(boss.dmg).sort((a, b) => b[1] - a[1]).slice(0, 3);
  ctx.fillText(top.length ? `Meilleurs : ${top.map(([id, d], i) => `${i + 1}. ${pseudo(id)} (${d.toLocaleString("fr-FR")})`).join("   ")}` : "Personne ne l'a encore affronté…", 772, 404);
  // 3. file classée et classement
  card(44, 480, 420, 236, "PARTIES CLASSÉES EN LIGNE");
  const inQ = rankedQueue.has(userId);
  ctx.font = "44px CardTitle";
  ctx.fillStyle = inQ ? "#4ade80" : "#ffffff";
  ctx.fillText(String(rankedQueue.size), 68, 580);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#e7e5e4";
  ctx.fillText(`joueur${rankedQueue.size > 1 ? "s" : ""} dans la file`, 68 + ctx.measureText(String(rankedQueue.size)).width + 70, 572);
  ctx.font = "14px CardText";
  ctx.fillStyle = "#a8a29e";
  ctx.fillText(inQ ? "Vous êtes dans la file : on vous cherche un adversaire…" : "Lancez une recherche : le bot vous trouve", 68, 622);
  if (!inQ) ctx.fillText("un adversaire de votre niveau.", 68, 644);
  ctx.fillText("Seules les parties classées comptent pour le rang.", 68, 684);
  card(500, 480, 856, 236, "CLASSEMENT DE LA SAISON");
  const board = Object.entries(load().arena)
    .filter(([, x]) => x.w + x.l + x.d > 0 || (x.bp ?? 0) > 0)
    .sort((a, b) => b[1].elo - a[1].elo)
    .slice(0, 5);
  if (!board.length) {
    ctx.font = "17px CardItalic";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Aucune partie classée pour le moment.", 524, 560);
  }
  board.forEach(([id, x], i) => {
    const y = 548 + i * 34, [, t2, c2] = tierOf(x.elo);
    ctx.font = "20px CardTitle";
    ctx.fillStyle = ["#fbbf24", "#e5e7eb", "#d97706"][i] ?? "#a8a29e";
    ctx.fillText(String(i + 1), 528, y);
    ctx.font = `${fitText(ctx, pseudo(id), 360, 18, "CardBold")}px CardBold`;
    ctx.fillStyle = id === userId ? "#fde68a" : "#ffffff";
    ctx.fillText(pseudo(id), 562, y);
    ctx.font = "15px CardBold";
    ctx.fillStyle = c2;
    ctx.fillText(t2, 960, y);
    ctx.textAlign = "right";
    ctx.font = "18px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${x.elo} pts`, 1180, y);
    ctx.font = "13px CardText";
    ctx.fillStyle = "#a8a29e";
    ctx.fillText(`${x.w} V · ${x.l} D`, 1330, y);
    ctx.textAlign = "left";
  });
  return c;
}
async function arenaHubPayload(userId, note = "") {
  const boss = bossState(), def = bossDef(boss.key), inQ = rankedQueue.has(userId), w = load().arenaWeekly[userId];
  const weekly = w?.week === mondayKey() ? w : { wins: 0, done: false };
  const file = new AttachmentBuilder(await (await drawArenaHub(userId)).encode("jpeg", 88), { name: "arene.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("⚔️ Arène de la Maison")
        .setDescription(
          (note ? `${note}\n\n` : "") +
            "🏆 **Partie classée** : le bot vous trouve un adversaire en ligne de votre niveau. C'est la seule qui fait monter (ou descendre) votre rang.\n" +
            `👹 **Boss de la semaine** : ${def.name}, ${boss.defeated ? "**vaincu** ! Un nouveau arrive lundi." : `${Math.round((boss.hp / boss.maxHp) * 100)} % de PV restants — ${BOSS_TRIES} essais par jour, les dégâts de tout le serveur s'additionnent.`} Il fait aussi **monter votre rang** (jusqu'à ${BOSS_RANK_FIGHT} points par combat, ${BOSS_RANK_WEEK} par semaine), et le **top 3 des dégâts** gagne une prime de +50 / +30 / +20 points.\n` +
            "🤝 **Défi amical** : contre le membre de votre choix, avec une mise si vous voulez (`/combat`).\n" +
            `🎯 **Défi de la semaine** : ${weeklyRule()[1]} — ${weekly.done ? "réussi ✅" : `${Math.min(weekly.wins, WEEKLY_GOAL)} / ${WEEKLY_GOAL} victoires`}`
        )
        .setImage("attachment://arene.jpg"),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        inQ ? new ButtonBuilder().setCustomId("carte_rk_leave").setLabel("Quitter la file").setEmoji("✖️").setStyle(ButtonStyle.Secondary) : new ButtonBuilder().setCustomId("carte_rk_join").setLabel("Partie classée").setEmoji("🏆").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_boss_go").setLabel(boss.defeated ? "Boss vaincu" : `Affronter le boss (${Math.max(0, bossTriesLeft(userId))})`).setEmoji("👹").setStyle(ButtonStyle.Danger).setDisabled(boss.defeated || bossTriesLeft(userId) <= 0),
        new ButtonBuilder().setCustomId("carte_bt_ai").setLabel("Entraînement").setEmoji("🤖").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_bt_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("carte_bt_pick").setPlaceholder("🤝 Défi amical : choisir un membre…")),
    ],
  };
}

// --- Interactions ---
async function handleArenaHubInteraction(interaction, client) {
  const cmd = interaction.isChatInputCommand?.() && (interaction.commandName === "arene" || (interaction.commandName === "combat" && !interaction.options.getUser("membre")));
  const id = interaction.customId;
  if (!cmd && !["carte_bt", "carte_rk_join", "carte_rk_leave", "carte_boss_go"].includes(id)) return false;
  const userId = interaction.user.id, name = interaction.member?.displayName ?? interaction.user.username;
  const say = async (content) => (await interaction.reply({ content, ephemeral: true }), true);
  const fromPublic = cmd || interaction.message?.flags?.has?.(64) === false;
  const show = async (payload) => {
    if (fromPublic) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    await interaction.editReply(await payload);
  };
  if (cmd || id === "carte_bt") {
    await show(arenaHubPayload(userId));
    return true;
  }
  if (id === "carte_rk_leave") {
    await rqLeave(userId);
    await show(arenaHubPayload(userId, "Vous avez quitté la file."));
    return true;
  }
  if (id === "carte_rk_join") {
    if (userBattle.has(userId)) return say("❌ Vous êtes déjà en combat.");
    if (bestTeam(userId).length < 3) return say("❌ Il faut au moins **3 cartes** pour les parties classées.");
    if (rankedQueue.has(userId)) return say("🔎 Vous êtes déjà dans la file : on vous cherche un adversaire.");
    if (fromPublic) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    const elo = arenaStats(userId).elo;
    const entry = { at: Date.now(), elo, name, user: interaction.user, interaction };
    rankedQueue.set(userId, entry);
    arenaBoardDirty = true;
    await interaction.editReply({
      content: `🔎 **Recherche d'un adversaire classé…** (${tierOf(elo)[1]} · ${elo} pts)\nVous serez prévenu ici et en message privé dès qu'un adversaire de votre niveau est trouvé (10 minutes au plus).`,
      embeds: [],
      files: [],
      attachments: [],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_rk_leave").setLabel("Annuler la recherche").setEmoji("✖️").setStyle(ButtonStyle.Secondary))],
    });
    // avis dans l'arène : d'autres joueurs peuvent rejoindre la file
    entry.notice = await chan("arene")
      ?.send({ content: `🔎 **${name}** (${tierOf(elo)[1]} · ${elo} pts) cherche un adversaire en **partie classée** !`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_rk_join").setLabel("Rejoindre la file").setEmoji("🏆").setStyle(ButtonStyle.Success))], allowedMentions: { parse: [] } })
      .catch(() => null);
    rqStart(client);
    await rqTick(client);
    return true;
  }
  if (id === "carte_boss_go") {
    const boss = bossState(client), def = bossDef(boss.key);
    if (boss.defeated) return say(`👹 ${def.name} est déjà vaincu ! Un nouveau boss arrive lundi.`);
    if (bossTriesLeft(userId) <= 0) return say(`⏳ Vous avez utilisé vos ${BOSS_TRIES} essais du jour. Revenez demain !`);
    if (userBattle.has(userId)) return say("❌ Vous êtes déjà en combat.");
    if (!ownedKeys(userId).length) return say("❌ Il vous faut au moins une carte pour combattre.");
    await interaction.deferReply({ ephemeral: true });
    await rqLeave(userId);
    const t = boss.tries[userId]?.day === dayKey() ? boss.tries[userId] : (boss.tries[userId] = { day: dayKey(), n: 0 });
    t.n++;
    save();
    const b = await startBattle(client, { user: interaction.user, name }, { user: client.user, name: def.name, isAI: true }, { boss: def.key, aiLevel: BOSS_AI, aiLabel: "Boss de la semaine" });
    if (b) b.bossWeek = boss.week;
    else t.n--;
    await interaction.editReply({ content: b ? `👹 **${def.name}** vous attend : ${b.message.url}\nChaque point de dégâts compte, même si vous perdez !` : "❌ Impossible de lancer le combat." });
    return true;
  }
  return false;
}
{
  // succès de l'arène
  const facts = playerFacts;
  playerFacts = (userId) => ({ ...facts(userId), bossKills: load().userStats[userId]?.bossKills ?? 0 });
  ACHIEVEMENTS.push(["boss1", "👹", "Tueur de boss", "Participer à la victoire contre un boss de la semaine", "bossKills", 1, 200]);
}

// --- Combat de boss joué automatiquement (même moteur que l'Arène, sans salon) ---
// Le joueur aligne ses 3 meilleures cartes : spécial dès qu'il a l'énergie, sinon attaque (et parfois garde).
// Renvoie les dégâts infligés au boss ; rien n'est enregistré ici.
function bossAutoFight(userId) {
  const s = bossState(), def = bossDef(s.key), keys = bestTeam(userId);
  if (!keys.length || s.defeated) return null;
  const side = (id, name, isAI) => ({ id, name, avatar: null, isAI, team: [], active: 0, energy: ruleIs("surcharge") ? 3 : 1, choice: null, ready: true, afk: 0 });
  const b = { id: "auto", ai: null, boss: def.key, aiLevel: BOSS_AI, players: [side(userId, pseudo(userId), false), side(`boss:${def.key}`, def.name, true)], round: 0, phase: "choose", history: [[], []], bets: [], lastLines: [] };
  b.players[0].team = keys.map(fighter);
  b.players[1].team = [bossFighter(b)];
  applyUtility(b.players[0], bossItemOf(userId), true);
  for (let r = 0; r < 30; r++) {
    b.round++;
    const me = b.players[0];
    me.choice = me.energy >= SPECIAL_COST ? { type: "special" } : { type: Math.random() < 0.8 ? "attack" : "guard" };
    b.players[1].choice = aiChoice(b);
    const res = resolveRoundState(b);
    res.acts.forEach((a, i) => b.history[i].push(a.type));
    if (!b.players.every((p) => p.team.some((f) => f.hp > 0))) break;
  }
  const f = b.players[1].team[0];
  // comme un vrai combat : chaque manche jouée compte (quêtes et XP de pass), et la victoire aussi
  questProgress(userId, "play_round", b.round);
  if (f.hp <= 0) questProgress(userId, "win_fight");
  return Math.max(0, Math.min(s.hp, f.maxHp - Math.max(0, f.hp)));
}

// --- Le menu, affiché en permanence dans le salon de l'Arène ---
let arenaBoardDirty = true;
async function arenaBoardPayload() {
  const boss = bossState(), def = bossDef(boss.key);
  const file = new AttachmentBuilder(await (await drawArenaHub(null)).encode("jpeg", 86), { name: "arene.jpg" });
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("⚔️ Arène de la Maison")
        .setDescription(
          "🏆 **Partie classée** : le bot vous trouve un adversaire en ligne de votre niveau. C'est la seule qui fait monter (ou descendre) votre rang.\n" +
            `👹 **Boss de la semaine** : ${def.name}, ${boss.defeated ? "**vaincu** ! Un nouveau arrive lundi." : `${Math.round((boss.hp / boss.maxHp) * 100)} % de PV restants — ${BOSS_TRIES} essais par jour, les dégâts de tous s'additionnent.`} Il fait aussi **monter votre rang** (jusqu'à ${BOSS_RANK_FIGHT} points par combat, ${BOSS_RANK_WEEK} par semaine), et le **top 3 des dégâts** gagne une prime de +50 / +30 / +20 points.\n` +
            "🤝 **Défi amical** et 🎒 **objets** : dans **Mon menu** (votre rang, vos essais, vos objets).\n" +
            "🤖 **Entraînement** contre la Maison, qui progresse avec vous."
        )
        .setImage("attachment://arene.jpg"),
    ],
    files: [file],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_rk_join").setLabel("Partie classée").setEmoji("🏆").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_boss_go").setLabel(boss.defeated ? "Boss vaincu" : "Affronter le boss").setEmoji("👹").setStyle(ButtonStyle.Danger).setDisabled(boss.defeated),
        new ButtonBuilder().setCustomId("carte_bt_ai").setLabel("Entraînement").setEmoji("🤖").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_bt").setLabel("Mon menu").setEmoji("⚔️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_bt_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
async function refreshArenaBoard() {
  const ch = chan("arene");
  if (!ch || ch === channelRef) return;
  arenaBoardDirty = false;
  const st = load(), payload = await arenaBoardPayload();
  let msg = st.arenaBoardId ? await ch.messages.fetch(st.arenaBoardId).catch(() => null) : null;
  if (msg && !(await msg.edit({ ...payload, attachments: [] }).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.arenaBoardId = msg.id;
      save();
    }
  }
}
async function arenaBoardLoop() {
  const min = new Date().getMinutes();
  if ((arenaBoardDirty && min % 2 === 0) || min % 15 === 9) await refreshArenaBoard().catch(() => null);
}
