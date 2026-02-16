import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import crypto from "node:crypto";
import { requireFeature } from "../middleware/subscription.js";

const WEBHOOK_EVENTS = [
  "task.created", "task.updated", "task.deleted",
  "comment.created", "sprint.started", "sprint.completed",
] as const;

export const webhookRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.webhook.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(100),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      secret: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "webhooks");
      return ctx.prisma.webhook.create({ data: input });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      secret: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.webhook.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.webhook.delete({ where: { id: input.id } });
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const webhook = await ctx.prisma.webhook.findUniqueOrThrow({ where: { id: input.id } });
      const body = JSON.stringify({
        event: "test",
        timestamp: new Date().toISOString(),
        data: { message: "This is a test webhook from DKFlow" },
      });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (webhook.secret) {
        const sig = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");
        headers["X-DKFlow-Signature"] = `sha256=${sig}`;
      }
      const res = await fetch(webhook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new TRPCError({ code: "BAD_REQUEST", message: `Webhook returned ${res.status}` });
      await ctx.prisma.webhook.update({ where: { id: input.id }, data: { lastTriggeredAt: new Date() } });
      return { success: true, status: res.status };
    }),

  getEvents: protectedProcedure.query(() => {
    return WEBHOOK_EVENTS;
  }),
});
