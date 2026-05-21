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
  const dispatch = (url: string): Response => {
    const parsed = new URL(url);
    const match =
      routes[url] ?? routes[parsed.pathname] ?? routes[`${parsed.origin}${parsed.pathname}`];
    if (!match) {
      return new Response("not found", { status: 404 });
    }
    const r = typeof match === "string" ? { body: match } : match;
    return new Response(r.body, {
      status: r.status ?? 200,
      headers: r.headers ?? { "content-type": "text/plain" },
    });
  };

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    let currentUrl = typeof input === "string" ? input : input.toString();
    const redirectMode = init?.redirect ?? "follow";

    // Mirror real fetch's redirect handling so production and tests can't
    // diverge silently — production follows 30x by default; a mock that
    // returns the 30x verbatim would let checks that depend on the terminal
    // status pass in tests and false-positive live (e.g. ACP's 301 to a 404).
    for (let hop = 0; hop < 5; hop++) {
      const res = dispatch(currentUrl);
      const isRedirect = res.status >= 300 && res.status < 400;
      if (!isRedirect || redirectMode !== "follow") {
        return res;
      }
      const location = res.headers.get("location");
      if (!location) return res;
      currentUrl = new URL(location, currentUrl).toString();
    }
    return new Response("too many redirects", { status: 508 });
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
