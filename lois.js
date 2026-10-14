// Les lois de la Maison : projets de loi, votes, édits royaux, décrets,
// initiatives citoyennes et « Code de la Maison » (les lois en vigueur).
// Le maire peut aussi écrire une loi libre (son propre texte) et, même en démocratie, imposer une loi sans vote.
const fs = require("fs");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { LAWS, lawEffect, listLaws, enactLaw, repealLaw, regime, REGIMES } = require("./politique");
const { findOrCreateChannel } = require("./salons");

const mairie = () => require("./mairie");
const STATE_FILE = require("./data").dataFile("lois-state.json");
const { pseudo } = require("./noms");
const VOTE_MS = 48 * 60 * 60 * 1000;
const PETITION_MS = 72 * 60 * 60 * 1000;
const QUORUM = 5;
const VOTER_SENIORITY_MS = 7 * 24 * 60 * 60 * 1000;
const PANEL_TITLE = "📜 Code de la Maison";

let state = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.bills ??= {};
  state.petitions ??= {};
  state.counter ??= 0;
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function nextId(prefix) {
  load().counter += 1;
  return `${prefix}${state.counter}`;
}
function ts(ms, style = "f") {
  return `<t:${Math.floor(ms / 1000)}:${style}>`;
}
function isActiveLaw(key) {
  return listLaws().some((l) => l.key === key);
}
// nom, emoji et texte d'une loi (prévue ou libre) ; custom = loi libre pas encore en vigueur
const activeLaw = (key) => listLaws().find((l) => l.key === key);
const lawName = (key, custom) => LAWS[key]?.name ?? custom?.name ?? activeLaw(key)?.name ?? "Loi";
const lawEmoji = (key, custom) => LAWS[key]?.emoji ?? custom?.emoji ?? activeLaw(key)?.emoji ?? "📜";
const effectOf = (key, param, custom) => (LAWS[key] ? lawEffect(key, param) : custom?.text ?? activeLaw(key)?.text ?? "");
const isLibre = (key) => !LAWS[key];
const LIBRE_LIST = (text) => (text.length > 100 ? `${text.slice(0, 99)}…` : text);
function eligible(member) {
  return Date.now() - (member?.joinedTimestamp ?? Date.now()) >= VOTER_SENIORITY_MS;
}

let channelRef = null;

// --- Code de la Maison ---

function codePanel() {
  const r = regime();
  const laws = listLaws().sort((a, b) => a.number - b.number);
  const how = { vote: "votée par les citoyens", edit: "édit royal", decret: "décret", initiative: "initiative citoyenne", force: "imposée par le maire" };
  const pending = Object.values(load().bills);
  const petitions = Object.values(load().petitions);
  // l'embed ne dépasse pas 4096 caractères : les lois qui ne tiennent plus sont résumées à la fin
  let lawsText = "", hidden = 0;
  for (const l of laws) {
    const effect = lawEffect(l.key, l.param);
    const line = `${l.emoji ?? "📜"} **Loi n°${l.number} — ${l.name ?? "Loi"}**\n└ ${effect.length > 400 ? `${effect.slice(0, 399)}…` : effect} *(${how[l.how] ?? l.how}, ${ts(l.since, "D")})*`;
    if (lawsText.length + line.length < 3300) lawsText += `${lawsText ? "\n\n" : ""}${line}`;
    else hidden++;
  }
  if (hidden) lawsText += `\n\n*… et ${hidden} autre(s) loi(s) en vigueur.*`;
  const embed = new EmbedBuilder()
    .setColor(r === "anarchie" ? 0x7f8c8d : 0x8b0000)
    .setTitle(PANEL_TITLE)
    .setDescription(
      (r === "anarchie" ? "🏴 **Anarchie : toutes les lois sont suspendues.** Elles reviendront avec l'ordre.\n\n" : "") +
        (laws.length ? lawsText : "*Aucune loi en vigueur pour le moment.*") +
        "\n\n**Comment naît une loi ?**\n" +
        "🗳️ En démocratie, le maire propose et **les citoyens votent** (48 h, au moins 5 votants). Le maire peut aussi **imposer** une loi sans vote.\n" +
        "👑 En monarchie, le monarque publie des **édits royaux**. ⚔️ En dictature, le régime impose des **décrets**.\n" +
        "✍️ Tout citoyen peut lancer une **initiative citoyenne** : avec assez de signatures, elle part au vote, même contre l'avis du maire."
    )
    .setFooter({ text: `${REGIMES[r].emoji} Régime : ${REGIMES[r].name} · ${pending.length} vote(s) en cours · ${petitions.length} pétition(s)` })
    .setTimestamp();
  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("loi_ric").setLabel("Lancer une initiative citoyenne").setEmoji("✍️").setStyle(ButtonStyle.Primary)
      ),
    ],
  };
}

