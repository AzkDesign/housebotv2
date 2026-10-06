// Catégorie « 📖 Guide de la Maison » : des salons en lecture seule pour que chacun s'y retrouve.
// Le plan du serveur et la liste des commandes se mettent à jour tout seuls ; les autres guides
// ne sont republiés que lorsque leur contenu change.
const fs = require("fs");
const crypto = require("crypto");
const { ChannelType, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const { findOrCreateChannel } = require("./salons");

const STATE_FILE = require("./data").dataFile("guide-state.json");
const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // sert à retrouver le serveur
const RULES_ACCEPTED_ROLE_ID = "1509975426179797012"; // membres ayant accepté le règlement (voir index.js)
const WELCOME_ROLE_ID = "1509970096821375128"; // nouveaux arrivants, avant le règlement
const RULES_CHANNEL_ID = "1509974903552737333";
const LINKS = {
  annonces: "1509983723892903966",
  tickets: "1509976660966117537",
  boutique: "1510771583348641902",
  niveau: "1510693589070647416",
  missions: "1511131616406147172",
  credit: "1511135082927100104",
  casino: "1527054335928827954",
  airbnb: "1527544352090357881",
  chambres: "1509983864624386048",
  hierarchie: "1509983829744681101",
  repas: "1509983930294472817",
  fortunes: "1510702663535296623",
};
const CATEGORY_NAME = "📖 Guide de la Maison";
const CHANNELS = [
  ["plan", "🧭・plan-du-serveur", "📖 Guide — tous les salons, rangés par catégorie (mis à jour automatiquement)"],
  ["debuter", "👋・bien-débuter", "📖 Guide — les premiers pas dans la Maison"],
  ["commandes", "⌨️・commandes", "📖 Guide — toutes les commandes du bot et les panneaux à boutons"],
  ["economie", "💶・économie-et-métiers", "📖 Guide — argent, missions, entreprises, logement, casino"],
  ["citoyen", "🏛️・vie-citoyenne", "📖 Guide — mairie, lois, associations, Membre Star, niveaux"],
  ["cartes", "🃏・guide-des-cartes", "📖 Guide — tout sur les Cartes de la Maison"],
  ["faq", "❓・questions-fréquentes", "📖 Guide — les réponses aux questions les plus courantes"],
];
const COLOR = 0x8b0000;

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.channels ??= {};
  state.messages ??= {};
  state.hashes ??= {};
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const link = (key) => `<#${LINKS[key]}>`;
const embed = (title, description) => new EmbedBuilder().setColor(COLOR).setTitle(title).setDescription(description);

// --- Contenus ---
function debuterPayloads(channels) {
  return [
    {
      embeds: [
        embed(
          "👋 Bienvenue dans la Maison !",
          "Ce guide vous accompagne pas à pas. Prenez deux minutes pour le lire : tout le reste deviendra simple.\n\n" +
            `**1. Le règlement** — lisez-le et acceptez-le dans <#${RULES_CHANNEL_ID}> : c'est ce qui ouvre le reste du serveur.\n` +
            `**2. Le plan** — ${channels.plan ? `<#${channels.plan}>` : "le salon du plan"} liste tous les salons, rangés par catégorie. Cliquez sur un nom pour y aller.\n` +
            `**3. Votre identité** — tapez \`/profil\` pour voir votre carte d'identité de la Maison (logement, travail, fortune, activité…).\n` +
            `**4. Les nouvelles** — suivez ${link("annonces")} : annonces, météo du matin et résumé du soir.\n` +
            `**5. Une question ?** — ouvrez un ticket dans ${link("tickets")} (question, candidature, signalement…).`
        ),
        embed(
          "🧭 Par où commencer ?",
          `💶 **Gagner de l'argent** : prenez une mission dans ${link("missions")}, travaillez pour une entreprise, ou créez la vôtre. Détails dans ${channels.economie ? `<#${channels.economie}>` : "le guide de l'économie"}.\n` +
            `🏠 **Se loger** : les chambres de la Maison se gèrent dans ${link("chambres")}.\n` +
            `🃏 **Jouer** : collectionnez les Cartes de la Maison, combattez dans l'Arène — tout est expliqué dans ${channels.cartes ? `<#${channels.cartes}>` : "le guide des cartes"}.\n` +
            `🏛️ **Participer** : votez aux élections, proposez des lois, rejoignez une association — voir ${channels.citoyen ? `<#${channels.citoyen}>` : "le guide de la vie citoyenne"}.\n` +
            `📊 **Progresser** : votre activité vous fait monter de niveau (\`/niveau\`, ${link("niveau")}).\n\n` +
            "🤝 *Respect, entraide et bonne humeur : c'est l'esprit de la Maison. En cas de problème avec un membre, \`/report\` permet un signalement anonyme.*"
        ),
      ],
    },
  ];
}
function economiePayloads() {
  return [
    {
      embeds: [
        embed("💶 L'économie de la Maison", "Chaque membre a un compte en euros. Voici comment le faire grandir… et le protéger.")
          .addFields(
            { name: "💰 Votre argent", value: `\`/solde\` affiche votre compte. Le classement des plus grandes fortunes est dans ${link("fortunes")}. Toutes les opérations sont enregistrées ; l'**IRF** peut geler un compte en cas de fraude.` },
            { name: "📋 Missions intérim", value: `Des missions rémunérées sont publiées dans ${link("missions")}. Acceptez-en une, réalisez-la, et touchez votre paie. \`/mission\` sert à en suivre ou en publier.` },
            { name: "🏢 Entreprises", value: "Créez votre entreprise en l'immatriculant au **Registre du commerce** (catégorie 🏛️ Entreprises). Recrutez des salariés grâce aux offres d'emploi, servez vos clients, et suivez votre chiffre d'affaires. Les annonces de recrutement et les factures ont leurs propres salons." },
            { name: "🧾 Impôts", value: "Les revenus sont imposés selon les taux fixés par la Mairie. Une dette fiscale non payée peut entraîner une saisie : surveillez le **centre des impôts**." },
            { name: "💳 Crédit et achats", value: `Besoin d'un coup de pouce ? Demandez un crédit avec \`/crédit\` (suivi dans ${link("credit")}). Pour acheter ou vendre en sécurité entre membres, passez par la **boutique** et son système d'intermédiaire : ${link("boutique")} et \`/achat\`.` },
            { name: "🏠 Logement et Airbnb", value: `Les chambres de la Maison se gèrent dans ${link("chambres")} (déménagements, maisons, suites, penthouses). Les propriétaires peuvent louer leurs biens aux voyageurs via l'**Airbnb** (${link("airbnb")}).` },
            { name: "🎰 Casino", value: `Le casino (${link("casino")}) est réservé aux membres qui y ont accès (demande d'accès, licence). Blackjack, roulette, défis… avec des mises plafonnées. Il peut être fermé par un couvre-feu décidé par le régime en place.` }
          )
          .setFooter({ text: "Jouez avec modération : l'argent perdu ne revient pas !" }),
      ],
    },
  ];
}
function citoyenPayloads() {
  return [
    {
      embeds: [
        embed("🏛️ La vie citoyenne", "La Maison est une petite société : elle a un maire, des lois, des associations et ses célébrités.")
          .addFields(
            { name: "👑 La Mairie", value: "Un **maire** est élu par les membres (catégorie 🏛️ Mairie : élections, journal officiel). Il fixe les taux (impôts, entreprises, casino…) et choisit un **régime** — démocratie, monarchie ou dictature — qui change les règles du jeu. Les membres peuvent lancer un **référendum de destitution**." },
            { name: "📜 Les lois", value: "Le **Code de la Maison** rassemble les lois en vigueur. Les lois naissent de **projets de loi** votés par les membres, d'**édits** ou de **décrets**, et même d'**initiatives citoyennes** (pétitions). Elles ont des effets réels : soldes sur les boosters, fermeture du casino, prime de bienvenue…" },
            { name: "🤝 Les associations", value: "Créées par la Mairie et confiées à un président, elles ont leur propre catégorie, leurs salons, leur rôle et leur caisse. Le salon **vie associative** les présente." },
            { name: "⭐ Membre Star", value: "Chaque semaine, la Fondation élit un **Membre Star** : prime, titre sur la carte d'identité, rôle dont la couleur évolue… et une carte spéciale dans les Cartes de la Maison." },
            { name: "📊 Niveaux et hiérarchie", value: `Votre activité vous fait gagner des niveaux (\`/niveau\`, ${link("niveau")}). La **hiérarchie** du serveur est affichée dans ${link("hierarchie")}.` },
            { name: "🍽️ Au quotidien", value: `Le **repas du jour** est annoncé dans ${link("repas")}. Chaque matin, un message donne la météo de Paris et le programme ; chaque soir, un résumé de la journée.` }
          ),
      ],
    },
  ];
}
function cartesPayloads(topics) {
  const embeds = topics.map(([, label, emoji, text]) => embed(`${emoji} ${label}`, text).setColor(0xe9c46a));
  return [{ embeds: embeds.slice(0, 5) }, { embeds: embeds.slice(5, 10) }].filter((p) => p.embeds.length);
}
function faqPayloads(channels) {
  const qa = [
    ["Je ne vois presque aucun salon, c'est normal ?", `Oui, tant que vous n'avez pas accepté le règlement dans <#${RULES_CHANNEL_ID}>. Ensuite, tout s'ouvre. Certains espaces dépendent aussi de vos rôles (Jeunes, Entrepreneurs, accès casino…).`],
    ["Comment gagner mes premiers euros ?", `Le plus simple : une mission dans ${link("missions")}. Ensuite, trouvez un emploi dans une entreprise (salon recrutement) ou créez la vôtre.`],
    ["Où sont passées mes commandes ?", `Tapez \`/\` dans n'importe quel salon : la liste s'affiche. Elles sont toutes expliquées dans ${channels.commandes ? `<#${channels.commandes}>` : "le salon des commandes"}.`],
    ["Comment ouvrir mes boosters de cartes ?", "Tapez `/inventaire`, puis choisissez un booster dans le menu. Votre pack de bienvenue y est déjà !"],
    ["Mon compte est gelé, que faire ?", "Un gel est décidé par l'IRF. Ouvrez un ticket pour comprendre pourquoi et régulariser votre situation."],
    ["Un membre me manque de respect.", "Utilisez `/report` : le signalement est anonyme et traité par le staff. Pour une situation urgente, ouvrez un ticket."],
    ["Je veux rejoindre l'équipe / postuler.", `Ouvrez un ticket **candidature** dans ${link("tickets")} : le questionnaire vous guide pas à pas.`],
    ["Le bot ne répond pas à un bouton.", "Réessayez dans quelques secondes (le bot redémarre parfois lors des mises à jour). Si le problème persiste, ouvrez un ticket."],
  ];
  return [{ embeds: [embed("❓ Questions fréquentes", qa.map(([q, a]) => `**${q}**\n${a}`).join("\n\n"))] }];
}

// Plan du serveur : tous les salons visibles par les membres, rangés par catégorie
const VISIBLE_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum, ChannelType.GuildVoice, ChannelType.GuildStageVoice];
function planPayloads(guild) {
  const role = guild.roles.cache.get(RULES_ACCEPTED_ROLE_ID) ?? guild.roles.everyone;
  const visible = (c) => VISIBLE_TYPES.includes(c.type) && c.permissionsFor(role)?.has(PermissionFlagsBits.ViewChannel);
  const isVoice = (c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice;
  const line = (c) => {
    const topic = c.topic && !/^(entreprise|privé|candidature):|^\d+$/.test(c.topic) ? ` — ${c.topic.replace(/\s+/g, " ").slice(0, 90)}` : "";
    return `${isVoice(c) ? "🔊 " : ""}<#${c.id}>${topic}`;
  };
  const sortCh = (a, b) => (isVoice(a) - isVoice(b)) || a.rawPosition - b.rawPosition;
  const all = [...guild.channels.cache.values()];
  const embeds = [];
  const loose = all.filter((c) => !c.parentId && visible(c)).sort(sortCh);
  if (loose.length) embeds.push(new EmbedBuilder().setColor(COLOR).setTitle("📌 Hors catégorie").setDescription(loose.map(line).join("\n").slice(0, 4000)));
  const categories = all.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.rawPosition - b.rawPosition);
  for (const cat of categories) {
    const children = all.filter((c) => c.parentId === cat.id && visible(c)).sort(sortCh);
    if (!children.length) continue;
    embeds.push(new EmbedBuilder().setColor(COLOR).setTitle(cat.name).setDescription(children.map(line).join("\n").slice(0, 4000)));
  }
  const intro = new EmbedBuilder()
    .setColor(COLOR)
    .setTitle("🧭 Plan du serveur")
    .setDescription(
      "Voici tous les salons ouverts aux membres, rangés par catégorie. **Cliquez sur un nom pour y aller.**\n" +
        "Selon vos rôles (Jeunes, Entrepreneurs, accès casino, entreprise, association…), vous pouvez voir d'autres salons en plus.\n\n" +
        `*Ce plan se met à jour tout seul quand des salons sont ajoutés ou modifiés — dernière mise à jour <t:${Math.floor(Date.now() / 86400000) * 86400}:D>.*`
    );
  // messages de 10 encadrés au plus et 5 800 caractères au plus
  const payloads = [];
  let current = [intro], size = intro.data.description.length;
  for (const e of embeds) {
    const len = (e.data.title?.length ?? 0) + (e.data.description?.length ?? 0);
    if (current.length >= 10 || size + len > 5800) {
      payloads.push({ embeds: current });
      current = [];
      size = 0;
    }
    current.push(e);
    size += len;
  }
  if (current.length) payloads.push({ embeds: current });
  return payloads;
}

// Commandes : lues directement sur Discord, donc toujours à jour
const COMMAND_GROUPS = [
  ["🃏 Cartes de la Maison", ["inventaire", "album", "codex", "histoire", "clash", "tournoi", "succes", "vitrine", "equipe", "iles", "quetes", "marche", "echange", "combat", "invite", "arene", "aide-cartes"]],
  ["💶 Économie", ["solde", "deposit", "crédit", "achat", "mission"]],
  ["🤝 Communauté", ["profil", "niveau", "report"]],
  ["🛡️ Staff", ["argent", "clear", "carte-offrir", "generation"]],
];
async function commandesPayloads(guild) {
  const cmds = await guild.commands.fetch().catch(() => null);
  const list = cmds ? [...cmds.values()] : [];
  const used = new Set();
  const fields = [];
  for (const [title, names] of COMMAND_GROUPS) {
    const items = names.map((n) => list.find((c) => c.name === n)).filter(Boolean);
    items.forEach((c) => used.add(c.name));
    if (items.length) fields.push({ name: title, value: items.map((c) => `</${c.name}:${c.id}> — ${c.description}`).join("\n").slice(0, 1024) });
  }
  const others = list.filter((c) => !used.has(c.name));
  if (others.length) fields.push({ name: "🔧 Autres", value: others.map((c) => `</${c.name}:${c.id}> — ${c.description}`).join("\n").slice(0, 1024) });
  return [
    {
      embeds: [
        embed("⌨️ Les commandes du bot", "Tapez `/` dans n'importe quel salon pour les voir, ou **cliquez directement sur une commande** ci-dessous.").addFields(fields.length ? fields : [{ name: "—", value: "Les commandes se chargent…" }]),
        embed(
          "🔘 Les panneaux à boutons",
          "Beaucoup de choses se font sans commande, avec les boutons des panneaux :\n\n" +
            `🎫 **Tickets** (questions, candidature, signalement) — ${link("tickets")}\n` +
            `📋 **Missions intérim** — ${link("missions")}\n` +
            `🛍️ **Boutique** (achats avec intermédiaire) — ${link("boutique")}\n` +
            `💳 **Crédits** — ${link("credit")}\n` +
            `🏠 **Chambres et déménagements** — ${link("chambres")}\n` +
            `🏡 **Airbnb** — ${link("airbnb")}\n` +
            `🎰 **Casino** (si vous y avez accès) — ${link("casino")}\n` +
            `📊 **Niveaux** — ${link("niveau")}\n` +
            "🃏 **Cartes de la Maison** — dans le salon des cartes, à côté des annonces"
        ),
      ],
    },
  ];
}

// --- Publication : on ne republie que ce qui a changé ---
async function publish(channel, key, payloads) {
  const st = load();
  const hash = crypto.createHash("sha1").update(JSON.stringify(payloads.map((p) => p.embeds.map((e) => e.toJSON())))).digest("hex");
  const ids = st.messages[key] ?? [];
  const existing = [];
  for (const id of ids) existing.push(await channel.messages.fetch(id).catch(() => null));
  if (st.hashes[key] === hash && existing.length === payloads.length && existing.every(Boolean)) return;
  if (existing.length === payloads.length && existing.every(Boolean)) {
    for (const [i, msg] of existing.entries()) await msg.edit(payloads[i]).catch(() => null);
  } else {
    for (const msg of existing) await msg?.delete().catch(() => null);
    st.messages[key] = [];
    for (const p of payloads) {
      const msg = await channel.send(p).catch(() => null);
      if (msg) st.messages[key].push(msg.id);
    }
  }
  st.hashes[key] = hash;
  save();
}

let guildRef = null, channelsRef = {}, refreshTimer = null;
async function ensureChannels(client) {
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return null;
  const st = load();
  // lecture seule : visible par les membres ayant accepté le règlement, personne ne peut écrire sauf le bot
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions] },
    { id: WELCOME_ROLE_ID, deny: [PermissionFlagsBits.ViewChannel] },
    { id: RULES_ACCEPTED_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
  ].filter((o) => o.id === guild.roles.everyone.id || o.id === client.user.id || guild.roles.cache.has(o.id));
  const category = await findOrCreateChannel(guild, { id: st.categoryId, name: CATEGORY_NAME, type: ChannelType.GuildCategory, permissionOverwrites: overwrites });
  st.categoryId = category.id;
  // juste sous la catégorie du règlement, pour être vue tout de suite
  const rules = guild.channels.cache.get(RULES_CHANNEL_ID);
  const rulesCat = rules?.parent;
  if (rulesCat && category.rawPosition !== rulesCat.rawPosition + 1) await category.setPosition(rulesCat.rawPosition + 1).catch(() => null);
  for (const [i, [key, name, topic]] of CHANNELS.entries()) {
    const ch = await findOrCreateChannel(guild, { id: st.channels[key], name, parent: category.id, permissionOverwrites: overwrites });
    st.channels[key] = ch.id;
    if (ch.topic !== topic) await ch.setTopic(topic).catch(() => null);
    if (ch.position !== i) await ch.setPosition(i).catch(() => null);
    channelsRef[key] = ch;
  }
  save();
  guildRef = guild;
  return guild;
}
async function refreshAll(client) {
  if (!guildRef) return;
  const ids = load().channels;
  let topics = [];
  try {
    topics = require("./cartes").cardsGuideTopics();
  } catch {
    // module des cartes indisponible
  }
  const jobs = [
    ["plan", () => planPayloads(guildRef)],
    ["debuter", () => debuterPayloads(ids)],
    ["commandes", () => commandesPayloads(guildRef)],
    ["economie", () => economiePayloads()],
    ["citoyen", () => citoyenPayloads()],
    ["cartes", () => (topics.length ? cartesPayloads(topics) : null)],
    ["faq", () => faqPayloads(ids)],
  ];
  for (const [key, build] of jobs) {
    const ch = channelsRef[key];
    const payloads = await build();
    if (ch && payloads?.length) await publish(ch, key, payloads).catch((err) => console.error(`Guide (${key}):`, err.message));
  }
}
// le plan suit les changements de salons (regroupés sur deux minutes)
function scheduleRefresh(client) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refreshAll(client).catch(() => null), 2 * 60 * 1000);
}

async function setupGuide(client) {
  const guild = await ensureChannels(client);
  if (!guild) return;
  await refreshAll(client);
  for (const ev of ["channelCreate", "channelDelete", "channelUpdate"]) {
    client.on(ev, (ch) => {
      if (ch.guild?.id === guild.id) scheduleRefresh(client);
    });
  }
  setInterval(() => refreshAll(client).catch((err) => console.error("Guide:", err.message)), 6 * 60 * 60 * 1000);
  console.log("Guide de la Maison prêt");
}

module.exports = { setupGuide };
