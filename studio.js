// Studio 🔞 (jeu de rôle entre adultes) : une catégorie réservée à l'administration et à la créatrice, où le bot fait vivre
// son activité fictive — nouveaux abonnés, messages de clients (suggestifs, jamais explicites), pourboires, achats de
// contenus et avis notés. Elle répond aux messages avec un bouton ; les revenus sont en € du jeu (plafonnés par jour).
// Accès : catégorie invisible pour tout le monde sauf elle et les gérants (pas de limite d'âge Discord : rien d'explicite) ;
// tout se règle depuis le tableau de bord (pause, rythme, prix, fermeture). Aucun contenu réel n'est échangé.
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  ChannelType,
  AttachmentBuilder,
} = require("discord.js");
const fs = require("fs");
const { isGerant, GERANTS_ROLE_ID, changeBalance, formatEuro } = require("./economie");
const { pseudo } = require("./noms");

const STATE_FILE = require("./data").dataFile("studio-state.json");
const DAILY_CAP = 2500; // € du jeu versés au plus par jour
const RHYTHMS = { lent: [40, 80], normal: [15, 40], rapide: [5, 15] }; // minutes entre deux événements
const MINUTE = 60000;

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.studios ??= {};
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const dayKey = () => new Date().toLocaleDateString("fr-CA", { timeZone: "Europe/Paris" });

// --- Les faux clients ---
const NAMES = ["Lucas_92", "maxou.dlr", "Kev1n", "TheoB", "nathan.prv", "Romain_31", "jules.off", "Ethan_lvl", "Yanis.k", "Hugo_dsg", "Mehdi.75", "Sam_rx", "Axel.vibes", "Noah_fr", "Enzo.cpt", "Adam_wav", "Victor.lmn", "Leo_mtl", "Tom.zen", "Rayan_pdc"];
const MESSAGES = [
  "Coucou ! J'adore ton dernier post 😍",
  "Je viens de m'abonner, hâte de voir la suite !",
  "Tu fais des contenus personnalisés ? Je suis prêt à payer bien sûr",
  "C'est quand ta prochaine publication ?",
  "Ton contenu vaut chaque centime 🔥",
  "Petit pourboire pour ta journée ☕",
  "Je suis fan depuis le début, continue comme ça",
  "Tu réponds toujours, j'apprécie trop 🙏",
  "La tenue rouge de la semaine dernière… incroyable 😳",
  "Tu pourrais faire une série photo à la plage ?",
  "Merci pour ta réponse d'hier, t'es la meilleure",
  "Je recommande ton compte à tous mes potes 😎",
  "Combien pour une vidéo dédicacée à mon prénom ?",
  "T'as un pack spécial pour le week-end ?",
  "Bonne nuit, à demain pour la suite 🌙",
];
const THANKS = ["Merci pour ta réponse 😍", "Tu m'as fait ma journée !", "Trop gentille, je reste abonné à vie", "Ahh merci, j'attends la suite avec impatience 🔥"];
const PRODUCTS = [
  ["📸 Photo exclusive", 40, 90],
  ["🎬 Vidéo personnalisée", 120, 300],
  ["📦 Pack du week-end", 80, 180],
  ["🌙 Album privé", 60, 140],
];
const REVIEWS = {
  5: ["Toujours au top, rien à dire 🔥", "Meilleur abonnement que j'ai pris", "Contenu de qualité et réponses rapides 😍", "Elle prend le temps de répondre à tout le monde, rare !"],
  4: ["Très bien, un peu cher mais ça vaut le coup", "Super contenu, j'aimerais juste plus de publications", "Bonne surprise, je recommande"],
  3: ["Pas mal, mais les réponses mettent du temps", "Correct, j'attendais un peu plus de nouveautés"],
};

