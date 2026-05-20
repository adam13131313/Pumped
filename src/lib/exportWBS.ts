// Stubbed for v2 phase 1. Real rewrite belongs to phase 4 — the v1
// implementation hard-coded a Programme/Project/WorkPackage three-level
// hierarchy and joined rows by text-name string matching, neither of which
// applies in v2 (single wbs_nodes tree, UUID FKs). Throws on call so its
// consumers fail loudly rather than silently producing an empty CSV.
//
// v1 implementation preserved at /tmp/exportWBS-v1.bak during the rebuild
// and on the audit-fixes branch in git history (commit 7e81b31).

export function exportWBStoCSV(): void {
  throw new Error(
    "exportWBStoCSV is being rewritten for the v2 wbs_nodes hierarchy. " +
    "Disabled until phase 4 lands.",
  );
}
