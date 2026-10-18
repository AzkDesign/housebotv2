// La Bourse de la Maison : on achète des parts des entreprises du serveur et on les revend quand on veut.
// - Chaque entreprise active est cotée. Le cours bouge chaque minute : il suit le vrai chiffre d'affaires
//   (un client servi fait monter l'action), revient doucement vers sa « juste valeur », avec un peu de hasard.
// - Chaque achat fait monter le cours, chaque vente le fait baisser (comme un vrai carnet d'ordres).
// - Frais de 1 % à l'achat et à la vente (versés au Trésor) : impossible de s'enrichir en achetant et revendant aussitôt.
// - Plafond de 25 000 € investis par entreprise et par joueur, pour que personne ne rafle tout.
// - Entreprise gelée : cotation suspendue. Entreprise fermée : les actionnaires sont remboursés au dernier cours.
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { findOrCreateChannel } = require("./salons");
const { changeBalance, readBalance, isFrozen, formatEuro, addToTreasury } = require("./economie");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon est rangé à côté des annonces
const CHANNEL_NAME = "📈・bourse";
const TICK = 60000; // un relevé par minute : le marché vit en direct
const HISTORY_KEEP = 24 * 60; // 24 h de relevés minute par minute (plus un relevé par heure sur 7 jours)
const FEE = 0.01;
const MAX_PER_COMPANY = 25000; // € investis au maximum par entreprise et par joueur
const MIN_ORDER = 10;
const LIQUIDITY = 60000; // plus il y a d'argent échangé, plus le cours bouge
const MAX_IMPACT = 0.06; // un seul ordre ne fait pas bouger le cours de plus de 6 %
const SIGMA = 0.0036; // hasard à chaque relevé
const STATE_FILE = require("./data").dataFile("bourse-state.json");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
  ["playfair-display-700-italic.ttf", "CardItalic"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}

