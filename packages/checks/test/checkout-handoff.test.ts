import { describe, expect, it } from "vitest";
import { checkoutHandoffCheck } from "../src/checkout-handoff.js";
import { runCheck } from "../src/index.js";
import { ctxFor } from "./helpers/mock-fetch.js";

describe("checkout-handoff check", () => {
  it("scores 100 on a direct 200", async () => {
    const r = await runCheck(
      checkoutHandoffCheck,
      ctxFor({ "/checkout": { body: "checkout", status: 200 } }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("scores 80 on a 302 redirect (route exists, requires session)", async () => {
    const r = await runCheck(
      checkoutHandoffCheck,
      ctxFor({
        "/checkout": {
          body: "redirect",
          status: 302,
          headers: { location: "/cart" },
        },
      }),
    );
    expect(r.score).toBe(80);
    expect(r.passed).toBe(true);
    expect(r.evidence).toMatchObject({ location: "/cart" });
  });

  it("scores 0 on 404", async () => {
    const r = await runCheck(checkoutHandoffCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });
});
