import { describe, expect, it } from "vitest";
import { cartPermalinkCheck } from "../src/cart-permalink.js";
import { runCheck } from "../src/index.js";
import { ctxFor } from "./helpers/mock-fetch.js";

describe("cart-permalink check", () => {
  it("scores 100 when both /cart and /cart/{id}:1 return 200", async () => {
    const r = await runCheck(
      cartPermalinkCheck,
      ctxFor({
        "/cart": { body: "cart", status: 200 },
        "/cart/000:1": { body: "cart", status: 200 },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("scores 50 when only /cart works", async () => {
    const r = await runCheck(
      cartPermalinkCheck,
      ctxFor({
        "/cart": { body: "cart", status: 200 },
      }),
    );
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
    expect(r.fixHint).toMatch(/permalink/);
  });

  it("scores 0 when neither endpoint responds", async () => {
    const r = await runCheck(cartPermalinkCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });
});
