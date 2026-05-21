const LINK_RE = /<link\s+([^>]+?)\/?>/gi;
const ATTR_RE = /(\w[\w-:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

export interface LinkTag {
  rel?: string;
  href?: string;
  type?: string;
  hreflang?: string;
}

export function extractLinkTags(html: string): LinkTag[] {
  const tags: LinkTag[] = [];
  for (const m of html.matchAll(LINK_RE)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] ?? "").matchAll(ATTR_RE)) {
      const key = a[1]?.toLowerCase();
      const value = a[2] ?? a[3] ?? a[4] ?? "";
      if (key) attrs[key] = value;
    }
    tags.push({
      rel: attrs["rel"]?.toLowerCase(),
      href: attrs["href"],
      type: attrs["type"]?.toLowerCase(),
      hreflang: attrs["hreflang"]?.toLowerCase(),
    });
  }
  return tags;
}

export function findLinkByRel(html: string, rel: string): LinkTag | undefined {
  const target = rel.toLowerCase();
  return extractLinkTags(html).find((t) => t.rel === target);
}

export function resolveHref(href: string, origin: string): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}
