// --- Parties classées automatiques (« ranked » en message privé, voir 29-automatique) ---
// « ranked » (tous les membres de AUTO_WORDS) ou « nina ranked », « nina clara ranked »… : pendant 10 minutes,
// les membres concernés cherchent des parties classées et les jouent, exactement comme de vrais joueurs :
// avis « cherche un adversaire » dans l'Arène, même règle d'écart de niveau que la file (120 points, puis plus avec l'attente,
// 600 au plus), puis un VRAI combat dans un fil (équipes, pile ou face, animation de chaque manche, résultat, fil supprimé),
// avec classement, poussière, quêtes, défi de la semaine et succès par la vraie fin de combat.
// Chaque match est d'abord simulé avec le moteur de l'Arène (coups et tirages de chance enregistrés), puis un pilote le rejoue
// en direct à un rythme humain : le combat affiché est exactement celui qui a été simulé.
// RANKED_CHAMPION gagne tous ses matchs : seul un combat qu'elle gagne réellement est retenu (son adversaire aligne au besoin
// une équipe moins forte de sa collection) ; sinon le match n'a pas lieu. Le bilan part en privé à AUTO_TRIGGER_ID.
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
  return teams.filter((t) => t.length >= 3).map((keys) => ({ keys, team: keys.map(fighter) })); // fiches calculées une seule fois
}
// copie neuve des fiches pour chaque combat simulé (le moteur modifie les PV)
const rankedCopy = (team) => team.map(({ card, ...f }) => ({ ...structuredClone(f), card }));
const rankedSide = (id, team) => ({ id, name: pseudo(id), avatar: null, isAI: false, team: rankedCopy(team), active: 0, energy: ruleIs("surcharge") ? 3 : 1, choice: null, ready: true, afk: 0 });
// le style d'un joueur en vrai combat : personne ne se met en garde, on lance le super dès qu'il est chargé, sinon on attaque
function rankedChoice(b, i) {
  return { type: b.players[i].energy >= SPECIAL_COST ? "special" : "attack" };
}
// un combat complet, manche par manche, avec le moteur de l'Arène ; on garde les coups et les tirages de chance de chaque manche
function rankedSimulate(idA, A, idB, B) {
  const b = { id: "rk-sim", ai: null, island: null, boss: null, aiLevel: null, players: [rankedSide(idA, A.team), rankedSide(idB, B.team)], round: 0, phase: "choose", mise: 0, bets: [], lastLines: [], history: [[], []], ranked: true, coin: Math.random() < 0.5 ? 0 : 1 };
  const script = { teams: [A.keys, B.keys], coin: b.coin, choices: [], rand: [] };
  for (;;) {
    b.round++;
    b.players.forEach((p, i) => (p.choice = rankedChoice(b, i)));
    script.choices.push(b.players.map((p) => ({ ...p.choice })));
    const real = Math.random, seq = [];
    Math.random = () => {
      const x = real();
      seq.push(x);
      return x;
    };
    let res;
    try {
      res = resolveRoundState(b);
    } finally {
      Math.random = real;
    }
    script.rand.push(seq);
    res.acts.forEach((a, i) => b.history[i].push(a.type));
    const alive = b.players.map((p) => p.team.some((f) => f.hp > 0));
    if (!alive[0] || !alive[1] || b.round >= 30) {
      script.winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
      script.rounds = b.round;
      return script;
    }
  }
}
// le match : si la championne joue, seul un combat qu'elle gagne réellement est retenu. Aucune victoire possible : pas de match.
async function rankedMatch(idA, idB) {
  const champ = [idA, idB].indexOf(RANKED_CHAMPION);
  if (champ < 0) return rankedSimulate(idA, rankedTeams(idA)[0], idB, rankedTeams(idB)[0]);
  const foe = champ ? idA : idB, mine = rankedTeams(RANKED_CHAMPION)[0];
  for (const team of rankedTeams(foe)) {
    for (let k = 0; k < 160; k++) {
      const sc = champ ? rankedSimulate(foe, team, RANKED_CHAMPION, mine) : rankedSimulate(RANKED_CHAMPION, mine, foe, team);
      if (sc.winner === champ) return sc;
      if (k % 10 === 9) await new Promise((r) => setImmediate(r)); // le bot reste disponible pendant les essais
    }
  }
  return null;
}
{
  // en direct, chaque manche d'un combat rejoué reprend les tirages de chance enregistrés : même résultat que la simulation
  const inner = resolveRoundState;
  resolveRoundState = (b) => {
    const seq = b.script && !b.script.diverged ? b.script.rand?.[b.round - 1] : null;
    if (!seq) return inner(b);
    const real = Math.random;
    let k = 0;
    Math.random = () => (k < seq.length ? seq[k++] : real());
    try {
      return inner(b);
    } finally {
      Math.random = real;
    }
  };
}

