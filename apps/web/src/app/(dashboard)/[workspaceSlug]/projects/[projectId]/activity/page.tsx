"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { formatDistanceToNow } from "date-fns";

export default function ActivityPage() {
  const { projectId } = useParams() as { projectId: string };
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [allActivities, setAllActivities] = useState<any[]>([]);

  const { data, isLoading, isFetching } = trpc.activity.getProjectActivity.useQuery(
    { projectId, limit: 50, cursor },
    {
      onSuccess: (newData: any) => {
        if (!cursor) {
          setAllActivities(newData.activities);
        } else {
          setAllActivities(prev => [...prev, ...newData.activities]);
        }
      },
    }
  );

  const loadMore = useCallback(() => {
    if (data?.nextCursor) setCursor(data.nextCursor);
  }, [data?.nextCursor]);

  const filtered = actionFilter === "all"
    ? allActivities
    : allActivities.filter((a: any) => a.action === actionFilter);

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Activity" }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-bold flex-1">Activity Feed</h1>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="commented">Commented</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((activity: any) => (
            <div key={activity.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {activity.user?.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{activity.user?.name}</span>{" "}
                  <span className="text-muted-foreground">{activity.action}</span>{" "}
                  <span className="text-muted-foreground">{activity.entityType}</span>
                </p>
                {activity.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activity.description}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}

          {filtered.length === 0 && !isLoading && (
            <p className="text-center text-muted-foreground py-12">No activity yet</p>
          )}
        </div>

        {data?.nextCursor && (
          <div className="text-center mt-4">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Load More
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