// --- Données ---
let state = null;
let channelRef = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.stocks ??= {}; // companyId -> { price, fair, lastRev, history: [[t, prix]], listedAt, delisted }
  state.holdings ??= {}; // userId -> { companyId: { qty, cost } }
  state.trades ??= [];
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const companies = () => {
  try {
    return require("./entreprises").listOpenCompanies();
  } catch {
    return [];
  }
};
const tickerOf = (co) => (String(co.name).normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase() + "XXXX").slice(0, 4);
const fairOf = (co) => Math.max(5, 10 + (co.totalRevenue ?? 0) / 1000 + (co.weekRevenue ?? 0) / 200);
const tradable = (co) => co.status === "active";
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
function stockOf(co) {
  const st = load().stocks;
  if (!st[co.id]) {
    // introduction en bourse : au prix de sa juste valeur
    const p = round2(Math.min(500, fairOf(co)));
    st[co.id] = { price: p, fair: p, lastRev: co.totalRevenue ?? 0, history: [[Date.now(), p]], listedAt: Date.now() };
    save();
  }
  return st[co.id];
}
// cours d'il y a 24 h (ou le premier connu)
function dayRef(s) {
  const target = Date.now() - 24 * 3600000;
  let ref = s.history[0]?.[1] ?? s.price;
  for (const [t, p] of s.history) {
    if (t > target) break;
    ref = p;
  }
  return ref;
}
const pct = (a, b) => (b ? ((a - b) / b) * 100 : 0);
const pctText = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2).replace(".", ",")} %`;
const priceText = (p) => `${p.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const qtyText = (q) => q.toLocaleString("fr-FR", { maximumFractionDigits: 4 });

// --- Le marché bouge ---
function tick() {
  const st = load(), now = Date.now();
  const open = companies();
  for (const co of open) {
    const s = stockOf(co);
    s.name = co.name;
    s.delisted = false;
    if (!tradable(co)) continue; // gelée : cotation suspendue
    const fair = fairOf(co);
    s.fair = round2(fair);
    // le chiffre d'affaires du moment fait monter l'action
    const earned = Math.max(0, (co.totalRevenue ?? 0) - (s.lastRev ?? 0));
    s.lastRev = co.totalRevenue ?? 0;
    let p = s.price * (1 + Math.min(0.05, earned / 40000));
    // retour lent vers la juste valeur, et un peu de hasard
    p += (fair - p) * 0.002;
    p *= Math.exp(SIGMA * gauss());
    s.price = round2(Math.max(1, p));
    s.history.push([now, s.price]);
    if (s.history.length > HISTORY_KEEP) s.history.splice(0, s.history.length - HISTORY_KEEP);
    s.hourly ??= [];
    if (!s.hourly.length || now - s.hourly.at(-1)[0] >= 3600000) s.hourly.push([now, s.price]);
    if (s.hourly.length > 7 * 24) s.hourly.splice(0, s.hourly.length - 7 * 24);
  }
  // entreprise fermée : on rembourse les actionnaires au dernier cours
  const ids = new Set(open.map((c) => String(c.id)));
  for (const [id, s] of Object.entries(st.stocks)) {
    if (ids.has(String(id)) || s.delisted) continue;
    s.delisted = true;
    for (const [userId, h] of Object.entries(st.holdings)) {
      const pos = h[id];
      if (!pos?.qty) continue;
      const back = round2(pos.qty * s.price);
      if (back > 0) changeBalance(userId, back, `Bourse : ${s.name ?? id} retirée de la cote (remboursement)`, { force: true });
      delete h[id];
    }
  }
  save();
}

// --- Rumeurs et annonces : de 9 h à 23 h, une nouvelle tombe toutes les 45 min à 2 h ---
// Une rumeur fait bouger le cours tout de suite ; 30 à 90 min plus tard elle est confirmée (le mouvement continue)
// ou démentie (le cours retombe, et un peu plus). Une annonce officielle fait bouger le cours une seule fois.
const NEWS_KEEP = 8;
// [rumeur, version confirmée]
const RUMORS_UP = [
  ["{n} serait sur le point de signer un gros contrat avec la Mairie.", "{n} signe un gros contrat avec la Mairie."],
  ["Un investisseur mystère accumulerait discrètement des parts de {n}.", "Un investisseur mystère détient désormais une grosse part de {n}."],
  ["{n} préparerait l'ouverture d'un deuxième établissement.", "{n} ouvre un deuxième établissement."],
  ["{n} aurait battu son record de clients cette semaine, selon une source proche du dossier.", "{n} bat son record de clients cette semaine."],
  ["{n} serait en discussion pour racheter un concurrent.", "{n} rachète un concurrent."],
  ["Une célébrité de la Maison aurait été aperçue chez {n}… et aurait adoré.", "La célébrité aperçue chez {n} recommande l'adresse à tout le monde."],
];
const RUMORS_DOWN = [
  ["{n} serait visée par un contrôle fiscal de l'IRF.", "L'IRF ouvre bien un contrôle fiscal chez {n}."],
  ["Des clients se plaindraient du service chez {n}.", "Les plaintes contre {n} se multiplient."],
  ["Le patron de {n} aurait passé la nuit au casino… avec la caisse de l'entreprise ?", "Le patron de {n} a bien joué la caisse au casino. Aïe."],
  ["Plusieurs employés de {n} songeraient à démissionner.", "Plusieurs employés de {n} ont démissionné."],
  ["{n} aurait perdu son plus gros client.", "{n} perd son plus gros client."],
  ["Des travaux imprévus pourraient fermer {n} plusieurs jours.", "{n} ferme plusieurs jours pour travaux."],
];
const NEWS_UP = [
  "{n} annonce des résultats au-dessus des attentes.",
  "{n} lance une nouvelle offre très attendue.",
  "{n} décroche le label « Entreprise de la semaine ».",
  "{n} annonce une hausse des salaires : l'équipe est motivée.",
];
const NEWS_DOWN = [
  "{n} annonce une baisse de fréquentation.",
  "{n} ferme exceptionnellement pour inventaire.",
  "{n} doit rembourser plusieurs clients mécontents.",
  "{n} reporte son projet d'agrandissement.",
];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
// le nom dans la phrase, avec les contractions du français (« de Le Bistrot » → « du Bistrot »)
const fill = (t, name) => t.replace("{n}", name).replace(/de Le /g, "du ").replace(/de Les /g, "des ").replace(/à Le /g, "au ").replace(/à Les /g, "aux ").replace(/de ([AEIOUÉÈHaeiouéèh])/g, "d'$1");
const parisHour = () => Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(new Date()));
function moveStock(co, change) {
  const s = stockOf(co);
  s.price = round2(Math.max(1, s.price * (1 + change)));
  s.history.push([Date.now(), s.price]);
  return s.price;
}
function pushNews(item) {
  const st = load();
  st.news = [...(st.news ?? []), item].slice(-NEWS_KEEP);
  save();
  postFlash(item).catch(() => null);
}
// le flash dans le salon : il part tout seul au bout de 40 minutes
async function postFlash(item) {
  if (!channelRef) return;
  const icon = { rumeur: "🤫", annonce: "📢", confirme: "✅", dementi: "❌" }[item.kind];
  const label = { rumeur: "RUMEUR", annonce: "ANNONCE OFFICIELLE", confirme: "RUMEUR CONFIRMÉE", dementi: "RUMEUR DÉMENTIE" }[item.kind];
  const msg = await channelRef
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(item.move >= 0 ? 0x22c55e : 0xef4444)
          .setTitle(`📰 FLASH — ${icon} ${label}`)
          .setDescription(`${item.text}\n\n**${item.ticker}** ${item.move >= 0 ? "📈" : "📉"} **${pctText(item.move * 100)}** → ${priceText(item.price)}`)
          .setFooter({ text: item.kind === "rumeur" ? "Vraie ou fausse ? Réponse dans moins de 2 heures…" : "Bourse de la Maison" })
          .setTimestamp(),
      ],
    })
    .catch(() => null);
  if (msg) require("./nettoyage").deleteLater(msg, 40 * 60000);
}
function newsTick() {
  const st = load(), now = Date.now();
  // rumeurs arrivées à échéance : confirmées ou démenties
  st.rumors ??= [];
  for (const r of [...st.rumors]) {
    if (now < r.resolveAt) continue;
    st.rumors.splice(st.rumors.indexOf(r), 1);
    const co = companies().find((c) => String(c.id) === String(r.id));
    if (!co || !tradable(co)) continue;
    const change = r.truth ? r.dir * (0.04 + Math.random() * 0.06) : -r.dir * (r.jump * 1.2);
    const price = moveStock(co, change);
    pushNews({
      at: now,
      id: co.id,
      ticker: tickerOf(co),
      kind: r.truth ? "confirme" : "dementi",
      text: r.truth ? `C'est officiel : ${r.ok}` : `${co.name} dément la rumeur : « ${r.text} »`,
      move: change,
      price,
    });
  }
  // nouvelle nouvelle : de 9 h à 23 h, quand le moment est venu
  st.nextNewsAt ??= now + (20 + Math.random() * 40) * 60000;
  const h = parisHour();
  if (now < st.nextNewsAt || h < 9 || h >= 23) return save();
  st.nextNewsAt = now + (45 + Math.random() * 75) * 60000;
  const list = companies().filter(tradable);
  if (!list.length) return save();
  const co = list[Math.floor(Math.random() * list.length)], up = Math.random() < 0.55;
  if (Math.random() < 0.6) {
    const [r0, ok0] = pick(up ? RUMORS_UP : RUMORS_DOWN), jump = 0.03 + Math.random() * 0.05, text = fill(r0, co.name);
    const price = moveStock(co, up ? jump : -jump);
    st.rumors.push({ id: co.id, dir: up ? 1 : -1, jump, truth: Math.random() < 0.55, text, ok: fill(ok0, co.name), resolveAt: now + (30 + Math.random() * 60) * 60000 });
    pushNews({ at: now, id: co.id, ticker: tickerOf(co), kind: "rumeur", text, move: up ? jump : -jump, price });
  } else {
    const change = (up ? 1 : -1) * (0.02 + Math.random() * 0.04);
    const price = moveStock(co, change);
    pushNews({ at: now, id: co.id, ticker: tickerOf(co), kind: "annonce", text: fill(pick(up ? NEWS_UP : NEWS_DOWN), co.name), move: change, price });
  }
  save();
}
const newsLine = (n) => `${{ rumeur: "🤫", annonce: "📢", confirme: "✅", dementi: "❌" }[n.kind]} <t:${Math.floor(n.at / 1000)}:R> **${n.ticker}** ${pctText(n.move * 100)} — ${n.text}`;

