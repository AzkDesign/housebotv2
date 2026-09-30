const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const LEVEL_CHANNEL_ID = "1510693589070647416";

const INSULT_ROLE_ID = "1510692182099624058";
const INSULT_THRESHOLD = 3;
const INSULT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const MESSAGE_LEVELS = [
  { count: 100, roleId: "1510692620064788703", label: "Niveau I" },
  { count: 200, roleId: "1510692870137319716", label: "Niveau II" },
  { count: 350, roleId: "1510693083925188658", label: "Niveau III" },
  { count: 1000, roleId: "1510693310002364587", label: "Niveau IV" },
];

const STATE_FILE = require("./data").dataFile("levels-state.json");

const INSULT_PATTERNS = [
  /\bconnard\b/i,
  /\bconnasse\b/i,
  /\bsalope\b/i,
  /\bpute\b/i,
  /\bputain\b/i,
  /\bencul[eé]\b/i,
  /\bfils de pute\b/i,
  /\bftg\b/i,
  /\bntm\b/i,
  /\bntg\b/i,
  /\bnique\b/i,
  /\bt[a]? gueule\b/i,
  /\bferme ta gueule\b/i,
  /\bbouffon\b/i,
  /\bd[eé]bile\b/i,
  /\bidiot\b/i,
  /\bcr[eé]tin\b/i,
  /\bmerde\b/i,
  /\bbatard\b/i,
  /\bb[aâ]tard\b/i,
  /\bfdp\b/i,
  /\bpd\b/i,
  /\btg\b/i,
  /\bclc\b/i,
  /\btrou du cul\b/i,
  /\basshole\b/i,
  /\bfuck\b/i,
  /\bshit\b/i,
  /\bbitch\b/i,
];

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (!data.users) data.users = {};
    if (data.leaderboardMessageId === undefined) data.leaderboardMessageId = null;
    return data;
  } catch {
    return { users: {}, leaderboardMessageId: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getUserData(state, userId) {
  if (!state.users[userId]) {
    state.users[userId] = {
      messages: 0,
      insults: [],
      earnedLevels: [],
      insultRoleGiven: false,
    };
  }
  return state.users[userId];
}

function containsInsult(text) {
  if (!text) return false;
  return INSULT_PATTERNS.some((p) => p.test(text));
}

function pruneInsults(insults) {
  const cutoff = Date.now() - INSULT_WINDOW_MS;
  return insults.filter((ts) => ts >= cutoff);
}

function getNextLevel(messages, earnedLevels) {
  for (const level of MESSAGE_LEVELS) {
    if (!earnedLevels.includes(level.count) && messages < level.count) {
      return level;
    }
  }
  return null;
}

function getProgressInfo(messages, earnedLevels) {
  const next = getNextLevel(messages, earnedLevels);
  if (!next) {
    return { percent: 100, next: null, previous: MESSAGE_LEVELS.at(-1)?.count ?? 0 };
  }

  let previous = 0;
  for (const level of MESSAGE_LEVELS) {
    if (level.count < next.count) previous = level.count;
  }

  const range = next.count - previous;
  const progress = messages - previous;
  const percent = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));

  return { percent, next, previous };
}

function buildBlueProgressBar(percent, segments = 14) {
  const filled = Math.round((percent / 100) * segments);
  const empty = segments - filled;
  return `${"🟦".repeat(filled)}${"⬜".repeat(empty)}\n**${percent}%**`;
}

function buildProgressEmbed(member, userData, guild) {
  const earned = userData.earnedLevels || [];
  const next = getNextLevel(userData.messages, earned);
  const progress = getProgressInfo(userData.messages, earned);

  const levelLines = MESSAGE_LEVELS.map((l) => {
    const done = earned.includes(l.count);
    const icon = done ? "✅" : "🔒";
    const role = guild?.roles.cache.get(l.roleId);
    const roleText = role ? `<@&${l.roleId}>` : `**${l.label}**`;
    return `${icon} ${roleText} — ${l.count} messages`;
  }).join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📊 Votre progression")
    .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
    .setDescription(
      `${member}\n💬 **${userData.messages}** messages envoyés` +
        (next
          ? `\n🎯 Prochain palier : encore **${next.count - userData.messages}** message(s)`
          : "\n🎉 *Tous les paliers sont débloqués !*")
    )
    .addFields(
      {
        name: "📊 Progression",
        value: buildBlueProgressBar(progress.percent),
      },
      { name: "📈 Paliers messages", value: levelLines }
    )
    .setFooter({ text: "Continuez à participer pour monter de niveau !" })
    .setTimestamp();

  return embed;
}

async function announceLevelUp(guild, member, level) {
  const channel = await guild.channels.fetch(LEVEL_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("🎉 Nouveau niveau !")
    .setDescription(
      `${member} vient de passer **${level.label}** !\n\n` +
        `💬 **${level.count} messages** atteints sur le serveur.\n` +
        `Félicitations ! 🦋`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setTimestamp();

  await channel.send({ content: `${member}`, embeds: [embed] }).catch(() => null);
}

async function tryAssignRole(member, roleId) {
  if (!roleId || member.roles.cache.has(roleId)) return false;
  const role = member.guild.roles.cache.get(roleId);
  if (!role) return false;
  await member.roles.add(role).catch(() => null);
  return true;
}

async function handleLevelMessage(message) {
  if (!message.guild || message.author.bot) return;

  const state = loadState();
  const userData = getUserData(state, message.author.id);
  userData.messages += 1;

  if (containsInsult(message.content)) {
    userData.insults = pruneInsults(userData.insults || []);
    userData.insults.push(Date.now());

    if (
      userData.insults.length >= INSULT_THRESHOLD &&
      !userData.insultRoleGiven
    ) {
      const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
      if (member) {
        const added = await tryAssignRole(member, INSULT_ROLE_ID);
        if (added) userData.insultRoleGiven = true;
      }
    }
  }

  for (const level of MESSAGE_LEVELS) {
    if (
      userData.messages >= level.count &&
      !(userData.earnedLevels || []).includes(level.count)
    ) {
      userData.earnedLevels = userData.earnedLevels || [];
      userData.earnedLevels.push(level.count);

      const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
      if (member) {
        await tryAssignRole(member, level.roleId);
        await announceLevelUp(message.guild, member, level);
      }
    }
  }

  saveState(state);
}

async function handleLevelCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "niveau") {
    return false;
  }

  if (interaction.channelId !== LEVEL_CHANNEL_ID) {
    await interaction.reply({
      content: `❌ Utilisez cette commande uniquement dans <#${LEVEL_CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return true;
  }

  const state = loadState();
  const userData = getUserData(state, interaction.user.id);

  await interaction.reply({
    embeds: [buildProgressEmbed(interaction.member, userData, interaction.guild)],
  });
  return true;
}

module.exports = {
  handleLevelMessage,
  handleLevelCommand,
  LEVEL_CHANNEL_ID,
  MESSAGE_LEVELS,
};
