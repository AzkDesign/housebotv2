
// --- Échanges en direct ---
// 1. Un membre invite qui il veut. 2. L'invité accepte : la table d'échange s'ouvre dans le salon des échanges.
// 3. Chacun y pose ses propres cartes (et de l'argent), la table se met à jour en direct pour tout le monde.
// 4. Les deux valident : l'échange se fait. Toute modification annule les validations (impossible de changer l'offre au dernier moment).
// Les boosters fermés s'échangent aussi (sauf le cadeau du jour, gratuit).
const LIVE_INVITE_MINUTES = 10, LIVE_IDLE_MINUTES = 15;
const liveTrades = new Map(); // id -> table d'échange
const userLiveTrade = new Map(); // userId -> id de sa table

const errText = (err) => (err.startsWith("⏳") ? err : `❌ ${err}`);
const sideOf = (tr, userId) => (userId === tr.from ? "from" : userId === tr.to ? "to" : null);
const offerOf = (tr, side) => (side === "from" ? tr.give : tr.take);
function liveTimer(tr, minutes, why) {
  clearTimeout(tr.timer);
  tr.timer = setTimeout(() => endLiveTrade(tr, "expired", why).catch(() => null), minutes * MINUTE);
}
function inviteRow(tid) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`carte_lt_yes_${tid}`).setLabel("Accepter l'invitation").setEmoji("🤝").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`carte_lt_no_${tid}`).setLabel("Refuser").setEmoji("✖️").setStyle(ButtonStyle.Danger)
  );
}
function invitePayload(tr) {
  return {
    content: `🔄 <@${tr.to}>, **${tr.fromName}** vous invite à échanger des cartes !`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x2563eb)
        .setAuthor({ name: tr.fromName, iconURL: tr.fromAvatar })
        .setTitle("🔄 Invitation à échanger")
        .setDescription(
          `**${tr.fromName}** voudrait échanger des cartes avec **${tr.toName}**.\n\n` +
            "Acceptez pour ouvrir la **table d'échange** : chacun y pose les cartes et les boosters qu'il veut (et de l'argent si besoin), en direct. Rien n'est échangé tant que vous n'avez pas **validé tous les deux**.\n\n" +
            `L'invitation expire <t:${Math.floor((tr.at + LIVE_INVITE_MINUTES * MINUTE) / 1000)}:R>.`
        )
        .setThumbnail(tr.toAvatar),
    ],
    components: [inviteRow(tr.id)],
    allowedMentions: { users: [tr.to] },
  };
}
const offerList = (tr, side) => {
  const keys = offerOf(tr, side), money = side === "from" ? tr.giveMoney : tr.takeMoney;
  return [...keys.map((k) => `${RARITIES[cardOfKey(k)?.rarity]?.emoji ?? "▫️"} ${keyLabel(k)}`), ...packsText(tr.packs?.[side]), ...(money ? [`💶 ${formatEuro(money)}`] : [])].join("\n") || "*Rien pour le moment*";
};
const packCount = (packs = {}) => Object.values(packs).reduce((a, n) => a + n, 0);
const hasOffer = (tr) => tr.give.length || tr.take.length || tr.giveMoney || tr.takeMoney || packCount(tr.packs?.from) || packCount(tr.packs?.to);
// ce qu'un côté donne, pour les journaux
const sideText = (tr, side) => [...offerOf(tr, side).map(keyLabel), ...packsText(tr.packs?.[side])].join(", ") || "rien";

