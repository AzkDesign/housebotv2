// Tribunal de la Maison : /proces ouvre une affaire contre un membre.
// 1. Audience : un salon du procès s'ouvre (lecture pour tous) ; l'accusé se défend face au jury (la Fondation).
// 2. Délibération : chaque juré vote en secret (non coupable, amende, travail imposé, exclusion…).
// 3. Verdict : le juge prononce la sentence (le vote du jury est proposé par défaut). Amende prélevée
//    (le reste devient une dette), travail imposé noté au casier, exclusion temporaire = exclusion Discord.
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
  ChannelType,
  PermissionFlagsBits,
} = require("discord.js");
const { findOrCreateChannel } = require("./salons");
const { changeBalance, readBalance, addToTreasury, getTaxDebt, setTaxDebt, formatEuro } = require("./economie");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // sert à retrouver le serveur
const GERANTS_ROLE_ID = "1509985135565475850";
const FONDATION_ROLE_ID = "1509979964651343993";
const CATEGORY_NAME = "⚖️ Tribunal";
const PUBLIC_NAME = "⚖️・tribunal";
const CLOSED_KEEP_MS = 48 * 3600000; // le salon d'un procès terminé est supprimé après 48 h
const MAX_TIMEOUT_MS = 28 * 86400000; // limite de Discord pour une exclusion temporaire
const STATE_FILE = require("./data").dataFile("proces-state.json");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["playfair-display-700.ttf", "CardSerif"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
  ["playfair-display-700-italic.ttf", "CardItalic"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}

// Peines possibles
const SANCTIONS = {
  acquitte: { label: "Non coupable", emoji: "🕊️", desc: "Acquittement : aucune sanction" },
  amende: { label: "Amende", emoji: "💶", desc: "Une somme prélevée sur son compte" },
  travail: { label: "Travail imposé", emoji: "🧹", desc: "Une tâche à accomplir pour la Maison" },
  exclusion: { label: "Exclusion temporaire", emoji: "⛔", desc: "Ne peut plus écrire ni parler pendant un temps" },
  expulsion: { label: "Expulsion du serveur", emoji: "🚪", desc: "Renvoyé(e) de la Maison" },
};
const FLAG = { amende: "a", travail: "t", exclusion: "x", expulsion: "k", acquitte: "q" };
const FROM_FLAG = Object.fromEntries(Object.entries(FLAG).map(([k, v]) => [v, k]));

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.next ??= 1;
  state.trials ??= {};
  state.casier ??= {};
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const caseNo = (n) => String(n).padStart(3, "0");
const isDirection = (member) =>
  member?.roles?.cache?.has(GERANTS_ROLE_ID) || member?.roles?.cache?.has(FONDATION_ROLE_ID) || member?.permissions?.has?.(PermissionFlagsBits.Administrator) || false;
const isJuror = (member, tr) => member?.id !== tr.accusedId && (member?.roles?.cache?.has(FONDATION_ROLE_ID) || member?.roles?.cache?.has(GERANTS_ROLE_ID));

// « 3j », « 12h », « 30 min », « 2 jours », « 1 semaine »
function parseDuration(text) {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*(min|minutes?|m|h|heures?|j|jours?|d|s|sem|semaines?)?\s*$/i.exec(String(text ?? ""));
  if (!m) return null;
  const n = Number(m[1].replace(",", ".")), u = (m[2] ?? "h").toLowerCase();
  const unit = /^m/.test(u) ? 60000 : /^h/.test(u) ? 3600000 : /^(j|d)/.test(u) ? 86400000 : 7 * 86400000;
  const ms = Math.round(n * unit);
  return ms > 0 ? Math.min(ms, MAX_TIMEOUT_MS) : null;
}
function durationText(ms) {
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), min = Math.round((ms % 3600000) / 60000);
  return [d && `${d} jour${d > 1 ? "s" : ""}`, h && `${h} h`, min && `${min} min`].filter(Boolean).join(" ") || "quelques instants";
}
const amountOf = (text) => {
  const n = Number(String(text ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};

// --- Images ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function spaced(ctx, text, x, y, gap) {
  const chars = [...text];
  const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (chars.length - 1);
  let cx = x - (ctx.textAlign === "center" ? total / 2 : 0);
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.textAlign = align;
}
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split(/\n/)) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
function fit(ctx, text, maxW, size, family) {
  let s = size;
  ctx.font = `${s}px ${family}`;
  while (s > 14 && ctx.measureText(text).width > maxW) ctx.font = `${--s}px ${family}`;
  return s;
}
const GOLD = ["#fff3c4", "#e9c46a", "#b8862b", "#7a5414"];
function gold(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD[2]);
  g.addColorStop(0.4, GOLD[0]);
  g.addColorStop(0.6, GOLD[1]);
  g.addColorStop(1, GOLD[3]);
  return g;
}
// balance de la justice
function scales(ctx, x, y, s, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = gold(ctx, -s, -s, s, s);
  ctx.fillStyle = gold(ctx, -s, -s, s, s);
  ctx.lineWidth = s * 0.06;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.9);
  ctx.lineTo(0, s * 0.75);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, s * 0.8);
  ctx.lineTo(s * 0.4, s * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -s * 0.95, s * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(-s * 0.85, -s * 0.6);
  ctx.lineTo(s * 0.85, -s * 0.6);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const px = side * s * 0.78, py = -s * 0.6;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-tilt);
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-s * 0.26, s * 0.55);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.26, s * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-s * 0.32, s * 0.55);
    ctx.quadraticCurveTo(0, s * 0.82, s * 0.32, s * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function courtBackground(ctx, W, H, tint = "#3b0d0d") {
  const bg = ctx.createRadialGradient(W / 2, H * 0.35, 60, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, tint);
  bg.addColorStop(1, "#0b0505");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // colonnes du palais de justice
  for (const x of [70, W - 70]) {
    const g = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
    g.addColorStop(0, "rgba(255,240,210,0.03)");
    g.addColorStop(0.5, "rgba(255,240,210,0.10)");
    g.addColorStop(1, "rgba(255,240,210,0.03)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 26, 40, 52, H - 80);
    for (let i = -18; i <= 18; i += 9) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(x + i, 52, 2, H - 104);
    }
    ctx.fillStyle = "rgba(255,240,210,0.12)";
    ctx.fillRect(x - 34, 30, 68, 14);
    ctx.fillRect(x - 34, H - 44, 68, 14);
  }
  ctx.strokeStyle = gold(ctx, 0, 0, W, H);
  ctx.lineWidth = 3;
  roundRect(ctx, 16, 16, W - 32, H - 32, 14);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundRect(ctx, 26, 26, W - 52, H - 52, 10);
  ctx.stroke();
}
async function avatarDisc(ctx, url, x, y, r, ring = GOLD[2]) {
  const img = url ? await loadImage(url).catch(() => null) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.stroke();
}

async function drawOpening(tr) {
  const W = 1200, H = 720, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  courtBackground(ctx, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e9c46a";
  ctx.font = "20px CardEngrave";
  spaced(ctx, "TRIBUNAL DE LA MAISON", W / 2, 82, 7);
  ctx.fillStyle = "#ffffff";
  ctx.font = "60px CardTitle";
  spaced(ctx, `AFFAIRE N° ${caseNo(tr.no)}`, W / 2, 152, 4);
  scales(ctx, W / 2, 262, 62, -0.08);
  // les deux parties
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#c9a96e";
  spaced(ctx, "LA MAISON", 300, 238, 5);
  spaced(ctx, "L'ACCUSÉ(E)", 900, 238, 5);
  ctx.font = "28px CardItalic";
  ctx.fillStyle = "#e7d7b8";
  ctx.fillText("contre", W / 2, 362);
  ctx.font = "26px CardSerif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Représentée par", 300, 290);
  fit(ctx, tr.judgeName, 330, 34, "CardTitle");
  ctx.fillStyle = "#fde68a";
  ctx.fillText(tr.judgeName, 300, 334);
  await avatarDisc(ctx, tr.accusedAvatar, 900, 296, 48, "#dc2626");
  fit(ctx, tr.accusedName, 330, 38, "CardTitle");
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tr.accusedName, 900, 386);
  if (tr.priors) {
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#f87171";
    ctx.fillText(`${tr.priors} antécédent${tr.priors > 1 ? "s" : ""} au casier`, 900, 414);
  }
  // chef d'accusation
  roundRect(ctx, 150, 446, W - 300, 170, 14);
  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,196,106,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#c9a96e";
  spaced(ctx, "CHEF D'ACCUSATION", W / 2, 482, 5);
  ctx.font = "25px CardItalic";
  ctx.fillStyle = "#f5ecd8";
  const lines = wrap(ctx, `« ${tr.charge} »`, W - 380);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(i === 2 && lines.length > 3 ? `${l.replace(/\s*\S*$/, "")}…` : l, W / 2, 526 + i * 34));
  ctx.font = "16px CardText";
  ctx.fillStyle = "#c9a96e";
  ctx.fillText("Jury : la Fondation · L'accusé(e) peut se défendre dans ce salon · Le verdict sera rendu après délibération", W / 2, 662);
  return c;
}

