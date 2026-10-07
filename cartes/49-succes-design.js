
// --- Succès : la salle des trophées ---
// Une image par joueur : en-tête (avatar, titre, progression), puis les succès rangés par catégorie,
// chacun en médaillon (émoji 3D, métal selon la récompense) avec sa date ou sa barre de progression.
const SUCC_FLUENT = {
  "📦": "Package", "🎁": "Wrapped gift", "📒": "Ledger", "📚": "Books", "🗼": "Tokyo tower", "🏡": "House with garden", "✨": "Sparkles", "🌈": "Rainbow",
  "🍀": "Four leaf clover", "🔴": "Red circle", "⚔️": "Crossed swords", "🏟️": "Stadium", "🔥": "Fire", "🏪": "Convenience store", "🤝": "Handshake", "✋": "Raised hand",
  "🎯": "Bullseye", "🏆": "Trophy", "🏝️": "Desert island", "🗺️": "World map", "🛡️": "Shield", "🏰": "Castle", "📖": "Open book", "🗝️": "Old key", "⭐": "Star", "👹": "Ogre",
};
FLUENT_SKIN.add("Raised hand");
const SUCC_GROUPS = [
  ["COLLECTION", ["booster1", "booster50", "collec25", "collec50", "paris", "maison", "holo1", "holo10", "shiny", "mythique"]],
  ["COMBATS", ["win1", "win25", "streak5", "champion", "tournoi1", "boss1"]],
  ["COMMERCE ET QUÊTES", ["sales10", "trades10", "wild10", "quests30"]],
];
// métal du médaillon selon la récompense
const succTier = (dust) => (dust > 300 ? ["PRISME", "#e879f9", "#7c3aed"] : dust > 150 ? ["OR", "#fbbf24", "#b45309"] : dust > 50 ? ["ARGENT", "#e2e8f0", "#64748b"] : ["BRONZE", "#f59e0b", "#7c2d12"]);
const succDate = (ts) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short" }).format(new Date(ts));

