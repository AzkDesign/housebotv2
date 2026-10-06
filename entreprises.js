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
  StringSelectMenuBuilder,
  UserSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const {
  changeBalance,
  readBalance,
  addToTreasury,
  isFrozen,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
} = require("./economie");
const { ENTREPRENEUR_ROLE_ID, LICENCE_ROLE_ID, IRF_ROLE_ID } = require("./casino");
const { randomPerson } = require("./airbnb");
// Taux réglés par le maire : impôt sur les sociétés, dividendes, salaire minimum, frais…
const { P, sectorBoost, lawActive } = require("./politique");
const { findOrCreateChannel } = require("./salons");
const { deleteLater, deleteInteractionMessageLater, sendDossier, MINUTE } = require("./nettoyage");

const IRF_CHANNEL_ID = "1527524719094534185";

const START_CAPITAL = 5000;
const UNPAID_WEEKS_BEFORE_BANKRUPTCY = 2;
const CLIENT_TIMEOUT_MS = 20 * 60 * 1000;
const SHIFT_MAX_MS = 6 * 60 * 60 * 1000; // service terminé automatiquement après 6 h
const TRANSACTIONS_KEPT = 50;
// Mode automatique : le bot répond aux clients à la place de l'employé
const AUTO_SHIFT_MS = 8 * 60 * 60 * 1000; // à relancer toutes les 8 h
const AUTO_SHARE = 0.7; // un client servi en automatique rapporte 70 % du prix
const feed = () => require("./feed");
const { pseudo } = require("./noms");

const REGISTRY_TITLE = "📜 Registre du commerce";
const POSTES = { patron: "👑 Patron", manager: "🧭 Manager", employe: "👷 Employé" };

