import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requireOwnerOrAdmin, requireWorkspaceMembership } from "../middleware/permissions.js";
import { DEFAULT_ROLES } from "../utils/default-roles.js";

const permissionsSchema = z.object({
  canCreateProject: z.boolean(),
  canDeleteProject: z.boolean(),
  canManageMembers: z.boolean(),
  canInviteMembers: z.boolean(),
  canCreateTasks: z.boolean(),
  canEditAnyTask: z.boolean(),
  canDeleteTasks: z.boolean(),
  canManageSprints: z.boolean(),
  canManageBoard: z.boolean(),
  canViewReports: z.boolean(),
  canManageLabels: z.boolean(),
  canManageAutomations: z.boolean(),
  canAccessSettings: z.boolean(),
  canExportData: z.boolean(),
});

export const roleRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.role.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { workspaceMembers: true, projectMembers: true } },
        },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const role = await ctx.prisma.role.findUnique({
        where: { id: input.id },
        include: { _count: { select: { workspaceMembers: true, projectMembers: true } } },
      });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, role.workspaceId);
      return role;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(7).optional(),
      permissions: permissionsSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.role.create({
        data: {
          name: input.name,
          description: input.description,
          color: input.color,
          permissions: input.permissions,
          isSystem: false,
          workspaceId: input.workspaceId,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      color: z.string().max(7).optional().nullable(),
      permissions: permissionsSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.prisma.role.findUnique({ where: { id: input.id } });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, role.workspaceId);

      const data: any = {};
      if (input.permissions) data.permissions = input.permissions;
      if (input.color !== undefined) data.color = input.color;
      if (input.description !== undefined) data.description = input.description;
      // System roles can't be renamed
      if (input.name && !role.isSystem) data.name = input.name;

      return ctx.prisma.role.update({ where: { id: input.id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.prisma.role.findUnique({ where: { id: input.id } });
      if (!role) throw new TRPCError({ code: "NOT_FOUND", message: "Role not found" });
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, role.workspaceId);
      if (role.isSystem) throw new TRPCError({ code: "FORBIDDEN", message: "Cannot delete system roles" });

      // Unset roleId on members using this role
      await ctx.prisma.workspaceMember.updateMany({ where: { roleId: input.id }, data: { roleId: null } });
      await ctx.prisma.projectMember.updateMany({ where: { roleId: input.id }, data: { roleId: null } });

      await ctx.prisma.role.delete({ where: { id: input.id } });
      return { success: true };
    }),

  assignToMember: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      userId: z.string().uuid(),
      roleId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
        data: { roleId: input.roleId },
      });
    }),

  assignToProjectMember: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
      roleId: z.string().uuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectMember.update({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
        data: { roleId: input.roleId },
      });
    }),

  seedSystemRoles: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, input.workspaceId);
      const existing = await ctx.prisma.role.findMany({ where: { workspaceId: input.workspaceId, isSystem: true } });
      const existingNames = new Set(existing.map((r) => r.name));
      const toCreate = DEFAULT_ROLES.filter((r) => !existingNames.has(r.name));
      for (const role of toCreate) {
        await ctx.prisma.role.create({
          data: { ...role, isSystem: true, workspaceId: input.workspaceId },
        });
      }
      return { created: toCreate.length };
    }),
});
