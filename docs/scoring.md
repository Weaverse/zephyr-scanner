# Scoring Rubric — Zephyr Scanner

## Severity weights

| Severity | Weight | Meaning |
|---|---|---|
| `critical` | **3** | Agents can't transact without this. (e.g. UCP profile, MCP card, Product JSON-LD) |
| `important` | **2** | Strongly limits agent functionality. (e.g. robots.txt rules, sitemap, cart permalinks) |
| `nice-to-have` | **1** | Polish + future-proofing. (e.g. llms.txt, OG cards, hreflang, x402) |

## Per-check scoring

Each check returns a **0-100** score, not just pass/fail. This lets us reward partial implementations (e.g. robots.txt present but missing 2 of 5 AI bot rules → 60).

Pattern:
```ts
function score(): number {
  // 0   = absent / broken
  // 50  = present but incomplete
  // 80  = present + correct, missing optional fields
  // 100 = full compliance
}
```

`passed` is derived: `score >= threshold`, where threshold defaults to 60.

## Overall formula

```
weightedSum  = Σ (check.score × severityWeight[check.severity])
maxPossible  = Σ (100 × severityWeight[check.severity])
overall      = round((weightedSum / maxPossible) × 100)
```

## Category sub-scores

Same formula scoped to each category. Each category's sub-score is independent — a store can score 100 in `product-data` and 0 in `commerce`.

| Category | Checks in category | Max weighted score |
|---|---|---|
| discoverability | #1, #2, #14 | 2+2+1 = 5 → 500 |
| content | #3, #12 | 1+1 = 2 → 200 |
| commerce | #4, #5, #6, #7, #15 | 3+3+2+1+1 = 10 → 1000 |
| product-data | #8, #9, #13 | 3+2+1 = 6 → 600 |
| checkout | #10, #11 | 2+2 = 4 → 400 |

## Grade thresholds

| Overall | Grade | Color (UI) |
|---|---|---|
| 90-100 | A | emerald |
| 75-89 | B | green |
| 60-74 | C | yellow |
| 40-59 | D | orange |
| 0-39 | F | red |

## Tie-breakers (leaderboard)

When scores are equal, rank by:
1. Highest `commerce` sub-score
2. Most recent scan timestamp

## Coverage warning

If a check fails to run (timeout, error), it contributes **0** to weighted sum and **0** to max possible (i.e., excluded from denominator). Surfaced in API response as `result.detail: "Check errored: ..."`.

If <10 of 15 checks are live (v0.x), `meta.limitedCoverage: true` and the UI shows a banner.

## Rationale

- **Weights chosen so commerce > product-data > checkout > discoverability > content.** Commerce protocols are the wedge; if a store fails UCP+MCP, the score should tank regardless of how good its OG cards are.
- **Per-check granularity (0-100, not boolean)** because real-world stores are rarely all-or-nothing. Reward partial wins.
- **A-F grades** because consumers parse letter grades faster than 0-100. Twitter shares will say "A" not "92".
