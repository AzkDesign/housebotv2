// Le son des grands moments : bruitages fabriqués en code (aucun fichier audio, aucun droit d'auteur)
// et assemblage image + son en vidéo MP4 avec ffmpeg.
// Utilisé pour : le Manoir qui tombe (Clash), la victoire en raid, le jackpot du casino, le sacre du tournoi.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { nettoyer, respirer } = require("./clash3d/memoire");

const SR = 44100;
let FFMPEG = null;
try {
  FFMPEG = require("ffmpeg-static");
} catch {
  FFMPEG = null;
}
const videoOk = () => Boolean(FFMPEG && fs.existsSync(FFMPEG));

// ---------- la piste (stéréo) ----------
function track(seconds) {
  const n = Math.ceil(seconds * SR);
  return { L: new Float32Array(n), R: new Float32Array(n), rev: new Float32Array(n), n };
}
// ajoute un échantillon (pan : -1 gauche … 1 droite ; wet : part envoyée dans la réverbération)
function put(t, i, v, pan = 0, wet = 0.15) {
  if (i < 0 || i >= t.n) return;
  t.L[i] += v * Math.min(1, 1 - pan);
  t.R[i] += v * Math.min(1, 1 + pan);
  t.rev[i] += v * wet;
}
let seed = 12345;
const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const noise = () => rnd() * 2 - 1;
// filtre biquad (passe-bas, passe-haut, passe-bande)
function biquad(type, f, q = 0.707) {
  let b0, b1, b2, a0, a1, a2;
  const coef = (nf) => {
    const w = (2 * Math.PI * Math.min(nf, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    if (type === "lp") (b0 = (1 - cs) / 2), (b1 = 1 - cs), (b2 = (1 - cs) / 2);
    else if (type === "hp") (b0 = (1 + cs) / 2), (b1 = -(1 + cs)), (b2 = (1 + cs) / 2);
    else (b0 = al), (b1 = 0), (b2 = -al);
    // tous les coefficients suivent la fréquence (sinon le filtre s'emballe quand on la change)
    a0 = 1 + al;
    a1 = -2 * cs;
    a2 = 1 - al;
  };
  coef(f);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const run = (x) => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
  run.set = coef;
  return run;
}
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---------- les bruitages ----------
// explosion : souffle filtré qui s'assombrit, coup de grosse caisse, crépitements
function explosion(t, at, power = 1, pan = 0) {
  const len = Math.floor(SR * (1.6 + power * 0.6)), i0 = Math.floor(at * SR), lp = biquad("lp", 6000, 0.8);
  for (let k = 0; k < len; k++) {
    const s = k / SR, env = Math.exp(-s * 2.2) * (1 - Math.exp(-s * 300));
    if (k % 64 === 0) lp.set(5500 * Math.exp(-s * 2.5) + 120);
    let v = lp(noise()) * env * 0.9 * power;
    // le choc : une sinusoïde grave qui descend
    v += Math.sin(2 * Math.PI * (38 + 60 * Math.exp(-s * 9)) * s) * Math.exp(-s * 3.5) * 0.9 * power;
    // crépitements
    if (rnd() < 0.0025 * Math.exp(-s * 1.5)) for (let j = 0; j < 220; j++) put(t, i0 + k + j, noise() * 0.35 * Math.exp(-j / 40) * power, pan + (rnd() - 0.5), 0.3);
    put(t, i0 + k, v, pan, 0.25);
  }
}
// grondement sourd (bâtiment qui s'effondre)
function rumble(t, at, dur, vol = 0.5) {
  const len = Math.floor(SR * dur), i0 = Math.floor(at * SR), lp = biquad("lp", 160, 0.9);
  for (let k = 0; k < len; k++) {
    const s = k / SR, env = Math.min(1, s * 6) * Math.exp(-s * (2.5 / dur));
    put(t, i0 + k, lp(noise()) * env * vol * 2.2, 0, 0.2);
  }
}
// rugissement de dragon : dent de scie grave, voix rauque, distorsion
function roar(t, at, dur = 1.6, vol = 0.7) {
  const len = Math.floor(SR * dur), i0 = Math.floor(at * SR), bp = biquad("bp", 600, 1.2), bp2 = biquad("bp", 1400, 2);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const s = k / SR, q = s / dur, env = Math.sin(Math.PI * Math.min(1, q * 1.15)) ** 0.6;
    const f = 72 + 40 * Math.sin(Math.PI * q) + 8 * Math.sin(2 * Math.PI * 7 * s) + 6 * noise();
    ph += f / SR;
    const saw = 2 * (ph % 1) - 1;
    let v = Math.tanh((saw * 0.8 + bp(noise()) * 1.6 + bp2(noise()) * 0.7) * 2.2) * env * vol;
    put(t, i0 + k, v, 0, 0.35);
  }
}
// souffle (vent rapide)
function whoosh(t, at, dur = 0.6, vol = 0.4, pan = 0) {
  const len = Math.floor(SR * dur), i0 = Math.floor(at * SR), bp = biquad("bp", 400, 1.5);
  for (let k = 0; k < len; k++) {
    const q = k / len;
    if (k % 64 === 0) bp.set(300 + 2500 * Math.sin(Math.PI * q));
    put(t, i0 + k, bp(noise()) * Math.sin(Math.PI * q) * vol * 2, pan * (q * 2 - 1), 0.2);
  }
}
// cloche (partiels inharmoniques)
function bell(t, at, f, vol = 0.35, pan = 0, decay = 1.4) {
  const len = Math.floor(SR * decay * 2), i0 = Math.floor(at * SR), parts = [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]];
  for (let k = 0; k < len; k++) {
    const s = k / SR;
    let v = 0;
    for (const [m, a] of parts) v += Math.sin(2 * Math.PI * f * m * s) * a * Math.exp((-s * m) / decay);
    put(t, i0 + k, v * vol * (1 - Math.exp(-s * 800)), pan, 0.3);
  }
}
// pièces qui tintent : une pluie de petits « clings »
function coins(t, at, dur, density = 30, vol = 0.18) {
  const count = Math.floor(dur * density);
  for (let c = 0; c < count; c++) {
    const st = at + rnd() * dur, f = 2400 + rnd() * 2600, pan = rnd() * 1.6 - 0.8, len = Math.floor(SR * (0.08 + rnd() * 0.15)), i0 = Math.floor(st * SR);
    for (let k = 0; k < len; k++) {
      const s = k / SR, e = Math.exp(-s * 28);
      put(t, i0 + k, (Math.sin(2 * Math.PI * f * s) + 0.6 * Math.sin(2 * Math.PI * f * 1.48 * s) + 0.3 * Math.sin(2 * Math.PI * f * 2.31 * s)) * e * vol, pan, 0.2);
    }
  }
}
// foule qui acclame : murmure filtré, applaudissements, quelques « ouais ! »
function cheer(t, at, dur, vol = 0.45) {
  const len = Math.floor(SR * dur), i0 = Math.floor(at * SR);
  const f1 = biquad("bp", 700, 0.8), f2 = biquad("bp", 1500, 1.1), f3 = biquad("bp", 2600, 1.4);
  let mod = 0;
  for (let k = 0; k < len; k++) {
    const s = k / SR, env = Math.min(1, s * 2.5) * Math.min(1, (dur - s) * 1.5);
    mod += (noise() * 0.5 - mod) * 0.0008;
    const v = (f1(noise()) * 0.9 + f2(noise()) * 0.7 + f3(noise()) * 0.4) * (0.75 + mod * 3) * env * vol * 1.6;
    put(t, i0 + k, v, Math.sin(s * 1.3) * 0.3, 0.25);
  }
  // applaudissements
  const claps = Math.floor(dur * 45);
  for (let c = 0; c < claps; c++) {
    const st = at + 0.15 + rnd() * (dur - 0.3), j0 = Math.floor(st * SR), hp = biquad("bp", 1800 + rnd() * 1500, 1.2), pan = rnd() * 1.6 - 0.8;
    for (let k = 0; k < 700; k++) put(t, j0 + k, hp(noise()) * Math.exp(-k / 120) * vol * 0.9, pan, 0.15);
  }
  // cris de joie
  for (let c = 0; c < Math.floor(dur * 2); c++) {
    const st = at + 0.2 + rnd() * (dur - 0.8), f0 = 260 + rnd() * 260, l = Math.floor(SR * (0.35 + rnd() * 0.3)), j0 = Math.floor(st * SR), pan = rnd() * 1.4 - 0.7, bp = biquad("bp", 900, 2);
    let ph = 0;
    for (let k = 0; k < l; k++) {
      const q = k / l;
      ph += (f0 * (1 + 0.35 * Math.sin(Math.PI * q)) + 6 * Math.sin(2 * Math.PI * 6 * k / SR)) / SR;
      put(t, j0 + k, bp(2 * (ph % 1) - 1) * Math.sin(Math.PI * q) * vol * 0.5, pan, 0.3);
    }
  }
}
// cuivres : dent de scie filtrée qui s'ouvre, léger vibrato
function brass(t, at, note, dur, vol = 0.22, pan = 0) {
  const len = Math.floor(SR * dur), i0 = Math.floor(at * SR), f = midi(note), lp = biquad("lp", 400, 1.1);
  let ph = 0, ph2 = 0;
  for (let k = 0; k < len; k++) {
    const s = k / SR, att = Math.min(1, s / 0.04), rel = Math.min(1, (dur - s) / 0.08), env = att * rel * (0.85 + 0.15 * Math.exp(-s * 4));
    if (k % 32 === 0) lp.set(500 + 3800 * Math.min(1, s / 0.06) * (0.6 + 0.4 * Math.exp(-s * 2)));
    const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * s) * Math.min(1, s * 3);
    ph += (f * vib) / SR;
    ph2 += (f * vib * 1.003) / SR;
    const v = lp((2 * (ph % 1) - 1) * 0.6 + (2 * (ph2 % 1) - 1) * 0.4) * env * vol;
    put(t, i0 + k, v, pan, 0.3);
  }
}
// timbale
function timpani(t, at, note = 43, vol = 0.6) {
  const len = Math.floor(SR * 1.4), i0 = Math.floor(at * SR), f = midi(note), lp = biquad("lp", 900);
  for (let k = 0; k < len; k++) {
    const s = k / SR, e = Math.exp(-s * 3.2);
    put(t, i0 + k, (Math.sin(2 * Math.PI * f * (1 + 0.15 * Math.exp(-s * 30)) * s) + lp(noise()) * 0.3 * Math.exp(-s * 25)) * e * vol, 0, 0.25);
  }
}
// fanfare de victoire : « ta-ta-ta-taaaa », puis l'accord final
function fanfare(t, at, vol = 1) {
  const n = [[67, 0, 0.14], [67, 0.16, 0.14], [67, 0.32, 0.14], [72, 0.48, 0.9]];
  for (const [note, d, l] of n) {
    brass(t, at + d, note, l, 0.24 * vol, -0.2);
    brass(t, at + d, note - 12, l, 0.14 * vol, 0.2);
  }
  timpani(t, at, 43, 0.5 * vol);
  timpani(t, at + 0.48, 36, 0.7 * vol);
  // l'accord majeur, avec les trompettes qui montent
  for (const [note, pan] of [[60, -0.4], [64, 0.4], [67, -0.1], [72, 0.2], [76, 0.5]]) brass(t, at + 1.45, note, 1.5, 0.13 * vol, pan);
  brass(t, at + 1.2, 74, 0.22, 0.2 * vol);
  brass(t, at + 1.45, 79, 1.5, 0.12 * vol);
  timpani(t, at + 1.45, 36, 0.8 * vol);
  bell(t, at + 1.45, midi(84), 0.12 * vol, 0, 1.6);
}
// feu d'artifice : sifflement qui monte, puis détonation pétillante
function firework(t, at, pan = 0, vol = 0.5) {
  const up = Math.floor(SR * 0.6), i0 = Math.floor(at * SR);
  let ph = 0;
  for (let k = 0; k < up; k++) {
    const q = k / up;
    ph += (900 + 1600 * q) / SR;
    put(t, i0 + k, Math.sin(2 * Math.PI * ph) * 0.08 * vol * Math.sin(Math.PI * q), pan, 0.2);
  }
  explosion(t, at + 0.6, 0.35 * vol, pan);
  for (let c = 0; c < 40; c++) {
    const st = at + 0.7 + rnd() * 0.9, j0 = Math.floor(st * SR), hp = biquad("hp", 3000);
    for (let k = 0; k < 300; k++) put(t, j0 + k, hp(noise()) * Math.exp(-k / 50) * 0.3 * vol, pan + (rnd() - 0.5) * 0.6, 0.35);
  }
}
// rouleaux de machine à sous qui s'arrêtent : « clac »
function reelStop(t, at, vol = 0.5) {
  const i0 = Math.floor(at * SR), lp = biquad("lp", 1800);
  for (let k = 0; k < 2600; k++) {
    const s = k / SR;
    put(t, i0 + k, (lp(noise()) * Math.exp(-s * 70) + Math.sin(2 * Math.PI * 140 * s) * Math.exp(-s * 40)) * vol, 0, 0.1);
  }
}

