/**
 * Microsoft Teams Integration Service
 * - OAuth2 flow (authorization code grant)
 * - Fetch meetings & transcripts via Graph API
 * - AI summarization & task extraction
 */

import { Pool } from "pg";
import { logger } from "../utils/logger.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID!;
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET!;
const MS_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI!;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY!;

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";

// ==================== OAuth Flow ====================

export function getAuthUrl(state: string): string {
  const scopes = [
    "User.Read",
    "OnlineMeetings.Read",
    "Calendars.Read",
    "offline_access",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: "code",
    redirect_uri: MS_REDIRECT_URI,
    scope: scopes,
    state,
    response_mode: "query",
    prompt: "select_account",
  });

  return `${AUTH_BASE}/authorize?${params}`;
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      code,
      redirect_uri: MS_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error(`MS token exchange failed: ${err}`);
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "User.Read OnlineMeetings.Read Calendars.Read offline_access",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    logger.error(`MS token refresh failed: ${err}`);
    throw new Error("Token refresh failed");
  }

  return res.json();
}

// ==================== Token Management ====================

export async function saveTokens(
  userId: string,
  workspaceId: string | null,
  tokens: { access_token: string; refresh_token: string; expires_in: number },
  msProfile?: { id: string; mail: string }
) {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await pool.query(
    `INSERT INTO meetings_ms_tokens (user_id, workspace_id, access_token, refresh_token, expires_at, ms_user_id, ms_email, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       access_token = $3, refresh_token = $4, expires_at = $5,
       ms_user_id = COALESCE($6, meetings_ms_tokens.ms_user_id),
       ms_email = COALESCE($7, meetings_ms_tokens.ms_email),
       workspace_id = COALESCE($2, meetings_ms_tokens.workspace_id),
       updated_at = NOW()`,
    [userId, workspaceId, tokens.access_token, tokens.refresh_token, expiresAt, msProfile?.id || null, msProfile?.mail || null]
  );
}

export async function getValidToken(userId: string): Promise<string | null> {
  const { rows } = await pool.query(
    "SELECT access_token, refresh_token, expires_at FROM meetings_ms_tokens WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0) return null;

  const row = rows[0];
  // If token expires in < 5 min, refresh it
  if (new Date(row.expires_at).getTime() - Date.now() < 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(row.refresh_token);
      await saveTokens(userId, null, newTokens);
      return newTokens.access_token;
    } catch {
      logger.error(`Failed to refresh token for user ${userId}`);
      return null;
    }
  }
  return row.access_token;
}

export async function getMsConnection(userId: string) {
  const { rows } = await pool.query(
    "SELECT ms_email, ms_user_id, expires_at FROM meetings_ms_tokens WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0) return null;
  return { email: rows[0].ms_email, msUserId: rows[0].ms_user_id, connected: true };
}

export async function disconnectMs(userId: string) {
  await pool.query("DELETE FROM meetings_ms_tokens WHERE user_id = $1", [userId]);
  await pool.query("DELETE FROM meetings WHERE user_id = $1", [userId]);
}

// ==================== Graph API Helpers ====================

async function graphGet(token: string, path: string) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    logger.error(`Graph API error [${path}]: ${res.status} ${err}`);
    throw new Error(`Graph API ${res.status}: ${err}`);
  }
  return res.json();
}

async function graphGetText(token: string, path: string): Promise<string> {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Graph API ${res.status}: ${err}`);
  }
  return res.text();
}

// ==================== Fetch Meetings ====================

export async function getMsProfile(token: string) {
  return graphGet(token, "/me?$select=id,displayName,mail,userPrincipalName");
}

export async function fetchRecentMeetings(token: string): Promise<any[]> {
  // Get calendar events that are Teams meetings from the last 7 days
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const data = await graphGet(
    token,
    `/me/calendarView?startDateTime=${weekAgo.toISOString()}&endDateTime=${now.toISOString()}&$filter=isOnlineMeeting eq true&$select=id,subject,start,end,organizer,attendees,onlineMeeting&$orderby=start/dateTime desc&$top=50`
  );

  return data.value || [];
}

export async function fetchOnlineMeetings(token: string): Promise<any[]> {
  try {
    const data = await graphGet(token, "/me/onlineMeetings?$top=50&$orderby=creationDateTime desc");
    return data.value || [];
  } catch (e) {
    logger.warn("Could not fetch onlineMeetings directly, using calendarView fallback");
    return [];
  }
}

export async function fetchTranscripts(token: string, meetingId: string): Promise<any[]> {
  try {
    const data = await graphGet(token, `/me/onlineMeetings/${meetingId}/transcripts`);
    return data.value || [];
  } catch (e: any) {
    logger.warn(`No transcripts for meeting ${meetingId}: ${e.message}`);
    return [];
  }
}

export async function fetchTranscriptContent(token: string, meetingId: string, transcriptId: string): Promise<string> {
  try {
    // Fetch as text/vtt format
    const res = await fetch(
      `${GRAPH_BASE}/me/onlineMeetings/${meetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`${res.status}`);
    return res.text();
  } catch (e: any) {
    logger.error(`Failed to fetch transcript content: ${e.message}`);
    return "";
  }
}

