import { env } from "../../config/env";

export type HealthStatus = {
  status: "ok";
  service: string;
  environment: string;
  uptime: number;
  timestamp: string;
};

export const getHealthStatus = (): HealthStatus => ({
  status: "ok",
  service: "optivra-backend",
  environment: env.nodeEnv,
  uptime: process.uptime(),
  timestamp: new Date().toISOString()
});
