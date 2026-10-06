
// --- Pass de combat : une saison par mois, 30 paliers, une voie gratuite et une voie Premium ---
// L'XP se gagne en jouant (boosters, combats, échanges, île, Clash, tournoi…), avec un plafond par jour.
// Les récompenses : poussière d'étoile, boosters, euros et ressources du Clash. Aucune carte n'est créée.
const PASS_TIERS = 30, PASS_TIER_XP = 400, PASS_DAY_CAP = 1200, PASS_PRICE = 20000, PASS_PAGE = 10;
const PASS_XP = {
  // actions suivies par les quêtes
  open_pack: 25, daily_pack: 30, win_fight: 60, play_round: 4, trade: 40, market: 25, wild: 40, recycle: 10,
  // statistiques de jeu
  quests: 50, islands: 80, clashStars: 20, clashBuild: 30, tourneyWins: 400,
};
const PASS_MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const passSeason = () => monthKey();
const passSeasonName = (key = passSeason()) => {
  const [y, m] = key.split("-").map(Number);
  return `${PASS_MONTHS[m - 1]} ${y}`;
};
const passSeasonOf = (key = passSeason()) => (/^[aeiouéèo]/i.test(passSeasonName(key)) ? "d'" : "de ") + passSeasonName(key);
// récompenses : r = { dust, pack, money, or, essence }
function passReward(tier, track) {
  if (track === "free") {
    if (tier % 10 === 0) return { pack: tier === 30 ? "premium" : "standard", dust: 150 };
    if (tier % 5 === 0) return { pack: "standard" };
    if (tier % 3 === 0) return { money: 400 + tier * 20 };
    return { dust: 40 + tier * 3 };
  }
  if (tier === 30) return { pack: "prestige", dust: 1000, money: 5000 };
  if (tier % 10 === 0) return { pack: "prestige", dust: 300 };
  if (tier % 5 === 0) return { pack: "premium", dust: 150 };
  if (tier % 4 === 0) return { or: 400 + tier * 40, essence: 400 + tier * 40 };
  if (tier % 3 === 0) return { money: 900 + tier * 40 };
  return { dust: 90 + tier * 6 };
}
const passRewardText = (r) =>
  [r.pack && `1 booster ${PACKS[r.pack].name}`, r.dust && `${r.dust} ✨`, r.money && formatEuro(r.money), r.or && `${r.or} or`, r.essence && `${r.essence} essence`].filter(Boolean).join(" + ");

function passOf(userId) {
  const st = load();
  st.pass ??= {};
  let p = st.pass[userId];
  if (!p || p.season !== passSeason()) {
    // nouvelle saison : les récompenses débloquées et pas réclamées sont versées automatiquement
    if (p) passClaimAll(userId, p);
    p = st.pass[userId] = { season: passSeason(), xp: 0, day: null, dayXp: 0, premium: false, claimed: { free: [], prem: [] } };
  }
  return p;
}
const passTier = (p) => Math.min(PASS_TIERS, Math.floor(p.xp / PASS_TIER_XP));
function passGive(userId, r) {
  if (r.dust) load().dust[userId] = (load().dust[userId] ?? 0) + r.dust;
  if (r.pack) addPacks(userId, packKey(CURRENT_GEN, r.pack), 1);
  if (r.money) changeBalance(userId, r.money, "Pass de combat", { force: true });
  const base = clashState()[userId];
  if (base && (r.or || r.essence)) {
    base.res.or = (base.res.or ?? 0) + (r.or ?? 0);
    base.res.essence = (base.res.essence ?? 0) + (r.essence ?? 0);
  } else if (r.or || r.essence) load().dust[userId] = (load().dust[userId] ?? 0) + Math.round(((r.or ?? 0) + (r.essence ?? 0)) / 10); // pas de Maison : converti en poussière
}
// réclame tout ce qui est débloqué ; renvoie la liste des récompenses
function passClaimAll(userId, p = passOf(userId)) {
  const got = [], tier = passTier(p);
  for (let k = 1; k <= tier; k++) {
    for (const track of ["free", "prem"]) {
      if (track === "prem" && !p.premium) continue;
      const list = p.claimed[track];
      if (list.includes(k)) continue;
      list.push(k);
      const r = passReward(k, track);
      passGive(userId, r);
      got.push([k, track, r]);
    }
  }
  if (got.length) save();
  return got;
}
function passAddXp(userId, xp) {
  if (!userId || !xp || /\D/.test(String(userId))) return;
  const p = passOf(userId), day = dayKey();
  if (p.day !== day) {
    p.day = day;
    p.dayXp = 0;
  }
  const add = Math.max(0, Math.min(xp, PASS_DAY_CAP - p.dayXp));
  if (!add) return;
  p.dayXp += add;
  p.xp = Math.min(PASS_TIERS * PASS_TIER_XP, p.xp + add);
}
{
  const quest = questProgress, stat = ustat;
  questProgress = (userId, kind, n = 1) => {
    quest(userId, kind, n);
    if (PASS_XP[kind]) passAddXp(userId, PASS_XP[kind] * n);
  };
  ustat = (userId, key, n = 1) => {
    stat(userId, key, n);
    if (PASS_XP[key]) passAddXp(userId, PASS_XP[key] * n);
  };
}

