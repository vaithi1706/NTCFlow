
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess, getWorkspaceIdFromProject } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";

export const customFieldRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.customFieldDefinition.findMany({
        where: { projectId: input.projectId },
        orderBy: { position: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      fieldType: z.enum(["text", "number", "date", "dropdown", "checkbox", "url"]),
      options: z.any().optional(),
      isRequired: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "customFields");
      const maxPos = await ctx.prisma.customFieldDefinition.aggregate({
        where: { projectId: input.projectId },
        _max: { position: true },
      });
      return ctx.prisma.customFieldDefinition.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          fieldType: input.fieldType,
          options: input.options ?? undefined,
          isRequired: input.isRequired,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      options: z.any().optional(),
      isRequired: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.customFieldDefinition.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.customFieldDefinition.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getValues: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.customFieldValue.findMany({
        where: { taskId: input.taskId },
        include: { field: true },
      });
    }),

  setValue: protectedProcedure
    .input(z.object({
      fieldId: z.string().uuid(),
      taskId: z.string().uuid(),
      value: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.customFieldValue.upsert({
        where: { fieldId_taskId: { fieldId: input.fieldId, taskId: input.taskId } },
        create: { fieldId: input.fieldId, taskId: input.taskId, value: input.value },
        update: { value: input.value },
      });
    }),
});
