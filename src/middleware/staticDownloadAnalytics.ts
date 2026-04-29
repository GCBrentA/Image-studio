import type { RequestHandler } from "express";

const pluginSlugFromDownloadPath = (path: string): string => {
  if (path.includes("payment-gateway-rules")) return "optivra-gateway-rules";
  if (path.includes("optivra-image-studio")) return "optivra-image-studio";
  return "woocommerce_plugins";
};

export const staticDownloadAnalytics: RequestHandler = (request, response, next) => {
  if (!request.path.toLowerCase().endsWith(".zip")) {
    next();
    return;
  }

  const plugin = encodeURIComponent(pluginSlugFromDownloadPath(request.path));
  response.redirect(302, `/downloads?plugin=${plugin}&download=1`);
};
