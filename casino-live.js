// Casino en direct : roulette publique, Crash (la fusée de la Maison), courses de chevaux,
// roue de la fortune gratuite, niveaux VIP, cashback et classement des gros gains.
// Toutes les mises passent par les règles du casino (accès, horaires, gel IRF, plafond, lois).
const fs = require("fs");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, ChannelType } = require("discord.js");
const { formatEuro, readBalance, changeBalance } = require("./economie");
const { dataFile } = require("./data");
const { deleteLater, MINUTE, HOUR } = require("./nettoyage");
const { pseudo } = require("./noms");
const V = require("./casino-visuels");
const C = () => require("./casino");

const STATE_FILE = dataFile("casino-live-state.json");
let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.stats ??= {}; // userId -> { wagered, won, games, best, week: { key, wagered, won } }
  state.wheel ??= {}; // userId -> jour de la dernière roue
  state.escrow ??= {}; // mises des jeux en direct en cours (remboursées si le bot redémarre)
  state.channels ??= {};
  state.boards ??= {};
  state.crashHistory ??= [];
  state.weekBest ??= { key: null, list: [] };
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const round2 = (n) => Math.round(n * 100) / 100;
const parisDay = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
function weekKey() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// --- Statistiques, VIP, cashback ---
const VIP = [
  { name: "Bronze", emoji: "🥉", min: 0, wheel: 1, cashback: 0 },
  { name: "Argent", emoji: "🥈", min: 5000, wheel: 1.2, cashback: 0.02 },
  { name: "Or", emoji: "🥇", min: 25000, wheel: 1.5, cashback: 0.03 },
  { name: "Platine", emoji: "💠", min: 100000, wheel: 2, cashback: 0.05 },
  { name: "Diamant", emoji: "💎", min: 300000, wheel: 3, cashback: 0.07 },
];
const CASHBACK_MAX = 1000;
function statsOf(userId) {
  const st = load();
  const s = (st.stats[userId] ??= { wagered: 0, won: 0, games: 0, best: 0, week: { key: weekKey(), wagered: 0, won: 0 } });
  if (s.week?.key !== weekKey()) s.week = { key: weekKey(), wagered: 0, won: 0, lastWeek: s.week };
  return s;
}
const vipOf = (userId) => [...VIP].reverse().find((v) => statsOf(userId).wagered >= v.min);
function recordBet(userId, amount) {
  const s = statsOf(userId);
  s.wagered = round2(s.wagered + amount);
  s.week.wagered = round2(s.week.wagered + amount);
  s.games++;
  save();
}
function recordWin(userId, amount, game) {
  if (amount <= 0) return;
  const s = statsOf(userId), st = load();
  s.won = round2(s.won + amount);
  s.week.won = round2(s.week.won + amount);
  s.best = Math.max(s.best, amount);
  if (st.weekBest.key !== weekKey()) st.weekBest = { key: weekKey(), list: [] };
  st.weekBest.list.push({ userId, amount, game, at: Date.now() });
  st.weekBest.list = st.weekBest.list.sort((a, b) => b.amount - a.amount).slice(0, 5);
  save();
}
function weekBestLines() {
  const st = load();
  if (st.weekBest.key !== weekKey() || !st.weekBest.list.length) return "*Aucun gros gain cette semaine… pour l'instant.*";
  return st.weekBest.list.map((w, i) => `${["🥇", "🥈", "🥉"][i] ?? "▫️"} **${pseudo(w.userId)}** — ${formatEuro(w.amount)} *(${w.game})*`).join("\n");
}
// cashback : une part des pertes nettes de la semaine précédente, versée une fois
function claimCashback(userId) {
  const s = statsOf(userId), last = s.week.lastWeek, vip = VIP.slice().reverse().find((v) => s.wagered >= v.min);
  if (!last || last.cashbackPaid || !vip.cashback) return 0;
  const loss = round2(last.wagered - last.won);
  last.cashbackPaid = true;
  save();
  if (loss <= 0) return 0;
  const amount = Math.min(CASHBACK_MAX, round2(loss * vip.cashback));
  return C().pay(userId, amount, "cashback VIP");
}
function vipPayload(userId) {
  const s = statsOf(userId), vip = vipOf(userId), next = VIP[VIP.indexOf(vip) + 1];
  const pct = next ? Math.min(1, (s.wagered - vip.min) / (next.min - vip.min)) : 1;
  const bar = "▰".repeat(Math.round(pct * 12)) + "▱".repeat(12 - Math.round(pct * 12));
  const last = s.week.lastWeek, lossLast = last ? round2(last.wagered - last.won) : 0;
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0xd4af37)
        .setTitle(`${vip.emoji} Votre fiche VIP — ${vip.name}`)
        .setDescription(
          `${bar} ${next ? `**${formatEuro(s.wagered)}** / ${formatEuro(next.min)} misés pour passer **${next.emoji} ${next.name}**` : "**Niveau maximum atteint !**"}\n\n` +
            `🎡 Roue de la fortune : gains **×${vip.wheel}**\n💸 Cashback : **${Math.round(vip.cashback * 100)} %** des pertes nettes de la semaine précédente (max ${formatEuro(CASHBACK_MAX)})`
        )
        .addFields(
          { name: "Cette semaine", value: `Misé : **${formatEuro(s.week.wagered)}**\nGagné : **${formatEuro(s.week.won)}**`, inline: true },
          { name: "Depuis toujours", value: `Misé : **${formatEuro(s.wagered)}**\nGagné : **${formatEuro(s.won)}**\nParties : **${s.games}** · record : **${formatEuro(s.best)}**`, inline: true },
          { name: "Niveaux", value: VIP.map((v) => `${v.emoji} ${v.name} — dès ${formatEuro(v.min)} misés`).join("\n") }
        )
        .setFooter({ text: "Le casino garde toujours un avantage : jouez pour le plaisir." }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("casino_x_cashback")
          .setLabel(last && !last.cashbackPaid && vip.cashback && lossLast > 0 ? `Récupérer mon cashback (${formatEuro(Math.min(CASHBACK_MAX, round2(lossLast * vip.cashback)))})` : "Pas de cashback à récupérer")
          .setEmoji("💸")
          .setStyle(ButtonStyle.Success)
          .setDisabled(!(last && !last.cashbackPaid && vip.cashback && lossLast > 0))
      ),
    ],
  };
}