async function refreshCode(client) {
  if (!channelRef) return;
  const s = load();
  let msg = s.panelMessageId ? await channelRef.messages.fetch(s.panelMessageId).catch(() => null) : null;
  if (!msg) {
    const recent = await channelRef.messages.fetch({ limit: 25 }).catch(() => null);
    msg = recent?.find((m) => m.author.id === client.user.id && m.embeds[0]?.title === PANEL_TITLE);
  }
  if (msg) await msg.edit(codePanel()).catch(() => null);
  else msg = await channelRef.send(codePanel()).catch(() => null);
  if (msg && s.panelMessageId !== msg.id) {
    s.panelMessageId = msg.id;
    save();
  }
}

// --- Choix d'une loi (maire ou citoyen) ---

function lawSelect(customId, action, placeholder) {
  const options = Object.entries(LAWS)
    .filter(([key]) => (action === "enact" ? !isActiveLaw(key) : isActiveLaw(key)))
    .filter(([key]) => !Object.values(load().bills).some((b) => b.key === key))
    .map(([key, l]) => ({ label: l.name.slice(0, 100), value: key, emoji: l.emoji, description: lawEffect(key).slice(0, 100) }));
  if (action === "repeal")
    for (const l of listLaws().filter((x) => isLibre(x.key) && !Object.values(load().bills).some((b) => b.key === x.key)))
      options.push({ label: `Loi n°${l.number} — ${l.name ?? "Loi"}`.slice(0, 100), value: l.key, emoji: "📜", description: LIBRE_LIST(l.text || "Loi libre") });
  if (!options.length) return null;
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options.slice(0, 25)));
}

// Bouton « Lois » du bureau du maire
async function openMayorMenu(interaction) {
  if (!mairie().isMayor(interaction.user.id)) {
    return interaction.reply({ content: "❌ Seul le maire propose ou abroge des lois.", ephemeral: true });
  }
  if (regime() === "anarchie") {
    return interaction.reply({ content: "🏴 En anarchie, il n'y a plus de lois. Changez de régime pour légiférer.", ephemeral: true });
  }
  const demo = regime() === "democratie";
  const rows = demo
    ? [
        lawSelect("loi_pick_enact_maire", "enact", "🗳️ Proposer une loi au vote des citoyens"),
        lawSelect("loi_pick_enact_force", "enact", "⚡ Imposer une loi tout de suite (sans vote)"),
        lawSelect("loi_pick_repeal_maire", "repeal", "🗳️ Proposer une abrogation au vote"),
        lawSelect("loi_pick_repeal_force", "repeal", "⚡ Abroger tout de suite (sans vote)"),
      ].filter(Boolean)
    : [lawSelect("loi_pick_enact_maire", "enact", "📜 Promulguer une nouvelle loi"), lawSelect("loi_pick_repeal_maire", "repeal", "🗑️ Abroger une loi en vigueur")].filter(Boolean);
  rows.push(
    new ActionRowBuilder().addComponents(
      ...(demo
        ? [
            new ButtonBuilder().setCustomId("loi_libre_maire").setLabel("Écrire une loi (vote)").setEmoji("✍️").setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId("loi_libre_force").setLabel("Écrire et imposer").setEmoji("⚡").setStyle(ButtonStyle.Danger),
          ]
        : [new ButtonBuilder().setCustomId("loi_libre_maire").setLabel("Écrire une loi").setEmoji("✍️").setStyle(ButtonStyle.Primary)])
    )
  );
  const verb = { democratie: "soumettre au vote des citoyens ou imposer sans vote", monarchie: "promulguer par édit royal", dictature: "imposer par décret" }[regime()];
  return interaction.reply({ content: `📜 Choisissez une loi à **${verb}**, ou écrivez votre propre loi avec ✍️.`, components: rows, ephemeral: true });
}

