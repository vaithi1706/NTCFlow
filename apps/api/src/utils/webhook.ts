import crypto from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { logger } from "./logger.js";

export async function fireWebhooks(
  prisma: PrismaClient,
  workspaceId: string,
  event: string,
  payload: any
) {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: event },
      },
    });

    for (const webhook of webhooks) {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const headers: Record<string, string> = { "Content-Type": "application/json" };

      if (webhook.secret) {
        const sig = crypto.createHmac("sha256", webhook.secret).update(body).digest("hex");
        headers["X-DKFlow-Signature"] = `sha256=${sig}`;
      }

      fetch(webhook.url, { method: "POST", headers, body, signal: AbortSignal.timeout(10000) })
        .then(async (res) => {
          if (res.ok) {
            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { lastTriggeredAt: new Date(), failCount: 0 },
            });
          } else {
            await prisma.webhook.update({
              where: { id: webhook.id },
              data: { lastTriggeredAt: new Date(), failCount: { increment: 1 } },
            });
          }
        })
        .catch(async () => {
          await prisma.webhook.update({
            where: { id: webhook.id },
            data: { failCount: { increment: 1 } },
          }).catch(() => {});
        });
    }
  } catch (err) {
    logger.error("fireWebhooks error", err);
  }
}
