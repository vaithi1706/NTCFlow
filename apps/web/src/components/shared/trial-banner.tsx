"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { useRouter } from "next/navigation";
import { X, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function TrialBanner() {
  const { isTrialing, trialDaysLeft, plan } = useSubscription();
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();

  if (!isTrialing || dismissed) return null;

  const isUrgent = (trialDaysLeft ?? 0) <= 3;

  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2 text-sm",
        isUrgent
          ? "bg-gradient-to-r from-red-900/80 to-red-800/80 text-red-100"
          : "bg-gradient-to-r from-amber-900/80 to-yellow-800/80 text-amber-100"
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4" />
        <span>
          {trialDaysLeft === 0
            ? "Your Pro trial ends today!"
            : `You have ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left in your Pro trial`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => router.push("/pricing")}
          className={cn(
            "h-7 text-xs font-medium",
            isUrgent
              ? "bg-red-500/20 hover:bg-red-500/30 text-white"
              : "bg-amber-500/20 hover:bg-amber-500/30 text-white"
          )}
        >
          <Sparkles className="w-3 h-3 mr-1" />
          Upgrade Now
        </Button>
        <button onClick={() => setDismissed(true)} className="text-current opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
