import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { TRPCError } from "@trpc/server";

export const resourcePlanningRouter = router({
  // Get resource overview for all members
  getOverview: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        startDate: z.string().optional(), // ISO date string
        endDate: z.string().optional(),
        projectId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { workspaceId, projectId } = input;

      const now = new Date();
      const start = input.startDate ? new Date(input.startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = input.endDate ? new Date(input.endDate) : new Date(start.getTime() + 14 * 86400000); // 2 weeks default

      // Get all workspace members
      const members = await ctx.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });

      // Get capacity settings
      const capacities = await ctx.prisma.resourceCapacity.findMany({
        where: { workspaceId },
      });
      const capacityMap = new Map(capacities.map((c) => [c.userId, c]));

      // Get all active tasks with assignees in date range
      const taskWhere: any = {
        project: { workspaceId },
        deletedAt: null,
        status: { notIn: ["done", "cancelled"] },
        assignees: { some: {} },
      };
      if (projectId) taskWhere.projectId = projectId;

      const tasks = await ctx.prisma.task.findMany({
        where: taskWhere,
        select: {
          id: true,
          title: true,
          taskNumber: true,
          status: true,
          priority: true,
          estimateHours: true,
          dueDate: true,
          startDate: true,
          storyPoints: true,
          projectId: true,
          project: { select: { id: true, name: true, color: true } },
          assignees: { select: { userId: true } },
        },
      });

      // Build per-member resource data
      const memberResources = members.map((m) => {
        const cap = capacityMap.get(m.user.id);
        const hoursPerDay = cap?.hoursPerDay || 8;
        const workingDays = cap?.workingDays || [1, 2, 3, 4, 5];

        // Calculate working days in range
        let totalWorkingDays = 0;
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          if (workingDays.includes(d.getDay())) totalWorkingDays++;
        }

        // Check time off
        let timeOffDays = 0;
        if (cap?.timeOffStart && cap?.timeOffEnd) {
          const offStart = new Date(cap.timeOffStart);
          const offEnd = new Date(cap.timeOffEnd);
          for (let d = new Date(Math.max(start.getTime(), offStart.getTime())); d <= new Date(Math.min(end.getTime(), offEnd.getTime())); d.setDate(d.getDate() + 1)) {
            if (workingDays.includes(d.getDay())) timeOffDays++;
          }
        }

        const availableDays = totalWorkingDays - timeOffDays;
        const totalCapacityHours = availableDays * hoursPerDay;

        // Assigned tasks
        const assignedTasks = tasks.filter((t) => t.assignees.some((a) => a.userId === m.user.id));
        const totalAllocatedHours = assignedTasks.reduce((s, t) => s + (t.estimateHours || 0), 0);
        const totalStoryPoints = assignedTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
        const taskCount = assignedTasks.length;

        // Utilization
        const utilization = totalCapacityHours > 0 ? Math.round((totalAllocatedHours / totalCapacityHours) * 100) : 0;

        // Status
        let status: "underloaded" | "optimal" | "overloaded" | "on_leave" = "optimal";
        if (timeOffDays >= availableDays + timeOffDays) {
          status = "on_leave";
        } else if (utilization > 100) {
          status = "overloaded";
        } else if (utilization < 50) {
          status = "underloaded";
        }

        // Overdue count
        const overdueCount = assignedTasks.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;

        // Tasks by priority
        const byPriority = {
          urgent: assignedTasks.filter((t) => t.priority === "urgent").length,
          high: assignedTasks.filter((t) => t.priority === "high").length,
          medium: assignedTasks.filter((t) => t.priority === "medium").length,
          low: assignedTasks.filter((t) => t.priority === "low").length,
          none: assignedTasks.filter((t) => t.priority === "none").length,
        };

        // Tasks by project
        const projectMap: Record<string, { name: string; color: string | null; count: number; hours: number }> = {};
        for (const t of assignedTasks) {
          if (!projectMap[t.projectId]) {
            projectMap[t.projectId] = { name: t.project.name, color: t.project.color, count: 0, hours: 0 };
          }
          projectMap[t.projectId].count++;
          projectMap[t.projectId].hours += t.estimateHours || 0;
        }

        return {
          user: m.user,
          role: m.role,
          capacity: {
            hoursPerDay,
            workingDays,
            totalCapacityHours,
            availableDays,
            timeOffDays,
            isOnLeave: cap?.timeOffStart && cap?.timeOffEnd
              ? new Date(cap.timeOffStart) <= now && new Date(cap.timeOffEnd) >= now
              : false,
          },
          allocation: {
            totalAllocatedHours,
            totalStoryPoints,
            taskCount,
            overdueCount,
            utilization,
            remainingHours: Math.max(0, totalCapacityHours - totalAllocatedHours),
          },
          status,
          byPriority,
          byProject: Object.values(projectMap),
          tasks: assignedTasks.map((t) => ({
            id: t.id,
            title: t.title,
            taskNumber: t.taskNumber,
            status: t.status,
            priority: t.priority,
            estimateHours: t.estimateHours,
            dueDate: t.dueDate?.toISOString(),
            project: t.project,
          })),
        };
      });

      // Summary stats
      const totalMembers = memberResources.length;
      const overloaded = memberResources.filter((m) => m.status === "overloaded").length;
      const underloaded = memberResources.filter((m) => m.status === "underloaded").length;
      const onLeave = memberResources.filter((m) => m.status === "on_leave").length;
      const avgUtilization = totalMembers > 0
        ? Math.round(memberResources.reduce((s, m) => s + m.allocation.utilization, 0) / totalMembers)
        : 0;
      const totalCapacity = memberResources.reduce((s, m) => s + m.capacity.totalCapacityHours, 0);
      const totalAllocated = memberResources.reduce((s, m) => s + m.allocation.totalAllocatedHours, 0);

      return {
        summary: {
          totalMembers,
          overloaded,
          underloaded,
          onLeave,
          avgUtilization,
          totalCapacityHours: totalCapacity,
          totalAllocatedHours: totalAllocated,
          totalRemainingHours: Math.max(0, totalCapacity - totalAllocated),
        },
        members: memberResources.sort((a, b) => b.allocation.utilization - a.allocation.utilization),
        dateRange: { start: start.toISOString(), end: end.toISOString() },
      };
    }),

  // Get/update capacity settings for a user
  getCapacity: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.resourceCapacity.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      });
    }),

  updateCapacity: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        hoursPerDay: z.number().min(1).max(24).optional(),
        workingDays: z.array(z.number().min(0).max(6)).optional(),
        timeOffStart: z.string().nullable().optional(),
        timeOffEnd: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, userId, ...data } = input;
      const updateData: any = {};

      if (data.hoursPerDay !== undefined) updateData.hoursPerDay = data.hoursPerDay;
      if (data.workingDays !== undefined) updateData.workingDays = data.workingDays;
      if (data.timeOffStart !== undefined) updateData.timeOffStart = data.timeOffStart ? new Date(data.timeOffStart) : null;
      if (data.timeOffEnd !== undefined) updateData.timeOffEnd = data.timeOffEnd ? new Date(data.timeOffEnd) : null;
      if (data.notes !== undefined) updateData.notes = data.notes;

      return ctx.prisma.resourceCapacity.upsert({
        where: { workspaceId_userId: { workspaceId, userId } },
        update: updateData,
        create: { workspaceId, userId, ...updateData },
      });
    }),

  // Get daily breakdown for a specific member
  getMemberTimeline: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        userId: z.string().uuid(),
        startDate: z.string(),
        endDate: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);

      const cap = await ctx.prisma.resourceCapacity.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: input.userId } },
      });

      const hoursPerDay = cap?.hoursPerDay || 8;
      const workingDays = cap?.workingDays || [1, 2, 3, 4, 5];

      // Get tasks
      const tasks = await ctx.prisma.task.findMany({
        where: {
          project: { workspaceId: input.workspaceId },
          deletedAt: null,
          status: { notIn: ["done", "cancelled"] },
          assignees: { some: { userId: input.userId } },
        },
        select: {
          id: true,
          title: true,
          taskNumber: true,
          estimateHours: true,
          dueDate: true,
          startDate: true,
          priority: true,
          status: true,
          project: { select: { name: true, color: true } },
        },
      });

      // Build daily breakdown
      const days: {
        date: string;
        dayOfWeek: number;
        isWorkingDay: boolean;
        isTimeOff: boolean;
        capacityHours: number;
        allocatedHours: number;
        tasks: { id: string; title: string; hours: number; priority: string }[];
      }[] = [];

      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        const dayOfWeek = d.getDay();
        const isWorkingDay = workingDays.includes(dayOfWeek);
        const dateStr = d.toISOString().split("T")[0];

        let isTimeOff = false;
        if (cap?.timeOffStart && cap?.timeOffEnd) {
          isTimeOff = d >= new Date(cap.timeOffStart) && d <= new Date(cap.timeOffEnd);
        }

        // Simple allocation: distribute task hours across working days until due date
        const dayTasks = tasks
          .filter((t) => {
            const taskStart = t.startDate ? new Date(t.startDate) : new Date(0);
            const taskEnd = t.dueDate ? new Date(t.dueDate) : new Date(9999, 11);
            return d >= taskStart && d <= taskEnd;
          })
          .map((t) => {
            // Estimate daily hours: total estimate / working days until due
            const taskEnd = t.dueDate ? new Date(t.dueDate) : end;
            const taskStart = t.startDate ? new Date(t.startDate) : start;
            let wDays = 0;
            for (let dd = new Date(taskStart); dd <= taskEnd; dd.setDate(dd.getDate() + 1)) {
              if (workingDays.includes(dd.getDay())) wDays++;
            }
            const dailyHours = wDays > 0 ? (t.estimateHours || 0) / wDays : 0;
            return { id: t.id, title: t.title, hours: Math.round(dailyHours * 10) / 10, priority: t.priority };
          });

        const allocatedHours = dayTasks.reduce((s, t) => s + t.hours, 0);

        days.push({
          date: dateStr,
          dayOfWeek,
          isWorkingDay,
          isTimeOff,
          capacityHours: isWorkingDay && !isTimeOff ? hoursPerDay : 0,
          allocatedHours: isWorkingDay && !isTimeOff ? Math.round(allocatedHours * 10) / 10 : 0,
          tasks: dayTasks,
        });
      }

      return { days, hoursPerDay, workingDays };
    }),
});
