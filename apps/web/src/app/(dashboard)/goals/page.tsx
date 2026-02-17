"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { Target, Plus, ChevronDown, ChevronRight, Link2, Trash2, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  on_track: "bg-green-500/10 text-green-400 border-green-500/20",
  at_risk: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  behind: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const statusLabels: Record<string, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  behind: "Behind",
  completed: "Completed",
};

function progressColor(p: number) {
  if (p > 70) return "bg-green-500";
  if (p >= 40) return "bg-yellow-500";
  return "bg-red-500";
}

export default function GoalsPage() {
  const { workspaceId } = useAuthStore();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [createKROpen, setCreateKROpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newGoal, setNewGoal] = useState({ title: "", description: "", dueDate: "" });
  const [newKR, setNewKR] = useState({ title: "", targetValue: "", currentValue: "" });

  const utils = trpc.useUtils();

  const { data: goals, isLoading } = trpc.goal.list.useQuery(
    {
      workspaceId: workspaceId || "",
      ...(filterStatus !== "all" ? { status: filterStatus } : {}),
    },
    { enabled: !!workspaceId }
  );

  const createMutation = trpc.goal.create.useMutation({
    onSuccess: () => {
      utils.goal.list.invalidate();
      setCreateOpen(false);
      setNewGoal({ title: "", description: "", dueDate: "" });
      toast.success("Objective created");
    },
    onError: (e) => toast.error(e.message),
  });

  const createKRMutation = trpc.goal.create.useMutation({
    onSuccess: () => {
      utils.goal.list.invalidate();
      setCreateKROpen(null);
      setNewKR({ title: "", targetValue: "", currentValue: "" });
      toast.success("Key Result created");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.goal.delete.useMutation({
    onSuccess: () => {
      utils.goal.list.invalidate();
      toast.success("Deleted");
    },
  });

  const updateMutation = trpc.goal.update.useMutation({
    onSuccess: () => utils.goal.list.invalidate(),
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Goals" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-indigo-400" /> Goals & OKRs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Track objectives and key results</p>
          </div>
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="on_track">On Track</SelectItem>
                <SelectItem value="at_risk">At Risk</SelectItem>
                <SelectItem value="behind">Behind</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Objective
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
          </div>
        ) : !goals?.length ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Target className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">No goals yet</p>
            <p className="text-sm">Create your first objective to get started</p>
            <Button className="mt-4" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create Objective
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((obj: any) => (
              <Card key={obj.id} className="border-border/50 bg-slate-900/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <button onClick={() => toggleExpand(obj.id)} className="mt-1 text-muted-foreground hover:text-foreground">
                      {expanded.has(obj.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-sm">{obj.title}</h3>
                        <Badge variant="outline" className={statusColors[obj.status] || ""}>
                          {statusLabels[obj.status] || obj.status}
                        </Badge>
                        <Select
                          value={obj.status}
                          onValueChange={(v) => updateMutation.mutate({ id: obj.id, status: v as any })}
                        >
                          <SelectTrigger className="h-6 w-6 p-0 border-0 bg-transparent [&>svg]:hidden">
                            <span />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="on_track">On Track</SelectItem>
                            <SelectItem value="at_risk">At Risk</SelectItem>
                            <SelectItem value="behind">Behind</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        {obj.dueDate && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(obj.dueDate), "MMM d, yyyy")}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {obj._count?.taskLinks || 0} tasks · {obj.children?.length || 0} KRs
                        </span>
                      </div>
                      {obj.description && (
                        <p className="text-xs text-muted-foreground mb-2">{obj.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progressColor(obj.progress)}`}
                            style={{ width: `${obj.progress}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium tabular-nums w-10 text-right">{obj.progress}%</span>
                      </div>

                      {expanded.has(obj.id) && (
                        <div className="mt-4 space-y-2 pl-2 border-l-2 border-indigo-500/30">
                          {obj.children?.map((kr: any) => (
                            <div key={kr.id} className="bg-slate-800/50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{kr.title}</span>
                                <Badge variant="outline" className="text-[10px] h-5">KR</Badge>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {kr._count?.taskLinks || 0} tasks
                                </span>
                                <Button
                                  variant="ghost" size="icon" className="h-6 w-6"
                                  onClick={() => deleteMutation.mutate({ id: kr.id })}
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${progressColor(kr.progress)}`}
                                    style={{ width: `${kr.progress}%` }}
                                  />
                                </div>
                                <span className="text-[10px] tabular-nums">{kr.progress}%</span>
                              </div>
                              {kr.targetValue != null && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {kr.currentValue ?? 0} / {kr.targetValue}
                                </p>
                              )}
                            </div>
                          ))}
                          <Button
                            variant="ghost" size="sm" className="text-xs h-7"
                            onClick={() => setCreateKROpen(obj.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Key Result
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                      onClick={() => deleteMutation.mutate({ id: obj.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Objective Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Objective</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Increase user engagement"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe this objective..."
                value={newGoal.description}
                onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newGoal.dueDate}
                onChange={(e) => setNewGoal({ ...newGoal, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate({
                workspaceId: workspaceId!,
                title: newGoal.title,
                description: newGoal.description || undefined,
                type: "objective",
                dueDate: newGoal.dueDate ? new Date(newGoal.dueDate).toISOString() : undefined,
              })}
              disabled={!newGoal.title.trim() || createMutation.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Key Result Dialog */}
      <Dialog open={!!createKROpen} onOpenChange={() => setCreateKROpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Key Result</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="e.g. Reach 10,000 daily active users"
                value={newKR.title}
                onChange={(e) => setNewKR({ ...newKR, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Value</Label>
                <Input
                  type="number"
                  placeholder="10000"
                  value={newKR.targetValue}
                  onChange={(e) => setNewKR({ ...newKR, targetValue: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Current Value</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newKR.currentValue}
                  onChange={(e) => setNewKR({ ...newKR, currentValue: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKROpen(null)}>Cancel</Button>
            <Button
              onClick={() => createKRMutation.mutate({
                workspaceId: workspaceId!,
                title: newKR.title,
                type: "key_result",
                parentId: createKROpen!,
                targetValue: newKR.targetValue ? parseFloat(newKR.targetValue) : undefined,
                currentValue: newKR.currentValue ? parseFloat(newKR.currentValue) : undefined,
              })}
              disabled={!newKR.title.trim() || createKRMutation.isPending}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
