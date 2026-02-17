import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";

const priorityEnum = z.enum(["urgent", "high", "medium", "low", "none"]);

export const slaRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.slaPolicy.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(100),
      priority: priorityEnum,
      responseTimeHours: z.number().positive(),
      resolutionTimeHours: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.slaPolicy.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      responseTimeHours: z.number().positive().optional(),
      resolutionTimeHours: z.number().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.slaPolicy.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.slaPolicy.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getTaskSlaStatus: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: {
          id: true, priority: true, createdAt: true, completedAt: true,
          slaBreachedAt: true, slaRespondedAt: true,
          project: { select: { workspaceId: true } },
        },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const policy = await ctx.prisma.slaPolicy.findUnique({
        where: { workspaceId_priority: { workspaceId: task.project.workspaceId, priority: task.priority } },
      });
      if (!policy) return { status: "no_policy" as const, task };

      const now = new Date();
      const createdAt = new Date(task.createdAt);
      const responseDeadline = new Date(createdAt.getTime() + policy.responseTimeHours * 3600000);
      const resolutionDeadline = new Date(createdAt.getTime() + policy.resolutionTimeHours * 3600000);

      const endTime = task.completedAt ? new Date(task.completedAt) : now;
      const responseBreached = !task.slaRespondedAt && now > responseDeadline;
      const resolutionBreached = !task.completedAt && now > resolutionDeadline;

      const responseRemaining = Math.max(0, responseDeadline.getTime() - now.getTime());
      const resolutionRemaining = Math.max(0, resolutionDeadline.getTime() - now.getTime());

      let status: "met" | "at_risk" | "breached" = "met";
      if (responseBreached || resolutionBreached || task.slaBreachedAt) {
        status = "breached";
      } else if (resolutionRemaining < policy.resolutionTimeHours * 3600000 * 0.25) {
        status = "at_risk";
      }

      return {
        status,
        policy,
        responseDeadline,
        resolutionDeadline,
        responseRemaining,
        resolutionRemaining,
        responseBreached,
        resolutionBreached,
      };
    }),

  getDashboard: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const policies = await ctx.prisma.slaPolicy.findMany({ where: { workspaceId: input.workspaceId } });
      if (policies.length === 0) return { total: 0, met: 0, breached: 0, atRisk: 0, compliancePercent: 100 };

      const priorityMap = new Map(policies.map(p => [p.priority, p]));

      // Get recent tasks (last 30 days) from workspace projects
      const projects = await ctx.prisma.project.findMany({
        where: { workspaceId: input.workspaceId, deletedAt: null },
        select: { id: true },
      });
      const projectIds = projects.map(p => p.id);

      const tasks = await ctx.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          deletedAt: null,
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: { id: true, priority: true, createdAt: true, completedAt: true, slaBreachedAt: true, slaRespondedAt: true },
      });

      let met = 0, breached = 0, atRisk = 0;
      const now = new Date();

      for (const task of tasks) {
        const policy = priorityMap.get(task.priority);
        if (!policy) continue;

        const resolutionDeadline = new Date(new Date(task.createdAt).getTime() + policy.resolutionTimeHours * 3600000);
        if (task.slaBreachedAt || (!task.completedAt && now > resolutionDeadline)) {
          breached++;
        } else if (!task.completedAt && resolutionDeadline.getTime() - now.getTime() < policy.resolutionTimeHours * 3600000 * 0.25) {
          atRisk++;
        } else {
          met++;
        }
      }

      const total = met + breached + atRisk;
      return {
        total,
        met,
        breached,
        atRisk,
        compliancePercent: total > 0 ? Math.round((met / total) * 100) : 100,
      };
    }),
});
