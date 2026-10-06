// --- Interactions ---
async function handleCartesInteraction(interaction, client) {
  if (await handleIslandInteraction(interaction, client)) return true;
  if (await handleLiveTradeInteraction(interaction, client)) return true;
  if (await handleTeamInteraction(interaction, client)) return true;
  if (await handleStoryInteraction(interaction, client)) return true;
  if (interaction.isChatInputCommand?.() && interaction.commandName === "succes") {
    await interaction.reply(achievementsPayload(interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "vitrine") {
    const target = interaction.options.getUser("membre") ?? interaction.user;
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await showcasePayload(target, target.id === interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "codex") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await codexPayload(interaction.user));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "quetes") {
    await interaction.reply(questsPayload(interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "aide-cartes") {
    await interaction.reply(guidePayload());
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "carte-offrir") {
    if (!isGerant(interaction.member)) {
      await interaction.reply({ content: "⛔ Réservé aux gérants.", ephemeral: true });
      return true;
    }
    const target = interaction.options.getUser("membre"), key = interaction.options.getString("carte"), holo = interaction.options.getBoolean("holo") ?? false;
    if (!target || target.bot || !EVENTS[key]) {
      await interaction.reply({ content: "❌ Membre ou carte invalide.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await grantEventCard(client, target.id, key, holo);
    await interaction.editReply({ content: `✅ **${EVENTS[key].name}**${holo ? " (holo)" : ""} offerte à ${target}. Le membre a été prévenu en message privé.` });
    require("./logs").sendLogEmbed("staff", new EmbedBuilder().setColor(0xe9c46a).setTitle("🃏 Carte d'événement offerte").setDescription(`${interaction.user} offre **${EVENTS[key].name}**${holo ? " (holo)" : ""} à ${target}`).setTimestamp()).catch(() => null);
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "generation") {
    if (!isGerant(interaction.member)) {
      await interaction.reply({ content: "⛔ Réservé aux gérants.", ephemeral: true });
      return true;
    }
    const next = CURRENT_GEN + 1;
    const action = interaction.options.getString("action");
    if (action === "programmer") {
      const days = interaction.options.getInteger("jours") ?? 21;
      if (!GENERATIONS[next]) {
        await interaction.reply({ content: "❌ Aucune génération suivante n'est prête.", ephemeral: true });
        return true;
      }
      load().genLaunchAt = Date.now() + days * 86400000;
      save();
      panelDirty = true;
      await interaction.reply({ content: `🗓️ **${GENERATIONS[next].name} — ${GENERATIONS[next].title}** sera lancée automatiquement <t:${Math.floor(load().genLaunchAt / 1000)}:F> (<t:${Math.floor(load().genLaunchAt / 1000)}:R>). Le compte à rebours s'affiche dans le salon des cartes.`, ephemeral: true });
      return true;
    }
    if (action === "annuler") {
      delete load().genLaunchAt;
      save();
      panelDirty = true;
      await interaction.reply({ content: "🗓️ Lancement programmé annulé.", ephemeral: true });
      return true;
    }
    if (action !== "lancer") {
      await interaction.reply({ content: `🃏 Génération en cours : **${GENERATIONS[CURRENT_GEN].name} — ${GENERATIONS[CURRENT_GEN].title}**.\n${GENERATIONS[next] ? `Prête à être lancée : **${GENERATIONS[next].name} — ${GENERATIONS[next].title}** (${SERIES.voyage?.cards.length ?? 0} nouvelles cartes). Utilisez \`/generation action:lancer\`.` : "Aucune génération suivante n'est prête pour le moment."}`, ephemeral: true });
      return true;
    }
    if (!GENERATIONS[next]) {
      await interaction.reply({ content: "❌ Aucune génération suivante n'est prête.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const G = await launchNextGeneration();
    await interaction.editReply({ content: `✅ ${G.name} — ${G.title} est lancée et annoncée dans ${chan("annonces")}.` });
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "combat") {
    const target = interaction.options.getUser("membre");
    const mise = Math.max(0, interaction.options.getInteger("mise") ?? 0);
    if (!target) {
      await interaction.reply(arenaMenuPayload(interaction.user.id));
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const err = await sendChallenge(client, interaction, target, interaction.options.getMember("membre")?.displayName ?? target.username, mise);
    await interaction.editReply({ content: err ? `❌ ${err}` : `✅ Défi envoyé dans ${chan("arene")} !` });
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "arene") {
    await interaction.reply(arenaMenuPayload(interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "marche") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await marketPayload(interaction.user));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "echange") {
    const target = interaction.options.getUser("membre");
    if (!target || target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ Choisissez un autre membre (pas vous-même, ni un bot).", ephemeral: true });
      return true;
    }
    const sen = (await seniorityError(interaction.user.id)) ?? (await seniorityError(target.id, interaction.options.getMember("membre")?.displayName ?? target.username));
    if (sen) {
      await interaction.reply({ content: sen, ephemeral: true });
      return true;
    }
    const d = newDraft(interaction.user, target, interaction.member?.displayName, interaction.options.getMember("membre")?.displayName);
    drafts.set(interaction.user.id, d);
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await draftPayload(d));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "album") {
    const target = interaction.options.getUser("membre") ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: "❌ Les bots ne collectionnent pas de cartes.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await albumPayload(target, target.id === interaction.user.id));
    return true;
  }
  if (interaction.isChatInputCommand?.() && interaction.commandName === "inventaire") {
    const target = interaction.options.getUser("membre") ?? interaction.user;
    if (target.bot) {
      await interaction.reply({ content: "❌ Les bots ne collectionnent pas de cartes.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await inventoryPayload(target, target.id === interaction.user.id));
    return true;
  }
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_")) return false;
  const userId = interaction.user.id;
  load();

  // --- Succès et vitrine ---
  if (id === "carte_succ") {
    await interaction.reply(achievementsPayload(userId));
    return true;
  }
  if (id === "carte_succ_titre") {
    achOf(userId).title = interaction.values[0];
    save();
    await interaction.update(achievementsPayload(userId));
    return true;
  }
  if (id === "carte_vit") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await showcasePayload(interaction.user, true));
    return true;
  }
  if (id === "carte_vit_set") {
    load().showcase[userId] = interaction.values.slice(0, 3);
    save();
    await interaction.deferUpdate();
    await interaction.editReply(await showcasePayload(interaction.user, true));
    return true;
  }
  if (id === "carte_vit_show") {
    await interaction.deferReply({ ephemeral: true });
    const payload = await showcasePayload(interaction.user, false);
    const sent = await chan("discussion")?.send({ content: `🖼️ ${interaction.user} présente sa vitrine :`, ...payload, allowedMentions: { parse: [] } }).catch(() => null);
    deleteLater(sent, MINUTE);
    await interaction.editReply({ content: sent ? `✅ Votre vitrine est affichée dans ${chan("discussion")}.` : "❌ Impossible de publier la vitrine." });
    return true;
  }

  // --- Codex ---
  if (id === "carte_cx") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await codexPayload(interaction.user));
    return true;
  }
  if (["carte_cx_f", "carte_cx_s", "carte_cx_r", "carte_cx_prev", "carte_cx_next"].includes(id)) {
    const view = codexView(userId);
    if (id === "carte_cx_f") view.filter = interaction.values[0];
    if (id === "carte_cx_s") view.series = interaction.values[0];
    if (id === "carte_cx_r") view.rarity = interaction.values[0];
    if (id === "carte_cx_prev") view.page--;
    else if (id === "carte_cx_next") view.page++;
    else view.page = 0;
    await interaction.deferUpdate();
    await interaction.editReply(await codexPayload(interaction.user));
    return true;
  }

  // --- Quêtes et guide ---
  if (id === "carte_qt") {
    await interaction.reply(questsPayload(userId));
    return true;
  }
  if (id === "carte_qt_claim") {
    const r = claimQuests(userId);
    await interaction.update({
      ...questsPayload(userId),
      content: r.n ? `🎁 **${r.n}** quête(s) réclamée(s) : +**${r.dust} ✨** et **${formatEuro(r.money)}**${r.bonus ? " · 🎉 bonus : **1 booster Standard** ajouté à votre inventaire !" : ""}` : "Rien à réclamer pour le moment.",
    });
    return true;
  }
  if (id === "carte_aide") {
    await interaction.update(guidePayload(interaction.values[0]));
    return true;
  }
  if (id === "carte_aide_open") {
    await interaction.reply(guidePayload());
    return true;
  }

  // --- Arène ---
  if (id === "carte_bt") {
    await interaction.reply(arenaMenuPayload(userId));
    return true;
  }
  if (id === "carte_bt_rules") {
    await interaction.reply({ embeds: [RULES_EMBED()], ephemeral: true });
    return true;
  }
  if (id === "carte_bt_pick") {
    const target = interaction.users.first();
    const err = await sendChallenge(client, interaction, target, interaction.members?.first()?.displayName ?? target?.username ?? "?", 0);
    await interaction.update({ content: err ? `❌ ${err}` : `✅ Défi envoyé dans ${chan("arene")} !`, embeds: [], components: [] });
    return true;
  }
  if (id === "carte_bt_ai") {
    if (userBattle.has(userId)) {
      await interaction.reply({ content: "❌ Vous êtes déjà en combat.", ephemeral: true });
      return true;
    }
    if (!ownedKeys(userId).length) {
      await interaction.reply({ content: "❌ Il vous faut au moins une carte pour combattre.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const b = await startBattle(client, { user: interaction.user, name: interaction.member?.displayName ?? interaction.user.username }, { user: client.user, name: "La Maison", isAI: true }, {});
    await interaction.editReply({ content: b ? `⚔️ Combat contre la Maison : ${b.message.url}` : "❌ Impossible de lancer le combat." });
    return true;
  }
  const chAction = /^carte_bt_(ok|no|x)_(\w+)$/.exec(id);
  if (chAction) {
    const [, action, cid] = chAction;
    const ch = challenges.get(cid);
    if (!ch) {
      await interaction.reply({ content: "ℹ️ Ce défi n'est plus valable.", ephemeral: true });
      return true;
    }
    if ((action === "ok" || action === "no") && userId !== ch.to.id) {
      await interaction.reply({ content: `⛔ Seul(e) **${ch.toName}** peut répondre à ce défi.`, ephemeral: true });
      return true;
    }
    if (action === "x" && userId !== ch.from.id) {
      await interaction.reply({ content: `⛔ Seul(e) **${ch.fromName}** peut annuler son défi.`, ephemeral: true });
      return true;
    }
    if (action !== "ok") {
      challenges.delete(cid);
      await interaction.update({ content: action === "no" ? `✖️ **${ch.toName}** refuse le défi de **${ch.fromName}**.` : `🗑️ **${ch.fromName}** annule son défi.`, embeds: [], components: [] });
      deleteLater(interaction.message, MINUTE);
      return true;
    }
    if (userBattle.has(ch.from.id) || userBattle.has(ch.to.id)) {
      await interaction.reply({ content: "❌ L'un des deux joueurs est déjà en combat.", ephemeral: true });
      return true;
    }
    if (ch.mise) {
      if (changeBalance(ch.from.id, -ch.mise, `Mise de combat contre ${ch.toName}`) === null) {
        await interaction.reply({ content: `❌ ${ch.fromName} n'a plus assez d'argent pour la mise.`, ephemeral: true });
        return true;
      }
      if (changeBalance(ch.to.id, -ch.mise, `Mise de combat contre ${ch.fromName}`) === null) {
        changeBalance(ch.from.id, ch.mise, "Mise de combat remboursée", { force: true });
        await interaction.reply({ content: `❌ Il vous faut ${formatEuro(ch.mise)} pour accepter (ou votre compte est gelé).`, ephemeral: true });
        return true;
      }
    }
    challenges.delete(cid);
    await interaction.deferUpdate();
    const b = await startBattle(client, { user: ch.from, name: ch.fromName }, { user: ch.to, name: ch.toName }, { mise: ch.mise });
    await interaction.editReply({ content: b ? `⚔️ **${ch.toName}** relève le défi de **${ch.fromName}** ! Suivez le combat en direct : ${b.message.url}` : "❌ Le combat n'a pas pu commencer (mises remboursées).", embeds: [], components: [] });
    deleteLater(interaction.message, MINUTE);
    return true;
  }
  const bt = /^carte_bt_(team|auto|ts|a|sw|bet|bf|ff)_([a-z0-9]+)(?:_(\w+))?$/.exec(id);
  if (bt) {
    const [, kind, bid, arg] = bt;
    const b = battles.get(bid);
    if (!b) {
      await interaction.reply({ content: "ℹ️ Ce combat est terminé.", ephemeral: true });
      return true;
    }
    const pi = b.players.findIndex((p) => p.id === userId && !p.isAI);
    const me = b.players[pi];
    // paris des spectateurs
    if (kind === "bet" || kind === "bf") {
      const side = Number(arg);
      if (pi >= 0) {
        await interaction.reply({ content: "⛔ Les joueurs ne peuvent pas parier sur leur propre combat.", ephemeral: true });
        return true;
      }
      if (b.round > BET_ROUNDS || b.phase === "over") {
        await interaction.reply({ content: "🔒 Les paris sont fermés.", ephemeral: true });
        return true;
      }
      if (kind === "bet") {
        const sen = await seniorityError(userId);
        if (sen) {
          await interaction.reply({ content: sen, ephemeral: true });
          return true;
        }
        await interaction.showModal(
          new ModalBuilder()
            .setCustomId(`carte_bt_bf_${bid}_${side}`)
            .setTitle(`Parier sur ${b.players[side].name}`.slice(0, 45))
            .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mise").setLabel("Montant du pari (100 € minimum)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)))
        );
        return true;
      }
      const amount = parseAmount(interaction.fields.getTextInputValue("mise"));
      if (!Number.isFinite(amount) || amount < 100 || amount > 1000000) {
        await interaction.reply({ content: "❌ Pari invalide : entre 100 € et 1 000 000 €.", ephemeral: true });
        return true;
      }
      if (b.bets.some((x) => x.userId === userId && x.side !== side)) {
        await interaction.reply({ content: "❌ Vous avez déjà parié sur l'autre joueur.", ephemeral: true });
        return true;
      }
      if (changeBalance(userId, -amount, `Pari sur le combat ${b.players[0].name} contre ${b.players[1].name}`) === null) {
        await interaction.reply({ content: `❌ Fonds insuffisants (vous avez ${formatEuro(readBalance(userId))}), ou compte gelé.`, ephemeral: true });
        return true;
      }
      b.bets.push({ userId, side, amount });
      bump("betsVolume", amount);
      escrow(b);
      await interaction.reply({ content: `🎟️ Pari de **${formatEuro(amount)}** sur **${b.players[side].name}** enregistré. Gains partagés entre les parieurs gagnants (commission de ${Math.round(ARENA_FEE * 100)} %).`, ephemeral: true });
      return true;
    }
    if (pi < 0) {
      await interaction.reply({ content: "👀 Vous êtes spectateur de ce combat : regardez, ou pariez pendant les premières manches !", ephemeral: true });
      return true;
    }
    if (kind === "ff") {
      await interaction.reply({ content: "🏳️ Vous abandonnez le combat.", ephemeral: true });
      if (b.phase === "team" && !b.round) await finishBattle(client, b, 1 - pi, "abandon");
      else await finishBattle(client, b, 1 - pi, "abandon");
      return true;
    }
    // composition de l'équipe
    if (kind === "team" || kind === "auto" || kind === "ts") {
      if (b.phase !== "team") {
        await interaction.reply({ content: "ℹ️ Le combat a déjà commencé.", ephemeral: true });
        return true;
      }
      if (kind === "team") {
        const seen = new Set();
        const options = ownedKeys(userId)
          .map(([k]) => k)
          .sort((x, y) => fighterPower(y) - fighterPower(x))
          .filter((k) => !seen.has(k.replace("*", "")) && seen.add(k.replace("*", "")))
          .slice(0, 25)
          .map((k) => {
            const f = fighter(k);
            return { label: keyLabel(k).slice(0, 100), value: k, emoji: RARITIES[f.card.rarity].emoji, description: `${f.maxHp} PV · attaque ${f.attackDmg} · spécial ${f.specialDmg} · ${SERIES_LABELS[f.series].replace(/^\S+ /, "")}`.slice(0, 100) };
          });
        await interaction.reply({
          ephemeral: true,
          content: "🃏 Choisissez **jusqu'à 3 cartes** (la première entre en premier dans l'arène). Les plus fortes sont en haut de la liste.",
          components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`carte_bt_ts_${bid}`).setPlaceholder("Mon équipe…").setMinValues(1).setMaxValues(Math.min(3, options.length)).addOptions(options))],
        });
        return true;
      }
      const keys = kind === "auto" ? bestTeam(userId) : interaction.values;
      if (!keys.length) {
        await interaction.reply({ content: "❌ Vous n'avez aucune carte.", ephemeral: true });
        return true;
      }
      const confirm = `✅ Équipe prête : ${keys.map(keyLabel).join(", ")}`;
      if (kind === "ts") await interaction.update({ content: confirm, components: [] });
      else await interaction.reply({ content: confirm, ephemeral: true });
      await setTeam(client, b, pi, keys);
      return true;
    }
    // actions de la manche
    if (b.phase !== "choose") {
      await interaction.reply({ content: "⏳ La manche est en cours de résolution, patientez…", ephemeral: true });
      return true;
    }
    if (kind === "sw") {
      const to = Number(interaction.values[0]);
      if (!(me.team[to]?.hp > 0) || to === me.active) {
        await interaction.update({ content: "❌ Cette carte ne peut pas entrer.", components: [] });
        return true;
      }
      me.choice = { type: "switch", to };
      await interaction.update({ content: `🔒 Choix verrouillé : **changer** pour **${me.team[to].name}**. L'adversaire ne le voit pas.`, components: [] });
    } else {
      const action = arg;
      if (!ACTIONS[action]) return false;
      if (action === "special" && me.energy < SPECIAL_COST) {
        await interaction.reply({ content: `⚡ Il faut ${SPECIAL_COST} énergies pour le spécial (vous en avez ${me.energy}).`, ephemeral: true });
        return true;
      }
      if (action === "switch") {
        const bench = aliveBench(me);
        if (!bench.length) {
          await interaction.reply({ content: "❌ Aucune autre carte disponible.", ephemeral: true });
          return true;
        }
        await interaction.reply({
          ephemeral: true,
          content: "🔄 Quelle carte envoyer dans l'arène ?",
          components: [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId(`carte_bt_sw_${bid}`)
                .setPlaceholder("Carte remplaçante…")
                .addOptions(bench.map(({ f, i }) => ({ label: f.name.slice(0, 100), value: String(i), emoji: RARITIES[f.card.rarity].emoji, description: `${f.hp} / ${f.maxHp} PV · attaque ${f.attackDmg} · spécial ${f.specialDmg}` })))
            ),
          ],
        });
        return true;
      }
      me.choice = { type: action };
      const f = activeOf(me);
      await interaction.reply({ content: `🔒 Choix verrouillé : **${ACTIONS[action].label}${action === "special" ? ` — ${f.special}` : ""}**. L'adversaire ne le voit pas.`, ephemeral: true });
    }
    if (b.players.every((p) => p.choice)) resolveRound(client, b).catch((err) => console.error("Combat:", err.message));
    else b.message.edit(await livePayload(b)).catch(() => null);
    return true;
  }

  // --- Marché ---
  if (id === "carte_mk") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await marketPayload(interaction.user));
    return true;
  }
  if (["carte_mk_series", "carte_mk_rarity", "carte_mk_sort", "carte_mk_prev", "carte_mk_next"].includes(id)) {
    const view = mkView(userId);
    if (id === "carte_mk_series") view.series = interaction.values[0];
    if (id === "carte_mk_rarity") view.rarity = interaction.values[0];
    if (id === "carte_mk_sort") view.sort = interaction.values[0];
    if (id === "carte_mk_prev") view.page--;
    else if (id === "carte_mk_next") view.page++;
    else view.page = 0;
    await interaction.deferUpdate();
    await interaction.editReply(await marketPayload(interaction.user));
    return true;
  }
  if (id === "carte_mk_buy" || id === "carte_mk_sell" || id === "carte_mk_sc" || id.startsWith("carte_mk_sellkey_")) {
    const sen = await seniorityError(userId);
    if (sen) {
      await interaction.reply({ content: sen, ephemeral: true });
      return true;
    }
  }
  if (id === "carte_mk_buy") {
    const l = load().market.find((x) => x.id === interaction.values[0]);
    if (!l) {
      await interaction.reply({ content: "❌ Cette annonce n'existe plus.", ephemeral: true });
      return true;
    }
    if (l.seller === userId) {
      await interaction.reply({ content: "ℹ️ C'est votre propre annonce. Vous pouvez la retirer depuis **Mes annonces**.", ephemeral: true });
      return true;
    }
    const card = cardOfKey(l.key), cote = coteOf(l.key), diff = Math.round((l.price / cote - 1) * 100);
    await interaction.deferReply({ ephemeral: true });
    const file = await cardFile(card, isHoloKey(l.key));
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16))
          .setTitle(`🛒 Acheter ${keyLabel(l.key)} ?`)
          .setDescription(
            `**Prix : ${formatEuro(l.price)}**\n` +
              `Cote : ${formatEuro(cote)} (${diff > 0 ? "+" : ""}${diff} %${diff <= -20 ? " · bonne affaire !" : ""}) · ${trendText(coteTrend(l.key))}\n` +
              `En circulation : **${circulation(l.key)}** exemplaire${circulation(l.key) > 1 ? "s" : ""} (moyenne des cartes ${RARITIES[card.rarity].name.toLowerCase()}s : ${avgCirculation(card.rarity, isHoloKey(l.key)).toFixed(1).replace(".", ",")})\n` +
              `Rareté : ${RARITIES[card.rarity].emoji} ${RARITIES[card.rarity].name}${isHoloKey(l.key) ? " ✦ holo" : ""}\n` +
              `Vendeur : ${l.sellerName} · mise en vente ${ago(l.at)}\n\n` +
              `Votre solde : **${formatEuro(readBalance(userId))}**${ownedIds(userId).has(card.id) ? "\n*Vous avez déjà cette carte : ce sera un doublon.*" : ""}`
          )
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_mk_ok_${l.id}`).setLabel(`Confirmer l'achat (${canvasText(formatEuro(l.price))})`).setEmoji("✅").setStyle(ButtonStyle.Success))],
    });
    return true;
  }
  if (id.startsWith("carte_mk_ok_")) {
    const s = load();
    const idx = s.market.findIndex((x) => x.id === id.slice("carte_mk_ok_".length));
    if (idx < 0) {
      await interaction.update({ content: "❌ Trop tard : cette annonce a été vendue ou retirée.", embeds: [], components: [], attachments: [] });
      return true;
    }
    const l = s.market[idx], card = cardOfKey(l.key), coteBefore = coteOf(l.key);
    if (l.seller === userId) return true;
    if (changeBalance(userId, -l.price, `Achat au marché des cartes : ${keyLabel(l.key)}`) === null) {
      await interaction.reply({ content: `❌ Il vous faut **${formatEuro(l.price)}** (vous avez ${formatEuro(readBalance(userId))}), ou votre compte est gelé.`, ephemeral: true });
      return true;
    }
    s.market.splice(idx, 1);
    const fee = Math.round(l.price * MARKET_FEE), net = l.price - fee;
    changeBalance(l.seller, net, `Vente au marché des cartes : ${keyLabel(l.key)}`, { force: true });
    const inv = (s.inv[userId] ??= {});
    inv[l.key] = (inv[l.key] ?? 0) + 1;
    s.sales.push({ key: l.key, price: l.price, at: Date.now(), seller: l.seller, buyer: userId });
    bump("marketVolume", l.price);
    bump("marketFees", fee);
    questProgress(userId, "market");
    ustat(l.seller, "sales");
    checkAchievements(l.seller).catch(() => null);
    pairAlert(userId, l.seller, "achats au marché", `${keyLabel(l.key)} pour ${formatEuro(l.price)}`).catch(() => null);
    cheapSaleAlert(l, userId, coteBefore).catch(() => null);
    if (s.sales.length > 300) s.sales.splice(0, s.sales.length - 300);
    save();
    await interaction.update({
      content: null,
      embeds: [new EmbedBuilder().setColor(0x16a34a).setTitle("✅ Achat réussi").setDescription(`**${keyLabel(l.key)}** rejoint votre album pour **${formatEuro(l.price)}**.\nNouveau solde : ${formatEuro(readBalance(userId))}`)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_mk").setLabel("Retour au marché").setEmoji("🏪").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId("carte_album").setLabel("Album").setEmoji("📒").setStyle(ButtonStyle.Secondary))],
      attachments: [],
    });
    const buyerName = interaction.member?.displayName ?? interaction.user.username;
    client.users
      .fetch(l.seller)
      .then((u) => u.send(`💰 Votre carte **${keyLabel(l.key)}** a été achetée par **${buyerName}** pour **${formatEuro(l.price)}**. Vous recevez **${formatEuro(net)}** après la commission de ${Math.round(MARKET_FEE * 100)} %.`))
      .catch(() => null);
    require("./logs")
      .sendLogEmbed("achats", new EmbedBuilder().setColor(0xe9c46a).setTitle("🏪 Vente au marché des cartes").setDescription(`${keyLabel(l.key)} — ${formatEuro(l.price)}\nVendeur : <@${l.seller}> (reçoit ${formatEuro(net)})\nAcheteur : <@${userId}>`).setTimestamp())
      .catch(() => null);
    if (ORDER.indexOf(card.rarity) >= ORDER.indexOf("legendaire") || l.price >= 20000) {
      const msg = await chan("marche")?.send({ content: `🏪 **Grosse vente au marché !** ${RARITIES[card.rarity].emoji} **${keyLabel(l.key)}** vient de partir pour **${formatEuro(l.price)}**.`, allowedMentions: { parse: [] } }).catch(() => null);
      deleteLater(msg, MINUTE);
    }
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }
  if (id === "carte_mk_sell") {
    await interaction.reply({ ...sellPickerPayload(userId), ephemeral: true });
    return true;
  }
  if (id === "carte_mk_ss") {
    await interaction.update(sellPickerPayload(userId, interaction.values[0]));
    return true;
  }
  if (id === "carte_mk_sc" || id.startsWith("carte_mk_sellkey_")) {
    const key = id === "carte_mk_sc" ? interaction.values[0] : id.slice("carte_mk_sellkey_".length);
    if (!load().inv[userId]?.[key]) {
      await interaction.reply({ content: "❌ Vous n'avez pas (ou plus) cette carte.", ephemeral: true });
      return true;
    }
    if (load().market.filter((l) => l.seller === userId).length >= MARKET_MAX) {
      await interaction.reply({ content: `❌ Vous avez déjà ${MARKET_MAX} annonces en cours. Retirez-en une depuis **Mes annonces**.`, ephemeral: true });
      return true;
    }
    await interaction.showModal(priceModal(key));
    return true;
  }
  if (id.startsWith("carte_mk_pf_")) {
    const key = id.slice("carte_mk_pf_".length), card = cardOfKey(key);
    const price = parseAmount(interaction.fields.getTextInputValue("prix"));
    if (!card || !Number.isFinite(price) || price < 10 || price > 100000000) {
      await interaction.reply({ content: "❌ Prix invalide : entrez un montant entre 10 € et 100 000 000 €.", ephemeral: true });
      return true;
    }
    if (load().market.filter((l) => l.seller === userId).length >= MARKET_MAX) {
      await interaction.reply({ content: `❌ Vous avez déjà ${MARKET_MAX} annonces en cours.`, ephemeral: true });
      return true;
    }
    if (!moveKey(userId, null, key)) {
      await interaction.reply({ content: "❌ Vous n'avez plus cette carte (ou elle défend votre île).", ephemeral: true });
      return true;
    }
    const listing = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), seller: userId, sellerName: interaction.member?.displayName ?? interaction.user.username, key, price, at: Date.now() };
    load().market.push(listing);
    questProgress(userId, "market");
    save();
    await interaction.deferReply({ ephemeral: true });
    const cote = coteOf(key), file = await cardFile(card, isHoloKey(key));
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle(`💰 ${keyLabel(key)} est en vente`)
          .setDescription(
            `**Prix : ${formatEuro(price)}** (cote ${formatEuro(cote)})\n` +
              `Vous recevrez **${formatEuro(price - Math.round(price * MARKET_FEE))}** après la commission de ${Math.round(MARKET_FEE * 100)} %.\n` +
              `L'annonce reste ${MARKET_DAYS} jours ; sans acheteur, la carte revient dans votre album.`
          )
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_mk").setLabel("Voir le marché").setEmoji("🏪").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("carte_mk_mine").setLabel("Mes annonces").setEmoji("📋").setStyle(ButtonStyle.Secondary))],
    });
    panelDirty = true;
    return true;
  }
  if (id === "carte_mk_mine") {
    const mine = load().market.filter((l) => l.seller === userId).sort((a, b) => b.at - a.at);
    const lines = mine.map((l) => {
      const left = Math.max(0, Math.ceil((l.at + MARKET_DAYS * 86400000 - Date.now()) / 86400000));
      return `${RARITIES[cardOfKey(l.key).rarity].emoji} **${keyLabel(l.key)}** — ${formatEuro(l.price)} · ${ago(l.at)} · expire dans ${left} j`;
    });
    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(0xe9c46a).setTitle(`📋 Mes annonces (${mine.length}/${MARKET_MAX})`).setDescription(lines.join("\n") || "*Aucune annonce en cours.*")],
      components: mine.length
        ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_mk_cancel").setPlaceholder("↩️ Retirer une annonce…").addOptions(mine.slice(0, 25).map((l) => ({ label: keyLabel(l.key).slice(0, 100), value: l.id, description: formatEuro(l.price).slice(0, 100), emoji: RARITIES[cardOfKey(l.key).rarity].emoji }))))]
        : [],
    });
    return true;
  }
  if (id === "carte_mk_cancel") {
    const s = load();
    const idx = s.market.findIndex((l) => l.id === interaction.values[0] && l.seller === userId);
    if (idx < 0) {
      await interaction.update({ content: "❌ Cette annonce n'existe plus (déjà vendue ?).", embeds: [], components: [] });
      return true;
    }
    const [l] = s.market.splice(idx, 1);
    const inv = (s.inv[userId] ??= {});
    inv[l.key] = (inv[l.key] ?? 0) + 1;
    save();
    await interaction.update({ content: `↩️ **${keyLabel(l.key)}** est retirée du marché et revient dans votre album.`, embeds: [], components: [] });
    panelDirty = true;
    return true;
  }

  // --- Échanges ---
  if (id === "carte_tr") {
    await interaction.reply({
      ephemeral: true,
      content: "🔄 Avec qui voulez-vous échanger des cartes ?",
      components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("carte_tr_pick").setPlaceholder("Choisir un membre…"))],
    });
    return true;
  }
  if (id === "carte_tr_pick") {
    const target = interaction.users.first();
    if (!target || target.bot || target.id === userId) {
      await interaction.update({ content: "❌ Choisissez un autre membre (pas vous-même, ni un bot).", components: interaction.message.components });
      return true;
    }
    const sen = (await seniorityError(userId)) ?? (await seniorityError(target.id, interaction.members?.first()?.displayName ?? target.username));
    if (sen) {
      await interaction.update({ content: sen, components: [] });
      return true;
    }
    const d = newDraft(interaction.user, target, interaction.member?.displayName, interaction.members?.first()?.displayName);
    drafts.set(userId, d);
    await interaction.deferUpdate();
    await interaction.editReply({ content: null, ...(await draftPayload(d)) });
    return true;
  }
  if (["carte_tr_gf", "carte_tr_tf", "carte_tr_give", "carte_tr_take", "carte_tr_money", "carte_tr_mf", "carte_tr_send", "carte_tr_cancel"].includes(id)) {
    const d = drafts.get(userId);
    if (!d) {
      await interaction.reply({ content: "⌛ Ce brouillon d'échange a expiré. Relancez `/echange`.", ephemeral: true });
      return true;
    }
    if (id === "carte_tr_cancel") {
      drafts.delete(userId);
      await interaction.update({ content: "🗑️ Échange abandonné.", embeds: [], components: [], attachments: [] });
      return true;
    }
    if (id === "carte_tr_money") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("carte_tr_mf")
          .setTitle("Argent dans l'échange")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("give").setLabel("Argent que vous donnez (€)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(12).setValue(d.giveMoney ? String(d.giveMoney) : "")),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("take").setLabel(`Argent que vous demandez à ${d.toName}`.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(12).setValue(d.takeMoney ? String(d.takeMoney) : ""))
          )
      );
      return true;
    }
    if (id === "carte_tr_mf") {
      const give = parseAmount(interaction.fields.getTextInputValue("give") || "0"), take = parseAmount(interaction.fields.getTextInputValue("take") || "0");
      if (![give, take].every((v) => Number.isFinite(v) && v >= 0 && v <= 100000000)) {
        await interaction.reply({ content: "❌ Montant invalide (entre 0 et 100 000 000 €).", ephemeral: true });
        return true;
      }
      if (give > readBalance(userId)) {
        await interaction.reply({ content: `❌ Vous n'avez que ${formatEuro(readBalance(userId))}.`, ephemeral: true });
        return true;
      }
      d.giveMoney = give;
      d.takeMoney = take;
    }
    if (id === "carte_tr_gf") d.gf = interaction.values[0];
    if (id === "carte_tr_tf") d.tf = interaction.values[0];
    if (id === "carte_tr_give") d.give = mergeSelection(d.give, ownedKeys(d.from, d.gf).slice(0, 25).map(([k]) => k), interaction.values);
    if (id === "carte_tr_take") d.take = mergeSelection(d.take, ownedKeys(d.to, d.tf).slice(0, 25).map(([k]) => k), interaction.values);
    if (id === "carte_tr_send") {
      const problem = tradeProblem(d);
      if (problem || !channelRef) {
        await interaction.reply({ content: `❌ ${problem ?? "Le salon des cartes est introuvable."}`, ephemeral: true });
        return true;
      }
      await interaction.deferUpdate();
      const tid = Date.now().toString(36);
      const tr = { ...d, id: tid, status: "pending", at: Date.now() };
      delete tr.gf;
      delete tr.tf;
      load().trades[tid] = tr;
      save();
      const msg = await chan("echanges")
        .send({ content: `🔄 <@${tr.to}>, **${tr.fromName}** vous propose un échange de cartes !`, embeds: [tradeEmbed(tr)], files: [await tradeImage(tr)], components: [tradeButtons(tid)], allowedMentions: { users: [tr.to] } })
        .catch(() => null);
      if (!msg) {
        delete load().trades[tid];
        save();
        await interaction.editReply({ content: "❌ Impossible de publier la proposition.", embeds: [], components: [], attachments: [] });
        return true;
      }
      tr.messageId = msg.id;
      tr.channelId = msg.channel?.id ?? msg.channelId;
      save();
      drafts.delete(userId);
      client.users.fetch(tr.to).then((u) => u.send(`📬 **${tr.fromName}** vous propose un échange de cartes : ${msg.url}`)).catch(() => null);
      await interaction.editReply({ content: `✅ Proposition envoyée dans ${chan("echanges")} ! ${tr.toName} a ${TRADE_HOURS} h pour répondre.`, embeds: [], components: [], attachments: [] });
      return true;
    }
    await interaction.deferUpdate();
    await interaction.editReply(await draftPayload(d));
    return true;
  }
  const trAction = /^carte_tr_(ok|no|x)_(\w+)$/.exec(id);
  if (trAction) {
    const [, action, tid] = trAction;
    const tr = load().trades[tid];
    if (!tr || tr.status !== "pending") {
      await interaction.reply({ content: "ℹ️ Cette proposition n'est plus active.", ephemeral: true });
      return true;
    }
    if (Date.now() > tr.at + TRADE_HOURS * 3600000) {
      await interaction.deferUpdate();
      await closeTrade(tid, "expired");
      return true;
    }
    if ((action === "ok" || action === "no") && userId !== tr.to) {
      await interaction.reply({ content: `⛔ Seul(e) **${tr.toName}** peut répondre à cette proposition.`, ephemeral: true });
      return true;
    }
    if (action === "x" && userId !== tr.from) {
      await interaction.reply({ content: `⛔ Seul(e) **${tr.fromName}** peut annuler sa proposition.`, ephemeral: true });
      return true;
    }
    await interaction.deferUpdate();
    if (action !== "ok") {
      tr.status = action === "no" ? "refused" : "cancelled";
      save();
      await interaction.editReply({ embeds: [tradeEmbed(tr)], files: [await tradeImage(tr)], components: [] });
      deleteLater(interaction.message, MINUTE);
      return true;
    }
    let problem = tradeProblem(tr);
    const label = `Échange de cartes entre ${tr.fromName} et ${tr.toName}`;
    if (!problem && tr.giveMoney) {
      if (changeBalance(tr.from, -tr.giveMoney, label) === null) problem = `${tr.fromName} ne peut pas payer (compte gelé ou fonds insuffisants).`;
      else changeBalance(tr.to, tr.giveMoney, label, { force: true });
    }
    if (!problem && tr.takeMoney) {
      if (changeBalance(tr.to, -tr.takeMoney, label) === null) {
        problem = `${tr.toName} ne peut pas payer (compte gelé ou fonds insuffisants).`;
        if (tr.giveMoney) {
          changeBalance(tr.to, -tr.giveMoney, `${label} (annulé)`, { force: true });
          changeBalance(tr.from, tr.giveMoney, `${label} (annulé)`, { force: true });
        }
      } else changeBalance(tr.from, tr.takeMoney, label, { force: true });
    }
    if (problem) {
      tr.status = "failed";
      save();
      await interaction.editReply({ embeds: [tradeEmbed(tr, `⚠️ ${problem}`)], files: [await tradeImage(tr)], components: [] });
      deleteLater(interaction.message, MINUTE);
      return true;
    }
    for (const k of tr.give) moveKey(tr.from, tr.to, k);
    for (const k of tr.take) moveKey(tr.to, tr.from, k);
    tr.status = "done";
    bump("trades");
    questProgress(tr.from, "trade");
    questProgress(tr.to, "trade");
    ustat(tr.from, "trades");
    ustat(tr.to, "trades");
    pairAlert(tr.from, tr.to, "échanges", `${tr.give.map(keyLabel).join(", ") || "rien"} contre ${tr.take.map(keyLabel).join(", ") || "rien"}`).catch(() => null);
    tr.doneAt = Date.now();
    save();
    await interaction.editReply({ content: `🤝 Échange conclu entre <@${tr.from}> et <@${tr.to}> !`, embeds: [tradeEmbed(tr)], files: [await tradeImage(tr)], components: [], allowedMentions: { parse: [] } });
    deleteLater(interaction.message, MINUTE);
    require("./logs")
      .sendLogEmbed("achats", new EmbedBuilder().setColor(0x16a34a).setTitle("🔄 Échange de cartes conclu").setDescription(`<@${tr.from}> donne : ${tr.give.map(keyLabel).join(", ") || "rien"}${tr.giveMoney ? ` + ${formatEuro(tr.giveMoney)}` : ""}\n<@${tr.to}> donne : ${tr.take.map(keyLabel).join(", ") || "rien"}${tr.takeMoney ? ` + ${formatEuro(tr.takeMoney)}` : ""}`).setTimestamp())
      .catch(() => null);
    await checkSeriesRewards(client, tr.from);
    await checkSeriesRewards(client, tr.to);
    panelDirty = true;
    return true;
  }

  // Achat d'un ou plusieurs boosters : ils vont dans l'inventaire
  const buy = /^carte_(?:booster|buy)_(standard|premium|prestige|frisson|givre)(?:_(\d+))?$/.exec(id);
  if (buy) {
    const type = buy[1], P = PACKS[type];
    let n = Math.min(10, Math.max(1, Number(buy[2] ?? 1)));
    if (P.season && activeSeason() !== P.season) {
      await interaction.reply({ content: `${P.emoji} Le booster ${P.name} n'est vendu que pendant ${SEASONAL[P.season].name} (${SEASONAL[P.season].dates}).`, ephemeral: true });
      return true;
    }
    const stock = stockCheck(userId, type, n);
    if (stock.error) {
      await interaction.reply({ content: stock.error, ephemeral: true });
      return true;
    }
    n = stock.n;
    const price = boosterPrice(type) * n;
    if (changeBalance(userId, -price, `Achat de ${n} booster(s) de cartes ${P.name} (${GENERATIONS[CURRENT_GEN].code})`) === null) {
      await interaction.reply({ content: `❌ ${n > 1 ? `${n} boosters` : "Le booster"} ${P.name} coûte${n > 1 ? "nt" : ""} **${formatEuro(price)}** (vous avez ${formatEuro(readBalance(userId))}), ou votre compte est gelé.`, ephemeral: true });
      return true;
    }
    const key = packKey(CURRENT_GEN, type);
    takeStock(userId, type, n);
    if (stockOf(type) === 0) announceSoldOut(type).catch(() => null);
    addPacks(userId, key, n);
    bump("boosterSpend", price);
    await interaction.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(await packShineGif(CURRENT_GEN, type), { name: "booster.gif" });
    const G = GENERATIONS[CURRENT_GEN];
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(P.accent.slice(1), 16))
          .setTitle(`${P.emoji} ${n > 1 ? `${n} boosters ${P.name} ajoutés` : `Booster ${P.name} ajouté`} à votre inventaire`)
          .setDescription(`**${G.name} — ${G.title}** · ${P.tagline.toLowerCase()}\nVous en avez maintenant **${load().packs[userId]?.[key] ?? 0}** en réserve.${stock.note ? `\n⚠️ Seulement ${n} acheté${n > 1 ? "s" : ""} : ${stock.note}.` : ""}\n🛒 Boutique : ${stockLine(type, userId)}\n\nOuvrez-le maintenant ou gardez-le pour plus tard : quand la génération suivante sortira, ceux-ci ne seront plus vendus.`)
          .setImage("attachment://booster.gif")
          .setFooter({ text: `Payé ${canvasText(formatEuro(price))} · /inventaire pour voir vos boosters` }),
      ],
      files: [file],
      components: [packButtons(type)],
    });
    panelDirty = true;
    refreshRichestLeaderboard(client).catch(() => null);
    return true;
  }

  if (id === "carte_daily") {
    if (!interaction.member?.roles.cache.has(MEMBER_CARD_ROLE_ID)) {
      await interaction.reply({ content: `🎁 Le booster gratuit du jour est réservé aux membres de la Maison (rôle <@&${MEMBER_CARD_ROLE_ID}>).`, ephemeral: true, allowedMentions: { parse: [] } });
      return true;
    }
    const s = load();
    if (s.daily[userId] === dayKey()) {
      await interaction.reply({ content: "🎁 Vous avez déjà récupéré votre booster gratuit aujourd'hui. Revenez demain !", ephemeral: true });
      return true;
    }
    s.daily[userId] = dayKey();
    save();
    addPacks(userId, packKey(CURRENT_GEN, "jour"), 1);
    questProgress(userId, "daily_pack");
    await interaction.deferReply({ ephemeral: true });
    const file = new AttachmentBuilder(await packShineGif(CURRENT_GEN, "jour"), { name: "booster.gif" });
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x34d399)
          .setTitle("🎁 Votre booster gratuit du jour est dans votre inventaire")
          .setDescription(`${lawActive("boosterDouble") ? "**2 cartes** grâce à la loi en vigueur" : "**1 carte**"} à l'ouverture. Ouvrez-le maintenant ou gardez-le pour plus tard.`)
          .setImage("attachment://booster.gif"),
      ],
      files: [file],
      components: [packButtons("jour")],
    });
    panelDirty = true;
    return true;
  }

  // Ouvrir un booster de l'inventaire
  if (id.startsWith("carte_open_") || id === "carte_inv_open") {
    const key = id === "carte_inv_open" ? interaction.values[0] : id.slice("carte_open_".length);
    const pack = parsePack(key);
    if (!pack || !takePack(userId, key)) {
      await interaction.reply({ content: "❌ Vous n'avez plus ce booster dans votre inventaire.", ephemeral: true });
      return true;
    }
    const P = PACKS[pack.type];
    await openBooster(interaction, client, packPulls(pack.gen, pack.type), `${P.emoji} Booster ${P.name} · ${GENERATIONS[pack.gen].code}`, pack);
    panelDirty = true;
    return true;
  }

  if (id === "carte_inv") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await inventoryPayload(interaction.user, true));
    return true;
  }

  if (id === "carte_shop") {
    await interaction.reply(shopPayload(userId));
    return true;
  }

  if (id === "carte_inv_show") {
    await interaction.deferReply({ ephemeral: true });
    const payload = await inventoryPayload(interaction.user, false);
    const sent = await chan("discussion")?.send({ content: `📣 ${interaction.user} montre son inventaire :`, ...payload, allowedMentions: { parse: [] } }).catch(() => null);
    deleteLater(sent, MINUTE);
    await interaction.editReply({ content: sent ? `✅ Votre inventaire est affiché dans ${chan("discussion")}.` : "❌ Impossible de publier l'inventaire pour le moment." });
    return true;
  }

  // Ouverture rapide : jusqu'à 10 boosters d'un coup, avec un récapitulatif
  if (id === "carte_inv_all") {
    const owned = packsOf(userId);
    if (!owned.length) {
      await interaction.reply({ content: "🎒 Vous n'avez aucun booster en réserve.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const opened = {};
    const results = [];
    let total = 0;
    for (const [key, n] of owned) {
      const pack = parsePack(key);
      for (let i = 0; i < n && total < 10; i++) {
        if (!takePack(userId, key)) break;
        total++;
        opened[key] = (opened[key] ?? 0) + 1;
        for (const p of packPulls(pack.gen, pack.type)) results.push({ ...p, isNew: give(userId, p.card, p.holo) });
      }
    }
    questProgress(userId, "open_pack", total);
    ustat(userId, "packs", total);
    for (const p of results) if (p.card.shiny) ustat(userId, "shiny");
    bump("packsOpened", total);
    const counts = ORDER.map((r) => [r, results.filter((p) => p.card.rarity === r).length]).filter(([, n]) => n);
    const best = [...results].sort((a, b) => ORDER.indexOf(b.card.rarity) - ORDER.indexOf(a.card.rarity) || b.holo - a.holo).slice(0, 8);
    const news = results.filter((p) => p.isNew);
    const holos = results.filter((p) => p.holo).length;
    const left = packsOf(userId).reduce((a, [, n]) => a + n, 0);
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xe9c46a)
          .setTitle(`⚡ ${total} booster${total > 1 ? "s" : ""} ouvert${total > 1 ? "s" : ""} — ${results.length} cartes`)
          .setDescription(
            `${counts.map(([r, n]) => `${RARITIES[r].emoji} ${n}`).join(" · ")}${holos ? ` · ✦ ${holos} holo${holos > 1 ? "s" : ""}` : ""}\n\n` +
              `**Ouverts** : ${Object.entries(opened).map(([k, n]) => `${packLabel(k)} ×${n}`).join(", ")}\n` +
              (news.length ? `**🆕 Nouvelles cartes (${news.length})** : ${news.slice(0, 15).map((p) => `${RARITIES[p.card.rarity].emoji} ${p.card.name}${p.holo ? " ✦" : ""}`).join(", ")}${news.length > 15 ? "…" : ""}` : "*Aucune nouvelle carte cette fois.*") +
              (left ? `\n\n🎒 Il vous reste **${left}** booster${left > 1 ? "s" : ""}.` : "")
          )
          .setImage("attachment://booster.png")
          .setFooter({ text: "Les 8 meilleures cartes de l'ouverture" }),
      ],
      files: [await collageFile(best)],
    });
    for (const p of results) if (ORDER.indexOf(p.card.rarity) >= ORDER.indexOf("legendaire")) await announcePull(client, interaction.user, p);
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }

  if (id === "carte_album") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await albumPayload(interaction.user, true));
    return true;
  }

  // ancien menu des séries : ouvre directement la page de la série
  if (id === "carte_series") {
    await interaction.deferUpdate();
    await interaction.editReply(await albumPayload(interaction.user, true, interaction.values[0], 0));
    return true;
  }

  if (id.startsWith("carte_alb_nav_") || /^carte_alb_[^_]+_\w+_-?\d+$/.test(id)) {
    let targetId, view, page = 0;
    if (id.startsWith("carte_alb_nav_")) {
      targetId = id.slice("carte_alb_nav_".length);
      view = interaction.values[0];
    } else {
      const m = /^carte_alb_([^_]+)_(\w+)_(-?\d+)$/.exec(id);
      if (!m) return false;
      [, targetId, view] = m;
      page = Number(m[3]);
    }
    const target = targetId === userId ? interaction.user : await client.users.fetch(targetId).catch(() => null);
    if (!target) return false;
    await interaction.deferUpdate();
    await interaction.editReply(await albumPayload(target, targetId === userId, view, page));
    return true;
  }

  if (id === "carte_view") {
    const card = findCard(interaction.values[0]);
    const holo = Boolean(load().inv[userId]?.[`${card?.id}*`]);
    if (!card) { await interaction.reply({ content: "❌ Carte introuvable.", ephemeral: true }); return true; }
    const file = await cardFile(card, holo);
    await interaction.reply({
      ephemeral: true,
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setTitle(card.name).setImage(`attachment://${file.name}`)],
      files: [file],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`carte_show_${card.id}`).setLabel("Montrer à tout le monde").setEmoji("📣").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`carte_mk_sellkey_${holo ? `${card.id}*` : card.id}`).setLabel("Vendre au marché").setEmoji("💰").setStyle(ButtonStyle.Success)
        ),
      ],
    });
    return true;
  }

  if (id.startsWith("carte_show_")) {
    const card = findCard(id.slice("carte_show_".length));
    if (!card || !ownedIds(userId).has(card.id)) { await interaction.reply({ content: "❌ Vous n'avez pas cette carte.", ephemeral: true }); return true; }
    const holo = Boolean(load().inv[userId]?.[`${card.id}*`]);
    const msg = await chan("discussion")
      ?.send({ content: `📣 ${interaction.user} montre sa carte :`, files: [await cardFile(card, holo)], allowedMentions: { parse: [] } })
      .catch(() => null);
    deleteLater(msg, MINUTE);
    await interaction.update({ components: [] });
    return true;
  }

  if (id === "carte_dust") {
    const inv = load().inv[userId] ?? {};
    const doubles = Object.values(inv).reduce((s, n) => s + Math.max(0, n - 1), 0);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(0x9b59b6)
          .setTitle("✨ Poussière d'étoile")
          .setDescription(
            `Vous avez **${load().dust[userId] ?? 0} ✨** et **${doubles}** doublon(s).\n\n` +
              "**Recycler** : chaque doublon rapporte ⚪ 5 · 🟢 10 · 🔵 25 · 🟣 100 · 🟡 400 · 🔴 1 500 ✨ (×3 si holo).\n" +
              `**Fabriquer** : une carte coûte ${CRAFT_FACTOR} fois sa valeur (une rare : 100 ✨, une légendaire : 1 600 ✨).`
          ),
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("carte_recycle").setLabel("Recycler mes doublons").setEmoji("♻️").setStyle(ButtonStyle.Primary).setDisabled(!doubles),
          new ButtonBuilder().setCustomId("carte_craft").setLabel("Fabriquer une carte").setEmoji("🔨").setStyle(ButtonStyle.Success)
        ),
      ],
    });
    return true;
  }

  if (id === "carte_recycle") {
    const { dust, count } = recycleDuplicates(userId);
    if (count) questProgress(userId, "recycle");
    await interaction.update({ content: `♻️ **${count}** doublon(s) recyclé(s) : +**${dust} ✨** (total ${load().dust[userId]} ✨).`, embeds: [], components: [] });
    return true;
  }

  if (id === "carte_craft") {
    await interaction.update({
      content: "🔨 Dans quelle série fabriquer une carte ?",
      embeds: [],
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_craftseries")
            .setPlaceholder("Choisir une série")
            .addOptions(craftableGroups().map((k) => ({ label: SERIES_LABELS[k].replace(/^\S+ /, ""), value: k, emoji: SERIES_LABELS[k].split(" ")[0] })))
        ),
      ],
    });
    return true;
  }

  if (id === "carte_craftseries") {
    const owned = ownedIds(userId);
    const list = allCards()
      .filter((c) => seriesOf(c) === interaction.values[0])
      .sort((a, b) => Number(owned.has(a.id)) - Number(owned.has(b.id)));
    if (!list.length) { await interaction.update({ content: "Aucune carte dans cette série.", components: [] }); return true; }
    await interaction.update({
      content: `🔨 Quelle carte fabriquer ? (vous avez **${load().dust[userId] ?? 0} ✨**)`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("carte_craftcard")
            .setPlaceholder("Choisir une carte")
            .addOptions(list.slice(0, 25).map((c) => ({ label: `${c.name}${owned.has(c.id) ? " (déjà possédée)" : ""}`.slice(0, 100), value: c.id, emoji: RARITIES[c.rarity].emoji, description: `${craftCost(c)} ✨` })))
        ),
      ],
    });
    return true;
  }

  if (id === "carte_craftcard") {
    const card = findCard(interaction.values[0]);
    const cost = card && craftCost(card);
    const s = load();
    if (!card || (s.dust[userId] ?? 0) < cost) {
      { await interaction.update({ content: `❌ Il faut **${cost ?? "?"} ✨** (vous avez ${s.dust[userId] ?? 0} ✨).`, components: [] }); return true; }
    }
    s.dust[userId] -= cost;
    save();
    give(userId, card, false);
    const file = await cardFile(card, false);
    await interaction.update({
      content: `🔨 Vous avez fabriqué **${card.name}** pour ${cost} ✨ !`,
      components: [],
      embeds: [new EmbedBuilder().setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16)).setImage(`attachment://${file.name}`)],
      files: [file],
    });
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }

  if (id === "carte_member") {
    if (!interaction.member?.roles.cache.has(MEMBER_CARD_ROLE_ID)) {
      await interaction.reply({ content: `👤 Les cartes de membres sont créées automatiquement pour les membres qui ont le rôle <@&${MEMBER_CARD_ROLE_ID}>.`, ephemeral: true, allowedMentions: { parse: [] } });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await cacheMember(interaction.member);
    save();
    const card = memberCards(true).find((c) => c.memberId === userId);
    await interaction.editReply({
      content: `👤 Votre carte de membre : note **${card?.rating ?? "?"}** — ${card ? MEMBER_TIERS[card.rarity]?.name.toLowerCase() : ""}, selon votre rôle le plus haut${card?.role ? ` (**${card.role.name}**)` : ""}. Plus votre rôle est haut, plus votre carte est forte. Elle peut sortir dans les boosters de tout le monde.`,
      files: card ? [await cardFile(card, false)] : [],
    });
    return true;
  }

  if (id.startsWith("carte_wild_")) {
    const w = load().wild;
    if (!w || w.id !== id.slice("carte_wild_".length)) {
      await interaction.reply({ content: "💨 Trop tard, cette carte a déjà été attrapée !", ephemeral: true });
      return true;
    }
    load().wild = null;
    save();
    const card = findCard(w.cardId);
    if (card) give(userId, card, w.holo);
    questProgress(userId, "wild");
    ustat(userId, "wild");
    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setTitle("⚡ Carte attrapée !").setDescription(`${interaction.user} attrape **${card?.name}** !`)],
      components: [],
    });
    deleteLater(interaction.message, MINUTE);
    await checkSeriesRewards(client, userId);
    panelDirty = true;
    return true;
  }
  return false;
}

