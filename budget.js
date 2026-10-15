// Budget de la Maison : les demandes d'achat des membres et le suivi du budget de la semaine.
// 1. Un membre fait une demande (/achat ou bouton du panneau) : catégorie, urgence, article, prix, quantité, motif, lien.
// 2. Un Responsable la traite dans le salon de validation : valider, valider un autre montant, refuser (avec motif)
//    ou demander des précisions. Le montant validé est déduit du budget de la semaine.
// 3. Une fois l'article acheté, on note le prix réellement payé (le budget est corrigé) ; une demande validée
//    peut aussi être annulée (le montant revient au budget).
// Le panneau du salon budget est un tableau de bord en image ; le bilan de la semaine part tout seul le lundi.
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");
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
  REST,
  Routes,
  SlashCommandBuilder,
} = require("discord.js");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");

const BUDGET_CHANNEL_ID = "1510000322024833194";
const BUDGET_LOG_CHANNEL_ID = "1510681001951498431";
const BUDGET_HISTORY_CHANNEL_ID = "1510687492896981102";
const RESPONSABLE_ROLE_ID = "1509984877120847963";
const GERANTS_ROLE_ID = "1509985135565475850";

const STATE_FILE = require("./data").dataFile("budget-state.json");
const { pseudo } = require("./noms");
const DEFAULT_BUDGET = 3700;
const PANEL_TITLE = "📊 Budget de la Maison";
const MAX_OPEN_REQUESTS = 5; // demandes en attente par membre

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

// --- Catégories et urgence ---
const CATEGORIES = {
  courses: { label: "Courses alimentaires", emoji: "🛒", color: "#22c55e" },
  menage: { label: "Produits ménagers", emoji: "🧽", color: "#06b6d4" },
  cuisine: { label: "Cuisine & vaisselle", emoji: "🍳", color: "#f59e0b" },
  hygiene: { label: "Salle de bain & hygiène", emoji: "🧴", color: "#a78bfa" },
  maison: { label: "Mobilier & décoration", emoji: "🛋️", color: "#f472b6" },
  tech: { label: "Électronique", emoji: "🔌", color: "#3b82f6" },
  loisirs: { label: "Loisirs & soirées", emoji: "🎉", color: "#ef4444" },
  entretien: { label: "Réparations & entretien", emoji: "🔧", color: "#94a3b8" },
  autre: { label: "Autre", emoji: "📦", color: "#d4a53c" },
};
const URGENCES = {
  normal: { label: "Normal", emoji: "🟢", desc: "Dans la semaine" },
  urgent: { label: "Urgent", emoji: "🔴", desc: "Le plus vite possible" },
  tranquille: { label: "Pas pressé", emoji: "🔵", desc: "Quand c'est possible" },
};
const STATUS = {
  pending: { label: "En attente", emoji: "⏳", color: 0xf59e0b },
  info: { label: "Précisions demandées", emoji: "💬", color: 0x3b82f6 },
  approved: { label: "Validée — à acheter", emoji: "✅", color: 0x22c55e },
  bought: { label: "Achetée", emoji: "🧾", color: 0x16a34a },
  rejected: { label: "Refusée", emoji: "❌", color: 0xef4444 },
  cancelled: { label: "Annulée", emoji: "↩️", color: 0x6b7280 },
};
const catOf = (e) => CATEGORIES[e.category] ?? CATEGORIES.autre;
// une dépense compte dans le budget de la semaine quand elle est validée ou achetée
// (une demande validée la semaine précédente, encore à acheter, a déjà été comptée : « carried »)
const counts = (e) => (e.status === "approved" || e.status === "bought") && !e.carried;
const isOpen = (e) => e.status === "pending" || e.status === "info";

// --- Données ---
function loadState() {
  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = { messageId: null, weekStart: getWeekStartISO(), totalBudget: DEFAULT_BUDGET, expenses: [] };
  }
  if (!Array.isArray(state.expenses)) state.expenses = [];
  if (typeof state.totalBudget !== "number") state.totalBudget = DEFAULT_BUDGET;
  state.counter ??= 0;
  state.archive ??= []; // bilans des semaines passées
  // anciennes demandes : numéro et catégorie par défaut
  for (const e of state.expenses) {
    if (!e.no) e.no = ++state.counter;
    e.category ??= "autre";
    e.qty ??= 1;
  }
  ensureWeek(state);
  return state;
}
function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Dates (heure de Paris) ---
function getParisDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Paris" }));
}
function getWeekStartISO(date = getParisDate()) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getWeekEndISO(weekStart) {
  const d = new Date(weekStart + "T12:00:00");
  d.setDate(d.getDate() + 6);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const formatDateFr = (iso) => iso.split("-").reverse().join("/");
const weekLabel = (start) => {
  const f = (iso, opts) => new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(iso + "T12:00:00Z"));
  return `du ${f(start, { day: "numeric" })} au ${f(getWeekEndISO(start), { day: "numeric", month: "long" })}`;
};
// nouvelle semaine : bilan de la semaine passée mis de côté (publié par le planificateur), puis remise à zéro.
// Les demandes en attente et celles validées mais pas encore achetées sont gardées.
function ensureWeek(state) {
  const current = getWeekStartISO();
  if (state.weekStart === current) return false;
  const counted = state.expenses.filter(counts);
  if (counted.length) state.pendingReport = { weekStart: state.weekStart, totalBudget: state.totalBudget, expenses: counted, counter: state.counter };
  state.archive.push({ weekStart: state.weekStart, totalBudget: state.totalBudget, spent: Math.round(counted.reduce((a, e) => a + e.amount, 0) * 100) / 100, count: counted.length });
  state.archive = state.archive.slice(-12);
  state.expenses = state.expenses.filter((e) => isOpen(e) || e.status === "approved").map((e) => (e.status === "approved" ? { ...e, carried: true } : e));
  state.weekStart = current;
  return true;
}

