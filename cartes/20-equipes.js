
// --- Équipes : des duos de joueurs (2 membres au maximum) ---
// Une équipe a un nom, un emblème, un niveau (gagné par l'activité des deux membres), un coffre commun,
// une boutique, un objectif chaque semaine, des cadeaux entre coéquipiers et un bonus sur l'île.
const TEAM_MAX = 2;
const TEAM_INVITE_MINUTES = 10;
const TEAM_GIFTS_PER_DAY = 5;
const TEAM_ISLAND_SHARE = 0.5; // le coéquipier du gardien de l'île touche la moitié de ses gains
// XP d'équipe gagnée à chaque action d'un membre
const TEAM_XP = { packs: 5, wins: 15, trades: 5, wild: 10, quests: 10, islands: 30, sales: 5 };
const TEAM_RANKS = ["Recrues", "Apprentis", "Complices", "Aguerris", "Vétérans", "Élite", "Champions", "Maîtres", "Héros", "Légendes"];
const TEAM_MAX_LEVEL = TEAM_RANKS.length;
const teamXpFor = (level) => (150 * (level - 1) * level) / 2; // XP totale pour atteindre ce niveau
const TEAM_EMBLEMS = [
  ["🐉", "Dragon", "#ef4444"],
  ["🦁", "Lion", "#f59e0b"],
  ["🐺", "Wolf", "#94a3b8"],
  ["🦅", "Eagle", "#a16207"],
  ["🦊", "Fox", "#f97316"],
  ["🐙", "Octopus", "#ec4899"],
  ["🔥", "Fire", "#f43f5e"],
  ["⚡", "High voltage", "#facc15"],
  ["🌙", "Crescent moon", "#818cf8"],
  ["💎", "Gem stone", "#22d3ee"],
  ["👑", "Crown", "#fbbf24"],
  ["🛡️", "Shield", "#60a5fa"],
];
const emblemOf = (team) => TEAM_EMBLEMS.find(([e]) => e === team.emblem) ?? TEAM_EMBLEMS[11];
// objectifs de la semaine (cumul des deux membres)
const TEAM_GOALS = [
  ["wins", 8, "Gagner {n} combats", "⚔️"],
  ["packs", 12, "Ouvrir {n} boosters", "📦"],
  ["quests", 10, "Accomplir {n} quêtes", "🎯"],
  ["wild", 3, "Attraper {n} cartes sauvages", "✋"],
  ["islands", 2, "Prendre l'île {n} fois", "🏝️"],
  ["trades", 3, "Conclure {n} échanges", "🔄"],
];
const TEAM_SHOP = [
  ["booster", "Booster d'équipe", "📦", "1 booster Premium pour chaque membre", 500],
  ["xp", "Entraînement", "🏋️", "+150 XP d'équipe", 400],
  ["rename", "Nouveau nom", "✏️", "Renommer l'équipe", 300],
];
const teamInvites = new Map(); // id -> invitation en attente
let teamsDirty = true;