async function drawVerdict(tr) {
  const W = 1200, H = 760, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const free = tr.verdict.sanctions.includes("acquitte");
  courtBackground(ctx, W, H, free ? "#0f3b24" : "#3b0d0d");
  ctx.textAlign = "center";
  ctx.fillStyle = "#e9c46a";
  ctx.font = "20px CardEngrave";
  spaced(ctx, `TRIBUNAL DE LA MAISON · AFFAIRE N° ${caseNo(tr.no)}`, W / 2, 82, 5);
  ctx.font = "84px CardTitle";
  ctx.fillStyle = free ? "#86efac" : "#fca5a5";
  spaced(ctx, "VERDICT", W / 2, 172, 10);
  await avatarDisc(ctx, tr.accusedAvatar, W / 2, 262, 52, free ? "#16a34a" : "#dc2626");
  fit(ctx, tr.accusedName, 600, 40, "CardTitle");
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tr.accusedName, W / 2, 360);
  ctx.font = "30px CardSerif";
  ctx.fillStyle = free ? "#86efac" : "#fca5a5";
  ctx.fillText(free ? "est déclaré(e) NON COUPABLE" : "est déclaré(e) COUPABLE", W / 2, 404);
  // peines
  const items = free
    ? [["🕊️", "Acquittement", "Aucune sanction n'est retenue."]]
    : tr.verdict.sanctions.map((k) => {
        const v = tr.verdict;
        if (k === "amende") return ["💶", "Amende", `${formatEuro(v.amount)}${v.debt ? ` · dont ${formatEuro(v.debt)} en dette` : ""}`];
        if (k === "travail") return ["🧹", "Travail imposé", v.work];
        if (k === "exclusion") return ["⛔", "Exclusion temporaire", durationText(v.duration)];
        if (k === "expulsion") return ["🚪", "Expulsion", "Renvoyé(e) du serveur"];
        return ["•", SANCTIONS[k]?.label ?? k, ""];
      });
  const bw = Math.min(330, (W - 260) / items.length - 20), bh = 150, gap = 22;
  const x0 = W / 2 - (items.length * bw + (items.length - 1) * gap) / 2;
  for (const [i, [, title, text]] of items.entries()) {
    const bx = x0 + i * (bw + gap), by = 438;
    roundRect(ctx, bx, by, bw, bh, 14);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(233,196,106,0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#c9a96e";
    spaced(ctx, title.toUpperCase(), bx + bw / 2, by + 36, 3);
    ctx.font = "22px CardSerif";
    ctx.fillStyle = "#ffffff";
    wrap(ctx, text, bw - 30)
      .slice(0, 3)
      .forEach((l, j) => ctx.fillText(l, bx + bw / 2, by + 74 + j * 28));
  }
  // jury et commentaire
  const t = tr.verdict.tally;
  ctx.font = "16px CardText";
  ctx.fillStyle = "#c9a96e";
  ctx.fillText(`Jury : ${t.voters} juré${t.voters > 1 ? "s" : ""} · ${t.guilty} pour une sanction, ${t.voters - t.guilty} pour l'acquittement`, W / 2, 626);
  if (tr.verdict.comment) {
    ctx.font = "20px CardItalic";
    ctx.fillStyle = "#f5ecd8";
    const l = wrap(ctx, `« ${tr.verdict.comment} »`, W - 300);
    l.slice(0, 2).forEach((line, i) => ctx.fillText(line, W / 2, 664 + i * 28));
  }
  ctx.font = "14px CardBold";
  ctx.fillStyle = "#9a7a45";
  ctx.fillText(`Rendu par ${tr.verdict.byName} · ${new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long" }).format(new Date(tr.verdict.at))}`, W / 2, H - 46);
  return c;
}
const png = async (canvas, name) => new AttachmentBuilder(await canvas.encode("png"), { name });

