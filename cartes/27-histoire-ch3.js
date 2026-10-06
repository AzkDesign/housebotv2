
// --- Chapitre 3 : L'Hôtel de Ville ---
const BOSS_GARDIEN = {
  who: "gardien",
  hp: 170,
  atk: 28,
  pattern: ["guard", "attack", "ruse", "attack", "guard", "ruse"],
  tells: {
    attack: "Le Gardien lève sa lourde torche comme une matraque…",
    guard: "Le Gardien se plante entre vous et la sortie, immobile…",
    ruse: "Le Gardien fait tinter son trousseau de clés, l'air de rien…",
  },
};
SC("c3_00", {
  ch: 3,
  ep: true,
  title: "L'Hôtel de Ville",
  bg: "mairie",
  text: (S) =>
    "*Une semaine après la disparition, une lettre officielle arrive à la Maison. Papier épais, tampon tricolore.*\n\n" +
    `> *« ${S.name}, Monsieur le Maire souhaite s'entretenir avec vous au sujet de l'avenir de la Maison. Demain, 10 heures. »*\n\n` +
    "Augustin la lit par-dessus votre épaule et repose sa tasse un peu trop fort.\n\n— Il sait que le Fondateur vous a choisi. *Il baisse la voix.* Faites attention à ce que vous lui donnez. Et à ce que vous lui prenez." +
    (S.has("velours_sait_jeu") ? "\n\n*Les mots de Velours vous reviennent : « Ne montre jamais ce jeu à Delorme. »*" : ""),
  choices: [{ label: "Se rendre à l'Hôtel de Ville", emoji: "🏛️", to: "c3_01" }],
});
SC("c3_01", {
  ch: 3,
  bg: "mairie",
  who: "delorme",
  text: (S) =>
    "Le bureau du Maire est plus grand que tout le rez-de-chaussée de la Maison. Monsieur le Maire vous accueille les bras ouverts, écharpe tricolore impeccable, sourire de campagne électorale.\n\n" +
    `— ${S.name} ! Le fameux protégé. Asseyez-vous, je vous en prie. Un café ? Un avenir ?\n\n` +
    "Il s'assoit sur le bord de son bureau, très près de vous.\n\n" +
    "— Soyons francs. Le Fondateur n'est plus là. La Maison a des dettes, des fuites, des fantômes. Moi, j'ai des solutions. **Donnez-moi ce jeu de cartes qu'il vous a laissé**, et je vous offre un appartement en ville… et toute la vérité sur sa disparition." +
    (S.has("jeu_vole") ? "\n\n*Vous n'avez pas le Jeu : il a été volé. Mais le Maire, lui, semble l'ignorer… ou faire semblant.*" : ""),
  choices: [
    { label: "Accepter et lui donner le Jeu", emoji: "🤝", to: "c3_02a", if: (S) => S.item("jeu"), stat: true, fx: (S) => { S.take("jeu"); S.set("jeu_donne_maire"); S.rep("mairie", 3); S.rep("fondation", -3); S.moral(-1); } },
    { label: "Refuser poliment", emoji: "🙅", to: "c3_02", stat: true, fx: (S) => S.rep("mairie", -1) },
    { label: "Le confronter avec le registre du Casino", emoji: "📒", to: "c3_02c", if: (S) => S.item("registre") || S.has("preuves_irf"), stat: true, fx: (S) => { S.rep("mairie", -2); S.set("maire_confronte"); } },
    { label: "Jouer le jeu et flatter son ego", emoji: "🎭", to: "c3_02", stat: true, fx: (S) => { S.rep("mairie", 1); S.moral(-1); S.set("flatteur"); } },
  ],
});
SC("c3_02a", {
  ch: 3,
  bg: "mairie",
  who: "delorme",
  prop: "jeu",
  text:
    "Le Maire prend le Jeu avec une délicatesse inattendue. Il étale les cartes sur son bureau, cherche… et se fige. Ses doigts tremblent au-dessus du Joker.\n\n" +
    "— Merci. Vraiment. *Il range le paquet dans un tiroir qu'il ferme à clé.* Pour la vérité… revenez la semaine prochaine. Nous dînerons.\n\n" +
    "En sortant, vous croisez votre reflet dans une vitre. Pendant une demi-seconde, vous jureriez y voir **quelqu'un d'autre** derrière vous.",
  fx: (S) => S.mem("Vous avez donné le Jeu du Fondateur au Maire."),
  choices: [{ label: "Quitter l'Hôtel de Ville", emoji: "🚶", to: "c3_02b" }],
});
SC("c3_02c", {
  ch: 3,
  bg: "mairie",
  who: "delorme",
  mood: "danger",
  text:
    "Quand vous mentionnez les versements d'Arnaud & Fils à un certain « D. », le sourire du Maire se fissure. Une seconde. Pas plus.\n\n" +
    "— « D. » ? Il y a beaucoup de D à Paris. Dupont. Durand. Dieu, peut-être. *Il se lève, raide.* Je crois que notre entretien est terminé.\n\n" +
    "Il vous raccompagne lui-même jusqu'à la porte. Sa main se pose sur votre épaule, lourde.\n\n— Paris est une ville dangereuse, la nuit. Surtout pour ceux qui fouillent.",
  fx: (S) => S.mem("Le Maire a blêmi quand vous avez parlé des versements à « D. »."),
  choices: [{ label: "Quitter l'Hôtel de Ville", emoji: "🚶", to: "c3_02b" }],
});
SC("c3_02", {
  ch: 3,
  bg: "mairie",
  who: "delorme",
  text: (S) =>
    (S.has("flatteur")
      ? "Le Maire boit vos compliments comme du champagne. Il parle de lui, de ses projets, de sa « vision pour le quartier ». Et, emporté par son élan, il lâche : « Les vieux papiers de la Maison ? Tous aux archives, au sous-sol. Sous bonne garde. »\n\n"
      : "Le Maire hausse les épaules, comme si votre refus n'était qu'une formalité.\n\n— Réfléchissez. Les offres comme la mienne ne restent pas longtemps sur la table.\n\n") +
    "Il vous raccompagne. Dans le couloir, un huissier pousse un chariot de dossiers vers un escalier qui descend : **« ARCHIVES — ACCÈS RESTREINT »**.",
  fx: (S) => {
    if (S.has("flatteur")) S.mem("Le Maire a laissé échapper que les papiers de la Maison sont aux archives du sous-sol.");
  },
  choices: [{ label: "Quitter l'Hôtel de Ville", emoji: "🚶", to: "c3_02b" }],
});
SC("c3_02b", {
  ch: 3,
  bg: "rue_pluie",
  text: (S) =>
    "Sur le parvis, votre téléphone vibre.\n\n" +
    (S.has("aide_noe")
      ? "> **Noé** : *« Archives de la Mairie, sous-sol. Ce soir 23 h, je coupe les caméras pendant 20 minutes. Pas une de plus. »*"
      : "> **Augustin** : *« Passez à la loge. J'ai retrouvé quelque chose dans les affaires du Fondateur. »*\n\nÀ la loge, Augustin vous tend un vieux plan jauni : le sous-sol de l'Hôtel de Ville, avec une porte de service marquée d'une croix.\n\n— Il y allait souvent, autrefois. Je n'ai jamais su pourquoi.") +
    "\n\nLe contrat est là-dessous. Vous en êtes sûr.",
  fx: (S) => {
    if (!S.has("aide_noe")) S.give("plan");
  },
  choices: [{ label: "Ce soir, descendre aux archives", emoji: "🔦", to: "c3_03" }],
});
SC("c3_03", {
  ch: 3,
  ep: true,
  bg: "archives",
  mood: "mystere",
  text: (S) =>
    (S.has("aide_noe") ? "*23 h 02. Les petites lumières rouges des caméras s'éteignent une à une.* Merci, Noé.\n\n" : "*23 h 02. La porte de service marquée sur le plan n'était pas fermée à clé.*\n\n") +
    "Les archives s'étendent à perte de vue : des allées d'étagères métalliques, des milliers de boîtes, et une seule ampoule nue qui se balance doucement au bout de son fil.\n\n" +
    "Au fond, une armoire blindée. Sur la porte, une plaque gravée et une serrure à molette :\n\n" +
    "> *« Dossiers de la Maison. Pour ouvrir, donnez le nombre de cartes d'un jeu complet, ses deux Jokers compris. »*",
  choices: [
    {
      label: "Tourner la molette",
      emoji: "🔢",
      riddle: {
        q: "Combien de cartes dans le jeu complet ?",
        placeholder: "Un nombre",
        answers: ["54", "cinquante-quatre", "cinquante quatre"],
        hint: "Un jeu classique compte 52 cartes… sans ses Jokers.",
        ok: "c3_04",
        ko: "c3_04b",
      },
    },
  ],
});
SC("c3_04b", {
  ch: 3,
  bg: "archives",
  who: "gardien",
  mood: "danger",
  text:
    "Au troisième essai raté, une sirène hurle dans tout le sous-sol. Une porte claque. Un faisceau de torche, puis une silhouette massive, casquette vissée sur la tête, un trousseau de clés à la ceinture.\n\n" +
    "— Je savais qu'un jour, quelqu'un viendrait pour ces dossiers, *gronde le Gardien.* Ça fait trente ans que je les garde. Tu ne passeras pas.",
  choices: [
    {
      label: "L'affronter",
      emoji: "⚔️",
      duel: { boss: BOSS_GARDIEN, ok: "c3_04g", ko: "c3_05x", desc: "Le Gardien bloque l'unique allée. Il faudra passer à travers lui." },
    },
    { label: "Lui montrer le jeton noir de Velours", emoji: "♠️", to: "c3_04g", if: (S) => S.item("jeton"), fx: (S) => S.mem("Le Gardien s'est écarté en voyant le jeton noir de Velours. Il joue au Casino…") },
  ],
});
SC("c3_04g", {
  ch: 3,
  bg: "archives",
  who: "gardien",
  text:
    "Le Gardien recule, à bout de souffle, et s'assoit lourdement sur une caisse.\n\n" +
    "— Bon. Bon… Prends-le, ton dossier. *Il fouille son trousseau et ouvre lui-même l'armoire blindée.* Je n'ai jamais aimé ce contrat, de toute façon. Le soir où il a été signé, le vieux monsieur pleurait.",
  fx: (S) => S.mem("Le Gardien : le soir de la signature, le Fondateur pleurait."),
  choices: [{ label: "Ouvrir le dossier", emoji: "📂", to: "c3_04" }],
});
SC("c3_04", {
  ch: 3,
  bg: "archives",
  prop: "contrat",
  text: (S) =>
    "L'armoire s'ouvre. À l'intérieur, une seule chemise cartonnée, épaisse, frappée d'un sceau de cire noire : **« CESSION — LA MAISON »**.\n\n" +
    "Le contrat est là. La Maison, cédée à **Arnaud & Fils** pour un euro symbolique. Contresigné par **Monsieur le Maire**. Daté du soir même de la disparition.\n\n" +
    (S.item("lettre") || S.item("photo")
      ? "Vous sortez la lettre inachevée du Fondateur et la posez à côté. Les deux écritures se ressemblent… mais pas tout à fait. Les boucles des « M » sont différentes. **La signature est un faux.**\n\n"
      : "La signature du Fondateur est tremblée, hésitante. Comme celle d'un homme qu'on aurait forcé.\n\n") +
    "Sous le contrat, un second document : un plan d'architecte. La Maison rasée. À sa place, une tour de verre : **« Arnaud Grand Hôtel — ouverture prévue au printemps »**.",
  fx: (S) => {
    if (S.item("lettre") || S.item("photo")) {
      S.set("faux_contrat");
      S.mem("PREUVE : la signature du Fondateur sur le contrat est un faux.");
    }
  },
  choices: [
    { label: "Emporter l'original", emoji: "📜", to: "c3_06", stat: true, fx: (S) => { S.give("contrat"); S.card("hs_contrat"); S.moral(-1); } },
    { label: "Le photographier et tout remettre en place", emoji: "📸", to: "c3_06", stat: true, fx: (S) => { S.set("copie_contrat"); S.moral(1); S.mem("Vous avez photographié le contrat sans le voler."); } },
  ],
});
SC("c3_05x", {
  ch: 3,
  bg: "archives",
  who: (S) => (S.rep("irf") >= 2 ? "valence" : S.rep("casino") >= 2 ? "velours" : "augustin"),
  text: (S) =>
    "Le Gardien vous plaque contre une étagère. Des boîtes s'effondrent. Des pas dévalent l'escalier : la police municipale, cette fois.\n\n" +
    (S.rep("irf") >= 2
      ? "Mais c'est **l'inspectrice Valence** qui apparaît en premier, badge levé. — IRF. Cette personne est sous ma protection. *Elle vous tire par le bras et vous glisse :* Vous me devez une fière chandelle."
      : S.rep("casino") >= 2
        ? "Mais un parfum de rose envahit l'allée. **Velours**, en manteau de fourrure, glisse une liasse au Gardien et deux mots aux policiers. Tout le monde regarde ailleurs. — Je t'avais dit que je viendrais réclamer ma faveur. Pas aujourd'hui. Aujourd'hui, c'est cadeau."
        : "Mais c'est **Augustin**, essoufflé, son vieux manteau sur sa livrée, qui parlemente avec les policiers. Il connaît leurs pères, leurs grands-pères. Ils finissent par vous laisser partir.") +
    "\n\nAvant de quitter le sous-sol, vous avez juste le temps de voir l'armoire ouverte : le contrat, contresigné par le Maire, et le plan d'un hôtel de verre à la place de la Maison.",
  fx: (S) => {
    S.set("sauve_archives");
    S.mem("Pris aux archives, vous avez été tiré d'affaire de justesse.");
  },
  choices: [{ label: "Rentrer à la Maison", emoji: "🏠", to: "c3_06" }],
});
SC("c3_06", {
  ch: 3,
  ep: true,
  bg: "facade",
  who: "arnaud",
  text: (S) =>
    "Le lendemain matin, la Maison est encerclée. Des camions de chantier, des barrières orange, des ouvriers qui fument en attendant. Une pancarte, plantée devant la grille : **« DÉMOLITION — J-7 »**.\n\n" +
    "Un homme élégant descend d'une berline noire. Costume parfait, cravate verte, cigare à la main. **Bastien Arnaud.** Il vient droit sur vous." +
    (S.has("reconnait_arnaud") ? " *Sa main droite est nue. Toujours.*" : "") +
    `\n\n— ${S.name}. Enchanté. Je vais être direct : savez-vous ce que disait votre lettre d'admission, la vraie ? *Il sourit.* Le Fondateur ne vous a pas invité. **Il vous a désigné comme son héritier.** Vous êtes, légalement, la seule personne qui peut contester cette vente.\n\n` +
    "Il tire une enveloppe épaisse de sa veste.\n\n— Alors voilà ma proposition : signez la renonciation, et vous ne travaillerez plus jamais de votre vie.",
  choices: [
    { label: "Déchirer son offre devant lui", emoji: "✂️", to: "c3_07", stat: true, fx: (S) => { S.rep("fondation", 2); S.rep("entreprises", -3); S.mem("Vous avez déchiré l'offre d'Arnaud devant ses ouvriers."); } },
    { label: "Écouter son offre jusqu'au bout", emoji: "💰", to: "c3_07", stat: true, fx: (S) => { S.rep("entreprises", 2); S.set("ecoute_arnaud"); S.mem("Vous avez écouté l'offre d'Arnaud. Elle était… très généreuse."); } },
    { label: "Lui révéler que la signature est un faux", emoji: "🖋️", to: "c3_07", if: (S) => S.has("faux_contrat"), stat: true, fx: (S) => { S.rep("entreprises", -1); S.set("arnaud_ebranle"); S.mem("Arnaud a blêmi quand vous avez parlé du faux. Il ne le savait pas."); } },
  ],
});
SC("c3_07", {
  ch: 3,
  bg: "bureau",
  who: "ombre",
  mood: "mystere",
  text: (S) =>
    (S.has("arnaud_ebranle")
      ? "Arnaud est reparti sans un mot, le visage gris. Pour la première fois, l'homme aux gants de luxe avait l'air d'avoir peur. *Peur de qui ?*\n\n"
      : S.has("ecoute_arnaud")
        ? "L'enveloppe d'Arnaud est posée sur votre lit. Vous ne l'avez pas ouverte. Pas encore.\n\n"
        : "Les morceaux de l'offre d'Arnaud volent encore dans la cour quand la nuit tombe.\n\n") +
    "Cette nuit-là, vous montez au quatrième. Le bureau du Fondateur est silencieux. Vous vous asseyez dans son fauteuil, face au grand miroir piqué au-dessus de la cheminée.\n\n" +
    "La lampe verte vacille. Dans le miroir, derrière votre reflet, **une silhouette** se tient debout. Des yeux pâles, violets, qui brillent dans le noir.\n\n" +
    (S.has("jeu_donne_maire") || S.has("jeu_vole")
      ? "> *« Ils ont le Jeu… Sans lui, je m'efface. Reprends-le. Avant le septième jour. »*"
      : "> *« Tu as la clé. Tu as le Jeu. Maintenant, trouve-moi… avant le septième jour. »*") +
    "\n\nVous vous retournez d'un bond. La pièce est vide.\n\nDans le miroir, la silhouette, elle, est toujours là.",
  fx: (S) => S.mem("Une voix dans le miroir : « avant le septième jour »."),
  choices: [{ label: "« Qui êtes-vous ? »", emoji: "🪞", to: "c3_fin" }],
});
SC("c3_fin", {
  ch: 3,
  bg: "toits",
  prop: "miroir",
  end: 3,
  text: (S) =>
    "**Fin du chapitre III — L'Hôtel de Ville.**\n\n" +
    "*La silhouette ne répond pas. Elle lève simplement une main, et pose un doigt sur ses lèvres. Puis le miroir redevient un miroir.*\n\n" +
    "*Dehors, la pancarte des démolisseurs indique J-7. Le Maire a ses secrets, Arnaud a peur de quelqu'un, Velours cache plus qu'elle ne le dit, et le Fondateur… le Fondateur est peut-être plus proche que vous ne le pensez.*\n\n" +
    `**Votre enquête jusqu'ici** : ${S.sv.choices} choix · ${S.sv.items.length} objets · ${S.sv.mem.length} souvenirs.\n\n` +
    "📖 **Chapitre IV — Sept Jours** arrive bientôt. Vos choix vous suivront.",
  choices: [],
});