function teamsState() {
  const st = load();
  st.teams ??= {};
  st.teamGifts ??= {};
  return st.teams;
}
const teamOf = (userId) => Object.values(teamsState()).find((t) => t.members.includes(userId)) ?? null;
const partnerOf = (userId) => teamOf(userId)?.members.find((m) => m !== userId) ?? null;
function teamLevel(team) {
  let level = 1;
  while (level < TEAM_MAX_LEVEL && team.xp >= teamXpFor(level + 1)) level++;
  return level;
}
function teamWeekly(team) {
  const week = mondayKey();
  if (team.weekly?.week !== week) {
    const [key, goal] = TEAM_GOALS[hashOf(`${week}:${team.id}`) % TEAM_GOALS.length];
    team.weekly = { week, key, goal, progress: 0, done: false };
  }
  return team.weekly;
}
const goalOf = (w) => TEAM_GOALS.find(([k]) => k === w.key);
const goalText = (w) => goalOf(w)[2].replace("{n}", w.goal);
const cleanTeamName = (text) => String(text ?? "").replace(/[@<>#`*_~|\\]/g, "").replace(/\s+/g, " ").trim().slice(0, 24);

async function teamNotice(text, users = []) {
  const msg = await chan("equipes")
    ?.send({ content: text, allowedMentions: { users } })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}
// XP gagnée par un membre : niveau, récompenses de niveau, objectif de la semaine
function addTeamXp(team, xp, userId = null) {
  if (!xp) return;
  const before = teamLevel(team);
  team.xp += xp;
  if (userId) team.contrib[userId] = (team.contrib[userId] ?? 0) + xp;
  const after = teamLevel(team);
  teamsDirty = true;
  for (let level = before + 1; level <= after; level++) {
    const rewards = [`${50 * level} ✨ chacun`];
    for (const m of team.members) load().dust[m] = (load().dust[m] ?? 0) + 50 * level;
    const pack = level === TEAM_MAX_LEVEL ? "prestige" : level % 3 === 0 ? "premium" : null;
    if (pack) {
      for (const m of team.members) addPacks(m, packKey(CURRENT_GEN, pack), 1);
      rewards.push(`1 booster ${pack === "prestige" ? "Prestige" : "Premium"} chacun`);
    }
    teamNotice(`${team.emblem} L'équipe **${team.name}** passe au **niveau ${level} — ${TEAM_RANKS[level - 1]}** ! Récompense : ${rewards.join(" et ")}.`, team.members).catch(() => null);
  }
}
function teamActivity(userId, key, n) {
  const team = teamOf(userId);
  if (!team || !TEAM_XP[key]) return;
  team.stats[key] = (team.stats[key] ?? 0) + n;
  addTeamXp(team, TEAM_XP[key] * n, userId);
  const w = teamWeekly(team);
  if (w.done || w.key !== key) return;
  w.progress += n;
  if (w.progress < w.goal) return;
  w.done = true;
  for (const m of team.members) {
    addPacks(m, packKey(CURRENT_GEN, "premium"), 1);
    load().dust[m] = (load().dust[m] ?? 0) + 100;
  }
  team.vault += 100;
  addTeamXp(team, 150);
  teamNotice(`${team.emblem} L'équipe **${team.name}** réussit son objectif de la semaine (${goalText(w)}) : **1 booster Premium** et **100 ✨** pour chacun, +100 ✨ dans le coffre !`, team.members).catch(() => null);
}
{
  const stat = ustat;
  ustat = (userId, key, n = 1) => {
    stat(userId, key, n);
    if (userId) teamActivity(userId, key, n);
  };
  // l'île rapporte aussi au coéquipier du gardien
  const pay = payIsland;
  payIsland = (isl) => {
    const holder = isl.holder, gain = pay(isl);
    const team = gain && holder ? teamOf(holder) : null;
    if (team) {
      const partner = team.members.find((m) => m !== holder);
      if (partner) load().dust[partner] = (load().dust[partner] ?? 0) + Math.round(gain * TEAM_ISLAND_SHARE);
      addTeamXp(team, Math.round(gain / ISLAND_DUST) * 2, holder);
    }
    return gain;
  };
  // on n'attaque pas l'île de son coéquipier
  const island = handleIslandInteraction;
  handleIslandInteraction = async (interaction, client) => {
    const go = /^carte_ile_go_(\w+)$/.exec(interaction.customId ?? "");
    const holder = go ? islandsState()[go[1]]?.holder : null;
    if (holder && holder !== interaction.user.id && partnerOf(interaction.user.id) === holder) {
      await interaction.reply({ content: `🛡️ L'île est gardée par votre coéquipier : vous touchez déjà **${Math.round(TEAM_ISLAND_SHARE * 100)} %** de ses gains !`, ephemeral: true });
      return true;
    }
    return island(interaction, client);
  };
  // succès d'équipe
  const facts = playerFacts;
  playerFacts = (userId) => {
    const team = teamOf(userId);
    return { ...facts(userId), team: team ? 1 : 0, teamLevel: team ? teamLevel(team) : 0 };
  };
  ACHIEVEMENTS.push(["team1", "🛡️", "Duo de choc", "Former une équipe à deux", "team", 1, 50], ["team5", "🏰", "Équipe soudée", "Atteindre le niveau 5 en équipe", "teamLevel", 5, 300]);
}
function teamSummaryLine(userId) {
  const team = teamOf(userId);
  return team ? `${team.emblem} Équipe ${team.name} · niveau ${teamLevel(team)}` : null;
}

// --- Blason de l'équipe ---
async function emblemImage(emoji) {
  const def = TEAM_EMBLEMS.find(([e]) => e === emoji);
  return (def ? await fetchImage(`fluent:${emoji}`, fluentUrl(def[1])) : null) ?? (await artImage({ emoji }));
}
function teamBar(ctx, x, y, w, h, pct, color) {
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.09)";
  ctx.fill();
  if (pct > 0) {
    roundRect(ctx, x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, rgba(color, 0.7));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
  }
}
async function drawTeamCard(team) {
  const W = 1200, H = 660, [, , color] = emblemOf(team), level = teamLevel(team);
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createRadialGradient(300, 260, 40, W / 2, H / 2, W * 0.8);
  bg.addColorStop(0, rgba(color, 0.35));
  bg.addColorStop(0.45, "#0f0a1e");
  bg.addColorStop(1, "#05030b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  guilloche(ctx, 0, 0, W, H, color);
  // rayons derrière l'emblème
  ctx.save();
  ctx.translate(250, 250);
  for (let i = 0; i < 36; i++) {
    ctx.rotate(TAU / 36);
    ctx.fillStyle = rgba(color, i % 2 ? 0.02 : 0.06);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-30, -520);
    ctx.lineTo(30, -520);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire);
  roundRect(ctx, 8, 8, W - 16, H - 16, 22);
  ctx.stroke();
  // blason
  glow(ctx, 250, 240, 230, color, 0.3);
  ctx.drawImage(await drawTeamCrest(team.emblem), 250 - 190, 240 - 186, 380, 380);
  // ruban du niveau
  ctx.save();
  ctx.translate(250, 412);
  roundRect(ctx, -120, -26, 240, 52, 26);
  ctx.fillStyle = metalGradient(ctx, 240, 52, METAL.legendaire);
  ctx.fill();
  ctx.font = "26px CardEngrave";
  ctx.fillStyle = "#2a1600";
  ctx.textAlign = "center";
  ctx.fillText(`NIVEAU ${level}`, 0, 9);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "22px CardItalic";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(TEAM_RANKS[level - 1], 250, 470);
  // XP
  const cur = teamXpFor(level), next = teamXpFor(Math.min(TEAM_MAX_LEVEL, level + 1));
  const pct = level >= TEAM_MAX_LEVEL ? 1 : (team.xp - cur) / (next - cur);
  teamBar(ctx, 110, 498, 280, 16, pct, color);
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(level >= TEAM_MAX_LEVEL ? `${team.xp} XP · niveau maximum` : `${team.xp - cur} / ${next - cur} XP`, 250, 538);
  // nom
  ctx.textAlign = "left";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = rgba(color, 0.95);
  spacedLeft(ctx, "ÉQUIPE", 460, 82, 5);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  ctx.font = `${fitText(ctx, team.name, 680, 60, "CardTitle")}px CardTitle`;
  ctx.fillText(team.name, 458, 142);
  ctx.shadowBlur = 0;
  ctx.font = "17px CardItalic";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`Fondée le ${new Date(team.createdAt).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", year: "numeric" })}`, 460, 172);
  // membres
  for (let i = 0; i < TEAM_MAX; i++) {
    const uid = team.members[i], x = 460 + i * 350, y = 200, w = 330, h = 120;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fillStyle = uid ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)";
    ctx.fill();
    ctx.strokeStyle = uid ? rgba(color, 0.55) : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    if (!uid) ctx.setLineDash([7, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    if (!uid) {
      ctx.font = "20px CardItalic";
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.fillText("Place libre", x + w / 2, y + 54);
      ctx.font = "15px CardText";
      ctx.fillText("invitez un partenaire", x + w / 2, y + 80);
      ctx.textAlign = "left";
      continue;
    }
    const info = team.profiles?.[uid] ?? {};
    const av = info.avatar ? await fetchImage(`avatar:${info.avatar}`, info.avatar) : null;
    disc(ctx, x + 58, y + 60, 40, color);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 58, y + 60, 36, 0, TAU);
    ctx.clip();
    if (av) ctx.drawImage(av, x + 22, y + 24, 72, 72);
    else disc(ctx, x + 58, y + 60, 36, "#1e293b");
    ctx.restore();
    if (uid === team.owner) {
      disc(ctx, x + 88, y + 28, 13, "#fbbf24");
      ctx.font = "13px CardBold";
      ctx.fillStyle = "#2a1600";
      ctx.textAlign = "center";
      ctx.fillText("C", x + 88, y + 33);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#ffffff";
    ctx.font = `${fitText(ctx, info.name ?? "?", w - 130, 24, "CardBold")}px CardBold`;
    ctx.fillText(info.name ?? "?", x + 112, y + 52);
    ctx.font = "15px CardText";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${team.contrib[uid] ?? 0} XP apportés`, x + 112, y + 78);
    ctx.fillText(uid === team.owner ? "Capitaine" : "Équipier", x + 112, y + 100);
  }
  // statistiques
  const chips = [
    ["COFFRE", `${team.vault}`, "poussières"],
    ["VICTOIRES", `${team.stats.wins ?? 0}`, "en combat"],
    ["BOOSTERS", `${team.stats.packs ?? 0}`, "ouverts"],
    ["ÎLE", `${team.stats.islands ?? 0}`, "conquêtes"],
  ];
  for (const [k, [label, value, sub]] of chips.entries()) {
    const x = 460 + k * 175, y = 344, w = 160, h = 104;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = rgba(color, 0.95);
    ctx.fillText(label, x + w / 2, y + 26);
    ctx.font = "36px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x + w / 2, y + 68);
    ctx.font = "13px CardText";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(sub, x + w / 2, y + 90);
    ctx.textAlign = "left";
  }
  // objectif de la semaine
  const wk = teamWeekly(team);
  const ox = 460, oy = 470, ow = 690, oh = 130;
  roundRect(ctx, ox, oy, ow, oh, 16);
  const og = ctx.createLinearGradient(ox, oy, ox + ow, oy);
  og.addColorStop(0, rgba(color, 0.18));
  og.addColorStop(1, "rgba(255,255,255,0.03)");
  ctx.fillStyle = og;
  ctx.fill();
  ctx.strokeStyle = rgba(color, wk.done ? 0.9 : 0.45);
  ctx.stroke();
  ctx.font = "14px CardEngrave";
  ctx.fillStyle = rgba(color, 0.95);
  spacedLeft(ctx, "OBJECTIF DE LA SEMAINE", ox + 24, oy + 32, 3);
  ctx.font = "26px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(goalText(wk), ox + 24, oy + 68);
  teamBar(ctx, ox + 24, oy + 84, ow - 200, 16, wk.progress / wk.goal, wk.done ? "#4ade80" : color);
  ctx.font = "18px CardBold";
  ctx.fillStyle = wk.done ? "#4ade80" : "#e2e8f0";
  ctx.textAlign = "right";
  ctx.fillText(wk.done ? "RÉUSSI" : `${Math.min(wk.progress, wk.goal)} / ${wk.goal}`, ox + ow - 24, oy + 99);
  ctx.textAlign = "left";
  ctx.font = "14px CardItalic";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Récompense : 1 booster Premium et 100 poussières chacun, +100 dans le coffre", ox + 24, oy + 122);
  return c;
}
function spacedLeft(ctx, text, x, y, spacing) {
  const width = Array.from(text).reduce((w, ch) => w + ctx.measureText(ch).width, 0) + spacing * (Array.from(text).length - 1);
  spaced(ctx, text, x + width / 2, y, spacing);
}
// --- Classement des équipes (image du salon) ---
async function drawTeamsBoard() {
  const teams = Object.values(teamsState()).sort((a, b) => b.xp - a.xp).slice(0, 8);
  const W = 1200, rowH = 74, H = 150 + Math.max(1, teams.length) * rowH + 24;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(1, "#05030b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  guilloche(ctx, 0, 0, W, H, "#818cf8");
  glow(ctx, W / 2, 0, 420, "#818cf8", 0.25);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire);
  roundRect(ctx, 8, 8, W - 16, H - 16, 20);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "34px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  spaced(ctx, "LES ÉQUIPES DE LA MAISON", W / 2, 66, 5);
  ctx.shadowBlur = 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#c7d2fe";
  ctx.fillText("Des duos de joueurs : niveau, coffre commun, objectif de la semaine et bonus sur l'île", W / 2, 102);
  if (!teams.length) {
    ctx.font = "24px CardItalic";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("Aucune équipe pour le moment : créez la première !", W / 2, 190);
  }
  for (const [i, team] of teams.entries()) {
    const y = 140 + i * rowH, [, , color] = emblemOf(team), level = teamLevel(team);
    roundRect(ctx, 40, y, W - 80, rowH - 12, 14);
    ctx.fillStyle = i === 0 ? rgba(color, 0.2) : "rgba(255,255,255,0.05)";
    ctx.fill();
    ctx.strokeStyle = rgba(color, i < 3 ? 0.6 : 0.25);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "26px CardTitle";
    ctx.fillStyle = ["#fbbf24", "#e2e8f0", "#d97706"][i] ?? "#94a3b8";
    ctx.fillText(String(i + 1), 82, y + 42);
    ctx.drawImage(await drawTeamCrest(team.emblem), 106, y - 6, 72, 72);
    ctx.textAlign = "left";
    ctx.font = `${fitText(ctx, team.name, 380, 28, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(team.name, 184, y + 34);
    ctx.font = "15px CardText";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(team.members.map((m) => team.profiles?.[m]?.name ?? "?").join(" & ") + (team.members.length < TEAM_MAX ? " · place libre" : ""), 184, y + 54);
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = color;
    ctx.fillText(`NIVEAU ${level}`, 640, y + 30);
    ctx.font = "15px CardItalic";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(TEAM_RANKS[level - 1], 640, y + 52);
    const cur = teamXpFor(level), next = teamXpFor(Math.min(TEAM_MAX_LEVEL, level + 1));
    teamBar(ctx, 790, y + 22, 220, 12, level >= TEAM_MAX_LEVEL ? 1 : (team.xp - cur) / (next - cur), color);
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(`${team.xp} XP`, 790, y + 54);
    ctx.textAlign = "right";
    ctx.fillStyle = teamWeekly(team).done ? "#4ade80" : "#94a3b8";
    ctx.fillText(teamWeekly(team).done ? "objectif réussi" : `objectif ${Math.min(teamWeekly(team).progress, teamWeekly(team).goal)}/${teamWeekly(team).goal}`, W - 64, y + 40);
    ctx.textAlign = "left";
  }
  return c;
}
async function refreshTeamsBoard() {
  const ch = chan("equipes");
  if (!ch || ch === channelRef) return;
  teamsDirty = false;
  const st = load();
  const file = new AttachmentBuilder(await (await drawTeamsBoard()).encode("jpeg", 90), { name: "equipes.jpg" });
  const payload = {
    embeds: [
      new EmbedBuilder()
        .setColor(0x818cf8)
        .setTitle("🛡️ Les équipes de la Maison")
        .setDescription(
          `Formez un **duo** avec le membre de votre choix (2 joueurs au maximum).\n` +
            "⭐ Chaque booster ouvert, combat gagné, quête, échange ou conquête de l'île fait monter le **niveau d'équipe** (récompenses à chaque niveau).\n" +
            `🎯 Un **objectif** chaque semaine · 💰 un **coffre commun** et sa boutique · 🎁 des **cadeaux** entre coéquipiers · 🏝️ **${Math.round(TEAM_ISLAND_SHARE * 100)} %** des gains de l'île pour le coéquipier du gardien.`
        )
        .setImage("attachment://equipes.jpg")
        .setFooter({ text: "Mis à jour en direct" }),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_eq").setLabel("Mon équipe").setEmoji("🛡️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_eq_new").setLabel("Créer une équipe").setEmoji("✨").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_eq_rules").setLabel("Comment ça marche").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
  let msg = st.teamsMessageId ? await ch.messages.fetch(st.teamsMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit(payload).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.teamsMessageId = msg.id;
      save();
    }
  }
}

// --- Fenêtres (éphémères) ---
const TEAM_RULES = () =>
  new EmbedBuilder()
    .setColor(0x818cf8)
    .setTitle("📖 Les équipes")
    .setDescription(
      "🛡️ **Un duo** : créez votre équipe (nom et emblème), puis invitez le membre de votre choix. 2 joueurs au maximum, une seule équipe par membre.\n" +
        `⭐ **Niveau d'équipe** (${TEAM_MAX_LEVEL} niveaux) : boosters ouverts (+${TEAM_XP.packs} XP), combats gagnés (+${TEAM_XP.wins}), quêtes (+${TEAM_XP.quests}), cartes sauvages (+${TEAM_XP.wild}), échanges et ventes (+${TEAM_XP.trades}), conquêtes de l'île (+${TEAM_XP.islands}) et chaque heure de garde (+2). À chaque niveau, de la poussière pour chacun ; aux niveaux 3, 6 et 9 un booster Premium chacun, au niveau 10 un booster Prestige chacun.\n` +
        "🎯 **Objectif de la semaine** : un défi commun chaque lundi. Réussi = 1 booster Premium et 100 ✨ chacun, +100 ✨ dans le coffre et +150 XP.\n" +
        `💰 **Coffre commun** : chacun peut y déposer sa poussière. La boutique d'équipe : ${TEAM_SHOP.map(([, name, emoji, , price]) => `${emoji} ${name} (${price} ✨)`).join(", ")}.\n` +
        `🎁 **Cadeaux** : offrez des cartes à votre coéquipier (${TEAM_GIFTS_PER_DAY} par jour).\n` +
        `🏝️ **L'île** : quand l'un de vous la garde, l'autre touche **${Math.round(TEAM_ISLAND_SHARE * 100)} %** de ses gains (et ne peut pas l'attaquer).\n` +
        "🚪 **Quitter** : si vous partez, votre coéquipier garde l'équipe. Le dernier à partir récupère le coffre."
    );
async function myTeamPayload(userId) {
  const team = teamOf(userId);
  if (!team)
    return {
      ephemeral: true,
      content: null,
      embeds: [new EmbedBuilder().setColor(0x818cf8).setTitle("🛡️ Vous n'avez pas d'équipe").setDescription("Créez votre équipe, choisissez un emblème et invitez le partenaire de votre choix. Ensemble, faites monter votre niveau, remplissez votre coffre et réussissez l'objectif de la semaine !")],
      files: [],
      attachments: [],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_eq_new").setLabel("Créer une équipe").setEmoji("✨").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("carte_eq_rules").setLabel("Comment ça marche").setEmoji("📖").setStyle(ButtonStyle.Secondary))],
    };
  const file = new AttachmentBuilder(await (await drawTeamCard(team)).encode("jpeg", 90), { name: "equipe.jpg" });
  const alone = team.members.length < TEAM_MAX;
  const gifts = load().teamGifts[userId]?.day === dayKey() ? load().teamGifts[userId].n : 0;
  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("carte_eq_shop")
        .setPlaceholder(`💰 Boutique d'équipe (coffre : ${team.vault} ✨)`)
        .addOptions(TEAM_SHOP.map(([key, name, emoji, desc, price]) => ({ label: `${name} — ${price} ✨`, value: key, emoji, description: desc })))
    ),
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_eq_emb").setPlaceholder("Changer l'emblème…").addOptions(TEAM_EMBLEMS.map(([e, name]) => ({ label: name === "High voltage" ? "Éclair" : { Dragon: "Dragon", Lion: "Lion", Wolf: "Loup", Eagle: "Aigle", Fox: "Renard", Octopus: "Pieuvre", Fire: "Flamme", "Crescent moon": "Lune", "Gem stone": "Diamant", Crown: "Couronne", Shield: "Bouclier" }[name], value: e, emoji: e, default: e === team.emblem })))),
    new ActionRowBuilder().addComponents(
      alone ? new ButtonBuilder().setCustomId("carte_eq_inv").setLabel("Inviter un partenaire").setEmoji("📨").setStyle(ButtonStyle.Success) : new ButtonBuilder().setCustomId("carte_eq_gift").setLabel(`Offrir une carte (${TEAM_GIFTS_PER_DAY - gifts} restantes)`).setEmoji("🎁").setStyle(ButtonStyle.Success).setDisabled(gifts >= TEAM_GIFTS_PER_DAY),
      new ButtonBuilder().setCustomId("carte_eq_vault").setLabel("Déposer au coffre").setEmoji("💰").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("carte_eq_show").setLabel("Montrer l'équipe").setEmoji("📣").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("carte_eq_quit").setLabel("Quitter").setEmoji("🚪").setStyle(ButtonStyle.Danger)
    ),
  ];
  const w = teamWeekly(team);
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(parseInt(emblemOf(team)[2].slice(1), 16))
        .setTitle(`${team.emblem} ${team.name} — niveau ${teamLevel(team)} (${TEAM_RANKS[teamLevel(team) - 1]})`)
        .setDescription(`🎯 Objectif de la semaine : **${goalText(w)}** — ${w.done ? "✅ réussi !" : `${w.progress} / ${w.goal}`}\n💰 Coffre : **${team.vault} ✨**${alone ? "\n📨 Il reste une place : invitez un partenaire !" : ""}`)
        .setThumbnail("attachment://blason.png")
        .setImage("attachment://equipe.jpg"),
    ],
    files: [file, await crestFile(team.emblem)],
    attachments: [],
    components: rows,
  };
}
function giftPayload(userId) {
  const partner = partnerOf(userId);
  const name = teamOf(userId)?.profiles?.[partner]?.name ?? "votre coéquipier";
  const options = ownedKeys(userId)
    .filter(([k]) => islandAvailable(userId, k) > 0)
    .slice(0, 25)
    .map(([k, n]) => ({ label: keyLabel(k).slice(0, 100), value: k, emoji: RARITIES[cardOfKey(k).rarity].emoji, description: `×${n} · cote ${euro(coteOf(k))}`.slice(0, 100) }));
  return {
    ephemeral: true,
    content: `🎁 Quelle carte offrir à **${name}** ?`,
    embeds: [],
    files: [],
    attachments: [],
    components: options.length ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_eq_giftc").setPlaceholder("Choisir la carte à offrir…").addOptions(options))] : [],
  };
}
function newTeam(user, name) {
  const id = Date.now().toString(36);
  teamsState()[id] = { id, name, emblem: "🛡️", owner: user.id, members: [user.id], profiles: { [user.id]: { name: user.name, avatar: user.avatar } }, createdAt: Date.now(), xp: 0, vault: 0, contrib: {}, stats: {} };
  teamsDirty = true;
  return teamsState()[id];
}
function leaveTeam(userId) {
  const team = teamOf(userId);
  if (!team) return null;
  team.members = team.members.filter((m) => m !== userId);
  delete team.profiles[userId];
  let refund = 0;
  if (!team.members.length) {
    refund = team.vault;
    load().dust[userId] = (load().dust[userId] ?? 0) + refund;
    delete teamsState()[team.id];
  } else if (team.owner === userId) team.owner = team.members[0];
  teamsDirty = true;
  return { team, refund };
}

