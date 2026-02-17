"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import {
  Milestone, ChevronDown, ChevronRight, Calendar,
  Layers, AlertTriangle, CheckCircle2, Clock, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  todo: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  done: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUS_DOT: Record<string, string> = {
  backlog: "bg-slate-500",
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_review: "bg-purple-500",
  done: "bg-emerald-500",
  cancelled: "bg-gray-500",
};

function progressColor(p: number) {
  if (p >= 70) return "bg-emerald-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function EpicsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { workspaceId } = useAuthStore();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("created");

  const { data: project } = trpc.project.getById.useQuery({ id: projectId }, { enabled: !!projectId });

  const { data: taskData, isLoading } = trpc.task.list.useQuery(
    { projectId, limit: 200 },
    { enabled: !!projectId }
  );

  const tasks = taskData?.tasks || [];

  const { epics, stats } = useMemo(() => {
    const epicTasks = tasks.filter((t: any) => t.type === "epic");
    const allTasks = tasks;

    const enriched = epicTasks.map((epic: any) => {
      const children = allTasks.filter((t: any) => t.parentId === epic.id);
      const totalChildren = children.length;
      const completedChildren = children.filter((t: any) => t.status === "done").length;
      const progress = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
      const totalPoints = children.reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);
      const completedPoints = children.filter((t: any) => t.status === "done")
        .reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);
      const overdueChildren = children.filter(
        (t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done"
      ).length;

      return {
        ...epic, children, totalChildren, completedChildren,
        progress, totalPoints, completedPoints, overdueChildren,
      };
    });

    let filtered = enriched;
    if (filterStatus !== "all") filtered = enriched.filter((e: any) => e.status === filterStatus);

    if (sortBy === "due") filtered.sort((a: any, b: any) => (a.dueDate || "9").localeCompare(b.dueDate || "9"));
    else if (sortBy === "progress") filtered.sort((a: any, b: any) => b.progress - a.progress);
    else filtered.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = enriched.length;
    const inProgress = enriched.filter((e: any) => e.status === "in_progress").length;
    const completed = enriched.filter((e: any) => e.status === "done").length;
    const atRisk = enriched.filter((e: any) => e.overdueChildren > 0).length;

    return { epics: filtered, stats: { total, inProgress, completed, atRisk } };
  }, [tasks, filterStatus, sortBy]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const statCards = [
    {
      label: "Total Epics",
      value: stats.total,
      icon: Layers,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10",
    },
    {
      label: "In Progress",
      value: stats.inProgress,
      icon: Clock,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      label: "Completed",
      value: stats.completed,
      icon: CheckCircle2,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "At Risk",
      value: stats.atRisk,
      icon: AlertTriangle,
      iconColor: "text-red-400",
      iconBg: "bg-red-500/10",
    },
  ];

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "DKFlow", href: "/home" },
          { label: project?.name || "Project", href: `/${workspaceSlug}/projects/${projectId}/board` },
          { label: "Epics" },
        ]}
        showViewSwitcher
        currentView="epics"
        onViewChange={handleViewChange}
        projectId={projectId}
      />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
              <Milestone className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold leading-tight">Epics</h2>
              <p className="text-xs text-muted-foreground">Track large features and initiatives</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="backlog">Backlog</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created">Newest</SelectItem>
                <SelectItem value="due">Due Date</SelectItem>
                <SelectItem value="progress">Progress</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-5 w-5 ${s.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
                    <p className="text-2xl font-bold leading-tight">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Epic List */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : !epics.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Milestone className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No epics found</p>
            <p className="text-sm mt-1">Create tasks with type &quot;epic&quot; to track large features</p>
          </div>
        ) : (
          <div className="space-y-3">
            {epics.map((epic: any) => (
              <Card key={epic.id} className="border-border/50 hover:border-border transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleExpand(epic.id)}
                      className="mt-0.5 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {expanded.has(epic.id)
                        ? <ChevronDown className="h-4 w-4" />
                        : <ChevronRight className="h-4 w-4" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      {/* Epic title row */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <Milestone className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0" />
                        <h3 className="text-sm font-medium truncate">{epic.title}</h3>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[epic.status] || ""}`}>
                          {(epic.status || "todo").replace(/_/g, " ")}
                        </Badge>
                        {epic.overdueChildren > 0 && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] gap-1">
                            <AlertTriangle className="h-2.5 w-2.5" />
                            {epic.overdueChildren} overdue
                          </Badge>
                        )}
                      </div>

                      {/* Description */}
                      {epic.description && (
                        <p className="text-xs text-muted-foreground mb-2.5 line-clamp-1">{epic.description}</p>
                      )}

                      {/* Progress bar */}
                      <div className="flex items-center gap-3 mb-1">
                        <div className="flex-1 max-w-xs h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${progressColor(epic.progress)}`}
                            style={{ width: `${epic.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums w-8">{epic.progress}%</span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          {epic.completedChildren}/{epic.totalChildren} tasks
                        </span>
                        {epic.totalPoints > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {epic.completedPoints}/{epic.totalPoints} pts
                          </span>
                        )}
                        {epic.assignees?.[0]?.user && (
                          <Avatar className="h-5 w-5">
                            {epic.assignees[0].user.avatarUrl && (
                              <AvatarImage src={epic.assignees[0].user.avatarUrl} />
                            )}
                            <AvatarFallback className="text-[8px] bg-muted">
                              {epic.assignees[0].user.name?.[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {epic.dueDate && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(epic.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="text-muted-foreground/50 font-mono ml-auto">
                          #{epic.taskNumber}
                        </span>
                      </div>

                      {/* Expanded children */}
                      {expanded.has(epic.id) && epic.children?.length > 0 && (
                        <div className="mt-3 space-y-0.5 pl-3 border-l-2 border-indigo-500/20">
                          {epic.children.map((child: any) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-2.5 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors text-xs"
                            >
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${STATUS_DOT[child.status] || "bg-slate-500"}`} />
                              <span className="flex-1 min-w-0 truncate">{child.title}</span>
                              <PriorityBadge priority={child.priority || "none"} />
                              <Badge variant="outline" className="text-[10px] h-4 capitalize">
                                {child.type}
                              </Badge>
                              {child.storyPoints > 0 && (
                                <span className="text-muted-foreground tabular-nums">{child.storyPoints} pts</span>
                              )}
                              <span className="text-muted-foreground/50 font-mono">#{child.taskNumber}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {expanded.has(epic.id) && epic.children?.length === 0 && (
                        <p className="mt-3 text-xs text-muted-foreground/50 pl-3 border-l-2 border-border py-2">
                          No child tasks yet
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
