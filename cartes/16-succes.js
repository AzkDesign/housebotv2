
// --- Succès, titres, vitrine et classements en direct ---
// statistiques de jeu de chaque membre (boosters, combats, ventes…)
function ustat(userId, key, n = 1) {
  if (!userId) return;
  const s = (load().userStats[userId] ??= {});
  s[key] = (s[key] ?? 0) + n;
  if (key === "streak") s.bestStreak = Math.max(s.bestStreak ?? 0, s.streak);
}
function resetStreak(userId) {
  const s = (load().userStats[userId] ??= {});
  s.streak = 0;
}
function playerFacts(userId) {
  const inv = load().inv[userId] ?? {}, s = load().userStats[userId] ?? {}, owned = ownedIds(userId);
  const holos = Object.entries(inv).filter(([k, n]) => k.endsWith("*") && n > 0).length;
  const has = (pred) => [...owned].some((id) => pred(findCard(id)));
  return {
    packs: s.packs ?? 0,
    unique: owned.size,
    holos,
    shiny: has((c) => c?.shiny) ? 1 : 0,
    myth: has((c) => c?.rarity === "mythique") ? 1 : 0,
    wins: s.wins ?? 0,
    bestStreak: s.bestStreak ?? 0,
    sales: s.sales ?? 0,
    trades: s.trades ?? 0,
    wild: s.wild ?? 0,
    quests: s.quests ?? 0,
    paris: load().rewards[userId]?.paris ? 1 : 0,
    maison: load().rewards[userId]?.maison ? 1 : 0,
    champion: owned.has("ev_champion") ? 1 : 0,
  };
}
// [id, émoji, titre, description, statistique, objectif, poussière offerte]
const ACHIEVEMENTS = [
  ["booster1", "📦", "Premier booster", "Ouvrir un booster", "packs", 1, 30],
  ["booster50", "🎁", "Accro aux boosters", "Ouvrir 50 boosters", "packs", 50, 200],
  ["collec25", "📒", "Collectionneur", "Posséder 25 cartes différentes", "unique", 25, 100],
  ["collec50", "📚", "Encyclopédiste", "Posséder 50 cartes différentes", "unique", 50, 300],
  ["paris", "🗼", "Parisien", "Compléter la série Paris", "paris", 1, 200],
  ["maison", "🏡", "Pilier de la Maison", "Compléter la série La Maison", "maison", 1, 200],
  ["holo1", "✦", "Éclat holographique", "Obtenir une carte holo", "holos", 1, 50],
  ["holo10", "🌈", "Galerie holographique", "Posséder 10 cartes holo différentes", "holos", 10, 250],
  ["shiny", "🍀", "Chasseur de Shiny", "Obtenir une carte Shiny", "shiny", 1, 300],
  ["mythique", "🔴", "Mythe vivant", "Obtenir une carte mythique", "myth", 1, 200],
  ["win1", "⚔️", "Premier sang", "Gagner un combat", "wins", 1, 30],
  ["win25", "🏟️", "Gladiateur", "Gagner 25 combats", "wins", 25, 250],
  ["streak5", "🔥", "Invaincu", "Gagner 5 combats d'affilée", "bestStreak", 5, 250],
  ["sales10", "🏪", "Marchand", "Vendre 10 cartes au marché", "sales", 10, 150],
  ["trades10", "🤝", "Négociateur", "Conclure 10 échanges", "trades", 10, 150],
  ["wild10", "✋", "Attrape-tout", "Attraper 10 cartes sauvages", "wild", 10, 150],
  ["quests30", "🎯", "Assidu", "Accomplir 30 quêtes", "quests", 30, 200],
  ["champion", "🏆", "Légende de l'Arène", "Finir premier d'une saison d'Arène", "champion", 1, 500],
];
const achOf = (userId) => (load().achievements[userId] ??= { unlocked: {}, title: null });
function achievementTitle(userId) {
  const a = load().achievements[userId];
  const def = a?.title && ACHIEVEMENTS.find(([id]) => id === a.title);
  return def ? `${def[1]} ${def[2]}` : null;
}
// vérifie et débloque les nouveaux succès (récompense, titre et annonce)
async function checkAchievements(userId) {
  if (!userId) return;
  const a = achOf(userId), facts = playerFacts(userId), fresh = [];
  for (const [id, emoji, name, , key, goal, dust] of ACHIEVEMENTS) {
    if (a.unlocked[id] || facts[key] < goal) continue;
    a.unlocked[id] = Date.now();
    load().dust[userId] = (load().dust[userId] ?? 0) + dust;
    fresh.push(`${emoji} **${name}** (+${dust} ✨)`);
    if (!a.title) a.title = id;
  }
  if (!fresh.length) return;
  save();
  const msg = await chan("annonces")
    ?.send({ content: `🏅 <@${userId}> débloque ${fresh.length > 1 ? "les succès" : "le succès"} ${fresh.join(", ")} !`, allowedMentions: { users: [userId] } })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}
