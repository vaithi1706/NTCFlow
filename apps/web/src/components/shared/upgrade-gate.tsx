"use client";

import { useSubscription, type FeatureKey } from "@/hooks/use-subscription";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  ai: "AI Features",
  customFields: "Custom Fields",
  automations: "Automations",
  integrations: "Integrations (Slack/Teams)",
  apiKeys: "API Keys",
  webhooks: "Webhooks",
  timeTracking: "Time Tracking",
  portfolio: "Portfolio View",
  advancedDashboard: "Advanced Dashboard",
  ganttView: "Gantt View",
  publicForms: "Public Forms",
};

interface UpgradeGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
  className?: string;
}

export function UpgradeGate({ feature, children, className }: UpgradeGateProps) {
  const { canUse, isLoading } = useSubscription();
  const router = useRouter();

  if (isLoading) return <>{children}</>;

  if (canUse(feature)) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className || ""}`}>
      <div className="pointer-events-none select-none blur-[2px] opacity-50">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="bg-muted/95 border border-zinc-700 rounded-xl p-6 max-w-sm text-center shadow-2xl">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {FEATURE_LABELS[feature] || feature}
          </h3>
          <p className="text-sm text-zinc-400 mb-4">
            This feature is available on the Pro plan. Upgrade to unlock it.
          </p>
          <Button
            onClick={() => router.push("/pricing")}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Upgrade to Pro
          </Button>
        </div>
      </div>
    </div>
  );
}
