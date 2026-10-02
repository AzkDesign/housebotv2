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
function deleteLater(message, ms) {
  if (!message?.delete) return;
  setTimeout(() => message.delete().catch(() => null), ms).unref?.();
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
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  dossiersChannel = channel;
  return channel;
}

async function sendDossier(client, payload) {
  const channel = await getDossiersChannel(client);
  return channel?.isTextBased() ? channel.send(payload).catch(() => null) : null;
}

module.exports = { deleteLater, deleteInteractionMessageLater, getDossiersChannel, sendDossier, MINUTE, HOUR };
