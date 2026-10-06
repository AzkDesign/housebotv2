// Outils pour garder les salons propres : suppression différée des messages
// automatiques, et un salon « dossiers » pour que le panneau IRF ne soit jamais noyé.
const fs = require("fs");
const { PermissionFlagsBits } = require("discord.js");
const { findOrCreateChannel } = require("./salons");

const IRF_CHANNEL_ID = "1527524719094534185";
const STATE_FILE = require("./data").dataFile("nettoyage-state.json");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// Supprime un message après un délai (sans erreur s'il a déjà disparu).
// Les suppressions prévues sont enregistrées : un redémarrage du bot ne les fait plus oublier.
let pendingDeletes = null;
function pending() {
  pendingDeletes ??= loadState().pendingDeletes ?? [];
  return pendingDeletes;
}
function savePending() {
  const state = loadState();
  state.pendingDeletes = pending();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function doneDelete(entry) {
  const i = pending().indexOf(entry);
  if (i < 0) return;
  pending().splice(i, 1);
  savePending();
}
function deleteLater(message, ms) {
  if (!message?.delete) return;
  const entry = { c: message.channelId ?? message.channel?.id, m: message.id, at: Date.now() + ms };
  if (entry.c && entry.m) {
    pending().push(entry);
    savePending();
  }
  setTimeout(() => message.delete().catch(() => null).finally(() => doneDelete(entry)), ms).unref?.();
}
// au démarrage : reprend les suppressions prévues avant le redémarrage
function resumeDeletes(client) {
  for (const entry of [...pending()]) {
    setTimeout(async () => {
      const channel = await client.channels.fetch(entry.c).catch(() => null);
      await channel?.messages?.delete(entry.m).catch(() => null);
      doneDelete(entry);
    }, Math.max(1000, entry.at - Date.now())).unref?.();
  }
}

// Pour un bouton : supprime le message qui le porte, sauf s'il est éphémère.
function deleteInteractionMessageLater(interaction, ms) {
  const message = interaction.message;
  if (!message || message.flags?.has?.(64)) return; // 64 = message éphémère
  deleteLater(message, ms);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}

let dossiersChannel = null;

// Salon privé où arrivent les alertes et demandes à traiter par l'IRF.
async function getDossiersChannel(client) {
  if (dossiersChannel) return dossiersChannel;
  const irf = await client.channels.fetch(IRF_CHANNEL_ID).catch(() => null);
  if (!irf?.guild) return irf;
  const state = loadState();
  // Mêmes permissions que le salon IRF : seuls ceux qui le voient verront les dossiers.
  const overwrites = [...irf.permissionOverwrites.cache.values()].map((o) => ({
    id: o.id,
    type: o.type,
    allow: o.allow.bitfield,
    deny: o.deny.bitfield,
  }));
  if (!overwrites.some((o) => o.id === client.user.id)) {
    overwrites.push({ id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks] });
  }
  const channel = await findOrCreateChannel(irf.guild, {
    id: state.dossiersChannelId,
    name: "🗂️・irf-dossiers",
    parent: irf.parentId,
    permissionOverwrites: overwrites,
  }).catch((err) => {
    console.error("Salon dossiers IRF:", err.message);
    return null;
  });
  if (!channel) return irf; // à défaut, le salon IRF lui-même
  if (!channel.topic?.startsWith("privé:")) await channel.setTopic("privé: dossiers à traiter par l'IRF").catch(() => null);
  state.dossiersChannelId = channel.id;
  state.pendingDeletes = pending();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  dossiersChannel = channel;
  return channel;
}

async function sendDossier(client, payload) {
  const channel = await getDossiersChannel(client);
  return channel?.isTextBased() ? channel.send(payload).catch(() => null) : null;
}

module.exports = { deleteLater, resumeDeletes, deleteInteractionMessageLater, getDossiersChannel, sendDossier, MINUTE, HOUR };
