"use client";

import { useState, useMemo, Fragment } from "react";
import { Bell, Filter, Search, LayoutGrid, List, Table, CalendarDays, GanttChart, BarChart3, Zap, Map, Layers, Package, FileText, GitBranch, Grid3X3, Milestone, Brain, FolderOpen } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Settings, LogOut, Sun, Moon, Monitor, UserPlus, MessageSquare, AtSign, Clock, BellOff } from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { AiSearch } from "@/components/ai/ai-search";
import { AiChatPanel } from "@/components/ai/ai-chat-panel";
import { PresenceAvatars } from "@/components/shared/presence-avatars";
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";

interface TopBarProps {
  breadcrumbs?: { label: string; href?: string }[];
  showViewSwitcher?: boolean;
  showFilter?: boolean;
  currentView?: string;
  onViewChange?: (view: string) => void;
  onFilterClick?: () => void;
  filterActive?: boolean;
  projectId?: string;
}

const views = [
  { id: "board", icon: LayoutGrid, label: "Board" },
  { id: "list", icon: List, label: "List" },
  { id: "table", icon: Table, label: "Table" },
  { id: "calendar", icon: CalendarDays, label: "Calendar" },
  { id: "timeline", icon: GanttChart, label: "Timeline" },
  { id: "roadmap", icon: Map, label: "Roadmap" },
  { id: "backlog", icon: Layers, label: "Backlog" },
  { id: "dashboard", icon: BarChart3, label: "Dashboard" },
  { id: "sprints", icon: Zap, label: "Sprints" },
  { id: "releases", icon: Package, label: "Releases" },
  { id: "dependencies", icon: GitBranch, label: "Dependencies" },
  { id: "matrix", icon: Grid3X3, label: "Matrix" },
  { id: "epics", icon: Milestone, label: "Epics" },
  { id: "time-report", icon: Clock, label: "Time Report" },
  { id: "documents", icon: FolderOpen, label: "Documents" },
  { id: "forms", icon: FileText, label: "Forms" },
  { id: "engine", icon: Brain, label: "Engine" },
  { id: "settings", icon: Settings, label: "Settings" },
];

function getNotifIcon(type: string) {
  switch (type) {
    case "task_assigned": case "project_invited": case "workspace_invited":
      return <UserPlus className="h-3.5 w-3.5 text-blue-400" />;
    case "task_commented":
      return <MessageSquare className="h-3.5 w-3.5 text-green-400" />;
    case "task_mentioned":
      return <AtSign className="h-3.5 w-3.5 text-purple-400" />;
    case "task_due_soon": case "task_overdue":
      return <Clock className="h-3.5 w-3.5 text-amber-400" />;
    default:
      return <Bell className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function groupByDate(notifications: any[]) {
  const groups: { label: string; items: any[] }[] = [];
  const today: any[] = [];
  const yesterday: any[] = [];
  const thisWeek: any[] = [];
  const earlier: any[] = [];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    if (isToday(d)) today.push(n);
    else if (isYesterday(d)) yesterday.push(n);
    else if (isThisWeek(d)) thisWeek.push(n);
    else earlier.push(n);
  }

  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (thisWeek.length) groups.push({ label: "This Week", items: thisWeek });
  if (earlier.length) groups.push({ label: "Earlier", items: earlier });

  return groups;
}

export function TopBar({
  breadcrumbs = [], showViewSwitcher, showFilter, currentView = "board", onViewChange, onFilterClick, filterActive, projectId,
}: TopBarProps) {
  const { setCommandPaletteOpen } = useUIStore();
  const { user, logout, workspaceId } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const routeParams = useParams();
  const resolvedProjectId = projectId || (routeParams?.projectId as string | undefined);
  const [notifOpen, setNotifOpen] = useState(false);

  const utils = trpc.useUtils();

  const { data: unreadCount } = trpc.notification.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: notifications } = trpc.notification.list.useQuery(
    { limit: 30 },
    { enabled: notifOpen }
  );

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

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const notifList = (notifications as any)?.notifications || notifications || [];
  const grouped = useMemo(() => groupByDate(Array.isArray(notifList) ? notifList : []), [notifList]);

  const handleNotifClick = (n: any) => {
    if (!n.isRead) markReadMutation.mutate({ id: n.id });
    if (n.linkUrl) {
      router.push(n.linkUrl);
      setNotifOpen(false);
    }
  };

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 gap-4 flex-shrink-0 sticky top-0 z-30">
      {/* Left: Breadcrumbs */}
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((bc, i) => (
            <Fragment key={i}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {bc.href ? (
                  <BreadcrumbLink asChild><Link href={bc.href}>{bc.label}</Link></BreadcrumbLink>
                ) : (
                  <span className="text-foreground font-medium">{bc.label}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Center: View Switcher */}
      {showViewSwitcher && (
        <div data-tour="view-switcher" className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 overflow-x-auto">
          {views.map((v) => (
            <Tooltip key={v.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onViewChange?.(v.id)}
                  className={`p-1.5 rounded-md transition-colors ${
                    currentView === v.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <v.icon className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{v.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      {/* Right: Actions */}
      <div className="flex items-center gap-1">
        {showFilter && (
          <Button data-tour="filter-bar" variant="ghost" size="sm" className={filterActive ? "text-primary" : "text-muted-foreground"} onClick={onFilterClick}>
            <Filter className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Filter</span>
            {filterActive && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
          </Button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-tour="command-palette"
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search (⌘K)</TooltipContent>
        </Tooltip>

        {workspaceId && <AiSearch workspaceId={workspaceId} />}
        {workspaceId && <AiChatPanel projectId={resolvedProjectId} workspaceId={workspaceId} />}

        {/* Theme Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{theme === "dark" ? "Light mode" : "Dark mode"}</TooltipContent>
        </Tooltip>

        {/* Presence Avatars */}
        <PresenceAvatars page={resolvedProjectId ? `project:${resolvedProjectId}` : undefined} />

        {/* Notification Bell with Grouped Dropdown */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button data-tour="notifications" variant="ghost" size="icon" className="text-muted-foreground relative">
                  <Bell className="h-4 w-4" />
                  {(unreadCount?.count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
                      {unreadCount!.count > 9 ? "9+" : unreadCount!.count}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-96 p-0" align="end">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h4 className="text-sm font-semibold">Notifications</h4>
              {(unreadCount?.count ?? 0) > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => markAllReadMutation.mutate()}
                >
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {grouped.length > 0 ? (
                grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-4 py-2 bg-muted/30">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</p>
                    </div>
                    {group.items.map((n: any) => (
                      <button
                        key={n.id}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-0 flex items-start gap-3 ${
                          !n.isRead ? "bg-primary/5" : ""
                        }`}
                        onClick={() => handleNotifClick(n)}
                      >
                        <div className="mt-0.5 flex-shrink-0">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug">{n.title || n.message || "Notification"}</p>
                          {n.message && n.title && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </button>
                    ))}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <BellOff className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">You&apos;re all caught up!</p>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1">
              <Avatar className="h-7 w-7">
                {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name || ""} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground">{user?.email || ""}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-4 w-4" />Light
              {theme === "light" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-4 w-4" />Dark
              {theme === "dark" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>
              <Monitor className="mr-2 h-4 w-4" />System
              {theme === "system" && <span className="ml-auto text-xs text-primary">✓</span>}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
