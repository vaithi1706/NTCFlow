"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { TaskListSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { AssigneePicker } from "@/components/shared/assignee-picker";
import { trpc } from "@/lib/api/trpc";
import { DueDate } from "@/components/shared/due-date";
import { FilterBar, type Filters } from "@/components/filters/filter-bar";
import { useProjectData } from "@/hooks/use-project-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { ArrowUp, ArrowDown, Columns3, Table2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { AiExcelImport } from "@/components/ai/ai-excel-import";
import type { TaskWithRelations } from "@dkflow/shared";

type SortKey = "taskNumber" | "title" | "status" | "priority" | "dueDate" | "createdAt";
type SortDir = "asc" | "desc";
const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };

interface ColDef { key: string; label: string; width: string; sortable: boolean; sortKey?: SortKey; }

const allColumns: ColDef[] = [
  { key: "taskNumber", label: "ID", width: "w-20", sortable: true, sortKey: "taskNumber" },
  { key: "title", label: "Title", width: "min-w-[200px] flex-1", sortable: true, sortKey: "title" },
  { key: "status", label: "Status", width: "w-28", sortable: true, sortKey: "status" },
  { key: "priority", label: "Priority", width: "w-24", sortable: true, sortKey: "priority" },
  { key: "assignee", label: "Assignee", width: "w-28", sortable: false },
  { key: "dueDate", label: "Due Date", width: "w-28", sortable: true, sortKey: "dueDate" },
  { key: "labels", label: "Labels", width: "w-32", sortable: false },
  { key: "createdAt", label: "Created", width: "w-28", sortable: true, sortKey: "createdAt" },
];

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