// 12 € ou 12,50 € ; espaces ordinaires (les polices des images n'ont pas l'espace fine)
function formatEuro(amount) {
  const n = Number(amount) || 0, d = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2;
  return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/[  ]/g, " ") + " €";
}
function parseAmount(str) {
  return parseFloat(String(str ?? "").replace(/\s/g, "").replace(",", ".").replace(/[^\d.]/g, ""));
}
const isResponsable = (member) => member?.roles?.cache?.has(RESPONSABLE_ROLE_ID) ?? false;
const isGerant = (member) => member?.roles?.cache?.has(GERANTS_ROLE_ID) ?? false;
const spentOf = (state) => Math.round(state.expenses.filter(counts).reduce((a, e) => a + e.amount, 0) * 100) / 100;
const remainingOf = (state) => Math.round((state.totalBudget - spentOf(state)) * 100) / 100;
const reqNo = (e) => `n°${String(e.no).padStart(3, "0")}`;
const findExpense = (state, id) => state.expenses.find((e) => e.id === id);

// ============================================================
// Tableau de bord (image du panneau et du bilan)
// ============================================================
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function gold(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, "#9a6b1c");
  g.addColorStop(0.4, "#f3d98b");
  g.addColorStop(0.6, "#d4a53c");
  g.addColorStop(1, "#5a3a0a");
  return g;
}
function fitText(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
function tile(ctx, x, y, w, h, label, value, sub, accent) {
  rr(ctx, x, y, w, h, 16);
  ctx.fillStyle = "rgba(255,255,255,0.045)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = accent;
  rr(ctx, x, y + 18, 4, h - 36, 2);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = "13px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label.toUpperCase(), x + 22, y + 32);
  ctx.font = "30px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fitText(ctx, value, w - 36), x + 22, y + 72);
  if (sub) {
    ctx.font = "13px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(fitText(ctx, sub, w - 36), x + 22, y + 96);
  }
}
function drawDashboard(state, title = "BUDGET DE LA MAISON") {
  const W = 1200, H = 640, c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f131b");
  bg.addColorStop(1, "#090b10");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(250, 330, 20, 250, 330, 380);
  halo.addColorStop(0, "rgba(34,197,94,0.10)");
  halo.addColorStop(1, "rgba(34,197,94,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = gold(ctx, 0, 0, W, H);
  ctx.lineWidth = 2;
  rr(ctx, 12, 12, W - 24, H - 24, 18);
  ctx.stroke();
  // en-tête
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#d4a53c";
  ctx.fillText("LA MAISON", 48, 62);
  ctx.font = "38px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title === "BUDGET DE LA MAISON" ? "Budget de la semaine" : title, 48, 104);
  ctx.textAlign = "right";
  ctx.font = "17px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`Semaine ${weekLabel(state.weekStart)}`, W - 48, 70);
  // jauge
  const spent = spentOf(state), total = state.totalBudget, rem = remainingOf(state);
  const pct = total > 0 ? spent / total : 1;
  const cx = 250, cy = 360, R = 160;
  ctx.lineCap = "round";
  ctx.lineWidth = 28;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0.75 * Math.PI, 2.25 * Math.PI);
  ctx.stroke();
  const col = pct < 0.6 ? "#22c55e" : pct < 0.85 ? "#f59e0b" : "#ef4444";
  const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  g.addColorStop(0, "#22c55e");
  g.addColorStop(0.6, pct < 0.6 ? "#4ade80" : "#f59e0b");
  g.addColorStop(1, pct < 0.85 ? "#facc15" : "#ef4444");
  ctx.strokeStyle = g;
  ctx.shadowColor = col;
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0.75 * Math.PI, 0.75 * Math.PI + 1.5 * Math.PI * Math.min(1, Math.max(0.005, pct)));
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.textAlign = "center";
  ctx.font = "15px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(rem >= 0 ? "RESTANT" : "DÉPASSEMENT", cx, cy - 34);
  ctx.font = `${formatEuro(Math.abs(rem)).length > 9 ? 42 : 52}px CardBold`;
  ctx.fillStyle = rem >= 0 ? "#ffffff" : "#fca5a5";
  ctx.fillText(formatEuro(Math.abs(rem)), cx, cy + 20);
  ctx.font = "16px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`sur ${formatEuro(total)} · ${Math.round(pct * 100)} % utilisés`, cx, cy + 52);
  // chiffres clés
  const pend = state.expenses.filter(isOpen);
  const toBuy = state.expenses.filter((e) => e.status === "approved");
  const tx = 470, tw = 222, th = 112;
  tile(ctx, tx, 140, tw, th, "Dépensé", formatEuro(spent), `${state.expenses.filter(counts).length} achat(s) validé(s)`, "#22c55e");
  tile(ctx, tx + tw + 16, 140, tw, th, "En attente", String(pend.length), pend.length ? `${formatEuro(pend.reduce((a, e) => a + e.amount, 0))} demandés` : "aucune demande", "#f59e0b");
  tile(ctx, tx + 2 * (tw + 16), 140, tw, th, "À acheter", String(toBuy.length), toBuy.length ? `${formatEuro(toBuy.reduce((a, e) => a + e.amount, 0))} validés` : "rien à acheter", "#3b82f6");
  // répartition par catégorie
  const byCat = {};
  for (const e of state.expenses.filter(counts)) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const bx = tx, by = 290, bw = 3 * tw + 32;
  ctx.textAlign = "left";
  ctx.font = "13px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("PAR CATÉGORIE", bx, by);
  if (!cats.length) {
    ctx.font = "16px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("Aucune dépense cette semaine.", bx, by + 34);
  }
  const maxCat = Math.max(1, ...cats.map(([, v]) => v));
  cats.forEach(([k, v], i) => {
    const y = by + 22 + i * 34, cat = CATEGORIES[k] ?? CATEGORIES.autre;
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fitText(ctx, cat.label, 200), bx, y + 15);
    rr(ctx, bx + 214, y + 3, bw - 214 - 110, 14, 7);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    rr(ctx, bx + 214, y + 3, Math.max(14, (bw - 214 - 110) * (v / maxCat)), 14, 7);
    ctx.fillStyle = cat.color;
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(formatEuro(v), bx + bw, y + 15);
    ctx.textAlign = "left";
  });
  // derniers achats validés
  const last = state.expenses.filter(counts).sort((a, b) => (b.validatedAt ?? 0) - (a.validatedAt ?? 0)).slice(0, 3);
  const ly = 488;
  ctx.font = "13px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText("DERNIÈRES DÉPENSES", bx, ly);
  if (!last.length) {
    ctx.font = "16px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText("Rien pour le moment.", bx, ly + 32);
  }
  last.forEach((e, i) => {
    const y = ly + 14 + i * 34;
    rr(ctx, bx, y, bw, 28, 8);
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fill();
    ctx.fillStyle = catOf(e).color;
    ctx.beginPath();
    ctx.arc(bx + 16, y + 14, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(fitText(ctx, e.label, 360), bx + 32, y + 19);
    ctx.font = "14px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(fitText(ctx, `${e.status === "bought" ? "acheté" : "à acheter"} · ${pseudo(e.authorId)}`, 230), bx + 420, y + 19);
    ctx.textAlign = "right";
    ctx.font = "15px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(formatEuro(e.amount), bx + bw - 14, y + 19);
    ctx.textAlign = "left";
  });
  return c.encode("png");
}

