const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require("discord.js");
const {
  CASINO_ACCESS_ROLE_ID,
  ENTREPRENEUR_ROLE_ID,
  SITUATION_DELICATE_ROLE_ID,
} = require("./casino");

const CANDIDATURE_CATEGORY_ID = "1509979339649843200";
const CANDIDATURE_LOG_CHANNEL_ID = "1509980081764700271";
const ADMIN_VOTE_ROLE_ID = "1509979964651343993";
const CHEF_USER_ID = "1445816241116807238";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const QUESTION_TIMEOUT_MS = 30 * 60 * 1000;
const VOTES_REQUIRED = 2;

const CANDIDATURE_QUESTIONS = [
  {
    key: "paiement_annuel",
    prompt:
      "Êtes-vous prêt(e) à payer **1 000 € par an** pour l'hébergement à la Maison ? (Oui / Non)",
  },
  {
    key: "profil",
    prompt:
      "Venez-vous en tant que **personne en situation délicate** ou en tant qu'**entrepreneur** ? (Situation délicate / Entrepreneur)",
    choices: [
      { value: "Personne en situation délicate", match: /d[ée]licat/i },
      { value: "Entrepreneur", match: /entrepren/i },
    ],
  },
  {
    key: "parrainage",
    prompt:
      "Avez-vous été **parrainé(e)** par quelqu'un de la Maison ? Si oui, **par qui** ? (sinon répondez `Non`)",
  },
  { key: "prenom", prompt: "Quel est votre **prénom** ?" },
  { key: "age", prompt: "Quel est votre **âge** ?" },
  { key: "sexe", prompt: "Quel est votre **sexe** ?" },
  { key: "lieu", prompt: "**Pays / Ville** :" },
  { key: "presentation", prompt: "**Présentez-vous** en quelques lignes :" },
  { key: "qualites", prompt: "Quelles sont vos **qualités** ?" },
  { key: "defauts", prompt: "Quels sont vos **défauts** ?" },
  { key: "passions", prompt: "Vos **passions / loisirs** :" },
  {
    key: "situation",
    prompt: "Votre **situation actuelle** (études, travail, etc.) :",
  },
  {
    key: "motivation_pourquoi",
    prompt: "**Pourquoi** souhaitez-vous rejoindre la Maison ?",
  },
  {
    key: "motivation_connu",
    prompt: "**Comment** avez-vous connu la Maison ?",
  },
  {
    key: "motivation_attentes",
    prompt: "Qu'**attendez-vous** de la Maison ?",
  },
  {
    key: "motivation_apport",
    prompt: "Que pouvez-vous **apporter** à la communauté ?",
  },
  {
    key: "motivation_accepter",
    prompt: "**Pourquoi** devrions-nous vous accepter ?",
  },
  { key: "actif_discord", prompt: "Êtes-vous **actif sur Discord** ?" },
  {
    key: "heures",
    prompt: "Combien d'**heures par jour** pouvez-vous être présent ?",
  },
  {
    key: "groupe",
    prompt: "Savez-vous **travailler en groupe** et respecter des règles ?",
  },
  {
    key: "conflits",
    prompt: "Comment réagissez-vous dans les **conflits** ?",
  },
  {
    key: "reglement",
    prompt: "Acceptez-vous le **règlement** de la Maison ? (Oui / Non)",
  },
  {
    key: "respect_staff",
    prompt:
      "Êtes-vous prêt à **respecter le staff** et les autres membres ? (Oui / Non)",
  },
  {
    key: "privilege",
    prompt:
      "Comprenez-vous que l'hébergement est un **privilège** et non un droit ? (Oui / Non)",
  },
  {
    key: "photo",
    prompt:
      "**Photo / avatar** (facultatif — envoyez un fichier ou tapez `passer`) :",
    optional: true,
  },
  {
    key: "reseaux",
    prompt: "**Réseaux sociaux** (facultatif — tapez `passer` pour ignorer) :",
    optional: true,
  },
  {
    key: "autres",
    prompt:
      "**Autres informations utiles** (facultatif — tapez `passer` pour ignorer) :",
    optional: true,
  },
];