// --- Boosters dans l'échange ---
const TRADE_MAX_PACKS = 10;
const tradablePacks = (userId) => packsOf(userId).filter(([k]) => parsePack(k).type !== "jour");
function packPickerPayload(tr, userId) {
  const side = sideOf(tr, userId), mine = tr.packs[side];
  const options = [];
  for (const [k, n] of tradablePacks(userId)) {
    const p = parsePack(k), copies = Math.min(n, TRADE_MAX_PACKS);
    for (let i = 1; i <= copies && options.length < 25; i++)
      options.push({
        label: `${PACKS[p.type].name} · ${GENERATIONS[p.gen].code}${copies > 1 ? ` (${i}/${copies})` : ""}`.slice(0, 100),
        value: `${k}#${i}`,
        emoji: PACKS[p.type].emoji,
        description: `Vous en avez ${n} · valeur ${euro(PACKS[p.type].price)}`.slice(0, 100),
        default: i <= (mine[k] ?? 0),
      });
  }
  const select = options.length
    ? new StringSelectMenuBuilder().setCustomId(`carte_lt_pk_${tr.id}`).setPlaceholder("Les boosters que je pose sur la table…").setMinValues(0).setMaxValues(Math.min(TRADE_MAX_PACKS, options.length)).addOptions(options)
    : disabledSelect(`carte_lt_pk_${tr.id}`, "Vous n'avez aucun booster fermé à échanger");
  return {
    ephemeral: true,
    content: `📦 **Vos boosters sur la table** : ${packsText(mine).join(", ") || "aucun"}\nChoisissez jusqu'à ${TRADE_MAX_PACKS} boosters fermés (le cadeau du jour ne s'échange pas).`,
    embeds: [],
    components: [
      new ActionRowBuilder().addComponents(select),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_lt_pkclear_${tr.id}`).setLabel("Retirer tous mes boosters").setEmoji("🧹").setStyle(ButtonStyle.Secondary).setDisabled(!packCount(mine))),
    ],
  };
}
{
  // un booster posé doit toujours être dans l'inventaire
  const problem = tradeProblem;
  tradeProblem = (tr) => {
    const p = problem(tr);
    if (p) return p;
    for (const [side, userId, name] of [["from", tr.from, tr.fromName], ["to", tr.to, tr.toName]])
      for (const [k, n] of Object.entries(tr.packs?.[side] ?? {})) if ((load().packs[userId]?.[k] ?? 0) < n) return `${name} ne possède plus **${packLabel(k)}${n > 1 ? ` ×${n}` : ""}**.`;
    return null;
  };
}
function movePacks(from, to, packs = {}) {
  for (const [k, n] of Object.entries(packs)) {
    for (let i = 0; i < n; i++) if (!takePack(from, k)) return;
    addPacks(to, k, n);
  }
}
async function livePayloadTrade(tr, extra = "") {
  const open = tr.status === "live";
  const embed = new EmbedBuilder()
    .setColor(tr.status === "done" ? 0x16a34a : open ? 0x2563eb : 0x52525b)
    .setTitle(tr.status === "done" ? "🤝 Échange conclu !" : open ? `🔄 Table d'échange — ${tr.fromName} ⇄ ${tr.toName}` : `🔄 ${(TRADE_STATUS[tr.status] ?? TRADE_STATUS.cancelled)[0].charAt(0)}${(TRADE_STATUS[tr.status] ?? TRADE_STATUS.cancelled)[0].slice(1).toLowerCase()}`)
    .setDescription(
      (open
        ? "**🃏 Choisir mes cartes** pour poser ou retirer vos cartes · **📦 Boosters** pour poser des boosters fermés · **💶 Argent** pour ajouter de l'argent · **✅ Valider** quand l'offre vous convient.\n" +
          `${tr.ready.from ? "✅" : "⌛"} ${tr.fromName} · ${tr.ready.to ? "✅" : "⌛"} ${tr.toName} — *toute modification annule les validations.*`
        : "") + (extra ? `\n\n${extra}` : "") || null
    )
    .addFields({ name: `${tr.fromName} ${tr.status === "done" ? "a donné" : "propose"}`, value: offerList(tr, "from"), inline: true }, { name: `${tr.toName} ${tr.status === "done" ? "a donné" : "propose"}`, value: offerList(tr, "to"), inline: true })
    .setImage("attachment://echange.jpg");
  if (open) embed.setFooter({ text: `La table se ferme après ${LIVE_IDLE_MINUTES} min sans action` });
  return {
    content: open ? `🔄 <@${tr.from}> ⇄ <@${tr.to}> — la table d'échange est ouverte !` : null,
    embeds: [embed],
    files: [await tradeImage(tr)],
    attachments: [],
    components: open
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`carte_lt_pick_${tr.id}`).setLabel("Choisir mes cartes").setEmoji("🃏").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`carte_lt_packs_${tr.id}`).setLabel("Boosters").setEmoji("📦").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`carte_lt_money_${tr.id}`).setLabel("Argent").setEmoji("💶").setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`carte_lt_ok_${tr.id}`).setLabel("Valider").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(!hasOffer(tr)),
            new ButtonBuilder().setCustomId(`carte_lt_x_${tr.id}`).setLabel("Annuler l'échange").setStyle(ButtonStyle.Danger)
          ),
        ]
      : [],
    allowedMentions: { users: open && !tr.pinged ? [tr.from, tr.to] : [] },
  };
}
// sélecteur personnel (éphémère) : seulement les cartes du membre qui clique
function pickerPayload(tr, userId) {
  const side = sideOf(tr, userId), filter = tr.filter[side] ?? "all";
  const mine = offerOf(tr, side);
  return {
    ephemeral: true,
    content: `🃏 **Vos cartes sur la table** : ${mine.map(keyLabel).join(", ") || "aucune"}\nChoisissez jusqu'à ${TRADE_MAX_CARDS} cartes ; la table se met à jour en direct pour ${side === "from" ? tr.toName : tr.fromName}.`,
    embeds: [],
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`carte_lt_ser_${tr.id}`).setPlaceholder("Série de mes cartes").addOptions(seriesOptions(filter))),
      new ActionRowBuilder().addComponents(cardSelect(`carte_lt_cards_${tr.id}`, "Les cartes que je pose sur la table…", ownedKeys(userId, filter), mine)),
      new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_lt_clear_${tr.id}`).setLabel("Retirer toutes mes cartes").setEmoji("🧹").setStyle(ButtonStyle.Secondary).setDisabled(!mine.length)),
    ],
  };
}
async function refreshLive(tr, extra = "") {
  await tr.message?.edit(await livePayloadTrade(tr, extra)).catch(() => null);
  tr.pinged = true;
}
// une offre change : les validations tombent
function offerChanged(tr) {
  tr.ready = { from: false, to: false };
  liveTimer(tr, LIVE_IDLE_MINUTES, "table inactive");
}
async function endLiveTrade(tr, status, why = "") {
  if (!liveTrades.has(tr.id)) return;
  liveTrades.delete(tr.id);
  clearTimeout(tr.timer);
  for (const u of [tr.from, tr.to]) if (userLiveTrade.get(u) === tr.id) userLiveTrade.delete(u);
  tr.status = status;
  if (tr.live && status !== "done") await refreshLive(tr, why ? `ℹ️ ${why}` : "");
  else if (!tr.live) await tr.message?.edit({ content: `🔄 Invitation de **${tr.fromName}** à **${tr.toName}** : ${status === "refused" ? "refusée" : status === "expired" ? "expirée" : "annulée"}.`, embeds: [], components: [], allowedMentions: { parse: [] } }).catch(() => null);
  deleteLater(tr.message, MINUTE);
}
// l'échange lui-même (cartes, argent, statistiques)
async function executeLiveTrade(client, tr) {
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
  if (problem) return problem;
  for (const k of tr.give) moveKey(tr.from, tr.to, k);
  for (const k of tr.take) moveKey(tr.to, tr.from, k);
  movePacks(tr.from, tr.to, tr.packs?.from);
  movePacks(tr.to, tr.from, tr.packs?.to);
  bump("trades");
  for (const u of [tr.from, tr.to]) {
    questProgress(u, "trade");
    ustat(u, "trades");
  }
  pairAlert(tr.from, tr.to, "échanges", `${sideText(tr, "from")} contre ${sideText(tr, "to")}`).catch(() => null);
  save();
  require("./logs")
    .sendLogEmbed("achats", new EmbedBuilder().setColor(0x16a34a).setTitle("🔄 Échange de cartes conclu").setDescription(`**${pseudo(tr.from)}** donne : ${sideText(tr, "from")}${tr.giveMoney ? ` + ${formatEuro(tr.giveMoney)}` : ""}\n**${pseudo(tr.to)}** donne : ${sideText(tr, "to")}${tr.takeMoney ? ` + ${formatEuro(tr.takeMoney)}` : ""}`).setTimestamp())
    .catch(() => null);
  await checkSeriesRewards(client, tr.from);
  await checkSeriesRewards(client, tr.to);
  checkAchievements(tr.from).catch(() => null);
  checkAchievements(tr.to).catch(() => null);
  panelDirty = true;
  return null;
}

// envoie l'invitation ; renvoie un message d'erreur ou null
async function inviteLiveTrade(client, user, fromName, target, toName) {
  if (!target || target.bot || target.id === user.id) return "Choisissez un autre membre (pas vous-même, ni un bot).";
  const sen = (await seniorityError(user.id)) ?? (await seniorityError(target.id, toName));
  if (sen) return sen;
  if (userLiveTrade.has(user.id)) return "Vous avez déjà un échange en cours : terminez-le ou annulez-le d'abord.";
  if (userLiveTrade.has(target.id)) return `${toName} est déjà en train d'échanger avec quelqu'un.`;
  const tr = { ...newDraft(user, target, fromName, toName), id: Date.now().toString(36), status: "invite", live: false, ready: { from: false, to: false }, filter: {}, packs: { from: {}, to: {} } };
  delete tr.gf;
  delete tr.tf;
  const invite = await sendInvite(client, target.id, invitePayload(tr), "echanges");
  tr.message = invite.message;
  if (!tr.message) return "Impossible d'envoyer l'invitation.";
  lastInvite.set(user.id, { kind: "echange", dm: invite.dm, cancelId: `carte_lt_x_${tr.id}` });
  tr.author = user;
  liveTrades.set(tr.id, tr);
  userLiveTrade.set(user.id, tr.id);
  userLiveTrade.set(target.id, tr.id);
  liveTimer(tr, LIVE_INVITE_MINUTES, "invitation expirée");
  if (!invite.dm) client.users.fetch(target.id).then((u) => u.send(`🔄 **${fromName}** vous invite à échanger des cartes : ${tr.message.url}`)).catch(() => null);
  return null;
}

async function handleLiveTradeInteraction(interaction, client) {
  const id = interaction.customId;
  // les anciens points d'entrée ouvrent désormais une invitation
  if (interaction.isChatInputCommand?.() && interaction.commandName === "echange") {
    const target = interaction.options.getUser("membre");
    const err = await inviteLiveTrade(client, interaction.user, interaction.member?.displayName ?? interaction.user.username, target, interaction.options.getMember("membre")?.displayName ?? target?.username ?? "?");
    await interaction.reply({ ...(err ? { content: errText(err) } : inviteSentPayload(interaction.user.id, interaction.options.getMember("membre")?.displayName ?? target.username)), ephemeral: true });
    return true;
  }
  if (id === "carte_tr") {
    await interaction.reply({
      ephemeral: true,
      content: "🔄 Avec qui voulez-vous échanger ? Il recevra une invitation ; s'il accepte, vous choisirez vos cartes ensemble, en direct.",
      components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("carte_tr_pick").setPlaceholder("Inviter un membre…"))],
    });
    return true;
  }
  if (id === "carte_tr_pick") {
    const target = interaction.users.first();
    const toName = interaction.members?.first()?.displayName ?? target?.username ?? "?";
    const err = await inviteLiveTrade(client, interaction.user, interaction.member?.displayName ?? interaction.user.username, target, toName);
    await interaction.update(err ? { content: errText(err), components: interaction.message.components } : inviteSentPayload(interaction.user.id, toName));
    return true;
  }
  const m = /^carte_lt_(yes|no|x|pick|money|mf|ok|ser|cards|clear|packs|pk|pkclear)_(\w+)$/.exec(id ?? "");
  if (!m) return false;
  const [, action, tid] = m;
  const tr = liveTrades.get(tid);
  if (!tr) {
    await interaction.reply({ content: "ℹ️ Cet échange n'est plus actif.", ephemeral: true });
    return true;
  }
  const userId = interaction.user.id, side = sideOf(tr, userId);
  if (!side) {
    await interaction.reply({ content: `⛔ Seuls **${tr.fromName}** et **${tr.toName}** participent à cet échange.`, ephemeral: true });
    return true;
  }
  // --- invitation ---
  if (action === "yes" || action === "no") {
    if (tr.live) {
      await interaction.reply({ content: "ℹ️ La table d'échange est déjà ouverte.", ephemeral: true });
      return true;
    }
    if (side !== "to") {
      await interaction.reply({ content: `⛔ Seul(e) **${tr.toName}** peut répondre à l'invitation.`, ephemeral: true });
      return true;
    }
    if (action === "no") {
      await interaction.deferUpdate();
      await endLiveTrade(tr, "refused");
      tr.author?.send?.(`✖️ **${tr.toName}** a refusé votre invitation à échanger.`).catch(() => null);
      return true;
    }
    await interaction.deferUpdate();
    tr.live = true;
    tr.status = "live";
    tr.at = Date.now();
    liveTimer(tr, LIVE_IDLE_MINUTES, "table inactive");
    if (!tr.message?.guildId) {
      // invitation reçue en message privé : la table s'ouvre dans le salon des échanges
      const dm = tr.message;
      tr.message = await chan("echanges")?.send(await livePayloadTrade(tr)).catch(() => null);
      tr.pinged = true;
      await dm?.edit({ content: `✅ Invitation acceptée ! La table d'échange est ouverte : ${tr.message?.url ?? chan("echanges")}`, embeds: [], components: [] }).catch(() => null);
      deleteLater(dm, MINUTE);
    } else await refreshLive(tr);
    tr.author?.send?.(`🔄 **${tr.toName}** accepte votre invitation ! La table d'échange est ouverte : ${tr.message?.url ?? ""}`).catch(() => null);
    return true;
  }
  if (action === "x") {
    if (!tr.live && side !== "from") {
      await interaction.reply({ content: `⛔ Seul(e) **${tr.fromName}** peut annuler son invitation (utilisez « Refuser »).`, ephemeral: true });
      return true;
    }
    if (interaction.message?.id !== tr.message?.id) await interaction.update({ content: "🗑️ Invitation annulée.", embeds: [], components: [] });
    else await interaction.deferUpdate();
    await endLiveTrade(tr, "cancelled", `Échange annulé par **${side === "from" ? tr.fromName : tr.toName}**.`);
    return true;
  }
  if (!tr.live) {
    await interaction.reply({ content: "ℹ️ La table d'échange n'est pas encore ouverte.", ephemeral: true });
    return true;
  }
  // --- table d'échange ---
  if (action === "pick") {
    await interaction.reply(pickerPayload(tr, userId));
    return true;
  }
  if (action === "ser") {
    tr.filter[side] = interaction.values[0];
    await interaction.update(pickerPayload(tr, userId));
    return true;
  }
  if (action === "cards" || action === "clear") {
    const visible = ownedKeys(userId, tr.filter[side] ?? "all").slice(0, 25).map(([k]) => k);
    const next = action === "clear" ? [] : mergeSelection(offerOf(tr, side), visible, interaction.values);
    if (side === "from") tr.give = next;
    else tr.take = next;
    offerChanged(tr);
    const busy = tradeProblem(tr);
    await interaction.update(pickerPayload(tr, userId));
    await refreshLive(tr, busy ? `⚠️ ${busy}` : `✏️ **${side === "from" ? tr.fromName : tr.toName}** a modifié son offre.`);
    return true;
  }
  if (action === "packs") {
    tr.packs ??= { from: {}, to: {} };
    await interaction.reply(packPickerPayload(tr, userId));
    return true;
  }
  if (action === "pk" || action === "pkclear") {
    tr.packs ??= { from: {}, to: {} };
    const next = {};
    if (action === "pk") for (const v of interaction.values) if (v.includes("#")) next[v.split("#")[0]] = (next[v.split("#")[0]] ?? 0) + 1;
    tr.packs[side] = next;
    offerChanged(tr);
    const busy = tradeProblem(tr);
    await interaction.update(packPickerPayload(tr, userId));
    await refreshLive(tr, busy ? `⚠️ ${busy}` : `📦 **${side === "from" ? tr.fromName : tr.toName}** a modifié ses boosters.`);
    return true;
  }
  if (action === "money") {
    const current = side === "from" ? tr.giveMoney : tr.takeMoney;
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`carte_lt_mf_${tr.id}`)
        .setTitle("Argent dans l'échange")
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("amount").setLabel("Argent que vous donnez (€, 0 pour retirer)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(12).setValue(current ? String(current) : "")))
    );
    return true;
  }
  if (action === "mf") {
    const amount = parseAmount(interaction.fields.getTextInputValue("amount") || "0");
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
      await interaction.reply({ content: "❌ Montant invalide (entre 0 et 100 000 000 €).", ephemeral: true });
      return true;
    }
    if (amount > readBalance(userId)) {
      await interaction.reply({ content: `❌ Vous n'avez que ${formatEuro(readBalance(userId))}.`, ephemeral: true });
      return true;
    }
    if (side === "from") tr.giveMoney = amount;
    else tr.takeMoney = amount;
    offerChanged(tr);
    await interaction.deferUpdate();
    await refreshLive(tr, `💶 **${side === "from" ? tr.fromName : tr.toName}** ${amount ? `ajoute ${formatEuro(amount)}` : "retire son argent"}.`);
    return true;
  }
  if (action === "ok") {
    if (!hasOffer(tr)) {
      await interaction.reply({ content: "❌ La table est vide : posez au moins une carte, un booster ou de l'argent.", ephemeral: true });
      return true;
    }
    tr.ready[side] = !tr.ready[side];
    liveTimer(tr, LIVE_IDLE_MINUTES, "table inactive");
    await interaction.deferUpdate();
    if (!(tr.ready.from && tr.ready.to)) {
      await refreshLive(tr, tr.ready[side] ? `✅ **${side === "from" ? tr.fromName : tr.toName}** valide l'offre.` : `↩️ **${side === "from" ? tr.fromName : tr.toName}** retire sa validation.`);
      return true;
    }
    const problem = await executeLiveTrade(client, tr);
    if (problem) {
      tr.ready = { from: false, to: false };
      await refreshLive(tr, `⚠️ ${problem}`);
      return true;
    }
    liveTrades.delete(tr.id);
    clearTimeout(tr.timer);
    for (const u of [tr.from, tr.to]) if (userLiveTrade.get(u) === tr.id) userLiveTrade.delete(u);
    tr.status = "done";
    await tr.message?.edit({ ...(await livePayloadTrade(tr)), content: `🤝 Échange conclu entre **${pseudo(tr.from)}** et **${pseudo(tr.to)}** !`, allowedMentions: { parse: [] } }).catch(() => null);
    deleteLater(tr.message, MINUTE);
    return true;
  }
  return false;
}
