import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const notificationRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().int().max(100).default(50), cursor: z.string().uuid().optional(), unreadOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      const where: any = { userId: ctx.user.userId };
      if (input.unreadOnly) where.isRead = false;
      const notifs = await ctx.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = notifs.length > input.limit;
      if (hasMore) notifs.pop();
      return { notifications: notifs, nextCursor: hasMore ? notifs[notifs.length - 1]?.id : null };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.update({ where: { id: input.id }, data: { isRead: true, readAt: new Date() } });
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.prisma.notification.updateMany({ where: { userId: ctx.user.userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    return { success: true };
  }),

  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const count = await ctx.prisma.notification.count({ where: { userId: ctx.user.userId, isRead: false } });
    return { count };
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.notification.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.user.userId }, select: { notificationPreferences: true } });
    return user.notificationPreferences || {
      task_assigned: true, task_commented: true, task_mentioned: true,
      task_due_soon: true, task_overdue: true, task_status_changed: true,
      sprint_started: true, sprint_completed: true,
    };
  }),

  updatePreferences: protectedProcedure
    .input(z.object({ preferences: z.record(z.boolean()) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({ where: { id: ctx.user.userId }, data: { notificationPreferences: input.preferences } });
      return { success: true };
    }),
});
