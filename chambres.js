const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  changeBalance,
  readBalance,
  addToTreasury,
  formatEuro,
  isGerant,
  GERANTS_ROLE_ID,
} = require("./economie");
// Maison 2 : mixte, réservée aux Entrepreneurs (adultes)
const ENTREPRENEUR_ROLE_ID = "1554940569732517909";
const { deleteLater, deleteInteractionMessageLater, getDossiersChannel, MINUTE, HOUR } = require("./nettoyage");

const CHAMBRES_CHANNEL_ID = "1509983864624386048";
const TICKET_CATEGORY_ID = "1509977402485510345";
const CHAMBRE_AJOUT_BUTTON_ID = "chambre_ajout";
const CHAMBRE_RETRAIT_BUTTON_ID = "chambre_retrait";
const CHAMBRE_SELECT_ROOM_ID = "chambre_select_room";
const CHAMBRE_SELECT_REMOVE_ROOM_ID = "chambre_select_remove_room";
const CHAMBRE_SELECT_USER_PREFIX = "chambre_select_user:";
const CHAMBRE_REMOVE_USER_PREFIX = "chambre_remove_user:";
const STATE_FILE = require("./data").dataFile("chambres-state.json");
const PANEL_TITLE = "🛏️ Tableau des chambres";

/** La Fondation : ce rôle gère les chambres et les déménagements */
const CHAMBRE_STAFF_ROLE_ID = "1509979964651343993";

// --- Quartiers (du plus prestigieux au plus modeste) ---
// tax : taxe d'habitation par semaine et par occupant · moveFee : frais pour y emménager
const QUARTIERS = {
  haussmann: {
    name: "Haussmann",
    emoji: "💎",
    stars: 4,
    tax: 500,
    moveFee: 1500,
    description: "Les grands boulevards, les moulures et les parquets qui craquent juste ce qu'il faut. Le prestige de la Maison.",
    amenities: ["Terrasse avec vue", "Salle de sport privée", "Salle de bain privée", "Conciergerie"],
  },
  marais: {
    name: "Le Marais",
    emoji: "🌳",
    stars: 3,
    tax: 300,
    moveFee: 800,
    description: "Pavés, petites cours intérieures et ambiance chic. On y vit bien, sans en faire trop.",
    amenities: ["Suite spacieuse", "Salle de bain privée", "Salon commun cosy"],
  },
  montmartre: {
    name: "Montmartre",
    emoji: "🎨",
    stars: 2,
    tax: 150,
    moveFee: 400,
    description: "L'esprit village et les artistes. Confortable, mais il faut partager.",
    amenities: ["Chambre double confortable", "Salle de bain partagée à deux", "Cuisine commune"],
  },
  belleville: {
    name: "Belleville",
    emoji: "🏘️",
    stars: 1,
    tax: 50,
    moveFee: 200,
    description: "Populaire et vivant. Les murs sont fins, on entend tout ce que disent les voisins.",
    amenities: ["Chambre double", "Murs fins", "Un seul WC mixte pour tout le quartier"],
  },
};

// --- Maisons et chambres ---
// Les Maisons 2 et 3 s'ajouteront ici, avec des identifiants de chambre uniques (ex. « m2_penthouse »).
const MAISONS = [
  {
    id: "maison1",
    name: "Maison 1",
    rooms: [
      { id: "penthouse", name: "Penthouse", capacity: 2, quartier: "haussmann" },
      { id: "suite", name: "Suite", capacity: 2, quartier: "marais" },
      { id: "double1", name: "Chambre double 1", capacity: 2, quartier: "montmartre" },
      { id: "double2", name: "Chambre double 2", capacity: 2, quartier: "belleville" },
      { id: "double3", name: "Chambre double 3", capacity: 2, quartier: "belleville" },
    ],
  },
  {
    id: "maison2",
    name: "Maison 2",
    onlyRole: ENTREPRENEUR_ROLE_ID,
    rooms: [
      { id: "m2_penthouse1", name: "Penthouse 1", capacity: 2, quartier: "haussmann" },
      { id: "m2_penthouse2", name: "Penthouse 2", capacity: 2, quartier: "haussmann" },
      { id: "m2_penthouse3", name: "Penthouse 3", capacity: 2, quartier: "haussmann" },
      { id: "m2_suite1", name: "Suite 1", capacity: 2, quartier: "marais" },
      { id: "m2_suite2", name: "Suite 2", capacity: 2, quartier: "marais" },
      { id: "m2_double1", name: "Chambre double 1", capacity: 2, quartier: "montmartre" },
      { id: "m2_double2", name: "Chambre double 2", capacity: 2, quartier: "belleville" },
    ],
  },
];