// Informations des membres volontaires (nom, avatar, nombre d'élections Membre Star)
async function cacheMember(member) {
  if (!member) return;
  let stars = 0;
  try {
    const title = require("./membrestar").getStarTitle(member.id);
    stars = title ? Number(title.match(/(\d+)/)?.[1] ?? 1) : 0;
  } catch {
    // Membre Star indisponible
  }
  // place du rôle le plus haut dans la hiérarchie du serveur (0 = tout en bas, 1 = tout en haut)
  const roles = [...member.guild.roles.cache.values()].filter((r) => r.id !== member.guild.id && !r.managed).sort((a, b) => a.position - b.position);
  const top = member.roles.highest;
  const index = roles.findIndex((r) => r.id === top?.id);
  const role = top && top.id !== member.guild.id ? { name: top.name, color: top.hexColor, norm: roles.length > 1 && index >= 0 ? index / (roles.length - 1) : 0 } : null;
  let messages = 0;
  try {
    messages = require("./levels").getLevelSummary(member.id).messages;
  } catch {
    // niveaux indisponibles
  }
  const info = {
    name: member.displayName,
    avatar: member.user.displayAvatarURL({ extension: "png", size: 512 }),
    stars,
    role,
    joinedAt: member.joinedTimestamp,
    messages,
    balance: readBalance(member.id) ?? 0,
  };
  memberCache.set(member.id, info);
  load().memberArchive[member.id] = info;
}

