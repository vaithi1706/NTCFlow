"use client";

import { useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Grid3X3, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Quadrant {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
  border: string;
  text: string;
  priorities: string[];
}

const QUADRANTS: Quadrant[] = [
  {
    id: "do_first",
    title: "🔥 Do First",
    subtitle: "Urgent & Important",
    bg: "bg-red-500/5",
    border: "border-red-500/20",
    text: "text-red-400",
    priorities: ["urgent"],
  },
  {
    id: "schedule",
    title: "📋 Schedule",
    subtitle: "Not Urgent & Important",
    bg: "bg-blue-500/5",
    border: "border-blue-500/20",
    text: "text-blue-400",
    priorities: ["high"],
  },
  {
    id: "delegate",
    title: "👥 Delegate",
    subtitle: "Urgent & Not Important",
    bg: "bg-yellow-500/5",
    border: "border-yellow-500/20",
    text: "text-yellow-400",
    priorities: ["medium"],
  },
  {
    id: "eliminate",
    title: "🗑️ Eliminate",
    subtitle: "Not Urgent & Not Important",
    bg: "bg-slate-500/5",
    border: "border-slate-500/20",
    text: "text-slate-400",
    priorities: ["low", "none"],
  },
];

function getQuadrantForPriority(priority: string): string {
  if (priority === "urgent") return "do_first";
  if (priority === "high") return "schedule";
  if (priority === "medium") return "delegate";
  return "eliminate";
}

function getPriorityForQuadrant(quadrantId: string): string {
  if (quadrantId === "do_first") return "urgent";
  if (quadrantId === "schedule") return "high";
  if (quadrantId === "delegate") return "medium";
  return "low";
}

export default function MatrixPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { workspaceId } = useAuthStore();
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null);

  const { data: project } = trpc.project.getById.useQuery({ id: projectId }, { enabled: !!projectId });

  const { data: taskData, isLoading } = trpc.task.list.useQuery(
    { projectId, limit: 100 },
    { enabled: !!projectId }
  );

  const utils = trpc.useUtils();
  const updateMutation = trpc.task.update.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate({ projectId });
      toast.success("Priority updated");
    },
  });

  const tasks = taskData?.tasks || [];
  const activeTasks = tasks.filter((t: any) => t.status !== "done" && t.status !== "cancelled");

  const quadrantTasks = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const q of QUADRANTS) map[q.id] = [];
    for (const task of activeTasks) {
      const qId = getQuadrantForPriority(task.priority || "none");
      map[qId].push(task);
    }
    return map;
  }, [activeTasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, quadrantId: string) => {
    e.preventDefault();
    setDragOverQuadrant(quadrantId);
  };

  const handleDrop = (e: React.DragEvent, quadrantId: string) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    if (!draggedTask) return;
    const newPriority = getPriorityForQuadrant(quadrantId);
    updateMutation.mutate({ id: draggedTask, priority: newPriority as any });
    setDraggedTask(null);
  };

  const handleViewChange = (view: string) => {
    router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);
  };

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "DKFlow", href: "/home" },
          { label: project?.name || "Project", href: `/${workspaceSlug}/projects/${projectId}/board` },
          { label: "Priority Matrix" },
        ]}
        showViewSwitcher
        currentView="matrix"
        onViewChange={handleViewChange}
        projectId={projectId}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="flex items-center gap-2 mb-4">
          <Grid3X3 className="h-5 w-5 text-indigo-400" />
          <h2 className="text-lg font-semibold">Eisenhower Priority Matrix</h2>
          <span className="text-xs text-muted-foreground ml-2">{activeTasks.length} active tasks</span>
        </div>

        {isLoading ? (
          <Skeleton className="h-[600px] w-full rounded-lg" />
        ) : (
          <div className="grid grid-cols-2 gap-3 h-[calc(100vh-180px)]">
            {QUADRANTS.map((q) => (
              <div
                key={q.id}
                className={`rounded-xl border ${q.border} ${q.bg} p-4 overflow-y-auto transition-all ${
                  dragOverQuadrant === q.id ? "ring-2 ring-indigo-500 scale-[1.01]" : ""
                }`}
                onDragOver={(e) => handleDragOver(e, q.id)}
                onDragLeave={() => setDragOverQuadrant(null)}
                onDrop={(e) => handleDrop(e, q.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className={`text-sm font-semibold ${q.text}`}>{q.title}</h3>
                    <p className="text-[10px] text-muted-foreground">{q.subtitle}</p>
                  </div>
                  <Badge variant="outline" className={`${q.text} text-[10px]`}>
                    {quadrantTasks[q.id]?.length || 0}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {quadrantTasks[q.id]?.map((task: any) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className={`bg-slate-900/80 border border-border/50 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-indigo-500/30 transition-all ${
                        draggedTask === task.id ? "opacity-50" : ""
                      }`}
                    >
                      <p className="text-xs font-medium mb-1 line-clamp-2">{task.title}</p>
                      <div className="flex items-center gap-2">
                        {task.assignees?.[0]?.user && (
                          <Avatar className="h-4 w-4">
                            {task.assignees[0].user.avatarUrl && <AvatarImage src={task.assignees[0].user.avatarUrl} />}
                            <AvatarFallback className="text-[8px]">
                              {task.assignees[0].user.name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {task.dueDate && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Calendar className="h-2.5 w-2.5" />
                            {format(new Date(task.dueDate), "MMM d")}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">#{task.taskNumber}</span>
                      </div>
                    </div>
                  ))}
                  {!quadrantTasks[q.id]?.length && (
                    <p className="text-xs text-muted-foreground text-center py-8 opacity-50">
                      Drag tasks here
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
