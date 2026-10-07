
// --- Les Îles : des arènes tenues par les joueurs (comme les arènes de Pokémon GO) ---
// Un membre place jusqu'à 3 cartes sur une île libre et la garde : elle lui rapporte de la poussière d'étoile chaque heure.
// Les autres l'attaquent : c'est une IA qui joue les cartes du gardien. Toute la défense K.O. = l'île change de mains.
// Les dégâts restent d'un combat à l'autre (les cartes se soignent doucement) et la défense s'use si on garde l'île très longtemps.
const HOUR = 60 * MINUTE;
const ISLAND_DUST = 10; // poussière par heure pour le gardien
const ISLAND_CAPTURE_DUST = 50; // prime de conquête
const ISLAND_DEFENSE_DUST = 5; // prime du gardien à chaque attaque repoussée
const ISLAND_BONUS = 1.1; // cartes de la série favorite de l'île : PV et attaque +10 %
const ISLAND_REGEN = 0.35; // part des PV récupérée chaque heure
const ISLAND_HEAL_COST = 40;
const ISLAND_COOLDOWN = 10 * MINUTE; // délai avant de réattaquer la même île après une défaite
const ISLAND_PROTECT = 30 * MINUTE; // bouclier après une prise : personne ne peut attaquer
const ISLAND_REVENGE = 2 * HOUR; // l'ancien gardien doit attendre avant de reprendre l'île
const ISLAND_WEAR_AFTER = 12; // heures de garde avant que la défense ne s'use
const ISLAND_WEAR_RATE = 0.02, ISLAND_WEAR_MAX = 0.2; // PV max perdus par heure d'usure, plafond
const ISLAND_AI = { name: "Gardien", offset: 0, boost: 1, smart: 0.75 };
const ISLANDS = {
  lagon: { name: "Île du Lagon", short: "Lagon", emoji: "🏝️", fluent: "Desert island", series: "paris", color: "#22d3ee" },
};
const ISLAND_LAYOUT = 2; // à augmenter quand l'image change de mise en page
const islandFights = new Map(); // île -> id du combat en cours
let islandsDirty = true;

