"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { useProjectData } from "@/hooks/use-project-data";
import { AiProjectSummary } from "@/components/ai/ai-project-summary";
import { AiHealthScore } from "@/components/ai/ai-health-score";
import { Plus, MoreHorizontal, Trash2, ArrowUp, ArrowDown, Maximize2, Minimize2 } from "lucide-react";
import { PdfExportButton } from "@/components/shared/pdf-export-button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

import { TaskSummaryWidget } from "@/components/dashboard/TaskSummaryWidget";
import { PriorityPieChart } from "@/components/dashboard/PriorityPieChart";
import { StatusBreakdownWidget } from "@/components/dashboard/StatusBreakdownWidget";
import { TypeBreakdownWidget } from "@/components/dashboard/TypeBreakdownWidget";
import { RecentlyCreatedWidget } from "@/components/dashboard/RecentlyCreatedWidget";
import { OverdueTasksWidget } from "@/components/dashboard/OverdueTasksWidget";
import { AssigneeWorkloadWidget } from "@/components/dashboard/AssigneeWorkloadWidget";
import { ActivityStreamWidget } from "@/components/dashboard/ActivityStreamWidget";
import { CompletionTrendWidget } from "@/components/dashboard/CompletionTrendWidget";
import { SprintHealthWidget } from "@/components/dashboard/SprintHealthWidget";
import { VelocityWidget } from "@/components/dashboard/VelocityWidget";
import { BurndownWidget } from "@/components/dashboard/BurndownWidget";

const WIDGET_CATALOG = [
  { type: "task_summary", name: "Task Summary", desc: "Overview of total, in progress, done, and overdue tasks", icon: "📊" },
  { type: "priority_breakdown", name: "Priority Breakdown", desc: "Pie chart of tasks by priority level", icon: "🎯" },
  { type: "status_breakdown", name: "Status Breakdown", desc: "Stacked bar of tasks by status", icon: "📶" },
  { type: "type_breakdown", name: "Type Breakdown", desc: "Bar chart of tasks by type", icon: "🏷️" },
  { type: "recently_created", name: "Recently Created", desc: "Latest 10 created tasks", icon: "🆕" },
  { type: "overdue_tasks", name: "Overdue Tasks", desc: "Tasks past their due date", icon: "⚠️" },
  { type: "assignee_workload", name: "Assignee Workload", desc: "Active tasks per team member", icon: "👥" },
  { type: "activity_stream", name: "Activity Stream", desc: "Recent project activity feed", icon: "📰" },
  { type: "completion_trend", name: "Completion Trend", desc: "Tasks completed per day over 30 days", icon: "📈" },
  { type: "sprint_health", name: "Sprint Health", desc: "Active sprint progress and days remaining", icon: "🏃" },
  { type: "velocity", name: "Velocity", desc: "Points completed per sprint", icon: "🚀" },
  { type: "burndown", name: "Burndown Chart", desc: "Remaining tasks over time", icon: "📉" },
] as const;

const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ projectId: string }>> = {
  task_summary: TaskSummaryWidget,
  priority_breakdown: PriorityPieChart,
  status_breakdown: StatusBreakdownWidget,
  type_breakdown: TypeBreakdownWidget,
  recently_created: RecentlyCreatedWidget,
  overdue_tasks: OverdueTasksWidget,
  assignee_workload: AssigneeWorkloadWidget,
  activity_stream: ActivityStreamWidget,
  completion_trend: CompletionTrendWidget,
  sprint_health: SprintHealthWidget,
  velocity: VelocityWidget,
  burndown: BurndownWidget,
};

const WIDGET_TITLES: Record<string, string> = Object.fromEntries(WIDGET_CATALOG.map((w) => [w.type, w.name]));

const WIDTH_CLASSES: Record<string, string> = {
  full: "col-span-full",
  half: "col-span-full md:col-span-1",
  third: "col-span-full md:col-span-1 lg:col-span-1",
};

