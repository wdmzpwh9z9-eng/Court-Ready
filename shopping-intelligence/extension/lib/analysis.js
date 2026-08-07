/**
 * analysis.js — the "intelligence" beyond dupe-finding.
 *
 * These are the Phase-1, rules-based versions of the platform's signal suite:
 *   • overpricing alert      • quality score
 *   • authenticity signal    • best-value pick
 *
 * Every function here is transparent and offline. They are intentionally
 * heuristic — each returns a `confidence` and a human-readable `reason` so the
 * UI can be honest about what's a model vs. a rule. Phase 2/4 swap the internals
 * (real comparables, learned quality models, seller-graph authenticity) behind
 * the same return shapes.
 */

/** Median of a numeric array. */
function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Products that are plausibly the same *class* of item as the query. */
function comparables(query, matcher, products) {
  const recs = matcher.recommend(query, { limit: 12, minSimilarity: 0.18 });
  const set = recs.map((r) => r.product);
  // include ones with matching subcategory even if lexical sim was modest
  if (query.subcategory) {
    for (const p of products) {
      if (p.subcategory === query.subcategory && !set.includes(p)) set.push(p);
    }
  }
  return set;
}

/**
 * Overpricing alert. Compares the query price to the median of comparable
 * items. Returns null when we lack a price or enough comparables to be fair.
 */
export function overpricingAlert(query, matcher, products) {
  const price = Number(query.price);
  if (!price) return null;
  const comps = comparables(query, matcher, products);
  const prices = comps.map((p) => p.price).filter(Boolean);
  if (prices.length < 3) return null;

  const med = median(prices);
  const ratio = price / med;
  const cheapest = Math.min(...prices);

  let level = "fair";
  if (ratio >= 1.6) level = "high";
  else if (ratio >= 1.25) level = "elevated";
  else if (ratio <= 0.85) level = "good-deal";

  return {
    level,
    ratio,
    price,
    median: med,
    cheapestComparable: cheapest,
    potentialSaving: Math.max(0, price - cheapest),
    confidence: Math.min(1, prices.length / 8),
    reason:
      level === "high"
        ? `About ${Math.round((ratio - 1) * 100)}% above the typical price for similar items (median $${med}).`
        : level === "elevated"
        ? `A bit above the typical price for similar items (median $${med}).`
        : level === "good-deal"
        ? `Priced below the typical $${med} for similar items — solid value.`
        : `In line with similar items (median $${med}).`,
  };
}

/**
 * Composite quality score (0..100) from the catalog's build/material/review
 * signals. For a *detected* page product we usually only have reviews, so the
 * score degrades gracefully and reports which inputs it had.
 */
export function qualityScore(product) {
  const q = product.quality || {};
  const parts = [];
  if (q.construction != null) parts.push(["Construction", q.construction, 0.3]);
  if (q.durability != null) parts.push(["Durability", q.durability, 0.3]);
  if (q.materialGrade != null) parts.push(["Materials", q.materialGrade, 0.25]);
  if (q.rating != null) parts.push(["Reviews", q.rating / 5, 0.15]);
  if (!parts.length) return null;

  const wsum = parts.reduce((a, [, , w]) => a + w, 0);
  const score = parts.reduce((a, [, v, w]) => a + v * w, 0) / wsum;
  return {
    score: Math.round(score * 100),
    breakdown: parts.map(([label, v]) => ({ label, value: Math.round(v * 100) })),
    reviewCount: q.reviewCount || null,
    confidence: Math.min(1, parts.length / 4),
  };
}

/**
 * Authenticity signal — rules-based red-flag detection. This flags *risk*, it
 * does not certify authenticity. Phase 4 replaces the internals with a
 * seller-reputation graph + listing-anomaly model.
 */
export function authenticitySignal(query, matcher, products) {
  const flags = [];
  const price = Number(query.price);

  // Compare against the same-brand baseline if we know the brand.
  if (query.brand && price) {
    const sameBrand = products.filter(
      (p) => p.brand.toLowerCase() === String(query.brand).toLowerCase()
    );
    if (sameBrand.length) {
      const base = median(sameBrand.map((p) => p.price));
      if (base && price < base * 0.4) {
        flags.push({
          severity: "high",
          text: `Listed ${Math.round((1 - price / base) * 100)}% below ${query.brand}'s typical price — steep discounts on brand-name goods are a common counterfeit signal.`,
        });
      }
    }
  }

  // Seller channel heuristic.
  if (query.authorizedSeller === false) {
    flags.push({
      severity: "medium",
      text: "Not sold through the brand or an authorized retailer.",
    });
  }

  // Weak review base on a premium item.
  const q = query.quality || {};
  if (price >= 150 && q.reviewCount != null && q.reviewCount < 10) {
    flags.push({
      severity: "low",
      text: "Premium-priced item with very few reviews.",
    });
  }

  const worst = flags.reduce(
    (acc, f) => Math.max(acc, { low: 1, medium: 2, high: 3 }[f.severity]),
    0
  );
  const level = ["clear", "watch", "caution", "risk"][worst];
  return {
    level, // clear | watch | caution | risk
    flags,
    confidence: query.brand && price ? 0.6 : 0.3,
    reason:
      level === "clear"
        ? "No authenticity red flags detected from available signals."
        : "Some signals warrant a closer look before buying.",
  };
}

/**
 * Best-value pick: highest quality-per-dollar among recommended alternatives.
 * Constrained to the *same class* as the query when we know it, so we never
 * pitch a t-shirt as the smart alternative to a cashmere sweater. Also requires
 * a minimum relevance so the pick is genuinely comparable.
 */
export function bestValue(recommendations, query = {}) {
  const sub = query.subcategory;
  const cat = query.category;
  const inClass = (p) =>
    sub ? p.subcategory === sub : cat ? p.category === cat : true;

  let pool = recommendations.filter(
    (r) => inClass(r.product) && r.similarity >= 0.3
  );
  if (!pool.length) pool = recommendations; // graceful fallback

  let best = null;
  for (const r of pool) {
    const qs = qualityScore(r.product);
    if (!qs || !r.product.price) continue;
    const valuePerDollar = qs.score / r.product.price;
    if (!best || valuePerDollar > best.valuePerDollar) {
      best = { ...r, quality: qs.score, valuePerDollar };
    }
  }
  return best;
}
