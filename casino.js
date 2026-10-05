const fs = require("fs");
const path = require("path");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  changeBalance,
  readBalance,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
  ECONOMIE_LOG_CHANNEL_ID,
  addToTreasury,
  isFrozen,
} = require("./economie");
// Taxe de la maison sur le pot d'un défi (réglée par le maire), versée au jackpot
const { P, curfew } = require("./politique");
const { deleteLater, deleteInteractionMessageLater, getDossiersChannel, MINUTE, HOUR } = require("./nettoyage");

const CASINO_CHANNEL_ID = "1527054335928827954";
const CASINO_ACCESS_ROLE_ID = "1554940931617071206";
const ENTREPRENEUR_ROLE_ID = "1554940569732517909";
const SITUATION_DELICATE_ROLE_ID = "1554940813522505778";
const IRF_ROLE_ID = "1527525759793762586";
const TICKET_CATEGORY_ID = "1509977402485510345";
const LICENCE_ROLE_ID = "1527364017583030503";
const LICENCE_PRICE = 1000;

const PANEL_TITLE = "🎰 Casino de la Maison";
const MIN_BET = 10;
// Personne ne peut dépasser ce solde grâce au casino (règle affichée sur le panneau).
const CASINO_CAP = 15000;
const JACKPOT_SEED = 1000;
const JACKPOT_SHARE = 0.02; // part de chaque mise de machine à sous versée au jackpot
const BLACKJACK_TIMEOUT_MS = 3 * 60 * 1000;
const DUEL_TIMEOUT_MS = 5 * 60 * 1000;

