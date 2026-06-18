/**
 * Document AI Service
 * - Text extraction from PDF, DOCX, and plain text files
 * - Smart Version Summary (AI-generated changelog between versions)
 * - Semantic Search (pgvector embeddings for natural language document search)
 */

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_LLM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NVIDIA_LLM_MODEL = "openai/gpt-oss-120b";
const NVIDIA_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const NVIDIA_EMBED_MODEL = "nvidia/nv-embedqa-e5-v5";
const UPLOADS_DIR = process.env.UPLOAD_DIR || "/home/ubuntu/dkflow/uploads";

// ─── Text Extraction ────────────────────────────────────────────────

export async function extractText(fileUrl: string, mimeType: string): Promise<string> {
  const filePath = path.join(UPLOADS_DIR, fileUrl.replace(/^\/uploads\//, ""));

  if (!fs.existsSync(filePath)) {
    logger.warn(`[doc-ai] File not found: ${filePath}`);
    return "";
  }

  try {
    if (mimeType === "application/pdf") {
      return await extractPdfText(filePath);
    }
    // Check spreadsheet/presentation BEFORE word — "spreadsheetml.sheet" contains "sheet" not "word"
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("sheet.main")) {
      return await extractXlsxText(filePath);
    }
    if (mimeType.includes("presentation") || mimeType.includes("powerpoint") || mimeType.includes("slideshow")) {
      return await extractPptxText(filePath);
    }
    if (mimeType.includes("word") || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await extractDocxText(filePath);
    }
    if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "application/xml") {
      return fs.readFileSync(filePath, "utf-8").slice(0, 50000);
    }
    if (mimeType.includes("csv")) {
      return fs.readFileSync(filePath, "utf-8").slice(0, 50000);
    }
    return "";
  } catch (err: any) {
    logger.error(`[doc-ai] Text extraction failed for ${filePath}: ${err.message}`);
    return "";
  }
}

async function extractPdfText(filePath: string): Promise<string> {
  const mod = await import("pdf-parse");
  const pdfParse = mod.default || mod;
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return (data.text || "").slice(0, 50000);
}

async function extractDocxText(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || "").slice(0, 50000);
}

async function extractXlsxText(filePath: string): Promise<string> {
  const XLSX = await import("xlsx");
  const mod = XLSX.default || XLSX;
  const workbook = mod.readFile(filePath);
  const lines: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    lines.push(`[Sheet: ${sheetName}]`);
    const sheet = workbook.Sheets[sheetName];
    const csv = mod.utils.sheet_to_csv(sheet, { blankrows: false });
    lines.push(csv);
    if (lines.join("\n").length > 40000) break;
  }
  return lines.join("\n").slice(0, 50000);
}

async function extractPptxText(filePath: string): Promise<string> {
  // PPTX is a zip of XML files — extract text from slide XMLs
  const { execSync } = await import("node:child_process");
  try {
    // Use unzip + grep to extract text from slides
    const tmpDir = `/tmp/pptx-${Date.now()}`;
    execSync(`mkdir -p ${tmpDir} && cd ${tmpDir} && unzip -o -q "${filePath}" "ppt/slides/*.xml" 2>/dev/null || true`, { timeout: 10000 });
    const slideFiles = fs.readdirSync(`${tmpDir}/ppt/slides`).filter((f: string) => f.endsWith(".xml")).sort();
    const texts: string[] = [];
    for (const sf of slideFiles) {
      const xml = fs.readFileSync(`${tmpDir}/ppt/slides/${sf}`, "utf-8");
      // Extract text between <a:t> tags
      const matches = xml.match(/<a:t[^>]*>([^<]+)<\/a:t>/g);
      if (matches) {
        const slideText = matches.map((m: string) => m.replace(/<[^>]+>/g, "")).join(" ");
        texts.push(slideText);
      }
    }
    execSync(`rm -rf ${tmpDir}`);
    return texts.join("\n").slice(0, 50000);
  } catch {
    return "";
  }
}

