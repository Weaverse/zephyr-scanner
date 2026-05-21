import type { Check } from "./types.js";
import { findLinkByRel, resolveHref } from "./util/links.js";

const WELL_KNOWN_PATH = "/.well-known/x402";

interface PaymentRequired {
  x402Version?: unknown;
  accepts?: Array<{
    scheme?: unknown;
    network?: unknown;
    amount?: unknown;
    asset?: unknown;
    payTo?: unknown;
  }>;
}

function decodeBase64(value: string): string | null {
  try {
    return atob(value);
  } catch {
    return null;
  }
}

function validateAccepts(payload: PaymentRequired): boolean {
  if (typeof payload.x402Version !== "number") return false;
  if (!Array.isArray(payload.accepts) || payload.accepts.length === 0) return false;
  return payload.accepts.every(
    (a) =>
      typeof a?.scheme === "string" &&
      typeof a.network === "string" &&
      typeof a.amount === "string" &&
      typeof a.asset === "string" &&
      typeof a.payTo === "string",
  );
}

export const x402HeadersCheck: Check = {
  id: "x402-headers",
  name: "x402 payment headers",
  category: "commerce",
  severity: "nice-to-have",
  async run(ctx) {
    const homeRes = await ctx.fetch(ctx.origin).catch(() => null);
    let advertisedUrl: string | undefined;
    if (homeRes && homeRes.ok) {
      const html = await homeRes.text();
      const link = findLinkByRel(html, "agent-payments");
      if (link?.href && link.type?.includes("x402")) {
        advertisedUrl = resolveHref(link.href, ctx.origin);
      }
    }

    const probeUrl =
      advertisedUrl ?? new URL(WELL_KNOWN_PATH, ctx.origin).toString();
    const res = await ctx.fetch(probeUrl, { redirect: "manual" }).catch(() => null);
    if (!res) {
      return {
        passed: false,
        score: 0,
        detail: `Probe ${probeUrl} failed.`,
        evidence: { probeUrl },
        fixHint:
          "Expose either /.well-known/x402 (JSON manifest) or a route that responds with 402 + PAYMENT-REQUIRED header.",
      };
    }

    // Path 1: 402 response with PAYMENT-REQUIRED header
    if (res.status === 402) {
      const headerVal = res.headers.get("payment-required");
      if (!headerVal) {
        return {
          passed: false,
          score: 30,
          detail: "402 returned but no PAYMENT-REQUIRED header.",
          evidence: { probeUrl, status: 402 },
          fixHint:
            "Include the PAYMENT-REQUIRED header (base64 JSON) per the x402 v2 HTTP transport spec.",
        };
      }
      const decoded = decodeBase64(headerVal);
      if (!decoded) {
        return {
          passed: false,
          score: 40,
          detail: "PAYMENT-REQUIRED header present but not base64-decodable.",
          evidence: { probeUrl, status: 402 },
        };
      }
      try {
        const payload = JSON.parse(decoded) as PaymentRequired;
        if (validateAccepts(payload)) {
          return {
            passed: true,
            score: 100,
            detail: `402 + valid PAYMENT-REQUIRED at ${probeUrl}.`,
            evidence: {
              probeUrl,
              x402Version: payload.x402Version,
              acceptsCount: payload.accepts?.length ?? 0,
            },
          };
        }
        return {
          passed: false,
          score: 50,
          detail: "PAYMENT-REQUIRED payload missing required fields.",
          evidence: { probeUrl, status: 402 },
          fixHint:
            "Each accepts[] entry must include scheme, network, amount, asset, payTo per x402 v2.",
        };
      } catch {
        return {
          passed: false,
          score: 40,
          detail: "PAYMENT-REQUIRED header is not valid JSON.",
          evidence: { probeUrl, status: 402 },
        };
      }
    }

    // Path 2: 200 JSON manifest
    if (res.ok) {
      const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
      if (!contentType.includes("application/json")) {
        return {
          passed: false,
          score: 0,
          detail: `200 from ${probeUrl} but content-type is ${contentType || "missing"}.`,
          evidence: { probeUrl, status: res.status, contentType },
        };
      }
      try {
        const payload = JSON.parse(await res.text()) as PaymentRequired;
        if (validateAccepts(payload)) {
          return {
            passed: true,
            score: 80,
            detail: `JSON manifest at ${probeUrl} advertises x402.`,
            evidence: {
              probeUrl,
              x402Version: payload.x402Version,
              acceptsCount: payload.accepts?.length ?? 0,
            },
          };
        }
        return {
          passed: false,
          score: 50,
          detail: "Manifest reachable but missing required fields.",
          evidence: { probeUrl, status: res.status },
        };
      } catch {
        return {
          passed: false,
          score: 0,
          detail: `Manifest at ${probeUrl} is not valid JSON.`,
          evidence: { probeUrl, status: res.status },
        };
      }
    }

    return {
      passed: false,
      score: 0,
      detail: `Probe ${probeUrl} returned ${res.status}; no x402 signal.`,
      evidence: { probeUrl, status: res.status },
      fixHint:
        "Adopt x402 by responding with 402 + PAYMENT-REQUIRED header on a gated route, or publish a manifest at /.well-known/x402.",
    };
  },
};
