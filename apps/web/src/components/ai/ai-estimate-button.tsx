"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2 } from "lucide-react";

interface AiEstimateButtonProps {
  taskTitle: string;
  taskDescription: string;
  projectId: string;
  onApply: (points: number) => void;
}

export function AiEstimateButton({ taskTitle, taskDescription, projectId, onApply }: AiEstimateButtonProps) {
  const [open, setOpen] = useState(false);

  const estimateMutation = trpc.ai.estimateEffort.useMutation();

  const handleClick = () => {
    setOpen(true);
    estimateMutation.mutate({ title: taskTitle, description: taskDescription, projectId });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={handleClick}
          className="h-7 px-1.5 rounded text-xs font-medium border border-violet-500/30 text-violet-500 hover:bg-violet-500/10 transition-colors flex items-center gap-1"
          title="AI Estimate"
        >
          <Sparkles className="h-3 w-3" />AI
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {estimateMutation.isPending ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
            <span className="text-xs">Estimating...</span>
          </div>
        ) : estimateMutation.data ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Suggested</span>
              <Button
                size="sm"
                className="h-6 text-xs bg-violet-500 hover:bg-violet-600"
                onClick={() => {
                  onApply(estimateMutation.data!.points);
                  setOpen(false);
                }}
              >
                Apply {estimateMutation.data.points}pts
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{estimateMutation.data.reasoning}</p>
          </div>
        ) : estimateMutation.error ? (
          <p className="text-xs text-red-500">
            {estimateMutation.error.message.includes("Pro") ? "Pro plan required" : "Failed"}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
