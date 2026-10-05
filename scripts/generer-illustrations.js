// Génère les illustrations des créatures avec l'API d'images d'OpenAI, à partir de illustrations/fiches.js.
// Les images sont enregistrées dans illustrations/images/<clé>.jpg ; le bot les utilise automatiquement.
//
// Utilisation (la clé API reste sur votre ordinateur, elle n'est jamais écrite dans le code) :
//   OPENAI_API_KEY=sk-...  node scripts/generer-illustrations.js            → génère les images manquantes
//   node scripts/generer-illustrations.js --apercu                           → affiche les consignes, sans rien générer
//   node scripts/generer-illustrations.js --cartes=p_eiffel,m_casino --refaire → régénère certaines cartes
// Réglages facultatifs : IMAGE_MODEL (par défaut gpt-image-1), IMAGE_QUALITY (par défaut high).
const fs = require("fs");
const path = require("path");
const { loadImage, createCanvas } = require("@napi-rs/canvas");
const { STYLE, AVOID, ELEMENT_MOODS, FICHES } = require("../illustrations/fiches");

const OUT = path.join(__dirname, "..", "illustrations", "images");
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")).map(([k, v]) => [k, v ?? true]));
const MODEL = process.env.IMAGE_MODEL || "gpt-image-1";
const QUALITY = process.env.IMAGE_QUALITY || "high";

// raretés lues dans les données des cartes (les entreprises sont traitées comme des rares)
const donnees = fs.readFileSync(path.join(__dirname, "..", "cartes", "01-donnees.js"), "utf8");
const rarities = Object.fromEntries([...donnees.matchAll(/(?:C|G2)\("([a-z0-9_]+)", "[^"]*", "[^"]*", "([a-z]+)"/g)].map((m) => [m[1], m[2]]));
const RARITY_TREATMENT = {
  commune: "Simple, clean and beautiful composition with a clear focal point.",
  peucommune: "Clean composition with a touch of glowing light accents.",
  rare: "Luminous composition with glowing light effects and shimmering highlights.",
  epique: "Spectacular, epic composition with intense energy effects and dramatic scale.",
  legendaire: "Majestic legendary composition, golden accents, radiant premium lighting, awe-inspiring scale.",
  mythique: "Exceptional full-art masterpiece composition filling the whole vertical frame, breathtaking lighting and atmosphere.",
};

function promptFor(key) {
  const [creature, scene, element] = FICHES[key];
  const rarity = rarities[key] ?? "rare";
  const framing =
    rarity === "mythique"
      ? "Vertical portrait composition, the creature dominates the frame from top to bottom."
      : "Wide landscape composition, the creature large and centered in the middle of the image with its head and action fully visible, room around it for the environment.";
  return `${STYLE}The creature: ${creature}. The scene: ${scene}. Mood: ${ELEMENT_MOODS[element]}. ${RARITY_TREATMENT[rarity]} ${framing} ${AVOID}`;
}

async function generate(key) {
  const rarity = rarities[key] ?? "rare";
  const size = rarity === "mythique" ? "1024x1536" : "1536x1024";
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: MODEL, prompt: promptFor(key), size, quality: QUALITY, n: 1 }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `HTTP ${res.status}`);
  const item = json.data?.[0];
  const buffer = item?.b64_json ? Buffer.from(item.b64_json, "base64") : item?.url ? Buffer.from(await (await fetch(item.url)).arrayBuffer()) : null;
  if (!buffer) throw new Error("réponse sans image");
  // ré-encodage en JPEG pour garder le dépôt léger
  const img = await loadImage(buffer);
  const c = createCanvas(img.width, img.height);
  c.getContext("2d").drawImage(img, 0, 0);
  fs.writeFileSync(path.join(OUT, `${key}.jpg`), await c.encode("jpeg", 90));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const wanted = args.cartes ? String(args.cartes).split(",") : Object.keys(FICHES);
  const todo = wanted.filter((k) => FICHES[k] && (args.refaire || !fs.existsSync(path.join(OUT, `${k}.jpg`))));
  if (args.apercu) {
    for (const k of todo) console.log(`\n[${k}] (${rarities[k] ?? "rare"})\n${promptFor(k)}`);
    console.log(`\n${todo.length} illustration(s) à générer.`);
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error("Clé manquante : définissez la variable OPENAI_API_KEY avant de lancer le script.");
    process.exit(1);
  }
  console.log(`${todo.length} illustration(s) à générer avec ${MODEL} (qualité ${QUALITY})…`);
  let ok = 0;
  const queue = [...todo];
  const worker = async () => {
    while (queue.length) {
      const key = queue.shift();
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await generate(key);
          ok++;
          console.log(`✅ ${key} (${ok}/${todo.length})`);
          break;
        } catch (err) {
          console.warn(`⚠️ ${key}, essai ${attempt}/3 : ${err.message}`);
          if (attempt === 3) console.error(`❌ ${key} abandonnée`);
          else await new Promise((r) => setTimeout(r, 5000 * attempt));
        }
      }
    }
  };
  await Promise.all([worker(), worker()]);
  console.log(`Terminé : ${ok}/${todo.length} illustration(s). Pensez à committer le dossier illustrations/images.`);
})();
