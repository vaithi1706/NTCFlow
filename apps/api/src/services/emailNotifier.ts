import { prisma } from "../lib/prisma.js";
import { sendTaskAssignedEmail, sendCommentEmail, sendApprovalRequestEmail, sendDueDateReminderEmail } from "./email.js";
import { logger } from "../utils/logger.js";

const APP_URL = process.env.APP_URL || "http://72.61.173.123";

// Simple debounce map: key → timeout
const pendingEmails = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 5000;

async function getUserEmailPrefs(userId: string): Promise<Record<string, boolean>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPreferences: true },
  });
  return (user?.notificationPreferences as Record<string, boolean>) || {};
}

function isPrefEnabled(prefs: Record<string, boolean>, key: string): boolean {
  return prefs[key] !== false; // default true
}

function debounceEmail(key: string, fn: () => Promise<void>) {
  const existing = pendingEmails.get(key);
  if (existing) clearTimeout(existing);
  pendingEmails.set(
    key,
    setTimeout(async () => {
      pendingEmails.delete(key);
      try { await fn(); } catch (err) {
        logger.error(`[emailNotifier] Failed: ${key}`, err);
      }
    }, DEBOUNCE_MS)
  );
}

export async function notifyTaskAssigned(
  assigneeId: string,
  assignerName: string,
  taskTitle: string,
  taskKey: string,
) {
  const prefs = await getUserEmailPrefs(assigneeId);
  if (!isPrefEnabled(prefs, "email_assignments")) return;

  const user = await prisma.user.findUnique({ where: { id: assigneeId }, select: { email: true } });
  if (!user?.email) return;

  debounceEmail(`assign:${taskKey}:${assigneeId}`, () =>
    sendTaskAssignedEmail(user.email, { assignerName, taskTitle, taskKey, taskUrl: `${APP_URL}/home` }).then(() => {})
  );
}

export async function notifyMentioned(
  mentionedUserId: string,
  commenterName: string,
  taskTitle: string,
  taskKey: string,
  commentSnippet: string
) {
  const prefs = await getUserEmailPrefs(mentionedUserId);
  if (!isPrefEnabled(prefs, "email_mentions")) return;

  const user = await prisma.user.findUnique({ where: { id: mentionedUserId }, select: { email: true } });
  if (!user?.email) return;

  debounceEmail(`mention:${taskKey}:${mentionedUserId}`, () =>
    sendCommentEmail(user.email, { commenterName, taskTitle, taskKey, commentSnippet: commentSnippet.slice(0, 300) }).then(() => {})
  );
}

export async function notifyApprovalRequested(
  approverId: string,
  requesterName: string,
  taskTitle: string,
  taskKey: string
) {
  const prefs = await getUserEmailPrefs(approverId);
  if (!isPrefEnabled(prefs, "email_assignments")) return;

  const user = await prisma.user.findUnique({ where: { id: approverId }, select: { email: true } });
  if (!user?.email) return;

  debounceEmail(`approval:${taskKey}:${approverId}`, () =>
    sendApprovalRequestEmail(user.email, { requesterName, taskTitle, taskKey }).then(() => {})
  );
}

/**
 * Sends due-date reminder emails for tasks due tomorrow.
 * Call once daily (e.g. via setInterval in index.ts).
 */
export async function sendDueDateReminders() {
  const now = new Date();
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: tomorrowStart, lte: tomorrowEnd },
      deletedAt: null,
      completedAt: null,
      status: { notIn: ["done", "cancelled"] },
    },
    include: {
      assignees: { include: { user: { select: { id: true, email: true, notificationPreferences: true } } } },
      project: { select: { taskPrefix: true } },
    },
  });

  let sent = 0;
  for (const task of tasks) {
    const taskKey = `${task.project.taskPrefix}-${task.taskNumber}`;
    const dueStr = task.dueDate!.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    for (const a of task.assignees) {
      const prefs = (a.user.notificationPreferences as Record<string, boolean>) || {};
      if (prefs.email_due_dates === false) continue;
      if (!a.user.email) continue;

      try {
        await sendDueDateReminderEmail(a.user.email, { taskTitle: task.title, taskKey, dueDate: dueStr });
        sent++;
      } catch (err) {
        logger.error(`[emailNotifier] Due date reminder failed for ${taskKey} → ${a.user.email}`, err);
      }
    }
  }

  if (sent > 0) logger.info(`[emailNotifier] Sent ${sent} due-date reminder(s) for ${tasks.length} task(s)`);
}
