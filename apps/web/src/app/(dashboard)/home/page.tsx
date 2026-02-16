"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { DueDate } from "@/components/shared/due-date";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectCardSkeleton, TaskListSkeleton } from "@/components/shared/loading-skeleton";
import { KeyboardShortcutsDialog } from "@/components/shared/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { useUIStore } from "@/stores/ui-store";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import {
  FolderKanban, CheckCircle2, Inbox, Star, Activity,
  Plus, Users, BarChart3, ListTodo, TrendingUp,
  AlertTriangle, Zap, PencilLine, MessageCircle, Trash2,
  ArrowUpRight, Clock, ChevronRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getStarredProjects(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("dkflow-starred-projects") || "[]"); } catch { return []; }
}
function setStarredProjectsStorage(ids: string[]) {
  localStorage.setItem("dkflow-starred-projects", JSON.stringify(ids));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const actionIconMap: Record<string, { icon: typeof Plus; color: string; bg: string }> = {
  created: { icon: Plus, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  updated: { icon: PencilLine, color: "text-blue-400", bg: "bg-blue-500/10" },
  commented: { icon: MessageCircle, color: "text-purple-400", bg: "bg-purple-500/10" },
  deleted: { icon: Trash2, color: "text-red-400", bg: "bg-red-500/10" },
};

function getActionStyle(action: string) {
  return actionIconMap[action] || actionIconMap["updated"]!;
}

export default function HomePage() {
  const { user, workspaceId } = useAuthStore();
  const { setCommandPaletteOpen } = useUIStore();
  const router = useRouter();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [starred, setStarred] = useState<string[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => { setStarred(getStarredProjects()); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const toggleStar = useCallback((projectId: string) => {
    setStarred((prev) => {
      const next = prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId];
      setStarredProjectsStorage(next);
      return next;
    });
  }, []);

  useKeyboardShortcuts({
    onShowHelp: () => setShortcutsOpen(true),
    onFocusSearch: () => setCommandPaletteOpen(true),
  });

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, { enabled: !!workspaceId });
  const currentWorkspace = workspaces?.find((w: any) => w.id === workspaceId);
  const wsSlug = currentWorkspace?.slug || "workspace";

  const { data: projects, isLoading: loadingProjects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  // Workspace stats
  const { data: stats } = trpc.stats.workspaceOverview.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  // Activity feed
  const { data: activityData } = trpc.activity.getWorkspaceActivity.useQuery(
    { workspaceId: workspaceId!, limit: 20 },
    { enabled: !!workspaceId }
  );

  // Fetch tasks via search to find user's assigned tasks
  const firstProjectId = projects?.[0]?.id;
  const { data: myTasksRaw } = trpc.task.list.useQuery(
    { projectId: firstProjectId!, assigneeId: user?.id, limit: 50 },
    { enabled: !!firstProjectId && !!user?.id }
  );

  const secondProjectId = projects?.[1]?.id;
  const { data: myTasksRaw2 } = trpc.task.list.useQuery(
    { projectId: secondProjectId!, assigneeId: user?.id, limit: 50 },
    { enabled: !!secondProjectId && !!user?.id }
  );

  const thirdProjectId = projects?.[2]?.id;
  const { data: myTasksRaw3 } = trpc.task.list.useQuery(
    { projectId: thirdProjectId!, assigneeId: user?.id, limit: 50 },
    { enabled: !!thirdProjectId && !!user?.id }
  );

  const extractTasks = (data: any) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.tasks && Array.isArray(data.tasks)) return data.tasks;
    return [];
  };

  const myTasks = [
    ...extractTasks(myTasksRaw),
    ...extractTasks(myTasksRaw2),
    ...extractTasks(myTasksRaw3),
  ];

  const activities = activityData?.activities || [];

  // Group activities by day
  const groupedActivities = useMemo(() => {
    const groups: { label: string; items: any[] }[] = [];
    const todayItems: any[] = [];
    const yesterdayItems: any[] = [];
    const earlierItems: any[] = [];

    for (const a of activities.slice(0, 10)) {
      const d = new Date(a.createdAt);
      if (isToday(d)) todayItems.push(a);
      else if (isYesterday(d)) yesterdayItems.push(a);
      else earlierItems.push(a);
    }

    if (todayItems.length) groups.push({ label: "Today", items: todayItems });
    if (yesterdayItems.length) groups.push({ label: "Yesterday", items: yesterdayItems });
    if (earlierItems.length) groups.push({ label: "Earlier", items: earlierItems });
    return groups;
  }, [activities]);

  // Sort projects: starred first
  const sortedProjects = projects
    ? [...projects].sort((a, b) => {
        const aS = starred.includes(a.id) ? 0 : 1;
        const bS = starred.includes(b.id) ? 0 : 1;
        return aS - bS;
      })
    : [];

  const quickActions = [
    { label: "Create Task", icon: Plus, desc: "Add a new task", onClick: () => setCommandPaletteOpen(true) },
    { label: "Create Project", icon: FolderKanban, desc: "Start a new project", onClick: () => setCommandPaletteOpen(true) },
    { label: "Invite Member", icon: Users, desc: "Grow your team", onClick: () => router.push(`/${wsSlug}/settings/members`) },
    { label: "View Reports", icon: BarChart3, desc: "Check analytics", onClick: () => {} },
  ];

  const statCards = [
    { label: "Total Tasks", value: stats?.totalTasks ?? "—", icon: ListTodo, color: "from-blue-500/20 to-blue-600/5", iconColor: "text-blue-400" },
    { label: "Completed This Week", value: stats?.completedThisWeek ?? "—", icon: CheckCircle2, color: "from-emerald-500/20 to-emerald-600/5", iconColor: "text-emerald-400" },
    { label: "Overdue Tasks", value: stats?.overdueTasks ?? "—", icon: AlertTriangle, color: (stats?.overdueTasks ?? 0) > 0 ? "from-red-500/20 to-red-600/5" : "from-orange-500/20 to-orange-600/5", iconColor: (stats?.overdueTasks ?? 0) > 0 ? "text-red-400" : "text-orange-400", accent: (stats?.overdueTasks ?? 0) > 0 },
    { label: "Active Sprints", value: stats?.activeSprints ?? "—", icon: Zap, color: "from-violet-500/20 to-violet-600/5", iconColor: "text-violet-400" },
  ];

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Home" }]} />
      <div className="flex-1 overflow-y-auto">
        {/* Hero / Welcome */}
        <div className="relative overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-violet-500/[0.04]" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/[0.06] to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="relative px-6 py-8 md:py-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">
                  {format(now, "EEEE, MMMM d, yyyy")}
                </p>
                <h1 className="text-3xl font-bold tracking-tight">
                  {getGreeting()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
                </h1>
                <p className="text-muted-foreground mt-1.5 text-sm">
                  {stats ? (
                    <>
                      <span className="text-foreground font-medium">{stats.myTasks}</span> tasks assigned to you · <span className="text-foreground font-medium">{stats.completedToday}</span> completed today
                      {stats.overdueTasks > 0 && (
                        <> · <span className="text-red-400 font-medium">{stats.overdueTasks} overdue</span></>
                      )}
                    </>
                  ) : "Loading your workspace..."}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {format(now, "h:mm a")}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Stats Row */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <Card
                key={s.label}
                className={`relative overflow-hidden border-border/50 bg-gradient-to-br ${s.color} p-4 transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/5 group`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
                    <p className={`text-3xl font-bold mt-1.5 tracking-tight ${s.accent ? "text-red-400" : ""}`}>
                      {s.value}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg bg-background/50 ${s.iconColor} transition-transform duration-200 group-hover:scale-110`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                </div>
              </Card>
            ))}
          </section>

          {/* Quick Actions */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions.map((a) => (
                <button
                  key={a.label}
                  onClick={a.onClick}
                  className="group flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 text-left"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <a.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.label}</p>
                    <p className="text-xs text-muted-foreground">{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Recent Projects */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Projects</h2>
              {sortedProjects.length > 0 && (
                <Link href={`/${wsSlug}/projects`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </div>
            {loadingProjects ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
                <ProjectCardSkeleton />
              </div>
            ) : !sortedProjects || sortedProjects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No projects yet" description="Create your first project to get started" />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedProjects.slice(0, 6).map((project) => {
                  const taskCount = project._count.tasks || 0;
                  const projectColor = project.color || "#3B82F6";
                  return (
                    <Link key={project.id} href={`/${wsSlug}/projects/${project.id}/board`}>
                      <Card className="relative overflow-hidden hover:border-primary/30 transition-all duration-200 cursor-pointer group hover:shadow-lg hover:shadow-black/5">
                        {/* Left color accent */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200 group-hover:w-1.5" style={{ backgroundColor: projectColor }} />
                        {/* Subtle gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/[0.02] pointer-events-none" />
                        <div className="relative p-4 pl-5">
                          {/* Star button */}
                          <button
                            className="absolute top-3 right-3 z-10"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStar(project.id); }}
                          >
                            <Star className={`h-4 w-4 transition-all duration-200 ${starred.includes(project.id) ? "fill-yellow-500 text-yellow-500 scale-110" : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-yellow-500"}`} />
                          </button>
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm transition-transform duration-200 group-hover:scale-105"
                              style={{ backgroundColor: projectColor }}
                            >
                              {project.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                                {project.name}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {taskCount} tasks · {project._count.members} members
                              </p>
                            </div>
                          </div>
                          {project.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-3">{project.description}</p>
                          )}
                          {/* Progress bar placeholder - based on task count */}
                          <div className="mb-3">
                            <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  backgroundColor: projectColor,
                                  width: taskCount > 0 ? `${Math.min(100, Math.max(10, (taskCount % 7) * 15))}%` : "0%",
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex -space-x-2">
                              {[...Array(Math.min(3, project._count.members))].map((_, i) => (
                                <div key={i} className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                                  <span className="text-[8px] text-muted-foreground font-medium">{i + 1}</span>
                                </div>
                              ))}
                              {project._count.members > 3 && (
                                <div className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                                  <span className="text-[8px] text-muted-foreground font-medium">+{project._count.members - 3}</span>
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Two-column: Activity Feed + My Work */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Activity Feed */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Activity
                </h2>
                {activities.length > 0 && (
                  <Link href={`/${wsSlug}/activity`} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    View all <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {groupedActivities.length === 0 ? (
                <EmptyState icon={Activity} title="No recent activity" description="Activity across your projects will appear here" />
              ) : (
                <div className="space-y-5">
                  {groupedActivities.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{group.label}</p>
                      <div className="space-y-1.5">
                        {group.items.map((activity: any) => {
                          const style = getActionStyle(activity.action);
                          const IconComp = style.icon;
                          return (
                            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-card/50 hover:bg-card hover:border-border/60 transition-all duration-150 group/item">
                              <div className={`p-1.5 rounded-md ${style.bg} flex-shrink-0 mt-0.5`}>
                                <IconComp className={`h-3.5 w-3.5 ${style.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug">
                                  <span className="font-medium">{activity.user?.name || "Someone"}</span>{" "}
                                  <span className="text-muted-foreground">
                                    {activity.description || `${activity.action || "updated"} ${activity.entityType || "item"}`}
                                  </span>
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {activity.project && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{activity.project.name}</Badge>
                                  )}
                                  <span className="text-[11px] text-muted-foreground">
                                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* My Work */}
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">My Work</h2>
              <Tabs defaultValue="assigned">
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
                  <TabsTrigger value="recent">Recently Updated</TabsTrigger>
                </TabsList>
                <TabsContent value="assigned" className="mt-4">
                  {myTasks.length === 0 ? (
                    <EmptyState icon={Inbox} title="No tasks assigned" description="Tasks assigned to you will appear here" />
                  ) : (
                    <div className="space-y-1.5">
                      {myTasks.slice(0, 10).map((task: any) => (
                        <Link key={task.id} href={`/${wsSlug}/projects/${task.projectId}/board?task=${task.id}`}>
                          <Card className="p-3 flex items-center gap-3 hover:border-primary/30 hover:bg-card transition-all duration-150 cursor-pointer group/task border-border/30 bg-card/50">
                            <PriorityBadge priority={task.priority} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover/task:text-primary transition-colors">{task.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground font-mono">DK-{task.taskNumber}</span>
                                {task.status && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{task.status.replace("_", " ")}</Badge>
                                )}
                              </div>
                            </div>
                            {task.dueDate && <DueDate date={task.dueDate} />}
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/task:opacity-100 transition-opacity" />
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="recent" className="mt-4">
                  {myTasks.length === 0 ? (
                    <EmptyState icon={Clock} title="No recent tasks" description="Your recently updated tasks will appear here" />
                  ) : (
                    <div className="space-y-1.5">
                      {[...myTasks].sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 10).map((task: any) => (
                        <Link key={task.id} href={`/${wsSlug}/projects/${task.projectId}/board?task=${task.id}`}>
                          <Card className="p-3 flex items-center gap-3 hover:border-primary/30 hover:bg-card transition-all duration-150 cursor-pointer group/task border-border/30 bg-card/50">
                            <PriorityBadge priority={task.priority} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover/task:text-primary transition-colors">{task.title}</p>
                              <span className="text-[11px] text-muted-foreground">
                                Updated {formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}
                              </span>
                            </div>
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover/task:opacity-100 transition-opacity" />
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </section>
          </div>
        </div>
      </div>

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
