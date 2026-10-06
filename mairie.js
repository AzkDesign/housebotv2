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
  loadState: loadEconomie,
  changeBalance,
  readBalance,
  isFrozen,
  getTaxDebt,
  setTaxDebt,
  addToTreasury,
  formatEuro,
  isGerant,
  refreshRichestLeaderboard,
} = require("./economie");
const { SITUATION_DELICATE_ROLE_ID } = require("./casino");
const { listActiveCompanies, listOpenCompanies, creditCompany, setCompanySuspended, SECTORS } = require("./entreprises");
const {
  LEVERS,
  P,
  setLever,
  formatLever,
  boostSector,
  REGIMES,
  regime,
  setRegime,
  regimeChangedAt,
  curfew,
  setCurfew,
} = require("./politique");
const { findOrCreateChannel, findOrCreateRole } = require("./salons");
const { pseudo } = require("./noms");

const IRF_CHANNEL_ID = "1527524719094534185";

const CAUTION = 1000; // caution des candidats, remboursée à partir de 10 % des voix
const CAUTION_REFUND_SHARE = 0.1;
const CANDIDATE_SENIORITY_MS = 14 * 24 * 60 * 60 * 1000;
const VOTER_SENIORITY_MS = 7 * 24 * 60 * 60 * 1000;
const NEW_MEMBER_MS = 14 * 24 * 60 * 60 * 1000;
const BUDGET_SHARE = 0.3; // part des recettes de la semaine versée au budget municipal
const MAYOR_SALARY = 500;
const RELAUNCH_COST = 3000; // plan de relance d'un secteur
const RELAUNCH_DAYS = 7;
const REGIME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // un changement de régime par mois
const CONFISCATION_MAX = 0.15; // dictature : 15 % du solde au maximum…
const CONFISCATION_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // … une fois par semaine et par personne
const POLL_MS = 48 * 60 * 60 * 1000; // durée d'un vote citoyen
const NOBLE_TITLES = {
  duc: "🎖️ Duc / Duchesse",
  comte: "🎖️ Comte / Comtesse",
  baron: "🎖️ Baron / Baronne",
  chevalier: "🎖️ Chevalier",
};
const REFERENDUM_MS = 48 * 60 * 60 * 1000;
const REFERENDUM_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

const ELECTION_TITLE = "🗳️ Élections municipales";
const BUREAU_TITLE = "🏛️ Bureau du maire";

function round2(n) {
  return Math.round(n * 100) / 100;
}
function ts(ms, style = "f") {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}

// --- Données ---

const { DATA_DIR, dataFile } = require("./data");
const STATE_FILE = dataFile("mairie-state.json");
let state = null;

function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.budget ??= 0;
  state.history ??= [];
  state.allowances ??= { social: 0, universal: 0, welcome: 0 };
  state.events ??= {};
  state.counter ??= 0;
  state.petition ??= { signatures: [], referendum: null, lastReferendumAt: 0 };
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

function budgetMove(delta, label) {
  const s = load();
  const after = round2(s.budget + delta);
  if (after < 0) return false;
  s.budget = after;
  s.history.push({ at: Date.now(), delta: round2(delta), after, label });
  if (s.history.length > 50) s.history.splice(0, s.history.length - 50);
  if (s.mayor && delta < 0) s.mayor.spent = round2((s.mayor.spent ?? 0) - delta);
  save();
  return true;
}

// --- Calendrier (heure de Paris) ---

const parisParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function parisNow(t) {
  const p = Object.fromEntries(parisParts.formatToParts(new Date(t)).map((x) => [x.type, Number(x.value)]));
  return { year: p.year, month: p.month - 1, day: p.day, hour: p.hour, minute: p.minute };
}

// Timestamp d'une date/heure donnée à Paris.
function parisTime(year, month, day, hour = 0) {
  const guess = Date.UTC(year, month, day, hour);
  const p = parisNow(guess);
  const asUtc = Date.UTC(p.year, p.month, p.day, p.hour, p.minute);
  return guess - (asUtc - guess);
}

// Élections en janvier, avril, juillet et octobre.
function getPhase(now = Date.now()) {
  const { year, month } = parisNow(now);
  if (month % 3 === 0) {
    const key = `${year}-T${month / 3 + 1}`;
    const campagne = parisTime(year, month, 4);
    const vote = parisTime(year, month, 7);
    const results = parisTime(year, month, 8, 21);
    if (now < campagne) return { phase: "candidatures", key, until: campagne, results };
    if (now < vote) return { phase: "campagne", key, until: vote, results };
    if (now < results) return { phase: "vote", key, until: results, results };
  }
  let y = year;
  let m = month + 1;
  while (m % 3 !== 0) m++;
  if (m > 11) {
    m -= 12;
    y++;
  }
  return { phase: "mandat", key: null, until: parisTime(y, m, 1) };
}

const PHASE_LABELS = {
  candidatures: "📝 Dépôt des candidatures",
  campagne: "📣 Campagne électorale",
  vote: "🗳️ Vote en cours",
  mandat: "🏛️ Mandat en cours",
};

// --- Salons et rôles ---

async function getGuild(client) {
  const irf = await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null);
  return irf?.guild ?? client.guilds.cache.first();
}

async function ensureSetup(client) {
  const s = load();
  const guild = await getGuild(client);
  if (!guild) return null;

  for (const [key, name, color] of [
    ["maireRoleId", "👑 Maire", 0xf1c40f],
    ["adjointRoleId", "🎖️ Adjoint au maire", 0xe67e22],
  ]) {
    const role = await findOrCreateRole(guild, { id: s[key], name, color, hoist: true });
    s[key] = role.id;
  }

  const category = await findOrCreateChannel(guild, { id: s.categoryId, name: "🏛️ Mairie", type: ChannelType.GuildCategory });
  s.categoryId = category.id;

  const readOnly = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
    { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
  ];
  const bureau = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    { id: s.maireRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: s.adjointRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  for (const [key, name, perms] of [
    ["electionsChannelId", "🗳️・élections", readOnly],
    ["journalChannelId", "📜・journal-officiel", readOnly],
    ["bureauChannelId", "🏛️・bureau-du-maire", bureau],
  ]) {
    const channel = await findOrCreateChannel(guild, { id: s[key], name, parent: category.id, permissionOverwrites: perms });
    s[key] = channel.id;
    // Le bureau reste privé même si ses permissions ont été modifiées entre-temps
    if (key === "bureauChannelId") {
      await channel.permissionOverwrites.set(perms).catch((err) => console.error("Permissions bureau:", err.message));
      if (!channel.topic?.startsWith("privé:")) await channel.setTopic("privé: bureau du maire et de son adjoint").catch(() => null);
    }
  }
  save();
  return guild;
}

async function channel(client, key) {
  const id = load()[key];
  const c = id ? await client.channels.fetch(id).catch(() => null) : null;
  return c?.isTextBased() ? c : null;
}

// Tout ce que fait la mairie est publié au Journal officiel.
// Signature des actes au Journal officiel (anonymes sous la dictature : censure).
function sign(userId, withRole = false) {
  if (regime() === "dictature") return "— *Le Régime*";
  const role = isMayor(userId) ? REGIMES[regime()].title.toLowerCase() : "adjoint au maire";
  return `— **${pseudo(userId)}**${withRole ? `, ${role}` : ""}`;
}

async function journal(client, title, description, color = 0xf1c40f) {
  const c = await channel(client, "journalChannelId");
  await c
    ?.send({ embeds: [new EmbedBuilder().setColor(color).setTitle(title).setDescription(description).setTimestamp()] })
    .catch(() => null);
}

const lastPanels = new Map();

async function upsertPanel(client, key, messageKey, title, payload) {
  const s = load();
  // Ne modifier le message que si son contenu a changé (sinon « (modifié) » toutes les minutes)
  const signature = JSON.stringify(payload);
  if (s[messageKey] && lastPanels.get(messageKey) === signature) return;
  lastPanels.set(messageKey, signature);
  const c = await channel(client, key);
  if (!c) return;
  let msg = s[messageKey] ? await c.messages.fetch(s[messageKey]).catch(() => null) : null;
  if (!msg) {
    const recent = await c.messages.fetch({ limit: 25 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === title);
  }
  if (msg) await msg.edit(payload).catch(() => null);
  else msg = await c.send(payload).catch(() => null);
  if (msg && s[messageKey] !== msg.id) {
    s[messageKey] = msg.id;
    save();
  }
}

// --- Qui est qui ---

function isMayor(userId) {
  return load().mayor?.userId === userId;
}
function isAdjoint(userId) {
  return load().mayor?.adjointId === userId;
}

function seniority(member) {
  return Date.now() - (member?.joinedTimestamp ?? Date.now());
}

async function eligibleVoters(guild) {
  await guild.members.fetch().catch(() => null);
  return [...guild.members.cache.values()].filter((m) => !m.user.bot && seniority(m) >= VOTER_SENIORITY_MS);
}

// --- Panneau des élections ---

function currentElection() {
  const { phase, key } = getPhase();
  const s = load();
  if (key && s.election?.key !== key && phase === "candidatures") {
    s.election = { key, candidates: {}, votes: {}, done: false };
    save();
  }
  return s.election?.key === key ? s.election : null;
}

function electionPanel() {
  const s = load();
  const { phase, until } = getPhase();
  const election = currentElection();
  const candidates = election ? Object.entries(election.candidates) : [];
  const mayor = s.mayor;

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(ELECTION_TITLE)
    .setDescription(
      `**${PHASE_LABELS[phase]}** — prochaine étape ${ts(until, "R")} (${ts(until, "F")})\n\n` +
        (mayor
          ? `👑 **Maire** : **${pseudo(mayor.userId)}**${mayor.adjointId ? ` · 🎖️ Adjoint : **${pseudo(mayor.adjointId)}**` : ""}${mayor.interim ? " *(intérim)*" : ""}\n`
          : "👑 **Maire** : *aucun pour le moment*\n") +
        `${REGIMES[regime()].emoji} Régime : **${REGIMES[regime()].name}**${curfew() ? " · 🌙 couvre-feu" : ""}\n` +
        `💰 Budget municipal : **${formatEuro(s.budget)}**\n\n` +
        "**Calendrier** (élection chaque trimestre : janvier, avril, juillet, octobre)\n" +
        "📝 du 1er au 3 : candidatures · 📣 du 4 au 6 : campagne · 🗳️ du 7 au 8 à 21h : vote\n\n" +
        `**Candidater** : membre depuis 2 semaines, compte non gelé, sans dette fiscale. Caution de ${formatEuro(CAUTION)}, remboursée dès ${Math.round(CAUTION_REFUND_SHARE * 100)} % des voix. Seul(e) ou avec **1 adjoint**.\n` +
        "**Voter** : membre depuis 7 jours. Vote anonyme, modifiable jusqu'à la clôture."
    );

  if (candidates.length) {
    embed.addFields({
      name: `Candidats (${candidates.length})`,
      value: candidates
        .map(([id, c]) => `• **${pseudo(id)}**${c.adjointId ? ` & **${pseudo(c.adjointId)}**` : ""} — *« ${c.slogan} »*`)
        .join("\n")
        .slice(0, 1024),
    });
  }
  if (phase === "vote" && election) embed.addFields({ name: "Participation", value: `${Object.keys(election.votes).length} vote(s)` });
  if (s.petition.referendum) {
    embed.addFields({ name: "⚖️ Référendum de destitution en cours", value: `Fin ${ts(s.petition.referendum.until, "R")}` });
  } else if (mayor && phase === "mandat") {
    embed.addFields({ name: "✍️ Pétition de destitution", value: `${s.petition.signatures.length} signature(s)` });
  }

  const buttons = [];
  if (phase === "candidatures") {
    buttons.push(new ButtonBuilder().setCustomId("mairie_run").setLabel("Me présenter").setEmoji("📝").setStyle(ButtonStyle.Success));
  }
  if (phase === "candidatures" || phase === "campagne") {
    buttons.push(new ButtonBuilder().setCustomId("mairie_withdraw").setLabel("Retirer ma candidature").setEmoji("↩️").setStyle(ButtonStyle.Secondary));
  }
  if (phase === "vote") {
    buttons.push(new ButtonBuilder().setCustomId("mairie_vote").setLabel("Voter").setEmoji("🗳️").setStyle(ButtonStyle.Primary));
  }
  if (mayor && phase === "mandat" && !s.petition.referendum) {
    buttons.push(new ButtonBuilder().setCustomId("mairie_petition").setLabel("Signer la pétition de destitution").setEmoji("✍️").setStyle(ButtonStyle.Danger));
  }
  buttons.push(new ButtonBuilder().setCustomId("mairie_staff").setLabel("Staff").setEmoji("🛠️").setStyle(ButtonStyle.Secondary));

  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(buttons)] };
}

