import test from "node:test";
import assert from "node:assert/strict";
import { dist, accept, summarize, splits } from "../public/js/geo.js";
import { toGpx, parseGpx } from "../public/js/gpx.js";

const P = (lat, lon, ele, t, s = 0) => [lat, lon, ele, t, s];

test("Distanz: 1 Grad Breite ≈ 111,2 km", () => assert.ok(Math.abs(dist([0, 0], [1, 0]) - 111195) < 300));
test("Filter: ungenaue und zu nahe Punkte werden verworfen", () => {
  const a = P(48, 11, 500, 0);
  assert.equal(accept(null, a, 10), true);
  assert.equal(accept(a, P(48.00001, 11, 500, 1000), 5), false);
  assert.equal(accept(a, P(48.001, 11, 500, 10000), 80), false);
  assert.equal(accept(a, P(48.001, 11, 500, 60000), 5), true);
  assert.equal(accept(a, P(49, 11, 500, 1000), 5), false);
});
test("Auswertung: Strecke, Aufstieg mit Schwelle, Pause trennt Segmente", () => {
  const pts = [P(48, 11, 500, 0), P(48.001, 11, 510, 20000), P(48.002, 11, 505, 40000), P(48.003, 11, 520, 60000, 1), P(48.004, 11, 520, 80000, 1)];
  const s = summarize(pts);
  assert.ok(Math.abs(s.dist - dist(pts[0], pts[1]) * 2 - dist(pts[3], pts[4])) < 1);
  assert.equal(Math.round(s.asc), 25); assert.equal(Math.round(s.desc), 5);
  assert.equal(s.hi, 520);
});
test("Auswertung: leere Liste und fehlende Höhe", () => {
  assert.equal(summarize([]).dist, 0);
  assert.equal(summarize([P(48, 11, null, 0), P(48.001, 11, null, 20000)]).hi, null);
});
test("Kilometer-Zeiten: 10 s pro ~11 m ergibt ca. 900 s pro km", () => {
  const pts = []; for (let i = 0; i <= 120; i++) pts.push(P(i * 0.0001, 0, 0, i * 10000));
  const sp = splits(pts);
  assert.equal(sp.length, 1);
  assert.ok(Math.abs(sp[0] - 900) < 15, "war " + sp[0]);
});
test("GPX: Export und Import ergeben dieselben Punkte", () => {
  const a = { name: 'Test & "Tour"', points: [P(48.1, 11.5, 500.5, 1700000000000), P(48.2, 11.6, null, 1700000060000, 1)] };
  const g = parseGpx(toGpx(a));
  assert.equal(g.name, 'Test & "Tour"'); assert.equal(g.points.length, 2);
  assert.equal(g.points[0][2], 500.5); assert.equal(g.points[1][2], null); assert.equal(g.points[1][4], 1);
});
test("GPX: fehlerhafte Dateien liefern verständliche Fehlercodes", () => {
  assert.throws(() => parseGpx("hallo"), { code: "not_gpx" });
  assert.throws(() => parseGpx("<gpx><trk><trkseg><trkpt lat=\"1\" lon=\"2\"/></trkseg></trk></gpx>"), { code: "too_few" });
  assert.throws(() => parseGpx("<gpx><trkpt lat=\"abc\" lon=\"2\"/><trkpt lat=\"1\" lon=\"2\"/></gpx>"), { code: "bad_coords" });
  assert.throws(() => parseGpx("<gpx><trkpt lat=\"99\" lon=\"2\"/><trkpt lat=\"1\" lon=\"2\"/></gpx>"), { code: "bad_coords" });
});
