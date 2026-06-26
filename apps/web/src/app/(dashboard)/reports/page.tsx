"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, PieChart, TrendingUp, Users, Clock, AlertTriangle,
  Zap, Download, FileSpreadsheet, Target, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const REPORT_TYPES = [
  { value: "task_summary", label: "Task Summary", icon: BarChart3, description: "Overview of all tasks" },
  { value: "status_distribution", label: "Status Distribution", icon: PieChart, description: "Tasks by status" },
  { value: "priority_breakdown", label: "Priority Breakdown", icon: Target, description: "Tasks by priority" },
  { value: "completion_trend", label: "Completion Trend", icon: TrendingUp, description: "Created vs completed over time" },
  { value: "overdue_tasks", label: "Overdue Tasks", icon: AlertTriangle, description: "Tasks past their due date" },
  { value: "member_performance", label: "Member Performance", icon: Users, description: "Performance per team member" },
  { value: "team_workload", label: "Team Workload", icon: Zap, description: "Current workload distribution" },
  { value: "person_activity", label: "Person Activity", icon: Users, description: "Deep dive on one person -- their open / completed / overdue tasks + activity timeline" },
  { value: "sprint_velocity", label: "Sprint Velocity", icon: TrendingUp, description: "Points completed per sprint" },
  { value: "time_tracking", label: "Time Tracking", icon: Clock, description: "Hours logged by team" },
] as const;

const DATE_RANGES = [
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_90_days", label: "Last 90 Days" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_sprint", label: "This Sprint" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  backlog: "#6b7280", todo: "#3b82f6", in_progress: "#f59e0b",
  in_review: "#8b5cf6", done: "#22c55e", cancelled: "#ef4444",
};

const PRIORITY_COLORS: Record<string, string> = {
  none: "#6b7280", low: "#3b82f6", medium: "#f59e0b",
  high: "#f97316", urgent: "#ef4444",
};

function BarChartSimple({ data, labelKey, valueKey, colorMap }: { data: any[]; labelKey: string; valueKey: string; colorMap?: Record<string, string> }) {
  const max = Math.max(...data.map((d: any) => d[valueKey]), 1);
  return (
    <div className="space-y-3">
      {data.map((item: any, i: number) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground capitalize">{String(item[labelKey]).replace(/_/g, " ")}</span>
            <span className="font-medium text-foreground">{item[valueKey]}{item.percentage != null ? ` (${item.percentage}%)` : ""}</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${(item[valueKey] / max) * 100}%`, backgroundColor: colorMap?.[item[labelKey]] || "#3b82f6" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TrendChart({ data }: { data: { date: string; created: number; completed: number }[] }) {
  if (!data.length) return <p className="text-muted-foreground text-sm">No data available</p>;
  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.completed)), 1);
  const w = 600, h = 200, padding = 30;
  const chartW = w - padding * 2, chartH = h - padding * 2;
  const toX = (i: number) => padding + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (v: number) => padding + chartH - (v / maxVal) * chartH;
  const createdPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.created)}`).join(" ");
  const completedPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.completed)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[400px]" style={{ maxHeight: 250 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
          <g key={pct}>
            <line x1={padding} y1={toY(maxVal * pct)} x2={w - padding} y2={toY(maxVal * pct)} stroke="currentColor" strokeOpacity={0.1} />
            <text x={padding - 5} y={toY(maxVal * pct) + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{Math.round(maxVal * pct)}</text>
          </g>
        ))}
        <path d={createdPath} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" />
        <path d={completedPath} fill="none" stroke="#22c55e" strokeWidth={2.5} strokeLinejoin="round" />
        {data.map((d, i) => (
          <g key={i}>
            <circle cx={toX(i)} cy={toY(d.created)} r={3} fill="#3b82f6" />
            <circle cx={toX(i)} cy={toY(d.completed)} r={3} fill="#22c55e" />
          </g>
        ))}
      </svg>
      <div className="flex gap-6 justify-center mt-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-blue-500 rounded" /> Created</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="w-3 h-0.5 bg-green-500 rounded" /> Completed</span>
      </div>
    </div>
  );
}

