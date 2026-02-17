"use client";

import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

interface SlaIndicatorProps {
  taskId: string;
  compact?: boolean;
}

export function SlaIndicator({ taskId, compact }: SlaIndicatorProps) {
  const { data } = trpc.sla.getTaskSlaStatus.useQuery({ taskId }, { staleTime: 60000 });

  if (!data || data.status === "no_policy") return null;

  const colorMap = {
    met: "text-green-500",
    at_risk: "text-yellow-500",
    breached: "text-red-500",
  };

  const labelMap = {
    met: "SLA on track",
    at_risk: "SLA at risk",
    breached: "SLA breached",
  };

  const color = colorMap[data.status];
  const label = labelMap[data.status];

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Clock className={cn("h-3.5 w-3.5", color)} />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn("flex items-center gap-1 text-xs", color)}>
          <Clock className="h-3 w-3" />
          <span>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {data.status === "breached"
          ? "Resolution time exceeded"
          : `${Math.round((data as any).resolutionRemaining / 3600000)}h remaining`}
      </TooltipContent>
    </Tooltip>
  );
}
