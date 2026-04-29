import type { env as runtimeEnv } from "./env";

type EnvShape = Pick<
  typeof runtimeEnv,
  "apiBaseUrl" | "appUrl" | "publicBaseUrl" | "supabaseProjectUrl" | "supabaseRestUrl" | "supabaseUrl"
>;

export const optivraContentSecurityPolicyDirectives = (env: EnvShape) => {
  const derivedConnectSources = [
    env.apiBaseUrl,
    env.appUrl,
    env.publicBaseUrl,
    env.supabaseProjectUrl,
    env.supabaseRestUrl,
    env.supabaseUrl
  ]
    .filter(Boolean)
    .map((value) => {
      try {
        const url = new URL(value);
        return url.origin;
      } catch {
        return "";
      }
    })
    .filter(Boolean);

  return {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    formAction: ["'self'"],
    frameAncestors: ["'self'", "https://admin.shopify.com", "https://*.myshopify.com"],
    scriptSrc: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
    scriptSrcElem: ["'self'", "'unsafe-inline'", "https://www.googletagmanager.com", "https://www.google-analytics.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
    imgSrc: ["'self'", "data:", "blob:", "https:"],
    connectSrc: [
      "'self'",
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://region1.google-analytics.com",
      "https://stats.g.doubleclick.net",
      "https://api.stripe.com",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
      "https://*.supabase.co",
      ...derivedConnectSources
    ],
    frameSrc: [
      "'self'",
      "https://www.googletagmanager.com",
      "https://checkout.stripe.com",
      "https://billing.stripe.com",
      "https://js.stripe.com",
      "https://admin.shopify.com",
      "https://*.myshopify.com"
    ]
  };
};

export const serializeContentSecurityPolicy = (directives: Record<string, string[]>): string => {
  const toHeaderName = (key: string): string => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return Object.entries(directives)
    .map(([key, values]) => `${toHeaderName(key)} ${Array.from(new Set(values)).join(" ")}`)
    .join("; ");
};
