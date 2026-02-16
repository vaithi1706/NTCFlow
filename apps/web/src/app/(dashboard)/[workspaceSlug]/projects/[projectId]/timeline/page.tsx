"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { BoardSkeleton } from "@/components/shared/loading-skeleton";
import { FilterBar, type Filters } from "@/components/filters/filter-bar";
import { useProjectData } from "@/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/api/trpc";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format, addDays, addWeeks, addMonths, subWeeks, subMonths,
  differenceInDays, startOfDay, isToday, eachDayOfInterval, startOfWeek,
} from "date-fns";
import type { TaskWithRelations, User } from "@dkflow/shared";

const priorityBarColors: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", none: "bg-muted-foreground/50",
};

function applyFilters(tasks: TaskWithRelations[], filters: Filters): TaskWithRelations[] {
  return tasks.filter((t) => {
    if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) return false;
    if (filters.assignee.length > 0 && !t.assignees.some((a) => filters.assignee.includes(a.id))) return false;
    if (filters.label.length > 0 && !t.labels.some((l) => filters.label.includes(l.id))) return false;
    return true;
  });
}

type ZoomLevel = "day" | "week" | "month";
type GroupBy = "status" | "assignee";

// ─── Dependency Arrow Colors ────────────────────────────
const DEP_COLORS: Record<string, string> = {
  blocks: "#fb923c",      // orange-400
  blocked_by: "#fb923c",  // orange-400
  relates_to: "#60a5fa",  // blue-400
  duplicates: "#a78bfa",  // violet-400
  is_duplicated_by: "#a78bfa",
  clones: "#34d399",      // emerald-400
  is_cloned_from: "#34d399",
};

interface DependencyArrowsProps {
  groups: { id: string; tasks: TaskWithRelations[] }[];
  deps: any[];
  filteredTasks: TaskWithRelations[];
  getBarStyle: (task: TaskWithRelations) => { left: number; width: number; isMilestone: boolean } | null;
  dayWidth: number;
  totalDays: number;
  highlightedTaskIds: Set<string>;
  onHoverDep: (taskIds: string[] | null) => void;
}

const GROUP_HEADER_H = 32; // h-8
const TASK_ROW_H = 36;     // h-9
const HEADER_H = 40;       // h-10 sticky header

