const { REST, Routes, SlashCommandBuilder } = require("discord.js");

async function registerSlashCommands(client, token) {
  const commands = [
    new SlashCommandBuilder()
      .setName("achat")
      .setDescription("Demande d'achat d'un produit")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("report")
      .setDescription("Signaler anonymement le comportement d'un membre")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("niveau")
      .setDescription("Voir votre progression et votre niveau sur le serveur")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("crédit")
      .setDescription("Demander un crédit argent")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("mission")
      .setDescription(
        "Publier une mission sur le panel intérim (Fondation uniquement)"
      )
      .toJSON(),
    new SlashCommandBuilder()
      .setName("solde")
      .setDescription("Voir combien d'argent vous avez")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("argent")
      .setDescription("Modifier l'argent d'un membre (gérants uniquement)")
      .addStringOption((o) =>
        o
          .setName("action")
          .setDescription("Ajouter, retirer ou définir le solde")
          .setRequired(true)
          .addChoices(
            { name: "Ajouter", value: "ajouter" },
            { name: "Retirer", value: "retirer" },
            { name: "Définir le solde", value: "definir" }
          )
      )
      .addUserOption((o) =>
        o.setName("membre").setDescription("Le membre concerné").setRequired(true)
      )
      .addIntegerOption((o) =>
        o
          .setName("montant")
          .setDescription("Montant en €")
          .setRequired(true)
          .setMinValue(0)
          .setMaxValue(1_000_000_000)
      )
      .addStringOption((o) =>
        o.setName("raison").setDescription("Pourquoi (visible dans les logs)").setMaxLength(200)
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(token);
  for (const guild of client.guilds.cache.values()) {
    await rest
      .put(Routes.applicationGuildCommands(client.user.id, guild.id), {
        body: commands,
      })
      .catch((err) =>
        console.warn(`Commandes slash (${guild.name}):`, err.message)
      );
  }
  console.log("Commandes /achat, /report, /niveau, /crédit, /mission, /solde et /argent enregistrées");
}

module.exports = { registerSlashCommands };
