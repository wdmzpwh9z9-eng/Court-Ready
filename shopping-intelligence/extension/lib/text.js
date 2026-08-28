/**
 * text.js — tokenization + lightweight lexical similarity.
 *
 * Phase 1 runs fully offline with no ML: similarity is TF-IDF-weighted token
 * overlap (cosine). This is deliberately a *drop-in seam* — see matcher.js,
 * where Phase 2's image/text embedding scorer plugs in behind the same
 * `similarity(a, b) -> 0..1` contract without touching the ranker or the UI.
 */

const STOP = new Set([
  "the", "a", "an", "and", "or", "for", "with", "of", "in", "on", "to", "by",
  "this", "that", "these", "those", "is", "are", "your", "you", "our", "new",
  "set", "pack", "size", "color", "colour", "men", "mens", "women", "womens",
  "unisex", "premium", "quality", "official", "genuine",
]);

/** Normalize + split into meaningful tokens. */
export function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** Build a term -> IDF map across the corpus of documents (arrays of tokens). */
export function buildIdf(documents) {
  const df = new Map();
  for (const doc of documents) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) || 0) + 1);
  }
  const n = documents.length || 1;
  const idf = new Map();
  for (const [term, count] of df) {
    // smoothed idf, always positive
    idf.set(term, Math.log((n + 1) / (count + 1)) + 1);
  }
  return idf;
}

/** TF-IDF sparse vector for a token list, given an IDF map. */
export function tfidfVector(tokens, idf) {
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const vec = new Map();
  for (const [term, count] of tf) {
    const weight = (count / tokens.length) * (idf.get(term) || 1);
    vec.set(term, weight);
  }
  return vec;
}

/** Cosine similarity between two sparse vectors (Map term -> weight). */
export function cosine(a, b) {
  if (!a.size || !b.size) return 0;
  let dot = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [term, w] of small) {
    const w2 = large.get(term);
    if (w2) dot += w * w2;
  }
  if (!dot) return 0;
  let na = 0, nb = 0;
  for (const w of a.values()) na += w * w;
  for (const w of b.values()) nb += w * w;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
