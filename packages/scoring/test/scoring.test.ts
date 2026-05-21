import { describe, expect, it } from "vitest";
import type { CheckResult } from "@zephyr/checks";
import { scoreResults } from "../src/index.js";

const result = (
  partial: Partial<CheckResult> &
    Pick<CheckResult, "passed" | "score" | "severity" | "category">,
): CheckResult => ({
  id: partial.id ?? "test",
  name: partial.name ?? "test",
  detail: partial.detail ?? "",
  durationMs: partial.durationMs ?? 1,
  ...partial,
});

describe("scoreResults", () => {
  it("weights critical 3x nice-to-have", () => {
    const score = scoreResults([
      result({ severity: "critical", category: "commerce", passed: true, score: 100 }),
      result({ severity: "nice-to-have", category: "content", passed: false, score: 0 }),
    ]);
    expect(score.overall).toBe(75);
  });

  it("returns F for zero results", () => {
    const score = scoreResults([]);
    expect(score.grade).toBe("F");
    expect(score.overall).toBe(0);
  });

  it("returns A at 90+", () => {
    const score = scoreResults([
      result({ severity: "critical", category: "commerce", passed: true, score: 95 }),
    ]);
    expect(score.grade).toBe("A");
    expect(score.overall).toBe(95);
  });

  it("computes per-category sub-scores independently", () => {
    const score = scoreResults([
      result({ severity: "critical", category: "commerce", passed: true, score: 100 }),
      result({ severity: "critical", category: "checkout", passed: false, score: 0 }),
    ]);
    const commerce = score.categories.find((c) => c.category === "commerce");
    const checkout = score.categories.find((c) => c.category === "checkout");
    expect(commerce?.score).toBe(100);
    expect(checkout?.score).toBe(0);
  });

  it("counts passed vs total correctly", () => {
    const score = scoreResults([
      result({ severity: "important", category: "discoverability", passed: true, score: 80 }),
      result({ severity: "important", category: "discoverability", passed: false, score: 30 }),
    ]);
    expect(score.passed).toBe(1);
    expect(score.total).toBe(2);
  });
});