function candidateCard(userId, c) {
  return new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(`🗳️ Candidature — « ${c.slogan} »`)
    .setDescription(`Tête de liste : **${pseudo(userId)}**${c.adjointId ? `\nAdjoint : **${pseudo(c.adjointId)}**` : "\n*Candidature seule*"}\n\n**Programme**\n${c.programme}`)
    .setTimestamp(c.at);
}

async function refreshCandidateCard(client, userId) {
  const c = load().election?.candidates[userId];
  const ch = await channel(client, "electionsChannelId");
  if (!c || !ch) return;
  const msg = c.messageId ? await ch.messages.fetch(c.messageId).catch(() => null) : null;
  if (msg) await msg.edit({ embeds: [candidateCard(userId, c)] }).catch(() => null);
  else {
    const sent = await ch.send({ embeds: [candidateCard(userId, c)] }).catch(() => null);
    if (sent) {
      c.messageId = sent.id;
      save();
    }
  }
}

// --- Bureau du maire ---

function bureauPanel() {
  const s = load();
  const p = P();
  const a = s.allowances;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(BUREAU_TITLE)
    .setDescription(
      (s.mayor ? `👑 **${pseudo(s.mayor.userId)}**${s.mayor.adjointId ? ` · 🎖️ **${pseudo(s.mayor.adjointId)}**` : ""}\n\n` : "*Aucun maire en fonction.*\n\n") +
        `${REGIMES[regime()].emoji} **Régime : ${REGIMES[regime()].name}**${curfew() ? " · 🌙 couvre-feu en cours" : ""}\n*${REGIMES[regime()].description}*\n\n` +
        `💰 **Budget : ${formatEuro(s.budget)}**\n` +
        `Chaque dimanche : ${Math.round(BUDGET_SHARE * 100)} % des recettes de la Maison, moins le salaire du maire (${formatEuro(MAYOR_SALARY)}) et les allocations.\n\n` +
        "**⚖️ Taux en vigueur**\n" +
        Object.keys(LEVERS).map((k) => `${LEVERS[k].label} : **${formatLever(k, p[k])}**`).join("\n") +
        "\n\n**🤝 Allocations hebdomadaires**\n" +
        `Situation délicate : **${formatEuro(a.social)}** · Tous les membres : **${formatEuro(a.universal)}** · Nouveaux membres : **${formatEuro(a.welcome)}**\n\n` +
        "*Toutes les décisions sont publiées au Journal officiel. Les taux sont réservés au maire ; l'adjoint gère les aides.*"
    );
  const btn = (id, label, emoji, style = ButtonStyle.Primary) => new ButtonBuilder().setCustomId(`mairie_b_${id}`).setLabel(label).setEmoji(emoji).setStyle(style);
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        btn("budget", "Budget", "💰", ButtonStyle.Secondary),
        btn("taxes", "Taxes & taux", "⚖️", ButtonStyle.Danger),
        btn("decree", "Arrêté municipal", "📜", ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        btn("subsidy", "Subvention", "🏢"),
        btn("bonus", "Prime", "🎁"),
        btn("allowances", "Allocations", "🤝"),
        btn("amnesty", "Amnistie fiscale", "🧾")
      ),
      new ActionRowBuilder().addComponents(
        btn("relaunch", "Plan de relance", "🚀", ButtonStyle.Success),
        btn("event", "Événement", "🎉", ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        btn("regime", "Changer de régime", "🏛️", ButtonStyle.Danger),
        btn("powers", "Pouvoirs du régime", "✨", ButtonStyle.Primary),
        btn("assos", "Associations", "🤝", ButtonStyle.Success),
        btn("lois", "Lois", "📜", ButtonStyle.Danger)
      ),
    ],
  };
}

async function refreshPanels(client) {
  await upsertPanel(client, "electionsChannelId", "electionPanelId", ELECTION_TITLE, electionPanel());
  await upsertPanel(client, "bureauChannelId", "bureauPanelId", BUREAU_TITLE, bureauPanel());
}

// --- Candidatures et vote ---

async function checkCandidate(member) {
  if (seniority(member) < CANDIDATE_SENIORITY_MS) return "❌ Il faut être membre depuis au moins 2 semaines.";
  if (isFrozen(member.id)) return "🔒 Votre compte est gelé par l'IRF.";
  if (getTaxDebt(member.id)) return "❌ Vous avez une dette fiscale : réglez-la au Centre des impôts.";
  const election = currentElection();
  if (Object.entries(election?.candidates ?? {}).some(([id, c]) => id === member.id || c.adjointId === member.id)) {
    return "❌ Vous êtes déjà sur une liste.";
  }
  return null;
}

async function registerCandidate(interaction, client) {
  const member = interaction.member;
  const err = await checkCandidate(member);
  if (err) return interaction.reply({ content: err, ephemeral: true });
  if (getPhase().phase !== "candidatures") return interaction.reply({ content: "❌ Les candidatures sont closes.", ephemeral: true });
  if (changeBalance(member.id, -CAUTION, "Caution — élections municipales") === null) {
    return interaction.reply({ content: `❌ Il faut ${formatEuro(CAUTION)} pour la caution.`, ephemeral: true });
  }

  const election = currentElection();
  election.candidates[member.id] = {
    slogan: interaction.fields.getTextInputValue("slogan").trim(),
    programme: interaction.fields.getTextInputValue("programme").trim(),
    adjointId: null,
    at: Date.now(),
  };
  save();
  await refreshCandidateCard(client, member.id);
  await refreshPanels(client);
  await interaction.reply({
    content: `✅ Candidature enregistrée (caution de ${formatEuro(CAUTION)} versée). Vous pouvez choisir **un adjoint** (facultatif) :`,
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder().setCustomId("mairie_adjoint").setPlaceholder("Choisir mon adjoint (facultatif)")
      ),
    ],
  });
}

async function chooseAdjoint(interaction, client) {
  const election = currentElection();
  const candidate = election?.candidates[interaction.user.id];
  if (!candidate || getPhase().phase !== "candidatures") return interaction.reply({ content: "❌ Impossible maintenant.", ephemeral: true });
  const adjoint = await interaction.guild.members.fetch(interaction.values[0]).catch(() => null);
  if (!adjoint || adjoint.user.bot || adjoint.id === interaction.user.id) return interaction.reply({ content: "❌ Adjoint invalide.", ephemeral: true });
  const err = await checkCandidate(adjoint);
  if (err) return interaction.reply({ content: `❌ ${adjoint} ne peut pas être adjoint : ${err.replace(/^\S+ /, "").toLowerCase()}`, ephemeral: true });
  candidate.adjointId = adjoint.id;
  save();
  await refreshCandidateCard(client, interaction.user.id);
  await refreshPanels(client);
  await adjoint.send(`🎖️ **${pseudo(interaction.user.id)}** vous a choisi(e) comme **adjoint** pour les élections municipales.`).catch(() => null);
  await interaction.update({ content: `🎖️ ${adjoint} est votre adjoint.`, components: [] });
}

