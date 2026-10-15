// Paris sportifs sur les vrais matchs : Ligue 1, Ligue des champions et gros matchs des équipes nationales.
// Les matchs, les résultats et (quand elles existent) les cotes viennent d'ESPN. Les paris ferment au coup d'envoi ;
// le résultat retenu est celui du temps réglementaire (prolongation et tirs au but = match nul).
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { findOrCreateChannel } = require("./salons");
const { changeBalance, readBalance, isFrozen, formatEuro } = require("./economie");
const { curfew, lawActive, lawParam } = require("./politique");
const { pseudo } = require("./noms");

const CHANNEL_NAME = "⚽・paris-sportifs";
const PANEL_TITLE = "⚽ Paris sportifs";
const MIN_STAKE = 10;
const MAX_STAKE = 500; // par pari : personne ne se ruine sur un match
const MAX_OPEN = 5; // paris en cours par personne
const DAYS_AHEAD = 7;
const REFRESH_MS = 30 * 60000;
const SETTLE_MS = 10 * 60000;
const STATE_FILE = require("./data").dataFile("paris-state.json");
const API = "https://site.api.espn.com/apis/site/v2/sports/soccer";

// compétitions suivies ; « filter » : seulement les gros matchs (la France, ou deux grandes nations)
const LEAGUES = [
  { slug: "fra.1", name: "Ligue 1", short: "L1", color: "#1d4ed8" },
  { slug: "uefa.champions", name: "Ligue des champions", short: "LDC", color: "#0b1f6b" },
  { slug: "fifa.world", name: "Coupe du monde", short: "CDM", color: "#7f1d1d" },
  { slug: "uefa.euro", name: "Euro", short: "EURO", color: "#1e3a8a" },
  { slug: "uefa.nations", name: "Ligue des nations", short: "LDN", color: "#334155", filter: true },
  { slug: "fifa.worldq.uefa", name: "Qualifications Coupe du monde", short: "QCDM", color: "#7f1d1d", filter: true },
  { slug: "uefa.euroq", name: "Qualifications Euro", short: "QEURO", color: "#1e3a8a", filter: true },
  { slug: "fifa.friendly", name: "Match amical", short: "AMICAL", color: "#3f3f46", filter: true },
];
const NATIONS = {
  FRA: "France", ESP: "Espagne", ENG: "Angleterre", GER: "Allemagne", ITA: "Italie", POR: "Portugal", NED: "Pays-Bas", BEL: "Belgique",
  BRA: "Brésil", ARG: "Argentine", CRO: "Croatie", MAR: "Maroc", ALG: "Algérie", SEN: "Sénégal", URU: "Uruguay", USA: "États-Unis",
};
const BIG = new Set(Object.keys(NATIONS));
const bigMatch = (m) => m.home.abbr === "FRA" || m.away.abbr === "FRA" || (BIG.has(m.home.abbr) && BIG.has(m.away.abbr));

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}

