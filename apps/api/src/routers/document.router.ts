import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import { requireProjectAccess } from "../middleware/permissions.js";
import { generateVersionSummary, indexDocument, semanticSearch } from "../services/document-ai.js";

// ─── Category Router ────────────────────────────────────────────────

const categoryRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.documentCategory.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { documents: true, children: true } },
        },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(200),
      parentId: z.string().uuid().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      if (input.parentId) {
        const parent = await ctx.prisma.documentCategory.findFirst({
          where: { id: input.parentId, projectId: input.projectId },
        });
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent category not found" });
      }
      return ctx.prisma.documentCategory.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId || null,
          color: input.color,
        },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(200).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.documentCategory.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, cat.projectId);
      const data: any = {};
      if (input.name) data.name = input.name;
      if (input.color) data.color = input.color;
      return ctx.prisma.documentCategory.update({ where: { id: input.id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cat = await ctx.prisma.documentCategory.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, cat.projectId);
      // Unset category from documents
      await ctx.prisma.document.updateMany({ where: { categoryId: input.id }, data: { categoryId: null } });
      // Move children to parent
      await ctx.prisma.documentCategory.updateMany({ where: { parentId: input.id }, data: { parentId: cat.parentId } });
      await ctx.prisma.documentCategory.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

// ─── Folder Router ──────────────────────────────────────────────────

const folderRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.documentFolder.findMany({
        where: { projectId: input.projectId },
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { documents: true, children: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(255),
      parentId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      if (input.parentId) {
        const parent = await ctx.prisma.documentFolder.findFirst({
          where: { id: input.parentId, projectId: input.projectId },
        });
        if (!parent) throw new TRPCError({ code: "NOT_FOUND", message: "Parent folder not found" });
      }
      return ctx.prisma.documentFolder.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          parentId: input.parentId || null,
          createdById: ctx.user.userId,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string().uuid(), name: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.documentFolder.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, folder.projectId);
      return ctx.prisma.documentFolder.update({ where: { id: input.id }, data: { name: input.name } });
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string().uuid(), parentId: z.string().uuid().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.documentFolder.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, folder.projectId);
      return ctx.prisma.documentFolder.update({ where: { id: input.id }, data: { parentId: input.parentId } });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await ctx.prisma.documentFolder.findUniqueOrThrow({
        where: { id: input.id },
        include: { _count: { select: { documents: true, children: true } } },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, folder.projectId);
      if (folder._count.documents > 0 || folder._count.children > 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Folder is not empty" });
      }
      await ctx.prisma.documentFolder.delete({ where: { id: input.id } });
      return { success: true };
    }),
});

// ─── Tag Router ─────────────────────────────────────────────────────

const tagRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.documentTag.findMany({
        where: { projectId: input.projectId },
        include: { _count: { select: { documents: true } } },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      name: z.string().min(1).max(100),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.documentTag.create({
        data: { projectId: input.projectId, name: input.name, color: input.color },
      });
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.documentTag.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, tag.projectId);
      return ctx.prisma.documentTag.update({
        where: { id: input.id },
        data: { ...(input.name && { name: input.name }), ...(input.color && { color: input.color }) },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tag = await ctx.prisma.documentTag.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, tag.projectId);
      await ctx.prisma.documentTag.delete({ where: { id: input.id } });
      return { success: true };
    }),

  assign: protectedProcedure
    .input(z.object({ documentId: z.string().uuid(), tagId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return ctx.prisma.documentTagLink.create({
        data: { documentId: input.documentId, tagId: input.tagId },
      });
    }),

  unassign: protectedProcedure
    .input(z.object({ documentId: z.string().uuid(), tagId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      await ctx.prisma.documentTagLink.delete({
        where: { documentId_tagId: { documentId: input.documentId, tagId: input.tagId } },
      });
      return { success: true };
    }),
});

// ─── Task Link Router ───────────────────────────────────────────────

const taskLinkRouter = router({
  list: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return ctx.prisma.documentTaskLink.findMany({
        where: { documentId: input.documentId },
        include: {
          task: {
            select: {
              id: true, title: true, taskNumber: true, status: true, priority: true,
              column: { select: { id: true, name: true } },
            },
          },
        },
      });
    }),

  link: protectedProcedure
    .input(z.object({ documentId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return ctx.prisma.documentTaskLink.create({
        data: { documentId: input.documentId, taskId: input.taskId },
      });
    }),

  unlink: protectedProcedure
    .input(z.object({ documentId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.documentTaskLink.delete({
        where: { documentId_taskId: { documentId: input.documentId, taskId: input.taskId } },
      });
      return { success: true };
    }),
});

