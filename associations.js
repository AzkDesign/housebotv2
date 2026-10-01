// Associations : créées par la Mairie, confiées à un président,
// avec leur propre catégorie, leurs salons, leur rôle de membre et leur caisse.
const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { changeBalance, readBalance, formatEuro, isGerant } = require("./economie");
const { regime } = require("./politique");
const { findOrCreateChannel } = require("./salons");

const STATE_FILE = require("./data").dataFile("associations-state.json");
const MAX_CHANNELS = 8;
const DEFAULT_CHANNELS = ["général", "annonces", "activités"];
const LIST_TITLE = "🤝 Vie associative";

// La mairie est chargée à la demande (elle utilise elle-même ce module).
const mairie = () => require("./mairie");

function round2(n) {
  return Math.round(n * 100) / 100;
}

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.assos ??= {};
  state.counter ??= 0;
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function nextId(prefix) {
  load().counter += 1;
  return `${prefix}${state.counter}`;
}

function activeAssos() {
  return Object.values(load().assos).filter((a) => a.status !== "dissolved");
}

function isPresident(asso, userId) {
  return asso?.presidentId === userId;
}

function slug(text) {
  // Discord accepte les accents dans les noms de salons : on les garde.
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "salon";
}

// --- Panneaux ---

function assoPanel(asso) {
  const banned = asso.status === "banned";
  const embed = new EmbedBuilder()
    .setColor(banned ? 0x2c2c2c : 0x1abc9c)
    .setTitle(`🤝 ${asso.name}`)
    .setDescription(
      `${asso.description}\n\n` +
        (banned ? "⛔ **Association interdite par le régime.** Plus aucune activité possible.\n\n" : "") +
        `👤 Président(e) : <@${asso.presidentId}>\n` +
        `👥 Adhérents : **${asso.members.length}**\n` +
        `💰 Caisse : **${formatEuro(asso.balance)}**\n` +
        `${asso.private ? "🔒 Association privée : salons réservés aux adhérents" : "🌍 Association ouverte : salons visibles par tous"}`
    )
    .setFooter({ text: "Créée par la Mairie" })
    .setTimestamp(asso.createdAt);
  const btn = (id, label, emoji, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`asso_${id}_${asso.id}`).setLabel(label).setEmoji(emoji).setStyle(style).setDisabled(banned);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        btn("join", "Adhérer / Quitter", "🙋", ButtonStyle.Success),
        btn("donate", "Faire un don", "💝", ButtonStyle.Primary)
      ),
      new ActionRowBuilder().addComponents(
        btn("activity", "Organiser une activité", "📅"),
        btn("reward", "Récompenser", "🏆"),
        btn("handover", "Passer la présidence", "🔁")
      ),
    ],
  };
}

async function refreshAssoPanel(client, asso) {
  const channel = await client.channels.fetch(asso.panelChannelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const msg = asso.panelMessageId ? await channel.messages.fetch(asso.panelMessageId).catch(() => null) : null;
  if (msg) await msg.edit(assoPanel(asso)).catch(() => null);
  else {
    const sent = await channel.send(assoPanel(asso)).catch(() => null);
    if (sent) {
      asso.panelMessageId = sent.id;
      save();
    }
  }
}

function listMessage() {
  const assos = activeAssos().sort((a, b) => b.members.length - a.members.length);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x1abc9c)
        .setTitle(LIST_TITLE)
        .setDescription(
          "Les associations de la Maison, créées par la Mairie. Rejoignez-les depuis leur salon !\n\n" +
            (assos.length
              ? assos
                  .map(
                    (a) =>
                      `${a.status === "banned" ? "⛔" : "🤝"} **${a.name}** — <#${a.panelChannelId}>\n` +
                      `└ Président(e) <@${a.presidentId}> · ${a.members.length} adhérent(s) · caisse ${formatEuro(a.balance)}`
                  )
                  .join("\n")
                  .slice(0, 3800)
              : "*Aucune association pour le moment.*")
        )
        .setTimestamp(),
    ],
  };
}

