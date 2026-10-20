// Studio 🔞 (jeu de rôle entre adultes) : une catégorie réservée à l'administration et à la créatrice, où le bot fait vivre
// son activité fictive — nouveaux abonnés, messages de clients (suggestifs, jamais explicites), pourboires, achats de
// contenus et avis notés. Elle répond aux messages avec un bouton ; les revenus sont en € du jeu (plafonnés par jour).
// Garde-fous : salons « soumis à une limite d'âge », invisibles pour tout le monde sauf elle et les gérants ;
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
  "C'est quand ton prochain live ?",
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
  ["💌 Message vocal dédicacé", 50, 110],
  ["🌙 Accès au live privé", 60, 140],
];
const REVIEWS = {
  5: ["Toujours au top, rien à dire 🔥", "Meilleur abonnement que j'ai pris", "Contenu de qualité et réponses rapides 😍", "Elle prend le temps de répondre à tout le monde, rare !"],
  4: ["Très bien, un peu cher mais ça vaut le coup", "Super contenu, j'aimerais juste plus de lives", "Bonne surprise, je recommande"],
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
  const make = (n) => guild.channels.create({ name: n, type: ChannelType.GuildText, parent: category.id, nsfw: true, permissionOverwrites: ow }); // salons soumis à une limite d'âge
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
        )
        .setFooter({ text: "Les boutons de réglage sont réservés à l'administration." }),
    ],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`studio_pause_${userId}`).setLabel(s.active ? "Mettre en pause" : "Remettre en ligne").setEmoji(s.active ? "⏸️" : "▶️").setStyle(s.active ? ButtonStyle.Secondary : ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`studio_rythme_${userId}`).setLabel(`Rythme : ${s.rhythm}`).setEmoji("⏩").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`studio_prix_${userId}`).setLabel("Prix de l'abonnement").setEmoji("💶").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`studio_fermer_${userId}`).setLabel("Fermer le studio").setEmoji("🗑️").setStyle(ButtonStyle.Danger)
      ),
    ],
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
const client_ = () => ({ name: pick(NAMES), color: Math.floor(Math.random() * 0xffffff) });
async function event(userId) {
  const s = load().studios[userId];
  const replyRate = s.replies / Math.max(1, s.replies + s.pending.length + s.ignored);
  const roll = Math.random();
  if (roll < 0.4) {
    // un message de client, avec le bouton pour répondre
    const c = client_(), text = pick(MESSAGES), ch = await chanOf(s, "messages");
    const id = Date.now().toString(36);
    const sent = await ch
      ?.send({
        embeds: [new EmbedBuilder().setColor(c.color).setAuthor({ name: `💬 ${c.name}` }).setDescription(text).setTimestamp()],
        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`studio_rep_${userId}_${id}`).setLabel("Répondre").setEmoji("💌").setStyle(ButtonStyle.Primary))],
      })
      .catch(() => null);
    if (sent) {
      s.pending.push({ id, msgId: sent.id, client: c.name, at: Date.now() });
      // un message laissé sans réponse plus de 3 h compte comme ignoré
      const old = s.pending.filter((p) => Date.now() - p.at > 3 * 60 * MINUTE);
      s.ignored += old.length;
      s.pending = s.pending.filter((p) => !old.includes(p)).slice(-25);
    }
  } else if (roll < 0.6) {
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
  setInterval(tick, MINUTE).unref?.();
}

// --- Commande et boutons ---
async function handleStudioInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "studio";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("studio_"))) return false;
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
    await interaction.editReply(`🔞 Studio de **${pseudo(target.id)}** créé : <#${made.channels.tableau}>. Seuls elle et l'administration le voient ; les salons sont soumis à une limite d'âge.`);
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
  // réglages : administration seulement
  const m = /^studio_(pause|rythme|prix|fermer|prixok|fermerok)_(\d+)$/.exec(id);
  if (!m) return false;
  if (!admin) return void (await interaction.reply({ content: "❌ Réglages réservés à l'administration.", ephemeral: true })) || true;
  const [, what, uid] = m, s = load().studios[uid];
  if (!s) return void (await interaction.reply({ content: "Ce studio n'existe plus.", ephemeral: true })) || true;
  if (what === "pause") {
    s.active = !s.active;
    if (s.active) schedule(uid);
    save();
    await interaction.update(panelPayload(uid));
  } else if (what === "rythme") {
    const order = Object.keys(RHYTHMS);
    s.rhythm = order[(order.indexOf(s.rhythm) + 1) % order.length];
    schedule(uid);
    await interaction.update(panelPayload(uid));
  } else if (what === "prix") {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`studio_prixok_${uid}`)
        .setTitle("Prix de l'abonnement")
        .addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("prix").setLabel("Prix en € du jeu (1 à 200)").setStyle(TextInputStyle.Short).setValue(String(s.price)).setRequired(true)))
    );
  } else if (what === "prixok") {
    const v = Math.round(Number(interaction.fields.getTextInputValue("prix").replace(",", ".")));
    if (!Number.isFinite(v) || v < 1 || v > 200) return void (await interaction.reply({ content: "❌ Prix entre 1 et 200.", ephemeral: true })) || true;
    s.price = v;
    save();
    await interaction.deferUpdate().catch(() => null);
    await refreshPanel(uid);
  } else if (what === "fermer") {
    await interaction.reply({
      ephemeral: true,
      content: "🗑️ Fermer le studio supprime la catégorie et ses salons. Les gains déjà versés restent. Confirmer ?",
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`studio_fermerok_${uid}`).setLabel("Oui, fermer").setStyle(ButtonStyle.Danger))],
    });
  } else if (what === "fermerok") {
    await interaction.update({ content: "🗑️ Studio fermé.", components: [] }).catch(() => null);
    for (const cid of Object.values(s.channels ?? {})) await (await client.channels.fetch(cid).catch(() => null))?.delete("Studio fermé").catch(() => null);
    await (await client.channels.fetch(s.categoryId).catch(() => null))?.delete("Studio fermé").catch(() => null);
    delete load().studios[uid];
    save();
  }
  return true;
}

module.exports = { setupStudio, handleStudioInteraction, _test: { event, load, panelPayload } };