function islandsState() {
  const st = load();
  st.islands ??= {};
  for (const id of Object.keys(ISLANDS)) st.islands[id] ??= { holder: null };
  for (const id of Object.keys(st.islands)) if (!ISLANDS[id]) delete st.islands[id]; // anciennes îles retirées
  return st.islands;
}
// l'île d'un duo appartient aux deux membres : le gardien et son coéquipier la gèrent tous les deux
const islandMates = (holder) => {
  const team = holder ? teamOf(holder) : null;
  return team?.members.length === 2 ? team.members : holder ? [holder] : [];
};
const islandOf = (userId) => Object.keys(ISLANDS).find((id) => islandMates(islandsState()[id].holder).includes(userId)) ?? null;
// nom affiché du gardien : l'équipe si c'est un duo
function islandOwnerName(isl) {
  const team = isl.holder ? teamOf(isl.holder) : null;
  return team?.members.length === 2 ? `${team.emblem} ${team.name}` : isl.holderName ?? "?";
}
// exemplaires bloqués sur une île (ils ne peuvent être ni vendus ni échangés)
function islandLocked(userId, key) {
  const id = islandOf(userId);
  if (!id) return 0;
  const isl = islandsState()[id];
  return isl.team.filter((d) => d.key === key && (d.owner ?? isl.holder) === userId).length;
}
const islandAvailable = (userId, key) => (load().inv[userId]?.[key] ?? 0) - islandLocked(userId, key);
function islandWear(isl) {
  if (!isl.holder) return 0;
  const hours = (Date.now() - isl.since) / HOUR;
  return Math.min(ISLAND_WEAR_MAX, Math.max(0, (hours - ISLAND_WEAR_AFTER) * ISLAND_WEAR_RATE));
}
const defenderFrac = (isl, d) => Math.min(1, d.frac + (ISLAND_REGEN * (Date.now() - isl.hpAt)) / HOUR);
// fixe les PV régénérés jusqu'à maintenant
function settleIsland(isl) {
  for (const d of isl.team) d.frac = defenderFrac(isl, d);
  isl.hpAt = Date.now();
}
// les cartes du gardien, telles qu'elles se battent maintenant (bonus de l'île, usure, dégâts subis)
function islandDefenders(id) {
  const isl = islandsState()[id], def = ISLANDS[id], wear = islandWear(isl);
  return isl.team
    .filter((d) => cardOfKey(d.key))
    .map((d) => {
      const f = fighter(d.key);
      if (f.series === def.series) {
        f.atk = Math.round(f.atk * ISLAND_BONUS);
        f.maxHp = Math.round(f.maxHp * ISLAND_BONUS);
        f.attackDmg = Math.round(10 + f.atk * 0.55);
        f.specialDmg = Math.round(18 + f.atk * 1.1);
      }
      f.maxHp = Math.max(1, Math.round(f.maxHp * (1 - wear)));
      const frac = defenderFrac(isl, d);
      f.hp = frac > 0.001 ? Math.max(1, Math.round(f.maxHp * frac)) : 0;
      return f;
    })
    .sort((a, b) => (b.hp > 0) - (a.hp > 0));
}
// verse la poussière gagnée (heures pleines)
function payIsland(isl) {
  if (!isl.holder) return 0;
  const hours = Math.floor((Date.now() - isl.paidAt) / HOUR);
  if (hours < 1) return 0;
  const gain = hours * ISLAND_DUST;
  load().dust[isl.holder] = (load().dust[isl.holder] ?? 0) + gain;
  isl.earned += gain;
  isl.paidAt += hours * HOUR;
  return gain;
}
function payIslands() {
  let paid = 0;
  for (const isl of Object.values(islandsState())) paid += payIsland(isl);
  if (paid) {
    save();
    islandsDirty = true;
  }
}
function setHolder(id, user, keys) {
  islandsState()[id] = { holder: user.id, holderName: user.name, avatar: user.avatar ?? null, team: keys.slice(0, 3).map((key) => ({ key, frac: 1, owner: user.id })), since: Date.now(), paidAt: Date.now(), hpAt: Date.now(), earned: 0, defenses: 0, cooldown: {}, protectUntil: Date.now() + ISLAND_PROTECT, revenge: {} };
  islandsDirty = true;
}
function releaseIsland(id) {
  const isl = islandsState()[id];
  payIsland(isl);
  islandsState()[id] = { holder: null, lastHolder: isl.holder ?? null };
  islandsDirty = true;
}
function fmtHeld(ms) {
  const min = Math.floor(ms / MINUTE);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.floor(h / 24)} j ${h % 24} h`;
}

// --- Carte de l'archipel ---
let oceanCache = null;
function oceanBackground(W, H) {
  if (oceanCache) return oceanCache;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0c4a6e");
  bg.addColorStop(0.55, "#082f49");
  bg.addColorStop(1, "#020c1b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  glow(ctx, W / 2, -60, 520, "#7dd3fc", 0.22);
  // rayons de lumière sous l'eau
  ctx.save();
  ctx.translate(W / 2, -40);
  for (let i = 0; i < 14; i++) {
    ctx.rotate(0.07);
    ctx.fillStyle = rgba("#bae6fd", i % 2 ? 0.018 : 0.035);
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(-90 - i * 18, H * 1.2);
    ctx.lineTo(40 - i * 10, H * 1.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // vagues
  const rnd = seeded(4242);
  for (let row = 0; row < 26; row++) {
    const y = 40 + row * 31;
    ctx.strokeStyle = rgba("#7dd3fc", 0.04 + rnd() * 0.05);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const yy = y + Math.sin(x / 46 + row * 1.7) * 4 + Math.sin(x / 13 + row) * 1.2;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // reflets
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.6;
    disc(ctx, x, y, r, rgba("#e0f2fe", 0.15 + rnd() * 0.35));
  }
  // rose des vents en filigrane
  ctx.save();
  ctx.translate(W / 2, H / 2 + 20);
  ctx.strokeStyle = rgba("#e0f2fe", 0.07);
  ctx.lineWidth = 2;
  for (const r of [70, 110]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
  }
  ctx.fillStyle = rgba("#e0f2fe", 0.06);
  for (let k = 0; k < 8; k++) {
    ctx.rotate(TAU / 8);
    ctx.beginPath();
    ctx.moveTo(0, -(k % 2 ? 80 : 130));
    ctx.lineTo(10, 0);
    ctx.lineTo(-10, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire);
  roundRect(ctx, 8, 8, W - 16, H - 16, 20);
  ctx.stroke();
  oceanCache = c;
  return c;
}
function islandPill(ctx, x, y, text, color, align = "center", size = 14) {
  ctx.font = `${size}px CardBold`;
  const w = ctx.measureText(text).width + 22, h = size + 12;
  const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
  roundRect(ctx, left, y - h / 2, w, h, h / 2);
  ctx.fillStyle = rgba(color, 0.18);
  ctx.fill();
  ctx.strokeStyle = rgba(color, 0.75);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = color;
  const a = ctx.textAlign;
  ctx.textAlign = "center";
  ctx.fillText(text, left + w / 2, y + size * 0.36);
  ctx.textAlign = a;
  return w;
}
async function drawIslandPanel(ctx, id, x, y, w, h) {
  const def = ISLANDS[id], isl = islandsState()[id], fight = islandFights.has(id);
  // panneau
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 24;
  roundRect(ctx, x, y, w, h, 22);
  const pg = ctx.createLinearGradient(x, y, x, y + h);
  pg.addColorStop(0, "rgba(8,30,56,0.86)");
  pg.addColorStop(1, "rgba(3,12,26,0.92)");
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.restore();
  roundRect(ctx, x, y, w, h, 22);
  ctx.strokeStyle = rgba(def.color, fight ? 0.95 : 0.55);
  ctx.lineWidth = fight ? 3 : 2;
  ctx.stroke();
  // l'île et son lagon
  const ix = x + 112, iy = y + 128;
  glow(ctx, ix, iy + 10, 130, def.color, 0.28);
  for (const [rx, a] of [[96, 0.35], [80, 0.22], [62, 0.14]]) {
    ctx.strokeStyle = rgba(def.color, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(ix, iy + 62, rx, rx * 0.26, 0, 0, TAU);
    ctx.stroke();
  }
  const sand = ctx.createRadialGradient(ix, iy + 60, 4, ix, iy + 60, 80);
  sand.addColorStop(0, "rgba(253,230,138,0.55)");
  sand.addColorStop(1, "rgba(253,230,138,0)");
  ctx.fillStyle = sand;
  ctx.beginPath();
  ctx.ellipse(ix, iy + 60, 78, 20, 0, 0, TAU);
  ctx.fill();
  const art = await fetchImage(`fluent:${def.emoji}`, fluentUrl(def.fluent));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  if (art) ctx.drawImage(art, ix - 78, iy - 92, 156, 156);
  ctx.restore();
  islandPill(ctx, ix, y + h - 34, `BONUS ${SERIES_LABELS[def.series].replace(/^\S+ /, "").toUpperCase().replace(/^(LE|LA|LES) /, "")} +10 %`, def.color, "center", 13);
  // nom et état
  const rx = x + 222, rw = w - 222 - 22;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 6;
  fitText(ctx, def.name, rw - 10, 30, "CardTitle");
  ctx.fillText(def.name, rx, y + 46);
  ctx.shadowBlur = 0;
  if (!isl.holder) {
    ctx.font = "34px CardEngrave";
    ctx.fillStyle = def.color;
    const tw = Array.from("ÎLE LIBRE").reduce((w, ch) => w + ctx.measureText(ch).width, 0) + 3 * 8;
    spaced(ctx, "ÎLE LIBRE", rx + tw / 2, y + 120, 3);
    ctx.font = "17px CardItalic";
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText("Personne ne la garde : placez vos cartes", rx, y + 158);
    ctx.fillText(`et gagnez ${ISLAND_DUST} poussières d'étoile par heure.`, rx, y + 182);
    // emplacements vides
    for (let k = 0; k < 3; k++) {
      const tx = rx + k * 96;
      roundRect(ctx, tx, y + 204, 62, 44, 10);
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = rgba(def.color, 0.45);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "22px CardBold";
      ctx.fillStyle = rgba(def.color, 0.6);
      ctx.textAlign = "center";
      ctx.fillText("+", tx + 31, y + 234);
      ctx.textAlign = "left";
    }
    return;
  }
  // gardien : le blason et le nom de l'équipe pour un duo, sinon la photo du membre
  const team = teamOf(isl.holder), duo = team?.members.length === 2;
  const ax = rx + 22, ay = y + 82;
  if (duo) ctx.drawImage(await drawTeamCrest(team.emblem), ax - 30, ay - 30, 60, 60);
  else {
    const av = isl.avatar ? await fetchImage(`avatar:${isl.avatar}`, isl.avatar) : null;
    disc(ctx, ax, ay, 23, def.color);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 20, 0, TAU);
    ctx.clip();
    if (av) ctx.drawImage(av, ax - 20, ay - 20, 40, 40);
    else disc(ctx, ax, ay, 20, "#1e293b");
    ctx.restore();
  }
  const ownerName = duo ? team.name : isl.holderName ?? "?";
  ctx.fillStyle = "#f8fafc";
  fitText(ctx, ownerName, rw - 60, 21, "CardBold");
  ctx.fillText(ownerName, rx + 54, ay - 3);
  const sub = `${duo ? `${team.members.map((m) => pseudo(m)).join(" & ")} · ` : ""}depuis ${fmtHeld(Date.now() - isl.since)} · ${isl.earned} poussières`;
  ctx.font = `${fitText(ctx, sub, x + w - rx - 80, 14, "CardText")}px CardText`;
  ctx.fillStyle = "#94a3b8";
  ctx.fillText(sub, rx + 54, ay + 18);
  // défenseurs
  const fs_ = islandDefenders(id);
  for (const [k, f] of fs_.entries()) {
    const tx = rx + k * 96, ty = y + 112, tw = 70, th = 98;
    ctx.save();
    if (f.hp <= 0) ctx.globalAlpha = 0.35;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 10;
    ctx.drawImage(await cardThumb(f.card, isHoloKey(f.key), tw * 2, th * 2), tx, ty, tw, th);
    ctx.restore();
    if (f.series === def.series) {
      disc(ctx, tx + tw - 4, ty + 6, 9, def.color);
      ctx.font = "12px CardBold";
      ctx.fillStyle = "#020617";
      ctx.textAlign = "center";
      ctx.fillText("+", tx + tw - 4, ty + 10);
      ctx.textAlign = "left";
    }
    hpBar(ctx, tx - 4, ty + th + 6, tw + 8, 12, f.hp, f.maxHp, false);
    ctx.font = "12px CardBold";
    ctx.fillStyle = f.hp > 0 ? "#e2e8f0" : "#f87171";
    ctx.textAlign = "center";
    ctx.fillText(f.hp > 0 ? `${f.hp} / ${f.maxHp}` : "K.O.", tx + tw / 2, ty + th + 34);
    ctx.textAlign = "left";
  }
  // badges
  let by = y + 28;
  const right = x + w - 18;
  if (fight) {
    islandPill(ctx, right, by, "ATTAQUE EN COURS", "#f87171", "right", 13);
    by += 30;
  }
  const wear = islandWear(isl);
  if (wear > 0) islandPill(ctx, right, by, `USURE -${Math.round(wear * 100)} %`, "#fbbf24", "right", 12);
  ctx.font = "13px CardText";
  ctx.fillStyle = "#64748b";
  ctx.textAlign = "right";
  ctx.fillText(`${isl.defenses} attaque${isl.defenses > 1 ? "s" : ""} repoussée${isl.defenses > 1 ? "s" : ""}`, right, y + h - 18);
  ctx.textAlign = "left";
}
async function drawArchipelago() {
  const W = 1200, H = 760;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(oceanBackground(W, H), 0, 0);
  ctx.textAlign = "center";
  ctx.font = "34px CardEngrave";
  ctx.fillStyle = "#fde68a";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 10;
  spaced(ctx, "L'ÎLE DE LA MAISON", W / 2, 62, 5);
  ctx.shadowBlur = 0;
  ctx.font = "19px CardItalic";
  ctx.fillStyle = "#bae6fd";
  ctx.fillText(`Gardez l'île avec vos cartes : ${ISLAND_DUST} poussières d'étoile par heure… tant que personne ne vous la prend.`, W / 2, 96);
  // une seule île, dessinée en grand
  ctx.save();
  ctx.translate(120, 126);
  ctx.scale(1.6, 1.6);
  await drawIslandPanel(ctx, Object.keys(ISLANDS)[0], 0, 0, 600, 340);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.font = "13px CardEngrave";
  ctx.fillStyle = "rgba(186,230,253,0.55)";
  spaced(ctx, "LES CARTES QUI DÉFENDENT L'ÎLE NE PEUVENT ÊTRE NI VENDUES NI ÉCHANGÉES", W / 2, H - 26, 2);
  ctx.textAlign = "left";
  return c;
}

