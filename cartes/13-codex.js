
// --- Codex : toute la collection d'un coup d'œil, pour repérer les cartes manquantes ---
// Chaque carte a sa case numérotée : possédée (en couleur) ou manquante (en silhouette), avec la façon de l'obtenir.
const CODEX_PER_PAGE = 24;
const CODEX_FILTERS = { manquantes: ["Cartes manquantes", "🔍"], possedees: ["Cartes possédées", "✅"], toutes: ["Toutes les cartes", "📚"] };
const EVENT_HOW = {
  ev_star: "Être élu(e) Membre Star",
  ev_maire: "Être élu(e) maire",
  ev_jackpot: "Gagner le jackpot du casino",
  ev_champion: "Finir 1er d'une saison d'Arène",
  ev_podium: "Finir sur le podium d'une saison",
};
const craftableGroups = () => albumGroups().filter((g) => g !== "evenements" && g !== "saisons" && g !== "histoire");
// comment obtenir une carte : [icône, texte court, couleur]
function howToGet(card) {
  if (card.shiny) return ["🍀", "Shiny · 1 chance sur 250", "#34d399"];
  if (EVENT_HOW[card.id]) return ["🎖️", EVENT_HOW[card.id], "#fbbf24"];
  const season = seasonOfCard(card);
  if (season && !load().market.some((l) => l.key.replace("*", "") === card.id)) return [PACKS[SEASONAL[season].pack].emoji, `Booster ${PACKS[SEASONAL[season].pack].name} · ${SEASONAL[season].dates}`, "#fb923c"];
  const listings = load().market.filter((l) => l.key.replace("*", "") === card.id);
  if (listings.length) return ["🏪", `Au marché dès ${euro(Math.min(...listings.map((l) => l.price)))}`, "#4ade80"];
  const craft = craftableGroups().includes(seriesOf(card)) ? ` · ${craftCost(card)} ✨` : "";
  return ["📦", `Boosters ${GENERATIONS[card.gen ?? 1]?.code ?? "G1"}${craft}`, "#cbb9a9"];
}
const codexViews = new Map();
function codexView(userId) {
  if (!codexViews.has(userId)) codexViews.set(userId, { filter: "manquantes", series: "all", rarity: "all", page: 0 });
  return codexViews.get(userId);
}
function codexEntries(userId, view) {
  const owned = collectedIds(userId);
  const order = albumGroups();
  return collectionCards()
    .filter((c) => (view.series === "all" || seriesOf(c) === view.series) && (view.rarity === "all" || c.rarity === view.rarity))
    .filter((c) => (view.filter === "manquantes" ? !owned.has(c.id) : view.filter === "possedees" ? owned.has(c.id) : true))
    .sort((a, b) => order.indexOf(seriesOf(a)) - order.indexOf(seriesOf(b)) || numberOf(a).localeCompare(numberOf(b)));
}

