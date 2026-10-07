
// --- Cartes Utilitaire (comme les cartes Objet de Pokémon) ---
// Elles ne combattent pas : on les équipe. Une carte sur l'île (choisie par le gardien ou son coéquipier),
// une carte pour les combats de boss. Chaque carte a un effet sur l'île et un effet contre le boss.
const UTILITY = {
  ut_trousse: { ...C("ut_trousse", "Trousse de secours", "🩹", "commune", "Bandages, baume et bonne humeur."), gen: 1, fx: "heal", island: "Après chaque attaque repoussée, la défense récupère 25 % de ses PV.", boss: "Votre équipe entre en combat avec 10 % de PV en plus." },
  ut_elixir: { ...C("ut_elixir", "Élixir d'énergie", "🧪", "peucommune", "Une gorgée, et l'on repart à l'assaut."), gen: 1, fx: "energy", island: "La défense commence chaque combat avec 2 ⚡ de plus.", boss: "Vous commencez le combat avec 2 ⚡ de plus." },
  ut_bouclier: { ...C("ut_bouclier", "Bouclier de la Maison", "🛡️", "rare", "Forgé dans les grilles du vieux portail."), gen: 1, fx: "guard", island: "Les cartes de la défense ont 20 % de PV en plus.", boss: "Vos cartes ont 20 % de PV en plus." },
  ut_lame: { ...C("ut_lame", "Lame du Fondateur", "⚔️", "epique", "Elle n'a jamais quitté son fourreau… jusqu'ici."), gen: 1, fx: "blade", island: "Les cartes de la défense frappent 15 % plus fort.", boss: "Vos cartes infligent 25 % de dégâts en plus au boss." },
  ut_phenix: { ...C("ut_phenix", "Plume de phénix", "🪶", "legendaire", "Elle brûle sans jamais se consumer."), gen: 1, fx: "phoenix", island: "Une fois par combat, la dernière carte mise K.O. renaît avec la moitié de ses PV.", boss: "Une fois par combat, votre dernière carte mise K.O. renaît avec la moitié de ses PV." },
};
Object.assign(FLUENT, { "🩹": "Adhesive bandage", "🧪": "Test tube", "🛡️": "Shield", "⚔️": "Crossed swords", "🪶": "Feather" });
const isUtility = (k) => String(k).replace("*", "").startsWith("ut_");
const utilityColor = { heal: "#22c55e", energy: "#a855f7", guard: "#3b82f6", blade: "#ef4444", phoenix: "#f97316" };
// objets équipés : celui de l'île (dans l'état de l'île) et celui de chaque joueur pour le boss
const bossItemOf = (userId) => {
  const k = load().utility?.[userId];
  return k && (load().inv[userId]?.[k] ?? 0) > 0 ? UTILITY[k] : null;
};
function islandItemOf(isl) {
  const k = isl?.item;
  if (!k || !UTILITY[k]) return null;
  return islandMates(isl.holder).some((m) => (load().inv[m]?.[k] ?? 0) > 0) ? UTILITY[k] : null;
}
const ownedUtilities = (ids) => Object.values(UTILITY).filter((u) => ids.some((id) => (load().inv[id]?.[u.id] ?? 0) > 0));
// applique l'objet à une équipe en combat
function applyUtility(p, item, vsBoss) {
  if (!item || !p?.team?.length) return;
  p.item = item.id;
  if (item.fx === "energy") p.energy = Math.min(MAX_ENERGY, (p.energy ?? 1) + 2);
  if (item.fx === "phoenix") p.phoenix = true;
  for (const f of p.team) {
    const hpK = item.fx === "guard" ? 1.2 : item.fx === "heal" && vsBoss ? 1.1 : 1;
    if (hpK !== 1) {
      const frac = f.maxHp ? f.hp / f.maxHp : 1;
      f.maxHp = Math.round(f.maxHp * hpK);
      f.hp = Math.round(f.maxHp * frac);
    }
    const dmgK = item.fx === "blade" ? (vsBoss ? 1.25 : 1.15) : 1;
    if (dmgK !== 1) {
      f.attackDmg = Math.round(f.attackDmg * dmgK);
      f.specialDmg = Math.round(f.specialDmg * dmgK);
    }
  }
}
{
  const all = allCards, pool = boosterPool, series = seriesOf, kind = kindOf, creature = drawCreatureCard, best = bestTeam, pick = setTeam, begin = beginRounds, resolve = resolveRoundState, over = islandBattleOver, how = howToGet;
  allCards = () => [...all(), ...Object.values(UTILITY)];
  boosterPool = () => [...pool(), ...Object.values(UTILITY)];
  seriesOf = (card) => (card.id.startsWith("ut_") ? "utilitaire" : series(card));
  kindOf = (card) => (UTILITY[card.id] ? "Utilitaire · Objet à équiper" : kind(card));
  howToGet = (card) => (UTILITY[card.id] ? ["🎒", "Boosters · à équiper sur l'île ou contre le boss", "#38bdf8"] : how(card));
  SERIES_LABELS.utilitaire = "🎒 Utilitaires";
  drawCreatureCard = (card, holo = false, t = 0.37) => (UTILITY[card.id] ? drawUtilityCard(card, holo, t) : creature(card, holo, t));
  // les Utilitaires ne combattent pas
  bestTeam = (userId) => {
    const keys = best(userId);
    if (!keys.some(isUtility)) return keys;
    const seen = new Set(keys.filter((k) => !isUtility(k)).map((k) => k.replace("*", "")));
    const extra = ownedKeys(userId)
      .map(([k]) => k)
      .filter((k) => !isUtility(k) && !k.startsWith("duo_") && !seen.has(k.replace("*", "")))
      .sort((a, c) => fighterPower(c) - fighterPower(a));
    return [...keys.filter((k) => !isUtility(k)), ...extra].slice(0, 3);
  };
  setTeam = (client, b, i, keys) => pick(client, b, i, keys.filter((k) => !isUtility(k)));
  // au début du combat : l'objet du joueur contre le boss, l'objet de l'île pour la défense
  beginRounds = async (client, b) => {
    if (b.boss) applyUtility(b.players[0], bossItemOf(b.players[0].id), true);
    if (b.island) applyUtility(b.players[1], islandItemOf(islandsState()[b.island]), false);
    return begin(client, b);
  };
  // Plume de phénix : la dernière carte mise K.O. renaît une fois
  resolveRoundState = (b) => {
    const res = resolve(b);
    for (const p of b.players) {
      if (!p.phoenix || p.phoenixUsed || p.team.some((f) => f.hp > 0)) continue;
      const f = p.team[p.active] ?? p.team[0];
      f.hp = Math.round(f.maxHp / 2);
      p.phoenixUsed = true;
      res.lines?.push({ text: `🪶 **Plume de phénix** : ${f.name} renaît de ses cendres avec ${f.hp} PV !` });
    }
    return res;
  };
  // Trousse de secours : soin automatique après une attaque repoussée
  islandBattleOver = async (client, b, winner) => {
    await over(client, b, winner);
    const isl = islandsState()[b.island];
    if (winner !== 0 && isl?.holder && islandItemOf(isl)?.fx === "heal") {
      settleIsland(isl);
      for (const d of isl.team) d.frac = Math.min(1, d.frac + 0.25);
      save();
      islandsDirty = true;
    }
  };
}

