// --- Parties classées automatiques (« ranked » en message privé, voir 29-automatique) ---
// « ranked » (tous les membres de AUTO_WORDS) ou « nina ranked », « nina clara ranked »… : pendant 10 minutes,
// les membres concernés jouent entre eux des parties classées tirées au hasard, comme la vraie file :
// même écart de niveau autorisé (600 points), équipe la plus forte, pile ou face, vraies manches du moteur de l'Arène,
// classement, poussière, quêtes, défi de la semaine et succès par la vraie fin de combat (finishBattle).
// Chaque combat dure le temps d'un vrai combat : le résultat tombe à la fin. RANKED_CHAMPION gagne tous ses matchs :
// on ne retient que des combats qu'elle gagne réellement (mêmes règles, mêmes cartes) ; sinon le match n'a pas lieu.
// Rien n'est annoncé de plus qu'un vrai combat ; le bilan part en privé à AUTO_TRIGGER_ID.
const RANKED_SESSION_MS = 10 * MINUTE, RANKED_CHAMPION = "1557089423408238602";
let rankedSession = null;
const rkRnd = (a, b) => a + Math.random() * (b - a);
// les équipes qu'un joueur peut aligner : ses cartes de la plus forte à la plus faible (sans objet, une seule DUO, pas de doublon)
function rankedRoster(id) {
  const seen = new Set();
  let duo = false;
  const power = new Map(ownedKeys(id).map(([k]) => [k, k.startsWith("ut_") ? -1 : fighterPower(k)])); // une fiche par carte, pas une par comparaison
  return [...power.keys()]
    .filter((k) => !k.startsWith("ut_"))
    .sort((x, y) => power.get(y) - power.get(x))
    .filter((k) => {
      const cid = k.replace("*", "");
      if (seen.has(cid) || (cid.startsWith("duo_") && duo)) return false;
      if (cid.startsWith("duo_")) duo = true;
      return seen.add(cid);
    });
}
// équipe la plus forte d'abord (comme l'équipe automatique), puis des équipes de cartes moins fortes de sa collection
function rankedTeams(id) {
  const all = rankedRoster(id), teams = [bestTeam(id)];
  for (let k = 3; k + 3 <= all.length && teams.length < 4; k += 3) teams.push(all.slice(k, k + 3));
  if (all.length > 3) teams.push(all.slice(-3));
  return teams.filter((t) => t.length >= 3).map((keys) => keys.map(fighter)); // fiches calculées une seule fois
}
// copie neuve des fiches pour chaque combat simulé (le moteur modifie les PV)
const rankedCopy = (team) => team.map(({ card, ...f }) => ({ ...structuredClone(f), card }));
const rankedSide = (id, team) => ({ id, name: pseudo(id), avatar: null, isAI: false, team: rankedCopy(team), active: 0, energy: ruleIs("surcharge") ? 3 : 1, choice: null, ready: true, afk: 0 });
// chaque joueur choisit son coup comme un bon joueur : il lit le type adverse, l'énergie, les habitudes de l'autre
function rankedChoice(b, i, smart) {
  const view = { ...b, ai: { smart }, aiLevel: null, players: [b.players[1 - i], b.players[i]], history: [b.history[1 - i], b.history[i]] };
  return aiChoice(view);
}
// un combat complet, manche par manche, avec le moteur de l'Arène
function rankedSimulate(idA, teamA, idB, teamB) {
  const b = { id: `rk${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, ai: null, island: null, boss: null, aiLevel: null, players: [rankedSide(idA, teamA), rankedSide(idB, teamB)], round: 0, phase: "choose", mise: 0, bets: [], lastLines: [], history: [[], []], ranked: true, coin: Math.random() < 0.5 ? 0 : 1, startedAt: Date.now() };
  const smart = b.players.map((p) => (p.id === RANKED_CHAMPION ? 0.9 : 0.55));
  for (;;) {
    b.round++;
    b.players.forEach((p, i) => (p.choice = rankedChoice(b, i, smart[i])));
    const res = resolveRoundState(b);
    res.acts.forEach((a, i) => b.history[i].push(a.type));
    const alive = b.players.map((p) => p.team.some((f) => f.hp > 0));
    if (!alive[0] || !alive[1] || b.round >= 30) {
      const winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
      return { b, winner, reason: winner >= 0 ? "K.O." : "égalité" };
    }
  }
}
// le match : si la championne joue, seul un combat qu'elle gagne réellement est retenu ; son adversaire aligne au besoin
// une équipe moins forte de sa collection (choisir ses cartes fait partie du jeu). Aucune victoire possible : pas de match.
async function rankedMatch(idA, idB) {
  const champ = [idA, idB].indexOf(RANKED_CHAMPION);
  if (champ < 0) return rankedSimulate(idA, rankedTeams(idA)[0], idB, rankedTeams(idB)[0]);
  const foe = champ ? idA : idB, mine = rankedTeams(RANKED_CHAMPION)[0];
  for (const team of rankedTeams(foe)) {
    for (let k = 0; k < 160; k++) {
      const m = champ ? rankedSimulate(foe, team, RANKED_CHAMPION, mine) : rankedSimulate(RANKED_CHAMPION, mine, foe, team);
      if (m.winner === champ) return m;
      if (k % 10 === 9) await new Promise((r) => setImmediate(r)); // le bot reste disponible pendant les essais
    }
  }
  return null;
}
async function rankedFinish(client, s, m) {
  const { b, winner, reason } = m, before = b.players.map((p) => arenaStats(p.id).elo);
  // les manches jouées comptent pour les quêtes et le pass, comme dans un vrai combat
  for (const p of b.players) questProgress(p.id, "play_round", b.round);
  // finishBattle retire les joueurs de leur combat en cours : on garde un vrai combat lancé entre-temps
  const keep = b.players.map((p) => [p.id, userBattle.get(p.id)]);
  await finishBattle(client, b, winner, reason);
  for (const [id, v] of keep) if (v !== undefined && v !== b.id) userBattle.set(id, v);
  arenaBoardDirty = true;
  const after = b.players.map((p) => arenaStats(p.id).elo);
  s.done.push({ names: b.players.map((p) => p.name), ids: b.players.map((p) => p.id), winner, rounds: b.round, before, after });
}
async function rankedTick(client, s) {
  const now = Date.now();
  if (now < s.until) {
    const free = s.ids.filter((id) => (s.freeAt[id] ?? 0) <= now && !s.playing.has(id) && !userBattle.has(id) && !rankedQueue.has(id) && bestTeam(id).length >= 3).sort(() => Math.random() - 0.5);
    while (free.length >= 2) {
      const a = free.shift(), ea = arenaStats(a).elo;
      // un adversaire au hasard parmi ceux que la vraie file accepterait
      const foes = free.filter((x) => Math.abs(arenaStats(x).elo - ea) <= RQ_MAX_GAP).sort(() => Math.random() - 0.5);
      let m = null, b = null;
      for (const f of foes)
        if ((m = await rankedMatch(a, f))) {
          b = f;
          break;
        }
      if (!m) continue;
      free.splice(free.indexOf(b), 1);
      // durée d'un vrai combat : choix des équipes et pile ou face, puis chaque manche (choix + animation)
      const dur = rkRnd(35000, 70000) + m.b.round * rkRnd(10000, 18000);
      s.playing.add(a).add(b);
      setTimeout(() => {
        rankedFinish(client, s, m)
          .catch((err) => console.error("Classées auto (fin):", err.message))
          .finally(() => {
            s.playing.delete(a);
            s.playing.delete(b);
            for (const id of [a, b]) s.freeAt[id] = Date.now() + rkRnd(15000, 90000); // le temps de relancer une recherche
          });
      }, dur);
    }
  } else if (!s.playing.size) {
    clearInterval(s.timer);
    rankedSession = null;
    rankedReport(client, s);
  }
}
function rankedReport(client, s) {
  const fmt = (n) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;
  const lines = s.done.map((d) => {
    const head = d.winner >= 0 ? `**${d.names[d.winner]}** bat **${d.names[1 - d.winner]}**` : `**${d.names[0]}** et **${d.names[1]}** : match nul`;
    return `• ${head} (${d.rounds} manche${d.rounds > 1 ? "s" : ""}) · ${d.names.map((n, i) => `${n} ${d.after[i]} (${fmt(d.after[i] - d.before[i])})`).join(" · ")}`;
  });
  const per = s.ids
    .map((id) => {
      const mine = s.done.filter((d) => d.ids.includes(id));
      if (!mine.length) return null;
      const w = mine.filter((d) => d.winner >= 0 && d.ids[d.winner] === id).length, l = mine.filter((d) => d.winner >= 0 && d.ids[d.winner] !== id).length;
      return `**${pseudo(id)}** ${arenaStats(id).elo} pts (${fmt(arenaStats(id).elo - s.start[id])}) · ${w} V / ${l} D`;
    })
    .filter(Boolean);
  const idle = s.ids.filter((id) => !s.done.some((d) => d.ids.includes(id)));
  const text =
    `🏆 **Parties classées automatiques** — ${s.done.length} match${s.done.length > 1 ? "s" : ""} en 10 minutes\n${lines.join("\n") || "Aucun match : pas d'adversaire à moins de 600 points, ou pas assez de cartes."}${per.length ? `\n\n📊 ${per.join("\n📊 ")}` : ""}` +
    (idle.length ? `\n😴 Sans match : ${idle.map((id) => `${pseudo(id)} (${arenaStats(id).elo})`).join(", ")} — aucun adversaire à moins de 600 points${idle.includes(RANKED_CHAMPION) ? ", ou aucune victoire possible pour Charlotte" : ""}.` : "");
  client.users
    .fetch(AUTO_TRIGGER_ID)
    .then(async (u) => {
      for (let k = 0; k < text.length; k += 1990) await u.send(text.slice(k, k + 1990));
    })
    .catch(() => null);
}
function startRankedSession(client, ids) {
  const s = { ids, until: Date.now() + RANKED_SESSION_MS, freeAt: {}, playing: new Set(), done: [], start: Object.fromEntries(ids.map((id) => [id, arenaStats(id).elo])) };
  // chacun lance sa recherche à un moment différent
  for (const id of ids) s.freeAt[id] = Date.now() + rkRnd(0, 60000);
  s.timer = setInterval(() => {
    if (s.ticking) return;
    s.ticking = true;
    rankedTick(client, s)
      .catch((err) => console.error("Classées auto:", err.message))
      .finally(() => (s.ticking = false));
  }, 5000);
  rankedSession = s;
  return s;
}
{
  // « ranked » en message privé (même déclencheur que « full »)
  const auto = handleAutoMessage;
  handleAutoMessage = async (message) => {
    const words = message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID ? [] : message.content.trim().toLowerCase().split(/\s+/);
    if (words.at(-1) !== "ranked" || words.slice(0, -1).some((w) => !AUTO_WORDS[w])) return auto(message);
    if (rankedSession) return void (await message.reply(`⏳ Des parties classées automatiques sont déjà en cours (fin des recherches <t:${Math.floor(rankedSession.until / 1000)}:R>).`).catch(() => null));
    const named = words.slice(0, -1);
    let ids = [...new Set((named.length ? named : Object.keys(AUTO_WORDS)).flatMap((w) => AUTO_WORDS[w]))];
    if (ids.length < 2) ids = [...new Set(Object.values(AUTO_WORDS).flat())]; // seul : contre les autres membres
    const ready = ids.filter((id) => bestTeam(id).length >= 3), out = ids.filter((id) => !ready.includes(id));
    if (ready.length < 2) return void (await message.reply("❌ Il faut au moins deux joueurs avec 3 cartes pour des parties classées.").catch(() => null));
    const s = startRankedSession(message.client, ready);
    await message
      .reply(
        `🏆 **Parties classées lancées pour 10 minutes** (jusqu'à <t:${Math.floor(s.until / 1000)}:t>) entre ${ready.map((id) => `**${pseudo(id)}** (${arenaStats(id).elo})`).join(", ")}.\n` +
          `Matchs au hasard, 600 points d'écart au plus comme la vraie file ; chaque résultat tombe à la fin de son combat. Bilan ici à la fin.` +
          (out.length ? `\n⚠️ Pas assez de cartes (3 au moins) : ${out.map((id) => pseudo(id)).join(", ")}.` : "")
      )
      .catch(() => null);
  };
}
