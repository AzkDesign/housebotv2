const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  PermissionFlagsBits,
  ChannelType,
  StringSelectMenuBuilder,
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error(
    "Variable DISCORD_TOKEN manquante. Définissez-la dans Railway ou dans un fichier .env local."
  );
  process.exit(1);
}

const WELCOME_ROLE_ID = "1509970096821375128";
const WELCOME_CHANNEL_ID = "1509966808675778590";
const WELCOME_EMBED_IMAGE =
  "https://cdn.discordapp.com/attachments/1344671822599426138/1505903724420272249/0BD58C7C-5F87-4FA4-8710-05DFED692781.gif";

const RULES_CHANNEL_ID = "1509974903552737333";
const RULES_LOG_CHANNEL_ID = "1509974614095429853";
const RULES_ACCEPTED_ROLE_ID = "1509975426179797012";
const ACCEPT_RULES_BUTTON_ID = "accept_reglement";

const TICKET_PANEL_CHANNEL_ID = "1509976660966117537";
const TICKET_PANEL_BANNER =
  "https://images-ext-1.discordapp.net/external/fymp_3Bv8_xq96BUOw_Mow-LTyXwUvGej1pTsjBI2N4/https/crowbots.shop/image/32INI.1507463853666210074.jpg?format=webp&width=1226&height=325";
const TICKET_CATEGORY_ID = "1509977402485510345";
const TICKET_SELECT_MENU_ID = "ticket_open_menu";
const CLOSE_TICKET_BUTTON_ID = "close_ticket";
// Rôle staff pouvant voir tous les tickets (null = désactivé, admins Discord voient quand même)
const TICKET_STAFF_ROLE_ID = null;

const {
  CANDIDATURE_CATEGORY_ID,
  ADMIN_VOTE_ROLE_ID,
  isCandidatureCategory,
  startCandidatureQuestionnaire,
  handleCandidatureVote,
  setupCandidatureCategoryPermissions,
  restoreCandidatureReminders,
  restoreCandidatureSessions,
  handleCandidatureResume,
} = require("./candidature");
const {
  refreshHierarchy,
  memberHasHierarchyRole,
} = require("./hierarchie");
const { startRepasScheduler } = require("./repas");
const { setupChambresPanel, handleChambreInteraction } = require("./chambres");
const {
  setupBudgetPanel,
  startBudgetScheduler,
  handleBudgetInteraction,
  handleAchatDmMessage,
} = require("./budget");
const {
  setupSignalementPanel,
  handleSignalementInteraction,
} = require("./signalements");
const { registerSlashCommands } = require("./commands");
const { handleClearCommand } = require("./clear");
const { setupCasino, handleCasinoInteraction } = require("./casino");
const { pseudo } = require("./noms");
const { setupDepot, handleDepotInteraction } = require("./depot");
const { setupIrfPanel, handleIrfInteraction } = require("./irf");
const { setupAirbnb, handleAirbnbInteraction } = require("./airbnb");
const { setupEntreprises, handleEntreprisesInteraction } = require("./entreprises");
const { setupImpots, handleImpotsInteraction } = require("./impots");
const { setupMairie, handleMairieInteraction } = require("./mairie");
const { setupAssociations, handleAssociationsInteraction } = require("./associations");
const { handleProfilCommand } = require("./profil");
const { setupEspaces, handleEspacesInteraction, isProtectedChannel, publishMixiteAnnouncement } = require("./espaces");
const { publishV3Announcement, publishV3Video, publishRecruitmentAnnouncement, publishSecurityAlert, publishSecurityEnd } = require("./annonce");
const { setupLogs } = require("./logs");
const { handleRelayMessage, handleRelayInteraction } = require("./relais");
const { startInactivityWatcher } = require("./tickets");
const { setupMembreStar, handleStarInteraction } = require("./membrestar");
const { setupFeed } = require("./feed");
const { setupLois, handleLoisInteraction } = require("./lois");
const { setupCartes, handleCartesInteraction } = require("./cartes");
const { setupGuide } = require("./guide");
const { handleLevelMessage, handleLevelCommand } = require("./levels");
const { setupRichestLeaderboard, handleEconomieInteraction } = require("./economie");
const { setupShopPanel, handleShopInteraction } = require("./boutique");
const { setupCreditTable, handleCreditInteraction } = require("./credit");
const { setupMissionPanel, handleMissionInteraction } = require("./missions");
const { buildRulesEmbeds } = require("./reglement");

