// Enchères : un membre (ou la Direction) met en vente ce qu'il veut avec /enchere. Rien n'est lancé automatiquement.
// L'argent de la meilleure offre est bloqué ; le précédent enchérisseur est remboursé dès qu'il est dépassé.
// Une offre dans les 5 dernières minutes prolonge la vente de 5 minutes. À la fin, le vendeur est payé.
const fs = require("fs");
const path = require("path");
const { createCanvas, loadImage, GlobalFonts } = require("@napi-rs/canvas");
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
const { changeBalance, readBalance, isFrozen, formatEuro } = require("./economie");
const { pseudo } = require("./noms");

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon est rangé à côté des annonces
const CHANNEL_NAME = "🔨・enchères";
const MIN_STEP = 0.05; // une offre dépasse la précédente d'au moins 5 % (et 10 €)
const SNIPE_MS = 5 * 60000;
const MAX_OPEN_PER_SELLER = 2;
const STATE_FILE = require("./data").dataFile("encheres-state.json");

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
const timers = new Map();
function load() {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    state = {};
  }
  state.next ??= 1;
  state.auctions ??= {};
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
const round2 = (n) => Math.round(n * 100) / 100;
const minBid = (a) => (a.bid ? Math.ceil(Math.max(a.bid + 10, a.bid * (1 + MIN_STEP))) : a.start);
const lotNo = (n) => String(n).padStart(3, "0");

// --- Image du lot ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrap(ctx, text, maxW) {
  const lines = [];
  for (const para of String(text).split(/\n/)) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
