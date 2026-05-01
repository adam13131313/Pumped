import { useState, useRef, useCallback, DragEvent } from "react";
import { useAppStore } from "@/lib/store";
import { useFilteredData } from "@/hooks/useFilteredData";
import { InboxItem, Priority } from "@/lib/types";
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
  MicOff, Loader2, PenLine, X, Check, GripVertical, Table as TableIcon, Download, FileSpreadsheet
} from "lucide-react";
import { toast } from "sonner";
import {
  parseCSV, parseXLSX, autoMapColumns, rowsToTasks, ColumnMapping, ProposedTask,
  downloadCSVTemplate, downloadXLSXTemplate,
} from "@/lib/csvImport";
import { TaskStatus, Action } from "@/lib/types";

export default function InboxPage() {
  const { addInboxItems, updateInboxItem, deleteInboxItem, bulkDeleteInboxItems, promoteInboxToActions, bulkAddActions, projects, workPackages, programmes } = useAppStore();
  const { inboxItems } = useFilteredData();
  const [textInput, setTextInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [proposedTasks, setProposedTasks] = useState<ProposedTask[]>([]);
  const [summary, setSummary] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("notes");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);

  // Bulk edit state
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [bulkPriority, setBulkPriority] = useState<string>("");
  const [bulkProject, setBulkProject] = useState<string>("");

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // CSV mapping state
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvHasHeader, setCsvHasHeader] = useState(true);
  const [csvMapping, setCsvMapping] = useState<ColumnMapping | null>(null);
  const [csvFileName, setCsvFileName] = useState("");

  const projectNames = projects.map((p) => p.name).filter(Boolean);
  const workPackageNames = Array.from(new Set(workPackages.map((w) => w.workPackage).filter(Boolean)));

  // Build a flattened Programme → Project → Work Package reference reflecting
  // the user's current setup so downloaded templates stay in sync with the app.
  const wbsRows = (() => {
    const rows: { programme: string; project: string; workPackage: string }[] = [];
    const progName = (id: string) => programmes.find((pr) => pr.id === id)?.name ?? "";
    const wpsByProject = new Map<string, string[]>();
    for (const wp of workPackages) {
      if (!wp.workPackage) continue;
      const list = wpsByProject.get(wp.project) ?? [];
      list.push(wp.workPackage);
      wpsByProject.set(wp.project, list);
    }
    if (projects.length === 0 && workPackages.length === 0) return rows;
    for (const p of projects) {
      const wps = wpsByProject.get(p.name) ?? [];
      if (wps.length === 0) {
        rows.push({ programme: progName(p.programmeId), project: p.name, workPackage: "" });
      } else {
        for (const w of wps) rows.push({ programme: progName(p.programmeId), project: p.name, workPackage: w });
      }
    }
    // Orphan work packages (project not in projects list)
    for (const [proj, wps] of wpsByProject) {
      if (!projects.find((p) => p.name === proj)) {
        for (const w of wps) rows.push({ programme: "", project: proj, workPackage: w });
      }
    }
    return rows;
  })();

  // Normalize tasks coming from AI (older shape) into full ProposedTask shape
  const normalizeProposed = (raw: any[]): ProposedTask[] =>
    (raw || []).map((t) => ({
      task: t.task ?? "",
      priority: t.priority ?? "Medium",
      status: t.status ?? "Not Started",
      startDate: t.startDate ?? "",
      dueDate: t.dueDate ?? "",
      project: t.project ?? "",
      workPackage: t.workPackage ?? "",
      notes: t.notes ?? "",
      labels: Array.isArray(t.labels) ? t.labels : [],
    }));

  const extractTasks = useCallback(async (text: string, source: string) => {
    if (!text.trim()) {
      toast.error("Please enter some text first");
      return;
    }
    setIsExtracting(true);
    setSourceLabel(source);
    try {
      const { data, error } = await supabase.functions.invoke("extract-tasks", {
        body: { text, sourceType: source, existingProjects: projectNames },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setProposedTasks((prev) => [...prev, ...normalizeProposed(data.tasks)]);
      setSummary(data.summary || "");
      setShowPreview(true);
    } catch (e: any) {
      toast.error(e.message || "Failed to extract tasks");
    } finally {
      setIsExtracting(false);
    }
  }, [projectNames]);

  const finalizeImport = useCallback((rows: string[][], file: File, sourceTag: string) => {
    if (rows.length === 0) {
      toast.error("File appears to be empty");
      return;
    }
    const headers = rows[0];
    const mapping = autoMapColumns(headers);
    setCsvRows(rows);
    setCsvHeaders(headers);
    setCsvHasHeader(true);
    setCsvMapping(mapping);
    setCsvFileName(file.name);
    setSourceLabel(sourceTag);

    if (mapping.task < 0) {
      toast.warning("Couldn't auto-detect a task column. Please choose one below.", { duration: 4000 });
      setShowPreview(true);
      return;
    }
    const tasks = rowsToTasks(rows, mapping, true, projectNames, workPackageNames);
    if (tasks.length === 0) {
      toast.warning("No rows with task content found. Adjust column mapping.");
      setShowPreview(true);
      return;
    }
    setProposedTasks(tasks);
    setSummary(`Imported ${tasks.length} rows from ${file.name}. Review the column mapping below if needed.`);
    setShowPreview(true);
    toast.success(`Parsed ${tasks.length} tasks from ${file.name}`);
  }, [projectNames, workPackageNames]);

  const handleCsvFile = useCallback((file: File, text: string, delimiter?: "," | "\t") => {
    let toParse = text;
    if (delimiter === "\t") {
      toParse = text
        .split(/\r?\n/)
        .map((line) =>
          line.split("\t").map((c) => `"${c.replace(/"/g, '""')}"`).join(",")
        )
        .join("\n");
    }
    const rows = parseCSV(toParse);
    finalizeImport(rows, file, "csv: " + file.name);
  }, [finalizeImport]);

  const handleXlsxFile = useCallback(async (file: File) => {
    try {
      const rows = await parseXLSX(file);
      finalizeImport(rows, file, "xlsx: " + file.name);
    } catch (e: any) {
      toast.error(e.message || "Could not read XLSX file");
    }
  }, [finalizeImport]);

  const remapCsv = useCallback((next: ColumnMapping, hasHeader: boolean) => {
    if (!csvRows) return;
    setCsvMapping(next);
    setCsvHasHeader(hasHeader);
    if (next.task < 0) return;
    const tasks = rowsToTasks(csvRows, next, hasHeader, projectNames, workPackageNames);
    setProposedTasks(tasks);
    setSummary(`Imported ${tasks.length} rows from ${csvFileName}.`);
  }, [csvRows, projectNames, workPackageNames, csvFileName]);

  const readFileContent = async (file: File) => {
    try {
      const name = file.name.toLowerCase();
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        await handleXlsxFile(file);
        return;
      }
      const text = await file.text();
      if (name.endsWith(".csv")) { handleCsvFile(file, text, ","); return; }
      if (name.endsWith(".tsv")) { handleCsvFile(file, text, "\t"); return; }
      setTextInput(text);
      extractTasks(text, "file: " + file.name);
    } catch {
      toast.error("Could not read file. Try CSV, XLSX, TSV, or TXT.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await readFileContent(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };




  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await readFileContent(files[0]);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
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
        }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const transcript = data.transcript;
      setTextInput(transcript);
      toast.success("Audio transcribed!");
      extractTasks(transcript, "voice memo");
    } catch (e: any) {
      toast.error(e.message || "Transcription failed");
    } finally {
      setIsTranscribing(false);
    }
  };

  const resetPreviewState = () => {
    setShowPreview(false);
    setProposedTasks([]);
    setSummary("");
    setTextInput("");
    setCsvRows(null);
    setCsvHeaders([]);
    setCsvMapping(null);
    setCsvFileName("");
  };

  const acceptProposed = () => {
    const now = new Date().toISOString();
    const items: InboxItem[] = proposedTasks.map((t) => ({
      id: crypto.randomUUID(),
      task: t.task,
      priority: t.priority,
      dueDate: t.dueDate,
      project: t.project,
      notes: t.notes,
      source: sourceLabel,
      createdAt: now,
    }));
    addInboxItems(items);
    resetPreviewState();
    toast.success(`${items.length} tasks added to inbox`);
  };

  const acceptAsActions = () => {
    const newActions: Action[] = proposedTasks.map((t) => ({
      id: crypto.randomUUID(),
      task: t.task,
      project: t.project,
      workPackage: t.workPackage,
      startDate: t.startDate,
      dueDate: t.dueDate,
      priority: t.priority,
      status: t.status,
      notes: t.notes,
      labels: t.labels ?? [],
    }));
    bulkAddActions(newActions);
    resetPreviewState();
    toast.success(`${newActions.length} tasks added to My Actions`);
  };

  const cancelPreview = () => {
    resetPreviewState();
  };


  const removeProposed = (idx: number) => {
    setProposedTasks((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateProposed = (idx: number, updates: Partial<ProposedTask>) => {
    setProposedTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...updates } : t)));
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
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
    ids.forEach((id) => {
      const updates: Partial<InboxItem> = {};
      if (bulkPriority) updates.priority = bulkPriority as Priority;
      if (bulkProject) updates.project = bulkProject === "__none__" ? "" : bulkProject;
      if (Object.keys(updates).length > 0) {
        updateInboxItem(id, updates);
      }
    });
    toast.success(`${ids.length} items updated`);
    setBulkEditMode(false);
    setBulkPriority("");
    setBulkProject("");
  };

  const priorityColor = (p: Priority) =>
    p === "High" ? "destructive" : p === "Medium" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Rapid Capture</h1>
        {inboxItems.length > 0 && (
          <Badge variant="outline" className="ml-2">{inboxItems.length} in inbox</Badge>
        )}
      </div>

      {/* Capture area */}
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
              <p className="text-sm text-muted-foreground">TXT, CSV, MD supported</p>
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
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" /> Need a starter file?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Download a pre-formatted template with all task fields. The Excel version includes dropdowns
                      for Priority, Status, your Projects, and Work Packages.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button size="sm" variant="default" onClick={() =>
                        downloadXLSXTemplate({ projects: projectNames, workPackages: workPackageNames })
                      }>
                        <Download className="h-4 w-4 mr-2" />Excel template (.xlsx)
                      </Button>
                      <Button size="sm" variant="outline" onClick={downloadCSVTemplate}>
                        <Download className="h-4 w-4 mr-2" />Plain CSV template
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-3">Drag & drop a file here, or click to browse</p>
                    <input ref={fileInputRef} type="file" accept=".txt,.csv,.md,.tsv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4 mr-2" />Choose File
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">.xlsx, .csv & .tsv are auto-parsed with column mapping. .txt & .md use AI extraction.</p>
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

      {/* Preview dialog (inline) */}
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
                {csvRows && (
                  <Button size="sm" onClick={acceptAsActions} disabled={proposedTasks.length === 0}>
                    <ArrowRight className="h-4 w-4 mr-1" />Add as Actions
                  </Button>
                )}
              </div>
            </div>
            {summary && <p className="text-sm text-muted-foreground mt-1">{summary}</p>}
            {csvRows && csvMapping && (
              <div className="mt-3 rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <TableIcon className="h-4 w-4" /> Column mapping
                  <label className="ml-auto flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                    <Checkbox
                      checked={csvHasHeader}
                      onCheckedChange={(v) => remapCsv(csvMapping, !!v)}
                    />
                    First row is header
                  </label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
                  {([
                    ["task", "Task *"],
                    ["priority", "Priority"],
                    ["status", "Status"],
                    ["startDate", "Start Date"],
                    ["dueDate", "Due Date"],
                    ["project", "Project"],
                    ["workPackage", "Work Package"],
                    ["notes", "Notes"],
                    ["labels", "Labels"],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="space-y-1">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Select
                        value={String(csvMapping[key])}
                        onValueChange={(v) => remapCsv({ ...csvMapping, [key]: parseInt(v) }, csvHasHeader)}
                      >
                        <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="-1">— None —</SelectItem>
                          {csvHeaders.map((h, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {csvHasHeader ? (h || `Column ${i + 1}`) : `Column ${i + 1}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {proposedTasks.map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                <div className="flex-1 space-y-2">
                  <Input value={t.task} onChange={(e) => updateProposed(i, { task: e.target.value })} className="font-medium" />
                  <div className="flex flex-wrap gap-2">
                    <Select value={t.priority} onValueChange={(v) => updateProposed(i, { priority: v as Priority })}>
                      <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="Low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input type="date" value={t.dueDate} onChange={(e) => updateProposed(i, { dueDate: e.target.value })} className="w-40 h-8" />
                    <Select value={t.project || "__none__"} onValueChange={(v) => updateProposed(i, { project: v === "__none__" ? "" : v })}>
                      <SelectTrigger className="w-44 h-8"><SelectValue placeholder="No project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No project</SelectItem>
                        {projectNames.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {t.notes && <p className="text-xs text-muted-foreground">{t.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeProposed(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Inbox items */}
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
                <Button size="sm" variant="outline" onClick={() => { setBulkEditMode(!bulkEditMode); setBulkPriority(""); setBulkProject(""); }}>
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
              <div className="flex gap-2 items-end pt-2 flex-wrap rounded-md border border-border p-3 bg-muted/30">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <Select value={bulkPriority} onValueChange={setBulkPriority}>
                    <SelectTrigger className="w-28 h-8"><SelectValue placeholder="No change" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Project</span>
                  <Select value={bulkProject} onValueChange={setBulkProject}>
                    <SelectTrigger className="w-44 h-8"><SelectValue placeholder="No change" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No project</SelectItem>
                      {projectNames.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={applyBulkEdit} disabled={!bulkPriority && !bulkProject}>
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
              <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.task}</p>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    <Badge variant={priorityColor(item.priority)} className="text-xs">{item.priority}</Badge>
                    {item.project && <Badge variant="outline" className="text-xs">{item.project}</Badge>}
                    {item.dueDate && <span className="text-xs text-muted-foreground">{item.dueDate}</span>}
                    <span className="text-xs text-muted-foreground">via {item.source}</span>
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
