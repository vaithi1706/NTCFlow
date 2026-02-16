"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { useUIStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { KeyboardShortcutsDialog } from "@/components/shared/keyboard-shortcuts-dialog";
import { OnboardingTour, HelpButton } from "@/components/shared/onboarding-tour";
import { TrialBanner } from "@/components/shared/trial-banner";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { isAuthenticated, hydrateFromStorage } = useAuthStore();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useKeyboardShortcuts({
    onShowHelp: useCallback(() => setShortcutsOpen(true), []),
  });

  useEffect(() => {
    const hydrated = hydrateFromStorage();
    if (!hydrated) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [hydrateFromStorage, router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "b" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileMenuOpen(false)} />
          <div className="relative z-10 h-full w-[280px]">
            <Sidebar />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden">
        <TrialBanner />
        {/* Mobile topbar with hamburger */}
        <div className="md:hidden flex items-center h-12 px-4 border-b border-border bg-background flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <span className="ml-2 font-bold text-lg">DKFlow</span>
        </div>
        {children}
      </main>
      <CommandPalette />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <OnboardingTour />
      <HelpButton />
    </div>
  );
}
