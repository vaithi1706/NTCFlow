"use client";

import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { trpc, getTRPCLinks } from "./trpc";
import { useAuthStore } from "@/stores/auth-store";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        mutationCache: new MutationCache({
          onError: (error: any) => {
            if (error?.data?.code === "FORBIDDEN" && error?.message) {
              const msg = error.message as string;
              if (msg.includes("plan") || msg.includes("Plan") || msg.includes("Upgrade") || msg.includes("limit") || msg.includes("feature requires")) {
                toast.error(msg, {
                  action: {
                    label: "Upgrade",
                    onClick: () => window.location.href = "/settings/billing",
                  },
                  duration: 8000,
                });
              }
            }
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            refetchOnWindowFocus: true, // Refetch when user comes back to tab
            refetchOnReconnect: true,   // Refetch on network reconnect
            retry: (failureCount, error: any) => {
              // Don't retry on auth errors (refresh will handle it)
              if (error?.data?.code === "UNAUTHORIZED") return false;
              if (error?.data?.code === "FORBIDDEN") return false;
              return failureCount < 2;
            },
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({ links: getTRPCLinks() })
  );

  // Refetch all queries when window regains focus (handles stale data after sleep/background)
  useEffect(() => {
    const handleFocus = () => {
      // Check if token is still valid
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const exp = payload.exp * 1000;
        if (exp < Date.now()) {
          // Token expired while tab was in background — trigger refresh
          queryClient.invalidateQueries();
        }
      } catch {
        // Invalid token
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [queryClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
