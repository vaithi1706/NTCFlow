import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { notifyApprovalRequested } from "../services/emailNotifier.js";

export const approvalRouter = router({
  request: protectedProcedure
    .input(z.object({
      taskId: z.string().uuid(),
      approverId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.prisma.taskApproval.create({
        data: {
          taskId: input.taskId,
          requestedById: ctx.user.userId,
          approverId: input.approverId,
        },
      });
      // Email the approver
      const task = await ctx.prisma.task.findUnique({ where: { id: input.taskId }, select: { title: true, taskNumber: true, project: { select: { taskPrefix: true } } } });
      const requester = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
      if (task) {
        notifyApprovalRequested(input.approverId, requester?.name || "Someone", task.title, `${task.project.taskPrefix}-${task.taskNumber}`).catch(() => {});
      }
      return approval;
    }),

  respond: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      status: z.enum(["approved", "rejected", "changes_requested"]),
      comment: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const approval = await ctx.prisma.taskApproval.findUnique({ where: { id: input.id } });
      if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
      if (approval.approverId !== ctx.user.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only the assigned approver can respond" });
      }

      const updated = await ctx.prisma.taskApproval.update({
        where: { id: input.id },
        data: {
          status: input.status,
          comment: input.comment,
          updatedAt: new Date(),
        },
      });

      // Auto-move task to done if approved
      if (input.status === "approved") {
        const task = await ctx.prisma.task.findUnique({ where: { id: approval.taskId } });
        if (task && task.status === "in_review") {
          await ctx.prisma.task.update({
            where: { id: approval.taskId },
            data: { status: "done", completedAt: new Date() },
          });
        }
      }

      return updated;
    }),

  list: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      type: z.enum(["pending", "all"]).default("pending"),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { approverId: ctx.user.userId };
      if (input.type === "pending") where.status = "pending";

      const approvals = await ctx.prisma.taskApproval.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });

      if (approvals.length === 0) return [];

      // Get task details
      const taskIds = [...new Set(approvals.map((a) => a.taskId))];
      const tasks = await ctx.prisma.task.findMany({
        where: { id: { in: taskIds } },
        include: {
          project: { select: { id: true, name: true } },
          assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        },
      });
      const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t]));

      // Get requester details
      const requesterIds = [...new Set(approvals.map((a) => a.requestedById))];
      const requesters = await ctx.prisma.user.findMany({
        where: { id: { in: requesterIds } },
        select: { id: true, name: true, avatarUrl: true },
      });
      const requesterMap = Object.fromEntries(requesters.map((u) => [u.id, u]));

      return approvals.map((a) => ({
        ...a,
        task: taskMap[a.taskId],
        requestedBy: requesterMap[a.requestedById],
      }));
    }),

  taskApprovals: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const approvals = await ctx.prisma.taskApproval.findMany({
        where: { taskId: input.taskId },
        orderBy: { createdAt: "desc" },
      });

      const userIds = [...new Set([
        ...approvals.map((a) => a.approverId),
        ...approvals.map((a) => a.requestedById),
      ])];
      const users = await ctx.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, avatarUrl: true },
      });
      const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

      return approvals.map((a) => ({
        ...a,
        approver: userMap[a.approverId],
        requestedBy: userMap[a.requestedById],
      }));
    }),

  pendingCount: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx }) => {
      const count = await ctx.prisma.taskApproval.count({
        where: { approverId: ctx.user.userId, status: "pending" },
      });
      return { count };
    }),
});
