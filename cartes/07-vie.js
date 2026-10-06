// --- Vie du système : bienvenue, anti-triche, quêtes, saisons, carte de la semaine, rapport ---
const MIN_SENIORITY_DAYS = 7; // ancienneté minimale pour échanger, vendre, acheter ou parier (protection contre les doubles comptes)
const WELCOME_PACKS = [["standard", 2], ["premium", 1]];

// ancienneté sur le serveur
async function seniorityError(userId, who = null) {
  const member = await channelRef?.guild?.members.fetch(userId).catch(() => null);
  const joined = member?.joinedTimestamp;
  if (!joined) return null;
  const days = (Date.now() - joined) / 86400000;
  if (days >= MIN_SENIORITY_DAYS) return null;
  const left = Math.ceil(MIN_SENIORITY_DAYS - days);
  return `⏳ ${who ? `${who} doit` : "Vous devez"} être membre de la Maison depuis au moins ${MIN_SENIORITY_DAYS} jours pour échanger, vendre, acheter ou parier (encore ${left} jour${left > 1 ? "s" : ""}). C'est une protection contre les doubles comptes.`;
}

// pack de bienvenue : une fois par membre ayant le rôle des membres
async function grantWelcome(member, notify) {
  const st = load();
  if (st.welcomed[member.id]) return;
  st.welcomed[member.id] = Date.now();
  for (const [type, n] of WELCOME_PACKS) addPacks(member.id, packKey(CURRENT_GEN, type), n);
  if (notify) {
    await member
      .send(`🎁 **Bienvenue dans les Cartes de la Maison !** Un pack de bienvenue vous attend dans votre inventaire : **2 boosters Standard** et **1 booster Premium**. Tapez \`/inventaire\` sur le serveur pour les ouvrir, et \`/aide-cartes\` pour tout comprendre.`)
      .catch(() => null);
  }
}

// --- Statistiques de la semaine (rapport pour le staff) ---
function bump(key, n = 1) {
  const m = load().metrics;
  m[key] = (m[key] ?? 0) + n;
}
// échanges ou ventes répétés entre les deux mêmes membres : alerte au staff
async function pairAlert(a, b, kind, detail) {
  const st = load();
  const key = [a, b].sort().join(":");
  const list = (st.pairs[key] = (st.pairs[key] ?? []).filter((t) => Date.now() - t < 7 * 86400000));
  list.push(Date.now());
  if (list.length < 3) return;
  if (st.pairAlerted[key] && Date.now() - st.pairAlerted[key] < 86400000) return;
  st.pairAlerted[key] = Date.now();
  await require("./logs")
    .sendLogEmbed(
      "staff",
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🕵️ Activité répétée entre deux membres")
        .setDescription(`<@${a}> et <@${b}> : **${list.length}** ${kind} en 7 jours.\nDernier : ${detail}\n*Possible double compte ou transfert déguisé — à vérifier.*`)
        .setTimestamp()
    )
    .catch(() => null);
}
async function cheapSaleAlert(l, buyerId, cote) {
  if (l.price >= cote * 0.4) return;
  await require("./logs")
    .sendLogEmbed(
      "staff",
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🕵️ Vente bradée au marché")
        .setDescription(`**${keyLabel(l.key)}** vendue **${formatEuro(l.price)}** (cote ${formatEuro(cote)}, soit ${Math.round((l.price / cote) * 100)} %).\nVendeur : <@${l.seller}> · Acheteur : <@${buyerId}>`)
        .setTimestamp()
    )
    .catch(() => null);
}
async function weeklyReport() {
  const m = load().metrics;
  const sink = (m.boosterSpend ?? 0) + (m.marketFees ?? 0) + (m.arenaFees ?? 0);
  const source = m.questMoney ?? 0;
  await require("./logs")
    .sendLogEmbed(
      "staff",
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("📊 Cartes de la Maison — bilan de la semaine")
        .setDescription(
          `💸 **Argent retiré du circuit** : ${formatEuro(sink)}\n` +
            `· boosters achetés : ${formatEuro(m.boosterSpend ?? 0)}\n· commissions du marché : ${formatEuro(m.marketFees ?? 0)}\n· commissions de l'Arène : ${formatEuro(m.arenaFees ?? 0)}\n` +
            `💰 **Argent créé** (quêtes) : ${formatEuro(source)}\n` +
            `⚖️ **Solde** : ${sink - source >= 0 ? "le système retire" : "le système crée"} ${formatEuro(Math.abs(sink - source))} — ${sink >= source ? "pas d'inflation 👍" : "attention à l'inflation ⚠️"}\n\n` +
            `📦 Boosters ouverts : ${m.packsOpened ?? 0} · 🏪 Volume du marché : ${formatEuro(m.marketVolume ?? 0)} · 🔄 Échanges : ${m.trades ?? 0}\n` +
            `⚔️ Combats : ${m.battles ?? 0} · 🎟️ Paris : ${formatEuro(m.betsVolume ?? 0)} · 🎯 Quêtes accomplies : ${m.quests ?? 0}`
        )
        .setTimestamp()
    )
    .catch(() => null);
  load().metrics = {};
  save();
}