// ============================================================
// Panneau du salon budget
// ============================================================
function panelEmbed(state) {
  const pend = state.expenses.filter(isOpen).length;
  return new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle(PANEL_TITLE)
    .setDescription(
      `**Semaine ${weekLabel(state.weekStart)}** · budget **${formatEuro(state.totalBudget)}** · restant **${formatEuro(remainingOf(state))}**\n\n` +
        "🛒 **Besoin de quelque chose pour la Maison ?** Faites une demande avec le bouton ci-dessous (ou `/achat`) : choisissez la catégorie et l'urgence, puis décrivez l'article.\n" +
        "Un **Responsable** la valide, et vous êtes prévenu(e) en message privé à chaque étape." +
        (pend ? `\n\n⏳ **${pend}** demande${pend > 1 ? "s" : ""} en attente de validation.` : "")
    )
    .setImage("attachment://budget.png")
    .setFooter({ text: "Le budget repart à zéro chaque lundi · le bilan de la semaine est publié automatiquement" })
    .setTimestamp();
}
function panelComponents() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("budget_req").setLabel("Demander un achat").setEmoji("🛒").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("budget_mine").setLabel("Mes demandes").setEmoji("📋").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("budget_add_expense").setLabel("Ajouter une dépense").setEmoji("💶").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("budget_modify_budget").setLabel("Modifier le budget").setEmoji("✏️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("budget_expense_table").setLabel("Tableau").setEmoji("📋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("budget_send_report").setLabel("Bilan").setEmoji("📊").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("budget_reset_week").setLabel("Reset").setEmoji("🔄").setStyle(ButtonStyle.Danger)
    ),
  ];
}
let panelTimer = null;
async function updateBudgetPanel(client) {
  const channel = await client.channels.fetch(BUDGET_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const state = loadState();
  const payload = {
    embeds: [panelEmbed(state)],
    components: panelComponents(),
    files: [new AttachmentBuilder(await drawDashboard(state), { name: "budget.png" })],
    attachments: [],
  };
  let msg = state.messageId ? await channel.messages.fetch(state.messageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channel.messages.fetch({ limit: 15 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && [PANEL_TITLE, "📊 Suivi du budget hebdomadaire"].includes(m.embeds[0]?.title));
  }
  if (msg) await msg.edit(payload).catch(() => null);
  else msg = await channel.send(payload).catch(() => null);
  if (msg && state.messageId !== msg.id) {
    state.messageId = msg.id;
    saveState(state);
  }
}
// plusieurs changements rapprochés : une seule mise à jour du panneau
function refreshPanelSoon(client) {
  clearTimeout(panelTimer);
  panelTimer = setTimeout(() => updateBudgetPanel(client).catch((err) => console.error("Panneau budget:", err.message)), 1500);
}
async function setupBudgetPanel(client) {
  const state = loadState();
  saveState(state);
  await updateBudgetPanel(client);
  console.log("Panneau budget publié");
}

// ============================================================
// Demande : catégorie + urgence, puis formulaire
// ============================================================
const drafts = new Map(); // userId -> { kind, category, urgency }
function draftPayload(userId, kind = "achat") {
  const d = drafts.get(userId) ?? { kind, category: null, urgency: "normal" };
  d.kind = kind;
  drafts.set(userId, d);
  return {
    ephemeral: true,
    content:
      kind === "achat"
        ? "🛒 **Nouvelle demande d'achat** — choisissez la **catégorie** et l'**urgence**, puis cliquez sur **Remplir la demande**."
        : "💶 **Nouvelle dépense** — choisissez la **catégorie**, puis cliquez sur **Remplir**.",
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("budget_cat")
          .setPlaceholder("Catégorie…")
          .addOptions(Object.entries(CATEGORIES).map(([k, c]) => ({ label: c.label, value: k, emoji: c.emoji, default: d.category === k })))
      ),
      ...(kind === "achat"
        ? [
            new ActionRowBuilder().addComponents(
              new StringSelectMenuBuilder()
                .setCustomId("budget_urg")
                .setPlaceholder("Urgence…")
                .addOptions(Object.entries(URGENCES).map(([k, u]) => ({ label: u.label, value: k, emoji: u.emoji, description: u.desc, default: d.urgency === k })))
            ),
          ]
        : []),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("budget_fill").setLabel(kind === "achat" ? "Remplir la demande" : "Remplir").setEmoji("📝").setStyle(ButtonStyle.Success).setDisabled(!d.category)
      ),
    ],
  };
}
function requestModal(kind) {
  const m = new ModalBuilder().setCustomId(kind === "achat" ? "budget_m_req" : "budget_m_dep").setTitle(kind === "achat" ? "🛒 Demande d'achat" : "💶 Ajout d'une dépense");
  const rows = [
    new TextInputBuilder().setCustomId("article").setLabel(kind === "achat" ? "Que voulez-vous acheter ?" : "Libellé de la dépense").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100),
    new TextInputBuilder().setCustomId("prix").setLabel(kind === "achat" ? "Prix unitaire (€)" : "Montant (€)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(12).setPlaceholder("Ex. : 12,50"),
  ];
  if (kind === "achat") {
    rows.push(
      new TextInputBuilder().setCustomId("qty").setLabel("Quantité").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(4).setValue("1"),
      new TextInputBuilder().setCustomId("motif").setLabel("Pourquoi en avez-vous besoin ?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500),
      new TextInputBuilder().setCustomId("lien").setLabel("Lien vers l'article (facultatif)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(300)
    );
  }
  return m.addComponents(rows.map((r) => new ActionRowBuilder().addComponents(r)));
}

// --- Messages de la demande ---
function requestEmbed(e, state = loadState()) {
  const cat = catOf(e), st = STATUS[e.status] ?? STATUS.pending, urg = URGENCES[e.urgency];
  const embed = new EmbedBuilder()
    .setColor(st.color)
    .setAuthor({ name: `${e.type === "achat" ? "Demande d'achat" : "Dépense"} ${reqNo(e)} · ${cat.emoji} ${cat.label}` })
    .setTitle(`${st.emoji} ${e.label}`.slice(0, 256))
    .addFields(
      { name: "Montant", value: e.qty > 1 ? `**${formatEuro(e.amount)}**\n${e.qty} × ${formatEuro(e.unit ?? e.amount / e.qty)}` : `**${formatEuro(e.amount)}**`, inline: true },
      { name: "Demandé par", value: `<@${e.authorId}>`, inline: true },
      { name: "Statut", value: `${st.emoji} ${st.label}`, inline: true }
    );
  if (urg && e.type === "achat") embed.addFields({ name: "Urgence", value: `${urg.emoji} ${urg.label}`, inline: true });
  if (e.requested && e.requested !== e.amount) embed.addFields({ name: "Montant demandé", value: formatEuro(e.requested), inline: true });
  if (e.paid != null) embed.addFields({ name: "Prix payé", value: formatEuro(e.paid), inline: true });
  if (e.reason) embed.addFields({ name: "Pourquoi", value: e.reason.slice(0, 1024) });
  if (e.link) embed.addFields({ name: "Lien", value: e.link.slice(0, 1024) });
  if (e.question) embed.addFields({ name: "💬 Précisions demandées", value: `${e.question.slice(0, 900)}${e.answer ? `\n**Réponse :** ${e.answer.slice(0, 900)}` : "\n*En attente de la réponse du demandeur.*"}` });
  if (e.decisionNote) embed.addFields({ name: e.status === "rejected" ? "Motif du refus" : "Note", value: e.decisionNote.slice(0, 1024) });
  if (e.validatorId) embed.addFields({ name: e.status === "rejected" ? "Refusée par" : "Traitée par", value: `<@${e.validatorId}>`, inline: true });
  if (isOpen(e)) {
    const after = remainingOf(state) - e.amount;
    embed.addFields({ name: "Budget", value: `Restant : **${formatEuro(remainingOf(state))}** → après validation : **${formatEuro(after)}**${after < 0 ? " ⚠️ dépassement" : ""}` });
  }
  return embed.setFooter({ text: `Demande du ${new Date(e.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}` }).setTimestamp(new Date(e.validatedAt ?? e.createdAt));
}
function requestButtons(e) {
  if (isOpen(e))
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`budget_ok_${e.id}`).setLabel("Valider").setEmoji("✅").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`budget_amt_${e.id}`).setLabel("Valider un autre montant").setEmoji("✏️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`budget_ask_${e.id}`).setLabel("Demander des précisions").setEmoji("💬").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`budget_no_${e.id}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger)
      ),
    ];
  if (e.status === "approved")
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`budget_bought_${e.id}`).setLabel("Marquer comme acheté").setEmoji("🧾").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`budget_cancel_${e.id}`).setLabel("Annuler (rendre au budget)").setEmoji("↩️").setStyle(ButtonStyle.Secondary)
      ),
    ];
  return [];
}
async function refreshRequestMessage(guild, e) {
  const ch = await guild.channels.fetch(BUDGET_LOG_CHANNEL_ID).catch(() => null);
  const msg = e.logMessageId ? await ch?.messages.fetch(e.logMessageId).catch(() => null) : null;
  await msg?.edit({ content: msg.content, embeds: [requestEmbed(e)], components: requestButtons(e) }).catch(() => null);
}
async function notifyAuthor(guild, e, text) {
  const user = await guild.client.users.fetch(e.authorId).catch(() => null);
  await user?.send({ content: text, embeds: [requestEmbed(e)] }).catch(() => null);
}
async function historyLog(guild, e, title) {
  const ch = await guild.channels.fetch(BUDGET_HISTORY_CHANNEL_ID).catch(() => null);
  await ch?.send({ content: title, embeds: [requestEmbed(e)] }).catch(() => null);
}

