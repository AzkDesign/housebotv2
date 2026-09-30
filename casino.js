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
} = require("discord.js");
const {
  changeBalance,
  readBalance,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
  ECONOMIE_LOG_CHANNEL_ID,
} = require("./economie");

const CASINO_CHANNEL_ID = "1527054335928827954";
const CASINO_ACCESS_ROLE_ID = "1554940931617071206";
const ENTREPRENEUR_ROLE_ID = "1554940569732517909";
const SITUATION_DELICATE_ROLE_ID = "1554940813522505778";

const PANEL_TITLE = "🎰 Casino de la Maison";
const MIN_BET = 10;
const JACKPOT_SEED = 1000;
const JACKPOT_SHARE = 0.02; // part de chaque mise de machine à sous versée au jackpot
const DUEL_TAX = 0.05; // taxe de la maison sur le pot d'un défi, versée au jackpot
const BLACKJACK_TIMEOUT_MS = 3 * 60 * 1000;
const DUEL_TIMEOUT_MS = 5 * 60 * 1000;

// Ouverture : du vendredi 20h au lundi 2h (heure de Paris).
// Minutes depuis lundi 00h00.
const OPEN_AT = 4 * 1440 + 20 * 60;
const CLOSE_AT = 2 * 60;
const SCHEDULE_TEXT = "du **vendredi 20h** au **lundi 2h** (heure de Paris)";

const DATA_DIR = process.env.DATA_DIR || __dirname;
const STATE_FILE = path.join(DATA_DIR, "casino-state.json");

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
  const { open, until } = getSchedule();
  if (!open) {
    return `🔒 Le casino est **fermé**. Réouverture <t:${Math.floor(until / 1000)}:R> (${SCHEDULE_TEXT}).`;
  }
  if (!hasAccess(member)) {
    return "🎟️ Vous n'avez pas encore accès au casino. Cliquez sur **Demander l'accès au casino**.";
  }
  return null;
}