// Bouton « Fermer le ticket » (géré par index.js) et suppression automatique après la décision.
const CLOSE_TICKET_BUTTON_ID = "close_ticket";
const DELETE_AFTER_DECISION_MS = 24 * 60 * 60 * 1000;

function closeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(CLOSE_TICKET_BUTTON_ID).setLabel("Fermer le ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger)
  );
}

function scheduleTicketDeletion(channel, closedAt) {
  const remaining = closedAt + DELETE_AFTER_DECISION_MS - Date.now();
  const run = () => require("./tickets").closeTicket(channel, { reason: "Candidature terminée depuis 24 h" });
  if (remaining <= 0) run();
  else setTimeout(run, remaining).unref?.();
}

const activeSessions = new Map();
const candidatureVotes = new Map();
const reminderTimeouts = new Map();

// Progression des questionnaires et votes enregistrés sur disque,
// pour survivre aux redémarrages du bot.
const STATE_FILE = require("./data").dataFile("candidature-state.json");
let saved = { sessions: {}, votes: {} };
try {
  saved = { sessions: {}, votes: {}, ...JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) };
} catch {
  // premier démarrage
}
for (const [channelId, v] of Object.entries(saved.votes)) {
  candidatureVotes.set(channelId, { ...v, pour: new Set(v.pour), contre: new Set(v.contre) });
}

function persist() {
  saved.votes = Object.fromEntries(
    [...candidatureVotes.entries()].map(([id, v]) => [id, { ...v, pour: [...v.pour], contre: [...v.contre] }])
  );
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(saved, null, 2));
  } catch (err) {
    console.error("Sauvegarde candidatures:", err.message);
  }
}

function saveProgress(channelId, memberId, index, answers) {
  if (index === null) delete saved.sessions[channelId];
  else saved.sessions[channelId] = { memberId, index, answers };
  persist();
}

function voteButtonIds(channelId, chef = false) {
  const prefix = chef ? "candidature_chef" : "candidature";
  return {
    pour: `${prefix}_pour_${channelId}`,
    contre: `${prefix}_contre_${channelId}`,
  };
}

function parseVoteCustomId(customId) {
  const patterns = [
    { prefix: "candidature_chef_pour_", type: "pour", chef: true },
    { prefix: "candidature_chef_contre_", type: "contre", chef: true },
    { prefix: "candidature_pour_", type: "pour", chef: false },
    { prefix: "candidature_contre_", type: "contre", chef: false },
  ];

  for (const p of patterns) {
    if (customId.startsWith(p.prefix)) {
      return {
        type: p.type,
        chef: p.chef,
        channelId: customId.slice(p.prefix.length),
      };
    }
  }
  return null;
}

function isCandidatureCategory(parentId) {
  return parentId === CANDIDATURE_CATEGORY_ID;
}

function getVoteState(channelId) {
  if (!candidatureVotes.has(channelId)) {
    candidatureVotes.set(channelId, {
      pour: new Set(),
      contre: new Set(),
      logMessageId: null,
      round: 1,
      status: "voting",
      answers: null,
      memberId: null,
    });
  }
  return candidatureVotes.get(channelId);
}

function buildVoteRow(channelId, chef = false) {
  const ids = voteButtonIds(channelId, chef);
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(ids.pour)
      .setLabel("Pour")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(ids.contre)
      .setLabel("Contre")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );
}

function fieldBlock(lines) {
  return lines
    .map(([label, val]) => `**${label} :** ${(val || "—").toString()}`)
    .join("\n")
    .slice(0, 1024);
}

