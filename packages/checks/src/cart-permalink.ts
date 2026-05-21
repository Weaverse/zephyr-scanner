import type { Check } from "./types.js";

export const cartPermalinkCheck: Check = {
  id: "cart-permalink",
  name: "Cart permalink format works",
  category: "checkout",
  severity: "important",
  async run({ origin, fetch }) {
    const cartUrl = new URL("/cart", origin).toString();
    const permalinkUrl = new URL("/cart/000:1", origin).toString();

    const [cartRes, permaRes] = await Promise.all([
      fetch(cartUrl, { redirect: "follow" }).catch(() => null),
      fetch(permalinkUrl, { redirect: "follow" }).catch(() => null),
    ]);

    const cartOk = !!cartRes && cartRes.status >= 200 && cartRes.status < 400;
    const permaOk = !!permaRes && permaRes.status >= 200 && permaRes.status < 400;

    let score = 0;
    if (cartOk) score += 50;
    if (permaOk) score += 50;

    return {
      passed: score >= 60,
      score,
      detail: `GET /cart → ${cartRes?.status ?? "error"}. GET /cart/000:1 → ${permaRes?.status ?? "error"}.`,
      evidence: {
        cartStatus: cartRes?.status ?? null,
        permalinkStatus: permaRes?.status ?? null,
      },
      fixHint:
        !cartOk
          ? "Publish a /cart route that returns 200. Shopify/Hydrogen does this by default."
          : !permaOk
            ? "Support Shopify-style cart permalinks (/cart/{variantId}:{qty}) so agents can hand off pre-built carts."
            : undefined,
    };
  },
};
