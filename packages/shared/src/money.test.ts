import { describe, expect, it } from "vitest";
import { elapsedMinutes, estimatedCostUsd, estimatedMinutesAvoided } from "./money.js";

describe("savings helpers", () => {
  it("clamps avoided minutes at zero", () => {
    expect(estimatedMinutesAvoided(25, 30)).toBe(0);
    expect(estimatedMinutesAvoided(25, 10)).toBe(15);
  });

  it("prices Linux 2-core minutes", () => {
    expect(estimatedCostUsd(10, 0.006)).toBe(0.06);
  });

  it("treats missing start as zero elapsed", () => {
    expect(elapsedMinutes(null, new Date())).toBe(0);
  });
});
