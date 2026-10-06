// Logs du staff : chaque mouvement d'argent du bot est classé et publié
// dans la catégorie « 📊 Logs » (visible uniquement par le staff).
const fs = require("fs");
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");
const { onTransaction, formatEuro, ECONOMIE_LOG_CHANNEL_ID } = require("./economie");
const { findOrCreateChannel } = require("./salons");

const STATE_FILE = require("./data").dataFile("logs-state.json");
const { pseudo } = require("./noms");
const FLUSH_MS = 60 * 1000; // les lignes sont regroupées par minute

const CHANNELS = {
  achats: { name: "🛒・logs-achats", title: "🛒 Achats & paiements", color: 0x3498db },
  casino: { name: "🎰・logs-casino", title: "🎰 Casino", color: 0xe91e63 },
  revenus: { name: "💼・logs-revenus", title: "💼 Revenus & économie", color: 0x2ecc71 },
  staff: { name: "🏛️・logs-staff", title: "🏛️ Staff & État", color: 0xe67e22 },
  tickets: { name: "📜・logs-tickets", title: "📜 Tickets archivés", color: 0x95a5a6 },
};

// Classement d'une opération selon son libellé
function categoryOf(label) {
  if (/^Casino/i.test(label)) return "casino";
  if (/^(Achat|Licence|Déménagement|Immatriculation|Facture|Don à|Dépôt sur|Caution)/i.test(label)) return "achats";
  if (/^(\/argent|Amende|Confiscation|Redressement|Impôts|Saisie|Remboursement de dette|Prime de la Mairie|Allocation|Salaire de maire)/i.test(label)) return "staff";
  return "revenus";
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

const channels = {}; // clé -> salon Discord
const queues = Object.fromEntries(Object.keys(CHANNELS).map((k) => [k, []]));

function hhmm(ts) {
  return new Date(ts).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
}

function queueTransaction(t) {
  const key = categoryOf(t.label);
  const sign = t.delta >= 0 ? "+" : "−";
  queues[key].push(
    `\`${hhmm(t.at)}\` **${pseudo(t.userId)}** **${sign}${formatEuro(Math.abs(t.delta))}** — ${t.label} → ${formatEuro(t.after)}`
  );
}

async function flush() {
  for (const [key, lines] of Object.entries(queues)) {
    if (!lines.length || !channels[key]) continue;
    const batch = lines.splice(0, lines.length);
    // Un message par tranche de 4 000 caractères maximum
    let chunk = [];
    const sendChunk = async () => {
      if (!chunk.length) return;
      await channels[key]
        .send({
          embeds: [new EmbedBuilder().setColor(CHANNELS[key].color).setTitle(CHANNELS[key].title).setDescription(chunk.join("\n")).setTimestamp()],
          allowedMentions: { parse: [] },
        })
        .catch(() => null);
      chunk = [];
    };
    for (const line of batch) {
      if (chunk.join("\n").length + line.length > 3900) await sendChunk();
      chunk.push(line);
    }
    await sendChunk();
  }
}

// Pour les autres modules : publier un événement (gel, décision, embauche…) dans un salon de logs.
async function sendLogEmbed(key, embed) {
  const channel = channels[key];
  if (!channel) return;
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => null);
}

async function setupLogs(client) {
  // Les logs prennent les mêmes permissions que l'ancien salon de logs du staff.
  const old = await client.channels.fetch(ECONOMIE_LOG_CHANNEL_ID).catch(() => null);
  const guild = old?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  const overwrites = old
    ? [...old.permissionOverwrites.cache.values()].map((o) => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }))
    : [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];
  if (!overwrites.some((o) => o.id === guild.roles.everyone.id)) {
    overwrites.push({ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] });
  }
  overwrites.push({ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] });

  const state = loadState();
  const category = await findOrCreateChannel(guild, { id: state.categoryId, name: "📊 Logs", type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
  state.categoryId = category.id;
  for (const [key, def] of Object.entries(CHANNELS)) {
    const channel = await findOrCreateChannel(guild, { id: state[key], name: def.name, parent: category.id, permissionOverwrites: overwrites });
    if (!channel.topic?.startsWith("privé:")) await channel.setTopic(`privé: ${def.title}`).catch(() => null);
    state[key] = channel.id;
    channels[key] = channel;
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  onTransaction(queueTransaction);
  setInterval(() => flush().catch((err) => console.error("Logs:", err.message)), FLUSH_MS);
  console.log("Logs prêts");
}

// Pour l'archivage des tickets : un encadré avec un fichier joint.
async function sendLogFile(key, embed, file) {
  const channel = channels[key];
  if (!channel) return;
  await channel.send({ embeds: [embed], files: [file], allowedMentions: { parse: [] } }).catch((err) => console.error("Log fichier:", err.message));
}

module.exports = { setupLogs, sendLogEmbed, sendLogFile, categoryOf };
