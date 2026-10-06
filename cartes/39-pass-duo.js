
// --- Pass Duo : le pass de combat de l'équipe ---
// Chaque mois, les deux membres d'une équipe remplissent ensemble un pass de 20 paliers : toute l'XP de pass
// gagnée par l'un ou l'autre compte. Chacun réclame ses récompenses ; le coffre et l'XP d'équipe sont versés une fois.
// La voie Premium du duo s'achète avec le coffre de l'équipe.
// --- Salon « pass de combat » : la saison en cours et les classements (joueurs et duos), en direct.
const DUO_PASS_TIERS = 20, DUO_PASS_TIER_XP = 800, DUO_PASS_PRICE = 2500, DUO_PASS_PAGE = 10;
let passBoardDirty = true;
function duoPassReward(tier, track) {
  if (track === "free") {
    if (tier === 20) return { pack: "premium", dust: 200, vault: 300, teamXp: 150 };
    if (tier % 5 === 0) return { pack: "standard", vault: 150, teamXp: 100 };
    if (tier % 3 === 0) return { money: 500 + tier * 30 };
    return { dust: 50 + tier * 5 };
  }
  if (tier === 20) return { duoHolo: true, pack: "prestige", dust: 600 };
  if (tier === 10) return { pack: "prestige", dust: 250, vault: 300 };
  if (tier % 5 === 0) return { pack: "premium", dust: 150 };
  if (tier % 3 === 0) return { money: 1200 + tier * 50 };
  return { dust: 110 + tier * 8 };
}
const duoPassText = (r) =>
  [r.duoHolo && "votre carte DUO en holo", r.pack && `1 booster ${PACKS[r.pack].name}`, r.dust && `${r.dust} ✨`, r.money && formatEuro(r.money), r.vault && `${r.vault} ✨ au coffre`, r.teamXp && `${r.teamXp} XP d'équipe`].filter(Boolean).join(" + ");
function duoPassOf(team) {
  const st = load();
  st.duoPass ??= {};
  let dp = st.duoPass[team.id];
  if (!dp || dp.season !== passSeason()) dp = st.duoPass[team.id] = { season: passSeason(), xp: 0, premium: false, contrib: {}, claimed: {}, teamClaimed: [] };
  return dp;
}
const duoPassTier = (dp) => Math.min(DUO_PASS_TIERS, Math.floor(dp.xp / DUO_PASS_TIER_XP));
{
  // l'XP de pass gagnée par un membre remplit aussi le pass de son équipe
  const add = passAddXp;
  passAddXp = (userId, xp) => {
    if (!userId || /\D/.test(String(userId))) return add(userId, xp);
    const p = passOf(userId), before = p.day === dayKey() ? p.dayXp : 0;
    add(userId, xp);
    const gained = (p.day === dayKey() ? p.dayXp : 0) - before, team = gained > 0 ? teamOf(userId) : null;
    if (team?.members.length === 2) {
      const dp = duoPassOf(team);
      dp.xp = Math.min(DUO_PASS_TIERS * DUO_PASS_TIER_XP, dp.xp + gained);
      dp.contrib[userId] = (dp.contrib[userId] ?? 0) + gained;
    }
    if (gained > 0) passBoardDirty = true;
  };
}
function duoPassClaim(userId, team) {
  const dp = duoPassOf(team), tier = duoPassTier(dp), mine = (dp.claimed[userId] ??= { free: [], prem: [] }), got = [];
  for (let k = 1; k <= tier; k++)
    for (const track of ["free", "prem"]) {
      if ((track === "prem" && !dp.premium) || mine[track].includes(k)) continue;
      mine[track].push(k);
      const r = duoPassReward(k, track);
      if (r.dust) load().dust[userId] = (load().dust[userId] ?? 0) + r.dust;
      if (r.pack) addPacks(userId, packKey(CURRENT_GEN, r.pack), 1);
      if (r.money) changeBalance(userId, r.money, "Pass Duo", { force: true });
      if (r.duoHolo) {
        const card = findCard(`duo_${team.id}`);
        if (card) give(userId, card, true);
      }
      // coffre et XP d'équipe : une seule fois pour l'équipe
      const tk = `${track}:${k}`;
      if ((r.vault || r.teamXp) && !dp.teamClaimed.includes(tk)) {
        dp.teamClaimed.push(tk);
        if (r.vault) team.vault += r.vault;
        if (r.teamXp) addTeamXp(team, r.teamXp, userId);
      }
      got.push([k, track, r]);
    }
  if (got.length) save();
  return got;
}

