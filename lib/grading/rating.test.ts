import { describe, expect, it } from "vitest";
import { type BulletMark, type BulletStatus, coverage, isOverTarget, rate } from "./rating";

// Builds bullets from a compact spec: "H" hit, "P" partial, "M" missed; lowercase = core.
function marks(spec: string): BulletMark[] {
  const status: Record<string, BulletStatus> = { h: "hit", p: "partial", m: "missed" };
  return [...spec].map((c) => ({
    status: status[c.toLowerCase()]!,
    core: c === c.toLowerCase(),
  }));
}

describe("coverage", () => {
  it("counts a partial as half a hit", () => {
    expect(coverage(marks("HHPM"))).toBe(2.5 / 4);
  });

  it("is 0 for all missed and 1 for all hit", () => {
    expect(coverage(marks("MMM"))).toBe(0);
    expect(coverage(marks("HHH"))).toBe(1);
  });

  it("rejects a card with no bullets", () => {
    expect(() => coverage([])).toThrow();
  });
});

describe("rate: the plan's example table", () => {
  it("95%, 1:24 on a 1:00 target: Easy, penalised to Good", () => {
    // 19 of 20 half points = 95%
    const r = rate({ bullets: marks("hHHHHHHHHP"), secondsUsed: 84, targetSeconds: 60 });
    expect(r.coverage).toBe(0.95);
    expect([r.base, r.afterCap, r.rating]).toEqual(["easy", "easy", "good"]);
  });

  it("95%, 1:05 on a 1:00 target is within grace: Easy", () => {
    const r = rate({ bullets: marks("hHHHHHHHHP"), secondsUsed: 65, targetSeconds: 60 });
    expect(r.coverage).toBe(0.95);
    expect(r.rating).toBe("easy");
    expect(r.overTarget).toBe(false);
  });

  it("80% with a core bullet missed: capped at Hard", () => {
    const r = rate({ bullets: marks("mHHHH"), secondsUsed: 50, targetSeconds: 60 });
    expect(r.coverage).toBe(0.8);
    expect([r.base, r.afterCap, r.rating]).toEqual(["good", "hard", "hard"]);
  });

  it("80%, core missed, over target: cap and penalty stack to Again", () => {
    const r = rate({ bullets: marks("mHHHH"), secondsUsed: 80, targetSeconds: 60 });
    expect([r.base, r.afterCap, r.rating]).toEqual(["good", "hard", "again"]);
  });

  it("30% with a core bullet missed stays Again (the cap never raises)", () => {
    // 3 of 10 half points = 30%
    const r = rate({ bullets: marks("mHPMM"), secondsUsed: 50, targetSeconds: 60 });
    expect(r.coverage).toBe(0.3);
    expect([r.base, r.afterCap, r.rating]).toEqual(["again", "again", "again"]);
  });
});

describe("rate: threshold edges", () => {
  const onTime = { secondsUsed: 30, targetSeconds: 60 };

  it("exactly 90% is Easy, just under is Good", () => {
    expect(rate({ bullets: marks("HHHHHHHHHM"), ...onTime }).rating).toBe("easy");
    expect(rate({ bullets: marks("HHHHHHHHPM"), ...onTime }).rating).toBe("good"); // 85%
  });

  it("exactly 75% is Good", () => {
    expect(rate({ bullets: marks("HHHM"), ...onTime }).rating).toBe("good");
  });

  it("exactly 50% is Hard, just under is Again", () => {
    expect(rate({ bullets: marks("HHMM"), ...onTime }).rating).toBe("hard");
    expect(rate({ bullets: marks("HHPMMM"), ...onTime }).rating).toBe("again"); // 41.7%
  });

  it("a partial core bullet does not trigger the cap", () => {
    const r = rate({ bullets: marks("pHHHHHHHHH"), ...onTime });
    expect(r.coreMissed).toBe(false);
    expect(r.rating).toBe("easy");
  });

  it("a card with no core bullets is never capped", () => {
    expect(rate({ bullets: marks("HHHH"), ...onTime }).coreMissed).toBe(false);
  });

  it("penalty never goes below Again", () => {
    expect(rate({ bullets: marks("MMMM"), secondsUsed: 999, targetSeconds: 60 }).rating).toBe("again");
  });

  it("uses custom thresholds from config", () => {
    const strict = { easyMinPct: 100, goodMinPct: 90, hardMinPct: 60, overTargetGracePct: 0 };
    expect(rate({ bullets: marks("HHHHHHHHHM"), ...onTime }, strict).rating).toBe("good");
    expect(rate({ bullets: marks("HHHH"), secondsUsed: 61, targetSeconds: 60 }, strict).rating).toBe("good");
  });
});

describe("isOverTarget", () => {
  it("exactly 110% is within grace, anything more is over", () => {
    expect(isOverTarget(66, 60, 10)).toBe(false);
    expect(isOverTarget(66.1, 60, 10)).toBe(true);
    expect(isOverTarget(132, 120, 10)).toBe(false);
    expect(isOverTarget(198, 180, 10)).toBe(false);
    expect(isOverTarget(199, 180, 10)).toBe(true);
  });
});
