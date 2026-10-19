// --- Les combats de l'Arène survivent aux redémarrages du bot ---
// Chaque combat en cours est enregistré dans les données (équipes, PV, énergie, manche, mises, paris…) :
// au démarrage, il reprend là où il s'était arrêté, dans le même fil, avec les mêmes boutons.
// Seuls les combats impossibles à reprendre (carte disparue, fil supprimé, arrêt de plus de 3 h) sont annulés et remboursés.
const LIVE_SKIP = new Set(["channel", "thread", "message", "timer", "coinGif", "bg"]);
const LIVE_MAX_AGE = 3 * 60 * MINUTE, RESUME_SECONDS = 120;
function battleSnapshot(b) {
  const out = {};
  for (const [k, v] of Object.entries(b)) if (!LIVE_SKIP.has(k) && typeof v !== "function" && !(v instanceof Promise)) out[k] = v;
  out.players = b.players.map((p) => ({ ...p, team: p.team.map(({ card, ...f }) => f) }));
  out.channelId = b.channel?.id ?? null;
  out.threadId = b.thread?.id ?? null;
  out.messageId = b.message?.id ?? null;
  out.savedAt = Date.now();
  return JSON.parse(JSON.stringify(out));
}
function snapshotBattle(b) {
  if (!b || b.phase === "over" || battles.get(b.id) !== b) return false;
  try {
    (load().arenaLive ??= {})[b.id] = battleSnapshot(b);
    return true;
  } catch (err) {
    console.error("Combat (sauvegarde):", err.message);
    return false;
  }
}
function persistBattle(b) {
  if (snapshotBattle(b)) save();
}
function forgetBattle(id) {
  const live = load().arenaLive;
  if (!live?.[id]) return;
  delete live[id];
  save();
}
function persistAllBattles() {
  let n = 0;
  for (const b of battles.values()) if (snapshotBattle(b)) n++;
  if (n) save();
}
{
  const start = startBattle, team = setTeam, begin = beginRounds, next = nextRound, resolveState = resolveRoundState, finish = finishBattle, cancel = cancelBattle;
  startBattle = async (client, a, bUser, opts) => {
    const b = await start(client, a, bUser, opts);
    persistBattle(b);
    return b;
  };
  setTeam = async (client, b, i, keys) => {
    await team(client, b, i, keys);
    persistBattle(b);
  };
  beginRounds = async (client, b) => {
    await begin(client, b);
    persistBattle(b);
  };
  nextRound = async (client, b) => {
    await next(client, b);
    delete b.resumeTries; // le combat avance : la reprise a réussi
    persistBattle(b);
  };
  // la manche vient d'être jouée : l'état est gardé avant l'animation (rien n'est rejoué au hasard après un redémarrage)
  resolveRoundState = (b) => {
    const res = resolveState(b);
    persistBattle(b);
    return res;
  };
  finishBattle = async (client, b, winner, reason) => {
    await finish(client, b, winner, reason);
    forgetBattle(b.id);
  };
  cancelBattle = async (b, why) => {
    await cancel(b, why);
    forgetBattle(b.id);
  };
  // les choix déjà faits, les paris et les combats classés sont aussi gardés au fil de l'eau
  setInterval(() => {
    if (battles.size) persistAllBattles();
  }, 20000).unref?.();
  // Railway arrête le bot avec SIGTERM avant chaque redéploiement : dernière sauvegarde
  process.once("SIGTERM", () => {
    try {
      persistAllBattles();
    } catch {}
    process.exit(0);
  });
}