// --- Image du Pass Duo ---
async function drawDuoPass(team, userId, page) {
  const dp = duoPassOf(team), tier = duoPassTier(dp), W = 1400, H = 700;
  const crest = CREST[team.emblem] ?? CREST["🛡️"], pal = crest.pal;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, shade(pal[1], 0.45));
  bg.addColorStop(0.5, pal[2]);
  bg.addColorStop(1, "#05030a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // rayons et blason géant en filigrane
  ctx.save();
  ctx.translate(W - 220, 140);
  for (let i = 0; i < 24; i++) {
    ctx.rotate(TAU / 24);
    ctx.fillStyle = `rgba(255,255,255,${i % 2 ? 0.02 : 0.05})`;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-40, -1200);
    ctx.lineTo(40, -1200);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 0.18;
  ctx.drawImage(await drawTeamCrest(team.emblem), W - 470, -60, 520, 520);
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = "#ffffff";
  ctx.font = "420px CardKanji";
  ctx.textAlign = "center";
  ctx.fillText(crest.kanji, 260, 560);
  ctx.globalAlpha = 1;
  // les deux membres
  const snap = duoSnapshot(team);
  const [pa, pb] = await Promise.all([duoPortrait(snap.avatars[0], snap.names[0], pal[1]), duoPortrait(snap.avatars[1], snap.names[1], shade(pal[1], 0.7))]);
  drawSticker(ctx, pa, 78, 104, 100, pal);
  drawSticker(ctx, pb, 158, 96, 120, pal);
  drawHanko(ctx, 238, 150, 22, crest.kanji);
  // titre
  ctx.textAlign = "left";
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = pal[0];
  ctx.fillText("PASS DUO  ·  ÉQUIPE", 280, 54);
  ctx.save();
  ctx.shadowColor = rgba(pal[1], 0.9);
  ctx.shadowBlur = 18;
  ctx.font = `${fitText(ctx, team.name, 620, 54, "CardTitle")}px CardTitle`;
  const tg = ctx.createLinearGradient(0, 64, 0, 112);
  tg.addColorStop(0, "#ffffff");
  tg.addColorStop(1, pal[0]);
  ctx.fillStyle = tg;
  ctx.fillText(team.name, 280, 108);
  ctx.restore();
  ctx.font = "20px CardItalic";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  const th = passTheme(dp.season);
  ctx.fillText(`${snap.names[0]} & ${snap.names[1]} · ${th ? `${th.name}, ` : "saison "}${passSeasonName(dp.season)}`, 280, 142);
  // palier du duo (hexagone aux couleurs de l'équipe)
  const bx = W - 130, by = 96;
  ctx.save();
  ctx.shadowColor = rgba(pal[1], 0.9);
  ctx.shadowBlur = 26;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU - Math.PI / 2;
    k ? ctx.lineTo(bx + Math.cos(a) * 62, by + Math.sin(a) * 62) : ctx.moveTo(bx + Math.cos(a) * 62, by + Math.sin(a) * 62);
  }
  ctx.closePath();
  const hg = ctx.createLinearGradient(bx, by - 62, bx, by + 62);
  hg.addColorStop(0, pal[0]);
  hg.addColorStop(1, pal[1]);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = pal[2];
  ctx.fillText("PALIER", bx, by - 16);
  ctx.font = "42px CardTitle";
  ctx.fillText(String(tier), bx, by + 28);
  if (dp.premium) {
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spaced(ctx, "PREMIUM", bx, by + 86, 3);
  }
  // barre d'XP partagée : la part de chacun
  const into = tier >= DUO_PASS_TIERS ? DUO_PASS_TIER_XP : dp.xp - tier * DUO_PASS_TIER_XP, bw = 980, bx2 = 40, byy = 186;
  roundRect(ctx, bx2, byy, bw, 22, 11);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fill();
  const total = Math.max(1, team.members.reduce((a, m) => a + (dp.contrib[m] ?? 0), 0)), fw = Math.max(22, (bw - 4) * (into / DUO_PASS_TIER_XP));
  const shareA = (dp.contrib[team.members[0]] ?? 0) / total;
  ctx.save();
  roundRect(ctx, bx2 + 2, byy + 2, fw, 18, 9);
  ctx.clip();
  ctx.fillStyle = pal[0];
  ctx.fillRect(bx2 + 2, byy + 2, fw * shareA, 18);
  ctx.fillStyle = pal[1];
  ctx.fillRect(bx2 + 2 + fw * shareA, byy + 2, fw * (1 - shareA), 18);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.font = "14px CardBold";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tier >= DUO_PASS_TIERS ? "Pass Duo terminé : quelle équipe !" : `${into} / ${DUO_PASS_TIER_XP} XP vers le palier ${tier + 1}`, bx2, byy + 46);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(team.members.map((m, i) => `${snap.names[i]} : ${dp.contrib[m] ?? 0} XP`).join("   ·   "), bx2 + bw, byy + 46);
  // les deux voies
  const first = page * DUO_PASS_PAGE + 1, colW = 118, x0 = 196, mine = dp.claimed[userId] ?? { free: [], prem: [] };
  for (const [track, label, y] of [["free", "DUO", 270], ["prem", "DUO PREMIUM", 462]]) {
    ctx.textAlign = "center";
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = track === "prem" ? "#fbbf24" : pal[0];
    spaced(ctx, label, 100, y + 74, 2);
    if (track === "prem" && !dp.premium) {
      ctx.font = "12px CardText";
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(`${DUO_PASS_PRICE} ✨ du coffre`.replace(" ✨", " poussières"), 100, y + 96);
    }
    for (let i = 0; i < DUO_PASS_PAGE; i++) {
      const k = first + i, x = x0 + i * colW, w = colW - 14, r = duoPassReward(k, track);
      const open = k <= tier && (track === "free" || dp.premium), claimed = mine[track].includes(k);
      ctx.save();
      roundRect(ctx, x, y, w, 158, 16);
      const sg = ctx.createLinearGradient(0, y, 0, y + 158);
      sg.addColorStop(0, track === "prem" ? "rgba(120,53,15,0.75)" : rgba(pal[1], 0.4));
      sg.addColorStop(1, "rgba(8,6,16,0.9)");
      ctx.fillStyle = sg;
      ctx.shadowColor = open && !claimed ? "#4ade80" : "rgba(0,0,0,0.6)";
      ctx.shadowBlur = open && !claimed ? 22 : 10;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = open && !claimed ? 3 : 1.5;
      ctx.strokeStyle = open && !claimed ? "#86efac" : track === "prem" ? "rgba(251,191,36,0.7)" : rgba(pal[0], 0.6);
      roundRect(ctx, x, y, w, 158, 16);
      ctx.stroke();
      if (r.duoHolo) {
        // la carte DUO en miniature, avec reflet holo
        ctx.save();
        if (!open) ctx.globalAlpha = 0.45;
        ctx.translate(x + w / 2, y + 62);
        ctx.rotate(0.08);
        roundRect(ctx, -24, -34, 48, 68, 6);
        ctx.fillStyle = metalGradient(ctx, 200, 200, METAL.mythique);
        ctx.fill();
        ctx.drawImage(await drawTeamCrest(team.emblem), -20, -24, 40, 40);
        ctx.globalCompositeOperation = "overlay";
        rainbow(ctx, 48, 68, 0.3, 0.6);
        ctx.restore();
      } else passIcon(ctx, r, x + w / 2, y + 62, 28, open);
      ctx.textAlign = "center";
      ctx.font = "11px CardBold";
      ctx.fillStyle = open ? "#ffffff" : "rgba(226,232,240,0.5)";
      duoPassText(r)
        .replace(/ ✨/g, " poussières")
        .split(" + ")
        .forEach((line, j, all) => ctx.fillText(line, x + w / 2, y + (all.length > 2 ? 108 : 118) + j * 14, w - 8));
      if (claimed) {
        disc(ctx, x + w - 14, y + 16, 11, "#16a34a");
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + w - 19, y + 16);
        ctx.lineTo(x + w - 15, y + 20);
        ctx.lineTo(x + w - 8, y + 11);
        ctx.stroke();
      }
    }
  }
  for (let i = 0; i < DUO_PASS_PAGE; i++) {
    const k = first + i, x = x0 + i * colW + (colW - 14) / 2, reached = k <= tier;
    disc(ctx, x, 446, 14, reached ? pal[1] : "#1e293b");
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = reached ? "#ffffff" : "#64748b";
    ctx.fillText(String(k), x, 451);
  }
  ctx.textAlign = "center";
  ctx.font = "13px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`Paliers ${first} à ${first + DUO_PASS_PAGE - 1} sur ${DUO_PASS_TIERS} · toute l'XP de pass de l'un ou de l'autre compte · nouvelle saison le 1er du mois`, W / 2, H - 16);
  return c;
}
async function duoPassPayload(userId, page = null, note = "") {
  const team = teamOf(userId);
  if (!team || team.members.length < 2)
    return { ephemeral: true, content: "🤝 Le **Pass Duo** se remplit à deux : rejoignez ou complétez une équipe avec `/equipe`.", embeds: [], files: [], attachments: [], components: [] };
  const dp = duoPassOf(team), tier = duoPassTier(dp), mine = dp.claimed[userId] ?? { free: [], prem: [] };
  const pg = page ?? Math.min(Math.floor(Math.max(0, tier - 1) / DUO_PASS_PAGE), DUO_PASS_TIERS / DUO_PASS_PAGE - 1);
  let ready = 0;
  for (let k = 1; k <= tier; k++) for (const track of ["free", "prem"]) if ((track === "free" || dp.premium) && !mine[track].includes(k)) ready++;
  const file = new AttachmentBuilder(await (await drawDuoPass(team, userId, pg)).encode("jpeg", 88), { name: "passduo.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(parseInt(emblemOf(team)[2].slice(1), 16))
        .setTitle(`🤝 Pass Duo — ${team.name}`)
        .setDescription(
          (note ? `${note}\n\n` : "") +
            `**Palier ${tier} / ${DUO_PASS_TIERS}** · ${dp.xp} XP à deux\n` +
            "Toute l'XP de pass gagnée par l'un ou l'autre remplit le Pass Duo. Chacun réclame ses propres récompenses ; le coffre et l'XP d'équipe sont versés une seule fois." +
            (dp.premium ? "\n⭐ **Premium du duo actif.**" : `\n⭐ **Premium du duo** : ${DUO_PASS_PRICE} ✨ pris dans le coffre (${team.vault} ✨), pour vous deux. Au palier 20 : **votre carte DUO en holo**.`)
        )
        .setImage("attachment://passduo.jpg"),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_dp_claim").setLabel(ready ? `Réclamer (${ready})` : "Rien à réclamer").setEmoji("🎁").setStyle(ButtonStyle.Success).setDisabled(!ready),
        new ButtonBuilder().setCustomId(`carte_dp_page_${pg - 1}`).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(pg <= 0),
        new ButtonBuilder().setCustomId(`carte_dp_page_${pg + 1}`).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(pg >= DUO_PASS_TIERS / DUO_PASS_PAGE - 1),
        ...(dp.premium ? [] : [new ButtonBuilder().setCustomId("carte_dp_buy").setLabel(`Premium du duo (${DUO_PASS_PRICE} ✨ du coffre)`).setEmoji("⭐").setStyle(ButtonStyle.Primary).setDisabled(team.vault < DUO_PASS_PRICE)]),
        new ButtonBuilder().setCustomId("carte_bp").setLabel("Mon pass").setEmoji("🎟️").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
async function handleDuoPassInteraction(interaction) {
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_dp")) return false;
  const userId = interaction.user.id;
  const show = async (payload, fresh = id === "carte_dp") => {
    if (fresh) await interaction.deferReply({ ephemeral: true });
    else await interaction.deferUpdate();
    await interaction.editReply(await payload);
  };
  // depuis le salon (message public), on ouvre une réponse privée ; sinon on met à jour la fenêtre
  const fromBoard = interaction.message?.flags?.has?.(64) === false;
  if (id === "carte_dp") {
    await show(duoPassPayload(userId), true);
    return true;
  }
  const page = /^carte_dp_page_(\d+)$/.exec(id);
  if (page) {
    await show(duoPassPayload(userId, Number(page[1])), fromBoard);
    return true;
  }
  const team = teamOf(userId);
  if (!team || team.members.length < 2) {
    await interaction.reply({ content: "🤝 Il faut une équipe de deux pour le Pass Duo.", ephemeral: true });
    return true;
  }
  if (id === "carte_dp_claim") {
    const got = duoPassClaim(userId, team);
    passBoardDirty = true;
    await show(duoPassPayload(userId, null, got.length ? `🎁 **Récompenses du duo** :\n${got.map(([k, tr, r]) => `• Palier ${k}${tr === "prem" ? " ⭐" : ""} : ${duoPassText(r)}`).join("\n").slice(0, 1500)}` : "Rien de nouveau à réclamer."), fromBoard);
    return true;
  }
  if (id === "carte_dp_buy") {
    const dp = duoPassOf(team);
    if (!dp.premium) {
      if (team.vault < DUO_PASS_PRICE) {
        await interaction.reply({ content: `❌ Le coffre de l'équipe n'a que **${team.vault} ✨** (il en faut ${DUO_PASS_PRICE}). Déposez-y de la poussière depuis \`/equipe\`.`, ephemeral: true });
        return true;
      }
      team.vault -= DUO_PASS_PRICE;
      dp.premium = true;
      save();
      teamsDirty = true;
      const partner = team.members.find((m) => m !== userId);
      interaction.client?.users
        .fetch(partner)
        .then((u) => u.send(`⭐ **${pseudo(userId)}** a activé le **Premium du Pass Duo** de l'équipe **${team.name}** (avec le coffre) : de nouvelles récompenses vous attendent dans \`/pass\` → Pass Duo !`))
        .catch(() => null);
    }
    await show(duoPassPayload(userId, null, "⭐ **Premium du duo activé** pour vous deux ! Les récompenses des paliers déjà atteints sont à réclamer."), fromBoard);
    return true;
  }
  return false;
}
{
  // un bouton « Pass Duo » dans le pass personnel
  const payload = passPayload;
  passPayload = async (userId, page = null, note = "") => {
    const p = await payload(userId, page, note);
    if (teamOf(userId)?.members.length === 2) p.components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_dp").setLabel("Pass Duo de mon équipe").setEmoji("🤝").setStyle(ButtonStyle.Primary)));
    return p;
  };
}

// --- Le salon du pass de combat ---
async function drawPassBoard() {
  const st = load(), season = passSeason(), th = passTheme(season), W = 1400, H = 640;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const R = seeded(hashOf(season) + 3);
  if (th?.key === "effroi") {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#040108");
    sky.addColorStop(0.6, "#1a050e");
    sky.addColorStop(1, "#2a0808");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 110; k++) disc(ctx, R() * W, R() * H * 0.7, R() * 1.3 + 0.2, `rgba(254,226,226,${0.1 + R() * 0.4})`);
    glow(ctx, 1180, 110, 260, "#dc2626", 0.45);
    const mg = ctx.createRadialGradient(1150, 85, 4, 1180, 110, 80);
    mg.addColorStop(0, "#fecaca");
    mg.addColorStop(0.5, "#ef4444");
    mg.addColorStop(1, "#7f1d1d");
    disc(ctx, 1180, 110, 80, mg);
    for (let k = 0; k < 8; k++) effroiBat(ctx, 760 + R() * 560, 30 + R() * 200, 0.7 + R(), R() - 0.3);
    effroiWeb(ctx, 0, 0, 160, 0);
    effroiManor(ctx, 1180, H, 0.8, R);
    ctx.strokeStyle = "#07030a";
    ctx.lineCap = "round";
    effroiTree(ctx, 60, H, 100, -Math.PI / 2 - 0.1, 7, seeded(5));
    ctx.save();
    ctx.filter = "blur(18px)";
    for (let k = 0; k < 7; k++) {
      ctx.fillStyle = "rgba(203,213,225,0.07)";
      ctx.beginPath();
      ctx.ellipse(R() * W, H - 30 + R() * 30, 200, 30, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    effroiTitle(ctx, th.name, 60, 120, 70);
    ctx.font = "24px CardItalic";
    ctx.fillStyle = "#fdba74";
    ctx.textAlign = "left";
    ctx.fillText(`${th.sub} · ${passSeasonName(season)}`, 64, 168);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0f0a26");
    bg.addColorStop(0.6, "#1e1048");
    bg.addColorStop(1, "#06030f");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W * 0.85, 80, 500, "#7c3aed", 0.35);
    for (let k = 0; k < 90; k++) disc(ctx, R() * W, R() * H, R() * 1.4 + 0.2, `rgba(255,255,255,${0.1 + R() * 0.35})`);
    ctx.textAlign = "left";
    ctx.font = "66px CardTitle";
    ctx.fillStyle = "#ede9fe";
    ctx.fillText("Pass de combat", 60, 120);
    ctx.font = "24px CardItalic";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`Saison ${passSeasonOf(season)}`, 64, 166);
  }
  const end = new Date(Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5, 7)), 1));
  const days = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  ctx.font = "16px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.textAlign = "left";
  ctx.fillText(`Fin de la saison dans ${days} jour${days > 1 ? "s" : ""} · 30 paliers · Premium et Pass Duo`, 64, 200);
  // classements
  const players = Object.entries(st.pass ?? {})
    .filter(([, p]) => p.season === season && p.xp > 0)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 6);
  const duos = Object.entries(st.duoPass ?? {})
    .filter(([id, d]) => d.season === season && d.xp > 0 && st.teams?.[id])
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 4);
  const panelBox = (x, y, w, h, title) => {
    roundRect(ctx, x, y, w, h, 18);
    ctx.fillStyle = "rgba(8,4,14,0.72)";
    ctx.fill();
    ctx.strokeStyle = th ? "rgba(220,38,38,0.6)" : "rgba(196,181,253,0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "16px CardEngrave";
    ctx.fillStyle = th ? "#fca5a5" : "#c4b5fd";
    ctx.textAlign = "left";
    spacedLeft(ctx, title, x + 24, y + 36, 3);
  };
  panelBox(60, 236, 560, 360, "LES PLUS AVANCÉS");
  if (!players.length) {
    ctx.font = "18px CardItalic";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Personne n'a encore commencé… soyez le premier !", 84, 300);
  }
  players.forEach(([id, p], i) => {
    const y = 290 + i * 50, tier = passTier(p);
    ctx.font = "22px CardTitle";
    ctx.fillStyle = ["#fbbf24", "#e5e7eb", "#d97706"][i] ?? "#a8a29e";
    ctx.fillText(String(i + 1), 84, y + 8);
    ctx.font = `${fitText(ctx, pseudo(id), 300, 20, "CardBold")}px CardBold`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pseudo(id), 124, y + 6);
    if (p.premium) star5(ctx, 124 + ctx.measureText(pseudo(id)).width + 16, y, 7, "#fbbf24");
    ctx.textAlign = "right";
    ctx.font = "18px CardTitle";
    ctx.fillStyle = th ? "#fca5a5" : "#c4b5fd";
    ctx.fillText(`palier ${tier}`, 596, y + 6);
    ctx.textAlign = "left";
    roundRect(ctx, 124, y + 16, 380, 6, 3);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fill();
    roundRect(ctx, 124, y + 16, Math.max(6, 380 * (p.xp / (PASS_TIERS * PASS_TIER_XP))), 6, 3);
    ctx.fillStyle = th ? "#ef4444" : "#a78bfa";
    ctx.fill();
  });
  panelBox(660, 236, 560, 360, "PASS DUO : LES ÉQUIPES");
  if (!duos.length) {
    ctx.font = "18px CardItalic";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillText("Aucun duo en route pour l'instant.", 684, 300);
  }
  for (const [i, [id, d]] of duos.entries()) {
    const team = st.teams[id], y = 280 + i * 76;
    ctx.drawImage(await drawTeamCrest(team.emblem), 680, y - 6, 62, 62);
    ctx.textAlign = "left";
    ctx.font = `${fitText(ctx, team.name, 300, 22, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(team.name, 756, y + 18);
    ctx.font = "14px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(team.members.map((m) => pseudo(m)).join(" & "), 756, y + 40);
    ctx.textAlign = "right";
    ctx.font = "20px CardTitle";
    ctx.fillStyle = emblemOf(team)[2];
    ctx.fillText(`palier ${duoPassTier(d)}`, 1196, y + 22);
    if (d.premium) star5(ctx, 1186, y + 40, 7, "#fbbf24");
  }
  return c;
}
async function passBoardPayload() {
  const th = passTheme(), file = new AttachmentBuilder(await (await drawPassBoard()).encode("jpeg", 88), { name: "saison.jpg" });
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(th?.color ?? 0x7c3aed)
        .setTitle(th ? `🎃 ${th.name} — ${th.sub}` : `🎟️ Pass de combat — saison ${passSeasonOf()}`)
        .setDescription(
          `Chaque mois, un nouveau pass de **${PASS_TIERS} paliers** : gagnez de l'XP en jouant (boosters, combats, échanges, île, Clash, tournoi, quêtes) et réclamez vos récompenses.\n` +
            `⭐ **Premium** (${formatEuro(PASS_PRICE)}) : une 2ᵉ voie bien plus riche.\n` +
            `🤝 **Pass Duo** : avec votre coéquipier, remplissez ensemble un pass de ${DUO_PASS_TIERS} paliers (Premium du duo : ${DUO_PASS_PRICE} ✨ du coffre, et votre carte DUO en holo au bout).` +
            (th ? "\n🦇 **Spécial octobre** : boosters Frisson, Chat noir, Fantôme de la Maison et **Lune de sang** dans le pass Premium." : "")
        )
        .setImage("attachment://saison.jpg"),
    ],
    files: [file],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_bp").setLabel("Mon pass").setEmoji("🎟️").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("carte_dp").setLabel("Pass Duo").setEmoji("🤝").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId("carte_bp_help").setLabel("Gagner de l'XP").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
async function refreshPassBoard() {
  const ch = chan("pass");
  if (!ch || ch === channelRef) return;
  passBoardDirty = false;
  const st = load(), payload = await passBoardPayload();
  let msg = st.passMessageId ? await ch.messages.fetch(st.passMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit({ ...payload, attachments: [] }).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.passMessageId = msg.id;
      save();
    }
  }
}
async function passBoardLoop() {
  // les classements bougent souvent : au plus toutes les 10 minutes, ou à minuit (nouvelle saison)
  const min = new Date().getMinutes();
  if ((passBoardDirty && min % 10 === 6) || (min === 1 && new Date().getHours() === 0)) await refreshPassBoard().catch(() => null);
}
