
// --- Mode Histoire : « Les Secrets de la Maison » ---
// Une enquête en chapitres. Chaque choix modifie la sauvegarde du joueur : réputations, morale, objets, souvenirs.
// L'histoire est une fiction : elle ne touche ni les vraies institutions du serveur, ni l'économie en euros.
// Les seules choses qui en sortent : des cartes Histoire, de la poussière d'étoile, des boosters, des succès.
const STORY = {};
const SC = (id, def) => (STORY[id] = { id, ...def });
const STORY_CHAPTERS = {
  1: { title: "La Clé sous la pluie", color: 0xe9c46a },
  2: { title: "Les Nuits de Paris", color: 0xf43f5e },
  3: { title: "L'Hôtel de Ville", color: 0xa78bfa },
};
const STORY_START = "c1_00";
const STORY_TICKETS = 3, STORY_EXTRA_COST = 60, STORY_EXTRA_MAX = 2;
const STORY_FACTIONS = {
  fondation: ["🕯️", "Fondation"],
  irf: ["🔎", "IRF"],
  mairie: ["🎩", "Mairie"],
  casino: ["🎰", "Casino"],
  entreprises: ["💼", "Entreprises"],
};
const STORY_ITEMS = {
  gant: ["🧤", "Un gant brodé « B.A. »"],
  cle_chambre: ["🔑", "La clé de la chambre 7"],
  bougie: ["🕯️", "La bougie d'Augustin"],
  jeu: ["🃏", "Le Jeu du Fondateur"],
  photo: ["🖼️", "Une vieille photo de la Maison (1897)"],
  lettre: ["✉️", "La lettre inachevée du Fondateur"],
  cle_fondateur: ["🗝️", "La clé de fer du Fondateur"],
  micro: ["🎙️", "Le micro de l'inspectrice"],
  jeton: ["♠️", "Le jeton noir de Velours"],
  cle_velours: ["💋", "La clé du salon privé de Velours"],
  registre: ["📒", "Le registre du Casino"],
  contrat: ["📜", "Le contrat de vente original"],
  plan: ["🗺️", "Le plan du sous-sol de la Mairie"],
};
// cartes exclusives du Mode Histoire (impossibles à obtenir autrement)
const STORY_CARDS = {
  hs_cle: { ...C("hs_cle", "La Clé du Fondateur", "🗝️", "rare", "Elle ouvre plus que des portes."), chapter: 1 },
  hs_augustin: { ...C("hs_augustin", "Augustin, le Concierge", "🛎️", "rare", "Quarante ans de service, et pas un secret de trop."), chapter: 1 },
  hs_jeu: { ...C("hs_jeu", "Le Jeu du Fondateur", "🃏", "epique", "Chaque carte garde un fragment de mémoire."), chapter: 1 },
  hs_valence: { ...C("hs_valence", "L'Inspectrice Valence", "🔎", "epique", "Rien n'échappe à l'Institut. Presque rien."), chapter: 2 },
  hs_velours: { ...C("hs_velours", "Velours", "🌹", "epique", "Elle ne perd jamais. Sauf une fois."), chapter: 2 },
  hs_delorme: { ...C("hs_delorme", "Monsieur le Maire", "🎩", "legendaire", "Un sourire pour les caméras, un autre pour les affaires."), chapter: 3 },
  hs_contrat: { ...C("hs_contrat", "Le Contrat Scellé", "📜", "legendaire", "Une signature qui pourrait tout changer."), chapter: 3 },
  hs_fondateur: { ...C("hs_fondateur", "L'Ombre du Fondateur", "🕯️", "mythique", "Il n'a jamais vraiment quitté la Maison."), chapter: 8 },
};
const STORY_REWARDS = {
  1: { dust: 150, pack: "standard", card: "hs_augustin" },
  2: { dust: 200, pack: "premium", card: "hs_velours" },
  3: { dust: 300, pack: "premium", card: "hs_delorme" },
};
{
  // la série « Histoire » rejoint l'album, le codex et les illustrations
  const all = allCards, series = seriesOf, kind = kindOf, element = elementOf, how = howToGet;
  allCards = () => [...all(), ...Object.values(STORY_CARDS)];
  seriesOf = (card) => (card.id.startsWith("hs_") ? "histoire" : series(card));
  kindOf = (card) => (card.id.startsWith("hs_") ? `Mode Histoire · Chapitre ${card.chapter}` : kind(card));
  elementOf = (card) => (card.id.startsWith("hs_") ? (card.rarity === "mythique" ? "lumiere" : "ombre") : element(card));
  howToGet = (card) => (card.id.startsWith("hs_") ? ["📖", card.chapter <= Math.max(...Object.keys(STORY_CHAPTERS).map(Number)) ? `Mode Histoire · chapitre ${card.chapter}` : "Mode Histoire · bientôt", "#c4b5fd"] : how(card));
  SERIES_LABELS.histoire = "📖 Histoire";
  SPECIAL_NAMES.histoire = "Révélation";
  Object.assign(FLUENT, { "🃏": "Joker", "🛎️": "Bellhop bell", "🔎": "Magnifying glass tilted right", "🌹": "Rose", "🎩": "Top hat", "📜": "Scroll", "🕯️": "Candle", "🗝️": "Old key" });
  Object.assign(THEMES, {
    hs_cle: { scene: "nuit", fx: "lucioles" },
    hs_augustin: { scene: "aube", fx: "poussiere" },
    hs_jeu: { scene: "cosmos", fx: "orbes", anim: "popout" },
    hs_valence: { scene: "nuitbleue", fx: "scan" },
    hs_velours: { scene: "rose", fx: "confettis" },
    hs_delorme: { scene: "nuit", fx: "eclats" },
    hs_contrat: { scene: "souterrain", fx: "poussiere" },
    hs_fondateur: { scene: "cosmos", fx: "orbes", anim: "popout" },
  });
  // succès du Mode Histoire
  const facts = playerFacts;
  playerFacts = (userId) => ({ ...facts(userId), storyCh: Math.max(0, ...(load().story?.[userId]?.chapters ?? [])) });
  ACHIEVEMENTS.push(["story1", "📖", "Premier chapitre", "Terminer le chapitre 1 du Mode Histoire", "storyCh", 1, 100], ["story3", "🗝️", "Enquêteur de la Maison", "Terminer le chapitre 3 du Mode Histoire", "storyCh", 3, 300]);
}

