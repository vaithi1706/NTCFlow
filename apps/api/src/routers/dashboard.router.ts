import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const widgetTypes = [
  "task_summary", "burndown", "recently_created", "sprint_health",
  "priority_breakdown", "status_breakdown", "type_breakdown",
  "assignee_workload", "activity_stream", "overdue_tasks",
  "completion_trend", "velocity",
] as const;

const widgetWidths = ["half", "full", "third"] as const;

export const dashboardRouter = router({
  getWidgets: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.dashboardWidget.findMany({
        where: { userId: ctx.user.userId, projectId: input.projectId ?? null },
        orderBy: { position: "asc" },
      });
    }),

  addWidget: protectedProcedure
    .input(z.object({
      type: z.enum(widgetTypes),
      projectId: z.string().uuid().optional(),
      title: z.string().optional(),
      position: z.number().int().default(0),
      width: z.enum(widgetWidths).default("half"),
      config: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.prisma.dashboardWidget.aggregate({
        where: { userId: ctx.user.userId, projectId: input.projectId ?? null },
        _max: { position: true },
      });
      return ctx.prisma.dashboardWidget.create({
        data: {
          type: input.type,
          title: input.title,
          position: input.position || (maxPos._max.position ?? -1) + 1,
          width: input.width,
          config: input.config ?? undefined,
          projectId: input.projectId,
          userId: ctx.user.userId,
        },
      });
    }),

  updateWidget: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().optional(),
      width: z.enum(widgetWidths).optional(),
      config: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.dashboardWidget.update({
        where: { id: input.id, userId: ctx.user.userId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.width && { width: input.width }),
          ...(input.config !== undefined && { config: input.config }),
        },
      });
    }),

  removeWidget: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.dashboardWidget.delete({
        where: { id: input.id, userId: ctx.user.userId },
      });
      return { success: true };
    }),

  reorderWidgets: protectedProcedure
    .input(z.object({
      widgets: z.array(z.object({ id: z.string().uuid(), position: z.number().int() })),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.widgets.map((w) =>
          ctx.prisma.dashboardWidget.update({
            where: { id: w.id, userId: ctx.user.userId },
            data: { position: w.position },
          })
        )
      );
      return { success: true };
    }),

  getWidgetData: protectedProcedure
    .input(z.object({
      type: z.enum(widgetTypes),
      projectId: z.string().uuid(),
      config: z.any().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { type, projectId } = input;
      await requireProjectAccess(ctx.prisma, ctx.user.userId, projectId);

      switch (type) {
        case "task_summary": {
          const [total, byStatus, overdueCount] = await Promise.all([
            ctx.prisma.task.count({ where: { projectId, deletedAt: null } }),
            ctx.prisma.task.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: true }),
            ctx.prisma.task.count({ where: { projectId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ["done", "cancelled"] } } }),
          ]);
          return { total, byStatus, overdueCount };
        }

        case "burndown": {
          const days = 30;
          const since = new Date();
          since.setDate(since.getDate() - days);
          const tasks = await ctx.prisma.task.findMany({
            where: { projectId, deletedAt: null, createdAt: { gte: since } },
            select: { createdAt: true, completedAt: true },
          });
          const result: { date: string; created: number; completed: number }[] = [];
          for (let i = 0; i < days; i++) {
            const d = new Date(since);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0]!;
            const dayStart = new Date(dateStr);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            result.push({
              date: dateStr,
              created: tasks.filter((t) => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
              completed: tasks.filter((t) => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd).length,
            });
          }
          return result;
        }

        case "recently_created": {
          return ctx.prisma.task.findMany({
            where: { projectId, deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, title: true, taskNumber: true, status: true, priority: true, type: true, createdAt: true, assignee: { select: { id: true, name: true } } },
          });
        }

        case "sprint_health": {
          const sprint = await ctx.prisma.sprint.findFirst({
            where: { projectId, isActive: true },
            include: { tasks: { include: { task: { select: { status: true, storyPoints: true } } } } },
          });
          if (!sprint) return null;
          const totalTasks = sprint.tasks.length;
          const completedTasks = sprint.tasks.filter((st) => st.task.status === "done").length;
          const totalPoints = sprint.tasks.reduce((s, st) => s + (st.task.storyPoints || 0), 0);
          const completedPoints = sprint.tasks.filter((st) => st.task.status === "done").reduce((s, st) => s + (st.task.storyPoints || 0), 0);
          const daysRemaining = Math.max(0, Math.ceil((sprint.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
          const totalDays = Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24));
          return { name: sprint.name, totalTasks, completedTasks, totalPoints, completedPoints, daysRemaining, totalDays, startDate: sprint.startDate, endDate: sprint.endDate };
        }

        case "priority_breakdown": {
          return ctx.prisma.task.groupBy({ by: ["priority"], where: { projectId, deletedAt: null }, _count: true });
        }

        case "status_breakdown": {
          return ctx.prisma.task.groupBy({ by: ["status"], where: { projectId, deletedAt: null }, _count: true });
        }

        case "type_breakdown": {
          return ctx.prisma.task.groupBy({ by: ["type"], where: { projectId, deletedAt: null }, _count: true });
        }

        case "assignee_workload": {
          const members = await ctx.prisma.projectMember.findMany({
            where: { projectId },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
          });
          const result = [];
          for (const m of members) {
            const taskCount = await ctx.prisma.taskAssignee.count({
              where: { userId: m.userId, task: { projectId, deletedAt: null, status: { notIn: ["done", "cancelled"] } } },
            });
            result.push({ user: m.user, taskCount });
          }
          return result;
        }

        case "activity_stream": {
          return ctx.prisma.activity.findMany({
            where: { projectId },
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
            take: 15,
          });
        }

        case "overdue_tasks": {
          return ctx.prisma.task.findMany({
            where: { projectId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ["done", "cancelled"] } },
            orderBy: { dueDate: "asc" },
            take: 10,
            select: { id: true, title: true, taskNumber: true, dueDate: true, priority: true, assignee: { select: { id: true, name: true } } },
          });
        }

        case "completion_trend": {
          const days = 30;
          const since = new Date();
          since.setDate(since.getDate() - days);
          const tasks = await ctx.prisma.task.findMany({
            where: { projectId, deletedAt: null, completedAt: { gte: since } },
            select: { completedAt: true },
          });
          const result: { date: string; count: number }[] = [];
          for (let i = 0; i < days; i++) {
            const d = new Date(since);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0]!;
            const dayStart = new Date(dateStr);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            result.push({
              date: dateStr,
              count: tasks.filter((t) => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd).length,
            });
          }
          return result;
        }

        case "velocity": {
          const sprints = await ctx.prisma.sprint.findMany({
            where: { projectId, isCompleted: true },
            include: { tasks: { include: { task: { select: { status: true, storyPoints: true } } } } },
            orderBy: { completedAt: "desc" },
            take: 5,
          });
          return sprints.reverse().map((s) => ({
            name: s.name,
            totalPoints: s.tasks.reduce((sum, st) => sum + (st.task.storyPoints || 0), 0),
            completedPoints: s.tasks.filter((st) => st.task.status === "done").reduce((sum, st) => sum + (st.task.storyPoints || 0), 0),
            totalTasks: s.tasks.length,
            completedTasks: s.tasks.filter((st) => st.task.status === "done").length,
          }));
        }

        default:
          return null;
      }
    }),

  createDefaults: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.dashboardWidget.count({
        where: { userId: ctx.user.userId, projectId: input.projectId },
      });
      if (existing > 0) return { created: false };

      const defaults = [
        { type: "task_summary", width: "full", position: 0 },
        { type: "priority_breakdown", width: "half", position: 1 },
        { type: "status_breakdown", width: "half", position: 2 },
        { type: "activity_stream", width: "full", position: 3 },
        { type: "assignee_workload", width: "half", position: 4 },
        { type: "overdue_tasks", width: "half", position: 5 },
      ];

      await ctx.prisma.dashboardWidget.createMany({
        data: defaults.map((d) => ({
          ...d,
          userId: ctx.user.userId,
          projectId: input.projectId,
        })),
      });
      return { created: true };
    }),
});