// --- Secteurs et clients fictifs ---

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
function randBetween(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

const PLACES = ["l'aéroport", "la gare", "l'hôtel Royal", "le centre-ville", "le stade", "la plage", "l'hôpital", "le quartier des affaires", "la salle de concert", "le port"];
const CARS = ["Clio", "Golf", "Classe A", "Model 3", "C3", "Série 1", "Yaris", "Range Rover", "Twingo", "Audi A4"];

// Chaque demande : poids (fréquence), fourchette de prix et texte.
const SECTORS = {
  transport: {
    label: "🚕 Transport / VTC",
    hours: [6, 23],
    jobs: [
      { w: 6, price: [15, 45], text: (p) => { const [a, b] = [...PLACES].sort(() => Math.random() - 0.5); return `${p} a besoin d'une course : ${a} → ${b}`; } },
      { w: 3, price: [40, 90], text: (p) => `${p} vient d'atterrir et veut aller de l'aéroport à son hôtel` },
      { w: 1, price: [150, 400], text: (p) => `${p} réserve un chauffeur privé pour toute la soirée` },
    ],
  },
  restauration: {
    label: "🍽️ Restauration",
    hours: [11, 23],
    jobs: [
      { w: 6, price: [40, 180], text: (p) => `${p} réserve une table pour ${randBetween(2, 6)} personnes` },
      { w: 3, price: [25, 80], text: (p) => `${p} commande une livraison à domicile` },
      { w: 1, price: [600, 2500], text: (p) => `${p} veut un traiteur pour une fête de ${randBetween(20, 60)} invités` },
    ],
  },
  garage: {
    label: "🔧 Garage",
    hours: [8, 19],
    jobs: [
      { w: 5, price: [80, 160], text: (p) => `${p} amène sa ${pick(CARS)} pour une vidange et une révision` },
      { w: 3, price: [200, 500], text: (p) => `${p} doit changer les pneus de sa ${pick(CARS)}` },
      { w: 2, price: [400, 1500], text: (p) => `${p} a eu un accrochage : carrosserie à refaire sur sa ${pick(CARS)}` },
      { w: 1, price: [700, 1400], text: (p) => `${p} a l'embrayage de sa ${pick(CARS)} qui a lâché` },
    ],
  },
  beaute: {
    label: "💆 Beauté / Spa",
    hours: [9, 20],
    jobs: [
      { w: 5, price: [30, 70], text: (p) => `${p} prend rendez-vous pour une coupe et un brushing` },
      { w: 4, price: [60, 150], text: (p) => `${p} réserve un massage relaxant` },
      { w: 3, price: [30, 60], text: (p) => `${p} veut une manucure` },
      { w: 1, price: [150, 400], text: (p) => `${p} réserve une mise en beauté pour son mariage` },
    ],
  },
  evenementiel: {
    label: "🎉 Événementiel",
    hours: [10, 22],
    jobs: [
      { w: 5, price: [500, 2000], text: (p) => `${p} veut organiser une soirée d'anniversaire` },
      { w: 3, price: [1500, 5000], text: (p) => `${p} organise un séminaire d'entreprise` },
      { w: 1, price: [4000, 12000], text: (p) => `${p} prépare son mariage et cherche un organisateur` },
    ],
  },
  securite: {
    label: "🛡️ Sécurité",
    hours: [8, 23],
    jobs: [
      { w: 5, price: [300, 800], text: (p) => `${p} a besoin d'un garde du corps pour une soirée` },
      { w: 3, price: [500, 1500], text: (p) => `${p} veut faire surveiller son chantier cette semaine` },
      { w: 1, price: [1500, 4000], text: (p) => `${p} cherche une équipe de sécurité pour un concert` },
    ],
  },
  media: {
    label: "📸 Média / Communication",
    hours: [8, 20],
    jobs: [
      { w: 5, price: [150, 600], text: (p) => `${p} veut un shooting photo professionnel` },
      { w: 3, price: [400, 1200], text: (p) => `${p} cherche quelqu'un pour gérer ses réseaux sociaux ce mois-ci` },
      { w: 1, price: [800, 3000], text: (p) => `${p} veut tourner un clip vidéo` },
    ],
  },
  immobilier: {
    label: "🏢 Immobilier",
    hours: [9, 19],
    jobs: [
      { w: 5, price: [150, 300], text: (p) => `${p} demande l'estimation de son appartement` },
      { w: 3, price: [400, 900], text: (p) => `${p} vous confie la gestion locative de son bien` },
      { w: 1, price: [2000, 8000], text: (p) => `${p} vous confie la vente de sa maison (commission)` },
    ],
  },
  commerce: {
    label: "🛍️ Commerce / Boutique",
    hours: [9, 20],
    jobs: [
      { w: 6, price: [20, 150], text: (p) => `${p} passe en boutique et fait quelques achats` },
      { w: 2, price: [150, 600], text: (p) => `${p} commande un cadeau haut de gamme` },
      { w: 1, price: [800, 2500], text: (p) => `${p} passe une grosse commande pour son entreprise` },
    ],
  },
};

// Message de confirmation réaliste envoyé en mode automatique, selon le secteur
function autoConfirmation(sector) {
  const h = randBetween(9, 19);
  const m = pick(["00", "15", "30", "45"]);
  const lines = {
    transport: [`🚕 Course confirmée : le chauffeur arrive dans ${randBetween(3, 12)} minutes.`, "🚕 Réservation enregistrée, véhicule en route."],
    restauration: [`🍽️ Table réservée ce soir à ${randBetween(19, 22)}h${m}.`, "🍽️ Commande confirmée, préparation en cuisine."],
    garage: [`🔧 Rendez-vous atelier confirmé demain à ${h}h${m}.`, "🔧 Véhicule pris en charge, devis accepté."],
    beaute: [`💆 Rendez-vous confirmé demain à ${h}h${m}.`, "💆 Réservation confirmée, la cabine est prête."],
    evenementiel: ["🎉 Devis accepté : l'organisation commence !", "🎉 Contrat signé, la date est bloquée."],
    securite: ["🛡️ Mission confirmée, l'équipe est assignée.", "🛡️ Contrat de surveillance signé."],
    media: [`📸 Séance confirmée samedi à ${h}h${m}.`, "📸 Projet accepté, le tournage est planifié."],
    immobilier: ["🏢 Mandat signé, première visite planifiée.", `🏢 Rendez-vous d'estimation confirmé jeudi à ${h}h.`],
    commerce: ["🛍️ Commande payée et préparée.", "🛍️ Achat validé, paquet prêt à emporter."],
  };
  return pick(lines[sector] ?? ["✅ Demande confirmée."]);
}

// Horaires d'un secteur (+2 h le soir avec la loi des nocturnes)
function sectorHours(sector) {
  const [open, close] = SECTORS[sector].hours;
  return [open, lawActive("commercesTard") ? Math.min(24, close + 2) : close];
}

function describePerson() {
  const p = randomPerson();
  return `**${p.first} ${p.last}**, ${p.age} ans, de ${p.place} ${p.flag}`;
}

function generateClient(sectorId) {
  const jobs = SECTORS[sectorId].jobs;
  let r = Math.random() * jobs.reduce((s, j) => s + j.w, 0);
  let job = jobs[0];
  for (const j of jobs) {
    if ((r -= j.w) < 0) {
      job = j;
      break;
    }
  }
  return { text: job.text(describePerson()), price: randBetween(job.price[0], job.price[1]) };
}

// --- Heure de Paris ---

const parisFormat = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" });
function parisHour(ts) {
  return Number(parisFormat.formatToParts(new Date(ts)).find((p) => p.type === "hour").value);
}

// --- Données (une seule copie en mémoire) ---

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("entreprises-state.json");
let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.companies ??= {};
  state.invoices ??= {};
  state.offers ??= {};
  state.counter ??= 0;
  return state;
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function nextId(prefix) {
  load().counter += 1;
  return `${prefix}${state.counter}`;
}

function companyOf(userId) {
  return Object.values(load().companies).find(
    (c) => c.status !== "refused" && c.members[userId]
  );
}

function roleIn(company, userId) {
  return company?.members[userId]?.role ?? null;
}

function canManage(company, userId) {
  return ["patron", "manager"].includes(roleIn(company, userId));
}

function isIrf(member) {
  return member?.roles.cache.has(IRF_ROLE_ID) || isGerant(member);
}

// Mouvement sur le compte de l'entreprise ; false si le solde serait négatif.
function move(company, delta, label) {
  const after = round2(company.balance + delta);
  if (after < 0) return false;
  company.balance = after;
  company.transactions.push({ at: Date.now(), delta: round2(delta), after, label });
  if (company.transactions.length > TRANSACTIONS_KEPT) company.transactions.splice(0, company.transactions.length - TRANSACTIONS_KEPT);
  return true;
}

function ts(ms, style = "f") {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

let registryDirty = false;

// --- Salons ---

async function ensureChannels(client) {
  const s = load();
  const guild = client.guilds.cache.get(
    (await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null))?.guildId
  ) ?? client.guilds.cache.first();
  if (!guild) return null;

  const category = await findOrCreateChannel(guild, { id: s.categoryId, name: "🏛️ Entreprises", type: ChannelType.GuildCategory });
  s.categoryId = category.id;

  const readOnly = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
    { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
  ];
  for (const [key, name] of [
    ["registryChannelId", "📜・registre-du-commerce"],
    ["recruitmentChannelId", "📢・recrutement"],
    ["invoicesChannelId", "🧾・factures"],
  ]) {
    const channel = await findOrCreateChannel(guild, { id: s[key], name, parent: category.id, permissionOverwrites: readOnly });
    s[key] = channel.id;
  }
  save();
  return guild;
}

async function fetchChannel(client, id) {
  if (!id) return null;
  const channel = await client.channels.fetch(id).catch(() => null);
  return channel?.isTextBased() ? channel : null;
}

async function send(client, channelId, payload) {
  const channel = await fetchChannel(client, channelId);
  return channel ? channel.send(payload).catch(() => null) : null;
}

// --- Registre du commerce ---

function whyEmbed() {
  return new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle("❓ Pourquoi s'immatriculer au Registre ?")
    .setDescription(
      "Dans la Maison, **seules les entreprises immatriculées existent officiellement**. Passer par le Registre, c'est :\n\n" +
        "🏦 **Un compte professionnel** — l'argent de l'entreprise est séparé du vôtre et protégé.\n" +
        "🤝 **Des clients** — seules les entreprises immatriculées reçoivent des clients de leur secteur.\n" +
        "🧾 **Des factures officielles** — payables en un clic, avec une preuve en cas de litige.\n" +
        "👥 **Des employés** — contrats, recrutement public et salaires versés automatiquement chaque dimanche.\n" +
        "🛡️ **La protection de l'IRF** — en cas d'impayé, d'arnaque ou de fraude, l'IRF enquête et sanctionne.\n" +
        "🏆 **De la visibilité** — le classement des entreprises est affiché ici chaque semaine.\n\n" +
        "⚠️ **Travail au noir interdit** : vendre des services ou employer quelqu'un sans entreprise immatriculée " +
        "expose à une **amende** et au **gel du compte** par l'IRF.\n\n" +
        `💶 **Coût** : ${formatEuro(P().registrationFee)} de frais d'immatriculation + ${formatEuro(START_CAPITAL)} de capital ` +
        "(ce capital **reste à vous**, sur le compte de l'entreprise).\n" +
        "📋 **Conditions** : avoir le rôle **Entrepreneur** et la **licence**."
    );
}

function registryEmbed() {
  const companies = Object.values(load().companies)
    .filter((c) => c.status === "active" || c.status === "frozen")
    .sort((a, b) => b.weekRevenue - a.weekRevenue);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = companies.map(
    (c, i) =>
      `${medals[i] ?? `**${i + 1}.**`} **${c.name}** — ${SECTORS[c.sector].label}${c.status === "frozen" ? " 🔒" : ""}\n` +
      `└ **${pseudo(c.ownerId)}** · ${Object.keys(c.members).length} membre(s) · CA semaine **${formatEuro(c.weekRevenue)}**`
  );
  let body = "";
  for (const line of lines) {
    if (body.length + line.length > 3500) break;
    body += line + "\n";
  }
  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle(REGISTRY_TITLE)
    .setDescription(`**Entreprises immatriculées (${companies.length})** — classées par chiffre d'affaires de la semaine\n\n${body || "*Aucune entreprise pour le moment.*"}`)
    .setFooter({ text: "Classement remis à zéro chaque dimanche à 20h" })
    .setTimestamp();
}

function registryMessage() {
  return {
    embeds: [whyEmbed(), registryEmbed()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("ent_create").setLabel("Créer mon entreprise").setEmoji("🏛️").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("ent_mine").setLabel("Mon entreprise").setEmoji("💼").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("ent_resign").setLabel("Démissionner").setEmoji("🚪").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

async function refreshRegistry(client) {
  const s = load();
  const channel = await fetchChannel(client, s.registryChannelId);
  if (!channel) return;
  let message = s.registryMessageId ? await channel.messages.fetch(s.registryMessageId).catch(() => null) : null;
  if (!message) {
    const recent = await channel.messages.fetch({ limit: 25 }).catch(() => null);
    message = recent?.find((m) => m.author.id === client.user.id && m.embeds.some((e) => e.title === REGISTRY_TITLE));
  }
  if (message) await message.edit(registryMessage());
  else message = await channel.send(registryMessage());
  if (s.registryMessageId !== message.id) {
    s.registryMessageId = message.id;
    save();
  }
}

// --- Création ---

async function startCreation(interaction) {
  const member = interaction.member;
  if (!member.roles.cache.has(ENTREPRENEUR_ROLE_ID) || !member.roles.cache.has(LICENCE_ROLE_ID)) {
    await interaction.reply({
      content: "❌ Pour créer une entreprise, il faut le rôle **Entrepreneur** et la **licence** (en vente au casino).",
      ephemeral: true,
    });
    return;
  }
  if (companyOf(member.id)) {
    await interaction.reply({ content: "❌ Vous faites déjà partie d'une entreprise (une seule par personne).", ephemeral: true });
    return;
  }
  const cost = P().registrationFee + START_CAPITAL;
  if (readBalance(member.id) < cost) {
    await interaction.reply({
      content: `❌ Il faut **${formatEuro(cost)}** (${formatEuro(P().registrationFee)} de frais + ${formatEuro(START_CAPITAL)} de capital). Vous avez ${formatEuro(readBalance(member.id))}.`,
      ephemeral: true,
    });
    return;
  }
  await interaction.reply({
    content: "🏛️ Dans quel secteur ?",
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("ent_sector")
          .setPlaceholder("Choisir un secteur")
          .addOptions(Object.entries(SECTORS).map(([id, s]) => ({ label: s.label, value: id })))
      ),
    ],
  });
}

function withPlaceholder(input, placeholder) {
  return placeholder ? input.setPlaceholder(placeholder) : input;
}

function creationModal(sector) {
  const row = (id, label, style, opts = {}) =>
    new ActionRowBuilder().addComponents(
      withPlaceholder(new TextInputBuilder(), opts.placeholder)
        .setCustomId(id)
        .setLabel(label)
        .setStyle(style)
        .setRequired(opts.required ?? true)
        .setMaxLength(opts.max ?? 100)
    );
  return new ModalBuilder()
    .setCustomId(`ent_modal_create_${sector}`)
    .setTitle("🏛️ Immatriculer mon entreprise")
    .addComponents(
      row("nom", "Nom de l'entreprise", TextInputStyle.Short, { max: 50 }),
      row("description", "Activité / description", TextInputStyle.Paragraph, { max: 500 }),
      row("logo", "Logo (lien d'image, facultatif)", TextInputStyle.Short, { required: false, max: 300, placeholder: "https://…" })
    );
}

async function submitCreation(interaction, sector, client) {
  const userId = interaction.user.id;
  if (!SECTORS[sector] || companyOf(userId)) {
    await interaction.reply({ content: "❌ Demande impossible.", ephemeral: true });
    return;
  }
  const name = interaction.fields.getTextInputValue("nom").trim();
  const description = interaction.fields.getTextInputValue("description").trim();
  const logo = interaction.fields.getTextInputValue("logo").trim();
  if (Object.values(load().companies).some((c) => c.status !== "refused" && c.name.toLowerCase() === name.toLowerCase())) {
    await interaction.reply({ content: "❌ Une entreprise porte déjà ce nom.", ephemeral: true });
    return;
  }

  const fee = P().registrationFee;
  const cost = fee + START_CAPITAL;
  if (changeBalance(userId, -cost, `Immatriculation de « ${name} » (en attente)`) === null) {
    await interaction.reply({ content: `❌ Solde insuffisant ou compte gelé (il faut ${formatEuro(cost)}).`, ephemeral: true });
    return;
  }

  const id = nextId("e");
  const company = {
    id,
    name,
    sector,
    description,
    logo: /^https?:\/\//.test(logo) ? logo : null,
    ownerId: userId,
    fee,
    status: "pending",
    balance: 0,
    createdAt: Date.now(),
    members: { [userId]: { role: "patron", salary: 0, hiredAt: Date.now() } },
    onDuty: {},
    weekRevenue: 0,
    totalRevenue: 0,
    weekStats: {},
    unpaidWeeks: 0,
    transactions: [],
    nextClientAt: 0,
    request: null,
  };
  load().companies[id] = company;
  save();

  await sendDossier(client, {
    content: `<@&${IRF_ROLE_ID}>`,
    allowedMentions: { roles: [IRF_ROLE_ID] },
    embeds: [
      new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle("🏛️ Demande d'immatriculation")
        .setThumbnail(company.logo)
        .setDescription(`**${name}** — ${SECTORS[sector].label}\nPatron : **${pseudo(userId)}**\n\n${description}`)
        .addFields({ name: "Versé", value: `${formatEuro(fee)} de frais + ${formatEuro(START_CAPITAL)} de capital (remboursés en cas de refus)` })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_validate_ok_${id}`).setLabel("Immatriculer").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_validate_no_${id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger)
      ),
    ],
  });

  await interaction.reply({
    content: `📨 Demande envoyée à l'IRF. ${formatEuro(cost)} ont été mis de côté et vous seront **remboursés** en cas de refus.`,
    ephemeral: true,
  });
}

function companyChannelOverwrites(guild, company, client) {
  const allow = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
  ];
  const list = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [...allow, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.EmbedLinks] },
    ...Object.keys(company.members).map((id) => ({ id, allow })),
  ];
  if (guild.roles.cache.has(IRF_ROLE_ID)) {
    list.push({ id: IRF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
  }
  return list;
}

async function validateCreation(interaction, accepted, id, client) {
  if (!isIrf(interaction.member)) {
    await interaction.reply({ content: "❌ Réservé à l'IRF.", ephemeral: true });
    return;
  }
  const company = load().companies[id];
  if (!company || company.status !== "pending") {
    await interaction.update({ components: [] });
    return;
  }
  const fee = company.fee ?? P().registrationFee;
  const cost = fee + START_CAPITAL;

  if (!accepted) {
    company.status = "refused";
    changeBalance(company.ownerId, cost, `Immatriculation de « ${company.name} » refusée (remboursement)`, { force: true });
    delete state.companies[id];
    save();
    await interaction.update({
      embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xe74c3c).setFooter({ text: `Refusée par ${interaction.user.tag}` })],
      components: [],
    });
    deleteInteractionMessageLater(interaction, 2 * MINUTE);
    const user = await client.users.fetch(company.ownerId).catch(() => null);
    await user?.send(`❌ L'IRF a refusé l'immatriculation de **${company.name}**. Vos ${formatEuro(cost)} ont été remboursés.`).catch(() => null);
    return;
  }

  await interaction.deferUpdate();
  const guild = interaction.guild;
  const channel = await guild.channels
    .create({
      name: `🏢・${company.name}`.slice(0, 100),
      type: ChannelType.GuildText,
      parent: state.categoryId,
      topic: `entreprise:${company.id}`,
      permissionOverwrites: companyChannelOverwrites(guild, company, client),
    })
    .catch((err) => {
      console.error("Salon entreprise:", err.message);
      return null;
    });
  if (!channel) {
    await interaction.followUp({ content: "❌ Impossible de créer le salon de l'entreprise.", ephemeral: true });
    return;
  }

  company.status = "active";
  company.channelId = channel.id;
  company.validatedBy = interaction.user.id;
  move(company, START_CAPITAL, "Capital de départ");
  if (fee > 0) addToTreasury("immatriculations", fee);
  feed().post(`🏢 Nouvelle entreprise : **${company.name}** (${SECTORS[company.sector].label}) ouvre ses portes !`, { stat: "entreprises" });
  save();
  registryDirty = true;

  const panel = await channel.send(companyPanel(company));
  company.panelMessageId = panel.id;
  save();
  await channel.send({
    content: `<@${company.ownerId}>`,
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`🎉 ${company.name} est immatriculée !`)
        .setDescription(
          `Votre compte professionnel est ouvert avec **${formatEuro(START_CAPITAL)}**.\n\n` +
            "**Pour démarrer :**\n" +
            "1. 📢 Publiez une offre d'emploi ou 👥 embauchez directement\n" +
            "2. 🟢 Prenez votre service : les clients arrivent quand quelqu'un est en service\n" +
            "3. 🧾 Facturez vos prestations aux membres\n\n" +
            `⚖️ Chaque dimanche à 20h : impôt de **${Math.round(P().corporateTax * 100)} %** sur le chiffre d'affaires, puis versement des salaires.`
        ),
    ],
  });

  await interaction.editReply({
    embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x2ecc71).setFooter({ text: `Immatriculée par ${interaction.user.tag}` })],
    components: [],
  });
  deleteInteractionMessageLater(interaction, 2 * MINUTE);
}

