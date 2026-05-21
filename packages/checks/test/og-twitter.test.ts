import { describe, expect, it } from "vitest";
import { ogTwitterCheck } from "../src/og-twitter.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

const sitemap = () => fixture("product-jsonld", "sitemap.xml");

describe("og-twitter check", () => {
  it("scores 100 when full OG + Twitter cards are present", async () => {
    const r = await runCheck(
      ogTwitterCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-pass.html"),
      }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("scores partial when only one og tag is present", async () => {
    const r = await runCheck(
      ogTwitterCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-partial.html"),
      }),
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(60);
  });

  it("scores 0 when PDP has no social meta", async () => {
    const r = await runCheck(
      ogTwitterCheck,
      ctxFor({
        "/sitemap.xml": sitemap(),
        "/products/blue-shirt": fixture("product-jsonld", "pdp-no-jsonld.html"),
      }),
    );
    expect(r.score).toBe(0);
  });
});
