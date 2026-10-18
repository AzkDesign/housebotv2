// Voyage de la Maison : séjour aux États-Unis du 24 octobre au 2 novembre.
// Une annonce, un salon du voyage (compte à rebours, carnet des voyageurs) et des inscriptions :
// chaque demande part à l'administration, qui valide ou refuse. Pas de récompense : ce sont des vacances.
const fs = require("fs");
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { findOrCreateChannel } = require("./salons");
const { isGerant, GERANTS_ROLE_ID } = require("./economie");
const { getDossiersChannel } = require("./nettoyage");
const { pseudo } = require("./noms");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966";
const CHANNEL_NAME = "✈️・voyage";
const STATE_FILE = require("./data").dataFile("voyage-state.json");
// heures de Paris : départ le 24 octobre, retour le 2 novembre, inscriptions jusqu'au 21 octobre au soir
const TRIP = {
  name: "Voyage aux États-Unis",
  departure: Date.UTC(2026, 9, 23, 22, 0), // 24 octobre 2026, 0 h (heure d'été)
  back: Date.UTC(2026, 10, 1, 23, 0), // 2 novembre 2026, 0 h (heure d'hiver)
  deadline: Date.UTC(2026, 9, 21, 22, 0), // inscriptions closes le 22 octobre à 0 h
};
const STOPS = ["New York", "Las Vegas", "Los Angeles", "Miami"];

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
  ["playfair-display-700-italic.ttf", "CardItalic"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}

let state = null;
let channelRef = null;
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.travelers ??= {}; // userId -> { status: "attente" | "valide" | "refuse", at, note, dossierId }
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const ts = (ms, style = "R") => `<t:${Math.floor(ms / 1000)}:${style}>`;
const phase = () => (Date.now() < TRIP.deadline ? "inscriptions" : Date.now() < TRIP.departure ? "preparation" : Date.now() < TRIP.back ? "voyage" : "fini");
const withStatus = (s) => Object.entries(load().travelers).filter(([, t]) => t.status === s).map(([id]) => id);

