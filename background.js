// Récupère les taux de changes.
// Source : open.er-api.com (ExchangeRate-API).
const API = "https://open.er-api.com/v6/latest/USD";
const MAX_AGE = 12 * 60 * 60 * 1000;

async function refresh() {
  const { updated = 0 } = await browser.storage.local.get("updated");
  if (Date.now() - updated < MAX_AGE) return { ok: true };
  try {
    const res = await fetch(API, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (data.result !== "success" || !data.rates)
      throw new Error("réponse invalide");
    await browser.storage.local.set({ rates: data.rates, updated: Date.now() });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
}

browser.runtime.onInstalled.addListener(refresh);
browser.runtime.onStartup.addListener(refresh);
browser.alarms.create("refresh-rates", { periodInMinutes: 180 });
browser.alarms.onAlarm.addListener((a) => {
  if (a.name === "refresh-rates") refresh();
});
browser.runtime.onMessage.addListener((msg) =>
  msg && msg.type === "ensure" ? refresh() : undefined,
);
