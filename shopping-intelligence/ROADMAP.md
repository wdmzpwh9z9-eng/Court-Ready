# Roadmap — from "dupe finder" to a Shopping Intelligence Platform

The single-trend framing ("find dupes") is narrow and undefensible. Aura is
positioned as a **long-term shopping assistant**: finding cheaper alternatives is
*one* feature beside authenticity, overpricing, quality, materials, style, and
price tracking. That breadth is the moat — and it opens multiple revenue paths
(affiliate, premium subscription, and licensing the recommendation engine).

## Phase 1 — Foundation ✅ (this PR)
A real, loadable MV3 Chrome extension, fully offline.
- Product detection across most stores (schema.org / OpenGraph / microdata / Amazon)
- Local seed catalog (~40 products) on a versioned canonical schema
- Recommendation engine (pluggable scorers) + a transparent signal suite:
  cheaper alternatives, overpricing alert, quality score, authenticity flags,
  best-value pick
- Demo mode, generated icons, engine smoke tests

## Phase 2 — AI image embeddings & semantic matching
Make matching *see*, not just read.
- Add image + text embeddings; precompute catalog vectors at build time
- Register an `embeddingScorer` in the matcher's scorer array (seam already exists)
- Visual style matching ("looks like this," not just "named like this")
- **Deliverable:** noticeably better matches on visually-similar / differently-titled items

## Phase 3 — Own the catalog: crawlers & affiliates
Stop depending on a seed file.
- Scheduled crawlers + affiliate feeds normalized into the **same** canonical schema
- Catalog refresh + freshness/availability in the service worker
- Affiliate link attribution (revenue path #1)
- **Deliverable:** thousands of live, purchasable, monetized products

## Phase 4 — Get smarter with every search
- **Personalization:** learn brand/price/style preferences; re-weight results
- **Price history & drop tracking:** snapshot prices, alert on drops
- **Quality scoring v2:** learned from reviews/returns/material data
- **User feedback loop:** thumbs up/down feeds a feedback scorer
- **Deliverable:** results that improve per-user over time — the compounding moat

## The platform surface (why this isn't a dupe finder)

| Capability | First lands | Revenue lever |
| --- | --- | --- |
| Cheaper alternatives | Phase 1 | Affiliate |
| Overpricing alerts | Phase 1 | Retention / premium |
| Quality & material analysis | Phase 1 → v2 in Phase 4 | Premium |
| Authenticity detection | Phase 1 → graph model in Phase 4 | Premium / trust |
| Visual style matching | Phase 2 | Affiliate / engagement |
| Price history & drop tracking | Phase 4 | Premium |
| Personalized recommendations | Phase 4 | Retention / licensing |
| Recommendation engine (API) | Phase 3+ | **Licensing to other apps** |
