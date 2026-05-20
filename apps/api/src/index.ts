import { Hono } from "hono";
import { cors } from "hono/cors";
import { runAll } from "@zephyr/checks";
import { scoreResults } from "@zephyr/scoring";

const app = new Hono();
app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "zephyr-scanner",
    version: "0.0.1",
    description: "Is your store agent-ready?",
    endpoints: ["/scan?url=https://example.com"],
  })
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
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      fetch(input, {
        ...init,
        headers: { "User-Agent": "ZephyrScanner/0.1 (+https://zephyr.build)", ...(init?.headers || {}) },
        // @ts-expect-error workers fetch
        cf: { cacheTtl: 60 },
      }),
  };

  const results = await runAll(ctx);
  const score = scoreResults(results);

  return c.json({
    target: target.toString(),
    scannedAt: new Date().toISOString(),
    score,
    results,
  });
});

export default app;
