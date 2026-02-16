import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requireWorkspaceMembership, requireProjectAccess } from "../middleware/permissions.js";

export const taskTemplateRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.taskTemplate.findMany({
        where: { workspaceId: input.workspaceId },
        include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(200),
      description: z.string().optional(),
      defaultTitle: z.string().max(500).optional(),
      defaultDescription: z.string().optional(),
      defaultPriority: z.string().optional(),
      defaultType: z.string().optional(),
      defaultStoryPoints: z.number().int().optional(),
      defaultLabels: z.any().default([]),
      checklistTemplate: z.any().default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.taskTemplate.create({
        data: {
          ...input,
          createdById: ctx.user.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      defaultTitle: z.string().max(500).optional(),
      defaultDescription: z.string().optional(),
      defaultPriority: z.string().optional(),
      defaultType: z.string().optional(),
      defaultStoryPoints: z.number().int().nullable().optional(),
      defaultLabels: z.any().optional(),
      checklistTemplate: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.taskTemplate.findUnique({ where: { id: input.id } });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, template.workspaceId);
      const { id, ...data } = input;
      return ctx.prisma.taskTemplate.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.taskTemplate.findUnique({ where: { id: input.id } });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });
      await requireWorkspaceMembership(ctx.prisma, ctx.user.userId, template.workspaceId);
      return ctx.prisma.taskTemplate.delete({ where: { id: input.id } });
    }),

  createTaskFromTemplate: protectedProcedure
    .input(z.object({
      templateId: z.string().uuid(),
      projectId: z.string().uuid(),
      title: z.string().optional(),
      columnId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.prisma.taskTemplate.findUnique({ where: { id: input.templateId } });
      if (!template) throw new TRPCError({ code: "NOT_FOUND" });

      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const project = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { taskCounter: { increment: 1 } },
      });

      let columnId = input.columnId;
      if (!columnId) {
        const firstCol = await ctx.prisma.boardColumn.findFirst({
          where: { projectId: input.projectId },
          orderBy: { position: "asc" },
        });
        columnId = firstCol?.id;
      }

      const task = await ctx.prisma.task.create({
        data: {
          projectId: input.projectId,
          title: input.title || template.defaultTitle || template.name,
          description: template.defaultDescription,
          taskNumber: project.taskCounter,
          type: (template.defaultType as any) || "task",
          priority: (template.defaultPriority as any) || "none",
          status: "todo",
          storyPoints: template.defaultStoryPoints,
          columnId: columnId || null,
          createdById: ctx.user.userId,
        },
      });

      // Create checklist items if template has them
      const checklistItems = template.checklistTemplate as any[];
      if (checklistItems && checklistItems.length > 0) {
        const checklist = await ctx.prisma.checklist.create({
          data: {
            taskId: task.id,
            title: "Checklist",
            position: 0,
          },
        });
        await ctx.prisma.checklistItem.createMany({
          data: checklistItems.map((item: any, i: number) => ({
            checklistId: checklist.id,
            title: typeof item === "string" ? item : item.title || item.text || "Item",
            position: i,
            isCompleted: false,
          })),
        });
      }

      return task;
    }),
});
