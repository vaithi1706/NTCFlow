/**
 * DKFlow Intelligence Engine — Data Sync
 * 
 * Syncs existing project data into the engine's embedding store.
 * Runs as background process, processes incrementally.
 */

import { PrismaClient } from "@prisma/client";
import {
  storeEmbedding,
  isEmbedded,
  buildTaskContent,
  buildCommentContent,
  buildActivityContent,
  buildSprintContent,
} from "./embeddings.js";

// --- Sync all tasks for a workspace ---
export async function syncTasks(prisma: PrismaClient, workspaceId: string): Promise<number> {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      type: true,
      projectId: true,
      storyPoints: true,
      taskNumber: true,
      createdAt: true,
      completedAt: true,
      assignee: { select: { name: true } },
      labels: { include: { label: { select: { name: true } } } },
      project: { select: { name: true } },
    },
  });

  let synced = 0;
  for (const task of tasks) {
    const already = await isEmbedded(prisma, "task", task.id);
    if (already) continue;

    const content = buildTaskContent({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      type: task.type,
      assigneeName: task.assignee?.name,
      labels: task.labels.map((l: any) => l.label.name),
      projectName: task.project.name,
    });

    await storeEmbedding(prisma, {
      workspaceId,
      projectId: task.projectId,
      entityType: "task",
      entityId: task.id,
      content,
      metadata: {
        taskNumber: task.taskNumber,
        status: task.status,
        priority: task.priority,
        type: task.type,
        storyPoints: task.storyPoints,
        assignee: task.assignee?.name || null,
        projectName: task.project.name,
        createdAt: task.createdAt.toISOString(),
        completedAt: task.completedAt?.toISOString() || null,
      },
    });
    synced++;

    // Rate limit: small pause every 5 tasks
    if (synced % 5 === 0) await new Promise(r => setTimeout(r, 300));
  }

  return synced;
}

// --- Sync all comments for a workspace ---
export async function syncComments(prisma: PrismaClient, workspaceId: string): Promise<number> {
  const comments = await prisma.comment.findMany({
    where: {
      task: { project: { workspaceId }, deletedAt: null },
    },
    select: {
      id: true,
      content: true,
      user: { select: { name: true } },
      task: { select: { id: true, title: true, projectId: true } },
    },
  });

  let synced = 0;
  for (const comment of comments) {
    const already = await isEmbedded(prisma, "comment", comment.id);
    if (already) continue;

    const content = buildCommentContent({
      content: comment.content,
      authorName: comment.user.name,
      taskTitle: comment.task.title,
    });

    await storeEmbedding(prisma, {
      workspaceId,
      projectId: comment.task.projectId,
      entityType: "comment",
      entityId: comment.id,
      content,
      metadata: {
        author: comment.user.name,
        taskId: comment.task.id,
        taskTitle: comment.task.title,
      },
    });
    synced++;

    if (synced % 5 === 0) await new Promise(r => setTimeout(r, 300));
  }

  return synced;
}

// --- Sync task activities for a workspace ---
export async function syncActivities(prisma: PrismaClient, workspaceId: string): Promise<number> {
  const activities = await prisma.taskActivity.findMany({
    where: {
      task: { project: { workspaceId }, deletedAt: null },
    },
    select: {
      id: true,
      action: true,
      field: true,
      oldValue: true,
      newValue: true,
      user: { select: { name: true } },
      task: { select: { id: true, title: true, projectId: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500, // Limit to recent activities
  });

  let synced = 0;
  for (const activity of activities) {
    if (!activity.user) continue;
    const already = await isEmbedded(prisma, "activity", activity.id);
    if (already) continue;

    const content = buildActivityContent({
      action: activity.action,
      field: activity.field || undefined,
      oldValue: activity.oldValue || undefined,
      newValue: activity.newValue || undefined,
      userName: activity.user.name,
      taskTitle: activity.task.title,
    });

    await storeEmbedding(prisma, {
      workspaceId,
      projectId: activity.task.projectId,
      entityType: "activity",
      entityId: activity.id,
      content,
      metadata: {
        action: activity.action,
        field: activity.field,
        taskId: activity.task.id,
        userName: activity.user.name,
      },
    });
    synced++;

    if (synced % 5 === 0) await new Promise(r => setTimeout(r, 300));
  }

  return synced;
}

// --- Sync sprints for a workspace ---
export async function syncSprints(prisma: PrismaClient, workspaceId: string): Promise<number> {
  const sprints = await prisma.sprint.findMany({
    where: {
      project: { workspaceId },
    },
    select: {
      id: true,
      name: true,
      goal: true,
      projectId: true,
      project: { select: { name: true } },
      tasks: { select: { task: { select: { status: true } } } },
    },
  });

  let synced = 0;
  for (const sprint of sprints) {
    const already = await isEmbedded(prisma, "sprint", sprint.id);
    if (already) continue;

    const content = buildSprintContent({
      name: sprint.name,
      goal: sprint.goal,
      projectName: sprint.project.name,
      taskCount: sprint.tasks.length,
      completedCount: sprint.tasks.filter(st => st.task.status === "done").length,
    });

    await storeEmbedding(prisma, {
      workspaceId,
      projectId: sprint.projectId,
      entityType: "sprint",
      entityId: sprint.id,
      content,
      metadata: {
        name: sprint.name,
        projectName: sprint.project.name,
        taskCount: sprint.tasks.length,
        completedCount: sprint.tasks.filter(st => st.task.status === "done").length,
      },
    });
    synced++;

    if (synced % 5 === 0) await new Promise(r => setTimeout(r, 300));
  }

  return synced;
}

// --- Full sync for a workspace ---
export async function fullSync(prisma: PrismaClient, workspaceId: string): Promise<{
  tasks: number;
  comments: number;
  activities: number;
  sprints: number;
  total: number;
}> {
  console.log(`[Engine] Starting full sync for workspace ${workspaceId}`);

  const tasks = await syncTasks(prisma, workspaceId);
  console.log(`[Engine] Synced ${tasks} tasks`);

  const comments = await syncComments(prisma, workspaceId);
  console.log(`[Engine] Synced ${comments} comments`);

  const activities = await syncActivities(prisma, workspaceId);
  console.log(`[Engine] Synced ${activities} activities`);

  const sprints = await syncSprints(prisma, workspaceId);
  console.log(`[Engine] Synced ${sprints} sprints`);

  const total = tasks + comments + activities + sprints;

  // Update engine state
  await prisma.$executeRawUnsafe(
    `INSERT INTO engine_state (workspace_id, last_embedding_sync, total_embeddings)
     VALUES ($1::uuid, NOW(), $2)
     ON CONFLICT (workspace_id) DO UPDATE SET
       last_embedding_sync = NOW(),
       total_embeddings = engine_state.total_embeddings + $2,
       updated_at = NOW()`,
    workspaceId,
    total
  );

  console.log(`[Engine] Full sync complete: ${total} total embeddings created`);
  return { tasks, comments, activities, sprints, total };
}
