"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Star, Plus, ChevronLeft, ChevronDown, LogOut,
  Settings, ChevronsLeft, LayoutGrid, User as UserIcon, Loader2, Users,
  ChevronsUpDown, Building2, BarChart3, UsersRound, Shield, Briefcase,
  Target, ClipboardCheck, Bell, Search, FileBarChart, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { useSubscription } from "@/hooks/use-subscription";
import { UsageBar } from "@/components/shared/usage-bar";
import { Sparkles, Crown } from "lucide-react";

const navItems = [
  { icon: Home, label: "Home", href: "/home" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: Bell, label: "Notifications", href: "/notifications", badge: true },
  { icon: LayoutGrid, label: "My Work", href: "/my-work" },
  { icon: Briefcase, label: "Portfolio", href: "/portfolio" },
  { icon: Users, label: "Members", href: "/members" },
  { icon: UsersRound, label: "Teams", href: "/teams" },
  { icon: BarChart3, label: "Workload", href: "/workload" },
  { icon: Users, label: "Resource Planning", href: "/resource-planning" },
  { icon: Target, label: "Goals", href: "/goals" },
  { icon: Video, label: "Meetings", href: "/meetings" },
  { icon: FileBarChart, label: "Reports", href: "/reports" },
  { icon: ClipboardCheck, label: "Approvals", href: "/approvals" },
  { icon: Settings, label: "Workspace Settings", href: "/workspace-settings", permission: "canAccessSettings" },
  { icon: Shield, label: "Audit Log", href: "/audit-log", permission: "canAccessSettings" },
];

// Starred projects stored in localStorage
function getStarredProjects(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("dkflow-starred-projects") || "[]");
  } catch { return []; }
}

