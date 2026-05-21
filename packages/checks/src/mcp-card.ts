import type { Check, CheckContext } from "./types.js";

const MAX_CARD_BYTES = 100_000;
const CANDIDATE_PATHS = [
  "/.well-known/mcp/server-card.json",
  "/.well-known/mcp-server-card.json",
];

interface McpCard {
  $schema?: unknown;
  name?: unknown;
  title?: unknown;
  description?: unknown;
  websiteUrl?: unknown;
  version?: unknown;
  repository?: unknown;
  remotes?: Array<{ url?: unknown; type?: unknown }>;
  // Optional declarative metadata — uncommon in practice; live cards like
  // developers.cloudflare.com expose only `remotes[]` and let clients
  // negotiate tools / resources / prompts over the MCP transport itself.
  capabilities?: Record<string, unknown>;
  tools?: unknown;
  resources?: unknown;
  prompts?: unknown;
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
      const hasVersion = typeof card.version === "string" && card.version.length > 0;
      const hasTitle = typeof card.title === "string" && card.title.length > 0;
      const hasSchema = typeof card.$schema === "string";

      // Scoring prioritises the load-bearing fields: a card without a
      // `name` + at least one remote-with-url is unusable. Bonus points for
      // `version` (lets clients pin and detect upgrades) and `title` (shown
      // to humans in client UIs).
      let score = 0;
      if (hasName && remoteWithUrl) {
        score = 80;
        if (hasVersion && hasTitle) score = 100;
        else if (hasVersion || hasTitle) score = 90;
      } else if (hasName || remoteWithUrl) {
        score = 50;
      }

      const missing: string[] = [];
      if (!hasName) missing.push("name");
      if (!remoteWithUrl) missing.push("remotes[].url");
      if (!hasVersion) missing.push("version");
      if (!hasTitle) missing.push("title");

      return {
        passed: score >= 60,
        score,
        detail: `MCP server card fetched from ${url}. name=${hasName}, remotes=${remotes.length}, version=${hasVersion}, title=${hasTitle}.`,
        evidence: {
          cardUrl: url,
          name: card.name,
          remoteCount: remotes.length,
          hasVersion,
          hasTitle,
          hasSchema,
        },
        fixHint:
          missing.length > 0
            ? `Populate the missing fields: ${missing.join(", ")} (per SEP-2127).`
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
