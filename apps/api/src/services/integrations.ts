import { PrismaClient } from "@prisma/client";

type IntegrationEvent =
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.assigned"
  | "task.deleted"
  | "task.status_changed"
  | "task.priority_changed"
  | "comment.created"
  | "sprint.started"
  | "sprint.completed"
  | "project.created"
  | "project.updated"
  | "member.added"
  | "member.removed";

interface NotifyPayload {
  title: string;
  description?: string;
  url?: string;
  fields?: { label: string; value: string }[];
  rawData?: Record<string, any>;
}

const EVENT_EMOJI: Record<string, string> = {
  "task.created": "🆕",
  "task.updated": "📝",
  "task.completed": "✅",
  "task.assigned": "👤",
  "task.deleted": "🗑️",
  "task.status_changed": "🔄",
  "task.priority_changed": "🎯",
  "comment.created": "💬",
  "sprint.started": "🏃",
  "sprint.completed": "🏁",
  "project.created": "📂",
  "project.updated": "📂",
  "member.added": "➕",
  "member.removed": "➖",
};

function buildSlackMessage(event: IntegrationEvent, payload: NotifyPayload) {
  const emoji = EVENT_EMOJI[event] || "📋";

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
  const emoji = EVENT_EMOJI[event] || "📋";

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

function buildZapierPayload(event: IntegrationEvent, payload: NotifyPayload) {
  // Zapier expects flat JSON with descriptive keys
  return {
    event,
    title: payload.title,
    description: payload.description || "",
    url: payload.url || "",
    timestamp: new Date().toISOString(),
    source: "DKFlow",
    ...(payload.fields?.reduce((acc, f) => ({ ...acc, [f.label.toLowerCase().replace(/\s+/g, "_")]: f.value }), {}) || {}),
    ...(payload.rawData || {}),
  };
}

function buildGenericWebhookPayload(event: IntegrationEvent, payload: NotifyPayload) {
  return {
    event,
    timestamp: new Date().toISOString(),
    data: {
      title: payload.title,
      description: payload.description,
      url: payload.url,
      fields: payload.fields,
      ...payload.rawData,
    },
  };
}

function buildPayloadForType(type: string, event: IntegrationEvent, payload: NotifyPayload) {
  switch (type) {
    case "slack":
      return buildSlackMessage(event, payload);
    case "teams":
      return buildTeamsMessage(event, payload);
    case "zapier":
      return buildZapierPayload(event, payload);
    case "github":
    case "google_calendar":
    case "generic_webhook":
    default:
      return buildGenericWebhookPayload(event, payload);
  }
}

export async function notifyIntegrations(
  prisma: PrismaClient,
  workspaceId: string,
  event: IntegrationEvent,
  payload: NotifyPayload
) {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, isActive: true, events: { has: event } },
  });

  const promises = integrations.map(async (intg) => {
    try {
      const body = buildPayloadForType(intg.type, event, payload);

      const res = await fetch(intg.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.error(`Integration ${intg.name} (${intg.type}) failed: ${res.status}`);
      }
    } catch (err) {
      console.error(`Integration ${intg.name} (${intg.type}) error:`, err);
    }
  });

  await Promise.allSettled(promises);
}

export async function sendTestMessage(webhookUrl: string, type: string) {
  const event = "task.created" as IntegrationEvent;
  const payload: NotifyPayload = {
    title: "Test notification from DKFlow",
    description: "If you see this message, your integration is working correctly! 🎉",
    fields: [
      { label: "Status", value: "Connected" },
      { label: "Type", value: type },
    ],
  };

  const body = buildPayloadForType(type, event, payload);

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Webhook returned ${res.status}: ${await res.text().catch(() => "")}`);
  }
}
