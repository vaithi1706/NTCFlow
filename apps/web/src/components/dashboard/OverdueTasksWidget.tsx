"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";

export function OverdueTasksWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "overdue_tasks", projectId });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const items = data as { id: string; title: string; taskNumber: number; dueDate: string; priority: string; assignee?: { name: string } | null }[] || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">🎉 No overdue tasks!</p>;

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {items.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-xs p-2 rounded bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
          <span className="text-muted-foreground font-mono">#{task.taskNumber}</span>
          <span className="truncate flex-1">{task.title}</span>
          <span className="text-red-400 text-[10px] flex-shrink-0">
            {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
          </span>
        </div>
      ))}
    </div>
  );
}