function lawModal(action, key, origin) {
  const law = LAWS[key] ?? { name: lawName(key) };
  const rows = [];
  if (action === "enact" && law.param) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("param")
          .setLabel(`${law.param.label} — de ${law.param.min} à ${law.param.max}`.slice(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(7)
          .setValue(String(law.param.default))
      )
    );
  }
  rows.push(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId("motifs")
        .setLabel("Exposé des motifs (pourquoi cette loi ?)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(800)
    )
  );
  return new ModalBuilder()
    .setCustomId(`loi_m_${action}_${key}_${origin}`)
    .setTitle(`${action === "enact" ? "📜 Projet" : "🗑️ Abrogation"} — ${law.name}`.slice(0, 45))
    .addComponents(rows);
}

function libreModal(origin) {
  return new ModalBuilder()
    .setCustomId(`loi_libre_m_${origin}`)
    .setTitle(origin === "force" ? "⚡ Loi imposée par le maire" : "✍️ Écrire une loi")
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("titre").setLabel("Titre de la loi").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setPlaceholder("Ex. : Silence après minuit")),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("texte").setLabel("Texte de la loi (ce qu'elle dit)").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("motifs").setLabel("Exposé des motifs (facultatif)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(600))
    );
}

// --- Application d'une loi ---

const HOW_TITLES = {
  vote: (n, l) => `📜 Loi n°${n} adoptée par le peuple — ${l.name}`,
  edit: (n, l) => `👑 Édit royal n°${n} — ${l.name}`,
  decret: (n, l) => `⚔️ Décret n°${n} — ${l.name}`,
  initiative: (n, l) => `✍️ Loi n°${n} d'initiative citoyenne — ${l.name}`,
  force: (n, l) => `⚡ Loi n°${n} imposée par le maire — ${l.name}`,
};

async function applyLaw(client, { key, action, param, motifs, how, byUserId, custom }) {
  const law = { name: lawName(key, custom) };
  const signature = how === "decret" ? "— *Le Régime*" : how === "edit" ? `— Sa Majesté **${pseudo(byUserId)}**` : how === "force" ? `— Le Maire **${pseudo(byUserId)}**` : `— ${how === "initiative" ? "Le peuple de la Maison" : "Les citoyens de la Maison"}`;
  let title;
  let text;
  if (action === "enact") {
    const enacted = enactLaw(key, param, how, custom ? { name: custom.name, emoji: "📜", text: custom.text } : {});
    title = HOW_TITLES[how](enacted.number, law);
    text = `**${effectOf(key, param, custom)}**${motifs ? `\n\n*« ${motifs} »*` : ""}\n\nEn vigueur dès maintenant.\n\n${signature}`;
  } else {
    const old = repealLaw(key);
    law.name = old?.name ?? law.name;
    title = `🗑️ Abrogation de la loi n°${old?.number ?? "?"} — ${law.name}`;
    text = `La loi « ${law.name} » n'est plus en vigueur.${motifs ? `\n\n*« ${motifs} »*` : ""}\n\n${signature}`;
  }
  await mairie().journal(client, title, text, action === "enact" ? 0x8b0000 : 0x95a5a6);
  await channelRef
    ?.send({ embeds: [new EmbedBuilder().setColor(action === "enact" ? 0xd4af37 : 0x95a5a6).setTitle(title).setDescription(text).setTimestamp()] })
    .catch(() => null);
  await refreshCode(client);
}

