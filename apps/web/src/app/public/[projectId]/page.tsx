"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { trpc } from "@/lib/api/trpc";

export default function PublicBoardPage() {
  const { projectId } = useParams() as { projectId: string };
  const { data, isLoading, error } = trpc.project.getPublicBoard.useQuery({ projectId });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Board Not Found</h1>
          <p className="text-muted-foreground">This board doesn&apos;t exist or is not public.</p>
        </div>
      </div>
    );
  }

  const { project, columns, tasks } = data;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ backgroundColor: project.color || "#3B82F6" }}
          >
            {project.name[0]}
          </div>
          <div>
            <h1 className="text-lg font-bold">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>
          <Badge variant="secondary" className="ml-auto">Public Board</Badge>
        </div>
      </header>

      <div className="p-6 overflow-x-auto">
        <div className="flex gap-4 min-w-max">
          {columns.map((col: any) => {
            const colTasks = tasks.filter((t: any) => t.columnId === col.id);
            return (
              <div key={col.id} className="w-72 flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: col.color || "#94A3B8" }}
                  />
                  <h3 className="text-sm font-semibold">{col.name}</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task: any) => (
                    <div key={task.id} className="rounded-lg border border-border bg-card p-3">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          #{task.taskNumber}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium">{task.title}</h4>
                      {task.labels?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {task.labels.map((tl: any) => (
                            <Badge
                              key={tl.label?.id || tl.id}
                              variant="secondary"
                              className="text-[10px]"
                              style={{
                                backgroundColor: (tl.label?.color || tl.color) + "20",
                                color: tl.label?.color || tl.color,
                              }}
                            >
                              {tl.label?.name || tl.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
