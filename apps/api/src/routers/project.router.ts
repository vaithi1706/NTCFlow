import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { createSlug } from "../utils/helpers.js";
import { requirePermission, requireWorkspaceMembership, getWorkspaceIdFromProject, requireProjectAccess } from "../middleware/permissions.js";
import { seedDefaultWorkflow } from "./workflow.router.js";
import { checkLimit } from "../middleware/subscription.js";

const DEFAULT_COLUMNS = [
  { name: "To Do", color: "#6B7280", position: 0 },
  { name: "In Progress", color: "#3B82F6", position: 1 },
  { name: "In Review", color: "#F59E0B", position: 2 },
  { name: "Done", color: "#10B981", position: 3, isDone: true },
];

export const projectRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const workspaceId = input.workspaceId;

      // Check workspace membership
      const wsMember = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
        include: { customRole: true },
      });
      if (!wsMember) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });
      }

      // Owner/Admin see ALL projects in the workspace
      const isOwnerOrAdmin =
        wsMember.role === "owner" || wsMember.role === "admin" ||
        (wsMember.customRole && (wsMember.customRole.name === "Owner" || wsMember.customRole.name === "Admin"));

      console.log('[DEBUG] isOwnerOrAdmin:', isOwnerOrAdmin, 'role:', wsMember.role, 'customRole:', wsMember.customRole?.name);
      if (isOwnerOrAdmin) {
        const allProjects = await ctx.prisma.project.findMany({
          where: { workspaceId, deletedAt: null },
          include: {
            _count: { select: { members: true, tasks: true } },
            owner: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: "desc" },
        });
        console.log('[DEBUG] owner projects count:', allProjects.length, allProjects.map(p => p.name));
        return allProjects;
      }

      // Regular members: only projects they have access to
      // 1. Direct project membership
      const directMemberships = await ctx.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });
      const directProjectIds = directMemberships.map(m => m.projectId);

      // 2. Team-based access
      const teamProjects = await ctx.prisma.projectTeam.findMany({
        where: { team: { members: { some: { userId } } } },
        select: { projectId: true },
      });
      const teamProjectIds = teamProjects.map(t => t.projectId);

      // 3. Projects owned by user
      const accessibleIds = [...new Set([...directProjectIds, ...teamProjectIds])];

      return ctx.prisma.project.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { id: { in: accessibleIds } },
            { ownerId: userId },
          ],
        },
        include: {
          _count: { select: { members: true, tasks: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.id },
        include: {
          columns: { orderBy: { position: "asc" } },
          labels: true,
          _count: { select: { members: true, tasks: true } },
          owner: { select: { id: true, name: true, avatarUrl: true } },
        },
      });
      if (!project || project.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.id, project.workspaceId || undefined);
      return project;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(5000).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().max(50).optional(),
      workspaceId: z.string().uuid(),
      taskPrefix: z.string().min(1).max(10).optional().default("DK"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requirePermission(ctx.prisma, ctx.user.userId, input.workspaceId, "canCreateProject");
      // Subscription limit check
      const projectCount = await ctx.prisma.project.count({ where: { workspaceId: input.workspaceId, deletedAt: null } });
      await checkLimit(input.workspaceId, "maxProjects", projectCount);
      const slug = createSlug(input.name) + "-" + Date.now().toString(36);
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          color: input.color,
          icon: input.icon,
          workspaceId: input.workspaceId,
          ownerId: ctx.user.userId,
          slug,
          taskPrefix: input.taskPrefix,
          columns: { create: DEFAULT_COLUMNS },
          members: { create: { userId: ctx.user.userId, role: "lead" } },
        },
        include: { columns: { orderBy: { position: "asc" } } },
      });

      await ctx.prisma.activity.create({
        data: {
          projectId: project.id,
          userId: ctx.user.userId,
          entityType: "project",
          entityId: project.id,
          action: "created",
          description: `Created project "${project.name}"`,
        },
      });

      // Seed default workflow statuses
      await seedDefaultWorkflow(ctx.prisma, project.id).catch(() => {});

      return project;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(5000).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      icon: z.string().max(50).optional(),
      defaultView: z.enum(["board", "list", "table"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.id);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canAccessSettings");
      const { id, ...data } = input;
      return ctx.prisma.project.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.id);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canDeleteProject");
      await ctx.prisma.project.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.update({ where: { id: input.id }, data: { isArchived: true } });
    }),

  unarchive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.project.update({ where: { id: input.id }, data: { isArchived: false } });
    }),

  getMembers: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const members = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
      // Add task counts per member
      const taskCounts = await ctx.prisma.taskAssignee.groupBy({
        by: ["userId"],
        where: {
          task: { projectId: input.projectId, deletedAt: null },
          userId: { in: members.map(m => m.userId) },
        },
        _count: { userId: true },
      });
      const countMap = new Map(taskCounts.map(tc => [tc.userId, tc._count.userId]));
      return members.map(m => ({ ...m, taskCount: countMap.get(m.userId) || 0 }));
    }),

  addMember: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["lead", "member", "viewer"]).default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectMember.create({
        data: { projectId: input.projectId, userId: input.userId, role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.projectMember.delete({
        where: { projectId_userId: { projectId: input.projectId, userId: input.userId } },
      });
      return { success: true };
    }),

  getActivity: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const activities = await ctx.prisma.activity.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = activities.length > input.limit;
      if (hasMore) activities.pop();
      return { activities, nextCursor: hasMore ? activities[activities.length - 1]?.id : null };
    }),

  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const orig = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.id },
        include: { columns: { orderBy: { position: "asc" } }, labels: true },
      });
      // Subscription limit check
      if (orig.workspaceId) {
        const projectCount = await ctx.prisma.project.count({ where: { workspaceId: orig.workspaceId, deletedAt: null } });
        await checkLimit(orig.workspaceId, "maxProjects", projectCount);
      }
      const slug = createSlug(input.name) + "-" + Date.now().toString(36);
      const project = await ctx.prisma.project.create({
        data: {
          name: input.name,
          description: orig.description,
          color: orig.color,
          icon: orig.icon,
          workspaceId: orig.workspaceId,
          ownerId: ctx.user.userId,
          slug,
          taskPrefix: orig.taskPrefix,
          columns: { create: orig.columns.map(c => ({ name: c.name, color: c.color, position: c.position, isDone: c.isDone })) },
          labels: { create: orig.labels.map(l => ({ name: l.name, color: l.color })) },
          members: { create: { userId: ctx.user.userId, role: "lead" } },
        },
        include: { columns: { orderBy: { position: "asc" } }, labels: true },
      });
      return project;
    }),

  getStats: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const [byStatus, byPriority, total] = await Promise.all([
        ctx.prisma.task.groupBy({ by: ["status"], where: { projectId: input.projectId, deletedAt: null }, _count: true }),
        ctx.prisma.task.groupBy({ by: ["priority"], where: { projectId: input.projectId, deletedAt: null }, _count: true }),
        ctx.prisma.task.count({ where: { projectId: input.projectId, deletedAt: null } }),
      ]);
      return { byStatus, byPriority, total };
    }),

  export: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const project = await ctx.prisma.project.findUniqueOrThrow({
        where: { id: input.projectId },
        include: {
          columns: { orderBy: { position: "asc" } },
          labels: true,
          tasks: {
            where: { deletedAt: null },
            include: {
              assignees: { include: { user: { select: { id: true, name: true, email: true } } } },
              labels: { include: { label: true } },
              comments: { where: { deletedAt: null }, select: { id: true, content: true, createdAt: true, user: { select: { name: true } } } },
            },
          },
          members: { include: { user: { select: { id: true, name: true, email: true } } } },
          sprints: { include: { tasks: { select: { taskId: true } } } },
        },
      });
      return project;
    }),

  togglePublic: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.prisma.project.update({ where: { id: input.id }, data: { isPublic: !(project as any).isPublic } });
    }),

  getPublicBoard: publicProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { id: true, name: true, description: true, color: true, isPublic: true },
      });
      if (!project || !project.isPublic) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found or not public" });

      const columns = await ctx.prisma.boardColumn.findMany({
        where: { projectId: input.projectId },
        orderBy: { position: "asc" },
      });

      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
        },
        orderBy: { position: "asc" },
      });

      return { project, columns, tasks };
    }),

  generateInboundEmail: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const crypto = await import("node:crypto");
      const slug = crypto.randomBytes(8).toString("hex");
      const email = `project-${slug}@dkflow.app`;
      const project = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { inboundEmail: email },
      });
      return { inboundEmail: project.inboundEmail };
    }),

  disableInboundEmail: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { inboundEmail: null },
      });
      return { success: true };
    }),
});
