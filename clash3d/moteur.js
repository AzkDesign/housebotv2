// Clash de la Maison en 3D : le moteur de rendu (logiciel, sans carte graphique).
// - Les objets sont des maillages de triangles construits en code (boîtes, cylindres, sphères, toits…).
// - Rendu par tuiles avec « tampon de visibilité » : chaque pixel n'est éclairé qu'une seule fois.
// - Suréchantillonnage (2 × 2 points par pixel) pour des bords lisses.
// - Éclairage physique simplifié : soleil + ombres douces (carte des ombres), ciel et rebond du sol,
//   reflets selon la rugosité et le métal, matières procédurales (pierre, bois, tuiles, marbre, herbe…),
//   brume de profondeur, puis réglage d'exposition « cinéma » (ACES).
// Le résultat d'un rendu est un calque RGBA + profondeur, qu'on superpose ensuite (bâtiments, soldats).

// ---------- couleurs ----------
const toLin = (v) => Math.pow(v / 255, 2.2);
function linColor(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [toLin(n >> 16), toLin((n >> 8) & 255), toLin(n & 255)];
}

// ---------- bruit ----------
function h2(x, y) {
  let h = (Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
function n2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, y, oct = 3) {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    s += a * n2(x * f + i * 17.3, y * f - i * 9.1);
    norm += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / norm;
}
// bruit 3D peu coûteux : deux plans croisés
const n3 = (x, y, z) => 0.5 * (n2(x + z * 0.71, y - z * 0.37) + n2(z + y * 0.53, x - y * 0.29));
const smooth = (a, b, x) => {
  const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a);
  return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);

// ---------- matériaux ----------
const PAT = { plain: 0, grass: 1, rock: 2, brick: 3, ashlar: 4, wood: 5, tiles: 6, marble: 7, leaf: 9, cloth: 10, dirt: 11, sand: 12, window: 13, glow: 14, bark: 16, ore: 17, char: 18, water: 19, straw: 21, skin: 22, flame: 23, scales: 24 };
// hasard 3D (écailles)
const h3 = (x, y, z) => fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);
function material(o) {
  return {
    c: linColor(o.c ?? "#ffffff"),
    c2: linColor(o.c2 ?? o.c ?? "#ffffff"),
    c3: linColor(o.c3 ?? o.c2 ?? o.c ?? "#ffffff"),
    rough: o.rough ?? 0.85,
    metal: o.metal ?? 0,
    emit: o.emit ? linColor(o.emit).map((v) => v * (o.ei ?? 1)) : null,
    pat: PAT[o.pat ?? "plain"],
    ds: Boolean(o.ds),
    wrap: o.wrap ?? 0,
    sc: o.sc ?? 1,
    name: o.name ?? "",
  };
}

