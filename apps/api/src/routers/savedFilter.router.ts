import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const savedFilterRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { userId: ctx.user.userId };
      if (input.projectId) where.projectId = input.projectId;
      return ctx.prisma.savedFilter.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid().optional(),
      name: z.string().min(1).max(100),
      filters: z.record(z.any()),
      isShared: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.savedFilter.create({
        data: { projectId: input.projectId, userId: ctx.user.userId, name: input.name, filters: input.filters, isShared: input.isShared },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.savedFilter.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
