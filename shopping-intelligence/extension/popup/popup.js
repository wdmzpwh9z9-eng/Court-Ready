/**
 * popup.js — orchestrates a single "read": detect the on-page product, load the
 * catalog, run the matcher + analysis, and render. Kept declarative; all the
 * intelligence lives in ../lib.
 */

import { createMatcher } from "../lib/matcher.js";
import {
  overpricingAlert,
  qualityScore,
  authenticitySignal,
  bestValue,
} from "../lib/analysis.js";

const $ = (id) => document.getElementById(id);
const money = (n, cur = "USD") =>
  n == null
    ? "—"
    : new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

function show(state) {
  for (const id of ["state-loading", "state-empty", "state-results"]) {
    $(id).classList.toggle("hidden", id !== state);
  }
}

/** Ask the active tab's content script what product is on screen. */
async function getPageProduct() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return null;
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "AURA_GET_PRODUCT" });
    return res && res.product ? res.product : null;
  } catch {
    // Content script not present (e.g. chrome:// pages, PDF viewer).
    return null;
  }
}

/** Load the catalog via the service worker (falls back to a direct fetch). */
async function getCatalog() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "AURA_GET_CATALOG" });
    if (res && res.products && res.products.length) return res.products;
  } catch {
    /* fall through */
  }
  const data = await fetch(chrome.runtime.getURL("data/catalog.json")).then((r) => r.json());
  return data.products || [];
}

// ---- Rendering -------------------------------------------------------------

function renderDetected(product) {
  $("d-image").src = product.image || "";
  $("d-image").alt = product.title || "";
  $("d-brand").textContent = product.brand || "";
  $("d-title").textContent = product.title || "Untitled product";
  $("d-price").textContent = product.price ? money(product.price, product.currency) : "Price not found";
  const badge = $("d-source");
  const label = { amazon: "Amazon", jsonld: "structured data", meta: "page tags", microdata: "microdata", demo: "demo" }[product.source] || "detected";
  badge.textContent = label;
}

function signalCard({ full, dotClass, head, valueClass, value, note }) {
  const el = document.createElement("div");
  el.className = "signal" + (full ? " full" : "");
  el.innerHTML = `
    <div class="signal-head"><span class="signal-dot ${dotClass}"></span>${head}</div>
    <div class="signal-value ${valueClass || ""}">${value}</div>
    ${note ? `<div class="signal-note">${note}</div>` : ""}`;
  return el;
}

function renderSignals(product, matcher, products) {
  const wrap = $("signals");
  wrap.innerHTML = "";

  // Overpricing
  const op = overpricingAlert(product, matcher, products);
  if (op) {
    const map = {
      high: ["dot-danger", "v-danger", "Overpriced"],
      elevated: ["dot-warn", "v-warn", "A bit high"],
      fair: ["dot-good", "v-good", "Fair price"],
      "good-deal": ["dot-good", "v-good", "Good deal"],
    };
    const [dot, vcls, label] = map[op.level];
    const note =
      op.potentialSaving > 0
        ? `Similar from ${money(op.cheapestComparable, product.currency)} · save up to ${money(op.potentialSaving, product.currency)}`
        : `Median ${money(op.median, product.currency)} for similar items`;
    wrap.appendChild(signalCard({ dotClass: dot, head: "Price check", valueClass: vcls, value: label, note }));
  }

  // Quality
  const qs = qualityScore(product);
  if (qs) {
    const vcls = qs.score >= 80 ? "v-good" : qs.score >= 60 ? "v-warn" : "v-danger";
    const dot = qs.score >= 80 ? "dot-good" : qs.score >= 60 ? "dot-warn" : "dot-danger";
    const note = qs.reviewCount ? `${qs.reviewCount.toLocaleString()} reviews` : "from build & material signals";
    const card = signalCard({ dotClass: dot, head: "Quality", valueClass: vcls, value: `${qs.score}/100`, note });
    const meter = document.createElement("div");
    meter.className = "meter";
    meter.innerHTML = `<span style="width:${qs.score}%"></span>`;
    card.appendChild(meter);
    wrap.appendChild(card);
  }

  // Authenticity (full width when there are flags)
  const auth = authenticitySignal(product, matcher, products);
  if (auth) {
    const map = {
      clear: ["dot-good", "v-good", "No flags"],
      watch: ["dot-warn", "v-warn", "Worth a look"],
      caution: ["dot-warn", "v-warn", "Caution"],
      risk: ["dot-danger", "v-danger", "Red flags"],
    };
    const [dot, vcls, label] = map[auth.level];
    const note = auth.flags.length ? auth.flags[0].text : auth.reason;
    wrap.appendChild(signalCard({ full: auth.flags.length > 0, dotClass: dot, head: "Authenticity", valueClass: vcls, value: label, note }));
  }
}

