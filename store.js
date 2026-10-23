// Lokale Speicherung: Einstellungen und Entwurf in localStorage, Aktivitäten in IndexedDB.
const SET = "trailgo.settings", DRAFT = "trailgo.draft";
export const defaults = { name: "", theme: "auto", goal: 2, sim: false, explained: false };
export const settings = () => { try { return { ...defaults, ...JSON.parse(localStorage.getItem(SET)) }; } catch { return { ...defaults }; } };
export const setSettings = s => { try { localStorage.setItem(SET, JSON.stringify(s)); } catch {} };
export const saveDraft = d => { try { localStorage.setItem(DRAFT, JSON.stringify(d)); return true; } catch { return false; } };
export const loadDraft = () => { try { return JSON.parse(localStorage.getItem(DRAFT)); } catch { return null; } };
export const clearDraft = () => { try { localStorage.removeItem(DRAFT); } catch {} };

const db = () => new Promise((ok, no) => {
  const r = indexedDB.open("trailgo", 1);
  r.onupgradeneeded = () => r.result.createObjectStore("acts", { keyPath: "id" });
  r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
});
const tx = async (mode, f) => {
  const d = await db();
  return new Promise((ok, no) => { const t = d.transaction("acts", mode), r = f(t.objectStore("acts")); t.oncomplete = () => ok(r.result); t.onerror = () => no(t.error); });
};
export const allActs = () => tx("readonly", s => s.getAll());
export const putAct = a => tx("readwrite", s => s.put(a));
export const delAct = id => tx("readwrite", s => s.delete(id));
export const clearActs = () => tx("readwrite", s => s.clear());