// --- Ordres ---
function holdingsOf(userId) {
  return (load().holdings[userId] ??= {});
}
function buy(userId, co, amount) {
  if (!tradable(co)) return { error: "⏸️ La cotation de cette entreprise est suspendue." };
  if (isFrozen(userId)) return { error: "🔒 Votre compte est **gelé** par l'IRF : impossible de trader." };
  amount = round2(amount);
  if (!(amount >= MIN_ORDER)) return { error: `❌ Ordre minimum : **${formatEuro(MIN_ORDER)}**.` };
  const h = holdingsOf(userId), pos = h[co.id] ?? { qty: 0, cost: 0 };
  if (pos.cost + amount > MAX_PER_COMPANY)
    return { error: `❌ Plafond : **${formatEuro(MAX_PER_COMPANY)}** investis au maximum par entreprise (vous en êtes à ${formatEuro(pos.cost)}).` };
  if (changeBalance(userId, -amount, `Bourse : achat ${co.name}`) === null) return { error: `❌ Solde insuffisant : il vous faut **${formatEuro(amount)}**.` };
  const s = stockOf(co), fee = round2(amount * FEE), net = amount - fee;
  const pre = s.price, post = pre * (1 + Math.min(MAX_IMPACT, (0.5 * net) / LIQUIDITY)), exec = (pre + post) / 2;
  const qty = round4(net / exec);
  s.price = round2(post);
  s.history.push([Date.now(), s.price]);
  h[co.id] = { qty: round4(pos.qty + qty), cost: round2(pos.cost + amount) };
  addToTreasury("bourseFrais", fee);
  load().trades.push({ at: Date.now(), userId, id: co.id, side: "achat", qty, price: round2(exec), amount });
  load().trades = load().trades.slice(-300);
  save();
  return { qty, exec: round2(exec), fee, price: s.price };
}
function sell(userId, co, qty) {
  if (!tradable(co)) return { error: "⏸️ La cotation de cette entreprise est suspendue : vous pourrez vendre à sa reprise." };
  const h = holdingsOf(userId), pos = h[co.id];
  if (!pos?.qty) return { error: "❌ Vous n'avez pas de parts de cette entreprise." };
  qty = round4(Math.min(pos.qty, qty));
  if (!(qty > 0)) return { error: "❌ Quantité invalide." };
  const s = stockOf(co), pre = s.price, notional = qty * pre;
  const post = pre * (1 - Math.min(MAX_IMPACT, (0.5 * notional) / LIQUIDITY)), exec = (pre + post) / 2;
  const gross = round2(qty * exec), fee = round2(gross * FEE), net = round2(gross - fee);
  const costPart = round2((pos.cost * qty) / pos.qty);
  changeBalance(userId, net, `Bourse : vente ${co.name}`, { force: true });
  addToTreasury("bourseFrais", fee);
  s.price = round2(Math.max(1, post));
  s.history.push([Date.now(), s.price]);
  const left = round4(pos.qty - qty);
  if (left <= 0.0001) delete h[co.id];
  else h[co.id] = { qty: left, cost: round2(pos.cost - costPart) };
  load().trades.push({ at: Date.now(), userId, id: co.id, side: "vente", qty, price: round2(exec), amount: net });
  load().trades = load().trades.slice(-300);
  save();
  return { qty, exec: round2(exec), fee, net, gain: round2(net - costPart), price: s.price };
}

