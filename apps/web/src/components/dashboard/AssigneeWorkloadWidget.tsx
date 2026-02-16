"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function AssigneeWorkloadWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "assignee_workload", projectId });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  const items = data as { user: { id: string; name: string }; taskCount: number }[] || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No team members</p>;

  const max = Math.max(1, ...items.map((i) => i.taskCount));

  return (
    <div className="space-y-2.5 max-h-64 overflow-y-auto">
      {items.map((m) => (
        <div key={m.user.id} className="flex items-center gap-2">
          <Avatar className="h-5 w-5">
            <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">{m.user.name?.split(" ").map((n) => n[0]).join("") || "?"}</AvatarFallback>
          </Avatar>
          <span className="w-20 text-xs truncate">{m.user.name}</span>
          <div className="flex-1 h-4 rounded bg-muted overflow-hidden">
            <div className="h-full rounded bg-primary transition-all" style={{ width: `${(m.taskCount / max) * 100}%` }} />
          </div>
          <span className="text-xs font-medium w-6 text-right">{m.taskCount}</span>
        </div>
      ))}
    </div>
  );
}
