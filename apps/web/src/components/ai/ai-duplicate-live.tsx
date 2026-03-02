"use client";

import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Copy, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/api/trpc";

interface AiDuplicateLiveProps {
  title: string;
  projectId: string;
  onSelectExisting?: (taskId: string) => void;
}

export function AiDuplicateLive({ title, projectId, onSelectExisting }: AiDuplicateLiveProps) {
  const [similar, setSimilar] = useState<any[]>([]);
  const debounceRef = useRef<NodeJS.Timeout>();

  const mutation = trpc.ai.findSimilarLive.useMutation({
    onSuccess: (data) => setSimilar(data || []),
    onError: () => setSimilar([]),
  });

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (title.length < 5) {
      setSimilar([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      mutation.mutate({ partialTitle: title, projectId });
    }, 800);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [title, projectId]);

  if (similar.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
        <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
          Similar tasks found — possible duplicates
        </span>
      </div>
      <div className="space-y-1">
        {similar.map((t) => (
          <div
            key={t.taskId}
            className="flex items-center justify-between p-2 rounded bg-card border text-sm cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => onSelectExisting?.(t.taskId)}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted-foreground font-mono">DK-{t.taskNumber}</span>
              <span className="truncate">{t.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{t.status}</Badge>
              <Badge variant="secondary" className="text-xs">{t.similarity}%</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