// --- Quêtes du jour ---
const QUESTS = {
  open_pack: { label: "Ouvrir {n} booster(s)", goal: [1, 2], dust: 40, money: 300, emoji: "📦" },
  win_fight: { label: "Gagner un combat dans l'Arène", goal: [1, 1], dust: 60, money: 500, emoji: "⚔️" },
  play_round: { label: "Jouer {n} manches dans l'Arène", goal: [5, 8], dust: 40, money: 300, emoji: "🥊" },
  market: { label: "Acheter ou mettre en vente une carte au marché", goal: [1, 1], dust: 40, money: 250, emoji: "🏪" },
  trade: { label: "Conclure un échange avec un membre", goal: [1, 1], dust: 60, money: 400, emoji: "🔄" },
  recycle: { label: "Recycler des doublons en poussière d'étoile", goal: [1, 1], dust: 30, money: 200, emoji: "♻️" },
  wild: { label: "Attraper une carte sauvage", goal: [1, 1], dust: 50, money: 300, emoji: "✋" },
  daily_pack: { label: "Récupérer votre booster gratuit du jour", goal: [1, 1], dust: 20, money: 150, emoji: "🎁" },
};
function questsOf(userId) {
  const st = load(), day = dayKey();
  let q = st.quests[userId];
  if (q?.day !== day) {
    const R = seeded(hashOf(userId + day));
    const keys = Object.keys(QUESTS);
    const picks = [];
    while (picks.length < 3) {
      const k = keys.splice(Math.floor(R() * keys.length), 1)[0];
      const [lo, hi] = QUESTS[k].goal;
      picks.push({ id: k, goal: lo + Math.floor(R() * (hi - lo + 1)), progress: 0, claimed: false });
    }
    q = st.quests[userId] = { day, list: picks, bonus: false };
  }
  return q;
}
function questProgress(userId, kind, n = 1) {
  if (!userId) return;
  const q = questsOf(userId);
  let changed = false;
  for (const it of q.list) {
    if (it.id !== kind || it.progress >= it.goal) continue;
    it.progress = Math.min(it.goal, it.progress + n);
    changed = true;
  }
  if (changed) save();
}
const questLabel = (it) => QUESTS[it.id].label.replace("{n}", String(it.goal));
function questsPayload(userId) {
  const q = questsOf(userId);
  const lines = q.list.map((it) => {
    const def = QUESTS[it.id], done = it.progress >= it.goal;
    const bar = "▰".repeat(Math.round((it.progress / it.goal) * 10)) + "▱".repeat(10 - Math.round((it.progress / it.goal) * 10));
    return `${it.claimed ? "✔️" : done ? "✅" : def.emoji} **${questLabel(it)}**\n${bar} ${it.progress}/${it.goal} · récompense : ${def.dust} ✨ + ${formatEuro(def.money)}${it.claimed ? " *(réclamée)*" : ""}`;
  });
  const claimable = q.list.some((it) => it.progress >= it.goal && !it.claimed);
  const allDone = q.list.every((it) => it.claimed);
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle("🎯 Vos quêtes du jour")
        .setDescription(`${lines.join("\n\n")}\n\n🎁 **Bonus** : terminez les trois quêtes pour gagner **1 booster Standard**${q.bonus ? " — *obtenu !*" : ""}.`)
        .setFooter({ text: `Nouvelles quêtes chaque jour à minuit · ${allDone ? "toutes réclamées, bravo !" : "elles se valident toutes seules quand vous jouez"}` }),
    ],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_qt_claim").setLabel("Réclamer les récompenses").setEmoji("🎁").setStyle(ButtonStyle.Success).setDisabled(!claimable))],
  };
}
function claimQuests(userId) {
  const q = questsOf(userId);
  let dust = 0, money = 0, n = 0;
  for (const it of q.list) {
    if (it.progress < it.goal || it.claimed) continue;
    it.claimed = true;
    dust += QUESTS[it.id].dust;
    money += QUESTS[it.id].money;
    n++;
  }
  let bonus = false;
  if (!q.bonus && q.list.every((it) => it.claimed)) {
    q.bonus = true;
    bonus = true;
    addPacks(userId, packKey(CURRENT_GEN, "standard"), 1);
  }
  if (dust) load().dust[userId] = (load().dust[userId] ?? 0) + dust;
  if (money) changeBalance(userId, money, "Quêtes des cartes", { force: true });
  bump("questMoney", money);
  bump("quests", n);
  ustat(userId, "quests", n);
  save();
  return { dust, money, n, bonus };
}