function achievementsPayload(userId) {
  const a = achOf(userId), facts = playerFacts(userId);
  const lines = ACHIEVEMENTS.map(([id, emoji, name, desc, key, goal, dust]) => {
    const done = Boolean(a.unlocked[id]), p = Math.min(goal, facts[key]);
    const bar = "▰".repeat(Math.round((p / goal) * 8)) + "▱".repeat(8 - Math.round((p / goal) * 8));
    return `${done ? emoji : "🔒"} **${name}** — ${desc}${done ? " ✅" : `\n${bar} ${p}/${goal} · ${dust} ✨`}`;
  });
  const unlocked = ACHIEVEMENTS.filter(([id]) => a.unlocked[id]);
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle(`🏅 Vos succès — ${unlocked.length} / ${ACHIEVEMENTS.length}`)
        .setDescription(lines.join("\n").slice(0, 4000))
        .setFooter({ text: `Titre affiché sur votre profil : ${achievementTitle(userId) ?? "aucun"} · chaque succès rapporte de la poussière d'étoile` }),
    ],
    components: unlocked.length
      ? [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("carte_succ_titre")
              .setPlaceholder("Choisir le titre affiché sur mon profil…")
              .addOptions(unlocked.slice(0, 25).map(([id, emoji, name]) => ({ label: name, value: id, emoji, default: a.title === id })))
          ),
        ]
      : [],
  };
}

