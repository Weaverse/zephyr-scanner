# Testing — Zephyr Scanner

## Stack

- **Test runner:** [`vitest`](https://vitest.dev) — fast, ESM-native, TS out of the box.
- **No headless browser.** Checks are pure HTTP — fixtures + mocked `fetch` only.
- **Per-package tests.** Each workspace runs its own `pnpm test`; root aggregates via `pnpm -r test`.

## Layout

```
packages/checks/
├── src/
│   └── <check-id>.ts
└── test/
    ├── helpers/
    │   └── mock-fetch.ts      # shared fetch mocker
    ├── fixtures/
    │   └── <check-id>/
    │       ├── pass.txt|html|json
    │       ├── fail.txt|html|json
    │       └── partial.txt|html|json
    └── <check-id>.test.ts
```

**Fixture rule:** one folder per check. Minimum two fixtures (pass + fail).
Partial fixture only when the check has a meaningful "degraded" state (e.g.
robots.txt present but missing sitemap directive).

## Vitest config

`packages/checks/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      thresholds: { lines: 80, functions: 80, branches: 70 },
    },
  },
});
```

Same shape for `packages/scoring/vitest.config.ts` and `packages/badge/vitest.config.ts`.

## Mock fetch helper

`packages/checks/test/helpers/mock-fetch.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

type RouteMap = Record<
  string,
  | string
  | { body: string; status?: number; headers?: Record<string, string> }
>;

export function mockFetch(routes: RouteMap): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = new URL(url).pathname;

    const match = routes[path] ?? routes[url];
    if (!match) {
      return new Response("not found", { status: 404 });
    }
    const r = typeof match === "string" ? { body: match } : match;
    return new Response(r.body, {
      status: r.status ?? 200,
      headers: r.headers ?? { "content-type": "text/plain" },
    });
  }) as typeof fetch;
}

export function fixture(checkId: string, name: string): string {
  return readFileSync(
    join(__dirname, "..", "fixtures", checkId, name),
    "utf8",
  );
}
```

## Per-check test template

`packages/checks/test/robots.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { robotsCheck } from "../src/robots.js";
import { runCheck } from "../src/index.js";
import { mockFetch, fixture } from "./helpers/mock-fetch.js";

const ctxFor = (routes: Parameters<typeof mockFetch>[0]) => ({
  url: "https://example.com",
  origin: "https://example.com",
  fetch: mockFetch(routes),
});

describe("robots-txt check", () => {
  it("passes when AI bots and sitemap directive are present", async () => {
    const r = await runCheck(
      robotsCheck,
      ctxFor({ "/robots.txt": fixture("robots-txt", "pass.txt") }),
    );
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
    expect(r.evidence).toMatchObject({ hasSitemap: true });
  });

  it("partial when AI bots present but sitemap missing", async () => {
    const r = await runCheck(
      robotsCheck,
      ctxFor({ "/robots.txt": fixture("robots-txt", "partial.txt") }),
    );
    expect(r.passed).toBe(false);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(60);
  });

  it("fails when robots.txt is missing", async () => {
    const r = await runCheck(robotsCheck, ctxFor({}));
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
    expect(r.fixHint).toBeDefined();
  });
});
```

## Sample fixtures (robots-txt)

`packages/checks/test/fixtures/robots-txt/pass.txt`:
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: https://example.com/sitemap.xml
```

`packages/checks/test/fixtures/robots-txt/partial.txt`:
```
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /
```

`packages/checks/test/fixtures/robots-txt/fail.txt`:
```
User-agent: *
Disallow: /
```

## Scoring tests

`packages/scoring/test/scoring.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { scoreResults } from "../src/index.js";
import type { CheckResult } from "@zephyr/checks";

const result = (
  partial: Partial<CheckResult> & Pick<CheckResult, "passed" | "score" | "severity" | "category">,
): CheckResult => ({
  id: partial.id ?? "test",
  name: partial.name ?? "test",
  detail: partial.detail ?? "",
  durationMs: 1,
  ...partial,
});

describe("scoreResults", () => {
  it("weights critical 3x nice-to-have", async () => {
    const score = scoreResults([
      result({ severity: "critical", category: "commerce", passed: true, score: 100 }),
      result({ severity: "nice-to-have", category: "content", passed: false, score: 0 }),
    ]);
    // critical 100 * 3 + nice 0 * 1 = 300 of (100*3 + 100*1) = 400 → 75
    expect(score.overall).toBe(75);
  });

  it("returns F for zero results", () => {
    const score = scoreResults([]);
    expect(score.grade).toBe("F");
    expect(score.overall).toBe(0);
  });

  it("returns A at 90+", () => {
    const score = scoreResults([
      result({ severity: "critical", category: "commerce", passed: true, score: 95 }),
    ]);
    expect(score.grade).toBe("A");
  });
});
```

## CI workflow

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r typecheck
      - run: pnpm -r test
      - run: pnpm -r build
```

## Root scripts

Add to root `package.json`:

```json
{
  "scripts": {
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:watch": "pnpm --filter @zephyr/checks test --watch",
    "build": "pnpm -r build",
    "dev:api": "pnpm --filter @zephyr/api dev",
    "dev:web": "pnpm --filter @zephyr/web dev",
    "lint": "pnpm -r lint"
  }
}
```

## Coverage gates

- **Per check:** 1 passing fixture + 1 failing fixture minimum. Partial fixture
  required if the check returns scores between 0 and the pass threshold.
- **Workspace coverage:** 80% lines / 80% functions / 70% branches (enforced by vitest).
- **CI must be green** before any PR is mergeable.

## Anti-patterns (do not do)

- ❌ Hitting the live network from tests. All `fetch` is mocked.
- ❌ Stubbing `runCheck` itself. Test the `Check.run()` via `runCheck` to exercise
  the error-wrapping path.
- ❌ Snapshot tests for full `CheckResult`. Assert specific fields — snapshots
  are too noisy as we iterate.
- ❌ Cross-check coupling. Each check is tested in isolation; integration is
  covered by API-level tests in `apps/api/test/`.
