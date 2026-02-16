
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const DEFAULT_WORKFLOW = [
  { name: "Backlog", category: "todo", color: "#6B7280", position: 0 },
  { name: "To Do", category: "todo", color: "#94A3B8", position: 1 },
  { name: "In Progress", category: "in_progress", color: "#3B82F6", position: 2 },
  { name: "In Review", category: "in_progress", color: "#F59E0B", position: 3 },
  { name: "Done", category: "done", color: "#10B981", position: 4 },
];

export async function seedDefaultWorkflow(prisma: any, projectId: string) {
  const existing = await prisma.workflowStatus.findFirst({ where: { projectId } });
  if (existing) return;

  const statuses = await Promise.all(
    DEFAULT_WORKFLOW.map((s) =>
      prisma.workflowStatus.create({
        data: { ...s, projectId },
      })
    )
  );

  // Create all-to-all transitions
  const transitions: { fromStatusId: string; toStatusId: string }[] = [];
  for (const from of statuses) {
    for (const to of statuses) {
      if (from.id !== to.id) {
        transitions.push({ fromStatusId: from.id, toStatusId: to.id });
      }
    }
  }
  await prisma.workflowTransition.createMany({ data: transitions });
}

export const workflowRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.workflowStatus.findMany({
        where: { projectId: input.projectId },
        include: {
          transitions: { include: { toStatus: { select: { id: true, name: true } } } },
        },
        orderBy: { position: "asc" },
      });
    }),

  createStatus: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(50),
      category: z.enum(["todo", "in_progress", "done"]).default("todo"),
      color: z.string().default("#94A3B8"),
    }))
    .mutation(async ({ ctx, input }) => {
      const maxPos = await ctx.prisma.workflowStatus.aggregate({
        where: { projectId: input.projectId },
        _max: { position: true },
      });
      return ctx.prisma.workflowStatus.create({
        data: {
          name: input.name,
          category: input.category,
          color: input.color,
          position: (maxPos._max.position ?? -1) + 1,
          projectId: input.projectId,
        },
      });
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(50).optional(),
      category: z.enum(["todo", "in_progress", "done"]).optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.workflowStatus.update({ where: { id }, data });
    }),

  deleteStatus: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Could check if tasks use this status, but since tasks use TaskStatus enum not WorkflowStatus,
      // we can safely delete
      await ctx.prisma.workflowStatus.delete({ where: { id: input.id } });
      return { success: true };
    }),

  reorderStatuses: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      statusIds: z.array(z.string().uuid()),
    }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.statusIds.map((id, index) =>
          ctx.prisma.workflowStatus.update({ where: { id }, data: { position: index } })
        )
      );
      return { success: true };
    }),

  getTransitions: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.workflowTransition.findMany({
        where: { fromStatus: { projectId: input.projectId } },
        include: {
          fromStatus: { select: { id: true, name: true } },
          toStatus: { select: { id: true, name: true } },
        },
      });
    }),

  addTransition: protectedProcedure
    .input(z.object({
      fromStatusId: z.string().uuid(),
      toStatusId: z.string().uuid(),
      name: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.workflowTransition.create({ data: input });
    }),

  removeTransition: protectedProcedure
    .input(z.object({ fromStatusId: z.string().uuid(), toStatusId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.workflowTransition.delete({
        where: { fromStatusId_toStatusId: { fromStatusId: input.fromStatusId, toStatusId: input.toStatusId } },
      });
      return { success: true };
    }),

  getAvailableTransitions: protectedProcedure
    .input(z.object({ projectId: z.string().uuid(), currentStatusName: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentStatus = await ctx.prisma.workflowStatus.findFirst({
        where: { projectId: input.projectId, name: input.currentStatusName },
      });
      if (!currentStatus) return [];
      const transitions = await ctx.prisma.workflowTransition.findMany({
        where: { fromStatusId: currentStatus.id },
        include: { toStatus: true },
      });
      return transitions.map((t) => t.toStatus);
    }),

  seedDefaults: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await seedDefaultWorkflow(ctx.prisma, input.projectId);
      return { success: true };
    }),
});