// --- Sauvegarde ---
function storySave(userId) {
  const st = load();
  st.story ??= {};
  st.storyRewards ??= {};
  st.storyStats ??= {};
  const sv = (st.story[userId] ??= { scene: null, flags: {}, items: [], rep: Object.fromEntries(Object.keys(STORY_FACTIONS).map((k) => [k, 0])), moral: 0, mem: [], seen: {}, chapters: [], riddles: {}, tickets: STORY_TICKETS, day: dayKey(), extra: 0, choices: 0, started: Date.now() });
  if (sv.day !== dayKey()) {
    sv.tickets = Math.max(sv.tickets, STORY_TICKETS);
    sv.extra = 0;
    sv.day = dayKey();
  }
  return sv;
}
const storyRewardsOf = (userId) => (load().storyRewards[userId] ??= { chapters: {}, cards: {} });
// contexte passé aux textes et effets des scènes
function storyCtx(userId, notes, name) {
  const sv = storySave(userId);
  const S = {
    sv,
    name,
    notes,
    has: (f) => Boolean(sv.flags[f]),
    set: (f, v = true) => (sv.flags[f] = v),
    get: (f) => sv.flags[f],
    item: (i) => sv.items.includes(i),
    give(i) {
      if (sv.items.includes(i)) return;
      sv.items.push(i);
      notes.push(`🎒 Objet obtenu : ${STORY_ITEMS[i][0]} **${STORY_ITEMS[i][1]}**`);
    },
    take(i) {
      if (!sv.items.includes(i)) return;
      sv.items = sv.items.filter((x) => x !== i);
      notes.push(`🎒 Objet perdu : ${STORY_ITEMS[i][0]} ${STORY_ITEMS[i][1]}`);
    },
    rep(f, n) {
      if (n === undefined) return sv.rep[f] ?? 0;
      sv.rep[f] = Math.max(-10, Math.min(10, (sv.rep[f] ?? 0) + n));
      notes.push(`${STORY_FACTIONS[f][0]} ${STORY_FACTIONS[f][1]} ${n > 0 ? `+${n}` : n}`);
    },
    moral(n) {
      if (n === undefined) return sv.moral;
      sv.moral += n;
      notes.push(n > 0 ? "⚖️ Vous agissez avec honnêteté." : "⚖️ Votre conscience s'alourdit…");
    },
    mem(t) {
      sv.mem.push(t);
      notes.push(`📝 *${t}*`);
    },
    dust(n) {
      load().dust[userId] = (load().dust[userId] ?? 0) + n;
      notes.push(`✨ +${n} poussière d'étoile`);
    },
    card(id) {
      const rw = storyRewardsOf(userId);
      if (rw.cards[id]) return;
      rw.cards[id] = Date.now();
      give(userId, STORY_CARDS[id], false);
      notes.push(`🃏 **Carte Histoire obtenue : ${STORY_CARDS[id].name}** (${RARITIES[STORY_CARDS[id].rarity].name}) — elle rejoint votre album !`);
    },
    owns: (cardId) => (load().inv[userId]?.[cardId] ?? 0) + (load().inv[userId]?.[`${cardId}*`] ?? 0) > 0,
  };
  return S;
}
const sceneText = (scene, S) => (typeof scene.text === "function" ? scene.text(S) : scene.text);
const sceneChoices = (scene, S) => (typeof scene.choices === "function" ? scene.choices(S) : scene.choices ?? []);
const noEph = (p) => { delete p.ephemeral; return p; };
const choiceVisible = (c, S) => !c.if || c.if(S);
const choiceLocked = (c, S) => c.lock && !c.lock.if(S);