export default function TablePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;

  const { project, columns, tasks, labels, isLoading } = useProjectData(projectId);
  const utils = trpc.useUtils();
  const refetch = () => utils.board.getColumns.invalidate({ projectId });
  const [selectedTask, setSelectedTask] = useState<TaskWithRelations | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("taskNumber");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(allColumns.map((c) => c.key)));
  const [filters, setFilters] = useState<Filters>({ priority: [], assignee: [], label: [], taskType: [], dueDate: null });
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  };

  const exportCSV = () => {
    const headers = "Task,Title,Status,Priority,Assignee,Due Date\n";
    const rows = sortedTasks.map((t) =>
      `${project?.taskIdPrefix || "DK"}-${t.taskNumber},"${t.title.replace(/"/g, '""')}",${getColumnName(t.columnId)},${t.priority},${t.assignees.map((a: any) => a.name || a.user?.name || "").join(";")},${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : ""}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project?.name || "tasks"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const members = useMemo(() => {
    const map = new Map<string, TaskWithRelations["assignees"][0]>();
    tasks.forEach((t) => t.assignees.forEach((a) => map.set(a.id, a)));
    return Array.from(map.values());
  }, [tasks]);

  const sortedTasks = useMemo(() => {
    const filtered = applyFilters(tasks, filters);
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "taskNumber": cmp = a.taskNumber - b.taskNumber; break;
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "status": {
          const colA = columns.find((c) => c.id === a.columnId);
          const colB = columns.find((c) => c.id === b.columnId);
          cmp = (colA?.position ?? 0) - (colB?.position ?? 0); break;
        }
        case "priority": cmp = (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4); break;
        case "dueDate": {
          if (!a.dueDate && !b.dueDate) cmp = 0;
          else if (!a.dueDate) cmp = 1; else if (!b.dueDate) cmp = -1;
          else cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        }
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [tasks, sortKey, sortDir, columns, filters]);

  const handleViewChange = (view: string) => { router.push(`/${workspaceSlug}/projects/${projectId}/${view}`); };
  const visibleColumns = allColumns.filter((c) => visibleCols.has(c.key));
  const toggleColumn = (key: string) => {
    setVisibleCols((prev) => { const next = new Set(prev); if (next.has(key)) { if (key !== "title") next.delete(key); } else next.add(key); return next; });
  };
  const getColumnName = (colId: string) => columns.find((c) => c.id === colId)?.name || "Unknown";
  const getColumnColor = (colId: string) => columns.find((c) => c.id === colId)?.color || "#94A3B8";

  const breadcrumbs = [{ label: "DKFlow", href: "/home" }, { label: project?.name || "Project" }, { label: "Table" }];

  return (
    <>
      <TopBar breadcrumbs={breadcrumbs} showViewSwitcher showFilter currentView="table" onViewChange={handleViewChange} />
      <FilterBar filters={filters} onChange={setFilters} labels={labels} members={members} />
      <div className="flex items-center justify-end px-6 py-1 gap-2">
        <AiExcelImport projectId={projectId} onComplete={() => refetch()} />
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground">
              <Columns3 className="h-3.5 w-3.5" /> Columns
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {allColumns.map((col) => (
              <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm">
                <Checkbox checked={visibleCols.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} disabled={col.key === "title"} />
                {col.label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      {isLoading ? (
        <div className="p-6"><TaskListSkeleton /></div>
      ) : sortedTasks.length === 0 ? (
        <EmptyState icon={Table2} title="No tasks found" description="Create a task or adjust your filters." />
      ) : (
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="flex items-center bg-muted/50 border-b border-border">
              <div className="px-3 py-2 w-10 flex-shrink-0">
                <Checkbox
                  checked={selectedTaskIds.length === sortedTasks.length && sortedTasks.length > 0}
                  onCheckedChange={(checked) => {
                    setSelectedTaskIds(checked ? sortedTasks.map((t) => t.id) : []);
                  }}
                />
              </div>
              {visibleColumns.map((col) => (
                <div key={col.key} className={cn("px-3 py-2", col.width, col.key === "title" && "sticky left-0 z-10 bg-muted/50")}>
                  {col.sortable && col.sortKey ? (
                    <button onClick={() => handleSort(col.sortKey!)} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                      {col.label}
                      {sortKey === col.sortKey && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">{col.label}</span>
                  )}
                </div>
              ))}
            </div>
            {sortedTasks.map((task) => (
              <div key={task.id} onClick={() => setSelectedTask(task)} className="flex items-center border-b border-border/50 last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
                <div className="px-3 py-2 w-10 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedTaskIds.includes(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                  />
                </div>
                {visibleColumns.map((col) => (
                  <div key={col.key} className={cn("px-3 py-2", col.width, col.key === "title" && "sticky left-0 z-10 bg-background")}>
                    {col.key === "taskNumber" && <span className="text-xs text-muted-foreground font-mono">{project?.taskIdPrefix || "DK"}-{task.taskNumber}</span>}
                    {col.key === "title" && <span className="text-sm truncate block">{task.title}</span>}
                    {col.key === "status" && <span className="inline-flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: getColumnColor(task.columnId) }} />{getColumnName(task.columnId)}</span>}
                    {col.key === "priority" && <PriorityBadge priority={task.priority} showLabel />}
                    {col.key === "assignee" && (
                      <div onClick={(e) => e.stopPropagation()}>
                        <AssigneePicker taskId={task.id} assignees={task.assignees} workspaceId={project?.workspaceId} onUpdated={refetch} showAssignToMe />
                      </div>
                    )}
                    {col.key === "dueDate" && task.dueDate && <DueDate date={task.dueDate} compact />}
                    {col.key === "labels" && <div className="flex flex-wrap gap-1">{task.labels.slice(0, 2).map((l) => <Badge key={l.id} variant="secondary" className="text-[10px] px-1.5 py-0" style={{ backgroundColor: l.color + "20", color: l.color }}>{l.name}</Badge>)}</div>}
                    {col.key === "createdAt" && <span className="text-xs text-muted-foreground">{format(new Date(task.createdAt), "MMM d, yyyy")}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
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
