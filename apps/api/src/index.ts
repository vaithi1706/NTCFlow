import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { Server as SocketIOServer } from "socket.io";
import * as trpcExpress from "@trpc/server/adapters/express";
import multer from "multer";
import { appRouter } from "./routers/_app.js";
import { createContext } from "./context.js";
import { logger } from "./utils/logger.js";
import { redis } from "./utils/redis.js";
import { prisma } from "./lib/prisma.js";
import { verifyToken } from "./lib/jwt.js";
import { initEmail } from "./services/email.js";
import { sendDueDateReminders } from "./services/emailNotifier.js";

const app = express();
app.set("trust proxy", 1);
const PORT = parseInt(process.env.PORT || "4000", 10);

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ["https://dkflow.in", "https://www.dkflow.in", "https://admin.dkflow.in:8443", "http://localhost:3000"], credentials: true }));
app.use(compression());
app.use(morgan("combined", { stream: { write: (message: string) => logger.info(message.trim()) } }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting — general: 300 req/min (increased for SPA with multiple API calls per page)
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } }));

// Stricter rate limit for auth endpoints: 20 req/min
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, validate: { xForwardedForHeader: false } });
app.use("/api/trpc/auth.login", authLimiter);
app.use("/api/trpc/auth.register", authLimiter);
app.use("/api/trpc/auth.forgotPassword", authLimiter);

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const redisOk = await redis.ping();
    res.json({ status: "ok", timestamp: new Date().toISOString(), redis: redisOk === "PONG" ? "connected" : "error" });
  } catch {
    res.status(503).json({ status: "error" });
  }
});

// File uploads
const uploadsDir = "/home/ubuntu/dkflow/uploads";
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const user = verifyToken(authHeader.slice(7));

    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file" });

    // Check file size against subscription plan
    const workspaceId = req.body.workspaceId;
    if (workspaceId) {
      try {
        const { checkFileSize } = await import("./middleware/subscription.js");
        await checkFileSize(workspaceId, file.size);
      } catch (err: any) {
        // Delete the uploaded file
        const fs = await import("fs");
        if (file.path) fs.unlinkSync(file.path);
        return res.status(403).json({ error: err.message || "File size exceeds plan limit" });
      }
    }

    const taskId = req.body.taskId || null;
    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        uploadedById: user.userId,
        fileName: file.originalname,
        fileUrl: `/uploads/${file.filename}`,
        fileSize: file.size,
        mimeType: file.mimetype,
      },
    });
    res.json(attachment);
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// Serve uploads
app.use("/uploads", express.static(uploadsDir));

