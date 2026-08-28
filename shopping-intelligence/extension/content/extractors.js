/**
 * extractors.js — turns whatever page you're on into a normalized product.
 *
 * Strategy (most general first, so this works on *most* stores, not one):
 *   1. schema.org Product JSON-LD  — the richest, most portable source
 *   2. OpenGraph / product meta tags
 *   3. microdata (itemprop)
 *   4. site-specific extractors (Amazon, etc.) as reliable fallbacks
 *
 * Loaded as a classic content script; exposes window.AuraExtractors.
 */
(function () {
  "use strict";

  const clean = (s) => (s == null ? "" : String(s).replace(/\s+/g, " ").trim());

  function parsePrice(raw) {
    if (raw == null) return null;
    if (typeof raw === "number") return raw;
    const m = String(raw).replace(/[, ]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
    return m ? parseFloat(m[1]) : null;
  }

  function absUrl(u) {
    try {
      return new URL(u, location.href).href;
    } catch {
      return u || "";
    }
  }

  // ---- 1. JSON-LD -----------------------------------------------------------
  function fromJsonLd() {
    const blocks = document.querySelectorAll('script[type="application/ld+json"]');
    for (const b of blocks) {
      let data;
      try {
        data = JSON.parse(b.textContent);
      } catch {
        continue;
      }
      const nodes = Array.isArray(data) ? data : data["@graph"] || [data];
      for (const node of nodes) {
        const type = node && node["@type"];
        const isProduct = Array.isArray(type)
          ? type.includes("Product")
          : type === "Product";
        if (!isProduct) continue;

        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers || {};
        const brand =
          typeof node.brand === "object" ? node.brand?.name : node.brand;
        const image = Array.isArray(node.image) ? node.image[0] : node.image;
        return {
          title: clean(node.name),
          brand: clean(brand),
          price: parsePrice(offers.price ?? offers.lowPrice),
          currency: clean(offers.priceCurrency) || "USD",
          image: image ? absUrl(image) : "",
          url: clean(node.url) ? absUrl(node.url) : location.href,
          category: "",
          source: "jsonld",
        };
      }
    }
    return null;
  }

  // ---- 2. OpenGraph / meta --------------------------------------------------
  function metaContent(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.content) return el.content;
    }
    return "";
  }

  function fromMeta() {
    const type = metaContent(['meta[property="og:type"]']);
    const title = metaContent([
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ]);
    const price = metaContent([
      'meta[property="product:price:amount"]',
      'meta[property="og:price:amount"]',
      'meta[name="twitter:data1"]',
    ]);
    // Only trust this as a product if it declares product-ness or carries a price.
    if (!/product/i.test(type) && !price) return null;
    if (!title) return null;
    return {
      title: clean(title),
      brand: clean(
        metaContent(['meta[property="product:brand"]', 'meta[property="og:brand"]'])
      ),
      price: parsePrice(price),
      currency:
        clean(metaContent(['meta[property="product:price:currency"]'])) || "USD",
      image: absUrl(
        metaContent(['meta[property="og:image"]', 'meta[name="twitter:image"]'])
      ),
      url: location.href,
      category: "",
      source: "meta",
    };
  }

  // ---- 3. Microdata ---------------------------------------------------------
  function fromMicrodata() {
    const scope = document.querySelector('[itemtype*="schema.org/Product"]');
    if (!scope) return null;
    const prop = (name) => {
      const el = scope.querySelector(`[itemprop="${name}"]`);
      if (!el) return "";
      return el.getAttribute("content") || el.getAttribute("src") || el.textContent;
    };
    const title = prop("name");
    if (!title) return null;
    return {
      title: clean(title),
      brand: clean(prop("brand")),
      price: parsePrice(prop("price")),
      currency: clean(prop("priceCurrency")) || "USD",
      image: absUrl(prop("image")),
      url: location.href,
      category: "",
      source: "microdata",
    };
  }

  // ---- 4. Site-specific fallbacks ------------------------------------------
  function fromAmazon() {
    if (!/amazon\./.test(location.hostname)) return null;
    const title = document.querySelector("#productTitle")?.textContent;
    if (!title) return null;
    const priceWhole = document.querySelector(
      ".a-price .a-price-whole, #corePrice_feature_div .a-offscreen, .a-price .a-offscreen"
    )?.textContent;
    const brand =
      document.querySelector("#bylineInfo")?.textContent?.replace(/^Visit the |^Brand: | Store$/g, "") || "";
    const image =
      document.querySelector("#landingImage")?.getAttribute("src") ||
      document.querySelector("#imgTagWrapperId img")?.getAttribute("src") ||
      "";
    return {
      title: clean(title),
      brand: clean(brand),
      price: parsePrice(priceWhole),
      currency: "USD",
      image: absUrl(image),
      url: location.href,
      category: "",
      source: "amazon",
    };
  }

  /**
   * Infer a coarse category from the title/keywords so the matcher's structural
   * scorer has something to work with even when the store doesn't declare one.
   */
  const CATEGORY_HINTS = [
    ["footwear", /\b(sneaker|shoe|boot|trainer|loafer|runner|heel|sandal)s?\b/i],
    ["apparel", /\b(sweater|jumper|tee|t-shirt|shirt|jeans|denim|jacket|coat|hoodie|dress|pants|trouser|knit)s?\b/i],
    ["electronics", /\b(headphone|earbud|earphone|speaker|laptop|monitor|charger|watch smart|airpods)s?\b/i],
    ["accessories", /\b(bag|tote|backpack|wallet|watch|sunglasses|belt|scarf|hat)s?\b/i],
    ["home", /\b(sheet|bedding|duvet|towel|pillow|blanket|mug|cookware)s?\b/i],
  ];
  const SUBCATEGORY_HINTS = [
    ["knitwear", /\b(sweater|jumper|cardigan|knit)s?\b/i],
    ["denim", /\b(jeans|denim)\b/i],
    ["sneakers", /\b(sneaker|trainer|court)s?\b/i],
    ["boots", /\bboots?\b/i],
    ["running", /\b(runner|running)\b/i],
    ["headphones", /\b(headphone|over-ear)s?\b/i],
    ["earbuds", /\b(earbud|earphone|in-ear|airpods)s?\b/i],
    ["watches", /\bwatch(es)?\b/i],
    ["bags", /\b(bag|tote|backpack)s?\b/i],
    ["sunglasses", /\bsunglasses\b/i],
    ["bedding", /\b(sheet|bedding|duvet)s?\b/i],
    ["tops", /\b(tee|t-shirt)s?\b/i],
    ["outerwear", /\b(jacket|coat|puffer|parka)s?\b/i],
  ];

  function inferTaxonomy(product) {
    const hay = `${product.title} ${product.brand}`;
    if (!product.category) {
      for (const [cat, re] of CATEGORY_HINTS) if (re.test(hay)) { product.category = cat; break; }
    }
    if (!product.subcategory) {
      for (const [sub, re] of SUBCATEGORY_HINTS) if (re.test(hay)) { product.subcategory = sub; break; }
    }
    return product;
  }

  /** Run all strategies; return the first solid hit (or null). */
  function detect() {
    const strategies = [fromAmazon, fromJsonLd, fromMicrodata, fromMeta];
    for (const strat of strategies) {
      let result = null;
      try {
        result = strat();
      } catch (e) {
        /* keep trying */
      }
      if (result && result.title) {
        result.keywords = result.keywords || [];
        result.materials = result.materials || [];
        return inferTaxonomy(result);
      }
    }
    return null;
  }

  window.AuraExtractors = { detect };
})();