function buildCandidatureResultEmbed(member, answers) {
  return new EmbedBuilder()
    .setColor(0x800020)
    .setTitle(`📋 Candidature — ${member.user.tag}`)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setDescription(
      `${member}\n*Candidature complète — votes anonymes (2 requis)*`
    )
    .addFields(
      {
        name: "💶 Engagement financier",
        value: fieldBlock([["Paiement 1 000 € / an", answers.paiement_annuel]]),
      },
      {
        name: "🤝 Profil & parrainage",
        value: fieldBlock([
          ["Vient en tant que", answers.profil],
          ["Parrainé(e) par", answers.parrainage],
        ]),
      },
      {
        name: "👤 Informations personnelles",
        value: fieldBlock([
          ["Prénom", answers.prenom],
          ["Âge", answers.age],
          ["Sexe", answers.sexe],
          ["Pays / Ville", answers.lieu],
        ]),
      },
      {
        name: "🏠 À propos de vous",
        value: fieldBlock([
          ["Présentation", answers.presentation],
          ["Qualités", answers.qualites],
          ["Défauts", answers.defauts],
          ["Passions / loisirs", answers.passions],
          ["Situation", answers.situation],
        ]),
      },
      {
        name: "🎯 Motivation",
        value: fieldBlock([
          ["Pourquoi rejoindre", answers.motivation_pourquoi],
          ["Comment connu", answers.motivation_connu],
          ["Attentes", answers.motivation_attentes],
          ["Apport", answers.motivation_apport],
          ["Pourquoi accepter", answers.motivation_accepter],
        ]),
      },
      {
        name: "🧠 Comportement & activité",
        value: fieldBlock([
          ["Actif Discord", answers.actif_discord],
          ["Heures / jour", answers.heures],
          ["Travail en groupe", answers.groupe],
          ["Conflits", answers.conflits],
        ]),
      },
      {
        name: "🔒 Engagement",
        value: fieldBlock([
          ["Règlement", answers.reglement],
          ["Respect staff", answers.respect_staff],
          ["Privilège hébergement", answers.privilege],
        ]),
      },
      {
        name: "📸 Facultatif",
        value: fieldBlock([
          ["Photo / avatar", answers.photo || "Non renseigné"],
          ["Réseaux", answers.reseaux || "Non renseigné"],
          ["Autres", answers.autres || "Non renseigné"],
        ]),
      }
    )
    .setTimestamp();
}

function buildWaitingEmbed() {
  return new EmbedBuilder()
    .setColor(0x800020)
    .setTitle("📋 Candidature envoyée")
    .setDescription(
      "✅ Votre formulaire a bien été transmis à l'administration.\n\n" +
        "**En attente de vos résultats.**\n\n" +
        "Vous serez informé(e) ici dès qu'une décision aura été prise.\n" +
        "*Merci pour votre patience.* 🦋"
    );
}

async function clearChannel(channel) {
  for (let i = 0; i < 6; i++) {
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size === 0) break;
    const deletable = messages.filter(
      (m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000
    );
    if (deletable.size > 1) {
      await channel.bulkDelete(deletable, true).catch(() => null);
    } else if (deletable.size === 1) {
      await deletable.first().delete().catch(() => null);
    }
    for (const msg of messages.values()) {
      if (!deletable.has(msg.id)) await msg.delete().catch(() => null);
    }
    if (messages.size < 100) break;
  }
}

async function updateLogVoteMessage(channel, guild, stats, extraFooter) {
  if (!stats.logMessageId) return;
  const logChannel = guild.channels.cache.get(CANDIDATURE_LOG_CHANNEL_ID);
  if (!logChannel?.isTextBased()) return;

  const msg = await logChannel.messages.fetch(stats.logMessageId).catch(() => null);
  if (!msg) return;

  const member = await guild.members.fetch(stats.memberId).catch(() => null);
  if (!member) return;

  const embed = buildCandidatureResultEmbed(member, stats.answers);
  if (extraFooter) embed.setFooter({ text: extraFooter });

  let components = [];
  if (stats.status === "voting" || stats.status === "round2") {
    components = [buildVoteRow(channel.id)];
  } else if (stats.status === "awaiting_chef") {
    components = [buildVoteRow(channel.id, true)];
  }

  await msg.edit({ embeds: [embed], components }).catch(() => null);
}

