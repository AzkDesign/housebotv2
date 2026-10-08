
// --- Chapitre 2 : Les Nuits de Paris ---
const BOSS_MOLOSSE = {
  who: "molosse",
  hp: 150,
  atk: 26,
  pattern: ["attack", "attack", "guard", "ruse", "attack", "guard"],
  tells: {
    attack: "Le Molosse fait craquer ses jointures et avance d'un pas lourd…",
    guard: "Le Molosse croise les bras devant son visage et attend…",
    ruse: "Le Molosse sourit en coin, son regard file vers votre gauche…",
  },
};
SC("c2_00", {
  ch: 2,
  ep: true,
  title: "Les Nuits de Paris",
  bg: "toits",
  text: (S) =>
    "*Trois jours ont passé. Le Fondateur n'est pas revenu. Officiellement, il est « en voyage ». Officieusement, la Maison retient son souffle.*\n\n" +
    ({
      casino: "Ce matin, une enveloppe noire vous attendait à la loge d'Augustin. Une seule ligne, à l'encre rouge : *« Ce soir, 23 h. Casino de la Nuit. Demandez Velours. »* Pas de signature. Juste une empreinte de rouge à lèvres.",
      irf: "L'inspectrice Valence vous a donné rendez-vous dans un café de Pigalle. Elle a glissé sur la table un petit micro, pas plus gros qu'un bouton. *« Les deux millions sont passés par le Casino de la Nuit. Entrez, écoutez, sortez. Et ne vous faites pas remarquer. »*",
      mairie: "À la Mairie, un assistant trop bavard vous a confié que **Monsieur le Maire** passe tous ses vendredis soir au **Casino de la Nuit**. « Pour se détendre », a-t-il précisé avec un clin d'œil. On est vendredi.",
    }[S.get("piste")] ?? "Tous les chemins mènent au même endroit : le Casino de la Nuit.") +
    "\n\nToutes les pistes mènent au même endroit. Et ce soir, il pleut encore.",
  fx: (S) => {
    if (S.get("piste") === "irf") S.give("micro");
  },
  choices: [{ label: "Se rendre au Casino de la Nuit", emoji: "🎰", to: "c2_01" }],
});
SC("c2_01", {
  ch: 2,
  bg: "rue_pluie",
  who: "molosse",
  mood: "pluie",
  text: (S) =>
    "Le Casino de la Nuit n'a pas d'enseigne. Juste une porte rouge, un néon qui grésille et, devant, une montagne en costume noir : **le Molosse**.\n\n" +
    "— Liste, *grogne-t-il sans même vous regarder.*\n\n— Pardon ?\n\n— Votre nom. Sur la liste. Pas de nom, pas d'entrée.\n\n" +
    "Il consulte une tablette, fait défiler, et secoue lentement la tête." +
    (S.get("piste") === "casino" ? "\n\n*L'enveloppe noire de Velours est dans votre poche.*" : "") +
    (S.has("ruelle") ? "\n\n*Vous repensez à la ruelle derrière la Maison : les bâtiments de Paris ont toujours une porte de service.*" : ""),
  choices: [
    { label: "Montrer l'invitation de Velours", emoji: "💌", to: "c2_03", if: (S) => S.get("piste") === "casino", fx: (S) => S.rep("casino", 1) },
    { label: "Glisser un « pourboire » au Molosse", emoji: "💸", cost: 40, to: "c2_03", fx: (S) => S.mem("Le Molosse vous a laissé entrer… contre un pourboire.") },
    {
      label: "Le défier : « Un duel, et je passe. »",
      emoji: "⚔️",
      duel: { boss: BOSS_MOLOSSE, ok: "c2_03", ko: "c2_02", desc: "Le Molosse éclate de rire. « Un duel ? Avec tes petites cartes ? Allez, amuse-moi. »", okFx: (S) => { S.rep("casino", 2); S.set("respect_molosse"); S.mem("Vous avez battu le Molosse en duel devant tout le monde."); } },
    },
    {
      label: "Contourner par les cuisines",
      emoji: "🍳",
      test: { label: "Se faufiler par les cuisines", diff: 48, ok: "c2_03k", ko: "c2_02", desc: "La porte de service est gardée par un plongeur distrait. Il faut passer au bon moment." },
    },
  ],
});
SC("c2_02", {
  ch: 2,
  bg: "rue_pluie",
  who: "noe",
  mood: "pluie",
  text:
    "Vous finissez assis sur le trottoir mouillé, l'orgueil en miettes. Une ombre s'accroupit à côté de vous, capuche relevée, des écouteurs autour du cou.\n\n" +
    "— Joli vol plané. Noé, cinquième étage. On s'est croisés dans l'escalier. *Il agite une carte magnétique.* Badge de livreur du Casino. Je l'ai… disons, *emprunté* au système.\n\n" +
    "— Pourquoi tu m'aides ?\n\n" +
    "— Parce que le Fondateur m'a hébergé quand personne ne voulait de moi. Et parce que j'aime pas les gens qui disparaissent sans rien dire.",
  fx: (S) => {
    S.set("aide_noe");
    S.rep("fondation", 1);
    S.mem("Noé, le résident du cinquième, vous a fait entrer au Casino avec un badge piraté.");
  },
  choices: [{ label: "Le suivre par la porte de service", emoji: "🪪", to: "c2_03k" }],
});
SC("c2_03k", {
  ch: 2,
  bg: "casino",
  text: (S) =>
    "Les cuisines, puis un couloir, puis un rideau de velours… et soudain, la lumière.\n\n" +
    (S.has("aide_noe") ? "— Je reste dans le coin, *souffle Noé avant de disparaître.* Si ça tourne mal, je coupe le courant.\n\n" : "") +
    "Le Casino de la Nuit s'étale devant vous : des lustres comme des cascades de diamants, des tables de jeu vert sombre, des rires feutrés, de la fumée qui danse dans la lumière dorée.",
  choices: [{ label: "Chercher Velours", emoji: "🌹", to: "c2_04" }],
});
SC("c2_03", {
  ch: 2,
  bg: "casino",
  text: (S) =>
    (S.has("respect_molosse") ? "Le Molosse se relève en se frottant la mâchoire, puis vous ouvre la porte lui-même. Un murmure parcourt la file d'attente. *On vous regarde différemment, déjà.*\n\n" : "La porte rouge s'ouvre.\n\n") +
    "Le Casino de la Nuit s'étale devant vous : des lustres comme des cascades de diamants, des tables de jeu vert sombre, des rires feutrés, de la fumée qui danse dans la lumière dorée." +
    (S.item("micro") ? "\n\n*Le micro de Valence est discrètement épinglé à votre col. Quelque part, l'IRF écoute.*" : ""),
  choices: [{ label: "Chercher Velours", emoji: "🌹", to: "c2_04" }],
});
SC("c2_04", {
  ch: 2,
  ep: true,
  bg: "casino",
  who: "velours",
  text: (S) =>
    "Elle est à la table de blackjack du fond, en robe rouge, et elle distribue les cartes comme on joue du piano. Quand elle lève les yeux vers vous, toute la table se tait.\n\n" +
    `— Alors c'est toi, ${S.name}. Le petit nouveau qu'il a choisi.\n\n` +
    "Velours pose le paquet. Son sourire est magnifique et ne réchauffe rien.\n\n" +
    "— Le Fondateur était un vieil ami. Et un très mauvais perdant. Il y a un mois, il a joué ici. Gros. Et il a perdu quelque chose qui ne lui appartenait pas vraiment : **la Maison**. Le contrat dort à l'Hôtel de Ville, sous la protection de notre cher Maire.\n\n" +
    "Elle tapote le tapis vert.\n\n— Tu veux en savoir plus ? Ici, l'information se gagne.",
  choices: [
    {
      label: "Jouer une partie contre elle",
      emoji: "🃏",
      test: {
        label: "Battre Velours au blackjack",
        diff: 62,
        ok: "c2_05w",
        ko: "c2_05l",
        desc: "Velours ne perd jamais. C'est ce qu'on dit. Votre meilleure carte porte-bonheur ne sera pas de trop.",
      },
    },
    { label: "Lui montrer le Jeu du Fondateur", emoji: "🃏", to: "c2_05j", if: (S) => S.item("jeu"), stat: true },
    { label: "« Je sais pour Arnaud. Parlez, ou je parle. »", emoji: "🗡️", to: "c2_05m", if: (S) => S.has("sait_arnaud") || S.item("gant"), stat: true, fx: (S) => { S.rep("casino", -2); S.moral(-1); } },
  ],
});
SC("c2_05w", {
  ch: 2,
  bg: "casino",
  who: "velours",
  text:
    "Vingt et un. Le silence autour de la table devient presque religieux. Velours regarde vos cartes, puis vous, et éclate d'un rire sincère.\n\n" +
    "— Le vieux savait choisir. *Elle fait glisser vers vous un jeton noir, mat, frappé d'un pique doré.* Garde ça. Avec ce jeton, n'importe quelle porte de ce casino s'ouvre.\n\n" +
    "Elle se penche, sa voix devient un murmure.\n\n— Le Fondateur n'a pas perdu la Maison au jeu. **On lui a fait signer quelque chose.** Cherche du côté de celui qui porte des gants hors de prix.",
  fx: (S) => {
    S.give("jeton");
    S.rep("casino", 2);
    S.mem("Velours : le Fondateur n'a pas perdu la Maison au jeu, on lui a fait signer quelque chose.");
  },
  choices: [{ label: "« Merci… » (soudain, les lumières vacillent)", emoji: "💡", to: "c2_06" }],
});
SC("c2_05l", {
  ch: 2,
  bg: "casino",
  who: "velours",
  text:
    "Vingt-deux. Perdu. Velours ramasse les cartes avec une douceur presque désolée.\n\n" +
    "— Tu me devras une faveur, petit. Un jour, je viendrai la réclamer. Et ce jour-là, tu ne pourras pas dire non.\n\n" +
    "Elle hésite, puis ajoute, plus bas :\n\n— Un conseil gratuit, parce que tu lui ressembles un peu : méfie-toi des hommes qui ne portent qu'un seul gant.",
  fx: (S) => {
    S.set("dette_velours");
    S.mem("Vous devez une faveur à Velours.");
  },
  choices: [{ label: "Encaisser… (soudain, les lumières vacillent)", emoji: "💡", to: "c2_06" }],
});
SC("c2_05j", {
  ch: 2,
  bg: "casino",
  who: "velours",
  prop: "jeu",
  text:
    "Quand vous posez le Jeu sur le tapis, Velours cesse de respirer. Sa main gantée de rouge s'approche du Joker sans oser le toucher.\n\n" +
    "— Il te l'a laissé… *Sa voix se brise une fraction de seconde, puis se raffermit.* Écoute-moi bien. **Ne montre jamais ce jeu à Delorme.** Jamais. Le Maire donnerait n'importe quoi pour l'avoir, et je ne sais pas encore pourquoi.\n\n" +
    "Elle referme vos doigts sur le paquet.\n\n— Range-le. Maintenant.",
  fx: (S) => {
    S.rep("casino", 2);
    S.set("velours_sait_jeu");
    S.mem("Velours vous a prévenu : ne jamais montrer le Jeu au Maire.");
  },
  choices: [{ label: "Ranger le Jeu (soudain, les lumières vacillent)", emoji: "💡", to: "c2_06" }],
});
SC("c2_05m", {
  ch: 2,
  bg: "casino",
  who: "velours",
  mood: "danger",
  text:
    "Le sourire de Velours ne bouge pas. Ce sont ses yeux qui changent.\n\n" +
    "— Des menaces. Chez moi. *Elle claque des doigts ; deux hommes en noir se rapprochent.* Tu as du cran, je te l'accorde. Mais le cran, ici, ça se paie.\n\n" +
    "Elle fait signe aux hommes de s'arrêter, d'un geste las.\n\n— Arnaud n'est qu'un pion. Le vrai joueur porte une écharpe tricolore. Maintenant, disparais de ma vue.",
  fx: (S) => S.mem("Velours, furieuse : « Arnaud n'est qu'un pion, le vrai joueur porte une écharpe tricolore. »"),
  choices: [{ label: "Reculer… (soudain, les lumières vacillent)", emoji: "💡", to: "c2_06" }],
});
SC("c2_06", {
  ch: 2,
  bg: "casino",
  mood: "danger",
  text: (S) =>
    "**Noir total.**\n\nUn cri. Le fracas d'une table renversée. Des jetons qui roulent sur le marbre. Quand les lumières de secours se rallument, rouges et tremblantes, la porte du bureau de Velours est grande ouverte.\n\n" +
    "Une silhouette en manteau sombre file vers l'escalier de service, un gros registre relié de cuir sous le bras." +
    (S.item("gant") ? "\n\n*Sa main droite est nue. Il lui manque un gant. Le vôtre.*" : "") +
    (S.has("aide_noe") ? "\n\n— Ce n'est pas moi qui ai coupé le courant ! *grésille la voix de Noé dans votre oreillette.*" : ""),
  fx: (S) => {
    if (S.item("gant")) {
      S.set("reconnait_arnaud");
      S.mem("Le voleur du Casino ne portait qu'un gant — comme celui trouvé dans la ruelle.");
    }
  },
  choices: [
    { label: "Poursuivre le voleur sur les toits", emoji: "🏃", to: "c2_07", stat: true },
    { label: "Rester protéger Velours", emoji: "🛡️", to: "c2_07b", stat: true, fx: (S) => S.rep("casino", 1) },
    { label: "Profiter du chaos pour fouiller son bureau", emoji: "🕵️", to: "c2_07c", stat: true, fx: (S) => S.moral(-1) },
  ],
});
SC("c2_07", {
  ch: 2,
  ep: true,
  bg: "toits",
  mood: "pluie",
  text: (S) =>
    "L'escalier de service débouche sur les toits. Le zinc est glissant, la pluie vous fouette le visage, et la silhouette court devant vous, de cheminée en cheminée, le registre serré contre elle.\n\n" +
    "Entre deux immeubles s'ouvre un vide de deux mètres. Six étages plus bas, la rue brille comme un miroir.\n\n" +
    "Il saute. Il passe." +
    (S.owns("p_eiffel") ? "\n\n*Au loin, la Tour Eiffel scintille. Vous connaissez ce quartier par cœur — vous avez sa carte.*" : ""),
  choices: [
    { label: "Couper par la rue de la Tour (carte Tour Eiffel)", emoji: "🗼", to: "c2_08", lock: { if: (S) => S.owns("p_eiffel"), why: "Il faudrait connaître Paris (carte Tour Eiffel)" }, fx: (S) => S.mem("Grâce à la Tour Eiffel, vous avez coupé la route du voleur.") },
    {
      label: "Sauter à votre tour",
      emoji: "🦘",
      test: { label: "Sauter entre les deux toits", diff: 55, ok: "c2_08", ko: "c2_08b", desc: "Deux mètres de vide, du zinc mouillé, aucun droit à l'erreur." },
    },
  ],
});
SC("c2_08", {
  ch: 2,
  bg: "toits",
  mood: "pluie",
  prop: "contrat",
  text: (S) =>
    "Vous retombez sur l'autre toit et, dans votre élan, vous attrapez le manteau du voleur. Il se dégage d'un coup d'épaule, mais le registre lui échappe et glisse jusqu'à vos pieds.\n\n" +
    "Il se retourne une seconde. Le temps d'un éclair, vous voyez **une chevalière dorée frappée d'un A**." +
    (S.has("reconnait_arnaud") ? " Et une main droite nue." : "") +
    " Puis il disparaît dans une lucarne.\n\n" +
    "Vous ouvrez le registre sous la pluie. Des colonnes de chiffres… et, page après page, des versements d'**Arnaud & Fils** vers un seul destinataire, désigné par une initiale : **« D. »**",
  fx: (S) => {
    S.give("registre");
    S.mem("Le registre du Casino prouve des versements d'Arnaud & Fils à un certain « D. ».");
  },
  choices: [{ label: "Rentrer avant l'aube", emoji: "🌅", to: "c2_09" }],
});
SC("c2_08b", {
  ch: 2,
  bg: "toits",
  mood: "danger",
  text:
    "Votre pied glisse sur le bord du zinc. Le monde bascule. Vous vous rattrapez à la gouttière, les jambes dans le vide, la pluie dans les yeux.\n\n" +
    "Des pas reviennent vers vous. Une main gantée — **une seule** — se tend… et vous hisse sur le toit.\n\n" +
    "— Laisse tomber, petit, *murmure une voix grave.* Rentre chez toi. Cette histoire te dépasse.\n\n" +
    "Le temps que vous repreniez votre souffle, il est parti. Mais sur le zinc, une page arrachée du registre est restée coincée sous une tuile : des versements d'**Arnaud & Fils** à un certain **« D. »**",
  fx: (S) => {
    S.give("registre");
    S.set("sauve_par_voleur");
    S.mem("Le voleur des toits vous a sauvé la vie. Pourquoi ?");
  },
  choices: [{ label: "Rentrer avant l'aube", emoji: "🌅", to: "c2_09" }],
});
SC("c2_07b", {
  ch: 2,
  bg: "casino",
  who: "velours",
  text:
    "Vous restez près de Velours pendant que le Casino se vide dans la panique. Quand le calme revient, elle vous regarde autrement. Moins comme un pion. Presque comme un allié.\n\n" +
    "— Tu es resté. Personne ne reste, d'habitude.\n\n" +
    "Elle vous tend une petite clé dorée en forme de cœur.\n\n— Mon salon privé. Si un jour tu as besoin de te cacher… Et puisque tu es resté, je te dois la vérité : le voleur travaille pour **Arnaud & Fils**. Et Arnaud travaille pour quelqu'un d'autre.",
  fx: (S) => {
    S.give("cle_velours");
    S.rep("casino", 2);
    S.mem("Velours vous a confié la clé de son salon privé.");
  },
  choices: [{ label: "Rentrer avant l'aube", emoji: "🌅", to: "c2_09" }],
});
SC("c2_07c", {
  ch: 2,
  bg: "casino",
  mood: "souvenir",
  prop: "lettre",
  text:
    "Le bureau de Velours est en désordre, le coffre éventré. Mais le voleur a négligé un tiroir, sous le bureau. Dedans : une photographie jaunie et une lettre.\n\n" +
    "Sur la photo, une petite fille en robe rouge sur les épaules d'un homme dont le visage a été soigneusement découpé. La lettre ne contient qu'une phrase, de la même écriture que votre lettre d'admission :\n\n" +
    "> *« Ma fille, pardonne-moi. Un jour, la Maison sera à toi. — F. »*\n\n" +
    "**Velours est la fille du Fondateur.**",
  fx: (S) => {
    S.set("secret_velours");
    S.mem("SECRET : Velours est la fille du Fondateur.");
  },
  choices: [{ label: "Tout remettre en place et partir", emoji: "🌅", to: "c2_09" }],
});
SC("c2_09", {
  ch: 2,
  bg: "irf",
  who: "valence",
  text: (S) =>
    "Six heures du matin. Le bureau de l'IRF sent le café froid et le papier. L'inspectrice Valence vous attendait — évidemment.\n\n" +
    (S.has("menti_valence") ? "— Vous m'avez menti, la première nuit. Je ne l'ai pas oublié. Mais je suis pragmatique.\n\n" : S.item("micro") ? "— J'ai tout entendu, *dit-elle en tapotant son casque.* Joli travail.\n\n" : "— Vous avez une tête de quelqu'un qui n'a pas dormi. Bien. Ça veut dire que vous avez trouvé quelque chose.\n\n") +
    (S.item("registre") ? "Ses yeux tombent sur le registre. — Donnez-moi ça. Avec ces pages, je peux faire tomber Arnaud… et peut-être celui qu'il paie." : "— Le Casino, Arnaud, le Maire… Tout se tient. Il me manque juste des preuves.") +
    "\n\nElle tend la main.",
  choices: [
    { label: "Lui remettre le registre", emoji: "📒", to: "c2_fin", if: (S) => S.item("registre"), stat: true, fx: (S) => { S.take("registre"); S.set("preuves_irf"); S.rep("irf", 2); S.rep("casino", -1); S.card("hs_valence"); } },
    { label: "Garder les preuves pour vous", emoji: "🔒", to: "c2_fin", if: (S) => S.item("registre"), stat: true, fx: (S) => { S.set("preuves_gardees"); S.rep("irf", -1); S.mem("Vous avez gardé le registre pour vous."); } },
    { label: "Les confier plutôt à Velours", emoji: "🌹", to: "c2_fin", if: (S) => S.item("registre"), stat: true, fx: (S) => { S.take("registre"); S.set("preuves_velours"); S.rep("casino", 2); S.rep("irf", -2); } },
    { label: "« Je n'ai rien trouvé. » ", emoji: "🤷", to: "c2_fin", if: (S) => !S.item("registre"), fx: (S) => S.rep("irf", -1) },
  ],
});
SC("c2_fin", {
  ch: 2,
  bg: "aube",
  end: 2,
  text: (S) =>
    "**Fin du chapitre II — Les Nuits de Paris.**\n\n" +
    "*Le soleil se lève sur une ville qui ne sait rien. Vous, vous savez : un contrat dort à l'Hôtel de Ville, Arnaud paie un certain « D. », et la Maison tient à un fil.*" +
    (S.has("secret_velours") ? "\n\n*Et vous connaissez le secret de Velours. Ce genre de secret ne reste jamais longtemps dans une poche.*" : "") +
    (S.has("preuves_irf") ? "\n\n*L'IRF a vos preuves. Valence vous doit quelque chose, maintenant.*" : S.has("preuves_velours") ? "\n\n*Velours a le registre. Le Casino vous doit quelque chose, maintenant.*" : ""),
  choices: [{ label: "Chapitre III : L'Hôtel de Ville", emoji: "🏛️", style: "success", to: "c3_00" }],
});
