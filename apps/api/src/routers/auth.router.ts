import { z } from "zod";
import bcrypt from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../trpc.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../lib/jwt.js";
import { createSlug } from "../utils/helpers.js";
import { redis } from "../utils/redis.js";
import { sendPasswordResetEmail } from "../services/email.js";
import crypto from "crypto";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const registerInput = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = router({
  register: publicProcedure.input(registerInput).mutation(async ({ ctx, input }) => {
    const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Email already registered" });

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await ctx.prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, onboardingCompleted: false },
    });

    // Check if there are pending invitations for this email — auto-accept them
    const pendingInvites = await ctx.prisma.workspaceInvite.findMany({
      where: { email: input.email, status: "pending", expiresAt: { gt: new Date() } },
    });
    let firstWorkspaceId: string | null = null;
    for (const invite of pendingInvites) {
      const roleName = invite.role === "admin" ? "Admin" : invite.role === "guest" ? "Viewer" : "Developer";
      const roleRecord = await ctx.prisma.role.findUnique({
        where: { workspaceId_name: { workspaceId: invite.workspaceId, name: roleName } },
      });
      await ctx.prisma.workspaceMember.create({
        data: { workspaceId: invite.workspaceId, userId: user.id, role: invite.role, roleId: roleRecord?.id || null },
      });
      await ctx.prisma.workspaceInvite.update({ where: { id: invite.id }, data: { status: "accepted" } });
      if (!firstWorkspaceId) firstWorkspaceId = invite.workspaceId;
    }

    // Also check Invitation table
    const pendingInvitations = await ctx.prisma.invitation.findMany({
      where: { email: input.email, status: "pending", expiresAt: { gt: new Date() } },
    });
    for (const inv of pendingInvitations) {
      const roleName = inv.role === "admin" ? "Admin" : inv.role === "guest" ? "Viewer" : "Developer";
      const roleRecord = await ctx.prisma.role.findUnique({
        where: { workspaceId_name: { workspaceId: inv.workspaceId, name: roleName } },
      });
      const existing = await ctx.prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: inv.workspaceId, userId: user.id } },
      });
      if (!existing) {
        await ctx.prisma.workspaceMember.create({
          data: { workspaceId: inv.workspaceId, userId: user.id, role: inv.role as any, roleId: roleRecord?.id || null },
        });
      }
      await ctx.prisma.invitation.update({ where: { id: inv.id }, data: { status: "accepted" } });
      if (!firstWorkspaceId) firstWorkspaceId = inv.workspaceId;
    }

    if (firstWorkspaceId) {
      await ctx.prisma.user.update({ where: { id: user.id }, data: { onboardingCompleted: true } });
    }

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshTokenStr = signRefreshToken({ userId: user.id, email: user.email });

    await ctx.prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: ctx.req.headers["user-agent"] || null,
      },
    });

    return {
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken: refreshTokenStr,
      workspaceId: firstWorkspaceId,
      onboardingCompleted: !!firstWorkspaceId,
    };
  }),

  login: publicProcedure.input(loginInput).mutation(async ({ ctx, input }) => {
    const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.passwordHash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid credentials" });

    // If 2FA is enabled, return a temp token instead of real auth
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      const tempToken = crypto.randomBytes(32).toString("hex");
      await redis.setex(`2fa:${tempToken}`, 300, user.id); // 5 min expiry
      return {
        requires2FA: true as const,
        tempToken,
        user: null,
        accessToken: null,
        refreshToken: null,
        workspaceId: null,
      };
    }

    await ctx.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signAccessToken({ userId: user.id, email: user.email });
    const refreshTokenStr = signRefreshToken({ userId: user.id, email: user.email });

    await ctx.prisma.refreshToken.create({
      data: {
        token: refreshTokenStr,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: ctx.req.headers["user-agent"] || null,
      },
    });

    // Find user's first workspace
    const membership = await ctx.prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      select: { workspaceId: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      requires2FA: false as const,
      tempToken: null,
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      accessToken,
      refreshToken: refreshTokenStr,
      workspaceId: membership?.workspaceId || null,
    };
  }),

  verify2FALogin: publicProcedure
    .input(z.object({ tempToken: z.string(), code: z.string().min(6).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const userId = await redis.get(`2fa:${input.tempToken}`);
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired token" });

      const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.twoFactorSecret) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid user" });

      // Try TOTP code first
      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret), algorithm: "SHA1", digits: 6, period: 30 });
      const delta = totp.validate({ token: input.code, window: 1 });

      if (delta === null) {
        // Try backup codes
        const hashedCode = crypto.createHash("sha256").update(input.code).digest("hex");
        const backupIdx = user.twoFactorBackupCodes.indexOf(hashedCode);
        if (backupIdx === -1) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid 2FA code" });
        // Remove used backup code
        const updatedCodes = [...user.twoFactorBackupCodes];
        updatedCodes.splice(backupIdx, 1);
        await ctx.prisma.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: updatedCodes } });
      }

      await redis.del(`2fa:${input.tempToken}`);
      await ctx.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

      const accessToken = signAccessToken({ userId: user.id, email: user.email });
      const refreshTokenStr = signRefreshToken({ userId: user.id, email: user.email });

      await ctx.prisma.refreshToken.create({
        data: { token: refreshTokenStr, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), userAgent: ctx.req.headers["user-agent"] || null },
      });

      const membership = await ctx.prisma.workspaceMember.findFirst({ where: { userId: user.id }, select: { workspaceId: true }, orderBy: { createdAt: "asc" } });

      return {
        user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
        accessToken,
        refreshToken: refreshTokenStr,
        workspaceId: membership?.workspaceId || null,
      };
    }),

  refreshToken: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const stored = await ctx.prisma.refreshToken.findUnique({ where: { token: input.refreshToken } });
      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid refresh token" });
      }

      const user = await ctx.prisma.user.findUnique({ where: { id: stored.userId } });
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });

      // Rotate tokens
      await ctx.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

      const accessToken = signAccessToken({ userId: user.id, email: user.email });
      const newRefresh = signRefreshToken({ userId: user.id, email: user.email });

      await ctx.prisma.refreshToken.create({
        data: {
          token: newRefresh,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return { accessToken, refreshToken: newRefresh };
    }),

  logout: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.refreshToken.updateMany({
        where: { token: input.refreshToken },
        data: { revokedAt: new Date() },
      });
      return { success: true };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.userId },
      select: {
        id: true, name: true, email: true, avatarUrl: true, theme: true, timezone: true,
        onboardingCompleted: true, createdAt: true, updatedAt: true,
        workspaceMembers: {
          include: { workspace: { select: { id: true, name: true, slug: true, logoUrl: true } } },
        },
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    return {
      ...user,
      workspaces: user.workspaceMembers.map((m) => ({ ...m.workspace, role: m.role })),
    };
  }),

  changePassword: protectedProcedure
    .input(z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(8).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.user.userId } });
      if (!user.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "No password set" });
      const valid = await bcrypt.compare(input.oldPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Old password is incorrect" });
      const hash = await bcrypt.hash(input.newPassword, 12);
      await ctx.prisma.user.update({ where: { id: ctx.user.userId }, data: { passwordHash: hash } });
      return { success: true };
    }),

  deleteAccount: protectedProcedure
    .input(z.object({ confirmation: z.literal("DELETE MY ACCOUNT") }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.user.update({ where: { id: ctx.user.userId }, data: { deletedAt: new Date() } });
      await ctx.prisma.refreshToken.updateMany({ where: { userId: ctx.user.userId }, data: { revokedAt: new Date() } });
      return { success: true };
    }),

  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUnique({ where: { email: input.email } });
      // Always return success to prevent email enumeration
      if (!user) return { success: true };

      const token = crypto.randomBytes(32).toString("hex");
      await redis.setex(`reset:${token}`, 3600, user.id);

      const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      await sendPasswordResetEmail(input.email, { resetUrl });

      return { success: true };
    }),

  resetPassword: publicProcedure
    .input(z.object({ token: z.string().min(1), newPassword: z.string().min(8).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const userId = await redis.get(`reset:${input.token}`);
      if (!userId) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid or expired reset token" });

      const hash = await bcrypt.hash(input.newPassword, 12);
      await ctx.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
      await redis.del(`reset:${input.token}`);

      return { success: true };
    }),

  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(100).optional(),
      avatarUrl: z.string().url().optional().nullable(),
      timezone: z.string().max(50).optional(),
      theme: z.enum(["light", "dark", "system"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.update({
        where: { id: ctx.user.userId },
        data: input,
        select: { id: true, name: true, email: true, avatarUrl: true, theme: true, timezone: true },
      });
      return user;
    }),

  get2FAStatus: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.userId },
      select: { twoFactorEnabled: true },
    });
    return { enabled: user.twoFactorEnabled };
  }),

  enable2FA: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.user.userId } });
    if (user.twoFactorEnabled) throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is already enabled" });

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({ issuer: "DKFlow", label: user.email, secret, algorithm: "SHA1", digits: 6, period: 30 });
    const otpauthUrl = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily until verified
    await redis.setex(`2fa-setup:${ctx.user.userId}`, 600, secret.base32);

    return { qrCodeUrl, secret: secret.base32, otpauthUrl };
  }),

  verify2FA: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const secretStr = await redis.get(`2fa-setup:${ctx.user.userId}`);
      if (!secretStr) throw new TRPCError({ code: "BAD_REQUEST", message: "No 2FA setup in progress. Please start again." });

      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secretStr), algorithm: "SHA1", digits: 6, period: 30 });
      const delta = totp.validate({ token: input.code, window: 1 });
      if (delta === null) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid verification code" });

      // Generate backup codes
      const backupCodes: string[] = [];
      const hashedBackupCodes: string[] = [];
      for (let i = 0; i < 8; i++) {
        const code = crypto.randomBytes(4).toString("hex");
        backupCodes.push(code);
        hashedBackupCodes.push(crypto.createHash("sha256").update(code).digest("hex"));
      }

      await ctx.prisma.user.update({
        where: { id: ctx.user.userId },
        data: { twoFactorEnabled: true, twoFactorSecret: secretStr, twoFactorBackupCodes: hashedBackupCodes },
      });
      await redis.del(`2fa-setup:${ctx.user.userId}`);

      return { success: true, backupCodes };
    }),

  disable2FA: protectedProcedure
    .input(z.object({ code: z.string().min(6).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.user.userId } });
      if (!user.twoFactorEnabled || !user.twoFactorSecret) throw new TRPCError({ code: "BAD_REQUEST", message: "2FA is not enabled" });

      const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret), algorithm: "SHA1", digits: 6, period: 30 });
      const delta = totp.validate({ token: input.code, window: 1 });
      if (delta === null) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid 2FA code" });

      await ctx.prisma.user.update({
        where: { id: ctx.user.userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
      });

      return { success: true };
    }),
});
