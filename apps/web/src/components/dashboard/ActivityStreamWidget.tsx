"use client";

import { trpc } from "@/lib/api/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function ActivityStreamWidget({ projectId }: { projectId: string }) {
  const { data, isLoading } = trpc.dashboard.getWidgetData.useQuery({ type: "activity_stream", projectId });

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  const items = data as { id: string; action: string; description?: string; createdAt: string; user: { name: string } }[] || [];
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No activity yet</p>;

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-2 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p><span className="font-medium">{a.user?.name}</span>{" "}<span className="text-muted-foreground">{a.description || a.action}</span></p>
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
