/**
 * DKFlow Intelligence Engine — Main Entry Point
 * 
 * Orchestrates: Sync → Patterns → Insights
 * Can run as background worker or on-demand.
 */

import { PrismaClient } from "@prisma/client";
import { fullSync } from "./sync.js";
import { analyzePatterns, getPatterns } from "./patterns.js";
import { runDailyBriefing, getActiveInsights, markInsight, askEngine } from "./insights.js";
import { semanticSearch, getEmbeddingStats } from "./embeddings.js";

export {
  fullSync,
  analyzePatterns,
  getPatterns,
  runDailyBriefing,
  getActiveInsights,
  markInsight,
  askEngine,
  semanticSearch,
  getEmbeddingStats,
};

// --- Run the full engine cycle ---
export async function runEngineCycle(prisma: PrismaClient, workspaceId: string): Promise<{
  sync: { tasks: number; comments: number; activities: number; sprints: number; total: number };
  patterns: { total: number };
  insights: { insightCount: number };
}> {
  console.log(`[Engine] ═══════════════════════════════════════`);
  console.log(`[Engine] Starting full engine cycle for workspace ${workspaceId}`);
  console.log(`[Engine] ═══════════════════════════════════════`);

  // Step 1: Sync data into embeddings
  const sync = await fullSync(prisma, workspaceId);

  // Step 2: Analyze patterns
  const patterns = await analyzePatterns(prisma, workspaceId);

  // Step 3: Generate insights
  const insights = await runDailyBriefing(prisma, workspaceId);

  console.log(`[Engine] ═══════════════════════════════════════`);
  console.log(`[Engine] Cycle complete:`);
  console.log(`[Engine]   Embeddings: ${sync.total} new`);
  console.log(`[Engine]   Patterns: ${patterns.total} found`);
  console.log(`[Engine]   Insights: ${insights.insightCount} generated`);
  console.log(`[Engine] ═══════════════════════════════════════`);

  return { sync, patterns: { total: patterns.total }, insights: { insightCount: insights.insightCount } };
}

// --- Get engine status ---
export async function getEngineStatus(prisma: PrismaClient, workspaceId: string): Promise<{
  initialized: boolean;
  lastSync: string | null;
  lastAnalysis: string | null;
  lastInsights: string | null;
  totalEmbeddings: number;
  totalPatterns: number;
  totalInsights: number;
  config: Record<string, any>;
  embeddingStats: { total: number; byType: Record<string, number> };
}> {
  const state: any[] = await prisma.$queryRawUnsafe(
    `SELECT * FROM engine_state WHERE workspace_id = $1::uuid`,
    workspaceId
  );

  const stats = await getEmbeddingStats(prisma, workspaceId);

  if (state.length === 0) {
    return {
      initialized: false,
      lastSync: null,
      lastAnalysis: null,
      lastInsights: null,
      totalEmbeddings: 0,
      totalPatterns: 0,
      totalInsights: 0,
      config: {},
      embeddingStats: stats,
    };
  }

  const s = state[0];
  return {
    initialized: true,
    lastSync: s.last_embedding_sync?.toISOString() || null,
    lastAnalysis: s.last_pattern_analysis?.toISOString() || null,
    lastInsights: s.last_insight_generation?.toISOString() || null,
    totalEmbeddings: s.total_embeddings || 0,
    totalPatterns: s.total_patterns || 0,
    totalInsights: s.total_insights || 0,
    config: s.config || {},
    embeddingStats: stats,
  };
}
