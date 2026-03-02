"use client";

import { useState } from "react";
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
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Zap, ArrowRight, Plus, Calendar, GripVertical, MoveRight } from "lucide-react";
import { toast } from "sonner";

interface AiSprintPlanProps {
  projectId: string;
  backlogTasks: Array<{ id: string; title: string; priority: string; storyPoints?: number | null }>;
  activeSprintId?: string;
  onAddToSprint?: (taskIds: string[]) => void;
  onRefresh?: () => void;
}

export function AiSprintPlan({ projectId, backlogTasks, activeSprintId, onAddToSprint, onRefresh }: AiSprintPlanProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [sprintName, setSprintName] = useState("");

  const utils = trpc.useUtils();

  const mutation = trpc.ai.sprintPlanSuggestion.useMutation({
    onSuccess: (data) => {
      setSelectedIds(data.suggestedTaskIds);
    },
    onError: (err) => toast.error(err.message),
  });

  const moveMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
    },
  });

  const handleOpen = () => {
    setOpen(true);
    setShowCreateSprint(false);
    mutation.mutate({ projectId });
  };

  const toggleTask = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === suggestedTasks.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(suggestedTasks.map(t => t.id));
    }
  };

  const handleAddToSprint = () => {
    if (onAddToSprint && selectedIds.length > 0) {
      onAddToSprint(selectedIds);
      setOpen(false);
      toast.success(`${selectedIds.length} tasks added to sprint`);
      onRefresh?.();
    }
  };

  const handleMoveToTodo = () => {
    if (selectedIds.length === 0) return;
    for (const taskId of selectedIds) {
      moveMutation.mutate({ taskId, data: { status: "todo" } });
    }
    setOpen(false);
    toast.success(`${selectedIds.length} tasks moved to To Do`);
    onRefresh?.();
  };

  const suggestedTasks = backlogTasks.filter(t => mutation.data?.suggestedTaskIds.includes(t.id));

  const selectedPoints = suggestedTasks
    .filter(t => selectedIds.includes(t.id))
    .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  const priorityColor: Record<string, string> = {
    urgent: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  };

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10" onClick={handleOpen}>
        <Sparkles className="h-3.5 w-3.5" />
        AI Sprint Plan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Zap className="h-4 w-4 text-violet-500" />
              </div>
              AI Sprint Planning
            </DialogTitle>
            <DialogDescription>AI-suggested tasks for your next sprint based on priority, velocity, and capacity.</DialogDescription>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Analyzing backlog...</p>
            </div>
          ) : mutation.data ? (
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0 pr-1">
              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <p className="text-[11px] text-muted-foreground">Selected Points</p>
                  <p className="text-lg font-bold text-violet-600 dark:text-violet-400">{selectedPoints}</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-[11px] text-muted-foreground">Capacity Used</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">{mutation.data.capacityUsed}%</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-[11px] text-muted-foreground">Selected</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{selectedIds.length}/{suggestedTasks.length}</p>
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{mutation.data.reasoning}</p>

              {/* Select all */}
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {selectedIds.length === suggestedTasks.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-xs text-muted-foreground">{selectedPoints} story points selected</span>
              </div>

              {/* Task list */}
              <div className="max-h-56 overflow-y-auto space-y-1 border border-border rounded-lg p-1">
                {suggestedTasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-md transition-colors cursor-pointer ${
                      selectedIds.includes(task.id) ? "bg-violet-500/5 border border-violet-500/20" : "hover:bg-muted/50 border border-transparent"
                    }`}
                    onClick={() => toggleTask(task.id)}
                  >
                    <Checkbox checked={selectedIds.includes(task.id)} onCheckedChange={() => toggleTask(task.id)} />
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${priorityColor[task.priority] || ""}`}>{task.priority}</Badge>
                    {task.storyPoints != null && (
                      <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{task.storyPoints} SP</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="space-y-2 pt-1">
                {activeSprintId ? (
                  <Button
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                    onClick={handleAddToSprint}
                    disabled={selectedIds.length === 0}
                  >
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Add {selectedIds.length} Tasks to Active Sprint
                  </Button>
                ) : (
                  <p className="text-xs text-center text-muted-foreground">No active sprint. Choose an action below:</p>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={handleMoveToTodo}
                    disabled={selectedIds.length === 0 || moveMutation.isPending}
                  >
                    <MoveRight className="h-4 w-4 mr-1.5" />
                    Move to To Do
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      mutation.reset();
                      mutation.mutate({ projectId });
                    }}
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Re-analyze
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
