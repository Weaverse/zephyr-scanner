# MCP — Protocol Brief

> **Status:** 🟢 v1 — verified live against `developers.cloudflare.com` on 2026-05-21.
> **Confidence:** high. SEP-2127 now ships a versioned schema URL
> (`/schemas/v1/server-card.schema.json`) and Cloudflare is publishing
> server cards in production. Update if the schema flips to a different
> path before formal SEP merge.

## What is it?

The Model Context Protocol (MCP) is the open standard that lets AI applications
connect to external tools and data sources. For commerce, a host can publish a
**Server Card** at a well-known URL describing the MCP server's identity,
transport endpoints, and (optionally) declarative capabilities. Spec evolution
lives at SEP-2127.

## What does Zephyr check?

- **Discovery URL:** `https://{origin}/.well-known/mcp/server-card.json` (primary,
  matches what Cloudflare ships). We also accept the older alias
  `/.well-known/mcp-server-card.json` while the spec stabilises.
- **Required headers:** Response `Content-Type: application/json`.
- **Valid response shape (canonical, live from Cloudflare):**

  ```json
  {
    "$schema": "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    "name": "com.cloudflare/mcp",
    "version": "0.1.0+1.0.0",
    "title": "Cloudflare MCP Servers",
    "description": "MCP servers for Cloudflare …",
    "websiteUrl": "https://developers.cloudflare.com/agents/",
    "repository": {
      "url": "https://github.com/cloudflare/mcp-server-cloudflare",
      "source": "github"
    },
    "remotes": [
      { "url": "https://mcp.cloudflare.com/mcp", "type": "streamable-http" }
    ]
  }
  ```

- Live cards routinely **omit** the optional `capabilities` / `tools` /
  `prompts` / `resources` blocks — clients negotiate those over the MCP
  transport itself, so we don't penalise cards that elide them.

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | `name` + at least one `remotes[].url` + `version` + `title` |
| 90  | `name` + remotes + (`version` or `title`) |
| 80  | `name` + remotes only |
| 50  | `name` or remotes alone |
| 0   | endpoint absent OR wrong content-type OR invalid JSON |

## Implementation notes

- Cap fetch at 100KB.
- Reject responses without `Content-Type: application/json` — a 200 HTML
  catch-all should not be mistaken for a server card.
- Try the primary path first; only fall back to `mcp-server-card.json` if
  the primary returns a non-JSON error.

## References

- Live example: <https://developers.cloudflare.com/.well-known/mcp/server-card.json>
- MCP overview: <https://modelcontextprotocol.io>
- Public registry: <https://registry.modelcontextprotocol.io/v0/servers>
- Server Card WG charter: <https://modelcontextprotocol.io/community/server-card/charter>
- SEP-2127 draft (open, unmerged as of 2026-05-21):
  <https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2127>