async function notifyCandidateResult(channel, accepted, reason) {
  const embed = new EmbedBuilder()
    .setColor(accepted ? 0x2ecc71 : 0xe74c3c)
    .setTitle(accepted ? "✅ Candidature acceptée" : "❌ Candidature refusée")
    .setDescription(
      accepted
        ? "Félicitations ! Votre candidature a été **acceptée**.\nUn membre du staff vous contactera prochainement."
        : `Votre candidature n'a pas été retenue.\n${reason || "Merci pour votre intérêt."}`
    )
    .setFooter({ text: "Ce ticket sera supprimé automatiquement dans 24 h." })
    .setTimestamp();

  await channel.send({ embeds: [embed], components: [closeRow()] }).catch(() => null);
}

async function closeCandidatureVoting(channel, guild, stats) {
  const timeout = reminderTimeouts.get(channel.id);
  if (timeout) {
    clearTimeout(timeout);
    reminderTimeouts.delete(channel.id);
  }

  if (stats.logMessageId) {
    const logChannel = guild.channels.cache.get(CANDIDATURE_LOG_CHANNEL_ID);
    const msg = await logChannel?.messages
      .fetch(stats.logMessageId)
      .catch(() => null);
    if (msg) await msg.edit({ components: [] }).catch(() => null);
  }

  const closedAt = Date.now();
  await channel
    .setTopic(`${channel.topic}:closed:${closedAt}`)
    .catch(() => null);
  scheduleTicketDeletion(channel, closedAt);
}

// Donne le rôle correspondant au profil choisi dans le formulaire.
// Les entrepreneurs ont aussi directement accès au casino.
async function assignProfileRoles(guild, stats) {
  const member = await guild.members.fetch(stats.memberId).catch(() => null);
  if (!member) return;
  const profil = stats.answers?.profil;
  if (profil === "Entrepreneur") {
    await member.roles.add([ENTREPRENEUR_ROLE_ID, CASINO_ACCESS_ROLE_ID]).catch(() => null);
  } else if (profil === "Personne en situation délicate") {
    await member.roles.add(SITUATION_DELICATE_ROLE_ID).catch(() => null);
  }
}

// Loi d'accueil : la ville offre une prime à chaque nouveau membre accepté
async function payWelcomePrime(memberId, channel) {
  const politique = require("./politique");
  if (!memberId || !politique.lawActive("primeBienvenue")) return;
  const amount = politique.lawParam("primeBienvenue");
  const mairie = require("./mairie");
  if (!mairie.budgetMove(-amount, `Prime de bienvenue (loi) — ${memberId}`)) return; // budget de la ville insuffisant
  require("./economie").changeBalance(memberId, amount, "Prime de bienvenue de la ville (loi d'accueil)");
  await channel.send(`🎁 **Loi d'accueil** : la ville vous offre **${amount.toLocaleString("fr-FR")} €** pour bien démarrer !`).catch(() => null);
}

async function finalizeCandidature(channel, guild, stats, accepted, reason) {
  stats.status = accepted ? "accepted" : "rejected";
  persist();
  if (accepted) await assignProfileRoles(guild, stats);
  if (accepted) await payWelcomePrime(stats.memberId, channel);
  await notifyCandidateResult(channel, accepted, reason);
  await updateLogVoteMessage(
    channel,
    guild,
    stats,
    accepted ? "Décision : Acceptée" : "Décision : Refusée"
  );
  await closeCandidatureVoting(channel, guild, stats);
}

async function startSecondRound(channel, guild, stats) {
  stats.pour.clear();
  stats.contre.clear();
  stats.round = 2;
  stats.status = "round2";

  await updateLogVoteMessage(
    channel,
    guild,
    stats,
    "⚖️ Égalité — Second tour (2 votes anonymes requis)"
  );

  const logChannel = guild.channels.cache.get(CANDIDATURE_LOG_CHANNEL_ID);
  if (logChannel?.isTextBased()) {
    await logChannel
      .send(
        `⚖️ **Second tour** pour la candidature <#${channel.id}> — égalité au premier vote.`
      )
      .catch(() => null);
  }
}

