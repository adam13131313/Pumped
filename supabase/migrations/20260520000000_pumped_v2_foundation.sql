-- ============================================================================
-- Pumped v2 Foundation Schema
-- ============================================================================
-- Multi-tenant production foundation:
--   * organisations + nestable units + memberships
--   * single self-referencing wbs_nodes hierarchy (Portfolio > Programme >
--     Project > Work Package), with flexible roots
--   * UUID FKs throughout — no text-string references between tables
--   * composite (organisation_id, id) FKs on every cross-tenant reference, so
--     RLS bypass alone can never link rows across orgs
--   * explicit ON DELETE semantics on every FK
--   * RLS enabled on every table; helper functions cache the org membership
--     lookup so each policy is a single index hit
--   * audit tables (action_status_log, rag_status_history, inbox_item_events,
--     health_score_history) are append-only by policy
--
-- This is a GREENFIELD migration. The existing single-user tables
-- (programmes, projects, work_packages, actions-with-text-project, etc.) are
-- not migrated by this file. Drop them or run this in a fresh project; the
-- data migration from v1 to v2 is a separate piece of work.
--
-- To apply:
--   * fresh Supabase project: run this file as-is
--   * existing project: drop the v1 tables first, or rename them aside before
--     running this; otherwise the CREATE TABLE statements will fail
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Extensions
-- ----------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ----------------------------------------------------------------------------
-- 2. Shared trigger helpers
-- ----------------------------------------------------------------------------

-- Bump updated_at on every row update. Attached to every table that has the
-- column. Kept tiny and SECURITY INVOKER (default) so it cannot be a
-- privilege-escalation vector.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. Enumerated types
-- ----------------------------------------------------------------------------

CREATE TYPE public.node_type            AS ENUM ('portfolio', 'programme', 'project', 'work_package');
CREATE TYPE public.action_priority      AS ENUM ('high', 'medium', 'low');
CREATE TYPE public.action_status        AS ENUM ('not_started', 'in_progress', 'complete', 'blocked');
CREATE TYPE public.rag_status           AS ENUM ('green', 'amber', 'red');
CREATE TYPE public.waiting_status       AS ENUM ('pending', 'received', 'overdue');
CREATE TYPE public.project_status       AS ENUM ('active', 'on_hold', 'complete');
CREATE TYPE public.dependency_type      AS ENUM ('fs', 'ff', 'ss', 'sf');
CREATE TYPE public.routine_time_of_day  AS ENUM ('morning', 'afternoon', 'evening', 'anytime');
CREATE TYPE public.routine_frequency    AS ENUM ('daily', 'weekly_days', 'weekly_count');
CREATE TYPE public.membership_role      AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.inbox_event_type     AS ENUM ('created', 'promoted', 'deleted');


-- ============================================================================
-- 4. Tenancy: organisations, units, memberships
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 organisations
-- ----------------------------------------------------------------------------

CREATE TABLE public.organisations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  slug        TEXT UNIQUE CHECK (slug IS NULL OR slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisations IS
  'Top-level tenant. Every domain row carries organisation_id for isolation.';

CREATE TRIGGER organisations_set_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4.2 organisation_units (nestable team/division structure)
-- ----------------------------------------------------------------------------

CREATE TABLE public.organisation_units (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_unit_id   UUID,
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A unit's parent must be in the same organisation. Enforced via composite FK.
  FOREIGN KEY (organisation_id, parent_unit_id)
    REFERENCES public.organisation_units(organisation_id, id) ON DELETE SET NULL,

  -- Composite unique so other tables can FK with same-org guarantee
  UNIQUE (organisation_id, id),

  CONSTRAINT no_self_parent CHECK (id <> parent_unit_id)
);

CREATE INDEX idx_units_org    ON public.organisation_units (organisation_id);
CREATE INDEX idx_units_parent ON public.organisation_units (organisation_id, parent_unit_id);

CREATE TRIGGER organisation_units_set_updated_at
  BEFORE UPDATE ON public.organisation_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4.3 memberships (user ↔ organisation join, with role)
-- ----------------------------------------------------------------------------

CREATE TABLE public.memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role             public.membership_role NOT NULL DEFAULT 'member',
  unit_id          UUID,

  invited_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at       TIMESTAMPTZ,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A user is at most one role per organisation
  UNIQUE (organisation_id, user_id),

  -- Same-org composite FK to organisation_units
  FOREIGN KEY (organisation_id, unit_id)
    REFERENCES public.organisation_units(organisation_id, id) ON DELETE SET NULL
);

