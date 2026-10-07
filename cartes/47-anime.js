
// --- Combats façon anime : chaque manche devient une séquence d'animation ---
// Caméra virtuelle (zoom, panoramique, tangage), gros plans en cases de manga, territoires des astres,
// images d'impact en noir et blanc, onomatopées, interface de jeu de combat. Chaque astre a sa charge,
// son attaque spéciale, sa traînée et ses éclats. Le GIF est encodé scène par scène, chacune avec sa
// propre palette (couleurs fidèles, mémoire limitée) ; trop lourd, il est refait plus petit, et en
// dernier recours on retombe sur l'ancienne animation.
const AN_W = 880, AN_H = 500, AN_BW = 1144, AN_BH = 650, AN_MX = (AN_BW - AN_W) / 2, AN_MY = (AN_BH - AN_H) / 2;
const AN_CW = 178, AN_CH = 249, AN_BASE = 292, AN_HOME = [AN_W / 2 - 220, AN_W / 2 + 220];
const AN_MAX_BYTES = 7 * 1024 * 1024; // plus léger = chargé plus vite par Discord (limite : 10 Mo)
let anDebug = null; // tests : reçoit chaque image rendue
const AN_PAL = {
  soleil: { main: "#f59e0b", light: "#fef3c7", dark: "#431407", accent: "#ef4444", realm: "TERRITOIRE DU SOLEIL NOIR", sfx: ["FWOOSH", "BRAAAM", "KRAÂÂM"] },
  givre: { main: "#38bdf8", light: "#f0f9ff", dark: "#082f49", accent: "#a5f3fc", realm: "TERRITOIRE DU ZÉRO ABSOLU", sfx: ["KRSSH", "KRAK", "CRIIIK"] },
  orage: { main: "#8b5cf6", light: "#f5f3ff", dark: "#1e1b4b", accent: "#facc15", realm: "TERRITOIRE DES MILLE ÉCLAIRS", sfx: ["BZZAK", "KRAKOOM", "ZZRAK"] },
  etoile: { main: "#facc15", light: "#fffbeb", dark: "#2e1065", accent: "#f472b6", realm: "TERRITOIRE DE LA VOÛTE CÉLESTE", sfx: ["SHIING", "VWOOM", "BLAAM"] },
  ombre: { main: "#7c3aed", light: "#ede9fe", dark: "#05010d", accent: "#ef4444", realm: "TERRITOIRE DU NÉANT", sfx: ["DOOM", "GLORP", "VRRM"] },
  lune: { main: "#a5b4fc", light: "#f8fafc", dark: "#1e1b4b", accent: "#e0e7ff", realm: "TERRITOIRE DE LA LUNE PÂLE", sfx: ["SHLAK", "VSHHH", "SLASH"] },
};
const AN_KO = { main: "#ef4444", light: "#ffffff", dark: "#450a0a", accent: "#7f1d1d", sfx: ["K.O."] };
const AN_BLUE = { main: "#3b82f6", light: "#eff6ff", dark: "#172554", accent: "#93c5fd", sfx: ["TCHAK"] };
function anAstreOf(f) {
  const a = f?.astre ?? (f?.card ? astreOf(f.card) : null);
  return AN_PAL[a] ? a : "etoile";
}
const anPalOf = (f) => AN_PAL[anAstreOf(f)];

// ---------- petits outils ----------
const anClamp = (q) => (q < 0 ? 0 : q > 1 ? 1 : q);
const anSeg = (q, a, b) => anClamp((q - a) / (b - a));
const anLerp = (a, b, t) => a + (b - a) * t;
const anOutExpo = (q) => (q >= 1 ? 1 : 1 - 2 ** (-10 * q));
const anCache = new Map();
function anCached(key, make) {
  if (!anCache.has(key)) {
    anCache.set(key, make());
    if (anCache.size > 60) anCache.delete(anCache.keys().next().value);
  }
  return anCache.get(key);
}
// silhouette d'une carte, teinte unie (éclair blanc au coup, images rémanentes colorées)
const anSilCache = new WeakMap();
function anSilhouette(th, color) {
  let m = anSilCache.get(th);
  if (!m) anSilCache.set(th, (m = new Map()));
  if (!m.has(color)) {
    const c = createCanvas(th.width, th.height), x = c.getContext("2d");
    x.drawImage(th, 0, 0);
    x.globalCompositeOperation = "source-in";
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return m.get(color);
}
function anVignette() {
  return anCached("vignette", () => {
    const c = createCanvas(AN_W, AN_H), x = c.getContext("2d");
    const g = x.createRadialGradient(AN_W / 2, AN_H / 2, AN_H * 0.32, AN_W / 2, AN_H / 2, AN_W * 0.62);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.6)");
    x.fillStyle = g;
    x.fillRect(0, 0, AN_W, AN_H);
    return c;
  });
}
// trame de points (cases de manga) : les points grossissent de gauche à droite
function anHalftone(color) {
  return anCached(`trame:${color}`, () => {
    const c = createCanvas(AN_W, AN_H), x = c.getContext("2d");
    x.fillStyle = color;
    for (let y = 0, row = 0; y < AN_H + 9; y += 8, row++)
      for (let px = row % 2 ? 4 : 0; px < AN_W + 9; px += 8) {
        x.beginPath();
        x.arc(px, y, 0.4 + 3.4 * (px / AN_W) ** 1.6, 0, TAU);
        x.fill();
      }
    return c;
  });
}

// ---------- primitives graphiques ----------
// lignes de concentration (manga) vers un point, en laissant une zone claire au centre
function anFocusLines(ctx, cx, cy, alpha, seed, color = "#ffffff", inner = 150, n = 90) {
  if (alpha <= 0) return;
  const R = seeded(seed), far = 1100;
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, w = 0.003 + R() * 0.012, r0 = inner * (0.85 + R() * 0.8);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 0.75);
    ctx.lineTo(cx + Math.cos(a - w) * far, cy + Math.sin(a - w) * far);
    ctx.lineTo(cx + Math.cos(a + w) * far, cy + Math.sin(a + w) * far);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
