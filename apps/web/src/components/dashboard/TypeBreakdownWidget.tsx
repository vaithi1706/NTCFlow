"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS: Record<string, string> = {
  bug: "#ef4444", feature: "#22c55e", story: "#8b5cf6", task: "#3b82f6", epic: "#f59e0b",
};

export function TypeBreakdownWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "type_breakdown", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = (data as { type: string; _count: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No tasks</p>;

  const max = Math.max(...items.map((i) => i._count));

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.type} className="flex items-center gap-3">
          <span className="w-16 text-xs text-muted-foreground capitalize">{item.type}</span>
          <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
            <div className="h-full rounded transition-all" style={{ width: `${(item._count / max) * 100}%`, backgroundColor: COLORS[item.type] || "#94A3B8" }} />
          </div>
          <span className="text-xs font-medium w-8 text-right">{item._count}</span>
        </div>
      ))}
    </div>
  );
}
