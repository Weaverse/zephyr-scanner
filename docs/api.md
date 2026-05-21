# API Contract — Zephyr Scanner

Base URL (prod): `https://api.zephyr.build`
Base URL (dev): `http://localhost:8787`

All responses are JSON unless noted. CORS open to all origins.

---

## `GET /`

Service info.

**Response 200:**
```json
{
  "name": "zephyr-scanner",
  "version": "1.0.0",
  "description": "Is your store agent-ready?",
  "endpoints": ["/scan", "/badge/{domain}.svg", "/leaderboard"],
  "docs": "https://github.com/Weaverse/zephyr-scanner"
}
```

---

## `GET /scan`

Run a scan against the given URL.

### Query params

| Name | Type | Required | Default | Description |
|---|---|---|---|---|
| `url` | string | yes | — | Target URL or bare domain. Auto-prefixed with `https://` if no scheme. |
| `fresh` | boolean | no | `false` | Bypass KV cache, force re-scan |
| `format` | `"json" \| "summary"` | no | `"json"` | `summary` returns only `{ score, meta }` |

### Errors

| Status | Body | Cause |
|---|---|---|
| 400 | `{ "error": "missing url query param" }` | No `url` |
| 400 | `{ "error": "invalid url" }` | URL constructor failed |
| 429 | `{ "error": "rate limit exceeded", "retryAfter": 3600 }` | >10 scans/IP/hour |
| 502 | `{ "error": "target unreachable", "detail": "..." }` | Homepage fetch failed |
| 504 | `{ "error": "scan timeout" }` | Overall budget exceeded |

### Response 200

```json
{
  "target": "https://scoutshop.com",
  "scannedAt": "2026-05-21T00:00:00.000Z",
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
      { "category": "content",         "score": 50, "passed": 1, "total": 2 },
      { "category": "commerce",        "score": 70, "passed": 4, "total": 5 },
      { "category": "product-data",    "score": 100,"passed": 3, "total": 3 },
      { "category": "checkout",        "score": 50, "passed": 1, "total": 2 }
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
      "detail": "robots.txt found. AI bots referenced: GPTBot, ClaudeBot, PerplexityBot. Sitemap directive: yes.",
      "evidence": {
        "aiBotsFound": ["GPTBot","ClaudeBot","PerplexityBot"],
        "hasSitemap": true,
        "sizeBytes": 412
      },
      "fixHint": null,
      "durationMs": 142
    }
  ]
}
```

### Per-check result schema

```ts
{
  id: string;                       // stable id, e.g. "robots-txt"
  name: string;                     // human label
  category: "discoverability" | "content" | "commerce" | "product-data" | "checkout";
  severity: "critical" | "important" | "nice-to-have";
  passed: boolean;
  score: number;                    // 0-100
  detail: string;                   // human-readable summary
  evidence?: Record<string, unknown>; // raw findings for the UI to render
  fixHint?: string | null;          // markdown-ready remediation guidance
  durationMs: number;
}
```

---

## `GET /badge/{domain}.svg`

Returns an SVG badge of the most recent cached score for `domain`.

- Cache-Control: `public, max-age=3600`
- Returns 404 if domain has never been scanned

**Visual:**
```
┌─────────┬─────────┐
│ Zephyr  │  A 92   │   (green/yellow/red by grade)
└─────────┴─────────┘
```

**Embed:**
```html
<a href="https://zephyr.build/scan/scoutshop.com">
  <img src="https://zephyr.build/badge/scoutshop.com.svg"
       alt="Agent readiness: A 92" />
</a>
```

---

## `GET /leaderboard`

Top stores by overall score.

### Query params

| Name | Type | Default | Description |
|---|---|---|---|
| `category` | string | — | Filter by category. Omit for overall. |
| `limit` | number | 50 | Max 100 |
| `period` | `"7d" \| "30d" \| "all"` | `"30d"` | Time window |

### Response 200

```json
{
  "period": "30d",
  "category": null,
  "entries": [
    { "rank": 1, "domain": "example.com", "score": 95, "grade": "A", "scannedAt": "2026-05-21T00:00:00Z" }
  ]
}
```

---

## Caching

- KV key: `scan:v1:{normalizedDomain}` → 1h TTL
- `fresh=true` bypasses cache and writes a new entry
- Badge generation reads from KV, never re-scans
- Leaderboard reads from D1 (writes happen async post-scan)

## Headers (outbound from scanner)

All outbound fetches use:
```
User-Agent: ZephyrScanner/1.0 (+https://zephyr.build)
Accept: */*
```

For markdown negotiation check (#12), `Accept: text/markdown` instead.

## Rate limiting

- 10 scans / IP / hour (Cloudflare WAF custom rule)
- Cached responses don't count against the budget
- Same domain re-scanned within 1h returns cache regardless of IP
