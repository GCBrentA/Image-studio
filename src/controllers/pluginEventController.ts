import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/apiTokenAuth";
import { recordPluginEvent } from "../services/pluginEventService";

export const createPluginEvent = async (
  request: AuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.auth) {
    response.status(401).json({
      error: "Invalid site token"
    });
    return;
  }

  const body = request.body as {
    eventType?: unknown;
    pluginVersion?: unknown;
    wordpressVersion?: unknown;
    woocommerceVersion?: unknown;
    phpVersion?: unknown;
    creditsRemaining?: unknown;
    metadata?: unknown;
  };

  const event = await recordPluginEvent({
    userId: request.auth.userId,
    siteId: request.auth.siteId,
    canonicalDomain: request.auth.canonicalDomain,
    eventType: typeof body.eventType === "string" ? body.eventType : "",
    pluginVersion: typeof body.pluginVersion === "string" ? body.pluginVersion : undefined,
    wordpressVersion: typeof body.wordpressVersion === "string" ? body.wordpressVersion : undefined,
    woocommerceVersion: typeof body.woocommerceVersion === "string" ? body.woocommerceVersion : undefined,
    phpVersion: typeof body.phpVersion === "string" ? body.phpVersion : undefined,
    creditsRemaining: Number.isInteger(body.creditsRemaining) ? Number(body.creditsRemaining) : null,
    metadata: body.metadata
  });

  response.status(201).json({
    status: "ok",
    id: event.id
  });
};
