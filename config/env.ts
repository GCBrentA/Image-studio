import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const runtimeEnvVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "API_TOKEN_SALT",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "OPENAI_API_KEY",
  "APP_URL",
  "API_BASE_URL"
] as const;

const missingEnvVars = runtimeEnvVars.filter((key) => !process.env[key]);

if (missingEnvVars.length > 0 && process.env.NODE_ENV !== "test") {
  console.warn(`Missing environment variables: ${missingEnvVars.join(", ")}`);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  directUrl: process.env.DIRECT_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  apiTokenSalt: process.env.API_TOKEN_SALT ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  appUrl: process.env.APP_URL ?? "",
  apiBaseUrl: process.env.API_BASE_URL ?? "",
  backgroundRemovalApiUrl: process.env.BACKGROUND_REMOVAL_API_URL ?? "",
  backgroundRemovalApiKey: process.env.BACKGROUND_REMOVAL_API_KEY ?? "",
  publicBaseUrl:
    process.env.API_BASE_URL ??
    process.env.APP_URL ??
    process.env.PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL)
};