async function requestChefDecision(channel, guild, stats, member) {
  stats.status = "awaiting_chef";
  stats.pour.clear();
  stats.contre.clear();

  await updateLogVoteMessage(
    channel,
    guild,
    stats,
    "👑 Égalité au 2e tour — En attente de la cheffe"
  );

  const logChannel = guild.channels.cache.get(CANDIDATURE_LOG_CHANNEL_ID);
  if (logChannel?.isTextBased()) {
    await logChannel
      .send(
        `👑 **Décision cheffe requise** — égalité sur la candidature de ${member} (<#${channel.id}>).`
      )
      .catch(() => null);
  }

  const chef = await guild.members.fetch(CHEF_USER_ID).catch(() => null);
  if (chef) {
    await chef
      .send(
        `👑 **Décision requise**\n\n` +
          `Égalité au second tour pour la candidature de **${member.user.tag}**.\n` +
          `Salon logs : <#${CANDIDATURE_LOG_CHANNEL_ID}>\n` +
          `Ticket : ${channel}\n\n` +
          `Utilisez les boutons **Pour** / **Contre** sur le message de vote (réservés à vous).`
      )
      .catch(() => null);
  }
}

async function evaluateVotes(channel, guild, stats, member) {
  const total = stats.pour.size + stats.contre.size;
  if (total < VOTES_REQUIRED) return;

  const pour = stats.pour.size;
  const contre = stats.contre.size;

  if (pour > contre) {
    await finalizeCandidature(channel, guild, stats, true);
    return;
  }
  if (contre > pour) {
    await finalizeCandidature(channel, guild, stats, false);
    return;
  }

  if (stats.round === 1) {
    await startSecondRound(channel, guild, stats);
    return;
  }

  await requestChefDecision(channel, guild, stats, member);
}

async function notifyAdminsPending(guild, channel, member) {
  const role = guild.roles.cache.get(ADMIN_VOTE_ROLE_ID);
  if (!role) return;

  const text =
    `⏰ **Rappel candidature**\n\n` +
    `La candidature de **${member.user.tag}** est en attente depuis **plus de 3 jours**.\n` +
    `Salon de vote : <#${CANDIDATURE_LOG_CHANNEL_ID}>\n` +
    `Ticket : ${channel}`;

  for (const [, admin] of role.members) {
    await admin.send(text).catch(() => null);
  }
}

function scheduleCandidatureReminder(channel, member) {
  const existing = reminderTimeouts.get(channel.id);
  if (existing) clearTimeout(existing);

  const timeout = setTimeout(async () => {
    const ch = await channel.guild.channels.fetch(channel.id).catch(() => null);
    if (!ch?.topic?.startsWith("candidature:vote:")) return;
    if (ch.topic.includes(":closed") || ch.topic.includes(":reminded")) return;
    const m = await channel.guild.members.fetch(member.id).catch(() => null);
    if (m) await notifyAdminsPending(channel.guild, ch, m);
    await ch.setTopic(`${ch.topic}:reminded`).catch(() => null);
  }, THREE_DAYS_MS);

  reminderTimeouts.set(channel.id, timeout);
}

