"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export function SprintHealthWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "sprint_health", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data) return <p className="text-sm text-muted-foreground">No active sprint</p>;

  const d = data as { name: string; totalTasks: number; completedTasks: number; totalPoints: number; completedPoints: number; daysRemaining: number; totalDays: number };
  const taskPct = d.totalTasks > 0 ? (d.completedTasks / d.totalTasks) * 100 : 0;
  const dayPct = d.totalDays > 0 ? ((d.totalDays - d.daysRemaining) / d.totalDays) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{d.name}</span>
        <span className="text-xs text-muted-foreground">{d.daysRemaining} days left</span>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Tasks: {d.completedTasks}/{d.totalTasks}</span>
          <span>{Math.round(taskPct)}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${taskPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Time elapsed</span>
          <span>{Math.round(dayPct)}%</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${dayPct}%` }} />
        </div>
      </div>
      {d.totalPoints > 0 && (
        <p className="text-xs text-muted-foreground">Points: {d.completedPoints}/{d.totalPoints}</p>
      )}
    </div>
  );
}
