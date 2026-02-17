import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess } from "../middleware/permissions.js";

export const sprintChartRouter = router({
  takeSnapshot: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({
        where: { id: input.sprintId },
        include: { tasks: { include: { task: { select: { status: true, storyPoints: true } } } } },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, sprint.projectId);

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const totalTasks = sprint.tasks.length;
      const totalPoints = sprint.tasks.reduce((s, st) => s + (st.task.storyPoints || 0), 0);
      const completedTasks = sprint.tasks.filter(st => st.task.status === "done" || st.task.status === "cancelled").length;
      const completedPoints = sprint.tasks.filter(st => st.task.status === "done" || st.task.status === "cancelled").reduce((s, st) => s + (st.task.storyPoints || 0), 0);

      // Status breakdown
      const statusBreakdown: Record<string, number> = {};
      for (const st of sprint.tasks) {
        statusBreakdown[st.task.status] = (statusBreakdown[st.task.status] || 0) + 1;
      }

      const snapshot = await ctx.prisma.sprintSnapshot.upsert({
        where: { sprintId_date: { sprintId: input.sprintId, date: today } },
        create: { sprintId: input.sprintId, date: today, totalTasks, completedTasks, totalPoints, completedPoints, statusBreakdown },
        update: { totalTasks, completedTasks, totalPoints, completedPoints, statusBreakdown },
      });

      return snapshot;
    }),

  getBurndown: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid(), mode: z.enum(["points", "tasks"]).default("points") }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({
        where: { id: input.sprintId },
        include: { tasks: { include: { task: { select: { status: true, storyPoints: true, completedAt: true } } } } },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, sprint.projectId);

      const snapshots = await ctx.prisma.sprintSnapshot.findMany({
        where: { sprintId: input.sprintId },
        orderBy: { date: "asc" },
      });

      const start = new Date(sprint.startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(sprint.endDate);
      end.setUTCHours(0, 0, 0, 0);
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      const totalTasks = sprint.tasks.length;
      const totalPoints = sprint.tasks.reduce((s, st) => s + (st.task.storyPoints || 0), 0);
      const totalValue = input.mode === "points" ? totalPoints : totalTasks;

      const snapshotMap = new Map(snapshots.map(s => [s.date.toISOString().split("T")[0], s]));

      const days: { date: string; remaining: number; ideal: number }[] = [];
      const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0]!;
        const dayIndex = Math.round((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const ideal = Math.max(0, totalValue - (totalValue / totalDays) * dayIndex);

        const snap = snapshotMap.get(dateStr);
        let remaining: number;
        if (snap) {
          remaining = input.mode === "points" ? (snap.totalPoints - snap.completedPoints) : (snap.totalTasks - snap.completedTasks);
        } else if (d <= now) {
          // Retroactively compute from task completedAt
          const dayEnd = new Date(d);
          dayEnd.setUTCHours(23, 59, 59, 999);
          const completedByDay = sprint.tasks.filter(st => st.task.completedAt && new Date(st.task.completedAt) <= dayEnd);
          remaining = input.mode === "points"
            ? totalPoints - completedByDay.reduce((s, st) => s + (st.task.storyPoints || 0), 0)
            : totalTasks - completedByDay.length;
        } else {
          continue; // Future date with no snapshot
        }

        days.push({ date: dateStr, remaining, ideal: Math.round(ideal * 100) / 100 });
      }

      return { total: totalValue, days, sprintName: sprint.name, startDate: sprint.startDate, endDate: sprint.endDate };
    }),

  getBurnup: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid(), mode: z.enum(["points", "tasks"]).default("points") }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({
        where: { id: input.sprintId },
        include: { tasks: { include: { task: { select: { status: true, storyPoints: true, completedAt: true } } } } },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, sprint.projectId);

      const snapshots = await ctx.prisma.sprintSnapshot.findMany({
        where: { sprintId: input.sprintId },
        orderBy: { date: "asc" },
      });
      const snapshotMap = new Map(snapshots.map(s => [s.date.toISOString().split("T")[0], s]));

      const start = new Date(sprint.startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(sprint.endDate);
      end.setUTCHours(0, 0, 0, 0);
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      const days: { date: string; completed: number; scope: number }[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0]!;
        if (d > now) continue;

        const snap = snapshotMap.get(dateStr);
        let completed: number, scope: number;
        if (snap) {
          completed = input.mode === "points" ? snap.completedPoints : snap.completedTasks;
          scope = input.mode === "points" ? snap.totalPoints : snap.totalTasks;
        } else {
          const dayEnd = new Date(d);
          dayEnd.setUTCHours(23, 59, 59, 999);
          const completedByDay = sprint.tasks.filter(st => st.task.completedAt && new Date(st.task.completedAt) <= dayEnd);
          scope = input.mode === "points"
            ? sprint.tasks.reduce((s, st) => s + (st.task.storyPoints || 0), 0)
            : sprint.tasks.length;
          completed = input.mode === "points"
            ? completedByDay.reduce((s, st) => s + (st.task.storyPoints || 0), 0)
            : completedByDay.length;
        }

        days.push({ date: dateStr, completed, scope });
      }

      return { days, sprintName: sprint.name };
    }),

  getVelocity: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), count: z.number().min(1).max(20).default(10) }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const sprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, isCompleted: true },
        include: { tasks: { include: { task: { select: { status: true, storyPoints: true } } } } },
        orderBy: { completedAt: "desc" },
        take: input.count,
      });

      const data = sprints.reverse().map(s => {
        const completedPoints = s.tasks
          .filter(st => st.task.status === "done")
          .reduce((sum, st) => sum + (st.task.storyPoints || 0), 0);
        const totalPoints = s.tasks.reduce((sum, st) => sum + (st.task.storyPoints || 0), 0);
        return { sprintId: s.id, sprintName: s.name, completedPoints, totalPoints, completedTasks: s.tasks.filter(st => st.task.status === "done").length, totalTasks: s.tasks.length };
      });

      const avg = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.completedPoints, 0) / data.length) : 0;

      return { sprints: data, average: avg };
    }),

  getCumulativeFlow: protectedProcedure
    .input(z.object({ sprintId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const sprint = await ctx.prisma.sprint.findUniqueOrThrow({
        where: { id: input.sprintId },
        include: { tasks: { include: { task: { select: { status: true, completedAt: true, createdAt: true } } } } },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, sprint.projectId);

      const snapshots = await ctx.prisma.sprintSnapshot.findMany({
        where: { sprintId: input.sprintId },
        orderBy: { date: "asc" },
      });

      const statuses = ["backlog", "todo", "in_progress", "in_review", "done", "cancelled"];
      const snapshotMap = new Map(snapshots.map(s => [s.date.toISOString().split("T")[0], s]));

      const start = new Date(sprint.startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(sprint.endDate);
      end.setUTCHours(0, 0, 0, 0);
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);

      const days: { date: string; counts: Record<string, number> }[] = [];

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0]!;
        if (d > now) continue;

        const snap = snapshotMap.get(dateStr);
        if (snap && snap.statusBreakdown) {
          days.push({ date: dateStr, counts: snap.statusBreakdown as Record<string, number> });
        } else {
          // Simple approximation: tasks completed by this date are "done", rest are current status
          const counts: Record<string, number> = {};
          for (const status of statuses) counts[status] = 0;
          for (const st of sprint.tasks) {
            if (st.task.completedAt && new Date(st.task.completedAt) <= new Date(d.getTime() + 86400000 - 1)) {
              counts["done"] = (counts["done"] || 0) + 1;
            } else {
              counts[st.task.status] = (counts[st.task.status] || 0) + 1;
            }
          }
          days.push({ date: dateStr, counts });
        }
      }

      return { days, statuses };
    }),
});
