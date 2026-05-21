import type { Check, CheckContext } from "./types.js";
import { findLinkByRel, resolveHref } from "./util/links.js";

const MAX_PROFILE_BYTES = 200_000;
const WELL_KNOWN_PATH = "/.well-known/ucp";

interface UcpProfile {
  ucp_version?: unknown;
  store?: unknown;
  capabilities?: Array<{ mcp_endpoint?: unknown; type?: unknown }>;
  tools?: unknown;
}

async function fetchProfile(
  ctx: CheckContext,
  url: string,
): Promise<{ profile: UcpProfile; rawBytes: number } | { error: string }> {
  const res = await ctx.fetch(url).catch((e) => ({ error: String(e) }) as const);
  if ("error" in res) return { error: res.error };
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const text = await res.text();
  if (text.length > MAX_PROFILE_BYTES) {
    return { error: `profile too large (${text.length} bytes)` };
  }
  try {
    return { profile: JSON.parse(text) as UcpProfile, rawBytes: text.length };
  } catch {
    return { error: "invalid JSON" };
  }
}

export const ucpProfileCheck: Check = {
  id: "ucp-profile",
  name: "UCP profile discoverable",
  category: "commerce",
  severity: "critical",
  async run(ctx) {
    const homeRes = await ctx.fetch(ctx.origin).catch(() => null);
    let linkUrl: string | undefined;
    if (homeRes && homeRes.ok) {
      const html = await homeRes.text();
      const link = findLinkByRel(html, "agent-profile");
      if (link?.href) linkUrl = resolveHref(link.href, ctx.origin);
    }

    const candidates: { url: string; source: "link" | "well-known" }[] = [];
    if (linkUrl) candidates.push({ url: linkUrl, source: "link" });
    candidates.push({
      url: new URL(WELL_KNOWN_PATH, ctx.origin).toString(),
      source: "well-known",
    });

    let lastError: string | undefined;
    for (const c of candidates) {
      const result = await fetchProfile(ctx, c.url);
      if ("error" in result) {
        lastError = result.error;
        continue;
      }
      const { profile } = result;
      const hasVersion = typeof profile.ucp_version === "string";
      const capabilities = Array.isArray(profile.capabilities) ? profile.capabilities : [];
      const capabilityWithEndpoint = capabilities.find(
        (cap) => typeof cap?.mcp_endpoint === "string",
      );

      let score = 50;
      if (hasVersion) score += 20;
      if (capabilityWithEndpoint) score += 20;
      if (c.source === "link") score += 10;
      score = Math.min(score, 100);

      return {
        passed: score >= 60,
        score,
        detail: `UCP profile fetched from ${c.url} (${c.source}). version=${hasVersion}, capabilities=${capabilities.length}.`,
        evidence: {
          source: c.source,
          profileUrl: c.url,
          ucpVersion: profile.ucp_version,
          capabilityCount: capabilities.length,
          hasMcpEndpoint: Boolean(capabilityWithEndpoint),
        },
        fixHint:
          score < 100
            ? "Add a <link rel=\"agent-profile\" href=\"/.well-known/ucp\"> tag in your homepage <head> and ensure the profile lists at least one capability with an mcp_endpoint."
            : undefined,
      };
    }

    return {
      passed: false,
      score: 0,
      detail: `No UCP profile found. Last error: ${lastError ?? "no candidates resolved"}.`,
      evidence: { lastError, triedLink: Boolean(linkUrl) },
      fixHint:
        "Publish a UCP profile at /.well-known/ucp and link to it from your homepage with <link rel=\"agent-profile\" href=\"…\">.",
    };
  },
};
