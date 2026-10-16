// --- Bureau de change : acheter des pièces 🪙 avec ses euros ---
// Volontairement cher (environ 10 € la pièce, un booster Standard revient à ~5 000 €) et plafonné chaque semaine,
// pour que les pièces se gagnent surtout en jouant. Les euros dépensés vont dans la trésorerie de la Maison.
const XCHG_PACKS = [
  { coins: 250, price: 2500, label: "Bourse" },
  { coins: 1000, price: 9500, label: "Coffret" },
  { coins: 3000, price: 27000, label: "Malle au trésor" },
];
const XCHG_WEEK_MAX = 3000; // pièces achetables par semaine et par joueur
const ECO = require("./economie");
function xchgBought(userId) {
  const st = load();
  st.coinBuys ??= {};
  const r = st.coinBuys[userId];
  return r && r.week === mondayKey() ? r.n : 0;
}
function xchgPayload(userId, note = "") {
  const left = Math.max(0, XCHG_WEEK_MAX - xchgBought(userId)), euros = ECO.readBalance(userId) ?? 0;
  const lines = XCHG_PACKS.map((p) => `🪙 **${p.coins.toLocaleString("fr-FR")} pièces** (${p.label}) — **${ECO.formatEuro(p.price)}**`).join("\n");
  const options = XCHG_PACKS.map((p, i) => ({
    label: `${p.coins.toLocaleString("fr-FR")} pièces — ${ECO.formatEuro(p.price)}`.slice(0, 100),
    value: String(i),
    emoji: "🪙",
    description: (p.coins > left ? "Dépasse votre plafond de la semaine" : euros < p.price ? "Pas assez d'euros" : p.label).slice(0, 100),
  }));
  return {
    content: note || null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🪙 Bureau de change")
        .setDescription(
          "Échangez vos **euros** contre des **pièces** du jeu de cartes. Le change est **cher** : les pièces se gagnent d'abord en jouant (quêtes, combats, mode Histoire…).\n\n" +
            `${lines}\n\n` +
            `💶 Vos euros : **${ECO.formatEuro(euros)}** · 🪙 Vos pièces : **${Math.floor(load().coins[userId] ?? 0).toLocaleString("fr-FR")}**\n` +
            `📅 Encore **${left.toLocaleString("fr-FR")} pièces** achetables cette semaine (plafond ${XCHG_WEEK_MAX.toLocaleString("fr-FR")}, remis à zéro le lundi).`
        ),
    ],
    files: [],
    attachments: [],
    components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_xchg_pick").setPlaceholder("Choisir un lot de pièces…").addOptions(options))],
  };
}
function xchgConfirmPayload(i) {
  const p = XCHG_PACKS[i];
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle("🪙 Confirmer l'achat")
        .setDescription(`Vous allez payer **${ECO.formatEuro(p.price)}** de vos euros pour recevoir **${p.coins.toLocaleString("fr-FR")} pièces**.\nCet achat est **définitif** : les pièces ne se revendent pas contre des euros.`),
    ],
    files: [],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`carte_xchg_ok_${i}`).setLabel(`Payer ${ECO.formatEuro(p.price)}`).setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_xchg").setLabel("Annuler").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
{
  // un bouton « Acheter des pièces » sous la vitrine de la boutique
  const front = shopFrontPayload;
  shopFrontPayload = async (...args) => {
    const p = await front(...args);
    p.components = [...(p.components ?? []), new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_xchg").setLabel("Acheter des pièces").setEmoji("🪙").setStyle(ButtonStyle.Success))];
    return p;
  };
  const shop = handleShopInteraction;
  handleShopInteraction = async (interaction) => {
    const id = interaction.customId;
    if (typeof id !== "string" || !id.startsWith("carte_xchg")) return shop(interaction);
    const userId = interaction.user.id;
    // depuis le message public de la boutique : réponse privée ; sinon on met à jour le message privé
    const reply = (payload) => {
      if (interaction.message?.flags?.has?.(64)) return interaction.update(payload);
      const { attachments, ...rest } = payload;
      void attachments;
      return interaction.reply({ ...rest, ephemeral: true });
    };
    if (id === "carte_xchg") {
      await reply(xchgPayload(userId));
      return true;
    }
    if (id === "carte_xchg_pick") {
      const i = Number(interaction.values?.[0]);
      if (!XCHG_PACKS[i]) return true;
      await reply(xchgConfirmPayload(i));
      return true;
    }
    const ok = /^carte_xchg_ok_(\d+)$/.exec(id);
    if (ok) {
      const p = XCHG_PACKS[Number(ok[1])];
      if (!p) return true;
      if (xchgBought(userId) + p.coins > XCHG_WEEK_MAX) {
        await reply(xchgPayload(userId, `❌ Plafond de la semaine atteint : vous pouvez encore acheter **${Math.max(0, XCHG_WEEK_MAX - xchgBought(userId))} pièces** d'ici lundi.`));
        return true;
      }
      if (ECO.isFrozen(userId)) {
        await reply(xchgPayload(userId, "🔒 Votre compte est **gelé** par l'IRF : achat impossible."));
        return true;
      }
      if (ECO.changeBalance(userId, -p.price, `Bureau de change : ${p.coins} pièces`) === null) {
        await reply(xchgPayload(userId, `❌ Fonds insuffisants : il faut **${ECO.formatEuro(p.price)}**.`));
        return true;
      }
      ECO.addToTreasury("ventePieces", p.price);
      changeBalance(userId, p.coins, "Bureau de change");
      const st = load();
      st.coinBuys ??= {};
      st.coinBuys[userId] = { week: mondayKey(), n: xchgBought(userId) + p.coins };
      save();
      await reply(xchgPayload(userId, `🎉 **+${p.coins.toLocaleString("fr-FR")} pièces** ! ${ECO.formatEuro(p.price)} ont été prélevés sur vos euros.`));
      return true;
    }
    return false;
  };
}