// --- Affiche du voyage ---
function drawPoster() {
  const W = 1200, H = 520, c = createCanvas(W, H), ctx = c.getContext("2d");
  // ciel de fin de journée sur la côte
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#0b1d4a");
  sky.addColorStop(0.45, "#7c3aed");
  sky.addColorStop(0.75, "#f97316");
  sky.addColorStop(1, "#fbbf24");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // soleil
  const sun = ctx.createRadialGradient(W * 0.72, H * 0.78, 10, W * 0.72, H * 0.78, 260);
  sun.addColorStop(0, "rgba(255,247,214,1)");
  sun.addColorStop(0.25, "rgba(253,224,71,0.85)");
  sun.addColorStop(1, "rgba(253,224,71,0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
  // étoiles en haut
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 90; k++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H * 0.35, 0.6 + rnd() * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // gratte-ciel
  ctx.fillStyle = "#0a0f24";
  let x = 0;
  while (x < W) {
    const w = 30 + rnd() * 60, h = 70 + rnd() * 190;
    ctx.fillRect(x, H - h, w, h);
    if (rnd() < 0.3) ctx.fillRect(x + w / 2 - 2, H - h - 30, 4, 30); // antenne
    for (let wy = H - h + 12; wy < H - 10; wy += 16)
      for (let wx = x + 6; wx < x + w - 8; wx += 12) {
        if (rnd() < 0.35) {
          ctx.fillStyle = rnd() < 0.7 ? "rgba(253,224,71,0.85)" : "rgba(147,197,253,0.7)";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    ctx.fillStyle = "#0a0f24";
    x += w + 4;
  }
  // palmiers sur la droite
  const palm = (px, py, s) => {
    ctx.strokeStyle = "#05070f";
    ctx.lineWidth = 7 * s;
    ctx.beginPath();
    ctx.moveTo(px, H);
    ctx.quadraticCurveTo(px + 20 * s, py + 120 * s, px + 10 * s, py);
    ctx.stroke();
    ctx.fillStyle = "#05070f";
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.45;
      ctx.beginPath();
      ctx.ellipse(px + 10 * s + Math.cos(a) * 55 * s, py + Math.sin(a) * 30 * s + 10 * s, 58 * s, 11 * s, a, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  palm(1080, 300, 1.1);
  palm(1150, 340, 0.85);
  // avion et sa traînée
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 10]);
  ctx.beginPath();
  ctx.moveTo(540, 230);
  ctx.quadraticCurveTo(620, 80, 760, 120);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.translate(780, 124);
  ctx.rotate(0.18);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-18, -26);
  ctx.lineTo(-8, -26);
  ctx.lineTo(10, 0);
  ctx.lineTo(-8, 26);
  ctx.lineTo(-18, 26);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-28, 0);
  ctx.lineTo(-36, -14);
  ctx.lineTo(-30, -14);
  ctx.lineTo(-22, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // titres
  ctx.textAlign = "left";
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.fillText("L A   M A I S O N   P A R T   E N   V A C A N C E S", 60, 70);
  ctx.font = "84px CardTitle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(10,15,36,0.55)";
  ctx.strokeText("États-Unis", 60, 160);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("États-Unis", 60, 160);
  ctx.font = "30px CardItalic";
  ctx.fillStyle = "#fef3c7";
  ctx.fillText("du 24 octobre au 2 novembre", 64, 206);
  ctx.font = "16px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(STOPS.join("   ·   ").toUpperCase(), 64, 244);
  return c;
}

// --- Panneau du salon (compte à rebours + carnet des voyageurs) ---
function panelPayload() {
  const ph = phase(), ok = withStatus("valide"), wait = withStatus("attente");
  const when =
    ph === "inscriptions"
      ? `✍️ **Inscriptions ouvertes** jusqu'au **21 octobre** au soir (${ts(TRIP.deadline)}).\n🛫 Départ ${ts(TRIP.departure)} · 🛬 retour ${ts(TRIP.back)}`
      : ph === "preparation"
        ? `🔒 Les inscriptions sont closes.\n🛫 **Départ ${ts(TRIP.departure)}** · 🛬 retour ${ts(TRIP.back)}`
        : ph === "voyage"
          ? `🌴 **La Maison est en vacances aux États-Unis !**\n🛬 Retour ${ts(TRIP.back)}`
          : "🏡 **Le voyage est terminé.** Bon retour à la Maison !";
  const embed = new EmbedBuilder()
    .setColor(ph === "voyage" ? 0xf97316 : 0x7c3aed)
    .setTitle(`✈️ ${TRIP.name} — du 24 octobre au 2 novembre`)
    .setDescription(
      "Cette année, la Maison s'envole pour les **États-Unis** : New York, Las Vegas, Los Angeles et Miami. Dix jours de vacances, loin des bureaux et des affaires.\n\n" +
        `${when}\n\n` +
        (ph === "inscriptions" ? "Pour partir, cliquez sur **Je m'inscris** : votre demande est envoyée à l'**administration**, qui la valide ou la refuse. Vous êtes prévenu en message privé.\n" : "")
    )
    .addFields({
      name: `🧳 Carnet de voyage — ${ok.length} voyageur${ok.length > 1 ? "s" : ""}`,
      value: (ok.length ? ok.map((id) => `• ${pseudo(id)}`).join("\n").slice(0, 1000) : "*Personne pour l'instant.*") + (wait.length ? `\n\n⏳ ${wait.length} demande${wait.length > 1 ? "s" : ""} en attente de validation` : ""),
    })
    .setImage("attachment://voyage.jpg")
    .setFooter({ text: `Départ le 24 octobre · retour le 2 novembre · inscriptions jusqu'au 21 octobre` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("voyage_join").setLabel("Je m'inscris").setEmoji("✈️").setStyle(ButtonStyle.Success).setDisabled(ph !== "inscriptions"),
    new ButtonBuilder().setCustomId("voyage_leave").setLabel("Annuler mon inscription").setStyle(ButtonStyle.Secondary).setDisabled(ph === "voyage" || ph === "fini")
  );
  return { embeds: [embed], components: [row] };
}
let posterBuf = null;
async function refreshPanel() {
  if (!channelRef) return;
  const st = load();
  posterBuf ??= await drawPoster().encode("jpeg", 88);
  const payload = { ...panelPayload(), files: [new AttachmentBuilder(posterBuf, { name: "voyage.jpg" })] };
  let msg = st.panelId ? await channelRef.messages.fetch(st.panelId).catch(() => null) : null;
  if (msg) {
    // le texte change, l'affiche reste (pas besoin de la renvoyer)
    if (await msg.edit(panelPayload()).catch(() => null)) return;
    await msg.delete().catch(() => null);
  }
  msg = await channelRef.send(payload).catch(() => null);
  if (msg) {
    st.panelId = msg.id;
    save();
  }
}

// --- Dossier pour l'administration ---
function dossierPayload(userId, t) {
  const color = t.status === "valide" ? 0x22c55e : t.status === "refuse" ? 0xef4444 : 0xf59e0b;
  const label = t.status === "valide" ? "✅ Validé" : t.status === "refuse" ? "❌ Refusé" : "⏳ En attente";
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(color)
        .setTitle(`✈️ Demande de voyage — ${pseudo(userId)}`)
        .setDescription(`<@${userId}> veut partir au **${TRIP.name}** (du 24 octobre au 2 novembre).${t.note ? `\n\n💬 « ${t.note} »` : ""}\n\nStatut : **${label}**${t.by ? ` par <@${t.by}>` : ""}`)
        .setTimestamp(t.at),
    ],
    components:
      t.status === "attente"
        ? [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`voyage_ok_${userId}`).setLabel("Valider").setEmoji("✅").setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`voyage_no_${userId}`).setLabel("Refuser").setEmoji("❌").setStyle(ButtonStyle.Danger)
            ),
          ]
        : [],
  };
}