async function drawAchievementsHall(userId) {
  const a = achOf(userId), facts = playerFacts(userId);
  const known = new Set(SUCC_GROUPS.flatMap(([, ids]) => ids));
  const groups = [...SUCC_GROUPS.map(([label, ids]) => [label, ids.map((id) => ACHIEVEMENTS.find(([x]) => x === id)).filter(Boolean)]), ["AVENTURES", ACHIEVEMENTS.filter(([id]) => !known.has(id))]].filter(([, list]) => list.length);
  const W = 1500, cols = 4, gap = 16, cardW = (W - 120 - (cols - 1) * gap) / cols, cardH = 132, headTop = 330;
  const H = headTop + groups.reduce((h, [, list]) => h + 54 + Math.ceil(list.length / cols) * (cardH + gap), 0) + 40;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(W, H), 0, 0);
  const unlocked = ACHIEVEMENTS.filter(([id]) => a.unlocked[id]), pct = ACHIEVEMENTS.length ? unlocked.length / ACHIEVEMENTS.length : 0;
  const earned = unlocked.reduce((s, x) => s + x[6], 0);
  tdTitle(ctx, W, 128, "Salle des trophées", 66, null);
  // --- en-tête du joueur ---
  const px = 60, py = 168, pw = W - 120, ph = 130;
  roundRect(ctx, px, py, pw, ph, 26);
  const hg = ctx.createLinearGradient(px, 0, px + pw, 0);
  hg.addColorStop(0, "rgba(40,28,8,0.9)");
  hg.addColorStop(0.5, "rgba(14,12,34,0.92)");
  hg.addColorStop(1, "rgba(30,14,48,0.9)");
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = "rgba(251,191,36,0.55)";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  tdAvatarDisc(ctx, await tdAvatar(userId), px + 76, py + ph / 2, 50, "#fbbf24", userId);
  ctx.textAlign = "left";
  ctx.font = `${fitText(ctx, pseudo(userId), 460, 40, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#fff7d6";
  ctx.fillText(pseudo(userId), px + 146, py + 58);
  const title = a.title && ACHIEVEMENTS.find(([id]) => id === a.title);
  ctx.font = "18px CardItalic";
  ctx.fillStyle = title ? "#fde68a" : "rgba(203,213,225,0.6)";
  ctx.fillText(title ? `« ${title[2]} »` : "Aucun titre choisi", px + 146, py + 92);
  // chiffres
  const stat = (x, value, label) => {
    ctx.textAlign = "center";
    ctx.font = "34px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x, py + 66);
    ctx.font = "12px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spaced(ctx, label, x, py + 92, 2);
  };
  stat(px + 760, `${unlocked.length} / ${ACHIEVEMENTS.length}`, "SUCCÈS");
  stat(px + 990, earned.toLocaleString("fr-FR"), "POUSSIÈRE GAGNÉE");
  // anneau de progression
  const rx = px + pw - 80, ry = py + ph / 2, rr = 46;
  ctx.lineCap = "round";
  ctx.lineWidth = 11;
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(rx, ry, rr, 0, TAU);
  ctx.stroke();
  if (pct > 0) {
    const rg = ctx.createLinearGradient(rx - rr, ry - rr, rx + rr, ry + rr);
    rg.addColorStop(0, "#fde68a");
    rg.addColorStop(1, "#f59e0b");
    ctx.strokeStyle = rg;
    ctx.beginPath();
    ctx.arc(rx, ry, rr, -Math.PI / 2, -Math.PI / 2 + TAU * pct);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  ctx.textAlign = "center";
  ctx.font = "26px CardTitle";
  ctx.fillStyle = "#fff7d6";
  ctx.fillText(`${Math.round(pct * 100)} %`, rx, ry + 9);
  // --- les succès, par catégorie ---
  const imgs = new Map(await Promise.all([...new Set(ACHIEVEMENTS.map((x) => x[1]))].map(async (e) => [e, SUCC_FLUENT[e] ? await tdFluent(SUCC_FLUENT[e]).catch(() => null) : null])));
  let y = headTop;
  for (const [label, list] of groups) {
    const done = list.filter(([id]) => a.unlocked[id]).length;
    ctx.textAlign = "left";
    ctx.font = "20px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spacedLeft(ctx, label, 64, y + 26, 4);
    ctx.textAlign = "right";
    ctx.font = "15px CardBold";
    ctx.fillStyle = done === list.length ? "#4ade80" : "#a5b4fc";
    ctx.fillText(`${done} / ${list.length}`, W - 64, y + 26);
    const lg = ctx.createLinearGradient(64, 0, W - 64, 0);
    lg.addColorStop(0, "rgba(251,191,36,0.6)");
    lg.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = lg;
    ctx.fillRect(64, y + 38, W - 128, 1.5);
    y += 54;
    list.forEach(([id, emoji, name, desc, key, goal, dust], k) => {
      const x = 60 + (k % cols) * (cardW + gap), cy = y + Math.floor(k / cols) * (cardH + gap), got = a.unlocked[id], tier = succTier(dust);
      const prog = Math.max(0, Math.min(goal, Number(facts[key]) || 0)), isTitle = a.title === id;
      roundRect(ctx, x, cy, cardW, cardH, 18);
      if (got) {
        const g = ctx.createLinearGradient(x, cy, x + cardW, cy + cardH);
        g.addColorStop(0, rgba(tier[2], 0.55));
        g.addColorStop(1, "rgba(12,10,30,0.95)");
        ctx.fillStyle = g;
      } else ctx.fillStyle = "rgba(10,12,28,0.78)";
      ctx.fill();
      ctx.strokeStyle = got ? rgba(tier[1], isTitle ? 1 : 0.7) : "rgba(148,163,184,0.25)";
      ctx.lineWidth = isTitle ? 3 : 1.5;
      ctx.stroke();
      // médaillon
      const mx = x + 66, my = cy + cardH / 2, mr = 44;
      if (got) {
        glow(ctx, mx, my, mr * 1.7, tier[1], 0.45);
        const ring = ctx.createLinearGradient(mx - mr, my - mr, mx + mr, my + mr);
        ring.addColorStop(0, "#ffffff");
        ring.addColorStop(0.35, tier[1]);
        ring.addColorStop(1, tier[2]);
        disc(ctx, mx, my, mr, ring);
        disc(ctx, mx, my, mr - 6, "#120e24");
      } else {
        disc(ctx, mx, my, mr, "rgba(71,85,105,0.55)");
        disc(ctx, mx, my, mr - 6, "#0b0d1c");
      }
      const img = imgs.get(emoji);
      ctx.save();
      if (!got) {
        ctx.globalAlpha = 0.35;
        ctx.filter = "grayscale(1)";
      }
      if (img) ctx.drawImage(img, mx - 30, my - 30, 60, 60);
      else star5(ctx, mx, my, 24, got ? tier[1] : "#475569");
      ctx.restore();
      if (!got) {
        // cadenas
        const lx = mx + 28, ly = my + 28;
        disc(ctx, lx, ly, 14, "#1e293b");
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(lx, ly - 3, 5, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(lx - 7, ly - 3, 14, 10);
      }
      // textes
      const tx = x + 128, tw = cardW - 144;
      ctx.textAlign = "left";
      ctx.font = `${fitText(ctx, name, tw, 21, "CardBold")}px CardBold`;
      ctx.fillStyle = got ? "#ffffff" : "rgba(226,232,240,0.75)";
      ctx.fillText(name, tx, cy + 36);
      ctx.font = "14px CardText";
      ctx.fillStyle = got ? "rgba(254,243,199,0.85)" : "rgba(148,163,184,0.85)";
      wrapText(ctx, desc, tx, cy + 58, tw, 16, 3);
      if (got) {
        ctx.font = "12px CardBold";
        ctx.fillStyle = tier[1];
        ctx.fillText(`Débloqué le ${succDate(got)}`, tx, cy + cardH - 18);
        tdPill(ctx, x + cardW - 58, cy + cardH - 23, `+${dust}`, rgba(tier[2], 0.9), "#ffffff", 12);
        if (isTitle) tdPill(ctx, x + cardW - 60, cy + 14, "TITRE", "#fbbf24", "#3d1702", 10);
      } else {
        const bw = tw - 70, by = cy + cardH - 28;
        roundRect(ctx, tx, by, bw, 9, 4.5);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fill();
        if (prog > 0) {
          const bg = ctx.createLinearGradient(tx, 0, tx + bw, 0);
          bg.addColorStop(0, tier[2]);
          bg.addColorStop(1, tier[1]);
          roundRect(ctx, tx, by, Math.max(9, bw * (prog / goal)), 9, 4.5);
          ctx.fillStyle = bg;
          ctx.fill();
        }
        ctx.textAlign = "right";
        ctx.font = "13px CardBold";
        ctx.fillStyle = "#cbd5e1";
        ctx.fillText(`${prog} / ${goal}`, x + cardW - 14, by + 9);
      }
    });
    y += Math.ceil(list.length / cols) * (cardH + gap);
  }
  return c;
}
// l'écran des succès : l'image, puis le choix du titre (deux menus si plus de 25 succès débloqués)
async function achievementsPayloadHD(userId) {
  const a = achOf(userId), unlocked = ACHIEVEMENTS.filter(([id]) => a.unlocked[id]);
  const file = new AttachmentBuilder(await (await drawAchievementsHall(userId)).encode("jpeg", 88), { name: "succes.jpg" });
  const option = ([id, emoji, name]) => ({ label: name, value: id, emoji: /\p{Extended_Pictographic}/u.test(emoji) ? emoji : "🏅", default: a.title === id });
  const menus = [unlocked.slice(0, 25), unlocked.slice(25, 50)].filter((l) => l.length).map((list, k) =>
    new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(k ? "carte_succ_titre2" : "carte_succ_titre").setPlaceholder(k ? "Choisir mon titre (suite)…" : "Choisir le titre affiché sur mon profil…").addOptions(list.map(option)))
  );
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xfbbf24)
        .setTitle(`🏅 Salle des trophées — ${unlocked.length} / ${ACHIEVEMENTS.length}`)
        .setDescription(`Chaque succès rapporte de la poussière d'étoile. Titre affiché sur votre profil : **${achievementTitle(userId) ?? "aucun"}**.`)
        .setImage("attachment://succes.jpg"),
    ],
    files: [file],
    attachments: [],
    components: menus,
  };
}