const TICKET_TYPES = {
  question: {
    label: "Question",
    prefix: "question",
    emoji: "❓",
    description: "Poser une question au staff",
  },
  candidature: {
    label: "Candidature",
    prefix: "candidature",
    emoji: "📋",
    description: "Postuler / recrutement",
  },
  report: {
    label: "Report",
    prefix: "report",
    emoji: "🚨",
    description: "Signaler un problème",
  },
  identification: {
    label: "Identification",
    prefix: "identification",
    emoji: "🪪",
    description: "Confirmer votre identité",
  },
};

const WELCOME_DM = `🏠 Bienvenue dans la maison.

Nous sommes heureux de vous accueillir sur notre serveur Discord.
Afin de rejoindre officiellement la maison, merci d'ouvrir un ticket pour :

• effectuer votre recrutement
• vous identifier
• poser vos questions au staff

Un responsable prendra votre demande en charge dès que possible.

Merci de respecter le règlement et profitez bien du serveur.`;

function buildWelcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle("🏠 Bienvenue dans la maison")
    .setDescription(
      `Bonjour **${pseudo(member.id)}**, nous sommes ravis de vous accueillir parmi nous.\n\n` +
        `Vous faites désormais partie de notre communauté — prenez le temps de vous installer, de découvrir les salons et de faire connaissance avec les autres membres.\n\n` +
        `Pour rejoindre officiellement la maison, ouvrez un **ticket** afin de vous recruter, vous identifier ou poser vos questions au staff.\n\n` +
        `*Merci de respecter le règlement. Bon séjour parmi nous.*`
    )
    .setImage(WELCOME_EMBED_IMAGE)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({
      text: `Membre n°${member.guild.memberCount} • ${member.guild.name}`,
      iconURL: member.guild.iconURL({ size: 64 }) ?? undefined,
    })
    .setTimestamp();
}

function buildRulesAcceptRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ACCEPT_RULES_BUTTON_ID)
      .setLabel("J'accepte le reglement")
      .setEmoji("🦋")
      .setStyle(ButtonStyle.Secondary)
  );
}

async function setupRulesMessage(client) {
  const channel = await client.channels.fetch(RULES_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon règlement ${RULES_CHANNEL_ID} introuvable`);
    return;
  }

  const embeds = buildRulesEmbeds();
  const messages = await channel.messages.fetch({ limit: 50 });
  const botMessages = [...messages.values()]
    .filter((m) => m.author.id === client.user.id)
    .sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  // Republie seulement si le texte du règlement a changé
  const upToDate =
    botMessages.length === embeds.length &&
    botMessages.every(
      (m, i) => m.embeds[0]?.description === embeds[i].data.description
    );
  if (upToDate) {
    console.log("Message règlement déjà à jour");
    return;
  }

  for (const m of botMessages) await m.delete().catch(() => {});

  for (let i = 0; i < embeds.length; i++) {
    const isLast = i === embeds.length - 1;
    await channel.send({
      embeds: [embeds[i]],
      components: isLast ? [buildRulesAcceptRow()] : [],
    });
  }
  console.log(`Message règlement publié (${embeds.length} parties)`);
}

function slugifyUsername(username) {
  return (
    username
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20) || "membre"
  );
}

function buildTicketPanelEmbed(guild) {
  const rulesMention = `<#${RULES_CHANNEL_ID}>`;

  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setDescription(
      `🦋 **• SUPPORT TICKET •** 🦋\n` +
        `♡ ••••• ♡\n\n` +
        `*Tu as une question ? Une candidature ? Un signalement ? Tu souhaites t'identifier ?*\n\n` +
        `⤷ **Ouvre un ticket parmi les options suivantes :**\n\n` +
        `💋 • **QUESTION** • ୨୧\n` +
        `💋 • **CANDIDATURE** • ୨୧\n` +
        `💋 • **REPORT** • ୨୧\n` +
        `💋 • **IDENTIFICATION** • ୨୧\n\n` +
        `🔴 __**Raccourcis :**__\n` +
        `> Maison\n` +
        `${rulesMention}`
    )
    .setImage(TICKET_PANEL_BANNER)
    .setFooter({ text: guild.name });
}

function buildTicketSelectRow() {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(TICKET_SELECT_MENU_ID)
    .setPlaceholder("🦋 Choisir le type de ticket")
    .addOptions(
      Object.entries(TICKET_TYPES).map(([value, type]) => ({
        label: type.label,
        value,
        description: type.description,
        emoji: type.emoji,
      }))
    );

  return new ActionRowBuilder().addComponents(menu);
}

function buildCloseTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(CLOSE_TICKET_BUTTON_ID)
      .setLabel("Fermer le ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger)
  );
}

