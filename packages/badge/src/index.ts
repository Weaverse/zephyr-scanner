export type Grade = "A" | "B" | "C" | "D" | "F";

export interface BadgeInput {
  grade: Grade;
  score: number;
}

const GRADE_COLORS: Record<Grade, string> = {
  A: "#10b981",
  B: "#22c55e",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

export function renderBadge({ grade, score }: BadgeInput): string {
  const color = GRADE_COLORS[grade];
  const label = "zephyr";
  const value = `${grade} ${score}`;
  const labelWidth = 56;
  const valueWidth = 52;
  const totalWidth = labelWidth + valueWidth;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">`,
    `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`,
    `<mask id="m"><rect width="${totalWidth}" height="20" rx="3" fill="#fff"/></mask>`,
    `<g mask="url(#m)">`,
    `<rect width="${labelWidth}" height="20" fill="#333"/>`,
    `<rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>`,
    `<rect width="${totalWidth}" height="20" fill="url(#s)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${labelWidth / 2}" y="14">${label}</text>`,
    `<text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}
