import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppStore } from "@/lib/store";
import type { Routine, RoutineCompletion, RoutineFrequency, RoutineTimeOfDay } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Sun, CloudSun, Moon, Sparkles, Flame, Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { addDays, differenceInCalendarDays, format, isSameDay, parseISO, startOfDay, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// v2 Routines. Personal habits stored per (organisation, owner_user). The
// store owns CRUD + completion writes; this component only renders the
// state and dispatches.

const TOD_META: Record<RoutineTimeOfDay, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  morning: { label: "Morning", icon: Sun },
  afternoon: { label: "Afternoon", icon: CloudSun },
  evening: { label: "Evening", icon: Moon },
  anytime: { label: "Anytime", icon: Sparkles },
};
const TOD_ORDER: RoutineTimeOfDay[] = ["morning", "afternoon", "evening", "anytime"];

const WEEKDAYS = [
  { v: 1, s: "M" }, { v: 2, s: "T" }, { v: 3, s: "W" },
  { v: 4, s: "T" }, { v: 5, s: "F" }, { v: 6, s: "S" }, { v: 0, s: "S" },
];

function freqDays(r: Routine): number[] {
  const days = (r.frequencyConfig as { days?: number[] })?.days;
  return Array.isArray(days) ? days : [];
}
function freqTarget(r: Routine): number {
  const target = (r.frequencyConfig as { target?: number })?.target;
  return typeof target === "number" ? target : 1;
}

function isDueOn(routine: Routine, date: Date): boolean {
  if (routine.archivedAt) return false;
  if (routine.frequencyType === "daily") return true;
  if (routine.frequencyType === "weekly_days") return freqDays(routine).includes(date.getDay());
  // weekly_count: shown every day until target met for the week
  return true;
}

