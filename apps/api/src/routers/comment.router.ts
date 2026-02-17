import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { notifyIntegrations } from "../services/integrations.js";
import { notifyMentioned } from "../services/emailNotifier.js";

export const commentRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), limit: z.number().int().max(100).default(50), cursor: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      const comments = await ctx.prisma.comment.findMany({
        where: { taskId: input.taskId, deletedAt: null, parentId: null },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          replies: {
            where: { deletedAt: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              reactions: true,
            },
            orderBy: { createdAt: "asc" },
          },
          reactions: true,
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = comments.length > input.limit;
      if (hasMore) comments.pop();
      return { comments, nextCursor: hasMore ? comments[comments.length - 1]?.id : null };
    }),

  create: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      content: z.string().min(1).max(10000),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, content: input.content, parentId: input.parentId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      });

      // Extract @mentions (format: @[userId] or @username)
      const mentionedUserIds: string[] = [];

      // Format 1: @[uuid]
      const uuidMentionRegex = /@\[([0-9a-f-]{36})\]/g;
      let match;
      while ((match = uuidMentionRegex.exec(input.content)) !== null) {
        mentionedUserIds.push(match[1]!);
      }

      // Format 2: @username (lookup by name)
      const usernameMentionRegex = /@(\w+)/g;
      while ((match = usernameMentionRegex.exec(input.content)) !== null) {
        const username = match[1]!;
        // Skip if it looks like a UUID reference we already handled
        if (username.length === 36 && username.includes("-")) continue;
        const user = await ctx.prisma.user.findFirst({
          where: { name: { equals: username, mode: "insensitive" }, deletedAt: null },
          select: { id: true },
        });
        if (user && !mentionedUserIds.includes(user.id)) {
          mentionedUserIds.push(user.id);
        }
      }

      // Create mentions and notifications
      for (const mentionedUserId of mentionedUserIds) {
        await ctx.prisma.commentMention.create({ data: { commentId: comment.id, userId: mentionedUserId } }).catch(() => {});
        if (mentionedUserId !== ctx.user.userId) {
          await ctx.prisma.notification.create({
            data: {
              userId: mentionedUserId, type: "task_mentioned",
              title: "You were mentioned in a comment",
              message: input.content.slice(0, 200),
            },
          }).catch(() => {});
        }
      }

      // Email mentioned users
      const taskForEmail = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, taskNumber: true, project: { select: { taskPrefix: true } } } });
      for (const mentionedUserId of mentionedUserIds) {
        if (mentionedUserId !== ctx.user.userId && taskForEmail) {
          notifyMentioned(mentionedUserId, comment.user.name, taskForEmail.title, `${taskForEmail.project.taskPrefix}-${taskForEmail.taskNumber}`, input.content).catch(() => {});
        }
      }

      // Notify watchers
      const watchers = await ctx.prisma.taskWatcher.findMany({ where: { taskId: input.taskId, userId: { not: ctx.user.userId } } });
      for (const w of watchers) {
        await ctx.prisma.notification.create({
          data: { userId: w.userId, type: "task_commented", title: "New comment on a task you watch", message: input.content.slice(0, 200) },
        });
      }

      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "commented" },
      });

      // Also log in project-level Activity feed
      const taskForActivity = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { projectId: true, taskNumber: true } });
      if (taskForActivity) {
        await ctx.prisma.activity.create({
          data: {
            projectId: taskForActivity.projectId,
            userId: ctx.user.userId,
            entityType: "comment",
            entityId: comment.id,
            action: "commented",
            description: `Commented on task #${taskForActivity.taskNumber}`,
            metadata: { taskId: input.taskId },
          },
        }).catch(() => {});
      }

      // Notify integrations
      if (taskForActivity) {
        const project = await ctx.prisma.project.findUnique({ where: { id: taskForActivity.projectId }, select: { workspaceId: true } });
        if (project) {
          notifyIntegrations(ctx.prisma, project.workspaceId, "comment.created", {
            title: `New comment on task #${taskForActivity.taskNumber}`,
            description: input.content.slice(0, 300),
            fields: [{ label: "By", value: comment.user.name }],
          }).catch(() => {});
        }
      }

      return { ...comment, mentionedUserIds };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), content: z.string().min(1).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUniqueOrThrow({ where: { id: input.id } });
      if (comment.userId !== ctx.user.userId) throw new TRPCError({ code: "FORBIDDEN" });
      return ctx.prisma.comment.update({ where: { id: input.id }, data: { content: input.content, isEdited: true } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const comment = await ctx.prisma.comment.findUniqueOrThrow({ where: { id: input.id } });
      if (comment.userId !== ctx.user.userId) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.prisma.comment.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return { success: true };
    }),

  addReaction: protectedProcedure
    .input(z.object({ commentId: z.string().uuid(), emoji: z.string().max(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.commentReaction.create({
        data: { commentId: input.commentId, userId: ctx.user.userId, emoji: input.emoji },
      });
      return { success: true };
    }),

  getMentionSuggestions: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.projectMember.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, avatarUrl: true, email: true } } },
      });
      return members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        email: m.user.email,
      }));
    }),

  removeReaction: protectedProcedure
    .input(z.object({ commentId: z.string().uuid(), emoji: z.string().max(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.commentReaction.delete({
        where: { commentId_userId_emoji: { commentId: input.commentId, userId: ctx.user.userId, emoji: input.emoji } },
      });
      return { success: true };
    }),
});
