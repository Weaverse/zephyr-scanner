import type { Check } from "./types.js";
import { fetchPdp } from "./util/pdp.js";
import { findProduct } from "./util/jsonld.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectOffers(product: any): any[] {
  const offers = product?.offers;
  if (!offers) return [];
  if (Array.isArray(offers)) return offers;
  if (offers["@type"] === "AggregateOffer" && Array.isArray(offers.offers)) {
    return offers.offers;
  }
  return [offers];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasPrice(offer: any): boolean {
  return offer?.price != null || offer?.priceSpecification?.price != null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasAvailability(offer: any): boolean {
  return typeof offer?.availability === "string" && offer.availability.length > 0;
}

export const productVariantsCheck: Check = {
  id: "product-variants",
  name: "Variant, pricing and availability clarity in Product JSON-LD",
  category: "product-data",
  severity: "important",
  async run(ctx) {
    const pdp = await fetchPdp(ctx);
    if (!pdp) {
      return {
        passed: false,
        score: 0,
        detail: "Couldn't sample a product page to inspect variants.",
        fixHint:
          "Ensure your sitemap exposes product URLs and that each product page renders Product JSON-LD with offers.",
      };
    }

    const product = findProduct(pdp.html);
    if (!product) {
      return {
        passed: false,
        score: 0,
        detail: "No Product JSON-LD block found — pricing and availability are invisible to agents.",
        evidence: { sampledPdp: pdp.url },
        fixHint:
          "Add a Product JSON-LD block first (see the product-jsonld check). Then ensure offers.price and offers.availability are populated.",
      };
    }

    const offers = collectOffers(product);
    if (offers.length === 0) {
      return {
        passed: false,
        score: 20,
        detail: "Product JSON-LD present but no offers field.",
        evidence: { sampledPdp: pdp.url, offerCount: 0 },
        fixHint:
          "Add an `offers` field containing at least one Offer with `price`, `priceCurrency`, and `availability` (e.g. https://schema.org/InStock).",
      };
    }

    const offersWithPrice = offers.filter(hasPrice).length;
    const offersWithAvailability = offers.filter(hasAvailability).length;
    const allPriced = offersWithPrice === offers.length;
    const allAvailability = offersWithAvailability === offers.length;
    const hasVariants = offers.length > 1;

    let score = 50;
    if (allPriced) score += 20;
    if (allAvailability) score += 20;
    if (hasVariants) score += 10;
    score = Math.min(score, 100);

    const missing: string[] = [];
    if (!allPriced) missing.push("offers missing price");
    if (!allAvailability) missing.push("offers missing availability");

    return {
      passed: score >= 60,
      score,
      detail: `Found ${offers.length} offer(s). Priced: ${offersWithPrice}/${offers.length}. Availability: ${offersWithAvailability}/${offers.length}.${hasVariants ? " Variants detected." : ""}`,
      evidence: {
        sampledPdp: pdp.url,
        offerCount: offers.length,
        offersWithPrice,
        offersWithAvailability,
        hasVariants,
      },
      fixHint:
        missing.length > 0
          ? `Populate the missing fields: ${missing.join(", ")}. Agents skip products without explicit pricing and availability.`
          : undefined,
    };
  },
};
