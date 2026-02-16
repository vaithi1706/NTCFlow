"use client";

import { useEffect, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/api/trpc";
import { AlertTriangle, Loader2, X } from "lucide-react";

interface AiDuplicateWarningProps {
  title: string;
  description?: string;
  projectId: string;
  onSelectTask?: (taskId: string) => void;
}

export function AiDuplicateWarning({ title, description, projectId, onSelectTask }: AiDuplicateWarningProps) {
  const [dismissed, setDismissed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const checkMutation = trpc.ai.checkDuplicate.useMutation();

  useEffect(() => {
    setDismissed(false);
    if (!title || title.length < 5) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      checkMutation.mutate({ title, description, projectId });
    }, 1500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);

  if (dismissed) return null;
  if (!checkMutation.data?.duplicates?.length) return null;

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-sm">
      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-1">⚠️ Similar tasks found</p>
        <div className="space-y-1">
          {checkMutation.data.duplicates.slice(0, 3).map((dup) => (
            <div
              key={dup.taskId}
              className="flex items-center gap-2 cursor-pointer hover:underline"
              onClick={() => onSelectTask?.(dup.taskId)}
            >
              <span className="text-xs truncate">{dup.title}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0 bg-yellow-500/10 text-yellow-600">
                {dup.similarity}% similar
              </Badge>
            </div>
          ))}
        </div>
      </div>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
