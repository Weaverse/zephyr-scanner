import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type RouteValue =
  | string
  | {
      body: string;
      status?: number;
      headers?: Record<string, string>;
    };

export type RouteMap = Record<string, RouteValue>;

const HERE = dirname(fileURLToPath(import.meta.url));

export function mockFetch(routes: RouteMap): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const parsed = new URL(url);
    const path = parsed.pathname;

    const match =
      routes[url] ??
      routes[path] ??
      routes[`${parsed.origin}${path}`];

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
    join(HERE, "..", "fixtures", checkId, name),
    "utf8",
  );
}

export function ctxFor(routes: RouteMap, origin = "https://example.com") {
  return {
    url: `${origin}/`,
    origin,
    fetch: mockFetch(routes),
  };
}
