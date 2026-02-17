"use client";

import { usePresence } from "@/hooks/use-presence";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PresenceAvatarsProps {
  page?: string;
}

export function PresenceAvatars({ page }: PresenceAvatarsProps) {
  const viewers = usePresence(page);

  if (viewers.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">Viewing:</span>
      <div className="flex -space-x-2">
        {viewers.slice(0, 5).map((v) => {
          const initials = v.userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
          return (
            <Tooltip key={v.userId}>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Avatar className="h-7 w-7 border-2 border-background">
                    {v.avatarUrl && <AvatarImage src={v.avatarUrl} alt={v.userName} />}
                    <AvatarFallback className="bg-green-600 text-white text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background" />
                </div>
              </TooltipTrigger>
              <TooltipContent>{v.userName}</TooltipContent>
            </Tooltip>
          );
        })}
        {viewers.length > 5 && (
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
              +{viewers.length - 5}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}
