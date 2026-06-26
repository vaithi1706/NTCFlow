import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject , requireProjectAccess, getAccessibleProjectIds, checkPermission } from "../middleware/permissions.js";

export const statsRouter = router({
  workspaceOverview: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const { projectIds, isMember } = await getAccessibleProjectIds(ctx.prisma, userId, input.workspaceId);
      if (!isMember) throw new Error("Not a workspace member");

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      // The home dashboard is personal: every count is filtered to tasks
      // assigned to the caller. Project/workspace-wide views live on the
      // Project Overview page and the Portfolio page.
      const mine = { assignees: { some: { userId } } };
      const baseWhere = { projectId: { in: projectIds }, deletedAt: null, ...mine };

      const [totalTasks, completedThisWeek, completedToday, overdueTasks, activeSprints] = await Promise.all([
        // My open tasks (active, not done/cancelled).
        ctx.prisma.task.count({ where: { ...baseWhere, status: { notIn: ["done", "cancelled"] } } }),
        // My done tasks completed this week.
        ctx.prisma.task.count({ where: { ...baseWhere, status: "done", completedAt: { gte: startOfWeek } } }),
        // My done tasks completed today.
        ctx.prisma.task.count({ where: { ...baseWhere, status: "done", completedAt: { gte: todayStart } } }),
        // My overdue active tasks.
        ctx.prisma.task.count({ where: { ...baseWhere, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] } } }),
        // Active sprints that include at least one task assigned to me.
        ctx.prisma.sprint.count({
          where: {
            projectId: { in: projectIds },
            isActive: true,
            tasks: { some: { task: mine } },
          },
        }),
      ]);

      // `myTasks` kept as an alias for the home header text ("X tasks
      // assigned to you") -- same value as totalTasks now that totals are
      // personal.
      return { totalTasks, completedThisWeek, completedToday, overdueTasks, activeSprints, myTasks: totalTasks };
    }),

  /**
   * Per-member drill-down: every task assigned to a given user inside a
   * workspace, split into Open / Completed-in-range / Overdue buckets.
   * Powers the /profile/[userId] activity panel and the (planned) per-person
   * Reports view.
   *
   * Permission model: the caller can see this if they ARE the target user,
   * or if they have `canViewReports` in the workspace (Owner/Admin/PM/
   * Scrum/PO/BA per default-roles).
   */
  memberActivity: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      userId: z.string().uuid(),
      dateRange: z.enum(["last_7_days", "last_30_days", "last_90_days"]).default("last_30_days"),
    }))
    .query(async ({ ctx, input }) => {
      const callerId = ctx.user.userId;
      if (callerId !== input.userId) {
        const ok = await checkPermission(ctx.prisma, callerId, input.workspaceId, "canViewReports");
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to view this member's activity" });
      }

      const now = new Date();
      const days = input.dateRange === "last_7_days" ? 7 : input.dateRange === "last_90_days" ? 90 : 30;
      const from = new Date(now);
      from.setDate(now.getDate() - days);

      const baseWhere = {
        project: { workspaceId: input.workspaceId, deletedAt: null },
        deletedAt: null,
        assignees: { some: { userId: input.userId } },
      };

      const taskSelect = {
        id: true,
        taskNumber: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        completedAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true, color: true, slug: true } },
      } as const;

      const [openTasks, completedTasks, overdueTasks] = await Promise.all([
        ctx.prisma.task.findMany({
          where: { ...baseWhere, status: { notIn: ["done", "cancelled"] } },
          select: taskSelect,
          orderBy: { updatedAt: "desc" },
          take: 100,
        }),
        ctx.prisma.task.findMany({
          where: { ...baseWhere, status: "done", completedAt: { gte: from, lte: now } },
          select: taskSelect,
          orderBy: { completedAt: "desc" },
          take: 100,
        }),
        ctx.prisma.task.findMany({
          where: { ...baseWhere, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] } },
          select: taskSelect,
          orderBy: { dueDate: "asc" },
          take: 100,
        }),
      ]);

      return {
        dateRange: { from: from.toISOString(), to: now.toISOString(), days },
        counts: {
          open: openTasks.length,
          completed: completedTasks.length,
          overdue: overdueTasks.length,
        },
        openTasks,
        completedTasks,
        overdueTasks,
      };
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
