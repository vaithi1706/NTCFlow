
import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess } from "../middleware/permissions.js";

export const activityRouter = router({
  getTaskActivity: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const activities = await ctx.prisma.taskActivity.findMany({
        where: { taskId: input.taskId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = activities.length > input.limit;
      if (hasMore) activities.pop();
      return { activities, nextCursor: hasMore ? activities[activities.length - 1]?.id : null };
    }),

  getProjectActivity: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const activities = await ctx.prisma.activity.findMany({
        where: { projectId: input.projectId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = activities.length > input.limit;
      if (hasMore) activities.pop();
      return { activities, nextCursor: hasMore ? activities[activities.length - 1]?.id : null };
    }),

  getWorkspaceActivity: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;
      const wsMember = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
      });
      let projectIds: string[];
      if (wsMember && (wsMember.role === "owner" || wsMember.role === "admin")) {
        const projects = await ctx.prisma.project.findMany({ where: { workspaceId: input.workspaceId, deletedAt: null }, select: { id: true } });
        projectIds = projects.map(p => p.id);
      } else {
        const [direct, teamBased, owned] = await Promise.all([
          ctx.prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
          ctx.prisma.projectTeam.findMany({ where: { team: { members: { some: { userId } } } }, select: { projectId: true } }),
          ctx.prisma.project.findMany({ where: { ownerId: userId, workspaceId: input.workspaceId, deletedAt: null }, select: { id: true } }),
        ]);
        projectIds = [...new Set([...direct.map(m => m.projectId), ...teamBased.map(t => t.projectId), ...owned.map(p => p.id)])];
      }

      const activities = await ctx.prisma.activity.findMany({
        where: { projectId: { in: projectIds } },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = activities.length > input.limit;
      if (hasMore) activities.pop();
      return { activities, nextCursor: hasMore ? activities[activities.length - 1]?.id : null };
    }),
});
