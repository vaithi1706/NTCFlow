"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export function CompletionTrendWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "completion_trend", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = (data as { date: string; count: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No data</p>;

  const max = Math.max(1, ...items.map((i) => i.count));
  const totalCompleted = items.reduce((s, i) => s + i.count, 0);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{totalCompleted} tasks completed in last 30 days</p>
      <div className="flex items-end gap-[2px] h-24">
        {items.map((item) => (
          <div key={item.date} className="flex-1 flex flex-col justify-end" title={`${item.date}: ${item.count}`}>
            <div
              className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors min-h-[2px]"
              style={{ height: `${Math.max(2, (item.count / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">{items[0]?.date?.slice(5)}</span>
        <span className="text-[9px] text-muted-foreground">{items[items.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