// --- Roue de la fortune (gratuite, une fois par jour) ---
const WHEEL = [
  { label: "10 €", amount: 10, weight: 30, color: "#059669" },
  { label: "25 €", amount: 25, weight: 24, color: "#2563eb" },
  { label: "50 €", amount: 50, weight: 18, color: "#7c3aed" },
  { label: "75 €", amount: 75, weight: 10, color: "#0891b2" },
  { label: "100 €", amount: 100, weight: 8, color: "#db2777" },
  { label: "200 €", amount: 200, weight: 5, color: "#dc2626" },
  { label: "500 €", amount: 500, weight: 3, color: "#d97706" },
  { label: "JACKPOT", jackpot: 0.05, weight: 1, color: "#a16207" },
];
async function spinWheel(interaction) {
  const userId = interaction.user.id, st = load();
  if (st.wheel[userId] === parisDay()) {
    await interaction.reply({ content: "🎡 Vous avez déjà tourné la roue aujourd'hui. Revenez demain !", ephemeral: true });
    return;
  }
  st.wheel[userId] = parisDay();
  save();
  await interaction.deferReply({ ephemeral: true });
  const total = WHEEL.reduce((a, w) => a + w.weight, 0);
  let r = Math.random() * total, index = 0;
  for (const [i, w] of WHEEL.entries()) if ((r -= w.weight) < 0) (index = i), (r = Infinity);
  const prize = WHEEL[index], vip = vipOf(userId);
  let amount = prize.amount ?? 0;
  if (prize.jackpot) {
    const cs = C().loadState();
    amount = round2(cs.jackpot * prize.jackpot);
    cs.jackpot = round2(cs.jackpot - amount);
    C().saveState(cs);
  }
  amount = round2(amount * vip.wheel);
  const paid = C().pay(userId, amount, "roue de la fortune");
  const gif = await V.fortuneWheelGif(WHEEL.map((w) => ({ label: w.label, color: w.color })), index);
  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("🎡 Roue de la fortune")
        .setDescription(`La roue s'arrête sur **${prize.label}**${vip.wheel > 1 ? ` · bonus VIP ${vip.emoji} ×${vip.wheel}` : ""} : **+${formatEuro(paid)}** !${paid < amount ? C().capNote(amount, paid) : ""}\nNouveau solde : **${formatEuro(readBalance(userId))}**\n\n*Revenez demain pour un nouveau tour gratuit.*`)
        .setImage("attachment://roue.gif"),
    ],
    files: [new AttachmentBuilder(gif, { name: "roue.gif" })],
  });
}