// --- Carte de la semaine : trois fois plus fréquente dans les boosters ---
function mondayKey() {
  const paris = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  paris.setDate(paris.getDate() - ((paris.getDay() + 6) % 7));
  return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, "0")}-${String(paris.getDate()).padStart(2, "0")}`;
}
const weeklyCard = () => (load().weeklyCard?.week === mondayKey() ? findCard(load().weeklyCard.id) : null);
async function pickWeeklyCard() {
  const st = load();
  if (st.weeklyCard?.week === mondayKey()) return;
  const pool = boosterPool().filter((c) => !c.id.startsWith("mb_") && ["rare", "epique", "legendaire"].includes(c.rarity) && c.id !== st.weeklyCard?.id);
  if (!pool.length) return;
  const card = pool[Math.floor(Math.random() * pool.length)];
  const old = st.weeklyCard?.messageId;
  st.weeklyCard = { week: mondayKey(), id: card.id };
  save();
  if (old) for (const ch of [chan("annonces"), channelRef]) await ch?.messages.delete(old).catch(() => null);
  const file = await cardFile(card, false);
  const msg = await chan("annonces")
    ?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(RARITIES[card.rarity].color.slice(1), 16))
          .setTitle(`🌟 Carte de la semaine : ${card.name}`)
          .setDescription(`${RARITIES[card.rarity].emoji} ${RARITIES[card.rarity].name} · ${SERIES_LABELS[seriesOf(card)]}\nCette semaine, elle sort **trois fois plus souvent** dans les boosters. À vous de l'attraper !`)
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
    })
    .catch(() => null);
  if (msg) {
    st.weeklyCard.messageId = msg.id;
    save();
  }
  panelDirty = true;
}