function setStarredProjects(ids: string[]) {
  localStorage.setItem("dkflow-starred-projects", JSON.stringify(ids));
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { user, workspaceId, setWorkspaceId, logout } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const { can } = usePermissions();
  const [starred, setStarred] = useState<string[]>([]);
  const [starredCollapsed, setStarredCollapsed] = useState(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);

  useEffect(() => {
    setStarred(getStarredProjects());
  }, []);

  const toggleStar = useCallback((projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStarred((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId];
      setStarredProjects(next);
      return next;
    });
  }, []);

  const { data: unreadCount } = trpc.notification.getUnreadCount.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, {
    enabled: !!workspaceId,
  });
  const currentWorkspace = workspaces?.find((w: any) => w.id === workspaceId);
  const wsSlug = currentWorkspace?.slug || "workspace";

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  const createProjectMutation = trpc.project.create.useMutation({
    onSuccess: (project) => {
      setCreateOpen(false);
      setNewProjectName("");
      toast.success("Project created!");
      router.push(`/${wsSlug}/projects/${project.id}/board`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCreateProject = () => {
    if (!newProjectName.trim() || !workspaceId) return;
    createProjectMutation.mutate({
      name: newProjectName.trim(),
      workspaceId,
    });
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleWorkspaceSwitch = (wsId: string) => {
    setWorkspaceId(wsId);
    router.push("/home");
    toast.success("Switched workspace");
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
    : "U";

  // Sort projects: starred first
  const sortedProjects = projects
    ? [...projects].sort((a, b) => {
        const aStarred = starred.includes(a.id) ? 0 : 1;
        const bStarred = starred.includes(b.id) ? 0 : 1;
        return aStarred - bStarred;
      })
    : [];

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: sidebarOpen ? 260 : 60 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        data-tour="sidebar"
        className="h-screen flex flex-col border-r border-border bg-sidebar text-sidebar-foreground overflow-hidden flex-shrink-0"
      >
        {/* Logo */}
        <div className="flex items-center gap-2 h-14 px-4 flex-shrink-0">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
            DK
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-lg overflow-hidden whitespace-nowrap"
              >
                DKFlow
              </motion.span>
            )}
          </AnimatePresence>
          {sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={toggleSidebar}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Workspace Switcher */}
        {workspaces && workspaces.length > 0 && (
          <div className="px-2 pb-2 flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-accent transition-colors text-sm",
                    !sidebarOpen && "justify-center"
                  )}
                >
                  <Building2 className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-left truncate font-medium">
                        {currentWorkspace?.name || "Workspace"}
                      </span>
                      <ChevronsUpDown className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Workspaces</p>
                {workspaces.map((ws: any) => (
                  <DropdownMenuItem
                    key={ws.id}
                    onClick={() => handleWorkspaceSwitch(ws.id)}
                    className={cn(ws.id === workspaceId && "bg-accent")}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    <span className="truncate">{ws.name}</span>
                    {ws.id === workspaceId && (
                      <span className="ml-auto text-xs text-primary">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {navItems
            .filter((item) => !(item as any).permission || can((item as any).permission))
            .map((item) => {
            const active = pathname === item.href;
            return (
              <SidebarLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                active={active}
                collapsed={!sidebarOpen}
                count={(item as any).badge ? (unreadCount?.count || undefined) : undefined}
              />
            );
          })}

          {user?.email === "llokesh65@gmail.com" && (
            <SidebarLink
              href="/admin"
              icon={Shield}
              label="Admin"
              active={pathname.startsWith("/admin")}
              collapsed={!sidebarOpen}
            />
          )}

          <Separator className="my-3" />

          {/* Starred Projects */}
          {sidebarOpen && starred.length > 0 && sortedProjects.some((p) => starred.includes(p.id)) && (
            <>
              <button
                onClick={() => setStarredCollapsed(!starredCollapsed)}
                className="flex items-center gap-1 px-3 mb-1 w-full group"
              >
                <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", starredCollapsed && "-rotate-90")} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Starred
                </span>
              </button>
              {!starredCollapsed && sortedProjects
                .filter((p) => starred.includes(p.id))
                .map((project) => (
                  <div key={`star-${project.id}`} className="flex items-center group/star">
                    <div className="flex-1 min-w-0">
                      <SidebarLink
                        href={`/${wsSlug}/projects/${project.id}/board`}
                        label={project.name}
                        active={pathname.includes(project.id)}
                        collapsed={!sidebarOpen}
                        dot={project.color || undefined}
                        count={(project as any)._count?.tasks}
                      />
                    </div>
                    {sidebarOpen && (
                      <button
                        onClick={(e) => toggleStar(project.id, e)}
                        className="mr-2 flex-shrink-0"
                      >
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                      </button>
                    )}
                  </div>
                ))}
              <Separator className="my-3" />
            </>
          )}

          {/* Projects */}
          {sidebarOpen && (
            <button
              onClick={() => setProjectsCollapsed(!projectsCollapsed)}
              className="flex items-center gap-1 px-3 mb-1 w-full group"
            >
              <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform", projectsCollapsed && "-rotate-90")} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                All Projects
              </span>
            </button>
          )}
          {!projectsCollapsed && sortedProjects
            .filter((p) => !starred.includes(p.id))
            .map((project) => (
              <div key={project.id} className="flex items-center group/star">
                <div className="flex-1 min-w-0">
                  <SidebarLink
                    href={`/${wsSlug}/projects/${project.id}/board`}
                    label={project.name}
                    active={pathname.includes(project.id)}
                    collapsed={!sidebarOpen}
                    dot={project.color || undefined}
                    count={(project as any)._count?.tasks}
                  />
                </div>
                {sidebarOpen && (
                  <button
                    onClick={(e) => toggleStar(project.id, e)}
                    className="mr-2 flex-shrink-0 opacity-0 group-hover/star:opacity-100 transition-opacity"
                  >
                    <Star className="h-3 w-3 text-muted-foreground hover:text-yellow-500" />
                  </button>
                )}
              </div>
            ))}

          {/* Create project */}
          {can("canCreateProject") && (
          <button
            data-tour="create-project"
            onClick={() => setCreateOpen(true)}
            className={cn(
              "flex items-center gap-2 w-full rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              !sidebarOpen && "justify-center px-0"
            )}
          >
            <Plus className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && <span>Create Project</span>}
          </button>
          )}
        </nav>

        {/* Subscription / Upgrade */}
        <SidebarSubscription collapsed={!sidebarOpen} />

        {/* User footer */}
        <div className="border-t border-border p-2 flex-shrink-0" data-tour="profile-settings">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-accent transition-colors",
                  !sidebarOpen && "justify-center"
                )}
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  {user?.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user?.name || ""} />}
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {sidebarOpen && (
                  <div className="flex-1 text-left overflow-hidden">
                    <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user?.email || ""}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <DropdownMenuItem asChild>
                <Link href="/settings"><UserIcon className="mr-2 h-4 w-4" />Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
              </DropdownMenuItem>
              {can("canAccessSettings") && (
              <DropdownMenuItem asChild>
                <Link href="/workspace-settings"><Building2 className="mr-2 h-4 w-4" />Workspace Settings</Link>
              </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expand button when collapsed */}
        {!sidebarOpen && (
          <div className="border-t border-border p-2 flex justify-center flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Button>
          </div>
        )}
      </motion.aside>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                placeholder="My Project"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || createProjectMutation.isPending}>
              {createProjectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SidebarLink({
  href, icon: Icon, label, active, collapsed, dot, count,
}: {
  href: string;
  icon?: React.ElementType;
  label: string;
  active: boolean;
  collapsed: boolean;
  dot?: string;
  count?: number;
}) {
  const content = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
        collapsed && "justify-center px-0"
      )}
    >
      {dot && !Icon ? (
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
      ) : Icon ? (
        <Icon className="h-4 w-4 flex-shrink-0" />
      ) : (
        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot || "#94A3B8" }} />
      )}
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && count != null && count > 0 && (
        <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SidebarSubscription({ collapsed }: { collapsed: boolean }) {
  const { plan, isPro, isTrialing, trialDaysLeft, usage, limits, isLoading } = useSubscription();
  const router = useRouter();

  if (isLoading) return null;

  if (collapsed) {
    if (!isPro) {
      return (
        <div className="border-t border-border p-2 flex justify-center flex-shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push("/pricing")}
                className="h-8 w-8 rounded-md bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Sparkles className="h-4 w-4 text-white" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Upgrade to Pro</TooltipContent>
          </Tooltip>
        </div>
      );
    }
    return (
      <div className="border-t border-border p-2 flex justify-center flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="h-6 w-6 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Crown className="h-3 w-3 text-amber-500" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Pro Plan{isTrialing ? ` (Trial: ${trialDaysLeft}d left)` : ""}</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-3 py-3 flex-shrink-0 space-y-2">
      {!isPro && (
        <>
          <UsageBar label="Projects" current={usage.projects} max={limits.maxProjects} />
          <UsageBar label="Tasks" current={usage.tasks} max={limits.maxTasks} />
          <UsageBar label="Members" current={usage.members} max={limits.maxMembers} />
          <button
            onClick={() => router.push("/pricing")}
            className="flex items-center gap-2 w-full rounded-md px-3 py-2 mt-2 text-sm font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90 transition-opacity"
          >
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </button>
        </>
      )}
      {isPro && (
        <div className="flex items-center gap-2 text-xs">
          <Crown className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-amber-400 font-medium">Pro Plan</span>
          {isTrialing && (
            <span className="text-zinc-500 ml-auto">{trialDaysLeft}d left</span>
          )}
        </div>
      )}
    </div>
  );
}
