"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, FileText, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

interface AiMeetingNotesProps {
  projectId: string;
  onCreateTasks?: (tasks: Array<{ title: string; description: string; priority: string; type: string }>) => void;
}

export function AiMeetingNotes({ projectId, onCreateTasks }: AiMeetingNotesProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const mutation = trpc.ai.extractTasksFromNotes.useMutation({
    onSuccess: (data) => {
      setSelectedIdxs(data.tasks.map((_, i) => i));
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {},
    onError: (err) => toast.error(err.message),
  });

  const utils = trpc.useUtils();

  const handleExtract = () => {
    if (!notes.trim()) return toast.error("Paste your meeting notes first");
    mutation.mutate({ notes, projectId });
  };

  const toggleTask = (idx: number) => {
    setSelectedIdxs(prev => prev.includes(idx) ? prev.filter(x => x !== idx) : [...prev, idx]);
  };

  const handleCreateSelected = async () => {
    if (!mutation.data) return;
    const selected = mutation.data.tasks.filter((_, i) => selectedIdxs.includes(i));
    if (onCreateTasks) {
      onCreateTasks(selected);
    }
    toast.success(`${selected.length} tasks ready to create`);
    setOpen(false);
    setNotes("");
    mutation.reset();
  };

  const priorityColor: Record<string, string> = {
    urgent: "text-red-400 border-red-500/30",
    high: "text-orange-400 border-orange-500/30",
    medium: "text-yellow-400 border-yellow-500/30",
    low: "text-blue-400 border-blue-500/30",
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={() => setOpen(true)}>
        <FileText className="h-3.5 w-3.5" />
        Meeting Notes → Tasks
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <FileText className="h-4 w-4 text-violet-400" />
              </div>
              Meeting Notes → Tasks
            </DialogTitle>
            <DialogDescription>Paste meeting notes and AI will extract action items as tasks.</DialogDescription>
          </DialogHeader>

          {!mutation.data ? (
            <div className="space-y-4">
              <Textarea
                placeholder="Paste your meeting notes here...&#10;&#10;Example:&#10;- John will fix the login bug by Friday&#10;- Sarah to design the new dashboard&#10;- Team agreed to add unit tests for the API"
                className="min-h-[200px] text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button
                className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                onClick={handleExtract}
                disabled={mutation.isPending || !notes.trim()}
              >
                {mutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Extracting...</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" />Extract Tasks</>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{mutation.data.tasks.length} action items found</p>

              <div className="max-h-72 overflow-y-auto space-y-2">
                {mutation.data.tasks.map((task, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg border border-border/50 hover:bg-muted/30">
                    <Checkbox checked={selectedIdxs.includes(idx)} onCheckedChange={() => toggleTask(idx)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{task.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="outline" className={`text-[10px] ${priorityColor[task.priority] || ""}`}>{task.priority}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{task.type}</Badge>
                        {task.assigneeName && <span className="text-[10px] text-muted-foreground">→ {task.assigneeName}</span>}
                        {task.dueDate && <span className="text-[10px] text-muted-foreground">Due: {task.dueDate}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { mutation.reset(); }}>
                  Back
                </Button>
                <Button className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500" onClick={handleCreateSelected} disabled={selectedIdxs.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create {selectedIdxs.length} Tasks
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
