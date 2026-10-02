// Membre Star : chaque semaine, la Fondation élit un membre (hors Fondation).
// Il reçoit une prime, un titre sur sa carte d'identité et un rôle dont la couleur évolue avec ses élections.
const fs = require("fs");
const cron = require("node-cron");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { changeBalance, formatEuro, refreshRichestLeaderboard } = require("./economie");
const { findOrCreateChannel, findOrCreateRole } = require("./salons");
const { deleteLater, HOUR } = require("./nettoyage");

const FONDATION_ROLE_ID = "1509979964651343993";
const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon étoile est rangé à côté des annonces
const PRIME = 1000;
const PANEL_TITLE = "⭐ Membre Star de la semaine";
const STATE_FILE = require("./data").dataFile("membrestar-state.json");

// Grades selon le nombre d'élections (du plus haut au plus bas)
const GRADES = [
  { min: 100, name: "🦸 Membre Star Héro", color: 0x1abc9c },
  { min: 50, name: "👑 Membre Star Royal", color: 0xe74c3c },
  { min: 20, name: "💫 Membre Star Digne", color: 0x9b59b6 },
  { min: 10, name: "🌟 Membre Star Officiel", color: 0xe67e22 },
  { min: 1, name: "⭐ Membre Star", color: 0xf1c40f },
];

function gradeFor(count) {
  return GRADES.find((g) => count >= g.min) ?? null;
}

// Titre affiché sur la carte d'identité
function getStarTitle(userId) {
  const count = load().counts[userId] ?? 0;
  if (!count) return null;
  const grade = gradeFor(count);
  return count < 10 ? `⭐ Membre Star — Semaine ${count}` : `${grade.name} (${count} fois)`;
}

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.counts ??= {};
  state.history ??= [];
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// Semaine du lundi au dimanche (heure de Paris), identifiée par la date du lundi
function weekKey(ts = Date.now()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(new Date(ts))
      .map((p) => [p.type, p.value])
  );
  const offset = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[parts.weekday];
  const monday = new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day - offset));
  return monday.toISOString().slice(0, 10);
}

function thisWeekStar() {
  return load().history.find((h) => h.week === weekKey()) ?? null;
}

function panelMessage() {
  const s = load();
  const current = thisWeekStar();
  const hall = Object.entries(s.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, n], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} <@${id}> — ${gradeFor(n).name} · **${n}** fois`)
    .join("\n");
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle(PANEL_TITLE)
        .setDescription(
          "Chaque semaine, la **Fondation** élit un membre qui s'est démarqué. Il reçoit une prime de " +
            `**${formatEuro(PRIME)}** et un titre sur sa carte d'identité (\`/profil\`).\n\n` +
            "**Grades** (selon le nombre d'élections)\n" +
            "⭐ Membre Star · 🌟 Officiel à **10** · 💫 Digne à **20** · 👑 Royal à **50** · 🦸 Héro à **100**\n\n" +
            (current ? `🏆 **Star de cette semaine** : <@${current.userId}>` : "🏆 *La star de cette semaine n'a pas encore été élue.*")
        )
        .addFields({ name: "🏛️ Tableau d'honneur", value: hall || "*Aucune élection pour le moment.*" })
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("star_elect").setLabel("Élire le membre star (Fondation)").setEmoji("⭐").setStyle(ButtonStyle.Primary)
      ),
    ],
  };
}

let channelRef = null;

