-- ============================================================================
-- action_dependencies — first action-level FS/SS/FF/SF + lag substrate primitive
-- ============================================================================
-- Mirrors wbs_node_dependencies one-for-one, retargeted at the actions table.
-- The shape (dependency_type enum + lag_days) is identical, so the synthesis
-- layer can walk both tables with a single traversal pattern. If/when we
-- generalise into a polymorphic dependency table later, the data migration is
-- a UNION ALL into the new shape.
--
-- Cycle prevention is enforced application-side (store.addActionDependency
-- walks the graph and rejects on cycle). We DON'T add a recursive trigger
-- because the typical insert path is a single dep at a time and the round-trip
-- cost of a CTE check on every insert isn't worth it at our scale.
--
-- Apply AFTER 20260522000000_action_status_cancelled_deferred.sql.
-- ============================================================================


CREATE TABLE public.action_dependencies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_action_id  UUID NOT NULL,
  target_action_id  UUID NOT NULL,
  dependency_type   public.dependency_type NOT NULL DEFAULT 'fs',
  lag_days          INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same-org composite FKs so a dependency can never dangle across tenants.
  -- Composite (organisation_id, id) uniqueness already exists on public.actions.
  FOREIGN KEY (organisation_id, source_action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, target_action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE CASCADE,

  UNIQUE (source_action_id, target_action_id, dependency_type),
  CONSTRAINT no_self_dependency CHECK (source_action_id <> target_action_id)
);

CREATE INDEX idx_action_deps_source ON public.action_dependencies (source_action_id);
CREATE INDEX idx_action_deps_target ON public.action_dependencies (target_action_id);
CREATE INDEX idx_action_deps_org    ON public.action_dependencies (organisation_id);

COMMENT ON TABLE public.action_dependencies IS
  'Action-to-action scheduling dependencies. Semantics: target_action depends on source_action — i.e. source is the predecessor, target is the successor. Mirrors wbs_node_dependencies.';

COMMENT ON COLUMN public.action_dependencies.dependency_type IS
  'fs = finish-to-start (default), ss = start-to-start, ff = finish-to-finish, sf = start-to-finish.';

COMMENT ON COLUMN public.action_dependencies.lag_days IS
  'Calendar days of lag (positive = wait, negative = lead). Working-day interpretation is applied at the synthesis layer, not stored here.';


ALTER TABLE public.action_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_deps_select ON public.action_dependencies FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY action_deps_insert ON public.action_dependencies FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY action_deps_update ON public.action_dependencies FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY action_deps_delete ON public.action_dependencies FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));