function renderBestValue(bv, currency) {
  const el = $("bestvalue");
  if (!bv) return el.classList.add("hidden");
  el.classList.remove("hidden");
  el.innerHTML = `
    <span class="bv-icon">✦</span>
    <span class="bv-text">Best value: <b>${bv.product.brand} ${bv.product.title}</b> —
      quality ${bv.quality}/100 at ${money(bv.product.price, currency)}.</span>`;
}

function altRow(rec, currency) {
  const p = rec.product;
  const a = document.createElement("a");
  a.className = "alt";
  a.href = p.url;
  a.target = "_blank";
  a.rel = "noopener";

  const match = Math.round(rec.similarity * 100);
  const qs = qualityScore(p);
  const priceBlock = rec.cheaper
    ? `<div class="alt-price">${money(p.price, currency)}</div><div class="alt-save">save ${money(rec.savings, currency)} (${Math.round(rec.savingsPct * 100)}%)</div>`
    : `<div class="alt-price">${money(p.price, currency)}</div>`;

  a.innerHTML = `
    <img src="${p.image}" alt="" loading="lazy" />
    <div class="alt-main">
      <div class="alt-brand">${p.brand}</div>
      <div class="alt-title">${p.title}</div>
      <div class="alt-tags">
        <span class="tag match">${match}% match</span>
        ${qs ? `<span class="tag qual">Q ${qs.score}</span>` : ""}
      </div>
    </div>
    <div class="alt-right">${priceBlock}</div>`;
  return a;
}

function renderAlternatives(recs, currency) {
  const list = $("alts");
  list.innerHTML = "";
  recs.forEach((r) => list.appendChild(altRow(r, currency)));
  $("alts-count").textContent = recs.length ? `${recs.length} found` : "none";
}

// ---- Demo mode (when no product is on the page) ----------------------------

async function renderDemoPicker(products) {
  const picks = ["ap-005", "fw-001", "el-003", "ac-020"] // a pricey pick per category shows the signals off
    .map((id) => products.find((p) => p.id === id))
    .filter(Boolean);
  const wrap = $("demo-picker");
  wrap.innerHTML = "";
  for (const p of picks) {
    const b = document.createElement("button");
    b.className = "demo-btn";
    b.innerHTML = `
      <img src="${p.image}" alt="" />
      <div class="dm-meta"><span>${p.title}</span><span class="dm-brand">${p.brand}</span></div>
      <span class="dm-price">${money(p.price, p.currency)}</span>`;
    b.addEventListener("click", () => runWith({ ...p, source: "demo" }, products));
    wrap.appendChild(b);
  }
}

// ---- Main ------------------------------------------------------------------

let matcher = null;

function runWith(product, products) {
  if (!matcher) matcher = createMatcher(products);
  const recs = matcher.recommend(product, { limit: 6 });
  renderDetected(product);
  renderSignals(product, matcher, products);
  renderBestValue(bestValue(recs, product), product.currency);
  renderAlternatives(recs, product.currency);
  show("state-results");
}

async function main() {
  show("state-loading");
  const [product, products] = await Promise.all([getPageProduct(), getCatalog()]);
  matcher = createMatcher(products);

  if (product && product.title) {
    runWith(product, products);
  } else {
    await renderDemoPicker(products);
    show("state-empty");
  }
}

main().catch((err) => {
  console.error("[Aura] popup error", err);
  $("state-loading").innerHTML = '<p style="padding:20px;color:var(--danger)">Something went wrong reading this page.</p>';
});
