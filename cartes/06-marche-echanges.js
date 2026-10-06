// --- Échanges et marché ---
// Cote d'une carte : prix médian des dernières ventes, sinon un prix de référence selon la rareté (×3 en holo).
const COTE_BASE = { commune: 150, peucommune: 300, rare: 750, epique: 3000, legendaire: 12000, mythique: 45000 };
const MARKET_FEE = 0.05, MARKET_MAX = 10, MARKET_DAYS = 7, TRADE_HOURS = 24, MK_PER_PAGE = 8, TRADE_MAX_CARDS = 5;
const cardOfKey = (key) => findCard(String(key).replace("*", ""));
const isHoloKey = (key) => String(key).endsWith("*");
// Nombre d'exemplaires en jeu (inventaires + annonces du marché), recalculé au plus toutes les 30 s
let supplyCache = null;
function supplyMap() {
  if (supplyCache && Date.now() - supplyCache.at < 30000) return supplyCache.map;
  const map = {};
  for (const inv of Object.values(load().inv)) for (const [k, n] of Object.entries(inv)) if (n > 0) map[k] = (map[k] ?? 0) + n;
  for (const l of load().market) map[l.key] = (map[l.key] ?? 0) + 1;
  supplyCache = { at: Date.now(), map };
  return map;
}
const circulation = (key) => supplyMap()[key] ?? 0;
// circulation moyenne des cartes de même rareté (et même version, holo ou non)
function avgCirculation(rarity, holo) {
  const cards = allCards().filter((c) => c.rarity === rarity);
  if (!cards.length) return 0;
  const map = supplyMap();
  return cards.reduce((a, c) => a + (map[holo ? `${c.id}*` : c.id] ?? 0), 0) / cards.length;
}
// Cote d'une carte :
//  · prix de base selon la rareté (×3 en holo)
//  · × rareté réelle en jeu : moins d'exemplaires que la moyenne de sa rareté = plus cher (de ×0,5 à ×3)
//  · × pression du marché : beaucoup d'annonces pour la même carte = un peu moins cher
//  · mélangé à 50 % avec le prix médian des ventes des 14 derniers jours
function coteOf(key) {
  const card = cardOfKey(key);
  if (!card) return 0;
  const holo = isHoloKey(key);
  const base = COTE_BASE[card.rarity] * (holo ? 3 : 1);
  const scarcity = Math.min(3, Math.max(0.5, Math.sqrt((avgCirculation(card.rarity, holo) + 1) / (circulation(key) + 1))));
  const listed = load().market.filter((l) => l.key === key).length;
  let price = (base * scarcity) / (1 + 0.08 * listed);
  const recent = load()
    .sales.filter((x) => x.key === key && Date.now() - x.at < 14 * 86400000)
    .slice(-5)
    .map((x) => x.price)
    .sort((a, b) => a - b);
  if (recent.length >= 2) price = price * 0.5 + recent[Math.floor(recent.length / 2)] * 0.5;
  return Math.max(10, Math.round(price / 10) * 10);
}
// Relevé quotidien des cotes, pour afficher la tendance sur 7 jours
function snapshotCotes() {
  const st = load();
  const day = dayKey();
  if (st.coteDay === day) return;
  st.coteDay = day;
  const keys = new Set([...Object.keys(supplyMap()), ...st.market.map((l) => l.key)]);
  for (const k of keys) {
    if (!cardOfKey(k)) continue;
    const h = (st.coteHistory[k] ??= []);
    h.push([day, coteOf(k)]);
    if (h.length > 14) h.shift();
  }
  save();
}
function coteTrend(key) {
  const h = load().coteHistory[key];
  if (!h?.length) return null;
  const ref = h.length >= 7 ? h[h.length - 7][1] : h[0][1];
  return ref ? Math.round((coteOf(key) / ref - 1) * 100) : null;
}
const trendText = (v) => (v === null ? "pas encore de tendance" : v === 0 ? "stable" : `${v > 0 ? "📈 +" : "📉 "}${v} % sur 7 jours`);
const euro = (n) => canvasText(formatEuro(Math.round(n)));
function ago(ms) {
  const min = Math.floor((Date.now() - ms) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 1440) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / 1440)} j`;
}
// déplace un exemplaire d'une carte d'un inventaire à un autre (to = null : la carte sort de l'inventaire)
function moveKey(from, to, key) {
  const s = load();
  const a = s.inv[from];
  if (!a?.[key]) return false;
  a[key]--;
  if (!a[key]) delete a[key];
  if (to) {
    const b = (s.inv[to] ??= {});
    b[key] = (b[key] ?? 0) + 1;
  }
  return true;
}
function ownedKeys(userId, series = "all") {
  return Object.entries(load().inv[userId] ?? {})
    .filter(([k, n]) => n > 0 && cardOfKey(k) && (series === "all" || seriesOf(cardOfKey(k)) === series))
    .sort(([a, na], [b, nb]) => ORDER.indexOf(cardOfKey(b).rarity) - ORDER.indexOf(cardOfKey(a).rarity) || nb - na);
}
function keyLabel(key) {
  const card = cardOfKey(key);
  return card ? `${card.name}${isHoloKey(key) ? " ✦ holo" : ""}` : key;
}
function seriesOptions(selected) {
  return [
    { label: "Toutes les séries", value: "all", emoji: "📚", default: selected === "all" },
    ...albumGroups().map((g) => ({ label: SERIES_LABELS[g].replace(/^\S+ /, ""), value: g, emoji: SERIES_LABELS[g].split(" ")[0], default: selected === g })),
  ];
}
function coinIcon(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  g.addColorStop(0, "#fff7d6");
  g.addColorStop(0.5, "#f59e0b");
  g.addColorStop(1, "#92400e");
  disc(ctx, x, y, r, g);
  ctx.strokeStyle = "rgba(120,53,15,0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#78350f";
  ctx.font = `${Math.round(r * 1.1)}px CardTitle`;
  const align = ctx.textAlign;
  ctx.textAlign = "center";
  ctx.fillText("€", x, y + r * 0.38);
  ctx.textAlign = align;
}
// fond commun : velours, guillochis, cadre doré et coins ornés
function velvet(ctx, W, H) {
  const gold = METAL.legendaire;
  const bg = ctx.createRadialGradient(W / 2, H * 0.4, 60, W / 2, H / 2, W * 0.8);
  bg.addColorStop(0, "#3a1418");
  bg.addColorStop(1, "#090304");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  guilloche(ctx, 0, 0, W, H, gold[0]);
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, gold);
  roundRect(ctx, 10, 10, W - 20, H - 20, 22);
  ctx.stroke();
  corners(ctx, { x: 18, y: 18, w: W - 36, h: H - 36 }, gold[1]);
}
function chip(ctx, x, y, label, value, align = "left") {
  ctx.font = "15px CardBold";
  const vw = ctx.measureText(value).width;
  ctx.font = "12px CardText";
  const lw = ctx.measureText(label).width;
  const w = Math.max(vw, lw) + 32;
  const left = align === "right" ? x - w : x;
  roundRect(ctx, left, y, w, 46, 12);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fill();
  ctx.strokeStyle = rgba(METAL.legendaire[0], 0.4);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.textAlign = "left";
  ctx.fillStyle = "#a08a7a";
  ctx.fillText(label, left + 16, y + 18);
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(value, left + 16, y + 37);
  return w;
}

// --- Marché : rendu de la vitrine ---
const mkViews = new Map(); // userId -> { series, rarity, sort, page }
function mkView(userId) {
  if (!mkViews.has(userId)) mkViews.set(userId, { series: "all", rarity: "all", sort: "recent", page: 0 });
  return mkViews.get(userId);
}
const MK_SORTS = {
  recent: ["Plus récentes", "🕒", (a, b) => b.at - a.at],
  prix: ["Prix croissant", "⬆️", (a, b) => a.price - b.price],
  prixdesc: ["Prix décroissant", "⬇️", (a, b) => b.price - a.price],
  rarete: ["Plus rares d'abord", "💎", (a, b) => ORDER.indexOf(cardOfKey(b.key).rarity) - ORDER.indexOf(cardOfKey(a.key).rarity) || a.price - b.price],
  affaire: ["Meilleures affaires", "🏷️", (a, b) => a.price / coteOf(a.key) - b.price / coteOf(b.key)],
};
function filteredListings(view) {
  let list = load().market.filter((l) => cardOfKey(l.key));
  if (view.series !== "all") list = list.filter((l) => seriesOf(cardOfKey(l.key)) === view.series);
  if (view.rarity !== "all") list = list.filter((l) => cardOfKey(l.key).rarity === view.rarity);
  return list.sort((MK_SORTS[view.sort] ?? MK_SORTS.recent)[2]);
}
async function drawMarket(view, viewerId) {
  const all = filteredListings(view), pages = Math.max(1, Math.ceil(all.length / MK_PER_PAGE));
  view.page = Math.min(Math.max(0, view.page), pages - 1);
  const slice = all.slice(view.page * MK_PER_PAGE, (view.page + 1) * MK_PER_PAGE);
  const W = 1200, H = 1000, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  velvet(ctx, W, H);

  // En-tête
  coinIcon(ctx, 82, 86, 34);
  ctx.font = "34px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  ctx.fillText("MARCHÉ DE LA MAISON", 134, 84);
  ctx.shadowBlur = 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#ecc979";
  ctx.fillText(`Achetez et vendez vos cartes entre membres · commission de ${Math.round(MARKET_FEE * 100)} %`, 136, 116);
  const day = Date.now() - 86400000, sales = load().sales.filter((s) => s.at >= day);
  let cx = W - 44;
  for (const [label, value] of [
    ["Volume 24 h", euro(sales.reduce((a, s) => a + s.price, 0))],
    ["Ventes 24 h", String(sales.length)],
    ["Annonces", String(load().market.length)],
  ]) cx -= chip(ctx, cx, 62, label, value, "right") + 10;
  // filtres actifs
  const filters = [
    view.series === "all" ? "Toutes les séries" : SERIES_LABELS[view.series].replace(/^\S+ /, ""),
    view.rarity === "all" ? "Toutes raretés" : RARITIES[view.rarity].name,
    MK_SORTS[view.sort]?.[0] ?? "Plus récentes",
  ];
  ctx.font = "15px CardBold";
  let fx = 48;
  ctx.textAlign = "center";
  for (const f of filters) {
    const w = ctx.measureText(f).width + 30;
    pill(ctx, fx + w / 2, 160, f, "rgba(255,255,255,0.08)", "#f5e6c8");
    fx += w + 10;
  }
  ctx.textAlign = "right";
  ctx.fillStyle = "#cbb9a9";
  ctx.font = "15px CardText";
  ctx.fillText(`${all.length} annonce${all.length > 1 ? "s" : ""} · page ${view.page + 1} / ${pages}`, W - 48, 166);
  ctx.textAlign = "left";

  // Vitrine : 4 × 2 annonces
  const tw = 266, th = 380, gap = 18, x0 = (W - (4 * tw + 3 * gap)) / 2, y0 = 190;
  for (let i = 0; i < MK_PER_PAGE; i++) {
    const x = x0 + (i % 4) * (tw + gap), y = y0 + Math.floor(i / 4) * (th + 14);
    const l = slice[i];
    roundRect(ctx, x, y, tw, th, 16);
    if (!l) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.fill();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      continue;
    }
    const card = cardOfKey(l.key), holo = isHoloKey(l.key), m = METAL[card.rarity], cote = coteOf(l.key), ratio = l.price / cote;
    const deal = ratio <= 0.8, mine = l.seller === viewerId;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    const tg = ctx.createLinearGradient(0, y, 0, y + th);
    tg.addColorStop(0, "rgba(44,18,20,0.96)");
    tg.addColorStop(1, "rgba(14,5,6,0.96)");
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = deal ? 3 : 2;
    ctx.strokeStyle = deal ? metalGradient(ctx, W, H, gold) : rgba(m[1], 0.85);
    roundRect(ctx, x, y, tw, th, 16);
    ctx.stroke();
    glow(ctx, x + tw / 2, y + 128, 120, m[4], 0.18 + ORDER.indexOf(card.rarity) * 0.04);
    // carte
    const cw = 160, ch = 224, cxp = x + (tw - cw) / 2, cyp = y + 16;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 14;
    ctx.drawImage(await cardThumb(card, holo, cw, ch), cxp, cyp, cw, ch);
    ctx.restore();
    if (deal) ribbon(ctx, cxp, cyp, cw, ch, "AFFAIRE");
    // numéro de l'annonce (repris dans le menu d'achat)
    disc(ctx, x + 24, y + 24, 17, metalGradient(ctx, W, H, gold));
    ctx.fillStyle = "#2a1305";
    ctx.font = "16px CardBold";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + 24, y + 30);
    if (mine) {
      ctx.font = "10px CardBold";
      pill(ctx, x + tw - 56, y + 24, "VOTRE ANNONCE", "#2563eb", "#ffffff");
    }
    // nom, rareté, prix, cote, vendeur
    ctx.font = `${fitText(ctx, card.name, tw - 30, 18, "CardBold")}px CardBold`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(card.name, x + tw / 2, y + 264);
    ctx.font = "11px CardBold";
    const rarityW = ctx.measureText(RARITIES[card.rarity].name.toUpperCase()).width + 30;
    const holoW = holo ? ctx.measureText("HOLO").width + 30 : 0;
    const startX = x + tw / 2 - (rarityW + (holo ? holoW + 6 : 0)) / 2;
    pill(ctx, startX + rarityW / 2, y + 288, RARITIES[card.rarity].name.toUpperCase(), m[1], "#ffffff");
    if (holo) pill(ctx, startX + rarityW + 6 + holoW / 2, y + 288, "HOLO", "rainbow", "#0d0507");
    ctx.font = "32px CardTitle";
    ctx.fillStyle = "#fde68a";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 6;
    ctx.fillText(euro(l.price), x + tw / 2, y + 330);
    ctx.shadowBlur = 0;
    const diff = Math.round((ratio - 1) * 100);
    ctx.font = "13px CardBold";
    ctx.fillStyle = diff <= -10 ? "#4ade80" : diff >= 10 ? "#f87171" : "#cbb9a9";
    const coteLine = `cote ${euro(cote)} · ${diff > 0 ? "+" : ""}${diff} % · ${circulation(l.key)} en jeu`;
    ctx.font = `${fitText(ctx, coteLine, tw - 24, 13, "CardBold")}px CardBold`;
    ctx.fillText(coteLine, x + tw / 2, y + 350);
    ctx.font = "12px CardText";
    ctx.fillStyle = "#a08a7a";
    ctx.fillText(`par ${String(l.sellerName ?? "?").slice(0, 18)} · ${ago(l.at)}`, x + tw / 2, y + 369);
    ctx.textAlign = "left";
  }
  if (!slice.length) {
    ctx.textAlign = "center";
    ctx.font = "26px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText(all.length ? "Aucune annonce sur cette page." : "Aucune annonce pour le moment.", W / 2, y0 + th - 10);
    ctx.font = "16px CardText";
    ctx.fillStyle = "#cbb9a9";
    ctx.fillText("Mettez une carte en vente avec le bouton « Vendre une carte ».", W / 2, y0 + th + 22);
    ctx.textAlign = "left";
  }
  // Pied
  ctx.textAlign = "center";
  for (let p = 0; p < pages; p++) {
    diamond(ctx, W / 2 + (p - (pages - 1) / 2) * 20, H - 46, 5);
    if (p === view.page) {
      ctx.fillStyle = "#fbbf24";
      ctx.fill();
    } else {
      ctx.strokeStyle = "#71717a";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#a08a7a";
  spaced(ctx, "CHOISISSEZ LE NUMÉRO D'UNE ANNONCE DANS LE MENU POUR L'ACHETER", W / 2, H - 22, 2);
  ctx.textAlign = "left";
  return { canvas: c, slice, pages };
}
function disabledSelect(customId, placeholder) {
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setDisabled(true).addOptions([{ label: "—", value: "none" }]);
}
async function marketPayload(user) {
  const view = mkView(user.id);
  const { canvas, slice, pages } = await drawMarket(view, user.id);
  const file = new AttachmentBuilder(await canvas.encode("jpeg", 92), { name: "marche.jpg" });
  const embed = new EmbedBuilder()
    .setColor(0xe9c46a)
    .setTitle("🏪 Marché de la Maison")
    .setDescription("Filtrez, triez, puis choisissez une annonce par son **numéro** pour l'acheter. Pour vendre, utilisez **Vendre une carte** (ou le bouton 💰 sur une carte de votre album).")
    .setImage("attachment://marche.jpg")
    .setFooter({ text: `La cote suit la circulation : moins une carte est répandue, plus elle vaut cher · commission de ${Math.round(MARKET_FEE * 100)} % · annonces valables ${MARKET_DAYS} jours` });
  const rows = [
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_mk_series").setPlaceholder("Série").addOptions(seriesOptions(view.series))),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("carte_mk_rarity")
        .setPlaceholder("Rareté")
        .addOptions([{ label: "Toutes les raretés", value: "all", emoji: "🎴", default: view.rarity === "all" }, ...ORDER.map((r) => ({ label: RARITIES[r].name, value: r, emoji: RARITIES[r].emoji, default: view.rarity === r }))])
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("carte_mk_sort")
        .setPlaceholder("Trier")
        .addOptions(Object.entries(MK_SORTS).map(([k, [label, emoji]]) => ({ label, value: k, emoji, default: view.sort === k })))
    ),
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
        : disabledSelect("carte_mk_buy", "Aucune annonce à acheter")
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_mk_prev").setEmoji("◀️").setStyle(ButtonStyle.Secondary).setDisabled(view.page === 0),
      new ButtonBuilder().setCustomId("carte_mk_next").setEmoji("▶️").setStyle(ButtonStyle.Secondary).setDisabled(view.page >= pages - 1),
      new ButtonBuilder().setCustomId("carte_mk_sell").setLabel("Vendre une carte").setEmoji("💰").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("carte_mk_mine").setLabel("Mes annonces").setEmoji("📋").setStyle(ButtonStyle.Secondary)
    ),
  ];
  return { embeds: [embed], files: [file], components: rows };
}
function priceModal(key) {
  const card = cardOfKey(key);
  return new ModalBuilder()
    .setCustomId(`carte_mk_pf_${key}`)
    .setTitle(`Vendre : ${keyLabel(key)}`.slice(0, 45))
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("prix")
          .setLabel(`Prix de vente en € (cote : ${euro(coteOf(key))})`.slice(0, 45))
          .setPlaceholder(`Par exemple ${Math.round(coteOf(key))}`)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(12)
      )
    );
}
const parseAmount = (text) => Math.round(Number(String(text ?? "").replace(/[\s€  ]/g, "").replace(",", ".")));
function sellPickerPayload(userId, series = "all") {
  const keys = ownedKeys(userId, series).slice(0, 25);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x16a34a)
        .setTitle("💰 Vendre une carte")
        .setDescription("Choisissez la série puis la carte à mettre en vente. La carte est retirée de votre album pendant la vente et vous est rendue si vous annulez ou si l'annonce expire.")
        .setFooter({ text: `Commission de ${Math.round(MARKET_FEE * 100)} % prélevée à la vente` }),
    ],
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_mk_ss").setPlaceholder("Série").addOptions(seriesOptions(series))),
      new ActionRowBuilder().addComponents(
        keys.length
          ? new StringSelectMenuBuilder()
              .setCustomId("carte_mk_sc")
              .setPlaceholder("Carte à vendre…")
              .addOptions(keys.map(([k, n]) => ({ label: keyLabel(k).slice(0, 100), value: k, emoji: RARITIES[cardOfKey(k).rarity].emoji, description: `${RARITIES[cardOfKey(k).rarity].name} · ×${n} · cote ${euro(coteOf(k))}` })))
          : disabledSelect("carte_mk_sc", "Aucune carte dans cette série")
      ),
    ],
    files: [],
  };
}

// --- Échanges : rendu de la table d'échange ---
const TRADE_STATUS = {
  draft: ["BROUILLON — EN PRÉPARATION", "#2563eb"],
  live: ["EN DIRECT — CHACUN CHOISIT SES CARTES", "#2563eb"],
  pending: ["EN ATTENTE DE RÉPONSE", "#d97706"],
  done: ["ÉCHANGE CONCLU", "#16a34a"],
  refused: ["ÉCHANGE REFUSÉ", "#dc2626"],
  cancelled: ["ÉCHANGE ANNULÉ", "#52525b"],
  expired: ["PROPOSITION EXPIRÉE", "#52525b"],
  failed: ["ÉCHANGE IMPOSSIBLE", "#dc2626"],
};
const sideValue = (keys, money) => keys.reduce((a, k) => a + coteOf(k), 0) + (money ?? 0);
function swapArrows(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const dir of [1, -1]) {
    const yy = y + dir * r * 0.28;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55 * dir, yy);
    ctx.lineTo(x + r * 0.45 * dir, yy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + r * 0.62 * dir, yy);
    ctx.lineTo(x + r * 0.3 * dir, yy - r * 0.22);
    ctx.lineTo(x + r * 0.3 * dir, yy + r * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  ctx.lineCap = "butt";
}
async function drawTrade(tr) {
  const W = 1200, H = 740, gold = METAL.legendaire;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  velvet(ctx, W, H);
  ctx.textAlign = "center";
  ctx.font = "30px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 8;
  spaced(ctx, tr.live ? "TABLE D'ÉCHANGE" : "PROPOSITION D'ÉCHANGE", W / 2, 64, 4);
  ctx.shadowBlur = 0;
  let [statusLabel, statusColor] = TRADE_STATUS[tr.status] ?? TRADE_STATUS.pending;
  if (tr.status === "live" && (tr.ready?.from || tr.ready?.to)) [statusLabel, statusColor] = [`${tr.ready.from ? tr.fromName : tr.toName} a validé — en attente de l'autre`.toUpperCase().slice(0, 60), "#16a34a"];
  ctx.font = "14px CardBold";
  pill(ctx, W / 2, 98, statusLabel, statusColor, "#ffffff");
  ctx.textAlign = "left";

  const sides = [
    { name: tr.fromName, avatar: tr.fromAvatar, keys: tr.give, money: tr.giveMoney, verb: tr.live ? (tr.status === "done" ? "a donné" : "propose") : "donne", ready: tr.ready?.from },
    { name: tr.toName, avatar: tr.toAvatar, keys: tr.take, money: tr.takeMoney, verb: tr.status === "done" ? "a donné" : tr.live ? "propose" : "donnerait", ready: tr.ready?.to },
  ];
  const values = sides.map((sd) => sideValue(sd.keys, sd.money));
  for (const [i, sd] of sides.entries()) {
    const px = i === 0 ? 36 : 644, py = 128, pw = 520, ph = 502;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    roundRect(ctx, px, py, pw, ph, 18);
    const pg = ctx.createLinearGradient(0, py, 0, py + ph);
    pg.addColorStop(0, "rgba(44,18,20,0.94)");
    pg.addColorStop(1, "rgba(14,5,6,0.94)");
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(gold[0], 0.45);
    ctx.lineWidth = 1.5;
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.stroke();
    // membre
    const av = sd.avatar ? await fetchImage(`avatar:${sd.avatar}`, sd.avatar) : null;
    disc(ctx, px + 52, py + 52, 34, metalGradient(ctx, W, H, gold));
    ctx.save();
    ctx.beginPath();
    ctx.arc(px + 52, py + 52, 29, 0, TAU);
    ctx.clip();
    if (av) ctx.drawImage(av, px + 23, py + 23, 58, 58);
    else disc(ctx, px + 52, py + 52, 29, "#3f3f46");
    ctx.restore();
    ctx.font = `${fitText(ctx, sd.name ?? "?", pw - (tr.status === "live" ? 270 : 130), 30, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(sd.name ?? "?", px + 100, py + 54);
    ctx.font = "17px CardItalic";
    ctx.fillStyle = "#ecc979";
    ctx.fillText(sd.verb, px + 102, py + 80);
    if (tr.status === "live") {
      ctx.font = "13px CardBold";
      ctx.textAlign = "center";
      pill(ctx, px + pw - 70, py + 40, sd.ready ? "VALIDÉ" : "EN RÉFLEXION", sd.ready ? "#16a34a" : "#52525b", "#ffffff");
      ctx.textAlign = "left";
    }
    // cartes en éventail
    const n = sd.keys.length, cw = 150, ch = 210, area = pw - 60;
    const step = n > 1 ? Math.min(cw + 16, (area - cw) / (n - 1)) : 0, total = n > 1 ? step * (n - 1) + cw : cw;
    for (const [k, key] of sd.keys.entries()) {
      const card = cardOfKey(key);
      if (!card) continue;
      const x = px + (pw - total) / 2 + k * step, rot = n > 3 ? (k - (n - 1) / 2) * 0.05 : 0;
      ctx.save();
      ctx.translate(x + cw / 2, py + 120 + ch / 2 + Math.abs(k - (n - 1) / 2) * (n > 3 ? 6 : 0));
      ctx.rotate(rot);
      ctx.shadowColor = "rgba(0,0,0,0.7)";
      ctx.shadowBlur = 16;
      glow(ctx, 0, 0, 110, METAL[card.rarity][4], 0.2);
      ctx.drawImage(await cardThumb(card, isHoloKey(key), cw, ch), -cw / 2, -ch / 2, cw, ch);
      ctx.restore();
    }
    if (!n && !sd.money) {
      roundRect(ctx, px + pw / 2 - 75, py + 120, 150, 210, 12);
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = "center";
      ctx.font = "18px CardItalic";
      ctx.fillStyle = "#a08a7a";
      ctx.fillText("Rien", px + pw / 2, py + 230);
      ctx.textAlign = "left";
    }
    // noms des cartes
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = "#cbb9a9";
    const names = sd.keys.map(keyLabel).join(" · ");
    ctx.font = `${fitText(ctx, names, pw - 40, 14, "CardBold")}px CardBold`;
    ctx.fillText(names, px + pw / 2, py + 362);
    // argent
    if (sd.money) {
      coinIcon(ctx, px + pw / 2 - 90, py + 400, 18);
      ctx.font = "28px CardTitle";
      ctx.fillStyle = "#fde68a";
      ctx.textAlign = "left";
      ctx.fillText(`+ ${euro(sd.money)}`, px + pw / 2 - 62, py + 410);
      ctx.textAlign = "center";
    }
    // valeur estimée
    ctx.strokeStyle = rgba(gold[0], 0.3);
    ctx.beginPath();
    ctx.moveTo(px + 30, py + 444);
    ctx.lineTo(px + pw - 30, py + 444);
    ctx.stroke();
    ctx.font = "14px CardText";
    ctx.fillStyle = "#a08a7a";
    ctx.fillText("VALEUR ESTIMÉE", px + pw / 2, py + 468);
    ctx.font = "22px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(euro(values[i]), px + pw / 2, py + 492);
    ctx.textAlign = "left";
  }
  // médaillon central
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 16;
  disc(ctx, W / 2, 380, 46, metalGradient(ctx, W, H, gold));
  ctx.restore();
  disc(ctx, W / 2, 380, 38, "#1a0a0d");
  swapArrows(ctx, W / 2, 380, 36, gold[0]);

  // jauge d'équilibre
  const tot = values[0] + values[1], share = tot ? values[0] / tot : 0.5, gx = 300, gw = 600, gy = 676;
  roundRect(ctx, gx, gy, gw, 12, 6);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fill();
  roundRect(ctx, gx, gy, Math.max(12, gw * share), 12, 6);
  const gg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
  gg.addColorStop(0, gold[3]);
  gg.addColorStop(1, gold[0]);
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(gx + gw / 2 - 1, gy - 5, 2, 22);
  const diff = tot ? Math.abs(values[0] - values[1]) / Math.max(values[0], values[1]) : 0;
  const winner = values[0] > values[1] ? sides[1].name : sides[0].name;
  ctx.textAlign = "center";
  ctx.font = "15px CardBold";
  ctx.fillStyle = diff <= 0.2 ? "#4ade80" : "#fbbf24";
  ctx.fillText(diff <= 0.2 ? "Échange équilibré" : `Avantage ${winner} (+${Math.round(diff * 100)} %)`, W / 2, gy - 10);
  ctx.font = "12px CardText";
  ctx.fillStyle = "#a08a7a";
  ctx.fillText(sides[0].name ?? "", gx - 10 - ctx.measureText(sides[0].name ?? "").width / 2, gy + 10);
  ctx.fillText(sides[1].name ?? "", gx + gw + 10 + ctx.measureText(sides[1].name ?? "").width / 2, gy + 10);
  if (tr.status === "live") ctx.fillText("Chacun ajoute ses cartes · toute modification annule les validations · l'échange se fait quand les deux ont validé", W / 2, H - 24);
  if (tr.status === "pending") {
    const left = Math.max(0, tr.at + TRADE_HOURS * 3600000 - Date.now());
    ctx.fillText(`Seul(e) ${sides[1].name} peut accepter · expire dans ${Math.floor(left / 3600000)} h ${Math.floor((left % 3600000) / 60000)} min`, W / 2, H - 24);
  }
  ctx.textAlign = "left";
  return c;
}
async function tradeImage(tr) {
  return new AttachmentBuilder(await (await drawTrade(tr)).encode("jpeg", 92), { name: "echange.jpg" });
}
const drafts = new Map(); // userId -> brouillon d'échange en cours
function newDraft(from, to, fromName, toName) {
  return {
    from: from.id,
    to: to.id,
    fromName: fromName ?? from.displayName ?? from.username,
    toName: toName ?? to.displayName ?? to.username,
    fromAvatar: from.displayAvatarURL({ extension: "png", size: 128 }),
    toAvatar: to.displayAvatarURL({ extension: "png", size: 128 }),
    give: [],
    take: [],
    giveMoney: 0,
    takeMoney: 0,
    gf: "all",
    tf: "all",
    status: "draft",
    at: Date.now(),
  };
}
function cardSelect(customId, placeholder, keys, selected) {
  const options = keys.slice(0, 25).map(([k, n]) => ({
    label: keyLabel(k).slice(0, 100),
    value: k,
    emoji: RARITIES[cardOfKey(k).rarity].emoji,
    description: `${RARITIES[cardOfKey(k).rarity].name} · ×${n} · cote ${euro(coteOf(k))}`.slice(0, 100),
    default: selected.includes(k),
  }));
  if (!options.length) return disabledSelect(customId, `${placeholder} (aucune carte)`);
  return new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).setMinValues(0).setMaxValues(Math.min(TRADE_MAX_CARDS, options.length)).addOptions(options);
}
async function draftPayload(d) {
  const embed = new EmbedBuilder()
    .setColor(0x2563eb)
    .setTitle(`🔄 Échange avec ${d.toName}`)
    .setDescription(
      "**1.** Choisissez les cartes que vous **donnez** (jusqu'à 5)\n" +
        `**2.** Choisissez les cartes que vous **demandez** à ${d.toName} (jusqu'à 5)\n` +
        "**3.** Ajoutez de l'argent si besoin avec 💶\n" +
        "**4.** Envoyez : la proposition s'affiche dans le salon des cartes et l'autre membre a 24 h pour répondre."
    )
    .setImage("attachment://echange.jpg");
  return {
    embeds: [embed],
    files: [await tradeImage(d)],
    components: [
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_tr_gf").setPlaceholder("Mes cartes : série").addOptions(seriesOptions(d.gf))),
      new ActionRowBuilder().addComponents(cardSelect("carte_tr_give", "Cartes que je donne…", ownedKeys(d.from, d.gf), d.give)),
      new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_tr_tf").setPlaceholder(`Cartes de ${d.toName} : série`.slice(0, 150)).addOptions(seriesOptions(d.tf))),
      new ActionRowBuilder().addComponents(cardSelect("carte_tr_take", `Cartes que je demande à ${d.toName}…`.slice(0, 150), ownedKeys(d.to, d.tf), d.take)),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_tr_money").setLabel("Argent").setEmoji("💶").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("carte_tr_send").setLabel("Envoyer la proposition").setEmoji("✉️").setStyle(ButtonStyle.Success).setDisabled(!d.give.length && !d.take.length && !d.giveMoney && !d.takeMoney),
        new ButtonBuilder().setCustomId("carte_tr_cancel").setLabel("Abandonner").setStyle(ButtonStyle.Danger)
      ),
    ],
  };
}
// fusionne une sélection faite dans une liste filtrée avec les cartes déjà choisies dans les autres séries
function mergeSelection(previous, visibleKeys, values) {
  const visible = new Set(visibleKeys);
  return [...previous.filter((k) => !visible.has(k)), ...values.filter((v) => v !== "none")].slice(0, TRADE_MAX_CARDS);
}
// vérifie qu'un échange est encore possible : cartes possédées en quantité suffisante, argent disponible
function tradeProblem(tr) {
  const need = (userId, keys) => {
    const counts = {};
    for (const k of keys) counts[k] = (counts[k] ?? 0) + 1;
    return Object.entries(counts).find(([k, n]) => (load().inv[userId]?.[k] ?? 0) < n)?.[0];
  };
  const a = need(tr.from, tr.give);
  if (a) return `${tr.fromName} ne possède plus **${keyLabel(a)}**.`;
  const b = need(tr.to, tr.take);
  if (b) return `${tr.toName} ne possède plus **${keyLabel(b)}**.`;
  if (tr.giveMoney && readBalance(tr.from) < tr.giveMoney) return `${tr.fromName} n'a plus assez d'argent.`;
  if (tr.takeMoney && readBalance(tr.to) < tr.takeMoney) return `${tr.toName} n'a pas assez d'argent.`;
  return null;
}
function tradeButtons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`carte_tr_ok_${id}`).setLabel("Accepter").setEmoji("✅").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`carte_tr_no_${id}`).setLabel("Refuser").setEmoji("✖️").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`carte_tr_x_${id}`).setLabel("Annuler (auteur)").setStyle(ButtonStyle.Secondary)
  );
}
function tradeEmbed(tr, extra = "") {
  const [label] = TRADE_STATUS[tr.status] ?? TRADE_STATUS.pending;
  const list = (keys, money) => [...keys.map((k) => `${RARITIES[cardOfKey(k)?.rarity]?.emoji ?? "▫️"} ${keyLabel(k)}`), ...(money ? [`💶 ${formatEuro(money)}`] : [])].join("\n") || "*Rien*";
  return new EmbedBuilder()
    .setColor(parseInt((TRADE_STATUS[tr.status] ?? TRADE_STATUS.pending)[1].slice(1), 16))
    .setTitle(`🔄 ${label.charAt(0) + label.slice(1).toLowerCase()}`)
    .addFields({ name: `${tr.fromName} donne`, value: list(tr.give, tr.giveMoney), inline: true }, { name: `${tr.toName} donne`, value: list(tr.take, tr.takeMoney), inline: true })
    .setDescription(extra || null)
    .setImage("attachment://echange.jpg");
}
async function closeTrade(id, status, client) {
  const tr = load().trades[id];
  if (!tr || tr.status !== "pending") return;
  tr.status = status;
  save();
  const tch = tr.channelId ? await channelRef?.client.channels.fetch(tr.channelId).catch(() => null) : channelRef;
  const msg = tr.messageId ? await tch?.messages.fetch(tr.messageId).catch(() => null) : null;
  await msg?.edit({ embeds: [tradeEmbed(tr)], files: [await tradeImage(tr)], components: [] }).catch(() => null);
  deleteLater(msg, MINUTE);
}

