# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Zephyr Scanner — a commerce-focused agent-readiness scanner (Shopify / Hydrogen / agentic-commerce protocols). Public, free, no-signup. Marketed at `zephyr.build`, built by Weaverse.

Status: v0 scaffold with 3 of 15 checks live. Target: v1.0 in 7 days. The contract that drives the build is `docs/plan/PLAN.md` — treat it as the single source of truth for scope, day-by-day plan, and working agreement.

## Common commands

Always use `pnpm` (workspace pinned at `pnpm@9.0.0`). Never use `npm` / `yarn`.

```bash
pnpm install                              # bootstrap workspaces
pnpm dev:api                              # Hono Worker (wrangler dev) → http://localhost:8787
pnpm dev:web                              # Astro landing → http://localhost:4321 (apps/web not yet scaffolded)
pnpm build                                # recursive build across all workspaces
pnpm test                                 # recursive test across all workspaces (vitest, once it lands)

# Per-workspace
pnpm --filter @zephyr/api dev             # API only
pnpm --filter @zephyr/checks test         # single-package tests
pnpm --filter @zephyr/checks test -- robots   # run one test file
pnpm --filter @zephyr/api deploy          # wrangler deploy (DO NOT run from agent — Boss owns deploys)

# Smoke a local scan
curl "http://localhost:8787/scan?url=https://scoutshop.com"
```

The root `package.json` only exposes `dev:api`, `dev:web`, `build`, `test`. Per-workspace scripts (typecheck, lint, test) need to be added per-package — the testing rig in `docs/testing.md` is the blueprint.

## Architecture

Monorepo with two apps and three pure-TS packages:

```
apps/api          # Hono on Cloudflare Workers — the scan engine
apps/web          # Astro static + selective islands (scaffold pending)
packages/checks   # 15 check modules, each a pure async function
packages/scoring  # severity-weighted scoring rubric
packages/badge    # SVG badge generator (scaffold pending)
```

**Data flow on `/scan`:**

```
URL → Hono handler → CheckContext { url, origin, fetch (with UA + cf cache) }
                  → runAll() = Promise.all over registered checks
                  → scoreResults() applies severity weights → ScanScore
                  → JSON { target, scannedAt, score, results }
```

Future layers (v1, see `docs/plan/PLAN.md` §2 and `docs/deployment.md`): KV cache by URL (1h TTL), R2 for full reports + rendered badges/OG images, D1 for the leaderboard. These bindings are not yet in `wrangler.toml` — add them when implementing Day 6.

### Check contract — read before adding one

Every check is a `Check` (see `packages/checks/src/types.ts`):

- Pure async function `run(ctx: CheckContext)`. No globals, no shared state.
- Takes only `{ url, origin, fetch }`. **Always** call the injected `ctx.fetch`, never the global — it carries the `User-Agent: ZephyrScanner/...` header and the Workers `cf.cacheTtl` hint, and tests rely on it being mockable.
- Returns a partial `CheckResult` (id/name/category/severity/durationMs are stamped by `runCheck`).
- Must return a 0–100 score, not just boolean. Partial wins matter (e.g. robots.txt with 2 of 5 AI bots → 40). `passed` is derived from `score >= 60` by convention.
- Must supply a `fixHint` on any failing branch — this is the user-facing remediation copy.
- Must populate `evidence` with the raw data the result page renders.
- Register in `packages/checks/src/index.ts` (`allChecks` array) and add the matching row to `docs/CHECKS.md` status column in the same PR.

`runCheck` wraps every call in try/catch and records `durationMs` — do not duplicate that error handling inside individual checks. If a check throws, it surfaces as `passed: false, score: 0, detail: "Check errored: ..."`.

### Scoring

`packages/scoring/src/index.ts` is the single implementation. Severity weights: critical=3, important=2, nice-to-have=1. Overall = round(weightedSum / maxPossible × 100). Grades: A ≥90, B ≥75, C ≥60, D ≥40, F <40. Category sub-scores use the same formula scoped per category. See `docs/scoring.md` for the rationale.

## Plan-driven workflow

`docs/plan/PLAN.md` defines Day 1 → Day 7 PRs with a checklist per day. Coding agents:

1. **One PR per day.** Title format `Day N: <summary>`, branch `day-N/<slug>`.
2. **Conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`, `test:`).
3. **Don't edit `docs/plan/PLAN.md`** without flagging — it's the contract.
4. **Update `docs/CHECKS.md`** status column in the same PR that ships a check.

## Hard rules from the working agreement

These are non-negotiable; they came from PLAN.md and exist for reasons that aren't visible from the code alone:

- **Never invent protocol shapes.** Days 4–5 implement UCP / MCP / ACP / x402 / WebMCP / MPP. If `docs/specs/<protocol>.md` is missing or marked TODO when you reach that check, **skip the check** and append to `docs/plan/OPEN_QUESTIONS.md` using the format at the top of that file. Roxie owns the specs; the agent does not guess.
- **No headless browser, no JS execution.** Pure HTTP `fetch` only. If a check fundamentally requires a JS runtime to validate, log it in `OPEN_QUESTIONS.md` instead of pulling Playwright/Puppeteer in.
- **No new dependencies without justification.** The approved set is `hono`, `astro`, `vitest`, `wrangler`, `@cloudflare/workers-types`, `typescript`, `eslint`. Anything beyond requires a paragraph in the PR body.
- **Budgets:** 5s per check, 15s overall scan. Enforce with `Promise.allSettled` + per-check timeout when wiring this in (not yet present in v0).
- **Respect target `robots.txt` for the scanner's own UA** (`ZephyrScanner`). If the target disallows us, return an early error instead of scanning.
- **Do not run `wrangler deploy`.** CI/Boss own deploys. Agents should keep the project buildable and the workflow valid, but never push to Cloudflare.
- **PR review is human-gated.** Agents open PRs; do not merge to main.

## Testing posture

Stack is `vitest` per package with mocked `fetch` and on-disk fixtures (`packages/checks/test/fixtures/<check-id>/{pass,fail,partial}.txt`). Full conventions, helper shape, and coverage thresholds (80/80/70) live in `docs/testing.md`. Anti-patterns to avoid:

- Hitting the live network from tests.
- Stubbing `runCheck` — test through it so the error-wrapping path is exercised.
- Snapshotting whole `CheckResult` objects — too noisy as checks evolve. Assert specific fields.
- Cross-check coupling. Integration is `apps/api/test/`'s job, not the individual check tests.

Minimum bar per new check: one passing fixture + one failing fixture. Add a partial fixture when the score has a meaningful degraded middle band.

## Outbound fetch identity

Every outbound request uses `User-Agent: ZephyrScanner/<version> (+https://zephyr.build)`. This is set inside the `ctx.fetch` wrapper in `apps/api/src/index.ts` — don't bypass it. The markdown-negotiation check (#12) is the only one that overrides `Accept: text/markdown`.

## Where to find what

| Question | File |
|---|---|
| What checks exist and their status | `docs/CHECKS.md` |
| Day-by-day execution plan + scope | `docs/plan/PLAN.md` |
| Unresolved decisions / agent escalations | `docs/plan/OPEN_QUESTIONS.md` |
| API request/response contract | `docs/api.md` |
| Scoring formula and rationale | `docs/scoring.md` |
| Web app pages, share copy, design tokens | `docs/web.md` |
| Test rig conventions + fixture rules | `docs/testing.md` |
| Cloudflare bindings, wrangler config, CI/CD | `docs/deployment.md` |
| Protocol briefs (UCP/ACP/MPP/x402/WebMCP/MCP) | `docs/specs/*.md` (some still TODO) |
