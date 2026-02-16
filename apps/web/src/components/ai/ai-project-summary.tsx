"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, RefreshCw, AlertTriangle, Loader2 } from "lucide-react";

export function AiProjectSummary({ projectId }: { projectId: string }) {
  const { data, isLoading, refetch, isFetching, error } = trpc.ai.projectSummary.useQuery({ projectId });

  if (error?.message?.includes("Pro")) {
    return null; // Hide for free users
  }

  return (
    <Card className="p-5 border-violet-500/10 bg-gradient-to-br from-violet-500/5 to-purple-500/5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-medium">AI Project Summary</h3>
          <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500 border-violet-500/20">PRO</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          <span className="ml-1">Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-4 rounded bg-muted animate-pulse w-full" />
          <div className="h-4 rounded bg-muted animate-pulse w-3/4" />
        </div>
      ) : data ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{data.summary}</p>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Completion:</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-xs">
              <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${data.completionPercentage}%` }} />
            </div>
            <span className="text-xs font-medium">{data.completionPercentage}%</span>
          </div>

          {data.blockers.length > 0 && (
            <div>
              <p className="text-xs font-medium text-red-500 flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" />Blockers</p>
              <ul className="space-y-1">{data.blockers.map((b, i) => <li key={i} className="text-xs text-muted-foreground">• {b}</li>)}</ul>
            </div>
          )}

          {data.overdueTasks.length > 0 && (
            <div>
              <p className="text-xs font-medium text-yellow-500 mb-1">Overdue Tasks</p>
              <div className="flex flex-wrap gap-1">{data.overdueTasks.map((t, i) => <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>)}</div>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  );
}