// --- Votes des citoyens ---

function billEmbed(bill, closed = null) {
  const law = { name: lawName(bill.key, bill.custom), emoji: lawEmoji(bill.key, bill.custom) };
  const votes = Object.values(bill.votes);
  const yes = votes.filter(Boolean).length;
  const no = votes.length - yes;
  const origin = bill.origin === "ric" ? "✍️ Initiative citoyenne" : "🗳️ Projet de loi du maire";
  const embed = new EmbedBuilder()
    .setColor(closed ? (closed === "adoptée" ? 0x2ecc71 : 0xe74c3c) : 0x3498db)
    .setTitle(`${bill.action === "enact" ? law.emoji : "🗑️"} ${bill.action === "enact" ? "Projet de loi" : "Projet d'abrogation"} : ${law.name}`)
    .setDescription(
      `${origin}, proposé par **${pseudo(bill.by)}**\n\n` +
        `**${bill.action === "enact" ? effectOf(bill.key, bill.param, bill.custom) : `Supprimer la loi : ${effectOf(bill.key)}`}**` +
        (bill.motifs ? `\n\n**Exposé des motifs**\n*« ${bill.motifs} »*` : "") +
        (closed
          ? `\n\n**Résultat : ${closed.toUpperCase()}** — 👍 ${yes} pour · 👎 ${no} contre`
          : `\n\n🗳️ **${votes.length}** vote(s) · fin du scrutin ${ts(bill.until, "R")} · il faut au moins **${QUORUM}** votants`)
    )
    .setFooter({ text: closed ? "Scrutin clos" : "Vote secret : les résultats seront révélés à la clôture" })
    .setTimestamp();
  return embed;
}

async function createBill(client, { key, action, param, motifs, by, origin, custom }) {
  const id = nextId("b");
  const bill = { id, key, action, param, motifs, by, origin, custom, until: Date.now() + VOTE_MS, votes: {} };
  load().bills[id] = bill;
  save();
  const msg = await channelRef
    ?.send({
      content: "@here",
      allowedMentions: { parse: ["everyone"] },
      embeds: [billEmbed(bill)],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`loi_vote_yes_${id}`).setLabel("Pour").setEmoji("👍").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`loi_vote_no_${id}`).setLabel("Contre").setEmoji("👎").setStyle(ButtonStyle.Danger)
        ),
      ],
    })
    .catch(() => null);
  bill.messageId = msg?.id ?? null;
  save();
  await mairie().journal(client, `🗳️ Nouveau projet de loi — ${lawName(key, custom)}`, `Les citoyens votent jusqu'au ${ts(bill.until, "F")} dans <#${channelRef?.id}>.`, 0x3498db);
  await refreshCode(client);
}

async function closeBills(client) {
  const s = load();
  for (const bill of Object.values(s.bills)) {
    if (Date.now() < bill.until) continue;
    delete s.bills[bill.id];
    save();
    const votes = Object.values(bill.votes);
    const yes = votes.filter(Boolean).length;
    const no = votes.length - yes;
    let result;
    if (regime() === "anarchie") result = "annulée (anarchie)";
    else if (votes.length < QUORUM) result = "rejetée (moins de 5 votants)";
    else if (yes <= no) result = "rejetée";
    else if (bill.action === "enact" ? isActiveLaw(bill.key) : !isActiveLaw(bill.key)) result = "sans objet";
    else result = "adoptée";

    const msg = bill.messageId ? await channelRef?.messages.fetch(bill.messageId).catch(() => null) : null;
    await msg?.edit({ content: "", embeds: [billEmbed(bill, result)], components: [] }).catch(() => null);
    if (result === "adoptée") {
      await applyLaw(client, { ...bill, how: bill.origin === "ric" ? "initiative" : "vote", byUserId: bill.by });
    } else {
      await mairie().journal(client, `🗳️ Projet de loi ${result} — ${lawName(bill.key, bill.custom)}`, `👍 ${yes} pour · 👎 ${no} contre`, 0x95a5a6);
      await refreshCode(client);
    }
  }
}

