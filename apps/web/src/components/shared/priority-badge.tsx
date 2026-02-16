"use client";

import { cn } from "@/lib/utils";
import type { Priority } from "@dkflow/shared";
import {
  AlertTriangle,
  ArrowUp,
  ArrowRight,
  ArrowDown,
  Minus,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const config: Record<Priority, { icon: React.ElementType; color: string; label: string }> = {
  urgent: { icon: AlertTriangle, color: "text-red-500", label: "Urgent" },
  high: { icon: ArrowUp, color: "text-orange-500", label: "High" },
  medium: { icon: ArrowRight, color: "text-amber-500", label: "Medium" },
  low: { icon: ArrowDown, color: "text-blue-500", label: "Low" },
  none: { icon: Minus, color: "text-muted-foreground", label: "None" },
};

interface PriorityBadgeProps {
  priority: Priority;
  showLabel?: boolean;
  className?: string;
}

export function PriorityBadge({ priority, showLabel, className }: PriorityBadgeProps) {
  const { icon: Icon, color, label } = config[priority];

  if (showLabel) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", color, className)}>
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Icon className={cn("h-3.5 w-3.5", color, className)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label} Priority</TooltipContent>
    </Tooltip>
  );
}
