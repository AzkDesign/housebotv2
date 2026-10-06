
// --- Tournoi du week-end ---
// Inscriptions du vendredi 12 h au samedi 14 h (4 à 32 joueurs), puis tableau à élimination directe
// classé par l'Arène. Chaque tour dure 3 heures ; les matchs se jouent en direct dans l'Arène.
// Un joueur absent à la fin du tour perd par forfait. La finale a toujours lieu le dimanche à 20 h.
const TOUR_MIN = 4, TOUR_MAX = 32;
const TOUR_ROUND_HOURS = 3;
const TOUR_READY_MIN = 15; // un joueur « prêt » attend son adversaire pendant 15 min
const TOUR_SLOTS = [[5, 14], [5, 17], [5, 20], [6, 14], [6, 17], [6, 20]]; // [jour (lundi = 0), heure] des tours
const TOUR_PRIZES = {
  champion: { dust: 1500, money: 5000, pack: "prestige" },
  finale: { dust: 700, money: 2000, pack: "premium" },
  demi: { dust: 300, money: 0, pack: "standard" },
};
const TOUR_WIN_DUST = 80, TOUR_PLAY_DUST = 40;
let tourDirty = true;

// heures de Paris
function parisParts(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second, wd: { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[p.weekday] };
}
// instant correspondant à « tel jour de cette semaine (lundi = 0), à telle heure, heure de Paris »
function parisAt(weekday, hour) {
  const now = new Date(), p = parisParts(now);
  const offset = Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - now.getTime()) / 60000) * 60000;
  return Date.UTC(p.y, p.m - 1, p.d + (weekday - p.wd), hour, 0, 0) - offset;
}
const tourKey = () => new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date(parisAt(5, 12)));
const tourState = () => load().tournament ?? null;
const tourWhen = (ts) => `<t:${Math.floor(ts / 1000)}:F>`;
const tourRel = (ts) => `<t:${Math.floor(ts / 1000)}:R>`;
const tourDayLabel = (ts) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", hour: "numeric" }).format(new Date(ts)).replace(" ", " à ").replace(/(\d+)$/, "$1 h");
function roundName(t, r) {
  const left = t.rounds.length - r;
  return left === 1 ? "Finale" : left === 2 ? "Demi-finales" : left === 3 ? "Quarts de finale" : left === 4 ? "Huitièmes de finale" : "Seizièmes de finale";
}
const roundShort = (t, r) => ({ Finale: "FINALE", "Demi-finales": "DEMIES", "Quarts de finale": "QUARTS", "Huitièmes de finale": "1/8", "Seizièmes de finale": "1/16" })[roundName(t, r)];

// --- Tableau ---
function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((x) => [x, n + 1 - x]);
  }
  return order;
}
function tourDraw(t) {
  const seeds = [...t.players].sort((a, b) => arenaStats(b).elo - arenaStats(a).elo);
  const R = Math.max(1, Math.ceil(Math.log2(seeds.length))), size = 2 ** R, order = seedOrder(size);
  const blank = () => ({ a: null, b: null, winner: null, how: null, ready: {}, showed: {}, battle: null, notified: false });
  t.rounds = [];
  for (let r = 0; r < R; r++) t.rounds.push(Array.from({ length: size / 2 ** (r + 1) }, blank));
  t.rounds[0].forEach((m, k) => {
    m.a = seeds[order[2 * k] - 1] ?? null;
    m.b = seeds[order[2 * k + 1] - 1] ?? null;
    if (!m.a || !m.b) Object.assign(m, { winner: m.a ?? m.b, how: "exempt" });
  });
  t.seeds = seeds;
  t.slots = TOUR_SLOTS.slice(TOUR_SLOTS.length - R).map(([d, h]) => parisAt(d, h));
  t.started = [];
  t.closed = [];
  t.phase = "rounds";
  tourPropagate(t);
}
// les vainqueurs avancent dans le tableau
function tourPropagate(t) {
  for (let r = 0; r + 1 < t.rounds.length; r++)
    t.rounds[r].forEach((m, k) => {
      if (!m.winner) return;
      const next = t.rounds[r + 1][k >> 1];
      next[k % 2 ? "b" : "a"] = m.winner;
    });
}
// le match en cours d'un joueur (tour ouvert, pas encore décidé)
function tourMatchOf(t, userId) {
  if (!t || t.phase !== "rounds") return null;
  for (let r = 0; r < t.rounds.length; r++) {
    if (!t.started[r] || t.closed[r]) continue;
    const k = t.rounds[r].findIndex((m) => !m.winner && (m.a === userId || m.b === userId));
    if (k >= 0) return { r, k, m: t.rounds[r][k] };
  }
  return null;
}
const tourAlive = (t, userId) => t.phase === "rounds" && !t.rounds.some((round) => round.some((m) => m.winner && m.winner !== userId && (m.a === userId || m.b === userId)));

