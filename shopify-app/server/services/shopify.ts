import crypto from "node:crypto";
import { config } from "../config";
import { decrypt } from "./crypto";

export function normalizeShop(shop: string) {
  const normalized = shop.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(normalized)) {
    throw new Error("Invalid shop domain");
  }
  return normalized;
}

export function verifyShopifyHmac(params: URLSearchParams) {
  const hmac = params.get("hmac") || "";
  const entries: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hmac" && key !== "signature") {
      entries.push(`${key}=${value}`);
    }
  });
  const message = entries.sort().join("&");
  const digest = crypto.createHmac("sha256", config.shopifyApiSecret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

export function verifyWebhook(rawBody: Buffer, hmacHeader: string | undefined) {
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", config.shopifyApiSecret).update(rawBody).digest("base64");
  return digest.length === hmacHeader.length && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

export async function adminGraphql<T>(shopDomain: string, encryptedToken: string, query: string, variables: Record<string, unknown> = {}) {
  const response = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": decrypt(encryptedToken)
    },
    body: JSON.stringify({ query, variables })
  });

  const body = await response.json();
  if (!response.ok || body.errors) {
    throw new Error(JSON.stringify(body.errors || body));
  }
  return body.data as T;
}

export async function exchangeCodeForToken(shop: string, code: string) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.shopifyApiKey,
      client_secret: config.shopifyApiSecret,
      code
    })
  });
  if (!response.ok) throw new Error("Shopify token exchange failed");
  return response.json() as Promise<{ access_token: string; scope: string }>;
}

export async function registerMandatoryWebhooks(shopDomain: string, encryptedToken: string, appUrl: string) {
  const topics = [
    ["APP_UNINSTALLED", `${appUrl}/webhooks/app/uninstalled`],
    ["CUSTOMERS_DATA_REQUEST", `${appUrl}/webhooks/customers/data_request`],
    ["CUSTOMERS_REDACT", `${appUrl}/webhooks/customers/redact`],
    ["SHOP_REDACT", `${appUrl}/webhooks/shop/redact`]
  ];
  for (const [topic, callbackUrl] of topics) {
    await adminGraphql(
      shopDomain,
      encryptedToken,
      `mutation WebhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
        webhookSubscriptionCreate(topic: $topic, webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }) {
          userErrors { field message }
        }
      }`,
      { topic, callbackUrl }
    ).catch((error) => {
      console.warn(`Webhook registration skipped for ${topic}: ${error.message}`);
    });
  }
}
