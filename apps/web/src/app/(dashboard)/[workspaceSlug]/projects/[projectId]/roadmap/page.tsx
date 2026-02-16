"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { BoardSkeleton } from "@/components/shared/loading-skeleton";
import { useProjectData } from "@/hooks/use-project-data";
import { cn } from "@/lib/utils";
import {
  format, startOfQuarter, addMonths, eachMonthOfInterval, addQuarters,
  differenceInDays, startOfDay, startOfMonth, endOfMonth,
} from "date-fns";
import type { TaskWithRelations } from "@dkflow/shared";

const statusColors: Record<string, string> = {
  todo: "bg-slate-500",
  "in-progress": "bg-blue-500",
  "in_progress": "bg-blue-500",
  done: "bg-green-500",
  cancelled: "bg-red-400",
};

function getStatusColor(columnName: string): string {
  const lower = columnName.toLowerCase().replace(/\s+/g, "_");
  if (lower.includes("done") || lower.includes("complete")) return "bg-green-500";
  if (lower.includes("progress") || lower.includes("review") || lower.includes("doing")) return "bg-blue-500";
  if (lower.includes("todo") || lower.includes("backlog") || lower.includes("open")) return "bg-slate-500";
  if (lower.includes("cancel")) return "bg-red-400";
  return "bg-amber-500";
}