export default function DashboardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { project } = useProjectData(projectId);
  const [addOpen, setAddOpen] = useState(false);

  const utils = trpc.useUtils();
  const { data: widgets, isLoading } = trpc.dashboard.getWidgets.useQuery({ projectId });
  const createDefaults = trpc.dashboard.createDefaults.useMutation({
    onSuccess: () => utils.dashboard.getWidgets.invalidate({ projectId }),
  });
  const addWidget = trpc.dashboard.addWidget.useMutation({
    onSuccess: () => { utils.dashboard.getWidgets.invalidate({ projectId }); setAddOpen(false); },
  });
  const removeWidget = trpc.dashboard.removeWidget.useMutation({
    onSuccess: () => utils.dashboard.getWidgets.invalidate({ projectId }),
  });
  const updateWidget = trpc.dashboard.updateWidget.useMutation({
    onSuccess: () => utils.dashboard.getWidgets.invalidate({ projectId }),
  });
  const reorderWidgets = trpc.dashboard.reorderWidgets.useMutation({
    onSuccess: () => utils.dashboard.getWidgets.invalidate({ projectId }),
  });

  // Create defaults on first load if no widgets
  useEffect(() => {
    if (widgets && widgets.length === 0) {
      createDefaults.mutate({ projectId });
    }
  }, [widgets]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleViewChange = (view: string) => router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);

  const moveWidget = useCallback((idx: number, dir: -1 | 1) => {
    if (!widgets) return;
    const target = idx + dir;
    if (target < 0 || target >= widgets.length) return;
    const updated = widgets.map((w, i) => {
      if (i === idx) return { id: w.id, position: target };
      if (i === target) return { id: w.id, position: idx };
      return { id: w.id, position: i };
    });
    reorderWidgets.mutate({ widgets: updated });
  }, [widgets, reorderWidgets]);

  const cycleWidth = useCallback((id: string, current: string) => {
    const order = ["half", "full", "third"];
    const next = order[(order.indexOf(current) + 1) % order.length]!;
    updateWidget.mutate({ id, width: next as "half" | "full" | "third" });
  }, [updateWidget]);

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: project?.name || "Project" }, { label: "Dashboard" }]} showViewSwitcher currentView="dashboard" onViewChange={handleViewChange} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6" id="dashboard-content">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Customizable project overview</p>
          </div>
          <PdfExportButton targetId="dashboard-content" filename={`${project?.name || "dashboard"}-report`} className="mr-2" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Widget</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add Widget</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 mt-2">
                {WIDGET_CATALOG.map((w) => (
                  <button
                    key={w.type}
                    onClick={() => addWidget.mutate({ type: w.type as any, projectId, width: w.type === "task_summary" || w.type === "activity_stream" ? "full" : "half" })}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 text-left transition-colors"
                  >
                    <span className="text-xl">{w.icon}</span>
                    <div>
                      <p className="text-sm font-medium">{w.name}</p>
                      <p className="text-xs text-muted-foreground">{w.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-5 h-48 animate-pulse bg-muted/30" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {widgets?.map((widget, idx) => {
              const Component = WIDGET_COMPONENTS[widget.type];
              if (!Component) return null;
              return (
                <Card key={widget.id} className={`p-4 ${WIDTH_CLASSES[widget.width] || WIDTH_CLASSES.half}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium">{widget.title || WIDGET_TITLES[widget.type] || widget.type}</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => moveWidget(idx, -1)} disabled={idx === 0}>
                          <ArrowUp className="h-3.5 w-3.5 mr-2" />Move Up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => moveWidget(idx, 1)} disabled={idx === (widgets?.length || 1) - 1}>
                          <ArrowDown className="h-3.5 w-3.5 mr-2" />Move Down
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => cycleWidth(widget.id, widget.width)}>
                          {widget.width === "full" ? <Minimize2 className="h-3.5 w-3.5 mr-2" /> : <Maximize2 className="h-3.5 w-3.5 mr-2" />}
                          Resize ({widget.width === "full" ? "→ third" : widget.width === "half" ? "→ full" : "→ half"})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => removeWidget.mutate({ id: widget.id })} className="text-red-400">
                          <Trash2 className="h-3.5 w-3.5 mr-2" />Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <Component projectId={projectId} />
                </Card>
              );
            })}
          </div>
        )}

        <AiHealthScore projectId={projectId} />
        <AiProjectSummary projectId={projectId} />
      </div>
    </>
  );
}