// Ouverture : du vendredi 20h au lundi 2h (heure de Paris).
// Minutes depuis lundi 00h00.
const OPEN_AT = 4 * 1440 + 20 * 60;
const CLOSE_AT = 2 * 60;
const SCHEDULE_TEXT = "du **vendredi 20h** au **lundi 2h** (heure de Paris)";

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("casino-state.json");

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return { jackpot: JACKPOT_SEED, panelMessageId: null, ...data };
  } catch {
    return { jackpot: JACKPOT_SEED, panelMessageId: null };
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function randInt(max) {
  return Math.floor(Math.random() * max);
}

// --- Horaires ---

const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const parisFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisWeekMinute(ts) {
  const parts = Object.fromEntries(
    parisFormat.formatToParts(new Date(ts)).map((p) => [p.type, p.value])
  );
  return WEEKDAYS[parts.weekday] * 1440 + Number(parts.hour) * 60 + Number(parts.minute);
}

function isOpenAt(ts) {
  const wm = parisWeekMinute(ts);
  return wm >= OPEN_AT || wm < CLOSE_AT;
}

// Prochain changement ouvert/fermé, recherché minute par minute
// (gère correctement les changements d'heure été/hiver).
function nextTransition(now) {
  const open = isOpenAt(now);
  let t = Math.floor(now / 60000) * 60000 + 60000;
  for (let i = 0; i < 8 * 1440; i++, t += 60000) {
    if (isOpenAt(t) !== open) return t;
  }
  return t;
}

let scheduleCache = { open: null, until: 0 };
function getSchedule() {
  const now = Date.now();
  if (scheduleCache.open === null || now >= scheduleCache.until) {
    scheduleCache = { open: isOpenAt(now), until: nextTransition(now) };
  }
  return scheduleCache;
}

// --- Accès ---

function hasAccess(member) {
  return (
    member?.roles.cache.has(CASINO_ACCESS_ROLE_ID) ||
    member?.roles.cache.has(ENTREPRENEUR_ROLE_ID) ||
    false
  );
}

// Renvoie un message d'erreur si le membre ne peut pas jouer maintenant.
function playError(member) {
  if (curfew()) return "🌙 **Couvre-feu** décrété par le régime : le casino est fermé jusqu'à nouvel ordre.";
  const { open, until } = getSchedule();
  if (!open) {
    return `🔒 Le casino est **fermé**. Réouverture <t:${Math.floor(until / 1000)}:R> (${SCHEDULE_TEXT}).`;
  }
  if (isFrozen(member.id)) {
    return "🔒 Votre compte est **gelé** par l'IRF. Vous ne pouvez pas jouer pour le moment.";
  }
  if (!hasAccess(member)) {
    return "🎟️ Vous n'avez pas encore accès au casino. Cliquez sur **Demander l'accès au casino**.";
  }
  if (readBalance(member.id) >= CASINO_CAP) {
    return `🎰 Votre solde atteint le **plafond du casino (${formatEuro(CASINO_CAP)})** : vous ne pouvez plus jouer tant qu'il est au-dessus.`;
  }
  return null;
}

function parseBet(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// Débite la mise ; renvoie un message d'erreur ou null.
function takeBet(userId, amount, game) {
  if (amount < MIN_BET) return `❌ Mise minimum : **${formatEuro(MIN_BET)}**.`;
  if (changeBalance(userId, -amount, `Casino — ${game} (mise)`) === null) {
    return `❌ Solde insuffisant (vous avez **${formatEuro(readBalance(userId))}**).`;
  }
  addToTreasury("casinoMises", amount);
  markBalancesDirty();
  return null;
}

// Paie les gains d'une partie déjà lancée (même si le compte a été gelé entre-temps).
function pay(userId, amount, game) {
  const paid = round2(Math.max(0, Math.min(amount, CASINO_CAP - readBalance(userId))));
  if (paid > 0) {
    changeBalance(userId, paid, `Casino — ${game} (gain)`, { force: true });
    addToTreasury("casinoGains", paid);
    markBalancesDirty();
    if (paid >= 2000) require("./feed").post(`🎰 <@${userId}> remporte **${formatEuro(paid)}** au ${game} !`, { stat: "casino" });
  }
  return paid;
}

// Message affiché quand un gain a été réduit par le plafond.
function capNote(won, paid) {
  return paid < round2(won)
    ? `\n🎰 **Plafond du casino atteint** : impossible de dépasser ${formatEuro(CASINO_CAP)} grâce au casino. ${formatEuro(paid)} versés sur ${formatEuro(won)}.`
    : "";
}

function addToJackpot(amount) {
  const state = loadState();
  state.jackpot = round2(state.jackpot + amount);
  saveState(state);
  panelDirty = true;
}

// --- Panneau ---

function buildTimerEmbed() {
  const { open, until } = getSchedule();
  const ts = Math.floor(until / 1000);
  return new EmbedBuilder()
    .setColor(open ? 0x2ecc71 : 0xe74c3c)
    .setTitle(open ? "🟢 Casino ouvert" : "🔴 Casino fermé")
    .setDescription(
      (open
        ? `Fermeture <t:${ts}:R> — <t:${ts}:F>`
        : `Ouverture <t:${ts}:R> — <t:${ts}:F>`) +
        `\n\nLe casino est ouvert ${SCHEDULE_TEXT}.`
    );
}

function buildPanelEmbed(state) {
  return new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Bienvenue au casino ! Votre solde vient de `/solde`.\n\n" +
        "🃏 **Blackjack** — battez le croupier sans dépasser 21. Blackjack naturel payé 6:5 (x2,2).\n" +
        "🎡 **Roulette** — Rouge/Noir (x2) ou Vert (x36).\n" +
        "🎰 **Machine à sous** — 3 symboles, plus rare = plus gros gain. Enchaînez **x5 / x10 tours** d'un coup. Trois 7️⃣ font tomber le **jackpot** !\n" +
        "⚔️ **Défi** — Misez directement contre un autre membre, le gagnant rafle la mise (moins la taxe de la maison).\n\n" +
        `🎟️ Les **entrepreneurs** ont accès directement ; les autres membres doivent **demander l'accès**.\n` +
        `*Mise minimum : ${formatEuro(MIN_BET)}. Plafond : personne ne peut dépasser ${formatEuro(CASINO_CAP)} grâce au casino. La maison garde toujours un avantage.*`
    )
    .addFields({ name: "💰 Jackpot progressif", value: `**${formatEuro(state.jackpot)}**` })
    .setTimestamp();
}

function buildPanelComponents() {
  const closed = !getSchedule().open;
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("casino_play_blackjack")
        .setLabel("Blackjack")
        .setEmoji("🃏")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(closed),
      new ButtonBuilder()
        .setCustomId("casino_play_roulette")
        .setLabel("Roulette")
        .setEmoji("🎡")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(closed),
      new ButtonBuilder()
        .setCustomId("casino_play_slots")
        .setLabel("Machine à sous")
        .setEmoji("🎰")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(closed),
      new ButtonBuilder()
        .setCustomId("casino_play_duel")
        .setLabel("Défier un membre")
        .setEmoji("⚔️")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(closed)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("casino_access_request")
        .setLabel("Demander l'accès au casino")
        .setEmoji("🎟️")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("casino_licence_buy")
        .setLabel(`Acheter une licence (${formatEuro(LICENCE_PRICE)})`)
        .setEmoji("🪪")
        .setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildPanelMessage() {
  const state = loadState();
  return {
    embeds: [buildTimerEmbed(), buildPanelEmbed(state)],
    components: buildPanelComponents(),
  };
}

let panelDirty = false;
let balancesDirty = false;
let lastOpen = null;

function markBalancesDirty() {
  balancesDirty = true;
}

async function refreshPanel(client) {
  const channel = await client.channels.fetch(CASINO_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon casino ${CASINO_CHANNEL_ID} introuvable`);
    return;
  }

  const state = loadState();
  let message = state.panelMessageId
    ? await channel.messages.fetch(state.panelMessageId).catch(() => null)
    : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    message = recent?.find(
      (m) =>
        m.author.id === client.user.id &&
        m.embeds.some((e) => e.title === PANEL_TITLE)
    );
  }

  if (message) await message.edit(buildPanelMessage());
  else message = await channel.send(buildPanelMessage());

  if (state.panelMessageId !== message.id) {
    const fresh = loadState();
    fresh.panelMessageId = message.id;
    saveState(fresh);
  }
}

async function setupCasino(client) {
  await refundPendingBets(client);
  lastOpen = getSchedule().open;
  await refreshPanel(client);

  setInterval(async () => {
    try {
      const { open } = getSchedule();
      if (open !== lastOpen || panelDirty) {
        const opened = open && !lastOpen;
        lastOpen = open;
        panelDirty = false;
        await refreshPanel(client);
        if (opened) {
          const channel = await client.channels.fetch(CASINO_CHANNEL_ID).catch(() => null);
          const ping = await channel
            ?.send(`🎰 **Le casino est ouvert !** <@&${CASINO_ACCESS_ROLE_ID}> <@&${ENTREPRENEUR_ROLE_ID}>`)
            .catch(() => null);
          deleteLater(ping, 3 * HOUR);
        }
      }
      if (balancesDirty) {
        balancesDirty = false;
        await refreshRichestLeaderboard(client);
      }
    } catch (err) {
      console.error("Casino (actualisation):", err.message);
    }
  }, 30 * 1000);

  console.log("Casino prêt");
}

// --- Demande d'accès (ticket contrôlé par l'IRF) ---

function isIrf(member) {
  return member?.roles.cache.has(IRF_ROLE_ID) || isGerant(member);
}

function findAccessTicket(guild, memberId) {
  return guild.channels.cache.find(
    (ch) => ch.type === ChannelType.GuildText && ch.topic === `casino:${memberId}`
  );
}

async function handleAccessRequest(interaction, client) {
  const member = interaction.member;
  const guild = interaction.guild;

  if (member.roles.cache.has(CASINO_ACCESS_ROLE_ID)) {
    await interaction.reply({ content: "🎟️ Vous avez déjà accès au casino.", ephemeral: true });
    return;
  }

  if (member.roles.cache.has(ENTREPRENEUR_ROLE_ID)) {
    await member.roles.add(CASINO_ACCESS_ROLE_ID).catch(() => null);
    await interaction.reply({
      content: "✅ En tant qu'entrepreneur, vous avez accès directement au casino. Bon jeu !",
      ephemeral: true,
    });
    return;
  }

  const existing = findAccessTicket(guild, member.id);
  if (existing) {
    await interaction.reply({
      content: `📨 Vous avez déjà une demande en cours : ${existing}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow },
    {
      id: guild.members.me.id,
      allow: [...allow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
    },
  ];
  if (guild.roles.cache.has(IRF_ROLE_ID)) {
    permissionOverwrites.push({ id: IRF_ROLE_ID, allow: [...allow, PermissionFlagsBits.ManageMessages] });
  }

  const slug = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "membre";
  const ticket = await guild.channels
    .create({
      name: `casino-${slug}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: `casino:${member.id}`,
      permissionOverwrites,
    })
    .catch((err) => {
      console.error("Ticket casino:", err.message);
      return null;
    });

  if (!ticket) {
    await interaction.editReply("❌ Impossible d'ouvrir le ticket. Contactez un gérant.");
    return;
  }

  const profil = member.roles.cache.has(SITUATION_DELICATE_ROLE_ID)
    ? "Personne en situation délicate"
    : "Non renseigné";

  const embed = new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle("🎟️ Demande d'accès au casino")
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setDescription(
      `Bonjour ${member},\n\n` +
        "L'**IRF** (Institut de Régulation Financière) va étudier votre demande : " +
        "absence de **fraude** et de signes de **dépendance au jeu**.\n" +
        "Répondez à leurs questions dans ce salon."
    )
    .addFields(
      { name: "Membre", value: `${member} (\`${member.user.tag}\`)` },
      { name: "Profil", value: profil, inline: true },
      { name: "Solde", value: formatEuro(readBalance(member.id)), inline: true }
    )
    .setFooter({ text: "Décision réservée à l'IRF" })
    .setTimestamp();

  await ticket.send({
    content: `${member} <@&${IRF_ROLE_ID}>`,
    allowedMentions: { users: [member.id], roles: [IRF_ROLE_ID] },
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`casino_access_ok_${member.id}`)
          .setLabel("Accepter")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`casino_access_no_${member.id}`)
          .setLabel("Refuser")
          .setEmoji("❌")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await interaction.editReply(`📨 Votre demande est ouverte ici : ${ticket}`);
}

async function handleAccessDecision(interaction, accepted, userId, client) {
  if (!isIrf(interaction.member)) {
    await interaction.reply({ content: "❌ Décision réservée à l'IRF.", ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (member && accepted) await member.roles.add(CASINO_ACCESS_ROLE_ID).catch(() => null);

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: `${accepted ? "Acceptée" : "Refusée"} par ${interaction.user.tag}` });
  await interaction.update({ embeds: [embed], components: [] });

  await interaction.channel
    .send(
      (accepted
        ? `✅ Accès au casino **accordé** à <@${userId}>. Il est ouvert ${SCHEDULE_TEXT}.`
        : `❌ Accès au casino **refusé** à <@${userId}>.`) +
        "\n*Ce ticket sera fermé dans 1 minute.*"
    )
    .catch(() => null);

  await require("./logs").sendLogEmbed("casino", embed);

  await member
    ?.send(
      accepted
        ? `🎰 Votre demande d'accès au casino a été **acceptée** ! Il est ouvert ${SCHEDULE_TEXT}.`
        : "🎰 Votre demande d'accès au casino a été **refusée**."
    )
    .catch(() => null);

  const channel = interaction.channel;
  setTimeout(() => require("./tickets").closeTicket(channel, { reason: `Demande casino ${accepted ? "acceptée" : "refusée"}`, closedBy: interaction.user }), 60 * 1000);
}

// --- Licence ---

async function handleLicencePurchase(interaction, client) {
  const member = interaction.member;
  if (member.roles.cache.has(LICENCE_ROLE_ID)) {
    await interaction.reply({ content: "🪪 Vous avez déjà une licence.", ephemeral: true });
    return;
  }
  if (isFrozen(member.id)) {
    await interaction.reply({ content: "🔒 Votre compte est **gelé** par l'IRF.", ephemeral: true });
    return;
  }
  if (changeBalance(member.id, -LICENCE_PRICE, "Achat d'une licence") === null) {
    await interaction.reply({
      content: `❌ La licence coûte **${formatEuro(LICENCE_PRICE)}** — vous avez **${formatEuro(readBalance(member.id))}**.`,
      ephemeral: true,
    });
    return;
  }

  const added = await member.roles.add(LICENCE_ROLE_ID).then(() => true).catch(() => false);
  if (!added) {
    changeBalance(member.id, LICENCE_PRICE, "Licence — remboursement (erreur)", { force: true });
    await interaction.reply({ content: "❌ Impossible de donner le rôle licence. Vous avez été remboursé(e).", ephemeral: true });
    return;
  }

  addToTreasury("licences", LICENCE_PRICE);
  recordLicence(member.id);
  markBalancesDirty();
  await interaction.reply({
    content: `🪪 Licence achetée pour **${formatEuro(LICENCE_PRICE)}** ! Nouveau solde : **${formatEuro(readBalance(member.id))}**.`,
    ephemeral: true,
  });


}

function recordLicence(userId) {
  const state = loadState();
  state.licences = { ...(state.licences ?? {}), [userId]: Date.now() };
  saveState(state);
}

function getLicenceDates() {
  return loadState().licences ?? {};
}

// --- Modale de mise ---

function betModal(customId, title, userId, extraInput) {
  const modal = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("mise")
          .setLabel(extraInput ? "Mise par tour (€)" : "Mise (€)")
          .setPlaceholder(`Solde : ${formatEuro(readBalance(userId))} — minimum ${MIN_BET} €`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(12)
      )
    );
  return modal;
}

// --- Blackjack ---

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const blackjackGames = new Map();

function drawCard() {
  return { rank: RANKS[randInt(13)], suit: SUITS[randInt(4)] };
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.rank === "A") {
      total += 11;
      aces++;
    } else if (["J", "Q", "K"].includes(c.rank)) total += 10;
    else total += Number(c.rank);
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function showHand(hand) {
  return hand.map((c) => `\`${c.rank}${c.suit}\``).join(" ");
}

function blackjackEmbed(game, result) {
  const dealerShown = result ? showHand(game.dealer) : `${showHand([game.dealer[0]])} \`??\``;
  const dealerValue = result ? ` (${handValue(game.dealer)})` : "";
  const embed = new EmbedBuilder()
    .setColor(result ? (result.payout > game.bet ? 0x2ecc71 : result.payout === game.bet ? 0x95a5a6 : 0xe74c3c) : 0x5865f2)
    .setTitle("🃏 Blackjack")
    .addFields(
      { name: `Croupier${dealerValue}`, value: dealerShown },
      { name: `Vous (${handValue(game.player)})`, value: showHand(game.player) },
      { name: "Mise", value: formatEuro(game.bet), inline: true }
    );
  if (result) {
    embed.setDescription(`**${result.text}**`);
    embed.addFields({ name: "Solde", value: formatEuro(readBalance(game.userId)), inline: true });
  }
  return embed;
}

function blackjackButtons(game) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("casino_bj_hit").setLabel("Tirer").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("casino_bj_stand").setLabel("Rester").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("casino_bj_double")
        .setLabel("Doubler")
        .setStyle(ButtonStyle.Success)
        .setDisabled(game.player.length !== 2 || readBalance(game.userId) < game.bet)
    ),
  ];
}

