"use client";

import { useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  closestCenter,
  rectIntersection,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BoardColumn } from "./board-column";
import { TaskCard } from "./task-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Layers } from "lucide-react";
import type {
  BoardColumn as BoardColumnType,
  TaskWithRelations,
  Project,
} from "@dkflow/shared";

type GroupByOption = "none" | "assignee" | "priority" | "type" | "epic";

interface BoardViewProps {
  columns: BoardColumnType[];
  tasks: TaskWithRelations[];
  project: Project | null;
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskCreate: (title: string, columnId: string) => void;
  onTaskMove: (taskId: string, columnId: string, position: number) => void;
  onUpdated?: () => void;
}

const GROUP_BY_OPTIONS: { value: GroupByOption; label: string }[] = [
  { value: "none", label: "None" },
  { value: "assignee", label: "Assignee" },
  { value: "priority", label: "Priority" },
  { value: "type", label: "Task Type" },
];

const PRIORITY_ORDER = ["urgent", "high", "medium", "low", "none"];
const TYPE_ORDER = ["bug", "feature", "story", "task", "epic"];

function groupTasks(
  tasks: TaskWithRelations[],
  groupBy: GroupByOption
): { key: string; label: string; tasks: TaskWithRelations[] }[] {
  if (groupBy === "none") return [{ key: "__all", label: "", tasks }];

  const groups = new Map<string, { label: string; tasks: TaskWithRelations[] }>();

  for (const task of tasks) {
    let key: string;
    let label: string;

    switch (groupBy) {
      case "assignee": {
        const assignees = (task as any).assignees || [];
        if (assignees.length === 0) {
          key = "__unassigned";
          label = "Unassigned";
        } else {
          const a = assignees[0];
          const user = a.user || a;
          key = user.id || "__unassigned";
          label = user.name || "Unassigned";
        }
        break;
      }
      case "priority":
        key = (task as any).priority || "none";
        label = key.charAt(0).toUpperCase() + key.slice(1);
        break;
      case "type":
        key = (task as any).type || "task";
        label = key.charAt(0).toUpperCase() + key.slice(1);
        break;
      default:
        key = "__all";
        label = "All";
    }

    if (!groups.has(key)) groups.set(key, { label, tasks: [] });
    groups.get(key)!.tasks.push(task);
  }

  // Sort groups
  const entries = Array.from(groups.entries());
  if (groupBy === "priority") {
    entries.sort((a, b) => PRIORITY_ORDER.indexOf(a[0]) - PRIORITY_ORDER.indexOf(b[0]));
  } else if (groupBy === "type") {
    entries.sort((a, b) => TYPE_ORDER.indexOf(a[0]) - TYPE_ORDER.indexOf(b[0]));
  } else {
    entries.sort((a, b) => {
      if (a[0] === "__unassigned") return 1;
      if (b[0] === "__unassigned") return -1;
      return a[1].label.localeCompare(b[1].label);
    });
  }

  return entries.map(([key, val]) => ({ key, label: val.label, tasks: val.tasks }));
}

export function BoardView({ columns, tasks, project, onTaskClick, onTaskCreate, onTaskMove, onUpdated }: BoardViewProps) {
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [groupBy, setGroupBy] = useState<GroupByOption>("none");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const getTasksForColumn = useCallback(
    (columnId: string, swimlaneTasks?: TaskWithRelations[]) =>
      (swimlaneTasks || tasks)
        .filter((t) => t.columnId === columnId)
        .sort((a, b) => a.position - b.position),
    [tasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  // Custom collision detection: try pointerWithin first (most accurate), 
  // then fall back to closestCorners for columns
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First try pointer-based detection
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    // Fall back to closestCorners  
    return closestCorners(args);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    // Don't do anything if dropped on itself in same position
    if (taskId === overId) return;

    let targetColumnId: string;
    const isColumn = columns.some((c) => c.id === overId);
    if (isColumn) {
      targetColumnId = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask?.columnId) return;
      targetColumnId = overTask.columnId;
    }

    const currentTask = tasks.find((t) => t.id === taskId);
    const columnTasks = getTasksForColumn(targetColumnId);
    
    let newPosition: number;
    if (isColumn) {
      // Dropped on column itself (empty area) — put at end
      newPosition = columnTasks.length;
    } else {
      // Dropped on a task — insert at that task's position
      const overIndex = columnTasks.findIndex((t) => t.id === overId);
      newPosition = overIndex >= 0 ? overIndex : columnTasks.length;
    }

    // Skip if same column and same position
    if (currentTask?.columnId === targetColumnId) {
      const currentIndex = columnTasks.findIndex((t) => t.id === taskId);
      if (currentIndex === newPosition) return;
    }

    onTaskMove(taskId, targetColumnId, Math.max(0, newPosition));
  };

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groups = useMemo(() => groupTasks(tasks, groupBy), [tasks, groupBy]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div data-tour="board-view" className="flex flex-col flex-1 overflow-hidden">
        {/* Group By toolbar */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                Group: {GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {GROUP_BY_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => { setGroupBy(opt.value); setCollapsedGroups(new Set()); }}
                  className={groupBy === opt.value ? "bg-primary/10 text-primary" : ""}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Board content */}
        <div className="flex-1 overflow-y-auto">
          {groups.map((group) => (
            <div key={group.key}>
              {groupBy !== "none" && (
                <button
                  className="flex items-center gap-2 w-full px-6 py-2 bg-muted/30 border-b border-border/50 hover:bg-muted/50 transition-colors"
                  onClick={() => toggleGroupCollapse(group.key)}
                >
                  {collapsedGroups.has(group.key) ? (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{group.label}</span>
                  <span className="text-xs text-muted-foreground">{group.tasks.length} tasks</span>
                  {(() => {
                    const pts = group.tasks.reduce((s, t) => s + ((t as any).storyPoints || 0), 0);
                    return pts > 0 ? <span className="text-xs text-muted-foreground">· {pts} pts</span> : null;
                  })()}
                </button>
              )}
              {!collapsedGroups.has(group.key) && (
                <div className="overflow-x-auto overflow-y-hidden">
                  <div className="flex gap-4 p-6 min-w-max" style={groupBy !== "none" ? { minHeight: 200 } : { height: "100%" }}>
                    {columns
                      .sort((a, b) => a.position - b.position)
                      .map((column) => {
                        const columnTasks = getTasksForColumn(column.id, group.tasks);
                        return (
                          <SortableContext
                            key={column.id}
                            items={columnTasks.map((t) => t.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <BoardColumn
                              column={column}
                              tasks={columnTasks}
                              project={project}
                              onTaskClick={onTaskClick}
                              onTaskCreate={onTaskCreate}
                              onColumnUpdated={onUpdated}
                              workspaceId={project?.workspaceId}
                              onTaskUpdated={onUpdated}
                            />
                          </SortableContext>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask && (
          <div className="rotate-2 opacity-90">
            <TaskCard task={activeTask} onClick={() => {}} overlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
