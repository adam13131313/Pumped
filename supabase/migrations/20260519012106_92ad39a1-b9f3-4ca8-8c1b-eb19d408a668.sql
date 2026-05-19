CREATE TABLE public.gathered_state (
  user_id UUID PRIMARY KEY,
  ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  durations JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gathered_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own gathered_state"
ON public.gathered_state FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_gathered_state_updated_at
BEFORE UPDATE ON public.gathered_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();