// ---------- construction des maillages ----------
// Transformations affines (pile), sommets en coordonnées locales -> monde.
class Mesh {
  constructor() {
    this.p = [];
    this.n = [];
    this.m = [];
    this.o = [];
    this.mat = 0;
    this.obj = 0;
    this.T = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]; // 3 colonnes + translation
    this.stack = [];
    this.NM = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  setMat(i) {
    this.mat = i;
    return this;
  }
  setObj(i) {
    this.obj = i;
    return this;
  }
  push() {
    this.stack.push([this.T.slice(), this.NM.slice()]);
    return this;
  }
  pop() {
    [this.T, this.NM] = this.stack.pop();
    return this;
  }
  _apply(M) {
    // T = T * M  (M : 3x3 + translation en colonnes)
    const T = this.T, R = new Array(12);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) R[c * 3 + r] = T[r] * M[c * 3] + T[3 + r] * M[c * 3 + 1] + T[6 + r] * M[c * 3 + 2];
    for (let r = 0; r < 3; r++) R[9 + r] = T[r] * M[9] + T[3 + r] * M[10] + T[6 + r] * M[11] + T[9 + r];
    this.T = R;
    // matrice des normales : inverse transposée de la partie 3x3
    const a = R[0], b = R[3], c = R[6], d = R[1], e = R[4], f = R[7], g = R[2], h = R[5], i = R[8];
    const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g), G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
    const det = a * A + b * B + c * C || 1;
    // colonnes de la normale = lignes de l'inverse
    // rangée en colonnes : NM[col * 3 + ligne] = cofacteur(ligne, col) / det
    this.NM = [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
    return this;
  }
  translate(x, y, z) {
    return this._apply([1, 0, 0, 0, 1, 0, 0, 0, 1, x, y, z]);
  }
  scale(x, y = x, z = x) {
    return this._apply([x, 0, 0, 0, y, 0, 0, 0, z, 0, 0, 0]);
  }
  rotY(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this._apply([c, 0, -s, 0, 1, 0, s, 0, c, 0, 0, 0]);
  }
  rotX(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this._apply([1, 0, 0, 0, c, s, 0, -s, c, 0, 0, 0]);
  }
  rotZ(t) {
    const c = Math.cos(t), s = Math.sin(t);
    return this._apply([c, s, 0, -s, c, 0, 0, 0, 1, 0, 0, 0]);
  }
  _pt(v) {
    const T = this.T;
    return [T[0] * v[0] + T[3] * v[1] + T[6] * v[2] + T[9], T[1] * v[0] + T[4] * v[1] + T[7] * v[2] + T[10], T[2] * v[0] + T[5] * v[1] + T[8] * v[2] + T[11]];
  }
  _nr(v) {
    const M = this.NM;
    const x = M[0] * v[0] + M[3] * v[1] + M[6] * v[2], y = M[1] * v[0] + M[4] * v[1] + M[7] * v[2], z = M[2] * v[0] + M[5] * v[1] + M[8] * v[2];
    const l = Math.hypot(x, y, z) || 1;
    return [x / l, y / l, z / l];
  }
  // triangle en coordonnées locales ; normales facultatives (sinon : normale de la face)
  tri(a, b, c, na = null, nb = null, nc = null) {
    const A = this._pt(a), B = this._pt(b), C = this._pt(c);
    let N0, N1, N2;
    if (na) {
      N0 = this._nr(na);
      N1 = this._nr(nb);
      N2 = this._nr(nc);
    } else {
      const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      N0 = N1 = N2 = [nx / l, ny / l, nz / l];
    }
    this.p.push(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2]);
    this.n.push(N0[0], N0[1], N0[2], N1[0], N1[1], N1[2], N2[0], N2[1], N2[2]);
    this.m.push(this.mat);
    this.o.push(this.obj);
    return this;
  }
  // quadrilatère a b c d (dans l'ordre, sens trigonométrique vu de l'extérieur)
  quad(a, b, c, d, n = null) {
    this.tri(a, b, c, n, n, n);
    this.tri(a, c, d, n, n, n);
    return this;
  }
  box(x0, y0, z0, x1, y1, z1, { bottom = false, top = true } = {}) {
    const P = (x, y, z) => [x, y, z];
    // faces : +x, -x, +z, -z, +y, -y (sens trigonométrique vu de l'extérieur)
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), [1, 0, 0]);
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), [-1, 0, 0]);
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), [0, 0, 1]);
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), [0, 0, -1]);
    if (top) this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), [0, 1, 0]);
    if (bottom) this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), [0, -1, 0]);
    return this;
  }
  // boîte centrée au sol : demi-largeurs hx, hz, hauteur h
  block(hx, h, hz, y0 = 0, opts) {
    return this.box(-hx, y0, -hz, hx, y0 + h, hz, opts);
  }
  // cylindre (ou cône tronqué) autour de l'axe y, base en y0
  cyl(r, h, { r2 = r, seg = 18, y0 = 0, top = true, bottom = false, smooth = true, a0 = 0, a1 = Math.PI * 2 } = {}) {
    const full = Math.abs(a1 - a0 - Math.PI * 2) < 1e-6;
    const slope = (r - r2) / (h || 1);
    for (let i = 0; i < seg; i++) {
      const t0 = a0 + ((a1 - a0) * i) / seg, t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
      const c0 = Math.cos(t0), s0 = Math.sin(t0), c1 = Math.cos(t1), s1 = Math.sin(t1);
      const b0 = [c0 * r, y0, s0 * r], b1 = [c1 * r, y0, s1 * r], u0 = [c0 * r2, y0 + h, s0 * r2], u1 = [c1 * r2, y0 + h, s1 * r2];
      if (smooth) {
        const nA = [c0, slope, s0], nB = [c1, slope, s1];
        if (r2 > 0.0001) {
          this.tri(b0, u1, b1, nA, nB, nB);
          this.tri(b0, u0, u1, nA, nA, nB);
        } else {
          const nm = [(c0 + c1) / 2, slope, (s0 + s1) / 2];
          this.tri(b0, u0, b1, nA, nm, nB);
        }
      } else {
        if (r2 > 0.0001) this.quad(b0, u0, u1, b1);
        else this.tri(b0, u0, b1);
      }
      if (top && r2 > 0.0001) this.tri([0, y0 + h, 0], u1, u0, [0, 1, 0], [0, 1, 0], [0, 1, 0]);
      if (bottom) this.tri([0, y0, 0], b0, b1, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
    }
    if (!full && top) {
      // côtés plats d'un demi-cylindre
    }
    return this;
  }
  // sphère (ou ellipsoïde) ; hemi = moitié haute ; disp(nx, ny, nz) -> facteur de rayon
  sphere(r, { seg = 14, rings = 10, sx = 1, sy = 1, sz = 1, hemi = false, disp = null, y0 = 0, facet = false } = {}) {
    const R = hemi ? rings : rings;
    const pt = (i, j) => {
      const th = (i / seg) * Math.PI * 2, ph = hemi ? (j / R) * (Math.PI / 2) : (j / R) * Math.PI;
      const nx = Math.cos(th) * Math.sin(ph), ny = Math.cos(ph), nz = Math.sin(th) * Math.sin(ph);
      const k = disp ? disp(nx, ny, nz) : 1;
      return [[nx * r * sx * k, y0 + ny * r * sy * k, nz * r * sz * k], [nx / sx, ny / sy, nz / sz]];
    };
    const grid = [];
    for (let j = 0; j <= R; j++) {
      const row = [];
      for (let i = 0; i <= seg; i++) row.push(pt(i % seg, j));
      grid.push(row);
    }
    // forme déformée et lisse (feuillage) : normales moyennées sur les faces voisines
    if (disp && !facet) {
      const acc = grid.map((row) => row.map(() => [0, 0, 0]));
      const fn = (p, q, w) => {
        const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = w[0] - p[0], vy = w[1] - p[1], vz = w[2] - p[2];
        return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      };
      for (let j = 0; j < R; j++)
        for (let i = 0; i < seg; i++) {
          const n = fn(grid[j][i][0], grid[j][i + 1][0], grid[j + 1][i + 1][0]), n2b = fn(grid[j][i][0], grid[j + 1][i + 1][0], grid[j + 1][i][0]);
          for (const [jj, ii] of [[j, i], [j, i + 1], [j + 1, i + 1], [j + 1, i]]) {
            const t = acc[jj][ii];
            t[0] += n[0] + n2b[0];
            t[1] += n[1] + n2b[1];
            t[2] += n[2] + n2b[2];
          }
        }
      // la couture (i = 0 et i = seg) partage la même normale
      for (let j = 0; j <= R; j++) {
        const A = acc[j][0], B = acc[j][seg];
        for (let k = 0; k < 3; k++) A[k] = B[k] = A[k] + B[k];
      }
      // les pôles : moyenne de la rangée
      for (const j of [0, R]) {
        const m = [0, 0, 0];
        for (let i = 0; i <= seg; i++) for (let k = 0; k < 3; k++) m[k] += acc[j][i][k];
        for (let i = 0; i <= seg; i++) acc[j][i] = m.slice();
      }
      const nz = (v) => {
        const l = Math.hypot(v[0], v[1], v[2]) || 1;
        return [v[0] / l, v[1] / l, v[2] / l];
      };
      for (let j = 0; j < R; j++)
        for (let i = 0; i < seg; i++) {
          const a = grid[j][i][0], b = grid[j][i + 1][0], c = grid[j + 1][i + 1][0], d = grid[j + 1][i][0];
          const na = nz(acc[j][i]), nb = nz(acc[j][i + 1]), nc = nz(acc[j + 1][i + 1]), nd = nz(acc[j + 1][i]);
          if (j > 0) this.tri(a, b, c, na, nb, nc);
          this.tri(a, c, d, na, nc, nd);
        }
      return this;
    }
    for (let j = 0; j < R; j++)
      for (let i = 0; i < seg; i++) {
        const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
        if (disp) {
          // normales recalculées par face pour un aspect rocheux / feuillu
          // ordre (a, b, c) : normale vers l'extérieur
          if (j > 0) this.tri(a[0], b[0], c[0]);
          this.tri(a[0], c[0], d[0]);
        } else {
          if (j > 0) this.tri(a[0], c[0], b[0], a[1], c[1], b[1]);
          this.tri(a[0], d[0], c[0], a[1], d[1], c[1]);
        }
      }
    return this;
  }
  // toit en croupe : base rectangulaire (demi-côtés hx, hz) à y0, faîtage le long de x
  roofHip(hx, hz, h, { ridge = 0.35, y0 = 0 } = {}) {
    const rx = hx * ridge;
    const A = [-hx, y0, hz], B = [hx, y0, hz], C = [hx, y0, -hz], D = [-hx, y0, -hz], E = [-rx, y0 + h, 0], F = [rx, y0 + h, 0];
    this.quad(A, B, F, E);
    this.quad(C, D, E, F);
    this.tri(B, C, F);
    this.tri(D, A, E);
    return this;
  }
  // toit à deux pans (pignons triangulaires) ; faîtage le long de x
  roofGable(hx, hz, h, { y0 = 0, gableMat = null } = {}) {
    const A = [-hx, y0, hz], B = [hx, y0, hz], C = [hx, y0, -hz], D = [-hx, y0, -hz], E = [-hx, y0 + h, 0], F = [hx, y0 + h, 0];
    this.quad(A, B, F, E);
    this.quad(C, D, E, F);
    const keep = this.mat;
    if (gableMat !== null) this.setMat(gableMat);
    this.tri(B, C, F);
    this.tri(D, A, E);
    this.setMat(keep);
    return this;
  }
  // prisme (tente) : base rectangulaire, arête en haut le long de x
  pyramid(hx, hz, h, { y0 = 0 } = {}) {
    const A = [-hx, y0, hz], B = [hx, y0, hz], C = [hx, y0, -hz], D = [-hx, y0, -hz], T = [0, y0 + h, 0];
    this.tri(A, B, T);
    this.tri(B, C, T);
    this.tri(C, D, T);
    this.tri(D, A, T);
    return this;
  }
  // tore simple (anneaux, roues)
  torus(R, r, { seg = 20, tube = 8 } = {}) {
    const pt = (i, j) => {
      const u = (i / seg) * Math.PI * 2, v = (j / tube) * Math.PI * 2;
      const cx = Math.cos(u), sz = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      return [[(R + r * cv) * cx, r * sv, (R + r * cv) * sz], [cv * cx, sv, cv * sz]];
    };
    for (let i = 0; i < seg; i++)
      for (let j = 0; j < tube; j++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
        this.tri(a[0], b[0], c[0], a[1], b[1], c[1]);
        this.tri(a[0], c[0], d[0], a[1], c[1], d[1]);
      }
    return this;
  }
  // prisme vertical à partir d'un polygone (sens trigonométrique vu du dessus)
  extrude(pts, y0, y1, { top = true, center = false } = {}) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % pts.length];
      this.quad([x0, y0, z0], [x1, y0, z1], [x1, y1, z1], [x0, y1, z0]);
    }
    if (top && center) {
      // éventail depuis le centre : convient aux formes étoilées
      const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], q = pts[(i + 1) % pts.length];
        this.tri([cx, y1, cz], [q[0], y1, q[1]], [p[0], y1, p[1]], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
      }
    } else if (top) for (let i = 1; i < pts.length - 1; i++) this.tri([pts[0][0], y1, pts[0][1]], [pts[i + 1][0], y1, pts[i + 1][1]], [pts[i][0], y1, pts[i][1]], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
    return this;
  }
  compile() {
    return { P: Float32Array.from(this.p), N: Float32Array.from(this.n), M: Uint16Array.from(this.m), O: Int32Array.from(this.o), count: this.m.length };
  }
}

