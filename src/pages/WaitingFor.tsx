import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { WaitingDialog } from "@/components/WaitingDialog";
import { WaitingItem, WaitingStatus } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Pencil, Target, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

const statuses: WaitingStatus[] = ["Pending", "Received", "Overdue"];

export default function WaitingFor() {
  const { waitingItems: allItems } = useFilteredData();
  const addWaitingItem = useAppStore((s) => s.addWaitingItem);
  const updateWaitingItem = useAppStore((s) => s.updateWaitingItem);
  const deleteWaitingItem = useAppStore((s) => s.deleteWaitingItem);
  const takeBackWaiting = useAppStore((s) => s.takeBackWaiting);
  const todayIds = useAppStore((s) => s.todayIds);
  const addToday = useAppStore((s) => s.addToday);
  const removeToday = useAppStore((s) => s.removeToday);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WaitingItem | null>(null);

  // Filters
  const [filterDesc, setFilterDesc] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  const items = useMemo(() => {
    return allItems.filter((i) => {
      if (filterDesc && !i.description.toLowerCase().includes(filterDesc.toLowerCase())) return false;
      if (filterFrom && !i.fromWhom.toLowerCase().includes(filterFrom.toLowerCase())) return false;
      if (filterProject && !i.projectWP.toLowerCase().includes(filterProject.toLowerCase())) return false;
      if (filterStatus !== "all" && i.status !== filterStatus) return false;
      return true;
    });
  }, [allItems, filterDesc, filterFrom, filterProject, filterStatus]);

  const hasActiveFilters = filterDesc || filterFrom || filterProject || filterStatus !== "all";

  const clearFilters = () => {
    setFilterDesc("");
    setFilterFrom("");
    setFilterProject("");
    setFilterStatus("all");
  };

  const handleSave = (item: WaitingItem) => {
    if (editing) updateWaitingItem(item.id, item);
    else addWaitingItem(item);
    setEditing(null);
  };

  // Auto-open dialog when navigated from command palette via ?open=<id>
  // Use raw store so global filter doesn't hide the target.
  const allItemsRaw = useAppStore((s) => s.waitingItems);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId) return;
    const target = allItemsRaw.find((w) => w.id === openId);
    if (target) {
      setEditing(target);
      setDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, allItemsRaw, setSearchParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Waiting For</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground hidden sm:block">Review every Wednesday</p>
          <Button
            size="sm"
            variant={showFilters ? "secondary" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="relative"
          >
            <Filter className="mr-1.5 h-4 w-4" /> Filters
            {hasActiveFilters && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <Input
            placeholder="Filter by description..."
            value={filterDesc}
            onChange={(e) => setFilterDesc(e.target.value)}
            className="h-8 w-[180px] text-xs"
          />
          <Input
            placeholder="Filter by from..."
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <Input
            placeholder="Filter by project..."
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="h-8 w-[140px] text-xs"
          />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-[120px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{items.length} of {allItems.length} shown</span>
        </div>
      )}

      {allItems.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          Nothing pending. Click "Add Item" when you delegate work or wait on someone.
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No items match your filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10" />
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">From</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Project</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Asked</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const gathered = todayIds.has(item.id);
                return (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                  <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => gathered ? removeToday(item.id) : addToday(item.id)}
                          className={cn(
                            "h-7 w-7 flex items-center justify-center rounded-md transition-colors",
                            gathered ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <Target className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right">{gathered ? "Remove from today" : "Gather for today"}</TooltipContent>
                    </Tooltip>
                  </td>
                  <td className="max-w-sm px-4 py-3"><p className="font-medium">{item.description}</p></td>
                  <td className="px-4 py-3 text-muted-foreground">{item.fromWhom || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{item.projectWP || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.askedOn || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.dueBy || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      item.status === "Pending" ? "bg-rag-amber-bg text-rag-amber" :
                      item.status === "Overdue" ? "bg-rag-red-bg text-rag-red" :
                      "bg-rag-green-bg text-rag-green"
                    }`}>{item.status}</span>
                  </td>
                  <td className="px-2 py-3">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WaitingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSave={handleSave}
        onDelete={(id) => { deleteWaitingItem(id); setEditing(null); }}
        onTakeBack={(id) => { takeBackWaiting(id); setEditing(null); }}
      />
    </div>
  );
}
