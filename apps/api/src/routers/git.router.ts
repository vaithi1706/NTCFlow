import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";

export const gitRouter = router({
  listIntegrations: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gitIntegration.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, provider: true, repoUrl: true, repoName: true,
          isActive: true, createdAt: true, projectId: true,
          _count: { select: { commits: true } },
        },
      });
    }),

  addIntegration: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      provider: z.enum(["github", "gitlab", "bitbucket"]),
      repoUrl: z.string().url(),
      repoName: z.string().min(1),
      accessToken: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const crypto = await import("node:crypto");
      return ctx.prisma.gitIntegration.create({
        data: {
          ...input,
          webhookSecret: crypto.randomBytes(32).toString("hex"),
        },
      });
    }),

  removeIntegration: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.gitIntegration.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getCommitsForTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gitCommit.findMany({
        where: { taskId: input.taskId },
        orderBy: { committedAt: "desc" },
        include: { integration: { select: { provider: true, repoName: true } } },
      });
    }),

  getRecentCommits: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), limit: z.number().int().max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.gitCommit.findMany({
        where: { integration: { projectId: input.projectId } },
        orderBy: { committedAt: "desc" },
        take: input.limit,
        include: {
          integration: { select: { provider: true, repoName: true } },
          task: { select: { id: true, title: true, taskNumber: true } },
        },
      });
    }),

  linkCommitToTask: protectedProcedure
    .input(z.object({ commitId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.gitCommit.update({
        where: { id: input.commitId },
        data: { taskId: input.taskId },
      });
    }),
});