// --- Panneau du procès ---
function tally(tr) {
  const votes = Object.values(tr.votes ?? {});
  const counts = Object.fromEntries(Object.keys(SANCTIONS).map((k) => [k, votes.filter((v) => v.includes(k)).length]));
  return { voters: votes.length, guilty: votes.filter((v) => !v.includes("acquitte")).length, counts };
}
// peines retenues par le jury : celles votées par au moins la moitié des jurés
function juryChoice(tr) {
  const t = tally(tr);
  if (!t.voters || t.guilty * 2 < t.voters) return ["acquitte"];
  const picked = Object.keys(SANCTIONS).filter((k) => k !== "acquitte" && t.counts[k] * 2 >= t.voters);
  if (picked.length) return picked;
  const best = Object.keys(SANCTIONS).filter((k) => k !== "acquitte").sort((a, b) => t.counts[b] - t.counts[a])[0];
  return [best];
}
function panelPayload(tr) {
  const t = tally(tr);
  const phase = { audience: "🎙️ Audience en cours", deliberation: "🗳️ Le jury délibère", closed: "📁 Affaire close" }[tr.phase];
  const e = new EmbedBuilder()
    .setColor(tr.phase === "deliberation" ? 0x7c3aed : tr.phase === "closed" ? 0x6b7280 : 0xb91c1c)
    .setTitle(`⚖️ Affaire n° ${caseNo(tr.no)} — ${phase}`)
    .setDescription(
      (tr.phase === "audience"
        ? `**<@${tr.accusedId}>**, vous êtes appelé(e) à la barre. Expliquez-vous ici : le jury (**la Fondation**) peut vous poser ses questions.\n\nQuand les débats sont terminés, le juge ouvre les délibérations.`
        : tr.phase === "deliberation"
          ? "Les jurés votent **en secret** avec le menu ci-dessous (plusieurs peines possibles). Le juge rend ensuite le verdict."
          : "Le verdict a été rendu.") + (tr.evidence ? `\n\n📎 **Éléments du dossier :** ${tr.evidence}` : "")
    )
    .addFields(
      { name: "Accusé(e)", value: `<@${tr.accusedId}>`, inline: true },
      { name: "Juge", value: `<@${tr.judgeId}>`, inline: true },
      { name: "Jury", value: `<@&${FONDATION_ROLE_ID}>`, inline: true }
    );
  if (tr.phase === "deliberation") e.addFields({ name: "Votes du jury", value: `🗳️ **${t.voters}** juré${t.voters > 1 ? "s ont" : " a"} voté (résultats révélés au verdict)` });
  const rows = [];
  if (tr.phase === "audience")
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`proc_delib_${tr.no}`).setLabel("Ouvrir les délibérations").setEmoji("🗳️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`proc_classer_${tr.no}`).setLabel("Classer l'affaire").setEmoji("🗂️").setStyle(ButtonStyle.Secondary)
      )
    );
  if (tr.phase === "deliberation") {
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`proc_vote_${tr.no}`)
          .setPlaceholder("Juré(e) : votre décision…")
          .setMinValues(1)
          .setMaxValues(4)
          .addOptions(Object.entries(SANCTIONS).map(([k, s]) => ({ label: s.label, value: k, emoji: s.emoji, description: s.desc })))
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`proc_verdict_${tr.no}`).setLabel("Rendre le verdict").setEmoji("⚖️").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`proc_classer_${tr.no}`).setLabel("Classer l'affaire").setEmoji("🗂️").setStyle(ButtonStyle.Secondary)
      )
    );
  }
  if (tr.phase === "closed" && tr.verdict?.sanctions.includes("travail") && !tr.workDone)
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`proc_tig_${tr.no}`).setLabel("Travail imposé effectué").setEmoji("✅").setStyle(ButtonStyle.Success)));
  return { embeds: [e], components: rows };
}
async function refreshPanel(tr, client) {
  const ch = await client.channels.fetch(tr.channelId).catch(() => null);
  const msg = tr.panelId ? await ch?.messages.fetch(tr.panelId).catch(() => null) : null;
  await msg?.edit(panelPayload(tr)).catch(() => null);
}

