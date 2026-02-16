import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject , requireProjectAccess } from "../middleware/permissions.js";

export const statsRouter = router({
  workspaceOverview: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const wsMember = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
      });
      if (!wsMember) throw new Error("Not a workspace member");

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const projectIds = (await ctx.prisma.project.findMany({
        where: { workspaceId: input.workspaceId, deletedAt: null },
        select: { id: true },
      })).map(p => p.id);

      const baseWhere = { projectId: { in: projectIds }, deletedAt: null };

      const [totalTasks, completedThisWeek, completedToday, overdueTasks, activeSprints, myTasks] = await Promise.all([
        ctx.prisma.task.count({ where: baseWhere }),
        ctx.prisma.task.count({ where: { ...baseWhere, status: "done", completedAt: { gte: startOfWeek } } }),
        ctx.prisma.task.count({ where: { ...baseWhere, status: "done", completedAt: { gte: todayStart } } }),
        ctx.prisma.task.count({ where: { ...baseWhere, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] } } }),
        ctx.prisma.sprint.count({ where: { projectId: { in: projectIds }, isActive: true } }),
        ctx.prisma.task.count({ where: { ...baseWhere, assignees: { some: { userId } }, status: { notIn: ["done", "cancelled"] } } }),
      ]);

      return { totalTasks, completedThisWeek, completedToday, overdueTasks, activeSprints, myTasks };
    }),

  projectOverview: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canViewReports");
      const [byStatus, byPriority, overdueCount, totalCount] = await Promise.all([
        ctx.prisma.task.groupBy({ by: ["status"], where: { projectId: input.projectId, deletedAt: null }, _count: true }),
        ctx.prisma.task.groupBy({ by: ["priority"], where: { projectId: input.projectId, deletedAt: null }, _count: true }),
        ctx.prisma.task.count({ where: { projectId: input.projectId, deletedAt: null, dueDate: { lt: new Date() }, status: { notIn: ["done", "cancelled"] } } }),
        ctx.prisma.task.count({ where: { projectId: input.projectId, deletedAt: null } }),
      ]);
      return { byStatus, byPriority, overdueCount, totalCount };
    }),

  memberWorkload: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canViewReports");
      const members = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });
      const result = [];
      for (const m of members) {
        const taskCount = await ctx.prisma.taskAssignee.count({
          where: { userId: m.userId, task: { projectId: input.projectId, deletedAt: null, status: { notIn: ["done", "cancelled"] } } },
        });
        result.push({ user: m.user, taskCount });
      }
      return result;
    }),

  burndown: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);
      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null, createdAt: { gte: since } },
        select: { createdAt: true, completedAt: true, status: true },
      });
      const days: { date: string; created: number; completed: number }[] = [];
      for (let i = 0; i < input.days; i++) {
        const d = new Date(since);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0]!;
        const dayStart = new Date(dateStr);
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        days.push({
          date: dateStr,
          created: tasks.filter(t => t.createdAt >= dayStart && t.createdAt < dayEnd).length,
          completed: tasks.filter(t => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd).length,
        });
      }
      return days;
    }),

  velocity: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, isCompleted: true },
        include: { tasks: { include: { task: { select: { status: true, storyPoints: true } } } } },
        orderBy: { completedAt: "asc" },
        take: 10,
      });
      return sprints.map(s => ({
        sprintId: s.id,
        name: s.name,
        completedAt: s.completedAt,
        totalTasks: s.tasks.length,
        completedTasks: s.tasks.filter(st => st.task.status === "done").length,
        totalPoints: s.tasks.reduce((sum, st) => sum + (st.task.storyPoints || 0), 0),
        completedPoints: s.tasks.filter(st => st.task.status === "done").reduce((sum, st) => sum + (st.task.storyPoints || 0), 0),
      }));
    }),

  recentActivity: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.activity.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }),
});
