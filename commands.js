const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { clearCommand } = require("./clear");

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
    clearCommand,
    new SlashCommandBuilder()
      .setName("profil")
      .setDescription("Afficher la carte d'identité d'un membre de la Maison")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre (vous par défaut)"))
      .addBooleanOption((o) => o.setName("prive").setDescription("Afficher la carte seulement pour vous (avec vos infos privées)"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("album")
      .setDescription("Feuilleter votre album de cartes (ou celui d'un autre membre)")
      .addUserOption((o) => o.setName("membre").setDescription("Voir l'album d'un autre membre"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("inventaire")
      .setDescription("Vos boosters de cartes, votre collection et vos statistiques")
      .addUserOption((o) => o.setName("membre").setDescription("Voir l'inventaire d'un autre membre"))
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
  console.log("Commandes /achat, /report, /niveau, /crédit, /mission, /solde, /argent, /clear, /profil, /inventaire et /album enregistrées");
}

module.exports = { registerSlashCommands };
