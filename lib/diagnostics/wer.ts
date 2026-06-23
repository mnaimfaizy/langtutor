export interface WerAlignment {
  ref: string | null;
  hyp: string | null;
  type: "correct" | "substitution" | "deletion" | "insertion";
}

export interface WerResult {
  /** Fraction of reference words that are wrong. 0 = perfect; may exceed 1 with many insertions. */
  wer: number;
  substitutions: number;
  deletions: number;
  insertions: number;
  alignment: WerAlignment[];
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"()\-–—]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Computes Word Error Rate between `reference` and `hypothesis`.
 * WER = (S + D + I) / len(reference_words).
 * Returns 0 for two empty strings; Infinity for non-empty hypothesis against empty reference.
 */
export function computeWer(reference: string, hypothesis: string): WerResult {
  const ref = normalize(reference);
  const hyp = normalize(hypothesis);
  const R = ref.length;
  const H = hyp.length;

  if (R === 0 && H === 0) {
    return { wer: 0, substitutions: 0, deletions: 0, insertions: 0, alignment: [] };
  }
  if (R === 0) {
    return {
      wer: Infinity,
      substitutions: 0,
      deletions: 0,
      insertions: H,
      alignment: hyp.map((h) => ({ ref: null, hyp: h, type: "insertion" as const })),
    };
  }

  // dp[i][j] = edit distance between ref[0..i-1] and hyp[0..j-1]
  const dp: number[][] = Array.from({ length: R + 1 }, (_, i) =>
    Array.from({ length: H + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= R; i++) {
    for (let j = 1; j <= H; j++) {
      if (ref[i - 1] === hyp[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack: substitution > deletion > insertion on ties (standard WER convention)
  const alignment: WerAlignment[] = [];
  let i = R;
  let j = H;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && ref[i - 1] === hyp[j - 1]) {
      alignment.unshift({ ref: ref[i - 1], hyp: hyp[j - 1], type: "correct" });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      alignment.unshift({ ref: ref[i - 1], hyp: hyp[j - 1], type: "substitution" });
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      alignment.unshift({ ref: ref[i - 1], hyp: null, type: "deletion" });
      i--;
    } else {
      alignment.unshift({ ref: null, hyp: hyp[j - 1], type: "insertion" });
      j--;
    }
  }

  const substitutions = alignment.filter((a) => a.type === "substitution").length;
  const deletions = alignment.filter((a) => a.type === "deletion").length;
  const insertions = alignment.filter((a) => a.type === "insertion").length;

  return {
    wer: (substitutions + deletions + insertions) / R,
    substitutions,
    deletions,
    insertions,
    alignment,
  };
}
