import type { Check, CheckContext } from "./types.js";
import { findLinkByRel, resolveHref } from "./util/links.js";

const MAX_PROFILE_BYTES = 200_000;
const WELL_KNOWN_PATH = "/.well-known/ucp";

// UCP profiles in the wild have two shapes we recognize:
//   1. Shopify "real" shape   { ucp: { version, supported_versions, services, capabilities } }
//      — services entries with transport="mcp" carry the MCP endpoint URL.
//   2. Third-party flat shape { ucp_version, store, capabilities: [{ mcp_endpoint }], tools }
//      — observed in early non-Shopify UCP gateway implementations.
// We accept either.
interface UcpProfileRaw {
  // Shopify nested shape
  ucp?: {
    version?: unknown;
    supported_versions?: Record<string, unknown>;
    services?: Record<string, Array<{ transport?: unknown; endpoint?: unknown }>>;
    capabilities?: Record<string, unknown>;
  };
  // Flat (3rd-party) shape
  ucp_version?: unknown;
  capabilities?: Array<{ mcp_endpoint?: unknown }>;
}

interface ProfileSummary {
  version?: string;
  hasMcpEndpoint: boolean;
  capabilityCount: number;
  shape: "shopify" | "flat" | "unknown";
}

function summarize(profile: UcpProfileRaw): ProfileSummary {
  if (profile.ucp && typeof profile.ucp === "object") {
    const services = profile.ucp.services ?? {};
    let capabilityCount = 0;
    let hasMcpEndpoint = false;
    for (const entries of Object.values(services)) {
      if (Array.isArray(entries)) {
        capabilityCount += entries.length;
        if (
          entries.some(
            (e) => e?.transport === "mcp" && typeof e?.endpoint === "string",
          )
        ) {
          hasMcpEndpoint = true;
        }
      }
    }
    if (profile.ucp.capabilities && typeof profile.ucp.capabilities === "object") {
      capabilityCount += Object.keys(profile.ucp.capabilities).length;
    }
    return {
      version:
        typeof profile.ucp.version === "string" ? profile.ucp.version : undefined,
      hasMcpEndpoint,
      capabilityCount,
      shape: "shopify",
    };
  }

  if (typeof profile.ucp_version === "string" || Array.isArray(profile.capabilities)) {
    const caps = Array.isArray(profile.capabilities) ? profile.capabilities : [];
    return {
      version: typeof profile.ucp_version === "string" ? profile.ucp_version : undefined,
      hasMcpEndpoint: caps.some((c) => typeof c?.mcp_endpoint === "string"),
      capabilityCount: caps.length,
      shape: "flat",
    };
  }

  return { hasMcpEndpoint: false, capabilityCount: 0, shape: "unknown" };
}

async function fetchProfile(
  ctx: CheckContext,
  url: string,
): Promise<{ profile: UcpProfileRaw } | { error: string }> {
  const res = await ctx.fetch(url).catch((e) => ({ error: String(e) }) as const);
  if ("error" in res) return { error: res.error };
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const text = await res.text();
  if (text.length > MAX_PROFILE_BYTES) {
    return { error: `profile too large (${text.length} bytes)` };
  }
  try {
    return { profile: JSON.parse(text) as UcpProfileRaw };
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

      const summary = summarize(result.profile);
      if (summary.shape === "unknown") {
        // JSON parsed but doesn't look like any UCP shape we recognize.
        lastError = "JSON did not match a known UCP profile shape";
        continue;
      }

      let score = 50;
      if (summary.version) score += 20;
      if (summary.hasMcpEndpoint) score += 20;
      if (c.source === "link") score += 10;
      score = Math.min(score, 100);

      return {
        passed: score >= 60,
        score,
        detail: `UCP profile fetched from ${c.url} (${c.source}, ${summary.shape} shape). version=${summary.version ?? "missing"}, capabilities=${summary.capabilityCount}, mcp endpoint=${summary.hasMcpEndpoint}.`,
        evidence: {
          source: c.source,
          profileUrl: c.url,
          shape: summary.shape,
          version: summary.version,
          capabilityCount: summary.capabilityCount,
          hasMcpEndpoint: summary.hasMcpEndpoint,
        },
        fixHint:
          score < 100
            ? "Add a <link rel=\"agent-profile\" href=\"/.well-known/ucp\"> tag in your homepage <head> and ensure the profile carries a version + at least one service/capability with transport=\"mcp\"."
            : undefined,
      };
    }

    return {
      passed: false,
      score: 0,
      detail: `No UCP profile found. Last error: ${lastError ?? "no candidates resolved"}.`,
      evidence: { lastError, triedLink: Boolean(linkUrl) },
      fixHint:
        "Publish a UCP profile at /.well-known/ucp (Shopify stores get this automatically on Hydrogen/Online Store) and link to it from your homepage.",
    };
  },
};
