# Scheduler bridge

Prototype code that bridges between an external schedule (today: Microsoft
Project / .xlsx exports) and Pumped's task model. None of this is part of
Pumped's runtime — it's the integration layer being worked out by
hand against Adam's real Infra SLS schedule before it becomes proper
edge functions and webhooks.

See the [Pumped / Scheduler boundary](../../../.claude/memory/project_pumped_scheduler_boundary.md)
memo for the strategic frame: the bridge between any external scheduler
and Pumped lives Pumped-side, regardless of whether the scheduler is MS
Project today or a future Pumped-built scheduling product.

## What's in here

| File | What it does |
|---|---|
| `build_schedule_model.py` | Reads a typed-date Gantt-style `.xlsx`, derives the dependency network (FS/SS + lag), and rewrites it as a **formula-driven** workbook (`WORKDAY` + `INDEX/MATCH`). Used to verify that the schedule's logic actually computes the dates the planner typed in, and to enable what-if analysis (e.g. "what happens if I remove the SNET on 3.2.1?"). |
| `verify_schedule_model.py` | Simulates the dependency network in Python and compares against the hand-typed dates. Used to find planner-side arithmetic slips before relying on the schedule. |
| `export_wbs.py` | Flattens the WBS from an Excel sheet into two outputs: a sheets-friendly CSV, and a Pumped bulk-insert SQL script (programmes / projects / work packages / actions, with placeholder org_id / user_id). The prototype of the inbound-bridge flow: "schedule → Pumped's data model." |

## How they're used today

All three were written during the May 2026 analysis of the Infra SLS
infrastructure programme schedule (built by Adam in MS Project / Excel).
They're hardcoded to read from `~/Downloads/Infra SLS Schedule Task
Tables — Dated.xlsx` and produce outputs there. **They're not production
bridge code** — they're one-shot utilities that establish what the
integration needs to do.

## Why this matters for the future

The bridge between an external scheduler and Pumped has five concerns
([per the boundary memo](../../../.claude/memory/project_pumped_scheduler_boundary.md)):

1. Identity — recognising "the same task" across systems
2. Direction of truth — per-field, which side wins
3. Granularity — summary tasks → wbs_nodes, leaf tasks → actions
4. Sync direction — outbound (scheduler → Pumped) is solved by `ingest-task`; inbound (Pumped → scheduler) is the harder problem
5. Conflict resolution — what happens when both sides have moved

These prototypes solve (3) crudely (the `export_wbs.py` mapping) and
nothing else. The properly-engineered bridge — supabase edge function +
webhook outbound + idempotent upserts keyed on `source_id` — will
replace this code when the integration contract is written and
agreed.

For now: these stay as the artefacts that prove the concept and as the
reference for the eventual replacement.

## Notes on data

Inputs and outputs of these scripts (`.xlsx`, `.csv`, `.sql`) are **not**
checked into the repo because they contain real project data from a live
programme. Run them against your own exports.
