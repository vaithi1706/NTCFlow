import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";

export const searchRouter = router({
  global: protectedProcedure
    .input(z.object({
      query: z.string().min(1).max(200),
      workspaceId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.userId;

      // Determine accessible project IDs
      let projectIds: string[];

      if (input.workspaceId) {
        const wsMember = await ctx.prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: input.workspaceId, userId } },
        });
        if (wsMember && (wsMember.role === "owner" || wsMember.role === "admin")) {
          // Owner/Admin see all workspace projects
          const allProjects = await ctx.prisma.project.findMany({
            where: { workspaceId: input.workspaceId, deletedAt: null },
            select: { id: true },
          });
          projectIds = allProjects.map(p => p.id);
        } else {
          // Regular member: direct membership + team-based access + owned
          const [directMemberships, teamProjects, ownedProjects] = await Promise.all([
            ctx.prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
            ctx.prisma.projectTeam.findMany({ where: { team: { members: { some: { userId } } } }, select: { projectId: true } }),
            ctx.prisma.project.findMany({ where: { ownerId: userId, workspaceId: input.workspaceId, deletedAt: null }, select: { id: true } }),
          ]);
          projectIds = [...new Set([
            ...directMemberships.map(m => m.projectId),
            ...teamProjects.map(t => t.projectId),
            ...ownedProjects.map(p => p.id),
          ])];
        }
      } else {
        const [directMemberships, teamProjects] = await Promise.all([
          ctx.prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } }),
          ctx.prisma.projectTeam.findMany({ where: { team: { members: { some: { userId } } } }, select: { projectId: true } }),
        ]);
        projectIds = [...new Set([...directMemberships.map(m => m.projectId), ...teamProjects.map(t => t.projectId)])];
      }

      const [tasks, projects, comments] = await Promise.all([
        ctx.prisma.task.findMany({
          where: { projectId: { in: projectIds }, deletedAt: null, title: { contains: input.query, mode: "insensitive" } },
          select: { id: true, title: true, taskNumber: true, status: true, priority: true, projectId: true, project: { select: { name: true, taskPrefix: true } } },
          take: input.limit,
          orderBy: { updatedAt: "desc" },
        }),
        ctx.prisma.project.findMany({
          where: { id: { in: projectIds }, deletedAt: null, name: { contains: input.query, mode: "insensitive" } },
          select: { id: true, name: true, description: true, color: true, icon: true },
          take: input.limit,
        }),
        ctx.prisma.comment.findMany({
          where: { task: { projectId: { in: projectIds } }, deletedAt: null, content: { contains: input.query, mode: "insensitive" } },
          select: { id: true, content: true, taskId: true, task: { select: { title: true, taskNumber: true, project: { select: { taskPrefix: true } } } }, createdAt: true },
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { tasks, projects, comments };
    }),
});
