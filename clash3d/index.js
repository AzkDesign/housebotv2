// Clash de la Maison en 3D : point d'entrée côté bot.
// Les rendus partent dans un fil séparé (worker) ; s'il ne peut pas démarrer, ils sont faits sur place.
const path = require("path");
const M3 = require("./math");
const MEM = require("./memoire");

let worker = null, seq = 0, broken = false;
const pending = new Map();
function spawn() {
  const { Worker } = require("worker_threads");
  // jeune génération bridée : sinon V8 garde des dizaines de Mo réservés après les maillages des soldats ;
  // tas plafonné : un rendu qui s'emballe arrête ce fil (le bot passe à l'animation 2D), pas le bot entier
  const w = new Worker(path.join(__dirname, "travailleur.js"), { resourceLimits: { maxYoungGenerationSizeMb: 12, maxOldGenerationSizeMb: 384 } });
  w.unref();
  const fail = (err) => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    pending.clear();
    if (worker === w) worker = null;
  };
  w.on("message", (m) => {
    const p = pending.get(m.id);
    if (!p) return;
    if (m.frame) {
      // image intermédiaire d'une bataille
      try {
        p.onFrame?.(m.idx, m.frame);
      } catch (err) {
        p.frameError ??= err;
      }
      return;
    }
    pending.delete(m.id);
    if (p.frameError) {
      clearTimeout(p.timer);
      return p.reject(p.frameError);
    }
    clearTimeout(p.timer);
    if (m.ok) p.resolve(m.result);
    else p.reject(new Error(m.error));
  });
  w.on("error", (err) => {
    console.error("[clash 3D] fil de rendu en erreur :", err.message);
    fail(err);
  });
  w.on("exit", (code) => {
    if (code) fail(new Error(`fil de rendu 3D arrêté (code ${code})`));
    if (worker === w) worker = null;
  });
  return w;
}
// sur place (sans worker) : même résultat, mais le bot est occupé pendant le rendu
function local(kind, job, onFrame) {
  const R = require("./rendu");
  if (kind === "base") return R.renderBase(job);
  if (kind === "battle") {
    let n = 0;
    return R.renderBattle(job, onFrame ? (data) => onFrame(n++, data) : null).then((r) => ({ ...r, count: n || r.frames.length }));
  }
  return R.renderIcons(job);
}
function run(kind, job, timeout, onFrame = null) {
  if (broken) return Promise.resolve().then(() => local(kind, job, onFrame));
  return new Promise((resolve, reject) => {
    try {
      worker ??= spawn();
    } catch (err) {
      console.error("[clash 3D] worker impossible, rendu sur place :", err.message);
      broken = true;
      return Promise.resolve()
        .then(() => local(kind, job, onFrame))
        .then(resolve, reject);
    }
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("rendu 3D trop long"));
      // un rendu bloqué : on repart sur un fil neuf
      const w = worker;
      worker = null;
      w?.terminate().catch(() => null);
    }, timeout);
    pending.set(id, { resolve, reject, timer, onFrame });
    worker.postMessage({ id, kind, job });
  });
}

module.exports = {
  // image d'une base : { data (RGBA), width, height, anchors: { id: { x, y, topX, topY, halfW } } }
  renderBase: (job) => run("base", job, 60000),
  // images d'une bataille : onFrame(index, RGBA) reçoit chaque image dès qu'elle est prête ; résultat { stats, count }
  renderBattle: (job, onFrame) => run("battle", job, 180000, onFrame),
  // petites icônes 3D (pièce, cristal, trophée…)
  renderIcons: (job) => run("icons", job, 30000),
  // petit nettoyage mémoire après un getImageData (voir memoire.js)
  nettoyer: MEM.nettoyer,
  fitCamera: M3.fitCamera,
  gridToWorld: M3.gridToWorld,
  BSCALE: 1.35,
};
