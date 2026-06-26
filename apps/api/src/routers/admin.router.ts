import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, middleware } from "../trpc.js";
import { invalidateSubscriptionCache } from "../middleware/subscription.js";
import crypto from "node:crypto";

const ADMIN_EMAIL = "llokesh65@gmail.com";

const isAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.user || ctx.user.email !== ADMIN_EMAIL) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

const adminProcedure = protectedProcedure.use(isAdmin);

export const adminRouter = router({
  dashboard: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalWorkspaces,
      totalProjects,
      totalTasks,
      proSubscriptions,
      freeSubscriptions,
      signupsThisWeek,
      signupsThisMonth,
      totalLicenseKeys,
      usedLicenseKeys,
      activeLicenseKeys,
      recentSignups,
    ] = await Promise.all([
      ctx.prisma.user.count({ where: { deletedAt: null } }),
      ctx.prisma.workspace.count({ where: { deletedAt: null } }),
      ctx.prisma.project.count({ where: { deletedAt: null } }),
      ctx.prisma.task.count({ where: { deletedAt: null } }),
      ctx.prisma.subscription.count({ where: { plan: "pro", status: "active" } }),
      ctx.prisma.subscription.count({ where: { plan: "free" } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: weekAgo }, deletedAt: null } }),
      ctx.prisma.user.count({ where: { createdAt: { gte: monthAgo }, deletedAt: null } }),
      ctx.prisma.licenseKey.count(),
      ctx.prisma.licenseKey.count({ where: { usedCount: { gt: 0 } } }),
      ctx.prisma.licenseKey.count({ where: { isActive: true } }),
      ctx.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, name: true, email: true, createdAt: true, lastLoginAt: true },
      }),
    ]);

    return {
      totalUsers,
      totalWorkspaces,
      totalProjects,
      totalTasks,
      proSubscriptions,
      freeSubscriptions,
      signupsThisWeek,
      signupsThisMonth,
      totalLicenseKeys,
      usedLicenseKeys,
      activeLicenseKeys,
      recentSignups,
    };
  }),

  listWorkspaces: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { deletedAt: null };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { slug: { contains: input.search, mode: "insensitive" } },
          { owner: { email: { contains: input.search, mode: "insensitive" } } },
          { owner: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }

      const [workspaces, total] = await Promise.all([
        ctx.prisma.workspace.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            owner: { select: { id: true, name: true, email: true } },
            _count: { select: { members: true, projects: true } },
            subscription: { select: { plan: true, status: true } },
          },
        }),
        ctx.prisma.workspace.count({ where }),
      ]);

      // Get task counts per workspace
      const wsIds = workspaces.map((w) => w.id);
      const taskCounts = await ctx.prisma.task.groupBy({
        by: ["projectId"],
        where: { deletedAt: null, project: { workspaceId: { in: wsIds }, deletedAt: null } },
        _count: true,
      });

      // Map project to workspace
      const projects = await ctx.prisma.project.findMany({
        where: { workspaceId: { in: wsIds }, deletedAt: null },
        select: { id: true, workspaceId: true },
      });
      const projToWs = new Map(projects.map((p) => [p.id, p.workspaceId]));
      const wsTaskCount = new Map<string, number>();
      for (const tc of taskCounts) {
        const wsId = projToWs.get(tc.projectId);
        if (wsId) wsTaskCount.set(wsId, (wsTaskCount.get(wsId) || 0) + tc._count);
      }

      return {
        workspaces: workspaces.map((w) => ({
          ...w,
          taskCount: wsTaskCount.get(w.id) || 0,
        })),
        total,
        pages: Math.ceil(total / input.limit),
      };
    }),

  listUsers: adminProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { deletedAt: null };
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { email: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const [users, total] = await Promise.all([
        ctx.prisma.user.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            lastLoginAt: true,
            workspaceMembers: {
              select: {
                workspace: { select: { id: true, name: true, slug: true } },
                role: true,
              },
            },
          },
        }),
        ctx.prisma.user.count({ where }),
      ]);

      return { users, total, pages: Math.ceil(total / input.limit) };
    }),

  listLicenseKeys: adminProcedure
    .input(
      z.object({
        filter: z.enum(["all", "active", "used", "expired"]).default("all"),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      const now = new Date();
      if (input.filter === "active") {
        where.isActive = true;
        where.usedCount = 0;
      } else if (input.filter === "used") {
        where.usedCount = { gt: 0 };
      } else if (input.filter === "expired") {
        where.OR = [
          { isActive: false },
          { expiresAt: { lt: now } },
        ];
      }

      const keys = await ctx.prisma.licenseKey.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      // Enrich with user emails
      const userIds = keys.map((k) => k.usedBy).filter(Boolean) as string[];
      const users = userIds.length
        ? await ctx.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, email: true, name: true },
          })
        : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      const wsIds = keys.map((k) => k.workspaceId).filter(Boolean) as string[];
      const workspaces = wsIds.length
        ? await ctx.prisma.workspace.findMany({
            where: { id: { in: wsIds } },
            select: { id: true, name: true, slug: true },
          })
        : [];
      const wsMap = new Map(workspaces.map((w) => [w.id, w]));

      return keys.map((k) => ({
        ...k,
        usedByUser: k.usedBy ? userMap.get(k.usedBy) || null : null,
        workspace: k.workspaceId ? wsMap.get(k.workspaceId) || null : null,
      }));
    }),

  generateLicenseKey: adminProcedure
    .input(
      z.object({
        plan: z.string().default("pro"),
        durationDays: z.number().int().min(1).default(365),
        maxUses: z.number().int().min(1).default(1),
        note: z.string().optional(),
        expiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const hex1 = crypto.randomBytes(4).toString("hex").toUpperCase();
      const hex2 = crypto.randomBytes(4).toString("hex").toUpperCase();
      const key = `DK-${hex1}-${hex2}`;

      const licenseKey = await ctx.prisma.licenseKey.create({
        data: {
          key,
          plan: input.plan,
          durationDays: input.durationDays,
          maxUses: input.maxUses,
          note: input.note || null,
          expiresAt: input.expiresAt || null,
        },
      });

      return licenseKey;
    }),

  revokeLicenseKey: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const key = await ctx.prisma.licenseKey.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      if (key.workspaceId) {
        await ctx.prisma.subscription.updateMany({
          where: { workspaceId: key.workspaceId },
          data: { plan: "free", status: "active" },
        });
        await invalidateSubscriptionCache(key.workspaceId);
      }

      return { success: true };
    }),

  revokeSubscription: adminProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.subscription.updateMany({
        where: { workspaceId: input.workspaceId },
        data: { plan: "free", status: "active" },
      });
      await invalidateSubscriptionCache(input.workspaceId);
      return { success: true };
    }),

  getWorkspaceDetail: adminProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workspace = await ctx.prisma.workspace.findUnique({
        where: { id: input.workspaceId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          subscription: true,
          members: {
            include: {
              user: { select: { id: true, name: true, email: true, avatarUrl: true, lastLoginAt: true } },
            },
            orderBy: { joinedAt: "asc" },
          },
          projects: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              // Project model has no `identifier`; closest equivalent is the
              // URL slug. `taskPrefix` (the e.g. "DK" used in DK-123) is also
              // available if the consumer wants that instead.
              slug: true,
              createdAt: true,
              _count: { select: { tasks: true } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!workspace) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Workspace not found" });
      }

      // Recent activity
      const recentActivity = await ctx.prisma.activity.findMany({
        where: {
          project: { workspaceId: input.workspaceId },
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      });

      return { ...workspace, recentActivity };
    }),

  toggleUserBlock: adminProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, email: true, deletedAt: true },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      // For now, just return info — blocking can be implemented later with a blockedAt field
      return { user, message: "User block/unblock not yet implemented. Schema migration needed." };
    }),
});
