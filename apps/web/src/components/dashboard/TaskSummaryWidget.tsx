"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, CheckCircle2, Clock, AlertTriangle, CircleDot } from "lucide-react";

export function TaskSummaryWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "task_summary", projectId });

  if (isLoading) return <div className="space-y-3 p-1"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;
  if (!data) return <p className="text-sm text-muted-foreground">No data</p>;

  const d = data as { total: number; byStatus: { status: string; _count: number }[]; overdueCount: number };
  const get = (s: string) => d.byStatus.find((x) => x.status === s)?._count || 0;

  const stats = [
    { label: "Total", value: d.total, icon: ListTodo, color: "text-foreground" },
    { label: "To Do", value: get("todo") + get("backlog"), icon: CircleDot, color: "text-indigo-400" },
    { label: "In Progress", value: get("in_progress") + get("in_review"), icon: Clock, color: "text-blue-400" },
    { label: "Done", value: get("done"), icon: CheckCircle2, color: "text-green-400" },
    { label: "Overdue", value: d.overdueCount, icon: AlertTriangle, color: "text-red-400" },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
          <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.color}`} />
          <p className="text-xl font-bold">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
