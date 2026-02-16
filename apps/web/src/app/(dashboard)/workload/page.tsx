"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { BarChart3, AlertTriangle, CheckCircle2, Clock, Circle } from "lucide-react";

export default function WorkloadPage() {
  const { workspaceId } = useAuthStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string>("all");

  const { data: teams } = trpc.team.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  // Get workload for all teams
  const teamIds = useMemo(() => teams?.map((t: any) => t.id) || [], [teams]);

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Workload" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Workload</h1>
            <p className="text-sm text-muted-foreground mt-1">See how work is distributed across team members</p>
          </div>
          <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {teams?.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 mb-6 text-xs">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500" /> Completed</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-blue-500" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-300 dark:bg-slate-600" /> Todo</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500" /> Overdue</span>
        </div>

        {!teams?.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Create teams first to view workload</p>
          </div>
        ) : (
          <div className="space-y-6">
            {teams
              .filter((t: any) => selectedTeamId === "all" || t.id === selectedTeamId)
              .map((team: any) => (
                <TeamWorkloadCard key={team.id} teamId={team.id} teamName={team.name} teamColor={team.color} />
              ))}
          </div>
        )}
      </div>
    </>
  );
}

function TeamWorkloadCard({ teamId, teamName, teamColor }: { teamId: string; teamName: string; teamColor?: string }) {
  const { data: workload, isLoading } = trpc.team.getWorkload.useQuery({ teamId });

  if (isLoading) return <Skeleton className="h-48 rounded-xl" />;
  if (!workload?.length) return null;

  const maxTasks = Math.max(...workload.map((w: any) => w.total), 1);
  const CAPACITY = 15; // tasks per person threshold

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded" style={{ backgroundColor: teamColor || "#3b82f6" }} />
          <CardTitle className="text-base">{teamName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {workload.map((w: any) => {
          const isOverloaded = w.total > CAPACITY;
          return (
            <div key={w.user.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{w.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{w.user.name}</span>
                  {isOverloaded && (
                    <Badge variant="outline" className="text-[10px] text-red-500 border-red-500/30 gap-0.5 px-1">
                      <AlertTriangle className="h-2.5 w-2.5" /> overloaded
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-0.5"><CheckCircle2 className="h-3 w-3 text-green-500" /> {w.completed}</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-3 w-3 text-blue-500" /> {w.inProgress}</span>
                  <span className="flex items-center gap-0.5"><Circle className="h-3 w-3 text-slate-400" /> {w.todo}</span>
                  {w.overdue > 0 && <span className="flex items-center gap-0.5 text-red-500"><AlertTriangle className="h-3 w-3" /> {w.overdue}</span>}
                </div>
              </div>
              <div className="flex h-6 rounded-md overflow-hidden bg-muted relative">
                {w.total > 0 && (
                  <>
                    {w.completed > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(w.completed / maxTasks) * 100}%` }} />}
                    {w.inProgress > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(w.inProgress / maxTasks) * 100}%` }} />}
                    {w.todo > 0 && <div className="bg-slate-300 dark:bg-slate-600 transition-all" style={{ width: `${(w.todo / maxTasks) * 100}%` }} />}
                    {w.overdue > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(w.overdue / maxTasks) * 100}%` }} />}
                  </>
                )}
                {/* Capacity line */}
                <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-amber-500/60" style={{ left: `${Math.min((CAPACITY / maxTasks) * 100, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