// --- Panneau de l'entreprise ---

function companyEmbed(company) {
  const onDuty = Object.keys(company.onDuty);
  const staff = Object.entries(company.members)
    .sort((a, b) => ["patron", "manager", "employe"].indexOf(a[1].role) - ["patron", "manager", "employe"].indexOf(b[1].role))
    .map(([id, m]) => `${POSTES[m.role]} **${pseudo(id)}**${m.role !== "patron" ? ` — ${formatEuro(m.salary)}/sem.` : ""}${company.onDuty[id] ? (company.autoDuty?.[id] ? " 🤖" : " 🟢") : ""}`)
    .join("\n");
  return new EmbedBuilder()
    .setColor(company.status === "frozen" ? 0x95a5a6 : 0x8b0000)
    .setTitle(`🏢 ${company.name}`)
    .setThumbnail(company.logo)
    .setDescription(
      `${SECTORS[company.sector].label}${company.status === "frozen" ? " — 🔒 **gelée par l'IRF**" : ""}\n${company.description}\n\n` +
        `🕒 Clients entre **${sectorHours(company.sector)[0]}h et ${sectorHours(company.sector)[1]}h** quand quelqu'un est en service.`
    )
    .addFields(
      { name: "💰 Compte", value: formatEuro(company.balance), inline: true },
      { name: "📈 CA de la semaine", value: formatEuro(company.weekRevenue), inline: true },
      { name: "🟢 En service", value: String(onDuty.length), inline: true },
      { name: "👥 Équipe", value: staff.slice(0, 1024) || "—" }
    )
    .setTimestamp();
}

function companyPanel(company) {
  return {
    embeds: [companyEmbed(company)],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_duty_on_${company.id}`).setLabel("Prendre mon service").setEmoji("🟢").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_duty_auto_${company.id}`).setLabel("Service auto").setEmoji("🤖").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ent_duty_off_${company.id}`).setLabel("Finir mon service").setEmoji("🔴").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ent_invoice_${company.id}`).setLabel("Facturer").setEmoji("🧾").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ent_report_${company.id}`).setLabel("Bilan").setEmoji("📊").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_account_${company.id}`).setLabel("Compte").setEmoji("💰").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ent_staff_${company.id}`).setLabel("Employés").setEmoji("👥").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ent_offer_${company.id}`).setLabel("Offre d'emploi").setEmoji("📢").setStyle(ButtonStyle.Primary)
      ),
    ],
  };
}

const dirtyPanels = new Set();

async function refreshCompanyPanel(client, company) {
  const channel = await fetchChannel(client, company.channelId);
  if (!channel) return;
  const msg = company.panelMessageId ? await channel.messages.fetch(company.panelMessageId).catch(() => null) : null;
  if (msg) await msg.edit(companyPanel(company)).catch(() => null);
  else {
    const sent = await channel.send(companyPanel(company)).catch(() => null);
    if (sent) {
      company.panelMessageId = sent.id;
      save();
    }
  }
}

async function updateChannelAccess(client, company) {
  const channel = await client.channels.fetch(company.channelId).catch(() => null);
  if (channel) await channel.permissionOverwrites.set(companyChannelOverwrites(channel.guild, company, client)).catch(() => null);
}

// --- Service et clients ---

async function setDuty(interaction, company, on, auto = false) {
  const userId = interaction.user.id;
  if (!company.members[userId]) {
    await interaction.reply({ content: "❌ Vous ne faites pas partie de cette entreprise.", ephemeral: true });
    return;
  }
  if (on && company.status !== "active") {
    await interaction.reply({ content: "🔒 L'entreprise est gelée par l'IRF.", ephemeral: true });
    return;
  }
  company.autoDuty ??= {};
  if (on) {
    if (company.onDuty[userId] && Boolean(company.autoDuty[userId]) === auto) {
      await interaction.reply({ content: auto ? "🤖 Votre service automatique est déjà en cours." : "🟢 Vous êtes déjà en service.", ephemeral: true });
      return;
    }
    company.onDuty[userId] = Date.now();
    if (auto) company.autoDuty[userId] = Date.now() + AUTO_SHIFT_MS;
    else delete company.autoDuty[userId];
    if (!company.nextClientAt || company.nextClientAt < Date.now()) {
      company.nextClientAt = Date.now() + randBetween(5, 20) * 60 * 1000;
    }
  } else {
    if (!company.onDuty[userId]) {
      await interaction.reply({ content: "🔴 Vous n'êtes pas en service.", ephemeral: true });
      return;
    }
    delete company.onDuty[userId];
    delete company.autoDuty[userId];
  }
  save();
  dirtyPanels.add(company.id);
  const [open, close] = sectorHours(company.sector);
  if (on && auto) {
    await interaction.reply({
      content:
        `🤖 **Service automatique activé pour 8 h.** Le bot répond aux clients à votre place (entre ${open}h et ${close}h) : ` +
        `chaque client servi automatiquement rapporte **${Math.round(AUTO_SHARE * 100)} %** du prix. Revenez le relancer ensuite !`,
      ephemeral: true,
    });
    return;
  }
  await interaction.reply({
    content: on
      ? `🟢 **En service !** Les clients arrivent entre ${open}h et ${close}h. Fin automatique au bout de 6 h.`
      : "🔴 **Service terminé.** Bonne pause !",
    ephemeral: true,
  });
}

