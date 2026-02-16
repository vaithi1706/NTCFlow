"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";

export function VelocityWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "velocity", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = (data as { name: string; completedPoints: number; totalPoints: number; completedTasks: number }[]) || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No completed sprints</p>;

  const max = Math.max(1, ...items.map((i) => i.completedPoints || i.completedTasks));
  const usePoints = items.some((i) => i.completedPoints > 0);

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">{usePoints ? "Story Points" : "Tasks"} completed per sprint</p>
      <div className="flex items-end gap-3 h-24">
        {items.map((item) => {
          const val = usePoints ? item.completedPoints : item.completedTasks;
          return (
            <div key={item.name} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium">{val}</span>
              <div className="w-full flex flex-col justify-end h-16">
                <div className="w-full rounded-t bg-primary/80 transition-all" style={{ height: `${(val / max) * 100}%`, minHeight: "4px" }} />
              </div>
              <span className="text-[9px] text-muted-foreground truncate w-full text-center">{item.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