async function withdraw(interaction, client) {
  const election = currentElection();
  const c = election?.candidates[interaction.user.id];
  if (!c) return interaction.reply({ content: "❌ Vous n'êtes pas candidat.", ephemeral: true });
  delete election.candidates[interaction.user.id];
  for (const [voter, choice] of Object.entries(election.votes)) {
    if (choice === interaction.user.id) delete election.votes[voter];
  }
  save();
  changeBalance(interaction.user.id, CAUTION, "Caution remboursée (retrait de candidature)", { force: true });
  const ch = await channel(client, "electionsChannelId");
  const msg = c.messageId ? await ch?.messages.fetch(c.messageId).catch(() => null) : null;
  await msg?.delete().catch(() => null);
  await refreshPanels(client);
  await interaction.reply({ content: "↩️ Candidature retirée, caution remboursée.", ephemeral: true });
}

async function showVote(interaction) {
  const election = currentElection();
  if (getPhase().phase !== "vote" || !election) return interaction.reply({ content: "❌ Le vote n'est pas ouvert.", ephemeral: true });
  if (seniority(interaction.member) < VOTER_SENIORITY_MS) return interaction.reply({ content: "❌ Il faut être membre depuis 7 jours pour voter.", ephemeral: true });
  const candidates = Object.entries(election.candidates);
  if (!candidates.length) return interaction.reply({ content: "Aucun candidat.", ephemeral: true });
  const current = election.votes[interaction.user.id];
  await interaction.reply({
    content: current ? `🗳️ Vous avez voté pour **${pseudo(current)}**. Vous pouvez changer :` : "🗳️ Pour qui votez-vous ?",
    ephemeral: true,
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("mairie_ballot")
          .setPlaceholder("Choisir un candidat")
          .addOptions(
            candidates.slice(0, 25).map(([id, c]) => ({
              label: (interaction.guild.members.cache.get(id)?.displayName ?? id).slice(0, 100),
              value: id,
              description: c.slogan.slice(0, 100),
            }))
          )
      ),
    ],
  });
}

async function castVote(interaction, client) {
  const election = currentElection();
  if (getPhase().phase !== "vote" || !election?.candidates[interaction.values[0]]) {
    return interaction.update({ content: "❌ Vote impossible.", components: [] });
  }
  if (seniority(interaction.member) < VOTER_SENIORITY_MS) {
    return interaction.update({ content: "❌ Il faut être membre depuis 7 jours pour voter.", components: [] });
  }
  election.votes[interaction.user.id] = interaction.values[0];
  save();
  await interaction.update({ content: `✅ Vote enregistré pour **${pseudo(interaction.values[0])}**. Il reste anonyme et modifiable jusqu'à la clôture.`, components: [] });
  await upsertPanel(client, "electionsChannelId", "electionPanelId", ELECTION_TITLE, electionPanel());
}

// --- Résultats et passation ---

async function setRoles(client, mayorId, adjointId) {
  const s = load();
  const guild = await getGuild(client);
  if (!guild) return;
  await guild.members.fetch().catch(() => null);
  for (const [roleId, keep] of [
    [s.maireRoleId, mayorId],
    [s.adjointRoleId, adjointId],
  ]) {
    const role = await guild.roles.fetch(roleId).catch(() => null);
    if (!role) continue;
    for (const m of role.members.values()) if (m.id !== keep) await m.roles.remove(role).catch(() => null);
    if (keep) await (await guild.members.fetch(keep).catch(() => null))?.roles.add(role).catch(() => null);
  }
}

function mandateReport(mayor) {
  return (
    `👑 **${pseudo(mayor.userId)}** — en fonction depuis ${ts(mayor.since, "D")}\n` +
    `💸 Dépenses : **${formatEuro(mayor.spent ?? 0)}**\n` +
    `📜 Arrêtés : **${mayor.decrees ?? 0}** · ⚖️ Changements de taux : **${mayor.taxChanges ?? 0}**\n` +
    `🏢 Subventions : **${mayor.subsidies ?? 0}** · 🎁 Primes : **${mayor.bonuses ?? 0}**`
  );
}

async function installMayor(client, userId, adjointId, interim = false) {
  const s = load();
  s.mayor = userId ? { userId, adjointId: adjointId ?? null, since: Date.now(), interim, spent: 0 } : null;
  s.petition = { signatures: [], referendum: null, lastReferendumAt: s.petition.lastReferendumAt ?? 0 };
  save();
  await clearNobility(client);
  setRegime("democratie");
  s.regimeLockedUntil = 0; // le nouveau maire peut choisir son régime tout de suite
  save();
  await setRoles(client, userId, adjointId);
  const bureau = await channel(client, "bureauChannelId");
  if (bureau && userId) {
    await bureau
      .send(`👑 Bienvenue <@${userId}>${adjointId ? ` et <@${adjointId}>` : ""} ! Ce bureau est le vôtre : chaque bouton ci-dessus est un vrai pouvoir. Toutes vos décisions sont publiées au Journal officiel.`)
      .catch(() => null);
  }
}

async function publishResults(client) {
  const s = load();
  const election = s.election;
  if (!election || election.done) return;
  election.done = true;
  save();

  const candidates = Object.keys(election.candidates);
  const counts = Object.fromEntries(candidates.map((id) => [id, 0]));
  for (const choice of Object.values(election.votes)) if (counts[choice] !== undefined) counts[choice] += 1;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ch = await channel(client, "electionsChannelId");

  if (!candidates.length) {
    await ch?.send(`🗳️ **Aucun candidat** pour l'élection ${election.key}. ${s.mayor ? "Le mandat du maire sortant est prolongé jusqu'au prochain scrutin." : "La Maison reste sans maire."}`).catch(() => null);
    await journal(client, "🗳️ Élection sans candidat", s.mayor ? "Le mandat du maire est prolongé." : "Pas de maire ce trimestre.");
    await refreshPanels(client);
    return;
  }

  const best = Math.max(...Object.values(counts));
  const tied = candidates.filter((id) => counts[id] === best);
  const winner = tied[Math.floor(Math.random() * tied.length)];

  // Cautions
  for (const id of candidates) {
    if (total && counts[id] / total >= CAUTION_REFUND_SHARE) {
      changeBalance(id, CAUTION, "Caution remboursée (élections)", { force: true });
    } else {
      addToTreasury("cautions", CAUTION);
    }
  }

  const results = candidates
    .sort((a, b) => counts[b] - counts[a])
    .map((id) => `${id === winner ? "👑" : "•"} **${pseudo(id)}** — **${counts[id]}** voix (${total ? Math.round((counts[id] / total) * 1000) / 10 : 0} %)`)
    .join("\n");

  if (s.mayor) await journal(client, "📊 Bilan de fin de mandat", mandateReport(s.mayor), 0x95a5a6);
  const adjointId = election.candidates[winner].adjointId;
  await installMayor(client, winner, adjointId);

  const text =
    `**${total}** votant(s)\n\n${results}` +
    (tied.length > 1 ? "\n\n⚖️ Égalité : le vainqueur a été **tiré au sort**." : "") +
    `\n\n👑 **${pseudo(winner)}** est élu(e) maire${adjointId ? `, avec **${pseudo(adjointId)}** comme adjoint` : ""} !`;
  await ch?.send({ content: `<@${winner}>`, embeds: [new EmbedBuilder().setColor(0xf1c40f).setTitle(`🏆 Résultats — ${election.key}`).setDescription(text)] }).catch(() => null);
  await journal(client, "👑 Nouveau maire", text);
  await require("./cartes").grantEventCard(client, winner, "ev_maire").catch(() => null);
  require("./feed").post(`👑 **${pseudo(winner)}** est élu(e) maire de la Maison !`);
  await refreshPanels(client);
  await refreshRichestLeaderboard(client).catch(() => null);
}

// --- Destitution ---

async function signPetition(interaction, client) {
  const s = load();
  if (!s.mayor || s.petition.referendum || getPhase().phase !== "mandat") return interaction.reply({ content: "❌ Pas de pétition possible maintenant.", ephemeral: true });
  if (seniority(interaction.member) < VOTER_SENIORITY_MS) return interaction.reply({ content: "❌ Il faut être membre depuis 7 jours.", ephemeral: true });
  if (Date.now() - s.petition.lastReferendumAt < REFERENDUM_COOLDOWN_MS) {
    return interaction.reply({ content: "❌ Un référendum a déjà eu lieu il y a moins de 30 jours.", ephemeral: true });
  }
  if (s.petition.signatures.includes(interaction.user.id)) return interaction.reply({ content: "✍️ Vous avez déjà signé.", ephemeral: true });
  s.petition.signatures.push(interaction.user.id);
  save();

  const voters = await eligibleVoters(interaction.guild);
  const needed = Math.ceil(voters.length * REGIMES[regime()].petition);
  if (s.petition.signatures.length >= needed) {
    s.petition.referendum = { until: Date.now() + REFERENDUM_MS, votes: {} };
    s.petition.lastReferendumAt = Date.now();
    save();
    const ch = await channel(client, "electionsChannelId");
    await ch
      ?.send({
        content: "@here",
        allowedMentions: { parse: ["everyone"] },
        embeds: [
          new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle("⚖️ Référendum de destitution")
            .setDescription(`La pétition a réuni ${s.petition.signatures.length} signatures. Faut-il **destituer** **${pseudo(s.mayor.userId)}** ?\nFin du vote ${ts(s.petition.referendum.until, "R")}.`),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("mairie_ref_yes").setLabel("Destituer").setEmoji("👎").setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId("mairie_ref_no").setLabel("Maintenir").setEmoji("👍").setStyle(ButtonStyle.Success)
          ),
        ],
      })
      .catch(() => null);
    await journal(client, "⚖️ Référendum de destitution", `Pétition réussie (${s.petition.signatures.length} signatures). Vote ouvert pendant 48 h.`, 0xe74c3c);
  }
  await refreshPanels(client);
  await interaction.reply({ content: `✍️ Signature enregistrée (${s.petition.signatures.length}/${needed}).`, ephemeral: true });
}