// ─── NVIDIA LLM Call ────────────────────────────────────────────────

async function callLLM(systemPrompt: string, userPrompt: string, maxTokens = 1024): Promise<string> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");

  const res = await fetch(NVIDIA_LLM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_LLM_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA LLM error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ─── NVIDIA Embedding ───────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");

  // NV-Embed-QA supports 512 tokens (~2000 chars). Use concise passage.
  const truncated = text.slice(0, 2000);

  const res = await fetch(NVIDIA_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_EMBED_MODEL,
      input: [truncated],
      input_type: "passage",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA Embedding error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.data?.[0]?.embedding || [];
}

async function generateQueryEmbedding(query: string): Promise<number[]> {
  if (!NVIDIA_API_KEY) throw new Error("No NVIDIA_API_KEY configured");

  const res = await fetch(NVIDIA_EMBED_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: NVIDIA_EMBED_MODEL,
      input: [query.slice(0, 2000)],
      input_type: "query",
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA Embedding error ${res.status}: ${err}`);
  }

  const data: any = await res.json();
  return data.data?.[0]?.embedding || [];
}

// ─── Feature 1: Smart Version Summary ───────────────────────────────

export async function generateVersionSummary(
  prisma: PrismaClient,
  documentId: string,
  newVersionId: string
): Promise<string> {
  try {
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        versions: { orderBy: { versionNumber: "desc" }, take: 2 },
      },
    });

    const versions = doc.versions;
    logger.info(`[doc-ai] Generating version summary for doc ${documentId}, ${versions.length} versions`);

    if (versions.length < 2) {
      // First version — just summarize the document
      const newVersion = versions[0];
      logger.info(`[doc-ai] Extracting text from ${newVersion.fileName} (${newVersion.mimeType})`);
      const text = await extractText(newVersion.fileUrl, newVersion.mimeType);
      logger.info(`[doc-ai] Extracted ${text.length} chars`);
      if (!text || text.length < 20) return "Initial upload";

      const summary = await callLLM(
        "You are a document analyst. Summarize the key content of this document in 2-3 concise bullet points. Be specific about what the document contains. Do not add any intro text, just the bullet points.",
        `Document: "${doc.title}"\nFilename: ${newVersion.fileName}\n\nContent:\n${text.slice(0, 6000)}`
      );
      return summary || "Initial upload";
    }

    // Two versions — compare and generate changelog
    const [newVer, oldVer] = versions;
    const [newText, oldText] = await Promise.all([
      extractText(newVer.fileUrl, newVer.mimeType),
      extractText(oldVer.fileUrl, oldVer.mimeType),
    ]);

    // If we can't extract text from either, use metadata comparison
    if ((!newText || newText.length < 20) && (!oldText || oldText.length < 20)) {
      const sizeDiff = newVer.fileSize - oldVer.fileSize;
      const sizeChange = sizeDiff > 0 ? `+${formatBytes(sizeDiff)}` : formatBytes(sizeDiff);
      const nameChanged = newVer.fileName !== oldVer.fileName;
      const parts: string[] = [];
      if (nameChanged) parts.push(`File renamed from "${oldVer.fileName}" to "${newVer.fileName}"`);
      parts.push(`File size changed: ${sizeChange} (${formatBytes(oldVer.fileSize)} → ${formatBytes(newVer.fileSize)})`);
      return parts.join("\n");
    }

    const prompt = `Compare these two versions of the document "${doc.title}" and describe what changed. Be specific and concise. Use bullet points. Focus on content changes, not formatting.

--- VERSION ${oldVer.versionNumber} ---
${oldText.slice(0, 4000)}

--- VERSION ${newVer.versionNumber} ---
${newText.slice(0, 4000)}

What changed between v${oldVer.versionNumber} and v${newVer.versionNumber}?`;

    const summary = await callLLM(
      "You are a document version control assistant. Compare two document versions and describe the changes clearly and concisely. Use bullet points. Start directly with the changes — no intro text. If the documents are very different, note that it appears to be a major rewrite.",
      prompt,
      512
    );

    return summary || `Updated from v${oldVer.versionNumber}`;
  } catch (err: any) {
    logger.error(`[doc-ai] Version summary failed: ${err.message}`);
    return "";
  }
}

// ─── Feature 2: Semantic Search (Embeddings) ────────────────────────

/**
 * Index a document — extract text, generate embedding, store in pgvector
 */
export async function indexDocument(prisma: PrismaClient, documentId: string): Promise<void> {
  try {
    const doc = await prisma.document.findUniqueOrThrow({
      where: { id: documentId },
      include: {
        currentVersion: true,
        tags: { include: { tag: true } },
        category: true,
      },
    });

    if (!doc.currentVersion) return;

    // Build text for embedding
    const extractedText = await extractText(doc.currentVersion.fileUrl, doc.currentVersion.mimeType);
    const tagNames = doc.tags.map((t) => t.tag.name).join(", ");
    const categoryName = doc.category?.name || "";

    // Build concise embedding text — title/filename first, then short content
    const embeddingText = [
      doc.title,
      doc.currentVersion.fileName,
      doc.description || "",
      categoryName,
      tagNames,
      extractedText.slice(0, 1200),
    ]
      .filter(Boolean)
      .join(". ");

    const embedding = await generateEmbedding(embeddingText);
    if (!embedding.length) return;

    const vectorStr = `[${embedding.join(",")}]`;

    // Upsert embedding
    await prisma.$executeRawUnsafe(
      `INSERT INTO "DocumentEmbeddings" ("Id", "DocumentId", "ProjectId", "EmbeddingText", "Embedding", "UpdatedAt")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4::vector, NOW())
       ON CONFLICT ("DocumentId") DO UPDATE SET
         "EmbeddingText" = $3,
         "Embedding" = $4::vector,
         "UpdatedAt" = NOW()`,
      documentId,
      doc.projectId,
      embeddingText.slice(0, 10000),
      vectorStr
    );

    logger.info(`[doc-ai] Indexed document: ${doc.title} (${documentId})`);
  } catch (err: any) {
    logger.error(`[doc-ai] Indexing failed for ${documentId}: ${err.message}`);
  }
}

/**
 * Semantic search — find documents by natural language query
 */
export async function semanticSearch(
  prisma: PrismaClient,
  projectId: string,
  query: string,
  limit = 10
): Promise<any[]> {
  try {
    const queryEmbedding = await generateQueryEmbedding(query);
    if (!queryEmbedding.length) return [];

    const vectorStr = `[${queryEmbedding.join(",")}]`;

    const results: any[] = await prisma.$queryRawUnsafe(
      `SELECT de."DocumentId" as "documentId",
              de."EmbeddingText" as "embeddingText",
              1 - (de."Embedding" <=> $1::vector) as similarity
       FROM "DocumentEmbeddings" de
       JOIN "Documents" d ON d."Id" = de."DocumentId"
       WHERE de."ProjectId" = $2::uuid
         AND d."DeletedAt" IS NULL
       ORDER BY de."Embedding" <=> $1::vector
       LIMIT $3`,
      vectorStr,
      projectId,
      limit
    );

    // Fetch full document data for results
    if (!results.length) return [];

    const docIds = results.map((r) => r.documentId);
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds } },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        currentVersion: true,
        category: { select: { id: true, name: true, color: true } },
        tags: { include: { tag: true } },
      },
    });

    // Merge similarity scores, filter low relevance
    const docMap = new Map(docs.map((d) => [d.id, d]));
    const MIN_SIMILARITY = 0.15;
    return results
      .filter((r) => Number(r.similarity) >= MIN_SIMILARITY)
      .map((r) => ({
        ...docMap.get(r.documentId),
        similarity: Number(r.similarity).toFixed(3),
      }))
      .filter((d) => d.id);
  } catch (err: any) {
    logger.error(`[doc-ai] Semantic search failed: ${err.message}`);
    return [];
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${bytes} B`;
  if (abs < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
