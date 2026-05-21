# Deployment — Zephyr Scanner

All infra lives in **Cloudflare** under the Weaverse account. Single-vendor on
purpose: Workers (API), Pages (web), KV (cache), R2 (reports), D1 (leaderboard).

## Domains

| Domain          | Points to                  | Service          |
|-----------------|----------------------------|------------------|
| `zephyr.build`  | Cloudflare Pages (`apps/web`) | Landing + result UI |
| `api.zephyr.build` | Cloudflare Workers (`apps/api`) | Scan engine |
| `weaverse.ai`   | (later) Weaverse marketing | — |
| `weaverse.io`   | Existing Weaverse site     | — |

**DNS setup (Boss):**
1. Add `zephyr.build` to the Weaverse Cloudflare account as a zone.
2. Set nameservers at the registrar to Cloudflare's.
3. Pages domain `zephyr.build` + `www.zephyr.build` → automatic A/CNAME records.
4. Workers custom domain `api.zephyr.build` → automatic AAAA record after `wrangler deploy --custom-domain`.

## Cloudflare resources to create

Before first deploy, create these in the Weaverse account dashboard or via wrangler:

```bash
# KV — scan result cache + shareable scan URLs
wrangler kv:namespace create SCANS
wrangler kv:namespace create SCANS --preview  # for dev

# R2 — long-term storage of full reports + generated assets
wrangler r2 bucket create zephyr-reports

# D1 — leaderboard + scan history
wrangler d1 create zephyr
wrangler d1 execute zephyr --file=./apps/api/migrations/0001_init.sql
```

Capture all IDs returned by these commands — they go into `wrangler.toml`.

## `apps/api/wrangler.toml`

```toml
name = "zephyr-api"
main = "src/index.ts"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]

# Custom domain (after first deploy + DNS)
routes = [
  { pattern = "api.zephyr.build", custom_domain = true }
]

[[kv_namespaces]]
binding = "SCANS"
id = "<from `wrangler kv:namespace create SCANS`>"
preview_id = "<from --preview>"

[[r2_buckets]]
binding = "REPORTS"
bucket_name = "zephyr-reports"

[[d1_databases]]
binding = "DB"
database_name = "zephyr"
database_id = "<from `wrangler d1 create zephyr`>"

[vars]
ENVIRONMENT = "production"
SCANNER_VERSION = "0.1.0"

# Logpush / analytics
[observability]
enabled = true
```

## KV schema (`SCANS` namespace)

| Key pattern                | Value                          | TTL    | Purpose                        |
|----------------------------|--------------------------------|--------|--------------------------------|
| `scan:<id>`                | gzipped JSON `ScanResponse`    | 7 days | Shareable scan result by id    |
| `cache:<sha256(url)>`      | gzipped JSON `ScanResponse`    | 1 hour | Re-scan deduplication          |
| `rl:ip:<ip>:<hour-bucket>` | integer count                  | 1 hour | Rate limit per IP              |
| `rl:url:<sha256(url)>`     | timestamp                      | 5 min  | Rate limit per target          |

**id format:** `nanoid(12)`. Used in URLs (`zephyr.build/scan/<id>`),
badges (`/badge/<id>.svg`), and OG images (`/og/<id>.png`).

## R2 layout (`zephyr-reports` bucket)

```
reports/<yyyy>/<mm>/<dd>/<id>.json     # full report archive
badges/<id>.svg                         # rendered SVG badge
og/<id>.png                             # rendered OG image
```

R2 is write-through for badges/OG so we don't regenerate on every request. KV
points to R2 keys via signed URLs (or proxied through the Worker).

## D1 schema

`apps/api/migrations/0001_init.sql`:

```sql
CREATE TABLE scans (
  id          TEXT PRIMARY KEY,
  domain      TEXT NOT NULL,
  target_url  TEXT NOT NULL,
  overall     INTEGER NOT NULL,
  grade       TEXT NOT NULL,
  category_commerce      INTEGER NOT NULL DEFAULT 0,
  category_product_data  INTEGER NOT NULL DEFAULT 0,
  category_checkout      INTEGER NOT NULL DEFAULT 0,
  category_discoverability INTEGER NOT NULL DEFAULT 0,
  category_content       INTEGER NOT NULL DEFAULT 0,
  scanned_at  TEXT NOT NULL,
  hidden      INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_scans_domain ON scans(domain);
CREATE INDEX idx_scans_overall ON scans(overall DESC) WHERE hidden = 0;
CREATE INDEX idx_scans_scanned_at ON scans(scanned_at DESC);
```