async function referendumVote(interaction, yes) {
  const ref = load().petition.referendum;
  if (!ref || Date.now() > ref.until) return interaction.reply({ content: "❌ Le référendum est terminé.", ephemeral: true });
  if (seniority(interaction.member) < VOTER_SENIORITY_MS) return interaction.reply({ content: "❌ Il faut être membre depuis 7 jours.", ephemeral: true });
  ref.votes[interaction.user.id] = yes;
  save();
  await interaction.reply({ content: `✅ Vote enregistré : **${yes ? "destituer" : "maintenir"}** (modifiable jusqu'à la fin).`, ephemeral: true });
}

async function closeReferendum(client) {
  const s = load();
  const ref = s.petition.referendum;
  if (!ref || Date.now() < ref.until) return;
  const votes = Object.values(ref.votes);
  const yes = votes.filter(Boolean).length;
  const no = votes.length - yes;
  s.petition.referendum = null;
  s.petition.signatures = [];
  save();

  const ch = await channel(client, "electionsChannelId");
  if (yes > no && s.mayor) {
    const old = s.mayor;
    await journal(client, "📊 Bilan de fin de mandat (destitution)", mandateReport(old), 0x95a5a6);
    await installMayor(client, old.adjointId ?? null, null, true);
    const text = `**${yes}** pour, **${no}** contre : **${pseudo(old.userId)}** est **destitué(e)**.\n` + (old.adjointId ? `🎖️ **${pseudo(old.adjointId)}** assure l'intérim jusqu'à la prochaine élection.` : "La Maison est sans maire jusqu'à la prochaine élection.");
    await ch?.send({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("⚖️ Maire destitué").setDescription(text)] }).catch(() => null);
    await journal(client, "⚖️ Maire destitué", text, 0xe74c3c);
  } else {
    const text = `**${yes}** pour, **${no}** contre : le maire est **maintenu**.`;
    await ch?.send({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("⚖️ Référendum — maire maintenu").setDescription(text)] }).catch(() => null);
    await journal(client, "⚖️ Référendum — maire maintenu", text, 0x2ecc71);
  }
  await refreshPanels(client);
}

// --- Budget du dimanche ---

// Total net encaissé par la Maison depuis le début (le casino compte pour son résultat).
function treasuryNet() {
  const t = loadEconomie().treasury;
  let total = 0;
  for (const [k, v] of Object.entries(t)) if (k !== "casinoMises" && k !== "casinoGains") total += v;
  return round2(total + (t.casinoMises ?? 0) - (t.casinoGains ?? 0));
}

async function weeklyBudget(client) {
  const s = load();
  const net = treasuryNet();
  const receipts = s.lastTreasuryNet === undefined ? 0 : Math.max(0, round2(net - s.lastTreasuryNet));
  s.lastTreasuryNet = net;
  save();
  const lines = [];

  const income = round2(receipts * BUDGET_SHARE);
  if (income > 0) budgetMove(income, `${Math.round(BUDGET_SHARE * 100)} % des recettes de la semaine (${formatEuro(receipts)})`);
  lines.push(`📥 Recettes de la Maison : ${formatEuro(receipts)} → **+${formatEuro(income)}** pour la ville`);

  if (s.mayor) {
    const salary = Math.min(MAYOR_SALARY, s.budget);
    if (salary > 0 && budgetMove(-salary, "Salaire du maire")) {
      changeBalance(s.mayor.userId, salary, "Salaire de maire");
      lines.push(`👑 Salaire du maire : ${formatEuro(salary)}`);
    }
  }

  // Allocations (aucune en anarchie)
  const guild = regime() === "anarchie" ? null : await getGuild(client);
  if (guild) {
    await guild.members.fetch().catch(() => null);
    const humans = [...guild.members.cache.values()].filter((m) => !m.user.bot);
    const groups = [
      ["social", "🤝 Allocation situation délicate", humans.filter((m) => m.roles.cache.has(SITUATION_DELICATE_ROLE_ID))],
      ["universal", "💶 Allocation pour tous", humans.filter((m) => seniority(m) >= VOTER_SENIORITY_MS)],
      ["welcome", "🌱 Allocation de bienvenue", humans.filter((m) => seniority(m) < NEW_MEMBER_MS)],
    ];
    for (const [key, label, members] of groups) {
      const amount = s.allowances[key];
      if (!amount || !members.length) continue;
      const cost = round2(amount * members.length);
      if (!budgetMove(-cost, `${label} (${members.length} × ${formatEuro(amount)})`)) {
        lines.push(`❌ ${label} : budget insuffisant (${formatEuro(cost)} nécessaires), non versée`);
        continue;
      }
      let paid = 0;
      for (const m of members) if (changeBalance(m.id, amount, label.replace(/^\S+ /, "")) !== null) paid++;
      // Comptes gelés : non versé, donc rendu au budget
      if (paid < members.length) budgetMove(round2(amount * (members.length - paid)), `${label} non versée (${members.length - paid} compte(s) gelé(s))`);
      lines.push(`${label} : ${paid} × ${formatEuro(amount)} = **${formatEuro(round2(amount * paid))}**`);
    }
  }

  lines.push(`\n💰 Budget restant : **${formatEuro(load().budget)}**`);
  await journal(client, "🗓️ Budget municipal de la semaine", lines.join("\n"));
  await refreshPanels(client);
  await refreshRichestLeaderboard(client).catch(() => null);
}

// --- Actions du bureau ---

function modal(customId, title, inputs) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(
      inputs.map(([id, label, style = TextInputStyle.Short, value, max = 12]) => {
        const t = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true).setMaxLength(max);
        if (value !== undefined) t.setValue(String(value));
        return new ActionRowBuilder().addComponents(t);
      })
    );
}

function amount(interaction, field = "montant") {
  return parseInt(interaction.fields.getTextInputValue(field).replace(/[^\d]/g, ""), 10) || 0;
}

function count(key) {
  const m = load().mayor;
  if (m) {
    m[key] = (m[key] ?? 0) + 1;
    save();
  }
}

