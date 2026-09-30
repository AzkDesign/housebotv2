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
  loadState: loadEconomie,
  changeBalance,
  readBalance,
  addToTreasury,
  isFrozen,
  setFrozen,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
  ECONOMIE_LOG_CHANNEL_ID,
} = require("./economie");
const {
  getLicenceDates,
  LICENCE_ROLE_ID,
  IRF_ROLE_ID,
  TICKET_CATEGORY_ID,
} = require("./casino");
const { showIrfCompanies } = require("./entreprises");
const { showIrfTaxes } = require("./impots");

const IRF_PANEL_CHANNEL_ID = "1527524719094534185";
const PANEL_TITLE = "🏛️ IRF — Institut de Régulation Financière";

const DATA_DIR = process.env.DATA_DIR || __dirname;
const STATE_FILE = path.join(DATA_DIR, "irf-state.json");

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { panelMessageId: null };
  }
}

function saveState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function isIrf(member) {
  return member?.roles.cache.has(IRF_ROLE_ID) || isGerant(member);
}

function ts(ms) {
  return `<t:${Math.floor(ms / 1000)}:f>`;
}

async function sendLog(client, embed) {
  const log = await client.channels.fetch(ECONOMIE_LOG_CHANNEL_ID).catch(() => null);
  if (log?.isTextBased()) await log.send({ embeds: [embed] }).catch(() => null);
}

// --- Panneau ---

const ACTIONS = [
  { id: "comptes", label: "Comptes", emoji: "🔍", style: ButtonStyle.Primary, text: "Liste de tous les comptes et soldes" },
  { id: "geler", label: "Geler", emoji: "🔒", style: ButtonStyle.Danger, text: "Bloquer un compte (enquête)" },
  { id: "degeler", label: "Dégeler", emoji: "🔓", style: ButtonStyle.Success, text: "Débloquer un compte" },
  { id: "transactions", label: "Transactions", emoji: "📋", style: ButtonStyle.Secondary, text: "Historique d'un membre" },
  { id: "amende", label: "Amende", emoji: "💸", style: ButtonStyle.Danger, text: "Infliger une amende financière" },
  { id: "tresorerie", label: "Trésorerie", emoji: "🏛️", style: ButtonStyle.Secondary, text: "Taxes, Airbnb & flux casino" },
  { id: "licences", label: "Licences", emoji: "🪪", style: ButtonStyle.Secondary, text: "Membres ayant acheté une licence" },
  { id: "entreprises", label: "Entreprises", emoji: "🏢", style: ButtonStyle.Primary, text: "Registre, audit, gel et liquidation des entreprises" },
  { id: "impots", label: "Impôts", emoji: "🧾", style: ButtonStyle.Secondary, text: "Débiteurs, contrôles fiscaux et recettes" },
  { id: "enquete", label: "Enquête", emoji: "🔎", style: ButtonStyle.Danger, text: "Ouvrir un ticket d'enquête avec 1 ou 2 membres" },
];

function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Panneau de gestion des comptes bancaires de la Maison.\n\n" +
        ACTIONS.map((a) => `${a.emoji} **${a.label}** — ${a.text}`).join("\n")
    )
    .setFooter({ text: "Accès réservé au rôle IRF" })
    .setTimestamp();

  const buttons = ACTIONS.map((a) =>
    new ButtonBuilder().setCustomId(`irf_${a.id}`).setLabel(a.label).setEmoji(a.emoji).setStyle(a.style)
  );
  const rows = [];
  for (const size of [3, 4, 3]) {
    rows.push(new ActionRowBuilder().addComponents(buttons.splice(0, size)));
  }
  return { embeds: [embed], components: rows };
}

