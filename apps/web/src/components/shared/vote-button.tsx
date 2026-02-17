"use client";

import { ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/api/trpc";
import { cn } from "@/lib/utils";

interface VoteButtonProps {
  taskId: string;
}

export function VoteButton({ taskId }: VoteButtonProps) {
  const utils = trpc.useUtils();
  const { data } = trpc.task.getVotes.useQuery({ taskId });
  const voteMutation = trpc.task.vote.useMutation({
    onSuccess: () => {
      utils.task.getVotes.invalidate({ taskId });
    },
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1 px-2", data?.voted && "text-primary")}
          onClick={() => voteMutation.mutate({ taskId })}
          disabled={voteMutation.isPending}
        >
          <ThumbsUp className={cn("h-3.5 w-3.5", data?.voted && "fill-current")} />
          {(data?.count ?? 0) > 0 && (
            <span className="text-xs">{data?.count}</span>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{data?.voted ? "Remove vote" : "Vote for this task"}</TooltipContent>
    </Tooltip>
  );
}
