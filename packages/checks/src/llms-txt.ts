import type { Check } from "./types.js";

export const llmsTxtCheck: Check = {
  id: "llms-txt",
  name: "llms.txt manifest for agents",
  category: "content",
  severity: "nice-to-have",
  async run({ origin, fetch }) {
    const url = new URL("/llms.txt", origin).toString();
    const res = await fetch(url);
    if (!res.ok) {
      return {
        passed: false,
        score: 0,
        detail: "llms.txt not found.",
        fixHint: "Publish /llms.txt summarizing your store, key products, and policies — agents use this as a quick index.",
      };
    }
    const body = await res.text();
    return {
      passed: true,
      score: body.length > 200 ? 100 : 60,
      detail: `llms.txt present (${body.length} bytes).`,
      evidence: { sizeBytes: body.length },
    };
  },
};
