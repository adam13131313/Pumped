-- ============================================================================
-- Extend action_status with cancelled + deferred
-- ============================================================================
-- The original enum only covered the active flow (not_started → in_progress
-- → blocked → complete). Users need two more terminal/paused states:
--   * cancelled — decided not to do this; closed without completion
--   * deferred  — not now, revisit later
--
-- ADD VALUE IF NOT EXISTS keeps this idempotent if it gets re-applied.
-- Postgres ≥ 12 allows ADD VALUE inside a transaction (Supabase runs ≥ 15).
-- ============================================================================

ALTER TYPE public.action_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.action_status ADD VALUE IF NOT EXISTS 'deferred';
