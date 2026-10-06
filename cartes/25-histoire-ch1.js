
// --- Chapitre 1 : La Clé sous la pluie ---
SC("c1_00", {
  ch: 1,
  ep: true,
  title: "La Clé sous la pluie",
  bg: "rue_pluie",
  text: (S) =>
    `*Paris. Vingt-deux heures quarante. Il pleut comme si le ciel avait une dette envers la ville.*\n\n` +
    `Le taxi vous dépose au bout de la rue et repart sans demander son reste. Dans votre poche, une enveloppe crème, cachetée de cire rouge. Vous l'avez relue cent fois dans le train :\n\n` +
    `> *« ${S.name}, la Maison vous ouvre ses portes. Présentez-vous ce soir. Je tiens à vous rencontrer en personne. — Le Fondateur »*\n\n` +
    `Personne, jamais, n'a rencontré le Fondateur en personne. C'est ce qu'on raconte, en tout cas.\n\n` +
    `Au bout de la rue, derrière une grille de fer forgé, la Maison vous attend. Une plaque de cuivre, verdie par le temps, brille sous le réverbère : **« La Maison — fondée en 1897 »**.`,
  choices: [
    { label: "Sonner à la grille", emoji: "🔔", to: "c1_01" },
    { label: "Faire d'abord le tour par la ruelle", emoji: "🌧️", to: "c1_01b", fx: (S) => S.set("ruelle") },
  ],
});
SC("c1_01b", {
  ch: 1,
  bg: "rue_pluie",
  mood: "brume",
  text:
    "La ruelle sent le pavé mouillé et le tabac froid. Vous longez le mur de la Maison jusqu'à une petite porte de service… qui s'ouvre au même moment.\n\n" +
    "Une silhouette en manteau sombre en sort à reculons, un carton dans les bras. Elle ne vous voit pas. Elle jette un regard vers la grande rue, puis disparaît dans l'obscurité, pressée.\n\n" +
    "Sur le pavé, là où elle se tenait, quelque chose est tombé. Un gant de cuir, fin, coûteux. Sur le revers, deux initiales brodées au fil d'or : **B.A.**",
  fx: (S) => {
    S.give("gant");
    S.mem("Une silhouette est sortie en cachette de la Maison, le soir de votre arrivée.");
  },
  choices: [{ label: "Garder le gant et retourner à la grille", emoji: "🧤", to: "c1_01" }],
});
SC("c1_01", {
  ch: 1,
  bg: "facade",
  who: "augustin",
  mood: "pluie",
  text: (S) =>
    `La grille grince. Un vieil homme en livrée noire s'avance sous un grand parapluie, comme s'il vous attendait depuis des heures.\n\n` +
    `— **${S.name}**, n'est-ce pas ? Je suis Augustin, le concierge. Quarante ans de service, et pas une seule fois je n'ai vu le Fondateur écrire lui-même une lettre d'admission.\n\n` +
    `Il vous détaille de la tête aux pieds, sans méchanceté. Plutôt… avec inquiétude.\n\n` +
    `— Il veut vous voir. Ce soir. À minuit.` +
    (S.has("ruelle") ? `\n\n*Vous remarquez qu'il jette un coup d'œil vers la ruelle d'où vous venez. Il ne pose pas de question.*` : ""),
  choices: [
    { label: "« Pourquoi moi ? »", emoji: "❔", to: "c1_02", fx: (S) => { S.set("pourquoi_moi"); S.rep("fondation", 1); } },
    { label: "« Je ne connais pas votre Fondateur. »", emoji: "🤨", to: "c1_02", fx: (S) => S.set("mefiant") },
    { label: "« Il pleut toujours autant à Paris ? »", emoji: "☔", to: "c1_02", fx: (S) => { S.set("complice"); S.rep("fondation", 1); } },
  ],
});
SC("c1_02", {
  ch: 1,
  bg: "hall",
  who: "augustin",
  text: (S) =>
    (S.has("pourquoi_moi")
      ? "— Pourquoi vous ? *Augustin sourit tristement.* Si je le savais, je dormirais mieux.\n\n"
      : S.has("mefiant")
        ? "— Personne ne le connaît vraiment, *répond Augustin sans s'offusquer.* C'est un peu le principe.\n\n"
        : "— Toujours, *dit Augustin avec un vrai sourire.* La pluie, c'est la seule chose dans cette ville qui ne ment jamais.\n\n") +
    "Le hall est immense : un damier de marbre, un lustre de cristal, un escalier rouge qui grimpe vers l'obscurité. Au mur, un grand portrait — un homme dont on ne distingue pas le visage, perdu dans l'ombre de la peinture.\n\n" +
    "Augustin vous tend une clé en laiton.\n\n" +
    "— Chambre 7, deuxième étage. Une seule règle dans cette maison : **on ne monte jamais au quatrième après minuit.** Jamais.\n\n" +
    "— Même pour voir le Fondateur ?\n\n" +
    "Il ne répond pas.",
  fx: (S) => S.give("cle_chambre"),
  choices: [
    { label: "Monter directement à la chambre 7", emoji: "🛏️", to: "c1_04" },
    { label: "Suivre les rires qui viennent du salon", emoji: "🔥", to: "c1_03" },
  ],
});
SC("c1_03", {
  ch: 1,
  bg: "salon",
  who: "rosier",
  text:
    "Au salon, un feu de cheminée crépite. Une vieille dame aux lunettes rondes, un collier de perles autour du cou, lève sa tasse dans votre direction.\n\n" +
    "— Un nouveau ! Approchez, approchez. Madame Rosier, troisième étage, quarante-deux ans dans ces murs. Vous tombez bien, mon petit : il se passe des choses.\n\n" +
    "Elle baisse la voix, ravie.\n\n" +
    "— Le Fondateur ne descend plus depuis trois jours. Le **Maire** est passé deux fois cette semaine — *deux fois !* Et un homme d'affaires très bien habillé est venu proposer de **racheter la Maison**. Racheter la Maison ! Comme si on achetait une baguette.",
  choices: [
    { label: "« Qui est cet homme d'affaires ? »", emoji: "💼", to: "c1_03b", fx: (S) => S.set("sait_arnaud") },
    { label: "Lui offrir un verre de liqueur", emoji: "🥃", cost: 10, to: "c1_03c", fx: (S) => S.set("sait_horloge") },
    { label: "Écourter poliment et monter", emoji: "🚶", to: "c1_04" },
  ],
});
SC("c1_03b", {
  ch: 1,
  bg: "salon",
  who: "rosier",
  text: (S) =>
    "— Un certain **Bastien Arnaud**, *chuchote-t-elle.* Arnaud & Fils, les promoteurs. Ils rasent les vieilles bâtisses pour y construire des hôtels de verre. Il a un sourire de requin et des gants hors de prix.\n\n" +
    (S.item("gant") ? "*Vous sentez le gant brodé « B.A. » peser soudain dans votre poche.*\n\n" : "") +
    "Elle se renverse dans son fauteuil.\n\n— Allez dormir, mon petit. Et si vous entendez des cartes qu'on bat, la nuit… ne cherchez pas d'où ça vient.",
  fx: (S) => S.mem("Madame Rosier vous a parlé de Bastien Arnaud, le promoteur qui veut racheter la Maison."),
  choices: [{ label: "Monter à la chambre 7", emoji: "🛏️", to: "c1_04" }],
});
SC("c1_03c", {
  ch: 1,
  bg: "salon",
  who: "rosier",
  text:
    "Madame Rosier accepte la liqueur avec un plaisir non dissimulé. Au troisième verre, elle se penche vers vous.\n\n" +
    "— Je vais vous dire un secret, puisque vous êtes gentil. Le Fondateur a un bureau au quatrième. Fermé à double tour. Mais il cache toujours une clé de secours… **derrière la vieille horloge du palier**. Je l'ai vu faire, il y a vingt ans. Il ne m'a jamais vue, moi.\n\n" +
    "Elle rit doucement, puis son regard se voile.\n\n— S'il lui est arrivé quelque chose… quelqu'un devra bien ouvrir cette porte.",
  fx: (S) => S.mem("Madame Rosier : une clé de secours est cachée derrière l'horloge du quatrième."),
  choices: [{ label: "La remercier et monter à la chambre 7", emoji: "🛏️", to: "c1_04" }],
});
SC("c1_04", {
  ch: 1,
  ep: true,
  bg: "couloir",
  prop: "lettre",
  text:
    "*Chambre 7. 23 h 58.*\n\n" +
    "Vous n'arrivez pas à dormir. La pluie tambourine contre la fenêtre, et quelque part dans la Maison, une horloge égrène les secondes trop fort.\n\n" +
    "Un bruit léger. Une enveloppe vient de glisser sous votre porte. Quand vous ouvrez, le couloir est vide.\n\n" +
    "> *« Minuit. Quatrième étage. Venez seul. — F. »*\n\n" +
    "L'écriture est la même que celle de votre lettre d'admission.",
  choices: [
    { label: "Y aller, malgré l'interdiction", emoji: "🕛", to: "c1_05", fx: (S) => S.set("seul") },
    { label: "Réveiller d'abord Augustin", emoji: "🛎️", to: "c1_05a", fx: (S) => { S.set("prevenu"); S.rep("fondation", 1); } },
  ],
});
SC("c1_05a", {
  ch: 1,
  bg: "couloir",
  who: "augustin",
  text:
    "Augustin ouvre sa loge en robe de chambre, une bougie à la main. Quand vous lui montrez le message, il pâlit.\n\n" +
    "— Il vous a écrit… *encore*. Bien. Bien.\n\n" +
    "Il vous accompagne jusqu'au pied de l'escalier du quatrième, puis s'arrête net, comme devant un mur invisible.\n\n" +
    "— Je ne peux pas aller plus loin. Je lui ai promis, il y a quarante ans. Prenez ceci.\n\n" +
    "Il vous tend sa bougie.\n\n— Si la lumière tremble… ne restez pas.",
  fx: (S) => {
    S.give("bougie");
    S.mem("Augustin a promis au Fondateur de ne jamais monter au quatrième.");
  },
  choices: [{ label: "Monter seul au quatrième", emoji: "🕯️", to: "c1_05" }],
});
SC("c1_05", {
  ch: 1,
  bg: "couloir",
  mood: "mystere",
  text: (S) =>
    "Le quatrième étage est plus froid que le reste de la Maison. Les appliques murales grésillent, s'éteignent, se rallument." +
    (S.item("bougie") ? " La flamme de la bougie d'Augustin se couche vers le fond du couloir, comme attirée." : "") +
    "\n\nTout au bout, une porte est entrouverte. De la lumière filtre. Et un son, très net, régulier :\n\n" +
    "*Le froissement de cartes qu'on bat.*\n\n" +
    "Puis plus rien.",
  choices: [
    { label: "Pousser la porte", emoji: "🚪", to: "c1_06" },
    { label: "Frapper trois coups", emoji: "✊", to: "c1_06", fx: (S) => S.set("a_frappe") },
  ],
});
SC("c1_06", {
  ch: 1,
  bg: "bureau",
  prop: "jeu",
  mood: "mystere",
  text: (S) =>
    (S.has("a_frappe") ? "Personne ne répond. La porte s'ouvre d'elle-même sous vos coups.\n\n" : "") +
    "Le bureau du Fondateur est vide.\n\n" +
    "Le fauteuil est renversé. La fenêtre est grande ouverte sur la pluie, et les rideaux claquent comme des drapeaux. Sur le grand bureau de chêne, sous la lampe verte, des dizaines de cartes sont disposées **en cercle parfait**.\n\n" +
    "Au centre du cercle : une seule carte, face visible. **Le Joker.** Il brille faiblement, comme une braise.\n\n" +
    "À côté, une feuille, l'encre encore fraîche :\n\n> *« S'ils viennent, ne leur donnez pas le Jeu. »*",
  fx: (S) => S.mem("Le Fondateur a disparu. Il a laissé un jeu de cartes disposé en cercle, et un message : « ne leur donnez pas le Jeu »."),
  choices: [
    { label: "Prendre le Jeu de cartes", emoji: "🃏", to: "c1_07", stat: true, fx: (S) => { S.give("jeu"); S.rep("fondation", 1); S.card("hs_jeu"); } },
    { label: "Ne rien toucher, fouiller le bureau", emoji: "🔍", to: "c1_07b", stat: true },
    { label: "Regarder par la fenêtre ouverte", emoji: "🪟", to: "c1_07c" },
  ],
});
SC("c1_07", {
  ch: 1,
  bg: "bureau",
  prop: "jeu",
  text:
    "Les cartes sont tièdes. Comme si quelqu'un venait de les tenir. Vous les rassemblez une à une ; le Joker en dernier. Au contact de vos doigts, il cesse de briller.\n\n" +
    "*Vous avez la sensation absurde que le paquet est content d'être entre vos mains.*\n\n" +
    "Le bureau, lui, garde ses secrets : un tiroir fermé à clé, un tableau de travers au mur, des papiers éparpillés.",
  choices: [{ label: "Fouiller le bureau", emoji: "🔍", to: "c1_07b" }],
});
SC("c1_07c", {
  ch: 1,
  bg: "rue_pluie",
  mood: "pluie",
  text: (S) =>
    "Vous vous penchez par la fenêtre. Quatre étages plus bas, la rue luit sous la pluie.\n\n" +
    "Une voiture noire, aux vitres teintées, est garée sous le réverbère. Moteur allumé. Un homme en imperméable se tient à côté, parapluie à la main, et regarde **exactement** vers vous.\n\n" +
    "Il lève la main. Un salut ? Une menace ? Puis il monte dans la voiture, qui démarre sans bruit." +
    (S.item("gant") ? "\n\n*Il ne porte qu'un seul gant.*" : ""),
  fx: (S) => {
    S.set("vu_voiture");
    S.mem("Un homme vous observait depuis une voiture noire, sous la fenêtre du Fondateur.");
  },
  choices: [
    { label: "Prendre le Jeu de cartes", emoji: "🃏", to: "c1_07", if: (S) => !S.item("jeu"), fx: (S) => { S.give("jeu"); S.rep("fondation", 1); S.card("hs_jeu"); } },
    { label: "Fouiller le bureau", emoji: "🔍", to: "c1_07b" },
  ],
});
SC("c1_07b", {
  ch: 1,
  bg: "bureau",
  text: (S) =>
    "Vous faites le tour du bureau. Des factures, des lettres sans importance, un stylo-plume sans capuchon. Le seul tiroir qui compte est fermé : une serrure ancienne, en cuivre, ornée du blason de la Maison.\n\n" +
    (S.has("sait_horloge") ? "*Vous repensez à Madame Rosier : « derrière la vieille horloge du palier »…*" : "Il faudrait la clé. Ou de l'habileté — et un peu de chance."),
  choices: [
    { label: "Chercher la clé derrière l'horloge du palier", emoji: "🕰️", to: "c1_08", if: (S) => S.has("sait_horloge"), fx: (S) => S.mem("La clé de secours était bien derrière l'horloge.") },
    {
      label: "Forcer la serrure",
      emoji: "🔧",
      test: { label: "Forcer la serrure du tiroir", diff: 50, ok: "c1_08", ko: "c1_07f", desc: "La serrure est vieille, mais solide. Il faudra de la finesse… et de la chance." },
    },
  ],
});
SC("c1_07f", {
  ch: 1,
  bg: "bureau",
  mood: "danger",
  text:
    "**CRAC.** La lame du coupe-papier se brise dans la serrure. Le bruit résonne dans tout l'étage.\n\n" +
    "Un silence. Puis des pas. Lents, assurés, qui montent l'escalier. Le faisceau d'une lampe torche balaie le couloir.\n\n" +
    "Vous avez juste le temps de vous glisser derrière les lourds rideaux.",
  fx: (S) => S.set("pris_sur_le_fait"),
  choices: [{ label: "Retenir votre souffle", emoji: "🤫", to: "c1_09" }],
});
SC("c1_08", {
  ch: 1,
  bg: "bureau",
  prop: "lettre",
  text:
    "Le tiroir s'ouvre avec un soupir de bois sec. À l'intérieur : une lettre inachevée et une vieille photographie.\n\n" +
    "La photo montre la façade de la Maison, toute neuve, devant une foule en chapeaux. Au dos, à l'encre brune : **« Le jour où tout a commencé. »**\n\n" +
    "La lettre, elle, s'interrompt au milieu d'une phrase :\n\n> *« …la Maison ne doit jamais tomber entre les mains de ceux qui la vendraient. Le coffre gardera la clé. Son code est la date où tout a commencé. Si je ne reviens pas, que celui que j'ai choisi… »*\n\n" +
    "La suite est une tache d'encre. Et derrière vous, dans le couloir, des pas.",
  fx: (S) => {
    S.give("photo");
    S.give("lettre");
  },
  choices: [
    { label: "Se cacher derrière les rideaux", emoji: "🫥", to: "c1_09", fx: (S) => S.set("cache") },
    { label: "Faire face à celui qui arrive", emoji: "🧍", to: "c1_09", fx: (S) => S.set("face") },
  ],
});
SC("c1_09", {
  ch: 1,
  ep: true,
  bg: "bureau",
  who: "valence",
  text: (S) =>
    (S.has("face")
      ? "Vous vous tournez vers la porte, le menton haut. Une femme en trench-coat se fige sur le seuil, une lampe torche pointée sur vous.\n\n"
      : "Le faisceau de la lampe s'arrête net sur le bas du rideau. Sur vos chaussures.\n\n— Sortez de là. Lentement.\n\nUne femme en trench-coat et chapeau mou vous observe, impassible.\n\n") +
    "— **Inspectrice Valence**, Institut de Régulation Financière. *Elle montre un badge.* Il manque **deux millions** sur les comptes du Fondateur, et le Fondateur a eu la mauvaise idée de disparaître le soir où je venais lui en parler. Alors je vous pose la question une seule fois :\n\n" +
    "— Qu'est-ce que vous faites dans ce bureau ?",
  choices: [
    { label: "Tout lui dire", emoji: "🤝", to: "c1_10", stat: true, fx: (S) => { S.set("honnete_valence"); S.rep("irf", 2); S.moral(1); S.mem("Vous avez tout raconté à l'inspectrice Valence."); } },
    { label: "Mentir : « Je cherchais les toilettes. »", emoji: "🎭", to: "c1_10", stat: true, fx: (S) => { S.set("menti_valence"); S.rep("irf", -1); S.moral(-1); S.mem("Vous avez menti à l'inspectrice Valence."); } },
    { label: "« Je vous aide si vous me protégez. »", emoji: "🤞", to: "c1_10", stat: true, fx: (S) => { S.set("deal_irf"); S.rep("irf", 1); S.mem("Vous avez passé un marché avec l'inspectrice Valence."); } },
  ],
});
SC("c1_10", {
  ch: 1,
  bg: "bureau",
  who: "valence",
  text: (S) =>
    (S.has("honnete_valence")
      ? "Valence vous écoute sans vous interrompre. Quand vous avez fini, elle range sa lampe.\n\n— Je vous crois. C'est rare, chez moi. Ne me le faites pas regretter.\n\n"
      : S.has("menti_valence")
        ? "Valence vous fixe une longue seconde.\n\n— Au quatrième étage. À minuit. Dans un bureau fermé. *Elle sourit sans joie.* Je note. Je note tout.\n\n"
        : "— Un marché, *répète Valence, amusée.* Vous ne manquez pas d'aplomb. Très bien : vous êtes mes yeux dans cette maison. Et moi, je regarde ailleurs quand il le faut.\n\n") +
    "Elle s'en va comme elle est venue, sans bruit. Vous restez seul avec le bureau… et le tableau de travers au mur. Derrière lui, encastré dans la pierre : **un coffre-fort à cadran**, quatre chiffres." +
    (S.item("jeu") ? "\n\n*Dans votre poche, le Joker se réchauffe. Comme un indice.*" : "\n\n*Sur le bureau, le cercle de cartes a disparu. Quelqu'un les a prises pendant que vous parliez avec l'inspectrice.*"),
  fx: (S) => {
    if (!S.item("jeu")) {
      S.set("jeu_vole");
      S.mem("Le Jeu du Fondateur a été volé pendant votre conversation avec l'inspectrice.");
    }
  },
  choices: [
    {
      label: "Composer le code du coffre",
      emoji: "🔐",
      riddle: {
        q: "Le code du coffre (4 chiffres)",
        placeholder: "????",
        answers: ["1897"],
        hint: "« La date où tout a commencé »… Relisez la plaque sur la façade de la Maison.",
        ok: "c1_11",
        ko: "c1_11b",
      },
    },
  ],
});
SC("c1_11", {
  ch: 1,
  bg: "bureau",
  prop: "cle",
  mood: "mystere",
  text:
    "**1-8-9-7.** Un déclic, lourd et profond. La porte du coffre pivote.\n\n" +
    "À l'intérieur, sur un coussin de velours : une clé de fer forgé, longue comme une main, ornée du blason de la Maison. Et une carte, posée dessus avec soin. Dessus, quelqu'un a écrit à la main : *« Pour celui que j'ai choisi. »*\n\n" +
    "Sous la clé, une liste de noms, d'une écriture pressée :\n\n> *Delorme. Arnaud. Velours.*\n\nLe dernier nom a été raturé si fort que le papier est troué.",
  fx: (S) => {
    S.give("cle_fondateur");
    S.card("hs_cle");
    S.rep("fondation", 1);
    S.mem("Le coffre contenait la clé de fer du Fondateur et trois noms : Delorme, Arnaud, Velours.");
  },
  choices: [{ label: "Redescendre en silence", emoji: "🌅", to: "c1_12" }],
});
SC("c1_11b", {
  ch: 1,
  bg: "bureau",
  who: "augustin",
  text:
    "Au troisième mauvais code, le coffre émet un **clac** sinistre et se bloque. Une sonnette, quelque part dans les étages, se met à tinter.\n\n" +
    "Quelques minutes plus tard, Augustin apparaît dans l'encadrement de la porte, essoufflé. Il a enfreint sa promesse. Il regarde le bureau vide, le fauteuil renversé, et ses épaules s'affaissent.\n\n" +
    "— Il m'avait dit que vous trouveriez seul. Tant pis.\n\n" +
    "Il compose le code sans hésiter — *1, 8, 9, 7* — et vous tend ce que contient le coffre : une clé de fer forgé, une carte, et une liste de noms. *Delorme. Arnaud. Velours.*\n\n— La date où tout a commencé, *murmure-t-il.* Il fallait lire la plaque, à l'entrée.",
  fx: (S) => {
    S.give("cle_fondateur");
    S.card("hs_cle");
    S.set("aide_augustin");
    S.mem("Augustin a brisé sa promesse pour vous ouvrir le coffre.");
  },
  choices: [{ label: "Le suivre dans l'escalier", emoji: "🌅", to: "c1_12" }],
});
SC("c1_12", {
  ch: 1,
  bg: "aube",
  who: "augustin",
  text: (S) =>
    "L'aube se lève sur les toits de Paris. Vous êtes assis avec Augustin sur les marches du perron, une tasse de café brûlant entre les mains.\n\n" +
    "— Le Fondateur avait peur de trois personnes, *dit-il enfin.* **Le Maire**, qui veut sa Maison pour ses affaires. **Arnaud**, qui veut la raser. Et **la Dame du Casino**… avec qui c'est plus compliqué.\n\n" +
    "Il vous regarde longuement." +
    (S.has("jeu_vole") ? "\n\n— Et maintenant, quelqu'un a le Jeu. Ça, c'est très mauvais." : "\n\n— Et vous avez le Jeu. Gardez-le près de vous. Toujours.") +
    "\n\n— Par où commencez-vous ?",
  choices: [
    { label: "La piste du Casino et de sa Dame", emoji: "🎰", to: "c1_fin", stat: true, fx: (S) => { S.set("piste", "casino"); S.rep("casino", 1); } },
    { label: "La piste de l'argent, avec l'IRF", emoji: "🔎", to: "c1_fin", stat: true, fx: (S) => { S.set("piste", "irf"); S.rep("irf", 1); } },
    { label: "La piste de la Mairie", emoji: "🎩", to: "c1_fin", stat: true, fx: (S) => { S.set("piste", "mairie"); S.rep("mairie", 1); } },
  ],
});
SC("c1_fin", {
  ch: 1,
  bg: "aube",
  prop: "cle",
  end: 1,
  text: (S) =>
    "**Fin du chapitre I — La Clé sous la pluie.**\n\n" +
    `*Vous êtes arrivé à la Maison il y a moins de huit heures. Son Fondateur a disparu, ${S.has("jeu_vole") ? "son Jeu a été volé" : "son Jeu dort dans votre poche"}, et une clé de fer pèse au fond de votre sac. Quelque part dans Paris, trois noms attendent que vous veniez frapper à leur porte.*\n\n` +
    `Votre piste : **${{ casino: "le Casino", irf: "l'argent disparu, avec l'IRF", mairie: "la Mairie" }[S.get("piste")] ?? "à choisir"}**.`,
  choices: [{ label: "Chapitre II : Les Nuits de Paris", emoji: "🌃", style: "success", to: "c2_00" }],
});
