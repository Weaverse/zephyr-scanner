import type { Check } from "./types.js";
import { metaByName } from "./util/meta.js";

const SCRIPT_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const SCRIPT_SRC_RE = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

const WEBMCP_KEYWORDS = [
  "navigator.modelContext",
  "window.modelContext",
  "webmcp",
  "registerTool",
];

export const webmcpOrTrustedAgentCheck: Check = {
  id: "webmcp-or-trusted-agent",
  name: "WebMCP opt-in or trusted-agent eligibility",
  category: "commerce",
  severity: "nice-to-have",
  async run(ctx) {
    const res = await ctx.fetch(ctx.origin).catch(() => null);
    if (!res || !res.ok) {
      return {
        passed: false,
        score: 0,
        detail: "Homepage unreachable.",
        fixHint:
          "Make your homepage reachable, then opt into WebMCP via <script> or advertise via WebMCP-Available header.",
      };
    }

    const headerSignal = res.headers.get("webmcp-available")?.toLowerCase() === "true";
    const html = await res.text();
    const metaSignal = metaByName(html, "webmcp") != null;

    let scriptSrcSignal = false;
    for (const m of html.matchAll(SCRIPT_SRC_RE)) {
      const src = m[1] ?? "";
      if (/webmcp/i.test(src)) {
        scriptSrcSignal = true;
        break;
      }
    }

    let inlineRegisterSignal = false;
    let inlineMentionSignal = false;
    for (const m of html.matchAll(SCRIPT_RE)) {
      const body = m[1] ?? "";
      if (/registerTool\s*\(/.test(body) || /navigator\.modelContext/.test(body)) {
        inlineRegisterSignal = true;
        break;
      }
      if (WEBMCP_KEYWORDS.some((k) => body.includes(k))) {
        inlineMentionSignal = true;
      }
    }

    const strongSignals = [headerSignal, metaSignal, scriptSrcSignal, inlineRegisterSignal]
      .filter(Boolean).length;

    let score = 0;
    if (strongSignals >= 2) score = 100;
    else if (strongSignals === 1) score = 80;
    else if (inlineMentionSignal) score = 50;

    return {
      passed: score >= 60,
      score,
      detail: `WebMCP signals — header:${headerSignal}, meta:${metaSignal}, script-src:${scriptSrcSignal}, inline-register:${inlineRegisterSignal}, inline-mention:${inlineMentionSignal}.`,
      evidence: {
        headerSignal,
        metaSignal,
        scriptSrcSignal,
        inlineRegisterSignal,
        inlineMentionSignal,
      },
      fixHint:
        score < 60
          ? "Opt into WebMCP: register tools with navigator.modelContext.registerTool(...) in an inline <script>, or set the WebMCP-Available: true response header."
          : undefined,
    };
  },
};
