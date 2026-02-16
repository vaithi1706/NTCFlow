"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, RefreshCw, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AiAnomalyAlertsProps {
  workspaceId: string;
}

export function AiAnomalyAlerts({ workspaceId }: AiAnomalyAlertsProps) {
  const mutation = trpc.ai.detectAnomalies.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleRefresh = () => {
    mutation.mutate({ workspaceId });
  };

  // Auto-load on mount
  useState(() => { mutation.mutate({ workspaceId }); });

  const severityConfig = {
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", badge: "bg-blue-500/20 text-blue-400" },
    warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", badge: "bg-amber-500/20 text-amber-400" },
    critical: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", badge: "bg-red-500/20 text-red-400" },
  };

  return (
    <Card className="relative overflow-hidden border-border/50 bg-gradient-to-br from-violet-500/[0.05] to-purple-500/[0.05]">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <h3 className="text-sm font-semibold">AI Insights</h3>
            <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">Pro</Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRefresh} disabled={mutation.isPending}>
            <RefreshCw className={`h-3.5 w-3.5 ${mutation.isPending ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {mutation.isPending ? (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
            <span className="text-sm text-muted-foreground">Analyzing metrics...</span>
          </div>
        ) : mutation.data ? (
          <div className="space-y-2">
            {mutation.data.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">✅ Everything looks healthy!</p>
            ) : (
              mutation.data.alerts.map((alert, idx) => {
                const config = severityConfig[alert.severity] || severityConfig.info;
                const Icon = config.icon;
                return (
                  <div key={idx} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${config.bg} border ${config.border}`}>
                    <Icon className={`h-4 w-4 ${config.color} flex-shrink-0 mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.badge}`}>{alert.severity}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Click refresh to analyze your workspace metrics.</p>
        )}
      </div>
    </Card>
  );
}
