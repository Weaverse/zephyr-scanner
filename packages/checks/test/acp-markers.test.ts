import { describe, expect, it } from "vitest";
import { acpMarkersCheck } from "../src/acp-markers.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("acp-markers check", () => {
  it("scores 100 with link tag + valid API-Version header", async () => {
    const r = await runCheck(
      acpMarkersCheck,
      ctxFor({
        "/": fixture("acp-markers", "home-with-link.html"),
        "/checkout_sessions": {
          body: "Unauthorized",
          status: 401,
          headers: { "api-version": "2026-04-17" },
        },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({ hasLink: true, validVersion: true });
  });

  it("scores 80 with API-Version but no link tag", async () => {
    const r = await runCheck(
      acpMarkersCheck,
      ctxFor({
        "/": fixture("acp-markers", "home-no-link.html"),
        "/checkout_sessions": {
          body: "",
          status: 401,
          headers: { "api-version": "2026-04-17" },
        },
      }),
    );
    expect(r.score).toBe(80);
  });

  it("scores 50 when endpoint exists without version header", async () => {
    const r = await runCheck(
      acpMarkersCheck,
      ctxFor({
        "/": fixture("acp-markers", "home-no-link.html"),
        "/checkout_sessions": { body: "", status: 401 },
      }),
    );
    expect(r.score).toBe(50);
  });

  it("scores 0 when /checkout_sessions returns 404", async () => {
    const r = await runCheck(
      acpMarkersCheck,
      ctxFor({ "/": fixture("acp-markers", "home-no-link.html") }),
    );
    expect(r.score).toBe(0);
  });
});