function clientGap(dutyCount) {
  // Plus il y a de monde en service, plus les clients arrivent vite.
  return (randBetween(40, 90) * 60 * 1000) / Math.sqrt(Math.max(1, dutyCount));
}

async function sendClientRequest(client, company) {
  const req = generateClient(company.sector);
  const id = nextId("q");
  const duty = Object.keys(company.onDuty);
  const msg = await send(client, company.channelId, {
    content: duty.map((u) => `<@${u}>`).join(" "),
    allowedMentions: { users: duty },
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("🔔 Nouveau client")
        .setDescription(`${req.text}.`)
        .addFields({ name: "Prix", value: `**${formatEuro(req.price)}**`, inline: true }, { name: "Répondre avant", value: ts(Date.now() + CLIENT_TIMEOUT_MS, "t"), inline: true }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_client_ok_${company.id}_${id}`).setLabel("Prendre en charge").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_client_no_${company.id}_${id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Secondary)
      ),
    ],
  });
  if (!msg) return;
  company.request = { id, ...req, at: Date.now(), messageId: msg.id, autoWait: randBetween(30, 120) * 1000 };
}

async function autoServe(client, company, userId) {
  const request = company.request;
  company.request = null;
  const earned = round2(request.price * AUTO_SHARE);
  move(company, earned, `Client (auto) : ${request.text.replace(/\*\*/g, "")}`.slice(0, 120));
  company.weekRevenue = round2(company.weekRevenue + earned);
  company.totalRevenue = round2(company.totalRevenue + earned);
  company.weekStats[userId] = (company.weekStats[userId] ?? 0) + 1;
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  const member = client.users.cache.get(userId);
  const channel = await fetchChannel(client, company.channelId);
  const msg = await channel?.messages.fetch(request.messageId).catch(() => null);
  if (msg) {
    await msg
      .edit({
        content: "",
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle("✅ Réservation confirmée")
            .setDescription(`${request.text}.\n\n${autoConfirmation(company.sector)}`)
            .setFooter({ text: `🤖 Géré automatiquement pour ${member?.username ?? "l'équipe"} — ${formatEuro(earned)} encaissés (${Math.round(AUTO_SHARE * 100)} %)` }),
        ],
        components: [],
      })
      .catch(() => null);
    deleteLater(msg, 2 * MINUTE);
  }
  feed().post(`${SECTORS[company.sector].label.split(" ")[0]} **${company.name}** : ${shortClient(request.text)} (+${formatEuro(earned)})`, { stat: "clients" });
  feed().post("", { stat: "ca", amount: earned });
}

// « Chloé Meier, 53 ans, de Genève 🇨🇭 a besoin d'une course… » → version courte pour le fil
function shortClient(text) {
  // on retire « , 56 ans, de New York, États-Unis » et on garde le drapeau
  return text.replace(/\*\*/g, "").replace(/, \d+ ans, de .*?(\p{RI}\p{RI})/u, " $1").slice(0, 140);
}

async function answerClient(interaction, company, requestId, accepted) {
  const userId = interaction.user.id;
  const request = company.request;
  if (!request || request.id !== requestId) {
    await interaction.update({ components: [] });
    return;
  }
  if (!company.members[userId]) {
    await interaction.reply({ content: "❌ Vous ne faites pas partie de cette entreprise.", ephemeral: true });
    return;
  }
  if (!company.onDuty[userId]) {
    await interaction.reply({ content: "🟢 Prenez d'abord votre service.", ephemeral: true });
    return;
  }
  company.request = null;
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);

  if (!accepted || company.status !== "active") {
    save();
    await interaction.update({ embeds: [embed.setColor(0x95a5a6).setTitle("❌ Client refusé").setFooter({ text: `Refusé par ${interaction.user.tag}` })], components: [] });
    deleteInteractionMessageLater(interaction, 2 * MINUTE);
    return;
  }

  move(company, request.price, `Client : ${request.text.replace(/\*\*/g, "")}`.slice(0, 120));
  company.weekRevenue = round2(company.weekRevenue + request.price);
  company.totalRevenue = round2(company.totalRevenue + request.price);
  company.weekStats[userId] = (company.weekStats[userId] ?? 0) + 1;
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  await interaction.update({
    embeds: [embed.setColor(0x2ecc71).setTitle("✅ Client servi").setFooter({ text: `Pris en charge par ${interaction.user.tag} — ${formatEuro(request.price)} encaissés` })],
    components: [],
  });
  feed().post(`${SECTORS[company.sector].label.split(" ")[0]} **${company.name}** : ${shortClient(request.text)} (+${formatEuro(request.price)})`, { stat: "clients" });
  feed().post("", { stat: "ca", amount: request.price });
  deleteInteractionMessageLater(interaction, 2 * MINUTE);
}

async function tick(client) {
  const now = Date.now();
  for (const company of Object.values(load().companies)) {
    if (company.status !== "active" && company.status !== "frozen") continue;

    // Fin de service automatique
    company.autoDuty ??= {};
    for (const [userId, since] of Object.entries(company.onDuty)) {
      const autoUntil = company.autoDuty[userId];
      const expired = autoUntil ? now > autoUntil : now - since > SHIFT_MAX_MS;
      if (expired || !company.members[userId]) {
        delete company.onDuty[userId];
        delete company.autoDuty[userId];
        dirtyPanels.add(company.id);
        save();
      }
    }

    // Mode automatique : le bot sert le client à la place d'un employé en service auto
    const autoMembers = Object.keys(company.onDuty).filter((u) => company.autoDuty[u]);
    if (company.request && autoMembers.length && company.status === "active") {
      const humans = Object.keys(company.onDuty).some((u) => !company.autoDuty[u]);
      const wait = humans ? 5 * MINUTE : company.request.autoWait ?? MINUTE;
      if (now - company.request.at >= wait) await autoServe(client, company, pick(autoMembers));
    }

    // Client sans réponse
    if (company.request && now - company.request.at > CLIENT_TIMEOUT_MS) {
      const request = company.request;
      company.request = null;
      save();
      const channel = await fetchChannel(client, company.channelId);
      const msg = await channel?.messages.fetch(request.messageId).catch(() => null);
      await msg
        ?.edit({ embeds: [EmbedBuilder.from(msg.embeds[0]).setColor(0x95a5a6).setTitle("⌛ Client parti").setFooter({ text: "Personne n'a répondu à temps" })], components: [] })
        .catch(() => null);
      deleteLater(msg, MINUTE);
    }

    // Nouveau client
    const dutyCount = Object.keys(company.onDuty).length;
    const [open, close] = sectorHours(company.sector);
    const hour = parisHour(now);
    if (
      company.status === "active" &&
      dutyCount > 0 &&
      !company.request &&
      now >= company.nextClientAt &&
      hour >= open &&
      hour < close
    ) {
      await sendClientRequest(client, company);
      // Plan de relance voté par le maire : +50 % de clients dans le secteur
      company.nextClientAt = now + clientGap(dutyCount) / (sectorBoost(company.sector) ? 1.5 : 1);
      save();
    }
  }

  for (const id of dirtyPanels) {
    dirtyPanels.delete(id);
    const company = state.companies[id];
    if (company) await refreshCompanyPanel(client, company);
  }
  if (registryDirty) {
    registryDirty = false;
    await refreshRegistry(client);
  }
}

// --- Compte ---

async function showAccount(interaction, company) {
  const isPatron = roleIn(company, interaction.user.id) === "patron";
  const list = company.transactions.slice(-10).reverse();
  const embed = new EmbedBuilder()
    .setColor(0xd4af37)
    .setTitle(`💰 Compte — ${company.name}`)
    .setDescription(
      `Solde : **${formatEuro(company.balance)}**\n` +
        `Salaires dus dimanche : **${formatEuro(weeklyPayroll(company))}**\n` +
        `Impôt estimé (${Math.round(P().corporateTax * 100)} % du CA) : **${formatEuro(round2(company.weekRevenue * P().corporateTax))}**\n\n` +
        (list.length
          ? list.map((t) => `${ts(t.at, "d")} **${t.delta >= 0 ? "+" : ""}${formatEuro(t.delta)}** — ${t.label}`).join("\n").slice(0, 3000)
          : "*Aucune opération.*")
    );
  const components = isPatron
    ? [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`ent_deposit_${company.id}`).setLabel("Déposer de mon argent").setEmoji("📥").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`ent_dividend_${company.id}`).setLabel(`Me verser un dividende (−${Math.round(P().dividendTax * 100)} %)`).setEmoji("📤").setStyle(ButtonStyle.Secondary)
        ),
      ]
    : [];
  await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

function amountModal(customId, title, label) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("montant").setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12)
      )
    );
}

function parseAmount(raw) {
  return parseInt(String(raw).replace(/[^\d]/g, ""), 10) || 0;
}

async function deposit(interaction, company, amount) {
  if (amount <= 0) return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
  if (changeBalance(interaction.user.id, -amount, `Dépôt sur le compte de « ${company.name} »`) === null) {
    return interaction.reply({ content: "❌ Solde insuffisant ou compte gelé.", ephemeral: true });
  }
  move(company, amount, `Dépôt de ${interaction.user.tag}`);
  save();
  dirtyPanels.add(company.id);
  await interaction.reply({ content: `📥 ${formatEuro(amount)} déposés. Compte de l'entreprise : **${formatEuro(company.balance)}**.`, ephemeral: true });
}

async function dividend(interaction, company, amount, client) {
  if (amount <= 0) return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
  if (company.status !== "active") return interaction.reply({ content: "🔒 L'entreprise est gelée par l'IRF.", ephemeral: true });
  if (isFrozen(interaction.user.id)) return interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF.", ephemeral: true });
  if (!move(company, -amount, `Dividende versé à ${interaction.user.tag}`)) {
    return interaction.reply({ content: `❌ Le compte de l'entreprise n'a que ${formatEuro(company.balance)}.`, ephemeral: true });
  }
  const tax = round2(amount * P().dividendTax);
  changeBalance(interaction.user.id, amount - tax, `Dividende de « ${company.name} »`);
  addToTreasury("dividendes", tax);
  save();
  dirtyPanels.add(company.id);
  await refreshRichestLeaderboard(client).catch(() => null);
  await interaction.reply({
    content: `📤 Dividende de ${formatEuro(amount)} : vous recevez **${formatEuro(amount - tax)}** (taxe de ${formatEuro(tax)}).`,
    ephemeral: true,
  });
}

// --- Employés ---

function weeklyPayroll(company) {
  return round2(Object.values(company.members).reduce((s, m) => s + (m.role === "patron" ? 0 : m.salary), 0));
}

async function showStaff(interaction, company) {
  if (!canManage(company, interaction.user.id)) {
    await interaction.reply({ content: "❌ Réservé au patron et aux managers.", ephemeral: true });
    return;
  }
  const others = Object.entries(company.members).filter(([, m]) => m.role !== "patron");
  const rows = [
    new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`ent_hire_${company.id}`).setPlaceholder("➕ Proposer un contrat à un membre")
    ),
  ];
  if (others.length) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ent_member_${company.id}`)
          .setPlaceholder("✏️ Modifier ou licencier un employé")
          .addOptions(
            others.slice(0, 25).map(([id, m]) => ({
              label: (interaction.guild.members.cache.get(id)?.displayName ?? id).slice(0, 100),
              value: id,
              description: `${POSTES[m.role].replace(/^\S+ /, "")} — ${m.salary} €/semaine`,
            }))
          )
      )
    );
  }
  await interaction.reply({
    content: `👥 **${others.length} employé(s)** — masse salariale : **${formatEuro(weeklyPayroll(company))}/semaine**`,
    components: rows,
    ephemeral: true,
  });
}

function contractModal(customId, title, current) {
  const input = (id, label, value, placeholder) => {
    const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12).setPlaceholder(placeholder);
    if (value !== undefined) t.setValue(String(value));
    return new ActionRowBuilder().addComponents(t);
  };
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      input("poste", "Poste (employe ou manager)", current?.role, "employe"),
      input("salaire", `Salaire par semaine (min. ${P().minSalary} €)`, current?.salary, String(P().minSalary))
    );
}

function readContract(interaction) {
  const poste = interaction.fields.getTextInputValue("poste").toLowerCase().includes("manag") ? "manager" : "employe";
  const salary = parseAmount(interaction.fields.getTextInputValue("salaire"));
  if (salary < P().minSalary) return { error: `❌ Le salaire minimum est de ${formatEuro(P().minSalary)} par semaine.` };
  return { role: poste, salary };
}

async function proposeContract(interaction, company, targetId, contract, client, fromOffer = false, jobOfferId = null) {
  const target = await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!target || target.user.bot) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
  if (companyOf(targetId)) return interaction.reply({ content: `❌ ${target} fait déjà partie d'une entreprise.`, ephemeral: true });

  const id = nextId("k");
  state.offers[id] = { id, type: "contract", companyId: company.id, userId: targetId, ...contract, by: interaction.user.id, jobOfferId };
  save();
  const dm = await target.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`✍️ Proposition de contrat — ${company.name}`)
        .setThumbnail(company.logo)
        .setDescription(`**${company.name}** (${SECTORS[company.sector].label}) vous propose un poste.`)
        .addFields(
          { name: "Poste", value: POSTES[contract.role], inline: true },
          { name: "Salaire", value: `${formatEuro(contract.salary)} / semaine`, inline: true }
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_contract_ok_${id}`).setLabel("Signer").setEmoji("✍️").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_contract_no_${id}`).setLabel("Décliner").setStyle(ButtonStyle.Secondary)
      ),
    ],
  }).catch(() => null);
  if (!dm) {
    delete state.offers[id];
    save();
    const content = `❌ Impossible d'envoyer le contrat à ${target} : ses messages privés sont fermés. Demandez-lui de les ouvrir, puis réessayez.`;
    if (fromOffer) return interaction.update({ content, embeds: [], components: [] });
    return interaction.reply({ content, ephemeral: true });
  }
  const content = `✍️ Contrat envoyé en message privé à ${target}.`;
  if (fromOffer) deleteInteractionMessageLater(interaction, 2 * MINUTE);
  if (fromOffer) await interaction.update({ content, embeds: [], components: [] });
  else await interaction.reply({ content, ephemeral: true });
}