async function handleTeamInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "equipe") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await myTeamPayload(interaction.user.id));
    return true;
  }
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_eq")) return false;
  const userId = interaction.user.id;
  const me = { id: userId, name: interaction.member?.displayName ?? interaction.user.username, avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }) };
  load();
  const team = teamOf(userId);
  const refresh = async () => {
    save();
    await interaction.editReply(await myTeamPayload(userId));
  };
  if (id === "carte_eq") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await myTeamPayload(userId));
    return true;
  }
  if (id === "carte_eq_rules") {
    await interaction.reply({ embeds: [TEAM_RULES()], ephemeral: true });
    return true;
  }
  if (id === "carte_eq_new" || id === "carte_eq_ren") {
    if (id === "carte_eq_new" && team) {
      await interaction.reply({ content: `❌ Vous êtes déjà dans l'équipe **${team.name}**.`, ephemeral: true });
      return true;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(id === "carte_eq_new" ? "carte_eq_newf" : "carte_eq_renf")
        .setTitle(id === "carte_eq_new" ? "Créer une équipe" : "Renommer l'équipe")
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Nom de l'équipe (3 à 24 caractères)").setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(24).setRequired(true)))
    );
    return true;
  }
  if (id === "carte_eq_newf" || id === "carte_eq_renf") {
    const name = cleanTeamName(interaction.fields.getTextInputValue("name"));
    if (name.length < 3) {
      await interaction.reply({ content: "❌ Nom trop court (3 caractères au moins, sans symboles spéciaux).", ephemeral: true });
      return true;
    }
    if (Object.values(teamsState()).some((t) => t.name.toLowerCase() === name.toLowerCase() && t !== team)) {
      await interaction.reply({ content: `❌ Le nom **${name}** est déjà pris.`, ephemeral: true });
      return true;
    }
    if (id === "carte_eq_newf") {
      if (team) {
        await interaction.reply({ content: "❌ Vous avez déjà une équipe.", ephemeral: true });
        return true;
      }
      await interaction.deferReply({ ephemeral: true });
      const t = newTeam(me, name);
      save();
      checkAchievements(userId).catch(() => null);
      await interaction.editReply(await myTeamPayload(userId));
      await teamNotice(`✨ <@${userId}> fonde l'équipe **${t.name}** ! Il reste une place…`, [userId]);
      return true;
    }
    const [, , , , price] = TEAM_SHOP.find(([k]) => k === "rename");
    if (!team || team.vault < price) {
      await interaction.reply({ content: `❌ Il faut ${price} ✨ dans le coffre.`, ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    team.vault -= price;
    const old = team.name;
    team.name = name;
    teamsDirty = true;
    await refresh();
    await teamNotice(`✏️ L'équipe **${old}** s'appelle désormais **${name}** !`);
    return true;
  }
  if (!team && !/^carte_eq_(acc|ref|xinv)_/.test(id)) {
    await interaction.reply(await myTeamPayload(userId));
    return true;
  }
  if (id === "carte_eq_emb") {
    await interaction.deferUpdate();
    team.emblem = interaction.values[0];
    teamsDirty = true;
    await refresh();
    return true;
  }
  if (id === "carte_eq_show") {
    await interaction.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(await (await drawTeamCard(team)).encode("jpeg", 90), { name: "equipe.jpg" });
    const sent = await chan("discussion")
      ?.send({ content: `${team.emblem} ${interaction.user} présente son équipe **${team.name}** :`, files: [file], allowedMentions: { parse: [] } })
      .catch(() => null);
    deleteLater(sent, MINUTE);
    await interaction.editReply({ content: sent ? `✅ Équipe présentée dans ${chan("discussion")}.` : "❌ Impossible de publier." });
    return true;
  }
  // --- invitation ---
  if (id === "carte_eq_inv") {
    if (team.members.length >= TEAM_MAX) {
      await interaction.reply({ content: "❌ Votre équipe est complète.", ephemeral: true });
      return true;
    }
    await interaction.reply({ ephemeral: true, content: "📨 Qui voulez-vous inviter dans votre équipe ?", components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("carte_eq_invu").setPlaceholder("Choisir un membre…"))] });
    return true;
  }
  if (id === "carte_eq_invu") {
    const target = interaction.users.first(), tName = interaction.members?.first()?.displayName ?? target?.username ?? "?";
    const err = !target || target.bot || target.id === userId ? "Choisissez un autre membre (pas vous-même, ni un bot)." : teamOf(target.id) ? `${tName} fait déjà partie d'une équipe.` : team.members.length >= TEAM_MAX ? "Votre équipe est complète." : null;
    if (err) {
      await interaction.update({ content: `❌ ${err}`, components: interaction.message.components });
      return true;
    }
    const iid = Date.now().toString(36);
    const inv = { id: iid, teamId: team.id, from: userId, fromName: me.name, to: target.id, toName: tName, toAvatar: target.displayAvatarURL({ extension: "png", size: 128 }) };
    inv.message = await chan("equipes")
      ?.send({
        content: `📨 <@${target.id}>, **${me.name}** vous invite à rejoindre l'équipe **${team.emblem} ${team.name}** !`,
        embeds: [new EmbedBuilder().setColor(parseInt(emblemOf(team)[2].slice(1), 16)).setTitle(`${team.emblem} Invitation dans l'équipe ${team.name}`).setDescription(`Niveau **${teamLevel(team)}** (${TEAM_RANKS[teamLevel(team) - 1]}) · coffre **${team.vault} ✨**\nEn équipe : niveau commun, objectif de la semaine, coffre partagé, cadeaux de cartes et bonus sur l'île.\n\nL'invitation expire <t:${Math.floor(Date.now() / 1000) + TEAM_INVITE_MINUTES * 60}:R>.`)],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`carte_eq_acc_${iid}`).setLabel("Rejoindre l'équipe").setEmoji("🤝").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`carte_eq_ref_${iid}`).setLabel("Refuser").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`carte_eq_xinv_${iid}`).setLabel("Annuler (auteur)").setStyle(ButtonStyle.Secondary)
          ),
        ],
        allowedMentions: { users: [target.id] },
      })
      .catch(() => null);
    if (!inv.message) {
      await interaction.update({ content: "❌ Impossible de publier l'invitation.", components: [] });
      return true;
    }
    teamInvites.set(iid, inv);
    setTimeout(() => {
      if (!teamInvites.delete(iid)) return;
      inv.message.edit({ content: `⌛ L'invitation de **${inv.fromName}** à **${inv.toName}** a expiré.`, embeds: [], components: [] }).catch(() => null);
      deleteLater(inv.message, MINUTE);
    }, TEAM_INVITE_MINUTES * MINUTE);
    client.users.fetch(target.id).then((u) => u.send(`📨 **${me.name}** vous invite dans l'équipe **${team.name}** : ${inv.message.url}`)).catch(() => null);
    await interaction.update({ content: `✅ Invitation envoyée à **${tName}** dans ${chan("equipes")} !`, components: [] });
    return true;
  }
  const invAct = /^carte_eq_(acc|ref|xinv)_(\w+)$/.exec(id);
  if (invAct) {
    const [, act, iid] = invAct, inv = teamInvites.get(iid);
    if (!inv) {
      await interaction.reply({ content: "ℹ️ Cette invitation n'est plus valable.", ephemeral: true });
      return true;
    }
    if ((act === "xinv" && userId !== inv.from) || (act !== "xinv" && userId !== inv.to)) {
      await interaction.reply({ content: act === "xinv" ? `⛔ Seul(e) **${inv.fromName}** peut annuler son invitation.` : `⛔ Cette invitation est pour **${inv.toName}**.`, ephemeral: true });
      return true;
    }
    teamInvites.delete(iid);
    const t = teamsState()[inv.teamId];
    let text;
    if (act !== "acc") text = act === "ref" ? `✖️ **${inv.toName}** refuse l'invitation de **${inv.fromName}**.` : `🗑️ Invitation annulée par **${inv.fromName}**.`;
    else if (!t || t.members.length >= TEAM_MAX) text = "❌ L'équipe n'existe plus ou est déjà complète.";
    else if (teamOf(userId)) text = `❌ **${inv.toName}** fait déjà partie d'une équipe.`;
    else {
      t.members.push(userId);
      t.profiles[userId] = { name: inv.toName, avatar: inv.toAvatar };
      teamsDirty = true;
      save();
      for (const m of t.members) checkAchievements(m).catch(() => null);
      text = `🤝 **${inv.toName}** rejoint **${inv.fromName}** dans l'équipe **${t.emblem} ${t.name}** ! Le duo est au complet.`;
    }
    await interaction.update({ content: text, embeds: [], components: [], allowedMentions: { parse: [] } });
    deleteLater(interaction.message, MINUTE);
    return true;
  }
  // --- coffre et boutique ---
  if (id === "carte_eq_vault") {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("carte_eq_vaultf")
        .setTitle("Déposer au coffre de l'équipe")
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("amount").setLabel(`Poussière à déposer (vous avez ${load().dust[userId] ?? 0})`.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7)))
    );
    return true;
  }
  if (id === "carte_eq_vaultf") {
    const amount = Math.floor(Number(String(interaction.fields.getTextInputValue("amount")).replace(/\s/g, "")));
    if (!Number.isFinite(amount) || amount < 1 || amount > (load().dust[userId] ?? 0)) {
      await interaction.reply({ content: `❌ Montant invalide : vous avez ${load().dust[userId] ?? 0} ✨.`, ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    load().dust[userId] -= amount;
    team.vault += amount;
    teamsDirty = true;
    await refresh();
    const partner = partnerOf(userId);
    if (partner) client.users.fetch(partner).then((u) => u.send(`💰 **${me.name}** a déposé **${amount} ✨** dans le coffre de l'équipe **${team.name}** (total ${team.vault} ✨).`)).catch(() => null);
    return true;
  }
  if (id === "carte_eq_shop") {
    const item = TEAM_SHOP.find(([k]) => k === interaction.values[0]);
    if (!item) return true;
    const [key, name, , , price] = item;
    if (key === "rename") {
      if (team.vault < price) {
        await interaction.reply({ content: `❌ Il faut ${price} ✨ dans le coffre (il y en a ${team.vault}).`, ephemeral: true });
        return true;
      }
      await interaction.showModal(new ModalBuilder().setCustomId("carte_eq_renf").setTitle("Renommer l'équipe").addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("name").setLabel("Nouveau nom (3 à 24 caractères)").setStyle(TextInputStyle.Short).setMinLength(3).setMaxLength(24).setRequired(true))));
      return true;
    }
    if (team.vault < price) {
      await interaction.reply({ content: `❌ Il faut ${price} ✨ dans le coffre (il y en a ${team.vault}). Déposez de la poussière avec 💰.`, ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    team.vault -= price;
    if (key === "booster") for (const m of team.members) addPacks(m, packKey(CURRENT_GEN, "premium"), 1);
    if (key === "xp") addTeamXp(team, 150);
    teamsDirty = true;
    await refresh();
    await teamNotice(`${team.emblem} L'équipe **${team.name}** s'offre **${name}** à la boutique d'équipe${key === "booster" ? " : un booster Premium pour chacun !" : " !"}`);
    return true;
  }
  // --- cadeaux ---
  if (id === "carte_eq_gift") {
    if (!partnerOf(userId)) {
      await interaction.reply({ content: "❌ Il vous faut un coéquipier.", ephemeral: true });
      return true;
    }
    await interaction.reply(giftPayload(userId));
    return true;
  }
  if (id === "carte_eq_giftc") {
    const partner = partnerOf(userId), key = interaction.values[0];
    const g = (load().teamGifts[userId] = load().teamGifts[userId]?.day === dayKey() ? load().teamGifts[userId] : { day: dayKey(), n: 0 });
    if (!partner || g.n >= TEAM_GIFTS_PER_DAY) {
      await interaction.update({ content: g.n >= TEAM_GIFTS_PER_DAY ? `❌ Vous avez déjà offert ${TEAM_GIFTS_PER_DAY} cartes aujourd'hui.` : "❌ Il vous faut un coéquipier.", components: [] });
      return true;
    }
    if (!moveKey(userId, partner, key)) {
      await interaction.update({ content: "❌ Vous n'avez plus cette carte (ou elle défend l'île).", components: [] });
      return true;
    }
    g.n++;
    save();
    const pName = team.profiles?.[partner]?.name ?? "votre coéquipier";
    pairAlert(userId, partner, "cadeaux d'équipe", keyLabel(key)).catch(() => null);
    await interaction.update({ content: `🎁 **${keyLabel(key)}** offerte à **${pName}** ! (${TEAM_GIFTS_PER_DAY - g.n} cadeau(x) restant(s) aujourd'hui)`, components: [] });
    client.users.fetch(partner).then((u) => u.send(`🎁 **${me.name}**, votre coéquipier, vous offre la carte **${keyLabel(key)}** !`)).catch(() => null);
    checkSeriesRewards(client, partner).catch(() => null);
    panelDirty = true;
    return true;
  }
  // --- quitter ---
  if (id === "carte_eq_quit") {
    const last = team.members.length === 1;
    await interaction.reply({
      ephemeral: true,
      content: last ? `🚪 Vous êtes le dernier membre : l'équipe **${team.name}** sera dissoute et vous récupérerez le coffre (${team.vault} ✨). Confirmer ?` : `🚪 Quitter l'équipe **${team.name}** ? Votre coéquipier la garde (avec le coffre et le niveau).`,
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_eq_quit_ok").setLabel("Oui, quitter").setStyle(ButtonStyle.Danger))],
    });
    return true;
  }
  if (id === "carte_eq_quit_ok") {
    const res = leaveTeam(userId);
    save();
    await interaction.update({ content: res ? `🚪 Vous avez quitté l'équipe **${res.team.name}**${res.refund ? ` et récupéré ${res.refund} ✨ du coffre` : ""}.` : "ℹ️ Vous n'avez plus d'équipe.", components: [] });
    if (res) await teamNotice(res.team.members.length ? `🚪 **${me.name}** quitte l'équipe **${res.team.name}** : une place se libère !` : `🚪 L'équipe **${res.team.name}** est dissoute.`);
    return true;
  }
  return false;
}
