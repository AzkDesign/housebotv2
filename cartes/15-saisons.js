
// --- Événements saisonniers : boosters à durée limitée et cartes exclusives ---
// Les boosters ne sont vendus que pendant l'événement ; les cartes se gardent pour toujours.
const SEASON_CARDS = {
  hw_citrouille: C("hw_citrouille", "Citrouille hantée", "🎃", "commune", "Elle sourit… mais pas pour longtemps."),
  hw_bonbon: C("hw_bonbon", "Bonbon ensorcelé", "🍬", "commune", "Un bonbon ou un sort ?"),
  hw_chauve: C("hw_chauve", "Chauve-souris", "🦇", "peucommune", "Elle ne sort qu'à la nuit tombée."),
  hw_araignee: C("hw_araignee", "Araignée tisseuse", "🕷️", "rare", "Sa toile couvre tout le grenier."),
  hw_chat: C("hw_chat", "Chat noir", "🐈‍⬛", "epique", "Il porte malheur… à ses adversaires."),
  hw_fantome: C("hw_fantome", "Fantôme de la Maison", "👻", "legendaire", "Il hante les couloirs depuis la fondation."),
  hw_lune: C("hw_lune", "Lune de sang", "🌕", "mythique", "Une nuit par an, elle se lève sur la Maison."),
  xm_cookie: C("xm_cookie", "Biscuit de Noël", "🍪", "commune", "Croustillant, cannelle et gingembre."),
  xm_cloche: C("xm_cloche", "Cloche", "🔔", "commune", "Elle sonne le début des fêtes."),
  xm_flocon: C("xm_flocon", "Flocon", "❄️", "peucommune", "Aucun ne ressemble à un autre."),
  xm_bonhomme: C("xm_bonhomme", "Bonhomme de neige", "⛄", "rare", "Carotte, écharpe et grand sourire."),
  xm_renne: C("xm_renne", "Renne", "🦌", "epique", "Il connaît le chemin de toutes les cheminées."),
  xm_cadeau: C("xm_cadeau", "Grand cadeau", "🎁", "legendaire", "Que peut-il bien cacher ?"),
  xm_sapin: C("xm_sapin", "Sapin de la Maison", "🎄", "mythique", "Illuminé chaque année par la Fondation."),
};
// [mois, jour] de début et de fin (la fin est incluse) ; Noël se termine en janvier
const SEASONAL = {
  halloween: { name: "Halloween", title: "La Nuit des Frissons", start: [10, 20], end: [11, 5], pack: "frisson", prefix: "hw_", dates: "20 oct. – 5 nov." },
  noel: { name: "Noël", title: "Les Fêtes Givrées", start: [12, 1], end: [1, 6], pack: "givre", prefix: "xm_", dates: "1er déc. – 6 janv." },
};
function parisMonthDay() {
  const [m, d] = new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", month: "2-digit", day: "2-digit" }).format(new Date()).split("-").map(Number);
  return m * 100 + d;
}
function activeSeason() {
  const now = parisMonthDay();
  for (const [key, ev] of Object.entries(SEASONAL)) {
    const a = ev.start[0] * 100 + ev.start[1], b = ev.end[0] * 100 + ev.end[1];
    if (a <= b ? now >= a && now <= b : now >= a || now <= b) return key;
  }
  return null;
}
const seasonOfCard = (card) => Object.entries(SEASONAL).find(([, ev]) => card.id.startsWith(ev.prefix))?.[0] ?? null;
const seasonCards = (season) => Object.values(SEASON_CARDS).filter((c) => c.id.startsWith(SEASONAL[season].prefix));
// une carte saisonnière tirée selon les raretés habituelles
function drawSeasonCard(season) {
  const pool = seasonCards(season);
  const w = Object.fromEntries(ORDER.map((k) => [k, pool.some((c) => c.rarity === k) ? RARITIES[k].weight : 0]));
  const rarity = pickRarity(w);
  const list = pool.filter((c) => c.rarity === rarity);
  return { card: list[Math.floor(Math.random() * list.length)], holo: Math.random() < HOLO_CHANCE };
}
// boosters saisonniers : 4 cartes, chacune a une chance sur quatre d'être saisonnière, au moins une garantie
function seasonPackPulls(gen, type) {
  const season = PACKS[type].season;
  const pulls = Array.from({ length: 4 }, (_, i) => (i === 3 || Math.random() < 0.25 ? drawSeasonCard(season) : drawOne(null, null, gen)));
  return pulls.sort((a, c) => ORDER.indexOf(a.card.rarity) - ORDER.indexOf(c.card.rarity));
}
// annonce du début d'un événement (une fois par an)
async function announceSeason() {
  const season = activeSeason();
  if (!season) return;
  const st = load();
  const tag = `${season}-${new Date().getFullYear() - (parisMonthDay() < 200 ? 1 : 0)}`;
  if (st.seasonAnnounced === tag) return;
  st.seasonAnnounced = tag;
  save();
  const ev = SEASONAL[season], P = PACKS[ev.pack];
  const file = await packImageFile(CURRENT_GEN, ev.pack, "booster-saison.png");
  await chan("annonces")
    ?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(P.accent.slice(1), 16))
          .setTitle(`${P.emoji} ${ev.name} : ${ev.title} commence !`)
          .setDescription(
            `Le booster **${P.name}** est disponible pendant tout l'événement (${ev.dates}) dans ${channelRef} : **4 cartes**, dont au moins une des **${seasonCards(season).length} cartes exclusives** de l'événement.\n\n` +
              "Une fois l'événement terminé, le booster n'est plus vendu… mais les cartes restent dans votre collection pour toujours !"
          )
          .setImage("attachment://booster-saison.png"),
      ],
      files: [file],
    })
    .catch(() => null);
  panelDirty = true;
}
