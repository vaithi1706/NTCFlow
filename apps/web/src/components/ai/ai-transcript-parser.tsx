"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles, Loader2, FileAudio, ListChecks, CheckCircle2, User,
  Calendar, Flag, MessageSquare, Plus, ArrowRight, ClipboardList,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiTranscriptParserProps {
  projectId: string;
  onTasksCreated?: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-700 dark:text-red-400",
  high: "text-orange-700 dark:text-orange-400",
  medium: "text-yellow-700 dark:text-yellow-400",
  low: "text-green-700 dark:text-green-400",
};

export function AiTranscriptParser({ projectId, onTasksCreated }: AiTranscriptParserProps) {
  const [open, setOpen] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<any>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [createdCount, setCreatedCount] = useState(0);

  const parseMutation = trpc.ai.parseTranscript.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setSelectedTasks(new Set(data.tasks?.map((_: any, i: number) => i) || []));
    },
    onError: (err) => toast.error(err.message),
  });

  const handleParse = () => {
    if (!transcript.trim()) return;
    parseMutation.mutate({ transcript, projectId });
  };

  const toggleTask = (index: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResult(null); setTranscript(""); setCreatedCount(0); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileAudio className="h-4 w-4" />
          Meeting Notes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileAudio className="h-5 w-5 text-primary" />
            AI Meeting Notes Parser
          </DialogTitle>
        </DialogHeader>

        {!result && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste meeting notes, transcript, or minutes. AI will extract tasks, decisions, follow-ups, and a summary.
            </p>
            <Textarea
              placeholder="Paste your meeting notes or transcript here..."
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
            <Button onClick={handleParse} disabled={!transcript.trim() || parseMutation.isPending} className="gap-2">
              {parseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Analyze Meeting Notes
            </Button>
          </div>
        )}

        {result && (
          <div>
            <div className="space-y-4 pr-4">
              {/* Summary */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium text-primary">Meeting Summary</span>
                </div>
                <p className="text-sm">{result.summary}</p>
              </div>

              {/* Key Topics */}
              {result.keyTopics?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.keyTopics.map((t: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              )}

              {/* Decisions */}
              {result.decisions?.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Decisions Made
                  </p>
                  <ul className="space-y-1 ml-6">
                    {result.decisions.map((d: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground list-disc">{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Extracted Tasks */}
              {result.tasks?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <ListChecks className="h-4 w-4 text-primary" />
                        Extracted Tasks ({result.tasks.length})
                      </p>
                      <span className="text-xs text-muted-foreground">{selectedTasks.size} selected</span>
                    </div>
                    <div className="space-y-2">
                      {result.tasks.map((t: any, i: number) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedTasks.has(i) ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-accent/50"
                          }`}
                          onClick={() => toggleTask(i)}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`h-4 w-4 rounded border mt-0.5 shrink-0 flex items-center justify-center ${
                              selectedTasks.has(i) ? "bg-primary border-primary" : "border-muted-foreground/30"
                            }`}>
                              {selectedTasks.has(i) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{t.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                              <div className="flex gap-2 mt-1.5 flex-wrap">
                                <Badge variant="outline" className="text-xs">{t.type}</Badge>
                                <Badge variant="outline" className={`text-xs ${priorityColors[t.priority] || ""}`}>
                                  <Flag className="h-3 w-3 mr-0.5" /> {t.priority}
                                </Badge>
                                {t.assigneeName && (
                                  <Badge variant="secondary" className="text-xs">
                                    <User className="h-3 w-3 mr-0.5" /> {t.assigneeName}
                                  </Badge>
                                )}
                                {t.dueDate && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-0.5" /> {t.dueDate}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Follow-ups */}
              {result.followUps?.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                      <ArrowRight className="h-4 w-4 text-primary" />
                      Follow-ups
                    </p>
                    <div className="space-y-1.5">
                      {result.followUps.map((f: any, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">
                            {f.item}
                            {f.owner && <span className="text-primary"> ({f.owner})</span>}
                            {f.deadline && <span className="text-primary"> by {f.deadline}</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {result && (
          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => { setResult(null); }}>
              Back to Input
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
