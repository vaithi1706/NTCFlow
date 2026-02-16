import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject, requireProjectAccess } from "../middleware/permissions.js";

export const boardRouter = router({
  getColumns: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.boardColumn.findMany({
        where: { projectId: input.projectId },
        include: {
          tasks: {
            where: { deletedAt: null },
            orderBy: { position: "asc" },
            include: {
              assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
              labels: { include: { label: true } },
              _count: { select: { comments: true, attachments: true, checklists: true, subtasks: true } },
            },
          },
        },
        orderBy: { position: "asc" },
      });
    }),

  createColumn: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(50),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageBoard");
      const maxPos = await ctx.prisma.boardColumn.aggregate({
        where: { projectId: input.projectId },
        _max: { position: true },
      });
      return ctx.prisma.boardColumn.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          color: input.color,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }),

  updateColumn: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(50).optional(),
      color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      wipLimit: z.number().int().min(0).optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const col = await ctx.prisma.boardColumn.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, col.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageBoard");
      const { id, ...data } = input;
      return ctx.prisma.boardColumn.update({ where: { id }, data });
    }),

  deleteColumn: protectedProcedure
    .input(z.object({ id: z.string().uuid(), moveToColumnId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      const col = await ctx.prisma.boardColumn.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, col.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageBoard");
      if (input.moveToColumnId) {
        await ctx.prisma.task.updateMany({
          where: { columnId: input.id },
          data: { columnId: input.moveToColumnId },
        });
      }
      await ctx.prisma.boardColumn.delete({ where: { id: input.id } });
      return { success: true };
    }),

  reorderColumns: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      columnIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.$transaction(
        input.columnIds.map((id, i) =>
          ctx.prisma.boardColumn.update({ where: { id }, data: { position: i } })
        )
      );
      return { success: true };
    }),
});
