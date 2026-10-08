
// --- Membres de la Maison sans compte Discord ---
// Leur carte est fixe : image dans assets/cartes-perso/<id>.webp, visage pour les miniatures dans <id>-avatar.jpg,
// chiffres de combat et attaques repris de l'image de la carte.
const OFFLINE_MEMBERS = {
  lisa: {
    name: "Lisa",
    rarity: "legendaire",
    stars: 2,
    text: "Développeuse de la Maison. Elle compile ses rêves en lignes de code.",
    role: { name: "Développeuse", color: "#b8860b", norm: 0.7 },
    // PV 199, attaques 61 et 119, chance 97 (voir combatProfile)
    stats: { prestige: 99, influence: 92, chance: 97 },
    memberStats: { PRE: 99, ACT: 90, ANC: 60, FOR: 50, STA: 63, CHA: 97 },
    moves: [
      { name: "Développement concentré", text: "Analyse, implémentation, résolution de bug. Attaque de base : aucune énergie requise.", cost: 1, damage: 60 },
      { name: "Création de projets", text: "Planification, codage, tests, déploiement. Coup spécial : coûte 3 énergies, impossible à esquiver.", cost: 3, damage: 120 },
    ],
  },
};
const offlineAvatar = (id) => {
  const file = path.join(__dirname, "assets", "cartes-perso", `${id}-avatar.jpg`);
  return fs.existsSync(file) ? `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}` : null;
};
const OFFLINE_CARDS = Object.entries(OFFLINE_MEMBERS).map(([id, m]) => ({
  ...C(`mb_${id}`, m.name, "👤", m.rarity, m.text),
  avatar: offlineAvatar(id),
  memberId: id,
  offline: true,
  role: m.role,
  rating: m.stats.prestige,
  stars: m.stars,
  memberStats: m.memberStats,
  fixedStats: m.stats,
  moves: m.moves,
}));
{
  const members = memberCards;
  memberCards = (activeOnly = false) => [...members(activeOnly), ...OFFLINE_CARDS];
  const stats = statsOf;
  statsOf = (card) => (card?.fixedStats ? { ...card.fixedStats } : stats(card));
  const moves = memberMoves;
  memberMoves = (card) => (card?.moves ? card.moves.map((m) => ({ ...m })) : moves(card));
}