// --- Rendu d'une scène ---
function repLine(sv) {
  return Object.entries(STORY_FACTIONS)
    .map(([k, [e]]) => `${e}${sv.rep[k] > 0 ? "+" : ""}${sv.rep[k]}`)
    .join(" · ");
}
async function storyScenePayload(userId, name, notes = [], opts = {}) {
  const sv = storySave(userId), raw = STORY[sv.scene];
  if (!raw) return storyCoverPayload(userId);
  const S = storyCtx(userId, notes, name);
  const scene = { ...raw };
  for (const k of ["who", "bg", "prop", "mood"]) if (typeof scene[k] === "function") scene[k] = scene[k](S);
  const chap = STORY_CHAPTERS[scene.ch] ?? { title: "", color: 0x8b5cf6 };
  const cast = scene.who ? STORY_CAST[scene.who] : null;
  const text = sceneText(scene, S);
  const file = new AttachmentBuilder(await (await drawStoryScene(scene, { banner: opts.banner })).encode("jpeg", 86), { name: "scene.jpg" });
  const choices = sceneChoices(scene, S).map((c, i) => ({ ...c, i })).filter((c) => choiceVisible(c, S));
  const rows = [];
  for (let k = 0; k < choices.length && rows.length < 4; k += 2) {
    rows.push(
      new ActionRowBuilder().addComponents(
        choices.slice(k, k + 2).map((c) => {
          const locked = choiceLocked(c, S), cost = c.cost && (load().dust[userId] ?? 0) < c.cost;
          const tag = c.test ? "🎲 " : c.duel ? "⚔️ " : c.riddle ? "🧩 " : "";
          const label = locked ? `🔒 ${c.lock.why}` : `${tag}${c.label}${c.cost ? ` (${c.cost} ✨)` : ""}`;
          return new ButtonBuilder()
            .setCustomId(`carte_hs_c_${scene.id}_${c.i}`)
            .setLabel(label.slice(0, 80))
            .setStyle(locked ? ButtonStyle.Secondary : c.style === "danger" ? ButtonStyle.Danger : c.style === "success" ? ButtonStyle.Success : ButtonStyle.Primary)
            .setDisabled(Boolean(locked || cost))
            .setEmoji(c.emoji ?? "▶️");
        })
      )
    );
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_hs_journal").setLabel("Journal d'enquête").setEmoji("📓").setStyle(ButtonStyle.Secondary)
    )
  );
  const header = notes.length ? `${notes.map((n) => `> ${n}`).join("\n")}\n\n` : "";
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(cast ? parseInt(cast.color.slice(1), 16) : chap.color)
        .setAuthor({ name: `📖 Chapitre ${ROMAN[scene.ch] ?? scene.ch} — ${chap.title}` })
        .setTitle(scene.title ? `✦ ${scene.title} ✦` : cast ? `${cast.name}` : scene.heading ?? null)
        .setDescription(`${header}${text}`.slice(0, 4000))
        .setImage("attachment://scene.jpg")
        .setFooter({ text: `🎟️ ${sv.tickets} ticket${sv.tickets > 1 ? "s" : ""} d'histoire · ${repLine(sv)}` }),
    ],
    files: [file],
    attachments: [],
    components: rows,
  };
}
async function storyCoverPayload(userId) {
  const sv = storySave(userId);
  const file = new AttachmentBuilder(await (await drawStoryCover()).encode("jpeg", 86), { name: "scene.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("📖 Les Secrets de la Maison")
        .setDescription(
          "*Paris, une nuit de pluie. Une lettre vous a été remise : la Maison vous accepte comme résident. Elle est signée d'un seul mot — le Fondateur. Ce soir, il disparaît.*\n\n" +
            "**Une enquête en chapitres où vos choix comptent** :\n" +
            `🔀 **Choix** : chaque décision change votre histoire (alliés, ennemis, secrets, fins).\n` +
            `🎲 **Épreuves** : vos cartes vous aident — une carte chanceuse crochète mieux une serrure.\n` +
            `⚔️ **Duels** : affrontez des adversaires avec la carte de votre choix.\n` +
            `🧩 **Énigmes** : les indices sont cachés dans les scènes… lisez bien.\n` +
            `📓 **Journal** : réputations, objets, souvenirs.\n` +
            `🎟️ **${STORY_TICKETS} tickets d'histoire par jour** (un ticket = un épisode).\n` +
            `🃏 **${Object.keys(STORY_CARDS).length} cartes Histoire exclusives** à collectionner.\n\n` +
            "*L'histoire est une fiction : ses personnages sont inventés et vos choix ne changent rien aux vraies institutions de la Maison.*"
        )
        .setImage("attachment://scene.jpg")
        .setFooter({ text: `🎟️ ${sv.tickets} ticket${sv.tickets > 1 ? "s" : ""} d'histoire aujourd'hui` }),
    ],
    files: [file],
    attachments: [],
    components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_hs_start").setLabel("Ouvrir le livre").setEmoji("📖").setStyle(ButtonStyle.Success))],
  };
}
async function storyNoTicketPayload(userId) {
  const sv = storySave(userId);
  const scene = STORY[sv.pending] ?? STORY[sv.scene] ?? STORY[STORY_START];
  const file = new AttachmentBuilder(await (await drawStoryScene({ ...scene, bg: typeof scene.bg === "function" ? "couloir" : scene.bg, title: null, who: null, prop: "bougie", mood: "brume" })).encode("jpeg", 80), { name: "scene.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x334155)
        .setTitle("🕯️ La bougie s'éteint…")
        .setDescription(
          "La nuit est trop avancée pour continuer l'enquête. Vos tickets d'histoire du jour sont épuisés.\n\n" +
            `🎟️ **${STORY_TICKETS} nouveaux tickets** arrivent chaque jour à minuit (heure de Paris).` +
            (sv.extra < STORY_EXTRA_MAX ? `\n✨ Ou rallumez la bougie : **1 ticket supplémentaire pour ${STORY_EXTRA_COST} ✨** (${STORY_EXTRA_MAX - sv.extra} possible${STORY_EXTRA_MAX - sv.extra > 1 ? "s" : ""} aujourd'hui).` : "")
        )
        .setImage("attachment://scene.jpg"),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_hs_buy").setLabel(`Ticket supplémentaire (${STORY_EXTRA_COST} ✨)`).setEmoji("🎟️").setStyle(ButtonStyle.Success).setDisabled(sv.extra >= STORY_EXTRA_MAX || (load().dust[userId] ?? 0) < STORY_EXTRA_COST),
        new ButtonBuilder().setCustomId("carte_hs_journal").setLabel("Journal d'enquête").setEmoji("📓").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
function storyJournalPayload(userId) {
  const sv = storySave(userId), rw = storyRewardsOf(userId);
  const bar = (n) => {
    const v = Math.max(-5, Math.min(5, n));
    return v >= 0 ? "▫️".repeat(5) + "🟩".repeat(v) + "▫️".repeat(5 - v) : "▫️".repeat(5 + v) + "🟥".repeat(-v) + "▫️".repeat(5);
  };
  const moral = sv.moral >= 3 ? "Intègre" : sv.moral >= 1 ? "Honnête" : sv.moral <= -3 ? "Sans scrupules" : sv.moral <= -1 ? "Ambigu" : "Neutre";
  const owned = Object.keys(STORY_CARDS).filter((id) => (load().inv[userId]?.[id] ?? 0) + (load().inv[userId]?.[`${id}*`] ?? 0) > 0).length;
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle("📓 Journal d'enquête")
        .setDescription(`Chapitres terminés : **${sv.chapters.length ? sv.chapters.map((n) => ROMAN[n]).join(", ") : "aucun"}** · choix faits : **${sv.choices}**\n⚖️ Morale : **${moral}** · 🃏 Cartes Histoire : **${owned} / ${Object.keys(STORY_CARDS).length}**`)
        .addFields(
          { name: "🤝 Réputations", value: Object.entries(STORY_FACTIONS).map(([k, [e, n]]) => `${e} ${n} ${bar(sv.rep[k] ?? 0)} **${sv.rep[k] > 0 ? "+" : ""}${sv.rep[k] ?? 0}**`).join("\n") },
          { name: "🎒 Objets", value: sv.items.map((i) => `${STORY_ITEMS[i][0]} ${STORY_ITEMS[i][1]}`).join("\n") || "*Rien pour le moment.*", inline: true },
          { name: "📝 Souvenirs", value: sv.mem.slice(-8).map((m) => `• ${m}`).join("\n").slice(0, 1000) || "*Aucun pour le moment.*", inline: true }
        )
        .setFooter({ text: `Récompenses de chapitre déjà reçues : ${Object.keys(rw.chapters).length} · 🎟️ ${sv.tickets} ticket(s)` }),
    ],
    files: [],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_hs_back").setLabel("Reprendre l'histoire").setEmoji("📖").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_hs_reset").setLabel("Recommencer depuis le début").setEmoji("🔁").setStyle(ButtonStyle.Danger).setDisabled(!sv.scene)
      ),
    ],
  };
}

