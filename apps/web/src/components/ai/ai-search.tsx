"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Search, X } from "lucide-react";
import { PriorityBadge } from "@/components/shared/priority-badge";

interface AiSearchProps {
  workspaceId: string;
  onSelectTask?: (taskId: string) => void;
}

export function AiSearch({ workspaceId, onSelectTask }: AiSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const searchMutation = trpc.ai.naturalSearch.useMutation();

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate({ query: query.trim(), workspaceId });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-violet-500 border-violet-500/30 hover:bg-violet-500/10"
      >
        <Sparkles className="h-3 w-3 mr-1" />
        <Search className="h-3 w-3 mr-1" />
        AI Search
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI-Powered Search
              <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500">PRO</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try: "overdue bugs assigned to me" or "high priority features this sprint"'
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searchMutation.isPending} className="bg-violet-500 hover:bg-violet-600">
              {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {searchMutation.data && (
            <div className="space-y-3">
              {/* Detected filters */}
              <div className="flex flex-wrap gap-1">
                {Object.entries(searchMutation.data.filters as Record<string, any>).map(([key, value]) => (
                  value && (
                    <Badge key={key} variant="secondary" className="text-[10px]">
                      {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                    </Badge>
                  )
                ))}
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {(searchMutation.data.tasks as any[]).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No tasks found</p>
                ) : (
                  (searchMutation.data.tasks as any[]).map((task: any) => (
                    <Card
                      key={task.id}
                      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        onSelectTask?.(task.id);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground shrink-0">
                            {task.project?.name}
                          </span>
                          <span className="text-sm font-medium truncate">{task.title}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">{task.status}</Badge>
                          <PriorityBadge priority={task.priority} />
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {(searchMutation.data.tasks as any[]).length} result(s)
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
