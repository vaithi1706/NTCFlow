"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TaskTypeBadge } from "@/components/shared/task-type-badge";
import { PriorityBadge } from "@/components/shared/priority-badge";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowRight,
  GripVertical,
  Loader2,
} from "lucide-react";
import { AiSprintPlan } from "@/components/ai/ai-sprint-plan";
import { AiMeetingNotes } from "@/components/ai/ai-meeting-notes";
import { AiExcelImport } from "@/components/ai/ai-excel-import";
import { format } from "date-fns";

export default function BacklogPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { workspaceId } = useAuthStore();

  const [sprintExpanded, setSprintExpanded] = useState(true);
  const [backlogExpanded, setBacklogExpanded] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [addingBacklog, setAddingBacklog] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();

  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  const { data: sprints } = trpc.sprint.list.useQuery({ projectId });
  const { data: backlogTasks, isLoading: backlogLoading } = trpc.task.getBacklog.useQuery({ projectId, search: search || undefined });
  const { data: columns } = trpc.board.getColumns.useQuery({ projectId });

  const activeSprint = sprints?.find((s: any) => s.isActive);

  const createMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      utils.task.getBacklog.invalidate({ projectId });
      setNewTitle("");
      setAddingBacklog(false);
    },
  });

  const addToSprintMutation = trpc.task.addToSprint.useMutation({
    onSuccess: () => {
      utils.task.getBacklog.invalidate({ projectId });
      utils.sprint.list.invalidate({ projectId });
      setSelectedIds([]);
    },
  });

  const removeFromSprintMutation = trpc.task.removeFromSprint.useMutation({
    onSuccess: () => {
      utils.task.getBacklog.invalidate({ projectId });
      utils.sprint.list.invalidate({ projectId });
    },
  });

  const handleCreateBacklogTask = () => {
    if (!newTitle.trim() || !columns?.[0]) return;
    createMutation.mutate({ title: newTitle.trim(), columnId: columns[0].id, projectId });
  };

  const handleMoveToSprint = () => {
    if (!activeSprint || selectedIds.length === 0) return;
    for (const taskId of selectedIds) {
      addToSprintMutation.mutate({ taskId, sprintId: activeSprint.id });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  // Sprint stats
  const sprintTasks = activeSprint?.tasks || [];
  const sprintTotalPts = sprintTasks.reduce((s: number, st: any) => s + (st.task?.storyPoints || 0), 0);
  const sprintDonePts = sprintTasks
    .filter((st: any) => st.task?.status === "done" || st.task?.status === "cancelled")
    .reduce((s: number, st: any) => s + (st.task?.storyPoints || 0), 0);
  const sprintProgress = sprintTasks.length > 0
    ? Math.round((sprintTasks.filter((st: any) => st.task?.status === "done").length / sprintTasks.length) * 100)
    : 0;

  // Backlog stats
  const backlogPts = (backlogTasks || []).reduce((s: number, t: any) => s + (t.storyPoints || 0), 0);

  const breadcrumbs = [
    { label: "DKFlow", href: "/home" },
    { label: project?.name || "Project" },
    { label: "Backlog" },
  ];

  const TaskRow = ({ task, showRemove, sprintId }: { task: any; showRemove?: boolean; sprintId?: string }) => {
    const prefix = project?.taskPrefix || "DK";
    const isSelected = selectedIds.includes(task.id);
    return (
      <div className="flex items-center gap-2 px-3 py-2 hover:bg-muted/30 border-b border-border/50 group transition-colors">
        {!showRemove && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => toggleSelect(task.id)}
            className="flex-shrink-0"
          />
        )}
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
        <TaskTypeBadge type={task.type || "task"} />
        <span className="text-xs text-muted-foreground font-mono w-16 flex-shrink-0">
          {prefix}-{task.taskNumber}
        </span>
        <span className="text-sm flex-1 truncate">{task.title}</span>
        <PriorityBadge priority={task.priority} />
        {task.assignees?.[0]?.user && (
          <Avatar className="h-5 w-5 flex-shrink-0">
            <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
              {task.assignees[0].user.name?.split(" ").map((n: string) => n[0]).join("")}
            </AvatarFallback>
          </Avatar>
        )}
        {task.storyPoints != null && task.storyPoints > 0 && (
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {task.storyPoints} SP
          </Badge>
        )}
        {showRemove && sprintId && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs opacity-0 group-hover:opacity-100 text-muted-foreground"
            onClick={() => removeFromSprintMutation.mutate({ taskId: task.id, sprintId })}
          >
            Remove
          </Button>
        )}
        {!showRemove && activeSprint && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs opacity-0 group-hover:opacity-100 text-muted-foreground"
            onClick={() => addToSprintMutation.mutate({ taskId: task.id, sprintId: activeSprint.id })}
          >
            <ArrowRight className="h-3 w-3 mr-1" />Sprint
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <TopBar
        breadcrumbs={breadcrumbs}
        showViewSwitcher
        showFilter
        currentView="backlog"
        onViewChange={handleViewChange}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Search */}
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search backlog..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-8 text-sm"
          />
          <div className="flex-1" />
          <AiExcelImport projectId={projectId} onComplete={() => utils.task.getBacklog.invalidate({ projectId })} />
          <AiMeetingNotes projectId={projectId} />
          <AiSprintPlan
            projectId={projectId}
            backlogTasks={(backlogTasks || []).map((t: any) => ({ id: t.id, title: t.title, priority: t.priority, storyPoints: t.storyPoints }))}
            activeSprintId={activeSprint?.id}
            onAddToSprint={(taskIds) => {
              if (!activeSprint) return;
              for (const taskId of taskIds) {
                addToSprintMutation.mutate({ taskId, sprintId: activeSprint.id });
              }
            }}
          />
          <span className="text-xs text-muted-foreground">
            Backlog: {backlogTasks?.length || 0} tasks · {backlogPts} pts
          </span>
        </div>

        {/* Bulk actions */}
        {selectedIds.length > 0 && activeSprint && (
          <div className="flex items-center gap-3 p-2 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-sm font-medium">{selectedIds.length} selected</span>
            <Button size="sm" className="h-7" onClick={handleMoveToSprint}>
              <ArrowRight className="h-3 w-3 mr-1" />Move to {activeSprint.name}
            </Button>
            <Button variant="ghost" size="sm" className="h-7" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        )}

        {/* Active Sprint Section */}
        {activeSprint && (
          <div className="rounded-lg border border-border bg-card">
            <button
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/30 transition-colors"
              onClick={() => setSprintExpanded(!sprintExpanded)}
            >
              {sprintExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="text-sm font-semibold flex-1 text-left">{activeSprint.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(activeSprint.startDate), "MMM d")} – {format(new Date(activeSprint.endDate), "MMM d")}
              </span>
              <span className="text-xs text-muted-foreground mx-2">
                {sprintTasks.length} tasks · {sprintTotalPts} pts
              </span>
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${sprintProgress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground ml-1">{sprintProgress}%</span>
            </button>
            {sprintExpanded && (
              <div className="border-t border-border">
                {sprintTasks.map((st: any) => (
                  <TaskRow key={st.task.id} task={st.task} showRemove sprintId={activeSprint.id} />
                ))}
                {sprintTasks.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No tasks in sprint. Drag or move tasks from backlog.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Backlog Section */}
        <div className="rounded-lg border border-border bg-card">
          <button
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted/30 transition-colors"
            onClick={() => setBacklogExpanded(!backlogExpanded)}
          >
            {backlogExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <span className="text-sm font-semibold flex-1 text-left">Backlog</span>
            <span className="text-xs text-muted-foreground">
              {backlogTasks?.length || 0} tasks · {backlogPts} pts
            </span>
          </button>
          {backlogExpanded && (
            <div className="border-t border-border">
              {backlogLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {(backlogTasks || []).map((task: any) => (
                    <TaskRow key={task.id} task={task} />
                  ))}
                  {(!backlogTasks || backlogTasks.length === 0) && !addingBacklog && (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No tasks in backlog
                    </div>
                  )}
                </>
              )}
              {/* Create task */}
              {addingBacklog ? (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
                  <Input
                    placeholder="Task title..."
                    className="h-7 text-sm flex-1"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateBacklogTask();
                      if (e.key === "Escape") { setAddingBacklog(false); setNewTitle(""); }
                    }}
                    autoFocus
                  />
                  <Button size="sm" className="h-7" onClick={handleCreateBacklogTask} disabled={createMutation.isPending}>
                    Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { setAddingBacklog(false); setNewTitle(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted/30 border-t border-border/50 transition-colors"
                  onClick={() => setAddingBacklog(true)}
                >
                  <Plus className="h-3.5 w-3.5" />Create task
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
