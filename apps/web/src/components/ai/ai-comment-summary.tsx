"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Loader2, MessageSquare, CheckCircle2, HelpCircle,
  ListChecks, FileText,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiCommentSummaryProps {
  taskId: string;
  projectId: string;
  commentCount: number;
}

export function AiCommentSummary({ taskId, projectId, commentCount }: AiCommentSummaryProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.ai.summarizeThread.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handleSummarize = () => {
    mutation.mutate({ taskId, projectId });
  };

  if (commentCount < 2) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs text-muted-foreground hover:text-primary" onClick={handleSummarize}>
          <Sparkles className="h-3 w-3" />
          Summarize ({commentCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Thread Summary
          </DialogTitle>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Summarizing {commentCount} comments...</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Summary</span>
              </div>
              <p className="text-sm">{result.summary}</p>
            </div>

            {/* Key Decisions */}
            {result.keyDecisions?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium">Key Decisions</span>
                </div>
                <ul className="space-y-1 ml-6">
                  {result.keyDecisions.map((d: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground list-disc">{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Open Questions */}
            {result.openQuestions?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <HelpCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <span className="text-sm font-medium">Open Questions</span>
                </div>
                <ul className="space-y-1 ml-6">
                  {result.openQuestions.map((q: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground list-disc">{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {result.actionItems?.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <ListChecks className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium">Action Items</span>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {result.actionItems.map((a: any, i: number) => (
                    <li key={i} className="text-sm list-disc">
                      <span className="text-muted-foreground">{a.text}</span>
                      {a.assignee && <span className="text-primary text-xs ml-1">({a.assignee})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
