const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  loadState: loadEconomie,
  changeBalance,
  readBalance,
  addToTreasury,
  setFrozen,
  isFrozen,
  getTaxDebt,
  setTaxDebt,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
} = require("./economie");
const { IRF_ROLE_ID, SITUATION_DELICATE_ROLE_ID } = require("./casino");
const { hasJob, getCategoryId } = require("./entreprises");
// Multiplicateurs de taxe d'habitation et d'impôt sur la fortune réglés par le maire
const { P, formatLever } = require("./politique");
const { findOrCreateChannel } = require("./salons");
const { deleteLater, deleteInteractionMessageLater, getDossiersChannel, MINUTE, HOUR } = require("./nettoyage");

const IRF_CHANNEL_ID = "1527524719094534185";
// La taxe d'habitation dépend du quartier où l'on dort (voir chambres.js)
const { QUARTIERS, getResidence } = require("./chambres");
const CHAMBRES_STATE_FILE = require("./data").dataFile("chambres-state.json");

// --- Barème ---

// Impôt sur la fortune, par tranches (taux hebdomadaires)
const WEALTH_BRACKETS = [
  { from: 0, to: 10000, rate: 0 },
  { from: 10000, to: 50000, rate: 0.01 },
  { from: 50000, to: 200000, rate: 0.02 },
  { from: 200000, to: Infinity, rate: 0.03 },
];

const NEW_MEMBER_EXEMPTION_MS = 14 * 24 * 60 * 60 * 1000;
const DELICATE_REDUCTION = 0.5; // situation délicate avec un emploi : −50 %
const DEBT_PENALTY = 0.1; // la dette augmente de 10 % par semaine
const DEBT_WEEKS_ALERT = 3;
const RANDOM_CONTROLS = 3;

// Seuils des contrôles fiscaux (sur les 7 derniers jours)
const SUSPICION = {
  argentCredit: 5000, // argent reçu via /argent
  casinoWin: 10000, // un gros gain au casino
  sameCompanyInvoices: 3, // factures payées à la même entreprise
  suddenGain: 20000, // revenus de la semaine…
  suddenGainShare: 0.5, // … représentant plus de la moitié du solde
};

const PANEL_TITLE = "🧾 Centre des impôts";

function round2(n) {
  return Math.round(n * 100) / 100;
}

// --- Données ---

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("impots-state.json");
let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.controls ??= {};
  state.counter ??= 0;
  return state;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isIrf(member) {
  return member?.roles.cache.has(IRF_ROLE_ID) || isGerant(member);
}

function roomOccupants() {
  try {
    const data = JSON.parse(fs.readFileSync(CHAMBRES_STATE_FILE, "utf8"));
    return Object.values(data.rooms ?? {}).flat();
  } catch {
    return [];
  }
}

function wealthTax(balance) {
  let tax = 0;
  for (const b of WEALTH_BRACKETS) {
    if (balance > b.from) tax += (Math.min(balance, b.to) - b.from) * b.rate;
  }
  return round2(tax * P().wealthMultiplier);
}

function housingTax(quartier) {
  return round2(quartier.tax * P().housingMultiplier);
}

// Calcule l'impôt de la semaine d'un membre, avec le détail.
function computeTax(member, balance) {
  const lines = [];
  const residence = getResidence(member.id);
  const housing = residence ? housingTax(residence.quartier) : 0;
  if (residence) {
    lines.push([`🏠 Taxe d'habitation — ${residence.quartier.emoji} ${residence.quartier.name} (${residence.room.name})`, housing]);
  }
  const wealth = wealthTax(balance);
  if (wealth > 0) lines.push(["💎 Impôt sur la fortune", wealth]);
  let total = round2(housing + wealth);

  const joinedAt = member.joinedTimestamp ?? 0;
  const delicate = member.roles?.cache.has(SITUATION_DELICATE_ROLE_ID);
  let exemption = null;

  if (Date.now() - joinedAt < NEW_MEMBER_EXEMPTION_MS) {
    exemption = `🌱 Nouveau membre : exonéré jusqu'au <t:${Math.floor((joinedAt + NEW_MEMBER_EXEMPTION_MS) / 1000)}:d>`;
    total = 0;
  } else if (delicate && !hasJob(member.id)) {
    exemption = "🤝 Situation délicate sans emploi : exonéré(e)";
    total = 0;
  } else if (delicate) {
    exemption = `🤝 Situation délicate : réduction de ${Math.round(DELICATE_REDUCTION * 100)} %`;
    total = round2(total * (1 - DELICATE_REDUCTION));
  }

  return { lines, housing, wealth, total, exemption };
}