// ─── Version Router ─────────────────────────────────────────────────

const versionRouter = router({
  list: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return ctx.prisma.documentVersion.findMany({
        where: { documentId: input.documentId },
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { versionNumber: "desc" },
      });
    }),

  rollback: protectedProcedure
    .input(z.object({ documentId: z.string().uuid(), versionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);

      const oldVersion = await ctx.prisma.documentVersion.findUniqueOrThrow({
        where: { id: input.versionId },
      });

      // Create a new version that copies the old one
      const newVersion = await ctx.prisma.documentVersion.create({
        data: {
          documentId: input.documentId,
          versionNumber: doc.totalVersions + 1,
          fileName: oldVersion.fileName,
          fileUrl: oldVersion.fileUrl,
          fileSize: oldVersion.fileSize,
          mimeType: oldVersion.mimeType,
          versionNote: `Rolled back to v${oldVersion.versionNumber}`,
          uploadedById: ctx.user.userId,
        },
      });

      await ctx.prisma.document.update({
        where: { id: input.documentId },
        data: {
          currentVersionId: newVersion.id,
          totalVersions: { increment: 1 },
        },
      });

      return newVersion;
    }),
});

// ─── Helpers ────────────────────────────────────────────────────────

function classifyFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "word";
  if (mimeType.includes("sheet") || mimeType.includes("excel") || mimeType.includes("csv")) return "spreadsheet";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("tar") || mimeType.includes("gz")) return "archive";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  return "other";
}

// ─── Main Document Router ───────────────────────────────────────────

