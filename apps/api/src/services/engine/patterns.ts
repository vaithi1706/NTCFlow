/**
 * DKFlow Intelligence Engine — Pattern Recognition
 * 
 * Analyzes historical data to find patterns:
 * - Estimation accuracy per developer
 * - Team velocity trends
 * - Member strengths/weaknesses
 * - Blocker signals
 * - Completion patterns (time of day, day of week)
 */

import { PrismaClient } from "@prisma/client";

interface Pattern {
  patternType: string;
  subjectId?: string;
  subjectType?: string;
  patternData: Record<string, any>;
  confidence: number;
  sampleCount: number;
}

// --- Analyze estimation accuracy per member ---
async function analyzeEstimationAccuracy(prisma: PrismaClient, workspaceId: string): Promise<Pattern[]> {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
      status: "done",
      storyPoints: { not: null },
      completedAt: { not: null },
    },
    select: {
      id: true,
      storyPoints: true,
      createdAt: true,
      completedAt: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      type: true,
    },
  });

  // Group by assignee
  const byMember: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    if (!byMember[t.assigneeId]) byMember[t.assigneeId] = [];
    byMember[t.assigneeId]!.push(t);
  }

  const patterns: Pattern[] = [];
  for (const [memberId, memberTasks] of Object.entries(byMember)) {
    if (memberTasks.length < 3) continue; // Need minimum data

    const estimations = memberTasks.map(t => {
      const actualDays = Math.ceil((new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / 86400000);
      const estimatedDays = (t.storyPoints || 1) * 1.5; // rough conversion
      return {
        estimated: estimatedDays,
        actual: actualDays,
        ratio: actualDays / estimatedDays,
        type: t.type,
      };
    });

    const avgRatio = estimations.reduce((s, e) => s + e.ratio, 0) / estimations.length;
    const memberName = memberTasks[0]?.assignee?.name || "Unknown";

    // By task type
    const byType: Record<string, number[]> = {};
    for (const e of estimations) {
      if (!byType[e.type]) byType[e.type] = [];
      byType[e.type]!.push(e.ratio);
    }
    const typeAccuracy: Record<string, number> = {};
    for (const [type, ratios] of Object.entries(byType)) {
      typeAccuracy[type] = ratios.reduce((s, r) => s + r, 0) / ratios.length;
    }

    patterns.push({
      patternType: "estimation_accuracy",
      subjectId: memberId,
      subjectType: "member",
      patternData: {
        memberName,
        avgRatio, // >1 = underestimates, <1 = overestimates
        tendency: avgRatio > 1.3 ? "underestimates" : avgRatio < 0.7 ? "overestimates" : "accurate",
        typeAccuracy,
        totalTasks: memberTasks.length,
      },
      confidence: Math.min(0.9, memberTasks.length / 20), // more data = more confident
      sampleCount: memberTasks.length,
    });
  }

  return patterns;
}