let state = null;
let channelRef = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.matches ??= {};
  state.bets ??= {};
  state.stats ??= {};
  state.next ??= 1;
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Matchs ---
const round2 = (n) => Math.round(n * 100) / 100;
const american = (v) => {
  const n = Number(String(v ?? "").replace("+", ""));
  if (!Number.isFinite(n) || n === 0) return null;
  return round2(n > 0 ? 1 + n / 100 : 1 + 100 / -n);
};
// points par match sur la forme récente (« WDLWW »)
const ppg = (form) => {
  const f = String(form ?? "").toUpperCase().replace(/[^WDL]/g, "");
  return f ? [...f].reduce((a, r) => a + (r === "W" ? 3 : r === "D" ? 1 : 0), 0) / f.length : 1.4;
};
// cotes estimées quand ESPN n'en donne pas : forme récente + avantage du terrain, marge de 7 %
function modelOdds(home, away, neutral) {
  const diff = ppg(home.form) - ppg(away.form) + (neutral ? 0 : 0.35);
  const pDraw = Math.max(0.18, Math.min(0.3, 0.28 - 0.04 * Math.abs(diff)));
  const pHome = (1 - pDraw) / (1 + Math.exp(-1.15 * diff));
  const pAway = 1 - pDraw - pHome;
  const odd = (p) => Math.max(1.08, Math.min(15, round2(0.93 / p)));
  return { home: odd(pHome), draw: odd(pDraw), away: odd(pAway), source: "estimées" };
}
function teamOf(t) {
  const abbr = t.team.abbreviation;
  return { name: NATIONS[abbr] ?? t.team.shortDisplayName ?? t.team.displayName, abbr, logo: t.team.logo ?? null, form: t.form ?? null };
}
function parseEvent(ev, league) {
  const c = ev.competitions?.[0];
  if (!c) return null;
  const h = c.competitors.find((x) => x.homeAway === "home"), a = c.competitors.find((x) => x.homeAway === "away");
  if (!h || !a) return null;
  const home = teamOf(h), away = teamOf(a);
  const o = c.odds?.[0];
  let odds = null;
  if (o) {
    const oh = american(o.moneyline?.home?.close?.odds ?? o.moneyline?.home?.open?.odds ?? o.homeTeamOdds?.moneyLine);
    const oa = american(o.moneyline?.away?.close?.odds ?? o.moneyline?.away?.open?.odds ?? o.awayTeamOdds?.moneyLine);
    const od = american(o.moneyline?.draw?.close?.odds ?? o.drawOdds?.moneyLine);
    const cap = (v) => Math.min(15, v); // pas de cote folle : 500 € × 15 au plus
    if (oh && oa && od) odds = { home: cap(oh), draw: cap(od), away: cap(oa), source: "du marché" };
  }
  return {
    id: String(ev.id),
    slug: league.slug,
    league: league.name,
    date: Date.parse(ev.date),
    home,
    away,
    odds: odds ?? modelOdds(home, away, c.neutralSite),
    status: c.status?.type?.name ?? "STATUS_SCHEDULED",
  };
}
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");
async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function refreshMatches() {
  const st = load(), found = {};
  for (const league of LEAGUES) {
    for (let d = 0; d <= DAYS_AHEAD; d++) {
      const data = await fetchJson(`${API}/${league.slug}/scoreboard?dates=${dayKey(Date.now() + d * 86400000)}`).catch(() => null);
      for (const ev of data?.events ?? []) {
        const m = parseEvent(ev, league);
        if (!m || m.date <= Date.now() || (league.filter && !bigMatch(m))) continue;
        found[m.id] = m;
      }
    }
  }
  // un match déjà connu garde ses informations s'il a disparu (paris en cours) ; les nouvelles cotes remplacent les anciennes
  for (const [id, m] of Object.entries(found)) st.matches[id] = { ...st.matches[id], ...m };
  for (const [id, m] of Object.entries(st.matches)) {
    const hasBets = Object.values(st.bets).some((b) => b.matchId === id && b.status === "open");
    if (m.date < Date.now() - 3 * 86400000 && !hasBets) delete st.matches[id];
  }
  save();
}
const upcoming = () =>
  Object.values(load().matches)
    .filter((m) => m.date > Date.now() && /SCHEDULED|PRE/i.test(m.status))
    .sort((a, b) => a.date - b.date);

// --- Images ---
const logoCache = new Map();
async function logo(url) {
  if (!url) return null;
  if (!logoCache.has(url)) logoCache.set(url, await loadImage(url).catch(() => null));
  if (logoCache.size > 300) logoCache.delete(logoCache.keys().next().value);
  return logoCache.get(url);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function fitFont(ctx, text, maxW, size, family) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (s > 12 && ctx.measureText(text).width > maxW) ctx.font = `${--s}px ${family}`;
}
const fmt = (ms, opts) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", ...opts }).format(new Date(ms));
const whenText = (ms) => `${fmt(ms, { weekday: "short", day: "numeric", month: "short" })} · ${fmt(ms, { hour: "2-digit", minute: "2-digit" })}`;
function pitch(ctx, W, H) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#04210f");
  bg.addColorStop(1, "#020c06");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // bandes de pelouse et lignes du terrain
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 ? "rgba(34,197,94,0.035)" : "rgba(34,197,94,0.07)";
    ctx.fillRect((i * W) / 12, 0, W / 12, H);
  }
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.beginPath();
  ctx.moveTo(W / 2, 30);
  ctx.lineTo(W / 2, H - 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 110, 0, Math.PI * 2);
  ctx.stroke();
  const glow = ctx.createRadialGradient(W / 2, 0, 20, W / 2, 0, W * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}
