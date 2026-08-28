/**
 * service-worker.js — MV3 background.
 *
 * Phase 1 keeps this thin: it owns catalog loading (so the popup and any future
 * surfaces share one cached copy) and exposes a message API. It's the natural
 * home for Phase 3/4 work — scheduled catalog refresh, price-history capture,
 * and the personalization store — so those land here without touching the UI.
 */

let catalogPromise = null;

/** Load and cache the bundled catalog. Later: refresh from a remote feed. */
function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(chrome.runtime.getURL("data/catalog.json"))
      .then((r) => r.json())
      .then((data) => data.products || [])
      .catch((err) => {
        console.error("[Aura] catalog load failed", err);
        catalogPromise = null; // allow retry
        return [];
      });
  }
  return catalogPromise;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "AURA_GET_CATALOG") {
    loadCatalog().then((products) => sendResponse({ products }));
    return true; // async response
  }
  return false;
});

// Warm the cache on install so the first popup open is instant.
chrome.runtime.onInstalled.addListener(() => {
  loadCatalog();
});
