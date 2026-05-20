-- ============================================================================
-- Pumped v2 Supplemental Schema
-- ============================================================================
-- Tables the original v2 foundation didn't include but the app uses:
--
--   * profiles         — extends auth.users with display name / avatar
--   * gathered_state   — the "Today" pinned-tasks panel (per user × org)
--   * sop_items        — Standard Operating Procedures (per user × org)
--   * attachments      — file uploads attached to actions / waiting / wbs_nodes
--   * comments         — threaded comments on actions / waiting / wbs_nodes
--   * kb_chat_messages — Knowledgebase AI chat history (per user × org)
--   * feature_suggestions — feedback button submissions
--   * email infrastructure (ported verbatim from v1, intentionally NOT org-scoped
--     because email sends are recipient-keyed, not tenant-keyed)
--
-- Apply AFTER 20260520000000_pumped_v2_foundation.sql.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Foundation back-fill — must run BEFORE the attachments / comments tables
-- ----------------------------------------------------------------------------
-- The original v2 foundation migration didn't include UNIQUE (organisation_id, id)
-- on waiting_items, so composite FKs from attachments / comments fail with
-- SQLSTATE 42830 ("no unique constraint matching given keys for referenced
-- table waiting_items"). The foundation file has since been fixed; this block
-- catches up databases that were created before that fix landed.
--
-- Implemented as DROP-then-ADD (instead of a DO block with EXCEPTION) so the
-- ADD runs unconditionally and any real failure surfaces — no silent swallow.
-- DROP IF EXISTS handles repeat runs and also clears the old short-name
-- constraint if a prior attempt left one behind.

ALTER TABLE public.waiting_items
  DROP CONSTRAINT IF EXISTS waiting_items_org_id_key;
ALTER TABLE public.waiting_items
  DROP CONSTRAINT IF EXISTS waiting_items_organisation_id_id_key;
ALTER TABLE public.waiting_items
  ADD CONSTRAINT waiting_items_organisation_id_id_key UNIQUE (organisation_id, id);


-- ----------------------------------------------------------------------------
-- 1. Additional enums
-- ----------------------------------------------------------------------------

CREATE TYPE public.domain_entity_kind AS ENUM ('action', 'waiting_item', 'wbs_node');
CREATE TYPE public.kb_chat_role       AS ENUM ('user', 'assistant', 'system');


-- ============================================================================
-- 2. profiles — one row per auth.users, owned by that user
-- ============================================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT CHECK (display_name IS NULL OR char_length(display_name) BETWEEN 1 AND 200),
  avatar_url    TEXT CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 1000),
  preferences   JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on new auth user. SECURITY DEFINER so it can write
-- to public.profiles regardless of the inserting role.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Org members can read each other's profiles (for assignee names etc.).
-- Owner of the profile is the only writer.
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.memberships m1, public.memberships m2
      WHERE m1.user_id = auth.uid()
        AND m2.user_id = profiles.id
        AND m1.organisation_id = m2.organisation_id
    )
  );

CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- No DELETE policy — profile is cascade-removed via auth.users delete.


-- ============================================================================
-- 3. gathered_state — "Today" pinned tasks (per user × org)
-- ============================================================================
-- One row per (user, org). Task IDs reference actions but are stored as a UUID
-- array (Postgres doesn't support FKs on array elements); the client filters
-- out orphans when an action is deleted.

CREATE TABLE public.gathered_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  task_ids        UUID[]  NOT NULL DEFAULT ARRAY[]::UUID[],
  order_ids       UUID[]  NOT NULL DEFAULT ARRAY[]::UUID[],
  schedule        JSONB   NOT NULL DEFAULT '{}'::JSONB,
  durations       JSONB   NOT NULL DEFAULT '{}'::JSONB,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, organisation_id)
);

CREATE INDEX idx_gathered_user_org ON public.gathered_state (user_id, organisation_id);

CREATE TRIGGER gathered_state_set_updated_at
  BEFORE UPDATE ON public.gathered_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.gathered_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY gathered_select ON public.gathered_state FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY gathered_insert ON public.gathered_state FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organisation_id));

