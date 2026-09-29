const { EmbedBuilder } = require("discord.js");

const RULES_COLOR = 0x8b0000;
const RULES_TITLE = "📖 Règlement Officiel — Maison";
// Limite Discord : 4096 caractères par description d'embed
const MAX_DESCRIPTION = 4000;

const RULES_INTRO = `Bienvenue au sein de la Maison.

Merci de lire attentivement le présent règlement avant de participer à la vie de la Maison.

Ces règles ont pour objectif de garantir un environnement sain, sécurisé, propre, calme et agréable pour l'ensemble des membres.

Le règlement s'applique à tous les membres, sans exception.`;

const RULES_SECTIONS = [
  {
    title: "🤝 Respect & Comportement",
    body: `• Le respect entre tous les membres est obligatoire.
• Les insultes, provocations, conflits et attaques personnelles sont interdits.
• Un comportement mature, calme et respectueux est attendu en permanence.
• Le respect du staff et des décisions prises est obligatoire.
• Les désaccords doivent être réglés calmement et ne doivent pas perturber la vie des autres membres.
• Il est interdit d'humilier, d'isoler volontairement ou de monter les membres les uns contre les autres.
• Les problèmes importants doivent être signalés à Nina ou Morgane plutôt que de dégénérer entre membres.`,
  },
  {
    title: "🔒 Confidentialité & Sécurité",
    body: `• Il est interdit de partager les informations personnelles appartenant à une autre personne sans son autorisation.
• Il est interdit de communiquer publiquement l'adresse exacte de la Maison.
• Il est strictement interdit de prendre en photo ou de filmer la Maison, ses pièces, ses installations ou ses biens sans autorisation préalable.
• Il est interdit de publier ou partager des photos ou vidéos de la Maison ou de ses biens sans autorisation.
• Toute photo, vidéo ou information permettant d'identifier un membre ou un membre du personnel ne doit pas être publiée sans son accord.
• Tout harcèlement, menace ou intimidation pourra entraîner une sanction immédiate.
• Les contenus illégaux, violents, choquants ou inappropriés sont strictement interdits.`,
  },
  {
    title: "📱 Téléphones & Vie privée",
    body: `• Il est interdit de filmer, photographier ou enregistrer un membre sans son accord.
• Il est interdit de publier ou partager une photo, une vidéo ou une conversation privée d'un membre sans son autorisation.
• Les conversations privées, messages et informations personnelles doivent rester confidentiels.
• Il est interdit de fouiller dans le téléphone, l'ordinateur ou les affaires numériques d'un autre membre sans son autorisation.
• Il est interdit d'utiliser des enregistrements ou captures d'écran pour provoquer, humilier ou faire pression sur un autre membre.
• Toute publication concernant la Maison, ses membres ou son organisation doit respecter les règles de confidentialité.
• Tout problème lié à la vie privée doit être signalé à Nina ou Morgane.`,
  },
  {
    title: "🏠 Vie dans la Maison",
    body: `• L'hébergement est un privilège, pas un droit acquis.
• Chaque membre doit contribuer à maintenir un environnement sain et bienveillant.
• L'accès est autorisé uniquement à votre propre chambre, sauf autorisation de son occupant.
• Il est interdit d'entrer dans la chambre d'un autre membre sans son accord.
• Les espaces communs doivent rester propres et accessibles à tous.
• Chaque membre est responsable de ranger ce qu'il utilise.
• Les affaires personnelles ne doivent pas être laissées durablement dans les espaces communs.
• Toute dégradation volontaire ou résultant d'une négligence importante doit être immédiatement signalée.
• Toute absence de plus de 7 jours sans prévenir peut entraîner la perte de votre place.
• Un départ temporaire doit, dans la mesure du possible, être signalé à l'avance.
• L'hébergement peut être réévalué en cas de non-respect répété du règlement.`,
  },
  {
    title: "🚪 Invités & Personnes extérieures",
    body: `• Aucun invité ne peut passer la nuit dans la Maison sans autorisation préalable.
• Toute personne extérieure invitée dans la Maison doit être signalée à Nina ou Morgane.
• Les invités restent sous la responsabilité de la personne qui les a invités.
• Un membre ne peut pas inviter régulièrement des personnes extérieures sans en informer les responsables.
• En cas de problème de sécurité ou de comportement, l'accès d'un invité peut être immédiatement refusé.
• Le nombre d'invités peut être limité selon la capacité de la Maison et la situation.`,
  },
  {
    title: "🧹 Propreté & Vie collective",
    body: `• Chacun doit nettoyer et ranger après avoir utilisé un espace commun.
• La cuisine doit être laissée propre après utilisation.
• La vaisselle ne doit pas être abandonnée volontairement dans les espaces communs.
• Les salles de bain doivent rester propres après utilisation.
• Il est interdit de laisser volontairement une chambre ou un espace commun dans un état nécessitant un nettoyage anormalement important.
• Les membres doivent respecter le travail du personnel de la Maison.
• La femme de ménage, le cuisinier et le chauffeur ne sont pas des domestiques personnels et doivent être traités avec respect.
• Il est interdit de leur imposer des demandes personnelles abusives ou répétitives.`,
  },
  {
    title: "🍽️ Repas & Cuisine",
    body: `• Les repas préparés par le cuisinier sont destinés à l'ensemble des membres selon l'organisation prévue.
• Lorsqu'un membre sait qu'il ne mangera pas à la Maison, il doit prévenir suffisamment tôt afin d'éviter le gaspillage.
• Il est interdit de prendre ou de consommer volontairement la nourriture prévue pour quelqu'un d'autre sans son accord.
• Les aliments personnels doivent être respectés.
• Toute allergie ou contrainte alimentaire importante doit être signalée aux responsables.
• La cuisine doit être rangée après utilisation, même lorsqu'un membre cuisine pour lui-même.`,
  },
  {
    title: "🚗 Chauffeur & Personnel",
    body: `• Le chauffeur est à la disposition de la Maison selon les horaires et l'organisation définis.
• Les trajets personnels doivent rester raisonnables et compatibles avec les besoins des autres membres.
• Il est interdit d'exiger un trajet ou un service comme s'il s'agissait d'un droit automatique.
• Les demandes doivent être formulées avec respect.
• Les membres doivent respecter les horaires et les consignes données par le personnel.
• En cas de désaccord concernant l'organisation du personnel, celui-ci doit être signalé à Morgane ou Suzanna.`,
  },
  {
    title: "💼 Affaires personnelles & Matériel",
    body: `• Il est interdit d'utiliser les affaires d'un autre membre sans son autorisation.
• Cela concerne notamment les vêtements, appareils électroniques, véhicules, ordinateurs et objets personnels.
• Toute perte ou détérioration d'un objet appartenant à quelqu'un d'autre doit être immédiatement signalée.
• Les équipements appartenant à la Maison doivent être utilisés correctement.
• Aucun membre ne doit profiter de la situation financière de la Maison pour exiger des achats ou dépenses personnelles injustifiées.`,
  },
  {
    title: "🚫 Contenus & Actions interdites",
    body: `• Le spam, les dramas et les provocations sont interdits.
• Toute publicité sans autorisation est interdite.
• Les relations sexuelles au sein de la Maison sont interdites.
• Les nudes et contenus sexuels sont strictement interdits.
• Toute activité illégale est strictement interdite au sein de la Maison.
• Il est interdit d'organiser une fête ou un événement important sans prévenir les responsables.
• La consommation ou la présence de substances illégales est strictement interdite.`,
  },
  {
    title: "⏰ Horaires & Organisation",
    body: `### Sorties autorisées :

• Mineurs : jusqu'à 21h00
• Majeurs : jusqu'à 00h00

Après ces horaires, les portes de la Maison sont considérées comme fermées.

• Toute sortie exceptionnelle après l'horaire prévu doit être signalée à l'avance lorsque cela est possible.
• En cas de retour tardif exceptionnel, le membre doit éviter de déranger les personnes présentes.

### Horaires de calme :

• Les espaces communs doivent rester calmes après 23h00.
• Après 23h00, la musique forte, les cris et les activités bruyantes sont interdits.
• Les membres doivent respecter les personnes qui dorment ou étudient.
• Toute soirée ou rassemblement important doit être signalé à l'avance.`,
  },
  {
    title: "🗣️ Réunions obligatoires",
    body: `• Une réunion de la Maison est organisée régulièrement afin de faire le point sur la vie collective.
• La présence de tous les membres est obligatoire, sauf raison valable ou absence préalablement signalée.
• Chaque membre peut prendre la parole pour signaler un problème, proposer une amélioration ou faire part d'une difficulté.
• Les problèmes concernant la vie commune doivent être abordés pendant les réunions plutôt que de créer des conflits entre membres.
• Les décisions prises lors des réunions doivent être respectées lorsqu'elles ont été validées par les responsables.
• Les réunions peuvent notamment porter sur la propreté, les horaires, les repas, les invités, l'organisation du personnel et les problèmes rencontrés dans la Maison.
• Un membre qui manque régulièrement les réunions sans raison valable peut recevoir un rappel à l'ordre.
• Morgane peut convoquer une réunion exceptionnelle lorsqu'une situation nécessite une décision rapide.
• Les réunions doivent rester calmes et respectueuses.
• Couper volontairement la parole, provoquer ou empêcher les autres de s'exprimer est interdit.`,
  },
  {
    title: "📚 Études & Autonomie",
    body: `• La Maison ayant notamment pour objectif d'aider les personnes souhaitant étudier ou améliorer leur situation, chacun doit respecter les espaces et horaires nécessaires au travail.
• Il est interdit de volontairement déranger une personne pendant ses études, son travail ou ses examens.
• Chaque membre est encouragé à profiter des possibilités offertes par la Maison afin de construire progressivement son autonomie.
• L'aide proposée par la Maison ne doit pas être considérée comme une situation permanente garantie.
• Lorsqu'un membre devient financièrement ou personnellement autonome, une discussion peut être organisée concernant la suite de son hébergement.`,
  },
  {
    title: "🏛️ Organisation & Responsabilités",
    body: `• Nina est la déléguée des membres et représente leurs préoccupations auprès des responsables.
• Morgane est responsable de l'application et de l'organisation du règlement au quotidien.
• Les membres doivent respecter les demandes raisonnables formulées par les responsables.
• Les membres peuvent proposer des modifications ou améliorations du fonctionnement de la Maison.
• Morgane peut proposer de nouvelles règles lorsqu'une situation particulière le nécessite.
• Toute nouvelle règle importante doit être communiquée aux membres avant son application.
• La Propriétaire conserve la décision finale concernant l'hébergement et les décisions majeures de la Maison.`,
  },
  {
    title: "🙋 Responsabilités des membres",
    body: `• Chaque membre est responsable de son comportement au sein de la Maison.
• Chaque membre doit respecter les autres occupants ainsi que le personnel.
• Chaque membre doit signaler rapidement tout problème pouvant affecter la sécurité, la propreté ou le bon fonctionnement de la Maison.
• Nul ne peut se servir de son ancienneté, de ses relations ou de sa proximité avec la Propriétaire pour se placer au-dessus du règlement.
• Les règles s'appliquent de la même manière à tous les membres.`,
  },
  {
    title: "📝 Modification du règlement",
    body: `• Le règlement peut être modifié lorsque cela est nécessaire au bon fonctionnement de la Maison.
• Toute modification importante doit être communiquée aux membres.
• L'ignorance d'une règle après sa communication ne constitue pas une excuse.
• Les règles ont pour objectif de protéger la vie collective et la sécurité de chacun.`,
  },
  {
    title: "⚖️ Sanctions",
    body: `Les sanctions sont appliquées en fonction de la gravité des faits, de leur répétition et du comportement du membre concerné.

• Un rappel à l'ordre peut être effectué en cas de manquement mineur.
• Des restrictions temporaires peuvent être appliquées en cas de comportement répété.
• Une convocation avec Morgane ou Nina peut être organisée lorsqu'un problème nécessite une discussion.
• Les faits graves peuvent entraîner une exclusion temporaire ou définitive de la Maison.
• Les dégradations volontaires, atteintes à la sécurité ou violations graves de la vie privée peuvent entraîner une sanction immédiate.
• La décision finale concernant l'hébergement revient à la Propriétaire.
• Les sanctions doivent être proportionnées aux faits et tenir compte du contexte.`,
  },
  {
    title: "📌 Rappel important",
    body: `La Maison est un lieu de vie et d'entraide.

Le fait que l'hébergement, les repas, le personnel ou certains services soient pris en charge ne signifie pas qu'ils peuvent être considérés comme acquis ou utilisés sans limite.

Chaque membre doit contribuer, à son niveau, au bon fonctionnement de la Maison.

Le respect, la confiance, la discrétion et la responsabilité sont essentiels.`,
  },
  {
    title: "✅ Acceptation du règlement",
    body: `En restant sur ce serveur et en bénéficiant de l'hébergement de la Maison, vous reconnaissez avoir pris connaissance du présent règlement et acceptez de le respecter.

Le règlement existe afin que chacun puisse vivre, étudier et évoluer dans la Maison dans les meilleures conditions possibles.`,
  },
];

// Découpe le règlement en pages (une page = un embed = un message),
// car il dépasse la limite de taille d'un seul embed Discord.
function buildRulesPages() {
  const blocks = [
    RULES_INTRO,
    ...RULES_SECTIONS.map((s) => `## ${s.title}\n\n${s.body}`),
  ];
  const pages = [];
  let current = "";
  for (const block of blocks) {
    const next = current ? `${current}\n\n━━━━━━━━━━━━━━━━━━━━\n\n${block}` : block;
    if (next.length > MAX_DESCRIPTION && current) {
      pages.push(current);
      current = block;
    } else {
      current = next;
    }
  }
  if (current) pages.push(current);
  return pages;
}

function buildRulesEmbeds() {
  const pages = buildRulesPages();
  return pages.map((description, i) => {
    const embed = new EmbedBuilder().setColor(RULES_COLOR).setDescription(description);
    if (i === 0) embed.setTitle(RULES_TITLE);
    if (pages.length > 1) embed.setFooter({ text: `Page ${i + 1}/${pages.length}` });
    return embed;
  });
}

module.exports = { buildRulesEmbeds };
