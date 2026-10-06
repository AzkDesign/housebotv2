
// --- Les Duos : une carte par équipe de deux (façon TAG TEAM) ---
// Chaque équipe complète a sa carte DUO : les deux membres sur la même carte, le blason de l'équipe,
// une attaque et une animation propres à son emblème. L'équipe « Fondation » est mythique, les autres légendaires.
// On l'obtient dans les boosters, et chaque membre reçoit la sienne quand l'équipe atteint le niveau 6.
const DUO_GRANT_LEVEL = 6;
const DUO_EMBLEM = {
  "🐉": { element: "feu", attack: "Souffle jumeau", duo: "Couronne de flammes", fx: "dragon" },
  "🦁": { element: "chance", attack: "Rugissement", duo: "Crinière royale", fx: "lion" },
  "🐺": { element: "glace", attack: "Meute", duo: "Hurlement lunaire", fx: "loup" },
  "🦅": { element: "air", attack: "Piqué", duo: "Œil du ciel", fx: "aigle" },
  "🦊": { element: "feu", attack: "Ruse du renard", duo: "Danse des feux follets", fx: "renard" },
  "🐙": { element: "eau", attack: "Jet d'encre", duo: "Étreinte des abysses", fx: "pieuvre" },
  "🔥": { element: "feu", attack: "Brasier", duo: "Incendie partagé", fx: "flamme" },
  "⚡": { element: "foudre", attack: "Décharge", duo: "Tempête jumelle", fx: "eclair" },
  "🌙": { element: "ombre", attack: "Clair de lune", duo: "Éclipse", fx: "lune" },
  "💎": { element: "glace", attack: "Éclat", duo: "Prisme éternel", fx: "diamant" },
  "👑": { element: "chance", attack: "Décret", duo: "Règne partagé", fx: "couronne" },
  "🛡️": { element: "pierre", attack: "Rempart", duo: "Forteresse", fx: "bouclier" },
};
const duoInfo = (emblem) => DUO_EMBLEM[emblem] ?? DUO_EMBLEM["🛡️"];
const isFondation = (name) => /fondation/i.test(String(name ?? ""));