export const documentRouter = router({
  category: categoryRouter,
  folder: folderRouter,
  tag: tagRouter,
  taskLink: taskLinkRouter,
  version: versionRouter,

  list: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      folderId: z.string().uuid().nullable().optional(),
      tagId: z.string().uuid().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      search: z.string().optional(),
      fileType: z.string().optional(),
      includeDeleted: z.boolean().default(false),
      sortBy: z.enum(["title", "createdAt", "updatedAt", "fileType", "totalVersions"]).default("updatedAt"),
      sortDir: z.enum(["asc", "desc"]).default("desc"),
      limit: z.number().int().min(1).max(200).default(50),
      cursor: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const where: any = { projectId: input.projectId };

      if (input.folderId !== undefined) {
        where.folderId = input.folderId;
      }
      if (!input.includeDeleted) {
        where.deletedAt = null;
      } else {
        where.deletedAt = { not: null };
      }
      if (input.search) {
        where.OR = [
          { title: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.fileType) {
        where.fileType = input.fileType;
      }
      if (input.tagId) {
        where.tags = { some: { tagId: input.tagId } };
      }
      if (input.categoryId !== undefined) {
        where.categoryId = input.categoryId;
      }

      const docs = await ctx.prisma.document.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          currentVersion: {
            include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
          },
          category: { select: { id: true, name: true, color: true, parentId: true, parent: { select: { id: true, name: true, color: true } } } },
          tags: { include: { tag: true } },
          _count: { select: { versions: true, taskLinks: true } },
        },
        orderBy: { [input.sortBy]: input.sortDir },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      const hasMore = docs.length > input.limit;
      if (hasMore) docs.pop();
      return { documents: docs, nextCursor: hasMore ? docs[docs.length - 1]?.id : null };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          folder: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, color: true, parentId: true, parent: { select: { id: true, name: true, color: true } } } },
          currentVersion: {
            include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
          },
          versions: {
            include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
            orderBy: { versionNumber: "desc" },
          },
          tags: { include: { tag: true } },
          taskLinks: {
            include: {
              task: {
                select: { id: true, title: true, taskNumber: true, status: true, priority: true },
              },
            },
          },
        },
      });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return doc;
    }),

  create: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      title: z.string().min(1).max(500),
      description: z.string().optional(),
      folderId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileSize: z.number().int().positive(),
      mimeType: z.string(),
      versionNote: z.string().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);

      const fileType = classifyFileType(input.mimeType);

      const doc = await ctx.prisma.document.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          description: input.description || null,
          folderId: input.folderId || null,
          categoryId: input.categoryId || null,
          createdById: ctx.user.userId,
          fileType,
          totalVersions: 1,
        },
      });

      const version = await ctx.prisma.documentVersion.create({
        data: {
          documentId: doc.id,
          versionNumber: 1,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          versionNote: input.versionNote || "Initial upload",
          uploadedById: ctx.user.userId,
        },
      });

      await ctx.prisma.document.update({
        where: { id: doc.id },
        data: { currentVersionId: version.id },
      });

      if (input.tagIds?.length) {
        await ctx.prisma.documentTagLink.createMany({
          data: input.tagIds.map((tagId) => ({ documentId: doc.id, tagId })),
        });
      }

      // AI: Generate initial summary + index (async, non-blocking)
      generateVersionSummary(ctx.prisma, doc.id, version.id)
        .then(async (summary) => {
          if (summary) {
            await ctx.prisma.documentVersion.update({
              where: { id: version.id },
              data: { versionNote: summary },
            });
          }
        })
        .catch((err) => console.error("[doc-ai] Summary error:", err));

      indexDocument(ctx.prisma, doc.id).catch((err) =>
        console.error("[doc-ai] Index error:", err)
      );

      return { ...doc, currentVersionId: version.id };
    }),

  uploadVersion: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileSize: z.number().int().positive(),
      mimeType: z.string(),
      versionNote: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);

      const version = await ctx.prisma.documentVersion.create({
        data: {
          documentId: input.documentId,
          versionNumber: doc.totalVersions + 1,
          fileName: input.fileName,
          fileUrl: input.fileUrl,
          fileSize: input.fileSize,
          mimeType: input.mimeType,
          versionNote: input.versionNote || null,
          uploadedById: ctx.user.userId,
        },
      });

      await ctx.prisma.document.update({
        where: { id: input.documentId },
        data: {
          currentVersionId: version.id,
          totalVersions: { increment: 1 },
          fileType: classifyFileType(input.mimeType),
        },
      });

      // AI: Generate version summary + re-index (async, non-blocking)
      generateVersionSummary(ctx.prisma, input.documentId, version.id)
        .then(async (summary) => {
          if (summary) {
            await ctx.prisma.documentVersion.update({
              where: { id: version.id },
              data: { versionNote: summary },
            });
          }
        })
        .catch((err) => console.error("[doc-ai] Summary error:", err));

      indexDocument(ctx.prisma, input.documentId).catch((err) =>
        console.error("[doc-ai] Index error:", err)
      );

      return version;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(500).optional(),
      description: z.string().nullable().optional(),
      folderId: z.string().uuid().nullable().optional(),
      categoryId: z.string().uuid().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      const data: any = {};
      if (input.title !== undefined) data.title = input.title;
      if (input.description !== undefined) data.description = input.description;
      if (input.folderId !== undefined) data.folderId = input.folderId;
      if (input.categoryId !== undefined) data.categoryId = input.categoryId;
      return ctx.prisma.document.update({ where: { id: input.id }, data });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      await ctx.prisma.document.update({ where: { id: input.id }, data: { deletedAt: new Date() } });
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.id } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      return ctx.prisma.document.update({ where: { id: input.id }, data: { deletedAt: null } });
    }),

  listByTask: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.prisma.documentTaskLink.findMany({
        where: { taskId: input.taskId },
        include: {
          document: {
            select: {
              id: true,
              title: true,
              fileType: true,
              totalVersions: true,
              updatedAt: true,
              createdBy: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      });
      return links.map((l) => l.document);
    }),

  search: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return ctx.prisma.document.findMany({
        where: {
          projectId: input.projectId,
          deletedAt: null,
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
            { versions: { some: { versionNote: { contains: input.query, mode: "insensitive" } } } },
            { tags: { some: { tag: { name: { contains: input.query, mode: "insensitive" } } } } },
          ],
        },
        include: {
          currentVersion: true,
          tags: { include: { tag: true } },
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
        },
        take: input.limit,
        orderBy: { updatedAt: "desc" },
      });
    }),

  aiSearch: protectedProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      query: z.string().min(1),
      limit: z.number().int().min(1).max(20).default(10),
    }))
    .query(async ({ ctx, input }) => {
      await requireProjectAccess(ctx.prisma, ctx.user.userId, input.projectId);
      return semanticSearch(ctx.prisma, input.projectId, input.query, input.limit);
    }),

  reindex: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.prisma.document.findUniqueOrThrow({ where: { id: input.documentId } });
      await requireProjectAccess(ctx.prisma, ctx.user.userId, doc.projectId);
      await indexDocument(ctx.prisma, input.documentId);
      return { success: true };
    }),
});