export default function RoadmapPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { project, columns, tasks, isLoading } = useProjectData(projectId);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [startQuarter, setStartQuarter] = useState(startOfQuarter(new Date()));

  const months = useMemo(
    () => eachMonthOfInterval({ start: startQuarter, end: addQuarters(startQuarter, 2) }),
    [startQuarter]
  );

  const viewStart = months[0]!;
  const viewEnd = endOfMonth(months[months.length - 1]!);
  const totalDays = differenceInDays(viewEnd, viewStart) + 1;
  const dayWidth = 4;

  // Group tasks: epics as lanes, tasks with matching parentId as children
  const { epics, ungrouped } = useMemo(() => {
    const epicTasks = tasks.filter((t) => (t as any).type === "epic" || (t as any).taskType === "epic");
    const nonEpics = tasks.filter((t) => (t as any).type !== "epic" && (t as any).taskType !== "epic");

    const epicMap = new Map<string, { epic: TaskWithRelations; children: TaskWithRelations[] }>();

    for (const e of epicTasks) {
      epicMap.set(e.id, { epic: e, children: [] });
    }

    const ungroupedTasks: TaskWithRelations[] = [];
    for (const t of nonEpics) {
      if (t.parentTaskId && epicMap.has(t.parentTaskId)) {
        epicMap.get(t.parentTaskId)!.children.push(t);
      } else {
        ungroupedTasks.push(t);
      }
    }

    return {
      epics: Array.from(epicMap.values()),
      ungrouped: ungroupedTasks,
    };
  }, [tasks]);

  const columnMap = useMemo(() => {
    const m = new Map<string, string>();
    columns.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [columns]);

  const getBarStyle = (task: TaskWithRelations) => {
    const start = task.startDate ? startOfDay(new Date(task.startDate)) : task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
    const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : start;
    if (!start || !end) return null;
    const left = differenceInDays(start, viewStart);
    const width = Math.max(1, differenceInDays(end, start) + 1);
    if (left + width < 0 || left >= totalDays) return null;
    return {
      left: Math.max(0, left) * dayWidth,
      width: (Math.min(left + width, totalDays) - Math.max(0, left)) * dayWidth,
    };
  };

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Roadmap" },
  ];

  return (
    <>
      <TopBar breadcrumbs={breadcrumbs} showViewSwitcher showFilter currentView="roadmap" onViewChange={handleViewChange} />
      {isLoading ? <BoardSkeleton /> : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50">
            <button
              onClick={() => setStartQuarter(addQuarters(startQuarter, -1))}
              className="text-sm px-3 py-1 rounded border border-border hover:bg-muted"
            >
              ← Prev
            </button>
            <span className="text-sm font-medium">
              {format(startQuarter, "QQQ yyyy")} — {format(addQuarters(startQuarter, 1), "QQQ yyyy")}
            </span>
            <button
              onClick={() => setStartQuarter(addQuarters(startQuarter, 1))}
              className="text-sm px-3 py-1 rounded border border-border hover:bg-muted"
            >
              Next →
            </button>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="flex min-w-max">
              {/* Left labels */}
              <div className="w-56 flex-shrink-0 border-r border-border bg-background sticky left-0 z-20">
                <div className="h-10 border-b border-border flex items-center px-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Epics / Tasks</span>
                </div>
                {epics.map(({ epic, children }) => (
                  <div key={epic.id}>
                    <div className="h-10 flex items-center gap-2 px-3 border-b border-border/50 bg-muted/30">
                      <span className="text-xs">🎯</span>
                      <span className="text-xs font-semibold truncate">{epic.title}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{children.length}</span>
                    </div>
                    {children.map((t) => (
                      <div key={t.id} className="h-8 flex items-center px-3 pl-6 border-b border-border/20">
                        <span className="text-xs truncate text-muted-foreground">{t.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {ungrouped.length > 0 && (
                  <div>
                    <div className="h-10 flex items-center gap-2 px-3 border-b border-border/50 bg-muted/30">
                      <span className="text-xs font-semibold text-muted-foreground">Ungrouped</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{ungrouped.length}</span>
                    </div>
                    {ungrouped.map((t) => (
                      <div key={t.id} className="h-8 flex items-center px-3 border-b border-border/20">
                        <span className="text-xs truncate text-muted-foreground">{t.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Timeline area */}
              <div className="relative">
                {/* Month headers */}
                <div className="flex h-10 border-b border-border sticky top-0 bg-background z-10">
                  {months.map((month) => {
                    const mStart = startOfMonth(month);
                    const mEnd = endOfMonth(month);
                    const leftDays = differenceInDays(mStart, viewStart);
                    const widthDays = differenceInDays(mEnd, mStart) + 1;
                    return (
                      <div
                        key={month.toISOString()}
                        className="flex-shrink-0 border-r border-border/50 flex items-center justify-center"
                        style={{ width: widthDays * dayWidth, marginLeft: leftDays === 0 ? 0 : undefined }}
                      >
                        <span className="text-xs font-medium text-muted-foreground">
                          {format(month, "MMM yyyy")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Epic lanes */}
                {epics.map(({ epic, children }) => (
                  <div key={epic.id}>
                    {/* Epic bar */}
                    <div className="h-10 relative border-b border-border/50 bg-muted/10" style={{ width: totalDays * dayWidth }}>
                      {(() => {
                        const bar = getBarStyle(epic);
                        if (!bar) return null;
                        const colName = columnMap.get(epic.columnId) || "";
                        return (
                          <button
                            onClick={() => setSelectedTask(epic)}
                            className={cn(
                              "absolute top-2 h-6 rounded-md flex items-center px-2 opacity-90 hover:opacity-100",
                              getStatusColor(colName)
                            )}
                            style={{ left: bar.left, width: Math.max(bar.width, 40) }}
                          >
                            <span className="text-[10px] text-white truncate font-medium">{epic.title}</span>
                          </button>
                        );
                      })()}
                    </div>
                    {/* Child tasks */}
                    {children.map((t) => {
                      const bar = getBarStyle(t);
                      const colName = columnMap.get(t.columnId) || "";
                      return (
                        <div key={t.id} className="h-8 relative border-b border-border/20" style={{ width: totalDays * dayWidth }}>
                          {bar ? (
                            <button
                              onClick={() => setSelectedTask(t)}
                              className={cn(
                                "absolute top-1.5 h-5 rounded flex items-center px-1.5 opacity-80 hover:opacity-100",
                                getStatusColor(colName)
                              )}
                              style={{ left: bar.left, width: Math.max(bar.width, 20) }}
                            >
                              <span className="text-[9px] text-white truncate">{t.title}</span>
                            </button>
                          ) : (
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[9px] text-muted-foreground/40 italic">No dates</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Ungrouped */}
                {ungrouped.length > 0 && (
                  <div>
                    <div className="h-10 border-b border-border/50 bg-muted/10" style={{ width: totalDays * dayWidth }} />
                    {ungrouped.map((t) => {
                      const bar = getBarStyle(t);
                      const colName = columnMap.get(t.columnId) || "";
                      return (
                        <div key={t.id} className="h-8 relative border-b border-border/20" style={{ width: totalDays * dayWidth }}>
                          {bar ? (
                            <button
                              onClick={() => setSelectedTask(t)}
                              className={cn(
                                "absolute top-1.5 h-5 rounded flex items-center px-1.5 opacity-80 hover:opacity-100",
                                getStatusColor(colName)
                              )}
                              style={{ left: bar.left, width: Math.max(bar.width, 20) }}
                            >
                              <span className="text-[9px] text-white truncate">{t.title}</span>
                            </button>
                          ) : (
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[9px] text-muted-foreground/40 italic">No dates</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No data fallback */}
                {epics.length === 0 && ungrouped.length === 0 && (
                  <div className="flex items-center justify-center py-20" style={{ width: totalDays * dayWidth }}>
                    <div className="text-center">
                      <p className="text-lg">🗺️</p>
                      <p className="text-sm text-muted-foreground mt-2">No tasks yet. Create epics and tasks to see your roadmap.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <TaskDetailSheet task={selectedTask} columns={columns} workspaceId={project?.workspaceId} onClose={() => setSelectedTask(null)} />
    </>
  );
}