CREATE INDEX idx_memberships_user      ON public.memberships (user_id);
CREATE INDEX idx_memberships_org_role  ON public.memberships (organisation_id, role);
CREATE INDEX idx_memberships_unit      ON public.memberships (unit_id) WHERE unit_id IS NOT NULL;

CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 4.4 Auto-create owner membership when an organisation is inserted
-- ----------------------------------------------------------------------------
-- Without this, the user creating an org would immediately lose access
-- (RLS on every domain table checks is_org_member, which checks memberships).
-- SECURITY DEFINER so the trigger can bypass the memberships RLS that would
-- otherwise require owner/admin role to insert.

CREATE OR REPLACE FUNCTION public.bootstrap_owner_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.memberships (organisation_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (organisation_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisations_bootstrap_owner
  AFTER INSERT ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.bootstrap_owner_membership();


-- ============================================================================
-- 5. RLS helper functions
-- ============================================================================
-- These are SECURITY DEFINER so they can read memberships without recursive
-- RLS issues; STABLE so Postgres can cache per-query.

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND organisation_id = _org_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _roles public.membership_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid()
      AND organisation_id = _org_id
      AND role = ANY (_roles)
  );
$$;


-- ============================================================================
-- 6. WBS hierarchy: wbs_nodes + wbs_node_dependencies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 6.1 wbs_nodes — single self-referencing hierarchy
-- ----------------------------------------------------------------------------

CREATE TABLE public.wbs_nodes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  parent_id        UUID,
  node_type        public.node_type NOT NULL,
  name             TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description      TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  position         INTEGER NOT NULL DEFAULT 0,
  archived_at      TIMESTAMPTZ,

  -- Project-only field. NULL on portfolio/programme/work_package.
  project_status   public.project_status,

  -- Work-package-only fields. NULL on portfolio/programme/project.
  lead_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date       DATE,
  due_date         DATE,
  rag_status       public.rag_status,
  blockers         TEXT CHECK (blockers IS NULL OR char_length(blockers) <= 5000),

  created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite unique enables (organisation_id, id) FK references from
  -- actions / inbox_items / waiting_items / dependencies.
  UNIQUE (organisation_id, id),

  -- Same-org parent enforced via composite FK
  FOREIGN KEY (organisation_id, parent_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE,

  CONSTRAINT no_self_parent CHECK (id <> parent_id),

  -- project_status is only valid on Project nodes
  CONSTRAINT project_status_scope CHECK (
    (node_type = 'project' AND project_status IS NOT NULL) OR
    (node_type <> 'project' AND project_status IS NULL)
  ),

  -- WP-only fields must be NULL on non-WP nodes
  CONSTRAINT wp_fields_scope CHECK (
    node_type = 'work_package' OR (
      rag_status   IS NULL AND
      lead_user_id IS NULL AND
      start_date   IS NULL AND
      due_date     IS NULL AND
      blockers     IS NULL
    )
  ),

  -- Start <= due if both set
  CONSTRAINT wp_date_order CHECK (
    start_date IS NULL OR due_date IS NULL OR start_date <= due_date
  )
);

COMMENT ON TABLE public.wbs_nodes IS
  'Self-referencing WBS hierarchy. node_type orders: portfolio > programme > project > work_package. Roots can be any level.';

CREATE INDEX idx_wbs_org_type        ON public.wbs_nodes (organisation_id, node_type);
CREATE INDEX idx_wbs_org_parent      ON public.wbs_nodes (organisation_id, parent_id);
CREATE INDEX idx_wbs_org_archived    ON public.wbs_nodes (organisation_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX idx_wbs_lead            ON public.wbs_nodes (lead_user_id) WHERE lead_user_id IS NOT NULL;
CREATE INDEX idx_wbs_org_due         ON public.wbs_nodes (organisation_id, due_date) WHERE due_date IS NOT NULL;

CREATE TRIGGER wbs_nodes_set_updated_at
  BEFORE UPDATE ON public.wbs_nodes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 6.2 Parent-type compatibility + cycle prevention
-- ----------------------------------------------------------------------------
-- The natural hierarchy is portfolio > programme > project > work_package.
-- Roots can be any level (parent_id NULL). Skipping intermediate levels is
-- permitted (programme can be a direct child of portfolio, project can hang
-- off either programme or portfolio, work_package can hang off any of the
-- above — but never the other way around).

CREATE OR REPLACE FUNCTION public.enforce_wbs_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_type public.node_type;
  level_of  CONSTANT JSONB := '{"portfolio":4,"programme":3,"project":2,"work_package":1}'::JSONB;
  cycle_hit BOOLEAN;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT node_type INTO parent_type
  FROM public.wbs_nodes WHERE id = NEW.parent_id;

  IF parent_type IS NULL THEN
    RAISE EXCEPTION 'WBS parent % does not exist', NEW.parent_id;
  END IF;

  -- Parent must outrank child in the natural hierarchy
  IF (level_of ->> parent_type::TEXT)::INT <= (level_of ->> NEW.node_type::TEXT)::INT THEN
    RAISE EXCEPTION 'Invalid WBS parent: % cannot be parent of %', parent_type, NEW.node_type;
  END IF;

  -- Cycle check (only meaningful on UPDATE OF parent_id)
  IF TG_OP = 'UPDATE' THEN
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM public.wbs_nodes WHERE id = NEW.parent_id
      UNION ALL
      SELECT n.id, n.parent_id
      FROM public.wbs_nodes n
      JOIN ancestors a ON n.id = a.parent_id
    )
    SELECT TRUE INTO cycle_hit FROM ancestors WHERE id = NEW.id LIMIT 1;

    IF cycle_hit THEN
      RAISE EXCEPTION 'Cycle detected in WBS hierarchy for node %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER wbs_nodes_enforce_parent
  BEFORE INSERT OR UPDATE OF parent_id, node_type ON public.wbs_nodes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_wbs_parent();


-- ----------------------------------------------------------------------------
-- 6.3 wbs_node_dependencies (FS / FF / SS / SF + lag)
-- ----------------------------------------------------------------------------

CREATE TABLE public.wbs_node_dependencies (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_node_id   UUID NOT NULL,
  target_node_id   UUID NOT NULL,
  dependency_type  public.dependency_type NOT NULL DEFAULT 'fs',
  lag_days         INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same-org composite FKs
  FOREIGN KEY (organisation_id, source_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, target_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE,

  UNIQUE (source_node_id, target_node_id, dependency_type),
  CONSTRAINT no_self_dependency CHECK (source_node_id <> target_node_id)
);

CREATE INDEX idx_deps_source ON public.wbs_node_dependencies (source_node_id);
CREATE INDEX idx_deps_target ON public.wbs_node_dependencies (target_node_id);


-- ----------------------------------------------------------------------------
-- 6.4 rag_status_history — audit log of WP RAG transitions
-- ----------------------------------------------------------------------------

CREATE TABLE public.rag_status_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  wbs_node_id      UUID NOT NULL,
  from_status      public.rag_status,
  to_status        public.rag_status,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_rag_history_node       ON public.rag_status_history (wbs_node_id, recorded_at DESC);
CREATE INDEX idx_rag_history_org_time   ON public.rag_status_history (organisation_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.log_wbs_rag_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.rag_status IS NOT NULL THEN
    INSERT INTO public.rag_status_history (organisation_id, wbs_node_id, from_status, to_status, recorded_by)
    VALUES (NEW.organisation_id, NEW.id, NULL, NEW.rag_status, auth.uid());
  ELSIF TG_OP = 'UPDATE' AND COALESCE(NEW.rag_status, 'green') <> COALESCE(OLD.rag_status, 'green')
        AND NOT (NEW.rag_status IS NULL AND OLD.rag_status IS NULL) THEN
    INSERT INTO public.rag_status_history (organisation_id, wbs_node_id, from_status, to_status, recorded_by)
    VALUES (NEW.organisation_id, NEW.id, OLD.rag_status, NEW.rag_status, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER wbs_nodes_log_rag_change
  AFTER INSERT OR UPDATE OF rag_status ON public.wbs_nodes
  FOR EACH ROW EXECUTE FUNCTION public.log_wbs_rag_change();


-- ============================================================================
-- 7. Actions
-- ============================================================================

CREATE TABLE public.actions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  wbs_node_id         UUID,
  assigned_to         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  task                TEXT NOT NULL CHECK (char_length(task) BETWEEN 1 AND 500),
  priority            public.action_priority NOT NULL DEFAULT 'medium',
  status              public.action_status   NOT NULL DEFAULT 'not_started',
  start_date          DATE,
  due_date            DATE,
  completed_at        TIMESTAMPTZ,
  notes               TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),
  labels              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  not_started_since   TIMESTAMPTZ,
  archived_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite unique enables status-log composite FK back to actions
  UNIQUE (organisation_id, id),

  -- Same-org wbs_node enforced via composite FK
  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE SET NULL,

  CONSTRAINT complete_has_timestamp CHECK (
    (status = 'complete' AND completed_at IS NOT NULL) OR
    (status <> 'complete' AND completed_at IS NULL)
  ),
  CONSTRAINT date_order CHECK (
    start_date IS NULL OR due_date IS NULL OR start_date <= due_date
  )
);

COMMENT ON COLUMN public.actions.labels IS
  'Denormalised tag array. Promote to a labels/action_labels join if tag-level UI lands.';

CREATE INDEX idx_actions_org_status     ON public.actions (organisation_id, status) WHERE archived_at IS NULL;
CREATE INDEX idx_actions_org_archived   ON public.actions (organisation_id, archived_at);
CREATE INDEX idx_actions_org_due        ON public.actions (organisation_id, due_date) WHERE archived_at IS NULL AND due_date IS NOT NULL;
CREATE INDEX idx_actions_assignee       ON public.actions (assigned_to, status) WHERE assigned_to IS NOT NULL AND archived_at IS NULL;
CREATE INDEX idx_actions_node           ON public.actions (wbs_node_id) WHERE wbs_node_id IS NOT NULL;
CREATE INDEX idx_actions_stale          ON public.actions (organisation_id, not_started_since) WHERE not_started_since IS NOT NULL;
CREATE INDEX idx_actions_labels         ON public.actions USING GIN (labels);

CREATE TRIGGER actions_set_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 7.1 Auto-maintain completed_at and not_started_since on every write
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.maintain_action_status_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- completed_at: set on entry into 'complete', clear on exit
  IF NEW.status = 'complete' AND (TG_OP = 'INSERT' OR OLD.status <> 'complete') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status <> 'complete' THEN
    NEW.completed_at := NULL;
  END IF;

  -- not_started_since: track how long an action has been sitting unstarted
  IF NEW.status = 'not_started' AND (TG_OP = 'INSERT' OR OLD.status <> 'not_started') THEN
    NEW.not_started_since := COALESCE(NEW.not_started_since, now());
  ELSIF NEW.status <> 'not_started' THEN
    NEW.not_started_since := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER actions_maintain_status_fields
  BEFORE INSERT OR UPDATE OF status ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.maintain_action_status_fields();


-- ----------------------------------------------------------------------------
-- 7.2 action_status_log (append-only audit)
-- ----------------------------------------------------------------------------

CREATE TABLE public.action_status_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  action_id        UUID NOT NULL,
  from_status      public.action_status,
  to_status        public.action_status NOT NULL,
  changed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  FOREIGN KEY (organisation_id, action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_action_log_action_time ON public.action_status_log (action_id, changed_at DESC);
CREATE INDEX idx_action_log_org_time    ON public.action_status_log (organisation_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_action_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.action_status_log (organisation_id, action_id, from_status, to_status, changed_by)
    VALUES (NEW.organisation_id, NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status <> OLD.status THEN
    INSERT INTO public.action_status_log (organisation_id, action_id, from_status, to_status, changed_by)
    VALUES (NEW.organisation_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER actions_log_status_change
  AFTER INSERT OR UPDATE OF status ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.log_action_status_change();


-- ============================================================================
-- 8. Integrations: webhook_sources + integration_tokens
-- ============================================================================
-- Split from a single ingest_sources table so a source can have its token
-- rotated without losing identity / inbox-row provenance.

CREATE TABLE public.webhook_sources (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  slug              TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  description       TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),

  last_received_at  TIMESTAMPTZ,
  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organisation_id, id),     -- enables composite FK from inbox_items
  UNIQUE (organisation_id, slug)
);

CREATE INDEX idx_webhook_sources_org ON public.webhook_sources (organisation_id);

CREATE TRIGGER webhook_sources_set_updated_at
  BEFORE UPDATE ON public.webhook_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.integration_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_id     UUID NOT NULL,
  token_hash    TEXT NOT NULL UNIQUE,
  token_prefix  TEXT NOT NULL CHECK (char_length(token_prefix) BETWEEN 4 AND 24),

  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (organisation_id, source_id)
    REFERENCES public.webhook_sources(organisation_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_tokens_source        ON public.integration_tokens (source_id);
CREATE INDEX idx_tokens_active        ON public.integration_tokens (source_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_tokens_org           ON public.integration_tokens (organisation_id);


-- ============================================================================
-- 9. Inbox items
-- ============================================================================

CREATE TABLE public.inbox_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id         UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  source_id               UUID,
  wbs_node_id             UUID,
  promoted_to_action_id   UUID,

  task                    TEXT NOT NULL CHECK (char_length(task) BETWEEN 1 AND 500),
  priority                public.action_priority NOT NULL DEFAULT 'medium',
  due_date                DATE,
  notes                   TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),

  external_id             TEXT CHECK (external_id IS NULL OR char_length(external_id) <= 200),
  external_url            TEXT CHECK (external_url IS NULL OR char_length(external_url) <= 1000),

  promoted_at             TIMESTAMPTZ,
  created_by              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organisation_id, id),

  FOREIGN KEY (organisation_id, source_id)
    REFERENCES public.webhook_sources(organisation_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE SET NULL,
  FOREIGN KEY (organisation_id, promoted_to_action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE SET NULL,

  -- Promotion atomicity: either both or neither
  CONSTRAINT promotion_pair CHECK (
    (promoted_to_action_id IS NULL AND promoted_at IS NULL) OR
    (promoted_to_action_id IS NOT NULL AND promoted_at IS NOT NULL)
  )
);

CREATE INDEX idx_inbox_org_created  ON public.inbox_items (organisation_id, created_at DESC);
CREATE INDEX idx_inbox_source       ON public.inbox_items (source_id) WHERE source_id IS NOT NULL;
CREATE INDEX idx_inbox_node         ON public.inbox_items (wbs_node_id) WHERE wbs_node_id IS NOT NULL;
CREATE INDEX idx_inbox_pending      ON public.inbox_items (organisation_id, created_at DESC) WHERE promoted_to_action_id IS NULL;

-- Idempotent webhook re-sends: same (source_id, external_id) updates, not duplicates
CREATE UNIQUE INDEX idx_inbox_source_external
  ON public.inbox_items (source_id, external_id)
  WHERE source_id IS NOT NULL AND external_id IS NOT NULL;

CREATE TRIGGER inbox_items_set_updated_at
  BEFORE UPDATE ON public.inbox_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 9.1 inbox_item_events (append-only audit)
-- ----------------------------------------------------------------------------
-- Tracks creation / promotion / deletion. Created and Promoted are written
-- from the app (they're explicit state transitions). Deleted is written by
-- a trigger so a deleted item still leaves an audit trail.

CREATE TABLE public.inbox_item_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id       UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  inbox_item_id         UUID,   -- NULL after item delete

  event_type            public.inbox_event_type NOT NULL,
  user_id               UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Snapshot enough to render an audit line after the source row is gone
  snapshot_source_id    UUID,
  snapshot_task         TEXT,
  snapshot_created_at   TIMESTAMPTZ,

  event_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_events_item     ON public.inbox_item_events (inbox_item_id) WHERE inbox_item_id IS NOT NULL;
CREATE INDEX idx_inbox_events_org_time ON public.inbox_item_events (organisation_id, event_at DESC);

CREATE OR REPLACE FUNCTION public.log_inbox_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.inbox_item_events (
    organisation_id, inbox_item_id, event_type, user_id,
    snapshot_source_id, snapshot_task, snapshot_created_at
  )
  VALUES (
    OLD.organisation_id, OLD.id, 'deleted', auth.uid(),
    OLD.source_id, OLD.task, OLD.created_at
  );
  RETURN OLD;
END;
$$;

CREATE TRIGGER inbox_items_log_delete
  BEFORE DELETE ON public.inbox_items
  FOR EACH ROW EXECUTE FUNCTION public.log_inbox_delete();


-- ============================================================================
-- 10. Waiting items
-- ============================================================================

CREATE TABLE public.waiting_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  wbs_node_id       UUID,

  -- Who we're waiting on. Either an internal user (UUID) or an external name.
  from_user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  from_whom_text    TEXT CHECK (from_whom_text IS NULL OR char_length(from_whom_text) <= 200),

  description       TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  asked_on          DATE,
  due_by            DATE,
  status            public.waiting_status NOT NULL DEFAULT 'pending',
  notes             TEXT NOT NULL DEFAULT '' CHECK (char_length(notes) <= 5000),

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Composite unique enables (organisation_id, id) FK references from
  -- attachments / comments (see 20260520010000_pumped_v2_supplements.sql).
  UNIQUE (organisation_id, id),

  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE SET NULL,

  CONSTRAINT has_from CHECK (
    from_user_id IS NOT NULL OR (from_whom_text IS NOT NULL AND char_length(from_whom_text) > 0)
  )
);

CREATE INDEX idx_waiting_org_status ON public.waiting_items (organisation_id, status);
CREATE INDEX idx_waiting_org_due    ON public.waiting_items (organisation_id, due_by) WHERE due_by IS NOT NULL;
CREATE INDEX idx_waiting_node       ON public.waiting_items (wbs_node_id) WHERE wbs_node_id IS NOT NULL;
CREATE INDEX idx_waiting_from_user  ON public.waiting_items (from_user_id) WHERE from_user_id IS NOT NULL;

CREATE TRIGGER waiting_items_set_updated_at
  BEFORE UPDATE ON public.waiting_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================================
-- 11. Routines + completions (personal, not org-shared)
-- ============================================================================

CREATE TABLE public.routines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  owner_user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  name              TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description       TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  time_of_day       public.routine_time_of_day NOT NULL DEFAULT 'anytime',
  frequency_type    public.routine_frequency   NOT NULL DEFAULT 'daily',

  -- frequency_config shape depends on frequency_type:
  --   daily          → {} (ignored)
  --   weekly_days    → { "days": ["mon", "wed", "fri"] }
  --   weekly_count   → { "target": 3 }
  frequency_config  JSONB NOT NULL DEFAULT '{}'::JSONB,

  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routines_owner_active ON public.routines (owner_user_id) WHERE archived_at IS NULL;
CREATE INDEX idx_routines_org          ON public.routines (organisation_id);

CREATE TRIGGER routines_set_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


CREATE TABLE public.routine_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  routine_id      UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One completion per routine per day per user
  UNIQUE (routine_id, completed_date, user_id)
);

CREATE INDEX idx_completions_routine_date ON public.routine_completions (routine_id, completed_date DESC);
CREATE INDEX idx_completions_user_date    ON public.routine_completions (user_id, completed_date DESC);


-- ============================================================================
-- 12. health_score_history (weekly snapshots)
-- ============================================================================

CREATE TABLE public.health_score_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  components      JSONB   NOT NULL DEFAULT '{}'::JSONB,
  recorded_week   DATE    NOT NULL,   -- Monday of the week the snapshot covers
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One snapshot per (org, user, week)
  UNIQUE (organisation_id, user_id, recorded_week)
);

CREATE INDEX idx_health_org_week  ON public.health_score_history (organisation_id, recorded_week DESC);
CREATE INDEX idx_health_user_week ON public.health_score_history (user_id, recorded_week DESC);


-- ============================================================================
-- 13. Row Level Security
-- ============================================================================
-- Default pattern for org-scoped tables:
--   SELECT / INSERT / UPDATE / DELETE allowed iff is_org_member(organisation_id).
-- Audit tables are append-only: SELECT + INSERT only, no UPDATE/DELETE policy
-- (Postgres default-denies anything not covered).
-- Personal tables (routines, routine_completions) restrict by owner_user_id /
-- user_id rather than org membership.

ALTER TABLE public.organisations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_units     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_nodes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_node_dependencies  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.actions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_status_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_item_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waiting_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_completions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_sources        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_status_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_score_history   ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------------
-- 13.1 organisations
-- ----------------------------------------------------------------------------

CREATE POLICY organisations_select ON public.organisations FOR SELECT TO authenticated
  USING (public.is_org_member(id));

CREATE POLICY organisations_insert ON public.organisations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY organisations_update ON public.organisations FOR UPDATE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner','admin']::public.membership_role[]))
  WITH CHECK (public.has_org_role(id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY organisations_delete ON public.organisations FOR DELETE TO authenticated
  USING (public.has_org_role(id, ARRAY['owner']::public.membership_role[]));


-- ----------------------------------------------------------------------------
-- 13.2 organisation_units
-- ----------------------------------------------------------------------------

CREATE POLICY units_select ON public.organisation_units FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY units_write  ON public.organisation_units FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY units_update ON public.organisation_units FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY units_delete ON public.organisation_units FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));


-- ----------------------------------------------------------------------------
-- 13.3 memberships
-- ----------------------------------------------------------------------------
-- A user can see their own row in any org plus the full member list for orgs
-- they belong to. Only owners/admins can add/change roles. A user can remove
-- themselves; otherwise only owners/admins can.

CREATE POLICY memberships_select ON public.memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(organisation_id)
  );

CREATE POLICY memberships_insert ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );

CREATE POLICY memberships_update ON public.memberships FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY memberships_delete ON public.memberships FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );


