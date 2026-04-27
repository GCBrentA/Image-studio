import type { Response } from "express";
import type { InternalAdminRequest } from "../middleware/requireInternalAdmin";
import {
  getPluginAnalyticsEvents,
  getPluginAnalyticsOverview,
  getPluginAnalyticsSeries,
  getPluginAnalyticsStoreDetail,
  getPluginAnalyticsStores,
  getPluginAnalyticsTrends
} from "../services/adminAnalyticsService";

const parseRangeDays = (value: unknown, fallback = 7): number => {
  const parsed = Number(value);
  if ([7, 30, 90].includes(parsed)) {
    return parsed;
  }
  if (String(value) === "all") {
    return 0;
  }
  return fallback;
};

export const getAdminPluginAnalyticsOverview = async (
  _request: InternalAdminRequest,
  response: Response
): Promise<void> => {
  const days = parseRangeDays(_request.query.range, 7);
  response.status(200).json({
    overview: await getPluginAnalyticsOverview(days),
    event_counts_30d: await getPluginAnalyticsSeries(days),
    trends: await getPluginAnalyticsTrends(days)
  });
};

export const getAdminPluginAnalyticsStores = async (
  _request: InternalAdminRequest,
  response: Response
): Promise<void> => {
  response.status(200).json({
    stores: await getPluginAnalyticsStores()
  });
};

export const getAdminPluginAnalyticsEvents = async (
  _request: InternalAdminRequest,
  response: Response
): Promise<void> => {
  response.status(200).json({
    events: await getPluginAnalyticsEvents()
  });
};

export const getAdminPluginAnalyticsStore = async (
  request: InternalAdminRequest,
  response: Response
): Promise<void> => {
  response.status(200).json(await getPluginAnalyticsStoreDetail(request.params.id));
};
