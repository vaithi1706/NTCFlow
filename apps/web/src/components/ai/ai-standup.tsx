"use client";

import { useState } from "react";
import { Users, Loader2, Calendar, Mail, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AiStandup({ projectId }: { projectId: string }) {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  const standupMutation = trpc.ai.generateStandup.useMutation();

  const handleGenerate = () => {
    standupMutation.mutate({ projectId, date });
  };

  const data = standupMutation.data;

  return (
    <Card className="p-4 bg-gradient-to-br from-violet-600/5 to-purple-600/5 border-violet-500/20">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-400" />
          <h3 className="text-sm font-semibold">AI Standup Report</h3>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="h-7 w-36 text-xs"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-violet-500/30"
            onClick={handleGenerate}
            disabled={standupMutation.isPending}
          >
            {standupMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Calendar className="h-3 w-3 mr-1" />}
            Generate
          </Button>
          {data && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => toast.success("Standup report shared! (Email feature coming soon)")}
            >
              <Mail className="h-3 w-3 mr-1" />Share
            </Button>
          )}
        </div>
      </div>

      {!data && !standupMutation.isPending && (
        <p className="text-xs text-muted-foreground text-center py-6">Generate a standup report for your team</p>
      )}

      {standupMutation.isPending && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <span className="ml-2 text-sm text-muted-foreground">Generating standup report...</span>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {/* Team Summary */}
          {data.teamSummary && (
            <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
              <p className="text-xs font-medium text-violet-300 mb-1">Team Summary</p>
              <p className="text-sm">{data.teamSummary}</p>
            </div>
          )}

          {/* Member Cards */}
          <div className="grid gap-2">
            {data.standups.map((standup) => {
              const hasBlockers = standup.blockers.length > 0;
              return (
                <div
                  key={standup.userId}
                  className={cn(
                    "p-3 rounded-lg border",
                    hasBlockers
                      ? "border-red-500/30 bg-red-500/5"
                      : "border-green-500/20 bg-green-500/5"
                  )}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold",
                      hasBlockers ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"
                    )}>
                      {standup.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium">{standup.name}</span>
                    {hasBlockers && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
                    {!hasBlockers && <CheckCircle2 className="h-3 w-3 text-green-400 ml-auto" />}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Yesterday</p>
                      {standup.yesterday.map((item, i) => (
                        <p key={i} className="text-foreground/80">• {item}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Today</p>
                      {standup.today.map((item, i) => (
                        <p key={i} className="text-foreground/80">• {item}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-medium text-muted-foreground mb-1">Blockers</p>
                      {standup.blockers.length > 0
                        ? standup.blockers.map((item, i) => (
                            <p key={i} className="text-red-400">⚠ {item}</p>
                          ))
                        : <p className="text-green-400/70">None</p>
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
