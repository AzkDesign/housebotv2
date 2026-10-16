// --- Pile ou face en 3D : qui frappe en premier ---
// Au début de chaque combat de l'Arène, une pièce est lancée : FACE (or, couronne) pour le premier joueur,
// PILE (argent, étoile) pour le second. Le gagnant a l'initiative à la manche 1, puis elle alterne chaque manche :
// à coup égal (attaque contre attaque, spécial contre spécial), le joueur qui a l'initiative frappe le premier.
// La pièce est tirée dès la création du combat ; son animation est calculée pendant le choix des équipes.
const TOSS_W = 640, TOSS_H = 400;
const TOSS_SIDES = [
  { name: "FACE", icon: "👑", color: "#fbbf24", light: "#fde68a", dark: "#92400e" },
  { name: "PILE", icon: "⭐", color: "#cbd5e1", light: "#f1f5f9", dark: "#475569" },
];
// qui a l'initiative à cette manche (null : combat sans pile ou face, l'ancienne règle de la chance s'applique)
const initiativeOf = (b) => (b.coin === undefined || b.coin === null ? null : (b.coin + Math.max(0, (b.round || 1) - 1)) % 2);

async function tossAvatar(p) {
  return p.avatar ? fetchImage(`avatar:${p.avatar}`, p.avatar).catch(() => null) : null;
}
// carton d'un joueur en bas de l'image : avatar, nom, côté de la pièce
function tossChip(ctx, x, y, w, p, av, side, state) {
  const S = TOSS_SIDES[side], h = 64;
  ctx.save();
  if (state === "lost") ctx.globalAlpha = 0.45;
  if (state === "won") glow(ctx, x + w / 2, y + h / 2, w * 0.6, S.color, 0.3);
  c3Panel(ctx, x, y, w, h, 18, 0.82);
  if (state === "won") {
    ctx.strokeStyle = S.color;
    ctx.lineWidth = 3;
    roundRect(ctx, x, y, w, h, 18);
    ctx.stroke();
  }
  // avatar rond cerclé de la couleur du côté
  const ax = side ? x + w - 38 : x + 38, ay = y + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax, ay, 22, 0, TAU);
  ctx.clip();
  if (av) ctx.drawImage(av, ax - 22, ay - 22, 44, 44);
  else {
    ctx.fillStyle = "#334155";
    ctx.fillRect(ax - 22, ay - 22, 44, 44);
  }
  ctx.restore();
  ctx.strokeStyle = S.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(ax, ay, 23, 0, TAU);
  ctx.stroke();
  // côté et nom
  const tx = side ? x + w - 72 : x + 72, align = side ? "right" : "left";
  // petite pièce dessinée (les emojis ne s'affichent pas dans l'image) puis le côté
  ctx.font = "13px CardEngrave";
  const lw = ctx.measureText(S.name).width, px = side ? tx - lw - 12 : tx + 7;
  const g = ctx.createRadialGradient(px - 2, y + 20, 1, px, y + 22, 8);
  g.addColorStop(0, S.light);
  g.addColorStop(1, S.dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, y + 22, 7, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = S.color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.textAlign = align;
  ctx.fillStyle = S.light;
  ctx.fillText(S.name, side ? tx : tx + 18, y + 27);
  ctx.font = `${fitText(ctx, p.name, w - 92, 19, "CardBold")}px CardBold`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(p.name, tx, y + 50);
  ctx.restore();
}

