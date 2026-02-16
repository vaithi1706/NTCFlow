import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject, requireProjectAccess } from "../middleware/permissions.js";
import { notifyIntegrations } from "../services/integrations.js";

export const sprintRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId },
        include: { tasks: { include: { task: { include: { assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } } } } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      goal: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageSprints");
      const sprint = await ctx.prisma.sprint.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          goal: input.goal,
        },
      });
      await ctx.prisma.activity.create({
        data: { projectId: input.projectId, userId: ctx.user.userId, entityType: "sprint", entityId: sprint.id, action: "created", description: `Created sprint "${input.name}"` },
      });
      return sprint;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      goal: z.string().max(1000).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const updateData: any = { ...data };
      if (data.startDate) updateData.startDate = new Date(data.startDate);
      if (data.endDate) updateData.endDate = new Date(data.endDate);
      return ctx.prisma.sprint.update({ where: { id }, data: updateData });
    }),

  start: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, sprint.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageSprints");
      // Deactivate any other active sprint in the project
      await ctx.prisma.sprint.updateMany({ where: { projectId: sprint.projectId, isActive: true }, data: { isActive: false } });
      const updated = await ctx.prisma.sprint.update({ where: { id: input.id }, data: { isActive: true } });
      await ctx.prisma.activity.create({
        data: { projectId: sprint.projectId, userId: ctx.user.userId, entityType: "sprint", entityId: sprint.id, action: "started", description: `Started sprint "${sprint.name}"` },
      });
      notifyIntegrations(ctx.prisma, wsId, "sprint.started", {
        title: `Sprint started: ${sprint.name}`,
        fields: sprint.goal ? [{ label: "Goal", value: sprint.goal }] : [],
      }).catch(() => {});
      return updated;
    }),

  complete: protectedProcedure
    .input(z.object({ id: z.string().uuid(), moveIncompleteToSprintId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({ where: { id: input.id }, include: { tasks: { include: { task: true } } } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, sprint.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageSprints");

      if (input.moveIncompleteToSprintId) {
        const incompleteTasks = sprint.tasks.filter(st => st.task.status !== "done" && st.task.status !== "cancelled");
        for (const st of incompleteTasks) {
          await ctx.prisma.sprintTask.create({ data: { sprintId: input.moveIncompleteToSprintId, taskId: st.taskId } }).catch(() => {});
        }
      }

      const updated = await ctx.prisma.sprint.update({ where: { id: input.id }, data: { isActive: false, isCompleted: true, completedAt: new Date() } });
      await ctx.prisma.activity.create({
        data: { projectId: sprint.projectId, userId: ctx.user.userId, entityType: "sprint", entityId: sprint.id, action: "completed", description: `Completed sprint "${sprint.name}"` },
      });
      notifyIntegrations(ctx.prisma, wsId, "sprint.completed", {
        title: `Sprint completed: ${sprint.name}`,
        fields: [{ label: "Tasks", value: `${sprint.tasks.length} total` }],
      }).catch(() => {});
      return updated;
    }),

  addTask: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.sprintTask.create({ data: { sprintId: input.sprintId, taskId: input.taskId } });
      return { success: true };
    }),

  removeTask: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.sprintTask.delete({ where: { sprintId_taskId: { sprintId: input.sprintId, taskId: input.taskId } } });
      return { success: true };
    }),

  getBoard: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({ where: { id: input.sprintId }, select: { projectId: true } });
      const columns = await ctx.prisma.boardColumn.findMany({
        where: { projectId: sprint.projectId },
        orderBy: { position: "asc" },
      });
      const sprintTaskIds = (await ctx.prisma.sprintTask.findMany({ where: { sprintId: input.sprintId }, select: { taskId: true } })).map(st => st.taskId);

      const tasks = await ctx.prisma.task.findMany({
        where: { id: { in: sprintTaskIds }, deletedAt: null },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
          _count: { select: { comments: true, subtasks: true } },
        },
        orderBy: { position: "asc" },
      });

      return columns.map(col => ({
        ...col,
        tasks: tasks.filter(t => t.columnId === col.id),
      }));
    }),

  getBurndown: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({ where: { id: input.sprintId } });
      const sprintTasks = await ctx.prisma.sprintTask.findMany({ where: { sprintId: input.sprintId }, include: { task: { select: { status: true, completedAt: true, storyPoints: true } } } });

      const totalTasks = sprintTasks.length;
      const totalPoints = sprintTasks.reduce((sum, st) => sum + (st.task.storyPoints || 1), 0);

      // Build daily burndown
      const start = new Date(sprint.startDate);
      const end = new Date(sprint.endDate);
      const days: { date: string; remainingTasks: number; remainingPoints: number; ideal: number }[] = [];
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayEnd = new Date(d);
        dayEnd.setHours(23, 59, 59, 999);
        const completedByDay = sprintTasks.filter(st => st.task.completedAt && new Date(st.task.completedAt) <= dayEnd);
        const dayIndex = Math.ceil((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

        days.push({
          date: d.toISOString().split("T")[0]!,
          remainingTasks: totalTasks - completedByDay.length,
          remainingPoints: totalPoints - completedByDay.reduce((sum, st) => sum + (st.task.storyPoints || 1), 0),
          ideal: Math.max(0, totalPoints - (totalPoints / totalDays) * dayIndex),
        });
      }

      return { totalTasks, totalPoints, days };
    }),
});
