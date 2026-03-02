import { PrismaClient } from "@prisma/client";

type AutomationEvent = "task_created" | "task_moved_to_column" | "due_date_reached" | "label_added";

interface TaskContext {
  taskId: string;
  projectId: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  assigneeIds: string[];
  labelIds: string[];
  columnId?: string;
}

/**
 * Run automation rules for a given event on a task.
 * Called after task creation, status change, etc.
 */
export async function runAutomations(
  prisma: PrismaClient,
  event: AutomationEvent,
  task: TaskContext,
  triggeredBy: string,
): Promise<void> {
  try {
    const rules = await prisma.automationRule.findMany({
      where: {
        projectId: task.projectId,
        isEnabled: true,
      },
    });

    for (const rule of rules) {
      const trigger = rule.trigger as any;
      if (trigger?.event !== event) continue;

      // Check conditions
      if (trigger.conditions) {
        const cond = trigger.conditions;
        // Type filter: if condition specifies a task type, check it
        if (cond.taskType && cond.taskType !== task.type) continue;
        // Status filter
        if (cond.status && cond.status !== task.status) continue;
        // Column filter
        if (cond.columnId && cond.columnId !== task.columnId) continue;
      }

      // Execute actions
      const actions = rule.actions as any[];
      for (const action of actions) {
        try {
          await executeAction(prisma, action, task, triggeredBy);
        } catch (e) {
          console.error(`Automation action failed (rule: ${rule.id}):`, e);
        }
      }

      // Update run stats
      await prisma.automationRule.update({
        where: { id: rule.id },
        data: { lastRunAt: new Date(), runCount: { increment: 1 } },
      }).catch(() => {});
    }
  } catch (e) {
    console.error("Automation engine error:", e);
  }
}

async function executeAction(
  prisma: PrismaClient,
  action: { type: string; params?: any },
  task: TaskContext,
  triggeredBy: string,
): Promise<void> {
  switch (action.type) {
    case "change_assignee": {
      // Find user by name or use userId from params
      let userId = action.params?.userId;
      if (!userId && action.params?.userName) {
        const user = await prisma.user.findFirst({
          where: { name: { contains: action.params.userName, mode: "insensitive" } },
          select: { id: true },
        });
        userId = user?.id;
      }
      if (!userId && action.params?.description) {
        // Try to extract name from description like "Auto-assign to Lokesh"
        const match = action.params.description.match(/assign\s+to\s+(\w+)/i);
        if (match) {
          const user = await prisma.user.findFirst({
            where: { name: { contains: match[1], mode: "insensitive" } },
            select: { id: true },
          });
          userId = user?.id;
        }
      }
      if (userId) {
        // Check if already assigned
        const existing = await prisma.taskAssignee.findUnique({
          where: { taskId_userId: { taskId: task.taskId, userId } },
        });
        if (!existing) {
          await prisma.taskAssignee.create({
            data: { taskId: task.taskId, userId },
          });
          // Also add as project member if not already
          const project = await prisma.project.findUnique({ where: { id: task.projectId }, select: { workspaceId: true } });
          if (project) {
            await prisma.projectMember.upsert({
              where: { projectId_userId: { projectId: task.projectId, userId } },
              update: {},
              create: { projectId: task.projectId, userId, role: "member" },
            }).catch(() => {});
          }
        }
      }
      break;
    }

    case "change_priority": {
      let priority = action.params?.priority;
      if (!priority && action.params?.description) {
        const match = action.params.description.match(/priority\s+to\s+(\w+)/i);
        if (match) priority = match[1].toLowerCase();
      }
      if (priority && ["urgent", "high", "medium", "low", "none"].includes(priority)) {
        await prisma.task.update({
          where: { id: task.taskId },
          data: { priority: priority as any },
        });
      }
      break;
    }

    case "add_label": {
      const labelName = action.params?.labelName;
      if (labelName) {
        const label = await prisma.label.findFirst({
          where: { projectId: task.projectId, name: { equals: labelName, mode: "insensitive" } },
          select: { id: true },
        });
        if (label) {
          await prisma.taskLabel.create({
            data: { taskId: task.taskId, labelId: label.id },
          }).catch(() => {}); // ignore if already exists
        }
      }
      break;
    }

    case "move_to_column": {
      const targetStatus = action.params?.status;
      const columnName = action.params?.columnName;
      if (targetStatus) {
        await prisma.task.update({
          where: { id: task.taskId },
          data: { status: targetStatus as any },
        });
      } else if (columnName) {
        const column = await prisma.boardColumn.findFirst({
          where: { projectId: task.projectId, name: { contains: columnName, mode: "insensitive" } },
          select: { id: true },
        });
        if (column) {
          await prisma.task.update({
            where: { id: task.taskId },
            data: { columnId: column.id },
          });
        }
      }
      break;
    }

    case "send_notification": {
      // Create a notification for the task creator
      await prisma.notification.create({
        data: {
          userId: triggeredBy,
          type: "task_updated",
          title: `Automation: ${action.params?.message || action.params?.description || "Rule executed"}`,
          message: `Automation ran on task "${task.title}"`,
          linkUrl: `/tasks/${task.taskId}`,
        },
      }).catch(() => {});
      break;
    }
  }
}
