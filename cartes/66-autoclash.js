// --- Clash de la Maison en automatique (« autoclash » en message privé, voir 29-automatique) ---
// « autoclash » (tous les membres de AUTO_WORDS) ou « nina autoclash » : chaque membre concerné gère sa Maison tout seul
// — récolte, objectifs, armée, chantiers (coffres et production d'abord, puis défenses, et le Manoir quand tout le reste
// est au maximum) — et attaque environ deux fois par heure, avec les règles normales du jeu (troupes qui se reforment,
// essence, 8 attaques par jour au plus). « autoclash bilan » : où en est chacun · « autoclash stop » : arrêt.
// Les attaques automatiques ne fabriquent pas de cinématique (personne ne la regarde) : moins de mémoire.
const AUTOCLASH_EVERY = [25, 35]; // minutes entre deux attaques (≈ 2 par heure)
const autoclashState = () => (load().clashAuto ??= {});
const AUTOCLASH_ORDER = ["coffre", "mine", "distillerie", "caserne", "canon", "tour", "mortier"];
// la Maison d'un membre : fondée si besoin, récoltée, objectifs réclamés, armée prête, ouvriers au travail
function autoclashManage(userId) {
  const st = clashState(), out = [];
  if (!st[userId]) {
    st[userId] = newBase({ id: userId, name: pseudo(userId), avatar: null });
    autoArmy(userId, st[userId]);
    out.push("Maison fondée");
  }
  const base = clashBaseOf(userId);
  const got = clashCollect(base);
  if (got.or || got.essence) base.stats.collects = (base.stats.collects ?? 0) + 1;
  // objectifs guidés (même récompense qu'en cliquant)
  for (let goal = currentGoal(base); goal && goal.done(base); goal = currentGoal(base)) {
    const rw = goal.reward;
    if (rw.or) base.res.or = Math.min(clashCap(base) + rw.or, base.res.or + rw.or);
    if (rw.essence) base.res.essence = Math.min(clashCap(base) + rw.essence, base.res.essence + rw.essence);
    if (rw.dust) load().dust[userId] = (load().dust[userId] ?? 0) + rw.dust;
    if (rw.pack) addPacks(userId, packKey(CURRENT_GEN, rw.pack), 1);
    base.goal = (base.goal ?? 0) + 1;
    out.push(`objectif réussi (${goalReward(rw)})`);
  }
  // armée : les meilleures cartes, autant que la caserne en accueille
  if (clashArmy(base, userId).length < armySlots(base)) autoArmy(userId, base);
  // chantiers : les nouveaux bâtiments d'abord, puis coffres, production, caserne, défenses ; le Manoir en dernier
  const rank = (o) => (o.kind === "new" ? 0 : 1) * 10 + (o.type === "manoir" ? 99 : AUTOCLASH_ORDER.indexOf(o.type));
  while (busyBuilders(base) < CLASH_BUILDERS) {
    const opts = clashOptions(base).sort((a, b) => rank(a) - rank(b));
    const others = opts.filter((o) => o.type !== "manoir");
    // le Manoir seulement quand il n'y a plus rien d'autre à faire (sinon on économise pour lui)
    // on garde toujours l'essence de la prochaine attaque
    const reserve = clashArmy(base, userId).length * CLASH_TROOP_COST;
    const pick = (others.length ? others : opts).find((o) => clashCanPay(base, o.cost) && base.res.essence - (o.cost.essence ?? 0) >= reserve);
    if (!pick || clashStart(base, pick)) break;
    out.push(`${pick.kind === "new" ? "construit" : "améliore"} ${CLASH_BUILDINGS[pick.type].name}${pick.kind === "new" ? "" : ` (niveau ${pick.to})`}`);
    const me = autoclashState()[userId];
    if (me) me.upgrades = (me.upgrades ?? 0) + 1;
  }
  clashDirty = true;
  save();
  return out;
}
async function autoclashAttack(client, userId) {
  if (clashCanAttack(userId)) return null;
  const t = clashFindTarget(userId);
  clashBusy.add(userId);
  try {
    const r = await clashAttack(client, userId, t, null, { quiet: true });
    const me = autoclashState()[userId];
    if (me) {
      me.attacks = (me.attacks ?? 0) + 1;
      me.stars = (me.stars ?? 0) + r.sim.stars;
      me.or = (me.or ?? 0) + r.loot.or;
      me.essence = (me.essence ?? 0) + r.loot.essence;
      me.trophies = (me.trophies ?? 0) + r.trophies;
    }
    save();
    return r;
  } finally {
    clashBusy.delete(userId);
  }
}
async function autoclashTick(client) {
  const list = autoclashState(), now = Date.now();
  for (const [id, me] of Object.entries(list)) {
    if (AUTO_EXCLUDE.has(id)) continue;
    try {
      autoclashManage(id);
      if (now >= (me.next ?? 0)) {
        me.next = now + (AUTOCLASH_EVERY[0] + Math.random() * (AUTOCLASH_EVERY[1] - AUTOCLASH_EVERY[0])) * MINUTE;
        await autoclashAttack(client, id);
        autoclashManage(id); // le butin repart tout de suite en chantiers
      }
    } catch (err) {
      console.error(`Autoclash ${id}:`, err.message);
    }
  }
}
function autoclashReport(ids) {
  return ids
    .map((id) => {
      const me = autoclashState()[id], base = clashState()[id];
      if (!me) return `• **${pseudo(id)}** : autoclash arrêté`;
      const today = base?.attacks?.day === dayKey() ? base.attacks.n : 0;
      return (
        `• **${pseudo(id)}** : Manoir niv. ${base ? manoirOf(base) : 1} · 🏆 ${base?.trophies ?? 0} · ${me.attacks ?? 0} attaque${(me.attacks ?? 0) > 1 ? "s" : ""} (${me.stars ?? 0} ⭐, +${(me.or ?? 0).toLocaleString("fr-FR")} or, +${(me.essence ?? 0).toLocaleString("fr-FR")} essence)` +
        ` · ${me.upgrades ?? 0} chantier${(me.upgrades ?? 0) > 1 ? "s" : ""} · aujourd'hui ${today}/${CLASH_ATTACKS_PER_DAY}`
      );
    })
    .join("\n");
}
{
  const loop = shopLoop;
  shopLoop = async () => {
    await loop();
    await autoclashTick(cardClient).catch((err) => console.error("Autoclash:", err.message));
  };
  const auto = handleAutoMessage;
  handleAutoMessage = async (message) => {
    const words = message.guild || message.author?.bot || message.author?.id !== AUTO_TRIGGER_ID ? [] : message.content.trim().toLowerCase().split(/\s+/);
    const at = words.indexOf("autoclash");
    if (at < 0 || words.slice(0, at).some((w) => !AUTO_WORDS[w]) || words.length > at + 2) return auto(message);
    const sub = words[at + 1] ?? "", named = words.slice(0, at);
    const ids = [...new Set((named.length ? named : Object.keys(AUTO_WORDS)).flatMap((w) => AUTO_WORDS[w]))].filter((id) => !AUTO_EXCLUDE.has(id));
    const list = autoclashState();
    let head;
    if (sub === "stop") {
      head = "⏹️ **Autoclash arrêté** pour :";
      const report = autoclashReport(ids);
      for (const id of ids) delete list[id];
      save();
      return void (await message.reply(`${head}\n${report}`.slice(0, 1990)).catch(() => null));
    }
    if (sub === "bilan") {
      head = "🏰 **Autoclash — bilan**";
      const on = ids.filter((id) => list[id]);
      return void (await message.reply(`${head}
${on.length ? autoclashReport(on) : "Personne n'est en autoclash."}`.slice(0, 1990)).catch(() => null));
    }
    else if (!sub) {
      const fresh = ids.filter((id) => !list[id]);
      // première attaque dans les 1 à 10 minutes, chacun à un moment différent
      for (const id of fresh) list[id] = { since: Date.now(), next: Date.now() + (1 + Math.random() * 9) * MINUTE };
      for (const id of fresh) autoclashManage(id);
      save();
      head = `🏰 **Autoclash lancé** : chaque Maison se gère toute seule (récolte, objectifs, armée, chantiers) et attaque environ **2 fois par heure** (au plus ${CLASH_ATTACKS_PER_DAY} attaques par jour, la règle du jeu). « autoclash bilan » pour suivre, « autoclash stop » pour arrêter.`;
    } else return auto(message);
    await message.reply(`${head}\n${autoclashReport(ids)}`.slice(0, 1990)).catch(() => null);
  };
}
