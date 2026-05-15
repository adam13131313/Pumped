import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Sun, CloudSun, Moon, Sparkles, Flame, Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { format, startOfWeek, addDays, isSameDay, parseISO, differenceInCalendarDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type FreqType = "daily" | "weekly_days" | "weekly_count";
type TimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

interface Routine {
  id: string;
  user_id: string;
  name: string;
  frequency_type: FreqType;
  frequency_config: { days?: number[]; target?: number };
  time_of_day: TimeOfDay;
  created_at: string;
  archived_at: string | null;
}

interface Completion {
  id: string;
  routine_id: string;
  completed_date: string; // YYYY-MM-DD
}

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const TOD_META: Record<TimeOfDay, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  morning: { label: "Morning", icon: Sun },
  afternoon: { label: "Afternoon", icon: CloudSun },
  evening: { label: "Evening", icon: Moon },
  anytime: { label: "Anytime", icon: Sparkles },
};

const WEEKDAYS = [
  { v: 1, s: "M" }, { v: 2, s: "T" }, { v: 3, s: "W" },
  { v: 4, s: "T" }, { v: 5, s: "F" }, { v: 6, s: "S" }, { v: 0, s: "S" },
];

function isDueOn(routine: Routine, date: Date): boolean {
  if (routine.archived_at) return false;
  if (routine.frequency_type === "daily") return true;
  if (routine.frequency_type === "weekly_days") {
    const days = routine.frequency_config.days ?? [];
    return days.includes(date.getDay());
  }
  return true; // weekly_count: shown every day until target met for that week
}

