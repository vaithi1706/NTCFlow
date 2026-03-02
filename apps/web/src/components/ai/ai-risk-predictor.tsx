"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw, Loader2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

const RISK_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  low: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Low Risk" },
  medium: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Medium Risk" },
  high: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "High Risk" },
  critical: { color: "text-red-500 animate-pulse", bg: "bg-red-500/15", border: "border-red-500/50", label: "Critical Risk" },
};

export function AiRiskPredictor({ projectId, sprintId }: { projectId: string; sprintId?: string }) {
  const riskMutation = trpc.ai.predictSprintRisk.useMutation();

  const handleAnalyze = () => {
    riskMutation.mutate({ projectId, sprintId });
  };

  const data = riskMutation.data;
  const config = data ? RISK_CONFIG[data.riskLevel] || RISK_CONFIG.medium : null;

  return (
    <Card className="p-4 bg-gradient-to-br from-violet-600/5 to-purple-600/5 border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold">AI Risk Predictor</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={handleAnalyze}
          disabled={riskMutation.isPending}
        >
          {riskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
          {data ? "Refresh" : "Analyze"}
        </Button>
      </div>

      {!data && !riskMutation.isPending && !riskMutation.isError && (
        <p className="text-xs text-muted-foreground text-center py-4">Click Analyze to predict sprint completion risk</p>
      )}

      {riskMutation.isError && (
        <div className="text-center py-4 space-y-2">
          <p className="text-xs text-muted-foreground">
            {riskMutation.error.message.includes("No active sprint")
              ? "No active sprint found. Start a sprint first to analyze risk."
              : riskMutation.error.message.includes("Pro")
              ? "Upgrade to Pro to use AI features."
              : `Error: ${riskMutation.error.message}`}
          </p>
          {riskMutation.error.message.includes("No active sprint") && (
            <p className="text-[11px] text-muted-foreground/60">Create and start a sprint from the Sprints page, then come back to analyze.</p>
          )}
        </div>
      )}

      {riskMutation.isPending && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span className="ml-2 text-sm text-muted-foreground">Analyzing sprint...</span>
        </div>
      )}

      {data && config && (
        <div className="space-y-3">
          {/* Risk Level & Probability */}
          <div className="flex items-center gap-4">
            <div className={cn("px-3 py-1.5 rounded-lg text-sm font-semibold", config.bg, config.border, config.color, "border")}>
              {config.label}
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{data.completionProbability}%</p>
              <p className="text-[10px] text-muted-foreground">Completion Probability</p>
            </div>
            {data.predictedEndDate && (
              <div className="text-center ml-auto">
                <p className="text-sm font-medium">{data.predictedEndDate}</p>
                <p className="text-[10px] text-muted-foreground">Predicted End</p>
              </div>
            )}
          </div>

          {/* Insights */}
          {data.insights.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Insights</p>
              <ul className="space-y-1">
                {data.insights.map((insight, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <span className="text-violet-400 mt-0.5">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Recommendations</p>
              <ul className="space-y-1">
                {data.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                    <span className="text-green-400 mt-0.5">→</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
