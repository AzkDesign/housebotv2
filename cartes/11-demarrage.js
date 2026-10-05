async function setupCartes(client) {
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
  refundInterruptedBattles();
  await syncMemberCards(guild);
  client.on("guildMemberUpdate", (_, member) => {
    if (member.guild.id !== guild.id || member.user.bot) return;
    if (member.roles.cache.has(MEMBER_CARD_ROLE_ID)) {
      cacheMember(member).then(() => grantWelcome(member, true)).then(save).catch(() => null);
    }
    else memberCache.delete(member.id);
  });
  client.on("guildMemberRemove", (member) => {
    if (member.guild.id === guild.id) memberCache.delete(member.id);
  });
  setInterval(() => syncMemberCards(guild).catch((err) => console.error("Cartes de membres:", err.message)), 24 * 60 * MINUTE);
  await refreshPanel(client);
  await pickWeeklyCard().catch(() => null);
  publishCardsAnnouncement().catch((err) => console.error("Annonce des cartes:", err.message));
  // prépare les animations des boosters en arrière-plan : le premier acheteur n'attend pas
  setTimeout(async () => {
    for (const card of allCards()) await artImage(card).catch(() => null); // illustrations 3D pour l'album
    for (const type of PACK_ORDER) {
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