async function answerContract(interaction, id, accepted, client) {
  const offer = state.offers[id];
  if (!offer) return interaction.update({ components: [] });
  if (interaction.user.id !== offer.userId) return interaction.reply({ content: "❌ Ce contrat ne vous est pas adressé.", ephemeral: true });
  const company = state.companies[offer.companyId];
  delete state.offers[id];

  const embed = EmbedBuilder.from(interaction.message.embeds[0]);
  if (!accepted || !company || company.status === "bankrupt") {
    save();
    return interaction.update({ embeds: [embed.setColor(0x95a5a6).setFooter({ text: "Contrat décliné" })], components: [] });
  }
  if (companyOf(offer.userId)) {
    save();
    return interaction.update({ embeds: [embed.setColor(0x95a5a6).setFooter({ text: "Déjà salarié(e) ailleurs" })], components: [] });
  }

  company.members[offer.userId] = { role: offer.role, salary: offer.salary, hiredAt: Date.now() };
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  await updateChannelAccess(client, company);
  await interaction.update({ embeds: [embed.setColor(0x2ecc71).setFooter({ text: "Contrat signé ✍️" })], components: [] });
  if (offer.jobOfferId) await fillJobOffer(client, offer.jobOfferId);
  await send(client, company.channelId, { content: `🎉 Bienvenue à <@${offer.userId}>, nouveau ${POSTES[offer.role]} de **${company.name}** !` });
}

async function showMemberActions(interaction, company, userId) {
  const m = company.members[userId];
  if (!m) return interaction.reply({ content: "❌ Employé introuvable.", ephemeral: true });
  await interaction.reply({
    content: `<@${userId}> — ${POSTES[m.role]} — ${formatEuro(m.salary)}/semaine`,
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_edit_${company.id}_${userId}`).setLabel("Modifier le contrat").setEmoji("✏️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`ent_fire_${company.id}_${userId}`).setLabel("Licencier").setEmoji("🚪").setStyle(ButtonStyle.Danger)
      ),
    ],
  });
}

async function removeMember(client, company, userId, reason) {
  delete company.members[userId];
  delete company.onDuty[userId];
  delete company.weekStats[userId];
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  await updateChannelAccess(client, company);
  await send(client, company.channelId, { content: `🚪 **${pseudo(userId)}** ${reason}.` });
}

// --- Offres d'emploi ---

async function publishOffer(interaction, company, client) {
  const title = interaction.fields.getTextInputValue("titre").trim();
  const description = interaction.fields.getTextInputValue("description").trim();
  const contract = readContract(interaction);
  if (contract.error) return interaction.reply({ content: contract.error, ephemeral: true });

  const places = Math.min(20, Math.max(1, parseAmount(interaction.fields.getTextInputValue("places")) || 1));

  const id = nextId("o");
  const job = { id, type: "job", companyId: company.id, title, description, places, hired: 0, ...contract };
  state.offers[id] = job;
  save();
  const message = await send(client, state.recruitmentChannelId, jobOfferMessage(company, job));
  job.messageId = message?.id ?? null;
  save();
  await interaction.reply({
    content: `📢 Offre publiée dans <#${state.recruitmentChannelId}> pour **${places}** personne(s). Elle disparaîtra d'elle-même une fois complète.`,
    ephemeral: true,
  });
}

function jobOfferMessage(company, job) {
  const left = job.places ? job.places - (job.hired ?? 0) : null;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`📢 ${company.name} recrute : ${job.title}`)
        .setThumbnail(company.logo)
        .setDescription(`${SECTORS[company.sector].label}\n\n${job.description ?? ""}`)
        .addFields(
          { name: "Poste", value: POSTES[job.role], inline: true },
          { name: "Salaire", value: `${formatEuro(job.salary)} / semaine`, inline: true },
          ...(left !== null ? [{ name: "Places", value: `**${left}** restante(s) sur ${job.places}`, inline: true }] : [])
        )
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_apply_${job.id}`).setLabel("Postuler").setEmoji("🙋").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_offerclose_${job.id}`).setLabel("Retirer l'offre").setEmoji("🗑️").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

