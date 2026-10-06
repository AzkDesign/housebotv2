async function openBooster(interaction, client, pulls, title, pack = null) {
  await interaction.deferReply({ ephemeral: true });
  const userId = interaction.user.id;
  const scoreBefore = collectionScore(userId);
  const results = pulls.map((p) => ({ ...p, isNew: give(userId, p.card, p.holo) }));
  questProgress(userId, "open_pack");
  bump("packsOpened");
  ustat(userId, "packs");
  for (const p of results) if (p.card.shiny) ustat(userId, "shiny");
  const gained = collectionScore(userId) - scoreBefore;
  const n = results.length, best = results[n - 1];
  // Les animations se préparent à la suite, pendant qu'on regarde les précédentes
  const jobs = [];
  let chain = Promise.resolve();
  for (const [i, p] of results.entries()) {
    chain = chain.then(() => revealGif(p, i, n)).catch(() => null);
    jobs.push(chain);
  }
  const bestJob = chain.then(() => (isAnimated(best.card, best.holo) ? cardFile(best.card, best.holo) : null)).catch(() => null);
  const spreadJob = bestJob.then(() => drawSpread(results, title, gained)).catch(() => null);

  if (pack) {
    const intro = new AttachmentBuilder(await packOpenGif(pack.gen, pack.type), { name: "ouverture.gif" });
    await interaction
      .editReply({ embeds: [new EmbedBuilder().setColor(parseInt(PACKS[pack.type].accent.slice(1), 16)).setTitle(`${title} — ouverture…`).setImage("attachment://ouverture.gif")], files: [intro] })
      .catch(() => null);
    await sleep(2900);
  }
  // Révélation carte par carte, de la plus faible à la meilleure
  for (const [i, p] of results.entries()) {
    const r = RARITIES[p.card.rarity];
    const buffer = await jobs[i];
    const file = buffer ? new AttachmentBuilder(buffer, { name: `revelation-${i + 1}.gif` }) : await cardFile(p.card, p.holo);
    await interaction
      .editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(parseInt(r.color.slice(1), 16))
            .setTitle(`${title} — carte ${i + 1}/${n}${i === n - 1 && n > 1 ? " · la meilleure !" : ""}`)
            .setDescription(`${r.emoji} **${p.card.name}** — ${r.name}${p.holo ? " ✦ **HOLO**" : ""}${p.isNew ? "  🆕 **Nouvelle !**" : ""}`)
            .setImage(`attachment://${file.name}`),
        ],
        files: [file],
      })
      .catch(() => null);
    await sleep(revealDuration(p.card));
  }
  // Récapitulatif en éventail, puis la meilleure carte animée
  const spread = await spreadJob;
  const bestFile = await bestJob;
  const lines = results
    .slice()
    .reverse()
    .map((p) => `${RARITIES[p.card.rarity].emoji} **${p.card.name}** — ${RARITIES[p.card.rarity].name}${p.holo ? " ✦ HOLO" : ""}${p.isNew ? " 🆕" : ""}`);
  const embeds = [
    new EmbedBuilder()
      .setColor(parseInt(RARITIES[best.card.rarity].color.slice(1), 16))
      .setTitle(`${title} — récapitulatif`)
      .setDescription(`${lines.join("\n")}\n\n⭐ **+${gained}** point${gained > 1 ? "s" : ""} de collection`)
      .setImage(spread ? "attachment://recapitulatif.jpg" : "attachment://booster.png"),
  ];
  const files = [spread ? new AttachmentBuilder(await spread.encode("jpeg", 92), { name: "recapitulatif.jpg" }) : await collageFile(results)];
  if (bestFile) {
    embeds.push(
      new EmbedBuilder()
        .setColor(parseInt(RARITIES[best.card.rarity].color.slice(1), 16))
        .setTitle(`⭐ Meilleure carte : ${best.card.name}`)
        .setDescription(`${RARITIES[best.card.rarity].emoji} ${RARITIES[best.card.rarity].name}${best.holo ? " ✦ holographique" : ""}`)
        .setImage(`attachment://${bestFile.name}`)
    );
    files.push(bestFile);
  }
  const key = pack ? packKey(pack.gen, pack.type) : null;
  const left = key ? load().packs[userId]?.[key] ?? 0 : 0;
  const row = new ActionRowBuilder();
  if (left) row.addComponents(new ButtonBuilder().setCustomId(`carte_open_${key}`).setLabel(`Ouvrir un autre (${left} en réserve)`).setEmoji("✂️").setStyle(ButtonStyle.Success));
  row.addComponents(
    new ButtonBuilder().setCustomId("carte_inv").setLabel("Inventaire").setEmoji("🎒").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("carte_album").setLabel("Album").setEmoji("📒").setStyle(ButtonStyle.Secondary)
  );
  await interaction.editReply({ embeds, files, components: [row] }).catch(() => null);
  // Grosses cartes : annonce publique
  for (const p of results) {
    if (p.card.shiny || ORDER.indexOf(p.card.rarity) >= ORDER.indexOf("epique")) await announcePull(client, interaction.user, p);
  }
  await checkSeriesRewards(client, userId);
}