// ---------- carte des ombres ----------
// withIds : retient aussi quel objet fait l'ombre (pour effacer l'ombre d'un bâtiment détruit)
function shadowMap(meshes, sun, filter = null, withIds = false) {
  const S = sun.size, map = new Float32Array(S * S).fill(Infinity), vp = sun.vp, ids = withIds ? new Int32Array(S * S).fill(-1) : null;
  for (const mesh of meshes) {
    const { P, O, count } = mesh;
    for (let t = 0; t < count; t++) {
      if (filter && !filter(O[t])) continue;
      const xs = [0, 0, 0], ys = [0, 0, 0], zs = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        const x = P[t * 9 + k * 3], y = P[t * 9 + k * 3 + 1], z = P[t * 9 + k * 3 + 2];
        xs[k] = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) * 0.5 + 0.5) * S;
        ys[k] = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) * 0.5) * S;
        zs[k] = (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) * 0.5 + 0.5;
      }
      let A = (xs[1] - xs[0]) * (ys[2] - ys[0]) - (xs[2] - xs[0]) * (ys[1] - ys[0]);
      if (Math.abs(A) < 1e-9) continue;
      const sg = A < 0 ? -1 : 1;
      A *= sg;
      const minx = Math.max(0, Math.floor(Math.min(xs[0], xs[1], xs[2]))), maxx = Math.min(S - 1, Math.ceil(Math.max(xs[0], xs[1], xs[2])));
      const miny = Math.max(0, Math.floor(Math.min(ys[0], ys[1], ys[2]))), maxy = Math.min(S - 1, Math.ceil(Math.max(ys[0], ys[1], ys[2])));
      for (let py = miny; py <= maxy; py++) {
        const cy = py + 0.5;
        for (let px = minx; px <= maxx; px++) {
          const cx = px + 0.5;
          const w0 = sg * ((xs[2] - xs[1]) * (cy - ys[1]) - (ys[2] - ys[1]) * (cx - xs[1]));
          if (w0 < 0) continue;
          const w1 = sg * ((xs[0] - xs[2]) * (cy - ys[2]) - (ys[0] - ys[2]) * (cx - xs[2]));
          if (w1 < 0) continue;
          const w2 = A - w0 - w1;
          if (w2 < 0) continue;
          const z = (w0 * zs[0] + w1 * zs[1] + w2 * zs[2]) / A, i = py * S + px;
          if (z < map[i]) {
            map[i] = z;
            if (ids) ids[i] = O[t];
          }
        }
      }
    }
  }
  return { map, ids, vp, S, dir: sun.dir, unit: sun.unit ?? 0.01 };
}
// objets qui font de l'ombre au point (x, y, z) (5 échantillons, comme les ombres douces)
function shadowCasters(sm, x, y, z) {
  const vp = sm.vp, S = sm.S, out = new Set();
  if (!sm.ids) return out;
  const sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) * 0.5 + 0.5) * S;
  const sy = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) * 0.5) * S;
  const d = (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) * 0.5 + 0.5 - sm.unit * 1.5;
  for (let k = 0; k < 10; k += 2) {
    const px = Math.floor(sx + PCF[k]), py = Math.floor(sy + PCF[k + 1]);
    if (px < 0 || py < 0 || px >= S || py >= S) continue;
    const i = py * S + px;
    if (d > sm.map[i] && sm.ids[i] >= 0) out.add(sm.ids[i]);
  }
  return out;
}
// part de lumière du soleil reçue en (x, y, z) : 0 = ombre, 1 = plein soleil (5 échantillons)
const PCF = [0, 0, 1.3, 0.5, -0.5, 1.3, -1.3, -0.5, 0.5, -1.3];
function sunVisibility(sm, x, y, z, bias) {
  const vp = sm.vp, S = sm.S;
  const sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) * 0.5 + 0.5) * S;
  const sy = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) * 0.5) * S;
  const d = (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) * 0.5 + 0.5 - bias;
  let lit = 0;
  for (let k = 0; k < 10; k += 2) {
    const px = Math.floor(sx + PCF[k]), py = Math.floor(sy + PCF[k + 1]);
    if (px < 0 || py < 0 || px >= S || py >= S) {
      lit++;
      continue;
    }
    if (d <= sm.map[py * S + px]) lit++;
  }
  return lit / 5;
}