// --- Le pilote : joue le combat dans son fil, au rythme d'un joueur ---
const rankedPilots = new Map(); // id du combat -> minuterie
function rankedPilot(client, b) {
  if (rankedPilots.has(b.id)) return;
  const st = { round: -1, teamAt: b.players.map(() => Date.now() + rkRnd(6000, 28000)), teaming: [false, false] };
  rankedPilots.set(
    b.id,
    setInterval(() => {
      try {
        rankedPilotStep(client, b, st);
      } catch (err) {
        console.error("Classées auto (pilote):", err.message);
      }
    }, 700)
  );
}
function rankedPilotStop(id) {
  clearInterval(rankedPilots.get(id));
  rankedPilots.delete(id);
}
function rankedPilotStep(client, b, st) {
  if (b.phase === "over" || battles.get(b.id) !== b) return rankedPilotStop(b.id);
  const now = Date.now(), sc = b.script, mine = sc ? [0, 1] : b.pilot ?? [];
  // composition des équipes, chacun à son tour
  if (b.phase === "team") {
    for (const i of mine) {
      const p = b.players[i];
      // quelqu'un a choisi l'équipe à sa place : le combat continue normalement, sans garantie de résultat
      if (sc && p.ready && !st.teaming[i] && p.team.map((f) => f.key).join() !== sc.teams[i].join()) sc.diverged = true;
      if (p.ready || st.teaming[i] || now < st.teamAt[i]) continue;
      st.teaming[i] = true;
      setTeam(client, b, i, sc ? sc.teams[i] : bestTeam(p.id)).catch((err) => console.error("Classées auto (équipe):", err.message));
    }
    return;
  }
  if (b.phase !== "choose") return;
  // chaque manche : un temps de réflexion différent pour chacun (parfois un peu plus long)
  if (st.round !== b.round) {
    st.round = b.round;
    st.at = b.players.map(() => now + rkRnd(2500, 15000) + (Math.random() < 0.1 ? rkRnd(4000, 10000) : 0));
    st.done = [false, false];
  }
  let changed = false;
  for (const i of mine) {
    const p = b.players[i];
    if (st.done[i] || now < Math.min(st.at[i], b.deadline - 4000)) continue;
    st.done[i] = true;
    const planned = sc?.choices[b.round - 1]?.[i];
    if (p.choice) {
      // quelqu'un a joué à sa place : le combat continue normalement, sans garantie de résultat
      if (sc && !sc.diverged && JSON.stringify(p.choice) !== JSON.stringify(planned)) sc.diverged = true;
      continue;
    }
    p.choice = sc && !sc.diverged && planned ? { ...planned } : rankedChoice(b, i);
    changed = true;
  }
  if (!changed || b.phase !== "choose") return;
  // comme un clic sur les boutons du combat
  if (b.players.every((p) => p.choice)) resolveRound(client, b).catch((err) => console.error("Combat:", err.message));
  else
    livePayload(b)
      .then((payload) => b.message?.edit(payload))
      .catch(() => null);
}

