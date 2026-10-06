
// --- Chapitre 4 : Sept Jours ---
STORY_CHAPTERS[4] = { title: "Sept Jours", color: 0x22d3ee };
STORY_CARDS.hs_chambre = { ...C("hs_chambre", "La Chambre Zéro", "🚪", "legendaire", "Sous la Maison, une pièce que personne n'a vue depuis 1897."), chapter: 4 };
STORY_CARDS.hs_sablier = { ...C("hs_sablier", "Le Sablier des Sept Jours", "⏳", "epique", "Chaque grain qui tombe rapproche les démolisseurs."), chapter: 4 };
STORY_REWARDS[4] = { dust: 400, pack: "prestige", card: "hs_chambre" };
STORY_CAST.fondateur = { name: "Le Fondateur", role: "Celui qui a bâti la Maison", fluent: "Bust in silhouette", color: "#fde68a" };
Object.assign(FLUENT, { "🚪": "Door", "⏳": "Hourglass not done" });
Object.assign(THEMES, { hs_chambre: { scene: "souterrain", fx: "lucioles" }, hs_sablier: { scene: "aube", fx: "poussiere" } });
STORY_PROPS.sablier = ["⏳", "Hourglass not done"];
STORY_PROPS.porte = ["🚪", "Door"];

// --- Nouveaux décors : le gala de la Mairie, la tour Arnaud, la Chambre Zéro ---
DECORS.gala = (ctx) => {
  vnSky(ctx, ["#1a0f05", "#2a1a08", "#0c0703"]);
  vnColumns(ctx, 80, 6, 210, 60, 470, "#d6c7a1");
  // tentures tricolores entre les colonnes
  for (let i = 0; i < 5; i++) {
    const x = 102 + i * 210;
    for (const [k, c] of ["#1d4ed8", "#f5f5f4", "#dc2626"].entries()) {
      ctx.fillStyle = rgba(c, 0.55);
      ctx.beginPath();
      ctx.moveTo(x + k * 56, 60);
      ctx.quadraticCurveTo(x + k * 56 + 28, 150, x + k * 56 + 56, 60);
      ctx.fill();
    }
  }
  vnChandelier(ctx, 390, 50, 90);
  vnChandelier(ctx, 810, 50, 90);
  vnFloor(ctx, 600, 470, "#d6c7a1", "#3f2a12");
  vnBokeh(ctx, 81, 70, ["#fde68a", "#fbbf24", "#ffffff"], 140, 460);
  // silhouettes d'invités
  const r = seeded(4);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * 1120, s = 0.5 + r() * 0.45, y = 480 + r() * 40;
    ctx.fillStyle = `rgba(10,6,3,${0.75 + r() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(x, y - 120 * s, 14 * s, 17 * s, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 32 * s, y + 40);
    ctx.quadraticCurveTo(x - 30 * s, y - 95 * s, x, y - 100 * s);
    ctx.quadraticCurveTo(x + 30 * s, y - 95 * s, x + 32 * s, y + 40);
    ctx.fill();
  }
};
DECORS.tour = (ctx) => {
  vnSky(ctx, ["#020617", "#0f172a", "#1e1b4b"]);
  vnStars(ctx, 91, 40, 160);
  // Paris vu du dernier étage, derrière une baie vitrée
  vnSkyline(ctx, 93, 470, "#111827", 60, 160, 0.35, "#fcd34d");
  vnEiffel(ctx, 820, 430, 260, "#1f2937");
  for (let x = 0; x <= VN_W; x += 200) {
    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(x - 6, 0, 12, VN_H);
  }
  ctx.fillStyle = "rgba(148,163,184,0.06)";
  for (let k = 0; k < 6; k++) {
    ctx.beginPath();
    ctx.moveTo(k * 220, 0);
    ctx.lineTo(k * 220 + 120, 0);
    ctx.lineTo(k * 220 - 60, VN_H);
    ctx.lineTo(k * 220 - 180, VN_H);
    ctx.closePath();
    ctx.fill();
  }
  // bureau de verre et maquette de l'hôtel
  ctx.fillStyle = "rgba(15,23,42,0.95)";
  ctx.fillRect(0, 480, VN_W, VN_H - 480);
  ctx.fillStyle = "rgba(148,163,184,0.25)";
  ctx.fillRect(140, 460, 520, 14);
  ctx.fillStyle = "rgba(125,211,252,0.35)";
  for (let k = 0; k < 4; k++) ctx.fillRect(330 + k * 22, 360 - k * 25, 18, 100 + k * 25);
  glow(ctx, 380, 420, 160, "#38bdf8", 0.25);
  glow(ctx, 900, 470, 220, "#16a34a", 0.12);
};
DECORS.chambre_zero = (ctx) => {
  vnSky(ctx, ["#0c0a09", "#1c1917", "#0c0a09"]);
  // voûte en berceau
  for (let k = 0; k < 9; k++) {
    const s = 1 - k * 0.09;
    ctx.strokeStyle = `rgba(120,113,108,${0.6 - k * 0.05})`;
    ctx.lineWidth = 16 * s;
    ctx.beginPath();
    ctx.arc(600, 470, 560 * s, Math.PI, 0);
    ctx.stroke();
  }
  ctx.fillStyle = "#1c1917";
  ctx.fillRect(0, 470, VN_W, VN_H - 470);
  // pupitre, coffret vide, rangées de bougies
  ctx.fillStyle = "#3f2a12";
  ctx.fillRect(470, 380, 260, 26);
  ctx.fillRect(500, 406, 22, 90);
  ctx.fillRect(678, 406, 22, 90);
  ctx.fillStyle = "#57534e";
  ctx.fillRect(560, 350, 80, 32);
  const r = seeded(17);
  for (let i = 0; i < 26; i++) {
    const x = 120 + i * 37 + r() * 10, y = 470 - Math.abs(i - 12.5) * 4, h = 20 + r() * 30;
    ctx.fillStyle = "#f5f5f4";
    ctx.fillRect(x, y - h, 8, h);
    glow(ctx, x + 4, y - h - 8, 40, "#fbbf24", 0.35);
    disc(ctx, x + 4, y - h - 6, 3.2, "#fde68a");
  }
  glow(ctx, 600, 360, 280, "#f59e0b", 0.25);
  vnFog(ctx, 380, 200, "#78716c", 0.12);
};

const BOSS_ARNAUD = {
  who: "arnaud",
  hp: 180,
  atk: 30,
  pattern: ["ruse", "attack", "guard", "ruse", "attack", "attack"],
  tells: {
    attack: "Arnaud desserre sa cravate et fait un pas en avant, les poings serrés…",
    guard: "Arnaud recule derrière son bureau de verre, sur la défensive…",
    ruse: "Arnaud sourit et tend la main, comme pour proposer un marché…",
  },
};
const SUIT_ORDER = "Cœur, Trèfle, Carreau, Pique";

SC("c4_00", {
  ch: 4,
  ep: true,
  title: "Sept Jours",
  bg: "facade",
  prop: "sablier",
  text: (S) =>
    "*J-6. Les camions sont arrivés à l'aube. Des barrières orange encerclent la grille, et une grue jaune déplie lentement son bras au-dessus du toit.*\n\n" +
    "Dans le hall, les résidents se sont rassemblés en pyjama, en robe de chambre, une tasse à la main. Madame Rosier pleure sans bruit. Noé tape frénétiquement sur son téléphone. Augustin, lui, se tient droit près de l'escalier, comme un capitaine qui refuse de quitter son navire.\n\n" +
    "Tous les regards se tournent vers vous." +
    (S.has("ecoute_arnaud") ? "\n\n*L'enveloppe d'Arnaud est toujours dans votre chambre. Personne ne le sait. Pour l'instant.*" : ""),
  choices: [
    { label: "Rassembler les résidents : « On ne partira pas. »", emoji: "📣", to: "c4_01", stat: true, fx: (S) => { S.set("resistance"); S.rep("fondation", 2); S.card("hs_sablier"); S.mem("Vous avez promis aux résidents que personne ne quitterait la Maison."); } },
    { label: "Garder votre calme et enquêter seul", emoji: "🕵️", to: "c4_01", stat: true, fx: (S) => S.set("solitaire") },
    { label: "Filer à l'IRF faire suspendre le chantier", emoji: "🔎", to: "c4_01v", stat: true, fx: (S) => S.rep("irf", 1) },
  ],
});
SC("c4_01", {
  ch: 4,
  bg: "salon",
  who: "rosier",
  text: (S) =>
    (S.has("resistance")
      ? "Votre discours a fait son effet : Noé a créé un groupe « Défense de la Maison », et même le vieux monsieur du premier a sorti sa canne. Le soir, au coin du feu, Madame Rosier vous fait signe d'approcher.\n\n"
      : "Le soir, alors que tout le monde est remonté se coucher, Madame Rosier vous retient par la manche, près de la cheminée.\n\n") +
    "— Quand j'étais petite, *chuchote-t-elle,* ma grand-mère disait que la Maison avait une pièce que personne n'avait jamais vue. Sous la cave. Elle l'appelait **la Chambre Zéro**. Le Fondateur de 1897 y aurait caché « ce qui protège la Maison pour toujours ».\n\n" +
    "Elle retire ses lunettes et les essuie longuement.\n\n— J'ai toujours cru que c'était une histoire pour endormir les enfants. Maintenant… je n'en suis plus si sûre.",
  fx: (S) => S.mem("La légende de la Chambre Zéro : sous la cave, ce qui protège la Maison pour toujours."),
  choices: [{ label: "Le lendemain, chercher par où commencer", emoji: "🌅", to: "c4_02" }],
});
SC("c4_01v", {
  ch: 4,
  bg: "irf",
  who: "valence",
  text: (S) =>
    "Valence vous écoute en tournant son stylo entre ses doigts.\n\n" +
    (S.has("faux_contrat") && (S.item("contrat") || S.has("copie_contrat"))
      ? "— Une signature falsifiée, contresignée par un maire en exercice… *Elle se lève d'un bond.* Avec ça, je peux geler le chantier. Pas longtemps — trois jours, peut-être quatre. Mais trois jours, c'est trois jours.\n\nElle décroche son téléphone avant même que vous soyez sorti."
      : "— Sans preuve que ce contrat est faux, je ne peux rien bloquer. Rien. *Elle soupire.* Trouvez-moi un document plus ancien. L'acte de fondation, par exemple : si la Maison n'a jamais appartenu au Fondateur seul, il n'avait pas le droit de la vendre.") +
    "\n\n— Et vous, *ajoute-t-elle en vous regardant par-dessus ses lunettes,* faites attention. Les gens qui fouillent autour du Maire ont la fâcheuse habitude de disparaître.",
  fx: (S) => {
    if (S.has("faux_contrat") && (S.item("contrat") || S.has("copie_contrat"))) {
      S.set("chantier_gele");
      S.rep("irf", 1);
      S.mem("L'IRF a gelé le chantier grâce à la preuve du faux.");
    } else S.mem("Valence : il faut retrouver l'acte de fondation de la Maison.");
  },
  choices: [{ label: "Rentrer à la Maison", emoji: "🏠", to: "c4_01" }],
});
SC("c4_02", {
  ch: 4,
  bg: "bureau",
  prop: (S) => (S.item("jeu") ? "jeu" : "miroir"),
  mood: "mystere",
  text: (S) =>
    "*J-5. Minuit.* Vous retournez dans le bureau du Fondateur. Le miroir est là, muet.\n\n" +
    (S.item("jeu")
      ? "Vous étalez le Jeu sur le bureau. " +
        (S.item("bougie")
          ? "En approchant la bougie d'Augustin du Joker, des lettres apparaissent sur le carton, comme brûlées de l'intérieur — une encre invisible qui ne se révèle qu'à la flamme :"
          : "En le tenant à contre-jour devant la lampe verte, vous distinguez des marques sur le Joker, presque effacées :") +
        `\n\n> *« Sous la cave, la porte des quatre couleurs. L'ordre : ${SUIT_ORDER}. »*\n\nLa voix du miroir murmure, très bas : *« Bien… Viens, maintenant. »*`
      : S.has("jeu_donne_maire")
        ? "Sans le Jeu, le miroir reste froid. Puis, dans le verre embué, un doigt invisible trace lentement trois mots :\n\n> *« Le Maire. Le gala. Demain. »*\n\nUne invitation dorée a été glissée sous la porte du bureau : **Grand Gala de l'Hôtel de Ville**, demain soir."
        : "Sans le Jeu, le miroir reste froid. Mais sur le bureau, quelqu'un a laissé une carte de visite : **Arnaud & Fils — Tour Arnaud, 42e étage**. Au dos, à la main : *« Vous cherchez quelque chose qui vous appartient ? Venez le chercher. »*"),
  choices: [
    { label: "Descendre à la cave avec le Jeu", emoji: "🕯️", to: "c4_05", if: (S) => S.item("jeu") },
    { label: "Se rendre au Grand Gala de la Mairie", emoji: "🥂", to: "c4_03g", if: (S) => !S.item("jeu") && S.has("jeu_donne_maire") },
    { label: "Monter au 42e étage de la Tour Arnaud", emoji: "🏙️", to: "c4_03a", if: (S) => !S.item("jeu") && !S.has("jeu_donne_maire") },
  ],
});
// --- Route du gala : reprendre le Jeu au Maire ---
SC("c4_03g", {
  ch: 4,
  ep: true,
  bg: "gala",
  who: "delorme",
  text: (S) =>
    "*J-4.* Le Grand Gala de l'Hôtel de Ville. Des colonnes de marbre, des tentures tricolores, une valse qui tourne sous les lustres. Le Tout-Paris est là, coupe à la main.\n\n" +
    "Monsieur le Maire termine son discours sous les applaudissements : « …et c'est pourquoi le quartier mérite **un hôtel digne de son avenir** ! » Il lève sa coupe. Son regard croise le vôtre. Il sourit.\n\n" +
    "Son bureau est au premier étage. Le Jeu y est forcément." +
    (S.rep("casino") >= 2 ? "\n\n*Au bar, une robe rouge. Velours lève son verre vers vous, imperceptiblement.*" : "") +
    (S.has("aide_noe") ? "\n\n*Votre oreillette grésille : « Noé en position. Dis un mot et j'éteins les caméras de l'étage. »*" : ""),
  choices: [
    { label: "Demander à Velours une diversion", emoji: "🌹", to: "c4_04", if: (S) => S.rep("casino") >= 2, fx: (S) => S.mem("Velours a renversé une coupe de champagne sur le Maire pour vous laisser passer.") },
    { label: "« Noé, coupe les caméras. »", emoji: "📡", to: "c4_04", if: (S) => S.has("aide_noe"), fx: (S) => S.mem("Noé a coupé les caméras du premier étage pendant le gala.") },
    {
      label: "Subtiliser la clé du bureau dans sa poche",
      emoji: "🤏",
      test: { label: "Voler la clé dans la poche du Maire", diff: 60, ok: "c4_04", ko: "c4_04x", desc: "Une valse, un faux pas, une main qui frôle sa veste… Il faut des doigts de fée et beaucoup de chance." },
    },
  ],
});
SC("c4_04x", {
  ch: 4,
  bg: "gala",
  who: "delorme",
  mood: "danger",
  text:
    "La main du Maire se referme sur votre poignet. Fermement. Il se penche à votre oreille, toujours souriant pour les photographes.\n\n" +
    "— Vous êtes fatigant. *Il fait un signe discret à deux hommes en costume.* Raccompagnez notre invité… par le sous-sol.\n\n" +
    "Dans l'escalier de service, vous faussez compagnie aux deux gorilles en dévalant une rampe à linge. Vous atterrissez dans la cuisine du traiteur — juste sous le bureau du Maire. Un monte-plats grince doucement.\n\n*Il monte au premier étage.*",
  fx: (S) => {
    S.rep("mairie", -2);
    S.mem("Le Maire vous a démasqué au gala. Vous êtes passé par le monte-plats.");
  },
  choices: [{ label: "Grimper dans le monte-plats", emoji: "🛗", to: "c4_04" }],
});
SC("c4_04", {
  ch: 4,
  bg: "mairie",
  prop: "jeu",
  mood: "mystere",
  text:
    "Le bureau du Maire est plongé dans le noir. Le tiroir fermé à clé cède au deuxième essai. Le Jeu est là, dans son étui de cuir. Le Joker, dessus. Il tiède sous vos doigts, comme soulagé.\n\n" +
    "Sous l'étui, un carnet noir. Le Maire y a recopié, de sa petite écriture serrée, quelque chose qu'il avait visiblement mis des semaines à déchiffrer :\n\n" +
    `> *« Porte des quatre couleurs, sous la Maison. Ordre : ${SUIT_ORDER}. Une fois l'acte détruit, plus rien ne s'opposera à la vente. »*\n\n` +
    "**L'acte.** Le Maire ne cherchait pas le Jeu pour lui-même. Il cherchait ce que le Jeu protège.",
  fx: (S) => {
    S.give("jeu");
    S.set("jeu_repris");
    S.rep("fondation", 2);
    S.mem("Vous avez repris le Jeu au Maire. Il voulait détruire « l'acte » caché sous la Maison.");
  },
  choices: [{ label: "Filer avant la fin du gala et rentrer", emoji: "🏃", to: "c4_05" }],
});
// --- Route de la tour : reprendre le Jeu à Arnaud ---
SC("c4_03a", {
  ch: 4,
  ep: true,
  bg: "tour",
  who: "arnaud",
  text: (S) =>
    "*J-4.* Tour Arnaud, 42e étage. Paris s'étale derrière les baies vitrées comme une maquette illuminée. Sur le bureau de verre, une maquette de l'« Arnaud Grand Hôtel » trône à la place exacte de la Maison.\n\n" +
    "Bastien Arnaud vous attend, seul, un verre de whisky à la main. Le Jeu du Fondateur est posé à côté de la maquette." +
    (S.has("arnaud_ebranle")
      ? "\n\n— Vous aviez raison, *dit-il sans se retourner.* Le contrat est un faux. Je l'ai fait vérifier. *Il pose enfin les yeux sur vous.* Je suis un promoteur, pas un faussaire. C'est **lui** qui a fait voler ce jeu, avec mes hommes, et il me tient par des dettes que je ne peux pas payer. Prenez-le. Et prenez ça aussi."
      : "\n\n— Vous savez combien vaut ce paquet de cartes ? *Il le fait tourner entre ses doigts.* Rien. Et pourtant, le Maire m'a ordonné de le lui apporter avant la fin de la semaine. Alors je vais vous dire une chose : **si vous le voulez, venez le prendre.**"),
  choices: [
    { label: "Prendre le Jeu et ses notes", emoji: "🃏", to: "c4_04a", if: (S) => S.has("arnaud_ebranle"), fx: (S) => { S.rep("entreprises", 2); S.set("arnaud_allie"); S.mem("Arnaud vous a rendu le Jeu : c'est le Maire qui le fait chanter."); } },
    {
      label: "L'affronter pour le Jeu",
      emoji: "⚔️",
      if: (S) => !S.has("arnaud_ebranle"),
      duel: { boss: BOSS_ARNAUD, ok: "c4_04a", ko: "c4_04b", desc: "Arnaud pose son verre et retire sa veste. « Champion universitaire d'escrime, vous savez. Allez-y. »", okFx: (S) => { S.rep("entreprises", -1); S.mem("Vous avez battu Arnaud dans son propre bureau."); } },
    },
    { label: "Négocier : « Je vous rends votre gant. »", emoji: "🧤", to: "c4_04a", if: (S) => !S.has("arnaud_ebranle") && S.item("gant"), fx: (S) => { S.take("gant"); S.rep("entreprises", 1); S.mem("Vous avez échangé le gant brodé contre le Jeu. Arnaud y tenait plus que prévu."); } },
  ],
});
SC("c4_04a", {
  ch: 4,
  bg: "tour",
  prop: "jeu",
  text: (S) =>
    (S.has("arnaud_allie") ? "Arnaud vous tend le Jeu et un carnet de notes, puis se tourne vers la fenêtre.\n\n— Le Maire m'a fait recopier ça. Moi, je n'ai jamais compris ce que c'était.\n\n" : "Le Jeu est à vous. Dans l'étui, vous trouvez une feuille pliée, de la main d'Arnaud — des notes prises sous la dictée du Maire.\n\n") +
    `> *« Sous la Maison, porte des quatre couleurs. Ordre : ${SUIT_ORDER}. Y trouver l'acte de 1897 et le brûler. »*\n\n` +
    "**L'acte de 1897.** C'est donc ça qu'ils cherchent tous.",
  fx: (S) => {
    S.give("jeu");
    S.set("jeu_repris");
    S.rep("fondation", 1);
  },
  choices: [{ label: "Rentrer à la Maison, vite", emoji: "🏃", to: "c4_05" }],
});
SC("c4_04b", {
  ch: 4,
  bg: "tour",
  who: "arnaud",
  text:
    "Vous finissez au sol, le souffle coupé. Arnaud réajuste ses boutons de manchette.\n\n" +
    "— Pas mal. Vraiment. *Il regarde le Jeu, puis vous, puis la maquette de son hôtel.* Vous savez quoi ? Je suis fatigué de jouer les coursiers pour un maire.\n\n" +
    "Il prend la moitié du paquet et vous lance l'autre moitié.\n\n— Voilà. On partage. Comme ça, personne ne gagne. *Une feuille tombe des cartes : des notes, de sa main.*",
  fx: (S) => {
    S.give("jeu");
    S.set("jeu_incomplet");
    S.mem("Arnaud ne vous a rendu que la moitié du Jeu.");
  },
  choices: [{ label: "Ramasser la feuille", emoji: "📄", to: "c4_04a" }],
});
// --- La cave et la porte des quatre couleurs ---
SC("c4_05", {
  ch: 4,
  ep: true,
  bg: "cave",
  who: "augustin",
  text: (S) =>
    "*J-3.* Augustin vous attend en haut de l'escalier de la cave, une lampe à pétrole à la main.\n\n" +
    "— Quarante ans que je descends chercher le vin ici, *dit-il,* et je n'ai jamais remarqué ce que vous allez me montrer.\n\n" +
    "Derrière les dernières barriques, sous une voûte plus ancienne que le reste, vous trouvez une porte de chêne noir. Pas de poignée. Pas de serrure. Seulement **quatre symboles de cuivre** encastrés dans le bois : un cœur, un carreau, un trèfle, un pique. Chacun s'enfonce quand on appuie dessus." +
    (S.has("jeu_incomplet") ? "\n\n*Avec la moitié du Jeu seulement, le Joker reste froid dans votre poche.*" : "\n\n*Dans votre poche, le Joker est brûlant.*"),
  choices: [
    {
      label: "Appuyer sur les symboles dans l'ordre",
      emoji: "♠️",
      riddle: {
        q: "L'ordre des quatre couleurs",
        placeholder: "ex. : pique, cœur, …",
        answers: ["coeur trefle carreau pique", "cœur trèfle carreau pique", "♥♣♦♠", "coeurtreflecarreaupique"],
        hint: `Relisez le message trouvé avec le Jeu : « L'ordre : ${SUIT_ORDER}. »`,
        ok: "c4_06",
        ko: "c4_06b",
      },
    },
  ],
});
SC("c4_06b", {
  ch: 4,
  bg: "cave",
  who: "augustin",
  mood: "danger",
  text:
    "Au troisième mauvais ordre, un grondement sourd fait trembler la voûte. Des pierres tombent du plafond. Augustin vous tire en arrière juste à temps.\n\n" +
    "Quand la poussière retombe, la porte de chêne s'est ouverte d'elle-même — de quelques centimètres, à peine. Comme si quelqu'un, de l'autre côté, avait eu pitié de vous.\n\n" +
    "— Allez-y, *souffle Augustin, couvert de poussière.* Moi, je garde l'escalier.",
  fx: (S) => S.mem("La porte des quatre couleurs s'est ouverte toute seule, de l'autre côté."),
  choices: [{ label: "Se glisser par l'entrebâillement", emoji: "🚪", to: "c4_06" }],
});
SC("c4_06", {
  ch: 4,
  bg: "chambre_zero",
  who: "fondateur",
  mood: "mystere",
  text: (S) =>
    "La Chambre Zéro est une petite pièce voûtée, éclairée par des dizaines de bougies. Au fond, un pupitre de bois et, dessus, un coffret de fer **ouvert. Et vide.**\n\n" +
    "Dans un fauteuil, enveloppé dans un vieux manteau, un homme maigre aux yeux très clairs vous regarde entrer. Vous connaissez cette silhouette. Vous l'avez vue dans le miroir.\n\n" +
    `— Bonsoir, ${S.name}. *Sa voix est faible, mais elle sourit.* Pardon pour le miroir. Un vieux tour de magicien, un jeu de reflets entre le bureau et cette pièce. Il fallait bien que je vous guide sans me montrer.\n\n` +
    "**Le Fondateur.** Vivant.\n\n" +
    "— Le soir de votre arrivée, les hommes du Maire sont venus me faire signer ce contrat. Je n'ai pas signé. Ils ont imité ma main. Alors j'ai disparu ici, avec la seule chose qui pouvait annuler cette vente : **l'acte de 1897**. Il dit que la Maison n'appartient à personne… sauf à ceux qui y vivent.\n\n" +
    "Il désigne le coffret vide, et sa main tremble.\n\n— Il y a deux nuits, quelqu'un est venu pendant que je dormais. **L'acte a disparu.**",
  fx: (S) => S.mem("RÉVÉLATION : le Fondateur est vivant, caché dans la Chambre Zéro. L'acte de 1897 a été volé."),
  choices: [
    { label: "« Je retrouverai l'acte. Je vous le promets. »", emoji: "🤝", to: "c4_07", stat: true, fx: (S) => { S.rep("fondation", 2); S.moral(1); S.set("promesse_fondateur"); } },
    { label: "« Pourquoi m'avoir choisi, moi ? »", emoji: "❔", to: "c4_06q", stat: true },
    { label: "« Vous avez menti à tout le monde. L'IRF doit savoir. »", emoji: "⚖️", to: "c4_07", stat: true, fx: (S) => { S.rep("irf", 2); S.rep("fondation", -3); S.set("denonce_fondateur"); S.mem("Vous avez annoncé au Fondateur que vous préviendriez l'IRF."); } },
  ],
});
SC("c4_06q", {
  ch: 4,
  bg: "chambre_zero",
  who: "fondateur",
  mood: "souvenir",
  text: (S) =>
    "Le Fondateur ferme les yeux, comme pour retrouver un souvenir très ancien.\n\n" +
    "— J'ai envoyé cent lettres d'admission dans ma vie. J'ai toujours observé ce que les gens faisaient en arrivant. " +
    (S.has("ruelle") ? "Vous, vous avez fait le tour par la ruelle. Vous vouliez comprendre avant d'entrer. " : "Vous, vous avez sonné à la grille sous la pluie, sans hésiter. ") +
    (S.has("jeu_repris") ? "Et quand on vous a pris le Jeu, vous êtes allé le rechercher, au lieu d'abandonner. " : S.item("jeu") ? "Et quand vous avez trouvé le Jeu, vous ne l'avez ni vendu, ni donné. " : "") +
    "\n\nIl rouvre les yeux.\n\n— La Maison n'a pas besoin d'un propriétaire. Elle a besoin d'un **gardien**. Je crois que c'est vous.",
  fx: (S) => {
    S.rep("fondation", 1);
    S.set("gardien_designe");
    S.mem("Le Fondateur : « La Maison a besoin d'un gardien. Je crois que c'est vous. »");
  },
  choices: [{ label: "« Je retrouverai l'acte. »", emoji: "🤝", to: "c4_07", fx: (S) => { S.rep("fondation", 1); S.set("promesse_fondateur"); } }],
});
SC("c4_07", {
  ch: 4,
  ep: true,
  bg: "rue_pluie",
  mood: "pluie",
  prop: "lettre",
  text: (S) =>
    `*J-${S.has("chantier_gele") ? "4… le chantier est gelé, mais pour combien de temps" : "1"}.* Vous remontez de la cave à l'aube, la tête pleine de questions. Qui a pu entrer dans la Chambre Zéro ? Qui connaissait l'ordre des quatre couleurs ?\n\n` +
    (S.has("denonce_fondateur") ? "Valence a reçu votre message. Elle a répondu en un mot : *« Ce soir. »* Mais avant elle, quelqu'un d'autre vous a écrit.\n\n" : "") +
    "Sur votre oreiller, une enveloppe noire. Un parfum de rose. Une empreinte de rouge à lèvres.\n\n" +
    (S.has("dette_velours")
      ? "> *« Le moment est venu de payer ta dette, petit. Ce soir, minuit, au Casino. Viens seul. J'ai quelque chose qui a deux cents ans de plus que toi. — V. »*"
      : "> *« Ce soir, minuit, au Casino. Viens seul. J'ai quelque chose qui a deux cents ans de plus que toi… et toi, tu as quelque chose qui m'appartient. — V. »*") +
    (S.has("secret_velours") ? "\n\n*La fille du Fondateur. Évidemment. Qui d'autre aurait connu le chemin de la Chambre Zéro ?*" : ""),
  choices: [{ label: "Attendre minuit", emoji: "🕛", to: "c4_fin" }],
});
SC("c4_fin", {
  ch: 4,
  bg: "casino",
  who: "velours",
  end: 4,
  text: (S) =>
    "**Fin du chapitre IV — Sept Jours.**\n\n" +
    "*Minuit. Le Casino est fermé, vide, silencieux. Une seule table est éclairée. Velours y est assise, seule, en robe noire cette fois. Devant elle, posé sur le tapis vert : un parchemin jauni, roulé, scellé d'une cire rouge frappée du blason de la Maison.*\n\n" +
    "— Assieds-toi, *dit-elle.* On va jouer une dernière partie, toi et moi. **L'acte de 1897 contre le Jeu du Fondateur.**\n\n" +
    `*Elle commence à battre les cartes.*\n\n**Votre enquête** : ${S.sv.choices} choix · ${S.sv.items.length} objets · ${S.sv.mem.length} souvenirs · morale ${S.sv.moral >= 1 ? "honnête" : S.sv.moral <= -1 ? "ambiguë" : "neutre"}.\n\n` +
    "📖 **Chapitre V — La Dernière Main** arrive bientôt.",
  choices: [],
});
// la fin du chapitre III ouvre maintenant le chapitre IV
STORY.c3_fin.choices = [{ label: "Chapitre IV : Sept Jours", emoji: "⏳", style: "success", to: "c4_00" }];
STORY.c3_fin.text = (S) =>
  "**Fin du chapitre III — L'Hôtel de Ville.**\n\n" +
  "*La silhouette ne répond pas. Elle lève simplement une main, et pose un doigt sur ses lèvres. Puis le miroir redevient un miroir.*\n\n" +
  "*Dehors, la pancarte des démolisseurs indique J-7. Le Maire a ses secrets, Arnaud a peur de quelqu'un, Velours cache plus qu'elle ne le dit, et le Fondateur… le Fondateur est peut-être plus proche que vous ne le pensez.*\n\n" +
  `**Votre enquête jusqu'ici** : ${S.sv.choices} choix · ${S.sv.items.length} objets · ${S.sv.mem.length} souvenirs.`;
