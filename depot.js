const fs = require("fs");
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
const { changeBalance, readBalance, formatEuro, isGerant, isFrozen, setFrozen } = require("./economie");
const { IRF_ROLE_ID, TICKET_CATEGORY_ID } = require("./casino");
const { MINUTE } = require("./nettoyage");
const { dataFile } = require("./data");
const { pseudo } = require("./noms");

// --- Dépôts : un membre ajoute de l'argent à son solde, l'IRF vérifie ensuite ---
// 1. /deposit : montant et provenance → un ticket s'ouvre avec le membre et l'IRF.
// 2. Le membre clique « J'ai envoyé l'argent » : traitement animé, puis le solde est crédité.
// 3. L'IRF est mentionnée pour vérifier : « Dépôt confirmé » ou « Faux dépôt » (l'argent est repris).
const STATE_FILE = dataFile("depot-state.json");
const MAX_DEPOSIT = 1000000;
const STEPS = [
  ["🔐", "Ouverture d'une session sécurisée"],
  ["📡", "Connexion à la passerelle de dépôt"],
  ["🔎", "Recherche de la transaction"],
  ["🧾", "Enregistrement de l'opération"],
  ["💶", "Crédit du solde"],
];
const STEP_MS = 1600;

function loadState() {
  try {
    return { deposits: {}, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
  } catch {
    return { deposits: {} };
  }
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const isIrf = (member) => member?.roles.cache.has(IRF_ROLE_ID) || isGerant(member);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const parseAmount = (text) => Math.round(Number(String(text ?? "").replace(/[\s€  ]/g, "").replace(",", ".")) * 100) / 100;

function depositEmbed(d, member, extra = {}) {
  const colors = { open: 0x3b82f6, processing: 0xf59e0b, credited: 0xf59e0b, confirmed: 0x22c55e, refused: 0xef4444, cancelled: 0x6b7280 };
  const status = {
    open: "🕓 En attente de l'envoi",
    processing: "⏳ Traitement en cours…",
    credited: "💶 Crédité — vérification par l'IRF en cours",
    confirmed: "✅ Dépôt confirmé par l'IRF",
    refused: "❌ Faux dépôt — argent repris par l'IRF",
    cancelled: "🚫 Demande annulée",
  }[d.status];
  return new EmbedBuilder()
    .setColor(extra.color ?? colors[d.status])
    .setTitle("💳 Demande de dépôt")
    .setThumbnail(member?.user?.displayAvatarURL({ size: 128 }) ?? null)
    .setDescription(extra.description ?? null)
    .addFields(
      { name: "Membre", value: `**${pseudo(d.userId)}**`, inline: true },
      { name: "Montant", value: `**${formatEuro(d.amount)}**`, inline: true },
      { name: "Statut", value: status, inline: true },
      { name: "Provenance", value: d.source || "*Non précisée*", inline: false },
      ...(d.reference ? [{ name: "Référence / preuve", value: d.reference.slice(0, 1000), inline: false }] : [])
    )
    .setFooter({ text: `Dépôt n° ${d.id}${d.decidedBy ? ` · décision de ${d.decidedByName}` : ""}` })
    .setTimestamp(d.at);
}
function progressBar(done, total) {
  const n = Math.round((done / total) * 12);
  return "🟩".repeat(n) + "⬛".repeat(12 - n);
}
function stepsText(current) {
  return STEPS.map(([emoji, label], i) => (i < current ? `✅ ${label}` : i === current ? `${emoji} **${label}…**` : `▫️ ${label}`)).join("\n");
}
const memberButtons = (id, disabled = false) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`depot_sent_${id}`).setLabel("J'ai envoyé l'argent").setEmoji("📤").setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(`depot_cancel_${id}`).setLabel("Annuler").setStyle(ButtonStyle.Secondary).setDisabled(disabled)
  );
const irfButtons = (id) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`depot_ok_${id}`).setLabel("Dépôt confirmé").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`depot_no_${id}`).setLabel("Faux dépôt : reprendre l'argent").setEmoji("❌").setStyle(ButtonStyle.Danger)
  );
function closeLater(channel, reason, by) {
  setTimeout(() => require("./tickets").closeTicket(channel, { reason, closedBy: by }).catch(() => null), MINUTE);
}

