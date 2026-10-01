const {
  EmbedBuilder,
} = require("discord.js");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966";
const ANNOUNCE_TITLE_MARKER = "Une nouvelle ère";

const PANEL_LINKS = {
  boutique: "1510771583348641902",
  tickets: "1509976660966117537",
  niveau: "1510693589070647416",
};

function buildReopeningEmbed(guild) {
  const name = guild?.name ?? "la Maison";

  return new EmbedBuilder()
    .setColor(0x8b0000)
    .setTitle(`🦋 ${name} — ${ANNOUNCE_TITLE_MARKER} 🦋`)
    .setDescription(
      "♡ ••••• ♡\n\n" +
        "*La Maison se réveille. Après une pause, nous rouvrons nos portes et entrons dans une **nouvelle ère** — " +
        "plus organisée, plus accueillante, plus vivante.*\n\n" +
        "Le bot **House** accompagne désormais votre quotidien : économie, missions, boutique, progression… " +
        "Tout est pensé pour que chaque membre sache **où aller** et **quoi utiliser**.\n\n" +
        "━━━━━━━━━━━━━━━━━━━━"
    )
    .addFields(
      {
        name: "⌨️ Nouvelles commandes",
        value:
          "`/niveau` — Voir votre progression (salon dédié)\n" +
          "`/crédit` — Demander un crédit argent\n" +
          "`/achat` — Demande d'achat d'un produit\n" +
          "`/report` — Signalement anonyme d'un membre",
      },
      {
        name: "📌 Salons & panels à connaître",
        value:
          `🛍️ **Boutique** — <#${PANEL_LINKS.boutique}> *(achats sécurisés middleman)*\n` +
          `🎫 **Tickets** — <#${PANEL_LINKS.tickets}> *(question, candidature, report…)*\n` +
          `📊 **Niveaux** — <#${PANEL_LINKS.niveau}> *(progression & classement)*`,
      },
      {
        name: "✨ Ce qui vous attend",
        value:
          "• Candidatures guidées pas à pas, avec votes du staff\n" +
          "• Budget maison, chambres, repas du jour, hiérarchie à jour\n" +
          "• Système de niveaux par l'activité sur le serveur\n" +
          "• Signalements anonymes et boutique avec middleman\n\n" +
          "*Prenez le temps de parcourir les salons, d'accepter le règlement si ce n'est pas déjà fait, " +
          "et de poser vos questions en ticket si besoin.*",
      }
    )
    .setFooter({
      text: "Bienvenue dans la nouvelle ère — avec respect, entraide et ambition",
    })
    .setTimestamp();
}

async function setupReopeningAnnouncement(client) {
  const channel = await client.channels
    .fetch(ANNOUNCE_CHANNEL_ID)
    .catch(() => null);

  if (!channel?.isTextBased()) {
    console.warn(`Salon annonce ${ANNOUNCE_CHANNEL_ID} introuvable`);
    return;
  }

  const guild = channel.guild;
  const embed = buildReopeningEmbed(guild);

  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const existing = messages?.find(
    (m) =>
      m.author.id === client.user.id &&
      m.embeds[0]?.title?.includes(ANNOUNCE_TITLE_MARKER)
  );

  const mentionEveryone = {
    content: "@everyone",
    allowedMentions: { parse: ["everyone"] },
  };

  if (existing) {
    await existing.edit({ embeds: [embed] });
    console.log("Annonce nouvelle ère mise à jour (sans nouveau ping)");
  } else {
    await channel.send({
      ...mentionEveryone,
      embeds: [embed],
    });
    console.log("Annonce nouvelle ère publiée avec @everyone");
  }
}

// --- Annonce de la V3 : publiée une seule fois ---

const fs = require("fs");
const V3_TITLE = "🦋 La Maison passe en V3 ! 🦋";
const STATE_FILE = require("./data").dataFile("annonces-state.json");

function loadAnnonces() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

