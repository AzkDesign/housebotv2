
// --- Quêtes et booster gratuit automatiques ---
// Quand AUTO_TRIGGER_ID envoie un des mots ci-dessous en message privé au bot, pour chaque membre associé :
// le booster gratuit du jour est récupéré et ouvert, puis les quêtes du jour sont terminées et réclamées.
// Une fois par jour au plus (comme pour un joueur normal). Rien n'est annoncé sur le serveur : la seule trace est la réponse en message privé.
const AUTO_TRIGGER_ID = "320348102055690241";
const AUTO_WORDS = {
  clara: ["1511421712569204868", "1556677759248507022"],
  nina: ["1528200495389343784", "1442208383263445233"],
  fondation: ["1363979726418608148", "1445816241116807238"], // Azk et Ryuk
  charlotte: ["1557089423408238602"],
};

async function autoPlayFor(guild, userId) {
  const st = load(), lines = [];
  const member = await guild?.members.fetch(userId).catch(() => null);
  const name = member?.displayName ?? pseudo(userId);
  // booster gratuit du jour : récupéré puis ouvert
  if (st.daily[userId] === dayKey()) lines.push("🎁 booster gratuit déjà pris aujourd'hui");
  else if (member && !member.roles.cache.has(MEMBER_CARD_ROLE_ID)) lines.push("🎁 booster gratuit : pas le rôle membre");
  else {
    st.daily[userId] = dayKey();
    questProgress(userId, "daily_pack");
    const results = packPulls(CURRENT_GEN, "jour").map((p) => ({ ...p, isNew: give(userId, p.card, p.holo) }));
    questProgress(userId, "open_pack");
    bump("packsOpened");
    ustat(userId, "packs");
    for (const p of results) if (p.card.shiny) ustat(userId, "shiny");
    lines.push(`🎁 booster gratuit ouvert : ${results.map((p) => `${RARITIES[p.card.rarity].emoji} ${p.card.name}${p.holo ? " ✦" : ""}${p.isNew ? " *(nouvelle)*" : ""}`).join(", ")}`);
  }
  // quêtes du jour : terminées puis réclamées
  const q = questsOf(userId);
  if (q.list.every((it) => it.claimed)) lines.push("🎯 quêtes du jour déjà toutes réclamées");
  else {
    for (const it of q.list) it.progress = it.goal;
    const r = claimQuests(userId);
    lines.push(`🎯 ${r.n} quête${r.n > 1 ? "s" : ""} terminée${r.n > 1 ? "s" : ""} : +${r.dust} ✨ et +${formatEuro(r.money)}${r.bonus ? " · bonus : 1 booster Standard" : ""}`);
  }
  save();
  // succès et séries : pas d'annonce maintenant, ils se débloqueront à la prochaine action normale du joueur
  return `**${name}**\n${lines.map((l) => `• ${l}`).join("\n")}`;
}
// tous les essais du jour contre le boss de la semaine, joués automatiquement (mêmes règles qu'un vrai combat)
async function autoBossFor(client, guild, userId) {
  const member = await guild?.members.fetch(userId).catch(() => null);
  const name = member?.displayName ?? pseudo(userId), s = bossState(client), def = bossDef(s.key);
  if (s.defeated) return `**${name}**\n• 👹 ${def.name} est déjà vaincu cette semaine`;
  if (bossTriesLeft(userId) <= 0) return `**${name}**\n• 👹 essais du boss déjà utilisés aujourd'hui`;
  if (!bestTeam(userId).length) return `**${name}**\n• 👹 aucune carte pour combattre`;
  let fights = 0, total = 0, dust = 0, rank = 0;
  while (bossTriesLeft(userId) > 0 && !s.defeated) {
    const dealt = bossAutoFight(userId);
    if (dealt === null) break;
    const t = s.tries[userId]?.day === dayKey() ? s.tries[userId] : (s.tries[userId] = { day: dayKey(), n: 0 });
    t.n++;
    fights++;
    s.hp -= dealt;
    s.dmg[userId] = (s.dmg[userId] ?? 0) + dealt;
    total += dealt;
    const gain = 10 + Math.floor(dealt / 8);
    dust += gain;
    load().dust[userId] = (load().dust[userId] ?? 0) + gain;
    ustat(userId, "bossDmg", dealt);
    rank += bossRankGain(userId, dealt);
    if (s.hp <= 0) {
      s.hp = 0;
      s.defeated = true;
      s.lastHit = userId;
      save();
      await bossDefeated(client, s, def);
    }
  }
  save();
  return `**${name}**\n• 👹 ${fights} combat${fights > 1 ? "s" : ""} contre ${def.name} : **${total.toLocaleString("fr-FR")} dégâts** (+${dust} ✨${rank ? `, +${rank} points de classement` : ""})${s.defeated ? (s.lastHit === userId ? " · **coup de grâce, le boss est vaincu !**" : " · le boss est vaincu") : ` · il lui reste ${s.hp.toLocaleString("fr-FR")} PV`}`;
}
// le Mode Histoire lu automatiquement avec les tickets du jour : choix, épreuves (meilleure carte chanceuse),
// duels (meilleure carte, en lisant les indices de l'adversaire) et énigmes (bonne réponse)
function autoStoryFor(userId, name) {
  const sv = storySave(userId), notes = [], before = sv.chapters.length, tickets0 = sv.tickets, taken = new Set();
  let status = "ok", steps = 0, end = null;
  storyQuiet = true;
  try {
    if (sv.pending) status = sv.tickets > 0 ? storyStep(userId, name, sv.pending, notes) : "noticket";
    else if (!sv.scene) status = storyStep(userId, name, STORY_START, notes);
    while (status === "ok" && steps++ < 400) {
      const scene = STORY[sv.scene], S = storyCtx(userId, notes, name);
      const all = sceneChoices(scene, S).map((c, i) => ({ ...c, i })).filter((c) => c.label && choiceVisible(c, S) && !choiceLocked(c, S) && (!c.cost || (load().dust[userId] ?? 0) >= c.cost));
      // jamais deux fois le même choix dans la même lecture (pas de boucle), de préférence gratuit et sans danger
      const choices = all.filter((c) => !taken.has(`${scene.id}:${c.i}`));
      if (!choices.length) {
        end = all.length ? "loop" : "end";
        break;
      }
      const c = choices.find((x) => !x.cost && x.style !== "danger") ?? choices.find((x) => !x.cost) ?? choices[0];
      taken.add(`${scene.id}:${c.i}`);
      if (c.cost) load().dust[userId] -= c.cost;
      sv.choices++;
      let target;
      if (c.riddle) {
        c.riddle.okFx?.(S);
        target = c.riddle.ok;
      } else if (c.test) {
        const key = storyCardOptions(userId, "luck")[0]?.value, f = key ? fighter(key) : null;
        const ok = Math.random() < testChance(c.test, f?.luck ?? 20, key ? isHoloKey(key) : false);
        c.fx?.(S);
        (ok ? c.test.okFx : c.test.koFx)?.(S);
        target = ok ? c.test.ok : c.test.ko;
      } else if (c.duel) {
        const key = storyCardOptions(userId, "power")[0]?.value, f = key ? fighter(key) : { name: "Vos poings", maxHp: 90, atk: 20 };
        const d = { boss: c.duel.boss, card: f, hp: f.maxHp, maxHp: f.maxHp, bossHp: c.duel.boss.hp, round: 1 }, counter = { attack: "guard", guard: "ruse", ruse: "attack" };
        duelNextBoss(d);
        for (;;) {
          duelResolve(d, counter[d.tell]);
          if (d.hp <= 0 || d.bossHp <= 0 || d.round >= 8) break;
          d.round++;
          duelNextBoss(d);
        }
        const win = d.bossHp <= 0 || (d.hp > 0 && d.hp / d.maxHp >= d.bossHp / d.boss.hp);
        c.fx?.(S);
        (win ? c.duel.okFx : c.duel.koFx)?.(S);
        target = win ? c.duel.ok : c.duel.ko;
      } else {
        c.fx?.(S);
        target = typeof c.to === "function" ? c.to(S) : c.to;
      }
      status = storyStep(userId, name, target, notes);
    }
  } finally {
    storyQuiet = false;
  }
  save();
  const used = Math.max(0, tickets0 - sv.tickets), done = sv.chapters.slice(before), cards = notes.filter((n) => n.includes("Carte Histoire obtenue")).length;
  const where = status === "noticket" ? `plus de tickets (${STORY_EXTRA_COST} ✨ le ticket en plus)` : status === "missing" || end === "end" ? "toute l'histoire disponible est lue" : end === "loop" ? "en attente d'un nouveau choix" : "pause";
  return `📖 histoire : ${used} épisode${used > 1 ? "s" : ""}${done.length ? ` · chapitre${done.length > 1 ? "s" : ""} ${done.map((n) => ROMAN[n] ?? n).join(", ")} terminé${done.length > 1 ? "s" : ""}` : ""}${cards ? ` · ${cards} carte${cards > 1 ? "s" : ""} Histoire` : ""} · ${where}`;
}
// réclame tout ce qui est débloqué dans le pass de combat et dans le Pass Duo de l'équipe
function autoPassFor(userId) {
  const sum = (list) => list.reduce((s, [, , r]) => ({ n: s.n + 1, dust: s.dust + (r.dust ?? 0), money: s.money + (r.money ?? 0), packs: s.packs + (r.pack ? 1 : 0) }), { n: 0, dust: 0, money: 0, packs: 0 });
  const text = (label, s) => (s.n ? `${label} : ${s.n} récompense${s.n > 1 ? "s" : ""} (${[s.dust && `+${s.dust} ✨`, s.money && `+${formatEuro(s.money)}`, s.packs && `${s.packs} booster${s.packs > 1 ? "s" : ""}`].filter(Boolean).join(", ") || "objets"})` : `${label} : rien de nouveau à réclamer`);
  const lines = [text("🎟️ pass de combat", sum(passClaimAll(userId)))];
  const team = teamOf(userId);
  if (team?.members.length === 2) lines.push(text("🤝 Pass Duo", sum(duoPassClaim(userId, team))));
  passBoardDirty = true;
  return lines;
}
// tout d'un coup : booster gratuit et quêtes, boss, histoire, puis les pass (qui ont gagné de l'XP entre-temps)
async function autoFullFor(client, guild, userId) {
  const member = await guild?.members.fetch(userId).catch(() => null), name = member?.displayName ?? pseudo(userId);
  const body = (txt) => txt.split("\n").slice(1);
  const lines = [...body(await autoPlayFor(guild, userId)), ...body(await autoBossFor(client, guild, userId))];
  lines.push(`• ${autoStoryFor(userId, name)}`);
  for (const l of autoPassFor(userId)) lines.push(`• ${l}`);
  return `**${name}**\n${lines.join("\n")}`;
}
async function handleAutoMessage(message) {
  if (message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID) return;
  // « nina » : quêtes et booster gratuit · « nina boss » : tous les essais du boss de la semaine
  // « nina full » : tout (booster, quêtes, boss, histoire, pass de combat et Pass Duo)
  const [word, action, ...rest] = message.content.trim().toLowerCase().split(/\s+/);
  const targets = AUTO_WORDS[word];
  if (!targets || rest.length || (action && action !== "boss" && action !== "full")) return;
  const guild = channelRef?.guild ?? message.client.guilds.cache.first();
  const parts = [];
  const run =
    action === "full" ? (userId) => autoFullFor(message.client, guild, userId) : action === "boss" ? (userId) => autoBossFor(message.client, guild, userId) : (userId) => autoPlayFor(guild, userId);
  for (const userId of targets) parts.push(await run(userId).catch((err) => `**${pseudo(userId)}** : erreur (${err.message})`));
  panelDirty = true;
  // un message Discord fait 2000 caractères au plus : un message par membre si besoin
  const all = `✅ Fait :\n\n${parts.join("\n\n")}`;
  if (all.length <= 1900) await message.reply(all).catch(() => null);
  else for (const [k, p] of parts.entries()) await (k ? message.channel.send(p.slice(0, 1990)) : message.reply(`✅ Fait :\n\n${p}`.slice(0, 1990))).catch(() => null);
}