async function bureauAction(interaction, action, client) {
  const userId = interaction.user.id;
  const mayor = isMayor(userId);
  if (!mayor && !isAdjoint(userId)) return interaction.reply({ content: "❌ Réservé au maire et à son adjoint.", ephemeral: true });
  const s = load();
  if (regime() === "anarchie" && ["taxes", "subsidy", "bonus", "allowances", "amnesty", "relaunch"].includes(action)) {
    return interaction.reply({ content: "🏴 En anarchie, il n'y a ni impôts ni aides. Changez de régime pour retrouver ces pouvoirs.", ephemeral: true });
  }

  switch (action) {
    case "regime":
      if (!mayor) return interaction.reply({ content: "❌ Seul le maire choisit le régime.", ephemeral: true });
      if (Date.now() < (s.regimeLockedUntil ?? 0)) {
        return interaction.reply({ content: `⏳ Prochain changement de régime possible ${ts(s.regimeLockedUntil, "R")}.`, ephemeral: true });
      }
      return interaction.reply({
        content: "🏛️ Quel régime voulez-vous instaurer ? (un changement par mois)",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("mairie_regime")
              .setPlaceholder("Choisir un régime")
              .addOptions(
                Object.entries(REGIMES).map(([id, r]) => ({
                  label: r.name,
                  value: id,
                  emoji: r.emoji,
                  description: r.description.slice(0, 100),
                  default: id === regime(),
                }))
              )
          ),
        ],
      });

    case "powers":
      return showRegimePowers(interaction, mayor);

    case "assos":
      return require("./associations").openMayorMenu(interaction);

    case "lois":
      return require("./lois").openMayorMenu(interaction);

    case "budget":
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xf1c40f)
            .setTitle(`💰 Budget municipal : ${formatEuro(s.budget)}`)
            .setDescription(
              s.history
                .slice(-15)
                .reverse()
                .map((h) => `${ts(h.at, "d")} **${h.delta >= 0 ? "+" : ""}${formatEuro(h.delta)}** — ${h.label}`)
                .join("\n")
                .slice(0, 4000) || "*Aucune opération.*"
            ),
        ],
        ephemeral: true,
      });

    case "taxes":
      if (!mayor) return interaction.reply({ content: "❌ Seul le maire fixe les taux.", ephemeral: true });
      return interaction.reply({
        content: "⚖️ Quel taux modifier ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("mairie_lever")
              .setPlaceholder("Choisir un taux")
              .addOptions(
                Object.entries(LEVERS).map(([k, l]) => ({
                  label: l.label.slice(0, 100),
                  value: k,
                  description: `Actuel : ${formatLever(k, P()[k])} — de ${formatLever(k, l.min)} à ${formatLever(k, l.max)}`.slice(0, 100),
                }))
              )
          ),
        ],
      });

    case "decree":
      return interaction.showModal(
        modal("mairie_m_decree", "📜 Arrêté municipal", [
          ["titre", "Titre", TextInputStyle.Short, undefined, 100],
          ["texte", "Texte de l'arrêté", TextInputStyle.Paragraph, undefined, 2000],
        ])
      );

    case "subsidy": {
      const companies = listActiveCompanies();
      if (!companies.length) return interaction.reply({ content: "Aucune entreprise en activité.", ephemeral: true });
      return interaction.reply({
        content: "🏢 Quelle entreprise subventionner ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("mairie_subsidy")
              .setPlaceholder("Choisir une entreprise")
              .addOptions(companies.slice(0, 25).map((c) => ({ label: c.name.slice(0, 100), value: c.id, description: `${SECTORS[c.sector].label} — ${formatEuro(c.balance)}`.slice(0, 100) })))
          ),
        ],
      });
    }

    case "bonus":
      return interaction.reply({
        content: "🎁 À qui verser une prime ?",
        ephemeral: true,
        components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("mairie_bonus").setPlaceholder("Choisir un membre"))],
      });

    case "allowances":
      return interaction.showModal(
        modal("mairie_m_allowances", "🤝 Allocations hebdomadaires (€)", [
          ["social", "Membres en situation délicate", TextInputStyle.Short, s.allowances.social],
          ["universal", "Tous les membres (7 jours et +)", TextInputStyle.Short, s.allowances.universal],
          ["welcome", "Nouveaux membres (moins de 2 semaines)", TextInputStyle.Short, s.allowances.welcome],
        ])
      );

    case "amnesty":
      return interaction.reply({
        content: "🧾 Annuler la dette fiscale d'un membre, ou de tout le monde ?",
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("mairie_amnesty").setPlaceholder("Choisir un membre")),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("mairie_amnesty_all").setLabel("Amnistie générale").setEmoji("🕊️").setStyle(ButtonStyle.Danger)
          ),
        ],
      });

    case "relaunch":
      return interaction.reply({
        content: `🚀 Plan de relance : **+50 % de clients** pendant ${RELAUNCH_DAYS} jours dans un secteur, pour ${formatEuro(RELAUNCH_COST)}.`,
        ephemeral: true,
        components: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("mairie_relaunch")
              .setPlaceholder("Choisir un secteur")
              .addOptions(Object.entries(SECTORS).map(([id, sec]) => ({ label: sec.label, value: id })))
          ),
        ],
      });

    case "event": {
      const events = Object.values(s.events);
      const rows = [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("mairie_event_new").setLabel("Organiser un événement").setEmoji("🎉").setStyle(ButtonStyle.Success)
        ),
      ];
      if (events.length) {
        rows.push(
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("mairie_event_pick")
              .setPlaceholder("Gérer un événement en cours")
              .addOptions(events.slice(0, 25).map((e) => ({ label: e.title.slice(0, 100), value: e.id, description: `Cagnotte restante : ${formatEuro(e.remaining)}` })))
          )
        );
      }
      return interaction.reply({ content: `🎉 **${events.length}** événement(s) en cours.`, components: rows, ephemeral: true });
    }
  }
}

async function applyLever(interaction, key, client) {
  const lever = LEVERS[key];
  const raw = interaction.fields.getTextInputValue("valeur").replace(",", ".").replace(/[^\d.]/g, "");
  let value = parseFloat(raw);
  if (!Number.isFinite(value)) return interaction.reply({ content: "❌ Valeur invalide.", ephemeral: true });
  if (lever.percent) value /= 100;
  const before = P()[key];
  const after = setLever(key, value);
  count("taxChanges");
  await journal(
    client,
    "⚖️ Arrêté fiscal",
    `${regime() === "dictature" ? "Le Régime" : `Le maire **${pseudo(interaction.user.id)}**`} fixe **${lever.label}** à **${formatLever(key, after)}** (avant : ${formatLever(key, before)}).`,
    after > before ? 0xe74c3c : 0x2ecc71
  );
  await refreshPanels(client);
  await require("./impots").refreshPanel(client).catch(() => null);
  await interaction.reply({ content: `⚖️ ${lever.label} : **${formatLever(key, before)} → ${formatLever(key, after)}**.`, ephemeral: true });
}

// --- Routage ---

