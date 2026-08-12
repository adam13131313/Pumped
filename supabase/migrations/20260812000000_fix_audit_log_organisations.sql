-- Fixes audit_log trigger blocking org creation.
--
-- Symptom: creating a row in public.organisations failed with
--   "record 'new' has no field 'organisation_id'" (SQLSTATE 42703)
-- surfaced from public.record_audit_log().
--
-- Cause: the previous function body referenced `NEW.organisation_id`
-- inside a CASE branch guarded by `TG_TABLE_NAME = 'organisations'`.
-- PL/pgSQL still type-checks NEW.<column> access against the trigger's
-- target row type at compile time, so the reference blew up on the
-- organisations table (which has no organisation_id column — its id
-- IS the organisation id) before the CASE could route around it.
--
-- Fix: coerce NEW/OLD to JSONB and pull the columns by name. jsonb
-- lookups aren't compile-checked against the row type, so the same
-- function body works for every audited table including organisations.

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
  v_row    JSONB;
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

  -- JSONB coercion sidesteps the compile-time NEW.<column> type check.
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
  ELSE
    v_row := to_jsonb(NEW);
  END IF;
  v_id := (v_row ->> 'id')::UUID;
  IF TG_TABLE_NAME = 'organisations' THEN
    v_org := v_id;
  ELSE
    v_org := (v_row ->> 'organisation_id')::UUID;
  END IF;

  v_source := NULLIF(current_setting('audit.source', true), '');

  INSERT INTO public.audit_log (organisation_id, actor_user_id, entity_kind, entity_id, op, source)
  VALUES (v_org, auth.uid(), v_kind, v_id, v_op, v_source);

  RETURN COALESCE(NEW, OLD);
END;
$$;
