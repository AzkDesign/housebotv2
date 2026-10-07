
// --- Les Astres : faiblesses et résistances en combat ---
// Chaque carte de combat appartient à un astre. Le cycle : Soleil → Givre → Orage → Étoile → Ombre → Lune → Soleil.
// Frapper l'astre qu'on domine : dégâts ×2. Frapper l'astre qui nous domine : dégâts ×0,5. Sinon : neutre.
const ASTRES = {
  soleil: { label: "Soleil", emoji: "☀️", color: "#f59e0b", why: "le soleil fait fondre le givre" },
  givre: { label: "Givre", emoji: "❄️", color: "#38bdf8", why: "le froid fige l'orage en neige" },
  orage: { label: "Orage", emoji: "⚡", color: "#8b5cf6", why: "les nuées d'orage cachent les étoiles" },
  etoile: { label: "Étoile", emoji: "⭐", color: "#facc15", why: "la lumière des étoiles perce l'ombre" },
  ombre: { label: "Ombre", emoji: "🌑", color: "#6b21a8", why: "l'ombre de la Terre éclipse la Lune" },
  lune: { label: "Lune", emoji: "🌙", color: "#94a3b8", why: "la Lune éclipse le Soleil" },
};
const ASTRE_BEATS = { soleil: "givre", givre: "orage", orage: "etoile", etoile: "ombre", ombre: "lune", lune: "soleil" };
const ASTRE_STRONG = 2, ASTRE_WEAK = 0.5;
// l'élément visuel de la carte donne son astre
const ELEMENT_ASTRE = { feu: "soleil", eau: "givre", glace: "givre", foudre: "orage", air: "orage", lumiere: "etoile", chance: "etoile", ombre: "ombre", nature: "lune", pierre: "lune" };
const BOSS_ASTRE = { spectre: "ombre", dragon: "soleil", automate: "orage", rat: "lune", ogre: "etoile", seine: "givre" };
// cartes fixes : un astre choisi selon le thème, pour que chaque astre ait autant de cartes
const CARD_ASTRE = {
  soleil: ["p_croissant", "p_baguette", "p_opera", "p_moulin", "p_versailles", "m_repas", "m_casino", "m_jackpot", "ev_jackpot", "ev_champion", "hw_citrouille"],
  givre: ["p_seine", "p_bateau", "m_contrat", "hs_valence", "xm_cookie", "xm_cloche", "xm_flocon", "xm_bonhomme", "xm_renne", "xm_cadeau", "xm_sapin"],
  orage: ["p_metro", "p_cafe", "p_pigeon", "p_eiffel", "m_double", "m_irf", "m_penthouse", "m_dictateur", "m_urne", "m_facture", "hw_chauve"],
  etoile: ["p_montmartre", "p_champs", "p_notredame", "p_louvre", "p_ame", "m_star", "m_code", "m_maire", "m_croupier", "ev_star", "ev_maire", "ev_podium"],
  ombre: ["p_marais", "p_catacombes", "hw_bonbon", "hw_araignee", "hw_chat", "hw_fantome", "hs_augustin", "hs_jeu", "hs_velours", "hs_delorme", "hs_contrat", "hs_chambre", "hs_fondateur"],
  lune: ["p_belleville", "p_luxembourg", "p_haussmann", "m_valise", "m_airbnb", "m_mairie", "m_papillon", "m_fondation", "m_suite", "m_cle", "sh_trefle", "hw_lune", "hs_sablier", "hs_cle"],
};
const ASTRE_BY_ID = Object.fromEntries(Object.entries(CARD_ASTRE).flatMap(([a, ids]) => ids.map((id) => [id, a])));
// membres : selon leur point fort
const STAT_ASTRE = { ACT: "orage", ANC: "lune", FOR: "soleil", STA: "etoile", CHA: "givre" };
// un coup super efficace ne retire jamais plus des 2/3 des PV max d'une carte (pas de K.O. en un coup)
const ASTRE_CAP = 2 / 3;
function astreOf(card) {
  if (!card || card.id?.startsWith("ut_")) return null;
  if (card.boss) return BOSS_ASTRE[card.boss.key] ?? "ombre";
  if (ASTRE_BY_ID[card.id]) return ASTRE_BY_ID[card.id];
  if (card.duo?.emblem === "🌙") return "lune";
  if (card.memberStats && !card.duo) {
    const best = Object.keys(STAT_ASTRE).sort((a, b) => (card.memberStats[b] ?? 0) - (card.memberStats[a] ?? 0))[0];
    return STAT_ASTRE[best];
  }
  return ELEMENT_ASTRE[elementOf(card)] ?? "etoile";
}
const astreLabel = (a) => (a && ASTRES[a] ? `${ASTRES[a].emoji} ${ASTRES[a].label}` : "—");
const astreWeakTo = (a) => Object.keys(ASTRE_BEATS).find((x) => ASTRE_BEATS[x] === a) ?? null;
// multiplicateur de dégâts entre deux combattants (ou deux astres)
function astreMult(att, def) {
  const a = typeof att === "string" ? att : att?.astre ?? astreOf(att?.card);
  const d = typeof def === "string" ? def : def?.astre ?? astreOf(def?.card);
  if (!a || !d) return 1;
  if (ASTRE_BEATS[a] === d) return ASTRE_STRONG;
  if (ASTRE_BEATS[d] === a) return ASTRE_WEAK;
  return 1;
}
const ASTRE_RULES =
  "**Astres** : ☀️ Soleil bat ❄️ Givre, qui bat ⚡ Orage, qui bat ⭐ Étoile, qui bat 🌑 Ombre, qui bat 🌙 Lune, qui bat ☀️ Soleil. " +
  "Frapper l'astre qu'on domine : **dégâts ×2** (jamais plus des 2/3 des PV d'une carte en un coup). Frapper l'astre qui nous domine : **dégâts ×0,5**.";