// Termine la partie : le croupier tire jusqu'à 17, puis on paie.
// Mises des parties de blackjack en cours, enregistrées pour être
// remboursées si le bot redémarre avant la fin de la partie.
function trackBet(userId, amount) {
  const state = loadState();
  state.pendingBets = { ...(state.pendingBets ?? {}), [userId]: amount };
  saveState(state);
}

function clearBet(userId) {
  const state = loadState();
  if (!state.pendingBets?.[userId]) return;
  delete state.pendingBets[userId];
  saveState(state);
}

async function refundPendingBets(client) {
  const state = loadState();
  const pending = Object.entries(state.pendingBets ?? {});
  if (!pending.length) return;
  for (const [userId, amount] of pending) {
    changeBalance(userId, amount, "Casino — mise remboursée (redémarrage du bot)", { force: true });
    addToTreasury("casinoMises", -amount); // la mise n'a finalement pas été jouée
    const user = await client.users.fetch(userId).catch(() => null);
    await user
      ?.send(`🃏 Le bot a redémarré pendant votre partie de blackjack : votre mise de **${formatEuro(amount)}** vous a été remboursée.`)
      .catch(() => null);
  }
  const fresh = loadState();
  fresh.pendingBets = {};
  saveState(fresh);
  markBalancesDirty();
  console.log(`Casino : ${pending.length} mise(s) de blackjack remboursée(s)`);
}

