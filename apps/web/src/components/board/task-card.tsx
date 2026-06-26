"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { AssigneePicker } from "@/components/shared/assignee-picker";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { DueDate } from "@/components/shared/due-date";
import { ListTree, MessageSquare, Paperclip, Repeat, ThumbsUp } from "lucide-react";
import { TaskTypeBadge } from "@/components/shared/task-type-badge";
import { SlaIndicator } from "@/components/shared/sla-indicator";
import type { TaskWithRelations } from "@dkflow/shared";

interface TaskCardProps {
  task: TaskWithRelations;
  onClick: () => void;
  overlay?: boolean;
  workspaceId?: string;
  onUpdated?: () => void;
}

export function TaskCard({ task, onClick, overlay, workspaceId, onUpdated }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = overlay
    ? undefined
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const maxLabels = 3;
  const visibleLabels = task.labels.slice(0, maxLabels);
  const extraLabels = task.labels.length - maxLabels;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-card p-3 cursor-pointer transition-all group/card",
        "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 hover:-translate-y-0.5",
        isDragging && "opacity-30",
        overlay && "shadow-xl border-primary/50"
      )}
    >
      {/* Labels */}
      {visibleLabels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleLabels.map((label) => (
            <span
              key={label.id}
              className="inline-block h-1.5 w-8 rounded-full"
              style={{ backgroundColor: label.color }}
            />
          ))}
          {extraLabels > 0 && (
            <span className="text-[10px] text-muted-foreground">+{extraLabels}</span>
          )}
        </div>
      )}

      {/* ID + Title */}
      <div className="mb-1.5">
        <div className="flex items-center gap-1">
          <TaskTypeBadge type={(task as any).type} />
          <span className="text-[10px] text-muted-foreground font-mono">DK-{task.taskNumber}</span>
        </div>
        <h4 className="text-sm font-medium leading-snug line-clamp-2">{task.title}</h4>
      </div>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{task.description}</p>
      )}

      {/* Checklist progress */}
      {task.checklistProgress && (
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{
                  width: `${(task.checklistProgress.completed / task.checklistProgress.total) * 100}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {task.checklistProgress.completed}/{task.checklistProgress.total}
            </span>
          </div>
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center gap-2 mt-1">
        <PriorityBadge priority={task.priority} />

        {(task as any).isRecurring && (
          <Repeat className="h-3 w-3 text-muted-foreground" />
        )}

        {(task as any)._count?.subtasks > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <ListTree className="h-3 w-3" />
            {(task as any)._count.subtasks}
          </span>
        )}

        {task.dueDate && <DueDate date={task.dueDate} status={task.status} compact />}

        <SlaIndicator taskId={task.id} compact />

        {(task as any)._count?.votes > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <ThumbsUp className="h-3 w-3" />
            {(task as any)._count.votes}
          </span>
        )}

        <div className="flex-1" />

        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {task.commentCount}
          </span>
        )}

        {task.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Paperclip className="h-3 w-3" />
            {task.attachmentCount}
          </span>
        )}

        {(task as any).storyPoints != null && (task as any).storyPoints > 0 && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
            {(task as any).storyPoints} SP
          </span>
        )}

        {task.assignees.length > 0 ? (
          <AssigneePicker
            taskId={task.id}
            assignees={task.assignees}
            workspaceId={workspaceId}
            onUpdated={onUpdated}
            compact
          >
            <div onClick={(e) => e.stopPropagation()}>
              <AvatarGroup users={task.assignees} max={2} size="sm" />
            </div>
          </AssigneePicker>
        ) : (
          <div className="opacity-0 group-hover/card:opacity-100 transition-opacity">
            <AssigneePicker
              taskId={task.id}
              assignees={task.assignees}
              workspaceId={workspaceId}
              onUpdated={onUpdated}
              compact
              showAssignToMe
            />
          </div>
        )}
      </div>
    </div>
  );
}
