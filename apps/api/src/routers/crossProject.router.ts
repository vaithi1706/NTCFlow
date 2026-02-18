import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";

export const crossProjectRouter = router({
  // Tag a task to appear in another project
  addTag: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        projectId: z.string().uuid(), // project to tag into
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify task exists
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.taskId },
        select: { id: true, projectId: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      // Can't tag into the same project it belongs to
      if (task.projectId === input.projectId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Task already belongs to this project" });
      }

      // Verify target project exists
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId } });
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });

      // Create tag (upsert to avoid duplicates)
      return ctx.prisma.taskProjectTag.upsert({
        where: {
          taskId_projectId: { taskId: input.taskId, projectId: input.projectId },
        },
        update: {},
        create: {
          taskId: input.taskId,
          projectId: input.projectId,
          addedById: ctx.user.userId,
        },
        include: {
          project: { select: { id: true, name: true, color: true, icon: true } },
        },
      });
    }),

  // Remove a cross-project tag
  removeTag: protectedProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        projectId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskProjectTag.deleteMany({
        where: { taskId: input.taskId, projectId: input.projectId },
      });
      return { success: true };
    }),

  // List all cross-project tags for a task
  getTaskTags: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.taskProjectTag.findMany({
        where: { taskId: input.taskId },
        include: {
          project: { select: { id: true, name: true, color: true, icon: true, slug: true } },
        },
        orderBy: { createdAt: "asc" },
      });
    }),

  // List all tasks tagged into a specific project (cross-project tasks)
  getProjectTaggedTasks: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        limit: z.number().min(1).max(200).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const tags = await ctx.prisma.taskProjectTag.findMany({
        where: { projectId: input.projectId },
        include: {
          task: {
            select: {
              id: true,
              title: true,
              taskNumber: true,
              status: true,
              priority: true,
              type: true,
              dueDate: true,
              storyPoints: true,
              project: { select: { id: true, name: true, color: true } },
              assignees: {
                select: {
                  user: { select: { id: true, name: true, avatarUrl: true } },
                },
              },
            },
          },
        },
        take: input.limit,
        skip: input.offset,
        orderBy: { createdAt: "desc" },
      });

      const total = await ctx.prisma.taskProjectTag.count({
        where: { projectId: input.projectId },
      });

      return {
        tasks: tags.map((t: any) => ({
          ...t.task,
          tagId: t.id,
          sourceProject: t.task.project,
          assignees: t.task.assignees.map((a: any) => a.user),
        })),
        total,
      };
    }),
});
