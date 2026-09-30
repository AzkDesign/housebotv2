// Retrouve un salon, une catégorie ou un rôle existant par son nom avant de le créer.
// Évite les doublons si les données du bot ont été perdues (redéploiement sans volume).
const { ChannelType } = require("discord.js");

// Discord met les noms de salons textuels en minuscules et remplace les espaces par des tirets.
function normalize(name, type) {
  return type === ChannelType.GuildCategory ? name.trim() : name.trim().toLowerCase().replace(/\s+/g, "-");
}

async function findChannel(guild, id, name, type, parentId) {
  if (id) {
    const byId = await guild.channels.fetch(id).catch(() => null);
    if (byId) return byId;
  }
  const all = await guild.channels.fetch().catch(() => guild.channels.cache);
  const wanted = normalize(name, type);
  // En cas de doublons, on garde le plus ancien.
  return (
    [...all.values()]
      .filter((c) => c && c.type === type && normalize(c.name, type) === wanted && (!parentId || c.parentId === parentId))
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)[0] ?? null
  );
}

async function findOrCreateChannel(guild, { id, name, type = ChannelType.GuildText, parent, permissionOverwrites }) {
  const existing = await findChannel(guild, id, name, type, type === ChannelType.GuildCategory ? null : parent);
  if (existing) return existing;
  return guild.channels.create({ name, type, parent: parent ?? undefined, permissionOverwrites });
}

async function findOrCreateRole(guild, { id, name, color, hoist }) {
  if (id) {
    const byId = await guild.roles.fetch(id).catch(() => null);
    if (byId) return byId;
  }
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  const existing = [...roles.values()].find((r) => r.name === name);
  if (existing) return existing;
  return guild.roles.create({ name, color, hoist, reason: "Bot House" });
}

module.exports = { findOrCreateChannel, findOrCreateRole };