function taxEmbed(member, balance, title) {
  const t = computeTax(member, balance);
  const debt = getTaxDebt(member.id);
  return new EmbedBuilder()
    .setColor(0x2c3e50)
    .setTitle(title)
    .setDescription(
      `Solde pris en compte : **${formatEuro(balance)}**\n\n` +
        (t.lines.length ? t.lines.map(([l, a]) => `${l} : ${formatEuro(a)}`).join("\n") : "*Aucun impôt applicable.*") +
        (t.exemption ? `\n\n${t.exemption}` : "") +
        `\n\n**Total : ${formatEuro(t.total)}**` +
        (debt ? `\n\n⚠️ Dette fiscale : **${formatEuro(debt.amount)}** (${debt.weeks ? `depuis ${debt.weeks} semaine(s), ` : ""}+${Math.round(DEBT_PENALTY * 100)} %/semaine tant qu'elle n'est pas remboursée)` : "")
    );
}

// --- Salon ---

async function ensureChannel(client) {
  const s = load();
  let channel = s.channelId ? await client.channels.fetch(s.channelId).catch(() => null) : null;
  if (channel) return channel;

  const irfChannel = await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null);
  const guild = irfChannel?.guild ?? client.guilds.cache.first();
  if (!guild) return null;
  channel = await findOrCreateChannel(guild, {
    name: "🧾・centre-des-impôts",
    parent: getCategoryId(),
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });
  s.channelId = channel.id;
  save();
  return channel;
}

function bracketsText() {
  const m = P().wealthMultiplier;
  return WEALTH_BRACKETS.map(
    (b) => `${b.to === Infinity ? `au-delà de ${formatEuro(b.from)}` : `${formatEuro(b.from)} → ${formatEuro(b.to)}`} : **${Math.round(b.rate * m * 1000) / 10} %**`
  ).join("\n");
}

function panelMessage() {
  const housing = Object.values(QUARTIERS)
    .sort((a, b) => b.stars - a.stars)
    .map((q) => `${q.emoji} ${q.name} : **${formatEuro(housingTax(q))}**/occupant`)
    .join("\n");
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x2c3e50)
        .setTitle(PANEL_TITLE)
        .setDescription(
          "Les impôts sont prélevés **chaque dimanche à 20h05**, directement sur votre solde. Votre avis d'imposition vous est envoyé en message privé.\n\n" +
            `**🏠 Taxe d'habitation** (par semaine, selon le quartier où vous dormez)\n${housing}\n\n` +
            `**💎 Impôt sur la fortune** (par semaine, par tranches)\n${bracketsText()}\n\n` +
            `🏛️ Taux fixés par la Mairie : habitation ${formatLever("housingMultiplier", P().housingMultiplier)}, fortune ${formatLever("wealthMultiplier", P().wealthMultiplier)}\n\n` +
            "**Exonérations**\n" +
            "🌱 Nouveaux membres : rien à payer pendant 2 semaines\n" +
            "🤝 Situation délicate **sans emploi ni entreprise** : rien à payer\n" +
            `🤝 Situation délicate **avec un emploi** : −${Math.round(DELICATE_REDUCTION * 100)} %\n\n` +
            "**Impayés**\n" +
            `Ce qui ne peut pas être prélevé devient une **dette fiscale** (+${Math.round(DEBT_PENALTY * 100)} % par semaine). ` +
            `Tout argent reçu la rembourse d'abord (saisie automatique). Après ${DEBT_WEEKS_ALERT} semaines, l'IRF peut geler le compte.\n\n` +
            "🔎 L'IRF effectue des **contrôles fiscaux** chaque semaine."
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("tax_notice").setLabel("Mon avis").setEmoji("📄").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("tax_pay").setLabel("Payer ma dette").setEmoji("💳").setStyle(ButtonStyle.Success)
      ),
    ],
  };
}

async function refreshPanel(client) {
  const s = load();
  const channel = await ensureChannel(client);
  if (!channel?.isTextBased()) return;
  let message = s.panelMessageId ? await channel.messages.fetch(s.panelMessageId).catch(() => null) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    message = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (message) await message.edit(panelMessage());
  else message = await channel.send(panelMessage());
  if (s.panelMessageId !== message.id) {
    s.panelMessageId = message.id;
    save();
  }
}

// --- Prélèvement du dimanche ---