function calcStreak(routine: Routine, comps: Completion[]): { current: number; longest: number } {
  const set = new Set(comps.map((c) => c.completed_date));
  if (routine.frequency_type === "weekly_count") {
    // Streak in weeks meeting target
    const target = routine.frequency_config.target ?? 1;
    const byWeek = new Map<string, number>();
    for (const c of comps) {
      const d = parseISO(c.completed_date);
      const wk = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1);
    }
    const weeks = Array.from(byWeek.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
    let current = 0, longest = 0, run = 0;
    let cursor = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
    // current
    while ((byWeek.get(cursor) ?? 0) >= target) {
      current++;
      cursor = format(addDays(parseISO(cursor), -7), "yyyy-MM-dd");
    }
    // longest
    let prev: string | null = null;
    for (const [wk, count] of weeks.reverse()) {
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
  // daily / weekly_days: count consecutive due days completed, starting from today backwards
  let current = 0;
  let cursor = startOfDay(new Date());
  // If today not yet completed, start from yesterday for "current"
  if (!set.has(format(cursor, "yyyy-MM-dd")) && isDueOn(routine, cursor)) {
    cursor = addDays(cursor, -1);
  } else if (set.has(format(cursor, "yyyy-MM-dd"))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  while (true) {
    if (!isDueOn(routine, cursor)) { cursor = addDays(cursor, -1); continue; }
    if (set.has(format(cursor, "yyyy-MM-dd"))) {
      current++;
      cursor = addDays(cursor, -1);
    } else break;
    if (current > 3650) break;
  }
  // longest
  const sortedDates = Array.from(set).sort();
  let longest = 0, run = 0, prev: Date | null = null;
  for (const ds of sortedDates) {
    const d = parseISO(ds);
    if (!prev) { run = 1; }
    else {
      // walk forward from prev to d skipping non-due days
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
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set()); // local "skip today" by routine id
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);

  useEffect(() => {
    if (!user) return;
    void load();
  }, [user]);

  async function load() {
    setLoading(true);
    const [r, c] = await Promise.all([
      supabase.from("routines").select("*").order("created_at", { ascending: true }),
      supabase.from("routine_completions").select("*"),
    ]);
    if (!r.error) setRoutines((r.data as any) ?? []);
    if (!c.error) setCompletions((c.data as any) ?? []);
    setLoading(false);
  }

  const today = new Date();
  const todayKey = todayStr();

  const dueToday = useMemo(
    () => routines.filter((r) => !r.archived_at && isDueOn(r, today) && !skipped.has(r.id)),
    [routines, skipped]
  );
  const completedToday = useMemo(
    () => new Set(completions.filter((c) => c.completed_date === todayKey).map((c) => c.routine_id)),
    [completions, todayKey]
  );

  const doneCount = dueToday.filter((r) => completedToday.has(r.id)).length;
  const totalCount = dueToday.length;
  const pct = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100);

  async function toggleComplete(routine: Routine) {
    if (!user) return;
    const isDone = completedToday.has(routine.id);
    if (navigator.vibrate) navigator.vibrate(10);

    if (isDone) {
      const existing = completions.find((c) => c.routine_id === routine.id && c.completed_date === todayKey);
      setCompletions((prev) => prev.filter((c) => c.id !== existing?.id));
      if (existing) await supabase.from("routine_completions").delete().eq("id", existing.id);
    } else {
      const optimistic: Completion = {
        id: `tmp-${Date.now()}`,
        routine_id: routine.id,
        completed_date: todayKey,
      };
      setCompletions((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from("routine_completions")
        .insert({ routine_id: routine.id, user_id: user.id, completed_date: todayKey })
        .select()
        .single();
      if (error) {
        setCompletions((prev) => prev.filter((c) => c.id !== optimistic.id));
        toast.error("Couldn't save — try again");
      } else {
        setCompletions((prev) => prev.map((c) => (c.id === optimistic.id ? (data as any) : c)));
        // confetti when ring hits 100%
        const newDone = doneCount + 1;
        if (newDone === totalCount && totalCount > 0) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.3 } });
        }
      }
    }
  }

  function skipToday(routine: Routine) {
    setSkipped((prev) => new Set(prev).add(routine.id));
    toast(`Skipped "${routine.name}" today — streak safe`);
  }

  async function handleArchive(r: Routine, archive: boolean) {
    const archived_at = archive ? new Date().toISOString() : null;
    setRoutines((prev) => prev.map((x) => (x.id === r.id ? { ...x, archived_at } : x)));
    await supabase.from("routines").update({ archived_at }).eq("id", r.id);
  }

  async function handleDelete(r: Routine) {
    setRoutines((prev) => prev.filter((x) => x.id !== r.id));
    setCompletions((prev) => prev.filter((c) => c.routine_id !== r.id));
    const { error } = await supabase.from("routines").delete().eq("id", r.id);
    if (error) {
      toast.error("Couldn't delete — try again");
      void load();
    } else {
      toast.success(`Deleted "${r.name}"`);
    }
  }

  async function toggleCompletionForDate(routineId: string, dateStr: string) {
    if (!user) return;
    const existing = completions.find(
      (c) => c.routine_id === routineId && c.completed_date === dateStr
    );
    if (existing) {
      setCompletions((prev) => prev.filter((c) => c.id !== existing.id));
      const { error } = await supabase.from("routine_completions").delete().eq("id", existing.id);
      if (error) { toast.error("Couldn't update"); void load(); }
    } else {
      const optimistic: Completion = {
        id: `tmp-${Date.now()}`,
        routine_id: routineId,
        completed_date: dateStr,
      };
      setCompletions((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from("routine_completions")
        .insert({ routine_id: routineId, user_id: user.id, completed_date: dateStr })
        .select()
        .single();
      if (error) {
        setCompletions((prev) => prev.filter((c) => c.id !== optimistic.id));
        toast.error("Couldn't save");
      } else {
        setCompletions((prev) => prev.map((c) => (c.id === optimistic.id ? (data as any) : c)));
      }
    }
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Sign in to track routines.
      </div>
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
          onSaved={async () => { setEditing(null); await load(); }}
          userId={user.id}
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
          {loading ? (
            <p className="text-center text-sm text-muted-foreground">Loading…</p>
          ) : totalCount === 0 ? (
            <EmptyState onAdd={() => setDialogOpen(true)} />
          ) : (
            (["morning", "afternoon", "evening", "anytime"] as TimeOfDay[]).map((tod) => {
              const items = dueToday.filter((r) => r.time_of_day === tod);
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
                          completions={completions.filter((c) => c.routine_id === r.id)}
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
            routines={routines.filter((r) => !r.archived_at)}
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
  completions: Completion[];
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
        done && "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/30"
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
              : "border-muted-foreground/30 bg-background"
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
  if (routine.frequency_type === "daily") return <span>Daily</span>;
  if (routine.frequency_type === "weekly_days") {
    const days = routine.frequency_config.days ?? [];
    const labels = ["S", "M", "T", "W", "T", "F", "S"];
    return <span>{days.map((d) => labels[d]).join(" · ")}</span>;
  }
  return <span>{routine.frequency_config.target ?? 1}× per week</span>;
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

function WeekGrid({ routines, completions }: { routines: Routine[]; completions: Completion[] }) {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();
  if (routines.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No routines yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
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
                const did = completions.some((c) => c.routine_id === r.id && c.completed_date === ds);
                const due = isDueOn(r, d);
                return (
                  <td key={ds} className="text-center">
                    <div
                      className={cn(
                        "mx-auto h-7 w-7 rounded-full",
                        did
                          ? "bg-emerald-500"
                          : due
                            ? "border border-dashed border-muted-foreground/30"
                            : "bg-muted/40"
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
  routines, completions, onArchive, onUnarchive, onEdit,
}: {
  routines: Routine[];
  completions: Completion[];
  onArchive: (r: Routine) => void;
  onUnarchive: (r: Routine) => void;
  onEdit: (r: Routine) => void;
}) {
  const active = routines.filter((r) => !r.archived_at);
  const archived = routines.filter((r) => r.archived_at);
  return (
    <div className="space-y-6">
      <Section title="Active">
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active routines.</p>
        ) : active.map((r) => {
          const { current, longest } = calcStreak(r, completions.filter((c) => c.routine_id === r.id));
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-card p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  <FrequencyLabel routine={r} /> · {TOD_META[r.time_of_day].label} · streak {current} (best {longest})
                </div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => onArchive(r)}><Archive className="h-4 w-4" /></Button>
            </div>
          );
        })}
      </Section>
      {archived.length > 0 && (
        <Section title="Archived">
          {archived.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-2xl border bg-muted/30 p-3 opacity-70">
              <div className="min-w-0 flex-1 truncate">{r.name}</div>
              <Button size="icon" variant="ghost" onClick={() => onUnarchive(r)}><ArchiveRestore className="h-4 w-4" /></Button>
            </div>
          ))}
        </Section>
      )}
    </div>
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

function QuickAddButton({
  open, setOpen, editing, onSaved, userId,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  editing: Routine | null;
  onSaved: () => void;
  userId: string;
}) {
  const [name, setName] = useState("");
  const [freqType, setFreqType] = useState<FreqType>("daily");
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [target, setTarget] = useState(3);
  const [tod, setTod] = useState<TimeOfDay>("anytime");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setFreqType(editing?.frequency_type ?? "daily");
      setDays(editing?.frequency_config.days ?? [1, 3, 5]);
      setTarget(editing?.frequency_config.target ?? 3);
      setTod(editing?.time_of_day ?? "anytime");
    }
  }, [open, editing]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const config =
      freqType === "weekly_days" ? { days } :
      freqType === "weekly_count" ? { target } : {};
    const payload = {
      user_id: userId,
      name: name.trim(),
      frequency_type: freqType,
      frequency_config: config,
      time_of_day: tod,
    };
    const { error } = editing
      ? await supabase.from("routines").update(payload).eq("id", editing.id)
      : await supabase.from("routines").insert(payload);
    setSaving(false);
    if (error) { toast.error("Couldn't save"); return; }
    toast.success(editing ? "Updated" : "Routine added");
    setOpen(false);
    onSaved();
  }

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
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={freqType} onValueChange={(v) => setFreqType(v as FreqType)}>
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
                        on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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
            <Select value={tod} onValueChange={(v) => setTod(v as TimeOfDay)}>
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
