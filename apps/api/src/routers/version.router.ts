import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { getWorkspaceIdFromProject , requireProjectAccess } from "../middleware/permissions.js";
import { logAudit } from "../utils/audit.js";

export const versionRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const versions = await ctx.prisma.version.findMany({
        where: { projectId: input.projectId },
        include: {
          tasks: {
            include: {
              task: { select: { id: true, status: true, completedAt: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return versions.map((v) => {
        const totalTasks = v.tasks.length;
        const doneTasks = v.tasks.filter(
          (tv) => tv.task.status === "done" || tv.task.status === "cancelled"
        ).length;
        return {
          ...v,
          taskCount: totalTasks,
          doneCount: doneTasks,
          progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
        };
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const version = await ctx.prisma.version.findUnique({
        where: { id: input.id },
        include: {
          tasks: {
            include: {
              task: {
                include: {
                  assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                  labels: { include: { label: true } },
                  column: { select: { id: true, name: true, color: true } },
                },
              },
            },
          },
        },
      });
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });
      return version;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().max(2000).optional(),
      startDate: z.string().datetime().optional(),
      releaseDate: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.version.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
        },
      });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await logAudit(ctx.prisma, {
        workspaceId: wsId, userId: ctx.user.userId,
        action: "version.created", entityType: "version", entityId: version.id,
        metadata: { name: input.name },
      });
      return version;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(2000).optional().nullable(),
      status: z.enum(["unreleased", "released", "archived"]).optional(),
      startDate: z.string().datetime().optional().nullable(),
      releaseDate: z.string().datetime().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.releaseDate !== undefined) updateData.releaseDate = data.releaseDate ? new Date(data.releaseDate) : null;
      return ctx.prisma.version.update({ where: { id }, data: updateData });
    }),

  release: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.prisma.version.update({
        where: { id: input.id },
        data: { status: "released", releasedAt: new Date() },
      });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, version.projectId);
      await logAudit(ctx.prisma, {
        workspaceId: wsId, userId: ctx.user.userId,
        action: "version.released", entityType: "version", entityId: version.id,
        metadata: { name: version.name },
      });
      return version;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.version.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addTask: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid(),
      taskId: z.string().uuid(),
      type: z.enum(["fix", "affects"]).default("fix"),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.taskVersion.create({
        data: { versionId: input.versionId, taskId: input.taskId, type: input.type },
      });
    }),

  removeTask: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskVersion.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getByTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.taskVersion.findMany({
        where: { taskId: input.taskId },
        include: { version: { select: { id: true, name: true, status: true } } },
      });
    }),
});