function oddBox(ctx, x, y, w, h, label, value, highlight = false) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = highlight ? "rgba(250,204,21,0.95)" : "rgba(255,255,255,0.08)";
  ctx.fill();
  ctx.strokeStyle = highlight ? "#fde047" : "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = "12px CardBold";
  ctx.fillStyle = highlight ? "#422006" : "rgba(255,255,255,0.6)";
  ctx.fillText(label, x + w / 2, y + 18);
  ctx.font = "22px CardBold";
  ctx.fillStyle = highlight ? "#1c1003" : "#ffffff";
  ctx.fillText(value.toFixed(2).replace(".", ","), x + w / 2, y + h - 12);
}
async function drawBoard(matches) {
  const list = matches.slice(0, 8);
  const rowH = 92, W = 1200, H = 190 + Math.max(1, list.length) * (rowH + 12) + 30;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  pitch(ctx, W, H);
  ctx.textAlign = "center";
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#86efac";
  ctx.fillText("LA MAISON · PARIS SPORTIFS", W / 2, 78);
  ctx.font = "54px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Les matchs à venir", W / 2, 140);
  if (!list.length) {
    ctx.font = "22px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText("Aucun match dans les 7 prochains jours.", W / 2, 230);
  }
  for (const [i, m] of list.entries()) {
    const y = 180 + i * (rowH + 12), x = 60, w = W - 120;
    roundRect(ctx, x, y, w, rowH, 14);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(134,239,172,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // compétition et heure
    const lg = LEAGUES.find((l) => l.slug === m.slug);
    roundRect(ctx, x + 16, y + 16, 92, 26, 13);
    ctx.fillStyle = lg?.color ?? "#334155";
    ctx.fill();
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(lg?.short ?? "", x + 62, y + 34);
    ctx.font = "14px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(fmt(m.date, { weekday: "short", day: "numeric" }), x + 62, y + 62);
    ctx.font = "16px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fmt(m.date, { hour: "2-digit", minute: "2-digit" }), x + 62, y + 82);
    // équipes
    for (const [side, t] of [["home", m.home], ["away", m.away]]) {
      const lx = side === "home" ? x + 140 : x + 560, img = await logo(t.logo);
      if (img) ctx.drawImage(img, lx, y + 22, 48, 48);
      ctx.textAlign = "left";
      fitFont(ctx, t.name, 290, 24, "CardBold");
      ctx.fillStyle = "#ffffff";
      ctx.fillText(t.name, lx + 60, y + 55);
    }
    ctx.textAlign = "center";
    ctx.font = "16px CardBold";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("VS", x + 535, y + 52);
    // cotes
    const ow = 82, ox = x + w - 3 * (ow + 10) - 6;
    [["1", m.odds.home], ["N", m.odds.draw], ["2", m.odds.away]].forEach(([l, v], k) => oddBox(ctx, ox + k * (ow + 10), y + 16, ow, rowH - 32, l, v));
  }
  return c;
}
async function drawMatchCard(m, pick = null) {
  const W = 1000, H = 520, c = createCanvas(W, H), ctx = c.getContext("2d");
  pitch(ctx, W, H);
  const lg = LEAGUES.find((l) => l.slug === m.slug);
  ctx.textAlign = "center";
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#86efac";
  ctx.fillText((lg?.name ?? m.league).toUpperCase(), W / 2, 72);
  ctx.font = "20px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(whenText(m.date), W / 2, 104);
  for (const [i, t] of [m.home, m.away].entries()) {
    const cx = i ? W - 230 : 230, img = await logo(t.logo);
    ctx.beginPath();
    ctx.arc(cx, 220, 78, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    if (img) ctx.drawImage(img, cx - 62, 158, 124, 124);
    fitFont(ctx, t.name, 340, 34, "CardTitle");
    ctx.fillStyle = "#ffffff";
    ctx.fillText(t.name, cx, 342);
  }
  ctx.font = "64px CardTitle";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText("VS", W / 2, 242);
  const ow = 200, gap = 26, ox = W / 2 - (3 * ow + 2 * gap) / 2;
  [["home", `1 · ${m.home.name}`, m.odds.home], ["draw", "N · Match nul", m.odds.draw], ["away", `2 · ${m.away.name}`, m.odds.away]].forEach(([k, l, v], i) =>
    oddBox(ctx, ox + i * (ow + gap), 384, ow, 76, l.length > 22 ? `${l.slice(0, 21)}…` : l, v, pick === k)
  );
  ctx.font = "14px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`Cotes ${m.odds.source} · résultat à la fin du temps réglementaire (90 min)`, W / 2, H - 26);
  return c;
}
const png = async (canvas, name) => new AttachmentBuilder(await canvas.encode("png"), { name });

// --- Panneau ---
const PICKS = { home: "1", draw: "N", away: "2" };
const pickName = (m, pick) => (pick === "home" ? `Victoire ${m.home.name}` : pick === "away" ? `Victoire ${m.away.name}` : "Match nul");
async function panelPayload() {
  const list = upcoming();
  const st = load();
  const top = Object.entries(st.stats)
    .map(([id, s]) => [id, round2((s.won ?? 0) - (s.staked ?? 0))])
    .filter(([, net]) => net > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const embed = new EmbedBuilder()
    .setColor(0x16a34a)
    .setTitle(PANEL_TITLE)
    .setDescription(
      "Pariez sur les **vrais matchs** : **Ligue 1**, **Ligue des champions** et les gros matchs des **équipes nationales** 🇫🇷.\n\n" +
        "**1.** Choisissez un match dans le menu · **2.** Choisissez **1**, **N** ou **2** · **3.** Indiquez votre mise.\n" +
        `Si vous gagnez, vous touchez **mise × cote**, automatiquement après le match.\n\n` +
        `*Mise de ${formatEuro(MIN_STAKE)} à ${formatEuro(MAX_STAKE)} · ${MAX_OPEN} paris en cours au maximum · les paris ferment au coup d'envoi · résultat après 90 minutes (prolongation et tirs au but = nul).*` +
        (top.length ? `\n\n🏆 **Meilleurs parieurs** : ${top.map(([id, net], i) => `${["🥇", "🥈", "🥉"][i]} ${pseudo(id)} (+${formatEuro(net)})`).join(" · ")}` : "")
    )
    .setImage("attachment://matchs.png")
    .setFooter({ text: `${list.length} match${list.length > 1 ? "s" : ""} ouverts aux paris · mis à jour` })
    .setTimestamp();
  const options = list.slice(0, 25).map((m) => ({
    label: `${m.home.name} – ${m.away.name}`.slice(0, 100),
    value: m.id,
    description: `${LEAGUES.find((l) => l.slug === m.slug)?.short ?? ""} · ${whenText(m.date)} · 1: ${m.odds.home} · N: ${m.odds.draw} · 2: ${m.odds.away}`.slice(0, 100),
    emoji: "⚽",
  }));
  const rows = [];
  if (options.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("paris_match").setPlaceholder("⚽ Choisir un match pour parier…").addOptions(options)));
  rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("paris_mine").setLabel("Mes paris").setEmoji("🎟️").setStyle(ButtonStyle.Secondary)));
  return { embeds: [embed], components: rows, files: [await png(await drawBoard(list), "matchs.png")], attachments: [] };
}
async function refreshPanel(client) {
  const st = load();
  const ch = channelRef ?? (st.channelId ? await client.channels.fetch(st.channelId).catch(() => null) : null);
  if (!ch) return;
  let msg = st.panelId ? await ch.messages.fetch(st.panelId).catch(() => null) : null;
  const payload = await panelPayload();
  if (msg) await msg.edit(payload).catch(() => null);
  else {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.panelId = msg.id;
      save();
    }
  }
}

