import { PrismaClient } from "@prisma/client";

type IntegrationEvent =
  | "task.created"
  | "task.completed"
  | "task.assigned"
  | "comment.created"
  | "sprint.started"
  | "sprint.completed";

interface NotifyPayload {
  title: string;
  description?: string;
  url?: string;
  fields?: { label: string; value: string }[];
}

function buildSlackMessage(event: IntegrationEvent, payload: NotifyPayload) {
  const emoji =
    event.startsWith("task.created") ? "🆕" :
    event.startsWith("task.completed") ? "✅" :
    event.startsWith("task.assigned") ? "👤" :
    event.startsWith("comment") ? "💬" :
    event.startsWith("sprint.started") ? "🏃" :
    event.startsWith("sprint.completed") ? "🏁" : "📋";

  const blocks: any[] = [
    {
      type: "section",
      text: { type: "mrkdwn", text: `${emoji} *${payload.title}*` },
    },
  ];

  if (payload.description) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: payload.description },
    });
  }

  if (payload.fields?.length) {
    blocks.push({
      type: "section",
      fields: payload.fields.map((f) => ({
        type: "mrkdwn",
        text: `*${f.label}:* ${f.value}`,
      })),
    });
  }

  if (payload.url) {
    blocks.push({
      type: "actions",
      elements: [
        { type: "button", text: { type: "plain_text", text: "View in DKFlow" }, url: payload.url },
      ],
    });
  }

  return { blocks };
}

function buildTeamsMessage(event: IntegrationEvent, payload: NotifyPayload) {
  const emoji =
    event.startsWith("task.created") ? "🆕" :
    event.startsWith("task.completed") ? "✅" :
    event.startsWith("task.assigned") ? "👤" :
    event.startsWith("comment") ? "💬" :
    event.startsWith("sprint.started") ? "🏃" :
    event.startsWith("sprint.completed") ? "🏁" : "📋";

  const body: any[] = [
    { type: "TextBlock", text: `${emoji} ${payload.title}`, weight: "Bolder", size: "Medium" },
  ];

  if (payload.description) {
    body.push({ type: "TextBlock", text: payload.description, wrap: true });
  }

  if (payload.fields?.length) {
    body.push({
      type: "FactSet",
      facts: payload.fields.map((f) => ({ title: f.label, value: f.value })),
    });
  }

  const actions: any[] = [];
  if (payload.url) {
    actions.push({ type: "Action.OpenUrl", title: "View in DKFlow", url: payload.url });
  }

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body,
          ...(actions.length ? { actions } : {}),
        },
      },
    ],
  };
}

export async function notifyIntegrations(
  prisma: PrismaClient,
  workspaceId: string,
  event: IntegrationEvent,
  payload: NotifyPayload,
) {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
  });

  const promises = integrations.map(async (intg) => {
    const body =
      intg.type === "slack"
        ? buildSlackMessage(event, payload)
        : buildTeamsMessage(event, payload);

    await fetch(intg.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  });

  await Promise.allSettled(promises);
}

export async function sendTestMessage(webhookUrl: string, type: "slack" | "teams") {
  const payload: NotifyPayload = {
    title: "Test notification from DKFlow",
    description: "If you see this message, your integration is working correctly! 🎉",
    fields: [{ label: "Status", value: "Connected" }],
  };

  const body =
    type === "slack"
      ? buildSlackMessage("task.created", payload)
      : buildTeamsMessage("task.created", payload);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