async function announcePull(client, user, p) {
  if (!chan("annonces")) return;
  const r = RARITIES[p.card.rarity];
  const file = await cardFile(p.card, p.holo);
  const msg = await chan("annonces")
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setDescription(`${r.emoji} ${user} vient d'obtenir **${p.card.name}** (${r.name}${p.holo ? " ✦ HOLO" : ""}) !`)
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}

// --- Album et récompenses ---
function ownedIds(userId) {
  return new Set(Object.keys(load().inv[userId] ?? {}).filter((k) => load().inv[userId][k] > 0).map((k) => k.replace("*", "")));
}

function collectionScore(userId) {
  const inv = load().inv[userId] ?? {};
  let score = 0;
  for (const id of ownedIds(userId)) {
    const card = findCard(id);
    if (!card) continue;
    score += RARITIES[card.rarity].points * (inv[`${id}*`] ? 2 : 1);
  }
  return score;
}

async function checkSeriesRewards(client, userId) {
  const s = load();
  const owned = ownedIds(userId);
  for (const [key, series] of Object.entries(SERIES)) {
    if (s.rewards[userId]?.[key]) continue;
    if (!series.cards.every((c) => owned.has(c.id))) continue;
    s.rewards[userId] = { ...(s.rewards[userId] ?? {}), [key]: Date.now() };
    s.dust[userId] = (s.dust[userId] ?? 0) + 500;
    save();
    changeBalance(userId, series.reward, `Série de cartes complète : ${series.name}`);
    const guild = channelRef?.guild;
    if (guild) {
      const role = await findOrCreateRole(guild, { name: `🃏 Collectionneur ${series.name}`, color: 0xe9c46a, hoist: false }).catch(() => null);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (role && member) await member.roles.add(role).catch(() => null);
    }
    await chan("annonces")
      ?.send({ content: `🏆 <@${userId}> a complété la série **${series.emoji} ${series.name}** ! Récompense : **${formatEuro(series.reward)}**, **500 ✨** et le rôle Collectionneur ${series.name}.`, allowedMentions: { users: [userId] } })
      .then((m) => deleteLater(m, MINUTE))
      .catch(() => null);
  }
  await checkAchievements(userId);
}

// --- Poussière d'étoile ---
function recycleDuplicates(userId) {
  const s = load();
  const inv = s.inv[userId] ?? {};
  let dust = 0;
  let count = 0;
  for (const [key, n] of Object.entries(inv)) {
    const card = findCard(key.replace("*", ""));
    if (!card || n <= 1) continue;
    const extra = n - 1;
    dust += extra * RARITIES[card.rarity].dust * (key.endsWith("*") ? 3 : 1);
    count += extra;
    inv[key] = 1;
  }
  s.dust[userId] = (s.dust[userId] ?? 0) + dust;
  save();
  return { dust, count };
}

function craftCost(card) {
  return RARITIES[card.rarity].dust * CRAFT_FACTOR;
}

