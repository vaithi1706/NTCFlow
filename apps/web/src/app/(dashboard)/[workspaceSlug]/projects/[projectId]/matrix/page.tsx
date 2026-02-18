"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PriorityBadge } from "@/components/shared/priority-badge";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import {
  Grid3X3, Calendar, AlertTriangle, ClipboardList,
  Users, Trash2, GripVertical,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Quadrant {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  bg: string;
  bgHover: string;
  border: string;
  titleColor: string;
  cardBg: string;
  cardBorder: string;
  priorities: string[];
}

const QUADRANTS: Quadrant[] = [
  {
    id: "do_first",
    title: "Do First",
    subtitle: "Urgent & Important",
    icon: AlertTriangle,
    iconColor: "text-red-400",
    bg: "bg-red-500/5",
    bgHover: "bg-red-500/10",
    border: "border-red-500/20",
    titleColor: "text-red-400",
    cardBg: "bg-red-500/5 hover:bg-red-500/10",
    cardBorder: "border-red-500/10 hover:border-red-500/30",
    priorities: ["urgent"],
  },
  {
    id: "schedule",
    title: "Schedule",
    subtitle: "Not Urgent & Important",
    icon: ClipboardList,
    iconColor: "text-blue-400",
    bg: "bg-blue-500/5",
    bgHover: "bg-blue-500/10",
    border: "border-blue-500/20",
    titleColor: "text-blue-400",
    cardBg: "bg-blue-500/5 hover:bg-blue-500/10",
    cardBorder: "border-blue-500/10 hover:border-blue-500/30",
    priorities: ["high"],
  },
  {
    id: "delegate",
    title: "Delegate",
    subtitle: "Urgent & Not Important",
    icon: Users,
    iconColor: "text-amber-400",
    bg: "bg-amber-500/5",
    bgHover: "bg-amber-500/10",
    border: "border-amber-500/20",
    titleColor: "text-amber-400",
    cardBg: "bg-amber-500/5 hover:bg-amber-500/10",
    cardBorder: "border-amber-500/10 hover:border-amber-500/30",
    priorities: ["medium"],
  },
  {
    id: "eliminate",
    title: "Eliminate",
    subtitle: "Not Urgent & Not Important",
    icon: Trash2,
    iconColor: "text-muted-foreground",
    bg: "bg-slate-500/5",
    bgHover: "bg-slate-500/10",
    border: "border-slate-500/20",
    titleColor: "text-muted-foreground",
    cardBg: "bg-slate-500/5 hover:bg-slate-500/10",
    cardBorder: "border-slate-500/10 hover:border-slate-500/30",
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
    { projectId, limit: 200 },
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
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent, quadrantId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverQuadrant(quadrantId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the quadrant, not entering a child
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverQuadrant(null);
    }
  };

  const handleDrop = (e: React.DragEvent, quadrantId: string) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    if (!draggedTask) return;

    const task = activeTasks.find((t: any) => t.id === draggedTask);
    const currentQuadrant = task ? getQuadrantForPriority(task.priority || "none") : null;

    // Don't update if dropped in same quadrant
    if (currentQuadrant === quadrantId) {
      setDraggedTask(null);
      return;
    }

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
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <Grid3X3 className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Eisenhower Priority Matrix</h2>
            <p className="text-xs text-muted-foreground">{activeTasks.length} active tasks · Drag tasks between quadrants to reprioritize</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 h-[calc(100vh-200px)]">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-[calc(100vh-200px)]">
            {QUADRANTS.map((q) => {
              const Icon = q.icon;
              const qTasks = quadrantTasks[q.id] || [];
              const isOver = dragOverQuadrant === q.id;

              return (
                <div
                  key={q.id}
                  className={`rounded-xl border ${q.border} ${isOver ? q.bgHover : q.bg} p-4 flex flex-col transition-all duration-200 ${
                    isOver ? "ring-2 ring-primary/50 scale-[1.005]" : ""
                  }`}
                  onDragOver={(e) => handleDragOver(e, q.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, q.id)}
                >
                  {/* Quadrant Header */}
                  <div className="flex items-center justify-between mb-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${q.iconColor}`} />
                      <div>
                        <h3 className={`text-sm font-semibold ${q.titleColor}`}>{q.title}</h3>
                        <p className="text-[10px] text-muted-foreground leading-tight">{q.subtitle}</p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${q.titleColor} bg-transparent border ${q.border} text-[10px] h-5 min-w-[20px] justify-center`}
                    >
                      {qTasks.length}
                    </Badge>
                  </div>

                  {/* Task List */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                    {qTasks.map((task: any) => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={() => setDraggedTask(null)}
                        className={`group border ${q.cardBorder} ${q.cardBg} rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 ${
                          draggedTask === task.id ? "opacity-40 scale-95" : ""
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground/60 mt-0.5 flex-shrink-0 transition-colors" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium leading-snug line-clamp-2">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <PriorityBadge priority={task.priority || "none"} />
                              {task.assignees?.[0]?.user && (
                                <Avatar className="h-4 w-4">
                                  {task.assignees[0].user.avatarUrl && (
                                    <AvatarImage src={task.assignees[0].user.avatarUrl} />
                                  )}
                                  <AvatarFallback className="text-[7px] bg-muted">
                                    {task.assignees[0].user.name?.[0]?.toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              {task.dueDate && (
                                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />
                                  {format(new Date(task.dueDate), "MMM d")}
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground/60 ml-auto font-mono">
                                #{task.taskNumber}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!qTasks.length && (
                      <div className="flex items-center justify-center h-full min-h-[80px]">
                        <p className="text-xs text-muted-foreground/40">Drag tasks here</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
