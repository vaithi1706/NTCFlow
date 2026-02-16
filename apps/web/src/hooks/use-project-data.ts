"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/api/trpc";
import type { BoardColumn, TaskWithRelations, Label, User, Project } from "@dkflow/shared";

function transformTask(t: any, colId?: string): TaskWithRelations {
  return {
    id: t.id,
    taskNumber: t.taskNumber,
    title: t.title,
    description: t.description,
    priority: t.priority as any,
    position: t.position,
    columnId: t.columnId || colId || "",
    projectId: t.projectId,
    parentTaskId: t.parentId || null,
    dueDate: t.dueDate ? (typeof t.dueDate === "string" ? t.dueDate : t.dueDate.toISOString()) : null,
    startDate: t.startDate ? (typeof t.startDate === "string" ? t.startDate : t.startDate.toISOString()) : null,
    estimateMinutes: t.estimateHours ? t.estimateHours * 60 : null,
    timeSpentMinutes: 0,
    storyPoints: t.storyPoints ?? null,
    isRecurring: false,
    type: t.type || "task",
    isArchived: false,
    completedAt: t.completedAt ? (typeof t.completedAt === "string" ? t.completedAt : t.completedAt.toISOString()) : null,
    createdById: t.createdById,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : t.createdAt.toISOString(),
    updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : t.updatedAt.toISOString(),
    assignees: (t.assignees || []).filter((a: any) => a.user).map((a: any) => ({
      id: a.user.id,
      name: a.user.name || "Unknown",
      email: "",
      avatarUrl: a.user.avatarUrl,
      timezone: "",
      theme: "dark" as const,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
    })),
    labels: (t.labels || []).filter((l: any) => l.label).map((l: any) => ({
      id: l.label.id,
      name: l.label.name || "Untitled",
      color: l.label.color || "#888",
      projectId: l.label.projectId,
    })),
    checklistProgress: null,
    subtaskCount: t._count?.subtasks ?? 0,
    commentCount: t._count?.comments ?? 0,
    attachmentCount: t._count?.attachments ?? 0,
  };
}

export function useProjectData(projectId: string) {
  const { data: project } = trpc.project.getById.useQuery(
    { id: projectId },
    { enabled: !!projectId }
  );

  const { data: columnsData, isLoading: columnsLoading } = trpc.board.getColumns.useQuery(
    { projectId },
    { enabled: !!projectId }
  );

  const columns = useMemo<BoardColumn[]>(() => {
    if (!columnsData) return [];
    return columnsData.map((col: any) => ({
      id: col.id,
      name: col.name,
      color: col.color,
      position: col.position,
      wipLimit: col.wipLimit,
      isDoneColumn: col.isDone ?? false,
      projectId: col.projectId,
    }));
  }, [columnsData]);

  const tasks = useMemo<TaskWithRelations[]>(() => {
    if (!columnsData) return [];
    return columnsData.flatMap((col: any) =>
      col.tasks.map((t: any) => transformTask(t, col.id))
    );
  }, [columnsData]);

  const labels = useMemo<Label[]>(() => {
    if (!project?.labels) return [];
    return project.labels.map((l: any) => ({
      id: l.id,
      name: l.name,
      color: l.color,
      projectId: l.projectId,
    }));
  }, [project]);

  const transformedProject = useMemo(() => {
    if (!project) return null;
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      color: project.color,
      icon: project.icon,
      taskIdPrefix: (project as any).taskPrefix || "DK",
      taskCount: project._count?.tasks ?? 0,
      defaultView: ((project as any).defaultView as any) || "board",
      workspaceId: project.workspaceId || "",
      isArchived: project.isArchived,
      createdAt: typeof project.createdAt === "string" ? project.createdAt : project.createdAt.toISOString(),
      updatedAt: typeof project.updatedAt === "string" ? project.updatedAt : project.updatedAt.toISOString(),
    } satisfies Project;
  }, [project]);

  return {
    project: transformedProject,
    columns,
    tasks,
    labels,
    isLoading: columnsLoading,
  };
}
