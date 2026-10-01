// Deux espaces séparés : la Maison des Jeunes (rôle Situation délicate)
// et la Maison des Entrepreneurs (rôle Entrepreneur). Chaque groupe ne voit que le sien ;
// les gérants et la Fondation voient les deux.
const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { GERANTS_ROLE_ID, isGerant } = require("./economie");
const { ENTREPRENEUR_ROLE_ID, SITUATION_DELICATE_ROLE_ID } = require("./casino");
const { findOrCreateChannel } = require("./salons");

const FONDATION_ROLE_ID = "1509979964651343993";
const TICKET_CATEGORY_ID = "1509977402485510345";
const IRF_CHANNEL_ID = "1527524719094534185";
const STATE_FILE = require("./data").dataFile("espaces-state.json");

// readOnly : seul le staff peut écrire · voice : salon vocal · panel : bouton « besoin de parler »
const SPACES = {
  jeunes: {
    category: "🌸 Maison des Jeunes",
    roleId: SITUATION_DELICATE_ROLE_ID,
    channels: [
      { name: "╭⊱・annonces・📢", readOnly: true },
      { name: "┊⊱・règles・📜", readOnly: true, rules: true },
      { name: "┊‼・discussion・💬" },
      { name: "┊⊱・entraide・🤝" },
      { name: "┊⊱・activités・🎨" },
      { name: "╰⊱・besoin-de-parler・💗", readOnly: true, panel: true },
    ],
    rules: [
      "💗 **Bienveillance avant tout** : ici, on s'entraide et on ne juge personne.",
      "🔒 **Ne partage jamais tes informations personnelles** : adresse, téléphone, école, photos.",
      "🚫 **Pas de messages privés avec des inconnus ni avec des adultes.** Si quelqu'un insiste, préviens tout de suite un référent.",
      "🤐 Ce qui se dit dans cet espace reste dans cet espace.",
      "🆘 Un souci, quelque chose qui te met mal à l'aise ? Utilise **besoin-de-parler** : un référent te répond en privé.",
    ],
  },
  entrepreneurs: {
    category: "💼 Maison des Entrepreneurs",
    roleId: ENTREPRENEUR_ROLE_ID,
    channels: [
      { name: "╭⊱・annonces・📢", readOnly: true },
      { name: "┊⊱・règles・📜", readOnly: true, rules: true },
      { name: "┊‼・discussion・💬" },
      { name: "┊⊱・networking・🤝" },
      { name: "┊⊱・bons-plans・💡" },
      { name: "┊⊱・projets・🚀" },
      { name: "╰⊱・Salle de réunion・🎙️", voice: true },
    ],
    rules: [
      "🤝 **Respect et professionnalisme** entre entrepreneurs.",
      "🧾 Les échanges d'argent passent par les **factures** et le **Registre du commerce** : pas de travail au noir.",
      "🚫 **Aucune arnaque** : toute fraude est signalée à l'IRF et sanctionnée.",
      "💡 Partagez vos bons plans, vos projets, et cherchez des partenaires.",
      "🔒 Cet espace est réservé aux Entrepreneurs : ce qui s'y dit reste entre vous.",
    ],
  },
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function save(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Utilisé au démarrage pour ne pas rendre ces salons visibles à tous.
let protectedIds = new Set(Object.values(load()).flatMap((s) => [s.categoryId, ...(s.channelIds ?? [])]).filter(Boolean));
function isProtectedChannel(channel) {
  return protectedIds.has(channel.id) || protectedIds.has(channel.parentId);
}

function overwrites(guild, client, roleId, { readOnly, voice } = {}) {
  const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  const talk = voice ? [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] : [PermissionFlagsBits.SendMessages];
  const staff = [...view, ...talk, ...(voice ? [] : [PermissionFlagsBits.ManageMessages])];
  const list = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [...view, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels] },
    readOnly ? { id: roleId, allow: view, deny: [PermissionFlagsBits.SendMessages] } : { id: roleId, allow: [...view, ...talk] },
  ];
  for (const staffRole of [GERANTS_ROLE_ID, FONDATION_ROLE_ID]) {
    if (guild.roles.cache.has(staffRole)) list.push({ id: staffRole, allow: staff });
  }
  return list;
}

async function postOnce(channel, client, title, payload) {
  const recent = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const existing = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === title);
  if (existing) await existing.edit(payload).catch(() => null);
  else await channel.send(payload).catch(() => null);
}

