"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Loader2, X, Check, UserPlus, Upload, Zap, Globe, LayoutList, GitBranch, Mail, Copy, ExternalLink } from "lucide-react";
import { AiAutomationSuggestions } from "@/components/ai/ai-automation-suggestions";
import { WorkflowEditor } from "@/components/projects/workflow-editor";
import { toast } from "sonner";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";

const presetColors = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#6366F1"];

export default function ProjectSettingsPage() {
  const { projectId, workspaceSlug } = useParams() as { projectId: string; workspaceSlug: string };
  const router = useRouter();
  const { workspaceId } = useAuthStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addLabelOpen, setAddLabelOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#3B82F6");

  const utils = trpc.useUtils();

  const { data: project } = trpc.project.getById.useQuery({ id: projectId });
  const { data: members } = trpc.project.getMembers.useQuery({ projectId });
  const { data: labels } = trpc.label.list.useQuery({ projectId });
  const { data: wsMembers } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId && addMemberOpen }
  );

  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => toast.success("Project updated"),
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => {
      toast.success("Project deleted");
      router.push("/home");
    },
  });

  const archiveMutation = trpc.project.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived");
      router.push("/home");
    },
    onError: (err) => toast.error(err.message),
  });

  const createLabelMutation = trpc.label.create.useMutation({
    onSuccess: () => {
      utils.label.list.invalidate({ projectId });
      setAddLabelOpen(false);
      setNewLabelName("");
      setNewLabelColor("#3B82F6");
      toast.success("Label created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteLabelMutation = trpc.label.delete.useMutation({
    onSuccess: () => {
      utils.label.list.invalidate({ projectId });
      toast.success("Label deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const addMemberMutation = trpc.project.addMember.useMutation({
    onSuccess: () => {
      utils.project.getMembers.invalidate({ projectId });
      toast.success("Member added");
    },
    onError: (err) => toast.error(err.message),
  });

  const togglePublicMutation = trpc.project.togglePublic.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Visibility updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMemberMutation = trpc.project.removeMember.useMutation({
    onSuccess: () => {
      utils.project.getMembers.invalidate({ projectId });
      toast.success("Member removed");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!project) return null;

  const columns = project.columns || [];
  const projectMemberIds = new Set(members?.map((m) => m.userId) || []);

  // Workspace members not yet in project
  const availableMembers = wsMembers?.filter((m: any) => !projectMemberIds.has(m.user.id)) || [];

  return (
    <>
      <TopBar
        breadcrumbs={[
          { label: "DKFlow", href: "/home" },
          { label: project.name },
          { label: "Settings" },
        ]}
      />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* General */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
            <CardDescription>Project name, description, and appearance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name</Label>
              <Input
                defaultValue={project.name}
                onBlur={(e) => {
                  if (e.target.value !== project.name) {
                    updateMutation.mutate({ id: projectId, name: e.target.value });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                defaultValue={project.description || ""}
                placeholder="Describe this project..."
                onBlur={(e) => {
                  if (e.target.value !== (project.description || "")) {
                    updateMutation.mutate({ id: projectId, description: e.target.value });
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => updateMutation.mutate({ id: projectId, color })}
                    className={`h-8 w-8 rounded-full border-2 transition-all ${
                      project.color === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>{members?.length || 0} members</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddMemberOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />Add Member
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {members?.map((member) => (
                <div key={member.userId} className="flex items-center gap-3 py-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {member.user.name.split(" ").map((n) => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.user.name}</p>
                    <p className="text-xs text-muted-foreground">{member.user.email}</p>
                  </div>
                  {(member as any).taskCount > 0 && (
                    <span className="text-xs text-muted-foreground">{(member as any).taskCount} tasks</span>
                  )}
                  <Select
                    defaultValue={member.role}
                    onValueChange={(role) => {
                      // Remove and re-add with new role
                      removeMemberMutation.mutate({ projectId, userId: member.userId }, {
                        onSuccess: () => {
                          addMemberMutation.mutate({ projectId, userId: member.userId, role: role as "lead" | "member" | "viewer" }, {
                            onSuccess: () => toast.success("Role updated"),
                          });
                        }
                      });
                    }}
                  >
                    <SelectTrigger className="w-24 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => removeMemberMutation.mutate({ projectId, userId: member.userId })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Labels */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Labels</CardTitle>
              <CardDescription>Manage labels for this project</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddLabelOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Label
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {labels?.map((label) => (
                <div key={label.id} className="flex items-center gap-3 py-1.5">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: label.color }} />
                  <span className="text-sm flex-1">{label.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => deleteLabelMutation.mutate({ id: label.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {!labels?.length && (
                <p className="text-sm text-muted-foreground">No labels yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Columns */}
        <Card>
          <CardHeader>
            <CardTitle>Board Columns</CardTitle>
            <CardDescription>Manage the columns on your board</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {columns.sort((a: any, b: any) => a.position - b.position).map((col: any) => (
                <div key={col.id} className="flex items-center gap-3 py-1.5">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: col.color || "#94A3B8" }} />
                  <span className="text-sm flex-1">{col.name}</span>
                  {col.wipLimit !== null && (
                    <span className="text-xs text-muted-foreground">WIP: {col.wipLimit}</span>
                  )}
                  {col.isDone && <Badge variant="secondary" className="text-[10px]">Done</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Workflow */}
        <WorkflowEditor projectId={projectId} />

        {/* Automations */}
        <AutomationsCard projectId={projectId} />

        {/* Custom Fields */}
        <CustomFieldsCard projectId={projectId} />

        {/* Public Board */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4" />Public Access</CardTitle>
            <CardDescription>Allow anyone to view this board without signing in</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Switch
              checked={(project as any)?.isPublic || false}
              onCheckedChange={() => togglePublicMutation.mutate({ id: projectId })}
            />
            <span className="text-sm text-muted-foreground">
              {(project as any)?.isPublic ? "Board is public" : "Board is private"}
            </span>
            {(project as any)?.isPublic && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  navigator.clipboard?.writeText(`${window.location.origin}/public/${projectId}`);
                  toast.success("Public URL copied!");
                }}
              >
                Copy Link
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Git Integration */}
        <GitIntegrationCard projectId={projectId} />

        {/* Email to Task */}
        <EmailToTaskCard projectId={projectId} inboundEmail={(project as any)?.inboundEmail} />

        {/* CSV Import */}
        <CsvImportCard projectId={projectId} columns={columns} />

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Irreversible actions for this project</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => archiveMutation.mutate({ id: projectId })}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Archive Project
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              Delete Project
            </Button>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete project"
          description={`This will permanently delete "${project.name}" and all its tasks. This action cannot be undone.`}
          confirmLabel="Delete Project"
          onConfirm={() => {
            setDeleteOpen(false);
            deleteMutation.mutate({ id: projectId });
          }}
          destructive
        />

        {/* Add Label Dialog */}
        <Dialog open={addLabelOpen} onOpenChange={setAddLabelOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Create Label</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newLabelName}
                  onChange={(e) => setNewLabelName(e.target.value)}
                  placeholder="Label name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newLabelName.trim()) {
                      createLabelMutation.mutate({ projectId, name: newLabelName.trim(), color: newLabelColor });
                    }
                  }}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewLabelColor(color)}
                      className={`h-7 w-7 rounded-full border-2 transition-all ${
                        newLabelColor === color ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createLabelMutation.mutate({ projectId, name: newLabelName.trim(), color: newLabelColor })}
                disabled={!newLabelName.trim() || createLabelMutation.isPending}
              >
                {createLabelMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Member Dialog — outside main flow so it doesn't break layout */}
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Add Member to Project</DialogTitle></DialogHeader>
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-3">Select workspace members to add to this project</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {availableMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">All workspace members are already in this project</p>
                ) : (
                  availableMembers.map((m: any) => (
                    <button
                      key={m.user.id}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-md hover:bg-muted transition-colors"
                      onClick={() => {
                        addMemberMutation.mutate({ projectId, userId: m.user.id, role: "member" });
                      }}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                          {m.user.name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium">{m.user.name}</p>
                        <p className="text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}

// ─── Automations Card ────────────────────────────────────
function AutomationsCard({ projectId }: { projectId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerEvent, setTriggerEvent] = useState("task_moved_to_column");
  const [actionType, setActionType] = useState("change_priority");
  const [actionParam, setActionParam] = useState("high");

  const utils = trpc.useUtils();
  const { data: automations } = trpc.automation.list.useQuery({ projectId });
  const createMutation = trpc.automation.create.useMutation({
    onSuccess: () => { utils.automation.list.invalidate({ projectId }); setCreateOpen(false); setName(""); toast.success("Automation created"); },
    onError: (err) => toast.error(err.message),
  });
  const toggleMutation = trpc.automation.toggle.useMutation({
    onSuccess: () => utils.automation.list.invalidate({ projectId }),
  });
  const deleteMutation = trpc.automation.delete.useMutation({
    onSuccess: () => { utils.automation.list.invalidate({ projectId }); toast.success("Automation deleted"); },
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" />Automations</CardTitle>
          <CardDescription>Automate repetitive actions</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <AiAutomationSuggestions projectId={projectId} />
          <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Rule</Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {automations?.map((rule: any) => (
            <div key={rule.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <Switch checked={rule.isEnabled} onCheckedChange={() => toggleMutation.mutate({ id: rule.id })} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{rule.name}</p>
                <p className="text-xs text-muted-foreground">
                  When {(rule.trigger as any)?.event?.replace(/_/g, " ")} → {((rule.actions as any)?.[0]?.type || "").replace(/_/g, " ")}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{rule.runCount} runs</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate({ id: rule.id })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!automations?.length && <p className="text-sm text-muted-foreground">No automations yet</p>}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Create Automation</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Auto-assign on move" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>When (Trigger)</Label>
                <Select value={triggerEvent} onValueChange={setTriggerEvent}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task_moved_to_column">Task moved to column</SelectItem>
                    <SelectItem value="task_created">Task created</SelectItem>
                    <SelectItem value="due_date_reached">Due date reached</SelectItem>
                    <SelectItem value="label_added">Label added</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Then (Action)</Label>
                <Select value={actionType} onValueChange={setActionType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="change_priority">Change priority</SelectItem>
                    <SelectItem value="change_assignee">Assign user</SelectItem>
                    <SelectItem value="move_to_column">Move to column</SelectItem>
                    <SelectItem value="add_label">Add label</SelectItem>
                    <SelectItem value="send_notification">Send notification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {actionType === "change_priority" && (
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={actionParam} onValueChange={setActionParam}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({
                  projectId,
                  name: name.trim() || "Untitled automation",
                  trigger: { event: triggerEvent as any },
                  actions: [{ type: actionType as any, params: actionType === "change_priority" ? { priority: actionParam } : {} }],
                })}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Custom Fields Card ──────────────────────────────────
function CustomFieldsCard({ projectId }: { projectId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("text");

  const utils = trpc.useUtils();
  const { data: fields } = trpc.customField.list.useQuery({ projectId });
  const createMutation = trpc.customField.create.useMutation({
    onSuccess: () => { utils.customField.list.invalidate({ projectId }); setCreateOpen(false); setFieldName(""); toast.success("Custom field created"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.customField.delete.useMutation({
    onSuccess: () => { utils.customField.list.invalidate({ projectId }); toast.success("Field deleted"); },
  });

  const typeLabels: Record<string, string> = { text: "Text", number: "Number", date: "Date", dropdown: "Dropdown", checkbox: "Checkbox", url: "URL" };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><LayoutList className="h-4 w-4" />Custom Fields</CardTitle>
          <CardDescription>Add custom fields to tasks</CardDescription>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" />Add Field</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {fields?.map((field: any) => (
            <div key={field.id} className="flex items-center gap-3 py-1.5">
              <span className="text-sm flex-1">{field.name}</span>
              <span className="text-xs text-muted-foreground">{typeLabels[field.fieldType] || field.fieldType}</span>
              {field.isRequired && <span className="text-xs text-orange-500">Required</span>}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate({ id: field.id })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!fields?.length && <p className="text-sm text-muted-foreground">No custom fields</p>}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Create Custom Field</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={fieldName} onChange={(e) => setFieldName(e.target.value)} placeholder="Field name" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => createMutation.mutate({ projectId, name: fieldName.trim(), fieldType: fieldType as any })}
                disabled={!fieldName.trim() || createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── CSV Import Card ─────────────────────────────────────
function CsvImportCard({ projectId, columns }: { projectId: string; columns: any[] }) {
  const [importing, setImporting] = useState(false);
  const utils = trpc.useUtils();
  const importMutation = trpc.task.importCsv.useMutation({
    onSuccess: (data) => { toast.success(`Imported ${data.count} tasks`); setImporting(false); },
    onError: (err) => { toast.error(err.message); setImporting(false); },
  });

  const handleImport = async (file: File) => {
    setImporting(true);
    const text = await file.text();
    const lines = text.split("\n").filter(Boolean);
    if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); setImporting(false); return; }

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const titleIdx = headers.findIndex((h) => h === "title" || h === "name" || h === "task");
    const descIdx = headers.findIndex((h) => h === "description" || h === "desc");
    const priorityIdx = headers.findIndex((h) => h === "priority");
    const statusIdx = headers.findIndex((h) => h === "status");

    if (titleIdx === -1) { toast.error("CSV must have a 'Title' column"); setImporting(false); return; }

    const tasks = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      const priorityVal = priorityIdx >= 0 ? cols[priorityIdx]?.toLowerCase() : "none";
      const validPriorities = ["urgent", "high", "medium", "low", "none"];
      return {
        title: cols[titleIdx] || "Untitled",
        description: descIdx >= 0 ? cols[descIdx] : undefined,
        priority: (validPriorities.includes(priorityVal) ? priorityVal : "none") as any,
        status: "todo" as const,
      };
    }).filter((t) => t.title && t.title !== "Untitled");

    if (tasks.length === 0) { toast.error("No valid tasks found in CSV"); setImporting(false); return; }

    const firstCol = columns?.sort((a: any, b: any) => a.position - b.position)?.[0];
    if (!firstCol) { toast.error("Project has no columns"); setImporting(false); return; }

    importMutation.mutate({ projectId, columnId: firstCol.id, tasks });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Upload className="h-4 w-4" />Import Tasks</CardTitle>
        <CardDescription>Import tasks from CSV (columns: Title, Description, Priority, Status)</CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          disabled={importing}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv";
            input.onchange = () => { if (input.files?.[0]) handleImport(input.files[0]); };
            input.click();
          }}
        >
          {importing ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
          {importing ? "Importing..." : "Choose CSV File"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Git Integration Card ────────────────────────────────
function GitIntegrationCard({ projectId }: { projectId: string }) {
  const [addOpen, setAddOpen] = useState(false);
  const [provider, setProvider] = useState("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [repoName, setRepoName] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const utils = trpc.useUtils();
  const { data: integrations } = trpc.git.listIntegrations.useQuery({ projectId });

  const addMutation = trpc.git.addIntegration.useMutation({
    onSuccess: () => {
      utils.git.listIntegrations.invalidate({ projectId });
      setAddOpen(false);
      setRepoUrl("");
      setRepoName("");
      setAccessToken("");
      toast.success("Repository connected");
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.git.removeIntegration.useMutation({
    onSuccess: () => {
      utils.git.listIntegrations.invalidate({ projectId });
      toast.success("Repository disconnected");
    },
    onError: (err) => toast.error(err.message),
  });

  const providerLabels: Record<string, string> = { github: "GitHub", gitlab: "GitLab", bitbucket: "Bitbucket" };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" />Git Integration</CardTitle>
          <CardDescription>Connect repositories to auto-link commits and PRs</CardDescription>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" />Connect Repo</Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {integrations?.map((integration: any) => (
            <div key={integration.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{integration.repoName}</p>
                <p className="text-xs text-muted-foreground">{providerLabels[integration.provider] || integration.provider} · {integration._count?.commits || 0} commits</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate({ id: integration.id })}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!integrations?.length && <p className="text-sm text-muted-foreground">No repositories connected</p>}
        </div>

        {integrations && integrations.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50">
            <p className="text-xs font-medium mb-1">Webhook URL</p>
            <p className="text-xs text-muted-foreground break-all font-mono">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/webhooks/git/{integrations[0]?.id}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Add this URL as a webhook in your repository settings. Commits containing <code className="bg-muted px-1 rounded">DK-123</code> will auto-link to tasks.
            </p>
          </div>
        )}

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
            <DialogHeader><DialogTitle>Connect Repository</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="github">GitHub</SelectItem>
                    <SelectItem value="gitlab">GitLab</SelectItem>
                    <SelectItem value="bitbucket">Bitbucket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Repository URL</Label>
                <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/org/repo" />
              </div>
              <div className="space-y-2">
                <Label>Repository Name</Label>
                <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} placeholder="org/repo" />
              </div>
              <div className="space-y-2">
                <Label>Access Token (optional)</Label>
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="ghp_..." type="password" />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => addMutation.mutate({
                  projectId,
                  provider: provider as any,
                  repoUrl: repoUrl.trim(),
                  repoName: repoName.trim(),
                  accessToken: accessToken.trim() || undefined,
                })}
                disabled={!repoUrl.trim() || !repoName.trim() || addMutation.isPending}
              >
                {addMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Email to Task Card ──────────────────────────────────
function EmailToTaskCard({ projectId, inboundEmail }: { projectId: string; inboundEmail?: string | null }) {
  const utils = trpc.useUtils();

  const generateMutation = trpc.project.generateInboundEmail.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Inbound email generated");
    },
    onError: (err) => toast.error(err.message),
  });

  const disableMutation = trpc.project.disableInboundEmail.useMutation({
    onSuccess: () => {
      utils.project.getById.invalidate({ id: projectId });
      toast.success("Inbound email disabled");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleCopy = () => {
    if (inboundEmail) {
      navigator.clipboard?.writeText(inboundEmail);
      toast.success("Email address copied");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Email-to-Task</CardTitle>
        <CardDescription>Create tasks by sending emails to a unique project address</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {inboundEmail ? (
          <>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate">{inboundEmail}</code>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 space-y-2">
              <p className="text-xs font-medium">How to set up</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Configure an email forwarding service (Mailgun, SendGrid, etc.) to forward emails to your DKFlow API</li>
                <li>Set the inbound webhook URL to: <code className="bg-muted px-1 rounded">POST /api/inbound-email</code></li>
                <li>Forward emails sent to <strong>{inboundEmail}</strong></li>
                <li>Email subject becomes the task title, body becomes the description</li>
              </ol>
            </div>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => disableMutation.mutate({ projectId })}>
              Disable Email-to-Task
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate({ projectId })}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            Enable Email-to-Task
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