function finishBlackjack(game) {
  clearTimeout(game.timeout);
  blackjackGames.delete(game.userId);
  clearBet(game.userId);

  const player = handValue(game.player);
  let result;
  if (player > 21) {
    result = { payout: 0, text: `💥 Vous dépassez 21 — vous perdez ${formatEuro(game.bet)}.` };
  } else {
    while (handValue(game.dealer) < 17) game.dealer.push(drawCard());
    const dealer = handValue(game.dealer);
    if (dealer > 21 || player > dealer) {
      result = { payout: game.bet * 2, text: `🎉 Vous gagnez ${formatEuro(game.bet * 2)} !` };
    } else if (player === dealer) {
      result = { payout: game.bet, text: "🤝 Égalité — mise remboursée." };
    } else {
      result = { payout: 0, text: `😔 Le croupier gagne — vous perdez ${formatEuro(game.bet)}.` };
    }
  }
  const paid = pay(game.userId, result.payout, "blackjack");
  result.text += capNote(result.payout, paid);
  return result;
}

async function startBlackjack(interaction, bet) {
  const userId = interaction.user.id;
  if (blackjackGames.has(userId)) {
    await interaction.reply({ content: "🃏 Terminez d'abord votre partie en cours.", ephemeral: true });
    return;
  }
  const err = takeBet(userId, bet, "blackjack");
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
    return;
  }

  const game = {
    userId,
    bet,
    player: [drawCard(), drawCard()],
    dealer: [drawCard(), drawCard()],
  };

  // Blackjacks naturels
  if (isBlackjack(game.player) || isBlackjack(game.dealer)) {
    let result;
    if (isBlackjack(game.player) && isBlackjack(game.dealer)) {
      result = { payout: bet, text: "🤝 Double blackjack — mise remboursée." };
    } else if (isBlackjack(game.player)) {
      result = { payout: round2(bet * 2.2), text: `🌟 Blackjack ! Vous gagnez ${formatEuro(round2(bet * 2.2))} !` };
    } else {
      result = { payout: 0, text: `😔 Blackjack du croupier — vous perdez ${formatEuro(bet)}.` };
    }
    const paid = pay(userId, result.payout, "blackjack");
    result.text += capNote(result.payout, paid);
    await interaction.reply({ embeds: [blackjackEmbed(game, result)], ephemeral: true });
    return;
  }

  blackjackGames.set(userId, game);
  trackBet(userId, bet);
  await interaction.reply({
    embeds: [blackjackEmbed(game)],
    components: blackjackButtons(game),
    ephemeral: true,
  });

  // Sans action du joueur, on reste automatiquement.
  game.timeout = setTimeout(() => {
    if (blackjackGames.get(userId) !== game) return;
    const result = finishBlackjack(game);
    interaction
      .editReply({ embeds: [blackjackEmbed(game, result).setFooter({ text: "Temps écoulé — vous restez automatiquement" })], components: [] })
      .catch(() => null);
  }, BLACKJACK_TIMEOUT_MS);
}

