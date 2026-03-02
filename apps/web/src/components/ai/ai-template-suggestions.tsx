"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Loader2, FileStack, Plus, CheckCircle2, RefreshCw,
  Flag, Layers, Tag,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiTemplateSuggestionsProps {
  projectId: string;
  workspaceId: string;
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-700 dark:text-red-400",
  high: "text-orange-700 dark:text-orange-400",
  medium: "text-yellow-700 dark:text-yellow-400",
  low: "text-green-700 dark:text-green-400",
};

export function AiTemplateSuggestions({ projectId, workspaceId }: AiTemplateSuggestionsProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [created, setCreated] = useState<Set<number>>(new Set());

  const mutation = trpc.ai.suggestTemplates.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const createTemplate = trpc.taskTemplate.create.useMutation({
    onSuccess: (_, __, context) => {
      toast.success("Template created!");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAnalyze = () => mutation.mutate({ projectId });

  const handleCreate = (suggestion: any, index: number) => {
    createTemplate.mutate({
      workspaceId,
      name: suggestion.name,
      description: suggestion.description,
      defaultTitle: suggestion.templateData.title,
      defaultDescription: suggestion.templateData.description,
      defaultType: suggestion.templateData.type,
      defaultPriority: suggestion.templateData.priority,
    } as any);
    setCreated(prev => new Set([...prev, index]));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleAnalyze}>
          <FileStack className="h-4 w-4" />
          AI Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileStack className="h-5 w-5 text-primary" />
            AI Template Suggestions
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          AI analyzes your recent tasks and suggests templates for common patterns.
        </p>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing task patterns...</span>
          </div>
        )}

        {result && (
          <div>
            <div className="space-y-3 pr-4">
              {result.suggestions?.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileStack className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No patterns detected yet. Create more tasks first.</p>
                </div>
              )}

              {result.suggestions?.map((s: any, i: number) => (
                <div key={i} className="rounded-lg border bg-card p-4 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{s.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {s.frequency}x found
                    </Badge>
                  </div>

                  <div className="p-2.5 rounded bg-muted/50 space-y-1.5">
                    <p className="text-xs font-mono text-muted-foreground">{s.templateData.title}</p>
                    {s.templateData.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.templateData.description}</p>
                    )}
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        <Layers className="h-3 w-3 mr-1" />
                        {s.templateData.type}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${priorityColors[s.templateData.priority] || ""}`}>
                        <Flag className="h-3 w-3 mr-1" />
                        {s.templateData.priority}
                      </Badge>
                      {s.templateData.labels?.map((l: string) => (
                        <Badge key={l} variant="secondary" className="text-xs">
                          <Tag className="h-3 w-3 mr-1" />
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground italic">{s.reason}</p>
                    <Button
                      size="sm"
                      variant={created.has(i) ? "ghost" : "default"}
                      className="gap-1.5 h-7"
                      disabled={created.has(i) || createTemplate.isPending}
                      onClick={() => handleCreate(s, i)}
                    >
                      {created.has(i) ? (
                        <><CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> Created</>
                      ) : (
                        <><Plus className="h-3.5 w-3.5" /> Create Template</>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAnalyze}>
              <RefreshCw className="h-3.5 w-3.5" />
              Re-analyze
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
