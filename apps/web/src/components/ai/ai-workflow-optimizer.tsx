"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Loader2, Workflow, AlertTriangle, TrendingUp, Lightbulb,
  RefreshCw, ArrowRight, BarChart3, Target,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiWorkflowOptimizerProps {
  projectId: string;
}

const impactColors = {
  high: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
};

const typeIcons = {
  bottleneck: AlertTriangle,
  pattern: BarChart3,
  improvement: TrendingUp,
};

export function AiWorkflowOptimizer({ projectId }: AiWorkflowOptimizerProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.ai.analyzeWorkflow.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = () => mutation.mutate({ projectId });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleAnalyze}>
          <Workflow className="h-4 w-4" />
          Workflow Analysis
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            AI Workflow Optimization
          </DialogTitle>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing workflow patterns...</span>
          </div>
        )}

        {result && (
          <div>
            <div className="space-y-4 pr-4">
              {/* Score */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-card border">
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--color-muted)"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="3"
                      strokeDasharray={`${result.score}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">{result.score}</span>
                </div>
                <div>
                  <p className="font-medium">Workflow Efficiency Score</p>
                  <p className="text-sm text-muted-foreground">
                    {result.score >= 80 ? "Your workflow is well optimized" :
                     result.score >= 60 ? "Room for improvement" :
                     "Significant optimization needed"}
                  </p>
                </div>
              </div>

              {/* Insights */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Insights
                </p>
                <div className="space-y-2">
                  {result.insights?.map((insight: any, i: number) => {
                    const Icon = typeIcons[insight.type as keyof typeof typeIcons] || Lightbulb;
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{insight.title}</p>
                            <Badge variant="outline" className={`text-xs ${impactColors[insight.impact as keyof typeof impactColors] || ""}`}>
                              {insight.impact}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Recommendations */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Target className="h-4 w-4 text-primary" />
                  Recommendations
                </p>
                <div className="space-y-2">
                  {result.recommendations?.map((rec: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg border bg-card">
                      <p className="text-sm font-medium">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{rec.description}</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <TrendingUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                        <span className="text-xs text-green-700 dark:text-green-400">{rec.expectedImprovement}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {result && (
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAnalyze}>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-analyze
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