async function collectTaxes(client) {
  const irfChannel = await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null);
  const guild = irfChannel?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  await guild.members.fetch().catch(() => null);

  const eco = loadEconomie();
  const ids = new Set([...Object.keys(eco.balances), ...roomOccupants(), ...Object.keys(eco.taxDebts)]);
  const totals = { taxeHabitation: 0, impotFortune: 0 };
  const debtors = [];

  for (const userId of ids) {
    const member = guild.members.cache.get(userId);
    if (!member || member.user.bot) continue;

    // Dette des semaines précédentes : pénalité
    const debt = getTaxDebt(userId);
    if (debt) {
      debt.amount = round2(debt.amount * (1 + DEBT_PENALTY));
      debt.weeks += 1;
      setTaxDebt(userId, debt);
    }

    const balance = readBalance(userId);
    const t = computeTax(member, balance);
    if (t.total <= 0 && !debt) continue;

    let paid = 0;
    if (t.total > 0) {
      paid = Math.min(t.total, balance);
      if (paid > 0) changeBalance(userId, -paid, "Impôts de la semaine", { force: true });
      // Répartition entre les deux impôts, au prorata
      const share = paid / t.total;
      const reduction = t.total / (t.housing + t.wealth || 1);
      totals.taxeHabitation += t.housing * reduction * share;
      totals.impotFortune += t.wealth * reduction * share;

      const missing = round2(t.total - paid);
      if (missing > 0) {
        const current = getTaxDebt(userId) ?? { amount: 0, weeks: 0 };
        current.amount = round2(current.amount + missing);
        setTaxDebt(userId, current);
      }
    }

    // Une dette ancienne se rembourse aussi avec ce qui reste sur le compte.
    const oldDebt = getTaxDebt(userId);
    const left = readBalance(userId);
    if (debt && oldDebt && left > 0) {
      const repaid = Math.min(left, oldDebt.amount);
      changeBalance(userId, -repaid, "Remboursement de dette fiscale", { force: true });
      addToTreasury("recouvrement", repaid);
      oldDebt.amount = round2(oldDebt.amount - repaid);
      setTaxDebt(userId, oldDebt);
    }

    const finalDebt = getTaxDebt(userId);
    if (finalDebt && finalDebt.weeks >= DEBT_WEEKS_ALERT) debtors.push([userId, finalDebt]);

    const embed = taxEmbed(member, balance, "🧾 Votre avis d'imposition").addFields(
      { name: "Prélevé", value: formatEuro(paid), inline: true },
      { name: "Nouveau solde", value: formatEuro(readBalance(userId)), inline: true }
    );
    await member.send({ embeds: [embed] }).catch(() => null);
  }

  if (totals.taxeHabitation > 0) addToTreasury("taxeHabitation", round2(totals.taxeHabitation));
  if (totals.impotFortune > 0) addToTreasury("impotFortune", round2(totals.impotFortune));

  for (const [userId, debt] of debtors) {
    await (await getDossiersChannel(client))?.send({
      content: `<@&${IRF_ROLE_ID}>`,
      allowedMentions: { roles: [IRF_ROLE_ID] },
      embeds: [
        new EmbedBuilder()
          .setColor(0xe74c3c)
          .setTitle("⚠️ Dette fiscale persistante")
          .setDescription(`<@${userId}> doit **${formatEuro(debt.amount)}** depuis **${debt.weeks} semaines**.${isFrozen(userId) ? "\n🔒 Compte déjà gelé." : ""}`),
      ],
      components: isFrozen(userId)
        ? []
        : [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`tax_freeze_${userId}`).setLabel("Geler le compte").setEmoji("🔒").setStyle(ButtonStyle.Danger)
            ),
          ],
    }).catch(() => null);
  }

  await refreshRichestLeaderboard(client).catch(() => null);
  await runControls(client, guild);
}

// --- Contrôles fiscaux ---

function suspicions(userId, eco) {
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const list = (eco.transactions[userId] ?? []).filter((t) => t.at >= since);
  const reasons = [];

  const argent = list.filter((t) => t.delta > 0 && t.label.startsWith("/argent")).reduce((s, t) => s + t.delta, 0);
  if (argent >= SUSPICION.argentCredit) reasons.push(`💰 ${formatEuro(argent)} reçus via /argent`);

  const bigWin = Math.max(0, ...list.filter((t) => t.label.startsWith("Casino") && t.delta > 0).map((t) => t.delta));
  if (bigWin >= SUSPICION.casinoWin) reasons.push(`🎰 Gain au casino de ${formatEuro(bigWin)}`);

  const invoices = {};
  for (const t of list) {
    const m = t.label.match(/^Facture n°\d+ de « (.+) »$/);
    if (m) invoices[m[1]] = (invoices[m[1]] ?? 0) + 1;
  }
  for (const [company, n] of Object.entries(invoices)) {
    if (n >= SUSPICION.sameCompanyInvoices) reasons.push(`🧾 ${n} factures payées à « ${company} »`);
  }

  const income = list.filter((t) => t.delta > 0).reduce((s, t) => s + t.delta, 0);
  const balance = eco.balances[userId] ?? 0;
  if (income >= SUSPICION.suddenGain && income >= balance * SUSPICION.suddenGainShare) {
    reasons.push(`📈 ${formatEuro(income)} de revenus cette semaine (solde ${formatEuro(balance)})`);
  }
  return reasons;
}