// --- Avancer dans l'histoire ---
// renvoie le payload à afficher (scène suivante ou écran « plus de tickets »)
async function storyGo(userId, name, target, notes = [], opts = {}) {
  const sv = storySave(userId), scene = STORY[target];
  if (!scene) return storyScenePayload(userId, name, [...notes, "⚠️ La suite de l'histoire n'est pas encore écrite."]);
  if (scene.ep && sv.scene !== target) {
    if (sv.tickets <= 0) {
      sv.pending = target;
      save();
      return storyNoTicketPayload(userId);
    }
    sv.tickets--;
    notes.push(`🎟️ Nouvel épisode — il vous reste ${sv.tickets} ticket${sv.tickets > 1 ? "s" : ""} aujourd'hui.`);
  }
  sv.pending = null;
  sv.scene = target;
  const S = storyCtx(userId, notes, name);
  if (!sv.seen[target]) {
    sv.seen[target] = Date.now();
    scene.fx?.(S);
    if (scene.end) {
      if (!sv.chapters.includes(scene.end)) sv.chapters.push(scene.end);
      const rw = storyRewardsOf(userId), R = STORY_REWARDS[scene.end];
      if (R && !rw.chapters[scene.end]) {
        rw.chapters[scene.end] = Date.now();
        S.dust(R.dust);
        addPacks(userId, packKey(CURRENT_GEN, R.pack), 1);
        notes.push(`📦 +1 booster ${PACKS[R.pack].name} dans votre inventaire`);
        S.card(R.card);
      }
      checkAchievements(userId).catch(() => null);
    }
  }
  save();
  return storyScenePayload(userId, name, notes, opts);
}
// statistiques anonymes des grands choix
function storyStat(sceneId, idx) {
  const st = load();
  const s = (st.storyStats[sceneId] ??= {});
  s[idx] = (s[idx] ?? 0) + 1;
  const total = Object.values(s).reduce((a, b) => a + b, 0);
  return total < 5 ? "🔀 Vous êtes parmi les tout premiers à faire ce choix." : `🔀 **${Math.round((s[idx] / total) * 100)} %** des joueurs ont fait le même choix que vous.`;
}

