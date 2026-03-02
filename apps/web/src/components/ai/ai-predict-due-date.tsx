"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sparkles, Loader2, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { format } from "date-fns";

interface AiPredictDueDateProps {
  taskTitle: string;
  taskDescription: string | null;
  taskType: string;
  taskPriority: string;
  storyPoints: number | null;
  projectId: string;
  assigneeId: string | null;
  onApply?: (date: string) => void;
}

export function AiPredictDueDate({
  taskTitle, taskDescription, taskType, taskPriority, storyPoints, projectId, assigneeId, onApply,
}: AiPredictDueDateProps) {
  const [result, setResult] = useState<{ suggestedDate: string; confidence: number; reasoning: string; estimatedDays: number } | null>(null);
  const [open, setOpen] = useState(false);

  const mutation = trpc.ai.predictDueDate.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handlePredict = () => {
    mutation.mutate({ taskTitle, taskDescription, taskType, taskPriority, storyPoints, projectId, assigneeId });
  };

  const handleApply = () => {
    if (result?.suggestedDate) {
      onApply?.(result.suggestedDate);
      setOpen(false);
      toast.success("Due date applied");
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-primary" onClick={() => { setOpen(true); handlePredict(); }}>
          <Sparkles className="h-3 w-3" />
          Predict Due Date
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        {mutation.isPending && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing historical data...</span>
          </div>
        )}
        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI Predicted Due Date</span>
            </div>

            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
              <p className="text-lg font-semibold">{format(new Date(result.suggestedDate), "MMM d, yyyy")}</p>
              <p className="text-xs text-muted-foreground">~{result.estimatedDays} days from now</p>
            </div>

            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="font-medium">{result.confidence}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      result.confidence >= 70 ? "bg-green-500" : result.confidence >= 40 ? "bg-yellow-500" : "bg-red-500"
                    }`}
                    style={{ width: `${result.confidence}%` }}
                  />
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{result.reasoning}</p>

            <Button size="sm" className="w-full gap-1.5" onClick={handleApply}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Apply Due Date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