// petit symbole vectoriel de l'astre (les polices des cartes n'ont pas les émojis)
function astreIcon(ctx, a, x, y, r, color = null) {
  const def = ASTRES[a];
  if (!def) return;
  const col = color ?? def.color;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.2, r * 0.22);
  ctx.beginPath();
  if (a === "soleil") {
    ctx.arc(0, 0, r * 0.48, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const an = (k / 8) * TAU;
      ctx.moveTo(Math.cos(an) * r * 0.68, Math.sin(an) * r * 0.68);
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
    }
    ctx.stroke();
  } else if (a === "givre") {
    for (let k = 0; k < 3; k++) {
      const an = (k / 3) * Math.PI + Math.PI / 2;
      ctx.moveTo(Math.cos(an) * r, Math.sin(an) * r);
      ctx.lineTo(-Math.cos(an) * r, -Math.sin(an) * r);
    }
    for (let k = 0; k < 6; k++) {
      const an = (k / 6) * TAU + Math.PI / 2, px = Math.cos(an) * r * 0.6, py = Math.sin(an) * r * 0.6;
      for (const s of [-1, 1]) {
        const b = an + s * 0.7;
        ctx.moveTo(px, py);
        ctx.lineTo(px + Math.cos(b) * r * 0.32, py + Math.sin(b) * r * 0.32);
      }
    }
    ctx.stroke();
  } else if (a === "orage") {
    ctx.moveTo(r * 0.25, -r);
    ctx.lineTo(-r * 0.55, r * 0.12);
    ctx.lineTo(-r * 0.02, r * 0.12);
    ctx.lineTo(-r * 0.3, r);
    ctx.lineTo(r * 0.6, -r * 0.2);
    ctx.lineTo(r * 0.05, -r * 0.2);
    ctx.closePath();
    ctx.fill();
  } else if (a === "etoile") {
    for (let k = 0; k < 10; k++) {
      const an = -Math.PI / 2 + (k / 10) * TAU, rr = k % 2 ? r * 0.42 : r;
      ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (a === "ombre") {
    // éclipse : anneau lumineux et couronne de rayons autour d'un disque vide
    ctx.lineWidth = Math.max(1.2, r * 0.2);
    ctx.arc(0, 0, r * 0.55, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 12; k++) {
      const an = (k / 12) * TAU, l = k % 2 ? 0.82 : 1;
      ctx.moveTo(Math.cos(an) * r * 0.72, Math.sin(an) * r * 0.72);
      ctx.lineTo(Math.cos(an) * r * l, Math.sin(an) * r * l);
    }
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.stroke();
  } else if (a === "lune") {
    const p = new Path2D();
    p.arc(0, 0, r * 0.9, 0, TAU);
    p.arc(r * 0.42, -r * 0.22, r * 0.75, 0, TAU);
    ctx.fill(p, "evenodd");
  }
  ctx.restore();
}
// orbe d'astre (en-tête des cartes)
function astreOrb(ctx, a, x, y, r) {
  const col = ASTRES[a]?.color ?? "#94a3b8";
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, shade(col, 1.6));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shade(col, 0.45));
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  disc(ctx, x, y, r, g);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r - 0.5, 0, TAU);
  ctx.stroke();
  astreIcon(ctx, a, x, y, r * 0.58, "#ffffff");
}