async function setupSpace(client, guild, key) {
  const space = SPACES[key];
  const state = load();
  const saved = state[key] ?? {};

  const category = await findOrCreateChannel(guild, {
    id: saved.categoryId,
    name: space.category,
    type: ChannelType.GuildCategory,
    permissionOverwrites: overwrites(guild, client, space.roleId),
  });
  await category.permissionOverwrites.set(overwrites(guild, client, space.roleId)).catch(() => null);

  const channelIds = [];
  for (const def of space.channels) {
    const type = def.voice ? ChannelType.GuildVoice : ChannelType.GuildText;
    const perms = overwrites(guild, client, space.roleId, def);
    const channel = await findOrCreateChannel(guild, { name: def.name, type, parent: category.id, permissionOverwrites: perms });
    // Permissions réappliquées à chaque démarrage : l'espace reste réservé à son groupe.
    await channel.permissionOverwrites.set(perms).catch(() => null);
    if (!def.voice && !channel.topic?.startsWith("privé:")) {
      await channel.setTopic(`privé: ${space.category}`).catch(() => null);
    }
    channelIds.push(channel.id);

    if (def.rules) {
      await postOnce(channel, client, `📜 Règles — ${space.category}`, {
        embeds: [
          new EmbedBuilder()
            .setColor(key === "jeunes" ? 0xff8fab : 0x8b0000)
            .setTitle(`📜 Règles — ${space.category}`)
            .setDescription(space.rules.join("\n\n")),
        ],
      });
    }
    if (def.panel) {
      await postOnce(channel, client, "💗 Besoin de parler ?", {
        embeds: [
          new EmbedBuilder()
            .setColor(0xff8fab)
            .setTitle("💗 Besoin de parler ?")
            .setDescription(
              "Un souci, une question, quelque chose qui te pèse ou qui te met mal à l'aise ?\n\n" +
                "Clique sur le bouton : un salon **privé** s'ouvre avec un référent de la Maison. Personne d'autre ne le voit."
            ),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("espace_parler").setLabel("Parler à un référent").setEmoji("💗").setStyle(ButtonStyle.Primary)
          ),
        ],
      });
    }
  }

  state[key] = { categoryId: category.id, channelIds };
  save(state);
  protectedIds = new Set(Object.values(state).flatMap((s) => [s.categoryId, ...(s.channelIds ?? [])]).filter(Boolean));
}

async function setupEspaces(client) {
  const irf = await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null);
  const guild = irf?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  for (const key of Object.keys(SPACES)) await setupSpace(client, guild, key);
  console.log("Espaces Jeunes et Entrepreneurs prêts");
}

// --- Ticket « besoin de parler » ---

async function openTalkTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const existing = guild.channels.cache.find((c) => c.topic === `privé:ecoute:${member.id}`);
  if (existing) {
    await interaction.reply({ content: `💗 Tu as déjà un salon ouvert : ${existing}`, ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });

  const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
  const perms = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow },
    { id: guild.members.me.id, allow: [...allow, PermissionFlagsBits.ManageChannels] },
  ];
  for (const staffRole of [GERANTS_ROLE_ID, FONDATION_ROLE_ID]) {
    if (guild.roles.cache.has(staffRole)) perms.push({ id: staffRole, allow });
  }
  const slug = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "membre";
  const channel = await guild.channels
    .create({ name: `ecoute-${slug}`.slice(0, 100), type: ChannelType.GuildText, parent: TICKET_CATEGORY_ID, topic: `privé:ecoute:${member.id}`, permissionOverwrites: perms })
    .catch((err) => {
      console.error("Ticket écoute:", err.message);
      return null;
    });
  if (!channel) {
    await interaction.editReply("❌ Impossible d'ouvrir le salon. Contacte directement un membre de la Fondation.");
    return;
  }
  await channel.send({
    content: `${member} <@&${FONDATION_ROLE_ID}>`,
    allowedMentions: { users: [member.id], roles: [FONDATION_ROLE_ID] },
    embeds: [
      new EmbedBuilder()
        .setColor(0xff8fab)
        .setTitle("💗 Salon d'écoute")
        .setDescription(`Bonjour ${member}, un référent va te répondre ici. Prends ton temps, ce salon est privé.`),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("espace_fermer").setLabel("Fermer ce salon").setEmoji("🔒").setStyle(ButtonStyle.Secondary)
      ),
    ],
  });
  await interaction.editReply(`💗 Ton salon privé est ouvert : ${channel}`);
}

async function handleEspacesInteraction(interaction) {
  if (!interaction.isButton()) return false;
  if (interaction.customId === "espace_parler") {
    await openTalkTicket(interaction);
    return true;
  }
  if (interaction.customId === "espace_fermer") {
    const channel = interaction.channel;
    const ownerId = channel?.topic?.startsWith("privé:ecoute:") ? channel.topic.slice("privé:ecoute:".length) : null;
    const staff = isGerant(interaction.member) || interaction.member.roles.cache.has(FONDATION_ROLE_ID);
    if (!ownerId || (interaction.user.id !== ownerId && !staff)) {
      await interaction.reply({ content: "❌ Tu ne peux pas fermer ce salon.", ephemeral: true });
      return true;
    }
    await interaction.reply("🔒 Le salon sera fermé dans 5 secondes. Prends soin de toi 💗");
    setTimeout(() => channel.delete("Salon d'écoute fermé").catch(() => null), 5000);
    return true;
  }
  return false;
}

module.exports = { setupEspaces, handleEspacesInteraction, isProtectedChannel };
