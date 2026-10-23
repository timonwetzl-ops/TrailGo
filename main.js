import { settings, setSettings, allActs, putAct, delAct, clearActs } from "./store.js";
import * as rec from "./recorder.js";
import { V } from "./views.js";
import { parseGpx, toGpx } from "./gpx.js";
import { summarize } from "./geo.js";

const $ = s => document.querySelector(s);
const ctx = { tab: "home", acts: [], set: settings(), open: null, explain: false, confirm: null };

function theme() {
  const t = ctx.set.theme === "auto" ? (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light") : ctx.set.theme;
  document.documentElement.dataset.t = t;
}
function render() {
  theme();
  $("#app").classList.toggle("full", !!ctx.open);
  const y = $("#sc").scrollTop;
  $("#sc").innerHTML = ctx.open ? V.detail(ctx) : V[ctx.tab](ctx);
  $("#sc").scrollTop = y;
  $("#nav").innerHTML = V.nav(ctx);
}
function toast(x) { const e = $("#ts"); e.textContent = x; e.style.display = "block"; clearTimeout(toast.i); toast.i = setTimeout(() => { e.style.display = "none"; }, 4000); }
async function load() {
  try { ctx.acts = (await allActs()).sort((a, b) => b.startedAt - a.startedAt); }
  catch { toast("Die lokale Speicherung ist in diesem Browser nicht verfügbar. Aktivitäten können nicht gespeichert werden."); }
  render();
}
function download(name, text, type) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const cur = () => ctx.acts.find(a => a.id === ctx.open);
const keep = () => { ctx.confirm = null; render(); };

const ACTIONS = {
  tab: v => { ctx.tab = v; ctx.open = null; ctx.explain = false; ctx.confirm = null; $("#sc").scrollTop = 0; render(); },
  open: v => { ctx.open = v; ctx.confirm = null; render(); $("#sc").scrollTop = 0; },
  back: () => { ctx.open = null; ctx.confirm = null; render(); },
  keep,
  sport: async v => {
    if (ctx.open) { const a = cur(); a.sport = v; await putAct(a); } else rec.setSport(v);
    render();
  },
  start: () => { if (!ctx.set.explained && !ctx.set.sim) { ctx.explain = true; render(); } else rec.start(rec.state().sport); },
  explainok: () => { ctx.explain = false; ctx.set.explained = true; setSettings(ctx.set); rec.start(rec.state().sport); },
  explainno: () => { ctx.explain = false; render(); },
  pause: () => rec.pause(), resume: () => rec.resume(), finish: () => rec.finish(),
  discard: () => { ctx.confirm = "discard"; render(); },
  discard2: () => { ctx.confirm = null; rec.discard(); },
  save: async () => {
    const name = ($("#rn").value || "").trim() || "Aktivität";
    try {
      const a = await rec.save(name);
      if (!a) return toast("Die Aufzeichnung ist zu kurz (weniger als zwei Punkte) und kann nicht gespeichert werden.");
      ctx.acts.unshift(a); ctx.tab = "home"; render(); toast("Aktivität gespeichert.");
    } catch { toast("Speichern fehlgeschlagen. Möglicherweise ist der Speicherplatz voll. Die Aufzeichnung bleibt erhalten."); }
  },
  gpxexp: () => { const a = cur(); download((a.name.replace(/[^\wäöüÄÖÜß -]/g, "").trim().replace(/ +/g, "-") || "aktivitaet") + ".gpx", toGpx(a), "application/gpx+xml"); },
  del: () => { ctx.confirm = "del"; render(); },
  del2: async () => { const id = ctx.open; await delAct(id); ctx.acts = ctx.acts.filter(a => a.id !== id); ctx.open = null; ctx.confirm = null; render(); },
  theme: v => { ctx.set.theme = v; setSettings(ctx.set); render(); },
  goal: v => { ctx.set.goal = Math.max(1, Math.min(7, ctx.set.goal + +v)); setSettings(ctx.set); render(); },
  sim: () => { ctx.set.sim = !ctx.set.sim; setSettings(ctx.set); render(); },
  imp: () => $("#gf").click(),
  expall: () => download("trailgo-daten.json", JSON.stringify({ settings: ctx.set, activities: ctx.acts }), "application/json"),
  wipe: () => { ctx.confirm = "wipe"; render(); },
  wipe2: async () => { await clearActs(); ctx.acts = []; ctx.set = { ...settings(), name: "", sim: false }; setSettings(ctx.set); ctx.confirm = null; render(); toast("Alle lokalen Aktivitäten wurden gelöscht."); }
};
document.addEventListener("click", e => { const b = e.target.closest("[data-a]"); if (b && ACTIONS[b.dataset.a]) ACTIONS[b.dataset.a](b.dataset.v); });
document.addEventListener("change", async e => {
  const k = e.target.dataset.i; if (!k) return;
  if (k === "name") { ctx.set.name = e.target.value; setSettings(ctx.set); }
  else { const a = cur(); if (a) { if (k === "actname") a.name = e.target.value || a.name; else a.notes = e.target.value; await putAct(a); } }
});
const MSG = { not_gpx: "Das ist keine GPX-Datei.", too_few: "Die Datei enthält weniger als zwei Streckenpunkte.", bad_coords: "Die Datei enthält fehlerhafte Koordinaten." };
$("#gf").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try {
    const g = parseGpx(await f.text()), t = g.points.map(p => p[3]).filter(Boolean);
    const a = { id: "i" + Date.now().toString(36), sport: "hike", name: g.name || f.name.replace(/\.[^.]+$/, ""), startedAt: t[0] || Date.now(), duration: t.length > 1 ? Math.round((t[t.length - 1] - t[0]) / 1000) : 0, points: g.points, summary: summarize(g.points), sim: false, notes: "" };
    await putAct(a); ctx.acts.push(a); ctx.acts.sort((x, y) => y.startedAt - x.startedAt); render(); toast(`Importiert: ${a.name}`);
  } catch (err) { toast(MSG[err.code] || "Die Datei konnte nicht gelesen werden."); }
});
rec.on(() => { if (ctx.tab === "rec" && !ctx.open && !ctx.explain) render(); });
setInterval(() => { if (ctx.tab === "rec" && !ctx.open && rec.state().status === "run") render(); }, 1000);
matchMedia("(prefers-color-scheme:dark)").addEventListener("change", render);

rec.init();
if (rec.state().status !== "idle") ctx.tab = "rec";
load();
