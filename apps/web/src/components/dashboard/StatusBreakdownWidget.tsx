"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS: Record<string, string> = {
  backlog: "#94A3B8", todo: "#6366f1", in_progress: "#3b82f6", in_review: "#f59e0b", done: "#22c55e", cancelled: "#ef4444",
};

export function StatusBreakdownWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "status_breakdown", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = (data as { status: string; _count: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No tasks</p>;

  const total = items.reduce((s, i) => s + i._count, 0);

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-muted">
        {items.map((item) => (
          <div key={item.status} className="h-full transition-all" style={{ width: `${(item._count / total) * 100}%`, backgroundColor: COLORS[item.status] || "#94A3B8" }} title={`${item.status}: ${item._count}`} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[item.status] || "#94A3B8" }} />
            <span className="capitalize text-muted-foreground truncate">{item.status.replace("_", " ")}</span>
            <span className="font-medium ml-auto">{item._count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