// ─── Git Webhook Endpoint ────────────────────────────────
app.post("/api/webhooks/git/:integrationId", async (req: any, res: any) => {
  try {
    const { integrationId } = req.params;
    // GitHub can send as form-encoded with a "payload" field
    let body = req.body || {};
    if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
    if (body.payload) { try { body = JSON.parse(body.payload); } catch {} }
    logger.info(`[git-webhook] Received: event=${req.headers["x-github-event"]} ct=${req.headers["content-type"]} keys=${Object.keys(body).join(",")}`);

    // Handle GitHub ping event
    const ghEvent = req.headers["x-github-event"];
    if (ghEvent === "ping") {
      logger.info(`[git-webhook] Ping received for ${integrationId}: ${body.zen || "ok"}`);
      return res.json({ ok: true, event: "ping" });
    }

    const integration = await prisma.gitIntegration.findUnique({
      where: { id: integrationId },
      include: { project: { select: { id: true, taskPrefix: true } } },
    });
    if (!integration || !integration.isActive) return res.status(404).json({ error: "Not found" });

    logger.info(`[git-webhook] ${ghEvent || "unknown"} content-type=${req.headers["content-type"]} body-type=${typeof body} body-len=${JSON.stringify(body).length} keys=${Object.keys(body).join(",")}`);
    logger.info(`[git-webhook-SKIP] ${ghEvent || "unknown"} event for ${integration.repoName}, body keys: ${Object.keys(body).join(",")}`);

    const commits: any[] = [];
    const taskPrefix = integration.project.taskPrefix || "DK";
    const taskKeyRegex = new RegExp(`${taskPrefix}-(\\d+)`, "gi");

    // GitHub push event
    if (body.commits && Array.isArray(body.commits)) {
      for (const c of body.commits) {
        commits.push({
          commitHash: c.id || c.sha || "",
          message: c.message || "",
          authorName: c.author?.name || c.author?.username || "Unknown",
          authorEmail: c.author?.email || null,
          branch: (body.ref || "").replace("refs/heads/", ""),
          url: c.url || null,
          committedAt: c.timestamp ? new Date(c.timestamp) : new Date(),
        });
      }
    }
    // GitHub/GitLab PR event
    if (body.pull_request || body.merge_request) {
      const pr = body.pull_request || body.merge_request;
      const prStatus = pr.merged ? "merged" : pr.state === "closed" ? "closed" : "open";
      commits.push({
        commitHash: pr.head?.sha || pr.merge_commit_sha || `pr-${pr.number || pr.iid}`,
        message: pr.title || "",
        authorName: pr.user?.login || pr.author?.name || "Unknown",
        authorEmail: null,
        branch: pr.head?.ref || pr.source_branch || null,
        url: pr.html_url || pr.web_url || null,
        type: "pull_request",
        prNumber: pr.number || pr.iid || null,
        prTitle: pr.title || null,
        prStatus,
        committedAt: new Date(pr.updated_at || pr.created_at || Date.now()),
      });
    }

    for (const commit of commits) {
      const created = await prisma.gitCommit.create({
        data: { integrationId, ...commit },
      });

      // Auto-link to tasks by matching DK-123 pattern
      const matches = commit.message.matchAll(taskKeyRegex);
      for (const match of matches) {
        const taskNumber = parseInt(match[1], 10);
        const task = await prisma.task.findFirst({
          where: { projectId: integration.projectId, taskNumber, deletedAt: null },
          include: { column: true },
        });
        if (task) {
          await prisma.gitCommit.update({ where: { id: created.id }, data: { taskId: task.id } });
          await prisma.taskActivity.create({
            data: {
              taskId: task.id,
              action: "git_commit",
              field: "development",
              newValue: `${commit.type === "pull_request" ? "PR" : "Commit"}: ${commit.message}`,
              metadata: { commitHash: commit.commitHash, url: commit.url, type: commit.type || "commit" },
            },
          });

          // ── Smart Status Transitions ──
          // Determine if this commit/PR should move the task
          const msg = commit.message.toLowerCase();
          const taskKey = match[0].toLowerCase(); // e.g. "dk-1"
          const isPR = commit.type === "pull_request";
          const isMergedPR = isPR && commit.prStatus === "merged";

          // Check for "done" triggers: fixes/closes/resolves DK-1, #done, or merged PR
          const donePatterns = [
            new RegExp(`(fix(es|ed)?|clos(es|ed)?|resolv(es|ed)?)\\s+${taskKey.replace("-", "\\-")}`, "i"),
          ];
          const hasDoneKeyword = donePatterns.some(p => p.test(msg)) || /#done\b/.test(msg);
          const shouldMarkDone = isMergedPR || hasDoneKeyword;

          // Check for "in progress" triggers: any commit mention (but not done)
          const hasInProgressKeyword = /#in[_-]?progress\b/.test(msg);
          const shouldMarkInProgress = !shouldMarkDone && (hasInProgressKeyword || (!isPR && !hasDoneKeyword));

          if (shouldMarkDone || shouldMarkInProgress) {
            const projectColumns = await prisma.boardColumn.findMany({
              where: { projectId: integration.projectId },
              orderBy: { position: "asc" },
            });

            let targetColumn = null;
            if (shouldMarkDone) {
              // Find the "done" column (isDone flag, or last column as fallback)
              targetColumn = projectColumns.find(c => c.isDone) || projectColumns[projectColumns.length - 1];
            } else if (shouldMarkInProgress) {
              // Find an "in progress" column (not first, not isDone — typically position 1)
              targetColumn = projectColumns.find(c => !c.isDone && c.position > 0)
                || (projectColumns.length > 1 ? projectColumns[1] : null);
            }

            if (targetColumn && targetColumn.id !== task.columnId) {
              const oldColumnName = task.column?.name || "Unknown";
              // Get max position in target column
              const maxPos = await prisma.task.aggregate({
                where: { columnId: targetColumn.id, deletedAt: null },
                _max: { position: true },
              });
              const newPosition = (maxPos._max.position ?? -1) + 1;

              await prisma.task.update({
                where: { id: task.id },
                data: {
                  columnId: targetColumn.id,
                  position: newPosition,
                  ...(shouldMarkDone ? { completedAt: new Date() } : {}),
                },
              });

              await prisma.taskActivity.create({
                data: {
                  taskId: task.id,
                  action: "status_change",
                  field: "status",
                  oldValue: oldColumnName,
                  newValue: targetColumn.name,
                  metadata: {
                    trigger: isPR ? "pr_merge" : "smart_commit",
                    commitHash: commit.commitHash,
                  },
                },
              });

              logger.info(`[git-webhook] Smart transition: ${taskPrefix}-${taskNumber} moved from "${oldColumnName}" → "${targetColumn.name}" (trigger: ${isPR ? "pr_merge" : "smart_commit"})`);
            }
          }
        }
      }
    }

    res.json({ received: commits.length });
  } catch (err) {
    logger.error("Git webhook error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── Inbound Email Endpoint ──────────────────────────────
app.post("/api/inbound-email", async (req: any, res: any) => {
  try {
    const { subject, body: emailBody, from, to } = req.body;
    if (!to || !subject) return res.status(400).json({ error: "Missing subject or to" });

    // Extract project from to address (format: project-<id>@dkflow.app)
    const toAddr = Array.isArray(to) ? to[0] : to;
    const project = await prisma.project.findFirst({
      where: { inboundEmail: toAddr },
      include: { columns: { orderBy: { position: "asc" }, take: 1 } },
    });
    if (!project) return res.status(404).json({ error: "No project for this email" });

    const column = project.columns[0];
    if (!column) return res.status(400).json({ error: "Project has no columns" });

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { taskCounter: { increment: 1 } },
    });

    const task = await prisma.task.create({
      data: {
        title: subject.slice(0, 500),
        description: emailBody || null,
        projectId: project.id,
        columnId: column.id,
        taskNumber: updated.taskCounter,
        status: "todo",
        priority: "none",
        position: 0,
      },
    });

    await prisma.taskActivity.create({
      data: { taskId: task.id, action: "created", field: "source", newValue: `Email from ${from || "unknown"}` },
    });

    res.json({ taskId: task.id, taskNumber: task.taskNumber });
  } catch (err) {
    logger.error("Inbound email error", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ─── Public REST API (v1) ────────────────────────────────
import crypto from "node:crypto";

async function apiKeyAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer dk_")) return res.status(401).json({ error: "Invalid API key" });
  const key = auth.slice(7);
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey) return res.status(401).json({ error: "Invalid API key" });
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return res.status(401).json({ error: "API key expired" });
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  req.apiKey = apiKey;
  next();
}

app.get("/api/v1/projects", apiKeyAuth, async (req: any, res: any) => {
  try {
    const projects = await prisma.project.findMany({
      where: { workspaceId: req.apiKey.workspaceId, deletedAt: null },
      select: { id: true, name: true, slug: true, taskPrefix: true, createdAt: true },
    });
    res.json({ projects });
  } catch { res.status(500).json({ error: "Internal error" }); }
});

app.get("/api/v1/tasks", apiKeyAuth, async (req: any, res: any) => {
  try {
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ error: "projectId required" });
    const project = await prisma.project.findFirst({
      where: { id: projectId as string, workspaceId: req.apiKey.workspaceId },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const tasks = await prisma.task.findMany({
      where: { projectId: projectId as string, deletedAt: null },
      select: {
        id: true, title: true, taskNumber: true, status: true, priority: true,
        type: true, dueDate: true, createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ tasks });
  } catch { res.status(500).json({ error: "Internal error" }); }
});

app.post("/api/v1/tasks", apiKeyAuth, express.json(), async (req: any, res: any) => {
  try {
    const { projectId, title, description, priority, columnId } = req.body;
    if (!projectId || !title) return res.status(400).json({ error: "projectId and title required" });
    const project = await prisma.project.findFirst({
      where: { id: projectId, workspaceId: req.apiKey.workspaceId },
      include: { columns: { orderBy: { position: "asc" }, take: 1 } },
    });
    if (!project) return res.status(404).json({ error: "Project not found" });
    const col = columnId || project.columns[0]?.id;
    if (!col) return res.status(400).json({ error: "No column available" });
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { taskCounter: { increment: 1 } },
    });
    const task = await prisma.task.create({
      data: {
        title: title.slice(0, 500),
        description: description || null,
        projectId, columnId: col,
        taskNumber: updated.taskCounter,
        status: "todo",
        priority: priority || "none",
        position: 0,
      },
    });
    res.json({ task });
  } catch { res.status(500).json({ error: "Internal error" }); }
});

// tRPC
app.use("/api/trpc", trpcExpress.createExpressMiddleware({ router: appRouter, createContext }));

// HTTP server
const server = http.createServer(app);

// Socket.IO
const io = new SocketIOServer(server, {
  cors: { origin: ["https://dkflow.in", "https://www.dkflow.in", "https://admin.dkflow.in:8443", "http://localhost:3000"], credentials: true },
  path: "/api/socket.io",
});

const onlineUsers = new Map<string, Set<string>>();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("Authentication required"));
  try {
    const payload = verifyToken(token);
    (socket as any).userId = payload.userId;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", async (socket) => {
  const userId = (socket as any).userId as string;
  logger.info(`Socket connected: ${socket.id} (user: ${userId})`);

  // Track online status
  if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
  onlineUsers.get(userId)!.add(socket.id);
  io.emit("presence:online", { userId });

  // Join user's workspace and project rooms
  const memberships = await prisma.workspaceMember.findMany({ where: { userId }, select: { workspaceId: true } });
  for (const m of memberships) socket.join(`workspace:${m.workspaceId}`);

  const projectMemberships = await prisma.projectMember.findMany({ where: { userId }, select: { projectId: true } });
  for (const m of projectMemberships) socket.join(`project:${m.projectId}`);

  socket.on("join:project", (projectId: string) => socket.join(`project:${projectId}`));
  socket.on("leave:project", (projectId: string) => socket.leave(`project:${projectId}`));

  // ─── Presence: page-level viewing ───
  const viewingPages = new Set<string>();

  socket.on("presence:viewing", (data: { page: string; userName?: string; avatarUrl?: string }) => {
    const { page, userName, avatarUrl } = data;
    viewingPages.add(page);
    socket.join(`viewing:${page}`);
    io.to(`viewing:${page}`).emit("presence:viewers", {
      page,
      userId,
      userName: userName || "User",
      avatarUrl: avatarUrl || null,
      action: "join",
    });
  });

  socket.on("presence:leave", (data: { page: string }) => {
    viewingPages.delete(data.page);
    socket.leave(`viewing:${data.page}`);
    io.to(`viewing:${data.page}`).emit("presence:viewers", {
      page: data.page,
      userId,
      action: "leave",
    });
  });

  socket.on("disconnect", () => {
    // Leave all viewing pages
    for (const page of viewingPages) {
      io.to(`viewing:${page}`).emit("presence:viewers", { page, userId, action: "leave" });
    }
    viewingPages.clear();

    const sockets = onlineUsers.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(userId);
        io.emit("presence:offline", { userId });
      }
    }
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Helper to emit events to project rooms
export function emitToProject(projectId: string, event: string, data: any) {
  io.to(`project:${projectId}`).emit(event, data);
}

// Start
server.listen(PORT, async () => {
  logger.info(`🚀 DKFlow API running on port ${PORT}`);
  logger.info(`   Health: http://localhost:${PORT}/api/health`);
  logger.info(`   tRPC:   http://localhost:${PORT}/api/trpc`);
  await initEmail();

  // Daily due-date reminders — check every hour, send once at ~8 AM UTC
  setInterval(async () => {
    const hour = new Date().getUTCHours();
    if (hour === 8) {
      logger.info("[cron] Running daily due-date reminder check");
      await sendDueDateReminders().catch((err) => logger.error("[cron] Due date reminders failed", err));
    }
  }, 3600000); // every hour
});

export { io };
export type { AppRouter } from "./routers/_app.js";