async function runControls(client, guild) {
  const eco = loadEconomie();
  const users = Object.keys(eco.balances).filter((id) => guild.members.cache.has(id) && !guild.members.cache.get(id).user.bot);
  const targets = new Map();

  for (const id of users) {
    const reasons = suspicions(id, eco);
    if (reasons.length) targets.set(id, reasons);
  }
  const others = users.filter((id) => !targets.has(id) && (eco.balances[id] ?? 0) > 0).sort(() => Math.random() - 0.5);
  for (const id of others.slice(0, RANDOM_CONTROLS)) targets.set(id, ["🎲 Contrôle aléatoire"]);

  const channel = await getDossiersChannel(client);
  if (!channel?.isTextBased() || !targets.size) return;

  const header = await channel.send(`🔎 **Contrôles fiscaux de la semaine** — ${targets.size} dossier(s) <@&${IRF_ROLE_ID}>`).catch(() => null);
  deleteLater(header, 12 * HOUR);
  const s = load();
  for (const [userId, reasons] of targets) {
    s.counter += 1;
    const id = `c${s.counter}`;
    s.controls[id] = { id, userId, reasons, at: Date.now() };
    const recent = (eco.transactions[userId] ?? []).slice(-8).reverse();
    await channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle(`🔎 Contrôle fiscal n°${s.counter}`)
            .setDescription(
              `<@${userId}> — solde **${formatEuro(eco.balances[userId] ?? 0)}**\n\n**Motifs :**\n${reasons.join("\n")}\n\n**Dernières opérations :**\n` +
                (recent.map((t) => `<t:${Math.floor(t.at / 1000)}:d> ${t.delta >= 0 ? "+" : ""}${formatEuro(t.delta)} — ${t.label}`).join("\n").slice(0, 2500) || "*Aucune*")
            ),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tax_ctrl_ok_${id}`).setLabel("Rien à signaler").setEmoji("✅").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tax_ctrl_fix_${id}`).setLabel("Redressement").setEmoji("⚖️").setStyle(ButtonStyle.Danger)
          ),
        ],
      })
      .catch(() => null);
  }
  save();
}

async function applyRedressement(interaction, control, client) {
  const amount = parseInt(interaction.fields.getTextInputValue("montant").replace(/[^\d]/g, ""), 10) || 0;
  const reason = interaction.fields.getTextInputValue("motif").trim();
  if (amount <= 0) return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });

  const userId = control.userId;
  const balance = readBalance(userId);
  const paid = Math.min(amount, balance);
  if (paid > 0) changeBalance(userId, -paid, `Redressement fiscal — ${reason}`.slice(0, 120), { force: true });
  addToTreasury("redressements", paid);
  const missing = round2(amount - paid);
  if (missing > 0) {
    const debt = getTaxDebt(userId) ?? { amount: 0, weeks: 0 };
    debt.amount = round2(debt.amount + missing);
    setTaxDebt(userId, debt);
  }
  delete load().controls[control.id];
  save();

  await interaction.update({
    embeds: [
      EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(0xe74c3c)
        .setFooter({ text: `⚖️ Redressement de ${formatEuro(amount)} par ${interaction.user.tag}${missing > 0 ? ` (dont ${formatEuro(missing)} en dette)` : ""}` }),
    ],
    components: [],
  });
  deleteInteractionMessageLater(interaction, MINUTE);
  const user = await client.users.fetch(userId).catch(() => null);
  await user
    ?.send(`⚖️ **Redressement fiscal** de ${formatEuro(amount)} suite à un contrôle de l'IRF.\nMotif : ${reason}${missing > 0 ? `\n${formatEuro(missing)} ajoutés à votre dette fiscale.` : ""}`)
    .catch(() => null);
  await refreshRichestLeaderboard(client).catch(() => null);
}

