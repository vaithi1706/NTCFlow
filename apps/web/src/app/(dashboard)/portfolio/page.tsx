"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import {
  Briefcase, ListTodo, CheckCircle2, AlertTriangle, Search,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

function HealthDot({ health }: { health: string }) {
  const color =
    health === "on-track" ? "bg-emerald-500" :
    health === "at-risk" ? "bg-yellow-500" : "bg-red-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="bg-primary h-2 rounded-full transition-all"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default function PortfolioPage() {
  const { workspaceId } = useAuthStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = trpc.portfolio.getOverview.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const { data: healthData } = trpc.portfolio.getHealthMatrix.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const { data: timelineData } = trpc.portfolio.getTimeline.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const healthMap = useMemo(() => {
    const map: Record<string, string> = {};
    healthData?.forEach((h: any) => { map[h.id] = h.health; });
    return map;
  }, [healthData]);

  const filteredProjects = useMemo(() => {
    if (!data?.projects) return [];
    let projects = data.projects;
    if (search) {
      const s = search.toLowerCase();
      projects = projects.filter((p: any) => p.name.toLowerCase().includes(s));
    }
    if (statusFilter !== "all") {
      projects = projects.filter((p: any) => healthMap[p.id] === statusFilter);
    }
    return projects;
  }, [data?.projects, search, statusFilter, healthMap]);

  const timelineRange = useMemo(() => {
    if (!timelineData?.length) return null;
    const allDates = timelineData.flatMap((p: any) => [new Date(p.startDate), new Date(p.endDate)]);
    const min = Math.min(...allDates.map((d: Date) => d.getTime()));
    const max = Math.max(...allDates.map((d: Date) => d.getTime()));
    return { min, max, range: max - min || 1 };
  }, [timelineData]);

  if (isLoading) {
    return (
      <>
        <TopBar title="Portfolio" />
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </>
    );
  }

  const summary = data?.summary || { totalProjects: 0, totalTasks: 0, completionPercent: 0, overdueTasks: 0 };

  return (
    <>
      <TopBar title="Portfolio" />
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Projects", value: summary.totalProjects, icon: Briefcase, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Total Tasks", value: summary.totalTasks, icon: ListTodo, color: "text-indigo-500", bg: "bg-indigo-500/10" },
            { label: "Completion", value: `${summary.completionPercent}%`, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Overdue", value: summary.overdueTasks, icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
          ].map((card) => (
            <Card key={card.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${card.bg}`}><card.icon className={`h-5 w-5 ${card.color}`} /></div>
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold">{card.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {["all", "on-track", "at-risk", "off-track"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {s === "all" ? "All" : s.split("-").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}
              </button>
            ))}
          </div>
        </div>

        {/* Project Health Table */}
        <Card className="border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left p-4 font-medium">Project</th>
                    <th className="text-left p-4 font-medium">Lead</th>
                    <th className="text-center p-4 font-medium">Health</th>
                    <th className="text-left p-4 font-medium w-40">Progress</th>
                    <th className="text-center p-4 font-medium">Tasks</th>
                    <th className="text-center p-4 font-medium">Overdue</th>
                    <th className="text-left p-4 font-medium">Sprint</th>
                    <th className="text-left p-4 font-medium">Last Activity</th>
                    <th className="p-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.map((project: any) => (
                    <tr key={project.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded" style={{ backgroundColor: project.color || "#3b82f6" }} />
                          <span className="font-medium">{project.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground">{project.owner?.name || "—"}</td>
                      <td className="p-4 text-center">
                        <HealthDot health={healthMap[project.id] || "on-track"} />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={project.completionPercent} />
                          <span className="text-muted-foreground text-xs w-8">{project.completionPercent}%</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">{project.taskCount}</td>
                      <td className="p-4 text-center">
                        {project.overdueCount > 0 ? (
                          <Badge variant="destructive" className="text-xs">{project.overdueCount}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {project.activeSprint ? (
                          <span>{project.activeSprint.name} ({project.activeSprint.taskCount} tasks)</span>
                        ) : (
                          <span className="text-muted-foreground/60">No active sprint</span>
                        )}
                      </td>
                      <td className="p-4 text-muted-foreground text-xs">
                        {new Date(project.lastActivity).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <Link href={`/${project.slug || project.id}/projects/${project.id}/board`}>
                          <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {filteredProjects.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-muted-foreground">
                        {data?.projects?.length ? "No projects match your filters" : "No projects yet — create one from the sidebar"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Timeline */}
        {timelineData && timelineData.length > 0 && timelineRange && (
          <Card className="border-border">
            <CardContent className="p-4">
              <h3 className="font-semibold mb-4">Portfolio Timeline</h3>
              <div className="space-y-3">
                {timelineData.map((project: any) => {
                  const start = new Date(project.startDate).getTime();
                  const end = new Date(project.endDate).getTime();
                  const leftPct = ((start - timelineRange.min) / timelineRange.range) * 100;
                  const widthPct = Math.max(((end - start) / timelineRange.range) * 100, 2);
                  return (
                    <div key={project.id} className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground w-40 truncate">{project.name}</span>
                      <div className="flex-1 relative h-6 bg-muted rounded">
                        <div
                          className="absolute h-full rounded opacity-80"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: project.color || "#3b82f6",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-between text-xs text-muted-foreground pl-[calc(10rem+0.75rem)]">
                  <span>{new Date(timelineRange.min).toLocaleDateString()}</span>
                  <span>{new Date(timelineRange.max).toLocaleDateString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
