import { Hono } from "hono";
import { cors } from "hono/cors";
import { allChecks, runAll } from "@zephyr/checks";
import { scoreResults } from "@zephyr/scoring";

const API_VERSION = "0.1.0";
const CHECKS_TOTAL = 15;
const LIMITED_COVERAGE_THRESHOLD = 10;
const USER_AGENT = `ZephyrScanner/${API_VERSION} (+https://zephyr.build)`;

const app = new Hono();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "zephyr-scanner",
    version: API_VERSION,
    description: "Is your store agent-ready?",
    endpoints: ["/scan?url=https://example.com", "/badge/{domain}.svg", "/leaderboard"],
    docs: "https://github.com/Weaverse/zephyr-scanner",
  }),
);

app.get("/scan", async (c) => {
  const raw = c.req.query("url");
  if (!raw) return c.json({ error: "missing url query param" }, 400);

  let target: URL;
  try {
    target = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return c.json({ error: "invalid url" }, 400);
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

  return c.json({
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
  });
});

export default app;
