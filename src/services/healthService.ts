import { env } from "../config/env";
import { prisma } from "../utils/prisma";

export type HealthStatus = {
  status: "ok";
  service: string;
  timestamp: string;
  database: "configured" | "missing";
  database_check: "ok" | "skipped" | "timeout" | "error";
};

const DATABASE_HEALTH_TIMEOUT_MS = 1500;

const withTimeout = async <T>(operation: Promise<T>, timeoutMs: number): Promise<T | "timeout"> => {
  let timeout: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<"timeout">((resolve) => {
        timeout = setTimeout(() => resolve("timeout"), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

const checkDatabase = async (): Promise<HealthStatus["database_check"]> => {
  if (!env.hasDatabaseUrl) {
    return "skipped";
  }

  try {
    const result = await withTimeout(prisma.$queryRaw`SELECT 1`, DATABASE_HEALTH_TIMEOUT_MS);
    return result === "timeout" ? "timeout" : "ok";
  } catch {
    return "error";
  }
};

export const getHealthStatus = async (): Promise<HealthStatus> => ({
  status: "ok",
  service: "image-studio",
  timestamp: new Date().toISOString(),
  database: env.hasDatabaseUrl ? "configured" : "missing",
  database_check: await checkDatabase()
});
