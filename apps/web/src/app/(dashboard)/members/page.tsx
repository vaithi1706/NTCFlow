"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { UserPlus, Copy, Link as LinkIcon, Users, Search, X, Mail, ChevronRight } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

function getRoleDisplay(member: any) {
  // Primary: customRole from roleId (the actual Role record for THIS workspace)
  if (member.customRole) {
    return { name: member.customRole.name, color: member.customRole.color || "#6b7280" };
  }
  // Fallback to enum
  const colors: Record<string, string> = { owner: "#ef4444", admin: "#f97316", member: "#22c55e", guest: "#6b7280" };
  return { name: member.role, color: colors[member.role] || "#6b7280" };
}

export default function MembersPage() {
  const { user, workspaceId } = useAuthStore();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState<string>("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [removeMemberName, setRemoveMemberName] = useState("");
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const utils = trpc.useUtils();

  const { data: members, isLoading } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const { data: roles } = trpc.role.list.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const assignRoleMutation = trpc.role.assignToMember.useMutation({
    onSuccess: () => {
      utils.workspace.getMembers.invalidate();
      toast.success("Role updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const { data: pendingInvites } = trpc.workspace.getPendingInvites.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const inviteMutation = trpc.workspace.inviteMember.useMutation({
    onSuccess: (data: any) => {
      const code = data?.code || data?.inviteCode || data;
      const link = `${window.location.origin}/invite/${code}`;
      setInviteLink(link);
      utils.workspace.getPendingInvites.invalidate();
      toast.success("Invite link generated!");
    },
    onError: (err: any) => toast.error(err.message || "Failed to generate invite"),
  });

  const removeMemberMutation = trpc.workspace.removeMember.useMutation({
    onSuccess: () => {
      utils.workspace.getMembers.invalidate();
      setRemoveMemberId(null);
      toast.success("Member removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const revokeInviteMutation = trpc.workspace.revokeInvite.useMutation({
    onSuccess: () => {
      utils.workspace.getPendingInvites.invalidate();
      toast.success("Invite revoked");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleGenerateInvite = () => {
    if (!workspaceId || !inviteEmail) return;
    // Map roleId to basic role for the invite
    const selectedRole = roles?.find((r: any) => r.id === inviteRoleId);
    const roleName = selectedRole?.name?.toLowerCase() || "member";
    const basicRole = roleName === "owner" || roleName === "admin" ? "admin" : roleName === "viewer" ? "guest" : "member";
    inviteMutation.mutate({
      workspaceId,
      email: inviteEmail,
      role: basicRole as "admin" | "member" | "guest",
    });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Invite link copied!");
  };

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m: any) => {
      const name = (m.user?.name || "").toLowerCase();
      const email = (m.user?.email || "").toLowerCase();
      const matchesSearch = !search || name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
      if (roleFilter === "all") return matchesSearch;
      // Filter by customRole name or basic role
      const display = getRoleDisplay(m);
      return matchesSearch && display.name.toLowerCase() === roleFilter.toLowerCase();
    });
  }, [members, search, roleFilter]);

  // Get unique role names for filter
  const roleNames = useMemo(() => {
    if (!members) return [];
    const names = new Set(members.map((m: any) => getRoleDisplay(m).name));
    return Array.from(names).sort();
  }, [members]);

  // Check if current user is owner/admin
  const myMembership = members?.find((m: any) => (m.user?.id || m.userId) === user?.id);
  const canManage = myMembership?.role === "owner" || myMembership?.role === "admin";

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Team Members" }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Team Members</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your workspace team</p>
          </div>
          {canManage && (
            <Button onClick={() => { setInviteLink(""); setInviteEmail(""); setInviteRoleId(roles?.find((r: any) => r.name === "Developer")?.id || ""); setInviteDialogOpen(true); }} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Invite Member
            </Button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search members..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Members List */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Members ({filteredMembers.length})</CardTitle>
            <CardDescription>People with access to this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {search || roleFilter !== "all" ? "No members match your filters" : "No members yet. Invite your team!"}
              </p>
            ) : (
              <div className="space-y-1">
                {filteredMembers.map((member: any) => {
                  const memberId = member.user?.id || member.userId;
                  const isMe = memberId === user?.id;
                  const isOwner = member.role === "owner";
                  const display = getRoleDisplay(member);
                  return (
                    <div
                      key={member.id || memberId}
                      className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedMember(member)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">
                            {(member.user?.name || "U").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.user?.name || "Unknown"}
                            {isMe && <span className="text-xs text-muted-foreground ml-2">(you)</span>}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{member.user?.email || ""}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {member.joinedAt ? formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true }) : ""}
                        </span>
                        {/* Role Badge */}
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{
                            color: display.color,
                            borderColor: display.color + "40",
                            backgroundColor: display.color + "10",
                          }}
                        >
                          {display.name}
                        </Badge>
                        {/* Role Assignment (for admins/owners) */}
                        {canManage && !isOwner && !isMe && roles && roles.length > 0 && (
                          <Select
                            value={member.roleId || "none"}
                            onValueChange={(val) => {
                              if (!workspaceId) return;
                              assignRoleMutation.mutate({ workspaceId, userId: memberId, roleId: val === "none" ? null : val });
                            }}
                          >
                            <SelectTrigger className="w-36 h-7 text-xs" onClick={(e) => e.stopPropagation()}>
                              <SelectValue placeholder="Change role" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles.map((r: any) => (
                                <SelectItem key={r.id} value={r.id}>
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2 w-2 rounded-full inline-block" style={{ backgroundColor: r.color || "#6b7280" }} />
                                    {r.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {canManage && !isOwner && !isMe && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemoveMemberId(memberId);
                              setRemoveMemberName(member.user?.name || "this member");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Invites */}
        {pendingInvites && pendingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Pending Invites ({pendingInvites.length})
              </CardTitle>
              <CardDescription>Invitations awaiting acceptance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingInvites.map((invite: any) => (
                  <div key={invite.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                          {invite.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited {formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true })}
                          {invite.createdBy?.name && ` by ${invite.createdBy.name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{invite.role}</Badge>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-destructive hover:text-destructive"
                          onClick={() => revokeInviteMutation.mutate({ inviteId: invite.id })}
                        >
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Remove Member Confirm */}
        <ConfirmDialog
          open={!!removeMemberId}
          onOpenChange={(open) => { if (!open) setRemoveMemberId(null); }}
          title="Remove member"
          description={`Are you sure you want to remove ${removeMemberName} from this workspace? They will lose access to all projects.`}
          confirmLabel="Remove"
          onConfirm={() => {
            if (removeMemberId && workspaceId) {
              removeMemberMutation.mutate({ workspaceId, userId: removeMemberId });
            }
          }}
          destructive
        />

        {/* Invite Dialog */}
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>Send an invite to join your workspace</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Email</label>
                <Input
                  type="email"
                  placeholder="teammate@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Role</label>
                <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                  <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
                  <SelectContent>
                    {roles?.filter((r: any) => r.name !== "Owner").map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color || "#6b7280" }} />
                          {r.name}
                          {r.description && <span className="text-muted-foreground">— {r.description}</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!inviteLink ? (
                <Button onClick={handleGenerateInvite} disabled={inviteMutation.isPending || !inviteEmail} className="w-full gap-2">
                  <UserPlus className="w-4 h-4" />
                  {inviteMutation.isPending ? "Generating..." : "Generate Invite Link"}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input value={inviteLink} readOnly className="text-sm" />
                    <Button size="icon" variant="outline" onClick={copyInviteLink}><Copy className="w-4 h-4" /></Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with <strong>{inviteEmail}</strong>. They&apos;ll join as <strong>{roles?.find((r: any) => r.id === inviteRoleId)?.name || "Member"}</strong>.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Member Profile Sheet */}
        <Sheet open={!!selectedMember} onOpenChange={(open) => { if (!open) setSelectedMember(null); }}>
          <SheetContent className="sm:max-w-md">
            {selectedMember && <MemberProfilePanel member={selectedMember} />}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

function MemberProfilePanel({ member }: { member: any }) {
  const name = member.user?.name || "Unknown";
  const email = member.user?.email || "";
  const display = getRoleDisplay(member);

  return (
    <>
      <SheetHeader>
        <SheetTitle>Member Profile</SheetTitle>
      </SheetHeader>
      <div className="mt-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-xl">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="text-lg font-semibold">{name}</h3>
            <p className="text-sm text-muted-foreground">{email}</p>
            <Badge
              variant="outline"
              className="mt-1 text-xs"
              style={{ color: display.color, borderColor: display.color + "40", backgroundColor: display.color + "10" }}
            >
              {display.name}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Joined</span>
            <span>{member.joinedAt ? format(new Date(member.joinedAt), "MMM d, yyyy") : "—"}</span>
          </div>
        </div>
      </div>
    </>
  );
}