function spaced(ctx, text, x, y, gap) {
  const chars = [...text];
  const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width, 0) + gap * (chars.length - 1);
  let cx = x - (ctx.textAlign === "center" ? total / 2 : 0);
  const align = ctx.textAlign;
  ctx.textAlign = "left";
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + gap;
  }
  ctx.textAlign = align;
}
function gavel(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.6);
  const g = ctx.createLinearGradient(-s, 0, s, 0);
  g.addColorStop(0, "#7a5414");
  g.addColorStop(0.5, "#fde68a");
  g.addColorStop(1, "#b8862b");
  ctx.fillStyle = g;
  roundRect(ctx, -s * 0.55, -s * 0.22, s * 1.1, s * 0.44, s * 0.08);
  ctx.fill();
  ctx.fillRect(-s * 0.07, s * 0.2, s * 0.14, s * 0.95);
  ctx.restore();
}
async function drawLot(a) {
  const W = 1100, H = 620, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1c1408");
  bg.addColorStop(1, "#070503");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(330, 300, 30, 330, 300, 420);
  glow.addColorStop(0, "rgba(253,230,138,0.20)");
  glow.addColorStop(1, "rgba(253,230,138,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#b8862b";
  ctx.lineWidth = 2;
  roundRect(ctx, 18, 18, W - 36, H - 36, 14);
  ctx.stroke();
  // vitrine de l'objet
  const img = a.image ? await loadImage(a.image).catch(() => null) : null;
  const bx = 56, by = 70, bw = 520, bh = 480;
  ctx.save();
  roundRect(ctx, bx, by, bw, bh, 18);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.clip();
  if (img) {
    const k = Math.max(bw / img.width, bh / img.height);
    ctx.drawImage(img, bx + (bw - img.width * k) / 2, by + (bh - img.height * k) / 2, img.width * k, img.height * k);
  } else gavel(ctx, bx + bw / 2, by + bh / 2 - 20, 150);
  ctx.restore();
  ctx.strokeStyle = "rgba(253,230,138,0.45)";
  roundRect(ctx, bx, by, bw, bh, 18);
  ctx.stroke();
  // fiche du lot
  const x = 620, done = a.status !== "open";
  ctx.textAlign = "left";
  ctx.font = "17px CardEngrave";
  ctx.fillStyle = "#e9c46a";
  spaced(ctx, `VENTE AUX ENCHÈRES · LOT N° ${lotNo(a.no)}`, x, 104, 3);
  ctx.font = "44px CardTitle";
  ctx.fillStyle = "#ffffff";
  const t = wrap(ctx, a.title, 430).slice(0, 2);
  t.forEach((l, i) => ctx.fillText(l, x, 160 + i * 50));
  let y = 160 + t.length * 50;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#d6c5a3";
  const d = wrap(ctx, a.description || "", 430);
  d.slice(0, 3).forEach((l, i) => ctx.fillText(i === 2 && d.length > 3 ? `${l.replace(/\s*\S*$/, "")}…` : l, x, y + 4 + i * 27));
  y += Math.min(3, d.length) * 27 + 34;
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#9a7a45";
  spaced(ctx, done ? (a.bid ? "ADJUGÉ À" : "INVENDU") : a.bid ? "MEILLEURE OFFRE" : "MISE À PRIX", x, y, 3);
  ctx.font = "64px CardTitle";
  ctx.fillStyle = done && a.bid ? "#86efac" : "#fde68a";
  ctx.fillText(formatEuro(a.bid || a.start), x, y + 66);
  ctx.font = "20px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(a.bid ? `par ${a.bidderName}` : done ? "Aucune offre" : "Aucune offre pour le moment", x, y + 104);
  ctx.font = "16px CardText";
  ctx.fillStyle = "#c9b48a";
  ctx.fillText(`${a.bids?.length ?? 0} offre${(a.bids?.length ?? 0) > 1 ? "s" : ""} · vendu par ${a.sellerName}`, x, y + 136);
  if (done && a.bid) {
    ctx.save();
    ctx.translate(bx + bw - 110, by + 70);
    ctx.rotate(-0.25);
    ctx.strokeStyle = "#16a34a";
    ctx.lineWidth = 5;
    roundRect(ctx, -95, -32, 190, 64, 8);
    ctx.stroke();
    ctx.font = "34px CardTitle";
    ctx.fillStyle = "#16a34a";
    ctx.textAlign = "center";
    ctx.fillText("ADJUGÉ", 0, 12);
    ctx.restore();
  }
  return c;
}

// --- Messages ---
function lotPayload(a) {
  const open = a.status === "open";
  const unix = Math.floor(a.endsAt / 1000);
  const history = (a.bids ?? [])
    .slice(-3)
    .reverse()
    .map((b) => `• **${formatEuro(b.amount)}** par ${b.name} <t:${Math.floor(b.at / 1000)}:R>`)
    .join("\n");
  const embed = new EmbedBuilder()
    .setColor(open ? 0xd4af37 : a.bid ? 0x16a34a : 0x6b7280)
    .setTitle(`🔨 Lot n° ${lotNo(a.no)} — ${a.title}`.slice(0, 256))
    .setDescription(
      (open
        ? `Fin de la vente <t:${unix}:R> (<t:${unix}:f>)\nProchaine offre minimum : **${formatEuro(minBid(a))}**`
        : a.status === "cancelled"
          ? "🗑️ Vente annulée par le vendeur."
          : a.bid
            ? `🎉 **Adjugé à ${a.bidderName}** pour **${formatEuro(a.bid)}** !`
            : "Vente terminée sans offre.") + (history ? `\n\n**Dernières offres**\n${history}` : "")
    )
    .setImage("attachment://lot.png")
    .setFooter({ text: open ? "Votre argent est bloqué tant que vous êtes le meilleur enchérisseur ; il vous est rendu si quelqu'un vous dépasse." : `Vendu par ${a.sellerName}` });
  return {
    embeds: [embed],
    components: open
      ? [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ench_bid_${a.no}`).setLabel(`Enchérir (${formatEuro(minBid(a))} min.)`).setEmoji("🔨").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ench_x_${a.no}`).setLabel("Annuler la vente").setStyle(ButtonStyle.Secondary).setDisabled(Boolean(a.bid))
          ),
        ]
      : [],
  };
}
async function withImage(a) {
  return { ...lotPayload(a), files: [new AttachmentBuilder(await (await drawLot(a)).encode("png"), { name: "lot.png" })], attachments: [] };
}
async function refreshLot(a, client) {
  const ch = channelRef ?? (await client.channels.fetch(load().channelId).catch(() => null));
  const msg = a.messageId ? await ch?.messages.fetch(a.messageId).catch(() => null) : null;
  await msg?.edit(await withImage(a)).catch(() => null);
}

