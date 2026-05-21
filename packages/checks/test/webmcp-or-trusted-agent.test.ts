import { describe, expect, it } from "vitest";
import { webmcpOrTrustedAgentCheck } from "../src/webmcp-or-trusted-agent.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("webmcp-or-trusted-agent check", () => {
  it("scores 100 when meta tag + inline registerTool are both present", async () => {
    const r = await runCheck(
      webmcpOrTrustedAgentCheck,
      ctxFor({ "/": fixture("webmcp", "home-strong.html") }),
    );
    expect(r.score).toBe(100);
  });

  it("scores 80 with a single signal (e.g. polyfill script)", async () => {
    const r = await runCheck(
      webmcpOrTrustedAgentCheck,
      ctxFor({ "/": fixture("webmcp", "home-one-signal.html") }),
    );
    expect(r.score).toBe(80);
  });

  it("scores 50 when only an inline keyword mention is found", async () => {
    const r = await runCheck(
      webmcpOrTrustedAgentCheck,
      ctxFor({ "/": fixture("webmcp", "home-mention-only.html") }),
    );
    expect(r.score).toBe(50);
  });

  it("scores 0 when no signal is present", async () => {
    const r = await runCheck(
      webmcpOrTrustedAgentCheck,
      ctxFor({ "/": fixture("webmcp", "home-none.html") }),
    );
    expect(r.score).toBe(0);
  });

  it("recognises the WebMCP-Available header even on a plain homepage", async () => {
    const r = await runCheck(
      webmcpOrTrustedAgentCheck,
      ctxFor({
        "/": {
          body: fixture("webmcp", "home-none.html"),
          headers: { "webmcp-available": "true", "content-type": "text/html" },
        },
      }),
    );
    expect(r.score).toBe(80);
  });
});
