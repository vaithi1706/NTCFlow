"use client";

import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Calendar } from "lucide-react";

interface DueDateProps {
  date: string;
  /**
   * Task status. If the task is `done` or `cancelled` we don't paint the date
   * red or label it "Overdue" — a completed task isn't late, just done.
   */
  status?: string;
  className?: string;
  compact?: boolean;
}

export function DueDate({ date, status, className, compact }: DueDateProps) {
  const d = new Date(date);
  const isCompleted = status === "done" || status === "cancelled";
  const overdue = isPast(d) && !isToday(d) && !isCompleted;
  const today = isToday(d) && !isCompleted;
  const tomorrow = isTomorrow(d);
  const daysUntil = differenceInDays(d, new Date());

  let label: string;
  if (today) label = "Today";
  else if (tomorrow && !isCompleted) label = "Tomorrow";
  else if (overdue) label = compact ? format(d, "MMM d") : `Overdue (${format(d, "MMM d")})`;
  else if (!isCompleted && daysUntil <= 7) label = format(d, "EEE, MMM d");
  else label = format(d, "MMM d");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "text-red-500" : today ? "text-amber-500" : "text-muted-foreground",
        isCompleted && "line-through opacity-70",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}
