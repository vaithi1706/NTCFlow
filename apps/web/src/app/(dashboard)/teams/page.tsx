"use client";

import { useState, useMemo } from "react";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import {
  Plus, Users, Crown, Trash2, UserPlus, X, FolderKanban, BarChart3,
  Search, LayoutGrid, List, ArrowLeft, Settings, Activity, TrendingUp,
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Pencil, Save,
} from "lucide-react";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function TeamsPage() {
  const { workspaceId } = useAuthStore();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Create form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [leadId, setLeadId] = useState("");

  const utils = trpc.useUtils();

  const { data: teams, isLoading } = trpc.team.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );
  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const createMutation = trpc.team.create.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      setCreateOpen(false);
      setName(""); setDescription(""); setColor(COLORS[0]); setLeadId("");
      toast.success("Team created!");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.team.delete.useMutation({
    onSuccess: () => {
      utils.team.list.invalidate();
      setDeleteTeamId(null);
      setSelectedTeamId(null);
      toast.success("Team deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    if (!searchQuery.trim()) return teams;
    const q = searchQuery.toLowerCase();
    return teams.filter((t: any) =>
      t.name.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.lead?.name?.toLowerCase().includes(q)
    );
  }, [teams, searchQuery]);

  if (selectedTeamId) {
    return (
      <TeamDetailView
        teamId={selectedTeamId}
        workspaceId={workspaceId || ""}
        onBack={() => setSelectedTeamId(null)}
        onDelete={() => setDeleteTeamId(selectedTeamId)}
      />
    );
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Teams" }]} />
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Teams</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {teams?.length || 0} teams in workspace
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Team
          </Button>
        </div>

        {/* Search & View Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              className="rounded-none h-9 w-9"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Teams */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : !filteredTeams.length ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{searchQuery ? "No teams match your search" : "No teams yet. Create one to get started!"}</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTeams.map((team: any) => (
              <TeamCard key={team.id} team={team} onClick={() => setSelectedTeamId(team.id)} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTeams.map((team: any) => (
              <TeamListRow key={team.id} team={team} onClick={() => setSelectedTeamId(team.id)} />
            ))}
          </div>
        )}

        {/* Create Team Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Team</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Team Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What does this team do?" rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button key={c} onClick={() => setColor(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Team Lead</Label>
                <Select value={leadId} onValueChange={setLeadId}>
                  <SelectTrigger><SelectValue placeholder="Select lead (optional)" /></SelectTrigger>
                  <SelectContent>
                    {members?.map((m: any) => (
                      <SelectItem key={m.user?.id || m.userId} value={m.user?.id || m.userId}>
                        {m.user?.name || "Unknown"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => {
                if (!name.trim() || !workspaceId) return;
                createMutation.mutate({ workspaceId, name: name.trim(), description: description.trim() || undefined, color, leadId: leadId || undefined });
              }} disabled={!name.trim() || createMutation.isPending}>
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirm */}
        <ConfirmDialog
          open={!!deleteTeamId}
          onOpenChange={(open) => { if (!open) setDeleteTeamId(null); }}
          title="Delete Team"
          description="Are you sure? This will remove all team memberships and project assignments."
          confirmLabel="Delete"
          onConfirm={() => { if (deleteTeamId) deleteMutation.mutate({ id: deleteTeamId }); }}
          destructive
        />
      </div>
    </>
  );
}

/* ============== Team Card (Grid View) ============== */
function TeamCard({ team, onClick }: { team: any; onClick: () => void }) {
  const memberCount = team._count?.members || 0;
  const projectCount = team._count?.projects || 0;

  return (
    <Card className="cursor-pointer hover:shadow-lg hover:border-blue-500/30 transition-all group" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: team.color || "#3b82f6" }}>
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{team.name}</CardTitle>
              {team.lead && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Crown className="h-3 w-3 text-amber-400" /> {team.lead.name}
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {team.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{team.description}</p>
        )}

        {/* Member Avatars Stacked */}
        {memberCount > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[...Array(Math.min(memberCount, 5))].map((_, i) => (
                <Avatar key={i} className="h-7 w-7 border-2 border-background">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {String.fromCharCode(65 + i)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {memberCount > 5 && (
                <div className="h-7 w-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground font-medium">
                  +{memberCount - 5}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {memberCount}</span>
          <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {projectCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============== Team List Row ============== */
function TeamListRow({ team, onClick }: { team: any; onClick: () => void }) {
  return (
    <div
      className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:border-blue-500/30 hover:bg-muted/30 cursor-pointer transition-all group"
      onClick={onClick}
    >
      <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: team.color || "#3b82f6" }}>
        {team.name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{team.name}</p>
        {team.description && <p className="text-xs text-muted-foreground truncate">{team.description}</p>}
      </div>
      {team.lead && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
          <Crown className="h-3 w-3 text-amber-400" /> {team.lead.name}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {team._count?.members || 0}</span>
        <span className="flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" /> {team._count?.projects || 0}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
    </div>
  );
}

/* ============== Team Detail View (Full Page) ============== */
function TeamDetailView({ teamId, workspaceId, onBack, onDelete }: {
  teamId: string; workspaceId: string; onBack: () => void; onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState("members");

  const { data: team, isLoading } = trpc.team.getById.useQuery({ id: teamId });
  const { data: stats } = trpc.team.getStats.useQuery({ teamId });

  if (isLoading || !team) {
    return (
      <>
        <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Teams", href: "#" }, { label: "..." }]} />
        <div className="flex-1 p-6 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Teams", href: "#" }, { label: team.name }]} />
      <div className="flex-1 overflow-y-auto">
        {/* Header Section */}
        <div className="border-b border-border/50 bg-card/30">
          <div className="p-6">
            <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" /> Back to Teams
            </button>

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-xl flex items-center justify-center text-white font-bold text-2xl shadow-lg" style={{ backgroundColor: team.color || "#3b82f6" }}>
                  {team.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-2xl font-bold">{team.name}</h1>
                  {team.description && <p className="text-sm text-muted-foreground mt-0.5">{team.description}</p>}
                  {team.lead && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Crown className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs text-muted-foreground">Led by {team.lead.name}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Role Distribution */}
            {team.members && team.members.length > 0 && (() => {
              const roleCounts: Record<string, { name: string; color: string; count: number }> = {};
              team.members.forEach((m: any) => {
                const cr = m.user?.workspaceMembers?.[0]?.customRole;
                if (cr) {
                  if (!roleCounts[cr.id]) roleCounts[cr.id] = { name: cr.name, color: cr.color, count: 0 };
                  roleCounts[cr.id].count++;
                }
              });
              const entries = Object.values(roleCounts);
              if (entries.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-2 mt-3">
                  {entries.map((r) => (
                    <Badge key={r.name} variant="outline" className="text-xs" style={{ color: r.color, borderColor: (r.color || "#6b7280") + "40", backgroundColor: (r.color || "#6b7280") + "10" }}>
                      {r.count} {r.name}{r.count > 1 ? "s" : ""}
                    </Badge>
                  ))}
                </div>
              );
            })()}

            {/* Stats Row */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
                <StatCard icon={<Users className="h-4 w-4 text-blue-400" />} label="Members" value={stats.totalMembers} />
                <StatCard icon={<Clock className="h-4 w-4 text-yellow-400" />} label="Active Tasks" value={stats.activeTasks} />
                <StatCard icon={<CheckCircle2 className="h-4 w-4 text-green-400" />} label="Done This Week" value={stats.completedThisWeek} />
                <StatCard icon={<AlertTriangle className="h-4 w-4 text-red-400" />} label="Overdue" value={stats.overdue} />
                <StatCard icon={<TrendingUp className="h-4 w-4 text-purple-400" />} label="Avg Days" value={`${stats.avgCompletionDays}d`} />
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="members" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Members</TabsTrigger>
              <TabsTrigger value="projects" className="gap-1.5"><FolderKanban className="h-3.5 w-3.5" /> Projects</TabsTrigger>
              <TabsTrigger value="activity" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Activity</TabsTrigger>
              <TabsTrigger value="workload" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Workload</TabsTrigger>
              <TabsTrigger value="performance" className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" /> Performance</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-3.5 w-3.5" /> Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="members">
              <MembersTab teamId={teamId} team={team} workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="projects">
              <ProjectsTab teamId={teamId} team={team} workspaceId={workspaceId} />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab teamId={teamId} />
            </TabsContent>
            <TabsContent value="workload">
              <WorkloadTab teamId={teamId} />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab teamId={teamId} />
            </TabsContent>
            <TabsContent value="settings">
              <SettingsTab teamId={teamId} team={team} workspaceId={workspaceId} onDelete={onDelete} onBack={onBack} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

/* ============== Stat Card ============== */
function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border/50 rounded-lg p-3 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ============== Members Tab ============== */
function MembersTab({ teamId, team, workspaceId }: { teamId: string; team: any; workspaceId: string }) {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("member");
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: wsMembers } = trpc.workspace.getMembers.useQuery({ workspaceId }, { enabled: !!workspaceId });
  const { data: workload } = trpc.team.getWorkload.useQuery({ teamId });

  const addMemberMutation = trpc.team.addMember.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); utils.team.getWorkload.invalidate(); utils.team.list.invalidate(); utils.team.getStats.invalidate(); setAddMemberOpen(false); setSelectedUserId(""); setSelectedRole("member"); toast.success("Member added"); },
    onError: (err) => toast.error(err.message),
  });
  const removeMemberMutation = trpc.team.removeMember.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); utils.team.getWorkload.invalidate(); utils.team.list.invalidate(); utils.team.getStats.invalidate(); setRemoveMemberId(null); toast.success("Member removed"); },
    onError: (err) => toast.error(err.message),
  });
  const updateRoleMutation = trpc.team.updateMemberRole.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); toast.success("Role updated"); },
    onError: (err) => toast.error(err.message),
  });

  const existingMemberIds = new Set(team.members.map((m: any) => m.userId));
  const availableMembers = wsMembers?.filter((m: any) => !existingMemberIds.has(m.user?.id || m.userId)) || [];

  // Map workload data by userId
  const workloadMap = useMemo(() => {
    const map: Record<string, any> = {};
    workload?.forEach((w: any) => { map[w.user.id] = w; });
    return map;
  }, [workload]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{team.members.length} members</h3>
        <Button size="sm" onClick={() => setAddMemberOpen(true)} className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" /> Add Member
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {team.members.map((m: any) => {
          const w = workloadMap[m.userId];
          const capacity = w ? Math.min(100, Math.round((w.total / 10) * 100)) : 0;
          return (
            <Card key={m.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {m.user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={m.role === "lead" ? "default" : "secondary"} className="text-[10px]">
                      {m.role === "lead" && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                      {m.role}
                    </Badge>
                    {m.user?.workspaceMembers?.[0]?.customRole && (
                      <Badge variant="outline" className="text-[10px]" style={{
                        color: m.user.workspaceMembers[0].customRole.color,
                        borderColor: (m.user.workspaceMembers[0].customRole.color || "#6b7280") + "40",
                        backgroundColor: (m.user.workspaceMembers[0].customRole.color || "#6b7280") + "10",
                      }}>
                        {m.user.workspaceMembers[0].customRole.name}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Workload Info */}
                {w && (
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{w.completed} done · {w.inProgress} active · {w.todo} todo</span>
                      <span>{w.total} total</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                      {w.total > 0 && (
                        <>
                          {w.completed > 0 && <div className="bg-green-500 transition-all" style={{ width: `${(w.completed / w.total) * 100}%` }} />}
                          {w.inProgress > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(w.inProgress / w.total) * 100}%` }} />}
                          {w.todo > 0 && <div className="bg-slate-500 transition-all" style={{ width: `${(w.todo / w.total) * 100}%` }} />}
                          {w.overdue > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(w.overdue / w.total) * 100}%` }} />}
                        </>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {w.total}/10 tasks — {capacity}% capacity
                      {w.overdue > 0 && <span className="text-red-400 ml-2">⚠ {w.overdue} overdue</span>}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Select value={m.role} onValueChange={(role) => updateRoleMutation.mutate({ teamId, userId: m.userId, role: role as any })}>
                    <SelectTrigger className="h-7 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setRemoveMemberId(m.userId)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Member to Team</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Member</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m: any) => (
                    <SelectItem key={m.user?.id || m.userId} value={m.user?.id || m.userId}>{m.user?.name || "Unknown"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Cancel</Button>
            <Button disabled={!selectedUserId || addMemberMutation.isPending} onClick={() => addMemberMutation.mutate({ teamId, userId: selectedUserId, role: selectedRole as any })}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Confirm */}
      <ConfirmDialog
        open={!!removeMemberId}
        onOpenChange={(open) => { if (!open) setRemoveMemberId(null); }}
        title="Remove Member"
        description="Are you sure you want to remove this member from the team?"
        confirmLabel="Remove"
        onConfirm={() => { if (removeMemberId) removeMemberMutation.mutate({ teamId, userId: removeMemberId }); }}
        destructive
      />
    </div>
  );
}

/* ============== Projects Tab ============== */
function ProjectsTab({ teamId, team, workspaceId }: { teamId: string; team: any; workspaceId: string }) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const utils = trpc.useUtils();
  const { data: projects } = trpc.project.list.useQuery({ workspaceId }, { enabled: !!workspaceId });

  const assignMutation = trpc.team.assignProject.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); utils.team.list.invalidate(); setAssignOpen(false); setSelectedProjectId(""); toast.success("Project assigned"); },
    onError: (err) => toast.error(err.message),
  });
  const unassignMutation = trpc.team.unassignProject.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); utils.team.list.invalidate(); toast.success("Project removed"); },
    onError: (err) => toast.error(err.message),
  });

  const existingProjectIds = new Set(team.projects.map((p: any) => p.projectId));
  const availableProjects = projects?.filter((p: any) => !existingProjectIds.has(p.id)) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{team.projects.length} projects</h3>
        <Button size="sm" onClick={() => setAssignOpen(true)} className="gap-1.5">
          <FolderKanban className="h-3.5 w-3.5" /> Assign Project
        </Button>
      </div>

      {team.projects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FolderKanban className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No projects assigned to this team</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {team.projects.map((pt: any) => (
            <Card key={pt.id} className="group hover:border-blue-500/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: pt.project.color || "#3b82f6" }}>
                      {pt.project.taskPrefix}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{pt.project.name}</p>
                      <p className="text-xs text-muted-foreground">{pt.project.taskPrefix}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => unassignMutation.mutate({ teamId, projectId: pt.projectId })}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Assign Project to Team</DialogTitle></DialogHeader>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
            <SelectContent>
              {availableProjects.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button disabled={!selectedProjectId || assignMutation.isPending} onClick={() => assignMutation.mutate({ teamId, projectId: selectedProjectId })}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== Activity Tab ============== */
function ActivityTab({ teamId }: { teamId: string }) {
  const [filterUserId, setFilterUserId] = useState<string>("all");

  const { data: activities, isLoading } = trpc.team.getActivity.useQuery({
    teamId,
    limit: 50,
    userId: filterUserId === "all" ? undefined : filterUserId,
  });
  const { data: team } = trpc.team.getById.useQuery({ id: teamId });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-medium text-muted-foreground flex-1">Recent Activity</h3>
        <Select value={filterUserId} onValueChange={setFilterUserId}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {team?.members.map((m: any) => (
              <SelectItem key={m.userId} value={m.userId}>{m.user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !activities?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors">
              <Avatar className="h-7 w-7 mt-0.5 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                  {a.user?.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{a.user?.name}</span>{" "}
                  <span className="text-muted-foreground">{a.action || a.type}</span>
                  {a.project && <span className="text-muted-foreground"> in {a.project.name}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== Workload Tab ============== */
function WorkloadTab({ teamId }: { teamId: string }) {
  const [sortBy, setSortBy] = useState<"name" | "workload">("workload");
  const { data: workload, isLoading } = trpc.team.getWorkload.useQuery({ teamId });

  const sorted = useMemo(() => {
    if (!workload) return [];
    return [...workload].sort((a: any, b: any) =>
      sortBy === "workload" ? b.total - a.total : a.user.name.localeCompare(b.user.name)
    );
  }, [workload, sortBy]);

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Team Workload</h3>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
          <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="workload">By workload</SelectItem>
            <SelectItem value="name">By name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-green-500" /> Completed</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-blue-500" /> In Progress</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-slate-500" /> To Do</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-red-500" /> Overdue</span>
      </div>

      <div className="space-y-4">
        {sorted.map((w: any) => {
          const capacity = Math.min(100, Math.round((w.total / 10) * 100));
          return (
            <div key={w.user.id} className="bg-card border border-border/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{w.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{w.user.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {w.total}/10 tasks — {capacity}% capacity
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">{w.total}</p>
                  <p className="text-[10px] text-muted-foreground">total tasks</p>
                </div>
              </div>

              {/* Stacked Bar */}
              <div className="h-6 rounded-lg bg-muted overflow-hidden flex">
                {w.total > 0 ? (
                  <>
                    {w.completed > 0 && <div className="bg-green-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(w.completed / w.total) * 100}%` }}>{w.completed}</div>}
                    {w.inProgress > 0 && <div className="bg-blue-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(w.inProgress / w.total) * 100}%` }}>{w.inProgress}</div>}
                    {w.todo > 0 && <div className="bg-slate-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(w.todo / w.total) * 100}%` }}>{w.todo}</div>}
                    {w.overdue > 0 && <div className="bg-red-500 flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(w.overdue / w.total) * 100}%` }}>{w.overdue}</div>}
                  </>
                ) : (
                  <div className="flex items-center justify-center w-full text-[10px] text-muted-foreground">No tasks</div>
                )}
              </div>

              {/* Capacity Bar */}
              <div className="mt-2">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${capacity > 80 ? "bg-red-500" : capacity > 50 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${capacity}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============== Performance Tab ============== */
function PerformanceTab({ teamId }: { teamId: string }) {
  const { data: performance, isLoading } = trpc.team.getPerformance.useQuery({ teamId });

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  if (!performance?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <TrendingUp className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No performance data yet</p>
      </div>
    );
  }

  const maxVelocity = Math.max(...performance.map((p: any) => p.velocity), 1);

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-medium text-muted-foreground">30-Day Performance</h3>

      {/* Per-member cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {performance.map((p: any) => (
          <Card key={p.user.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">{p.user.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{p.user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{p.totalTasks} total tasks</p>
                </div>
              </div>

              {/* Velocity Bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Velocity (30d)</span>
                  <span className="font-medium">{p.velocity} tasks</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(p.velocity / maxVelocity) * 100}%` }} />
                </div>
              </div>

              {/* Completion Rate */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Completion Rate</span>
                  <span className="font-medium">{p.completionRate}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${p.completionRate >= 75 ? "bg-green-500" : p.completionRate >= 50 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${p.completionRate}%` }}
                  />
                </div>
              </div>

              {/* Avg Duration */}
              <div className="flex justify-between text-xs pt-2 border-t border-border/50">
                <span className="text-muted-foreground">Avg Task Duration</span>
                <span className="font-medium">{p.avgDurationDays} days</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Comparison Table */}
      <div>
        <h4 className="text-sm font-medium mb-3">Comparison</h4>
        <div className="bg-card border border-border/50 rounded-lg overflow-hidden">
          <div className="grid grid-cols-5 gap-2 p-3 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border/50">
            <span>Member</span>
            <span className="text-center">Velocity</span>
            <span className="text-center">Rate</span>
            <span className="text-center">Avg Days</span>
            <span className="text-center">Total</span>
          </div>
          {performance.map((p: any) => (
            <div key={p.user.id} className="grid grid-cols-5 gap-2 p-3 text-sm border-b border-border/30 last:border-0 hover:bg-muted/20">
              <span className="font-medium truncate">{p.user.name}</span>
              <span className="text-center">{p.velocity}</span>
              <span className="text-center">{p.completionRate}%</span>
              <span className="text-center">{p.avgDurationDays}d</span>
              <span className="text-center">{p.totalTasks}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============== Settings Tab ============== */
function SettingsTab({ teamId, team, workspaceId, onDelete, onBack }: {
  teamId: string; team: any; workspaceId: string; onDelete: () => void; onBack: () => void;
}) {
  const [editName, setEditName] = useState(team.name);
  const [editDesc, setEditDesc] = useState(team.description || "");
  const [editColor, setEditColor] = useState(team.color || COLORS[0]);
  const [editLeadId, setEditLeadId] = useState(team.leadId || "");
  const [saving, setSaving] = useState(false);

  const utils = trpc.useUtils();
  const { data: wsMembers } = trpc.workspace.getMembers.useQuery({ workspaceId }, { enabled: !!workspaceId });

  const updateMutation = trpc.team.update.useMutation({
    onSuccess: () => { utils.team.getById.invalidate(); utils.team.list.invalidate(); setSaving(false); toast.success("Team updated"); },
    onError: (err) => { setSaving(false); toast.error(err.message); },
  });

  const handleSave = () => {
    setSaving(true);
    updateMutation.mutate({
      id: teamId,
      name: editName.trim(),
      description: editDesc.trim() || null,
      color: editColor,
      leadId: editLeadId || null,
    });
  };

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Team Settings</h3>

        <div className="space-y-2">
          <Label>Name</Label>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setEditColor(c)} className={`h-7 w-7 rounded-full border-2 transition-all ${editColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Team Lead</Label>
          <Select value={editLeadId} onValueChange={setEditLeadId}>
            <SelectTrigger><SelectValue placeholder="Select lead" /></SelectTrigger>
            <SelectContent>
              {wsMembers?.map((m: any) => (
                <SelectItem key={m.user?.id || m.userId} value={m.user?.id || m.userId}>{m.user?.name || "Unknown"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={!editName.trim() || saving} className="gap-1.5">
          <Save className="h-3.5 w-3.5" /> Save Changes
        </Button>
      </div>

      <Separator />

      {/* Danger Zone */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
        <Card className="border-red-500/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Team</p>
              <p className="text-xs text-muted-foreground">Remove this team and all memberships permanently.</p>
            </div>
            <Button variant="destructive" size="sm" onClick={onDelete} className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