// --- Image du pass ---
function passIcon(ctx, r, x, y, s, lit) {
  ctx.save();
  if (!lit) ctx.globalAlpha = 0.45;
  if (r.pack) {
    const col = { standard: "#60a5fa", premium: "#c084fc", prestige: "#fbbf24" }[r.pack];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.12);
    roundRect(ctx, -s * 0.55, -s * 0.75, s * 1.1, s * 1.5, s * 0.15);
    const g = ctx.createLinearGradient(0, -s, 0, s);
    g.addColorStop(0, shade(col, 1.3));
    g.addColorStop(1, shade(col, 0.6));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    star5(ctx, 0, 0, s * 0.32, "#ffffff");
    ctx.restore();
  } else if (r.or || r.essence) {
    iconCoin(ctx, x - s * 0.35, y, s * 0.5);
    iconCrystal(ctx, x + s * 0.4, y, s * 0.5);
  } else if (r.money) {
    const g = ctx.createRadialGradient(x - s * 0.2, y - s * 0.2, 1, x, y, s * 0.7);
    g.addColorStop(0, "#ecfccb");
    g.addColorStop(0.5, "#84cc16");
    g.addColorStop(1, "#365314");
    disc(ctx, x, y, s * 0.65, g);
    ctx.fillStyle = "#1a2e05";
    ctx.textAlign = "center";
    ctx.font = `${Math.round(s * 0.7)}px CardTitle`;
    ctx.fillText("€", x, y + s * 0.25);
  } else {
    glow(ctx, x, y, s * 1.2, "#c4b5fd", 0.4);
    sparkle(ctx, x, y, s * 0.55, "#ede9fe");
  }
  ctx.restore();
}
async function drawPass(userId, page) {
  const p = passOf(userId), tier = passTier(p), W = 1400, H = 640;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0f0a26");
  bg.addColorStop(0.55, "#1e1048");
  bg.addColorStop(1, "#06030f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W * 0.15, -60, 600, "#7c3aed", 0.35);
  glow(ctx, W * 0.9, H + 40, 500, "#f59e0b", 0.22);
  const R = seeded(hashOf(p.season));
  for (let i = 0; i < 80; i++) disc(ctx, R() * W, R() * H, R() * 1.5 + 0.3, `rgba(255,255,255,${0.1 + R() * 0.35})`);
  // en-tête
  ctx.textAlign = "left";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#c4b5fd";
  spaced(ctx, "LES CARTES DE LA MAISON", 250, 52, 4);
  ctx.font = "52px CardTitle";
  const tg = ctx.createLinearGradient(0, 64, 0, 112);
  tg.addColorStop(0, "#ffffff");
  tg.addColorStop(1, "#c4b5fd");
  ctx.fillStyle = tg;
  ctx.fillText("Pass de combat", 40, 108);
  ctx.font = "22px CardItalic";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(`Saison ${passSeasonOf(p.season)}`, 420, 106);
  // palier actuel
  const bx = W - 190, by = 78;
  ctx.save();
  ctx.shadowColor = "rgba(124,58,237,0.8)";
  ctx.shadowBlur = 24;
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU - Math.PI / 2;
    k ? ctx.lineTo(bx + Math.cos(a) * 58, by + Math.sin(a) * 58) : ctx.moveTo(bx + Math.cos(a) * 58, by + Math.sin(a) * 58);
  }
  ctx.closePath();
  ctx.fillStyle = metalGradient(ctx, W, H, p.premium ? METAL.legendaire : METAL.epique);
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "#1c1917";
  ctx.fillText("PALIER", bx, by - 16);
  ctx.font = "40px CardTitle";
  ctx.fillText(String(tier), bx, by + 26);
  if (p.premium) {
    ctx.font = "14px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spaced(ctx, "PREMIUM", bx, by + 82, 3);
  }
  // barre d'XP
  const into = tier >= PASS_TIERS ? PASS_TIER_XP : p.xp - tier * PASS_TIER_XP;
  roundRect(ctx, 40, 140, 1060, 22, 11);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fill();
  roundRect(ctx, 42, 142, Math.max(18, 1056 * (into / PASS_TIER_XP)), 18, 9);
  const xg = ctx.createLinearGradient(42, 0, 1100, 0);
  xg.addColorStop(0, "#7c3aed");
  xg.addColorStop(1, "#f472b6");
  ctx.fillStyle = xg;
  ctx.fill();
  ctx.textAlign = "left";
  ctx.font = "15px CardBold";
  ctx.fillStyle = "#e9d5ff";
  ctx.fillText(tier >= PASS_TIERS ? "Pass terminé, bravo !" : `${into} / ${PASS_TIER_XP} XP vers le palier ${tier + 1}`, 42, 186);
  ctx.textAlign = "right";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Aujourd'hui : ${p.day === dayKey() ? p.dayXp : 0} / ${PASS_DAY_CAP} XP`, 1100, 186);
  // les deux voies
  const first = page * PASS_PAGE + 1, colW = 120, x0 = 170, rows = [["free", "GRATUIT", 260, "#94a3b8"], ["prem", "PREMIUM", 440, "#fbbf24"]];
  for (const [track, label, y, col] of rows) {
    ctx.textAlign = "center";
    ctx.font = "15px CardEngrave";
    ctx.fillStyle = col;
    spaced(ctx, label, 90, y + 70, 2);
    if (track === "prem" && !p.premium) {
      ctx.font = "12px CardText";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("verrouillé", 90, y + 92);
    }
    for (let i = 0; i < PASS_PAGE; i++) {
      const k = first + i, x = x0 + i * colW, r = passReward(k, track);
      const open = k <= tier && (track === "free" || p.premium), claimed = p.claimed[track].includes(k);
      roundRect(ctx, x, y, colW - 14, 150, 14);
      const tgr = ctx.createLinearGradient(0, y, 0, y + 150);
      tgr.addColorStop(0, track === "prem" ? "rgba(120,53,15,0.55)" : "rgba(30,41,59,0.7)");
      tgr.addColorStop(1, "rgba(10,8,20,0.85)");
      ctx.fillStyle = tgr;
      ctx.fill();
      ctx.lineWidth = open && !claimed ? 3 : 1.5;
      ctx.strokeStyle = open && !claimed ? "#4ade80" : track === "prem" ? "rgba(251,191,36,0.5)" : "rgba(148,163,184,0.4)";
      ctx.stroke();
      if (open && !claimed) glow(ctx, x + (colW - 14) / 2, y + 62, 60, "#4ade80", 0.25);
      passIcon(ctx, r, x + (colW - 14) / 2, y + 62, 30, open);
      ctx.textAlign = "center";
      ctx.font = "11px CardBold";
      ctx.fillStyle = open ? "#ffffff" : "rgba(226,232,240,0.5)";
      const txt = passRewardText(r).replace(/ ✨/g, " poussières").replace(/ \+ /g, "\n"); // la police des cartes n'a pas le symbole ✨
      txt.split("\n").forEach((line, j, all) => ctx.fillText(line, x + (colW - 14) / 2, y + (all.length > 2 ? 104 : 112) + j * 14, colW - 20));
      if (claimed) {
        disc(ctx, x + colW - 30, y + 16, 11, "#16a34a");
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + colW - 35, y + 16);
        ctx.lineTo(x + colW - 31, y + 20);
        ctx.lineTo(x + colW - 24, y + 11);
        ctx.stroke();
      } else if (!open) {
        ctx.fillStyle = "rgba(148,163,184,0.7)";
        roundRect(ctx, x + colW - 36, y + 12, 14, 11, 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.7)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + colW - 29, y + 12, 4.5, Math.PI, 0);
        ctx.stroke();
      }
    }
  }
  // numéros des paliers
  for (let i = 0; i < PASS_PAGE; i++) {
    const k = first + i, x = x0 + i * colW + (colW - 14) / 2, reached = k <= tier;
    disc(ctx, x, 428, 15, reached ? "#7c3aed" : "#1e293b");
    ctx.textAlign = "center";
    ctx.font = "13px CardBold";
    ctx.fillStyle = reached ? "#ffffff" : "#64748b";
    ctx.fillText(String(k), x, 433);
  }
  ctx.textAlign = "center";
  ctx.font = "13px CardText";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(`Paliers ${first} à ${first + PASS_PAGE - 1} sur ${PASS_TIERS} · la saison se termine à la fin du mois`, W / 2, H - 18);
  return c;
}
async function passPayload(userId, page = null, note = "") {
  const p = passOf(userId), tier = passTier(p);
  const pg = page ?? Math.min(Math.floor(Math.max(0, tier - 1) / PASS_PAGE), PASS_TIERS / PASS_PAGE - 1);
  const ready = [];
  for (let k = 1; k <= tier; k++) for (const track of ["free", "prem"]) if ((track === "free" || p.premium) && !p.claimed[track].includes(k)) ready.push(k);
  const file = new AttachmentBuilder(await (await drawPass(userId, pg)).encode("jpeg", 88), { name: "pass.jpg" });
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`🎟️ Pass de combat — ${passSeasonName(p.season)}`)
        .setDescription(
          (note ? `${note}\n\n` : "") +
            `**Palier ${tier} / ${PASS_TIERS}** · ${p.xp} XP${p.premium ? " · ⭐ **Premium**" : ""}\n` +
            `Gagnez de l'XP en jouant : boosters, combats, échanges, cartes sauvages, île, Clash, tournoi, quêtes (jusqu'à ${PASS_DAY_CAP} XP par jour).` +
            (p.premium ? "" : `\n⭐ Le **pass Premium** (${formatEuro(PASS_PRICE)}) débloque une 2ᵉ voie de récompenses, y compris les paliers déjà atteints.`)
        )
        .setImage("attachment://pass.jpg"),
    ],
    files: [file],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("carte_bp_claim").setLabel(ready.length ? `Réclamer (${ready.length})` : "Rien à réclamer").setEmoji("🎁").setStyle(ButtonStyle.Success).setDisabled(!ready.length),
        new ButtonBuilder().setCustomId(`carte_bp_page_${pg - 1}`).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(pg <= 0),
        new ButtonBuilder().setCustomId(`carte_bp_page_${pg + 1}`).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(pg >= PASS_TIERS / PASS_PAGE - 1),
        ...(p.premium ? [] : [new ButtonBuilder().setCustomId("carte_bp_buy").setLabel(`Passer Premium (${formatEuro(PASS_PRICE)})`).setEmoji("⭐").setStyle(ButtonStyle.Primary)]),
        new ButtonBuilder().setCustomId("carte_bp_help").setLabel("Gagner de l'XP").setEmoji("📖").setStyle(ButtonStyle.Secondary)
      ),
    ],
  };
}
const PASS_HELP = () =>
  new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle("📖 Le pass de combat")
    .setDescription(
      `Une saison par mois, **${PASS_TIERS} paliers** de ${PASS_TIER_XP} XP. Plafond : **${PASS_DAY_CAP} XP par jour**.\n\n` +
        "**Gagner de l'XP**\n" +
        `• Ouvrir un booster : ${PASS_XP.open_pack} · booster gratuit du jour : ${PASS_XP.daily_pack}\n` +
        `• Gagner un combat : ${PASS_XP.win_fight} · chaque manche jouée : ${PASS_XP.play_round}\n` +
        `• Échange : ${PASS_XP.trade} · vente au marché : ${PASS_XP.market} · carte sauvage : ${PASS_XP.wild}\n` +
        `• Quêtes réclamées : ${PASS_XP.quests} · conquête de l'île : ${PASS_XP.islands}\n` +
        `• Clash : ${PASS_XP.clashStars} par étoile, ${PASS_XP.clashBuild} par chantier · tournoi gagné : ${PASS_XP.tourneyWins}\n\n` +
        `**Récompenses** : poussière d'étoile, boosters (Standard, Premium, Prestige), euros, or et essence pour le Clash.\n` +
        `⭐ **Premium** (${formatEuro(PASS_PRICE)}) : une 2ᵉ voie bien plus riche, valable toute la saison, y compris pour les paliers déjà atteints.\n` +
        "À la fin du mois, les récompenses débloquées et pas encore réclamées sont versées automatiquement."
    );
