import { describe, expect, it } from "vitest";
import { mcpCardCheck } from "../src/mcp-card.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("mcp-card check", () => {
  it("scores 100 with full SEP-2127 card", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp/server-card.json": {
          body: fixture("mcp-card", "card-pass.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({ hasVersion: true, hasTitle: true });
  });

  it("scores 100 on a real-world Cloudflare-shaped card (name + remotes + version + title, no capabilities)", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp/server-card.json": {
          body: fixture("mcp-card", "card-cloudflare-shape.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({
      hasVersion: true,
      hasTitle: true,
      hasSchema: true,
    });
  });

  it("scores 80 when card has name + remotes but missing version and title", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp/server-card.json": {
          body: fixture("mcp-card", "card-no-capabilities.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(80);
  });

  it("scores 50 when card has only name", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp/server-card.json": {
          body: fixture("mcp-card", "card-partial.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(50);
  });

  it("falls back to the alternate well-known path", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp-server-card.json": {
          body: fixture("mcp-card", "card-pass.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(100);
  });

  it("scores 0 when no path resolves", async () => {
    const r = await runCheck(mcpCardCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });

  it("rejects responses with the wrong content-type", async () => {
    const r = await runCheck(
      mcpCardCheck,
      ctxFor({
        "/.well-known/mcp/server-card.json": {
          body: "<html></html>",
          headers: { "content-type": "text/html" },
        },
        "/.well-known/mcp-server-card.json": {
          body: "<html></html>",
          headers: { "content-type": "text/html" },
        },
      }),
    );
    expect(r.score).toBe(0);
  });
});
