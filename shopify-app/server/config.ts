import "dotenv/config";

const required = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
  "DATABASE_URL",
  "ENCRYPTION_SECRET"
] as const;

export const config = {
  port: Number(process.env.PORT || 3000),
  shopifyApiKey: process.env.SHOPIFY_API_KEY || "",
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET || "",
  appUrl: (process.env.SHOPIFY_APP_URL || "").replace(/\/$/, ""),
  scopes: process.env.SCOPES || "read_products,write_products,read_files,write_files",
  databaseUrl: process.env.DATABASE_URL || "",
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  optivraApiUrl: (process.env.OPTIVRA_API_URL || "").replace(/\/$/, ""),
  optivraApiKey: process.env.OPTIVRA_API_KEY || "",
  encryptionSecret: process.env.ENCRYPTION_SECRET || "",
  nodeEnv: process.env.NODE_ENV || "development"
};

export function validateStartupConfig() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    console.warn(`Missing required environment variables: ${missing.join(", ")}`);
  }

  console.info("Optivra Image Studio Shopify config", {
    appUrl: Boolean(config.appUrl),
    scopes: config.scopes,
    databaseUrl: Boolean(config.databaseUrl),
    optivraApiConfigured: Boolean(config.optivraApiUrl && config.optivraApiKey),
    supabaseConfigured: Boolean(config.supabaseUrl && config.supabaseServiceRoleKey)
  });
}
