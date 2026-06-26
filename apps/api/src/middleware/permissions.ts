import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

export type PermissionKey =
  | "canCreateProject"
  | "canDeleteProject"
  | "canManageMembers"
  | "canInviteMembers"
  | "canCreateTasks"
  | "canEditAnyTask"
  | "canDeleteTasks"
  | "canManageSprints"
  | "canManageBoard"
  | "canViewReports"
  | "canManageLabels"
  | "canManageAutomations"
  | "canAccessSettings"
  | "canExportData";

export async function getWorkspaceMemberWithRole(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { customRole: true },
  });
}

export async function checkPermission(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
  permission: PermissionKey
): Promise<boolean> {
  const member = await getWorkspaceMemberWithRole(prisma, userId, workspaceId);
  if (!member) return false;

  // If member has a Role record with permissions JSON, use that
  if (member.customRole && member.customRole.permissions) {
    const perms = member.customRole.permissions as Record<string, boolean>;
    return perms[permission] === true;
  }

  // Fallback to legacy role field — owner/admin get all perms
  if (member.role === "owner") return true;
  if (member.role === "admin") return true;
  // member/guest get nothing by default in fallback mode
  return false;
}

export async function requirePermission(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string,
  permission: PermissionKey
): Promise<void> {
  const allowed = await checkPermission(prisma, userId, workspaceId, permission);
  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You do not have permission: ${permission}`,
    });
  }
}

export async function requireWorkspaceMembership(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
) {
  const member = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!member) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this workspace",
    });
  }
  return member;
}

export async function requireOwnerOrAdmin(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
) {
  const member = await getWorkspaceMemberWithRole(prisma, userId, workspaceId);
  if (!member) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });
  }

  // Check via Role record
  if (member.customRole && (member.customRole.name === "Owner" || member.customRole.name === "Admin")) {
    return member;
  }

  // Fallback to legacy role field
  if (member.role === "owner" || member.role === "admin") {
    return member;
  }

  throw new TRPCError({ code: "FORBIDDEN", message: "Only Owner/Admin can perform this action" });
}

/**
 * Check if user has access to a project.
 * Access is granted if:
 *   1. User is workspace Owner or Admin
 *   2. User is a ProjectMember
 *   3. User's team is assigned to the project (ProjectTeam + TeamMember)
 *   4. User is the project owner
 */
export async function requireProjectAccess(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  workspaceId?: string
): Promise<void> {
  // Resolve workspaceId if not provided
  if (!workspaceId) {
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workspaceId: true, ownerId: true },
    });
    if (!proj || !proj.workspaceId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    // Quick check: project owner always has access
    if (proj.ownerId === userId) return;
    workspaceId = proj.workspaceId;
  }

  // 1. Workspace Owner/Admin → allow
  const wsMember = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { customRole: true },
  });
  if (!wsMember) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });
  }
  if (wsMember.role === "owner" || wsMember.role === "admin") return;
  if (wsMember.customRole && (wsMember.customRole.name === "Owner" || wsMember.customRole.name === "Admin")) return;

  // 2. ProjectMember → allow
  const pm = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (pm) return;

  // 3. User's team assigned to project → allow
  const teamAccess = await prisma.projectTeam.findFirst({
    where: {
      projectId,
      team: { members: { some: { userId } } },
    },
  });
  if (teamAccess) return;

  // 4. Check project ownership (if we didn't already above)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { ownerId: true },
  });
  if (project && project.ownerId === userId) return;

  throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this project" });
}

/**
 * Check project access without throwing — returns boolean.
 */
export async function hasProjectAccess(
  prisma: PrismaClient,
  userId: string,
  projectId: string,
  workspaceId?: string
): Promise<boolean> {
  try {
    await requireProjectAccess(prisma, userId, projectId, workspaceId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the set of project IDs a user can access within a workspace.
 *
 * Rules (mirrors project.list, activity.getWorkspaceActivity, search.global):
 *   - Workspace owners/admins (legacy roles "owner"/"admin", or custom roles named
 *     "Owner"/"Admin") see ALL non-deleted projects in the workspace.
 *   - Everyone else sees only projects where they are: (a) a direct ProjectMember,
 *     (b) a member via a Team assigned to the project, or (c) the project owner.
 *   - Non-workspace-members get an empty list.
 *
 * Use this in any dashboard/widget/aggregate endpoint that scopes data to
 * "the user's projects in this workspace" instead of fetching all workspace
 * projects unconditionally.
 */
export async function getAccessibleProjectIds(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<{ projectIds: string[]; isOwnerOrAdmin: boolean; isMember: boolean }> {
  const member = await getWorkspaceMemberWithRole(prisma, userId, workspaceId);
  if (!member) return { projectIds: [], isOwnerOrAdmin: false, isMember: false };

  const isOwnerOrAdmin =
    member.role === "owner" || member.role === "admin" ||
    !!(member.customRole && (member.customRole.name === "Owner" || member.customRole.name === "Admin"));

  if (isOwnerOrAdmin) {
    const all = await prisma.project.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    });
    return { projectIds: all.map(p => p.id), isOwnerOrAdmin: true, isMember: true };
  }

  const [direct, teamBased, owned] = await Promise.all([
    prisma.projectMember.findMany({
      where: { userId, project: { workspaceId, deletedAt: null } },
      select: { projectId: true },
    }),
    prisma.projectTeam.findMany({
      where: { project: { workspaceId, deletedAt: null }, team: { members: { some: { userId } } } },
      select: { projectId: true },
    }),
    prisma.project.findMany({
      where: { ownerId: userId, workspaceId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  const projectIds = [...new Set([
    ...direct.map(m => m.projectId),
    ...teamBased.map(t => t.projectId),
    ...owned.map(p => p.id),
  ])];

  return { projectIds, isOwnerOrAdmin: false, isMember: true };
}

/**
 * Given a projectId, resolve the workspaceId
 */
export async function getWorkspaceIdFromProject(
  prisma: PrismaClient,
  projectId: string
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  if (!project || !project.workspaceId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project.workspaceId;
}
