// Archivage des tickets avant suppression, et fermeture des tickets inactifs.
const { EmbedBuilder, AttachmentBuilder, ChannelType } = require("discord.js");

const TICKET_CATEGORY_ID = "1509977402485510345";
const CANDIDATURE_CATEGORY_ID = "1509979339649843200";
const INACTIVE_MS = 3 * 24 * 60 * 60 * 1000; // rappel après 3 jours sans message
const GRACE_MS = 24 * 60 * 60 * 1000; // fermeture 24 h après le rappel
const REMINDER_PREFIX = "⏰ **Ticket inactif**";
const MAX_MESSAGES = 2000;

const logs = () => require("./logs");

function stamp(ts) {
  return new Date(ts).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });
}

async function fetchAllMessages(channel) {
  const all = [];
  let before;
  while (all.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!batch?.size) break;
    all.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  return all.reverse();
}

function lineFor(m) {
  const parts = [];
  if (m.content) parts.push(m.content);
  for (const e of m.embeds) {
    const text = [e.title, e.description].filter(Boolean).join(" — ").replace(/\s+/g, " ").slice(0, 400);
    if (text) parts.push(`[encadré : ${text}]`);
  }
  for (const a of m.attachments.values()) parts.push(`[fichier : ${a.name} ${a.url}]`);
  return `[${stamp(m.createdTimestamp)}] ${m.author?.tag ?? "?"} (${m.author?.id ?? "?"}) : ${parts.join(" ") || "(vide)"}`;
}

// Enregistre toute la conversation d'un salon dans les logs du staff (fichier texte).
async function archiveChannel(channel, { reason = "Fermé", closedBy = null } = {}) {
  try {
    const messages = await fetchAllMessages(channel);
    const participants = [...new Set(messages.filter((m) => !m.author?.bot).map((m) => m.author.id))];
    const header = [
      `Salon : #${channel.name} (${channel.id})`,
      `Sujet : ${channel.topic ?? "—"}`,
      `Ouvert le : ${stamp(channel.createdTimestamp)}`,
      `Fermé le : ${stamp(Date.now())}${closedBy ? ` par ${closedBy.tag ?? closedBy}` : ""}`,
      `Raison : ${reason}`,
      `Messages : ${messages.length}`,
      "─".repeat(60),
    ];
    const text = [...header, ...messages.map(lineFor)].join("\n");
    const file = new AttachmentBuilder(Buffer.from(text, "utf8"), { name: `${channel.name}-${channel.id}.txt` });
    const embed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle(`📜 Ticket archivé — #${channel.name}`)
      .addFields(
        { name: "Raison", value: reason.slice(0, 1024), inline: true },
        { name: "Fermé par", value: closedBy ? `${closedBy}` : "automatique", inline: true },
        { name: "Messages", value: String(messages.length), inline: true },
        { name: "Participants", value: participants.map((id) => `<@${id}>`).join(", ").slice(0, 1024) || "—" }
      )
      .setTimestamp();
    await logs().sendLogFile("tickets", embed, file);
  } catch (err) {
    console.error(`Archivage de #${channel.name}:`, err.message);
  }
}

// Archive puis supprime un ticket.
async function closeTicket(channel, options = {}) {
  await archiveChannel(channel, options);
  await channel.delete(options.reason ?? "Ticket fermé").catch(() => null);
}

// --- Tickets inactifs ---

async function sweepInactiveTickets(client) {
  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const channel of guild.channels.cache.values()) {
      if (channel.type !== ChannelType.GuildText) continue;
      if (![TICKET_CATEGORY_ID, CANDIDATURE_CATEGORY_ID].includes(channel.parentId)) continue;
      const topic = channel.topic ?? "";
      // Candidature en attente du vote du staff, ou déjà terminée (suppression programmée) : on n'y touche pas
      if (topic.startsWith("candidature:vote:")) continue;

      const last = (await channel.messages.fetch({ limit: 1 }).catch(() => null))?.first();
      const lastAt = last?.createdTimestamp ?? channel.createdTimestamp;
      const isReminder = last?.author?.id === client.user.id && last.content?.startsWith(REMINDER_PREFIX);

      if (isReminder && now - lastAt > GRACE_MS) {
        await closeTicket(channel, { reason: "Inactif depuis plus de 4 jours" });
      } else if (!isReminder && now - lastAt > INACTIVE_MS) {
        await channel
          .send(`${REMINDER_PREFIX} : aucun message depuis 3 jours. Sans nouvelle réponse, ce ticket sera **fermé dans 24 h** (la conversation est conservée par le staff).`)
          .catch(() => null);
      }
    }
  }
}

function startInactivityWatcher(client) {
  const run = () => sweepInactiveTickets(client).catch((err) => console.error("Tickets inactifs:", err.message));
  setTimeout(run, 60 * 1000);
  setInterval(run, 60 * 60 * 1000);
  console.log("Surveillance des tickets inactifs prête");
}

module.exports = { archiveChannel, closeTicket, startInactivityWatcher, sweepInactiveTickets };