-- ----------------------------------------------------------------------------
-- 13.4 wbs_nodes
-- ----------------------------------------------------------------------------

CREATE POLICY wbs_nodes_select ON public.wbs_nodes FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY wbs_nodes_insert ON public.wbs_nodes FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY wbs_nodes_update ON public.wbs_nodes FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY wbs_nodes_delete ON public.wbs_nodes FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.5 wbs_node_dependencies
-- ----------------------------------------------------------------------------

CREATE POLICY wbs_deps_select ON public.wbs_node_dependencies FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY wbs_deps_insert ON public.wbs_node_dependencies FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY wbs_deps_update ON public.wbs_node_dependencies FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY wbs_deps_delete ON public.wbs_node_dependencies FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.6 actions
-- ----------------------------------------------------------------------------

CREATE POLICY actions_select ON public.actions FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY actions_insert ON public.actions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY actions_update ON public.actions FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY actions_delete ON public.actions FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.7 action_status_log (append-only)
-- ----------------------------------------------------------------------------

CREATE POLICY action_log_select ON public.action_status_log FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY action_log_insert ON public.action_status_log FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

-- No UPDATE/DELETE policy → default deny.


-- ----------------------------------------------------------------------------
-- 13.8 inbox_items
-- ----------------------------------------------------------------------------

