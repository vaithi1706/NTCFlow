"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Check, X } from "lucide-react";

interface AiTaskHelperProps {
  taskId: string;
  taskTitle: string;
  projectId: string;
  onApplyDescription?: (description: string) => void;
  onCreateSubtasks?: (titles: string[]) => void;
}

export function AiTaskHelper({ taskId, taskTitle, projectId, onApplyDescription, onCreateSubtasks }: AiTaskHelperProps) {
  const [open, setOpen] = useState(false);

  const generateMutation = trpc.ai.generateDescription.useMutation();

  const handleGenerate = () => {
    setOpen(true);
    generateMutation.mutate({ title: taskTitle, projectId });
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-xs text-primary" onClick={handleGenerate}>
        <Sparkles className="h-3 w-3 mr-1" />AI Assist
      </Button>
    );
  }

  return (
    <Card className="p-4 mt-2 border-primary/20 bg-primary/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">AI Suggestions</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
          <X className="h-3 w-3" />
        </Button>
      </div>

      {generateMutation.isPending ? (
        <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Generating suggestions...</span>
        </div>
      ) : generateMutation.data ? (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-medium text-muted-foreground">Description</p>
              {onApplyDescription && (
                <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => { onApplyDescription(generateMutation.data!.description); }}>
                  <Check className="h-3 w-3 mr-1" />Apply
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{generateMutation.data.description}</p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Acceptance Criteria</p>
            <ul className="space-y-1">
              {generateMutation.data.acceptanceCriteria.map((c, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span>{c}
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground">Suggested Subtasks</p>
              {onCreateSubtasks && (
                <Button size="sm" variant="ghost" className="h-6 text-xs text-primary" onClick={() => onCreateSubtasks(generateMutation.data!.suggestedSubtasks)}>
                  <Check className="h-3 w-3 mr-1" />Create All
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {generateMutation.data.suggestedSubtasks.map((s, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      ) : generateMutation.error ? (
        <p className="text-sm text-red-500">Failed to generate. Try again.</p>
      ) : null}
    </Card>
  );
}
