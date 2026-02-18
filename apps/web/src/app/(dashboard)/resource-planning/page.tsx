"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { TopBar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users, AlertTriangle, TrendingUp, Clock, CalendarDays,
  ChevronDown, ChevronRight, Settings2, Gauge, UserCheck,
  UserX, Coffee, Briefcase, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { toast } from "sonner";

const STATUS_CONFIG = {
  overloaded: { label: "Overloaded", color: "bg-red-500", textColor: "text-red-500", icon: AlertTriangle },
  optimal: { label: "Optimal", color: "bg-green-500", textColor: "text-green-500", icon: UserCheck },
  underloaded: { label: "Underloaded", color: "bg-yellow-500", textColor: "text-yellow-500", icon: UserX },
  on_leave: { label: "On Leave", color: "bg-gray-500", textColor: "text-gray-500", icon: Coffee },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#3b82f6", none: "#6b7280",
};

function UtilizationBar({ utilization, size = "md" }: { utilization: number; size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? "h-2" : size === "lg" ? "h-5" : "h-3";
  const color =
    utilization > 100 ? "bg-red-500" :
    utilization > 80 ? "bg-yellow-500" :
    utilization > 50 ? "bg-green-500" : "bg-blue-500";

  return (
    <div className={`w-full ${h} rounded-full bg-muted overflow-hidden`}>
      <div
        className={`${h} rounded-full ${color} transition-all duration-500`}
        style={{ width: `${Math.min(utilization, 100)}%` }}
      />
      {utilization > 100 && (
        <div
          className={`${h} rounded-full bg-red-500/30 -mt-${size === "sm" ? "2" : size === "lg" ? "5" : "3"}`}
          style={{ width: `${Math.min(utilization - 100, 100)}%`, marginTop: size === "sm" ? "-0.5rem" : size === "lg" ? "-1.25rem" : "-0.75rem" }}
        />
      )}
    </div>
  );
}

function SummaryCards({ summary }: { summary: any }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Users className="w-4 h-4" />
          <span className="text-xs">Team Size</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{summary.totalMembers}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Gauge className="w-4 h-4" />
          <span className="text-xs">Avg Utilization</span>
        </div>
        <p className={`text-2xl font-bold ${summary.avgUtilization > 100 ? "text-red-500" : summary.avgUtilization > 80 ? "text-yellow-500" : "text-green-500"}`}>
          {summary.avgUtilization}%
        </p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-red-500 mb-1">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-xs">Overloaded</span>
        </div>
        <p className="text-2xl font-bold text-red-500">{summary.overloaded}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-yellow-500 mb-1">
          <ArrowDownRight className="w-4 h-4" />
          <span className="text-xs">Underloaded</span>
        </div>
        <p className="text-2xl font-bold text-yellow-500">{summary.underloaded}</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs">Total Capacity</span>
        </div>
        <p className="text-2xl font-bold text-foreground">{summary.totalCapacityHours}h</p>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Briefcase className="w-4 h-4" />
          <span className="text-xs">Allocated</span>
        </div>
        <p className="text-2xl font-bold text-blue-500">{summary.totalAllocatedHours}h</p>
      </Card>
    </div>
  );
}

