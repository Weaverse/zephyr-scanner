import type { Check } from "./types.js";
import { fetchPdp } from "./util/pdp.js";
import { extractJsonLd, findProduct } from "./util/jsonld.js";

export const productJsonLdCheck: Check = {
  id: "product-jsonld",
  name: "schema.org Product JSON-LD on PDP",
  category: "product-data",
  severity: "critical",
  async run(ctx) {
    const pdp = await fetchPdp(ctx);
    if (!pdp) {
      return {
        passed: false,
        score: 0,
        detail: "Couldn't sample a product page from /sitemap.xml.",
        fixHint:
          "Publish a sitemap that lists product URLs (Shopify/Hydrogen generates this automatically at /sitemap.xml).",
      };
    }

    const blocks = extractJsonLd(pdp.html);
    if (blocks.length === 0) {
      return {
        passed: false,
        score: 0,
        detail: `No JSON-LD blocks on ${pdp.url}.`,
        evidence: { sampledPdp: pdp.url, jsonLdBlocks: 0 },
        fixHint:
          "Add a <script type=\"application/ld+json\"> Product block to your product template — required for agents to parse pricing and availability.",
      };
    }

    const product = findProduct(pdp.html);
    if (!product) {
      return {
        passed: false,
        score: 50,
        detail: `JSON-LD present on ${pdp.url} but no @type:Product node found.`,
        evidence: { sampledPdp: pdp.url, jsonLdBlocks: blocks.length },
        fixHint:
          "Your JSON-LD doesn't include a Product node. Add one with name, image, description, and offers fields.",
      };
    }

    const hasName = typeof product.name === "string" && product.name.length > 0;
    const hasImage = Boolean(product.image);
    const hasDescription =
      typeof product.description === "string" && product.description.length > 0;
    const hasOffers = Boolean(product.offers);

    const fields = [hasName, hasImage, hasDescription, hasOffers].filter(Boolean).length;
    const score = 60 + fields * 10; // 60 for any product node, +10 per required field
    return {
      passed: score >= 60,
      score: Math.min(score, 100),
      detail: `Product JSON-LD found on ${pdp.url}. Fields present: ${fields}/4 (name, image, description, offers).`,
      evidence: {
        sampledPdp: pdp.url,
        jsonLdBlocks: blocks.length,
        productNode: {
          hasName,
          hasImage,
          hasDescription,
          hasOffers,
        },
      },
      fixHint:
        fields < 4
          ? "Add the missing fields (name, image, description, offers) to your Product JSON-LD."
          : undefined,
    };
  },
};