// --- Le dessin : une carte Objet, cadre argent et bandeau de couleur ---
async function drawUtilityCard(card, holo = false, t = 0.37) {
  const W = 600, H = 840, col = utilityColor[card.fx] ?? "#38bdf8", m = METAL[card.rarity], rank = ORDER.indexOf(card.rarity);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // cadre argenté (doré pour la légendaire)
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.fillStyle = metalGradient(ctx, W, H, rank >= ORDER.indexOf("legendaire") ? METAL.legendaire : ["#f8fafc", "#94a3b8", "#e2e8f0", "#475569", "#cbd5e1"], Math.sin(TAU * t) * 0.25);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  roundRect(ctx, 1, 1, W - 2, H - 2, 27);
  ctx.stroke();
  // fond : papier clair avec motif d'hexagones
  ctx.save();
  roundRect(ctx, 16, 16, W - 32, H - 32, 18);
  ctx.clip();
  const bg = ctx.createLinearGradient(0, 16, 0, H);
  bg.addColorStop(0, mixHex("#f8fafc", col, 0.18));
  bg.addColorStop(1, mixHex("#e2e8f0", col, 0.32));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = rgba(col, 0.12);
  ctx.lineWidth = 1.5;
  for (let y = 0, row = 0; y < H; y += 30, row++)
    for (let x = row % 2 ? 26 : 0; x < W; x += 52) {
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(x + Math.cos((k / 6) * TAU) * 15, y + Math.sin((k / 6) * TAU) * 15);
      ctx.closePath();
      ctx.stroke();
    }
  // bandeau du haut : UTILITAIRE
  const bandG = ctx.createLinearGradient(16, 0, W - 16, 0);
  bandG.addColorStop(0, shade(col, 0.7));
  bandG.addColorStop(0.5, col);
  bandG.addColorStop(1, shade(col, 0.7));
  ctx.fillStyle = bandG;
  ctx.beginPath();
  ctx.moveTo(16, 16);
  ctx.lineTo(W - 16, 16);
  ctx.lineTo(W - 16, 70);
  ctx.lineTo(W / 2 + 140, 70);
  ctx.lineTo(W / 2 + 120, 84);
  ctx.lineTo(W / 2 - 120, 84);
  ctx.lineTo(W / 2 - 140, 70);
  ctx.lineTo(16, 70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "18px CardEngrave";
  ctx.fillStyle = "#ffffff";
  spaced(ctx, "UTILITAIRE", W / 2, 54, 6);
  ctx.font = "12px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText("OBJET À ÉQUIPER", W / 2, 77);
  // nom
  ctx.font = `${fitText(ctx, card.name, 500, 38, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#0f172a";
  ctx.fillText(card.name, W / 2, 132);
  // illustration : l'objet dans un médaillon, avec un halo qui tourne
  const cx = W / 2, cy = 290;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(TAU * t * 0.25);
  for (let i = 0; i < 16; i++) {
    ctx.rotate(TAU / 16);
    ctx.fillStyle = rgba(col, i % 2 ? 0.08 : 0.18);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-26, -190);
    ctx.lineTo(26, -190);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = rgba(col, 0.8);
  ctx.shadowBlur = 30;
  disc(ctx, cx, cy, 128, metalGradient(ctx, W, H, m, Math.sin(TAU * t) * 0.3));
  ctx.restore();
  const inner = ctx.createRadialGradient(cx - 30, cy - 40, 10, cx, cy, 118);
  inner.addColorStop(0, mixHex("#ffffff", col, 0.15));
  inner.addColorStop(1, shade(col, 0.45));
  disc(ctx, cx, cy, 116, inner);
  glow(ctx, cx, cy, 130, col, 0.35);
  const art = FLUENT[card.emoji] ? await fetchImage(`fluent:${card.emoji}`, fluentUrl(FLUENT[card.emoji])).catch(() => null) : null;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  if (art) ctx.drawImage(art, cx - 95, cy - 100 + Math.sin(TAU * t) * 5, 190, 190);
  ctx.restore();
  // reflets selon la rareté
  if (rank >= ORDER.indexOf("rare") || holo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 116, 0, TAU);
    ctx.clip();
    ctx.globalCompositeOperation = "screen";
    const sx = cx - 260 + t * 520, sg = ctx.createLinearGradient(sx, cy - 120, sx + 120, cy + 120);
    sg.addColorStop(0, "rgba(255,255,255,0)");
    sg.addColorStop(0.5, "rgba(255,255,255,0.55)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(cx - 130, cy - 130, 260, 260);
    ctx.restore();
  }
  if (rank >= ORDER.indexOf("epique") || holo) {
    const R = seeded(hashOf(card.id));
    for (let i = 0; i < 26; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      const a = R() * TAU, r = 120 + R() * 70;
      sparkle(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.8, 1 + tw * 4, rgba(rank >= ORDER.indexOf("legendaire") ? "#fbbf24" : "#ffffff", 0.3 + tw * 0.7));
    }
  }
  // les deux effets
  const box = (y, icon, title, text, tint) => {
    roundRect(ctx, 40, y, W - 80, 104, 14);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.fill();
    ctx.strokeStyle = rgba(tint, 0.6);
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, 40, y, 150, 30, 14);
    ctx.fillStyle = tint;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = "13px CardEngrave";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`${title}`, 56, y + 21);
    ctx.font = "16px CardText";
    ctx.fillStyle = "#1e293b";
    wrapText(ctx, text.replace(/(\d+) ⚡/g, "$1 énergies"), 58, y + 56, W - 116, 20, 3); // la police des cartes n'a pas le symbole ⚡
    void icon;
  };
  box(450, "ile", "SUR L'ÎLE", card.island, "#0ea5e9");
  box(570, "boss", "CONTRE LE BOSS", card.boss, "#b91c1c");
  // règle et pied de carte
  ctx.textAlign = "center";
  ctx.font = "13px CardItalic";
  ctx.fillStyle = "#334155";
  ctx.fillText(`« ${card.text} »`, W / 2, 712);
  ctx.font = "12px CardBold";
  ctx.fillStyle = "#475569";
  ctx.fillText("Règle : un seul objet à la fois sur l'île, et un seul pour les combats de boss.", W / 2, 740);
  const footY = H - 30;
  ctx.textAlign = "left";
  seriesIcon(ctx, "utilitaire", 44, footY - 4, 6, "#334155");
  ctx.font = "12px CardBold";
  ctx.fillStyle = "#334155";
  ctx.fillText(numberOf(card).replace("#", ""), 56, footY);
  rarityIcon(ctx, card.rarity, W / 2 - 46, footY - 4, 7, "#334155");
  ctx.font = "11px CardEngrave";
  ctx.fillText(RARITIES[card.rarity].name.toUpperCase(), W / 2 - 34, footY);
  if (holo) sparkle(ctx, W / 2 + 64, footY - 4, 4, `hsl(${Math.round(t * 360)},95%,65%)`);
  ctx.textAlign = "right";
  ctx.font = "11px CardText";
  ctx.fillText("Illus. La Maison · G1", W - 44, footY);
  if (holo) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.3);
    ctx.restore();
  }
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.08;
  ctx.drawImage(printTexture(), 0, 0);
  ctx.restore();
  return c;
}

// --- Équiper : sur l'île (« Mon île ») et pour le boss (menu de l'Arène) ---
{
  const mine = myIslandPayload, hub = arenaHubPayload, handleIsle = handleIslandInteraction, handleHub = handleArenaHubInteraction;
  myIslandPayload = (userId) => {
    const p = mine(userId), id = islandOf(userId);
    if (!id || !p.components) return p;
    const isl = islandsState()[id], items = ownedUtilities(islandMates(isl.holder)), cur = islandItemOf(isl);
    if (items.length && p.components.length < 5)
      p.components.splice(1, 0, new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_ut_isle")
          .setPlaceholder(cur ? `🎒 Objet de l'île : ${cur.name}` : "🎒 Équiper un objet Utilitaire sur l'île…")
          .addOptions([{ label: "Aucun objet", value: "none", emoji: "✖️" }, ...items.map((u) => ({ label: u.name, value: u.id, emoji: u.emoji, description: u.island.slice(0, 100), default: cur?.id === u.id }))])
      ));
    if (cur && p.embeds?.[0]) p.embeds[0].setDescription(`${p.embeds[0].data.description}\n🎒 **Objet équipé** : ${cur.emoji} ${cur.name} — ${cur.island}`);
    return p;
  };
  arenaHubPayload = async (userId, note = "") => {
    const p = await hub(userId, note), items = ownedUtilities([userId]), cur = bossItemOf(userId);
    if (items.length)
      p.components.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("carte_ut_boss")
          .setPlaceholder(cur ? `🎒 Objet contre le boss : ${cur.name}` : "🎒 Équiper un objet Utilitaire contre le boss…")
          .addOptions([{ label: "Aucun objet", value: "none", emoji: "✖️" }, ...items.map((u) => ({ label: u.name, value: u.id, emoji: u.emoji, description: u.boss.slice(0, 100), default: cur?.id === u.id }))])
      ));
    return p;
  };
  handleIslandInteraction = async (interaction, client) => {
    if (interaction.customId !== "carte_ut_isle") return handleIsle(interaction, client);
    const id = islandOf(interaction.user.id), v = interaction.values[0];
    if (!id) {
      await interaction.update(myIslandPayload(interaction.user.id));
      return true;
    }
    const isl = islandsState()[id];
    isl.item = v === "none" ? null : v;
    save();
    islandsDirty = true;
    await interaction.update(myIslandPayload(interaction.user.id));
    return true;
  };
  handleArenaHubInteraction = async (interaction, client) => {
    if (interaction.customId !== "carte_ut_boss") return handleHub(interaction, client);
    const st = load(), v = interaction.values[0];
    st.utility ??= {};
    st.utility[interaction.user.id] = v === "none" ? null : v;
    save();
    await interaction.deferUpdate();
    await interaction.editReply(await arenaHubPayload(interaction.user.id, v === "none" ? "Objet retiré." : `🎒 **${UTILITY[v].name}** équipé pour les combats de boss.`));
    return true;
  };
}
{
  // symbole de la série : un sac à dos
  const icon = seriesIcon;
  seriesIcon = (ctx, s, x, y, size, color) => {
    if (s !== "utilitaire") return icon(ctx, s, x, y, size, color);
    ctx.fillStyle = color;
    roundRect(ctx, x - size * 0.7, y - size * 0.55, size * 1.4, size * 1.5, size * 0.35);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, size * 0.18);
    ctx.beginPath();
    ctx.arc(x, y - size * 0.55, size * 0.38, Math.PI, 0);
    ctx.stroke();
  };
}