// --- Salons ---
let client = null;
const chanOf = async (s, key) => (s.channels?.[key] ? await client.channels.fetch(s.channels[key]).catch(() => null) : null);
function overwrites(guild, userId) {
  const see = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory];
  return [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: userId, allow: see, deny: [PermissionFlagsBits.SendMessages] },
    { id: GERANTS_ROLE_ID, allow: [...see, PermissionFlagsBits.SendMessages] },
    { id: client.user.id, allow: [...see, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
  ];
}
async function createStudio(guild, userId) {
  const name = pseudo(userId);
  const ow = overwrites(guild, userId);
  const category = await guild.channels.create({ name: `🔞 Studio de ${name}`.slice(0, 100), type: ChannelType.GuildCategory, permissionOverwrites: ow });
  // pas de limite d'âge Discord (aucun contenu explicite) : l'accès est réservé par les permissions de la catégorie
  const make = (n) => guild.channels.create({ name: n, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: ow });
  const [tableau, messages, ventes, avis] = [await make("📊・tableau-de-bord"), await make("💬・messages-clients"), await make("💰・ventes"), await make("⭐・avis")];
  return { categoryId: category.id, channels: { tableau: tableau.id, messages: messages.id, ventes: ventes.id, avis: avis.id } };
}

// --- Tableau de bord ---
function earnedToday(s) {
  return s.day === dayKey() ? s.today : 0;
}
function panelPayload(userId) {
  const s = load().studios[userId];
  const avg = s.ratings.length ? s.ratings.reduce((a, x) => a + x, 0) / s.ratings.length : 0;
  const pending = s.pending.length;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(s.active ? 0xec4899 : 0x64748b)
        .setTitle(`🔞 Studio de ${pseudo(userId)} — ${s.active ? "en ligne" : "en pause"}`)
        .setDescription(
          `👥 **${s.subs}** abonné${s.subs > 1 ? "s" : ""} · abonnement **${formatEuro(s.price)}**\n` +
            `💰 Aujourd'hui : **${formatEuro(earnedToday(s))}** / ${formatEuro(DAILY_CAP)} · total : **${formatEuro(s.revenue)}**\n` +
            `⭐ Note moyenne : **${avg ? avg.toFixed(1) : "—"}** / 5 (${s.ratings.length} avis)\n` +
            `💬 Messages en attente de réponse : **${pending}** · réponses envoyées : **${s.replies}**\n` +
            `⏱️ Rythme : **${s.rhythm}**\n\n` +
            "*Répondre aux clients améliore les avis et attire les pourboires.*"
        ),
    ],
    components: [],
  };
}
async function refreshPanel(userId) {
  const s = load().studios[userId], ch = await chanOf(s, "tableau");
  if (!ch) return;
  const msg = s.panelId ? await ch.messages.fetch(s.panelId).catch(() => null) : null;
  if (msg) return void (await msg.edit(panelPayload(userId)).catch(() => null));
  const sent = await ch.send(panelPayload(userId)).catch(() => null);
  if (sent) {
    s.panelId = sent.id;
    save();
  }
}

