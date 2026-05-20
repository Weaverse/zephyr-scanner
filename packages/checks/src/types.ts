export type CheckCategory =
  | "discoverability"
  | "content"
  | "commerce"
  | "product-data"
  | "checkout";

export type CheckSeverity = "critical" | "important" | "nice-to-have";

export interface CheckResult {
  id: string;
  name: string;
  category: CheckCategory;
  severity: CheckSeverity;
  passed: boolean;
  score: number; // 0-100 for this check
  detail: string;
  evidence?: unknown;
  fixHint?: string;
  durationMs: number;
}

export interface CheckContext {
  url: string;
  origin: string;
  fetch: typeof fetch;
}

export interface Check {
  id: string;
  name: string;
  category: CheckCategory;
  severity: CheckSeverity;
  run(ctx: CheckContext): Promise<Omit<CheckResult, "id" | "name" | "category" | "severity" | "durationMs">>;
}
