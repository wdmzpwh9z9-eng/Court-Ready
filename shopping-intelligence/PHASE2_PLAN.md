# Phase 2 — Implementation Plan: In-Browser CLIP (image + text)

> Status: **proposal, awaiting approval.** No Phase 2 code is written yet.
> Delivers visual + semantic matching while keeping Phase 1's offline-first,
> no-backend, nothing-leaves-the-browser promise.

## 1. Objective

Match on what an item *is*, not just what it's *named*. Today two visually
identical sweaters with different titles score low. With CLIP embeddings, image
and text share one vector space, so Aura finds look-alikes and paraphrased
listings — the jump from "keyword tool" to "AI shopping intelligence."

**Success = ** on a held-out set of query→expected-match pairs where titles
differ but the item is clearly comparable, the embedding scorer ranks the
expected match in the top 3 meaningfully more often than Phase 1 lexical alone
(target: +25 percentage points top-3 recall on the fixture).

## 2. Approach (chosen): in-browser CLIP via transformers.js

- **Model:** CLIP ViT‑B/32 (`Xenova/clip-vit-base-patch32`) running through
  [transformers.js](https://github.com/xenova/transformers.js) on the ONNX
  Runtime Web (WASM backend; opportunistically WebGPU where available).
  CLIP produces **aligned 512‑dim image and text embeddings** — exactly the
  image+text space we want.
- **Everything local.** Model weights + WASM runtime are **bundled inside the
  extension package** (not fetched at runtime) so there's no remote-code / CSP
  problem and no dependency on a CDN being up. `env.allowLocalModels = true`,
  `env.localModelPath = chrome.runtime.getURL('models/')`, and
  `env.backends.onnx.wasm.wasmPaths` point at bundled files.
- **Catalog vectors precomputed offline** at build time and shipped with the
  extension. Only the *page* product is embedded live.

### Why not the alternatives
- *Text-only in-browser:* smaller, but no true visual match — defeats the point
  of Phase 2.
- *Hosted API + backend:* best raw quality, but breaks offline-first, needs keys
  + hosting, and can't run in an ephemeral session. Revisit only if in-browser
  latency/size proves unacceptable.

## 3. Architecture — what changes, what doesn't

The matcher is already a ranker over pluggable scorers, so Phase 2 is additive:

```
lib/
  embeddings.js   (NEW) load CLIP once; embedImage(url) / embedText(str) -> Float32Array(512)
  vectors.js      (NEW) load catalog vectors; cosine over typed arrays
  matcher.js      (EDIT) register embeddingScorer in the scorers[] array + reweight
tools/
  build-embeddings.mjs (NEW) precompute catalog image+text vectors -> data/embeddings.bin
  build-catalog.mjs    (EDIT) call the embedding step; record vector offsets on each product
background/
  service-worker.js (EDIT) own model warm-up + an IndexedDB embedding cache
extension/models/  (NEW) bundled ONNX weights + WASM runtime
```

**Unchanged:** `analysis.js`, the popup UI, the extractors, the canonical
product schema (we only *add* a `vec` reference), and the ranking/filter logic.

### 3.1 The new scorer (the whole integration point)
```js
// in createMatcher(): one more entry, then weights re-normalize automatically
const embeddingScorer = (query, cand, i) =>
  query._vec ? cosine(query._vec, catalogVectors[i]) : 0.5; // neutral if no vec
scorers.push({ fn: embeddingScorer, weight: 0.5, needsVector: false });
// lexical drops 0.6 -> ~0.3; category/material shrink proportionally.
```
`query._vec` is computed once per popup open (image if present, else text) and
attached to the detected product before `recommend()` runs.

### 3.2 Query embedding at runtime
1. Popup gets the detected product (existing flow).
2. Ask the service worker to embed it: prefer the product **image**
   (`embedImage`), fall back to **title+brand text** (`embedText`) when there's
   no usable image.
3. Image pixels: `fetch(imageUrl)` (allowed by existing `host_permissions`) →
   `Blob` → `createImageBitmap` → offscreen canvas → tensor. Fetching the blob
   avoids canvas tainting/CORS issues that a bare `<img>` would hit.
4. Cosine the query vector against the precomputed catalog vectors.

### 3.3 Precomputed catalog vectors
- `tools/build-embeddings.mjs` runs the *same* CLIP model in Node, embeds each
  product's image + title, and writes a compact binary (`data/embeddings.bin`,
  Float32 512‑dim per product; ~80 KB for 40 items, scales linearly). Each
  product in `catalog.json` gets a `vecIndex`.