// --- La vie du studio ---
// verse un gain (en € du jeu), dans la limite du plafond du jour
function earn(userId, s, amount, label) {
  if (s.day !== dayKey()) {
    s.day = dayKey();
    s.today = 0;
  }
  const paid = Math.max(0, Math.min(amount, DAILY_CAP - s.today));
  if (paid) changeBalance(userId, paid, `Studio : ${label}`, { force: true });
  s.today += paid;
  s.revenue += paid;
  return paid;
}
// l'audience (0 à 1) grandit avec les abonnés : elle règle le buzz (événements, likes, commentaires, achats)
const audience = (s) => Math.min(1, s.subs / 60);
async function event(userId) {
  const s = load().studios[userId];
  const replyRate = s.replies / Math.max(1, s.replies + s.pending.length + s.ignored);
  // un petit studio est souvent calme : parfois juste un nouvel abonné, parfois rien
  if (Math.random() > 0.3 + 0.7 * audience(s)) {
    if (Math.random() < 0.35) {
      s.subs++;
      const paid = earn(userId, s, s.price, "nouvel abonné");
      await (await chanOf(s, "ventes"))?.send(`🆕 **${pick(NAMES)}** s'abonne au studio — **+${formatEuro(paid)}**`).catch(() => null);
      await refreshPanel(userId).catch(() => null);
    }
    save();
    return;
  }
  const roll = Math.random();
  if (roll < 0.4) await postClientMessage(userId, pick(NAMES), pick(MESSAGES));
  else if (roll < 0.6) {
    s.subs++;
    const paid = earn(userId, s, s.price, "nouvel abonné");
    await (await chanOf(s, "ventes"))?.send(`🆕 **${pick(NAMES)}** s'abonne au studio — **+${formatEuro(paid)}**`).catch(() => null);
  } else if (roll < 0.8) {
    const [label, min, max] = pick(PRODUCTS), price = Math.round(rnd(min, max));
    const paid = earn(userId, s, price, label);
    await (await chanOf(s, "ventes"))?.send(`🛍️ Achat de **${pick(NAMES)}** : ${label} — **+${formatEuro(paid)}**`).catch(() => null);
  } else if (roll < 0.9) {
    // pourboire : plus fréquent quand elle répond
    const tip = Math.round(rnd(10, 60) * (0.6 + replyRate));
    const paid = earn(userId, s, tip, "pourboire");
    await (await chanOf(s, "ventes"))?.send(`☕ Pourboire de **${pick(NAMES)}** — **+${formatEuro(paid)}**`).catch(() => null);
  } else {
    // un avis : meilleur quand elle répond aux messages
    const stars = Math.max(3, Math.min(5, Math.round(3.4 + replyRate * 1.8 + rnd(-0.6, 0.6))));
    s.ratings = [...s.ratings, stars].slice(-100);
    await (await chanOf(s, "avis"))
      ?.send({ embeds: [new EmbedBuilder().setColor(0xfbbf24).setAuthor({ name: `⭐ ${pick(NAMES)}` }).setTitle("⭐".repeat(stars) + "☆".repeat(5 - stars)).setDescription(pick(REVIEWS[stars]))] })
      .catch(() => null);
  }
  save();
  await refreshPanel(userId).catch(() => null);
}
// un message de client (tiré au hasard, ou écrit par l'administration en message privé), avec le bouton pour répondre
async function postClientMessage(userId, name, text) {
  const s = load().studios[userId];
  const color = Math.floor(Math.random() * 0xffffff), ch = await chanOf(s, "messages");
  const id = Date.now().toString(36);
  const sent = await ch
    ?.send({
      embeds: [new EmbedBuilder().setColor(color).setAuthor({ name: `💬 ${name}` }).setDescription(text).setTimestamp()],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`studio_rep_${userId}_${id}`).setLabel("Répondre").setEmoji("💌").setStyle(ButtonStyle.Primary))],
    })
    .catch(() => null);
  if (!sent) return false;
  s.pending.push({ id, msgId: sent.id, client: name, at: Date.now() });
  // un message laissé sans réponse plus de 3 h compte comme ignoré
  const old = s.pending.filter((p) => Date.now() - p.at > 3 * 60 * MINUTE);
  s.ignored += old.length;
  s.pending = s.pending.filter((p) => !old.includes(p)).slice(-25);
  save();
  return true;
}
function schedule(userId) {
  const s = load().studios[userId];
  if (!s) return;
  const [a, b] = RHYTHMS[s.rhythm] ?? RHYTHMS.normal;
  s.next = Date.now() + rnd(a, b) * MINUTE;
  save();
}
function tick() {
  for (const [userId, s] of Object.entries(load().studios)) {
    if (!s.active || Date.now() < (s.next ?? 0)) continue;
    schedule(userId);
    event(userId).catch((err) => console.error("Studio:", err.message));
  }
}

