// « La Maison en direct » : le fil de tout ce qui se passe réellement dans la Maison,
// plus un message chaque matin (météo de Paris) et un résumé chaque soir.
const fs = require("fs");
const cron = require("node-cron");
const { EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { findOrCreateChannel } = require("./salons");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le fil est rangé à côté des annonces
const STATE_FILE = require("./data").dataFile("feed-state.json");
const FLUSH_MS = 15 * 60 * 1000; // au plus un message regroupé par quart d'heure
const MAX_LINES = 12;

let channelRef = null;
let queue = [];

function load() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function save(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function parisHour(ts = Date.now()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date(ts)));
}

// Statistiques de la journée (pour le résumé du soir)
function todayKey() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}
function bump(stat, amount = 1) {
  const state = load();
  if (state.day !== todayKey()) {
    state.day = todayKey();
    state.stats = {};
  }
  state.stats[stat] = (state.stats[stat] ?? 0) + amount;
  save(state);
}

// Ajoute un événement au fil. stat/amount : compteur du résumé du soir (facultatif).
function post(text, { stat, amount } = {}) {
  if (text) queue.push(text);
  if (queue.length > 50) queue.shift();
  if (stat) bump(stat, amount ?? 1);
}

async function flush() {
  if (!channelRef || !queue.length) return;
  const hour = parisHour();
  if (hour < 7) return; // la nuit, on garde les nouvelles pour le matin
  const lines = queue.splice(0, MAX_LINES);
  await channelRef
    .send({
      embeds: [new EmbedBuilder().setColor(0x8b0000).setAuthor({ name: "📡 La Maison en direct" }).setDescription(lines.map((l) => `• ${l}`).join("\n")).setTimestamp()],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
}

// --- Matin : bonjour + météo réelle de Paris ---

const WEATHER = {
  0: ["☀️", "grand soleil"], 1: ["🌤️", "plutôt ensoleillé"], 2: ["⛅", "quelques nuages"], 3: ["☁️", "ciel couvert"],
  45: ["🌫️", "brouillard"], 48: ["🌫️", "brouillard givrant"], 51: ["🌦️", "bruine légère"], 53: ["🌦️", "bruine"], 55: ["🌧️", "bruine forte"],
  61: ["🌧️", "petite pluie"], 63: ["🌧️", "pluie"], 65: ["🌧️", "forte pluie"], 71: ["🌨️", "un peu de neige"], 73: ["🌨️", "neige"],
  75: ["❄️", "beaucoup de neige"], 80: ["🌦️", "averses"], 81: ["🌧️", "averses"], 82: ["⛈️", "grosses averses"], 95: ["⛈️", "orages"],
  96: ["⛈️", "orages et grêle"], 99: ["⛈️", "violents orages"],
};

async function parisWeather() {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=48.8566&longitude=2.3522&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Europe%2FParis&forecast_days=1"
    );
    const data = await res.json();
    const [emoji, label] = WEATHER[data.daily.weathercode[0]] ?? ["🌡️", "temps variable"];
    return `${emoji} ${label}, de **${Math.round(data.daily.temperature_2m_min[0])}°** à **${Math.round(data.daily.temperature_2m_max[0])}°**`;
  } catch {
    return null;
  }
}

function todayEvents() {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short" }).format(new Date());
  const events = [];
  if (day === "Fri") events.push("🎰 Le casino ouvre ce soir à **20h** !");
  if (day === "Sat") events.push("🎰 Le casino est ouvert toute la journée");
  if (day === "Sun") events.push("🎰 Dernier jour de casino (fermeture lundi 2h)", "⭐ Élection du **membre star** de la semaine", "🧾 Impôts et salaires à **20h**");
  if (day === "Mon") events.push("📅 Nouvelle semaine : un nouveau membre star sera élu");
  return events;
}

async function morning() {
  if (!channelRef) return;
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const weather = await parisWeather();
  const events = todayEvents();
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("☀️ Bonjour la Maison !")
    .setDescription(
      `Nous sommes le **${date}**.\n\n` +
        (weather ? `**Météo à Paris** : ${weather}\n\n` : "") +
        (events.length ? `**Aujourd'hui**\n${events.join("\n")}\n\n` : "") +
        "Bonne journée à toutes et à tous 🦋"
    );
  await channelRef.send({ embeds: [embed] }).catch(() => null);
}

// --- Soir : résumé de la journée ---

async function evening() {
  if (!channelRef) return;
  const state = load();
  const st = state.day === todayKey() ? state.stats ?? {} : {};
  const lines = [
    st.clients ? `🔔 **${st.clients}** client(s) servi(s) par les entreprises` : null,
    st.ca ? `💶 **${Math.round(st.ca).toLocaleString("fr-FR")} €** de chiffre d'affaires` : null,
    st.sejours ? `🏡 **${st.sejours}** séjour(s) Airbnb réservé(s)` : null,
    st.casino ? `🎰 **${st.casino}** gros gain(s) au casino` : null,
    st.demenagements ? `📦 **${st.demenagements}** déménagement(s)` : null,
    st.entreprises ? `🏢 **${st.entreprises}** nouvelle(s) entreprise(s)` : null,
  ].filter(Boolean);
  const embed = new EmbedBuilder()
    .setColor(0x2c3e50)
    .setTitle("🌙 Bonne nuit la Maison")
    .setDescription(
      (lines.length ? `**La journée en chiffres**\n${lines.join("\n")}` : "*Journée calme dans la Maison.*") + "\n\nÀ demain 🦋"
    );
  await channelRef.send({ embeds: [embed] }).catch(() => null);
}

async function setupFeed(client) {
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  const state = load();
  channelRef = await findOrCreateChannel(guild, {
    id: state.channelId,
    name: "📡・la-maison-en-direct",
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] },
    ],
  });
  save({ ...load(), channelId: channelRef.id });

  setInterval(() => flush().catch((err) => console.error("Fil en direct:", err.message)), FLUSH_MS);
  cron.schedule("0 8 * * *", () => morning().catch(() => null), { timezone: "Europe/Paris" });
  cron.schedule("30 22 * * *", () => evening().catch(() => null), { timezone: "Europe/Paris" });
  console.log("Fil « La Maison en direct » prêt");
}

module.exports = { setupFeed, post };