function findOpenTicket(guild, memberId) {
  return guild.channels.cache.find(
    (ch) =>
      (ch.parentId === TICKET_CATEGORY_ID ||
        ch.parentId === CANDIDATURE_CATEGORY_ID) &&
      ch.type === ChannelType.GuildText &&
      (ch.topic === memberId ||
        ch.topic === `candidature:${memberId}` ||
        (ch.topic?.startsWith(`candidature:vote:${memberId}:`) && !ch.topic.includes(":closed")))
  );
}

function getTicketCategoryId(ticketType) {
  return ticketType === "candidature"
    ? CANDIDATURE_CATEGORY_ID
    : TICKET_CATEGORY_ID;
}

function getTicketTopic(ticketType, memberId) {
  return ticketType === "candidature"
    ? `candidature:${memberId}`
    : memberId;
}

async function createTicketChannel(member, ticketType) {
  const config = TICKET_TYPES[ticketType];
  if (!config) throw new Error("Type de ticket invalide");

  const guild = member.guild;
  const existing = findOpenTicket(guild, member.id);
  if (existing) {
    return { existing, config };
  }

  const channelName = `${config.prefix}-${slugifyUsername(member.user.username)}`.slice(
    0,
    100
  );

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  if (TICKET_STAFF_ROLE_ID && guild.roles.cache.has(TICKET_STAFF_ROLE_ID)) {
    permissionOverwrites.push({
      id: TICKET_STAFF_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  }

  if (
    ticketType === "candidature" &&
    guild.roles.cache.has(ADMIN_VOTE_ROLE_ID)
  ) {
    permissionOverwrites.push({
      id: ADMIN_VOTE_ROLE_ID,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.SendMessages,
      ],
    });
  }

  const categoryId = getTicketCategoryId(ticketType);

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    topic: getTicketTopic(ticketType, member.id),
    permissionOverwrites,
  });

  if (ticketType === "candidature") {
    await startCandidatureQuestionnaire(ticketChannel, member);
  } else {
    const ticketEmbed = new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle(`🦋 Ticket — ${config.label}`)
      .setDescription(
        `Bonjour **${pseudo(member.id)}**,\n\n` +
          `Votre ticket **${config.label}** a été ouvert.\n` +
          `Décrivez votre demande en détail — un membre du staff vous répondra dès que possible.\n\n` +
          `*Merci de rester patient et respectueux.*`
      )
      .setTimestamp();

    await ticketChannel.send({
      content: `${member}`,
      embeds: [ticketEmbed],
      components: [buildCloseTicketRow()],
    });
  }

  return { channel: ticketChannel, config };
}

