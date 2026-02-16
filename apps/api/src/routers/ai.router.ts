
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { generateTaskDescription, suggestTaskMetadata, summarizeProject, generateSprintPlan } from "../services/ai.js";
import { requireProjectAccess, getWorkspaceIdFromProject } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";

export const aiRouter = router({
  generateDescription: protectedProcedure
    .input(z.object({ title: z.string().min(1), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      return generateTaskDescription(input.title);
    }),

  suggestMetadata: protectedProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().default(""), projectId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.projectId) {
        const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
        await requireFeature(wsId, "ai");
      }
      return suggestTaskMetadata(input.title, input.description);
    }),

  projectSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, storyPoints: true },
      });
      return summarizeProject(tasks);
    }),

  sprintPlan: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), sprintDuration: z.number().int().min(1).max(30).default(14), teamSize: z.number().int().min(1).max(50).default(3) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId2 = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId2, "ai");
      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null, status: { in: ["backlog", "todo"] } },
        select: { id: true, title: true, status: true, priority: true, storyPoints: true },
      });
      return generateSprintPlan(tasks, input.teamSize, input.sprintDuration);
    }),
});
