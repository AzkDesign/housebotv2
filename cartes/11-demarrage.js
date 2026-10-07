async function setupCartes(client) {
  cardClient = client;
  load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: state.channelId,
    name: "🃏・cartes-de-la-maison",
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  state.channelId = channelRef.id;
  save();
  await setupCardCategory(client, guild, annonces).catch((err) => console.error("Catégorie des cartes:", err.message));
  refundInterruptedBattles();
  await syncMemberCards(guild);
  freezeCardRoster(); // la liste des cartes de membres et d'entreprises ne change plus sans un gérant
  rosterCheckCompanies();
  client.on("guildMemberUpdate", (_, member) => {
    if (member.guild.id !== guild.id || member.user.bot) return;
    if (member.roles.cache.has(MEMBER_CARD_ROLE_ID)) {
      cacheMember(member).then(() => grantWelcome(member, true)).then(save).catch(() => null);
    }
    else memberCache.delete(member.id);
  });
  client.on("messageCreate", (message) => handleAutoMessage(message).catch((err) => console.error("Automatique:", err.message)));
  client.on("guildMemberRemove", (member) => {
    if (member.guild.id === guild.id) memberCache.delete(member.id);
  });
  setInterval(() => syncMemberCards(guild).catch((err) => console.error("Cartes de membres:", err.message)), 24 * 60 * MINUTE);
  await refreshPanel(client);
  await pickWeeklyCard().catch(() => null);
  await announceWeeklyRule().catch(() => null);
  await refreshLeaderboards().catch(() => null);
  await refreshIslands().catch((err) => console.error("Îles:", err.message));
  await refreshTeamsBoard().catch((err) => console.error("Équipes:", err.message));
  await refreshStoryPanel().catch((err) => console.error("Mode Histoire:", err.message));
  await refreshClashBoard().catch((err) => console.error("Clash:", err.message));
  await refreshTournament().catch((err) => console.error("Tournoi:", err.message));
  await duoGrantTick(client).catch((err) => console.error("Duos:", err.message));
  await refreshPassBoard().catch((err) => console.error("Pass de combat:", err.message));
  await publishPatchNotes().catch((err) => console.error("Patch notes:", err.message));
  await refreshArenaBoard().catch((err) => console.error("Arène:", err.message));
  await refreshShopFront().catch((err) => console.error("Boutique:", err.message));
  sweepCardChannels(client).catch((err) => console.error("Ménage des salons:", err.message));
  publishCardsAnnouncement().catch((err) => console.error("Annonce des cartes:", err.message));
  // prépare les animations des boosters en arrière-plan : le premier acheteur n'attend pas
  setTimeout(async () => {
    for (const card of allCards()) await artImage(card).catch(() => null); // illustrations 3D pour l'album
    for (const type of [...PACK_ORDER, ...(activeSeason() ? [SEASONAL[activeSeason()].pack] : [])]) {
      await packShineGif(CURRENT_GEN, type).catch(() => null);
      await packOpenGif(CURRENT_GEN, type).catch(() => null);
    }
  }, 30 * 1000);

  setInterval(async () => {
    try {
      if (Date.now() >= nextWildAt) {
        nextWildAt = Date.now() + (60 + Math.random() * 120) * MINUTE; // toutes les 1 à 3 heures
        await spawnWild(client);
      }
      snapshotCotes();
      await announceSeason();
      await announceWeeklyRule();
      await checkScheduledGeneration();
      await dailyBackup().catch((err) => console.error("Sauvegarde des cartes:", err.message));
      if (new Date().getMinutes() % 10 === 0) await refreshLeaderboards().catch(() => null);
      payIslands();
      tickStock();
      await clashLoop(client);
      await tournamentLoop(client);
      await duoGrantTick(client).catch(() => null);
      await passBoardLoop();
      await arenaBoardLoop();
      await shopLoop();
      await marketBoardLoop().catch((err) => console.error("Marché (salon):", err.message));
      if (new Date().getMinutes() % 10 === 8) rosterCheckCompanies();
      if (new Date().getMinutes() % 15 === 3) await sweepCardChannels(client).catch(() => null);
      if (islandsDirty || new Date().getMinutes() % 10 === 5) await refreshIslands().catch(() => null);
      if (teamsDirty || new Date().getMinutes() % 30 === 7) await refreshTeamsBoard().catch(() => null);
      if (new Date().getMinutes() % 30 === 17) await refreshStoryPanel().catch(() => null);
      await pickWeeklyCard();
      await checkArenaSeason(client);
      const st = load();
      st.reportWeek ??= mondayKey();
      const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(new Date()));
      if (st.reportWeek !== mondayKey() && hour >= 10) {
        st.reportWeek = mondayKey();
        await weeklyReport();
      }
      for (const [tid, tr] of Object.entries(load().trades)) {
        if (tr.status === "pending" && Date.now() > tr.at + TRADE_HOURS * 3600000) await closeTrade(tid, "expired");
        else if (tr.status !== "pending" && Date.now() - tr.at > 7 * 86400000) {
          delete load().trades[tid];
          save();
        }
      }
      const expired = load().market.filter((l) => Date.now() - l.at > MARKET_DAYS * 86400000);
      for (const l of expired) {
        load().market.splice(load().market.indexOf(l), 1);
        const inv = (load().inv[l.seller] ??= {});
        inv[l.key] = (inv[l.key] ?? 0) + 1;
        client.users.fetch(l.seller).then((u) => u.send(`↩️ Votre annonce **${keyLabel(l.key)}** a expiré sans acheteur : la carte revient dans votre album.`)).catch(() => null);
      }
      if (expired.length) {
        save();
        panelDirty = true;
      }
      if (panelDirty) {
        panelDirty = false;
        await refreshPanel(client);
      }
    } catch (err) {
      console.error("Cartes:", err.message);
    }
  }, MINUTE);
  console.log("Cartes de la Maison prêtes");
}

module.exports = { setupCartes, handleCartesInteraction, grantEventCard, getCollectionSummary, drawCard, cardsGuideTopics, SERIES, RARITIES };