async function handleBlackjackAction(interaction, action) {
  const game = blackjackGames.get(interaction.user.id);
  if (!game) {
    await interaction.update({ content: "⌛ Cette partie est terminée.", components: [] });
    return;
  }

  if (action === "double") {
    if (changeBalance(game.userId, -game.bet, "Casino — blackjack (double)") === null) {
      await interaction.reply({ content: "❌ Solde insuffisant pour doubler.", ephemeral: true });
      return;
    }
    addToTreasury("casinoMises", game.bet);
    markBalancesDirty();
    game.bet *= 2;
    trackBet(game.userId, game.bet);
    game.player.push(drawCard());
    const result = finishBlackjack(game);
    await interaction.update({ embeds: [blackjackEmbed(game, result)], components: [] });
    return;
  }

  if (action === "hit") {
    game.player.push(drawCard());
    if (handValue(game.player) < 21) {
      await interaction.update({ embeds: [blackjackEmbed(game)], components: blackjackButtons(game) });
      return;
    }
  }

  const result = finishBlackjack(game);
  await interaction.update({ embeds: [blackjackEmbed(game, result)], components: [] });
}

// --- Roulette ---

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const ROULETTE_BETS = {
  rouge: { label: "Rouge", emoji: "🔴", multiplier: 2 },
  noir: { label: "Noir", emoji: "⚫", multiplier: 2 },
  vert: { label: "Vert", emoji: "🟢", multiplier: 36 },
};

