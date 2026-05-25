import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { extractFromEmail, type Provider } from "./lib/extract.ts";
import type { CorpusEntry, ExtractionResult } from "./types.ts";

const args = parseArgs(process.argv.slice(2));
const corpusPath = args.corpus ?? "scripts/extraction-spike/corpus/corpus.json";
const outputPath = args.output ?? "scripts/extraction-spike/results/extractions.json";
const provider = (args.provider ?? "anthropic") as Provider;
const model = args.model ?? defaultModelFor(provider);

const apiKey = readApiKey(provider);
if (!apiKey) {
  console.error(`Missing API key. Set ${envVarFor(provider)} in your environment.`);
  process.exit(1);
}

if (!existsSync(corpusPath)) {
  console.error(`Corpus not found: ${corpusPath}`);
  console.error(`Run: tsx scripts/extraction-spike/import-mbox.ts <mbox-path>  first.`);
  process.exit(1);
}

const corpus: CorpusEntry[] = JSON.parse(readFileSync(corpusPath, "utf-8"));
console.log(`Loaded ${corpus.length} emails from ${corpusPath}`);
console.log(`Provider: ${provider}  Model: ${model}`);
console.log(``);

const results: ExtractionResult[] = [];
let done = 0;
for (const entry of corpus) {
  process.stdout.write(`[${++done}/${corpus.length}] ${entry.email.id}  ${truncate(entry.email.subject, 60)}  `);
  const result = await extractFromEmail(entry.email, { provider, model, apiKey });
  results.push(result);
  if (result.error) {
    process.stdout.write(`ERROR  ${result.error.slice(0, 80)}\n`);
  } else {
    process.stdout.write(`${result.extracted.length} commitment(s) in ${result.latencyMs}ms\n`);
  }
}

writeFileSync(outputPath, JSON.stringify(results, null, 2));
console.log(``);
console.log(`Wrote ${results.length} extraction results to ${outputPath}`);
console.log(`Next: tsx scripts/extraction-spike/run-score.ts`);

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

function defaultModelFor(p: Provider): string {
  if (p === "anthropic") return "claude-opus-4-7";
  if (p === "openai") return "gpt-5";
  return "google/gemini-3-flash-preview";
}

function envVarFor(p: Provider): string {
  if (p === "anthropic") return "ANTHROPIC_API_KEY";
  if (p === "openai") return "OPENAI_API_KEY";
  return "LOVABLE_API_KEY";
}

function readApiKey(p: Provider): string | undefined {
  return process.env[envVarFor(p)];
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
