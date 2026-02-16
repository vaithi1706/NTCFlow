"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { User } from "@dkflow/shared";
import { cn } from "@/lib/utils";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const colors = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-600", "bg-amber-600",
  "bg-rose-600", "bg-cyan-600", "bg-indigo-600", "bg-pink-600",
];

function userColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

interface AvatarGroupProps {
  users: User[];
  max?: number;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-6 w-6 text-[10px]",
  md: "h-7 w-7 text-xs",
  lg: "h-8 w-8 text-sm",
};

export function AvatarGroup({ users, max = 3, size = "sm" }: AvatarGroupProps) {
  const visible = users.slice(0, max);
  const overflow = users.length - max;

  return (
    <div className="flex -space-x-1.5">
      {visible.map((user) => (
        <Tooltip key={user.id}>
          <TooltipTrigger asChild>
            <Avatar className={cn(sizeMap[size], "border-2 border-background ring-0")}>
              <AvatarFallback className={cn(userColor(user.id), "text-white font-medium")}>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{user.name}</TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Avatar className={cn(sizeMap[size], "border-2 border-background ring-0")}>
          <AvatarFallback className="bg-muted text-muted-foreground font-medium">
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
