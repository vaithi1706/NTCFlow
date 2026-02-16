"use client";

import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { formatDistanceToNow } from "date-fns";
import { User, Mail, Globe, FolderOpen, CheckSquare } from "lucide-react";
import Link from "next/link";

export default function UserProfilePage() {
  const { userId } = useParams() as { userId: string };
  const { workspaceId } = useAuthStore();

  const { data: members } = trpc.workspace.getMembers.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId }
  );

  const member = members?.find((m: any) => (m.user?.id || m.userId) === userId);
  const userData = (member as any)?.user || member;
  const name = (userData as any)?.name || "Unknown User";
  const email = (userData as any)?.email || "";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase();

  const { data: workspaces } = trpc.workspace.list.useQuery(undefined, { enabled: !!workspaceId });
  const currentWorkspace = workspaces?.find((w: any) => w.id === workspaceId);
  const wsSlug = currentWorkspace?.slug || "workspace";

  const { data: projects } = trpc.project.list.useQuery(
    { workspaceId: workspaceId! },
    { enabled: !!workspaceId }
  );

  // Filter projects where this user is a member
  const userProjects = projects?.filter((p: any) =>
    p.members?.some((m: any) => m.userId === userId)
  ) || [];

  return (
    <>
      <TopBar breadcrumbs={[{ label: "DKFlow", href: "/home" }, { label: "Team", href: "/members" }, { label: name }]} />
      <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full space-y-6">
        {/* Profile Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold">{name}</h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{email}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  {member?.role && (
                    <Badge variant="outline" className="capitalize">{member.role}</Badge>
                  )}
                  {member?.joinedAt && (
                    <span className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Projects</CardTitle>
            </div>
            <CardDescription>Projects this member is part of</CardDescription>
          </CardHeader>
          <CardContent>
            {!projects ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : userProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Not a member of any projects yet</p>
            ) : (
              <div className="space-y-2">
                {userProjects.map((project: any) => (
                  <Link
                    key={project.id}
                    href={`/${wsSlug}/projects/${project.id}/board`}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#94A3B8" }} />
                    <span className="text-sm font-medium flex-1">{project.name}</span>
                    {project._count?.tasks != null && (
                      <span className="text-xs text-muted-foreground">{project._count.tasks} tasks</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
