import { useState, useRef, useCallback, useEffect, DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import type { ActionPriority, ActionStatus, InboxItem, Action } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Inbox, FileText, Mic, Link, Upload, Sparkles, Trash2, ArrowRight,
  MicOff, Loader2, PenLine, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { NodePicker, nodePath } from "@/components/NodePicker";

// v2 InboxPage. Replaces v1's project/workPackage string fields with
// wbsNodeId UUID via NodePicker. CSV/XLSX upload is deferred (csvImport stub
// throws until phase 4.5 lands the new mapper).

const PRIORITY_LABEL: Record<ActionPriority, string> = { high: "High", medium: "Medium", low: "Low" };
const PRIORITIES: ActionPriority[] = ["high", "medium", "low"];

interface ProposedDraft {
  task: string;
  priority: ActionPriority;
  status: ActionStatus;
  startDate: string;
  dueDate: string;
  wbsNodeId: string | null;
  notes: string;
  labels: string[];
}

const priorityFromAny = (raw: unknown): ActionPriority => {
  const s = String(raw ?? "").toLowerCase();
  return s === "high" || s === "low" ? s : "medium";
};
const statusFromAny = (raw: unknown): ActionStatus => {
  const s = String(raw ?? "").toLowerCase().replace(/\s+/g, "_");
  if (s === "in_progress" || s === "complete" || s === "blocked") return s;
  return "not_started";
};

export default function InboxPage() {
  const addInboxItems = useAppStore((s) => s.addInboxItems);
  const bulkUpdateInboxItems = useAppStore((s) => s.bulkUpdateInboxItems);
  const deleteInboxItem = useAppStore((s) => s.deleteInboxItem);
  const bulkDeleteInboxItems = useAppStore((s) => s.bulkDeleteInboxItems);
  const promoteInboxToActions = useAppStore((s) => s.promoteInboxToActions);
  const bulkAddActions = useAppStore((s) => s.bulkAddActions);
  const wbsNodes = useAppStore((s) => s.wbsNodes);
  const currentOrg = useAppStore((s) => s.currentOrg);
  const currentMembership = useAppStore((s) => s.currentMembership);

  const { inboxItems } = useFilteredData();

  const [textInput, setTextInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<ProposedDraft[]>([]);
  const [summary, setSummary] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("notes");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkPriority, setBulkPriority] = useState<string>("");
  const [bulkNodeId, setBulkNodeId] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const dragCounterRef = useRef(0);

  const [focusId, setFocusId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("focus");
    if (!id) return;
    setFocusId(id);
    requestAnimationFrame(() => {
      document.getElementById(`inbox-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = setTimeout(() => setFocusId(null), 2500);
    const next = new URLSearchParams(searchParams);
    next.delete("focus");
    setSearchParams(next, { replace: true });
    return () => clearTimeout(t);
  }, [searchParams, setSearchParams]);

  const nodeNameById = (id: string | null) => {
    if (!id) return "";
    const path = nodePath(wbsNodes, id);
    return path.map((n) => n.name).join(" › ");
  };

  const normalizeProposed = (raw: unknown[]): ProposedDraft[] =>
    (raw || []).map((t) => {
      const r = (t ?? {}) as Record<string, unknown>;
      return {
        task: String(r.task ?? ""),
        priority: priorityFromAny(r.priority),
        status: statusFromAny(r.status),
        startDate: String(r.startDate ?? ""),
        dueDate: String(r.dueDate ?? ""),
        wbsNodeId: typeof r.wbsNodeId === "string" ? r.wbsNodeId : null,
        notes: String(r.notes ?? ""),
        labels: Array.isArray(r.labels) ? (r.labels as string[]) : [],
      };
    });

  const extractTasks = useCallback(async (text: string, source: string) => {
    if (!text.trim()) {
      toast.error("Please enter some text first");
      return;
    }
    setIsExtracting(true);
    setSourceLabel(source);
    try {
      const existingNodes = wbsNodes
        .filter((n) => !n.archivedAt)
        .map((n) => ({ id: n.id, path: nodePath(wbsNodes, n.id).map((p) => p.name).join(" › ") }));
      const { data, error } = await supabase.functions.invoke("extract-tasks", {
        body: { text, sourceType: source, existingNodes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProposedTasks((prev) => [...prev, ...normalizeProposed(data.tasks)]);
      setSummary(data.summary || "");
      setShowPreview(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to extract tasks");
    } finally {
      setIsExtracting(false);
    }
  }, [wbsNodes]);

  const readFileContent = async (file: File) => {
    const name = file.name.toLowerCase();
    if (/\.(csv|tsv|xlsx|xls)$/.test(name)) {
      toast.warning("Spreadsheet import is being rewritten. Paste the rows as text for now.");
      return;
    }
    try {
      const text = await file.text();
      setTextInput(text);
      extractTasks(text, "file: " + file.name);
    } catch {
      toast.error("Could not read file. Try TXT or MD.");
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const files = e.dataTransfer.files;
    if (files.length > 0) await readFileContent(files[0]);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        await transcribeAudio(blob);
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        toast.error("Microphone access denied. Check browser permissions.");
      } else {
        toast.error("Could not start recording");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        },
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const transcript = data.transcript;
      setTextInput(transcript);
      toast.success("Audio transcribed!");
      extractTasks(transcript, "voice memo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetPreviewState = () => {
    setShowPreview(false);
    setProposedTasks([]);
    setSummary("");
    setTextInput("");
  };

  const acceptProposed = () => {
    if (!currentOrg) {
      toast.error("No active organisation");
      return;
    }
    const now = new Date().toISOString();
    const items: InboxItem[] = proposedTasks.map((t) => ({
      id: crypto.randomUUID(),
      organisationId: currentOrg.id,
      sourceId: null,
      wbsNodeId: t.wbsNodeId,
      promotedToActionId: null,
      task: t.task,
      priority: t.priority,
      dueDate: t.dueDate || null,
      notes: t.notes,
      externalId: null,
      externalUrl: null,
      promotedAt: null,
      createdBy: currentMembership?.userId ?? null,
      createdAt: now,
      updatedAt: now,
    }));
    addInboxItems(items);
    resetPreviewState();
    toast.success(`${items.length} tasks added to inbox`, { description: `via ${sourceLabel}` });
  };

  const acceptAsActions = () => {
    if (!currentOrg) {
      toast.error("No active organisation");
      return;
    }
    const now = new Date().toISOString();
    const newActions: Action[] = proposedTasks.map((t) => ({
      id: crypto.randomUUID(),
      organisationId: currentOrg.id,
      wbsNodeId: t.wbsNodeId,
      assignedTo: currentMembership?.userId ?? null,
      createdBy: currentMembership?.userId ?? null,
      task: t.task,
      priority: t.priority,
      status: t.status,
      startDate: t.startDate || null,
      dueDate: t.dueDate || null,
      completedAt: null,
      notes: t.notes,
      labels: t.labels,
      notStartedSince: null,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    }));
    bulkAddActions(newActions);
    resetPreviewState();
    toast.success(`${newActions.length} tasks added to My Actions`);
  };

  const cancelPreview = () => resetPreviewState();

  const removeProposed = (idx: number) => {
    setProposedTasks((prev) => prev.filter((_, i) => i !== idx));
  };
  const updateProposed = (idx: number, updates: Partial<ProposedDraft>) => {
    setProposedTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const selectAll = () => setSelected(new Set(inboxItems.map((i) => i.id)));
  const selectNone = () => setSelected(new Set());

  const promoteSelected = () => {
    const ids = Array.from(selected);
    promoteInboxToActions(ids);
    setSelected(new Set());
    toast.success(`${ids.length} tasks moved to My Actions`);
  };

  const deleteSelected = () => {
    const ids = Array.from(selected);
    bulkDeleteInboxItems(ids);
    setSelected(new Set());
    toast.success(`${ids.length} items deleted`);
  };

  const applyBulkEdit = () => {
    const ids = Array.from(selected);
    const updates: Partial<InboxItem> = {};
    if (bulkPriority) updates.priority = bulkPriority as ActionPriority;
    if (bulkNodeId !== null) updates.wbsNodeId = bulkNodeId;
    if (Object.keys(updates).length > 0) {
      bulkUpdateInboxItems(ids, updates);
    }
    toast.success(`${ids.length} items updated`);
    setBulkEditMode(false);
    setBulkPriority("");
    setBulkNodeId(null);
  };

  const priorityVariant = (p: ActionPriority) =>
    p === "high" ? "destructive" : p === "medium" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Rapid Capture</h1>
        {inboxItems.length > 0 && (
          <Badge variant="outline" className="ml-2">{inboxItems.length} in inbox</Badge>
        )}
      </div>

      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-sm">
            <div className="text-center">
              <Upload className="h-10 w-10 mx-auto mb-2 text-primary" />
              <p className="text-lg font-medium text-primary">Drop file here</p>
              <p className="text-sm text-muted-foreground">TXT or MD supported</p>
            </div>
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Capture & Extract Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="text" orientation="vertical" className="flex gap-4">
              <div className="flex-1 order-1">
                <TabsContent value="text" className="space-y-3 mt-0">
                  <Textarea
                    placeholder="Paste meeting notes, email thread, or any text…"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={6}
                  />
                  <Button onClick={() => extractTasks(textInput, "notes")} disabled={isExtracting || !textInput.trim()}>
                    {isExtracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</> : <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>}
                  </Button>
                </TabsContent>

                <TabsContent value="voice" className="space-y-3 mt-0">
                  <div className="flex items-center gap-3">
                    {!isRecording ? (
                      <Button onClick={startRecording} variant="outline" disabled={isTranscribing}>
                        <Mic className="h-4 w-4 mr-2" />Start Recording
                      </Button>
                    ) : (
                      <Button onClick={stopRecording} variant="destructive">
                        <MicOff className="h-4 w-4 mr-2" />Stop Recording
                      </Button>
                    )}
                    {isTranscribing && <span className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Transcribing…</span>}
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-2 text-sm text-destructive animate-pulse">
                      <div className="h-2 w-2 rounded-full bg-destructive" /> Recording…
                    </div>
                  )}
                  {textInput && !isRecording && !isTranscribing && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Transcript:</p>
                      <Textarea value={textInput} onChange={(e) => setTextInput(e.target.value)} rows={4} />
                      <Button onClick={() => extractTasks(textInput, "voice memo")} disabled={isExtracting}>
                        {isExtracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</> : <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>}
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="file" className="space-y-3 mt-0">
                  <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-4 text-sm">
                    <p className="font-medium">Spreadsheet import is being rewritten</p>
                    <p className="text-muted-foreground mt-1">
                      CSV/XLSX upload with column-mapping is on hold while the v2 WBS hierarchy lands.
                      Paste rows as text under the Notes tab — the extractor will still pick them up.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="link" className="space-y-3 mt-0">
                  <p className="text-sm text-muted-foreground">Paste a Google Sheet URL or any link's content below, then extract.</p>
                  <Textarea
                    placeholder="Paste link or copied spreadsheet content here…"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={6}
                  />
                  <Button onClick={() => extractTasks(textInput, "link/paste")} disabled={isExtracting || !textInput.trim()}>
                    {isExtracting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting…</> : <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>}
                  </Button>
                </TabsContent>
              </div>

              <TabsList className="flex-col h-auto order-2 self-start">
                <TabsTrigger value="text" className="gap-1.5 w-full justify-start"><FileText className="h-3.5 w-3.5" />Notes</TabsTrigger>
                <TabsTrigger value="voice" className="gap-1.5 w-full justify-start"><Mic className="h-3.5 w-3.5" />Voice</TabsTrigger>
                <TabsTrigger value="file" className="gap-1.5 w-full justify-start"><Upload className="h-3.5 w-3.5" />File</TabsTrigger>
                <TabsTrigger value="link" className="gap-1.5 w-full justify-start"><Link className="h-3.5 w-3.5" />Link/Paste</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {showPreview && (
        <Card className="border-primary/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Proposed Tasks ({proposedTasks.length})</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="ghost" onClick={cancelPreview}><X className="h-4 w-4 mr-1" />Cancel</Button>
                <Button size="sm" variant="outline" onClick={acceptProposed} disabled={proposedTasks.length === 0}>
                  <Check className="h-4 w-4 mr-1" />Add to Inbox
                </Button>
                <Button size="sm" onClick={acceptAsActions} disabled={proposedTasks.length === 0}>
                  <ArrowRight className="h-4 w-4 mr-1" />Add as Actions
                </Button>
              </div>
            </div>
            {summary && <p className="text-sm text-muted-foreground mt-1">{summary}</p>}
          </CardHeader>
          <CardContent className="space-y-2">
            {proposedTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <Input value={t.task} onChange={(e) => updateProposed(i, { task: e.target.value })} className="font-medium" />
                  <div className="flex flex-wrap gap-2 items-center">
                    <Select value={t.priority} onValueChange={(v) => updateProposed(i, { priority: v as ActionPriority })}>
                      <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={t.dueDate} onChange={(e) => updateProposed(i, { dueDate: e.target.value })} className="w-40 h-8" />
                    <div className="w-56">
                      <NodePicker
                        value={t.wbsNodeId}
                        onChange={(id) => updateProposed(i, { wbsNodeId: id })}
                        includeNone
                        noneLabel="(unassigned)"
                        placeholder="Link to WBS…"
                      />
                    </div>
                  </div>
                  {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeProposed(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inboxItems.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Inbox className="h-4 w-4" /> Inbox ({inboxItems.length})
              </CardTitle>
              <div className="flex gap-2 items-center">
                <Button size="sm" variant="ghost" onClick={selected.size === inboxItems.length ? selectNone : selectAll}>
                  {selected.size === inboxItems.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
            </div>
            {selected.size > 0 && (
              <div className="flex gap-2 items-center pt-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                <Button size="sm" variant="outline" onClick={() => { setBulkEditMode(!bulkEditMode); setBulkPriority(""); setBulkNodeId(null); }}>
                  <PenLine className="h-4 w-4 mr-1" />Bulk Edit
                </Button>
                <Button size="sm" onClick={promoteSelected}>
                  <ArrowRight className="h-4 w-4 mr-1" />Move to Actions
                </Button>
                <Button size="sm" variant="destructive" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4 mr-1" />Delete
                </Button>
              </div>
            )}
            {bulkEditMode && selected.size > 0 && (
              <div className="flex gap-3 items-end pt-2 flex-wrap rounded-md border border-border p-3 bg-muted/30">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <Select value={bulkPriority} onValueChange={setBulkPriority}>
                    <SelectTrigger className="w-32 h-8"><SelectValue placeholder="No change" /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-56">
                  <span className="text-xs text-muted-foreground">Linked to</span>
                  <NodePicker
                    value={bulkNodeId}
                    onChange={(id) => setBulkNodeId(id)}
                    includeNone
                    noneLabel="(unassigned)"
                    placeholder="No change"
                  />
                </div>
                <Button size="sm" onClick={applyBulkEdit} disabled={!bulkPriority && bulkNodeId === null}>
                  <Check className="h-4 w-4 mr-1" />Apply
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBulkEditMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {inboxItems.map((item) => (
              <div
                key={item.id}
                id={`inbox-${item.id}`}
                className={`flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors ${focusId === item.id ? "ring-2 ring-primary" : ""}`}
              >
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.task}</p>
                  <div className="flex gap-2 mt-1 flex-wrap items-center">
                    <Badge variant={priorityVariant(item.priority)} className="text-xs">{PRIORITY_LABEL[item.priority]}</Badge>
                    {item.wbsNodeId && (
                      <Badge variant="outline" className="text-xs">{nodeNameById(item.wbsNodeId)}</Badge>
                    )}
                    {item.dueDate && <span className="text-xs text-muted-foreground">{item.dueDate}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => {
                    promoteInboxToActions([item.id]);
                    toast.success("Moved to My Actions");
                  }}><ArrowRight className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteInboxItem(item.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inboxItems.length === 0 && !showPreview && (
        <div className="text-center py-12 text-muted-foreground">
          <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Your inbox is empty. Use the capture tools above to add tasks.</p>
        </div>
      )}
    </div>
  );
}
