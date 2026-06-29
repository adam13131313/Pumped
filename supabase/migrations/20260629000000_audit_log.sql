-- Phase 1.1 — audit log foundation.
--
-- Records every create / update / delete on the load-bearing domain tables.
-- Foundation for:
--   * customer trust posture ("who changed what and when")
--   * SOC 2 audit trail requirements
--   * future "undo" / "history" UI surfaces
--   * any phase that needs to reconstruct state at a point in time
--
-- Design choices
--   * One generic trigger function shared by every audited table. New tables
--     only need a CREATE TRIGGER line; the function figures out entity_kind
--     from TG_TABLE_NAME.
--   * Actor comes from auth.uid(). For service-role writes (edge functions,
--     cron jobs, MCP server, CSV imports) actor will be NULL — that's by
--     design. A `source` column is included so callers can tag writes
--     explicitly via `SET LOCAL audit.source = 'mcp'` before their statement.
--   * `diff` column is provisioned but not populated in this slice. Future
--     enhancement: store changed fields as JSONB on UPDATE. Adding it now
--     so the column exists when we need it.
--   * No RLS INSERT / UPDATE / DELETE policies on the table. The trigger
--     function is SECURITY DEFINER so it can write regardless of RLS.
--     Users only have SELECT scoped to their organisation.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

CREATE TYPE public.audit_entity_kind AS ENUM (
  'action',
  'waiting_item',
  'wbs_node',
  'inbox_item',
  'membership',
  'organisation'
);

CREATE TYPE public.audit_op AS ENUM ('create', 'update', 'delete');

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

CREATE TABLE public.audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  actor_user_id    UUID,
  entity_kind      public.audit_entity_kind NOT NULL,
  entity_id        UUID NOT NULL,
  op               public.audit_op NOT NULL,
  source           TEXT,
  diff             JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_org_created   ON public.audit_log (organisation_id, created_at DESC);
CREATE INDEX idx_audit_log_entity        ON public.audit_log (entity_kind, entity_id);
CREATE INDEX idx_audit_log_actor_created ON public.audit_log (actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_op_created    ON public.audit_log (op, created_at DESC);

-- ---------------------------------------------------------------------------
-- Generic trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind   public.audit_entity_kind;
  v_op     public.audit_op;
  v_org    UUID;
  v_id     UUID;
  v_source TEXT;
BEGIN
  v_kind := CASE TG_TABLE_NAME
    WHEN 'actions'       THEN 'action'::public.audit_entity_kind
    WHEN 'waiting_items' THEN 'waiting_item'::public.audit_entity_kind
    WHEN 'wbs_nodes'     THEN 'wbs_node'::public.audit_entity_kind
    WHEN 'inbox_items'   THEN 'inbox_item'::public.audit_entity_kind
    WHEN 'memberships'   THEN 'membership'::public.audit_entity_kind
    WHEN 'organisations' THEN 'organisation'::public.audit_entity_kind
    ELSE NULL
  END;
  IF v_kind IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_op := CASE TG_OP
    WHEN 'INSERT' THEN 'create'::public.audit_op
    WHEN 'UPDATE' THEN 'update'::public.audit_op
    WHEN 'DELETE' THEN 'delete'::public.audit_op
  END;

  IF TG_OP = 'DELETE' THEN
    v_id  := OLD.id;
    v_org := CASE WHEN TG_TABLE_NAME = 'organisations' THEN OLD.id ELSE OLD.organisation_id END;
  ELSE
    v_id  := NEW.id;
    v_org := CASE WHEN TG_TABLE_NAME = 'organisations' THEN NEW.id ELSE NEW.organisation_id END;
  END IF;

  -- Optional caller-supplied source tag. NULL if not set.
  v_source := NULLIF(current_setting('audit.source', true), '');

  INSERT INTO public.audit_log (organisation_id, actor_user_id, entity_kind, entity_id, op, source)
  VALUES (v_org, auth.uid(), v_kind, v_id, v_op, v_source);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

CREATE TRIGGER actions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER waiting_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.waiting_items
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER wbs_nodes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.wbs_nodes
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER inbox_items_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.inbox_items
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER memberships_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

CREATE TRIGGER organisations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.record_audit_log();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Members of the organisation can read their own org's audit trail.
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

-- No INSERT / UPDATE / DELETE policies — only the SECURITY DEFINER trigger
-- function may write, and audit-log rows are append-only by design.