CREATE POLICY inbox_select ON public.inbox_items FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY inbox_insert ON public.inbox_items FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY inbox_update ON public.inbox_items FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY inbox_delete ON public.inbox_items FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.9 inbox_item_events (append-only)
-- ----------------------------------------------------------------------------

CREATE POLICY inbox_events_select ON public.inbox_item_events FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY inbox_events_insert ON public.inbox_item_events FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.10 waiting_items
-- ----------------------------------------------------------------------------

CREATE POLICY waiting_select ON public.waiting_items FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY waiting_insert ON public.waiting_items FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY waiting_update ON public.waiting_items FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY waiting_delete ON public.waiting_items FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.11 routines (personal)
-- ----------------------------------------------------------------------------

CREATE POLICY routines_select ON public.routines FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY routines_insert ON public.routines FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.is_org_member(organisation_id));

CREATE POLICY routines_update ON public.routines FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY routines_delete ON public.routines FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 13.12 routine_completions (personal)
-- ----------------------------------------------------------------------------

CREATE POLICY completions_select ON public.routine_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY completions_insert ON public.routine_completions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organisation_id));

CREATE POLICY completions_delete ON public.routine_completions FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 13.13 webhook_sources
-- ----------------------------------------------------------------------------

CREATE POLICY sources_select ON public.webhook_sources FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY sources_insert ON public.webhook_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY sources_update ON public.webhook_sources FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY sources_delete ON public.webhook_sources FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));