function VelocityChart({ sprints }: { sprints: { sprint: string; completedPoints: number; completedTasks: number }[] }) {
  if (!sprints.length) return <p className="text-muted-foreground text-sm">No completed sprints yet</p>;
  const maxPts = Math.max(...sprints.map((s) => s.completedPoints), 1);
  const barW = Math.min(60, 400 / sprints.length);
  const w = sprints.length * (barW + 20) + 60, h = 200;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full min-w-[300px]" style={{ maxHeight: 220 }}>
        {sprints.map((s, i) => {
          const barH = (s.completedPoints / maxPts) * 140;
          const x = 40 + i * (barW + 20);
          return (
            <g key={i}>
              <rect x={x} y={h - 30 - barH} width={barW} height={barH} rx={4} fill="#3b82f6" fillOpacity={0.8} />
              <text x={x + barW / 2} y={h - 30 - barH - 6} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={600}>{s.completedPoints}</text>
              <text x={x + barW / 2} y={h - 10} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{s.sprint.length > 10 ? s.sprint.slice(0, 10) + "…" : s.sprint}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ReportView({ report }: { report: any }) {
  if (!report) return null;

  switch (report.type) {
    case "task_summary":
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Tasks", value: report.data.total, color: "text-foreground" },
              { label: "Completed", value: report.data.completed, color: "text-green-500" },
              { label: "Overdue", value: report.data.overdue, color: "text-red-500" },
              { label: "Completion Rate", value: `${report.data.completionRate}%`, color: "text-blue-500" },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </Card>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-5"><h3 className="font-semibold text-foreground mb-4">By Status</h3><BarChartSimple data={report.data.byStatus} labelKey="status" valueKey="count" colorMap={STATUS_COLORS} /></Card>
            <Card className="p-5"><h3 className="font-semibold text-foreground mb-4">By Priority</h3><BarChartSimple data={report.data.byPriority} labelKey="priority" valueKey="count" colorMap={PRIORITY_COLORS} /></Card>
            <Card className="p-5"><h3 className="font-semibold text-foreground mb-4">By Type</h3><BarChartSimple data={report.data.byType} labelKey="type" valueKey="count" /></Card>
          </div>
        </div>
      );

    case "status_distribution":
      return (
        <Card className="p-6 max-w-lg">
          <h3 className="font-semibold text-foreground mb-1">Status Distribution</h3>
          <p className="text-sm text-muted-foreground mb-5">{report.data.total} total tasks</p>
          <BarChartSimple data={report.data.distribution} labelKey="status" valueKey="count" colorMap={STATUS_COLORS} />
        </Card>
      );

    case "priority_breakdown":
      return (
        <Card className="p-6 max-w-lg">
          <h3 className="font-semibold text-foreground mb-1">Priority Breakdown</h3>
          <p className="text-sm text-muted-foreground mb-5">{report.data.total} total tasks</p>
          <BarChartSimple data={report.data.breakdown} labelKey="priority" valueKey="count" colorMap={PRIORITY_COLORS} />
        </Card>
      );

    case "completion_trend":
      return <Card className="p-6"><h3 className="font-semibold text-foreground mb-4">Completion Trend</h3><TrendChart data={report.data.trend} /></Card>;

    case "overdue_tasks":
      return (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">{report.data.count}</p>
                <p className="text-sm text-muted-foreground">Overdue tasks</p>
              </div>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Task</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Priority</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {report.data.tasks?.slice(0, 50).map((t: any) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-3"><span className="text-muted-foreground mr-2">#{t.taskNumber}</span><span className="text-foreground">{t.title}</span></td>
                    <td className="p-3 capitalize text-muted-foreground">{t.status?.replace(/_/g, " ")}</td>
                    <td className="p-3 capitalize text-muted-foreground">{t.priority}</td>
                    <td className="p-3"><span className="text-red-500 font-medium">{t.daysOverdue}d</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      );

    case "member_performance":
      return (
        <Card className="overflow-hidden">
          <div className="p-5 border-b border-border"><h3 className="font-semibold text-foreground">Member Performance</h3></div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Member</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Assigned</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Completed</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Overdue</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Rate</th>
              </tr>
            </thead>
            <tbody>
              {report.data.members?.map((m: any) => (
                <tr key={m.user.id} className="border-b border-border last:border-0 hover:bg-muted/30 group">
                  <td className="p-3 font-medium text-foreground">
                    <Link href={`/profile/${m.user.id}`} className="flex items-center gap-1.5 hover:text-primary transition-colors">
                      {m.user.name}
                      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </td>
                  <td className="p-3 text-center text-muted-foreground">{m.assigned}</td>
                  <td className="p-3 text-center text-green-500 font-medium">{m.completed}</td>
                  <td className="p-3 text-center text-red-500 font-medium">{m.overdue}</td>
                  <td className="p-3 text-center">
                    <span className={`font-semibold ${m.completionRate >= 70 ? "text-green-500" : m.completionRate >= 40 ? "text-yellow-500" : "text-red-500"}`}>{m.completionRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      );

    case "team_workload":
      return (
        <div className="space-y-4">
          {report.data.workload?.map((m: any) => (
            <Card key={m.user.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium text-foreground">{m.user.name}</span>
                <span className="text-sm text-muted-foreground">{m.total} tasks</span>
              </div>
              <BarChartSimple data={m.statusBreakdown} labelKey="status" valueKey="count" colorMap={STATUS_COLORS} />
            </Card>
          ))}
        </div>
      );

    case "sprint_velocity":
      return <Card className="p-6"><h3 className="font-semibold text-foreground mb-4">Sprint Velocity (Story Points)</h3><VelocityChart sprints={report.data.sprints} /></Card>;

    case "time_tracking":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-4"><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-3xl font-bold text-foreground mt-1">{report.data.totalHours}h</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Entries</p><p className="text-3xl font-bold text-foreground mt-1">{report.data.entryCount}</p></Card>
            <Card className="p-4"><p className="text-sm text-muted-foreground">Team Members</p><p className="text-3xl font-bold text-foreground mt-1">{report.data.byUser?.length || 0}</p></Card>
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground">Member</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Hours</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">Entries</th>
                </tr>
              </thead>
              <tbody>
                {report.data.byUser?.map((u: any) => (
                  <tr key={u.user.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="p-3 font-medium text-foreground">{u.user.name}</td>
                    <td className="p-3 text-center text-blue-500 font-medium">{u.totalHours}h</td>
                    <td className="p-3 text-center text-muted-foreground">{u.entries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      );

    case "person_activity":
      return (
        <div className="space-y-4">
          {/* User header */}
          <Card className="p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold">
                {(report.data.user?.name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{report.data.user?.name || "Unknown user"}</h3>
                <p className="text-xs text-muted-foreground">{report.data.user?.email}</p>
              </div>
              <div className="ml-auto grid grid-cols-4 gap-4 text-center">
                <div><p className="text-2xl font-bold">{report.data.counts.open}</p><p className="text-xs text-muted-foreground">Open</p></div>
                <div><p className="text-2xl font-bold text-emerald-500">{report.data.counts.completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
                <div><p className={`text-2xl font-bold ${report.data.counts.overdue > 0 ? "text-red-500" : ""}`}>{report.data.counts.overdue}</p><p className="text-xs text-muted-foreground">Overdue</p></div>
                <div><p className="text-2xl font-bold text-blue-500">{report.data.counts.activityEvents}</p><p className="text-xs text-muted-foreground">Activity events</p></div>
              </div>
            </div>
          </Card>

          {/* Task lists */}
          {[
            { key: "overdueTasks", title: "Currently overdue", color: "text-red-500", empty: "Nothing overdue." },
            { key: "openTasks", title: "Open", color: "text-blue-500", empty: "No open tasks." },
            { key: "completedTasks", title: "Completed in range", color: "text-emerald-500", empty: "No tasks completed in this window." },
          ].map(({ key, title, color, empty }) => {
            const list: any[] = report.data[key] || [];
            return (
              <Card key={key} className="overflow-hidden">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h4 className={`font-semibold ${color}`}>{title} <span className="text-muted-foreground">({list.length})</span></h4>
                </div>
                {list.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground text-center">{empty}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left p-2.5">Task</th>
                        <th className="text-left p-2.5">Project</th>
                        <th className="text-left p-2.5">Status</th>
                        <th className="text-left p-2.5">Priority</th>
                        <th className="text-left p-2.5">{key === "completedTasks" ? "Completed" : "Due"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.slice(0, 50).map((t: any) => (
                        <tr key={t.id} className="border-t border-border hover:bg-muted/30">
                          <td className="p-2.5"><span className="text-muted-foreground mr-2">#{t.taskNumber}</span><span className="text-foreground">{t.title}</span></td>
                          <td className="p-2.5">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.project.color || "#94A3B8" }} />
                              {t.project.name}
                            </span>
                          </td>
                          <td className="p-2.5 capitalize text-muted-foreground">{t.status?.replace(/_/g, " ")}</td>
                          <td className="p-2.5 capitalize text-muted-foreground">{t.priority}</td>
                          <td className="p-2.5 text-muted-foreground">
                            {key === "completedTasks" ? (t.completedAt?.split("T")[0] || "—") : (t.dueDate?.split("T")[0] || "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            );
          })}

          {/* Activity timeline */}
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border">
              <h4 className="font-semibold text-foreground">Activity timeline <span className="text-muted-foreground">({report.data.activity?.length || 0})</span></h4>
              <p className="text-xs text-muted-foreground mt-1">What this person did in the selected window</p>
            </div>
            {!report.data.activity || report.data.activity.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No activity recorded in this window.</p>
            ) : (
              <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
                {report.data.activity.slice(0, 200).map((a: any) => (
                  <div key={a.id} className="p-3 text-sm flex items-start gap-3">
                    <span className="h-2 w-2 mt-2 rounded-full flex-shrink-0" style={{ backgroundColor: a.task?.project?.color || "#94A3B8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">
                        <span className="font-medium capitalize">{a.action?.replace(/_/g, " ")}</span>
                        {a.field && <span className="text-muted-foreground"> · {a.field}</span>}
                        {a.task && (
                          <span className="text-muted-foreground"> on </span>
                        )}
                        {a.task && (
                          <span className="text-foreground">#{a.task.taskNumber} {a.task.title}</span>
                        )}
                      </p>
                      {(a.oldValue || a.newValue) && (
                        <p className="text-xs text-muted-foreground truncate">
                          {a.oldValue && <span>from <span className="font-mono">{a.oldValue}</span></span>}
                          {a.oldValue && a.newValue && " → "}
                          {a.newValue && <span>to <span className="font-mono">{a.newValue}</span></span>}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      );

    default:
      return <p className="text-muted-foreground">Unknown report type</p>;
  }
}

export default function ReportsPage() {
  const { workspaceId } = useAuthStore();
  const [reportType, setReportType] = useState<string>("task_summary");
  const [dateRange, setDateRange] = useState<string>("last_30_days");
  const [projectId, setProjectId] = useState<string>("all");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  // Members list -- shown for person_activity to pick which person to report on.
  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId && reportType === "person_activity" }
  );

  const isPersonActivity = reportType === "person_activity";
  const personActivityReady = !isPersonActivity || !!assigneeId;

  const { data: report, isLoading } = trpc.report.generate.useQuery(
    {
      workspaceId: workspaceId || "",
      type: reportType as any,
      dateRange: dateRange as any,
      projectId: projectId !== "all" ? projectId : undefined,
      ...(isPersonActivity && assigneeId ? { assigneeId } : {}),
    },
    { enabled: !!workspaceId && personActivityReady }
  );

  const { refetch: fetchCsv } = trpc.report.exportCsv.useQuery(
    {
      workspaceId: workspaceId || "",
      type: reportType as any,
      dateRange: dateRange as any,
      projectId: projectId !== "all" ? projectId : undefined,
      ...(isPersonActivity && assigneeId ? { assigneeId } : {}),
    },
    { enabled: false }
  );

  const handleExportCsv = async () => {
    try {
      const { data } = await fetchCsv();
      if (data?.csv) {
        const blob = new Blob([data.csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Report exported");
      }
    } catch {
      toast.error("Failed to export report");
    }
  };

  const selectedReport = REPORT_TYPES.find((r) => r.value === reportType);

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Reports" breadcrumbs={[{ label: "Reports" }]} />
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select report" />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  <span className="flex items-center gap-2"><r.icon className="w-4 h-4" />{r.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((d) => (
                <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(projects as any[])?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isPersonActivity && (
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Pick a person…" />
              </SelectTrigger>
              <SelectContent>
                {(members as any[])?.map((m: any) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto">
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!personActivityReady}>
              <Download className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {selectedReport && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center">
              <selectedReport.icon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{selectedReport.label}</h2>
              <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
            </div>
          </div>
        )}

        {isPersonActivity && !assigneeId ? (
          <Card className="p-12 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Pick a person from the dropdown above to generate the report.</p>
          </Card>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : report ? (
          <ReportView report={report} />
        ) : (
          <Card className="p-12 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Select a report type to generate</p>
          </Card>
        )}
      </div>
    </div>
  );
}