function DependencyArrows({ groups, deps, filteredTasks, getBarStyle, dayWidth, totalDays, highlightedTaskIds, onHoverDep }: DependencyArrowsProps) {
  // Build task position map: taskId -> pixel Y center (relative to timeline grid, after the sticky header)
  const taskYMap = useMemo(() => {
    const map = new Map<string, number>();
    let y = 0; // start after header (SVG is positioned after header)
    groups.forEach((g) => {
      y += GROUP_HEADER_H; // group header
      g.tasks.forEach((t) => {
        map.set(t.id, y + TASK_ROW_H / 2);
        y += TASK_ROW_H;
      });
    });
    return map;
  }, [groups]);

  const totalHeight = useMemo(() => {
    let h = 0;
    groups.forEach((g) => { h += GROUP_HEADER_H + g.tasks.length * TASK_ROW_H; });
    return h;
  }, [groups]);

  const filteredTaskIds = useMemo(() => new Set(filteredTasks.map((t) => t.id)), [filteredTasks]);

  const arrows = useMemo(() => {
    return deps.map((dep: any) => {
      // dep has: id, type, task (blocked), dependsOn (blocker)
      // For blocks/blocked_by: arrow from dependsOn (blocker) end → task (blocked) start
      const fromId = dep.dependsOn?.id || dep.dependsOnId;
      const toId = dep.task?.id || dep.taskId;
      if (!fromId || !toId) return null;
      if (!filteredTaskIds.has(fromId) || !filteredTaskIds.has(toId)) return null;

      const fromY = taskYMap.get(fromId);
      const toY = taskYMap.get(toId);
      if (fromY === undefined || toY === undefined) return null;

      const fromTask = filteredTasks.find((t) => t.id === fromId);
      const toTask = filteredTasks.find((t) => t.id === toId);
      if (!fromTask || !toTask) return null;

      const fromBar = getBarStyle(fromTask);
      const toBar = getBarStyle(toTask);
      if (!fromBar || !toBar) return null;

      const x1 = fromBar.left + fromBar.width;
      const x2 = toBar.left;
      const color = DEP_COLORS[dep.type] || "#94a3b8";
      const depType = dep.type as string;

      // Only draw arrows for blocks/blocked_by; for others draw dashed lines
      const isBlocker = depType === "blocks" || depType === "blocked_by";

      // Bezier control point offset
      const dx = Math.abs(x2 - x1);
      const cpOffset = Math.max(20, Math.min(dx * 0.4, 80));

      return {
        id: dep.id,
        fromId,
        toId,
        x1, fromY, x2, toY,
        color,
        isBlocker,
        cpOffset,
        depType,
      };
    }).filter(Boolean) as any[];
  }, [deps, taskYMap, filteredTaskIds, filteredTasks, getBarStyle]);

  if (arrows.length === 0) return null;

  return (
    <svg
      className="absolute left-0 pointer-events-none"
      style={{ top: HEADER_H, width: totalDays * dayWidth, height: totalHeight, zIndex: 5 }}
    >
      <defs>
        {Object.entries(DEP_COLORS).map(([key, color]) => (
          <marker
            key={key}
            id={`arrowhead-${key}`}
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill={color} opacity="0.8" />
          </marker>
        ))}
        {/* Highlighted versions */}
        {Object.entries(DEP_COLORS).map(([key, color]) => (
          <marker
            key={`${key}-hl`}
            id={`arrowhead-${key}-hl`}
            markerWidth="10"
            markerHeight="8"
            refX="10"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 10 4, 0 8" fill={color} />
          </marker>
        ))}
      </defs>
      {arrows.map((a: any) => {
        const isHighlighted = highlightedTaskIds.has(a.fromId) || highlightedTaskIds.has(a.toId);
        const opacity = highlightedTaskIds.size > 0 ? (isHighlighted ? 1 : 0.15) : 0.6;
        const strokeWidth = isHighlighted ? 2.5 : 1.5;
        const markerEnd = `url(#arrowhead-${a.depType}${isHighlighted ? "-hl" : ""})`;

        return (
          <g key={a.id} className="pointer-events-auto" style={{ cursor: "pointer" }}
            onMouseEnter={() => onHoverDep([a.fromId, a.toId])}
            onMouseLeave={() => onHoverDep(null)}
          >
            {/* Invisible wider path for easier hover */}
            <path
              d={`M ${a.x1} ${a.fromY} C ${a.x1 + a.cpOffset} ${a.fromY}, ${a.x2 - a.cpOffset} ${a.toY}, ${a.x2} ${a.toY}`}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
            />
            <path
              d={`M ${a.x1} ${a.fromY} C ${a.x1 + a.cpOffset} ${a.fromY}, ${a.x2 - a.cpOffset} ${a.toY}, ${a.x2} ${a.toY}`}
              fill="none"
              stroke={a.color}
              strokeWidth={strokeWidth}
              opacity={opacity}
              strokeDasharray={a.isBlocker ? undefined : "6 4"}
              markerEnd={a.isBlocker ? markerEnd : undefined}
              className="transition-all duration-150"
            />
            {!a.isBlocker && (
              <circle cx={a.x2} cy={a.toY} r={3} fill={a.color} opacity={opacity} />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function TimelinePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { project, columns, tasks, labels, isLoading } = useProjectData(projectId);
  const { data: allDeps } = trpc.task.getAllDependencies.useQuery(
    { projectId },
    { enabled: !!projectId }
  );
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [viewStart, setViewStart] = useState(startOfWeek(new Date()));
  const [filters, setFilters] = useState<Filters>({ priority: [], assignee: [], label: [], taskType: [], dueDate: null });
  const [showDeps, setShowDeps] = useState(true);
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<Set<string>>(new Set());

  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const members = useMemo(() => {
    const map = new Map<string, TaskWithRelations["assignees"][0]>();
    tasks.forEach((t) => t.assignees.forEach((a) => map.set(a.id, a)));
    return Array.from(map.values());
  }, [tasks]);

  const totalDays = zoom === "day" ? 14 : zoom === "week" ? 28 : 90;
  const viewEnd = addDays(viewStart, totalDays - 1);
  const days = useMemo(() => eachDayOfInterval({ start: viewStart, end: viewEnd }), [viewStart, viewEnd]);
  const dayWidth = zoom === "day" ? 60 : zoom === "week" ? 36 : 12;

  const navigate = (dir: "prev" | "next") => {
    const amount = 1;
    if (dir === "next") {
      setViewStart((d) => zoom === "day" ? addWeeks(d, amount) : zoom === "week" ? addMonths(d, amount) : addMonths(d, 3));
    } else {
      setViewStart((d) => zoom === "day" ? subWeeks(d, amount) : zoom === "week" ? subMonths(d, amount) : subMonths(d, 3));
    }
  };

  const groups = useMemo(() => {
    if (groupBy === "status") {
      return columns.map((col) => ({
        id: col.id, label: col.name, color: col.color || "#94A3B8",
        tasks: filteredTasks.filter((t) => t.columnId === col.id),
      }));
    }
    const memberMap = new Map<string, { user: User; tasks: TaskWithRelations[] }>();
    const unassignedUser: User = { id: "unassigned", name: "Unassigned", email: "", avatarUrl: null, timezone: "", theme: "dark", emailVerified: false, createdAt: "", updatedAt: "" };
    filteredTasks.forEach((t) => {
      if (t.assignees.length === 0) {
        if (!memberMap.has("unassigned")) memberMap.set("unassigned", { user: unassignedUser, tasks: [] });
        memberMap.get("unassigned")!.tasks.push(t);
      } else {
        t.assignees.forEach((a) => {
          if (!memberMap.has(a.id)) memberMap.set(a.id, { user: a, tasks: [] });
          memberMap.get(a.id)!.tasks.push(t);
        });
      }
    });
    return Array.from(memberMap.values()).map(({ user, tasks: ts }) => ({
      id: user.id, label: user.name, color: "#3B82F6", tasks: ts,
    }));
  }, [filteredTasks, columns, groupBy]);

  const getBarStyle = useCallback((task: TaskWithRelations) => {
    const start = task.startDate ? startOfDay(new Date(task.startDate)) : task.dueDate ? startOfDay(new Date(task.dueDate)) : null;
    const end = task.dueDate ? startOfDay(new Date(task.dueDate)) : start;
    if (!start || !end) return null;
    const left = differenceInDays(start, viewStart);
    const width = Math.max(1, differenceInDays(end, start) + 1);
    if (left + width < 0 || left >= totalDays) return null;
    return { left: Math.max(0, left) * dayWidth, width: (Math.min(left + width, totalDays) - Math.max(0, left)) * dayWidth - 4, isMilestone: differenceInDays(end, start) === 0 && !task.startDate };
  }, [viewStart, totalDays, dayWidth]);

  const handleHoverDep = useCallback((taskIds: string[] | null) => {
    setHighlightedTaskIds(taskIds ? new Set(taskIds) : new Set());
  }, []);

  const handleViewChange = (view: string) => { router.push(`/${workspaceSlug}/projects/${projectId}/${view}`); };
  const breadcrumbs = [{ label: "DKFlow", href: "/home" }, { label: project?.name || "Project" }, { label: "Timeline" }];
  const todayOffset = differenceInDays(startOfDay(new Date()), viewStart);

  const depCount = allDeps?.length || 0;

  return (
    <>
      <TopBar breadcrumbs={breadcrumbs} showViewSwitcher showFilter currentView="timeline" onViewChange={handleViewChange} />
      <FilterBar filters={filters} onChange={setFilters} labels={labels} members={members} />
      {isLoading ? <BoardSkeleton /> : (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center gap-3 px-6 py-3 border-b border-border/50">
            <Button variant="outline" size="sm" onClick={() => navigate("prev")}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => setViewStart(startOfWeek(new Date()))}>Today</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("next")}><ChevronRight className="h-4 w-4" /></Button>
            <Select value={zoom} onValueChange={(v) => setZoom(v as ZoomLevel)}>
              <SelectTrigger className="w-24 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="assignee">By Assignee</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <Button
                variant={showDeps ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDeps((v) => !v)}
                className="gap-1.5"
                disabled={depCount === 0}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Dependencies{depCount > 0 ? ` (${depCount})` : ""}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <div className="flex min-w-max">
              <div className="w-48 flex-shrink-0 border-r border-border bg-background sticky left-0 z-20">
                <div className="h-10 border-b border-border" />
                {groups.map((g) => (
                  <div key={g.id}>
                    <div className="h-8 flex items-center gap-2 px-3 border-b border-border/50 bg-muted/30">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                      <span className="text-xs font-medium truncate">{g.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{g.tasks.length}</span>
                    </div>
                    {g.tasks.map((t) => (
                      <div
                        key={t.id}
                        className={cn(
                          "h-9 flex items-center px-3 border-b border-border/30 transition-colors duration-150",
                          highlightedTaskIds.has(t.id) && "bg-primary/10"
                        )}
                      >
                        <span className="text-xs truncate text-muted-foreground">{t.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="relative">
                <div className="flex h-10 border-b border-border sticky top-0 bg-background z-10">
                  {days.map((day, i) => (
                    <div key={i} className={cn("flex-shrink-0 border-r border-border/30 flex items-center justify-center", isToday(day) && "bg-primary/10")} style={{ width: dayWidth }}>
                      <span className={cn("text-[10px]", isToday(day) ? "text-primary font-bold" : "text-muted-foreground")}>
                        {zoom === "day" ? format(day, "EEE d") : format(day, "d")}
                      </span>
                    </div>
                  ))}
                </div>

                {todayOffset >= 0 && todayOffset < totalDays && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-10" style={{ left: todayOffset * dayWidth + dayWidth / 2 }} />
                )}

                {groups.map((g) => (
                  <div key={g.id}>
                    <div className="h-8 border-b border-border/50 bg-muted/10" style={{ width: totalDays * dayWidth }} />
                    {g.tasks.map((task) => {
                      const bar = getBarStyle(task);
                      const isHL = highlightedTaskIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          data-task-id={task.id}
                          className={cn(
                            "h-9 relative border-b border-border/30 transition-colors duration-150",
                            isHL && "bg-primary/10"
                          )}
                          style={{ width: totalDays * dayWidth }}
                        >
                          {bar && !bar.isMilestone && (
                            <button
                              onClick={() => setSelectedTask(task)}
                              className={cn(
                                "absolute top-1.5 h-6 rounded-md transition-all hover:opacity-80 flex items-center px-2",
                                priorityBarColors[task.priority],
                                isHL && "ring-2 ring-white/50 shadow-lg"
                              )}
                              style={{ left: bar.left, width: Math.max(bar.width, 20) }}
                            >
                              <span className="text-[10px] text-white truncate">{task.title}</span>
                            </button>
                          )}
                          {bar && bar.isMilestone && (
                            <button onClick={() => setSelectedTask(task)} className={cn("absolute top-2 h-5 w-5 rounded-full border-2 border-background", priorityBarColors[task.priority])} style={{ left: bar.left }} title={task.title} />
                          )}
                          {!bar && (
                            <div className="absolute inset-0 flex items-center px-2">
                              <span className="text-[10px] text-muted-foreground/50 italic">No dates</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}

                {/* Dependency arrows SVG overlay */}
                {showDeps && allDeps && allDeps.length > 0 && (
                  <DependencyArrows
                    groups={groups}
                    deps={allDeps}
                    filteredTasks={filteredTasks}
                    getBarStyle={getBarStyle}
                    dayWidth={dayWidth}
                    totalDays={totalDays}
                    highlightedTaskIds={highlightedTaskIds}
                    onHoverDep={handleHoverDep}
                  />
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
