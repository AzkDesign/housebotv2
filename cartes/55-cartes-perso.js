
// --- Cartes de membres sur mesure ---
// Une image déposée dans assets/cartes-perso/<identifiant Discord>.webp (ou .png / .jpg) remplace le design
// généré de la carte de ce membre, partout (album, boosters, combats, marché…). L'image est cadrée au format
// des cartes (600 × 840) et ses coins sont arrondis comme les autres.
const CUSTOM_CARD_DIR = path.join(__dirname, "assets", "cartes-perso");
const customCardCache = new Map();
async function customCardImage(memberId) {
  if (!memberId) return null;
  if (customCardCache.has(memberId)) return customCardCache.get(memberId);
  let img = null;
  for (const ext of ["webp", "png", "jpg", "jpeg"]) {
    const file = path.join(CUSTOM_CARD_DIR, `${memberId}.${ext}`);
    if (fs.existsSync(file)) {
      img = await loadImage(fs.readFileSync(file)).catch((err) => (console.error("Carte sur mesure:", err.message), null));
      break;
    }
  }
  customCardCache.set(memberId, img);
  return img;
}
{
  const draw = drawCreatureCard;
  drawCreatureCard = async (card, holo = false, t = 0.37) => {
    const img = card?.memberId && !card.duo ? await customCardImage(card.memberId) : null;
    if (!img) return draw(card, holo, t);
    const W = 600, H = 840, c = createCanvas(W, H), ctx = c.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    // cadrage : toute la largeur, centré en hauteur
    const sh = (img.width * H) / W, sy = Math.max(0, (img.height - sh) / 2);
    roundRect(ctx, 0, 0, W, H, 28);
    ctx.clip();
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, sy, img.width, Math.min(sh, img.height), 0, 0, W, H);
    // en holo : un léger reflet irisé qui passe sur la carte
    if (holo) {
      ctx.globalCompositeOperation = "overlay";
      const g = ctx.createLinearGradient(W * (t - 0.3), 0, W * (t + 0.3), H);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(196,181,253,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    return c;
  };
}