// ==================== Parse VTT Transcript ====================

export function parseVtt(vtt: string): string {
  // Convert VTT format to readable text
  // VTT looks like:
  // WEBVTT
  //
  // 00:00:00.000 --> 00:00:05.000
  // <v Speaker Name>Hello everyone, let's start the meeting</v>
  
  const lines = vtt.split("\n");
  const dialogLines: string[] = [];
  let lastSpeaker = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "WEBVTT" || trimmed.includes("-->") || trimmed.startsWith("NOTE")) continue;

    // Extract speaker and text from <v Speaker>text</v> format
    const vMatch = trimmed.match(/<v\s+([^>]+)>(.*?)<\/v>/);
    if (vMatch) {
      const speaker = vMatch[1];
      const text = vMatch[2];
      if (speaker !== lastSpeaker) {
        dialogLines.push(`\n${speaker}: ${text}`);
        lastSpeaker = speaker;
      } else {
        dialogLines.push(text);
      }
    } else if (!trimmed.match(/^\d+$/) && !trimmed.match(/^[\d:.,\s->]+$/)) {
      // Plain text without speaker tags
      dialogLines.push(trimmed);
    }
  }

  return dialogLines.join(" ").replace(/\s+/g, " ").trim();
}

// ==================== AI Processing ====================

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta/llama-3.3-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function summarizeMeeting(transcript: string, subject: string): Promise<string> {
  return callLLM(
    `You are a meeting summarizer for a project management tool. Create a clear, structured summary of the meeting. Include:
1. **Meeting Overview** — 2-3 sentences about what was discussed
2. **Key Discussion Points** — bullet points of main topics
3. **Decisions Made** — any final decisions or agreements
4. **Open Questions** — unresolved items

Keep it concise and professional. Use markdown formatting.`,
    `Meeting subject: "${subject}"\n\nTranscript:\n${transcript.substring(0, 12000)}`
  );
}

export async function extractActionItems(transcript: string, subject: string): Promise<any[]> {
  const result = await callLLM(
    `You are a task extraction AI for a project management tool. Analyze the meeting transcript and extract all action items, tasks, and commitments.

For each action item, return a JSON array with objects containing:
- "title": clear task title (imperative form, e.g., "Review budget proposal")
- "description": brief context from the meeting
- "assignee": person's name who should do it (or "Unassigned" if unclear)
- "priority": "LOW", "MEDIUM", "HIGH", or "URGENT" based on urgency discussed
- "dueDate": estimated due date if mentioned (ISO format), or null

Return ONLY a valid JSON array. No other text.

Example:
[{"title":"Review Q1 budget","description":"Budget needs review before next sprint","assignee":"Lokesh","priority":"HIGH","dueDate":"2026-03-01"}]`,
    `Meeting subject: "${subject}"\n\nTranscript:\n${transcript.substring(0, 12000)}`
  );

  try {
    // Extract JSON from response (might have markdown code blocks)
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return [];
  } catch (e) {
    logger.error(`Failed to parse action items: ${e}`);
    return [];
  }
}

// ==================== Sync & Process ====================

export async function syncMeetings(userId: string, workspaceId?: string) {
  const token = await getValidToken(userId);
  if (!token) throw new Error("Microsoft account not connected");

  // Fetch meetings from calendar
  const events = await fetchRecentMeetings(token);
  const synced: any[] = [];

  for (const event of events) {
    const msJoinUrl = event.onlineMeeting?.joinUrl;
    const msMeetingId = event.id; // calendar event ID

    // Check if already synced
    const { rows: existing } = await pool.query(
      "SELECT id, status FROM meetings WHERE user_id = $1 AND ms_meeting_id = $2",
      [userId, msMeetingId]
    );
    if (existing.length > 0) {
      synced.push({ id: existing[0].id, subject: event.subject, status: existing[0].status });
      continue;
    }

    // Insert meeting
    const attendees = (event.attendees || []).map((a: any) => ({
      name: a.emailAddress?.name,
      email: a.emailAddress?.address,
    }));

    const { rows: inserted } = await pool.query(
      `INSERT INTO meetings (user_id, workspace_id, ms_meeting_id, subject, start_time, end_time, organizer, attendees, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'synced')
       RETURNING id`,
      [
        userId,
        workspaceId || null,
        msMeetingId,
        event.subject || "Untitled Meeting",
        event.start?.dateTime ? new Date(event.start.dateTime + "Z") : null,
        event.end?.dateTime ? new Date(event.end.dateTime + "Z") : null,
        event.organizer?.emailAddress?.name || null,
        JSON.stringify(attendees),
      ]
    );

    synced.push({ id: inserted[0].id, subject: event.subject, status: "synced" });
  }

  return synced;
}