function parseBet(raw) {
  const n = parseInt(String(raw).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

// Débite la mise ; renvoie un message d'erreur ou null.
function takeBet(userId, amount) {
  if (amount < MIN_BET) return `❌ Mise minimum : **${formatEuro(MIN_BET)}**.`;
  if (changeBalance(userId, -amount) === null) {
    return `❌ Solde insuffisant (vous avez **${formatEuro(readBalance(userId))}**).`;
  }
  markBalancesDirty();
  return null;
}

function pay(userId, amount) {
  if (amount > 0) {
    changeBalance(userId, round2(amount));
    markBalancesDirty();
  }
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
        `*Mise minimum : ${formatEuro(MIN_BET)}. La maison garde toujours un avantage.*`
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
          await channel
            ?.send(`🎰 **Le casino est ouvert !** <@&${CASINO_ACCESS_ROLE_ID}> <@&${ENTREPRENEUR_ROLE_ID}>`)
            .catch(() => null);
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

// --- Demande d'accès ---

async function handleAccessRequest(interaction, client) {
  const member = interaction.member;

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

  const log = await client.channels.fetch(ECONOMIE_LOG_CHANNEL_ID).catch(() => null);
  if (!log?.isTextBased()) {
    await interaction.reply({
      content: "❌ Impossible d'envoyer la demande. Contactez un gérant.",
      ephemeral: true,
    });
    return;
  }

  const profil = member.roles.cache.has(SITUATION_DELICATE_ROLE_ID)
    ? "Personne en situation délicate"
    : "Non renseigné";

  const embed = new EmbedBuilder()
    .setColor(0xe91e63)
    .setTitle("🎟️ Demande d'accès au casino")
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .addFields(
      { name: "Membre", value: `${member} (\`${member.user.tag}\`)` },
      { name: "Profil", value: profil, inline: true },
      { name: "Solde", value: formatEuro(readBalance(member.id)), inline: true }
    )
    .setFooter({ text: "Réservé aux gérants" })
    .setTimestamp();

  await log.send({
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

  await interaction.reply({
    content: "📨 Votre demande d'accès a été transmise aux gérants. Vous serez prévenu(e) en message privé.",
    ephemeral: true,
  });
}

async function handleAccessDecision(interaction, accepted, userId) {
  if (!isGerant(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé aux gérants.", ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await interaction.update({ components: [] });
    await interaction.followUp({ content: "❌ Ce membre n'est plus sur le serveur.", ephemeral: true });
    return;
  }

  if (accepted) await member.roles.add(CASINO_ACCESS_ROLE_ID).catch(() => null);

  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
    .setFooter({ text: `${accepted ? "Acceptée" : "Refusée"} par ${interaction.user.tag}` });
  await interaction.update({ embeds: [embed], components: [] });

  await member
    .send(
      accepted
        ? `🎰 Votre demande d'accès au casino a été **acceptée** ! Il est ouvert ${SCHEDULE_TEXT}.`
        : "🎰 Votre demande d'accès au casino a été **refusée**."
    )
    .catch(() => null);
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
function finishBlackjack(game) {
  clearTimeout(game.timeout);
  blackjackGames.delete(game.userId);

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
  pay(game.userId, result.payout);
  return result;
}

async function startBlackjack(interaction, bet) {
  const userId = interaction.user.id;
  if (blackjackGames.has(userId)) {
    await interaction.reply({ content: "🃏 Terminez d'abord votre partie en cours.", ephemeral: true });
    return;
  }
  const err = takeBet(userId, bet);
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
    pay(userId, result.payout);
    await interaction.reply({ embeds: [blackjackEmbed(game, result)], ephemeral: true });
    return;
  }

  blackjackGames.set(userId, game);
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
    if (changeBalance(game.userId, -game.bet) === null) {
      await interaction.reply({ content: "❌ Solde insuffisant pour doubler.", ephemeral: true });
      return;
    }
    markBalancesDirty();
    game.bet *= 2;
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
  const err = takeBet(userId, bet);
  if (err) {
    await interaction.reply({ content: err, ephemeral: true });
    return;
  }

  const n = randInt(37);
  const landed = rouletteColor(n);
  const choice = ROULETTE_BETS[color];
  const won = landed === color;
  const payout = won ? bet * choice.multiplier : 0;
  pay(userId, payout);

  const embed = new EmbedBuilder()
    .setColor(won ? 0x2ecc71 : 0xe74c3c)
    .setTitle("🎡 Roulette")
    .setDescription(
      `Vous misez **${formatEuro(bet)}** sur ${choice.emoji} **${choice.label}**.\n\n` +
        `La bille s'arrête sur **${n} ${ROULETTE_BETS[landed].emoji} ${ROULETTE_BETS[landed].label}**.\n\n` +
        (won ? `🎉 **Vous gagnez ${formatEuro(payout)} !**` : `😔 Perdu — ${formatEuro(bet)}.`)
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
  const err = takeBet(userId, bet * spins);
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

  pay(userId, total);
  const spent = bet * spins;

  const embed = new EmbedBuilder()
    .setColor(jackpotWon ? 0xd4af37 : total >= spent ? 0x2ecc71 : 0xe74c3c)
    .setTitle(`🎰 Machine à sous${spins > 1 ? ` — ${spins} tours` : ""}`)
    .setDescription(lines.join("\n"))
    .addFields(
      { name: "Misé", value: formatEuro(spent), inline: true },
      { name: "Gagné", value: formatEuro(round2(total)), inline: true },
      { name: "Solde", value: formatEuro(readBalance(userId)), inline: true }
    );

  await interaction.reply({ embeds: [embed], ephemeral: true });

  if (jackpotWon) {
    const channel = await client.channels.fetch(CASINO_CHANNEL_ID).catch(() => null);
    await channel
      ?.send(`💰🎰 **JACKPOT !** ${interaction.user} vient de remporter **${formatEuro(jackpotWon)}** à la machine à sous !`)
      .catch(() => null);
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
  const tax = round2(bet * 2 * DUEL_TAX);
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
  if (changeBalance(duel.opponentId, -duel.bet) === null) {
    await interaction.reply({ content: "❌ Solde insuffisant pour accepter ce défi.", ephemeral: true });
    return;
  }
  if (changeBalance(duel.challengerId, -duel.bet) === null) {
    changeBalance(duel.opponentId, duel.bet);
    clearTimeout(duel.timeout);
    duels.delete(id);
    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x95a5a6)
      .setFooter({ text: "Défi annulé — le lanceur n'a plus assez d'argent" });
    await interaction.update({ embeds: [embed], components: [] });
    return;
  }

  clearTimeout(duel.timeout);
  duels.delete(id);
  markBalancesDirty();

  const pot = duel.bet * 2;
  const tax = round2(pot * DUEL_TAX);
  const winnerId = Math.random() < 0.5 ? duel.challengerId : duel.opponentId;
  const loserId = winnerId === duel.challengerId ? duel.opponentId : duel.challengerId;
  pay(winnerId, pot - tax);
  addToJackpot(tax);

  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("⚔️ Défi — Résultat")
    .setDescription(
      `🪙 La pièce est lancée…\n\n🏆 <@${winnerId}> remporte **${formatEuro(pot - tax)}** face à <@${loserId}> !\n` +
        `*Taxe de la maison : ${formatEuro(tax)} (versée au jackpot)*`
    )
    .setTimestamp();
  await interaction.update({ content: "", embeds: [embed], components: [] });
}

// --- Routage des interactions ---

async function handleCasinoInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("casino_")) return false;

  // Demandes d'accès
  if (interaction.isButton() && id === "casino_access_request") {
    await handleAccessRequest(interaction, client);
    return true;
  }
  if (interaction.isButton() && id.startsWith("casino_access_")) {
    const [, , decision, userId] = id.split("_");
    await handleAccessDecision(interaction, decision === "ok", userId);
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
  handleCasinoInteraction,
  CASINO_ACCESS_ROLE_ID,
  ENTREPRENEUR_ROLE_ID,
  SITUATION_DELICATE_ROLE_ID,
};