async function setupTicketPanel(client) {
  const channel = await client.channels
    .fetch(TICKET_PANEL_CHANNEL_ID)
    .catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon tickets ${TICKET_PANEL_CHANNEL_ID} introuvable`);
    return;
  }

  const messages = await channel.messages.fetch({ limit: 25 });
  const existing = messages.find(
    (m) =>
      m.author.id === client.user.id &&
      m.components.some((row) =>
        row.components.some((c) => c.customId === TICKET_SELECT_MENU_ID)
      )
  );

  if (existing) {
    console.log("Panneau tickets déjà présent");
    return;
  }

  await channel.send({
    embeds: [buildTicketPanelEmbed(channel.guild)],
    components: [buildTicketSelectRow()],
  });
  console.log("Panneau tickets publié");
}

async function setupTicketCategoryPermissions(guild) {
  const category = guild.channels.cache.get(TICKET_CATEGORY_ID);
  if (!category) return;

  const everyoneId = guild.roles.everyone.id;
  const denyView = { ViewChannel: false };

  await category.permissionOverwrites.edit(everyoneId, denyView);
  await category.permissionOverwrites.edit(WELCOME_ROLE_ID, denyView);
  await category.permissionOverwrites.edit(RULES_ACCEPTED_ROLE_ID, denyView);
}

async function setupGuildPermissions(guild) {
  const welcomeRole = guild.roles.cache.get(WELCOME_ROLE_ID);
  const verifiedRole = guild.roles.cache.get(RULES_ACCEPTED_ROLE_ID);

  if (!welcomeRole || !verifiedRole) {
    console.warn(
      `[${guild.name}] Rôles accueil ou vérifié introuvables — permissions non configurées`
    );
    return;
  }

  const everyoneId = guild.roles.everyone.id;

  const viewAndHistory = {
    ViewChannel: true,
    ReadMessageHistory: true,
  };

  const rulesChannel = guild.channels.cache.get(RULES_CHANNEL_ID);
  if (rulesChannel) {
    await rulesChannel.permissionOverwrites.edit(everyoneId, {
      ViewChannel: false,
    });
    await rulesChannel.permissionOverwrites.edit(WELCOME_ROLE_ID, viewAndHistory);
    await rulesChannel.permissionOverwrites.edit(
      RULES_ACCEPTED_ROLE_ID,
      viewAndHistory
    );
    console.log(`[${guild.name}] Permissions salon règlement configurées`);
  }

  const channelTypes = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.GuildStageVoice,
    ChannelType.GuildForum,
    ChannelType.GuildCategory,
  ];

  await setupTicketCategoryPermissions(guild);
  await setupCandidatureCategoryPermissions(
    guild,
    WELCOME_ROLE_ID,
    RULES_ACCEPTED_ROLE_ID
  );

  for (const channel of guild.channels.cache.values()) {
    if (channel.id === RULES_CHANNEL_ID) continue;
    if (channel.id === TICKET_CATEGORY_ID) continue;
    if (channel.id === CANDIDATURE_CATEGORY_ID) continue;
    if (channel.parentId === TICKET_CATEGORY_ID) continue;
    if (channel.parentId === CANDIDATURE_CATEGORY_ID) continue;
    // Salons privés (entreprises, bureau du maire, ou sujet commençant par « privé: ») : ne pas les ouvrir à tous
    if (channel.topic?.startsWith("entreprise:") || channel.topic?.startsWith("privé:")) continue;
    if (isProtectedChannel(channel)) continue; // espaces Jeunes / Entrepreneurs (catégories et salons vocaux)
    if (!channelTypes.includes(channel.type)) continue;

    try {
      await channel.permissionOverwrites.edit(everyoneId, {
        ViewChannel: false,
      });
      await channel.permissionOverwrites.edit(WELCOME_ROLE_ID, {
        ViewChannel: false,
      });
      await channel.permissionOverwrites.edit(
        RULES_ACCEPTED_ROLE_ID,
        viewAndHistory
      );
    } catch (err) {
      console.warn(
        `[${guild.name}] Impossible de configurer #${channel.name}:`,
        err.message
      );
    }
  }

  console.log(`[${guild.name}] Permissions serveur configurées (règlement seul sans acceptation)`);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.GuildMember, Partials.Channel, Partials.Message],
});

