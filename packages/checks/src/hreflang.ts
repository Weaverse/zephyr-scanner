import type { Check } from "./types.js";

const HREFLANG_RE =
  /<link\s+[^>]*rel\s*=\s*["']alternate["'][^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*>/gi;
const HREFLANG_RE_2 =
  /<link\s+[^>]*hreflang\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']alternate["'][^>]*>/gi;

export const hreflangCheck: Check = {
  id: "hreflang",
  name: "Hreflang / locale signals on homepage",
  category: "discoverability",
  severity: "nice-to-have",
  async run({ origin, fetch }) {
    const res = await fetch(origin);
    if (!res.ok) {
      return {
        passed: false,
        score: 0,
        detail: `Homepage returned HTTP ${res.status}.`,
        fixHint: "Make the homepage reachable (HTTP 200) so locale signals can be discovered.",
      };
    }

    const html = await res.text();
    const langs = new Set<string>();
    for (const m of html.matchAll(HREFLANG_RE)) {
      if (m[1]) langs.add(m[1].toLowerCase());
    }
    for (const m of html.matchAll(HREFLANG_RE_2)) {
      if (m[1]) langs.add(m[1].toLowerCase());
    }

    if (langs.size === 0) {
      return {
        passed: false,
        score: 0,
        detail: "No hreflang link tags on the homepage.",
        evidence: { langs: [] },
        fixHint:
          "Add <link rel=\"alternate\" hreflang=\"…\"> tags for each supported locale plus x-default. Agents use these to pick the right regional storefront.",
      };
    }

    const hasXDefault = langs.has("x-default");
    let score = 50;
    if (langs.size > 1) score += 30;
    if (hasXDefault) score += 20;
    score = Math.min(score, 100);

    return {
      passed: score >= 60,
      score,
      detail: `Found ${langs.size} hreflang value(s)${hasXDefault ? " including x-default" : ""}.`,
      evidence: { langs: [...langs], hasXDefault },
      fixHint:
        !hasXDefault && langs.size > 0
          ? "Add a hreflang=\"x-default\" entry so agents have a fallback when no locale matches."
          : undefined,
    };
  },
};
