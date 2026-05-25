# Extraction spike

Validates whether the existing AI commitment extraction is good enough on real emails to support the product premise.

**Scope:** unstructured email only. System-routed tasks (Jira, Linear, ERP webhooks) bypass LLM extraction and are not part of this spike.

## How to run

### 1. Assemble the email corpus

In Gmail:
1. Label ~50 representative emails with `pumped-spike`. Include a mix: explicit commitments to you, things you committed to, FYIs, newsletters, automated mail, threads.
2. Use [Google Takeout](https://takeout.google.com): select **Mail**, choose "Select labels" → only `pumped-spike`, export as `.mbox`.
3. Download the export. The `.mbox` file is inside the resulting `.tgz`.

### 2. Import the mbox into a corpus skeleton

```bash
npx tsx scripts/extraction-spike/import-mbox.ts /path/to/your.mbox
```

This parses the mbox and writes `scripts/extraction-spike/corpus/corpus.json` with an empty `expectedCommitments: []` for each email.

### 3. Label ground truth

Open `scripts/extraction-spike/corpus/corpus.json` in your editor. For each email, fill in the `expectedCommitments` array — what commitments *should* have been extracted from this email, per the definition in [commitment-definition.md](commitment-definition.md).

Each commitment:
```json
{
  "task": "Send Q3 proposal draft to Sarah",
  "owner": "me",
  "ownerName": "",
  "dueDate": "2026-06-10",
  "priority": "high",
  "sourceQuote": "Can you get me the Q3 draft by next Friday?"
}
```

Set `expectedCommitments` to `[]` for emails with no commitments.

### 4. Set your API key

Default provider is Anthropic Claude Opus 4.7. Set your key:

```bash
export ANTHROPIC_API_KEY=...   # default — uses claude-opus-4-7
export LOVABLE_API_KEY=...     # alternative — uses google/gemini-3-flash-preview (matches deployed function)
export OPENAI_API_KEY=...      # alternative — uses gpt-5
```

### 5. Run extraction

```bash
# Default: Anthropic + claude-opus-4-7
npm run spike:extract

# Or with a different provider/model
npm run spike:extract -- --provider lovable
npm run spike:extract -- --provider openai
npm run spike:extract -- --model claude-sonnet-4-6
```

Results saved to `scripts/extraction-spike/results/extractions.json`.

### 6. Score against ground truth

```bash
npx tsx scripts/extraction-spike/run-score.ts
```

Writes `scripts/extraction-spike/results/scoring-report.md` and prints aggregate metrics.

## Thresholds

- **Precision ≥ 70%** — at least 70% of extracted commitments are real
- **Recall ≥ 80%** — at least 80% of real commitments are extracted

Below these, the prompt / model needs work before phase 2.

## Scoring methodology

Extracted commitments are matched to expected ones by Jaccard token overlap on the task text (threshold 0.4). This is imperfect — review the report manually for borderline cases. We're looking for big signal here (e.g. 30% recall = product problem), not 1% accuracy.

## Privacy

`corpus/` and `results/` are gitignored. Your emails stay on your machine except for the body content sent to whichever AI provider you choose (the same call production would make).

## Comparing models

To compare providers, run extract with different `--provider` flags and write to different output files:

```bash
npx tsx scripts/extraction-spike/run-extract.ts --provider lovable --output scripts/extraction-spike/results/gemini.json
npx tsx scripts/extraction-spike/run-extract.ts --provider anthropic --output scripts/extraction-spike/results/claude.json
npx tsx scripts/extraction-spike/run-score.ts --results scripts/extraction-spike/results/gemini.json --report scripts/extraction-spike/results/gemini-report.md
npx tsx scripts/extraction-spike/run-score.ts --results scripts/extraction-spike/results/claude.json --report scripts/extraction-spike/results/claude-report.md
```
