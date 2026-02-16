"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export function BurndownWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "burndown", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = (data as { date: string; created: number; completed: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No data</p>;

  // Build cumulative remaining
  let remaining = 0;
  const points = items.map((item) => {
    remaining += item.created - item.completed;
    return remaining;
  });
  const max = Math.max(1, ...points);

  // SVG line chart
  const w = 300, h = 80;
  const path = points.map((v, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">Tasks remaining over 30 days</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-20" preserveAspectRatio="none">
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
        <path d={`${path} L${w},${h} L0,${h} Z`} fill="hsl(var(--primary))" opacity="0.1" />
      </svg>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">{items[0]?.date?.slice(5)}</span>
        <span className="text-[9px] text-muted-foreground">{items[items.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}
