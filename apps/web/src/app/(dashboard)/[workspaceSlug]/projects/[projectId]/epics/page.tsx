"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Milestone, ChevronDown, ChevronRight, Plus, Calendar, Layers } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  todo: "bg-slate-500/10 text-slate-300 border-slate-500/20",
  in_progress: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  in_review: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  done: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function progressColor(p: number) {
  if (p > 70) return "bg-green-500";
  if (p >= 40) return "bg-yellow-500";
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
    { projectId, limit: 100 },
    { enabled: !!projectId }
  );

  const tasks = taskData?.tasks || [];

  // Get epics and their children
  const { epics, stats } = useMemo(() => {
    const epicTasks = tasks.filter((t: any) => t.type === "epic");
    const allTasks = tasks;

    const enriched = epicTasks.map((epic: any) => {
      const children = allTasks.filter((t: any) => t.parentId === epic.id);
      const totalChildren = children.length;
      const completedChildren = children.filter((t: any) => t.status === "done").length;
      const progress = totalChildren > 0 ? Math.round((completedChildren / totalChildren) * 100) : 0;
      const totalPoints = children.reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);
      const completedPoints = children.filter((t: any) => t.status === "done").reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);
      const overdueChildren = children.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done").length;

      return { ...epic, children, totalChildren, completedChildren, progress, totalPoints, completedPoints, overdueChildren };
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Milestone className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold">Epics</h2>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
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
          <Card className="bg-slate-900/50 border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Epics</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-blue-400">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-green-400">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">At Risk</p>
              <p className="text-2xl font-bold text-red-400">{stats.atRisk}</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
          </div>
        ) : !epics.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Milestone className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No epics found</p>
            <p className="text-sm">Create tasks with type "epic" to track large features</p>
          </div>
        ) : (
          <div className="space-y-3">
            {epics.map((epic: any) => (
              <Card key={epic.id} className="border-border/50 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleExpand(epic.id)} className="mt-1 text-muted-foreground hover:text-foreground">
                      {expanded.has(epic.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-medium">{epic.title}</h3>
                        <Badge variant="outline" className={STATUS_COLORS[epic.status] || ""}>
                          {epic.status?.replace("_", " ")}
                        </Badge>
                        {epic.overdueChildren > 0 && (
                          <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px]">
                            {epic.overdueChildren} overdue
                          </Badge>
                        )}
                      </div>
                      {epic.description && (
                        <p className="text-xs text-muted-foreground mb-2 line-clamp-1">{epic.description}</p>
                      )}
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1 max-w-xs">
                          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${progressColor(epic.progress)}`}
                              style={{ width: `${epic.progress}%` }}
                            />
                          </div>
                        </div>
                        <span className="text-xs tabular-nums">{epic.progress}%</span>
                        <span className="text-xs text-muted-foreground">
                          {epic.completedChildren}/{epic.totalChildren} tasks
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {epic.completedPoints}/{epic.totalPoints} pts
                        </span>
                        {epic.assignees?.[0]?.user && (
                          <Avatar className="h-5 w-5">
                            {epic.assignees[0].user.avatarUrl && <AvatarImage src={epic.assignees[0].user.avatarUrl} />}
                            <AvatarFallback className="text-[8px]">{epic.assignees[0].user.name?.[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        {epic.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(epic.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                      </div>

                      {expanded.has(epic.id) && epic.children?.length > 0 && (
                        <div className="mt-3 space-y-1 pl-2 border-l-2 border-indigo-500/30">
                          {epic.children.map((child: any) => (
                            <div
                              key={child.id}
                              className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-slate-800/50 cursor-pointer text-xs"
                            >
                              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                                child.status === "done" ? "bg-green-500" :
                                child.status === "in_progress" ? "bg-blue-500" :
                                "bg-slate-500"
                              }`} />
                              <span className="flex-1 truncate">{child.title}</span>
                              <Badge variant="outline" className="text-[10px] h-4">{child.type}</Badge>
                              {child.storyPoints && (
                                <span className="text-muted-foreground">{child.storyPoints}pts</span>
                              )}
                              <span className="text-muted-foreground">#{child.taskNumber}</span>
                            </div>
                          ))}
                        </div>
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
