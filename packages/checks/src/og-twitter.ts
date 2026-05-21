import type { Check } from "./types.js";
import { fetchPdp } from "./util/pdp.js";
import { metaByName } from "./util/meta.js";

const OG_FIELDS = ["og:title", "og:description", "og:image", "og:type"] as const;
const TWITTER_FIELDS = [
  "twitter:card",
  "twitter:title",
  "twitter:description",
  "twitter:image",
] as const;

export const ogTwitterCheck: Check = {
  id: "og-twitter",
  name: "Open Graph + Twitter card on PDP",
  category: "product-data",
  severity: "nice-to-have",
  async run(ctx) {
    const pdp = await fetchPdp(ctx);
    if (!pdp) {
      return {
        passed: false,
        score: 0,
        detail: "Couldn't sample a product page to inspect social meta tags.",
        fixHint:
          "Ensure your sitemap exposes product URLs so social/agent crawlers can find them.",
      };
    }

    const og = Object.fromEntries(
      OG_FIELDS.map((f) => [f, metaByName(pdp.html, f)]),
    ) as Record<(typeof OG_FIELDS)[number], string | undefined>;
    const tw = Object.fromEntries(
      TWITTER_FIELDS.map((f) => [f, metaByName(pdp.html, f)]),
    ) as Record<(typeof TWITTER_FIELDS)[number], string | undefined>;

    const ogPresent = OG_FIELDS.filter((f) => og[f]).length;
    const twPresent = TWITTER_FIELDS.filter((f) => tw[f]).length;

    const ogScore = Math.round((ogPresent / OG_FIELDS.length) * 60); // OG worth up to 60
    const twScore = Math.round((twPresent / TWITTER_FIELDS.length) * 40); // Twitter up to 40
    const score = ogScore + twScore;

    const missing: string[] = [];
    OG_FIELDS.forEach((f) => {
      if (!og[f]) missing.push(f);
    });
    TWITTER_FIELDS.forEach((f) => {
      if (!tw[f]) missing.push(f);
    });

    return {
      passed: score >= 60,
      score,
      detail: `Open Graph: ${ogPresent}/${OG_FIELDS.length}. Twitter: ${twPresent}/${TWITTER_FIELDS.length}.`,
      evidence: {
        sampledPdp: pdp.url,
        openGraph: og,
        twitter: tw,
      },
      fixHint:
        missing.length > 0
          ? `Add the missing meta tags: ${missing.join(", ")}.`
          : undefined,
    };
  },
};