async function refreshList(client) {
  const s = load();
  const categoryId = mairie().getCategoryId();
  const guild = await mairie().getGuild(client);
  if (!guild || !categoryId) return;
  const channel = await findOrCreateChannel(guild, {
    id: s.listChannelId,
    name: "🤝・vie-associative",
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });
  s.listChannelId = channel.id;
  let msg = s.listMessageId ? await channel.messages.fetch(s.listMessageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === LIST_TITLE);
  }
  if (msg) await msg.edit(listMessage()).catch(() => null);
  else msg = await channel.send(listMessage()).catch(() => null);
  if (msg) s.listMessageId = msg.id;
  save();
}

// --- Permissions des salons ---

function channelOverwrites(guild, client, asso, { panel }) {
  const everyone = guild.roles.everyone.id;
  const list = [{ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] }];
  if (asso.private) {
    list.push({ id: everyone, deny: [PermissionFlagsBits.ViewChannel] });
    list.push({ id: asso.roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, ...(panel ? [] : [PermissionFlagsBits.SendMessages])] });
  } else {
    list.push({ id: everyone, deny: [PermissionFlagsBits.SendMessages] });
    if (!panel) list.push({ id: asso.roleId, allow: [PermissionFlagsBits.SendMessages] });
  }
  if (asso.status === "banned") {
    list.push({ id: asso.roleId, deny: [PermissionFlagsBits.SendMessages] });
  }
  list.push({ id: asso.presidentId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] });
  return list;
}

async function applyPermissions(client, asso) {
  const guild = await mairie().getGuild(client);
  if (!guild) return;
  for (const [i, channelId] of asso.channelIds.entries()) {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) continue;
    await channel.permissionOverwrites.set(channelOverwrites(guild, client, asso, { panel: i === 0 })).catch(() => null);
  }
}

// --- Création (Mairie) ---

function creationModal() {
  const row = (id, label, style, opts = {}) => {
    const input = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(opts.required ?? true).setMaxLength(opts.max ?? 100);
    if (opts.placeholder) input.setPlaceholder(opts.placeholder);
    return new ActionRowBuilder().addComponents(input);
  };
  return new ModalBuilder()
    .setCustomId("asso_mcreate")
    .setTitle("🤝 Créer une association")
    .addComponents(
      row("nom", "Nom de l'association", TextInputStyle.Short, { max: 50 }),
      row("but", "But et description", TextInputStyle.Paragraph, { max: 800 }),
      row("salons", `Salons à créer (virgules, ${MAX_CHANNELS} max)`, TextInputStyle.Short, {
        required: false,
        max: 300,
        placeholder: DEFAULT_CHANNELS.join(", "),
      }),
      row("visibilite", "Visibilité : public ou privé", TextInputStyle.Short, { required: false, max: 10, placeholder: "public" })
    );
}

async function submitCreation(interaction) {
  const name = interaction.fields.getTextInputValue("nom").trim();
  const description = interaction.fields.getTextInputValue("but").trim();
  const wanted = interaction.fields
    .getTextInputValue("salons")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  const channels = [...new Set((wanted.length ? wanted : DEFAULT_CHANNELS).map(slug))].slice(0, MAX_CHANNELS);
  const isPrivate = /priv/i.test(interaction.fields.getTextInputValue("visibilite"));

  if (activeAssos().some((a) => a.name.toLowerCase() === name.toLowerCase())) {
    return interaction.reply({ content: "❌ Une association porte déjà ce nom.", ephemeral: true });
  }
  const id = nextId("a");
  load().drafts = { ...(state.drafts ?? {}), [interaction.user.id]: { id, name, description, channels, private: isPrivate } };
  save();
  return interaction.reply({
    content:
      `🤝 **${name}** — ${isPrivate ? "🔒 privée" : "🌍 publique"}\n` +
      `Salons prévus : ${channels.map((c) => `#${c}`).join(", ")}\n\n` +
      "Qui en sera le président ou la présidente ?",
    ephemeral: true,
    components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("asso_president").setPlaceholder("Choisir le président"))],
  });
}

