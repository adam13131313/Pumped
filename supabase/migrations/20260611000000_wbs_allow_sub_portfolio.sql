-- Allow sub-portfolios: a portfolio may now be nested under another portfolio.
-- Real PPPM organisations group portfolios into super-portfolios for executive
-- rollup, so the strict "parent must outrank child" rule needs one exception.
-- All other hierarchy rules are unchanged.
--
-- The recursive-CTE cycle check below still catches A→B→A even when both nodes
-- are portfolios — it walks ancestors structurally, not by level.

CREATE OR REPLACE FUNCTION public.enforce_wbs_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_type public.node_type;
  level_of  CONSTANT JSONB := '{"portfolio":4,"programme":3,"project":2,"work_package":1}'::JSONB;
  cycle_hit BOOLEAN;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT node_type INTO parent_type
  FROM public.wbs_nodes WHERE id = NEW.parent_id;

  IF parent_type IS NULL THEN
    RAISE EXCEPTION 'WBS parent % does not exist', NEW.parent_id;
  END IF;

  -- Parent must outrank child in the natural hierarchy. Exception:
  -- portfolio→portfolio (sub-portfolios) is explicitly allowed.
  IF NOT (parent_type = 'portfolio' AND NEW.node_type = 'portfolio') THEN
    IF (level_of ->> parent_type::TEXT)::INT <= (level_of ->> NEW.node_type::TEXT)::INT THEN
      RAISE EXCEPTION 'Invalid WBS parent: % cannot be parent of %', parent_type, NEW.node_type;
    END IF;
  END IF;

  -- Cycle check (only meaningful on UPDATE OF parent_id)
  IF TG_OP = 'UPDATE' THEN
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id FROM public.wbs_nodes WHERE id = NEW.parent_id
      UNION ALL
      SELECT n.id, n.parent_id
      FROM public.wbs_nodes n
      JOIN ancestors a ON n.id = a.parent_id
    )
    SELECT TRUE INTO cycle_hit FROM ancestors WHERE id = NEW.id LIMIT 1;

    IF cycle_hit THEN
      RAISE EXCEPTION 'Cycle detected in WBS hierarchy for node %', NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
