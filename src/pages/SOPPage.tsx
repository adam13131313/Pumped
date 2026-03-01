import { useState } from "react";
import { useAppStore, SOPItem } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, Check, X, BookOpen } from "lucide-react";

export default function SOPPage() {
  const sopItems = useAppStore((s) => s.sopItems);
  const updateSOPItem = useAppStore((s) => s.updateSOPItem);
  const addSOPItem = useAppStore((s) => s.addSOPItem);
  const deleteSOPItem = useAppStore((s) => s.deleteSOPItem);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ when: string; instruction: string }>({ when: "", instruction: "" });
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<{ when: string; instruction: string }>({ when: "", instruction: "" });

  const startEdit = (item: SOPItem) => {
    setEditingId(item.id);
    setEditForm({ when: item.when, instruction: item.instruction });
  };

  const saveEdit = () => {
    if (editingId && editForm.when.trim() && editForm.instruction.trim()) {
      updateSOPItem(editingId, { when: editForm.when.trim(), instruction: editForm.instruction.trim() });
    }
    setEditingId(null);
  };

  const saveNew = () => {
    if (newForm.when.trim() && newForm.instruction.trim()) {
      addSOPItem({ id: crypto.randomUUID(), when: newForm.when.trim(), instruction: newForm.instruction.trim() });
      setNewForm({ when: "", instruction: "" });
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Standard Operating Procedure</h2>
            <p className="text-sm text-muted-foreground">Your planning rhythm — click any item to edit</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Step
        </Button>
      </div>

      <div className="space-y-3">
        {sopItems.map((item) => (
          <div key={item.id} className="rounded-lg border bg-card transition-shadow hover:shadow-sm">
            {editingId === item.id ? (
              <div className="p-4 space-y-3">
                <Input
                  value={editForm.when}
                  onChange={(e) => setEditForm({ ...editForm, when: e.target.value })}
                  placeholder="When (e.g., Monday 30 min)"
                  maxLength={100}
                />
                <Textarea
                  value={editForm.instruction}
                  onChange={(e) => setEditForm({ ...editForm, instruction: e.target.value })}
                  rows={4}
                  placeholder="Instructions..."
                  maxLength={2000}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit} disabled={!editForm.when.trim() || !editForm.instruction.trim()}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    <X className="mr-1 h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => { deleteSOPItem(item.id); setEditingId(null); }} className="ml-auto">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 p-4 group cursor-pointer" onClick={() => startEdit(item)}>
                <div className="min-w-[140px] shrink-0">
                  <span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    {item.when}
                  </span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line flex-1">{item.instruction}</p>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="rounded-lg border-2 border-dashed border-primary/30 bg-card p-4 space-y-3">
            <Input
              value={newForm.when}
              onChange={(e) => setNewForm({ ...newForm, when: e.target.value })}
              placeholder="When (e.g., Friday 15 min)"
              maxLength={100}
              autoFocus
            />
            <Textarea
              value={newForm.instruction}
              onChange={(e) => setNewForm({ ...newForm, instruction: e.target.value })}
              rows={3}
              placeholder="What to do..."
              maxLength={2000}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveNew} disabled={!newForm.when.trim() || !newForm.instruction.trim()}>
                <Check className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setAdding(false); setNewForm({ when: "", instruction: "" }); }}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
            </div>
          </div>
        )}

        {sopItems.length === 0 && !adding && (
          <div className="rounded-lg border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
            No SOP steps yet. Click "Add Step" to define your planning rhythm.
          </div>
        )}
      </div>
    </div>
  );
}
