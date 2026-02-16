"use client";

import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Calendar } from "lucide-react";

interface DueDateProps {
  date: string;
  className?: string;
  compact?: boolean;
}

export function DueDate({ date, className, compact }: DueDateProps) {
  const d = new Date(date);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const tomorrow = isTomorrow(d);
  const daysUntil = differenceInDays(d, new Date());

  let label: string;
  if (today) label = "Today";
  else if (tomorrow) label = "Tomorrow";
  else if (overdue) label = compact ? format(d, "MMM d") : `Overdue (${format(d, "MMM d")})`;
  else if (daysUntil <= 7) label = format(d, "EEE, MMM d");
  else label = format(d, "MMM d");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "text-red-500" : today ? "text-amber-500" : "text-muted-foreground",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {label}
    </span>
  );
}
