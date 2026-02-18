"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/api/trpc";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  todo: { bg: "bg-slate-500/20", text: "text-muted-foreground", label: "TO DO" },
  in_progress: { bg: "bg-blue-500/20", text: "text-blue-400", label: "IN PROGRESS" },
  done: { bg: "bg-green-500/20", text: "text-green-400", label: "DONE" },
};

const PRESET_COLORS = ["#6B7280", "#94A3B8", "#3B82F6", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"];

export function WorkflowEditor({ projectId }: { projectId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>("todo");
  const [newColor, setNewColor] = useState("#94A3B8");
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("todo");
  const [editColor, setEditColor] = useState("#94A3B8");

  const utils = trpc.useUtils();
  const { data: statuses, isLoading } = trpc.workflow.list.useQuery({ projectId });
  const { data: transitions } = trpc.workflow.getTransitions.useQuery({ projectId });

  const seedMutation = trpc.workflow.seedDefaults.useMutation({
    onSuccess: () => { utils.workflow.list.invalidate({ projectId }); utils.workflow.getTransitions.invalidate({ projectId }); toast.success("Default workflow created"); },
  });

  const createMutation = trpc.workflow.createStatus.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate({ projectId });
      setAddOpen(false);
      setNewName("");
      toast.success("Status created");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.workflow.updateStatus.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate({ projectId });
      setEditOpen(null);
      toast.success("Status updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.workflow.deleteStatus.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate({ projectId });
      utils.workflow.getTransitions.invalidate({ projectId });
      toast.success("Status deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const addTransitionMutation = trpc.workflow.addTransition.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate({ projectId });
      utils.workflow.getTransitions.invalidate({ projectId });
    },
  });

  const removeTransitionMutation = trpc.workflow.removeTransition.useMutation({
    onSuccess: () => {
      utils.workflow.list.invalidate({ projectId });
      utils.workflow.getTransitions.invalidate({ projectId });
    },
  });

  const transitionSet = new Set(transitions?.map((t) => `${t.fromStatusId}->${t.toStatusId}`) || []);

  const handleToggleTransition = (fromId: string, toId: string) => {
    const key = `${fromId}->${toId}`;
    if (transitionSet.has(key)) {
      removeTransitionMutation.mutate({ fromStatusId: fromId, toStatusId: toId });
    } else {
      addTransitionMutation.mutate({ fromStatusId: fromId, toStatusId: toId });
    }
  };

  const openEdit = (status: any) => {
    setEditOpen(status.id);
    setEditName(status.name);
    setEditCategory(status.category);
    setEditColor(status.color);
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading workflow...</div>;

  if (!statuses || statuses.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
          <CardDescription>No workflow statuses configured</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => seedMutation.mutate({ projectId })} disabled={seedMutation.isPending}>
            {seedMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Create Default Workflow
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Workflow Statuses</CardTitle>
          <CardDescription>Define statuses and allowed transitions</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setTransitionOpen(true)}>
            Transitions
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />Add Status
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {statuses.map((status) => {
            const cat = CATEGORY_COLORS[status.category] || CATEGORY_COLORS.todo;
            return (
              <div key={status.id} className="flex items-center gap-3 py-2 px-2 rounded-md hover:bg-muted/50">
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: status.color }} />
                <span className="text-sm font-medium flex-1">{status.name}</span>
                <Badge variant="secondary" className={`text-[10px] ${cat.bg} ${cat.text} border-0`}>
                  {cat.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {status.transitions?.length || 0} transitions
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(status)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate({ id: status.id })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Add Status Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Add Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Blocked" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate({ projectId, name: newName.trim(), category: newCategory as any, color: newColor })}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={!!editOpen} onOpenChange={() => setEditOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${editColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => updateMutation.mutate({ id: editOpen!, name: editName.trim(), category: editCategory as any, color: editColor })}
              disabled={!editName.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transition Matrix Dialog */}
      <Dialog open={transitionOpen} onOpenChange={setTransitionOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Transition Matrix</DialogTitle>
            <p className="text-xs text-muted-foreground">Check which status transitions are allowed (row → column)</p>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground">From ↓ / To →</th>
                  {statuses.map((s) => (
                    <th key={s.id} className="p-2 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span>{s.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statuses.map((from) => (
                  <tr key={from.id} className="border-t border-border">
                    <td className="p-2 font-medium">
                      <div className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: from.color }} />
                        {from.name}
                      </div>
                    </td>
                    {statuses.map((to) => (
                      <td key={to.id} className="p-2 text-center">
                        {from.id === to.id ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <Checkbox
                            checked={transitionSet.has(`${from.id}->${to.id}`)}
                            onCheckedChange={() => handleToggleTransition(from.id, to.id)}
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
