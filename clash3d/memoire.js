// Mémoire « native » du canvas : chaque getImageData() réserve un tampon que V8 ne compte pas.
// Il n'est rendu qu'après un passage du ramasse-miettes ET un tour de boucle d'événements :
// dans une boucle d'images, la mémoire grimpe donc d'environ 1,2 Mo par image (640×480) si on ne fait rien.
// nettoyer() lance un petit nettoyage (jeune génération, quelques ms) ; respirer() nettoie puis laisse la boucle tourner.
let gc;
function getGc() {
  if (gc !== undefined) return gc;
  gc = typeof global.gc === "function" ? global.gc : null;
  if (!gc) {
    try {
      require("v8").setFlagsFromString("--expose-gc");
      gc = require("vm").runInNewContext("gc");
    } catch {
      gc = null;
    }
  }
  return gc;
}
function nettoyer(complet = false) {
  const f = getGc();
  if (!f) return;
  try {
    f(complet ? undefined : { type: "minor" });
  } catch {
    // option non comprise par cette version de V8 : nettoyage complet
    try {
      f();
    } catch {}
  }
}
const respirer = () => new Promise((resolve) => (nettoyer(), setImmediate(resolve)));

module.exports = { nettoyer, respirer };
