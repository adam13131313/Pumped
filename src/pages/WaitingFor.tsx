import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { WaitingDialog } from "@/components/WaitingDialog";
import { WaitingItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";

export default function WaitingFor() {
  const items = useAppStore((s) => s.waitingItems);
  const addWaitingItem = useAppStore((s) => s.addWaitingItem);
  const updateWaitingItem = useAppStore((s) => s.updateWaitingItem);
  const deleteWaitingItem = useAppStore((s) => s.deleteWaitingItem);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WaitingItem | null>(null);

  const handleSave = (item: WaitingItem) => {
    if (editing) updateWaitingItem(item.id, item);
    else addWaitingItem(item);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Waiting For</h2>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground hidden sm:block">Review every Wednesday · Send nudges for overdue items</p>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Item
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          Nothing pending. Click "Add Item" when you delegate work or wait on someone.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
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
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors group cursor-pointer" onClick={() => { setEditing(item); setDialogOpen(true); }}>
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
              ))}
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
      />
    </div>
  );
}
