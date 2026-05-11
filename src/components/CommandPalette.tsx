import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CheckSquare, Inbox, Clock, FolderKanban, Layers } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { normalize } from "@/lib/similarity";

/**
 * Global Cmd/Ctrl+K palette. Searches across actions, inbox, waiting items,
 * projects and work packages so the user can answer "did I already add it?"
 * in two seconds.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const actions = useAppStore((s) => s.actions);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const projects = useAppStore((s) => s.projects);
  const workPackages = useAppStore((s) => s.workPackages);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Token-based filter so partial words match (e.g. "budg" → "budget").
  const tokens = useMemo(() => normalize(query), [query]);
  const matches = (text: string) => {
    if (tokens.length === 0) return true;
    const lower = text.toLowerCase();
    return tokens.every((t) => lower.includes(t));
  };

  const openActions = useMemo(
    () => actions.filter((a) => !a.archived && a.status !== "Complete"),
    [actions],
  );

  const filteredActions = useMemo(
    () => openActions.filter((a) => matches(`${a.task} ${a.project} ${a.workPackage}`)).slice(0, 8),
    [openActions, query],
  );
  const filteredInbox = useMemo(
    () => inboxItems.filter((i) => matches(`${i.task} ${i.project}`)).slice(0, 5),
    [inboxItems, query],
  );
  const filteredWaiting = useMemo(
    () => waitingItems.filter((w) => matches(`${w.description} ${w.fromWhom} ${w.projectWP}`)).slice(0, 5),
    [waitingItems, query],
  );
  const filteredProjects = useMemo(
    () => projects.filter((p) => matches(`${p.name} ${p.description}`)).slice(0, 5),
    [projects, query],
  );
  const filteredWPs = useMemo(
    () => workPackages.filter((wp) => matches(`${wp.workPackage} ${wp.project}`)).slice(0, 5),
    [workPackages, query],
  );

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search tasks, projects, work packages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches. Nothing logged yet — safe to add.</CommandEmpty>

        {filteredActions.length > 0 && (
          <CommandGroup heading="Actions">
            {filteredActions.map((a) => (
              <CommandItem key={`a-${a.id}`} value={`action ${a.task} ${a.id}`} onSelect={() => go("/actions")}>
                <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{a.task}</span>
                {(a.project || a.workPackage) && (
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    · {a.workPackage || a.project}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredInbox.length > 0 && (
          <CommandGroup heading="Rapid Capture">
            {filteredInbox.map((i) => (
              <CommandItem key={`i-${i.id}`} value={`inbox ${i.task} ${i.id}`} onSelect={() => go("/inbox")}>
                <Inbox className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{i.task}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredWaiting.length > 0 && (
          <CommandGroup heading="Waiting For">
            {filteredWaiting.map((w) => (
              <CommandItem key={`w-${w.id}`} value={`waiting ${w.description} ${w.id}`} onSelect={() => go("/waiting")}>
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{w.description}</span>
                {w.fromWhom && (
                  <span className="ml-2 truncate text-xs text-muted-foreground">· {w.fromWhom}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredWPs.length > 0 && (
          <CommandGroup heading="Work Packages">
            {filteredWPs.map((wp) => (
              <CommandItem key={`wp-${wp.id}`} value={`wp ${wp.workPackage} ${wp.id}`} onSelect={() => go("/projects")}>
                <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{wp.workPackage}</span>
                <span className="ml-2 truncate text-xs text-muted-foreground">· {wp.project}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredProjects.length > 0 && (
          <CommandGroup heading="Projects">
            {filteredProjects.map((p) => (
              <CommandItem key={`p-${p.id}`} value={`project ${p.name} ${p.id}`} onSelect={() => go(`/projects/${p.id}`)}>
                <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{p.name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
