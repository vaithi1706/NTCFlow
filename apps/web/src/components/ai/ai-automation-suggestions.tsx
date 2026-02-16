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
import { Sparkles, Loader2, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface AiAutomationSuggestionsProps {
  projectId: string;
}

export function AiAutomationSuggestions({ projectId }: AiAutomationSuggestionsProps) {
  const [open, setOpen] = useState(false);

  const mutation = trpc.ai.suggestAutomations.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleOpen = () => {
    setOpen(true);
    mutation.mutate({ projectId });
  };

  const confidenceColor = (c: number) => {
    if (c >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (c >= 60) return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    return "text-orange-400 border-orange-500/30 bg-orange-500/10";
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={handleOpen}>
        <Sparkles className="h-3.5 w-3.5" />
        AI Automation Suggestions
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] flex flex-col max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Zap className="h-4 w-4 text-violet-400" />
              </div>
              Smart Automation Suggestions
            </DialogTitle>
            <DialogDescription>AI-detected patterns in your workflow that could be automated.</DialogDescription>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">Analyzing activity patterns...</p>
            </div>
          ) : mutation.data ? (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {mutation.data.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No automation patterns detected yet. More activity data needed.</p>
              ) : (
                mutation.data.suggestions.map((s, idx) => (
                  <Card key={idx} className="p-4 space-y-2 border-border/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium flex-1">{s.description}</p>
                      <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${confidenceColor(s.confidence)}`}>
                        {s.confidence}%
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px]">When: {s.trigger}</Badge>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="secondary" className="text-[10px]">Then: {s.action}</Badge>
                    </div>
                  </Card>
                ))
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
