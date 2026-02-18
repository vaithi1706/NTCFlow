"use client";

import { TopBar } from "@/components/layout/topbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { DueDate } from "@/components/shared/due-date";
import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Circle, Clock, AlertTriangle, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

export default function MyWorkPage() {
  const router = useRouter();
  const { user, workspaceId } = useAuthStore();

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, { enabled: !!workspaceId });
  const wsSlug = workspaces?.find((w: any) => w.id === workspaceId)?.slug || "workspace";

  // Fetch all projects first
  const { data: projects, isLoading: projectsLoading } = trpc.project.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  // We'll fetch tasks from all projects
  const projectIds = projects?.map((p: any) => p.id) || [];

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "My Work" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <h1 className="text-xl font-semibold mb-6">My Work</h1>

        <Tabs defaultValue="assigned" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="assigned">Assigned to Me</TabsTrigger>
            <TabsTrigger value="all">All Tasks</TabsTrigger>
          </TabsList>

          <TabsContent value="assigned">
            {projectsLoading ? (
              <TaskListSkeleton />
            ) : !projects || projects.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No projects yet"
                description="Create a project to start managing tasks."
              />
            ) : (
              <ProjectTasksList projects={projects} userId={user?.id} router={router} wsSlug={wsSlug} />
            )}
          </TabsContent>

          <TabsContent value="all">
            {projectsLoading ? (
              <TaskListSkeleton />
            ) : !projects || projects.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No projects yet"
                description="Create a project to start managing tasks."
              />
            ) : (
              <ProjectTasksList projects={projects} router={router} wsSlug={wsSlug} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function ProjectTasksList({ projects, userId, router, wsSlug }: { projects: any[]; userId?: string; router: any; wsSlug: string }) {
  return (
    <div className="space-y-6">
      {projects.map((project: any) => (
        <ProjectTasks key={project.id} project={project} userId={userId} router={router} wsSlug={wsSlug} />
      ))}
    </div>
  );
}

function ProjectTasks({ project, userId, router, wsSlug }: { project: any; userId?: string; router: any; wsSlug: string }) {
  const { data: columns, isLoading } = trpc.board.getColumns.useQuery(
    { projectId: project.id },
    { enabled: !!project.id }
  );

  if (isLoading) return <TaskListSkeleton />;

  // Flatten all tasks from columns
  const allTasks = (columns || []).flatMap((col: any) =>
    (col.tasks || []).map((task: any) => ({ ...task, columnName: col.name, columnColor: col.color }))
  );

  // Filter by assignee if userId provided
  const tasks = userId
    ? allTasks.filter((t: any) => t.assignees?.some((a: any) => a.userId === userId || a.user?.id === userId) || t.createdById === userId)
    : allTasks;

  if (tasks.length === 0) return null;

  // Group by status
  const isDone = (t: any) => t.status === "done" || t.status === "cancelled";
  const overdue = tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && !isDone(t));
  const today = tasks.filter((t: any) => {
    if (!t.dueDate || isDone(t)) return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    return due.toDateString() === now.toDateString();
  });
  const upcoming = tasks.filter((t: any) => {
    if (!t.dueDate || isDone(t)) return false;
    const due = new Date(t.dueDate);
    const now = new Date();
    return due > now && due.toDateString() !== now.toDateString();
  });
  const noDue = tasks.filter((t: any) => !t.dueDate && !isDone(t));
  const completed = tasks.filter((t: any) => isDone(t));

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color || "#3b82f6" }} />
        <h2 className="font-medium text-sm text-muted-foreground">{project.name}</h2>
        <span className="text-xs text-muted-foreground">({tasks.length} tasks)</span>
      </div>

      {overdue.length > 0 && (
        <TaskGroup title="Overdue" icon={<AlertTriangle className="w-4 h-4 text-red-400" />} tasks={overdue} project={project} router={router} wsSlug={wsSlug} />
      )}
      {today.length > 0 && (
        <TaskGroup title="Today" icon={<Clock className="w-4 h-4 text-amber-400" />} tasks={today} project={project} router={router} wsSlug={wsSlug} />
      )}
      {upcoming.length > 0 && (
        <TaskGroup title="Upcoming" icon={<Circle className="w-4 h-4 text-blue-400" />} tasks={upcoming} project={project} router={router} wsSlug={wsSlug} />
      )}
      {noDue.length > 0 && (
        <TaskGroup title="No due date" icon={<Circle className="w-4 h-4 text-muted-foreground" />} tasks={noDue} project={project} router={router} wsSlug={wsSlug} />
      )}
      {completed.length > 0 && (
        <TaskGroup title="Completed" icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />} tasks={completed} project={project} router={router} wsSlug={wsSlug} />
      )}
    </div>
  );
}

function TaskGroup({ title, icon, tasks, project, router, wsSlug }: { title: string; icon: React.ReactNode; tasks: any[]; project: any; router: any; wsSlug: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2 pl-4">
        {icon}
        <span className="text-xs font-medium text-muted-foreground uppercase">{title} ({tasks.length})</span>
      </div>
      <div className="space-y-1">
        {tasks.map((task: any) => (
          <div
            key={task.id}
            onClick={() => router.push(`/${wsSlug}/projects/${project.id}/board`)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs text-muted-foreground font-mono shrink-0">
                {task.taskNumber ? `DK-${task.taskNumber}` : ""}
              </span>
              <span className="text-sm text-foreground truncate">{task.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {task.priority && task.priority !== "None" && (
                <PriorityBadge priority={task.priority} />
              )}
              <Badge variant="outline" className="text-xs" style={{ borderColor: task.columnColor }}>
                {task.columnName}
              </Badge>
              {task.dueDate && <DueDate date={task.dueDate} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
