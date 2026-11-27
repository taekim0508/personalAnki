// Delivery metrics shown with each graded answer. Shown only, never part of the rating.

export interface FillerCounts {
  um: number;
  uh: number;
  like: number;
  youKnow: number;
  total: number;
}

export interface DeliveryInput {
  transcript: string;
  secondsUsed: number;
  targetSeconds: number;
  /** When the question appeared (ms since epoch). */
  shownAt: number;
  /** When Record was pressed (ms since epoch). */
  recordStartedAt: number;
}

export interface DeliveryMetrics {
  wordCount: number;
  wordsPerMinute: number;
  fillers: FillerCounts;
  thinkingSeconds: number;
  /** secondsUsed as a whole-number percent of targetSeconds. */
  percentOfTarget: number;
}

export function countWords(transcript: string): number {
  return transcript.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

export function wordsPerMinute(transcript: string, secondsUsed: number): number {
  if (secondsUsed <= 0) return 0;
  return Math.round((countWords(transcript) * 60) / secondsUsed);
}

// "like" counts only when set off by pauses: "it was, like, slow" or "Like, I think".
// That skips "I'd like to" and "looks like". A pause is the start of the transcript,
// punctuation, an ellipsis or a dash.
const PAUSE_BEFORE = String.raw`(?:^|[,.;:?!…—–-])\s*`;
const PAUSE_AFTER = String.raw`\s*(?:[,;:…—–-]|\.\.\.)`;

const PATTERNS: Record<Exclude<keyof FillerCounts, "total">, RegExp> = {
  um: /\b(?:um+|uhm+|erm+)\b/gi,
  uh: /\b(?:uh+|er+)\b/gi,
  like: new RegExp(`${PAUSE_BEFORE}like${PAUSE_AFTER}`, "gi"),
  // Always counted, so "if you know the key" is a false positive. The eval compares
  // these counts with hand counts and will show whether that matters.
  youKnow: /\byou know\b/gi,
};

export function countFillers(transcript: string): FillerCounts {
  const count = (re: RegExp) => transcript.match(re)?.length ?? 0;
  const um = count(PATTERNS.um);
  const uh = count(PATTERNS.uh);
  // Matches can share a comma ("like, like,"), so count overlapping hits one at a time.
  let like = 0;
  const likeRe = new RegExp(PATTERNS.like.source, "giy");
  for (let i = 0; i < transcript.length; i++) {
    likeRe.lastIndex = i;
    const m = likeRe.exec(transcript);
    if (m) {
      like++;
      i = m.index + m[0].replace(/[,;:…—–.\s-]+$/, "").length - 1;
    }
  }
  const youKnow = count(PATTERNS.youKnow);
  return { um, uh, like, youKnow, total: um + uh + like + youKnow };
}

export function thinkingSeconds(shownAt: number, recordStartedAt: number): number {
  return Math.max(0, Math.round((recordStartedAt - shownAt) / 1000));
}

export function deliveryMetrics(input: DeliveryInput): DeliveryMetrics {
  const { transcript, secondsUsed, targetSeconds } = input;
  return {
    wordCount: countWords(transcript),
    wordsPerMinute: wordsPerMinute(transcript, secondsUsed),
    fillers: countFillers(transcript),
    thinkingSeconds: thinkingSeconds(input.shownAt, input.recordStartedAt),
    percentOfTarget: targetSeconds > 0 ? Math.round((secondsUsed / targetSeconds) * 100) : 0,
  };
}