// --- Vitrine : les trois plus belles cartes d'un membre ---
async function drawShowcase(user, keys) {
  const W = 1200, H = 640, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  velvet(ctx, W, H);
  ctx.textAlign = "center";
  ctx.font = "30px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  spaced(ctx, `VITRINE DE ${(user.displayName ?? user.username).toUpperCase()}`.slice(0, 40), W / 2, 62, 4);
  ctx.shadowBlur = 0;
  const title = achievementTitle(user.id);
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(title ? `${title.replace(/^\S+ /, "")} · ${ownedIds(user.id).size} cartes` : `${ownedIds(user.id).size} cartes dans la collection`, W / 2, 96);
  const cards = keys.map((k) => ({ card: cardOfKey(k), holo: isHoloKey(k) })).filter((x) => x.card);
  for (const [i, { card, holo }] of cards.entries()) {
    const off = cards.length === 1 ? 0 : i - (cards.length - 1) / 2, w = off === 0 ? 300 : 260, h = w * 1.4;
    const x = W / 2 + off * 340, y = 380 + Math.abs(off) * 14;
    glow(ctx, x, y, w, METAL[card.rarity][4], 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(off * 0.05);
    ctx.shadowColor = "rgba(0,0,0,0.75)";
    ctx.shadowBlur = 28;
    ctx.drawImage(await cardThumb(card, holo, Math.round(w), Math.round(h)), -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  if (!cards.length) {
    ctx.font = "26px CardItalic";
    ctx.fillStyle = "#cbb9a9";
    ctx.fillText("Aucune carte dans la vitrine pour le moment.", W / 2, 360);
  }
  ctx.textAlign = "left";
  void gold;
  return c;
}
async function showcasePayload(user, own) {
  const keys = (load().showcase[user.id] ?? []).filter((k) => (load().inv[user.id]?.[k] ?? 0) > 0);
  const file = new AttachmentBuilder(await (await drawShowcase(user, keys)).encode("jpeg", 92), { name: "vitrine.jpg" });
  const rows = [];
  if (own) {
    const options = ownedKeys(user.id)
      .slice(0, 25)
      .map(([k]) => ({ label: keyLabel(k).slice(0, 100), value: k, emoji: RARITIES[cardOfKey(k).rarity].emoji, default: keys.includes(k) }));
    if (options.length)
      rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_vit_set").setPlaceholder("Choisir jusqu'à 3 cartes à exposer…").setMinValues(1).setMaxValues(Math.min(3, options.length)).addOptions(options)));
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_vit_show").setLabel("Montrer dans la discussion").setEmoji("📣").setStyle(ButtonStyle.Secondary).setDisabled(!keys.length)));
  }
  return {
    embeds: [new EmbedBuilder().setColor(0xe9c46a).setTitle(`🖼️ Vitrine de ${user.displayName ?? user.username}`).setImage("attachment://vitrine.jpg").setFooter({ text: own ? "Vos trois cartes préférées, affichées aussi sur votre /profil" : "Les trois cartes préférées de ce membre" })],
    files: [file],
    components: rows,
  };
}

// --- Classements en direct dans leur salon ---
async function refreshLeaderboards() {
  const ch = chan("classements");
  if (!ch || ch === channelRef) return;
  const st = load();
  const users = Object.keys(st.inv);
  const top = (score, n, fmt) =>
    users
      .map((id) => [id, score(id)])
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([id, v], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} **${pseudo(id)}** — ${fmt(v)}`)
      .join("\n") || "*Personne pour le moment.*";
  const holoCount = (id) => Object.entries(st.inv[id] ?? {}).filter(([k, n]) => k.endsWith("*") && n > 0).length;
  const shinyCount = (id) => Object.values(SHINIES).filter((c) => (st.inv[id]?.[c.id] ?? 0) + (st.inv[id]?.[`${c.id}*`] ?? 0) > 0).length;
  const arena = Object.entries(st.arena)
    .filter(([, x]) => x.w + x.l + x.d > 0)
    .sort((a, b) => b[1].elo - a[1].elo)
    .slice(0, 5)
    .map(([id, x], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} **${pseudo(id)}** — **${x.elo}** · ${tierOf(x.elo)[1]} · ${x.w} V`)
    .join("\n") || "*Aucun combat cette saison.*";
  const embed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setTitle("🏆 Classements des Cartes de la Maison")
    .addFields(
      { name: "📒 Collection (score)", value: top(collectionScore, 10, (v) => `**${v}** pts`), inline: false },
      { name: "✦ Holographiques", value: top(holoCount, 5, (v) => `**${v}** holo${v > 1 ? "s" : ""}`), inline: true },
      { name: "🍀 Chasseurs de Shiny", value: top(shinyCount, 5, (v) => `**${v}** shiny`), inline: true },
      { name: `⚔️ Arène — saison ${st.arenaSeason?.n ?? 1}`, value: arena, inline: false },
      { name: "🛡️ Équipes", value: Object.values(teamsState()).sort((a, b) => b.xp - a.xp).slice(0, 5).map((t, i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} ${t.emblem} **${t.name}** — niveau ${teamLevel(t)} · ${t.members.map((m) => `**${pseudo(m)}**`).join(" & ")}`).join("\n") || "*Aucune équipe.*", inline: false },
      { name: "🏝️ Gardien de l'île", value: islandsState().lagon.holder ? `**${pseudo(islandsState().lagon.holder)}** depuis ${fmtHeld(Date.now() - islandsState().lagon.since)}` : "*L'île est libre !*", inline: true },
      { name: "🏅 Succès", value: top((id) => Object.keys(st.achievements[id]?.unlocked ?? {}).length, 5, (v) => `**${v}** / ${ACHIEVEMENTS.length}`), inline: true }
    )
    .setFooter({ text: "Mis à jour automatiquement toutes les 10 minutes" });
  const hash = JSON.stringify(embed.toJSON().fields);
  if (st.boardHash === hash && st.boardMessageId) return;
  let msg = st.boardMessageId ? await ch.messages.fetch(st.boardMessageId).catch(() => null) : null;
  embed.setTimestamp();
  if (msg) await msg.edit({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
  else {
    msg = await ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
    if (msg) st.boardMessageId = msg.id;
  }
  st.boardHash = hash;
  save();
}
