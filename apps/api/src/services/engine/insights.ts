/**
 * DKFlow Intelligence Engine — Insight Generator
 * 
 * Uses patterns + embeddings + current state to generate actionable insights.
 * This is the "brain" — the part that tells users what to do.
 */

import { PrismaClient } from "@prisma/client";
import { getPatterns } from "./patterns.js";
import { semanticSearch } from "./embeddings.js";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = "openai/gpt-oss-120b";
const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

async function callAI(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");
  const res = await fetch(NVIDIA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NVIDIA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`NVIDIA API error ${res.status}`);
  const data: any = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callAIJSON<T>(systemPrompt: string, userMessage: string): Promise<T> {
  const raw = await callAI(systemPrompt, userMessage + "\n\nRespond ONLY with valid JSON. No markdown, no explanation.");
  const cleaned = raw.replace(/```json\n?|\n?```/g, "").trim();
  const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
  if (!jsonMatch) throw new Error("No valid JSON in AI response");
  return JSON.parse(jsonMatch[0]);
}

interface Insight {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  data: Record<string, any>;
  expiresAt?: Date;
}

// --- Generate daily briefing ---
export async function generateDailyBriefing(prisma: PrismaClient, workspaceId: string): Promise<Insight[]> {
  const insights: Insight[] = [];

  // 1. Sprint risk insights
  const activeSprints = await prisma.sprint.findMany({
    where: { project: { workspaceId }, isActive: true },
    include: {
      project: { select: { name: true } },
      tasks: { include: { task: { select: { id: true, title: true, status: true, storyPoints: true, assigneeId: true, dueDate: true } } } },
    },
  });

  for (const sprint of activeSprints) {
    const total = sprint.tasks.length;
    const done = sprint.tasks.filter(st => st.task.status === "done").length;
    const daysRemaining = Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86400000));
    const daysElapsed = Math.max(1, Math.ceil((Date.now() - new Date(sprint.startDate).getTime()) / 86400000));
    const dailyRate = done / daysElapsed;
    const projected = Math.round(dailyRate * (daysElapsed + daysRemaining));

    if (projected < total && daysRemaining > 0) {
      const shortfall = total - projected;
      insights.push({
        type: "risk",
        severity: shortfall > total * 0.3 ? "critical" : "warning",
        title: `Sprint "${sprint.name}" at risk`,
        description: `At current pace, ${shortfall} tasks won't be completed. ${done}/${total} done with ${daysRemaining} days left. Consider removing lower-priority tasks.`,
        data: {
          sprintId: sprint.id,
          sprintName: sprint.name,
          projectName: sprint.project.name,
          done, total, daysRemaining, projected, shortfall,
          suggestedAction: "rebalance_sprint",
        },
      });
    }
  }

  // 2. Blocker insights from patterns
  const blockerPatterns = await getPatterns(prisma, workspaceId, "blocker_signal");
  for (const p of blockerPatterns) {
    if (p.patternData.daysSinceUpdate >= 3) {
      insights.push({
        type: "anomaly",
        severity: p.patternData.daysSinceUpdate > 7 ? "critical" : "warning",
        title: `Potential blocker: "${p.patternData.taskTitle}"`,
        description: `${p.patternData.assignee}'s task hasn't been updated in ${p.patternData.daysSinceUpdate} days. This often indicates a blocker or dependency issue.`,
        data: {
          taskId: p.subjectId,
          assignee: p.patternData.assignee,
          daysSinceUpdate: p.patternData.daysSinceUpdate,
          suggestedAction: "check_in",
        },
      });
    }
  }

  // 3. Workload imbalance
  const activeTasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
      status: { in: ["todo", "in_progress", "in_review"] },
      assigneeId: { not: null },
    },
    select: { assigneeId: true, assignee: { select: { name: true } } },
  });

  const workload: Record<string, { name: string; count: number }> = {};
  for (const t of activeTasks) {
    if (!t.assigneeId) continue;
    if (!workload[t.assigneeId]) workload[t.assigneeId] = { name: t.assignee?.name || "Unknown", count: 0 };
    workload[t.assigneeId]!.count++;
  }

  const loads = Object.values(workload);
  if (loads.length >= 2) {
    const max = loads.reduce((a, b) => a.count > b.count ? a : b);
    const min = loads.reduce((a, b) => a.count < b.count ? a : b);
    if (max.count > min.count * 2.5 && max.count >= 8) {
      insights.push({
        type: "recommendation",
        severity: "warning",
        title: "Team workload imbalance detected",
        description: `${max.name} has ${max.count} active tasks while ${min.name} has only ${min.count}. Consider rebalancing to prevent burnout and improve throughput.`,
        data: {
          overloaded: { id: Object.entries(workload).find(([_, v]) => v === max)?.[0], ...max },
          underloaded: { id: Object.entries(workload).find(([_, v]) => v === min)?.[0], ...min },
          allWorkloads: loads,
          suggestedAction: "rebalance_workload",
        },
      });
    }
  }

  // 4. Overdue tasks piling up
  const overdueTasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
      status: { notIn: ["done", "cancelled"] },
      dueDate: { lt: new Date() },
    },
    select: { id: true, title: true, dueDate: true, priority: true, assignee: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: 10,
  });

  if (overdueTasks.length >= 3) {
    insights.push({
      type: "anomaly",
      severity: overdueTasks.length >= 7 ? "critical" : "warning",
      title: `${overdueTasks.length} overdue tasks need attention`,
      description: `Tasks are piling up past their due dates. Oldest overdue: "${overdueTasks[0]?.title}" (due ${overdueTasks[0]?.dueDate?.toLocaleDateString()}).`,
      data: {
        count: overdueTasks.length,
        tasks: overdueTasks.map(t => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate?.toISOString(),
          priority: t.priority,
          assignee: t.assignee?.name,
        })),
        suggestedAction: "review_overdue",
      },
    });
  }

  // 5. Estimation accuracy warning
  const estimationPatterns = await getPatterns(prisma, workspaceId, "estimation_accuracy");
  for (const p of estimationPatterns) {
    if (p.patternData.avgRatio > 1.5 && p.sampleCount >= 5) {
      insights.push({
        type: "pattern",
        severity: "info",
        title: `${p.patternData.memberName} consistently underestimates`,
        description: `Tasks take ${Math.round(p.patternData.avgRatio * 100)}% longer than estimated on average (based on ${p.sampleCount} completed tasks). Multiply estimates by ${p.patternData.avgRatio.toFixed(1)}x for better accuracy.`,
        data: {
          memberId: p.subjectId,
          memberName: p.patternData.memberName,
          avgRatio: p.patternData.avgRatio,
          typeAccuracy: p.patternData.typeAccuracy,
          suggestedAction: "adjust_estimates",
        },
      });
    }
  }

  return insights;
}

