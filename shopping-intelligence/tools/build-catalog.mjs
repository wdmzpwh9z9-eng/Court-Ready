/**
 * build-catalog.mjs
 * -----------------
 * Phase 1: emits a static seed catalog the extension ships with.
 * Phase 3: this same module becomes the normalization stage of the crawler —
 *          raw scraped/affiliate-feed rows get mapped into this exact schema,
 *          so nothing downstream (the matcher, the UI) has to change.
 *
 * Run:  node tools/build-catalog.mjs
 * Out:  extension/data/catalog.json
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../extension/data/catalog.json");

/**
 * Canonical product schema (v1). Every field the intelligence layer relies on
 * is documented here so a future crawler knows exactly what to populate.
 *
 * @typedef {Object} Product
 * @property {string} id                 stable unique id
 * @property {string} title              display title
 * @property {string} brand              brand / house
 * @property {string} category           top-level class (apparel|footwear|accessories|electronics|home)
 * @property {string} subcategory        finer class (e.g. "knitwear", "sneakers")
 * @property {number} price              current price in `currency`
 * @property {string} currency           ISO 4217
 * @property {number} [msrp]             list price, if known (used for deal math)
 * @property {string} image              product image URL
 * @property {string} url                destination / affiliate link
 * @property {string} retailer           where it's sold
 * @property {string[]} materials        e.g. ["merino wool"]
 * @property {string[]} keywords         search tokens (style, color, fit, use)
 * @property {Object} quality            quality signals (0..1 unless noted)
 * @property {number} quality.construction  seam/build quality
 * @property {number} quality.durability     expected longevity
 * @property {number} quality.materialGrade  raw material quality
 * @property {number} quality.rating         avg review rating (0..5)
 * @property {number} quality.reviewCount    number of reviews
 * @property {boolean} authorizedSeller  true if sold by brand/authorized channel
 */

/** Small helper so the seed reads like data, not code. */
function p(o) {
  return {
    currency: "USD",
    materials: [],
    keywords: [],
    authorizedSeller: true,
    ...o,
    quality: {
      construction: 0.7,
      durability: 0.7,
      materialGrade: 0.7,
      rating: 4.2,
      reviewCount: 120,
      ...(o.quality || {}),
    },
  };
}

