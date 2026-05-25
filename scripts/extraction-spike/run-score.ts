import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { aggregate, formatReport, scoreEmail } from "./lib/score.ts";
import type { CorpusEntry, ExtractionResult, ScoreEntry } from "./types.ts";

const args = parseArgs(process.argv.slice(2));
const corpusPath = args.corpus ?? "scripts/extraction-spike/corpus/corpus.json";
const resultsPath = args.results ?? "scripts/extraction-spike/results/extractions.json";
const reportPath = args.report ?? "scripts/extraction-spike/results/scoring-report.md";

if (!existsSync(corpusPath) || !existsSync(resultsPath)) {
  console.error(`Missing input file(s):`);
  if (!existsSync(corpusPath)) console.error(`  ${corpusPath}`);
  if (!existsSync(resultsPath)) console.error(`  ${resultsPath}`);
  process.exit(1);
}

const corpus: CorpusEntry[] = JSON.parse(readFileSync(corpusPath, "utf-8"));
const results: ExtractionResult[] = JSON.parse(readFileSync(resultsPath, "utf-8"));
const resultsById = new Map(results.map((r) => [r.emailId, r]));

const scores: ScoreEntry[] = [];
for (const entry of corpus) {
  const result = resultsById.get(entry.email.id);
  if (!result) continue;
  scores.push(scoreEmail(entry, result));
}

const agg = aggregate(scores);
const model = results[0]?.model ?? "unknown";
const report = formatReport(scores, agg, corpus, model);

writeFileSync(reportPath, report);

console.log(``);
console.log(`Scoring report: ${reportPath}`);
console.log(``);
console.log(`  Precision: ${(agg.precision * 100).toFixed(1)}%  (${agg.precision >= 0.7 ? "PASS" : "FAIL"} threshold 70%)`);
console.log(`  Recall:    ${(agg.recall * 100).toFixed(1)}%  (${agg.recall >= 0.8 ? "PASS" : "FAIL"} threshold 80%)`);
console.log(`  F1:        ${(agg.f1 * 100).toFixed(1)}%`);
console.log(`  TP/FP/FN:  ${agg.truePositives} / ${agg.falsePositives} / ${agg.falseNegatives}`);
console.log(``);

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
}