// --- Saisons de l'Arène : une par mois ---
const monthKey = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit" }).format(new Date());
async function checkArenaSeason(client) {
  const st = load();
  st.arenaSeason ??= { n: 1, month: monthKey() };
  if (st.arenaSeason.month === monthKey()) return;
  const ranked = Object.entries(st.arena)
    .filter(([, x]) => x.w + x.l + x.d >= 3)
    .sort((a, b) => b[1].elo - a[1].elo)
    .slice(0, 3);
  const n = st.arenaSeason.n;
  const lines = [];
  const guild = channelRef?.guild;
  if (ranked.length && guild) {
    const role = await findOrCreateRole(guild, { name: "🏆 Champion de l'Arène", color: 0xfbbf24, hoist: true }).catch(() => null);
    if (role) for (const m of role.members.values()) await m.roles.remove(role).catch(() => null);
    for (const [i, [id, x]] of ranked.entries()) {
      const dust = [500, 300, 200][i];
      st.dust[id] = (st.dust[id] ?? 0) + dust;
      await grantEventCard(client, id, i === 0 ? "ev_champion" : "ev_podium");
      if (i === 0 && role) await (await guild.members.fetch(id).catch(() => null))?.roles.add(role).catch(() => null);
      lines.push(`${["🥇", "🥈", "🥉"][i]} <@${id}> — **${x.elo}** pts · ${x.w} V / ${x.l} D · +${dust} ✨ et la carte **${i === 0 ? "Champion de l'Arène" : "Podium de l'Arène"}**`);
    }
  }
  // nouvelle saison : classement resserré vers 1000, bilan remis à zéro
  for (const x of Object.values(st.arena)) {
    x.elo = Math.round(1000 + (x.elo - 1000) * 0.5);
    x.w = x.l = x.d = 0;
    x.streak = 0;
  }
  st.arenaSeason = { n: n + 1, month: monthKey() };
  save();
  if (st.seasonMessageId) await chan("arene")?.messages.delete(st.seasonMessageId).catch(() => null);
  const seasonMsg = await chan("arene")
    ?.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xfbbf24)
          .setTitle(`🏆 Fin de la saison ${n} de l'Arène`)
          .setDescription(`${lines.join("\n") || "*Pas assez de combats cette saison pour un podium.*"}\n\nLa **saison ${n + 1}** commence : les classements sont resserrés et les bilans remis à zéro. Bonne chance !`),
      ],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
  st.seasonMessageId = seasonMsg?.id ?? null;
  save();
}

