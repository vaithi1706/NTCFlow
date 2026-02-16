import Redis from "ioredis";
import { logger } from "./logger.js";

export const redis = new (Redis as any).default(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err: Error) => logger.error("Redis error:", err));

redis.connect().catch((err: Error) => {
  logger.error("Failed to connect to Redis:", err);
});
