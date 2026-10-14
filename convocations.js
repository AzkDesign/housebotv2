// Convocations : la Direction convoque un membre dans le Bureau de la Chef Chloé (par défaut pour le lendemain).
// /convocation membre heure motif [jour] → une lettre officielle (image) dans le salon des convocations, un MP au membre,
// le membre confirme ou demande un autre horaire, et il reçoit un rappel 30 minutes avant.
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

const ANNOUNCE_CHANNEL_ID = "1509983723892903966"; // le salon est rangé à côté des annonces
const GERANTS_ROLE_ID = "1509985135565475850";
const FONDATION_ROLE_ID = "1509979964651343993";
const CHANNEL_NAME = "📋・convocations";
const PLACE = "Bureau de la Chef Chloé";
const REMINDER_BEFORE = 30 * 60000;
const STATE_FILE = require("./data").dataFile("convocations-state.json");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["playfair-display-700.ttf", "CardSerif"],
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
  state.channelId ??= null;
  state.next ??= 1;
  state.list ??= {};
  return state;
}
function save() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// --- Heures de Paris ---
const TZ = "Europe/Paris";
function parisParts(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  );
  return { y: +parts.year, m: +parts.month, d: +parts.day, h: +parts.hour, min: +parts.minute };
}
// instant (ms) correspondant à une date et une heure de Paris
function parisTime(y, m, d, h, min) {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const p = parisParts(guess);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - guess;
  return guess - offset;
}
// « 14h30 », « 14:30 », « 9h », « 9 h 05 »
function parseHour(text) {
  const m = /^\s*(\d{1,2})\s*(?:h|:|H)?\s*(\d{2})?\s*$/.exec(String(text ?? ""));
  if (!m) return null;
  const h = +m[1], min = +(m[2] ?? 0);
  return h <= 23 && min <= 59 ? { h, min } : null;
}
const DAY_OFFSETS = { aujourdhui: 0, demain: 1, apres_demain: 2 };
function meetingTime(day, hour) {
  const today = parisParts(Date.now());
  const base = new Date(Date.UTC(today.y, today.m - 1, today.d + (DAY_OFFSETS[day] ?? 1)));
  return parisTime(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour.h, hour.min);
}
const fmt = (ms, opts) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts }).format(new Date(ms));
const dateText = (ms) => fmt(ms, { weekday: "long", day: "numeric", month: "long" });
const hourText = (ms) => fmt(ms, { hour: "2-digit", minute: "2-digit" }).replace(":", " h ");
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// --- Lettre de convocation (image) ---
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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
function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const GOLD = ["#fff3c4", "#e9c46a", "#b8862b", "#7a5414"];
function goldGradient(ctx, x0, y0, x1, y1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, GOLD[2]);
  g.addColorStop(0.35, GOLD[0]);
  g.addColorStop(0.55, GOLD[1]);
  g.addColorStop(1, GOLD[3]);
  return g;
}
function waxSeal(ctx, x, y, r) {
  ctx.save();
  ctx.shadowColor = "rgba(60,0,0,0.45)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  // bord irrégulier de la cire
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2, rr = r * (1 + 0.06 * Math.sin(i * 2.7) + 0.03 * Math.cos(i * 5.1));
    ctx[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
  g.addColorStop(0, "#d64545");
  g.addColorStop(0.6, "#9b1c1c");
  g.addColorStop(1, "#5c0b0b");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,200,200,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(60,0,0,0.55)";
  ctx.textAlign = "center";
  ctx.font = `${Math.round(r * 0.8)}px CardTitle`;
  ctx.fillText("M", x + 1, y + r * 0.3 + 2);
  ctx.fillStyle = "#f3b4b4";
  ctx.fillText("M", x, y + r * 0.3);
}

async function drawConvocation(cv) {
  const W = 1200, H = 900, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // bureau sombre derrière la feuille
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#2a1d14");
  bg.addColorStop(1, "#120b07");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // la feuille
  const px = 50, py = 40, pw = W - 100, ph = H - 80;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 14;
  roundRect(ctx, px, py, pw, ph, 10);
  const paper = ctx.createLinearGradient(px, py, px + pw, py + ph);
  paper.addColorStop(0, "#fbf6ea");
  paper.addColorStop(0.5, "#f6eedb");
  paper.addColorStop(1, "#efe3c6");
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.restore();
  // grain du papier
  const R = seeded(cv.no * 7919);
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 10);
  ctx.clip();
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(120,90,40,${R() * 0.05})`;
    ctx.fillRect(px + R() * pw, py + R() * ph, 1 + R() * 2, 1 + R() * 2);
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 760);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(120,80,20,0.18)");
  ctx.fillStyle = vig;
  ctx.fillRect(px, py, pw, ph);
  ctx.restore();
  // double filet doré
  ctx.strokeStyle = goldGradient(ctx, px, py, px + pw, py + ph);
  ctx.lineWidth = 3;
  roundRect(ctx, px + 22, py + 22, pw - 44, ph - 44, 6);
  ctx.stroke();
  ctx.lineWidth = 1;
  roundRect(ctx, px + 32, py + 32, pw - 64, ph - 64, 4);
  ctx.stroke();
  // coins ornés
  for (const [cx, cy] of [[px + 32, py + 32], [px + pw - 32, py + 32], [px + 32, py + ph - 32], [px + pw - 32, py + ph - 32]]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = goldGradient(ctx, -9, -9, 9, 9);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  ctx.textAlign = "center";
  // en-tête
  ctx.fillStyle = "#8a6420";
  ctx.font = "20px CardEngrave";
  spaced(ctx, "LA MAISON · DIRECTION", W / 2, py + 86, 6);
  ctx.fillStyle = "#1f1408";
  ctx.font = "78px CardTitle";
  spaced(ctx, "CONVOCATION", W / 2, py + 170, 8);
  ctx.strokeStyle = goldGradient(ctx, W / 2 - 220, 0, W / 2 + 220, 0);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 220, py + 196);
  ctx.lineTo(W / 2 - 18, py + 196);
  ctx.moveTo(W / 2 + 18, py + 196);
  ctx.lineTo(W / 2 + 220, py + 196);
  ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, py + 196);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = GOLD[2];
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.font = "16px CardBold";
  ctx.fillStyle = "#9a7a45";
  spaced(ctx, `N° ${String(cv.no).padStart(3, "0")} · ÉMISE LE ${fmt(cv.at, { day: "numeric", month: "long", year: "numeric" }).toUpperCase()}`, W / 2, py + 228, 2);

  // destinataire avec son avatar
  const av = cv.avatar ? await loadImage(cv.avatar).catch(() => null) : null;
  const ay = py + 300;
  ctx.font = "22px CardItalic";
  ctx.fillStyle = "#6b5330";
  ctx.fillText("À l'attention de", W / 2, ay - 20);
  ctx.font = "46px CardSerif";
  const name = cv.name.length > 28 ? `${cv.name.slice(0, 27)}…` : cv.name;
  const nw = ctx.measureText(name).width, ar = 28, gap = av ? ar * 2 + 18 : 0;
  const nx = W / 2 - (nw + gap) / 2;
  if (av) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(nx + ar, ay + 22, ar, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(av, nx, ay + 22 - ar, ar * 2, ar * 2);
    ctx.restore();
    ctx.strokeStyle = GOLD[2];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(nx + ar, ay + 22, ar + 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = "left";
  ctx.fillStyle = "#1f1408";
  ctx.fillText(name, nx + gap, ay + 38);
  ctx.textAlign = "center";

  ctx.font = "24px CardText";
  ctx.fillStyle = "#3b2c17";
  ctx.fillText("Vous êtes prié(e) de vous présenter au", W / 2, py + 412);
  ctx.font = "34px CardTitle";
  ctx.fillStyle = "#7a1d1d";
  ctx.fillText(PLACE, W / 2, py + 456);

  // date · heure · lieu
  const boxes = [
    ["DATE", cap(dateText(cv.when))],
    ["HEURE", hourText(cv.when)],
    ["LIEU", "Bureau de la Chef"],
  ];
  const bw = 300, bh = 96, bgap = 26, bx0 = W / 2 - (bw * 3 + bgap * 2) / 2, by = py + 494;
  for (const [i, [label, value]] of boxes.entries()) {
    const bx = bx0 + i * (bw + bgap);
    roundRect(ctx, bx, by, bw, bh, 10);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fill();
    ctx.strokeStyle = "rgba(184,134,43,0.65)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#9a7a45";
    spaced(ctx, label, bx + bw / 2, by + 32, 4);
    ctx.font = `${value.length > 18 ? 24 : 30}px CardSerif`;
    ctx.fillStyle = "#1f1408";
    ctx.fillText(value, bx + bw / 2, by + 72);
  }

  // motif
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#9a7a45";
  ctx.textAlign = "left";
  const mx = px + 90;
  spaced(ctx, "MOTIF", mx, py + 640, 4);
  ctx.font = "22px CardItalic";
  ctx.fillStyle = "#3b2c17";
  const lines = wrap(ctx, cv.reason, 530).slice(0, 3);
  if (wrap(ctx, cv.reason, 530).length > 3) lines[2] = `${lines[2].replace(/\s*\S*$/, "")}…`;
  lines.forEach((l, i) => ctx.fillText(l, mx, py + 674 + i * 30));

  // signature et sceau
  const sx = px + pw - 330;
  ctx.textAlign = "center";
  ctx.font = "44px CardItalic";
  ctx.fillStyle = "#1e3a5f";
  ctx.save();
  ctx.translate(sx, py + 680);
  ctx.rotate(-0.06);
  ctx.fillText("Chloé", 0, 0);
  ctx.restore();
  ctx.strokeStyle = "rgba(30,58,95,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx - 90, py + 696);
  ctx.lineTo(sx + 90, py + 692);
  ctx.stroke();
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#6b5330";
  ctx.fillText("La Chef de la Maison", sx, py + 720);
  ctx.font = "13px CardText";
  ctx.fillText("& la Direction", sx, py + 740);
  waxSeal(ctx, px + pw - 128, py + 700, 46);

  // mention du bas
  ctx.font = "14px CardText";
  ctx.fillStyle = "#9a7a45";
  ctx.fillText("Merci de confirmer votre présence avec le bouton sous cette convocation.", W / 2, py + ph - 48);
  return c;
}

// --- Messages ---
const STATUS = {
  pending: ["⏳ En attente de confirmation", 0xe9c46a],
  confirmed: ["✅ Présence confirmée", 0x16a34a],
  reschedule: ["📅 Demande un autre horaire", 0x2563eb],
  cancelled: ["✖️ Convocation annulée", 0x6b7280],
  done: ["📁 Rendez-vous passé", 0x6b7280],
};
function convEmbed(cv) {
  const [label, color] = STATUS[cv.status] ?? STATUS.pending;
  const unix = Math.floor(cv.when / 1000);
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📋 Convocation n° ${String(cv.no).padStart(3, "0")}`)
    .setDescription(
      `<@${cv.userId}>, vous êtes convoqué(e) au **${PLACE}**.\n\n` +
        `🗓️ **<t:${unix}:F>** (<t:${unix}:R>)\n` +
        `📝 **Motif :** ${cv.reason}`
    )
    .addFields({ name: "Statut", value: label + (cv.note ? `\n> ${cv.note}` : "") })
    .setImage("attachment://convocation.png")
    .setFooter({ text: `Convoqué(e) par ${cv.byName}` });
  return e;
}
function convButtons(cv) {
  if (["cancelled", "done"].includes(cv.status)) return [];
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`conv_ok_${cv.no}`).setLabel("Je serai présent(e)").setEmoji("✅").setStyle(ButtonStyle.Success).setDisabled(cv.status === "confirmed"),
      new ButtonBuilder().setCustomId(`conv_autre_${cv.no}`).setLabel("Demander un autre horaire").setEmoji("📅").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`conv_x_${cv.no}`).setLabel("Annuler (Direction)").setStyle(ButtonStyle.Danger)
    ),
  ];
}
async function convPayload(cv, withImage = true) {
  return {
    embeds: [convEmbed(cv)],
    components: convButtons(cv),
    ...(withImage ? { files: [new AttachmentBuilder(await (await drawConvocation(cv)).encode("png"), { name: "convocation.png" })] } : {}),
  };
}
async function refreshMessage(cv, client) {
  const ch = channelRef ?? (await client.channels.fetch(load().channelId).catch(() => null));
  const msg = cv.messageId ? await ch?.messages.fetch(cv.messageId).catch(() => null) : null;
  await msg?.edit(await convPayload(cv, false)).catch(() => null);
}