CREATE POLICY gathered_update ON public.gathered_state FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY gathered_delete ON public.gathered_state FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- 4. sop_items — Standard Operating Procedures (per user × org)
-- ============================================================================
-- Personal even inside an org (e.g. "I review my actions every Monday").
-- Shared/org-wide SOPs are a future extension.

CREATE TABLE public.sop_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  owner_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  trigger_when     TEXT NOT NULL CHECK (char_length(trigger_when) BETWEEN 1 AND 200),
  instruction      TEXT NOT NULL CHECK (char_length(instruction) <= 5000),
  position         INTEGER NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sop_owner_org ON public.sop_items (owner_user_id, organisation_id);

CREATE TRIGGER sop_items_set_updated_at
  BEFORE UPDATE ON public.sop_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.sop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY sop_select ON public.sop_items FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY sop_insert ON public.sop_items FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid() AND public.is_org_member(organisation_id));

CREATE POLICY sop_update ON public.sop_items FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY sop_delete ON public.sop_items FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());


-- ============================================================================
-- 5. attachments — file uploads on actions / waiting / wbs_nodes
-- ============================================================================
-- Polymorphic via three nullable FK columns + a CHECK that exactly one is set.
-- This pattern gives real FK integrity (ON DELETE CASCADE) on each branch
-- instead of relying on triggers or a generic entity_id field.

CREATE TABLE public.attachments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  action_id         UUID,
  waiting_item_id   UUID,
  wbs_node_id       UUID,

  storage_path      TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 2000),
  original_filename TEXT NOT NULL CHECK (char_length(original_filename) BETWEEN 1 AND 500),
  mime_type         TEXT NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 200),
  size_bytes        BIGINT NOT NULL CHECK (size_bytes >= 0),

  uploader_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same-org composite FKs for each polymorphic branch
  FOREIGN KEY (organisation_id, action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, waiting_item_id)
    REFERENCES public.waiting_items(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE,

  -- Exactly one parent must be set
  CONSTRAINT exactly_one_parent CHECK (
    (action_id       IS NOT NULL)::INT +
    (waiting_item_id IS NOT NULL)::INT +
    (wbs_node_id     IS NOT NULL)::INT = 1
  )
);

CREATE INDEX idx_attachments_action  ON public.attachments (action_id)       WHERE action_id       IS NOT NULL;
CREATE INDEX idx_attachments_waiting ON public.attachments (waiting_item_id) WHERE waiting_item_id IS NOT NULL;
CREATE INDEX idx_attachments_node    ON public.attachments (wbs_node_id)     WHERE wbs_node_id     IS NOT NULL;
CREATE INDEX idx_attachments_org     ON public.attachments (organisation_id, created_at DESC);

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY attachments_select ON public.attachments FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY attachments_insert ON public.attachments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id) AND uploader_id = auth.uid());

CREATE POLICY attachments_delete ON public.attachments FOR DELETE TO authenticated
  USING (
    public.is_org_member(organisation_id)
    AND (
      uploader_id = auth.uid()
      OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
    )
  );

-- Storage bucket + policies for the attachments uploads themselves.
-- Bucket is private (public = false); access goes through signed URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage objects are gated by their path: organisation_id/<rest>. RLS on
-- storage.objects checks the first path segment matches a membership.
CREATE POLICY attachments_storage_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
  );

CREATE POLICY attachments_storage_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
    AND owner = auth.uid()
  );

CREATE POLICY attachments_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND public.is_org_member((storage.foldername(name))[1]::UUID)
    AND (
      owner = auth.uid()
      OR public.has_org_role((storage.foldername(name))[1]::UUID, ARRAY['owner','admin']::public.membership_role[])
    )
  );


-- ============================================================================
-- 6. comments — threaded comments on actions / waiting / wbs_nodes
-- ============================================================================