// --- Épreuves : une de vos cartes vous aide ---
function storyCardOptions(userId, by) {
  const seen = new Set();
  return ownedKeys(userId)
    .map(([k]) => ({ k, f: fighter(k) }))
    .sort((a, b) => (by === "luck" ? b.f.luck - a.f.luck : fighterPower(b.k) - fighterPower(a.k)))
    .filter(({ k }) => {
      const id = k.replace("*", "");
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 25)
    .map(({ k, f }) => ({ label: keyLabel(k).slice(0, 100), value: k, emoji: RARITIES[f.card.rarity].emoji, description: (by === "luck" ? `Chance ${f.luck}` : `${f.maxHp} PV · attaque ${f.atk}`).slice(0, 100) }));
}
const testChance = (test, luck, holo) => Math.max(0.15, Math.min(0.92, (luck - test.diff + 55) / 100 + (holo ? 0.05 : 0)));
function storyPickPayload(userId, scene, c, kind) {
  const options = storyCardOptions(userId, kind === "test" ? "luck" : "power");
  const info = kind === "test" ? c.test : c.duel;
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(kind === "test" ? 0xf59e0b : 0xef4444)
        .setTitle(kind === "test" ? `🎲 Épreuve : ${info.label}` : `⚔️ Duel : ${STORY_CAST[info.boss.who].name}`)
        .setDescription(
          kind === "test"
            ? `${info.desc ?? ""}\n\nChoisissez **la carte qui vous aide** : plus sa **chance** est élevée, plus vous avez de chances de réussir (difficulté **${info.diff}**). Une carte holo donne un petit bonus.`
            : `${info.desc ?? ""}\n\nChoisissez **la carte qui se bat avec vous**. Ses PV et son attaque comptent. À chaque manche : ⚔️ Attaque, 🛡️ Garde ou 🌀 Ruse.\n*La Garde bat l'Attaque, l'Attaque interrompt la Ruse, la Ruse brise la Garde.* Observez votre adversaire : il trahit souvent son prochain coup…`
        ),
    ],
    files: [],
    attachments: [],
    components: options.length
      ? [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`carte_hs_${kind === "test" ? "t" : "d"}_${scene.id}_${c.i}`).setPlaceholder(kind === "test" ? "Choisir la carte qui vous aide…" : "Choisir la carte qui se bat…").addOptions(options))]
      : [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`carte_hs_${kind === "test" ? "t" : "d"}_${scene.id}_${c.i}`).setLabel("Y aller sans carte").setStyle(ButtonStyle.Secondary))],
  };
}

