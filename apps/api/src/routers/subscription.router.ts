import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { PLAN_LIMITS, PRICING } from "../config/plan-limits.js";
import { getWorkspaceSubscription, invalidateSubscriptionCache } from "../middleware/subscription.js";
import { logAudit } from "../utils/audit.js";

export const subscriptionRouter = router({
  getCurrent: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify membership
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN", message: "Not a workspace member" });

      const sub = await ctx.prisma.subscription.findUnique({ where: { workspaceId: input.workspaceId } });
      const info = await getWorkspaceSubscription(input.workspaceId);

      // Get usage counts
      const [projectCount, memberCount, taskCount] = await Promise.all([
        ctx.prisma.project.count({ where: { workspaceId: input.workspaceId, deletedAt: null } }),
        ctx.prisma.workspaceMember.count({ where: { workspaceId: input.workspaceId } }),
        ctx.prisma.task.count({
          where: { project: { workspaceId: input.workspaceId }, deletedAt: null },
        }),
      ]);

      const limits = PLAN_LIMITS[info.plan];

      return {
        ...info,
        billingCycle: sub?.billingCycle || null,
        currentPeriodEnd: sub?.currentPeriodEnd || null,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd || false,
        amount: sub?.amount || null,
        usage: {
          projects: projectCount,
          members: memberCount,
          tasks: taskCount,
        },
        limits: {
          maxProjects: limits.maxProjects === Infinity ? null : limits.maxProjects,
          maxMembers: limits.maxMembers === Infinity ? null : limits.maxMembers,
          maxTasks: limits.maxTasks === Infinity ? null : limits.maxTasks,
          maxFileSize: limits.maxFileSize,
          features: limits.features,
        },
      };
    }),

  startTrial: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Only owner can manage subscription
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member || member.role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN", message: "Only workspace owner can manage subscription" });

      const sub = await ctx.prisma.subscription.findUnique({ where: { workspaceId: input.workspaceId } });

      // Check if trial was already used
      if (sub?.trialStartDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Free trial has already been used for this workspace" });
      }

      if (sub?.plan === "pro" && sub.status === "active") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Workspace already on Pro plan" });
      }

      const now = new Date();
      const trialEnd = new Date(now.getTime() + PRICING.pro.trialDays * 24 * 60 * 60 * 1000);

      const updated = await ctx.prisma.subscription.upsert({
        where: { workspaceId: input.workspaceId },
        create: {
          workspaceId: input.workspaceId,
          plan: "pro",
          status: "trialing",
          trialStartDate: now,
          trialEndDate: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        },
        update: {
          plan: "pro",
          status: "trialing",
          trialStartDate: now,
          trialEndDate: trialEnd,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
        },
      });

      await invalidateSubscriptionCache(input.workspaceId);

      await logAudit(ctx.prisma, {
        workspaceId: input.workspaceId,
        userId: ctx.user.userId,
        action: "subscription.trial_started",
        entityType: "subscription",
        entityId: updated.id,
        metadata: { trialEndDate: trialEnd.toISOString() },
      });

      return { success: true, trialEndDate: trialEnd };
    }),

  redeemKey: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      licenseKey: z.string().min(1).max(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member || member.role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN", message: "Only workspace owner can activate a license key" });

      const key = await ctx.prisma.licenseKey.findUnique({ where: { key: input.licenseKey.trim().toUpperCase() } });
      if (!key) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid license key" });
      if (!key.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "This license key has been deactivated" });
      if (key.usedCount >= key.maxUses) throw new TRPCError({ code: "BAD_REQUEST", message: "This license key has already been used" });
      if (key.expiresAt && new Date() > key.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This license key has expired" });

      const now = new Date();
      const periodEnd = new Date(now.getTime() + key.durationDays * 24 * 60 * 60 * 1000);
      const amount = key.billingCycle === "yearly" ? PRICING.pro.yearly : PRICING.pro.monthly;

      // Mark key as used
      await ctx.prisma.licenseKey.update({
        where: { id: key.id },
        data: { usedCount: { increment: 1 }, usedBy: ctx.user.userId, usedAt: now, workspaceId: input.workspaceId },
      });

      // Activate subscription
      const updated = await ctx.prisma.subscription.upsert({
        where: { workspaceId: input.workspaceId },
        create: {
          workspaceId: input.workspaceId,
          plan: key.plan,
          status: "active",
          billingCycle: key.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          amount,
          paymentMethod: "license_key",
          paymentId: key.key,
          cancelAtPeriodEnd: false,
        },
        update: {
          plan: key.plan,
          status: "active",
          billingCycle: key.billingCycle,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          amount,
          paymentMethod: "license_key",
          paymentId: key.key,
          cancelAtPeriodEnd: false,
        },
      });

      await invalidateSubscriptionCache(input.workspaceId);

      await logAudit(ctx.prisma, {
        workspaceId: input.workspaceId,
        userId: ctx.user.userId,
        action: "subscription.key_redeemed",
        entityType: "subscription",
        entityId: updated.id,
        metadata: { licenseKey: key.key, durationDays: key.durationDays, plan: key.plan },
      });

      return { success: true, plan: key.plan, periodEnd, durationDays: key.durationDays };
    }),

  cancel: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member || member.role !== "owner")
        throw new TRPCError({ code: "FORBIDDEN", message: "Only workspace owner can manage subscription" });

      const sub = await ctx.prisma.subscription.findUnique({ where: { workspaceId: input.workspaceId } });
      if (!sub || sub.plan === "free")
        throw new TRPCError({ code: "BAD_REQUEST", message: "No active subscription to cancel" });

      await ctx.prisma.subscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true },
      });

      await invalidateSubscriptionCache(input.workspaceId);

      await logAudit(ctx.prisma, {
        workspaceId: input.workspaceId,
        userId: ctx.user.userId,
        action: "subscription.canceled",
        entityType: "subscription",
        entityId: sub.id,
        metadata: { cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd?.toISOString() },
      });

      return { success: true, cancelAtPeriodEnd: true, currentPeriodEnd: sub.currentPeriodEnd };
    }),

  getUsage: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member) throw new TRPCError({ code: "FORBIDDEN" });

      const info = await getWorkspaceSubscription(input.workspaceId);
      const limits = PLAN_LIMITS[info.plan];

      const [projectCount, memberCount, taskCount] = await Promise.all([
        ctx.prisma.project.count({ where: { workspaceId: input.workspaceId, deletedAt: null } }),
        ctx.prisma.workspaceMember.count({ where: { workspaceId: input.workspaceId } }),
        ctx.prisma.task.count({ where: { project: { workspaceId: input.workspaceId }, deletedAt: null } }),
      ]);

      return {
        plan: info.plan,
        projects: { current: projectCount, max: limits.maxProjects === Infinity ? null : limits.maxProjects },
        members: { current: memberCount, max: limits.maxMembers === Infinity ? null : limits.maxMembers },
        tasks: { current: taskCount, max: limits.maxTasks === Infinity ? null : limits.maxTasks },
        maxFileSize: limits.maxFileSize,
      };
    }),

  getPricing: protectedProcedure.query(async () => {
    return {
      free: {
        price: 0,
        features: Object.entries(PLAN_LIMITS.free.features).map(([k, v]) => ({ key: k, enabled: v })),
        limits: { maxProjects: PLAN_LIMITS.free.maxProjects, maxMembers: PLAN_LIMITS.free.maxMembers, maxTasks: PLAN_LIMITS.free.maxTasks, maxFileSize: PLAN_LIMITS.free.maxFileSize },
      },
      pro: {
        monthlyPrice: PRICING.pro.monthly,
        yearlyPrice: PRICING.pro.yearly,
        trialDays: PRICING.pro.trialDays,
        features: Object.entries(PLAN_LIMITS.pro.features).map(([k, v]) => ({ key: k, enabled: v })),
        limits: { maxProjects: null, maxMembers: null, maxTasks: null, maxFileSize: PLAN_LIMITS.pro.maxFileSize },
      },
    };
  }),
});
