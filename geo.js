// Reine Rechenfunktionen (ohne Browser). Punkt = [breite, länge, höhe|null, zeitMs, segment]
export const dist = (a, b) => { // Meter
  const q = Math.PI / 180, x = (b[0] - a[0]) * q, y = (b[1] - a[1]) * q;
  const h = Math.sin(x / 2) ** 2 + Math.cos(a[0] * q) * Math.cos(b[0] * q) * Math.sin(y / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(h));
};

// Filter gegen GPS-Rauschen: ungenaue, zu nahe oder unmögliche Punkte werden verworfen.
export function accept(last, p, acc, { maxAcc = 35, minDist = 3, maxSpeed = 40 } = {}) {
  if (acc > maxAcc) return false;
  if (!last) return true;
  const d = dist(last, p), dt = (p[3] - last[3]) / 1000;
  if (d < Math.max(minDist, acc * 0.3)) return false;
  if (dt > 0 && d / dt > maxSpeed) return false;
  return true;
}

// Auswertung. Strecken/Zeiten nur innerhalb eines Segments (nach einer Pause beginnt ein neues).
export function summarize(pts) {
  let d = 0, moving = 0, asc = 0, desc = 0, max = 0, ref = null, hi = -1e9, lo = 1e9, hasEle = false;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (p[2] != null) {
      hasEle = true; hi = Math.max(hi, p[2]); lo = Math.min(lo, p[2]);
      if (ref === null) ref = p[2];
      else if (p[2] - ref >= 3) { asc += p[2] - ref; ref = p[2]; }
      else if (ref - p[2] >= 3) { desc += ref - p[2]; ref = p[2]; }
    }
    if (i && p[4] === pts[i - 1][4]) {
      const s = dist(pts[i - 1], p), dt = (p[3] - pts[i - 1][3]) / 1000;
      d += s;
      if (dt > 0 && s / dt >= 0.5) moving += dt;
      if (dt >= 2 && s / dt > max) max = s / dt;
    }
  }
  return { dist: d, moving, asc, desc, hi: hasEle ? hi : null, lo: hasEle ? lo : null, max, avg: moving ? d / moving : 0 };
}

// Zeit (Sekunden) pro voll gelaufenem Kilometer.
export function splits(pts) {
  const out = []; let d = 0, t = 0, last = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][4] !== pts[i - 1][4]) continue;
    const s = dist(pts[i - 1], pts[i]), dt = (pts[i][3] - pts[i - 1][3]) / 1000;
    while (s > 0 && d + s >= (out.length + 1) * 1000) {
      const tt = t + dt * (((out.length + 1) * 1000 - d) / s);
      out.push(tt - last); last = tt;
    }
    d += s; t += dt;
  }
  return out;
}