**Leaderboard query** (top 100 by score, latest scan per domain):

```sql
SELECT s.* FROM scans s
JOIN (
  SELECT domain, MAX(scanned_at) AS latest
  FROM scans WHERE hidden = 0
  GROUP BY domain
) latest ON latest.domain = s.domain AND latest.latest = s.scanned_at
ORDER BY s.overall DESC, s.scanned_at DESC
LIMIT 100;
```

## Environment variables / secrets

### `apps/api` (Workers)

Phase 1 (v0.x → v0.3): **no secrets required.** Public-data scanning only.

Phase 4 (v0.4 — live AEO probes, parked for now):
```bash
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put PERPLEXITY_API_KEY
```

### `apps/web` (Pages)

`PUBLIC_API_BASE` — `https://api.zephyr.build` (prod) / `http://localhost:8787` (dev). Set
via Pages dashboard or `.env` for local.

### GitHub Actions secrets (for deploy workflow)

| Name                       | Source                        |
|----------------------------|-------------------------------|
| `CLOUDFLARE_API_TOKEN`     | Cloudflare dash → My Profile → API Tokens. Scopes: Workers + Pages + KV + R2 + D1 + Zone:DNS on the target zone. |
| `CLOUDFLARE_ACCOUNT_ID`    | Cloudflare dash → right sidebar |

## Deploy workflow

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @zephyr/api build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/api
          command: deploy

  deploy-web:
    runs-on: ubuntu-latest
    needs: deploy-api
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @zephyr/web build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/web/dist --project-name=zephyr-web
```

**Deploy gating rules:**
- CI (`ci.yml`) must be green on `main`.
- Deploy workflow only runs on push to `main` — never on PRs.
- First-time deploy: run manually (`wrangler deploy` from local) so the
  custom-domain prompt is interactive. After that, CI takes over.

## Local development

```bash
# install
pnpm install

# API (Hono Worker via wrangler dev)
pnpm dev:api    # → http://localhost:8787

# Web (Astro)
pnpm dev:web    # → http://localhost:4321

# Both, in parallel (recommended)
pnpm dev        # uses concurrently / pnpm parallel
```

`pnpm dev:api` uses `wrangler dev` which provides local KV / R2 / D1
emulation. No real Cloudflare account hits during development.

## Rate limiting

Implemented in `apps/api/src/middleware/ratelimit.ts`:

- **Per IP:** 30 scans / rolling 1 hour. KV-backed counter at `rl:ip:<ip>:<hour-bucket>`.
- **Per target URL:** 1 scan / 5 minutes. Forces cache hit if violated; does not
  block, just returns the cached result.
- **Bypass:** internal calls with header `X-Zephyr-Internal: <secret>` skip
  rate limits (used by warming / monitoring jobs).

When throttled:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 3247
Content-Type: application/json

{"error":"rate limit exceeded","retryAfter":3247}
```

## Observability

- **Workers Logs:** enabled via `[observability]` in `wrangler.toml`. Tail
  with `wrangler tail`.
- **Workers Analytics:** built-in metrics (requests, errors, CPU time, latency).
- **Cloudflare Web Analytics:** drop the snippet on the Astro landing for
  privacy-friendly page views.
- **Sentry** (recommended, v0.2+): one project for API, one for Web. Free tier
  is plenty until launch. Skip for v0.1 to keep dependency surface small.

## Custom UA + scanner identity

The scanner identifies itself on every outbound `fetch`:

```
User-Agent: ZephyrScanner/0.1 (+https://zephyr.build)
```

We respect `Disallow: ZephyrScanner` in target `robots.txt` — if present, the
scan returns an early `{ error: "scan blocked by robots.txt" }`.

This is non-negotiable for trust. Document it on `zephyr.build/about`.

## Pre-launch checklist

- [ ] DNS for `zephyr.build` delegated to Cloudflare
- [ ] Cloudflare Pages project `zephyr-web` created
- [ ] Workers project `zephyr-api` created
- [ ] KV namespace `SCANS` created (prod + preview)
- [ ] R2 bucket `zephyr-reports` created
- [ ] D1 database `zephyr` created + migrations applied
- [ ] GitHub Actions secrets set (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)
- [ ] Custom domains pointed (`zephyr.build`, `api.zephyr.build`)
- [ ] First manual `wrangler deploy` completed (to confirm custom-domain binding)
- [ ] `/scan` returns 200 against a known-good Weaverse demo store
- [ ] Disclaimer banner live on result page