// --- Duels ---
const storyDuels = new Map(); // userId -> duel en cours
const DUEL_ACTIONS = { attack: ["⚔️", "Attaque"], guard: ["🛡️", "Garde"], ruse: ["🌀", "Ruse"] };
function duelNextBoss(d) {
  const pattern = d.boss.pattern;
  d.bossNext = pattern[(d.round - 1) % pattern.length];
  if (Math.random() < 0.2) d.bossNext = ["attack", "guard", "ruse"][Math.floor(Math.random() * 3)];
  // l'indice est juste 3 fois sur 4
  d.tell = Math.random() < 0.75 ? d.bossNext : ["attack", "guard", "ruse"].filter((a) => a !== d.bossNext)[Math.floor(Math.random() * 2)];
}
function duelResolve(d, me) {
  const boss = d.boss.who, b = d.bossNext, myDmg = Math.round(10 + d.card.atk * 0.5), hisDmg = d.boss.atk;
  const N = STORY_CAST[boss].name;
  let toBoss = 0, toMe = 0, text;
  if (me === b) {
    if (me === "guard") text = "Vous vous observez, chacun sur ses gardes. Personne ne frappe.";
    else {
      toBoss = myDmg;
      toMe = hisDmg;
      text = me === "attack" ? "Vous frappez en même temps : le choc est violent des deux côtés !" : "Deux ruses se croisent : chacun tombe dans le piège de l'autre !";
    }
  } else if (me === "attack" && b === "guard") {
    toMe = Math.round(hisDmg * 0.4);
    text = `${N} pare votre attaque et riposte sèchement.`;
  } else if (me === "attack" && b === "ruse") {
    toBoss = Math.round(myDmg * 1.25);
    text = `Vous interrompez la ruse de ${N} d'un coup net !`;
  } else if (me === "guard" && b === "attack") {
    toBoss = Math.round(myDmg * 0.4);
    text = `Vous parez l'attaque de ${N} et contre-attaquez !`;
  } else if (me === "guard" && b === "ruse") {
    toMe = Math.round(hisDmg * 1.4);
    text = `${N} contourne votre garde : la ruse fait mouche…`;
  } else if (me === "ruse" && b === "guard") {
    toBoss = Math.round(myDmg * 1.4);
    text = `Votre ruse brise la garde de ${N} !`;
  } else {
    toMe = Math.round(hisDmg * 1.25);
    text = `${N} vous prend de vitesse avant que votre ruse ne fonctionne.`;
  }
  d.hp = Math.max(0, d.hp - toMe);
  d.bossHp = Math.max(0, d.bossHp - toBoss);
  d.last = `${DUEL_ACTIONS[me][0]} Vous : **${DUEL_ACTIONS[me][1]}** · ${DUEL_ACTIONS[b][0]} ${N} : **${DUEL_ACTIONS[b][1]}**\n${text}${toBoss ? ` (−${toBoss} PV pour ${N})` : ""}${toMe ? ` (−${toMe} PV pour vous)` : ""}`;
}
async function storyDuelPayload(userId) {
  const d = storyDuels.get(userId), scene = STORY[d.sceneId];
  const file = new AttachmentBuilder(await (await drawStoryDuel(scene, { ...d, card: { card: d.card.card, key: d.card.key } })).encode("jpeg", 86), { name: "duel.jpg" });
  const tells = d.boss.tells;
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0xef4444)
        .setTitle(`⚔️ Duel contre ${STORY_CAST[d.boss.who].name} — manche ${d.round}`)
        .setDescription(`${d.last ? `${d.last}\n\n` : ""}👁️ *${tells[d.tell]}*\n\n**Que faites-vous ?**`)
        .setImage("attachment://duel.jpg")
        .setFooter({ text: "La Garde bat l'Attaque · l'Attaque interrompt la Ruse · la Ruse brise la Garde" }),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        Object.entries(DUEL_ACTIONS).map(([k, [e, l]]) => new ButtonBuilder().setCustomId(`carte_hs_da_${k}`).setLabel(l).setEmoji(e).setStyle(k === "attack" ? ButtonStyle.Danger : k === "guard" ? ButtonStyle.Primary : ButtonStyle.Success))
      ),
    ],
  };
}

// --- Le salon du Mode Histoire ---
async function refreshStoryPanel() {
  const ch = chan("histoire");
  if (!ch || ch === channelRef) return;
  const st = load();
  const saves = Object.values(st.story ?? {});
  const done = (n) => saves.filter((sv) => sv.chapters?.includes(n)).length;
  const last = Math.max(...Object.keys(STORY_CHAPTERS).map(Number));
  const file = new AttachmentBuilder(await (await drawStoryCover()).encode("jpeg", 86), { name: "histoire.jpg" });
  const payload = {
    embeds: [
      new EmbedBuilder()
        .setColor(0xe9c46a)
        .setTitle("📖 Les Secrets de la Maison")
        .setDescription(
          "*Paris, une nuit de pluie. La Maison vous ouvre ses portes — une lettre signée du Fondateur. Le soir même, il disparaît. Il ne reste qu'un jeu de cartes… et vous.*\n\n" +
            "🔀 **Vos choix changent l'histoire** : alliés, ennemis, secrets, fins différentes.\n" +
            "🎲 **Épreuves** avec vos cartes · ⚔️ **Duels** · 🧩 **Énigmes** cachées dans le texte\n" +
            `🎟️ **${STORY_TICKETS} épisodes par jour** · 🃏 **${Object.keys(STORY_CARDS).length} cartes exclusives** à collectionner\n\n` +
            Object.entries(STORY_CHAPTERS).map(([n, c]) => `**Chapitre ${ROMAN[n]}** — ${c.title} · ${done(Number(n))} enquêteur${done(Number(n)) > 1 ? "s l'ont" : " l'a"} terminé`).join("\n") +
            `\n*Chapitre ${ROMAN[last + 1]} : bientôt…*\n\n` +
            "Votre lecture est **privée** : vous seul voyez votre livre. *C'est une fiction : ses personnages sont inventés et vos choix ne changent rien aux vraies institutions de la Maison.*"
        )
        .setImage("attachment://histoire.jpg")
        .setFooter({ text: `👥 ${saves.filter((sv) => sv.scene).length} enquêteurs ont ouvert le livre` }),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_hs").setLabel("Ouvrir le livre").setEmoji("📖").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_hs_help").setLabel("Comment ça marche").setEmoji("❔").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
  let msg = st.storyMessageId ? await ch.messages.fetch(st.storyMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit(payload).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.storyMessageId = msg.id;
      save();
    }
  }
}