// --- Messages ---
function islandButtons() {
  const st = islandsState();
  return [
    new ActionRowBuilder().addComponents(
      ...Object.entries(ISLANDS).map(([id, def]) =>
        new ButtonBuilder()
          .setCustomId(`carte_ile_go_${id}`)
          .setLabel(`${st[id].holder ? "Attaquer" : "Prendre"} : ${def.short}`)
          .setEmoji(def.emoji)
          .setStyle(st[id].holder ? ButtonStyle.Danger : ButtonStyle.Success)
      )
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_ile_me").setLabel("Mon île").setEmoji("🛡️").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("carte_ile_rules").setLabel("Règles de l'île").setEmoji("📖").setStyle(ButtonStyle.Secondary)
    ),
  ];
}
async function islandsPayload() {
  const file = new AttachmentBuilder(await (await drawArchipelago()).encode("jpeg", 90), { name: "archipel.jpg" });
  const held = Object.values(islandsState()).filter((x) => x.holder).length;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x0ea5e9)
        .setTitle(`${ISLANDS.lagon.emoji} ${ISLANDS.lagon.name}`)
        .setDescription(
          `Si l'île est libre, placez **jusqu'à 3 cartes** pour la garder : elle vous rapporte **${ISLAND_DUST} ✨ par heure**.\n` +
            "Si elle est gardée, battez sa défense : c'est une **IA qui joue les cartes du gardien**. Mettez toutes ses cartes K.O. et l'île est à vous !" +
            (islandsState().lagon?.holder && (islandsState().lagon.protectUntil ?? 0) > Date.now() ? `\n\n🛡️ **Bouclier de conquête** : l'île ne peut pas être attaquée avant <t:${Math.floor(islandsState().lagon.protectUntil / 1000)}:t> (<t:${Math.floor(islandsState().lagon.protectUntil / 1000)}:R>).` : "")
        )
        .setImage("attachment://archipel.jpg")
        .setFooter({ text: `${held ? "L'île est gardée" : "L'île est libre"} · les dégâts restent d'un combat à l'autre` }),
    ],
    files: [file],
    components: islandButtons(),
  };
}
const ISLAND_RULES = () =>
  new EmbedBuilder()
    .setColor(0x0ea5e9)
    .setTitle("📖 Les règles de l'île")
    .setDescription(
      `🏝️ **Prendre l'île quand elle est libre** : choisissez jusqu'à 3 cartes, elles deviennent sa défense.\n` +
        `✨ **Gains** : le gardien reçoit **${ISLAND_DUST} ✨ par heure**, +${ISLAND_DEFENSE_DUST} ✨ à chaque attaque repoussée. Celui qui conquiert l'île gagne **${ISLAND_CAPTURE_DUST} ✨**.\n` +
        "⚔️ **Attaquer** : combat normal de l'Arène, mais contre une **IA qui joue la défense du gardien**. Le gardien n'a rien à faire. Mettez toutes ses cartes K.O. : votre équipe devient la nouvelle défense.\n" +
        `🩹 **Dégâts** : les PV perdus par la défense restent d'un combat à l'autre et reviennent de ${Math.round(ISLAND_REGEN * 100)} % par heure. Le gardien peut tout soigner pour ${ISLAND_HEAL_COST} ✨.\n` +
        `⭐ **Bonus** : l'île favorise la série **${SERIES_LABELS[ISLANDS.lagon.series].replace(/^\S+ /, "")}** ; ses cartes y ont **+10 %** de PV et d'attaque en défense.\n` +
        `⏳ **Usure** : après ${ISLAND_WEAR_AFTER} h de garde, la défense perd ${Math.round(ISLAND_WEAR_RATE * 100)} % de PV max par heure (jusqu'à -${Math.round(ISLAND_WEAR_MAX * 100)} %). L'île finit toujours par changer de mains !\n` +
        `🔒 Les cartes qui défendent ne peuvent être ni vendues ni échangées. Après une défaite, attendez ${ISLAND_COOLDOWN / MINUTE} min avant de réattaquer l'île.\n` +
        `🛡️ **Bouclier de conquête** : après chaque prise, l'île est protégée ${ISLAND_PROTECT / MINUTE} min, et l'ancien gardien doit attendre ${ISLAND_REVENGE / HOUR} h avant de tenter de la reprendre.\n` +
        "🧠 **IA du gardien** : plus les cartes qui défendent sont rares, mieux elle joue. La défense a l'avantage du terrain (+10 %), et +15 % de PV et de dégâts par niveau de rareté d'avance sur l'attaquant (40 % au plus).\n" +
        "🤝 **Duos** : si un membre d'une équipe garde l'île, elle est à l'équipe : son coéquipier touche les mêmes gains, et les deux peuvent changer la défense (avec les cartes de l'un et de l'autre), la soigner ou la quitter.\n" +
        "🔁 Le gardien peut changer sa défense (les cartes ajoutées arrivent au niveau de PV le plus bas de l'équipe) ou quitter l'île : ses cartes redeviennent libres."
    );
