import nodemailer from "nodemailer";
import { logger } from "../utils/logger.js";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || "DKFlow <noreply@dkflow.app>";

let transporter: nodemailer.Transporter | null = null;
let etherealReady = false;

async function initEtherealTransporter(): Promise<void> {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    logger.info("[email] Using configured SMTP server");
    return;
  }

  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    etherealReady = true;
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    logger.info("[email] ✉️  Ethereal test email account created");
    logger.info(`[email]    User: ${testAccount.user}`);
    logger.info(`[email]    Pass: ${testAccount.pass}`);
    logger.info(`[email]    Inbox: https://ethereal.email/login`);
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  } catch (err) {
    logger.error("[email] Failed to create Ethereal account:", err);
  }
}

export async function initEmail(): Promise<void> {
  await initEtherealTransporter();
}

function getTransporter(): nodemailer.Transporter | null {
  return transporter;
}

async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[email] SMTP not configured, skipping email to ${to}`);
    return false;
  }
  try {
    logger.info(`[email] Sending to=${to} subject="${subject}"`);
    const info = await t.sendMail({ from: SMTP_FROM, to, subject, html });
    logger.info(`[email] ✅ Sent to=${to} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} messageId=${info.messageId}`);
    if (etherealReady) {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        logger.info(`[email] 📧 Preview URL: ${previewUrl}`);
      }
    }
    return true;
  } catch (err: any) {
    logger.error(`[email] ❌ Failed to send to=${to} error=${err.message} code=${err.code} responseCode=${err.responseCode}`);
    return false;
  }
}

// ─── Templates ──────────────────────────────────────────

function wrap(body: string): string {
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
    <div style="border-bottom:2px solid #6366f1;padding-bottom:10px;margin-bottom:20px">
      <h2 style="margin:0;color:#6366f1">DKFlow</h2>
    </div>
    ${body}
    <div style="margin-top:30px;padding-top:10px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
      This is an automated notification from DKFlow.
    </div>
  </div>`;
}

export async function sendTaskAssignedEmail(to: string, data: { assignerName: string; taskTitle: string; taskKey: string; taskUrl?: string }): Promise<boolean> {
  const html = wrap(`
    <p><strong>${data.assignerName}</strong> assigned you to <strong>${data.taskKey}</strong>:</p>
    <p style="font-size:16px">${data.taskTitle}</p>
    ${data.taskUrl ? `<a href="${data.taskUrl}" style="display:inline-block;padding:8px 16px;background:#6366f1;color:white;border-radius:6px;text-decoration:none">View Task</a>` : ""}
  `);
  return sendMail(to, `[DKFlow] You were assigned to ${data.taskKey}`, html);
}

export async function sendCommentEmail(to: string, data: { commenterName: string; taskTitle: string; taskKey: string; commentSnippet: string }): Promise<boolean> {
  const html = wrap(`
    <p><strong>${data.commenterName}</strong> commented on <strong>${data.taskKey}</strong> — ${data.taskTitle}:</p>
    <blockquote style="border-left:3px solid #6366f1;padding-left:12px;color:#4b5563">${data.commentSnippet}</blockquote>
  `);
  return sendMail(to, `[DKFlow] New comment on ${data.taskKey}`, html);
}

export async function sendDueDateReminderEmail(to: string, data: { taskTitle: string; taskKey: string; dueDate: string }): Promise<boolean> {
  const html = wrap(`
    <p>Reminder: <strong>${data.taskKey}</strong> is due on <strong>${data.dueDate}</strong>.</p>
    <p style="font-size:16px">${data.taskTitle}</p>
  `);
  return sendMail(to, `[DKFlow] ${data.taskKey} is due soon`, html);
}

export async function sendInviteEmail(to: string, data: { inviterName: string; workspaceName: string; inviteCode: string; inviteUrl?: string }): Promise<boolean> {
  const baseUrl = process.env.APP_URL || "http://72.61.173.123";
  const url = data.inviteUrl || `${baseUrl}/invite/${data.inviteCode}`;
  const html = wrap(`
    <p><strong>${data.inviterName}</strong> invited you to join <strong>${data.workspaceName}</strong> on DKFlow.</p>
    <a href="${url}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:white;border-radius:6px;text-decoration:none">Accept Invite</a>
    <p style="color:#9ca3af;font-size:12px">Invite code: ${data.inviteCode}</p>
  `);
  return sendMail(to, `[DKFlow] You're invited to ${data.workspaceName}`, html);
}

export async function sendPasswordResetEmail(to: string, data: { resetUrl: string }): Promise<boolean> {
  const html = wrap(`
    <p>You requested a password reset for your DKFlow account.</p>
    <a href="${data.resetUrl}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:white;border-radius:6px;text-decoration:none;margin:16px 0">Reset Password</a>
    <p style="color:#9ca3af;font-size:13px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);
  return sendMail(to, `[DKFlow] Password Reset`, html);
}