// --- Analyze member strengths ---
async function analyzeMemberStrengths(prisma: PrismaClient, workspaceId: string): Promise<Pattern[]> {
  const tasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
      status: "done",
      assigneeId: { not: null },
    },
    select: {
      assigneeId: true,
      assignee: { select: { name: true } },
      type: true,
      labels: { include: { label: { select: { name: true } } } },
      createdAt: true,
      completedAt: true,
      storyPoints: true,
    },
  });

  const byMember: Record<string, typeof tasks> = {};
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    if (!byMember[t.assigneeId]) byMember[t.assigneeId] = [];
    byMember[t.assigneeId]!.push(t);
  }

  const patterns: Pattern[] = [];
  for (const [memberId, memberTasks] of Object.entries(byMember)) {
    if (memberTasks.length < 5) continue;

    // Count task types
    const typeCounts: Record<string, number> = {};
    const labelCounts: Record<string, number> = {};
    let totalPoints = 0;
    let totalDays = 0;

    for (const t of memberTasks) {
      typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
      for (const l of t.labels) {
        labelCounts[l.label.name] = (labelCounts[l.label.name] || 0) + 1;
      }
      totalPoints += t.storyPoints || 1;
      if (t.completedAt) {
        totalDays += Math.ceil((new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / 86400000);
      }
    }

    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const topLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const avgDaysPerPoint = totalPoints > 0 ? totalDays / totalPoints : 0;
    const memberName = memberTasks[0]?.assignee?.name || "Unknown";

    patterns.push({
      patternType: "member_strength",
      subjectId: memberId,
      subjectType: "member",
      patternData: {
        memberName,
        totalCompleted: memberTasks.length,
        totalPoints,
        avgDaysPerPoint: Math.round(avgDaysPerPoint * 10) / 10,
        topTaskTypes: topTypes.map(([type, count]) => ({ type, count })),
        topLabels: topLabels.map(([label, count]) => ({ label, count })),
        strengths: topTypes.map(([type]) => type),
      },
      confidence: Math.min(0.9, memberTasks.length / 30),
      sampleCount: memberTasks.length,
    });
  }

  return patterns;
}

// --- Analyze velocity trends ---
async function analyzeVelocityTrends(prisma: PrismaClient, workspaceId: string): Promise<Pattern[]> {
  const sprints = await prisma.sprint.findMany({
    where: {
      project: { workspaceId },
      isCompleted: true,
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { name: true } },
      startDate: true,
      endDate: true,
      completedAt: true,
      tasks: { select: { task: { select: { status: true, storyPoints: true } } } },
    },
    orderBy: { completedAt: "asc" },
  });

  if (sprints.length < 2) return [];

  // Group by project
  const byProject: Record<string, typeof sprints> = {};
  for (const s of sprints) {
    if (!byProject[s.projectId]) byProject[s.projectId] = [];
    byProject[s.projectId]!.push(s);
  }

  const patterns: Pattern[] = [];
  for (const [projectId, projectSprints] of Object.entries(byProject)) {
    if (projectSprints.length < 2) continue;

    const velocities = projectSprints.map(s => ({
      name: s.name,
      velocity: s.tasks.filter(st => st.task.status === "done").reduce((p, st) => p + (st.task.storyPoints || 0), 0),
      completionRate: s.tasks.length > 0 ? s.tasks.filter(st => st.task.status === "done").length / s.tasks.length : 0,
    }));

    const avgVelocity = velocities.reduce((s, v) => s + v.velocity, 0) / velocities.length;
    const recentVelocity = velocities.slice(-3).reduce((s, v) => s + v.velocity, 0) / Math.min(3, velocities.length);
    const trend = recentVelocity > avgVelocity * 1.1 ? "improving" : recentVelocity < avgVelocity * 0.9 ? "declining" : "stable";

    patterns.push({
      patternType: "team_velocity",
      subjectId: projectId,
      subjectType: "project",
      patternData: {
        projectName: projectSprints[0]?.project.name,
        avgVelocity: Math.round(avgVelocity),
        recentVelocity: Math.round(recentVelocity),
        trend,
        sprintCount: projectSprints.length,
        velocityHistory: velocities,
      },
      confidence: Math.min(0.9, projectSprints.length / 10),
      sampleCount: projectSprints.length,
    });
  }

  return patterns;
}

