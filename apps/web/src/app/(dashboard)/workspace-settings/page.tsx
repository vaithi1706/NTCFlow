"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  Loader2, Building2, CreditCard, Users, Trash2, AlertTriangle,
  Shield, Plus, Pencil, Lock, Check, X, Webhook, Key, Copy, Eye, EyeOff,
  Zap, Send, MessageSquare, FileText, Clock,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  canCreateProject: { label: "Create Projects", description: "Can create new projects" },
  canDeleteProject: { label: "Delete Projects", description: "Can delete projects" },
  canManageMembers: { label: "Manage Members", description: "Can add/remove workspace members" },
  canCreateTasks: { label: "Create Tasks", description: "Can create new tasks" },
  canEditAnyTask: { label: "Edit Any Task", description: "Can edit tasks assigned to others" },
  canDeleteTasks: { label: "Delete Tasks", description: "Can delete tasks" },
  canManageSprints: { label: "Manage Sprints", description: "Can create/edit/complete sprints" },
  canManageBoard: { label: "Manage Board", description: "Can edit board columns and settings" },
  canViewReports: { label: "View Reports", description: "Can access reports and analytics" },
  canManageLabels: { label: "Manage Labels", description: "Can create/edit/delete labels" },
  canManageAutomations: { label: "Manage Automations", description: "Can create/edit automation rules" },
  canAccessSettings: { label: "Access Settings", description: "Can access workspace/project settings" },
  canInviteMembers: { label: "Invite Members", description: "Can invite new members" },
  canExportData: { label: "Export Data", description: "Can export project data" },
};