async function submitRequest(interaction, kind, fields) {
  const state = loadState();
  const d = drafts.get(interaction.user.id) ?? { category: "autre", urgency: "normal" };
  const e = {
    id: `${kind === "achat" ? "achat" : "dep"}_${Date.now()}_${interaction.user.id.slice(-4)}`,
    no: ++state.counter,
    type: kind,
    category: d.category ?? "autre",
    urgency: kind === "achat" ? d.urgency ?? "normal" : null,
    label: fields.article,
    unit: fields.unit,
    qty: fields.qty,
    amount: Math.round(fields.unit * fields.qty * 100) / 100,
    reason: fields.motif || null,
    link: fields.lien || null,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag,
    status: "pending",
    createdAt: Date.now(),
    logMessageId: null,
  };
  e.requested = e.amount;
  state.expenses.push(e);
  saveState(state);
  drafts.delete(interaction.user.id);
  const ch = await interaction.guild.channels.fetch(BUDGET_LOG_CHANNEL_ID).catch(() => null);
  if (!ch?.isTextBased()) {
    await interaction.reply({ content: "❌ Salon de validation introuvable.", ephemeral: true });
    return;
  }
  const urgent = e.urgency === "urgent";
  const msg = await ch.send({
    content: `<@&${RESPONSABLE_ROLE_ID}> ${urgent ? "🔴 **URGENT** — " : ""}nouvelle ${kind === "achat" ? "demande d'achat" : "dépense"} à valider`,
    embeds: [requestEmbed(e, state)],
    components: requestButtons(e),
    allowedMentions: { roles: [RESPONSABLE_ROLE_ID] },
  });
  e.logMessageId = msg.id;
  saveState(state);
  await interaction.reply({
    ephemeral: true,
    content: `✅ **${kind === "achat" ? "Demande" : "Dépense"} ${reqNo(e)} envoyée !** Un Responsable va la traiter ; vous serez prévenu(e) en message privé.`,
    embeds: [requestEmbed(e, state)],
  });
  refreshPanelSoon(interaction.client);
}

