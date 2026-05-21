# Zephyr — Execution Plan

**Status:** Ready for execution by a coding agent.
**Owners:** Samantha (positioning/UX/copy), Echo (engineering), Roxie (specs/GTM).
**Last updated:** 2026-05-21

---

## 0. North star

> **Shopify built the agent rails. Zephyr tells you if your store is on them.**

Zephyr is an open-source, commerce-focused agent-readiness scanner for Shopify
storefronts. It is the **top of funnel** for [Weaverse](https://weaverse.io)
(the paid Shopify Hydrogen theme builder that ships agent-ready by default).

- **Free public scanner** → lives at `zephyr.build`
- **Paid fix** → Weaverse app at `weaverse.io` / `weaverse.ai`
- **Repo:** `github.com/Weaverse/zephyr-scanner` (public, MIT)

---

## 1. Product surface

### 1.1 Public scanner (zephyr.build)
- Single-page Astro app.
- Hero: paste URL → run scan → show score + breakdown.
- Result page is **shareable** (unique URL, OG image, embeddable SVG badge).
- Honest broker tone — no aggressive Weaverse upsell. One subtle "Fix this with
  Weaverse" footer + a single CTA on the results page below the breakdown.

### 1.2 Scan engine (apps/api)
- Hono on Cloudflare Workers (geo-distributed, fast cold starts).
- `GET /scan?url=…` → JSON `{ target, scannedAt, score, results }`.
- `GET /scan/:id` → cached scan results (KV).
- `GET /badge/:id.svg` → shareable score badge.
- `GET /og/:id.png` → OG image for social shares.

### 1.3 Result schema (already implemented, do not break)
See `packages/checks/src/types.ts` — `CheckResult`, `CheckCategory`,
`CheckSeverity`. See `packages/scoring/src/index.ts` — `ScanScore`,
`CategoryScore`.

---

## 2. Scoring rubric (v1 — locked)

Score is severity-weighted. Already implemented in `@zephyr/scoring`.

| Severity      | Weight |
|---------------|--------|
| critical      | 3      |
| important     | 2      |
| nice-to-have  | 1      |

### 2.1 Categories (5 — match `CheckCategory` enum)

| Category         | Description                                                 |
|------------------|-------------------------------------------------------------|
| `discoverability`| robots.txt, sitemap, hreflang, AI bot rules                 |
| `content`        | llms.txt, markdown negotiation, content signals             |
| `commerce`       | UCP, MCP, ACP, MPP, x402, trusted-agent eligibility         |
| `product-data`   | schema.org Product JSON-LD, variants, GTIN, OG/Twitter      |
| `checkout`       | cart permalinks, checkout handoff, order tracking           |

### 2.2 Grades

| Overall | Grade | Label                |
|---------|-------|----------------------|
| 90–100  | A     | Agent Native         |
| 75–89   | B     | Agent Aware          |
| 60–74   | C     | Agent Visible        |
| 40–59   | D     | Agent Discoverable   |
| 0–39    | F     | Agent Invisible      |

### 2.3 v0 disclaimer

Until ≥10 of 15 checks are live, every result page must show:

> ⚠️ Zephyr is in early beta. v0.x ships X of 15 checks. Score reflects what we
> can measure today; full coverage lands in v0.3.

---

## 3. Check matrix (15 checks for v1)

Authoritative version of `docs/CHECKS.md`. **Implementation order matters** —
build static checks first, network checks second, live agent calls last.

| #  | id                       | Name                                              | Category         | Severity      | Phase | Spec ref         |
|----|--------------------------|---------------------------------------------------|------------------|---------------|-------|------------------|
| 1  | `robots-txt`             | robots.txt with AI bot rules                      | discoverability  | important     | v0 ✅ | —                |
| 2  | `sitemap`                | sitemap.xml valid                                 | discoverability  | important     | v0 ✅ | —                |
| 3  | `llms-txt`               | llms.txt manifest                                 | content          | nice-to-have  | v0 ✅ | llmstxt.org      |
| 4  | `ucp-profile`            | UCP profile at `/.well-known/ucp`                 | commerce         | critical      | v0.1  | specs/ucp.md     |
| 5  | `mcp-server-card`        | MCP server card discoverable                      | commerce         | critical      | v0.1  | specs/webmcp.md  |
| 6  | `product-jsonld`         | schema.org Product JSON-LD on PDP                 | product-data     | critical      | v0.1  | schema.org       |
| 7  | `cart-permalink`         | Cart permalink format works                       | checkout         | important     | v0.1  | Shopify docs     |
| 8  | `product-variants`       | Variant/pricing/availability clarity in JSON-LD   | product-data     | important     | v0.2  | schema.org       |
| 9  | `acp-markers`            | ACP compliance markers                            | commerce         | important     | v0.2  | specs/acp.md     |
| 10 | `checkout-handoff`       | Checkout handoff URL accessible                   | checkout         | important     | v0.2  | Shopify docs     |
| 11 | `markdown-negotiation`   | Markdown content negotiation (`Accept: text/md`)  | content          | nice-to-have  | v0.2  | CF for agents    |
| 12 | `og-twitter`             | Open Graph + Twitter card on PDP                  | product-data     | nice-to-have  | v0.2  | ogp.me           |
| 13 | `hreflang-locale`        | Hreflang / locale signals                         | discoverability  | nice-to-have  | v0.3  | —                |
| 14 | `x402-headers`           | x402 payment headers                              | commerce         | nice-to-have  | v0.3  | specs/x402.md    |
| 15 | `trusted-agent`          | Trusted-agent eligibility signal                  | commerce         | nice-to-have  | v0.3  | specs/ucp.md     |

**Out of scope for v1** (parking lot):
- Live `search_catalog` MCP roundtrip (needs MCP client lib + auth tier handling) — v0.4
- Live AEO test (does ChatGPT/Claude/Perplexity surface the store?) — v0.4
- Competitor delta ("3 of your top 5 competitors are agent-ready") — v0.5

---

## 4. Check implementation contract

Every check is a `Check` (see `packages/checks/src/types.ts`). To add one:

1. Create `packages/checks/src/<id>.ts`.
2. Export a `Check` with `id`, `name`, `category`, `severity`, and `async run(ctx)`.
3. Register in `packages/checks/src/index.ts` `allChecks` array.
4. Add row to `docs/CHECKS.md` and mark status `✅`.
5. Add fixture-based test in `packages/checks/test/<id>.test.ts` (see §7).
6. PR must include a sample passing and failing response in the description.

### Contract for `run(ctx)` return value

```ts
{
  passed: boolean;     // did this check meet the bar?
  score: number;       // 0-100 — granular score for this check
  detail: string;      // short human-readable summary (shown in UI)
  evidence?: unknown;  // structured proof (raw response, parsed nodes, etc.)
  fixHint?: string;    // ONE actionable sentence ("Add llms.txt with…")
}
```

**Rules:**
- Never throw out of `run()` — runner wraps errors, but failures should be
  represented as `passed: false, score: 0, detail: "…"`.
- Always set `fixHint` when `passed: false`. The fix UX depends on it.
- `evidence` must be JSON-serializable (no DOM nodes, no Response objects).
- Never log secrets, full HTML, or anything > 10KB into `evidence`.

---

## 5. Phased build plan

### Phase 0 — Foundation (✅ done — verify before proceeding)
- [x] Monorepo (`apps/api`, `apps/web`, `packages/checks`, `packages/scoring`, `packages/badge`)
- [x] Hono on Workers scaffold
- [x] 3 v0 checks (robots, sitemap, llms-txt)
- [x] Scoring engine with severity weights + A–F grades
- [x] Public repo, MIT license, CONTRIBUTING

### Phase 1 — Make it real (v0.1, target: this week)
- [ ] **Specs:** write `docs/specs/{ucp,acp,mpp,x402,webmcp}.md` (Roxie's lane — see §6)
- [ ] **Checks:** implement `#4 ucp-profile`, `#5 mcp-server-card`, `#6 product-jsonld`, `#7 cart-permalink`
- [ ] **CI:** `.github/workflows/ci.yml` runs `pnpm typecheck` + `pnpm test` on PR
- [ ] **Test harness:** see §7 — vitest, fixtures, mocked fetch
- [ ] **Apps/web:** Astro landing with paste-URL form → POST/GET to API → render results
- [ ] **Badge:** SVG generator at `GET /badge/:id.svg`
- [ ] **OG image:** dynamic OG at `GET /og/:id.png` (use `workers-og` or `satori`)
- [ ] **KV cache:** store scan results by `:id` for shareable URLs, 7-day TTL
- [ ] **Disclaimer banner** on result page (§2.3)

### Phase 2 — Sharpen the wedge (v0.2)
- [ ] Checks `#8`–`#12`
- [ ] PDP auto-discovery (crawl homepage → find a sample product URL → scan that too)
- [ ] Category breakdown UI (radar chart or bar chart)
- [ ] "Compare to category average" line (requires aggregate stats — see §9)
- [ ] CONTRIBUTING expanded with "how to add a check" walkthrough

### Phase 3 — Cover everything (v0.3)
- [ ] Checks `#13`–`#15`
- [ ] Drop the disclaimer banner
- [ ] Public launch: HN, X thread, r/shopify, Shopify Partners Slack

### Phase 4 — Live signals (v0.4 — out of scope for initial build)
- [ ] Live MCP `search_catalog` roundtrip
- [ ] Live AEO probes against ChatGPT/Claude/Perplexity APIs
- [ ] Webhook subscription for re-scans

---

## 6. Spec briefs (Roxie's deliverable — required before Phase 1 checks)

Each file in `docs/specs/<name>.md` follows this template:

```md
# <Spec name>

**URL:** <canonical reference URL>
**Status:** <draft | candidate | stable>
**Implemented in checks:** <#4, #5, …>

## What it is
<2–3 sentence summary in plain English.>

## What the scanner checks
- **Endpoint(s):** <exact URLs relative to origin>
- **Method:** GET (default) | other
- **Headers required to send:** <Accept, etc.>
- **Headers required in response:** <…>
- **Body shape:** <JSON example or schema link>

## Pass / fail line
- ✅ **Passes** when: <bullet list of required conditions>
- ⚠️ **Partial** when: <degraded but present>
- ❌ **Fails** when: <missing or malformed>

## Sample valid response
```json
{ … }
```

## Sample invalid response
```json
{ … }
```

## Fix hint (one sentence)
"<Exactly what the merchant must do.>"

## References
- <official spec links>
- <reference implementations>
```

**Required files:**
- `docs/specs/ucp.md` — Universal Commerce Protocol (ucp.dev)
- `docs/specs/mcp.md` — MCP server card (modelcontextprotocol.io) + WebMCP (webmcp.org)
- `docs/specs/acp.md` — Agentic Commerce Protocol (agenticcommerce.dev)
- `docs/specs/mpp.md` — Merchant Payment Protocol (mpp.dev)
- `docs/specs/x402.md` — x402 (x402.org)
- `docs/specs/llms-txt.md` — llms.txt (llmstxt.org) — backfill for check #3

---

## 7. Testing strategy

### 7.1 Stack
- `vitest` for unit tests (works on workers via `@cloudflare/vitest-pool-workers` if needed; plain node for pure logic).
- Fixtures live in `packages/checks/test/fixtures/<check-id>/{pass,fail,partial}.html|.txt|.json`.
- Mock `fetch` in `CheckContext` — never hit the network in tests.

### 7.2 Per-check test template

```ts
import { describe, it, expect } from "vitest";
import { robotsCheck } from "../src/robots.js";
import { runCheck } from "../src/index.js";
import { mockFetch } from "./helpers/mock-fetch.js";

describe("robots-txt check", () => {
  it("passes when AI bots and sitemap are present", async () => {
    const ctx = {
      url: "https://example.com",
      origin: "https://example.com",
      fetch: mockFetch({ "/robots.txt": fixture("pass.txt") }),
    };
    const r = await runCheck(robotsCheck, ctx);
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it("fails when robots.txt is missing", async () => { … });
  it("partial when sitemap directive missing", async () => { … });
});
```

### 7.3 CI workflow (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

Add these scripts to root `package.json`:
```json
{
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "build": "pnpm -r build",
    "dev:api": "pnpm --filter @zephyr/api dev",
    "dev:web": "pnpm --filter @zephyr/web dev"
  }
}
```

---

## 8. Web app spec (apps/web — Astro)

### 8.1 Pages
- `/` — landing + paste-URL form
- `/scan/[id]` — result page (server-rendered from API)
- `/about` — what we check, methodology, link to CHECKS.md
- `/specs` — public-facing render of `docs/specs/*` (optional, nice-to-have)

### 8.2 Landing hero (copy — locked)

```
Shopify built the agent rails.
Zephyr tells you if your store is on them.

[ Paste a Shopify store URL ]   [ Scan ▸ ]

✓ Free  ✓ Open source  ✓ No signup
```

Sub-hero:

> AI agents (ChatGPT, Claude, Perplexity) are about to become a major shopping
> channel. Zephyr scans your storefront against the emerging agentic commerce
> standards — UCP, MCP, ACP, schema.org Product — and tells you, in 10 seconds,
> what to fix.

### 8.3 Result page layout

```
[ Score: 67/100 — Grade C — "Agent Visible" ]
[ Share badge ] [ Copy result URL ] [ Tweet ]

⚠️ v0.x disclaimer banner (until 10+ checks live)

— Category breakdown —
discoverability    ████████░░  82
content            ██████░░░░  60
commerce           ███░░░░░░░  30   ← biggest opportunity
product-data       ██████████  95
checkout           ████░░░░░░  40

— Failing checks (in priority order) —
[ critical ] UCP profile not found
  └ Fix: Publish /.well-known/ucp with your agent profile.
  └ [ Learn more → /specs/ucp ]

[ critical ] No Product JSON-LD on PDP
  └ Fix: Add schema.org/Product structured data to product pages.
  └ [ Learn more → /specs/product-jsonld ]

… etc, sorted by severity then score asc.

— Footer —
Built by Weaverse. The fix? Weaverse Hydrogen themes ship agent-ready by default. → weaverse.io
```

### 8.4 Share card / OG image
- Dimensions: 1200×630
- Top: "Zephyr Scanner" + zephyr.build
- Center: big score (67/100), grade letter, label
- Bottom: domain scanned, scan date, "scan yours at zephyr.build"
- Render via `workers-og` (recommended) in API route `GET /og/:id.png`

### 8.5 SVG badge
- Embeddable: `<img src="https://zephyr.build/badge/<id>.svg">`
- Shields.io-style, color-coded by grade (A=green, B=lime, C=yellow, D=orange, F=red)

---

## 9. Data + persistence

### 9.1 KV (`SCANS` namespace)
- Key: `scan:<id>` (id = nanoid 12)
- Value: full JSON response, gzipped
- TTL: 7 days
- Written on each completed `/scan` if `?save=1` (default true), keyed scan URL returned in response

### 9.2 R2 (optional — Phase 2+)
- Long-term storage of scan results for aggregate analytics
- Used for "compare to category average" feature

### 9.3 Aggregate stats (Phase 2+)
- Periodic Worker (Cron Trigger, daily) rolls up scan data → per-category averages
- Stored in KV under `agg:<category>:<period>`
- Read-only endpoint `GET /stats` for dashboards/charts

### 9.4 Rate limiting
- Per-IP: 30 scans/hour (KV-backed sliding window)
- Per-target: 1 scan / 5 min (prevent abuse / cache hit)
- Return `429` with `Retry-After`

---

## 10. Deployment

### 10.1 Cloudflare
- Workers project `zephyr-api` deploys from `apps/api/` via wrangler
- KV namespace `SCANS` bound as `SCANS`
- Custom domain: `api.zephyr.build`

### 10.2 Web
- Astro static + SSR islands deploys to Cloudflare Pages from `apps/web/`
- Custom domain: `zephyr.build` (apex) + `www.zephyr.build`

### 10.3 Env vars
- API: none required for v0.1 (no secrets, no LLM keys yet)
- v0.4 will need: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `PERPLEXITY_API_KEY` (for live AEO probes)

### 10.4 wrangler.toml (apps/api)
```toml
name = "zephyr-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"

[[kv_namespaces]]
binding = "SCANS"
id = "<filled at deploy time>"

[vars]
ENVIRONMENT = "production"
```

---

## 11. Repo conventions

- **Branch model:** trunk-based. `main` is always deployable.
- **Commits:** conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Already in use.
- **PRs:** must include passing CI + a sample response if it's a new check.
- **No force-pushes to `main`.**
- **Issue templates:** `.github/ISSUE_TEMPLATE/new-check.md` for community-proposed checks.
- **No `node_modules`, no `.env`, no `dist/` in git** (already in `.gitignore`).

---

## 12. Open questions (decide before Phase 1 ends)

1. **Custom domains:** is `zephyr.build` already pointed at Cloudflare? If not, Boss should DNS-delegate before Phase 1 deploy.
2. **Analytics:** Plausible? Cloudflare Web Analytics? PostHog? Recommend **Plausible** for the landing (privacy + lightweight) + Cloudflare Workers Analytics Engine for API metrics.
3. **Error tracking:** Sentry on both API and web? Worth it for v0.1 — recommend yes, free tier.
4. **OG image library:** `workers-og` vs Vercel `@vercel/og` vs `satori` directly. Recommend **`workers-og`** (purpose-built for Workers runtime, smaller footprint).
5. **Should the disclaimer banner be dismissible?** Recommend **no** until v0.3 — it's there for trust, not friction.

---

## 13. Execution order for coding agent

Run these in sequence. Each is a self-contained PR-sized chunk.

1. **CI + scripts** — add `.github/workflows/ci.yml`, root `package.json` scripts (`typecheck`, `test`, `build`), one passing test per existing check.
2. **Specs** — write all 6 files in `docs/specs/` using the template from §6.
3. **Check #4 ucp-profile** — fetch `/.well-known/ucp`, validate against spec, return result + fixHint.
4. **Check #5 mcp-server-card** — fetch MCP server card per `docs/specs/mcp.md`, validate.
5. **Check #6 product-jsonld** — crawl homepage → find a `/products/<handle>` link → fetch → parse JSON-LD → check `@type: Product`.
6. **Check #7 cart-permalink** — verify cart permalink endpoints (Shopify `cart/add` etc.) per `docs/specs/` (or add a sub-spec).
7. **Apps/web — landing + scan flow** — Astro page, form posts to API, renders result page using the schema in §1.3.
8. **KV cache + shareable scan URLs** — `?save=1` writes to KV, `/scan/:id` reads back.
9. **SVG badge** — `GET /badge/:id.svg`, color by grade.
10. **OG image** — `GET /og/:id.png` via `workers-og`.
11. **Disclaimer banner + footer** — on result page only.
12. **Deploy to Cloudflare** — Workers + Pages, point custom domains.
13. **Phase 2 checks (#8–#12)** — same drill, one PR each.
14. **Phase 3 checks (#13–#15)** — same drill.
15. **Drop disclaimer, prep launch.**

Each step lands as one PR with: code + tests + docs update + sample response in PR body. CI must be green before merge.

---

## 14. Definition of done (v1.0)

- All 15 checks implemented with tests.
- `zephyr.build` live, scanning real Shopify stores, <2s p95 latency.
- Shareable scan URLs + SVG badge + OG image working.
- At least one Weaverse store scoring A grade as a reference.
- Launch post drafted, Shopify Partners Slack thread queued.

That's the spec. Hand it to the coding agent.
