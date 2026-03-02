/**
 * DKFlow Intelligence Engine — API Router
 * 
 * Exposes engine capabilities via tRPC endpoints.
 * All endpoints require authentication and workspace access.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requireFeature } from "../middleware/subscription.js";
import {
  runEngineCycle,
  getEngineStatus,
  getActiveInsights,
  markInsight,
  askEngine,
  semanticSearch,
  getPatterns,
  getEmbeddingStats,
  fullSync,
  analyzePatterns,
  runDailyBriefing,
} from "../services/engine/index.js";

export const engineRouter = router({
  // --- Engine Status ---
  status: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getEngineStatus(ctx.prisma, input.workspaceId);
    }),

  // --- Initialize / Run Full Cycle ---
  initialize: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        const result = await runEngineCycle(ctx.prisma, input.workspaceId);
        return { success: true, ...result };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Engine initialization failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Sync Only (Embeddings) ---
  sync: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        const result = await fullSync(ctx.prisma, input.workspaceId);
        return { success: true, ...result };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Engine sync failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Analyze Patterns ---
  analyzePatterns: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        const result = await analyzePatterns(ctx.prisma, input.workspaceId);
        return { success: true, ...result };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Pattern analysis failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Generate Insights ---
  generateInsights: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        const result = await runDailyBriefing(ctx.prisma, input.workspaceId);
        return { success: true, ...result };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Insight generation failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Get Active Insights (Dashboard) ---
  insights: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
      type: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      return getActiveInsights(ctx.prisma, input.workspaceId, {
        projectId: input.projectId,
        type: input.type,
        limit: input.limit,
      });
    }),

  // --- Mark Insight ---
  markInsight: protectedProcedure
    .input(z.object({
      insightId: z.string().uuid(),
      action: z.enum(["read", "actioned", "dismissed"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await markInsight(ctx.prisma, input.insightId, input.action, ctx.user.userId);
      return { success: true };
    }),

  // --- Ask Engine (RAG-powered Q&A) ---
  ask: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      question: z.string().min(1),
      projectId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        return await askEngine(ctx.prisma, input.workspaceId, input.question, input.projectId);
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Engine query failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Semantic Search ---
  search: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      query: z.string().min(1),
      projectId: z.string().uuid().optional(),
      entityType: z.string().optional(),
      limit: z.number().int().min(1).max(30).default(10),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "ai");
      try {
        const results = await semanticSearch(ctx.prisma, input.workspaceId, input.query, {
          projectId: input.projectId,
          entityType: input.entityType,
          limit: input.limit,
        });
        return { results };
      } catch (e: any) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Semantic search failed: " + (e.message || "Unknown error"),
        });
      }
    }),

  // --- Get Patterns ---
  patterns: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      patternType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getPatterns(ctx.prisma, input.workspaceId, input.patternType);
    }),

  // --- Embedding Stats ---
  embeddingStats: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getEmbeddingStats(ctx.prisma, input.workspaceId);
    }),
});