// --- Verdict ---
async function executeVerdict(tr, sanctions, details, interaction, client) {
  const guild = interaction.guild;
  const member = await guild.members.fetch(tr.accusedId).catch(() => null);
  const t = tally(tr);
  const v = { sanctions, at: Date.now(), byId: interaction.user.id, byName: interaction.member?.displayName ?? interaction.user.username, tally: { voters: t.voters, guilty: t.guilty }, comment: details.comment || null };
  const notes = [];
  if (sanctions.includes("amende")) {
    v.amount = details.amount;
    const paid = Math.min(readBalance(tr.accusedId), v.amount);
    if (paid > 0) {
      changeBalance(tr.accusedId, -paid, `Amende — affaire n° ${caseNo(tr.no)}`, { force: true });
      addToTreasury("amendes", paid);
    }
    const rest = Math.round((v.amount - paid) * 100) / 100;
    if (rest > 0) {
      const debt = getTaxDebt(tr.accusedId) ?? { amount: 0, weeks: 0 };
      debt.amount = Math.round((debt.amount + rest) * 100) / 100;
      setTaxDebt(tr.accusedId, debt);
      v.debt = rest;
      notes.push(`💶 ${formatEuro(paid)} prélevés ; ${formatEuro(rest)} ajoutés à sa dette (saisis sur ses prochains revenus).`);
    } else notes.push(`💶 Amende de ${formatEuro(v.amount)} prélevée et versée au Trésor.`);
  }
  if (sanctions.includes("travail")) v.work = details.work;
  if (sanctions.includes("exclusion")) {
    v.duration = details.duration;
    const ok = await member?.timeout(v.duration, `Affaire n° ${caseNo(tr.no)} — exclusion temporaire`).then(() => true).catch(() => false);
    notes.push(ok ? `⛔ Exclusion temporaire appliquée jusqu'au <t:${Math.floor((Date.now() + v.duration) / 1000)}:f>.` : "⚠️ Exclusion temporaire impossible à appliquer (permissions du bot ou rôle trop haut) : à faire à la main.");
  }
  tr.verdict = v;
  tr.phase = "closed";
  tr.closedAt = Date.now();
  const st = load();
  if (!sanctions.includes("acquitte")) (st.casier[tr.accusedId] ??= []).push({ no: tr.no, at: v.at, charge: tr.charge, sanctions, amount: v.amount, work: v.work, duration: v.duration });
  save();
  return { notes, member };
}
function verdictLines(tr) {
  const v = tr.verdict;
  if (v.sanctions.includes("acquitte")) return "🕊️ **Non coupable** : aucune sanction.";
  return v.sanctions
    .map((k) =>
      k === "amende" ? `💶 **Amende** de ${formatEuro(v.amount)}` : k === "travail" ? `🧹 **Travail imposé** : ${v.work}` : k === "exclusion" ? `⛔ **Exclusion temporaire** : ${durationText(v.duration)}` : k === "expulsion" ? "🚪 **Expulsion** du serveur" : k
    )
    .join("\n");
}