async function setupVoyage(client) {
  const st = load();
  const annonces = await client.channels.fetch(ANNOUNCE_CHANNEL_ID).catch(() => null);
  const guild = annonces?.guild ?? client.guilds.cache.first();
  if (!guild) return;
  channelRef = await findOrCreateChannel(guild, {
    id: st.channelId,
    name: CHANNEL_NAME,
    parent: annonces?.parentId ?? undefined,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.SendMessages] },
      { id: client.user.id, allow: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.AttachFiles] },
    ],
  });
  if (st.channelId !== channelRef.id) {
    st.channelId = channelRef.id;
    st.panelId = null;
    save();
  }
  await refreshPanel().catch((err) => console.error("Voyage (panneau):", err.message));
  // l'annonce, une seule fois
  if (!st.announced && annonces && Date.now() < TRIP.departure) {
    const poster = await drawPoster().encode("jpeg", 88);
    const sent = await annonces
      .send({
        content: "@everyone",
        allowedMentions: { parse: ["everyone"] },
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c3aed)
            .setTitle("✈️ La Maison part en vacances aux États-Unis !")
            .setDescription(
              "Du **24 octobre au 2 novembre**, la Maison s'envole pour les **États-Unis** : New York, Las Vegas, Los Angeles et Miami.\n\n" +
                `✍️ Vous voulez partir ? Inscrivez-vous dans ${channelRef} **avant le 22 octobre**.\n` +
                "🛂 Chaque inscription est examinée par l'**administration**, qui valide ou refuse le départ. Vous recevez la réponse en message privé.\n\n" +
                `🛫 Départ ${ts(TRIP.departure)} · 🛬 retour ${ts(TRIP.back)}`
            )
            .setImage("attachment://voyage.jpg"),
        ],
        files: [new AttachmentBuilder(poster, { name: "voyage.jpg" })],
      })
      .catch(() => null);
    if (sent) {
      st.announced = Date.now();
      save();
    }
  }
  // le compte à rebours s'affiche tout seul ; on rafraîchit pour les changements de phase
  let lastPhase = phase();
  setInterval(() => {
    if (phase() !== lastPhase) {
      lastPhase = phase();
      refreshPanel().catch(() => null);
    }
  }, 60000).unref?.();
}

