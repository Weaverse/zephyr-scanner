# WebMCP — Protocol Brief

> **Status:** 🟡 v0.1 — WebMCP is intentionally a **client-side JavaScript API**,
> not a well-known URL. The static signals we detect are deliberately a
> best-effort heuristic. Confidence: **low**.
> Updated 2026-05-21 after re-checking the W3C explainer for the current
> JS surface.

## What is it?

WebMCP is a proposed JavaScript API (W3C Web ML CG, first published
2025-08-13) that lets a page expose "tools" — JavaScript functions with
schemas — that AI agents and browser assistants can invoke directly. The
page becomes an MCP server implemented in client-side JS, with no separate
backend.

The canonical surface, per `docs/proposal.md` in `webmachinelearning/webmcp`:

```js
window.navigator.modelContext.registerTool({
  name: "search_products",
  description: "Search the product catalogue.",
  inputSchema: { /* … */ },
  execute: async (args) => { /* … */ },
});
```

Importantly: WebMCP is **explicitly NOT** about HTTP discovery. The
explainer's "Non-Goals" includes "Enable / influence discoverability of
sites to agents." That means a purely-HTTP scanner like Zephyr can only
catch the *opt-in surface* — the static markers a site embeds to signal
to non-JS observers that WebMCP is wired up.

## What does Zephyr check?

Static-only signals on the homepage:

1. **HTTP header** — `WebMCP-Available: true` (emerging convention, not
   yet codified).
2. **Meta tag** — `<meta name="webmcp" content="enabled">` (informal hint
   adopted by early integrators).
3. **`<script src>`** — any script tag referencing a URL containing
   `webmcp` (e.g. a polyfill loader).
4. **Inline `<script>`** — contains a literal `navigator.modelContext`
   or a `registerTool(` call.
5. **Weak signal** — inline keyword mention (`webmcp`, `modelContext`)
   without a registration context.

A signal in any of (1)-(4) counts as "strong". The score escalates with
the strong-signal count.

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | ≥ 2 strong signals (e.g. header + inline registerTool) |
| 80  | 1 strong signal |
| 50  | weak signal only (keyword mention without registration context) |
| 0   | no signal |

Because static detection is brittle and the spec is pre-implementation,
this check is `nice-to-have` severity — it never tanks a score, only
rewards stores that have opted in.

## Implementation notes

- Re-uses the homepage HTML the `og-twitter`, `hreflang`, and `ucp-profile`
  checks already fetch.
- A future v2 may execute the page in a sandboxed Workerd / headless
  browser to actually call `registerTool` and confirm the JS API resolves.
  Out of scope today (PLAN.md mandates pure HTTP).

## Known caveats

- No public production sites have been verified to expose WebMCP signals
  as of 2026-05-21. Browser support is still landing across Chromium /
  Safari Tech Preview — adoption is downstream of that.
- The conventions for `WebMCP-Available` and `<meta name="webmcp">` are
  Zephyr's own normalisation; if the WG codifies different markers, this
  brief and the check need to be revised in lockstep.

## References

- W3C explainer: <https://github.com/webmachinelearning/webmcp>
- Proposal: <https://github.com/webmachinelearning/webmcp/blob/main/docs/proposal.md>
- Initial proposal: <https://github.com/jasonjmcghee/WebMCP> (predecessor)
- Site: <https://webmcp.org> (currently a JSON-RPC client placeholder)