// --- Cartes sauvages ---
const WILD_WEIGHTS = { commune: 40, peucommune: 30, rare: 18, epique: 9, legendaire: 2.7, mythique: 0.3 };
let nextWildAt = Date.now() + (30 + Math.random() * 60) * MINUTE;

async function spawnWild(client) {
  if (!chan("sauvages")) return;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (hour < 9 || hour >= 23) return;
  const { card, holo } = drawOne(null, WILD_WEIGHTS);
  const r = RARITIES[card.rarity];
  const id = String(Date.now());
  const file = await cardFile(card, holo);
  const msg = await chan("sauvages")
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(parseInt(r.color.slice(1), 16))
          .setTitle("✨ Une carte sauvage est apparue !")
          .setDescription(`${r.emoji} **${card.name}** — ${r.name}${holo ? " ✦ HOLO" : ""}\nLe premier qui clique l'attrape !`)
          .setImage(`attachment://${file.name}`),
      ],
      files: [file],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_wild_${id}`).setLabel("Attraper !").setEmoji("✋").setStyle(ButtonStyle.Success))],
    })
    .catch(() => null);
  if (!msg) return;
  load().wild = { id, cardId: card.id, holo, messageId: msg.id, at: Date.now() };
  save();
  // Personne ne l'a attrapée : elle s'envole
  setTimeout(async () => {
    const w = load().wild;
    if (w?.id !== id) return;
    load().wild = null;
    save();
    await msg.edit({ embeds: [EmbedBuilder.from(msg.embeds[0]).setTitle("💨 La carte s'est envolée…").setDescription("Personne ne l'a attrapée à temps.")], components: [] }).catch(() => null);
    deleteLater(msg, MINUTE);
  }, 15 * MINUTE);
}

// --- Panneau ---
let channelRef = null;

function leaderboard() {
  return Object.keys(load().inv)
    .map((id) => [id, collectionScore(id)])
    .filter(([, sc]) => sc > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, sc], i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} **${pseudo(id)}** — ${sc} pts`)
    .join("\n");
}