async function drawCodex(user, view) {
  const userId = user.id, owned = collectedIds(userId), inv = load().inv[userId] ?? {};
  const list = codexEntries(userId, view), pages = Math.max(1, Math.ceil(list.length / CODEX_PER_PAGE));
  view.page = Math.min(Math.max(0, view.page), pages - 1);
  const slice = list.slice(view.page * CODEX_PER_PAGE, (view.page + 1) * CODEX_PER_PAGE);
  const W = 1200, H = 1260, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  velvet(ctx, W, H);

  // En-tête : titre, progression totale et par rareté
  const all = collectionCards(), have = all.filter((card) => owned.has(card.id)).length;
  ctx.font = "34px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillText("CODEX DE LA MAISON", 48, 76);
  ctx.shadowBlur = 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`${user.displayName ?? user.username} · ${have} / ${all.length} cartes · ${all.length - have} à trouver`, 50, 108);
  progressRing(ctx, W - 98, 82, 46, all.length ? have / all.length : 0, [gold[3], gold[0]]);
  ctx.textAlign = "center";
  ctx.font = "24px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${Math.round((have / Math.max(1, all.length)) * 100)} %`, W - 98, 90);
  // pastilles par rareté
  let px = 48;
  ctx.textAlign = "left";
  for (const r of ORDER) {
    const tot = all.filter((card) => card.rarity === r).length;
    if (!tot) continue;
    const got = all.filter((card) => card.rarity === r && owned.has(card.id)).length;
    const label = `${got}/${tot}`;
    ctx.font = "14px CardBold";
    const w = ctx.measureText(label).width + 42;
    roundRect(ctx, px, 128, w, 30, 15);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.strokeStyle = rgba(METAL[r][1], 0.9);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    rarityIcon(ctx, r, px + 16, 143, 6, METAL[r][0]);
    ctx.fillStyle = got === tot ? "#fde68a" : "#ffffff";
    ctx.fillText(label, px + 30, 148);
    px += w + 8;
  }
  ctx.textAlign = "right";
  ctx.font = "15px CardText";
  ctx.fillStyle = "#cbb9a9";
  const filterLabel = `${CODEX_FILTERS[view.filter][0]}${view.series !== "all" ? ` · ${SERIES_LABELS[view.series].replace(/^\S+ /, "")}` : ""}${view.rarity !== "all" ? ` · ${RARITIES[view.rarity].name}` : ""}`;
  ctx.fillText(`${filterLabel} · ${list.length} · page ${view.page + 1}/${pages}`, W - 48, 150);
  ctx.textAlign = "left";

  // Grille : 6 × 4 cases
  const tw = 180, th = 250, gap = 14, x0 = (W - (6 * tw + 5 * gap)) / 2, y0 = 180;
  for (let i = 0; i < CODEX_PER_PAGE; i++) {
    const card = slice[i], x = x0 + (i % 6) * (tw + gap), y = y0 + Math.floor(i / 6) * (th + gap);
    roundRect(ctx, x, y, tw, th, 14);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fill();
    if (!card) continue;
    const m = METAL[card.rarity], got = owned.has(card.id), cw = 128, ch = 179, cx = x + (tw - cw) / 2, cy = y + 10;
    ctx.strokeStyle = got ? rgba(m[1], 0.9) : "rgba(255,255,255,0.08)";
    ctx.lineWidth = got ? 2 : 1;
    roundRect(ctx, x, y, tw, th, 14);
    ctx.stroke();
    if (got) {
      const holo = Boolean(inv[`${card.id}*`]), n = (inv[card.id] ?? 0) + (inv[`${card.id}*`] ?? 0);
      glow(ctx, x + tw / 2, cy + ch / 2, 100, m[4], 0.18);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 10;
      ctx.drawImage(await cardThumb(card, holo, cw, ch), cx, cy, cw, ch);
      ctx.restore();
      if (n > 1) {
        disc(ctx, cx + cw - 6, cy + ch - 6, 14, metalGradient(ctx, W, H, gold));
        ctx.font = "11px CardBold";
        ctx.fillStyle = "#2a1305";
        ctx.textAlign = "center";
        ctx.fillText(`×${n}`, cx + cw - 6, cy + ch - 2);
        ctx.textAlign = "left";
      }
    } else {
      roundRect(ctx, cx, cy, cw, ch, 10);
      ctx.fillStyle = "#140b0c";
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = rgba(m[1], 0.55);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      glow(ctx, cx + cw / 2, cy + ch / 2, 70, m[4], 0.1);
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(await silhouette(card, 104), cx + cw / 2 - 52, cy + 30, 104, 104);
      ctx.restore();
      ctx.textAlign = "center";
      ctx.font = "22px CardTitle";
      ctx.fillStyle = "#4a3a34";
      ctx.fillText("?", cx + cw / 2, cy + ch - 18);
      ctx.textAlign = "left";
    }
    // numéro, nom, rareté et moyen d'obtention
    ctx.textAlign = "center";
    ctx.font = "11px CardEngrave";
    ctx.fillStyle = "#a08a7a";
    ctx.fillText(`${numberOf(card)} · ${SERIES_LABELS[seriesOf(card)].replace(/^\S+ /, "")}`.slice(0, 30), x + tw / 2, y + 205);
    ctx.font = `${fitText(ctx, card.name, tw - 16, 14, "CardBold")}px CardBold`;
    ctx.fillStyle = got ? "#ffffff" : "#d6c7bd";
    ctx.fillText(card.name, x + tw / 2, y + 223);
    if (got) {
      rarityIcon(ctx, card.rarity, x + tw / 2 - 30, y + 238, 5, m[0]);
      ctx.font = "11px CardBold";
      ctx.fillStyle = m[0];
      ctx.fillText(RARITIES[card.rarity].name, x + tw / 2 + 8, y + 242);
    } else {
      const [, rawHow, color] = howToGet(card);
      const how = rawHow.replace("✨", "poussière"); // la police des cartes n'a pas l'émoji
      ctx.font = `${fitText(ctx, how, tw - 14, 11, "CardBold")}px CardBold`;
      ctx.fillStyle = color;
      ctx.fillText(how, x + tw / 2, y + 242);
    }
    ctx.textAlign = "left";
  }
  if (!slice.length) {
    ctx.textAlign = "center";
    ctx.font = "28px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText(view.filter === "manquantes" ? "Bravo, il ne vous manque aucune carte ici !" : "Aucune carte ici pour le moment.", W / 2, 640);
    ctx.textAlign = "left";
  }
  // pied : pages
  ctx.textAlign = "center";
  for (let p = 0; p < pages; p++) {
    diamond(ctx, W / 2 + (p - (pages - 1) / 2) * 20, H - 40, 5);
    if (p === view.page) {
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.textAlign = "left";
  return { canvas: c, slice, pages, list };
}

async function codexPayload(user) {
  const view = codexView(user.id);
  const { canvas, slice, pages, list } = await drawCodex(user, view);
  const file = new AttachmentBuilder(await canvas.encode("jpeg", 90), { name: "codex.jpg" });
  const owned = collectedIds(user.id);
  const missing = slice.filter((card) => !owned.has(card.id));
  const lines = missing.slice(0, 24).map((card) => {
    const [icon, how] = howToGet(card);
    return `${RARITIES[card.rarity].emoji} **${card.name}** · ${icon} ${how}`;
  });
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle("📖 Codex de la Maison")
    .setDescription(
      (lines.length ? `**Où trouver les cartes manquantes de cette page :**\n${lines.join("\n")}` : view.filter === "possedees" ? "Vos cartes possédées, par série et par numéro." : "Aucune carte manquante sur cette page.").slice(0, 4000)
    )
    .setImage("attachment://codex.jpg")
    .setFooter({ text: `${list.length} carte(s) dans cette vue · 📦 boosters · ✨ fabrication avec la poussière · 🏪 marché · 🎖️ événement · 🍀 shiny` });
  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("carte_cx_f")
        .setPlaceholder("Afficher…")
        .addOptions(Object.entries(CODEX_FILTERS).map(([k, [label, emoji]]) => ({ label, value: k, emoji, default: view.filter === k })))
    ),
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_cx_s").setPlaceholder("Série").addOptions(seriesOptions(view.series))),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("carte_cx_r")
        .setPlaceholder("Rareté")
        .addOptions([{ label: "Toutes les raretés", value: "all", emoji: "🎴", default: view.rarity === "all" }, ...ORDER.map((r) => ({ label: RARITIES[r].name, value: r, emoji: RARITIES[r].emoji, default: view.rarity === r }))])
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_cx_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(view.page === 0),
      new ButtonBuilder().setCustomId("carte_cx_page").setLabel(`Page ${view.page + 1} / ${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId("carte_cx_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(view.page >= pages - 1),
      new ButtonBuilder().setCustomId("carte_mk").setLabel("Marché").setEmoji("🏪").setStyle(ButtonStyle.Primary)
    ),
  ];
  return { embeds: [embed], files: [file], components: rows };
}
