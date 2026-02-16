"use client";

import { useEffect, useCallback, useState } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_COMPLETED_KEY = "dkflow-tour-completed";

const tourSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: "Sidebar Navigation",
      description: "Navigate between projects, teams, and settings",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="create-project"]',
    popover: {
      title: "Create Project",
      description: "Start by creating your first project",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="board-view"]',
    popover: {
      title: "Board View",
      description: "Your Kanban board — drag tasks between columns",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="create-task"]',
    popover: {
      title: "Create Task",
      description: "Click + to create new tasks in any column",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="view-switcher"]',
    popover: {
      title: "View Switcher",
      description: "Switch between Board, List, Table, Calendar, Timeline views",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="filter-bar"]',
    popover: {
      title: "Filter Bar",
      description: "Filter tasks by priority, assignee, labels, and more",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="command-palette"]',
    popover: {
      title: "Command Palette",
      description: "Press Cmd+K to quickly search and navigate",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="notifications"]',
    popover: {
      title: "Notifications",
      description: "Stay updated with real-time notifications",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="profile-settings"]',
    popover: {
      title: "Profile & Settings",
      description: "Customize your workspace and profile",
      side: "top",
      align: "start",
    },
  },
];

export function startOnboardingTour() {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    overlayColor: "rgba(0, 0, 0, 0.7)",
    stagePadding: 8,
    stageRadius: 8,
    popoverClass: "dkflow-tour-popover",
    steps: tourSteps,
    nextBtnText: "Next →",
    prevBtnText: "← Back",
    doneBtnText: "Done ✓",
    onDestroyed: () => {
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    },
  });
  driverObj.drive();
}

export function resetOnboardingTour() {
  localStorage.removeItem(TOUR_COMPLETED_KEY);
}

export function isTourCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
}

export function OnboardingTour() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isTourCompleted()) return;

    // Delay to let the UI render
    const timer = setTimeout(() => {
      startOnboardingTour();
    }, 1000);

    return () => clearTimeout(timer);
  }, [mounted]);

  return null;
}

export function HelpButton() {
  const handleClick = useCallback(() => {
    startOnboardingTour();
  }, []);

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-4 right-4 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors flex items-center justify-center text-lg font-bold"
      title="Start product tour"
    >
      ?
    </button>
  );
}
