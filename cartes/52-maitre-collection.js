
// --- Maître Collectionneur : la carte de qui possède toute la Génération 1 ---
// Il faut posséder toutes les cartes de la Gen 1, sauf celles des membres, des duos et des entreprises
// (leur liste change sans cesse) et les cartes pas encore obtenables. La récompense est une carte mythique
// unique, qui ne sort pas des boosters et ne se fabrique pas. Vérifié à chaque carte reçue, quel que soit le moyen.
const MASTER_G1 = "ev_maitre_g1";
Object.assign(FLUENT, { "📚": "Books" });
EVENTS[MASTER_G1] = C(MASTER_G1, "Maître Collectionneur", "📚", "mythique", "Toute la Génération 1, réunie dans une seule collection.");
EVENT_HOW[MASTER_G1] = "Posséder toute la collection Gen 1 (hors membres et duos)";
Object.assign(THEMES, { [MASTER_G1]: { scene: "cosmos", fx: "orbes", anim: "popout" } });
// les cartes à réunir
function gen1Required() {
  const maxChapter = Math.max(...Object.keys(STORY_CHAPTERS).map(Number));
  return collectionCards().filter(
    (c) =>
      (c.gen ?? 1) === 1 &&
      c.id !== MASTER_G1 &&
      !c.memberId &&
      !c.duo &&
      !c.id.startsWith("co_") &&
      !(c.id.startsWith("hs_") && (c.chapter ?? 0) > maxChapter) // pas encore obtenable
  );
}
function gen1Progress(userId) {
  const owned = collectedIds(userId), req = gen1Required();
  return { have: req.filter((c) => owned.has(c.id)).length, total: req.length, missing: req.filter((c) => !owned.has(c.id)) };
}
const gen1Checking = new Set();
async function checkGen1Master(userId) {
  const st = load();
  st.gen1Master ??= {};
  if (st.gen1Master[userId] || gen1Checking.has(userId)) return;
  const p = gen1Progress(userId);
  if (!p.total || p.have < p.total) return;
  gen1Checking.add(userId);
  try {
    st.gen1Master[userId] = Date.now();
    give(userId, EVENTS[MASTER_G1], true);
    save();
    const file = await cardFile(EVENTS[MASTER_G1], true).catch(() => null);
    const embed = new EmbedBuilder()
      .setColor(0xa855f7)
      .setTitle("📚 Maître Collectionneur — Génération 1")
      .setDescription(`<@${userId}> possède **toute la collection de la Génération 1** (${p.total} cartes) !\nIl reçoit la carte mythique unique **Maître Collectionneur**, que personne ne peut obtenir autrement.`)
      .setImage(file ? `attachment://${file.name}` : null);
    await chan("annonces")?.send({ embeds: [embed], files: file ? [file] : [], allowedMentions: { users: [userId] } }).catch(() => null);
    cardClient?.users
      ?.fetch(userId)
      .then((u) => u.send({ content: `📚 **Bravo !** Vous avez réuni toute la collection de la Génération 1 (${p.total} cartes). La carte mythique **Maître Collectionneur** ✦ holo est dans votre inventaire.` }))
      .catch(() => null);
  } finally {
    gen1Checking.delete(userId);
  }
}
{
  // toute carte reçue (booster, échange, marché, fabrication, récompense…) peut compléter la collection
  const base = give;
  give = (userId, card, holo) => {
    const isNew = base(userId, card, holo);
    if (isNew && card?.id !== MASTER_G1 && userId && !/\D/.test(String(userId))) setImmediate(() => checkGen1Master(userId).catch((err) => console.error("Maître Collectionneur:", err.message)));
    return isNew;
  };
  // les échanges et le marché déplacent les cartes sans passer par give : ils vérifient les séries complètes
  const series = checkSeriesRewards;
  checkSeriesRewards = async (client, userId) => {
    await series(client, userId);
    await checkGen1Master(userId).catch((err) => console.error("Maître Collectionneur:", err.message));
  };
}
