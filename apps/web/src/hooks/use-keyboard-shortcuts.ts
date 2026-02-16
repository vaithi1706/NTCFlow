"use client";

import { useEffect, useCallback } from "react";
import { useUIStore } from "@/stores/ui-store";

type ShortcutHandler = () => void;

interface Shortcut {
  key: string;
  label: string;
  description: string;
  handler: ShortcutHandler;
  meta?: boolean;
  shift?: boolean;
  ignoreInputs?: boolean;
}

export const SHORTCUTS = [
  { key: "n", label: "N", description: "New task" },
  { key: "p", label: "P", description: "New project" },
  { key: "/", label: "/", description: "Focus search" },
  { key: "k", label: "⌘K", description: "Command palette", meta: true },
  { key: "?", label: "?", description: "Keyboard shortcuts", shift: true },
] as const;

function isInputElement(el: EventTarget | null): boolean {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useKeyboardShortcuts({
  onNewTask,
  onNewProject,
  onFocusSearch,
  onShowHelp,
}: {
  onNewTask?: () => void;
  onNewProject?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
}) {
  const { setCommandPaletteOpen } = useUIStore();

  const handler = useCallback(
    (e: KeyboardEvent) => {
      if (isInputElement(e.target)) return;

      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNewTask?.();
        return;
      }
      if (e.key === "p" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNewProject?.();
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onFocusSearch?.();
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        onShowHelp?.();
        return;
      }
    },
    [onNewTask, onNewProject, onFocusSearch, onShowHelp, setCommandPaletteOpen]
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}