async function restoreCandidatureReminders(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.parentId !== CANDIDATURE_CATEGORY_ID) continue;
      if (channel.type !== ChannelType.GuildText) continue;
      if (!channel.topic?.startsWith("candidature:vote:")) continue;

      if (channel.topic.includes(":closed")) {
        const closedAt = parseInt(channel.topic.split(":closed:")[1], 10);
        if (closedAt) scheduleTicketDeletion(channel, closedAt);
        else {
          // ancien ticket terminé, sans date : supprimé dans 24 h
          const now = Date.now();
          await channel.setTopic(`${channel.topic}:${now}`).catch(() => null);
          scheduleTicketDeletion(channel, now);
        }
        continue;
      }

      // Ancien ticket en attente sans bouton de fermeture : on l'ajoute une fois
      const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      const hasClose = recent?.some((m) => m.components?.some((row) => row.components?.some((c) => c.customId === CLOSE_TICKET_BUTTON_ID)));
      if (recent && !hasClose) {
        await channel.send({ content: "🔒 Vous pouvez fermer ce ticket à tout moment.", components: [closeRow()] }).catch(() => null);
      }
      if (channel.topic.includes(":reminded")) continue;

      const parts = channel.topic.split(":");
      const memberId = parts[2];
      const completedAt = parseInt(parts[3], 10);
      if (!memberId || !completedAt) continue;

      const member = await guild.members.fetch(memberId).catch(() => null);
      if (!member) continue;

      const remaining = completedAt + THREE_DAYS_MS - Date.now();
      const run = async () => {
        const ch = await guild.channels.fetch(channel.id).catch(() => null);
        if (!ch || ch.topic?.includes(":reminded") || ch.topic?.includes(":closed"))
          return;
        await notifyAdminsPending(guild, ch, member);
        await ch.setTopic(`${ch.topic}:reminded`).catch(() => null);
      };

      if (remaining <= 0) await run();
      else reminderTimeouts.set(channel.id, setTimeout(run, remaining));
    }
  }
}

async function askNextQuestion(channel, member, index, answers) {
  const question = CANDIDATURE_QUESTIONS[index];
  const total = CANDIDATURE_QUESTIONS.length;

  const embed = new EmbedBuilder()
    .setColor(0x800020)
    .setTitle("📋 Candidature — Recrutement Maison")
    .setDescription(
      (index === 0
        ? "Merci de remplir ce formulaire **sérieusement**. Répondez à chaque question dans ce salon.\n\n"
        : "") +
        `**Question ${index + 1} / ${total}**\n\n${question.prompt}` +
        (question.optional ? "\n\n*Tapez `passer` pour ignorer.*" : "")
    );

  await channel.send({ embeds: [embed] });

  const collected = await channel
    .awaitMessages({
      filter: (m) => m.author.id === member.id && !m.author.bot,
      max: 1,
      time: QUESTION_TIMEOUT_MS,
      errors: ["time"],
    })
    .catch(() => null);

  if (!collected?.size) {
    activeSessions.delete(channel.id);
    await channel.send({
      content: `⏱️ Temps écoulé. Votre progression est gardée (question ${index + 1} / ${total}) : cliquez pour reprendre quand vous êtes prêt(e).`,
      components: [resumeRow()],
    });
    return;
  }

  const msg = collected.first();
  let value = msg.content?.trim() || "";

  if (question.optional && ["passer", "skip", "-"].includes(value.toLowerCase())) {
    value = "Non renseigné";
  } else if (question.key === "photo" && msg.attachments.size > 0) {
    value = msg.attachments.first().url;
  } else if (!value && !question.optional) {
    await channel.send("❌ Réponse vide. Merci de répondre à la question.");
    return askNextQuestion(channel, member, index, answers);
  }

  if (question.choices) {
    const choice = question.choices.find((c) => c.match.test(value));
    if (!choice) {
      await channel.send(
        `❌ Merci de répondre par : ${question.choices.map((c) => `**${c.value}**`).join(" ou ")}.`
      );
      return askNextQuestion(channel, member, index, answers);
    }
    value = choice.value;
  }

  answers[question.key] = value;
  saveProgress(channel.id, member.id, index + 1, answers);

  if (index + 1 < total) {
    return askNextQuestion(channel, member, index + 1, answers);
  }

  return finishCandidature(channel, member, answers);
}

