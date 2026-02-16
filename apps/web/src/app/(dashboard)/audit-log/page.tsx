"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/topbar";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Loader2, ChevronLeft, ChevronRight, ShieldAlert,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const actionLabels: Record<string, string> = {
  "task.deleted": "deleted a task",
  "version.created": "created a version",
  "version.released": "released a version",
  "project.created": "created a project",
  "project.deleted": "deleted a project",
  "member.invited": "invited a member",
  "member.removed": "removed a member",
  "role.changed": "changed a role",
  "settings.updated": "updated settings",
  "sprint.started": "started a sprint",
  "sprint.completed": "completed a sprint",
};

const entityTypes = ["all", "task", "project", "version", "member", "workspace", "role", "sprint"];

export default function AuditLogPage() {
  const { workspaceId } = useAuthStore();
  const { can } = usePermissions();
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const { data, isLoading } = trpc.audit.list.useQuery(
    {
      workspaceId: workspaceId!,
      action: actionFilter || undefined,
      entityType: entityTypeFilter !== "all" ? entityTypeFilter : undefined,
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate: endDate ? new Date(endDate).toISOString() : undefined,
      limit: 50,
      cursor,
    },
    { enabled: !!workspaceId && can("canAccessSettings") }
  );

  if (!can("canAccessSettings")) {
    return (
      <>
        <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Audit Log" }]} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium">Access Denied</h3>
            <p className="text-sm text-muted-foreground mt-1">Only workspace owners and admins can view the audit log</p>
          </div>
        </div>
      </>
    );
  }

  const handleNext = () => {
    if (data?.nextCursor) {
      setPrevCursors((p) => [...p, cursor || "__start__"]);
      setCursor(data.nextCursor);
    }
  };

  const handlePrev = () => {
    const prev = [...prevCursors];
    const last = prev.pop();
    setPrevCursors(prev);
    setCursor(last === "__start__" ? undefined : last);
  };

  const formatAction = (log: any) => {
    const userName = log.user?.name || "System";
    const action = actionLabels[log.action] || log.action;
    const meta = log.metadata as any;
    let detail = "";
    if (meta?.name) detail = ` "${meta.name}"`;
    if (meta?.title) detail = ` "${meta.title}"`;
    if (meta?.taskNumber) detail = ` DK-${meta.taskNumber}${detail}`;
    return `${userName} ${action}${detail}`;
  };

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Audit Log" }]} />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">Track all significant actions in your workspace</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-end gap-3 mb-6">
          <div>
            <Label className="text-xs">Entity Type</Label>
            <Select value={entityTypeFilter} onValueChange={(v) => { setEntityTypeFilter(v); setCursor(undefined); setPrevCursors([]); }}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {entityTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Action</Label>
            <Input
              className="h-8 w-40"
              placeholder="Filter action..."
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setCursor(undefined); setPrevCursors([]); }}
            />
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" className="h-8 w-36" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCursor(undefined); setPrevCursors([]); }} />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" className="h-8 w-36" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCursor(undefined); setPrevCursors([]); }} />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data?.logs?.length ? (
          <div className="text-center py-20">
            <Shield className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
            <h3 className="text-lg font-medium">No audit logs</h3>
            <p className="text-sm text-muted-foreground mt-1">Actions will appear here as they happen</p>
          </div>
        ) : (
          <>
            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium w-40">Time</th>
                      <th className="text-left p-3 font-medium w-40">User</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium w-24">Entity</th>
                      <th className="text-left p-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.logs.map((log: any) => (
                      <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="p-3">
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), "MMM d, HH:mm")}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                                {log.user?.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{log.user?.name || "System"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{formatAction(log)}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">{log.entityType}</Badge>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.metadata ? JSON.stringify(log.metadata) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={prevCursors.length === 0}
                onClick={handlePrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.nextCursor}
                onClick={handleNext}
              >
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