// Chaque étape est isolée : une erreur dans l'une ne bloque pas les suivantes.
async function step(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`Démarrage (${name}):`, err);
  }
}

client.once(Events.ClientReady, async () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
  // Les commandes slash en premier, pour qu'elles soient toujours disponibles.
  await step("commandes slash", () => registerSlashCommands(client, TOKEN));
  await step("logs", () => setupLogs(client));
  await step("pseudos", () => require("./noms").setupNoms(client));
  await step("la Maison au quotidien", () => setupFeed(client));
  await step("tickets inactifs", () => startInactivityWatcher(client));
  await step("règlement", () => setupRulesMessage(client));
  await step("tickets", () => setupTicketPanel(client));

  for (const guild of client.guilds.cache.values()) {
    await step(`permissions ${guild.name}`, () => setupGuildPermissions(guild));
  }

  await step("rappels candidature", () => restoreCandidatureReminders(client));
  await step("questionnaires interrompus", () => restoreCandidatureSessions(client));

  for (const guild of client.guilds.cache.values()) {
    await step(`hiérarchie ${guild.name}`, () => refreshHierarchy(guild, client));
  }

  await step("repas", () => startRepasScheduler(client));
  await step("chambres", () => setupChambresPanel(client));
  await step("budget", () => setupBudgetPanel(client));
  await step("budget (planificateur)", () => startBudgetScheduler(client));
  await step("signalements", () => setupSignalementPanel(client));
  await step("classement", () => setupRichestLeaderboard(client));
  await step("boutique", () => setupShopPanel(client));
  await step("crédit", () => setupCreditTable(client));
  await step("missions", () => setupMissionPanel(client));
  await step("casino", () => setupCasino(client));
  await step("IRF", () => setupIrfPanel(client));
  await step("suppressions en attente", () => require("./nettoyage").resumeDeletes(client));
  await step("dépôts", () => setupDepot());
  await step("Airbnb", () => setupAirbnb(client));
  await step("Entreprises", () => setupEntreprises(client));
  await step("Impôts", () => setupImpots(client));
  await step("Mairie", () => setupMairie(client));
  await step("Associations", () => setupAssociations(client));
  await step("Lois", () => setupLois(client));
  await step("Espaces Jeunes / Entrepreneurs", () => setupEspaces(client));
  await step("Membre Star", () => setupMembreStar(client));
  await step("Cartes de la Maison", () => setupCartes(client));
  await step("Guide de la Maison", () => setupGuide(client));
  await step("annonce V3", () => publishV3Announcement(client));
  await step("vidéo V3", () => publishV3Video(client));
  await step("annonce recrutement", () => publishRecruitmentAnnouncement(client));
  await step("annonce mixité Maison 2", () => publishMixiteAnnouncement(client));
  await step("alerte sécurité DDoS", () => publishSecurityAlert(client));
  await step("fin du confinement", () => publishSecurityEnd(client));
});

client.on(Events.MessageCreate, async (message) => {
  await handleRelayMessage(message, client).catch((err) => console.error("Relais:", err.message));
  await handleAchatDmMessage(message, client).catch((err) =>
    console.error("MP achat:", err.message)
  );
  await handleLevelMessage(message).catch((err) =>
    console.error("Niveaux:", err.message)
  );
});

// Une erreur dans un bouton ne doit jamais arrêter le bot : on la note et on prévient le membre.
client.on(Events.InteractionCreate, (interaction) => {
  onInteraction(interaction).catch(async (err) => {
    console.error(`Interaction ${interaction.customId ?? interaction.commandName ?? "?"}:`, err);
    if (!interaction.isRepliable()) return;
    const payload = { content: "❌ Une erreur est survenue. Réessayez, ou contactez le staff si ça continue.", ephemeral: true };
    await (interaction.replied || interaction.deferred ? interaction.followUp(payload) : interaction.reply(payload)).catch(() => null);
  });
});

