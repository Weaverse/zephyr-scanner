const JSONLD_RE =
  /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

export interface JsonLdBlock {
  raw: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export function extractJsonLd(html: string): JsonLdBlock[] {
  const blocks: JsonLdBlock[] = [];
  for (const m of html.matchAll(JSONLD_RE)) {
    const raw = (m[1] ?? "").trim();
    if (!raw) continue;
    try {
      blocks.push({ raw, data: JSON.parse(raw) });
    } catch {
      // skip malformed blocks; we still record the raw for evidence
      blocks.push({ raw, data: null });
    }
  }
  return blocks;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flattenGraphs(blocks: JsonLdBlock[]): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  for (const b of blocks) {
    if (!b.data) continue;
    if (Array.isArray(b.data)) out.push(...b.data);
    else if (b.data["@graph"] && Array.isArray(b.data["@graph"]))
      out.push(...b.data["@graph"]);
    else out.push(b.data);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function hasType(node: any, type: string): boolean {
  if (!node || typeof node !== "object") return false;
  const t = node["@type"];
  if (Array.isArray(t)) return t.includes(type);
  return t === type;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function findProduct(html: string): any | null {
  const flat = flattenGraphs(extractJsonLd(html));
  return flat.find((n) => hasType(n, "Product")) ?? null;
}
