import { describe, expect, it } from "vitest";
import { hreflangCheck } from "../src/hreflang.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("hreflang check", () => {
  it("scores 100 with multiple locales + x-default", async () => {
    const r = await runCheck(
      hreflangCheck,
      ctxFor({ "/": fixture("hreflang", "home-pass.html") }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
    expect(r.evidence).toMatchObject({ hasXDefault: true });
  });

  it("scores 50 with a single hreflang tag", async () => {
    const r = await runCheck(
      hreflangCheck,
      ctxFor({ "/": fixture("hreflang", "home-partial.html") }),
    );
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
  });

  it("scores 0 when no hreflang tags", async () => {
    const r = await runCheck(
      hreflangCheck,
      ctxFor({ "/": fixture("hreflang", "home-fail.html") }),
    );
    expect(r.score).toBe(0);
  });

  it("scores 0 when homepage is 404", async () => {
    const r = await runCheck(hreflangCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });
});
