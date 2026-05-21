import { describe, expect, it } from "vitest";
import { renderBadge } from "../src/index.js";

describe("renderBadge", () => {
  it("renders an SVG with the grade and score in the value half", () => {
    const svg = renderBadge({ grade: "A", score: 92 });
    expect(svg).toContain("<svg");
    expect(svg).toContain("A 92");
    expect(svg).toContain("zephyr");
  });

  it("uses an emerald fill for A", () => {
    const svg = renderBadge({ grade: "A", score: 90 });
    expect(svg).toContain("#10b981");
  });

  it("uses a red fill for F", () => {
    const svg = renderBadge({ grade: "F", score: 12 });
    expect(svg).toContain("#ef4444");
  });
});
