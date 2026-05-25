import type {
  AggregateScore,
  Commitment,
  CorpusEntry,
  ExtractionResult,
  ScoreEntry,
} from "../types.ts";

const MATCH_THRESHOLD = 0.4;
const STOPWORDS = new Set([
  "a", "an", "the", "to", "for", "of", "and", "or", "by", "on", "in", "at",
  "is", "are", "be", "with", "from", "as", "that", "this", "it", "i", "you",
  "we", "me", "my", "your", "our", "will", "should", "can", "could", "would",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

function similarity(a: Commitment, b: Commitment): number {
  return jaccard(tokenize(a.task), tokenize(b.task));
}

export function scoreEmail(
  entry: CorpusEntry,
  result: ExtractionResult,
): ScoreEntry {
  const expected = [...entry.expectedCommitments];
  const extracted = [...result.extracted];

  const truePositives: { extracted: Commitment; expected: Commitment }[] = [];
  const remainingExtracted: Commitment[] = [];
  const matchedExpectedIndices = new Set<number>();

  for (const ext of extracted) {
    let bestScore = 0;
    let bestIdx = -1;
    expected.forEach((exp, idx) => {
      if (matchedExpectedIndices.has(idx)) return;
      const s = similarity(ext, exp);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    });
    if (bestIdx !== -1 && bestScore >= MATCH_THRESHOLD) {
      truePositives.push({ extracted: ext, expected: expected[bestIdx] });
      matchedExpectedIndices.add(bestIdx);
    } else {
      remainingExtracted.push(ext);
    }
  }

  const falseNegatives = expected.filter((_, idx) => !matchedExpectedIndices.has(idx));

  return {
    emailId: entry.email.id,
    truePositives,
    falsePositives: remainingExtracted,
    falseNegatives,
  };
}

export function aggregate(scores: ScoreEntry[]): AggregateScore {
  const tp = scores.reduce((s, x) => s + x.truePositives.length, 0);
  const fp = scores.reduce((s, x) => s + x.falsePositives.length, 0);
  const fn = scores.reduce((s, x) => s + x.falseNegatives.length, 0);
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return {
    totalEmails: scores.length,
    totalExtracted: tp + fp,
    totalExpected: tp + fn,
    truePositives: tp,
    falsePositives: fp,
    falseNegatives: fn,
    precision,
    recall,
    f1,
  };
}

export function formatReport(
  scores: ScoreEntry[],
  agg: AggregateScore,
  corpus: CorpusEntry[],
  model: string,
): string {
  const corpusById = new Map(corpus.map((c) => [c.email.id, c]));

  const lines: string[] = [];
  lines.push(`# Extraction spike scoring report`);
  lines.push(``);
  lines.push(`**Model:** ${model}`);
  lines.push(`**Emails:** ${agg.totalEmails}`);
  lines.push(`**Match threshold (Jaccard):** ${MATCH_THRESHOLD}`);
  lines.push(``);
  lines.push(`## Aggregate`);
  lines.push(``);
  lines.push(`| Metric | Value |`);
  lines.push(`|---|---|`);
  lines.push(`| Precision | ${(agg.precision * 100).toFixed(1)}% |`);
  lines.push(`| Recall | ${(agg.recall * 100).toFixed(1)}% |`);
  lines.push(`| F1 | ${(agg.f1 * 100).toFixed(1)}% |`);
  lines.push(`| True positives | ${agg.truePositives} |`);
  lines.push(`| False positives (extracted but not expected) | ${agg.falsePositives} |`);
  lines.push(`| False negatives (expected but missed) | ${agg.falseNegatives} |`);
  lines.push(`| Total extracted | ${agg.totalExtracted} |`);
  lines.push(`| Total expected | ${agg.totalExpected} |`);
  lines.push(``);
  lines.push(`## Pass thresholds`);
  lines.push(``);
  lines.push(`- Precision ≥ 70%: ${agg.precision >= 0.7 ? "PASS" : "FAIL"}`);
  lines.push(`- Recall ≥ 80%: ${agg.recall >= 0.8 ? "PASS" : "FAIL"}`);
  lines.push(``);
  lines.push(`## Per-email detail`);
  lines.push(``);

  for (const score of scores) {
    const entry = corpusById.get(score.emailId);
    if (!entry) continue;
    lines.push(`### ${score.emailId} — ${entry.email.subject || "(no subject)"}`);
    lines.push(``);
    lines.push(`*From:* ${entry.email.from}`);
    lines.push(``);
    if (score.truePositives.length > 0) {
      lines.push(`**True positives (${score.truePositives.length})**`);
      for (const tp of score.truePositives) {
        lines.push(`- expected: \`${tp.expected.task}\``);
        lines.push(`  extracted: \`${tp.extracted.task}\``);
      }
      lines.push(``);
    }
    if (score.falsePositives.length > 0) {
      lines.push(`**False positives (${score.falsePositives.length}) — extracted but no expected match**`);
      for (const fp of score.falsePositives) {
        lines.push(`- \`${fp.task}\`${fp.sourceQuote ? ` _(quote: "${fp.sourceQuote}")_` : ""}`);
      }
      lines.push(``);
    }
    if (score.falseNegatives.length > 0) {
      lines.push(`**False negatives (${score.falseNegatives.length}) — expected but missed**`);
      for (const fn of score.falseNegatives) {
        lines.push(`- \`${fn.task}\``);
      }
      lines.push(``);
    }
  }

  return lines.join("\n");
}
