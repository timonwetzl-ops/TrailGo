// GPS-Aufzeichnung: Zustände idle → run ⇄ pause → fin → gespeichert/verworfen.
import { accept, summarize, dist } from "./geo.js";
import { saveDraft, loadDraft, clearDraft, putAct, settings } from "./store.js";

const blank = sport => ({ status: "idle", sport, pts: [], seg: 0, acc: 0, since: 0, start: 0, sum: null, speed: null, accNow: null, err: null, sim: false, recovered: false });
let R = blank("run"), wid = null, simId = null, wl = null;
const subs = new Set();
export const on = f => { subs.add(f); };
const emit = () => subs.forEach(f => f());
export const state = () => R;
export const elapsed = () => R.acc + (R.status === "run" ? Date.now() - R.since : 0);
const persist = () => saveDraft({ sport: R.sport, pts: R.pts, seg: R.seg, acc: elapsed(), status: R.status, start: R.start, sim: R.sim });

async function wake(want) { // Bildschirm anlassen, solange die App im Vordergrund ist
  try {
    if (want && "wakeLock" in navigator && !wl) { wl = await navigator.wakeLock.request("screen"); wl.addEventListener("release", () => { wl = null; }); }
    else if (!want && wl) { await wl.release(); wl = null; }
  } catch {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && R.status === "run") wake(true); });

function onPos(pos) {
  const c = pos.coords; R.accNow = c.accuracy; R.err = null;
  if (R.status === "run") {
    const p = [c.latitude, c.longitude, c.altitude ?? null, pos.timestamp, R.seg], last = R.pts[R.pts.length - 1];
    if (accept(last, p, c.accuracy)) {
      let v = c.speed;
      if (v == null && last && last[4] === p[4] && p[3] > last[3]) v = dist(last, p) / ((p[3] - last[3]) / 1000);
      R.speed = v ?? 0; R.pts.push(p); R.sum = summarize(R.pts);
      if (R.pts.length % 10 === 0) persist();
    }
  }
  emit();
}
const CODES = { 1: "denied", 2: "unavailable", 3: "timeout" };
const onErr = e => { R.err = CODES[e.code] || "unavailable"; emit(); };
function stopWatch() { if (wid !== null) navigator.geolocation.clearWatch(wid); wid = null; clearInterval(simId); }
function watch() {
  stopWatch();
  if (R.sim) { // Testmodus: erfundene Positionen, klar gekennzeichnet
    let i = R.pts.length * 2;
    simId = setInterval(() => { i++; onPos({ timestamp: Date.now(), coords: { latitude: 48.137 + i * 0.00002, longitude: 11.575 + 0.0004 * Math.sin(i / 40), altitude: 520 + 15 * Math.sin(i / 30), accuracy: 6 + Math.random() * 4, speed: 2.2 } }); }, 1000);
    return;
  }
  if (!("geolocation" in navigator)) { R.err = "unsupported"; emit(); return; }
  wid = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 });
}

export function start(sport) { R = blank(sport); R.sim = !!settings().sim; R.status = "run"; R.start = R.since = Date.now(); watch(); wake(true); persist(); emit(); }
export function pause() { R.acc = elapsed(); R.status = "pause"; R.seg++; R.recovered = false; stopWatch(); wake(false); persist(); emit(); }
export function resume() { R.since = Date.now(); R.status = "run"; R.recovered = false; watch(); wake(true); emit(); }
export function finish() { R.acc = elapsed(); R.status = "fin"; R.recovered = false; stopWatch(); wake(false); persist(); emit(); }
export function discard() { stopWatch(); wake(false); clearDraft(); R = blank(R.sport); emit(); }
export function setSport(s) { if (R.status === "idle") R.sport = s; }
export async function save(name) {
  if (R.pts.length < 2) return null;
  const a = { id: Date.now().toString(36), sport: R.sport, name, startedAt: R.start, duration: Math.round(R.acc / 1000), points: R.pts, summary: summarize(R.pts), sim: R.sim };
  await putAct(a); clearDraft(); R = blank(R.sport); emit(); return a;
}
// Beim Start: unterbrochene Aufzeichnung wiederherstellen (z. B. nach Absturz oder Neuladen).
export function init() {
  const d = loadDraft();
  if (!d || !d.pts || !d.pts.length) return;
  R = { ...blank(d.sport), ...d, status: d.status === "fin" ? "fin" : "pause", since: 0, recovered: d.status !== "fin" };
  R.sum = summarize(R.pts); if (R.status === "pause") R.seg++;
}
