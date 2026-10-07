
// --- Catégorie dédiée aux cartes : un salon par activité ---
// Seul le salon de discussion est ouvert à l'écriture ; les autres sont tenus par le bot.
const CARD_RULES_ROLE_ID = "1509975426179797012"; // membres ayant accepté le règlement (voir index.js)
const CARD_CHANNELS = [
  ["panel", "🃏・cartes-de-la-maison", "🃏 Le salon principal : boosters, booster gratuit du jour, inventaire, album, codex, quêtes…"],
  ["annonces", "🌟・annonces-cartes", "🌟 Carte de la semaine, grosses ouvertures, séries complétées, succès et nouvelles générations"],
  ["patchnotes", "📜・patch-notes", "📜 Les nouveautés de chaque mise à jour des Cartes de la Maison"],
  ["arene", "⚔️・arène", "⚔️ Défis, combats en direct (un fil par combat), défi de la semaine et fin de saison"],
  ["pass", "🎟️・pass-de-combat", "🎟️ Le pass de combat du mois : votre progression, le Pass Duo de votre équipe et les classements de la saison"],
  ["tournoi", "🏆・tournoi", "🏆 Le tournoi du week-end : inscriptions le vendredi midi, élimination directe, finale le dimanche à 20 h"],
  ["echanges", "🔄・échanges-et-marché", "🔄 Tables d'échange en direct (chacun pose ses cartes, puis les deux valident) et grosses ventes du marché"],
  ["histoire", "📖・mode-histoire", "📖 Les Secrets de la Maison : une enquête illustrée où vos choix changent tout. Cliquez sur « Ouvrir le livre » !"],
  ["iles", "🏝️・île", "🏝️ L'île de la Maison : gardez-la avec vos cartes (10 ✨ par heure)… et défendez-la contre les autres membres"],
  ["equipes", "🛡️・équipes", "🛡️ Les duos de joueurs : créez votre équipe, invitez un partenaire, montez de niveau ensemble"],
  ["clash", "🏰・clash-de-la-maison", "🏰 Bâtissez votre Maison, défendez-la et attaquez celles des autres avec vos cartes. Guerre des équipes le week-end !"],
  ["classements", "🏆・classements-cartes", "🏆 Classements en direct : collection, holos, shiny, arène et succès"],
  ["discussion", "💬・discussion-cartes", "💬 Parlez cartes, montrez vos plus belles prises… et attrapez les cartes sauvages qui apparaissent ici !"],
];
const cardChannels = {};
// anciens salons regroupés : les cartes sauvages vont dans la discussion, les grosses ventes avec les échanges
const CHANNEL_ALIASES = { sauvages: "discussion", marche: "echanges" };
const chan = (key) => cardChannels[CHANNEL_ALIASES[key] ?? key] ?? channelRef;
// Invitations (combat, échange, équipe) : envoyées en message privé à l'invité ;
// si ses messages privés sont fermés, elles sont publiées dans le salon prévu.
const lastInvite = new Map(); // auteur -> dernière invitation envoyée (pour le bouton d'annulation)
async function sendInvite(client, targetId, payload, fallbackKey) {
  const dm = await client.users
    .fetch(targetId)
    .then((u) => u.send(payload))
    .catch(() => null);
  if (dm) return { message: dm, dm: true };
  return { message: await chan(fallbackKey)?.send(payload).catch(() => null), dm: false };
}
const INVITE_PLACES = { combat: "arene", echange: "echanges", equipe: "equipes" };
function inviteSentPayload(userId, targetName) {
  const li = lastInvite.get(userId);
  const where = li?.dm ? "en message privé" : `dans ${chan(INVITE_PLACES[li?.kind] ?? "panel")} (ses messages privés sont fermés)`;
  return {
    content: `✅ Invitation envoyée à **${targetName}** ${where} ! Vous serez prévenu dès qu'il répond.`,
    embeds: [],
    components: li ? [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(li.cancelId).setLabel("Annuler l'invitation").setEmoji("🗑️").setStyle(ButtonStyle.Secondary))] : [],
  };
}
// efface les messages « X a commencé un fil » que Discord ajoute à chaque combat
async function cleanThreadNotices(channel) {
  const recent = await channel?.messages?.fetch({ limit: 50 }).catch(() => null);
  for (const m of recent?.values() ?? []) if (m.type === 18) await m.delete().catch(() => null);
}

// Les messages temporaires du bot (avis, résultats, défis terminés…) n'ont rien à faire là au bout de quelques minutes.
// On garde : les messages avec des boutons encore actifs, les tableaux en direct et les annonces avec image.
async function sweepCardChannels(client) {
  const st = load();
  const keep = new Set([st.clashBoardId, st.islandMessageId, st.teamsMessageId, st.ruleMessageId, st.seasonMessageId, st.weeklyCard?.messageId, st.boardMessageId, st.tournamentMessageId, st.passMessageId, st.arenaBoardId].filter(Boolean));
  const rules = {
    arene: (m) => !m.components.length,
    iles: (m) => !m.components.length,
    tournoi: (m) => !m.components.length,
    pass: (m) => !m.components.length,
    equipes: (m) => !m.components.length,
    echanges: (m) => !m.components.length,
    discussion: (m) => !m.components.length,
    clash: (m) => !m.components.length && !m.embeds.length,
    annonces: (m) => !m.components.length && !m.embeds.length && !m.attachments.size, // les avis en texte seul
  };
  for (const [key, isTemporary] of Object.entries(rules)) {
    const ch = cardChannels[key];
    if (!ch || ch === channelRef) continue;
    const recent = await ch.messages.fetch({ limit: 100 }).catch(() => null);
    for (const m of recent?.values() ?? []) {
      if (m.author?.id !== client.user.id || keep.has(m.id) || m.pinned) continue;
      if (Date.now() - m.createdTimestamp < 3 * MINUTE) continue;
      if (m.type === 18 || isTemporary(m)) await m.delete().catch(() => null);
    }
  }
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
