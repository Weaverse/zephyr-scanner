const META_RE = /<meta\s+([^>]+?)\/?>/gi;
const ATTR_RE = /(\w[\w-:]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;

export interface MetaTag {
  name?: string;
  property?: string;
  content?: string;
}

export function extractMetaTags(html: string): MetaTag[] {
  const tags: MetaTag[] = [];
  for (const m of html.matchAll(META_RE)) {
    const attrs: Record<string, string> = {};
    for (const a of (m[1] ?? "").matchAll(ATTR_RE)) {
      const key = a[1]?.toLowerCase();
      const value = a[2] ?? a[3] ?? a[4] ?? "";
      if (key) attrs[key] = value;
    }
    tags.push({
      name: attrs["name"],
      property: attrs["property"],
      content: attrs["content"],
    });
  }
  return tags;
}

export function metaByName(html: string, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const t of extractMetaTags(html)) {
    if (t.name?.toLowerCase() === target) return t.content;
    if (t.property?.toLowerCase() === target) return t.content;
  }
  return undefined;
}