function placeOptions(userId, id) {
  const def = ISLANDS[id], isl = islandsState()[id], seen = new Set(), held = islandOf(userId) === id;
  const current = held ? isl.team.map((d) => `${d.owner ?? isl.holder}|${d.key}`) : [];
  // les deux membres du duo mettent leurs cartes en commun
  const owners = held ? islandMates(isl.holder) : [userId];
  return owners
    .flatMap((owner) => ownedKeys(owner).filter(([k]) => !k.startsWith("ut_")).map(([k]) => ({ owner, k })))
    .sort((a, b) => fighterPower(b.k) - fighterPower(a.k))
    .filter(({ owner, k }) => {
      const cid = `${owner}|${k.replace("*", "")}`;
      if (seen.has(cid)) return false;
      seen.add(cid);
      return true;
    })
    .slice(0, 25)
    .map(({ owner, k }) => {
      const f = fighter(k), bonus = f.series === def.series, theirs = owner !== userId;
      return { label: `${keyLabel(k)}${theirs ? ` (de ${pseudo(owner)})` : ""}`.slice(0, 100), value: `${owner}|${k}`, emoji: RARITIES[f.card.rarity].emoji, description: `${f.maxHp} PV · attaque ${f.atk}${bonus ? " · bonus de l'île +10 %" : ""}`.slice(0, 100), default: current.includes(`${owner}|${k}`) };
    });
}
function placeRow(userId, id, placeholder) {
  const options = placeOptions(userId, id);
  if (!options.length) return null;
  return new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`carte_ile_place_${id}`).setPlaceholder(placeholder).setMinValues(1).setMaxValues(Math.min(3, options.length)).addOptions(options));
}
function myIslandPayload(userId) {
  const id = islandOf(userId);
  if (!id) return { ephemeral: true, content: "🏝️ Vous ne gardez aucune île pour le moment. Prenez-la si elle est libre, ou attaquez son gardien.", embeds: [], components: [] };
  const def = ISLANDS[id], isl = islandsState()[id];
  const lines = islandDefenders(id).map((f) => `${RARITIES[f.card.rarity].emoji} **${keyLabel(f.key)}** — ${f.hp > 0 ? `${f.hp} / ${f.maxHp} PV` : "**K.O.** (se soigne)"}${f.series === def.series ? " ⭐" : ""}`);
  const next = HOUR - ((Date.now() - isl.paidAt) % HOUR);
  const wear = islandWear(isl);
  const rows = [];
  const pr = placeRow(userId, id, "Changer ma défense (jusqu'à 3 cartes)…");
  if (pr) rows.push(pr);
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("carte_ile_heal").setLabel(`Tout soigner (${ISLAND_HEAL_COST} ✨)`).setEmoji("🩹").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("carte_ile_quit").setLabel("Quitter l'île").setEmoji("🚪").setStyle(ButtonStyle.Danger)
    )
  );
  return {
    ephemeral: true,
    content: null,
    embeds: [
      new EmbedBuilder()
        .setColor(parseInt(def.color.slice(1), 16))
        .setTitle(`${def.emoji} ${def.name} — votre île`)
        .setDescription(
          `Gardée depuis **${fmtHeld(Date.now() - isl.since)}** · **${isl.earned} ✨** gagnés · ${isl.defenses} attaque(s) repoussée(s)\n` +
            `Prochain versement de ${ISLAND_DUST} ✨ dans **${Math.ceil(next / MINUTE)} min**.` +
            (wear > 0 ? `\n⏳ Usure : la défense a perdu **${Math.round(wear * 100)} %** de PV max.` : "") +
            (islandFights.has(id) ? "\n⚔️ **Votre île est attaquée en ce moment !**" : "") +
            `\n\n${lines.join("\n")}`
        )
        .setFooter({ text: `⭐ = bonus de l'île (${SERIES_LABELS[def.series].replace(/^\S+ /, "")} +10 %) · les PV reviennent de ${Math.round(ISLAND_REGEN * 100)} % par heure` }),
    ],
    components: rows,
  };
}
async function refreshIslands() {
  const ch = chan("iles");
  if (!ch || ch === channelRef) return;
  islandsDirty = false;
  const st = load();
  const payload = await islandsPayload();
  let msg = st.islandMessageId ? await ch.messages.fetch(st.islandMessageId).catch(() => null) : null;
  // nouvelle mise en page : l'ancien message (et ses anciennes images) est remplacé par un neuf
  if (st.islandLayout !== ISLAND_LAYOUT) {
    const old = await ch.messages.fetch({ limit: 50 }).catch(() => null);
    for (const m of old?.values() ?? []) if (m.author?.id === ch.client?.user?.id && m.embeds?.length) await m.delete().catch(() => null);
    msg = null;
    st.islandLayout = ISLAND_LAYOUT;
    save();
  }
  if (msg && !(await msg.edit({ ...payload, attachments: [] }).catch(() => null))) {
    await msg.delete().catch(() => null);
    msg = null;
  }
  if (!msg) {
    msg = await ch.send(payload).catch(() => null);
    if (msg) {
      st.islandMessageId = msg.id;
      save();
    }
  }
}
async function islandNotice(text, users = []) {
  const msg = await chan("iles")
    ?.send({ content: text, allowedMentions: { users } })
    .catch(() => null);
  deleteLater(msg, MINUTE);
}