function isDirection(member) {
  return (
    member?.roles?.cache?.has(GERANTS_ROLE_ID) ||
    member?.roles?.cache?.has(FONDATION_ROLE_ID) ||
    member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
    false
  );
}

// --- Rappels : 30 minutes avant, puis classement une fois l'heure passée ---
async function tick(client) {
  const st = load();
  for (const cv of Object.values(st.list)) {
    if (["cancelled", "done"].includes(cv.status)) continue;
    const now = Date.now();
    if (!cv.reminded && now >= cv.when - REMINDER_BEFORE && now < cv.when) {
      cv.reminded = true;
      save();
      const unix = Math.floor(cv.when / 1000);
      const user = await client.users.fetch(cv.userId).catch(() => null);
      await user?.send(`⏰ **Rappel** : vous êtes attendu(e) au **${PLACE}** <t:${unix}:R> (à <t:${unix}:t>).\n📝 Motif : ${cv.reason}`).catch(() => null);
    }
    if (now >= cv.when + 2 * 3600000) {
      cv.status = "done";
      save();
      await refreshMessage(cv, client);
    }
  }
}

async function setupConvocations(client) {
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
            .setColor(0xb8862b)
            .setTitle("📋 Convocations")
            .setDescription(
              `Ce salon reçoit les **convocations officielles** de la Direction au **${PLACE}**.\n\n` +
                "• La personne convoquée est prévenue ici et en message privé.\n" +
                "• Elle confirme sa présence ou demande un autre horaire avec les boutons.\n" +
                "• Un rappel lui est envoyé **30 minutes avant** le rendez-vous.\n\n" +
                "*Direction : utilisez* `/convocation`."
            ),
        ],
      })
      .catch(() => null);
  }
  setInterval(() => tick(client).catch((err) => console.error("Convocations (rappels):", err.message)), 60000);
  console.log("Convocations prêtes");
}

