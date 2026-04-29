import { config } from "../config";

const approvedEvents = new Set([
  "shopify_install_started",
  "shopify_install_success",
  "shopify_install_error",
  "shopify_oauth_started",
  "shopify_oauth_callback_success",
  "shopify_oauth_callback_error",
  "server_shopify_install_success",
  "server_shopify_install_error",
  "server_webhook_received",
  "server_webhook_error"
]);

const sensitiveKeyPattern = /(email|phone|address|full_name|first_name|last_name|display_name|contact_name|token|secret|password|api_key|key|stripe|openai|raw|stack|trace|shop_domain|shop)/i;

function sanitizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
}

function sanitizeParams(params: Record<string, unknown> = {}) {
  const safe: Record<string, string | number | boolean | null> = {};
  Object.entries(params).forEach(([rawKey, value]) => {
    const key = sanitizeKey(rawKey);
    if (!key || sensitiveKeyPattern.test(key) || value === undefined) return;
    if (typeof value === "number" && Number.isFinite(value)) safe[key] = value;
    else if (typeof value === "boolean" || value === null) safe[key] = value;
    else {
      const text = String(value).trim();
      if (text) safe[key] = text.replace(/[^\w\-./:# ]/g, "").slice(0, 120);
    }
  });
  return safe;
}

export async function trackShopifyServerEvent(eventName: string, params: Record<string, unknown> = {}) {
  const name = sanitizeKey(eventName);
  if (!approvedEvents.has(name)) return;
  if (!config.ga4MeasurementId || !config.ga4MeasurementProtocolSecret) {
    if (config.analyticsDebug && config.nodeEnv !== "production") {
      console.info("[analytics] Shopify event skipped; GA4 Measurement Protocol is not configured", { event_name: name });
    }
    return;
  }

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.ga4MeasurementId)}&api_secret=${encodeURIComponent(config.ga4MeasurementProtocolSecret)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: "server.shopify.optivra",
        non_personalized_ads: true,
        events: [
          {
            name,
            params: sanitizeParams({ ...params, environment: config.nodeEnv })
          }
        ]
      })
    }
  ).catch(() => undefined);
}