function MemberCard({ member, onEditCapacity }: { member: any; onEditCapacity: (userId: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[member.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.optimal;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Avatar + Name */}
          <Avatar className="h-10 w-10">
            <AvatarImage src={member.user.avatarUrl || undefined} />
            <AvatarFallback className="bg-blue-600 text-white text-sm">
              {member.user.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{member.user.name}</span>
              <Badge variant="outline" className={`text-xs ${statusConfig.textColor}`}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusConfig.label}
              </Badge>
              {member.capacity.isOnLeave && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  <Coffee className="w-3 h-3 mr-1" /> On Leave
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{member.user.email}</span>
          </div>

          {/* Utilization number */}
          <div className="text-right">
            <p className={`text-2xl font-bold ${statusConfig.textColor}`}>{member.allocation.utilization}%</p>
            <p className="text-xs text-muted-foreground">utilization</p>
          </div>

          {/* Settings */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditCapacity(member.user.id)}>
            <Settings2 className="w-4 h-4" />
          </Button>

          {/* Expand */}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>

        {/* Utilization bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{member.allocation.totalAllocatedHours}h allocated</span>
            <span>{member.capacity.totalCapacityHours}h capacity</span>
          </div>
          <UtilizationBar utilization={member.allocation.utilization} />
        </div>

        {/* Quick stats row */}
        <div className="mt-3 flex gap-4 text-xs">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{member.allocation.taskCount}</span> tasks
          </span>
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{member.allocation.totalStoryPoints}</span> points
          </span>
          {member.allocation.overdueCount > 0 && (
            <span className="text-red-500">
              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
              {member.allocation.overdueCount} overdue
            </span>
          )}
          <span className="text-muted-foreground">
            <span className="font-medium text-green-500">{member.allocation.remainingHours}h</span> remaining
          </span>
        </div>

        {/* Project breakdown */}
        {member.byProject.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {member.byProject.map((p: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md px-2 py-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || "#6366f1" }} />
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-medium text-foreground">{p.count}</span>
                {p.hours > 0 && <span className="text-muted-foreground">({p.hours}h)</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: Task list */}
      {expanded && (
        <div className="border-t border-border">
          <div className="p-3 bg-muted/30">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left pb-2 font-medium">Task</th>
                  <th className="text-left pb-2 font-medium">Project</th>
                  <th className="text-center pb-2 font-medium">Priority</th>
                  <th className="text-center pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Est. Hours</th>
                  <th className="text-right pb-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {member.tasks.map((t: any) => (
                  <tr key={t.id} className="border-t border-border/50">
                    <td className="py-2 pr-2">
                      <span className="text-muted-foreground">#{t.taskNumber}</span>{" "}
                      <span className="text-foreground">{t.title}</span>
                    </td>
                    <td className="py-2 pr-2">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.project.color || "#6366f1" }} />
                        <span className="text-muted-foreground">{t.project.name}</span>
                      </span>
                    </td>
                    <td className="py-2 text-center">
                      <span className="inline-flex items-center gap-1 capitalize">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[t.priority] }} />
                        {t.priority}
                      </span>
                    </td>
                    <td className="py-2 text-center capitalize text-muted-foreground">{t.status.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right font-medium">{t.estimateHours || "—"}</td>
                    <td className="py-2 text-right text-muted-foreground">
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                    </td>
                  </tr>
                ))}
                {member.tasks.length === 0 && (
                  <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">No tasks assigned</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}

function CapacityDialog({
  open,
  onOpenChange,
  userId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  workspaceId: string;
}) {
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [workingDays, setWorkingDays] = useState([1, 2, 3, 4, 5]);
  const [timeOffStart, setTimeOffStart] = useState("");
  const [timeOffEnd, setTimeOffEnd] = useState("");

  const { data: capacity } = trpc.resourcePlanning.getCapacity.useQuery(
    { workspaceId, userId: userId || "" },
    { enabled: !!userId, retry: false }
  );

  // Sync capacity data to local state when loaded
  useEffect(() => {
    if (capacity) {
      setHoursPerDay(capacity.hoursPerDay);
      setWorkingDays(capacity.workingDays);
      if (capacity.timeOffStart) setTimeOffStart(new Date(capacity.timeOffStart).toISOString().split("T")[0]);
      if (capacity.timeOffEnd) setTimeOffEnd(new Date(capacity.timeOffEnd).toISOString().split("T")[0]);
    }
  }, [capacity]);

  const utils = trpc.useUtils();
  const updateMutation = trpc.resourcePlanning.updateCapacity.useMutation({
    onSuccess: () => {
      toast.success("Capacity updated");
      utils.resourcePlanning.getOverview.invalidate();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to update capacity"),
  });

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleDay = (day: number) => {
    setWorkingDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = () => {
    if (!userId) return;
    updateMutation.mutate({
      workspaceId,
      userId,
      hoursPerDay,
      workingDays,
      timeOffStart: timeOffStart || null,
      timeOffEnd: timeOffEnd || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Capacity Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div>
            <Label>Hours Per Day</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={hoursPerDay}
              onChange={(e) => setHoursPerDay(Number(e.target.value))}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Working Days</Label>
            <div className="flex gap-2 mt-1.5">
              {dayNames.map((name, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${
                    workingDays.includes(i)
                      ? "bg-blue-600 text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Time Off Start</Label>
              <Input
                type="date"
                value={timeOffStart}
                onChange={(e) => setTimeOffStart(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Time Off End</Label>
              <Input
                type="date"
                value={timeOffEnd}
                onChange={(e) => setTimeOffEnd(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="w-full">
            {updateMutation.isPending ? "Saving..." : "Save Capacity"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Heatmap view
function HeatmapView({ members }: { members: any[] }) {
  const maxUtil = Math.max(...members.map((m) => m.allocation.utilization), 100);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {members.map((m) => {
        const util = m.allocation.utilization;
        const bg =
          util > 100 ? "bg-red-500/20 border-red-500/30" :
          util > 80 ? "bg-yellow-500/20 border-yellow-500/30" :
          util > 50 ? "bg-green-500/20 border-green-500/30" :
          util > 0 ? "bg-blue-500/20 border-blue-500/30" : "bg-muted border-border";

        return (
          <div key={m.user.id} className={`rounded-xl border p-4 ${bg} transition-all`}>
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={m.user.avatarUrl || undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-[10px]">
                  {m.user.name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-foreground truncate">{m.user.name}</span>
            </div>
            <div className="text-center">
              <p className={`text-3xl font-bold ${
                util > 100 ? "text-red-500" : util > 80 ? "text-yellow-500" : "text-green-500"
              }`}>{util}%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {m.allocation.totalAllocatedHours}h / {m.capacity.totalCapacityHours}h
              </p>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{m.allocation.taskCount} tasks</span>
              {m.allocation.overdueCount > 0 && (
                <span className="text-red-500">{m.allocation.overdueCount} overdue</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ResourcePlanningPage() {
  const { workspaceId } = useAuthStore();
  const [dateRange, setDateRange] = useState("2_weeks");
  const [projectFilter, setProjectFilter] = useState("all");
  const [view, setView] = useState<"list" | "heatmap">("list");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [capacityDialogOpen, setCapacityDialogOpen] = useState(false);

  const range = useMemo(() => {
    const now = new Date();
    // Normalize to start of day to prevent constant re-renders
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = dateRange === "1_week" ? 7 : dateRange === "2_weeks" ? 14 : dateRange === "1_month" ? 30 : 90;
    return {
      start: today.toISOString(),
      end: new Date(today.getTime() + days * 86400000).toISOString(),
    };
  }, [dateRange]);

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId, retry: false }
  );

  const { data, isLoading, error } = trpc.resourcePlanning.getOverview.useQuery(
    {
      workspaceId: workspaceId || "",
      startDate: range.start,
      endDate: range.end,
      projectId: projectFilter !== "all" ? projectFilter : undefined,
    },
    { enabled: !!workspaceId, retry: false, refetchOnWindowFocus: false }
  );

  const filteredMembers = useMemo(() => {
    if (!data?.members) return [];
    if (statusFilter === "all") return data.members;
    return data.members.filter((m: any) => m.status === statusFilter);
  }, [data?.members, statusFilter]);

  const handleEditCapacity = (userId: string) => {
    setEditUserId(userId);
    setCapacityDialogOpen(true);
  };

  return (
    <div className="flex-1 overflow-auto">
      <TopBar title="Resource Planning" breadcrumbs={[{ label: "Resource Planning" }]} />
      <div className="p-6 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1_week">Next 1 Week</SelectItem>
              <SelectItem value="2_weeks">Next 2 Weeks</SelectItem>
              <SelectItem value="1_month">Next 1 Month</SelectItem>
              <SelectItem value="3_months">Next 3 Months</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {(projects as any[])?.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="overloaded">Overloaded</SelectItem>
              <SelectItem value="optimal">Optimal</SelectItem>
              <SelectItem value="underloaded">Underloaded</SelectItem>
              <SelectItem value="on_leave">On Leave</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex gap-1">
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("list")}
            >
              List
            </Button>
            <Button
              variant={view === "heatmap" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("heatmap")}
            >
              Heatmap
            </Button>
          </div>
        </div>

        {error ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-red-500/50 mb-4" />
            <p className="text-foreground font-medium">Failed to load resource data</p>
            <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <>
            {/* Summary Cards */}
            <SummaryCards summary={data.summary} />

            {/* Team utilization overview bar */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Team Utilization</span>
                <span className="text-sm text-muted-foreground">
                  {data.summary.totalAllocatedHours}h / {data.summary.totalCapacityHours}h
                </span>
              </div>
              <UtilizationBar utilization={data.summary.avgUtilization} size="lg" />
            </Card>

            {/* Members */}
            {view === "list" ? (
              <div className="space-y-3">
                {filteredMembers.map((m: any) => (
                  <MemberCard key={m.user.id} member={m} onEditCapacity={handleEditCapacity} />
                ))}
                {filteredMembers.length === 0 && (
                  <Card className="p-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No members match the filter</p>
                  </Card>
                )}
              </div>
            ) : (
              <HeatmapView members={filteredMembers} />
            )}
          </>
        ) : null}
      </div>

      {/* Capacity Settings Dialog */}
      <CapacityDialog
        open={capacityDialogOpen}
        onOpenChange={setCapacityDialogOpen}
        userId={editUserId}
        workspaceId={workspaceId || ""}
      />
    </div>
  );
}