async function finishCandidature(channel, member, answers) {
  activeSessions.delete(channel.id);
  saveProgress(channel.id, null, null);

  await channel.send("✅ Formulaire terminé — préparation de votre candidature…");
  await clearChannel(channel);

  await channel.send({ embeds: [buildWaitingEmbed()], components: [closeRow()] });

  const stats = getVoteState(channel.id);
  stats.answers = answers;
  stats.memberId = member.id;
  stats.pour.clear();
  stats.contre.clear();
  stats.round = 1;
  stats.status = "voting";

  const completedAt = Date.now();
  await channel
    .setTopic(`candidature:vote:${member.id}:${completedAt}`)
    .catch(() => null);

  const logChannel = channel.guild.channels.cache.get(CANDIDATURE_LOG_CHANNEL_ID);
  if (logChannel?.isTextBased()) {
    const logEmbed = buildCandidatureResultEmbed(member, answers);
    logEmbed.setFooter({ text: "Votes anonymes — 2 votes requis pour statuer" });

    const logMsg = await logChannel.send({
      content: `<@&${ADMIN_VOTE_ROLE_ID}> — Nouvelle candidature à examiner`,
      embeds: [logEmbed],
      components: [buildVoteRow(channel.id)],
    });
    stats.logMessageId = logMsg.id;
  }
  persist();

  scheduleCandidatureReminder(channel, member);
}

function resumeRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("candidature_resume")
      .setLabel("Reprendre ma candidature")
      .setEmoji("🔁")
      .setStyle(ButtonStyle.Primary)
  );
}

// Reprend le questionnaire là où il s'était arrêté (redémarrage du bot, temps écoulé).
async function resumeQuestionnaire(channel, member) {
  if (activeSessions.has(channel.id)) return;
  const progress = saved.sessions[channel.id];
  const index = progress?.memberId === member.id ? progress.index : 0;
  const answers = progress?.memberId === member.id ? progress.answers : {};
  activeSessions.set(channel.id, { memberId: member.id });
  try {
    await askNextQuestion(channel, member, Math.min(index, CANDIDATURE_QUESTIONS.length - 1), answers);
  } catch (err) {
    console.error("Erreur questionnaire candidature:", err.message);
    activeSessions.delete(channel.id);
    await channel.send("❌ Une erreur est survenue. Contactez le staff.").catch(() => null);
  }
}

async function handleCandidatureResume(interaction) {
  const channel = interaction.channel;
  if (channel?.topic !== `candidature:${interaction.user.id}`) {
    await interaction.reply({ content: "❌ Ce bouton est réservé au candidat de ce ticket.", ephemeral: true });
    return;
  }
  if (activeSessions.has(channel.id)) {
    await interaction.reply({ content: "📋 Le questionnaire est déjà en cours.", ephemeral: true });
    return;
  }
  await interaction.update({ components: [] }).catch(() => null);
  await resumeQuestionnaire(channel, interaction.member);
}

// Au démarrage : les questionnaires interrompus proposent de reprendre.
async function restoreCandidatureSessions(client) {
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.parentId !== CANDIDATURE_CATEGORY_ID || channel.type !== ChannelType.GuildText) continue;
      const match = channel.topic?.match(/^candidature:(\d+)$/);
      if (!match || activeSessions.has(channel.id)) continue;
      const progress = saved.sessions[channel.id];
      const at = progress ? ` à la question ${progress.index + 1} / ${CANDIDATURE_QUESTIONS.length}` : "";
      await channel
        .send({
          content: `<@${match[1]}> 🔄 Le bot a redémarré pendant votre candidature. Cliquez pour reprendre${at}.`,
          components: [resumeRow()],
        })
        .catch(() => null);
    }
  }
}

async function startCandidatureQuestionnaire(channel, member) {
  if (activeSessions.has(channel.id)) return;
  activeSessions.set(channel.id, { memberId: member.id });
  saveProgress(channel.id, member.id, 0, {});

  const intro = new EmbedBuilder()
    .setColor(0x800020)
    .setTitle("📋 Candidature — Recrutement Maison")
    .setDescription(
      "Merci de remplir ce formulaire **sérieusement** afin que le staff puisse étudier votre demande.\n\n" +
        "Les questions seront posées **une par une** dans ce salon.\n" +
        "Vous avez **30 minutes** par question.\n\n" +
        "*La conversation sera effacée à la fin — seul le récapitulatif sera conservé.*"
    );

  await channel.send({ content: `${member}`, embeds: [intro] });

  try {
    await askNextQuestion(channel, member, 0, {});
  } catch (err) {
    console.error("Erreur questionnaire candidature:", err.message);
    activeSessions.delete(channel.id);
    await channel.send("❌ Une erreur est survenue. Contactez le staff.");
  }
}

