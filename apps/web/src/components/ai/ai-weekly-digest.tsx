"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

interface AiWeeklyDigestProps {
  workspaceId: string;
}

export function AiWeeklyDigest({ workspaceId }: AiWeeklyDigestProps) {
  const [open, setOpen] = useState(false);

  const mutation = trpc.ai.generateWeeklyDigest.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const handleGenerate = () => {
    setOpen(true);
    mutation.mutate({ workspaceId });
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={handleGenerate}>
        <Sparkles className="h-3.5 w-3.5" />
        Weekly Digest
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                <Mail className="h-4 w-4 text-violet-400" />
              </div>
              Weekly Digest Preview
            </DialogTitle>
            <DialogDescription>AI-generated weekly summary of your workspace activity.</DialogDescription>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
              <p className="text-sm text-muted-foreground">Generating digest...</p>
            </div>
          ) : mutation.data ? (
            <div className="flex flex-col gap-4 min-h-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 shrink-0">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Subject:</span>
                <span className="text-sm text-muted-foreground">{mutation.data.subject}</span>
              </div>

              <div className="border border-border rounded-lg p-4 bg-slate-900 overflow-y-auto flex-1 min-h-0 prose prose-invert prose-sm max-w-none
                [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-violet-400 [&_h1]:mb-2
                [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-blue-400 [&_h2]:mb-2 [&_h2]:mt-4
                [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-purple-400 [&_h3]:mb-1
                [&_p]:text-sm [&_p]:text-slate-300 [&_p]:mb-2 [&_p]:leading-relaxed
                [&_ul]:text-sm [&_ul]:text-slate-300 [&_ul]:space-y-1 [&_ul]:mb-3
                [&_li]:text-sm [&_li]:text-slate-300
                [&_strong]:text-slate-100
                [&_a]:text-violet-400 [&_a]:no-underline
                [&_hr]:border-slate-700 [&_hr]:my-3
                [&_table]:w-full [&_table]:text-sm
                [&_th]:text-left [&_th]:p-2 [&_th]:text-slate-400 [&_th]:border-b [&_th]:border-slate-700
                [&_td]:p-2 [&_td]:text-slate-300 [&_td]:border-b [&_td]:border-slate-800
              ">
                <div dangerouslySetInnerHTML={{ __html: mutation.data.html }} />
              </div>

              <DialogFooter className="shrink-0">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500" onClick={() => { toast.success("Digest sent to team!"); setOpen(false); }}>
                  <Mail className="h-4 w-4 mr-2" />Send to Team
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
