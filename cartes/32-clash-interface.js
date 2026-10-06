
// --- Clash de la Maison : interface, attaques, guerre des équipes, salon ---
const clashTargets = new Map(); // userId -> adversaire proposé
let clashDirty = true;

function clashBaseOf(userId) {
  const b = clashState()[userId];
  if (b) {
    const done = clashTick(b);
    if (done.length) {
      clashDirty = true;
      save();
    }
  }
  return b ?? null;
}
const clashUserOf = (interaction) => ({ id: interaction.user.id, name: interaction.member?.displayName ?? interaction.user.username, avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }) });
function clashArmy(base, userId) {
  // l'armée garde les cartes encore possédées, dans la limite des places de la caserne
  return (base.army ?? []).filter((k) => (load().inv[userId]?.[k] ?? 0) > 0).slice(0, armySlots(base));
}
function clashArmyOptions(userId, base) {
  const seen = new Set();
  return ownedKeys(userId)
    .map(([k]) => k)
    .sort((a, b) => fighterPower(b) - fighterPower(a))
    .filter((k) => {
      const id = k.replace("*", "");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 25)
    .map((k) => {
      const t = makeTroop(k), role = TROOP_ROLES[t.role];
      return { label: keyLabel(k).slice(0, 100), value: k, emoji: role.emoji, description: `${role.name} · ${Math.round(t.maxHp)} PV · ${Math.round(t.dps)} dégâts/s`.slice(0, 100), default: (base.army ?? []).includes(k) };
    });
}
// --- Objectifs guidés : ils montrent quoi faire, étape par étape ---
const CLASH_GOALS = [
  { text: "Récoltez votre mine et votre distillerie", done: (b) => (b.stats.collects ?? 0) >= 1, reward: { or: 250 } },
  { text: "Préparez une armée d'au moins 3 cartes", done: (b) => (b.army?.length ?? 0) >= 3, reward: { essence: 250 } },
  { text: "Attaquez une Maison", done: (b) => b.stats.attacks >= 1, reward: { or: 400 } },
  { text: "Améliorez le Manoir au niveau 2", done: (b) => manoirOf(b) >= 2, reward: { essence: 500 } },
  { text: "Améliorez une défense au niveau 2", done: (b) => b.buildings.some((x) => CLASH_BUILDINGS[x.type].kind === "defense" && x.level >= 2), reward: { or: 700 } },
  { text: "Gagnez 6 étoiles en attaque", done: (b) => b.stats.stars >= 6, reward: { dust: 150 } },
  { text: "Améliorez un coffre-fort au niveau 2", done: (b) => b.buildings.some((x) => x.type === "coffre" && x.level >= 2), reward: { or: 600, essence: 600 } },
  { text: "Améliorez le Manoir au niveau 3", done: (b) => manoirOf(b) >= 3, reward: { pack: "premium" } },
  { text: "Atteignez 200 trophées", done: (b) => b.trophies >= 200, reward: { dust: 300 } },
  { text: "Améliorez le Manoir au niveau 4", done: (b) => manoirOf(b) >= 4, reward: { pack: "prestige" } },
];
const goalReward = (r) =>
  [r.or && `${r.or.toLocaleString("fr-FR")} or`, r.essence && `${r.essence.toLocaleString("fr-FR")} essence`, r.dust && `${r.dust} poussières d'étoile`, r.pack && `1 booster ${PACKS[r.pack].name}`].filter(Boolean).join(" et ");
const currentGoal = (base) => CLASH_GOALS[base.goal ?? 0] ?? null;
function autoArmy(userId, base) {
  const seen = new Set();
  base.army = ownedKeys(userId)
    .map(([k]) => k)
    .sort((a, b) => fighterPower(b) - fighterPower(a))
    .filter((k) => {
      const id = k.replace("*", "");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, armySlots(base));
  return base.army;
}
async function clashHomePayload(userId, note = "") {
  const base = clashBaseOf(userId);
  if (!base)
    return {
      ephemeral: true,
      content: null,
      embeds: [
        new EmbedBuilder()
          .setColor(0x65a30d)
          .setTitle("Fondez votre Maison")
          .setDescription(
            "Bâtissez votre propre Maison sur une île flottante, faites-la grandir… et partez piller celles des autres.\n\n" +
              "**1.** Vos mines et distilleries produisent de l'**or** et de l'**essence** : venez les **récolter**.\n" +
              "**2.** Dépensez-les pour **construire et améliorer** vos bâtiments.\n" +
              "**3.** Vos **cartes deviennent vos soldats** : attaquez d'autres Maisons pour gagner du butin et des trophées.\n\n" +
              "Des **objectifs** vous guident pas à pas, et le week-end, la **guerre des équipes** oppose les duos."
          ),
      ],
      files: [],
      attachments: [],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_cl_found").setLabel("Fonder ma Maison").setEmoji("🏰").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("carte_cl_rules").setLabel("Comment jouer").setEmoji("📖").setStyle(ButtonStyle.Secondary))],
    };
  const img = new AttachmentBuilder(await (await drawClashBase(base)).encode("jpeg", 86), { name: "maison.jpg" });
  const opts = clashOptions(base), army = clashArmy(base, userId), buffers = clashBuffers(base), goal = currentGoal(base);
  const soonest = base.buildings.filter((x) => x.upgrading).sort((a, b) => a.upgrading.done - b.upgrading.done)[0];
  const speedCost = soonest ? Math.max(1, Math.ceil((soonest.upgrading.done - Date.now()) / MINUTE)) * CLASH_SPEEDUP_DUST : 0;
  const day = dayKey(), attacksLeft = CLASH_ATTACKS_PER_DAY - (base.attacks.day === day ? base.attacks.n : 0);
  const goalDone = goal && goal.done(base);
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("carte_cl_collect")
        .setLabel(buffers.or + buffers.essence > 0 ? `Récolter (${buffers.or.toLocaleString("fr-FR")} or · ${buffers.essence.toLocaleString("fr-FR")} essence)` : "Rien à récolter")
        .setEmoji("🧺")
        .setStyle(ButtonStyle.Success)
        .setDisabled(buffers.or + buffers.essence <= 0),
      new ButtonBuilder().setCustomId("carte_cl_find").setLabel("Attaquer").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(!army.length || attacksLeft <= 0),
      ...(goalDone ? [new ButtonBuilder().setCustomId("carte_cl_goal").setLabel("Réclamer l'objectif").setEmoji("🎁").setStyle(ButtonStyle.Primary)] : [])
    ),
  ];
  if (opts.length)
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_cl_build")
          .setPlaceholder(busyBuilders(base) >= CLASH_BUILDERS ? "Vos deux ouvriers sont occupés…" : "Construire ou améliorer un bâtiment…")
          .setDisabled(busyBuilders(base) >= CLASH_BUILDERS)
          .addOptions(
            opts.slice(0, 25).map((o) => ({
              label: `${o.kind === "new" ? "Construire" : "Améliorer"} : ${CLASH_BUILDINGS[o.type].name}${o.kind === "up" ? ` (niveau ${o.to})` : ""}`.slice(0, 100),
              value: o.kind === "new" ? `new:${o.type}` : `up:${o.id}`,
              emoji: CLASH_BUILDINGS[o.type].emoji,
              description: `${costText(o.cost)} · ${minutesText(o.time)}${clashCanPay(base, o.cost) ? "" : " · pas assez de ressources"}`.slice(0, 100),
            }))
          )
      )
    );
  const armyOpts = clashArmyOptions(userId, base);
  if (armyOpts.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_cl_army").setPlaceholder(`Choisir mes soldats (${armySlots(base)} places)…`).setMinValues(1).setMaxValues(Math.min(armySlots(base), armyOpts.length)).addOptions(armyOpts)));
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_cl_auto").setLabel("Armée automatique").setEmoji("🎖️").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("carte_cl_speed").setLabel(soonest ? `Finir le chantier (${speedCost} ✨)` : "Finir un chantier").setEmoji("⏩").setStyle(ButtonStyle.Secondary).setDisabled(!soonest || (load().dust[userId] ?? 0) < speedCost),
      new ButtonBuilder().setCustomId("carte_cl_log").setLabel("Journal").setEmoji("📜").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("carte_cl").setLabel("Actualiser").setEmoji("🔄").setStyle(ButtonStyle.Secondary)
    )
  );
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x65a30d)
        .setTitle(`${base.name} — Manoir niveau ${manoirOf(base)}`)
        .setDescription(
          (note ? `${note}\n\n` : "") +
            (goal ? `**Objectif ${(base.goal ?? 0) + 1}/${CLASH_GOALS.length}** — ${goal.text}${goalDone ? " ✅" : ""}\n*Récompense : ${goalReward(goal.reward)}*\n\n` : "") +
            `**Armée** — ${army.length ? army.map((k) => `${keyLabel(k)} *(${TROOP_ROLES[troopRole(cardOfKey(k))].name})*`).join(", ") : "aucune : touchez « Armée automatique »"} · ${army.length}/${armySlots(base)} places\n` +
            `**Attaques** — ${attacksLeft} restante${attacksLeft > 1 ? "s" : ""} aujourd'hui · une attaque coûte ${CLASH_TROOP_COST} essence par soldat${base.shield > Date.now() ? `\n**Bouclier** — protégé jusqu'à <t:${Math.floor(base.shield / 1000)}:t>` : ""}`
        )
        .setImage("attachment://maison.jpg")
        .setFooter({ text: "Récoltez souvent : ce qui reste dans les mines est la cible préférée des pillards." }),
    ],
    files: [img],
    attachments: [],
    components: rows,
  };
}
const CLASH_RULES = () =>
  new EmbedBuilder()
    .setColor(0x65a30d)
    .setTitle("Comment jouer au Clash de la Maison")
    .setDescription(
      "**1. Récolter** — Les mines (or) et distilleries (essence) se remplissent en 8 heures, puis s'arrêtent. Revenez récolter : la récolte va dans vos coffres, dans la limite de leur place.\n\n" +
        "**2. Construire** — Deux ouvriers améliorent vos bâtiments. Le **Manoir** fixe le niveau maximum des autres et débloque de nouveaux bâtiments. Un chantier peut être fini tout de suite avec de la poussière d'étoile.\n\n" +
        "**3. Attaquer** — Vos **cartes sont vos soldats** (la caserne fixe le nombre de places) :\n" +
        Object.values(TROOP_ROLES).map((r) => `• **${r.name}** — ${r.desc}`).join("\n") +
        "\nLes cartes rares et holos font de meilleurs soldats. Une attaque dure 60 secondes.\n\n" +
        "**Étoiles** — 50 % de destruction, Manoir détruit, 100 % : jusqu'à 3 étoiles.\n" +
        "**Butin** — la moitié de ce qui attend dans les mines détruites, plus une petite part des coffres.\n" +
        "**Défense** — vous pouvez être attaqué à tout moment ; après une défaite, un bouclier vous protège quelques heures.\n\n" +
        "**Guerre des équipes** — du vendredi 18 h au dimanche 22 h, chaque duo affronte un autre duo : 2 attaques par membre, l'équipe qui fait le plus d'étoiles gagne."
    );