// --- Démarrage ---
let categoryId = null, publicRef = null;
async function setupProces(client) {
  const st = load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  const readOnly = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
    { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageChannels] },
  ];
  const category = await findOrCreateChannel(guild, { id: st.categoryId, name: CATEGORY_NAME, type: ChannelType.GuildCategory });
  categoryId = category.id;
  publicRef = await findOrCreateChannel(guild, { id: st.publicId, name: PUBLIC_NAME, parent: categoryId, permissionOverwrites: readOnly });
  if (st.publicId !== publicRef.id) {
    await publicRef
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xb8862b)
            .setTitle("⚖️ Le Tribunal de la Maison")
            .setDescription(
              "Quand un membre fait une bêtise, la Direction peut ouvrir un **procès** avec `/proces`.\n\n" +
                "**1. Audience** : un salon s'ouvre pour l'affaire. Tout le monde peut suivre, l'accusé(e) se défend face au **jury : la Fondation**.\n" +
                "**2. Délibération** : chaque juré vote en secret.\n" +
                "**3. Verdict** : acquittement, **amende**, **travail imposé**, **exclusion temporaire** ou **expulsion**. Il est publié ici.\n\n" +
                "Le casier judiciaire d'un membre : `/casier`."
            ),
        ],
      })
      .catch(() => null);
  }
  st.categoryId = categoryId;
  st.publicId = publicRef.id;
  save();
  // les salons des affaires closes depuis 48 h sont supprimés
  setInterval(async () => {
    for (const tr of Object.values(load().trials)) {
      if (tr.phase !== "closed" || tr.channelGone || Date.now() - tr.closedAt < CLOSED_KEEP_MS) continue;
      tr.channelGone = true;
      save();
      const ch = await client.channels.fetch(tr.channelId).catch(() => null);
      await ch?.delete("Affaire close depuis 48 h").catch(() => null);
    }
  }, 10 * 60000);
  console.log("Tribunal prêt");
}

// sentence en cours de choix par le juge : « affaire:juge » -> peines
const sentenceDrafts = new Map();
function sentenceRows(tr, picked) {
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`proc_vsel_${tr.no}`)
        .setPlaceholder("Sentence prononcée…")
        .setMinValues(1)
        .setMaxValues(4)
        .addOptions(Object.entries(SANCTIONS).map(([k, sc]) => ({ label: sc.label, value: k, emoji: sc.emoji, description: sc.desc, default: picked.includes(k) })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`proc_vgo_${tr.no}`).setLabel(`Prononcer : ${picked.map((k) => SANCTIONS[k].label).join(" + ")}`.slice(0, 80)).setEmoji("⚖️").setStyle(ButtonStyle.Danger)
    ),
  ];
}