function rouletteColor(n) {
  if (n === 0) return "vert";
  return RED_NUMBERS.has(n) ? "rouge" : "noir";
}

async function playRoulette(interaction, color, bet) {
  const userId = interaction.user.id;
  const err = takeBet(userId, bet, "roulette");
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
    return;
  }

  const n = randInt(37);
  const landed = rouletteColor(n);
  const choice = ROULETTE_BETS[color];
  const won = landed === color;
  const payout = won ? bet * choice.multiplier : 0;
  const paid = pay(userId, payout, "roulette");

  const embed = new EmbedBuilder()
    .setColor(won ? 0x2ecc71 : 0xe74c3c)
    .setTitle("🎡 Roulette")
    .setDescription(
      `Vous misez **${formatEuro(bet)}** sur ${choice.emoji} **${choice.label}**.\n\n` +
        `La bille s'arrête sur **${n} ${ROULETTE_BETS[landed].emoji} ${ROULETTE_BETS[landed].label}**.\n\n` +
        (won ? `🎉 **Vous gagnez ${formatEuro(payout)} !**${capNote(payout, paid)}` : `😔 Perdu — ${formatEuro(bet)}.`)
    )
    .addFields({ name: "Solde", value: formatEuro(readBalance(userId)) });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// --- Machine à sous ---

// Probabilités et gains calculés pour un retour joueur d'environ 93 %
// (hors jackpot).
const SLOT_SYMBOLS = [
  { emoji: "🍒", weight: 30, triple: 6 },
  { emoji: "🍋", weight: 25, triple: 10 },
  { emoji: "🍇", weight: 20, triple: 20 },
  { emoji: "🔔", weight: 12, triple: 60 },
  { emoji: "💎", weight: 8, triple: 200 },
  { emoji: "7️⃣", weight: 5, triple: null }, // jackpot
];
const SLOT_PAIR_MULTIPLIER = 0.5;
const SLOT_WEIGHT_TOTAL = SLOT_SYMBOLS.reduce((s, x) => s + x.weight, 0);

function spinSymbol() {
  let r = Math.random() * SLOT_WEIGHT_TOTAL;
  for (const s of SLOT_SYMBOLS) {
    if ((r -= s.weight) < 0) return s;
  }
  return SLOT_SYMBOLS[0];
}

async function playSlots(interaction, spins, bet, client) {
  const userId = interaction.user.id;
  const err = takeBet(userId, bet * spins, "machine à sous");
  if (err) {
    await interaction.reply({
      content: spins > 1 ? `${err}\n*(${spins} tours × ${formatEuro(bet)} = ${formatEuro(bet * spins)})*` : err,
      ephemeral: true,
    });
    return;
  }

  const lines = [];
  let total = 0;
  let jackpotWon = 0;

  for (let i = 0; i < spins; i++) {
    addToJackpot(round2(bet * JACKPOT_SHARE));
    const reels = [spinSymbol(), spinSymbol(), spinSymbol()];
    const display = reels.map((s) => s.emoji).join(" ");
    let gain = 0;
    let note = "";

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      if (reels[0].triple === null) {
        const state = loadState();
        gain = state.jackpot;
        jackpotWon += gain;
        state.jackpot = JACKPOT_SEED;
        saveState(state);
        panelDirty = true;
        note = " — 💰 **JACKPOT !**";
      } else {
        gain = bet * reels[0].triple;
        note = ` — x${reels[0].triple}`;
      }
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
      gain = bet * SLOT_PAIR_MULTIPLIER;
      note = ` — paire x${SLOT_PAIR_MULTIPLIER.toString().replace(".", ",")}`;
    }

    total += gain;
    lines.push(`${display}${gain > 0 ? ` **+${formatEuro(round2(gain))}**${note}` : ""}`);
  }

  const paid = pay(userId, total, "machine à sous");
  if (paid < round2(total)) lines.push(capNote(total, paid).trim());
  const spent = bet * spins;

  const embed = new EmbedBuilder()
    .setColor(jackpotWon ? 0xd4af37 : total >= spent ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`🎰 Machine à sous${spins > 1 ? ` — ${spins} tours` : ""}`)
    .setDescription(lines.join("\n"))
    .addFields(
      { name: "Misé", value: formatEuro(spent), inline: true },
      { name: "Gagné", value: formatEuro(paid), inline: true },
      { name: "Solde", value: formatEuro(readBalance(userId)), inline: true }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });

  if (jackpotWon) {
    const channel = await client.channels.fetch(CASINO_CHANNEL_ID).catch(() => null);
    require("./feed").post(`💰 **JACKPOT !** ${interaction.user} décroche le jackpot de la machine à sous !`, { stat: "casino" });
    const announce = await channel
      ?.send(`💰🎰 **JACKPOT !** ${interaction.user} vient de remporter le **JACKPOT** à la machine à sous !`)
      .catch(() => null);
    deleteLater(announce, HOUR);
  }
}

