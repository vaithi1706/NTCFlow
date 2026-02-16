import { TRPCError } from "@trpc/server";
import { prisma } from "../lib/prisma.js";
import { redis } from "../utils/redis.js";
import { PLAN_LIMITS, type PlanType, type FeatureKey, type LimitKey } from "../config/plan-limits.js";

const CACHE_TTL = 300; // 5 minutes

export interface SubscriptionInfo {
  plan: PlanType;
  status: string;
  isTrialing: boolean;
  trialDaysLeft: number | null;
  trialExpired: boolean;
}

/**
 * Get subscription for a workspace, with Redis caching and trial expiry check.
 */
export async function getWorkspaceSubscription(workspaceId: string): Promise<SubscriptionInfo> {
  const cacheKey = `sub:${workspaceId}`;

  // Try cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const info = JSON.parse(cached) as SubscriptionInfo;
      return info;
    }
  } catch {}

  // Fetch from DB
  let sub = await prisma.subscription.findUnique({ where: { workspaceId } });

  // Auto-create free subscription if missing
  if (!sub) {
    sub = await prisma.subscription.create({
      data: { workspaceId, plan: "free", status: "active" },
    });
  }

  // Check trial expiry
  let trialExpired = false;
  if (sub.status === "trialing" && sub.trialEndDate) {
    if (new Date() > sub.trialEndDate) {
      // Auto-downgrade
      sub = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          plan: "free",
          status: "active",
          billingCycle: null,
          amount: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      });
      trialExpired = true;
    }
  }

  // Check cancelation at period end
  if (sub.status === "active" && sub.cancelAtPeriodEnd && sub.currentPeriodEnd) {
    if (new Date() > sub.currentPeriodEnd) {
      sub = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          plan: "free",
          status: "active",
          billingCycle: null,
          amount: null,
          cancelAtPeriodEnd: false,
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
      });
    }
  }

  const isTrialing = sub.status === "trialing";
  let trialDaysLeft: number | null = null;
  if (isTrialing && sub.trialEndDate) {
    trialDaysLeft = Math.max(0, Math.ceil((sub.trialEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  const plan = (sub.plan === "pro" ? "pro" : "free") as PlanType;

  const info: SubscriptionInfo = {
    plan,
    status: sub.status,
    isTrialing,
    trialDaysLeft,
    trialExpired,
  };

  // Cache
  try {
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(info));
  } catch {}

  return info;
}

/**
 * Invalidate cached subscription for a workspace.
 */
export async function invalidateSubscriptionCache(workspaceId: string) {
  try {
    await redis.del(`sub:${workspaceId}`);
  } catch {}
}

/**
 * Require a feature to be available on the workspace's plan.
 */
export async function requireFeature(workspaceId: string, feature: FeatureKey): Promise<void> {
  const sub = await getWorkspaceSubscription(workspaceId);
  const limits = PLAN_LIMITS[sub.plan];
  if (!limits.features[feature]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This feature requires a Pro plan. Please upgrade to access ${feature}.`,
      cause: { type: "PLAN_LIMIT_REACHED", feature, currentPlan: sub.plan },
    });
  }
}

/**
 * Check a numeric limit (projects, members, tasks).
 */
export async function checkLimit(
  workspaceId: string,
  limitKey: LimitKey,
  currentCount: number
): Promise<void> {
  const sub = await getWorkspaceSubscription(workspaceId);
  const limits = PLAN_LIMITS[sub.plan];
  const max = limits[limitKey] as number;

  if (max !== Infinity && currentCount >= max) {
    const friendlyNames: Record<LimitKey, string> = {
      maxProjects: "projects",
      maxMembers: "members",
      maxTasks: "tasks",
      maxFileSize: "file size",
    };
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You've reached the limit of ${max} ${friendlyNames[limitKey]} on the Free plan. Upgrade to Pro for unlimited ${friendlyNames[limitKey]}.`,
      cause: { type: "PLAN_LIMIT_REACHED", limitKey, currentCount, max, currentPlan: sub.plan },
    });
  }
}

/**
 * Check file size against plan limit.
 */
export async function checkFileSize(workspaceId: string, fileSize: number): Promise<void> {
  const sub = await getWorkspaceSubscription(workspaceId);
  const limits = PLAN_LIMITS[sub.plan];
  if (fileSize > limits.maxFileSize) {
    const maxMB = limits.maxFileSize / (1024 * 1024);
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `File size exceeds the ${maxMB}MB limit on your current plan. Upgrade to Pro for up to 50MB uploads.`,
      cause: { type: "PLAN_LIMIT_REACHED", limitKey: "maxFileSize", currentPlan: sub.plan },
    });
  }
}
