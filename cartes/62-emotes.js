// --- Emotes, comme dans Clash Royale ---
// Pendant un combat, un bouton « 😄 » ouvre vos 8 emotes favorites : un clic, et l'emote animée s'affiche dans le fil
// du combat (elle disparaît toute seule). 4 emotes offertes, les autres à débloquer avec de la poussière d'étoile,
// et deux exclusives : « Le Roi » (champions du tournoi) et « Rugissement » (dresseurs qui ont capturé Nyxaros).
// /emotes : la collection, les achats et le choix des 8 favorites.
const EMOTE_SIZE = 220, EMOTE_FRAMES = 16, EMOTE_DELAY = 70, EMOTE_COOLDOWN = 6000, EMOTE_DECK = 8, EMOTE_TTL = 30000;
const EMOTES = [
  { id: "rire", name: "Rire", emoji: "😂", face: "Face with tears of joy", anim: "laugh", fx: "joy", caption: "HA HA HA !", color: "#f59e0b", free: true },
  { id: "pleurs", name: "Pleurs", emoji: "😭", face: "Loudly crying face", anim: "sob", fx: "tears", caption: "Ouiiin…", color: "#38bdf8", free: true },
  { id: "colere", name: "Colère", emoji: "😤", face: "Pouting face", anim: "rage", fx: "steam", caption: "GRRR !", color: "#ef4444", free: true },
  { id: "pouce", name: "Bien joué", emoji: "👍", face: "Thumbs up", anim: "pump", fx: "sparkle", caption: "Bien joué !", color: "#22c55e", free: true },
  { id: "gg", name: "GG", emoji: "🤝", face: "Handshake", anim: "shake", fx: "stars", caption: "GG !", color: "#a78bfa", price: 400 },
  { id: "bravo", name: "Bravo", emoji: "👏", face: "Clapping hands", anim: "clap", fx: "confetti", caption: "Bravo !", color: "#f472b6", price: 600 },
  { id: "reflechit", name: "Hmm…", emoji: "🤔", face: "Thinking face", anim: "tilt", fx: "question", caption: "Hmm…", color: "#60a5fa", price: 500 },
  { id: "choc", name: "Choc", emoji: "🤯", face: "Exploding head", anim: "pop", fx: "boom", caption: "QUOI ?!", color: "#fb923c", price: 800 },
  { id: "cool", name: "Trop facile", emoji: "😎", face: "Smiling face with sunglasses", anim: "slide", fx: "glint", caption: "Trop facile.", color: "#0ea5e9", price: 900 },
  { id: "dodo", name: "Dodo", emoji: "😴", face: "Sleeping face", anim: "breathe", fx: "zzz", caption: "Zzz…", color: "#6366f1", price: 500 },
  { id: "bisou", name: "Bisou", emoji: "😘", face: "Face blowing a kiss", anim: "lean", fx: "hearts", caption: "Mwah !", color: "#ec4899", price: 700 },
  { id: "fete", name: "Fête", emoji: "🥳", face: "Partying face", anim: "bounce", fx: "confetti", caption: "C'est la fête !", color: "#eab308", price: 900 },
  { id: "muscle", name: "Costaud", emoji: "💪", face: "Flexed biceps", anim: "flex", fx: "motion", caption: "Trop fort.", color: "#f97316", price: 700 },
  { id: "oups", name: "Oups", emoji: "😬", face: "Grimacing face", anim: "shiver", fx: "sweat", caption: "Oups…", color: "#14b8a6", price: 500 },
  { id: "clown", name: "Clown", emoji: "🤡", face: "Clown face", anim: "wobble", fx: "stars", caption: "Hihi !", color: "#e11d48", price: 1200 },
  { id: "fondu", name: "Je fonds", emoji: "🫠", face: "Melting face", anim: "melt", fx: "drip", caption: "Je fonds…", color: "#d97706", price: 1000 },
  { id: "salut", name: "Salut", emoji: "🫡", face: "Saluting face", anim: "salute", fx: "sparkle", caption: "À vos ordres !", color: "#475569", price: 600 },
  { id: "couronne", name: "Le Roi", emoji: "👑", face: "Crown", anim: "float", fx: "rays", caption: "Le roi, c'est moi.", color: "#ca8a04", exclusive: "Réservée aux champions du tournoi" },
  { id: "nyxaros", name: "Rugissement", emoji: "🐉", face: "@dragon", anim: "roar", fx: "breath", caption: "ROOOAAAR !", color: "#7e22ce", exclusive: "Réservée aux dresseurs qui ont capturé Nyxaros en raid" },
];
for (const n of ["Thumbs up", "Clapping hands", "Flexed biceps"]) FLUENT_SKIN.add(n);
const emoteOf = (id) => EMOTES.find((e) => e.id === id) ?? null;