// --- Recherche d'un adversaire ---
function clashFindTarget(userId) {
  const me = clashState()[userId], partner = partnerOf(userId), now = Date.now();
  const pool = Object.values(clashState()).filter((b) => b.owner !== userId && b.owner !== partner && !(b.shield > now));
  const near = pool.filter((b) => Math.abs(b.trophies - me.trophies) <= 300);
  const list = (near.length ? near : pool).filter((b) => b.owner !== clashTargets.get(userId)?.owner);
  if (list.length && Math.random() < 0.85) {
    const b = list[Math.floor(Math.random() * list.length)];
    clashTick(b);
    return { owner: b.owner, ghost: false };
  }
  return { owner: `ghost:${Math.floor(Math.random() * 1e6)}`, ghost: true, seed: Math.floor(Math.random() * 1e6), manoir: manoirOf(me) };
}
const targetBase = (t) => (t.ghost ? ghostBase(t.manoir, t.seed) : clashState()[t.owner]);
function lootOf(target, pct, dead = null) {
  const share = 0.15 * (pct / 100), out = { or: Math.floor((target.res.or ?? 0) * share), essence: Math.floor((target.res.essence ?? 0) * share) };
  for (const x of target.buildings) {
    const res = CLASH_BUILDINGS[x.type].res;
    if (!res || !x.stock || (dead && !dead.has(x.id))) continue;
    out[res] += Math.floor(x.stock * 0.5);
  }
  return out;
}
async function clashTargetPayload(userId) {
  const t = clashTargets.get(userId), base = targetBase(t), me = clashState()[userId];
  const img = new AttachmentBuilder(await (await drawClashBase(base, { ranges: true })).encode("jpeg", 84), { name: "cible.jpg" });
  const army = clashArmy(me, userId), cost = army.length * CLASH_TROOP_COST, maxLoot = lootOf(base, 100);
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xb91c1c)
        .setTitle(`⚔️ Cible : ${base.name}${base.ghost ? " 👻" : ""}`)
        .setDescription(
          `Manoir niveau **${manoirOf(base)}** · ${base.ghost ? "Maison fantôme gardée par l'IA" : `🏆 ${base.trophies} trophées`}\n` +
            `**Butin possible** — ${maxLoot.or.toLocaleString("fr-FR")} or · ${maxLoot.essence.toLocaleString("fr-FR")} essence (à 100 % de destruction)\n` +
            `⚔️ Votre armée : ${army.map((k) => keyLabel(k)).join(", ")}\n` +
            `**Coût** — ${cost} essence (vous en avez ${Math.floor(me.res.essence).toLocaleString("fr-FR")})\n\n*Les zones en pointillés montrent la portée des défenses.*`
        )
        .setImage("attachment://cible.jpg"),
    ],
    files: [img],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_cl_go").setLabel("Lancer l'attaque").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(me.res.essence < cost),
        new ButtonBuilder().setCustomId("carte_cl_next").setLabel("Cible suivante (50 or)").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(me.res.or < 50),
        new ButtonBuilder().setCustomId("carte_cl").setLabel("Retour à ma Maison").setEmoji("🏰").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
