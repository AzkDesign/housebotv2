
// --- Salon des patch notes : chaque version est publiée une seule fois ---
const PATCH_NOTES = [
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
          "• **Pass Premium** (20 000 €) : une 2ᵉ voie bien plus riche.\n" +
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
  for (const note of PATCH_NOTES) {
    if (st.patchNotes[note.version]) continue;
    const embeds = note.parts.map(([title, text], i) => {
      const e = new EmbedBuilder().setColor(note.color).setTitle(title).setDescription(text);
      if (i === 0) e.setAuthor({ name: `Les Cartes de la Maison — Mise à jour v${note.version}` });
      if (i === note.parts.length - 1) e.setFooter({ text: note.footer }).setTimestamp();
      return e;
    });
    // un message pour le titre, puis les nouveautés par groupes de 4 encadrés
    const head = await ch.send({ content: `# 🃏 Mise à jour v${note.version}` }).catch(() => null);
    if (!head) return;
    for (let k = 0; k < embeds.length; k += 4) await ch.send({ embeds: embeds.slice(k, k + 4) }).catch(() => null);
    st.patchNotes[note.version] = Date.now();
    save();
  }
}