async function openDeposit(interaction) {
  const member = interaction.member, guild = interaction.guild;
  const amount = parseAmount(interaction.fields.getTextInputValue("montant"));
  const source = interaction.fields.getTextInputValue("source")?.trim().slice(0, 300) ?? "";
  const reference = interaction.fields.getTextInputValue("reference")?.trim().slice(0, 1000) ?? "";
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_DEPOSIT) {
    await interaction.reply({ content: `❌ Montant invalide : entre 0,01 € et ${formatEuro(MAX_DEPOSIT)}.`, ephemeral: true });
    return;
  }
  const state = loadState();
  const pending = Object.values(state.deposits).find((d) => d.userId === member.id && ["open", "processing", "credited"].includes(d.status));
  if (pending) {
    await interaction.reply({ content: `📨 Vous avez déjà un dépôt en cours : <#${pending.channelId}>`, ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles];
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow },
    { id: guild.members.me.id, allow: [...allow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
  ];
  if (guild.roles.cache.has(IRF_ROLE_ID)) permissionOverwrites.push({ id: IRF_ROLE_ID, allow: [...allow, PermissionFlagsBits.ManageMessages] });
  const slug = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "membre";
  const ticket = await guild.channels
    .create({ name: `depot-${slug}`.slice(0, 100), type: ChannelType.GuildText, parent: TICKET_CATEGORY_ID, topic: `depot:${member.id}`, permissionOverwrites })
    .catch((err) => {
      console.error("Ticket de dépôt:", err.message);
      return null;
    });
  if (!ticket) {
    await interaction.editReply("❌ Impossible d'ouvrir le ticket. Contactez un gérant.");
    return;
  }
  const d = { id: Date.now().toString(36), userId: member.id, amount, source, reference, status: "open", channelId: ticket.id, at: Date.now() };
  const msg = await ticket
    .send({
      content: `${member}`,
      allowedMentions: { users: [member.id] },
      embeds: [
        depositEmbed(d, member, {
          description:
            `Bonjour **${pseudo(member.id)}**,\n\n` +
            `**1.** Envoyez **${formatEuro(amount)}**.\n` +
            "**2.** Cliquez sur **📤 J'ai envoyé l'argent** : le dépôt est traité puis crédité sur votre solde.\n" +
            "**3.** L'**IRF** vérifie ensuite l'opération. Un faux dépôt est repris et peut entraîner le gel du compte.\n\n" +
            "Vous pouvez joindre une capture d'écran de l'envoi dans ce salon.",
        }),
      ],
      components: [memberButtons(d.id)],
    })
    .catch(() => null);
  d.messageId = msg?.id ?? null;
  state.deposits[d.id] = d;
  saveState(state);
  await interaction.editReply(`💳 Votre demande de dépôt est ouverte ici : ${ticket}`);
}

async function processDeposit(interaction, d, client) {
  const state = loadState();
  d = state.deposits[d.id];
  d.status = "processing";
  saveState(state);
  const member = interaction.member;
  await interaction.update({ embeds: [depositEmbed(d, member, { description: `${progressBar(0, STEPS.length)}\n\n${stepsText(0)}` })], components: [memberButtons(d.id, true)] });
  for (let i = 1; i <= STEPS.length; i++) {
    await sleep(STEP_MS + Math.random() * 700);
    if (i < STEPS.length) await interaction.message.edit({ embeds: [depositEmbed(d, member, { description: `${progressBar(i, STEPS.length)}\n\n${stepsText(i)}` })] }).catch(() => null);
  }
  const after = changeBalance(d.userId, d.amount, `Dépôt n° ${d.id} (en attente de vérification IRF)`, { force: true });
  const fresh = loadState();
  const dep = fresh.deposits[d.id];
  dep.status = "credited";
  dep.creditedAt = Date.now();
  saveState(fresh);
  await interaction.message
    .edit({
      embeds: [depositEmbed(dep, member, { description: `${progressBar(STEPS.length, STEPS.length)}\n\n${stepsText(STEPS.length)}\n\n✅ **${formatEuro(dep.amount)}** ajoutés à votre solde (nouveau solde : **${formatEuro(after ?? readBalance(dep.userId))}**).\n🔎 L'IRF va vérifier l'opération.` })],
      components: [],
    })
    .catch(() => null);
  await interaction.channel
    .send({
      content: `<@&${IRF_ROLE_ID}> — vérification demandée : **${pseudo(dep.userId)}** déclare avoir envoyé **${formatEuro(dep.amount)}**, déjà crédités sur son solde.`,
      allowedMentions: { roles: [IRF_ROLE_ID] },
      embeds: [depositEmbed(dep, member, { description: "Vérifiez que l'argent a bien été reçu. En cas de faux dépôt, la somme est reprise sur le solde du membre (et son compte est gelé si elle a déjà été dépensée)." })],
      components: [irfButtons(dep.id)],
    })
    .catch(() => null);
  require("./logs")
    .sendLogEmbed("achats", new EmbedBuilder().setColor(0xf59e0b).setTitle("💳 Dépôt crédité (en attente de vérification)").setDescription(`**${pseudo(dep.userId)}** : **+${formatEuro(dep.amount)}**\nProvenance : ${dep.source || "non précisée"}\nTicket : <#${dep.channelId}>`).setTimestamp())
    .catch(() => null);
  void client;
}

async function decideDeposit(interaction, d, ok) {
  if (!isIrf(interaction.member)) {
    await interaction.reply({ content: "❌ Vérification réservée à l'IRF.", ephemeral: true });
    return;
  }
  const state = loadState();
  d = state.deposits[d.id];
  if (d.status !== "credited") {
    await interaction.reply({ content: "ℹ️ Ce dépôt a déjà été traité.", ephemeral: true });
    return;
  }
  d.decidedBy = interaction.user.id;
  d.decidedByName = interaction.member?.displayName ?? interaction.user.username;
  d.decidedAt = Date.now();
  let note;
  if (ok) {
    d.status = "confirmed";
    note = `✅ Dépôt de **${formatEuro(d.amount)}** confirmé par **${pseudo(interaction.user.id)}**.`;
  } else {
    d.status = "refused";
    const balance = readBalance(d.userId);
    const taken = Math.min(balance, d.amount);
    if (taken > 0) changeBalance(d.userId, -taken, `Dépôt n° ${d.id} annulé par l'IRF (faux dépôt)`, { force: true });
    const missing = Math.round((d.amount - taken) * 100) / 100;
    if (missing > 0) setFrozen(d.userId, { by: interaction.user.id, reason: `Faux dépôt n° ${d.id} : ${formatEuro(missing)} déjà dépensés`, at: Date.now() });
    d.taken = taken;
    note = `❌ Faux dépôt : **${formatEuro(taken)}** repris par **${pseudo(interaction.user.id)}**.` + (missing > 0 ? `\n🔒 ${formatEuro(missing)} avaient déjà été dépensés : le compte de **${pseudo(d.userId)}** est **gelé**.` : "");
  }
  saveState(state);
  const member = await interaction.guild.members.fetch(d.userId).catch(() => null);
  await interaction.update({ embeds: [depositEmbed(d, member, { description: note })], components: [] });
  await interaction.channel.send(`${note}\n*Ce ticket sera fermé dans 1 minute.*`).catch(() => null);
  require("./logs")
    .sendLogEmbed("achats", new EmbedBuilder().setColor(ok ? 0x22c55e : 0xef4444).setTitle(ok ? "✅ Dépôt confirmé" : "❌ Faux dépôt repris").setDescription(`**${pseudo(d.userId)}** · ${formatEuro(d.amount)}\n${note}`).setTimestamp())
    .catch(() => null);
  member?.send(ok ? `✅ Votre dépôt de **${formatEuro(d.amount)}** a été vérifié et confirmé par l'IRF.` : `❌ L'IRF n'a pas trouvé votre dépôt de **${formatEuro(d.amount)}** : la somme a été reprise sur votre solde.`).catch(() => null);
  closeLater(interaction.channel, `Dépôt ${ok ? "confirmé" : "refusé"}`, interaction.user);
}

async function handleDepotInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "deposit") {
    if (isFrozen(interaction.user.id)) {
      await interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF : dépôt impossible.", ephemeral: true });
      return true;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("depot_form")
        .setTitle("Déposer de l'argent")
        .addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("montant").setLabel("Montant à déposer (€)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12).setPlaceholder("ex. 2500")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("source").setLabel("D'où vient l'argent ?").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(300).setPlaceholder("ex. virement depuis mon compte…")),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("reference").setLabel("Référence ou détail de l'envoi (facultatif)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1000))
        )
    );
    return true;
  }
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("depot_")) return false;
  if (id === "depot_form") {
    await openDeposit(interaction);
    return true;
  }
  const m = /^depot_(sent|cancel|ok|no)_(\w+)$/.exec(id);
  if (!m) return false;
  const [, action, depId] = m;
  const d = loadState().deposits[depId];
  if (!d) {
    await interaction.reply({ content: "ℹ️ Ce dépôt n'existe plus.", ephemeral: true });
    return true;
  }
  if (action === "ok" || action === "no") {
    await decideDeposit(interaction, d, action === "ok");
    return true;
  }
  if (interaction.user.id !== d.userId) {
    await interaction.reply({ content: "⛔ Seul le membre qui a fait la demande peut utiliser ce bouton.", ephemeral: true });
    return true;
  }
  if (d.status !== "open") {
    await interaction.reply({ content: "ℹ️ Ce dépôt est déjà en cours de traitement.", ephemeral: true });
    return true;
  }
  if (action === "cancel") {
    const state = loadState();
    state.deposits[d.id].status = "cancelled";
    saveState(state);
    await interaction.update({ embeds: [depositEmbed(state.deposits[d.id], interaction.member, { description: "Demande annulée. Ce ticket sera fermé dans 1 minute." })], components: [] });
    closeLater(interaction.channel, "Dépôt annulé", interaction.user);
    return true;
  }
  if (isFrozen(d.userId)) {
    await interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF : dépôt impossible.", ephemeral: true });
    return true;
  }
  await processDeposit(interaction, d, client);
  return true;
}

// au redémarrage : un dépôt coupé en plein traitement repasse en attente
function setupDepot() {
  const state = loadState();
  let changed = false;
  for (const d of Object.values(state.deposits)) {
    if (d.status === "processing") {
      d.status = "open";
      changed = true;
    }
    if (["confirmed", "refused", "cancelled"].includes(d.status) && Date.now() - d.at > 30 * 86400000) {
      delete state.deposits[d.id];
      changed = true;
    }
  }
  if (changed) saveState(state);
}

module.exports = { handleDepotInteraction, setupDepot };
