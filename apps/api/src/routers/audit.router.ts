import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireOwnerOrAdmin } from "../middleware/permissions.js";

export const auditRouter = router({
  list: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      action: z.string().optional(),
      userId: z.string().uuid().optional(),
      entityType: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, input.workspaceId);

      const where: any = { workspaceId: input.workspaceId };
      if (input.action) where.action = { contains: input.action, mode: "insensitive" };
      if (input.userId) where.userId = input.userId;
      if (input.entityType) where.entityType = input.entityType;
      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) where.createdAt.gte = new Date(input.startDate);
        if (input.endDate) where.createdAt.lte = new Date(input.endDate);
      }

      const logs = await ctx.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, avatarUrl: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = logs.length > input.limit;
      if (hasMore) logs.pop();

      return {
        logs,
        nextCursor: hasMore ? logs[logs.length - 1]?.id : null,
      };
    }),

  getByEntity: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      entityType: z.string(),
      entityId: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOwnerOrAdmin(ctx.prisma, ctx.user.userId, input.workspaceId);
      return ctx.prisma.auditLog.findMany({
        where: { workspaceId: input.workspaceId, entityType: input.entityType, entityId: input.entityId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),
});
