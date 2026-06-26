"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { AssigneePicker } from "@/components/shared/assignee-picker";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { DueDate } from "@/components/shared/due-date";
import { TaskTypeBadge, TASK_TYPES, type TaskType } from "@/components/shared/task-type-badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Calendar, Clock, Copy, MoreHorizontal, Plus, UserPlus, Check, User,
  Trash2, MessageSquare, Paperclip, CheckSquare, Activity,
  Archive, ExternalLink, Loader2, X, ListTree, SmilePlus,
  Upload, Download, FileIcon, Repeat, GitBranch, GitCommit as GitCommitIcon,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { AiTaskHelper } from "@/components/ai/ai-task-helper";
import { AiBreakdownDialog } from "@/components/ai/ai-breakdown-dialog";
import { AiEstimateButton } from "@/components/ai/ai-estimate-button";
import { AiAutoTriage } from "@/components/ai/ai-auto-triage";
import { AiPredictDueDate } from "@/components/ai/ai-predict-due-date";
import { AiCommentSummary } from "@/components/ai/ai-comment-summary";
import { AiTextCopilot } from "@/components/ai/ai-text-copilot";
import { AiDuplicateLive } from "@/components/ai/ai-duplicate-live";
import { TaskApproval } from "@/components/shared/task-approval";
import { MentionTextarea } from "@/components/shared/mention-textarea";
import { TaskLinks } from "@/components/tasks/task-links";
import { TaskDocuments } from "@/components/documents/task-documents";
import { TaskWatchers } from "@/components/tasks/task-watchers";
import { VoteButton } from "@/components/shared/vote-button";
import { SlaIndicator } from "@/components/shared/sla-indicator";
import { trpc, trpcVanilla } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import type { BoardColumn, TaskWithRelations } from "@dkflow/shared";
import type { Priority } from "@dkflow/shared";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

// Lazy load markdown
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface TaskDetailSheetProps {
  task: TaskWithRelations | null;
  columns: BoardColumn[];
  workspaceId?: string;
  onClose: () => void;
  onUpdated?: () => void;
}

const priorities: Priority[] = ["urgent", "high", "medium", "low", "none"];