async function createAssociation(interaction, client) {
  const draft = load().drafts?.[interaction.user.id];
  if (!draft) return interaction.update({ content: "❌ Création expirée, recommencez.", components: [] });
  const president = await interaction.guild.members.fetch(interaction.values[0]).catch(() => null);
  if (!president || president.user.bot) return interaction.update({ content: "❌ Président invalide.", components: [] });

  await interaction.update({ content: "⏳ Création de l'association : catégorie, salons et rôle…", components: [] });
  const guild = interaction.guild;
  const role = await guild.roles.create({ name: `🤝 ${draft.name}`.slice(0, 100), color: 0x1abc9c, reason: "Association" });
  const asso = {
    id: draft.id,
    name: draft.name,
    description: draft.description,
    private: draft.private,
    presidentId: president.id,
    roleId: role.id,
    members: [president.id],
    balance: 0,
    status: "active",
    createdAt: Date.now(),
    createdBy: interaction.user.id,
    channelIds: [],
    activities: {},
  };
  await president.roles.add(role).catch(() => null);

  const category = await guild.channels.create({ name: `🤝 ${draft.name}`.slice(0, 100), type: ChannelType.GuildCategory });
  asso.categoryId = category.id;
  const topicPrefix = asso.private ? "privé:association" : "association";
  const names = ["📌・accueil", ...draft.channels.filter((c) => c !== "accueil")];
  for (const [i, channelName] of names.entries()) {
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: `${topicPrefix}:${asso.id}`,
      permissionOverwrites: channelOverwrites(guild, client, asso, { panel: i === 0 }),
    });
    asso.channelIds.push(channel.id);
  }
  asso.panelChannelId = asso.channelIds[0];
  load().assos[asso.id] = asso;
  delete state.drafts[interaction.user.id];
  save();

  await refreshAssoPanel(client, asso);
  await refreshList(client);
  const panelChannel = await client.channels.fetch(asso.panelChannelId).catch(() => null);
  await panelChannel
    ?.send(`🎉 Bienvenue dans **${asso.name}** ! ${president}, vous en êtes le président ou la présidente : organisez des activités et faites vivre l'association.`)
    .catch(() => null);
  await mairie().journal(
    client,
    `🤝 Nouvelle association — ${asso.name}`,
    `${asso.description}\n\nPrésidence confiée à ${president}. Rejoignez-la dans <#${asso.panelChannelId}>.\n\n${mairie().sign(interaction.user.id)}`,
    0x1abc9c
  );
  await interaction.editReply(`🤝 **${asso.name}** est créée : <#${asso.panelChannelId}> (${names.length} salons, rôle ${role}).`);
}

// Menu « Associations » du bureau du maire
async function openMayorMenu(interaction) {
  const assos = activeAssos();
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("asso_create").setLabel("Créer une association").setEmoji("🤝").setStyle(ButtonStyle.Success)
    ),
  ];
  if (assos.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("asso_manage")
          .setPlaceholder("Gérer une association existante")
          .addOptions(assos.slice(0, 25).map((a) => ({ label: a.name.slice(0, 100), value: a.id, description: `${a.members.length} adhérent(s) · caisse ${a.balance} €`, emoji: a.status === "banned" ? "⛔" : "🤝" })))
      )
    );
  }
  return interaction.reply({ content: `🤝 **${assos.length}** association(s).`, components: rows, ephemeral: true });
}

async function showMayorActions(interaction) {
  const asso = load().assos[interaction.values[0]];
  if (!asso) return interaction.update({ content: "❌ Association introuvable.", components: [] });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`asso_subsidy_${asso.id}`).setLabel("Subventionner").setEmoji("💶").setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`asso_ban_${asso.id}`)
      .setLabel(asso.status === "banned" ? "Lever l'interdiction" : "Interdire")
      .setEmoji("⛔")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(regime() !== "dictature" && asso.status !== "banned"),
    new ButtonBuilder().setCustomId(`asso_dissolve_${asso.id}`).setLabel("Dissoudre").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
  );
  return interaction.update({
    content: `🤝 **${asso.name}** — président(e) <@${asso.presidentId}>, ${asso.members.length} adhérent(s), caisse ${formatEuro(asso.balance)}.${regime() !== "dictature" ? "\n*L'interdiction n'est possible que sous la dictature.*" : ""}`,
    components: [row],
  });
}

// --- Actions ---

function amountModal(customId, title, label) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("montant").setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12))
    );
}

