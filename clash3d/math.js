// Clash de la Maison en 3D : mathématiques de la caméra (partagées entre le bot et le fil de rendu).
// Repère : y vers le haut, le sol de l'île est le plan y = 0. Une case de la grille du Clash = 1 unité.
// La caméra regarde l'île depuis le coin (+x, +z) : plus x + z est grand, plus l'objet est proche et bas à l'écran.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

// matrices 4×4 en colonnes majeures (comme WebGL) : m[col * 4 + row]
// inverse d'une matrice 4×4 (élimination de Gauss-Jordan)
function mat4Invert(m) {
  const a = [];
  for (let r = 0; r < 4; r++) {
    a.push([]);
    for (let c = 0; c < 4; c++) a[r].push(m[c * 4 + r]);
    for (let c = 0; c < 4; c++) a[r].push(r === c ? 1 : 0);
  }
  for (let c = 0; c < 4; c++) {
    let p = c;
    for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c] || 1e-12;
    for (let k = 0; k < 8; k++) a[c][k] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === c) continue;
      const f = a[r][c];
      for (let k = 0; k < 8; k++) a[r][k] -= f * a[c][k];
    }
  }
  const o = new Float64Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) o[c * 4 + r] = a[r][c + 4];
  return o;
}
function mat4Mul(a, b) {
  const o = new Float64Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
  return o;
}
function lookAt(eye, target, up = [0, 1, 0]) {
  const f = norm(sub(target, eye)), s = norm(cross(f, up)), u = cross(s, f);
  const m = new Float64Array(16);
  m[0] = s[0];
  m[4] = s[1];
  m[8] = s[2];
  m[1] = u[0];
  m[5] = u[1];
  m[9] = u[2];
  m[2] = -f[0];
  m[6] = -f[1];
  m[10] = -f[2];
  m[12] = -dot(s, eye);
  m[13] = -dot(u, eye);
  m[14] = dot(f, eye);
  m[15] = 1;
  return m;
}
function perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2), m = new Float64Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}
function ortho(l, r, b, t, n, f) {
  const m = new Float64Array(16);
  m[0] = 2 / (r - l);
  m[5] = 2 / (t - b);
  m[10] = -2 / (f - n);
  m[12] = -(r + l) / (r - l);
  m[13] = -(t + b) / (t - b);
  m[14] = -(f + n) / (f - n);
  m[15] = 1;
  return m;
}

