import { describe, expect, it } from "vitest";
import { x402HeadersCheck } from "../src/x402-headers.js";
import { runCheck } from "../src/index.js";
import { ctxFor } from "./helpers/mock-fetch.js";

function b64(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

const validPayload = {
  x402Version: 2,
  accepts: [
    {
      scheme: "exact",
      network: "eip155:84532",
      amount: "10000",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      payTo: "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
      maxTimeoutSeconds: 60,
    },
  ],
};

describe("x402-headers check", () => {
  it("scores 100 on 402 + valid PAYMENT-REQUIRED header", async () => {
    const r = await runCheck(
      x402HeadersCheck,
      ctxFor({
        "/": "<html></html>",
        "/.well-known/x402": {
          body: "{}",
          status: 402,
          headers: { "payment-required": b64(validPayload) },
        },
      }),
    );
    expect(r.score).toBe(100);
  });

  it("scores 80 on 200 JSON manifest advertising x402", async () => {
    const r = await runCheck(
      x402HeadersCheck,
      ctxFor({
        "/": "<html></html>",
        "/.well-known/x402": {
          body: JSON.stringify(validPayload),
          status: 200,
          headers: { "content-type": "application/json" },
        },
      }),
    );
    expect(r.score).toBe(80);
  });

  it("scores 30 when 402 has no PAYMENT-REQUIRED header", async () => {
    const r = await runCheck(
      x402HeadersCheck,
      ctxFor({
        "/": "<html></html>",
        "/.well-known/x402": { body: "", status: 402 },
      }),
    );
    expect(r.score).toBe(30);
  });

  it("scores 50 when accepts[] is missing fields", async () => {
    const r = await runCheck(
      x402HeadersCheck,
      ctxFor({
        "/": "<html></html>",
        "/.well-known/x402": {
          body: "{}",
          status: 402,
          headers: { "payment-required": b64({ x402Version: 2, accepts: [{}] }) },
        },
      }),
    );
    expect(r.score).toBe(50);
  });

  it("scores 0 when probe returns 404", async () => {
    const r = await runCheck(
      x402HeadersCheck,
      ctxFor({ "/": "<html></html>" }),
    );
    expect(r.score).toBe(0);
  });
});