async function setupIrfPanel(client) {
  const channel = await client.channels.fetch(IRF_PANEL_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon IRF ${IRF_PANEL_CHANNEL_ID} introuvable`);
    return;
  }

  const state = loadState();
  let message = state.panelMessageId
    ? await channel.messages.fetch(state.panelMessageId).catch(() => null)
    : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    message = recent?.find(
      (m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE
    );
  }

  if (message) await message.edit(buildPanelMessage());
  else message = await channel.send(buildPanelMessage());

  if (state.panelMessageId !== message.id) {
    state.panelMessageId = message.id;
    saveState(state);
  }
  console.log("Panneau IRF prêt");
}

// --- Consultations ---

async function showComptes(interaction) {
  const eco = loadEconomie();
  const ids = new Set([...Object.keys(eco.balances), ...Object.keys(eco.frozen)]);
  const ranked = [...ids]
    .map((id) => [id, eco.balances[id] ?? 0])
    .sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((s, [, v]) => s + v, 0);

  const lines = ranked.map(
    ([id, amount], i) => `**${i + 1}.** <@${id}> — ${formatEuro(amount)}${eco.frozen[id] ? " 🔒" : ""}`
  );
  let body = "";
  let shown = 0;
  for (const line of lines) {
    if (body.length + line.length > 3800) break;
    body += line + "\n";
    shown++;
  }

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("🔍 Comptes bancaires")
    .setDescription(body || "*Aucun compte.*")
    .addFields(
      { name: "Comptes", value: String(ranked.length), inline: true },
      { name: "Masse monétaire", value: formatEuro(Math.round(total * 100) / 100), inline: true },
      { name: "Gelés", value: String(Object.keys(eco.frozen).length), inline: true }
    )
    .setFooter({ text: shown < ranked.length ? `${shown} comptes affichés sur ${ranked.length}` : "🔒 = compte gelé" });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showTransactions(interaction, userId) {
  const eco = loadEconomie();
  const list = (eco.transactions[userId] ?? []).slice(-20).reverse();
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📋 Transactions")
    .setDescription(
      `<@${userId}> — solde **${formatEuro(eco.balances[userId] ?? 0)}**${eco.frozen[userId] ? " 🔒 gelé" : ""}\n\n` +
        (list.length
          ? list
              .map(
                (t) =>
                  `${ts(t.at)} **${t.delta >= 0 ? "+" : ""}${formatEuro(t.delta)}** → ${formatEuro(t.after)}\n└ ${t.label}`
              )
              .join("\n")
              .slice(0, 3900)
          : "*Aucune transaction enregistrée.*")
    )
    .setFooter({ text: "20 dernières transactions" });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

const TREASURY_LABELS = {
  amendes: "💸 Amendes",
  licences: "🪪 Licences",
  taxesDefis: "⚔️ Taxes des défis",
  airbnb: "🏡 Airbnb (80 %)",
  immatriculations: "🏛️ Immatriculations",
  impotsSocietes: "⚖️ Impôt sur les sociétés",
  dividendes: "📤 Taxe sur dividendes",
  liquidations: "⚖️ Liquidations",
  taxeHabitation: "🏠 Taxe d'habitation",
  impotFortune: "💎 Impôt sur la fortune",
  redressements: "⚖️ Redressements fiscaux",
  recouvrement: "💳 Dettes recouvrées",
  cautions: "🗳️ Cautions électorales perdues",
  casinoMises: "🎰 Mises casino",
  casinoGains: "🎰 Gains versés casino",
};

async function showTresorerie(interaction) {
  const t = loadEconomie().treasury;
  const get = (k) => t[k] ?? 0;
  const casinoNet = Math.round((get("casinoMises") - get("casinoGains")) * 100) / 100;
  const total = Math.round((get("amendes") + get("licences") + get("taxesDefis") + get("airbnb") + get("immatriculations") + get("impotsSocietes") + get("dividendes") + get("liquidations") + get("taxeHabitation") + get("impotFortune") + get("redressements") + get("recouvrement") + get("cautions") + casinoNet) * 100) / 100;

  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("🏛️ Trésorerie")
    .addFields(
      ...Object.entries(TREASURY_LABELS).map(([k, label]) => ({
        name: label,
        value: formatEuro(get(k)),
        inline: true,
      })),
      { name: "🎰 Résultat casino", value: `**${formatEuro(casinoNet)}**`, inline: true },
      { name: "🏛️ Total encaissé par la Maison", value: `**${formatEuro(total)}**` },
      { name: "🏙️ Budget municipal (géré par le maire)", value: formatEuro(require("./mairie").getBudget()) }
    )
    .setFooter({ text: "Cumul depuis la mise en place de l'IRF" });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function showLicences(interaction) {
  await interaction.guild.members.fetch().catch(() => null);
  const role = interaction.guild.roles.cache.get(LICENCE_ROLE_ID);
  const dates = getLicenceDates();
  const holders = role ? [...role.members.values()] : [];
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🪪 Licences (${holders.length})`)
    .setDescription(
      holders.length
        ? holders
            .map((m) => `${m}${dates[m.id] ? ` — achetée le ${ts(dates[m.id])}` : ""}`)
            .join("\n")
            .slice(0, 4000)
        : "*Aucun membre n'a de licence.*"
    );
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// --- Sélection d'un membre ---

function userSelect(action, placeholder, max = 1) {
  return {
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`irf_select_${action}`)
          .setPlaceholder(placeholder)
          .setMinValues(1)
          .setMaxValues(max)
      ),
    ],
  };
}

function reasonInput(label = "Raison", required = true) {
  return new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId("raison")
      .setLabel(label)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(required)
      .setMaxLength(500)
  );
}

