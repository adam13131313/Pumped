-- Sources table: one row per connected external app
CREATE TABLE public.ingest_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL DEFAULT '',
  last_received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

ALTER TABLE public.ingest_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own ingest_sources"
ON public.ingest_sources
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Extend inbox_items for external dedupe + back-links
ALTER TABLE public.inbox_items
  ADD COLUMN IF NOT EXISTS source_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source_url text NOT NULL DEFAULT '';

-- Idempotent upsert key: same (user, source app, external id) only once
CREATE UNIQUE INDEX IF NOT EXISTS inbox_items_user_source_unique
  ON public.inbox_items (user_id, source, source_id)
  WHERE source_id <> '';