async function handleMairieInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("mairie_")) return false;
  load();
  const s = state;
  const userId = interaction.user.id;
  const official = isMayor(userId) || isAdjoint(userId);
  const deny = () => interaction.reply({ content: "❌ Réservé au maire et à son adjoint.", ephemeral: true });

  if (id.startsWith("mairie_poll_")) {
    await votePoll(interaction);
    return true;
  }
  if (id === "mairie_run") {
    const err = await checkCandidate(interaction.member);
    if (err) await interaction.reply({ content: err, ephemeral: true });
    else {
      await interaction.showModal(
        modal("mairie_m_run", "📝 Ma candidature", [
          ["slogan", "Slogan", TextInputStyle.Short, undefined, 80],
          ["programme", "Programme", TextInputStyle.Paragraph, undefined, 2000],
        ])
      );
    }
  } else if (id === "mairie_m_run") await registerCandidate(interaction, client);
  else if (id === "mairie_adjoint") await chooseAdjoint(interaction, client);
  else if (id === "mairie_withdraw") await withdraw(interaction, client);
  else if (id === "mairie_vote") await showVote(interaction);
  else if (id === "mairie_ballot") await castVote(interaction, client);
  else if (id === "mairie_petition") await signPetition(interaction, client);
  else if (id === "mairie_ref_yes" || id === "mairie_ref_no") await referendumVote(interaction, id === "mairie_ref_yes");
  else if (id === "mairie_staff") {
    if (!isGerant(interaction.member)) { await interaction.reply({ content: "❌ Réservé aux gérants.", ephemeral: true }); return true; }
    await interaction.reply({
      content: "🛠️ Actions staff (en cas d'abus) :",
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId("mairie_staff_revoke").setLabel("Révoquer le maire").setStyle(ButtonStyle.Danger).setDisabled(!s.mayor),
          new ButtonBuilder().setCustomId("mairie_staff_cancel").setLabel("Annuler l'élection en cours").setStyle(ButtonStyle.Danger).setDisabled(!currentElection() || currentElection().done)
        ),
      ],
    });
  } else if (id === "mairie_staff_revoke" || id === "mairie_staff_cancel") {
    if (!isGerant(interaction.member)) { await interaction.reply({ content: "❌ Réservé aux gérants.", ephemeral: true }); return true; }
    if (id === "mairie_staff_revoke" && s.mayor) {
      await journal(client, "🛠️ Maire révoqué par le staff", `**${pseudo(s.mayor.userId)}** a été révoqué(e) par **${pseudo(interaction.user.id)}**.\n\n${mandateReport(s.mayor)}`, 0xe74c3c);
      await installMayor(client, null, null);
    } else if (id === "mairie_staff_cancel") {
      const election = currentElection();
      for (const cid of Object.keys(election?.candidates ?? {})) changeBalance(cid, CAUTION, "Caution remboursée (élection annulée)", { force: true });
      if (election) {
        election.candidates = {};
        election.votes = {};
        election.done = true;
        save();
      }
      await journal(client, "🛠️ Élection annulée par le staff", `Décision de **${pseudo(interaction.user.id)}**. Les cautions ont été remboursées.`, 0xe74c3c);
    }
    await refreshPanels(client);
    await interaction.update({ content: "✅ Fait.", components: [] });
  }

  // Bureau
  else if (id.startsWith("mairie_b_")) await bureauAction(interaction, id.slice("mairie_b_".length), client);
  else if (!official) await deny();
  else if (id.startsWith("mairie_r_") || id === "mairie_regime") await handleRegimeInteraction(interaction, client);
  else if (id === "mairie_lever") {
    if (!isMayor(userId)) { await interaction.reply({ content: "❌ Seul le maire fixe les taux.", ephemeral: true }); return true; }
    const key = interaction.values[0];
    const l = LEVERS[key];
    const current = P()[key];
    await interaction.showModal(
      modal(`mairie_m_lever_${key}`, l.label.slice(0, 45), [
        [
          "valeur",
          `${l.percent ? "En %" : l.factor ? "Multiplicateur" : "En €"} — de ${l.percent ? l.min * 100 : l.min} à ${l.percent ? l.max * 100 : l.max}`,
          TextInputStyle.Short,
          l.percent ? Math.round(current * 1000) / 10 : current,
        ],
      ])
    );
  } else if (id.startsWith("mairie_m_lever_")) {
    if (!isMayor(userId)) { await interaction.reply({ content: "❌ Seul le maire fixe les taux.", ephemeral: true }); return true; }
    await applyLever(interaction, id.slice("mairie_m_lever_".length), client);
  } else if (id === "mairie_m_decree") {
    const title = interaction.fields.getTextInputValue("titre").trim();
    const text = interaction.fields.getTextInputValue("texte").trim();
    count("decrees");
    await journal(client, `📜 Arrêté municipal — ${title}`, `${text}\n\n${sign(userId, true)}`);
    await interaction.reply({ content: "📜 Arrêté publié au Journal officiel.", ephemeral: true });
  } else if (id === "mairie_subsidy") {
    await interaction.showModal(modal(`mairie_m_subsidy_${interaction.values[0]}`, "🏢 Subvention", [["montant", "Montant (€)"], ["motif", "Motif", TextInputStyle.Paragraph, undefined, 300]]));
  } else if (id.startsWith("mairie_m_subsidy_")) {
    const companyId = id.slice("mairie_m_subsidy_".length);
    const value = amount(interaction);
    const motif = interaction.fields.getTextInputValue("motif").trim();
    const company = listActiveCompanies().find((c) => c.id === companyId);
    if (!company || value <= 0) { await interaction.reply({ content: "❌ Subvention impossible.", ephemeral: true }); return true; }
    if (!budgetMove(-value, `Subvention à ${company.name}`)) { await interaction.reply({ content: `❌ Budget insuffisant (${formatEuro(s.budget)}).`, ephemeral: true }); return true; }
    creditCompany(companyId, value, `Subvention de la Mairie — ${motif}`.slice(0, 120));
    count("subsidies");
    await journal(client, "🏢 Subvention", `**${formatEuro(value)}** versés à **${company.name}**.\nMotif : ${motif}\n\n${sign(userId)}`);
    await refreshPanels(client);
    await interaction.reply({ content: `🏢 ${formatEuro(value)} versés à ${company.name}.`, ephemeral: true });
  } else if (id === "mairie_bonus") {
    await interaction.showModal(modal(`mairie_m_bonus_${interaction.values[0]}`, "🎁 Prime", [["montant", "Montant (€)"], ["motif", "Motif", TextInputStyle.Paragraph, undefined, 300]]));
  } else if (id.startsWith("mairie_m_bonus_")) {
    const target = id.slice("mairie_m_bonus_".length);
    const value = amount(interaction);
    const motif = interaction.fields.getTextInputValue("motif").trim();
    if (value <= 0 || target === userId) { await interaction.reply({ content: "❌ Prime impossible (vous ne pouvez pas vous verser de prime).", ephemeral: true }); return true; }
    if (isFrozen(target)) { await interaction.reply({ content: "🔒 Ce compte est gelé par l'IRF : aucune prime possible.", ephemeral: true }); return true; }
    if (!budgetMove(-value, `Prime à ${target}`)) { await interaction.reply({ content: `❌ Budget insuffisant (${formatEuro(s.budget)}).`, ephemeral: true }); return true; }
    changeBalance(target, value, `Prime de la Mairie — ${motif}`.slice(0, 120));
    count("bonuses");
    await journal(client, "🎁 Prime", `**${formatEuro(value)}** versés à **${pseudo(target)}**.\nMotif : ${motif}\n\n${sign(userId)}`);
    await refreshPanels(client);
    await refreshRichestLeaderboard(client).catch(() => null);
    await interaction.reply({ content: `🎁 Prime de ${formatEuro(value)} versée à **${pseudo(target)}**.`, ephemeral: true });
  } else if (id === "mairie_m_allowances") {
    const before = { ...s.allowances };
    for (const k of ["social", "universal", "welcome"]) s.allowances[k] = Math.min(5000, amount(interaction, k));
    save();
    await journal(
      client,
      "🤝 Allocations hebdomadaires",
      `Situation délicate : ${formatEuro(before.social)} → **${formatEuro(s.allowances.social)}**\n` +
        `Tous les membres : ${formatEuro(before.universal)} → **${formatEuro(s.allowances.universal)}**\n` +
        `Nouveaux membres : ${formatEuro(before.welcome)} → **${formatEuro(s.allowances.welcome)}**\n\nVersées chaque dimanche sur le budget municipal.\n${sign(userId)}`
    );
    await refreshPanels(client);
    await interaction.reply({ content: "🤝 Allocations mises à jour (versées chaque dimanche).", ephemeral: true });
  } else if (id === "mairie_amnesty") {
    const target = interaction.values[0];
    const debt = getTaxDebt(target);
    if (!debt) { await interaction.update({ content: `**${pseudo(target)}** n'a pas de dette fiscale.`, components: [] }); return true; }
    setTaxDebt(target, null);
    await journal(client, "🕊️ Amnistie fiscale", `La dette fiscale de **${pseudo(target)}** (**${formatEuro(debt.amount)}**) est annulée.\n${sign(userId)}`);
    await interaction.update({ content: `🕊️ Dette de ${formatEuro(debt.amount)} annulée.`, components: [] });
  } else if (id === "mairie_amnesty_all") {
    const debts = Object.entries(loadEconomie().taxDebts);
    const total = debts.reduce((sum, [, d]) => sum + d.amount, 0);
    for (const [uid] of debts) setTaxDebt(uid, null);
    await journal(client, "🕊️ Amnistie fiscale générale", `**${debts.length}** dette(s) annulée(s), pour un total de **${formatEuro(round2(total))}**.\n${sign(userId)}`);
    await interaction.update({ content: `🕊️ ${debts.length} dette(s) annulée(s).`, components: [] });
  } else if (id === "mairie_relaunch") {
    const sector = interaction.values[0];
    if (!budgetMove(-RELAUNCH_COST, `Plan de relance — ${SECTORS[sector].label}`)) {
      { await interaction.update({ content: `❌ Budget insuffisant (${formatEuro(s.budget)} / ${formatEuro(RELAUNCH_COST)}).`, components: [] }); return true; }
    }
    const until = Date.now() + RELAUNCH_DAYS * 24 * 60 * 60 * 1000;
    boostSector(sector, until);
    await journal(client, "🚀 Plan de relance", `Secteur **${SECTORS[sector].label}** : **+50 % de clients** jusqu'au ${ts(until, "F")}.\nCoût : ${formatEuro(RELAUNCH_COST)}\n${sign(userId)}`, 0x2ecc71);
    await refreshPanels(client);
    await interaction.update({ content: `🚀 Plan de relance lancé pour ${SECTORS[sector].label}.`, components: [] });
  } else if (id === "mairie_event_new") {
    await interaction.showModal(
      modal("mairie_m_event", "🎉 Organiser un événement", [
        ["titre", "Nom de l'événement", TextInputStyle.Short, undefined, 80],
        ["description", "Description, règles, date", TextInputStyle.Paragraph, undefined, 1500],
        ["montant", "Cagnotte (€, prise sur le budget)"],
      ])
    );
  } else if (id === "mairie_m_event") {
    const pot = amount(interaction);
    const title = interaction.fields.getTextInputValue("titre").trim();
    if (!budgetMove(-pot, `Cagnotte — ${title}`)) { await interaction.reply({ content: `❌ Budget insuffisant (${formatEuro(s.budget)}).`, ephemeral: true }); return true; }
    const eid = nextId("ev");
    s.events[eid] = { id: eid, title, pot, remaining: pot };
    save();
    await journal(client, `🎉 Événement — ${title}`, `${interaction.fields.getTextInputValue("description").trim()}\n\n💰 Cagnotte : **${formatEuro(pot)}**\n${sign(userId)}`, 0x9b59b6);
    await refreshPanels(client);
    await interaction.reply({ content: `🎉 Événement créé avec ${formatEuro(pot)} de cagnotte. Gérez les gains depuis le bouton Événement.`, ephemeral: true });
  } else if (id === "mairie_event_pick") {
    const e = s.events[interaction.values[0]];
    if (!e) { await interaction.update({ content: "❌ Événement introuvable.", components: [] }); return true; }
    await interaction.update({
      content: `🎉 **${e.title}** — cagnotte restante : **${formatEuro(e.remaining)}**`,
      components: [
        new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`mairie_event_win_${e.id}`).setPlaceholder("🏆 Verser un gain à…")),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`mairie_event_close_${e.id}`).setLabel("Clôturer (le reste retourne au budget)").setEmoji("🏁").setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  } else if (id.startsWith("mairie_event_win_")) {
    const eid = id.slice("mairie_event_win_".length);
    await interaction.showModal(modal(`mairie_m_win_${eid}_${interaction.values[0]}`, "🏆 Gain d'événement", [["montant", "Montant (€)"]]));
  } else if (id.startsWith("mairie_m_win_")) {
    const [, , , eid, target] = id.split("_");
    const e = s.events[eid];
    const value = amount(interaction);
    if (e && isFrozen(target)) { await interaction.reply({ content: "🔒 Ce compte est gelé par l'IRF : aucun gain possible.", ephemeral: true }); return true; }
    if (!e || value <= 0 || value > e.remaining) { await interaction.reply({ content: `❌ Montant invalide (reste ${formatEuro(e?.remaining ?? 0)}).`, ephemeral: true }); return true; }
    e.remaining = round2(e.remaining - value);
    save();
    changeBalance(target, value, `Gain — ${e.title}`.slice(0, 120));
    await journal(client, `🏆 ${e.title}`, `**${pseudo(target)}** remporte **${formatEuro(value)}** !`, 0x9b59b6);
    await refreshRichestLeaderboard(client).catch(() => null);
    await interaction.reply({ content: `🏆 ${formatEuro(value)} versés à **${pseudo(target)}**. Reste : ${formatEuro(e.remaining)}.`, ephemeral: true });
  } else if (id.startsWith("mairie_event_close_")) {
    const e = s.events[id.slice("mairie_event_close_".length)];
    if (!e) { await interaction.update({ content: "❌ Événement introuvable.", components: [] }); return true; }
    delete s.events[e.id];
    save();
    if (e.remaining > 0) budgetMove(e.remaining, `Reste de la cagnotte — ${e.title}`);
    await journal(client, `🏁 Fin de l'événement — ${e.title}`, `Distribué : ${formatEuro(round2(e.pot - e.remaining))} · Retour au budget : ${formatEuro(e.remaining)}`, 0x9b59b6);
    await refreshPanels(client);
    await interaction.update({ content: "🏁 Événement clôturé.", components: [] });
  } else return false;
  return true;
}

// --- Régimes politiques ---