export function TaskDetailSheet({ task, columns, workspaceId, onClose, onUpdated }: TaskDetailSheetProps) {
  const [newComment, setNewComment] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionValue, setDescriptionValue] = useState("");
  const { user: currentUser } = useAuthStore();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [checklistTitle, setChecklistTitle] = useState("");
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newItemContent, setNewItemContent] = useState<Record<string, string>>({});
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [logTimeOpen, setLogTimeOpen] = useState(false);
  const [timeHours, setTimeHours] = useState("");
  const [timeDesc, setTimeDesc] = useState("");

  const utils = trpc.useUtils();

  const { data: fullTask } = trpc.task.getById.useQuery(
    { id: task?.id! },
    { enabled: !!task?.id }
  );

  const comments = fullTask?.comments || [];
  const checklists = fullTask?.checklists || [];
  const subtasks = (fullTask as any)?.subtasks || [];

  const projectId = task?.projectId;
  const { data: projectLabels } = trpc.label.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && labelPopoverOpen }
  );

  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      onUpdated?.();
      utils.task.getById.invalidate({ id: task?.id! });
      // Status / due date / assignee changes affect home-page dashboard counts.
      utils.stats.invalidate();
      utils.activity.invalidate();
      toast.success("Task updated");
    },
  });

  const deleteMutation = trpc.task.delete.useMutation({
    onSuccess: () => {
      onUpdated?.();
      onClose();
      // Total task counts changed.
      utils.stats.invalidate();
      utils.activity.invalidate();
      toast.success("Task deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const addLabelMutation = trpc.task.addLabel.useMutation({
    onSuccess: () => {
      onUpdated?.();
      utils.task.getById.invalidate({ id: task?.id! });
    },
  });

  const removeLabelMutation = trpc.task.removeLabel.useMutation({
    onSuccess: () => {
      onUpdated?.();
      utils.task.getById.invalidate({ id: task?.id! });
    },
  });

  const checklistCreateMutation = trpc.checklist.create.useMutation({
    onSuccess: () => {
      utils.task.getById.invalidate({ id: task?.id! });
      setChecklistTitle("");
      setAddingChecklist(false);
      toast.success("Checklist added");
    },
  });

  const checklistAddItemMutation = trpc.checklist.addItem.useMutation({
    onSuccess: (_, variables) => {
      utils.task.getById.invalidate({ id: task?.id! });
      setNewItemContent((prev) => ({ ...prev, [variables.checklistId]: "" }));
    },
  });

  const checklistToggleItemMutation = trpc.checklist.toggleItem.useMutation({
    onSuccess: () => {
      utils.task.getById.invalidate({ id: task?.id! });
    },
  });

  const checklistDeleteMutation = trpc.checklist.delete.useMutation({
    onSuccess: () => {
      utils.task.getById.invalidate({ id: task?.id! });
      toast.success("Checklist removed");
    },
  });

  const commentMutation = trpc.comment.create.useMutation({
    onSuccess: () => {
      setNewComment("");
      utils.task.getById.invalidate({ id: task?.id! });
      toast.success("Comment added");
    },
  });

  const addReactionMutation = trpc.comment.addReaction.useMutation({
    onSuccess: () => utils.task.getById.invalidate({ id: task?.id! }),
  });

  const removeReactionMutation = trpc.comment.removeReaction.useMutation({
    onSuccess: () => utils.task.getById.invalidate({ id: task?.id! }),
  });

  const moveMutation = trpc.task.move.useMutation({
    onSuccess: () => onUpdated?.(),
  });

  // Version data
  const { data: versions } = trpc.version.list.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );
  const { data: taskVersions } = trpc.version.getByTask.useQuery(
    { taskId: task?.id! },
    { enabled: !!task?.id }
  );
  const addTaskVersionMutation = trpc.version.addTask.useMutation({
    onSuccess: () => {
      utils.version.getByTask.invalidate({ taskId: task?.id! });
      toast.success("Version linked");
    },
  });
  const removeTaskVersionMutation = trpc.version.removeTask.useMutation({
    onSuccess: () => {
      utils.version.getByTask.invalidate({ taskId: task?.id! });
      toast.success("Version unlinked");
    },
  });

  const { data: timeEntries } = trpc.task.getTimeEntries.useQuery(
    { taskId: task?.id! },
    { enabled: !!task?.id }
  );

  const logTimeMutation = trpc.task.logTime.useMutation({
    onSuccess: () => {
      setLogTimeOpen(false);
      setTimeHours("");
      setTimeDesc("");
      utils.task.getTimeEntries.invalidate({ taskId: task?.id! });
      utils.task.getById.invalidate({ id: task?.id! });
      onUpdated?.();
      toast.success("Time logged");
    },
  });

  // Create subtask mutation
  const createSubtaskMutation = trpc.task.create.useMutation({
    onSuccess: () => {
      setNewSubtaskTitle("");
      setAddingSubtask(false);
      utils.task.getById.invalidate({ id: task?.id! });
      onUpdated?.();
      toast.success("Subtask created");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescriptionValue(task.description || "");
    }
  }, [task]);

  if (!task) return null;

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (title !== task.title && title.trim()) {
      updateMutation.mutate({ id: task.id, title: title.trim() });
    }
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    commentMutation.mutate({ taskId: task.id, content: newComment.trim() });
  };

  const handleColumnChange = (columnId: string) => {
    if (columnId !== task.columnId) {
      moveMutation.mutate({ taskId: task.id, columnId, position: 0 });
    }
  };

  const handlePriorityChange = (priority: string) => {
    updateMutation.mutate({ id: task.id, priority: priority as Priority });
  };

  const handleTypeChange = (type: string) => {
    updateMutation.mutate({ id: task.id, type: type as TaskType } as any);
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    toast.success("Link copied to clipboard");
  };

  const handleDateSelect = (date: Date | undefined) => {
    updateMutation.mutate({ id: task.id, dueDate: date ? date.toISOString() : null });
    setDatePopoverOpen(false);
  };

  const handleDeleteTask = () => {
    deleteMutation.mutate({ id: task.id });
  };

  const handleArchiveTask = () => {
    updateMutation.mutate({ id: task.id, isArchived: true } as any);
    onClose();
  };

  const handleOpenInNewTab = () => {
    window.open(window.location.href, "_blank");
  };

  const handleToggleLabel = (labelId: string) => {
    const hasLabel = task.labels.some((l) => l.id === labelId);
    if (hasLabel) {
      removeLabelMutation.mutate({ taskId: task.id, labelId });
    } else {
      addLabelMutation.mutate({ taskId: task.id, labelId });
    }
  };

  const handleCreateChecklist = () => {
    if (!checklistTitle.trim()) return;
    checklistCreateMutation.mutate({ taskId: task.id, title: checklistTitle.trim() });
  };

  const handleAddChecklistItem = (checklistId: string) => {
    const content = newItemContent[checklistId]?.trim();
    if (!content) return;
    checklistAddItemMutation.mutate({ checklistId, content });
  };

  const handleCreateSubtask = () => {
    if (!newSubtaskTitle.trim() || !task.columnId) return;
    createSubtaskMutation.mutate({
      title: newSubtaskTitle.trim(),
      columnId: task.columnId,
      projectId: task.projectId,
      parentId: task.id,
    } as any);
  };

  const handleDescriptionSave = () => {
    setEditingDescription(false);
    if (descriptionValue !== (task.description || "")) {
      updateMutation.mutate({ id: task.id, description: descriptionValue || null });
    }
  };

  // Render @mentions in comments
  const renderCommentContent = (content: string) => {
    const parts = content.split(/(@\w+)/g);
    return parts.map((part, i) =>
      part.startsWith("@") ? (
        <span key={i} className="text-primary font-medium">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const subtaskCompleted = subtasks.filter((s: any) => s.status === "done").length;
  const subtaskTotal = subtasks.length;

  return (
    <Sheet open={!!task} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetTitle className="sr-only">{task.title || `Task DK-${task.taskNumber}`}</SheetTitle>
        <SheetDescription className="sr-only">Task details for DK-{task.taskNumber}</SheetDescription>
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground font-mono">DK-{task.taskNumber}</span>
                {/* Task Type Selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hover:bg-muted rounded px-1 py-0.5 transition-colors">
                      <TaskTypeBadge type={(task as any).type || (fullTask as any)?.type} showLabel />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {TASK_TYPES.map((t) => (
                      <DropdownMenuItem key={t.value} onClick={() => handleTypeChange(t.value)}>
                        <span className="mr-2">{t.emoji}</span>
                        {t.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {editingTitle ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
                  className="text-lg font-semibold"
                  autoFocus
                />
              ) : (
                <h2
                  className="text-lg font-semibold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => setEditingTitle(true)}
                >
                  {title}
                </h2>
              )}
              <div className="flex items-center gap-2 mt-1">
                <AiTaskHelper
                  taskId={task.id}
                  taskTitle={title}
                  projectId={task.projectId}
                  onApplyDescription={(desc) => updateMutation.mutate({ id: task.id, description: desc })}
                  onCreateSubtasks={(titles) => {
                    for (const t of titles) {
                      createSubtaskMutation.mutate({ title: t, columnId: task.columnId, projectId: task.projectId, parentId: task.id } as any);
                    }
                  }}
                />
                <AiBreakdownDialog
                  taskId={task.id}
                  taskTitle={title}
                  taskDescription={task.description || ""}
                  projectId={task.projectId}
                  onCreated={() => utils.task.getById.invalidate({ id: task.id })}
                />
                <TaskWatchers taskId={task.id} workspaceId={workspaceId} />
                <VoteButton taskId={task.id} />
                <SlaIndicator taskId={task.id} />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Copy className="mr-2 h-4 w-4" />Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenInNewTab}>
                  <ExternalLink className="mr-2 h-4 w-4" />Open in new tab
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleArchiveTask}>
                  <Archive className="mr-2 h-4 w-4" />Archive
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteTask}>
                  <Trash2 className="mr-2 h-4 w-4" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Status</span>
              <Select defaultValue={task.columnId} onValueChange={handleColumnChange}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color || "#94A3B8" }} />
                        {col.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Priority</span>
              <Select defaultValue={task.priority} onValueChange={handlePriorityChange}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p} value={p}>
                      <PriorityBadge priority={p} showLabel />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Story Points</span>
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2, 3, 5, 8, 13, 21].map((sp) => (
                  <button
                    key={sp}
                    onClick={() => updateMutation.mutate({ id: task.id, storyPoints: sp })}
                    className={`h-7 min-w-[28px] px-1.5 rounded text-xs font-medium border transition-colors ${
                      (fullTask as any)?.storyPoints === sp || (!fullTask && (task as any).storyPoints === sp)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {sp}
                  </button>
                ))}
                {((fullTask as any)?.storyPoints != null || (task as any).storyPoints != null) && (
                  <button
                    onClick={() => updateMutation.mutate({ id: task.id, storyPoints: null })}
                    className="h-7 px-1.5 rounded text-xs text-muted-foreground border border-border hover:border-destructive/50 hover:text-destructive transition-colors"
                  >
                    ✕
                  </button>
                )}
                <AiEstimateButton
                  taskTitle={title}
                  taskDescription={task.description || ""}
                  projectId={task.projectId}
                  onApply={(pts) => updateMutation.mutate({ id: task.id, storyPoints: pts })}
                />
              </div>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Assignees</span>
              <AssigneePicker
                taskId={task.id}
                assignees={task.assignees}
                workspaceId={workspaceId}
                onUpdated={onUpdated}
                showAssignToMe
              />
            </div>
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Due Date</span>
              <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
                <PopoverTrigger asChild>
                  {task.dueDate ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setDatePopoverOpen(true)}>
                        <DueDate date={task.dueDate} status={task.status} />
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateMutation.mutate({ id: task.id, dueDate: null });
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />Set date
                    </Button>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={task.dueDate ? new Date(task.dueDate) : undefined}
                    onSelect={handleDateSelect}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {!task.dueDate && (
                <AiPredictDueDate
                  taskTitle={task.title}
                  taskDescription={task.description}
                  taskType={task.type}
                  taskPriority={task.priority}
                  storyPoints={task.storyPoints}
                  projectId={task.projectId}
                  assigneeId={task.assigneeId}
                  onApply={(date) => updateMutation.mutate({ id: task.id, dueDate: new Date(date).toISOString() })}
                />
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="mt-3">
            <span className="text-xs text-muted-foreground block mb-1">Labels</span>
            <div className="flex flex-wrap gap-1.5">
              {task.labels.map((label) => (
                <Badge
                  key={label.id}
                  variant="secondary"
                  className="text-xs"
                  style={{ backgroundColor: label.color + "20", color: label.color, borderColor: label.color + "40" }}
                >
                  {label.name}
                </Badge>
              ))}
              <Popover open={labelPopoverOpen} onOpenChange={setLabelPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Plus className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">Toggle labels</p>
                  <div className="space-y-0.5 max-h-48 overflow-y-auto">
                    {projectLabels?.map((label: any) => {
                      const hasLabel = task.labels.some((l) => l.id === label.id);
                      return (
                        <button
                          key={label.id}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                          onClick={() => handleToggleLabel(label.id)}
                        >
                          <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                          <span className="flex-1 text-left truncate">{label.name}</span>
                          {hasLabel && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                    {!projectLabels?.length && (
                      <p className="text-xs text-muted-foreground px-2 py-2">No labels in this project</p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {/* Fix Version */}
          <div className="mt-3">
            <span className="text-xs text-muted-foreground block mb-1">Fix Version</span>
            <div className="flex flex-wrap gap-1.5">
              {taskVersions?.filter((tv: any) => tv.type === "fix").map((tv: any) => (
                <Badge
                  key={tv.id}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/20"
                  onClick={() => removeTaskVersionMutation.mutate({ id: tv.id })}
                >
                  {tv.version.name} ✕
                </Badge>
              ))}
              {versions && versions.length > 0 && (
                <Select
                  onValueChange={(versionId) => {
                    if (task) addTaskVersionMutation.mutate({ versionId, taskId: task.id, type: "fix" });
                  }}
                >
                  <SelectTrigger className="h-6 w-auto min-w-[80px] text-xs">
                    <SelectValue placeholder="+ Add" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions
                      .filter((v: any) => !taskVersions?.some((tv: any) => tv.versionId === v.id && tv.type === "fix"))
                      .map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>

        <Separator className="my-4" />

        {/* AI Auto-Triage */}
        <div className="px-6 mb-2">
          <AiAutoTriage taskId={task.id} projectId={task.projectId} onApplied={() => onUpdated?.()} />
        </div>

        {/* Content tabs */}
        <Tabs defaultValue="details" className="px-6 pb-6">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments" className="gap-1">
              <MessageSquare className="h-3 w-3" />
              {comments.length > 0 && <span>{comments.length}</span>}
            </TabsTrigger>
            {comments.length >= 2 && (
              <AiCommentSummary taskId={task.id} projectId={task.projectId} commentCount={comments.length} />
            )}
            <TabsTrigger value="activity">
              <Activity className="h-3 w-3 mr-1" />Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-6">
            {/* Description with Markdown */}
            <div>
              <h4 className="text-sm font-medium mb-2">Description</h4>
              {editingDescription ? (
                <div className="space-y-2">
                  <Textarea
                    value={descriptionValue}
                    onChange={(e) => setDescriptionValue(e.target.value)}
                    placeholder="Write description in markdown..."
                    className="min-h-[120px] resize-none font-mono text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2 items-center">
                    <Button size="sm" onClick={handleDescriptionSave}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingDescription(false); setDescriptionValue(task.description || ""); }}>Cancel</Button>
                    <AiTextCopilot
                      text={descriptionValue}
                      fieldType="description"
                      projectId={task.projectId}
                      onApply={(newText) => setDescriptionValue(newText)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  className="min-h-[60px] rounded-md border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setEditingDescription(true)}
                >
                  {task.description ? (
                    <div className="prose prose-sm prose-invert max-w-none text-sm">
                      <ReactMarkdown>{task.description}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Add a description...</p>
                  )}
                </div>
              )}
            </div>

            {/* Subtasks */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ListTree className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium flex-1">Subtasks</h4>
                {subtaskTotal > 0 && (
                  <span className="text-xs text-muted-foreground">{subtaskCompleted}/{subtaskTotal}</span>
                )}
              </div>
              {subtaskTotal > 0 && (
                <div className="h-1 rounded-full bg-muted mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${subtaskTotal > 0 ? (subtaskCompleted / subtaskTotal) * 100 : 0}%` }}
                  />
                </div>
              )}
              <div className="space-y-1">
                {subtasks.map((subtask: any) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-2 px-1 py-1.5 rounded hover:bg-muted/50 cursor-pointer group"
                  >
                    <Checkbox
                      checked={subtask.status === "done"}
                      onCheckedChange={() => {
                        updateMutation.mutate({ id: subtask.id, status: subtask.status === "done" ? "todo" : "done" });
                      }}
                    />
                    <span className="text-xs text-muted-foreground font-mono">DK-{subtask.taskNumber}</span>
                    <span className={`text-sm flex-1 ${subtask.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {subtask.title}
                    </span>
                  </div>
                ))}
              </div>
              {addingSubtask ? (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Subtask title..."
                    className="h-7 text-sm"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateSubtask();
                      if (e.key === "Escape") { setAddingSubtask(false); setNewSubtaskTitle(""); }
                    }}
                    autoFocus
                  />
                  <Button size="sm" className="h-7" onClick={handleCreateSubtask} disabled={createSubtaskMutation.isPending}>
                    Add
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(""); }}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground mt-1" onClick={() => setAddingSubtask(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Add subtask
                </Button>
              )}
            </div>

            {/* Task Links */}
            <TaskLinks taskId={task.id} projectId={task.projectId} />

            {/* Linked Documents */}
            <TaskDocuments taskId={task.id} projectId={task.projectId} />

            {/* Development / Git */}
            <TaskDevelopmentSection taskId={task.id} />

            {checklists.length > 0 && (
              <div className="space-y-4">
                {checklists.map((checklist) => {
                  const completed = checklist.items.filter((i: any) => i.isChecked).length;
                  const total = checklist.items.length;
                  return (
                    <div key={checklist.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckSquare className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium flex-1">{checklist.title}</h4>
                        <span className="text-xs text-muted-foreground">{completed}/{total}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => checklistDeleteMutation.mutate({ id: checklist.id })}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="h-1 rounded-full bg-muted mb-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="space-y-1">
                        {checklist.items.map((item: any) => (
                          <label key={item.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer">
                            <Checkbox
                              defaultChecked={item.isChecked}
                              onCheckedChange={() => checklistToggleItemMutation.mutate({ id: item.id })}
                            />
                            <span className={`text-sm ${item.isChecked ? "line-through text-muted-foreground" : ""}`}>
                              {item.content}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          placeholder="Add item..."
                          className="h-7 text-sm"
                          value={newItemContent[checklist.id] || ""}
                          onChange={(e) => setNewItemContent((prev) => ({ ...prev, [checklist.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddChecklistItem(checklist.id);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7"
                          onClick={() => handleAddChecklistItem(checklist.id)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add checklist */}
            {addingChecklist ? (
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Checklist title..."
                  className="h-8 text-sm"
                  value={checklistTitle}
                  onChange={(e) => setChecklistTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateChecklist();
                    if (e.key === "Escape") { setAddingChecklist(false); setChecklistTitle(""); }
                  }}
                  autoFocus
                />
                <Button size="sm" className="h-8" onClick={handleCreateChecklist} disabled={checklistCreateMutation.isPending}>
                  Add
                </Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => { setAddingChecklist(false); setChecklistTitle(""); }}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" className="text-muted-foreground" onClick={() => setAddingChecklist(true)}>
                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />Add checklist
              </Button>
            )}

            {/* Time Tracking */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium flex-1">Time Tracking</h4>
                <span className="text-xs text-muted-foreground">
                  {((fullTask as any)?.timeSpent || 0).toFixed(1)}h logged
                </span>
              </div>
              {logTimeOpen ? (
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    type="number"
                    step="0.25"
                    min="0.01"
                    placeholder="Hours"
                    className="h-7 text-sm w-20"
                    value={timeHours}
                    onChange={(e) => setTimeHours(e.target.value)}
                    autoFocus
                  />
                  <Input
                    placeholder="Description (optional)"
                    className="h-7 text-sm flex-1"
                    value={timeDesc}
                    onChange={(e) => setTimeDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && timeHours) {
                        logTimeMutation.mutate({ taskId: task.id, hours: parseFloat(timeHours), description: timeDesc || undefined });
                      }
                    }}
                  />
                  <Button size="sm" className="h-7" onClick={() => {
                    if (timeHours) logTimeMutation.mutate({ taskId: task.id, hours: parseFloat(timeHours), description: timeDesc || undefined });
                  }} disabled={!timeHours || logTimeMutation.isPending}>Log</Button>
                  <Button variant="ghost" size="sm" className="h-7" onClick={() => { setLogTimeOpen(false); setTimeHours(""); setTimeDesc(""); }}>Cancel</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLogTimeOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Log Time
                </Button>
              )}
              {timeEntries && timeEntries.length > 0 && (
                <div className="space-y-1 mt-2">
                  {timeEntries.slice(0, 5).map((entry: any) => (
                    <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">{entry.user?.name}</span>
                      <span>{entry.newValue}h</span>
                      {entry.metadata?.description && <span>— {(entry.metadata as any).description}</span>}
                      <span className="ml-auto">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recurring Tasks */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium flex-1">Repeat</h4>
                {(fullTask as any)?.isRecurring && (
                  <Badge variant="secondary" className="text-[10px]">
                    {(fullTask as any)?.recurrenceRule || "recurring"}
                  </Badge>
                )}
              </div>
              <Select
                defaultValue={(fullTask as any)?.recurrenceRule || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    updateMutation.mutate({ id: task.id, isRecurring: false, recurrenceRule: null } as any);
                  } else {
                    updateMutation.mutate({ id: task.id, isRecurring: true, recurrenceRule: val } as any);
                  }
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Approvals */}
            <TaskApproval taskId={task.id} projectId={task.projectId} workspaceId={workspaceId} />

            {/* Attachments */}
            <div>
              <h4 className="text-sm font-medium mb-2">Attachments</h4>
              <AttachmentsSection taskId={task.id} />
            </div>
          </TabsContent>

          <TabsContent value="comments" className="mt-4 space-y-4">
            {comments.map((comment: any) => {
              const reactions: any[] = comment.reactions || [];
              const reactionEmojis = ["👍", "❤️", "🎉", "🚀", "👀", "😄"];
              // Group reactions by emoji
              const grouped = new Map<string, { count: number; userIds: string[] }>();
              reactions.forEach((r: any) => {
                const existing = grouped.get(r.emoji) || { count: 0, userIds: [] };
                existing.count++;
                existing.userIds.push(r.userId);
                grouped.set(r.emoji, existing);
              });
              const hasReacted = (emoji: string) => {
                const g = grouped.get(emoji);
                return g ? g.userIds.includes(currentUser?.id || "") : false;
              };

              return (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-7 w-7 flex-shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                      {(comment.user?.name || "?").split(" ").map((n: string) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium">{comment.user?.name || "Unknown"}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="text-sm text-foreground/90 prose prose-sm prose-invert max-w-none">
                      {comment.content.split(/(@\w+)/g).map((part: string, i: number) =>
                        part.startsWith("@") ? (
                          <span key={i} className="text-blue-400 font-medium bg-blue-400/10 rounded px-0.5">{part}</span>
                        ) : (
                          <ReactMarkdown key={i}>{part}</ReactMarkdown>
                        )
                      )}
                    </div>
                    {/* Reactions */}
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {Array.from(grouped.entries()).map(([emoji, data]) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            if (hasReacted(emoji)) {
                              removeReactionMutation.mutate({ commentId: comment.id, emoji });
                            } else {
                              addReactionMutation.mutate({ commentId: comment.id, emoji });
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                            hasReacted(emoji)
                              ? "border-primary/50 bg-primary/10"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-muted-foreground">{data.count}</span>
                        </button>
                      ))}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground">
                            <SmilePlus className="h-3.5 w-3.5" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="start">
                          <div className="flex gap-1">
                            {reactionEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => {
                                  if (hasReacted(emoji)) {
                                    removeReactionMutation.mutate({ commentId: comment.id, emoji });
                                  } else {
                                    addReactionMutation.mutate({ commentId: comment.id, emoji });
                                  }
                                }}
                                className="h-8 w-8 rounded hover:bg-muted flex items-center justify-center text-lg transition-colors"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex gap-3">
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <MentionTextarea
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Write a comment... Type @ to mention someone"
                  projectId={task.projectId}
                />
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  Comment
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <div className="space-y-3 text-sm">
              {fullTask?.taskActivities?.map((activity: any) => (
                <div key={activity.id} className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{activity.user?.name || "Someone"} {activity.action}</span>
                  {activity.field && (
                    <span>
                      {activity.field}
                      {activity.oldValue && ` from "${activity.oldValue}"`}
                      {activity.newValue && ` to "${activity.newValue}"`}
                    </span>
                  )}
                  <span className="text-xs ml-auto">{format(new Date(activity.createdAt), "MMM d, h:mm a")}</span>
                </div>
              ))}
              {(!fullTask?.taskActivities || fullTask.taskActivities.length === 0) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Task created</span>
                  <span className="text-xs ml-auto">{format(new Date(task.createdAt), "MMM d, h:mm a")}</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function AttachmentsSection({ taskId }: { taskId: string }) {
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const { data: attachments } = trpc.upload.list.useQuery({ taskId });
  const deleteMutation = trpc.upload.deleteFile.useMutation({
    onSuccess: () => {
      utils.upload.list.invalidate({ taskId });
      toast.success("File deleted");
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append("file", files[i]);
        formData.append("taskId", taskId);
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
      }
      utils.upload.list.invalidate({ taskId });
      toast.success("File(s) uploaded");
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isImage = (mime: string) => mime.startsWith("image/");
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div
        className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
        onClick={() => { const input = document.createElement("input"); input.type = "file"; input.multiple = true; input.onchange = () => handleUpload(input.files); input.click(); }}
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 mx-auto animate-spin text-muted-foreground mb-1" />
        ) : (
          <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
        )}
        <p className="text-xs text-muted-foreground">
          {uploading ? "Uploading..." : "Drop files here or click to upload"}
        </p>
      </div>
      {attachments && attachments.length > 0 && (
        <div className="space-y-2">
          {attachments.map((att: any) => (
            <div key={att.id} className="flex items-center gap-2 p-2 rounded-md border bg-muted/20 group">
              {isImage(att.mimeType) ? (
                <img src={att.fileUrl} alt={att.fileName} className="h-10 w-10 rounded object-cover flex-shrink-0" />
              ) : (
                <FileIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{att.fileName}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(att.fileSize)}</p>
              </div>
              <a href={att.fileUrl} download className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </a>
              <button
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => deleteMutation.mutate({ id: att.id })}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task Development Section ────────────────────────────
function TaskDevelopmentSection({ taskId }: { taskId: string }) {
  const { data: commits } = trpc.git.getCommitsForTask.useQuery({ taskId });

  if (!commits?.length) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-1.5">
        <GitBranch className="h-3.5 w-3.5" /> Development
      </h4>
      <div className="space-y-1.5">
        {commits.map((commit: any) => (
          <div key={commit.id} className="flex items-start gap-2 py-1.5 text-xs">
            {commit.type === "pull_request" ? (
              <GitBranch className="h-3.5 w-3.5 mt-0.5 shrink-0 text-purple-400" />
            ) : (
              <GitCommitIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-blue-400" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {commit.url ? (
                  <a href={commit.url} target="_blank" rel="noopener noreferrer" className="font-mono text-primary hover:underline truncate">
                    {commit.type === "pull_request" ? `#${commit.prNumber}` : commit.commitHash.slice(0, 7)}
                  </a>
                ) : (
                  <span className="font-mono text-muted-foreground">{commit.commitHash.slice(0, 7)}</span>
                )}
                {commit.type === "pull_request" && commit.prStatus && (
                  <Badge
                    variant={commit.prStatus === "merged" ? "default" : commit.prStatus === "open" ? "secondary" : "outline"}
                    className="text-[9px] h-4 px-1"
                  >
                    {commit.prStatus}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground truncate">{commit.type === "pull_request" ? commit.prTitle : commit.message}</p>
              <p className="text-muted-foreground/60">
                {commit.authorName} {commit.branch && `on ${commit.branch}`} · {formatDistanceToNow(new Date(commit.committedAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
