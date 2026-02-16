import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import crypto from "node:crypto";
import { requireFeature } from "../middleware/subscription.js";

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

export const apiKeyRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.apiKey.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, keyPrefix: true, permissions: true,
          lastUsedAt: true, expiresAt: true, createdAt: true,
          user: { select: { id: true, name: true } },
        },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      name: z.string().min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "apiKeys");
      const rawKey = `dk_${crypto.randomBytes(32).toString("hex")}`;
      const keyHash = hashKey(rawKey);
      const keyPrefix = rawKey.slice(0, 11); // "dk_" + 8 chars

      await ctx.prisma.apiKey.create({
        data: {
          name: input.name,
          keyHash,
          keyPrefix,
          workspaceId: input.workspaceId,
          userId: ctx.user.userId,
        },
      });

      return { key: rawKey, prefix: keyPrefix };
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.apiKey.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