// Caméra de la scène : azimut (0 = regarde depuis +z, π/4 = depuis le coin +x +z), hauteur, distance, focale.
// project(x, y, z) -> [écranX, écranY, profondeur 0..1] en pixels pour une image W × H.
function makeCamera({ target = [0, 0, 0], azimuth = Math.PI / 4, elevation = 0.62, distance = 60, fov = 0.42, width = 1200, height = 900, near = null, far = null, shiftX = 0, shiftY = 0 }) {
  const eye = [target[0] + Math.sin(azimuth) * Math.cos(elevation) * distance, target[1] + Math.sin(elevation) * distance, target[2] + Math.cos(azimuth) * Math.cos(elevation) * distance];
  const view = lookAt(eye, target);
  const n = near ?? Math.max(1, distance - 45), fz = far ?? distance + 70;
  const proj = perspective(fov, width / height, n, fz);
  // décalage optique (comme un objectif à décentrement) : recadre sans déformer
  proj[8] = -shiftX * 2;
  proj[9] = shiftY * 2;
  const vp = mat4Mul(proj, view);
  const project = (x, y, z) => {
    const cx = vp[0] * x + vp[4] * y + vp[8] * z + vp[12];
    const cy = vp[1] * x + vp[5] * y + vp[9] * z + vp[13];
    const cz = vp[2] * x + vp[6] * y + vp[10] * z + vp[14];
    const cw = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    return [(cx / cw * 0.5 + 0.5) * width, (0.5 - (cy / cw) * 0.5) * height, (cz / cw) * 0.5 + 0.5];
  };
  return { eye, target, view, proj, vp, width, height, near: n, far: fz, fov, azimuth, elevation, distance, project };
}
// Caméra orthographique du soleil (carte des ombres)
function makeSunCamera(dirToSun, center, radius, size) {
  const eye = add(center, mul(norm(dirToSun), radius * 2));
  const view = lookAt(eye, center, Math.abs(dirToSun[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]);
  const proj = ortho(-radius, radius, -radius, radius, 0.1, radius * 4);
  const vp = mat4Mul(proj, view);
  return { vp, size, dir: norm(dirToSun) };
}

// la caméra standard du Clash (île de 24 cases centrée sur l'origine)
const CLASH_CAM = { azimuth: Math.PI / 4, elevation: 0.66, fov: 0.36 };
function clashCamera(width, height, opts = {}) {
  return makeCamera({ target: [0, opts.targetY ?? -1.2, 0], azimuth: CLASH_CAM.azimuth, elevation: opts.elevation ?? CLASH_CAM.elevation, distance: opts.distance ?? 66, fov: opts.fov ?? CLASH_CAM.fov, width, height, shiftY: opts.shiftY ?? 0, shiftX: opts.shiftX ?? 0 });
}
// case de la grille du Clash (x, y de 0 à 24) -> coordonnées du monde
const GRID = 24;
const gridToWorld = (gx, gy, h = 0) => [gx - GRID / 2, h, gy - GRID / 2];

// Cadrage automatique : l'île (dessus et haut des falaises) tient dans le rectangle rect = [x0, y0, x1, y1]
// d'une image W × H. Calcul déterministe : le bot et le fil de rendu obtiennent exactement la même caméra.
const ISLAND_HALF = 13.6;
function fitCamera(W, H, rect = [0, 0, W, H], opts = {}) {
  const depth = opts.depth ?? -5.5, top = opts.top ?? 3.2, fov = opts.fov ?? CLASH_CAM.fov, elevation = opts.elevation ?? CLASH_CAM.elevation;
  // contour réel de l'île (carré arrondi) : on accepte que les coins débordent un peu (crop)
  const crop = opts.crop ?? 0.93, pts = [];
  for (let k = 0; k < 32; k++) {
    const th = (k / 32) * Math.PI * 2, c = Math.abs(Math.cos(th)), s2 = Math.abs(Math.sin(th));
    const r = (13.25 / Math.pow(Math.pow(c, 5) + Math.pow(s2, 5), 1 / 5)) * crop;
    pts.push([Math.cos(th) * r, 0, Math.sin(th) * r], [Math.cos(th) * r * 0.9, depth, Math.sin(th) * r * 0.9]);
  }
  // hauteur des bâtiments les plus hauts, au centre
  for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5], [0, 0]]) pts.push([x, top, z]);
  const bbox = (cam) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const [sx, sy] = cam.project(p[0], p[1], p[2]);
      x0 = Math.min(x0, sx);
      x1 = Math.max(x1, sx);
      y0 = Math.min(y0, sy);
      y1 = Math.max(y1, sy);
    }
    return [x0, y0, x1, y1];
  };
  const rw = rect[2] - rect[0], rh = rect[3] - rect[1];
  let distance = 70;
  for (let k = 0; k < 6; k++) {
    const cam = makeCamera({ target: [0, -1, 0], azimuth: CLASH_CAM.azimuth, elevation, distance, fov, width: W, height: H });
    const [x0, y0, x1, y1] = bbox(cam);
    const f = Math.max((x1 - x0) / rw, (y1 - y0) / rh);
    distance *= 0.35 + 0.65 * f;
  }
  let cam = makeCamera({ target: [0, -1, 0], azimuth: CLASH_CAM.azimuth, elevation, distance, fov, width: W, height: H });
  const [x0, y0, x1, y1] = bbox(cam);
  const shiftX = ((rect[0] + rect[2]) / 2 - (x0 + x1) / 2) / W, shiftY = ((rect[1] + rect[3]) / 2 - (y0 + y1) / 2) / H;
  cam = makeCamera({ target: [0, -1, 0], azimuth: CLASH_CAM.azimuth, elevation, distance, fov, width: W, height: H, shiftX, shiftY });
  cam.fit = { W, H, rect, opts };
  return cam;
}

module.exports = { sub, add, mul, dot, cross, norm, mat4Mul, mat4Invert, lookAt, perspective, ortho, makeCamera, makeSunCamera, clashCamera, fitCamera, gridToWorld, GRID, CLASH_CAM, ISLAND_HALF };
