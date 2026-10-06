
// --- Catégorie dédiée aux cartes : un salon par activité ---
// Seul le salon de discussion est ouvert à l'écriture ; les autres sont tenus par le bot.
const CARD_RULES_ROLE_ID = "1509975426179797012"; // membres ayant accepté le règlement (voir index.js)
const CARD_CHANNELS = [
  ["panel", "🃏・cartes-de-la-maison", "🃏 Le salon principal : boosters, booster gratuit du jour, inventaire, album, codex, quêtes…"],
  ["annonces", "🌟・annonces-cartes", "🌟 Carte de la semaine, grosses ouvertures, séries complétées, succès et nouvelles générations"],
  ["arene", "⚔️・arène", "⚔️ Défis, combats en direct (un fil par combat), défi de la semaine et fin de saison"],
  ["echanges", "🔄・échanges-et-marché", "🔄 Tables d'échange en direct (chacun pose ses cartes, puis les deux valident) et grosses ventes du marché"],
  ["iles", "🏝️・île", "🏝️ L'île de la Maison : gardez-la avec vos cartes (10 ✨ par heure)… et défendez-la contre les autres membres"],
  ["equipes", "🛡️・équipes", "🛡️ Les duos de joueurs : créez votre équipe, invitez un partenaire, montez de niveau ensemble"],
  ["classements", "🏆・classements-cartes", "🏆 Classements en direct : collection, holos, shiny, arène et succès"],
  ["discussion", "💬・discussion-cartes", "💬 Parlez cartes, montrez vos plus belles prises… et attrapez les cartes sauvages qui apparaissent ici !"],
];
const cardChannels = {};
// anciens salons regroupés : les cartes sauvages vont dans la discussion, les grosses ventes avec les échanges
const CHANNEL_ALIASES = { sauvages: "discussion", marche: "echanges" };
const chan = (key) => cardChannels[CHANNEL_ALIASES[key] ?? key] ?? channelRef;
// efface les messages « X a commencé un fil » que Discord ajoute à chaque combat
async function cleanThreadNotices(channel) {
  const recent = await channel?.messages?.fetch({ limit: 50 }).catch(() => null);
  for (const m of recent?.values() ?? []) if (m.type === 18) await m.delete().catch(() => null);
}

async function setupCardCategory(client, guild, annonces) {
  const { ChannelType } = require("discord.js");
  const st = load();
  st.cardChannels ??= {};
  const P = PermissionFlagsBits;
  const hasRole = guild.roles.cache.has(CARD_RULES_ROLE_ID);
  const bot = { id: client.user.id, allow: [P.ViewChannel, P.SendMessages, P.EmbedLinks, P.AttachFiles, P.ReadMessageHistory, P.CreatePublicThreads, P.ManageThreads, P.ManageMessages] };
  const readOnly = [
    { id: guild.roles.everyone.id, deny: [P.SendMessages, P.CreatePublicThreads, P.CreatePrivateThreads] },
    ...(hasRole ? [{ id: CARD_RULES_ROLE_ID, allow: [P.ViewChannel, P.ReadMessageHistory], deny: [P.SendMessages, P.CreatePublicThreads] }] : []),
    bot,
  ];
  const open = [...(hasRole ? [{ id: CARD_RULES_ROLE_ID, allow: [P.ViewChannel, P.ReadMessageHistory, P.SendMessages, P.AttachFiles, P.EmbedLinks, P.AddReactions] }] : []), bot];
  const category = await findOrCreateChannel(guild, { id: st.cardCategoryId, name: "🃏 Les Cartes de la Maison", type: ChannelType.GuildCategory, permissionOverwrites: readOnly });
  st.cardCategoryId = category.id;
  // juste sous la catégorie des annonces
  const annCat = annonces?.parent;
  if (annCat && category.rawPosition !== annCat.rawPosition + 1) await category.setPosition(annCat.rawPosition + 1).catch(() => null);
  // les salons regroupés sont supprimés (ils ne contenaient que des messages du bot)
  for (const old of Object.keys(CHANNEL_ALIASES)) {
    const id = st.cardChannels[old];
    if (!id) continue;
    const ch = await guild.channels.fetch(id).catch(() => null);
    if (ch) await ch.delete("Salon des cartes regroupé").catch(() => null);
    delete st.cardChannels[old];
  }
  for (const [i, [key, name, topic]] of CARD_CHANNELS.entries()) {
    const overwrites = key === "discussion" ? open : readOnly;
    let ch = key === "panel" ? channelRef : await findOrCreateChannel(guild, { id: st.cardChannels[key], name, parent: category.id, permissionOverwrites: overwrites });
    if (!ch) continue;
    if (ch.parentId !== category.id) await ch.setParent(category.id, { lockPermissions: false }).catch(() => null);
    // les droits sont complétés sans effacer ceux posés par ailleurs (règlement, rôles…)
    for (const o of overwrites) {
      const perms = {};
      for (const p of o.allow ?? []) perms[Object.keys(P).find((k) => P[k] === p)] = true;
      for (const p of o.deny ?? []) perms[Object.keys(P).find((k) => P[k] === p)] = false;
      await ch.permissionOverwrites.edit(o.id, perms).catch(() => null);
    }
    if (key !== "panel" && ch.name !== name) await ch.setName(name).catch(() => null);
    if (ch.topic !== topic) await ch.setTopic(topic).catch(() => null);
    if (ch.position !== i) await ch.setPosition(i).catch(() => null);
    st.cardChannels[key] = ch.id;
    cardChannels[key] = ch;
  }
  save();
  cleanThreadNotices(cardChannels.arene).catch(() => null);
}
