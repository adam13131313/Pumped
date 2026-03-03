-- Add completed_at timestamp to actions for auto-archive tracking
ALTER TABLE public.actions ADD COLUMN completed_at timestamp with time zone DEFAULT NULL;

-- Add archived boolean column
ALTER TABLE public.actions ADD COLUMN archived boolean NOT NULL DEFAULT false;