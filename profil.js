// /profil : la carte d'identité d'un membre, qui réunit tous les systèmes de la Maison.
const { EmbedBuilder } = require("discord.js");
const { loadState: loadEconomie, formatEuro, isGerant, isFrozen, getTaxDebt } = require("./economie");
const { CASINO_ACCESS_ROLE_ID, ENTREPRENEUR_ROLE_ID, LICENCE_ROLE_ID, IRF_ROLE_ID } = require("./casino");
const { getResidence } = require("./chambres");
const { getJobOf } = require("./entreprises");
const { getLevelSummary } = require("./levels");

// Chargés à la demande : la mairie et les associations s'utilisent mutuellement.
const mairie = () => require("./mairie");
const associations = () => require("./associations");

function fortuneRank(userId) {
  const ranked = Object.entries(loadEconomie().balances)
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const index = ranked.findIndex(([id]) => id === userId);
  return index >= 0 ? { rank: index + 1, total: ranked.length } : null;
}

function seniority(joinedAt) {
  if (!joinedAt) return "—";
  const days = Math.floor((Date.now() - joinedAt) / (24 * 60 * 60 * 1000));
  const since = `<t:${Math.floor(joinedAt / 1000)}:D>`;
  if (days < 1) return `arrivé(e) aujourd'hui (${since})`;
  if (days < 60) return `${days} jour${days > 1 ? "s" : ""} (depuis le ${since})`;
  return `${Math.floor(days / 30)} mois (depuis le ${since})`;
}

function buildCard(member, { showPrivate }) {
  const userId = member.id;
  const residence = getResidence(userId);
  const job = getJobOf(userId);
  const { office, title } = mairie().getPublicRole(userId);
  const assos = associations().getAssociationsOf(userId);
  const level = getLevelSummary(userId);
  const rank = fortuneRank(userId);

  const casino = [];
  if (member.roles.cache.has(CASINO_ACCESS_ROLE_ID) || member.roles.cache.has(ENTREPRENEUR_ROLE_ID)) casino.push("🎰 Accès au casino");
  if (member.roles.cache.has(LICENCE_ROLE_ID)) casino.push("🪪 Licence");

  const embed = new EmbedBuilder()
    .setColor(member.displayColor || 0x8b0000)
    .setAuthor({ name: "🪪 Carte d'identité de la Maison" })
    .setTitle(member.displayName)
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      {
        name: "🏠 Résidence",
        value: residence
          ? `${residence.quartier.emoji} **${residence.quartier.name}** ${"⭐".repeat(residence.quartier.stars)}\n${residence.room.name} · ${residence.maison.name}`
          : "Sans domicile fixe",
        inline: true,
      },
      {
        name: "💼 Travail",
        value: job
          ? `**${job.name}**${job.status === "frozen" ? " ⛔" : job.status === "pending" ? " ⏳" : ""}\n${job.role} · ${job.sector}`
          : "Sans emploi",
        inline: true,
      }
    );

  const roles = [office, title].filter(Boolean);
  if (roles.length) embed.addFields({ name: "🏛️ Fonctions", value: roles.join("\n"), inline: true });

  embed.addFields(
    {
      name: "🤝 Associations",
      value: assos.length ? assos.map((a) => `${a.president ? "👤 " : ""}${a.name}${a.banned ? " ⛔" : ""}`).join("\n").slice(0, 1024) : "Aucune",
      inline: true,
    },
    {
      name: "💰 Fortune",
      value: rank ? `${rank.rank === 1 ? "🥇" : rank.rank === 2 ? "🥈" : rank.rank === 3 ? "🥉" : "🏅"} **${rank.rank === 1 ? "1ʳᵉ" : `${rank.rank}ᵉ`}** fortune sur ${rank.total}` : "Pas encore classé(e)",
      inline: true,
    },
    { name: "⭐ Activité", value: `**${level.label}** · ${level.messages} message(s)`, inline: true }
  );
  if (casino.length) embed.addFields({ name: "🎟️ Accès", value: casino.join(" · "), inline: true });
  embed.addFields({ name: "📅 Ancienneté", value: seniority(member.joinedTimestamp) });

  // Informations privées : seulement pour soi (en privé), l'IRF et les gérants
  if (showPrivate) {
    const balance = loadEconomie().balances[userId] ?? 0;
    const debt = getTaxDebt(userId);
    embed.addFields({
      name: "🔒 Privé — visible par vous seul(e)",
      value:
        `💶 Solde : **${formatEuro(balance)}**\n` +
        `🧾 Dette fiscale : ${debt ? `**${formatEuro(debt.amount)}**` : "aucune"}\n` +
        `${isFrozen(userId) ? "🔒 Compte **gelé** par l'IRF" : "✅ Compte actif"}`,
    });
  }
  return embed.setFooter({ text: `ID ${userId}` }).setTimestamp();
}

async function handleProfilCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "profil") return false;

  const user = interaction.options.getUser("membre") ?? interaction.user;
  const prive = interaction.options.getBoolean("prive") ?? false;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member || member.user.bot) {
    await interaction.reply({ content: "❌ Ce membre n'est pas sur le serveur.", ephemeral: true });
    return true;
  }

  const self = user.id === interaction.user.id;
  const staff = isGerant(interaction.member) || interaction.member.roles.cache.has(IRF_ROLE_ID);
  // Les infos privées ne s'affichent jamais publiquement : seulement en privé, pour soi ou pour l'IRF / les gérants.
  const showPrivate = prive && (self || staff);

  await interaction.reply({ embeds: [buildCard(member, { showPrivate })], ephemeral: prive });
  return true;
}

module.exports = { handleProfilCommand };
