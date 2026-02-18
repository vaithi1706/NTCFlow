import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, any>;
}

export async function fireWebhooks(
  prisma: PrismaClient,
  workspaceId: string,
  event: string,
  data: Record<string, any>
) {
  console.log(`[webhook] Firing ${event} for workspace ${workspaceId}`);
  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
  });
  console.log(`[webhook] Found ${webhooks.length} matching webhooks`);

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  const body = JSON.stringify(payload);

  const promises = webhooks.map(async (wh) => {
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (wh.secret) {
        const sig = crypto.createHmac("sha256", wh.secret).update(body).digest("hex");
        headers["X-DKFlow-Signature"] = `sha256=${sig}`;
      }

      const res = await fetch(wh.url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(10000),
      });

      // Update last triggered
      await prisma.webhook.update({
        where: { id: wh.id },
        data: { lastTriggeredAt: new Date() },
      }).catch(() => {});

      if (!res.ok) {
        console.error(`Webhook ${wh.name} failed: ${res.status}`);
      }
    } catch (err) {
      console.error(`Webhook ${wh.name} error:`, err);
    }
  });

  await Promise.allSettled(promises);
}
