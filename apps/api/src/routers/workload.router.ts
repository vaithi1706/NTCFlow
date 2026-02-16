import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const workloadRouter = router({
  getCapacity: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      weekStart: z.string().datetime().optional(),
      weekEnd: z.string().datetime().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const weekStart = input.weekStart ? new Date(input.weekStart) : getWeekStart(now);
      const weekEnd = input.weekEnd ? new Date(input.weekEnd) : getWeekEnd(now);
      const nextWeekEnd = new Date(weekEnd);
      nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);

      // Get workspace members
      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      const result = await Promise.all(members.map(async (member) => {
        const userId = member.userId;

        // Active tasks (not done/cancelled)
        const activeTasks = await ctx.prisma.task.findMany({
          where: {
            assignees: { some: { userId } },
            status: { notIn: ["done", "cancelled"] },
            deletedAt: null,
            project: { workspaceId: input.workspaceId },
          },
          include: {
            project: { select: { id: true, name: true, color: true } },
          },
        });

        const totalStoryPoints = activeTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
        const totalEstimateHours = activeTasks.reduce((sum, t) => sum + (t.estimateHours || 0), 0);

        const dueThisWeek = activeTasks.filter((t) =>
          t.dueDate && t.dueDate >= weekStart && t.dueDate <= weekEnd
        ).length;

        const dueNextWeek = activeTasks.filter((t) =>
          t.dueDate && t.dueDate > weekEnd && t.dueDate <= nextWeekEnd
        ).length;

        const overdue = activeTasks.filter((t) =>
          t.dueDate && t.dueDate < now
        ).length;

        // Group by project
        const byProject: Record<string, { projectId: string; projectName: string; color: string | null; count: number; points: number; hours: number }> = {};
        for (const t of activeTasks) {
          const pid = t.projectId;
          if (!byProject[pid]) {
            byProject[pid] = {
              projectId: pid,
              projectName: t.project.name,
              color: t.project.color,
              count: 0,
              points: 0,
              hours: 0,
            };
          }
          byProject[pid].count++;
          byProject[pid].points += t.storyPoints || 0;
          byProject[pid].hours += t.estimateHours || 0;
        }

        const capacityHoursPerDay = 8;
        const capacityHoursPerWeek = capacityHoursPerDay * 5;
        const utilization = capacityHoursPerWeek > 0
          ? Math.round((totalEstimateHours / capacityHoursPerWeek) * 100)
          : 0;

        return {
          userId,
          user: member.user,
          activeTasks: activeTasks.length,
          totalStoryPoints,
          totalEstimateHours,
          dueThisWeek,
          dueNextWeek,
          overdue,
          capacityHoursPerDay,
          capacityHoursPerWeek,
          utilization,
          byProject: Object.values(byProject),
        };
      }));

      const totalCapacity = result.length * 40;
      const totalUtilized = result.reduce((s, m) => s + m.totalEstimateHours, 0);
      const overloaded = result.filter((m) => m.utilization > 100).length;
      const underloaded = result.filter((m) => m.utilization < 50).length;

      return {
        members: result,
        summary: {
          totalCapacity,
          totalUtilized,
          utilizationPercent: totalCapacity > 0 ? Math.round((totalUtilized / totalCapacity) * 100) : 0,
          overloaded,
          underloaded,
          totalMembers: result.length,
        },
      };
    }),
});

function getWeekStart(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getWeekEnd(d: Date) {
  const start = getWeekStart(d);
  start.setDate(start.getDate() + 6);
  start.setHours(23, 59, 59, 999);
  return start;
}
