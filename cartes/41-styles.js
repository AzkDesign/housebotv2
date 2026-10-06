
// --- Styles des cartes de membres et de duos ---
// 1. Éditions spéciales à collectionner (plus rares, tirées dans les boosters) :
//    membres : « Édition dorée » (légendaire, cadre or) et « Full Art » (mythique, illustration pleine carte) ;
//    duos : « Or » et « Prisme » (mythiques).
// 2. Style de statut, automatique : un membre élu Membre Star a une carte dorée et un sceau « Membre Star × N » ;
//    un membre au rôle élevé a une carte aux couleurs de son rôle.
const MEMBER_VARIANTS = [
  ["or", "Édition dorée", "legendaire"],
  ["full", "Full Art", "mythique"],
];
const DUO_VARIANTS = [
  ["or", "Or", "mythique"],
  ["prisme", "Prisme", "mythique"],
];
const VARIANT_SHARE = 0.3; // une édition spéciale sort 3 fois moins souvent qu'une carte normale de même rareté
const ROLE_COLOR_FROM = 0.5; // rôle dans la moitié haute de la hiérarchie : carte colorée
const higherRarity = (a, b) => (ORDER.indexOf(a) >= ORDER.indexOf(b) ? a : b);
const variantsOf = (c, list) => list.map(([k, label, rar]) => ({ ...c, id: `${c.id}_${k}`, rarity: higherRarity(c.rarity, rar), variant: k, variantLabel: label, baseId: c.id }));
const DUO_VARIANT_PAL = { or: ["#fff7d6", "#f59e0b", "#3d1702"], prisme: ["#f5d0fe", "#8b5cf6", "#1e1b4b"] };
{
  const members = memberCards, duos = duoCards, pool = genPool, kind = kindOf, creature = drawCreatureCard;
  // la carte de base reste la première (c'est « la » carte du membre) ; ses éditions suivent
  memberCards = (activeOnly = false) => {
    const base = members(activeOnly);
    return [...base, ...base.flatMap((c) => variantsOf(c, MEMBER_VARIANTS))];
  };
  duoCards = (activeOnly = false) => {
    const base = duos(activeOnly);
    return [...base, ...base.flatMap((c) => variantsOf(c, DUO_VARIANTS))];
  };
  // les éditions spéciales sont plus rares dans les boosters
  genPool = (gen) => pool(gen).filter((c) => !c.variant || Math.random() < VARIANT_SHARE);
  kindOf = (card) => (card.variant ? `${kind({ ...card, id: card.baseId })} · ${card.variantLabel}` : kind(card));
  drawCreatureCard = async (card, holo = false, t = 0.37) => {
    if (card.duo) {
      const c = await creature(card, holo, t);
      if (card.variant) duoStyle(c, card, t);
      return c;
    }
    // chaque édition impose son style, quelle que soit la rareté de la carte de base
    const look = card.variant === "or" ? { ...card, rarity: "legendaire" } : card.variant === "full" ? { ...card, rarity: "mythique" } : card;
    const c = await creature(look, holo || card.variant === "full", t);
    if (card.memberId) memberStyle(c, card, t);
    return c;
  };
}
// un ruban en haut de la carte
function styleRibbon(ctx, text, x, y, colors, ink) {
  ctx.save();
  ctx.font = "13px CardEngrave";
  const w = ctx.measureText(text).width + 34;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-w / 2, -13);
  ctx.lineTo(w / 2, -13);
  ctx.lineTo(w / 2 - 8, 0);
  ctx.lineTo(w / 2, 13);
  ctx.lineTo(-w / 2, 13);
  ctx.lineTo(-w / 2 + 8, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -13, 0, 13);
  g.addColorStop(0, colors[0]);
  g.addColorStop(1, colors[1]);
  ctx.fillStyle = g;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  spaced(ctx, text, 0, 5, 2);
  ctx.restore();
}
// sceau doré « Membre Star × N »
function starSeal(ctx, x, y, n) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU - Math.PI / 2, r = k % 2 ? 34 : 40;
    k ? ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = metalGradient(ctx, 600, 840, METAL.legendaire);
  ctx.fill();
  ctx.restore();
  disc(ctx, x, y, 28, "#7c2d12");
  disc(ctx, x, y, 26, metalGradient(ctx, 600, 840, METAL.legendaire));
  star5(ctx, x, y - 4, 13, "#7c2d12");
  ctx.textAlign = "center";
  ctx.font = "13px CardTitle";
  ctx.fillStyle = "#7c2d12";
  ctx.fillText(`×${n}`, x, y + 20);
}
function memberStyle(c, card, t) {
  const ctx = c.getContext("2d"), W = c.width, H = c.height;
  const stars = card.stars ?? 0, role = card.role, colored = !card.variant && role?.color && role.color !== "#000000" && (role.norm ?? 0) >= ROLE_COLOR_FROM;
  // le cadre : la carte moins son panneau intérieur
  const framePath = new Path2D();
  rrPath(framePath, 0, 0, W, H, 28);
  rrPath(framePath, 16, 16, W - 32, H - 32, 18);
  // rôle élevé : la carte prend la couleur du rôle (cadre plein, reflet sur toute la carte)
  if (colored) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    ctx.globalCompositeOperation = "color";
    ctx.fillStyle = role.color;
    ctx.fill(framePath, "evenodd");
    ctx.globalCompositeOperation = "soft-light";
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = role.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "screen";
    glow(ctx, W * 0.5, 84, 300, role.color, 0.25);
    ctx.restore();
    styleRibbon(ctx, role.name.toUpperCase().slice(0, 26), W / 2, 84, [shade(role.color, 1.25), shade(role.color, 0.7)], "#ffffff");
  }
  // Membre Star : touches d'or, et une carte entièrement dorée dès 3 élections
  if (stars > 0) {
    ctx.save();
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    if (stars >= 3 && !card.variant) {
      ctx.globalCompositeOperation = "color";
      ctx.fillStyle = "#f59e0b";
      ctx.fill(framePath, "evenodd");
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = stars >= 3 ? 8 : 5;
    ctx.strokeStyle = metalGradient(ctx, W, H, METAL.legendaire, Math.sin(TAU * t) * 0.25);
    roundRect(ctx, 8, 8, W - 16, H - 16, 23);
    ctx.stroke();
    // paillettes d'or sur l'illustration
    ctx.globalCompositeOperation = "screen";
    const R = seeded(hashOf(card.id) + 21);
    for (let i = 0; i < 14 + stars * 6; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      sparkle(ctx, 40 + R() * (W - 80), 90 + R() * 420, 0.8 + tw * 3, `rgba(253,230,138,${0.3 + tw * 0.7})`);
    }
    ctx.restore();
    starSeal(ctx, W - 74, 132, stars);
    ctx.font = "11px CardEngrave";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde68a";
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 6;
    ctx.fillText(stars > 1 ? `MEMBRE STAR ${stars} FOIS` : "MEMBRE STAR", W - 74, 190);
    ctx.restore();
  }
  // éditions spéciales
  if (card.variant === "or") styleRibbon(ctx, "ÉDITION DORÉE", W / 2, colored ? 116 : 84, ["#fde68a", "#b45309"], "#3d1702");
  if (card.variant === "full") styleRibbon(ctx, "FULL ART", W / 2, 84, ["#f5d0fe", "#7c3aed"], "#ffffff");
}
// éditions des duos : voile d'or et paillettes, ou ruban Prisme
function duoStyle(c, card, t) {
  const ctx = c.getContext("2d"), W = c.width;
  if (card.variant === "or") {
    ctx.save();
    roundRect(ctx, 16, 16, W - 32, 470, 18);
    ctx.clip();
    ctx.globalCompositeOperation = "color";
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(16, 16, W - 32, 470);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "screen";
    const R = seeded(hashOf(card.id) + 4);
    for (let i = 0; i < 40; i++) {
      const tw = Math.max(0, Math.sin(TAU * (t * 2 + R())));
      sparkle(ctx, 30 + R() * (W - 60), 60 + R() * 400, 1 + tw * 3.5, `rgba(253,230,138,${0.3 + tw * 0.7})`);
    }
    ctx.restore();
    styleRibbon(ctx, "ÉDITION OR", W / 2, 128, ["#fde68a", "#b45309"], "#3d1702");
  } else styleRibbon(ctx, "ÉDITION PRISME", W / 2, 128, ["#f5d0fe", "#7c3aed"], "#ffffff");
}