// Supprime l'offre du salon recrutement (complète ou retirée).
async function removeJobOffer(client, job) {
  delete state.offers[job.id];
  save();
  const channel = await fetchChannel(client, state.recruitmentChannelId);
  const message = job.messageId ? await channel?.messages.fetch(job.messageId).catch(() => null) : null;
  await message?.delete().catch(() => null);
}

// Un contrat issu d'une offre a été signé : une place de moins.
async function fillJobOffer(client, jobId) {
  const job = state.offers[jobId];
  if (!job || job.type !== "job" || !job.places) return;
  job.hired = (job.hired ?? 0) + 1;
  save();
  if (job.hired >= job.places) {
    await removeJobOffer(client, job);
    return;
  }
  const company = state.companies[job.companyId];
  const channel = await fetchChannel(client, state.recruitmentChannelId);
  const message = job.messageId ? await channel?.messages.fetch(job.messageId).catch(() => null) : null;
  if (company) await message?.edit(jobOfferMessage(company, job)).catch(() => null);
}

async function apply(interaction, offerId, client) {
  const offer = state.offers[offerId];
  const company = offer && state.companies[offer.companyId];
  if (!company || company.status === "bankrupt" || (offer.places && (offer.hired ?? 0) >= offer.places)) {
    return interaction.reply({ content: "❌ Cette offre n'est plus disponible.", ephemeral: true });
  }
  if (companyOf(interaction.user.id)) return interaction.reply({ content: "❌ Vous faites déjà partie d'une entreprise.", ephemeral: true });

  await send(client, company.channelId, {
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🙋 Candidature — ${offer.title}`)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .setDescription(`**${pseudo(interaction.user.id)}** postule pour **${offer.title}** (${POSTES[offer.role]}, ${formatEuro(offer.salary)}/semaine).`),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ent_applyok_${offerId}_${interaction.user.id}`).setLabel("Proposer le contrat").setEmoji("✍️").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ent_applyno_${offerId}_${interaction.user.id}`).setLabel("Refuser").setStyle(ButtonStyle.Secondary)
      ),
    ],
  });
  await interaction.reply({ content: `🙋 Candidature envoyée à **${company.name}**.`, ephemeral: true });
}

// --- Factures ---

async function createInvoice(interaction, company, targetId, client) {
  const amount = parseAmount(interaction.fields.getTextInputValue("montant"));
  const label = interaction.fields.getTextInputValue("objet").trim();
  if (amount <= 0) return interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
  if (company.status !== "active") return interaction.reply({ content: "🔒 L'entreprise est gelée par l'IRF.", ephemeral: true });
  if (targetId === interaction.user.id) return interaction.reply({ content: "❌ Vous ne pouvez pas vous facturer vous-même.", ephemeral: true });

  const id = nextId("f");
  state.invoices[id] = { id, companyId: company.id, to: targetId, amount, label, by: interaction.user.id, at: Date.now() };
  save();
  const payer = companyOf(targetId);
  const buttons = [
    new ButtonBuilder().setCustomId(`ent_pay_perso_${id}`).setLabel("Payer (mon solde)").setEmoji("💶").setStyle(ButtonStyle.Success),
  ];
  if (payer && payer.ownerId === targetId && payer.id !== company.id) {
    buttons.push(new ButtonBuilder().setCustomId(`ent_pay_pro_${id}`).setLabel(`Payer avec ${payer.name}`.slice(0, 80)).setEmoji("🏢").setStyle(ButtonStyle.Primary));
  }
  buttons.push(new ButtonBuilder().setCustomId(`ent_pay_contest_${id}`).setLabel("Contester").setEmoji("⚠️").setStyle(ButtonStyle.Danger));

  await send(client, state.invoicesChannelId, {
    content: `<@${targetId}>`,
    allowedMentions: { users: [targetId] },
    embeds: [
      new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`🧾 Facture n°${id.slice(1)} — ${company.name}`)
        .setDescription(`**Objet :** ${label}`)
        .addFields(
          { name: "Montant", value: `**${formatEuro(amount)}**`, inline: true },
          { name: "Émise par", value: `**${pseudo(interaction.user.id)}**`, inline: true },
          { name: "Destinataire", value: `**${pseudo(targetId)}**`, inline: true }
        )
        .setTimestamp(),
    ],
    components: [new ActionRowBuilder().addComponents(buttons)],
  });
  await interaction.reply({ content: `🧾 Facture envoyée dans <#${state.invoicesChannelId}>.`, ephemeral: true });
}

async function payInvoice(interaction, id, mode, client) {
  const invoice = state.invoices[id];
  if (!invoice) return interaction.update({ components: [] });
  if (interaction.user.id !== invoice.to) return interaction.reply({ content: "❌ Cette facture ne vous est pas adressée.", ephemeral: true });
  const company = state.companies[invoice.companyId];
  const embed = EmbedBuilder.from(interaction.message.embeds[0]);

  if (mode === "contest") {
    delete state.invoices[id];
    save();
    await interaction.update({ embeds: [embed.setColor(0xe74c3c).setFooter({ text: "⚠️ Facture contestée — l'IRF est prévenue" })], components: [] });
    deleteInteractionMessageLater(interaction, 2 * MINUTE);
    await sendDossier(client, {
      allowedMentions: { roles: [IRF_ROLE_ID] },
      content: `<@&${IRF_ROLE_ID}> ⚠️ **${pseudo(invoice.to)}** conteste la facture n°${id.slice(1)} de **${company?.name ?? "?"}** (${formatEuro(invoice.amount)} — ${invoice.label}).`,
    });
    return;
  }
  if (!company || company.status === "bankrupt") {
    delete state.invoices[id];
    save();
    deleteInteractionMessageLater(interaction, 2 * MINUTE);
    return interaction.update({ embeds: [embed.setColor(0x95a5a6).setFooter({ text: "Entreprise fermée — facture annulée" })], components: [] });
  }

  if (mode === "pro") {
    const payer = companyOf(invoice.to);
    if (!payer || payer.ownerId !== invoice.to || payer.status !== "active") {
      return interaction.reply({ content: "❌ Paiement professionnel impossible.", ephemeral: true });
    }
    if (!move(payer, -invoice.amount, `Facture n°${id.slice(1)} de ${company.name}`)) {
      return interaction.reply({ content: `❌ Le compte de ${payer.name} n'a que ${formatEuro(payer.balance)}.`, ephemeral: true });
    }
    dirtyPanels.add(payer.id);
  } else if (changeBalance(invoice.to, -invoice.amount, `Facture n°${id.slice(1)} de « ${company.name} »`) === null) {
    return interaction.reply({ content: `❌ Solde insuffisant ou compte gelé (vous avez ${formatEuro(readBalance(invoice.to))}).`, ephemeral: true });
  }

  move(company, invoice.amount, `Facture n°${id.slice(1)} payée par ${interaction.user.tag}`);
  company.weekRevenue = round2(company.weekRevenue + invoice.amount);
  company.totalRevenue = round2(company.totalRevenue + invoice.amount);
  delete state.invoices[id];
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  await interaction.update({ embeds: [embed.setColor(0x2ecc71).setFooter({ text: `✅ Payée${mode === "pro" ? " par l'entreprise" : ""}` })], components: [] });
  deleteInteractionMessageLater(interaction, 2 * MINUTE);
  await refreshRichestLeaderboard(client).catch(() => null);
}

// --- Bilan ---

async function showReport(interaction, company) {
  const best = Object.entries(company.weekStats).sort((a, b) => b[1] - a[1])[0];
  const tax = round2(company.weekRevenue * P().corporateTax);
  const payroll = weeklyPayroll(company);
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x8b0000)
        .setTitle(`📊 Bilan — ${company.name}`)
        .addFields(
          { name: "CA de la semaine", value: formatEuro(company.weekRevenue), inline: true },
          { name: "CA total", value: formatEuro(company.totalRevenue), inline: true },
          { name: "Compte", value: formatEuro(company.balance), inline: true },
          { name: "Impôt dimanche", value: formatEuro(tax), inline: true },
          { name: "Salaires dimanche", value: formatEuro(payroll), inline: true },
          { name: "Après dimanche", value: formatEuro(round2(company.balance - tax - payroll)), inline: true },
          { name: "🏅 Meilleur employé", value: best ? `**${pseudo(best[0])}** — ${best[1]} client(s)` : "—" }
        )
        .setFooter({ text: company.unpaidWeeks ? `⚠️ ${company.unpaidWeeks} semaine(s) de salaires impayés` : "Comptes à jour" }),
    ],
    ephemeral: true,
  });
}

// --- Dimanche 20h : impôts, salaires, faillites ---

