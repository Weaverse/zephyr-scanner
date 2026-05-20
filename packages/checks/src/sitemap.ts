import type { Check } from "./types.js";

export const sitemapCheck: Check = {
  id: "sitemap-xml",
  name: "sitemap.xml present and valid",
  category: "discoverability",
  severity: "important",
  async run({ origin, fetch }) {
    const url = new URL("/sitemap.xml", origin).toString();
    const res = await fetch(url);
    if (!res.ok) {
      return { passed: false, score: 0, detail: `sitemap.xml not found (HTTP ${res.status})`, fixHint: "Publish /sitemap.xml — Shopify/Hydrogen generates this automatically." };
    }
    const body = await res.text();
    const isXml = body.includes("<urlset") || body.includes("<sitemapindex");
    return {
      passed: isXml,
      score: isXml ? 100 : 40,
      detail: isXml ? "Valid sitemap found." : "File present but not valid XML sitemap.",
      evidence: { sizeBytes: body.length },
    };
  },
};