CREATE TABLE public.comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  action_id         UUID,
  waiting_item_id   UUID,
  wbs_node_id       UUID,

  parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  author_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  content           TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  edited            BOOLEAN NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  FOREIGN KEY (organisation_id, action_id)
    REFERENCES public.actions(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, waiting_item_id)
    REFERENCES public.waiting_items(organisation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id, wbs_node_id)
    REFERENCES public.wbs_nodes(organisation_id, id) ON DELETE CASCADE,

  CONSTRAINT exactly_one_parent CHECK (
    (action_id       IS NOT NULL)::INT +
    (waiting_item_id IS NOT NULL)::INT +
    (wbs_node_id     IS NOT NULL)::INT = 1
  )
);

CREATE INDEX idx_comments_action       ON public.comments (action_id, created_at)       WHERE action_id       IS NOT NULL;
CREATE INDEX idx_comments_waiting      ON public.comments (waiting_item_id, created_at) WHERE waiting_item_id IS NOT NULL;
CREATE INDEX idx_comments_node         ON public.comments (wbs_node_id, created_at)     WHERE wbs_node_id     IS NOT NULL;
CREATE INDEX idx_comments_parent       ON public.comments (parent_comment_id)            WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_comments_org_recent   ON public.comments (organisation_id, created_at DESC);

CREATE TRIGGER comments_set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Mark `edited` whenever content changes after creation.
CREATE OR REPLACE FUNCTION public.mark_comment_edited()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content <> OLD.content THEN
    NEW.edited := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER comments_mark_edited
  BEFORE UPDATE OF content ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.mark_comment_edited();

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY comments_select ON public.comments FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY comments_insert ON public.comments FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id) AND author_id = auth.uid());

-- Update / delete: author OR owner/admin (moderation).
CREATE POLICY comments_update ON public.comments FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );

CREATE POLICY comments_delete ON public.comments FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );


-- ============================================================================
-- 7. kb_chat_messages — Knowledgebase AI chat history
-- ============================================================================

CREATE TABLE public.kb_chat_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  role             public.kb_chat_role NOT NULL,
  content          TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 32000),

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kb_chat_user_time ON public.kb_chat_messages (user_id, created_at);

ALTER TABLE public.kb_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY kb_chat_select ON public.kb_chat_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY kb_chat_insert ON public.kb_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_org_member(organisation_id));

CREATE POLICY kb_chat_delete ON public.kb_chat_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ============================================================================
-- 8. feature_suggestions — feedback button submissions
-- ============================================================================

CREATE TABLE public.feature_suggestions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id     UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  title               TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description         TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  github_issue_url    TEXT CHECK (github_issue_url IS NULL OR char_length(github_issue_url) <= 1000),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestions_org_time ON public.feature_suggestions (organisation_id, created_at DESC);
CREATE INDEX idx_suggestions_user     ON public.feature_suggestions (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suggestions_select ON public.feature_suggestions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organisation_id, ARRAY['owner','admin']::public.membership_role[])
  );

CREATE POLICY suggestions_insert ON public.feature_suggestions FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id) AND user_id = auth.uid());


-- ============================================================================
-- 9. Email infrastructure
-- ============================================================================
-- Ported verbatim from v1's 20260501121310_email_infra.sql. Intentionally NOT
-- org-scoped: outbound emails are recipient-keyed (an email address belongs
-- to a person, not an organisation), and the suppression list / rate-limit
-- state are global by design.
--
-- Post-migration steps (vault secret + pg_cron schedule) still apply; see
-- the v1 file's tail comment for the SQL.

CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    CREATE EXTENSION pg_cron;
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS supabase_vault;
CREATE EXTENSION IF NOT EXISTS pgmq;

DO $$ BEGIN PERFORM pgmq.create('auth_emails');             EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails');    EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('auth_emails_dlq');         EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN PERFORM pgmq.create('transactional_emails_dlq'); EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 9.1 email_send_log — audit trail for every send attempt
CREATE TABLE public.email_send_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id       TEXT,
  template_name    TEXT NOT NULL,
  recipient_email  TEXT NOT NULL,
  status           TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'suppressed', 'failed', 'bounced', 'complained', 'dlq')),
  error_message    TEXT,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_log_created     ON public.email_send_log (created_at DESC);
CREATE INDEX idx_email_log_recipient   ON public.email_send_log (recipient_email);
CREATE INDEX idx_email_log_message     ON public.email_send_log (message_id);