async function weeklyClose(client) {
  for (const company of Object.values(load().companies)) {
    if (company.status !== "active") continue;

    const tax = round2(company.weekRevenue * P().corporateTax);
    if (tax > 0) {
      const paid = Math.min(tax, company.balance);
      move(company, -paid, `Impôt sur les sociétés (${Math.round(P().corporateTax * 100)} %)`);
      addToTreasury("impotsSocietes", paid);
    }

    const payroll = weeklyPayroll(company);
    let salaryText;
    if (payroll > company.balance) {
      company.unpaidWeeks += 1;
      salaryText = `❌ **Salaires impayés** (${formatEuro(payroll)} dus, ${formatEuro(company.balance)} en caisse). Semaine impayée n°${company.unpaidWeeks}.`;
    } else {
      company.unpaidWeeks = 0;
      for (const [userId, m] of Object.entries(company.members)) {
        if (m.role === "patron" || m.salary <= 0) continue;
        if (changeBalance(userId, m.salary, `Salaire — ${company.name}`) !== null) {
          move(company, -m.salary, `Salaire de ${client.users.cache.get(userId)?.tag ?? userId}`);
        }
      }
      salaryText = payroll ? `✅ Salaires versés : **${formatEuro(payroll)}**.` : "Aucun salaire à verser.";
    }

    const best = Object.entries(company.weekStats).sort((a, b) => b[1] - a[1])[0];
    await send(client, company.channelId, {
      embeds: [
        new EmbedBuilder()
          .setColor(company.unpaidWeeks ? 0xe74c3c : 0x2ecc71)
          .setTitle("🗓️ Clôture de la semaine")
          .setDescription(
            `Chiffre d'affaires : **${formatEuro(company.weekRevenue)}**\n` +
              `Impôt (${Math.round(P().corporateTax * 100)} %) : **${formatEuro(tax)}**\n${salaryText}\n` +
              (best ? `🏅 Employé de la semaine : **${pseudo(best[0])}** (${best[1]} client(s))\n` : "") +
              `\nCompte : **${formatEuro(company.balance)}**`
          )
          .setTimestamp(),
      ],
    });

    if (company.unpaidWeeks >= UNPAID_WEEKS_BEFORE_BANKRUPTCY) {
      company.status = "bankrupt";
      company.onDuty = {};
      await sendDossier(client, {
        content: `<@&${IRF_ROLE_ID}>`,
        allowedMentions: { roles: [IRF_ROLE_ID] },
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle(`⚠️ Cessation de paiements — ${company.name}`)
            .setDescription(`${company.unpaidWeeks} semaines de salaires impayés. Patron : **${pseudo(company.ownerId)}**.\nCompte : ${formatEuro(company.balance)}.`),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ent_irf_liquidate_${company.id}`).setLabel("Liquider").setEmoji("⚖️").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`ent_irf_grace_${company.id}`).setLabel("Accorder un délai").setEmoji("⏳").setStyle(ButtonStyle.Secondary)
          ),
        ],
      });
    }

    company.weekRevenue = 0;
    company.weekStats = {};
    dirtyPanels.add(company.id);
  }
  save();
  registryDirty = true;
  await refreshRichestLeaderboard(client).catch(() => null);
}

// --- IRF ---

async function liquidate(client, company, byTag) {
  const remaining = company.balance;
  if (remaining > 0) {
    move(company, -remaining, "Liquidation — solde versé à la Maison");
    addToTreasury("liquidations", remaining);
  }
  company.status = "closed";
  company.onDuty = {};
  const members = Object.keys(company.members);
  company.members = {};
  save();
  registryDirty = true;
  const channel = await client.channels.fetch(company.channelId).catch(() => null);
  await channel?.delete(`Entreprise liquidée par ${byTag}`).catch(() => null);
  for (const id of members) {
    const user = await client.users.fetch(id).catch(() => null);
    await user?.send(`⚖️ L'entreprise **${company.name}** a été liquidée par l'IRF.`).catch(() => null);
  }
}

// Bouton « Entreprises » du panneau IRF
async function showIrfCompanies(interaction) {
  const companies = Object.values(load().companies).filter((c) => ["active", "frozen", "bankrupt"].includes(c.status));
  const statusIcon = { active: "🟢", frozen: "🔒", bankrupt: "⚠️" };
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🏢 Entreprises (${companies.length})`)
    .setDescription(
      companies
        .map((c) => `${statusIcon[c.status]} **${c.name}** — **${pseudo(c.ownerId)}** · ${formatEuro(c.balance)} · CA sem. ${formatEuro(c.weekRevenue)} · ${Object.keys(c.members).length} membre(s)`)
        .join("\n")
        .slice(0, 4000) || "*Aucune entreprise.*"
    );
  await interaction.reply({
    embeds: [embed],
    components: companies.length
      ? [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("ent_irf_select")
              .setPlaceholder("Choisir une entreprise")
              .addOptions(companies.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), value: c.id, description: `${formatEuro(c.balance)} — ${c.status}` })))
          ),
        ]
      : [],
    ephemeral: true,
  });
}

