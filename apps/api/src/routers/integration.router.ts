import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { sendTestMessage } from "../services/integrations.js";
import { requireFeature } from "../middleware/subscription.js";

const integrationTypeEnum = z.enum(["slack", "teams", "zapier", "github", "google_calendar", "generic_webhook"]);

const VALID_EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "task.assigned",
  "task.deleted",
  "task.status_changed",
  "task.priority_changed",
  "comment.created",
  "sprint.started",
  "sprint.completed",
  "project.created",
  "project.updated",
  "member.added",
  "member.removed",
] as const;

export const integrationRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.integration.findMany({
        where: { workspaceId: input.workspaceId },
        include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        type: integrationTypeEnum,
        name: z.string().min(1).max(100),
        webhookUrl: z.string().url(),
        channel: z.string().max(200).optional(),
        events: z.array(z.enum(VALID_EVENTS)).min(1),
        config: z
          .object({
            // GitHub-specific
            repo: z.string().optional(),
            branch: z.string().optional(),
            // Google Calendar specific
            calendarId: z.string().optional(),
            // Zapier specific
            zapId: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireFeature(input.workspaceId, "integrations");
      return ctx.prisma.integration.create({
        data: {
          workspaceId: input.workspaceId,
          type: input.type,
          name: input.name,
          webhookUrl: input.webhookUrl,
          channel: input.channel,
          events: input.events,
          createdById: ctx.user.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(100).optional(),
        webhookUrl: z.string().url().optional(),
        channel: z.string().max(200).optional(),
        events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.integration.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.integration.delete({ where: { id: input.id } });
      return { success: true };
    }),

  test: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const intg = await ctx.prisma.integration.findUniqueOrThrow({ where: { id: input.id } });
      try {
        await sendTestMessage(intg.webhookUrl, intg.type);
        return { success: true };
      } catch (err: any) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err.message || "Failed to send test message",
        });
      }
    }),

  // Available integration types with metadata
  availableTypes: protectedProcedure.query(() => {
    return [
      {
        type: "slack",
        name: "Slack",
        description: "Send notifications to Slack channels",
        icon: "slack",
        setupUrl: "https://api.slack.com/messaging/webhooks",
        fields: [
          { key: "webhookUrl", label: "Webhook URL", type: "url", required: true },
          { key: "channel", label: "Channel Name", type: "text", required: false },
        ],
      },
      {
        type: "teams",
        name: "Microsoft Teams",
        description: "Send notifications to Teams channels",
        icon: "teams",
        setupUrl: "https://learn.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook",
        fields: [
          { key: "webhookUrl", label: "Webhook URL", type: "url", required: true },
        ],
      },
      {
        type: "zapier",
        name: "Zapier",
        description: "Connect DKFlow to 5,000+ apps via Zapier webhooks",
        icon: "zapier",
        setupUrl: "https://zapier.com/apps/webhook/integrations",
        fields: [
          { key: "webhookUrl", label: "Zapier Webhook URL", type: "url", required: true },
        ],
      },
      {
        type: "github",
        name: "GitHub",
        description: "Link commits and PRs to tasks, auto-update task status",
        icon: "github",
        setupUrl: "https://github.com/settings/tokens",
        fields: [
          { key: "webhookUrl", label: "Repository Webhook URL or Token", type: "url", required: true },
          { key: "channel", label: "Repository (owner/repo)", type: "text", required: false },
        ],
      },
      {
        type: "google_calendar",
        name: "Google Calendar",
        description: "Sync due dates and milestones with Google Calendar",
        icon: "google_calendar",
        setupUrl: "https://console.cloud.google.com",
        fields: [
          { key: "webhookUrl", label: "Calendar Webhook URL", type: "url", required: true },
          { key: "channel", label: "Calendar ID", type: "text", required: false },
        ],
      },
      {
        type: "generic_webhook",
        name: "Generic Webhook",
        description: "Send JSON payloads to any URL on events",
        icon: "webhook",
        fields: [
          { key: "webhookUrl", label: "Webhook URL", type: "url", required: true },
        ],
      },
    ];
  }),

  // Available events
  availableEvents: protectedProcedure.query(() => {
    return [
      { event: "task.created", label: "Task Created", category: "Tasks" },
      { event: "task.updated", label: "Task Updated", category: "Tasks" },
      { event: "task.completed", label: "Task Completed", category: "Tasks" },
      { event: "task.assigned", label: "Task Assigned", category: "Tasks" },
      { event: "task.deleted", label: "Task Deleted", category: "Tasks" },
      { event: "task.status_changed", label: "Status Changed", category: "Tasks" },
      { event: "task.priority_changed", label: "Priority Changed", category: "Tasks" },
      { event: "comment.created", label: "Comment Added", category: "Comments" },
      { event: "sprint.started", label: "Sprint Started", category: "Sprints" },
      { event: "sprint.completed", label: "Sprint Completed", category: "Sprints" },
      { event: "project.created", label: "Project Created", category: "Projects" },
      { event: "project.updated", label: "Project Updated", category: "Projects" },
      { event: "member.added", label: "Member Added", category: "Members" },
      { event: "member.removed", label: "Member Removed", category: "Members" },
    ];
  }),
});
