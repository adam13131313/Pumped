import React, { useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Sparkles, Trash2, Plus, Check, FileText, X, Loader2 } from "lucide-react";

interface WBSAction {
  task: string;
  priority: "High" | "Medium" | "Low";
  dueDate: string;
}

interface WBSWorkPackage {
  name: string;
  lead: string;
  dueDate: string;
  description: string;
  actions: WBSAction[];
}

interface WBSProject {
  name: string;
  description: string;
  workPackages: WBSWorkPackage[];
}

interface WBSProgramme {
  name: string;
  description: string;
  projects: WBSProject[];
}

interface WBSResult {
  programmes: WBSProgramme[];
}

export default function WBSPlanner() {
  const { toast } = useToast();
  const store = useAppStore();

  const [files, setFiles] = useState<File[]>([]);
  const [additionalContext, setAdditionalContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [wbs, setWbs] = useState<WBSResult | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [iteratePrompt, setIteratePrompt] = useState("");
  const [iterating, setIterating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileAdd = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  }, []);

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    }
  }, []);

  const isImageFile = (file: File) => file.type.startsWith("image/");

  const readFileAsText = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(`[Could not read file: ${file.name}]`);
      reader.readAsText(file);
    });

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });

  const handleGenerate = async () => {
    if (files.length === 0 && !additionalContext.trim()) {
      toast({ title: "Please upload at least one document or provide context", variant: "destructive" });
      return;
    }

    setLoading(true);
    setWbs(null);
    setAccepted(false);

    try {
      const imageFiles = files.filter(isImageFile);
      const textFiles = files.filter((f) => !isImageFile(f));

      const documentTexts = await Promise.all(
        textFiles.map(async (f) => {
          const text = await readFileAsText(f);
          return `--- ${f.name} ---\n${text}`;
        })
      );

      const images = await Promise.all(
        imageFiles.map(async (f) => ({
          name: f.name,
          dataUrl: await readFileAsDataUrl(f),
        }))
      );

      const { data, error } = await supabase.functions.invoke("generate-wbs", {
        body: { documentTexts, images, additionalContext: additionalContext.trim() },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // Handle legacy single-programme format
      const result = normalizeWBSResult(data);
      setWbs(result);
      toast({ title: "Work breakdown structure generated!" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const normalizeWBSResult = (data: any): WBSResult => {
    if (data.programmes) return data as WBSResult;
    // Legacy format: single programme
    return {
      programmes: [{
        name: data.programmeName || "",
        description: data.programmeDescription || "",
        projects: data.projects || [],
      }],
    };
  };

  // Edit helpers
  const updateProgramme = (progIdx: number, field: "name" | "description", value: string) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      programmes[progIdx] = { ...programmes[progIdx], [field]: value };
      return { ...prev, programmes };
    });

  const updateProject = (progIdx: number, pi: number, field: keyof WBSProject, value: string) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      projects[pi] = { ...projects[pi], [field]: value } as any;
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const updateWP = (progIdx: number, pi: number, wi: number, field: keyof WBSWorkPackage, value: string) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      const wps = [...projects[pi].workPackages];
      wps[wi] = { ...wps[wi], [field]: value };
      projects[pi] = { ...projects[pi], workPackages: wps };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const updateAction = (progIdx: number, pi: number, wi: number, ai: number, field: keyof WBSAction, value: string) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      const wps = [...projects[pi].workPackages];
      const actions = [...wps[wi].actions];
      actions[ai] = { ...actions[ai], [field]: value };
      wps[wi] = { ...wps[wi], actions };
      projects[pi] = { ...projects[pi], workPackages: wps };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const removeAction = (progIdx: number, pi: number, wi: number, ai: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      const wps = [...projects[pi].workPackages];
      wps[wi] = { ...wps[wi], actions: wps[wi].actions.filter((_, i) => i !== ai) };
      projects[pi] = { ...projects[pi], workPackages: wps };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const addAction = (progIdx: number, pi: number, wi: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      const wps = [...projects[pi].workPackages];
      wps[wi] = { ...wps[wi], actions: [...wps[wi].actions, { task: "New task", priority: "Medium", dueDate: "" }] };
      projects[pi] = { ...projects[pi], workPackages: wps };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const removeProgramme = (progIdx: number) =>
    setWbs((prev) => prev ? { ...prev, programmes: prev.programmes.filter((_, i) => i !== progIdx) } : prev);

  const removeProject = (progIdx: number, pi: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      programmes[progIdx] = { ...programmes[progIdx], projects: programmes[progIdx].projects.filter((_, i) => i !== pi) };
      return { ...prev, programmes };
    });

  const removeWP = (progIdx: number, pi: number, wi: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      projects[pi] = { ...projects[pi], workPackages: projects[pi].workPackages.filter((_, i) => i !== wi) };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const addProgramme = () =>
    setWbs((prev) => prev ? { ...prev, programmes: [...prev.programmes, { name: "New Programme", description: "", projects: [] }] } : prev);

  const addProject = (progIdx: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      programmes[progIdx] = { ...programmes[progIdx], projects: [...programmes[progIdx].projects, { name: "New Project", description: "", workPackages: [] }] };
      return { ...prev, programmes };
    });

  const addWP = (progIdx: number, pi: number) =>
    setWbs((prev) => {
      if (!prev) return prev;
      const programmes = [...prev.programmes];
      const projects = [...programmes[progIdx].projects];
      projects[pi] = { ...projects[pi], workPackages: [...projects[pi].workPackages, { name: "New Work Package", lead: "", dueDate: "", description: "", actions: [] }] };
      programmes[progIdx] = { ...programmes[progIdx], projects };
      return { ...prev, programmes };
    });

  const handleAccept = () => {
    if (!wbs) return;

    wbs.programmes.forEach((prog) => {
      let programmeId = "";
      if (prog.name.trim()) {
        programmeId = crypto.randomUUID();
        store.addProgramme({ id: programmeId, name: prog.name, description: prog.description });
      }

      prog.projects.forEach((proj) => {
        const projectId = crypto.randomUUID();
        store.addProject({ id: projectId, name: proj.name, description: proj.description, programmeId, status: "Active" });

        proj.workPackages.forEach((wp) => {
          store.addWorkPackage({
            id: crypto.randomUUID(),
            project: proj.name,
            workPackage: wp.name,
            wpLead: wp.lead,
            startDate: "",
            dueDate: wp.dueDate,
            ragStatus: "Green",
            blockers: "",
            dependencies: [],
          });

          (wp.actions ?? []).forEach((action) => {
            store.addAction({
              id: crypto.randomUUID(),
              task: action.task,
              project: proj.name,
              workPackage: wp.name,
              startDate: "",
              dueDate: action.dueDate || "",
              priority: action.priority || "Medium",
              status: "Not Started",
              notes: "",
              labels: [],
            });
          });
        });
      });
    });

    setAccepted(true);
    toast({ title: "Work breakdown structure accepted and added to your projects!" });
  };

  const handleIterate = async () => {
    if (!wbs || !iteratePrompt.trim()) return;
    setIterating(true);
    try {
      const imageFiles = files.filter(isImageFile);
      const textFiles = files.filter((f) => !isImageFile(f));

      const documentTexts = await Promise.all(
        textFiles.map(async (f) => {
          const text = await readFileAsText(f);
          return `--- ${f.name} ---\n${text}`;
        })
      );

      const images = await Promise.all(
        imageFiles.map(async (f) => ({
          name: f.name,
          dataUrl: await readFileAsDataUrl(f),
        }))
      );

      const { data, error } = await supabase.functions.invoke("generate-wbs", {
        body: {
          documentTexts,
          images,
          additionalContext: additionalContext.trim(),
          currentWbs: wbs,
          iteratePrompt: iteratePrompt.trim(),
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const result = normalizeWBSResult(data);
      setWbs(result);
      setIteratePrompt("");
      toast({ title: "WBS refined!" });
    } catch (e: any) {
      toast({ title: "Refinement failed", description: e.message, variant: "destructive" });
    } finally {
      setIterating(false);
    }
  };

  const handleReset = () => {
    setWbs(null);
    setAccepted(false);
    setFiles([]);
    setAdditionalContext("");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> WBS Planner
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload project documents and let AI suggest a work breakdown structure
        </p>
      </div>

      {/* Upload Section */}
      {!wbs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Documents</Label>
              <div
                className={`mt-2 border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  {isDragging ? "Drop files here…" : "Drag & drop files here, or click to browse"}
                </p>
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose Files</span>
                  </Button>
                  <input type="file" multiple accept=".txt,.md,.csv,.json,.xml,.doc,.docx,.rtf,.pdf,.png,.jpg,.jpeg,.gif,.webp,.bmp" className="hidden" onChange={handleFileAdd} />
                </label>
              </div>
              {files.length > 0 && (
                <div className="mt-3 space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm rounded-md bg-muted px-3 py-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="context">Additional Context / Ideas (optional)</Label>
              <Textarea
                id="context"
                value={additionalContext}
                onChange={(e) => setAdditionalContext(e.target.value)}
                className="mt-1"
                rows={4}
                placeholder="Describe the project, goals, team, constraints, or paste ideas here..."
                maxLength={5000}
              />
            </div>

            <Button onClick={handleGenerate} disabled={loading || (files.length === 0 && !additionalContext.trim())} className="w-full">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing...</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate WBS</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* WBS Editor */}
      {wbs && !accepted && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Suggested Work Breakdown Structure</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Start Over</Button>
              <Button onClick={handleAccept}><Check className="h-4 w-4 mr-2" /> Accept & Create</Button>
            </div>
          </div>

          {/* Iterate prompt */}
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground">Refine this WBS</Label>
                  <Textarea
                    value={iteratePrompt}
                    onChange={(e) => setIteratePrompt(e.target.value)}
                    className="mt-1"
                    rows={2}
                    placeholder="e.g. Split the first project into two, add more detail to testing work packages, add a data migration project..."
                  />
                </div>
                <Button onClick={handleIterate} disabled={iterating || !iteratePrompt.trim()} className="shrink-0">
                  {iterating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Refining...</> : <><Sparkles className="h-4 w-4 mr-2" /> Refine</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Programmes */}
          {wbs.programmes.map((prog, progIdx) => (
            <div key={progIdx} className="space-y-3">
              {/* Programme header */}
              <Card className="border-primary/30">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="default">Programme {progIdx + 1}</Badge>
                    {wbs.programmes.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProgramme(progIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Programme Name</Label>
                      <Input value={prog.name} onChange={(e) => updateProgramme(progIdx, "name", e.target.value)} className="mt-1" placeholder="Leave empty for no programme" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Programme Description</Label>
                      <Input value={prog.description} onChange={(e) => updateProgramme(progIdx, "description", e.target.value)} className="mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Projects under this programme */}
              {prog.projects.map((proj, pi) => (
                <Card key={pi} className="ml-4">
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Project {pi + 1}</Badge>
                        <Input value={proj.name} onChange={(e) => updateProject(progIdx, pi, "name", e.target.value)} className="h-8 font-semibold w-60" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeProject(progIdx, pi)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <Input value={proj.description} onChange={(e) => updateProject(progIdx, pi, "description", e.target.value)} className="h-8 text-sm text-muted-foreground" placeholder="Project description" />
                  </CardHeader>
                  <CardContent className="pt-0 pb-4">
                    {proj.workPackages.length > 0 && (
                      <div className="border rounded-lg overflow-hidden mb-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/50 text-left">
                              <th className="px-3 py-2 font-medium">Work Package</th>
                              <th className="px-3 py-2 font-medium w-32">Lead</th>
                              <th className="px-3 py-2 font-medium w-36">Due Date</th>
                              <th className="px-3 py-2 font-medium w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {proj.workPackages.map((wp, wi) => (
                              <React.Fragment key={wi}>
                                <tr className="border-t">
                                  <td className="px-2 py-1">
                                    <Input value={wp.name} onChange={(e) => updateWP(progIdx, pi, wi, "name", e.target.value)} className="h-7 text-sm border-0 shadow-none font-medium" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <Input value={wp.lead} onChange={(e) => updateWP(progIdx, pi, wi, "lead", e.target.value)} className="h-7 text-sm border-0 shadow-none" placeholder="—" />
                                  </td>
                                  <td className="px-2 py-1">
                                    <Input type="date" value={wp.dueDate} onChange={(e) => updateWP(progIdx, pi, wi, "dueDate", e.target.value)} className="h-7 text-sm border-0 shadow-none" />
                                  </td>
                                  <td className="px-1 py-1">
                                    <button onClick={() => removeWP(progIdx, pi, wi)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                  </td>
                                </tr>
                                {(wp.actions ?? []).map((action, ai) => (
                                  <tr key={`${wi}-a-${ai}`} className="border-t bg-muted/20">
                                    <td className="px-2 py-1 pl-6">
                                      <Input value={action.task} onChange={(e) => updateAction(progIdx, pi, wi, ai, "task", e.target.value)} className="h-7 text-xs border-0 shadow-none" placeholder="Task description" />
                                    </td>
                                    <td className="px-2 py-1">
                                      <select value={action.priority} onChange={(e) => updateAction(progIdx, pi, wi, ai, "priority", e.target.value)} className="h-7 text-xs bg-transparent border-0 outline-none">
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                      </select>
                                    </td>
                                    <td className="px-2 py-1">
                                      <Input type="date" value={action.dueDate} onChange={(e) => updateAction(progIdx, pi, wi, ai, "dueDate", e.target.value)} className="h-7 text-xs border-0 shadow-none" />
                                    </td>
                                    <td className="px-1 py-1">
                                      <button onClick={() => removeAction(progIdx, pi, wi, ai)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t bg-muted/10">
                                  <td colSpan={4} className="px-2 py-1 pl-6">
                                    <button onClick={() => addAction(progIdx, pi, wi)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                                      <Plus className="h-3 w-3" /> Add task
                                    </button>
                                  </td>
                                </tr>
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => addWP(progIdx, pi)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Work Package</Button>
                  </CardContent>
                </Card>
              ))}

              <div className="ml-4">
                <Button variant="outline" onClick={() => addProject(progIdx)} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add Project to {prog.name || "Programme"}</Button>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addProgramme} className="w-full"><Plus className="h-4 w-4 mr-2" /> Add Programme</Button>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleReset}>Start Over</Button>
            <Button onClick={handleAccept} size="lg"><Check className="h-4 w-4 mr-2" /> Accept & Create All</Button>
          </div>
        </div>
      )}

      {/* Accepted confirmation */}
      {accepted && (
        <Card>
          <CardContent className="py-12 text-center">
            <Check className="h-12 w-12 mx-auto mb-3 text-rag-green" />
            <p className="text-lg font-semibold mb-1">Work Breakdown Structure Created</p>
            <p className="text-sm text-muted-foreground mb-4">All programmes, projects and work packages have been added.</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleReset}>Plan Another</Button>
              <Button onClick={() => window.location.href = "/projects"}>View Projects</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
