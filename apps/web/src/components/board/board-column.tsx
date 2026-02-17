"use client";

import { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { AiDuplicateWarning } from "@/components/ai/ai-duplicate-warning";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import type { BoardColumn as BoardColumnType, TaskWithRelations, Project } from "@dkflow/shared";

const presetColors = ["#94A3B8", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];

interface BoardColumnProps {
  column: BoardColumnType;
  tasks: TaskWithRelations[];
  project: Project | null;
  onTaskClick: (task: TaskWithRelations) => void;
  onTaskCreate: (title: string, columnId: string) => void;
  onColumnUpdated?: () => void;
  workspaceId?: string;
  onTaskUpdated?: () => void;
}

export function BoardColumn({ column, tasks, project, onTaskClick, onTaskCreate, onColumnUpdated, workspaceId, onTaskUpdated }: BoardColumnProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(column.name);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [wipDialogOpen, setWipDialogOpen] = useState(false);
  const [wipValue, setWipValue] = useState(column.wipLimit?.toString() || "");
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  const updateColumnMutation = trpc.board.updateColumn.useMutation({
    onSuccess: () => {
      onColumnUpdated?.();
      toast.success("Column updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteColumnMutation = trpc.board.deleteColumn.useMutation({
    onSuccess: () => {
      onColumnUpdated?.();
      toast.success("Column deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (renaming) renameRef.current?.focus();
  }, [renaming]);

  const handleAdd = async () => {
    const title = newTitle.trim();
    if (!title) { setAdding(false); return; }
    onTaskCreate(title, column.id);
    setNewTitle("");
    setAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
    if (e.key === "Escape") { setAdding(false); setNewTitle(""); }
  };

  const handleRenameBlur = () => {
    setRenaming(false);
    if (renameValue.trim() && renameValue.trim() !== column.name) {
      updateColumnMutation.mutate({ id: column.id, name: renameValue.trim() });
    } else {
      setRenameValue(column.name);
    }
  };

  const handleColorSelect = (color: string) => {
    updateColumnMutation.mutate({ id: column.id, color });
    setColorDialogOpen(false);
  };

  const handleSetWipLimit = () => {
    const limit = wipValue.trim() === "" ? null : parseInt(wipValue, 10);
    if (wipValue.trim() !== "" && (isNaN(limit!) || limit! < 0)) {
      toast.error("Please enter a valid number");
      return;
    }
    updateColumnMutation.mutate({ id: column.id, wipLimit: limit });
    setWipDialogOpen(false);
  };

  const handleDeleteColumn = () => {
    if (tasks.length > 0) {
      toast.error("Move or delete all tasks before removing this column");
      return;
    }
    deleteColumnMutation.mutate({ id: column.id });
  };

  const isOverLimit = column.wipLimit !== null && tasks.length >= column.wipLimit;

  return (
    <>
      <div
        ref={setNodeRef}
        className={cn(
          "flex flex-col w-[300px] flex-shrink-0 rounded-xl transition-colors",
          isOver && "bg-primary/5"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-1 mb-3">
          <span
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: column.color || "#94A3B8" }}
          />
          {renaming ? (
            <Input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={handleRenameBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameBlur();
                if (e.key === "Escape") { setRenaming(false); setRenameValue(column.name); }
              }}
              className="h-6 text-sm font-semibold px-1"
            />
          ) : (
            <h3 className="text-sm font-semibold flex-1 truncate">{column.name}</h3>
          )}
          <span className={cn(
            "text-xs font-medium tabular-nums",
            isOverLimit ? "text-amber-500" : "text-muted-foreground"
          )}>
            {tasks.length}
            {column.wipLimit !== null && `/${column.wipLimit}`}
          </span>
          {(() => {
            const pts = tasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
            return pts > 0 ? (
              <span className="text-[10px] text-muted-foreground">· {pts} pts</span>
            ) : null;
          })()}
          <Button
            data-tour="create-task"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setRenaming(true); setRenameValue(column.name); }}>Rename</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setColorDialogOpen(true)}>Change color</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setWipValue(column.wipLimit?.toString() || ""); setWipDialogOpen(true); }}>Set WIP limit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCollapsed(!collapsed)}>{collapsed ? "Expand" : "Collapse"}</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={handleDeleteColumn}>Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tasks */}
        {!collapsed && (
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px] pb-2">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} workspaceId={workspaceId} onUpdated={onTaskUpdated} />
            ))}

            {/* Quick add */}
            {adding && (
              <div className="px-0.5 space-y-1">
                <Input
                  ref={inputRef}
                  placeholder="Task title..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAdd}
                  className="text-sm"
                />
                {project && newTitle.length >= 5 && (
                  <AiDuplicateWarning title={newTitle} projectId={project.id} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Color dialog */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Change column color</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2 py-2">
            {presetColors.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={cn(
                  "h-8 w-8 rounded-full border-2 transition-all",
                  column.color === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* WIP limit dialog */}
      <Dialog open={wipDialogOpen} onOpenChange={setWipDialogOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Set WIP limit</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Maximum tasks in this column (empty for no limit)</Label>
            <Input
              type="number"
              min={0}
              placeholder="No limit"
              value={wipValue}
              onChange={(e) => setWipValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSetWipLimit(); }}
            />
          </div>
          <DialogFooter>
            <Button size="sm" onClick={handleSetWipLimit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
