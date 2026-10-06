// Pseudos écrits à la place des mentions <@id>.
// Dans les embeds (et pour les membres qui ont quitté le serveur), Discord affiche parfois une mention
// sous forme de chiffres. On écrit donc le pseudo du membre, retenu même s'il n'est plus en cache.
const fs = require("fs");
const STATE_FILE = require("./data").dataFile("noms-state.json");

let names = null;
let clientRef = null;
let dirty = false;

function store() {
  if (names) return names;
  try {
    names = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    names = {};
  }
  return names;
}
function flush() {
  if (!dirty) return;
  dirty = false;
  fs.writeFileSync(STATE_FILE, JSON.stringify(names));
}
// retient le pseudo affiché d'un membre ou d'un utilisateur
function remember(who) {
  if (!who?.id) return;
  const name = who.displayName ?? who.nickname ?? who.user?.globalName ?? who.globalName ?? who.user?.username ?? who.username;
  if (!name || store()[who.id] === name) return;
  store()[who.id] = name;
  dirty = true;
}
// pseudo écrit d'un identifiant (sans mise en forme)
function pseudo(id) {
  if (!id) return "un membre";
  id = String(id);
  for (const guild of clientRef?.guilds.cache.values() ?? []) {
    const m = guild.members.cache.get(id);
    if (m) {
      remember(m);
      return m.displayName;
    }
  }
  const u = clientRef?.users.cache.get(id);
  if (u) remember(u);
  return store()[id] ?? u?.globalName ?? u?.username ?? "un membre";
}

async function setupNoms(client) {
  clientRef = client;
  store();
  // tous les membres du serveur, au démarrage
  for (const guild of client.guilds.cache.values()) {
    const members = await guild.members.fetch().catch(() => null);
    for (const m of members?.values() ?? []) remember(m);
  }
  client.on("guildMemberAdd", (m) => remember(m));
  client.on("guildMemberUpdate", (_, m) => remember(m));
  client.on("interactionCreate", (i) => remember(i.member ?? i.user));
  client.on("messageCreate", (msg) => remember(msg.member ?? msg.author));
  flush();
  setInterval(flush, 60 * 1000).unref?.();
}

module.exports = { pseudo, remember, setupNoms };
