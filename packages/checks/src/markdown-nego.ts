import type { Check } from "./types.js";

export const markdownNegoCheck: Check = {
  id: "markdown-nego",
  name: "Markdown content negotiation on homepage",
  category: "content",
  severity: "nice-to-have",
  async run({ origin, fetch }) {
    const res = await fetch(origin, {
      headers: { Accept: "text/markdown" },
    }).catch(() => null);

    if (!res) {
      return {
        passed: false,
        score: 0,
        detail: "Homepage fetch with Accept: text/markdown failed.",
        fixHint:
          "Make the homepage reachable, then add a Markdown variant that responds when agents send Accept: text/markdown.",
      };
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType.includes("text/markdown")) {
      return {
        passed: true,
        score: 100,
        detail: `Server honors Accept: text/markdown (Content-Type: ${contentType}).`,
        evidence: { contentType, status: res.status },
      };
    }

    return {
      passed: false,
      score: 0,
      detail: `Server returned ${contentType || "no content-type"} despite Accept: text/markdown.`,
      evidence: { contentType, status: res.status },
      fixHint:
        "Offer a Markdown variant of key pages — agents prefer Markdown over HTML when reading and summarizing pages.",
    };
  },
};