// Toutes les personnes avec le rôle des membres ont leur carte ; les autres sortent des boosters
async function syncMemberCards(guild) {
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;
  const keep = new Set();
  for (const member of members.values()) {
    if (member.user.bot || !member.roles.cache.has(MEMBER_CARD_ROLE_ID)) continue;
    keep.add(member.id);
    await cacheMember(member).catch(() => null);
    await grantWelcome(member, Boolean(load().welcomeInit));
  }
  for (const id of [...memberCache.keys()]) if (!keep.has(id)) memberCache.delete(id);
  load().welcomeInit = true; // les membres déjà présents ont reçu leur pack sans message ; les suivants sont prévenus
  save();
  console.log(`Cartes de membres : ${keep.size} membre(s) avec le rôle`);
}

// Pour /profil
function getCollectionSummary(userId) {
  const n = ownedIds(userId).size;
  if (!n) return null;
  const best = bestCardOf(userId), arena = load().arena[userId];
  const lines = [`${n} carte(s) · ${collectionScore(userId)} pts`];
  if (best) lines.push(`⭐ ${best.card.name}${best.holo ? " ✦" : ""} (${RARITIES[best.card.rarity].name})`);
  if (arena && arena.w + arena.l + arena.d > 0) lines.push(`⚔️ ${tierOf(arena.elo)[1]} · ${arena.elo} pts`);
  const title = achievementTitle(userId), unlocked = Object.keys(load().achievements[userId]?.unlocked ?? {}).length;
  if (unlocked) lines.push(`🏅 ${title ?? ""} · ${unlocked}/${ACHIEVEMENTS.length} succès`);
  const vit = (load().showcase[userId] ?? []).filter((k) => (load().inv[userId]?.[k] ?? 0) > 0).map(keyLabel);
  if (vit.length) lines.push(`🖼️ ${vit.join(" · ")}`);
  const teamLine = teamSummaryLine(userId);
  if (teamLine) lines.push(teamLine);
  return lines.join("\n");
}

