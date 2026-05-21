import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/index.js";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const path = new URL(url).pathname;
    if (path === "/robots.txt") {
      return new Response(
        "User-agent: GPTBot\nAllow: /\nSitemap: https://example.com/sitemap.xml\n",
        { status: 200 },
      );
    }
    if (path === "/sitemap.xml") {
      return new Response("<urlset></urlset>", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /scan", () => {
  it("rejects when url is missing", async () => {
    const res = await app.request("/scan", {}, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing url/);
  });

  it("rejects an invalid url", async () => {
    const res = await app.request("/scan?url=:::", {}, {});
    expect(res.status).toBe(400);
  });

  it("returns score + meta with all 15 checks live", async () => {
    const res = await app.request("/scan?url=https://example.com", {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      id: string;
      meta: {
        apiVersion: string;
        checksCovered: number;
        checksTotal: number;
        limitedCoverage: boolean;
        cached: boolean;
        disclaimer?: string;
      };
      score: { overall: number; grade: string };
      results: Array<{ id: string }>;
    };
    expect(body.meta.apiVersion).toBe("0.1.0");
    expect(body.meta.checksTotal).toBe(15);
    expect(body.meta.checksCovered).toBe(body.results.length);
    expect(body.meta.limitedCoverage).toBe(body.meta.checksCovered < 10);
    expect(body.meta.cached).toBe(false);
    expect(typeof body.id).toBe("string");
    expect(["A", "B", "C", "D", "F"]).toContain(body.score.grade);
  });
});

describe("GET /", () => {
  it("returns service info", async () => {
    const res = await app.request("/", {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      name: string;
      endpoints: string[];
    };
    expect(body.name).toBe("zephyr-scanner");
    expect(body.endpoints.length).toBeGreaterThan(0);
  });
});

describe("GET /scan/:id", () => {
  it("404s when no scan exists for the id and no KV binding", async () => {
    const res = await app.request("/scan/nonexistent", {}, {});
    expect(res.status).toBe(404);
  });
});

describe("GET /badge/:filename", () => {
  it("400s when filename does not end with .svg", async () => {
    const res = await app.request("/badge/example.com", {}, {});
    expect(res.status).toBe(400);
  });

  it("404s when no scan exists for the domain", async () => {
    const res = await app.request("/badge/unknown.example.svg", {}, {});
    expect(res.status).toBe(404);
  });
});

describe("GET /leaderboard", () => {
  it("returns empty entries when D1 is unbound", async () => {
    const res = await app.request("/leaderboard", {}, {});
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      period: string;
      entries: unknown[];
    };
    expect(body.entries).toEqual([]);
  });

  it("normalizes invalid period to 30d", async () => {
    const res = await app.request("/leaderboard?period=lifetime", {}, {});
    const body = (await res.json()) as { period: string };
    expect(body.period).toBe("30d");
  });
});
