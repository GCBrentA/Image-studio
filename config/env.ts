import dotenv from "dotenv";

dotenv.config();

const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "OPENAI_API_KEY"
] as const;

const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV !== "test") {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  backgroundRemovalApiUrl: process.env.BACKGROUND_REMOVAL_API_URL ?? "",
  backgroundRemovalApiKey: process.env.BACKGROUND_REMOVAL_API_KEY ?? "",
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
};
