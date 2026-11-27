import { describe, expect, it } from "vitest";
import { countFillers, countWords, deliveryMetrics, thinkingSeconds, wordsPerMinute } from "./delivery";

describe("countWords", () => {
  it("ignores stray punctuation and extra spaces", () => {
    expect(countWords("  An LRU cache  —  evicts the oldest key. ")).toBe(7);
    expect(countWords("")).toBe(0);
  });

  it("counts numbers and contractions as one word each", () => {
    expect(countWords("It's O(1) at p99")).toBe(4);
  });
});

describe("wordsPerMinute", () => {
  it("scales the word count to a minute", () => {
    expect(wordsPerMinute("one two three four five six seven eight nine ten", 4)).toBe(150);
  });

  it("is 0 for no time used", () => {
    expect(wordsPerMinute("hello", 0)).toBe(0);
  });
});

describe("countFillers", () => {
  it("counts um and uh variants", () => {
    const f = countFillers("Um, so the, uh, cache. Umm, uhh, erm.");
    expect(f.um).toBe(3);
    expect(f.uh).toBe(2);
  });

  it("does not count words that merely contain um or uh", () => {
    expect(countFillers("The umbrella number was huh, sum, drum.").total).toBe(0);
  });

  it("counts like only when it is set off by pauses", () => {
    expect(countFillers("It was, like, really slow.").like).toBe(1);
    expect(countFillers("Like, I think the key is hashed.").like).toBe(1);
    expect(countFillers("It was — like — a mess.").like).toBe(1);
    expect(countFillers("I'd like to add a queue. It looks like a tree.").like).toBe(0);
    expect(countFillers("It's like a hash map.").like).toBe(0);
  });

  it("counts back-to-back likes separately", () => {
    expect(countFillers("So, like, like, we cached it.").like).toBe(2);
  });

  it("counts you know anywhere", () => {
    expect(countFillers("You know, the index, you know, was missing.").youKnow).toBe(2);
  });

  it("totals all kinds", () => {
    const f = countFillers("Um, so, like, you know, it, uh, worked.");
    expect(f).toEqual({ um: 1, uh: 1, like: 1, youKnow: 1, total: 4 });
  });
});

describe("thinkingSeconds", () => {
  it("is the rounded gap before Record", () => {
    expect(thinkingSeconds(1_000, 8_400)).toBe(7);
  });

  it("is never negative", () => {
    expect(thinkingSeconds(5_000, 4_000)).toBe(0);
  });
});

describe("deliveryMetrics", () => {
  it("combines everything for one answer", () => {
    const m = deliveryMetrics({
      transcript: "Um, an LRU cache evicts the least recently used key.",
      secondsUsed: 66,
      targetSeconds: 60,
      shownAt: 0,
      recordStartedAt: 12_000,
    });
    expect(m.wordCount).toBe(10);
    expect(m.wordsPerMinute).toBe(9);
    expect(m.fillers.total).toBe(1);
    expect(m.thinkingSeconds).toBe(12);
    expect(m.percentOfTarget).toBe(110);
  });
});
