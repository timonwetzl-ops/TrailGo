// Bildschirme: jede Funktion liefert HTML für den aktuellen Zustand (ctx).
import { summarize, splits, dist } from "./geo.js";
import * as rec from "./recorder.js";

export const SPORTS = { hike: "Wandern", walk: "Spazieren", run: "Laufen", road: "Rennrad", mtb: "Mountainbike", gravel: "Gravel", ebike: "E-Bike" };
const esc = s => String(s ?? "").replace(/[<>&"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const f1 = (x, d = 1) => x.toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
const km = m => f1(m / 1000, m < 10000 ? 2 : 1);
const hms = s => { s = Math.round(s); const h = s / 3600 | 0, m = (s % 3600) / 60 | 0, c = s % 60, p = n => String(n).padStart(2, "0"); return h ? `${h}:${p(m)}:${p(c)}` : `${m}:${p(c)}`; };
const kmh = v => f1(v * 3.6);
const pace = v => v > 0.3 ? hms(1000 / v) : "–";
const date = ts => new Date(ts).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return +d; };
const tot = l => ({ d: l.reduce((s, a) => s + a.summary.dist, 0), t: l.reduce((s, a) => s + a.summary.moving, 0), asc: l.reduce((s, a) => s + a.summary.asc, 0), n: l.length });
const cell = (v, l) => `<div><b>${v}</b>${l}</div>`;
const chips = (obj, cur, act, off) => `<div class="chips">${Object.entries(obj).map(([k, l]) => `<button class="chip${cur === k ? " on" : ""}" data-a="${act}" data-v="${k}"${off ? " disabled" : ""}>${l}</button>`).join("")}</div>`;
const sim = a => a.sim ? `<span class="tag">Test</span>` : "";
const actRow = a => `<button class="row" data-a="open" data-v="${a.id}"><span><b>${esc(a.name)}</b>${sim(a)}<i>${SPORTS[a.sport] || a.sport} · ${date(a.startedAt)}</i></span><span class="rn">${km(a.summary.dist)} <small>km</small></span></button>`;
const empty = `<p class="note">Noch keine Aktivität gespeichert. Starte unter „Aufzeichnen“ deine erste Tour oder importiere eine GPX-Datei unter „Profil“.</p>`;
const ERR = {
  denied: "Der Standortzugriff wurde verweigert. Erlaube den Standort in den Browser-Einstellungen (Schloss-Symbol neben der Adresse) und lade die Seite neu.",
  unavailable: "Kein Standort verfügbar. Geh ins Freie oder warte einen Moment; drinnen ist GPS oft nicht möglich.",
  timeout: "Die Ortung dauert länger als üblich. Die Aufzeichnung läuft weiter, sobald ein Signal da ist.",
  unsupported: "Dieser Browser unterstützt keine Standortbestimmung."
};

// ---- Grafiken ----
const bounds = p => { let a = 90, b = -90, c = 180, d = -180; for (const q of p) { if (q[0] < a) a = q[0]; if (q[0] > b) b = q[0]; if (q[1] < c) c = q[1]; if (q[1] > d) d = q[1]; } return [a, b, c, d]; };
function track(p) {
  if (p.length < 2) return "";
  const [a, b, c, d] = bounds(p), k = Math.cos((a + b) / 2 * Math.PI / 180), W = 360, H = 220, m = 16;
  const s = Math.min((W - 2 * m) / ((d - c) * k || 1e-9), (H - 2 * m) / ((b - a) || 1e-9)), ox = (W - (d - c) * k * s) / 2, oy = (H - (b - a) * s) / 2;
  const xy = q => `${(ox + (q[1] - c) * k * s).toFixed(1)},${(H - oy - (q[0] - a) * s).toFixed(1)}`;
  const segs = []; for (const q of p) (segs[q[4]] || (segs[q[4]] = [])).push(q);
  const [x0, y0] = xy(p[0]).split(","), [x1, y1] = xy(p[p.length - 1]).split(",");
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Verlauf der Strecke">${segs.filter(Boolean).map(g => `<polyline points="${g.map(xy).join(" ")}" fill="none" stroke="var(--sig)" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}<circle cx="${x0}" cy="${y0}" r="6" fill="var(--pine)"/><rect x="${x1 - 5}" y="${y1 - 5}" width="10" height="10" fill="var(--fg)"/></svg>`;
}
function profile(p) {
  const e = p.filter(q => q[2] != null); if (e.length < 2) return `<p class="note">Für diese Aktivität gibt es keine Höhenwerte.</p>`;
  let d = 0; const xs = [0]; for (let i = 1; i < e.length; i++) xs.push(d += e[i][4] === e[i - 1][4] ? dist(e[i - 1], e[i]) : 0);
  const lo = Math.min(...e.map(q => q[2])), hi = Math.max(...e.map(q => q[2])), W = 360, H = 130, X = i => xs[i] / (d || 1) * W, Y = v => H - 14 - (v - lo) / ((hi - lo) || 1) * (H - 32);
  const line = e.map((q, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(q[2]).toFixed(1)}`).join("");
  return `<svg class="vz" viewBox="0 0 ${W} ${H}" role="img" aria-label="Höhenprofil"><path d="${line}L${W} ${H}L0 ${H}Z" fill="var(--pine)" opacity=".16"/><path d="${line}" fill="none" stroke="var(--pine)" stroke-width="2.2"/><text x="6" y="14" font-size="11" fill="var(--mu)">${Math.round(hi)} m</text><text x="6" y="${H - 4}" font-size="11" fill="var(--mu)">${Math.round(lo)} m</text></svg>`;
}

const ICON = {
  home: '<path d="M3 11l9-8 9 8v10h-6v-6H9v6H3z"/>', rec: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>',
  plan: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>', prof: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  set: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
};
const NAME = { home: "Home", rec: "Aufzeichnen", plan: "Planen", prof: "Profil", set: "Einstellungen" };

export const V = {
  nav: c => Object.keys(ICON).map(k => `<button data-a="tab" data-v="${k}" class="${c.tab === k ? "on" : ""}"><svg viewBox="0 0 24 24">${ICON[k]}</svg>${NAME[k]}</button>`).join(""),

  home(c) {
    const T = tot(c.acts.filter(a => a.startedAt >= weekStart()));
    return `<header class="top"><h1>Trail’Go</h1>${c.set.name ? `<p>Hallo, ${esc(c.set.name)}</p>` : ""}</header>
<div class="lbl">Diese Woche</div><div class="hero"><b>${km(T.d)}</b><span>km</span></div>
<div class="trio">${cell(hms(T.t), "Bewegungszeit")}${cell(Math.round(T.asc) + " m", "Aufstieg")}${cell(T.n + " / " + c.set.goal, "Aktivitäten")}</div>
<h2>Letzte Aktivitäten</h2>${c.acts.length ? c.acts.slice(0, 4).map(actRow).join("") : empty}
<button class="btn sig" data-a="tab" data-v="rec">Aufzeichnen</button>`;
  },

  rec(c) {
    const r = rec.state(), s = r.status;
    if (c.explain) return `<header class="top"><h1>Standort</h1></header><p class="txt">Trail’Go braucht deinen Standort, um Strecke, Geschwindigkeit und Höhenmeter aufzuzeichnen. Die Daten bleiben auf diesem Gerät. Gleich fragt dein Browser nach der Erlaubnis.</p><button class="btn" data-a="explainok">Weiter</button><button class="btn ghost" data-a="explainno">Abbrechen</button>`;
    const S = r.sum || summarize([]), el = rec.elapsed() / 1000, foot = r.sport === "run";
    const q = r.accNow == null ? "wartet auf Signal" : `±${Math.round(r.accNow)} m (${r.accNow <= 15 ? "gut" : r.accNow <= 35 ? "mittel" : "schwach"})`;
    const live = s !== "idle" && s !== "fin" || s === "fin";
    let btn;
    if (s === "idle") btn = `<button class="btn sig go" data-a="start">Start</button><p class="note">Der Bildschirm bleibt an, solange die App im Vordergrund ist. Bei gesperrtem Bildschirm kann der Browser die Ortung unterbrechen. Das lösen wir erst in der iPhone-App.</p>`;
    else if (s === "run") btn = `<div class="two"><button class="btn ghost" data-a="pause">Pause</button><button class="btn sig" data-a="finish">Beenden</button></div>`;
    else if (s === "pause") btn = `<div class="two"><button class="btn" data-a="resume">Fortsetzen</button><button class="btn sig" data-a="finish">Beenden</button></div>`;
    else btn = c.confirm === "discard"
      ? `<p class="note">Aufzeichnung wirklich verwerfen? Das lässt sich nicht rückgängig machen.</p><div class="two"><button class="btn ghost" data-a="keep">Abbrechen</button><button class="btn red" data-a="discard2">Verwerfen</button></div>`
      : `<label class="mu sm" for="rn">Name der Aktivität</label><input type="text" id="rn" value="${esc(SPORTS[r.sport])} ${new Date(r.start).toLocaleDateString("de-DE")}"><button class="btn" data-a="save">Speichern</button><button class="btn ghost" data-a="discard">Verwerfen</button>`;
    return `<header class="top"><h1>Aufzeichnen${r.sim ? '<span class="tag">Test</span>' : ""}</h1></header>${chips(SPORTS, r.sport, "sport", s !== "idle")}
${r.recovered ? `<p class="note">Unfertige Aufzeichnung gefunden. Sie ist pausiert: Fortsetzen, beenden oder verwerfen.</p>` : ""}${r.err ? `<p class="err">${ERR[r.err]}</p>` : ""}${c.set.sim && s === "idle" ? `<p class="note">Testmodus aktiv: Es werden erfundene Positionen aufgezeichnet.</p>` : ""}
<div class="lbl">${s === "pause" ? "Pausiert" : s === "fin" ? "Beendet" : "Dauer"}</div><div class="big">${hms(el)}</div>
<div class="grid">${cell(km(S.dist) + " km", "Distanz")}${cell(s === "run" && r.speed != null ? (foot ? pace(r.speed) + " /km" : kmh(r.speed) + " km/h") : "–", foot ? "Pace" : "Geschwindigkeit")}${cell(S.moving ? (foot ? pace(S.avg) + " /km" : kmh(S.avg) + " km/h") : "–", "Ø Bewegung")}${cell(S.hi != null ? Math.round(S.hi) + " m" : "–", "Höchster Punkt")}${cell(Math.round(S.asc) + " m", "Aufstieg")}${cell(Math.round(S.desc) + " m", "Abstieg")}</div>
${s !== "idle" ? `<p class="mu sm" style="margin-top:8px">GPS: ${q}</p>` : ""}${btn}`;
  },

  plan: () => `<header class="top"><h1>Planen</h1></header><p class="note">Tourenplanung und die echte Karte (OpenStreetMap) kommen im nächsten Schritt. In dieser Version ist nur die GPS-Aufzeichnung echt.</p>`,

  prof(c) {
    const T = tot(c.acts), L = [...c.acts].sort((a, b) => b.summary.dist - a.summary.dist)[0], H = [...c.acts].sort((a, b) => b.summary.asc - a.summary.asc)[0];
    return `<header class="top"><h1>${esc(c.set.name) || "Profil"}</h1><p>Lokal auf diesem Gerät gespeichert</p></header>
<div class="grid">${cell(km(T.d) + " km", "Gesamt")}${cell(T.n, "Aktivitäten")}${cell(Math.round(T.asc) + " m", "Aufstieg gesamt")}${cell(hms(T.t), "Bewegungszeit")}</div>
${L ? `<h2>Rekorde</h2><p>Längste Aktivität: <b>${km(L.summary.dist)} km</b> (${esc(L.name)})</p><p>Meiste Höhenmeter: <b>${Math.round(H.summary.asc)} m</b> (${esc(H.name)})</p>` : ""}
<h2>Meine Aktivitäten</h2>${c.acts.length ? c.acts.map(actRow).join("") : empty}<button class="btn ghost" data-a="imp">GPX-Datei importieren</button>`;
  },

  set(c) {
    const s = c.set, ask = (k, l, l2) => c.confirm === k ? `<div class="two"><button class="btn ghost" data-a="keep">Abbrechen</button><button class="btn red" data-a="${k}2">${l2}</button></div>` : `<button class="btn ghost" data-a="${k}">${l}</button>`;
    return `<header class="top"><h1>Einstellungen</h1></header>
<h2>Allgemein</h2><label class="mu sm" for="nm">Anzeigename</label><input type="text" id="nm" data-i="name" value="${esc(s.name)}" placeholder="Optional">
<div class="lbl" style="margin-top:14px">Design</div>${chips({ auto: "Automatisch", light: "Hell", dark: "Dunkel" }, s.theme, "theme")}
<div class="lbl">Wochenziel: Aktivitäten pro Woche</div><div class="chips"><button class="chip" data-a="goal" data-v="-1">−</button><span class="chip on">${s.goal}</span><button class="chip" data-a="goal" data-v="1">+</button></div>
<h2>Test</h2><div class="chips"><button class="chip${s.sim ? " on" : ""}" data-a="sim">Testmodus (erfundene Positionen)</button></div><p class="mu sm">Zum Ausprobieren am PC. Test-Aufzeichnungen sind mit „Test“ gekennzeichnet.</p>
<h2>Daten</h2><button class="btn ghost" data-a="imp">GPX-Datei importieren</button><button class="btn ghost" data-a="expall">Alle Daten exportieren (JSON)</button>${ask("wipe", "Alle lokalen Daten löschen", "Alles löschen")}
<h2>Datenschutz</h2><p class="mu sm">Alle Daten bleiben in diesem Browser. Es gibt kein Konto und keine Übertragung an Server. Noch nicht enthalten: Karten, Routing, Offline-Karten, Benachrichtigungen, Englisch.</p>`;
  },

  detail(c) {
    const a = c.acts.find(x => x.id === c.open); if (!a) return "";
    const S = a.summary, foot = a.sport === "run", sp = splits(a.points);
    return `<button class="back" data-a="back">‹ Zurück</button>${sim(a)}
<input type="text" id="an" data-i="actname" value="${esc(a.name)}" style="font-size:20px;font-weight:600">
<p class="mu sm" style="margin-top:6px">${date(a.startedAt)}</p>${chips(SPORTS, a.sport, "sport")}
${track(a.points)}
<div class="grid">${cell(km(S.dist) + " km", "Distanz")}${cell(a.duration ? hms(a.duration) : "–", "Gesamtdauer")}${cell(S.moving ? hms(S.moving) : "–", "Bewegungszeit")}${cell(S.moving ? (foot ? pace(S.avg) + " /km" : kmh(S.avg) + " km/h") : "–", foot ? "Ø Pace" : "Ø Geschwindigkeit")}${cell(S.max ? (foot ? pace(S.max) + " /km" : kmh(S.max) + " km/h") : "–", foot ? "Beste Pace" : "Höchstgeschwindigkeit")}${cell(Math.round(S.asc) + " m", "Aufstieg")}${cell(Math.round(S.desc) + " m", "Abstieg")}${cell(S.hi != null ? Math.round(S.hi) + " m" : "–", "Höchster Punkt")}</div>
<h2>Höhenprofil</h2>${profile(a.points)}
${sp.length ? `<h2>Kilometer-Zeiten</h2>${sp.map((t, i) => `<div class="row" style="cursor:default"><span>Kilometer ${i + 1}</span><b>${hms(t)}</b></div>`).join("")}` : ""}
<input type="text" id="ano" data-i="actnotes" value="${esc(a.notes || "")}" placeholder="Beschreibung hinzufügen" style="margin-top:16px">
<button class="btn" data-a="gpxexp">Als GPX exportieren</button>
${c.confirm === "del" ? `<div class="two"><button class="btn ghost" data-a="keep">Abbrechen</button><button class="btn red" data-a="del2">Wirklich löschen</button></div>` : `<button class="btn ghost" data-a="del">Löschen</button>`}`;
  }
};
