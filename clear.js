const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

const clearCommand = new SlashCommandBuilder()
  .setName("clear")
  .setDescription("Supprimer tous les messages de ce salon")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .toJSON();

// Supprime tous les messages du salon : suppression groupée pour ceux de
// moins de 14 jours (limite Discord), puis un par un pour les plus anciens.
async function clearChannel(channel) {
  let deleted = 0;

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100 });
    if (batch.size === 0) break;

    const now = Date.now();
    const recent = batch.filter((m) => now - m.createdTimestamp < TWO_WEEKS_MS);
    const old = batch.filter((m) => now - m.createdTimestamp >= TWO_WEEKS_MS);

    if (recent.size > 0) {
      const res = await channel.bulkDelete(recent, true);
      deleted += res.size;
    }
    for (const msg of old.values()) {
      await msg.delete().catch(() => {});
      deleted++;
    }
  }

  return deleted;
}

async function handleClearCommand(interaction) {
  if (!interaction.isChatInputCommand() || interaction.commandName !== "clear") {
    return false;
  }

  const channel = interaction.channel;
  if (!channel?.isTextBased() || !channel.bulkDelete) {
    await interaction.reply({
      content: "❌ Cette commande ne fonctionne que dans un salon textuel.",
      ephemeral: true,
    });
    return true;
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({
      content: "❌ Vous devez avoir la permission « Gérer les messages ».",
      ephemeral: true,
    });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const deleted = await clearChannel(channel);
    await interaction.editReply(`🧹 ${deleted} message(s) supprimé(s).`);
  } catch (err) {
    console.error("Erreur /clear:", err);
    await interaction.editReply(
      "❌ Impossible de supprimer les messages (vérifiez que le bot a la permission « Gérer les messages » dans ce salon)."
    );
  }
  return true;
}

module.exports = { clearCommand, handleClearCommand };
