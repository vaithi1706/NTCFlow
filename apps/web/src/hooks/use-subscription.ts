"use client";

import { trpc } from "@/lib/api/trpc";
import { useAuthStore } from "@/stores/auth-store";
import { useMemo } from "react";

export type FeatureKey =
  | "ai" | "customFields" | "automations" | "integrations"
  | "apiKeys" | "webhooks" | "timeTracking" | "portfolio"
  | "advancedDashboard" | "ganttView" | "publicForms";

export function useSubscription() {
  const { workspaceId } = useAuthStore();

  const { data, isLoading, refetch } = trpc.subscription.getCurrent.useQuery(
    { workspaceId: workspaceId || "" },
    { enabled: !!workspaceId, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false }
  );

  const result = useMemo(() => {
    if (!data) {
      return {
        plan: "free" as const,
        isTrialing: false,
        trialDaysLeft: null as number | null,
        trialExpired: false,
        billingCycle: null as string | null,
        currentPeriodEnd: null as Date | null,
        cancelAtPeriodEnd: false,
        usage: { projects: 0, members: 0, tasks: 0 },
        limits: {
          maxProjects: 1,
          maxMembers: 3,
          maxTasks: 100,
          maxFileSize: 5 * 1024 * 1024,
          features: {} as Record<string, boolean>,
        },
        canUse: (_feature: FeatureKey) => false,
        isAtLimit: (_type: "projects" | "members" | "tasks") => false,
        isPro: false,
        isLoading: true,
        refetch,
      };
    }

    const canUse = (feature: FeatureKey): boolean => {
      return data.limits.features[feature] ?? false;
    };

    const isAtLimit = (type: "projects" | "members" | "tasks"): boolean => {
      const max = data.limits[type === "projects" ? "maxProjects" : type === "members" ? "maxMembers" : "maxTasks"];
      if (max === null) return false; // unlimited
      return data.usage[type] >= max;
    };

    return {
      plan: data.plan,
      isTrialing: data.isTrialing,
      trialDaysLeft: data.trialDaysLeft,
      trialExpired: data.trialExpired,
      billingCycle: data.billingCycle,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      usage: data.usage,
      limits: data.limits,
      canUse,
      isAtLimit,
      isPro: data.plan === "pro",
      isLoading: false,
      refetch,
    };
  }, [data, isLoading, refetch]);

  return { ...result, isLoading };
}