async function handlePassInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "pass";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("carte_bp"))) return false;
  const userId = interaction.user.id;
  const show = async (payload, update = !isCmd) => {
    if (update) await interaction.deferUpdate();
    else await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await payload);
  };
  if (isCmd || id === "carte_bp") {
    await show(passPayload(userId), false);
    return true;
  }
  if (id === "carte_bp_help") {
    await interaction.reply({ embeds: [PASS_HELP()], ephemeral: true });
    return true;
  }
  const page = /^carte_bp_page_(\d+)$/.exec(id);
  if (page) {
    await show(passPayload(userId, Number(page[1])));
    return true;
  }
  if (id === "carte_bp_claim") {
    const got = passClaimAll(userId);
    await show(passPayload(userId, null, got.length ? `🎁 **Récompenses réclamées** :\n${got.map(([k, tr, r]) => `• Palier ${k}${tr === "prem" ? " ⭐" : ""} : ${passRewardText(r)}`).join("\n").slice(0, 1500)}` : "Rien de nouveau à réclamer."));
    return true;
  }
  if (id === "carte_bp_buy") {
    const p = passOf(userId);
    if (p.premium) {
      await show(passPayload(userId));
      return true;
    }
    if ((readBalance(userId) ?? 0) < PASS_PRICE) {
      await interaction.reply({ content: `❌ Il faut **${formatEuro(PASS_PRICE)}** pour le pass Premium.`, ephemeral: true });
      return true;
    }
    changeBalance(userId, -PASS_PRICE, `Pass de combat Premium (${passSeasonName()})`, { force: true });
    p.premium = true;
    save();
    await show(passPayload(userId, null, `⭐ **Pass Premium activé** pour la saison ${passSeasonOf()} ! Les récompenses Premium des paliers déjà atteints sont à réclamer.`));
    return true;
  }
  return false;
}
