import { env } from "../../config/env";
import { approvedAnalyticsEvents } from "./eventMap";
import { sanitizeAnalyticsEventName, sanitizeAnalyticsParams } from "./privacy";

type ServerEventInput = {
  eventName: string;
  clientId?: string;
  params?: Record<string, unknown>;
};

export type ServerEventResult = {
  sent: boolean;
  reason?: string;
};

const debug = (message: string, params?: Record<string, unknown>): void => {
  if (env.analyticsDebug && env.nodeEnv !== "production") {
    console.info(`[analytics] ${message}`, params ? sanitizeAnalyticsParams(params) : "");
  }
};

export const sendGa4ServerEvent = async ({
  eventName,
  clientId = "server.optivra",
  params = {}
}: ServerEventInput): Promise<ServerEventResult> => {
  const measurementId = env.ga4MeasurementId;
  const apiSecret = env.ga4MeasurementProtocolSecret;
  const sanitizedEventName = sanitizeAnalyticsEventName(eventName);

  if (!measurementId || !apiSecret) {
    debug("skipped server event because GA4 Measurement Protocol is not configured", { event_name: sanitizedEventName });
    return { sent: false, reason: "ga4_measurement_protocol_not_configured" };
  }

  if (!approvedAnalyticsEvents.has(sanitizedEventName)) {
    return { sent: false, reason: "unapproved_event" };
  }

  const body = {
    client_id: clientId,
    non_personalized_ads: true,
    events: [
      {
        name: sanitizedEventName,
        params: sanitizeAnalyticsParams({
          ...params,
          environment: env.nodeEnv
        })
      }
    ]
  };

  const response = await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    return { sent: false, reason: `ga4_http_${response.status}` };
  }

  return { sent: true };
};

