import { writeFileSync, existsSync } from "node:fs";
import { parseMbox } from "./lib/mbox-parser.ts";
import type { CorpusEntry } from "./types.ts";

const [, , mboxPath, outputPath = "scripts/extraction-spike/corpus/corpus.json"] = process.argv;

if (!mboxPath) {
  console.error("Usage: tsx scripts/extraction-spike/import-mbox.ts <path-to-mbox> [output.json]");
  process.exit(1);
}

if (!existsSync(mboxPath)) {
  console.error(`File not found: ${mboxPath}`);
  process.exit(1);
}

const emails = parseMbox(mboxPath);
console.log(`Parsed ${emails.length} emails from ${mboxPath}`);

const corpus: CorpusEntry[] = emails.map((email) => ({
  email,
  expectedCommitments: [],
  notes: "",
}));

writeFileSync(outputPath, JSON.stringify(corpus, null, 2));
console.log(`Wrote corpus skeleton to ${outputPath}`);
console.log(`Next: open ${outputPath} and fill in expectedCommitments for each email.`);