// --- Analyze blocker signals ---
async function analyzeBlockerSignals(prisma: PrismaClient, workspaceId: string): Promise<Pattern[]> {
  // Find tasks that were stuck for long periods
  const stuckTasks = await prisma.task.findMany({
    where: {
      project: { workspaceId },
      deletedAt: null,
      status: "in_progress",
      updatedAt: { lt: new Date(Date.now() - 3 * 86400000) }, // not updated in 3+ days
    },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      projectId: true,
      type: true,
      labels: { include: { label: { select: { name: true } } } },
      updatedAt: true,
    },
  });

  if (stuckTasks.length === 0) return [];

  const patterns: Pattern[] = [];
  for (const task of stuckTasks) {
    const daysSinceUpdate = Math.ceil((Date.now() - new Date(task.updatedAt).getTime()) / 86400000);

    patterns.push({
      patternType: "blocker_signal",
      subjectId: task.id,
      subjectType: "task",
      patternData: {
        taskTitle: task.title,
        assignee: task.assignee?.name || "Unassigned",
        daysSinceUpdate,
        type: task.type,
        labels: task.labels.map((l: any) => l.label.name),
        severity: daysSinceUpdate > 7 ? "high" : daysSinceUpdate > 3 ? "medium" : "low",
      },
      confidence: Math.min(0.95, 0.5 + daysSinceUpdate * 0.05),
      sampleCount: 1,
    });
  }

  return patterns;
}

// --- Store patterns in DB ---
async function storePatterns(prisma: PrismaClient, workspaceId: string, patterns: Pattern[]): Promise<void> {
  for (const p of patterns) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO engine_patterns (workspace_id, pattern_type, subject_id, subject_type, pattern_data, confidence, sample_count, last_updated)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5::jsonb, $6, $7, NOW())
       ON CONFLICT DO NOTHING`,
      workspaceId,
      p.patternType,
      p.subjectId || null,
      p.subjectType || null,
      JSON.stringify(p.patternData),
      p.confidence,
      p.sampleCount
    );
  }
}

// --- Run full pattern analysis ---
export async function analyzePatterns(prisma: PrismaClient, workspaceId: string): Promise<{
  estimationAccuracy: number;
  memberStrengths: number;
  velocityTrends: number;
  blockerSignals: number;
  total: number;
}> {
  console.log(`[Engine] Starting pattern analysis for workspace ${workspaceId}`);

  // Clear old patterns for this workspace (refresh)
  await prisma.$executeRawUnsafe(
    `DELETE FROM engine_patterns WHERE workspace_id = $1::uuid`,
    workspaceId
  );

  const estimation = await analyzeEstimationAccuracy(prisma, workspaceId);
  await storePatterns(prisma, workspaceId, estimation);

  const strengths = await analyzeMemberStrengths(prisma, workspaceId);
  await storePatterns(prisma, workspaceId, strengths);

  const velocity = await analyzeVelocityTrends(prisma, workspaceId);
  await storePatterns(prisma, workspaceId, velocity);

  const blockers = await analyzeBlockerSignals(prisma, workspaceId);
  await storePatterns(prisma, workspaceId, blockers);

  // Update engine state
  const total = estimation.length + strengths.length + velocity.length + blockers.length;
  await prisma.$executeRawUnsafe(
    `UPDATE engine_state SET last_pattern_analysis = NOW(), total_patterns = $2, updated_at = NOW() WHERE workspace_id = $1::uuid`,
    workspaceId,
    total
  );

  console.log(`[Engine] Pattern analysis complete: ${total} patterns found`);
  return {
    estimationAccuracy: estimation.length,
    memberStrengths: strengths.length,
    velocityTrends: velocity.length,
    blockerSignals: blockers.length,
    total,
  };
}

// --- Get patterns for a workspace ---
export async function getPatterns(
  prisma: PrismaClient,
  workspaceId: string,
  patternType?: string
): Promise<Pattern[]> {
  let sql = `SELECT * FROM engine_patterns WHERE workspace_id = $1::uuid`;
  const params: any[] = [workspaceId];

  if (patternType) {
    sql += ` AND pattern_type = $2`;
    params.push(patternType);
  }

  sql += ` ORDER BY confidence DESC`;

  const results: any[] = await prisma.$queryRawUnsafe(sql, ...params);
  return results.map((r: any) => ({
    patternType: r.pattern_type,
    subjectId: r.subject_id,
    subjectType: r.subject_type,
    patternData: r.pattern_data,
    confidence: parseFloat(r.confidence),
    sampleCount: r.sample_count,
  }));
}
