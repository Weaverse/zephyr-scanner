import { describe, expect, it } from "vitest";
import { ucpProfileCheck } from "../src/ucp-profile.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("ucp-profile check", () => {
  it("scores 100 when link tag points to a valid profile with mcp_endpoint", async () => {
    const r = await runCheck(
      ucpProfileCheck,
      ctxFor({
        "/": fixture("ucp-profile", "home-with-link.html"),
        "/.well-known/ucp": {
          body: fixture("ucp-profile", "profile-pass.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({ source: "link", hasMcpEndpoint: true });
  });

  it("scores 90 (well-known fallback) when no link tag but valid /.well-known profile", async () => {
    const r = await runCheck(
      ucpProfileCheck,
      ctxFor({
        "/": fixture("ucp-profile", "home-no-link.html"),
        "/.well-known/ucp": {
          body: fixture("ucp-profile", "profile-pass.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(90); // 50 base + 20 version + 20 mcp_endpoint; no link bonus
    expect(r.evidence).toMatchObject({ source: "well-known" });
  });

  it("scores 50 when profile is reachable but missing version + endpoint", async () => {
    const r = await runCheck(
      ucpProfileCheck,
      ctxFor({
        "/": fixture("ucp-profile", "home-no-link.html"),
        "/.well-known/ucp": {
          body: fixture("ucp-profile", "profile-partial.json"),
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(50);
    expect(r.passed).toBe(false);
  });

  it("scores 0 when neither link nor well-known resolves", async () => {
    const r = await runCheck(ucpProfileCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });

  it("scores 0 when /.well-known/ucp returns invalid JSON", async () => {
    const r = await runCheck(
      ucpProfileCheck,
      ctxFor({
        "/": fixture("ucp-profile", "home-no-link.html"),
        "/.well-known/ucp": {
          body: "<html></html>",
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(0);
  });
});
