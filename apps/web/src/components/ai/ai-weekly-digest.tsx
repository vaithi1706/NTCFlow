"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Mail, Eye } from "lucide-react";
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
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
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Subject:</span>
                <span className="text-sm text-muted-foreground">{mutation.data.subject}</span>
              </div>

              <div className="border rounded-lg p-4 bg-white dark:bg-zinc-950 overflow-y-auto max-h-96">
                <div dangerouslySetInnerHTML={{ __html: mutation.data.html }} />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500" onClick={() => { toast.success("Digest ready! Email sending coming soon."); setOpen(false); }}>
                  <Mail className="h-4 w-4 mr-2" />Send to Team
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
