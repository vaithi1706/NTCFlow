import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireFeature } from "../middleware/subscription.js";
import { getAccessibleProjectIds } from "../middleware/permissions.js";

export const portfolioRouter = router({
  getOverview: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const { workspaceId } = input;

      // Scope to the user's accessible projects (owners/admins still see everything).
      const { projectIds, isMember } = await getAccessibleProjectIds(ctx.prisma, userId, workspaceId);
      if (!isMember) return { projects: [], summary: { totalProjects: 0, totalTasks: 0, completionPercent: 0, overdueTasks: 0 } };
      await requireFeature(workspaceId, "portfolio");

      const projects = await ctx.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          deletedAt: null,
        },
        include: {
          owner: { select: { id: true, name: true, avatarUrl: true } },
          members: { select: { userId: true } },
          tasks: {
            where: { deletedAt: null },
            select: { id: true, status: true, dueDate: true },
          },
          sprints: {
            where: { status: "active" },
            select: { id: true, name: true, startDate: true, endDate: true, sprintTasks: { select: { taskId: true } } },
            take: 1,
          },
          activities: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      const now = new Date();
      let totalTasks = 0;
      let totalDone = 0;
      let totalOverdue = 0;

      const projectData = projects.map((p) => {
        const tasks = p.tasks;
        const done = tasks.filter((t) => t.status === "done" || t.status === "cancelled").length;
        const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done" && t.status !== "cancelled").length;
        const total = tasks.length;
        const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

        totalTasks += total;
        totalDone += done;
        totalOverdue += overdue;

        const statusCounts: Record<string, number> = {};
        for (const t of tasks) {
          statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
        }

        const activeSprint = p.sprints[0] || null;

        return {
          id: p.id,
          name: p.name,
          color: p.color,
          icon: p.icon,
          slug: p.slug,
          owner: p.owner,
          teamSize: p.members.length,
          taskCount: total,
          statusCounts,
          completionPercent,
          overdueCount: overdue,
          activeSprint: activeSprint ? {
            id: activeSprint.id,
            name: activeSprint.name,
            startDate: activeSprint.startDate,
            endDate: activeSprint.endDate,
            taskCount: activeSprint.sprintTasks.length,
          } : null,
          lastActivity: p.activities[0]?.createdAt || p.updatedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });

      return {
        projects: projectData,
        summary: {
          totalProjects: projects.length,
          totalTasks,
          completionPercent: totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0,
          overdueTasks: totalOverdue,
        },
      };
    }),

  getTimeline: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const { workspaceId } = input;

      const { projectIds, isMember } = await getAccessibleProjectIds(ctx.prisma, userId, workspaceId);
      if (!isMember) return [];

      const projects = await ctx.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          deletedAt: null,
        },
        include: {
          tasks: {
            where: { deletedAt: null },
            select: { startDate: true, dueDate: true, createdAt: true },
          },
        },
      });

      return projects.map((p) => {
        const dates = p.tasks
          .flatMap((t) => [t.startDate, t.dueDate, t.createdAt])
          .filter(Boolean) as Date[];
        const startDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : p.createdAt;
        const endDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : new Date();

        return {
          id: p.id,
          name: p.name,
          color: p.color,
          startDate,
          endDate,
        };
      });
    }),

  getHealthMatrix: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const { workspaceId } = input;

      const { projectIds, isMember } = await getAccessibleProjectIds(ctx.prisma, userId, workspaceId);
      if (!isMember) return [];

      const now = new Date();

      const projects = await ctx.prisma.project.findMany({
        where: {
          id: { in: projectIds },
          deletedAt: null,
        },
        include: {
          tasks: {
            where: { deletedAt: null, status: { notIn: ["done", "cancelled"] } },
            select: { dueDate: true },
          },
        },
      });

      return projects.map((p) => {
        const active = p.tasks.length;
        const overdue = p.tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
        const ratio = active > 0 ? overdue / active : 0;
        const health: "on-track" | "at-risk" | "off-track" =
          ratio > 0.3 ? "off-track" : ratio > 0.1 ? "at-risk" : "on-track";

        return {
          id: p.id,
          name: p.name,
          color: p.color,
          health,
          activeTasks: active,
          overdueTasks: overdue,
        };
      });
    }),
});
