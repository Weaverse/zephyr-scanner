# UCP — Protocol Brief

> **Status:** 🟢 v1 — confirmed against a real Shopify store (allbirds.com) on 2026-05-21.
> **Confidence:** high. Profile shape verified live; field names captured from the
> canonical Shopify-hosted profile. Update if/when Shopify publishes a formal spec
> that differs from this.

## What is it?

The Universal Commerce Protocol (UCP) is the discovery layer for agentic commerce: a
JSON profile every store exposes describing which protocols, MCP endpoints, and
capabilities it supports. Shopify ships it for every store at `/.well-known/ucp`.

## What does Zephyr check?

- **Discovery:** Optional `<link rel="agent-profile" href="…">` tag in the homepage
  `<head>`; otherwise probe `/.well-known/ucp` directly (Shopify default).
- **Required headers:** Response `Content-Type: application/json`.
- **Valid response shape (Shopify canonical, live as of 2026-04-08):**

  ```json
  {
    "ucp": {
      "version": "2026-04-08",
      "supported_versions": {
        "2026-04-08": "https://example.myshopify.com/.well-known/ucp/2026-04-08",
        "2026-01-23": "https://example.myshopify.com/.well-known/ucp/2026-01-23"
      },
      "services": {
        "dev.ucp.shopping": [
          {
            "version": "2026-04-08",
            "transport": "mcp",
            "endpoint": "https://example.myshopify.com/api/ucp/mcp",
            "spec": "https://ucp.dev/2026-04-08/specification/overview/",
            "schema": "https://ucp.dev/2026-04-08/services/shopping/mcp.openrpc.json"
          },
          {
            "version": "2026-04-08",
            "transport": "embedded"
          }
        ]
      },
      "capabilities": {
        "dev.ucp.shopping.checkout":    [ { "version": "2026-04-08" } ],
        "dev.ucp.shopping.fulfillment": [ { /* ... */ } ],
        "dev.ucp.shopping.discount":    [ { /* ... */ } ]
      }
    }
  }
  ```

- **Alternate flat shape** (3rd-party gateways like
  github.com/tahmidbintaslim/shopify-ucp): `{ ucp_version, store, capabilities: [{ mcp_endpoint }] }`.
  Zephyr accepts either shape.

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | `<link rel="agent-profile">` AND profile fetched AND `ucp.version` AND a service with `transport="mcp"` + `endpoint` |
| 90  | well-known fallback AND `ucp.version` AND mcp endpoint |
| 70  | reachable + version, but no mcp endpoint |
| 50  | reachable but missing version + no mcp endpoint |
| 0   | endpoint absent OR JSON didn't match either known shape |

## Implementation notes

- Cap profile fetch at 200KB.
- Follow Shopify's canonical-host redirect (`allbirds.com` → `www.allbirds.com` →
  `/.well-known/ucp`) — `fetch` follows 3xx transparently.
- MCP discovery: the `services.dev.ucp.shopping[]` entry with `transport="mcp"` carries
  the MCP server URL. This is the modern alternative to
  `/.well-known/mcp/server-card.json` — most live Shopify stores have UCP but no
  separate MCP server card. A future revision of the `mcp-card` check should
  cross-reference the UCP profile.

## References

- Live example: https://allbirds.com/.well-known/ucp (works on any Shopify store)
- Shopify agentic-commerce docs: https://shopify.dev/docs/agents
- Spec landing (when reachable): https://ucp.dev
- 3rd-party reference impl (flat shape): https://github.com/tahmidbintaslim/shopify-ucp
