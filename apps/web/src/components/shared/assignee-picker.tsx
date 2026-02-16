"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvatarGroup } from "@/components/shared/avatar-group";
import { Check, UserPlus } from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface AssigneePickerProps {
  taskId: string;
  assignees: Array<{ id: string; name: string; avatarUrl?: string | null }>;
  workspaceId?: string;
  onUpdated?: () => void;
  compact?: boolean;
  showAssignToMe?: boolean;
  children?: React.ReactNode; // custom trigger
}

export function AssigneePicker({ taskId, assignees, workspaceId, onUpdated, compact, showAssignToMe = true, children }: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuthStore();

  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && open }
  );

  const toggleMutation = trpc.task.toggleAssignee.useMutation({
    onSuccess: (result) => {
      onUpdated?.();
      toast.success(result.assigned ? "Assignee added" : "Assignee removed");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update assignee"),
  });

  const isMeAssigned = user?.id ? assignees.some((a) => a.id === user.id) : false;

  const trigger = children ? (
    <div>{children}</div>
  ) : compact ? (
    <button className="flex items-center gap-1 hover:opacity-80 transition-opacity">
      {assignees.length > 0 ? (
        <AvatarGroup users={assignees as any} max={3} size="sm" />
      ) : (
        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-muted-foreground/40 hover:border-primary transition-colors">
          <UserPlus className="h-3 w-3 text-muted-foreground" />
        </span>
      )}
    </button>
  ) : (
    <div className="flex items-center gap-2 cursor-pointer">
      {assignees.length > 0 ? (
        <AvatarGroup users={assignees as any} max={4} size="md" />
      ) : (
        <span className="text-xs text-muted-foreground">No assignees</span>
      )}
      <Button variant="ghost" size="icon" className="h-6 w-6">
        <UserPlus className="h-3 w-3" />
      </Button>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <p className="text-xs font-medium text-muted-foreground px-2 py-1">Assign members</p>

        {/* Assign to me shortcut */}
        {showAssignToMe && user?.id && (
          <button
            className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-primary/10 text-primary font-medium transition-colors mb-1"
            onClick={() => toggleMutation.mutate({ taskId, userId: user.id! })}
          >
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                {user.name?.split(" ").map((n: string) => n[0]).join("") || "Me"}
              </AvatarFallback>
            </Avatar>
            <span className="flex-1 text-left">Assign to me</span>
            {isMeAssigned && <Check className="h-3.5 w-3.5 text-primary" />}
          </button>
        )}

        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {members?.map((m: any) => {
            const isAssigned = assignees.some((a) => a.id === m.user.id);
            return (
              <button
                key={m.user.id}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors"
                onClick={() => toggleMutation.mutate({ taskId, userId: m.user.id })}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary text-primary-foreground">
                    {m.user.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1 text-left truncate">{m.user.name}</span>
                {isAssigned && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
          {!members?.length && (
            <p className="text-xs text-muted-foreground px-2 py-2">No members found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
