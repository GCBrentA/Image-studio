import type { ErrorRequestHandler } from "express";
import { env } from "../config/env";
import { detectRouteGroup } from "../lib/analytics/attribution";
import { errorCategoryFrom } from "../lib/analytics/privacy";
import { sendGa4ServerEvent } from "../lib/analytics/server";
import { trackSiteAnalyticsEvent } from "../services/siteAnalyticsService";

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const statusCode = typeof error.statusCode === "number" ? error.statusCode : 500;

  console.error(error);

  if (statusCode >= 400) {
    const params = {
      page_path: request.path,
      route_group: detectRouteGroup(request.path),
      status_code: statusCode,
      error_category: errorCategoryFrom(error),
      environment: env.nodeEnv
    };
    Promise.allSettled([
      trackSiteAnalyticsEvent({ eventName: "server_api_error", eventSource: "server", params }),
      sendGa4ServerEvent({ eventName: "server_api_error", params })
    ]).catch(() => undefined);
  }

  response.status(statusCode).json({
    error: {
      ...(typeof error.code === "string" ? { code: error.code } : {}),
      message: statusCode === 500 ? "Internal server error" : error.message,
      ...(env.nodeEnv === "development" ? { stack: error.stack } : {})
    }
  });
};