// Deterministic placeholder image (works offline in the popup as a soft fallback).
const IMG = (seed) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/400`;

const catalog = [
  // ---------- APPAREL: knitwear ----------
  p({ id: "ap-001", title: "Merino Crewneck Sweater", brand: "Everlane", category: "apparel", subcategory: "knitwear", price: 98, msrp: 110, image: IMG("ap-001"), url: "https://example-affiliate.com/ap-001?tag=aura", retailer: "Everlane", materials: ["merino wool"], keywords: ["crewneck","sweater","merino","minimal","layering","fall"], quality: { construction: 0.82, durability: 0.8, materialGrade: 0.85, rating: 4.5, reviewCount: 2100 } }),
  p({ id: "ap-002", title: "Recycled Cashmere Crew Sweater", brand: "Quince", category: "apparel", subcategory: "knitwear", price: 60, msrp: 60, image: IMG("ap-002"), url: "https://example-affiliate.com/ap-002?tag=aura", retailer: "Quince", materials: ["cashmere"], keywords: ["crewneck","sweater","cashmere","soft","minimal","layering"], quality: { construction: 0.78, durability: 0.72, materialGrade: 0.88, rating: 4.4, reviewCount: 5400 } }),
  p({ id: "ap-003", title: "Lambswool Crew Jumper", brand: "Uniqlo", category: "apparel", subcategory: "knitwear", price: 39, msrp: 49, image: IMG("ap-003"), url: "https://example-affiliate.com/ap-003?tag=aura", retailer: "Uniqlo", materials: ["lambswool"], keywords: ["crewneck","sweater","wool","budget","layering","basic"], quality: { construction: 0.7, durability: 0.68, materialGrade: 0.72, rating: 4.3, reviewCount: 8800 } }),
  p({ id: "ap-004", title: "Cashmere Crewneck Sweater", brand: "Naadam", category: "apparel", subcategory: "knitwear", price: 145, msrp: 165, image: IMG("ap-004"), url: "https://example-affiliate.com/ap-004?tag=aura", retailer: "Naadam", materials: ["cashmere"], keywords: ["crewneck","sweater","cashmere","luxury","soft"], quality: { construction: 0.86, durability: 0.8, materialGrade: 0.92, rating: 4.6, reviewCount: 1600 } }),
  p({ id: "ap-005", title: "Luxury Cashmere Crewneck", brand: "Loro Piana", category: "apparel", subcategory: "knitwear", price: 1050, msrp: 1050, image: IMG("ap-005"), url: "https://example-affiliate.com/ap-005?tag=aura", retailer: "Loro Piana", materials: ["cashmere"], keywords: ["crewneck","sweater","cashmere","luxury","designer"], quality: { construction: 0.96, durability: 0.9, materialGrade: 0.99, rating: 4.8, reviewCount: 240 } }),

  // ---------- APPAREL: tees ----------
  p({ id: "ap-010", title: "Heavyweight Cotton Boxy Tee", brand: "Everlane", category: "apparel", subcategory: "tops", price: 38, msrp: 38, image: IMG("ap-010"), url: "https://example-affiliate.com/ap-010?tag=aura", retailer: "Everlane", materials: ["organic cotton"], keywords: ["t-shirt","tee","heavyweight","boxy","cotton","basic"], quality: { construction: 0.8, durability: 0.82, materialGrade: 0.8, rating: 4.4, reviewCount: 3400 } }),
  p({ id: "ap-011", title: "Supima Cotton Crew Tee", brand: "Uniqlo", category: "apparel", subcategory: "tops", price: 15, msrp: 20, image: IMG("ap-011"), url: "https://example-affiliate.com/ap-011?tag=aura", retailer: "Uniqlo", materials: ["supima cotton"], keywords: ["t-shirt","tee","cotton","basic","budget","crew"], quality: { construction: 0.74, durability: 0.75, materialGrade: 0.78, rating: 4.5, reviewCount: 12000 } }),
  p({ id: "ap-012", title: "Premium Heavyweight Tee", brand: "Buck Mason", category: "apparel", subcategory: "tops", price: 42, msrp: 42, image: IMG("ap-012"), url: "https://example-affiliate.com/ap-012?tag=aura", retailer: "Buck Mason", materials: ["cotton"], keywords: ["t-shirt","tee","heavyweight","premium","curved hem"], quality: { construction: 0.83, durability: 0.84, materialGrade: 0.82, rating: 4.6, reviewCount: 2900 } }),

  // ---------- APPAREL: denim ----------
  p({ id: "ap-020", title: "Slim Fit Selvedge Jeans", brand: "Levi's", category: "apparel", subcategory: "denim", price: 98, msrp: 128, image: IMG("ap-020"), url: "https://example-affiliate.com/ap-020?tag=aura", retailer: "Levi's", materials: ["selvedge denim","cotton"], keywords: ["jeans","denim","slim","selvedge","raw"], quality: { construction: 0.85, durability: 0.9, materialGrade: 0.86, rating: 4.5, reviewCount: 4100 } }),
  p({ id: "ap-021", title: "Straight Leg Organic Jeans", brand: "Everlane", category: "apparel", subcategory: "denim", price: 88, msrp: 98, image: IMG("ap-021"), url: "https://example-affiliate.com/ap-021?tag=aura", retailer: "Everlane", materials: ["organic cotton"], keywords: ["jeans","denim","straight","organic"], quality: { construction: 0.8, durability: 0.83, materialGrade: 0.8, rating: 4.2, reviewCount: 1900 } }),
  p({ id: "ap-022", title: "Slim Tapered Stretch Jeans", brand: "Uniqlo", category: "apparel", subcategory: "denim", price: 50, msrp: 50, image: IMG("ap-022"), url: "https://example-affiliate.com/ap-022?tag=aura", retailer: "Uniqlo", materials: ["cotton","elastane"], keywords: ["jeans","denim","slim","tapered","stretch","budget"], quality: { construction: 0.72, durability: 0.74, materialGrade: 0.72, rating: 4.3, reviewCount: 6600 } }),

  // ---------- APPAREL: outerwear ----------
  p({ id: "ap-030", title: "Recycled Nylon Puffer Jacket", brand: "Patagonia", category: "apparel", subcategory: "outerwear", price: 229, msrp: 229, image: IMG("ap-030"), url: "https://example-affiliate.com/ap-030?tag=aura", retailer: "Patagonia", materials: ["recycled nylon","down"], keywords: ["puffer","jacket","down","warm","winter","outdoor"], quality: { construction: 0.9, durability: 0.92, materialGrade: 0.88, rating: 4.7, reviewCount: 3300 } }),
  p({ id: "ap-031", title: "Ultra Light Down Jacket", brand: "Uniqlo", category: "apparel", subcategory: "outerwear", price: 70, msrp: 90, image: IMG("ap-031"), url: "https://example-affiliate.com/ap-031?tag=aura", retailer: "Uniqlo", materials: ["nylon","down"], keywords: ["puffer","jacket","down","light","packable","winter"], quality: { construction: 0.76, durability: 0.75, materialGrade: 0.78, rating: 4.5, reviewCount: 15000 } }),
  p({ id: "ap-032", title: "Down Puffer Coat", brand: "Amazon Essentials", category: "apparel", subcategory: "outerwear", price: 55, msrp: 65, image: IMG("ap-032"), url: "https://example-affiliate.com/ap-032?tag=aura", retailer: "Amazon", materials: ["polyester","down alternative"], keywords: ["puffer","jacket","coat","warm","winter","budget"], quality: { construction: 0.62, durability: 0.6, materialGrade: 0.6, rating: 4.1, reviewCount: 9200 } }),

  // ---------- FOOTWEAR: sneakers ----------
  p({ id: "fw-001", title: "Leather Court Sneakers", brand: "Common Projects", category: "footwear", subcategory: "sneakers", price: 425, msrp: 425, image: IMG("fw-001"), url: "https://example-affiliate.com/fw-001?tag=aura", retailer: "SSENSE", materials: ["leather"], keywords: ["sneakers","leather","minimal","white","court","designer"], quality: { construction: 0.92, durability: 0.85, materialGrade: 0.93, rating: 4.6, reviewCount: 640 } }),
  p({ id: "fw-002", title: "Minimalist Leather Sneakers", brand: "Oliver Cabell", category: "footwear", subcategory: "sneakers", price: 198, msrp: 198, image: IMG("fw-002"), url: "https://example-affiliate.com/fw-002?tag=aura", retailer: "Oliver Cabell", materials: ["italian leather"], keywords: ["sneakers","leather","minimal","white","court"], quality: { construction: 0.88, durability: 0.83, materialGrade: 0.9, rating: 4.4, reviewCount: 2100 } }),
  p({ id: "fw-003", title: "Clean Leather Low Sneakers", brand: "GREATS", category: "footwear", subcategory: "sneakers", price: 159, msrp: 179, image: IMG("fw-003"), url: "https://example-affiliate.com/fw-003?tag=aura", retailer: "GREATS", materials: ["leather"], keywords: ["sneakers","leather","minimal","white","low"], quality: { construction: 0.83, durability: 0.8, materialGrade: 0.84, rating: 4.3, reviewCount: 3800 } }),
  p({ id: "fw-004", title: "Classic Leather Trainers", brand: "Cole Haan", category: "footwear", subcategory: "sneakers", price: 110, msrp: 150, image: IMG("fw-004"), url: "https://example-affiliate.com/fw-004?tag=aura", retailer: "Cole Haan", materials: ["leather"], keywords: ["sneakers","leather","white","trainers","classic"], quality: { construction: 0.79, durability: 0.78, materialGrade: 0.8, rating: 4.2, reviewCount: 5200 } }),
  p({ id: "fw-005", title: "Everyday Leather Sneakers", brand: "Nisolo", category: "footwear", subcategory: "sneakers", price: 138, msrp: 138, image: IMG("fw-005"), url: "https://example-affiliate.com/fw-005?tag=aura", retailer: "Nisolo", materials: ["leather"], keywords: ["sneakers","leather","white","ethical","everyday"], quality: { construction: 0.85, durability: 0.82, materialGrade: 0.86, rating: 4.5, reviewCount: 1700 } }),

  // ---------- FOOTWEAR: running ----------
  p({ id: "fw-010", title: "Wool Runner Shoes", brand: "Allbirds", category: "footwear", subcategory: "running", price: 110, msrp: 110, image: IMG("fw-010"), url: "https://example-affiliate.com/fw-010?tag=aura", retailer: "Allbirds", materials: ["merino wool"], keywords: ["shoes","running","wool","comfort","sustainable"], quality: { construction: 0.8, durability: 0.72, materialGrade: 0.82, rating: 4.2, reviewCount: 14000 } }),
  p({ id: "fw-011", title: "Knit Everyday Runners", brand: "Vessi", category: "footwear", subcategory: "running", price: 135, msrp: 145, image: IMG("fw-011"), url: "https://example-affiliate.com/fw-011?tag=aura", retailer: "Vessi", materials: ["knit","waterproof membrane"], keywords: ["shoes","running","knit","waterproof","comfort"], quality: { construction: 0.82, durability: 0.78, materialGrade: 0.8, rating: 4.3, reviewCount: 6100 } }),

  // ---------- FOOTWEAR: boots ----------
  p({ id: "fw-020", title: "Leather Chelsea Boots", brand: "Thursday Boot Co.", category: "footwear", subcategory: "boots", price: 200, msrp: 200, image: IMG("fw-020"), url: "https://example-affiliate.com/fw-020?tag=aura", retailer: "Thursday", materials: ["leather"], keywords: ["boots","chelsea","leather","goodyear","dress"], quality: { construction: 0.88, durability: 0.9, materialGrade: 0.87, rating: 4.6, reviewCount: 7200 } }),
  p({ id: "fw-021", title: "Suede Chelsea Boots", brand: "Blundstone", category: "footwear", subcategory: "boots", price: 220, msrp: 220, image: IMG("fw-021"), url: "https://example-affiliate.com/fw-021?tag=aura", retailer: "Blundstone", materials: ["suede"], keywords: ["boots","chelsea","suede","durable","classic"], quality: { construction: 0.9, durability: 0.93, materialGrade: 0.86, rating: 4.7, reviewCount: 9800 } }),

  // ---------- ACCESSORIES: bags ----------
  p({ id: "ac-001", title: "Full-Grain Leather Tote", brand: "Cuyana", category: "accessories", subcategory: "bags", price: 198, msrp: 198, image: IMG("ac-001"), url: "https://example-affiliate.com/ac-001?tag=aura", retailer: "Cuyana", materials: ["full-grain leather"], keywords: ["tote","bag","leather","structured","work","minimal"], quality: { construction: 0.88, durability: 0.87, materialGrade: 0.9, rating: 4.5, reviewCount: 2600 } }),
  p({ id: "ac-002", title: "Leather Work Tote", brand: "Madewell", category: "accessories", subcategory: "bags", price: 168, msrp: 188, image: IMG("ac-002"), url: "https://example-affiliate.com/ac-002?tag=aura", retailer: "Madewell", materials: ["leather"], keywords: ["tote","bag","leather","work","carryall"], quality: { construction: 0.82, durability: 0.82, materialGrade: 0.83, rating: 4.3, reviewCount: 4400 } }),
  p({ id: "ac-003", title: "Vegan Leather Tote", brand: "Quince", category: "accessories", subcategory: "bags", price: 80, msrp: 80, image: IMG("ac-003"), url: "https://example-affiliate.com/ac-003?tag=aura", retailer: "Quince", materials: ["vegan leather"], keywords: ["tote","bag","vegan","work","minimal","budget"], quality: { construction: 0.72, durability: 0.68, materialGrade: 0.7, rating: 4.1, reviewCount: 3100 } }),

  // ---------- ACCESSORIES: watches ----------
  p({ id: "ac-010", title: "Automatic Field Watch", brand: "Hamilton", category: "accessories", subcategory: "watches", price: 495, msrp: 545, image: IMG("ac-010"), url: "https://example-affiliate.com/ac-010?tag=aura", retailer: "Hamilton", materials: ["stainless steel","sapphire"], keywords: ["watch","automatic","field","mechanical","classic"], quality: { construction: 0.93, durability: 0.9, materialGrade: 0.92, rating: 4.7, reviewCount: 1200 } }),
  p({ id: "ac-011", title: "Mechanical Field Watch", brand: "Seiko", category: "accessories", subcategory: "watches", price: 195, msrp: 250, image: IMG("ac-011"), url: "https://example-affiliate.com/ac-011?tag=aura", retailer: "Seiko", materials: ["stainless steel","hardlex"], keywords: ["watch","automatic","field","mechanical","value"], quality: { construction: 0.86, durability: 0.88, materialGrade: 0.84, rating: 4.6, reviewCount: 5600 } }),
  p({ id: "ac-012", title: "Automatic Field Watch 38mm", brand: "Timex", category: "accessories", subcategory: "watches", price: 109, msrp: 139, image: IMG("ac-012"), url: "https://example-affiliate.com/ac-012?tag=aura", retailer: "Timex", materials: ["stainless steel","mineral glass"], keywords: ["watch","automatic","field","affordable","classic"], quality: { construction: 0.74, durability: 0.76, materialGrade: 0.72, rating: 4.3, reviewCount: 3400 } }),

  // ---------- ACCESSORIES: sunglasses ----------
  p({ id: "ac-020", title: "Acetate Wayfarer Sunglasses", brand: "Ray-Ban", category: "accessories", subcategory: "sunglasses", price: 171, msrp: 171, image: IMG("ac-020"), url: "https://example-affiliate.com/ac-020?tag=aura", retailer: "Ray-Ban", materials: ["acetate","glass lens"], keywords: ["sunglasses","wayfarer","acetate","classic","uv"], quality: { construction: 0.86, durability: 0.82, materialGrade: 0.88, rating: 4.6, reviewCount: 20000 } }),
  p({ id: "ac-021", title: "Handmade Acetate Sunglasses", brand: "Warby Parker", category: "accessories", subcategory: "sunglasses", price: 95, msrp: 95, image: IMG("ac-021"), url: "https://example-affiliate.com/ac-021?tag=aura", retailer: "Warby Parker", materials: ["acetate","polycarbonate lens"], keywords: ["sunglasses","wayfarer","acetate","classic","uv","value"], quality: { construction: 0.8, durability: 0.78, materialGrade: 0.8, rating: 4.4, reviewCount: 7800 } }),

  // ---------- ELECTRONICS: headphones ----------
  p({ id: "el-001", title: "Wireless Noise Cancelling Headphones", brand: "Sony", category: "electronics", subcategory: "headphones", price: 348, msrp: 399, image: IMG("el-001"), url: "https://example-affiliate.com/el-001?tag=aura", retailer: "Amazon", materials: ["plastic","synthetic leather"], keywords: ["headphones","wireless","noise cancelling","anc","over-ear","bluetooth"], quality: { construction: 0.88, durability: 0.85, materialGrade: 0.86, rating: 4.7, reviewCount: 42000 } }),
  p({ id: "el-002", title: "Over-Ear ANC Headphones", brand: "Anker Soundcore", category: "electronics", subcategory: "headphones", price: 99, msrp: 130, image: IMG("el-002"), url: "https://example-affiliate.com/el-002?tag=aura", retailer: "Amazon", materials: ["plastic","memory foam"], keywords: ["headphones","wireless","noise cancelling","anc","over-ear","bluetooth","value"], quality: { construction: 0.76, durability: 0.74, materialGrade: 0.72, rating: 4.4, reviewCount: 31000 } }),
  p({ id: "el-003", title: "Premium ANC Headphones", brand: "Bose", category: "electronics", subcategory: "headphones", price: 379, msrp: 429, image: IMG("el-003"), url: "https://example-affiliate.com/el-003?tag=aura", retailer: "Amazon", materials: ["plastic","protein leather"], keywords: ["headphones","wireless","noise cancelling","anc","over-ear","bluetooth","premium"], quality: { construction: 0.9, durability: 0.86, materialGrade: 0.88, rating: 4.6, reviewCount: 18000 } }),

  // ---------- ELECTRONICS: earbuds ----------
  p({ id: "el-010", title: "Wireless ANC Earbuds", brand: "Apple", category: "electronics", subcategory: "earbuds", price: 249, msrp: 249, image: IMG("el-010"), url: "https://example-affiliate.com/el-010?tag=aura", retailer: "Apple", materials: ["plastic"], keywords: ["earbuds","wireless","noise cancelling","anc","bluetooth","in-ear"], quality: { construction: 0.88, durability: 0.8, materialGrade: 0.84, rating: 4.7, reviewCount: 55000 } }),
  p({ id: "el-011", title: "Noise Cancelling Earbuds", brand: "Nothing", category: "electronics", subcategory: "earbuds", price: 149, msrp: 149, image: IMG("el-011"), url: "https://example-affiliate.com/el-011?tag=aura", retailer: "Amazon", materials: ["plastic"], keywords: ["earbuds","wireless","noise cancelling","anc","bluetooth","in-ear","value"], quality: { construction: 0.8, durability: 0.76, materialGrade: 0.78, rating: 4.4, reviewCount: 12000 } }),
  p({ id: "el-012", title: "Budget ANC Earbuds", brand: "Anker Soundcore", category: "electronics", subcategory: "earbuds", price: 79, msrp: 100, image: IMG("el-012"), url: "https://example-affiliate.com/el-012?tag=aura", retailer: "Amazon", materials: ["plastic"], keywords: ["earbuds","wireless","noise cancelling","anc","bluetooth","in-ear","budget"], quality: { construction: 0.72, durability: 0.7, materialGrade: 0.68, rating: 4.3, reviewCount: 28000 } }),

  // ---------- HOME: bedding ----------
  p({ id: "hm-001", title: "Percale Cotton Sheet Set", brand: "Brooklinen", category: "home", subcategory: "bedding", price: 149, msrp: 179, image: IMG("hm-001"), url: "https://example-affiliate.com/hm-001?tag=aura", retailer: "Brooklinen", materials: ["long-staple cotton"], keywords: ["sheets","bedding","percale","cotton","crisp","queen"], quality: { construction: 0.84, durability: 0.82, materialGrade: 0.86, rating: 4.5, reviewCount: 16000 } }),
  p({ id: "hm-002", title: "Percale Sheet Set", brand: "Quince", category: "home", subcategory: "bedding", price: 90, msrp: 90, image: IMG("hm-002"), url: "https://example-affiliate.com/hm-002?tag=aura", retailer: "Quince", materials: ["long-staple cotton"], keywords: ["sheets","bedding","percale","cotton","crisp","value"], quality: { construction: 0.8, durability: 0.79, materialGrade: 0.85, rating: 4.4, reviewCount: 9400 } }),
  p({ id: "hm-003", title: "Organic Percale Sheets", brand: "Target Casaluna", category: "home", subcategory: "bedding", price: 60, msrp: 70, image: IMG("hm-003"), url: "https://example-affiliate.com/hm-003?tag=aura", retailer: "Target", materials: ["organic cotton"], keywords: ["sheets","bedding","percale","cotton","organic","budget"], quality: { construction: 0.72, durability: 0.72, materialGrade: 0.76, rating: 4.3, reviewCount: 6800 } }),
];

// Guard: ids must be unique.
const ids = new Set();
for (const item of catalog) {
  if (ids.has(item.id)) throw new Error(`duplicate id: ${item.id}`);
  ids.add(item.id);
}

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  count: catalog.length,
  products: catalog,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log(`Wrote ${catalog.length} products -> ${OUT}`);