async function onInteraction(interaction) {
  if (interaction.isButton() && interaction.customId === "candidature_resume") {
    await handleCandidatureResume(interaction);
    return;
  }
  if (await handleRelayInteraction(interaction, client)) return;
  if (await handleStarInteraction(interaction, client)) return;
  if (await handleLoisInteraction(interaction, client)) return;
  if (await handleCartesInteraction(interaction, client)) return;
  if (await handleClearCommand(interaction)) return;
  if (await handleProfilCommand(interaction)) return;
  if (await handleEspacesInteraction(interaction)) return;
  if (await handleCasinoInteraction(interaction, client)) return;
  if (await handleIrfInteraction(interaction, client)) return;
  if (await handleDepotInteraction(interaction, client)) return;
  if (await handleAirbnbInteraction(interaction, client)) return;
  if (await handleEntreprisesInteraction(interaction, client)) return;
  if (await handleImpotsInteraction(interaction, client)) return;
  if (await handleMairieInteraction(interaction, client)) return;
  if (await handleAssociationsInteraction(interaction, client)) return;
  if (await handleLevelCommand(interaction)) return;
  if (await handleEconomieInteraction(interaction, client)) return;
  if (await handleCreditInteraction(interaction, client)) return;
  if (await handleMissionInteraction(interaction, client)) return;
  if (await handleShopInteraction(interaction, client)) return;
  if (await handleSignalementInteraction(interaction, client)) return;
  if (await handleBudgetInteraction(interaction)) return;
  if (await handleChambreInteraction(interaction)) return;

  if (interaction.isButton() && interaction.customId === ACCEPT_RULES_BUTTON_ID) {
    const member = interaction.member;
    if (!member) return;

    const role = interaction.guild.roles.cache.get(RULES_ACCEPTED_ROLE_ID);

    if (member.roles.cache.has(RULES_ACCEPTED_ROLE_ID)) {
      await interaction.reply({
        content: "🦋 Vous avez déjà accepté le règlement.",
        ephemeral: true,
      });
      return;
    }

    try {
      const welcomeRole = interaction.guild.roles.cache.get(WELCOME_ROLE_ID);

      if (role) await member.roles.add(role);
      else console.warn(`Rôle ${RULES_ACCEPTED_ROLE_ID} introuvable`);

      if (welcomeRole && member.roles.cache.has(WELCOME_ROLE_ID)) {
        await member.roles.remove(welcomeRole);
      }

      const logChannel = interaction.guild.channels.cache.get(RULES_LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        const logEmbed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("✅ Règlement accepté")
          .setDescription(
            `**${pseudo(member.id)}** (\`${member.user.tag}\`) a accepté le règlement officiel.`
          )
          .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
          .setTimestamp();

        await logChannel.send({ embeds: [logEmbed] });
      }

      await interaction.reply({
        content:
          "🦋 Merci ! Vous avez accepté le règlement. Bienvenue officiellement dans la maison.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("Erreur acceptation règlement:", err.message);
      await interaction.reply({
        content:
          "❌ Impossible d'attribuer le rôle. Contactez un membre du staff.",
        ephemeral: true,
      });
    }
    return;
  }

  if (
    interaction.isStringSelectMenu() &&
    interaction.customId === TICKET_SELECT_MENU_ID
  ) {
    const member = interaction.member;
    if (!member) return;

    const ticketType = interaction.values[0];
    const config = TICKET_TYPES[ticketType];

    if (!config) {
      await interaction.reply({
        content: "❌ Option de ticket invalide.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const result = await createTicketChannel(member, ticketType);

      if (result.existing) {
        await interaction.editReply({
          content: `🦋 Vous avez déjà un ticket ouvert : ${result.existing}`,
        });
        return;
      }

      await interaction.editReply({
        content: `🦋 Ticket **${config.label}** créé : ${result.channel}`,
      });
    } catch (err) {
      console.error("Erreur création ticket:", err.message);
      await interaction.editReply({
        content:
          "❌ Impossible de créer le ticket. Vérifiez que le bot a la permission **Gérer les salons**.",
      });
    }
    return;
  }

  if (
    interaction.isButton() &&
    interaction.customId.startsWith("candidature_") &&
    (interaction.customId.includes("_pour_") ||
      interaction.customId.includes("_contre_"))
  ) {
    await handleCandidatureVote(interaction);
    return;
  }

  if (interaction.isButton() && interaction.customId === CLOSE_TICKET_BUTTON_ID) {
    const channel = interaction.channel;
    if (
      !channel ||
      (channel.parentId !== TICKET_CATEGORY_ID &&
        !isCandidatureCategory(channel.parentId))
    ) {
      return;
    }

    const member = interaction.member;
    const isOwner =
      channel.topic === member?.id ||
      channel.topic === `candidature:${member?.id}` ||
      channel.topic?.startsWith(`candidature:vote:${member?.id}:`);
    const isStaff = member?.permissions.has(PermissionFlagsBits.ManageChannels);

    if (!isOwner && !isStaff) {
      await interaction.reply({
        content: "❌ Seul le créateur du ticket ou le staff peut le fermer.",
        ephemeral: true,
      });
      return;
    }

    await interaction.reply({ content: "🔒 Fermeture du ticket dans 3 secondes…" });

    setTimeout(async () => {
      try {
        await require("./tickets").closeTicket(channel, { reason: "Ticket fermé", closedBy: interaction.user });
      } catch (err) {
        console.error("Erreur fermeture ticket:", err.message);
      }
    }, 3000);
  }
}

// Dernier filet : une erreur oubliée est notée au lieu d'arrêter le bot.
client.on(Events.Error, (err) => console.error("Client Discord:", err));
process.on("unhandledRejection", (err) => console.error("Erreur non gérée:", err));

client.on("guildMemberUpdate", async (oldMember, newMember) => {
  if (
    memberHasHierarchyRole(oldMember) ||
    memberHasHierarchyRole(newMember)
  ) {
    await refreshHierarchy(newMember.guild, client).catch(() => null);
  }
});

client.on("guildMemberRemove", async (member) => {
  if (memberHasHierarchyRole(member)) {
    await refreshHierarchy(member.guild, client).catch(() => null);
  }
});

client.on("guildMemberAdd", async (member) => {
  try {
    const role = member.guild.roles.cache.get(WELCOME_ROLE_ID);
    if (role) {
      await member.roles.add(role);
      console.log(`Rôle attribué à ${member.user.tag}`);
    } else {
      console.warn(`Rôle ${WELCOME_ROLE_ID} introuvable sur ${member.guild.name}`);
    }
  } catch (err) {
    console.error(`Impossible d'attribuer le rôle à ${member.user.tag}:`, err.message);
  }

  try {
    await member.send(WELCOME_DM);
    console.log(`MP envoyé à ${member.user.tag}`);
  } catch (err) {
    console.error(`Impossible d'envoyer le MP à ${member.user.tag}:`, err.message);
  }

  try {
    const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
    if (channel?.isTextBased()) {
      await channel.send({
        content: `${member}`,
        embeds: [buildWelcomeEmbed(member)],
      });
      console.log(`Message d'accueil envoyé dans #${channel.name}`);
    } else {
      console.warn(`Salon ${WELCOME_CHANNEL_ID} introuvable ou non textuel`);
    }
  } catch (err) {
    console.error(
      `Impossible d'envoyer le message d'accueil pour ${member.user.tag}:`,
      err.message
    );
  }

  if (memberHasHierarchyRole(member)) {
    await refreshHierarchy(member.guild, client).catch(() => null);
  }
});

client.login(TOKEN);
