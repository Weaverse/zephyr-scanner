import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/index.js";

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
    if (path === "/llms.txt") {
      return new Response("missing", { status: 404 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("GET /scan", () => {
  it("rejects when url is missing", async () => {
    const res = await app.request("/scan");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/missing url/);
  });

  it("rejects an invalid url", async () => {
    const res = await app.request("/scan?url=:::");
    expect(res.status).toBe(400);
  });

  it("returns score + meta consistent with the live check count", async () => {
    const res = await app.request("/scan?url=https://example.com");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      meta: {
        apiVersion: string;
        checksCovered: number;
        checksTotal: number;
        limitedCoverage: boolean;
        disclaimer?: string;
      };
      score: { overall: number; grade: string };
      results: Array<{ id: string }>;
    };
    expect(body.meta.apiVersion).toBe("0.1.0");
    expect(body.meta.checksTotal).toBe(15);
    expect(body.meta.checksCovered).toBe(body.results.length);
    expect(body.meta.limitedCoverage).toBe(body.meta.checksCovered < 10);
    if (body.meta.limitedCoverage) {
      expect(body.meta.disclaimer).toMatch(/early development/);
    } else {
      expect(body.meta.disclaimer).toBeUndefined();
    }
    expect(typeof body.score.overall).toBe("number");
    expect(["A", "B", "C", "D", "F"]).toContain(body.score.grade);
  });
});

describe("GET /", () => {
  it("returns service info", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      name: string;
      endpoints: string[];
    };
    expect(body.name).toBe("zephyr-scanner");
    expect(body.endpoints.length).toBeGreaterThan(0);
  });
});
