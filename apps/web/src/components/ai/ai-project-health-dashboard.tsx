"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, TrendingUp, TrendingDown, Minus,
  AlertTriangle, CheckCircle2, Shield, RefreshCw, ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiProjectHealthDashboardProps {
  workspaceId: string;
}

const trendIcons = {
  improving: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
};

export function AiProjectHealthDashboard({ workspaceId }: AiProjectHealthDashboardProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.ai.projectHealthDashboard.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = () => mutation.mutate({ workspaceId });

  const getHealthIcon = (health: string) => {
    if (health === "healthy") return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (health === "critical") return <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
  };

  const getHealthBadgeClass = (health: string) => {
    if (health === "healthy") return "border-green-500/30 text-green-700 dark:text-green-400";
    if (health === "critical") return "border-red-500/30 text-red-700 dark:text-red-400";
    return "border-yellow-500/30 text-yellow-700 dark:text-yellow-400";
  };

  const getSeverityBadgeClass = (severity: string) => {
    if (severity === "critical") return "border-red-500/30 text-red-700 dark:text-red-400";
    if (severity === "high") return "border-orange-500/30 text-orange-700 dark:text-orange-400";
    if (severity === "medium") return "border-yellow-500/30 text-yellow-700 dark:text-yellow-400";
    return "border-green-500/30 text-green-700 dark:text-green-400";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleAnalyze}>
          <Shield className="h-4 w-4" />
          Health Dashboard
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            AI Project Health Dashboard
          </DialogTitle>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing all projects...</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Overall Health */}
            <div className="flex items-center gap-6 p-4 rounded-lg border bg-card">
              <div className="relative h-20 w-20 shrink-0">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none" stroke="var(--color-muted)" strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={result.overallHealth?.score >= 70 ? "var(--color-chart-2)" : result.overallHealth?.score >= 40 ? "var(--color-chart-3)" : "var(--color-destructive)"}
                    strokeWidth="3"
                    strokeDasharray={`${result.overallHealth?.score || 0}, 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold leading-none">{result.overallHealth?.score}</span>
                  <span className="text-[10px] text-muted-foreground leading-none mt-1">{result.overallHealth?.grade}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">Overall Health</p>
                  {(() => {
                    const TrendIcon = trendIcons[result.overallHealth?.trend as keyof typeof trendIcons] || Minus;
                    const trendColor = result.overallHealth?.trend === "improving" ? "text-green-700 dark:text-green-400" :
                      result.overallHealth?.trend === "declining" ? "text-red-700 dark:text-red-400" : "text-muted-foreground";
                    return (
                      <Badge variant="outline" className={`gap-1 text-xs ${trendColor}`}>
                        <TrendIcon className="h-3 w-3" />
                        {result.overallHealth?.trend}
                      </Badge>
                    );
                  })()}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{result.executiveSummary}</p>
              </div>
            </div>

            {/* Project Breakdown */}
            <div>
              <p className="text-sm font-medium mb-2">Project Status</p>
              <div className="grid gap-2">
                {result.projectBreakdown?.map((p: any) => (
                  <div key={p.projectId} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getHealthIcon(p.health)}
                        <span className="text-sm font-medium">{p.name}</span>
                      </div>
                      <Badge variant="outline" className={`text-xs capitalize ${getHealthBadgeClass(p.health)}`}>
                        {p.health?.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-6">{p.keyIssue}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Risks */}
            {result.topRisks?.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    Top Risks
                  </p>
                  <div className="space-y-1.5">
                    {result.topRisks.map((r: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border bg-card">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">{r.project}</span>
                          <Badge variant="outline" className={`text-xs ${getSeverityBadgeClass(r.severity)}`}>
                            {r.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{r.risk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Recommendations</p>
                  <div className="space-y-1.5">
                    {result.recommendations.map((r: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-muted-foreground">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAnalyze}>
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
