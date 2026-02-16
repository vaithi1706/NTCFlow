"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { BarChart3, AlertTriangle, Users, TrendingUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6",
  "#f97316", "#84cc16", "#a855f7", "#3b82f6",
];

export default function WorkloadPage() {
  const { workspaceId } = useAuthStore();
  const [sortBy, setSortBy] = useState<string>("most");
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) + weekOffset * 7;
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [weekOffset]);

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const { data, isLoading } = trpc.workload.getCapacity.useQuery(
    {
      workspaceId: workspaceId || "",
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
    },
    { enabled: !!workspaceId }
  );

  const sortedMembers = useMemo(() => {
    if (!data?.members) return [];
    const m = [...data.members];
    if (sortBy === "most") m.sort((a, b) => b.utilization - a.utilization);
    else if (sortBy === "least") m.sort((a, b) => a.utilization - b.utilization);
    else m.sort((a, b) => (a.user.name || "").localeCompare(b.user.name || ""));
    return m;
  }, [data?.members, sortBy]);

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Workload" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-400" /> Workload
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Team capacity and work distribution</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[180px] text-center">{weekLabel}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {weekOffset !== 0 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => setWeekOffset(0)}>Today</Button>
            )}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="most">Most Loaded</SelectItem>
                <SelectItem value="least">Least Loaded</SelectItem>
                <SelectItem value="alpha">A → Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Card className="bg-slate-900/50 border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Team Capacity</p>
                <p className="text-2xl font-bold">{data.summary.totalCapacity}h</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">{data.summary.utilizationPercent}%</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-red-400" /> Overloaded
                </p>
                <p className="text-2xl font-bold text-red-400">{data.summary.overloaded}</p>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Underloaded</p>
                <p className="text-2xl font-bold text-green-400">{data.summary.underloaded}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        ) : !sortedMembers.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No team members</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMembers.map((member: any, idx: number) => {
              const overloaded = member.utilization > 100;
              const maxBarPct = Math.min(member.utilization, 150);
              return (
                <div key={member.userId} className="bg-slate-900/50 border border-border/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {member.user.avatarUrl && <AvatarImage src={member.user.avatarUrl} />}
                      <AvatarFallback className="text-xs bg-indigo-500/20 text-indigo-400">
                        {member.user.name?.[0] || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="w-32 flex-shrink-0">
                      <p className="text-sm font-medium truncate">{member.user.name || member.user.email}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {member.activeTasks} tasks · {member.totalStoryPoints} pts
                      </p>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 bg-slate-800 rounded-full overflow-hidden relative">
                        {member.byProject.map((proj: any, pi: number) => {
                          const pctWidth = member.capacityHoursPerWeek > 0
                            ? (proj.hours / member.capacityHoursPerWeek) * 100
                            : 0;
                          const prevWidth = member.byProject
                            .slice(0, pi)
                            .reduce((s: number, p: any) => s + (member.capacityHoursPerWeek > 0 ? (p.hours / member.capacityHoursPerWeek) * 100 : 0), 0);
                          return (
                            <div
                              key={proj.projectId}
                              className="absolute top-0 h-full rounded-sm"
                              style={{
                                left: `${Math.min(prevWidth, 100)}%`,
                                width: `${Math.min(pctWidth, 100 - Math.min(prevWidth, 100))}%`,
                                backgroundColor: proj.color || PROJECT_COLORS[pi % PROJECT_COLORS.length],
                                opacity: 0.8,
                              }}
                              title={`${proj.projectName}: ${proj.hours}h`}
                            />
                          );
                        })}
                        {overloaded && (
                          <div
                            className="absolute top-0 h-full bg-red-500/60 rounded-r-full"
                            style={{ left: "100%", width: `${Math.min(member.utilization - 100, 50)}%` }}
                          />
                        )}
                        {/* 100% capacity line */}
                        <div className="absolute top-0 right-0 h-full w-px bg-slate-500/50" style={{ left: "100%" }} />
                      </div>
                    </div>
                    <div className="w-20 text-right flex-shrink-0">
                      <span className={`text-sm font-bold tabular-nums ${overloaded ? "text-red-400" : "text-green-400"}`}>
                        {member.totalEstimateHours}/{member.capacityHoursPerWeek}h
                      </span>
                      <p className={`text-[10px] ${overloaded ? "text-red-400" : "text-muted-foreground"}`}>
                        {member.utilization}%
                      </p>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground flex-shrink-0 w-36">
                      <span>Due: {member.dueThisWeek}</span>
                      <span>Next: {member.dueNextWeek}</span>
                      {member.overdue > 0 && (
                        <span className="text-red-400">⚠ {member.overdue}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {sortedMembers.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
            {Array.from(new Set(sortedMembers.flatMap((m: any) => m.byProject.map((p: any) => JSON.stringify({ name: p.projectName, color: p.color })))))
              .slice(0, 8)
              .map((json: string, i: number) => {
                const p = JSON.parse(json);
                return (
                  <span key={i} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded" style={{ backgroundColor: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length] }} />
                    {p.name}
                  </span>
                );
              })}
          </div>
        )}
      </div>
    </>
  );
}