async function showIrfCompany(interaction, company) {
  if (!company) return interaction.reply({ content: "❌ Entreprise introuvable.", ephemeral: true });
  const list = company.transactions.slice(-15).reverse();
  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🔎 Audit — ${company.name}`)
        .setDescription(
          `Patron : **${pseudo(company.ownerId)}** · Statut : **${company.status}** · Compte : **${formatEuro(company.balance)}**\n\n` +
            (list.map((t) => `${ts(t.at, "d")} **${t.delta >= 0 ? "+" : ""}${formatEuro(t.delta)}** — ${t.label}`).join("\n").slice(0, 3500) || "*Aucune opération.*")
        ),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        company.status === "frozen"
          ? new ButtonBuilder().setCustomId(`ent_irf_unfreeze_${company.id}`).setLabel("Dégeler").setEmoji("🔓").setStyle(ButtonStyle.Success)
          : new ButtonBuilder().setCustomId(`ent_irf_freeze_${company.id}`).setLabel("Geler").setEmoji("🔒").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`ent_irf_liquidate_${company.id}`).setLabel("Liquider").setEmoji("⚖️").setStyle(ButtonStyle.Danger)
      ),
    ],
    ephemeral: true,
  });
}

async function handleIrfAction(interaction, action, company, client) {
  if (!isIrf(interaction.member)) return interaction.reply({ content: "❌ Réservé à l'IRF.", ephemeral: true });
  if (!company || company.status === "closed") return interaction.update({ content: "❌ Entreprise introuvable.", embeds: [], components: [] });

  if (action === "freeze" || action === "unfreeze") {
    company.status = action === "freeze" ? "frozen" : "active";
    if (action === "freeze") company.onDuty = {};
    save();
    dirtyPanels.add(company.id);
    registryDirty = true;
    await send(client, company.channelId, {
      content: action === "freeze" ? "🔒 **L'entreprise est gelée par l'IRF** : plus de clients, de factures ni de dividendes." : "🔓 **L'entreprise est dégelée par l'IRF.**",
    });
    return interaction.update({ content: `${action === "freeze" ? "🔒 Gelée" : "🔓 Dégelée"} : **${company.name}**`, embeds: [], components: [] });
  }
  if (action === "grace") {
    company.status = "active";
    company.unpaidWeeks = UNPAID_WEEKS_BEFORE_BANKRUPTCY - 1;
    save();
    await send(client, company.channelId, { content: "⏳ **L'IRF accorde un dernier délai** : les salaires de dimanche prochain doivent être payés." });
    deleteInteractionMessageLater(interaction, MINUTE);
    return interaction.update({ embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setFooter({ text: `Délai accordé par ${interaction.user.tag}` })], components: [] });
  }
  if (action === "liquidate") {
    await liquidate(client, company, interaction.user.tag);
    deleteInteractionMessageLater(interaction, MINUTE);
    return interaction.update({ content: `⚖️ **${company.name}** a été liquidée.`, embeds: [], components: [] });
  }
}

// --- Routage ---

async function handleEntreprisesInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("ent_")) return false;
  load();
  const parts = id.split("_");
  const userId = interaction.user.id;

  // Registre
  if (id === "ent_create") { await startCreation(interaction); return true; }
  if (id === "ent_sector") { await interaction.showModal(creationModal(interaction.values[0])); return true; }
  if (id.startsWith("ent_modal_create_")) { await submitCreation(interaction, parts[3], client); return true; }
  if (id === "ent_mine") {
    const company = companyOf(userId);
    if (!company) await interaction.reply({ content: "💼 Vous ne faites partie d'aucune entreprise. Postulez dans le salon recrutement !", ephemeral: true });
    else if (company.status === "pending") await interaction.reply({ content: `⏳ **${company.name}** attend la validation de l'IRF.`, ephemeral: true });
    else await interaction.reply({ content: `💼 ${POSTES[roleIn(company, userId)]} de **${company.name}** — <#${company.channelId}>`, ephemeral: true });
    return true;
  }
  if (id === "ent_resign") {
    const company = companyOf(userId);
    if (!company || company.status === "pending") await interaction.reply({ content: "❌ Vous n'êtes employé nulle part.", ephemeral: true });
    else if (roleIn(company, userId) === "patron") await interaction.reply({ content: "❌ Un patron ne démissionne pas : contactez l'IRF pour fermer l'entreprise.", ephemeral: true });
    else {
      await removeMember(client, company, userId, "a démissionné");
      await interaction.reply({ content: `🚪 Vous avez quitté **${company.name}**.`, ephemeral: true });
    }
    return true;
  }

  // Validation IRF et actions IRF
  if (id.startsWith("ent_validate_")) { await validateCreation(interaction, parts[2] === "ok", parts[3], client); return true; }
  if (id === "ent_irf_select") {
    if (!isIrf(interaction.member)) { await interaction.reply({ content: "❌ Réservé à l'IRF.", ephemeral: true }); return true; }
    { await showIrfCompany(interaction, state.companies[interaction.values[0]]); return true; }
  }
  if (id.startsWith("ent_irf_")) { await handleIrfAction(interaction, parts[2], state.companies[parts[3]], client); return true; }

  // Contrats, candidatures, factures (salons publics)
  if (id.startsWith("ent_contract_")) { await answerContract(interaction, parts[3], parts[2] === "ok", client); return true; }
  if (id.startsWith("ent_apply_")) { await apply(interaction, parts[2], client); return true; }
  if (id.startsWith("ent_pay_")) { await payInvoice(interaction, parts[3], parts[2], client); return true; }

  // Actions internes : il faut appartenir à l'entreprise
  const companyId = ["ent_applyok", "ent_applyno", "ent_offerclose"].includes(`${parts[0]}_${parts[1]}`)
    ? state.offers[parts[2]]?.companyId
    : id.startsWith("ent_duty_") || id.startsWith("ent_client_")
      ? parts[3]
      : parts[2];
  const company = state.companies[companyId];
  if (!company || !company.members[userId]) {
    await interaction.reply({ content: "❌ Vous ne faites pas partie de cette entreprise.", ephemeral: true });
    return true;
  }
  const manager = canManage(company, userId);
  const patron = roleIn(company, userId) === "patron";
  const denied = (msg = "❌ Réservé au patron et aux managers.") => interaction.reply({ content: msg, ephemeral: true });

  switch (parts[1]) {
    case "duty":
      await setDuty(interaction, company, parts[2] !== "off", parts[2] === "auto");
      break;
    case "client":
      await answerClient(interaction, company, parts[4], parts[2] === "ok");
      break;
    case "report":
      await showReport(interaction, company);
      break;
    case "account":
      if (!manager) await denied();
      else await showAccount(interaction, company);
      break;
    case "deposit":
      if (!patron) await denied("❌ Réservé au patron.");
      else await interaction.showModal(amountModal(`ent_mdeposit_${company.id}`, "📥 Déposer de mon argent", "Montant (€)"));
      break;
    case "dividend":
      if (!patron) await denied("❌ Réservé au patron.");
      else await interaction.showModal(amountModal(`ent_mdividend_${company.id}`, "📤 Me verser un dividende", `Montant (€) — taxe de ${Math.round(P().dividendTax * 100)} %`));
      break;
    case "mdeposit":
      if (!patron) await denied("❌ Réservé au patron.");
      else await deposit(interaction, company, parseAmount(interaction.fields.getTextInputValue("montant")));
      break;
    case "mdividend":
      if (!patron) await denied("❌ Réservé au patron.");
      else await dividend(interaction, company, parseAmount(interaction.fields.getTextInputValue("montant")), client);
      break;
    case "staff":
      await showStaff(interaction, company);
      break;
    case "hire":
      if (!manager) await denied();
      else await interaction.showModal(contractModal(`ent_mhire_${company.id}_${interaction.values[0]}`, "✍️ Proposer un contrat"));
      break;
    case "mhire": {
      const contract = readContract(interaction);
      if (!manager) await denied();
      else if (contract.error) await interaction.reply({ content: contract.error, ephemeral: true });
      else await proposeContract(interaction, company, parts[3], contract, client);
      break;
    }
    case "member":
      if (!manager) await denied();
      else await showMemberActions(interaction, company, interaction.values[0]);
      break;
    case "edit":
      if (!manager) await denied();
      else if (company.members[parts[3]]?.role === "manager" && !patron) await denied("❌ Seul le patron modifie un manager.");
      else await interaction.showModal(contractModal(`ent_medit_${company.id}_${parts[3]}`, "✏️ Modifier le contrat", company.members[parts[3]]));
      break;
    case "medit": {
      const contract = readContract(interaction);
      const m = company.members[parts[3]];
      if (!manager || (m?.role === "manager" && !patron)) await denied();
      else if (contract.error) await interaction.reply({ content: contract.error, ephemeral: true });
      else if (!m || m.role === "patron") await interaction.reply({ content: "❌ Employé introuvable.", ephemeral: true });
      else {
        Object.assign(m, contract);
        save();
        dirtyPanels.add(company.id);
        await interaction.reply({ content: `✏️ Contrat de **${pseudo(parts[3])}** : ${POSTES[m.role]}, ${formatEuro(m.salary)}/semaine.`, ephemeral: true });
      }
      break;
    }
    case "fire":
      if (!manager || company.members[parts[3]]?.role === "patron") await denied();
      else if (company.members[parts[3]]?.role === "manager" && !patron) await denied("❌ Seul le patron licencie un manager.");
      else {
        await removeMember(client, company, parts[3], `a été licencié(e) par **${pseudo(interaction.user.id)}**`);
        await interaction.update({ content: "🚪 Employé licencié.", components: [] });
      }
      break;
    case "offer":
      if (!manager) await denied();
      else {
        const modal = contractModal(`ent_moffer_${company.id}`, "📢 Publier une offre d'emploi");
        modal.components.unshift(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("titre").setLabel("Intitulé du poste").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Missions, profil recherché").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800))
        );
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("places").setLabel("Nombre de personnes recherchées").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(2).setValue("1")
          )
        );
        await interaction.showModal(modal);
      }
      break;
    case "moffer":
      if (!manager) await denied();
      else await publishOffer(interaction, company, client);
      break;
    case "offerclose": {
      const job = state.offers[parts[2]];
      if (!manager) await denied();
      else if (!job) await interaction.update({ components: [] });
      else {
        await interaction.reply({ content: `🗑️ Offre « ${job.title} » retirée du recrutement.`, ephemeral: true });
        await removeJobOffer(client, job);
      }
      break;
    }
    case "applyok":
    case "applyno": {
      if (!manager) {
        await denied();
        break;
      }
      const offer = state.offers[parts[2]];
      if (parts[1] === "applyno" || !offer) {
        await interaction.update({ components: [], embeds: [EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x95a5a6).setFooter({ text: "Candidature refusée" })] });
        deleteInteractionMessageLater(interaction, 2 * MINUTE);
        const user = await client.users.fetch(parts[3]).catch(() => null);
        await user?.send(`🙋 Votre candidature chez **${company.name}** n'a pas été retenue.`).catch(() => null);
      } else {
        if (offer.places && (offer.hired ?? 0) >= offer.places) {
          await interaction.update({ content: "❌ Cette offre est déjà complète.", embeds: [], components: [] });
          break;
        }
        await proposeContract(interaction, company, parts[3], { role: offer.role, salary: offer.salary }, client, true, offer.id);
      }
      break;
    }
    case "invoice":
      await interaction.reply({
        content: "🧾 Qui facturer ?",
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`ent_bill_${company.id}`).setPlaceholder("Choisir un membre"))],
      });
      break;
    case "bill":
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`ent_minvoice_${company.id}_${interaction.values[0]}`)
          .setTitle("🧾 Nouvelle facture")
          .addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("objet").setLabel("Objet (prestation)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(150)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("montant").setLabel("Montant (€)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12))
          )
      );
      break;
    case "minvoice":
      await createInvoice(interaction, company, parts[3], client);
      break;
    default:
      return false;
  }
  return true;
}

async function setupEntreprises(client) {
  load();
  await ensureChannels(client);
  await refreshRegistry(client);
  for (const company of Object.values(state.companies)) {
    if (company.channelId && ["active", "frozen", "bankrupt"].includes(company.status)) {
      await updateChannelAccess(client, company); // salon réservé à l'équipe
      await refreshCompanyPanel(client, company);
    }
  }
  setInterval(() => tick(client).catch((err) => console.error("Entreprises:", err.message)), 60 * 1000);
  cron.schedule("0 20 * * 0", () => weeklyClose(client).catch((err) => console.error("Clôture entreprises:", err.message)), {
    timezone: "Europe/Paris",
  });
  console.log("Entreprises prêtes");
}

// Pour les impôts : le membre a-t-il un emploi ou une entreprise ?
function hasJob(userId) {
  const company = companyOf(userId);
  return Boolean(company && ["active", "frozen", "bankrupt"].includes(company.status));
}

function getCategoryId() {
  return load().categoryId ?? null;
}

// Pour la mairie : entreprises en activité et versement d'une subvention.
function listActiveCompanies() {
  return Object.values(load().companies).filter((c) => c.status === "active");
}

function listOpenCompanies() {
  return Object.values(load().companies).filter((c) => c.status === "active" || c.status === "frozen");
}

// Pour la mairie (dictature) : suspendre ou rétablir une entreprise.
async function setCompanySuspended(client, companyId, suspended, reason) {
  const company = load().companies[companyId];
  if (!company || !["active", "frozen"].includes(company.status)) return null;
  company.status = suspended ? "frozen" : "active";
  if (suspended) company.onDuty = {};
  save();
  dirtyPanels.add(company.id);
  registryDirty = true;
  await send(client, company.channelId, {
    content: suspended ? `⛔ **L'entreprise est suspendue par le régime.** ${reason}` : "✅ **Le régime lève la suspension de l'entreprise.**",
  });
  return company;
}

function creditCompany(companyId, amount, label) {
  const company = load().companies[companyId];
  if (!company || company.status !== "active") return false;
  move(company, amount, label);
  save();
  dirtyPanels.add(company.id);
  return true;
}

// Pour /profil : entreprise et poste d'un membre.
function getJobOf(userId) {
  const company = companyOf(userId);
  if (!company || !["active", "frozen", "bankrupt", "pending"].includes(company.status)) return null;
  return {
    name: company.name,
    sector: SECTORS[company.sector].label,
    role: POSTES[roleIn(company, userId)],
    status: company.status,
    channelId: company.channelId,
  };
}

module.exports = {
  getJobOf,
  setupEntreprises,
  handleEntreprisesInteraction,
  showIrfCompanies,
  hasJob,
  getCategoryId,
  listActiveCompanies,
  listOpenCompanies,
  creditCompany,
  setCompanySuspended,
  SECTORS,
};
