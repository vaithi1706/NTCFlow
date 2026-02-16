"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/api/trpc";
import { useProjectData } from "@/hooks/use-project-data";
import { toast } from "sonner";
import { Plus, Play, CheckCircle2, Loader2, Zap, Calendar, Target, ChevronDown, ChevronUp, X } from "lucide-react";
import { PdfExportButton } from "@/components/shared/pdf-export-button";
import { format } from "date-fns";

function SprintStatusBadge({ sprint }: { sprint: any }) {
  if (sprint.isCompleted) return <Badge variant="secondary" className="bg-green-500/10 text-green-500">Completed</Badge>;
  if (sprint.isActive) return <Badge variant="secondary" className="bg-blue-500/10 text-blue-500">Active</Badge>;
  return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500">Planned</Badge>;
}

function BurndownChart({ data }: { data: { days: { date: string; remainingPoints: number; ideal: number }[]; totalPoints: number } }) {
  if (!data.days.length) return <p className="text-sm text-muted-foreground p-4">No data yet</p>;
  const maxY = data.totalPoints || 1;
  const w = 600, h = 200, pad = 40;
  const xStep = data.days.length > 1 ? (w - pad * 2) / (data.days.length - 1) : 0;

  const idealLine = data.days.map((d, i) => `${pad + i * xStep},${pad + (1 - d.ideal / maxY) * (h - pad * 2)}`).join(" ");
  const actualLine = data.days.map((d, i) => `${pad + i * xStep},${pad + (1 - d.remainingPoints / maxY) * (h - pad * 2)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[600px]">
      {/* Grid */}
      <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" className="text-border" strokeWidth={1} />
      <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" className="text-border" strokeWidth={1} />
      {/* Labels */}
      <text x={pad - 5} y={pad + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>{maxY}</text>
      <text x={pad - 5} y={h - pad + 4} textAnchor="end" className="fill-muted-foreground" fontSize={10}>0</text>
      {data.days.filter((_, i) => i % Math.max(1, Math.floor(data.days.length / 5)) === 0).map((d, idx) => {
        const i = data.days.indexOf(d);
        return <text key={idx} x={pad + i * xStep} y={h - pad + 14} textAnchor="middle" className="fill-muted-foreground" fontSize={9}>{d.date.slice(5)}</text>;
      })}
      {/* Ideal line */}
      <polyline points={idealLine} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4,4" opacity={0.5} />
      {/* Actual line */}
      <polyline points={actualLine} fill="none" stroke="#22c55e" strokeWidth={2} />
      {/* Legend */}
      <line x1={w - 150} y1={12} x2={w - 130} y2={12} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4,4" />
      <text x={w - 125} y={16} className="fill-muted-foreground" fontSize={10}>Ideal</text>
      <line x1={w - 80} y1={12} x2={w - 60} y2={12} stroke="#22c55e" strokeWidth={2} />
      <text x={w - 55} y={16} className="fill-muted-foreground" fontSize={10}>Actual</text>
    </svg>
  );
}

export default function SprintsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const workspaceSlug = params.workspaceSlug as string;
  const { project } = useProjectData(projectId);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [goal, setGoal] = useState("");
  const [expandedSprint, setExpandedSprint] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: sprints, isLoading } = trpc.sprint.list.useQuery({ projectId });

  const createMutation = trpc.sprint.create.useMutation({
    onSuccess: () => { setCreateOpen(false); setName(""); setStartDate(""); setEndDate(""); setGoal(""); utils.sprint.list.invalidate(); toast.success("Sprint created"); },
    onError: (e) => toast.error(e.message),
  });
  const startMutation = trpc.sprint.start.useMutation({
    onSuccess: () => { utils.sprint.list.invalidate(); toast.success("Sprint started"); },
  });
  const completeMutation = trpc.sprint.complete.useMutation({
    onSuccess: () => { utils.sprint.list.invalidate(); toast.success("Sprint completed"); },
  });

  const handleCreate = () => {
    if (!name.trim() || !startDate || !endDate) return;
    createMutation.mutate({ projectId, name: name.trim(), startDate: new Date(startDate).toISOString(), endDate: new Date(endDate).toISOString(), goal: goal || undefined });
  };

  const handleViewChange = (view: string) => router.push(`/${workspaceSlug}/projects/${projectId}/${view}`);

  const activeSprints = sprints?.filter(s => s.isActive && !s.isCompleted) || [];
  const plannedSprints = sprints?.filter(s => !s.isActive && !s.isCompleted) || [];
  const completedSprints = sprints?.filter(s => s.isCompleted) || [];

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: project?.name || "Project" }, { label: "Sprints" }]} showViewSwitcher showFilter currentView="sprints" onViewChange={handleViewChange} />
      <div className="flex-1 overflow-y-auto p-6 space-y-6" id="sprints-content">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Sprints</h1>
            <p className="text-sm text-muted-foreground">Plan and track your team&apos;s work in time-boxed iterations</p>
          </div>
          <div className="flex items-center gap-2">
            <PdfExportButton targetId="sprints-content" filename="sprints-report" />
            <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Sprint</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />)}</div>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">All ({sprints?.length || 0})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeSprints.length})</TabsTrigger>
              <TabsTrigger value="planned">Planned ({plannedSprints.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed ({completedSprints.length})</TabsTrigger>
            </TabsList>

            {(["all", "active", "planned", "completed"] as const).map(tab => (
              <TabsContent key={tab} value={tab} className="space-y-3">
                {(tab === "all" ? sprints : tab === "active" ? activeSprints : tab === "planned" ? plannedSprints : completedSprints)?.map(sprint => (
                  <SprintCard
                    key={sprint.id}
                    sprint={sprint}
                    expanded={expandedSprint === sprint.id}
                    onToggle={() => setExpandedSprint(expandedSprint === sprint.id ? null : sprint.id)}
                    onStart={() => startMutation.mutate({ id: sprint.id })}
                    onComplete={() => completeMutation.mutate({ id: sprint.id })}
                    startLoading={startMutation.isPending}
                    completeLoading={completeMutation.isPending}
                    projectId={projectId}
                  />
                ))}
                {((tab === "all" ? sprints : tab === "active" ? activeSprints : tab === "planned" ? plannedSprints : completedSprints)?.length || 0) === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Zap className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No {tab === "all" ? "" : tab + " "}sprints yet</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Sprint</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Sprint Name</Label><Input placeholder="Sprint 1" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Sprint Goal (optional)</Label><Textarea placeholder="What do we want to achieve?" value={goal} onChange={e => setGoal(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || !startDate || !endDate || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SprintCard({ sprint, expanded, onToggle, onStart, onComplete, startLoading, completeLoading, projectId }: {
  sprint: any; expanded: boolean; onToggle: () => void; onStart: () => void; onComplete: () => void; startLoading: boolean; completeLoading: boolean; projectId: string;
}) {
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const totalTasks = sprint.tasks?.length || 0;
  const doneTasks = sprint.tasks?.filter((st: any) => st.task.status === "done").length || 0;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const totalPoints = sprint.tasks?.reduce((s: number, st: any) => s + (st.task?.storyPoints || 0), 0) || 0;
  const completedPoints = sprint.tasks?.filter((st: any) => st.task.status === "done").reduce((s: number, st: any) => s + (st.task?.storyPoints || 0), 0) || 0;

  const utils = trpc.useUtils();

  const { data: burndown } = trpc.sprint.getBurndown.useQuery(
    { sprintId: sprint.id },
    { enabled: expanded && sprint.isActive }
  );

  const { data: boardData } = trpc.sprint.getBoard.useQuery(
    { sprintId: sprint.id },
    { enabled: expanded }
  );

  // Fetch project tasks for adding to sprint
  const { data: allColumns } = trpc.board.getColumns.useQuery(
    { projectId },
    { enabled: addTaskOpen }
  );

  const addTaskMutation = trpc.sprint.addTask.useMutation({
    onSuccess: () => {
      utils.sprint.list.invalidate();
      utils.sprint.getBoard.invalidate({ sprintId: sprint.id });
      toast.success("Task added to sprint");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeTaskMutation = trpc.sprint.removeTask.useMutation({
    onSuccess: () => {
      utils.sprint.list.invalidate();
      utils.sprint.getBoard.invalidate({ sprintId: sprint.id });
      toast.success("Task removed from sprint");
    },
    onError: (err) => toast.error(err.message),
  });

  const sprintTaskIds = new Set(sprint.tasks?.map((st: any) => st.task?.id || st.taskId) || []);
  const availableTasks = allColumns?.flatMap((col: any) =>
    (col.tasks || []).filter((t: any) => !sprintTaskIds.has(t.id))
  ) || [];

  return (
    <Card className="overflow-hidden">
      <div className="p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{sprint.name}</h3>
                <SprintStatusBadge sprint={sprint} />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(sprint.startDate), "MMM d")} – {format(new Date(sprint.endDate), "MMM d, yyyy")}</span>
                <span className="flex items-center gap-1"><Target className="h-3 w-3" />{totalTasks} tasks</span>
                {totalPoints > 0 && <span className="flex items-center gap-1">{completedPoints}/{totalPoints} pts</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32">
              <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{doneTasks}/{totalTasks}</span><span>{progress}%</span></div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
            </div>
            <div className="flex items-center gap-1">
              {!sprint.isActive && !sprint.isCompleted && (
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onStart(); }} disabled={startLoading}>
                  <Play className="h-3 w-3 mr-1" />Start
                </Button>
              )}
              {sprint.isActive && !sprint.isCompleted && (
                <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); onComplete(); }} disabled={completeLoading}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />Complete
                </Button>
              )}
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </div>
        {sprint.goal && <p className="text-sm text-muted-foreground mt-2 ml-8">{sprint.goal}</p>}
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          {/* Add Task Button */}
          {!sprint.isCompleted && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAddTaskOpen(!addTaskOpen)}>
                <Plus className="h-3 w-3 mr-1" />{addTaskOpen ? "Hide" : "Add Tasks"}
              </Button>
            </div>
          )}

          {/* Add Task Panel */}
          {addTaskOpen && (
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-muted/20">
              <p className="text-xs font-medium text-muted-foreground">Select tasks to add:</p>
              {availableTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">All tasks are already in this sprint</p>
              ) : (
                availableTasks.map((t: any) => (
                  <button
                    key={t.id}
                    className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left text-sm transition-colors"
                    onClick={() => addTaskMutation.mutate({ sprintId: sprint.id, taskId: t.id })}
                  >
                    <Plus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground font-mono">DK-{t.taskNumber}</span>
                    <span className="truncate">{t.title}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Sprint Stats */}
          <div className="grid grid-cols-5 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold">{totalTasks}</p><p className="text-xs text-muted-foreground">Total Tasks</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold text-green-500">{doneTasks}</p><p className="text-xs text-muted-foreground">Completed</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold text-blue-500">{totalTasks - doneTasks}</p><p className="text-xs text-muted-foreground">Remaining</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold text-primary">{progress}%</p><p className="text-xs text-muted-foreground">Progress</p></div>
            <div className="text-center p-3 rounded-lg bg-muted/50"><p className="text-2xl font-bold text-purple-500">{completedPoints}/{totalPoints}</p><p className="text-xs text-muted-foreground">Story Points</p></div>
          </div>

          {/* Burndown */}
          {sprint.isActive && burndown && (
            <div>
              <h4 className="text-sm font-medium mb-2">Burndown Chart</h4>
              <BurndownChart data={burndown} />
            </div>
          )}

          {/* Board mini-view */}
          {boardData && boardData.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Sprint Board</h4>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {boardData.map((col: any) => (
                  <div key={col.id} className="min-w-[180px] flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color || "#94A3B8" }} />
                      <span className="text-xs font-medium">{col.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{col.tasks.length}</span>
                    </div>
                    <div className="space-y-1">
                      {col.tasks.map((t: any) => (
                        <div key={t.id} className="p-2 rounded border bg-card text-xs flex items-center gap-1 group">
                          <span className="text-muted-foreground font-mono">DK-{t.taskNumber}</span>{" "}
                          <span className="flex-1 truncate">{t.title}</span>
                          {!sprint.isCompleted && (
                            <button
                              className="opacity-0 group-hover:opacity-100 text-destructive transition-opacity flex-shrink-0"
                              onClick={() => removeTaskMutation.mutate({ sprintId: sprint.id, taskId: t.id })}
                              title="Remove from sprint"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      ))}
                      {col.tasks.length === 0 && <p className="text-xs text-muted-foreground italic p-2">No tasks</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
