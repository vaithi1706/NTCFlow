"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Zap, ArrowRight, Check, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface AiAutomationSuggestionsProps {
  projectId: string;
}

export function AiAutomationSuggestions({ projectId }: AiAutomationSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  const mutation = trpc.ai.suggestAutomations.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const createAutomation = trpc.automation.create.useMutation({
    onSuccess: () => {
      utils.automation.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleOpen = () => {
    setOpen(true);
    setApplied(new Set());
    mutation.mutate({ projectId });
  };

  const handleApply = (suggestion: { trigger: string; action: string; description: string }, idx: number) => {
    // Map AI suggestion to automation rule format
    const triggerEvent = suggestion.trigger.toLowerCase().includes("bug")
      ? "task_created"
      : suggestion.trigger.toLowerCase().includes("created")
      ? "task_created"
      : suggestion.trigger.toLowerCase().includes("move")
      ? "task_moved_to_column"
      : suggestion.trigger.toLowerCase().includes("due")
      ? "due_date_reached"
      : suggestion.trigger.toLowerCase().includes("label")
      ? "label_added"
      : "task_created";

    // Map AI action text to the closest automation action type
    const actionLower = suggestion.action.toLowerCase();
    const actionType = actionLower.includes("assign")
      ? "change_assignee"
      : actionLower.includes("priority")
      ? "change_priority"
      : actionLower.includes("label")
      ? "add_label"
      : actionLower.includes("move") || actionLower.includes("column") || actionLower.includes("status")
      ? "move_to_column"
      : "send_notification";

    createAutomation.mutate({
      projectId,
      name: suggestion.description.slice(0, 100),
      trigger: {
        event: triggerEvent,
        conditions: { aiSuggested: true, originalTrigger: suggestion.trigger },
      },
      actions: [
        { type: actionType, params: { description: suggestion.action } },
      ],
    }, {
      onSuccess: () => {
        setApplied(prev => new Set(prev).add(idx));
        toast.success("Automation rule created!");
      },
    });
  };

  const confidenceColor = (c: number) => {
    if (c >= 80) return "text-emerald-700 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (c >= 60) return "text-yellow-700 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    return "text-orange-700 dark:text-orange-400 border-orange-500/30 bg-orange-500/10";
  };

  const confidenceBar = (c: number) => {
    if (c >= 80) return "bg-emerald-500";
    if (c >= 60) return "bg-yellow-500";
    return "bg-orange-500";
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 border-violet-500/30 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10" onClick={handleOpen}>
        <Sparkles className="h-3.5 w-3.5" />
        AI Automation Suggestions
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col sm:max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Zap className="h-4 w-4 text-violet-500" />
              </div>
              Smart Automation Suggestions
            </DialogTitle>
            <DialogDescription>AI-detected patterns in your workflow that could be automated. Click "Apply" to create the automation rule.</DialogDescription>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-sm text-muted-foreground">Analyzing activity patterns...</p>
            </div>
          ) : mutation.data ? (
            <div className="space-y-3 flex-1 min-h-0">
              {mutation.data.suggestions.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Zap className="h-8 w-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">No automation patterns detected yet.</p>
                  <p className="text-xs text-muted-foreground">More activity data is needed — keep using DKFlow and check back later.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {mutation.data.suggestions.map((s, idx) => (
                      <Card key={idx} className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-snug">{s.description}</p>
                            {/* Confidence bar */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                                <div className={`h-full rounded-full ${confidenceBar(s.confidence)}`} style={{ width: `${s.confidence}%` }} />
                              </div>
                              <Badge variant="outline" className={`text-[10px] ${confidenceColor(s.confidence)}`}>
                                {s.confidence}% match
                              </Badge>
                            </div>
                          </div>
                          {applied.has(idx) ? (
                            <Button size="sm" variant="outline" disabled className="gap-1 text-emerald-600 border-emerald-500/30 h-8">
                              <Check className="h-3.5 w-3.5" />
                              Applied
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="gap-1 bg-violet-600 hover:bg-violet-500 text-white h-8"
                              onClick={() => handleApply(s, idx)}
                              disabled={createAutomation.isPending}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Apply
                            </Button>
                          )}
                        </div>

                        {/* Trigger → Action */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md px-2.5 py-1.5">
                            <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider">When</span>
                            <span className="text-xs text-foreground">{s.trigger}</span>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-2.5 py-1.5">
                            <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Then</span>
                            <span className="text-xs text-foreground">{s.action}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      {applied.size > 0 ? `${applied.size} automation${applied.size > 1 ? "s" : ""} applied` : "Select suggestions to apply as automation rules"}
                    </p>
                    <Button variant="outline" size="sm" className="gap-1.5 h-7" onClick={() => { setApplied(new Set()); mutation.mutate({ projectId }); }}>
                      <RefreshCw className="h-3 w-3" />
                      Re-analyze
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
