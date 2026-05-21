# Zephyr Scanner — Consolidated Build Plan v1.0

**Owner:** Weaverse
**Repo:** https://github.com/Weaverse/zephyr-scanner
**Domains:** `zephyr.build` (scanner), `weaverse.ai` (umbrella brand)
**Status:** v0 scaffold pushed (commit `1ef155a`) — 3/15 checks live.
**Target:** v1.0 shippable scanner in **7 working days**.

This document is the single source of truth for the coding agent. It bundles:

1. Vision + positioning (what we're building and why)
2. Architecture (stack, repo shape, data flow)
3. Check matrix (all 15 checks, with implementation specs)
4. Protocol specs (UCP, ACP, MPP, x402, WebMCP, MCP) — what to fetch + how to validate
5. Scoring rubric (severity weights, category weights, grade thresholds)
6. API contract (request/response shapes)
7. Web app spec (pages, components, share mechanics)
8. CI/CD + deploy
9. Day-by-day execution plan
10. Open questions (things the agent should flag, not invent)

> **Companion docs in this folder:**
> - `CHECKS.md` — full check matrix (already in repo at `docs/CHECKS.md`)
> - `specs/{ucp,acp,mpp,x402,webmcp,mcp}.md` — protocol briefs (Roxie's deliverables)
> - `api.md` — full API contract
> - `web.md` — landing + result page specs
> - `scoring.md` — scoring rubric detail

---

## 1. Vision + Positioning

**One-liner:** "Shopify built the rails. Zephyr tells you if your store is on them."

**Long form:** Zephyr Scanner is a free, public, commerce-focused agent-readiness scanner. Paste a store URL → get a 0-100 score across 5 commerce categories + a fix-it action list. Inspired by [isitagentready.com](https://isitagentready.com), narrowed and sharpened for Shopify, Hydrogen, and the agentic commerce era (UCP, ACP, MPP, x402, WebMCP).

**Why now:** Shopify shipped the Universal Commerce Protocol (UCP) + UCP-compliant MCP servers ([shopify.dev/docs/agents](https://shopify.dev/docs/agents)). Merchants need to know if their store is discoverable, parseable, and transactable by AI agents (ChatGPT, Claude, Perplexity, Gemini). No commerce-specific scanner exists yet.

**Wedge vs Cloudflare's generic scanner:**
- They give a score. We give a score + Hydrogen-specific fix snippets.
- They test discoverability. We test *conversion* — "would an agent actually buy here?"
- They're generic. We're the category-defining tool for agentic commerce readiness.

**Distribution flywheel:**
1. Free scanner → viral on Shopify Twitter / r/shopify
2. Public, shareable scan URLs (`zephyr.build/scan/{domain}`) + score badges
3. Leaderboard creates social proof + competitive FOMO
4. "Powered by Weaverse" → top-of-funnel for Weaverse.io

**Monetization (post-v1, not in scope for this build):**
- Free tier: on-demand scan, public results, basic fix hints
- Pro tier ($29/mo): continuous monitoring, private results, full fix PRs against Hydrogen repos, Slack/email alerts on regression

---

## 2. Architecture

### Stack (locked)

| Layer | Tech | Why |
|---|---|---|
| Scan engine | **Hono on Cloudflare Workers** | Geo-distributed fetch, <100ms cold start, cheap egress |
| Web app | **Astro** (static + selective islands) | Fast landing, scan result SSR, React islands only where interactive |
| Cache | **Cloudflare KV** | 1h TTL per `{url}` → free re-scans |
| Result storage | **Cloudflare R2** | Full JSON reports + generated SVG badges |
| Leaderboard / history | **Cloudflare D1** (SQLite at edge) | Lightweight, no separate DB infra |
| Language | **TypeScript** end-to-end | |
| Package manager | **pnpm** workspace | |
| CI | **GitHub Actions** | typecheck + test + deploy on push to main |
| Deploy | **Wrangler** (API), **Cloudflare Pages** (web) | Single vendor, single account |

### Repo shape (already scaffolded)

```
zephyr-scanner/
├── apps/
│   ├── api/                  # Hono Worker — scan engine
│   │   ├── src/index.ts      # routes
│   │   ├── src/storage.ts    # KV + R2 + D1 wrappers
│   │   └── wrangler.toml
│   └── web/                  # Astro site
│       ├── src/pages/
│       │   ├── index.astro             # landing
│       │   ├── scan/[domain].astro     # result page
│       │   └── leaderboard.astro
│       └── astro.config.mjs
├── packages/
│   ├── checks/               # 15 check modules — pure TS, individually testable
│   │   └── src/{robots,sitemap,llms-txt,ucp,mcp-card,acp,x402,webmcp,product-jsonld,variants,cart-permalink,checkout,markdown-nego,og-twitter,hreflang,trusted-agent}.ts
│   ├── scoring/              # weighted scoring engine
│   └── badge/                # SVG badge generator
├── docs/
│   ├── CHECKS.md             # check matrix
│   ├── plan/PLAN.md          # this file
│   ├── specs/{ucp,acp,mpp,x402,webmcp,mcp}.md
│   ├── api.md
│   ├── web.md
│   └── scoring.md
├── .github/workflows/ci.yml
└── README.md
```

### Data flow

```
User → zephyr.build → POST /scan?url=...
                      │
                      ▼
                 Hono Worker
                      │
       ┌──────────────┼──────────────┐
       ▼              ▼              ▼
    KV cache?    runAll(checks)   D1 insert
       │              │              (history)
       ▼              ▼
   cached JSON   Promise.all(15 checks)
                      │
                      ▼
                 scoreResults()
                      │
                      ▼
                 R2 write (full report)
                      │
                      ▼
                 KV write (summary)
                      │
                      ▼
                 JSON response
```

### Concurrency + safety

- Each scan runs all 15 checks in parallel via `Promise.allSettled`.
- Hard timeout per check: **5 seconds**. Overall scan budget: **15 seconds**.
- Outbound fetches use `User-Agent: ZephyrScanner/1.0 (+https://zephyr.build)`.
- Respect `robots.txt` for our own crawling (only fetch paths we're told to test — `/`, `/robots.txt`, `/sitemap.xml`, `/.well-known/*`, 1 product page sampled from sitemap).
- Rate limit: **10 scans per IP per hour** (Cloudflare WAF rule).
- No PII collected. No headless browser. Pure HTTP.

---

## 3. Check Matrix (all 15)

| # | id | Name | Category | Severity | Weight | Status |
|---|----|----- |----------|----------|--------|--------|
| 1 | `robots-txt` | robots.txt with AI bot rules | discoverability | important | 2 | ✅ v0 |
| 2 | `sitemap-xml` | sitemap.xml valid | discoverability | important | 2 | ✅ v0 |
| 3 | `llms-txt` | llms.txt manifest | content | nice-to-have | 1 | ✅ v0 |
| 4 | `ucp-profile` | UCP profile at `/.well-known/ucp` | commerce | critical | 3 | ⏳ v1 |
| 5 | `mcp-card` | MCP server card discoverable | commerce | critical | 3 | ⏳ v1 |
| 6 | `acp-markers` | ACP compliance markers | commerce | important | 2 | ⏳ v1 |
| 7 | `x402-headers` | x402 payment headers | commerce | nice-to-have | 1 | ⏳ v1 |
| 8 | `product-jsonld` | schema.org Product JSON-LD on PDP | product-data | critical | 3 | ⏳ v1 |
| 9 | `product-variants` | Variant/pricing/availability clarity | product-data | important | 2 | ⏳ v1 |
| 10 | `cart-permalink` | Cart permalink format works | checkout | important | 2 | ⏳ v1 |
| 11 | `checkout-handoff` | Checkout handoff URL accessible | checkout | important | 2 | ⏳ v1 |
| 12 | `markdown-nego` | Markdown content negotiation | content | nice-to-have | 1 | ⏳ v1 |
| 13 | `og-twitter` | Open Graph + Twitter card on PDP | product-data | nice-to-have | 1 | ⏳ v1 |
| 14 | `hreflang` | Hreflang / locale signals | discoverability | nice-to-have | 1 | ⏳ v1 |
| 15 | `webmcp-or-trusted-agent` | WebMCP endpoint OR trusted-agent eligibility | commerce | nice-to-have | 1 | ⏳ v1 |

**Implementation pattern (all checks follow this shape):**

```ts
// packages/checks/src/<id>.ts
import type { Check } from "./types.js";

export const <id>Check: Check = {
  id: "<id>",
  name: "<human name>",
  category: "<category>",
  severity: "<severity>",
  async run({ origin, fetch }) {
    // 1. Fetch the relevant URL(s) with 5s timeout
    // 2. Parse / validate
    // 3. Compute score 0-100
    // 4. Return { passed, score, detail, evidence, fixHint }
  },
};
```

Each check **must** export:
- A pure async function (no globals, no shared state)
- A score 0-100 (not just boolean)
- A `fixHint` string for any failing case
- An `evidence` object with raw data (for the result page to render details)

See `docs/specs/*.md` for per-check implementation details.

---

## 4. Protocol Specs (Roxie's lane, consolidated here)

Each spec file in `docs/specs/` answers:
1. **Discovery URL** — where to fetch
2. **Required headers**
3. **Valid response shape**
4. **Pass/fail thresholds**
5. **Reference impl link**

**Specs to populate (Roxie owns these — see stub at `docs/specs/README.md`):**

- `ucp.md` — Universal Commerce Protocol (https://ucp.dev) → check #4
- `acp.md` — Agentic Commerce Protocol (https://agenticcommerce.dev) → check #6
- `mpp.md` — Merchant Payment Protocol (https://mpp.dev) → check #7
- `x402.md` — x402 (https://x402.org) → check #7
- `webmcp.md` — WebMCP (https://webmcp.org) → check #15
- `mcp.md` — MCP server discovery → check #5

**Coding agent: if a spec file is missing or marked TODO, skip that check's implementation and add an entry to `docs/plan/OPEN_QUESTIONS.md` instead of guessing. Do not invent protocol shapes.**

---

## 5. Scoring Rubric

### Severity weights (already implemented)

| Severity | Weight |
|---|---|
| critical | 3 |
| important | 2 |
| nice-to-have | 1 |

### Formula

```
weightedScore = Σ(check.score × check.severity.weight)
maxPossible   = Σ(100 × check.severity.weight)
overall       = round((weightedScore / maxPossible) × 100)
```

### Grade thresholds

| Score | Grade |
|---|---|
| 90-100 | A |
| 75-89 | B |
| 60-74 | C |
| 40-59 | D |
| 0-39 | F |

### Category sub-scores

Same formula scoped to each category. Surfaced in API response + result page breakdown.

### "Limited coverage" disclaimer (v0 only)

When fewer than 10/15 checks are live, every scan response includes:

```json
"meta": {
  "apiVersion": "0.x.y",
  "checksCovered": 3,
  "checksTotal": 15,
  "limitedCoverage": true,
  "disclaimer": "Scanner is in early development. Score reflects 3 of 15 planned checks."
}
```

Web app renders this as a yellow banner above the score until `checksCovered >= 10`.

---

## 6. API Contract

Full detail in `docs/api.md`. Summary:

### `GET /`

```json
{
  "name": "zephyr-scanner",
  "version": "1.0.0",
  "endpoints": ["/scan", "/badge", "/leaderboard"]
}
```

### `GET /scan?url={url}&fresh={bool}`

- `url` required, normalized (adds `https://` if missing)
- `fresh=true` bypasses KV cache
- Cached results returned with `meta.cached: true`

**Response:**
```json
{
  "target": "https://scoutshop.com",
  "scannedAt": "2026-05-21T00:00:00Z",
  "meta": {
    "apiVersion": "1.0.0",
    "checksCovered": 15,
    "checksTotal": 15,
    "limitedCoverage": false,
    "cached": false,
    "durationMs": 4321
  },
  "score": {
    "overall": 78,
    "grade": "B",
    "passed": 12,
    "total": 15,
    "categories": [
      { "category": "discoverability", "score": 90, "passed": 3, "total": 3 },
      { "category": "content", "score": 50, "passed": 1, "total": 2 },
      { "category": "commerce", "score": 70, "passed": 4, "total": 5 },
      { "category": "product-data", "score": 100, "passed": 3, "total": 3 },
      { "category": "checkout", "score": 50, "passed": 1, "total": 2 }
    ]
  },
  "results": [
    {
      "id": "robots-txt",
      "name": "robots.txt with AI bot rules",
      "category": "discoverability",
      "severity": "important",
      "passed": true,
      "score": 100,
      "detail": "robots.txt found. AI bots referenced: GPTBot, ClaudeBot, PerplexityBot.",
      "evidence": { "aiBotsFound": ["GPTBot","ClaudeBot","PerplexityBot"], "hasSitemap": true },
      "fixHint": null,
      "durationMs": 142
    }
  ]
}
```

### `GET /badge/{domain}.svg`

Returns dynamically-generated SVG badge based on most recent cached score:

```
[ Zephyr | A 92 ]   (green for A/B, yellow for C, red for D/F)
```

### `GET /leaderboard?category={cat}&limit=50`

Top stores by overall score, scoped to category if provided.

### `POST /scan` (future, gated)

Background scan + webhook callback. Not in v1.

---

## 7. Web App Spec

Full detail in `docs/web.md`. Summary:

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing — hero, scan input, value props, leaderboard preview |
| `/scan/[domain]` | Result page — score, breakdown, fix-it list, share buttons |
| `/leaderboard` | Top 50 stores by score, filter by category |
| `/about` | What's a check, who built this, links to specs |

### Landing hero (Samantha's locked copy)

```
Shopify built the rails.
Zephyr tells you if your store is on them.

[ scan input: https://yourstore.com  ]  [ Scan now → ]

Free. No signup. Powered by Weaverse.
```

### Result page sections

1. Big score circle (overall + grade)
2. Category bars (5 categories with sub-scores)
3. Check list — passed (collapsed) + failed (expanded with fixHint)
4. Share row — Twitter, copy link, embed badge
5. CTA — "Built on Hydrogen? Get fixes auto-applied with Weaverse →"

### Share badge

```html
<a href="https://zephyr.build/scan/{domain}">
  <img src="https://zephyr.build/badge/{domain}.svg" alt="Agent readiness: A 92" />
</a>
```

### React islands (Astro)

- Scan input + live progress (one island on `/`)
- Share buttons (one island on `/scan/[domain]`)
- Leaderboard filter (one island on `/leaderboard`)

Everything else is pure static Astro.

---

## 8. CI/CD + Deploy

### `.github/workflows/ci.yml`

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm -r test
      - run: pnpm -r build
```

### `.github/workflows/deploy.yml`

On push to main:
- Deploy `apps/api` via `wrangler deploy`
- Deploy `apps/web` via `wrangler pages deploy`

Requires GitHub secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Boss creates the Cloudflare account + token. Coding agent should NOT run deploy itself — only ensure the workflow is valid and the project is buildable.

---

## 9. Day-by-Day Execution Plan

> Coding agent: work this in order. Each day produces one PR. Open the PR with a checklist matching the day's bullets.

### Day 1 — Foundation (PR 1)
- [ ] Add `.github/workflows/ci.yml` (typecheck + build, no test yet — tests come in PR 2)
- [ ] Add `tsconfig.json` at root + per-package `tsconfig.json` extending it
- [ ] Add `pnpm-lock.yaml` (run `pnpm install`)
- [ ] Add `vitest` config + 1 sample test in `packages/checks`
- [ ] Add `eslint` config (minimal: TS recommended)
- [ ] Add `meta` field to `/scan` response with `apiVersion`, `checksCovered`, `checksTotal`, `limitedCoverage`

### Day 2 — Product-data checks (PR 2)
- [ ] Check #8 `product-jsonld` — fetch `/sitemap.xml`, pick first product URL, fetch HTML, parse `<script type="application/ld+json">`, validate `@type: Product`
- [ ] Check #9 `product-variants` — extends #8, validates `offers.price`, `offers.availability`, variants array
- [ ] Check #13 `og-twitter` — parses OG + Twitter meta tags from same PDP fetch
- [ ] Unit tests for each (use fixture HTML in `packages/checks/test/fixtures/`)
- [ ] Update `docs/CHECKS.md` status column

### Day 3 — Checkout checks (PR 3)
- [ ] Check #10 `cart-permalink` — try `GET /cart/{variantId}:1` for variant extracted from check #8; expect 200/302 to cart
- [ ] Check #11 `checkout-handoff` — HEAD `/checkout` (or sniff via Shopify response headers); detect if direct checkout permalinks work
- [ ] Check #14 `hreflang` — parse homepage for `<link rel="alternate" hreflang>`
- [ ] Check #12 `markdown-nego` — fetch homepage with `Accept: text/markdown`, check `Content-Type`

### Day 4 — Commerce protocol checks, batch 1 (PR 4)
**Requires:** `docs/specs/{ucp,mcp}.md` populated by Roxie before this PR starts.
- [ ] Check #4 `ucp-profile` — per spec
- [ ] Check #5 `mcp-card` — per spec
- [ ] If spec missing → skip check, add row to `OPEN_QUESTIONS.md`, do NOT invent

### Day 5 — Commerce protocol checks, batch 2 (PR 5)
**Requires:** `docs/specs/{acp,x402,webmcp,mpp}.md`.
- [ ] Check #6 `acp-markers`
- [ ] Check #7 `x402-headers`
- [ ] Check #15 `webmcp-or-trusted-agent`

### Day 6 — Storage + Badge + Cache (PR 6)
- [ ] Wire KV cache (1h TTL by URL) into `/scan`
- [ ] Wire R2 write of full reports
- [ ] D1 schema + migration for leaderboard (`scans` table: domain, score, grade, scanned_at)
- [ ] `/badge/{domain}.svg` endpoint
- [ ] `/leaderboard` endpoint

### Day 7 — Web app (PR 7)
- [ ] Astro setup, Tailwind config
- [ ] Landing page with hero + scan input
- [ ] Result page `/scan/[domain]` rendering API response
- [ ] Leaderboard page
- [ ] Share buttons + embed code
- [ ] "Limited coverage" banner driven by `meta.limitedCoverage`

### Post-v1 (not in scope)
- Continuous monitoring + alerts
- "Fix with Weaverse" PR automation against connected Hydrogen repos
- Pro tier auth (Clerk or Cloudflare Access)
- Multi-region D1 read replicas
- Webhook on score regression

---

## 10. Open Questions

Coding agent: **do not guess these**. If you hit them, append to `docs/plan/OPEN_QUESTIONS.md` and ping Boss/Echo on Discord.

1. **Cloudflare account** — Boss owns. Need account ID + API token in GitHub secrets before deploy workflow runs. (Until then, CI builds but doesn't deploy.)
2. **Spec missing** — if any of `docs/specs/{ucp,acp,mpp,x402,webmcp,mcp}.md` is not populated when you reach Day 4-5, skip that check and document. Roxie must drop them in.
3. **Domain DNS** — `zephyr.build` + `weaverse.ai` DNS to point at Cloudflare. Boss handles.
4. **Rate limiting threshold** — currently 10 scans/IP/hour. Confirm with Boss before launch.
5. **Robots policy for our own scanner** — should `ZephyrScanner` UA be opt-in or opt-out? Default: opt-out (respect `Disallow: ZephyrScanner` if present).
6. **Leaderboard opt-out** — should we provide a `?` flag to exclude from leaderboard? Default: include. Add `Disallow: /scan/` in robots to signal.
7. **PR review** — coding agent opens PRs; do NOT merge to main without human approval.

---

## Coding Agent — Working Agreement

1. **One PR per Day-N in the execution plan.** Title format: `Day N: <summary>`.
2. **Branch naming:** `day-N/<short-slug>` (e.g. `day-2/product-data-checks`).
3. **Never skip the spec.** If `docs/specs/<protocol>.md` says TODO, leave that check unimplemented and log it in `OPEN_QUESTIONS.md`.
4. **Tests required.** Every new check needs at least one passing + one failing fixture test in `packages/checks/test/`.
5. **No new dependencies without justification.** Document in PR body if you add anything beyond: `hono`, `astro`, `vitest`, `wrangler`, `@cloudflare/workers-types`, `typescript`, `eslint`.
6. **No headless browser.** Pure HTTP fetch only. If a check fundamentally needs JS execution to work, document it in `OPEN_QUESTIONS.md` and skip.
7. **Respect the 5s per-check / 15s overall scan budget.**
8. **Conventional commits.** `feat:`, `fix:`, `docs:`, `chore:`, `test:`.
9. **Update `docs/CHECKS.md`** status column in the same PR that ships a check.
10. **Don't touch `docs/plan/PLAN.md`** without flagging Boss — this is the contract.

---

*Drafted by Echo. Reviewed pending by Samantha (positioning/copy) + Roxie (specs). Locked once all three sign off in the repo PR.*