// la carte d'une équipe, construite à partir de l'équipe (ou de sa dernière version connue si elle a été dissoute)
function duoCardOf(snap) {
  const card = { ...C(`duo_${snap.teamId}`, `${snap.names[0]} & ${snap.names[1]}`, snap.emblem, isFondation(snap.teamName) ? "mythique" : "legendaire", `Le duo de l'équipe ${snap.teamName}.`), gen: 1 };
  card.duo = snap;
  return card;
}
function duoSnapshot(team) {
  const arch = load().memberArchive ?? {};
  return {
    teamId: team.id,
    teamName: team.name,
    emblem: team.emblem,
    level: teamLevel(team),
    members: [...team.members],
    names: team.members.map((id) => {
      const p = pseudo(id);
      return plainLetters(p && p !== "un membre" ? p : arch[id]?.name ?? p);
    }),
    avatars: team.members.map((id) => arch[id]?.avatar ?? null),
  };
}
// équipes complètes (deux membres) : leur carte est à jour ; les autres gardent la dernière version connue
// recalculé au plus toutes les 5 secondes (allCards est appelé très souvent)
let duoCache = { at: 0, all: [], active: [] };
function duoCards(activeOnly = false) {
  if (Date.now() - duoCache.at < 5000) return activeOnly ? duoCache.active : duoCache.all;
  const st = load();
  st.duoArchive ??= {};
  const live = Object.values(st.teams ?? {}).filter((t) => t.members?.length === 2);
  for (const t of live) st.duoArchive[t.id] = duoSnapshot(t);
  const ids = new Set(live.map((t) => t.id));
  const all = Object.values(st.duoArchive).map(duoCardOf);
  duoCache = { at: Date.now(), all, active: all.filter((c) => ids.has(c.duo.teamId)) };
  return activeOnly ? duoCache.active : duoCache.all;
}
{
  const all = allCards, pool = boosterPool, series = seriesOf, kind = kindOf, element = elementOf, how = howToGet, profile = combatProfile, icon = seriesIcon, creature = drawCreatureCard, theme = themeOf;
  allCards = () => [...all(), ...duoCards()];
  boosterPool = () => [...pool(), ...duoCards(true)];
  seriesOf = (card) => (card.id.startsWith("duo_") ? "duos" : series(card));
  kindOf = (card) => (card.duo ? `Duo · Équipe ${card.duo.teamName}` : kind(card));
  elementOf = (card) => (card.duo ? duoInfo(card.duo.emblem).element : element(card));
  howToGet = (card) => (card.duo ? ["🤝", `Boosters · ou atteindre le niveau ${DUO_GRANT_LEVEL} avec l'équipe ${card.duo.teamName}`, "#fbbf24"] : how(card));
  // deux membres sur une carte : un peu plus de PV, et le coup de duo de l'emblème
  combatProfile = (card, holo = false) => {
    const cp = profile(card, holo);
    if (!card.duo) return cp;
    const d = duoInfo(card.duo.emblem);
    return { ...cp, hp: Math.round(cp.hp * 1.15), special: Math.round(cp.special * 1.12), attackName: d.attack, specialName: d.duo };
  };
  seriesIcon = (ctx, s, x, y, size, color) => {
    if (s !== "duos") return icon(ctx, s, x, y, size, color);
    ctx.fillStyle = color;
    for (const [dx, k] of [[-0.42, 0.85], [0.38, 1]]) {
      ctx.beginPath();
      ctx.arc(x + dx * size, y - size * 0.42, size * 0.36 * k, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + dx * size, y + size * 0.7, size * 0.62 * k, size * 0.5 * k, 0, Math.PI, TAU);
      ctx.fill();
    }
  };
  themeOf = (card) => (card.duo ? { scene: "cosmos", fx: "etoiles", anim: card.rarity === "mythique" ? "ascension" : "popout" } : theme(card));
  drawCreatureCard = (card, holo = false, t = 0.37) => (card.duo ? drawDuoCard(card, holo, t) : creature(card, holo, t));
  SERIES_LABELS.duos = "🤝 Les Duos";
  SPECIAL_NAMES.duos = "Coup de duo";
  // combats : une seule carte DUO par équipe de 3
  const pick = setTeam;
  setTeam = (client, b, i, keys) => {
    let seen = false;
    return pick(client, b, i, keys.filter((k) => !k.startsWith("duo_") || (!seen && (seen = true))));
  };
  bestTeam = (userId) => {
    const seen = new Set();
    let duo = false;
    return ownedKeys(userId)
      .map(([k]) => k)
      .sort((a, c) => fighterPower(c) - fighterPower(a))
      .filter((k) => {
        const id = k.replace("*", "");
        if (seen.has(id)) return false;
        if (id.startsWith("duo_")) {
          if (duo) return false;
          duo = true;
        }
        seen.add(id);
        return true;
      })
      .slice(0, 3);
  };
}

// --- Obtention : chaque membre reçoit la carte de son duo au niveau DUO_GRANT_LEVEL de l'équipe ---
async function duoGrantTick(client) {
  const st = load();
  st.duoGranted ??= {};
  for (const team of Object.values(st.teams ?? {})) {
    if (team.members?.length !== 2 || teamLevel(team) < DUO_GRANT_LEVEL || st.duoGranted[team.id]) continue;
    st.duoGranted[team.id] = Date.now();
    const card = duoCardOf(duoSnapshot(team));
    for (const id of team.members) {
      give(id, card, false);
      client?.users
        .fetch(id)
        .then((u) => u.send(`🤝 **Votre carte DUO est arrivée !** L'équipe **${team.name}** a atteint le niveau ${DUO_GRANT_LEVEL} : vous recevez **${card.name}** (${RARITIES[card.rarity].name}) dans votre collection. Elle se joue dans l'Arène avec son coup de duo : **${duoInfo(team.emblem).duo}**.`))
        .catch(() => null);
    }
    save();
  }
}

