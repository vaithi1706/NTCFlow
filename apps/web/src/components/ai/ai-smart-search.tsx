"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Sparkles, Loader2, Send, ExternalLink, Clock, User,
  Flag, Tag, Filter, ArrowRight,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface AiSmartSearchProps {
  workspaceId: string;
  workspaceSlug: string;
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-600 dark:text-red-400",
  high: "text-orange-600 dark:text-orange-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-green-600 dark:text-green-400",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  cancelled: "Cancelled",
};

export function AiSmartSearch({ workspaceId, workspaceSlug }: AiSmartSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);
  const router = useRouter();

  const searchMutation = trpc.ai.smartSearch.useMutation({
    onSuccess: (data) => setResults(data),
    onError: (err) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMutation.mutate({ query, workspaceId });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResults(null); setQuery(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          <Search className="h-4 w-4" />
          AI Search
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            AI-Powered Search
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Search in natural language. AI converts your query into smart filters.
        </p>

        <div className="flex gap-2 mt-2">
          <Input
            placeholder='e.g. "Show me overdue bugs assigned to Dave" or "Tasks completed last week"'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={searchMutation.isPending}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={!query.trim() || searchMutation.isPending} size="sm">
            {searchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <p>Try: &quot;What did the frontend team work on this week?&quot;</p>
          <p>Try: &quot;High priority tasks not yet started&quot;</p>
          <p>Try: &quot;Bugs in the Payments project that are overdue&quot;</p>
        </div>

        {results && (
          <>
            <Separator className="my-3" />

            {/* Interpretation */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <Filter className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">{results.interpretation}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {results.filters?.status?.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">{statusLabels[s] || s}</Badge>
                  ))}
                  {results.filters?.priority?.map((p: string) => (
                    <Badge key={p} variant="outline" className={`text-xs ${priorityColors[p] || ""}`}>{p}</Badge>
                  ))}
                  {results.filters?.taskType?.map((t: string) => (
                    <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                  ))}
                  {results.filters?.isOverdue && (
                    <Badge variant="outline" className="text-xs text-red-600 dark:text-red-400">Overdue</Badge>
                  )}
                  {results.filters?.searchText && (
                    <Badge variant="secondary" className="text-xs">Search: {results.filters.searchText}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Results */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-medium">{results.totalResults} results found</span>
            </div>

            <div>
              <div className="space-y-1.5">
                {results.tasks?.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => { setOpen(false); }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">
                          {task.project?.name}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm font-medium truncate">{task.title}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{statusLabels[task.status] || task.status}</Badge>
                        <Badge variant="outline" className={`text-xs ${priorityColors[task.priority] || ""}`}>
                          {task.priority}
                        </Badge>
                        {task.assignee && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" /> {task.assignee.name}
                          </span>
                        )}
                        {task.labels?.map((tl: any) => (
                          <Badge key={tl.label?.id} variant="secondary" className="text-xs">
                            {tl.label?.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {results.totalResults === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No tasks match your search</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