// --- Fin de vente ---
function schedule(a, client) {
  clearTimeout(timers.get(a.no));
  const ms = Math.max(1000, a.endsAt - Date.now());
  timers.set(a.no, setTimeout(() => closeAuction(a.no, client).catch((err) => console.error("Enchères:", err.message)), Math.min(ms, 2 ** 31 - 1)));
}
async function closeAuction(no, client) {
  const a = load().auctions[no];
  if (!a || a.status !== "open") return;
  if (Date.now() < a.endsAt - 500) return schedule(a, client);
  a.status = "done";
  save();
  if (a.bid) {
    changeBalance(a.sellerId, a.bid, `Enchères — vente du lot n° ${lotNo(a.no)}`, { force: true });
    client.users.fetch(a.bidderId).then((u) => u.send(`🎉 **Adjugé !** Vous remportez **${a.title}** pour **${formatEuro(a.bid)}**. Voyez avec ${a.sellerName} pour la remise.`)).catch(() => null);
    client.users.fetch(a.sellerId).then((u) => u.send(`💰 Votre lot **${a.title}** est vendu à **${a.bidderName}** pour **${formatEuro(a.bid)}** (versés sur votre compte).`)).catch(() => null);
  } else client.users.fetch(a.sellerId).then((u) => u.send(`🔨 Votre lot **${a.title}** n'a reçu aucune offre.`)).catch(() => null);
  await refreshLot(a, client);
  const ch = channelRef ?? (await client.channels.fetch(load().channelId).catch(() => null));
  if (a.bid) await ch?.send(`🔨 **Adjugé !** Lot n° ${lotNo(a.no)} « ${a.title} » : **${a.bidderName}** l'emporte pour **${formatEuro(a.bid)}**.`).catch(() => null);
}

async function setupEncheres(client) {
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
    save();
    await channelRef
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(0xd4af37)
            .setTitle("🔨 Les enchères de la Maison")
            .setDescription(
              "Vous voulez vendre quelque chose au plus offrant ? Lancez une vente avec `/enchere` : un objet, un service, une place, une faveur…\n\n" +
                "• Chacun enchérit avec le bouton **🔨 Enchérir**. Une offre doit dépasser la précédente d'au moins **5 %**.\n" +
                "• L'argent du meilleur enchérisseur est **bloqué**, et **rendu** dès que quelqu'un le dépasse.\n" +
                "• Une offre dans les **5 dernières minutes** prolonge la vente de 5 minutes : pas de vol à la dernière seconde.\n" +
                "• À la fin, le vendeur est payé automatiquement. La remise de l'objet se fait entre vous."
            ),
        ],
      })
      .catch(() => null);
  }
  for (const a of Object.values(st.auctions)) if (a.status === "open") schedule(a, client);
  console.log("Enchères prêtes");
}