async function showRegimePowers(interaction, mayor) {
  const r = regime();
  const s = load();
  const row = new ActionRowBuilder();
  let text;

  if (r === "democratie") {
    text = "🗳️ **Démocratie** : consultez les citoyens sur une question. Le vote dure 48 h et le résultat est publié au Journal officiel.";
    row.addComponents(
      new ButtonBuilder().setCustomId("mairie_r_poll").setLabel("Lancer un vote citoyen").setEmoji("🗳️").setStyle(ButtonStyle.Primary)
    );
  } else if (r === "monarchie") {
    const nobles = Object.entries(s.nobles ?? {});
    text =
      "👑 **Monarchie** : distribuez des titres de noblesse.\n\n" +
      (nobles.length ? nobles.map(([uid, t]) => `${NOBLE_TITLES[t]} — **${pseudo(uid)}**`).join("\n") : "*Aucun noble pour le moment.*");
    row.addComponents(
      new ButtonBuilder().setCustomId("mairie_r_title").setLabel("Anoblir un membre").setEmoji("🎖️").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("mairie_r_untitle").setLabel("Retirer un titre").setEmoji("✖️").setStyle(ButtonStyle.Secondary).setDisabled(!nobles.length)
    );
  } else if (r === "dictature") {
    if (!mayor) return interaction.reply({ content: "❌ Seul le dictateur exerce ces pouvoirs.", ephemeral: true });
    text =
      "⚔️ **Dictature** : vos pouvoirs spéciaux.\n\n" +
      `🌙 Couvre-feu : **${curfew() ? "en cours" : "levé"}** (casino fermé, plus de voyageurs Airbnb)\n` +
      `💰 Confiscation : jusqu'à **${Math.round(CONFISCATION_MAX * 100)} %** du solde, une fois par semaine et par personne\n` +
      "⛔ Suspension d'une entreprise\n" +
      "🤐 Censure : vos actes au Journal officiel ne sont plus signés";
    row.addComponents(
      new ButtonBuilder().setCustomId("mairie_r_curfew").setLabel(curfew() ? "Lever le couvre-feu" : "Décréter le couvre-feu").setEmoji("🌙").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("mairie_r_confiscate").setLabel("Confisquer").setEmoji("💰").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("mairie_r_suspend").setLabel("Suspendre une entreprise").setEmoji("⛔").setStyle(ButtonStyle.Danger)
    );
  } else {
    return interaction.reply({ content: "🏴 **Anarchie** : aucun pouvoir spécial. Il vous reste les événements, les arrêtés et les associations.", ephemeral: true });
  }
  return interaction.reply({ content: text, components: [row], ephemeral: true });
}

// Retire tous les titres de noblesse (fin de la monarchie ou nouveau maire).
async function clearNobility(client) {
  const s = load();
  const nobles = Object.keys(s.nobles ?? {});
  if (!nobles.length) return;
  const guild = await getGuild(client);
  for (const [, title] of Object.entries(NOBLE_TITLES)) {
    const role = guild?.roles.cache.find((r) => r.name === title);
    if (!role) continue;
    for (const uid of nobles) {
      const m = await guild.members.fetch(uid).catch(() => null);
      await m?.roles.remove(role).catch(() => null);
    }
  }
  s.nobles = {};
  save();
}

async function changeRegime(interaction, client) {
  if (!isMayor(interaction.user.id)) return interaction.update({ content: "❌ Seul le maire choisit le régime.", components: [] });
  const s = load();
  const next = interaction.values[0];
  const before = regime();
  if (next === before) return interaction.update({ content: "ℹ️ C'est déjà le régime en vigueur.", components: [] });
  if (Date.now() < (s.regimeLockedUntil ?? 0)) {
    return interaction.update({ content: `⏳ Prochain changement possible ${ts(s.regimeLockedUntil, "R")}.`, components: [] });
  }
  if (before === "monarchie") await clearNobility(client);
  setRegime(next);
  s.regimeLockedUntil = Date.now() + REGIME_COOLDOWN_MS;
  save();

  const r = REGIMES[next];
  await journal(
    client,
    `${r.emoji} Changement de régime : ${r.name}`,
    `${REGIMES[before].emoji} ${REGIMES[before].name} → **${r.emoji} ${r.name}**\n\n*${r.description}*\n\n${next === "dictature" ? "— *Le Régime*" : `— **${pseudo(interaction.user.id)}**, ${r.title.toLowerCase()}`}`,
    next === "dictature" ? 0x2c2c2c : next === "anarchie" ? 0x7f8c8d : 0xf1c40f
  );
  const elections = await channel(client, "electionsChannelId");
  await elections?.send({ content: `${r.emoji} **La Maison passe en ${r.name.toLowerCase()}.** ${r.description}` }).catch(() => null);
  await refreshPanels(client);
  await require("./impots").refreshPanel(client).catch(() => null);
  return interaction.update({ content: `${r.emoji} Régime instauré : **${r.name}**. Prochain changement possible dans 30 jours.`, components: [] });
}

