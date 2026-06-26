"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { TaskListSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { AssigneePicker } from "@/components/shared/assignee-picker";
import { DueDate } from "@/components/shared/due-date";
import { FilterBar, type Filters } from "@/components/filters/filter-bar";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { useProjectData } from "@/hooks/use-project-data";
import { trpc } from "@/lib/api/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import type { TaskWithRelations } from "@dkflow/shared";
import type { Priority } from "@dkflow/shared";

type SortKey = "taskNumber" | "title" | "priority" | "dueDate";
type SortDir = "asc" | "desc";
const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

function applyFilters(tasks: TaskWithRelations[], filters: Filters): TaskWithRelations[] {
  return tasks.filter((t) => {
    if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) return false;
    if (filters.assignee.length > 0 && !t.assignees.some((a) => filters.assignee.includes(a.id))) return false;
    if (filters.label.length > 0 && !t.labels.some((l) => filters.label.includes(l.id))) return false;
    if (filters.dueDate) {
      const now = new Date(); const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      if (filters.dueDate === "no-date" && t.dueDate) return false;
      if (filters.dueDate === "overdue" && (!t.dueDate || new Date(t.dueDate) >= today)) return false;
      if (filters.dueDate === "today" && (!t.dueDate || new Date(t.dueDate).toDateString() !== today.toDateString())) return false;
      if (filters.dueDate === "this-week" && (!t.dueDate || new Date(t.dueDate) > endOfWeek || new Date(t.dueDate) < today)) return false;
    }
    return true;
  });
}

export default function ListPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { project, columns, tasks, labels, isLoading } = useProjectData(projectId);
  const utils = trpc.useUtils();
  const refetch = () => utils.board.getColumns.invalidate({ projectId });
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("taskNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<Filters>({ priority: [], assignee: [], label: [], taskType: [], dueDate: null });
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  };

  const toggleCollapse = (colId: string) => {
    setCollapsedCols((prev) => { const next = new Set(prev); next.has(colId) ? next.delete(colId) : next.add(colId); return next; });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sortTasks = useCallback((list: TaskWithRelations[]) => {
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "taskNumber": cmp = a.taskNumber - b.taskNumber; break;
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "priority": cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4); break;
        case "dueDate": {
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1; else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        }
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [sortKey, sortDir]);

  const filteredTasks = useMemo(() => applyFilters(tasks, filters), [tasks, filters]);

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "List" },
  ];

  const members = useMemo(() => {
    const map = new Map<string, TaskWithRelations["assignees"][0]>();
    tasks.forEach((t) => t.assignees.forEach((a) => map.set(a.id, a)));
    return Array.from(map.values());
  }, [tasks]);

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <button onClick={() => handleSort(sortKeyName)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
      {label}
      {sortKey === sortKeyName && <span className="text-primary">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );

  return (
    <>
      <TopBar breadcrumbs={breadcrumbs} showViewSwitcher showFilter currentView="list" onViewChange={handleViewChange} />
      <FilterBar filters={filters} onChange={setFilters} labels={labels} members={members} />
      {isLoading ? (
        <div className="p-6"><TaskListSkeleton /></div>
      ) : filteredTasks.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks found" description="Create a task or adjust your filters to see results." />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b border-border mb-2 sticky top-0 bg-background z-10">
            <div className="w-6" />
            <div className="w-16"><SortHeader label="ID" sortKeyName="taskNumber" /></div>
            <div className="flex-1"><SortHeader label="Title" sortKeyName="title" /></div>
            <div className="w-20"><SortHeader label="Priority" sortKeyName="priority" /></div>
            <div className="w-24">Assignees</div>
            <div className="w-28"><SortHeader label="Due Date" sortKeyName="dueDate" /></div>
            <div className="w-32">Labels</div>
          </div>

          {columns.map((col) => {
            const colTasks = sortTasks(filteredTasks.filter((t) => t.columnId === col.id));
            const collapsed = collapsedCols.has(col.id);
            return (
              <div key={col.id} className="mb-4">
                <button onClick={() => toggleCollapse(col.id)} className="flex items-center gap-2 px-3 py-2 w-full hover:bg-muted/50 rounded-md transition-colors">
                  {collapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color || "#94A3B8" }} />
                  <span className="text-sm font-medium">{col.name}</span>
                  <span className="text-xs text-muted-foreground ml-1">{colTasks.length}</span>
                </button>
                <AnimatePresence>
                  {!collapsed && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                      {colTasks.map((task) => (
                        <div key={task.id} onClick={() => setSelectedTask(task)} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-0">
                          <Checkbox
                            className="flex-shrink-0"
                            checked={selectedTaskIds.includes(task.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                          <span className="w-16 text-xs text-muted-foreground font-mono">{project?.taskIdPrefix || "DK"}-{task.taskNumber}</span>
                          <span className="flex-1 text-sm truncate">{task.title}</span>
                          <div className="w-20"><PriorityBadge priority={task.priority} showLabel /></div>
                          <div className="w-24" onClick={(e) => e.stopPropagation()}>
                            <AssigneePicker taskId={task.id} assignees={task.assignees} workspaceId={project?.workspaceId} onUpdated={refetch} showAssignToMe />
                          </div>
                          <div className="w-28">{task.dueDate && <DueDate date={task.dueDate} status={task.status} compact />}</div>
                          <div className="w-32 flex flex-wrap gap-1">
                            {task.labels.slice(0, 2).map((l) => (
                              <Badge key={l.id} variant="secondary" className="text-[10px] px-1.5 py-0" style={{ backgroundColor: l.color + "20", color: l.color }}>{l.name}</Badge>
                            ))}
                            {task.labels.length > 2 && <span className="text-[10px] text-muted-foreground">+{task.labels.length - 2}</span>}
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
      <TaskDetailSheet task={selectedTask} columns={columns} workspaceId={project?.workspaceId} onClose={() => setSelectedTask(null)} onUpdated={refetch} />
      <BulkActionBar
        selectedIds={selectedTaskIds}
        columns={columns}
        onClear={() => setSelectedTaskIds([])}
        onDone={() => { setSelectedTaskIds([]); refetch(); }}
      />
    </>
  );
}