// --- Règlement des paris ---
function regulationResult(comp) {
  const name = comp.status?.type?.name ?? "";
  if (/AET|PEN/i.test(name)) return "draw"; // après prolongation ou tirs au but : nul à la 90e
  const h = comp.competitors.find((x) => x.homeAway === "home"), a = comp.competitors.find((x) => x.homeAway === "away");
  const hs = Number(h?.score), as = Number(a?.score);
  if (!Number.isFinite(hs) || !Number.isFinite(as)) return null;
  return hs > as ? "home" : hs < as ? "away" : "draw";
}
async function settle(client) {
  const st = load();
  const open = Object.values(st.bets).filter((b) => b.status === "open");
  const ids = [...new Set(open.map((b) => b.matchId))];
  for (const id of ids) {
    const m = st.matches[id];
    if (!m || Date.now() < m.date + 100 * 60000) continue;
    const data = await fetchJson(`${API}/${m.slug}/summary?event=${id}`).catch(() => null);
    const comp = data?.header?.competitions?.[0];
    if (!comp) continue;
    const name = comp.status?.type?.name ?? "";
    const bets = open.filter((b) => b.matchId === id);
    const h = comp.competitors.find((x) => x.homeAway === "home"), a = comp.competitors.find((x) => x.homeAway === "away");
    const score = `${h?.score ?? "?"} – ${a?.score ?? "?"}`;
    let lines = [];
    if (/POSTPONED|CANCELED|CANCELLED|ABANDONED|SUSPENDED/i.test(name)) {
      for (const b of bets) {
        b.status = "refund";
        if (st.stats[b.userId]) st.stats[b.userId].staked = round2(st.stats[b.userId].staked - b.stake);
        changeBalance(b.userId, b.stake, `Pari sportif remboursé — ${m.home.name}–${m.away.name}`, { force: true });
        client.users.fetch(b.userId).then((u) => u.send(`↩️ **${m.home.name} – ${m.away.name}** n'a pas eu lieu : votre mise de ${formatEuro(b.stake)} est remboursée.`)).catch(() => null);
      }
      lines.push(`↩️ Match reporté ou annulé : ${bets.length} mise${bets.length > 1 ? "s" : ""} remboursée${bets.length > 1 ? "s" : ""}.`);
    } else if (comp.status?.type?.completed) {
      const result = regulationResult(comp);
      if (!result) continue;
      m.result = result;
      m.score = score;
      let paid = 0, winners = 0;
      for (const b of bets) {
        const s = (st.stats[b.userId] ??= { staked: 0, won: 0, bets: 0, wins: 0 });
        if (b.pick === result) {
          b.status = "won";
          b.payout = round2(b.stake * b.odds);
          changeBalance(b.userId, b.payout, `Pari sportif gagné — ${m.home.name}–${m.away.name}`, { force: true });
          s.won = round2(s.won + b.payout);
          s.wins++;
          paid += b.payout;
          winners++;
          client.users.fetch(b.userId).then((u) => u.send(`✅ **Pari gagné !** ${m.home.name} ${score} ${m.away.name}\nVous aviez joué **${pickName(m, b.pick)}** à ${b.odds} : **+${formatEuro(b.payout)}**.`)).catch(() => null);
        } else {
          b.status = "lost";
          client.users.fetch(b.userId).then((u) => u.send(`❌ Pari perdu : ${m.home.name} ${score} ${m.away.name} (vous aviez joué **${pickName(m, b.pick)}**).`)).catch(() => null);
        }
      }
      const best = bets.filter((b) => b.status === "won").sort((x, y) => y.payout - x.payout)[0];
      lines.push(
        `**${m.home.name} ${score} ${m.away.name}** · ${pickName(m, result)}${/AET|PEN/i.test(name) ? " (à la 90e)" : ""}`,
        `🎟️ ${bets.length} pari${bets.length > 1 ? "s" : ""} · ✅ ${winners} gagnant${winners > 1 ? "s" : ""} · 💰 ${formatEuro(paid)} versés` + (best ? `\n🏆 Plus gros gain : **${pseudo(best.userId)}** (+${formatEuro(best.payout)})` : "")
      );
    } else continue;
    save();
    await (channelRef ?? (await client.channels.fetch(st.channelId).catch(() => null)))
      ?.send({ embeds: [new EmbedBuilder().setColor(0x16a34a).setTitle(`🏁 Résultat — ${m.league}`).setDescription(lines.join("\n"))] })
      .catch(() => null);
  }
}

