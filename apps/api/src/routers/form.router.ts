import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { requireProjectAccess, getWorkspaceIdFromProject } from "../middleware/permissions.js";
import { requireFeature } from "../middleware/subscription.js";

function generateSlug(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export const formRouter = router({
  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      fields: z.any().default([]),
      allowedFields: z.any().default(["title", "description", "priority", "type", "email"]),
      defaultType: z.string().default("bug"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      const wsId = await getWorkspaceIdFromProject(ctx.prisma, input.projectId);
      await requireFeature(wsId, "publicForms");
      const slug = generateSlug();
      return ctx.prisma.form.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description || null,
          fields: input.fields,
          allowedFields: input.allowedFields,
          defaultType: input.defaultType,
          slug,
          createdById: ctx.user.userId,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      fields: z.any().optional(),
      allowedFields: z.any().optional(),
      isActive: z.boolean().optional(),
      defaultType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({ where: { id: input.id } });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, form.projectId);
      const { id, ...data } = input;
      return ctx.prisma.form.update({ where: { id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({ where: { id: input.id } });
      if (!form) throw new TRPCError({ code: "NOT_FOUND" });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, form.projectId);
      return ctx.prisma.form.delete({ where: { id: input.id } });
    }),

  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.form.findMany({
        where: { projectId: input.projectId },
        include: { createdBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  getPublic: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({
        where: { slug: input.slug },
        include: {
          project: { select: { id: true, name: true, color: true, icon: true, taskPrefix: true } },
        },
      });
      if (!form || !form.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });
      return {
        id: form.id,
        title: form.title,
        description: form.description,
        fields: form.fields,
        allowedFields: form.allowedFields,
        defaultType: form.defaultType,
        project: form.project,
      };
    }),

  submitPublic: publicProcedure
    .input(z.object({
      slug: z.string(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      priority: z.enum(["none", "low", "medium", "high", "urgent"]).default("none"),
      type: z.enum(["bug", "feature", "story", "task", "epic"]).optional(),
      email: z.string().email().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.prisma.form.findUnique({
        where: { slug: input.slug },
        include: { project: true },
      });
      if (!form || !form.isActive) throw new TRPCError({ code: "NOT_FOUND", message: "Form not found or inactive" });

      // Increment task counter
      const project = await ctx.prisma.project.update({
        where: { id: form.projectId },
        data: { taskCounter: { increment: 1 } },
      });

      // Get first column
      const firstColumn = await ctx.prisma.boardColumn.findFirst({
        where: { projectId: form.projectId },
        orderBy: { position: "asc" },
      });

      const task = await ctx.prisma.task.create({
        data: {
          projectId: form.projectId,
          title: input.title,
          description: input.description
            ? input.description + (input.email ? `\n\n---\nSubmitted by: ${input.email}` : "")
            : input.email ? `Submitted by: ${input.email}` : null,
          taskNumber: project.taskCounter,
          type: (input.type || form.defaultType || "bug") as any,
          priority: input.priority as any,
          status: "todo",
          columnId: firstColumn?.id || null,
        },
      });

      return { success: true, taskNumber: task.taskNumber, taskPrefix: form.project.taskPrefix };
    }),
});
