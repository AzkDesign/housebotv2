
// --- Salon des patch notes : chaque version est publiée une seule fois ---
const PATCH_NOTES = [
  {
    version: "1.20",
    color: 0x22c55e,
    parts: [
      [
        "🔄 Les combats survivent aux redémarrages",
        "Fini le « combat terminé » quand le bot redémarre en plein match !\n" +
          "• Chaque combat en cours est **sauvegardé à chaque manche** : équipes, PV, énergie, initiative, mises et paris.\n" +
          "• Au redémarrage, le combat **reprend là où il s'était arrêté**, dans le même fil : les deux joueurs sont mentionnés.\n" +
          "• Les choix déjà faits sont gardés, et la manche reprise laisse **2 minutes** pour revenir jouer.\n" +
          "• Les parties classées restent classées, les matchs du tournoi restent dans le tableau.\n" +
          "• Seul un combat vraiment impossible à reprendre (plus de 3 h d'arrêt, fil supprimé) est annulé, et tout est **remboursé**.",
      ],
      [
        "🏆 Parties classées : on vous dit pourquoi ça ne trouve pas",
        "• Un autre joueur est dans la file mais **trop loin de votre niveau** ? Le bot vous le dit : son nom, ses points, l'écart, et si vous êtes **trop haut** ou **trop bas** (600 points d'écart au maximum).\n" +
          "• S'il est à portée, le bot indique **quand le combat se lancera** : l'écart accepté s'élargit avec l'attente.\n" +
          "• Tout en haut (ou tout en bas) du classement, sans personne à moins de 600 points ? Vous êtes **prévenu dès le lancement** de la recherche.\n" +
          "• En fin de recherche, le message explique pourquoi personne n'a été trouvé.",
      ],
      [
        "🔊 Et aussi : le son des grands moments",
        "Quatre moments ont maintenant leur **vidéo avec le son** (cliquez pour l'écouter) :\n" +
          "• 🏰 **Manoir détruit** au Clash : explosion, fanfare, une cloche par étoile.\n" +
          "• 🐉 **Victoire en raid** : le rugissement et la chute de Nyxaros.\n" +
          "• 🎰 **Jackpot** au casino : les rouleaux, les cloches et la pluie de pièces.\n" +
          "• 👑 **Champion du tournoi** : roulement de tambour et feux d'artifice.",
      ],
    ],
    footer: "Plus aucun combat perdu ! ⚔️",
  },
  {
    version: "1.19",
    color: 0xec4899,
    // une vitrine de quelques emotes (classiques, toxiques, amour, exclusive)
    image: async () => {
      const ids = ["rire", "cheh", "ptdr", "ez", "jtm", "rose", "goat", "nyxaros"], tile = 200, gap = 18, W = 4 * tile + 5 * gap, H = 150 + 2 * (tile + gap) + 10;
      const c = createCanvas(W, H), ctx = c.getContext("2d");
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#1e1b4b");
      bg.addColorStop(1, "#4a044e");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.font = "16px CardEngrave";
      ctx.fillStyle = "#fde68a";
      spaced(ctx, "NOUVEAU DANS LES COMBATS", W / 2, 48, 5);
      ctx.font = "58px CardTitle";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("Les emotes", W / 2, 112);
      for (const [i, id] of ids.entries()) ctx.drawImage(await emoteTile(emoteOf(id)), gap + (i % 4) * (tile + gap), 140 + Math.floor(i / 4) * (tile + gap), tile, tile);
      return c;
    },
    parts: [
      [
        "😄 Les emotes arrivent dans les combats !",
        "Comme dans Clash Royale : pendant un combat, cliquez sur **😄 Emotes** et envoyez une emote animée à votre adversaire.\n" +
          "• **53 emotes** : visages en 3D animés, avec larmes, flammes, confettis, cœurs, pluie de billets…\n" +
          "• **4 offertes** à tout le monde : Rire, Pleurs, Colère et Bien joué.\n" +
          "• Choisissez vos **8 favorites** : ce sont elles qui s'affichent en combat.\n" +
          "• Une emote toutes les **6 secondes**, et elle disparaît d'elle-même au bout de 30 s.\n" +
          "• Contre la Maison… elle répond parfois.",
      ],
      [
        "😈 Toxiques et ❤️ Amour",
        "• **Toxiques**, pour chambrer : CHEH !, EZ., Skill issue., Tu dors ?, RIP., Poule mouillée !, PTDR, Le GOAT.…\n" +
          "• **Amour**, pour les déclarations : Je t'aime !, Coup de foudre !, Une rose, Cœur brisé, Câlin !, Je t'adore !…\n" +
          "• 🔇 **Couper les emotes** : trop chambré ? Un bouton masque les emotes de votre adversaire pendant tout le combat.",
      ],
      [
        "🛍️ Débloquez-les",
        "• `/emotes` (ou le bouton **😄 Emotes** de la boutique) : toute la collection, chaque emote en mouvement, et vos favorites.\n" +
          "• Les emotes se débloquent avec la **poussière d'étoile** ✨ (de 400 à 1 500).\n" +
          "• Deux **exclusives** : 👑 **Le Roi** pour les champions du tournoi, et 🐉 **Rugissement** pour ceux qui ont capturé Nyxaros en raid.",
      ],
    ],
    footer: "CHEH ! 😝",
  },
  {
    version: "1.18",
    color: 0x7e22ce,
    // la carte du boss de raid, en version brillante
    image: () => drawCreatureCard(EVENTS.ev_nyxaros, true, 0.3),
    parts: [
      [
        "🐉 Les raids : Nyxaros, le Dragon des Abysses",
        "Un boss gigantesque sort des abysses **trois fois par jour** (vers 13 h, 17 h et 21 h) dans le salon 🐉・raids.\n" +
          "• **5 minutes** pour rejoindre et choisir 3 cartes : il est d'astre 🌑 Ombre, vos cartes ⭐ **Étoile** lui font **double dégâts**.\n" +
          "• **2 min 30 de combat en direct**, tous ensemble : chacun a son poste de combat privé avec ⚔️ attaque, 💥 coup spécial, 🛡️ esquive et 🔄 changement de carte.\n" +
          "• Quand il **inspire**, esquivez : son **Souffle des abysses** est dévastateur.\n" +
          "• S'il tombe : **2 à 8 cartes de capture** selon vos dégâts pour tenter de l'attraper. Sa carte est **mythique**… et parfois **brillante** 🌈.\n" +
          "• `/raid` : l'heure du prochain raid.",
      ],
      [
        "📈 La Bourse de la Maison",
        "Achetez des **parts des entreprises** de la Maison dans le salon 📈・bourse (ou `/bourse`) et revendez-les quand vous voulez.\n" +
          "• Le cours bouge **chaque minute** et suit le **vrai chiffre d'affaires** des entreprises.\n" +
          "• Bureau de trading : achat et vente **en un clic**, courbe en direct, plus-values de votre portefeuille.\n" +
          "• 📰 **Rumeurs et annonces** : de 9 h à 23 h, des nouvelles tombent sur les entreprises. Une rumeur fait bouger le cours… puis elle est **confirmée** ou **démentie**. À vous de flairer le bon coup !\n" +
          "• Frais de 1 % par ordre, 25 000 € investis au maximum par entreprise.",
      ],
      [
        "🎰 Le casino plus fluide",
        "• **Crash** : le multiplicateur s'affiche en direct, et vous êtes payé au multiplicateur de **l'instant exact de votre clic**. Un bouton « Encaisser » vous attend dans votre confirmation d'embarquement.\n" +
          "• Roulette, Crash et courses : **un seul résultat** à la fois dans chaque salle, les anciens disparaissent.",
      ],
      [
        "🃏 Et aussi",
        "• **Une seule carte DUO** par équipe de combat : le choix est maintenant refusé clairement (plus de carte retirée sans prévenir).\n" +
          "• Le panneau du **tournoi** affiche la carte du dernier champion.\n" +
          "• Les **impôts** vont désormais **en entier** dans la caisse de la mairie chaque dimanche.",
      ],
    ],
    footer: "À l'assaut du dragon ! 🐉",
  },
  {
    version: "1.17",
    color: 0x1d4ed8,
    // la carte de Charlotte, rendue au moment de la publication
    image: async () => {
      const card = findCard(`mb_${CHARLOTTE_ID}`);
      return card ? drawCreatureCard(card, true, 0.3) : null;
    },
    parts: [
      [
        "✡️ Une carte unique : Charlotte, championne du tournoi",
        "**Charlotte** a enfin sa carte de membre, et elle ne ressemble à aucune autre : l'**Édition Étoile de David**.\n" +
          "• Un cadre en **pierre de Jérusalem** et les rayures bleues du **talit**.\n" +
          "• Son portrait dans une **fenêtre en arc** et une rosace en vitrail, sous une **étoile de David** en or.\n" +
          "• Les **remparts de la vieille ville** au clair de lune, une **menorah** aux sept flammes qui vacillent, des **branches d'olivier** et des **grenades**.\n" +
          "• Ses attaques sont écrites sur un **rouleau de parchemin**, avec le symbole **Haï** (חי, « la vie »).\n" +
          "• Championne du dernier tournoi : sa carte porte le **sceau de championne**, et elle reçoit le dos de carte exclusif **Couronne du champion**.",
      ],
      [
        "🪙 Et aussi",
        "• **Bureau de change** : dans `/boutique`, achetez des **pièces avec vos euros** (cher, et plafonné à 3 000 pièces par semaine).\n" +
          "• **`/solde`** affiche maintenant aussi vos **pièces** et votre **poussière d'étoile**.",
      ],
    ],
    footer: "Mazal tov, Charlotte ! 🏆",
  },
  {
    version: "1.16",
    color: 0xf59e0b,
    parts: [
      [
        "🪙 Pile ou face : qui frappe en premier ?",
        "Chaque combat de l'Arène commence maintenant par un **lancer de pièce en 3D** !\n" +
          "• **FACE** 👑 (pièce d'or) pour le joueur qui lance le combat, **PILE** ⭐ (pièce d'argent) pour son adversaire.\n" +
          "• La pièce s'envole, rebondit et tourne sur la tranche avant de tomber… suspense jusqu'au bout.\n" +
          "• Le gagnant a l'**initiative** à la manche 1, puis elle **passe d'un joueur à l'autre** à chaque manche.",
      ],
      [
        "⚡ L'initiative au combat",
        "• À **coup égal** (attaque contre attaque, spécial contre spécial), le joueur qui a l'initiative **frappe le premier**.\n" +
          "• Une carte mise K.O. avant son tour ne frappe pas : l'initiative peut décider d'un combat serré !\n" +
          "• Le triangle ne change pas : une attaque frappe toujours avant un spécial.\n" +
          "• L'initiative de la manche s'affiche sur le panneau du combat.",
      ],
      [
        "🎰 Et aussi",
        "• **Casino** : le plafond de 15 000 € est supprimé, les gains sont versés en entier.",
      ],
    ],
    footer: "Que la chance soit avec vous ! 🪙",
  },
  {
    version: "1.15",
    color: 0x7c3aed,
    // une vraie base rendue en 3D au moment de la publication
    image: () => {
      const b = ghostBase(5, 3);
      b.ghost = false;
      b.name = "Votre Maison en 3D";
      b.trophies = 1250;
      return drawClashBase(b);
    },
    parts: [
      [
        "🏰 Le Clash de la Maison passe en 3D",
        "Votre Maison est maintenant une **île flottante au-dessus d'une mer de nuages**.\n" +
          "• Chaque bâtiment est **modélisé en 3D** et change d'allure à chaque niveau.\n" +
          "• **Vraies ombres** au soleil, brume, cascade, arbres, chemins pavés et oiseaux.\n" +
          "• Nouvelle interface : bandeaux dorés, **icônes 3D**, bulles de récolte au-dessus des mines.\n" +
          "• En repérage, la **portée des défenses** est tracée au sol.",
      ],
      [
        "⚔️ Des attaques en vraie cinématique",
        "• Intro **« À l'assaut ! »** et ouverture des portails.\n" +
          "• La **caméra suit vos soldats** ; canons et mortiers se tournent vers leur cible.\n" +
          "• Les bâtiments détruits tombent en **ruines fumantes**.\n" +
          "• Quand le **Manoir** tombe : ralenti, zoom et étoile bonus.\n" +
          "• Bilan final : les étoiles tombent et le butin défile.",
      ],
      [
        "🧰 Correctif : le Manoir niveau 2 enfin accessible",
        "Impossible de payer le Manoir niveau 2 (2 500 or) avec un stock limité à 1 600 : c'est réparé, comme les niveaux suivants.\n" +
          "• Le **Manoir garde lui-même une réserve** : 2 000 au niveau 1, jusqu'à 70 000 au niveau 6.\n" +
          "• Avec vos **coffres-forts au niveau du Manoir**, sa prochaine amélioration tient toujours dans votre stock.\n" +
          "• Coffres trop petits pour un chantier ? Le jeu vous le dit maintenant clairement.",
      ],
    ],
    footer: "À l'assaut ! ⚔️",
  },
  {
    version: "1.14",
    color: 0xf59e0b,
    parts: [
      [
        "🪙 Les pièces : la monnaie du jeu de cartes",
        "Le jeu de cartes a maintenant **sa propre monnaie : les pièces 🪙**, séparée des **euros** de la Maison.\n" +
          "• Quêtes, séries complètes, pass, tournoi, combats gagnés : tout rapporte des **pièces**.\n" +
          "• Boosters, marché, échanges, mises et paris de l'Arène, pass Premium, boutique de styles : tout se paie en **pièces**.\n" +
          "• Vos **euros** ne bougent plus avec les cartes : ils restent pour la vraie économie de la Maison.\n" +
          "• 🎁 Chaque joueur reçoit **2 000 🪙** pour démarrer. Votre solde s'affiche dans `/inventaire`.",
      ],
      [
        "🆕 Et aussi dans la Maison",
        "• ⚽ **Paris sportifs** sur les vrais matchs (Ligue 1, Ligue des champions, équipe de France…), en euros, de 10 à 500 € par pari.\n" +
          "• 🔨 **Enchères** : vendez au plus offrant avec `/enchere`.\n" +
          "• ⚖️ **Tribunal** : `/proces` devant le jury de la Fondation, et `/casier`.",
      ],
    ],
    footer: "Bon jeu ! 🪙",
  },
  {
    version: "1.13",
    color: 0x2563eb,
    parts: [
      [
        "📦 Les boosters s'échangent !",
        "À la **table d'échange**, un nouveau bouton **📦 Boosters** permet de poser vos **boosters fermés** à côté de vos cartes et de votre argent.\n" +
          "• Jusqu'à **10 boosters** par personne et par échange (Standard, Premium, Prestige, boosters de saison…).\n" +
          "• Ils apparaissent sur la table et comptent dans la **valeur estimée** de l'offre.\n" +
          "• Comme pour les cartes, rien ne bouge tant que **les deux** n'ont pas validé, et toute modification annule les validations.\n" +
          "• Le **cadeau du jour** reste personnel : il ne s'échange pas.",
      ],
      [
        "🛠️ Et aussi",
        "• Nouvelle carte de membre légendaire : **Lisa**, la développeuse de la Maison 💻.\n" +
          "• **Mode Histoire** : la partie de blackjack contre Velours (chapitre II) ne provoque plus d'erreur, et les pages s'ouvrent même quand le bot est très occupé.\n" +
          "• **Combats** : les manches très longues ne font plus planter le bot ; l'animation est simplement allégée.",
      ],
    ],
    footer: "Bons échanges ! 🔄",
  },
  {
    version: "1.12",
    color: 0x22c55e,
    parts: [
      [
        "🎯 Plus de quêtes chaque jour",
        "• **5 quêtes par jour** au lieu de 3 : **3 normales** et **2 difficiles** 🔥.\n" +
          "• Les quêtes difficiles demandent plus (gagner 3 combats, ouvrir 5 boosters, jouer 25 manches…) mais rapportent **3 à 4 fois plus** de poussière et d'euros.\n" +
          "• Jamais deux fois la même action le même jour.\n" +
          "• Terminez les **cinq** pour gagner un **booster Premium** (au lieu d'un Standard).",
      ],
      [
        "🏆 Des classements tout neufs",
        "Le salon des classements devient un vrai **Hall of Fame** en image :\n" +
          "• le **podium de la collection** (les 3 meilleurs sur les marches, puis les places 4 à 10) ;\n" +
          "• les meilleurs de l'**Arène**, des **équipes**, des **succès**, des **holos** et des **Shiny**, et le **gardien de l'île**, avec vos avatars.",
      ],
    ],
    footer: "Bonne chance pour grimper au classement ! 🏆",
  },
  {
    version: "1.11",
    color: 0xa855f7,
    parts: [
      [
        "📚 Le défi ultime : Maître Collectionneur",
        "Réunissez **toute la collection de la Génération 1** (hors cartes de membres et de duos) : Paris, La Maison, événements, saisons, Mode Histoire, Utilitaires…\n" +
          "Le premier qui y arrive (et chaque suivant) reçoit la carte **mythique unique Maître Collectionneur** en holo, impossible à obtenir autrement. Elle est déjà visible dans le codex… à vous de la débloquer !",
      ],
      [
        "⚔️ Et aussi",
        "• Les **cartes de membres** suivent enfin leur rareté en combat : une carte mythique de membre est maintenant plus forte qu'une légendaire.\n" +
          "• L'**île** rapporte **10 ✨ toutes les 10 minutes**, et 10 XP d'équipe par heure de garde.",
      ],
    ],
    footer: "Bonne chasse aux cartes ! 📚",
  },
  {
    version: "1.10",
    color: 0x22d3ee,
    parts: [
      [
        "🏝️ L'île fait peau neuve",
        "• L'île est maintenant une **vraie scène illustrée** : ciel, mer, lagon, plage et décor en 3D.\n" +
          "• Les cartes de la défense sont **plantées sur la plage**, avec leurs PV.\n" +
          "• Un panneau pour le **gardien** : blason ou avatar, depuis quand il tient l'île, ses gains, les attaques repoussées.\n" +
          "• Bouclier de conquête en **dôme**, alerte rouge pendant une attaque.",
      ],
      [
        "🛍️ Nouveau dans la boutique : les skins d'île",
        "Le gardien choisit le décor de l'île… et **tout le serveur le voit** tant qu'il la garde !\n" +
          "🌙 Lagon de nuit · 🌋 Île volcanique · 🐧 Banquise · 🌸 Île des cerisiers · 🗿 Île de Pâques · 🏴‍☠️ Île au trésor · 👑 Paradis doré\n" +
          "🎃 Et pour octobre seulement : l'**Île hantée**.",
      ],
    ],
    footer: "À vous de marquer l'île de votre style ! 🏝️",
  },
  {
    version: "1.09",
    color: 0xfbbf24,
    parts: [
      [
        "👑 Le booster Prestige est amélioré",
        "Même prix, bien meilleur contenu :\n" +
          "• **4 cartes** au lieu de 3, et **plus aucune commune**.\n" +
          "• Toujours **une épique garantie**… qui a maintenant bien plus de chances d'être **légendaire** ou **mythique**.\n" +
          "• Au total : environ **1 chance sur 3** d'avoir une légendaire ou mieux dans chaque Prestige (contre 1 sur 5 avant), et une mythique deux fois plus souvent.",
      ],
    ],
    footer: "Bonnes ouvertures ! 👑",
  },
  {
    version: "1.08",
    color: 0xf59e0b,
    parts: [
      [
        "🏆 Le tournoi du week-end fait peau neuve",
        "• **Un tableau digne d'un vrai tournoi** : les deux moitiés convergent vers la finale, sous le trophée. Avatars, têtes de série, rangs, matchs **EN DIRECT** et parcours des vainqueurs en or.\n" +
          "• **Inscriptions** : le podium des récompenses, les inscrits et les places encore libres.\n" +
          "• **Affiche de chaque tour** avec tous les duels, et une **carte de victoire** après chaque match.\n" +
          "• **Un « VS » animé** au début de chaque match (et une version spéciale pour la grande finale).\n" +
          "• **Le sacre du champion** : couronne, confettis… et un podium final avec les 4 meilleurs.",
      ],
    ],
    footer: "Rendez-vous vendredi midi pour les inscriptions ! 🏆",
  },
  {
    version: "1.07",
    color: 0xdc2626,
    parts: [
      [
        "🎬 Des combats dignes d'un anime",
        "Chaque manche est désormais une vraie séquence animée :\n" +
          "• **Caméra en mouvement** : zooms, travellings et tremblements à chaque coup.\n" +
          "• **Images d'impact** en noir, blanc et rouge, arrêt sur image et onomatopées façon manga.\n" +
          "• **Gros plan en cases de manga** avant chaque attaque spéciale, avec l'illustration de votre carte.\n" +
          "• Une nouvelle **interface de combat** : barres de vie qui se vident, astre de chaque carte, cartes restantes.",
      ],
      [
        "🌌 Les Territoires des astres",
        "Quand une attaque spéciale frappe l'astre qu'elle domine, l'attaquant **déploie son Territoire** : l'arène entière se transforme.\n" +
          "☀️ Soleil noir · ❄️ Zéro absolu · ⚡ Mille éclairs · ⭐ Voûte céleste · 🌑 Néant · 🌙 Lune pâle\n" +
          "Chaque astre a sa propre charge, son attaque et ses éclats : boule de feu, pics de glace, foudre, pluie de météores, mains d'ombre, lames de lune…",
      ],
      [
        "⚔️ Et aussi",
        "• Les **coups critiques** déchirent l'écran d'éclairs noirs, les **K.O.** font voler la carte en éclats.\n" +
          "• Le **coup de grâce** a sa propre mise en scène, jusqu'à l'écran de victoire.\n" +
          "• Dans l'arène, l'astre de chaque carte est visible et le menu de changement indique qui a l'avantage.\n" +
          "• Le **codex** ne montre plus que les cartes de base : les éditions dorées, full art, or et prisme sont des styles de la carte.",
      ],
    ],
    footer: "Que vos territoires s'étendent ! 🌌",
  },
  {
    version: "1.06",
    color: 0x8b5cf6,
    image: () => drawAstreWheel(560),
    parts: [
      [
        "🌌 Les Astres : faiblesses et résistances",
        "Chaque carte appartient désormais à un **astre**, et il compte vraiment en combat :\n" +
          "☀️ **Soleil** bat ❄️ **Givre** — le soleil fait fondre le givre\n" +
          "❄️ **Givre** bat ⚡ **Orage** — le froid fige l'orage en neige\n" +
          "⚡ **Orage** bat ⭐ **Étoile** — les nuées cachent les étoiles\n" +
          "⭐ **Étoile** bat 🌑 **Ombre** — la lumière perce l'ombre\n" +
          "🌑 **Ombre** bat 🌙 **Lune** — l'éclipse de Lune\n" +
          "🌙 **Lune** bat ☀️ **Soleil** — l'éclipse de Soleil",
      ],
      [
        "⚔️ En combat",
        "• Frapper l'astre qu'on domine : **dégâts ×2** — « SUPER EFFICACE ! »\n" +
          "• Frapper l'astre qui nous domine : **dégâts ×0,5** — « Peu efficace… »\n" +
          "• Un coup super efficace ne retire jamais plus des **2/3 des PV** d'une carte : pas de K.O. en un seul coup.\n" +
          "• Valable partout : classées, défis, entraînement, île et boss.",
      ],
      [
        "🃏 Sur vos cartes",
        "• Chaque carte affiche son **astre**, sa **faiblesse** (×2) et sa **résistance** (×0,5).\n" +
          "• Les **membres** prennent l'astre de leur point fort, les **cartes DUO** celui de leur emblème.\n" +
          "• L'astre apparaît aussi dans le choix de votre équipe.",
      ],
      [
        "👹 Les boss ont un astre",
        "Le Spectre du Manoir est 🌑 **Ombre** : sortez vos cartes ⭐ **Étoile** ! Chaque boss a le sien, à vous d'adapter votre équipe.",
      ],
    ],
    footer: "Que les astres vous soient favorables ! 🌙",
  },
  {
    version: "1.05",
    color: 0xe9c46a,
    parts: [
      [
        "⚔️ Arène : nouveau menu de combat",
        "• **Parties classées en ligne** : rejoignez la file, le bot vous trouve un adversaire de votre niveau. Ce sont les seules qui font monter votre rang.\n" +
          "• **Boss de la semaine** 👹 : un boss commun à tout le serveur (en octobre, *le Spectre du Manoir*). 3 essais par jour, les dégâts de tous s'additionnent. Quand il tombe, tous les participants reçoivent un booster (Prestige pour le top 3).\n" +
          "• Les défis entre membres deviennent des **combats amicaux** (avec mise si vous voulez).",
      ],
      [
        "🎟️ Pass de combat",
        "• Un pass **chaque mois**, 30 paliers : gagnez de l'XP en jouant et réclamez poussière, euros et boosters.\n" +
          "• **Pass Premium** (8 000 €) : une 2ᵉ voie bien plus riche.\n" +
          "• 🎃 **Octobre : le Pass de l'Effroi** — boosters Frisson, Chat noir, Fantôme de la Maison et **Lune de sang** à gagner !\n" +
          "• 🤝 **Pass Duo** : avec votre coéquipier, remplissez ensemble un pass d'équipe. Au bout du Premium : votre carte DUO en holo.\n" +
          "• Nouveau salon **🎟️・pass-de-combat** avec le classement de tous les joueurs.",
      ],
      [
        "🏆 Tournoi du week-end",
        "• Inscriptions le **vendredi midi**, élimination directe, **finale le dimanche à 20 h**.\n" +
          "• Le champion gagne poussière, euros, un booster Prestige et le rôle **Champion du tournoi**.",
      ],
      [
        "🤝 Cartes DUO",
        "• Chaque équipe de deux a **sa carte DUO** : les deux membres, le blason de l'équipe, une attaque et une animation propres à chaque emblème.\n" +
          "• Légendaire (mythique pour la Fondation), dans les boosters et offerte aux deux membres au **niveau 6** de l'équipe.\n" +
          "• Éditions spéciales **Or** et **Prisme** à collectionner.",
      ],
      [
        "✨ Nouveaux styles de cartes de membres",
        "• **Membre Star** : votre carte devient dorée avec un sceau « Membre Star × N ».\n" +
          "• **Rôle élevé** : votre carte prend la couleur de votre rôle.\n" +
          "• Nouvelles éditions à collectionner : **Édition dorée** et **Full Art**.",
      ],
      [
        "🎒 Nouvelle catégorie : les Utilitaires",
        "5 cartes Objet à équiper sur l'île ou contre le boss :\n" +
          "🩹 Trousse de secours · 🧪 Élixir d'énergie · 🛡️ Bouclier de la Maison · ⚔️ Lame du Fondateur · 🪶 Plume de phénix (la dernière carte renaît !)",
      ],
      [
        "🏝️ L'île",
        "• **Île en duo** : si un membre d'une équipe la garde, elle est à l'équipe. Les deux touchent les gains et peuvent gérer la défense.\n" +
          "• **L'IA du gardien s'adapte** : plus la défense est rare, plus elle est coriace.\n" +
          "• **Bouclier de conquête** : 30 min de protection après une prise, et l'ancien gardien doit attendre 2 h avant de la reprendre.\n" +
          "• Les PV de la défense reviennent plus vite.",
      ],
      [
        "🏰 Clash de la Maison",
        "• Nouveau rendu 3D, **cinématique de combat** et objectifs guidés.\n" +
          "• Ressources à **récolter** dans vos mines, butin pris dans les réserves des mines détruites.\n" +
          "• Après une attaque, vos troupes se **reforment 15 min** (8 attaques par jour au maximum).",
      ],
    ],
    footer: "Bon jeu à toutes et à tous ! 🃏",
  },
];
async function publishPatchNotes() {
  const ch = chan("patchnotes");
  if (!ch || ch === channelRef) return;
  const st = load();
  st.patchNotes ??= {};
  // tri par numéro de version (« 1.20 » vient après « 1.19 », pas avant « 1.3 »)
  for (const note of [...PATCH_NOTES].sort((a, b) => a.version.localeCompare(b.version, "fr", { numeric: true }))) {
    if (st.patchNotes[note.version]) continue;
    const embeds = note.parts.map(([title, text], i) => {
      const e = new EmbedBuilder().setColor(note.color).setTitle(title).setDescription(text);
      if (i === 0) e.setAuthor({ name: `Les Cartes de la Maison — Mise à jour v${note.version}` });
      if (i === note.parts.length - 1) e.setFooter({ text: note.footer }).setTimestamp();
      return e;
    });
    // un message pour le titre, puis les nouveautés par groupes de 4 encadrés
    const files = [];
    if (note.image) {
      const img = await Promise.resolve(note.image()).catch(() => null);
      if (img) files.push(new AttachmentBuilder(await img.encode("png"), { name: `patch-${note.version}.png` }));
    }
    const head = await ch.send({ content: `# 🃏 Mise à jour v${note.version}`, files }).catch(() => null);
    if (!head) return;
    for (let k = 0; k < embeds.length; k += 4) await ch.send({ embeds: embeds.slice(k, k + 4) }).catch(() => null);
    st.patchNotes[note.version] = Date.now();
    save();
  }
}
