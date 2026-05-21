# ACP — Protocol Brief

> **Status:** 🟡 v0.1 draft — spec is grounded in the official OpenAPI, but no
> *publicly* discoverable merchant has been verified yet.
> **Confidence:** medium. Required headers and the date-versioned API path
> are confirmed from `spec/2026-04-17/openapi/openapi.agentic_checkout.yaml`;
> the open question is which merchants actually expose `/checkout_sessions`
> on their public origin vs. routing the agentic API through Stripe.

## What is it?

The Agentic Commerce Protocol (ACP) is an open standard for programmatic
checkout flows between buyers, AI agents (e.g. ChatGPT), and merchants.
Stripe + OpenAI co-lead it; the canonical spec is published under date-tagged
directories at `spec/{YYYY-MM-DD}/`. Latest stable: `2026-04-17`.

## What does Zephyr check?

A merchant passes the surface-level ACP probe when:

- A `GET /checkout_sessions` (the canonical ACP entry point) terminates at a
  reachable route — accepting 2xx, 401, 403, or 405 as "wired" (the merchant
  exposes the endpoint, agents just need to authenticate). Anything that ends
  in 404 / 410 means the route is absent.
- The response carries an `API-Version` header in `YYYY-MM-DD` shape
  (the openapi makes this header `required: true` on every endpoint).
- Optional bonus signal: `<link rel="agent-checkout" href="…">` in the
  homepage `<head>` (informal convention adopted in early non-Stripe impls).

We **follow redirects** before evaluating the terminal status — a Shopify
canonical-host 301 (`example.com` → `www.example.com`) returns 404 at the
destination for most non-ACP stores, and that should score 0, not be
mistaken for "route exists".

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | Terminal status reachable (2xx / 401 / 403 / 405) + valid `API-Version` header + link tag |
| 80  | Terminal status reachable + valid `API-Version` header |
| 50  | Terminal status reachable but no version header |
| 0   | Terminal 404 / 410 / network error |

## Implementation notes

- Use `GET`, not `POST` — `POST` without a payload triggers 400 noise.
- Match the version header against `/^\d{4}-\d{2}-\d{2}$/`.
- Don't make authenticated calls — this is a public-surface signal probe.

## Known caveats

- Many merchants integrate ACP via Stripe's hosted agentic stack and do
  **not** expose `/checkout_sessions` on their brand origin. Those stores
  pass agentic checkout in ChatGPT but score 0 on this check. A future
  revision could probe Stripe's API surface (`api.stripe.com`) or accept
  alternative signals like a `<link rel="alternate" type="application/acp+json">`.
- Spot-checked merchants (allbirds, glossier, skims, etsy) all 404 on
  `/checkout_sessions` after the canonical-host redirect — confirming that
  this signal is a real, non-trivial differentiator.

## References

- Repo: <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol>
- OpenAPI: <https://github.com/agentic-commerce-protocol/agentic-commerce-protocol/blob/main/spec/2026-04-17/openapi/openapi.agentic_checkout.yaml>
- Stripe integration docs: <https://docs.stripe.com/agentic-commerce>
- Site: <https://agenticcommerce.dev>
