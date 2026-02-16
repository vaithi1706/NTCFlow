"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface AiSprintPlanProps {
  projectId: string;
  backlogTasks: Array<{ id: string; title: string; priority: string; storyPoints?: number | null }>;
  activeSprintId?: string;
  onAddToSprint?: (taskIds: string[]) => void;
}

export function AiSprintPlan({ projectId, backlogTasks, activeSprintId, onAddToSprint }: AiSprintPlanProps) {
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const mutation = trpc.ai.sprintPlanSuggestion.useMutation({
    onSuccess: (data) => {
      setSelectedIds(data.suggestedTaskIds);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleOpen = () => {
    setOpen(true);
    mutation.mutate({ projectId });
  };

  const toggleTask = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAddToSprint = () => {
    if (onAddToSprint && selectedIds.length > 0) {
      onAddToSprint(selectedIds);
      setOpen(false);
      toast.success(`${selectedIds.length} tasks added to sprint`);
    }
  };

  const suggestedTasks = backlogTasks.filter(t => mutation.data?.suggestedTaskIds.includes(t.id));

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={handleOpen}>
        <Sparkles className="h-3.5 w-3.5" />
        AI Sprint Plan
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Zap className="h-4 w-4 text-violet-400" />
              </div>
              AI Sprint Planning
            </DialogTitle>
            <DialogDescription>AI-suggested tasks for your next sprint based on priority, velocity, and capacity.</DialogDescription>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">Analyzing backlog...</p>
            </div>
          ) : mutation.data ? (
            <div className="space-y-4">
              {/* Stats */}
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <p className="text-xs text-muted-foreground">Total Points</p>
                  <p className="text-lg font-bold text-violet-400">{mutation.data.totalPoints}</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-xs text-muted-foreground">Capacity Used</p>
                  <p className="text-lg font-bold text-purple-400">{mutation.data.capacityUsed}%</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-muted-foreground">Tasks</p>
                  <p className="text-lg font-bold text-blue-400">{selectedIds.length}</p>
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">{mutation.data.reasoning}</p>

              {/* Task list */}
              <div className="max-h-60 overflow-y-auto space-y-1">
                {suggestedTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/30">
                    <Checkbox checked={selectedIds.includes(task.id)} onCheckedChange={() => toggleTask(task.id)} />
                    <span className="text-sm flex-1 truncate">{task.title}</span>
                    <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>
                    {task.storyPoints != null && <Badge variant="secondary" className="text-[10px]">{task.storyPoints} SP</Badge>}
                  </div>
                ))}
              </div>

              {/* Actions */}
              {activeSprintId && (
                <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500" onClick={handleAddToSprint} disabled={selectedIds.length === 0}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Add {selectedIds.length} Tasks to Sprint
                </Button>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
