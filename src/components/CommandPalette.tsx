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
import { nodePath } from "@/components/NodePicker";
import type { NodeType } from "@/lib/types";

// Global Cmd/Ctrl+K palette. Searches actions, inbox, waiting items and
// every WBS node (portfolio/programme/project/work-package) so the user can
// answer "did I already add it?" in two seconds.

const TYPE_ICON: Record<NodeType, typeof Layers> = {
  portfolio: FolderKanban,
  programme: FolderKanban,
  project: FolderKanban,
  work_package: Layers,
};
const TYPE_HEADING: Record<NodeType, string> = {
  portfolio: "Portfolios",
  programme: "Programmes",
  project: "Projects",
  work_package: "Work Packages",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const actions = useAppStore((s) => s.actions);
  const inboxItems = useAppStore((s) => s.inboxItems);
  const waitingItems = useAppStore((s) => s.waitingItems);
  const wbsNodes = useAppStore((s) => s.wbsNodes);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const tokens = useMemo(() => normalize(query), [query]);
  const matches = (text: string) => {
    if (tokens.length === 0) return true;
    const lower = text.toLowerCase();
    return tokens.every((t) => lower.includes(t));
  };

  const nodeNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const n of wbsNodes) m.set(n.id, n.name);
    return m;
  }, [wbsNodes]);

  const nodeLabelFor = (id: string | null) => {
    if (!id) return "";
    return nodePath(wbsNodes, id).map((n) => n.name).join(" › ");
  };

  const openActions = useMemo(
    () => actions.filter((a) => a.status !== "complete"),
    [actions],
  );

  const filteredActions = useMemo(
    () => openActions.filter((a) => matches(`${a.task} ${nodeLabelFor(a.wbsNodeId)}`)).slice(0, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [openActions, query, nodeNameById],
  );
  const filteredInbox = useMemo(
    () => inboxItems.filter((i) => matches(`${i.task} ${nodeLabelFor(i.wbsNodeId)}`)).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inboxItems, query, nodeNameById],
  );
  const filteredWaiting = useMemo(
    () => waitingItems.filter((w) => matches(`${w.description} ${w.fromWhomText ?? ""} ${nodeLabelFor(w.wbsNodeId)}`)).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [waitingItems, query, nodeNameById],
  );

  const filteredNodes = useMemo(() => {
    const all = wbsNodes.filter((n) => !n.archivedAt && matches(`${n.name} ${n.description} ${nodeLabelFor(n.parentId)}`));
    const byType: Record<NodeType, typeof all> = {
      portfolio: [], programme: [], project: [], work_package: [],
    };
    for (const n of all) byType[n.nodeType].push(n);
    return byType;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wbsNodes, query]);

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
              <CommandItem key={`a-${a.id}`} value={`action ${a.task} ${a.id}`} onSelect={() => go(`/?open=${a.id}`)}>
                <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{a.task}</span>
                {a.wbsNodeId && (
                  <span className="ml-2 truncate text-xs text-muted-foreground">
                    · {nodeNameById.get(a.wbsNodeId) ?? ""}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredInbox.length > 0 && (
          <CommandGroup heading="Rapid Capture">
            {filteredInbox.map((i) => (
              <CommandItem key={`i-${i.id}`} value={`inbox ${i.task} ${i.id}`} onSelect={() => go(`/inbox?focus=${i.id}`)}>
                <Inbox className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{i.task}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {filteredWaiting.length > 0 && (
          <CommandGroup heading="Waiting For">
            {filteredWaiting.map((w) => (
              <CommandItem key={`w-${w.id}`} value={`waiting ${w.description} ${w.id}`} onSelect={() => go(`/waiting?open=${w.id}`)}>
                <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{w.description}</span>
                {w.fromWhomText && (
                  <span className="ml-2 truncate text-xs text-muted-foreground">· {w.fromWhomText}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(["work_package", "project", "programme", "portfolio"] as NodeType[]).map((t) => {
          const list = filteredNodes[t].slice(0, 5);
          if (list.length === 0) return null;
          const Icon = TYPE_ICON[t];
          return (
            <CommandGroup key={t} heading={TYPE_HEADING[t]}>
              {list.map((n) => (
                <CommandItem key={`n-${n.id}`} value={`node ${n.name} ${n.id}`} onSelect={() => go(`/wbs/${n.id}`)}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{n.name}</span>
                  {n.parentId && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">· {nodeNameById.get(n.parentId) ?? ""}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
