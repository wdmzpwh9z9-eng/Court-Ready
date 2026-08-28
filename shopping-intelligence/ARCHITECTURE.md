# Architecture

Aura is built so the *intelligence deepens without a rewrite*. Each layer has a
narrow contract; later phases swap an implementation behind that contract rather
than rethreading the app. This document is the map of those seams.

## Data flow (one popup "read")

```
 ┌──────────────┐   AURA_GET_PRODUCT    ┌──────────────────┐
 │  popup.js    │ ────────────────────▶ │ content-script   │
 │ (orchestr.)  │ ◀──────────────────── │  + extractors    │  reads the page
 └──────┬───────┘   { product }         └──────────────────┘
        │
        │ AURA_GET_CATALOG            ┌──────────────────┐
        ├───────────────────────────▶│ service-worker   │  loads/caches catalog
        │ ◀───────────────────────── │                  │
        │   { products }             └──────────────────┘
        ▼
 ┌──────────────────────────────────────────────┐
 │ lib/matcher.js   → ranked alternatives        │
 │ lib/analysis.js  → overpricing / quality /    │
 │                    authenticity / best-value  │
 └──────────────────────────────────────────────┘
        ▼
   render into popup UI
```

Nothing leaves the browser in Phase 1.

## Modules & contracts

### `content/extractors.js` — page → normalized product
`AuraExtractors.detect()` tries, most-general first: schema.org JSON‑LD →
microdata → OpenGraph/meta → site-specific (Amazon). Returns the canonical
product shape (see below) or `null`. Adding a retailer = adding one strategy
function; nothing downstream changes.

### `lib/matcher.js` — recommendation engine
```js
const matcher = createMatcher(products);
matcher.recommend(query, { limit, minSimilarity }) // → ranked alternatives
```
Internally it's a **ranker over a list of scorers**. A scorer is
`(query, candidate) -> 0..1`. Phase 1 ships three: lexical (TF‑IDF cosine),
category/subcategory, and material overlap. **This is the key seam** — Phase 2's
embedding scorer is one more entry in the `scorers` array with a weight; the
ranker, filters, and UI are untouched.

### `lib/analysis.js` — the signal suite
Pure functions, each returning a small object with a `confidence` and a
human-readable `reason` so the UI can be honest about heuristic vs. model:
`overpricingAlert`, `qualityScore`, `authenticitySignal`, `bestValue`.

### `background/service-worker.js` — shared state
Thin today (catalog load + cache). It is the intended home for Phase 3/4:
scheduled catalog refresh, price-history capture, and the personalization store.

## Canonical product schema (v1)

Defined and documented in `tools/build-catalog.mjs`. Both the crawler (Phase 3)
and the extractors normalize *into* this shape, so the engine only ever sees one
format:

```
id, title, brand, category, subcategory, price, currency, msrp,
image, url, retailer, materials[], keywords[],
quality { construction, durability, materialGrade, rating, reviewCount },
authorizedSeller
```

## Where each future phase plugs in

| Phase | Change | Files touched |
| --- | --- | --- |
| **2 — Embeddings** | Add `embeddingScorer` to the `scorers` array; precompute image/text vectors at catalog build | `lib/matcher.js`, `tools/build-catalog.mjs` (+ an embedding step) |
| **3 — Crawlers/affiliates** | Feed real scraped/affiliate rows through the same normalizer that emits `catalog.json`; refresh on a schedule | `tools/build-catalog.mjs`, `background/service-worker.js` |
| **4 — Personalization / price history / feedback** | Persist per-user signals + price snapshots in the worker; add a feedback scorer that re-weights results | `background/service-worker.js`, `lib/matcher.js` |

## Design principles

1. **Offline-first.** Phase 1 needs no backend, so it's private and demoable.
2. **Transparent intelligence.** Every signal carries a reason and confidence.
3. **Narrow contracts.** Detection, matching, and analysis never reach into each
   other's internals — they pass the canonical product shape.
4. **One product format, everywhere.** Extractors and crawlers converge on it.