const ROOMS = MAISONS.flatMap((m) => m.rooms.map((r) => ({ ...r, maison: m.id })));

function loadState() {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    data = { messageId: null };
  }
  data.rooms ??= {};
  data.moves ??= {}; // demandes de déménagement en cours : userId -> { roomId, channelId }
  for (const room of ROOMS) {
    if (!Array.isArray(data.rooms[room.id])) data.rooms[room.id] = [];
  }
  return data;
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getRoom(roomId) {
  return ROOMS.find((r) => r.id === roomId);
}

function maisonOf(room) {
  return MAISONS.find((m) => m.id === room.maison);
}

// « Maison 2, Chambre double 1 » : plusieurs maisons ont des chambres du même nom.
function roomLabel(room) {
  return MAISONS.length > 1 ? `${maisonOf(room).name}, ${room.name}` : room.name;
}

function removeMemberFromAllRooms(state, userId) {
  for (const room of ROOMS) {
    state.rooms[room.id] = (state.rooms[room.id] || []).filter((id) => id !== userId);
  }
}

// Chambre et quartier d'un membre (null s'il n'a pas de chambre).
function getResidence(userId) {
  const state = loadState();
  const room = ROOMS.find((r) => state.rooms[r.id]?.includes(userId));
  if (!room) return null;
  return { room, quartier: QUARTIERS[room.quartier], maison: maisonOf(room), roommates: state.rooms[room.id].filter((id) => id !== userId) };
}

function freePlaces(state, room) {
  return room.capacity - (state.rooms[room.id]?.length || 0);
}

function canManageChambres(member) {
  return member?.roles.cache.has(CHAMBRE_STAFF_ROLE_ID) || isGerant(member);
}

function denyMessage() {
  return "❌ Seule la Fondation peut gérer les chambres.";
}

function stars(n) {
  return "⭐".repeat(n);
}

function formatOccupants(guild, userIds) {
  if (!userIds?.length) return "*Libre*";
  return userIds.map((id) => guild.members.cache.get(id)?.toString() ?? `<@${id}>`).join(", ");
}

// --- Tableau ---

function buildMaisonEmbed(guild, maison, state) {
  const total = maison.rooms.reduce((n, r) => n + r.capacity, 0);
  const occupied = maison.rooms.reduce((n, r) => n + (state.rooms[r.id]?.length || 0), 0);
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(`🏡 ${maison.name} — ${occupied}/${total} places occupées`);

  const quartierIds = [...new Set(maison.rooms.map((r) => r.quartier))].sort(
    (a, b) => QUARTIERS[b].stars - QUARTIERS[a].stars
  );
  for (const qid of quartierIds) {
    const q = QUARTIERS[qid];
    const rooms = maison.rooms
      .filter((r) => r.quartier === qid)
      .map((r) => `🛏️ **${r.name}** — ${formatOccupants(guild, state.rooms[r.id])}`)
      .join("\n");
    embed.addFields({
      name: `${q.emoji} ${q.name} ${stars(q.stars)} · ${formatEuro(q.tax)}/sem.`,
      value: `*${q.description}*\n${q.amenities.map((a) => `· ${a}`).join("  ")}\n${rooms}`.slice(0, 1024),
    });
  }
  return embed;
}

function buildPanelMessage(guild) {
  const state = loadState();
  const header = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "La Maison est divisée en **quartiers**, du plus prestigieux au plus modeste. On circule où on veut : c'est **là où l'on dort** qui définit son quartier.\n\n" +
        "🏠 **Où je dors ?** — votre chambre, votre quartier et vos colocataires\n" +
        "📦 **Demander un déménagement** — ouvre un ticket avec la Fondation (frais selon la destination)\n" +
        "🛠️ **Ajout / Retrait** — réservé à la Fondation"
    )
    .setFooter({ text: "La taxe d'habitation dépend du quartier (prélevée chaque dimanche)" });
  return {
    embeds: [header, ...MAISONS.map((m) => buildMaisonEmbed(guild, m, state))],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("chambre_ou").setLabel("Où je dors ?").setEmoji("🏠").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("chambre_demande").setLabel("Demander un déménagement").setEmoji("📦").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(CHAMBRE_AJOUT_BUTTON_ID).setLabel("Ajout / Déménager").setEmoji("➕").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(CHAMBRE_RETRAIT_BUTTON_ID).setLabel("Retrait").setEmoji("➖").setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}