// --- Démarrage ---
async function setupParis(client) {
  const st = load();
  const casino = await client.channels.fetch(require("./casino").CASINO_CHANNEL_ID).catch(() => null);
  const guild = casino?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: st.channelId,
    name: CHANNEL_NAME,
    parent: casino?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  if (st.channelId !== channelRef.id) {
    st.channelId = channelRef.id;
    st.panelId = null;
    save();
  }
  const cycle = async () => {
    await refreshMatches();
    await refreshPanel(client);
  };
  await cycle().catch((err) => console.error("Paris sportifs:", err.message));
  setInterval(() => cycle().catch((err) => console.error("Paris sportifs:", err.message)), REFRESH_MS);
  setInterval(() => settle(client).catch((err) => console.error("Paris sportifs (résultats):", err.message)), SETTLE_MS);
  settle(client).catch(() => null);
  console.log("Paris sportifs prêts");
}

// --- Interactions ---
function betError(userId, m, stake) {
  if (curfew()) return "🌙 **Couvre-feu** : les paris sont suspendus par le régime.";
  if (isFrozen(userId)) return "🔒 Votre compte est **gelé** par l'IRF.";
  if (!m || m.date <= Date.now()) return "⏱️ Ce match a commencé : les paris sont fermés.";
  if (!(stake >= MIN_STAKE && stake <= MAX_STAKE)) return `❌ La mise doit être entre ${formatEuro(MIN_STAKE)} et ${formatEuro(MAX_STAKE)}.`;
  if (lawActive("miseMax") && stake > lawParam("miseMax")) return `📜 **Loi sur le jeu responsable** : mise maximale de **${formatEuro(lawParam("miseMax"))}**.`;
  if (Object.values(load().bets).filter((b) => b.userId === userId && b.status === "open").length >= MAX_OPEN) return `🎟️ Vous avez déjà ${MAX_OPEN} paris en cours : attendez qu'ils se terminent.`;
  if (readBalance(userId) < stake) return `❌ Solde insuffisant (vous avez **${formatEuro(readBalance(userId))}**).`;
  return null;
}
async function handleParisInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("paris_")) return false;
  const st = load(), userId = interaction.user.id;

  if (id === "paris_match") {
    const m = st.matches[interaction.values[0]];
    if (!m || m.date <= Date.now()) {
      await interaction.reply({ content: "⏱️ Ce match a commencé : les paris sont fermés.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply({
      content: `⚽ **${m.home.name} – ${m.away.name}** · ${m.league} · <t:${Math.floor(m.date / 1000)}:F>\nSur quoi pariez-vous ?`,
      files: [await png(await drawMatchCard(m), "match.png")],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`paris_p_${m.id}_home`).setLabel(`1 · ${m.home.name} (${m.odds.home})`.slice(0, 80)).setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`paris_p_${m.id}_draw`).setLabel(`N · Nul (${m.odds.draw})`).setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`paris_p_${m.id}_away`).setLabel(`2 · ${m.away.name} (${m.odds.away})`.slice(0, 80)).setStyle(ButtonStyle.Primary)
        ),
      ],
    });
    return true;
  }
  const p = /^paris_p_(\d+)_(home|draw|away)$/.exec(id);
  if (p) {
    const m = st.matches[p[1]];
    const pre = betError(userId, m, MIN_STAKE);
    if (pre && !pre.startsWith("❌ La mise")) {
      await interaction.reply({ content: pre, ephemeral: true });
      return true;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`paris_m_${m.id}_${p[2]}`)
        .setTitle(`${pickName(m, p[2])} (${m.odds[p[2]]})`.slice(0, 45))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("stake").setLabel(`Votre mise (${MIN_STAKE} à ${MAX_STAKE} €)`).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(6).setPlaceholder(`Solde : ${formatEuro(readBalance(userId))}`.slice(0, 100))
          )
        )
    );
    return true;
  }
  const mm = /^paris_m_(\d+)_(home|draw|away)$/.exec(id);
  if (mm) {
    const m = st.matches[mm[1]], pick = mm[2];
    const stake = parseInt(interaction.fields.getTextInputValue("stake").replace(/[^\d]/g, ""), 10);
    const err = betError(userId, m, stake);
    if (err) {
      await interaction.reply({ content: err, ephemeral: true });
      return true;
    }
    const odds = m.odds[pick];
    if (changeBalance(userId, -stake, `Pari sportif — ${m.home.name}–${m.away.name}`) === null) {
      await interaction.reply({ content: "❌ Paiement refusé (solde insuffisant ou compte gelé).", ephemeral: true });
      return true;
    }
    const bet = { id: `p${st.next++}`, userId, matchId: m.id, pick, odds, stake, at: Date.now(), status: "open" };
    st.bets[bet.id] = bet;
    const s = (st.stats[userId] ??= { staked: 0, won: 0, bets: 0, wins: 0 });
    s.staked = round2(s.staked + stake);
    s.bets++;
    save();
    await interaction.reply({
      ephemeral: true,
      content: `🎟️ **Pari enregistré !** ${m.home.name} – ${m.away.name}\n**${pickName(m, pick)}** à **${odds}** · mise ${formatEuro(stake)} → gain possible **${formatEuro(round2(stake * odds))}**\nRésultat <t:${Math.floor((m.date + 115 * 60000) / 1000)}:R> environ : vous serez prévenu(e) en message privé.`,
    });
    if (stake >= 300) channelRef?.send(`🎟️ **${pseudo(userId)}** mise **${formatEuro(stake)}** sur **${pickName(m, pick)}** (${m.home.name} – ${m.away.name}, cote ${odds}).`).catch(() => null);
    return true;
  }
  if (id === "paris_mine") {
    const mine = Object.values(st.bets).filter((b) => b.userId === userId).sort((a, b) => b.at - a.at);
    const line = (b) => {
      const m = st.matches[b.matchId];
      const label = m ? `${m.home.name} – ${m.away.name}` : "Match";
      const status = b.status === "open" ? `⏳ <t:${Math.floor((m?.date ?? 0) / 1000)}:R>` : b.status === "won" ? `✅ +${formatEuro(b.payout ?? 0)}` : b.status === "lost" ? "❌ perdu" : "↩️ remboursé";
      return `${status} · **${label}** · ${m ? pickName(m, b.pick) : b.pick} à ${b.odds} · ${formatEuro(b.stake)}`;
    };
    const s = st.stats[userId];
    const open = mine.filter((b) => b.status === "open"), done = mine.filter((b) => b.status !== "open").slice(0, 8);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(0x16a34a)
          .setTitle("🎟️ Mes paris")
          .setDescription(
            (open.length ? `**En cours**\n${open.map(line).join("\n")}` : "*Aucun pari en cours.*") +
              (done.length ? `\n\n**Derniers résultats**\n${done.map(line).join("\n")}` : "") +
              (s ? `\n\n📊 ${s.bets} pari${s.bets > 1 ? "s" : ""} · ${s.wins} gagné${s.wins > 1 ? "s" : ""} · bilan **${s.won - s.staked >= 0 ? "+" : ""}${formatEuro(round2(s.won - s.staked))}**` : "")
          ),
      ],
    });
    return true;
  }
  return false;
}

module.exports = { setupParis, handleParisInteraction, refreshMatches, settle, panelPayload, drawBoard, drawMatchCard, upcoming, regulationResult, parseEvent, LEAGUES };