// --- Interactions ---
async function handleEncheresInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "enchere") {
    const st = load(), userId = interaction.user.id;
    if (Object.values(st.auctions).filter((a) => a.sellerId === userId && a.status === "open").length >= MAX_OPEN_PER_SELLER) {
      await interaction.reply({ content: `🔨 Vous avez déjà ${MAX_OPEN_PER_SELLER} ventes en cours.`, ephemeral: true });
      return true;
    }
    const image = interaction.options.getAttachment("image");
    if (image && !/^image\//.test(image.contentType ?? "")) {
      await interaction.reply({ content: "❌ La pièce jointe doit être une image.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const a = {
      no: st.next++,
      sellerId: userId,
      sellerName: interaction.member?.displayName ?? interaction.user.username,
      title: interaction.options.getString("objet").slice(0, 80),
      description: interaction.options.getString("description")?.slice(0, 300) ?? "",
      start: interaction.options.getInteger("prix"),
      image: image?.url ?? null,
      endsAt: Date.now() + interaction.options.getInteger("duree") * 3600000,
      status: "open",
      bid: 0,
      bids: [],
    };
    const ch = channelRef ?? (await client.channels.fetch(st.channelId).catch(() => null));
    if (!ch) {
      st.next--;
      await interaction.editReply("❌ Le salon des enchères est introuvable.");
      return true;
    }
    // le lien de l'image envoyée à Discord expire : on garde une copie avec les données du bot
    if (a.image) {
      const buf = await fetch(a.image).then((r) => r.arrayBuffer()).catch(() => null);
      a.image = null;
      if (buf && buf.byteLength < 8_000_000) {
        const dir = path.join(require("./data").DATA_DIR, "encheres");
        fs.mkdirSync(dir, { recursive: true });
        a.image = path.join(dir, `lot-${a.no}`);
        fs.writeFileSync(a.image, Buffer.from(buf));
      }
    }
    const msg = await ch.send(await withImage(a));
    a.messageId = msg.id;
    st.auctions[a.no] = a;
    save();
    schedule(a, client);
    await interaction.editReply(`✅ Votre vente est en ligne : ${msg.url}`);
    return true;
  }

  const id = interaction.customId;
  const m = typeof id === "string" ? /^ench_(bid|bm|x)_(\d+)$/.exec(id) : null;
  if (!m) return false;
  const [, action, no] = m;
  const a = load().auctions[no], userId = interaction.user.id;
  if (!a || a.status !== "open" || Date.now() >= a.endsAt) {
    await interaction.reply({ content: "🔨 Cette vente est terminée.", ephemeral: true });
    return true;
  }
  if (action === "x") {
    if (userId !== a.sellerId) return interaction.reply({ content: "⛔ Seul le vendeur peut annuler sa vente.", ephemeral: true }).then(() => true);
    if (a.bid) return interaction.reply({ content: "❌ Impossible d'annuler : il y a déjà une offre.", ephemeral: true }).then(() => true);
    a.status = "cancelled";
    clearTimeout(timers.get(a.no));
    save();
    await interaction.update(await withImage(a));
    return true;
  }
  if (userId === a.sellerId) return interaction.reply({ content: "⛔ Vous ne pouvez pas enchérir sur votre propre vente.", ephemeral: true }).then(() => true);
  if (action === "bid") {
    if (a.bidderId === userId) return interaction.reply({ content: `👑 Vous êtes déjà le meilleur enchérisseur (${formatEuro(a.bid)}).`, ephemeral: true }).then(() => true);
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`ench_bm_${a.no}`)
        .setTitle(`🔨 ${a.title}`.slice(0, 45))
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("amount").setLabel(`Votre offre (minimum ${minBid(a)} €)`.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10).setValue(String(minBid(a)))
          )
        )
    );
    return true;
  }
  if (action === "bm") {
    const amount = parseInt(interaction.fields.getTextInputValue("amount").replace(/[^\d]/g, ""), 10);
    if (!Number.isFinite(amount) || amount < minBid(a)) return interaction.reply({ content: `❌ L'offre minimum est de **${formatEuro(minBid(a))}**.`, ephemeral: true }).then(() => true);
    if (isFrozen(userId)) return interaction.reply({ content: "🔒 Votre compte est gelé par l'IRF.", ephemeral: true }).then(() => true);
    if (a.bidderId === userId) return interaction.reply({ content: "👑 Vous êtes déjà le meilleur enchérisseur.", ephemeral: true }).then(() => true);
    if (changeBalance(userId, -amount, `Enchères — offre sur le lot n° ${lotNo(a.no)} (bloquée)`) === null)
      return interaction.reply({ content: `❌ Solde insuffisant (vous avez **${formatEuro(readBalance(userId))}**).`, ephemeral: true }).then(() => true);
    // l'ancien meilleur enchérisseur est remboursé et prévenu
    const prev = a.bidderId ? { id: a.bidderId, amount: a.bid } : null;
    if (prev) changeBalance(prev.id, prev.amount, `Enchères — offre dépassée sur le lot n° ${lotNo(a.no)} (remboursée)`, { force: true });
    const name = interaction.member?.displayName ?? interaction.user.username;
    a.bid = amount;
    a.bidderId = userId;
    a.bidderName = name;
    a.bids.push({ id: userId, name, amount, at: Date.now() });
    let note = "";
    if (a.endsAt - Date.now() < SNIPE_MS) {
      a.endsAt = Date.now() + SNIPE_MS;
      note = "\n⏱️ Offre de dernière minute : la vente est prolongée de 5 minutes.";
      schedule(a, client);
    }
    save();
    await interaction.reply({ content: `🔨 Offre de **${formatEuro(amount)}** enregistrée : vous êtes en tête ! (montant bloqué, rendu si quelqu'un vous dépasse)${note}`, ephemeral: true });
    await refreshLot(a, client);
    if (prev)
      client.users
        .fetch(prev.id)
        .then((u) => u.send(`⚠️ **${name}** a surenchéri sur **${a.title}** : **${formatEuro(amount)}**. Vos ${formatEuro(prev.amount)} vous sont rendus. Reprendre la main : ${channelRef?.url ?? ""}`))
        .catch(() => null);
    return true;
  }
  return false;
}

module.exports = { setupEncheres, handleEncheresInteraction, drawLot, minBid };
