
CREATE TABLE public.routines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  frequency_type TEXT NOT NULL DEFAULT 'daily',
  frequency_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_of_day TEXT NOT NULL DEFAULT 'anytime',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);

ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routines" ON public.routines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.routine_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  routine_id UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  completed_date DATE NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(routine_id, completed_date)
);

ALTER TABLE public.routine_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own routine_completions" ON public.routine_completions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_routine_completions_routine_date ON public.routine_completions(routine_id, completed_date DESC);
CREATE INDEX idx_routines_user ON public.routines(user_id) WHERE archived_at IS NULL;
