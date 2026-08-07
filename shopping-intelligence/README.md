# Aura — AI Shopping Intelligence (Phase 1)

> See past the price tag. Aura detects the product you're viewing and returns
> **cheaper alternatives, an overpricing check, a quality score, and
> authenticity red-flags** — not just "dupes."

This is **Phase 1**: a real, loadable Chrome extension (Manifest V3) with a
bundled product catalog and an offline recommendation + analysis engine. No
server, no API keys, nothing leaves the browser. It's built as the foundation
for a longer roadmap (image embeddings → live crawlers → personalization) — see
[`ROADMAP.md`](./ROADMAP.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## What it does today

| Signal | Phase‑1 implementation |
| --- | --- |
| **Cheaper alternatives** | TF‑IDF + structured (category/material) similarity over a local catalog, ranked by relevance and genuine savings |
| **Overpricing alert** | Compares the item's price to the median of comparable items |
| **Quality score** | Composite of construction / durability / material grade / reviews (0–100) |
| **Authenticity signal** | Rules-based red-flags (price-vs-brand baseline, seller channel, thin reviews) |
| **Best-value pick** | Highest quality-per-dollar *within the same product class* |

## Load it in Chrome (unpacked)

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top-right)
3. Click **Load unpacked**
4. Select the **`shopping-intelligence/extension`** folder
5. Pin **Aura** to your toolbar

## Try it

- Visit a product page on most online stores (anything exposing `schema.org`
  Product data, OpenGraph product tags, or Amazon) and click the Aura icon.
- **No shopping page handy?** Aura's popup includes a **live demo picker** — pick
  a sample product and watch the full signal suite run against the local catalog.

## Develop

```bash
cd shopping-intelligence
node tools/build-catalog.mjs   # regenerate extension/data/catalog.json
node tools/make-icons.mjs      # regenerate extension/assets/icons/*.png
node tools/smoke-test.mjs      # exercise the engine end-to-end (no browser)
```

## Layout

```
shopping-intelligence/
├── extension/            # the Chrome extension (load this folder unpacked)
│   ├── manifest.json
│   ├── background/       # MV3 service worker (catalog cache; future: crawlers)
│   ├── content/          # on-page product detection
│   ├── popup/            # the UI
│   ├── lib/              # the offline engine (matcher + analysis + text)
│   ├── data/catalog.json # bundled seed catalog (generated)
│   └── assets/icons/     # generated PNG icons
├── tools/                # catalog generator, icon generator, smoke test
├── ARCHITECTURE.md
└── ROADMAP.md
```

## Honest limits (Phase 1)

The catalog is a **seed** of ~40 real-world-styled products, and every signal is
a **transparent heuristic** — the UI labels them as such. This phase proves the
detection → match → intelligence → UI pipeline and leaves clean seams where the
ML, crawlers, and personalization of later phases plug in.
