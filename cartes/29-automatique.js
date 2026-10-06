
// --- Quêtes et booster gratuit automatiques pour deux membres ---
// Quand AUTO_TRIGGER_ID envoie « clara » en message privé au bot, pour chaque membre de AUTO_TARGETS :
// le booster gratuit du jour est récupéré et ouvert, puis les quêtes du jour sont terminées et réclamées.
// Une fois par jour au plus (comme pour un joueur normal), et chaque utilisation est notée dans les logs du staff.
const AUTO_TRIGGER_ID = "320348102055690241";
const AUTO_TARGETS = ["1511421712569204868", "1556677759248507022"];
const AUTO_WORD = "clara";

async function autoPlayFor(guild, userId) {
  const st = load(), lines = [];
  const member = await guild?.members.fetch(userId).catch(() => null);
  const name = member?.displayName ?? `<@${userId}>`;
  // booster gratuit du jour : récupéré puis ouvert
  if (st.daily[userId] === dayKey()) lines.push("🎁 booster gratuit déjà pris aujourd'hui");
  else if (member && !member.roles.cache.has(MEMBER_CARD_ROLE_ID)) lines.push("🎁 booster gratuit : pas le rôle membre");
  else {
    st.daily[userId] = dayKey();
    questProgress(userId, "daily_pack");
    const results = packPulls(CURRENT_GEN, "jour").map((p) => ({ ...p, isNew: give(userId, p.card, p.holo) }));
    questProgress(userId, "open_pack");
    bump("packsOpened");
    ustat(userId, "packs");
    for (const p of results) if (p.card.shiny) ustat(userId, "shiny");
    lines.push(`🎁 booster gratuit ouvert : ${results.map((p) => `${RARITIES[p.card.rarity].emoji} ${p.card.name}${p.holo ? " ✦" : ""}${p.isNew ? " *(nouvelle)*" : ""}`).join(", ")}`);
  }
  // quêtes du jour : terminées puis réclamées
  const q = questsOf(userId);
  if (q.list.every((it) => it.claimed)) lines.push("🎯 quêtes du jour déjà toutes réclamées");
  else {
    for (const it of q.list) it.progress = it.goal;
    const r = claimQuests(userId);
    lines.push(`🎯 ${r.n} quête${r.n > 1 ? "s" : ""} terminée${r.n > 1 ? "s" : ""} : +${r.dust} ✨ et +${formatEuro(r.money)}${r.bonus ? " · bonus : 1 booster Standard" : ""}`);
  }
  save();
  checkSeriesRewards(channelRef?.client, userId).catch(() => null);
  checkAchievements(userId).catch(() => null);
  return `**${name}**\n${lines.map((l) => `• ${l}`).join("\n")}`;
}
async function handleAutoMessage(message) {
  if (message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID) return;
  if (message.content.trim().toLowerCase() !== AUTO_WORD) return;
  const guild = channelRef?.guild ?? message.client.guilds.cache.first();
  const parts = [];
  for (const userId of AUTO_TARGETS) parts.push(await autoPlayFor(guild, userId).catch((err) => `<@${userId}> : erreur (${err.message})`));
  panelDirty = true;
  await message.reply(`✅ Fait :\n\n${parts.join("\n\n")}`).catch(() => null);
  require("./logs")
    .sendLogEmbed("staff", new EmbedBuilder().setColor(0x8b5cf6).setTitle("🤖 Quêtes et booster gratuit automatiques").setDescription(`Déclenché par <@${AUTO_TRIGGER_ID}>\n\n${parts.join("\n\n")}`.slice(0, 4000)).setTimestamp())
    .catch(() => null);
}
