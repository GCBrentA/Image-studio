import { env } from "../../config/env";

export type HealthStatus = {
  status: "ok";
  service: string;
  timestamp: string;
  database: "configured" | "missing";
};

export const getHealthStatus = (): HealthStatus => ({
  status: "ok",
  service: "image-studio",
  timestamp: new Date().toISOString(),
  database: env.hasDatabaseUrl ? "configured" : "missing"
});
