import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { createSlug, generateInviteCode } from "../utils/helpers.js";
import { sendInviteEmail } from "../services/email.js";
import { requirePermission, requireWorkspaceMembership, getWorkspaceMemberWithRole } from "../middleware/permissions.js";
import { checkLimit } from "../middleware/subscription.js";

export const workspaceRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.workspaceMember.findMany({
      where: { userId: ctx.user.userId },
      include: {
        workspace: {
          include: { _count: { select: { members: true, projects: true } } },
        },
      },
    });
    return memberships.map((m) => ({ ...m.workspace, role: m.role }));
  }),

  switch: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
        include: {
          workspace: {
            include: { _count: { select: { members: true, projects: true } } },
          },
        },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      return { ...member.workspace, role: member.role };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.id, userId: ctx.user.userId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });

      return ctx.prisma.workspace.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
          _count: { select: { projects: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(100), description: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const slug = createSlug(input.name) + "-" + Date.now().toString(36);
      const workspace = await ctx.prisma.workspace.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          ownerId: ctx.user.userId,
        },
      });

      // Seed default roles
      const { seedRolesForWorkspace } = await import("../utils/default-roles.js");
      await seedRolesForWorkspace(ctx.prisma, workspace.id);

      // Add creator as Owner
      const ownerRole = await ctx.prisma.role.findUnique({
        where: { workspaceId_name: { workspaceId: workspace.id, name: "Owner" } },
      });
      await ctx.prisma.workspaceMember.create({
        data: { userId: ctx.user.userId, workspaceId: workspace.id, role: "owner", roleId: ownerRole?.id || null },
      });

      // Auto-create free subscription
      await ctx.prisma.subscription.create({
        data: { workspaceId: workspace.id, plan: "free", status: "active" },
      }).catch(() => {}); // Ignore if already exists

      return workspace;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      logoUrl: z.string().url().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.prisma, ctx.user.userId, input.id, "canAccessSettings");
      const { id, ...data } = input;
      return ctx.prisma.workspace.update({ where: { id }, data });
    }),

  getMembers: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          customRole: { select: { id: true, name: true, color: true } },
        },
      });
    }),

  inviteMember: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["admin", "member", "guest"]).default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.prisma, ctx.user.userId, input.workspaceId, "canInviteMembers");

      // Subscription limit check
      const memberCount = await ctx.prisma.workspaceMember.count({ where: { workspaceId: input.workspaceId } });
      await checkLimit(input.workspaceId, "maxMembers", memberCount);

      const code = generateInviteCode();
      const invite = await ctx.prisma.workspaceInvite.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email,
          role: input.role,
          code,
          createdById: ctx.user.userId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      // Send invite email (best effort)
      const inviter = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
      const workspace = await ctx.prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true } });
      if (inviter?.name && workspace?.name) {
        sendInviteEmail(input.email, {
          inviterName: inviter.name,
          workspaceName: workspace.name,
          inviteCode: invite.code,
        }).catch((err) => console.error("[email] Failed to send invite:", err));
      }

      return { code: invite.code };
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["admin", "member", "guest"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.prisma, ctx.user.userId, input.workspaceId, "canManageMembers");

      const target = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      if (target.role === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot change owner role" });

      return ctx.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
        data: { role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      userId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.prisma, ctx.user.userId, input.workspaceId, "canManageMembers");

      const target = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });
      if (target.role === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove the owner" });

      await ctx.prisma.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      });
      return { success: true };
    }),

  getPendingInvites: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workspaceInvite.findMany({
        where: { workspaceId: input.workspaceId, status: "pending", expiresAt: { gt: new Date() } },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ inviteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.prisma.workspaceInvite.findUnique({ where: { id: input.inviteId }, include: { workspace: true } });
      if (!invite) throw new TRPCError({ code: "NOT_FOUND" });

      const me = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: ctx.user.userId } },
      });
      if (!me || !["owner", "admin"].includes(me.role))
        throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.prisma.workspaceInvite.update({ where: { id: input.inviteId }, data: { status: "revoked" } });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const me = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.id, userId: ctx.user.userId } },
      });
      if (!me || me.role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can delete the workspace" });

      await ctx.prisma.workspace.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return { success: true };
    }),

  joinByInvite: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.prisma.workspaceInvite.findUnique({ where: { code: input.code } });
      if (!invite || invite.status !== "pending" || invite.expiresAt < new Date())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired invite" });

      const existing = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId: ctx.user.userId } },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });

      // Look up the corresponding Role record (default to Developer)
      const roleName = invite.role === "admin" ? "Admin" : invite.role === "guest" ? "Viewer" : "Developer";
      const roleRecord = await ctx.prisma.role.findUnique({
        where: { workspaceId_name: { workspaceId: invite.workspaceId, name: roleName } },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.workspaceMember.create({
          data: { workspaceId: invite.workspaceId, userId: ctx.user.userId, role: invite.role, roleId: roleRecord?.id || null },
        }),
        ctx.prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: "accepted" } }),
      ]);

      return { workspaceId: invite.workspaceId };
    }),

  getInviteInfo: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check WorkspaceInvite first
      const wsInvite = await ctx.prisma.workspaceInvite.findUnique({
        where: { code: input.code },
        include: { workspace: { select: { id: true, name: true, logoUrl: true } }, createdBy: { select: { name: true } } },
      });
      if (wsInvite && wsInvite.status === "pending" && wsInvite.expiresAt > new Date()) {
        return {
          valid: true,
          workspaceName: wsInvite.workspace.name,
          workspaceLogo: wsInvite.workspace.logoUrl,
          role: wsInvite.role,
          invitedBy: wsInvite.createdBy.name,
          email: wsInvite.email,
        };
      }
      // Check Invitation table
      const inv = await ctx.prisma.invitation.findUnique({
        where: { token: input.code },
        include: { workspace: { select: { id: true, name: true, logoUrl: true } }, invitedBy: { select: { name: true } } },
      });
      if (inv && inv.status === "pending" && inv.expiresAt > new Date()) {
        return {
          valid: true,
          workspaceName: inv.workspace.name,
          workspaceLogo: inv.workspace.logoUrl,
          role: inv.role,
          invitedBy: inv.invitedBy.name,
          email: inv.email,
        };
      }
      return { valid: false, workspaceName: null, workspaceLogo: null, role: null, invitedBy: null, email: null };
    }),

  getMyPendingInvites: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { email: true } });
      if (!user) return [];
      const wsInvites = await ctx.prisma.workspaceInvite.findMany({
        where: { email: user.email, status: "pending", expiresAt: { gt: new Date() } },
        include: { workspace: { select: { id: true, name: true, logoUrl: true } }, createdBy: { select: { name: true } } },
      });
      const invitations = await ctx.prisma.invitation.findMany({
        where: { email: user.email, status: "pending", expiresAt: { gt: new Date() } },
        include: { workspace: { select: { id: true, name: true, logoUrl: true } }, invitedBy: { select: { name: true } } },
      });
      return [
        ...wsInvites.map((i) => ({ id: i.id, type: "wsInvite" as const, code: i.code, workspaceName: i.workspace.name, workspaceLogo: i.workspace.logoUrl, role: i.role, invitedBy: i.createdBy.name, createdAt: i.createdAt })),
        ...invitations.map((i) => ({ id: i.id, type: "invitation" as const, code: i.token, workspaceName: i.workspace.name, workspaceLogo: i.workspace.logoUrl, role: i.role, invitedBy: i.invitedBy.name, createdAt: i.createdAt })),
      ];
    }),

  completeOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      await ctx.prisma.user.update({ where: { id: ctx.user.userId }, data: { onboardingCompleted: true } });
      return { success: true };
    }),

  getMyPermissions: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await getWorkspaceMemberWithRole(ctx.prisma, ctx.user.userId, input.workspaceId);
      if (!member) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this workspace" });
      }

      if (member.customRole) {
        return {
          roleName: member.customRole.name,
          roleColor: member.customRole.color,
          permissions: member.customRole.permissions as Record<string, boolean>,
        };
      }

      // Fallback for legacy roles without roleId
      const allTrue = {
        canCreateProject: true, canDeleteProject: true, canManageMembers: true, canInviteMembers: true,
        canCreateTasks: true, canEditAnyTask: true, canDeleteTasks: true, canManageSprints: true,
        canManageBoard: true, canViewReports: true, canManageLabels: true, canManageAutomations: true,
        canAccessSettings: true, canExportData: true,
      };
      const allFalse = Object.fromEntries(Object.keys(allTrue).map(k => [k, false]));

      if (member.role === "owner" || member.role === "admin") {
        return { roleName: member.role, roleColor: null, permissions: allTrue };
      }
      return { roleName: member.role, roleColor: null, permissions: allFalse };
    }),
});