async function refreshPanel(client) {
  const s = load();
  if (!channelRef) return;
  let msg = s.panelMessageId ? await channelRef.messages.fetch(s.panelMessageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channelRef.messages.fetch({ limit: 25 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (msg) await msg.edit(panelMessage()).catch(() => null);
  else msg = await channelRef.send(panelMessage()).catch(() => null);
  if (msg && s.panelMessageId !== msg.id) {
    s.panelMessageId = msg.id;
    save();
  }
}

async function electStar(interaction, client) {
  const guild = interaction.guild;
  if (thisWeekStar()) {
    return interaction.update({ content: `⭐ La star de cette semaine est déjà élue : <@${thisWeekStar().userId}>.`, components: [] });
  }
  const target = await guild.members.fetch(interaction.values[0]).catch(() => null);
  if (!target || target.user.bot) return interaction.update({ content: "❌ Membre introuvable.", components: [] });
  if (target.roles.cache.has(FONDATION_ROLE_ID)) {
    return interaction.update({ content: "❌ Les membres de la Fondation ne peuvent pas être élus.", components: [] });
  }

  const s = load();
  const count = (s.counts[target.id] ?? 0) + 1;
  s.counts[target.id] = count;
  s.history.push({ week: weekKey(), userId: target.id, by: interaction.user.id, at: Date.now() });
  save();

  // Prime
  const paid = changeBalance(target.id, PRIME, "Prime Membre Star", { force: true }) !== null;

  // Rôle de grade (un seul à la fois, la couleur évolue)
  const grade = gradeFor(count);
  for (const g of GRADES) {
    const role = await findOrCreateRole(guild, { name: g.name, color: g.color, hoist: false }).catch(() => null);
    if (!role) continue;
    if (g === grade) await target.roles.add(role).catch(() => null);
    else if (target.roles.cache.has(role.id)) await target.roles.remove(role).catch(() => null);
  }

  const promotion = GRADES.some((g) => g.min === count && g.min > 1);
  await channelRef
    ?.send({
      content: `${target}`,
      allowedMentions: { users: [target.id] },
      embeds: [
        new EmbedBuilder()
          .setColor(grade.color)
          .setTitle("⭐ Membre Star de la semaine !")
          .setThumbnail(target.user.displayAvatarURL({ size: 256 }))
          .setDescription(
            `Félicitations ${target} 🎉 La Fondation t'a élu(e) **Membre Star** de la semaine !\n\n` +
              `🏅 ${count < 10 ? `**Membre Star — Semaine ${count}**` : `**${grade.name}**`}` +
              (promotion ? `\n✨ **Nouveau grade débloqué : ${grade.name} !**` : "") +
              (paid ? `\n💰 Prime de **${formatEuro(PRIME)}** versée.` : "")
          )
          .setTimestamp(),
      ],
    })
    .catch(() => null);
  await refreshPanel(client);
  await refreshRichestLeaderboard(client).catch(() => null);
  return interaction.update({ content: `⭐ ${target} est le membre star de la semaine.`, components: [] });
}

async function handleStarInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("star_")) return false;
  if (!interaction.member?.roles.cache.has(FONDATION_ROLE_ID)) {
    await interaction.reply({ content: "❌ Seule la Fondation élit le membre star.", ephemeral: true });
    return true;
  }
  if (id === "star_elect") {
    const current = thisWeekStar();
    if (current) {
      await interaction.reply({ content: `⭐ La star de cette semaine est déjà élue : <@${current.userId}>. Rendez-vous lundi !`, ephemeral: true });
      return true;
    }
    await interaction.reply({
      content: "⭐ Qui est le membre star de la semaine ? (la Fondation ne peut pas être élue)",
      ephemeral: true,
      components: [new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId("star_pick").setPlaceholder("Choisir un membre"))],
    });
    return true;
  }
  if (id === "star_pick") {
    await electStar(interaction, client);
    return true;
  }
  return false;
}

async function setupMembreStar(client) {
  load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: state.channelId,
    name: "⭐・membre-star",
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });
  state.channelId = channelRef.id;
  save();
  await refreshPanel(client);

  // Dimanche midi : rappel à la Fondation si la star n'est pas encore élue
  cron.schedule(
    "0 12 * * 0",
    async () => {
      if (thisWeekStar() || !channelRef) return;
      const reminder = await channelRef
        .send({ content: `<@&${FONDATION_ROLE_ID}> ⭐ C'est dimanche : élisez le **membre star** de la semaine avec le bouton ci-dessus !`, allowedMentions: { roles: [FONDATION_ROLE_ID] } })
        .catch(() => null);
      deleteLater(reminder, 12 * HOUR);
    },
    { timezone: "Europe/Paris" }
  );
  console.log("Membre Star prêt");
}

module.exports = { setupMembreStar, handleStarInteraction, getStarTitle };
