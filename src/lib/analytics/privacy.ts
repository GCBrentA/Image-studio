const sensitiveKeyPattern =
  /(email|e_mail|phone|mobile|address|street|postcode|zip_code|postal|full_name|first_name|last_name|display_name|contact_name|license|licence|token|secret|password|api_key|apikey|openai|stripe|customer_id|session_id|checkout_session|payment_intent|key|raw|stack|trace|uploaded_image|image_url|source_image_url)/i;

const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phonePattern = /(?:\+?\d[\s().-]*){8,}/;
const urlWithQueryPattern = /^https?:\/\/[^?\s]+[?][^\s]+/i;

const maxStringLength = 120;

export type SanitizedAnalyticsParams = Record<string, string | number | boolean | null>;

export const sanitizeAnalyticsEventName = (value: unknown): string => {
  const eventName = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

  return eventName || "unknown_event";
};

export const sanitizeAnalyticsKey = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

export const isSensitiveAnalyticsKey = (key: string): boolean => sensitiveKeyPattern.test(key);

export const containsLikelyPii = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return emailPattern.test(value) || phonePattern.test(value) || urlWithQueryPattern.test(value);
};

export const sanitizeAnalyticsValue = (value: unknown): string | number | boolean | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const text = String(value).trim();
  if (!text || containsLikelyPii(text)) return undefined;

  return text
    .replace(/https?:\/\/[^\s?#]+([?#][^\s]*)?/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return "";
      }
    })
    .replace(/[^\w\-./:# ]/g, "")
    .slice(0, maxStringLength);
};

export const sanitizeAnalyticsParams = (params: Record<string, unknown> = {}): SanitizedAnalyticsParams => {
  const safe: SanitizedAnalyticsParams = {};

  Object.entries(params).forEach(([rawKey, rawValue]) => {
    const key = sanitizeAnalyticsKey(rawKey);
    if (!key || isSensitiveAnalyticsKey(key)) return;

    const value = sanitizeAnalyticsValue(rawValue);
    if (value === undefined) return;
    safe[key] = value;
  });

  return safe;
};

export const errorCategoryFrom = (error: unknown): string => {
  if (typeof error === "object" && error && "statusCode" in error) {
    const statusCode = Number((error as { statusCode?: unknown }).statusCode);
    if (Number.isFinite(statusCode)) {
      if (statusCode === 401 || statusCode === 403) return "auth";
      if (statusCode === 404) return "not_found";
      if (statusCode === 429) return "rate_limited";
      if (statusCode >= 400 && statusCode < 500) return "client_error";
      if (statusCode >= 500) return "server_error";
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error ?? "").toLowerCase();
  if (message.includes("stripe")) return "checkout_provider";
  if (message.includes("network") || message.includes("fetch")) return "network";
  if (message.includes("timeout")) return "timeout";
  if (message.includes("auth") || message.includes("permission")) return "auth";
  return "unknown";
};