async function handleConvocationInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "convocation") {
    if (!isDirection(interaction.member)) {
      await interaction.reply({ content: "⛔ Seule la Direction (gérants, Fondation) peut envoyer une convocation.", ephemeral: true });
      return true;
    }
    const target = interaction.options.getUser("membre");
    const hour = parseHour(interaction.options.getString("heure"));
    if (!hour) {
      await interaction.reply({ content: "❌ Heure invalide. Écrivez par exemple `14h30`, `9h` ou `18:15`.", ephemeral: true });
      return true;
    }
    if (target.bot) {
      await interaction.reply({ content: "❌ On ne convoque pas un bot.", ephemeral: true });
      return true;
    }
    const when = meetingTime(interaction.options.getString("jour") ?? "demain", hour);
    if (when <= Date.now()) {
      await interaction.reply({ content: "❌ Cette heure est déjà passée : choisissez une heure plus tard ou un autre jour.", ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    const st = load();
    const member = interaction.options.getMember("membre");
    const cv = {
      no: st.next++,
      userId: target.id,
      name: member?.displayName ?? target.globalName ?? target.username,
      avatar: (member ?? target).displayAvatarURL({ extension: "png", size: 128 }),
      byId: interaction.user.id,
      byName: interaction.member?.displayName ?? interaction.user.username,
      reason: interaction.options.getString("motif").slice(0, 300),
      when,
      at: Date.now(),
      status: "pending",
      reminded: when - Date.now() < REMINDER_BEFORE,
    };
    const ch = channelRef ?? (await client.channels.fetch(st.channelId).catch(() => null));
    if (!ch) {
      st.next--;
      await interaction.editReply("❌ Le salon des convocations est introuvable.");
      return true;
    }
    const payload = await convPayload(cv);
    const msg = await ch.send({ ...payload, content: `<@${cv.userId}>`, allowedMentions: { users: [cv.userId] } });
    cv.messageId = msg.id;
    st.list[cv.no] = cv;
    save();
    const unix = Math.floor(when / 1000);
    const dm = await target
      .send({
        content: `📋 **Vous avez reçu une convocation** de la Direction de la Maison.\nRendez-vous au **${PLACE}** le **<t:${unix}:F>**.\n📝 Motif : ${cv.reason}\n\nMerci de confirmer votre présence ici : ${msg.url}`,
        files: [new AttachmentBuilder(await (await drawConvocation(cv)).encode("png"), { name: "convocation.png" })],
      })
      .then(() => true)
      .catch(() => false);
    await interaction.editReply(`✅ Convocation n° ${String(cv.no).padStart(3, "0")} envoyée à **${cv.name}** pour le <t:${unix}:F> : ${msg.url}${dm ? "" : "\n⚠️ Ses messages privés sont fermés : elle n'est prévenue que dans le salon."}`);
    return true;
  }

  const id = interaction.customId;
  const m = typeof id === "string" ? /^conv_(ok|autre|x|autref)_(\d+)$/.exec(id) : null;
  if (!m) return false;
  const [, action, no] = m;
  const cv = load().list[no];
  if (!cv || ["cancelled", "done"].includes(cv.status)) {
    await interaction.reply({ content: "ℹ️ Cette convocation n'est plus active.", ephemeral: true });
    return true;
  }
  if (action === "x") {
    if (!isDirection(interaction.member)) {
      await interaction.reply({ content: "⛔ Seule la Direction peut annuler une convocation.", ephemeral: true });
      return true;
    }
    cv.status = "cancelled";
    cv.note = `Annulée par ${interaction.member?.displayName ?? interaction.user.username}.`;
    save();
    await interaction.update(await convPayload(cv, false));
    client.users.fetch(cv.userId).then((u) => u.send(`✖️ Votre convocation n° ${String(cv.no).padStart(3, "0")} au **${PLACE}** est **annulée**.`)).catch(() => null);
    return true;
  }
  if (interaction.user.id !== cv.userId) {
    await interaction.reply({ content: "⛔ Seule la personne convoquée peut répondre à cette convocation.", ephemeral: true });
    return true;
  }
  if (action === "ok") {
    cv.status = "confirmed";
    cv.note = null;
    save();
    await interaction.update(await convPayload(cv, false));
    client.users.fetch(cv.byId).then((u) => u.send(`✅ **${cv.name}** confirme sa présence au **${PLACE}** le <t:${Math.floor(cv.when / 1000)}:F>.`)).catch(() => null);
    return true;
  }
  if (action === "autre") {
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId(`conv_autref_${cv.no}`)
        .setTitle("Demander un autre horaire")
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId("dispo").setLabel("Quand êtes-vous disponible ?").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200).setPlaceholder("Ex. : demain après 17 h, ou jeudi matin")
          )
        )
    );
    return true;
  }
  if (action === "autref") {
    const dispo = interaction.fields.getTextInputValue("dispo").trim();
    cv.status = "reschedule";
    cv.note = `Disponibilités : ${dispo}`;
    save();
    await interaction.deferUpdate();
    await refreshMessage(cv, client);
    client.users.fetch(cv.byId).then((u) => u.send(`📅 **${cv.name}** demande un autre horaire pour sa convocation n° ${String(cv.no).padStart(3, "0")}.\n> ${dispo}`)).catch(() => null);
    return true;
  }
  return false;
}

module.exports = { setupConvocations, handleConvocationInteraction, drawConvocation, parseHour, meetingTime };