// --- Reprise au démarrage ---
const liveCard = (key, s) => (String(key).startsWith("boss_") && s.boss ? bossCard(bossDef(s.boss)) : cardOfKey(key));
async function dropLiveBattle(client, s, why) {
  const st = load();
  for (const x of st.arenaEscrow[s.id] ?? []) changeBalance(x.userId, x.amount, "Combat de cartes interrompu : remboursement", { force: true });
  delete st.arenaEscrow[s.id];
  delete st.arenaLive?.[s.id];
  if (s.tournament) {
    const m = tourState()?.rounds?.[s.tournament.r]?.[s.tournament.k];
    if (m?.battle === s.id) m.battle = null;
    tourDirty = true;
  }
  save();
  battles.delete(s.id);
  for (const p of s.players ?? []) if (userBattle.get(p.id) === s.id) userBattle.delete(p.id);
  if (s.island && islandFights.get(s.island) === s.id) islandFights.delete(s.island);
  const thread = s.threadId ? await client.channels.fetch(s.threadId).catch(() => null) : null;
  if (!thread) return;
  await thread.send(`🚫 Ce combat n'a pas pu reprendre après le redémarrage du bot (${why}). Les mises et les paris sont remboursés.`).catch(() => null);
  setTimeout(() => thread.delete("Combat interrompu").catch(() => null), MINUTE);
}
async function resumeBattle(client, s) {
  if (Date.now() - (s.savedAt ?? 0) > LIVE_MAX_AGE) throw new Error("arrêt trop long");
  const b = { ...s };
  for (const k of ["channelId", "threadId", "messageId", "savedAt"]) delete b[k];
  b.players = s.players.map((p) => ({ ...p, team: p.team.map((f) => ({ ...f, card: liveCard(f.key, s) })) }));
  if (b.players.some((p) => p.team.some((f) => !f.card))) throw new Error("une carte a disparu");
  b.thread = s.threadId ? await client.channels.fetch(s.threadId).catch(() => null) : null;
  if (s.threadId && !b.thread) throw new Error("le fil du combat a été supprimé");
  if (b.thread?.archived) await b.thread.setArchived(false).catch(() => null);
  b.channel = b.thread ?? (s.channelId ? await client.channels.fetch(s.channelId).catch(() => null) : null) ?? chan("arene");
  if (!b.channel) throw new Error("salon introuvable");
  const old = s.messageId ? await b.channel.messages.fetch(s.messageId).catch(() => null) : null;
  b.message = old;
  battles.set(b.id, b);
  for (const p of b.players) if (!p.isAI) userBattle.set(p.id, b.id);
  if (b.island) islandFights.set(b.island, b.id);
  const humans = b.players.filter((p) => !p.isAI).map((p) => p.id);
  const say = (extra) =>
    b.channel
      .send({ content: `🔄 **Le bot a redémarré… mais le combat continue !** ${humans.map((id) => `<@${id}>`).join(" ")}\n${extra}`, allowedMentions: { users: humans } })
      .then((m) => (b.thread ? m : deleteLater(m, 10 * MINUTE)))
      .catch(() => null);
  // le panneau du combat redescend sous l'avis (les boutons de l'ancien marchent aussi : même combat)
  const panel = async (payload) => {
    const m = await b.channel.send(payload).catch(() => null);
    if (!m) throw new Error("envoi impossible dans le salon");
    if (old && old.id !== m.id) old.delete().catch(() => null);
    b.message = m;
  };
  // une manche reprise laisse le temps de revenir
  const longRound = async () => {
    clearTimeout(b.timer);
    b.deadline = Date.now() + RESUME_SECONDS * 1000;
    b.timer = setTimeout(() => roundTimeout(client, b).catch(() => null), RESUME_SECONDS * 1000);
    await b.message?.edit(await livePayload(b)).catch(() => null);
  };
  if (b.phase === "team") {
    b.deadline = Date.now() + TEAM_SECONDS * 1000;
    b.coinGif = coinTossGif(b).catch(() => null);
    await say("On reprend la **préparation des équipes**.");
    await panel(await teamPayload(b));
    if (b.players.every((p) => p.ready && p.team.length)) await beginRounds(client, b);
    else b.timer = setTimeout(() => autoTeams(client, b).catch(() => null), TEAM_SECONDS * 1000);
  } else if (b.phase === "toss" || b.phase === "resolving") {
    // pile ou face déjà tiré, ou manche déjà jouée : on passe à la suite (les objets et bonus du début ne sont pas rejoués)
    const tossed = b.phase === "toss";
    if (tossed) b.round = 0;
    await say(tossed ? `🪙 Pile ou face : **${b.players[b.coin]?.name ?? "?"}** frappe en premier.` : `La manche ${b.round} a été jouée : voici la suite.`);
    await panel({ content: `⏳ La manche ${b.round + 1} commence…` });
    b.phase = "choose";
    const alive = b.players.map((p) => p.team.some((f) => f.hp > 0));
    if (!tossed && (!alive[0] || !alive[1] || b.round >= 30)) {
      const winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
      return finishBattle(client, b, winner, winner >= 0 ? "K.O." : "égalité");
    }
    await nextRound(client, b);
    await longRound();
  } else {
    b.phase = "choose";
    b.deadline = Date.now() + RESUME_SECONDS * 1000;
    await say(`On reprend la **manche ${b.round}**${b.players.some((p) => !p.isAI && p.choice) ? " (les choix déjà faits sont gardés)" : ""} : vous avez ${RESUME_SECONDS / 60} minutes pour jouer.`);
    await panel(await livePayload(b));
    if (b.players.every((p) => p.choice)) return resolveRound(client, b);
    b.timer = setTimeout(() => roundTimeout(client, b).catch(() => null), RESUME_SECONDS * 1000);
  }
  persistBattle(b);
}
async function resumeLiveBattles(client) {
  const live = Object.values(load().arenaLive ?? {});
  for (const [k, s] of live.entries()) {
    // un combat dont la reprise a déjà échoué deux fois (le bot est tombé pendant) est annulé : jamais de boucle de plantages
    s.resumeTries = (s.resumeTries ?? 0) + 1;
    save();
    if (s.resumeTries > 2) {
      console.error(`Combat ${s.id} : reprise abandonnée après deux redémarrages.`);
      await dropLiveBattle(client, s, "reprise impossible").catch(() => null);
      continue;
    }
    // un combat à la fois, pour ne pas tout charger d'un coup au démarrage
    if (k) await sleep(8000);
    try {
      await resumeBattle(client, s);
      console.log(`Combat ${s.id} repris (${s.players.map((p) => p.name).join(" contre ")}, ${s.phase}, manche ${s.round}).`);
    } catch (err) {
      console.error(`Combat ${s.id} (reprise impossible):`, err.message);
      await dropLiveBattle(client, s, err.message).catch(() => null);
    }
  }
}
{
  // au démarrage : l'argent des combats qui vont reprendre reste bloqué, le reste est remboursé comme avant
  const refund = refundInterruptedBattles;
  refundInterruptedBattles = () => {
    const st = load(), live = st.arenaLive ?? {}, keep = {};
    for (const id of Object.keys(live)) if (st.arenaEscrow[id]) keep[id] = st.arenaEscrow[id];
    for (const id of Object.keys(keep)) delete st.arenaEscrow[id];
    refund();
    Object.assign(st.arenaEscrow, keep);
    save();
    // la reprise attend que le démarrage du bot soit passé (images, salons…) : moins de mémoire d'un coup
    if (Object.keys(live).length) setTimeout(() => resumeLiveBattles(cardClient).catch((err) => console.error("Reprise des combats:", err.message)), 25000);
  };
}
// la mémoire du bot dans les logs (Railway arrête le bot s'il en prend trop) : utile pour comprendre un « Killed »
setInterval(() => {
  const m = process.memoryUsage();
  console.log(`Mémoire : ${Math.round(m.rss / 1048576)} Mo (tas ${Math.round(m.heapUsed / 1048576)} Mo, tampons ${Math.round(m.arrayBuffers / 1048576)} Mo) · ${battles.size} combat(s) en cours`);
}, 10 * MINUTE).unref?.();
