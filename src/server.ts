import { env } from "../config/env";
import { app } from "./app";
import { prisma } from "./utils/prisma";

const server = app.listen(env.port, () => {
  console.info(`Optivra backend listening on port ${env.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.info(`${signal} received. Shutting down Optivra backend.`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
