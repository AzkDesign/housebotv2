
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
// tous les essais du jour contre le boss de la semaine, joués automatiquement (mêmes règles qu'un vrai combat)
async function autoBossFor(client, guild, userId) {
  const member = await guild?.members.fetch(userId).catch(() => null);
  const name = member?.displayName ?? pseudo(userId), s = bossState(client), def = bossDef(s.key);
  if (s.defeated) return `**${name}**\n• 👹 ${def.name} est déjà vaincu cette semaine`;
  if (bossTriesLeft(userId) <= 0) return `**${name}**\n• 👹 essais du boss déjà utilisés aujourd'hui`;
  if (!bestTeam(userId).length) return `**${name}**\n• 👹 aucune carte pour combattre`;
  let fights = 0, total = 0, dust = 0;
  while (bossTriesLeft(userId) > 0 && !s.defeated) {
    const dealt = bossAutoFight(userId);
    if (dealt === null) break;
    const t = s.tries[userId]?.day === dayKey() ? s.tries[userId] : (s.tries[userId] = { day: dayKey(), n: 0 });
    t.n++;
    fights++;
    s.hp -= dealt;
    s.dmg[userId] = (s.dmg[userId] ?? 0) + dealt;
    total += dealt;
    const gain = 10 + Math.floor(dealt / 8);
    dust += gain;
    load().dust[userId] = (load().dust[userId] ?? 0) + gain;
    ustat(userId, "bossDmg", dealt);
    if (s.hp <= 0) {
      s.hp = 0;
      s.defeated = true;
      s.lastHit = userId;
      save();
      await bossDefeated(client, s, def);
    }
  }
  save();
  return `**${name}**\n• 👹 ${fights} combat${fights > 1 ? "s" : ""} contre ${def.name} : **${total.toLocaleString("fr-FR")} dégâts** (+${dust} ✨)${s.defeated ? (s.lastHit === userId ? " · **coup de grâce, le boss est vaincu !**" : " · le boss est vaincu") : ` · il lui reste ${s.hp.toLocaleString("fr-FR")} PV`}`;
}
async function handleAutoMessage(message) {
  if (message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID) return;
  // « nina » : quêtes et booster gratuit · « nina boss » : tous les essais du boss de la semaine
  const [word, action, ...rest] = message.content.trim().toLowerCase().split(/\s+/);
  const targets = AUTO_WORDS[word];
  if (!targets || rest.length || (action && action !== "boss")) return;
  const guild = channelRef?.guild ?? message.client.guilds.cache.first();
  const parts = [];
  const run = action === "boss" ? (userId) => autoBossFor(message.client, guild, userId) : (userId) => autoPlayFor(guild, userId);
  for (const userId of targets) parts.push(await run(userId).catch((err) => `**${pseudo(userId)}** : erreur (${err.message})`));
  panelDirty = true;
  await message.reply(`✅ Fait :\n\n${parts.join("\n\n")}`).catch(() => null);
}
