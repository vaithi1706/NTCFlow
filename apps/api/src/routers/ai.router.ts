import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import {
  generateTaskDescription,
  suggestTaskMetadata,
  summarizeProject,
  generateSprintPlan,
  breakdownTask,
  estimateEffort,
  generateReleaseNotes,
  naturalSearchToFilters,
  checkDuplicates,
  sprintPlanSuggestion,
  generateWeeklyDigest,
  extractTasksFromNotes,
  suggestAutomations,
  detectAnomalies,
} from "../services/ai.js";
import { requireProjectAccess, getWorkspaceIdFromProject } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";
import { logAudit } from "../utils/audit.js";

export const aiRouter = router({
  // --- Feature 1: Generate Description ---
  generateDescription: protectedProcedure
    .input(z.object({ title: z.string().min(1), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { name: true },
      });

      try {
        const result = await generateTaskDescription(input.title, project?.name || undefined);
        await logAudit(ctx.prisma, {
          userId: ctx.user.userId,
          workspaceId: wsId,
          action: "ai.generateDescription",
          entityType: "task",
          metadata: { title: input.title },
        });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI generation failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Feature 2: Breakdown Task ---
  breakdownTask: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().default(""),
      projectId: z.string().uuid(),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const project = await ctx.prisma.project.findUnique({
        where: { id: input.projectId },
        select: { name: true },
      });

      try {
        const suggestions = await breakdownTask(input.title, input.description, project?.name || undefined);

        // Get next task number
        const lastTask = await ctx.prisma.task.findFirst({
          where: { projectId: input.projectId },
          orderBy: { taskNumber: "desc" },
          select: { taskNumber: true },
        });
        let nextNumber = (lastTask?.taskNumber || 0) + 1;

        // Get default column
        const defaultColumn = await ctx.prisma.boardColumn.findFirst({
          where: { projectId: input.projectId },
          orderBy: { position: "asc" },
          select: { id: true },
        });

        const created = [];
        for (const sub of suggestions) {
          const task = await ctx.prisma.task.create({
            data: {
              projectId: input.projectId,
              parentId: input.parentId || null,
              columnId: defaultColumn?.id || null,
              title: sub.title,
              description: sub.description,
              priority: (["urgent", "high", "medium", "low", "none"].includes(sub.priority) ? sub.priority : "medium") as any,
              storyPoints: sub.estimatedPoints,
              taskNumber: nextNumber++,
              status: "todo",
              createdById: ctx.user.userId,
            },
          });
          created.push({ id: task.id, title: task.title });
        }

        await logAudit(ctx.prisma, {
          userId: ctx.user.userId,
          workspaceId: wsId,
          action: "ai.breakdownTask",
          entityType: "task",
          metadata: { parentTitle: input.title, subtaskCount: created.length },
        });

        return { suggestions, tasks: created };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI breakdown failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Feature 3: Project Summary ---
  projectSummary: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, storyPoints: true },
      });

      return summarizeProject(tasks);
    }),

  // --- Feature 4: Effort Estimation ---
  estimateEffort: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().default(""),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const completedTasks = await ctx.prisma.task.findMany({
        where: {
          projectId: input.projectId,
          status: "done",
          storyPoints: { not: null },
          deletedAt: null,
        },
        select: { title: true, storyPoints: true },
        take: 20,
        orderBy: { completedAt: "desc" },
      });

      try {
        const result = await estimateEffort(input.title, input.description, completedTasks);
        await logAudit(ctx.prisma, {
          userId: ctx.user.userId,
          workspaceId: wsId,
          action: "ai.estimateEffort",
          entityType: "task",
          metadata: { title: input.title, suggestedPoints: result.points },
        });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI estimation failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Feature 5: Release Notes ---
  generateReleaseNotes: protectedProcedure
    .input(z.object({
      versionId: z.string().uuid().optional(),
      taskIds: z.array(z.string().uuid()).optional(),
      workspaceId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");

      let tasks: any[] = [];

      if (input.versionId) {
        const version = await ctx.prisma.version.findUnique({
          where: { id: input.versionId },
          include: {
            tasks: {
              include: {
                task: {
                  select: {
                    title: true, description: true, type: true,
                    labels: { include: { label: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        });
        tasks = version?.tasks.map((tv: any) => ({
          title: tv.task.title,
          description: tv.task.description,
          type: tv.task.type,
          labels: tv.task.labels.map((l: any) => l.label.name),
        })) || [];
      } else if (input.taskIds?.length) {
        const dbTasks = await ctx.prisma.task.findMany({
          where: { id: { in: input.taskIds } },
          select: {
            title: true, description: true, type: true,
            labels: { include: { label: { select: { name: true } } } },
          },
        });
        tasks = dbTasks.map((t: any) => ({
          title: t.title,
          description: t.description,
          type: t.type,
          labels: t.labels.map((l: any) => l.label.name),
        }));
      }

      if (tasks.length === 0) {
        return { releaseNotes: "No tasks found for this release." };
      }

      try {
        const releaseNotes = await generateReleaseNotes(tasks);
        await logAudit(ctx.prisma, {
          userId: ctx.user.userId,
          workspaceId: input.workspaceId,
          action: "ai.generateReleaseNotes",
          entityType: "version",
          metadata: { versionId: input.versionId, taskCount: tasks.length },
        });
        return { releaseNotes };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI release notes failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Feature 6: Natural Language Search ---
  naturalSearch: protectedProcedure
    .input(z.object({ query: z.string().min(1), workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");

      try {
        const filters = await naturalSearchToFilters(input.query);

        const where: any = {
          deletedAt: null,
          project: { workspaceId: input.workspaceId },
        };

        if (filters.status) where.status = filters.status;
        if (filters.priority) where.priority = filters.priority;
        if (filters.taskType) where.type = filters.taskType;
        if (filters.isOverdue) {
          where.dueDate = { lt: new Date() };
          where.status = { notIn: ["done", "cancelled"] };
        }
        if (filters.searchText) where.title = { contains: filters.searchText, mode: "insensitive" };
        if (filters.labels?.length) {
          where.labels = { some: { label: { name: { in: filters.labels, mode: "insensitive" } } } };
        }

        const tasks = await ctx.prisma.task.findMany({
          where,
          include: {
            project: { select: { name: true } },
            assignees: { include: { user: { select: { id: true, name: true } } } },
            labels: { include: { label: true } },
          },
          take: 25,
          orderBy: { updatedAt: "desc" },
        });

        return { filters, tasks };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI search failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Feature 7: Duplicate Detection ---
  checkDuplicate: protectedProcedure
    .input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      projectId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const existingTasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        select: { id: true, title: true, description: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      });

      try {
        const duplicates = await checkDuplicates(input.title, input.description, existingTasks);
        return { duplicates };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Duplicate check failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Legacy: Suggest Metadata ---
  suggestMetadata: protectedProcedure
    .input(z.object({ title: z.string().min(1), description: z.string().default(""), projectId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.projectId) {
        const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
        await requireFeature(wsId, "ai");
      }
      return suggestTaskMetadata(input.title, input.description);
    }),

  // --- V2 Feature 1: Sprint Planning Assistant ---
  sprintPlanSuggestion: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), sprintCapacity: z.number().int().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      // Get backlog tasks (not in active sprint, not done)
      const backlogTasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null, status: { notIn: ["done", "cancelled"] }, sprintTasks: { none: { sprint: { isActive: true } } } },
        select: { id: true, title: true, priority: true, storyPoints: true, type: true, labels: { include: { label: { select: { name: true } } } } },
        orderBy: { createdAt: "asc" },
      });

      // Team members count
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId }, select: { workspaceId: true } });
      const teamCount = await ctx.prisma.workspaceMember.count({ where: { workspaceId: project!.workspaceId } });

      // Previous sprint velocity
      const completedSprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, isCompleted: true },
        include: { tasks: { include: { task: { select: { storyPoints: true, status: true } } } } },
        orderBy: { completedAt: "desc" },
        take: 5,
      });
      let velocity = 0;
      if (completedSprints.length > 0) {
        const totalPts = completedSprints.reduce((sum, s) => sum + s.tasks.filter(st => st.task.status === "done").reduce((p, st) => p + (st.task.storyPoints || 0), 0), 0);
        velocity = Math.round(totalPts / completedSprints.length);
      }

      const formatted = backlogTasks.map(t => ({ id: t.id, title: t.title, priority: t.priority, storyPoints: t.storyPoints, type: t.type, labels: t.labels.map((l: any) => l.label.name) }));

      try {
        const result = await sprintPlanSuggestion(formatted, teamCount, velocity, input.sprintCapacity);
        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: wsId, action: "ai.sprintPlanSuggestion", entityType: "sprint", metadata: { suggestedCount: result.suggestedTaskIds.length } });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI sprint planning failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V2 Feature 2: Weekly Digest ---
  generateWeeklyDigest: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const completedTasks = await ctx.prisma.task.findMany({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null, status: "done", completedAt: { gte: oneWeekAgo } },
        select: { title: true, assignees: { include: { user: { select: { name: true } } } } },
      });
      const createdCount = await ctx.prisma.task.count({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null, createdAt: { gte: oneWeekAgo } },
      });
      const overdueTasks = await ctx.prisma.task.findMany({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null, status: { notIn: ["done", "cancelled"] }, dueDate: { lt: new Date() } },
        select: { title: true, assignees: { include: { user: { select: { name: true } } } } },
        take: 10,
      });
      const activeSprint = await ctx.prisma.sprint.findFirst({
        where: { project: { workspaceId: input.workspaceId }, isActive: true },
        include: { tasks: { include: { task: { select: { status: true } } } } },
      });
      const workspace = await ctx.prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true } });

      // Top contributors
      const contributorMap: Record<string, number> = {};
      for (const t of completedTasks) {
        const name = t.assignees?.[0]?.user?.name || "Unassigned";
        contributorMap[name] = (contributorMap[name] || 0) + 1;
      }
      const topContributors = Object.entries(contributorMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

      let sprintProgress = null;
      if (activeSprint) {
        const total = activeSprint.tasks.length;
        const done = activeSprint.tasks.filter(st => st.task.status === "done").length;
        sprintProgress = { name: activeSprint.name, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
      }

      try {
        const result = await generateWeeklyDigest({
          completedTasks: completedTasks.map(t => ({ title: t.title, completedBy: t.assignees?.[0]?.user?.name || "Unassigned" })),
          createdTasks: createdCount,
          overdueTasks: overdueTasks.map(t => ({ title: t.title, assignee: t.assignees?.[0]?.user?.name || "Unassigned" })),
          sprintProgress,
          topContributors,
          workspaceName: workspace?.name || "Workspace",
        });
        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: input.workspaceId, action: "ai.generateWeeklyDigest", entityType: "workspace", metadata: {} });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI digest failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V2 Feature 3: Meeting Notes → Tasks ---
  extractTasksFromNotes: protectedProcedure
    .input(z.object({ notes: z.string().min(1), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId }, select: { name: true } });

      try {
        const result = await extractTasksFromNotes(input.notes, project?.name || undefined);
        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: wsId, action: "ai.extractTasksFromNotes", entityType: "task", metadata: { extractedCount: result.tasks.length } });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI extraction failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V2 Feature 4: Smart Automation Suggestions ---
  suggestAutomations: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const activities = await ctx.prisma.taskActivity.findMany({
        where: { task: { projectId: input.projectId, deletedAt: null } },
        select: { action: true, field: true, oldValue: true, newValue: true, task: { select: { type: true } }, user: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const formatted = activities.map(a => ({
        action: a.action,
        field: a.field || undefined,
        oldValue: a.oldValue || undefined,
        newValue: a.newValue || undefined,
        taskType: a.task.type,
        userId: a.user?.id || undefined,
        userName: a.user?.name || undefined,
      }));

      try {
        const result = await suggestAutomations(formatted);
        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: wsId, action: "ai.suggestAutomations", entityType: "project", metadata: { suggestionCount: result.suggestions.length } });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI automation suggestions failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V2 Feature 5: Anomaly Detection ---
  detectAnomalies: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Daily created/completed counts
      const tasks = await ctx.prisma.task.findMany({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, completedAt: true, status: true, type: true, dueDate: true, assignees: { include: { user: { select: { name: true } } } } },
      });

      const dailyCreated = new Array(30).fill(0);
      const dailyCompleted = new Array(30).fill(0);
      const now = new Date();
      for (const t of tasks) {
        const dayIdx = 29 - Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 86400000);
        if (dayIdx >= 0 && dayIdx < 30) dailyCreated[dayIdx]++;
        if (t.completedAt) {
          const cIdx = 29 - Math.floor((now.getTime() - new Date(t.completedAt).getTime()) / 86400000);
          if (cIdx >= 0 && cIdx < 30) dailyCompleted[cIdx]++;
        }
      }

      const allTasks = await ctx.prisma.task.findMany({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null, status: { notIn: ["done", "cancelled"] } },
        select: { dueDate: true, type: true, assignees: { include: { user: { select: { name: true } } } } },
      });

      const overdueCount = allTasks.filter(t => t.dueDate && new Date(t.dueDate) < now).length;
      const bugCount = allTasks.filter(t => t.type === "bug").length;
      const avgBugCount = Math.round(bugCount * 0.7); // approximate

      // Member workloads
      const workloadMap: Record<string, number> = {};
      for (const t of allTasks) {
        const name = t.assignees?.[0]?.user?.name || "Unassigned";
        workloadMap[name] = (workloadMap[name] || 0) + 1;
      }
      const memberWorkloads = Object.entries(workloadMap).map(([name, taskCount]) => ({ name, taskCount }));

      try {
        const result = await detectAnomalies({ dailyCreated, dailyCompleted, overdueCount, totalBacklog: allTasks.length, memberWorkloads, bugCount, avgBugCount });
        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: input.workspaceId, action: "ai.detectAnomalies", entityType: "workspace", metadata: { alertCount: result.alerts.length } });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI anomaly detection failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Legacy: Sprint Plan ---
  sprintPlan: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), sprintDuration: z.number().int().min(1).max(30).default(14), teamSize: z.number().int().min(1).max(50).default(3) }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");
      const tasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null, status: { in: ["backlog", "todo"] } },
        select: { id: true, title: true, status: true, priority: true, storyPoints: true },
      });
      return generateSprintPlan(tasks, input.teamSize, input.sprintDuration);
    }),
});