// --- Guide des cartes (commande /aide-cartes et salon du guide) ---
function cardsGuideTopics() {
  const G = GENERATIONS[CURRENT_GEN];
  return [
    ["debut", "Bien débuter", "🚀", `Bienvenue dans les **Cartes de la Maison** (${G.name} — ${G.title}) !\n\n**1.** Récupérez votre **booster gratuit** chaque jour dans le salon des cartes.\n**2.** Ouvrez vos boosters avec \`/inventaire\` (un **pack de bienvenue** vous y attend : 2 Standard + 1 Premium).\n**3.** Admirez votre collection avec \`/album\`.\n**4.** Faites vos **quêtes du jour** avec \`/quetes\`.\n**5.** Combattez dans l'**Arène** (\`/combat\`), échangez (\`/echange\`) et commercez au **marché** (\`/marche\`).`],
    ["boosters", "Boosters et inventaire", "📦", "**Standard** (5 cartes), **Premium** (5 cartes dont une rare garantie), **Prestige** (3 cartes dont une épique garantie) et le **booster gratuit** du jour.\n\nLes boosters achetés vont dans votre **inventaire** : ouvrez-les quand vous voulez. Les cartes sont révélées de la plus faible à la meilleure. Chaque génération a ses boosters ; seuls ceux de la génération en cours sont vendus.\n\n🛒 **Stock** : la boutique a un stock commun à tout le serveur (Standard 60, Premium 24, Prestige 6), qui se remplit petit à petit (plein en 24 h). Chacun a une limite par jour (15 / 6 / 2) et, quand le stock est presque vide, le prix monte de 20 %.\n\n🌟 La **carte de la semaine** sort trois fois plus souvent dans les boosters."],
    ["raretes", "Raretés et holo", "💎", "⚪ Commune · 🟢 Peu commune · 🔵 Rare · 🟣 Épique · 🟡 Légendaire · 🔴 Mythique.\n✦ Une carte sur vingt est **holographique** : plus brillante, plus rare, et un peu plus forte en combat (PV +10 %, attaque +5 %).\n\nChaque carte affiche ses **PV**, ses dégâts d'**attaque** et de **spécial**, sa **chance** et son **type**."],
    ["album", "Album, codex, poussière et récompenses", "📒", "`/album` montre votre collection page par page ; les cartes manquantes apparaissent en silhouette.\n📖 `/codex` liste toutes les cartes qui vous manquent, avec la façon de les obtenir (boosters, marché, fabrication, événement…).\n\n♻️ **Recyclez** vos doublons en **poussière d'étoile**, puis **fabriquez** la carte de votre choix.\n🏆 Compléter une série fixe rapporte de l'argent, 500 ✨ et un rôle de collectionneur."],
    ["marche", "Marché et échanges", "🏪", `**Marché** (\`/marche\`) : mettez une carte en vente au prix de votre choix, achetez celles des autres. La **cote** suit la circulation : moins une carte est répandue, plus elle vaut cher. Commission de 5 %, annonces valables 7 jours.\n\n**Échanges** (\`/echange\`) : invitez le membre de votre choix. S'il accepte, une **table d'échange** s'ouvre en direct : chacun y pose ses cartes (et de l'argent), puis les deux valident. Toute modification annule les validations : impossible de se faire avoir au dernier moment.\n\n⏳ Il faut être sur le serveur depuis au moins ${MIN_SENIORITY_DAYS} jours pour échanger, vendre, acheter ou parier.`],
    ["arene", "Arène et combats", "⚔️", "`/combat @membre` (avec une mise si vous voulez) ou **affrontez la Maison**. Chaque joueur choisit 3 cartes.\n\nChaque manche, choisissez **en secret** : ⚔️ Attaque, 🛡️ Garde, 💥 Spécial (3 ⚡) ou 🔄 Changer.\n**Triangle** : la Garde bat l'Attaque, l'Attaque interrompt le Spécial, le Spécial brise la Garde. La garde s'use si vous la répétez.\n**Types** : Paris bat Entreprises, qui battent La Maison, qui bat Paris.\n\n🏆 Une **saison** par mois : le top 3 gagne une carte exclusive, de la poussière, et le n°1 le rôle **Champion de l'Arène**. Les spectateurs peuvent **parier** pendant les 2 premières manches."],
    ["quetes", "Quêtes du jour", "🎯", "`/quetes` : trois quêtes par jour (ouvrir un booster, gagner un combat, vendre une carte…). Elles se valident toutes seules quand vous jouez. Chaque quête rapporte de la poussière et de l'argent, et les trois ensemble donnent **un booster Standard en bonus**."],
    ["succes", "Succès, titres et vitrine", "🏅", "`/succes` : 22 succès à débloquer (boosters, collection, holos, Shiny, combats, ventes, échanges…). Chacun rapporte de la poussière d'étoile et un **titre** à afficher sur votre `/profil`.\n🖼️ `/vitrine` : exposez vos **trois plus belles cartes**, visibles sur votre profil et à montrer dans la discussion.\n🏆 Les **classements** se mettent à jour en direct dans leur salon."],
    ["histoire", "Le Mode Histoire", "📖", "`/histoire` : **Les Secrets de la Maison**. Le Fondateur a disparu le soir de votre arrivée, et vous a laissé un jeu de cartes… Une enquête en chapitres, illustrée, où **chaque choix compte** : réputations auprès de 5 groupes, morale, objets, souvenirs qui reviennent plus tard.\n🎲 **Épreuves** avec vos cartes (leur chance compte) · ⚔️ **Duels** (Attaque, Garde, Ruse — observez votre adversaire) · 🧩 **Énigmes** (les indices sont dans le texte).\n🎟️ 3 tickets par jour (un ticket = un épisode), +1 possible contre 60 ✨.\n🃏 Des **cartes Histoire exclusives** et des boosters à chaque chapitre.\n*C'est une fiction : ses personnages sont inventés et vos choix ne changent rien aux vraies institutions de la Maison.*"],
    ["equipes", "Les équipes", "🛡️", "`/equipe` : formez un **duo** avec le membre de votre choix (2 joueurs au maximum).\n⭐ Vos boosters, combats gagnés, quêtes, échanges et conquêtes de l'île font monter le **niveau d'équipe** (10 niveaux, récompenses à chacun).\n🎯 Un **objectif commun** chaque semaine (booster Premium et poussière à la clé).\n💰 Un **coffre commun** et sa boutique (booster d'équipe, entraînement, nouveau nom).\n🎁 Offrez des cartes à votre coéquipier (5 par jour).\n🏝️ Quand l'un garde l'île, l'autre touche la moitié de ses gains."],
    ["iles", "L'île", "🏝️", "`/iles` : une île à conquérir. Quand elle est libre, placez **jusqu'à 3 cartes** dessus : elle vous rapporte **10 ✨ par heure**.\n⚔️ Pour la prendre à son gardien, battez sa défense : une **IA joue les cartes du gardien**. Mettez-les toutes K.O. et votre équipe devient la nouvelle défense (+50 ✨).\n🩹 Les dégâts restent d'un combat à l'autre (les cartes se soignent de 20 % par heure) et la défense s'use après 12 h de garde.\n⭐ L'île favorise la série Paris (+10 % en défense). Les cartes qui défendent ne peuvent être ni vendues ni échangées."],
    ["saisons", "Événements saisonniers", "🎃", "Pendant **Halloween** (20 oct. – 5 nov.) et **Noël** (1er déc. – 6 janv.), un booster en **édition limitée** est vendu : 4 cartes, dont au moins une des **7 cartes exclusives** de l'événement. Le booster disparaît à la fin de l'événement, mais les cartes restent pour toujours.\n⚔️ Chaque semaine, l'Arène a aussi sa **règle spéciale** : gagnez 3 combats pour remporter un booster Premium."],
    ["membres", "Cartes de membres", "👤", "Chaque membre de la Maison a **sa propre carte**, créée automatiquement : sa photo, ses PV et deux attaques. **Plus son rôle est haut, plus sa carte est forte** (de Résident Argent à Icône de la Maison). Les statistiques viennent de son activité, de son ancienneté, de sa fortune et de ses élections Membre Star."],
  ];
}
function guideTopicEmbed(key) {
  const t = cardsGuideTopics().find(([k]) => k === key) ?? cardsGuideTopics()[0];
  return new EmbedBuilder().setColor(0xe9c46a).setTitle(`${t[2]} ${t[1]}`).setDescription(t[3]).setFooter({ text: "Les Cartes de la Maison · /aide-cartes" });
}
function guidePayload(key = "debut") {
  return {
    ephemeral: true,
    embeds: [guideTopicEmbed(key)],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_aide")
          .setPlaceholder("Choisir un sujet…")
          .addOptions(cardsGuideTopics().map(([k, label, emoji]) => ({ label, value: k, emoji, default: k === key })))
      ),
    ],
  };
}