// --- Salons des jeux en direct ---
const LIVE = {
  roulette: { name: "🎡・roulette-live", topic: "🎡 Roulette en direct : tout le monde mise pendant le compte à rebours, puis la roue tourne pour tous." },
  crash: { name: "🚀・crash", topic: "🚀 La fusée de la Maison : le multiplicateur monte… encaissez avant qu'elle explose !" },
  courses: { name: "🏇・courses", topic: "🏇 Grand Prix de la Maison : misez sur un cheval, la course est en direct." },
};
const live = { roulette: null, crash: null, courses: null }; // manche en cours, par jeu
let clientRef = null;
const chanOf = (key) => clientRef?.channels.cache.get(load().channels[key]) ?? null;

async function setupChannels(client) {
  const casino = await client.channels.fetch(C().CASINO_CHANNEL_ID).catch(() => null);
  if (!casino?.guild) return;
  const st = load();
  const overwrites = [...casino.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));
  for (const [key, def] of Object.entries(LIVE)) {
    let ch = st.channels[key] ? await client.channels.fetch(st.channels[key]).catch(() => null) : null;
    if (!ch) {
      ch = await casino.guild.channels.create({ name: def.name, type: ChannelType.GuildText, parent: casino.parentId ?? undefined, topic: def.topic, permissionOverwrites: overwrites }).catch((err) => {
        console.error("Salon du casino en direct:", err.message);
        return null;
      });
    }
    if (!ch) continue;
    st.channels[key] = ch.id;
  }
  save();
}
// mise d'un jeu en direct : règles du casino, puis mise bloquée tant que la manche n'est pas finie
function liveBet(interaction, amount, game, key) {
  const err = C().playError(interaction.member) ?? C().takeBet(interaction.user.id, amount, game);
  if (err) return err;
  const st = load();
  (st.escrow[key] ??= []).push({ userId: interaction.user.id, amount });
  save();
  return null;
}
function settleEscrow(key) {
  delete load().escrow[key];
  save();
}
async function refundEscrow(client) {
  const st = load();
  for (const [key, items] of Object.entries(st.escrow)) {
    for (const x of items) {
      changeBalance(x.userId, x.amount, "Casino — mise remboursée (redémarrage du bot)", { force: true });
      client.users
        .fetch(x.userId)
        .then((u) => u.send(`🎰 Le casino a redémarré pendant une manche en direct : votre mise de **${formatEuro(x.amount)}** vous a été remboursée.`))
        .catch(() => null);
    }
    delete st.escrow[key];
  }
  save();
}
async function upsertBoard(key, payload) {
  const ch = chanOf(key);
  if (!ch) return null;
  const st = load();
  let msg = st.boards[key] ? await ch.messages.fetch(st.boards[key]).catch(() => null) : null;
  if (msg) {
    const ok = await msg.edit({ attachments: [], ...payload }).catch(() => null);
    if (ok) return msg;
    await msg.delete().catch(() => null);
  }
  msg = await ch.send(payload).catch(() => null);
  if (msg) {
    st.boards[key] = msg.id;
    save();
  }
  return msg;
}
const closedLine = () => {
  const { open, until } = C().getSchedule();
  return open ? null : `🔒 Le casino est **fermé**. Réouverture <t:${Math.floor(until / 1000)}:R> (${C().SCHEDULE_TEXT}).`;
};
const betsList = (bets, fmt) => (bets.length ? bets.slice(-15).map(fmt).join("\n") + (bets.length > 15 ? `\n*… et ${bets.length - 15} autres mises*` : "") : "*Aucune mise pour le moment : soyez le premier !*");
const betModal = (customId, title, label = "Mise (€)", extra = null) => {
  const m = new ModalBuilder()
    .setCustomId(customId)
    .setTitle(title)
    .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("mise").setLabel(label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)));
  if (extra) m.addComponents(new ActionRowBuilder().addComponents(extra));
  return m;
};
const parseAmount = (t) => parseInt(String(t ?? "").replace(/[^\d]/g, ""), 10) || 0;