export async function processMeeting(meetingId: string, userId: string, projectId?: string) {
  const token = await getValidToken(userId);
  if (!token) throw new Error("Microsoft account not connected");

  // Get meeting from DB
  const { rows } = await pool.query("SELECT * FROM meetings WHERE id = $1 AND user_id = $2", [meetingId, userId]);
  if (rows.length === 0) throw new Error("Meeting not found");
  const meeting = rows[0];

  // Try to fetch transcript via online meetings API
  // First, we need the online meeting ID (different from calendar event ID)
  let transcriptText = "";

  // Try fetching from onlineMeetings
  const onlineMeetings = await fetchOnlineMeetings(token);
  for (const om of onlineMeetings) {
    // Match by subject and time proximity
    if (meeting.subject && om.subject === meeting.subject) {
      const transcripts = await fetchTranscripts(token, om.id);
      if (transcripts.length > 0) {
        transcriptText = await fetchTranscriptContent(token, om.id, transcripts[0].id);
        break;
      }
    }
  }

  if (!transcriptText) {
    // Check if there's a manually uploaded transcript
    if (meeting.transcript_raw && meeting.transcript_raw.length > 50) {
      transcriptText = meeting.transcript_raw;
    } else {
      // Update status — no transcript available
      await pool.query(
        "UPDATE meetings SET status = 'no_transcript', updated_at = NOW() WHERE id = $1",
        [meetingId]
      );
      throw new Error("No transcript available. You can upload a transcript manually or ensure transcription was enabled during the meeting.");
    }
  }

  // Parse VTT
  const parsedTranscript = parseVtt(transcriptText);
  if (!parsedTranscript || parsedTranscript.length < 50) {
    await pool.query("UPDATE meetings SET status = 'empty_transcript', transcript_raw = $2, updated_at = NOW() WHERE id = $1", [meetingId, transcriptText]);
    throw new Error("Transcript is too short to process");
  }

  // AI: Summarize
  const summary = await summarizeMeeting(parsedTranscript, meeting.subject);

  // AI: Extract action items
  const actionItems = await extractActionItems(parsedTranscript, meeting.subject);

  // Update meeting record
  await pool.query(
    `UPDATE meetings SET
      transcript_raw = $2, summary = $3, action_items = $4,
      project_id = COALESCE($5, project_id),
      status = 'processed', processed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [meetingId, parsedTranscript, summary, JSON.stringify(actionItems), projectId || null]
  );

  return { summary, actionItems, transcriptLength: parsedTranscript.length };
}

export async function createTasksFromMeeting(
  meetingId: string,
  userId: string,
  projectId: string,
  workspaceId: string,
  prisma: any
) {
  const { rows } = await pool.query("SELECT * FROM meetings WHERE id = $1 AND user_id = $2", [meetingId, userId]);
  if (rows.length === 0) throw new Error("Meeting not found");
  const meeting = rows[0];

  if (!meeting.action_items || meeting.action_items.length === 0) {
    throw new Error("No action items to create tasks from. Process the meeting first.");
  }

  const actionItems: any[] = typeof meeting.action_items === 'string' 
    ? JSON.parse(meeting.action_items) 
    : meeting.action_items;

  // Get workspace members for assignee matching
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const createdTasks: any[] = [];

  for (const item of actionItems) {
    // Try to match assignee by name
    let assigneeId: string | null = null;
    if (item.assignee && item.assignee !== "Unassigned") {
      const match = members.find((m: any) =>
        m.user.name?.toLowerCase().includes(item.assignee.toLowerCase()) ||
        item.assignee.toLowerCase().includes(m.user.name?.toLowerCase() || "")
      );
      if (match) assigneeId = match.user.id;
    }

    const task = await prisma.task.create({
      data: {
        title: item.title,
        description: `${item.description || ""}\n\n---\n*Auto-created from Teams meeting: "${meeting.subject}"*`,
        projectId,
        status: "TODO",
        priority: item.priority || "MEDIUM",
        createdById: userId,
        dueDate: item.dueDate ? new Date(item.dueDate) : null,
        ...(assigneeId ? { assignees: { create: { userId: assigneeId } } } : {}),
      },
    });

    createdTasks.push({ taskId: task.id, title: item.title, assignee: item.assignee });
  }

  // Update meeting with created task IDs
  await pool.query(
    "UPDATE meetings SET tasks_created = $2, status = 'tasks_created', updated_at = NOW() WHERE id = $1",
    [meetingId, JSON.stringify(createdTasks)]
  );

  return createdTasks;
}

// ==================== List Meetings ====================

export async function listMeetings(userId: string, status?: string) {
  let query = "SELECT * FROM meetings WHERE user_id = $1";
  const params: any[] = [userId];
  if (status) {
    query += " AND status = $2";
    params.push(status);
  }
  query += " ORDER BY start_time DESC NULLS LAST LIMIT 50";
  const { rows } = await pool.query(query, params);
  return rows;
}

export async function getMeeting(meetingId: string, userId: string) {
  const { rows } = await pool.query("SELECT * FROM meetings WHERE id = $1 AND user_id = $2", [meetingId, userId]);
  return rows[0] || null;
}
