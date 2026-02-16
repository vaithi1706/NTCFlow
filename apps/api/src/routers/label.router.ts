import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject , requireProjectAccess } from "../middleware/permissions.js";

export const labelRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.label.findMany({ where: { projectId: input.projectId }, orderBy: { name: "asc" } });
    }),

  create: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), name: z.string().min(1).max(50), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageLabels");
      return ctx.prisma.label.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(50).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional() }))
    .mutation(async ({ ctx, input }) => {
      const label = await ctx.prisma.label.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, label.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageLabels");
      const { id, ...data } = input;
      return ctx.prisma.label.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const label = await ctx.prisma.label.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, label.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageLabels");
      await ctx.prisma.label.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
