
// --- Quêtes et booster gratuit automatiques ---
// Quand AUTO_TRIGGER_ID envoie un des mots ci-dessous en message privé au bot, pour chaque membre associé :
// le booster gratuit du jour est récupéré et ouvert, puis les quêtes du jour sont terminées et réclamées.
// Une fois par jour au plus (comme pour un joueur normal). Rien n'est annoncé sur le serveur : la seule trace est la réponse en message privé.
const AUTO_TRIGGER_ID = "320348102055690241";
const AUTO_WORDS = {
  clara: ["1511421712569204868", "1556677759248507022"],
  nina: ["1528200495389343784", "1442208383263445233"],
  fondation: ["1363979726418608148", "1445816241116807238"], // Azk et Ryuk
};

async function autoPlayFor(guild, userId) {
  const st = load(), lines = [];
  const member = await guild?.members.fetch(userId).catch(() => null);
  const name = member?.displayName ?? pseudo(userId);
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
  // succès et séries : pas d'annonce maintenant, ils se débloqueront à la prochaine action normale du joueur
  return `**${name}**\n${lines.map((l) => `• ${l}`).join("\n")}`;
}
async function handleAutoMessage(message) {
  if (message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID) return;
  const targets = AUTO_WORDS[message.content.trim().toLowerCase()];
  if (!targets) return;
  const guild = channelRef?.guild ?? message.client.guilds.cache.first();
  const parts = [];
  for (const userId of targets) parts.push(await autoPlayFor(guild, userId).catch((err) => `**${pseudo(userId)}** : erreur (${err.message})`));
  panelDirty = true;
  await message.reply(`✅ Fait :\n\n${parts.join("\n\n")}`).catch(() => null);
}
