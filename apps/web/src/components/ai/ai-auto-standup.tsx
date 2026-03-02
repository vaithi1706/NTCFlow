"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Loader2, CheckCircle2, Clock, AlertTriangle,
  Clipboard, RefreshCw, Megaphone,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiAutoStandupProps {
  projectId: string;
}

export function AiAutoStandup({ projectId }: AiAutoStandupProps) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<any>(null);

  const mutation = trpc.ai.autoStandup.useMutation({
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    mutation.mutate({ projectId });
  };

  const copyToClipboard = () => {
    if (!result) return;
    const text = result.standups.map((s: any) =>
      `**${s.name}**\nDone: ${s.done.join("; ")}\nDoing: ${s.doing.join("; ")}\nBlockers: ${s.blockers.length > 0 ? s.blockers.join("; ") : "None"}`
    ).join("\n\n") + `\n\n---\n${result.teamSummary}`;
    navigator.clipboard.writeText(text);
    toast.success("Standup copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleGenerate}>
          <Megaphone className="h-4 w-4" />
          AI Standup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            AI Daily Standup
          </DialogTitle>
        </DialogHeader>

        {mutation.isPending && (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Analyzing team activity...</span>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Team Summary */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-sm font-medium mb-1">Team Summary</p>
              <p className="text-sm text-muted-foreground">{result.teamSummary}</p>
            </div>

            {/* Highlights */}
            {result.highlights?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Highlights</p>
                {result.highlights.map((h: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Individual Standups */}
            {result.standups?.map((s: any, i: number) => (
              <div key={i} className="rounded-lg border bg-card p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                    {s.name?.charAt(0)?.toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{s.name}</span>
                </div>

                <div className="space-y-2 pl-10">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-xs font-medium text-green-700 dark:text-green-400">Done</span>
                    </div>
                    {s.done?.map((item: string, j: number) => (
                      <p key={j} className="text-sm text-muted-foreground ml-5">• {item}</p>
                    ))}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-400">In Progress</span>
                    </div>
                    {s.doing?.map((item: string, j: number) => (
                      <p key={j} className="text-sm text-muted-foreground ml-5">• {item}</p>
                    ))}
                  </div>

                  {s.blockers?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                        <span className="text-xs font-medium text-red-700 dark:text-red-400">Blockers</span>
                      </div>
                      {s.blockers.map((item: string, j: number) => (
                        <p key={j} className="text-sm text-red-600 dark:text-red-400 ml-5">• {item}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Action buttons */}
            <div className="flex gap-2 justify-end pt-2 border-t">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleGenerate}>
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </Button>
              <Button size="sm" className="gap-1.5" onClick={copyToClipboard}>
                <Clipboard className="h-3.5 w-3.5" />
                Copy to Clipboard
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