function buildV3Embeds() {
  return [
    new EmbedBuilder()
      .setColor(0x8b0000)
      .setTitle(V3_TITLE)
      .setDescription(
        "La Maison change de dimension : économie, politique, business… tout a été repensé pour que **chacun puisse construire sa place**. Voici ce qui arrive 👇"
      )
      .addFields(
        {
          name: "💰 L'économie",
          value:
            "• `/solde` pour voir votre argent, et un **classement des plus grandes fortunes**\n" +
            "• `/profil` : votre **carte d'identité** de la Maison (quartier, travail, fonctions, associations, rang…)",
        },
        {
          name: "🏙️ Les quartiers",
          value:
            "La Maison est désormais divisée en **quartiers parisiens** : 💎 Haussmann, 🌳 Le Marais, 🎨 Montmartre et 🏘️ Belleville. " +
            "Chaque quartier a son ambiance, ses équipements et sa taxe. Envie de changer ? Faites une **demande de déménagement** depuis le tableau des chambres.",
        },
        {
          name: "🏢 Les entreprises",
          value:
            "Créez votre entreprise au **Registre du commerce** (rôle Entrepreneur et licence requis), embauchez, servez des clients, facturez, versez des salaires… " +
            "Les offres d'emploi sont publiées dans le salon recrutement.",
        },
        { name: "🏡 L'Airbnb", value: "Mettez vos biens en location : des voyageurs du monde entier vous envoient des demandes de réservation." },
        {
          name: "🎰 Le casino",
          value: "Blackjack, roulette, machine à sous avec **jackpot**, et défis entre membres. Ouvert **du vendredi 20h au lundi 2h**.",
        }
      ),
    new EmbedBuilder()
      .setColor(0xf1c40f)
      .addFields(
        {
          name: "🏛️ La Mairie",
          value:
            "**Élections chaque trimestre !** Le maire gère le budget de la ville, fixe les impôts, verse des aides, crée des **associations**… " +
            "et choisit même le **régime** : 🗳️ démocratie, 👑 monarchie, ⚔️ dictature ou 🏴 anarchie. Tout est publié au **Journal officiel**. " +
            "Et si le maire abuse, une **pétition** peut mener à sa destitution.",
        },
        {
          name: "🗳️ Première élection : maintenant !",
          value: "📝 Candidatures du **1er au 3 octobre**\n📣 Campagne du **4 au 6 octobre**\n🗳️ Vote du **7 au 8 octobre à 21h**",
        },
        {
          name: "🧾 Les impôts",
          value:
            "Chaque dimanche : taxe d'habitation (selon votre quartier) et impôt sur la fortune. Tout est expliqué dans le **centre des impôts**. " +
            "L'**IRF** veille sur les comptes et mène des contrôles fiscaux 👀",
        },
        {
          name: "🤝 Les associations",
          value: "Créées par la Mairie : rejoignez-en une, participez aux activités, ou proposez la vôtre au maire !",
        },
        {
          name: "🏠 Deux espaces rien qu'à vous",
          value: "🌸 La **Maison des Jeunes** et 💼 la **Maison des Entrepreneurs** : chacun son espace, ses salons et ses règles.",
        }
      )
      .setFooter({ text: "Prenez le temps de découvrir les nouveaux salons, et posez vos questions en ticket. Bienvenue dans la Maison V3 🦋" })
      .setTimestamp(),
  ];
}

async function publishV3Announcement(client) {
  const state = loadAnnonces();
  if (state.v3MessageId) return;

  const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) {
    console.warn(`Salon annonce ${ANNOUNCE_CHANNEL_ID} introuvable`);
    return;
  }

  // Déjà publiée (données perdues entre-temps) : on ne la reposte pas.
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === V3_TITLE);
  if (existing) {
    state.v3MessageId = existing.id;
  } else {
    const message = await channel.send({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
      embeds: buildV3Embeds(),
    });
    state.v3MessageId = message.id;
    console.log("Annonce V3 publiée avec @everyone");
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Vidéo de présentation de la V3 : publiée une seule fois, sous l'annonce ---

const V3_VIDEO_FILE = require("path").join(__dirname, "assets", "la-maison-v3.mp4");
const V3_VIDEO_NAME = "la-maison-v3.mp4";

async function publishV3Video(client) {
  const state = loadAnnonces();
  if (state.v3VideoMessageId || !fs.existsSync(V3_VIDEO_FILE)) return;

  const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;

  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find(
    (m) => m.author.id === client.user.id && m.attachments.some((a) => a.name === V3_VIDEO_NAME)
  );
  if (existing) {
    state.v3VideoMessageId = existing.id;
  } else {
    const message = await channel.send({
      content: "🎬 **La Maison V3 en vidéo** 🦋",
      files: [{ attachment: V3_VIDEO_FILE, name: V3_VIDEO_NAME }],
    });
    state.v3VideoMessageId = message.id;
    console.log("Vidéo V3 publiée");
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Annonce : le recrutement repasse par la candidature (publiée une seule fois) ---

const RECRUTEMENT_TITLE = "📋 Le recrutement revient en candidature";

async function publishRecruitmentAnnouncement(client) {
  const state = loadAnnonces();
  if (state.recrutementMessageId) return;

  const channel = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;

  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  const existing = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === RECRUTEMENT_TITLE);
  if (existing) {
    state.recrutementMessageId = existing.id;
  } else {
    const message = await channel.send({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
      embeds: [
        new EmbedBuilder()
          .setColor(0x800020)
          .setTitle(RECRUTEMENT_TITLE)
          .setDescription(
            "Le recrutement par **parrainage** est terminé : pour rejoindre la Maison, il faut désormais **déposer une candidature**."
          )
          .addFields(
            {
              name: "📝 Comment candidater ?",
              value:
                `1. Rendez-vous dans <#${PANEL_LINKS.tickets}> et ouvrez un ticket **Candidature**\n` +
                "2. Répondez au questionnaire, question par question\n" +
                "3. Le staff étudie votre candidature et vote\n" +
                "4. Vous recevez la réponse directement dans votre ticket",
            },
            {
              name: "💡 Bon à savoir",
              value:
                "• Répondez **sérieusement** : c'est votre première impression auprès du staff\n" +
                "• Vous pouvez reprendre votre questionnaire là où vous vous êtes arrêté(e)\n" +
                "• Un doute ? Ouvrez un ticket **Question**",
            }
          )
          .setFooter({ text: "La Maison — recrutement sur candidature 🦋" })
          .setTimestamp(),
      ],
    });
    state.recrutementMessageId = message.id;
    console.log("Annonce recrutement publiée avec @everyone");
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

module.exports = {
  publishRecruitmentAnnouncement,
  setupReopeningAnnouncement,
  publishV3Announcement,
  publishV3Video,
  ANNOUNCE_CHANNEL_ID,
};
