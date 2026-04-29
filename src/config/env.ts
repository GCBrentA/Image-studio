import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const runtimeEnvVars = [
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_PROJECT_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "API_TOKEN_SALT",
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_AGENCY",
  "STRIPE_CREDIT_PRICE_SMALL",
  "STRIPE_CREDIT_PRICE_MEDIUM",
  "STRIPE_CREDIT_PRICE_LARGE",
  "STRIPE_CREDIT_PRICE_AGENCY",
  "STRIPE_SUCCESS_URL",
  "STRIPE_CANCEL_URL",
  "APP_BASE_URL"
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
  supabaseProjectUrl: process.env.SUPABASE_PROJECT_URL ?? "",
  supabaseRestUrl: process.env.SUPABASE_REST_URL ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  apiTokenSalt: process.env.API_TOKEN_SALT ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePriceIds: {
    starter: process.env.STRIPE_PRICE_STARTER ?? process.env.STRIPE_STARTER_PRICE_ID ?? "",
    growth: process.env.STRIPE_PRICE_GROWTH ?? process.env.STRIPE_GROWTH_PRICE_ID ?? "",
    pro: process.env.STRIPE_PRICE_PRO ?? process.env.STRIPE_PRO_PRICE_ID ?? "",
    agency: process.env.STRIPE_PRICE_AGENCY ?? process.env.STRIPE_AGENCY_PRICE_ID ?? ""
  },
  stripeCreditPackPriceIds: {
    small: process.env.STRIPE_CREDIT_PRICE_SMALL ?? process.env.STRIPE_CREDIT_PACK_100_PRICE_ID ?? "",
    medium: process.env.STRIPE_CREDIT_PRICE_MEDIUM ?? process.env.STRIPE_CREDIT_PACK_300_PRICE_ID ?? "",
    large: process.env.STRIPE_CREDIT_PRICE_LARGE ?? process.env.STRIPE_CREDIT_PACK_1000_PRICE_ID ?? "",
    agency: process.env.STRIPE_CREDIT_PRICE_AGENCY ?? ""
  },
  stripeSuccessUrl: process.env.STRIPE_SUCCESS_URL ?? "",
  stripeCancelUrl: process.env.STRIPE_CANCEL_URL ?? "",
  billingCurrency: (process.env.BILLING_CURRENCY ?? "usd").toLowerCase(),
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  appUrl: process.env.APP_BASE_URL ?? process.env.APP_URL ?? "",
  apiBaseUrl: process.env.API_BASE_URL ?? "",
  ga4MeasurementId:
    process.env.GA4_MEASUREMENT_ID ??
    process.env.GA_MEASUREMENT_ID ??
    process.env.VITE_GA4_MEASUREMENT_ID ??
    "",
  googleTagId: process.env.GOOGLE_TAG_ID ?? "",
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION ?? "",
  ga4MeasurementProtocolSecret: process.env.GA4_MEASUREMENT_PROTOCOL_SECRET ?? "",
  viteGtmId: process.env.VITE_GTM_ID ?? "",
  analyticsDebug: process.env.VITE_ANALYTICS_DEBUG === "true" || process.env.ANALYTICS_DEBUG === "true",
  backgroundRemovalApiUrl: process.env.BACKGROUND_REMOVAL_API_URL ?? "",
  backgroundRemovalApiKey: process.env.BACKGROUND_REMOVAL_API_KEY ?? "",
  storageSignedUrlExpiresSeconds: Number(process.env.STORAGE_SIGNED_URL_EXPIRES_SECONDS ?? 60 * 60 * 24 * 7),
  imageStorageRetentionDays: Number(process.env.IMAGE_STORAGE_RETENTION_DAYS ?? 30),
  planCreditLimits: {
    starter: Number(process.env.STARTER_MONTHLY_CREDITS ?? 20),
    growth: Number(process.env.GROWTH_MONTHLY_CREDITS ?? 100),
    pro: Number(process.env.PRO_MONTHLY_CREDITS ?? 500),
    agency: Number(process.env.AGENCY_MONTHLY_CREDITS ?? 1500)
  },
  publicBaseUrl:
    process.env.APP_BASE_URL ??
    process.env.API_BASE_URL ??
    process.env.APP_URL ??
    process.env.PUBLIC_BASE_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`,
  hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
  internalAdminEmails: (process.env.INTERNAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
};
