import type { CheckContext } from "../types.js";

const SITEMAP_INDEX_RE = /<sitemapindex/i;
const LOC_RE = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;

function locsFrom(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(LOC_RE)) {
    if (m[1]) out.push(m[1]);
  }
  return out;
}

export async function sampleProductUrl(
  ctx: Pick<CheckContext, "origin" | "fetch">,
): Promise<string | null> {
  const sitemapUrl = new URL("/sitemap.xml", ctx.origin).toString();
  const res = await ctx.fetch(sitemapUrl);
  if (!res.ok) return null;
  const body = await res.text();

  // If it's a sitemap index, try to find a product-specific child sitemap first.
  if (SITEMAP_INDEX_RE.test(body)) {
    const children = locsFrom(body);
    const productSitemap =
      children.find((u) => /product/i.test(u)) ?? children[0];
    if (!productSitemap) return null;
    const childRes = await ctx.fetch(productSitemap);
    if (!childRes.ok) return null;
    return firstProductUrl(await childRes.text());
  }

  return firstProductUrl(body);
}

function firstProductUrl(xml: string): string | null {
  const urls = locsFrom(xml);
  return urls.find((u) => u.includes("/products/")) ?? urls[0] ?? null;
}

export async function fetchPdp(
  ctx: Pick<CheckContext, "origin" | "fetch">,
): Promise<{ url: string; html: string } | null> {
  const url = await sampleProductUrl(ctx);
  if (!url) return null;
  const res = await ctx.fetch(url);
  if (!res.ok) return null;
  return { url, html: await res.text() };
}
