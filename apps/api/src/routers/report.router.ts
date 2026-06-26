import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";
import { checkPermission } from "../middleware/permissions.js";

const ReportTypeEnum = z.enum([
  "task_summary",
  "sprint_velocity",
  "team_workload",
  "time_tracking",
  "status_distribution",
  "priority_breakdown",
  "completion_trend",
  "overdue_tasks",
  "member_performance",
  "person_activity",
  "custom",
]);

const DateRangeEnum = z.enum([
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_sprint",
  "this_month",
  "this_quarter",
  "custom",
]);

export const reportRouter = router({
  // Generate a report
  generate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        type: ReportTypeEnum,
        dateRange: DateRangeEnum.default("last_30_days"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        groupBy: z.enum(["status", "priority", "assignee", "label", "sprint", "type"]).optional(),
        // The person_activity report picks a single user; reuse one input
        // instead of overloading filters.assigneeIds.
        assigneeId: z.string().uuid().optional(),
        filters: z
          .object({
            assigneeIds: z.array(z.string().uuid()).optional(),
            statuses: z.array(z.string()).optional(),
            priorities: z.array(z.string()).optional(),
            labelIds: z.array(z.string().uuid()).optional(),
            sprintId: z.string().uuid().optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, projectId, type, dateRange, startDate, endDate, groupBy, filters, assigneeId } = input;

      // Calculate date range
      const now = new Date();
      let from = new Date();
      let to = now;

      switch (dateRange) {
        case "last_7_days":
          from.setDate(now.getDate() - 7);
          break;
        case "last_30_days":
          from.setDate(now.getDate() - 30);
          break;
        case "last_90_days":
          from.setDate(now.getDate() - 90);
          break;
        case "this_month":
          from = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "this_quarter":
          from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case "this_sprint":
          // Find active sprint
          const activeSprint = projectId
            ? await ctx.prisma.sprint.findFirst({
                where: { projectId, isActive: true },
                orderBy: { startDate: "desc" },
              })
            : null;
          if (activeSprint) {
            from = activeSprint.startDate || from;
            to = activeSprint.endDate || to;
          }
          break;
        case "custom":
          if (startDate) from = new Date(startDate);
          if (endDate) to = new Date(endDate);
          break;
      }

      // Base where clause
      const where: any = {
        project: { workspaceId },
        createdAt: { gte: from, lte: to },
        deletedAt: null,
        parentId: null,
      };

      if (projectId) where.projectId = projectId;
      if (filters?.assigneeIds?.length) {
        where.assignees = { some: { userId: { in: filters.assigneeIds } } };
      }
      if (filters?.statuses?.length) {
        where.status = { in: filters.statuses };
      }
      if (filters?.priorities?.length) {
        where.priority = { in: filters.priorities };
      }
      if (filters?.sprintId) {
        where.sprintId = filters.sprintId;
      }

      // Generate report based on type
      switch (type) {
        case "task_summary": {
          const [total, byStatus, byPriority, byType, recentlyCompleted, overdue] = await Promise.all([
            ctx.prisma.task.count({ where }),
            ctx.prisma.task.groupBy({
              by: ["status"],
              where,
              _count: true,
            }),
            ctx.prisma.task.groupBy({
              by: ["priority"],
              where,
              _count: true,
            }),
            ctx.prisma.task.groupBy({
              by: ["type"],
              where,
              _count: true,
            }),
            ctx.prisma.task.count({
              where: { ...where, status: "done", completedAt: { gte: from } },
            }),
            ctx.prisma.task.count({
              where: { ...where, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] } },
            }),
          ]);

          return {
            type: "task_summary",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              total,
              completed: recentlyCompleted,
              overdue,
              completionRate: total > 0 ? Math.round((recentlyCompleted / total) * 100) : 0,
              byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
              byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count })),
              byType: byType.map((t) => ({ type: t.type, count: t._count })),
            },
          };
        }

        case "status_distribution": {
          const byStatus = await ctx.prisma.task.groupBy({
            by: ["status"],
            where,
            _count: true,
          });
          const total = byStatus.reduce((sum, s) => sum + s._count, 0);
          return {
            type: "status_distribution",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              total,
              distribution: byStatus.map((s) => ({
                status: s.status,
                count: s._count,
                percentage: total > 0 ? Math.round((s._count / total) * 100) : 0,
              })),
            },
          };
        }

        case "priority_breakdown": {
          const byPriority = await ctx.prisma.task.groupBy({
            by: ["priority"],
            where,
            _count: true,
          });
          const total = byPriority.reduce((sum, p) => sum + p._count, 0);
          return {
            type: "priority_breakdown",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              total,
              breakdown: byPriority.map((p) => ({
                priority: p.priority,
                count: p._count,
                percentage: total > 0 ? Math.round((p._count / total) * 100) : 0,
              })),
            },
          };
        }

        case "completion_trend": {
          // Get tasks completed per day over the date range
          const completed = await ctx.prisma.task.findMany({
            where: {
              ...where,
              status: "done",
              completedAt: { gte: from, lte: to },
            },
            select: { completedAt: true },
          });

          const created = await ctx.prisma.task.findMany({
            where: {
              ...where,
              createdAt: { gte: from, lte: to },
            },
            select: { createdAt: true },
          });

          // Group by day
          const dayMap: Record<string, { created: number; completed: number }> = {};
          const dayMs = 86400000;
          for (let d = new Date(from); d <= to; d = new Date(d.getTime() + dayMs)) {
            const key = d.toISOString().split("T")[0];
            dayMap[key] = { created: 0, completed: 0 };
          }

          for (const t of created) {
            const key = t.createdAt.toISOString().split("T")[0];
            if (dayMap[key]) dayMap[key].created++;
          }
          for (const t of completed) {
            if (t.completedAt) {
              const key = t.completedAt.toISOString().split("T")[0];
              if (dayMap[key]) dayMap[key].completed++;
            }
          }

          return {
            type: "completion_trend",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              trend: Object.entries(dayMap).map(([date, counts]) => ({
                date,
                ...counts,
              })),
            },
          };
        }

        case "overdue_tasks": {
          const overdueTasks = await ctx.prisma.task.findMany({
            where: {
              ...where,
              dueDate: { lt: now },
              status: { notIn: ["done", "cancelled"] },
            },
            select: {
              id: true,
              title: true,
              taskNumber: true,
              status: true,
              priority: true,
              dueDate: true,
              project: { select: { id: true, name: true } },
              assignees: { select: { user: { select: { id: true, name: true, avatarUrl: true } } } },
            },
            orderBy: { dueDate: "asc" },
            take: 100,
          });

          const dayMs = 86400000;
          return {
            type: "overdue_tasks",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              count: overdueTasks.length,
              tasks: overdueTasks.map((t) => ({
                ...t,
                daysOverdue: t.dueDate ? Math.floor((now.getTime() - t.dueDate.getTime()) / dayMs) : 0,
                assignees: t.assignees.map((a) => a.user),
              })),
            },
          };
        }

        case "member_performance": {
          // Get all members in workspace
          const members = await ctx.prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          });

          const memberStats = await Promise.all(
            members.map(async (m) => {
              const memberWhere = {
                ...where,
                assignees: { some: { userId: m.user.id } },
              };

              const [assigned, completed, overdue] = await Promise.all([
                ctx.prisma.task.count({ where: memberWhere }),
                ctx.prisma.task.count({
                  where: { ...memberWhere, status: "done", completedAt: { gte: from } },
                }),
                ctx.prisma.task.count({
                  where: {
                    ...memberWhere,
                    dueDate: { lt: now },
                    status: { notIn: ["done", "cancelled"] },
                  },
                }),
              ]);

              return {
                user: m.user,
                assigned,
                completed,
                overdue,
                completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
              };
            })
          );

          return {
            type: "member_performance",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              members: memberStats.sort((a, b) => b.completed - a.completed),
            },
          };
        }

        case "team_workload": {
          const members = await ctx.prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { user: { select: { id: true, name: true, avatarUrl: true } } },
          });

          const workload = await Promise.all(
            members.map(async (m) => {
              const byStatus = await ctx.prisma.task.groupBy({
                by: ["status"],
                where: {
                  ...where,
                  assignees: { some: { userId: m.user.id } },
                },
                _count: true,
              });

              const total = byStatus.reduce((s, b) => s + b._count, 0);
              return {
                user: m.user,
                total,
                statusBreakdown: byStatus.map((b) => ({ status: b.status, count: b._count })),
              };
            })
          );

          return {
            type: "team_workload",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: { workload: workload.sort((a, b) => b.total - a.total) },
          };
        }

        case "sprint_velocity": {
          const sprints = await ctx.prisma.sprint.findMany({
            where: {
              project: { workspaceId },
              ...(projectId ? { projectId } : {}),
              isCompleted: true,
            },
            orderBy: { startDate: "desc" },
            take: 10,
            select: {
              id: true,
              name: true,
              startDate: true,
              endDate: true,
              goal: true,
            },
          });

          const velocity = await Promise.all(
            sprints.map(async (sprint) => {
              const tasks = await ctx.prisma.task.findMany({
                // Task→Sprint goes through the SprintTask junction table.
                where: { sprintTasks: { some: { sprintId: sprint.id } }, status: "done", deletedAt: null },
                select: { storyPoints: true },
              });
              const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
              const taskCount = tasks.length;

              return {
                sprint: sprint.name,
                startDate: sprint.startDate?.toISOString(),
                endDate: sprint.endDate?.toISOString(),
                completedPoints: totalPoints,
                completedTasks: taskCount,
              };
            })
          );

          return {
            type: "sprint_velocity",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: { sprints: velocity.reverse() },
          };
        }

        case "time_tracking": {
          // TODO: rewrite to query TaskActivity records with action="logged_time"
          // (the actual storage; see timeTrackingRouter.getTimeReport).
          // The original code referenced ctx.prisma.timeEntry which is not a
          // model in the Prisma schema -- selecting it crashed the request
          // (500) for any Reports user who picked "Time Tracking". For now
          // we return an empty, well-shaped payload so the UI renders
          // without errors.
          return {
            type: "time_tracking",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              totalMinutes: 0,
              totalHours: 0,
              byUser: [],
              entryCount: 0,
            },
          };
        }

        case "person_activity": {
          // Targeted view of one teammate's work in the date range.
          // Permission: caller can see their own; viewing someone else's
          // requires canViewReports in the workspace.
          if (!assigneeId) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "person_activity requires an assigneeId" });
          }
          if (assigneeId !== ctx.user.userId) {
            const ok = await checkPermission(ctx.prisma, ctx.user.userId, workspaceId, "canViewReports");
            if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to view this person's report" });
          }

          const baseWhere = {
            project: { workspaceId, deletedAt: null, ...(projectId ? { id: projectId } : {}) },
            deletedAt: null,
            assignees: { some: { userId: assigneeId } },
          };
          const taskSelect = {
            id: true, taskNumber: true, title: true, status: true, priority: true,
            dueDate: true, completedAt: true, updatedAt: true,
            project: { select: { id: true, name: true, color: true, slug: true } },
          } as const;

          const [user, openTasks, completedTasks, overdueTasks, recentActivity] = await Promise.all([
            ctx.prisma.user.findUnique({
              where: { id: assigneeId },
              select: { id: true, name: true, email: true, avatarUrl: true },
            }),
            ctx.prisma.task.findMany({
              where: { ...baseWhere, status: { notIn: ["done", "cancelled"] } },
              select: taskSelect, orderBy: { updatedAt: "desc" }, take: 100,
            }),
            ctx.prisma.task.findMany({
              where: { ...baseWhere, status: "done", completedAt: { gte: from, lte: to } },
              select: taskSelect, orderBy: { completedAt: "desc" }, take: 100,
            }),
            ctx.prisma.task.findMany({
              where: { ...baseWhere, dueDate: { lt: now }, status: { notIn: ["done", "cancelled"] } },
              select: taskSelect, orderBy: { dueDate: "asc" }, take: 100,
            }),
            // Activity timeline -- everything this user did in the date range,
            // scoped to tasks in the workspace (+ optional project filter).
            ctx.prisma.taskActivity.findMany({
              where: {
                userId: assigneeId,
                createdAt: { gte: from, lte: to },
                task: {
                  project: { workspaceId, deletedAt: null, ...(projectId ? { id: projectId } : {}) },
                  deletedAt: null,
                },
              },
              select: {
                id: true, action: true, field: true, oldValue: true, newValue: true, createdAt: true,
                task: { select: { id: true, taskNumber: true, title: true, project: { select: { id: true, name: true, color: true } } } },
              },
              orderBy: { createdAt: "desc" },
              take: 200,
            }),
          ]);

          return {
            type: "person_activity",
            dateRange: { from: from.toISOString(), to: to.toISOString() },
            data: {
              user,
              counts: {
                open: openTasks.length,
                completed: completedTasks.length,
                overdue: overdueTasks.length,
                activityEvents: recentActivity.length,
              },
              openTasks,
              completedTasks,
              overdueTasks,
              activity: recentActivity,
            },
          };
        }

        default:
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown report type" });
      }
    }),

  // Export report as CSV
  exportCsv: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        projectId: z.string().uuid().optional(),
        type: ReportTypeEnum,
        dateRange: DateRangeEnum.default("last_30_days"),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        // For person_activity exports the UI passes the picked user.
        assigneeId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, projectId, type, dateRange, assigneeId } = input;

      // person_activity exports require permission to view that user (or be them).
      if (type === "person_activity" && assigneeId && assigneeId !== ctx.user.userId) {
        const ok = await checkPermission(ctx.prisma, ctx.user.userId, workspaceId, "canViewReports");
        if (!ok) throw new TRPCError({ code: "FORBIDDEN", message: "Not allowed to export this person's report" });
      }

      const now = new Date();
      let from = new Date();
      from.setDate(now.getDate() - 30);

      if (dateRange === "last_7_days") from.setDate(now.getDate() - 7);
      if (dateRange === "last_90_days") from.setDate(now.getDate() - 90);

      const where: any = {
        project: { workspaceId },
        createdAt: { gte: from },
        deletedAt: null,
        parentId: null,
      };
      if (projectId) where.projectId = projectId;
      // person_activity narrows to that user's tasks across the workspace.
      if (type === "person_activity" && assigneeId) {
        where.assignees = { some: { userId: assigneeId } };
      }

      const tasks = await ctx.prisma.task.findMany({
        where,
        select: {
          taskNumber: true,
          title: true,
          status: true,
          priority: true,
          type: true,
          storyPoints: true,
          dueDate: true,
          createdAt: true,
          completedAt: true,
          project: { select: { name: true } },
          assignees: { select: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });

      const headers = [
        "Task #",
        "Title",
        "Project",
        "Status",
        "Priority",
        "Type",
        "Story Points",
        "Assignees",
        "Due Date",
        "Created",
        "Completed",
      ];

      const rows = tasks.map((t) => [
        t.taskNumber,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        t.project.name,
        t.status,
        t.priority,
        t.type,
        t.storyPoints || "",
        `"${t.assignees.map((a) => a.user.name).join(", ")}"`,
        t.dueDate ? t.dueDate.toISOString().split("T")[0] : "",
        t.createdAt.toISOString().split("T")[0],
        t.completedAt ? t.completedAt.toISOString().split("T")[0] : "",
      ]);

      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      return { csv, filename: `dkflow-report-${type}-${new Date().toISOString().split("T")[0]}.csv` };
    }),

  // List saved report configs (for future use)
  listSaved: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // For now return empty — saved reports can be added later with a DB model
      return { reports: [] };
    }),
});