// Un membre peut-il habiter cette chambre ? (Maison 2 : Entrepreneurs uniquement)
function allowedIn(member, room) {
  const role = maisonOf(room).onlyRole;
  return !role || Boolean(member?.roles.cache.has(role));
}

function roomOptions(state, { onlyFree = false, exclude = null, withFee = false, member = null } = {}) {
  return ROOMS.filter((r) => r.id !== exclude && (!onlyFree || freePlaces(state, r) > 0) && (!member || allowedIn(member, r)))
    .slice(0, 25)
    .map((room) => {
      const q = QUARTIERS[room.quartier];
      const libre = freePlaces(state, room);
      return {
        label: `${room.name} — ${q.name}`.slice(0, 100),
        value: room.id,
        description: `${libre > 0 ? `${libre} place(s) libre(s)` : "Complet"} · ${withFee ? `frais ${q.moveFee} €` : `${q.tax} €/sem.`}${MAISONS.length > 1 ? ` · ${maisonOf(room).name}` : ""}`.slice(0, 100),
        emoji: q.emoji,
      };
    });
}

async function updateChambresPanel(guild, client) {
  const channel = await client.channels.fetch(CHAMBRES_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  await guild.members.fetch().catch(() => null);

  const state = loadState();
  const payload = buildPanelMessage(guild);
  let msg = state.messageId ? await channel.messages.fetch(state.messageId).catch(() => null) : null;
  if (!msg) {
    const messages = await channel.messages.fetch({ limit: 15 }).catch(() => null);
    msg = messages?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (msg) {
    await msg.edit(payload);
  } else {
    msg = await channel.send(payload);
  }
  if (state.messageId !== msg.id) {
    state.messageId = msg.id;
    saveState(state);
  }
}

async function setupChambresPanel(client) {
  for (const guild of client.guilds.cache.values()) {
    await updateChambresPanel(guild, client);
  }
  console.log("Tableau des chambres prêt");
}

// Annonce publique d'un emménagement ou d'un déménagement.
async function announceMove(client, userId, fromRoom, toRoom) {
  const channel = await client.channels.fetch(CHAMBRES_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const to = QUARTIERS[toRoom.quartier];
  let text;
  if (!fromRoom) {
    text = `🔑 <@${userId}> emménage à **${to.emoji} ${to.name}** (${roomLabel(toRoom)}).`;
  } else {
    const from = QUARTIERS[fromRoom.quartier];
    const arrow = to.stars > from.stars ? "⬆️" : to.stars < from.stars ? "⬇️" : "📦";
    text = `${arrow} <@${userId}> quitte **${from.emoji} ${from.name}** (${roomLabel(fromRoom)}) pour **${to.emoji} ${to.name}** (${roomLabel(toRoom)}).`;
  }
  const message = await channel.send({ content: text, allowedMentions: { users: [] } }).catch(() => null);
  deleteLater(message, MINUTE);
}

// --- Demande de déménagement (ticket payant) ---

async function startMoveRequest(interaction) {
  const state = loadState();
  // Ticket supprimé à la main : la demande n'existe plus
  const pending = state.moves[interaction.user.id];
  if (pending && !(await interaction.guild.channels.fetch(pending.channelId).catch(() => null))) {
    delete state.moves[interaction.user.id];
    saveState(state);
  }
  if (state.moves[interaction.user.id]) {
    await interaction.reply({ content: `📦 Vous avez déjà une demande en cours : <#${state.moves[interaction.user.id].channelId}>`, ephemeral: true });
    return;
  }
  const current = getResidence(interaction.user.id);
  const options = roomOptions(state, { onlyFree: true, exclude: current?.room.id, withFee: true, member: interaction.member });
  if (!options.length) {
    await interaction.reply({ content: "😕 Aucune place libre pour le moment.", ephemeral: true });
    return;
  }
  await interaction.reply({
    content: "📦 Où voulez-vous emménager ? Les frais dépendent du quartier de destination et ne sont prélevés que si la Fondation accepte.",
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId("chambre_demande_choix").setPlaceholder("Choisir une chambre libre").addOptions(options)
      ),
    ],
  });
}

async function openMoveTicket(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;
  const room = getRoom(interaction.values[0]);
  const state = loadState();
  if (room && !allowedIn(member, room)) {
    await interaction.update({ content: "❌ La Maison 2 est réservée aux Entrepreneurs.", components: [] });
    return;
  }
  if (!room || freePlaces(state, room) <= 0) {
    await interaction.update({ content: "❌ Cette chambre n'est plus disponible.", components: [] });
    return;
  }
  if (state.moves[member.id]) {
    await interaction.update({ content: "📦 Vous avez déjà une demande en cours.", components: [] });
    return;
  }
  const q = QUARTIERS[room.quartier];
  if (readBalance(member.id) < q.moveFee) {
    await interaction.update({ content: `❌ Les frais pour ${q.name} sont de **${formatEuro(q.moveFee)}** : vous avez ${formatEuro(readBalance(member.id))}.`, components: [] });
    return;
  }
  await interaction.update({ content: "⏳ Ouverture du ticket…", components: [] });

  const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.id, allow },
    { id: guild.members.me.id, allow: [...allow, PermissionFlagsBits.ManageChannels] },
  ];
  for (const roleId of [CHAMBRE_STAFF_ROLE_ID, GERANTS_ROLE_ID]) {
    if (guild.roles.cache.has(roleId)) overwrites.push({ id: roleId, allow });
  }
  const slug = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, "") || "membre";
  const ticket = await guild.channels
    .create({ name: `demenagement-${slug}`.slice(0, 100), type: ChannelType.GuildText, parent: TICKET_CATEGORY_ID, topic: `demenagement:${member.id}`, permissionOverwrites: overwrites })
    .catch((err) => {
      console.error("Ticket déménagement:", err.message);
      return null;
    });
  if (!ticket) {
    await interaction.editReply("❌ Impossible d'ouvrir le ticket. Contactez la Fondation.");
    return;
  }

  const fresh = loadState();
  fresh.moves[member.id] = { roomId: room.id, channelId: ticket.id };
  saveState(fresh);

  const current = getResidence(member.id);
  await ticket.send({
    content: `${member} <@&${CHAMBRE_STAFF_ROLE_ID}>`,
    allowedMentions: { users: [member.id], roles: [CHAMBRE_STAFF_ROLE_ID] },
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle("📦 Demande de déménagement")
        .addFields(
          { name: "Membre", value: `${member}` },
          { name: "Actuellement", value: current ? `${current.quartier.emoji} ${current.quartier.name} — ${roomLabel(current.room)}` : "Sans chambre", inline: true },
          { name: "Souhaite aller", value: `${q.emoji} ${q.name} — ${roomLabel(room)}`, inline: true },
          { name: "Frais", value: `${formatEuro(q.moveFee)} (solde : ${formatEuro(readBalance(member.id))})` }
        )
        .setFooter({ text: "Décision réservée à la Fondation et aux gérants" })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`chambre_move_ok_${member.id}`).setLabel("Accepter").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`chambre_move_no_${member.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`chambre_move_cancel_${member.id}`).setLabel("Annuler ma demande").setStyle(ButtonStyle.Secondary)
      ),
    ],
  });
  await interaction.editReply(`📦 Votre demande est ouverte : ${ticket}`);
}

async function answerMove(interaction, decision, userId) {
  const state = loadState();
  const request = state.moves[userId];
  if (!request) {
    await interaction.update({ components: [] });
    return;
  }
  const isOwner = interaction.user.id === userId;
  if (decision === "cancel" ? !isOwner : !canManageChambres(interaction.member)) {
    await interaction.reply({ content: decision === "cancel" ? "❌ Seul le demandeur peut annuler." : denyMessage(), ephemeral: true });
    return;
  }

  const room = getRoom(request.roomId);
  const q = room && QUARTIERS[room.quartier];
  let result;
  if (decision === "ok") {
    if (!room || freePlaces(state, room) <= 0) {
      await interaction.reply({ content: "❌ La chambre n'a plus de place libre.", ephemeral: true });
      return;
    }
    if (changeBalance(userId, -q.moveFee, `Déménagement vers ${q.name} (${roomLabel(room)})`) === null) {
      await interaction.reply({ content: `❌ Le membre n'a plus assez d'argent (${formatEuro(q.moveFee)} nécessaires) ou son compte est gelé.`, ephemeral: true });
      return;
    }
    addToTreasury("demenagements", q.moveFee);
    const from = getResidence(userId)?.room ?? null;
    removeMemberFromAllRooms(state, userId);
    state.rooms[room.id].push(userId);
    result = `✅ Déménagement **accepté** par ${interaction.user} : bienvenue à ${q.emoji} **${q.name}** (${roomLabel(room)}) ! ${formatEuro(q.moveFee)} prélevés.`;
    delete state.moves[userId];
    saveState(state);
    await announceMove(interaction.client, userId, from, room);
    await updateChambresPanel(interaction.guild, interaction.client);
  } else {
    delete state.moves[userId];
    saveState(state);
    result = decision === "cancel" ? "↩️ Demande annulée par le membre." : `❌ Déménagement **refusé** par ${interaction.user}.`;
  }

  await interaction.update({ components: [] });
  await interaction.channel.send(`${result}\n*Ce ticket sera fermé dans 1 minute.*`).catch(() => null);
  const channel = interaction.channel;
  setTimeout(() => channel.delete("Demande de déménagement traitée").catch(() => null), 60 * 1000);
}

async function showResidence(interaction) {
  const r = getResidence(interaction.user.id);
  if (!r) {
    await interaction.reply({ content: "🏠 Vous n'avez pas encore de chambre. Faites une demande de déménagement !", ephemeral: true });
    return;
  }
  await interaction.reply({
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`${r.quartier.emoji} ${r.quartier.name} ${stars(r.quartier.stars)}`)
        .setDescription(
          `Vous dormez dans **${r.room.name}** (${r.maison.name}).\n\n*${r.quartier.description}*\n\n` +
            `**Autour de vous :**\n${r.quartier.amenities.map((a) => `· ${a}`).join("\n")}\n\n` +
            `👥 Colocataire(s) : ${r.roommates.length ? r.roommates.map((id) => `<@${id}>`).join(", ") : "aucun"}\n` +
            `🧾 Taxe d'habitation : **${formatEuro(r.quartier.tax)}**/semaine`
        ),
    ],
  });
}

