# zephyr-scanner

> **Is your store agent-ready?** A commerce-focused agent readiness scanner.
> Built by [Weaverse](https://weaverse.io).

Inspired by [isitagentready.com](https://isitagentready.com) — narrowed and sharpened for Shopify, Hydrogen, and the agentic commerce era.

## What it checks

Across 5 commerce-focused categories:

- **Discoverability** — robots.txt with AI bot rules, sitemap, llms.txt
- **Content Accessibility** — markdown negotiation, structured data
- **Commerce Protocols** — UCP, ACP, MPP, x402, MCP server card
- **Product Data Quality** — schema.org Product JSON-LD, variants, pricing, availability
- **Checkout Readiness** — cart permalinks, agent handoff, trusted-agent eligibility

See [`docs/CHECKS.md`](./docs/CHECKS.md) for the full check matrix.

## Quick start

```bash
pnpm install
pnpm dev:api   # API on http://localhost:8787
pnpm dev:web   # Landing on http://localhost:4321
```

Scan a store:

```bash
curl "http://localhost:8787/scan?url=https://scoutshop.com"
```

## Project structure

```
zephyr-scanner/
├── apps/
│   ├── api/          # Hono on Cloudflare Workers — scan engine
│   └── web/          # Astro static site — landing + scan results
├── packages/
│   ├── checks/       # Individual check modules (pure TS)
│   ├── scoring/      # Weighted scoring rubric
│   └── badge/        # SVG badge generator
└── docs/specs/       # UCP, ACP, MPP, x402, WebMCP spec briefs
```

## Tech stack

- **Hono** on **Cloudflare Workers** — geo-distributed scan engine
- **Astro** — landing + result pages, React islands where needed
- **TypeScript** end-to-end, **pnpm** workspace

## Status

v1.0 candidate — all 15 checks live across 5 categories. KV-backed cache, R2 report archive, D1-backed leaderboard, SVG badges, and the Astro landing/result/leaderboard pages. CI runs typecheck + tests + build. Production deploy gated on Cloudflare credentials + DNS — see `docs/plan/OPEN_QUESTIONS.md`.

## License

MIT