const pushLog = (base, line) => {
  base.log = [{ at: Date.now(), line }, ...(base.log ?? [])].slice(0, 15);
};
async function clashNotice(text) {
  const msg = await chan("clash")?.send({ content: text, allowedMentions: { parse: [] } }).catch(() => null);
  deleteLater(msg, MINUTE);
}
// une attaque : simulation, butin, trophées, bouclier, journaux
// une seule attaque à la fois par joueur
const clashBusy = new Set();
// raison du refus, ou null si l'attaque est permise (vérifié juste avant de lancer, sans attente)
function clashCanAttack(userId) {
  const me = clashState()[userId];
  if (!me) return "Fondez d'abord votre Maison.";
  if (clashBusy.has(userId)) return "⏳ Une attaque est déjà en cours.";
  const army = clashArmy(me, userId);
  if (!army.length) return "⚔️ Choisissez d'abord votre armée.";
  if (me.attacks.day === dayKey() && me.attacks.n >= CLASH_ATTACKS_PER_DAY) return `⏳ Vous avez déjà mené ${CLASH_ATTACKS_PER_DAY} attaques aujourd'hui. Revenez demain !`;
  if (me.res.essence < army.length * CLASH_TROOP_COST) return `❌ Il faut ${army.length * CLASH_TROOP_COST} essence pour lancer cette attaque.`;
  return null;
}
async function clashAttack(client, userId, t, war = null) {
  const me = clashState()[userId], target = targetBase(t);
  const army = clashArmy(me, userId), cost = army.length * CLASH_TROOP_COST;
  me.res.essence -= cost;
  me.shield = 0;
  if (me.attacks.day !== dayKey()) me.attacks = { day: dayKey(), n: 0 };
  me.attacks.n++;
  const sim = clashSimulate(target, army);
  const dead = new Set(sim.blds.filter((x) => x.dead).map((x) => x.id));
  const loot = war ? { or: 150 * manoirOf(target) * sim.stars, essence: 150 * manoirOf(target) * sim.stars } : lootOf(target, sim.pct, dead);
  const room = clashCap(me);
  loot.or = Math.min(loot.or, Math.max(0, room - me.res.or));
  loot.essence = Math.min(loot.essence, Math.max(0, room - me.res.essence));
  me.res.or += loot.or;
  me.res.essence += loot.essence;
  let trophies = 0;
  if (!war) {
    trophies = sim.stars ? 8 + 6 * sim.stars : -10;
    me.trophies = Math.max(0, me.trophies + trophies);
  }
  me.stats.attacks++;
  me.stats.stars += sim.stars;
  if (sim.stars) me.stats.wins++;
  me.stats.loot += loot.or + loot.essence;
  if (!target.ghost && !war) {
    const fromStore = lootOf({ res: target.res, buildings: [] }, sim.pct);
    target.res.or = Math.max(0, target.res.or - Math.min(loot.or, fromStore.or));
    target.res.essence = Math.max(0, target.res.essence - Math.min(loot.essence, fromStore.essence));
    for (const x of target.buildings) if (CLASH_BUILDINGS[x.type].res && dead.has(x.id) && x.stock) x.stock = Math.floor(x.stock * 0.5);
    const lost = sim.stars ? 4 * sim.stars : -5;
    target.trophies = Math.max(0, target.trophies - lost);
    if (sim.stars) target.shield = Date.now() + sim.stars * 4 * 3600000;
    target.stats.defenses++;
    if (!sim.stars) target.stats.defWins++;
    pushLog(target, `🛡️ ${me.name} vous attaque : ${sim.pct} %, ${"⭐".repeat(sim.stars) || "0 étoile"} · −${loot.or} or −${loot.essence} essence · ${lost > 0 ? `−${lost}` : `+${-lost}`} 🏆`);
    client?.users
      .fetch(target.owner)
      .then((u) => u.send(`🏰 **${me.name}** a attaqué votre Maison : **${sim.pct} %** de destruction, ${"⭐".repeat(sim.stars) || "aucune étoile"}.${sim.stars ? ` Butin perdu : ${loot.or} or et ${loot.essence} essence. Un bouclier vous protège ${sim.stars * 4} h.` : " Votre défense a tenu bon !"}`))
      .catch(() => null);
  }
  pushLog(me, `⚔️ Attaque${war ? " de guerre" : ""} sur ${target.name} : ${sim.pct} %, ${"⭐".repeat(sim.stars) || "0 étoile"} · +${loot.or} or +${loot.essence} essence${trophies ? ` · ${trophies > 0 ? "+" : ""}${trophies} 🏆` : ""}`);
  clashDirty = true;
  save();
  const gif = await clashBattleGif(target, sim, me.name, { loot, trophies, war: !!war });
  if (sim.stars === 3) setTimeout(() => clashNotice(`💥 **${me.name}** rase entièrement ${target.ghost ? "une Maison fantôme" : `la Maison de **${target.name}**`} : ⭐⭐⭐ !`).catch(() => null), gif?.duration ?? 0);
  if (sim.stars) ustat(userId, "clashStars", sim.stars);
  clashDirty = true;
  save();
  checkAchievements(userId).catch(() => null);
  return { sim, loot, trophies, gif, target };
}
function clashLivePayload(r, war) {
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`⚔️ Assaut en cours sur ${r.target.name}`)
        .setDescription(war ? "Attaque de guerre lancée… regardez la bataille !" : "Vos soldats sont lancés… regardez la bataille !")
        .setImage("attachment://combat.gif"),
    ],
    files: [new AttachmentBuilder(r.gif, { name: "combat.gif" })],
    attachments: [],
    components: [],
  };
}
// montre la cinématique, puis remplace par le résultat une fois qu'elle est finie
async function clashPlayBattle(send, r, war) {
  // si la cinématique ne passe pas (envoi refusé), on montre directement le bilan
  const shown = await send(clashLivePayload(r, war)).then(() => true).catch((e) => (console.error("[clash] cinématique non envoyée :", e?.message ?? e, `(${Math.round(r.gif.length / 1024)} Ko)`), false));
  if (shown) await new Promise((ok) => setTimeout(ok, r.gif.duration ?? 0));
  await send(clashResultPayload(r, war)).catch((e) => console.error("[clash] bilan non envoyé :", e?.message ?? e));
}
function clashResultPayload(r, war) {
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(r.sim.stars ? 0x16a34a : 0xb91c1c)
        .setTitle(`${r.sim.stars ? "🏆 Victoire" : "💀 Défaite"} — ${r.sim.pct} % · ${"⭐".repeat(r.sim.stars) || "aucune étoile"}`)
        .setDescription(`**Butin** — ${r.loot.or.toLocaleString("fr-FR")} or · ${r.loot.essence.toLocaleString("fr-FR")} essence${war ? "\n🏆 Attaque de guerre : vos étoiles comptent pour votre équipe !" : `\nTrophées : **${r.trophies > 0 ? "+" : ""}${r.trophies}** 🏆`}`)
        .setImage(r.gif.poster ? "attachment://bilan.jpg" : "attachment://combat.gif"),
    ],
    files: [r.gif.poster ? new AttachmentBuilder(r.gif.poster, { name: "bilan.jpg" }) : new AttachmentBuilder(r.gif, { name: "combat.gif" })],
    attachments: [],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_cl_find").setLabel("Nouvelle attaque").setEmoji("⚔️").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId("carte_cl").setLabel("Ma Maison").setEmoji("🏰").setStyle(ButtonStyle.Secondary))],
  };
}