async function panelMessage() {
  const soldes = lawActive("soldesBoosters") ? ` *(soldes −${lawParam("soldesBoosters")} %)*` : "";
  const daily = lawActive("boosterDouble") ? "2 cartes" : "1 carte";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle(PANEL_TITLE)
        .setDescription(
          `**${GENERATIONS[CURRENT_GEN].name} — ${GENERATIONS[CURRENT_GEN].title}**\nCollectionnez les cartes de Paris, de la Maison, des entreprises et des membres !\n\n` +
            `📦 **Standard** — 5 cartes · **${formatEuro(boosterPrice("standard"))}**${soldes}${stockShort("standard")}\n` +
            `💎 **Premium** — 5 cartes dont une **rare** garantie · **${formatEuro(boosterPrice("premium"))}**${soldes}${stockShort("premium")}\n` +
            `👑 **Prestige** — 3 cartes dont une **épique** garantie · **${formatEuro(boosterPrice("prestige"))}**${soldes}${stockShort("prestige")}\n` +
            `🎁 **Booster gratuit** — ${daily} chaque jour\n\n` +
            "🎒 Les boosters achetés vont dans votre **inventaire** (`/inventaire`) : ouvrez-les tout de suite ou gardez-les. Seuls les boosters de la génération en cours sont vendus.\n" +
            "🏪 **Marché** (`/marche`) : achetez et vendez des cartes entre membres · 🔄 **Échanges** (`/echange`) : proposez cartes et argent contre cartes.\n" +
            "⚔️ **Arène** (`/combat`) : combats de cartes en direct, avec mises, paris et classement.\n" +
            "🎯 **Quêtes du jour** (`/quetes`) · ❔ **Guide complet** (`/aide-cartes`)\n" +
            (activeSeason() ? `${PACKS[SEASONAL[activeSeason()].pack].emoji} **${SEASONAL[activeSeason()].name} — ${SEASONAL[activeSeason()].title}** : booster **${PACKS[SEASONAL[activeSeason()].pack].name}** en édition limitée (${SEASONAL[activeSeason()].dates}) · **${formatEuro(boosterPrice(SEASONAL[activeSeason()].pack))}**\n` : "") +
            (load().genLaunchAt && GENERATIONS[CURRENT_GEN + 1] ? `🌍 **${GENERATIONS[CURRENT_GEN + 1].name} — ${GENERATIONS[CURRENT_GEN + 1].title}** arrive <t:${Math.floor(load().genLaunchAt / 1000)}:R> !\n` : "") +
            `⚔️ **Défi de la semaine** : ${weeklyRule()[1]} — ${weeklyRule()[2]}\n` +
            "🏅 **Succès** (`/succes`) · 🖼️ **Vitrine** (`/vitrine`) · 🏆 classements en direct\n" +
            `📖 ${chan("histoire")} · 🏰 ${chan("clash")} · 🏝️ ${chan("iles")} · 🛡️ ${chan("equipes")} · 🏆 ${chan("tournoi")} · 🎟️ ${chan("pass")} — le Mode Histoire, le Clash, l'île, les équipes, le tournoi et le pass de combat ont leur propre salon\n` +
            (weeklyCard() ? `🌟 **Carte de la semaine** : ${weeklyCard().name} — trois fois plus fréquente dans les boosters !\n` : "") +
            "**Raretés** : ⚪ Commune · 🟢 Peu commune · 🔵 Rare · 🟣 Épique · 🟡 Légendaire · 🔴 Mythique · ✦ Holo (5 %)\n" +
            `✨ Des **cartes sauvages** apparaissent dans ${chan("sauvages")} de temps en temps : soyez le premier à les attraper !\n` +
            "♻️ Recyclez vos doublons en **poussière d'étoile** pour fabriquer la carte de votre choix."
        )
        .addFields({ name: "🏆 Meilleurs collectionneurs", value: leaderboard() || "*Personne pour le moment.*" })
        .setImage("attachment://vitrine.jpg")
        .setTimestamp(),
    ],
    files: [await vitrineFile()],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_booster_standard").setLabel("Standard").setEmoji("📦").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_premium").setLabel("Premium").setEmoji("💎").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_booster_prestige").setLabel("Prestige").setEmoji("👑").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("carte_daily").setLabel("Booster gratuit").setEmoji("🎁").setStyle(ButtonStyle.Success),
        ...(activeSeason() ? [new ButtonBuilder().setCustomId(`carte_booster_${SEASONAL[activeSeason()].pack}`).setLabel(PACKS[SEASONAL[activeSeason()].pack].name).setEmoji(PACKS[SEASONAL[activeSeason()].pack].emoji).setStyle(ButtonStyle.Danger)] : [])
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_inv").setLabel("Inventaire").setEmoji("🎒").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_album").setLabel("Mon album").setEmoji("📒").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_dust").setLabel("Poussière d'étoile").setEmoji("✨").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_member").setLabel("Ma carte de membre").setEmoji("👤").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_cx").setLabel("Codex").setEmoji("📖").setStyle(ButtonStyle.Success)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_mk").setLabel("Marché").setEmoji("🏪").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_tr").setLabel("Échanger").setEmoji("🔄").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_bt").setLabel("Arène").setEmoji("⚔️").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("carte_qt").setLabel("Quêtes").setEmoji("🎯").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_aide_open").setLabel("Guide").setEmoji("❔").setStyle(ButtonStyle.Secondary)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_succ").setLabel("Succès").setEmoji("🏅").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_vit").setLabel("Ma vitrine").setEmoji("🖼️").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}

let panelDirty = false;
async function refreshPanel(client) {
  if (!channelRef) return;
  const s = load();
  let msg = s.panelMessageId ? await channelRef.messages.fetch(s.panelMessageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channelRef.messages.fetch({ limit: 25 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  const payload = await panelMessage();
  if (msg) await msg.edit(payload).catch(() => null);
  else msg = await channelRef.send(payload).catch(() => null);
  if (msg && s.panelMessageId !== msg.id) {
    s.panelMessageId = msg.id;
    save();
  }
}

