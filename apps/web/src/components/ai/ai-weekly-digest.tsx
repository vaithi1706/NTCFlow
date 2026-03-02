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

// Strip inline styles from AI-generated email HTML so the preview uses the app theme
function stripInlineStyles(html: string): string {
  return html
    .replace(/\s*style="[^"]*"/gi, "")
    .replace(/<h([12])/g, '<h$1 class="digest-heading"')
    .replace(/<h3/g, '<h3 class="digest-subheading"')
    .replace(/<li/g, '<li class="digest-item"')
    .replace(/<strong/g, '<strong class="digest-strong"')
    .replace(/<span([^>]*)>(\d+%?)<\/span>/g, '<span class="digest-stat"$1>$2</span>');
}

interface AiWeeklyDigestProps {
  workspaceId: string;
}

export function AiWeeklyDigest({ workspaceId }: AiWeeklyDigestProps) {
  const [open, setOpen] = useState(false);

  const mutation = trpc.ai.generateWeeklyDigest.useMutation({
    onError: (err) => toast.error(err.message),
  });

  const sendMutation = trpc.ai.sendDigestToTeam.useMutation({
    onSuccess: (data) => {
      toast.success(`Digest emailed to ${data.sent} team member${data.sent !== 1 ? "s" : ""}${data.failed ? ` (${data.failed} failed)` : ""}`);
      setOpen(false);
    },
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
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
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

              <div className="border border-border rounded-lg p-5 bg-card overflow-y-auto flex-1 min-h-0 digest-preview">
                <div dangerouslySetInnerHTML={{ __html: stripInlineStyles(mutation.data.html) }} />
              </div>

              <DialogFooter className="shrink-0">
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
                <Button
                  className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                  disabled={sendMutation.isPending}
                  onClick={() => {
                    if (!mutation.data) return;
                    sendMutation.mutate({
                      workspaceId,
                      subject: mutation.data.subject,
                      html: mutation.data.html,
                    });
                  }}
                >
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send to Team
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <style jsx global>{`
        .digest-preview h1, .digest-preview h2 {
          font-size: 16px;
          font-weight: 600;
          color: hsl(var(--primary));
          margin: 16px 0 8px;
          padding-bottom: 6px;
          border-bottom: 1px solid hsl(var(--border));
        }
        .digest-preview h3 {
          font-size: 14px;
          font-weight: 600;
          color: hsl(var(--primary));
          margin: 12px 0 6px;
        }
        .digest-preview p {
          font-size: 14px;
          color: hsl(var(--muted-foreground));
          margin: 6px 0;
          line-height: 1.6;
        }
        .digest-preview ul {
          padding-left: 20px;
          margin: 8px 0;
        }
        .digest-preview li {
          font-size: 13px;
          color: hsl(var(--foreground));
          margin: 4px 0;
        }
        .digest-preview strong {
          color: hsl(var(--foreground));
          font-weight: 600;
        }
        .digest-preview .digest-stat {
          font-size: 22px;
          font-weight: 700;
          color: hsl(var(--primary));
        }
        .digest-preview div[style] {
          all: unset;
        }
        .digest-preview span {
          color: hsl(var(--foreground));
        }
        .digest-preview hr {
          border-color: hsl(var(--border));
          margin: 12px 0;
        }
      `}</style>
    </>
  );
}
