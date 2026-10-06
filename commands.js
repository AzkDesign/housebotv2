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
      .setName("deposit")
      .setDescription("Déposer de l'argent sur votre solde (ticket vérifié par l'IRF)")
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
      .setName("succes")
      .setDescription("Vos succès des Cartes de la Maison et le titre affiché sur votre profil")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("vitrine")
      .setDescription("Votre vitrine : vos trois plus belles cartes (ou celle d'un membre)")
      .addUserOption((o) => o.setName("membre").setDescription("Voir la vitrine d'un autre membre"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("equipe")
      .setDescription("Votre équipe (duo) : niveau, coffre commun, objectif de la semaine, cadeaux")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("iles")
      .setDescription("L'île des cartes : gardez-la avec vos cartes, ou attaquez son gardien")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("codex")
      .setDescription("Le codex des cartes : toutes celles qui vous manquent et comment les obtenir")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("quetes")
      .setDescription("Vos trois quêtes du jour des Cartes de la Maison")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("aide-cartes")
      .setDescription("Le guide complet des Cartes de la Maison")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("carte-offrir")
      .setDescription("(Gérants) Offrir une carte d'événement à un membre")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre qui reçoit la carte").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("carte")
          .setDescription("La carte d'événement")
          .setRequired(true)
          .addChoices(
            { name: "Star de la semaine (épique)", value: "ev_star" },
            { name: "Élu(e) Maire (légendaire)", value: "ev_maire" },
            { name: "Jackpot ! (légendaire)", value: "ev_jackpot" },
            { name: "Podium de l'Arène (légendaire)", value: "ev_podium" },
            { name: "Champion de l'Arène (mythique)", value: "ev_champion" }
          )
      )
      .addBooleanOption((o) => o.setName("holo").setDescription("Version holographique"))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("generation")
      .setDescription("(Gérants) Voir ou lancer la génération de cartes suivante")
      .addStringOption((o) => o.setName("action").setDescription("Que faire").setRequired(true).addChoices({ name: "Voir l'état", value: "statut" }, { name: "Lancer la génération suivante", value: "lancer" }, { name: "Programmer le lancement", value: "programmer" }, { name: "Annuler le lancement programmé", value: "annuler" }))
      .addIntegerOption((o) => o.setName("jours").setDescription("Pour « programmer » : dans combien de jours (21 par défaut)").setMinValue(1).setMaxValue(90))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("combat")
      .setDescription("Défier un membre en combat de cartes (ou ouvrir l'Arène)")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre à défier (vide : menu de l'Arène)"))
      .addIntegerOption((o) => o.setName("mise").setDescription("Mise en € de chaque joueur (facultatif)").setMinValue(0).setMaxValue(1000000))
      .toJSON(),
    new SlashCommandBuilder()
      .setName("arene")
      .setDescription("Classement et menu de l'Arène des cartes")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("marche")
      .setDescription("Le marché des cartes : acheter et vendre entre membres")
      .toJSON(),
    new SlashCommandBuilder()
      .setName("echange")
      .setDescription("Inviter un membre à échanger : vous posez vos cartes ensemble, en direct")
      .addUserOption((o) => o.setName("membre").setDescription("Le membre avec qui échanger").setRequired(true))
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
  console.log("Commandes /achat, /report, /niveau, /crédit, /mission, /solde, /argent, /clear, /profil, /inventaire, /album, /marche, /echange, /combat, /arene, /quetes, /aide-cartes, /carte-offrir et /generation enregistrées");
}

module.exports = { registerSlashCommands };