const ROLE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b"];

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const { workspaceId, setWorkspaceId } = useAuthStore();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("general");

  const utils = trpc.useUtils();

  const { data: workspace } = trpc.workspace.getById.useQuery(
    { id: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const updateMutation = trpc.workspace.update.useMutation({
    onSuccess: () => {
      utils.workspace.getById.invalidate();
      utils.workspace.list.invalidate();
      toast.success("Workspace updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.workspace.delete.useMutation({
    onSuccess: () => {
      toast.success("Workspace deleted");
      setWorkspaceId(null as any);
      router.push("/home");
    },
    onError: (err) => toast.error(err.message),
  });

  if (!workspace) return null;

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Workspace Settings" }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="general" className="gap-1.5"><Building2 className="h-3.5 w-3.5" /> General</TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Roles</TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
            <TabsTrigger value="apikeys" className="gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
            <TabsTrigger value="integrations" className="gap-1.5"><Webhook className="h-3.5 w-3.5" /> Integrations</TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Task Templates</TabsTrigger>
            <TabsTrigger value="billing" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Billing</TabsTrigger>
            <TabsTrigger value="sla" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> SLA</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* General */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>General</CardTitle>
                    <CardDescription>Workspace name, description, and branding</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
                      {workspace.name?.charAt(0)?.toUpperCase() || "W"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{workspace.name}</p>
                    <p className="text-xs text-muted-foreground">Logo upload coming soon</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Workspace Name</Label>
                  <Input
                    defaultValue={workspace.name}
                    onBlur={(e) => {
                      if (e.target.value !== workspace.name && e.target.value.trim()) {
                        updateMutation.mutate({ id: workspace.id, name: e.target.value.trim() });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    defaultValue={workspace.description || ""}
                    placeholder="What is this workspace for?"
                    onBlur={(e) => {
                      if (e.target.value !== (workspace.description || "")) {
                        updateMutation.mutate({ id: workspace.id, description: e.target.value || null } as any);
                      }
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Members Summary */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle>Members</CardTitle>
                      <CardDescription>{workspace.members?.length || 0} members in this workspace</CardDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => router.push("/members")}>
                    Manage Members
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex -space-x-2">
                  {workspace.members?.slice(0, 8).map((m: any) => (
                    <Avatar key={m.id || m.userId} className="h-8 w-8 border-2 border-background">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {(m.user?.name || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {(workspace.members?.length || 0) > 8 && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground border-2 border-background">
                      +{workspace.members!.length - 8}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Billing */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle>Billing</CardTitle>
                    <CardDescription>Manage your subscription and billing</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Free Plan</p>
                    <p className="text-xs text-muted-foreground">Upgrade to unlock more features</p>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <div>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible actions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20">
                  <div>
                    <p className="text-sm font-medium">Delete Workspace</p>
                    <p className="text-xs text-muted-foreground">Permanently delete this workspace and all its data</p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                    <Trash2 className="h-4 w-4 mr-1" />Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles">
            <RolesTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhooksTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="apikeys">
            <ApiKeysTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="integrations">
            <IntegrationsTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="templates">
            <TaskTemplatesTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="billing">
            <BillingTab workspaceId={workspaceId || ""} />
          </TabsContent>

          <TabsContent value="sla">
            <SlaTab workspaceId={workspaceId || ""} />
          </TabsContent>
        </Tabs>

        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Delete workspace"
          description={`This will permanently delete "${workspace.name}" and all projects, tasks, and data within it. This cannot be undone.`}
          confirmLabel="Delete Workspace"
          onConfirm={() => {
            setDeleteOpen(false);
            deleteMutation.mutate({ id: workspace.id });
          }}
          destructive
        />
      </div>
    </>
  );
}

/* ============== Roles Tab ============== */
function RolesTab({ workspaceId }: { workspaceId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [deleteRoleId, setDeleteRoleId] = useState<string | null>(null);

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newColor, setNewColor] = useState(ROLE_COLORS[5]);
  const [newPerms, setNewPerms] = useState<Record<string, boolean>>(
    Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, false]))
  );

  const utils = trpc.useUtils();

  const { data: roles, isLoading } = trpc.role.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const seedMutation = trpc.role.seedSystemRoles.useMutation({
    onSuccess: (data) => {
      utils.role.list.invalidate();
      if (data.created > 0) toast.success(`Created ${data.created} system roles`);
    },
    onError: (err) => toast.error(err.message),
  });

  const createMutation = trpc.role.create.useMutation({
    onSuccess: () => {
      utils.role.list.invalidate();
      setCreateOpen(false);
      setNewName(""); setNewDesc(""); setNewColor(ROLE_COLORS[5]); setNewPerms(Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, false])));
      toast.success("Role created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.role.delete.useMutation({
    onSuccess: () => {
      utils.role.list.invalidate();
      setDeleteRoleId(null);
      toast.success("Role deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-seed system roles if none exist
  useEffect(() => {
    if (roles && roles.length === 0 && workspaceId) {
      seedMutation.mutate({ workspaceId });
    }
  }, [roles, workspaceId]);

  if (isLoading) {
    return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Shield className="h-5 w-5" /> Roles & Permissions</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage roles and what members can do in your workspace</p>
        </div>
        <div className="flex gap-2">
          {(!roles || roles.filter((r: any) => r.isSystem).length === 0) && (
            <Button variant="outline" size="sm" onClick={() => seedMutation.mutate({ workspaceId })} disabled={seedMutation.isPending}>
              Initialize System Roles
            </Button>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Create Role
          </Button>
        </div>
      </div>

      {/* Role List */}
      <div className="space-y-3">
        {roles?.map((role: any) => (
          <RoleCard
            key={role.id}
            role={role}
            onEdit={() => setEditRoleId(role.id)}
            onDelete={() => setDeleteRoleId(role.id)}
          />
        ))}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Custom Role</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g., Scrum Master" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What can this role do?" />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {ROLE_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} className={`h-6 w-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Permissions</Label>
              {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm">{label}</p>
                    <p className="text-[11px] text-muted-foreground">{description}</p>
                  </div>
                  <Switch
                    checked={!!newPerms[key]}
                    onCheckedChange={(checked) => setNewPerms((p) => ({ ...p, [key]: checked }))}
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!newName.trim() || createMutation.isPending} onClick={() => {
              createMutation.mutate({ workspaceId, name: newName.trim(), description: newDesc.trim() || undefined, color: newColor, permissions: newPerms });
            }}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      {editRoleId && (
        <EditRoleDialog roleId={editRoleId} onClose={() => setEditRoleId(null)} />
      )}

      {/* Delete Confirm */}
      <ConfirmDialog
        open={!!deleteRoleId}
        onOpenChange={(open) => { if (!open) setDeleteRoleId(null); }}
        title="Delete Role"
        description="Members with this role will have it unassigned. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => { if (deleteRoleId) deleteMutation.mutate({ id: deleteRoleId }); }}
        destructive
      />
    </div>
  );
}

/* ============== Role Card ============== */
function RoleCard({ role, onEdit, onDelete }: { role: any; onEdit: () => void; onDelete: () => void }) {
  const perms = role.permissions as Record<string, boolean>;
  const enabledCount = Object.values(perms).filter(Boolean).length;
  const totalCount = Object.keys(PERMISSION_LABELS).length;
  const memberCount = (role._count?.workspaceMembers || 0) + (role._count?.projectMembers || 0);

  return (
    <Card className="group hover:border-blue-500/20 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${role.color || "#3b82f6"}20` }}>
              <Shield className="h-5 w-5" style={{ color: role.color || "#3b82f6" }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{role.name}</p>
                {role.isSystem && (
                  <Badge variant="outline" className="text-[10px] gap-0.5 py-0">
                    <Lock className="h-2.5 w-2.5" /> System
                  </Badge>
                )}
              </div>
              {role.description && <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                <span>{enabledCount}/{totalCount} permissions</span>
                <span>{memberCount} assigned</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!role.isSystem && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Permission pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(PERMISSION_LABELS).map(([key, { label }]) => (
            <span
              key={key}
              className={`text-[10px] px-2 py-0.5 rounded-full ${perms[key] ? "bg-green-500/10 text-green-400" : "bg-muted text-muted-foreground/50"}`}
            >
              {perms[key] ? <Check className="h-2.5 w-2.5 inline mr-0.5" /> : <X className="h-2.5 w-2.5 inline mr-0.5" />}
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== Edit Role Dialog ============== */
function EditRoleDialog({ roleId, onClose }: { roleId: string; onClose: () => void }) {
  const { data: role, isLoading } = trpc.role.getById.useQuery({ id: roleId });
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [initialized, setInitialized] = useState(false);

  const utils = trpc.useUtils();

  const updateMutation = trpc.role.update.useMutation({
    onSuccess: () => {
      utils.role.list.invalidate();
      utils.role.getById.invalidate();
      onClose();
      toast.success("Role updated");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (role && !initialized) {
      setEditName(role.name);
      setEditDesc(role.description || "");
      setEditColor(role.color || ROLE_COLORS[5]);
      setEditPerms(role.permissions as Record<string, boolean>);
      setInitialized(true);
    }
  }, [role, initialized]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Role: {role?.name || "..."}</DialogTitle></DialogHeader>
        {isLoading || !role ? (
          <div className="space-y-3 py-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={role.isSystem} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {ROLE_COLORS.map((c) => (
                    <button key={c} onClick={() => setEditColor(c)} className={`h-6 w-6 rounded-full border-2 transition-all ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label>Permissions</Label>
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <div>
                      <p className="text-sm">{label}</p>
                      <p className="text-[11px] text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={!!editPerms[key]}
                      onCheckedChange={(checked) => setEditPerms((p) => ({ ...p, [key]: checked }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button disabled={!editName.trim() || updateMutation.isPending} onClick={() => {
                updateMutation.mutate({
                  id: roleId,
                  ...(role.isSystem ? {} : { name: editName.trim() }),
                  description: editDesc.trim() || null,
                  color: editColor,
                  permissions: editPerms,
                });
              }}>Save</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ============== Webhooks Tab ============== */
function WebhooksTab({ workspaceId }: { workspaceId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const EVENTS = [
    "task.created", "task.updated", "task.deleted",
    "comment.created", "sprint.started", "sprint.completed",
  ];

  const utils = trpc.useUtils();
  const { data: webhooks, isLoading } = trpc.webhook.list.useQuery({ workspaceId }, { enabled: !!workspaceId });

  const createMutation = trpc.webhook.create.useMutation({
    onSuccess: () => {
      utils.webhook.list.invalidate({ workspaceId });
      setCreateOpen(false);
      setName(""); setUrl(""); setSecret(""); setSelectedEvents([]);
      toast.success("Webhook created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.webhook.delete.useMutation({
    onSuccess: () => { utils.webhook.list.invalidate({ workspaceId }); toast.success("Webhook deleted"); },
  });

  const toggleMutation = trpc.webhook.update.useMutation({
    onSuccess: () => utils.webhook.list.invalidate({ workspaceId }),
  });

  const testMutation = trpc.webhook.test.useMutation({
    onSuccess: () => toast.success("Test webhook sent successfully"),
    onError: (err) => toast.error(err.message),
  });

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (isLoading) return <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Webhook className="h-5 w-5" /> Webhooks</h2>
          <p className="text-sm text-muted-foreground mt-1">Send event notifications to external services</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Create Webhook
        </Button>
      </div>

      <div className="space-y-3">
        {webhooks?.map((wh: any) => (
          <Card key={wh.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{wh.name}</p>
                    <Badge variant={wh.isActive ? "default" : "secondary"} className="text-[10px]">
                      {wh.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{wh.url}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {wh.events?.map((event: string) => (
                      <span key={event} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{event}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    {wh.lastTriggeredAt && <span>Last triggered: {new Date(wh.lastTriggeredAt).toLocaleDateString()}</span>}
                    {wh.failCount > 0 && <span className="text-destructive">Failures: {wh.failCount}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={wh.isActive}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: wh.id, isActive: checked })}
                  />
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => testMutation.mutate({ id: wh.id })} disabled={testMutation.isPending}>
                    Test
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate({ id: wh.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!webhooks?.length && <p className="text-sm text-muted-foreground">No webhooks configured</p>}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader><DialogTitle>Create Webhook</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My webhook" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" />
            </div>
            <div className="space-y-2">
              <Label>Secret (optional)</Label>
              <Input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="webhook-secret" type="password" />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {EVENTS.map((event) => (
                  <label key={event} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="rounded"
                    />
                    {event}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || !url.trim() || selectedEvents.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate({
                workspaceId,
                name: name.trim(),
                url: url.trim(),
                events: selectedEvents,
                secret: secret.trim() || undefined,
              })}
            >
              {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== API Keys Tab ============== */
function ApiKeysTab({ workspaceId }: { workspaceId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: keys, isLoading } = trpc.apiKey.list.useQuery({ workspaceId }, { enabled: !!workspaceId });

  const createMutation = trpc.apiKey.create.useMutation({
    onSuccess: (data) => {
      utils.apiKey.list.invalidate({ workspaceId });
      setNewKey(data.key);
      setName("");
      toast.success("API key created");
    },
    onError: (err) => toast.error(err.message),
  });

  const revokeMutation = trpc.apiKey.revoke.useMutation({
    onSuccess: () => { utils.apiKey.list.invalidate({ workspaceId }); toast.success("API key revoked"); },
  });

  if (isLoading) return <div className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Key className="h-5 w-5" /> API Keys</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage API keys for external integrations</p>
        </div>
        <Button size="sm" onClick={() => { setCreateOpen(true); setNewKey(null); }} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Create Key
        </Button>
      </div>

      <div className="space-y-3">
        {keys?.map((key: any) => (
          <Card key={key.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{key.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key.keyPrefix}...</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>Created by {key.user?.name}</span>
                    <span>{new Date(key.createdAt).toLocaleDateString()}</span>
                    {key.lastUsedAt && <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
                <ConfirmDialog
                  open={false}
                  onOpenChange={() => {}}
                  title="Revoke API Key"
                  description="This will permanently revoke this API key. Any integrations using it will stop working."
                  confirmLabel="Revoke"
                  onConfirm={() => revokeMutation.mutate({ id: key.id })}
                  destructive
                >
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => revokeMutation.mutate({ id: key.id })}>
                    Revoke
                  </Button>
                </ConfirmDialog>
              </div>
            </CardContent>
          </Card>
        ))}
        {!keys?.length && <p className="text-sm text-muted-foreground">No API keys created</p>}
      </div>

      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <p className="text-xs font-medium mb-2">REST API Endpoints</p>
          <div className="space-y-1 text-xs text-muted-foreground font-mono">
            <p>GET /api/v1/projects</p>
            <p>GET /api/v1/tasks?projectId=xxx</p>
            <p>POST /api/v1/tasks</p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Use <code className="bg-muted px-1 rounded">Authorization: Bearer dk_...</code> header
          </p>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>{newKey ? "API Key Created" : "Create API Key"}</DialogTitle></DialogHeader>
          {newKey ? (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-1">⚠️ Copy this key now</p>
                <p className="text-xs text-muted-foreground">You won't be able to see it again.</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-md font-mono break-all">{newKey}</code>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => { navigator.clipboard?.writeText(newKey); toast.success("Key copied"); }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Key Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My integration" autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            {newKey ? (
              <Button onClick={() => setCreateOpen(false)}>Done</Button>
            ) : (
              <Button
                disabled={!name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ workspaceId, name: name.trim() })}
              >
                {createMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}Create
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const INTEGRATION_EVENTS = [
  { value: "task.created", label: "Task Created" },
  { value: "task.completed", label: "Task Completed" },
  { value: "task.assigned", label: "Task Assigned" },
  { value: "comment.created", label: "Comment Created" },
  { value: "sprint.started", label: "Sprint Started" },
  { value: "sprint.completed", label: "Sprint Completed" },
] as const;

function IntegrationsTab({ workspaceId }: { workspaceId: string }) {
  const utils = trpc.useUtils();
  const { data: integrations = [], isLoading } = trpc.integration.list.useQuery({ workspaceId });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formType, setFormType] = useState<"slack" | "teams">("slack");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formChannel, setFormChannel] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["task.created", "task.completed"]);

  const createMutation = trpc.integration.create.useMutation({
    onSuccess: () => { utils.integration.list.invalidate(); setDialogOpen(false); resetForm(); toast.success("Integration created"); },
    onError: (err) => toast.error(err.message),
  });
  const updateMutation = trpc.integration.update.useMutation({
    onSuccess: () => { utils.integration.list.invalidate(); toast.success("Updated"); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.integration.delete.useMutation({
    onSuccess: () => { utils.integration.list.invalidate(); toast.success("Deleted"); },
    onError: (err) => toast.error(err.message),
  });
  const testMutation = trpc.integration.test.useMutation({
    onSuccess: () => toast.success("Test message sent!"),
    onError: (err) => toast.error(err.message),
  });

  const resetForm = () => { setFormName(""); setFormUrl(""); setFormChannel(""); setFormEvents(["task.created", "task.completed"]); };

  const toggleEvent = (ev: string) => {
    setFormEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle>Integrations</CardTitle>
                <CardDescription>Connect Slack or Microsoft Teams to receive notifications</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Integration</Button>
          </div>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No integrations configured yet</p>
              <p className="text-xs mt-1">Add a Slack or Teams webhook to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map((intg: any) => (
                <div key={intg.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                  <div className="flex items-center justify-center h-9 w-9 rounded-md bg-muted">
                    <span className="text-lg">{intg.type === "slack" ? "📱" : "👥"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{intg.name}</span>
                      <Badge variant="outline" className="text-[10px]">{intg.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{intg.events.join(", ")}</p>
                  </div>
                  <Switch
                    checked={intg.isActive}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: intg.id, isActive: checked })}
                  />
                  <Button variant="ghost" size="sm" onClick={() => testMutation.mutate({ id: intg.id })} disabled={testMutation.isPending}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate({ id: intg.id })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Integration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as "slack" | "teams")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-md bg-muted/30 text-xs text-muted-foreground">
              {formType === "slack"
                ? "Create an Incoming Webhook in your Slack workspace → paste the URL here"
                : "Create an Incoming Webhook in your Teams channel → paste the URL here"}
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g. #general notifications" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input placeholder="https://hooks.slack.com/..." value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Channel (optional)</Label>
              <Input placeholder="#channel-name" value={formChannel} onChange={(e) => setFormChannel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2">
                {INTEGRATION_EVENTS.map((ev) => (
                  <label key={ev.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={formEvents.includes(ev.value)} onCheckedChange={() => toggleEvent(ev.value)} />
                    {ev.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={!formName || !formUrl || formEvents.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate({
                workspaceId, type: formType, name: formName,
                webhookUrl: formUrl, channel: formChannel || undefined,
                events: formEvents as any,
              })}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TaskTemplatesTab({ workspaceId }: { workspaceId: string }) {
  const [editTemplate, setEditTemplate] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultTitle, setDefaultTitle] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [defaultPriority, setDefaultPriority] = useState("none");
  const [defaultType, setDefaultType] = useState("task");
  const [defaultStoryPoints, setDefaultStoryPoints] = useState<string>("");
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const utils = trpc.useUtils();
  const { data: templates, isLoading } = trpc.taskTemplate.list.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );

  const createMutation = trpc.taskTemplate.create.useMutation({
    onSuccess: () => { utils.taskTemplate.list.invalidate(); setCreateOpen(false); resetForm(); toast.success("Template created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.taskTemplate.update.useMutation({
    onSuccess: () => { utils.taskTemplate.list.invalidate(); setEditTemplate(null); toast.success("Template updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.taskTemplate.delete.useMutation({
    onSuccess: () => { utils.taskTemplate.list.invalidate(); setDeleteId(null); toast.success("Template deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  function resetForm() {
    setName(""); setDescription(""); setDefaultTitle(""); setDefaultDescription("");
    setDefaultPriority("none"); setDefaultType("task"); setDefaultStoryPoints(""); setChecklistItems([]);
  }

  function openEdit(t: any) {
    setEditTemplate(t);
    setName(t.name || "");
    setDescription(t.description || "");
    setDefaultTitle(t.defaultTitle || "");
    setDefaultDescription(t.defaultDescription || "");
    setDefaultPriority(t.defaultPriority || "none");
    setDefaultType(t.defaultType || "task");
    setDefaultStoryPoints(t.defaultStoryPoints?.toString() || "");
    setChecklistItems(
      Array.isArray(t.checklistTemplate)
        ? t.checklistTemplate.map((i: any) => (typeof i === "string" ? i : i.title || i.text || ""))
        : []
    );
  }

  function addChecklistItem() {
    if (newChecklistItem.trim()) {
      setChecklistItems((prev) => [...prev, newChecklistItem.trim()]);
      setNewChecklistItem("");
    }
  }

  function handleSave() {
    const data = {
      name,
      description: description || undefined,
      defaultTitle: defaultTitle || undefined,
      defaultDescription: defaultDescription || undefined,
      defaultPriority,
      defaultType,
      defaultStoryPoints: defaultStoryPoints ? parseInt(defaultStoryPoints) : undefined,
      checklistTemplate: checklistItems,
    };
    if (editTemplate) {
      updateMutation.mutate({ id: editTemplate.id, ...data });
    } else {
      createMutation.mutate({ workspaceId, ...data });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Task Templates</h3>
          <p className="text-sm text-muted-foreground">Create reusable task configurations</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="bg-blue-500 hover:bg-blue-600">
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading && [1,2].map((i) => <Skeleton key={i} className="h-20 bg-muted" />)}

      {templates && templates.length === 0 && (
        <Card className="bg-muted border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No templates yet. Create one to speed up task creation.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {templates?.map((t) => (
          <Card key={t.id} className="bg-muted border-border">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <h4 className="text-foreground font-medium">{t.name}</h4>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <div className="flex items-center gap-2 mt-1">
                  {t.defaultType && <Badge variant="secondary" className="text-xs">{t.defaultType}</Badge>}
                  {t.defaultPriority && t.defaultPriority !== "none" && (
                    <Badge variant="secondary" className="text-xs">{t.defaultPriority}</Badge>
                  )}
                  {t.defaultStoryPoints && <Badge variant="secondary" className="text-xs">{t.defaultStoryPoints} pts</Badge>}
                  {Array.isArray(t.checklistTemplate) && (t.checklistTemplate as any[]).length > 0 && (
                    <Badge variant="secondary" className="text-xs">{(t.checklistTemplate as any[]).length} checklist items</Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteId(t.id)}>
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={createOpen || !!editTemplate} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setEditTemplate(null); } }}>
        <DialogContent className="bg-muted border-border text-foreground max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bug Report" className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label>Default Title Pattern</Label>
              <Input value={defaultTitle} onChange={(e) => setDefaultTitle(e.target.value)} placeholder="e.g. [BUG] " className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label>Default Description</Label>
              <Textarea value={defaultDescription} onChange={(e) => setDefaultDescription(e.target.value)} placeholder="Pre-filled description..." className="bg-muted border-border text-foreground" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={defaultPriority} onValueChange={setDefaultPriority}>
                  <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger className="bg-muted border-border text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-muted border-border text-foreground">
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="story">Story</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Story Points</Label>
              <Input type="number" value={defaultStoryPoints} onChange={(e) => setDefaultStoryPoints(e.target.value)} placeholder="Optional" className="bg-muted border-border text-foreground" />
            </div>
            <div>
              <Label>Checklist Items</Label>
              <div className="space-y-2 mt-1">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground flex-1">{item}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setChecklistItems(prev => prev.filter((_, idx) => idx !== i))}>
                      <X className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    value={newChecklistItem}
                    onChange={(e) => setNewChecklistItem(e.target.value)}
                    placeholder="Add checklist item"
                    className="bg-muted border-border text-foreground text-sm"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addChecklistItem())}
                  />
                  <Button variant="ghost" size="sm" onClick={addChecklistItem}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setEditTemplate(null); }}>Cancel</Button>
            <Button className="bg-blue-500 hover:bg-blue-600" disabled={!name.trim()} onClick={handleSave}>
              {editTemplate ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Template"
        description="Are you sure? This cannot be undone."
        onConfirm={() => deleteId && deleteMutation.mutate({ id: deleteId })}
        variant="destructive"
      />
    </div>
  );
}

function BillingTab({ workspaceId }: { workspaceId: string }) {
  const { data: sub, isLoading } = trpc.subscription.getCurrent.useQuery(
    { workspaceId },
    { enabled: !!workspaceId }
  );
  const utils = trpc.useUtils();
  const router = useRouter();

  const cancelMutation = trpc.subscription.cancel.useMutation({
    onSuccess: () => {
      toast.success("Subscription will cancel at end of billing period");
      utils.subscription.getCurrent.invalidate();
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (isLoading || !sub) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  const isPro = sub.plan === "pro";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Current Plan
          </CardTitle>
          <CardDescription>
            {isPro
              ? sub.isTrialing
                ? `Pro Trial — ${sub.trialDaysLeft} days remaining`
                : `Pro Plan — ${sub.billingCycle === "yearly" ? "Annual" : "Monthly"} billing`
              : "Free Plan"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <p className="text-zinc-500">Projects</p>
              <p className="font-medium">{sub.usage.projects}{sub.limits.maxProjects !== null ? ` / ${sub.limits.maxProjects}` : " (unlimited)"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-500">Members</p>
              <p className="font-medium">{sub.usage.members}{sub.limits.maxMembers !== null ? ` / ${sub.limits.maxMembers}` : " (unlimited)"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-zinc-500">Tasks</p>
              <p className="font-medium">{sub.usage.tasks}{sub.limits.maxTasks !== null ? ` / ${sub.limits.maxTasks}` : " (unlimited)"}</p>
            </div>
          </div>

          {sub.currentPeriodEnd && (
            <p className="text-xs text-zinc-500">
              {sub.cancelAtPeriodEnd
                ? `Cancels on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                : `Renews on ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {!isPro && (
              <Button
                onClick={() => router.push("/pricing")}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-foreground"
              >
                <Zap className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            )}
            {isPro && !sub.isTrialing && !sub.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                onClick={() => cancelMutation.mutate({ workspaceId })}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Cancel Subscription
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Your past invoices will appear here once payment integration is live.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500 italic">No invoices yet</p>
        </CardContent>
      </Card>
    </div>
  );
}

function SlaTab({ workspaceId }: { workspaceId: string }) {
  const { data: policies, isLoading } = trpc.sla.list.useQuery({ workspaceId });
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [priority, setPriority] = useState("urgent");
  const [responseHours, setResponseHours] = useState("4");
  const [resolutionHours, setResolutionHours] = useState("24");

  const createMutation = trpc.sla.create.useMutation({
    onSuccess: () => {
      utils.sla.list.invalidate({ workspaceId });
      setName(""); setResponseHours("4"); setResolutionHours("24");
      toast.success("SLA policy created");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.sla.delete.useMutation({
    onSuccess: () => {
      utils.sla.list.invalidate({ workspaceId });
      toast.success("SLA policy deleted");
    },
  });

  const { data: dashboard } = trpc.sla.getDashboard.useQuery({ workspaceId });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-6">
      {/* Dashboard */}
      {dashboard && dashboard.total > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> SLA Compliance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{dashboard.compliancePercent}%</p>
                <p className="text-xs text-muted-foreground">Compliance</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-500">{dashboard.met}</p>
                <p className="text-xs text-muted-foreground">Met</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-500">{dashboard.atRisk}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500">{dashboard.breached}</p>
                <p className="text-xs text-muted-foreground">Breached</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing Policies */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Policies</CardTitle>
          <CardDescription>Define response and resolution time targets per priority</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(policies || []).length === 0 && (
            <p className="text-sm text-muted-foreground">No SLA policies defined yet.</p>
          )}
          {(policies || []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  Priority: {p.priority} · Response: {p.responseTimeHours}h · Resolution: {p.resolutionTimeHours}h
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate({ id: p.id })}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Add New Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Add SLA Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Urgent SLA" />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Response Time (hours)</Label>
              <Input type="number" value={responseHours} onChange={(e) => setResponseHours(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Resolution Time (hours)</Label>
              <Input type="number" value={resolutionHours} onChange={(e) => setResolutionHours(e.target.value)} />
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate({
              workspaceId,
              name: name || `${priority} SLA`,
              priority: priority as any,
              responseTimeHours: parseFloat(responseHours) || 4,
              resolutionTimeHours: parseFloat(resolutionHours) || 24,
            })}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-2 h-4 w-4" /> Add Policy
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
