
-- =========================================================
-- Pumped Pulse Dashboard schema
-- =========================================================

-- 1. rag_status_history
CREATE TABLE public.rag_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_package_id uuid NOT NULL REFERENCES public.work_packages(id) ON DELETE CASCADE,
  rag_status text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);
CREATE INDEX idx_rag_status_history_user_recorded ON public.rag_status_history(user_id, recorded_at);
CREATE INDEX idx_rag_status_history_wp ON public.rag_status_history(work_package_id);
ALTER TABLE public.rag_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rag_status_history"
  ON public.rag_status_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. action_status_log
CREATE TABLE public.action_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.actions(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL
);
CREATE INDEX idx_action_status_log_user_changed ON public.action_status_log(user_id, changed_at);
CREATE INDEX idx_action_status_log_action ON public.action_status_log(action_id);
ALTER TABLE public.action_status_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own action_status_log"
  ON public.action_status_log FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. inbox_item_events
CREATE TABLE public.inbox_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inbox_item_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('promoted','deleted')),
  event_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT '',
  created_at_snapshot timestamptz
);
CREATE INDEX idx_inbox_item_events_user_at ON public.inbox_item_events(user_id, event_at);
ALTER TABLE public.inbox_item_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own inbox_item_events"
  ON public.inbox_item_events FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. health_score_history
CREATE TABLE public.health_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  score integer NOT NULL,
  on_time_component integer NOT NULL DEFAULT 0,
  overdue_waiting_component integer NOT NULL DEFAULT 0,
  routine_component integer NOT NULL DEFAULT 0,
  rag_component integer NOT NULL DEFAULT 0,
  inbox_lag_component integer NOT NULL DEFAULT 0,
  recorded_week date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, recorded_week)
);
CREATE INDEX idx_health_score_history_user_week ON public.health_score_history(user_id, recorded_week);
ALTER TABLE public.health_score_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own health_score_history"
  ON public.health_score_history FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Add columns
ALTER TABLE public.actions ADD COLUMN IF NOT EXISTS not_started_since timestamptz;
ALTER TABLE public.waiting_items ADD COLUMN IF NOT EXISTS linked_project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

-- 6. Triggers

-- Work package RAG status logging
CREATE OR REPLACE FUNCTION public.log_wp_rag_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rag_status_history (work_package_id, rag_status, user_id)
    VALUES (NEW.id, COALESCE(NEW.rag_status, 'Green'), NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.rag_status IS DISTINCT FROM OLD.rag_status THEN
    INSERT INTO public.rag_status_history (work_package_id, rag_status, user_id)
    VALUES (NEW.id, NEW.rag_status, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wp_rag_history_trg ON public.work_packages;
CREATE TRIGGER wp_rag_history_trg
AFTER INSERT OR UPDATE OF rag_status ON public.work_packages
FOR EACH ROW EXECUTE FUNCTION public.log_wp_rag_change();

-- Action status logging + not_started_since maintenance
CREATE OR REPLACE FUNCTION public.log_action_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'Not Started' THEN
      NEW.not_started_since := COALESCE(NEW.not_started_since, now());
    END IF;
    INSERT INTO public.action_status_log (action_id, from_status, to_status, user_id)
    VALUES (NEW.id, NULL, NEW.status, NEW.user_id);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'Not Started' THEN
      NEW.not_started_since := COALESCE(OLD.not_started_since, now());
    ELSE
      NEW.not_started_since := NULL;
    END IF;
    INSERT INTO public.action_status_log (action_id, from_status, to_status, user_id)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS action_status_log_trg ON public.actions;
CREATE TRIGGER action_status_log_trg
BEFORE INSERT OR UPDATE OF status ON public.actions
FOR EACH ROW EXECUTE FUNCTION public.log_action_status_change();

-- 7. Backfills

-- Seed rag_status_history with current state for existing work packages
INSERT INTO public.rag_status_history (work_package_id, rag_status, recorded_at, user_id)
SELECT id, COALESCE(rag_status, 'Green'), created_at, user_id
FROM public.work_packages
WHERE NOT EXISTS (
  SELECT 1 FROM public.rag_status_history h WHERE h.work_package_id = work_packages.id
);

-- Set not_started_since for existing Not Started actions
UPDATE public.actions
SET not_started_since = created_at
WHERE status = 'Not Started' AND not_started_since IS NULL;
