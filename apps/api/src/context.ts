import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { prisma } from "./lib/prisma.js";
import { redis } from "./utils/redis.js";
import { verifyToken, type JwtPayload } from "./lib/jwt.js";

export interface Context {
  prisma: typeof prisma;
  redis: typeof redis;
  user: JwtPayload | null;
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
}

export async function createContext({ req, res }: CreateExpressContextOptions): Promise<Context> {
  let user: JwtPayload | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      user = verifyToken(authHeader.slice(7));
    } catch {}
  }
  return { prisma, redis, user, req, res };
}