// --- Guerre des équipes (du vendredi 18 h au dimanche 22 h) ---
function parisClock() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[p.weekday], hour: Number(p.hour) };
}
function warWindow() {
  const { day, hour } = parisClock();
  return (day === 4 && hour >= 18) || day === 5 || (day === 6 && hour < 22);
}
const WAR_ATTACKS = 2;
function warOf(teamId) {
  const w = load().clashMeta.war;
  return w && !w.done ? w.pairs.find((p) => p.a === teamId || p.b === teamId) ?? null : null;
}
async function clashWarTick(client) {
  const meta = load().clashMeta, now = Date.now();
  if (!meta.war && warWindow()) {
    const teams = Object.values(teamsState()).filter((t) => t.members.some((m) => clashState()[m]));
    const ranked = teams.map((t) => ({ t, score: t.members.reduce((a, m) => a + (clashState()[m]?.trophies ?? 0), 0) })).sort((a, b) => b.score - a.score);
    const pairs = [];
    for (let k = 0; k + 1 < ranked.length; k += 2) pairs.push({ a: ranked[k].t.id, b: ranked[k + 1].t.id, attacks: {}, stars: { a: 0, b: 0 } });
    meta.war = { id: now.toString(36), start: now, end: now + 52 * 3600000, pairs, done: false };
    save();
    clashDirty = true;
    if (pairs.length)
      await chan("clash")
        ?.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0xdc2626)
              .setTitle("⚔️ La guerre des équipes commence !")
              .setDescription(`${pairs.map((p) => `${teamsState()[p.a].emblem} **${teamsState()[p.a].name}** contre ${teamsState()[p.b].emblem} **${teamsState()[p.b].name}**`).join("\n")}\n\nChaque membre a **${WAR_ATTACKS} attaques de guerre**. Fin <t:${Math.floor(meta.war.end / 1000)}:R>.`),
          ],
        })
        .catch(() => null);
  }
  if (meta.war && !meta.war.done && (!warWindow() || now >= meta.war.end)) {
    meta.war.done = true;
    const lines = [];
    for (const p of meta.war.pairs) {
      const A = teamsState()[p.a], B = teamsState()[p.b];
      if (!A || !B) continue;
      const winner = p.stars.a === p.stars.b ? null : p.stars.a > p.stars.b ? A : B;
      for (const t of [A, B]) {
        const won = winner === t, draw = !winner;
        for (const m of t.members) {
          const base = clashState()[m];
          if (base) {
            base.res.or = Math.min(clashCap(base), base.res.or + (won ? 3000 : draw ? 1500 : 800));
            base.res.essence = Math.min(clashCap(base), base.res.essence + (won ? 3000 : draw ? 1500 : 800));
          }
          load().dust[m] = (load().dust[m] ?? 0) + (won ? 300 : draw ? 150 : 80);
        }
        addTeamXp(t, won ? 250 : draw ? 120 : 60);
      }
      lines.push(`${A.emblem} **${A.name}** ${p.stars.a} ⭐ — ${p.stars.b} ⭐ **${B.name}** ${B.emblem} → ${winner ? `victoire de **${winner.name}** 🏆` : "match nul"}`);
    }
    meta.wars = [{ id: meta.war.id, end: now, lines }, ...(meta.wars ?? [])].slice(0, 5);
    const msg = lines.length ? await chan("clash")?.send({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle("🏁 Fin de la guerre des équipes").setDescription(`${lines.join("\n")}\n\nVainqueurs : 3 000 or, 3 000 essence et 300 poussières d'étoile chacun, plus 250 XP d'équipe. Perdants : 800 or, 800 essence et 80 poussières d'étoile.`)] }).catch(() => null) : null;
    void msg;
    meta.war = null;
    save();
    clashDirty = true;
  }
}
function warPayload(userId) {
  const team = teamOf(userId), w = load().clashMeta.war, pair = team ? warOf(team.id) : null;
  if (!pair) {
    const last = load().clashMeta.wars?.[0];
    return {
      ephemeral: true,
      content: null,
      embeds: [
        new EmbedBuilder()
          .setColor(0x991b1b)
          .setTitle("⚔️ Guerre des équipes")
          .setDescription(
            (w && !w.done ? "Votre équipe ne participe pas à la guerre en cours (il faut une équipe dont un membre au moins a fondé sa Maison)." : `Pas de guerre en cours. La prochaine commence **vendredi à 18 h** et se termine **dimanche à 22 h**.`) +
              (team ? "" : "\n\n🛡️ Rejoignez ou créez une équipe avec `/equipe` pour participer.") +
              (last ? `\n\n**Dernière guerre** :\n${last.lines.join("\n")}` : "")
          ),
      ],
      files: [],
      attachments: [],
      components: [],
    };
  }
  const side = pair.a === team.id ? "a" : "b", foeId = side === "a" ? pair.b : pair.a, foe = teamsState()[foeId];
  const used = (pair.attacks[userId] ?? []).length;
  const bestOn = (uid) => Math.max(0, ...Object.entries(pair.attacks).filter(([a]) => team.members.includes(a)).flatMap(([, list]) => list.filter((x) => x.target === uid).map((x) => x.stars)));
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xdc2626)
        .setTitle(`⚔️ ${team.emblem} ${team.name} contre ${foe.emblem} ${foe.name}`)
        .setDescription(`Score : **${pair.stars[side]} ⭐** contre **${pair.stars[side === "a" ? "b" : "a"]} ⭐** · fin <t:${Math.floor(w.end / 1000)}:R>\nVos attaques de guerre : **${WAR_ATTACKS - used} / ${WAR_ATTACKS}**\n\n*Seule la meilleure attaque de votre équipe sur chaque Maison compte.*`)
        .addFields({ name: "🏰 Maisons adverses", value: foe.members.map((m) => `${clashState()[m] ? "🏰" : "▫️"} **${pseudo(m)}** — ${clashState()[m] ? `Manoir ${manoirOf(clashState()[m])} · ${"⭐".repeat(bestOn(m)) || "aucune étoile"}` : "pas de Maison"}`).join("\n") }),
    ],
    files: [],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        foe.members
          .filter((m) => clashState()[m])
          .slice(0, 5)
          .map((m) => new ButtonBuilder().setCustomId(`carte_cl_wgo_${m}`).setLabel(`Attaquer ${pseudo(m)}`.slice(0, 80)).setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(used >= WAR_ATTACKS || !clashBaseOf(userId)))
          .concat(foe.members.some((m) => clashState()[m]) ? [] : [new ButtonBuilder().setCustomId("carte_cl").setLabel("Ma Maison").setStyle(ButtonStyle.Secondary)])
      ),
    ],
  };
}

