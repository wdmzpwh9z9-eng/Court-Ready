/**
 * content-script.js — runs on every page; answers the popup's request for the
 * product currently on screen. Detection is lazy (only when asked) to keep the
 * page fast. It also re-detects on demand in case the page hydrated late (SPA).
 */
(function () {
  "use strict";

  function detectNow() {
    try {
      return window.AuraExtractors ? window.AuraExtractors.detect() : null;
    } catch (e) {
      return null;
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "AURA_GET_PRODUCT") {
      sendResponse({ product: detectNow(), url: location.href, title: document.title });
    }
    // synchronous response
    return false;
  });
})();
