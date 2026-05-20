import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Filter, X, ChevronRight } from "lucide-react";
import { NodePicker, nodePath } from "@/components/NodePicker";

// Single-control replacement for the v1 three-dropdown (Programme / Project /
// Work Package) filter. The user picks any wbs_node; the rest of the app
// scopes to that node's subtree via useFilteredData and useDashboardScope.
//
// "Unassigned" remains a discrete mode for surfacing rows with no wbs_node link.

export function GlobalFilter() {
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const globalFilter = useAppStore((s) => s.globalFilter);
  const setGlobalFilter = useAppStore((s) => s.setGlobalFilter);
  const clearGlobalFilter = useAppStore((s) => s.clearGlobalFilter);

  const hasFilter = !!globalFilter.nodeId || globalFilter.unassigned;
  const path = nodePath(wbsNodes, globalFilter.nodeId);

  const toggleUnassigned = () => {
    if (globalFilter.unassigned) {
      clearGlobalFilter();
    } else {
      setGlobalFilter({ nodeId: null, unassigned: true });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 min-w-0">
      <Filter className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

      <div className="flex items-center gap-1 min-w-0">
        <NodePicker
          value={globalFilter.nodeId}
          onChange={(nodeId) => setGlobalFilter({ nodeId, unassigned: false })}
          includeNone
          noneLabel="All work"
          placeholder="All work"
          className="h-7 min-w-[180px] max-w-[280px] text-xs"
        />

        <Button
          variant={globalFilter.unassigned ? "secondary" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={toggleUnassigned}
        >
          Unassigned
        </Button>

        {hasFilter && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => clearGlobalFilter()}
            aria-label="Clear filter"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Breadcrumb of the selected node's path */}
      {path.length > 0 && (
        <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground/80 min-w-0 truncate">
          {path.map((n, i) => (
            <span key={n.id} className="inline-flex items-center gap-1 truncate">
              {i > 0 && <ChevronRight className="h-3 w-3 flex-shrink-0" />}
              <span className="truncate">{n.name}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
