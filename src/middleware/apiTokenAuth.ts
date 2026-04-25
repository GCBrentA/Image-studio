import type { NextFunction, Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { hashApiToken } from "../utils/apiToken";

export type ApiAuthContext = {
  userId: string;
  siteId: string;
  domain: string;
};

export type AuthenticatedRequest = Request & {
  auth?: ApiAuthContext;
};

const getApiToken = (request: Request): string | null => {
  const authorization = request.header("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  return request.header("x-api-token")?.trim() ?? null;
};

export const apiTokenAuth = async (
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = getApiToken(request);

    if (!token) {
      response.status(401).json({
        status: "error",
        processed_url: null,
        credits_remaining: null,
        error: "Missing API token"
      });
      return;
    }

    const tokenHash = hashApiToken(token);
    const connectedSite = await prisma.connectedSite.findFirst({
      where: {
        api_token_hash: tokenHash
      },
      select: {
        id: true,
        user_id: true,
        domain: true
      }
    });

    if (!connectedSite) {
      response.status(401).json({
        status: "error",
        processed_url: null,
        credits_remaining: null,
        error: "Invalid API token"
      });
      return;
    }

    request.auth = {
      userId: connectedSite.user_id,
      siteId: connectedSite.id,
      domain: connectedSite.domain
    };

    next();
  } catch (error) {
    next(error);
  }
};
