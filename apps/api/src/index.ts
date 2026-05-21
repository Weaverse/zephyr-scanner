import { Hono } from "hono";
import { cors } from "hono/cors";
import { allChecks, runAll } from "@zephyr/checks";
import { scoreResults } from "@zephyr/scoring";
import { renderBadge, type Grade } from "@zephyr/badge";

import {
  API_VERSION,
  CHECKS_TOTAL,
  LIMITED_COVERAGE_THRESHOLD,
  SCAN_CACHE_TTL_SECONDS,
  USER_AGENT,
  type Env,
} from "./env.js";
import {
  cacheKeyForUrl,
  nanoid12,
  normalizeUrl,
} from "./cache-key.js";
import {
  leaderboardEntries,
  latestScanForDomain,
  readScanById,
  readScanCache,
  writeReportToR2,
  writeScanById,
  writeScanCache,
  writeScanRow,
  type StoredScan,
} from "./storage.js";

const app = new Hono<{ Bindings: Env }>();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "zephyr-scanner",
    version: API_VERSION,
    description: "Is your store agent-ready?",
    endpoints: [
      "/scan?url=https://example.com",
      "/badge/{domain}.svg",
      "/leaderboard",
      "/scan/{id}",
    ],
    docs: "https://github.com/Weaverse/zephyr-scanner",
  }),
);

app.get("/scan", async (c) => {
  const env = c.env;
  const raw = c.req.query("url");
  if (!raw) return c.json({ error: "missing url query param" }, 400);

  let target: URL;
  try {
    target = normalizeUrl(raw);
  } catch {
    return c.json({ error: "invalid url" }, 400);
  }

  const fresh = c.req.query("fresh") === "true";
  const cacheKey = await cacheKeyForUrl(target.toString());

  if (!fresh) {
    const cached = await readScanCache(env, cacheKey);
    if (cached) {
      return c.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }
  }

  const ctx = {
    url: target.toString(),
    origin: target.origin,
    fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: { "User-Agent": USER_AGENT, ...(init?.headers || {}) },
        cf: { cacheTtl: 60 },
      } as RequestInit)) as typeof fetch,
  };

  const startedAt = Date.now();
  const results = await runAll(ctx);
  const score = scoreResults(results);
  const durationMs = Date.now() - startedAt;

  const checksCovered = allChecks.length;
  const limitedCoverage = checksCovered < LIMITED_COVERAGE_THRESHOLD;

  const scan: StoredScan = {
    id: nanoid12(),
    target: target.toString(),
    scannedAt: new Date().toISOString(),
    meta: {
      apiVersion: API_VERSION,
      checksCovered,
      checksTotal: CHECKS_TOTAL,
      limitedCoverage,
      cached: false,
      durationMs,
      ...(limitedCoverage
        ? {
            disclaimer: `Scanner is in early development. Score reflects ${checksCovered} of ${CHECKS_TOTAL} planned checks.`,
          }
        : {}),
    },
    score,
    results,
  };

  // Fan out persistence in parallel; failures are non-fatal so scans still
  // succeed even when bindings are missing in dev.
  await Promise.all([
    writeScanCache(env, cacheKey, scan, SCAN_CACHE_TTL_SECONDS),
    writeScanById(env, scan, SCAN_CACHE_TTL_SECONDS),
    writeReportToR2(env, scan).catch(() => undefined),
    writeScanRow(env, scan).catch(() => undefined),
  ]);

  return c.json(scan);
});

app.get("/scan/:id", async (c) => {
  const scan = await readScanById(c.env, c.req.param("id"));
  if (!scan) return c.json({ error: "scan not found" }, 404);
  return c.json({ ...scan, meta: { ...scan.meta, cached: true } });
});

app.get("/badge/:filename", async (c) => {
  const filename = c.req.param("filename");
  if (!filename.endsWith(".svg")) {
    return c.json({ error: "expected .svg suffix" }, 400);
  }
  const domain = filename.slice(0, -".svg".length).toLowerCase();
  const scan = await latestScanForDomain(c.env, domain);
  if (!scan) return c.json({ error: "no scan for domain" }, 404);

  const svg = renderBadge({
    grade: scan.score.grade as Grade,
    score: scan.score.overall as number,
  });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
});

app.get("/leaderboard", async (c) => {
  const periodParam = c.req.query("period") ?? "30d";
  const period: "7d" | "30d" | "all" =
    periodParam === "7d" || periodParam === "all" ? periodParam : "30d";
  const category = c.req.query("category") ?? undefined;
  const limit = Number(c.req.query("limit") ?? 50);

  const entries = await leaderboardEntries(c.env, {
    period,
    category,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return c.json({ period, category: category ?? null, entries });
});

export default app;
