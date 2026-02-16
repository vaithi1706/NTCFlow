import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const checklistRouter = router({
  create: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), title: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.prisma.checklist.aggregate({ where: { taskId: input.taskId }, _max: { position: true } });
      return ctx.prisma.checklist.create({
        data: { taskId: input.taskId, title: input.title, position: (maxPos._max.position ?? -1) + 1 },
        include: { items: true },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.checklist.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addItem: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid(), content: z.string().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.prisma.checklistItem.aggregate({ where: { checklistId: input.checklistId }, _max: { position: true } });
      return ctx.prisma.checklistItem.create({
        data: { checklistId: input.checklistId, content: input.content, position: (maxPos._max.position ?? -1) + 1 },
      });
    }),

  updateItem: protectedProcedure
    .input(z.object({ id: z.string().uuid(), content: z.string().min(1).max(500).optional(), isChecked: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.checklistItem.update({ where: { id }, data });
    }),

  deleteItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.checklistItem.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggleItem: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.checklistItem.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.prisma.checklistItem.update({ where: { id: input.id }, data: { isChecked: !item.isChecked } });
    }),

  reorderItems: protectedProcedure
    .input(z.object({ checklistId: z.string().uuid(), itemIds: z.array(z.string().uuid()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.itemIds.map((id, i) => ctx.prisma.checklistItem.update({ where: { id }, data: { position: i } }))
      );
      return { success: true };
    }),
});