// --- La chance de Charlotte (b.protect) contre un vrai joueur ---
// Chaque manche se joue avec les vraies règles et les vrais coups des deux côtés ; seuls les tirages de chance
// (esquives, coups critiques…) sont pris parmi plusieurs essais, le plus favorable à Charlotte.
const LUCK_TRIES = 60;
const rankedProbe = (b) => ({ ...b, id: "rk-probe", script: null, protect: null, players: b.players.map(({ team, ...p }) => ({ ...structuredClone(p), team: rankedCopy(team) })), history: structuredClone(b.history ?? [[], []]) });
function rankedLuckScore(b, i) {
  const me = b.players[i], foe = b.players[1 - i], up = (p) => p.team.some((f) => f.hp > 0), frac = (p) => p.team.reduce((a, f) => a + Math.max(0, f.hp) / f.maxHp, 0);
  if (!up(me)) return -1e6;
  if (!up(foe)) return 1e6;
  return frac(me) - frac(foe);
}
function rankedLuckyRound(inner, b) {
  const real = Math.random;
  let best = null;
  for (let k = 0; k < LUCK_TRIES; k++) {
    const probe = rankedProbe(b), seq = [];
    Math.random = () => {
      const x = real();
      seq.push(x);
      return x;
    };
    try {
      inner(probe);
    } finally {
      Math.random = real;
    }
    const score = rankedLuckScore(probe, b.protect);
    if (!best || score > best.score) best = { score, seq };
    if (score >= 1e6) break;
  }
  let k = 0;
  Math.random = () => (k < best.seq.length ? best.seq[k++] : real());
  try {
    return inner(b);
  } finally {
    Math.random = real;
  }
}
{
  const inner = resolveRoundState;
  resolveRoundState = (b) => (b.protect === 0 || b.protect === 1 ? rankedLuckyRound(inner, b) : inner(b));
}
// Charlotte ne peut être proposée à un vrai joueur que si elle gagne presque à coup sûr (essais avec sa chance)
async function rankedChampSafe(foeId) {
  const me = rankedTeams(RANKED_CHAMPION)[0], foe = rankedTeams(foeId)[0];
  if (!me || !foe) return false;
  let wins = 0;
  for (let n = 0; n < 30; n++) {
    const b = { id: "rk-sim", players: [rankedSide(foeId, foe.team), rankedSide(RANKED_CHAMPION, me.team)], round: 0, phase: "choose", history: [[], []], bets: [], lastLines: [], coin: Math.random() < 0.5 ? 0 : 1, protect: 1 };
    for (;;) {
      b.round++;
      b.players.forEach((p, i) => (p.choice = rankedChoice(b, i)));
      resolveRoundState(b);
      await new Promise((r) => setImmediate(r)); // une manche à la fois : le bot reste disponible
      const up = b.players.map((p) => p.team.some((f) => f.hp > 0));
      if (!up[0] || !up[1] || b.round >= 30) {
        if (up[1] && !up[0]) wins++;
        break;
      }
    }
  }
  return wins >= 30; // 30 sur 30, sinon elle n'est pas proposée
}

