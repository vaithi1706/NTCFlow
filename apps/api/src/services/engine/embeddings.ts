/**
 * DKFlow Intelligence Engine — Embedding Service
 * 
 * Generates and stores vector embeddings for all project entities.
 * Uses NVIDIA NV-Embed-QA model for embeddings.
 */

import { PrismaClient } from "@prisma/client";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";
const EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const EMBEDDING_DIM = 1024;

interface EmbeddingInput {
  workspaceId: string;
  projectId?: string;
  entityType: "task" | "comment" | "activity" | "sprint" | "document";
  entityId: string;
  content: string;
  metadata?: Record<string, any>;
}

// --- Generate embeddings from NVIDIA API ---
async function generateEmbedding(text: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");

  // Truncate to avoid token limits
  const truncated = text.slice(0, 2000);

  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [truncated],
      input_type: "passage",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA Embedding API error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.data?.[0]?.embedding || [];
}

// --- Generate query embedding (different input_type) ---
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");

  const res = await fetch(EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: [query.slice(0, 500)],
      input_type: "query",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA Embedding API error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.data?.[0]?.embedding || [];
}

// --- Store a single embedding ---
export async function storeEmbedding(prisma: PrismaClient, input: EmbeddingInput): Promise<void> {
  try {
    const embedding = await generateEmbedding(input.content);
    if (embedding.length !== EMBEDDING_DIM) {
      console.warn(`[Engine] Unexpected embedding dimension: ${embedding.length}, expected ${EMBEDDING_DIM}`);
      return;
    }

    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$executeRawUnsafe(
      `INSERT INTO engine_embeddings (workspace_id, project_id, entity_type, entity_id, content, embedding, metadata)
       VALUES ($1::uuid, $2::uuid, $3, $4::uuid, $5, $6::vector, $7::jsonb)
       ON CONFLICT DO NOTHING`,
      input.workspaceId,
      input.projectId || null,
      input.entityType,
      input.entityId,
      input.content,
      vectorStr,
      JSON.stringify(input.metadata || {})
    );
  } catch (err) {
    console.error(`[Engine] Failed to store embedding for ${input.entityType}:${input.entityId}:`, err);
  }
}

// --- Batch store embeddings ---
export async function storeBatchEmbeddings(prisma: PrismaClient, inputs: EmbeddingInput[]): Promise<number> {
  let stored = 0;
  // Process in batches of 10 to avoid rate limits
  for (let i = 0; i < inputs.length; i += 10) {
    const batch = inputs.slice(i, i + 10);
    await Promise.all(batch.map(async (input) => {
      await storeEmbedding(prisma, input);
      stored++;
    }));
    // Small delay between batches
    if (i + 10 < inputs.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return stored;
}

// --- Semantic search ---
export async function semanticSearch(
  prisma: PrismaClient,
  workspaceId: string,
  query: string,
  options: {
    projectId?: string;
    entityType?: string;
    limit?: number;
    minSimilarity?: number;
  } = {}
): Promise<Array<{
  entityType: string;
  entityId: string;
  content: string;
  metadata: Record<string, any>;
  similarity: number;
}>> {
  const { projectId, entityType, limit = 10, minSimilarity = 0.5 } = options;

  const queryEmbedding = await generateQueryEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  let sql = `
    SELECT entity_type, entity_id, content, metadata,
           1 - (embedding <=> $1::vector) as similarity
    FROM engine_embeddings
    WHERE workspace_id = $2::uuid
  `;
  const params: any[] = [vectorStr, workspaceId];
  let paramIdx = 3;

  if (projectId) {
    sql += ` AND project_id = $${paramIdx}::uuid`;
    params.push(projectId);
    paramIdx++;
  }

  if (entityType) {
    sql += ` AND entity_type = $${paramIdx}`;
    params.push(entityType);
    paramIdx++;
  }

  sql += ` AND 1 - (embedding <=> $1::vector) > ${minSimilarity}`;
  sql += ` ORDER BY embedding <=> $1::vector LIMIT ${limit}`;

  const results: any[] = await prisma.$queryRawUnsafe(sql, ...params);

  return results.map((r: any) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    content: r.content,
    metadata: r.metadata,
    similarity: parseFloat(r.similarity),
  }));
}

// --- Build text content for different entity types ---
export function buildTaskContent(task: {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  type: string;
  assigneeName?: string | null;
  labels?: string[];
  projectName?: string;
}): string {
  const parts = [`Task: ${task.title}`];
  if (task.description) parts.push(`Description: ${task.description.slice(0, 500)}`);
  parts.push(`Status: ${task.status}, Priority: ${task.priority}, Type: ${task.type}`);
  if (task.assigneeName) parts.push(`Assigned to: ${task.assigneeName}`);
  if (task.labels?.length) parts.push(`Labels: ${task.labels.join(", ")}`);
  if (task.projectName) parts.push(`Project: ${task.projectName}`);
  return parts.join("\n");
}

export function buildCommentContent(comment: {
  content: string;
  authorName: string;
  taskTitle: string;
}): string {
  return `Comment by ${comment.authorName} on "${comment.taskTitle}": ${comment.content.slice(0, 500)}`;
}

export function buildActivityContent(activity: {
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  userName: string;
  taskTitle: string;
}): string {
  let text = `${activity.userName} ${activity.action} on "${activity.taskTitle}"`;
  if (activity.field) text += ` — ${activity.field}: ${activity.oldValue || "none"} → ${activity.newValue || "none"}`;
  return text;
}

export function buildSprintContent(sprint: {
  name: string;
  goal?: string | null;
  projectName: string;
  taskCount: number;
  completedCount: number;
}): string {
  const parts = [`Sprint: ${sprint.name} (${sprint.projectName})`];
  if (sprint.goal) parts.push(`Goal: ${sprint.goal}`);
  parts.push(`Tasks: ${sprint.completedCount}/${sprint.taskCount} completed`);
  return parts.join("\n");
}

// --- Check if entity already embedded ---
export async function isEmbedded(prisma: PrismaClient, entityType: string, entityId: string): Promise<boolean> {
  const result: any[] = await prisma.$queryRawUnsafe(
    `SELECT 1 FROM engine_embeddings WHERE entity_type = $1 AND entity_id = $2::uuid LIMIT 1`,
    entityType,
    entityId
  );
  return result.length > 0;
}

// --- Delete embedding ---
export async function deleteEmbedding(prisma: PrismaClient, entityType: string, entityId: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM engine_embeddings WHERE entity_type = $1 AND entity_id = $2::uuid`,
    entityType,
    entityId
  );
}

// --- Get embedding stats ---
export async function getEmbeddingStats(prisma: PrismaClient, workspaceId: string): Promise<{
  total: number;
  byType: Record<string, number>;
}> {
  const results: any[] = await prisma.$queryRawUnsafe(
    `SELECT entity_type, COUNT(*) as count FROM engine_embeddings WHERE workspace_id = $1::uuid GROUP BY entity_type`,
    workspaceId
  );

  const byType: Record<string, number> = {};
  let total = 0;
  for (const r of results) {
    byType[r.entity_type] = parseInt(r.count);
    total += parseInt(r.count);
  }

  return { total, byType };
}
