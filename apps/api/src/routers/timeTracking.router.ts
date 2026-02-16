import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";

export const timeTrackingRouter = router({
  getTimeReport: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      groupBy: z.enum(["user", "task", "date"]).default("user"),
    }))
    .query(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canViewReports");
      await requireFeature(wsId, "timeTracking");

      const where: any = {
        action: "logged_time",
        task: { projectId: input.projectId, deletedAt: null },
      };
      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) where.createdAt.gte = new Date(input.startDate);
        if (input.endDate) where.createdAt.lte = new Date(input.endDate);
      }

      const entries = await ctx.prisma.taskActivity.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          task: { select: { id: true, title: true, taskNumber: true, estimateHours: true, timeSpent: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Totals
      const totalLogged = entries.reduce((s, e) => s + parseFloat(e.newValue || "0"), 0);

      // Get all tasks with estimates for the project
      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null, estimateHours: { not: null } },
        select: { estimateHours: true, timeSpent: true },
      });
      const totalEstimate = tasks.reduce((s, t) => s + (t.estimateHours || 0), 0);

      // Group by user
      const byUser = new Map<string, { user: any; hours: number }>();
      for (const e of entries) {
        if (!e.user) continue;
        const existing = byUser.get(e.user.id) || { user: e.user, hours: 0 };
        existing.hours += parseFloat(e.newValue || "0");
        byUser.set(e.user.id, existing);
      }

      // Group by task
      const byTask = new Map<string, { task: any; hours: number }>();
      for (const e of entries) {
        const existing = byTask.get(e.taskId) || { task: e.task, hours: 0 };
        existing.hours += parseFloat(e.newValue || "0");
        byTask.set(e.taskId, existing);
      }

      // Group by date
      const byDate = new Map<string, number>();
      for (const e of entries) {
        const dateStr = new Date(e.createdAt).toISOString().split("T")[0]!;
        byDate.set(dateStr, (byDate.get(dateStr) || 0) + parseFloat(e.newValue || "0"));
      }

      return {
        totalLogged,
        totalEstimate,
        entries: entries.map((e) => ({
          id: e.id,
          user: e.user,
          task: e.task,
          hours: parseFloat(e.newValue || "0"),
          description: (e.metadata as any)?.description || null,
          date: e.createdAt,
        })),
        byUser: Array.from(byUser.values()).sort((a, b) => b.hours - a.hours),
        byTask: Array.from(byTask.values()).sort((a, b) => b.hours - a.hours),
        byDate: Array.from(byDate.entries())
          .map(([date, hours]) => ({ date, hours }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),
});
