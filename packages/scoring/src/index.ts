import type { CheckResult, CheckCategory, CheckSeverity } from "@zephyr/checks";

const severityWeight: Record<CheckSeverity, number> = {
  critical: 3,
  important: 2,
  "nice-to-have": 1,
};

export interface CategoryScore {
  category: CheckCategory;
  score: number;
  passed: number;
  total: number;
}

export interface ScanScore {
  overall: number;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: CategoryScore[];
  passed: number;
  total: number;
}

export function scoreResults(results: CheckResult[]): ScanScore {
  let weightedSum = 0;
  let weightTotal = 0;
  const byCat = new Map<CheckCategory, { sum: number; weight: number; passed: number; total: number }>();

  for (const r of results) {
    const w = severityWeight[r.severity];
    weightedSum += r.score * w;
    weightTotal += 100 * w;
    const cat = byCat.get(r.category) ?? { sum: 0, weight: 0, passed: 0, total: 0 };
    cat.sum += r.score * w;
    cat.weight += 100 * w;
    cat.total += 1;
    if (r.passed) cat.passed += 1;
    byCat.set(r.category, cat);
  }

  const overall = weightTotal === 0 ? 0 : Math.round((weightedSum / weightTotal) * 100);
  const grade = overall >= 90 ? "A" : overall >= 75 ? "B" : overall >= 60 ? "C" : overall >= 40 ? "D" : "F";

  return {
    overall,
    grade,
    passed: results.filter((r) => r.passed).length,
    total: results.length,
    categories: [...byCat.entries()].map(([category, v]) => ({
      category,
      score: v.weight === 0 ? 0 : Math.round((v.sum / v.weight) * 100),
      passed: v.passed,
      total: v.total,
    })),
  };
}