// --- Collection ---
function emoteState(userId) {
  const st = load();
  st.emotes ??= {};
  return (st.emotes[userId] ??= { owned: [], deck: EMOTES.filter((e) => e.free).map((e) => e.id) });
}
function emoteUnlocked(userId, e) {
  if (e.free) return true;
  if (e.id === "couronne") return tdTourneyWins(userId) > 0;
  if (e.id === "nyxaros") return (load().inv[userId]?.ev_nyxaros ?? 0) + (load().inv[userId]?.["ev_nyxaros*"] ?? 0) > 0;
  return emoteState(userId).owned.includes(e.id);
}
const ownedEmotes = (userId) => EMOTES.filter((e) => emoteUnlocked(userId, e));
function emoteDeck(userId) {
  const s = emoteState(userId);
  const deck = s.deck.filter((id) => emoteOf(id) && emoteUnlocked(userId, emoteOf(id)));
  for (const e of ownedEmotes(userId)) if (deck.length < 4 && !deck.includes(e.id)) deck.push(e.id);
  return deck.slice(0, EMOTE_DECK);
}

// --- Dessin ---
let emoteDragonP = null;
async function emoteFace(e) {
  if (e.face === "@dragon") {
    // la tête de Nyxaros en gros plan, rendue en 3D une fois pour toutes
    emoteDragonP ??= CLASH3D.renderDragon({ w: 320, h: 320, target: [-1.75, 2.15, 1.65], distance: 5.2, azimuth: 0.05, elevation: 0.12 })
      .then((r) => c3Canvas(r.data, r.width, r.height))
      .catch((err) => {
        emoteDragonP = null;
        throw err;
      });
    return emoteDragonP.catch(() => null);
  }
  return fetchImage(`fluent:${e.face}`, fluentUrl(e.face)).catch(() => null);
}
// petite étoile à 4 branches
function twinkle(ctx, x, y, r, a, col = "#ffffff") {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4, rr = k % 2 ? r * 0.28 : r;
    const px = x + Math.cos(ang) * rr, py = y + Math.sin(ang) * rr;
    k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function heart(ctx, x, y, s, col, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.translate(x, y);
  ctx.scale(s / 20, s / 20);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-14, -4, -8, -16, 0, -8);
  ctx.bezierCurveTo(8, -16, 14, -4, 0, 6);
  ctx.fill();
  ctx.restore();
}
function drop(ctx, x, y, s, col, a) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x + s * 0.8, y + s * 0.2, x, y + s * 0.6);
  ctx.quadraticCurveTo(x - s * 0.8, y + s * 0.2, x, y - s);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.arc(x - s * 0.2, y, s * 0.15, 0, TAU);
  ctx.fill();
  ctx.restore();
}
// les effets autour du visage (q : avancement de la boucle, 0 → 1)
function emoteFx(ctx, e, q, S) {
  const c = S / 2, R = seeded(hashOf(e.id));
  switch (e.fx) {
    case "joy":
      for (let k = 0; k < 8; k++) {
        const side = k % 2 ? 1 : -1, t = (q + k / 8) % 1;
        drop(ctx, c + side * (38 + t * 60), c - 18 - Math.sin(t * Math.PI) * 30 + t * 40, 7, "#7dd3fc", 1 - t);
      }
      break;
    case "tears":
      for (let k = 0; k < 10; k++) {
        const side = k % 2 ? 1 : -1, t = (q * 1.5 + k / 10) % 1;
        drop(ctx, c + side * (30 + (k % 3) * 6), c - 2 + t * 90, 6, "#38bdf8", 1 - t * 0.8);
      }
      break;
    case "steam":
      for (let k = 0; k < 6; k++) {
        const side = k % 2 ? 1 : -1, t = (q + k / 6) % 1;
        ctx.save();
        ctx.globalAlpha = 0.8 * (1 - t);
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.arc(c + side * (52 + t * 30), c - 10 - t * 70, 8 + t * 16, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      break;
    case "sparkle":
      for (let k = 0; k < 6; k++) {
        const a = R() * TAU, d = 70 + R() * 25, tw = Math.max(0, Math.sin(TAU * (q * 2 + k / 6)));
        twinkle(ctx, c + Math.cos(a) * d, c - 10 + Math.sin(a) * d * 0.8, 6 + tw * 8, tw, "#fef9c3");
      }
      break;
    case "stars":
      for (let k = 0; k < 5; k++) {
        const a = TAU * (q + k / 5);
        ctx.save();
        star5(ctx, c + Math.cos(a) * 82, c - 12 + Math.sin(a) * 30 - 50, 7, "#facc15");
        ctx.restore();
      }
      break;
    case "confetti":
      for (let k = 0; k < 22; k++) {
        const x = 15 + R() * (S - 30), sp = 0.6 + R() * 0.8, y = ((R() * S + q * S * sp * 1.4) % (S + 20)) - 10, rot = q * TAU * 2 * sp + k;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = ["#f43f5e", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#f97316"][k % 6];
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
      break;
    case "question":
      for (let k = 0; k < 3; k++) {
        const t = (q + k / 3) % 1;
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI);
        ctx.font = `${22 + k * 6}px CardTitle`;
        ctx.fillStyle = "#e0f2fe";
        ctx.textAlign = "center";
        ctx.fillText("?", c + 50 + k * 18, c - 40 - t * 30 - k * 8);
        ctx.restore();
      }
      break;
    case "boom":
      for (let k = 0; k < 2; k++) {
        const t = (q * 2 + k * 0.5) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        ctx.strokeStyle = k ? "#fde047" : "#fb923c";
        ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.beginPath();
        ctx.arc(c, c - 10, 40 + t * 70, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case "glint": {
      const t = (q * 1.3) % 1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(c - 90 + t * 180, 0, c - 60 + t * 180, S);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
      twinkle(ctx, c + 40, c - 28, 10 + 8 * Math.abs(Math.sin(TAU * q)), 0.95);
      break;
    }
    case "zzz":
      for (let k = 0; k < 3; k++) {
        const t = (q + k / 3) % 1;
        ctx.save();
        ctx.globalAlpha = Math.sin(t * Math.PI);
        ctx.font = `${14 + t * 22}px CardTitle`;
        ctx.fillStyle = "#c7d2fe";
        ctx.textAlign = "center";
        ctx.fillText("Z", c + 40 + t * 40, c - 30 - t * 60);
        ctx.restore();
      }
      break;
    case "hearts":
      for (let k = 0; k < 5; k++) {
        const t = (q + k / 5) % 1;
        heart(ctx, c + 30 + Math.sin((t + k) * 6) * 18 + k * 8, c - t * 90, 12 + t * 10, k % 2 ? "#f43f5e" : "#fb7185", 1 - t);
      }
      break;
    case "motion":
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + q * 0.5, r0 = 78 + 6 * Math.sin(TAU * q * 2), r1 = r0 + 16;
        ctx.globalAlpha = 0.4 + 0.5 * Math.abs(Math.sin(TAU * q * 2));
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r0, c - 10 + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * r1, c - 10 + Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
      break;
    case "sweat": {
      const t = (q * 1.2) % 1;
      drop(ctx, c + 52, c - 40 + t * 40, 10, "#7dd3fc", 1 - t * 0.6);
      break;
    }
    case "drip":
      for (let k = 0; k < 4; k++) {
        const t = (q + k / 4) % 1;
        drop(ctx, c - 30 + k * 20, c + 50 + t * 40, 6, "#fbbf24", 1 - t);
      }
      break;
    case "rays":
      ctx.save();
      ctx.translate(c, c - 10);
      ctx.rotate(q * TAU * 0.25);
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 12; k++) {
        ctx.rotate(TAU / 12);
        ctx.fillStyle = "rgba(253,224,71,0.18)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-10, -S);
        ctx.lineTo(10, -S);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      break;
    case "breath":
      for (let k = 0; k < 10; k++) {
        const t = (q * 1.5 + k / 10) % 1;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.85 * (1 - t);
        const g = ctx.createRadialGradient(c - 40 - t * 70, c + 5 + (k % 3 - 1) * t * 25, 1, c - 40 - t * 70, c + 5 + (k % 3 - 1) * t * 25, 10 + t * 18);
        g.addColorStop(0, "#f5d0fe");
        g.addColorStop(0.5, "#c026d3");
        g.addColorStop(1, "rgba(126,34,206,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
        ctx.restore();
      }
      break;
  }
}
// pose du visage selon l'animation : [dx, dy, angle, échelle x, échelle y]
function emotePose(anim, q) {
  const s = Math.sin(TAU * q), s2 = Math.sin(TAU * q * 2), s4 = Math.sin(TAU * q * 4);
  switch (anim) {
    case "laugh": return [0, -4 * Math.abs(s2), 0.12 * s2, 1 + 0.04 * s4, 1 - 0.04 * s4];
    case "sob": return [0, 3 * Math.abs(s2), 0.04 * s, 1 + 0.03 * s2, 1 - 0.04 * s2];
    case "rage": return [4 * Math.sin(TAU * q * 8), 2 * Math.sin(TAU * q * 6), 0.03 * s4, 1 + 0.05 * Math.abs(s2), 1 + 0.05 * Math.abs(s2)];
    case "pump": return [0, -12 * Math.abs(s2), -0.15 * Math.abs(s2), 1, 1];
    case "shake": return [0, 0, 0.16 * Math.sin(TAU * q * 3), 1, 1];
    case "clap": return [0, 0, 0, 1 - 0.1 * Math.abs(s4), 1 + 0.04 * Math.abs(s4)];
    case "tilt": return [0, 0, 0.14 * s, 1, 1];
    case "pop": {
      const k = q < 0.25 ? 0.5 + 2.6 * q : 1 + 0.06 * Math.sin(TAU * q * 6) * (1 - q);
      return [0, 0, 0, k, k];
    }
    case "slide": {
      const k = q < 0.4 ? 1 - Math.pow(1 - q / 0.4, 3) : 1;
      return [-60 * (1 - k), 0, 0, 1, 1];
    }
    case "breathe": return [0, 2 * s, 0, 1 + 0.04 * s, 1 + 0.04 * s];
    case "lean": return [6 * s, 0, 0.12 * Math.abs(s), 1 + 0.03 * Math.abs(s), 1 + 0.03 * Math.abs(s)];
    case "bounce": return [0, -14 * Math.abs(s2), 0.06 * s, 1 + 0.06 * Math.abs(s2), 1 - 0.05 * Math.abs(s2)];
    case "flex": return [0, 0, -0.08 * Math.abs(s2), 1 + 0.08 * Math.abs(s2), 1 + 0.08 * Math.abs(s2)];
    case "shiver": return [2.5 * Math.sin(TAU * q * 10), 0, 0, 1, 1];
    case "wobble": return [0, 0, 0.2 * s2, 1 + 0.05 * s, 1 - 0.05 * s];
    case "melt": return [0, 6 * Math.abs(s), 0, 1 + 0.06 * Math.abs(s), 1 - 0.08 * Math.abs(s)];
    case "salute": return [0, 0, -0.08 * Math.abs(s2), 1, 1];
    case "float": return [0, 6 * s, 0.05 * s, 1, 1];
    case "roar": return [3 * Math.sin(TAU * q * 8), 0, -0.05 + 0.03 * s4, 1.05 + 0.04 * Math.abs(s2), 1.05 + 0.04 * Math.abs(s2)];
  }
  return [0, 0, 0, 1, 1];
}
async function emoteFrame(e, q, face) {
  const S = EMOTE_SIZE, c = createCanvas(S, S), ctx = c.getContext("2d");
  // tuile : verre sombre teinté, anneau de couleur
  const bg = ctx.createRadialGradient(S / 2, S * 0.42, 10, S / 2, S / 2, S * 0.72);
  bg.addColorStop(0, shade(e.color, 0.9));
  bg.addColorStop(0.55, shade(e.color, 0.35));
  bg.addColorStop(1, "#0b0b14");
  roundRect(ctx, 0, 0, S, S, 40);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = shade(e.color, 1.35);
  roundRect(ctx, 3, 3, S - 6, S - 6, 37);
  ctx.stroke();
  ctx.save();
  roundRect(ctx, 0, 0, S, S, 40);
  ctx.clip();
  if (e.fx === "rays") emoteFx(ctx, e, q, S);
  // le visage animé
  const [dx, dy, ang, sx, sy] = emotePose(e.anim, q);
  if (face) {
    const size = e.face === "@dragon" ? 205 : 140, h = e.face === "@dragon" ? size * (face.height / face.width) : size;
    ctx.save();
    ctx.translate(S / 2 + dx, S / 2 - 12 + dy);
    ctx.rotate(ang);
    ctx.scale(sx, sy);
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
    ctx.drawImage(face, -size / 2, -h / 2, size, h);
    ctx.restore();
  }
  if (e.fx !== "rays") emoteFx(ctx, e, q, S);
  ctx.restore();
  // la bulle de texte, qui surgit au début
  const pop = Math.min(1, q / 0.18), k = pop < 1 ? 0.6 + 0.5 * Math.sin((pop * Math.PI) / 2) * 1.1 : 1;
  ctx.save();
  ctx.translate(S / 2, S - 30);
  ctx.scale(k, k);
  ctx.font = `${fitText(ctx, e.caption, S - 44, 19, "CardBold")}px CardBold`;
  const tw = Math.min(S - 24, ctx.measureText(e.caption).width + 28);
  roundRect(ctx, -tw / 2, -17, tw, 32, 16);
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = shade(e.color, 0.55);
  ctx.textAlign = "center";
  ctx.fillText(e.caption, 0, 6);
  ctx.restore();
  return c;
}
const emoteGifs = new Map();
async function emoteGif(e) {
  if (emoteGifs.has(e.id)) return emoteGifs.get(e.id);
  const face = await emoteFace(e);
  const shots = [];
  for (let f = 0; f < EMOTE_FRAMES; f++) {
    const c = await emoteFrame(e, f / EMOTE_FRAMES, face);
    shots.push({ data: c.getContext("2d").getImageData(0, 0, EMOTE_SIZE, EMOTE_SIZE).data, width: EMOTE_SIZE, height: EMOTE_SIZE, delay: EMOTE_DELAY });
  }
  const buf = encodeFrames(shots);
  emoteGifs.set(e.id, buf);
  return buf;
}

// --- La collection (/emotes) ---
async function drawEmoteCollection(userId) {
  const cols = 5, tile = 170, gap = 18, W = cols * tile + (cols + 1) * gap + 40, rows = Math.ceil(EMOTES.length / cols);
  const H = 170 + rows * (tile + 52) + 30;
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(1, "#0b0b14");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.font = "16px CardEngrave";
  ctx.fillStyle = "#fde68a";
  spaced(ctx, "LES CARTES DE LA MAISON", W / 2, 50, 5);
  ctx.font = "52px CardTitle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("Mes emotes", W / 2, 108);
  const deck = emoteDeck(userId), owned = ownedEmotes(userId).length;
  ctx.font = "16px CardItalic";
  ctx.fillStyle = "#c4b5fd";
  ctx.fillText(`${owned} / ${EMOTES.length} débloquées · les étoiles marquent vos ${EMOTE_DECK} favorites en combat`, W / 2, 138);
  for (const [i, e] of EMOTES.entries()) {
    const x = 20 + gap + (i % cols) * (tile + gap), y = 165 + Math.floor(i / cols) * (tile + 52), has = emoteUnlocked(userId, e);
    const face = await emoteFace(e);
    const fr = await emoteFrame(e, 0.3, face);
    ctx.save();
    if (!has) ctx.globalAlpha = 0.35;
    ctx.drawImage(fr, x, y, tile, tile);
    ctx.restore();
    if (deck.includes(e.id)) {
      ctx.save();
      star5(ctx, x + tile - 18, y + 18, 13, "#facc15");
      ctx.restore();
    }
    ctx.textAlign = "center";
    ctx.font = "16px CardBold";
    ctx.fillStyle = has ? "#ffffff" : "#94a3b8";
    ctx.fillText(e.name, x + tile / 2, y + tile + 22);
    ctx.font = "12px CardText";
    ctx.fillStyle = has ? "#86efac" : e.exclusive ? "#fbbf24" : "#c4b5fd";
    ctx.fillText(has ? "débloquée" : e.exclusive ? "exclusive" : `${e.price.toLocaleString("fr-FR")} poussières`, x + tile / 2, y + tile + 40);
  }
  return c;
}
async function emoteCollectionPayload(userId, note = "") {
  const deck = emoteDeck(userId);
  const img = await (await drawEmoteCollection(userId)).encode("jpeg", 88);
  return {
    content: note || null,
    embeds: [
      new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle("😄 Mes emotes")
        .setDescription(
          `Pendant un combat, le bouton **😄** ouvre vos **${EMOTE_DECK} favorites** : un clic et l'emote s'anime dans le fil du combat.\n\n` +
            `★ **Favorites** : ${deck.map((id) => `${emoteOf(id).emoji} ${emoteOf(id).name}`).join(" · ")}\n` +
            `✨ Poussière d'étoile : **${(load().dust[userId] ?? 0).toLocaleString("fr-FR")}**\n\n` +
            "Choisissez une emote ci-dessous pour la voir en mouvement, l'acheter ou la mettre dans vos favorites."
        )
        .setImage("attachment://emotes.jpg"),
    ],
    files: [new AttachmentBuilder(img, { name: "emotes.jpg" })],
    attachments: [],
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("emote_view")
          .setPlaceholder("Voir une emote…")
          .addOptions(
            EMOTES.map((e) => ({
              label: e.name,
              value: e.id,
              emoji: e.emoji,
              description: (emoteUnlocked(userId, e) ? (deck.includes(e.id) ? "★ Favorite" : "Débloquée") : e.exclusive ?? `${e.price} poussières d'étoile`).slice(0, 100),
            }))
          )
      ),
    ],
  };
}
async function emoteDetailPayload(userId, e, note = "") {
  const has = emoteUnlocked(userId, e), deck = emoteDeck(userId), inDeck = deck.includes(e.id);
  const gif = await emoteGif(e);
  const row = new ActionRowBuilder();
  if (!has && !e.exclusive) row.addComponents(new ButtonBuilder().setCustomId(`emote_buy_${e.id}`).setLabel(`Acheter (${e.price.toLocaleString("fr-FR")} ✨)`).setEmoji("🛒").setStyle(ButtonStyle.Success));
  if (has && !inDeck) row.addComponents(new ButtonBuilder().setCustomId(`emote_add_${e.id}`).setLabel(deck.length >= EMOTE_DECK ? "Mettre en favorite (remplace la dernière)" : "Mettre en favorite").setEmoji("⭐").setStyle(ButtonStyle.Primary));
  if (has && inDeck) row.addComponents(new ButtonBuilder().setCustomId(`emote_del_${e.id}`).setLabel("Retirer des favorites").setStyle(ButtonStyle.Secondary).setDisabled(deck.length <= 1));
  row.addComponents(new ButtonBuilder().setCustomId("emote_home").setLabel("Toutes mes emotes").setEmoji("↩️").setStyle(ButtonStyle.Secondary));
  return {
    content: note || null,
    embeds: [
      new EmbedBuilder()
        .setColor(parseInt(e.color.slice(1), 16))
        .setTitle(`${e.emoji} ${e.name}`)
        .setDescription(
          `« ${e.caption} »\n\n` +
            (has ? (inDeck ? "★ Dans vos favorites : disponible en combat." : "✅ Débloquée.") : e.exclusive ? `🔒 ${e.exclusive}.` : `🔒 À débloquer pour **${e.price.toLocaleString("fr-FR")} ✨** (vous avez ${(load().dust[userId] ?? 0).toLocaleString("fr-FR")} ✨).`)
        )
        .setThumbnail("attachment://emote.gif"),
    ],
    files: [new AttachmentBuilder(gif, { name: "emote.gif" })],
    attachments: [],
    components: [row],
  };
}

// --- En combat ---
const emoteCooldown = new Map(); // `${combat}:${joueur}` -> prochain envoi possible
function emotePicker(b, userId) {
  const deck = emoteDeck(userId), rows = [];
  for (let i = 0; i < deck.length; i += 4)
    rows.push(new ActionRowBuilder().addComponents(...deck.slice(i, i + 4).map((id) => new ButtonBuilder().setCustomId(`emote_send_${b.id}_${id}`).setLabel(emoteOf(id).name).setEmoji(emoteOf(id).emoji).setStyle(ButtonStyle.Secondary))));
  return { content: "😄 **Vos emotes** — un clic pour l'envoyer à votre adversaire. (`/emotes` pour changer vos favorites)", components: rows, ephemeral: true };
}
async function sendEmote(b, who, e) {
  const gif = await emoteGif(e);
  const msg = await b.channel?.send({ content: `${e.emoji} **${who}**`, files: [new AttachmentBuilder(gif, { name: `${e.id}.gif` })], allowedMentions: { parse: [] } }).catch(() => null);
  if (msg) deleteLater(msg, EMOTE_TTL);
}
async function handleEmoteInteraction(interaction) {
  const isCmd = interaction.isChatInputCommand?.() && interaction.commandName === "emotes";
  const id = interaction.customId;
  if (!isCmd && (typeof id !== "string" || !id.startsWith("emote_"))) return false;
  const userId = interaction.user.id;
  const fromPrivate = Boolean(interaction.message?.flags?.has?.(64));
  const show = async (payloadP) => {
    if (fromPrivate) await interaction.deferUpdate();
    else await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await payloadP);
  };
  if (isCmd || id === "emote_home" || id === "emote_shop") {
    await show(emoteCollectionPayload(userId));
    return true;
  }
  if (id === "emote_view") {
    const e = emoteOf(interaction.values[0]);
    if (e) await show(emoteDetailPayload(userId, e));
    return true;
  }
  const act = /^emote_(buy|add|del)_(\w+)$/.exec(id);
  if (act) {
    const e = emoteOf(act[2]);
    if (!e) return true;
    const s = emoteState(userId);
    let note = "";
    if (act[1] === "buy") {
      if (emoteUnlocked(userId, e) || e.exclusive) note = "Cette emote n'est pas à vendre.";
      else if ((load().dust[userId] ?? 0) < e.price) note = `❌ Il vous faut **${e.price.toLocaleString("fr-FR")} ✨** (vous en avez ${(load().dust[userId] ?? 0).toLocaleString("fr-FR")}).`;
      else {
        load().dust[userId] -= e.price;
        s.owned.push(e.id);
        // une nouvelle emote entre directement dans les favorites s'il reste de la place
        const deck = emoteDeck(userId);
        s.deck = deck.length < EMOTE_DECK ? [...deck, e.id] : deck;
        save();
        note = `🎉 **${e.name}** est à vous${deck.length < EMOTE_DECK ? " et déjà dans vos favorites" : ""} !`;
      }
    } else if (act[1] === "add" && emoteUnlocked(userId, e)) {
      const deck = emoteDeck(userId).filter((x) => x !== e.id);
      s.deck = [...(deck.length >= EMOTE_DECK ? deck.slice(0, EMOTE_DECK - 1) : deck), e.id];
      save();
      note = `⭐ **${e.name}** est dans vos favorites.`;
    } else if (act[1] === "del") {
      s.deck = emoteDeck(userId).filter((x) => x !== e.id);
      save();
      note = `**${e.name}** n'est plus dans vos favorites.`;
    }
    await show(emoteDetailPayload(userId, e, note));
    return true;
  }
  const open = /^emote_open_(\w+)$/.exec(id);
  if (open) {
    const b = battles.get(open[1]);
    if (!b || b.phase === "over" || !b.players.some((p) => p.id === userId && !p.isAI)) return void (await interaction.reply({ content: "😶 Seuls les deux joueurs d'un combat en cours peuvent envoyer des emotes.", ephemeral: true })) || true;
    await interaction.reply(emotePicker(b, userId));
    return true;
  }
  const send = /^emote_send_(\w+)_(\w+)$/.exec(id);
  if (send) {
    const b = battles.get(send[1]), e = emoteOf(send[2]);
    const me = b?.players.find((p) => p.id === userId && !p.isAI);
    if (!b || b.phase === "over" || !me || !e) return void (await interaction.update({ content: "😶 Ce combat est terminé.", components: [] }).catch(() => null)) || true;
    if (!emoteUnlocked(userId, e)) return void (await interaction.reply({ content: "🔒 Vous n'avez pas encore cette emote.", ephemeral: true })) || true;
    const key = `${b.id}:${userId}`, now = Date.now();
    if (now < (emoteCooldown.get(key) ?? 0)) return void (await interaction.reply({ content: `⏳ Encore un instant avant la prochaine emote.`, ephemeral: true })) || true;
    emoteCooldown.set(key, now + EMOTE_COOLDOWN);
    await interaction.deferUpdate();
    await sendEmote(b, me.name, e);
    // la Maison répond parfois à vos emotes
    const ai = b.players.find((p) => p.isAI);
    if (ai && Math.random() < 0.5) {
      const reply = emoteOf(["rire", "cool", "colere", "gg", "clown", "reflechit"][Math.floor(Math.random() * 6)]);
      setTimeout(() => (b.phase !== "over" ? sendEmote(b, ai.name, reply).catch(() => null) : null), 2200 + Math.random() * 1500);
    }
    return true;
  }
  return false;
}
{
  // le bouton 😄 dans les combats (à côté des règles)
  const comps = battleComponents;
  battleComponents = (b, disabled = false) => {
    const rows = comps(b, disabled), last = rows.at(-1);
    if (b.players.some((p) => !p.isAI) && last && last.components.length < 5)
      last.components.unshift(new ButtonBuilder().setCustomId(`emote_open_${b.id}`).setLabel("Emotes").setEmoji("😄").setStyle(ButtonStyle.Secondary));
    return rows;
  };
  // les interactions des emotes passent dans la même chaîne que la boutique
  const shop = handleShopInteraction;
  handleShopInteraction = async (interaction) => (await handleEmoteInteraction(interaction)) || shop(interaction);
  // un bouton « Emotes » sur la vitrine de la boutique
  const front = shopFrontPayload;
  shopFrontPayload = async (...args) => {
    const p = await front(...args), last = p.components?.at(-1);
    const btn = new ButtonBuilder().setCustomId("emote_shop").setLabel("Emotes").setEmoji("😄").setStyle(ButtonStyle.Primary);
    if (last && last.components.length < 5 && p.components.length > 1) last.addComponents(btn);
    else p.components = [...(p.components ?? []), new ActionRowBuilder().addComponents(btn)];
    return p;
  };
}
