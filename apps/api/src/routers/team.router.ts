import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";

export const teamRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.team.findMany({
        where: { workspaceId: input.workspaceId },
        include: {
          lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
          _count: { select: { members: true, projects: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.findUnique({
        where: { id: input.id },
        include: {
          lead: { select: { id: true, name: true, email: true, avatarUrl: true } },
          members: {
            include: {
              user: {
                select: {
                  id: true, name: true, email: true, avatarUrl: true,
                  workspaceMembers: {
                    select: { roleId: true, customRole: { select: { id: true, name: true, color: true } } },
                    take: 1,
                  },
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
          projects: {
            include: { project: { select: { id: true, name: true, color: true, taskPrefix: true } } },
          },
          _count: { select: { members: true, projects: true } },
        },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND", message: "Team not found" });
      return team;
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      color: z.string().max(7).optional(),
      leadId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const team = await ctx.prisma.team.create({
        data: {
          name: input.name,
          description: input.description,
          color: input.color,
          leadId: input.leadId,
          workspaceId: input.workspaceId,
        },
      });
      // Auto-add lead as member
      if (input.leadId) {
        await ctx.prisma.teamMember.create({
          data: { teamId: team.id, userId: input.leadId, role: "lead" },
        }).catch(() => {}); // ignore if already exists
      }
      return team;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      color: z.string().max(7).optional().nullable(),
      leadId: z.string().uuid().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.team.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.team.delete({ where: { id: input.id } });
      return { success: true };
    }),

  addMember: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["lead", "member"]).default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.teamMember.create({
        data: { teamId: input.teamId, userId: input.userId, role: input.role },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.teamMember.delete({
        where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
      });
      return { success: true };
    }),

  updateMemberRole: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.enum(["lead", "member"]),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.teamMember.update({
        where: { teamId_userId: { teamId: input.teamId, userId: input.userId } },
        data: { role: input.role },
      });
    }),

  assignProject: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.projectTeam.create({
        data: { teamId: input.teamId, projectId: input.projectId },
      });
    }),

  unassignProject: protectedProcedure
    .input(z.object({ teamId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.projectTeam.delete({
        where: { projectId_teamId: { projectId: input.projectId, teamId: input.teamId } },
      });
      return { success: true };
    }),

  getWorkload: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.teamMember.findMany({
        where: { teamId: input.teamId },
        include: {
          user: {
            select: {
              id: true, name: true, email: true, avatarUrl: true,
              workspaceMembers: {
                select: { customRole: { select: { id: true, name: true, color: true } } },
                take: 1,
              },
            },
          },
        },
      });

      const now = new Date();
      const workload = await Promise.all(
        members.map(async (m) => {
          const tasks = await ctx.prisma.task.findMany({
            where: { assigneeId: m.userId, deletedAt: null },
            select: { status: true, dueDate: true },
          });
          const total = tasks.length;
          const completed = tasks.filter((t) => t.status === "done").length;
          const inProgress = tasks.filter((t) => t.status === "in_progress" || t.status === "in_review").length;
          const overdue = tasks.filter((t) => t.dueDate && t.dueDate < now && t.status !== "done" && t.status !== "cancelled").length;
          const todo = tasks.filter((t) => t.status === "todo" || t.status === "backlog").length;
          return { user: m.user, role: m.role, total, completed, inProgress, overdue, todo };
        })
      );
      return workload;
    }),

  getActivity: protectedProcedure
    .input(z.object({
      teamId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      userId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.teamMember.findMany({
        where: { teamId: input.teamId },
        select: { userId: true },
      });
      const memberIds = input.userId ? [input.userId] : members.map((m) => m.userId);
      const teamProjects = await ctx.prisma.projectTeam.findMany({
        where: { teamId: input.teamId },
        select: { projectId: true },
      });
      const projectIds = teamProjects.map((p) => p.projectId);
      if (projectIds.length === 0) return [];
      const activities = await ctx.prisma.activity.findMany({
        where: {
          projectId: { in: projectIds },
          userId: { in: memberIds },
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
      return activities;
    }),

  getStats: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.teamMember.findMany({
        where: { teamId: input.teamId },
        select: { userId: true },
      });
      const memberIds = members.map((m) => m.userId);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [activeTasks, completedThisWeek, overdueTasks, allCompletedTasks] = await Promise.all([
        ctx.prisma.task.count({
          where: { assigneeId: { in: memberIds }, status: { in: ["todo", "in_progress", "in_review"] }, deletedAt: null },
        }),
        ctx.prisma.task.count({
          where: { assigneeId: { in: memberIds }, status: "done", completedAt: { gte: weekAgo }, deletedAt: null },
        }),
        ctx.prisma.task.count({
          where: { assigneeId: { in: memberIds }, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] }, deletedAt: null },
        }),
        ctx.prisma.task.findMany({
          where: { assigneeId: { in: memberIds }, status: "done", completedAt: { not: null }, deletedAt: null },
          select: { createdAt: true, completedAt: true },
          take: 200,
          orderBy: { completedAt: "desc" },
        }),
      ]);

      let avgCompletionDays = 0;
      if (allCompletedTasks.length > 0) {
        const totalDays = allCompletedTasks.reduce((sum, t) => {
          return sum + (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgCompletionDays = Math.round((totalDays / allCompletedTasks.length) * 10) / 10;
      }

      return { totalMembers: memberIds.length, activeTasks, completedThisWeek, overdue: overdueTasks, avgCompletionDays };
    }),

  getPerformance: protectedProcedure
    .input(z.object({ teamId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.teamMember.findMany({
        where: { teamId: input.teamId },
        include: {
          user: {
            select: {
              id: true, name: true, avatarUrl: true,
              workspaceMembers: {
                select: { customRole: { select: { id: true, name: true, color: true } } },
                take: 1,
              },
            },
          },
        },
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const performance = await Promise.all(
        members.map(async (m) => {
          const allTasks = await ctx.prisma.task.findMany({
            where: { assigneeId: m.userId, deletedAt: null },
            select: { status: true, createdAt: true, completedAt: true },
          });
          const recentCompleted = allTasks.filter(
            (t) => t.status === "done" && t.completedAt && t.completedAt > thirtyDaysAgo
          );
          const total = allTasks.length;
          const completed = allTasks.filter((t) => t.status === "done").length;
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
          // Avg duration in days for completed tasks
          let avgDurationDays = 0;
          if (recentCompleted.length > 0) {
            const totalDays = recentCompleted.reduce((sum, t) => {
              const dur = (t.completedAt!.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24);
              return sum + dur;
            }, 0);
            avgDurationDays = Math.round((totalDays / recentCompleted.length) * 10) / 10;
          }
          return {
            user: m.user,
            role: m.role,
            velocity: recentCompleted.length, // tasks completed in last 30 days
            completionRate,
            avgDurationDays,
            totalTasks: total,
            completedTasks: completed,
          };
        })
      );
      return performance;
    }),
});
