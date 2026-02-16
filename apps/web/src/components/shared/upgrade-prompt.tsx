"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface UpgradePromptProps {
  message?: string;
  compact?: boolean;
}

/**
 * Displays an upgrade prompt when a plan limit is reached.
 * Use with `isPlanLimitError()` to detect FORBIDDEN errors from the API.
 */
export function UpgradePrompt({ message, compact }: UpgradePromptProps) {
  const router = useRouter();

  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <Crown className="h-4 w-4 shrink-0" />
        <span>{message || "Upgrade to Pro to unlock this feature."}</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          onClick={() => router.push("/settings/billing")}
        >
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950">
      <Crown className="h-10 w-10 text-amber-500" />
      <div>
        <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
          Plan Limit Reached
        </h3>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          {message || "Upgrade to Pro to unlock this feature and remove limits."}
        </p>
      </div>
      <Button onClick={() => router.push("/settings/billing")}>
        <Crown className="mr-2 h-4 w-4" />
        Upgrade to Pro
      </Button>
    </div>
  );
}

/**
 * Check if a tRPC error is a plan limit error.
 */
export function isPlanLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as any;
  // tRPC errors have data.code
  if (err.data?.code === "FORBIDDEN") {
    const msg = err.message || "";
    return (
      msg.includes("plan") ||
      msg.includes("Plan") ||
      msg.includes("limit") ||
      msg.includes("Upgrade") ||
      msg.includes("feature requires")
    );
  }
  // Also check cause
  if (err.cause?.type === "PLAN_LIMIT_REACHED") return true;
  return false;
}
