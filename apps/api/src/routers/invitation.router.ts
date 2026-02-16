import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { generateInviteCode } from "../utils/helpers.js";
import { sendInviteEmail } from "../services/email.js";
import { logger } from "../utils/logger.js";
import { checkLimit } from "../middleware/subscription.js";

export const invitationRouter = router({
  create: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      email: z.string().email(),
      role: z.enum(["admin", "member", "guest"]).default("member"),
    }))
    .mutation(async ({ ctx, input }) => {
      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: input.workspaceId, userId: ctx.user.userId } },
      });
      if (!member || !["owner", "admin"].includes(member.role))
        throw new TRPCError({ code: "FORBIDDEN" });

      // Subscription limit check
      const memberCount = await ctx.prisma.workspaceMember.count({ where: { workspaceId: input.workspaceId } });
      await checkLimit(input.workspaceId, "maxMembers", memberCount);

      const token = generateInviteCode();
      const invitation = await ctx.prisma.invitation.create({
        data: {
          email: input.email,
          role: input.role,
          workspaceId: input.workspaceId,
          invitedById: ctx.user.userId,
          token,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Best-effort email
      const inviter = await ctx.prisma.user.findUnique({ where: { id: ctx.user.userId }, select: { name: true } });
      const workspace = await ctx.prisma.workspace.findUnique({ where: { id: input.workspaceId }, select: { name: true } });
      if (inviter?.name && workspace?.name) {
        sendInviteEmail(input.email, {
          inviterName: inviter.name,
          workspaceName: workspace.name,
          inviteCode: invitation.token,
        }).catch((err: any) => logger.error('[invite] Email send failed:', err.message));
      }

      return { token: invitation.token, id: invitation.id };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.invitation.findMany({
        where: { workspaceId: input.workspaceId, status: "pending", expiresAt: { gt: new Date() } },
        include: { invitedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({ where: { id: input.id } });
      if (!invitation) throw new TRPCError({ code: "NOT_FOUND" });

      const member = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: ctx.user.userId } },
      });
      if (!member || !["owner", "admin"].includes(member.role))
        throw new TRPCError({ code: "FORBIDDEN" });

      await ctx.prisma.invitation.update({ where: { id: input.id }, data: { status: "revoked" } });
      return { success: true };
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({ where: { token: input.token } });
      if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date())
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired invitation" });

      const existing = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: ctx.user.userId } },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Already a member" });

      // Look up the corresponding Role record
      const roleName = invitation.role === "admin" ? "Admin" : invitation.role === "guest" ? "Viewer" : "Developer";
      const roleRecord = await ctx.prisma.role.findUnique({
        where: { workspaceId_name: { workspaceId: invitation.workspaceId, name: roleName } },
      });

      await ctx.prisma.$transaction([
        ctx.prisma.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            userId: ctx.user.userId,
            role: invitation.role as any,
            roleId: roleRecord?.id || null,
          },
        }),
        ctx.prisma.invitation.update({ where: { id: invitation.id }, data: { status: "accepted" } }),
      ]);

      return { workspaceId: invitation.workspaceId };
    }),

  resend: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.invitation.findUnique({ where: { id: input.id } });
      if (!invitation || invitation.status !== "pending")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot resend" });

      // Extend expiry
      await ctx.prisma.invitation.update({
        where: { id: input.id },
        data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      });

      const inviter = await ctx.prisma.user.findUnique({ where: { id: invitation.invitedById }, select: { name: true } });
      const workspace = await ctx.prisma.workspace.findUnique({ where: { id: invitation.workspaceId }, select: { name: true } });
      if (inviter?.name && workspace?.name) {
        sendInviteEmail(invitation.email, {
          inviterName: inviter.name,
          workspaceName: workspace.name,
          inviteCode: invitation.token,
        }).catch((err: any) => logger.error('[invite] Email send failed:', err.message));
      }

      return { success: true };
    }),
});
