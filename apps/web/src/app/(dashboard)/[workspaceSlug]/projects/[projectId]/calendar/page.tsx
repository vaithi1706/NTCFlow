"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { BoardSkeleton } from "@/components/shared/loading-skeleton";
import { FilterBar, type Filters } from "@/components/filters/filter-bar";
import { useProjectData } from "@/hooks/use-project-data";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday, addMonths, subMonths,
} from "date-fns";
import type { TaskWithRelations } from "@dkflow/shared";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/20 border-red-500/40 text-red-400",
  high: "bg-orange-500/20 border-orange-500/40 text-orange-400",
  medium: "bg-amber-500/20 border-amber-500/40 text-amber-400",
  low: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  none: "bg-muted border-border text-muted-foreground",
};

function applyFilters(tasks: TaskWithRelations[], filters: Filters): TaskWithRelations[] {
  return tasks.filter((t) => {
    if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) return false;
    if (filters.assignee.length > 0 && !t.assignees.some((a) => filters.assignee.includes(a.id))) return false;
    if (filters.label.length > 0 && !t.labels.some((l) => filters.label.includes(l.id))) return false;
    return true;
  });
}

export default function CalendarPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { project, columns, tasks, labels, isLoading } = useProjectData(projectId);
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filters, setFilters] = useState<Filters>({ priority: [], assignee: [], label: [], taskType: [], dueDate: null });

  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    return eachDayOfInterval({ start: startOfWeek(monthStart), end: endOfWeek(monthEnd) });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    filteredTasks.forEach((t) => {
      if (t.dueDate) {
        const key = format(new Date(t.dueDate), "yyyy-MM-dd");
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(t);
      }
    });
    return map;
  }, [filteredTasks]);

  const members = useMemo(() => {
    const map = new Map<string, TaskWithRelations["assignees"][0]>();
    tasks.forEach((t) => t.assignees.forEach((a) => map.set(a.id, a)));
    return Array.from(map.values());
  }, [tasks]);

  const handleViewChange = (view: string) => { router.push(`/${workspaceSlug}/projects/${projectId}/${view}`); };
  const breadcrumbs = [{ label: "DKFlow", href: "/home" }, { label: project?.name || "Project" }, { label: "Calendar" }];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <TopBar breadcrumbs={breadcrumbs} showViewSwitcher showFilter currentView="calendar" onViewChange={handleViewChange} />
      <FilterBar filters={filters} onChange={setFilters} labels={labels} members={members} />
      {isLoading ? <BoardSkeleton /> : (
        <div className="flex-1 overflow-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h2>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-7 bg-muted/50 border-b border-border">
              {weekDays.map((d) => <div key={d} className="px-2 py-2 text-xs font-medium text-muted-foreground text-center">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDate.get(dateKey) || [];
                const inMonth = isSameMonth(day, currentMonth);
                const today = isToday(day);
                return (
                  <div key={i} className={cn("min-h-[100px] border-b border-r border-border/50 p-1.5 transition-colors", !inMonth && "bg-muted/20", today && "bg-primary/5")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-xs font-medium h-6 w-6 flex items-center justify-center rounded-full", today && "bg-primary text-primary-foreground", !inMonth && "text-muted-foreground/50")}>{format(day, "d")}</span>
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <button key={task.id} onClick={() => setSelectedTask(task)} className={cn("w-full text-left px-1.5 py-0.5 rounded text-[11px] truncate border transition-colors hover:opacity-80", priorityColors[task.priority] || priorityColors.none)}>{task.title}</button>
                      ))}
                      {dayTasks.length > 3 && <span className="text-[10px] text-muted-foreground px-1.5">+{dayTasks.length - 3} more</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      <TaskDetailSheet task={selectedTask} columns={columns} workspaceId={project?.workspaceId} onClose={() => setSelectedTask(null)} />
    </>
  );
}