// ---------- éclairage d'un point ----------
// env : { mats, eye, sun: { dir, color }, shadow, sky: [haut], ground: [bas], fog: { color, start, density }, exposure, terrain }
const SC = new Float64Array(3);
function shadePoint(env, mat, px, py, pz, nx, ny, nz, obj) {
  let ar = mat.c[0], ag = mat.c[1], ab = mat.c[2];
  let rough = mat.rough, metal = mat.metal, ao = 1, er = 0, eg = 0, eb = 0, wrap = mat.wrap;
  const sc = mat.sc;
  // coordonnée horizontale le long de la face (pour les motifs des murs)
  const ux = Math.abs(nx) > Math.abs(nz) ? pz : px, vertical = Math.abs(ny) < 0.7;
  switch (mat.pat) {
    case 24: {
      // écailles de dragon : cellules 3D (Voronoï), sillons sombres entre elles, reflet propre à chaque écaille
      const k = 6.5 * sc, x = px * k, y = py * k, z = pz * k, cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
      let f1 = 9, f2 = 9, hv = 0;
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (let l = -1; l <= 1; l++) {
            const gx = cx + i, gy = cy + j, gz = cz + l;
            const dx = gx + h3(gx, gy, gz) - x, dy = gy + h3(gy, gz, gx) - y, dz = gz + h3(gz, gx, gy) - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < f1) (f2 = f1), (f1 = d), (hv = h3(gx + 0.5, gy, gz));
            else if (d < f2) f2 = d;
          }
      const edge = smooth(0, 0.35, Math.sqrt(f2) - Math.sqrt(f1)), dome = 1 - Math.min(1, Math.sqrt(f1) * 1.2);
      const kk = (0.35 + 0.65 * edge) * (0.8 + 0.35 * hv) * (0.85 + 0.3 * dome);
      ar = mat.c[0] * kk + mat.c2[0] * dome * 0.35;
      ag = mat.c[1] * kk + mat.c2[1] * dome * 0.35;
      ab = mat.c[2] * kk + mat.c2[2] * dome * 0.35;
      rough = mat.rough * (1.25 - 0.5 * edge);
      ao *= 0.7 + 0.3 * edge;
      break;
    }
    case 1: {
      // herbe (dessus de l'île) : nuances, touffes, chemins pavés, ombre au pied des bâtiments
      const T = env.terrain;
      // trois échelles : grandes plaques (sèches / grasses), touffes, brins
      const big = fbm2(px * 0.11 + 7, pz * 0.11, 3), mid = n2(px * 0.9, pz * 0.9), clump = n2(px * 3.1 + 4, pz * 3.1), fine = h2(Math.floor(px * 24), Math.floor(pz * 24));
      const dry = smooth(0.52, 0.78, big), lush = 1 - smooth(0.22, 0.48, big);
      const k0 = 0.78 + 0.28 * mid + 0.22 * (clump - 0.5);
      ar = (0.026 + 0.05 * dry - 0.006 * lush) * k0 + 0.006 * fine;
      ag = (0.068 + 0.03 * dry + 0.02 * lush) * k0 + 0.014 * fine;
      ab = (0.012 + 0.006 * dry) * k0;
      // brins d'herbe : petites stries sombres/claires, et quelques trèfles plus foncés
      const blade = h2(Math.floor(px * 46), Math.floor(pz * 46 + px * 3));
      if (blade > 0.84) (ar *= 1.3), (ag *= 1.35), (ab *= 1.1);
      else if (blade < 0.14) (ar *= 0.62), (ag *= 0.66), (ab *= 0.7);
      if (clump < 0.22) (ar *= 0.75), (ag *= 0.85);
      nx += (fine - 0.5) * 0.25;
      nz += (clump - 0.5) * 0.25;
      if (T) {
        // chemins pavés
        let dmin = 9;
        const P = T.paths;
        for (let k = 0; k < P.length; k += 4) {
          const ax = P[k], az = P[k + 1], bx = P[k + 2], bz = P[k + 3];
          const vx = bx - ax, vz = bz - az, wx = px - ax, wz = pz - az, l2 = vx * vx + vz * vz || 1;
          let tt = (wx * vx + wz * vz) / l2;
          tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
          const dx = wx - vx * tt, dz = wz - vz * tt, d = dx * dx + dz * dz;
          if (d < dmin) dmin = d;
        }
        const dpath = Math.sqrt(dmin), wobble = (n2(px * 2.1, pz * 2.1) - 0.5) * 0.18;
        const pm = 1 - smooth(0.34, 0.5, dpath + wobble);
        if (pm > 0) {
          // pavés irréguliers : cellules décalées
          const cs = 0.3, gx = px / cs, gz = pz / cs + (Math.floor(px / cs) & 1) * 0.5;
          const fx = fract(gx), fz = fract(gz), hv = h2(Math.floor(gx), Math.floor(gz));
          const gap = Math.min(fx, 1 - fx, fz, 1 - fz);
          const stone = 0.11 + 0.09 * hv, mort = smooth(0.02, 0.09, gap);
          const sr = stone * (0.95 + 0.1 * hv) * (0.45 + 0.55 * mort), sg = stone * 0.92 * (0.45 + 0.55 * mort), sb = stone * 0.8 * (0.45 + 0.55 * mort);
          // bord de terre battue autour du chemin
          const dirt = smooth(0.25, 0.45, dpath + wobble) * pm;
          ar = ar * (1 - pm) + (sr * (1 - dirt) + 0.12 * dirt) * pm;
          ag = ag * (1 - pm) + (sg * (1 - dirt) + 0.075 * dirt) * pm;
          ab = ab * (1 - pm) + (sb * (1 - dirt) + 0.04 * dirt) * pm;
          rough = 0.75;
        }
        // occlusion : l'herbe s'assombrit au pied des bâtiments
        const F = T.foot;
        for (let k = 0; k < F.length; k += 4) {
          const dx = Math.max(0, Math.abs(px - F[k]) - F[k + 2]), dz = Math.max(0, Math.abs(pz - F[k + 1]) - F[k + 3]);
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 1.2) ao *= 1 - 0.55 * Math.exp(-d * 3.2);
        }
      }
      wrap = 0.15;
      break;
    }
    case 2: {
      // roche des falaises : strates ondulées, veines, mousse en haut
      const warp = n2(px * 0.35 + pz * 0.2, py * 0.4) * 2.6;
      const band = 0.5 + 0.5 * Math.sin(py * 2.6 + warp + n2(px * 0.8, pz * 0.8) * 1.2);
      const grain = n2(px * 2.4 + py, pz * 2.4 - py), spk = h2(Math.floor(px * 14 + pz * 3), Math.floor(py * 14));
      const k = 0.62 + 0.38 * band;
      ar = (mat.c[0] * (1 - band) + mat.c2[0] * band) * (0.8 + 0.3 * grain) * k;
      ag = (mat.c[1] * (1 - band) + mat.c2[1] * band) * (0.8 + 0.3 * grain) * k;
      ab = (mat.c[2] * (1 - band) + mat.c2[2] * band) * (0.8 + 0.3 * grain) * k;
      if (spk > 0.93) (ar *= 1.4), (ag *= 1.4), (ab *= 1.4);
      // sillons des strates : la normale suit les couches
      const groove = Math.cos(py * 2.6 + warp) * 0.35;
      ny += groove;
      // mousse sous le rebord d'herbe
      // mousse seulement sous le rebord d'herbe des falaises (pas sur les rochers posés au sol)
      const moss = smooth(-1.8, -0.7, py) * (1 - smooth(-0.35, -0.05, py)) * (0.5 + 0.5 * n2(px * 1.7, pz * 1.7));
      if (moss > 0.05) {
        ar = ar * (1 - moss) + 0.04 * moss;
        ag = ag * (1 - moss) + 0.1 * moss;
        ab = ab * (1 - moss) + 0.02 * moss;
      }
      // le dessous s'assombrit
      ao = 0.55 + 0.45 * smooth(-14, -2, py);
      break;
    }
    case 3:
    case 4: {
      // briques (3) ou pierre de taille (4)
      const bw = (mat.pat === 3 ? 0.3 : 0.52) * sc, bh = (mat.pat === 3 ? 0.13 : 0.28) * sc;
      let u = ux, v = py;
      if (!vertical) (u = px), (v = pz);
      const row = Math.floor(v / bh), off = (row & 1) * 0.5;
      const cu = u / bw + off, col = Math.floor(cu);
      const fu = cu - col, fv = v / bh - row;
      const hv = h2(col + 31, row * 7 + 3);
      const mw = mat.pat === 3 ? 0.07 : 0.045, mh = mat.pat === 3 ? 0.1 : 0.06;
      const mortar = fu < mw || fu > 1 - mw || fv < mh || fv > 1 - mh;
      if (mortar) {
        ar = mat.c3[0];
        ag = mat.c3[1];
        ab = mat.c3[2];
        ao *= 0.7;
      } else {
        const tint = 0.78 + 0.4 * hv, nn = 0.85 + 0.3 * n2(u * 9, v * 9);
        const mix2 = smooth(0.55, 0.95, hv);
        ar = (mat.c[0] * (1 - mix2) + mat.c2[0] * mix2) * tint * nn;
        ag = (mat.c[1] * (1 - mix2) + mat.c2[1] * mix2) * tint * nn;
        ab = (mat.c[2] * (1 - mix2) + mat.c2[2] * mix2) * tint * nn;
        // bord des blocs légèrement bombé
        if (vertical) {
          const e = (fv - 0.5) * 0.25;
          ny += e;
        }
      }
      break;
    }
    case 5: {
      // planches de bois : veinage, nœuds, interstices
      const pw = 0.17 * sc, along = vertical ? ux : px, cross = vertical ? py : pz;
      const id = Math.floor(along / pw), f = along / pw - id, hv = h2(id, 7);
      const grain = 0.5 + 0.5 * Math.sin(cross * 9 + n2(along * 4, cross * 0.8) * 6 + hv * 10);
      const k = (0.72 + 0.35 * hv) * (0.82 + 0.25 * grain);
      ar = mat.c[0] * k;
      ag = mat.c[1] * k;
      ab = mat.c[2] * k;
      if (f < 0.07 || f > 0.95) (ar *= 0.35), (ag *= 0.35), (ab *= 0.35), (ao *= 0.8);
      const knot = n2(along * 3.1 + 11, cross * 3.1);
      if (knot > 0.82) (ar *= 0.6), (ag *= 0.55), (ab *= 0.5);
      break;
    }
    case 6: {
      // tuiles : rangées horizontales, chaque tuile recouvre la suivante
      const th = 0.12 * sc, tw = 0.15 * sc;
      const row = Math.floor(py / th), fv = py / th - row;
      const cu = ux / tw + (row & 1) * 0.5, col = Math.floor(cu), fu = cu - col, hv = h2(col, row + 40);
      const lap = 0.55 + 0.45 * smooth(0, 0.85, fv);
      const tint = 0.8 + 0.35 * hv;
      ar = mat.c[0] * tint * lap;
      ag = mat.c[1] * tint * lap;
      ab = mat.c[2] * tint * lap;
      if (fu < 0.05 || fu > 0.95) (ar *= 0.6), (ag *= 0.6), (ab *= 0.6);
      // tuiles usées / mousse
      const age = n2(px * 1.5, pz * 1.5 + py);
      if (age > 0.7) (ar = ar * 0.8 + 0.01), (ag = ag * 0.8 + 0.02), (ab *= 0.8);
      break;
    }
    case 7: {
      // marbre : veines dorées et grises
      const u = vertical ? ux : px, v = vertical ? py : pz;
      const w = fbm2(u * 0.9 + 3, v * 0.9, 3);
      const vein = Math.abs(Math.sin((u * 1.3 + v * 0.7) * 2.2 + w * 9));
      const fine2 = smooth(0.0, 0.035, vein), grey = smooth(0.0, 0.25, Math.abs(Math.sin((u - v) * 3 + w * 5)));
      ar = mat.c[0] * (0.92 + 0.08 * w);
      ag = mat.c[1] * (0.92 + 0.08 * w);
      ab = mat.c[2] * (0.92 + 0.08 * w);
      if (fine2 < 1) {
        const k = (1 - fine2) * 0.55;
        ar = ar * (1 - k) + mat.c2[0] * k;
        ag = ag * (1 - k) + mat.c2[1] * k;
        ab = ab * (1 - k) + mat.c2[2] * k;
        metal = 0.6 * k;
      }
      ar *= 0.93 + 0.07 * grey;
      ag *= 0.93 + 0.07 * grey;
      ab *= 0.93 + 0.07 * grey;
      rough = 0.35;
      // grands blocs
      const bh = 0.55 * sc, row = Math.floor(v / bh), fv = v / bh - row, cu = u / (0.8 * sc) + (row & 1) * 0.5, fu = fract(cu);
      if (fv < 0.03 || fu < 0.02) (ar *= 0.72), (ag *= 0.7), (ab *= 0.66);
      break;
    }
    case 9: {
      // feuillage : touffes claires et sombres, lumière qui traverse
      const cl = n3(px * 3.2, py * 3.2, pz * 3.2), fine3 = h2(Math.floor(px * 18 + py * 5), Math.floor(pz * 18 - py * 7));
      const k = 0.55 + 0.6 * cl + 0.15 * fine3;
      ar = mat.c[0] * k;
      ag = mat.c[1] * k;
      ab = mat.c[2] * k;
      if (cl > 0.62) {
        const t = smooth(0.62, 0.85, cl);
        ar = ar * (1 - t) + mat.c2[0] * t;
        ag = ag * (1 - t) + mat.c2[1] * t;
        ab = ab * (1 - t) + mat.c2[2] * t;
      }
      nx += (fine3 - 0.5) * 0.6;
      nz += (n2(px * 9, pz * 9) - 0.5) * 0.6;
      ao = 0.65 + 0.35 * cl;
      wrap = 0.45;
      break;
    }
    case 10: {
      // toile tissée
      const u = vertical ? ux : px, v = vertical ? py : pz;
      const weave = 0.92 + 0.08 * Math.sin(u * 120) * Math.sin(v * 120), stain = 0.85 + 0.2 * n2(u * 1.5, v * 1.5);
      ar *= weave * stain;
      ag *= weave * stain;
      ab *= weave * stain;
      wrap = 0.3;
      break;
    }
    case 11: {
      // terre battue et cailloux
      const g = n2(px * 1.6, pz * 1.6), p = h2(Math.floor(px * 9), Math.floor(pz * 9));
      const k = 0.75 + 0.35 * g;
      ar *= k;
      ag *= k;
      ab *= k;
      if (p > 0.9) (ar *= 1.5), (ag *= 1.45), (ab *= 1.4);
      break;
    }
    case 12: {
      // sacs de sable : coutures et toile
      const g = n2(px * 6, pz * 6 + py * 4);
      ar *= 0.85 + 0.25 * g;
      ag *= 0.85 + 0.25 * g;
      ab *= 0.85 + 0.25 * g;
      if (Math.abs(fract(py * 9) - 0.5) < 0.04) (ar *= 0.7), (ag *= 0.7), (ab *= 0.7);
      break;
    }
    case 13: {
      // fenêtre éclairée : croisillons et lueur chaude
      const u = fract(ux * 4.2), v = fract(py * 4.2);
      const bar = Math.abs(u - 0.5) < 0.06 || Math.abs(v - 0.5) < 0.06;
      if (bar) {
        ar = mat.c2[0];
        ag = mat.c2[1];
        ab = mat.c2[2];
      } else {
        const fl = 0.75 + 0.25 * n2(px * 3, pz * 3 + py * 3);
        ar = 0.02;
        ag = 0.015;
        ab = 0.01;
        er = mat.emit[0] * fl;
        eg = mat.emit[1] * fl;
        eb = mat.emit[2] * fl;
        rough = 0.1;
      }
      break;
    }
    case 14: {
      // liquide lumineux (essence)
      const sw = 0.75 + 0.25 * n2(px * 5, py * 5 + pz * 5);
      er = mat.emit[0] * sw;
      eg = mat.emit[1] * sw;
      eb = mat.emit[2] * sw;
      rough = 0.15;
      break;
    }
    case 16: {
      // écorce
      const u = Math.atan2(nz, nx) * 2;
      const s = 0.6 + 0.4 * Math.abs(Math.sin(u * 5 + n2(u, py * 3) * 4));
      ar *= s;
      ag *= s;
      ab *= s;
      break;
    }
    case 17: {
      // minerai d'or : paillettes brillantes
      const sp = h2(Math.floor(px * 31 + pz * 17), Math.floor(py * 29 - pz * 13));
      const vein = n2(px * 1.8 + pz, py * 2.2);
      if (sp > 0.9 && vein > 0.55) {
        ar = 0.9;
        ag = 0.6;
        ab = 0.12;
        metal = 1;
        rough = 0.25;
        er = 0.25;
        eg = 0.15;
        eb = 0.02;
      }
      break;
    }
    case 18: {
      // décombres calcinés, braises
      const g = n2(px * 3, pz * 3 + py * 2), b = h2(Math.floor(px * 12), Math.floor(pz * 12 + py * 12));
      const k = 0.5 + 0.5 * g;
      ar *= k;
      ag *= k;
      ab *= k;
      if (b > 0.95) (er = 1.4), (eg = 0.35), (eb = 0.05);
      break;
    }
    case 19: {
      rough = 0.08;
      break;
    }
    case 21: {
      // paille
      const s = 0.7 + 0.3 * Math.abs(Math.sin(px * 40 + py * 3));
      ar *= s;
      ag *= s;
      ab *= s;
      break;
    }
    case 22: {
      // peau
      wrap = 0.35;
      break;
    }
    case 23: {
      // flamme
      er = mat.emit[0];
      eg = mat.emit[1];
      eb = mat.emit[2];
      ar = ag = ab = 0;
      break;
    }
    default:
      break;
  }
  if (mat.emit && mat.pat !== 13 && mat.pat !== 14 && mat.pat !== 23) {
    er += mat.emit[0];
    eg += mat.emit[1];
    eb += mat.emit[2];
  }
  // pieds des murs plus sombres (occlusion au contact du sol)
  if (vertical && py < 1 && py > -0.3 && mat.pat !== 2 && mat.pat !== 1) ao *= 0.6 + 0.4 * smooth(-0.05, 0.9, py);
  // normale perturbée : renormaliser
  let nl = Math.hypot(nx, ny, nz) || 1;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const eye = env.eye;
  let vx = eye[0] - px, vy = eye[1] - py, vz = eye[2] - pz;
  const dist = Math.hypot(vx, vy, vz);
  vx /= dist;
  vy /= dist;
  vz /= dist;
  // une face vue de dos (toile, drapeau) : retourner la normale
  if (nx * vx + ny * vy + nz * vz < 0 && mat.ds) (nx = -nx), (ny = -ny), (nz = -nz);
  const L = env.sun.dir, sunC = env.sun.color;
  const ndl = nx * L[0] + ny * L[1] + nz * L[2];
  let sh = 0;
  if (ndl > -0.3 && env.shadow) {
    const off = 0.05;
    sh = sunVisibility(env.shadow, px + nx * off, py + ny * off, pz + nz * off, env.shadow.unit * (0.6 + 1.6 * (1 - Math.max(0, ndl))));
  } else if (!env.shadow) sh = 1;
  const diff = Math.max(0, ndl) * (1 - wrap) + Math.max(0, (ndl + wrap) / (1 + wrap)) * wrap;
  // ciel (bleu en haut, rebond chaud en bas)
  const hy = 0.5 + 0.5 * ny, S1 = env.sky, G1 = env.ground;
  const amR = (G1[0] + (S1[0] - G1[0]) * hy) * ao, amG = (G1[1] + (S1[1] - G1[1]) * hy) * ao, amB = (G1[2] + (S1[2] - G1[2]) * hy) * ao;
  const kd = 1 - metal;
  let r = ar * kd * (sunC[0] * diff * sh + amR), g = ag * kd * (sunC[1] * diff * sh + amG), b = ab * kd * (sunC[2] * diff * sh + amB);
  // reflet spéculaire (Blinn-Phong normalisé + Fresnel de Schlick)
  let hx = L[0] + vx, hy2 = L[1] + vy, hz = L[2] + vz;
  const hl = Math.hypot(hx, hy2, hz) || 1;
  hx /= hl;
  hy2 /= hl;
  hz /= hl;
  const ndh = Math.max(0, nx * hx + ny * hy2 + nz * hz), ndv = Math.max(0, nx * vx + ny * vy + nz * vz);
  const r4 = Math.max(0.02, rough * rough), shin = Math.min(2048, 2 / (r4 * r4) - 2);
  const fres = 1 - ndv, f5 = fres * fres * fres * fres * fres;
  const F0r = 0.04 * kd + ar * metal, F0g = 0.04 * kd + ag * metal, F0b = 0.04 * kd + ab * metal;
  if (ndl > 0 && sh > 0) {
    const spec = ((shin + 8) / 25.13) * Math.pow(ndh, shin) * ndl * sh;
    r += sunC[0] * spec * (F0r + (1 - F0r) * f5);
    g += sunC[1] * spec * (F0g + (1 - F0g) * f5);
    b += sunC[2] * spec * (F0b + (1 - F0b) * f5);
  }
  // reflet de l'environnement : on regarde ce que la direction réfléchie « voit » (ciel, horizon chaud, sol)
  const rdv = 2 * (nx * vx + ny * vy + nz * vz), ry = rdv * ny - vy;
  const sk = ry > 0 ? ry : 0, gr = ry < 0 ? -ry : 0, hz2 = 1 - Math.abs(ry);
  const H1 = env.horizon ?? S1;
  const envR = S1[0] * sk + G1[0] * gr * 0.8 + H1[0] * hz2 * hz2 * 1.2, envG = S1[1] * sk + G1[1] * gr * 0.8 + H1[1] * hz2 * hz2 * 1.2, envB = S1[2] * sk + G1[2] * gr * 0.8 + H1[2] * hz2 * hz2 * 1.2;
  const shine = (1 - rough) * (1 - rough);
  const kr = (F0r + (1 - F0r) * f5) * shine * ao, kg = (F0g + (1 - F0g) * f5) * shine * ao, kb = (F0b + (1 - F0b) * f5) * shine * ao;
  r += envR * kr * (1 + metal);
  g += envG * kg * (1 + metal);
  b += envB * kb * (1 + metal);
  // métal un peu « mat » : il garde sa couleur même hors reflet
  if (metal > 0) {
    r += ar * metal * (amR * 0.55 + sunC[0] * diff * sh * 0.25);
    g += ag * metal * (amG * 0.55 + sunC[1] * diff * sh * 0.25);
    b += ab * metal * (amB * 0.55 + sunC[2] * diff * sh * 0.25);
  }
  r += er;
  g += eg;
  b += eb;
  // brume de profondeur
  const F = env.fog;
  if (F) {
    const fa = 1 - Math.exp(-Math.max(0, dist - F.start) * F.density) + Math.max(0, -py - F.below) * F.belowK;
    const k = fa > 0.92 ? 0.92 : fa;
    r += (F.color[0] - r) * k;
    g += (F.color[1] - g) * k;
    b += (F.color[2] - b) * k;
  }
  SC[0] = r;
  SC[1] = g;
  SC[2] = b;
  return SC;
}

