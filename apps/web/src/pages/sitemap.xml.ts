import type { APIRoute } from "astro";

export const prerender = true;

const SITE = "https://isyourstoreagentready.com";

const paths = [
  "/",
  "/hydrogen",
  "/compare",
  "/compare/shopify-commerce-readiness",
  "/compare/cloudflare-agent-readiness",
  "/leaderboard",
  "/about",
];

export const GET: APIRoute = () => {
  const urls = paths
    .map((p) => `  <url><loc>${SITE}${p}</loc></url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