function minePayload(userId) {
  const state = loadState();
  const mine = state.expenses.filter((e) => e.authorId === userId).sort((a, b) => b.createdAt - a.createdAt);
  const lines = mine.slice(0, 12).map((e) => `${STATUS[e.status]?.emoji ?? "•"} **${reqNo(e)}** ${catOf(e).emoji} ${e.label} — **${formatEuro(e.amount)}** · ${STATUS[e.status]?.label ?? e.status}`);
  const open = mine.filter(isOpen);
  return {
    ephemeral: true,
    embeds: [
      new EmbedBuilder()
        .setColor(0x3b82f6)
        .setTitle("📋 Mes demandes de la semaine")
        .setDescription(lines.join("\n") || "*Aucune demande cette semaine.*")
        .setFooter({ text: open.length ? "Vous pouvez retirer une demande tant qu'elle n'est pas traitée." : "Le budget repart à zéro chaque lundi." }),
    ],
    components: open.length
      ? [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId("budget_withdraw")
              .setPlaceholder("Retirer une demande en attente…")
              .addOptions(open.slice(0, 25).map((e) => ({ label: `${reqNo(e)} · ${e.label}`.slice(0, 100), value: e.id, description: formatEuro(e.amount), emoji: catOf(e).emoji })))
          ),
        ]
      : [],
  };
}

