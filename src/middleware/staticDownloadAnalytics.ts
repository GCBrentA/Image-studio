import type { RequestHandler } from "express";
import { sendGa4ServerEvent } from "../lib/analytics/server";
import { trackSiteAnalyticsEvent } from "../services/siteAnalyticsService";

const pluginSlugFromDownloadPath = (path: string): string => {
  if (path.includes("payment-gateway-rules")) return "payment_gateway_rules";
  if (path.includes("optivra-image-studio")) return "optivra_image_studio";
  return "woocommerce_plugins";
};

const pluginVersionFromDownloadPath = (path: string): string | undefined => {
  const match = path.match(/-(\d+\.\d+\.\d+)\.zip$/i);
  return match?.[1];
};

export const staticDownloadAnalytics: RequestHandler = (request, response, next) => {
  if (!request.path.toLowerCase().endsWith(".zip")) {
    next();
    return;
  }

  const params = {
    plugin_slug: pluginSlugFromDownloadPath(request.path),
    plugin_version: pluginVersionFromDownloadPath(request.path),
    download_type: "zip",
    result: "success",
    funnel_stage: "conversion"
  };

  response.on("finish", () => {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      Promise.allSettled([
        trackSiteAnalyticsEvent({ eventName: "server_plugin_download_completed", eventSource: "server", params }),
        sendGa4ServerEvent({ eventName: "server_plugin_download_completed", params })
      ]).catch(() => undefined);
    }
  });

  next();
};