// --- Store insights in DB ---
export async function storeInsights(prisma: PrismaClient, workspaceId: string, insights: Insight[]): Promise<number> {
  // Clear old unactioned insights (older than 7 days)
  await prisma.$executeRawUnsafe(
    `DELETE FROM engine_insights WHERE workspace_id = $1::uuid AND is_actioned = FALSE AND created_at < NOW() - INTERVAL '7 days'`,
    workspaceId
  );

  let stored = 0;
  for (const insight of insights) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO engine_insights (workspace_id, type, severity, title, description, data, expires_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7)`,
      workspaceId,
      insight.type,
      insight.severity,
      insight.title,
      insight.description,
      JSON.stringify(insight.data),
      insight.expiresAt || null
    );
    stored++;
  }

  // Update engine state
  await prisma.$executeRawUnsafe(
    `UPDATE engine_state SET last_insight_generation = NOW(), total_insights = total_insights + $2, updated_at = NOW() WHERE workspace_id = $1::uuid`,
    workspaceId,
    stored
  );

  return stored;
}

// --- Get active insights for dashboard ---
export async function getActiveInsights(
  prisma: PrismaClient,
  workspaceId: string,
  options: { projectId?: string; type?: string; limit?: number } = {}
): Promise<Array<{
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  data: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}>> {
  const { projectId, type, limit = 20 } = options;

  let sql = `SELECT * FROM engine_insights WHERE workspace_id = $1::uuid AND is_actioned = FALSE AND (expires_at IS NULL OR expires_at > NOW())`;
  const params: any[] = [workspaceId];
  let idx = 2;

  if (projectId) {
    sql += ` AND project_id = $${idx}::uuid`;
    params.push(projectId);
    idx++;
  }
  if (type) {
    sql += ` AND type = $${idx}`;
    params.push(type);
    idx++;
  }

  sql += ` ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, created_at DESC LIMIT ${limit}`;

  const results: any[] = await prisma.$queryRawUnsafe(sql, ...params);
  return results.map((r: any) => ({
    id: r.id,
    type: r.type,
    severity: r.severity,
    title: r.title,
    description: r.description,
    data: r.data,
    isRead: r.is_read,
    createdAt: r.created_at?.toISOString?.() || r.created_at,
  }));
}

// --- Mark insight as read/actioned ---
export async function markInsight(
  prisma: PrismaClient,
  insightId: string,
  action: "read" | "actioned" | "dismissed",
  userId?: string
): Promise<void> {
  if (action === "read") {
    await prisma.$executeRawUnsafe(
      `UPDATE engine_insights SET is_read = TRUE WHERE id = $1::uuid`,
      insightId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `UPDATE engine_insights SET is_actioned = TRUE, actioned_by = $2::uuid, actioned_at = NOW() WHERE id = $1::uuid`,
      insightId,
      userId || null
    );
  }
}

// --- AI-powered contextual insight with memory ---
export async function askEngine(
  prisma: PrismaClient,
  workspaceId: string,
  question: string,
  projectId?: string
): Promise<{ answer: string; sources: Array<{ type: string; content: string; similarity: number }> }> {
  // Search relevant context from embeddings
  const relevantDocs = await semanticSearch(prisma, workspaceId, question, {
    projectId,
    limit: 8,
    minSimilarity: 0.4,
  });

  // Get recent patterns
  const patterns = await getPatterns(prisma, workspaceId);
  const patternContext = patterns.slice(0, 5).map(p =>
    `Pattern (${p.patternType}): ${JSON.stringify(p.patternData)}`
  ).join("\n");

  // Get active insights
  const insights = await getActiveInsights(prisma, workspaceId, { projectId, limit: 5 });
  const insightContext = insights.map(i =>
    `[${i.severity.toUpperCase()}] ${i.title}: ${i.description}`
  ).join("\n");

  const contextBlock = relevantDocs.map(d =>
    `[${d.entityType}] (relevance: ${(d.similarity * 100).toFixed(0)}%) ${d.content}`
  ).join("\n\n");

  const systemPrompt = `You are the DKFlow Intelligence Engine — an AI brain that knows everything about this project/workspace.
You have access to the project's memory (past tasks, activities, comments) and learned patterns.
Answer questions using ONLY the provided context. Be specific, reference actual data, and be actionable.
If you don't have enough data, say so honestly.`;

  const userMessage = `Question: ${question}

PROJECT MEMORY (relevant past data):
${contextBlock || "No relevant data found."}

LEARNED PATTERNS:
${patternContext || "No patterns available yet."}

CURRENT ALERTS:
${insightContext || "No active alerts."}`;

  const answer = await callAI(systemPrompt, userMessage);

  return {
    answer,
    sources: relevantDocs.map(d => ({
      type: d.entityType,
      content: d.content.slice(0, 200),
      similarity: d.similarity,
    })),
  };
}

// --- Generate full daily briefing and store ---
export async function runDailyBriefing(prisma: PrismaClient, workspaceId: string): Promise<{
  insightCount: number;
  insights: Insight[];
}> {
  console.log(`[Engine] Generating daily briefing for workspace ${workspaceId}`);

  const insights = await generateDailyBriefing(prisma, workspaceId);
  const stored = await storeInsights(prisma, workspaceId, insights);

  console.log(`[Engine] Daily briefing complete: ${stored} insights generated`);
  return { insightCount: stored, insights };
}
