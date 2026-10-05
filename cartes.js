// Les Cartes de la Maison : le code est réparti par thème dans le dossier cartes/
// (01-donnees.js, 02-illustrations.js… 11-demarrage.js). Les fichiers sont assemblés ici
// dans l'ordre de leur numéro et exécutés comme un seul module : ils partagent les mêmes
// variables, comme s'ils ne formaient qu'un seul fichier.
// Pour ajouter du code, placez-le dans le fichier du thème concerné (ou un nouveau fichier numéroté).
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "cartes");
const files = fs.readdirSync(DIR).filter((f) => /^\d+-.+\.js$/.test(f)).sort();
const parts = files.map((f) => fs.readFileSync(path.join(DIR, f), "utf8"));

// Les messages d'erreur indiquent une ligne de « cartes.assemble.js » ; cartesLine() retrouve le fichier d'origine.
const offsets = [];
let line = 1;
parts.forEach((text, i) => {
  offsets.push([line, files[i]]);
  line += text.split("\n").length - 1;
});
function cartesLine(n) {
  const [start, f] = offsets.filter(([s]) => s <= n).at(-1) ?? [1, files[0]];
  return `cartes/${f}:${n - start + 1}`;
}

module._compile(parts.join(""), path.join(__dirname, "cartes.assemble.js"));
module.exports.cartesLine = cartesLine;
