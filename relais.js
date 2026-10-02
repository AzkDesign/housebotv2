// Relais de messages privés : ce qu'une personne désignée écrit AU BOT en MP
// est transmis aux comptes à prévenir, qui peuvent répondre via le bot.
// (Le bot ne voit que les messages qu'on lui envoie à lui, jamais les MP entre membres.)
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const RELAY = {
  from: ["1411724649036910673"], // personnes dont les messages au bot sont transmis
  to: ["320348102055690241"], // comptes qui reçoivent les messages et peuvent répondre
};

async function handleRelayMessage(message, client) {
  if (message.guild || message.author.bot || !RELAY.from.includes(message.author.id)) return;

  const files = [...message.attachments.values()].map((a) => ({ attachment: a.url, name: a.name }));
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: `📨 Nouveau message de ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ size: 64 }) })
    .setDescription(message.content?.slice(0, 4000) || "*(pièce jointe sans texte)*")
    .setFooter({ text: `ID ${message.author.id}` })
    .setTimestamp(message.createdTimestamp);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`relay_reply_${message.author.id}`).setLabel("Répondre").setEmoji("💬").setStyle(ButtonStyle.Primary)
  );

  let delivered = 0;
  for (const id of RELAY.to) {
    const user = await client.users.fetch(id).catch(() => null);
    const sent = await user?.send({ embeds: [embed], components: [row], files }).catch(() => null);
    if (sent) delivered++;
  }
  // Petit accusé de réception pour l'expéditeur
  await message.react(delivered ? "✅" : "⚠️").catch(() => null);
  if (!delivered) console.warn("Relais : message non transmis (MP fermés côté destinataire ?)");
}

async function handleRelayInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("relay_")) return false;
  if (!RELAY.to.includes(interaction.user.id)) {
    await interaction.reply({ content: "❌ Ce bouton ne vous est pas destiné.", ephemeral: true });
    return true;
  }
  const targetId = id.split("_")[2];
  if (!RELAY.from.includes(targetId)) {
    await interaction.reply({ content: "❌ Destinataire inconnu.", ephemeral: true });
    return true;
  }

  if (interaction.isButton()) {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`relay_send_${targetId}`)
        .setTitle("💬 Répondre")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("texte").setLabel("Votre réponse").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(2000)
          )
        )
    );
    return true;
  }

  if (interaction.isModalSubmit()) {
    const text = interaction.fields.getTextInputValue("texte").trim();
    const target = await client.users.fetch(targetId).catch(() => null);
    const sent = await target
      ?.send({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("💬 Réponse").setDescription(text).setTimestamp()] })
      .catch(() => null);
    await interaction.reply({
      content: sent ? `✅ Réponse envoyée à ${target.tag}.` : "❌ Impossible d'envoyer la réponse (ses MP sont peut-être fermés).",
      ephemeral: true,
    });
    return true;
  }
  return false;
}

module.exports = { handleRelayMessage, handleRelayInteraction };
