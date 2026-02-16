"use client";

import { cn } from "@/lib/utils";

export type TaskType = "bug" | "feature" | "story" | "task" | "epic";

export const TASK_TYPES: { value: TaskType; label: string; emoji: string; color: string }[] = [
  { value: "bug", label: "Bug", emoji: "🐛", color: "#EF4444" },
  { value: "feature", label: "Feature", emoji: "✨", color: "#8B5CF6" },
  { value: "story", label: "Story", emoji: "📖", color: "#3B82F6" },
  { value: "task", label: "Task", emoji: "✅", color: "#22C55E" },
  { value: "epic", label: "Epic", emoji: "🏔️", color: "#F59E0B" },
];

export function getTaskType(type?: string | null) {
  return TASK_TYPES.find((t) => t.value === type) || TASK_TYPES[3]; // default to "task"
}

export function TaskTypeBadge({ type, showLabel = false, className }: { type?: string | null; showLabel?: boolean; className?: string }) {
  const t = getTaskType(type);
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", className)} title={t.label}>
      <span>{t.emoji}</span>
      {showLabel && <span style={{ color: t.color }}>{t.label}</span>}
    </span>
  );
}
