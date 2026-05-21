import { describe, expect, it } from "vitest";
import { markdownNegoCheck } from "../src/markdown-nego.js";
import { runCheck } from "../src/index.js";
import { ctxFor } from "./helpers/mock-fetch.js";

describe("markdown-nego check", () => {
  it("scores 100 when the server returns text/markdown", async () => {
    const r = await runCheck(
      markdownNegoCheck,
      ctxFor({
        "/": {
          body: "# Hello",
          headers: { "content-type": "text/markdown; charset=utf-8" },
        },
      }),
    );
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it("scores 0 when the server returns HTML despite Accept negotiation", async () => {
    const r = await runCheck(
      markdownNegoCheck,
      ctxFor({
        "/": {
          body: "<html></html>",
          headers: { "content-type": "text/html" },
        },
      }),
    );
    expect(r.score).toBe(0);
  });

  it("scores 0 when homepage is unreachable", async () => {
    const r = await runCheck(markdownNegoCheck, ctxFor({}));
    expect(r.score).toBe(0);
  });
});
