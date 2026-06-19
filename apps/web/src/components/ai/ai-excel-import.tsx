"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AiExcelImportProps {
  projectId: string;
  onComplete?: () => void;
}

interface ImportTask {
  title: string;
  description: string;
  type: string;
  priority: string;
  labels: string[];
  selected: boolean;
}

export function AiExcelImport({ projectId, onComplete }: AiExcelImportProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [warning, setWarning] = useState<string | undefined>();
  const [createdCount, setCreatedCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMutation = trpc.ai.importExcel.useMutation();
  const confirmMutation = trpc.ai.confirmImportTasks.useMutation();

  const reset = () => {
    setStep(1);
    setFile(null);
    setTasks([]);
    setWarning(undefined);
    setCreatedCount(0);
    setUploading(false);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleFileSelect = (f: File) => {
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(f.type) && !["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("Please upload an .xlsx, .xls, or .csv file");
      return;
    }
    setFile(f);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const handleAnalyze = async () => {
    if (!file) return;
    setUploading(true);
    try {
      // Upload file first
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("accessToken");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const attachment = await res.json();

      // Analyze with AI
      const result = await analyzeMutation.mutateAsync({
        fileUrl: attachment.fileUrl,
        projectId,
      });

      setTasks(result.tasks.map((t) => ({ ...t, selected: true })));
      setWarning(result.warning);
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Failed to analyze file");
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    const selected = tasks.filter((t) => t.selected);
    if (selected.length === 0) {
      toast.error("Select at least one task");
      return;
    }
    try {
      const result = await confirmMutation.mutateAsync({
        projectId,
        tasks: selected.map(({ selected: _, ...t }) => t),
      });
      setCreatedCount(result.created);
      setStep(3);
      onComplete?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to create tasks");
    }
  };

  const toggleAll = (checked: boolean) => {
    setTasks((prev) => prev.map((t) => ({ ...t, selected: checked })));
  };

  const toggleTask = (idx: number) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, selected: !t.selected } : t)));
  };

  const updateTask = (idx: number, field: string, value: string) => {
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));
  };

  const selectedCount = tasks.filter((t) => t.selected).length;
  const taskCount = tasks.filter((t) => t.selected && t.type === "task").length;
  const bugCount = tasks.filter((t) => t.selected && t.type === "bug").length;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <Upload className="h-3.5 w-3.5" />
        AI Import
      </Button>

      <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-violet-400">
              <Sparkles className="h-5 w-5" />
              AI Excel Import
            </DialogTitle>
            <DialogDescription>
              Import tasks from a spreadsheet — AI will analyze and categorize them
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center gap-2 px-2 pb-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border transition-colors",
                    step >= s
                      ? "bg-violet-500/20 border-violet-500 text-violet-300"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {step > s ? <CheckCircle2 className="h-4 w-4" /> : s}
                </div>
                <span className={cn("text-xs", step >= s ? "text-violet-300" : "text-muted-foreground")}>
                  {s === 1 ? "Upload" : s === 2 ? "Preview" : "Done"}
                </span>
                {s < 3 && <div className={cn("w-8 h-px", step > s ? "bg-violet-500" : "bg-border")} />}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
              <div
                className={cn(
                  "w-full border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 transition-colors cursor-pointer",
                  dragOver
                    ? "border-violet-500 bg-violet-500/10"
                    : file
                    ? "border-green-500/50 bg-green-500/5"
                    : "border-border hover:border-violet-500/50 hover:bg-violet-500/5"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <>
                    <FileSpreadsheet className="h-12 w-12 text-green-400" />
                    <div className="text-center">
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(file.size / 1024).toFixed(1)} KB — Click to change
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-muted-foreground" />
                    <div className="text-center">
                      <p className="font-medium">Drop your Excel file here</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Supports .xlsx, .xls, .csv
                      </p>
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              <Button
                className="bg-violet-600 hover:bg-violet-700"
                disabled={!file || uploading}
                onClick={handleAnalyze}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="flex-1 flex flex-col gap-3 overflow-hidden">
              {warning && (
                <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {warning}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm">
                  AI detected{" "}
                  <span className="font-semibold text-green-400">{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
                  {bugCount > 0 && (
                    <>
                      {" "}and{" "}
                      <span className="font-semibold text-red-400">{bugCount} bug{bugCount !== 1 ? "s" : ""}</span>
                    </>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedCount === tasks.length}
                    onCheckedChange={(v) => toggleAll(!!v)}
                  />
                  <span className="text-xs text-muted-foreground">Select all</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr className="text-left text-xs text-muted-foreground">
                      <th className="p-2 w-8"></th>
                      <th className="p-2">Title</th>
                      <th className="p-2 w-20">Type</th>
                      <th className="p-2 w-24">Priority</th>
                      <th className="p-2 w-32">Labels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-t border-border/50 hover:bg-muted/20 transition-colors",
                          !task.selected && "opacity-40"
                        )}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={task.selected}
                            onCheckedChange={() => toggleTask(idx)}
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            value={task.title}
                            onChange={(e) => updateTask(idx, "title", e.target.value)}
                            className="h-7 text-xs border-none bg-transparent p-0 focus-visible:ring-0"
                          />
                          <p className="text-[10px] text-muted-foreground truncate max-w-md mt-0.5">
                            {task.description.slice(0, 120)}
                          </p>
                        </td>
                        <td className="p-2">
                          <Select
                            value={task.type}
                            onValueChange={(v) => updateTask(idx, "type", v)}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-16 border-none p-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="task">Task</SelectItem>
                              <SelectItem value="bug">Bug</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <Select
                            value={task.priority}
                            onValueChange={(v) => updateTask(idx, "priority", v)}
                          >
                            <SelectTrigger className="h-6 text-[10px] w-20 border-none p-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="urgent">Urgent</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2">
                          <div className="flex flex-wrap gap-1">
                            {task.labels.map((l, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px] h-4 px-1">
                                {l}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" size="sm" onClick={() => { setStep(1); setTasks([]); }}>
                  Back
                </Button>
                <Button
                  className="bg-violet-600 hover:bg-violet-700"
                  disabled={selectedCount === 0 || confirmMutation.isPending}
                  onClick={handleConfirm}
                >
                  {confirmMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>Create {selectedCount} Task{selectedCount !== 1 ? "s" : ""}</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Done */}
          {step === 3 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
              <CheckCircle2 className="h-16 w-16 text-green-400" />
              <div className="text-center">
                <p className="text-lg font-semibold">Successfully created {createdCount} tasks!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  They've been added to your board's first column.
                </p>
              </div>
              <Button onClick={handleClose} className="bg-violet-600 hover:bg-violet-700">
                Done
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
