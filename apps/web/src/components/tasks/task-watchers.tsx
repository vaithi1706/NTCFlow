"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface TaskWatchersProps {
  taskId: string;
  workspaceId?: string;
}

export function TaskWatchers({ taskId, workspaceId }: TaskWatchersProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { user: currentUser } = useAuthStore();
  const utils = trpc.useUtils();

  const { data: watchers } = trpc.task.getWatchers.useQuery({ taskId });
  const { data: wsMembers } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && popoverOpen }
  );

  const isWatching = watchers?.some((w) => w.userId === currentUser?.id);

  const watchMutation = trpc.task.watch.useMutation({
    onSuccess: () => {
      utils.task.getWatchers.invalidate({ taskId });
      toast.success("Now watching this task");
    },
  });

  const unwatchMutation = trpc.task.unwatch.useMutation({
    onSuccess: () => {
      utils.task.getWatchers.invalidate({ taskId });
      toast.success("Stopped watching this task");
    },
  });

  const addWatcherMutation = trpc.task.addWatcher.useMutation({
    onSuccess: () => {
      utils.task.getWatchers.invalidate({ taskId });
      toast.success("Watcher added");
    },
    onError: (err) => toast.error(err.message),
  });

  const watcherIds = new Set(watchers?.map((w) => w.userId) || []);

  return (
    <div className="flex items-center gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isWatching ? "secondary" : "ghost"}
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
                if (isWatching) {
                  unwatchMutation.mutate({ taskId });
                } else {
                  watchMutation.mutate({ taskId });
                }
              }}
            >
              {isWatching ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {watchers?.length || 0}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isWatching ? "You are watching this task" : "Watch this task"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1 mb-1">Watchers</p>
          {/* Current watchers */}
          {watchers && watchers.length > 0 && (
            <div className="space-y-0.5 mb-2">
              {watchers.map((w) => (
                <div key={w.id} className="flex items-center gap-2 px-2 py-1 rounded text-sm">
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                      {w.user.name.split(" ").map((n: string) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-xs">{w.user.name}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Add watcher</p>
          <div className="space-y-0.5 max-h-32 overflow-y-auto">
            {wsMembers
              ?.filter((m: any) => !watcherIds.has(m.user.id))
              .map((m: any) => (
                <button
                  key={m.user.id}
                  className="flex items-center gap-2 w-full px-2 py-1 rounded text-sm hover:bg-muted transition-colors"
                  onClick={() => addWatcherMutation.mutate({ taskId, userId: m.user.id })}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-[8px] bg-primary text-primary-foreground">
                      {m.user.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 text-left text-xs">{m.user.name}</span>
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
