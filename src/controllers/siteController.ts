import type { Response } from "express";
import { connectSite } from "../services/siteService";
import type { JwtAuthenticatedRequest } from "../middleware/jwtAuth";

type ConnectSiteBody = {
  domain?: unknown;
};

export const connect = async (
  request: JwtAuthenticatedRequest,
  response: Response
): Promise<void> => {
  if (!request.user) {
    response.status(401).json({
      error: "Unauthorized"
    });
    return;
  }

  const body = request.body as ConnectSiteBody;
  const domain = typeof body.domain === "string" ? body.domain : "";

  response.status(201).json(await connectSite(request.user.userId, domain));
};