// --- Fin d'un combat sur une île ---
async function islandBattleOver(client, b, winner) {
  const id = b.island, def = ISLANDS[id];
  islandFights.delete(id);
  islandsDirty = true;
  const isl = islandsState()[id], attacker = b.players[0];
  if (!isl.holder) return;
  if (winner === 0) {
    const old = isl.holder, oldName = isl.holderName, earned = isl.earned + payIsland(isl), held = Date.now() - isl.since;
    const other = islandOf(attacker.id);
    if (other && other !== id) releaseIsland(other);
    let keys = attacker.team.map((f) => f.key).filter((k) => (load().inv[attacker.id]?.[k] ?? 0) > 0);
    if (!keys.length) keys = bestTeam(attacker.id);
    if (!keys.length) {
      releaseIsland(id);
      save();
      return;
    }
    setHolder(id, attacker, keys);
    islandsState()[id].revenge[old] = Date.now() + ISLAND_REVENGE; // pas de reprise immédiate par l'ancien gardien
    load().dust[attacker.id] = (load().dust[attacker.id] ?? 0) + ISLAND_CAPTURE_DUST;
    ustat(attacker.id, "islands");
    save();
    checkAchievements(attacker.id).catch(() => null);
    await islandNotice(`${def.emoji} <@${attacker.id}> s'empare de l'**${def.name}** (gardée ${fmtHeld(held)} par **${oldName}**) et gagne **${ISLAND_CAPTURE_DUST} ✨** !`, [attacker.id]);
    client.users
      .fetch(old)
      .then((u) => u.send(`${def.emoji} **${attacker.name}** vous a pris l'**${def.name}** après ${fmtHeld(held)} de garde. Vous y avez gagné **${earned} ✨** au total ; vos cartes sont de nouveau libres. Allez la reprendre dans ${chan("iles")} !`))
      .catch(() => null);
  } else {
    settleIsland(isl);
    for (const d of isl.team) {
      const f = b.players[1].team.find((x) => x.key === d.key);
      if (f) d.frac = Math.max(0, f.hp / f.maxHp);
    }
    isl.defenses++;
    isl.cooldown ??= {};
    isl.cooldown[attacker.id] = Date.now();
    load().dust[isl.holder] = (load().dust[isl.holder] ?? 0) + ISLAND_DEFENSE_DUST;
    save();
    await islandNotice(`🛡️ La défense de **${islandOwnerName(isl)}** repousse **${attacker.name}** sur l'**${def.name}** (+${ISLAND_DEFENSE_DUST} ✨ pour le gardien).`);
  }
}
{
  const finish = finishBattle, cancel = cancelBattle;
  finishBattle = async (client, b, winner, reason) => {
    const already = b.phase === "over";
    await finish(client, b, winner, reason);
    if (!already && b.island) await islandBattleOver(client, b, winner).catch((err) => console.error("Île:", err.message));
  };
  cancelBattle = async (b, why) => {
    if (b.island && b.phase !== "over") {
      islandFights.delete(b.island);
      islandsDirty = true;
    }
    return cancel(b, why);
  };
  // les cartes qui défendent une île sont bloquées
  const move = moveKey, problem = tradeProblem;
  moveKey = (from, to, key) => (from && islandAvailable(from, key) <= 0 ? false : move(from, to, key));
  tradeProblem = (tr) => {
    const p = problem(tr);
    if (p) return p;
    const busy = (userId, keys) => keys.find((k) => islandAvailable(userId, k) < keys.filter((x) => x === k).length);
    const a = busy(tr.from, tr.give);
    if (a) return `**${keyLabel(a)}** défend l'île de ${tr.fromName} : elle ne peut pas être échangée.`;
    const c = busy(tr.to, tr.take);
    if (c) return `**${keyLabel(c)}** défend l'île de ${tr.toName} : elle ne peut pas être échangée.`;
    return null;
  };
  // succès des îles
  const facts = playerFacts;
  playerFacts = (userId) => ({ ...facts(userId), islands: load().userStats[userId]?.islands ?? 0 });
  ACHIEVEMENTS.push(["ile1", "🏝️", "Conquérant", "Prendre l'île", "islands", 1, 50], ["ile10", "🗺️", "Seigneur de l'île", "Prendre l'île 10 fois", "islands", 10, 300]);
}