async function handleCandidatureVote(interaction) {
  const parsed = parseVoteCustomId(interaction.customId);
  if (!parsed) return false;

  const voter = interaction.member;
  const channelId = parsed.channelId;
  const channel = await interaction.guild.channels
    .fetch(channelId)
    .catch(() => null);

  if (!channel?.topic?.startsWith("candidature:vote:")) {
    await interaction.reply({
      content: "❌ Cette candidature n'est plus active.",
      ephemeral: true,
    });
    return true;
  }

  if (channel.topic.includes(":closed")) {
    await interaction.reply({
      content: "❌ Cette candidature est déjà terminée.",
      ephemeral: true,
    });
    return true;
  }

  const stats = getVoteState(channelId);

  if (parsed.chef) {
    if (interaction.user.id !== CHEF_USER_ID) {
      await interaction.reply({
        content: "❌ Seule la cheffe peut trancher ce vote.",
        ephemeral: true,
      });
      return true;
    }
    if (stats.status !== "awaiting_chef") {
      await interaction.reply({
        content: "❌ Aucune décision cheffe en attente.",
        ephemeral: true,
      });
      return true;
    }

    const accepted = parsed.type === "pour";
    await interaction.reply({
      content: "👑 Décision enregistrée.",
      ephemeral: true,
    });

    const member = await interaction.guild.members
      .fetch(stats.memberId)
      .catch(() => null);
    if (member) {
      await finalizeCandidature(
        channel,
        interaction.guild,
        stats,
        accepted,
        "Décision de la cheffe."
      );
    }
    return true;
  }

  if (!voter?.roles.cache.has(ADMIN_VOTE_ROLE_ID)) {
    await interaction.reply({
      content: "❌ Seule l'administration peut voter.",
      ephemeral: true,
    });
    return true;
  }

  if (stats.status !== "voting" && stats.status !== "round2") {
    await interaction.reply({
      content: "❌ Le vote est fermé pour cette candidature.",
      ephemeral: true,
    });
    return true;
  }

  const userId = voter.id;
  if (stats.pour.has(userId) || stats.contre.has(userId)) {
    await interaction.reply({
      content: "🦋 Vous avez déjà voté.",
      ephemeral: true,
    });
    return true;
  }

  if (parsed.type === "pour") stats.pour.add(userId);
  else stats.contre.add(userId);

  await interaction.reply({
    content: "🦋 Vote enregistré. Merci.",
    ephemeral: true,
  });

  const member = await interaction.guild.members
    .fetch(stats.memberId)
    .catch(() => null);
  if (member) await evaluateVotes(channel, interaction.guild, stats, member);
  persist();

  return true;
}

async function setupCandidatureCategoryPermissions(
  guild,
  welcomeRoleId,
  verifiedRoleId
) {
  const category = guild.channels.cache.get(CANDIDATURE_CATEGORY_ID);
  if (!category) return;

  const everyoneId = guild.roles.everyone.id;
  const denyView = { ViewChannel: false };

  await category.permissionOverwrites.edit(everyoneId, denyView).catch(() => null);
  await category.permissionOverwrites
    .edit(welcomeRoleId, denyView)
    .catch(() => null);
  await category.permissionOverwrites
    .edit(verifiedRoleId, denyView)
    .catch(() => null);
}

module.exports = {
  handleCandidatureResume,
  restoreCandidatureSessions,
  CANDIDATURE_CATEGORY_ID,
  CANDIDATURE_LOG_CHANNEL_ID,
  ADMIN_VOTE_ROLE_ID,
  isCandidatureCategory,
  startCandidatureQuestionnaire,
  handleCandidatureVote,
  setupCandidatureCategoryPermissions,
  restoreCandidatureReminders,
  activeSessions,
};