// réglage d'exposition ACES puis gamma : valeur linéaire -> 0..255
function aces(x) {
  const v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return v <= 0 ? 0 : v >= 1 ? 255 : Math.pow(v, 1 / 2.2) * 255;
}

// ---------- le rendu ----------
// meshes : maillages compilés ; cam : caméra (math.js) ; env : éclairage ; opts : { ss, region, filter }
// Renvoie un calque { x0, y0, w, h, rgba (couleur non prémultipliée + couverture), depth }.
const TILE = 64;
function render(meshes, cam, env, opts = {}) {
  const ss = opts.ss ?? 2, W = cam.width, H = cam.height, IW = W * ss, IH = H * ss;
  const reg = opts.region ?? [0, 0, W, H];
  const rx0 = Math.max(0, Math.floor(reg[0])), ry0 = Math.max(0, Math.floor(reg[1])), rx1 = Math.min(W, Math.ceil(reg[2])), ry1 = Math.min(H, Math.ceil(reg[3]));
  const rw = Math.max(0, rx1 - rx0), rh = Math.max(0, ry1 - ry0);
  const out = { x0: rx0, y0: ry0, w: rw, h: rh, rgba: new Uint8ClampedArray(rw * rh * 4), depth: new Float32Array(rw * rh).fill(Infinity) };
  if (!rw || !rh) return out;
  const ix0 = rx0 * ss, iy0 = ry0 * ss, ix1 = rx1 * ss, iy1 = ry1 * ss;
  const vp = cam.vp, eye = cam.eye, mats = env.mats, filter = opts.filter;
  // 1. projection des triangles
  let total = 0;
  for (const m of meshes) total += m.count;
  const TV = new Float32Array(total * 12), TM = new Int32Array(total), TT = new Int32Array(total);
  let nt = 0;
  meshes.forEach((mesh, mi) => {
    const { P, N, M, O, count } = mesh;
    for (let t = 0; t < count; t++) {
      if (filter && !filter(O[t])) continue;
      const mat = mats[M[t]], b = t * 9;
      if (!mat.ds) {
        const cx = (P[b] + P[b + 3] + P[b + 6]) / 3, cy = (P[b + 1] + P[b + 4] + P[b + 7]) / 3, cz = (P[b + 2] + P[b + 5] + P[b + 8]) / 3;
        const fx = N[b] + N[b + 3] + N[b + 6], fy = N[b + 1] + N[b + 4] + N[b + 7], fz = N[b + 2] + N[b + 5] + N[b + 8];
        if (fx * (eye[0] - cx) + fy * (eye[1] - cy) + fz * (eye[2] - cz) < 0) continue;
      }
      const o = nt * 12;
      let ok = true, mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      for (let k = 0; k < 3; k++) {
        const x = P[b + k * 3], y = P[b + k * 3 + 1], z = P[b + k * 3 + 2];
        const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
        if (cw < 0.05) {
          ok = false;
          break;
        }
        const iw = 1 / cw;
        const sx = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) * iw * 0.5 + 0.5) * IW;
        const sy = (0.5 - (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) * iw * 0.5) * IH;
        TV[o + k * 4] = sx;
        TV[o + k * 4 + 1] = sy;
        TV[o + k * 4 + 2] = (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) * iw;
        TV[o + k * 4 + 3] = iw;
        if (sx < mnx) mnx = sx;
        if (sx > mxx) mxx = sx;
        if (sy < mny) mny = sy;
        if (sy > mxy) mxy = sy;
      }
      if (!ok || mxx < ix0 || mnx > ix1 || mxy < iy0 || mny > iy1) continue;
      TM[nt] = mi;
      TT[nt] = t;
      nt++;
    }
  });
  // 2. répartition dans les tuiles
  const tx = Math.ceil((ix1 - ix0) / TILE), ty = Math.ceil((iy1 - iy0) / TILE);
  const counts = new Int32Array(tx * ty);
  const span = (k) => {
    const o = k * 12;
    const mnx = Math.min(TV[o], TV[o + 4], TV[o + 8]), mxx = Math.max(TV[o], TV[o + 4], TV[o + 8]);
    const mny = Math.min(TV[o + 1], TV[o + 5], TV[o + 9]), mxy = Math.max(TV[o + 1], TV[o + 5], TV[o + 9]);
    return [Math.max(0, Math.floor((mnx - ix0) / TILE)), Math.min(tx - 1, Math.floor((mxx - ix0) / TILE)), Math.max(0, Math.floor((mny - iy0) / TILE)), Math.min(ty - 1, Math.floor((mxy - iy0) / TILE))];
  };
  const spans = new Int32Array(nt * 4);
  for (let k = 0; k < nt; k++) {
    const [a, b2, c, d] = span(k);
    spans[k * 4] = a;
    spans[k * 4 + 1] = b2;
    spans[k * 4 + 2] = c;
    spans[k * 4 + 3] = d;
    for (let j = c; j <= d; j++) for (let i = a; i <= b2; i++) counts[j * tx + i]++;
  }
  const starts = new Int32Array(tx * ty + 1);
  for (let i = 0; i < tx * ty; i++) starts[i + 1] = starts[i] + counts[i];
  const binIdx = new Int32Array(starts[tx * ty]), fill = starts.slice(0, tx * ty);
  for (let k = 0; k < nt; k++) {
    const a = spans[k * 4], b2 = spans[k * 4 + 1], c = spans[k * 4 + 2], d = spans[k * 4 + 3];
    for (let j = c; j <= d; j++) for (let i = a; i <= b2; i++) binIdx[fill[j * tx + i]++] = k;
  }
  // 3. chaque tuile : visibilité, puis éclairage et réduction ss × ss -> 1 pixel
  const zb = new Float32Array(TILE * TILE), id = new Int32Array(TILE * TILE), L1 = new Float32Array(TILE * TILE), L2 = new Float32Array(TILE * TILE);
  const cr = new Float32Array(TILE * TILE), cg = new Float32Array(TILE * TILE), cb = new Float32Array(TILE * TILE);
  const nss = ss * ss;
  for (let tyI = 0; tyI < ty; tyI++)
    for (let txI = 0; txI < tx; txI++) {
      const bi = tyI * tx + txI, b0 = starts[bi], b1 = starts[bi + 1];
      if (b0 === b1) continue;
      const X0 = ix0 + txI * TILE, Y0 = iy0 + tyI * TILE, X1 = Math.min(ix1, X0 + TILE), Y1 = Math.min(iy1, Y0 + TILE), TW = X1 - X0;
      zb.fill(Infinity);
      id.fill(-1);
      for (let q = b0; q < b1; q++) {
        const k = binIdx[q], o = k * 12;
        let x0 = TV[o], y0 = TV[o + 1], x1 = TV[o + 4], y1 = TV[o + 5], x2 = TV[o + 8], y2 = TV[o + 9];
        const z0 = TV[o + 2], z1 = TV[o + 6], z2 = TV[o + 10];
        let A = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
        if (A === 0) continue;
        const sg = A < 0 ? -1 : 1;
        A *= sg;
        const invA = 1 / A;
        const minx = Math.max(X0, Math.floor(Math.min(x0, x1, x2))), maxx = Math.min(X1 - 1, Math.ceil(Math.max(x0, x1, x2)));
        const miny = Math.max(Y0, Math.floor(Math.min(y0, y1, y2))), maxy = Math.min(Y1 - 1, Math.ceil(Math.max(y0, y1, y2)));
        if (minx > maxx || miny > maxy) continue;
        // fonctions d'arête (incrémentales en x)
        const e0dx = -sg * (y2 - y1), e1dx = -sg * (y0 - y2);
        for (let py = miny; py <= maxy; py++) {
          const cy = py + 0.5, cx0 = minx + 0.5;
          let w0 = sg * ((x2 - x1) * (cy - y1) - (y2 - y1) * (cx0 - x1));
          let w1 = sg * ((x0 - x2) * (cy - y2) - (y0 - y2) * (cx0 - x2));
          let row = (py - Y0) * TILE + (minx - X0);
          for (let px = minx; px <= maxx; px++, w0 += e0dx, w1 += e1dx, row++) {
            if (w0 < 0 || w1 < 0) continue;
            const w2 = A - w0 - w1;
            if (w2 < 0) continue;
            const l0 = w0 * invA, l1 = w1 * invA, l2 = 1 - l0 - l1;
            const z = l0 * z0 + l1 * z1 + l2 * z2;
            if (z < zb[row] && z > -1) {
              zb[row] = z;
              id[row] = k;
              L1[row] = l1;
              L2[row] = l2;
            }
          }
        }
      }
      // éclairage des échantillons visibles (seulement les pixels demandés si un masque est donné)
      const pmask = opts.mask;
      for (let py = Y0; py < Y1; py++)
        for (let px = X0; px < X1; px++) {
          const s = (py - Y0) * TILE + (px - X0), k = id[s];
          if (k < 0) continue;
          if (pmask && !pmask[(Math.floor(py / ss) - ry0) * rw + (Math.floor(px / ss) - rx0)]) {
            id[s] = -1;
            continue;
          }
          const o = k * 12, l1 = L1[s], l2 = L2[s], l0 = 1 - l1 - l2;
          const q0 = l0 * TV[o + 3], q1 = l1 * TV[o + 7], q2 = l2 * TV[o + 11], qs = 1 / (q0 + q1 + q2);
          const c0 = q0 * qs, c1 = q1 * qs, c2 = q2 * qs;
          const mesh = meshes[TM[k]], t = TT[k], bb = t * 9, P = mesh.P, N = mesh.N;
          const wx = c0 * P[bb] + c1 * P[bb + 3] + c2 * P[bb + 6], wy = c0 * P[bb + 1] + c1 * P[bb + 4] + c2 * P[bb + 7], wz = c0 * P[bb + 2] + c1 * P[bb + 5] + c2 * P[bb + 8];
          let nx = c0 * N[bb] + c1 * N[bb + 3] + c2 * N[bb + 6], ny = c0 * N[bb + 1] + c1 * N[bb + 4] + c2 * N[bb + 7], nz = c0 * N[bb + 2] + c1 * N[bb + 5] + c2 * N[bb + 8];
          const nl = Math.hypot(nx, ny, nz) || 1;
          const col = shadePoint(env, mats[mesh.M[t]], wx, wy, wz, nx / nl, ny / nl, nz / nl, mesh.O[t]);
          const ex = env.exposure;
          cr[s] = aces(col[0] * ex);
          cg[s] = aces(col[1] * ex);
          cb[s] = aces(col[2] * ex);
        }
      // réduction vers les pixels de sortie
      const ox0 = X0 / ss, oy0 = Y0 / ss, ox1 = X1 / ss, oy1 = Y1 / ss;
      for (let oy = oy0; oy < oy1; oy++)
        for (let ox = ox0; ox < ox1; ox++) {
          let n = 0, r = 0, g = 0, b = 0, dmin = Infinity;
          for (let sy = 0; sy < ss; sy++)
            for (let sx = 0; sx < ss; sx++) {
              const s = (oy * ss + sy - Y0) * TILE + (ox * ss + sx - X0);
              if (id[s] < 0) continue;
              n++;
              r += cr[s];
              g += cg[s];
              b += cb[s];
              if (zb[s] < dmin) dmin = zb[s];
            }
          if (!n) continue;
          const oi = (oy - ry0) * rw + (ox - rx0), p4 = oi * 4;
          out.rgba[p4] = r / n;
          out.rgba[p4 + 1] = g / n;
          out.rgba[p4 + 2] = b / n;
          out.rgba[p4 + 3] = (n / nss) * 255;
          out.depth[oi] = dmin;
        }
    }
  return out;
}

