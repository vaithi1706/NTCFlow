"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { BoardView } from "@/components/board/board-view";
import { TaskDetailSheet } from "@/components/board/task-detail-sheet";
import { BoardSkeleton } from "@/components/shared/loading-skeleton";
import { FilterBar, type Filters } from "@/components/filters/filter-bar";
import { trpc } from "@/lib/api/trpc";
import { useProjectData } from "@/hooks/use-project-data";
import { useSocket } from "@/hooks/use-socket";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { useAuthStore } from "@/stores/auth-store";
import { isToday, isThisWeek, isPast } from "date-fns";
import { AiExcelImport } from "@/components/ai/ai-excel-import";
import { AiNaturalTask } from "@/components/ai/ai-natural-task";
import { AiAutoStandup } from "@/components/ai/ai-auto-standup";
import { AiWorkflowOptimizer } from "@/components/ai/ai-workflow-optimizer";
import { AiTemplateSuggestions } from "@/components/ai/ai-template-suggestions";
import { AiTranscriptParser } from "@/components/ai/ai-transcript-parser";

const emptyFilters: Filters = { priority: [], assignee: [], label: [], taskType: [], dueDate: null };

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { workspaceId } = useAuthStore();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState("board");
  const [showFilterBar, setShowFilterBar] = useState(false);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

  const { project, columns, tasks, isLoading } = useProjectData(projectId);
  useSocket(projectId);

  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const { data: labels } = trpc.label.list.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();
  const refetchBoard = () => {
    utils.board.getColumns.invalidate({ projectId });
    // Dashboard stats and activity feed depend on task counts/status -- refresh them
    // so the home page Overdue / Completed widgets reflect this change immediately.
    utils.stats.invalidate();
    utils.activity.invalidate();
  };

  const moveMutation = trpc.task.move.useMutation({
    onSuccess: () => refetchBoard(),
  });

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => refetchBoard(),
  });

  const handleTaskCreate = useCallback(
    async (title: string, columnId: string) => {
      await createMutation.mutateAsync({ title, columnId, projectId });
    },
    [createMutation, projectId]
  );

  const handleTaskMove = useCallback(
    (taskId: string, newColumnId: string, newPosition: number) => {
      moveMutation.mutate({ taskId, columnId: newColumnId, position: newPosition });
    },
    [moveMutation]
  );

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  // Apply filters to tasks
  const hasActiveFilters = filters.priority.length > 0 || filters.assignee.length > 0 || filters.label.length > 0 || filters.taskType.length > 0 || filters.dueDate !== null;

  const filteredTasks = useMemo(() => {
    if (!hasActiveFilters) return tasks;
    return tasks.filter((task: any) => {
      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(task.priority)) return false;
      // Assignee filter — transformTask maps assignees to { id, name, ... }
      if (filters.assignee.length > 0) {
        const taskAssigneeIds = (task.assignees || []).map((a: any) => a.id);
        if (!filters.assignee.some((id: string) => taskAssigneeIds.includes(id))) return false;
      }
      // Label filter — transformTask maps labels to { id, name, color }
      if (filters.label.length > 0) {
        const taskLabelIds = (task.labels || []).map((l: any) => l.id);
        if (!filters.label.some((id: string) => taskLabelIds.includes(id))) return false;
      }
      // Task type filter
      if (filters.taskType.length > 0 && !filters.taskType.includes((task as any).type || "task")) return false;
      // Due date filter
      if (filters.dueDate) {
        const due = task.dueDate ? new Date(task.dueDate) : null;
        if (filters.dueDate === "no-date" && due) return false;
        if (filters.dueDate === "overdue" && (!due || !isPast(due) || isToday(due))) return false;
        if (filters.dueDate === "today" && (!due || !isToday(due))) return false;
        if (filters.dueDate === "this-week" && (!due || !isThisWeek(due))) return false;
      }
      return true;
    });
  }, [tasks, filters, hasActiveFilters]);

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Board" },
  ];

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) || null : null;

  const memberUsers = members?.map((m: any) => m.user || m).filter(Boolean) || [];

  return (
    <>
      <TopBar
        breadcrumbs={breadcrumbs}
        showViewSwitcher
        showFilter
        currentView={currentView}
        onViewChange={handleViewChange}
        onFilterClick={() => setShowFilterBar(!showFilterBar)}
        filterActive={hasActiveFilters}
      />
      {showFilterBar && (
        <div className="border-b border-border bg-card px-4 py-2">
          <FilterBar
            filters={filters}
            onChange={setFilters}
            labels={labels || []}
            members={memberUsers}
          />
        </div>
      )}
      <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-border/50 overflow-x-auto scrollbar-none">
        <AiNaturalTask projectId={projectId} onCreated={() => refetchBoard()} />
        <AiExcelImport projectId={projectId} onComplete={() => refetchBoard()} />
        <AiAutoStandup projectId={projectId} />
        <AiWorkflowOptimizer projectId={projectId} />
        <AiTemplateSuggestions projectId={projectId} workspaceId={workspaceId || ""} />
        <AiTranscriptParser projectId={projectId} onTasksCreated={() => refetchBoard()} />
      </div>
      {isLoading ? (
        <BoardSkeleton />
      ) : (
        <BoardView
          columns={columns}
          tasks={filteredTasks}
          project={project}
          onTaskClick={(task) => setSelectedTaskId(task.id)}
          onTaskCreate={handleTaskCreate}
          onTaskMove={handleTaskMove}
          onUpdated={() => refetchBoard()}
        />
      )}
      <TaskDetailSheet
        task={selectedTask}
        columns={columns}
        workspaceId={project?.workspaceId}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={() => refetchBoard()}
      />
      <BulkActionBar
        selectedIds={selectedTaskIds}
        columns={columns}
        onClear={() => setSelectedTaskIds([])}
        onDone={() => { setSelectedTaskIds([]); refetchBoard(); }}
      />
    </>
  );
}
