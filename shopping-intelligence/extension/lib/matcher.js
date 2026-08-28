/**
 * matcher.js — the recommendation engine.
 *
 * Design goal: the *ranker* and the *scorers* are separate. A scorer is any
 * function `(query, candidate, ctx) -> { score: 0..1, weight }`. Phase 1 ships
 * three lexical/structured scorers below. Phase 2 adds an `embeddingScorer`
 * (image + text vectors) to this same array — nothing else changes. That's the
 * defensible seam: the intelligence deepens without a rewrite.
 */

import { tokenize, buildIdf, tfidfVector, cosine } from "./text.js";

/** Combine the searchable text fields of a product into one token list. */
function docTokens(product) {
  return tokenize(
    [product.title, product.brand, product.subcategory, (product.keywords || []).join(" "), (product.materials || []).join(" ")].join(" ")
  );
}

/**
 * Build a reusable matcher over a catalog. Pre-computes the IDF corpus and
 * per-product vectors once so scoring each query is cheap.
 */
export function createMatcher(products) {
  const docs = products.map(docTokens);
  const idf = buildIdf(docs);
  const vectors = products.map((_, i) => tfidfVector(docs[i], idf));

  // ---- Scorers (each returns 0..1). Add more here in later phases. ----

  // 1. Lexical similarity of title/brand/keywords/materials (TF-IDF cosine).
  const lexicalScorer = (qVec, cand, i) => cosine(qVec, vectors[i]);

  // 2. Category / subcategory structural match.
  const categoryScorer = (query, cand) => {
    let s = 0;
    if (query.category && cand.category === query.category) s += 0.6;
    if (query.subcategory && cand.subcategory === query.subcategory) s += 0.4;
    // If we couldn't detect a category, don't penalize — stay neutral.
    return query.category ? s : 0.5;
  };

  // 3. Material overlap (Jaccard).
  const materialScorer = (query, cand) => {
    const qm = new Set((query.materials || []).map((m) => m.toLowerCase()));
    const cm = new Set((cand.materials || []).map((m) => m.toLowerCase()));
    if (!qm.size || !cm.size) return 0.5; // neutral when unknown
    let inter = 0;
    for (const m of qm) if (cm.has(m)) inter++;
    return inter / (qm.size + cm.size - inter);
  };

  const scorers = [
    { fn: lexicalScorer, weight: 0.6, needsVector: true },
    { fn: categoryScorer, weight: 0.28 },
    { fn: materialScorer, weight: 0.12 },
    // Phase 2: { fn: embeddingScorer, weight: 0.5, needsVector: false } and
    //          re-normalize weights. See ARCHITECTURE.md.
  ];

  /**
   * Score one candidate against a query product. Returns 0..1 similarity.
   */
  function similarity(query, qVec, cand, i) {
    let total = 0;
    let wsum = 0;
    for (const s of scorers) {
      const val = s.needsVector ? s.fn(qVec, cand, i) : s.fn(query, cand, i);
      total += val * s.weight;
      wsum += s.weight;
    }
    return wsum ? total / wsum : 0;
  }

  /**
   * Find alternatives to a detected product.
   * @param {Object} query           detected product (may be partial)
   * @param {Object} [opts]
   * @param {number} [opts.limit=6]   max results
   * @param {number} [opts.minSimilarity=0.12]
   * @returns {Array} ranked alternatives with similarity + savings metadata
   */
  function recommend(query, opts = {}) {
    const { limit = 6, minSimilarity = 0.12 } = opts;
    const qVec = tfidfVector(docTokens(query), idf);
    const price = Number(query.price) || null;

    const scored = products
      .map((cand, i) => {
        const sim = similarity(query, qVec, cand, i);
        const cheaper = price != null && cand.price < price;
        const savings = cheaper ? price - cand.price : 0;
        const savingsPct = cheaper ? savings / price : 0;
        return { product: cand, similarity: sim, cheaper, savings, savingsPct };
      })
      // drop the item the user is already looking at (id match or near-identical)
      .filter((r) => r.product.id !== query.id && r.similarity >= minSimilarity)
      .filter((r) => !(query.title && r.product.title.toLowerCase() === String(query.title).toLowerCase() && r.product.brand === query.brand))
      // drop same-brand items that aren't cheaper — redundant with the product
      // the user is already looking at, never a "smarter alternative".
      .filter((r) => {
        const sameBrand = query.brand && r.product.brand.toLowerCase() === String(query.brand).toLowerCase();
        return !(sameBrand && !r.cheaper);
      });

    // Rank: relevance first, then reward genuine savings among relevant items.
    scored.sort((a, b) => {
      const ra = a.similarity + Math.min(a.savingsPct, 0.6) * 0.35;
      const rb = b.similarity + Math.min(b.savingsPct, 0.6) * 0.35;
      return rb - ra;
    });

    return scored.slice(0, limit);
  }

  return { recommend, similarity, _idf: idf };
}
