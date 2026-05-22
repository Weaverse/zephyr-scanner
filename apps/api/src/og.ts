import type { Grade } from "@zephyr/badge";

const GRADE_COLORS: Record<Grade, { fill: string; text: string }> = {
  A: { fill: "#065f46", text: "#10b981" },
  B: { fill: "#166534", text: "#22c55e" },
  C: { fill: "#854d0e", text: "#eab308" },
  D: { fill: "#9a3412", text: "#f97316" },
  F: { fill: "#991b1b", text: "#ef4444" },
};

export interface OgInput {
  domain: string;
  score: number;
  grade: Grade;
  scannedAt: string;
  categories?: Array<{ category: string; score: number }>;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function categoryLabel(c: string): string {
  switch (c) {
    case "discoverability":
      return "Discoverability";
    case "content":
      return "Content";
    case "commerce":
      return "Commerce";
    case "product-data":
      return "Product Data";
    case "checkout":
      return "Checkout";
    default:
      return c;
  }
}

export interface LeaderboardOgEntry {
  rank: number;
  domain: string;
  score: number;
  grade: Grade;
}

/**
 * OG card for the public leaderboard. Renders the top ~8 ranked stores so the
 * social preview is the ranking itself — that's the shareable hook.
 */
export function renderLeaderboardOgSvg(entries: LeaderboardOgEntry[]): string {
  const top = entries.slice(0, 8);

  const rows = top
    .map((e, i) => {
      const y = 232 + i * 44;
      const color = GRADE_COLORS[e.grade].text;
      return `
    <text x="80" y="${y}" font-family="ui-monospace, monospace" font-size="26" fill="#7dd3fc" font-weight="700">#${e.rank}</text>
    <text x="150" y="${y}" font-family="Inter, system-ui, sans-serif" font-size="26" fill="white" font-weight="500">${xmlEscape(e.domain)}</text>
    <text x="1120" y="${y}" font-family="ui-monospace, monospace" font-size="26" fill="${color}" font-weight="700" text-anchor="end">${e.grade}  ${e.score}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c4a6e" />
      <stop offset="1" stop-color="#082f49" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />

  <text x="80" y="100" font-family="ui-monospace, SFMono-Regular, monospace" font-size="32" font-weight="700" fill="#bae6fd">Agent Ready</text>
  <text x="80" y="160" font-family="Inter, system-ui, sans-serif" font-size="48" font-weight="800" fill="white">Agent-readiness leaderboard</text>
  <text x="80" y="196" font-family="Inter, system-ui, sans-serif" font-size="22" fill="#bae6fd" opacity="0.75">How ready are top commerce stores for AI agents?</text>

  ${rows}

  <text x="80" y="600" font-family="ui-monospace, monospace" font-size="20" fill="#bae6fd" opacity="0.6">isyourstoreagentready.com/leaderboard</text>
  <text x="1120" y="600" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#bae6fd" opacity="0.6" text-anchor="end">powered by weaverse.io</text>
</svg>`;
}

export function renderOgSvg(input: OgInput): string {
  const { domain, score, grade, scannedAt, categories = [] } = input;
  const colors = GRADE_COLORS[grade];
  const scannedDate = new Date(scannedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Sort categories in our display order, then take all of them
  const order = ["commerce", "product-data", "checkout", "discoverability", "content"];
  const sorted = [...categories].sort(
    (a, b) => order.indexOf(a.category) - order.indexOf(b.category),
  );

  const catRows = sorted
    .map((c, i) => {
      const y = 416 + i * 36;
      const barX = 360;
      const barWidth = 640;
      const filled = (c.score / 100) * barWidth;
      return `
    <text x="80" y="${y + 24}" font-family="Inter, system-ui, sans-serif" font-size="22" fill="#e0f2fe" font-weight="500">${xmlEscape(categoryLabel(c.category))}</text>
    <rect x="${barX}" y="${y + 8}" width="${barWidth}" height="20" rx="10" fill="rgba(255,255,255,0.12)" />
    <rect x="${barX}" y="${y + 8}" width="${filled}" height="20" rx="10" fill="${colors.text}" />
    <text x="${barX + barWidth + 16}" y="${y + 24}" font-family="ui-monospace, monospace" font-size="20" fill="#e0f2fe" font-weight="600">${c.score}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0c4a6e" />
      <stop offset="1" stop-color="${colors.fill}" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />

  <!-- Brand -->
  <text x="80" y="100" font-family="ui-monospace, SFMono-Regular, monospace" font-size="32" font-weight="700" fill="#bae6fd">Agent Ready</text>
  <text x="80" y="138" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#bae6fd" opacity="0.7">Agent readiness scan</text>

  <!-- Domain -->
  <text x="80" y="208" font-family="Inter, system-ui, sans-serif" font-size="44" font-weight="700" fill="white">${xmlEscape(domain)}</text>
  <text x="80" y="244" font-family="Inter, system-ui, sans-serif" font-size="20" fill="#bae6fd" opacity="0.7">Scanned ${xmlEscape(scannedDate)}</text>

  <!-- Score -->
  <text x="80" y="372" font-family="Inter, system-ui, sans-serif" font-size="132" font-weight="800" fill="white" letter-spacing="-4">${score}</text>
  <text x="${80 + (score >= 100 ? 250 : score >= 10 ? 180 : 100)}" y="372" font-family="ui-monospace, monospace" font-size="96" font-weight="800" fill="${colors.text}">${grade}</text>

  <!-- Category bars -->
  ${catRows}

  <!-- Footer -->
  <text x="80" y="612" font-family="ui-monospace, monospace" font-size="20" fill="#bae6fd" opacity="0.6">isyourstoreagentready.com/scan/${xmlEscape(domain)}</text>
  <text x="1120" y="612" font-family="Inter, system-ui, sans-serif" font-size="18" fill="#bae6fd" opacity="0.6" text-anchor="end">powered by weaverse.io</text>
</svg>`;
}