// --- Initiatives citoyennes (pétitions) ---

async function signaturesNeeded(guild) {
  await guild.members.fetch().catch(() => null);
  const voters = [...guild.members.cache.values()].filter((m) => !m.user.bot && eligible(m)).length;
  return Math.max(3, Math.ceil(voters * 0.1));
}

function petitionEmbed(p, needed, status = null) {
  const law = { name: lawName(p.key) };
  return new EmbedBuilder()
    .setColor(status ? (status === "réussie" ? 0x2ecc71 : 0x95a5a6) : 0x9b59b6)
    .setTitle(`✍️ Initiative citoyenne : ${p.action === "enact" ? law.name : `abroger « ${law.name} »`}`)
    .setDescription(
      `Lancée par **${pseudo(p.by)}**\n\n**${p.action === "enact" ? effectOf(p.key, p.param) : `Supprimer : ${effectOf(p.key)}`}**` +
        (p.motifs ? `\n\n*« ${p.motifs} »*` : "") +
        `\n\n✍️ **${p.signatures.length} / ${needed}** signatures` +
        (status ? `\n\n**Pétition ${status}**` : ` · fin ${ts(p.until, "R")}`) +
        (status === "réussie" ? " : le projet part au vote des citoyens !" : "")
    )
    .setTimestamp();
}

async function createPetition(interaction, client, { key, action, param, motifs }) {
  const id = nextId("p");
  const p = { id, key, action, param, motifs, by: interaction.user.id, until: Date.now() + PETITION_MS, signatures: [interaction.user.id] };
  const needed = await signaturesNeeded(interaction.guild);
  p.needed = needed;
  load().petitions[id] = p;
  save();
  const msg = await channelRef
    ?.send({
      embeds: [petitionEmbed(p, needed)],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`loi_sign_${id}`).setLabel("Signer").setEmoji("✍️").setStyle(ButtonStyle.Success))],
    })
    .catch(() => null);
  p.messageId = msg?.id ?? null;
  save();
  await refreshCode(client);
  return interaction.reply({ content: `✍️ Initiative lancée dans <#${channelRef?.id}> : il faut **${needed}** signatures en 72 h.`, ephemeral: true });
}

async function closePetitions(client) {
  const s = load();
  for (const p of Object.values(s.petitions)) {
    if (Date.now() < p.until) continue;
    delete s.petitions[p.id];
    save();
    const msg = p.messageId ? await channelRef?.messages.fetch(p.messageId).catch(() => null) : null;
    await msg?.edit({ embeds: [petitionEmbed(p, p.needed, "échouée")], components: [] }).catch(() => null);
    await refreshCode(client);
  }
}

// --- Interactions ---