// --- Images ---
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const UP = "#22c55e", DOWN = "#ef4444";
// petite flèche dessinée (les caractères ▲▼ n'existent pas dans les polices du bot)
function arrow(ctx, x, y, up, col, s = 6) {
  ctx.fillStyle = col;
  ctx.beginPath();
  if (up) {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y + s * 0.6);
    ctx.lineTo(x - s, y + s * 0.6);
  } else {
    ctx.moveTo(x, y + s);
    ctx.lineTo(x + s, y - s * 0.6);
    ctx.lineTo(x - s, y - s * 0.6);
  }
  ctx.closePath();
  ctx.fill();
}
function sparkline(ctx, pts, x, y, w, h, col, fill = true) {
  if (pts.length < 2) return;
  let lo = Math.min(...pts), hi = Math.max(...pts);
  if (hi - lo < 1e-6) (hi += 1), (lo -= 1);
  const X = (i) => x + (i / (pts.length - 1)) * w, Y = (v) => y + h - ((v - lo) / (hi - lo)) * h;
  if (fill) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, col + "55");
    g.addColorStop(1, col + "00");
    ctx.beginPath();
    ctx.moveTo(X(0), y + h);
    pts.forEach((v, i) => ctx.lineTo(X(i), Y(v)));
    ctx.lineTo(X(pts.length - 1), y + h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.beginPath();
  pts.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(X(pts.length - 1), Y(pts.at(-1)), 4, 0, Math.PI * 2);
  ctx.fill();
}
function background(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#07111f");
  g.addColorStop(1, "#0b1a10");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // quadrillage de salle des marchés
  ctx.strokeStyle = "rgba(148,163,184,0.06)";
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y < H; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}
const COLORS = ["#f59e0b", "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#fb7185", "#facc15", "#60a5fa", "#c084fc", "#2dd4bf"];
function tickerBadge(ctx, x, y, r, text, i) {
  const col = COLORS[i % COLORS.length];
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "#0f172a");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `${Math.round(r * 0.62)}px CardBold`;
  ctx.textAlign = "center";
  ctx.fillText(text.slice(0, 4), x, y + r * 0.22);
}
// le tableau des cours (salon)
function drawBoard() {
  const list = companies().map((co) => ({ co, s: stockOf(co) }));
  const W = 1200, rowH = 86, H = 250 + Math.max(1, list.length) * rowH + 70;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  background(ctx, W, H);
  // bandeau défilant façon téléscripteur
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, 40);
  ctx.font = "15px CardBold";
  ctx.textAlign = "left";
  let tx = 20;
  for (const { co, s } of list) {
    const ch = pct(s.price, dayRef(s));
    const a = `${tickerOf(co)} ${priceText(s.price)}`, b = pctText(ch);
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(a, tx, 26);
    tx += ctx.measureText(a).width + 16;
    arrow(ctx, tx, 21, ch >= 0, ch >= 0 ? UP : DOWN, 5);
    ctx.fillStyle = ch >= 0 ? UP : DOWN;
    ctx.fillText(b, tx + 12, 26);
    tx += ctx.measureText(b).width + 52;
    if (tx > W) break;
  }
  ctx.textAlign = "center";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#facc15";
  ctx.fillText("L E S   M A R C H É S   D E   L A   M A I S O N", W / 2, 88);
  ctx.font = "60px CardTitle";
  const tg = ctx.createLinearGradient(0, 100, 0, 160);
  tg.addColorStop(0, "#fef9c3");
  tg.addColorStop(1, "#eab308");
  ctx.fillStyle = tg;
  ctx.fillText("Bourse de la Maison", W / 2, 150);
  ctx.font = "17px CardItalic";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Cours en direct, mis à jour chaque minute · frais ${Math.round(FEE * 100)} % · ${formatEuro(MAX_PER_COMPANY)} max. par entreprise`, W / 2, 182);
  // en-têtes
  const y0 = 230;
  ctx.font = "12px CardEngrave";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "left";
  ctx.fillText("ENTREPRISE", 60, y0 - 10);
  ctx.fillText("24 HEURES", 560, y0 - 10);
  ctx.textAlign = "right";
  ctx.fillText("COURS", 1010, y0 - 10);
  ctx.fillText("VARIATION", 1150, y0 - 10);
  if (!list.length) {
    ctx.textAlign = "center";
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("Aucune entreprise cotée pour le moment", W / 2, y0 + 50);
  }
  list.forEach(({ co, s }, i) => {
    const y = y0 + i * rowH, ref = dayRef(s), ch = pct(s.price, ref), col = ch >= 0 ? UP : DOWN, frozen = !tradable(co);
    rr(ctx, 40, y, W - 80, rowH - 12, 16);
    ctx.fillStyle = i % 2 ? "rgba(15,23,42,0.75)" : "rgba(30,41,59,0.6)";
    ctx.fill();
    ctx.strokeStyle = "rgba(148,163,184,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    tickerBadge(ctx, 90, y + (rowH - 12) / 2, 26, tickerOf(co), i);
    ctx.textAlign = "left";
    ctx.font = "22px CardBold";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(String(co.name).slice(0, 28), 130, y + 32);
    ctx.font = "13px CardText";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(`${tickerOf(co)} · CA ${formatEuro(co.totalRevenue ?? 0)}${frozen ? " · COTATION SUSPENDUE" : ""}`, 130, y + 54);
    const day = s.history.filter(([t]) => t >= Date.now() - 24 * 3600000).map(([, p]) => p);
    sparkline(ctx, day.length > 1 ? day : [ref, s.price], 560, y + 12, 300, rowH - 36, frozen ? "#64748b" : col);
    ctx.textAlign = "right";
    ctx.font = "26px CardTitle";
    ctx.fillStyle = "#f8fafc";
    ctx.fillText(priceText(s.price), 1010, y + 46);
    rr(ctx, 1030, y + 22, 120, 32, 10);
    ctx.fillStyle = frozen ? "rgba(100,116,139,0.3)" : col + "33";
    ctx.fill();
    ctx.font = "16px CardBold";
    ctx.fillStyle = frozen ? "#94a3b8" : col;
    ctx.textAlign = "center";
    if (frozen) ctx.fillText("SUSPENDUE", 1090, y + 44);
    else {
      ctx.fillText(pctText(ch), 1098, y + 44);
      arrow(ctx, 1098 - ctx.measureText(pctText(ch)).width / 2 - 12, y + 38, ch >= 0, col, 5);
    }
  });
  ctx.textAlign = "center";
  ctx.font = "14px CardItalic";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Les cours suivent le vrai chiffre d'affaires des entreprises. Investir comporte un risque de perte.", W / 2, H - 30);
  return c;
}
// graphique 7 jours d'une entreprise
function drawChart(co) {
  const s = stockOf(co), W = 1000, H = 520;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  background(ctx, W, H);
  // 7 jours : un point par heure, puis la dernière heure minute par minute
  const lastHour = s.history.filter(([t]) => t > Date.now() - 3600000);
  const pts = [...(s.hourly ?? []).filter(([t]) => t <= Date.now() - 3600000), ...lastHour].map(([, p]) => p);
  const ref = pts[0] ?? s.price, ch = pct(s.price, ref), col = ch >= 0 ? UP : DOWN;
  tickerBadge(ctx, 64, 62, 30, tickerOf(co), 0);
  ctx.textAlign = "left";
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#f8fafc";
  ctx.fillText(String(co.name).slice(0, 30), 110, 60);
  ctx.font = "15px CardText";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`${tickerOf(co)} · cotée depuis le ${new Date(s.listedAt).toLocaleDateString("fr-FR")} · juste valeur ${priceText(s.fair ?? s.price)}`, 110, 86);
  ctx.textAlign = "right";
  ctx.font = "40px CardTitle";
  ctx.fillText(priceText(s.price), W - 40, 62);
  ctx.font = "18px CardBold";
  ctx.fillStyle = col;
  const per = `${pctText(ch)} sur la période`;
  ctx.fillText(per, W - 40, 90);
  arrow(ctx, W - 40 - ctx.measureText(per).width - 12, 84, ch >= 0, col, 6);
  // repères de prix
  const lo = Math.min(...pts, s.price), hi = Math.max(...pts, s.price);
  ctx.font = "13px CardText";
  ctx.fillStyle = "#64748b";
  for (let k = 0; k <= 4; k++) {
    const v = lo + ((hi - lo) * k) / 4, y = 470 - (k / 4) * 330;
    ctx.strokeStyle = "rgba(148,163,184,0.12)";
    ctx.beginPath();
    ctx.moveTo(60, y);
    ctx.lineTo(W - 40, y);
    ctx.stroke();
    ctx.textAlign = "right";
    ctx.fillText(priceText(v), 56, y + 4);
  }
  sparkline(ctx, pts.length > 1 ? pts : [s.price, s.price], 64, 140, W - 110, 330, col);
  ctx.textAlign = "center";
  ctx.font = "13px CardItalic";
  ctx.fillStyle = "#64748b";
  ctx.fillText("7 derniers jours", W / 2, 500);
  return c;
}

// --- Messages ---
const navRow = () =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("bourse_trade").setLabel("Trader").setEmoji("📈").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId("bourse_me").setLabel("Mon portefeuille").setEmoji("💼").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId("bourse_chart").setLabel("Graphique").setEmoji("📊").setStyle(ButtonStyle.Secondary)
  );
async function boardPayload() {
  const list = companies().map((co) => ({ co, s: stockOf(co) }));
  const moves = list.filter(({ co }) => tradable(co)).map(({ co, s }) => ({ co, ch: pct(s.price, dayRef(s)) }));
  const best = [...moves].sort((a, b) => b.ch - a.ch)[0], worst = [...moves].sort((a, b) => a.ch - b.ch)[0];
  const buf = await drawBoard().encode("jpeg", 88);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xeab308)
        .setTitle("📈 Bourse de la Maison")
        .setDescription(
          "Achetez des **parts des entreprises** de la Maison et revendez-les quand vous voulez. Le cours suit leur **vrai chiffre d'affaires** : plus elles servent de clients, plus l'action monte.\n" +
            "Cliquez sur **Trader** : un bureau de trading s'ouvre, et chaque bouton achète ou vend **en un clic**.\n" +
            (best && moves.length > 1 ? `\n🚀 Plus forte hausse : **${best.co.name}** (${pctText(best.ch)}) · 🩸 plus forte baisse : **${worst.co.name}** (${pctText(worst.ch)})` : "")
        )
        .addFields(...((load().news ?? []).length ? [{ name: "📰 Dernières nouvelles", value: [...load().news].reverse().slice(0, 4).map(newsLine).join("\n").slice(0, 1024) }] : []))
        .setImage("attachment://bourse.jpg")
        .setFooter({ text: `Cours en direct (chaque minute) · frais de ${Math.round(FEE * 100)} % par ordre · ${MAX_PER_COMPANY.toLocaleString("fr-FR")} € investis au maximum par entreprise` })
        .setTimestamp(),
    ],
    files: [new AttachmentBuilder(buf, { name: "bourse.jpg" })],
    components: [navRow()],
  };
}
// courbe en caractères (instantanée, sans image)
const BARS = "▁▂▃▄▅▆▇█";
function textSpark(points, n = 32) {
  if (points.length < 2) return BARS[3].repeat(n);
  const step = Math.max(1, Math.floor(points.length / n)), pts = [];
  for (let i = Math.max(0, points.length - step * n); i < points.length; i += step) pts.push(points[i]);
  const lo = Math.min(...pts), hi = Math.max(...pts);
  return pts.map((v) => BARS[hi - lo < 1e-9 ? 3 : Math.round(((v - lo) / (hi - lo)) * 7)]).join("");
}
function positionLine(userId, co, s) {
  const pos = holdingsOf(userId)[co.id];
  if (!pos?.qty) return "💼 Vous n'avez **aucune part** de cette entreprise.";
  const v = round2(pos.qty * s.price), g = round2(v - pos.cost);
  return `💼 **${qtyText(pos.qty)} part${pos.qty >= 2 ? "s" : ""}** · valeur **${formatEuro(v)}** · ${g >= 0 ? "🟢 +" : "🔴 "}${formatEuro(g)} (${pctText(pct(v, pos.cost))})`;
}
// le bureau de trading d'une entreprise : tout se fait en un clic, le même message se met à jour
function deskPayload(userId, co, note = "") {
  const s = stockOf(co), ref = dayRef(s), ch = pct(s.price, ref), last2h = s.history.filter(([t]) => t > Date.now() - 2 * 3600000).map(([, p]) => p);
  const live = tradable(co), pos = holdingsOf(userId)[co.id], cid = co.id;
  const embed = new EmbedBuilder()
    .setColor(!live ? 0x64748b : ch >= 0 ? 0x22c55e : 0xef4444)
    .setTitle(`${ch >= 0 ? "📈" : "📉"} ${tickerOf(co)} · ${co.name} — ${priceText(s.price)}`.slice(0, 256))
    .setDescription(
      (note ? `${note}\n\n` : "") +
        `${ch >= 0 ? "🟢" : "🔴"} **${pctText(ch)}** sur 24 h · juste valeur ${priceText(s.fair ?? s.price)}${live ? "" : " · ⏸️ **cotation suspendue**"}\n` +
        `\`${textSpark(last2h.length > 1 ? last2h : [ref, s.price])}\` *2 dernières heures*\n` +
        (load().news ?? []).filter((n) => String(n.id) === String(co.id) && n.at > Date.now() - 6 * 3600000).slice(-2).map((n) => `\n${newsLine(n)}`).join("") +
        "\n\n" +
        `${positionLine(userId, co, s)}\n💶 Liquidités : **${formatEuro(readBalance(userId) ?? 0)}**`
    )
    .setFooter({ text: `Cours en direct · frais ${Math.round(FEE * 100)} % · ${MAX_PER_COMPANY.toLocaleString("fr-FR")} € max. investis par entreprise · 🔄 pour le dernier cours` });
  const buyRow = new ActionRowBuilder().addComponents(
    ...[100, 500, 1000, 5000].map((a) => new ButtonBuilder().setCustomId(`bourse_q_b_${cid}_${a}`).setLabel(`+${a.toLocaleString("fr-FR")} €`).setStyle(ButtonStyle.Success).setDisabled(!live)),
    new ButtonBuilder().setCustomId(`bourse_q_bm_${cid}`).setLabel("Montant…").setEmoji("📈").setStyle(ButtonStyle.Success).setDisabled(!live)
  );
  const sellRow = new ActionRowBuilder().addComponents(
    ...[25, 50, 100].map((p) => new ButtonBuilder().setCustomId(`bourse_q_s_${cid}_${p}`).setLabel(p === 100 ? "Tout vendre" : `Vendre ${p} %`).setStyle(ButtonStyle.Danger).setDisabled(!live || !pos?.qty)),
    new ButtonBuilder().setCustomId(`bourse_q_sm_${cid}`).setLabel("Quantité…").setEmoji("📉").setStyle(ButtonStyle.Danger).setDisabled(!live || !pos?.qty)
  );
  const toolRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bourse_q_r_${cid}`).setLabel("Actualiser").setEmoji("🔄").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`bourse_q_g_${cid}`).setLabel("Graphique 7 jours").setEmoji("📊").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("bourse_trade").setLabel("Autre entreprise").setEmoji("↩️").setStyle(ButtonStyle.Secondary)
  );
  return { content: null, embeds: [embed], components: [buyRow, sellRow, toolRow], files: [], attachments: [] };
}
function portfolioPayload(userId) {
  const h = holdingsOf(userId), byId = new Map(companies().map((co) => [String(co.id), co]));
  let value = 0, cost = 0;
  const lines = [], mine = [];
  for (const [id, pos] of Object.entries(h)) {
    const s = load().stocks[id], co = byId.get(String(id));
    if (!s) continue;
    const v = round2(pos.qty * s.price), g = round2(v - pos.cost);
    value += v;
    cost += pos.cost;
    lines.push(`**${co?.name ?? s.name ?? id}** — ${qtyText(pos.qty)} part${pos.qty >= 2 ? "s" : ""} × ${priceText(s.price)} = **${formatEuro(v)}** (${g >= 0 ? "🟢 +" : "🔴 "}${formatEuro(g)}, ${pctText(pct(v, pos.cost))})`);
    if (co) mine.push({ co, s, extra: `${qtyText(pos.qty)} part(s)` });
  }
  const g = round2(value - cost);
  const embed = new EmbedBuilder()
    .setColor(g >= 0 ? 0x22c55e : 0xef4444)
    .setTitle("💼 Mon portefeuille")
    .setDescription(
      (lines.join("\n") || "*Vous n'avez encore aucune action. Cliquez sur **Trader** pour investir.*") +
        `\n\n💶 Liquidités : **${formatEuro(readBalance(userId) ?? 0)}**` +
        (lines.length ? `\n📊 Valeur des actions : **${formatEuro(round2(value))}** · investi : ${formatEuro(round2(cost))} · ${g >= 0 ? "plus-value" : "moins-value"} : **${g >= 0 ? "+" : ""}${formatEuro(g)}**` : "")
    );
  const rows = [];
  if (mine.length) rows.push(companySelect("bourse_tradesel", "Ouvrir le bureau d'une de mes actions…", mine));
  rows.push(navRow());
  return { content: null, embeds: [embed], components: rows, files: [], attachments: [] };
}
function companySelect(customId, placeholder, list) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder(placeholder)
      .addOptions(
        list.slice(0, 25).map(({ co, s, extra }) => ({
          label: `${co.name}`.slice(0, 100),
          value: String(co.id),
          description: `${tickerOf(co)} · ${priceText(s.price)} · ${pctText(pct(s.price, dayRef(s)))}${extra ? ` · ${extra}` : ""}`.slice(0, 100),
        }))
      )
  );
}

async function refreshBoard() {
  if (!channelRef) return;
  const st = load(), payload = await boardPayload();
  let msg = st.boardId ? await channelRef.messages.fetch(st.boardId).catch(() => null) : null;
  if (msg && (await msg.edit({ ...payload, attachments: [] }).catch(() => null))) return;
  await msg?.delete().catch(() => null);
  msg = await channelRef.send(payload).catch(() => null);
  if (msg) {
    st.boardId = msg.id;
    save();
  }
}

async function setupBourse(client) {
  const st = load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: st.channelId,
    name: CHANNEL_NAME,
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  if (st.channelId !== channelRef.id) {
    st.channelId = channelRef.id;
    st.boardId = null;
    save();
  }
  tick();
  await refreshBoard().catch((err) => console.error("Bourse (tableau):", err.message));
  setInterval(() => {
    try {
      tick();
    } catch (err) {
      console.error("Bourse (cotation):", err.message);
    }
    try {
      newsTick();
    } catch (err) {
      console.error("Bourse (rumeurs):", err.message);
    }
    refreshBoard().catch((err) => console.error("Bourse (tableau):", err.message));
  }, TICK).unref?.();
}

async function handleBourseInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "bourse";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("bourse_"))) return false;
  const userId = interaction.user.id;
  const findCo = (cid) => companies().find((c) => String(c.id) === String(cid)) ?? null;
  // depuis un message privé : on le met à jour ; depuis le salon : nouvelle réponse privée
  const fromPrivate = Boolean(interaction.message?.flags?.has?.(64));
  const show = (payload) => {
    if (fromPrivate) return interaction.update(payload);
    const { attachments, ...rest } = payload;
    void attachments;
    return interaction.reply({ ...rest, ephemeral: true });
  };
  if (isCmd) {
    const { attachments, ...p } = portfolioPayload(userId);
    void attachments;
    await interaction.reply({ ...p, ephemeral: true });
    return true;
  }
  if (id === "bourse_me") {
    await show(portfolioPayload(userId));
    return true;
  }
  if (id === "bourse_trade" || id === "bourse_chart") {
    const list = companies().map((co) => ({ co, s: stockOf(co) }));
    if (!list.length) {
      await show({ content: "Aucune entreprise n'est cotée pour le moment.", embeds: [], components: [] });
      return true;
    }
    await show({
      content: id === "bourse_trade" ? `📈 Quelle entreprise voulez-vous trader ? (vous avez **${formatEuro(readBalance(userId) ?? 0)}**)` : "📊 Le graphique de quelle entreprise ?",
      embeds: [],
      files: [],
      attachments: [],
      components: [companySelect(id === "bourse_trade" ? "bourse_tradesel" : "bourse_chartsel", "Choisir une entreprise…", list)],
    });
    return true;
  }
  if (id === "bourse_tradesel") {
    const co = findCo(interaction.values[0]);
    await show(co ? deskPayload(userId, co) : { content: "❌ Entreprise introuvable.", embeds: [], components: [navRow()] });
    return true;
  }
  if (id === "bourse_chartsel") {
    const co = findCo(interaction.values[0]);
    if (!co) {
      await show({ content: "❌ Entreprise introuvable.", embeds: [], components: [navRow()] });
      return true;
    }
    await interaction.deferUpdate();
    const buf = await drawChart(co).encode("jpeg", 88);
    await interaction.editReply({ content: null, embeds: [], files: [new AttachmentBuilder(buf, { name: "graphique.jpg" })], components: [navRow()] });
    return true;
  }
  const q = /^bourse_q_(bm|sm|b|s|r|g)_(.+?)(?:_(\d+))?$/.exec(id);
  if (q) {
    const [, kind, cid, n] = q, co = findCo(cid);
    if (!co) {
      await show({ content: "❌ Cette entreprise n'est plus cotée.", embeds: [], components: [navRow()] });
      return true;
    }
    if (kind === "r") {
      await show(deskPayload(userId, co));
      return true;
    }
    if (kind === "g") {
      await interaction.deferReply({ ephemeral: true });
      const buf = await drawChart(co).encode("jpeg", 88);
      await interaction.editReply({ files: [new AttachmentBuilder(buf, { name: "graphique.jpg" })] });
      return true;
    }
    if (kind === "bm" || kind === "sm") {
      const buying = kind === "bm", s = stockOf(co), pos = holdingsOf(userId)[co.id];
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`bourse_m_${buying ? "b" : "s"}_${co.id}`)
          .setTitle(`${buying ? "Acheter" : "Vendre"} : ${co.name}`.slice(0, 45))
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("v")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(12)
                .setLabel(buying ? "Montant à investir (€)" : "Nombre de parts (ou « tout »)")
                .setPlaceholder(buying ? `Cours : ${priceText(s.price)} · frais 1 %` : `Vous avez ${qtyText(pos?.qty ?? 0)} part(s)`)
            )
          )
      );
      return true;
    }
    // achat ou vente en un clic : le bureau se met à jour aussitôt
    let note;
    if (kind === "b") {
      const r = buy(userId, co, Number(n));
      note = r.error ?? `✅ **+${qtyText(r.qty)} part(s)** achetées à ${priceText(r.exec)} (frais ${formatEuro(r.fee)}).`;
    } else {
      const pos = holdingsOf(userId)[co.id];
      const r = sell(userId, co, pos ? (pos.qty * Number(n)) / 100 : 0);
      note = r.error ?? `✅ **${qtyText(r.qty)} part(s)** vendues à ${priceText(r.exec)} : **+${formatEuro(r.net)}** (${r.gain >= 0 ? `🟢 +${formatEuro(r.gain)}` : `🔴 ${formatEuro(r.gain)}`}).`;
    }
    await show(deskPayload(userId, co, note));
    boardSoon();
    return true;
  }
  const m = /^bourse_m_(b|s)_(.+)$/.exec(id);
  if (m && interaction.isModalSubmit?.()) {
    const co = findCo(m[2]);
    const reply = (payload) => (interaction.isFromMessage?.() ? interaction.update(payload) : interaction.reply({ ...payload, attachments: undefined, ephemeral: true }));
    if (!co) {
      await reply({ content: "❌ Cette entreprise n'est plus cotée.", embeds: [], components: [] });
      return true;
    }
    const raw = interaction.fields.getTextInputValue("v").trim().toLowerCase().replace(/\s/g, "").replace(",", ".").replace("€", "");
    let note;
    if (m[1] === "b") {
      const r = buy(userId, co, Number(raw));
      note = r.error ?? `✅ **+${qtyText(r.qty)} part(s)** achetées à ${priceText(r.exec)} (frais ${formatEuro(r.fee)}).`;
    } else {
      const pos = holdingsOf(userId)[co.id];
      const r = sell(userId, co, raw === "tout" || raw === "all" ? pos?.qty ?? 0 : Number(raw));
      note = r.error ?? `✅ **${qtyText(r.qty)} part(s)** vendues à ${priceText(r.exec)} : **+${formatEuro(r.net)}** (${r.gain >= 0 ? `🟢 +${formatEuro(r.gain)}` : `🔴 ${formatEuro(r.gain)}`}).`;
    }
    await reply(deskPayload(userId, co, note));
    boardSoon();
    return true;
  }
  return false;
}
// après des ordres, le tableau du salon suit (au plus une fois toutes les 20 s)
let boardTimer = null;
function boardSoon() {
  if (boardTimer) return;
  boardTimer = setTimeout(() => {
    boardTimer = null;
    refreshBoard().catch(() => null);
  }, 20000);
  boardTimer.unref?.();
}

module.exports = { setupBourse, handleBourseInteraction, drawBoard, drawChart, buy, sell, tick, newsTick, deskPayload, portfolioPayload, boardPayload };
