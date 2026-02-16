import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { requirePermission, getWorkspaceIdFromProject, requireProjectAccess } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";

const triggerSchema = z.object({
  event: z.enum(["task_moved_to_column", "task_created", "due_date_reached", "label_added"]),
  conditions: z.record(z.any()).optional(),
});

const actionSchema = z.object({
  type: z.enum(["change_assignee", "change_priority", "add_label", "move_to_column", "send_notification"]),
  params: z.record(z.any()),
});

export const automationRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.automationRule.findMany({
        where: { projectId: input.projectId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      trigger: triggerSchema,
      actions: z.array(actionSchema).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageAutomations");
      await requireFeature(wsId, "automations");
      return ctx.prisma.automationRule.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          trigger: input.trigger as any,
          actions: input.actions as any,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional().nullable(),
      trigger: triggerSchema.optional(),
      actions: z.array(actionSchema).min(1).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automationRule.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, rule.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageAutomations");
      const { id, ...data } = input;
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.trigger !== undefined) updateData.trigger = data.trigger;
      if (data.actions !== undefined) updateData.actions = data.actions;
      return ctx.prisma.automationRule.update({ where: { id }, data: updateData });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automationRule.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, rule.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageAutomations");
      await ctx.prisma.automationRule.delete({ where: { id: input.id } });
      return { success: true };
    }),

  toggle: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const rule = await ctx.prisma.automationRule.findUniqueOrThrow({ where: { id: input.id } });
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, rule.projectId);
      await requirePermission(ctx.prisma, ctx.user.userId, wsId, "canManageAutomations");
      return ctx.prisma.automationRule.update({ where: { id: input.id }, data: { isEnabled: !rule.isEnabled } });
    }),
});