// le GIF du lancer : { buffer, duration }
async function coinTossGif(b) {
  const W = TOSS_W, H = TOSS_H, win = b.coin, S = TOSS_SIDES[win];
  const [A, B] = b.players, avatars = await Promise.all([tossAvatar(A), tossAvatar(B)]);
  const encoder = anEncoder(W, H);
  const oc = createCanvas(W, H), ctx = oc.getContext("2d"), im = ctx.createImageData(W, H);
  let scene = null, batch = [], duration = 0, k = 0, landed = -1;
  const flush = () => {
    if (batch.length) encoder.scene(batch, true);
    batch = [];
  };
  const onFrame = (i, frame, meta) => {
    im.data.set(frame);
    ctx.putImageData(im, 0, 0);
    const ph = meta.phase, [cx, cy, cr] = meta.coin;
    if (ph === "resultat" && landed < 0) landed = i;
    const q = landed < 0 ? 0 : i - landed; // images depuis que la pièce est posée
    // éclat doré quand la pièce se pose
    if (ph === "resultat") glow(ctx, cx, cy, cr * (2.2 + q * 0.15), S.color, Math.max(0, 0.5 - q * 0.04));
    // titre
    if (ph !== "resultat") {
      outlinedText(ctx, "PILE OU FACE", W / 2, 46, "34px CardTitle", "#fde68a");
      outlinedText(ctx, ph === "intro" ? "Qui frappera le premier ?" : ph === "vol" ? "La pièce est lancée…" : "Elle tourne… elle tourne…", W / 2, 72, "16px CardBold", "#e2e8f0");
    } else {
      const a = Math.min(1, (q + 1) / 3), sc = 1 + 0.5 * (1 - easeOut(Math.min(1, q / 4)));
      bigTitle(ctx, `${S.name} !`, W / 2, 62, 58, ["#ffffff", S.color], a, sc);
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (q - 2) / 3));
      outlinedText(ctx, `${b.players[win].name} frappe en premier`, W / 2, 98, `${Math.min(20, fitText(ctx, `${b.players[win].name} frappe en premier`, W - 60, 20, "CardBold"))}px CardBold`, "#ffffff");
      ctx.restore();
    }
    // les deux joueurs
    const state = (side) => (ph !== "resultat" || q < 2 ? "" : side === win ? "won" : "lost");
    tossChip(ctx, 16, H - 80, 290, A, avatars[0], 0, state(0));
    tossChip(ctx, W - 306, H - 80, 290, B, avatars[1], 1, state(1));
    const data = new Uint8ClampedArray(ctx.getImageData(0, 0, W, H).data);
    CLASH3D.nettoyer();
    if (ph !== scene) {
      flush();
      scene = ph;
    }
    batch.push({ data, delay: meta.delay });
    duration += meta.delay;
    k++;
  };
  try {
    await CLASH3D.renderCoin({ w: W, h: H, result: win, seed: hashOf(b.id) }, onFrame);
  } catch (err) {
    encoder.stop();
    throw err;
  }
  if (!k) {
    encoder.stop();
    throw new Error("aucune image du pile ou face");
  }
  flush();
  const buffer = await encoder.finish();
  return { buffer, duration };
}

// montre le lancer dans le fil du combat (le GIF a été préparé pendant le choix des équipes)
async function showCoinToss(b) {
  if (b.coin === undefined || b.coin === null || !b.channel) return;
  const [A, B] = b.players, win = b.players[b.coin], S = TOSS_SIDES[b.coin];
  const sides = `${TOSS_SIDES[0].icon} **FACE** : ${A.name}\n${TOSS_SIDES[1].icon} **PILE** : ${B.name}`;
  // on n'attend pas indéfiniment une animation en retard
  const gif = await Promise.race([b.coinGif ?? Promise.resolve(null), sleep(9000).then(() => null)]).catch(() => null);
  b.coinGif = null;
  const result = () =>
    new EmbedBuilder()
      .setColor(b.coin ? 0x94a3b8 : 0xf59e0b)
      .setTitle(`🪙 Pile ou face : ${S.icon} ${S.name} !`)
      .setDescription(`${sides}\n\n⚡ **${win.name}** frappe en premier à la manche 1, puis l'initiative passe d'un joueur à l'autre à chaque manche.\n*À coup égal, le joueur qui a l'initiative frappe le premier.*`);
  if (!gif) {
    await b.channel.send({ embeds: [result()] }).catch(() => null);
    return;
  }
  const msg = await b.channel
    .send({
      embeds: [new EmbedBuilder().setColor(0xe9c46a).setTitle("🪙 Pile ou face : qui frappe en premier ?").setDescription(sides).setImage("attachment://pile-ou-face.gif")],
      files: [new AttachmentBuilder(gif.buffer, { name: "pile-ou-face.gif" })],
    })
    .catch(() => null);
  if (!msg) return;
  // le temps de voir la pièce tomber (le dernier plan reste affiché), puis le résultat écrit
  await sleep(Math.min(9000, gif.duration - 2400 + (gif.buffer.length / 1048576) * 400));
  await msg.edit({ embeds: [result().setImage("attachment://pile-ou-face.gif")] }).catch(() => null);
  await sleep(1200);
}
