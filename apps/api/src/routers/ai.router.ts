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
  aiChat,
  generateSessionTitle,
  autoTriageTask,
  predictSprintRisk,
  generateStandupReport,
  calculateHealthScore,
  analyzeExcelForTasks,
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

  // --- V3 Feature 1: AI Chat ---
  chatSessions: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      const sessions = await ctx.prisma.aiChatSession.findMany({
        where: { userId: ctx.user.userId, workspaceId: input.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { content: true, role: true } } },
      });
      return sessions.map(s => ({
        id: s.id,
        title: s.title,
        projectId: s.projectId,
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        lastMessage: s.messages[0]?.content?.slice(0, 100) || null,
      }));
    }),

  chatHistory: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.aiChatSession.findUnique({ where: { id: input.sessionId } });
      if (!session || session.userId !== ctx.user.userId) throw new TRPCError({ code: "NOT_FOUND" });
      const messages = await ctx.prisma.aiChatMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "asc" },
      });
      return { session: { id: session.id, title: session.title, projectId: session.projectId }, messages: messages.map(m => ({ id: m.id, role: m.role, content: m.content, actions: m.actions, createdAt: m.createdAt.toISOString() })) };
    }),

  deleteSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.aiChatSession.findUnique({ where: { id: input.sessionId } });
      if (!session || session.userId !== ctx.user.userId) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.aiChatSession.delete({ where: { id: input.sessionId } });
      return { success: true };
    }),

  renameSession: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid(), title: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.prisma.aiChatSession.findUnique({ where: { id: input.sessionId } });
      if (!session || session.userId !== ctx.user.userId) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.prisma.aiChatSession.update({ where: { id: input.sessionId }, data: { title: input.title } });
      return { success: true };
    }),

  chat: protectedProcedure
    .input(z.object({ message: z.string().min(1), projectId: z.string().uuid().optional(), workspaceId: z.string().uuid(), sessionId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      if (input.projectId) {
        await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      }

      // Get or create session
      let sessionId = input.sessionId;
      let isNewSession = false;
      if (!sessionId) {
        const session = await ctx.prisma.aiChatSession.create({
          data: { userId: ctx.user.userId, workspaceId: input.workspaceId, projectId: input.projectId || null, title: "New Chat" },
        });
        sessionId = session.id;
        isNewSession = true;
      }

      // Save user message
      await ctx.prisma.aiChatMessage.create({
        data: { sessionId, role: "user", content: input.message },
      });

      // Load conversation history
      const history = await ctx.prisma.aiChatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { role: true, content: true },
      });

      const project = input.projectId ? await ctx.prisma.project.findUnique({ where: { id: input.projectId }, select: { name: true, workspaceId: true } }) : null;
      const columns = input.projectId ? await ctx.prisma.boardColumn.findMany({ where: { projectId: input.projectId }, select: { id: true, name: true }, orderBy: { position: "asc" } }) : [];
      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: input.workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
      const recentTasks = input.projectId ? await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, taskNumber: true, assignee: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }) : await ctx.prisma.task.findMany({
        where: { project: { workspaceId: input.workspaceId }, deletedAt: null },
        select: { id: true, title: true, status: true, priority: true, taskNumber: true, assignee: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

      try {
        // Pass conversation history (excluding the just-added user message since aiChat adds it)
        const conversationHistory = history.slice(0, -1).map(m => ({ role: m.role, content: m.content }));

        const result = await aiChat(input.message, {
          projectName: project?.name || "Workspace",
          columns: columns.map(c => ({ id: c.id, name: c.name })),
          members: members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email })),
          recentTasks: recentTasks.map(t => ({ id: t.id, title: t.title, status: t.status, assignee: t.assignee?.name || null, priority: t.priority, taskNumber: t.taskNumber })),
        }, conversationHistory);

        // Execute actions
        const actionsExecuted: Array<{ type: string; description: string; success: boolean }> = [];
        for (const action of result.actions) {
          try {
            switch (action.type) {
              case "create_task": {
                const p = action.params as any;
                const lastTask = await ctx.prisma.task.findFirst({ where: { projectId: input.projectId }, orderBy: { taskNumber: "desc" }, select: { taskNumber: true } });
                const defaultCol = await ctx.prisma.boardColumn.findFirst({ where: { projectId: input.projectId }, orderBy: { position: "asc" }, select: { id: true } });
                let assigneeId: string | undefined;
                if (p.assigneeEmail) {
                  const user = members.find(m => m.user.email.toLowerCase() === p.assigneeEmail.toLowerCase() || m.user.name.toLowerCase() === p.assigneeEmail.toLowerCase());
                  if (user) assigneeId = user.user.id;
                }
                const validPriorities = ["urgent", "high", "medium", "low", "none"];
                await ctx.prisma.task.create({
                  data: {
                    projectId: input.projectId,
                    title: p.title || "Untitled",
                    description: p.description || null,
                    priority: (validPriorities.includes(p.priority) ? p.priority : "none") as any,
                    status: "todo",
                    taskNumber: (lastTask?.taskNumber || 0) + 1,
                    columnId: defaultCol?.id || null,
                    assigneeId: assigneeId || null,
                    createdById: ctx.user.userId,
                  },
                });
                actionsExecuted.push({ type: "create_task", description: `Created task "${p.title}"`, success: true });
                break;
              }
              case "move_task": {
                const p = action.params as any;
                const col = columns.find(c => c.name.toLowerCase() === (p.columnName || "").toLowerCase());
                if (col && p.taskId) {
                  await ctx.prisma.task.update({ where: { id: p.taskId }, data: { columnId: col.id } });
                  actionsExecuted.push({ type: "move_task", description: `Moved task to "${col.name}"`, success: true });
                }
                break;
              }
              case "assign_task": {
                const p = action.params as any;
                const user = members.find(m => m.user.name.toLowerCase().includes((p.userNameOrEmail || "").toLowerCase()) || m.user.email.toLowerCase() === (p.userNameOrEmail || "").toLowerCase());
                if (user && p.taskId) {
                  await ctx.prisma.task.update({ where: { id: p.taskId }, data: { assigneeId: user.user.id } });
                  actionsExecuted.push({ type: "assign_task", description: `Assigned task to ${user.user.name}`, success: true });
                }
                break;
              }
              case "update_priority": {
                const p = action.params as any;
                const validP = ["urgent", "high", "medium", "low", "none"];
                if (p.taskId && validP.includes(p.priority)) {
                  await ctx.prisma.task.update({ where: { id: p.taskId }, data: { priority: p.priority as any } });
                  actionsExecuted.push({ type: "update_priority", description: `Updated priority to ${p.priority}`, success: true });
                }
                break;
              }
              case "create_sprint": {
                const p = action.params as any;
                if (!input.projectId) {
                  actionsExecuted.push({ type: "create_sprint", description: "Navigate to a project first to create sprints", success: false });
                  break;
                }
                const sprintName = p.name || "Sprint";
                const now = new Date();
                const startDate = p.startDate && !isNaN(Date.parse(p.startDate)) ? new Date(p.startDate) : now;
                const endDate = p.endDate && !isNaN(Date.parse(p.endDate)) ? new Date(p.endDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
                await ctx.prisma.sprint.create({
                  data: { projectId: input.projectId, name: sprintName, startDate, endDate, goal: p.goal || null },
                });
                actionsExecuted.push({ type: "create_sprint", description: `Created sprint "${sprintName}"`, success: true });
                break;
              }
              case "comment": {
                const p = action.params as any;
                if (p.taskId && p.content) {
                  await ctx.prisma.comment.create({
                    data: { taskId: p.taskId, userId: ctx.user.userId, content: p.content },
                  });
                  actionsExecuted.push({ type: "comment", description: `Added comment to task`, success: true });
                }
                break;
              }
              default:
                actionsExecuted.push({ type: action.type, description: `Unknown action type`, success: false });
            }
          } catch (err: any) {
            const friendlyMsg = err.message?.length > 100 ? "Action failed — please try again" : `Failed: ${err.message}`;
            actionsExecuted.push({ type: action.type, description: friendlyMsg, success: false });
          }
        }

        // Save assistant message
        await ctx.prisma.aiChatMessage.create({
          data: { sessionId, role: "assistant", content: result.response, actions: actionsExecuted.length > 0 ? actionsExecuted : undefined },
        });

        // Auto-title new sessions
        if (isNewSession) {
          generateSessionTitle(input.message).then(title => {
            ctx.prisma.aiChatSession.update({ where: { id: sessionId }, data: { title } }).catch(() => {});
          });
        }

        // Update session timestamp
        await ctx.prisma.aiChatSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });

        await logAudit(ctx.prisma, { userId: ctx.user.userId, workspaceId: input.workspaceId, action: "ai.chat", entityType: "project", metadata: { actionsCount: actionsExecuted.length } });
        return { response: result.response, actionsExecuted, sessionId };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI chat failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V3 Feature 2: Auto-Triage ---
  autoTriage: protectedProcedure
    .input(z.object({ taskId: z.string().uuid(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, description: true } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });

      const labels = await ctx.prisma.label.findMany({ where: { workspaceId: wsId }, select: { name: true } });
      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId }, select: { workspaceId: true } });
      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: project!.workspaceId },
        include: { user: { select: { id: true, name: true } } },
      });

      // Get recent task types for each member
      const membersWithExpertise = await Promise.all(members.map(async m => {
        const recentTasks = await ctx.prisma.task.findMany({
          where: { assigneeId: m.user.id, projectId: input.projectId, deletedAt: null },
          select: { type: true },
          take: 20,
          orderBy: { updatedAt: "desc" },
        });
        return { id: m.user.id, name: m.user.name, recentTaskTypes: [...new Set(recentTasks.map(t => t.type))] };
      }));

      try {
        const result = await autoTriageTask(task, labels.map(l => l.name), membersWithExpertise);
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI triage failed: " + (e.message || "Unknown error") });
      }
    }),

  applyTriage: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      projectId: z.string().uuid(),
      priority: z.string().optional(),
      taskType: z.string().optional(),
      assigneeId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const data: any = {};
      const validPriorities = ["urgent", "high", "medium", "low", "none"];
      const validTypes = ["bug", "feature", "story", "task", "epic"];
      if (input.priority && validPriorities.includes(input.priority)) data.priority = input.priority;
      if (input.taskType && validTypes.includes(input.taskType)) data.type = input.taskType;
      if (input.assigneeId) data.assigneeId = input.assigneeId;

      if (Object.keys(data).length > 0) {
        await ctx.prisma.task.update({ where: { id: input.taskId }, data });
      }
      return { success: true };
    }),

  // --- V3 Feature 3: Sprint Risk Predictor ---
  predictSprintRisk: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), sprintId: z.string().uuid().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      // Find active sprint or specified sprint
      const sprint = input.sprintId
        ? await ctx.prisma.sprint.findUnique({ where: { id: input.sprintId }, include: { tasks: { include: { task: { select: { status: true, storyPoints: true, completedAt: true } } } } } })
        : await ctx.prisma.sprint.findFirst({ where: { projectId: input.projectId, isActive: true }, include: { tasks: { include: { task: { select: { status: true, storyPoints: true, completedAt: true } } } } } });

      if (!sprint) throw new TRPCError({ code: "NOT_FOUND", message: "No active sprint found" });

      const totalTasks = sprint.tasks.length;
      const completedTasks = sprint.tasks.filter(st => st.task.status === "done").length;
      const totalPoints = sprint.tasks.reduce((s, st) => s + (st.task.storyPoints || 0), 0);
      const completedPoints = sprint.tasks.filter(st => st.task.status === "done").reduce((s, st) => s + (st.task.storyPoints || 0), 0);
      const daysElapsed = Math.max(1, Math.ceil((Date.now() - new Date(sprint.startDate).getTime()) / 86400000));
      const daysRemaining = Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86400000));
      const dailyCompletionRate = completedTasks / daysElapsed;

      // Historical velocity
      const completedSprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, isCompleted: true },
        include: { tasks: { include: { task: { select: { storyPoints: true, status: true } } } } },
        orderBy: { completedAt: "desc" },
        take: 3,
      });
      const historicalVelocity = completedSprints.length > 0
        ? Math.round(completedSprints.reduce((sum, s) => sum + s.tasks.filter(st => st.task.status === "done").reduce((p, st) => p + (st.task.storyPoints || 0), 0), 0) / completedSprints.length)
        : 0;

      try {
        const result = await predictSprintRisk({
          sprintName: sprint.name,
          totalTasks,
          completedTasks,
          remainingTasks: totalTasks - completedTasks,
          totalPoints,
          completedPoints,
          daysElapsed,
          daysRemaining,
          dailyCompletionRate,
          historicalVelocity,
        });
        return result;
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI risk prediction failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V3 Feature 4: Standup Report ---
  generateStandup: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), date: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const targetDate = input.date ? new Date(input.date) : new Date();
      const todayStart = new Date(targetDate); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(targetDate); todayEnd.setHours(23, 59, 59, 999);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const threeDaysAgo = new Date(todayStart); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      const project = await ctx.prisma.project.findUnique({ where: { id: input.projectId }, select: { workspaceId: true } });
      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId: project!.workspaceId },
        include: { user: { select: { id: true, name: true } } },
      });

      const memberData = await Promise.all(members.map(async m => {
        const completedYesterday = await ctx.prisma.task.findMany({
          where: { projectId: input.projectId, assigneeId: m.user.id, status: "done", completedAt: { gte: yesterdayStart, lt: todayStart }, deletedAt: null },
          select: { title: true },
        });
        const inProgressToday = await ctx.prisma.task.findMany({
          where: { projectId: input.projectId, assigneeId: m.user.id, status: { in: ["in_progress", "in_review"] }, deletedAt: null },
          select: { title: true },
        });
        const blockerTasks = await ctx.prisma.task.findMany({
          where: {
            projectId: input.projectId, assigneeId: m.user.id, deletedAt: null,
            OR: [
              { dueDate: { lt: new Date() }, status: { notIn: ["done", "cancelled"] } },
              { status: "in_progress", updatedAt: { lt: threeDaysAgo } },
            ],
          },
          select: { title: true },
        });
        return {
          userId: m.user.id,
          name: m.user.name,
          completedYesterday: completedYesterday.map(t => t.title),
          inProgressToday: inProgressToday.map(t => t.title),
          blockers: blockerTasks.map(t => t.title),
        };
      }));

      try {
        const result = await generateStandupReport(memberData);
        return { date: targetDate.toISOString().split("T")[0], ...result };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI standup generation failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- V3 Feature 5: Project Health Score ---
  projectHealthScore: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      // Active tasks
      const allTasks = await ctx.prisma.task.findMany({
        where: { projectId: input.projectId, deletedAt: null },
        select: { status: true, priority: true, type: true, dueDate: true, assigneeId: true, storyPoints: true, createdAt: true, completedAt: true },
      });

      const activeTasks = allTasks.filter(t => !["done", "cancelled"].includes(t.status));
      const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
      const overduePercentage = activeTasks.length > 0 ? overdueTasks.length / activeTasks.length : 0;
      const bugRatio = allTasks.length > 0 ? allTasks.filter(t => t.type === "bug").length / allTasks.length : 0;

      // Team balance
      const memberTaskCounts: Record<string, number> = {};
      activeTasks.forEach(t => { if (t.assigneeId) memberTaskCounts[t.assigneeId] = (memberTaskCounts[t.assigneeId] || 0) + 1; });
      const counts = Object.values(memberTaskCounts);
      const mean = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
      const stdDev = counts.length > 1 ? Math.sqrt(counts.reduce((s, c) => s + Math.pow(c - mean, 2), 0) / counts.length) : 0;

      // Completion rate this week
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const completedThisWeek = allTasks.filter(t => t.completedAt && new Date(t.completedAt) >= weekAgo).length;
      const createdThisWeek = allTasks.filter(t => new Date(t.createdAt) >= weekAgo).length;
      const completionRate = createdThisWeek > 0 ? completedThisWeek / createdThisWeek : completedThisWeek > 0 ? 1 : 0.5;

      // Velocity trend
      const completedSprints = await ctx.prisma.sprint.findMany({
        where: { projectId: input.projectId, isCompleted: true },
        include: { tasks: { include: { task: { select: { storyPoints: true, status: true } } } } },
        orderBy: { completedAt: "desc" },
        take: 3,
      });
      const sprintVelocities = completedSprints.map(s => s.tasks.filter(st => st.task.status === "done").reduce((p, st) => p + (st.task.storyPoints || 0), 0));
      let velocityTrend = "stable";
      if (sprintVelocities.length >= 2) {
        if (sprintVelocities[0]! > sprintVelocities[1]!) velocityTrend = "improving";
        else if (sprintVelocities[0]! < sprintVelocities[1]!) velocityTrend = "declining";
      }

      // Sprint progress
      const activeSprint = await ctx.prisma.sprint.findFirst({
        where: { projectId: input.projectId, isActive: true },
        include: { tasks: { include: { task: { select: { status: true } } } } },
      });
      let sprintProgress = 0.5;
      if (activeSprint && activeSprint.tasks.length > 0) {
        sprintProgress = activeSprint.tasks.filter(st => st.task.status === "done").length / activeSprint.tasks.length;
      }

      try {
        const result = await calculateHealthScore({
          velocityTrend,
          overduePercentage,
          bugRatio,
          teamBalanceStdDev: stdDev,
          completionRate: Math.min(1, completionRate),
          sprintProgress,
        });

        return {
          ...result,
          metrics: {
            velocity: { trend: velocityTrend, values: sprintVelocities },
            overdue: { percentage: overduePercentage, count: overdueTasks.length, total: activeTasks.length },
            bugs: { ratio: bugRatio, count: allTasks.filter(t => t.type === "bug").length },
            teamBalance: { stdDev, memberCounts: memberTaskCounts },
            completionRate: { rate: completionRate, completed: completedThisWeek, created: createdThisWeek },
          },
        };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI health score failed: " + (e.message || "Unknown error") });
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

  // --- Excel Import: Analyze ---
  importExcel: protectedProcedure
    .input(z.object({ fileUrl: z.string(), projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      const fs = await import("fs");
      const path = await import("path");
      const XLSX = await import("xlsx");

      // Resolve file path
      let filePath = input.fileUrl;
      if (filePath.startsWith("/uploads/")) {
        filePath = path.join("/home/ubuntu/dkflow/uploads", filePath.replace("/uploads/", ""));
      }
      if (!fs.existsSync(filePath)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
      }

      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer);
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) throw new TRPCError({ code: "BAD_REQUEST", message: "Empty spreadsheet" });

      const sheet = workbook.Sheets[sheetName]!;
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No data rows found" });
      }

      const headers = Object.keys(rows[0]!);
      const totalRows = rows.length;
      const limitedRows = rows.slice(0, 100);
      const warning = totalRows > 100 ? `Showing first 100 of ${totalRows} rows` : undefined;

      try {
        const result = await analyzeExcelForTasks(headers, limitedRows);
        await logAudit(ctx.prisma, {
          userId: ctx.user.userId,
          workspaceId: wsId,
          action: "ai.importExcel",
          entityType: "task",
          metadata: { totalRows, analyzedRows: limitedRows.length, detectedTasks: result.tasks.length },
        });
        return { ...result, totalRows, warning };
      } catch (e: any) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI analysis failed: " + (e.message || "Unknown error") });
      }
    }),

  // --- Excel Import: Confirm & Create Tasks ---
  confirmImportTasks: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      tasks: z.array(z.object({
        title: z.string(),
        description: z.string(),
        type: z.string(),
        priority: z.string(),
        labels: z.array(z.string()),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "ai");

      // Get default column (first / To Do)
      const defaultColumn = await ctx.prisma.boardColumn.findFirst({
        where: { projectId: input.projectId },
        orderBy: { position: "asc" },
        select: { id: true },
      });

      // Get next task number
      const lastTask = await ctx.prisma.task.findFirst({
        where: { projectId: input.projectId },
        orderBy: { taskNumber: "desc" },
        select: { taskNumber: true },
      });
      let nextNumber = (lastTask?.taskNumber || 0) + 1;

      const validPriorities = ["urgent", "high", "medium", "low", "none"];
      const validTypes = ["bug", "feature", "story", "task", "epic"];
      const taskIds: string[] = [];

      for (const t of input.tasks) {
        // Find or create labels
        const labelIds: string[] = [];
        for (const labelName of t.labels) {
          if (!labelName?.trim()) continue;
          let label = await ctx.prisma.label.findFirst({
            where: { projectId: input.projectId, name: { equals: labelName.trim(), mode: "insensitive" } },
          });
          if (!label) {
            const colors = ["#8B5CF6", "#EC4899", "#F59E0B", "#10B981", "#3B82F6", "#EF4444"];
            label = await ctx.prisma.label.create({
              data: { projectId: input.projectId, name: labelName.trim(), color: colors[Math.floor(Math.random() * colors.length)]! },
            });
          }
          labelIds.push(label.id);
        }

        const task = await ctx.prisma.task.create({
          data: {
            projectId: input.projectId,
            columnId: defaultColumn?.id || null,
            title: t.title.slice(0, 500),
            description: t.description,
            type: (validTypes.includes(t.type) ? t.type : "task") as any,
            priority: (validPriorities.includes(t.priority) ? t.priority : "medium") as any,
            taskNumber: nextNumber++,
            status: "todo",
            createdById: ctx.user.userId,
            labels: labelIds.length > 0 ? {
              create: labelIds.map(labelId => ({ labelId })),
            } : undefined,
          },
        });
        taskIds.push(task.id);
      }

      await logAudit(ctx.prisma, {
        userId: ctx.user.userId,
        workspaceId: wsId,
        action: "ai.confirmImportTasks",
        entityType: "task",
        metadata: { created: taskIds.length },
      });

      return { created: taskIds.length, taskIds };
    }),
});
