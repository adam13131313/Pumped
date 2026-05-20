
-- Make action_id nullable and add item_type + waiting_item_id + work_package_id
ALTER TABLE public.task_attachments 
  ALTER COLUMN action_id DROP NOT NULL;

-- Add item_type column to distinguish attachment owners
ALTER TABLE public.task_attachments 
  ADD COLUMN item_type text NOT NULL DEFAULT 'action';

-- Add waiting_item_id column
ALTER TABLE public.task_attachments 
  ADD COLUMN waiting_item_id uuid REFERENCES public.waiting_items(id) ON DELETE CASCADE;

-- Add work_package_id column
ALTER TABLE public.task_attachments 
  ADD COLUMN work_package_id uuid REFERENCES public.work_packages(id) ON DELETE CASCADE;

-- Drop the existing FK on action_id so it can be nullable
ALTER TABLE public.task_attachments 
  DROP CONSTRAINT IF EXISTS task_attachments_action_id_fkey;

ALTER TABLE public.task_attachments 
  ADD CONSTRAINT task_attachments_action_id_fkey 
  FOREIGN KEY (action_id) REFERENCES public.actions(id) ON DELETE CASCADE;

-- Add storage policies for the new item types (same bucket, different folder patterns)
CREATE POLICY "Users can upload waiting attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view waiting attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete waiting attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'task-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
