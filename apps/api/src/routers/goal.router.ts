import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";

export const goalRouter = router({
  list: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      status: z.string().optional(),
      ownerId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        workspaceId: input.workspaceId,
        type: "objective",
      };
      if (input.status) where.status = input.status;
      if (input.ownerId) where.ownerId = input.ownerId;

      const objectives = await ctx.prisma.goal.findMany({
        where,
        include: {
          children: {
            include: {
              taskLinks: true,
            },
            orderBy: { createdAt: "asc" },
          },
          taskLinks: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate progress for each objective from linked tasks
      const enriched = await Promise.all(objectives.map(async (obj) => {
        const allTaskLinks = [
          ...obj.taskLinks,
          ...obj.children.flatMap((kr) => kr.taskLinks),
        ];
        const taskIds = allTaskLinks.map((l) => l.taskId);
        let progress = obj.progress;
        if (taskIds.length > 0) {
          const tasks = await ctx.prisma.task.findMany({
            where: { id: { in: taskIds }, deletedAt: null },
            select: { id: true, status: true },
          });
          const completed = tasks.filter((t) => t.status === "done").length;
          progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        }

        const enrichedChildren = await Promise.all(obj.children.map(async (kr) => {
          const krTaskIds = kr.taskLinks.map((l) => l.taskId);
          let krProgress = kr.progress;
          if (krTaskIds.length > 0) {
            const krTasks = await ctx.prisma.task.findMany({
              where: { id: { in: krTaskIds }, deletedAt: null },
              select: { id: true, status: true },
            });
            const krCompleted = krTasks.filter((t) => t.status === "done").length;
            krProgress = krTasks.length > 0 ? Math.round((krCompleted / krTasks.length) * 100) : 0;
          }
          return { ...kr, progress: krProgress, _count: { taskLinks: kr.taskLinks.length } };
        }));

        return { ...obj, progress, children: enrichedChildren, _count: { taskLinks: obj.taskLinks.length } };
      }));

      return enriched;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      title: z.string().min(1).max(255),
      description: z.string().optional(),
      type: z.enum(["objective", "key_result"]).default("objective"),
      parentId: z.string().uuid().optional(),
      ownerId: z.string().uuid().optional(),
      targetValue: z.number().optional(),
      currentValue: z.number().optional(),
      startDate: z.string().datetime().optional(),
      dueDate: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.goal.create({
        data: {
          workspaceId: input.workspaceId,
          title: input.title,
          description: input.description,
          type: input.type,
          parentId: input.parentId,
          ownerId: input.ownerId,
          targetValue: input.targetValue,
          currentValue: input.currentValue,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      description: z.string().optional(),
      status: z.enum(["on_track", "at_risk", "behind", "completed"]).optional(),
      progress: z.number().int().min(0).max(100).optional(),
      targetValue: z.number().optional(),
      currentValue: z.number().optional(),
      ownerId: z.string().uuid().nullable().optional(),
      dueDate: z.string().datetime().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, dueDate, ...rest } = input;
      return ctx.prisma.goal.update({
        where: { id },
        data: {
          ...rest,
          dueDate: dueDate === null ? null : dueDate ? new Date(dueDate) : undefined,
          updatedAt: new Date(),
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.goal.delete({ where: { id: input.id } });
    }),

  linkTask: protectedProcedure
    .input(z.object({
      goalId: z.string().uuid(),
      taskId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.goalTaskLink.create({
        data: { goalId: input.goalId, taskId: input.taskId },
      });
    }),

  unlinkTask: protectedProcedure
    .input(z.object({
      goalId: z.string().uuid(),
      taskId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.goalTaskLink.deleteMany({
        where: { goalId: input.goalId, taskId: input.taskId },
      });
    }),

  getDetail: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const goal = await ctx.prisma.goal.findUnique({
        where: { id: input.id },
        include: {
          children: {
            include: { taskLinks: true },
            orderBy: { createdAt: "asc" },
          },
          taskLinks: true,
        },
      });
      if (!goal) throw new TRPCError({ code: "NOT_FOUND" });

      // Get linked tasks details
      const allTaskIds = [
        ...goal.taskLinks.map((l) => l.taskId),
        ...goal.children.flatMap((kr) => kr.taskLinks.map((l) => l.taskId)),
      ];
      const tasks = allTaskIds.length > 0
        ? await ctx.prisma.task.findMany({
            where: { id: { in: allTaskIds }, deletedAt: null },
            include: {
              assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            },
          })
        : [];

      const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));
      const completed = tasks.filter((t) => t.status === "done").length;
      const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : goal.progress;

      return {
        ...goal,
        progress,
        linkedTasks: goal.taskLinks.map((l) => taskMap[l.taskId]).filter(Boolean),
        children: goal.children.map((kr) => ({
          ...kr,
          linkedTasks: kr.taskLinks.map((l) => taskMap[l.taskId]).filter(Boolean),
        })),
        stats: { total: tasks.length, completed, progress },
      };
    }),
});
