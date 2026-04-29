import type { Request, Response } from "express";
import { getSiteAnalyticsOverview, trackSiteAnalyticsEvent } from "../services/siteAnalyticsService";

const parseRangeDays = (value: unknown, fallback = 30): number => {
  const parsed = Number(value);
  if ([7, 30, 90].includes(parsed)) return parsed;
  if (String(value) === "all") return 0;
  return fallback;
};

export const createAnalyticsEvent = async (request: Request, response: Response): Promise<void> => {
  const eventName = String(request.body?.event_name || request.body?.eventName || "");
  const params = typeof request.body?.params === "object" && request.body.params ? request.body.params : {};

  await trackSiteAnalyticsEvent({
    eventName,
    eventSource: "website",
    params
  });

  response.status(202).json({ ok: true });
};

export const getAdminSiteAnalyticsOverview = async (request: Request, response: Response): Promise<void> => {
  const days = parseRangeDays(request.query.range, 30);
  response.status(200).json({
    overview: await getSiteAnalyticsOverview(days)
  });
};