async function handleLoisInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("loi_")) return false;
  load();
  const r = regime();

  // Lancer une initiative citoyenne
  if (id === "loi_ric") {
    if (r === "anarchie") { await interaction.reply({ content: "🏴 En anarchie, il n'y a plus de lois.", ephemeral: true }); return true; }
    if (r === "dictature") { await interaction.reply({ content: "⚔️ Les initiatives citoyennes sont **interdites** par le régime.", ephemeral: true }); return true; }
    if (!eligible(interaction.member)) { await interaction.reply({ content: "❌ Il faut être membre depuis 7 jours.", ephemeral: true }); return true; }
    const rows = [lawSelect("loi_pick_enact_ric", "enact", "📜 Proposer une nouvelle loi"), lawSelect("loi_pick_repeal_ric", "repeal", "🗑️ Demander l'abrogation d'une loi")].filter(Boolean);
    await interaction.reply({ content: "✍️ Quelle loi voulez-vous proposer aux citoyens ?", components: rows, ephemeral: true });
    return true;
  }

  // Loi libre : le maire écrit son propre texte
  if (id === "loi_libre_maire" || id === "loi_libre_force") {
    if (!mairie().isMayor(interaction.user.id)) { await interaction.reply({ content: "❌ Réservé au maire.", ephemeral: true }); return true; }
    if (r === "anarchie") { await interaction.reply({ content: "🏴 En anarchie, il n'y a plus de lois.", ephemeral: true }); return true; }
    await interaction.showModal(libreModal(id.endsWith("force") ? "force" : "maire"));
    return true;
  }
  if (id.startsWith("loi_libre_m_")) {
    const origin = id.slice("loi_libre_m_".length);
    if (!mairie().isMayor(interaction.user.id)) { await interaction.reply({ content: "❌ Réservé au maire.", ephemeral: true }); return true; }
    if (r === "anarchie") { await interaction.reply({ content: "🏴 En anarchie, il n'y a plus de lois.", ephemeral: true }); return true; }
    const custom = { name: interaction.fields.getTextInputValue("titre").trim(), text: interaction.fields.getTextInputValue("texte").trim(), emoji: "📜" };
    const motifs = interaction.fields.getTextInputValue("motifs").trim();
    const key = nextId("libre");
    save();
    if (r === "democratie" && origin !== "force") {
      await createBill(client, { key, action: "enact", param: null, motifs, by: interaction.user.id, origin: "maire", custom });
      await interaction.reply({ content: `🗳️ Votre loi « ${custom.name} » est soumise au vote des citoyens dans <#${channelRef?.id}> pendant 48 h.`, ephemeral: true });
    } else {
      const how = r === "democratie" ? "force" : r === "monarchie" ? "edit" : "decret";
      await applyLaw(client, { key, action: "enact", param: null, motifs, how, byUserId: interaction.user.id, custom });
      await interaction.reply({ content: `${how === "force" ? "⚡" : how === "edit" ? "👑" : "⚔️"} La loi « ${custom.name} » est en vigueur.`, ephemeral: true });
    }
    return true;
  }

  // Choix d'une loi dans le menu → formulaire
  if (id.startsWith("loi_pick_")) {
    const [, , action, origin] = id.split("_");
    if ((origin === "maire" || origin === "force") && !mairie().isMayor(interaction.user.id)) { await interaction.reply({ content: "❌ Réservé au maire.", ephemeral: true }); return true; }
    await interaction.showModal(lawModal(action, interaction.values[0], origin));
    return true;
  }

  // Formulaire envoyé
  if (id.startsWith("loi_m_")) {
    const [, , action, key, origin] = id.split("_");
    const law = LAWS[key] ?? {};
    let param = null;
    if (action === "enact" && law.param) {
      param = Math.round(Number(interaction.fields.getTextInputValue("param").replace(",", ".").replace(/[^\d.]/g, "")));
      if (!Number.isFinite(param)) param = law.param.default;
      param = Math.min(law.param.max, Math.max(law.param.min, param));
    }
    const motifs = interaction.fields.getTextInputValue("motifs").trim();
    if (action === "enact" ? isActiveLaw(key) : !isActiveLaw(key)) { await interaction.reply({ content: "ℹ️ Cette loi a changé d'état entre-temps.", ephemeral: true }); return true; }
    if (Object.values(load().bills).some((b) => b.key === key)) { await interaction.reply({ content: "🗳️ Un vote est déjà en cours sur cette loi.", ephemeral: true }); return true; }

    if (origin === "ric") {
      if (r === "anarchie" || r === "dictature") { await interaction.reply({ content: "❌ Les initiatives citoyennes ne sont pas possibles sous ce régime.", ephemeral: true }); return true; }
      await createPetition(interaction, client, { key, action, param, motifs });
      return true;
    }
    if (!mairie().isMayor(interaction.user.id)) { await interaction.reply({ content: "❌ Réservé au maire.", ephemeral: true }); return true; }
    if (r === "anarchie") { await interaction.reply({ content: "🏴 En anarchie, il n'y a plus de lois.", ephemeral: true }); return true; }
    if (r === "democratie" && origin === "force") {
      await applyLaw(client, { key, action, param, motifs, how: "force", byUserId: interaction.user.id });
      await interaction.reply({ content: action === "enact" ? "⚡ Loi imposée sans vote : elle est en vigueur." : "⚡ Loi abrogée sans vote.", ephemeral: true });
    } else if (r === "democratie") {
      await createBill(client, { key, action, param, motifs, by: interaction.user.id, origin: "maire" });
      await interaction.reply({ content: `🗳️ Projet soumis au vote des citoyens dans <#${channelRef?.id}> pendant 48 h.`, ephemeral: true });
    } else {
      await applyLaw(client, { key, action, param, motifs, how: r === "monarchie" ? "edit" : "decret", byUserId: interaction.user.id });
      await interaction.reply({ content: r === "monarchie" ? "👑 Édit royal promulgué." : "⚔️ Décret imposé.", ephemeral: true });
    }
    return true;
  }

  // Vote d'un citoyen
  if (id.startsWith("loi_vote_")) {
    const [, , choice, billId] = id.split("_");
    const bill = load().bills[billId];
    if (!bill || Date.now() > bill.until) { await interaction.reply({ content: "❌ Ce scrutin est clos.", ephemeral: true }); return true; }
    if (!eligible(interaction.member)) { await interaction.reply({ content: "❌ Il faut être membre depuis 7 jours pour voter.", ephemeral: true }); return true; }
    const changed = bill.votes[interaction.user.id] !== undefined;
    bill.votes[interaction.user.id] = choice === "yes";
    save();
    await interaction.reply({ content: `✅ Vote ${changed ? "modifié" : "enregistré"} : **${choice === "yes" ? "pour" : "contre"}**. Il reste secret jusqu'à la clôture.`, ephemeral: true });
    const msg = bill.messageId ? await channelRef?.messages.fetch(bill.messageId).catch(() => null) : null;
    await msg?.edit({ embeds: [billEmbed(bill)] }).catch(() => null);
    return true;
  }

  // Signature d'une pétition
  if (id.startsWith("loi_sign_")) {
    const p = load().petitions[id.slice("loi_sign_".length)];
    if (!p || Date.now() > p.until) { await interaction.reply({ content: "❌ Cette pétition est close.", ephemeral: true }); return true; }
    if (!eligible(interaction.member)) { await interaction.reply({ content: "❌ Il faut être membre depuis 7 jours pour signer.", ephemeral: true }); return true; }
    if (p.signatures.includes(interaction.user.id)) { await interaction.reply({ content: "✍️ Vous avez déjà signé.", ephemeral: true }); return true; }
    p.signatures.push(interaction.user.id);
    save();
    if (p.signatures.length >= p.needed) {
      delete state.petitions[p.id];
      save();
      await interaction.update({ embeds: [petitionEmbed(p, p.needed, "réussie")], components: [] });
      await createBill(client, { key: p.key, action: p.action, param: p.param, motifs: p.motifs, by: p.by, origin: "ric" });
    } else {
      await interaction.update({ embeds: [petitionEmbed(p, p.needed)] });
    }
    return true;
  }
  return false;
}

async function setupLois(client) {
  load();
  const guild = await mairie().getGuild(client);
  const categoryId = mairie().getCategoryId();
  if (!guild || !categoryId) return;
  channelRef = await findOrCreateChannel(guild, {
    id: state.channelId,
    name: "📜・code-de-la-maison",
    parent: categoryId,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.MentionEveryone] },
    ],
  });
  state.channelId = channelRef.id;
  save();
  await refreshCode(client);
  let lastRegime = regime();
  setInterval(async () => {
    try {
      await closeBills(client);
      await closePetitions(client);
      if (regime() !== lastRegime) {
        lastRegime = regime();
        await refreshCode(client); // anarchie : lois suspendues / rétablies
      }
    } catch (err) {
      console.error("Lois:", err.message);
    }
  }, 60 * 1000);
  console.log("Lois prêtes");
}

module.exports = { setupLois, handleLoisInteraction, openMayorMenu, refreshCode };
