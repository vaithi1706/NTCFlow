"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/api/trpc";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

interface AiReleaseNotesDialogProps {
  versionId?: string;
  taskIds?: string[];
  workspaceId: string;
}

export function AiReleaseNotesDialog({ versionId, taskIds, workspaceId }: AiReleaseNotesDialogProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const mutation = trpc.ai.generateReleaseNotes.useMutation({
    onError: (err) => {
      toast.error(err.message.includes("Pro") ? "Upgrade to Pro for AI features" : "Failed to generate release notes");
    },
  });

  const handleGenerate = () => {
    setOpen(true);
    mutation.mutate({ versionId, taskIds, workspaceId });
  };

  const handleCopy = async () => {
    if (mutation.data?.releaseNotes) {
      await navigator.clipboard.writeText(mutation.data.releaseNotes);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleGenerate} className="text-violet-500 border-violet-500/30 hover:bg-violet-500/10">
        <Sparkles className="h-3 w-3 mr-1" />Generate Release Notes
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              AI Release Notes
              <Badge variant="secondary" className="text-[10px] bg-violet-500/10 text-violet-500">PRO</Badge>
            </DialogTitle>
          </DialogHeader>

          {mutation.isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
              <span>Generating release notes...</span>
            </div>
          ) : mutation.data ? (
            <div className="prose prose-sm dark:prose-invert max-h-[50vh] overflow-y-auto p-4 bg-muted/30 rounded-lg">
              <ReactMarkdown>{mutation.data.releaseNotes}</ReactMarkdown>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            {mutation.data && (
              <Button onClick={handleCopy} className="bg-violet-500 hover:bg-violet-600">
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