// --- Défi entre membres ---

const duels = new Map();
let duelCounter = 0;

async function createDuel(interaction, opponentId, bet, client) {
  const challenger = interaction.member;
  if (opponentId === challenger.id) {
    await interaction.reply({ content: "❌ Vous ne pouvez pas vous défier vous-même.", ephemeral: true });
    return;
  }
  const opponent = await interaction.guild.members.fetch(opponentId).catch(() => null);
  if (!opponent || opponent.user.bot) {
    await interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    return;
  }
  if (isFrozen(challenger.id) || isFrozen(opponentId)) {
    await interaction.reply({ content: "🔒 Un des deux comptes est gelé par l'IRF.", ephemeral: true });
    return;
  }
  if (!hasAccess(opponent)) {
    await interaction.reply({ content: `❌ ${opponent} n'a pas accès au casino.`, ephemeral: true });
    return;
  }
  if (bet < MIN_BET) {
    await interaction.reply({ content: `❌ Mise minimum : **${formatEuro(MIN_BET)}**.`, ephemeral: true });
    return;
  }
  if (readBalance(challenger.id) < bet) {
    await interaction.reply({ content: "❌ Solde insuffisant pour ce défi.", ephemeral: true });
    return;
  }

  const channel = await client.channels.fetch(CASINO_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    await interaction.reply({ content: "❌ Salon casino introuvable.", ephemeral: true });
    return;
  }

  const id = String(++duelCounter);
  const tax = round2(bet * 2 * P().duelTax);
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("⚔️ Défi au casino")
    .setDescription(
      `${challenger} défie ${opponent} pour **${formatEuro(bet)}** chacun !\n\n` +
        `Le gagnant remporte **${formatEuro(bet * 2 - tax)}** (taxe de la maison : ${formatEuro(tax)}).\n` +
        `*Le défi expire <t:${Math.floor((Date.now() + DUEL_TIMEOUT_MS) / 1000)}:R>.*`
    );

  const message = await channel.send({
    content: `${opponent}`,
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`casino_duel_accept_${id}`).setLabel("Accepter").setEmoji("⚔️").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`casino_duel_decline_${id}`).setLabel("Refuser").setStyle(ButtonStyle.Secondary)
      ),
    ],
  });

  const duel = { id, challengerId: challenger.id, opponentId, bet, message };
  duel.timeout = setTimeout(() => {
    if (!duels.delete(id)) return;
    message
      .edit({ embeds: [EmbedBuilder.from(embed).setColor(0x95a5a6).setFooter({ text: "Défi expiré" })], components: [] })
      .catch(() => null);
    deleteLater(message, MINUTE);
  }, DUEL_TIMEOUT_MS);
  duels.set(id, duel);

  await interaction.reply({ content: `⚔️ Défi envoyé à ${opponent} dans ${channel}.`, ephemeral: true });
}

async function handleDuelResponse(interaction, accepted, id) {
  const duel = duels.get(id);
  if (!duel) {
    await interaction.update({ components: [] });
    return;
  }

  const userId = interaction.user.id;
  if (!accepted && (userId === duel.opponentId || userId === duel.challengerId)) {
    clearTimeout(duel.timeout);
    duels.delete(id);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x95a5a6)
      .setFooter({ text: userId === duel.opponentId ? "Défi refusé" : "Défi annulé" });
    await interaction.update({ embeds: [embed], components: [] });
    deleteInteractionMessageLater(interaction, MINUTE);
    return;
  }
  if (userId !== duel.opponentId) {
    await interaction.reply({ content: "❌ Ce défi ne vous est pas adressé.", ephemeral: true });
    return;
  }

  const err = playError(interaction.member);
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
    return;
  }

  // Débit des deux joueurs
  if (changeBalance(duel.opponentId, -duel.bet, "Casino — défi (mise)") === null) {
    await interaction.reply({ content: "❌ Solde insuffisant pour accepter ce défi.", ephemeral: true });
    return;
  }
  if (changeBalance(duel.challengerId, -duel.bet, "Casino — défi (mise)") === null) {
    changeBalance(duel.opponentId, duel.bet, "Casino — défi annulé (remboursement)", { force: true });
    clearTimeout(duel.timeout);
    duels.delete(id);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x95a5a6)
      .setFooter({ text: "Défi annulé — le lanceur n'a plus assez d'argent" });
    await interaction.update({ embeds: [embed], components: [] });
    deleteInteractionMessageLater(interaction, MINUTE);
    return;
  }

  clearTimeout(duel.timeout);
  duels.delete(id);
  markBalancesDirty();

  const pot = duel.bet * 2;
  const tax = round2(pot * P().duelTax);
  const winnerId = Math.random() < 0.5 ? duel.challengerId : duel.opponentId;
  const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
  const won = round2(pot - tax);
  const paidDuel = round2(Math.max(0, Math.min(won, CASINO_CAP - readBalance(winnerId))));
  if (paidDuel > 0) changeBalance(winnerId, paidDuel, "Casino — défi (gain)", { force: true });
  addToTreasury("taxesDefis", tax);
  addToJackpot(tax);

  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("⚔️ Défi — Résultat")
    .setDescription(
      `🪙 La pièce est lancée…\n\n🏆 <@${winnerId}> remporte **${formatEuro(won)}** face à <@${loserId}> !${capNote(won, paidDuel)}\n` +
        `*Taxe de la maison : ${formatEuro(tax)} (versée au jackpot)*`
    )
    .setTimestamp();
  await interaction.update({ content: "", embeds: [embed], components: [] });
  deleteInteractionMessageLater(interaction, 5 * MINUTE);
}