// --- La session : recherches, appariements comme la vraie file, bilan ---
async function rankedLaunch(client, s, a, b, sc) {
  const [ua, ub] = await Promise.all([client.users.fetch(a), client.users.fetch(b)]);
  const battle = await startBattle(client, { user: ua, name: pseudo(a) }, { user: ub, name: pseudo(b) }, { coin: sc.coin });
  if (!battle) return false;
  battle.ranked = true;
  battle.script = sc;
  s.active.set(battle.id, { ids: [a, b], before: [arenaStats(a).elo, arenaStats(b).elo] });
  s.last[a] = b;
  s.last[b] = a;
  rankedPilot(client, battle);
  return true;
}
const rankedNotice = (id) =>
  chan("arene")
    ?.send({
      content: `🔎 **${pseudo(id)}** (${tierOf(arenaStats(id).elo)[1]} · ${arenaStats(id).elo} pts) cherche un adversaire en **partie classée** !`,
      // même bouton en apparence, mais il ne fait entrer personne dans la file (voir plus bas)
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_rk_seek_${id}`).setLabel("Rejoindre la file").setEmoji("🏆").setStyle(ButtonStyle.Success))],
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
async function rankedTick(client, s) {
  const now = Date.now();
  if (now < s.until) {
    // ceux qui lancent leur recherche : l'avis apparaît dans l'Arène
    const inMatch = (id) => [...s.active.values()].some((m) => m.ids.includes(id)); // jusqu'au résultat affiché
    for (const id of s.ids) {
      if (s.search[id] || s.launching.has(id) || inMatch(id) || (s.freeAt[id] ?? 0) > now || userBattle.has(id) || rankedQueue.has(id) || bestTeam(id).length < 3) continue;
      s.search[id] = { since: now, notice: null };
      s.search[id].notice = await rankedNotice(id);
    }
    // appariement : même écart toléré que la vraie file (il s'élargit avec l'attente)
    const waiting = Object.keys(s.search).filter((id) => now - s.search[id].since >= 4000 && !userBattle.has(id)).sort(() => Math.random() - 0.5);
    while (waiting.length >= 2) {
      const a = waiting.shift(), ea = arenaStats(a).elo;
      // au hasard, mais pas tout de suite le même adversaire que la dernière fois s'il y a le choix
      const foes = waiting
        .filter((x) => Math.abs(arenaStats(x).elo - ea) <= Math.max(rqTolerance(now - s.search[a].since), rqTolerance(now - s.search[x].since)))
        .sort((x, y) => (s.last[a] === x) - (s.last[a] === y));
      let sc = null, b = null;
      for (const f of foes)
        if ((sc = await rankedMatch(a, f))) {
          b = f;
          break;
        }
      if (!sc) continue;
      waiting.splice(waiting.indexOf(b), 1);
      for (const id of [a, b]) {
        s.search[id].notice?.delete().catch(() => null);
        delete s.search[id];
        s.launching.add(id);
      }
      const ok = await rankedLaunch(client, s, a, b, sc).catch((err) => (console.error("Classées auto (lancement):", err.message), false));
      for (const id of [a, b]) {
        s.launching.delete(id);
        if (!ok) s.freeAt[id] = Date.now() + 30000;
      }
    }
    await rankedServeTargets(client, s, now);
    // la vraie file abandonne au bout de 10 minutes (ou quand le joueur part dans un autre combat)
    for (const [id, x] of Object.entries(s.search))
      if (now - x.since > RQ_TIMEOUT || userBattle.has(id)) {
        x.notice?.delete().catch(() => null);
        delete s.search[id];
      }
  } else {
    for (const x of Object.values(s.search)) x.notice?.delete().catch(() => null);
    s.search = {};
    if (s.active.size || s.launching.size) return;
    clearInterval(s.timer);
    rankedSession = null;
    rankedReport(client, s);
  }
}
// RANKED_TARGETS dans la vraie file pendant une session : on ne les laisse pas attendre seuls, ils tombent contre
// un des joueurs de la session au hasard (Charlotte plus rarement, et seulement si elle est sûre de gagner).
const RANKED_TARGETS = ["1411724649036910673"];
async function rankedServeTargets(client, s, now) {
  for (const tid of RANKED_TARGETS) {
    const e = rankedQueue.get(tid);
    if (!e || now - e.at < (e.rkWait ??= rkRnd(6000, 20000)) || userBattle.has(tid) || s.launching.has(tid)) continue;
    const inMatch = (id) => [...s.active.values()].some((m) => m.ids.includes(id));
    const pool = s.ids.filter((id) => id !== tid && !inMatch(id) && !s.launching.has(id) && !userBattle.has(id) && !rankedQueue.has(id) && bestTeam(id).length >= 3);
    if (pool.includes(RANKED_CHAMPION)) s.champSafe[tid] ??= await rankedChampSafe(tid);
    const weights = pool.map((id) => (id === RANKED_CHAMPION ? (s.champSafe[tid] ? 0.25 : 0) : 1));
    let r = Math.random() * weights.reduce((a, w) => a + w, 0), foe = null;
    pool.forEach((id, k) => {
      if (foe === null && (r -= weights[k]) <= 0 && weights[k] > 0) foe = id;
    });
    if (!foe) continue;
    // comme dans la vraie file : on quitte la file, les avis disparaissent
    rankedQueue.delete(tid);
    arenaBoardDirty = true;
    e.notice?.delete().catch(() => null);
    s.search[foe]?.notice?.delete().catch(() => null);
    delete s.search[foe];
    s.launching.add(foe).add(tid);
    try {
      const fu = await client.users.fetch(foe);
      const battle = await startBattle(client, { user: e.user, name: e.name }, { user: fu, name: pseudo(foe) }, {});
      if (!battle) {
        await e.interaction?.editReply({ content: "❌ Le combat n'a pas pu démarrer. Relancez la recherche.", embeds: [], components: [] }).catch(() => null);
        continue;
      }
      battle.ranked = true;
      battle.pilot = [1];
      battle.protect = foe === RANKED_CHAMPION ? 1 : null;
      s.active.set(battle.id, { ids: [tid, foe], before: [arenaStats(tid).elo, arenaStats(foe).elo], live: true });
      s.last[foe] = tid;
      rankedPilot(client, battle);
      const text = `✅ **Adversaire trouvé : ${pseudo(foe)}** (${tierOf(arenaStats(foe).elo)[1]} · ${arenaStats(foe).elo} pts) — partie classée : ${battle.message?.url ?? chan("arene")}`;
      await e.interaction?.editReply({ content: text, embeds: [], components: [], files: [], attachments: [] }).catch(() => null);
      e.user.send?.(text).catch(() => null);
    } catch (err) {
      console.error("Classées auto (joueur en file):", err.message);
    } finally {
      s.launching.delete(foe);
      s.launching.delete(tid);
    }
  }
}
// fin d'un combat rejoué : résultat noté pour le bilan, pause avant la recherche suivante
function rankedDone(b, winner) {
  rankedPilotStop(b.id);
  const s = rankedSession, m = s?.active.get(b.id);
  if (winner !== null && b.script && !b.script.diverged && winner !== b.script.winner) console.error(`Classées auto : le combat ${b.id} ne suit pas sa simulation (${winner} au lieu de ${b.script.winner}).`);
  if (!m) return;
  s.active.delete(b.id);
  for (const id of m.ids) s.freeAt[id] = Date.now() + rkRnd(15000, 90000); // le temps de relancer une recherche
  if (winner === null) return;
  s.done.push({ names: b.players.map((p) => p.name), ids: m.ids, winner, rounds: b.round, before: m.before, after: m.ids.map((id) => arenaStats(id).elo) });
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
    `🏆 **Parties classées automatiques** — ${s.done.length} match${s.done.length > 1 ? "s" : ""} en 10 minutes\n${lines.join("\n") || "Aucun match : pas d'adversaire à portée, ou pas assez de cartes."}${per.length ? `\n\n📊 ${per.join("\n📊 ")}` : ""}` +
    (idle.length ? `\n😴 Sans match : ${idle.map((id) => `${pseudo(id)} (${arenaStats(id).elo})`).join(", ")} — aucun adversaire à portée${idle.includes(RANKED_CHAMPION) ? ", ou aucune victoire possible pour Charlotte" : ""}.` : "");
  client.users
    .fetch(AUTO_TRIGGER_ID)
    .then(async (u) => {
      for (let k = 0; k < text.length; k += 1990) await u.send(text.slice(k, k + 1990));
    })
    .catch(() => null);
}
function startRankedSession(client, ids) {
  const s = { ids, until: Date.now() + RANKED_SESSION_MS, freeAt: {}, search: {}, last: {}, champSafe: {}, launching: new Set(), active: new Map(), done: [], start: Object.fromEntries(ids.map((id) => [id, arenaStats(id).elo])) };
  // chacun lance sa recherche à un moment différent
  for (const id of ids) s.freeAt[id] = Date.now() + rkRnd(0, 75000);
  s.timer = setInterval(() => {
    if (s.ticking) return;
    s.ticking = true;
    rankedTick(client, s)
      .catch((err) => console.error("Classées auto:", err.message))
      .finally(() => (s.ticking = false));
  }, 4000);
  rankedSession = s;
  return s;
}
{
  const finish = finishBattle, cancel = cancelBattle, resume = resumeBattle;
  finishBattle = async (client, b, winner, reason) => {
    const already = b.phase === "over";
    await finish(client, b, winner, reason);
    if (!already && (b.script || b.pilot)) rankedDone(b, winner);
  };
  cancelBattle = async (b, why) => {
    const already = b.phase === "over";
    await cancel(b, why);
    if (!already && (b.script || b.pilot)) rankedDone(b, null);
  };
  // après un redémarrage, le combat rejoué reprend avec son pilote (le script est sauvegardé avec le combat)
  resumeBattle = async (client, s) => {
    await resume(client, s);
    const b = battles.get(s.id);
    if (b?.script || b?.pilot) rankedPilot(client, b);
  };
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
        `🏆 **Parties classées lancées pour 10 minutes** (recherches jusqu'à <t:${Math.floor(s.until / 1000)}:t>) entre ${ready.map((id) => `**${pseudo(id)}** (${arenaStats(id).elo})`).join(", ")}.\n` +
          `Chacun lance sa recherche dans l'Arène, les matchs se font comme dans la vraie file et se jouent en direct dans leur fil. Bilan ici à la fin.\n` +
          `⚠️ Ne touchez pas aux boutons de ces combats : un clic change le combat prévu.` +
          (out.length ? `\n⚠️ Pas assez de cartes (3 au moins) : ${out.map((id) => pseudo(id)).join(", ")}.` : "")
      )
      .catch(() => null);
  };
}
{
  // sécurité : personne d'autre ne peut se mêler de ces parties
  const shop = handleShopInteraction;
  handleShopInteraction = async (interaction) => {
    const id = interaction.customId;
    if (typeof id === "string") {
      // l'avis de recherche : le joueur a « déjà trouvé » son adversaire
      const seek = /^carte_rk_seek_(\d+)$/.exec(id);
      if (seek) {
        await interaction.reply({ content: `⏳ Trop tard : **${pseudo(seek[1])}** vient de trouver un adversaire. Lancez votre propre recherche depuis le menu de l'Arène !`, ephemeral: true }).catch(() => null);
        return true;
      }
      // pas de paris (avec de vraies pièces) sur un combat rejoué
      const bet = /^carte_bt_(bet|bf)_([a-z0-9]+)/.exec(id);
      if (bet && battles.get(bet[2])?.script) {
        await interaction.reply({ content: "🔒 Les paris sont fermés pour ce combat.", ephemeral: true }).catch(() => null);
        return true;
      }
    }
    return shop(interaction);
  };
}