- Regenerating is a build step: `npm run build:embeddings`.

## 4. Performance, size & caching

| Concern | Plan |
| --- | --- |
| Model download size | CLIP ViT‑B/32 quantized ONNX ≈ 40–90 MB, **bundled** (one-time install cost, no per-use download). Documented in README as the Phase‑2 tradeoff. |
| First-inference latency | Warm the model in the service worker on install/startup; keep the session alive during a popup. Single-image embed ≈ 100–400 ms on WASM, faster on WebGPU. |
| Repeat work | Cache page-product embeddings by image URL in IndexedDB; catalog vectors load once. |
| Graceful degradation | If the model fails to load or times out, **fall back to Phase‑1 lexical scoring** (the `0.5` neutral above + existing scorers). Aura never breaks. |

## 5. Privacy

Unchanged posture: inference is local. The only network call is fetching the
product's own image from the retailer's public CDN (the same image the page
already loaded). No user data, no page content, and no images are sent to us or
any third party.

## 6. Testing

- **Fixture:** a small labeled set (`tools/fixtures/pairs.json`) of query→expected
  comparable pairs with differing titles/images.
- **`tools/embed-test.mjs`:** runs both engines over the fixture and asserts the
  embedding scorer's top‑3 recall beats lexical by the target margin.
- Extend `smoke-test.mjs` to assert the scorer registers, weights re-normalize to
  1, and results still return when `_vec` is absent (fallback path).
- Manual: load unpacked, verify a real product page produces a query vector and
  visibly better look-alike matches; verify offline still works after first load.

## 7. Milestones (in build order)

1. **Vendor the model** — bundle ONNX weights + WASM; prove `embedText` returns a
   512‑vec in the extension.
2. **`lib/embeddings.js` + `lib/vectors.js`** — load/cache model; cosine over
   typed arrays; unit-checked in Node.
3. **`tools/build-embeddings.mjs`** — precompute catalog vectors; wire into
   `build-catalog.mjs`; commit `embeddings.bin`.
4. **Matcher integration** — add `embeddingScorer`, re-normalize weights, attach
   `query._vec` in the popup flow; keep the lexical fallback.
5. **Runtime image path** — blob→bitmap→canvas→tensor; IndexedDB cache; SW warm-up.
6. **Tests + docs** — fixture, `embed-test.mjs`, README/ARCHITECTURE updates,
   note the model-size tradeoff.

## 8. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Bundle size makes the extension heavy | Use quantized weights; document the tradeoff; if unacceptable, offer a "download model on first use" variant (still no server) as a follow-up toggle. |
| WASM/WebGPU perf varies by machine | Warm-up + caching; fall back to lexical if embed exceeds a time budget. |
| Remote image fetch blocked/tainted | Blob fetch via `host_permissions`; text fallback when no image. |
| CLIP mismatches on non-fashion categories | Keep lexical + category scorers in the blend so structured signals still anchor results. |

## 9. Explicitly out of scope for Phase 2

Live crawlers/affiliate feeds (Phase 3) and personalization/price-history/feedback
(Phase 4). Phase 2 only deepens *matching quality* behind the existing seam.

---

### Open decisions for you before I build
1. **Bundle the model in the package** (heavier install, zero runtime fetch) vs.
   **download-on-first-use** (lean install, one-time fetch from an allowed host).
   Plan above assumes *bundle*; say the word if you'd rather go lean.
2. **Recall target** (+25 pts top‑3 on the fixture) — good as the bar, or set a
   different one?
