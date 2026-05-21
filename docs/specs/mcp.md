# MCP — Protocol Brief

> **Status:** 🟢 v0 draft — populated from SEP-2127 (Server Card Working Group, charter
> dated 2026-03-26). Needs Roxie review.
> **Confidence:** medium. The Server Card spec is **draft** (target: end-March 2026,
> ref implementations end-April). Field names and the well-known path may still shift.

## What is it?

The Model Context Protocol (MCP) is the open standard that lets AI applications connect to
external tools and data sources. For commerce, a store can host an MCP server (e.g. Shopify's
Cart/Checkout/Order MCPs) and advertise its endpoint + capabilities via a
**Server Card** — a small JSON document at a well-known URL.

## What does Zephyr check?

- **Discovery URL:** `https://{origin}/.well-known/mcp/server-card.json` (the path proposed
  in SEP-2127). We also accept `/.well-known/mcp-server-card.json` as a fallback while the
  spec stabilizes.
- **Required headers:** Response `Content-Type: application/json`.
- **Valid response shape (per SEP-2127 minimal card):**
  ```json
  {
    "name": "com.scoutshop.commerce",
    "title": "Scoutshop Commerce",
    "description": "Search, cart, and checkout for Scoutshop.",
    "websiteUrl": "https://scoutshop.com",
    "version": "1.0.0",
    "remotes": [
      { "type": "http", "url": "https://scoutshop.com/api/mcp" }
    ],
    "capabilities": { "tools": true, "resources": false, "prompts": false }
  }
  ```

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | Server card fetched AND has `name` + `remotes[]` with at least one entry + `capabilities` |
| 80  | Reachable AND has `name` + `remotes[]`, but `capabilities` missing |
| 50  | Reachable but missing one of name/remotes |
| 0   | Endpoint not found / unreachable / not JSON |

## Implementation notes

- Some sites may emit `application/json; charset=utf-8`; substring-match `application/json`.
- Cap fetch size at 100KB.
- Don't follow more than one redirect; the well-known URL should resolve directly.

## References

- MCP overview: https://modelcontextprotocol.io
- Server Card WG charter: https://modelcontextprotocol.io/community/server-card/charter
- SEP-2127 draft: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127
- Spec evolves — re-check when SEP-2127 lands.
