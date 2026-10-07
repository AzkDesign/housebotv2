// Encodage des GIF animés des combats, scène par scène (voir cartes/47-anime.js).
// Lancé comme « worker » : il encode une scène pendant que le bot dessine la suivante.
// Peut aussi être utilisé directement (sans worker) avec encodeScene.
const { isMainThread, parentPort } = require("worker_threads");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");

// Une palette par scène ; les pixels identiques à l'image précédente deviennent transparents (index 255),
// ce qui allège beaucoup le GIF dès que la caméra ne bouge pas.
function encodeScene(enc, frames, w, h) {
  if (!frames.length) return 0;
  const budget = 110000, px = w * h, step = Math.max(3, Math.ceil((px * frames.length) / budget)), n = Math.floor(px / step), sample = new Uint8Array(n * 4 * frames.length);
  let o = 0;
  frames.forEach((sh, f) => {
    const d = sh.data;
    for (let k = 0, j = ((f * 13) % step) * 4; k < n; k++, j += step * 4) {
      sample[o++] = d[j];
      sample[o++] = d[j + 1];
      sample[o++] = d[j + 2];
      sample[o++] = 255;
    }
  });
  const real = quantize(sample.subarray(0, o), 255), palette = [...real];
  while (palette.length < 256) palette.push([255, 0, 255]); // l'index 255 reste libre pour la transparence
  let prev = null;
  for (const sh of frames) {
    const idx = applyPalette(sh.data, real);
    if (prev) {
      const raw = idx.slice();
      for (let k = 0; k < idx.length; k++) if (idx[k] === prev[k]) idx[k] = 255;
      prev = raw;
      enc.writeFrame(idx, w, h, { palette, delay: sh.delay, transparent: true, transparentIndex: 255, dispose: 1 });
    } else {
      prev = idx.slice();
      enc.writeFrame(idx, w, h, { palette, delay: sh.delay, repeat: -1, dispose: 1 });
    }
  }
  return frames.length;
}

if (!isMainThread && parentPort) {
  const enc = GIFEncoder();
  parentPort.on("message", (m) => {
    try {
      if (m.type === "scene") encodeScene(enc, m.frames, m.w, m.h);
      else if (m.type === "finish") {
        enc.finish();
        const bytes = enc.bytes();
        parentPort.postMessage({ type: "done", bytes }, [bytes.buffer]);
      }
    } catch (err) {
      parentPort.postMessage({ type: "error", message: err.stack ?? err.message });
    }
  });
}

module.exports = { encodeScene };