// ---------- mixage et fichier WAV ----------
function render(t) {
  // réverbération (Schroeder : 4 peignes + 2 passe-tout), partagée par les deux canaux
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, buf: new Float32Array(d), i: 0, fb: 0.78, lp: 0 }));
  const aps = [225, 556].map((d) => ({ d, buf: new Float32Array(d), i: 0 }));
  const wetL = new Float32Array(t.n), wetR = new Float32Array(t.n);
  for (let k = 0; k < t.n; k++) {
    const x = t.rev[k];
    let s = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.lp = y * 0.75 + c.lp * 0.25;
      c.buf[c.i] = x + c.lp * c.fb;
      c.i = (c.i + 1) % c.d;
      s += y;
    }
    for (const a of aps) {
      const y = a.buf[a.i];
      a.buf[a.i] = s + y * 0.5;
      a.i = (a.i + 1) % a.d;
      s = y - s * 0.5;
    }
    wetL[k] = s * 0.22;
    wetR[Math.min(t.n - 1, k + 300)] += s * 0.22;
  }
  // normalisation douce et limiteur
  let peak = 0;
  for (let k = 0; k < t.n; k++) peak = Math.max(peak, Math.abs(t.L[k] + wetL[k]), Math.abs(t.R[k] + wetR[k]));
  const g = peak > 0 ? 0.9 / Math.max(0.5, peak) : 1;
  const out = Buffer.alloc(44 + t.n * 4);
  out.write("RIFF", 0);
  out.writeUInt32LE(36 + t.n * 4, 4);
  out.write("WAVE", 8);
  out.write("fmt ", 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(t.n * 4, 40);
  for (let k = 0; k < t.n; k++) {
    const l = Math.tanh((t.L[k] + wetL[k]) * g * 1.1), r = Math.tanh((t.R[k] + wetR[k]) * g * 1.1);
    out.writeInt16LE(Math.round(l * 32000), 44 + k * 4);
    out.writeInt16LE(Math.round(r * 32000), 46 + k * 4);
  }
  return out;
}

