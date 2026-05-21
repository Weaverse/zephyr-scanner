import type { Check } from "./types.js";

export const checkoutHandoffCheck: Check = {
  id: "checkout-handoff",
  name: "Checkout handoff URL accessible",
  category: "checkout",
  severity: "important",
  async run({ origin, fetch }) {
    const url = new URL("/checkout", origin).toString();
    const res = await fetch(url, { redirect: "manual" }).catch(() => null);
    if (!res) {
      return {
        passed: false,
        score: 0,
        detail: "Fetching /checkout threw an error.",
        fixHint: "Publish a /checkout route reachable over HTTPS.",
      };
    }

    const status = res.status;
    const location = res.headers.get("location") ?? undefined;

    // 200 → checkout page renders directly. 30x → redirect, usually to login or cart.
    // Both are acceptable: the route exists. 404/410/5xx → fail.
    if (status >= 200 && status < 400) {
      return {
        passed: true,
        score: status === 200 ? 100 : 80,
        detail: `GET /checkout → ${status}${location ? ` (redirects to ${location})` : ""}.`,
        evidence: { status, location },
      };
    }

    return {
      passed: false,
      score: 0,
      detail: `GET /checkout → ${status}. No handoff route detected.`,
      evidence: { status },
      fixHint:
        "Expose a stable /checkout URL so agents can hand off a session — Shopify provides this out of the box; custom storefronts must wire it explicitly.",
    };
  },
};
