"use client";

import { cn } from "@/lib/utils";

interface UsageBarProps {
  label: string;
  current: number;
  max: number | null;
  className?: string;
}

export function UsageBar({ label, current, max, className }: UsageBarProps) {
  if (max === null) {
    return (
      <div className={cn("text-xs text-zinc-500", className)}>
        <span className="text-zinc-400">{label}:</span> {current} <span className="text-zinc-600">(unlimited)</span>
      </div>
    );
  }

  const pct = Math.min((current / max) * 100, 100);
  const color = pct >= 100 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-emerald-500";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className={cn("font-medium", pct >= 100 ? "text-red-400" : pct >= 75 ? "text-yellow-400" : "text-zinc-300")}>
          {current}/{max}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
