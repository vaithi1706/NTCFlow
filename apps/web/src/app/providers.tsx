"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TRPCProvider } from "@/lib/api/trpc-provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="dkflow-theme" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        <TRPCProvider>
          {children}
          <Toaster richColors position="top-right" />
        </TRPCProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
