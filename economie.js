const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");

const RICHEST_CHANNEL_ID = "1510702663535296623";
const ECONOMIE_LOG_CHANNEL_ID = "1510687492896981102";
const GERANTS_ROLE_ID = "1509985135565475850";
const RICHEST_TOP = 10;
const RICHEST_TITLE = "💰 Classement — Plus riches";
const OLD_LEADERBOARD_TITLE = "🏆 Classement — Plus actifs";

// DATA_DIR permet de stocker les soldes sur un volume Railway (ex. /data)
// pour qu'ils ne soient pas effacés à chaque redéploiement.
const DATA_DIR = process.env.DATA_DIR || __dirname;
const STATE_FILE = path.join(DATA_DIR, "economie-state.json");

const TRANSACTIONS_KEPT = 30;

function normalizeState(data) {
  data.balances ??= {};
  data.transactions ??= {}; // userId -> [{ at, delta, after, label }]
  data.frozen ??= {}; // userId -> { by, reason, at }
  data.treasury ??= {}; // clé -> montant cumulé (amendes, licences, casino…)
  data.taxDebts ??= {}; // userId -> { amount, weeks } : dette fiscale
  return data;
}

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return normalizeState(data);
  } catch {
    return normalizeState({ leaderboardMessageId: null });
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function formatEuro(amount) {
  return (
    amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

function isGerant(member) {
  return (
    member?.roles.cache.has(GERANTS_ROLE_ID) ||
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    false
  );
}

function getBalance(state, userId) {
  return state.balances[userId] ?? 0;
}

function recordTransaction(state, userId, delta, after, label) {
  const list = (state.transactions[userId] ??= []);
  list.push({ at: Date.now(), delta, after, label });
  if (list.length > TRANSACTIONS_KEPT) list.splice(0, list.length - TRANSACTIONS_KEPT);
}

// Ajoute (ou retire si négatif) un montant au solde d'un membre.
// Renvoie le nouveau solde, ou null si le solde serait négatif
// ou si le compte est gelé (sauf avec force).
function changeBalance(userId, delta, label = "—", { force = false } = {}) {
  const state = loadState();
  if (state.frozen[userId] && !force) return null;
  const after = Math.round((getBalance(state, userId) + delta) * 100) / 100;
  if (after < 0) return null;
  state.balances[userId] = after;
  recordTransaction(state, userId, delta, after, label);

  // Saisie automatique : un revenu rembourse d'abord la dette fiscale.
  const debt = state.taxDebts[userId];
  if (delta > 0 && debt?.amount > 0) {
    const seized = Math.min(delta, debt.amount);
    debt.amount = Math.round((debt.amount - seized) * 100) / 100;
    if (debt.amount <= 0) delete state.taxDebts[userId];
    state.balances[userId] = Math.round((after - seized) * 100) / 100;
    recordTransaction(state, userId, -seized, state.balances[userId], "Saisie fiscale (dette d'impôts)");
    state.treasury.recouvrement = Math.round(((state.treasury.recouvrement ?? 0) + seized) * 100) / 100;
  }

  saveState(state);
  return state.balances[userId];
}

function getTaxDebt(userId) {
  return loadState().taxDebts[userId] ?? null;
}

function setTaxDebt(userId, debt) {
  const state = loadState();
  if (debt && debt.amount > 0) state.taxDebts[userId] = debt;
  else delete state.taxDebts[userId];
  saveState(state);
}

function addToTreasury(key, amount) {
  const state = loadState();
  state.treasury[key] = Math.round(((state.treasury[key] ?? 0) + amount) * 100) / 100;
  saveState(state);
}

function isFrozen(userId) {
  return Boolean(loadState().frozen[userId]);
}

function setFrozen(userId, info) {
  const state = loadState();
  if (info) state.frozen[userId] = info;
  else delete state.frozen[userId];
  saveState(state);
}

function readBalance(userId) {
  return getBalance(loadState(), userId);
}

// --- Classement des plus riches ---

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function buildRichestEmbed(state) {
  const ranked = Object.entries(state.balances)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, RICHEST_TOP);

  const body = ranked.length
    ? ranked
        .map(([userId, amount], i) => {
          const rank = RANK_MEDALS[i] ?? `**${i + 1}.**`;
          return `${rank} <@${userId}> — **${formatEuro(amount)}**`;
        })
        .join("\n")
    : "*Aucune fortune enregistrée pour le moment.*";

  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle(RICHEST_TITLE)
    .setDescription(`Les **${RICHEST_TOP} plus grandes fortunes** de la Maison.\n\n${body}`)
    .setFooter({ text: "Consultez votre solde avec /solde • Mis à jour en direct" })
    .setTimestamp();
}

async function findBotMessages(channel, client, title) {
  const messages = await channel.messages.fetch({ limit: 25 }).catch(() => null);
  if (!messages) return [];
  return [...messages.values()].filter(
    (m) => m.author.id === client.user.id && m.embeds[0]?.title === title
  );
}

// Modifie le classement existant (ou le publie s'il n'existe pas)
async function refreshRichestLeaderboard(client) {
  const channel = await client.channels.fetch(RICHEST_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon classement ${RICHEST_CHANNEL_ID} introuvable`);
    return;
  }

  const state = loadState();
  const embed = buildRichestEmbed(state);

  let message = state.leaderboardMessageId
    ? await channel.messages.fetch(state.leaderboardMessageId).catch(() => null)
    : null;
  if (!message) {
    [message] = await findBotMessages(channel, client, RICHEST_TITLE);
  }

  if (message) {
    await message.edit({ embeds: [embed] });
  } else {
    message = await channel.send({ embeds: [embed] });
  }

  if (state.leaderboardMessageId !== message.id) {
    state.leaderboardMessageId = message.id;
    saveState(state);
  }
}

async function setupRichestLeaderboard(client) {
  const channel = await client.channels.fetch(RICHEST_CHANNEL_ID).catch(() => null);
  if (channel?.isTextBased()) {
    // Supprime l'ancien classement « Plus actifs » remplacé par celui-ci
    for (const old of await findBotMessages(channel, client, OLD_LEADERBOARD_TITLE)) {
      await old.delete().catch(() => null);
    }
  }
  await refreshRichestLeaderboard(client);

  // Rafraîchit aussi chaque dimanche à 9h (pseudos, membres partis…)
  cron.schedule(
    "0 9 * * 0",
    () => {
      refreshRichestLeaderboard(client).catch((err) =>
        console.error("Classement plus riches:", err.message)
      );
    },
    { timezone: "Europe/Paris" }
  );
  console.log("Classement des plus riches prêt");
}

// --- Commandes ---

async function handleSolde(interaction) {
  const state = loadState();
  const balance = getBalance(state, interaction.user.id);
  const ranked = Object.entries(state.balances)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const position = ranked.findIndex(([userId]) => userId === interaction.user.id);

  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("💰 Votre solde")
    .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
    .setDescription(
      `${interaction.user}\n\n💶 **${formatEuro(balance)}**` +
        (position >= 0 ? `\n🏆 Classement : **${position + 1}ᵉ** fortune de la Maison` : "")
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleArgent(interaction, client) {
  if (!isGerant(interaction.member)) {
    await interaction.reply({
      content: "❌ Seuls les gérants peuvent modifier l'argent des membres.",
      ephemeral: true,
    });
    return;
  }

  const action = interaction.options.getString("action", true);
  const target = interaction.options.getUser("membre", true);
  const amount = interaction.options.getInteger("montant", true);
  const reason = interaction.options.getString("raison") ?? "—";

  if (target.bot) {
    await interaction.reply({ content: "❌ Un bot ne peut pas avoir de solde.", ephemeral: true });
    return;
  }

  const state = loadState();
  if (state.frozen[target.id]) {
    await interaction.reply({
      content: `🔒 Le compte de ${target} est **gelé** par l'IRF : aucune modification possible.`,
      ephemeral: true,
    });
    return;
  }
  const before = getBalance(state, target.id);
  let after;
  if (action === "ajouter") after = before + amount;
  else if (action === "retirer") after = before - amount;
  else after = amount;

  if (after < 0) {
    await interaction.reply({
      content: `❌ ${target} n'a que **${formatEuro(before)}** : impossible de retirer ${formatEuro(amount)}.`,
      ephemeral: true,
    });
    return;
  }

  state.balances[target.id] = after;
  recordTransaction(state, target.id, after - before, after, `/argent par ${interaction.user.tag} — ${reason}`.slice(0, 120));
  saveState(state);

  const actionLabel = { ajouter: "➕ Ajout", retirer: "➖ Retrait", definir: "✏️ Nouveau solde" }[action];
  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("💰 Solde modifié")
    .addFields(
      { name: "Membre", value: `${target}`, inline: true },
      { name: actionLabel, value: formatEuro(amount), inline: true },
      { name: "Solde", value: `${formatEuro(before)} → **${formatEuro(after)}**`, inline: true },
      { name: "Raison", value: reason },
      { name: "Par", value: `${interaction.user}` }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });

  const log = await client.channels.fetch(ECONOMIE_LOG_CHANNEL_ID).catch(() => null);
  if (log?.isTextBased()) await log.send({ embeds: [embed] }).catch(() => null);

  await refreshRichestLeaderboard(client).catch((err) =>
    console.error("Classement plus riches:", err.message)
  );
}

async function handleEconomieInteraction(interaction, client) {
  if (!interaction.isChatInputCommand()) return false;
  if (interaction.commandName === "solde") {
    await handleSolde(interaction);
    return true;
  }
  if (interaction.commandName === "argent") {
    await handleArgent(interaction, client);
    return true;
  }
  return false;
}

module.exports = {
  setupRichestLeaderboard,
  refreshRichestLeaderboard,
  handleEconomieInteraction,
  loadState,
  changeBalance,
  readBalance,
  addToTreasury,
  isFrozen,
  setFrozen,
  getTaxDebt,
  setTaxDebt,
  formatEuro,
  isGerant,
  ECONOMIE_LOG_CHANNEL_ID,
};
