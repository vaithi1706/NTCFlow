import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { sendTestMessage } from "../services/integrations.js";
import { requireFeature } from "../middleware/subscription.js";

const integrationTypeEnum = z.enum(["slack", "teams"]);

const VALID_EVENTS = [
  "task.created", "task.completed", "task.assigned",
  "comment.created", "sprint.started", "sprint.completed",
] as const;

export const integrationRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.integration.findMany({
        where: { workspaceId: input.workspaceId },
        include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      type: integrationTypeEnum,
      name: z.string().min(1).max(100),
      webhookUrl: z.string().url(),
      channel: z.string().max(200).optional(),
      events: z.array(z.enum(VALID_EVENTS)).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "integrations");
      return ctx.prisma.integration.create({
        data: {
          workspaceId: input.workspaceId,
          type: input.type,
          name: input.name,
          webhookUrl: input.webhookUrl,
          channel: input.channel,
          events: input.events,
          createdById: ctx.user.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      webhookUrl: z.string().url().optional(),
      channel: z.string().max(200).optional(),
      events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.integration.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.integration.delete({ where: { id: input.id } });
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const intg = await ctx.prisma.integration.findUniqueOrThrow({ where: { id: input.id } });
      try {
        await sendTestMessage(intg.webhookUrl, intg.type);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message || "Failed to send test message" });
      }
    }),
});