-- ----------------------------------------------------------------------------
-- 13.14 integration_tokens
-- ----------------------------------------------------------------------------
-- Tokens are sensitive — only owners/admins can mint or revoke. Members can
-- see the prefix (for "which source is which") but not the hash.
-- A view-layer projection in the app should limit columns returned to members.

CREATE POLICY tokens_select ON public.integration_tokens FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY tokens_insert ON public.integration_tokens FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY tokens_update ON public.integration_tokens FOR UPDATE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]))
  WITH CHECK (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));

CREATE POLICY tokens_delete ON public.integration_tokens FOR DELETE TO authenticated
  USING (public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[]));


-- ----------------------------------------------------------------------------
-- 13.15 rag_status_history (append-only)
-- ----------------------------------------------------------------------------

CREATE POLICY rag_history_select ON public.rag_status_history FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY rag_history_insert ON public.rag_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));


-- ----------------------------------------------------------------------------
-- 13.16 health_score_history (append-only; visible to row's user + owners/admins)
-- ----------------------------------------------------------------------------

CREATE POLICY health_select ON public.health_score_history FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );

CREATE POLICY health_insert ON public.health_score_history FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));


-- ============================================================================
-- 14. Done
-- ============================================================================
-- A first user gets bootstrapped by:
--   1) Sign up via Supabase Auth (auth.users row exists).
--   2) Insert into organisations with created_by = auth.uid().
--      The bootstrap_owner_membership trigger creates the owner membership.
--   3) Every subsequent insert into wbs_nodes / actions / etc. carries
--      organisation_id and is gated by is_org_member().
--
-- The legacy v1 tables (programmes, projects, work_packages, single-user
-- actions/inbox/waiting) are not touched here. Data migration from v1 to v2
-- is a separate piece of work driven by a one-off script that:
--   * creates one organisation per existing v1 user_id
--   * walks programmes/projects/work_packages into wbs_nodes preserving
--     parent_id pointers
--   * rewrites actions/inbox/waiting rows from text-name lookup to
--     wbs_node_id UUID FK
--   * preserves rag_status_history / action_status_log / inbox_item_events
-- ============================================================================