// --- Interactions des îles ---
async function handleIslandInteraction(interaction, client) {
  if (interaction.isChatInputCommand?.() && interaction.commandName === "iles") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await islandsPayload());
    return true;
  }
  const id = interaction.customId;
  if (typeof id !== "string" || !id.startsWith("carte_ile")) return false;
  const userId = interaction.user.id, name = interaction.member?.displayName ?? interaction.user.username;
  const me = { id: userId, name, avatar: interaction.user.displayAvatarURL({ extension: "png", size: 128 }) };
  load();
  if (id === "carte_ile") {
    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await islandsPayload());
    return true;
  }
  if (id === "carte_ile_rules") {
    await interaction.reply({ embeds: [ISLAND_RULES()], ephemeral: true });
    return true;
  }
  if (id === "carte_ile_me") {
    await interaction.reply(myIslandPayload(userId));
    return true;
  }
  const go = /^carte_ile_go_(\w+)$/.exec(id);
  if (go && ISLANDS[go[1]]) {
    const isl = islandsState()[go[1]], def = ISLANDS[go[1]];
    if (islandOf(userId) === go[1]) {
      await interaction.reply(myIslandPayload(userId));
      return true;
    }
    const mine = islandOf(userId);
    if (mine) {
      await interaction.reply({ content: `❌ Vous gardez déjà l'**${ISLANDS[mine].name}** : une seule île par membre. Quittez-la depuis **Mon île** pour en prendre une autre.`, ephemeral: true });
      return true;
    }
    if (!ownedKeys(userId).length) {
      await interaction.reply({ content: "❌ Il vous faut au moins une carte.", ephemeral: true });
      return true;
    }
    if (!isl.holder) {
      const row = placeRow(userId, go[1], "Choisir jusqu'à 3 cartes pour défendre l'île…");
      await interaction.reply({
        ephemeral: true,
        embeds: [
          new EmbedBuilder()
            .setColor(parseInt(def.color.slice(1), 16))
            .setTitle(`${def.emoji} Prendre l'${def.name}`)
            .setDescription(`Choisissez **jusqu'à 3 cartes** : une IA les jouera pour défendre l'île. Vous gagnerez **${ISLAND_DUST} ✨ par heure** tant que vous la gardez.\n⭐ Bonus de l'île : les cartes **${SERIES_LABELS[def.series].replace(/^\S+ /, "")}** ont +10 % de PV et d'attaque.\n🔒 Tant qu'elles défendent, ces cartes ne peuvent être ni vendues ni échangées.`),
        ],
        components: row ? [row] : [],
      });
      return true;
    }
    if (islandFights.has(go[1])) {
      await interaction.reply({ content: `⚔️ L'**${def.name}** est déjà attaquée : attendez la fin du combat.`, ephemeral: true });
      return true;
    }
    if (userBattle.has(userId)) {
      await interaction.reply({ content: "❌ Vous êtes déjà en combat.", ephemeral: true });
      return true;
    }
    if (isl.holder && isl.holder !== userId && (isl.protectUntil ?? 0) > Date.now()) {
      await interaction.reply({ content: `🛡️ L'**${def.name}** vient de changer de mains : elle est protégée jusqu'à <t:${Math.floor(isl.protectUntil / 1000)}:t> (<t:${Math.floor(isl.protectUntil / 1000)}:R>).`, ephemeral: true });
      return true;
    }
    if (isl.holder && (isl.revenge?.[userId] ?? 0) > Date.now()) {
      await interaction.reply({ content: `⏳ Vous venez de perdre l'**${def.name}** : vous pourrez tenter de la reprendre <t:${Math.floor(isl.revenge[userId] / 1000)}:R>.`, ephemeral: true });
      return true;
    }
    const wait = (isl.cooldown?.[userId] ?? 0) + ISLAND_COOLDOWN - Date.now();
    if (wait > 0) {
      await interaction.reply({ content: `⏳ Votre dernière attaque a échoué : vous pourrez réattaquer l'**${def.name}** <t:${Math.floor((Date.now() + wait) / 1000)}:R>.`, ephemeral: true });
      return true;
    }
    await interaction.deferReply({ ephemeral: true });
    islandFights.set(go[1], "?");
    const holderUser = await client.users.fetch(isl.holder).catch(() => client.user);
    const b = await startBattle(client, { user: interaction.user, name }, { user: holderUser, name: `${def.emoji} ${def.short} · ${islandOwnerName(isl)}`, isAI: true }, { island: go[1], aiLevel: ISLAND_AI, aiLabel: `Défense de l'${def.name}` });
    if (b) islandFights.set(go[1], b.id);
    else islandFights.delete(go[1]);
    islandsDirty = true;
    await interaction.editReply({ content: b ? `⚔️ Attaque de l'**${def.name}** : ${b.message.url}\nMettez toutes les cartes de **${islandOwnerName(isl)}** K.O. pour prendre l'île !` : "❌ Impossible de lancer le combat." });
    return true;
  }
  const place = /^carte_ile_place_(\w+)$/.exec(id);
  if (place && ISLANDS[place[1]]) {
    const isl = islandsState()[place[1]], def = ISLANDS[place[1]];
    const picks = [...new Set(interaction.values)]
      .map((v) => (v.includes("|") ? v.split("|") : [userId, v]))
      .filter(([owner, k]) => (owner === userId || islandMates(isl.holder).includes(owner)) && (load().inv[owner]?.[k] ?? 0) > 0)
      .slice(0, 3);
    const keys = picks.filter(([owner]) => owner === userId).map(([, k]) => k);
    if (!picks.length) {
      await interaction.update({ content: "❌ Vous ne possédez plus ces cartes.", embeds: [], components: [] });
      return true;
    }
    if (islandOf(userId) === place[1]) {
      if (islandFights.has(place[1])) {
        await interaction.update({ content: "⚔️ Votre île est attaquée : vous changerez la défense après le combat.", embeds: [], components: [] });
        return true;
      }
      // les cartes gardées conservent leurs PV ; les nouvelles arrivent au niveau le plus bas de l'équipe
      settleIsland(isl);
      const low = Math.min(...isl.team.map((d) => d.frac));
      isl.team = picks.map(([owner, key]) => isl.team.find((d) => d.key === key && (d.owner ?? isl.holder) === owner) ?? { key, frac: low, owner });
      save();
      islandsDirty = true;
      await interaction.update(myIslandPayload(userId));
      return true;
    }
    if (isl.holder) {
      await interaction.update({ content: `❌ Trop tard : **${isl.holderName}** vient de prendre l'**${def.name}**. Attaquez-la pour la récupérer !`, embeds: [], components: [] });
      return true;
    }
    if (islandOf(userId)) {
      await interaction.update({ content: "❌ Vous gardez déjà une île.", embeds: [], components: [] });
      return true;
    }
    setHolder(place[1], me, keys);
    ustat(userId, "islands");
    save();
    checkAchievements(userId).catch(() => null);
    await interaction.update({ content: `${def.emoji} Vous gardez maintenant l'**${def.name}** ! Elle vous rapporte **${ISLAND_DUST} ✨ par heure**.`, embeds: [], components: [] });
    await islandNotice(`${def.emoji} <@${userId}> s'installe sur l'**${def.name}**, restée libre. Qui osera l'attaquer ?`, [userId]);
    return true;
  }
  if (id === "carte_ile_heal") {
    const mine = islandOf(userId);
    if (!mine) {
      await interaction.update(myIslandPayload(userId));
      return true;
    }
    if (islandFights.has(mine)) {
      await interaction.reply({ content: "⚔️ Impossible de soigner pendant une attaque.", ephemeral: true });
      return true;
    }
    if ((load().dust[userId] ?? 0) < ISLAND_HEAL_COST) {
      await interaction.reply({ content: `❌ Il vous faut ${ISLAND_HEAL_COST} ✨ (vous en avez ${load().dust[userId] ?? 0}).`, ephemeral: true });
      return true;
    }
    const isl = islandsState()[mine];
    load().dust[userId] -= ISLAND_HEAL_COST;
    for (const d of isl.team) d.frac = 1;
    isl.hpAt = Date.now();
    save();
    islandsDirty = true;
    await interaction.update(myIslandPayload(userId));
    return true;
  }
  if (id === "carte_ile_quit") {
    const mine = islandOf(userId);
    await interaction.update(
      mine
        ? {
            content: `🚪 Quitter l'**${ISLANDS[mine].name}** ? Vos cartes redeviendront libres et l'île sera à prendre.`,
            embeds: [],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("carte_ile_quit_ok").setLabel("Oui, quitter l'île").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId("carte_ile_me").setLabel("Non").setStyle(ButtonStyle.Secondary))],
          }
        : myIslandPayload(userId)
    );
    return true;
  }
  if (id === "carte_ile_quit_ok") {
    const mine = islandOf(userId);
    if (mine && islandFights.has(mine)) {
      await interaction.update({ content: "⚔️ Votre île est attaquée : vous pourrez la quitter après le combat.", embeds: [], components: [] });
      return true;
    }
    if (mine) {
      const earned = islandsState()[mine].earned + payIsland(islandsState()[mine]);
      releaseIsland(mine);
      save();
      await interaction.update({ content: `🚪 Vous avez quitté l'**${ISLANDS[mine].name}** (${earned} ✨ gagnés). Vos cartes sont de nouveau libres.`, embeds: [], components: [] });
      await islandNotice(`${ISLANDS[mine].emoji} L'**${ISLANDS[mine].name}** est de nouveau **libre** !`);
    } else await interaction.update(myIslandPayload(userId));
    return true;
  }
  return false;
}

