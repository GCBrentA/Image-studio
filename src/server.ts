import { env } from "../config/env";
import { app } from "./app";
import { disconnectPrisma } from "./utils/prisma";

const server = app.listen(env.port, () => {
  console.info(`Image Studio listening on port ${env.port}`);
});

const shutdown = async (signal: string): Promise<void> => {
  console.info(`${signal} received. Shutting down Image Studio.`);

  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