// petite roue des astres (guide, patch note)
function drawAstreWheel(size = 520) {
  const c = createCanvas(size, size), ctx = c.getContext("2d"), cx = size / 2, cy = size / 2, R = size * 0.31;
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.7);
  bg.addColorStop(0, "#1e1b4b");
  bg.addColorStop(1, "#05030f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  const R2 = seeded(7);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.2 + R2() * 0.6;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(R2() * size, R2() * size, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
  const keys = Object.keys(ASTRE_BEATS), pos = (k) => {
    const an = -Math.PI / 2 + (keys.indexOf(k) / keys.length) * TAU;
    return [cx + Math.cos(an) * R, cy + Math.sin(an) * R];
  };
  // flèches « bat »
  for (const k of keys) {
    const [x1, y1] = pos(k), [x2, y2] = pos(ASTRE_BEATS[k]), an = Math.atan2(y2 - y1, x2 - x1), off = size * 0.085;
    const sx = x1 + Math.cos(an) * off, sy = y1 + Math.sin(an) * off, ex = x2 - Math.cos(an) * off, ey = y2 - Math.sin(an) * off;
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, ASTRES[k].color);
    g.addColorStop(1, "rgba(255,255,255,0.8)");
    ctx.strokeStyle = g;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - Math.cos(an - 0.45) * 16, ey - Math.sin(an - 0.45) * 16);
    ctx.lineTo(ex - Math.cos(an + 0.45) * 16, ey - Math.sin(an + 0.45) * 16);
    ctx.closePath();
    ctx.fill();
    ctx.font = `bold ${Math.round(size * 0.032)}px CardBold`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fde68a";
    ctx.fillText("×2", (sx + ex) / 2 + Math.cos(an - Math.PI / 2) * 16, (sy + ey) / 2 + Math.sin(an - Math.PI / 2) * 16 + 5);
  }
  for (const k of keys) {
    const [x, y] = pos(k), r = size * 0.07, an = Math.atan2(y - cy, x - cx), lr = r + size * 0.05;
    const g = ctx.createRadialGradient(x, y - r * 0.4, 0, x, y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.25, ASTRES[k].color);
    g.addColorStop(1, shade(ASTRES[k].color, 0.4));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    astreIcon(ctx, k, x, y, r * 0.55, "#ffffff");
    ctx.font = `${Math.round(size * 0.036)}px CardBold`;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = Math.cos(an) > 0.3 ? "left" : Math.cos(an) < -0.3 ? "right" : "center";
    ctx.fillText(ASTRES[k].label.toUpperCase(), x + Math.cos(an) * (r + 8), y + Math.sin(an) * lr + size * 0.013);
  }
  ctx.textAlign = "center";
  ctx.font = `${Math.round(size * 0.05)}px CardBold`;
  ctx.fillStyle = "#fde68a";
  ctx.fillText("LES ASTRES", cx, cy - 4);
  ctx.font = `${Math.round(size * 0.026)}px CardText`;
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText("domine : dégâts ×2", cx, cy + 20);
  ctx.fillText("dominé : dégâts ×0,5", cx, cy + 40);
  ctx.textAlign = "left";
  return c;
}