// --- Interactions ---

async function handleChambreInteraction(interaction) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("chambre_")) return false;

  // Ouvert à tous
  if (id === "chambre_ou") {
    await showResidence(interaction);
    return true;
  }
  if (id === "chambre_demande") {
    await startMoveRequest(interaction);
    return true;
  }
  if (id === "chambre_demande_choix") {
    await openMoveTicket(interaction);
    return true;
  }
  if (id.startsWith("chambre_move_")) {
    const [, , decision, userId] = id.split("_");
    await answerMove(interaction, decision, userId);
    return true;
  }

  // Fondation
  if (!canManageChambres(interaction.member)) {
    await interaction.reply({ content: denyMessage(), ephemeral: true });
    return true;
  }

  if (id === CHAMBRE_AJOUT_BUTTON_ID) {
    await interaction.reply({
      content: "🏠 Choisissez la chambre, puis le membre à y installer (s'il habite ailleurs, il déménage).",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId(CHAMBRE_SELECT_ROOM_ID).setPlaceholder("Choisir une chambre").addOptions(roomOptions(loadState()))
        ),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (id === CHAMBRE_RETRAIT_BUTTON_ID) {
    const state = loadState();
    const occupied = ROOMS.filter((r) => state.rooms[r.id].length > 0);
    if (!occupied.length) {
      await interaction.reply({ content: "ℹ️ Aucun membre n'est assigné à une chambre pour le moment.", ephemeral: true });
      return true;
    }
    await interaction.reply({
      content: "🏠 Choisissez la chambre, puis le membre à retirer.",
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(CHAMBRE_SELECT_REMOVE_ROOM_ID)
            .setPlaceholder("Choisir une chambre")
            .addOptions(occupied.slice(0, 25).map((r) => ({ label: r.name, value: r.id, description: `${state.rooms[r.id].length} occupant(s) · ${QUARTIERS[r.quartier].name}` })))
        ),
      ],
      ephemeral: true,
    });
    return true;
  }

  if (id === CHAMBRE_SELECT_ROOM_ID) {
    const room = getRoom(interaction.values[0]);
    if (!room) {
      await interaction.update({ content: "❌ Chambre invalide.", components: [] });
      return true;
    }
    await interaction.update({
      content: `**${room.name}** (${QUARTIERS[room.quartier].name}) — choisissez le membre :`,
      components: [
        new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId(`${CHAMBRE_SELECT_USER_PREFIX}${room.id}`).setPlaceholder("Choisir un membre Discord").setMinValues(1).setMaxValues(1)
        ),
      ],
    });
    return true;
  }

  if (id === CHAMBRE_SELECT_REMOVE_ROOM_ID) {
    const room = getRoom(interaction.values[0]);
    if (!room) {
      await interaction.update({ content: "❌ Chambre invalide.", components: [] });
      return true;
    }
    await interaction.guild.members.fetch().catch(() => null);
    const ids = loadState().rooms[room.id];
    await interaction.update({
      content: `**${room.name}** — membre à retirer :`,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`${CHAMBRE_REMOVE_USER_PREFIX}${room.id}`)
            .setPlaceholder("Membre à retirer")
            .addOptions(
              ids.map((uid) => {
                const m = interaction.guild.members.cache.get(uid);
                return { label: (m?.displayName ?? `Utilisateur ${uid.slice(-4)}`).slice(0, 100), value: uid };
              })
            )
        ),
      ],
    });
    return true;
  }

  if (id.startsWith(CHAMBRE_SELECT_USER_PREFIX)) {
    const room = getRoom(id.slice(CHAMBRE_SELECT_USER_PREFIX.length));
    const targetId = interaction.users.first()?.id;
    if (!room || !targetId) {
      await interaction.update({ content: "❌ Sélection invalide.", components: [] });
      return true;
    }
    const state = loadState();
    const occupants = state.rooms[room.id];
    if (occupants.includes(targetId)) {
      await interaction.update({ content: `ℹ️ Ce membre est déjà dans **${room.name}**.`, components: [] });
      return true;
    }
    const targetMember = await interaction.guild.members.fetch(targetId).catch(() => null);
    if (!allowedIn(targetMember, room)) {
      await interaction.update({ content: `❌ ${maisonOf(room).name} est réservée aux Entrepreneurs : <@${targetId}> n'a pas ce rôle.`, components: [] });
      return true;
    }
    if (occupants.length >= room.capacity) {
      await interaction.update({ content: `❌ **${room.name}** est complète. Retirez quelqu'un d'abord.`, components: [] });
      return true;
    }
    const from = getResidence(targetId)?.room ?? null;
    removeMemberFromAllRooms(state, targetId);
    state.rooms[room.id].push(targetId);
    saveState(state);

    await announceMove(interaction.client, targetId, from, room);
    await updateChambresPanel(interaction.guild, interaction.client);
    await interaction.update({
      content: `✅ <@${targetId}> est maintenant dans **${room.name}** (${QUARTIERS[room.quartier].name}).`,
      components: [],
    });
    return true;
  }

  if (id.startsWith(CHAMBRE_REMOVE_USER_PREFIX)) {
    const room = getRoom(id.slice(CHAMBRE_REMOVE_USER_PREFIX.length));
    const targetId = interaction.values[0];
    const state = loadState();
    if (!room || !state.rooms[room.id].includes(targetId)) {
      await interaction.update({ content: "❌ Sélection invalide.", components: [] });
      return true;
    }
    state.rooms[room.id] = state.rooms[room.id].filter((uid) => uid !== targetId);
    saveState(state);
    await updateChambresPanel(interaction.guild, interaction.client);
    await interaction.update({ content: `✅ <@${targetId}> a été retiré(e) de **${room.name}**.`, components: [] });
    return true;
  }

  return false;
}

module.exports = {
  CHAMBRES_CHANNEL_ID,
  QUARTIERS,
  MAISONS,
  setupChambresPanel,
  updateChambresPanel,
  handleChambreInteraction,
  getResidence,
};