-- DB-level safety net against duplicate sends on the same message_id
CREATE UNIQUE INDEX idx_email_log_message_sent_unique
  ON public.email_send_log (message_id)
  WHERE status = 'sent';

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_log_select ON public.email_send_log FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY email_log_insert ON public.email_send_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY email_log_update ON public.email_send_log FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 9.2 email_send_state — rate-limit cooldown + queue config (single row)
CREATE TABLE public.email_send_state (
  id                               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  retry_after_until                TIMESTAMPTZ,
  batch_size                       INTEGER NOT NULL DEFAULT 10,
  send_delay_ms                    INTEGER NOT NULL DEFAULT 200,
  auth_email_ttl_minutes           INTEGER NOT NULL DEFAULT 15,
  transactional_email_ttl_minutes  INTEGER NOT NULL DEFAULT 60,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.email_send_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.email_send_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_state_all ON public.email_send_state FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 9.3 suppressed_emails — bounces / complaints / unsubscribes (append-only)
CREATE TABLE public.suppressed_emails (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  reason      TEXT NOT NULL CHECK (reason IN ('unsubscribe', 'bounce', 'complaint')),
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppressed_emails_email ON public.suppressed_emails (email);

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppressed_select ON public.suppressed_emails FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY suppressed_insert ON public.suppressed_emails FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 9.4 email_unsubscribe_tokens — one token per email address
CREATE TABLE public.email_unsubscribe_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       TEXT NOT NULL UNIQUE,
  email       TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at     TIMESTAMPTZ
);

CREATE INDEX idx_unsubscribe_tokens_token ON public.email_unsubscribe_tokens (token);

ALTER TABLE public.email_unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY unsub_select ON public.email_unsubscribe_tokens FOR SELECT
  USING (auth.role() = 'service_role');
CREATE POLICY unsub_insert ON public.email_unsubscribe_tokens FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY unsub_update ON public.email_unsubscribe_tokens FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 9.5 pgmq RPC wrappers (PostgREST only exposes public-schema functions;
-- pgmq lives in the pgmq schema). All wrappers auto-create the queue on
-- undefined_table (42P01) so emails aren't lost if a queue was dropped.

CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name TEXT, payload JSONB)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.send(queue_name, payload);
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN pgmq.send(queue_name, payload);
END;
$$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name TEXT, batch_size INT, vt INT)
RETURNS TABLE(msg_id BIGINT, read_ct INT, message JSONB)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT r.msg_id, r.read_ct, r.message FROM pgmq.read(queue_name, vt, batch_size) r;
EXCEPTION WHEN undefined_table THEN
  PERFORM pgmq.create(queue_name);
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name TEXT, message_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, message_id);
EXCEPTION WHEN undefined_table THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(
  source_queue TEXT, dlq_name TEXT, message_id BIGINT, payload JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
EXCEPTION WHEN undefined_table THEN
  BEGIN PERFORM pgmq.create(dlq_name); EXCEPTION WHEN OTHERS THEN NULL; END;
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  BEGIN PERFORM pgmq.delete(source_queue, message_id); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_email(TEXT, JSONB)        TO service_role;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.read_email_batch(TEXT, INT, INT)  TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)        FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_email(TEXT, BIGINT)        TO service_role;

REVOKE EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.move_to_dlq(TEXT, TEXT, BIGINT, JSONB) TO service_role;


-- ============================================================================
-- 10. Done
-- ============================================================================
-- POST-MIGRATION STEPS for email infra (verbatim from v1):
--   1. Vault secret: store the service_role key as
--      'email_queue_service_role_key' so process-email-queue can authenticate.
--      Use vault.create_secret / vault.update_secret.
--   2. pg_cron schedule: SELECT cron.schedule('process-email-queue',
--      '*/5 * * * * *', $$ ... net.http_post(...) ... $$);
--      Run from the Supabase SQL editor with the project's specific URL +
--      vault secret reference. See v1_archive/20260501121310_email_infra.sql
--      tail comment for the exact post-migration SQL.
-- ============================================================================