// --- Déroulement (appelé chaque minute) ---
async function tournamentTick(client) {
  const st = load(), now = Date.now();
  let t = st.tournament;
  const key = tourKey(), open = parisAt(4, 12), close = parisAt(5, 14);
  if (!t || t.key !== key) {
    if (now < open || now >= close) return;
    t = st.tournament = { key, phase: "inscriptions", open, close, players: [], last: t?.champion ? { champion: t.champion, key: t.key } : (t?.last ?? null) };
    save();
    tourDirty = true;
    await chan("annonces")
      ?.send({ content: `🏆 **Le tournoi du week-end est ouvert !** Inscrivez-vous dans ${chan("tournoi")} avant ${tourDayLabel(close)} : 32 places, élimination directe, finale dimanche à 20 h.` })
      .then((m) => deleteLater(m, 6 * 60 * MINUTE))
      .catch(() => null);
    return;
  }
  if (t.phase === "inscriptions" && now >= t.close) {
    if (t.players.length < TOUR_MIN) {
      t.phase = "cancelled";
      save();
      tourDirty = true;
      for (const id of t.players) client.users.fetch(id).then((u) => u.send(`🏆 Le tournoi du week-end est annulé : il n'y a eu que **${t.players.length}** inscrit${t.players.length > 1 ? "s" : ""} (il en faut ${TOUR_MIN}). Rendez-vous vendredi prochain !`)).catch(() => null);
      return;
    }
    tourDraw(t);
    save();
    tourDirty = true;
    const byes = t.rounds[0].filter((m) => m.how === "exempt").map((m) => m.winner);
    for (const id of t.players)
      client.users
        .fetch(id)
        .then((u) => u.send(`🏆 **Le tableau du tournoi est tiré !** ${t.players.length} joueurs, ${t.rounds.length} tours.\n${byes.includes(id) ? `Bonne nouvelle : vous êtes **exempté** du premier tour grâce à votre classement. Votre premier match : ${tourDayLabel(t.slots[1])}.` : `Votre premier match : ${tourDayLabel(t.slots[0])}. Vous recevrez un message dès qu'il s'ouvre.`}\nTout se passe dans ${chan("tournoi")}.`))
        .catch(() => null);
  }
  if (t.phase !== "rounds") return;
  for (let r = 0; r < t.rounds.length; r++) {
    // ouverture du tour
    if (!t.started[r] && now >= t.slots[r]) {
      t.started[r] = true;
      save();
      tourDirty = true;
      await chan("tournoi")
        ?.send({ content: `⚔️ **${roundName(t, r)}** : c'est parti ! Les matchs se jouent jusqu'à ${tourDayLabel(t.slots[r] + TOUR_ROUND_HOURS * 3600000).replace(/^\S+ à /, "")}.` })
        .then((m) => deleteLater(m, TOUR_ROUND_HOURS * 60 * MINUTE))
        .catch(() => null);
    }
    // les joueurs dont le match est prêt sont prévenus
    if (t.started[r] && !t.closed[r])
      for (const m of t.rounds[r]) {
        if (m.winner || !m.a || !m.b || m.notified) continue;
        m.notified = true;
        save();
        for (const [me, foe] of [[m.a, m.b], [m.b, m.a]])
          client.users
            .fetch(me)
            .then((u) => u.send(tourMatchDM(t, r, foe)))
            .catch(() => null);
      }
    // fin du tour : forfaits et tirages au sort
    if (t.started[r] && !t.closed[r] && now >= t.slots[r] + TOUR_ROUND_HOURS * 3600000) {
      if (t.rounds[r].some((m) => !m.winner && m.battle && battles.has(m.battle))) continue; // un match se termine encore
      for (const m of t.rounds[r]) {
        if (m.winner || !m.a || !m.b) continue;
        const sa = !!m.showed[m.a], sb = !!m.showed[m.b];
        if (sa !== sb) Object.assign(m, { winner: sa ? m.a : m.b, how: "forfait" });
        else Object.assign(m, { winner: Math.random() < 0.5 ? m.a : m.b, how: "tirage" });
        const loser = m.winner === m.a ? m.b : m.a;
        client.users.fetch(loser).then((u) => u.send(`🏆 Tournoi : votre match contre **${pseudo(m.winner)}** n'a pas été joué à temps. ${m.how === "forfait" ? "Votre adversaire s'était présenté : il gagne par forfait." : "Résultat au tirage au sort… il n'a pas tourné en votre faveur."}`)).catch(() => null);
        client.users.fetch(m.winner).then((u) => u.send(`🏆 Tournoi : votre match contre **${pseudo(loser)}** n'a pas été joué à temps. ${m.how === "forfait" ? "Vous vous étiez présenté : **victoire par forfait** !" : "Le tirage au sort vous qualifie !"}`)).catch(() => null);
      }
      t.closed[r] = true;
      tourPropagate(t);
      save();
      tourDirty = true;
    }
  }
  const final = t.rounds.at(-1)[0];
  if (final.winner && t.phase === "rounds") await tourFinish(client, t);
}
function tourMatchDM(t, r, foe) {
  return {
    content: `🏆 **Tournoi du week-end — ${roundName(t, r)}**\nVotre adversaire : **${pseudo(foe)}**. Le match est ouvert jusqu'à ${tourDayLabel(t.slots[r] + TOUR_ROUND_HOURS * 3600000).replace(/^\S+ à /, "")} (${tourRel(t.slots[r] + TOUR_ROUND_HOURS * 3600000)}).\nCliquez sur **Jouer mon match** : le combat démarre dès que vous êtes prêts tous les deux. Si votre adversaire ne vient pas et que vous vous êtes présenté, vous gagnez par forfait.`,
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_to_play").setLabel("Jouer mon match").setEmoji("⚔️").setStyle(ButtonStyle.Danger))],
  };
}
// fin d'un combat de tournoi
async function tourBattleOver(client, b, winner) {
  const t = tourState(), ref = b.tournament;
  if (!t || t.key !== ref.key || t.phase !== "rounds") return;
  const m = t.rounds[ref.r]?.[ref.k];
  if (!m || m.winner) return;
  m.battle = null;
  if (winner < 0) {
    m.ready = {};
    save();
    for (const id of [m.a, m.b]) client.users.fetch(id).then((u) => u.send({ content: "🏆 Tournoi : **égalité** ! Il faut un vainqueur : rejouez le match.", components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_to_play").setLabel("Rejouer le match").setEmoji("⚔️").setStyle(ButtonStyle.Danger))] })).catch(() => null);
    return;
  }
  m.winner = b.players[winner].id;
  m.how = "combat";
  const loser = m.winner === m.a ? m.b : m.a;
  load().dust[m.winner] = (load().dust[m.winner] ?? 0) + TOUR_WIN_DUST;
  (t.played ??= {})[m.a] = true;
  t.played[m.b] = true;
  tourPropagate(t);
  save();
  tourDirty = true;
  const last = ref.r === t.rounds.length - 1;
  await chan("tournoi")
    ?.send({ content: `⚔️ **${pseudo(m.winner)}** bat **${pseudo(loser)}** (${roundName(t, ref.r).toLowerCase()})${last ? "" : ` et file vers les ${roundName(t, ref.r + 1).toLowerCase()} !`}`, allowedMentions: { parse: [] } })
    .then((x) => deleteLater(x, 30 * MINUTE))
    .catch(() => null);
  if (last) await tourFinish(client, t);
}
async function tourFinish(client, t) {
  t.phase = "done";
  const final = t.rounds.at(-1)[0], champion = final.winner, finalist = final.a === champion ? final.b : final.a;
  const semis = t.rounds.length >= 2 ? t.rounds.at(-2).map((m) => (m.winner === m.a ? m.b : m.a)).filter((x) => x && x !== champion && x !== finalist) : [];
  t.champion = champion;
  t.podium = { champion, finalist, semis };
  const give = (id, p) => {
    if (!id) return;
    load().dust[id] = (load().dust[id] ?? 0) + p.dust;
    if (p.money) changeBalance(id, p.money, "Tournoi du week-end", { force: true });
    if (p.pack) addPacks(id, packKey(CURRENT_GEN, p.pack), 1);
  };
  give(champion, TOUR_PRIZES.champion);
  give(finalist, TOUR_PRIZES.finale);
  for (const id of semis) give(id, TOUR_PRIZES.demi);
  for (const id of Object.keys(t.played ?? {})) load().dust[id] = (load().dust[id] ?? 0) + TOUR_PLAY_DUST;
  ustat(champion, "tourneyWins");
  save();
  tourDirty = true;
  const guild = channelRef?.guild;
  if (guild) {
    const role = await findOrCreateRole(guild, { name: "🏆 Champion du tournoi", color: 0xf59e0b, hoist: true }).catch(() => null);
    if (role) {
      for (const mb of role.members.values()) await mb.roles.remove(role).catch(() => null);
      await (await guild.members.fetch(champion).catch(() => null))?.roles.add(role).catch(() => null);
    }
  }
  checkAchievements(champion).catch(() => null);
  await chan("annonces")
    ?.send({
      content: `🏆 **${pseudo(champion)} remporte le tournoi du week-end !**\n🥈 Finaliste : **${pseudo(finalist)}**${semis.length ? ` · 🥉 Demi-finalistes : ${semis.map((x) => `**${pseudo(x)}**`).join(", ")}` : ""}\nLe champion gagne **${TOUR_PRIZES.champion.dust} ✨**, **${formatEuro(TOUR_PRIZES.champion.money)}**, un booster Prestige et le rôle **Champion du tournoi** jusqu'au prochain week-end.`,
      allowedMentions: { parse: [] },
    })
    .catch(() => null);
  for (const [id, p, label] of [[champion, TOUR_PRIZES.champion, "🏆 **Vous êtes le champion du tournoi !**"], [finalist, TOUR_PRIZES.finale, "🥈 **Finaliste du tournoi !**"], ...semis.map((x) => [x, TOUR_PRIZES.demi, "🥉 **Demi-finaliste du tournoi !**"])])
    client.users.fetch(id).then((u) => u.send(`${label} Récompense : **${p.dust} ✨**${p.money ? `, **${formatEuro(p.money)}**` : ""} et 1 booster ${PACKS[p.pack].name}.`)).catch(() => null);
}

// --- Image : inscriptions ou tableau ---
async function drawTournament(t) {
  const R = t?.rounds?.length ?? 0, first = R ? t.rounds[0].length : 0;
  const W = 1600, top = 245, rowH = 62, listRows = Math.ceil((t?.phase === "inscriptions" ? t.players.length : 0) / 4);
  const H = R ? Math.max(820, top + Math.max(first, 4) * rowH + 70) : Math.max(520, 240 + listRows * 64 + 60);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b1026");
  bg.addColorStop(0.6, "#151033");
  bg.addColorStop(1, "#05060f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, -40, 700, "#f59e0b", 0.28);
  glow(ctx, W - 120, H - 60, 420, "#7c3aed", 0.18);
  // éclats dorés
  const RS = seeded(hashOf(t?.key ?? "tournoi"));
  for (let k = 0; k < 90; k++) disc(ctx, RS() * W, RS() * H, RS() * 1.6 + 0.3, `rgba(253,230,138,${0.15 + RS() * 0.4})`);
  // titre
  ctx.textAlign = "center";
  ctx.font = "20px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 54, 6);
  const tg = ctx.createLinearGradient(0, 70, 0, 128);
  tg.addColorStop(0, "#fff7d6");
  tg.addColorStop(1, "#f59e0b");
  ctx.font = "64px CardTitle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.strokeText("Tournoi du week-end", W / 2, 124);
  ctx.fillStyle = tg;
  ctx.fillText("Tournoi du week-end", W / 2, 124);
  iconTrophy(ctx, W / 2 - 380, 104, 30);
  iconTrophy(ctx, W / 2 + 380, 104, 30);
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "#c4b5fd";
  const sub = !t || t.phase === "cancelled" ? "Inscriptions chaque vendredi à midi · finale le dimanche à 20 h" : t.phase === "inscriptions" ? `Inscriptions ouvertes jusqu'à ${tourDayLabel(t.close)} · ${t.players.length} / ${TOUR_MAX} joueurs` : t.phase === "done" ? `Champion : ${pseudo(t.champion)}` : `${t.players.length} joueurs · élimination directe · finale dimanche à 20 h`;
  ctx.fillText(sub, W / 2, 164);
  if (!R) {
    // liste des inscrits (ou annonce du prochain tournoi)
    const list = t?.phase === "inscriptions" ? t.players : [];
    if (!list.length) {
      ctx.font = "34px CardTitle";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(t?.phase === "inscriptions" ? "Soyez le premier inscrit !" : t?.phase === "cancelled" ? "Pas assez de joueurs ce week-end." : "Prochain tournoi : vendredi à midi", W / 2, 320);
      if (t?.last?.champion || t?.champion) {
        ctx.font = "22px CardBold";
        ctx.fillStyle = "#e2e8f0";
        ctx.fillText(`Dernier champion : ${pseudo(t.champion ?? t.last.champion)}`, W / 2, 370);
      }
    }
    const cols = 4, cw = 340, ch = 50, x0 = (W - cols * cw - (cols - 1) * 20) / 2;
    list.forEach((id, i) => {
      const x = x0 + (i % cols) * (cw + 20), y = 220 + Math.floor(i / cols) * (ch + 14);
      roundRect(ctx, x, y, cw, ch, 12);
      ctx.fillStyle = "rgba(30,27,75,0.75)";
      ctx.fill();
      ctx.strokeStyle = "rgba(251,191,36,0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.font = "16px CardBold";
      ctx.fillStyle = "#fbbf24";
      ctx.fillText(String(i + 1).padStart(2, "0"), x + 16, y + 31);
      ctx.font = `${fitText(ctx, pseudo(id), cw - 150, 20, "CardBold")}px CardBold`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(pseudo(id), x + 52, y + 32);
      ctx.textAlign = "right";
      ctx.font = "14px CardText";
      ctx.fillStyle = "#a5b4fc";
      ctx.fillText(`${arenaStats(id).elo} pts`, x + cw - 14, y + 31);
    });
    return c;
  }
  // tableau
  const colW = (W - 80) / (R + 1), boxW = Math.min(250, colW - 46), boxH = 50, areaH = H - top - 40;
  const centerY = (r, k) => top + ((k + 0.5) * areaH) / t.rounds[r].length;
  for (let r = 0; r < R; r++) {
    const x = 40 + r * colW + (colW - boxW) / 2;
    const live = t.started[r] && !t.closed[r] && t.rounds[r].some((m) => !m.winner);
    ctx.textAlign = "center";
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = live ? "#4ade80" : "#fbbf24";
    spaced(ctx, roundShort(t, r), x + boxW / 2, top - 14, 3);
    ctx.font = "12px CardText";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(tourDayLabel(t.slots[r]), x + boxW / 2, top + 2);
    t.rounds[r].forEach((m, k) => {
      const y = centerY(r, k) - boxH / 2 + 10;
      // liaison vers le tour suivant
      if (r + 1 < R) {
        const nx = 40 + (r + 1) * colW + (colW - boxW) / 2, ny = centerY(r + 1, k >> 1) + 10;
        ctx.strokeStyle = m.winner ? "rgba(251,191,36,0.7)" : "rgba(148,163,184,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + boxW, y + boxH / 2);
        ctx.lineTo(x + boxW + (nx - x - boxW) / 2, y + boxH / 2);
        ctx.lineTo(x + boxW + (nx - x - boxW) / 2, ny);
        ctx.lineTo(nx, ny);
        ctx.stroke();
      }
      roundRect(ctx, x, y, boxW, boxH, 9);
      ctx.fillStyle = live && !m.winner && m.a && m.b ? "rgba(22,101,52,0.55)" : "rgba(15,23,42,0.85)";
      ctx.fill();
      ctx.strokeStyle = m.winner ? "rgba(251,191,36,0.75)" : "rgba(148,163,184,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      for (const [j, id] of [m.a, m.b].entries()) {
        const ly = y + 19 + j * 23, won = m.winner && m.winner === id, lost = m.winner && id && m.winner !== id;
        ctx.textAlign = "left";
        const name = id ? pseudo(id) : r === 0 ? "exempt" : "…";
        ctx.font = `${fitText(ctx, name, boxW - 50, 15, won ? "CardBold" : "CardText")}px ${won ? "CardBold" : "CardText"}`;
        ctx.fillStyle = won ? "#fde68a" : lost ? "rgba(148,163,184,0.55)" : id ? "#e2e8f0" : "rgba(148,163,184,0.45)";
        ctx.fillText(name, x + 12, ly);
        if (won) star5(ctx, x + boxW - 16, ly - 5, 6, "#fbbf24");
      }
      if (m.winner && m.how && m.how !== "combat" && m.how !== "exempt") {
        ctx.textAlign = "right";
        ctx.font = "10px CardText";
        ctx.fillStyle = "#fca5a5";
        ctx.fillText(m.how, x + boxW - 26, y + 19);
      }
    });
  }
  // champion
  const cx = 40 + R * colW + colW / 2, cy = centerY(R - 1, 0) + 10, champ = t.rounds.at(-1)[0].winner;
  glow(ctx, cx, cy - 20, 160, "#fbbf24", champ ? 0.5 : 0.2);
  iconTrophy(ctx, cx, cy - 40, 54);
  ctx.textAlign = "center";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spaced(ctx, "CHAMPION", cx, cy + 40, 4);
  ctx.font = `${fitText(ctx, champ ? pseudo(champ) : "?", colW - 30, 30, "CardTitle")}px CardTitle`;
  ctx.fillStyle = champ ? "#fff7d6" : "rgba(226,232,240,0.5)";
  ctx.fillText(champ ? pseudo(champ) : "?", cx, cy + 80);
  return c;
}

// --- Messages ---
function tourButtons(t) {
  const row = new ActionRowBuilder();
  if (t?.phase === "inscriptions")
    row.addComponents(new ButtonBuilder().setCustomId("carte_to_join").setLabel("S'inscrire").setEmoji("✍️").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("carte_to_leave").setLabel("Se désinscrire").setStyle(ButtonStyle.Secondary));
  if (t?.phase === "rounds") row.addComponents(new ButtonBuilder().setCustomId("carte_to_play").setLabel("Jouer mon match").setEmoji("⚔️").setStyle(ButtonStyle.Danger));
  row.addComponents(new ButtonBuilder().setCustomId("carte_to_me").setLabel("Mon tournoi").setEmoji("🎟️").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId("carte_to_rules").setLabel("Règles et récompenses").setEmoji("📖").setStyle(ButtonStyle.Secondary));
  return [row];
}
async function tournamentPayload() {
  const t = tourState(), file = new AttachmentBuilder(await (await drawTournament(t)).encode("jpeg", 88), { name: "tournoi.jpg" });
  let desc;
  if (!t || t.phase === "cancelled" || (t.phase === "done" && Date.now() > parisAt(6, 23) + 3 * 3600000))
    desc = `Chaque week-end, **32 joueurs** s'affrontent en élimination directe avec leurs cartes.\n✍️ Inscriptions du **vendredi midi** au **samedi 14 h** · 🏆 finale le **dimanche à 20 h**.${t?.phase === "cancelled" ? "\n\n*Ce week-end, il n'y a pas eu assez d'inscrits.*" : ""}`;
  else if (t.phase === "inscriptions") desc = `✍️ **Inscriptions ouvertes** jusqu'à ${tourWhen(t.close)} (${tourRel(t.close)}).\n**${t.players.length} / ${TOUR_MAX}** inscrits · il faut au moins ${TOUR_MIN} joueurs.\n\nLe tableau est tiré selon le classement de l'Arène : les mieux classés peuvent être exemptés du premier tour.`;
  else if (t.phase === "rounds") {
    const r = t.started.lastIndexOf(true), live = r >= 0 && !t.closed[r];
    const next = t.slots.findIndex((s, i) => !t.started[i]);
    desc = live
      ? `⚔️ **${roundName(t, r)}** en cours jusqu'à <t:${Math.floor((t.slots[r] + TOUR_ROUND_HOURS * 3600000) / 1000)}:t>. Qualifiés : cliquez sur **Jouer mon match** — le combat démarre quand les deux joueurs sont prêts.`
      : next >= 0
        ? `⏳ Prochain tour (**${roundName(t, next).toLowerCase()}**) ${tourRel(t.slots[next])}.`
        : "⚔️ Les derniers matchs se terminent…";
  } else desc = `🏆 **${pseudo(t.champion)}** remporte le tournoi !\n🥈 ${pseudo(t.podium.finalist)}${t.podium.semis.length ? ` · 🥉 ${t.podium.semis.map(pseudo).join(", ")}` : ""}\n\nProchain tournoi : vendredi à midi.`;
  return {
    embeds: [new EmbedBuilder().setColor(0xf59e0b).setTitle("🏆 Tournoi du week-end").setDescription(desc).setImage("attachment://tournoi.jpg")],
    files: [file],
    components: tourButtons(t),
  };
}
async function refreshTournament() {
  const ch = chan("tournoi");
  if (!ch || ch === channelRef) return;
  tourDirty = false;
  const st = load(), payload = await tournamentPayload();
  let msg = st.tournamentMessageId ? await ch.messages.fetch(st.tournamentMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit({ ...payload, attachments: [] }).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.tournamentMessageId = msg.id;
      save();
    }
  }
}
const TOUR_RULES = () =>
  new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("📖 Le tournoi du week-end")
    .setDescription(
      `✍️ **Inscriptions** : du vendredi 12 h au samedi 14 h, gratuites, ${TOUR_MAX} places (il faut ${TOUR_MIN} joueurs au moins).\n` +
        "🎲 **Tableau** : élimination directe, classé selon l'Arène (les mieux classés peuvent être exemptés du premier tour).\n" +
        `⏰ **Tours** : samedi 14 h, 17 h, 20 h puis dimanche 14 h, 17 h et **finale à 20 h** (selon le nombre d'inscrits). Chaque tour dure ${TOUR_ROUND_HOURS} heures.\n` +
        "⚔️ **Matchs** : combat de l'Arène en direct. Cliquez sur **Jouer mon match** : le combat démarre dès que les deux joueurs sont prêts. Égalité : on rejoue.\n" +
        "🚪 **Absents** : à la fin du tour, celui qui s'est présenté gagne par forfait. Si aucun des deux n'est venu, tirage au sort.\n\n" +
        `🏆 **Champion** : ${TOUR_PRIZES.champion.dust} ✨, ${formatEuro(TOUR_PRIZES.champion.money)}, 1 booster Prestige et le rôle **Champion du tournoi** jusqu'au week-end suivant.\n` +
        `🥈 **Finaliste** : ${TOUR_PRIZES.finale.dust} ✨, ${formatEuro(TOUR_PRIZES.finale.money)} et 1 booster Premium.\n` +
        `🥉 **Demi-finalistes** : ${TOUR_PRIZES.demi.dust} ✨ et 1 booster Standard.\n` +
        `✨ Chaque match gagné : +${TOUR_WIN_DUST} ✨ · chaque joueur ayant disputé un match : +${TOUR_PLAY_DUST} ✨.`
    );
function tourMePayload(userId) {
  const t = tourState();
  let text;
  if (!t || !["inscriptions", "rounds", "done"].includes(t.phase)) text = "Aucun tournoi en cours. Les inscriptions ouvrent **vendredi à midi**.";
  else if (t.phase === "inscriptions") text = t.players.includes(userId) ? `✅ Vous êtes **inscrit** (${t.players.length} / ${TOUR_MAX}). Tirage du tableau ${tourRel(t.close)}.` : `Vous n'êtes pas inscrit. Il reste **${TOUR_MAX - t.players.length}** places, jusqu'à ${tourWhen(t.close)}.`;
  else if (!t.players.includes(userId)) text = "Vous ne participez pas à ce tournoi. Rendez-vous vendredi prochain !";
  else if (t.phase === "done") text = t.champion === userId ? "🏆 **Vous êtes le champion du tournoi !**" : "Le tournoi est terminé. Merci d'avoir participé !";
  else if (!tourAlive(t, userId)) text = "Vous avez été éliminé. Vous pouvez suivre la suite du tableau dans le salon du tournoi.";
  else {
    const cur = tourMatchOf(t, userId);
    if (cur) {
      const foe = cur.m.a === userId ? cur.m.b : cur.m.a, end = t.slots[cur.r] + TOUR_ROUND_HOURS * 3600000;
      text = `⚔️ **${roundName(t, cur.r)}** contre **${pseudo(foe)}**, à jouer avant <t:${Math.floor(end / 1000)}:t> (${tourRel(end)}).${cur.m.ready[foe] > Date.now() - TOUR_READY_MIN * MINUTE ? "\n🟢 Votre adversaire est prêt : lancez le match !" : ""}`;
    } else {
      const r = t.rounds.findIndex((round) => round.some((m) => !m.winner && (m.a === userId || m.b === userId)));
      const nr = r >= 0 ? r : t.rounds.findIndex((round, i) => !t.started[i]);
      text = nr >= 0 ? `✅ Qualifié ! Prochain match : **${roundName(t, nr).toLowerCase()}**, ${tourDayLabel(t.slots[nr])} (${tourRel(t.slots[nr])}).` : "✅ Qualifié ! En attente des autres matchs.";
    }
  }
  return { content: `🏆 **Tournoi du week-end**\n${text}`, ephemeral: true };
}

// --- Interactions ---
async function handleTournamentInteraction(interaction, client) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "tournoi";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("carte_to_"))) return false;
  const userId = interaction.user.id, t = tourState();
  const say = async (p) => (await interaction.reply(typeof p === "string" ? { content: p, ephemeral: true } : p), true);
  if (isCmd || id === "carte_to_me") {
    await interaction.reply({ ...tourMePayload(userId), components: tourButtons(t).map((r) => r) });
    return true;
  }
  if (id === "carte_to_rules") {
    await interaction.reply({ embeds: [TOUR_RULES()], ephemeral: true });
    return true;
  }
  if (id === "carte_to_join") {
    if (t?.phase !== "inscriptions") return say("❌ Les inscriptions ne sont pas ouvertes.");
    if (t.players.includes(userId)) return say("✅ Vous êtes déjà inscrit.");
    if (t.players.length >= TOUR_MAX) return say("❌ Le tournoi est complet.");
    if (bestTeam(userId).length < 3) return say("❌ Il faut au moins **3 cartes** pour participer. Ouvrez des boosters !");
    t.players.push(userId);
    save();
    tourDirty = true;
    await interaction.reply({ content: `✅ **Inscrit au tournoi !** (${t.players.length} / ${TOUR_MAX}) Le tableau sera tiré ${tourRel(t.close)}. Vous serez prévenu en message privé avant chaque match.`, ephemeral: true });
    return true;
  }
  if (id === "carte_to_leave") {
    if (t?.phase !== "inscriptions" || !t.players.includes(userId)) return say("Vous n'êtes pas inscrit.");
    t.players.splice(t.players.indexOf(userId), 1);
    save();
    tourDirty = true;
    await interaction.reply({ content: "Vous êtes désinscrit du tournoi.", ephemeral: true });
    return true;
  }
  if (id === "carte_to_play") {
    const cur = tourMatchOf(t, userId);
    if (!cur) return say(tourMePayload(userId));
    const { m, r, k } = cur, foe = m.a === userId ? m.b : m.a;
    if (m.battle && battles.has(m.battle)) {
      const b = battles.get(m.battle);
      return say(`⚔️ Votre match est déjà en cours : ${b.message?.url ?? chan("arene")}`);
    }
    if (userBattle.has(userId)) return say("❌ Vous êtes déjà dans un autre combat : terminez-le d'abord.");
    m.showed[userId] = true;
    m.ready[userId] = Date.now();
    save();
    const foeReady = (m.ready[foe] ?? 0) > Date.now() - TOUR_READY_MIN * MINUTE;
    if (!foeReady || userBattle.has(foe)) {
      await interaction.reply({ content: `✅ **Vous êtes prêt !** **${pseudo(foe)}** est prévenu. Le combat démarrera dès qu'il clique à son tour (votre présence est notée : s'il ne vient pas d'ici la fin du tour, vous gagnez par forfait).`, ephemeral: true });
      client.users
        .fetch(foe)
        .then((u) => u.send({ content: `🏆 **${pseudo(userId)}** vous attend pour votre match du tournoi (${roundName(t, r).toLowerCase()}) ! Cliquez pour lancer le combat.`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_to_play").setLabel("Jouer mon match").setEmoji("⚔️").setStyle(ButtonStyle.Danger))] }))
        .catch(() => null);
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    m.ready = {};
    const [ua, ub] = await Promise.all([client.users.fetch(m.a), client.users.fetch(m.b)]);
    const b = await startBattle(client, { user: ua, name: pseudo(m.a) }, { user: ub, name: pseudo(m.b) }, {});
    if (!b) {
      await interaction.editReply({ content: "❌ Impossible de lancer le combat. Réessayez dans un instant." });
      return true;
    }
    b.tournament = { key: t.key, r, k };
    m.battle = b.id;
    save();
    tourDirty = true;
    await interaction.editReply({ content: `⚔️ **Votre match du tournoi commence !** ${b.message?.url ?? ""}` });
    client.users.fetch(foe).then((u) => u.send(`⚔️ Votre match du tournoi contre **${pseudo(userId)}** commence : ${b.message?.url ?? chan("arene")}`)).catch(() => null);
    return true;
  }
  return false;
}
{
  // les combats de tournoi rapportent leur résultat au tableau
  const finish = finishBattle, cancel = cancelBattle;
  finishBattle = async (client, b, winner, reason) => {
    const already = b.phase === "over";
    await finish(client, b, winner, reason);
    if (!already && b.tournament) await tourBattleOver(client, b, winner).catch((err) => console.error("Tournoi:", err.message));
  };
  cancelBattle = async (b, why) => {
    if (b.tournament && b.phase !== "over") {
      const m = tourState()?.rounds?.[b.tournament.r]?.[b.tournament.k];
      if (m) m.battle = null;
      tourDirty = true;
    }
    return cancel(b, why);
  };
  // succès du tournoi
  const facts = playerFacts;
  playerFacts = (userId) => ({ ...facts(userId), tourneyWins: load().userStats[userId]?.tourneyWins ?? 0 });
  ACHIEVEMENTS.push(["tournoi1", "🏆", "Champion du week-end", "Remporter un tournoi du week-end", "tourneyWins", 1, 300]);
}
async function tournamentLoop(client) {
  await tournamentTick(client).catch((err) => console.error("Tournoi:", err.message));
  if (tourDirty || new Date().getMinutes() % 10 === 4) await refreshTournament().catch(() => null);
}
