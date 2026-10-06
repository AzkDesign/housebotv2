
// --- Stock des boosters de la boutique ---
// Le stock est commun à tout le serveur : si quelqu'un achète beaucoup, il en reste moins pour les autres.
// Pour rester agréable : le stock revient petit à petit (plein en 24 h), chacun a une limite par jour,
// et quand il ne reste presque plus rien, le prix monte (« forte demande »).
// Les boosters gagnés (quêtes, succès, équipes, île…) ne passent pas par le stock.
const STOCK_MAX = { standard: 60, premium: 24, prestige: 6, frisson: 20, givre: 20 };
const STOCK_DAILY_LIMIT = { standard: 15, premium: 6, prestige: 2, frisson: 5, givre: 5 };
const STOCK_LOW = 0.25, STOCK_SURCHARGE = 0.2; // sous 25 % du stock, le prix monte de 20 %
const restockMs = (type) => (24 * 3600000) / STOCK_MAX[type];
let stockSnapshot = "";

function stockState(type) {
  const st = load();
  st.stock ??= {};
  const max = STOCK_MAX[type];
  const s = (st.stock[type] ??= { n: max, at: Date.now() });
  const iv = restockMs(type), add = Math.floor((Date.now() - s.at) / iv);
  if (add > 0) {
    s.n = Math.min(max, s.n + add);
    s.at = s.n >= max ? Date.now() : s.at + add * iv;
  }
  if (s.n >= max) s.at = Date.now();
  return s;
}
const stockOf = (type) => (STOCK_MAX[type] ? stockState(type).n : Infinity);
const nextRestockAt = (type) => stockState(type).at + restockMs(type);
const stockLow = (type) => STOCK_MAX[type] && stockOf(type) <= Math.ceil(STOCK_MAX[type] * STOCK_LOW);
function boughtToday(userId, type) {
  const b = load().stockBuys;
  return b?.day === dayKey() ? b.users?.[userId]?.[type] ?? 0 : 0;
}
const personalLeft = (userId, type) => (STOCK_DAILY_LIMIT[type] ? Math.max(0, STOCK_DAILY_LIMIT[type] - boughtToday(userId, type)) : Infinity);
function takeStock(userId, type, n) {
  const st = load();
  if (STOCK_MAX[type]) stockState(type).n -= n;
  if (st.stockBuys?.day !== dayKey()) st.stockBuys = { day: dayKey(), users: {} };
  const u = (st.stockBuys.users[userId] ??= {});
  u[type] = (u[type] ?? 0) + n;
  save();
}
function stockBar(type) {
  const max = STOCK_MAX[type], n = stockOf(type), filled = Math.round((n / max) * 8);
  return (n === 0 ? "🟥" : stockLow(type) ? "🟧" : "🟩").repeat(filled) + "⬛".repeat(8 - filled);
}
function stockLine(type, userId = null) {
  if (!STOCK_MAX[type]) return "";
  const n = stockOf(type), max = STOCK_MAX[type], next = Math.floor(nextRestockAt(type) / 1000);
  const parts = [`${stockBar(type)} **${n} / ${max}** en stock`];
  if (n === 0) parts.push(`**rupture** — retour <t:${next}:R>`);
  else if (n < max) parts.push(`+1 <t:${next}:R>`);
  if (stockLow(type) && n > 0) parts.push(`🔥 forte demande : +${Math.round(STOCK_SURCHARGE * 100)} %`);
  if (userId) parts.push(`votre limite du jour : ${boughtToday(userId, type)} / ${STOCK_DAILY_LIMIT[type]}`);
  return parts.join(" · ");
}
const stockShort = (type) => (STOCK_MAX[type] ? (stockOf(type) ? ` · stock ${stockOf(type)}/${STOCK_MAX[type]}${stockLow(type) ? " 🔥" : ""}` : " · **rupture**") : "");
// le panneau se met à jour quand le stock bouge (réapprovisionnement)
function tickStock() {
  const snap = Object.keys(STOCK_MAX).map(stockOf).join(",");
  if (snap !== stockSnapshot) {
    if (stockSnapshot) panelDirty = true;
    stockSnapshot = snap;
    save();
  }
}
// vérifie un achat : combien de boosters peuvent vraiment être achetés
function stockCheck(userId, type, n) {
  const stock = stockOf(type), mine = personalLeft(userId, type);
  const ok = Math.min(n, stock, mine);
  if (ok >= 1) return { n: ok, note: ok < n ? (ok === stock && stock < mine ? `il n'en restait que ${stock} en stock` : `limite du jour : ${STOCK_DAILY_LIMIT[type]} par personne`) : null };
  if (stock < 1) return { n: 0, error: `🛒 Rupture de stock pour le booster **${PACKS[type].name}** ! Le prochain revient <t:${Math.floor(nextRestockAt(type) / 1000)}:R> (le stock se remplit petit à petit, plein en 24 h).` };
  return { n: 0, error: `🛒 Vous avez atteint votre limite du jour pour le booster **${PACKS[type].name}** (${STOCK_DAILY_LIMIT[type]} par personne). Revenez demain, ou gagnez-en avec les quêtes, les succès et l'île !` };
}
async function announceSoldOut(type) {
  const msg = await chan("annonces")
    ?.send({ content: `🛒 **Rupture de stock** : plus aucun booster **${PACKS[type].emoji} ${PACKS[type].name}** en boutique ! Le premier revient <t:${Math.floor(nextRestockAt(type) / 1000)}:R>.`, allowedMentions: { parse: [] } })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}
{
  // prix de « forte demande » quand le stock est presque vide
  const price = boosterPrice;
  boosterPrice = (key) => {
    const base = price(key);
    return stockLow(key) ? Math.round(base * (1 + STOCK_SURCHARGE)) : base;
  };
}
