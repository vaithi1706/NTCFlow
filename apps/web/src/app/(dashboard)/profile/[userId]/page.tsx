"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { formatDistanceToNow, format } from "date-fns";
import { Mail, FolderOpen, CheckCircle2, AlertTriangle, ListTodo } from "lucide-react";
import Link from "next/link";

type DateRange = "last_7_days" | "last_30_days" | "last_90_days";
const RANGE_LABELS: Record<DateRange, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
};

export default function UserProfilePage() {
  const { userId } = useParams() as { userId: string };
  const { workspaceId } = useAuthStore();
  const [dateRange, setDateRange] = useState<DateRange>("last_30_days");

  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const member = members?.find((m: any) => (m.user?.id || m.userId) === userId);
  const userData = (member as any)?.user || member;
  const name = (userData as any)?.name || "Unknown User";
  const email = (userData as any)?.email || "";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase();

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, { enabled: !!workspaceId });
  const currentWorkspace = workspaces?.find((w: any) => w.id === workspaceId);
  const wsSlug = currentWorkspace?.slug || "workspace";

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );
  const userProjects = projects?.filter((p: any) =>
    p.members?.some((m: any) => m.userId === userId)
  ) || [];

  // Activity drill-down (open / completed / overdue tasks in date range).
  // The API rejects this unless caller is the user themselves OR has canViewReports.
  const { data: activity, isLoading: activityLoading, error: activityError } = trpc.stats.memberActivity.useQuery(
    { workspaceId: workspaceId!, userId, dateRange },
    { enabled: !!workspaceId && !!userId }
  );

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Team", href: "/members" }, { label: name }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold">{name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{email}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {member?.role && (
                    <Badge variant="outline" className="capitalize">{member.role}</Badge>
                  )}
                  {member?.joinedAt && (
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity — date-range selector */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Activity</h2>
          <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <TabsList>
              <TabsTrigger value="last_7_days">7 days</TabsTrigger>
              <TabsTrigger value="last_30_days">30 days</TabsTrigger>
              <TabsTrigger value="last_90_days">90 days</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* If caller isn't allowed, the activity query returns FORBIDDEN; tell them why. */}
        {activityError && (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              You don't have permission to view {name}'s activity.
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        {!activityError && (
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Open" value={activity?.counts.open ?? "—"} icon={ListTodo} color="text-blue-500" />
            <StatCard label={`Completed (${RANGE_LABELS[dateRange]})`} value={activity?.counts.completed ?? "—"} icon={CheckCircle2} color="text-emerald-500" />
            <StatCard label="Overdue" value={activity?.counts.overdue ?? "—"} icon={AlertTriangle} color={(activity?.counts.overdue ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"} />
          </div>
        )}

        {!activityError && (
          <>
            <TaskTable
              title="Currently overdue"
              icon={AlertTriangle}
              iconColor="text-red-500"
              tasks={activity?.overdueTasks}
              loading={activityLoading}
              wsSlug={wsSlug}
              dateColumn="dueDate"
              dateColumnLabel="Due"
              emptyText="Nothing overdue — good."
            />
            <TaskTable
              title="Open"
              icon={ListTodo}
              iconColor="text-blue-500"
              tasks={activity?.openTasks}
              loading={activityLoading}
              wsSlug={wsSlug}
              dateColumn="dueDate"
              dateColumnLabel="Due"
              emptyText="No open tasks assigned."
            />
            <TaskTable
              title={`Completed in ${RANGE_LABELS[dateRange]}`}
              icon={CheckCircle2}
              iconColor="text-emerald-500"
              tasks={activity?.completedTasks}
              loading={activityLoading}
              wsSlug={wsSlug}
              dateColumn="completedAt"
              dateColumnLabel="Completed"
              emptyText="No tasks completed in this window."
            />
          </>
        )}

        {/* Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Projects</CardTitle>
            </div>
            <CardDescription>Projects this member is part of</CardDescription>
          </CardHeader>
          <CardContent>
            {!projects ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : userProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Not a member of any projects yet</p>
            ) : (
              <div className="space-y-2">
                {userProjects.map((project: any) => (
                  <Link
                    key={project.id}
                    href={`/${wsSlug}/projects/${project.id}/board`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#94A3B8" }} />
                    <span className="text-sm font-medium flex-1">{project.name}</span>
                    {project._count?.tasks != null && (
                      <span className="text-xs text-muted-foreground">{project._count.tasks} tasks</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function TaskTable({
  title, icon: Icon, iconColor, tasks, loading, wsSlug, dateColumn, dateColumnLabel, emptyText,
}: {
  title: string;
  icon: any;
  iconColor: string;
  tasks?: Array<any>;
  loading: boolean;
  wsSlug: string;
  dateColumn: "dueDate" | "completedAt";
  dateColumnLabel: string;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <CardTitle className="text-base">{title}</CardTitle>
          {tasks && <Badge variant="secondary" className="ml-1">{tasks.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : !tasks || tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{emptyText}</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left p-2 font-medium">Task</th>
                  <th className="text-left p-2 font-medium">Project</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-left p-2 font-medium">Priority</th>
                  <th className="text-left p-2 font-medium">{dateColumnLabel}</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t: any) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-2">
                      <Link href={`/${wsSlug}/projects/${t.project.id}/board?task=${t.id}`} className="hover:underline">
                        <span className="text-muted-foreground mr-2">#{t.taskNumber}</span>
                        <span className="text-foreground">{t.title}</span>
                      </Link>
                    </td>
                    <td className="p-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.project.color || "#94A3B8" }} />
                        {t.project.name}
                      </span>
                    </td>
                    <td className="p-2 capitalize text-muted-foreground">{t.status?.replace(/_/g, " ")}</td>
                    <td className="p-2 capitalize text-muted-foreground">{t.priority}</td>
                    <td className="p-2 text-muted-foreground">
                      {t[dateColumn] ? format(new Date(t[dateColumn]), "MMM d, yyyy") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
