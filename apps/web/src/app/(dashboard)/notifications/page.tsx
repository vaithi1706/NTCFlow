"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, BellOff, Check, CheckCheck, Archive, Trash2,
  UserPlus, MessageSquare, AtSign, Clock, Zap, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/api/trpc";
import { formatDistanceToNow } from "date-fns";
import { TopBar } from "@/components/layout/topbar";

const notifTypeLabels: Record<string, string> = {
  task_assigned: "Assignment",
  task_updated: "Update",
  task_due_soon: "Due Soon",
  task_overdue: "Overdue",
  task_commented: "Comment",
  task_mentioned: "Mention",
  task_status_changed: "Status Change",
  project_invited: "Invitation",
  workspace_invited: "Invitation",
  sprint_started: "Sprint",
  sprint_completed: "Sprint",
};

function getNotifIcon(type: string) {
  switch (type) {
    case "task_assigned": case "project_invited": case "workspace_invited":
      return <UserPlus className="h-4 w-4 text-blue-400" />;
    case "task_commented":
      return <MessageSquare className="h-4 w-4 text-green-400" />;
    case "task_mentioned":
      return <AtSign className="h-4 w-4 text-purple-400" />;
    case "task_due_soon": case "task_overdue":
      return <Clock className="h-4 w-4 text-amber-400" />;
    case "task_status_changed":
      return <Zap className="h-4 w-4 text-cyan-400" />;
    case "sprint_started": case "sprint_completed":
      return <Zap className="h-4 w-4 text-orange-400" />;
    default:
      return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"unread" | "all">("unread");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const { data: unreadCount } = trpc.notification.getUnreadCount.useQuery();
  const { data, isLoading } = trpc.notification.list.useQuery({
    limit: 100,
    unreadOnly: tab === "unread",
  });

  const markAllReadMutation = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const markReadMutation = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const archiveMutation = trpc.notification.archive.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const archiveAllMutation = trpc.notification.archiveAll.useMutation({
    onSuccess: () => {
      utils.notification.getUnreadCount.invalidate();
      utils.notification.list.invalidate();
    },
  });

  const notifications = useMemo(() => {
    const list = (data as any)?.notifications || data || [];
    if (!Array.isArray(list)) return [];
    if (typeFilter) return list.filter((n: any) => n.type === typeFilter);
    return list;
  }, [data, typeFilter]);

  const uniqueTypes = useMemo(() => {
    const list = (data as any)?.notifications || data || [];
    if (!Array.isArray(list)) return [];
    return [...new Set(list.map((n: any) => n.type))] as string[];
  }, [data]);

  const handleClick = (n: any) => {
    if (!n.isRead) markReadMutation.mutate({ id: n.id });
    if (n.linkUrl) router.push(n.linkUrl);
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar breadcrumbs={[{ label: "Notifications" }]} />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto py-8 px-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Inbox</h1>
              {(unreadCount?.count ?? 0) > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount!.count} unread
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="h-3.5 w-3.5 mr-1.5" />
                    {typeFilter ? notifTypeLabels[typeFilter] || typeFilter : "All types"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTypeFilter(null)}>All types</DropdownMenuItem>
                  {uniqueTypes.map((t) => (
                    <DropdownMenuItem key={t} onClick={() => setTypeFilter(t)}>
                      {notifTypeLabels[t] || t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={!unreadCount?.count}
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                Mark all read
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveAllMutation.mutate()}
              >
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archive read
              </Button>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
            <TabsList>
              <TabsTrigger value="unread" className="gap-1.5">
                Unread
                {(unreadCount?.count ?? 0) > 0 && (
                  <span className="ml-1 text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                    {unreadCount!.count}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-20 text-center">
              <BellOff className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">
                {tab === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors group hover:bg-muted/50 ${
                    !n.isRead ? "bg-primary/5 border border-primary/10" : "border border-transparent"
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {getNotifIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-medium" : ""}`}>
                        {n.title || n.message || "Notification"}
                      </p>
                      {!n.isRead && (
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </div>
                    {n.message && n.title && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {notifTypeLabels[n.type] || n.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); markReadMutation.mutate({ id: n.id }); }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={(e) => { e.stopPropagation(); archiveMutation.mutate({ id: n.id }); }}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
