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

export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
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

export function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background-color:#0f0f13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:32px 20px">
      <div style="background:#1a1a24;border-radius:12px;border:1px solid #2a2a3a;overflow:hidden">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 28px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px">⚡ DKFlow</h1>
        </div>
        <div style="padding:28px;color:#e2e2ec;font-size:15px;line-height:1.7">
          ${body}
        </div>
        <div style="padding:16px 28px;border-top:1px solid #2a2a3a;text-align:center">
          <p style="margin:0;color:#6b6b80;font-size:11px">This is an automated notification from DKFlow · <a href="${process.env.APP_URL || 'https://dkflow.in'}" style="color:#818cf8;text-decoration:none">Open DKFlow</a></p>
        </div>
      </div>
    </div>
  </body></html>`;
}

function actionButton(url: string, label: string): string {
  return `<a href="${url}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px">${label}</a>`;
}

const APP_URL = process.env.APP_URL || "https://dkflow.in";

export async function sendTaskAssignedEmail(to: string, data: { assignerName: string; taskTitle: string; taskKey: string; taskUrl?: string }): Promise<boolean> {
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">📋 Task Assigned</p>
    <p><strong style="color:#c4b5fd">${data.assignerName}</strong> assigned you to <strong style="color:#818cf8">${data.taskKey}</strong>:</p>
    <div style="background:#12121a;border-left:3px solid #6366f1;padding:12px 16px;border-radius:6px;margin:12px 0">
      <p style="margin:0;font-size:16px;color:#ffffff">${data.taskTitle}</p>
    </div>
    ${actionButton(data.taskUrl || `${APP_URL}/home`, "View Task")}
  `);
  return sendMail(to, `[DKFlow] You were assigned to ${data.taskKey}`, html);
}

export async function sendCommentEmail(to: string, data: { commenterName: string; taskTitle: string; taskKey: string; commentSnippet: string }): Promise<boolean> {
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">💬 New Mention</p>
    <p><strong style="color:#c4b5fd">${data.commenterName}</strong> mentioned you on <strong style="color:#818cf8">${data.taskKey}</strong> — ${data.taskTitle}:</p>
    <div style="background:#12121a;border-left:3px solid #8b5cf6;padding:12px 16px;border-radius:6px;margin:12px 0">
      <p style="margin:0;color:#d4d4e0;font-style:italic">"${data.commentSnippet}"</p>
    </div>
    ${actionButton(`${APP_URL}/home`, "View Comment")}
  `);
  return sendMail(to, `[DKFlow] You were mentioned in ${data.taskKey}`, html);
}

export async function sendDueDateReminderEmail(to: string, data: { taskTitle: string; taskKey: string; dueDate: string }): Promise<boolean> {
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">⏰ Due Tomorrow</p>
    <p><strong style="color:#818cf8">${data.taskKey}</strong> is due on <strong style="color:#fbbf24">${data.dueDate}</strong>.</p>
    <div style="background:#12121a;border-left:3px solid #f59e0b;padding:12px 16px;border-radius:6px;margin:12px 0">
      <p style="margin:0;font-size:16px;color:#ffffff">${data.taskTitle}</p>
    </div>
    ${actionButton(`${APP_URL}/home`, "View Task")}
  `);
  return sendMail(to, `[DKFlow] ${data.taskKey} is due soon`, html);
}

export async function sendApprovalRequestEmail(to: string, data: { requesterName: string; taskTitle: string; taskKey: string }): Promise<boolean> {
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">✅ Approval Requested</p>
    <p><strong style="color:#c4b5fd">${data.requesterName}</strong> requested your approval for <strong style="color:#818cf8">${data.taskKey}</strong>:</p>
    <div style="background:#12121a;border-left:3px solid #22c55e;padding:12px 16px;border-radius:6px;margin:12px 0">
      <p style="margin:0;font-size:16px;color:#ffffff">${data.taskTitle}</p>
    </div>
    ${actionButton(`${APP_URL}/home`, "Review Task")}
  `);
  return sendMail(to, `[DKFlow] Approval requested for ${data.taskKey}`, html);
}

export async function sendInviteEmail(to: string, data: { inviterName: string; workspaceName: string; inviteCode: string; inviteUrl?: string }): Promise<boolean> {
  const url = data.inviteUrl || `${APP_URL}/invite/${data.inviteCode}`;
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">🎉 Workspace Invitation</p>
    <p><strong style="color:#c4b5fd">${data.inviterName}</strong> invited you to join <strong style="color:#818cf8">${data.workspaceName}</strong> on DKFlow.</p>
    ${actionButton(url, "Accept Invite")}
    <p style="color:#6b6b80;font-size:12px;margin-top:16px">Invite code: ${data.inviteCode}</p>
  `);
  return sendMail(to, `[DKFlow] You're invited to ${data.workspaceName}`, html);
}

export async function sendPasswordResetEmail(to: string, data: { resetUrl: string }): Promise<boolean> {
  const html = wrap(`
    <p style="color:#a5a5bf;margin:0 0 4px">🔑 Password Reset</p>
    <p>You requested a password reset for your DKFlow account.</p>
    ${actionButton(data.resetUrl, "Reset Password")}
    <p style="color:#6b6b80;font-size:13px;margin-top:16px">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `);
  return sendMail(to, `[DKFlow] Password Reset`, html);
}