async function handleRegimeInteraction(interaction, client) {
  const id = interaction.customId;
  const userId = interaction.user.id;
  const mayor = isMayor(userId);
  const r = regime();

  if (id === "mairie_regime") return changeRegime(interaction, client);

  // Démocratie : vote citoyen
  if (id === "mairie_r_poll") {
    if (r !== "democratie") return interaction.reply({ content: "❌ Réservé à la démocratie.", ephemeral: true });
    return interaction.showModal(
      modal("mairie_r_mpoll", "🗳️ Vote citoyen", [["question", "Question posée aux citoyens", TextInputStyle.Paragraph, undefined, 300]])
    );
  }
  if (id === "mairie_r_mpoll") {
    const question = interaction.fields.getTextInputValue("question").trim();
    const s = load();
    const pid = nextId("p");
    const until = Date.now() + POLL_MS;
    const elections = await channel(client, "electionsChannelId");
    const msg = await elections
      ?.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x3498db)
            .setTitle("🗳️ Vote citoyen")
            .setDescription(`**${question}**\n\nProposé par **${pseudo(userId)}**. Fin du vote ${ts(until, "R")}. Vote anonyme, modifiable.`),
        ],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mairie_poll_yes_${pid}`).setLabel("Pour").setEmoji("👍").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`mairie_poll_no_${pid}`).setLabel("Contre").setEmoji("👎").setStyle(ButtonStyle.Danger)
          ),
        ],
      })
      .catch(() => null);
    s.polls = { ...(s.polls ?? {}), [pid]: { question, until, votes: {}, messageId: msg?.id ?? null } };
    save();
    return interaction.reply({ content: "🗳️ Vote citoyen lancé dans le salon des élections.", ephemeral: true });
  }

  // Monarchie : titres de noblesse
  if (id === "mairie_r_title") {
    if (r !== "monarchie") return interaction.reply({ content: "❌ Réservé à la monarchie.", ephemeral: true });
    return interaction.reply({
      content: "🎖️ Quel titre accorder ?",
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("mairie_r_titletype")
            .setPlaceholder("Choisir un titre")
            .addOptions(Object.entries(NOBLE_TITLES).map(([k, label]) => ({ label: label.replace(/^\S+ /, ""), value: k, emoji: "🎖️" })))
        ),
      ],
    });
  }
  if (id === "mairie_r_titletype") {
    return interaction.update({
      content: `🎖️ ${NOBLE_TITLES[interaction.values[0]]} — à qui ?`,
      components: [
        new ActionRowBuilder().addComponents(
          new UserSelectMenuBuilder().setCustomId(`mairie_r_titleuser_${interaction.values[0]}`).setPlaceholder("Choisir un membre")
        ),
      ],
    });
  }
  if (id.startsWith("mairie_r_titleuser_")) {
    if (r !== "monarchie") return interaction.update({ content: "❌ Réservé à la monarchie.", components: [] });
    const titleKey = id.slice("mairie_r_titleuser_".length);
    const target = await interaction.guild.members.fetch(interaction.values[0]).catch(() => null);
    if (!target || target.user.bot) return interaction.update({ content: "❌ Membre introuvable.", components: [] });
    const s = load();
    const role = await findOrCreateRole(interaction.guild, { name: NOBLE_TITLES[titleKey], color: 0x9b59b6, hoist: false });
    const previous = s.nobles?.[target.id];
    if (previous && previous !== titleKey) {
      const old = interaction.guild.roles.cache.find((x) => x.name === NOBLE_TITLES[previous]);
      if (old) await target.roles.remove(old).catch(() => null);
    }
    await target.roles.add(role).catch(() => null);
    s.nobles = { ...(s.nobles ?? {}), [target.id]: titleKey };
    save();
    await journal(client, "🎖️ Anoblissement", `${target} reçoit le titre de **${NOBLE_TITLES[titleKey].replace(/^\S+ /, "")}**.\n\n${sign(userId, true)}`, 0x9b59b6);
    return interaction.update({ content: `🎖️ ${target} est anobli(e).`, components: [] });
  }
  if (id === "mairie_r_untitle") {
    const nobles = Object.entries(load().nobles ?? {});
    if (!nobles.length) return interaction.reply({ content: "Aucun noble.", ephemeral: true });
    return interaction.reply({
      content: "✖️ Retirer le titre de qui ?",
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("mairie_r_untitleuser")
            .setPlaceholder("Choisir un noble")
            .addOptions(
              nobles.slice(0, 25).map(([uid, t]) => ({
                label: (interaction.guild.members.cache.get(uid)?.displayName ?? uid).slice(0, 100),
                value: uid,
                description: NOBLE_TITLES[t].replace(/^\S+ /, ""),
              }))
            )
        ),
      ],
    });
  }
  if (id === "mairie_r_untitleuser") {
    const s = load();
    const uid = interaction.values[0];
    const title = NOBLE_TITLES[s.nobles?.[uid]];
    const role = title && interaction.guild.roles.cache.find((x) => x.name === title);
    const target = await interaction.guild.members.fetch(uid).catch(() => null);
    if (role && target) await target.roles.remove(role).catch(() => null);
    delete s.nobles[uid];
    save();
    await journal(client, "✖️ Titre retiré", `**${pseudo(uid)}** perd son titre de noblesse.\n\n${sign(userId, true)}`, 0x95a5a6);
    return interaction.update({ content: "✖️ Titre retiré.", components: [] });
  }

  // Dictature : pouvoirs spéciaux (réservés au dictateur)
  if (!mayor || r !== "dictature") {
    return interaction.reply({ content: "❌ Réservé au dictateur, sous la dictature.", ephemeral: true });
  }
  if (id === "mairie_r_curfew") {
    const on = !curfew();
    setCurfew(on);
    await journal(
      client,
      on ? "🌙 Couvre-feu" : "☀️ Fin du couvre-feu",
      on ? "Le casino est fermé et les voyageurs Airbnb ne sont plus accueillis jusqu'à nouvel ordre.\n\n— *Le Régime*" : "Le casino et l'Airbnb reprennent leur activité.\n\n— *Le Régime*",
      on ? 0x2c2c2c : 0x2ecc71
    );
    await refreshPanels(client);
    return interaction.update({ content: on ? "🌙 Couvre-feu décrété." : "☀️ Couvre-feu levé.", components: [] });
  }
  if (id === "mairie_r_confiscate") {
    return interaction.reply({
      content: `💰 Qui doit être frappé de confiscation ? (${Math.round(CONFISCATION_MAX * 100)} % maximum, une fois par semaine)`,
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("mairie_r_confiscuser").setPlaceholder("Choisir un membre"))],
    });
  }
  if (id === "mairie_r_confiscuser") {
    const target = interaction.values[0];
    const last = load().confiscations?.[target] ?? 0;
    if (Date.now() - last < CONFISCATION_COOLDOWN_MS) {
      return interaction.update({ content: `⏳ **${pseudo(target)}** a déjà subi une confiscation. Prochaine possible ${ts(last + CONFISCATION_COOLDOWN_MS, "R")}.`, components: [] });
    }
    return interaction.showModal(
      modal(`mairie_r_mconfisc_${target}`, "💰 Confiscation", [
        ["pourcentage", `Pourcentage du solde (1 à ${Math.round(CONFISCATION_MAX * 100)})`, TextInputStyle.Short, Math.round(CONFISCATION_MAX * 100), 3],
        ["motif", "Motif officiel", TextInputStyle.Paragraph, undefined, 300],
      ])
    );
  }
  if (id.startsWith("mairie_r_mconfisc_")) {
    const target = id.slice("mairie_r_mconfisc_".length);
    const s = load();
    if (Date.now() - (s.confiscations?.[target] ?? 0) < CONFISCATION_COOLDOWN_MS) {
      return interaction.reply({ content: "⏳ Confiscation déjà faite cette semaine.", ephemeral: true });
    }
    const pct = Math.min(CONFISCATION_MAX * 100, Math.max(1, amount(interaction, "pourcentage")));
    const motif = interaction.fields.getTextInputValue("motif").trim();
    const taken = round2(readBalance(target) * (pct / 100));
    if (taken <= 0) return interaction.reply({ content: "Ce membre n'a rien à confisquer.", ephemeral: true });
    changeBalance(target, -taken, `Confiscation par le régime — ${motif}`.slice(0, 120), { force: true });
    budgetMove(taken, `Confiscation (${pct} %)`);
    s.confiscations = { ...(s.confiscations ?? {}), [target]: Date.now() };
    save();
    await journal(client, "💰 Confiscation", `**${formatEuro(taken)}** (${pct} % du solde) confisqués à **${pseudo(target)}** au profit de la ville.\nMotif : ${motif}\n\n— *Le Régime*`, 0x2c2c2c);
    const user = await client.users.fetch(target).catch(() => null);
    await user?.send(`💰 Le régime vous a confisqué **${formatEuro(taken)}** (${pct} % de votre solde).\nMotif : ${motif}`).catch(() => null);
    await refreshPanels(client);
    await refreshRichestLeaderboard(client).catch(() => null);
    return interaction.reply({ content: `💰 ${formatEuro(taken)} confisqués.`, ephemeral: true });
  }
  if (id === "mairie_r_suspend") {
    const companies = listOpenCompanies();
    if (!companies.length) return interaction.reply({ content: "Aucune entreprise.", ephemeral: true });
    return interaction.reply({
      content: "⛔ Quelle entreprise suspendre ou rétablir ?",
      ephemeral: true,
      components: [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("mairie_r_suspendpick")
            .setPlaceholder("Choisir une entreprise")
            .addOptions(
              companies.slice(0, 25).map((c) => ({
                label: c.name.slice(0, 100),
                value: c.id,
                description: c.status === "frozen" ? "Suspendue : la rétablir" : "En activité : la suspendre",
                emoji: c.status === "frozen" ? "⛔" : "🟢",
              }))
            )
        ),
      ],
    });
  }
  if (id === "mairie_r_suspendpick") {
    const company = listOpenCompanies().find((c) => c.id === interaction.values[0]);
    if (!company) return interaction.update({ content: "❌ Entreprise introuvable.", components: [] });
    const suspend = company.status === "active";
    await setCompanySuspended(client, company.id, suspend, "Décision du Régime.");
    await journal(
      client,
      suspend ? "⛔ Entreprise suspendue" : "✅ Suspension levée",
      `**${company.name}** ${suspend ? "est suspendue jusqu'à nouvel ordre" : "peut reprendre son activité"}.\n\n— *Le Régime*`,
      suspend ? 0x2c2c2c : 0x2ecc71
    );
    return interaction.update({ content: suspend ? `⛔ ${company.name} est suspendue.` : `✅ ${company.name} est rétablie.`, components: [] });
  }
  return interaction.reply({ content: "❌ Action inconnue.", ephemeral: true });
}

// Vote citoyen (démocratie) : ouvert à tous les électeurs
async function votePoll(interaction) {
  const [, , choice, pid] = interaction.customId.split("_");
  const poll = load().polls?.[pid];
  if (!poll || Date.now() > poll.until) return interaction.reply({ content: "❌ Ce vote est terminé.", ephemeral: true });
  if (seniority(interaction.member) < VOTER_SENIORITY_MS) return interaction.reply({ content: "❌ Il faut être membre depuis 7 jours pour voter.", ephemeral: true });
  poll.votes[interaction.user.id] = choice === "yes";
  save();
  return interaction.reply({ content: `✅ Vote enregistré : **${choice === "yes" ? "pour" : "contre"}** (modifiable jusqu'à la fin).`, ephemeral: true });
}

async function closePolls(client) {
  const s = load();
  for (const [pid, poll] of Object.entries(s.polls ?? {})) {
    if (Date.now() < poll.until) continue;
    delete s.polls[pid];
    save();
    const votes = Object.values(poll.votes);
    const yes = votes.filter(Boolean).length;
    const no = votes.length - yes;
    const verdict = yes > no ? "✅ **Adopté**" : yes < no ? "❌ **Rejeté**" : "⚖️ **Égalité**";
    const text = `**${poll.question}**\n\n👍 Pour : **${yes}** · 👎 Contre : **${no}**\n${verdict}`;
    const elections = await channel(client, "electionsChannelId");
    const msg = poll.messageId ? await elections?.messages.fetch(poll.messageId).catch(() => null) : null;
    await msg?.edit({ embeds: [new EmbedBuilder().setColor(0x3498db).setTitle("🗳️ Vote citoyen — résultat").setDescription(text)], components: [] }).catch(() => null);
    await journal(client, "🗳️ Résultat d'un vote citoyen", text, 0x3498db);
  }
}

// --- Démarrage ---

let lastPhase = null;

async function tick(client) {
  await closePolls(client);
  const { phase } = getPhase();
  const s = load();
  if (phase !== lastPhase) {
    const previous = lastPhase;
    lastPhase = phase;
    if (previous) {
      await journal(client, "🗳️ Élections municipales", `Nouvelle étape : **${PHASE_LABELS[phase]}**.`);
    }
  }
  // Résultats : après la clôture du vote, si l'élection du trimestre n'est pas encore dépouillée
  if (phase === "mandat" && s.election && !s.election.done) await publishResults(client);
  await closeReferendum(client);
  await upsertPanel(client, "electionsChannelId", "electionPanelId", ELECTION_TITLE, electionPanel());
}

async function setupMairie(client) {
  load();
  await ensureSetup(client);
  if (state.lastTreasuryNet === undefined) {
    state.lastTreasuryNet = treasuryNet();
    save();
  }
  lastPhase = getPhase().phase;
  await refreshPanels(client);
  setInterval(() => tick(client).catch((err) => console.error("Mairie:", err.message)), 60 * 1000);
  cron.schedule("15 20 * * 0", () => weeklyBudget(client).catch((err) => console.error("Budget municipal:", err.message)), {
    timezone: "Europe/Paris",
  });
  console.log("Mairie prête");
}

function getBudget() {
  return load().budget;
}

function getCategoryId() {
  return load().categoryId ?? null;
}

// Pour /profil : fonction municipale et titre de noblesse.
function getPublicRole(userId) {
  const s = load();
  const r = REGIMES[regime()];
  let office = null;
  if (s.mayor?.userId === userId) office = `${r.emoji} ${r.title}${s.mayor.interim ? " (intérim)" : ""}`;
  else if (s.mayor?.adjointId === userId) office = "🎖️ Adjoint au maire";
  const title = s.nobles?.[userId] ? NOBLE_TITLES[s.nobles[userId]] : null;
  return { office, title };
}

module.exports = {
  setupMairie,
  handleMairieInteraction,
  getBudget,
  // Pour les associations
  getCategoryId,
  getPublicRole,
  getGuild,
  journal,
  sign,
  isMayor,
  isAdjoint,
  budgetMove,
};