// lignes de vitesse horizontales, effilées
function anSpeedLines(ctx, dir, alpha, seed, color = "#ffffff") {
  if (alpha <= 0) return;
  const R = seeded(seed);
  ctx.save();
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.fillStyle = color;
  for (let k = 0; k < 38; k++) {
    const y = R() * AN_H, len = 140 + R() * 420, x = R() * (AN_W + len) - len, h = 0.8 + R() * 3;
    const tail = dir > 0 ? x : x + len, head = dir > 0 ? x + len : x;
    ctx.beginPath();
    ctx.moveTo(tail, y);
    ctx.lineTo(head, y - h / 2);
    ctx.lineTo(head, y + h / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
// tache d'encre aux bords irréguliers, avec gouttelettes
function anInkBlob(ctx, x, y, r, seed, color) {
  const R = seeded(seed), n = 20, pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU, rr = r * (0.72 + R() * 0.45) * (k % 4 === 0 ? 1.1 + R() * 0.5 : 1);
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  ctx.moveTo(m0[0], m0[1]);
  for (let k = 0; k < n; k++) {
    const p = pts[k], m = mid(p, pts[(k + 1) % n]);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const a = R() * TAU, d = r * (1.15 + R() * 0.9);
    disc(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.04 + R() * 0.1), color);
  }
}
// trait de pinceau horizontal, déroulé de gauche à droite jusqu'à q
function anBrushBar(ctx, x, y, w, h, seed, color, q = 1) {
  if (q <= 0) return;
  const R = seeded(seed), x0 = x - w / 2, len = w * q, steps = 26, top = [], bot = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    top.push([x0 + len * t, y - h / 2 + (R() - 0.5) * h * 0.2 + (k === 0 ? h * 0.18 : 0)]);
    bot.push([x0 + len * t, y + h / 2 + (R() - 0.5) * h * 0.2 - (k === 0 ? h * 0.1 : 0)]);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  top.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(bot[k][0], bot[k][1]);
  ctx.closePath();
  ctx.fill();
  // poils du pinceau en bout de trait
  for (let k = 0; k < 12; k++) ctx.fillRect(x0 + len - R() * 26, y - h / 2 + R() * h, 8 + R() * 44 * q, 1 + R() * 2.4);
}
// éclair en zigzag (screen : lumineux ; source-over : éclair noir)
function anBolt(ctx, x1, y1, x2, y2, seed, width, color, jit = 0.2, branches = 0, mode = "screen") {
  const R = seeded(seed), len = Math.hypot(x2 - x1, y2 - y1) || 1, n = Math.max(4, Math.round(len / 24)), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  const pts = [[x1, y1]];
  for (let k = 1; k < n; k++) {
    const p = k / n, off = (R() - 0.5) * len * jit;
    pts.push([x1 + (x2 - x1) * p + nx * off, y1 + (y2 - y1) * p + ny * off]);
  }
  pts.push([x2, y2]);
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const layers = mode === "screen" ? [[width * 3.4, rgba(color, 0.22)], [width, color], [width * 0.38, "#ffffff"]] : [[width, color]];
  for (const [lw, col] of layers) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  ctx.restore();
  for (let k = 0; k < branches; k++) {
    const [bx, by] = pts[1 + Math.floor(R() * (pts.length - 2))], a = Math.atan2(y2 - y1, x2 - x1) + (R() - 0.5) * 1.8, bl = len * (0.18 + R() * 0.25);
    anBolt(ctx, bx, by, bx + Math.cos(a) * bl, by + Math.sin(a) * bl, seed * 7 + k + 1, width * 0.45, color, jit, 0, mode);
  }
}
// gerbe d'étincelles (avec gravité)
function anSparks(ctx, x, y, q, seed, n, dist, colors, size = 3, grav = 140) {
  if (q >= 1) return;
  const R = seeded(seed), e = anOutExpo(q);
  ctx.save();
  ctx.globalAlpha = 1 - q;
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, v = dist * (0.35 + R() * 0.85), s = size * (0.5 + R()) * (1 - q * 0.6);
    const px = x + Math.cos(a) * v * e, py = y + Math.sin(a) * v * e * 0.85 + grav * q * q;
    const tx = px - Math.cos(a) * s * 3, ty = py - Math.sin(a) * s * 3;
    ctx.strokeStyle = colors[k % colors.length];
    ctx.lineWidth = s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
}
// fumée (changement de carte, poussière d'atterrissage)
function anSmoke(ctx, x, y, q, seed, color, spread = 130, n = 14) {
  const R = seeded(seed);
  ctx.save();
  for (let k = 0; k < n; k++) {
    const a = R() * TAU, d = spread * (0.2 + R() * 0.8) * anOutExpo(q), r = (26 + R() * 34) * (0.5 + q);
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.55 - q * 20;
    const g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, rgba(color, 0.75 * (1 - q)));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
  }
  ctx.restore();
}
// onde de choc au sol
function anGroundRing(ctx, x, y, q, color, size = 280) {
  if (q >= 1) return;
  ctx.save();
  for (let k = 0; k < 2; k++) {
    const p = anClamp(q - k * 0.15);
    if (p <= 0) continue;
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = k ? "#ffffff" : color;
    ctx.lineWidth = 12 * (1 - p) + 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, 30 + size * anOutExpo(p), (30 + size * anOutExpo(p)) * 0.2, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
// croissant de lune (forme pleine), tourné de rot
function anCrescent(ctx, x, y, r, rot, fill, thick = 0.3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.clip();
  const p = new Path2D();
  p.arc(0, 0, r, 0, TAU);
  p.arc(r * thick * 1.4, -r * thick * 0.4, r * 0.95, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill(p, "evenodd");
  ctx.restore();
}
// entaille de sabre : lame en croissant, épaisse au milieu et effilée aux pointes, aplatie puis tournée de rot
function anSlashArc(ctx, x, y, r, rot, e, color, alpha = 1) {
  if (e <= 0 || alpha <= 0) return;
  const span = 2.3, a0 = -span / 2, a1 = a0 + span * anOutExpo(Math.min(1, e)), n = 26;
  const blade = (th) => {
    ctx.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = a0 + (a1 - a0) * (k / n), w = Math.sin((k / n) * Math.PI) * th;
      const px = Math.cos(a) * (r + w), py = Math.sin(a) * (r + w) * 0.3;
      k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    for (let k = n; k >= 0; k--) {
      const a = a0 + (a1 - a0) * (k / n), w = Math.sin((k / n) * Math.PI) * th * 0.15;
      ctx.lineTo(Math.cos(a) * (r - w), Math.sin(a) * (r - w) * 0.3);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  const th = r * 0.2 * (1 - Math.min(1, e) * 0.25);
  blade(th * 1.9);
  ctx.fillStyle = rgba(color, 0.28);
  ctx.fill();
  blade(th);
  ctx.fillStyle = color;
  ctx.fill();
  blade(th * 0.4);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}
// cristal de glace (prisme hexagonal) planté au sol en (x, y), penché de ang
function anCrystal(ctx, x, y, ang, len, w, P) {
  if (len <= 2) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const L = [[-w / 2, 0], [-w / 2, -len * 0.72], [0, -len], [0, 0]], Rt = [[0, 0], [0, -len], [w / 2, -len * 0.72], [w / 2, 0]];
  const face = (pts, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    pts.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
  };
  const g1 = ctx.createLinearGradient(0, -len, 0, 0);
  g1.addColorStop(0, "#ffffff");
  g1.addColorStop(0.5, P.accent);
  g1.addColorStop(1, rgba(P.main, 0.85));
  face(L, g1);
  const g2 = ctx.createLinearGradient(0, -len, 0, 0);
  g2.addColorStop(0, P.accent);
  g2.addColorStop(1, rgba(P.dark, 0.9));
  face(Rt, g2);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -len * 0.72);
  ctx.lineTo(0, -len);
  ctx.lineTo(w / 2, -len * 0.72);
  ctx.lineTo(w / 2, 0);
  ctx.moveTo(0, -len);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.restore();
}
// tentacule d'ombre effilée, de (x, y) vers le haut, courbée de sway
function anTendril(ctx, x, y, h, sway, w, P, seed) {
  if (h <= 2) return;
  const R = seeded(seed), cx = x - sway * h * 0.45, cy = y - h * 0.55, ex = x + sway * h * 0.55, ey = y - h, n = 14, left = [], right = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, bx = (1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t * t * ex, by = (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * ey;
    const dx = 2 * (1 - t) * (cx - x) + 2 * t * (ex - cx), dy = 2 * (1 - t) * (cy - y) + 2 * t * (ey - cy), l = Math.hypot(dx, dy) || 1;
    const ww = (w * (1 - t) ** 0.8 + 1) * (0.9 + R() * 0.2);
    left.push([bx - (dy / l) * ww, by + (dx / l) * ww]);
    right.push([bx + (dy / l) * ww, by - (dx / l) * ww]);
  }
  ctx.beginPath();
  left.forEach(([px, py], k) => (k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k][0], right[k][1]);
  ctx.closePath();
  ctx.strokeStyle = rgba(P.main, 0.9);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = "#030008";
  ctx.fill();
}
function anInkPool(ctx, x, y, rx, P, t) {
  if (rx <= 2) return;
  ctx.save();
  glow(ctx, x, y, rx * 1.3, P.main, 0.35);
  ctx.fillStyle = "#020005";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.2, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rgba(P.main, 0.85);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const p = (t * 0.05 + k / 3) % 1;
    ctx.strokeStyle = rgba(P.main, 0.5 * (1 - p));
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(x, y, rx * p, rx * 0.2 * p, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}
function anEyes(ctx, x, y, s, a, color) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  glow(ctx, x, y, s * 4, color, 0.4);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(x + side * s * 1.5, y);
    ctx.rotate(side * -0.28);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, s, s * 0.34, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.14, s * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
function anStormCloud(ctx, cx, cy, r, a, t, P) {
  if (a <= 0) return;
  const R = seeded(404);
  ctx.save();
  ctx.globalAlpha = Math.min(1, a);
  for (let k = 0; k < 16; k++) {
    const px = cx + (R() - 0.5) * r * 2.2, py = cy + (R() - 0.5) * r * 0.5, rr = r * (0.35 + R() * 0.4);
    const g = ctx.createRadialGradient(px, py - rr * 0.3, 0, px, py, rr);
    g.addColorStop(0, k % 4 ? "rgba(30,27,75,0.95)" : "rgba(76,29,149,0.9)");
    g.addColorStop(1, "rgba(15,10,40,0)");
    ctx.fillStyle = g;
    ctx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  // éclairs dans la nuée
  const f = seeded(t * 31 + 7)();
  if (f > 0.45) glow(ctx, cx + (f - 0.7) * r * 2, cy, r * 0.8, P.main, 0.5 * a);
  ctx.restore();
}
function anCracks(ctx, w, h, q, seed, color) {
  if (q <= 0) return;
  const R = seeded(seed), cx = (R() - 0.5) * w * 0.3, cy = (R() - 0.5) * h * 0.3;
  ctx.save();
  ctx.lineJoin = "round";
  for (let k = 0; k < 8; k++) {
    let px = cx, py = cy;
    const a = (k / 8) * TAU + R() * 0.4, steps = 6, pts = [[px, py]];
    for (let s = 0; s < steps; s++) {
      px += Math.cos(a + (R() - 0.5) * 1.1) * (w / 10);
      py += Math.sin(a + (R() - 0.5) * 1.1) * (h / 10);
      pts.push([px, py]);
    }
    const shown = Math.max(1, Math.round(pts.length * q));
    for (const [lw, col] of [[7, rgba(color, 0.55)], [2, "#ffffff"]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.slice(0, shown).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  }
  ctx.restore();
}
// éclair noir des coups critiques : zigzags noirs bordés de couleur, distorsion de l'espace
function anBlackFlash(ctx, x, y, q, seed, accent) {
  if (q >= 1) return;
  const R = seeded(seed), e = anOutExpo(Math.min(1, q * 1.6));
  ctx.save();
  ctx.globalAlpha = 1 - q * 0.8;
  for (let k = 0; k < 7; k++) {
    const a = R() * TAU, len = (110 + R() * 170) * e, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len * 0.8, s = seed * 3 + k;
    anBolt(ctx, x, y, ex, ey, s, 7, accent, 0.22, 2, "source-over");
    anBolt(ctx, x, y, ex, ey, s, 3.2, "#000000", 0.22, 2, "source-over");
  }
  const r = 40 + 230 * anOutExpo(q);
  ctx.globalAlpha = 1 - q;
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 9 * (1 - q) + 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.75, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.92, r * 0.69, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
function anGuardSparks(ctx, x, y, q, seed) {
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  glow(ctx, x, y, 120, "#60a5fa", 0.8 * (1 - q));
  ctx.restore();
  anSparks(ctx, x, y, q, seed, 22, 150, ["#ffffff", "#93c5fd", "#60a5fa"], 3, 60);
}
function anShieldShards(ctx, x, y, q, seed) {
  if (q >= 1) return;
  const R = seeded(seed);
  ctx.save();
  ctx.globalAlpha = 1 - q;
  for (let k = 0; k < 16; k++) {
    const a = R() * TAU, d = (60 + R() * 200) * anOutExpo(q), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9 + 160 * q * q, s = 9 + R() * 9;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(q * 9 * (R() - 0.5));
    ctx.beginPath();
    for (let j = 0; j < 6; j++) ctx.lineTo(Math.cos((j * TAU) / 6) * s, Math.sin((j * TAU) / 6) * s);
    ctx.closePath();
    ctx.fillStyle = "rgba(147,197,253,0.45)";
    ctx.fill();
    ctx.strokeStyle = "#dbeafe";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
// éclats en étoile autour du point d'impact (images d'impact)
function anImpactSpikes(ctx, x, y, mode, seed) {
  const R = seeded(seed), ink = mode === "neg" ? "#000000" : "#ffffff";
  ctx.save();
  ctx.fillStyle = ink;
  for (let k = 0; k < 18; k++) {
    const a = R() * TAU, r0 = 30 + R() * 50, len = 260 + R() * 520, w = 0.02 + R() * 0.06;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a - w) * r0, y + Math.sin(a - w) * r0);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.lineTo(x + Math.cos(a + w) * r0, y + Math.sin(a + w) * r0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = ink;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(x, y, 34 + R() * 20, 0, TAU);
  ctx.stroke();
  ctx.restore();
}
// aberration chromatique : le rouge et le bleu se décalent
function anAberration(ctx, k, w, h) {
  if (k < 1) return;
  const img = ctx.getImageData(0, 0, w, h), d = img.data, src = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let x = 0; x < w; x++) {
      const i = row + x * 4;
      d[i] = src[row + Math.min(w - 1, x + k) * 4];
      d[i + 2] = src[row + Math.max(0, x - k) * 4 + 2];
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- textes ----------
// onomatopée façon manga : lettres décalées, contour noir épais, liseré blanc, dégradé de l'astre
function anSfx(ctx, text, x, y, size, P, q, seed, rot = -0.12) {
  if (q < 0 || q > 1) return;
  const R = seeded(seed), pop = q < 0.18 ? 1.75 - 0.75 * anOutExpo(q / 0.18) : 1 + (q - 0.18) * 0.1, a = q > 0.72 ? 1 - (q - 0.72) / 0.28 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(pop, pop);
  ctx.font = `${size}px CardBold`;
  ctx.lineJoin = "round";
  ctx.textAlign = "center";
  const chars = [...text], widths = chars.map((ch) => ctx.measureText(ch).width * 0.9), total = widths.reduce((s, w) => s + w, 0);
  let cx = -total / 2;
  chars.forEach((ch, k) => {
    const w = widths[k], jy = (R() - 0.5) * size * 0.24, jr = (R() - 0.5) * 0.32, js = 0.84 + R() * 0.36;
    ctx.save();
    ctx.translate(cx + w / 2, jy);
    ctx.rotate(jr);
    ctx.scale(js, js);
    const g = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.1);
    g.addColorStop(0, P.light);
    g.addColorStop(0.5, P.main);
    g.addColorStop(1, P.accent);
    ctx.lineWidth = size * 0.24;
    ctx.strokeStyle = "#000000";
    ctx.strokeText(ch, 0, 0);
    ctx.lineWidth = size * 0.09;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(ch, 0, 0);
    ctx.fillStyle = g;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    cx += w;
  });
  ctx.restore();
}
const AN_DMG = { normal: [62, "#ffffff", "#fde68a", "#f97316"], crit: [90, "#ffffff", "#fca5a5", "#dc2626"], super: [82, "#ffffff", "#fef08a", "#eab308"], weak: [44, "#f8fafc", "#cbd5e1", "#64748b"], counter: [52, "#ffffff", "#bfdbfe", "#2563eb"] };
function anDamage(ctx, n, x, y, q, kind) {
  const [size, c1, c2, c3] = AN_DMG[kind] ?? AN_DMG.normal, pop = q < 0.12 ? 1.9 - 0.9 * anOutExpo(q / 0.12) : 1, a = q > 0.78 ? 1 - (q - 0.78) / 0.22 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.transform(1, 0, -0.22, 1, 0, 0);
  ctx.font = `${size}px CardBold`;
  ctx.textAlign = "center";
  ctx.lineJoin = "round";
  const txt = `−${n}`;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillText(txt, 5, 6);
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = "#000000";
  ctx.strokeText(txt, 0, 0);
  const g = ctx.createLinearGradient(0, -size * 0.75, 0, size * 0.05);
  g.addColorStop(0, c1);
  g.addColorStop(0.45, c2);
  g.addColorStop(1, c3);
  ctx.fillStyle = g;
  ctx.fillText(txt, 0, 0);
  ctx.restore();
}
// étiquette : bandeau noir incliné, texte coloré
function anTag(ctx, text, x, y, size, color, q) {
  if (q < 0 || q > 1) return;
  const pop = q < 0.15 ? 1.5 - 0.5 * anOutExpo(q / 0.15) : 1, a = q > 0.75 ? 1 - (q - 0.75) / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.translate(x, y);
  ctx.scale(pop, pop);
  ctx.rotate(-0.05);
  ctx.font = `${size}px CardBold`;
  const w = ctx.measureText(text).width + size;
  ctx.fillStyle = "rgba(0,0,0,0.88)";
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 8, -size * 0.85);
  ctx.lineTo(w / 2 + 8, -size * 0.85);
  ctx.lineTo(w / 2 - 8, size * 0.35);
  ctx.lineTo(-w / 2 - 8, size * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// ---------- territoires des astres (décors entiers, dessinés une fois) ----------
const AN_REALM_PAINT = {
  soleil(ctx, W, H, R, hz) {
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#0f0200");
    sky.addColorStop(0.55, "#5c1304");
    sky.addColorStop(1, "#f97316");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    const sx = W / 2, sy = hz * 0.48, r = 118;
    glow(ctx, sx, sy, r * 3.4, "#fb923c", 0.55);
    ctx.save();
    ctx.translate(sx, sy);
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * TAU + R() * 0.05, len = r * (1.2 + R() * (k % 3 ? 0.5 : 1.4)), w = 0.01 + R() * 0.02;
      ctx.fillStyle = k % 2 ? "rgba(254,243,199,0.5)" : "rgba(251,146,60,0.5)";
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - w) * r, Math.sin(a - w) * r);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + w) * r, Math.sin(a + w) * r);
      ctx.fill();
    }
    const cor = ctx.createRadialGradient(0, 0, r * 0.95, 0, 0, r * 1.4);
    cor.addColorStop(0, "rgba(255,251,235,1)");
    cor.addColorStop(0.3, "rgba(253,224,71,0.8)");
    cor.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.4, 0, TAU);
    ctx.fill();
    disc(ctx, 0, 0, r, "#080100");
    ctx.strokeStyle = "#fff7d6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#170300";
    ctx.beginPath();
    ctx.moveTo(0, hz);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, hz - 18 - R() * 50 - (Math.sin(x * 0.012) + 1) * 26);
    ctx.lineTo(W, hz);
    ctx.fill();
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#3b0d02");
    gr.addColorStop(1, "#0a0200");
    ctx.fillStyle = gr;
    ctx.fillRect(0, hz, W, H - hz);
    const hb = ctx.createLinearGradient(0, hz - 20, 0, hz + 50);
    hb.addColorStop(0, "rgba(251,146,60,0)");
    hb.addColorStop(0.4, "rgba(251,146,60,0.45)");
    hb.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = hb;
    ctx.fillRect(0, hz - 20, W, 70);
    // sol de lave craquelé
    for (let k = 0; k < 30; k++) {
      let x = W / 2 + (R() - 0.5) * 240, y = hz + 4;
      const a = Math.PI / 2 + (R() - 0.5) * 2.6, pts = [[x, y]];
      for (let s = 0; s < 9; s++) {
        x += Math.cos(a + (R() - 0.5) * 0.9) * (14 + s * 4);
        y += Math.abs(Math.sin(a + (R() - 0.5) * 0.9)) * (6 + s * 3);
        pts.push([x, y]);
      }
      for (const [lw, col] of [[9, "rgba(249,115,22,0.22)"], [2.2, "#fdba74"]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
        ctx.stroke();
      }
    }
  },
  givre(ctx, W, H, R, hz) {
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#020617");
    sky.addColorStop(0.6, "#0c4a6e");
    sky.addColorStop(1, "#a5f3fc");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    for (let k = 0; k < 160; k++) {
      ctx.globalAlpha = 0.3 + R() * 0.7;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(R() * W, R() * hz * 0.6, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;
    // aurores boréales
    for (const [band, col] of [[0, "#34d399"], [1, "#22d3ee"], [2, "#a78bfa"]]) {
      for (let x = 0; x < W; x += 3) {
        const y = hz * 0.16 + band * 34 + Math.sin(x * 0.006 + band * 1.7) * 32 + Math.sin(x * 0.017 + band) * 10, h = 70 + Math.sin(x * 0.02 + band * 3) * 30 + 30;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, rgba(col, 0));
        g.addColorStop(0.35, rgba(col, 0.22));
        g.addColorStop(1, rgba(col, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, y, 3, h);
      }
    }
    // flèches de glace à l'horizon
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < 13; k++) {
        const x = R() * W, h = (pass ? 120 : 70) + R() * (pass ? 170 : 90), w = 28 + R() * 46;
        const g = ctx.createLinearGradient(0, hz - h, 0, hz);
        g.addColorStop(0, pass ? "#e0f2fe" : "#7dd3fc");
        g.addColorStop(1, pass ? "#0e7490" : "#164e63");
        ctx.fillStyle = g;
        ctx.globalAlpha = pass ? 0.92 : 0.7;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, hz);
        ctx.lineTo(x - w * 0.3, hz - h * 0.7);
        ctx.lineTo(x + (R() - 0.5) * 8, hz - h);
        ctx.lineTo(x + w * 0.35, hz - h * 0.6);
        ctx.lineTo(x + w / 2, hz);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.55)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#7dd3fc");
    gr.addColorStop(0.35, "#0c4a6e");
    gr.addColorStop(1, "#020617");
    ctx.fillStyle = gr;
    ctx.fillRect(0, hz, W, H - hz);
    for (let k = 0; k < 70; k++) {
      ctx.fillStyle = `rgba(255,255,255,${0.05 + R() * 0.18})`;
      ctx.fillRect(R() * W, hz + R() * (H - hz), 30 + R() * 160, 1.5);
    }
  },
  orage(ctx, W, H, R, hz) {
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#04010c");
    sky.addColorStop(0.6, "#1e0b3a");
    sky.addColorStop(1, "#4c1d95");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    for (let k = 0; k < 4; k++) {
      const x = 100 + R() * (W - 200);
      anBolt(ctx, x, 0, x + (R() - 0.5) * 200, hz, k * 91 + 3, 2.5, "#c4b5fd", 0.18, 2);
    }
    for (let k = 0; k < 80; k++) {
      const x = R() * W, y = R() * hz * 0.6, rx = 70 + R() * 170, ry = 24 + R() * 50;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, k % 5 ? "rgba(17,10,40,0.9)" : "rgba(91,33,182,0.55)");
      g.addColorStop(1, "rgba(17,10,40,0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      ctx.translate(-x, -y);
      ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
    const hb = ctx.createLinearGradient(0, hz - 60, 0, hz + 30);
    hb.addColorStop(0, "rgba(139,92,246,0)");
    hb.addColorStop(0.7, "rgba(139,92,246,0.35)");
    hb.addColorStop(1, "rgba(139,92,246,0)");
    ctx.fillStyle = hb;
    ctx.fillRect(0, hz - 60, W, 90);
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#1a0b33");
    gr.addColorStop(1, "#030108");
    ctx.fillStyle = gr;
    ctx.fillRect(0, hz, W, H - hz);
    for (let k = 0; k < 22; k++) {
      const x = R() * W, y = hz + 20 + R() * (H - hz - 30), rx = 30 + R() * 110;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
      g.addColorStop(0, "rgba(167,139,250,0.28)");
      g.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, 0.18);
      ctx.translate(-x, -y);
      ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
      ctx.restore();
    }
  },
  etoile(ctx, W, H, R, hz) {
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#02000a");
    sky.addColorStop(0.6, "#160a3a");
    sky.addColorStop(1, "#33106b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const [x, y, r, col] of [[0.2, 0.3, 300, "#ec4899"], [0.75, 0.25, 340, "#8b5cf6"], [0.5, 0.55, 260, "#22d3ee"], [0.9, 0.6, 200, "#f59e0b"], [0.1, 0.65, 220, "#6366f1"]]) glow(ctx, W * x, hz * y, r, col, 0.32);
    ctx.restore();
    for (let k = 0; k < 700; k++) {
      ctx.globalAlpha = 0.25 + R() * 0.75;
      ctx.fillStyle = R() < 0.15 ? "#fde68a" : "#ffffff";
      const s = R() < 0.9 ? 1.2 : 2.2;
      ctx.fillRect(R() * W, R() * hz, s, s);
    }
    ctx.globalAlpha = 1;
    for (let k = 0; k < 30; k++) {
      const x = R() * W, y = R() * hz * 0.9;
      glow(ctx, x, y, 14, "#fde68a", 0.6);
      sparkle(ctx, x, y, 2 + R() * 2.5, "#ffffff");
    }
    // constellations
    for (let g = 0; g < 6; g++) {
      const cx = R() * W, cy = R() * hz * 0.75, pts = Array.from({ length: 4 + Math.floor(R() * 3) }, () => [cx + (R() - 0.5) * 220, cy + (R() - 0.5) * 120]);
      ctx.strokeStyle = "rgba(253,230,138,0.4)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      pts.forEach(([x, y]) => disc(ctx, x, y, 2.4, "#fef3c7"));
    }
    const bx = W / 2, by = hz * 0.32;
    glow(ctx, bx, by, 170, "#fde68a", 0.7);
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate((k * Math.PI) / 4);
      const g = ctx.createLinearGradient(-260, 0, 260, 0);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.9)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-260, -1.5, 520, 3);
      ctx.restore();
    }
    sparkle(ctx, bx, by, 14, "#ffffff");
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#2a1260");
    gr.addColorStop(1, "#05010f");
    ctx.fillStyle = gr;
    ctx.fillRect(0, hz, W, H - hz);
    ctx.strokeStyle = "rgba(253,224,71,0.22)";
    ctx.lineWidth = 1.2;
    for (let k = 1; k <= 12; k++) {
      const y = hz + (H - hz) * (k / 12) ** 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let k = -14; k <= 14; k++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + k * 14, hz);
      ctx.lineTo(W / 2 + k * 120, H);
      ctx.stroke();
    }
  },
  ombre(ctx, W, H, R, hz) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    for (const [x, y, r] of [[0.15, 0.95, 420], [0.85, 0.95, 420], [0.5, 0.62, 520]]) glow(ctx, W * x, H * y, r, "#4c1d95", 0.32);
    // l'œil du néant
    const ex = W / 2, ey = hz * 0.42, ew = 230, eh = 70;
    glow(ctx, ex, ey, 300, "#7f1d1d", 0.45);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ex - ew, ey);
    ctx.quadraticCurveTo(ex, ey - eh * 2, ex + ew, ey);
    ctx.quadraticCurveTo(ex, ey + eh * 2, ex - ew, ey);
    ctx.closePath();
    const sc = ctx.createRadialGradient(ex, ey, 10, ex, ey, ew);
    sc.addColorStop(0, "#3f0a0a");
    sc.addColorStop(1, "#0a0000");
    ctx.fillStyle = sc;
    ctx.fill();
    ctx.clip();
    glow(ctx, ex, ey, 110, "#ef4444", 0.9);
    disc(ctx, ex, ey, 52, "#b91c1c");
    const ir = ctx.createRadialGradient(ex, ey, 6, ex, ey, 52);
    ir.addColorStop(0, "#fca5a5");
    ir.addColorStop(0.5, "#dc2626");
    ir.addColorStop(1, "#450a0a");
    ctx.fillStyle = ir;
    ctx.beginPath();
    ctx.arc(ex, ey, 50, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 9, 46, 0, 0, TAU);
    ctx.fill();
    for (let k = 0; k < 18; k++) {
      ctx.strokeStyle = "rgba(220,38,38,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const a = R() * TAU;
      ctx.moveTo(ex + Math.cos(a) * 60, ey + Math.sin(a) * 60);
      ctx.lineTo(ex + Math.cos(a) * (120 + R() * 100), ey + Math.sin(a) * (60 + R() * 40));
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(167,139,250,0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex - ew, ey);
    ctx.quadraticCurveTo(ex, ey - eh * 2, ex + ew, ey);
    ctx.quadraticCurveTo(ex, ey + eh * 2, ex - ew, ey);
    ctx.stroke();
    // épines noires à l'horizon
    for (let k = 0; k < 26; k++) {
      const x = R() * W, h = 40 + R() * 200, w = 10 + R() * 30, lean = (R() - 0.5) * 60;
      ctx.fillStyle = "#020005";
      ctx.beginPath();
      ctx.moveTo(x - w, hz + 6);
      ctx.quadraticCurveTo(x - w * 0.2, hz - h * 0.5, x + lean, hz - h);
      ctx.quadraticCurveTo(x + w * 0.2, hz - h * 0.5, x + w, hz + 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(124,58,237,0.5)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.fillStyle = "#04000a";
    ctx.fillRect(0, hz, W, H - hz);
    glow(ctx, ex, hz + 70, 160, "#dc2626", 0.18);
    for (let k = 1; k < 14; k++) {
      ctx.strokeStyle = `rgba(139,92,246,${0.35 - k * 0.022})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(W / 2, hz + 150, k * 48, k * 11, 0, 0, TAU);
      ctx.stroke();
    }
  },
  lune(ctx, W, H, R, hz) {
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, "#01030f");
    sky.addColorStop(0.6, "#0b1033");
    sky.addColorStop(1, "#272a6b");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz);
    for (let k = 0; k < 320; k++) {
      ctx.globalAlpha = 0.25 + R() * 0.75;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(R() * W, R() * hz, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;
    const mx = W / 2, my = hz * 0.44, r = 150;
    glow(ctx, mx, my, r * 2.8, "#c7d2fe", 0.5);
    const mg = ctx.createRadialGradient(mx - r * 0.3, my - r * 0.3, 10, mx, my, r);
    mg.addColorStop(0, "#ffffff");
    mg.addColorStop(0.7, "#e2e8f0");
    mg.addColorStop(1, "#a5b4fc");
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx, my, r, 0, TAU);
    ctx.clip();
    for (let k = 0; k < 16; k++) {
      const cx = mx + (R() - 0.5) * r * 1.7, cy = my + (R() - 0.5) * r * 1.7, cr = 6 + R() * 26;
      disc(ctx, cx, cy, cr, `rgba(100,116,139,${0.12 + R() * 0.18})`);
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx - 1, cy - 1, cr, Math.PI, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    // îles lointaines
    ctx.fillStyle = "#04061a";
    for (let k = 0; k < 5; k++) {
      const x = R() * W, w = 90 + R() * 220, h = 14 + R() * 40;
      ctx.beginPath();
      ctx.ellipse(x, hz, w, h, 0, Math.PI, TAU);
      ctx.fill();
    }
    const gr = ctx.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, "#151a4a");
    gr.addColorStop(1, "#01030c");
    ctx.fillStyle = gr;
    ctx.fillRect(0, hz, W, H - hz);
    // chemin de lune sur l'eau
    for (let k = 0; k < 70; k++) {
      const y = hz + 3 + k * ((H - hz) / 70), w = 18 + k * 3.4;
      ctx.fillStyle = `rgba(224,231,255,${0.55 * (1 - k / 80)})`;
      ctx.fillRect(mx - w / 2 + (R() - 0.5) * w * 0.4, y, w * (0.3 + R() * 0.6), 2);
    }
    // roseaux
    ctx.strokeStyle = "#010208";
    ctx.lineWidth = 3;
    for (const side of [0, 1]) {
      for (let k = 0; k < 22; k++) {
        const x = side ? W - R() * 170 : R() * 170, h = 80 + R() * 160, lean = (R() - 0.5) * 50;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.quadraticCurveTo(x + lean * 0.3, H - h * 0.6, x + lean, H - h);
        ctx.stroke();
      }
    }
  },
};
function anRealm(astre) {
  return anCached(`territoire:${astre}`, () => {
    const c = createCanvas(AN_BW, AN_BH), ctx = c.getContext("2d");
    (AN_REALM_PAINT[astre] ?? AN_REALM_PAINT.etoile)(ctx, AN_BW, AN_BH, seeded(hashOf(astre) + 99), AN_BH * 0.6);
    return c;
  });
}
// particules vivantes du territoire (repère du monde)
function anRealmParticles(ctx, astre, t) {
  const R = seeded(hashOf(astre) + 5), X0 = -AN_MX, Y0 = -AN_MY;
  ctx.save();
  if (astre === "soleil") {
    for (let k = 0; k < 55; k++) {
      const x = X0 + R() * AN_BW + Math.sin(t * 0.15 + k) * 12, sp = 2 + R() * 5, y = Y0 + ((R() * AN_BH - t * sp + AN_BH * 10) % AN_BH);
      disc(ctx, x, y, 1.2 + R() * 2.4, k % 3 ? "#fdba74" : "#fef3c7");
    }
  } else if (astre === "givre") {
    for (let k = 0; k < 80; k++) {
      const sp = 1.5 + R() * 3, x = X0 + ((R() * AN_BW + t * sp * 0.6) % AN_BW), y = Y0 + ((R() * AN_BH + t * sp) % AN_BH);
      ctx.globalAlpha = 0.5 + R() * 0.5;
      disc(ctx, x, y, 1 + R() * 2.2, "#ffffff");
    }
  } else if (astre === "orage") {
    ctx.strokeStyle = "rgba(196,181,253,0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < 110; k++) {
      const sp = 14 + R() * 10, x = X0 + ((R() * AN_BW - t * sp * 0.3 + AN_BW * 10) % AN_BW), y = Y0 + ((R() * AN_BH + t * sp) % AN_BH);
      ctx.moveTo(x, y);
      ctx.lineTo(x - 5, y + 18);
    }
    ctx.stroke();
  } else if (astre === "etoile") {
    for (let k = 0; k < 45; k++) {
      const x = X0 + R() * AN_BW, y = Y0 + R() * AN_BH * 0.75, s = 1 + 2.6 * Math.abs(Math.sin(t * 0.3 + k * 1.7));
      sparkle(ctx, x, y, s, k % 4 ? "#ffffff" : "#fde68a");
    }
  } else if (astre === "ombre") {
    for (let k = 0; k < 60; k++) {
      const x = X0 + R() * AN_BW + Math.sin(t * 0.1 + k) * 16, sp = 0.8 + R() * 1.6, y = Y0 + ((R() * AN_BH - t * sp + AN_BH * 10) % AN_BH), s = 1.5 + R() * 3;
      ctx.fillStyle = k % 7 ? "rgba(91,33,182,0.8)" : "rgba(239,68,68,0.9)";
      ctx.fillRect(x, y, s, s);
    }
  } else {
    for (let k = 0; k < 34; k++) {
      const x = X0 + R() * AN_BW + Math.sin(t * 0.12 + k) * 20, y = Y0 + AN_BH * 0.45 + R() * AN_BH * 0.5 + Math.cos(t * 0.1 + k) * 10, a = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.2 + k));
      glow(ctx, x, y, 9, "#e0e7ff", a * 0.8);
      disc(ctx, x, y, 1.5, "#ffffff");
    }
  }
  ctx.restore();
}

// ---------- effets propres à chaque astre (repère du monde) ----------
// charge(x, y : la carte), release(x1, y1 → x2, y2), hit(x, y), trail(points de la ruée)
const ASTRE_ANIM = {
  soleil: {
    charge(ctx, x, y, q, t, P) {
      const ox = x, oy = y - 178, r = 8 + 46 * ease.out(q);
      for (let k = 0; k < 3; k++) {
        const p = (t * 0.07 + k / 3) % 1;
        ctx.strokeStyle = rgba(P.main, (1 - p) * 0.6 * q);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y + AN_CH / 2 + 6, 50 + p * 130, 9 + p * 22, 0, 0, TAU);
        ctx.stroke();
      }
      const R = seeded(77);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let k = 0; k < 44; k++) {
        const a0 = R() * TAU, d0 = 140 + R() * 220, sp = 0.6 + R() * 0.8, p = (t * 0.035 * sp + R()) % 1, a = a0 + p * 3, d = d0 * (1 - p) * (0.4 + 0.6 * q) + 10;
        disc(ctx, ox + Math.cos(a) * d, oy + Math.sin(a) * d * 0.8, 1.5 + R() * 2.6, k % 3 ? P.main : P.light);
      }
      glow(ctx, ox, oy, r * 4.2, P.main, 0.75 * q);
      ctx.translate(ox, oy);
      ctx.rotate(t * 0.08);
      for (let k = 0; k < 18; k++) {
        ctx.rotate(TAU / 18);
        const len = r * (1.5 + 0.5 * Math.sin(t * 0.5 + k));
        ctx.fillStyle = rgba(k % 2 ? P.light : P.main, 0.85 * q);
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.85);
        ctx.lineTo(0, -len);
        ctx.lineTo(r * 0.22, -r * 0.85);
        ctx.fill();
      }
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.45, P.light);
      g.addColorStop(0.85, P.main);
      g.addColorStop(1, rgba(P.accent, 0.6));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const ox = x1, oy = y1 - 178, p = ease.in(anSeg(q, 0, 0.8));
      const pos = (pp) => ({ x: anLerp(ox, x2, pp), y: anLerp(oy, y2, pp) - Math.sin(pp * Math.PI) * 90 });
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      if (q < 0.86) {
        for (let k = 16; k >= 1; k--) {
          const c = pos(Math.max(0, p - k * 0.028)), rr = (48 - k * 2.2) * (0.9 + 0.2 * Math.sin(t + k));
          ctx.fillStyle = rgba(k < 4 ? P.light : k < 10 ? P.main : P.accent, 0.5 * (1 - k / 17));
          ctx.beginPath();
          ctx.arc(c.x + Math.sin(t * 0.9 + k) * 6, c.y + Math.cos(t * 0.7 + k) * 6, Math.max(4, rr), 0, TAU);
          ctx.fill();
        }
        const c = pos(p), r = 52 + 10 * Math.sin(t * 0.8), R = seeded(seed + t);
        glow(ctx, c.x, c.y, r * 3.6, P.main, 0.85);
        for (let k = 0; k < 16; k++) {
          const a = R() * TAU, len = r * (1.2 + R() * 0.9);
          ctx.fillStyle = rgba(R() < 0.5 ? P.main : P.accent, 0.7);
          ctx.beginPath();
          ctx.moveTo(c.x + Math.cos(a - 0.3) * r * 0.7, c.y + Math.sin(a - 0.3) * r * 0.7);
          ctx.lineTo(c.x + Math.cos(a) * len, c.y + Math.sin(a) * len);
          ctx.lineTo(c.x + Math.cos(a + 0.3) * r * 0.7, c.y + Math.sin(a + 0.3) * r * 0.7);
          ctx.fill();
        }
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.45, P.light);
        g.addColorStop(1, rgba(P.main, 0.2));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(c.x, c.y, r, 0, TAU);
        ctx.fill();
      }
      if (q > 0.78) anFireBloom(ctx, x2, y2, anSeg(q, 0.78, 1), P, seed);
      ctx.restore();
    },
    hit(ctx, x, y, q, P, seed, big) {
      const R = seeded(seed), s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 170 * s, P.main, 0.85 * (1 - q));
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * TAU + R() * 0.3, len = (50 + R() * 80) * s * anOutExpo(q) + 20, w = 15 * s * (1 - q * 0.6);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a);
        ctx.globalAlpha = 1 - q;
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.4, P.light);
        g.addColorStop(1, rgba(P.accent, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -w / 2);
        ctx.quadraticCurveTo(len * 0.6, -w, len, 0);
        ctx.quadraticCurveTo(len * 0.6, w, 0, w / 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      anSparks(ctx, x, y, q, seed + 1, 26, 220 * s, [P.light, P.main, "#ffffff"], 3);
    },
    trail(ctx, pts, dir, t, P) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      pts.forEach((p, k) => {
        for (let j = 0; j < 4; j++) {
          const px = p.x - dir * j * 18, py = p.y + Math.sin(t + j + k) * 30, r = (40 - j * 8) * (1 - k * 0.15);
          if (r > 0) glow(ctx, px, py, r * 1.6, j < 2 ? P.main : P.accent, 0.5 * (1 - k * 0.18));
        }
      });
      ctx.restore();
    },
  },
  givre: {
    charge(ctx, x, y, q, t, P) {
      const gy = y + AN_CH / 2 + 4, R = seeded(31);
      ctx.fillStyle = rgba(P.light, 0.35 * q);
      ctx.beginPath();
      ctx.ellipse(x, gy, 140 * q + 1, 22 * q + 1, 0, 0, TAU);
      ctx.fill();
      for (let k = 0; k < 11; k++) {
        const e = ease.out(anSeg(q, k * 0.04, k * 0.04 + 0.45)), bx = x + (k - 5) * 30 + (R() - 0.5) * 10, len = (40 + R() * 90) * e;
        anCrystal(ctx, bx, gy + 4, (k - 5) * 0.16, len, 16 + R() * 14, P);
      }
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 200, P.main, 0.35 * q);
      for (let k = 0; k < 30; k++) {
        const a = R() * TAU, d0 = 160 + R() * 200, p = (t * 0.03 + R()) % 1, d = d0 * (1 - p);
        sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1.4 + R() * 2, "#ffffff");
      }
      ctx.restore();
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const gy = y2 + AN_CH / 2 - 4, dir = Math.sign(x2 - x1) || 1, N = 12, start = x1 + dir * 80;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, anLerp(start, x2, Math.min(1, q * 1.3)), gy - 30, 160, P.main, 0.4);
      ctx.restore();
      for (let k = 0; k < N; k++) {
        const tk = (k / (N - 1)) * 0.55, e = ease.back(anSeg(q, tk, tk + 0.16));
        if (e <= 0) continue;
        const px = anLerp(start, x2 - dir * 20, k / (N - 1)), h = (55 + k * 15) * Math.min(1.1, e);
        anCrystal(ctx, px - 14, gy + 6, dir * 0.4 - 0.15, h * 0.7, 20 + k, P);
        anCrystal(ctx, px, gy + 6, dir * 0.28, h, 26 + k * 2, P);
      }
      if (q > 0.62) {
        const e = ease.out(anSeg(q, 0.62, 0.84)), w = AN_CW * 0.75 * e, h = AN_CH * 0.72 * e;
        ctx.save();
        ctx.globalAlpha = Math.min(1, e * 1.2);
        ctx.beginPath();
        ctx.moveTo(x2, y2 - h);
        ctx.lineTo(x2 + w, y2 - h * 0.45);
        ctx.lineTo(x2 + w * 0.92, y2 + h * 0.85);
        ctx.lineTo(x2, y2 + h);
        ctx.lineTo(x2 - w * 0.92, y2 + h * 0.85);
        ctx.lineTo(x2 - w, y2 - h * 0.45);
        ctx.closePath();
        ctx.fillStyle = rgba(P.accent, 0.32);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.45)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x2, y2 - h);
        ctx.lineTo(x2, y2 + h);
        ctx.moveTo(x2 - w, y2 - h * 0.45);
        ctx.lineTo(x2 + w * 0.92, y2 + h * 0.85);
        ctx.moveTo(x2 + w, y2 - h * 0.45);
        ctx.lineTo(x2 - w * 0.92, y2 + h * 0.85);
        ctx.stroke();
        ctx.restore();
      }
    },
    hit(ctx, x, y, q, P, seed, big) {
      const R = seeded(seed), s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 160 * s, P.light, 0.9 * (1 - q));
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 1 - q;
      for (let k = 0; k < 18; k++) {
        const a = R() * TAU, d = (40 + R() * 200) * s * anOutExpo(q), px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85 + 90 * q * q, len = (12 + R() * 22) * s;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a + q * 6 * (R() - 0.5));
        ctx.beginPath();
        ctx.moveTo(len, 0);
        ctx.lineTo(-len * 0.4, -len * 0.3);
        ctx.lineTo(-len * 0.4, len * 0.3);
        ctx.closePath();
        ctx.fillStyle = k % 2 ? "#ffffff" : P.accent;
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      anGroundRing(ctx, x, y + AN_CH / 2, q, P.light, 200 * s);
    },
    trail(ctx, pts, dir, t, P) {
      pts.forEach((p, k) => {
        const R = seeded(k * 13 + t);
        for (let j = 0; j < 5; j++) sparkle(ctx, p.x - dir * R() * 60, p.y + (R() - 0.5) * AN_CH, 1.5 + R() * 2.5, j % 2 ? "#ffffff" : P.accent);
      });
    },
  },
  orage: {
    charge(ctx, x, y, q, t, P) {
      anStormCloud(ctx, x, y - 225, 150 * (0.4 + 0.6 * q), q, t, P);
      const R = seeded(t * 13 + 5);
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 210, P.main, 0.45 * q);
      ctx.restore();
      for (let k = 0; k < 2 + Math.round(q * 4); k++) {
        const a1 = R() * TAU, a2 = a1 + 0.7 + R() * 1.3;
        anBolt(ctx, x + Math.cos(a1) * 105, y + Math.sin(a1) * 140, x + Math.cos(a2) * 105, y + Math.sin(a2) * 140, t * 7 + k, 2.6, k % 2 ? P.accent : P.light, 0.25);
      }
      if (q > 0.45 && t % 2) anBolt(ctx, x, y - 125, x + (R() - 0.5) * 50, y - 215, t * 3 + 1, 3.5, P.light, 0.22, 1);
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const cx = x2, cy = y2 - 250;
      anStormCloud(ctx, cx, cy, 200, Math.min(1, 0.4 + q * 2), t, P);
      if (q < 0.42 && t % 2) anBolt(ctx, x1, y1 - 110, anLerp(x1, cx, 0.5), cy + 10, seed + t, 4, P.light, 0.2, 1);
      if (q >= 0.4) {
        const fade = 1 - anSeg(q, 0.66, 1), w = 18 * fade + 3;
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0);
        g.addColorStop(0, rgba(P.main, 0));
        g.addColorStop(0.5, rgba(P.light, 0.65 * fade));
        g.addColorStop(1, rgba(P.main, 0));
        ctx.fillStyle = g;
        ctx.fillRect(cx - 90, cy, 180, y2 + AN_CH / 2 - cy);
        ctx.restore();
        anBolt(ctx, cx, cy + 20, x2, y2 + 30, seed + (t >> 1), w, P.light, 0.14, 4);
        anBolt(ctx, cx + 20, cy + 30, x2 - 10, y2 + 10, seed + 77 + (t >> 1), w * 0.5, P.accent, 0.18, 2);
      }
      if (q > 0.55) {
        const R = seeded(seed + t);
        for (let k = 0; k < 6; k++) {
          const a1 = R() * TAU, a2 = a1 + 0.9;
          anBolt(ctx, x2 + Math.cos(a1) * 115, y2 + Math.sin(a1) * 150, x2 + Math.cos(a2) * 115, y2 + Math.sin(a2) * 150, seed + k + t, 3, P.accent, 0.25);
        }
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.ellipse(x2, y2 + AN_CH / 2 + 6, 120, 22, 0, 0, TAU);
        ctx.fill();
      }
    },
    hit(ctx, x, y, q, P, seed, big) {
      const R = seeded(seed), s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 170 * s, P.main, 0.9 * (1 - q));
      ctx.restore();
      if (q < 0.7)
        for (let k = 0; k < 9; k++) {
          const a = R() * TAU, len = (80 + R() * 90) * s * (0.5 + q);
          anBolt(ctx, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, seed + k * 11 + Math.round(q * 6), 3.2 * s, k % 2 ? P.accent : P.light, 0.3);
        }
      anSparks(ctx, x, y, q, seed + 3, 24, 200 * s, [P.accent, "#ffffff", P.main], 2.5, 40);
    },
    trail(ctx, pts, dir, t, P) {
      for (let k = 0; k + 1 < pts.length; k++) anBolt(ctx, pts[k].x, pts[k].y, pts[k + 1].x, pts[k + 1].y + 10, t * 5 + k, 3, P.accent, 0.3);
    },
  },
  etoile: {
    charge(ctx, x, y, q, t, P) {
      const n = 7, rad = 138, cy0 = y - 10;
      const pts = Array.from({ length: n }, (_, k) => {
        const a = -Math.PI / 2 + (k / n) * TAU + t * 0.012;
        return [x + Math.cos(a) * rad, cy0 + Math.sin(a) * rad * 0.95];
      });
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, cy0, 230, P.main, 0.45 * q);
      const lines = ease.inOut(anSeg(q, 0.25, 0.92)) * n;
      ctx.strokeStyle = rgba(P.light, 0.9);
      ctx.lineWidth = 2.6;
      for (let k = 0; k < n; k++) {
        const part = Math.max(0, Math.min(1, lines - k));
        if (part <= 0) continue;
        const [ax, ay] = pts[k], [bx, by] = pts[(k + 3) % n];
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(anLerp(ax, bx, part), anLerp(ay, by, part));
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(P.main, 0.5 * q);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, cy0, rad, rad * 0.95, 0, 0, TAU);
      ctx.stroke();
      pts.forEach(([px, py], k) => {
        const e = anSeg(q, k * 0.04, k * 0.04 + 0.2);
        if (e <= 0) return;
        glow(ctx, px, py, 32, P.main, 0.85 * e);
        sparkle(ctx, px, py, 3 + 4 * e * (0.7 + 0.3 * Math.sin(t * 0.6 + k)), "#ffffff");
      });
      const R = seeded(19);
      for (let k = 0; k < 30; k++) {
        const a = R() * TAU, d0 = 120 + R() * 220, p = (t * 0.03 + R()) % 1, d = d0 * (1 - p);
        sparkle(ctx, x + Math.cos(a) * d, cy0 + Math.sin(a) * d * 0.8, 1 + R() * 2, k % 3 ? P.light : P.accent);
      }
      ctx.restore();
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const R = seeded(seed), dirx = Math.sign(x2 - x1) || 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (let k = 0; k < 10; k++) {
        const delay = k * 0.06, p = anSeg(q, delay, delay + 0.32);
        const sx = x2 - dirx * (380 + R() * 260), sy = -130 - R() * 120, ex = x2 + (R() - 0.5) * 110, ey = y2 + (R() - 0.5) * 120;
        if (p <= 0) continue;
        if (p < 1) {
          const hx = anLerp(sx, ex, ease.in(p)), hy = anLerp(sy, ey, ease.in(p)), ang = Math.atan2(ey - sy, ex - sx), len = 270;
          ctx.save();
          ctx.translate(hx, hy);
          ctx.rotate(ang);
          const g = ctx.createLinearGradient(-len, 0, 0, 0);
          g.addColorStop(0, rgba(P.accent, 0));
          g.addColorStop(0.7, rgba(P.main, 0.75));
          g.addColorStop(1, "#ffffff");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(-len, 0);
          ctx.lineTo(0, -16);
          ctx.lineTo(8, 0);
          ctx.lineTo(0, 16);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          glow(ctx, hx, hy, 70, P.light, 0.95);
          disc(ctx, hx, hy, 9, "#ffffff");
        } else {
          const e = anSeg(q, delay + 0.32, delay + 0.48);
          if (e < 1) {
            glow(ctx, ex, ey, 80 * (1 - e) + 10, P.main, 1 - e);
            sparkle(ctx, ex, ey, 12 * (1 - e) + 2, "#ffffff");
          }
        }
      }
      if (q > 0.76) {
        const e = anSeg(q, 0.76, 1);
        fxRays(ctx, x2, y2, 1 - e * 0.4, P.main, 24, e);
        ctx.strokeStyle = rgba(P.light, 1 - e);
        ctx.lineWidth = 8 * (1 - e) + 1;
        ctx.beginPath();
        ctx.arc(x2, y2, 60 + 230 * anOutExpo(e), 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    },
    hit(ctx, x, y, q, P, seed, big) {
      const R = seeded(seed), s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 170 * s, P.main, 0.9 * (1 - q));
      const fl = (1 - q) * 300 * s;
      for (const a of [0, Math.PI / 2]) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + 0.2);
        const g = ctx.createLinearGradient(-fl, 0, fl, 0);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, "#ffffff");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(-fl, -2.5, fl * 2, 5);
        ctx.restore();
      }
      for (let k = 0; k < 14; k++) {
        const a = R() * TAU, d = (40 + R() * 170) * s * anOutExpo(q);
        sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.85, (3 + R() * 4) * (1 - q), k % 3 ? "#ffffff" : P.accent);
      }
      ctx.restore();
    },
    trail(ctx, pts, dir, t, P) {
      pts.forEach((p, k) => {
        const R = seeded(k * 7 + t);
        for (let j = 0; j < 6; j++) sparkle(ctx, p.x - dir * R() * 70, p.y + (R() - 0.5) * AN_CH * 0.9, (1 + R() * 3) * (1 - k * 0.15), j % 2 ? "#ffffff" : P.main);
      });
    },
  },
  ombre: {
    charge(ctx, x, y, q, t, P) {
      const gy = y + AN_CH / 2 + 4;
      anInkPool(ctx, x, gy, 160 * ease.out(q), P, t);
      for (let k = 0; k < 6; k++) {
        const bx = x + (k - 2.5) * 36, h = (130 + (k % 3) * 55) * ease.out(anSeg(q, k * 0.06, 0.7));
        anTendril(ctx, bx, gy - 2, h, Math.sin(t * 0.25 + k) * 0.55 + (k - 2.5) * 0.08, 15, P, k);
      }
      const R = seeded(11);
      for (let k = 0; k < 8; k++) {
        const ex = x + (R() - 0.5) * 420, ey = y + (R() - 0.65) * 260, s = 6 + R() * 5, e = anSeg(q, 0.25 + R() * 0.4, 1);
        anEyes(ctx, ex, ey, s, e * (0.65 + 0.35 * Math.sin(t * 0.4 + k)), P.accent);
      }
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const gy = y2 + AN_CH / 2 + 4, dir = Math.sign(x2 - x1) || 1;
      if (q < 0.4) {
        const e = anSeg(q, 0, 0.3), hx = anLerp(x1, x2, e);
        ctx.fillStyle = "rgba(2,0,5,0.85)";
        ctx.beginPath();
        ctx.ellipse((x1 + hx) / 2, gy, Math.abs(hx - x1) / 2 + 20, 12, 0, 0, TAU);
        ctx.fill();
      }
      anInkPool(ctx, x2, gy, 175 * ease.out(anSeg(q, 0.1, 0.35)), P, t);
      for (let k = 0; k < 8; k++) {
        const side = k % 2 ? 1 : -1, bx = x2 + side * (44 + (k >> 1) * 24), e = ease.out(anSeg(q, 0.2 + k * 0.03, 0.58 + k * 0.02));
        if (e <= 0) continue;
        anTendril(ctx, bx, gy, (150 + (k >> 1) * 42) * e, -side * (0.45 + 0.35 * e) + Math.sin(t * 0.3 + k) * 0.08, 18, P, k + 20);
      }
      if (q > 0.62) {
        const e = anSeg(q, 0.62, 1), r = e < 0.6 ? 150 * ease.out(e / 0.6) : 150 * (1 - ease.in((e - 0.6) / 0.4));
        ctx.strokeStyle = rgba(P.main, 0.7);
        ctx.lineWidth = 2;
        const R = seeded(seed + t);
        ctx.beginPath();
        for (let k = 0; k < 26; k++) {
          const a = R() * TAU;
          ctx.moveTo(x2 + Math.cos(a) * r * 1.9, y2 + Math.sin(a) * r * 1.9);
          ctx.lineTo(x2 + Math.cos(a) * r * 1.05, y2 + Math.sin(a) * r * 1.05);
        }
        ctx.stroke();
        disc(ctx, x2, y2, Math.max(0, r), "#000000");
        ctx.strokeStyle = P.main;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(0, r), 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = rgba(P.accent, 0.8);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x2, y2, Math.max(0, r * 0.82), 0, TAU);
        ctx.stroke();
      }
      void dir;
    },
    hit(ctx, x, y, q, P, seed, big) {
      const s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalAlpha = 1 - q;
      anInkBlob(ctx, x, y, (40 + 80 * anOutExpo(q)) * s, seed, "#05010a");
      ctx.globalAlpha = (1 - q) * 0.9;
      ctx.strokeStyle = P.main;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, (50 + 120 * anOutExpo(q)) * s, 0, TAU);
      ctx.stroke();
      ctx.restore();
      anSparks(ctx, x, y, q, seed + 5, 18, 190 * s, ["#000000", P.main, P.accent], 5, 160);
    },
    trail(ctx, pts, dir, t, P) {
      pts.forEach((p, k) => anSmoke(ctx, p.x - dir * 20, p.y, 0.3 + k * 0.12, k * 5 + t, "#140726", 70, 6));
      void P;
    },
  },
  lune: {
    charge(ctx, x, y, q, t, P) {
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y - 10, 230, P.main, 0.42 * q);
      anCrescent(ctx, x, y - 10, 150 * (0.6 + 0.4 * ease.out(q)), -0.6 + t * 0.01, rgba(P.light, 0.65 * q), 0.22);
      const R = seeded(23);
      for (let k = 0; k < 28; k++) {
        const px = x + (R() - 0.5) * 300, sp = 1 + R() * 2, py = y + 130 - ((t * sp * 4 + R() * 260) % 260);
        disc(ctx, px, py, 1 + R() * 1.8, k % 3 ? "#ffffff" : P.main);
      }
      ctx.restore();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + t * 0.07, px = x + Math.cos(a) * 128, py = y - 10 + Math.sin(a) * 42, r = 9 * q;
        if (r < 1) continue;
        disc(ctx, px, py, r, "#f8fafc");
        disc(ctx, px + r * (k / 3 - 1), py, r * 0.95, "rgba(30,27,75,0.85)");
      }
    },
    release(ctx, x1, y1, x2, y2, q, t, P, seed) {
      const dir = Math.sign(x2 - x1) || 1, p = ease.inOut(anSeg(q, 0, 0.55));
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      if (q < 0.6) {
        const rot = q * 16 * dir;
        for (let k = 5; k >= 0; k--) {
          const pp = Math.max(0, p - k * 0.045), ax = anLerp(x1, x2, pp), ay = anLerp(y1 - 60, y2, pp) - Math.sin(pp * Math.PI) * 70;
          ctx.globalAlpha = k ? 0.3 * (1 - k / 6) : 1;
          anCrescent(ctx, ax, ay, 95, rot - k * 0.5 * dir, k ? P.main : "#ffffff", 0.33);
        }
        ctx.globalAlpha = 1;
        const cx = anLerp(x1, x2, p), cy = anLerp(y1 - 60, y2, p) - Math.sin(p * Math.PI) * 70;
        glow(ctx, cx, cy, 170, P.light, 0.6);
      }
      if (q > 0.5) {
        const e = anSeg(q, 0.5, 0.82), fade = 1 - anSeg(q, 0.86, 1);
        anSlashArc(ctx, x2, y2, 190, 0.62, e, P.light, fade);
        anSlashArc(ctx, x2, y2, 190, -0.62 + Math.PI, anSeg(q, 0.58, 0.88), P.light, fade);
      }
      if (q > 0.72) {
        const e = anSeg(q, 0.72, 1), w = 80 * (1 - e) + 16;
        const g = ctx.createLinearGradient(x2 - w, 0, x2 + w, 0);
        g.addColorStop(0, rgba(P.main, 0));
        g.addColorStop(0.5, rgba(P.light, 0.85 * (1 - e)));
        g.addColorStop(1, rgba(P.main, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x2 - w, -AN_MY, w * 2, y2 + 150 + AN_MY);
      }
      ctx.restore();
      void seed;
    },
    hit(ctx, x, y, q, P, seed, big) {
      const s = big ? 1.5 : 1;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      glow(ctx, x, y, 160 * s, P.main, 0.85 * (1 - q));
      anSlashArc(ctx, x, y, 90 * s, 0.7, Math.min(1, q * 2.4), P.light, 1 - q);
      anSlashArc(ctx, x, y, 90 * s, -0.7 + Math.PI, Math.min(1, q * 2.4 - 0.3), P.light, 1 - q);
      ctx.restore();
      anSparks(ctx, x, y, q, seed + 9, 20, 180 * s, ["#ffffff", P.main, P.accent], 2.5, 30);
    },
    trail(ctx, pts, dir, t, P) {
      if (pts.length < 2) return;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      ctx.lineCap = "round";
      for (const [lw, col] of [[40, rgba(P.main, 0.25)], [14, rgba(P.light, 0.6)], [4, "#ffffff"]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.stroke();
      }
      ctx.restore();
      void dir;
      void t;
    },
  },
};
// explosion de flammes (soleil)
function anFireBloom(ctx, x, y, e, P, seed) {
  const R = seeded(seed), r = 40 + 190 * anOutExpo(e), fade = 1 - e * 0.6;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const pg = ctx.createLinearGradient(0, y - 420, 0, y + 40);
  pg.addColorStop(0, rgba(P.accent, 0));
  pg.addColorStop(0.6, rgba(P.main, 0.6 * fade));
  pg.addColorStop(1, rgba(P.light, 0.8 * fade));
  ctx.fillStyle = pg;
  ctx.fillRect(x - 60 - 40 * e, y - 420, 120 + 80 * e, 460);
  for (const [k, col, a] of [[1, P.accent, 0.5], [0.78, P.main, 0.7], [0.55, P.light, 0.85], [0.3, "#ffffff", 1]]) {
    ctx.fillStyle = rgba(col, a * fade);
    ctx.beginPath();
    for (let j = 0; j <= 24; j++) {
      const ang = (j / 24) * TAU, rr = r * k * (0.82 + R() * 0.3);
      ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr * 0.85);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------- la séquence d'une manche ----------
async function animeClashGif(b, res, hp0, pre, bg, scale = 1) {
  const W = AN_W, H = AN_H, OW = Math.round(W * scale), OH = Math.round(H * scale), CW = AN_CW, CH = AN_CH, home = AN_HOME, baseY = AN_BASE;
  const thumbs = new Map();
  for (const p of b.players) for (const f of p.team) if (!thumbs.has(f.key)) thumbs.set(f.key, await cardThumb(f.card, isHoloKey(f.key), CW, CH));
  const enc = GIFEncoder();
  let scene = [], wrote = 0, duration = 0, frameNo = 0;
  const CAM0 = { x: W / 2, y: H / 2, z: 1, r: 0 };
  const S = { cam: { ...CAM0 }, shake: 0, flash: 0, flashColor: "#ffffff", dark: 0, gray: 0, letter: 0, hud: 1, realm: null, realmA: 0, realmClip: null, impact: null, impactAt: null, zoomBlur: 0, zoomAt: null, aberr: 0, redPulse: 0, under: [], world: [], screen: [], floats: [] };
  const V = [0, 1].map((i) => ({ idx: pre[i], dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, scale: 1, alpha: 1, hidden: false, white: 0, whiteColor: "#ffffff", glow: 0, glowColor: "#ffffff", after: [], afterColor: "#ffffff", crack: 0, shield: 0, shieldFlash: 0, shieldCrack: false, hp: [...hp0[i]], lag: [...hp0[i]], hold: 0, ko: hp0[i].map((h) => h <= 0) }));
  const fighterOf = (i) => b.players[i].team[V[i].idx];
  const posOf = (i) => ({ x: home[i] + V[i].dx, y: baseY + V[i].dy });
  const toScreen = (x, y) => {
    const dx = (x - S.cam.x) * S.cam.z, dy = (y - S.cam.y) * S.cam.z, c = Math.cos(S.cam.r), s = Math.sin(S.cam.r);
    return { x: W / 2 + dx * c - dy * s, y: H / 2 + dx * s + dy * c };
  };
  const camLerp = (A, B, t) => {
    S.cam.x = anLerp(A.x, B.x, t);
    S.cam.y = anLerp(A.y, B.y, t);
    S.cam.z = anLerp(A.z, B.z, t);
    S.cam.r = anLerp(A.r, B.r, t);
  };
  const addDmg = (i, n, kind) => S.floats.push({ type: "dmg", i, n, kind, born: frameNo, life: 24, ox: (seeded(frameNo + n)() - 0.5) * 40 });
  const addTag = (i, text, color, size = 22, dy = -46) => S.floats.push({ type: "tag", i, text, color, size, dy, born: frameNo, life: 22 });
  const addSfx = (wx, wy, text, P, size = 60, rot = -0.12) => {
    const sp = toScreen(wx, wy);
    S.floats.push({ type: "sfx", x: Math.max(110, Math.min(W - 110, sp.x)), y: Math.max(150, Math.min(H - 60, sp.y)), text, P, size, rot, born: frameNo, life: 16, seed: frameNo * 13 + 1 });
  };
  const setHp = (i, idx, val) => {
    V[i].hp[idx] = val;
  };

  // --- encodage scène par scène : une palette par scène ---
  // Les pixels identiques à l'image précédente deviennent transparents (index 255) : le GIF s'allège
  // beaucoup dès que la caméra ne bouge pas.
  const flush = () => {
    if (!scene.length) return;
    const budget = 110000, px = OW * OH, step = Math.max(3, Math.ceil((px * scene.length) / budget)), n = Math.floor(px / step), sample = new Uint8Array(n * 4 * scene.length);
    let o = 0;
    scene.forEach((sh, f) => {
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
    for (const sh of scene) {
      const idx = applyPalette(sh.data, real);
      if (prev) {
        const raw = idx.slice();
        for (let k = 0; k < idx.length; k++) if (idx[k] === prev[k]) idx[k] = 255;
        prev = raw;
        enc.writeFrame(idx, OW, OH, { palette, delay: sh.delay, transparent: true, transparentIndex: 255, dispose: 1 });
      } else {
        prev = idx.slice();
        enc.writeFrame(idx, OW, OH, { palette, delay: sh.delay, repeat: -1, dispose: 1 });
      }
      wrote++;
    }
    scene = [];
  };
  const cut = flush;

  // --- dessin d'un combattant (repère du monde) ---
  const drawFighter = (ctx, i) => {
    const v = V[i], f = fighterOf(i);
    if (!f) return;
    const th = thumbs.get(f.key), { x, y } = posOf(i), bob = Math.sin(frameNo * 0.22 + i * 2) * 3;
    const lift = Math.max(0, -v.dy);
    if (!v.hidden) {
      ctx.fillStyle = `rgba(0,0,0,${0.5 * v.alpha * Math.max(0.15, 1 - lift / 300)})`;
      ctx.beginPath();
      ctx.ellipse(home[i] + v.dx, baseY + CH / 2 + 10, CW * 0.5 * (1 - Math.min(0.5, lift / 500)), 14, 0, 0, TAU);
      ctx.fill();
    }
    // images rémanentes : la carte en transparence, teintée de la couleur de l'astre
    for (const a of v.after) {
      ctx.save();
      ctx.translate(a.x, a.y + bob);
      ctx.rotate(a.rot ?? 0);
      ctx.globalAlpha = Math.max(0, a.a) * 0.55;
      ctx.drawImage(th, -CW / 2, -CH / 2, CW, CH);
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = Math.max(0, a.a) * 0.35;
      ctx.drawImage(anSilhouette(th, v.afterColor), -CW / 2, -CH / 2, CW, CH);
      ctx.restore();
    }
    if (v.hidden) return;
    if (v.glow > 0) glow(ctx, x, y + bob, 200, v.glowColor, Math.min(1, v.glow) * 0.65);
    ctx.save();
    ctx.globalAlpha = v.alpha;
    ctx.translate(x, y + bob);
    ctx.rotate(v.rot);
    ctx.scale(v.sx * v.scale, v.sy * v.scale);
    if (v.ko[v.idx]) ctx.filter = "grayscale(1) brightness(0.5)";
    ctx.drawImage(th, -CW / 2, -CH / 2, CW, CH);
    ctx.filter = "none";
    if (v.white > 0) {
      ctx.globalAlpha = v.alpha * Math.min(1, v.white);
      ctx.drawImage(anSilhouette(th, v.whiteColor), -CW / 2, -CH / 2, CW, CH);
    }
    if (v.crack > 0) anCracks(ctx, CW, CH, v.crack, hashOf(f.key), anPalOf(f).main);
    ctx.restore();
    if (v.shield > 0) fxHexShield(ctx, x + (i === 0 ? 72 : -72), y, CH, "#60a5fa", v.shield * (0.55 + v.shieldFlash * 0.45), v.shieldCrack);
  };

  // --- interface façon jeu de combat (repère de l'écran) ---
  const drawHud = (ctx) => {
    ctx.save();
    ctx.globalAlpha = S.hud;
    for (const i of [0, 1]) {
      const v = V[i], p = b.players[i], f = fighterOf(i), left = i === 0, dir = left ? 1 : -1;
      if (!f) continue;
      const P = anPalOf(f), x0 = left ? 16 : W - 16;
      ctx.fillStyle = "rgba(6,4,12,0.8)";
      ctx.beginPath();
      ctx.moveTo(x0, 10);
      ctx.lineTo(x0 + dir * 378, 10);
      ctx.lineTo(x0 + dir * 356, 72);
      ctx.lineTo(x0, 72);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba(P.main, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();
      astreOrb(ctx, anAstreOf(f), x0 + dir * 31, 41, 21);
      ctx.textAlign = left ? "left" : "right";
      ctx.font = "12px CardEngrave";
      ctx.fillStyle = "#fde68a";
      ctx.fillText(p.name.toUpperCase().slice(0, 24), x0 + dir * 62, 27);
      ctx.textAlign = left ? "right" : "left";
      ctx.font = "11px CardBold";
      ctx.fillStyle = "#e5e7eb";
      ctx.fillText(f.name.slice(0, 22), x0 + dir * 346, 27);
      // barre de vie en biseau, ancrée côté extérieur, avec la traînée des dégâts
      const bx = x0 + dir * 62, bw = 280, by = 35, bh = 16, sk = 8 * dir;
      const bar = (from, to) => {
        const xa = bx + dir * bw * from, xb = bx + dir * bw * to;
        ctx.beginPath();
        ctx.moveTo(xa + sk, by);
        ctx.lineTo(xb + sk, by);
        ctx.lineTo(xb, by + bh);
        ctx.lineTo(xa, by + bh);
        ctx.closePath();
      };
      const frac = (val) => Math.max(0, Math.min(1, val / f.maxHp));
      bar(0, 1);
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fill();
      const hp = v.hp[v.idx], lag = v.lag[v.idx], fr = frac(hp);
      if (frac(lag) > fr) {
        bar(0, frac(lag));
        ctx.fillStyle = "#fee2e2";
        ctx.fill();
      }
      if (fr > 0) {
        bar(0, fr);
        const g = ctx.createLinearGradient(bx, 0, bx + dir * bw, 0);
        const col = fr > 0.5 ? ["#15803d", "#4ade80"] : fr > 0.25 ? ["#a16207", "#facc15"] : ["#991b1b", "#f87171"];
        g.addColorStop(0, col[0]);
        g.addColorStop(1, col[1]);
        ctx.fillStyle = g;
        ctx.fill();
      }
      bar(0, 1);
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1;
      for (let k = 1; k < 10; k++) {
        const xx = bx + dir * bw * (k / 10);
        ctx.beginPath();
        ctx.moveTo(xx + sk, by);
        ctx.lineTo(xx, by + bh);
        ctx.stroke();
      }
      ctx.font = "10px CardBold";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = left ? "right" : "left";
      ctx.fillText(`${Math.max(0, Math.round(hp))} / ${f.maxHp} PV`, bx + dir * bw, by + bh + 13);
      // cartes restantes
      p.team.forEach((_, k) => {
        const cx = x0 + dir * (68 + k * 15), cy = by + bh + 9, alive = v.hp[k] > 0;
        ctx.fillStyle = alive ? P.main : "rgba(255,255,255,0.15)";
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.lineTo(cx + 5, cy);
        ctx.lineTo(cx, cy + 5);
        ctx.lineTo(cx - 5, cy);
        ctx.closePath();
        ctx.fill();
      });
    }
    // numéro de manche
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(6,4,12,0.85)";
    ctx.beginPath();
    ctx.moveTo(W / 2, 6);
    ctx.lineTo(W / 2 + 36, 40);
    ctx.lineTo(W / 2, 74);
    ctx.lineTo(W / 2 - 36, 40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#e9c46a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = "8px CardEngrave";
    ctx.fillStyle = "#e9c46a";
    ctx.fillText("MANCHE", W / 2, 30);
    ctx.font = "24px CardTitle";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(b.round), W / 2, 56);
    ctx.restore();
  };
  const drawFloats = (ctx) => {
    for (const fl of S.floats) {
      const life = frameNo - fl.born;
      if (life < 0 || life > fl.life) continue;
      const q = life / fl.life;
      if (fl.type === "sfx") anSfx(ctx, fl.text, fl.x, fl.y, fl.size, fl.P, q, fl.seed, fl.rot);
      else {
        // dégâts au centre de la carte, étiquettes en dessous, onomatopée au-dessus
        const sp = toScreen(posOf(fl.i).x, baseY + 10), tp = toScreen(posOf(fl.i).x, baseY + 96);
        if (fl.type === "dmg") anDamage(ctx, fl.n, sp.x + fl.ox, sp.y - life * 1.6, q, fl.kind);
        else anTag(ctx, fl.text, tp.x, Math.min(H - 30, tp.y - (fl.dy + 46)), fl.size, fl.color, q);
      }
    }
    S.floats = S.floats.filter((fl) => frameNo - fl.born <= fl.life);
  };
  // --- post-traitements : flou de zoom, image d'impact, aberration ---
  const post = (c, ctx) => {
    if (S.zoomBlur <= 0 && !S.impact) return;
    const copy = createCanvas(OW, OH);
    copy.getContext("2d").drawImage(c, 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (S.zoomBlur > 0) {
      const at = S.zoomAt ?? { x: W / 2, y: H / 2 };
      for (let k = 1; k <= 3; k++) {
        const z = 1 + S.zoomBlur * k * 0.035;
        ctx.save();
        ctx.globalAlpha = 0.24;
        ctx.translate(at.x * scale, at.y * scale);
        ctx.scale(z, z);
        ctx.translate(-at.x * scale, -at.y * scale);
        ctx.drawImage(copy, 0, 0);
        ctx.restore();
      }
    }
    if (S.impact) {
      const mode = S.impact, at = S.impactAt ?? { x: W / 2, y: H / 2 };
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, OW, OH);
      ctx.filter = mode === "neg" ? "grayscale(1) contrast(6) invert(1)" : "grayscale(1) contrast(6) brightness(1.4)";
      ctx.drawImage(copy, 0, 0);
      ctx.filter = "none";
      if (mode === "red") {
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = "#e11d48";
        ctx.fillRect(0, 0, OW, OH);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      anImpactSpikes(ctx, at.x, at.y, mode, frameNo * 5 + 1);
    }
    ctx.restore();
  };
  const frame = async (delay = 50) => {
    await yieldLoop();
    const c = createCanvas(OW, OH), ctx = c.getContext("2d");
    if (scale !== 1) ctx.scale(scale, scale);
    const R = seeded(frameNo * 7 + 3), shx = S.shake ? (R() - 0.5) * S.shake * 2 : 0, shy = S.shake ? (R() - 0.5) * S.shake * 2 : 0;
    // le monde, vu par la caméra
    ctx.save();
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.rotate(S.cam.r);
    ctx.scale(S.cam.z, S.cam.z);
    ctx.translate(-S.cam.x, -S.cam.y);
    if (S.gray > 0) ctx.filter = `grayscale(${Math.min(1, S.gray).toFixed(2)})`;
    ctx.drawImage(bg, -AN_MX, -AN_MY);
    if (S.realm && S.realmA > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, S.realmA);
      if (S.realmClip) {
        ctx.beginPath();
        ctx.arc(S.realmClip.x, S.realmClip.y, Math.max(1, S.realmClip.r), 0, TAU);
        ctx.clip();
      }
      ctx.drawImage(anRealm(S.realm), -AN_MX, -AN_MY);
      anRealmParticles(ctx, S.realm, frameNo);
      ctx.restore();
    }
    ctx.filter = "none";
    if (S.dark > 0) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, S.dark) * 0.72})`;
      ctx.fillRect(-AN_MX - 50, -AN_MY - 50, AN_BW + 100, AN_BH + 100);
    }
    for (const o of S.under) o(ctx);
    for (const i of [0, 1]) drawFighter(ctx, i);
    for (const o of S.world) o(ctx);
    ctx.restore();
    // l'écran
    ctx.save();
    ctx.translate(shx * 0.4, shy * 0.4);
    for (const o of S.screen) o(ctx);
    drawFloats(ctx);
    ctx.restore();
    if (S.hud > 0) drawHud(ctx);
    if (S.letter > 0) {
      const h = 52 * Math.min(1, S.letter);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, W, h);
      ctx.fillRect(0, H - h, W, h);
    }
    if (S.redPulse > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 140, W / 2, H / 2, W * 0.7);
      g.addColorStop(0, "rgba(127,29,29,0)");
      g.addColorStop(1, `rgba(127,29,29,${0.6 * Math.min(1, S.redPulse)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(anVignette(), 0, 0);
    if (S.flash > 0) {
      ctx.fillStyle = rgba(S.flashColor, Math.min(1, S.flash));
      ctx.fillRect(0, 0, W, H);
    }
    post(c, ctx);
    S.flash = Math.max(0, S.flash - 0.3); // un flash retombe tout seul
    if (S.aberr > 0) anAberration(ctx, Math.round(S.aberr * scale), OW, OH);
    // la traînée de la barre de vie rattrape les PV
    for (const v of V) {
      if (v.hold > 0) v.hold--;
      else v.lag = v.lag.map((l, k) => (l > v.hp[k] ? Math.max(v.hp[k], l - Math.max(2, (l - v.hp[k]) * 0.2)) : v.hp[k]));
    }
    if (anDebug) anDebug(c, frameNo, delay);
    scene.push({ data: ctx.getImageData(0, 0, OW, OH).data, delay });
    duration += delay;
    frameNo++;
    if (scene.length >= 26) flush();
  };
  const run = async (n, fn, delays) => {
    for (let f = 0; f < n; f++) {
      fn(n > 1 ? f / (n - 1) : 1, f);
      await frame(Array.isArray(delays) ? delays[f] ?? 50 : delays ?? 50);
    }
  };
  const settle = async (n = 5) => {
    const C = { ...S.cam }, from = V.map((v) => ({ dx: v.dx, dy: v.dy, rot: v.rot, scale: v.scale }));
    await run(n, (q) => {
      const e = ease.inOut(q);
      camLerp(C, CAM0, e);
      V.forEach((v, i) => {
        v.dx = from[i].dx * (1 - e);
        v.dy = from[i].dy * (1 - e);
        v.rot = from[i].rot * (1 - e);
        v.scale = 1 + (from[i].scale - 1) * (1 - e);
        v.glow = Math.max(0, v.glow - 0.25);
        v.white = 0;
      });
      S.shake = 0;
    });
    V.forEach((v) => {
      v.sx = v.sy = 1;
      v.after = [];
    });
    S.cam = { ...CAM0 };
  };
  const clearFx = () => {
    S.under = [];
    S.world = [];
    S.screen = [];
    S.shake = 0;
    S.flash = 0;
    S.aberr = 0;
    S.zoomBlur = 0;
    S.impact = null;
  };

  // --- gros plan en cases de manga ---
  const cutIn = async (i, f, P) => {
    const big = await cardThumb(f.card, isHoloKey(f.key), 300, 420);
    const art = { img: big, sx: 15, sy: 44, sw: 270, sh: 214 };
    const pname = b.players[i].name, astre = anAstreOf(f), fromLeft = i === 0;
    const M = (x) => (fromLeft ? x : W - x);
    const polys = [
      { pts: [[0, 22], [596, 22], [500, 478], [0, 478]], at: 0, from: [-1, 0] },
      { pts: [[610, 22], [880, 22], [880, 240], [566, 240]], at: 0.1, from: [0, -1] },
      { pts: [[562, 254], [880, 254], [880, 478], [514, 478]], at: 0.18, from: [0, 1] },
    ];
    const draw = (ctx, q) => {
      const outQ = ease.in(anSeg(q, 0.86, 1));
      polys.forEach((pl, k) => {
        const inQ = anOutExpo(anSeg(q, pl.at, pl.at + 0.24));
        const ox = ((1 - inQ) * pl.from[0] * W + outQ * (k === 0 ? 1 : -1) * W * 0.3) * (fromLeft ? 1 : -1), oy = (1 - inQ) * pl.from[1] * H;
        const pts = pl.pts.map(([x, y]) => [M(x) + ox, y + oy]);
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), bx = Math.min(...xs), by = Math.min(...ys), bw = Math.max(...xs) - bx, bh = Math.max(...ys) - by;
        ctx.save();
        ctx.globalAlpha = 1 - outQ;
        ctx.beginPath();
        pts.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        ctx.save();
        ctx.clip();
        if (k === 0) {
          ctx.fillStyle = P.dark;
          ctx.fillRect(bx, by, bw, bh);
          const zoom = 1.05 + 0.22 * q, dw = bw * zoom, dh = (dw * art.sh) / art.sw, drift = (fromLeft ? -1 : 1) * 40 * q;
          ctx.drawImage(art.img, art.sx, art.sy, art.sw, art.sh, bx + (bw - dw) / 2 + drift, by + (bh - dh) / 2 - 10, dw, dh);
          ctx.globalCompositeOperation = "soft-light";
          ctx.fillStyle = rgba(P.main, 0.55);
          ctx.fillRect(bx, by, bw, bh);
          ctx.globalCompositeOperation = "source-over";
          anSpeedLines(ctx, fromLeft ? 1 : -1, 0.22, frameNo * 3 + 1);
          ctx.save();
          ctx.globalAlpha = 0.4;
          if (!fromLeft) {
            ctx.translate(W, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(anHalftone("#000000"), 0, 0);
          ctx.restore();
          const sh = ctx.createLinearGradient(0, by + bh * 0.55, 0, by + bh);
          sh.addColorStop(0, "rgba(0,0,0,0)");
          sh.addColorStop(1, "rgba(0,0,0,0.65)");
          ctx.fillStyle = sh;
          ctx.fillRect(bx, by, bw, bh);
          ctx.font = "13px CardEngrave";
          ctx.textAlign = fromLeft ? "left" : "right";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(f.name.toUpperCase().slice(0, 30), fromLeft ? bx + 34 : bx + bw - 34, by + bh - 26);
        } else if (k === 1) {
          const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
          g.addColorStop(0, "#000000");
          g.addColorStop(1, P.dark);
          ctx.fillStyle = g;
          ctx.fillRect(bx, by, bw, bh);
          anFocusLines(ctx, bx + bw / 2, by + bh / 2, 0.3, frameNo * 5 + 2, P.main, 80, 60);
          astreOrb(ctx, astre, bx + bw / 2, by + 78, 40 + 4 * Math.sin(q * 10));
          ctx.textAlign = "center";
          ctx.font = "12px CardEngrave";
          ctx.fillStyle = P.light;
          spaced(ctx, "TECHNIQUE SPÉCIALE", bx + bw / 2, by + 146, 3);
          ctx.font = `${fitText(ctx, ASTRES[astre].label.toUpperCase(), bw - 60, 40, "CardTitle")}px CardTitle`;
          const tg = ctx.createLinearGradient(0, by + 150, 0, by + 196);
          tg.addColorStop(0, "#ffffff");
          tg.addColorStop(1, P.main);
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#000000";
          ctx.strokeText(ASTRES[astre].label.toUpperCase(), bx + bw / 2, by + 192);
          ctx.fillStyle = tg;
          ctx.fillText(ASTRES[astre].label.toUpperCase(), bx + bw / 2, by + 192);
        } else {
          const g = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
          g.addColorStop(0, P.main);
          g.addColorStop(1, P.dark);
          ctx.fillStyle = g;
          ctx.fillRect(bx, by, bw, bh);
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.drawImage(anHalftone("#000000"), 0, 0);
          ctx.restore();
          anBrushBar(ctx, bx + bw / 2 + 20, by + bh / 2 + 6, bw + 40, 104, hashOf(f.key), "rgba(0,0,0,0.9)", anOutExpo(anSeg(q, 0.25, 0.5)));
          const name = String(f.special ?? "Coup spécial").toUpperCase(), words = name.split(" "), lines = [];
          for (const w of words) {
            const last = lines[lines.length - 1];
            if (last && (last + " " + w).length <= 16) lines[lines.length - 1] = last + " " + w;
            else lines.push(w);
          }
          const shown = lines.slice(0, 2), size = Math.min(...shown.map((l) => fitText(ctx, l, bw - 70, 44, "CardTitle")));
          ctx.font = `${size}px CardTitle`;
          ctx.textAlign = "center";
          const ta = anSeg(q, 0.3, 0.45);
          ctx.globalAlpha = (1 - outQ) * ta;
          shown.forEach((l, j) => {
            const ly = by + bh / 2 + 10 + (j - (shown.length - 1) / 2) * (size + 4);
            ctx.lineWidth = 7;
            ctx.strokeStyle = "#000000";
            ctx.strokeText(l, bx + bw / 2 + 20, ly);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(l, bx + bw / 2 + 20, ly);
          });
          ctx.font = "11px CardEngrave";
          ctx.fillStyle = P.light;
          ctx.fillText(pname.toUpperCase().slice(0, 30), bx + bw / 2 + 20, by + bh - 22);
        }
        ctx.restore();
        ctx.lineJoin = "round";
        ctx.lineWidth = 8;
        ctx.strokeStyle = "#000000";
        ctx.stroke();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.restore();
      });
      if (q > 0.9) {
        ctx.fillStyle = `rgba(255,255,255,${anSeg(q, 0.9, 1) * 0.9})`;
        ctx.fillRect(0, 0, W, H);
      }
    };
    await run(
      17,
      (q) => {
        S.hud = 1 - anSeg(q, 0, 0.12);
        S.dark = 0.85 * anSeg(q, 0, 0.12);
        S.screen = [(ctx) => anFocusLines(ctx, W / 2, H / 2, 0.5, frameNo, "#ffffff", 220), (ctx) => draw(ctx, q)];
      },
      [50, 40, 40, 40, 40, 50, 60, 70, 80, 90, 90, 80, 70, 60, 50, 40, 40]
    );
    S.screen = [];
    S.hud = 1;
    S.dark = 0;
    S.flash = 0.8;
    S.flashColor = "#ffffff";
    cut();
  };

  // --- l'astre qui domine : les deux emblèmes s'affrontent ---
  const dominance = async (att, def, mult) => {
    const A = anAstreOf(att), D = anAstreOf(def), PA = AN_PAL[A], PD = AN_PAL[D], win = mult > 1;
    const orb = (ctx, cx, cy, r, astre, split, seed) => {
      if (split <= 0) return astreOrb(ctx, astre, cx, cy, r);
      const R = seeded(seed), crack = [[cx, cy - r - 12]];
      for (let k = 1; k < 7; k++) crack.push([cx + (R() - 0.5) * r * 0.5, cy - r + (k / 7) * r * 2]);
      crack.push([cx, cy + r + 12]);
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx + side * (r + 20), cy - r - 20);
        crack.forEach(([x, y]) => ctx.lineTo(x, y));
        ctx.lineTo(cx + side * (r + 20), cy + r + 20);
        ctx.closePath();
        ctx.clip();
        ctx.translate(side * split * 46, split * split * 60);
        ctx.rotate(side * split * 0.35);
        astreOrb(ctx, astre, cx, cy, r);
        ctx.restore();
      }
      if (split < 0.5) {
        ctx.save();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.beginPath();
        crack.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
        ctx.restore();
      }
    };
    await run(
      13,
      (q) => {
        S.hud = 0;
        S.dark = 0.9;
        S.screen = [
          (ctx) => {
            const push = ease.out(anSeg(q, 0.35, 0.6)) * (win ? 70 : -70), split = W / 2 + push;
            const half = (side) => {
              ctx.beginPath();
              if (side < 0) {
                ctx.moveTo(0, 0);
                ctx.lineTo(split + 50, 0);
                ctx.lineTo(split - 50, H);
                ctx.lineTo(0, H);
              } else {
                ctx.moveTo(split + 50, 0);
                ctx.lineTo(W, 0);
                ctx.lineTo(W, H);
                ctx.lineTo(split - 50, H);
              }
              ctx.closePath();
            };
            const inQ = anOutExpo(anSeg(q, 0, 0.25));
            ctx.save();
            ctx.translate(-(1 - inQ) * W * 0.5, 0);
            half(-1);
            const ga = ctx.createLinearGradient(0, 0, W / 2, 0);
            ga.addColorStop(0, PA.dark);
            ga.addColorStop(1, PA.main);
            ctx.fillStyle = ga;
            ctx.fill();
            ctx.save();
            ctx.clip();
            anFocusLines(ctx, W * 0.26, H / 2, 0.35, 41, PA.light, 100, 60);
            ctx.restore();
            ctx.restore();
            ctx.save();
            ctx.translate((1 - inQ) * W * 0.5, 0);
            half(1);
            const gd = ctx.createLinearGradient(W, 0, W / 2, 0);
            gd.addColorStop(0, PD.dark);
            gd.addColorStop(1, PD.main);
            ctx.fillStyle = gd;
            ctx.fill();
            ctx.save();
            ctx.clip();
            anFocusLines(ctx, W * 0.74, H / 2, 0.35, 43, PD.light, 100, 60);
            ctx.restore();
            ctx.restore();
            anBolt(ctx, split + 50, -10, split - 50, H + 10, frameNo * 3 + 5, 6, "#ffffff", 0.08, 2);
            const pop = (k) => ease.back(anSeg(q, 0.08 + k * 0.06, 0.32 + k * 0.06));
            const brk = anSeg(q, 0.55, 0.9);
            orb(ctx, W * 0.26 + (win ? push * 0.4 : 0), H / 2 + 10, 86 * pop(0), A, win ? 0 : brk, 7);
            orb(ctx, W * 0.74 + (win ? 0 : push * 0.4), H / 2 + 10, 86 * pop(1), D, win ? brk : 0, 9);
            ctx.textAlign = "center";
            const title = win ? `${ASTRES[A].label.toUpperCase()} DOMINE ${ASTRES[D].label.toUpperCase()}` : `${ASTRES[D].label.toUpperCase()} RÉSISTE À ${ASTRES[A].label.toUpperCase()}`;
            const ta = anSeg(q, 0.3, 0.45);
            ctx.globalAlpha = ta;
            anBrushBar(ctx, W / 2, 70, 620, 62, 77, "rgba(0,0,0,0.9)", anOutExpo(ta));
            ctx.font = `${fitText(ctx, title, 560, 34, "CardTitle")}px CardTitle`;
            ctx.fillStyle = "#ffffff";
            ctx.fillText(title, W / 2, 82);
            ctx.globalAlpha = 1;
            if (q > 0.55) {
              const P2 = win ? { main: "#facc15", light: "#ffffff", accent: "#ea580c" } : { main: "#94a3b8", light: "#f1f5f9", accent: "#334155" };
              anSfx(ctx, win ? "DÉGÂTS ×2" : "DÉGÂTS ×0,5", W / 2, H - 62, 52, P2, anSeg(q, 0.55, 1) * 0.7, 99, -0.04);
            }
          },
        ];
      },
      [50, 40, 40, 50, 60, 80, 90, 70, 60, 60, 80, 110, 140]
    );
    S.screen = [];
    S.hud = 1;
    S.dark = 0;
    cut();
  };

  // --- déploiement du territoire : une goutte d'encre qui s'étend depuis l'attaquant ---
  const deployRealm = async (i, astre, P) => {
    const { x: ax, y: ay } = posOf(i);
    S.realm = astre;
    S.realmA = 1;
    await run(
      18,
      (q) => {
        S.hud = 0;
        S.letter = Math.max(S.letter, anSeg(q, 0, 0.2));
        const e = anSeg(q, 0.28, 0.8), r = anOutExpo(e) * 1100;
        S.realmClip = { x: ax, y: ay, r: Math.max(1, r) };
        S.dark = q < 0.3 ? 0.95 * anSeg(q, 0, 0.12) : 0.95 * (1 - anSeg(q, 0.3, 0.6));
        S.world = [
          (ctx) => {
            if (e <= 0 || e >= 1) return;
            ctx.save();
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 34 * (1 - e) + 4;
            ctx.beginPath();
            ctx.arc(ax, ay, r, 0, TAU);
            ctx.stroke();
            ctx.strokeStyle = P.light;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(ax, ay, r - 18 * (1 - e) - 2, 0, TAU);
            ctx.stroke();
            for (let k = 1; k <= 3; k++) {
              ctx.strokeStyle = rgba(P.main, 0.5 / k);
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(ax, ay, Math.max(1, r - k * 40), 0, TAU);
              ctx.stroke();
            }
            ctx.restore();
          },
        ];
        S.screen = [
          (ctx) => {
            const tq = anSeg(q, 0.02, 0.24), out = anSeg(q, 0.27, 0.34);
            if (q < 0.34) {
              ctx.save();
              ctx.globalAlpha = 1 - out;
              anBrushBar(ctx, W / 2, H / 2, 560, 84, 31, "#000000", anOutExpo(tq));
              ctx.textAlign = "center";
              ctx.font = "50px CardTitle";
              const word = "DÉPLOIEMENT", shown = Math.round(word.length * anSeg(q, 0.05, 0.22));
              ctx.fillStyle = "#ffffff";
              ctx.fillText(word.slice(0, shown), W / 2, H / 2 + 17);
              ctx.restore();
            }
            if (q > 0.6) {
              const nq = anSeg(q, 0.6, 0.78);
              ctx.save();
              anBrushBar(ctx, W / 2, H - 104, 690, 58, 53, "rgba(0,0,0,0.88)", anOutExpo(nq));
              ctx.globalAlpha = nq;
              ctx.textAlign = "center";
              ctx.font = "10px CardEngrave";
              ctx.fillStyle = P.main;
              spaced(ctx, "TERRITOIRE ASTRAL", W / 2, H - 120, 4);
              ctx.font = `${fitText(ctx, P.realm, 620, 26, "CardEngrave")}px CardEngrave`;
              ctx.fillStyle = P.light;
              ctx.fillText(P.realm, W / 2, H - 92);
              ctx.restore();
            }
          },
        ];
        S.shake = q > 0.28 && q < 0.6 ? 6 : 0;
      },
      [60, 50, 50, 50, 60, 90, 60, 50, 45, 45, 45, 45, 50, 60, 80, 110, 150, 200]
    );
    S.realmClip = null;
    S.world = [];
    S.screen = [];
    S.shake = 0;
    cut();
  };

  // --- l'impact d'un coup (attaque ou spécial) ---
  const impact = async (ev, P, astre, big, finisher) => {
    const i = ev.side, o = 1 - i, s = V[i], t = V[o], dir = i === 0 ? 1 : -1, seed = b.round * 97 + i * 13 + ev.attIdx;
    const tx = () => posOf(o).x, ty = () => posOf(o).y;
    if (ev.dodge) {
      addSfx(tx(), ty() - 120, "ZWIP", { main: "#e2e8f0", light: "#ffffff", accent: "#64748b" }, 50, -0.1);
      addTag(o, "ESQUIVE !", "#ffffff", 24, -40);
      await run(8, (q) => {
        t.afterColor = "#e0f2fe";
        t.after = q < 0.8 ? [{ x: home[o], y: baseY, a: 0.65 * (1 - q) }] : [];
        t.dx = dir * 90 * Math.sin(anClamp(q * 1.4) * Math.PI * 0.5) * (1 - anSeg(q, 0.6, 1));
        t.dy = -60 * Math.sin(anClamp(q * 1.2) * Math.PI);
        S.screen = [(ctx) => anSpeedLines(ctx, dir, 0.3 * (1 - q), frameNo)];
      });
      t.after = [];
      t.dx = t.dy = 0;
      S.screen = [];
      return;
    }
    const kind = ev.crit ? "crit" : ev.mult > 1 ? "super" : ev.mult < 1 ? "weak" : "normal";
    const heavy = big || ev.crit || ev.mult > 1, soft = ev.guarded && !ev.broke;
    const Z0 = S.cam.z;
    // arrêt sur image : images d'impact en noir et blanc (puis rouge)
    t.white = 1;
    t.whiteColor = "#ffffff";
    S.impactAt = toScreen(tx(), ty());
    const modes = soft ? [] : finisher ? ["ink", "red", "neg", "ink"] : heavy ? ["ink", "red"] : ["ink"];
    for (const [k, mode] of modes.entries()) {
      S.impact = mode;
      S.shake = finisher ? 28 : heavy ? 20 : 12;
      S.cam.z = Z0 + 0.06 + k * 0.03;
      await frame(finisher ? [120, 100, 90, 80][k] : heavy ? 90 : 70);
    }
    S.impact = null;
    // dégâts, onomatopée, étiquettes
    t.hold = finisher ? 14 : 9;
    addDmg(o, ev.dmg, kind);
    const tags = [ev.mult > 1 && ["SUPER EFFICACE ×2", "#facc15"], ev.mult < 1 && ["PEU EFFICACE…", "#94a3b8"], ev.crit && ["COUP CRITIQUE !", "#f87171"], ev.broke && ["GARDE BRISÉE !", "#fb923c"], soft && ["PARADE", "#93c5fd"], ev.interrupt && ["INTERROMPU !", "#fb923c"], ev.weakened && ["AFFAIBLI", "#cbd5e1"]].filter(Boolean);
    tags.slice(0, 2).forEach(([text, color], k) => addTag(o, text, color, k ? 18 : 22, -46 - k * 32));
    const word = soft ? "TCHANG" : ev.crit ? "KRAAAK" : P.sfx[(b.round + i + (big ? 1 : 0)) % P.sfx.length];
    addSfx(tx() + dir * 50, ty() - 128, word, soft ? AN_BLUE : P, finisher ? 92 : heavy ? 74 : 56, dir * 0.12 - 0.08);
    const n = finisher ? 16 : heavy ? 11 : 8;
    await run(n, (q) => {
      S.shake = (finisher ? 26 : heavy ? 20 : soft ? 6 : 11) * (1 - q) ** 1.5;
      S.flash = q < 0.15 ? (soft ? 0.1 : heavy ? 0.45 : 0.16) * (1 - q / 0.15) : 0;
      S.flashColor = P.light;
      S.zoomBlur = finisher || heavy ? Math.max(0, 1 - q * 2.5) : 0;
      S.zoomAt = S.impactAt;
      S.aberr = ev.crit || finisher ? 7 * Math.max(0, 1 - q * 1.6) : 0;
      t.white = Math.max(0, 1 - q * 4);
      const knock = (finisher ? 90 : heavy ? 62 : soft ? 14 : 34) * (q < 0.3 ? anOutExpo(q / 0.3) : 1 - ease.inOut((q - 0.3) / 0.7));
      t.dx = dir * knock;
      t.rot = dir * (soft ? 0.02 : 0.09) * Math.sin(q * Math.PI * 2) * (1 - q);
      setHp(o, ev.defIdx, anLerp(ev.from, ev.to, ease.out(anClamp(q * (finisher ? 1.2 : 1.7)))));
      t.shieldFlash = Math.max(0, 1 - q * 2);
      if (ev.broke) {
        t.shieldCrack = true;
        t.shield = Math.max(0, 1 - q * 1.6);
      }
      S.cam.z = Z0 + 0.1 * (1 - ease.out(q));
      S.cam.r = dir * 0.025 * (1 - q);
      const fx = [];
      if (!soft) fx.push((ctx) => ASTRE_ANIM[astre].hit(ctx, tx(), ty(), q, P, seed, heavy));
      if (ev.crit || finisher) fx.push((ctx) => anBlackFlash(ctx, tx(), ty(), q, seed + 3, finisher ? P.main : "#dc2626"));
      if (ev.guarded) fx.push((ctx) => anGuardSparks(ctx, tx() - dir * 70, ty(), q, seed + 4));
      if (ev.broke) fx.push((ctx) => anShieldShards(ctx, tx() - dir * 70, ty(), q, seed + 5));
      if (heavy) fx.push((ctx) => anGroundRing(ctx, tx(), baseY + CH / 2 + 8, q, P.main, finisher ? 420 : 260));
      if (finisher) fx.push((ctx) => fxDebris(ctx, tx(), ty(), q, seed + 6, P.main));
      S.world = fx;
    }, finisher ? [120, 100, 90, 80, 70, 60, 60, 55, 50, 50, 50, 50, 50, 50, 50, 50] : undefined);
    setHp(o, ev.defIdx, ev.to);
    S.world = [];
    S.zoomBlur = 0;
    S.aberr = 0;
    t.white = 0;
    void s;
  };

  // --- une attaque normale : élan, ruée (traînée de l'astre), impact, retour ---
  const attackBeat = async (ev) => {
    const i = ev.side, o = 1 - i, s = V[i], dir = i === 0 ? 1 : -1, att = b.players[i].team[ev.attIdx], P = anPalOf(att), astre = anAstreOf(att);
    const C0 = { ...S.cam };
    await run(4, (q) => {
      const e = ease.out(q);
      s.sy = 1 - 0.1 * e;
      s.sx = 1 + 0.06 * e;
      s.dx = -dir * 28 * e;
      s.glow = 0.6 * q;
      s.glowColor = P.main;
      camLerp(C0, { x: home[i] + dir * 50, y: baseY - 20, z: 1.14, r: -dir * 0.02 }, e);
      S.screen = [(ctx) => anFocusLines(ctx, toScreen(posOf(i).x, posOf(i).y).x, toScreen(posOf(i).x, posOf(i).y).y, 0.25 * q, frameNo, P.light, 170)];
    });
    const reach = home[o] - home[i] - dir * (CW * 0.66), C1 = { ...S.cam };
    await run(4, (q) => {
      const p = ease.in(q);
      s.sy = 1;
      s.sx = 1 + 0.28 * Math.sin(q * Math.PI);
      s.dx = anLerp(-dir * 28, reach, p);
      s.after.unshift({ x: posOf(i).x, y: posOf(i).y, a: 0.5 });
      s.after = s.after.slice(0, 5).map((a, k) => ({ ...a, a: 0.5 - k * 0.09 }));
      s.afterColor = P.main;
      camLerp(C1, { x: (home[i] + home[o]) / 2 + dir * 80, y: baseY - 20, z: 1.06, r: dir * 0.015 }, ease.inOut(q));
      S.screen = [(ctx) => anSpeedLines(ctx, dir, 0.5, frameNo)];
      S.under = [(ctx) => ASTRE_ANIM[astre].trail(ctx, [posOf(i), ...s.after.map((a) => ({ x: a.x, y: a.y }))], dir, frameNo, P)];
    });
    s.after = [];
    s.sx = 1;
    S.under = [];
    S.screen = [];
    await impact(ev, P, astre, false, false);
    await settle(5);
    clearFx();
  };

  // --- une attaque spéciale : gros plan, astre dominant, territoire, charge, déchaînement, impact ---
  const specialBeat = async (ev, finisher) => {
    const i = ev.side, o = 1 - i, s = V[i], dir = i === 0 ? 1 : -1, att = b.players[i].team[ev.attIdx], def = b.players[o].team[ev.defIdx], P = anPalOf(att), astre = anAstreOf(att);
    const seed = b.round * 131 + i * 17;
    if (finisher) {
      // ralenti : le monde perd ses couleurs, le cœur bat
      await run(
        9,
        (q) => {
          S.gray = Math.min(1, q * 1.5);
          S.letter = q;
          S.redPulse = Math.abs(Math.sin(q * Math.PI * 3));
          S.hud = 1 - q;
          S.screen = [
            (ctx) => {
              ctx.save();
              anBrushBar(ctx, W / 2, H / 2, 600, 92, 61, "rgba(0,0,0,0.92)", anOutExpo(anSeg(q, 0.1, 0.5)));
              ctx.globalAlpha = anSeg(q, 0.25, 0.55);
              fxBigText(ctx, "COUP DE GRÂCE", W / 2, H / 2 + 20, 60, "#dc2626", 1.2 - 0.2 * ease.out(q), 1);
              ctx.font = "13px CardEngrave";
              ctx.textAlign = "center";
              ctx.fillStyle = "#fecaca";
              spaced(ctx, "LA DERNIÈRE CARTE VACILLE…", W / 2, H / 2 + 70, 4);
              ctx.restore();
            },
          ];
        },
        [90, 90, 90, 100, 110, 120, 140, 170, 300]
      );
      S.screen = [];
      S.gray = 0;
      S.redPulse = 0;
      cut();
    }
    await cutIn(i, att, P);
    if (ev.mult !== 1 && !ev.dodge) await dominance(att, def, ev.mult);
    if (finisher || (ev.mult > 1 && !ev.dodge)) await deployRealm(i, astre, P);
    S.hud = finisher ? 0 : 1;
    // charge
    const C0 = { ...S.cam };
    await run(finisher ? 14 : 10, (q) => {
      camLerp(C0, { x: home[i] + dir * 30, y: baseY - 60, z: 1.2, r: -dir * 0.03 }, ease.out(q));
      s.glow = q;
      s.glowColor = P.main;
      s.dy = -24 * ease.out(q);
      s.scale = 1 + 0.08 * q;
      S.shake = (finisher ? 2 : 1) + (finisher ? 8 : 4) * q;
      S.world = [(ctx) => ASTRE_ANIM[astre].charge(ctx, posOf(i).x, posOf(i).y, q, frameNo, P)];
      const sp = toScreen(posOf(i).x, posOf(i).y);
      S.screen = q > 0.4 ? [(ctx) => anFocusLines(ctx, sp.x, sp.y, 0.45 * anSeg(q, 0.4, 1), frameNo, P.light, 190)] : [];
    });
    cut();
    // déchaînement
    const C1 = { ...S.cam }, ax = posOf(i).x, ay = posOf(i).y;
    await run(finisher ? 14 : 11, (q) => {
      camLerp(C1, { x: (home[i] + home[o]) / 2 + dir * 70, y: baseY - 40, z: 1.04, r: dir * 0.02 }, ease.inOut(anSeg(q, 0, 0.7)));
      S.shake = 5 + 7 * q;
      s.dy = -24 * (1 - q);
      S.world = [(ctx) => ASTRE_ANIM[astre].release(ctx, ax, ay, posOf(o).x, posOf(o).y, q, frameNo, P, seed)];
      S.screen = [(ctx) => anSpeedLines(ctx, dir, 0.3, frameNo)];
    });
    S.world = [];
    S.screen = [];
    cut();
    if (!finisher) S.letter = 0;
    await impact(ev, P, astre, true, finisher);
    if (!finisher) {
      await settle(5);
      if (S.realm) {
        await run(4, (q) => (S.realmA = 1 - q));
        S.realm = null;
        S.realmA = 0;
      }
      S.letter = 0;
      S.hud = 1;
    }
    clearFx();
    cut();
  };

  // --- K.O. : fissures lumineuses au ralenti, puis la carte vole en éclats ---
  const koBeat = async (ev) => {
    const i = ev.side, v = V[i], f = b.players[i].team[ev.idx], P = anPalOf(f), th = thumbs.get(f.key);
    const { x, y } = posOf(i), C0 = { ...S.cam }, CK = { x, y: y - 10, z: 1.25, r: (i ? -1 : 1) * 0.03 };
    await run(
      6,
      (q) => {
        v.crack = ease.out(q);
        v.white = q > 0.55 ? (q - 0.55) * 2.2 : 0;
        v.whiteColor = P.light;
        S.gray = 0.7 * q;
        camLerp(C0, CK, ease.out(q));
        S.shake = 2 + 4 * q;
      },
      [90, 90, 100, 110, 130, 150]
    );
    v.hidden = true;
    v.crack = 0;
    v.white = 0;
    S.gray = 0;
    addSfx(x, y - 30, "K.O.", AN_KO, 110, -0.08);
    const seed = hashOf(f.key) + ev.idx;
    await run(15, (q) => {
      S.shake = 14 * (1 - q);
      S.flash = q < 0.08 ? 0.85 : 0;
      S.flashColor = "#ffffff";
      camLerp(CK, CAM0, ease.inOut(anSeg(q, 0.45, 1)));
      S.world = [
        (ctx) => {
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          fxRays(ctx, x, y, Math.max(0, 1 - q * 1.4), P.main, 20, q);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = Math.max(0, 1 - q * 1.6);
          anInkBlob(ctx, x, y + 20, 70 + 90 * anOutExpo(q), seed, "rgba(127,29,29,0.85)");
          ctx.restore();
          fxShatter(ctx, th, x, y, CW, CH, q, seed);
          anSparks(ctx, x, y, q, seed + 1, 30, 260, [P.light, P.main, "#ffffff"], 3, 200);
        },
      ];
    });
    v.ko[ev.idx] = true;
    S.world = [];
    S.cam = { ...CAM0 };
    cut();
  };

  // --- entrée d'une carte : colonne de lumière, chute, onde de choc ---
  const enterBeat = async (ev) => {
    const i = ev.side, v = V[i], f = b.players[i].team[ev.idx], P = anPalOf(f);
    v.idx = ev.idx;
    v.hidden = false;
    v.shield = 0;
    v.shieldCrack = false;
    v.crack = 0;
    let landed = false;
    await run(11, (q) => {
      const fall = anSeg(q, 0.1, 0.5);
      v.dy = q < 0.5 ? -440 * (1 - ease.in(fall)) : -16 * Math.sin(anSeg(q, 0.5, 0.75) * Math.PI);
      const squash = q >= 0.5 && q < 0.62;
      v.sx = squash ? 1.12 : 1;
      v.sy = squash ? 0.88 : 1;
      S.shake = q >= 0.5 && q < 0.75 ? 10 : 0;
      if (q >= 0.5 && !landed) {
        landed = true;
        addSfx(home[i], baseY + 60, P.sfx[1], P, 54, 0.06);
      }
      S.world = [
        (ctx) => {
          if (q < 0.65) fxPillar(ctx, home[i], baseY + CH / 2, H, 1 - anSeg(q, 0.4, 0.65), P.main);
          if (q >= 0.5) {
            anGroundRing(ctx, home[i], baseY + CH / 2 + 8, anSeg(q, 0.5, 1), P.main, 240);
            anSmoke(ctx, home[i], baseY + CH / 2 + 4, anSeg(q, 0.5, 1), i * 9 + ev.idx, "#9ca3af", 150, 10);
          }
        },
      ];
      S.screen =
        q > 0.55
          ? [
              (ctx) => {
                const sp = toScreen(home[i], baseY + CH / 2 + 34), nq = anSeg(q, 0.55, 0.8);
                anBrushBar(ctx, sp.x, sp.y, 300, 34, ev.idx * 7 + i, "rgba(0,0,0,0.85)", anOutExpo(nq));
                ctx.save();
                ctx.globalAlpha = nq;
                ctx.textAlign = "center";
                ctx.font = `${fitText(ctx, f.name.toUpperCase(), 270, 15, "CardEngrave")}px CardEngrave`;
                ctx.fillStyle = P.light;
                ctx.fillText(f.name.toUpperCase(), sp.x, sp.y + 5);
                ctx.restore();
              },
            ]
          : [];
    });
    v.dy = 0;
    v.sx = v.sy = 1;
    clearFx();
    cut();
  };

  // --- changement de carte : nuage de fumée ---
  const switchBeat = async (ev) => {
    const i = ev.side, v = V[i], seed = b.round * 11 + i;
    await run(5, (q) => {
      v.alpha = 1 - q;
      v.sx = 1 - 0.3 * q;
      S.world = [(ctx) => anSmoke(ctx, posOf(i).x, posOf(i).y + 40, q * 0.6, seed, "#d1d5db", 150, 16)];
    });
    v.idx = ev.to;
    const P = anPalOf(fighterOf(i));
    addTag(i, "RELAIS !", P.light, 22, -40);
    await run(7, (q) => {
      v.alpha = 1;
      v.sx = Math.max(0.05, ease.back(q));
      v.glow = 1 - q;
      v.glowColor = P.main;
      S.world = [(ctx) => anSmoke(ctx, posOf(i).x, posOf(i).y + 40, 0.6 + q * 0.4, seed, "#d1d5db", 150, 16)];
    });
    v.sx = 1;
    v.glow = 0;
    clearFx();
    cut();
  };

  // --- contre-attaque de la garde : téléportation et entaille ---
  const counterBeat = async (ev) => {
    const i = ev.side, o = 1 - i, s = V[i], t = V[o], dir = i === 0 ? 1 : -1;
    await run(3, (q) => {
      s.after = [{ x: home[i], y: baseY, a: 0.7 * (1 - q) }];
      s.afterColor = "#93c5fd";
      s.alpha = 1 - q;
    });
    const near = home[o] - home[i] - dir * (CW * 0.7);
    s.dx = near;
    await run(2, (q) => {
      s.alpha = q;
      s.after = [];
    });
    S.impactAt = toScreen(posOf(o).x, posOf(o).y);
    S.impact = "ink";
    await frame(70);
    S.impact = null;
    t.hold = 8;
    addDmg(o, ev.dmg, "counter");
    addTag(o, "CONTRE !", "#93c5fd", 22, -46);
    addSfx(posOf(o).x, posOf(o).y - 140, "TCHAK", AN_BLUE, 54, -0.1);
    await run(8, (q) => {
      setHp(o, ev.defIdx, anLerp(ev.from, ev.to, ease.out(anClamp(q * 1.6))));
      t.dx = dir * 30 * Math.sin(anClamp(q * 1.2) * Math.PI);
      t.white = Math.max(0, 1 - q * 4);
      S.shake = 10 * (1 - q);
      S.world = [(ctx) => anSlashArc(ctx, posOf(o).x, posOf(o).y, 120, dir * 0.6, Math.min(1, q * 2.5), "#93c5fd", 1 - q)];
    });
    setHp(o, ev.defIdx, ev.to);
    await run(4, (q) => {
      s.dx = near * (1 - ease.inOut(q));
      s.after = q < 0.8 ? [{ x: posOf(i).x - dir * 30, y: baseY, a: 0.4 * (1 - q) }] : [];
    });
    s.dx = 0;
    s.after = [];
    t.dx = 0;
    clearFx();
  };

  // ===== la manche =====
  const finisher = res.events.find((ev) => ev.kind === "strike" && ev.type === "special" && !ev.dodge && ev.to <= 0 && b.players[1 - ev.side].team.every((f) => f.hp <= 0)) ?? null;
  // révélation des choix secrets
  await run(
    10,
    (q) => {
      S.dark = 0.6 * Math.min(1, q * 3) * (1 - anSeg(q, 0.82, 1));
      S.screen = [
        (ctx) => {
          for (const i of [0, 1]) {
            const a = res.acts[i], left = i === 0, p = b.players[i], col = ACTIONS[a.type].color;
            const inQ = anOutExpo(anSeg(q, i * 0.1, 0.4 + i * 0.1)), outQ = ease.in(anSeg(q, 0.82, 1));
            const off = (1 - inQ) * W * (left ? -1 : 1) + outQ * W * (left ? 1 : -1), y = left ? 150 : 268, h = 96;
            ctx.save();
            ctx.translate(off, 0);
            ctx.beginPath();
            ctx.moveTo(0, y + 14);
            ctx.lineTo(W, y);
            ctx.lineTo(W, y + h - 14);
            ctx.lineTo(0, y + h);
            ctx.closePath();
            const g = ctx.createLinearGradient(0, 0, W, 0);
            g.addColorStop(left ? 0 : 1, rgba(col, 0.95));
            g.addColorStop(0.62, "rgba(0,0,0,0.88)");
            g.addColorStop(left ? 1 : 0, "rgba(0,0,0,0.88)");
            ctx.fillStyle = g;
            ctx.fill();
            ctx.save();
            ctx.clip();
            anSpeedLines(ctx, left ? 1 : -1, 0.22, frameNo * 3 + i);
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#ffffff";
            ctx.stroke();
            const label = a.type === "special" ? `SPÉCIAL · ${p.team[res.startIdx[i]]?.special ?? ""}` : ACTIONS[a.type].label;
            const tx = left ? 40 : W - 40;
            ctx.textAlign = left ? "left" : "right";
            ctx.font = "13px CardEngrave";
            ctx.fillStyle = "#ffffff";
            ctx.fillText(`${p.name.toUpperCase().slice(0, 28)}${a.auto ? " · AUTOMATIQUE" : ""}`, tx, y + 32);
            const big = label.toUpperCase();
            ctx.font = `${fitText(ctx, big, W - 160, 44, "CardTitle")}px CardTitle`;
            ctx.lineWidth = 6;
            ctx.strokeStyle = "rgba(0,0,0,0.85)";
            ctx.strokeText(big, tx, y + 78);
            ctx.fillStyle = "#ffffff";
            ctx.fillText(big, tx, y + 78);
            ctx.restore();
          }
          if (q > 0.35 && q < 0.85) anSfx(ctx, "RÉVÉLATION", W / 2, 258, 30, { main: "#fde68a", light: "#ffffff", accent: "#f59e0b" }, anSeg(q, 0.35, 0.85) * 0.75, 3, 0);
        },
      ];
    },
    [60, 50, 40, 40, 50, 120, 160, 200, 50, 40]
  );
  S.screen = [];
  S.dark = 0;
  await run(3, (q) => V.forEach((v, i) => (v.shield = res.acts[i].type === "guard" ? q : 0)));
  cut();

  for (const ev of res.events) {
    if (ev.kind === "switch") await switchBeat(ev);
    else if (ev.kind === "skip") {
      addTag(ev.side, "TROP TARD…", "#a1a1aa", 22, -40);
      await run(5, (q) => (V[ev.side].dx = Math.sin(q * Math.PI * 4) * 6 * (1 - q)));
      V[ev.side].dx = 0;
    } else if (ev.kind === "ko") await koBeat(ev);
    else if (ev.kind === "enter") await enterBeat(ev);
    else if (ev.kind === "counter") await counterBeat(ev);
    else if (ev.kind === "strike") {
      if (ev.type === "special") await specialBeat(ev, ev === finisher);
      else await attackBeat(ev);
    }
  }

  // ===== fin : victoire en apothéose, ou on laisse retomber puis on fige =====
  if (finisher) {
    const wi = finisher.side, f = fighterOf(wi), P = anPalOf(f), big = await cardThumb(f.card, isHoloKey(f.key), 300, 420);
    S.realm ??= anAstreOf(f);
    S.realmA = 1;
    S.realmClip = null;
    S.cam = { ...CAM0 };
    V[0].hidden = V[1].hidden = true;
    S.hud = 0;
    S.letter = 0;
    clearFx();
    cut();
    await run(
      22,
      (q) => {
        S.dark = 0.4;
        S.screen = [
          (ctx) => {
            ctx.save();
            ctx.globalCompositeOperation = "screen";
            fxRays(ctx, W / 2, H / 2 + 10, Math.min(1, q * 2), P.main, 32, q * 1.2);
            ctx.restore();
            const e = ease.back(anSeg(q, 0.05, 0.4)), sc = 0.55 + 0.27 * e, fl = Math.sin(q * Math.PI * 2) * 4;
            glow(ctx, W / 2, H / 2 + 20, 300, P.main, 0.7 * e);
            ctx.save();
            ctx.translate(W / 2, H / 2 + 18 + fl);
            ctx.scale(sc, sc);
            ctx.drawImage(big, -150, -210, 300, 420);
            ctx.restore();
            const R = seeded(b.round * 3);
            for (let k = 0; k < 50; k++) {
              const x = R() * W, sp = 0.6 + R(), y = H + 20 - ((q * 520 * sp + R() * H) % (H + 40));
              sparkle(ctx, x, y, 1.5 + R() * 3, k % 3 ? P.light : P.main);
            }
            const tq = anSeg(q, 0.15, 0.45);
            anBrushBar(ctx, W / 2, 66, 560, 78, 81, "rgba(0,0,0,0.9)", anOutExpo(tq));
            fxBigText(ctx, "VICTOIRE", W / 2, 88, 62, P.main, 1.4 - 0.4 * ease.back(tq), tq);
            const nq = anSeg(q, 0.35, 0.6);
            anBrushBar(ctx, W / 2, H - 42, 480, 46, 83, "rgba(0,0,0,0.88)", anOutExpo(nq));
            ctx.save();
            ctx.globalAlpha = nq;
            ctx.textAlign = "center";
            ctx.font = "20px CardEngrave";
            ctx.fillStyle = P.light;
            spaced(ctx, b.players[wi].name.toUpperCase().slice(0, 26), W / 2, H - 35, 4);
            ctx.restore();
          },
        ];
      },
      [...Array(21).fill(60), 3200]
    );
  } else {
    await run(4, () => {}, [60, 60, 60, 2400]);
  }
  flush();
  enc.finish();
  return { buffer: Buffer.from(enc.bytes()), duration: duration - (finisher ? 3200 : 2400), frames: wrote };
}

// la manche animée ; trop lourde pour Discord, elle est refaite plus petite ; en cas de pépin, l'ancienne animation
async function clashGif(b, res, hp0, pre) {
  const bg = arenaBackground(AN_BW, AN_BH); // le décor (et les objets posés) avant toute attente
  try {
    // taille de départ selon la longueur prévue de la manche (environ 78 ko par image en pleine taille)
    const frames = 17 + res.events.reduce((n, ev) => n + (ev.kind === "strike" ? (ev.type === "special" ? 62 + (ev.mult !== 1 ? 13 : 0) + (ev.mult > 1 ? 18 : 0) : 27) : { ko: 21, enter: 11, counter: 17, switch: 12 }[ev.kind] ?? 5), 0);
    const finale = res.events.some((ev) => ev.kind === "strike" && ev.type === "special" && ev.to <= 0) ? 50 : 0;
    let scale = Math.min(1, Math.max(0.55, Math.sqrt((AN_MAX_BYTES * 0.9) / ((frames + finale) * 78000))));
    let out = await animeClashGif(b, res, hp0, pre, bg, scale);
    if (out.buffer.length > AN_MAX_BYTES) {
      scale = Math.max(0.5, scale * Math.sqrt(AN_MAX_BYTES / out.buffer.length) * 0.94);
      out = await animeClashGif(b, res, hp0, pre, bg, scale);
    }
    if (out.buffer.length <= AN_MAX_BYTES) return out;
    console.error(`Animation de combat trop lourde (${Math.round(out.buffer.length / 1024)} ko) : animation classique`);
  } catch (err) {
    console.error("Animation de combat (anime):", err.stack ?? err.message);
  }
  return classicClashGif(b, res, hp0, pre);
}
