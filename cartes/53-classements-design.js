
// --- Classements des cartes : le Hall of Fame en image ---
// Podium de la collection (top 3 sur les marches, puis 4 à 10), et six panneaux : Arène, Équipes, Succès,
// holos, Shiny, gardien de l'île. L'image n'est redessinée que si un classement change.
function lbData() {
  const st = load(), users = Object.keys(st.inv);
  const top = (score, n) => users.map((id) => [id, score(id)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
  const holoCount = (id) => Object.entries(st.inv[id] ?? {}).filter(([k, n]) => k.endsWith("*") && n > 0).length;
  const shinyCount = (id) => Object.values(SHINIES).filter((c) => (st.inv[id]?.[c.id] ?? 0) + (st.inv[id]?.[`${c.id}*`] ?? 0) > 0).length;
  const isl = islandsState().lagon;
  return {
    collection: top(collectionScore, 10),
    arena: Object.entries(st.arena)
      .filter(([, x]) => x.w + x.l + x.d > 0 || (x.bp ?? 0) > 0)
      .sort((a, b) => b[1].elo - a[1].elo)
      .slice(0, 5)
      .map(([id, x]) => [id, x.elo, x.w]),
    season: st.arenaSeason?.n ?? 1,
    teams: Object.values(teamsState())
      .sort((a, b) => b.xp - a.xp)
      .slice(0, 5)
      .map((t) => [t.id, t.name, t.emblem, teamLevel(t), t.members]),
    succes: top((id) => Object.keys(st.achievements[id]?.unlocked ?? {}).length, 5),
    holos: top(holoCount, 5),
    shiny: top(shinyCount, 5),
    island: isl?.holder ? [isl.holder, Math.floor((Date.now() - isl.since) / HOUR)] : null,
  };
}
async function drawLeaderboards(d) {
  const W = 1600, H = 1500, c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.drawImage(tdStage(W, H), 0, 0);
  tdTitle(ctx, W, 128, "Classements", 72, "Les meilleurs joueurs des Cartes de la Maison · mis à jour en direct");
  const ids = [...d.collection.map((x) => x[0]), ...d.arena.map((x) => x[0]), ...d.succes.map((x) => x[0]), ...d.holos.map((x) => x[0]), ...d.shiny.map((x) => x[0]), ...(d.island ? [d.island[0]] : [])];
  const av = await tdAvatars(ids);
  const medal = ["#fbbf24", "#cbd5e1", "#d97706"];
  // --- le podium de la collection ---
  const py = 210;
  ctx.textAlign = "left";
  ctx.font = "22px CardEngrave";
  ctx.fillStyle = "#fbbf24";
  spacedLeft(ctx, "COLLECTION", 70, py + 10, 5);
  ctx.font = "15px CardItalic";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText("Score : chaque carte compte selon sa rareté, double en holo", 70, py + 36);
  const base = py + 440, steps = [[1, 250, 200, 1], [0, 520, 260, 0], [2, 790, 160, 2]]; // [place, x, hauteur, couleur]
  for (const [place, x, h, col] of steps) {
    const row = d.collection[place];
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, rgba(medal[col], 0.55));
    g.addColorStop(1, "rgba(15,15,40,0.92)");
    roundRect(ctx, x - 115, base - h, 230, h, 14);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = medal[col];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = "56px CardTitle";
    ctx.fillStyle = rgba(medal[col], 0.9);
    ctx.fillText(String(place + 1), x, base - h + 66);
    if (!row) continue;
    const ay = base - h - 92, r = place === 0 ? 64 : 52;
    glow(ctx, x, ay, r * 2, medal[col], 0.4);
    tdAvatarDisc(ctx, av.get(row[0]), x, ay, r, medal[col], row[0]);
    if (place === 0) {
      const crown = await tdFluent("Crown");
      if (crown) ctx.drawImage(crown, x - 40, ay - r - 70, 80, 80);
    }
    ctx.font = `${fitText(ctx, pseudo(row[0]), 220, 26, "CardTitle")}px CardTitle`;
    ctx.fillStyle = "#fff7d6";
    ctx.fillText(pseudo(row[0]), x, base - h + 104);
    ctx.font = "16px CardBold";
    ctx.fillStyle = medal[col];
    ctx.fillText(`${row[1].toLocaleString("fr-FR")} pts`, x, base - h + 128);
  }
  // places 4 à 10
  const lx = 960, lw = 570;
  roundRect(ctx, lx, py + 60, lw, 380, 22);
  ctx.fillStyle = "rgba(10,10,30,0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(251,191,36,0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const rest = d.collection.slice(3);
  if (!rest.length) {
    ctx.textAlign = "center";
    ctx.font = "18px CardItalic";
    ctx.fillStyle = "rgba(203,213,225,0.6)";
    ctx.fillText("Les places 4 à 10 vous attendent…", lx + lw / 2, py + 255);
  }
  rest.forEach(([id, v], k) => {
    const y = py + 104 + k * 50;
    ctx.textAlign = "left";
    ctx.font = "20px CardTitle";
    ctx.fillStyle = "#a5b4fc";
    ctx.fillText(String(k + 4), lx + 28, y + 7);
    tdAvatarDisc(ctx, av.get(id), lx + 86, y, 19, tdTier(id)[2], id);
    ctx.font = `${fitText(ctx, pseudo(id), 300, 19, "CardBold")}px CardBold`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(pseudo(id), lx + 118, y + 7);
    ctx.textAlign = "right";
    ctx.font = "17px CardBold";
    ctx.fillStyle = "#fde68a";
    ctx.fillText(`${v.toLocaleString("fr-FR")} pts`, lx + lw - 28, y + 7);
  });
  // --- les six panneaux ---
  const panels = [
    ["Crossed swords", `ARÈNE · SAISON ${d.season}`, d.arena.map(([id, elo, w]) => ({ id, label: pseudo(id), value: `${elo}`, sub: `${tierOf(elo)[1]} · ${w} V`, color: tierOf(elo)[2] })), "Aucun combat cette saison"],
    ["Shield", "ÉQUIPES", d.teams.map(([, name, emblem, lvl, members]) => ({ crest: emblem, label: name, value: `niv. ${lvl}`, sub: members.map((m) => pseudo(m)).join(" & "), color: "#fbbf24" })), "Aucune équipe"],
    ["Sports medal", "SUCCÈS", d.succes.map(([id, v]) => ({ id, label: pseudo(id), value: `${v} / ${ACHIEVEMENTS.length}`, color: "#fbbf24" })), "Personne pour le moment"],
    ["Sparkles", "HOLOGRAPHIQUES", d.holos.map(([id, v]) => ({ id, label: pseudo(id), value: `${v} holo${v > 1 ? "s" : ""}`, color: "#e879f9" })), "Personne pour le moment"],
    ["Four leaf clover", "CHASSEURS DE SHINY", d.shiny.map(([id, v]) => ({ id, label: pseudo(id), value: `${v} shiny`, color: "#34d399" })), "Personne pour le moment"],
    ["Desert island", "GARDIEN DE L'ÎLE", d.island ? [{ id: d.island[0], label: pseudo(d.island[0]), value: d.island[1] ? `${d.island[1]} h` : "< 1 h", sub: "garde l'île", color: "#22d3ee" }] : [], "L'île est libre !"],
  ];
  const gx = 60, gy = 730, cols = 3, pw = (W - 120 - 2 * 30) / cols, ph = 360;
  for (const [k, [icon, title, rows, empty]] of panels.entries()) {
    const x = gx + (k % cols) * (pw + 30), y = gy + Math.floor(k / cols) * (ph + 30);
    roundRect(ctx, x, y, pw, ph, 22);
    ctx.fillStyle = "rgba(10,10,30,0.74)";
    ctx.fill();
    ctx.strokeStyle = "rgba(251,191,36,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const img = await tdFluent(icon);
    if (img) ctx.drawImage(img, x + 22, y + 16, 42, 42);
    ctx.textAlign = "left";
    ctx.font = "16px CardEngrave";
    ctx.fillStyle = "#fbbf24";
    spacedLeft(ctx, title, x + 76, y + 44, 3);
    if (!rows.length) {
      ctx.textAlign = "center";
      ctx.font = "17px CardItalic";
      ctx.fillStyle = "rgba(203,213,225,0.6)";
      ctx.fillText(empty, x + pw / 2, y + ph / 2 + 20);
      continue;
    }
    for (const [i, r] of rows.entries()) {
      const ry = y + 96 + i * 54, first = i === 0;
      if (first) {
        roundRect(ctx, x + 12, ry - 26, pw - 24, 52, 14);
        ctx.fillStyle = "rgba(251,191,36,0.12)";
        ctx.fill();
      }
      ctx.textAlign = "center";
      if (i < 3) {
        disc(ctx, x + 38, ry, 14, medal[i]);
        ctx.font = "15px CardBold";
        ctx.fillStyle = "#1c1206";
        ctx.fillText(String(i + 1), x + 38, ry + 5);
      } else {
        ctx.font = "16px CardBold";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(String(i + 1), x + 38, ry + 6);
      }
      if (r.crest) ctx.drawImage(await drawTeamCrest(r.crest), x + 60, ry - 20, 40, 40);
      else tdAvatarDisc(ctx, av.get(r.id), x + 80, ry, 18, r.color, r.id);
      ctx.textAlign = "left";
      ctx.font = `${fitText(ctx, r.label, pw - 230, first ? 20 : 18, "CardBold")}px CardBold`;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(r.label, x + 110, ry + (r.sub ? 0 : 6));
      if (r.sub) {
        ctx.font = "12px CardText";
        ctx.fillStyle = "#94a3b8";
        ctx.fillText(r.sub.slice(0, 40), x + 110, ry + 18);
      }
      ctx.textAlign = "right";
      ctx.font = `${first ? 20 : 17}px CardBold`;
      ctx.fillStyle = r.color;
      ctx.fillText(r.value, x + pw - 24, ry + 6);
    }
  }
  return c;
}
async function refreshLeaderboardsHD() {
  const ch = chan("classements");
  if (!ch || ch === channelRef) return;
  const st = load(), d = lbData();
  // les noms comptent aussi (un pseudo qui change redessine l'image)
  const hash = JSON.stringify({ d, names: Object.keys(st.inv).map((id) => pseudo(id)) });
  if (st.boardHash === hash && st.boardMessageId) return;
  const file = new AttachmentBuilder(await (await drawLeaderboards(d)).encode("jpeg", 88), { name: "classements.jpg" });
  const embed = new EmbedBuilder().setColor(0xfbbf24).setTitle("🏆 Classements des Cartes de la Maison").setImage("attachment://classements.jpg").setFooter({ text: "Mis à jour automatiquement" }).setTimestamp();
  const payload = { embeds: [embed], files: [file], attachments: [], allowedMentions: { parse: [] } };
  let msg = st.boardMessageId ? await ch.messages.fetch(st.boardMessageId).catch(() => null) : null;
  if (msg && !(await msg.edit(payload).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) st.boardMessageId = msg.id;
  }
  st.boardHash = hash;
  save();
}
{
  refreshLeaderboards = refreshLeaderboardsHD;
}
