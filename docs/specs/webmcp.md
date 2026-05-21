# WebMCP — Protocol Brief

> **Status:** 🟡 partial — WebMCP is a **client-side JS API**, not a well-known URL.
> Our HTTP-only scanner can only detect indirect signals. Needs Roxie review.
> **Confidence:** low — protocol still in proposal stage at the W3C WebML CG
> (first published 2025-08-13, evolving in webmachinelearning/webmcp).

## What is it?

WebMCP is a proposed JavaScript API that lets web pages expose "tools" (JS functions with
schemas) that AI agents and browser assistants can invoke directly. Page = MCP server, but
implemented in client-side JS instead of a backend server. Proposed by Microsoft + Google
contributors via the W3C Web Machine Learning Community Group.

## What does Zephyr check?

Without a headless browser we can't execute JS. We look for **static surface signals** that
a page has opted into WebMCP:

- **HTML `<script>` tag** referencing a WebMCP polyfill, the canonical module URL, or a
  string match on `navigator.modelContext` / `window.modelContext` / `webmcp` in inline
  `<script>` blocks.
- **HTTP header probe** — homepage response carries `WebMCP-Available: true` or similar
  advertising header (emerging convention; not yet codified).
- **Meta tag** — `<meta name="webmcp" content="enabled">` (informal hint adopted by
  early adopters).

Per the WebMCP explainer the API is explicitly NOT about HTTP discovery — but we want some
way to flag opt-in. We'll evolve the signal list as adoption patterns settle.

## Pass / fail criteria

| Score | Condition |
|---|---|
| 100 | Header `WebMCP-Available` OR meta tag `name=webmcp` AND a `<script>` reference |
| 80  | One of: header, meta tag, or `<script>` reference |
| 50  | Inline `<script>` mentions `modelContext` but not in a registration context |
| 0   | No signal found |

Because static detection is brittle, this check **never returns errors as critical** —
it's a "nice-to-have" only.

## Implementation notes

- Re-use the homepage HTML the other checks already fetched.
- Static analysis is best-effort; don't fail the scan if regex matching is ambiguous.
- A future v2 may execute the page in a sandbox (e.g. headless Workerd) — out of scope today.

## References

- W3C explainer: https://github.com/webmachinelearning/webmcp
- Initial proposal: https://github.com/jasonjmcghee/WebMCP (predecessor)
- Site: https://webmcp.org (currently a JSON-RPC client placeholder)
