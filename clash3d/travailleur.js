// Clash de la Maison en 3D : le fil de rendu (« worker »). Il fait tout le calcul lourd, le bot reste réactif.
// Messages reçus : { id, kind: "base" | "battle" | "icons", job } ; réponse : { id, ok, result } ou { id, ok: false, error }.
// Une bataille rend la main entre deux images (mémoire du canvas) : un autre rendu peut passer entre-temps.
const { parentPort } = require("worker_threads");
const R = require("./rendu");
const { nettoyer } = require("./memoire");

parentPort.on("message", async (m) => {
  try {
    if (m.kind === "base") {
      const r = R.renderBase(m.job);
      const data = new Uint8ClampedArray(r.data);
      parentPort.postMessage({ id: m.id, ok: true, result: { data, width: r.width, height: r.height, anchors: r.anchors } }, [data.buffer]);
    } else if (m.kind === "battle") {
      // chaque image part dès qu'elle est prête : le bot ajoute les effets et encode pendant qu'on calcule la suivante
      let n = 0;
      const r = await R.renderBattle(m.job, (data) => {
        const frame = new Uint8ClampedArray(data);
        parentPort.postMessage({ id: m.id, frame, idx: n++ }, [frame.buffer]);
      });
      parentPort.postMessage({ id: m.id, ok: true, result: { frames: [], stats: r.stats, count: n } });
    } else if (m.kind === "icons") {
      const r = R.renderIcons(m.job);
      const list = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, data: new Uint8ClampedArray(v.data) }]));
      parentPort.postMessage({ id: m.id, ok: true, result: list }, Object.values(list).map((v) => v.data.buffer));
    } else parentPort.postMessage({ id: m.id, ok: false, error: `type de rendu inconnu : ${m.kind}` });
  } catch (err) {
    parentPort.postMessage({ id: m.id, ok: false, error: err.stack ?? String(err) });
  }
  // fin du travail : grand nettoyage (le tas de ce fil est petit), la mémoire du canvas est rendue au tour suivant
  setImmediate(() => nettoyer(true));
});