// --- Roulette en direct ---
const RL_BETS = {
  rouge: { label: "Rouge", emoji: "🔴", mult: 2, win: (n) => n > 0 && V_RED.has(n) },
  noir: { label: "Noir", emoji: "⚫", mult: 2, win: (n) => n > 0 && !V_RED.has(n) },
  pair: { label: "Pair", emoji: "2️⃣", mult: 2, win: (n) => n > 0 && n % 2 === 0 },
  impair: { label: "Impair", emoji: "1️⃣", mult: 2, win: (n) => n % 2 === 1 },
  manque: { label: "1 à 18", emoji: "⬇️", mult: 2, win: (n) => n >= 1 && n <= 18 },
  passe: { label: "19 à 36", emoji: "⬆️", mult: 2, win: (n) => n >= 19 },
  vert: { label: "Zéro", emoji: "🟢", mult: 36, win: (n) => n === 0 },
};
const V_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const FAST = process.env.CASINO_LIVE_FAST ? 0.02 : 1; // tests uniquement : comptes à rebours accélérés
const RL_WINDOW = 45 * 1000 * FAST;
function rouletteBoard() {
  const r = live.roulette, closed = closedLine(), st = load();
  const last = st.lastRoulette;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x15803d)
        .setTitle("🎡 Roulette en direct")
        .setDescription(
          (closed ??
            (r
              ? `⏳ **La roue tourne <t:${Math.floor(r.spinAt / 1000)}:R>** — faites vos jeux !`
              : "La table attend la première mise : dès qu'un joueur mise, le compte à rebours de 45 secondes démarre.")) +
            `\n\n**Mises** : ${Object.values(RL_BETS).map((b) => `${b.emoji} ${b.label} ×${b.mult}`).join(" · ")}`
        )
        .addFields({ name: `🎲 Mises de la manche${r ? ` (${formatEuro(r.bets.reduce((a, b) => a + b.amount, 0))})` : ""}`, value: betsList(r?.bets ?? [], (b) => `${RL_BETS[b.type].emoji} **${pseudo(b.userId)}** — ${formatEuro(b.amount)} sur ${RL_BETS[b.type].label}`) })
        .setFooter({ text: last ? `Dernier tirage : ${last.n} · ${last.n === 0 ? "zéro" : V_RED.has(last.n) ? "rouge" : "noir"}` : "Mise minimum 10 € · le casino garde un avantage (le zéro)" }),
    ],
    components: [
      new ActionRowBuilder().addComponents(["rouge", "noir", "pair", "impair"].map((k) => new ButtonBuilder().setCustomId(`casino_x_rl_${k}`).setLabel(`${RL_BETS[k].label} ×${RL_BETS[k].mult}`).setEmoji(RL_BETS[k].emoji).setStyle(k === "rouge" ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(Boolean(closed)))),
      new ActionRowBuilder().addComponents(["manque", "passe", "vert"].map((k) => new ButtonBuilder().setCustomId(`casino_x_rl_${k}`).setLabel(`${RL_BETS[k].label} ×${RL_BETS[k].mult}`).setEmoji(RL_BETS[k].emoji).setStyle(k === "vert" ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(Boolean(closed)))),
    ],
  };
}
async function rouletteSpin() {
  const r = live.roulette;
  if (!r || r.spinning) return;
  r.spinning = true;
  const n = Math.floor(Math.random() * 37);
  const winners = [];
  for (const b of r.bets) {
    if (!RL_BETS[b.type].win(n)) continue;
    const won = b.amount * RL_BETS[b.type].mult;
    const paid = C().pay(b.userId, won, "roulette en direct");
    winners.push(`🏆 **${pseudo(b.userId)}** gagne **${formatEuro(paid)}** (${RL_BETS[b.type].label})`);
  }
  settleEscrow("roulette");
  load().lastRoulette = { n, at: Date.now() };
  save();
  live.roulette = null;
  const gif = await V.rouletteGif(n, winners.length ? `${winners.length} GAGNANT${winners.length > 1 ? "S" : ""}` : "LA MAISON GAGNE", winners.length > 0);
  const msg = await chanOf("roulette")
    ?.send({
      embeds: [new EmbedBuilder().setColor(winners.length ? 0x22c55e : 0x991b1b).setTitle(`🎡 Rien ne va plus… ${n} ${n === 0 ? "🟢" : V_RED.has(n) ? "🔴" : "⚫"}`).setDescription(winners.join("\n") || "*Personne n'a gagné cette fois-ci.*").setImage("attachment://roulette.gif")],
      files: [new AttachmentBuilder(gif, { name: "roulette.gif" })],
    })
    .catch(() => null);
  deleteLater(msg, 3 * MINUTE);
  await upsertBoard("roulette", rouletteBoard());
}

