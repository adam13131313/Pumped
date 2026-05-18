-- Remove all historical action status triggers, including the legacy name that was still firing before inserts
DROP TRIGGER IF EXISTS action_status_log_trg ON public.actions;
DROP TRIGGER IF EXISTS log_action_status_change ON public.actions;
DROP TRIGGER IF EXISTS trg_log_action_status_change ON public.actions;
DROP TRIGGER IF EXISTS trg_action_status_log ON public.actions;
DROP TRIGGER IF EXISTS actions_status_before ON public.actions;
DROP TRIGGER IF EXISTS actions_status_after ON public.actions;
DROP TRIGGER IF EXISTS actions_set_not_started_since ON public.actions;
DROP TRIGGER IF EXISTS actions_log_status_change ON public.actions;

-- This trigger function is intentionally safe if ever attached as BEFORE again:
-- it only writes history after the action row exists.
CREATE OR REPLACE FUNCTION public.log_action_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_WHEN <> 'AFTER' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.action_status_log (action_id, from_status, to_status, user_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.user_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.action_status_log (action_id, from_status, to_status, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_not_started_since()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Not Started' THEN
      NEW.not_started_since := COALESCE(NEW.not_started_since, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Not Started' THEN
      NEW.not_started_since := COALESCE(OLD.not_started_since, now());
    ELSE
      NEW.not_started_since := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER actions_set_not_started_since
BEFORE INSERT OR UPDATE ON public.actions
FOR EACH ROW EXECUTE FUNCTION public.set_not_started_since();

CREATE TRIGGER actions_log_status_change
AFTER INSERT OR UPDATE ON public.actions
FOR EACH ROW EXECUTE FUNCTION public.log_action_status_change();