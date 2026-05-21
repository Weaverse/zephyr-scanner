import { describe, expect, it } from "vitest";
import { productJsonLdCheck } from "../src/product-jsonld.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

const sitemap = () => fixture("product-jsonld", "sitemap.xml");
const sitemapIndex = () => fixture("product-jsonld", "sitemap-index.xml");

describe("product-jsonld check", () => {
  it("scores 100 when full Product JSON-LD is present", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-pass.html"),
      }),
    );
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({
      sampledPdp: "https://example.com/products/blue-shirt",
    });
  });

  it("scores partial when Product node is present but fields are missing", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-partial.html"),
      }),
    );
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.score).toBeLessThan(100);
  });

  it("scores 50 when JSON-LD exists but no Product node", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-no-product.html"),
      }),
    );
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
  });

  it("scores 0 when no JSON-LD on the PDP", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-no-jsonld.html"),
      }),
    );
    expect(r.score).toBe(0);
  });

  it("scores 0 when no sitemap is published", async () => {
    const r = await runCheck(productJsonLdCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });

  it("recognises Schema.org ProductGroup (used by Shopify for variant families)", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-product-group.html"),
      }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("follows a sitemap index to find product URLs", async () => {
    const r = await runCheck(
      productJsonLdCheck,
      ctxFor({
        "/sitemap.xml": sitemapIndex(),
        "https://example.com/sitemap_products_1.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-pass.html"),
      }),
    );
    expect(r.passed).toBe(true);
  });
});