// --- Interactions ---
async function handleStoryInteraction(interaction, client) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "histoire";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("carte_hs"))) return false;
  const userId = interaction.user.id, name = interaction.member?.displayName ?? interaction.user.username;
  load();
  const sv = storySave(userId);
  // rendu long (images) : on accuse réception tout de suite
  const show = async (payloadPromise, fresh = false) => {
    if (fresh || isCmd || id === "carte_hs") {
      if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
    } else if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    const payload = await payloadPromise;
    delete payload.ephemeral;
    await interaction.editReply(payload);
  };
  if (isCmd || id === "carte_hs") {
    await show(sv.pending ? storyNoTicketPayload(userId) : sv.scene ? storyScenePayload(userId, name) : storyCoverPayload(userId), true);
    return true;
  }
  if (id === "carte_hs_help") {
    await interaction.reply({ ephemeral: true, embeds: [new EmbedBuilder().setColor(0xe9c46a).setTitle("❔ Le Mode Histoire").setDescription(cardsGuideTopics().find(([k]) => k === "histoire")?.[3] ?? "")] });
    return true;
  }
  if (id === "carte_hs_start") {
    await show(sv.scene ? storyScenePayload(userId, name) : storyGo(userId, name, STORY_START));
    return true;
  }
  if (id === "carte_hs_journal") {
    await interaction.update(noEph(storyJournalPayload(userId)));
    return true;
  }
  if (id === "carte_hs_back") {
    await show(sv.pending ? storyNoTicketPayload(userId) : sv.scene ? storyScenePayload(userId, name) : storyCoverPayload(userId));
    return true;
  }
  if (id === "carte_hs_reset") {
    await interaction.update({
      content: "🔁 Recommencer l'histoire depuis le début ? Vos choix, objets et réputations seront effacés. **Les cartes et récompenses déjà reçues restent à vous** (elles ne seront pas redonnées).",
      embeds: [],
      files: [],
      attachments: [],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_hs_reset_ok").setLabel("Oui, recommencer").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId("carte_hs_journal").setLabel("Non").setStyle(ButtonStyle.Secondary))],
    });
    return true;
  }
  if (id === "carte_hs_reset_ok") {
    const tickets = sv.tickets, extra = sv.extra;
    delete load().story[userId];
    const fresh = storySave(userId);
    fresh.tickets = tickets;
    fresh.extra = extra;
    save();
    storyDuels.delete(userId);
    await show(storyCoverPayload(userId));
    return true;
  }
  if (id === "carte_hs_buy") {
    if (sv.extra >= STORY_EXTRA_MAX || (load().dust[userId] ?? 0) < STORY_EXTRA_COST) {
      await interaction.reply({ content: `❌ Il faut ${STORY_EXTRA_COST} ✨ (et ${STORY_EXTRA_MAX} tickets supplémentaires au plus par jour).`, ephemeral: true });
      return true;
    }
    load().dust[userId] -= STORY_EXTRA_COST;
    sv.extra++;
    sv.tickets++;
    save();
    await show(sv.pending ? storyGo(userId, name, sv.pending, [`🕯️ Vous rallumez la bougie (−${STORY_EXTRA_COST} ✨).`]) : storyScenePayload(userId, name));
    return true;
  }
  // choix d'une scène
  const ch = /^carte_hs_c_(\w+)_(\d+)$/.exec(id);
  if (ch) {
    const [, sceneId, idxText] = ch, scene = STORY[sceneId];
    if (!scene || sv.scene !== sceneId) {
      await show(sv.pending ? storyNoTicketPayload(userId) : storyScenePayload(userId, name, ["⏩ Cette page est déjà tournée : voici où vous en êtes."]));
      return true;
    }
    const notes = [], S = storyCtx(userId, notes, name);
    const c = { ...sceneChoices(scene, S)[Number(idxText)], i: Number(idxText) };
    if (!c.label || !choiceVisible(c, S) || choiceLocked(c, S)) {
      await interaction.reply({ content: "🔒 Ce choix n'est pas possible pour vous.", ephemeral: true });
      return true;
    }
    if (c.cost) {
      if ((load().dust[userId] ?? 0) < c.cost) {
        await interaction.reply({ content: `❌ Il vous faut ${c.cost} ✨.`, ephemeral: true });
        return true;
      }
      load().dust[userId] -= c.cost;
      notes.push(`✨ −${c.cost} poussière d'étoile`);
    }
    if (c.test || c.duel) {
      await interaction.update(noEph(storyPickPayload(userId, scene, c, c.test ? "test" : "duel")));
      return true;
    }
    if (c.riddle) {
      await interaction.showModal(
        new ModalBuilder()
          .setCustomId(`carte_hs_r_${scene.id}_${c.i}`)
          .setTitle("🧩 Énigme")
          .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("answer").setLabel(c.riddle.q.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40).setPlaceholder(c.riddle.placeholder ?? "Votre réponse…")))
      );
      return true;
    }
    sv.choices++;
    if (c.stat) notes.push(storyStat(scene.id, c.i));
    c.fx?.(S);
    await show(storyGo(userId, name, typeof c.to === "function" ? c.to(S) : c.to, notes));
    return true;
  }
  // épreuve : carte choisie
  const tm = /^carte_hs_t_(\w+)_(\d+)$/.exec(id);
  if (tm) {
    const [, sceneId, idxText] = tm, scene = STORY[sceneId];
    if (!scene || sv.scene !== sceneId) {
      await show(storyScenePayload(userId, name));
      return true;
    }
    const notes = [], S = storyCtx(userId, notes, name);
    const c = sceneChoices(scene, S)[Number(idxText)];
    const key = interaction.values?.[0];
    const f = key && (load().inv[userId]?.[key] ?? 0) > 0 ? fighter(key) : null;
    const p = testChance(c.test, f?.luck ?? 20, key ? isHoloKey(key) : false), ok = Math.random() < p;
    sv.choices++;
    notes.push(`🎲 **${c.test.label}** avec ${f ? `**${f.name}**` : "vos seules mains"} — ${Math.round(p * 100)} % de chances : **${ok ? "réussite !" : "échec…"}**`);
    c.fx?.(S);
    (ok ? c.test.okFx : c.test.koFx)?.(S);
    await show(storyGo(userId, name, ok ? c.test.ok : c.test.ko, notes, { banner: ok ? ["RÉUSSITE", "#16a34a"] : ["ÉCHEC", "#dc2626"] }));
    return true;
  }
  // duel : carte choisie, puis manches
  const dm = /^carte_hs_d_(\w+)_(\d+)$/.exec(id);
  if (dm) {
    const [, sceneId, idxText] = dm, scene = STORY[sceneId];
    if (!scene || sv.scene !== sceneId) {
      await show(storyScenePayload(userId, name));
      return true;
    }
    const S = storyCtx(userId, [], name), c = sceneChoices(scene, S)[Number(idxText)];
    const key = interaction.values?.[0];
    const f = key && (load().inv[userId]?.[key] ?? 0) > 0 ? fighter(key) : { name: "Vos poings", maxHp: 90, atk: 20, card: { name: "Vos poings", rarity: "commune", id: "x" }, key: "" };
    const d = { sceneId, idx: Number(idxText), boss: c.duel.boss, ok: c.duel.ok, ko: c.duel.ko, card: { ...f, key: key ?? "" }, hp: f.maxHp, maxHp: f.maxHp, bossHp: c.duel.boss.hp, round: 1, last: null };
    if (!key) d.card.card = findCard("p_pigeon") ?? Object.values(STORY_CARDS)[0];
    duelNextBoss(d);
    storyDuels.set(userId, d);
    await show(storyDuelPayload(userId));
    return true;
  }
  const da = /^carte_hs_da_(attack|guard|ruse)$/.exec(id);
  if (da) {
    const d = storyDuels.get(userId);
    if (!d || sv.scene !== d.sceneId) {
      await show(storyScenePayload(userId, name, ["⏩ Ce duel est terminé."]));
      return true;
    }
    duelResolve(d, da[1]);
    const over = d.hp <= 0 || d.bossHp <= 0 || d.round >= 8;
    if (!over) {
      d.round++;
      duelNextBoss(d);
      await show(storyDuelPayload(userId));
      return true;
    }
    storyDuels.delete(userId);
    const win = d.bossHp <= 0 || (d.hp > 0 && d.hp / d.maxHp >= d.bossHp / d.boss.hp);
    sv.choices++;
    const notes = [`⚔️ ${d.last}`, `⚔️ **${win ? "Victoire" : "Défaite"}** contre ${STORY_CAST[d.boss.who].name} en ${d.round} manche${d.round > 1 ? "s" : ""}.`];
    const scene = STORY[d.sceneId], S = storyCtx(userId, notes, name), c = sceneChoices(scene, S)[d.idx];
    c.fx?.(S);
    (win ? c.duel.okFx : c.duel.koFx)?.(S);
    await show(storyGo(userId, name, win ? d.ok : d.ko, notes, { banner: win ? ["VICTOIRE", "#16a34a"] : ["DÉFAITE", "#dc2626"] }));
    return true;
  }
  // énigme : réponse
  const rm = /^carte_hs_r_(\w+)_(\d+)$/.exec(id);
  if (rm) {
    const [, sceneId, idxText] = rm, scene = STORY[sceneId];
    if (!scene || sv.scene !== sceneId) {
      await show(storyScenePayload(userId, name));
      return true;
    }
    const notes = [], S = storyCtx(userId, notes, name), c = sceneChoices(scene, S)[Number(idxText)];
    const norm = (t) => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
    const answer = norm(interaction.fields.getTextInputValue("answer"));
    const tries = (sv.riddles[sceneId] = (sv.riddles[sceneId] ?? 0) + 1);
    if (c.riddle.answers.some((a) => norm(a) === answer)) {
      sv.choices++;
      notes.push(`🧩 « ${interaction.fields.getTextInputValue("answer").slice(0, 40)} »… **c'est la bonne réponse !**`);
      c.riddle.okFx?.(S);
      await show(storyGo(userId, name, c.riddle.ok, notes, { banner: ["RÉSOLU", "#16a34a"] }));
      return true;
    }
    if (tries >= 3) {
      sv.choices++;
      notes.push("🧩 Trois essais, trois échecs… il va falloir trouver une autre solution.");
      c.riddle.koFx?.(S);
      await show(storyGo(userId, name, c.riddle.ko, notes, { banner: ["ÉCHEC", "#dc2626"] }));
      return true;
    }
    save();
    await show(storyScenePayload(userId, name, [`🧩 Ce n'est pas ça… (essai ${tries}/3)${tries >= 2 && c.riddle.hint ? `\n> 💡 *${c.riddle.hint}*` : ""}`]));
    return true;
  }
  return false;
}
