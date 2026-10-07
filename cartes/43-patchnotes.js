
// --- Salon des patch notes : chaque version est publiée une seule fois ---
const PATCH_NOTES = [
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
  for (const note of [...PATCH_NOTES].sort((a, b) => Number(a.version) - Number(b.version))) {
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