async function setupStudio(c) {
  client = c;
  load();
  // les studios déjà créés perdent aussi la limite d'âge
  for (const s of Object.values(state.studios))
    for (const cid of Object.values(s.channels ?? {})) {
      const ch = await client.channels.fetch(cid).catch(() => null);
      if (ch?.nsfw) await ch.setNSFW(false).catch(() => null);
    }
  // les tableaux de bord perdent leurs anciens boutons de réglage
  for (const uid of Object.keys(state.studios)) await refreshPanel(uid).catch(() => null);
  client.on("messageCreate", (msg) => onStudioMessage(msg).catch((err) => console.error("Studio (message):", err.message)));
  setInterval(tick, MINUTE).unref?.();
}

// --- Commande et boutons ---
async function handleStudioInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "studio";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("studio_"))) return false;
  client ??= interaction.client; // une commande peut arriver avant la fin du démarrage du bot
  const admin = isGerant(interaction.member);
  if (isCmd) {
    if (!admin) return void (await interaction.reply({ content: "❌ Réservé à l'administration.", ephemeral: true })) || true;
    const target = interaction.options.getUser("membre");
    if (!target || target.bot) return void (await interaction.reply({ content: "❌ Choisissez un membre.", ephemeral: true })) || true;
    await interaction.deferReply({ ephemeral: true });
    const st = load();
    if (st.studios[target.id] && (await chanOf(st.studios[target.id], "tableau"))) {
      await refreshPanel(target.id);
      return void (await interaction.editReply(`🔞 Le studio de **${pseudo(target.id)}** existe déjà : <#${st.studios[target.id].channels.tableau}>`)) || true;
    }
    const made = await createStudio(interaction.guild, target.id).catch((err) => (console.error("Studio (création):", err.message), null));
    if (!made) return void (await interaction.editReply("❌ Impossible de créer la catégorie (permissions du bot ?).")) || true;
    st.studios[target.id] = { ...made, active: true, rhythm: "normal", price: 15, subs: 0, revenue: 0, today: 0, day: dayKey(), ratings: [], pending: [], replies: 0, ignored: 0, createdAt: Date.now() };
    save();
    schedule(target.id);
    await refreshPanel(target.id);
    await interaction.editReply(`🔞 Studio de **${pseudo(target.id)}** créé : <#${made.channels.tableau}>. Seuls elle et l'administration le voient. Réglages en message privé au bot : « studio aide ».`);
    return true;
  }
  // répondre à un client (elle, ou l'administration)
  const rep = /^studio_rep_(\d+)_(\w+)$/.exec(id);
  const repSend = /^studio_send_(\d+)_(\w+)$/.exec(id);
  if (rep) {
    if (interaction.user.id !== rep[1] && !admin) return void (await interaction.reply({ content: "❌ Seule la créatrice peut répondre.", ephemeral: true })) || true;
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`studio_send_${rep[1]}_${rep[2]}`)
        .setTitle("Répondre au client")
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("texte").setLabel("Votre réponse").setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)))
    );
    return true;
  }
  if (repSend) {
    const [, uid, mid] = repSend, s = load().studios[uid];
    const p = s?.pending.find((x) => x.id === mid);
    const text = interaction.fields.getTextInputValue("texte");
    await interaction.deferUpdate().catch(() => null);
    if (!s) return true;
    if (p) {
      s.pending = s.pending.filter((x) => x !== p);
      s.replies++;
      save();
    }
    await interaction.message
      ?.edit({ embeds: [...interaction.message.embeds.map((e) => EmbedBuilder.from(e)), new EmbedBuilder().setColor(0xec4899).setAuthor({ name: `💌 Réponse de ${pseudo(uid)}` }).setDescription(text)], components: [] })
      .catch(() => null);
    // le client réagit un peu plus tard, parfois avec un pourboire
    if (p)
      setTimeout(
        async () => {
          const st = load().studios[uid];
          if (!st) return;
          const tip = Math.random() < 0.4 ? earn(uid, st, Math.round(rnd(15, 70)), "pourboire après une réponse") : 0;
          save();
          await interaction.message?.reply(`💬 **${p.client}** : ${pick(THANKS)}${tip ? ` · ☕ pourboire **+${formatEuro(tip)}**` : ""}`).catch(() => null);
          await refreshPanel(uid).catch(() => null);
        },
        rnd(1, 4) * MINUTE
      );
    await refreshPanel(uid).catch(() => null);
    return true;
  }
  return false;
}