// ---------- superposition des calques ----------
// dst : { w, h, rgba, depth } plein écran ; layer : calque (x0, y0, w, h) ; test de profondeur et couverture.
function composite(dst, layer) {
  const W = dst.w;
  for (let y = 0; y < layer.h; y++) {
    const dy = y + layer.y0;
    if (dy < 0 || dy >= dst.h) continue;
    for (let x = 0; x < layer.w; x++) {
      const li = y * layer.w + x, a = layer.rgba[li * 4 + 3];
      if (!a) continue;
      const dx = x + layer.x0;
      if (dx < 0 || dx >= W) continue;
      const di = dy * W + dx, d4 = di * 4, l4 = li * 4;
      const da = dst.rgba[d4 + 3];
      if (layer.depth[li] <= dst.depth[di] || !da) {
        // le calque est devant
        const k = a / 255, ik = 1 - k;
        dst.rgba[d4] = layer.rgba[l4] * k + dst.rgba[d4] * ik;
        dst.rgba[d4 + 1] = layer.rgba[l4 + 1] * k + dst.rgba[d4 + 1] * ik;
        dst.rgba[d4 + 2] = layer.rgba[l4 + 2] * k + dst.rgba[d4 + 2] * ik;
        dst.rgba[d4 + 3] = Math.min(255, a + da * ik);
        if (layer.depth[li] < dst.depth[di]) dst.depth[di] = layer.depth[li];
      } else if (da < 255) {
        // le calque est derrière un bord semi-couvert : il complète le pixel
        const k = (a / 255) * (1 - da / 255), tot = da / 255 + k;
        dst.rgba[d4] = (dst.rgba[d4] * (da / 255) + layer.rgba[l4] * k) / tot;
        dst.rgba[d4 + 1] = (dst.rgba[d4 + 1] * (da / 255) + layer.rgba[l4 + 1] * k) / tot;
        dst.rgba[d4 + 2] = (dst.rgba[d4 + 2] * (da / 255) + layer.rgba[l4 + 2] * k) / tot;
        dst.rgba[d4 + 3] = Math.min(255, tot * 255);
      }
    }
  }
}
// calque vide plein écran
function emptyLayer(w, h) {
  return { x0: 0, y0: 0, w, h, rgba: new Uint8ClampedArray(w * h * 4), depth: new Float32Array(w * h).fill(Infinity) };
}
function cloneLayer(l) {
  return { x0: l.x0, y0: l.y0, w: l.w, h: l.h, rgba: new Uint8ClampedArray(l.rgba), depth: new Float32Array(l.depth) };
}
// pose un calque (alpha) sur une image RGBA opaque (fond peint)
function overImage(img, W, H, layer) {
  for (let y = 0; y < layer.h; y++) {
    const dy = y + layer.y0;
    if (dy < 0 || dy >= H) continue;
    for (let x = 0; x < layer.w; x++) {
      const dx = x + layer.x0;
      if (dx < 0 || dx >= W) continue;
      const l4 = (y * layer.w + x) * 4, a = layer.rgba[l4 + 3];
      if (!a) continue;
      const d4 = (dy * W + dx) * 4, k = a / 255, ik = 1 - k;
      img[d4] = layer.rgba[l4] * k + img[d4] * ik;
      img[d4 + 1] = layer.rgba[l4 + 1] * k + img[d4 + 1] * ik;
      img[d4 + 2] = layer.rgba[l4 + 2] * k + img[d4 + 2] * ik;
    }
  }
}

module.exports = { Mesh, material, linColor, render, shadowMap, shadowCasters, composite, emptyLayer, cloneLayer, overImage, n2, fbm2, h2, smooth, PAT };
