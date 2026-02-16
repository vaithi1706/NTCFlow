"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-7xl">⚠️</div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Something went wrong</h1>
          <p className="text-muted-foreground">
            An unexpected error occurred. Please try again or contact support if the problem persists.
          </p>
        </div>
        <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded text-left whitespace-pre-wrap max-h-32 overflow-auto">
          {error.message || "Unknown error"}
          {error.digest && `\nDigest: ${error.digest}`}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <button
            onClick={() => {
              const subject = encodeURIComponent(`DKFlow Error: ${error.digest || "Unknown"}`);
              const body = encodeURIComponent(`Error: ${error.message}\nDigest: ${error.digest || "N/A"}`);
              window.open(`mailto:support@dkflow.app?subject=${subject}&body=${body}`);
            }}
            className="px-6 py-3 rounded-lg border border-border text-foreground font-medium hover:bg-muted transition-colors"
          >
            Report Error
          </button>
        </div>
        <div className="flex items-center gap-2 justify-center pt-4">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-bold text-[10px]">DK</div>
          <span className="text-sm text-muted-foreground">DKFlow</span>
        </div>
      </div>
    </div>
  );
}
