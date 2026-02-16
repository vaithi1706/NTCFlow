"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, ListTree, Check } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface AiBreakdownDialogProps {
  taskId: string;
  taskTitle: string;
  taskDescription: string;
  projectId: string;
  onCreated?: () => void;
}

export function AiBreakdownDialog({ taskId, taskTitle, taskDescription, projectId, onCreated }: AiBreakdownDialogProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const breakdownMutation = trpc.ai.breakdownTask.useMutation({
    onSuccess: (data) => {
      setSelected(new Set(data.suggestions.map((_, i) => i)));
    },
    onError: (err) => {
      toast.error(err.message.includes("Pro") ? "Upgrade to Pro for AI features" : "Failed to break down task");
    },
  });

  const handleOpen = () => {
    setOpen(true);
    breakdownMutation.mutate({
      title: taskTitle,
      description: taskDescription,
      projectId,
      parentId: taskId,
    });
  };

  const toggleItem = (idx: number) => {
    const next = new Set(selected);
    next.has(idx) ? next.delete(idx) : next.add(idx);
    setSelected(next);
  };

  const priorityColors: Record<string, string> = {
    urgent: "bg-red-500/10 text-red-500",
    high: "bg-orange-500/10 text-orange-500",
    medium: "bg-yellow-500/10 text-yellow-500",
    low: "bg-blue-500/10 text-blue-500",
  };

  return (
    <>
      <Button variant="ghost" size="sm" className="text-xs text-violet-500 hover:text-violet-600" onClick={handleOpen}>
        <ListTree className="h-3 w-3 mr-1" />AI Breakdown
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI Task Breakdown
              <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500">PRO</Badge>
            </DialogTitle>
          </DialogHeader>

          {breakdownMutation.isPending ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              <span>Breaking down task...</span>
            </div>
          ) : breakdownMutation.data ? (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-3">
                {breakdownMutation.data.tasks.length} subtasks created from "{taskTitle}"
              </p>
              {breakdownMutation.data.suggestions.map((sub, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                  <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{sub.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{sub.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary" className={`text-[10px] ${priorityColors[sub.priority] || ""}`}>
                        {sub.priority}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        {sub.estimatedPoints}pts
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {breakdownMutation.data && (
              <Button
                onClick={() => {
                  toast.success(`${breakdownMutation.data!.tasks.length} subtasks created`);
                  setOpen(false);
                  onCreated?.();
                }}
                className="bg-violet-500 hover:bg-violet-600"
              >
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
