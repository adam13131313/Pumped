-- ============================================================================
-- Pumped v2: task-linked documents
-- ============================================================================
-- Stores external URL references (Google Drive, SharePoint, Dropbox, etc.)
-- against actions, waiting items, or WBS nodes. Pure metadata — no upload,
-- no preview. Mirrors the polymorphic shape of `attachments` and `comments`
-- so a future "show every doc linked to this project" query can union them
-- straightforwardly.
--
-- Apply AFTER 20260520010000_pumped_v2_supplements.sql.
-- ============================================================================


CREATE TABLE public.task_links (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id   UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,

  -- Polymorphic — exactly one of these is set. Same pattern as attachments.
  action_id         UUID,
  waiting_item_id   UUID,
  wbs_node_id       UUID,

  url               TEXT NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2000),
  label             TEXT NOT NULL DEFAULT '' CHECK (char_length(label) <= 200),
  position          INTEGER NOT NULL DEFAULT 0,

  created_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Same-org composite FKs so a link can never dangle across tenants.
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

CREATE INDEX idx_task_links_action  ON public.task_links (action_id)       WHERE action_id       IS NOT NULL;
CREATE INDEX idx_task_links_waiting ON public.task_links (waiting_item_id) WHERE waiting_item_id IS NOT NULL;
CREATE INDEX idx_task_links_node    ON public.task_links (wbs_node_id)     WHERE wbs_node_id     IS NOT NULL;
CREATE INDEX idx_task_links_org     ON public.task_links (organisation_id, created_at DESC);

CREATE TRIGGER task_links_set_updated_at
  BEFORE UPDATE ON public.task_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.task_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_links_select ON public.task_links FOR SELECT TO authenticated
  USING (public.is_org_member(organisation_id));

CREATE POLICY task_links_insert ON public.task_links FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY task_links_update ON public.task_links FOR UPDATE TO authenticated
  USING (public.is_org_member(organisation_id))
  WITH CHECK (public.is_org_member(organisation_id));

CREATE POLICY task_links_delete ON public.task_links FOR DELETE TO authenticated
  USING (public.is_org_member(organisation_id));