function readAmount(interaction) {
  return parseInt(interaction.fields.getTextInputValue("montant").replace(/[^\d]/g, ""), 10) || 0;
}

async function toggleMembership(interaction, asso, client) {
  const userId = interaction.user.id;
  const member = interaction.member;
  if (asso.members.includes(userId)) {
    if (isPresident(asso, userId)) return interaction.reply({ content: "❌ Passez d'abord la présidence à quelqu'un d'autre.", ephemeral: true });
    asso.members = asso.members.filter((id) => id !== userId);
    await member.roles.remove(asso.roleId).catch(() => null);
    save();
    await interaction.reply({ content: `👋 Vous avez quitté **${asso.name}**.`, ephemeral: true });
  } else {
    asso.members.push(userId);
    await member.roles.add(asso.roleId).catch(() => null);
    save();
    await interaction.reply({ content: `🙋 Bienvenue dans **${asso.name}** !`, ephemeral: true });
  }
  await refreshAssoPanel(client, asso);
  await refreshList(client);
}

async function handleAssociationsInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("asso_")) return false;
  load();
  const userId = interaction.user.id;
  const official = mairie().isMayor(userId) || mairie().isAdjoint(userId);

  // Actions de la Mairie
  if (["asso_create", "asso_mcreate", "asso_president", "asso_manage"].includes(id) || /^asso_(subsidy|msubsidy|ban|dissolve)_/.test(id)) {
    if (!official) {
      await interaction.reply({ content: "❌ Réservé au maire et à son adjoint.", ephemeral: true });
      return true;
    }
    if (id === "asso_create") await interaction.showModal(creationModal());
    else if (id === "asso_mcreate") await submitCreation(interaction);
    else if (id === "asso_president") await createAssociation(interaction, client);
    else if (id === "asso_manage") await showMayorActions(interaction);
    else {
      const [, action, assoId] = id.split("_");
      const asso = state.assos[assoId];
      if (!asso || asso.status === "dissolved") {
        await interaction.reply({ content: "❌ Association introuvable.", ephemeral: true });
        return true;
      }
      if (action === "subsidy") {
        if (regime() === "anarchie") {
          await interaction.reply({ content: "🏴 En anarchie, la Mairie ne verse aucune subvention.", ephemeral: true });
          return true;
        }
        await interaction.showModal(amountModal(`asso_msubsidy_${asso.id}`, `💶 Subvention — ${asso.name}`.slice(0, 45), "Montant (€, pris sur le budget)"));
      } else if (action === "msubsidy") {
        const value = readAmount(interaction);
        if (value <= 0 || !mairie().budgetMove(-value, `Subvention à l'association ${asso.name}`)) {
          await interaction.reply({ content: `❌ Montant invalide ou budget insuffisant (${formatEuro(mairie().getBudget())}).`, ephemeral: true });
          return true;
        }
        asso.balance = round2(asso.balance + value);
        save();
        await mairie().journal(client, `💶 Subvention — ${asso.name}`, `**${formatEuro(value)}** versés à la caisse de l'association.\n\n${mairie().sign(userId)}`, 0x1abc9c);
        await refreshAssoPanel(client, asso);
        await refreshList(client);
        await interaction.reply({ content: `💶 ${formatEuro(value)} versés à ${asso.name}.`, ephemeral: true });
      } else if (action === "ban") {
        if (!mairie().isMayor(userId)) {
          await interaction.reply({ content: "❌ Seul le dictateur peut interdire une association.", ephemeral: true });
          return true;
        }
        const ban = asso.status !== "banned";
        if (ban && regime() !== "dictature") {
          await interaction.reply({ content: "❌ L'interdiction n'est possible que sous la dictature.", ephemeral: true });
          return true;
        }
        asso.status = ban ? "banned" : "active";
        save();
        await applyPermissions(client, asso);
        await refreshAssoPanel(client, asso);
        await refreshList(client);
        await mairie().journal(client, ban ? `⛔ Association interdite — ${asso.name}` : `✅ Interdiction levée — ${asso.name}`, mairie().sign(userId), ban ? 0x2c2c2c : 0x2ecc71);
        await interaction.update({ content: ban ? `⛔ ${asso.name} est interdite.` : `✅ ${asso.name} est de nouveau autorisée.`, components: [] });
      } else if (action === "dissolve") {
        asso.status = "dissolved";
        if (asso.balance > 0) mairie().budgetMove(asso.balance, `Caisse de l'association dissoute ${asso.name}`);
        save();
        await interaction.update({ content: `🗑️ Dissolution de ${asso.name}…`, components: [] });
        const guild = interaction.guild;
        for (const channelId of asso.channelIds) await (await guild.channels.fetch(channelId).catch(() => null))?.delete("Association dissoute").catch(() => null);
        await (await guild.channels.fetch(asso.categoryId).catch(() => null))?.delete("Association dissoute").catch(() => null);
        await (await guild.roles.fetch(asso.roleId).catch(() => null))?.delete("Association dissoute").catch(() => null);
        await mairie().journal(client, `🗑️ Association dissoute — ${asso.name}`, `${asso.balance > 0 ? `Sa caisse (${formatEuro(asso.balance)}) revient au budget municipal.\n\n` : ""}${mairie().sign(userId)}`, 0x95a5a6);
        await refreshList(client);
      }
    }
    return true;
  }

  // Actions dans l'association
  const [, action, assoId, extra] = id.split("_");
  const asso = state.assos[assoId];
  if (!asso || asso.status === "dissolved") {
    await interaction.reply({ content: "❌ Cette association n'existe plus.", ephemeral: true });
    return true;
  }
  if (asso.status === "banned") {
    await interaction.reply({ content: "⛔ Cette association est interdite par le régime.", ephemeral: true });
    return true;
  }
  const president = isPresident(asso, userId) || isGerant(interaction.member);

  switch (action) {
    case "join":
      await toggleMembership(interaction, asso, client);
      break;
    case "donate":
      await interaction.showModal(amountModal(`asso_mdonate_${asso.id}`, `💝 Don — ${asso.name}`.slice(0, 45), "Montant (€, pris sur votre solde)"));
      break;
    case "mdonate": {
      const value = readAmount(interaction);
      if (value <= 0 || changeBalance(userId, -value, `Don à l'association ${asso.name}`) === null) {
        await interaction.reply({ content: `❌ Montant invalide, solde insuffisant (${formatEuro(readBalance(userId))}) ou compte gelé.`, ephemeral: true });
        break;
      }
      asso.balance = round2(asso.balance + value);
      save();
      await refreshAssoPanel(client, asso);
      await interaction.reply({ content: `💝 Merci ! ${formatEuro(value)} versés à la caisse de ${asso.name}.`, ephemeral: true });
      break;
    }
    case "activity":
      if (!president) {
        await interaction.reply({ content: "❌ Réservé au président ou à la présidente.", ephemeral: true });
        break;
      }
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`asso_mactivity_${asso.id}`)
          .setTitle("📅 Organiser une activité")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("titre").setLabel("Nom de l'activité").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("quand").setLabel("Quand ? (date, heure)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("details").setLabel("Description, règles, récompense").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))
          )
      );
      break;
    case "mactivity": {
      const actId = nextId("act");
      const activity = {
        id: actId,
        title: interaction.fields.getTextInputValue("titre").trim(),
        when: interaction.fields.getTextInputValue("quand").trim(),
        details: interaction.fields.getTextInputValue("details").trim(),
        participants: [],
      };
      asso.activities[actId] = activity;
      save();
      await interaction.reply({ ...activityMessage(asso, activity), allowedMentions: { roles: [asso.roleId] }, content: `<@&${asso.roleId}>` });
      break;
    }
    case "go": {
      const activity = asso.activities[extra];
      if (!activity) {
        await interaction.reply({ content: "❌ Activité terminée.", ephemeral: true });
        break;
      }
      const going = activity.participants.includes(userId);
      activity.participants = going ? activity.participants.filter((p) => p !== userId) : [...activity.participants, userId];
      save();
      await interaction.update(activityMessage(asso, activity));
      break;
    }
    case "end": {
      const activity = asso.activities[extra];
      if (!president) {
        await interaction.reply({ content: "❌ Réservé au président ou à la présidente.", ephemeral: true });
        break;
      }
      if (!activity) {
        await interaction.update({ components: [] });
        break;
      }
      delete asso.activities[extra];
      save();
      const msg = activityMessage(asso, activity);
      msg.embeds[0].setColor(0x95a5a6).setFooter({ text: "Activité terminée" });
      await interaction.update({ ...msg, components: [] });
      break;
    }
    case "reward":
      if (!president) {
        await interaction.reply({ content: "❌ Réservé au président ou à la présidente.", ephemeral: true });
        break;
      }
      await interaction.reply({
        content: `🏆 Qui récompenser ? (caisse : ${formatEuro(asso.balance)})`,
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`asso_rewarduser_${asso.id}`).setPlaceholder("Choisir un membre"))],
      });
      break;
    case "rewarduser":
      await interaction.showModal(amountModal(`asso_mreward_${asso.id}_${interaction.values[0]}`, "🏆 Récompense", "Montant (€, pris sur la caisse)"));
      break;
    case "mreward": {
      if (!president) {
        await interaction.reply({ content: "❌ Réservé au président ou à la présidente.", ephemeral: true });
        break;
      }
      const value = readAmount(interaction);
      if (value <= 0 || value > asso.balance) {
        await interaction.reply({ content: `❌ Montant invalide (caisse : ${formatEuro(asso.balance)}).`, ephemeral: true });
        break;
      }
      if (changeBalance(extra, value, `Récompense de l'association ${asso.name}`) === null) {
        await interaction.reply({ content: "❌ Ce compte est gelé par l'IRF.", ephemeral: true });
        break;
      }
      asso.balance = round2(asso.balance - value);
      save();
      await refreshAssoPanel(client, asso);
      const panelChannel = await client.channels.fetch(asso.panelChannelId).catch(() => null);
      await panelChannel?.send(`🏆 <@${extra}> reçoit **${formatEuro(value)}** de l'association !`).catch(() => null);
      await interaction.reply({ content: `🏆 ${formatEuro(value)} versés à <@${extra}>.`, ephemeral: true });
      break;
    }
    case "handover":
      if (!isPresident(asso, userId) && !isGerant(interaction.member)) {
        await interaction.reply({ content: "❌ Réservé au président ou à la présidente.", ephemeral: true });
        break;
      }
      await interaction.reply({
        content: "🔁 À qui confier la présidence ? (la personne doit être adhérente)",
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`asso_handoveruser_${asso.id}`).setPlaceholder("Choisir le nouveau président"))],
      });
      break;
    case "handoveruser": {
      const next = interaction.values[0];
      if (!asso.members.includes(next)) {
        await interaction.update({ content: "❌ Cette personne n'est pas adhérente.", components: [] });
        break;
      }
      asso.presidentId = next;
      save();
      await applyPermissions(client, asso);
      await refreshAssoPanel(client, asso);
      await refreshList(client);
      await interaction.update({ content: `🔁 <@${next}> est la nouvelle présidence de ${asso.name}.`, components: [] });
      break;
    }
    default:
      return false;
  }
  return true;
}

function activityMessage(asso, activity) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x1abc9c)
        .setTitle(`📅 ${activity.title}`)
        .setDescription(
          `🗓️ **${activity.when}**\n\n${activity.details}\n\n` +
            `👥 Participants (${activity.participants.length}) : ${activity.participants.map((p) => `<@${p}>`).join(", ") || "*personne pour l'instant*"}`
        )
        .setFooter({ text: asso.name }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`asso_go_${asso.id}_${activity.id}`).setLabel("Je participe / je me retire").setEmoji("🙋").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`asso_end_${asso.id}_${activity.id}`).setLabel("Terminer (président)").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

async function setupAssociations(client) {
  load();
  for (const asso of activeAssos()) {
    await applyPermissions(client, asso);
    await refreshAssoPanel(client, asso);
  }
  await refreshList(client);
  console.log("Associations prêtes");
}

// Pour /profil : associations d'un membre.
function getAssociationsOf(userId) {
  return activeAssos()
    .filter((a) => a.members.includes(userId))
    .map((a) => ({ name: a.name, president: a.presidentId === userId, banned: a.status === "banned", channelId: a.panelChannelId }));
}

module.exports = { setupAssociations, handleAssociationsInteraction, openMayorMenu, getAssociationsOf };