// --- Crash : la fusée de la Maison ---
const CR_WINDOW = 25 * 1000 * FAST, CR_TICK = 1600, CR_RATE = 0.11;
const crashAt = (start, now) => Math.max(1, Math.exp((CR_RATE * (now - start)) / 1000));
function drawCrashPoint() {
  const u = Math.random();
  if (u < 0.04) return 1; // explosion immédiate : l'avantage de la maison
  return Math.min(50, Math.max(1, Math.floor((0.97 / (1 - u)) * 100) / 100));
}
function crashBoard(image = null) {
  const c = live.crash, closed = closedLine();
  const phase = c?.phase;
  const desc =
    closed ??
    (phase === "fly"
      ? `🚀 **La fusée décolle !** Cliquez sur **Encaisser** avant qu'elle explose.`
      : phase === "bet"
        ? `⏳ **Décollage <t:${Math.floor(c.flyAt / 1000)}:R>** — misez maintenant !`
        : "La fusée attend la première mise : dès qu'un joueur mise, le décollage est prévu 25 secondes plus tard.");
  const embed = new EmbedBuilder()
    .setColor(phase === "fly" ? 0x0ea5e9 : 0x1e1b4b)
    .setTitle("🚀 Crash — la fusée de la Maison")
    .setDescription(`${desc}\n\nPlus vous attendez, plus le multiplicateur monte… mais si la fusée explose avant votre encaissement, la mise est perdue. Vous pouvez fixer un **encaissement automatique**.`)
    .addFields({ name: "🎟️ Passagers", value: betsList(c?.bets ?? [], (b) => `${b.out ? "✅" : phase === "fly" ? "🚀" : "🎟️"} **${pseudo(b.userId)}** — ${formatEuro(b.amount)}${b.out ? ` · encaissé à **x${b.out.toFixed(2)}**` : b.auto ? ` · auto x${b.auto.toFixed(2)}` : ""}`) })
    .setFooter({ text: `Derniers vols : ${load().crashHistory.slice(-8).map((h) => `x${h.toFixed(2)}`).join(" · ") || "—"}` });
  if (image) embed.setImage("attachment://crash.jpg");
  return {
    embeds: [embed],
    files: image ? [new AttachmentBuilder(image, { name: "crash.jpg" })] : [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("casino_x_cr_bet").setLabel("Monter à bord").setEmoji("🎟️").setStyle(ButtonStyle.Primary).setDisabled(Boolean(closed) || phase === "fly"),
        new ButtonBuilder().setCustomId("casino_x_cr_cash").setLabel("Encaisser !").setEmoji("💰").setStyle(ButtonStyle.Success).setDisabled(phase !== "fly")
      ),
    ],
  };
}
function cashOut(b, mult) {
  if (b.out) return 0;
  b.out = mult;
  // la mise est réglée : elle ne sera pas remboursée si le bot redémarre
  const esc = load().escrow.crash;
  if (esc) {
    const i = esc.findIndex((x) => x.userId === b.userId && x.amount === b.amount);
    if (i >= 0) esc.splice(i, 1);
    save();
  }
  const paid = C().pay(b.userId, round2(b.amount * mult), "Crash");
  b.paid = paid;
  return paid;
}
async function crashFly() {
  const c = live.crash;
  if (!c || c.phase !== "bet") return;
  c.phase = "fly";
  c.start = Date.now();
  c.point = drawCrashPoint();
  while (true) {
    const m = crashAt(c.start, Date.now());
    for (const b of c.bets) if (!b.out && b.auto && b.auto <= Math.min(m, c.point)) cashOut(b, b.auto);
    if (m >= c.point) break;
    const img = await V.crashImage(m, false, load().crashHistory, c.bets.filter((b) => b.out).map((b) => ({ name: pseudo(b.userId), at: b.out })));
    await upsertBoard("crash", crashBoard(img));
    const wait = Math.min(CR_TICK, Math.max(300, (Math.log(c.point) / CR_RATE) * 1000 - (Date.now() - c.start)));
    await new Promise((r) => setTimeout(r, wait));
  }
  c.phase = "done";
  const st = load();
  st.crashHistory.push(c.point);
  st.crashHistory = st.crashHistory.slice(-20);
  settleEscrow("crash");
  const lines = c.bets.map((b) => (b.out ? `✅ **${pseudo(b.userId)}** encaisse à x${b.out.toFixed(2)} : **+${formatEuro(b.paid)}**` : `💥 **${pseudo(b.userId)}** perd ${formatEuro(b.amount)}`));
  const img = await V.crashImage(c.point, true, st.crashHistory.slice(0, -1), c.bets.filter((b) => b.out).map((b) => ({ name: pseudo(b.userId), at: b.out })));
  live.crash = null;
  const msg = await chanOf("crash")
    ?.send({ embeds: [new EmbedBuilder().setColor(0xb91c1c).setTitle(`💥 La fusée explose à x${c.point.toFixed(2)} !`).setDescription(lines.join("\n").slice(0, 4000)).setImage("attachment://crash.jpg")], files: [new AttachmentBuilder(img, { name: "crash.jpg" })] })
    .catch(() => null);
  deleteLater(msg, 3 * MINUTE);
  await upsertBoard("crash", crashBoard());
}

