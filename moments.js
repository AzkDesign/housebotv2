// Les grands moments en vidéo avec le son (voir son.js) : le Manoir qui tombe (Clash), la victoire en raid,
// le jackpot du casino et le sacre du champion du tournoi.
const path = require("path");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const son = require("./son");

const FONT_DIR = path.join(__dirname, "assets", "fonts");
for (const [file, family] of [
  ["playfair-display-900.ttf", "CardTitle"],
  ["inter-800.ttf", "CardBold"],
  ["inter-500.ttf", "CardText"],
  ["cinzel-700.ttf", "CardEngrave"],
]) {
  try {
    if (!GlobalFonts.has?.(family)) GlobalFonts.registerFromPath(path.join(FONT_DIR, file), family);
  } catch {}
}
const TAU = Math.PI * 2, FPS = 25;
const ease = (q) => 1 - Math.pow(1 - Math.max(0, Math.min(1, q)), 3);
function seeded(s) {
  let x = s >>> 0 || 1;
  return () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
}
function glowText(ctx, text, x, y, size, fill, glow, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `${size}px CardTitle`;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  ctx.shadowColor = glow;
  ctx.shadowBlur = 24;
  ctx.lineWidth = size / 7;
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.strokeText(text, 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
function confetti(ctx, W, H, t, R0, n = 70) {
  const R = seeded(R0);
  for (let k = 0; k < n; k++) {
    const x = R() * W, v = 90 + R() * 160, y = ((R() * H + t * v) % (H + 30)) - 15, rot = t * (3 + R() * 5) + k;
    ctx.save();
    ctx.translate(x + Math.sin(t * 3 + k) * 10, y);
    ctx.rotate(rot);
    ctx.fillStyle = ["#fbbf24", "#f472b6", "#60a5fa", "#a78bfa", "#34d399", "#ffffff"][k % 6];
    ctx.fillRect(-5, -2.5, 10, 5);
    ctx.restore();
  }
}
// les polices du canvas n'ont pas d'emoji : on les retire des pseudos
const clean = (s, n = 18) => String(s ?? "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "").trim().slice(0, n);
const rgbaOf = (c) => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;

// --- Clash : le Manoir tombe (les images arrivent une à une pendant le rendu 3D : voir 57-clash-3d) ---
// victoryAt : apparition de « VICTOIRE » ; starTimes : chaque étoile qui se pose (secondes)
function manoirStream(w, h, { dur, victoryAt, starTimes }) {
  return son.videoStream(w, h, son.soundManoir({ dur, victoryAt, starTimes }));
}
// --- Tournoi : le sacre (images de l'animation du champion) ---
async function championVideo(frames, w, h) {
  const dur = frames.reduce((a, f) => a + f.delay, 0) / 1000;
  return son.makeVideo(frames, w, h, son.soundChampion({ dur }));
}

// --- Raid : le dragon rugit, s'effondre, victoire ---
async function raidVideo({ art, boss = "NYXAROS", podium = [] }) {
  const W = 640, H = 360, dur = 4.8, fallAt = 1.4, count = Math.round(dur * FPS);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const frame = (i) => {
    const t = i / FPS, R = seeded(7);
    // fond : vortex des abysses
    const g = ctx.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, 420);
    g.addColorStop(0, "#5b21b6");
    g.addColorStop(0.45, "#1e0b3a");
    g.addColorStop(1, "#05010a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let k = 0; k <= 50; k++) {
        const a = (arm / 4) * TAU + k * 0.12 + t * 1.2, r = 10 + k * 8;
        const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r * 0.7;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = "rgba(192,132,252,0.08)";
      ctx.lineWidth = 20;
      ctx.stroke();
    }
    ctx.restore();
    // le dragon
    if (art && t < fallAt + 0.9) {
      const fall = Math.max(0, t - fallAt), shake = t < fallAt ? Math.sin(t * 70) * 6 * Math.min(1, t / fallAt) : 0;
      const h = 330, w = (art.width / art.height) * h;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - fall / 0.9);
      ctx.translate(W / 2 + shake, H / 2 + 10 + fall * fall * 700);
      ctx.rotate(fall * 0.5);
      ctx.shadowColor = `rgba(168,85,247,${0.6 + 0.4 * Math.sin(t * 12)})`;
      ctx.shadowBlur = 30;
      ctx.drawImage(art, -w / 2, -h / 2, w, h);
      ctx.restore();
    }
    // onde du rugissement
    if (t < fallAt)
      for (let k = 0; k < 3; k++) {
        const q = (t * 1.6 + k / 3) % 1;
        ctx.save();
        ctx.globalAlpha = (1 - q) * 0.5;
        ctx.strokeStyle = "#f0abfc";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.ellipse(W / 2 - 120, H / 2 - 40, 20 + q * 160, 14 + q * 110, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
    // explosion et éclat blanc à la chute
    if (t >= fallAt && t < fallAt + 1) {
      const q = (t - fallAt) / 1;
      for (let k = 0; k < 40; k++) {
        const a = R() * TAU, sp = 120 + R() * 380, r = q * sp;
        ctx.fillStyle = `rgba(${k % 2 ? "251,146,60" : "232,121,249"},${1 - q})`;
        ctx.beginPath();
        ctx.arc(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r * 0.7, 3 + R() * 4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - q * 3.5)})`;
      ctx.fillRect(0, 0, W, H);
    }
    // victoire
    if (t >= fallAt + 0.45) {
      const q = (t - fallAt - 0.45) / 0.5;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(W / 2, H / 2 - 30);
      ctx.rotate(t * 0.3);
      for (let k = 0; k < 14; k++) {
        ctx.rotate(TAU / 14);
        ctx.fillStyle = "rgba(253,224,71,0.09)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-20, -520);
        ctx.lineTo(20, -520);
        ctx.fill();
      }
      ctx.restore();
      confetti(ctx, W, H, t - fallAt, 11);
      glowText(ctx, `${boss} EST VAINCU !`, W / 2, H / 2 - 20, 44, "#fde68a", "#f59e0b", 1 + 0.3 * (1 - ease(q)));
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - fallAt - 0.9) / 0.4));
      ctx.font = "18px CardBold";
      ctx.textAlign = "center";
      ctx.fillStyle = "#f5f3ff";
      ctx.fillText(podium.length ? podium.map((n, k) => `${k + 1}. ${clean(n, 16)}`).join("     ") : "Bravo à tous les dresseurs !", W / 2, H / 2 + 30);
      ctx.font = "15px CardEngrave";
      ctx.fillStyle = "#c4b5fd";
      ctx.fillText("TENTEZ DE LE CAPTURER !", W / 2, H / 2 + 62);
      ctx.restore();
    }
    return rgbaOf(c);
  };
  return son.makeVideo(frame, W, H, son.soundRaid({ dur, fallAt }), { count });
}

// --- Casino : le jackpot ---
async function jackpotVideo({ name, amount, euro = (n) => `${Math.round(n).toLocaleString("fr-FR")} €` }) {
  const W = 640, H = 360, dur = 5, stops = [0.35, 0.75, 1.15], count = Math.round(dur * FPS);
  const c = createCanvas(W, H), ctx = c.getContext("2d");
  const SYMS = ["7", "BAR", "♣", "7", "BAR", "7"];
  const frame = (i) => {
    const t = i / FPS, won = t >= stops[2] + 0.15, flash = won && Math.floor(t * 8) % 2 === 0;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, won ? "#7c2d12" : "#1e1b4b");
    g.addColorStop(1, "#0b0b14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // rayons dorés
    if (won) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.translate(W / 2, H / 2);
      ctx.rotate(t * 0.4);
      for (let k = 0; k < 16; k++) {
        ctx.rotate(TAU / 16);
        ctx.fillStyle = "rgba(253,224,71,0.1)";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-22, -500);
        ctx.lineTo(22, -500);
        ctx.fill();
      }
      ctx.restore();
    }
    // la machine : cadre doré, ampoules qui clignotent
    const mx = 120, my = 70, mw = 400, mh = 170;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 20;
    const fr = ctx.createLinearGradient(0, my, 0, my + mh);
    fr.addColorStop(0, "#fde68a");
    fr.addColorStop(0.5, "#b45309");
    fr.addColorStop(1, "#fbbf24");
    ctx.fillStyle = fr;
    ctx.beginPath();
    ctx.roundRect(mx - 14, my - 14, mw + 28, mh + 28, 22);
    ctx.fill();
    ctx.restore();
    for (let k = 0; k < 22; k++) {
      const on = (k + Math.floor(t * 10)) % 2 === 0;
      const p = k / 22, x = p < 0.5 ? mx - 6 + p * 2 * (mw + 12) : mx - 6 + (1 - (p - 0.5) * 2) * (mw + 12), y = p < 0.5 ? my - 7 : my + mh + 7;
      ctx.fillStyle = on || won ? "#fff7ae" : "#92400e";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, TAU);
      ctx.fill();
    }
    // les trois rouleaux
    for (let r = 0; r < 3; r++) {
      const rx = mx + 12 + r * ((mw - 24) / 3), rw = (mw - 24) / 3 - 10, stopped = t >= stops[r];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx, my + 12, rw, mh - 24, 12);
      ctx.fillStyle = "#fffbeb";
      ctx.fill();
      ctx.clip();
      const off = stopped ? 0 : (t * 900 + r * 120) % 80;
      for (let k = -1; k < 3; k++) {
        const sym = stopped ? (k === 0 ? "7" : SYMS[(k + 6 + r) % 6]) : SYMS[(Math.floor(t * 12) + k + r) % 6];
        const y = my + mh / 2 + 12 + (k * 80 + (stopped ? 0 : off)) - (stopped ? 0 : 40);
        ctx.font = sym === "BAR" ? "30px CardBold" : "64px CardTitle";
        ctx.textAlign = "center";
        ctx.fillStyle = sym === "7" ? "#dc2626" : "#1f2937";
        ctx.fillText(sym === "♣" ? "BAR" : sym, rx + rw / 2, y + (sym === "BAR" ? -10 : 8));
      }
      if (!stopped) {
        ctx.fillStyle = "rgba(255,251,235,0.55)";
        ctx.fillRect(rx, my + 12, rw, mh - 24);
      }
      // ombre du cylindre : les symboles du haut et du bas s'effacent
      const sh = ctx.createLinearGradient(0, my + 12, 0, my + mh - 12);
      sh.addColorStop(0, "rgba(41,22,6,0.95)");
      sh.addColorStop(0.3, "rgba(41,22,6,0)");
      sh.addColorStop(0.7, "rgba(41,22,6,0)");
      sh.addColorStop(1, "rgba(41,22,6,0.95)");
      ctx.fillStyle = sh;
      ctx.fillRect(rx, my + 12, rw, mh - 24);
      ctx.restore();
    }
    // la ligne gagnante
    if (won) {
      ctx.strokeStyle = flash ? "#fde047" : "#f59e0b";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(mx + 6, my + mh / 2);
      ctx.lineTo(mx + mw - 6, my + mh / 2);
      ctx.stroke();
    }
    // pluie de pièces et titre
    if (won) {
      const q = (t - stops[2] - 0.15) / 0.5, R = seeded(3);
      for (let k = 0; k < 40; k++) {
        const x = R() * W, v = 160 + R() * 220, y = ((R() * H + (t - stops[2]) * v) % (H + 30)) - 15;
        const sq = Math.abs(Math.cos(t * 6 + k));
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.ellipse(x, y, 8 * sq + 1, 8, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#a16207";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      glowText(ctx, "JACKPOT !", W / 2, 52, 52, flash ? "#ffffff" : "#fde047", "#f59e0b", 1 + 0.5 * (1 - ease(q)));
      const shown = amount * ease((t - stops[2] - 0.3) / 1.6);
      glowText(ctx, `+${euro(shown)}`, W / 2, H - 52, 40, "#86efac", "#16a34a");
      ctx.save();
      ctx.font = "17px CardBold";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fef3c7";
      ctx.fillText(clean(name, 30), W / 2, H - 20);
      ctx.restore();
    } else glowText(ctx, "Les rouleaux tournent…", W / 2, 46, 26, "#e9d5ff", "#7c3aed");
    return rgbaOf(c);
  };
  return son.makeVideo(frame, W, H, son.soundJackpot({ dur, stops }), { count });
}

module.exports = { videoOk: son.videoOk, manoirStream, championVideo, raidVideo, jackpotVideo };
