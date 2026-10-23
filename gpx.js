// GPX-Export und -Import ohne Browser-Abhängigkeit (testbar).
export class GpxError extends Error { constructor(code) { super(code); this.code = code; } }
const esc = s => String(s).replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const unesc = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

export function toGpx(a) {
  const segs = [];
  for (const p of a.points) (segs[p[4]] || (segs[p[4]] = [])).push(p);
  const pt = p => `<trkpt lat="${p[0].toFixed(6)}" lon="${p[1].toFixed(6)}">${p[2] != null ? `<ele>${p[2].toFixed(1)}</ele>` : ""}${p[3] ? `<time>${new Date(p[3]).toISOString()}</time>` : ""}</trkpt>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Trail’Go" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>${esc(a.name)}</name>` +
    segs.filter(Boolean).map(s => "<trkseg>" + s.map(pt).join("") + "</trkseg>").join("") + "</trk>\n</gpx>";
}

export function parseGpx(text) {
  if (typeof text !== "string" || !/<gpx[\s>]/i.test(text)) throw new GpxError("not_gpx");
  const blocks = [...text.matchAll(/<trkseg[^>]*>([\s\S]*?)<\/trkseg>/gi)].map(m => m[1]);
  if (!blocks.length) blocks.push(text);
  const points = [];
  blocks.forEach((b, seg) => {
    for (const m of b.matchAll(/<(trkpt|rtept)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi)) {
      const lat = parseFloat((/lat\s*=\s*["']([^"']+)["']/i.exec(m[2]) || [])[1]);
      const lon = parseFloat((/lon\s*=\s*["']([^"']+)["']/i.exec(m[2]) || [])[1]);
      if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new GpxError("bad_coords");
      const ele = parseFloat((/<ele>([^<]+)<\/ele>/i.exec(m[3] || "") || [])[1]);
      const time = Date.parse((/<time>([^<]+)<\/time>/i.exec(m[3] || "") || [])[1]);
      points.push([lat, lon, isFinite(ele) ? ele : null, isFinite(time) ? time : 0, seg]);
    }
  });
  if (points.length < 2) throw new GpxError("too_few");
  const nm = /<name>([^<]*)<\/name>/i.exec(text);
  return { name: nm ? unesc(nm[1].trim()) : "", points };
}
