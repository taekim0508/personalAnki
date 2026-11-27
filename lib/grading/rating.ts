// Turns the grader's per-bullet marks into a suggested rating.
// Order (see docs/plans/interview-srs-mvp.md, "Rating"):
//   1. coverage  2. base rating from thresholds  3. core-bullet cap  4. over-target penalty

export type BulletStatus = "hit" | "partial" | "missed";
export type Rating = "again" | "hard" | "good" | "easy";

export const RATINGS: readonly Rating[] = ["again", "hard", "good", "easy"];

export interface BulletMark {
  status: BulletStatus;
  core: boolean;
}

/** Whole-number percents, so comparisons are exact (no floating point surprises). */
export interface RatingConfig {
  easyMinPct: number;
  goodMinPct: number;
  hardMinPct: number;
  /** Time allowed over targetSeconds before the penalty applies. */
  overTargetGracePct: number;
}

export const DEFAULT_RATING_CONFIG: RatingConfig = {
  easyMinPct: 90,
  goodMinPct: 75,
  hardMinPct: 50,
  overTargetGracePct: 10,
};

export interface RatingInput {
  bullets: BulletMark[];
  secondsUsed: number;
  targetSeconds: number;
}

export interface RatingResult {
  /** 0 to 1. */
  coverage: number;
  base: Rating;
  afterCap: Rating;
  rating: Rating;
  coreMissed: boolean;
  overTarget: boolean;
}

// Coverage in half points: a hit is 2, a partial is 1, out of 2 per bullet.
function halfPoints(bullets: BulletMark[]): number {
  return bullets.reduce(
    (sum, b) => sum + (b.status === "hit" ? 2 : b.status === "partial" ? 1 : 0),
    0,
  );
}

export function coverage(bullets: BulletMark[]): number {
  if (bullets.length === 0) throw new Error("A card needs at least one bullet");
  return halfPoints(bullets) / (2 * bullets.length);
}

function baseRating(bullets: BulletMark[], config: RatingConfig): Rating {
  // coverage >= pct/100  <=>  halfPoints * 100 >= pct * 2n, all integers.
  const scaled = halfPoints(bullets) * 100;
  const max = 2 * bullets.length;
  if (scaled >= config.easyMinPct * max) return "easy";
  if (scaled >= config.goodMinPct * max) return "good";
  if (scaled >= config.hardMinPct * max) return "hard";
  return "again";
}

function lower(rating: Rating): Rating {
  return RATINGS[Math.max(0, RATINGS.indexOf(rating) - 1)]!;
}

function atMost(rating: Rating, ceiling: Rating): Rating {
  return RATINGS.indexOf(rating) > RATINGS.indexOf(ceiling) ? ceiling : rating;
}

export function isOverTarget(
  secondsUsed: number,
  targetSeconds: number,
  gracePct: number,
): boolean {
  // secondsUsed > targetSeconds * (1 + grace), written to avoid 60 * 1.1 = 66.00000000000001.
  return secondsUsed * 100 > targetSeconds * (100 + gracePct);
}

export function rate(
  input: RatingInput,
  config: RatingConfig = DEFAULT_RATING_CONFIG,
): RatingResult {
  const { bullets, secondsUsed, targetSeconds } = input;
  const cov = coverage(bullets);
  const base = baseRating(bullets, config);

  const coreMissed = bullets.some((b) => b.core && b.status === "missed");
  const afterCap = coreMissed ? atMost(base, "hard") : base;

  const overTarget = isOverTarget(secondsUsed, targetSeconds, config.overTargetGracePct);
  const rating = overTarget ? lower(afterCap) : afterCap;

  return { coverage: cov, base, afterCap, rating, coreMissed, overTarget };
}
