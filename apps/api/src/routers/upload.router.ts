import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc.js";
import path from "path";
import fs from "fs";

export const uploadRouter = router({
  list: protectedProcedure
    .input(z.object({ taskId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.attachment.findMany({
        where: { taskId: input.taskId },
        include: { uploadedBy: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  deleteFile: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const attachment = await ctx.prisma.attachment.findUniqueOrThrow({ where: { id: input.id } });
      if (attachment.uploadedById !== ctx.user.userId) throw new TRPCError({ code: "FORBIDDEN" });

      const filePath = path.join(process.env.UPLOAD_DIR || "/home/ubuntu/dkflow/uploads", path.basename(attachment.fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

      await ctx.prisma.attachment.delete({ where: { id: input.id } });
      return { success: true };
    }),
});
