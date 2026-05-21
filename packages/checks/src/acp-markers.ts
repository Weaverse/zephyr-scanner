import type { Check } from "./types.js";
import { findLinkByRel } from "./util/links.js";

const ACP_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

export const acpMarkersCheck: Check = {
  id: "acp-markers",
  name: "ACP compliance markers",
  category: "commerce",
  severity: "important",
  async run(ctx) {
    const checkoutUrl = new URL("/checkout_sessions", ctx.origin).toString();

    // Follow redirects: a 301 to the canonical hostname is universal Shopify
    // behaviour and does NOT mean /checkout_sessions exists at the destination.
    // We need the terminal status to know whether the route is actually wired.
    const [homeRes, sessionsRes] = await Promise.all([
      ctx.fetch(ctx.origin).catch(() => null),
      ctx.fetch(checkoutUrl, { redirect: "follow" }).catch(() => null),
    ]);

    let hasLink = false;
    if (homeRes && homeRes.ok) {
      const html = await homeRes.text();
      const link = findLinkByRel(html, "agent-checkout");
      hasLink = Boolean(link?.href);
    }

    if (!sessionsRes) {
      return {
        passed: false,
        score: 0,
        detail: "/checkout_sessions fetch failed.",
        evidence: { hasLink },
        fixHint:
          "Expose POST /checkout_sessions per the ACP spec (spec/2026-04-17/openapi). Even 401/403 is fine — agents just need to see the route exists.",
      };
    }

    const status = sessionsRes.status;
    const apiVersion = sessionsRes.headers.get("api-version") ?? undefined;
    const validVersion = !!apiVersion && ACP_VERSION_RE.test(apiVersion);
    const routeExists = status !== 404 && status !== 410;

    if (!routeExists) {
      return {
        passed: false,
        score: 0,
        detail: `/checkout_sessions returned ${status}.`,
        evidence: { status, hasLink, apiVersion },
        fixHint:
          "Implement the ACP checkout sessions endpoint. Stripe's docs/agentic-commerce has a turnkey integration for merchants.",
      };
    }

    let score = 50;
    if (validVersion) score += 30;
    if (hasLink) score += 20;
    score = Math.min(score, 100);

    return {
      passed: score >= 60,
      score,
      detail: `GET /checkout_sessions → ${status}. API-Version: ${apiVersion ?? "missing"}. Link tag: ${hasLink ? "present" : "missing"}.`,
      evidence: { status, apiVersion, validVersion, hasLink },
      fixHint:
        !validVersion
          ? "Return an `API-Version: YYYY-MM-DD` header (e.g. 2026-04-17) on /checkout_sessions responses."
          : !hasLink
            ? "Add <link rel=\"agent-checkout\" href=\"/checkout_sessions\"> to your homepage <head> for richer discovery."
            : undefined,
    };
  },
};
