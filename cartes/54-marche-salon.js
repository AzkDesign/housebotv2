
// --- Le marché affiché en permanence dans son salon ---
// Un seul message, tenu à jour : l'image des annonces (les plus récentes) et le menu d'achat. Les filtres,
// la vente et « Mes annonces » s'ouvrent en privé : chacun parcourt le marché sans changer l'affichage des autres.
const MARKET_CHANNEL_ID = "1556802781426221147";
async function marketBoardPayload() {
  const view = { series: "all", rarity: "all", sort: "recent", page: 0 };
  const { canvas, slice } = await drawMarket(view, null);
  const file = new AttachmentBuilder(await canvas.encode("jpeg", 90), { name: "marche.jpg" });
  const total = load().market.filter((l) => cardOfKey(l.key)).length;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("🏪 Marché de la Maison")
        .setDescription(
          `**${total}** annonce${total > 1 ? "s" : ""} en ce moment. Choisissez une annonce par son **numéro** pour l'acheter.\n` +
            "🔎 **Parcourir et filtrer** : par série, rareté, prix, meilleures affaires… · 💰 **Vendre une carte** · 📋 **Mes annonces**"
        )
        .setImage("attachment://marche.jpg")
        .setFooter({ text: `Mis à jour en direct · la cote suit la circulation · commission de ${Math.round(MARKET_FEE * 100)} % · annonces valables ${MARKET_DAYS} jours` }),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        slice.length
          ? new StringSelectMenuBuilder()
              .setCustomId("carte_mk_buy")
              .setPlaceholder("🛒 Acheter l'annonce n°…")
              .addOptions(
                slice.map((l, i) => {
                  const card = cardOfKey(l.key);
                  return { label: `${i + 1}. ${keyLabel(l.key)}`.slice(0, 100), value: l.id, emoji: RARITIES[card.rarity].emoji, description: `${euro(l.price)} · ${RARITIES[card.rarity].name} · par ${l.sellerName ?? "?"}`.slice(0, 100) };
                })
              )
          : disabledSelect("carte_mk_buy", "Aucune annonce pour le moment")
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_mk").setLabel("Parcourir et filtrer").setEmoji("🔎").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_mk_sell").setLabel("Vendre une carte").setEmoji("💰").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_mk_mine").setLabel("Mes annonces").setEmoji("📋").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
// redessiné quand les annonces changent (et toutes les 30 min pour les cotes)
async function marketBoardLoop() {
  const st = load();
  const hash = JSON.stringify(st.market.map((l) => [l.id, l.price])) + `|${Math.floor(Date.now() / (30 * MINUTE))}`;
  if (st.marketBoardHash === hash && st.marketBoardId) return;
  const ch = await cardClient?.channels?.fetch(MARKET_CHANNEL_ID).catch(() => null);
  if (!ch?.isTextBased?.()) return;
  const payload = await marketBoardPayload();
  let msg = st.marketBoardId ? await ch.messages.fetch(st.marketBoardId).catch(() => null) : null;
  if (msg && !(await msg.edit(payload).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    const { attachments, ...send } = payload;
    void attachments;
    msg = await ch.send(send).catch((err) => (console.error("Marché (salon):", err.message), null));
    if (msg) st.marketBoardId = msg.id;
  }
  if (msg) st.marketBoardHash = hash;
  save();
}
