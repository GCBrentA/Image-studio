import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const isDatabaseConfigured = (): boolean => env.hasDatabaseUrl;

export const getPrismaClient = (): PrismaClient => {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured. Set DATABASE_URL to enable database routes.");
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"]
  });
  }

  return globalForPrisma.prisma;
};

export const disconnectPrisma = async (): Promise<void> => {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect();
  }
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const value = Reflect.get(getPrismaClient(), property, receiver);

    if (typeof value === "function") {
      return value.bind(getPrismaClient());
    }

    return value;
  }
});
