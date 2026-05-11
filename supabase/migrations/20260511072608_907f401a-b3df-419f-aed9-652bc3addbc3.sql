
-- KB agent chat messages (one conversation per user)
CREATE TABLE public.kb_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kb_chat_messages_user_created ON public.kb_chat_messages(user_id, created_at);
ALTER TABLE public.kb_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kb messages"
  ON public.kb_chat_messages FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own kb messages"
  ON public.kb_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own kb messages"
  ON public.kb_chat_messages FOR DELETE
  USING (auth.uid() = user_id);

-- Feature suggestions
CREATE TABLE public.feature_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  github_issue_url TEXT,
  github_issue_number INTEGER,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feature_suggestions_user ON public.feature_suggestions(user_id, created_at DESC);
ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own suggestions"
  ON public.feature_suggestions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert own suggestions"
  ON public.feature_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_feature_suggestions_updated_at
  BEFORE UPDATE ON public.feature_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
