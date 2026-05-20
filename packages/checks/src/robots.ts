import type { Check } from "./types.js";

export const robotsCheck: Check = {
  id: "robots-txt",
  name: "robots.txt with AI bot rules",
  category: "discoverability",
  severity: "important",
  async run({ origin, fetch }) {
    const url = new URL("/robots.txt", origin).toString();
    const res = await fetch(url);
    if (!res.ok) {
      return {
        passed: false,
        score: 0,
        detail: `robots.txt not found (HTTP ${res.status})`,
        fixHint: "Publish /robots.txt with User-agent rules for AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended).",
      };
    }
    const body = await res.text();
    const aiBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];
    const mentioned = aiBots.filter((b) => body.includes(b));
    const hasSitemap = /sitemap:/i.test(body);
    const score = Math.min(100, mentioned.length * 20 + (hasSitemap ? 20 : 0));
    return {
      passed: score >= 60,
      score,
      detail: `robots.txt found. AI bots referenced: ${mentioned.join(", ") || "none"}. Sitemap directive: ${hasSitemap ? "yes" : "no"}.`,
      evidence: { aiBotsFound: mentioned, hasSitemap, sizeBytes: body.length },
      fixHint: mentioned.length === 0 ? "Add explicit User-agent entries for GPTBot, ClaudeBot, PerplexityBot." : undefined,
    };
  },
};
