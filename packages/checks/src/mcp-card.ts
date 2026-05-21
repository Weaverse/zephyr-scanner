import type { Check, CheckContext } from "./types.js";

const MAX_CARD_BYTES = 100_000;
const CANDIDATE_PATHS = [
  "/.well-known/mcp/server-card.json",
  "/.well-known/mcp-server-card.json",
];

interface McpCard {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  websiteUrl?: unknown;
  version?: unknown;
  remotes?: Array<{ url?: unknown; type?: unknown }>;
  capabilities?: Record<string, unknown>;
}

async function fetchCard(
  ctx: CheckContext,
  url: string,
): Promise<{ card: McpCard } | { error: string }> {
  const res = await ctx.fetch(url).catch((e) => ({ error: String(e) }) as const);
  if ("error" in res) return { error: res.error };
  if (!res.ok) return { error: `HTTP ${res.status}` };

  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.includes("application/json")) {
    return { error: `unexpected content-type: ${contentType || "missing"}` };
  }

  const text = await res.text();
  if (text.length > MAX_CARD_BYTES) {
    return { error: `card too large (${text.length} bytes)` };
  }
  try {
    return { card: JSON.parse(text) as McpCard };
  } catch {
    return { error: "invalid JSON" };
  }
}

export const mcpCardCheck: Check = {
  id: "mcp-card",
  name: "MCP server card discoverable",
  category: "commerce",
  severity: "critical",
  async run(ctx) {
    let lastError: string | undefined;
    for (const path of CANDIDATE_PATHS) {
      const url = new URL(path, ctx.origin).toString();
      const result = await fetchCard(ctx, url);
      if ("error" in result) {
        lastError = `${path}: ${result.error}`;
        continue;
      }
      const { card } = result;
      const hasName = typeof card.name === "string" && card.name.length > 0;
      const remotes = Array.isArray(card.remotes) ? card.remotes : [];
      const remoteWithUrl = remotes.find((r) => typeof r?.url === "string");
      const hasCapabilities =
        card.capabilities != null && typeof card.capabilities === "object";

      let score = 0;
      if (hasName && remoteWithUrl) score = 80;
      if (score === 80 && hasCapabilities) score = 100;
      if (score === 0 && (hasName || remoteWithUrl)) score = 50;

      return {
        passed: score >= 60,
        score,
        detail: `MCP server card fetched from ${url}. name=${hasName}, remotes=${remotes.length}, capabilities=${hasCapabilities}.`,
        evidence: {
          cardUrl: url,
          name: card.name,
          remoteCount: remotes.length,
          hasCapabilities,
        },
        fixHint:
          score < 100
            ? "Populate name, at least one remote with a transport URL, and a capabilities object (per SEP-2127)."
            : undefined,
      };
    }

    return {
      passed: false,
      score: 0,
      detail: `No MCP server card at any well-known path. Last error: ${lastError ?? "no candidates resolved"}.`,
      evidence: { lastError, triedPaths: CANDIDATE_PATHS },
      fixHint:
        "Publish a server card at /.well-known/mcp/server-card.json with name, remotes[], and capabilities. See SEP-2127.",
    };
  },
};
