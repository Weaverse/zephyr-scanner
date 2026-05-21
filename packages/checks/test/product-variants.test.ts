import { describe, expect, it } from "vitest";
import { productVariantsCheck } from "../src/product-variants.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

const sitemap = () => fixture("product-jsonld", "sitemap.xml");

describe("product-variants check", () => {
  it("scores 100 when offers carry price + availability across variants", async () => {
    const r = await runCheck(
      productVariantsCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-pass.html"),
      }),
    );
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({ hasVariants: true });
  });

  it("scores lower when offer is missing availability", async () => {
    const r = await runCheck(
      productVariantsCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-partial.html"),
      }),
    );
    expect(r.score).toBeLessThan(100);
    expect(r.evidence).toMatchObject({ offersWithAvailability: 0 });
  });

  it("scores 0 when there's no Product JSON-LD", async () => {
    const r = await runCheck(
      productVariantsCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-no-jsonld.html"),
      }),
    );
    expect(r.score).toBe(0);
  });
});