function calcStreak(routine: Routine, comps: RoutineCompletion[]): { current: number; longest: number } {
  const set = new Set(comps.map((c) => c.completedDate));
  if (routine.frequencyType === "weekly_count") {
    const target = freqTarget(routine);
    const byWeek = new Map<string, number>();
    for (const c of comps) {
      const d = parseISO(c.completedDate);
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
    }
    let current = 0;
    let cursor = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    while ((byWeek.get(cursor) ?? 0) >= target) {
      current++;
      cursor = format(addDays(parseISO(cursor), -7), "yyyy-MM-dd");
    }
    let longest = 0, run = 0, prev: string | null = null;
    for (const [wk, count] of Array.from(byWeek.entries()).sort()) {
      if (count >= target) {
        if (!prev || differenceInCalendarDays(parseISO(wk), parseISO(prev)) === 7) run++;
        else run = 1;
        longest = Math.max(longest, run);
        prev = wk;
      } else {
        run = 0; prev = null;
      }
    }
    return { current, longest };
  }
  // daily / weekly_days
  let current = 0;
  let cursor = startOfDay(new Date());
  if (!set.has(format(cursor, "yyyy-MM-dd")) && isDueOn(routine, cursor)) {
    cursor = addDays(cursor, -1);
  } else if (set.has(format(cursor, "yyyy-MM-dd"))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  let guard = 0;
  while (guard++ < 3650) {
    if (!isDueOn(routine, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (set.has(format(cursor, "yyyy-MM-dd"))) {
      current++;
      cursor = addDays(cursor, -1);
    } else break;
  }

  // longest
  const sortedDates = Array.from(set).sort();
  let longest = 0, run = 0, prev: Date | null = null;
  for (const ds of sortedDates) {
    const d = parseISO(ds);
    if (!prev) { run = 1; }
    else {
      let c = addDays(prev, 1);
      let consecutive = true;
      while (c < d) {
        if (isDueOn(routine, c)) { consecutive = false; break; }
        c = addDays(c, 1);
      }
      run = consecutive ? run + 1 : 1;
    }
    longest = Math.max(longest, run);
    prev = d;
  }
  return { current, longest };
}

export default function RoutinesPage() {
  const { user } = useAuth();
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);
  const routines = useAppStore((s) => s.routines);
  const completions = useAppStore((s) => s.routineCompletions);
  const addRoutine = useAppStore((s) => s.addRoutine);
  const updateRoutine = useAppStore((s) => s.updateRoutine);
  const deleteRoutine = useAppStore((s) => s.deleteRoutine);
  const addRoutineCompletion = useAppStore((s) => s.addRoutineCompletion);
  const deleteRoutineCompletion = useAppStore((s) => s.deleteRoutineCompletion);

  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);

  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");

  const dueToday = useMemo(
    () => routines.filter((r) => !r.archivedAt && isDueOn(r, today) && !skipped.has(r.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [routines, skipped],
  );
  const completedToday = useMemo(
    () => new Set(completions.filter((c) => c.completedDate === todayKey).map((c) => c.routineId)),
    [completions, todayKey],
  );

  const doneCount = dueToday.filter((r) => completedToday.has(r.id)).length;
  const totalCount = dueToday.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  const toggleComplete = async (routine: Routine) => {
    if (!user || !currentOrg) return;
    if (navigator.vibrate) navigator.vibrate(10);
    const isDone = completedToday.has(routine.id);
    if (isDone) {
      const existing = completions.find((c) => c.routineId === routine.id && c.completedDate === todayKey);
      if (existing) deleteRoutineCompletion(existing.id);
      return;
    }
    addRoutineCompletion({
      id: crypto.randomUUID(),
      organisationId: currentOrg.id,
      routineId: routine.id,
      userId: user.id,
      completedDate: todayKey,
      createdAt: new Date().toISOString(),
    });
    // Confetti only when we've crossed into "all done".
    if (doneCount + 1 === totalCount && totalCount > 0) {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 } });
    }
  };

  const skipToday = (routine: Routine) => {
    setSkipped((prev) => new Set(prev).add(routine.id));
    toast(`Skipped "${routine.name}" today — streak safe`);
  };

  const handleArchive = (r: Routine, archive: boolean) => {
    updateRoutine(r.id, { archivedAt: archive ? new Date().toISOString() : null });
  };

  const handleDelete = (r: Routine) => {
    deleteRoutine(r.id);
    toast.success(`Deleted "${r.name}"`);
  };

  const toggleCompletionForDate = (routineId: string, dateStr: string) => {
    if (!user || !currentOrg) return;
    const existing = completions.find((c) => c.routineId === routineId && c.completedDate === dateStr);
    if (existing) {
      deleteRoutineCompletion(existing.id);
      return;
    }
    addRoutineCompletion({
      id: crypto.randomUUID(),
      organisationId: currentOrg.id,
      routineId,
      userId: user.id,
      completedDate: dateStr,
      createdAt: new Date().toISOString(),
    });
  };

  if (!user || !currentOrg || !currentMembership) {
    return (
      <div className="p-8 text-center text-muted-foreground">Sign in to track routines.</div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24 pt-6 sm:pt-10">
      <header className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{format(today, "EEEE")}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{format(today, "MMMM d")}</h1>
        </div>
        <QuickAddButton
          open={dialogOpen}
          setOpen={(v) => { setDialogOpen(v); if (!v) setEditing(null); }}
          editing={editing}
          onSave={(payload) => {
            const now = new Date().toISOString();
            if (editing) {
              updateRoutine(editing.id, payload);
              toast.success("Updated");
            } else {
              addRoutine({
                id: crypto.randomUUID(),
                organisationId: currentOrg.id,
                ownerUserId: user.id,
                name: payload.name,
                description: "",
                timeOfDay: payload.timeOfDay,
                frequencyType: payload.frequencyType,
                frequencyConfig: payload.frequencyConfig,
                archivedAt: null,
                createdAt: now,
                updatedAt: now,
              });
              toast.success("Routine added");
            }
            setEditing(null);
            setDialogOpen(false);
          }}
        />
      </header>

      <Tabs defaultValue="today" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-6 space-y-6">
          {totalCount > 0 && (
            <CompletionRing done={doneCount} total={totalCount} pct={pct} />
          )}
          {totalCount === 0 ? (
            <EmptyState onAdd={() => setDialogOpen(true)} />
          ) : (
            TOD_ORDER.map((tod) => {
              const items = dueToday.filter((r) => r.timeOfDay === tod);
              if (items.length === 0) return null;
              const sorted = [...items].sort((a, b) => {
                const ad = completedToday.has(a.id) ? 1 : 0;
                const bd = completedToday.has(b.id) ? 1 : 0;
                return ad - bd;
              });
              const Icon = TOD_META[tod].icon;
              return (
                <section key={tod} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {TOD_META[tod].label}
                  </div>
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {sorted.map((r) => (
                        <RoutineRow
                          key={r.id}
                          routine={r}
                          done={completedToday.has(r.id)}
                          completions={completions.filter((c) => c.routineId === r.id)}
                          onToggle={() => toggleComplete(r)}
                          onSkip={() => skipToday(r)}
                          onEdit={() => { setEditing(r); setDialogOpen(true); }}
                        />
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-6">
          <WeekGrid
            routines={routines.filter((r) => !r.archivedAt)}
            completions={completions}
            onToggle={toggleCompletionForDate}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          <AllRoutinesList
            routines={routines}
            completions={completions}
            onArchive={(r) => handleArchive(r, true)}
            onUnarchive={(r) => handleArchive(r, false)}
            onEdit={(r) => { setEditing(r); setDialogOpen(true); }}
            onDelete={handleDelete}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompletionRing({ done, total, pct }: { done: number; total: number; pct: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-sm">
      <div className="relative h-24 w-24">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
          <motion.circle
            cx="50" cy="50" r={r}
            className="fill-none stroke-primary"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={false}
            animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
          {pct}%
        </div>
      </div>
      <div>
        <div className="text-2xl font-semibold">{done} of {total} done</div>
        <p className="text-sm text-muted-foreground">
          {pct === 100 ? "All done — nice work" : "Keep going at your pace"}
        </p>
      </div>
    </div>
  );
}

function RoutineRow({
  routine, done, completions, onToggle, onSkip, onEdit,
}: {
  routine: Routine;
  done: boolean;
  completions: RoutineCompletion[];
  onToggle: () => void;
  onSkip: () => void;
  onEdit: () => void;
}) {
  const { current, longest } = useMemo(() => calcStreak(routine, completions), [routine, completions]);
  const [dragX, setDragX] = useState(0);
  const longPressRef = useLongPress(onEdit);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: done ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      drag="x"
      dragConstraints={{ left: -120, right: 0 }}
      dragElastic={0.2}
      onDrag={(_, info) => setDragX(info.offset.x)}
      onDragEnd={(_, info) => {
        setDragX(0);
        if (info.offset.x < -80) onSkip();
      }}
      className={cn(
        "relative touch-pan-y select-none rounded-2xl border bg-card transition-colors",
        done && "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30",
      )}
    >
      {dragX < -10 && (
        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
          Skip today
        </div>
      )}
      <button
        {...longPressRef}
        onClick={onToggle}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <motion.span
          whileTap={{ scale: 0.85 }}
          animate={done ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            done
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-muted-foreground/30 bg-background",
          )}
        >
          {done && (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </motion.span>
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-base font-medium", done && "line-through decoration-2")}>
            {routine.name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <FrequencyLabel routine={routine} />
          </div>
        </div>
        {current > 0 && (
          <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5" />
            {current}
            {longest > current && <span className="text-amber-600/60">/ {longest}</span>}
          </div>
        )}
      </button>
    </motion.li>
  );
}

function FrequencyLabel({ routine }: { routine: Routine }) {
  if (routine.frequencyType === "daily") return <span>Daily</span>;
  if (routine.frequencyType === "weekly_days") {
    const days = freqDays(routine);
    const labels = ["S", "M", "T", "W", "T", "F", "S"];
    return <span>{days.map((d) => labels[d]).join(" · ")}</span>;
  }
  return <span>{freqTarget(routine)}× per week</span>;
}

function useLongPress(callback: () => void, ms = 500) {
  const [timer, setTimer] = useState<number | null>(null);
  return {
    onPointerDown: () => {
      const t = window.setTimeout(callback, ms);
      setTimer(t);
    },
    onPointerUp: () => { if (timer) { clearTimeout(timer); setTimer(null); } },
    onPointerLeave: () => { if (timer) { clearTimeout(timer); setTimer(null); } },
  };
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">A fresh start</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Routines build momentum. Pick one small thing to do today.
      </p>
      <Button onClick={onAdd} className="mt-5 rounded-full">
        <Plus className="mr-1 h-4 w-4" /> Add your first routine
      </Button>
    </div>
  );
}

function WeekGrid({
  routines, completions, onToggle,
}: {
  routines: Routine[];
  completions: RoutineCompletion[];
  onToggle: (routineId: string, dateStr: string) => void;
}) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  if (routines.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No routines yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 px-1 text-xs text-muted-foreground">Tap a day to mark a routine complete or undo it.</p>
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="text-left font-normal"></th>
            {days.map((d) => (
              <th key={d.toISOString()} className="w-10 text-center font-normal">
                <div>{format(d, "EEEEE")}</div>
                <div className={cn("mt-0.5 text-xs", isSameDay(d, today) && "font-bold text-primary")}>
                  {format(d, "d")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routines.map((r) => (
            <tr key={r.id}>
              <td className="pr-3 text-sm">{r.name}</td>
              {days.map((d) => {
                const ds = format(d, "yyyy-MM-dd");
                const did = completions.some((c) => c.routineId === r.id && c.completedDate === ds);
                const due = isDueOn(r, d);
                const isFuture = d > startOfDay(today) && !isSameDay(d, today);
                return (
                  <td key={ds} className="text-center">
                    <button
                      type="button"
                      disabled={isFuture}
                      onClick={() => onToggle(r.id, ds)}
                      aria-label={`${did ? "Unmark" : "Mark"} ${r.name} on ${ds}`}
                      className={cn(
                        "mx-auto block h-7 w-7 rounded-full transition-transform",
                        !isFuture && "hover:scale-110 active:scale-95 cursor-pointer",
                        isFuture && "cursor-not-allowed opacity-40",
                        did
                          ? "bg-emerald-500"
                          : due
                            ? "border border-dashed border-muted-foreground/40"
                            : "bg-muted/40",
                      )}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AllRoutinesList({
  routines, completions, onArchive, onUnarchive, onEdit, onDelete,
}: {
  routines: Routine[];
  completions: RoutineCompletion[];
  onArchive: (r: Routine) => void;
  onUnarchive: (r: Routine) => void;
  onEdit: (r: Routine) => void;
  onDelete: (r: Routine) => void;
}) {
  const active = routines.filter((r) => !r.archivedAt);
  const archived = routines.filter((r) => r.archivedAt);
  return (
    <div className="space-y-6">
      <Section title="Active">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active routines.</p>
        ) : active.map((r) => {
          const { current, longest } = calcStreak(r, completions.filter((c) => c.routineId === r.id));
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  <FrequencyLabel routine={r} /> · {TOD_META[r.timeOfDay].label} · streak {current} (best {longest})
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onEdit(r)} aria-label="Edit routine"><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => onArchive(r)} aria-label="Archive routine"><Archive className="h-4 w-4" /></Button>
              <DeleteRoutineButton routine={r} onDelete={onDelete} />
            </div>
          );
        })}
      </Section>
      {archived.length > 0 && (
        <Section title="Archived">
          {archived.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3 opacity-70">
              <div className="min-w-0 flex-1 truncate">{r.name}</div>
              <Button size="icon" variant="ghost" onClick={() => onUnarchive(r)} aria-label="Restore routine"><ArchiveRestore className="h-4 w-4" /></Button>
              <DeleteRoutineButton routine={r} onDelete={onDelete} />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function DeleteRoutineButton({ routine, onDelete }: { routine: Routine; onDelete: (r: Routine) => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="Delete routine" className="text-destructive hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{routine.name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the routine and its completion history. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(routine)}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

interface RoutinePayload {
  name: string;
  timeOfDay: RoutineTimeOfDay;
  frequencyType: RoutineFrequency;
  frequencyConfig: Record<string, unknown>;
}

function QuickAddButton({
  open, setOpen, editing, onSave,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  editing: Routine | null;
  onSave: (payload: RoutinePayload) => void;
}) {
  const [name, setName] = useState("");
  const [freqType, setFreqType] = useState<RoutineFrequency>("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [target, setTarget] = useState(3);
  const [tod, setTod] = useState<RoutineTimeOfDay>("anytime");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setFreqType(editing?.frequencyType ?? "daily");
      setDays(editing ? freqDays(editing).length ? freqDays(editing) : [1, 3, 5] : [1, 3, 5]);
      setTarget(editing ? freqTarget(editing) : 3);
      setTod(editing?.timeOfDay ?? "anytime");
    }
  }, [open, editing]);

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    const frequencyConfig: Record<string, unknown> =
      freqType === "weekly_days" ? { days } :
      freqType === "weekly_count" ? { target } : {};
    onSave({
      name: name.trim(),
      timeOfDay: tod,
      frequencyType: freqType,
      frequencyConfig,
    });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full" size="sm">
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit routine" : "New routine"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="r-name">Name</Label>
            <Input
              id="r-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning walk"
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={freqType} onValueChange={(v) => setFreqType(v as RoutineFrequency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly_days">Specific weekdays</SelectItem>
                <SelectItem value="weekly_count">X times per week</SelectItem>
              </SelectContent>
            </Select>
            {freqType === "weekly_days" && (
              <div className="flex gap-1.5 pt-2">
                {WEEKDAYS.map(({ v, s }) => {
                  const on = days.includes(v);
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() =>
                        setDays((prev) => on ? prev.filter((x) => x !== v) : [...prev, v])
                      }
                      className={cn(
                        "h-9 w-9 rounded-full text-sm font-medium transition-colors",
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            )}
            {freqType === "weekly_count" && (
              <div className="flex items-center gap-3 pt-2">
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={target}
                  onChange={(e) => setTarget(Math.max(1, Math.min(7, +e.target.value || 1)))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">times per week</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Time of day (optional)</Label>
            <Select value={tod} onValueChange={(v) => setTod(v as RoutineTimeOfDay)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anytime">Anytime</SelectItem>
                <SelectItem value="morning">Morning</SelectItem>
                <SelectItem value="afternoon">Afternoon</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
