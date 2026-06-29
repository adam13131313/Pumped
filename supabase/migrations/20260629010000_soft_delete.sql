-- Phase 1.2 — soft delete + recoverable trash.
--
-- Adds a `deleted_at` column to the four entities where user-initiated
-- delete is a real action. Distinct from `archived_at` (which already
-- exists on actions + wbs_nodes for lifecycle automation — 24h
-- post-complete archive, manual archive of inactive WBS nodes).
--
-- Semantic split:
--   * archived_at — system-driven "out of active view, lifecycle done"
--   * deleted_at  — user-driven "I wanted this gone, but recoverable"
--
-- After this migration, every domain query that should hide deleted rows
-- needs to add `.is("deleted_at", null)`. The app store enforces that
-- pattern in loadAllData and the per-entity filters; new code that joins
-- to these tables must do the same.
--
-- Polymorphic FK note: task_links / attachments / comments still cascade
-- on HARD delete. Soft delete leaves them attached, which is correct —
-- a restored parent should resurface with its history intact.

ALTER TABLE public.actions       ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.waiting_items ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.inbox_items   ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE public.wbs_nodes     ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial indexes for the common "all active rows in my org" path.
CREATE INDEX idx_actions_org_undeleted
  ON public.actions (organisation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_waiting_items_org_undeleted
  ON public.waiting_items (organisation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_inbox_items_org_undeleted
  ON public.inbox_items (organisation_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_wbs_nodes_org_undeleted
  ON public.wbs_nodes (organisation_id)
  WHERE deleted_at IS NULL;