// --- Routage des interactions ---

async function handleCasinoInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("casino_")) return false;

  if (interaction.isButton() && id === "casino_licence_buy") {
    await handleLicencePurchase(interaction, client);
    return true;
  }

  // Demandes d'accès
  if (interaction.isButton() && id === "casino_access_request") {
    await handleAccessRequest(interaction, client);
    return true;
  }
  if (interaction.isButton() && id.startsWith("casino_access_")) {
    const [, , decision, userId] = id.split("_");
    await handleAccessDecision(interaction, decision === "ok", userId, client);
    return true;
  }

  // Blackjack en cours
  if (interaction.isButton() && id.startsWith("casino_bj_")) {
    await handleBlackjackAction(interaction, id.slice("casino_bj_".length));
    return true;
  }

  // Réponse à un défi
  if (interaction.isButton() && id.startsWith("casino_duel_")) {
    const [, , decision, duelId] = id.split("_");
    await handleDuelResponse(interaction, decision === "accept", duelId);
    return true;
  }

  // Tout le reste nécessite d'avoir accès et que le casino soit ouvert
  const err = playError(interaction.member);
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
    return true;
  }

  if (interaction.isButton()) {
    const userId = interaction.user.id;
    if (id === "casino_play_blackjack") {
      await interaction.showModal(betModal("casino_modal_blackjack", "🃏 Blackjack", userId));
    } else if (id === "casino_play_roulette") {
      await interaction.reply({
        content: "🎡 Sur quelle couleur misez-vous ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            Object.entries(ROULETTE_BETS).map(([key, b]) =>
              new ButtonBuilder()
                .setCustomId(`casino_roulette_${key}`)
                .setLabel(`${b.label} (x${b.multiplier})`)
                .setEmoji(b.emoji)
                .setStyle(key === "vert" ? ButtonStyle.Success : ButtonStyle.Secondary)
            )
          ),
        ],
      });
    } else if (id.startsWith("casino_roulette_")) {
      const color = id.slice("casino_roulette_".length);
      await interaction.showModal(
        betModal(`casino_modal_roulette_${color}`, `🎡 Roulette — ${ROULETTE_BETS[color].label}`, userId)
      );
    } else if (id === "casino_play_slots") {
      await interaction.reply({
        content: "🎰 Combien de tours d'affilée ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            [1, 5, 10].map((n) =>
              new ButtonBuilder()
                .setCustomId(`casino_slots_${n}`)
                .setLabel(n === 1 ? "1 tour" : `x${n} tours`)
                .setStyle(ButtonStyle.Primary)
            )
          ),
        ],
      });
    } else if (id.startsWith("casino_slots_")) {
      const spins = Number(id.slice("casino_slots_".length));
      await interaction.showModal(
        betModal(`casino_modal_slots_${spins}`, `🎰 Machine à sous — ${spins} tour(s)`, userId, true)
      );
    } else if (id === "casino_play_duel") {
      await interaction.reply({
        content: "⚔️ Qui voulez-vous défier ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder().setCustomId("casino_duel_select").setPlaceholder("Choisir un membre")
          ),
        ],
      });
    }
    return true;
  }

  if (interaction.isUserSelectMenu() && id === "casino_duel_select") {
    const opponentId = interaction.values[0];
    await interaction.showModal(
      betModal(`casino_modal_duel_${opponentId}`, "⚔️ Défi — mise de chaque joueur", interaction.user.id)
    );
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith("casino_modal_")) {
    const bet = parseBet(interaction.fields.getTextInputValue("mise"));
    const [, , game, extra] = id.split("_");
    if (game === "blackjack") await startBlackjack(interaction, bet);
    else if (game === "roulette") await playRoulette(interaction, extra, bet);
    else if (game === "slots") await playSlots(interaction, Number(extra), bet, client);
    else if (game === "duel") await createDuel(interaction, extra, bet, client);
    return true;
  }

  return false;
}

module.exports = {
  setupCasino,
  getLicenceDates,
  LICENCE_ROLE_ID,
  IRF_ROLE_ID,
  TICKET_CATEGORY_ID,
  handleCasinoInteraction,
  CASINO_ACCESS_ROLE_ID,
  ENTREPRENEUR_ROLE_ID,
  SITUATION_DELICATE_ROLE_ID,
};