async function handleVoyageInteraction(interaction, client) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("voyage_")) return false;
  const st = load(), userId = interaction.user.id;
  if (id === "voyage_join") {
    if (phase() !== "inscriptions") return void (await interaction.reply({ content: "🔒 Les inscriptions sont closes.", ephemeral: true })) || true;
    const t = st.travelers[userId];
    if (t?.status === "valide") return void (await interaction.reply({ content: "✅ Votre voyage est déjà **validé** : bonnes vacances !", ephemeral: true })) || true;
    if (t?.status === "attente") return void (await interaction.reply({ content: "⏳ Votre demande est déjà entre les mains de l'administration.", ephemeral: true })) || true;
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("voyage_form")
        .setTitle("✈️ Voyage aux États-Unis")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("note").setLabel("Un mot pour l'administration (facultatif)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)
          )
        )
    );
    return true;
  }
  if (id === "voyage_form") {
    if (phase() !== "inscriptions") return void (await interaction.reply({ content: "🔒 Les inscriptions sont closes.", ephemeral: true })) || true;
    const t = (st.travelers[userId] = { status: "attente", at: Date.now(), note: interaction.fields.getTextInputValue("note")?.trim() || null });
    save();
    await interaction.reply({ content: "📨 Votre demande de voyage est envoyée à l'**administration**. Vous recevrez la réponse en message privé.", ephemeral: true });
    const dossiers = await getDossiersChannel(client).catch(() => null);
    const msg = await dossiers?.send({ content: `<@&${GERANTS_ROLE_ID}>`, allowedMentions: { roles: [GERANTS_ROLE_ID] }, ...dossierPayload(userId, t) }).catch(() => null);
    if (msg) {
      t.dossier = { c: msg.channelId, m: msg.id };
      save();
    }
    await refreshPanel().catch(() => null);
    return true;
  }
  if (id === "voyage_leave") {
    const t = st.travelers[userId];
    if (!t || t.status === "refuse") return void (await interaction.reply({ content: "Vous n'êtes pas inscrit au voyage.", ephemeral: true })) || true;
    delete st.travelers[userId];
    save();
    await interaction.reply({ content: "🧳 Votre inscription au voyage est annulée.", ephemeral: true });
    if (t.dossier) {
      const ch = await client.channels.fetch(t.dossier.c).catch(() => null);
      const m = await ch?.messages.fetch(t.dossier.m).catch(() => null);
      await m?.edit({ embeds: [EmbedBuilder.from(m.embeds[0]).setColor(0x64748b).setDescription(`${m.embeds[0].description}\n\n🧳 *Inscription annulée par le membre.*`)], components: [] }).catch(() => null);
    }
    await refreshPanel().catch(() => null);
    return true;
  }
  const dec = /^voyage_(ok|no)_(\d+)$/.exec(id);
  if (dec) {
    if (!isGerant(interaction.member)) return void (await interaction.reply({ content: "❌ Seule l'administration peut valider les voyages.", ephemeral: true })) || true;
    const target = dec[2], t = st.travelers[target];
    if (!t || t.status !== "attente") return void (await interaction.update({ components: [] }).catch(() => null)) || true;
    t.status = dec[1] === "ok" ? "valide" : "refuse";
    t.by = userId;
    save();
    await interaction.update(dossierPayload(target, t));
    const dm =
      t.status === "valide"
        ? `✈️ **Votre voyage aux États-Unis est validé !** Départ le **24 octobre**, retour le **2 novembre**. Préparez vos valises : bonnes vacances !`
        : `🛂 Votre demande pour le voyage aux États-Unis a été **refusée** par l'administration.`;
    await client.users.fetch(target).then((u) => u.send(dm)).catch(() => null);
    await refreshPanel().catch(() => null);
    return true;
  }
  return false;
}

module.exports = { setupVoyage, handleVoyageInteraction, drawPoster };
