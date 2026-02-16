"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", none: "#94A3B8",
};

export function PriorityPieChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "priority_breakdown", projectId });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const items = (data as { priority: string; _count: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No tasks</p>;

  const total = items.reduce((s, i) => s + i._count, 0);
  let cumulative = 0;
  const segments = items.map((item) => {
    const start = cumulative / total;
    cumulative += item._count;
    const end = cumulative / total;
    return { ...item, start, end };
  });

  const gradient = segments.map((s) => `${COLORS[s.priority] || "#94A3B8"} ${s.start * 360}deg ${s.end * 360}deg`).join(", ");

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 h-28 rounded-full flex-shrink-0" style={{
        background: `conic-gradient(${gradient})`,
        mask: "radial-gradient(circle at center, transparent 40%, black 41%)",
        WebkitMask: "radial-gradient(circle at center, transparent 40%, black 41%)",
      }} />
      <div className="space-y-1.5 min-w-0">
        {items.map((item) => (
          <div key={item.priority} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[item.priority] || "#94A3B8" }} />
            <span className="capitalize text-muted-foreground">{item.priority}</span>
            <span className="font-medium ml-auto">{item._count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