// --- Courses de chevaux ---
const HORSE_NAMES = ["Éclair", "Velours", "Bourse", "Notre-Dame", "Joker", "La Seine", "Tour Eiffel", "Fondateur", "Comète", "Minuit", "Sablier", "Arc-en-ciel"];
const HORSE_COLORS = ["#ef4444", "#ec4899", "#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];
const HR_WINDOW = 60 * 1000 * FAST, HR_EDGE = 0.9;
function newField() {
  const names = [...HORSE_NAMES].sort(() => Math.random() - 0.5).slice(0, 6);
  const strength = names.map(() => 0.5 + Math.random() * 1.5);
  const sum = strength.reduce((a, b) => a + b, 0);
  return names.map((name, i) => {
    const p = strength[i] / sum;
    return { name, color: HORSE_COLORS[i], p, odds: Math.max(1.3, Math.round((HR_EDGE / p) * 10) / 10) };
  });
}
function coursesBoard() {
  const h = live.courses, closed = closedLine();
  const field = h?.field ?? (live.nextField ??= newField());
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x15803d)
        .setTitle("🏇 Grand Prix de la Maison")
        .setDescription(
          (closed ?? (h ? `⏳ **Départ <t:${Math.floor(h.startAt / 1000)}:R>** — choisissez votre cheval !` : "Les chevaux attendent la première mise : dès qu'un joueur mise, le départ est donné 60 secondes plus tard.")) +
            "\n\n" +
            field.map((x, i) => `**${i + 1}.** ${x.name} — cote **×${x.odds.toFixed(1)}**`).join("\n")
        )
        .addFields({ name: "🎟️ Paris", value: betsList(h?.bets ?? [], (b) => `**${pseudo(b.userId)}** — ${formatEuro(b.amount)} sur n°${b.horse + 1} ${field[b.horse].name}`) })
        .setFooter({ text: "Plus la cote est haute, moins le cheval a de chances… et plus il rapporte." }),
    ],
    components: [
      new ActionRowBuilder().addComponents(field.slice(0, 3).map((x, i) => new ButtonBuilder().setCustomId(`casino_x_hr_${i}`).setLabel(`${i + 1}. ${x.name} ×${x.odds.toFixed(1)}`.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(Boolean(closed)))),
      new ActionRowBuilder().addComponents(field.slice(3).map((x, i) => new ButtonBuilder().setCustomId(`casino_x_hr_${i + 3}`).setLabel(`${i + 4}. ${x.name} ×${x.odds.toFixed(1)}`.slice(0, 80)).setStyle(ButtonStyle.Secondary).setDisabled(Boolean(closed)))),
    ],
  };
}
async function runRace() {
  const h = live.courses;
  if (!h || h.running) return;
  h.running = true;
  // ordre d'arrivée tiré selon la force de chaque cheval
  const left = h.field.map((x, i) => ({ i, p: x.p })), order = [];
  while (left.length) {
    const tot = left.reduce((a, x) => a + x.p, 0);
    let r = Math.random() * tot, k = 0;
    while (k < left.length - 1 && (r -= left[k].p) > 0) k++;
    order.push(left.splice(k, 1)[0].i);
  }
  const winner = order[0], lines = [];
  for (const b of h.bets) {
    if (b.horse !== winner) continue;
    const paid = C().pay(b.userId, round2(b.amount * h.field[winner].odds), "courses");
    lines.push(`🏆 **${pseudo(b.userId)}** gagne **${formatEuro(paid)}**`);
  }
  settleEscrow("courses");
  const gif = await V.raceGif(h.field, order);
  live.courses = null;
  live.nextField = newField();
  const msg = await chanOf("courses")
    ?.send({
      embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle(`🏁 Victoire de n°${winner + 1} ${h.field[winner].name} (×${h.field[winner].odds.toFixed(1)})`).setDescription(`${lines.join("\n") || "*Aucun parieur n'avait misé sur le vainqueur.*"}\n\nArrivée : ${order.map((i, k) => `${k + 1}. ${h.field[i].name}`).join(" · ")}`).setImage("attachment://course.gif")],
      files: [new AttachmentBuilder(gif, { name: "course.gif" })],
    })
    .catch(() => null);
  deleteLater(msg, 3 * MINUTE);
  await upsertBoard("courses", coursesBoard());
}