// --- Interactions ---
async function handleProcesInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "casier") {
    const user = interaction.options.getUser("membre") ?? interaction.user;
    const list = load().casier[user.id] ?? [];
    const lines = list
      .slice(-10)
      .reverse()
      .map((x) => `**Affaire n° ${caseNo(x.no)}** · <t:${Math.floor(x.at / 1000)}:D>\n└ ${x.charge.slice(0, 120)} → ${x.sanctions.map((k) => SANCTIONS[k]?.emoji ?? "").join(" ")} ${x.sanctions.map((k) => (k === "amende" ? formatEuro(x.amount) : k === "exclusion" ? durationText(x.duration) : SANCTIONS[k]?.label)).join(", ")}`);
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(list.length ? 0xb91c1c : 0x16a34a)
          .setTitle(`📁 Casier judiciaire — ${interaction.options.getMember("membre")?.displayName ?? user.username}`)
          .setDescription(list.length ? `**${list.length}** condamnation${list.length > 1 ? "s" : ""}\n\n${lines.join("\n\n")}` : "Casier vierge. ✨"),
      ],
    });
    return true;
  }

  if (interaction.isChatInputCommand?.() && interaction.commandName === "proces") {
    if (!isDirection(interaction.member)) {
      await interaction.reply({ content: "⛔ Seule la Direction (gérants, Fondation) peut ouvrir un procès.", ephemeral: true });
      return true;
    }
    const target = interaction.options.getUser("membre");
    if (target.bot || target.id === interaction.user.id) {
      await interaction.reply({ content: "❌ Choisissez un autre membre (pas vous-même, ni un bot).", ephemeral: true });
      return true;
    }
    const st = load();
    if (Object.values(st.trials).some((t) => t.accusedId === target.id && t.phase !== "closed")) {
      await interaction.reply({ content: "⚖️ Ce membre a déjà un procès en cours.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const member = interaction.options.getMember("membre") ?? (await guild.members.fetch(target.id).catch(() => null));
    const tr = {
      no: st.next++,
      accusedId: target.id,
      accusedName: member?.displayName ?? target.globalName ?? target.username,
      accusedAvatar: (member ?? target).displayAvatarURL({ extension: "png", size: 128 }),
      judgeId: interaction.user.id,
      judgeName: interaction.member?.displayName ?? interaction.user.username,
      charge: interaction.options.getString("accusation").slice(0, 400),
      evidence: interaction.options.getString("preuves")?.slice(0, 400) ?? null,
      priors: (st.casier[target.id] ?? []).length,
      phase: "audience",
      votes: {},
      at: Date.now(),
    };
    const slug = tr.accusedName.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "membre";
    const parent = categoryId ?? st.categoryId;
    const channel = await guild.channels
      .create({
        name: `⚖️・affaire-${caseNo(tr.no)}-${slug}`,
        type: ChannelType.GuildText,
        parent: parent ?? undefined,
        topic: `Affaire n° ${caseNo(tr.no)} : la Maison contre ${tr.accusedName}`,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
          { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ManageChannels] },
          { id: target.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: FONDATION_ROLE_ID, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
          { id: GERANTS_ROLE_ID, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
        ],
      })
      .catch((err) => (console.error("Procès (salon):", err.message), null));
    if (!channel) {
      st.next--;
      await interaction.editReply("❌ Impossible de créer le salon du procès (permissions du bot ?).");
      return true;
    }
    tr.channelId = channel.id;
    await channel.send({
      content: `⚖️ <@${tr.accusedId}>, vous êtes convoqué(e) devant le **Tribunal de la Maison**. <@&${FONDATION_ROLE_ID}>, le jury est appelé à siéger.`,
      files: [await png(await drawOpening(tr), "audience.png")],
      allowedMentions: { users: [tr.accusedId], roles: [FONDATION_ROLE_ID] },
    });
    const panel = await channel.send(panelPayload(tr));
    tr.panelId = panel.id;
    st.trials[tr.no] = tr;
    save();
    await publicRef?.send({ content: `⚖️ **Ouverture de l'affaire n° ${caseNo(tr.no)}** : la Maison contre **${tr.accusedName}**. L'audience se tient dans ${channel}.` }).catch(() => null);
    target.send(`⚖️ Vous êtes convoqué(e) devant le **Tribunal de la Maison** (affaire n° ${caseNo(tr.no)}).\n**Accusation :** ${tr.charge}\nVenez vous défendre ici : ${channel.url}`).catch(() => null);
    await interaction.editReply(`✅ Procès ouvert : ${channel}`);
    return true;
  }

  const id = interaction.customId;
  const m = typeof id === "string" ? /^proc_(delib|classer|vote|verdict|vsel|vgo|vm|tig)_(\d+)(?:_(\w+))?$/.exec(id) : null;
  if (!m) return false;
  const [, action, no, extra] = m;
  const tr = load().trials[no];
  if (!tr) {
    await interaction.reply({ content: "ℹ️ Cette affaire n'existe plus.", ephemeral: true });
    return true;
  }
  const judge = interaction.user.id === tr.judgeId || isDirection(interaction.member);

  if (action === "tig") {
    if (!judge) return interaction.reply({ content: "⛔ Réservé à la Direction.", ephemeral: true }).then(() => true);
    tr.workDone = Date.now();
    const entry = (load().casier[tr.accusedId] ?? []).find((x) => x.no === tr.no);
    if (entry) entry.workDone = tr.workDone;
    save();
    await interaction.update(panelPayload(tr));
    await interaction.channel?.send(`✅ Le travail imposé de <@${tr.accusedId}> est **effectué**. Affaire réglée.`).catch(() => null);
    return true;
  }
  if (tr.phase === "closed") {
    await interaction.reply({ content: "📁 Cette affaire est close.", ephemeral: true });
    return true;
  }
  if (action === "delib" || action === "classer") {
    if (!judge || interaction.user.id === tr.accusedId) return interaction.reply({ content: "⛔ Réservé au juge et à la Direction.", ephemeral: true }).then(() => true);
    if (action === "delib") {
      tr.phase = "deliberation";
      save();
      await interaction.update(panelPayload(tr));
      await interaction.channel
        ?.send({ content: `🗳️ <@&${FONDATION_ROLE_ID}> : les débats sont clos, **le jury délibère**. Votez avec le menu ci-dessus.`, allowedMentions: { roles: [FONDATION_ROLE_ID] } })
        .catch(() => null);
      return true;
    }
    tr.phase = "closed";
    tr.closedAt = Date.now();
    tr.verdict = null;
    save();
    await interaction.update(panelPayload(tr));
    await interaction.channel?.send(`🗂️ L'affaire n° ${caseNo(tr.no)} est **classée sans suite** par ${interaction.member?.displayName ?? interaction.user.username}.`).catch(() => null);
    await interaction.channel?.permissionOverwrites.edit(tr.accusedId, { SendMessages: false }).catch(() => null);
    await publicRef?.send(`🗂️ L'affaire n° ${caseNo(tr.no)} (la Maison contre **${tr.accusedName}**) est **classée sans suite**.`).catch(() => null);
    return true;
  }
  if (action === "vote") {
    if (tr.phase !== "deliberation") return interaction.reply({ content: "ℹ️ Le jury ne délibère pas encore.", ephemeral: true }).then(() => true);
    if (!isJuror(interaction.member, tr)) return interaction.reply({ content: "⛔ Seuls les jurés (la Fondation) votent. L'accusé(e) ne vote pas.", ephemeral: true }).then(() => true);
    let values = interaction.values;
    if (values.includes("acquitte")) values = ["acquitte"];
    const changed = Boolean(tr.votes[interaction.user.id]);
    tr.votes[interaction.user.id] = values;
    save();
    await interaction.reply({ content: `🗳️ Vote ${changed ? "modifié" : "enregistré"} : ${values.map((k) => `${SANCTIONS[k].emoji} ${SANCTIONS[k].label}`).join(", ")}. Il reste secret jusqu'au verdict.`, ephemeral: true });
    await refreshPanel(tr, client);
    return true;
  }
  if (action === "verdict") {
    if (!judge || interaction.user.id === tr.accusedId) return interaction.reply({ content: "⛔ Seul le juge (ou la Direction) rend le verdict.", ephemeral: true }).then(() => true);
    const t = tally(tr), choice = juryChoice(tr);
    sentenceDrafts.set(`${tr.no}:${interaction.user.id}`, choice);
    const summary = t.voters
      ? Object.entries(SANCTIONS)
          .map(([k, s]) => `${s.emoji} ${s.label} : **${t.counts[k]}**`)
          .join("\n")
      : "*Aucun juré n'a voté.*";
    await interaction.reply({
      ephemeral: true,
      content: `⚖️ **Votes du jury** (${t.voters} juré${t.voters > 1 ? "s" : ""}) :\n${summary}\n\nLa décision du jury est présélectionnée : ajustez-la si besoin dans le menu, puis cliquez sur **Prononcer**.`,
      components: sentenceRows(tr, choice),
    });
    return true;
  }
  // le menu mémorise seulement le choix (Discord ne réagit pas si l'on garde la présélection)
  if (action === "vsel") {
    let picked = interaction.values;
    if (picked.includes("acquitte")) picked = ["acquitte"];
    sentenceDrafts.set(`${tr.no}:${interaction.user.id}`, picked);
    await interaction.update({ components: sentenceRows(tr, picked) });
    return true;
  }
  if (action === "vgo") {
    if (!judge || interaction.user.id === tr.accusedId) return interaction.reply({ content: "⛔ Seul le juge (ou la Direction) rend le verdict.", ephemeral: true }).then(() => true);
    const picked = sentenceDrafts.get(`${tr.no}:${interaction.user.id}`) ?? juryChoice(tr);
    const flags = picked.map((k) => FLAG[k]).join("");
    const rows = [];
    if (picked.includes("amende")) rows.push(new TextInputBuilder().setCustomId("amount").setLabel("Montant de l'amende (€)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12).setPlaceholder("Ex. : 5000"));
    if (picked.includes("travail")) rows.push(new TextInputBuilder().setCustomId("work").setLabel("Travail imposé").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setPlaceholder("Ex. : faire la vaisselle de toute la Maison pendant une semaine"));
    if (picked.includes("exclusion")) rows.push(new TextInputBuilder().setCustomId("duration").setLabel("Durée de l'exclusion (max 28 jours)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(20).setPlaceholder("Ex. : 2j, 12h, 30min"));
    rows.push(new TextInputBuilder().setCustomId("comment").setLabel("Mot du tribunal (facultatif)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300));
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`proc_vm_${tr.no}_${flags}`)
        .setTitle(`⚖️ Verdict — affaire n° ${caseNo(tr.no)}`)
        .addComponents(rows.map((r) => new ActionRowBuilder().addComponents(r)))
    );
    return true;
  }
  if (action === "vm") {
    if (!judge || interaction.user.id === tr.accusedId) return interaction.reply({ content: "⛔ Seul le juge (ou la Direction) rend le verdict.", ephemeral: true }).then(() => true);
    const sanctions = [...(extra ?? "")].map((f) => FROM_FLAG[f]).filter(Boolean);
    const field = (k) => {
      try {
        return interaction.fields.getTextInputValue(k).trim();
      } catch {
        return "";
      }
    };
    const details = { comment: field("comment") };
    if (sanctions.includes("amende") && !(details.amount = amountOf(field("amount")))) return interaction.reply({ content: "❌ Montant de l'amende invalide.", ephemeral: true }).then(() => true);
    if (sanctions.includes("travail")) details.work = field("work");
    if (sanctions.includes("exclusion") && !(details.duration = parseDuration(field("duration")))) return interaction.reply({ content: "❌ Durée invalide. Écrivez par exemple `2j`, `12h` ou `30min`.", ephemeral: true }).then(() => true);
    await interaction.deferReply({ ephemeral: true });
    const { notes, member } = await executeVerdict(tr, sanctions, details, interaction, client);
    const ch = await client.channels.fetch(tr.channelId).catch(() => null);
    const free = sanctions.includes("acquitte");
    const embed = new EmbedBuilder()
      .setColor(free ? 0x16a34a : 0xb91c1c)
      .setTitle(`⚖️ Verdict — affaire n° ${caseNo(tr.no)}`)
      .setDescription(`**${tr.accusedName}** est déclaré(e) **${free ? "non coupable" : "coupable"}**.\n\n${verdictLines(tr)}${tr.verdict.comment ? `\n\n*« ${tr.verdict.comment} »*` : ""}`)
      .setImage("attachment://verdict.png");
    await ch?.send({ content: `<@${tr.accusedId}>`, embeds: [embed], files: [await png(await drawVerdict(tr), "verdict.png")], allowedMentions: { users: [tr.accusedId] } }).catch(() => null);
    await refreshPanel(tr, client);
    await ch?.permissionOverwrites.edit(tr.accusedId, { SendMessages: false }).catch(() => null);
    await publicRef?.send({ embeds: [EmbedBuilder.from(embed).setDescription(`La Maison contre **${tr.accusedName}** : ${free ? "**non coupable**" : "**coupable**"}.\n\n${verdictLines(tr)}`)], files: [await png(await drawVerdict(tr), "verdict.png")] }).catch(() => null);
    const dm = `⚖️ **Verdict de l'affaire n° ${caseNo(tr.no)}** : vous êtes déclaré(e) **${free ? "non coupable" : "coupable"}**.\n${verdictLines(tr)}`;
    // l'expulsion en dernier : le membre doit d'abord recevoir son verdict
    const user = member?.user ?? (await client.users.fetch(tr.accusedId).catch(() => null));
    await user?.send(dm).catch(() => null);
    if (sanctions.includes("expulsion")) {
      const ok = await member?.kick(`Affaire n° ${caseNo(tr.no)} — expulsion`).then(() => true).catch(() => false);
      notes.push(ok ? "🚪 Membre expulsé du serveur." : "⚠️ Expulsion impossible (permissions du bot ou rôle trop haut) : à faire à la main.");
    }
    await interaction.editReply(`✅ Verdict rendu.${notes.length ? `\n${notes.join("\n")}` : ""}\nLe salon de l'affaire sera supprimé dans 48 h.`);
    return true;
  }
  return false;
}

module.exports = { setupProces, handleProcesInteraction, drawOpening, drawVerdict, parseDuration, juryChoice };