// --- L'objet est posé sur le plateau : on le voit dans l'arène, de chaque côté, pendant tout le combat ---
function pendingItem(b, i) {
  const p = b.players[i];
  if (p.item) return UTILITY[p.item];
  if (b.boss && i === 0) return bossItemOf(p.id);
  if (b.island && i === 1) return islandItemOf(islandsState()[b.island]);
  return null;
}
async function drawBoardItem(ctx, item, x, y, side) {
  const col = utilityColor[item.fx] ?? "#38bdf8", w = 78, h = 109;
  // socle lumineux sur le sol de l'arène
  ctx.save();
  ctx.fillStyle = rgba(col, 0.35);
  ctx.beginPath();
  ctx.ellipse(x, y + h / 2 + 8, 58, 14, 0, 0, TAU);
  ctx.fill();
  glow(ctx, x, y + h / 2, 90, col, 0.4);
  ctx.translate(x, y);
  ctx.rotate(side ? 0.08 : -0.08);
  ctx.shadowColor = rgba(col, 0.9);
  ctx.shadowBlur = 18;
  ctx.drawImage(await cardThumb(item, false, w * 2, h * 2), -w / 2, -h / 2, w, h);
  ctx.restore();
  // étiquette
  ctx.save();
  ctx.font = "11px CardEngrave";
  const label = "OBJET EN JEU", tw = ctx.measureText(label).width + 22;
  roundRect(ctx, x - tw / 2, y - h / 2 - 26, tw, 20, 10);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.fillText(label, x, y - h / 2 - 12);
  ctx.font = `${fitText(ctx, item.name, 150, 13, "CardBold")}px CardBold`;
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = 6;
  ctx.fillText(item.name, x, y + h / 2 + 34);
  ctx.restore();
}
{
  const draw = drawArena;
  drawArena = async (b, opts = {}) => {
    const c = await draw(b, opts);
    const items = [pendingItem(b, 0), pendingItem(b, 1)];
    if (!items[0] && !items[1]) return c;
    const ctx = c.getContext("2d");
    // de part et d'autre du médaillon « VS », sur le sol de l'arène
    if (items[0]) await drawBoardItem(ctx, items[0], c.width / 2 - 120, c.height - 176, 0);
    if (items[1]) await drawBoardItem(ctx, items[1], c.width / 2 + 120, c.height - 176, 1);
    return c;
  };
  // au début du combat, un message rappelle l'objet posé
  const begin = beginRounds;
  beginRounds = async (client, b) => {
    const items = [pendingItem(b, 0), pendingItem(b, 1)];
    await begin(client, b);
    for (const [i, item] of items.entries())
      if (item) b.lastLines = [{ text: `${b.players[i].name} pose ${item.name} sur le plateau : ${(b.boss || i === 0 ? item.boss : item.island).replace(/\.$/, "")}.` }, ...(b.lastLines ?? [])];
  };
}
{
  // dans l'animation de chaque manche aussi : l'objet est posé dans les coins bas du plateau
  let gifItems = null;
  const bgOf = arenaBackground, gif = clashGif;
  arenaBackground = (W, H) => {
    const bg = (gifItems && decorOverride(W, H, gifItems.b)) || bgOf(W, H);
    if (!gifItems) return bg;
    const ctx = bg.getContext("2d");
    gifItems.items.forEach((item, i) => {
      if (!item) return;
      const col = utilityColor[item.fx] ?? "#38bdf8", w = 58, h = 81, x = i ? W - 62 : 62, y = H - 92;
      glow(ctx, x, y, 70, col, 0.45);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(i ? 0.08 : -0.08);
      ctx.shadowColor = rgba(col, 0.9);
      ctx.shadowBlur = 14;
      ctx.drawImage(gifItems.thumbs[i], -w / 2, -h / 2, w, h);
      ctx.restore();
      ctx.font = "9px CardEngrave";
      ctx.textAlign = "center";
      ctx.fillStyle = col;
      ctx.fillText("OBJET EN JEU", x, y - h / 2 - 6);
    });
    return bg;
  };
  clashGif = async (b, res, hp0, pre) => {
    const items = [pendingItem(b, 0), pendingItem(b, 1)];
    const thumbs = await Promise.all(items.map((it) => (it ? cardThumb(it, false, 116, 162) : null)));
    gifItems = { items, thumbs, b };
    // le décor est dessiné tout au début de l'animation, avant toute attente
    const run = gif(b, res, hp0, pre);
    gifItems = null;
    return run;
  };
}
