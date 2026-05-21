export * from "./types.js";
import { robotsCheck } from "./robots.js";
import { sitemapCheck } from "./sitemap.js";
import { llmsTxtCheck } from "./llms-txt.js";
import { productJsonLdCheck } from "./product-jsonld.js";
import { productVariantsCheck } from "./product-variants.js";
import { ogTwitterCheck } from "./og-twitter.js";
import { cartPermalinkCheck } from "./cart-permalink.js";
import { checkoutHandoffCheck } from "./checkout-handoff.js";
import { hreflangCheck } from "./hreflang.js";
import { markdownNegoCheck } from "./markdown-nego.js";
import { ucpProfileCheck } from "./ucp-profile.js";
import { mcpCardCheck } from "./mcp-card.js";
import type { Check, CheckContext, CheckResult } from "./types.js";

export const allChecks: Check[] = [
  robotsCheck,
  sitemapCheck,
  llmsTxtCheck,
  productJsonLdCheck,
  productVariantsCheck,
  ogTwitterCheck,
  cartPermalinkCheck,
  checkoutHandoffCheck,
  hreflangCheck,
  markdownNegoCheck,
  ucpProfileCheck,
  mcpCardCheck,
];

export async function runCheck(check: Check, ctx: CheckContext): Promise<CheckResult> {
  const start = Date.now();
  try {
    const partial = await check.run(ctx);
    return {
      id: check.id,
      name: check.name,
      category: check.category,
      severity: check.severity,
      durationMs: Date.now() - start,
      ...partial,
    };
  } catch (err) {
    return {
      id: check.id,
      name: check.name,
      category: check.category,
      severity: check.severity,
      passed: false,
      score: 0,
      detail: `Check errored: ${(err as Error).message}`,
      durationMs: Date.now() - start,
    };
  }
}

export async function runAll(ctx: CheckContext): Promise<CheckResult[]> {
  return Promise.all(allChecks.map((c) => runCheck(c, ctx)));
}
