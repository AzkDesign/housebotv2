
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
async function clashHomePayload(userId, note = "") {
  const base = clashBaseOf(userId);
  if (!base)
    return {
      ephemeral: true,
      content: null,
      embeds: [
        new EmbedBuilder()
          .setColor(0x65a30d)
          .setTitle("🏰 Fondez votre Maison")
          .setDescription(
            "Bâtissez votre propre Maison : un **Manoir**, des **mines d'or** et des **distilleries d'essence**, des **coffres**, une **caserne** et des **défenses** (canons, tours de l'IRF, mortiers).\n\n" +
              "⚔️ Vos **cartes deviennent vos troupes** : attaquez les Maisons des autres membres pour piller leurs ressources et gagner des trophées.\n🛡️ Pendant ce temps, les autres attaquent la vôtre… même quand vous dormez.\n🏆 Le week-end, la **guerre des équipes** oppose les duos entre eux."
          ),
      ],
      files: [],
      attachments: [],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_cl_found").setLabel("Fonder ma Maison").setEmoji("🏰").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId("carte_cl_rules").setLabel("Règles").setEmoji("📖").setStyle(ButtonStyle.Secondary))],
    };
  const img = new AttachmentBuilder(await (await drawClashBase(base)).encode("jpeg", 86), { name: "maison.jpg" });
  const rates = clashRates(base), cap = clashCap(base), opts = clashOptions(base), army = clashArmy(base, userId);
  const works = base.buildings.filter((x) => x.upgrading).map((x) => `🔨 ${CLASH_BUILDINGS[x.type].emoji} ${CLASH_BUILDINGS[x.type].name} → niv. ${x.upgrading.to} · fini <t:${Math.floor(x.upgrading.done / 1000)}:R>`);
  const soonest = base.buildings.filter((x) => x.upgrading).sort((a, b) => a.upgrading.done - b.upgrading.done)[0];
  const speedCost = soonest ? Math.max(1, Math.ceil((soonest.upgrading.done - Date.now()) / MINUTE)) * CLASH_SPEEDUP_DUST : 0;
  const rows = [];
  if (opts.length)
    rows.push(
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_cl_build")
          .setPlaceholder(busyBuilders(base) >= CLASH_BUILDERS ? "🔨 Vos deux ouvriers sont occupés…" : "🔨 Construire ou améliorer…")
          .setDisabled(busyBuilders(base) >= CLASH_BUILDERS)
          .addOptions(
            opts.slice(0, 25).map((o) => ({
              label: `${o.kind === "new" ? "Construire" : "Améliorer"} ${CLASH_BUILDINGS[o.type].name}${o.kind === "up" ? ` → niv. ${o.to}` : ""}`.slice(0, 100),
              value: o.kind === "new" ? `new:${o.type}` : `up:${o.id}`,
              emoji: CLASH_BUILDINGS[o.type].emoji,
              description: `${costText(o.cost)} · ${minutesText(o.time)}${clashCanPay(base, o.cost) ? "" : " · ressources insuffisantes"}`.slice(0, 100),
            }))
          )
      )
    );
  const armyOpts = clashArmyOptions(userId, base);
  if (armyOpts.length) rows.push(new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId("carte_cl_army").setPlaceholder(`⚔️ Choisir mon armée (${armySlots(base)} places)…`).setMinValues(1).setMaxValues(Math.min(armySlots(base), armyOpts.length)).addOptions(armyOpts)));
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_cl_find").setLabel("Attaquer").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(!army.length),
      new ButtonBuilder().setCustomId("carte_cl_speed").setLabel(soonest ? `Accélérer (${speedCost} ✨)` : "Accélérer").setEmoji("⏩").setStyle(ButtonStyle.Primary).setDisabled(!soonest || (load().dust[userId] ?? 0) < speedCost),
      new ButtonBuilder().setCustomId("carte_cl_log").setLabel("Journal").setEmoji("📜").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("carte_cl").setLabel("Actualiser").setEmoji("🔄").setStyle(ButtonStyle.Secondary)
    )
  );
  const day = dayKey(), attacksLeft = CLASH_ATTACKS_PER_DAY - (base.attacks.day === day ? base.attacks.n : 0);
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x65a30d)
        .setTitle(`🏰 ${base.name} — Manoir niveau ${manoirOf(base)}`)
        .setDescription(
          (note ? `${note}\n\n` : "") +
            `🪙 **${Math.floor(base.res.or).toLocaleString("fr-FR")}** Or (+${rates.or}/h) · 🔮 **${Math.floor(base.res.essence).toLocaleString("fr-FR")}** Essence (+${rates.essence}/h) · stockage max **${cap.toLocaleString("fr-FR")}**\n` +
            `👷 Ouvriers : **${CLASH_BUILDERS - busyBuilders(base)} / ${CLASH_BUILDERS}** libres${works.length ? `\n${works.join("\n")}` : ""}\n` +
            `⚔️ Armée : ${army.length ? army.map((k) => `${TROOP_ROLES[troopRole(cardOfKey(k))].emoji} ${keyLabel(k)}`).join(", ") : "*aucune — choisissez vos cartes ci-dessous*"} (${army.length}/${armySlots(base)})\n` +
            `🏆 **${base.trophies}** trophées · ${attacksLeft} attaque${attacksLeft > 1 ? "s" : ""} restante${attacksLeft > 1 ? "s" : ""} aujourd'hui${base.shield > Date.now() ? ` · 🛡️ bouclier jusqu'à <t:${Math.floor(base.shield / 1000)}:t>` : ""}`
        )
        .setImage("attachment://maison.jpg")
        .setFooter({ text: `Une attaque coûte ${CLASH_TROOP_COST} 🔮 par troupe · accélérer un chantier : ${CLASH_SPEEDUP_DUST} ✨ par minute` }),
    ],
    files: [img],
    attachments: [],
    components: rows,
  };
}
const CLASH_RULES = () =>
  new EmbedBuilder()
    .setColor(0x65a30d)
    .setTitle("📖 Clash de la Maison — règles")
    .setDescription(
      "🏰 **Votre Maison** : le **Manoir** fixe le niveau maximum des autres bâtiments et débloque de nouveaux bâtiments. Les **mines** et **distilleries** produisent 🪙 Or et 🔮 Essence toutes seules, jusqu'à la limite des **coffres**. Deux **ouvriers** construisent en même temps ; un chantier peut être **accéléré** avec de la poussière d'étoile ✨.\n\n" +
        "⚔️ **Attaquer** : votre armée est faite de **vos cartes** (la **caserne** fixe le nombre de places). Chaque série a son rôle :\n" +
        Object.values(TROOP_ROLES).map((r) => `${r.emoji} **${r.name}** — ${r.desc}`).join("\n") +
        "\nLes cartes rares et holos font des troupes plus fortes. Les défenses (canon, tour de l'IRF, mortier à éclaboussure) tirent sur vos troupes.\n\n" +
        "⭐ **Étoiles** : 50 % de destruction, Manoir détruit, 100 % de destruction. Vous pillez jusqu'à 25 % des ressources de la Maison attaquée selon la destruction, et vous gagnez ou perdez des **trophées**.\n" +
        `🛡️ **Bouclier** : une Maison battue est protégée quelques heures. Attaquer retire votre propre bouclier. ${CLASH_ATTACKS_PER_DAY} attaques par jour au maximum.\n` +
        "👻 Quand personne n'est disponible, vous affrontez une **Maison fantôme**.\n\n" +
        "🏆 **Guerre des équipes** : du **vendredi 18 h au dimanche 22 h**, chaque duo affronte un autre duo. Chaque membre a **2 attaques de guerre** sur les Maisons adverses ; l'équipe qui totalise le plus d'étoiles gagne de l'Or, de l'Essence, de la poussière d'étoile et de l'XP d'équipe."
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
function lootOf(target, pct) {
  const share = 0.25 * (pct / 100);
  return { or: Math.floor((target.res.or ?? 0) * share), essence: Math.floor((target.res.essence ?? 0) * share) };
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
            `💰 Butin possible : 🪙 **${maxLoot.or.toLocaleString("fr-FR")}** · 🔮 **${maxLoot.essence.toLocaleString("fr-FR")}** (à 100 % de destruction)\n` +
            `⚔️ Votre armée : ${army.map((k) => keyLabel(k)).join(", ")}\n` +
            `Coût de l'attaque : 🔮 **${cost}** (vous avez ${Math.floor(me.res.essence)})\n\n*Les cercles pointillés montrent la portée des défenses.*`
        )
        .setImage("attachment://cible.jpg"),
    ],
    files: [img],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_cl_go").setLabel("Lancer l'attaque").setEmoji("⚔️").setStyle(ButtonStyle.Danger).setDisabled(me.res.essence < cost),
        new ButtonBuilder().setCustomId("carte_cl_next").setLabel("Cible suivante (50 🪙)").setEmoji("⏭️").setStyle(ButtonStyle.Secondary).setDisabled(me.res.or < 50),
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
async function clashAttack(client, userId, t, war = null) {
  const me = clashState()[userId], target = targetBase(t);
  const army = clashArmy(me, userId), cost = army.length * CLASH_TROOP_COST;
  me.res.essence -= cost;
  me.shield = 0;
  if (me.attacks.day !== dayKey()) me.attacks = { day: dayKey(), n: 0 };
  me.attacks.n++;
  const sim = clashSimulate(target, army);
  const loot = war ? { or: 300 * manoirOf(target) * sim.stars, essence: 300 * manoirOf(target) * sim.stars } : lootOf(target, sim.pct);
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
    target.res.or = Math.max(0, target.res.or - loot.or);
    target.res.essence = Math.max(0, target.res.essence - loot.essence);
    const lost = sim.stars ? 4 * sim.stars : -5;
    target.trophies = Math.max(0, target.trophies - lost);
    if (sim.stars) target.shield = Date.now() + sim.stars * 4 * 3600000;
    target.stats.defenses++;
    if (!sim.stars) target.stats.defWins++;
    pushLog(target, `🛡️ ${me.name} vous attaque : ${sim.pct} %, ${"⭐".repeat(sim.stars) || "0 étoile"} · −🪙${loot.or} −🔮${loot.essence} · ${lost > 0 ? `−${lost}` : `+${-lost}`} 🏆`);
    client?.users
      .fetch(target.owner)
      .then((u) => u.send(`🏰 **${me.name}** a attaqué votre Maison : **${sim.pct} %** de destruction, ${"⭐".repeat(sim.stars) || "aucune étoile"}.${sim.stars ? ` Butin perdu : 🪙 ${loot.or} · 🔮 ${loot.essence}. Un bouclier vous protège ${sim.stars * 4} h.` : " Votre défense a tenu bon !"}`))
      .catch(() => null);
  }
  pushLog(me, `⚔️ Attaque${war ? " de guerre" : ""} sur ${target.name} : ${sim.pct} %, ${"⭐".repeat(sim.stars) || "0 étoile"} · +🪙${loot.or} +🔮${loot.essence}${trophies ? ` · ${trophies > 0 ? "+" : ""}${trophies} 🏆` : ""}`);
  if (sim.stars === 3) await clashNotice(`💥 **${me.name}** rase entièrement ${target.ghost ? "une Maison fantôme" : `la Maison de **${target.name}**`} : ⭐⭐⭐ !`);
  if (sim.stars) ustat(userId, "clashStars", sim.stars);
  clashDirty = true;
  save();
  checkAchievements(userId).catch(() => null);
  const gif = await clashBattleGif(target, sim, me.name);
  return { sim, loot, trophies, gif, target };
}
function clashResultPayload(r, war) {
  return {
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(r.sim.stars ? 0x16a34a : 0xb91c1c)
        .setTitle(`${r.sim.stars ? "🏆 Victoire" : "💀 Défaite"} — ${r.sim.pct} % · ${"⭐".repeat(r.sim.stars) || "aucune étoile"}`)
        .setDescription(`Butin : 🪙 **${r.loot.or.toLocaleString("fr-FR")}** · 🔮 **${r.loot.essence.toLocaleString("fr-FR")}**${war ? "\n🏆 Attaque de guerre : vos étoiles comptent pour votre équipe !" : `\nTrophées : **${r.trophies > 0 ? "+" : ""}${r.trophies}** 🏆`}`)
        .setImage("attachment://combat.gif"),
    ],
    files: [new AttachmentBuilder(r.gif, { name: "combat.gif" })],
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
    const msg = lines.length ? await chan("clash")?.send({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setTitle("🏁 Fin de la guerre des équipes").setDescription(`${lines.join("\n")}\n\nVainqueurs : 🪙 3 000 · 🔮 3 000 · 300 ✨ chacun et 250 XP d'équipe. Perdants : 🪙 800 · 🔮 800 · 80 ✨.`)] }).catch(() => null) : null;
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
        "🪙 Or · 🔮 Essence · ⭐ étoiles · 🏆 trophées · 🛡️ boucliers · ⚔️ guerre des équipes le week-end.\n\n" +
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
      clashDirty = true;
      save();
    }
    await show(clashHomePayload(userId, "🎉 **Votre Maison est fondée !** Choisissez votre armée, améliorez vos bâtiments… et partez à l'attaque."));
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
        await interaction.reply({ content: "❌ Il faut 50 🪙 pour chercher une autre cible.", ephemeral: true });
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
    if (base.res.essence < army.length * CLASH_TROOP_COST) {
      await interaction.reply({ content: `❌ Il faut ${army.length * CLASH_TROOP_COST} 🔮 pour lancer cette attaque.`, ephemeral: true });
      return true;
    }
    clashTargets.delete(userId);
    await interaction.deferUpdate();
    const r = await clashAttack(client, userId, t);
    await show(clashResultPayload(r, false));
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
    if (!clashArmy(base, userId).length || base.res.essence < clashArmy(base, userId).length * CLASH_TROOP_COST) {
      await interaction.reply({ content: "❌ Il vous faut une armée et assez d'essence pour attaquer.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const r = await clashAttack(client, userId, { owner: foeUid, ghost: false }, pair);
    // seule la meilleure attaque de l'équipe sur chaque Maison compte
    const side = pair.a === team.id ? "a" : "b";
    const before = Math.max(0, ...Object.entries(pair.attacks).filter(([a]) => team.members.includes(a)).flatMap(([, list]) => list.filter((x) => x.target === foeUid).map((x) => x.stars)));
    (pair.attacks[userId] ??= []).push({ target: foeUid, stars: r.sim.stars, pct: r.sim.pct });
    if (r.sim.stars > before) pair.stars[side] += r.sim.stars - before;
    save();
    clashDirty = true;
    await interaction.editReply(clashResultPayload(r, true));
    return true;
  }
  return false;
}