// ============================================================
// Tableau et bilan
// ============================================================
function tableEmbed(state) {
  const by = (st) => state.expenses.filter((e) => st.includes(e.status));
  const line = (e) => `${catOf(e).emoji} **${reqNo(e)}** ${e.label} — **${formatEuro(e.amount)}** · ${pseudo(e.authorId)}`;
  const sections = [
    ["🧾 Achetées", by(["bought"])],
    ["✅ Validées — à acheter", by(["approved"])],
    ["⏳ En attente", by(["pending", "info"])],
  ];
  const text = sections
    .filter(([, list]) => list.length)
    .map(([t, list]) => `**${t}**\n${list.map(line).join("\n")}`)
    .join("\n\n");
  return new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle("📋 Tableau des dépenses")
    .setDescription(`**Semaine ${weekLabel(state.weekStart)}**\n\n${(text || "*Aucune dépense cette semaine.*").slice(0, 3900)}`)
    .setFooter({ text: `Dépensé : ${formatEuro(spentOf(state))} · Restant : ${formatEuro(remainingOf(state))}` });
}
async function reportPayload(state, title = "📊 Bilan de la semaine") {
  const list = state.expenses.filter(counts);
  const byCat = {};
  for (const e of list) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
  const top = Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${(CATEGORIES[k] ?? CATEGORIES.autre).emoji} ${(CATEGORIES[k] ?? CATEGORIES.autre).label} : **${formatEuro(v)}**`)
    .join("\n");
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x22c55e)
        .setTitle(title)
        .setDescription(
          `**Semaine ${weekLabel(state.weekStart)}**\n` +
            `Budget **${formatEuro(state.totalBudget)}** · dépensé **${formatEuro(spentOf(state))}** · restant **${formatEuro(remainingOf(state))}**\n` +
            `${list.length} dépense${list.length > 1 ? "s" : ""} validée${list.length > 1 ? "s" : ""}` +
            (top ? `\n\n**Par catégorie**\n${top}` : "")
        )
        .setImage("attachment://bilan.png")
        .setTimestamp(),
    ],
    files: [new AttachmentBuilder(await drawDashboard(state, "Bilan de la semaine"), { name: "bilan.png" })],
  };
}

// ============================================================
// Planificateur : chaque lundi, bilan de la semaine passée et nouveau budget
// ============================================================
// publie le bilan de la semaine passée s'il attend (même si le bot était éteint le lundi à minuit)
async function publishPendingReport(client) {
  const state = loadState();
  const rep = state.pendingReport;
  if (!rep) return saveState(state);
  delete state.pendingReport;
  saveState(state);
  const ch = await client.channels.fetch(BUDGET_HISTORY_CHANNEL_ID).catch(() => null);
  await ch?.send(await reportPayload({ ...rep, archive: [] }, "📊 Bilan de la semaine (automatique)")).catch((err) => console.error("Bilan du budget:", err.message));
}
function startBudgetScheduler(client) {
  publishPendingReport(client).catch(() => null);
  cron.schedule(
    "1 0 * * *",
    async () => {
      await publishPendingReport(client).catch(() => null);
      await updateBudgetPanel(client).catch(() => null);
    },
    { timezone: "Europe/Paris" }
  );
}

// ============================================================
// Interactions
// ============================================================
// les messages éphémères mis à jour n'acceptent pas l'option « ephemeral »
const noEph = ({ ephemeral, ...p }) => p;
const denyGerant = (interaction) => interaction.reply({ content: "❌ Réservé aux **Gérants**.", ephemeral: true });
const denyResp = (interaction) => interaction.reply({ content: "❌ Seuls les **Responsables** peuvent traiter les demandes.", ephemeral: true });

async function handleBudgetInteraction(interaction) {
  const id = interaction.customId;
  if (interaction.isChatInputCommand?.() && interaction.commandName === "achat") {
    await interaction.reply(draftPayload(interaction.user.id, "achat"));
    return true;
  }
  if (typeof id !== "string" || !id.startsWith("budget_")) return false;
  const userId = interaction.user.id;

  // --- côté membres ---
  if (id === "budget_req") {
    if (loadState().expenses.filter((e) => e.authorId === userId && isOpen(e)).length >= MAX_OPEN_REQUESTS) {
      await interaction.reply({ content: `⏳ Vous avez déjà ${MAX_OPEN_REQUESTS} demandes en attente : attendez qu'elles soient traitées.`, ephemeral: true });
      return true;
    }
    await interaction.reply(draftPayload(userId, "achat"));
    return true;
  }
  if (id === "budget_cat" || id === "budget_urg") {
    const d = drafts.get(userId) ?? { kind: "achat", urgency: "normal" };
    if (id === "budget_cat") d.category = interaction.values[0];
    else d.urgency = interaction.values[0];
    drafts.set(userId, d);
    await interaction.update(noEph(draftPayload(userId, d.kind)));
    return true;
  }
  if (id === "budget_fill") {
    const d = drafts.get(userId);
    if (!d?.category) {
      await interaction.reply({ content: "❌ Choisissez d'abord une catégorie.", ephemeral: true });
      return true;
    }
    await interaction.showModal(requestModal(d.kind));
    return true;
  }
  if (id === "budget_m_req" || id === "budget_m_dep") {
    const kind = id === "budget_m_req" ? "achat" : "depense";
    if (kind === "depense" && !isGerant(interaction.member)) return denyGerant(interaction).then(() => true);
    const get = (k) => {
      try {
        return interaction.fields.getTextInputValue(k).trim();
      } catch {
        return "";
      }
    };
    const unit = parseAmount(get("prix"));
    const qty = Math.max(1, Math.min(999, parseInt(get("qty") || "1", 10) || 1));
    if (!unit || unit <= 0 || unit > 100000) {
      await interaction.reply({ content: "❌ Prix invalide. Écrivez par exemple `12,50`.", ephemeral: true });
      return true;
    }
    const lien = get("lien");
    if (lien && !/^https?:\/\//i.test(lien)) {
      await interaction.reply({ content: "❌ Le lien doit commencer par `http://` ou `https://`.", ephemeral: true });
      return true;
    }
    await submitRequest(interaction, kind, { article: get("article"), unit, qty, motif: get("motif"), lien });
    return true;
  }
  if (id === "budget_mine") {
    await interaction.reply(minePayload(userId));
    return true;
  }
  if (id === "budget_withdraw") {
    const state = loadState(), e = findExpense(state, interaction.values[0]);
    if (!e || e.authorId !== userId || !isOpen(e)) {
      await interaction.update(noEph(minePayload(userId)));
      return true;
    }
    e.status = "cancelled";
    e.decisionNote = "Retirée par le demandeur.";
    e.validatedAt = Date.now();
    saveState(state);
    await interaction.update({ ...noEph(minePayload(userId)), content: `↩️ Demande ${reqNo(e)} retirée.` });
    await refreshRequestMessage(interaction.guild, e);
    refreshPanelSoon(interaction.client);
    return true;
  }
  // le demandeur répond à une demande de précisions (bouton dans son message privé)
  if (id.startsWith("budget_reply_")) {
    const e = findExpense(loadState(), id.slice("budget_reply_".length));
    if (!e || e.status !== "info" || e.authorId !== userId) {
      await interaction.reply({ content: "ℹ️ Cette demande n'attend plus de réponse.", ephemeral: true });
      return true;
    }
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`budget_m_reply_${e.id}`)
        .setTitle(`💬 Demande ${reqNo(e)}`)
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("answer").setLabel("Votre réponse").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)))
    );
    return true;
  }
  if (id.startsWith("budget_m_reply_")) {
    const state = loadState(), e = findExpense(state, id.slice("budget_m_reply_".length));
    if (!e || e.status !== "info" || e.authorId !== userId) {
      await interaction.reply({ content: "ℹ️ Cette demande n'attend plus de réponse.", ephemeral: true });
      return true;
    }
    e.answer = interaction.fields.getTextInputValue("answer").trim();
    e.status = "pending";
    saveState(state);
    await interaction.reply({ content: "✅ Réponse envoyée aux Responsables.", ephemeral: !interaction.guild ? false : true });
    const guild = await interaction.client.guilds.fetch(e.guildId ?? interaction.guildId ?? interaction.client.guilds.cache.first()?.id).catch(() => null);
    const g = guild ?? interaction.client.guilds.cache.first();
    if (g) {
      await refreshRequestMessage(g, e);
      const ch = await g.channels.fetch(BUDGET_LOG_CHANNEL_ID).catch(() => null);
      await ch?.send({ content: `💬 <@${e.authorId}> a répondu pour la demande **${reqNo(e)}** (${e.label}).`, allowedMentions: { parse: [] } }).catch(() => null);
    }
    return true;
  }

  // --- côté gérants (panneau) ---
  if (["budget_add_expense", "budget_modify_budget", "budget_send_report", "budget_expense_table", "budget_reset_week"].includes(id)) {
    if (!isGerant(interaction.member)) return denyGerant(interaction).then(() => true);
    if (id === "budget_add_expense") {
      await interaction.reply(draftPayload(userId, "depense"));
      return true;
    }
    if (id === "budget_modify_budget") {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId("budget_modify_modal")
          .setTitle("Modifier le budget de la semaine")
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("budget").setLabel("Budget de la semaine (€)").setStyle(TextInputStyle.Short).setRequired(true).setValue(String(loadState().totalBudget))))
      );
      return true;
    }
    if (id === "budget_expense_table") {
      await interaction.reply({ embeds: [tableEmbed(loadState())], ephemeral: true });
      return true;
    }
    if (id === "budget_send_report") {
      await interaction.deferReply({ ephemeral: true });
      await interaction.channel.send(await reportPayload(loadState()));
      await interaction.editReply("📊 Bilan envoyé dans ce salon.");
      return true;
    }
    if (id === "budget_reset_week") {
      const state = loadState();
      state.expenses = state.expenses.filter(isOpen);
      saveState(state);
      await updateBudgetPanel(interaction.client);
      await interaction.reply({ content: "🔄 Semaine remise à zéro (les demandes en attente sont gardées).", ephemeral: true });
      return true;
    }
  }
  if (id === "budget_modify_modal") {
    if (!isGerant(interaction.member)) return denyGerant(interaction).then(() => true);
    const budget = parseAmount(interaction.fields.getTextInputValue("budget"));
    if (!budget || budget <= 0) {
      await interaction.reply({ content: "❌ Budget invalide.", ephemeral: true });
      return true;
    }
    const state = loadState();
    state.totalBudget = budget;
    saveState(state);
    await interaction.reply({ content: `✅ Budget de la semaine : **${formatEuro(budget)}**`, ephemeral: true });
    refreshPanelSoon(interaction.client);
    return true;
  }

  // --- côté Responsables (salon de validation) ---
  // anciens boutons (demandes envoyées avant la nouvelle version)
  const legacy = /^budget_(approve|reject)_(.+)$/.exec(id);
  const m = legacy ? [null, legacy[1] === "approve" ? "ok" : "no", legacy[2]] : /^budget_(ok|amt|ask|no|bought|cancel)_(.+)$/.exec(id);
  const mm = /^budget_m_(amt|ask|no|bought)_(.+)$/.exec(id);
  if (!m && !mm) return false;
  if (!isResponsable(interaction.member)) return denyResp(interaction).then(() => true);
  const [, action, eid] = m ?? mm;
  const state = loadState(), e = findExpense(state, eid);
  if (!e) {
    await interaction.reply({ content: "❌ Demande introuvable (semaine terminée ?).", ephemeral: true });
    return true;
  }
  const by = interaction.member?.displayName ?? interaction.user.username;

  if (m) {
    if (["ok", "amt", "ask", "no"].includes(action) && !isOpen(e)) {
      await interaction.reply({ content: "ℹ️ Cette demande a déjà été traitée.", ephemeral: true });
      return true;
    }
    if (["bought", "cancel"].includes(action) && e.status !== "approved") {
      await interaction.reply({ content: "ℹ️ Cette demande n'est plus « à acheter ».", ephemeral: true });
      return true;
    }
    const modal = (title, field, label, style = TextInputStyle.Short, value = null, required = true) => {
      const input = new TextInputBuilder().setCustomId(field).setLabel(label).setStyle(style).setRequired(required).setMaxLength(style === TextInputStyle.Short ? 12 : 600);
      if (value != null) input.setValue(String(value));
      return interaction.showModal(new ModalBuilder().setCustomId(`budget_m_${action}_${e.id}`).setTitle(title.slice(0, 45)).addComponents(new ActionRowBuilder().addComponents(input))).then(() => true);
    };
    if (action === "amt") return modal(`Valider ${reqNo(e)} à un autre montant`, "amount", "Montant validé (€)", TextInputStyle.Short, e.amount);
    if (action === "ask") return modal(`Précisions — ${reqNo(e)}`, "question", "Quelle précision demandez-vous ?", TextInputStyle.Paragraph);
    if (action === "no") return modal(`Refuser ${reqNo(e)}`, "reason", "Motif du refus (envoyé au demandeur)", TextInputStyle.Paragraph, null, false);
    if (action === "bought") return modal(`${reqNo(e)} achetée`, "paid", "Prix réellement payé (€)", TextInputStyle.Short, e.amount);
    if (action === "ok") return approve(interaction, state, e, e.amount, by);
    if (action === "cancel") {
      e.status = "cancelled";
      e.decisionNote = `Annulée par ${by} : le montant revient au budget.`;
      e.validatorId = userId;
      saveState(state);
      await interaction.update({ embeds: [requestEmbed(e, state)], components: [] });
      await notifyAuthor(interaction.guild, e, `↩️ Votre demande **${reqNo(e)}** a été **annulée** par ${by}.`);
      await historyLog(interaction.guild, e, `↩️ Demande ${reqNo(e)} annulée`);
      refreshPanelSoon(interaction.client);
      return true;
    }
  }
  // formulaires des Responsables
  if (["amt", "ask", "no"].includes(action) && !isOpen(e)) {
    await interaction.reply({ content: "ℹ️ Cette demande a déjà été traitée.", ephemeral: true });
    return true;
  }
  if (action === "amt") {
    const amount = parseAmount(interaction.fields.getTextInputValue("amount"));
    if (!amount || amount <= 0) {
      await interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
      return true;
    }
    return approve(interaction, state, e, amount, by);
  }
  if (action === "ask") {
    e.question = interaction.fields.getTextInputValue("question").trim();
    e.answer = null;
    e.status = "info";
    e.guildId = interaction.guildId;
    saveState(state);
    await interaction.update({ embeds: [requestEmbed(e, state)], components: requestButtons(e) });
    const user = await interaction.client.users.fetch(e.authorId).catch(() => null);
    const sent = await user
      ?.send({
        content: `💬 **${by}** a besoin d'une précision sur votre demande **${reqNo(e)}** (${e.label}) :\n> ${e.question}`,
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`budget_reply_${e.id}`).setLabel("Répondre").setEmoji("💬").setStyle(ButtonStyle.Primary))],
      })
      .then(() => true)
      .catch(() => false);
    if (!sent) await interaction.followUp({ content: "⚠️ Le demandeur a fermé ses messages privés : contactez-le directement.", ephemeral: true });
    return true;
  }
  if (action === "no") {
    e.status = "rejected";
    e.decisionNote = interaction.fields.getTextInputValue("reason").trim() || null;
    e.validatorId = userId;
    e.validatedAt = Date.now();
    saveState(state);
    await interaction.update({ embeds: [requestEmbed(e, state)], components: [] });
    await notifyAuthor(interaction.guild, e, `❌ Votre demande **${reqNo(e)}** (${e.label}) a été **refusée** par ${by}.`);
    await historyLog(interaction.guild, e, `❌ Demande ${reqNo(e)} refusée`);
    refreshPanelSoon(interaction.client);
    return true;
  }
  if (action === "bought") {
    const paid = parseAmount(interaction.fields.getTextInputValue("paid"));
    if (!(paid >= 0)) {
      await interaction.reply({ content: "❌ Montant invalide.", ephemeral: true });
      return true;
    }
    e.paid = paid;
    const diff = Math.round((paid - e.amount) * 100) / 100;
    e.amount = paid; // le budget compte le prix réellement payé
    e.status = "bought";
    e.boughtAt = Date.now();
    e.buyerId = userId;
    saveState(state);
    await interaction.update({ embeds: [requestEmbed(e, state)], components: [] });
    await notifyAuthor(interaction.guild, e, `🧾 Votre demande **${reqNo(e)}** (${e.label}) a été **achetée** !`);
    await historyLog(interaction.guild, e, `🧾 Demande ${reqNo(e)} achetée${diff ? ` (${diff > 0 ? "+" : ""}${formatEuro(diff)} par rapport au montant validé)` : ""}`);
    refreshPanelSoon(interaction.client);
    return true;
  }
  return false;
}
async function approve(interaction, state, e, amount, by) {
  const others = remainingOf(state);
  if (amount > others) {
    await interaction.reply({ content: `❌ **Budget insuffisant** : ${formatEuro(amount)} demandés, ${formatEuro(others)} restants. Augmentez le budget, validez un autre montant ou refusez.`, ephemeral: true });
    return true;
  }
  e.requested ??= e.amount;
  e.amount = Math.round(amount * 100) / 100;
  e.status = "approved";
  e.validatorId = interaction.user.id;
  e.validatedAt = Date.now();
  if (e.amount !== e.requested) e.decisionNote = `Validée à ${formatEuro(e.amount)} au lieu de ${formatEuro(e.requested)}.`;
  saveState(state);
  if (interaction.isModalSubmit?.() && !interaction.message) await interaction.reply({ content: "✅ Validée.", ephemeral: true });
  else await interaction.update({ embeds: [requestEmbed(e, state)], components: requestButtons(e) });
  if (interaction.isModalSubmit?.() && !interaction.message) await refreshRequestMessage(interaction.guild, e);
  await notifyAuthor(interaction.guild, e, `✅ Votre demande **${reqNo(e)}** (${e.label}) est **validée** par ${by}${e.amount !== e.requested ? ` pour **${formatEuro(e.amount)}**` : ""}.`);
  await historyLog(interaction.guild, e, `✅ Demande ${reqNo(e)} validée · restant ${formatEuro(remainingOf(state))}`);
  refreshPanelSoon(interaction.client);
  return true;
}

// l'ancien questionnaire en messages privés n'existe plus : /achat ouvre directement le formulaire
async function handleAchatDmMessage() {
  return false;
}
async function registerBudgetCommands(client, token) {
  const rest = new REST({ version: "10" }).setToken(token);
  const commands = [new SlashCommandBuilder().setName("achat").setDescription("Demander un achat pour la Maison").toJSON()];
  for (const guild of client.guilds.cache.values()) await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: commands }).catch(() => null);
}

module.exports = {
  setupBudgetPanel,
  startBudgetScheduler,
  handleBudgetInteraction,
  handleAchatDmMessage,
  updateBudgetPanel,
  registerBudgetCommands,
  drawDashboard,
  CATEGORIES,
};