// --- Publications : la créatrice poste ses photos dans 📸・publications, le bot les met en page ---
const COMMENTS = ["Magnifique 😍", "Wow… 🔥", "La plus belle publication de la semaine", "J'attendais ça depuis hier !", "T'es incroyable ✨", "Ce sourire 😳", "Encore, encore 🙏", "Top comme toujours", "J'adore la lumière sur celle-là", "Abonné à vie 💖"];
async function createMedia(s, userId) {
  const cat = await client.channels.fetch(s.categoryId).catch(() => null);
  if (!cat) return null;
  const ow = overwrites(cat.guild, userId).map((o) => (o.id === userId ? { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] } : o));
  const ch = await cat.guild.channels.create({ name: "📸・publications", type: ChannelType.GuildText, parent: cat.id, permissionOverwrites: ow });
  s.channels.media = ch.id;
  save();
  await ch.send({ embeds: [new EmbedBuilder().setColor(0xec4899).setTitle("📸 Vos publications").setDescription("Postez ici vos photos (avec une légende si vous voulez) : elles sont mises en page pour vos abonnés, qui réagissent et commentent.")] }).catch(() => null);
  return ch;
}
async function onMediaPost(msg, userId, s) {
  const imgs = [...msg.attachments.values()].filter((a) => a.contentType?.startsWith("image/")).slice(0, 4);
  if (!imgs.length) return;
  const files = imgs.map((a, k) => new AttachmentBuilder(a.url, { name: `photo-${k}.${(a.name.split(".").pop() || "png").toLowerCase()}` }));
  const post = (likes, comments) => [
    new EmbedBuilder()
      .setColor(0xec4899)
      .setAuthor({ name: `📸 ${pseudo(userId)} · nouvelle publication` })
      .setDescription(msg.content?.slice(0, 1000) || null)
      .setImage(`attachment://${files[0].name}`)
      .setFooter({ text: `❤️ ${likes} · 💬 ${comments}` })
      .setTimestamp(),
    ...files.slice(1).map((f) => new EmbedBuilder().setColor(0xec4899).setImage(`attachment://${f.name}`)),
  ];
  const sent = await msg.channel.send({ embeds: post(0, 0), files }).catch((err) => (console.error("Studio (publication):", err.message), null));
  if (!sent) return;
  await msg.delete().catch(() => null);
  s.posts = (s.posts ?? 0) + 1;
  save();
  // Les abonnés découvrent la publication peu à peu : rien pendant 4 à 12 minutes, puis les réactions arrivent sur
  // une à trois heures. Tout dépend de l'audience : avec peu d'abonnés, quelques likes et presque pas de commentaires ;
  // le buzz grandit avec les abonnés, donc au fil des jours.
  const a = audience(s);
  let likes = 0, comments = 0;
  const target = Math.max(1, Math.round(s.subs * rnd(0.35, 0.8) + rnd(0, 3)));
  const steps = 5;
  let at = rnd(4, 12) * MINUTE;
  for (let step = 1; step <= steps; step++, at += rnd(10, 35) * MINUTE)
    setTimeout(async () => {
      // les likes montent vite au début, puis ralentissent
      likes = Math.round(target * (1 - Math.pow(1 - step / steps, 2)) + rnd(-1, 1));
      if (Math.random() < Math.min(0.7, 0.08 + s.subs / 60)) {
        comments++;
        await sent.reply({ content: `💬 **${pick(NAMES)}** : ${pick(COMMENTS)}`, allowedMentions: { parse: [], repliedUser: false } }).catch(() => null);
      }
      await sent.edit({ embeds: post(Math.max(0, likes), comments), attachments: sent.attachments.map((x) => x) }).catch(() => null);
      if (step !== steps) return;
      const st = load().studios[userId];
      if (!st) return;
      // une belle publication fait venir des abonnés, et parfois quelqu'un la débloque
      if (Math.random() < 0.15 + 0.6 * a) {
        const n = 1 + Math.floor(st.subs / 40);
        st.subs += n;
        const paid = earn(userId, st, st.price * n, "nouveaux abonnés après une publication");
        await (await chanOf(st, "ventes"))?.send(`🆕 ${n > 1 ? `**${n} nouveaux abonnés**` : `**${pick(NAMES)}** s'abonne`} grâce à la dernière publication — **+${formatEuro(paid)}**`).catch(() => null);
      }
      if (Math.random() < 0.1 + 0.5 * a) {
        const paid = earn(userId, st, Math.round(rnd(20, 60) * (0.6 + a)), "publication débloquée");
        await (await chanOf(st, "ventes"))?.send(`🔓 **${pick(NAMES)}** débloque la dernière publication — **+${formatEuro(paid)}**`).catch(() => null);
      }
      save();
      await refreshPanel(userId).catch(() => null);
    }, at);
}

// --- Réglages en message privé au bot (ADMIN_DM, ou un gérant) ---
const ADMIN_DM = "320348102055690241";
const HELP =
  "🔞 **Studio — commandes en message privé**\n" +
  "• `studio` : le bilan\n" +
  "• `studio pause` / `studio reprendre`\n" +
  "• `studio rythme lent|normal|rapide`\n" +
  "• `studio prix 20` : prix de l'abonnement (1 à 200 €)\n" +
  "• `studio client Ton message` : un client écrit (pseudo au hasard)\n" +
  "• `studio client Pseudo: Ton message` : un client précis écrit\n" +
  "• `studio exemples` : des exemples de messages de clients\n" +
  "• `studio media` : crée le salon 📸・publications\n" +
  "• `studio fermer confirmer` : supprime le studio\n" +
  "S'il y a plusieurs studios, ajoutez l'ID de la créatrice : `studio 1557089423408238602 pause`.";
async function canControl(msg) {
  if (msg.author.id === ADMIN_DM) return true;
  for (const g of client.guilds.cache.values()) {
    const m = await g.members.fetch(msg.author.id).catch(() => null);
    if (m && isGerant(m)) return true;
  }
  return false;
}
function studioReport(uid) {
  const s = load().studios[uid], avg = s.ratings.length ? (s.ratings.reduce((a, x) => a + x, 0) / s.ratings.length).toFixed(1) : "—";
  return `🔞 **Studio de ${pseudo(uid)}** — ${s.active ? "en ligne" : "en pause"} · rythme ${s.rhythm} · abonnement ${formatEuro(s.price)}\n👥 ${s.subs} abonnés · 💰 aujourd'hui ${formatEuro(earnedToday(s))} / ${formatEuro(DAILY_CAP)} · total ${formatEuro(s.revenue)} · ⭐ ${avg} (${s.ratings.length} avis) · 💬 ${s.pending.length} en attente, ${s.replies} réponses · 📸 ${s.posts ?? 0} publications${s.channels.media ? "" : " (pas encore de salon : `studio media`)"}`;
}
async function onStudioMessage(msg) {
  if (msg.author?.bot) return;
  // une photo dans 📸・publications
  if (msg.guild) {
    for (const [uid, s] of Object.entries(load().studios)) if (s.channels?.media === msg.channelId && (msg.author.id === uid || isGerant(msg.member))) return onMediaPost(msg, uid, s);
    return;
  }
  const words = msg.content.trim().split(/\s+/);
  if (words[0]?.toLowerCase() !== "studio" || !(await canControl(msg))) return;
  const say = (t) => msg.reply(t.slice(0, 1990)).catch(() => null);
  const ids = Object.keys(load().studios);
  let uid = /^\d{15,}$/.test(words[1] ?? "") ? words.splice(1, 1)[0] : ids.length === 1 ? ids[0] : null;
  const cmd = (words[1] ?? "").toLowerCase();
  if (cmd === "aide") return say(HELP);
  if (cmd === "exemples") return say(`💬 **Exemples de messages de clients** (le bot en envoie tout seul, ou vous écrivez le vôtre avec \`studio client …\`) :\n${MESSAGES.map((m) => `• ${m}`).join("\n")}`);
  if (!ids.length) return say("Aucun studio pour l'instant : `/studio membre:@…` sur le serveur.");
  if (!uid || !load().studios[uid]) return say(`Plusieurs studios : précisez l'ID de la créatrice (${ids.map((id) => `${pseudo(id)} = \`${id}\``).join(", ")}).`);
  const s = load().studios[uid];
  if (!cmd || cmd === "bilan") return say(studioReport(uid));
  if (cmd === "pause" || cmd === "reprendre") {
    s.active = cmd === "reprendre";
    if (s.active) schedule(uid);
    save();
    await refreshPanel(uid).catch(() => null);
    return say(s.active ? "▶️ Studio remis en ligne." : "⏸️ Studio en pause : plus aucun événement jusqu'à `studio reprendre`.");
  }
  if (cmd === "rythme") {
    const r = (words[2] ?? "").toLowerCase();
    if (!RHYTHMS[r]) return say("Rythme : `lent` (40-80 min), `normal` (15-40 min) ou `rapide` (5-15 min).");
    s.rhythm = r;
    schedule(uid);
    await refreshPanel(uid).catch(() => null);
    return say(`⏩ Rythme : **${r}**.`);
  }
  if (cmd === "prix") {
    const v = Math.round(Number(String(words[2] ?? "").replace(",", ".")));
    if (!Number.isFinite(v) || v < 1 || v > 200) return say("❌ Prix entre 1 et 200 : `studio prix 20`.");
    s.price = v;
    save();
    await refreshPanel(uid).catch(() => null);
    return say(`💶 Abonnement à **${formatEuro(v)}**.`);
  }
  if (cmd === "client") {
    const body = msg.content.trim().replace(/^studio\s+(\d{15,}\s+)?client\s*/i, "");
    if (!body) return say("Écrivez le message : `studio client Ton message` ou `studio client Pseudo: Ton message`.");
    const named = /^([^:\s]{2,24}):\s*(.+)$/s.exec(body);
    const ok = await postClientMessage(uid, named ? named[1] : pick(NAMES), (named ? named[2] : body).slice(0, 1500));
    await refreshPanel(uid).catch(() => null);
    return say(ok ? "💬 Message de client envoyé dans le studio." : "❌ Salon des messages introuvable.");
  }
  if (cmd === "media") {
    if (s.channels.media && (await chanOf(s, "media"))) return say(`📸 Le salon existe déjà : <#${s.channels.media}>`);
    const ch = await createMedia(s, uid).catch((err) => (console.error("Studio (media):", err.message), null));
    return say(ch ? `📸 Salon créé : <#${ch.id}>. Elle y poste ses photos, le bot les met en page et les abonnés réagissent.` : "❌ Impossible de créer le salon.");
  }
  if (cmd === "fermer") {
    if ((words[2] ?? "").toLowerCase() !== "confirmer") return say("🗑️ Pour supprimer le studio (catégorie et salons) : `studio fermer confirmer`. Les gains déjà versés restent.");
    for (const cid of Object.values(s.channels ?? {})) await (await client.channels.fetch(cid).catch(() => null))?.delete("Studio fermé").catch(() => null);
    await (await client.channels.fetch(s.categoryId).catch(() => null))?.delete("Studio fermé").catch(() => null);
    delete load().studios[uid];
    save();
    return say("🗑️ Studio fermé.");
  }
  return say(HELP);
}

module.exports = { setupStudio, handleStudioInteraction, _test: { event, load, panelPayload, onStudioMessage, setClient: (c) => (client = c) } };