// --- Annonce du système (publiée une seule fois) ---
const CARDS_ANNOUNCE_TITLE = "🃏 Les Cartes de la Maison sont arrivées ! 🃏";
async function drawAnnouncePoster() {
  const W = 1200, H = 960, gold = METAL.legendaire, G = GENERATIONS[CURRENT_GEN];
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  velvet(ctx, W, H);
  ctx.save();
  ctx.translate(W / 2, 520);
  for (let i = 0; i < 40; i++) {
    ctx.rotate(TAU / 40);
    ctx.fillStyle = rgba(gold[0], i % 2 ? 0.02 : 0.06);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-50, -1000);
    ctx.lineTo(50, -1000);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "54px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 16;
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 96, 5);
  ctx.font = "28px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${G.name} — ${G.title} · disponible maintenant`, W / 2, 142);
  ctx.shadowBlur = 0;
  // les trois boosters
  for (const [i, type] of ["standard", "premium", "prestige"].entries()) {
    const w = 230, h = w * (920 / 600), cx = 300 + i * 300;
    glow(ctx, cx, 190 + h / 2, 200, PACKS[type].accent, 0.3);
    ctx.save();
    ctx.translate(cx, 180 + h / 2 + (i === 1 ? -14 : 10));
    ctx.rotate((i - 1) * 0.08);
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 26;
    ctx.drawImage(packFrame(await drawPackBase(CURRENT_GEN, type), type, 0.3 + i * 0.1), -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // éventail de cartes vedettes
  const stars = ["p_eiffel", "m_jackpot", "p_ame", "m_fondation", "p_versailles"].map(findCard).filter(Boolean);
  for (const [k, card] of stars.entries()) {
    const off = k - (stars.length - 1) / 2, w = off === 0 ? 150 : 128, h = w * 1.4;
    ctx.save();
    ctx.translate(W / 2 + off * 150, 640 + Math.abs(off) * 10);
    ctx.rotate(off * 0.09);
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 20;
    ctx.drawImage(await cardThumb(card, off === 0, Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  // bandeau des fonctionnalités
  const feats = [["COLLECTIONNER", "boosters · album"], ["ÉCHANGER", "marché · échanges"], ["COMBATTRE", "arène · saisons"], ["PROGRESSER", "quêtes · classement"]];
  feats.forEach(([title, sub], i) => {
    const x = 70 + i * 270, y = 822;
    roundRect(ctx, x, y, 250, 96, 16);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    ctx.strokeStyle = rgba(gold[0], 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = "22px CardEngrave";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(title, x + 125, y + 44);
    ctx.font = "17px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText(sub, x + 125, y + 74);
  });
  ctx.textAlign = "left";
  return c;
}
async function publishCardsAnnouncement() {
  const st = load();
  if (st.cardsAnnounced) return;
  const channel = await channelRef?.client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
  if (recent?.some((m) => m.author.id === channel.client.user.id && m.embeds[0]?.title === CARDS_ANNOUNCE_TITLE)) {
    st.cardsAnnounced = true;
    save();
    return;
  }
  const poster = new AttachmentBuilder(await (await drawAnnouncePoster()).encode("jpeg", 90), { name: "cartes.jpg" });
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle(CARDS_ANNOUNCE_TITLE)
    .setDescription(
      "♡ ••••• ♡\n\n*La Maison a désormais son propre jeu de cartes à collectionner : des cartes illustrées en 3D, animées, holographiques… et des combats en direct.*\n\n" +
        `🎁 **Chaque membre reçoit un pack de bienvenue** : 2 boosters Standard + 1 Premium, déjà dans votre inventaire !\n\n━━━━━━━━━━━━━━━━━━━━`
    )
    .addFields(
      { name: "🃏 Où jouer ?", value: `Dans ${channelRef} : boosters, booster gratuit du jour, cartes sauvages à attraper, carte de la semaine…` },
      {
        name: "⌨️ Les commandes",
        value:
          "`/inventaire` — vos boosters et vos statistiques\n`/album` — votre collection page par page\n`/quetes` — vos trois quêtes du jour\n`/marche` — acheter et vendre des cartes\n`/echange` — échanger avec un membre\n`/combat` — défier un membre ou la Maison\n`/arene` — classement de la saison\n`/aide-cartes` — le guide complet",
      },
      {
        name: "✨ Ce qui vous attend",
        value:
          "• Plus de 40 cartes à collectionner, en 6 raretés, dont des versions holo\n• **Votre propre carte de membre** : plus votre rôle est haut, plus elle est forte\n• Un **marché** dont les prix suivent la rareté réelle des cartes\n• L'**Arène** : choix secrets, animations, mises, paris et une **saison par mois** avec des cartes exclusives à gagner\n• Des **quêtes quotidiennes** et une **carte de la semaine**",
      }
    )
    .setImage("attachment://cartes.jpg")
    .setFooter({ text: "Collectionnez · Échangez · Combattez — bonne chance à tous 🦋" })
    .setTimestamp();
  const msg = await channel.send({ content: "@everyone", allowedMentions: { parse: ["everyone"] }, embeds: [embed], files: [poster] }).catch(() => null);
  if (msg) {
    st.cardsAnnounced = true;
    save();
    console.log("Annonce des cartes publiée");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
