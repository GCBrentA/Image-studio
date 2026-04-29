import { Router } from "express";
import { requireDatabase } from "../middleware/requireDatabase";
import {
  completePluginDownloadEvent,
  createPluginDownloadLeadRequest,
  createPluginFeedback,
  getUnsubscribeLead,
  listPublicPluginReleases,
  streamPluginLeadDownload,
  unsubscribePluginLead
} from "../services/pluginLeadWorkflowService";

export const pluginDownloadRoutes = Router();

pluginDownloadRoutes.use(requireDatabase);

pluginDownloadRoutes.get("/releases", (request, response, next) => {
  listPublicPluginReleases(request.query.plugin_slug ?? request.query.pluginSlug)
    .then((releases) => response.json({ ok: true, releases }))
    .catch(next);
});

pluginDownloadRoutes.post("/download-request", (request, response, next) => {
  createPluginDownloadLeadRequest(request.body ?? {}, {
    ip: request.ip,
    userAgent: request.get("user-agent") ?? undefined
  })
    .then((result) => response.status(201).json(result))
    .catch(next);
});

pluginDownloadRoutes.get("/download/:eventId", (request, response, next) => {
  streamPluginLeadDownload(request.params.eventId, response).catch(next);
});

pluginDownloadRoutes.post("/download-complete", (request, response, next) => {
  completePluginDownloadEvent(request.body?.event_id ?? request.body?.eventId)
    .then((result) => response.json(result))
    .catch(next);
});

pluginDownloadRoutes.post("/feedback", (request, response, next) => {
  createPluginFeedback(request.body ?? {})
    .then((result) => response.status(201).json(result))
    .catch(next);
});

pluginDownloadRoutes.get("/unsubscribe", (request, response, next) => {
  getUnsubscribeLead(request.query.token)
    .then((result) => response.json(result))
    .catch(next);
});

pluginDownloadRoutes.post("/unsubscribe", (request, response, next) => {
  unsubscribePluginLead(request.body ?? {})
    .then((result) => response.json(result))
    .catch(next);
});
