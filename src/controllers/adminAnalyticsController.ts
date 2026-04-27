import type { Response } from "express";
import type { InternalAdminRequest } from "../middleware/requireInternalAdmin";
import {
  getPluginAnalyticsEvents,
  getPluginAnalyticsOverview,
  getPluginAnalyticsSeries,
  getPluginAnalyticsStoreDetail,
  getPluginAnalyticsStores
} from "../services/adminAnalyticsService";

export const getAdminPluginAnalyticsOverview = async (
  _request: InternalAdminRequest,
  response: Response
): Promise<void> => {
  response.status(200).json({
    overview: await getPluginAnalyticsOverview(),
    event_counts_30d: await getPluginAnalyticsSeries()
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
