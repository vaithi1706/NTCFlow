"use client";

import { useState, useEffect } from "react";
import { Activity, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

function ScoreGauge({ score }: { score: number }) {
  const color = score > 80 ? "#22c55e" : score > 60 ? "#eab308" : score > 40 ? "#f97316" : "#ef4444";
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
        <circle cx="60" cy="60" r="45" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
        <circle
          cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold" style={{ color }}>{score}</span>
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export function AiHealthScore({ projectId }: { projectId: string }) {
  const [expanded, setExpanded] = useState(false);
  const healthMutation = trpc.ai.projectHealthScore.useMutation();

  useEffect(() => {
    healthMutation.mutate({ projectId });
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = healthMutation.data;

  return (
    <Card className="p-4 bg-gradient-to-br from-violet-600/5 to-purple-600/5 border-violet-500/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold">AI Health Score</h3>
        </div>
        {data && (
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold",
            data.score > 80 ? "bg-green-500/20 text-green-400" :
            data.score > 60 ? "bg-yellow-500/20 text-yellow-400" :
            data.score > 40 ? "bg-orange-500/20 text-orange-400" :
            "bg-red-500/20 text-red-400"
          )}>
            {data.grade}
          </span>
        )}
      </div>

      {healthMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
        </div>
      )}

      {data && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <ScoreGauge score={data.score} />
            <div className="flex-1 space-y-1.5">
              {[
                { label: "Overdue", value: ((data.metrics?.overdue as any)?.percentage ?? 0) * 100, bad: true },
                { label: "Bug Ratio", value: ((data.metrics?.bugs as any)?.ratio ?? 0) * 100, bad: true },
                { label: "Completion", value: ((data.metrics?.completionRate as any)?.rate ?? 0) * 100, bad: false },
              ].map(m => (
                <div key={m.label}>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{m.label}</span>
                    <span>{m.value.toFixed(0)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", m.bad
                        ? (m.value > 30 ? "bg-red-500" : m.value > 15 ? "bg-yellow-500" : "bg-green-500")
                        : (m.value > 70 ? "bg-green-500" : m.value > 40 ? "bg-yellow-500" : "bg-red-500")
                      )}
                      style={{ width: `${Math.min(100, m.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-foreground/80">{data.assessment}</p>

          {data.suggestions.length > 0 && (
            <div>
              <button
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {expanded ? "Hide" : "Show"} suggestions ({data.suggestions.length})
              </button>
              {expanded && (
                <ul className="mt-1 space-y-1">
                  {data.suggestions.map((s, i) => (
                    <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