// Bouton « Impôts » du panneau IRF : débiteurs et dossiers ouverts
async function showIrfTaxes(interaction) {
  const eco = loadEconomie();
  const debts = Object.entries(eco.taxDebts).sort((a, b) => b[1].amount - a[1].amount);
  const open = Object.values(load().controls);
  const t = eco.treasury;
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2c3e50)
        .setTitle("🧾 Impôts des particuliers")
        .addFields(
          { name: "🏠 Taxe d'habitation", value: formatEuro(t.taxeHabitation ?? 0), inline: true },
          { name: "💎 Impôt sur la fortune", value: formatEuro(t.impotFortune ?? 0), inline: true },
          { name: "⚖️ Redressements", value: formatEuro(t.redressements ?? 0), inline: true },
          { name: "💳 Dettes recouvrées", value: formatEuro(t.recouvrement ?? 0), inline: true },
          { name: "🔎 Contrôles ouverts", value: String(open.length), inline: true },
          {
            name: `⚠️ Débiteurs (${debts.length})`,
            value:
              debts
                .map(([id, d]) => `<@${id}> — ${formatEuro(d.amount)} (${d.weeks} sem.)${eco.frozen[id] ? " 🔒" : ""}`)
                .join("\n")
                .slice(0, 1024) || "Aucun",
          }
        ),
    ],
    ephemeral: true,
  });
}

// --- Routage ---

async function handleImpotsInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("tax_")) return false;

  if (id === "tax_notice") {
    await interaction.reply({ embeds: [taxEmbed(interaction.member, readBalance(interaction.user.id), "📄 Votre prochain avis (estimation)")], ephemeral: true });
    return true;
  }

  if (id === "tax_pay") {
    const userId = interaction.user.id;
    const debt = getTaxDebt(userId);
    if (!debt) {
      await interaction.reply({ content: "✅ Vous n'avez aucune dette fiscale.", ephemeral: true });
      return true;
    }
    const paid = Math.min(debt.amount, readBalance(userId));
    if (paid <= 0) {
      await interaction.reply({ content: `❌ Solde vide. Dette : **${formatEuro(debt.amount)}**.`, ephemeral: true });
      return true;
    }
    changeBalance(userId, -paid, "Remboursement de dette fiscale", { force: true });
    addToTreasury("recouvrement", paid);
    debt.amount = round2(debt.amount - paid);
    setTaxDebt(userId, debt);
    await interaction.reply({
      content: debt.amount > 0 ? `💳 ${formatEuro(paid)} remboursés. Reste dû : **${formatEuro(debt.amount)}**.` : `💳 Dette de ${formatEuro(paid)} **soldée** !`,
      ephemeral: true,
    });
    await refreshRichestLeaderboard(client).catch(() => null);
    return true;
  }

  // Actions IRF
  if (!isIrf(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé à l'IRF.", ephemeral: true });
    return true;
  }

  if (id.startsWith("tax_freeze_")) {
    const userId = id.slice("tax_freeze_".length);
    setFrozen(userId, { by: interaction.user.id, reason: "Dette fiscale persistante", at: Date.now() });
    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setFooter({ text: `🔒 Compte gelé par ${interaction.user.tag}` })],
      components: [],
    });
    deleteInteractionMessageLater(interaction, MINUTE);
    const user = await client.users.fetch(userId).catch(() => null);
    await user?.send("🔒 Votre compte a été **gelé** par l'IRF pour dette fiscale persistante. Remboursez-la au Centre des impôts.").catch(() => null);
    return true;
  }

  const controlId = id.split("_")[3];
  const control = load().controls[controlId];
  if (id.startsWith("tax_ctrl_") || id.startsWith("tax_mfix_")) {
    if (!control) {
      await interaction.update({ components: [] });
      return true;
    }
    if (id.startsWith("tax_ctrl_ok_")) {
      delete state.controls[controlId];
      save();
      await interaction.update({
        embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x2ecc71).setFooter({ text: `✅ Rien à signaler — ${interaction.user.tag}` })],
        components: [],
      });
      deleteInteractionMessageLater(interaction, MINUTE);
    } else if (id.startsWith("tax_ctrl_fix_")) {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`tax_mfix_x_${controlId}`)
          .setTitle("⚖️ Redressement fiscal")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("montant").setLabel("Montant (€)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motif").setLabel("Motif").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300))
          )
      );
    } else {
      await applyRedressement(interaction, control, client);
    }
    return true;
  }
  return false;
}

async function setupImpots(client) {
  load();
  await refreshPanel(client);
  // 20h05 : juste après la clôture des entreprises (salaires versés)
  cron.schedule("5 20 * * 0", () => collectTaxes(client).catch((err) => console.error("Impôts:", err.message)), {
    timezone: "Europe/Paris",
  });
  console.log("Impôts prêts");
}

module.exports = { setupImpots, handleImpotsInteraction, showIrfTaxes, refreshPanel };