// ---------- vidéo ----------
// Flux vidéo : on pousse les images une à une (copiées), ffmpeg les encode au fil de l'eau avec la bande-son.
// push(rgba, durée en ms) ; end() → le MP4 (Buffer) ; abort() abandonne.
function videoStream(w, h, wav, { fps = 25 } = {}) {
  if (!videoOk()) throw new Error("ffmpeg indisponible");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "son-")), wavFile = path.join(dir, "son.wav"), out = path.join(dir, "clip.mp4");
  const clean = () => fs.rmSync(dir, { recursive: true, force: true });
  fs.writeFileSync(wavFile, wav);
  const args = ["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${w}x${h}`, "-r", String(fps), "-i", "pipe:0", "-i", wavFile, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out];
  let ff;
  try {
    ff = spawn(FFMPEG, args, { stdio: ["pipe", "ignore", "pipe"] });
  } catch (err) {
    clean();
    throw err;
  }
  let err = "", at = 0, shown = 0, closed = false, dead = false, pumping = null;
  ff.stderr.on("data", (d) => (err += d));
  ff.stdin.on("error", () => null); // ffmpeg arrêté : l'erreur remonte par « done »
  const done = new Promise((resolve, reject) => {
    ff.on("error", reject);
    ff.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg : ${err.slice(0, 300) || `code ${code}`}`))));
  });
  done.catch(() => null).finally(() => (dead = true));
  // une seule écriture à la fois, en attendant que ffmpeg suive : une image répétée n'est jamais recopiée en mémoire
  const queue = [];
  const pump = async () => {
    await null; // « pumping » est posé avant que la boucle ne tourne
    while (queue.length && !dead) {
      const [b, n] = queue.shift();
      for (let k = 0; k < n && !dead; k++) if (!ff.stdin.write(b)) await Promise.race([new Promise((r) => ff.stdin.once("drain", r)), done.catch(() => null)]);
    }
    queue.length = 0;
    pumping = null;
  };
  return {
    // chaque image est répétée selon sa durée, sur l'horloge cumulée
    // (sinon des images de 60 ms arrondies à 80 ms décaleraient tout le son)
    push(rgba, delay = 1000 / fps) {
      if (closed) return Promise.resolve();
      at += delay;
      const n = Math.max(1, Math.round((at * fps) / 1000) - shown);
      shown += n;
      queue.push([Buffer.from(new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength)), n]);
      return (pumping ??= pump());
    },
    async end() {
      if (closed) throw new Error("flux vidéo déjà fermé");
      closed = true;
      try {
        await pumping;
        ff.stdin.end();
        await done;
        nettoyer(true);
        return fs.readFileSync(out);
      } finally {
        clean();
      }
    },
    abort() {
      if (closed) return;
      closed = true;
      ff.kill();
      done.finally(clean).catch(() => null);
    },
  };
}
// frames : [{ data: RGBA, delay }] (comme un GIF) ou une fonction (i) => RGBA avec { count } images à fps fixe
async function makeVideo(frames, w, h, wav, { fps = 25, count = null } = {}) {
  const v = videoStream(w, h, wav, { fps });
  try {
    if (typeof frames === "function")
      for (let i = 0; i < count; i++) {
        await v.push(await frames(i));
        // chaque image vient d'un getImageData : sa mémoire native n'est rendue qu'après un nettoyage
        if (i % 4 === 3) await respirer();
      }
    else for (const fr of frames) await v.push(fr.data, fr.delay ?? 40);
    return await v.end();
  } catch (err) {
    v.abort();
    throw err;
  }
}

// ---------- les bandes-son des grands moments ----------
// Manoir détruit : explosion et effondrement, puis la victoire (une cloche par étoile, fanfare, foule)
function soundManoir({ dur = 6, victoryAt = 1.9, starTimes = [] } = {}) {
  const t = track(dur);
  explosion(t, 0.05, 1.3);
  rumble(t, 0.1, 1.8, 1.3);
  explosion(t, 0.55, 0.5, -0.4);
  whoosh(t, victoryAt - 0.45, 0.5, 0.35);
  fanfare(t, victoryAt, 0.9);
  starTimes.forEach((at, i) => bell(t, at, midi(76 + i * 4), 0.3, (i - 1) * 0.5));
  cheer(t, victoryAt + 0.3, Math.max(1, dur - victoryAt - 0.3), 0.7);
  return render(t);
}
// raid : rugissement, le dragon s'effondre, fanfare et acclamations
function soundRaid({ dur = 4.8, fallAt = 1.4 } = {}) {
  const t = track(dur);
  roar(t, 0.05, 1.35, 0.55);
  explosion(t, fallAt, 1.2);
  rumble(t, fallAt + 0.1, 1.4, 1.2);
  fanfare(t, fallAt + 0.55, 1);
  cheer(t, fallAt + 0.7, dur - fallAt - 0.7, 0.75);
  return render(t);
}
// jackpot : les rouleaux s'arrêtent un par un, cloches, cascade de pièces, foule
function soundJackpot({ dur = 5, stops = [0.35, 0.75, 1.15] } = {}) {
  const t = track(dur);
  stops.forEach((at) => reelStop(t, at, 0.55));
  const winAt = stops.at(-1) + 0.2;
  [72, 76, 79, 84, 88].forEach((n, i) => bell(t, winAt + i * 0.09, midi(n), 0.3, (i - 2) * 0.3, 1.2));
  coins(t, winAt + 0.1, dur - winAt - 0.4, 55, 0.16);
  timpani(t, winAt, 36, 0.5);
  cheer(t, winAt + 0.3, dur - winAt - 0.3, 0.65);
  return render(t);
}
// sacre du champion : roulement, fanfare, feux d'artifice, ovation
function soundChampion({ dur = 6 } = {}) {
  const t = track(dur);
  for (let k = 0; k < 14; k++) timpani(t, 0.05 + k * 0.06, 43, 0.12 + k * 0.012);
  fanfare(t, 0.95, 1);
  firework(t, 1.4, -0.5, 1.1);
  firework(t, 2.2, 0.5, 1.1);
  firework(t, 3.0, 0, 1.3);
  cheer(t, 1.2, dur - 1.2, 0.8);
  return render(t);
}

module.exports = { SR, track, render, makeVideo, videoStream, videoOk, soundManoir, soundRaid, soundJackpot, soundChampion, explosion, rumble, roar, whoosh, bell, coins, cheer, brass, timpani, fanfare, firework, reelStop, midi };
