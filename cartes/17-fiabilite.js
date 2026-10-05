
// --- Solidité : file d'attente des animations, sauvegarde quotidienne, lancement programmé ---
// Au plus deux animations fabriquées en même temps : le bot reste réactif même quand tout le monde joue.
function limiter(max) {
  let active = 0;
  const waiting = [];
  return async (fn) => {
    if (active >= max) await new Promise((r) => waiting.push(r));
    active++;
    try {
      return await fn();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}
const renderLimit = limiter(2);
{
  const card = animatedCard, reveal = revealGif, clash = clashGif, shine = packShineGif, open = packOpenGif;
  animatedCard = (...a) => renderLimit(() => card(...a));
  revealGif = (...a) => renderLimit(() => reveal(...a));
  clashGif = (...a) => renderLimit(() => clash(...a));
  packShineGif = (...a) => renderLimit(() => shine(...a));
  packOpenGif = (...a) => renderLimit(() => open(...a));
}

// Sauvegarde chaque nuit : une copie datée sur le volume (7 jours gardés) et une copie dans les logs du staff
async function dailyBackup() {
  const st = load();
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", hour12: false }).format(new Date()));
  if (st.backupDay === dayKey() || hour < 4) return;
  st.backupDay = dayKey();
  save();
  const json = fs.readFileSync(STATE_FILE);
  const dir = path.dirname(STATE_FILE), base = path.basename(STATE_FILE);
  fs.writeFileSync(path.join(dir, `${base}.${dayKey()}.bak`), json);
  const olds = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${base}.`) && f.endsWith(".bak"))
    .sort()
    .slice(0, -7);
  for (const f of olds) fs.unlinkSync(path.join(dir, f));
  await require("./logs")
    .sendLogFile(
      "staff",
      new EmbedBuilder().setColor(0x3b82f6).setTitle("💾 Sauvegarde des Cartes de la Maison").setDescription(`Collections, marché, classements… (${Math.round(json.length / 1024)} Ko). Une copie est aussi gardée sur le serveur pendant 7 jours.`).setTimestamp(),
      new AttachmentBuilder(json, { name: `cartes-${dayKey()}.json` })
    )
    .catch(() => null);
}

// Lancement d'une génération (manuel avec /generation, ou programmé à une date)
async function launchNextGeneration() {
  const next = CURRENT_GEN + 1;
  if (!GENERATIONS[next]) return null;
  load().currentGen = next;
  CURRENT_GEN = next;
  delete load().genLaunchAt;
  vitrineCache = null;
  save();
  const G = GENERATIONS[next];
  await chan("annonces")
    ?.send({
      content: "@everyone",
      allowedMentions: { parse: ["everyone"] },
      embeds: [new EmbedBuilder().setColor(0x38bdf8).setTitle(`🌍 ${G.name} — ${G.title} est lancée !`).setDescription("De nouvelles cartes à collectionner, de nouveaux boosters et une nouvelle série dans l'album. Les boosters de l'ancienne génération restent ouvrables dans votre inventaire, mais ne sont plus vendus.").setImage("attachment://vitrine.jpg")],
      files: [await vitrineFile()],
    })
    .catch(() => null);
  panelDirty = true;
  for (const type of PACK_ORDER) packShineGif(CURRENT_GEN, type).catch(() => null);
  return G;
}
async function checkScheduledGeneration() {
  const at = load().genLaunchAt;
  if (at && Date.now() >= at) await launchNextGeneration();
}

// --- Défi d'Arène de la semaine : une règle spéciale, et une récompense pour 3 victoires ---
const ARENA_RULES = [
  ["surcharge", "⚡ Surcharge", "Tout le monde commence le combat avec 3 énergies."],
  ["critiques", "🎯 Coups critiques", "Les coups critiques sont deux fois plus fréquents."],
  ["fer", "🛡️ Garde de fer", "La garde ne s'use plus quand on la répète."],
  ["rage", "🔥 Rage", "Tous les dégâts sont augmentés de 25 %."],
  ["esquive", "💨 Esquive", "Les esquives sont deux fois plus fréquentes."],
];
const WEEKLY_GOAL = 3;
const weeklyRule = () => ARENA_RULES[hashOf(mondayKey()) % ARENA_RULES.length];
const ruleIs = (key) => weeklyRule()[0] === key;
// une victoire compte pour le défi ; la récompense tombe à la troisième
async function arenaWeeklyWin(userId) {
  const st = load();
  const w = (st.arenaWeekly[userId] = st.arenaWeekly[userId]?.week === mondayKey() ? st.arenaWeekly[userId] : { week: mondayKey(), wins: 0, done: false });
  w.wins++;
  if (w.done || w.wins < WEEKLY_GOAL) return save();
  w.done = true;
  addPacks(userId, packKey(CURRENT_GEN, "premium"), 1);
  st.dust[userId] = (st.dust[userId] ?? 0) + 150;
  save();
  const msg = await chan("arene")
    ?.send({ content: `🏆 <@${userId}> réussit le **défi de la semaine** (${weeklyRule()[1]}) : **1 booster Premium** et **150 ✨** !`, allowedMentions: { users: [userId] } })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}
// annonce de la règle chaque lundi (le message de la semaine précédente est remplacé)
async function announceWeeklyRule() {
  const st = load();
  if (st.ruleWeek === mondayKey()) return;
  const ch = chan("arene");
  if (!ch) return;
  if (st.ruleMessageId) await ch.messages.delete(st.ruleMessageId).catch(() => null);
  const [, name, desc] = weeklyRule();
  const msg = await ch
    .send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xef4444)
          .setTitle(`⚔️ Défi de la semaine : ${name}`)
          .setDescription(`${desc}\n\nCette règle s'applique à **tous les combats** jusqu'à lundi prochain.\n🎁 Gagnez **${WEEKLY_GOAL} combats** cette semaine (contre un membre ou la Maison) pour recevoir **1 booster Premium** et **150 ✨**.`),
      ],
    })
    .catch(() => null);
  st.ruleWeek = mondayKey();
  st.ruleMessageId = msg?.id ?? null;
  save();
}
