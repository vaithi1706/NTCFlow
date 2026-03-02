"use client";

import { useState, useEffect } from "react";
import { Bot, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiAutoTriageProps {
  taskId: string;
  projectId: string;
  onApplied?: () => void;
}

export function AiAutoTriage({ taskId, projectId, onApplied }: AiAutoTriageProps) {
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  const triageMutation = trpc.ai.autoTriage.useMutation({
    onError: (err) => console.log("[AutoTriage] Error:", err.message),
  });
  const applyMutation = trpc.ai.applyTriage.useMutation({
    onSuccess: () => {
      setApplied(true);
      toast.success("AI suggestions applied");
      onApplied?.();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    triageMutation.mutate({ taskId, projectId });
  }, [taskId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (dismissed || applied || triageMutation.isError) return null;
  if (triageMutation.isPending) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20 text-sm">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
        <span className="text-violet-300">AI analyzing task...</span>
      </div>
    );
  }

  const data = triageMutation.data;
  if (!data) return null;

  const suggestions: string[] = [];
  if (data.priority) suggestions.push(`Priority: ${data.priority}`);
  if (data.taskType) suggestions.push(`Type: ${data.taskType}`);
  if (data.suggestedAssignee) suggestions.push(`Assign to: ${data.suggestedAssignee.name}`);

  if (suggestions.length === 0) return null;

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 text-sm">
      <div className="flex items-center gap-2">
        <Bot className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />
        <span className="text-violet-200">AI suggests: {suggestions.join(", ")}</span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10"
          onClick={() => applyMutation.mutate({
            taskId,
            projectId,
            priority: data.priority,
            taskType: data.taskType,
            assigneeId: data.suggestedAssignee?.userId,
          })}
          disabled={applyMutation.isPending}
        >
          <Check className="h-3 w-3 mr-1" />Apply
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function useAutoTriageEnabled(projectId: string): [boolean, (v: boolean) => void] {
  const key = `ai-auto-triage-${projectId}`;
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(key) === "true";
  });
  const toggle = (v: boolean) => {
    setEnabled(v);
    localStorage.setItem(key, String(v));
  };
  return [enabled, toggle];
}
