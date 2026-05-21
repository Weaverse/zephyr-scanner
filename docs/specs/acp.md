# ACP — Protocol Brief

> **Status:** 🟢 v0 draft — populated from the ACP repo's OpenAPI specs
> (spec/2026-04-17). Needs Roxie review.
> **Confidence:** medium. ACP is Stripe + OpenAI co-led; latest stable date-tag is
> 2026-04-17. Public-store-side "compliance markers" aren't yet codified — the spec is
> primarily a merchant-implemented REST API consumed by agents.

## What is it?

The Agentic Commerce Protocol (ACP) is an open standard for programmatic checkout flows
between buyers, AI agents, and businesses. It defines a merchant-implemented REST API that
ChatGPT and similar agents call to create / update / complete checkout sessions. License:
Apache 2.0, maintained at github.com/agentic-commerce-protocol.

## What does Zephyr check?

A store passes the surface-level ACP check by **advertising** that it supports the protocol.
Two markers we probe:

- **HTTP header probe** — send `GET /checkout_sessions` (the canonical ACP entry point) and
  inspect:
  - Response includes an `API-Version` header (date-shaped, e.g. `2026-04-17`)
  - OR a `401` / `403` response with `WWW-Authenticate: Bearer` (route exists, requires auth)
- **Discovery hint** — `<link rel="agent-checkout" href="…">` in homepage `<head>`
  (informal convention emerging in early implementations).

We do **not** make authenticated calls — this is a surface-level check.

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | `/checkout_sessions` exists (200/401/403) AND `API-Version` header AND link tag |
| 80  | Endpoint exists (any 2xx/4xx that isn't 404/410) AND `API-Version` header |
| 50  | Endpoint exists but no version header |
| 0   | Endpoint returns 404/410/5xx |

## Implementation notes

- Use `GET` not `POST` — POST without payload triggers 400 noise.
- Treat 401/403/405 as "route exists" (positive signal); only 404/410 means absent.
- `API-Version` header is the strongest single signal; match against `^\d{4}-\d{2}-\d{2}$`.

## References

- Repo: https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
- OpenAPI: `spec/2026-04-17/openapi/openapi.agentic_checkout.yaml`
- Stripe integration: https://docs.stripe.com/agentic-commerce
- Site: https://agenticcommerce.dev
