import { describe, expect, it } from "vitest";
import { robotsCheck } from "../src/robots.js";
import { runCheck } from "../src/index.js";
import { ctxFor, fixture } from "./helpers/mock-fetch.js";

describe("robots-txt check", () => {
  it("scores 100 when all five AI bots and Sitemap directive are present", async () => {
    const r = await runCheck(
      robotsCheck,
      ctxFor({ "/robots.txt": fixture("robots-txt", "pass.txt") }),
    );
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.evidence).toMatchObject({ hasSitemap: true });
  });

  it("partial score when AI bots present but Sitemap missing", async () => {
    const r = await runCheck(
      robotsCheck,
      ctxFor({ "/robots.txt": fixture("robots-txt", "partial.txt") }),
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(60);
    expect(r.passed).toBe(false);
  });

  it("scores 0 when robots.txt is missing", async () => {
    const r = await runCheck(robotsCheck, ctxFor({}));
    expect(r.passed).toBe(false);
    expect(r.score).toBe(0);
    expect(r.fixHint).toBeDefined();
  });

  it("does not throw on disallowed-all robots", async () => {
    const r = await runCheck(
      robotsCheck,
      ctxFor({ "/robots.txt": fixture("robots-txt", "fail.txt") }),
    );
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
  });
});