// --- Équilibre des combats d'île : l'IA s'ajuste à la force des cartes qui défendent ---
// Plus la défense est rare, mieux l'IA joue ; si la défense est plus rare que l'attaquant, elle frappe et encaisse mieux.
// Ainsi une défense de cartes bleues reste prenable par des épiques, mais trois légendaires leur résistent.
const islandRank = (team) => (team.length ? team.reduce((a, f) => a + ORDER.indexOf(f.card.rarity), 0) / team.length : 0);
function islandBalance(b) {
  const def = islandRank(b.players[1].team), att = islandRank(b.players[0].team), gap = def - att;
  b.aiLevel = { ...ISLAND_AI, smart: Math.min(0.95, 0.6 + 0.07 * def) };
  // avantage du terrain (+10 %), et +15 % par niveau de rareté d'écart (40 % au plus)
  {
    const k = 1 + Math.min(0.4, 0.1 + Math.max(0, gap) * 0.15);
    for (const f of b.players[1].team) {
      const frac = f.maxHp ? f.hp / f.maxHp : 1;
      f.maxHp = Math.round(f.maxHp * k);
      f.hp = f.hp > 0 ? Math.max(1, Math.round(f.maxHp * frac)) : 0;
      f.attackDmg = Math.round(f.attackDmg * k);
      f.specialDmg = Math.round(f.specialDmg * k);
    }
  }
  b.islandGap = gap;
}
{
  const begin = beginRounds;
  beginRounds = async (client, b) => {
    if (b.island) islandBalance(b);
    return begin(client, b);
  };
}
