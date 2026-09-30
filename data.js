// Emplacement des fichiers de données du bot.
// Sur Railway, DATA_DIR=/data pointe vers un volume qui survit aux redéploiements.
const fs = require("fs");
const path = require("path");

// Espaces parasites retirés : « / data » ou une valeur vide ne doivent pas casser le stockage.
const DATA_DIR = (process.env.DATA_DIR || "").trim().replace(/\/\s+/g, "/") || __dirname;

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (err) {
  console.error(`Dossier de données ${DATA_DIR} inaccessible:`, err.message);
}
console.log(`Données du bot : ${DATA_DIR}`);

// Chemin d'un fichier de données. Au premier démarrage sur le volume,
// la version enregistrée dans le dépôt (chambres, niveaux…) y est recopiée.
function dataFile(name) {
  const target = path.join(DATA_DIR, name);
  const bundled = path.join(__dirname, name);
  if (target !== bundled && !fs.existsSync(target) && fs.existsSync(bundled)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.copyFileSync(bundled, target);
      console.log(`Données ${name} recopiées sur le volume`);
    } catch (err) {
      console.error(`Copie de ${name} impossible:`, err.message);
    }
  }
  return target;
}

module.exports = { DATA_DIR, dataFile };