// --- Animations : une par emblème (t de 0 à 1, en boucle) ---
const loopP = (seed, t, speed = 1) => (seed + t * speed) % 1;
function fxFlameTongue(ctx, x, y, h, w, t, k, colors) {
  const sway = Math.sin(TAU * (t * 2 + k)) * w * 0.35;
  const g = ctx.createLinearGradient(0, y, 0, y - h);
  g.addColorStop(0, colors[0]);
  g.addColorStop(0.6, colors[1]);
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w * 0.6 + sway, y - h * 0.5, x + sway * 1.4, y - h);
  ctx.quadraticCurveTo(x + w * 0.6 + sway, y - h * 0.5, x + w / 2, y);
  ctx.closePath();
  ctx.fill();
}
function fxBolt(ctx, x0, y0, x1, y1, R, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  const n = 7;
  for (let i = 1; i < n; i++) ctx.lineTo(x0 + ((x1 - x0) * i) / n + (R() - 0.5) * 40, y0 + ((y1 - y0) * i) / n + (R() - 0.5) * 18);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}
// effets derrière les membres (back) ou devant (front)
function duoFx(ctx, kind, box, t, pal, layer) {
  const R = seeded(hashOf(kind) + (layer === "front" ? 7 : 0)), { x, y, w, h } = box, cx = x + w * 0.55, cy = y + h * 0.48;
  ctx.save();
  if (kind === "dragon") {
    if (layer === "back") {
      glow(ctx, cx, y + h * 0.8, w * 0.75, "#f97316", 0.55 + 0.15 * Math.sin(TAU * t * 2));
      for (let i = 0; i < 9; i++) fxFlameTongue(ctx, x + (i + 0.5) * (w / 9), y + h * 0.86, 150 + R() * 140 + 40 * Math.sin(TAU * (t * 2 + i / 9)), 80, t, i / 9, ["rgba(249,115,22,0.85)", "rgba(254,215,170,0.45)"]);
    } else
      for (let i = 0; i < 26; i++) {
        const p = loopP(R(), t, 1 + R()), ex = x + R() * w + Math.sin(TAU * (p + R())) * 14, ey = y + h - p * h;
        disc(ctx, ex, ey, 1.5 + R() * 2.5, `rgba(253,${150 + Math.round(R() * 80)},60,${1 - p})`);
      }
  } else if (kind === "lion") {
    if (layer === "back") {
      ctx.translate(cx, cy);
      ctx.rotate(TAU * t * 0.25);
      for (let i = 0; i < 24; i++) {
        ctx.rotate(TAU / 24);
        ctx.fillStyle = `rgba(253,230,138,${i % 2 ? 0.07 : 0.16})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-30, -700);
        ctx.lineTo(30, -700);
        ctx.closePath();
        ctx.fill();
      }
    } else
      for (let k = 0; k < 3; k++) {
        const p = loopP(k / 3, t, 1);
        ctx.strokeStyle = `rgba(254,243,199,${0.7 * (1 - p)})`;
        ctx.lineWidth = 6 * (1 - p) + 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 60 + p * 260, (60 + p * 260) * 0.85, 0, 0, TAU);
        ctx.stroke();
      }
  } else if (kind === "loup") {
    if (layer === "back") {
      glow(ctx, x + w * 0.8, y + h * 0.18, 150, "#e0e7ff", 0.7);
      disc(ctx, x + w * 0.8, y + h * 0.18, 46, "#f1f5f9");
      disc(ctx, x + w * 0.8 + 10, y + h * 0.18 - 8, 9, "rgba(148,163,184,0.45)");
      disc(ctx, x + w * 0.8 - 14, y + h * 0.18 + 12, 6, "rgba(148,163,184,0.4)");
      for (let k = 0; k < 2; k++) {
        const off = (loopP(k * 0.5, t, 1) - 0.5) * w;
        const g = ctx.createLinearGradient(0, y + h * 0.7, 0, y + h);
        g.addColorStop(0, "rgba(226,232,240,0)");
        g.addColorStop(1, "rgba(226,232,240,0.35)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x + w / 2 + off, y + h * 0.9, w * 0.7, 70, 0, 0, TAU);
        ctx.fill();
      }
    } else
      for (let i = 0; i < 40; i++) {
        const p = loopP(R(), t, 1), sx = x + R() * w + Math.sin(TAU * (p * 2 + R())) * 18;
        disc(ctx, sx, y + p * h, 1 + R() * 2.2, `rgba(255,255,255,${0.5 + R() * 0.5})`);
      }
  } else if (kind === "aigle") {
    if (layer === "back") {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineCap = "round";
      for (let i = 0; i < 14; i++) {
        const p = loopP(R(), t, 2), sy = y + R() * h, len = 60 + R() * 120;
        ctx.lineWidth = 1 + R() * 2.5;
        ctx.beginPath();
        ctx.moveTo(x + w * (1.2 - p * 1.6), sy);
        ctx.lineTo(x + w * (1.2 - p * 1.6) + len, sy - len * 0.12);
        ctx.stroke();
      }
    } else
      for (let i = 0; i < 9; i++) {
        const p = loopP(R(), t, 1), fx = x + R() * w + Math.sin(TAU * (p * 1.5 + R())) * 30, fy = y + p * h;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(Math.sin(TAU * (p + R())) * 0.9);
        ctx.fillStyle = `rgba(254,243,199,${0.85 * (1 - Math.abs(p - 0.5))})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 13, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(120,53,15,0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -13);
        ctx.lineTo(0, 13);
        ctx.stroke();
        ctx.restore();
      }
  } else if (kind === "renard") {
    // feux follets bleus qui tournent autour du duo (derrière en haut de l'orbite, devant en bas)
    for (let i = 0; i < 6; i++) {
      const ang = TAU * (t + i / 6), px = cx + Math.cos(ang) * w * 0.4, py = cy + Math.sin(ang) * h * 0.22;
      if ((layer === "back") !== Math.sin(ang) < 0) continue;
      glow(ctx, px, py, 44, "#38bdf8", 0.55);
      fxFlameTongue(ctx, px, py + 14, 46, 26, t, i / 6, ["rgba(186,230,253,0.95)", "rgba(56,189,248,0.6)"]);
      disc(ctx, px, py + 4, 6, "#f0f9ff");
    }
  } else if (kind === "pieuvre") {
    if (layer === "back") {
      ctx.strokeStyle = "rgba(30,10,40,0.35)";
      ctx.lineCap = "round";
      for (let k = 0; k < 5; k++) {
        ctx.lineWidth = 18 - k * 2;
        ctx.beginPath();
        for (let s = 0; s <= 40; s++) {
          const u = s / 40, px = x + u * w, py = y + h * (0.55 + k * 0.08) + Math.sin(TAU * (u * 1.5 + t + k * 0.2)) * 30;
          s ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    } else
      for (let i = 0; i < 24; i++) {
        const p = loopP(R(), t, 1), bx = x + R() * w + Math.sin(TAU * (p * 3 + R())) * 8, by = y + h - p * h, r = 2 + R() * 7;
        ctx.strokeStyle = `rgba(224,242,254,${0.8 * (1 - p)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, TAU);
        ctx.stroke();
        disc(ctx, bx - r * 0.35, by - r * 0.35, r * 0.25, `rgba(255,255,255,${0.9 * (1 - p)})`);
      }
  } else if (kind === "flamme") {
    if (layer === "back") {
      glow(ctx, cx, cy, w * 0.6, "#f43f5e", 0.4 + 0.15 * Math.sin(TAU * t * 2));
      for (let i = 0; i < 7; i++) fxFlameTongue(ctx, x + (i + 0.5) * (w / 7), y + h * 0.88, 220 + R() * 140, 110, t, i / 7, ["rgba(244,63,94,0.7)", "rgba(253,186,116,0.4)"]);
    } else
      for (let i = 0; i < 30; i++) {
        const p = loopP(R(), t, 1.5), a = R() * TAU, r = p * w * 0.6;
        disc(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.7 - p * 60, 2 * (1 - p) + 0.8, `rgba(254,240,138,${1 - p})`);
      }
  } else if (kind === "eclair") {
    const flash = Math.floor(t * 8) % 3 === 0;
    if (layer === "back") {
      if (flash) {
        ctx.fillStyle = "rgba(254,249,195,0.22)";
        ctx.fillRect(x, y, w, h);
      }
      const B = seeded(Math.floor(t * 8) + 3);
      for (let k = 0; k < 2; k++) {
        const bx = x + B() * w;
        ctx.shadowColor = "#fde047";
        ctx.shadowBlur = 18;
        fxBolt(ctx, bx, y, bx + (B() - 0.5) * 120, y + h * (0.5 + B() * 0.4), B, 4, "rgba(254,249,195,0.95)");
      }
    } else {
      const B = seeded(Math.floor(t * 16) + 9);
      ctx.shadowColor = "#facc15";
      ctx.shadowBlur = 10;
      for (let k = 0; k < 3; k++) {
        const a = B() * TAU, r0 = 100, r1 = 150;
        fxBolt(ctx, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.8, cx + Math.cos(a + 0.4) * r1, cy + Math.sin(a + 0.4) * r1 * 0.8, B, 2, "rgba(255,255,255,0.9)");
      }
    }
  } else if (kind === "lune") {
    if (layer === "back") {
      const mx = x + w * 0.2, my = y + h * 0.2;
      glow(ctx, mx, my, 130, "#c7d2fe", 0.6);
      disc(ctx, mx, my, 44, "#eef2ff");
      disc(ctx, mx + 18, my - 10, 40, pal[2]);
      for (let i = 0; i < 40; i++) {
        const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
        sparkle(ctx, x + R() * w, y + R() * h * 0.8, 0.6 + tw * 3, `rgba(255,255,255,${0.25 + tw * 0.75})`);
      }
    } else {
      const p = loopP(0.2, t, 1);
      if (p < 0.4) {
        const q = p / 0.4, sx = x + w * (0.9 - q * 0.8), sy = y + h * (0.08 + q * 0.3);
        const g = ctx.createLinearGradient(sx, sy, sx + 120, sy - 45);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 120, sy - 45);
        ctx.stroke();
      }
    }
  } else if (kind === "diamant") {
    if (layer === "back") {
      ctx.globalCompositeOperation = "screen";
      for (let i = 0; i < 16; i++) {
        const fx = x + R() * w, fy = y + R() * h, s = 30 + R() * 60, hue = Math.round((t * 360 + R() * 360) % 360);
        ctx.fillStyle = `hsla(${hue},90%,70%,${0.12 + 0.12 * Math.sin(TAU * (t + R()))})`;
        ctx.beginPath();
        ctx.moveTo(fx, fy - s);
        ctx.lineTo(fx + s * 0.6, fy);
        ctx.lineTo(fx, fy + s);
        ctx.lineTo(fx - s * 0.6, fy);
        ctx.closePath();
        ctx.fill();
      }
    } else
      for (let i = 0; i < 18; i++) {
        const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
        sparkle(ctx, x + R() * w, y + R() * h, 1 + tw * 5, `hsla(${Math.round(R() * 360)},100%,85%,${tw})`);
      }
  } else if (kind === "couronne") {
    if (layer === "back") {
      ctx.translate(cx, y - 40);
      for (let i = -6; i <= 6; i++) {
        ctx.fillStyle = `rgba(253,230,138,${0.08 + 0.05 * Math.sin(TAU * (t + i / 12))})`;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(i * 60 - 20, h + 80);
        ctx.lineTo(i * 60 + 20, h + 80);
        ctx.closePath();
        ctx.fill();
      }
    } else
      for (let i = 0; i < 34; i++) {
        const p = loopP(R(), t, 1), fx = x + R() * w + Math.sin(TAU * (p * 2 + R())) * 16, fy = y + p * h, s = 3 + R() * 4;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(TAU * (p * 2 + R()));
        ctx.fillStyle = ["#fde68a", "#fbbf24", "#ffffff", "#f59e0b"][i % 4];
        ctx.fillRect(-s / 2, -s / 4, s, s / 2 + Math.abs(Math.sin(TAU * p * 3)) * s * 0.6);
        ctx.restore();
      }
  } else {
    // bouclier : anneau de runes qui tourne et onde de protection
    if (layer === "back") {
      ctx.translate(cx, cy);
      ctx.rotate(TAU * t * 0.25);
      ctx.strokeStyle = rgba(pal[0], 0.55);
      ctx.lineWidth = 3;
      for (const r of [190, 214]) {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(pal[0], 0.8);
      ctx.font = "18px CardKanji";
      ctx.textAlign = "center";
      const runes = "盾守護城壁鋼盾守護城壁鋼";
      for (let i = 0; i < runes.length; i++) {
        ctx.save();
        ctx.rotate((TAU * i) / runes.length);
        ctx.fillText(runes[i], 0, -196);
        ctx.restore();
      }
    } else {
      const p = loopP(0, t, 1);
      ctx.strokeStyle = `rgba(191,219,254,${0.75 * (1 - p)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + Math.PI / 6, r = 120 + p * 140;
        k ? ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

// --- Dessin de la carte DUO ---
const duoPortraitCache = new Map();
async function duoPortrait(url, name, color) {
  const key = `${url}|${name}`;
  if (duoPortraitCache.has(key)) return duoPortraitCache.get(key);
  const img = url ? await fetchImage(`avatar:${url}`, url).catch(() => null) : null;
  const S = 320, c = createCanvas(S, S), x = c.getContext("2d");
  x.beginPath();
  x.arc(S / 2, S / 2, S / 2, 0, TAU);
  x.clip();
  if (img) x.drawImage(img, 0, 0, S, S);
  else {
    const g = x.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, shade(color, 1.3));
    g.addColorStop(1, shade(color, 0.55));
    x.fillStyle = g;
    x.fillRect(0, 0, S, S);
    x.fillStyle = "rgba(255,255,255,0.92)";
    x.textAlign = "center";
    x.font = "170px CardTitle";
    x.fillText(name.slice(0, 1).toUpperCase(), S / 2, S / 2 + 60);
  }
  duoPortraitCache.set(key, c);
  if (duoPortraitCache.size > 60) duoPortraitCache.delete(duoPortraitCache.keys().next().value);
  return c;
}
async function drawDuoCard(card, holo = false, t = 0.37) {
  const W = 600, H = 840, d = card.duo, info = duoInfo(d.emblem), crest = CREST[d.emblem] ?? CREST["🛡️"], pal = crest.pal;
  const myth = card.rarity === "mythique", el = ELEMENTS[info.element] ?? ELEMENTS.lumiere;
  const cp = combatProfile(card, holo), level = d.level;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  // 1. bordure : aux couleurs de l'équipe (dorée et prismatique pour un duo mythique)
  roundRect(ctx, 0, 0, W, H, 28);
  if (myth) ctx.fillStyle = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.25);
  else {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, shade(pal[1], 1.25));
    g.addColorStop(0.5, pal[1]);
    g.addColorStop(1, shade(pal[1], 0.6));
    ctx.fillStyle = g;
  }
  ctx.fill();
  if (myth) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, 0.5);
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 1, 1, W - 2, H - 2, 27);
  ctx.stroke();
  // 2. illustration pleine page
  const inner = { x: 16, y: 16, w: W - 32, h: H - 32 }, art = { x: 16, y: 16, w: W - 32, h: 470 };
  ctx.save();
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
  ctx.clip();
  const bg = ctx.createRadialGradient(W * 0.55, 300, 20, W * 0.55, 300, 620);
  bg.addColorStop(0, pal[0]);
  bg.addColorStop(0.35, pal[1]);
  bg.addColorStop(1, pal[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.26;
  ctx.drawImage(await drawTeamCrest(d.emblem), W - 360, 70, 400, 400);
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffff";
  ctx.font = "330px CardKanji";
  ctx.textAlign = "center";
  ctx.fillText(crest.kanji, 170, 430);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  duoFx(ctx, info.fx, art, t, pal, "back");
  // les deux membres : l'un derrière, l'autre devant
  const [pa, pb] = await Promise.all([duoPortrait(d.avatars[0], d.names[0], pal[1]), duoPortrait(d.avatars[1], d.names[1], shade(pal[1], 0.7))]);
  const bob = Math.sin(TAU * t) * 5;
  glow(ctx, 190, 330, 200, el.colors[2], 0.4);
  glow(ctx, 390, 300, 240, pal[0], 0.5);
  drawSticker(ctx, pa, 185, 345 - bob, 210, [pal[0], pal[1], pal[2]]);
  drawSticker(ctx, pb, 385, 300 + bob, 270, [pal[0], pal[1], pal[2]]);
  duoFx(ctx, info.fx, art, t, pal, "front");
  if (holo || myth) {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    rainbow(ctx, W, H, t, holo ? 0.35 : 0.22);
    ctx.restore();
  }
  // reflet qui balaie l'illustration
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const sx = -W + t * 3 * W, sg = ctx.createLinearGradient(sx, 0, sx + W * 0.5, H * 0.5);
  sg.addColorStop(0, "rgba(255,255,255,0)");
  sg.addColorStop(0.5, "rgba(255,255,255,0.35)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(art.x, art.y, art.w, art.h);
  ctx.restore();
  const gp = ctx.createLinearGradient(0, 430, 0, H);
  gp.addColorStop(0, "rgba(8,5,18,0)");
  gp.addColorStop(0.12, "rgba(8,5,18,0.8)");
  gp.addColorStop(1, "rgba(8,5,18,0.95)");
  ctx.fillStyle = gp;
  ctx.fillRect(0, 430, W, H - 430);
  const gt = ctx.createLinearGradient(0, 16, 0, 150);
  gt.addColorStop(0, "rgba(8,5,18,0.8)");
  gt.addColorStop(1, "rgba(8,5,18,0)");
  ctx.fillStyle = gt;
  ctx.fillRect(0, 0, W, 150);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = myth ? "#fff7d6" : "rgba(255,255,255,0.7)";
  roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 18);
  ctx.stroke();

  // 3. en-tête : bandeau ÉQUIPE, noms, logo DUO, PV
  ctx.save();
  ctx.translate(30, 24);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(150, 0);
  ctx.lineTo(136, 26);
  ctx.lineTo(0, 26);
  ctx.closePath();
  ctx.fillStyle = myth ? "#fbbf24" : "#facc15";
  ctx.fill();
  ctx.font = "15px CardEngrave";
  ctx.fillStyle = "#1c1917";
  spaced(ctx, "ÉQUIPE", 68, 19, 3);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.font = `${fitText(ctx, d.teamName, 210, 13, "CardBold")}px CardBold`;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(d.teamName, 190, 43);
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 8;
  ctx.font = `${fitText(ctx, card.name, 290, 36, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(card.name, 34, 88);
  const nameW = ctx.measureText(card.name).width;
  ctx.restore();
  ctx.save();
  ctx.translate(34 + nameW + 12, 64);
  ctx.transform(1, 0, -0.18, 1, 0, 0);
  const lg = ctx.createLinearGradient(0, -6, 0, 30);
  lg.addColorStop(0, "#ffffff");
  lg.addColorStop(0.5, myth ? "#fde68a" : pal[0]);
  lg.addColorStop(1, myth ? "#d97706" : pal[1]);
  ctx.font = "34px CardTitle";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#111827";
  ctx.strokeText("DUO", 0, 26);
  ctx.fillStyle = lg;
  ctx.fillText("DUO", 0, 26);
  ctx.restore();
  ctx.textAlign = "right";
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 6;
  ctx.font = "40px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(String(cp.hp), 528, 90);
  const hpW = ctx.measureText(String(cp.hp)).width;
  ctx.font = "15px CardBold";
  ctx.fillText("PV", 528 - hpW - 6, 88);
  ctx.restore();
  ctx.textAlign = "left";
  energyOrb(ctx, info.element, 556, 74, 19);

  // 4. attaque de base (mêmes valeurs que dans l'Arène)
  let y = 522;
  ctx.font = `${fitText(ctx, cp.attackName, 360, 27, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(cp.attackName, 46, y);
  ctx.textAlign = "right";
  ctx.font = "32px CardTitle";
  ctx.fillText(String(cp.attack), W - 44, y + 2);
  ctx.textAlign = "left";
  ctx.font = "13.5px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillText("Attaque de base · aucune énergie · peut être esquivée", 46, y + 22);

  // 5. coup de duo, dans un bandeau brillant (façon attaque GX)
  y = 598;
  ctx.save();
  roundRect(ctx, 30, y - 30, W - 60, 40, 10);
  const band = ctx.createLinearGradient(30, 0, W - 30, 0);
  band.addColorStop(0, myth ? "#92400e" : pal[2]);
  band.addColorStop(0.5 + 0.3 * Math.sin(TAU * t), myth ? "#f59e0b" : pal[1]);
  band.addColorStop(1, myth ? "#92400e" : pal[2]);
  ctx.fillStyle = band;
  ctx.shadowColor = rgba(pal[1], 0.8);
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  roundRect(ctx, 30, y - 30, W - 60, 40, 10);
  ctx.stroke();
  for (let k = 0; k < SPECIAL_COST; k++) energyOrb(ctx, info.element, 56 + k * 22, y - 10, 10);
  ctx.save();
  const dx = 56 + SPECIAL_COST * 22;
  ctx.font = `${fitText(ctx, cp.specialName, W - dx - 120, 25, "CardTitle")}px CardTitle`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 4;
  ctx.fillText(cp.specialName, dx, y - 2);
  ctx.textAlign = "right";
  ctx.font = "30px CardTitle";
  ctx.fillText(String(cp.special), W - 44, y);
  ctx.restore();
  ctx.font = "13.5px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillText(`Coup de duo · ${SPECIAL_COST} énergies · impossible à esquiver · brise la garde`, 46, y + 30);

  // 6. faiblesse, résistance, niveau d'équipe
  const by = 672;
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(40, by - 18);
  ctx.lineTo(W - 40, by - 18);
  ctx.stroke();
  [["faiblesse", "—"], ["chance", String(cp.luck)], ["niveau d'équipe", `${level} · ${TEAM_RANKS[level - 1] ?? ""}`]].forEach(([label, value], i) => {
    const x = 50 + i * 165;
    ctx.font = "11px CardText";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(label, x, by);
    ctx.font = "14px CardBold";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(value, x, by + 20);
  });
  roundRect(ctx, 40, by + 36, W - 80, 52, 8);
  ctx.fillStyle = "rgba(250,204,21,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,0.55)";
  ctx.stroke();
  ctx.font = "12.5px CardBold";
  ctx.fillStyle = "#fde68a";
  wrapText(ctx, `Règle DUO : une seule carte DUO par équipe de combat. Carte de l'équipe ${d.teamName}, offerte à ses deux membres au niveau ${DUO_GRANT_LEVEL}.`, 52, by + 56, W - 104, 16, 2);
  // pied de carte
  const footY = H - 26;
  seriesIcon(ctx, "duos", 44, footY - 4, 6, "rgba(255,255,255,0.8)");
  ctx.font = "11px CardBold";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(numberOf(card).replace("#", ""), 56, footY);
  rarityIcon(ctx, card.rarity, W / 2 - 50, footY - 4, 7, "#ffffff");
  ctx.textAlign = "center";
  ctx.font = "11px CardEngrave";
  ctx.fillStyle = myth ? "#fde68a" : "#ffffff";
  ctx.fillText(myth ? "DUO MYTHIQUE" : "DUO LÉGENDAIRE", W / 2 + 14, footY);
  if (holo) sparkle(ctx, W / 2 + 84, footY - 4, 4, `hsl(${Math.round(t * 360)},95%,65%)`);
  ctx.textAlign = "right";
  ctx.font = "11px CardText";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("Illus. La Maison · G1", W - 44, footY);
  ctx.textAlign = "left";
  drawHanko(ctx, 532, 466, 26, crest.kanji);
  // grain du carton et brillance
  ctx.save();
  roundRect(ctx, 0, 0, W, H, 28);
  ctx.clip();
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.1;
  ctx.drawImage(printTexture(), 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "screen";
  glow(ctx, W * (0.22 + 0.06 * Math.sin(TAU * t)), H * 0.1, 420, "#ffffff", 0.1);
  ctx.restore();
  return c;
}
