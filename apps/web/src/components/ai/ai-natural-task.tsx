"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sparkles, Loader2, Send, Calendar, User, Tag, Flag, ArrowRight,
  CheckCircle2, Edit3, Layers,
} from "lucide-react";
import { trpc } from "@/lib/api/trpc";
import { toast } from "sonner";

interface AiNaturalTaskProps {
  projectId: string;
  onCreated?: () => void;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  high: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  low: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
};

export function AiNaturalTask({ projectId, onCreated }: AiNaturalTaskProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [created, setCreated] = useState(false);

  const parseMutation = trpc.ai.parseNaturalTask.useMutation({
    onSuccess: (data) => setParsed(data),
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.ai.createFromNaturalTask.useMutation({
    onSuccess: () => {
      setCreated(true);
      toast.success("Task created successfully!");
      onCreated?.();
      setTimeout(() => { setOpen(false); setInput(""); setParsed(null); setCreated(false); }, 1500);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleParse = () => {
    if (!input.trim()) return;
    parseMutation.mutate({ text: input, projectId });
  };

  const handleCreate = () => {
    if (!parsed) return;
    createMutation.mutate({ projectId, ...parsed });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setParsed(null); setCreated(false); setInput(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Quick Create
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Quick Create
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Describe a task naturally. AI will parse it into a structured task with priority, assignee, due date, and labels.
        </p>

        <div className="flex gap-2 mt-2">
          <Input
            placeholder='e.g. "High priority bug — login crashes on Safari, assign to Dave, due Friday"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleParse()}
            disabled={parseMutation.isPending}
            className="flex-1"
          />
          <Button onClick={handleParse} disabled={!input.trim() || parseMutation.isPending} size="sm">
            {parseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        <div className="text-xs text-muted-foreground mt-1 space-y-1">
          <p>Try: &quot;Create a feature to add dark mode toggle, medium priority, assign to Alice&quot;</p>
          <p>Try: &quot;Urgent bug — payment gateway returns 500 error, due tomorrow&quot;</p>
        </div>

        {parsed && !created && (
          <>
            <Separator className="my-3" />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ArrowRight className="h-4 w-4" />
                AI Parsed Result
              </div>

              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Title</p>
                  <p className="font-medium">{parsed.title}</p>
                </div>

                {parsed.description && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm text-muted-foreground">{parsed.description}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  {parsed.priority && (
                    <div className="flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="outline" className={priorityColors[parsed.priority] || ""}>
                        {parsed.priority}
                      </Badge>
                    </div>
                  )}
                  {parsed.taskType && (
                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <Badge variant="outline">{parsed.taskType}</Badge>
                    </div>
                  )}
                  {parsed.dueDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">{parsed.dueDate}</span>
                    </div>
                  )}
                  {parsed.assigneeId && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm">Assigned</span>
                    </div>
                  )}
                  {parsed.labels?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      {parsed.labels.map((l: string) => (
                        <Badge key={l} variant="secondary" className="text-xs">{l}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setParsed(null)}>
                  <Edit3 className="h-3.5 w-3.5 mr-1" />
                  Re-parse
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Create Task
                </Button>
              </div>
            </div>
          </>
        )}

        {created && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-green-500/10 border border-green-500/20 mt-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Task created successfully!</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