// --- Actions ---

async function freezeAccount(interaction, userId, reason, client) {
  if (isFrozen(userId)) {
    await interaction.reply({ content: `🔒 Le compte de <@${userId}> est déjà gelé.`, ephemeral: true });
    return;
  }
  setFrozen(userId, { by: interaction.user.id, reason, at: Date.now() });

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🔒 Compte gelé")
    .addFields(
      { name: "Membre", value: `<@${userId}>`, inline: true },
      { name: "Solde", value: formatEuro(readBalance(userId)), inline: true },
      { name: "Raison", value: reason },
      { name: "Par", value: `${interaction.user}` }
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sendLog(client, embed);

  const user = await client.users.fetch(userId).catch(() => null);
  await user
    ?.send(`🔒 Votre compte bancaire a été **gelé** par l'IRF.\nRaison : ${reason}`)
    .catch(() => null);
}

async function unfreezeAccount(interaction, userId, client) {
  if (!isFrozen(userId)) {
    await interaction.update({ content: `🔓 Le compte de <@${userId}> n'est pas gelé.`, components: [] });
    return;
  }
  setFrozen(userId, null);

  const embed = new EmbedBuilder()
    .setColor(0x2ecc71)
    .setTitle("🔓 Compte dégelé")
    .addFields(
      { name: "Membre", value: `<@${userId}>`, inline: true },
      { name: "Par", value: `${interaction.user}`, inline: true }
    )
    .setTimestamp();
  await interaction.update({ content: "", embeds: [embed], components: [] });
  await sendLog(client, embed);

  const user = await client.users.fetch(userId).catch(() => null);
  await user?.send("🔓 Votre compte bancaire a été **dégelé** par l'IRF.").catch(() => null);
}

async function fineMember(interaction, userId, rawAmount, reason, client) {
  const amount = parseInt(String(rawAmount).replace(/[^\d]/g, ""), 10) || 0;
  if (amount <= 0) {
    await interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
    return;
  }
  const before = readBalance(userId);
  const after = changeBalance(userId, -amount, `Amende IRF — ${reason}`.slice(0, 120), { force: true });
  if (after === null) {
    await interaction.reply({
      content: `❌ <@${userId}> n'a que **${formatEuro(before)}** : amende de ${formatEuro(amount)} impossible.`,
      ephemeral: true,
    });
    return;
  }
  addToTreasury("amendes", amount);

  const embed = new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("💸 Amende infligée")
    .addFields(
      { name: "Membre", value: `<@${userId}>`, inline: true },
      { name: "Montant", value: formatEuro(amount), inline: true },
      { name: "Solde", value: `${formatEuro(before)} → **${formatEuro(after)}**`, inline: true },
      { name: "Raison", value: reason },
      { name: "Par", value: `${interaction.user}` }
    )
    .setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sendLog(client, embed);
  await refreshRichestLeaderboard(client).catch(() => null);

  const user = await client.users.fetch(userId).catch(() => null);
  await user
    ?.send(`💸 L'IRF vous a infligé une **amende de ${formatEuro(amount)}**.\nRaison : ${reason}`)
    .catch(() => null);
}

async function openInvestigation(interaction, userIds, motif, client) {
  const guild = interaction.guild;
  await interaction.deferReply({ ephemeral: true });

  const members = (
    await Promise.all(userIds.map((id) => guild.members.fetch(id).catch(() => null)))
  ).filter(Boolean);
  if (!members.length) {
    await interaction.editReply("❌ Membres introuvables.");
    return;
  }

  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: guild.members.me.id, allow: [...allow, PermissionFlagsBits.ManageChannels] },
    { id: interaction.user.id, allow },
    ...members.map((m) => ({ id: m.id, allow })),
  ];
  if (guild.roles.cache.has(IRF_ROLE_ID)) {
    permissionOverwrites.push({ id: IRF_ROLE_ID, allow: [...allow, PermissionFlagsBits.ManageMessages] });
  }

  const slug = members
    .map((m) => m.user.username.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))
    .join("-");
  const channel = await guild.channels
    .create({
      name: `enquete-${slug || "irf"}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: `irf-enquete:${members.map((m) => m.id).join(",")}`,
      permissionOverwrites,
    })
    .catch((err) => {
      console.error("Enquête IRF:", err.message);
      return null;
    });
  if (!channel) {
    await interaction.editReply("❌ Impossible de créer le salon d'enquête.");
    return;
  }

  const eco = loadEconomie();
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("🔎 Enquête IRF")
    .setDescription(
      `L'**Institut de Régulation Financière** ouvre une enquête.\n\n**Motif :** ${motif}\n\n` +
        "Merci de répondre aux questions de l'IRF dans ce salon."
    )
    .addFields(
      members.map((m) => ({
        name: m.user.tag,
        value: `${m} — ${formatEuro(eco.balances[m.id] ?? 0)}${eco.frozen[m.id] ? " 🔒 gelé" : ""}`,
        inline: true,
      }))
    )
    .setFooter({ text: `Ouverte par ${interaction.user.tag}` })
    .setTimestamp();

  await channel.send({
    content: `${members.join(" ")} <@&${IRF_ROLE_ID}>`,
    allowedMentions: { users: members.map((m) => m.id), roles: [IRF_ROLE_ID] },
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("irf_enquete_close")
          .setLabel("Clôturer l'enquête")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await interaction.editReply(`🔎 Enquête ouverte : ${channel}`);
  await sendLog(client, EmbedBuilder.from(embed).setDescription(`**Motif :** ${motif}\nSalon : ${channel}`));
}

// --- Routage ---

async function handleIrfInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("irf_")) return false;

  if (!isIrf(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé au rôle IRF.", ephemeral: true });
    return true;
  }

  if (interaction.isButton()) {
    switch (id) {
      case "irf_comptes":
        await showComptes(interaction);
        break;
      case "irf_tresorerie":
        await showTresorerie(interaction);
        break;
      case "irf_impots":
        await showIrfTaxes(interaction);
        break;
      case "irf_entreprises":
        await showIrfCompanies(interaction);
        break;
      case "irf_licences":
        await showLicences(interaction);
        break;
      case "irf_geler":
        await interaction.reply({ content: "🔒 Quel compte geler ?", ...userSelect("geler", "Choisir un membre") });
        break;
      case "irf_degeler":
        await interaction.reply({ content: "🔓 Quel compte dégeler ?", ...userSelect("degeler", "Choisir un membre") });
        break;
      case "irf_transactions":
        await interaction.reply({ content: "📋 Historique de quel membre ?", ...userSelect("transactions", "Choisir un membre") });
        break;
      case "irf_amende":
        await interaction.reply({ content: "💸 Qui reçoit l'amende ?", ...userSelect("amende", "Choisir un membre") });
        break;
      case "irf_enquete":
        await interaction.reply({
          content: "🔎 Quels membres convoquer ? (1 ou 2)",
          ...userSelect("enquete", "Choisir 1 ou 2 membres", 2),
        });
        break;
      case "irf_enquete_close": {
        const channel = interaction.channel;
        if (!channel?.topic?.startsWith("irf-enquete:")) return true;
        await interaction.reply(`🔒 Enquête clôturée par ${interaction.user}. Suppression du salon dans 5 secondes…`);
        setTimeout(() => channel.delete("Enquête IRF clôturée").catch(() => null), 5000);
        break;
      }
    }
    return true;
  }

  if (interaction.isUserSelectMenu() && id.startsWith("irf_select_")) {
    const action = id.slice("irf_select_".length);
    const users = interaction.values;
    const target = users[0];

    if (action === "transactions") {
      await showTransactions(interaction, target);
    } else if (action === "degeler") {
      await unfreezeAccount(interaction, target, client);
    } else if (action === "geler") {
      await interaction.showModal(
        new ModalBuilder().setCustomId(`irf_modal_geler_${target}`).setTitle("🔒 Geler un compte").addComponents(reasonInput())
      );
    } else if (action === "amende") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`irf_modal_amende_${target}`)
          .setTitle("💸 Amende")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("montant")
                .setLabel("Montant (€)")
                .setPlaceholder(`Solde actuel : ${formatEuro(readBalance(target))}`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(12)
            ),
            reasonInput()
          )
      );
    } else if (action === "enquete") {
      if (users.some((u) => interaction.users.get(u)?.bot)) {
        await interaction.reply({ content: "❌ Impossible d'enquêter sur un bot.", ephemeral: true });
        return true;
      }
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`irf_modal_enquete_${users.join("-")}`)
          .setTitle("🔎 Ouvrir une enquête")
          .addComponents(reasonInput("Motif de l'enquête"))
      );
    }
    return true;
  }

  if (interaction.isModalSubmit() && id.startsWith("irf_modal_")) {
    const [, , action, target] = id.split("_");
    const reason = interaction.fields.getTextInputValue("raison").trim();
    if (action === "geler") await freezeAccount(interaction, target, reason, client);
    else if (action === "amende") {
      await fineMember(interaction, target, interaction.fields.getTextInputValue("montant"), reason, client);
    } else if (action === "enquete") {
      await openInvestigation(interaction, target.split("-"), reason, client);
    }
    return true;
  }

  return false;
}

module.exports = { setupIrfPanel, handleIrfInteraction };
