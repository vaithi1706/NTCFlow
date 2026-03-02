/**
 * Meetings Router — Express routes for Microsoft Teams integration
 * Handles OAuth callback + REST API for meetings
 */

import { Router, Request, Response } from "express";
import { verifyToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../utils/logger.js";
import * as teams from "../services/microsoft-teams.js";

const router = Router();

// Auth middleware for REST endpoints
function authMiddleware(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const payload = verifyToken(authHeader.slice(7));
    (req as any).userId = payload.userId;
    (req as any).email = payload.email;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ==================== OAuth Flow ====================

// Step 1: Redirect user to Microsoft login
router.get("/connect", authMiddleware, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const workspaceId = req.query.workspaceId as string || "";
  // Encode state as userId:workspaceId
  const state = Buffer.from(JSON.stringify({ userId, workspaceId })).toString("base64url");
  const authUrl = teams.getAuthUrl(state);
  res.json({ authUrl });
});

// Step 2: Microsoft redirects back here after user grants consent
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    if (error) {
      logger.error(`MS OAuth error: ${error} - ${error_description}`);
      return res.redirect(`https://dkflow.in/settings?ms_error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || !state) {
      return res.redirect("https://dkflow.in/settings?ms_error=missing_params");
    }

    // Decode state
    const { userId, workspaceId } = JSON.parse(Buffer.from(state as string, "base64url").toString());

    // Exchange code for tokens
    const tokens = await teams.exchangeCode(code as string);

    // Get Microsoft profile
    const profile = await teams.getMsProfile(tokens.access_token);

    // Save tokens
    await teams.saveTokens(userId, workspaceId, tokens, {
      id: profile.id,
      mail: profile.mail || profile.userPrincipalName,
    });

    logger.info(`Microsoft Teams connected for user ${userId} (${profile.mail || profile.userPrincipalName})`);

    // Redirect to frontend with success
    res.redirect("https://dkflow.in/settings?ms_connected=true");
  } catch (err: any) {
    logger.error(`MS OAuth callback error: ${err.message}`);
    res.redirect(`https://dkflow.in/settings?ms_error=${encodeURIComponent(err.message)}`);
  }
});

// ==================== Connection Status ====================

router.get("/status", authMiddleware, async (req: Request, res: Response) => {
  try {
    const connection = await teams.getMsConnection((req as any).userId);
    res.json({ connected: !!connection, ...(connection || {}) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/disconnect", authMiddleware, async (req: Request, res: Response) => {
  try {
    await teams.disconnectMs((req as any).userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Meetings ====================

// Sync meetings from Microsoft
router.post("/sync", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    const meetings = await teams.syncMeetings((req as any).userId, workspaceId);
    res.json({ meetings, count: meetings.length });
  } catch (err: any) {
    logger.error(`Sync meetings error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// List meetings
router.get("/list", authMiddleware, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const meetings = await teams.listMeetings((req as any).userId, status);
    res.json(meetings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get single meeting
router.get("/:id", authMiddleware, async (req: Request, res: Response) => {
  try {
    const meeting = await teams.getMeeting(req.params.id, (req as any).userId);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    res.json(meeting);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Process meeting (fetch transcript + AI summarize + extract tasks)
router.post("/:id/process", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.body;
    const result = await teams.processMeeting(req.params.id, (req as any).userId, projectId);
    res.json(result);
  } catch (err: any) {
    logger.error(`Process meeting error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Create tasks from processed meeting
router.post("/:id/create-tasks", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { projectId, workspaceId } = req.body;
    if (!projectId || !workspaceId) {
      return res.status(400).json({ error: "projectId and workspaceId required" });
    }
    const tasks = await teams.createTasksFromMeeting(
      req.params.id,
      (req as any).userId,
      projectId,
      workspaceId,
      prisma
    );
    res.json({ tasks, count: tasks.length });
  } catch (err: any) {
    logger.error(`Create tasks error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Upload transcript manually for a meeting
router.post("/:id/upload-transcript", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript || transcript.length < 20) {
      return res.status(400).json({ error: "Transcript text is too short" });
    }
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      "UPDATE meetings SET transcript_raw = $2, status = 'synced', updated_at = NOW() WHERE id = $1 AND user_id = $3",
      [req.params.id, transcript, (req as any).userId]
    );
    await pool.end();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create a manual meeting (no Microsoft sync needed)
router.post("/manual", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { subject, transcript, projectId, workspaceId } = req.body;
    if (!subject) return res.status(400).json({ error: "Subject required" });
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const { rows } = await pool.query(
      `INSERT INTO meetings (user_id, workspace_id, project_id, ms_meeting_id, subject, transcript_raw, status, start_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING *`,
      [
        (req as any).userId,
        workspaceId || null,
        projectId || null,
        `manual-${Date.now()}`,
        subject,
        transcript || null,
        transcript ? "synced" : "pending",
      ]
    );
    await pool.end();
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