// --- Interactions ---
async function handleLiveInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("casino_x_")) return false;
  const userId = interaction.user.id;
  if (id === "casino_x_vip") {
    await interaction.reply(vipPayload(userId));
    return true;
  }
  if (id === "casino_x_cashback") {
    const paid = claimCashback(userId);
    await interaction.update({ ...vipPayload(userId), content: paid ? `💸 Cashback versé : **+${formatEuro(paid)}** !` : "💸 Rien à récupérer pour cette semaine." });
    return true;
  }
  // tout le reste demande l'accès au casino et qu'il soit ouvert
  const err = C().playError(interaction.member);
  if (err && !id.startsWith("casino_x_cr_cash")) {
    await interaction.reply({ content: err, ephemeral: true });
    return true;
  }
  if (id === "casino_x_wheel") {
    await spinWheel(interaction);
    return true;
  }
  // roulette en direct
  const rl = /^casino_x_rl_(\w+)$/.exec(id);
  if (rl && RL_BETS[rl[1]] && interaction.isButton()) {
    await interaction.showModal(betModal(`casino_x_rlm_${rl[1]}`, `🎡 ${RL_BETS[rl[1]].label} (×${RL_BETS[rl[1]].mult})`));
    return true;
  }
  const rlm = /^casino_x_rlm_(\w+)$/.exec(id);
  if (rlm && RL_BETS[rlm[1]]) {
    if (live.roulette?.spinning) {
      await interaction.reply({ content: "🎡 La roue tourne déjà : attendez la manche suivante.", ephemeral: true });
      return true;
    }
    const amount = parseAmount(interaction.fields.getTextInputValue("mise"));
    const e = liveBet(interaction, amount, "roulette en direct", "roulette");
    if (e) {
      await interaction.reply({ content: e, ephemeral: true });
      return true;
    }
    if (!live.roulette) {
      live.roulette = { bets: [], spinAt: Date.now() + RL_WINDOW };
      setTimeout(() => rouletteSpin().catch((err2) => console.error("Roulette en direct:", err2.message)), RL_WINDOW);
    }
    live.roulette.bets.push({ userId, amount, type: rlm[1] });
    await interaction.reply({ content: `🎡 Mise de **${formatEuro(amount)}** sur ${RL_BETS[rlm[1]].emoji} **${RL_BETS[rlm[1]].label}** enregistrée. La roue tourne <t:${Math.floor(live.roulette.spinAt / 1000)}:R>.`, ephemeral: true });
    await upsertBoard("roulette", rouletteBoard());
    return true;
  }
  // Crash
  if (id === "casino_x_cr_bet") {
    if (live.crash?.phase === "fly") {
      await interaction.reply({ content: "🚀 La fusée a déjà décollé : attendez le prochain vol.", ephemeral: true });
      return true;
    }
    await interaction.showModal(
      betModal("casino_x_crm", "🚀 Monter à bord", "Mise (€)", new TextInputBuilder().setCustomId("auto").setLabel("Encaissement automatique (ex. 2,5) — facultatif").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(6))
    );
    return true;
  }
  if (id === "casino_x_crm") {
    if (live.crash?.phase === "fly") {
      await interaction.reply({ content: "🚀 La fusée a déjà décollé : attendez le prochain vol.", ephemeral: true });
      return true;
    }
    if (live.crash?.bets.some((b) => b.userId === userId)) {
      await interaction.reply({ content: "🎟️ Vous êtes déjà à bord pour ce vol.", ephemeral: true });
      return true;
    }
    const amount = parseAmount(interaction.fields.getTextInputValue("mise"));
    const autoRaw = Number(String(interaction.fields.getTextInputValue("auto") || "").replace(",", ".").replace(/[^\d.]/g, ""));
    const auto = autoRaw >= 1.01 ? Math.min(50, autoRaw) : null;
    const e = liveBet(interaction, amount, "Crash", "crash");
    if (e) {
      await interaction.reply({ content: e, ephemeral: true });
      return true;
    }
    if (!live.crash) {
      live.crash = { phase: "bet", bets: [], flyAt: Date.now() + CR_WINDOW };
      setTimeout(() => crashFly().catch((err2) => console.error("Crash:", err2.message)), CR_WINDOW);
    }
    live.crash.bets.push({ userId, amount, auto });
    await interaction.reply({ content: `🎟️ Vous êtes à bord avec **${formatEuro(amount)}**${auto ? ` (encaissement automatique à x${auto.toFixed(2)})` : ""}. Décollage <t:${Math.floor(live.crash.flyAt / 1000)}:R>.`, ephemeral: true });
    await upsertBoard("crash", crashBoard());
    return true;
  }
  if (id === "casino_x_cr_cash") {
    const c = live.crash, b = c?.bets.find((x) => x.userId === userId);
    if (!c || c.phase !== "fly" || !b) {
      await interaction.reply({ content: b ? "🚀 Trop tard…" : "🎟️ Vous n'êtes pas à bord de ce vol.", ephemeral: true });
      return true;
    }
    if (b.out) {
      await interaction.reply({ content: `✅ Déjà encaissé à x${b.out.toFixed(2)}.`, ephemeral: true });
      return true;
    }
    const m = crashAt(c.start, Date.now());
    if (m >= c.point) {
      await interaction.reply({ content: "💥 La fusée vient d'exploser… trop tard !", ephemeral: true });
      return true;
    }
    const paid = cashOut(b, Math.floor(m * 100) / 100);
    await interaction.reply({ content: `💰 Encaissé à **x${b.out.toFixed(2)}** : **+${formatEuro(paid)}** !`, ephemeral: true });
    return true;
  }
  // courses
  const hr = /^casino_x_hr_(\d)$/.exec(id);
  if (hr) {
    const field = live.courses?.field ?? (live.nextField ??= newField());
    await interaction.showModal(betModal(`casino_x_hrm_${hr[1]}`, `🏇 n°${Number(hr[1]) + 1} ${field[Number(hr[1])].name} (×${field[Number(hr[1])].odds.toFixed(1)})`.slice(0, 45)));
    return true;
  }
  const hrm = /^casino_x_hrm_(\d)$/.exec(id);
  if (hrm) {
    if (live.courses?.running) {
      await interaction.reply({ content: "🏇 La course est partie : attendez la suivante.", ephemeral: true });
      return true;
    }
    const amount = parseAmount(interaction.fields.getTextInputValue("mise"));
    const e = liveBet(interaction, amount, "courses", "courses");
    if (e) {
      await interaction.reply({ content: e, ephemeral: true });
      return true;
    }
    if (!live.courses) {
      live.courses = { bets: [], field: live.nextField ?? newField(), startAt: Date.now() + HR_WINDOW };
      setTimeout(() => runRace().catch((err2) => console.error("Courses:", err2.message)), HR_WINDOW);
    }
    const horse = Number(hrm[1]);
    live.courses.bets.push({ userId, amount, horse });
    await interaction.reply({ content: `🏇 **${formatEuro(amount)}** sur n°${horse + 1} **${live.courses.field[horse].name}** (×${live.courses.field[horse].odds.toFixed(1)}). Départ <t:${Math.floor(live.courses.startAt / 1000)}:R>.`, ephemeral: true });
    await upsertBoard("courses", coursesBoard());
    return true;
  }
  return false;
}

// --- Démarrage ---
let lastOpen = null;
async function setupLive(client) {
  clientRef = client;
  load();
  await refundEscrow(client);
  await setupChannels(client);
  const refreshAll = async () => {
    if (!live.roulette) await upsertBoard("roulette", rouletteBoard());
    if (!live.crash) await upsertBoard("crash", crashBoard());
    if (!live.courses) await upsertBoard("courses", coursesBoard());
  };
  await refreshAll().catch((err) => console.error("Casino en direct:", err.message));
  lastOpen = C().getSchedule().open;
  setInterval(() => {
    const open = C().getSchedule().open;
    if (open !== lastOpen) {
      lastOpen = open;
      refreshAll().catch(() => null);
    }
  }, MINUTE).unref?.();
  void HOUR;
}
const liveChannelsLine = () => {
  const st = load();
  return ["roulette", "crash", "courses"].map((k) => (st.channels[k] ? `<#${st.channels[k]}>` : null)).filter(Boolean).join(" · ");
};

module.exports = { setupLive, handleLiveInteraction, recordBet, recordWin, weekBestLines, liveChannelsLine, vipOf };
