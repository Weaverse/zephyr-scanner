# UCP — Protocol Brief

> **Status:** 🟢 v0 draft — populated from public research 2026-05-21. Needs Roxie review.
> **Confidence:** medium. UCP's canonical site (ucp.dev) was unreachable during research;
> shape inferred from a third-party Shopify-UCP implementation
> (github.com/tahmidbintaslim/shopify-ucp) and Shopify agent docs that describe
> "Profiles hosted at a well-known URL." Update once Shopify publishes the canonical spec.

## What is it?

The Universal Commerce Protocol (UCP) is an emerging open standard that lets AI agents
discover and transact with online stores via a single declarative profile. Backed by Shopify
in its agentic-commerce initiative (`shopify.dev/docs/agents`), it advertises which MCP
servers, tools, and checkout endpoints a store exposes — so an agent can complete a purchase
without bespoke per-store integration.

## What does Zephyr check?

- **Discovery:** A `<link rel="agent-profile" href="…">` tag in the store homepage `<head>`,
  pointing at the JSON profile. As a fallback we probe `/.well-known/ucp` directly (the
  conventional path used by current third-party implementations).
- **Required headers:** Response `Content-Type: application/json`.
- **Valid response shape:**
  ```json
  {
    "ucp_version": "1.0",
    "store": { "name": "scoutshop", "domain": "scoutshop.com" },
    "capabilities": [
      {
        "type": "discovery",
        "description": "Search and browse products",
        "mcp_endpoint": "https://example.com/api/mcp/scoutshop"
      }
    ],
    "tools": [ /* JSON Schema-shaped tool descriptions */ ]
  }
  ```

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | `<link rel="agent-profile">` found AND profile fetched AND valid `ucp_version` + at least one capability with an `mcp_endpoint` |
| 80  | Profile reachable at `/.well-known/ucp` (no `<link>` tag) AND valid shape |
| 50  | Profile reachable but `ucp_version` missing OR no capabilities |
| 0   | Neither the link tag nor the well-known endpoint resolves |

## Implementation notes

- Fetch the homepage once and reuse the HTML for the `<link rel="agent-profile">` lookup
  (re-uses the `og-twitter` / `hreflang` HTML).
- Honor relative `href` values by resolving against the store origin.
- Cap profile fetch at 200KB; reject larger payloads as suspicious.

## References

- Shopify agentic-commerce overview: https://shopify.dev/docs/agents
- Third-party reference implementation: https://github.com/tahmidbintaslim/shopify-ucp
- Canonical spec (TODO once ucp.dev is publishable): https://ucp.dev