// --- Salon : classement et état de la guerre ---
async function refreshClashBoard() {
  const ch = chan("clash");
  if (!ch || ch === channelRef) return;
  clashDirty = false;
  const st = load(), bases = Object.values(clashState()).sort((a, b) => b.trophies - a.trophies);
  const w = st.clashMeta.war;
  const embed = new EmbedBuilder()
    .setColor(0x65a30d)
    .setTitle("🏰 Clash de la Maison")
    .setDescription(
      "Bâtissez votre Maison, défendez-la, et attaquez celles des autres avec **vos cartes** comme troupes !\n" +
        "Or, essence, étoiles, trophées, boucliers… et la guerre des équipes chaque week-end.\n\n" +
        (w && !w.done
          ? `⚔️ **Guerre en cours** (fin <t:${Math.floor(w.end / 1000)}:R>) :\n${w.pairs.map((p) => `${teamsState()[p.a]?.emblem ?? ""} ${teamsState()[p.a]?.name ?? "?"} **${p.stars.a}** ⭐ — ⭐ **${p.stars.b}** ${teamsState()[p.b]?.name ?? "?"} ${teamsState()[p.b]?.emblem ?? ""}`).join("\n") || "*Aucun duel cette semaine.*"}`
          : "⚔️ Prochaine **guerre des équipes** : vendredi 18 h → dimanche 22 h.")
    )
    .addFields({ name: "🏆 Classement des trophées", value: bases.slice(0, 10).map((b, i) => `${["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`} **${b.name}** — ${b.trophies} 🏆 · Manoir ${manoirOf(b)}`).join("\n") || "*Aucune Maison pour le moment : fondez la première !*" })
    .setFooter({ text: `${bases.length} Maison${bases.length > 1 ? "s" : ""} fondée${bases.length > 1 ? "s" : ""}` });
  const payload = {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_cl").setLabel("Ma Maison").setEmoji("🏰").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_cl_war").setLabel("Guerre des équipes").setEmoji("⚔️").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("carte_cl_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
  let msg = st.clashBoardId ? await ch.messages.fetch(st.clashBoardId).catch(() => null) : null;
  if (msg && !(await msg.edit(payload).catch(() => null))) msg = null;
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.clashBoardId = msg.id;
      save();
    }
  }
}
async function clashLoop(client) {
  await clashWarTick(client).catch((err) => console.error("Guerre des équipes:", err.message));
  if (clashDirty || new Date().getMinutes() % 10 === 2) await refreshClashBoard().catch(() => null);
}
{
  // succès du Clash
  const facts = playerFacts;
  playerFacts = (userId) => ({ ...facts(userId), clashManoir: clashState()[userId] ? manoirOf(clashState()[userId]) : 0, clashStars: load().userStats[userId]?.clashStars ?? 0 });
  ACHIEVEMENTS.push(["clash1", "🏰", "Bâtisseur", "Améliorer son Manoir au niveau 3", "clashManoir", 3, 150], ["clash2", "⭐", "Pilleur étoilé", "Remporter 25 étoiles en attaque", "clashStars", 25, 250]);
}

// --- Interactions ---
async function handleClashInteraction(interaction, client) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "clash";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("carte_cl"))) return false;
  const userId = interaction.user.id;
  load();
  // les rendus d'images prennent un instant : on accuse réception tout de suite
  const fresh = isCmd || interaction.message?.flags?.has?.(64) === false || !interaction.message;
  const show = async (payload) => {
    const p = await payload;
    delete p.ephemeral;
    if (!interaction.deferred && !interaction.replied) {
      if (fresh) await interaction.deferReply({ ephemeral: true });
      else await interaction.deferUpdate();
    }
    await interaction.editReply(p);
  };
  if (isCmd || id === "carte_cl") {
    if (fresh) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    await show(clashHomePayload(userId));
    return true;
  }
  if (id === "carte_cl_rules") {
    await interaction.reply({ embeds: [CLASH_RULES()], ephemeral: true });
    return true;
  }
  if (id === "carte_cl_war") {
    await interaction.reply(warPayload(userId));
    return true;
  }
  if (id === "carte_cl_found") {
    if (!clashState()[userId]) {
      clashState()[userId] = newBase(clashUserOf(interaction));
      autoArmy(userId, clashState()[userId]);
      clashDirty = true;
      save();
    }
    await show(clashHomePayload(userId, "**Votre Maison est fondée !** Suivez les objectifs : ils vous guident pas à pas."));
    return true;
  }
  const base = clashBaseOf(userId);
  if (!base) {
    await show(clashHomePayload(userId));
    return true;
  }
  base.name = clashUserOf(interaction).name;
  if (id === "carte_cl_build") {
    const [kind, ref] = interaction.values[0].split(":");
    const opt = clashOptions(base).find((o) => (kind === "new" ? o.kind === "new" && o.type === ref : o.id === ref));
    const err = opt ? clashStart(base, opt) : "Ce chantier n'est plus possible.";
    save();
    clashDirty = true;
    if (!err) ustat(userId, "clashBuild");
    await show(clashHomePayload(userId, err ? `❌ ${err}` : `🔨 Chantier lancé : **${CLASH_BUILDINGS[opt.type].name}** ${opt.kind === "new" ? "en construction" : `→ niveau ${opt.to}`} (${minutesText(opt.time)}).`));
    return true;
  }
  if (id === "carte_cl_collect") {
    const got = clashCollect(base);
    base.stats.collects = (base.stats.collects ?? 0) + 1;
    save();
    clashDirty = true;
    const full = clashBuffers(base);
    await show(clashHomePayload(userId, got.or + got.essence ? `Récolte : **+${got.or.toLocaleString("fr-FR")} or** et **+${got.essence.toLocaleString("fr-FR")} essence**.${full.or + full.essence ? " Vos coffres sont pleins : améliorez-les pour stocker davantage." : ""}` : "Vos coffres sont pleins : améliorez un coffre-fort pour stocker davantage."));
    return true;
  }
  if (id === "carte_cl_auto") {
    autoArmy(userId, base);
    save();
    await show(clashHomePayload(userId, base.army.length ? `Armée prête : vos ${base.army.length} meilleures cartes.` : "Vous n'avez pas encore de cartes : ouvrez des boosters !"));
    return true;
  }
  if (id === "carte_cl_goal") {
    const goal = currentGoal(base);
    if (!goal || !goal.done(base)) {
      await show(clashHomePayload(userId));
      return true;
    }
    const rw = goal.reward;
    if (rw.or) base.res.or = Math.min(clashCap(base) + rw.or, base.res.or + rw.or);
    if (rw.essence) base.res.essence = Math.min(clashCap(base) + rw.essence, base.res.essence + rw.essence);
    if (rw.dust) load().dust[userId] = (load().dust[userId] ?? 0) + rw.dust;
    if (rw.pack) addPacks(userId, packKey(CURRENT_GEN, rw.pack), 1);
    base.goal = (base.goal ?? 0) + 1;
    save();
    await show(clashHomePayload(userId, `Objectif accompli ! Récompense : **${goalReward(rw)}**.`));
    return true;
  }
  if (id === "carte_cl_army") {
    base.army = interaction.values.slice(0, armySlots(base));
    save();
    await show(clashHomePayload(userId, `⚔️ Armée prête : ${base.army.map(keyLabel).join(", ")}.`));
    return true;
  }
  if (id === "carte_cl_speed") {
    const x = base.buildings.filter((y) => y.upgrading).sort((a, b) => a.upgrading.done - b.upgrading.done)[0];
    if (!x) {
      await show(clashHomePayload(userId));
      return true;
    }
    const cost = Math.max(1, Math.ceil((x.upgrading.done - Date.now()) / MINUTE)) * CLASH_SPEEDUP_DUST;
    if ((load().dust[userId] ?? 0) < cost) {
      await interaction.reply({ content: `❌ Il faut ${cost} ✨.`, ephemeral: true });
      return true;
    }
    load().dust[userId] -= cost;
    x.upgrading.done = Date.now();
    clashTick(base);
    save();
    clashDirty = true;
    checkAchievements(userId).catch(() => null);
    await show(clashHomePayload(userId, `⏩ Chantier terminé : **${CLASH_BUILDINGS[x.type].name}** niveau ${x.level} (−${cost} ✨).`));
    return true;
  }
  if (id === "carte_cl_log") {
    await interaction.reply({
      ephemeral: true,
      embeds: [
        new EmbedBuilder()
          .setColor(0x65a30d)
          .setTitle(`📜 Journal de ${base.name}`)
          .setDescription((base.log ?? []).map((l) => `<t:${Math.floor(l.at / 1000)}:R> ${l.line}`).join("\n").slice(0, 4000) || "*Rien pour le moment.*")
          .setFooter({ text: `Attaques : ${base.stats.attacks} (${base.stats.wins} victoires, ${base.stats.stars} ⭐) · Défenses : ${base.stats.defenses} (${base.stats.defWins} tenues)` }),
      ],
    });
    return true;
  }
  if (id === "carte_cl_find" || id === "carte_cl_next") {
    if (!clashArmy(base, userId).length) {
      await show(clashHomePayload(userId, "⚔️ Choisissez d'abord votre armée (vos cartes) dans la liste."));
      return true;
    }
    if (base.attacks.day === dayKey() && base.attacks.n >= CLASH_ATTACKS_PER_DAY) {
      await interaction.reply({ content: `⏳ Vous avez déjà mené ${CLASH_ATTACKS_PER_DAY} attaques aujourd'hui. Revenez demain !`, ephemeral: true });
      return true;
    }
    if (id === "carte_cl_next") {
      if (base.res.or < 50) {
        await interaction.reply({ content: "❌ Il faut 50 or pour chercher une autre cible.", ephemeral: true });
        return true;
      }
      base.res.or -= 50;
      save();
    }
    clashTargets.set(userId, clashFindTarget(userId));
    await show(clashTargetPayload(userId));
    return true;
  }
  if (id === "carte_cl_go") {
    const t = clashTargets.get(userId);
    const army = clashArmy(base, userId);
    if (!t || (!t.ghost && !clashState()[t.owner])) {
      await show(clashHomePayload(userId, "⌛ Cette cible n'est plus disponible."));
      return true;
    }
    if (!t.ghost && clashState()[t.owner].shield > Date.now()) {
      await show(clashHomePayload(userId, "🛡️ Cette Maison vient d'activer un bouclier : cherchez une autre cible."));
      return true;
    }
    const refused = clashCanAttack(userId);
    if (refused) {
      await interaction.reply({ content: refused, ephemeral: true });
      return true;
    }
    clashTargets.delete(userId);
    clashBusy.add(userId);
    try {
      const attack = clashAttack(client, userId, t);
      await interaction.deferUpdate();
      await clashPlayBattle(show, await attack, false);
    } finally {
      clashBusy.delete(userId);
    }
    return true;
  }
  const wgo = /^carte_cl_wgo_(\d+)$/.exec(id);
  if (wgo) {
    const team = teamOf(userId), pair = team ? warOf(team.id) : null, foeUid = wgo[1];
    const used = pair ? (pair.attacks[userId] ?? []).length : WAR_ATTACKS;
    if (!pair || used >= WAR_ATTACKS || !clashState()[foeUid] || teamOf(foeUid)?.id !== (pair.a === team.id ? pair.b : pair.a)) {
      await interaction.reply({ content: "❌ Cette attaque de guerre n'est pas possible.", ephemeral: true });
      return true;
    }
    const refused = clashCanAttack(userId);
    if (refused) {
      await interaction.reply({ content: refused, ephemeral: true });
      return true;
    }
    clashBusy.add(userId);
    (pair.attacks[userId] ??= []).push({ target: foeUid, stars: 0, pct: 0 }); // réservé tout de suite
    const slot = pair.attacks[userId].at(-1);
    let r;
    try {
      const attack = clashAttack(client, userId, { owner: foeUid, ghost: false }, pair);
      await interaction.deferReply({ ephemeral: true });
      r = await attack;
    } catch (e) {
      pair.attacks[userId].splice(pair.attacks[userId].indexOf(slot), 1);
      clashBusy.delete(userId);
      throw e;
    }
    // seule la meilleure attaque de l'équipe sur chaque Maison compte
    const side = pair.a === team.id ? "a" : "b";
    const before = Math.max(0, ...Object.entries(pair.attacks).filter(([a]) => team.members.includes(a)).flatMap(([, list]) => list.filter((x) => x !== slot && x.target === foeUid).map((x) => x.stars)));
    Object.assign(slot, { stars: r.sim.stars, pct: r.sim.pct });
    if (r.sim.stars > before) pair.stars[side] += r.sim.stars - before;
    save();
    clashDirty = true;
    try {
      await clashPlayBattle((p) => interaction.editReply(p), r, true);
    } finally {
      clashBusy.delete(userId);
    }
    return true;
  }
  return false;
}
