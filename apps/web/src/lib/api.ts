export const API_BASE =
  import.meta.env.PUBLIC_API_BASE ?? "http://localhost:8787";

export type Grade = "A" | "B" | "C" | "D" | "F";
export type CheckSeverity = "critical" | "important" | "nice-to-have";
export type CheckCategory =
  | "discoverability"
  | "content"
  | "commerce"
  | "product-data"
  | "checkout";

export interface CheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  severity: CheckSeverity;
  passed: boolean;
  score: number;
  detail: string;
  evidence?: Record<string, unknown>;
  fixHint?: string | null;
  durationMs: number;
}

export interface CategoryScore {
  category: CheckCategory;
  score: number;
  passed: number;
  total: number;
}

export interface ScanScore {
  overall: number;
  grade: Grade;
  passed: number;
  total: number;
  categories: CategoryScore[];
}

export interface ScanMeta {
  apiVersion: string;
  checksCovered: number;
  checksTotal: number;
  limitedCoverage: boolean;
  cached: boolean;
  durationMs: number;
  disclaimer?: string;
}

export interface ScanResponse {
  id?: string;
  target: string;
  scannedAt: string;
  meta: ScanMeta;
  score: ScanScore;
  results: CheckResult[];
}

export interface LeaderboardEntry {
  rank: number;
  domain: string;
  score: number;
  grade: Grade;
  scannedAt: string;
}

export interface LeaderboardResponse {
  period: string;
  category: string | null;
  entries: LeaderboardEntry[];
}

export async function fetchScan(
  url: string,
  opts: { fresh?: boolean } = {},
): Promise<ScanResponse | { error: string }> {
  try {
    const params = new URLSearchParams({ url });
    if (opts.fresh) params.set("fresh", "true");
    const res = await fetch(`${API_BASE}/scan?${params.toString()}`);
    if (!res.ok) {
      return { error: `Scanner API returned HTTP ${res.status}.` };
    }
    return (await res.json()) as ScanResponse | { error: string };
  } catch (e) {
    return { error: `Scanner unreachable: ${(e as Error).message}` };
  }
}

export async function fetchLeaderboard(
  opts: { period?: string; category?: string; limit?: number } = {},
): Promise<LeaderboardResponse | { error: string }> {
  try {
    const params = new URLSearchParams();
    if (opts.period) params.set("period", opts.period);
    if (opts.category) params.set("category", opts.category);
    if (opts.limit) params.set("limit", String(opts.limit));
    const res = await fetch(`${API_BASE}/leaderboard?${params.toString()}`);
    if (!res.ok) {
      return { error: `Leaderboard API returned HTTP ${res.status}.` };
    }
    return (await res.json()) as LeaderboardResponse | { error: string };
  } catch (e) {
    return { error: `Leaderboard unreachable: ${(e as Error).message}` };
  }
}

export function gradeColor(grade: Grade): string {
  switch (grade) {
    case "A":
      return "text-grade-a";
    case "B":
      return "text-grade-b";
    case "C":
      return "text-grade-c";
    case "D":
      return "text-grade-d";
    case "F":
      return "text-grade-f";
  }
}

export function gradeBg(grade: Grade): string {
  switch (grade) {
    case "A":
      return "bg-grade-a";
    case "B":
      return "bg-grade-b";
    case "C":
      return "bg-grade-c";
    case "D":
      return "bg-grade-d";
    case "F":
      return "bg-grade-f";
  }
}

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  discoverability: "Discoverability",
  content: "Content",
  commerce: "Commerce",
  "product-data": "Product Data",
  checkout: "Checkout",
};
