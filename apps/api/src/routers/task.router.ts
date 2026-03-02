import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { sendTaskAssignedEmail } from "../services/email.js";
import { notifyTaskAssigned } from "../services/emailNotifier.js";
import { requirePermission, checkPermission, getWorkspaceIdFromProject, requireProjectAccess } from "../middleware/permissions.js";
import { logAudit } from "../utils/audit.js";
import { notifyIntegrations } from "../services/integrations.js";
import { fireWebhooks } from "../services/webhooks.js";
import { runAutomations } from "../services/automations.js";
import { checkLimit } from "../middleware/subscription.js";

const taskTypeEnum = z.enum(["bug", "feature", "story", "task", "epic"]);

export const taskRouter = router({
  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      columnId: z.string().uuid().optional(),
      assigneeId: z.string().uuid().optional(),
      labelId: z.string().uuid().optional(),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
      status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
      dueBefore: z.string().datetime().optional(),
      dueAfter: z.string().datetime().optional(),
      search: z.string().optional(),
      sortBy: z.enum(["createdAt", "updatedAt", "priority", "dueDate", "position", "taskNumber"]).default("position"),
      excludeSubtasks: z.boolean().default(true),
      sortDir: z.enum(["asc", "desc"]).default("asc"),
      limit: z.number().int().min(1).max(500).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const where: any = { projectId: input.projectId, deletedAt: null };
      if (input.excludeSubtasks) where.parentId = null;
      if (input.columnId) where.columnId = input.columnId;
      if (input.assigneeId) where.assignees = { some: { userId: input.assigneeId } };
      if (input.labelId) where.labels = { some: { labelId: input.labelId } };
      if (input.priority) where.priority = input.priority;
      if (input.status) where.status = input.status;
      if (input.dueBefore || input.dueAfter) {
        where.dueDate = {};
        if (input.dueBefore) where.dueDate.lte = new Date(input.dueBefore);
        if (input.dueAfter) where.dueDate.gte = new Date(input.dueAfter);
      }
      if (input.search) where.title = { contains: input.search, mode: "insensitive" };

      const tasks = await ctx.prisma.task.findMany({
        where,
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
          column: { select: { id: true, name: true, isDone: true } },
          sprintTasks: { select: { sprintId: true } },
          _count: { select: { comments: true, attachments: true, subtasks: true, votes: true } },
        },
        orderBy: { [input.sortBy]: input.sortDir },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = tasks.length > input.limit;
      if (hasMore) tasks.pop();
      return { tasks, nextCursor: hasMore ? tasks[tasks.length - 1]?.id : null };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUnique({
        where: { id: input.id },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
          checklists: { include: { items: { orderBy: { position: "asc" } } }, orderBy: { position: "asc" } },
          comments: {
            where: { deletedAt: null, parentId: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              replies: {
                where: { deletedAt: null },
                include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                orderBy: { createdAt: "asc" },
              },
              reactions: true,
            },
            orderBy: { createdAt: "desc" },
          },
          attachments: true,
          taskActivities: {
            include: { user: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          },
          watchers: { include: { user: { select: { id: true, name: true } } } },
          column: { select: { id: true, name: true, color: true } },
          subtasks: { where: { deletedAt: null }, select: { id: true, title: true, status: true, taskNumber: true } },
        },
      });
      if (!task || task.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  create: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(500),
      description: z.string().max(50000).optional(),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
      columnId: z.string().uuid(),
      projectId: z.string().uuid(),
      type: taskTypeEnum.default("task"),
      assigneeIds: z.array(z.string().uuid()).optional(),
      labelIds: z.array(z.string().uuid()).optional(),
      dueDate: z.string().datetime().optional(),
      startDate: z.string().datetime().optional(),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canCreateTasks");
      // Subscription limit check
      const taskCount = await ctx.prisma.task.count({ where: { project: { workspaceId: wsId }, deletedAt: null } });
      await checkLimit(wsId, "maxTasks", taskCount);
      // Atomic increment of task counter
      const project = await ctx.prisma.project.update({
        where: { id: input.projectId },
        data: { taskCounter: { increment: 1 } },
      });

      const maxPos = await ctx.prisma.task.aggregate({
        where: { columnId: input.columnId, deletedAt: null },
        _max: { position: true },
      });

      const task = await ctx.prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority,
          type: input.type,
          columnId: input.columnId,
          projectId: input.projectId,
          taskNumber: project.taskCounter,
          status: "todo",
          position: (maxPos._max.position ?? -1) + 1,
          createdById: ctx.user.userId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          parentId: input.parentId,
          assignees: input.assigneeIds?.length
            ? { create: input.assigneeIds.map((userId) => ({ userId })) }
            : undefined,
          labels: input.labelIds?.length
            ? { create: input.labelIds.map((labelId) => ({ labelId })) }
            : undefined,
        },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
        },
      });

      // Log activity
      await ctx.prisma.taskActivity.create({
        data: { taskId: task.id, userId: ctx.user.userId, action: "created" },
      });
      await ctx.prisma.activity.create({
        data: {
          projectId: input.projectId,
          userId: ctx.user.userId,
          entityType: "task",
          entityId: task.id,
          action: "created",
          description: `created task DK-${task.taskNumber} "${task.title}"`,
        },
      }).catch(() => {});

      // Auto-watch creator
      await ctx.prisma.taskWatcher.create({
        data: { taskId: task.id, userId: ctx.user.userId },
      }).catch(() => {}); // ignore if already exists

      // Notify integrations + webhooks
      notifyIntegrations(ctx.prisma, wsId, "task.created", {
        title: `Task created: ${task.title}`,
        fields: [
          { label: "Priority", value: input.priority },
          { label: "Type", value: input.type },
        ],
      }).catch(() => {});

      fireWebhooks(ctx.prisma, wsId, "task.created", {
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        status: task.status,
        priority: task.priority,
        type: task.type,
        projectId: task.projectId,
      }).catch(() => {});

      // Run automation rules
      runAutomations(ctx.prisma as any, "task_created", {
        taskId: task.id,
        projectId: task.projectId,
        title: task.title,
        type: task.type,
        status: task.status,
        priority: task.priority,
        assigneeIds: task.assignees.map(a => a.user.id),
        labelIds: task.labels.map(l => l.labelId),
        columnId: task.columnId,
      }, ctx.user.userId).catch(() => {});

      return task;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().max(50000).optional().nullable(),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
      status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
      dueDate: z.string().datetime().optional().nullable(),
      startDate: z.string().datetime().optional().nullable(),
      estimateHours: z.number().min(0).optional().nullable(),
      storyPoints: z.number().int().min(0).max(100).optional().nullable(),
      coverColor: z.string().optional().nullable(),
      type: taskTypeEnum.optional(),
      isRecurring: z.boolean().optional(),
      recurrenceRule: z.string().optional().nullable(),
      recurrenceInterval: z.number().int().min(1).optional().nullable(),
      recurrenceEndDate: z.string().datetime().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const oldTask = await ctx.prisma.task.findUniqueOrThrow({ where: { id } });

      // Permission check: must be assignee or have canEditAnyTask
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, oldTask.projectId);
      const canEditAny = await checkPermission(ctx.prisma, ctx.user.userId, wsId, "canEditAnyTask");
      if (!canEditAny) {
        const isAssignee = await ctx.prisma.taskAssignee.findUnique({
          where: { taskId_userId: { taskId: id, userId: ctx.user.userId } },
        });
        if (!isAssignee) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only edit tasks assigned to you" });
        }
      }

      const updateData: any = {};
      // Copy simple fields
      const simpleFields = ["title", "description", "priority", "status", "estimateHours", "storyPoints", "coverColor", "type", "isRecurring", "recurrenceRule", "recurrenceInterval"] as const;
      for (const f of simpleFields) {
        if ((data as any)[f] !== undefined) updateData[f] = (data as any)[f];
      }
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
      if (data.recurrenceEndDate !== undefined) updateData.recurrenceEndDate = data.recurrenceEndDate ? new Date(data.recurrenceEndDate) : null;
      if (data.status === "done") {
        updateData.completedAt = new Date();
      } else if (data.status) {
        updateData.completedAt = null;
      }

      const task = await ctx.prisma.task.update({ where: { id }, data: updateData });

      // Notify integrations + webhooks on update/complete
      const wsIdForNotify = await getWorkspaceIdFromProject(ctx.prisma, task.projectId);

      fireWebhooks(ctx.prisma, wsIdForNotify, "task.updated", {
        taskId: task.id,
        taskNumber: task.taskNumber,
        title: task.title,
        status: task.status,
        priority: task.priority,
        changes: Object.keys(updateData),
      }).catch(() => {});

      // Run automation rules on status change
      if (data.status || data.columnId) {
        runAutomations(ctx.prisma as any, "task_moved_to_column", {
          taskId: task.id,
          projectId: task.projectId,
          title: task.title,
          type: task.type,
          status: task.status,
          priority: task.priority,
          assigneeIds: [],
          labelIds: [],
          columnId: task.columnId,
        }, ctx.user.userId).catch(() => {});
      }

      if (data.status === "done") {
        notifyIntegrations(ctx.prisma, wsIdForNotify, "task.completed", {
          title: `Task completed: ${task.title}`,
          fields: [{ label: "Status", value: "Done" }],
        }).catch(() => {});

        fireWebhooks(ctx.prisma, wsIdForNotify, "task.completed", {
          taskId: task.id,
          taskNumber: task.taskNumber,
          title: task.title,
        }).catch(() => {});
      }

      // Process recurrence: if task completed and is recurring, create next occurrence
      if (data.status === "done" && task.isRecurring && task.recurrenceRule) {
        const rule = task.recurrenceRule;
        const interval = task.recurrenceInterval || 1;
        const now = new Date();
        let nextDate: Date | null = null;

        if (rule === "daily") nextDate = new Date(now.getTime() + interval * 86400000);
        else if (rule === "weekly") nextDate = new Date(now.getTime() + interval * 7 * 86400000);
        else if (rule === "monthly") { nextDate = new Date(now); nextDate.setMonth(nextDate.getMonth() + interval); }

        if (nextDate && (!task.recurrenceEndDate || nextDate <= task.recurrenceEndDate)) {
          const project = await ctx.prisma.project.update({ where: { id: task.projectId }, data: { taskCounter: { increment: 1 } } });
          await ctx.prisma.task.create({
            data: {
              title: task.title,
              description: task.description,
              priority: task.priority,
              type: task.type,
              columnId: task.columnId,
              projectId: task.projectId,
              taskNumber: project.taskCounter,
              status: "todo",
              position: task.position,
              createdById: ctx.user.userId,
              dueDate: nextDate,
              isRecurring: true,
              recurrenceRule: task.recurrenceRule,
              recurrenceInterval: task.recurrenceInterval,
              recurrenceEndDate: task.recurrenceEndDate,
            },
          });
        }
      }

      // Run automations
      try {
        const automations = await ctx.prisma.automationRule.findMany({
          where: { projectId: task.projectId, isEnabled: true },
        });
        for (const rule of automations) {
          const trigger = rule.trigger as any;
          const actions = rule.actions as any[];
          let matches = false;
          if (trigger.event === "task_moved_to_column" && data.status !== undefined) {
            matches = true;
          } else if (trigger.event === "task_created") {
            // Only on create, not update
          }
          if (matches) {
            for (const action of actions) {
              if (action.type === "change_priority" && action.params?.priority) {
                await ctx.prisma.task.update({ where: { id }, data: { priority: action.params.priority } });
              } else if (action.type === "change_assignee" && action.params?.userId) {
                await ctx.prisma.taskAssignee.create({ data: { taskId: id, userId: action.params.userId } }).catch(() => {});
              }
            }
            await ctx.prisma.automationRule.update({ where: { id: rule.id }, data: { lastRunAt: new Date(), runCount: { increment: 1 } } });
          }
        }
      } catch { /* automation errors shouldn't block task update */ }

      // Log changes — both TaskActivity and Activity
      const fields = ["title", "description", "priority", "status", "dueDate", "type", "estimateHours", "storyPoints", "coverColor"] as const;
      for (const field of fields) {
        if (data[field] !== undefined && String((oldTask as any)[field]) !== String(data[field])) {
          await ctx.prisma.taskActivity.create({
            data: {
              taskId: id,
              userId: ctx.user.userId,
              action: "updated",
              field,
              oldValue: String((oldTask as any)[field] ?? ""),
              newValue: String(data[field] ?? ""),
            },
          });
        }
      }

      // Also create Activity record for project-level feed
      await ctx.prisma.activity.create({
        data: {
          projectId: task.projectId,
          userId: ctx.user.userId,
          entityType: "task",
          entityId: id,
          action: "updated",
          description: `updated task DK-${task.taskNumber} "${task.title}"`,
          metadata: Object.fromEntries(
            (fields as readonly string[])
              .filter(f => (data as any)[f] !== undefined && String((oldTask as any)[f]) !== String((data as any)[f]))
              .map(f => [f, { old: (oldTask as any)[f], new: (data as any)[f] }])
          ),
        },
      }).catch(() => {});

      // Notify watchers
      try {
        const watchers = await ctx.prisma.taskWatcher.findMany({
          where: { taskId: id, userId: { not: ctx.user.userId } },
        });
        const changedFields = (["title", "description", "priority", "status", "dueDate", "type"] as const)
          .filter(f => data[f] !== undefined && String((oldTask as any)[f]) !== String(data[f]));
        if (changedFields.length > 0 && watchers.length > 0) {
          await ctx.prisma.notification.createMany({
            data: watchers.map(w => ({
              userId: w.userId,
              type: changedFields.includes("status") ? "task_status_changed" as const : "task_updated" as const,
              title: `Task DK-${task.taskNumber} updated`,
              message: `${changedFields.join(", ")} changed on "${task.title}"`,
            })),
          });
        }
      } catch {}

      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, task.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canDeleteTasks");
      await ctx.prisma.task.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.id, userId: ctx.user.userId, action: "deleted" },
      });
      await logAudit(ctx.prisma, {
        workspaceId: wsId, userId: ctx.user.userId,
        action: "task.deleted", entityType: "task", entityId: input.id,
        metadata: { title: task.title, taskNumber: task.taskNumber },
      });
      return { success: true };
    }),

  move: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      columnId: z.string().uuid(),
      position: z.number().int().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      const oldTask = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: { column: { select: { name: true } } },
      });

      const newCol = await ctx.prisma.boardColumn.findUniqueOrThrow({ where: { id: input.columnId } });

      // Update positions of other tasks in target column
      await ctx.prisma.task.updateMany({
        where: { columnId: input.columnId, position: { gte: input.position }, deletedAt: null, id: { not: input.taskId } },
        data: { position: { increment: 1 } },
      });

      const updateData: any = { columnId: input.columnId, position: input.position };

      // Sync task status based on column name
      if (newCol.isDone) {
        updateData.status = "done";
        updateData.completedAt = new Date();
      } else {
        const colNameLower = newCol.name.toLowerCase().replace(/[\s\-_]+/g, "_");
        const statusMap: Record<string, string> = {
          backlog: "backlog",
          to_do: "todo",
          todo: "todo",
          in_progress: "in_progress",
          in_review: "in_review",
          review: "in_review",
          doing: "in_progress",
          development: "in_progress",
          testing: "in_review",
          qa: "in_review",
        };
        const mappedStatus = statusMap[colNameLower];
        if (mappedStatus) {
          updateData.status = mappedStatus;
        }
        // Clear completedAt if moving away from done
        if (oldTask.status === "done") {
          updateData.completedAt = null;
        }
      }

      const task = await ctx.prisma.task.update({ where: { id: input.taskId }, data: updateData });

      if (oldTask.columnId !== input.columnId) {
        await ctx.prisma.taskActivity.create({
          data: {
            taskId: input.taskId, userId: ctx.user.userId, action: "moved",
            field: "column",
            oldValue: oldTask.column?.name || "",
            newValue: newCol.name,
          },
        });
      }

      return task;
    }),

  assignUser: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskAssignee.create({ data: { taskId: input.taskId, userId: input.userId } });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "assigned", newValue: input.userId },
      });
      // Notify
      if (input.userId !== ctx.user.userId) {
        const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, taskNumber: true, project: { select: { taskPrefix: true } } } });
        await ctx.prisma.notification.create({
          data: {
            userId: input.userId, type: "task_assigned",
            title: `You were assigned to ${task?.project.taskPrefix}-${task?.taskNumber}`,
            message: task?.title,
          },
        });
      }
      // Email notification
      if (input.userId !== ctx.user.userId) {
        const taskForEmail = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, taskNumber: true, project: { select: { taskPrefix: true } } } });
        const assigner = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
        if (taskForEmail) {
          notifyTaskAssigned(input.userId, assigner?.name || "Someone", taskForEmail.title, `${taskForEmail.project.taskPrefix}-${taskForEmail.taskNumber}`).catch(() => {});
        }
      }
      // Notify integrations
      const taskForIntg = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, projectId: true } });
      if (taskForIntg) {
        const assignee = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { name: true } });
        const wsIdForNotify = await getWorkspaceIdFromProject(ctx.prisma, taskForIntg.projectId);
        notifyIntegrations(ctx.prisma, wsIdForNotify, "task.assigned", {
          title: `Task assigned: ${taskForIntg.title}`,
          fields: [{ label: "Assignee", value: assignee?.name || "Unknown" }],
        }).catch(() => {});
      }
      return { success: true };
    }),

  unassignUser: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskAssignee.delete({
        where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
      });
      return { success: true };
    }),

  addLabel: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskLabel.create({ data: { taskId: input.taskId, labelId: input.labelId } });
      return { success: true };
    }),

  removeLabel: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), labelId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskLabel.delete({
        where: { taskId_labelId: { taskId: input.taskId, labelId: input.labelId } },
      });
      return { success: true };
    }),

  watch: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskWatcher.upsert({ where: { taskId_userId: { taskId: input.taskId, userId: ctx.user.userId } }, update: {}, create: { taskId: input.taskId, userId: ctx.user.userId } });
      return { success: true };
    }),

  unwatch: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskWatcher.deleteMany({ where: { taskId: input.taskId, userId: ctx.user.userId } });
      return { success: true };
    }),

  bulkUpdate: protectedProcedure
    .input(z.object({
      taskIds: z.array(z.string().uuid()).min(1).max(100),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
      assigneeId: z.string().uuid().optional().nullable(),
      columnId: z.string().uuid().optional(),
      status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Check permission via first task's project
      const firstTask = await ctx.prisma.task.findUniqueOrThrow({ where: { id: input.taskIds[0] } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, firstTask.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canEditAnyTask");
      const { taskIds, ...data } = input;
      const updateData: any = {};
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
      if (data.columnId !== undefined) updateData.columnId = data.columnId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.status === "done") updateData.completedAt = new Date();
      await ctx.prisma.task.updateMany({ where: { id: { in: taskIds } }, data: updateData });
      return { success: true, count: taskIds.length };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ taskIds: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const firstTask = await ctx.prisma.task.findUniqueOrThrow({ where: { id: input.taskIds[0] } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, firstTask.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canDeleteTasks");
      await ctx.prisma.task.updateMany({ where: { id: { in: input.taskIds } }, data: { deletedAt: new Date() } });
      return { success: true, count: input.taskIds.length };
    }),

  duplicate: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const original = await ctx.prisma.task.findUniqueOrThrow({
        where: { id: input.taskId },
        include: { labels: true },
      });
      // Subscription limit check
      const dupWsId = await getWorkspaceIdFromProject(ctx.prisma, original.projectId);
      const dupTaskCount = await ctx.prisma.task.count({ where: { project: { workspaceId: dupWsId }, deletedAt: null } });
      await checkLimit(dupWsId, "maxTasks", dupTaskCount);
      const project = await ctx.prisma.project.update({
        where: { id: original.projectId },
        data: { taskCounter: { increment: 1 } },
      });
      const maxPos = await ctx.prisma.task.aggregate({ where: { columnId: original.columnId, deletedAt: null }, _max: { position: true } });
      const task = await ctx.prisma.task.create({
        data: {
          title: `${original.title} (copy)`,
          description: original.description,
          priority: original.priority,
          status: "todo",
          columnId: original.columnId,
          projectId: original.projectId,
          taskNumber: project.taskCounter,
          position: (maxPos._max.position ?? -1) + 1,
          createdById: ctx.user.userId,
          dueDate: original.dueDate,
          estimateHours: original.estimateHours,
          storyPoints: original.storyPoints,
          labels: original.labels.length ? { create: original.labels.map(l => ({ labelId: l.labelId })) } : undefined,
        },
      });
      return task;
    }),

  toggleAssignee: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.taskAssignee.findUnique({
        where: { taskId_userId: { taskId: input.taskId, userId: input.userId } },
      });
      if (existing) {
        await ctx.prisma.taskAssignee.delete({ where: { id: existing.id } });
        return { assigned: false };
      } else {
        await ctx.prisma.taskAssignee.create({ data: { taskId: input.taskId, userId: input.userId } });

        // Auto-add user as project member if not already
        const task = await ctx.prisma.task.findUnique({
          where: { id: input.taskId },
          select: { projectId: true, title: true, taskNumber: true, project: { select: { taskPrefix: true } } },
        });
        if (task) {
          const isMember = await ctx.prisma.projectMember.findUnique({
            where: { projectId_userId: { projectId: task.projectId, userId: input.userId } },
          });
          if (!isMember) {
            await ctx.prisma.projectMember.create({
              data: { projectId: task.projectId, userId: input.userId, role: "member" },
            });
          }
        }

        // Activity log
        await ctx.prisma.taskActivity.create({
          data: { taskId: input.taskId, userId: ctx.user.userId, action: "assigned", newValue: input.userId },
        }).catch(() => {});

        // Notification + email
        if (input.userId !== ctx.user.userId && task) {
          const taskKey = `${task.project.taskPrefix}-${task.taskNumber}`;
          await ctx.prisma.notification.create({
            data: {
              userId: input.userId,
              type: "task_assigned",
              title: `You were assigned to ${taskKey}`,
              message: task.title,
            },
          }).catch(() => {});

          // Send email (best effort)
          const assignee = await ctx.prisma.user.findUnique({ where: { id: input.userId }, select: { email: true } });
          const assigner = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
          if (assignee?.email && assigner?.name) {
            sendTaskAssignedEmail(assignee.email, {
              assignerName: assigner.name,
              taskTitle: task.title,
              taskKey,
            }).catch(() => {});
          }
        }

        return { assigned: true };
      }
    }),

  importCsv: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      columnId: z.string().uuid(),
      tasks: z.array(z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
        status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "cancelled"]).default("todo"),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Subscription limit check
      const csvWsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      const csvTaskCount = await ctx.prisma.task.count({ where: { project: { workspaceId: csvWsId }, deletedAt: null } });
      await checkLimit(csvWsId, "maxTasks", csvTaskCount + input.tasks.length - 1);
      let created = 0;
      for (const t of input.tasks) {
        const project = await ctx.prisma.project.update({ where: { id: input.projectId }, data: { taskCounter: { increment: 1 } } });
        await ctx.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            columnId: input.columnId,
            projectId: input.projectId,
            taskNumber: project.taskCounter,
            position: created,
            createdById: ctx.user.userId,
          },
        });
        created++;
      }
      return { success: true, count: created };
    }),

  getTimeEntries: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.taskActivity.findMany({
        where: { taskId: input.taskId, action: "logged_time" },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  logTime: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), hours: z.number().min(0.01).max(1000), description: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.task.update({ where: { id: input.taskId }, data: { timeSpent: { increment: input.hours } } });
      await ctx.prisma.taskActivity.create({
        data: {
          taskId: input.taskId, userId: ctx.user.userId, action: "logged_time",
          newValue: String(input.hours),
          metadata: input.description ? { description: input.description } : undefined,
        },
      });
      return { success: true };
    }),

  // ─── Subtasks ───────────────────────────────────────────
  getSubtasks: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const subtasks = await ctx.prisma.task.findMany({
        where: { parentId: input.taskId, deletedAt: null },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          _count: { select: { subtasks: true, comments: true } },
        },
        orderBy: { position: "asc" },
      });
      const total = subtasks.length;
      const done = subtasks.filter(s => s.status === "done" || s.status === "cancelled").length;
      return { subtasks, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
    }),

  createSubtask: protectedProcedure
    .input(z.object({
      parentId: z.string().uuid(),
      title: z.string().min(1).max(500),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).default("none"),
    }))
    .mutation(async ({ ctx, input }) => {
      const parent = await ctx.prisma.task.findUniqueOrThrow({ where: { id: input.parentId } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, parent.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canCreateTasks");
      const taskCount = await ctx.prisma.task.count({ where: { project: { workspaceId: wsId }, deletedAt: null } });
      await checkLimit(wsId, "maxTasks", taskCount);
      const project = await ctx.prisma.project.update({
        where: { id: parent.projectId },
        data: { taskCounter: { increment: 1 } },
      });
      const maxPos = await ctx.prisma.task.aggregate({
        where: { parentId: input.parentId, deletedAt: null },
        _max: { position: true },
      });
      const task = await ctx.prisma.task.create({
        data: {
          title: input.title,
          priority: input.priority,
          projectId: parent.projectId,
          columnId: parent.columnId,
          parentId: input.parentId,
          taskNumber: project.taskCounter,
          status: "todo",
          position: (maxPos._max.position ?? -1) + 1,
          createdById: ctx.user.userId,
        },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        },
      });
      await ctx.prisma.taskActivity.create({
        data: { taskId: task.id, userId: ctx.user.userId, action: "created", metadata: { parentId: input.parentId } },
      });
      return task;
    }),

  convertToSubtask: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      parentId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.taskId === input.parentId) throw new TRPCError({ code: "BAD_REQUEST", message: "Task cannot be its own parent" });
      // Prevent circular: parent can't already be a subtask of this task
      const potentialParent = await ctx.prisma.task.findUniqueOrThrow({ where: { id: input.parentId } });
      if (potentialParent.parentId === input.taskId) throw new TRPCError({ code: "BAD_REQUEST", message: "Circular subtask relationship" });
      const task = await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { parentId: input.parentId },
      });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "converted_to_subtask", newValue: input.parentId },
      }).catch(() => {});
      return task;
    }),

  promoteToTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.prisma.task.update({
        where: { id: input.taskId },
        data: { parentId: null },
      });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "promoted_to_task" },
      }).catch(() => {});
      return task;
    }),

  // ─── Dependencies ──────────────────────────────────────
  addDependency: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      dependsOnTaskId: z.string().uuid(),
      type: z.enum(["blocks", "blocked_by", "relates_to"]).default("blocks"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.taskId === input.dependsOnTaskId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Task cannot depend on itself" });
      }
      const dep = await ctx.prisma.taskDependency.create({
        data: { taskId: input.taskId, dependsOnId: input.dependsOnTaskId, dependencyType: input.type },
      });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "added_dependency", newValue: input.dependsOnTaskId },
      }).catch(() => {});
      return dep;
    }),

  removeDependency: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dep = await ctx.prisma.taskDependency.findUniqueOrThrow({ where: { id: input.id } });
      await ctx.prisma.taskDependency.delete({ where: { id: input.id } });
      await ctx.prisma.taskActivity.create({
        data: { taskId: dep.taskId, userId: ctx.user.userId, action: "removed_dependency", oldValue: dep.dependsOnId },
      }).catch(() => {});
      return { success: true };
    }),

  getDependencies: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [dependencies, dependents] = await Promise.all([
        ctx.prisma.taskDependency.findMany({
          where: { taskId: input.taskId },
          include: { dependsOn: { select: { id: true, title: true, status: true, taskNumber: true } } },
        }),
        ctx.prisma.taskDependency.findMany({
          where: { dependsOnId: input.taskId },
          include: { task: { select: { id: true, title: true, status: true, taskNumber: true } } },
        }),
      ]);
      return { dependencies, dependents };
    }),

  // ─── Task Links (extended dependency types) ─────────────
  addLink: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      targetTaskId: z.string().uuid(),
      linkType: z.enum(["blocks", "blocked_by", "relates_to", "duplicates", "is_duplicated_by", "clones", "is_cloned_from"]),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.taskId === input.targetTaskId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot link a task to itself" });
      }
      const link = await ctx.prisma.taskDependency.create({
        data: {
          taskId: input.taskId,
          dependsOnId: input.targetTaskId,
          dependencyType: input.linkType,
        },
        include: {
          dependsOn: { select: { id: true, title: true, status: true, taskNumber: true } },
        },
      });
      await ctx.prisma.taskActivity.create({
        data: { taskId: input.taskId, userId: ctx.user.userId, action: "linked", newValue: `${input.linkType}: ${input.targetTaskId}` },
      }).catch(() => {});
      return link;
    }),

  removeLink: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dep = await ctx.prisma.taskDependency.findUniqueOrThrow({ where: { id: input.id } });
      await ctx.prisma.taskDependency.delete({ where: { id: input.id } });
      await ctx.prisma.taskActivity.create({
        data: { taskId: dep.taskId, userId: ctx.user.userId, action: "unlinked", oldValue: dep.dependsOnId },
      }).catch(() => {});
      return { success: true };
    }),

  getLinks: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [outgoing, incoming] = await Promise.all([
        ctx.prisma.taskDependency.findMany({
          where: { taskId: input.taskId },
          include: {
            dependsOn: { select: { id: true, title: true, status: true, taskNumber: true, project: { select: { taskPrefix: true } } } },
          },
        }),
        ctx.prisma.taskDependency.findMany({
          where: { dependsOnId: input.taskId },
          include: {
            task: { select: { id: true, title: true, status: true, taskNumber: true, project: { select: { taskPrefix: true } } } },
          },
        }),
      ]);
      return { outgoing, incoming };
    }),

  // ─── Watchers (enhanced) ────────────────────────────────
  getWatchers: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.taskWatcher.findMany({
        where: { taskId: input.taskId },
        include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
      });
    }),

  addWatcher: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.taskWatcher.create({ data: { taskId: input.taskId, userId: input.userId } });
      return { success: true };
    }),

  // ─── All Dependencies (for timeline/gantt) ─────────────
  getAllDependencies: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deps = await ctx.prisma.taskDependency.findMany({
        where: {
          task: { projectId: input.projectId, deletedAt: null },
        },
        include: {
          task: { select: { id: true, dueDate: true, status: true } },
          dependsOn: { select: { id: true, dueDate: true, status: true } },
        },
      });
      return deps;
    }),

  // ─── Due Date Reminders ────────────────────────────────
  getBacklog: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      search: z.string().optional(),
      priority: z.enum(["urgent", "high", "medium", "low", "none"]).optional(),
      assigneeId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Tasks NOT in any sprint
      const where: any = {
        projectId: input.projectId,
        deletedAt: null,
        sprintTasks: { none: {} },
      };
      if (input.priority) where.priority = input.priority;
      if (input.assigneeId) where.assignees = { some: { userId: input.assigneeId } };
      if (input.search) where.title = { contains: input.search, mode: "insensitive" };

      const tasks = await ctx.prisma.task.findMany({
        where,
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
          labels: { include: { label: true } },
          _count: { select: { comments: true, attachments: true, subtasks: true, votes: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return tasks;
    }),

  addToSprint: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), sprintId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.sprintTask.create({ data: { sprintId: input.sprintId, taskId: input.taskId } });
      return { success: true };
    }),

  removeFromSprint: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), sprintId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.sprintTask.delete({
        where: { sprintId_taskId: { sprintId: input.sprintId, taskId: input.taskId } },
      });
      return { success: true };
    }),

  checkDueReminders: protectedProcedure
    .mutation(async ({ ctx }) => {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const tasksDueSoon = await ctx.prisma.task.findMany({
        where: {
          dueDate: { gte: now, lte: in24h },
          status: { notIn: ["done", "cancelled"] },
          deletedAt: null,
        },
        include: {
          assignees: { include: { user: { select: { id: true, name: true } } } },
        },
      });

      let notifCount = 0;
      for (const task of tasksDueSoon) {
        for (const assignee of task.assignees) {
          // Check if we already sent a reminder for this task today
          const existing = await ctx.prisma.notification.findFirst({
            where: {
              userId: assignee.user.id,
              type: "task_due_soon",
              createdAt: { gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
              message: { contains: task.id },
            },
          });
          if (!existing) {
            await ctx.prisma.notification.create({
              data: {
                userId: assignee.user.id,
                type: "task_due_soon",
                title: `Task due soon: ${task.title}`,
                message: task.id,
              },
            });
            notifCount++;
          }
        }
      }

      return { checked: tasksDueSoon.length, notificationsSent: notifCount };
    }),

  vote: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.taskVote.findUnique({
        where: { taskId_userId: { taskId: input.taskId, userId: ctx.user.userId } },
      });
      if (existing) {
        await ctx.prisma.taskVote.delete({ where: { id: existing.id } });
        return { voted: false };
      }
      await ctx.prisma.taskVote.create({ data: { taskId: input.taskId, userId: ctx.user.userId } });
      return { voted: true };
    }),

  getVotes: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.prisma.taskVote.count({ where: { taskId: input.taskId } });
      const userVoted = await ctx.prisma.taskVote.findUnique({
        where: { taskId_userId: { taskId: input.taskId, userId: ctx.user.userId } },
      });
      return { count, voted: !!userVoted };
    }),
});
