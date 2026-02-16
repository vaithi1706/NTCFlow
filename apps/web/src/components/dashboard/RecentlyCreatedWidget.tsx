"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400", high: "bg-orange-500/20 text-orange-400", medium: "bg-yellow-500/20 text-yellow-400", low: "bg-blue-500/20 text-blue-400", none: "bg-muted text-muted-foreground",
};

export function RecentlyCreatedWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "recently_created", projectId });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const items = data as { id: string; title: string; taskNumber: number; status: string; priority: string; createdAt: string }[] || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No tasks created yet</p>;

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {items.map((task) => (
        <div key={task.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/50">
          <span className="text-muted-foreground font-mono">#{task.taskNumber}</span>
          <span className="truncate flex-1">{task.title}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[task.priority] || ""}`}>{task.priority}</Badge>
          <span className="text-muted-foreground text-[10px] flex-shrink-0">{formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}</span>
        </div>
      ))}
    </div>
  );
}
