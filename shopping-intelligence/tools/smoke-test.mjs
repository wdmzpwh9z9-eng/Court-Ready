/**
 * smoke-test.mjs — exercises the offline engine end-to-end without a browser.
 * Verifies detection-shaped input flows through the matcher + analysis and
 * produces sane, ranked, cheaper-where-expected results.
 *
 * Run: node tools/smoke-test.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createMatcher } from "../extension/lib/matcher.js";
import { overpricingAlert, qualityScore, authenticitySignal, bestValue } from "../extension/lib/analysis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { products } = JSON.parse(
  readFileSync(resolve(__dirname, "../extension/data/catalog.json"), "utf8")
);

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) { console.error("  ✗ " + msg); failures++; }
  else console.log("  ✓ " + msg);
};

const matcher = createMatcher(products);

// Case A: a $1050 designer cashmere crewneck — should surface cheaper cashmere/knit
// alternatives, flag overpricing vs. comparables, and score high on quality.
console.log("\nCase A — Loro Piana cashmere crewneck ($1050):");
const query = {
  title: "Cashmere Crewneck Sweater",
  brand: "Loro Piana",
  category: "apparel",
  subcategory: "knitwear",
  price: 1050,
  currency: "USD",
  materials: ["cashmere"],
  keywords: ["crewneck", "sweater", "cashmere"],
  id: "external-1",
};
const recs = matcher.recommend(query, { limit: 6 });
assert(recs.length >= 3, `returns multiple alternatives (${recs.length})`);
assert(recs.every((r) => r.product.id !== query.id), "excludes the query item");
assert(recs[0].similarity >= recs[recs.length - 1].similarity, "sorted by relevance");
assert(recs.some((r) => r.cheaper && r.product.subcategory === "knitwear"), "finds cheaper knitwear");
const topKnit = recs.find((r) => r.product.subcategory === "knitwear");
assert(topKnit && topKnit.similarity > 0.3, `top knit match is relevant (${topKnit?.similarity.toFixed(2)})`);

const op = overpricingAlert(query, matcher, products);
assert(op && (op.level === "high" || op.level === "elevated"), `flags overpricing (${op?.level})`);

const qs = qualityScore(products.find((p) => p.id === "ap-005"));
assert(qs && qs.score >= 90, `luxury item scores high quality (${qs?.score})`);

const bv = bestValue(recs, query);
assert(bv && bv.valuePerDollar > 0, `best-value pick chosen (${bv?.product.brand})`);
assert(bv.product.subcategory === "knitwear", `best value stays in-class (${bv?.product.subcategory})`);
assert(!recs.some((r) => r.product.brand === query.brand && !r.cheaper), "drops same-brand non-cheaper self");
console.log(`     → alternatives: ${recs.map((r) => `${r.product.brand} $${r.product.price}`).join(", ")}`);
console.log(`     → best value:   ${bv.product.brand} ${bv.product.title} (Q${bv.quality} @ $${bv.product.price})`);

// Case B: authenticity — a "Ray-Ban" listed absurdly cheap should raise a flag.
console.log("\nCase B — suspiciously cheap Ray-Ban:");
const fake = { title: "Ray-Ban Wayfarer Sunglasses", brand: "Ray-Ban", category: "accessories", subcategory: "sunglasses", price: 25, currency: "USD", authorizedSeller: false, id: "external-2" };
const auth = authenticitySignal(fake, matcher, products);
assert(auth && (auth.level === "caution" || auth.level === "risk"), `raises authenticity concern (${auth?.level})`);
assert(auth.flags.length >= 1, `produces at least one flag (${auth.flags.length})`);
console.log(`     → ${auth.flags.map((f) => `[${f.severity}] ${f.text}`).join("\n       ")}`);

// Case C: headphones — cross-brand alternatives at lower price.
console.log("\nCase C — Bose ANC headphones ($379):");
const bose = { title: "Premium ANC Headphones", brand: "Bose", category: "electronics", subcategory: "headphones", price: 379, currency: "USD", keywords: ["headphones", "noise cancelling", "wireless"], id: "external-3" };
const recsC = matcher.recommend(bose, { limit: 5 });
assert(recsC.some((r) => r.cheaper && r.product.subcategory === "headphones"), "finds cheaper headphones");
console.log(`     → ${recsC.map((r) => `${r.product.brand} $${r.product.price} (${Math.round(r.similarity * 100)}%)`).join(", ")}`);

console.log(`\n${failures === 0 ? "ALL PASSED" : failures + " FAILED"}\n`);
process.exit(failures === 0 ? 0 : 1);
